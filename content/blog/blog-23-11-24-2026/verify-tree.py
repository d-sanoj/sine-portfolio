#!/usr/bin/env python3
"""Verify the numbers in 'Searching tree crashed the whole page'
(blog-23-11-24-2026).

Reproduces, against the EpigCorpus corpus
(data/processed/edcs_inscriptions_cleaned.jsonl.gz, 588,509 records):

- the old substring behaviour for 'tree': 1 inscription, 1 place
  (Matree, EDCS-29900632, Budapest / Aquincum) in Raw and Conservative,
  2 in Interpretive (Matree and patreEm);
- the fixed whole-word behaviour: 'tree' and 'TREE' match 0 rows in
  all three modes, while 'matree' (1 row, 1 place) and 'popidium'
  (154 rows, 1 place) still match and render;
- the contrast: 'tre' matches 3,599 rows and renders fine, 'viator'
  379 rows / 213 places and 'vixit' 24,724 rows / 2,092 places
  (Conservative) render fine.

Run from the EpigCorpus repo root:
    python3 verify-tree.py [--corpus data/processed/edcs_inscriptions_cleaned.jsonl.gz]
It imports the real search code (backend/src/epigcorpus/core/search.py)
and writes results.json next to this script.
"""
import argparse
import gzip
import json
import re
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", default=None,
                    help="path to edcs_inscriptions_cleaned.jsonl.gz")
    ap.add_argument("--repo", default=None,
                    help="EpigCorpus repo root (default: auto-detect)")
    args = ap.parse_args()

    repo = Path(args.repo) if args.repo else None
    if repo is None:
        for cand in [HERE, HERE.parent, HERE.parent.parent,
                     Path.home() / "workspace" / "EpigCorpus"]:
            if (cand / "backend" / "src" / "epigcorpus" / "core" / "search.py").exists():
                repo = cand
                break
    if repo is None:
        print("could not find the EpigCorpus repo; pass --repo", file=sys.stderr)
        return 2
    sys.path.insert(0, str(repo / "backend" / "src"))
    from epigcorpus.core.search import (  # noqa: E402
        SEARCH_COLUMNS, aggregate_places, filter_inscriptions)

    corpus = Path(args.corpus) if args.corpus else (
        repo / "data" / "processed" / "edcs_inscriptions_cleaned.jsonl.gz")
    rows = []
    with gzip.open(corpus, "rt", encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))
    df = pd.DataFrame(rows)
    out: dict = {"corpus_rows": len(df), "modes": {}, "contrasts": {}}

    for label, col in SEARCH_COLUMNS.items():
        text = df[col].fillna("").astype(str)
        old = df[text.str.contains("tree", case=False, na=False, regex=False)]
        fixed = filter_inscriptions(df, col, "tree")
        fixed_upper = filter_inscriptions(df, col, "TREE")
        mode = {
            "old_substring_tree_rows": int(len(old)),
            "old_substring_tree_places": sorted(old["place"].dropna().unique().tolist()),
            "fixed_whole_word_tree_rows": int(len(fixed)),
            "fixed_whole_word_TREE_rows": int(len(fixed_upper)),
        }
        if len(old):
            agg = aggregate_places(old)
            mode["old_substring_tree_aggregate"] = agg.to_dict("records")
            mode["old_substring_tree_match"] = [
                {"edcs_id": r["edcs_id"], "place": r["place"],
                 "province": r["province"], "text": r[col]}
                for _, r in old.iterrows()
            ]
        out["modes"][label] = mode

    cons = "inscription_text_conservative"
    text = df[cons].fillna("").astype(str)
    tre = df[text.str.contains("tre", case=False, na=False, regex=False)]
    out["contrasts"]["tre_substring_rows_conservative"] = int(len(tre))
    for term in ("matree", "popidium", "viator", "vixit"):
        m = filter_inscriptions(df, cons, term)
        out["contrasts"][term] = {
            "rows": int(len(m)),
            "places": int(len(aggregate_places(m))),
        }

    (HERE / "results.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
