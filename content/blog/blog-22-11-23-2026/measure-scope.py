#!/usr/bin/env python3
"""Measure scope creep in my own agent's pull requests.

Corpus: every merged PR across my five agent-built repos, Nov 15-22 2026
(25 PRs). File lists come from the GitHub API (paginated, so the
140-file restructure PR is complete). Classification is in
scope-manifest.json, judged by hand from the request and the diff:

  a file is OUT if it was not needed to do what I asked;
  files needed as a side effect of the requested change
  (a shared launcher, a test update, the README list entry
  for a new skill) count as IN.

Strata: "broad" PRs asked for a whole new thing (scope was
everything by construction); "narrow" PRs asked for one fix,
one post, one skill, or one experiment, where "out of scope"
is a meaningful verdict.

Caveat, stated in the post: this counts merged diffs only.
Edits the agent made and reverted mid-session leave no trace,
so the count is a floor, not the full story.
"""
import json
import subprocess

HERE = __file__.rsplit("/", 1)[0]

CORPUS = [
    # repo, pr, title, stratum
    ("sine-portfolio", 22, "Blog: Your agent's code looks nothing like yours", "narrow"),
    ("sine-portfolio", 23, "Blog: Your retriever finds the right document", "narrow"),
    ("sine-portfolio", 24, "Build: wait for Chrome to exit before deleting its profile dir", "narrow"),
    ("sine-portfolio", 25, "Blog: I trained a tiny GPT to tell jokes", "narrow"),
    ("sine-portfolio", 27, "Blog: one folder per post as blog-N-MM-DD-YYYY", "broad"),
    ("sine-portfolio", 28, "Add GitHub Actions CI workflow", "narrow"),
    ("sine-portfolio", 29, "CI: fix flaky Chrome debugging-port failure", "narrow"),
    ("sine-portfolio", 30, "Blog: I chunked my blog by section", "narrow"),
    ("sine-portfolio", 31, "README: hero GIF, screenshots, make-it-yours guide", "narrow"),
    ("sine-portfolio", 32, "Blog: I measured 132 of my agent's commits", "narrow"),
    ("sine-portfolio", 33, "Blog: Embeddings beat BM25 on my blog", "narrow"),
    ("sine-portfolio", 34, "Sine page: invisible anchors over the sine links", "narrow"),
    ("sine-portfolio", 35, "Blog: Your agent fixes the wrong line of the log", "narrow"),
    ("sine-portfolio", 36, "Blog: How many sine waves does a letter need?", "narrow"),
    ("retriever-doc-answer", 1, "Build retriever-doc-answer as a FastAPI service (MVC)", "broad"),
    ("retriever-doc-answer", 2, "Add section chunking experiment (91% recall@5)", "narrow"),
    ("retriever-doc-answer", 3, "Experiment: embeddings vs BM25 on the blog corpus", "narrow"),
    ("local-rag", 1, "Local RAG: enterprise FastAPI service", "broad"),
    ("local-rag", 3, "Add CI pipeline, example data, and Streamlit GUI", "narrow"),
    ("jokeGPT", 1, "jokeGPT: tiny character-level GPT trained on 15k jokes", "broad"),
    ("jokeGPT", 2, "jokeGPT upgrade: word-level tokens, bigger vocab + data, bigger model", "narrow"),
    ("claude-skills", 5, "Skill: convention-check", "narrow"),
    ("claude-skills", 6, "Skill: output-eval", "narrow"),
    ("claude-skills", 7, "Skill: commit-craft", "narrow"),
    ("claude-skills", 8, "Skill: add log-triage", "narrow"),
]


def pr_files(repo, n):
    out = subprocess.run(
        ["gh", "api", f"repos/d-sanoj/{repo}/pulls/{n}/files",
         "--paginate", "--jq", ".[].filename"],
        capture_output=True, text=True, check=True)
    return sorted(f for f in out.stdout.splitlines() if f.strip())


def main():
    with open(f"{HERE}/scope-manifest.json") as f:
        manifest = json.load(f)
    rows = []
    for repo, n, title, stratum in CORPUS:
        files = pr_files(repo, n)
        key = f"{repo}#{n}"
        m = manifest.get(key, {})
        out_files = sorted(set(m.get("out", [])) & set(files))
        assert set(m.get("out", [])) <= set(files), f"{key}: manifest lists a file not in the PR"
        rows.append({
            "repo": repo, "pr": n, "title": title, "stratum": stratum,
            "files": len(files), "out": len(out_files), "out_files": out_files,
            "note": m.get("note", ""),
        })
    total_files = sum(r["files"] for r in rows)
    total_out = sum(r["out"] for r in rows)
    narrow = [r for r in rows if r["stratum"] == "narrow"]
    broad = [r for r in rows if r["stratum"] == "broad"]
    results = {
        "window": "2026-11-15 to 2026-11-22",
        "prs": len(rows),
        "files": total_files,
        "out_files": total_out,
        "prs_with_out": sum(1 for r in rows if r["out"]),
        "narrow": {
            "prs": len(narrow), "files": sum(r["files"] for r in narrow),
            "out_files": sum(r["out"] for r in narrow),
            "prs_with_out": sum(1 for r in narrow if r["out"]),
        },
        "broad": {
            "prs": len(broad), "files": sum(r["files"] for r in broad),
            "out_files": sum(r["out"] for r in broad),
            "prs_with_out": sum(1 for r in broad if r["out"]),
        },
        "caveat": "Merged diffs only. Edits made and reverted mid-session leave no trace, so this is a floor.",
        "rows": rows,
    }
    with open(f"{HERE}/results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"PRs: {len(rows)}  files: {total_files}  out-of-scope files: {total_out}")
    print(f"narrow: {len(narrow)} PRs, {results['narrow']['files']} files, "
          f"{results['narrow']['out_files']} out, in {results['narrow']['prs_with_out']} PRs")
    print(f"broad: {len(broad)} PRs, {results['broad']['files']} files, "
          f"{results['broad']['out_files']} out")
    for r in rows:
        if r["out"]:
            print(f"  OUT {r['repo']}#{r['pr']}: {r['out_files']}")
    print("wrote results.json")


if __name__ == "__main__":
    main()
