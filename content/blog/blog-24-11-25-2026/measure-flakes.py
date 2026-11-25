#!/usr/bin/env python3
"""Measure flakiness in the flake-hunt fixture suite.

Runs the fixture suite (examples/fixture in the flake-hunt skill)
many times and reports, per test, how often it failed -- plus the
detection math: for a test that fails with probability p, the chance
that N runs catch it is 1 - (1 - p) ** N.

Usage:
    python3 measure-flakes.py [--runs 100] [--fixture PATH] [--out PATH]

Requires pytest importable by the Python running this script
(e.g. run it with the venv python of a repo that has pytest).
Writes flake-rates.json next to the script unless --out is given.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RESULT_RE = re.compile(r"^(\S+::\S+) (PASSED|FAILED|ERROR|SKIPPED)")


def run_pytest(pytest_args, cwd):
    """Run pytest -v once; return {nodeid: 'PASSED'|'FAILED'|...}."""
    cmd = [sys.executable, "-m", "pytest", "-v", "--tb=no",
           "-p", "no:cacheprovider"] + pytest_args
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True,
                          timeout=300)
    results = {}
    for line in proc.stdout.splitlines():
        m = RESULT_RE.match(line.strip())
        if m:
            results[m.group(1)] = m.group(2)
    if not results:
        raise RuntimeError(
            "no test results parsed from pytest output:\n"
            + proc.stdout[-2000:] + "\n" + proc.stderr[-2000:])
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=100)
    ap.add_argument("--fixture", default=None,
                    help="path to the fixture dir (default: skill examples/fixture)")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    fixture = Path(args.fixture) if args.fixture else None
    if fixture is None:
        # Default: the skill repo next to this workspace.
        fixture = Path.home() / "workspace" / "claude-skills" / "flake-hunt" / "examples" / "fixture"
    fixture = fixture.resolve()
    assert (fixture / "tests").is_dir(), f"no tests/ under {fixture}"

    out_path = Path(args.out) if args.out else HERE / "flake-rates.json"

    # 1. N full-suite runs: per-test fail counts.
    per_test = {}
    first_run = None
    for i in range(args.runs):
        res = run_pytest(["tests"], cwd=fixture)
        if i == 0:
            first_run = res
        for nodeid, outcome in res.items():
            per_test.setdefault(nodeid, {"passed": 0, "failed": 0})
            per_test[nodeid]["passed" if outcome == "PASSED" else "failed"] += 1

    # 2. Isolation: each flaky test alone, 10x.
    flaky = [n for n, c in per_test.items()
             if c["failed"] > 0 and c["passed"] > 0 or c["failed"] == args.runs]
    isolation = {}
    for nodeid in sorted(flaky):
        alone = {"passed": 0, "failed": 0}
        for _ in range(10):
            res = run_pytest([nodeid], cwd=fixture)
            outcome = res.get(nodeid, "MISSING")
            alone["passed" if outcome == "PASSED" else "failed"] += 1
        isolation[nodeid] = alone

    # 3. Control: stable tests only, 50x.
    control = {"passed": 0, "failed": 0}
    for _ in range(50):
        res = run_pytest(["tests/test_stable.py"], cwd=fixture)
        for outcome in res.values():
            control["passed" if outcome == "PASSED" else "failed"] += 1

    # 4. Detection math: P(catch a p-flake in N runs) = 1 - (1 - p) ** N.
    table = {}
    for p in (0.01, 0.05, 0.10, 0.25):
        table[str(p)] = {str(n): round(1 - (1 - p) ** n, 4)
                         for n in (1, 5, 10, 20, 50)}

    data = {
        "fixture": str(fixture),
        "suite_runs": args.runs,
        "first_run_outcome": first_run,
        "per_test": {
            n: {"passed": c["passed"], "failed": c["failed"],
                "fail_rate": round(c["failed"] / args.runs, 3)}
            for n, c in sorted(per_test.items())
        },
        "flaky_in_suite": sorted(flaky),
        "isolation_10x_alone": isolation,
        "control_stable_only_50_runs": control,
        "detection_probability": table,
    }
    out_path.write_text(json.dumps(data, indent=2) + "\n")
    print(json.dumps(data, indent=2))
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
