#!/usr/bin/env python3
"""measure-logs.py — score four ways of reading a failing log.

Methods (each surfaces text; it "names the cause" only if that text
contains every ground-truth substring for the log):
  tail      read the last 20 lines, take the last line matching error|fail
  grep-first  first line in the log containing "error"
  grep-last   last line in the log containing "error"
  triage    triage-log.py's verdict (cause line + file:line)

Ground truth comes from corpus-manifest.json: the root cause as
established by the fix that actually resolved each failure.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TRIAGE = HERE / "triage-log.py"


def tail20(lines: list[str]) -> str:
    tail = lines[-20:]
    for line in reversed(tail):
        if re.search(r"error|fail", line, re.IGNORECASE):
            return line.strip()
    for line in reversed(tail):
        if line.strip():
            return line.strip()
    return ""


def grep_first(lines: list[str]) -> str:
    for line in lines:
        if "error" in line.lower():
            return line.strip()
    return ""


def grep_last(lines: list[str]) -> str:
    for line in reversed(lines):
        if "error" in line.lower():
            return line.strip()
    return ""


def triage(lines: list[str], path: Path) -> str:
    out = subprocess.run(
        [sys.executable, str(TRIAGE), str(path), "--json"],
        capture_output=True, text=True, check=True,
    )
    finding = json.loads(out.stdout)
    parts = [finding["cause"]]
    if finding.get("file_line"):
        parts.append(finding["file_line"])
    return " | ".join(parts)


def main() -> int:
    manifest = json.loads((HERE / "corpus-manifest.json").read_text())
    methods = {
        "tail": tail20,
        "grep-first": grep_first,
        "grep-last": grep_last,
    }
    rows = []
    scores: dict[str, list[bool]] = {name: [] for name in
                                     list(methods) + ["triage"]}
    for entry in manifest["logs"]:
        path = HERE / entry["file"]
        lines = path.read_text(errors="replace").splitlines()
        truth = entry["ground_truth"]
        row = {"log": entry["file"], "cause": entry["cause"],
               "class_true": entry["class"], "results": {}}
        for name, fn in methods.items():
            surfaced = fn(lines)
            ok = all(t in surfaced for t in truth)
            scores[name].append(ok)
            row["results"][name] = {"ok": ok, "surfaced": surfaced}
        surfaced = triage(lines, path)
        ok = all(t in surfaced for t in truth)
        scores["triage"].append(ok)
        row["results"]["triage"] = {"ok": ok, "surfaced": surfaced}
        rows.append(row)

    summary = {
        name: {"correct": sum(v), "total": len(v),
               "pct": round(100 * sum(v) / len(v))}
        for name, v in scores.items()
    }
    result = {"summary": summary, "logs": rows}
    (HERE / "results.json").write_text(json.dumps(result, indent=2) + "\n")
    for name, s in summary.items():
        print(f"{name:10s} {s['correct']}/{s['total']} ({s['pct']}%)")
    for row in rows:
        marks = " ".join(
            f"{m}={'Y' if row['results'][m]['ok'] else 'n'}"
            for m in ["tail", "grep-first", "grep-last", "triage"]
        )
        print(f"  {row['log']:32s} {marks}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
