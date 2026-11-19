#!/usr/bin/env python3
"""Measure commit-message quality across the author's agent-assisted repos.

For each repo, take non-merge commits on main since 2026-11-05 and score
each one with the commit-craft checker's own rule functions
(`check-commit.py`, from the commit-craft skill) on the real file paths,
so the numbers below are exactly the checker's verdicts, not a separate
re-implementation. The window starts November 5, 2026 — the day the
daily blog workflow began and the agent started writing most of the
commits. Earlier commits built the sites themselves and predate that
workflow. Reports subject length, body lines, files changed,
insertions, and per-commit checker problems. Output is JSON on stdout.

Usage:
  python3 commit-craft-measure.py [--checker PATH] [--out results.json]
Default checker: ~/workspace/claude-skills/commit-craft/scripts/check-commit.py
(or $COMMIT_CRAFT_CHECKER). The repos are the author's local checkouts;
edit REPOS to point at your own clones to measure your history.
"""
import argparse
import importlib.util
import json
import os
import subprocess
import sys

REPOS = {
    "sine-portfolio": "/home/hatch/workspace/sine-portfolio",
    "claude-skills": "/home/hatch/workspace/claude-skills",
    "retriever-doc-answer": "/home/hatch/workspace/retriever-doc-answer",
    "local-rag": "/home/hatch/workspace/local-rag",
    "jokeGPT": "/home/hatch/workspace/jokeGPT",
}

DEFAULT_CHECKER = os.path.expanduser(
    "~/workspace/claude-skills/commit-craft/scripts/check-commit.py")

SEP = "\x1f"
REC = "\x1e"


def load_checker(path):
    if not os.path.exists(path):
        print(f"checker not found: {path}\n"
              "Get the commit-craft skill (see the blog post) and pass "
              "--checker <path>/scripts/check-commit.py",
              file=sys.stderr)
        sys.exit(2)
    spec = importlib.util.spec_from_file_location("check_commit", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def git(repo, *args):
    out = subprocess.run(
        ["git", "-C", repo, *args],
        capture_output=True, text=True, check=True,
    )
    return out.stdout


def measure(repo_path, checker):
    fmt = f"%H{SEP}%an{SEP}%ad{SEP}%s{SEP}%b{REC}"
    raw = git(repo_path, "log", "--no-merges", "--since=2026-11-05",
              "--date=short", f"--pretty=format:{fmt}")
    commits = []
    for rec in raw.split(REC):
        rec = rec.strip("\n")
        if not rec.strip():
            continue
        parts = rec.split(SEP)
        if len(parts) < 5:
            continue
        sha, author, date, subject, body = parts[0], parts[1], parts[2], parts[3], parts[4]
        body_lines = [ln for ln in body.splitlines() if ln.strip()]
        stats = git(repo_path, "show", "--format=", "--numstat", sha)
        paths, insertions = [], 0
        for ln in stats.splitlines():
            if not ln.strip():
                continue
            added, _, path = ln.split("\t")
            paths.append(path)
            if added.isdigit():
                insertions += int(added)
        problems = checker.check_message(subject, body) \
            + checker.check_files(paths, insertions)
        commits.append({
            "sha": sha[:7], "author": author, "date": date,
            "subject": subject, "subject_len": len(subject),
            "body_lines": len(body_lines),
            "files": len(paths), "insertions": insertions,
            "checker_problems": [list(p) for p in problems],
            "body": body,
        })
    return commits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--checker", default=os.environ.get(
        "COMMIT_CRAFT_CHECKER", DEFAULT_CHECKER))
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    checker = load_checker(args.checker)

    all_commits = {}
    for name, path in REPOS.items():
        try:
            all_commits[name] = measure(path, checker)
        except subprocess.CalledProcessError as e:
            print(f"WARN {name}: {e}", file=sys.stderr)
            all_commits[name] = []

    flat = [c for cs in all_commits.values() for c in cs]
    n = len(flat)
    failing = [c for c in flat
               if any(p[1] == "fail" for p in c["checker_problems"])]
    warn_only = [c for c in flat
                 if c["checker_problems"] and c not in failing]
    total_files = sum(c["files"] for c in flat)
    total_ins = sum(c["insertions"] for c in flat)
    fail_files = sum(c["files"] for c in failing)
    fail_ins = sum(c["insertions"] for c in failing)

    def median(xs):
        # Conventional median: the middle value, or the mean of the two
        # middle values for an even count (132 subject lengths have
        # middle values 34 and 35, so the median is 34.5).
        xs = sorted(xs)
        n = len(xs)
        if n == 0:
            return 0
        if n % 2:
            return xs[n // 2]
        return (xs[n // 2 - 1] + xs[n // 2]) / 2

    summary = {
        "repos": {k: len(v) for k, v in all_commits.items()},
        "total_commits": n,
        "checker_fail": len(failing),
        "checker_warn_only": len(warn_only),
        "checker_clean": n - len(failing) - len(warn_only),
        "subjects_over_72": sum(1 for c in flat if c["subject_len"] > 72),
        "bodies_over_5_lines": sum(1 for c in flat if c["body_lines"] > 5),
        "r5_generated_file_commits": sum(
            1 for c in flat
            if any(p[0] == "R5" for p in c["checker_problems"])),
        "with_coauthor": sum(
            1 for c in flat
            if any(p[0] == "R3" for p in c["checker_problems"])),
        "median_subject_len": median(c["subject_len"] for c in flat),
        "max_subject_len": max((c["subject_len"] for c in flat), default=0),
        "median_body_lines": median(c["body_lines"] for c in flat),
        "max_body_lines": max((c["body_lines"] for c in flat), default=0),
        "median_files": median(c["files"] for c in flat),
        "max_files": max((c["files"] for c in flat), default=0),
        "commits_over_10_files": sum(1 for c in flat if c["files"] > 10),
        "failing_median_files": median(c["files"] for c in failing),
        "failing_median_subject": median(c["subject_len"] for c in failing),
        "clean_median_files": median(
            c["files"] for c in flat if c not in failing),
        "clean_median_subject": median(
            c["subject_len"] for c in flat if c not in failing),
        "failing_files": fail_files,
        "total_files": total_files,
        "failing_files_share": round(fail_files / total_files, 3)
        if total_files else 0,
        "failing_insertions": fail_ins,
        "total_insertions": total_ins,
        "failing_insertions_share": round(fail_ins / total_ins, 3)
        if total_ins else 0,
    }
    out = json.dumps({"summary": summary, "commits": flat}, indent=2)
    if args.out:
        open(args.out, "w").write(out + "\n")
    print(out)


if __name__ == "__main__":
    main()
