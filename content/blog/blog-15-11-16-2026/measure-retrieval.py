#!/usr/bin/env python3
"""Measure keyword retrieval (BM25, TF-IDF) on the sanoj.dev blog corpus.

Corpus: the 14 posts in content/blog/*.md of d-sanoj/sine-portfolio.
Grading is post-level: a chunk is correct if it comes from the gold post.
No stemming, no embedding model, stdlib + numpy only.
Run: python3 measure-retrieval.py  (from this directory)
Writes results.json next to the script.
"""
import json
import math
import re
import sys
from pathlib import Path

import numpy as np

BLOG = Path.home() / "workspace" / "sine-portfolio" / "content" / "blog"
HERE = Path(__file__).parent
# The post this experiment is published with must not be part of its own
# corpus: it quotes the questions and the results, so including it would
# change the measurement it reports. Exclude it by slug.
EXCLUDE = {"retriever-finds-the-document-not-the-answer"}

STOP = set("""a an the and or but if then else when at by for with about against
between into through during before after above below to from up down in out on off
over under again further once here there all any both each few more most other some
such no nor not only own same so than too very can will just should now is am are was
were be been being have has had having do does did doing would could ought i you he
she it we they me him her us them my your his its our their this that these those
of as what which who whom how why when where is it s t d ll m re ve don aren isn wasn
weren hasn haven hadn doesn didn won wouldn shan shouldn can couldn mustn needn""".split())

TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text):
    return [t for t in TOKEN_RE.findall(text.lower()) if t not in STOP]


def clean_markdown(md: str) -> str:
    # strip frontmatter
    if md.startswith("---"):
        end = md.find("\n---", 3)
        if end != -1:
            md = md[end + 4:]
    lines = []
    for line in md.splitlines():
        s = line.strip()
        if s.startswith("```"):
            continue
        if s.startswith("!["):
            continue
        if s.startswith(":::"):
            continue
        if s.startswith("|") and s.endswith("|"):
            # keep table content as plain words
            s = s.replace("|", " ")
        lines.append(s)
    text = " ".join(lines)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)  # links -> anchor text
    text = re.sub(r"[*_`#>]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def load_posts():
    posts = {}
    for path in sorted(BLOG.glob("*.md")):
        if path.stem in EXCLUDE:
            continue
        text = clean_markdown(path.read_text())
        title = path.stem
        posts[path.stem] = {"title": title, "text": text,
                            "words": len(text.split())}
    return posts


def chunk_words(words, size, overlap):
    step = max(1, size - overlap)
    chunks = []
    for i in range(0, len(words), step):
        c = words[i:i + size]
        if len(c) < 20 and chunks:
            break
        chunks.append(" ".join(c))
        if i + size >= len(words):
            break
    return chunks


def build_index(posts, size, title_prepend=False):
    """Returns list of chunks: {slug, text, tokens}."""
    chunks = []
    for slug, post in posts.items():
        words = post["text"].split()
        if size == 0:  # whole post
            texts = [post["text"]]
        else:
            texts = chunk_words(words, size, size // 5)
        for t in texts:
            full = (post["title"].replace("-", " ") + " " + t) if title_prepend else t
            chunks.append({"slug": slug, "text": t, "tokens": tokenize(full)})
    return chunks


class BM25:
    def __init__(self, chunks, k1=1.5, b=0.75):
        self.k1, self.b = k1, b
        self.n = len(chunks)
        self.docs = [c["tokens"] for c in chunks]
        self.lens = [len(d) for d in self.docs]
        self.avgdl = sum(self.lens) / max(1, self.n)
        df = {}
        for d in self.docs:
            for t in set(d):
                df[t] = df.get(t, 0) + 1
        self.idf = {t: math.log(1 + (self.n - f + 0.5) / (f + 0.5))
                    for t, f in df.items()}

    def scores(self, query_tokens):
        qtf = {}
        for t in query_tokens:
            qtf[t] = qtf.get(t, 0) + 1
        out = np.zeros(self.n)
        for t, _ in qtf.items():
            idf = self.idf.get(t)
            if idf is None:
                continue
            for i, d in enumerate(self.docs):
                f = d.count(t)
                if f:
                    denom = f + self.k1 * (1 - self.b + self.b * self.lens[i] / self.avgdl)
                    out[i] += idf * f * (self.k1 + 1) / denom
        return out


class TFIDF:
    def __init__(self, chunks):
        self.n = len(chunks)
        vocab = {}
        df = {}
        for c in chunks:
            for t in set(c["tokens"]):
                df[t] = df.get(t, 0) + 1
                if t not in vocab:
                    vocab[t] = len(vocab)
        self.vocab = vocab
        self.idf = np.array([math.log((self.n + 1) / (df[t] + 1)) + 1
                             for t in vocab])
        mat = np.zeros((self.n, len(vocab)))
        for i, c in enumerate(chunks):
            tf = {}
            for t in c["tokens"]:
                tf[t] = tf.get(t, 0) + 1
            for t, f in tf.items():
                mat[i, vocab[t]] = (1 + math.log(f)) * self.idf[vocab[t]]
        norms = np.linalg.norm(mat, axis=1, keepdims=True)
        self.mat = mat / np.where(norms == 0, 1, norms)

    def scores(self, query_tokens):
        q = np.zeros(len(self.vocab))
        for t in query_tokens:
            if t in self.vocab:
                q[self.vocab[t]] += 1
        n = np.linalg.norm(q)
        if n == 0:
            return np.zeros(self.n)
        return self.mat @ (q / n)


def rank(chunks, scorer, query):
    qt = tokenize(query)
    s = scorer.scores(qt)
    order = np.argsort(-s, kind="stable")
    return [(int(i), float(s[i])) for i in order]


def is_gold_chunk(chunk, q, min_terms=2):
    if chunk["slug"] != q["gold"]:
        return False
    text = chunk["text"].lower()
    hits = sum(1 for t in q.get("answer_terms", []) if t.lower() in text)
    return hits >= min_terms


def chunk_evaluate(chunks, scorer, questions, min_terms=2):
    """Chunk-level: did a chunk containing the answer reach the top k?"""
    ranks = []
    for q in questions:
        r = rank(chunks, scorer, q["q"])
        gold_rank = None
        for pos, (i, _) in enumerate(r, start=1):
            if is_gold_chunk(chunks[i], q, min_terms):
                gold_rank = pos
                break
        ranks.append(gold_rank)
    arr = np.array([r if r is not None else 10 ** 9 for r in ranks], dtype=float)
    out = {}
    for k in (1, 3, 5, 10):
        out[f"recall@{k}"] = float((arr <= k).mean())
    out["mrr"] = float((1.0 / np.where(arr > 10 ** 8, np.inf, arr)).mean())
    out["median_gold_rank"] = float(np.median(np.where(arr > 10 ** 8, np.nan, arr)))
    out["gold_ranks"] = [None if r > 10 ** 8 else int(r) for r in arr]
    out["missed_at_5"] = int((arr > 5).sum())
    out["never_found"] = int((arr > 10 ** 8).sum())
    return out


def evaluate(chunks, scorer, questions):
    ranks = []
    for q in questions:
        r = rank(chunks, scorer, q["q"])
        gold_rank = None
        for pos, (i, _) in enumerate(r, start=1):
            if chunks[i]["slug"] == q["gold"]:
                gold_rank = pos
                break
        ranks.append(gold_rank)
    ranks = np.array([r if r is not None else 10 ** 9 for r in ranks], dtype=float)
    out = {}
    for k in (1, 3, 5, 10):
        out[f"recall@{k}"] = float((ranks <= k).mean())
    out["mrr"] = float((1.0 / np.where(ranks > 10 ** 8, np.inf, ranks)).mean())
    out["median_gold_rank"] = float(np.median(np.where(ranks > 10 ** 8, np.nan, ranks)))
    out["gold_ranks"] = [None if r > 10 ** 8 else int(r) for r in ranks]
    out["missed_at_5"] = int((ranks > 5).sum())
    return out


def main():
    posts = load_posts()
    data = json.loads((HERE / "questions.json").read_text())
    questions = data["questions"]
    total_words = sum(p["words"] for p in posts.values())
    print(f"corpus: {len(posts)} posts, {total_words:,} words")

    results = {"corpus": {"posts": len(posts), "words": total_words,
                          "files": sorted(posts),
                          "generated": "2026-11-16",
                          "excluded": sorted(EXCLUDE)},
               "questions": len(questions), "experiments": {}}

    for size in (100, 200, 400, 800, 0):
        label = "whole-post" if size == 0 else f"{size}w"
        chunks = build_index(posts, size)
        print(f"\n== chunk size {label}: {len(chunks)} chunks ==")
        for name, scorer in (("bm25", BM25(chunks)), ("tfidf", TFIDF(chunks))):
            ev = evaluate(chunks, scorer, questions)
            results["experiments"][f"{name}@{label}"] = {
                "chunks": len(chunks), **{k: v for k, v in ev.items()}}
            print(f"  {name:6s} recall@1={ev['recall@1']:.2f} "
                  f"recall@3={ev['recall@3']:.2f} recall@5={ev['recall@5']:.2f} "
                  f"recall@10={ev['recall@10']:.2f} mrr={ev['mrr']:.3f} "
                  f"median_rank={ev['median_gold_rank']:.0f} missed@5={ev['missed_at_5']}")
        if size == 200:
            chunks_t = build_index(posts, size, title_prepend=True)
            ev = evaluate(chunks_t, BM25(chunks_t), questions)
            results["experiments"]["bm25+title@200w"] = {
                "chunks": len(chunks_t), **{k: v for k, v in ev.items()}}
            print(f"  bm25+title recall@1={ev['recall@1']:.2f} "
                  f"recall@5={ev['recall@5']:.2f} mrr={ev['mrr']:.3f} "
                  f"missed@5={ev['missed_at_5']}")

    # Chunk-level grading: does the chunk WITH the answer reach the top k?
    print("\n== chunk-level (gold chunk = from gold post + >=2 answer terms) ==")
    for size in (100, 200, 400):
        label = f"{size}w"
        chunks = build_index(posts, size)
        # sanity: every question must have at least one gold chunk
        zero = [q["id"] for q in questions
                if not any(is_gold_chunk(c, q) for c in chunks)]
        print(f"  {label}: questions with zero gold chunks: {zero or 'none'}")
        for name, scorer in (("bm25", BM25(chunks)), ("tfidf", TFIDF(chunks))):
            ev = chunk_evaluate(chunks, scorer, questions)
            results["experiments"][f"chunk-{name}@{label}"] = {
                "chunks": len(chunks), **{k: v for k, v in ev.items()}}
            print(f"  {name:6s}@{label} recall@1={ev['recall@1']:.2f} "
                  f"recall@3={ev['recall@3']:.2f} recall@5={ev['recall@5']:.2f} "
                  f"recall@10={ev['recall@10']:.2f} mrr={ev['mrr']:.3f} "
                  f"median_rank={ev['median_gold_rank']:.0f} missed@5={ev['missed_at_5']} "
                  f"never={ev['never_found']}")
    chunks_t = build_index(posts, 200, title_prepend=True)
    ev = chunk_evaluate(chunks_t, BM25(chunks_t), questions)
    results["experiments"]["chunk-bm25+title@200w"] = {
        "chunks": len(chunks_t), **{k: v for k, v in ev.items()}}
    print(f"  bm25+title@200w recall@1={ev['recall@1']:.2f} "
          f"recall@5={ev['recall@5']:.2f} mrr={ev['mrr']:.3f} "
          f"missed@5={ev['missed_at_5']} never={ev['never_found']}")
    # Loose gold definition (>=1 answer term): the generous reading.
    chunks = build_index(posts, 200)
    for label, mt in (("loose>=1", 1),):
        ev = chunk_evaluate(chunks, BM25(chunks), questions, min_terms=mt)
        results["experiments"][f"chunk-{label}-bm25@200w"] = {
            "chunks": len(chunks), **{k: v for k, v in ev.items()}}
        print(f"  {label} bm25@200w recall@1={ev['recall@1']:.2f} "
              f"recall@5={ev['recall@5']:.2f} mrr={ev['mrr']:.3f} "
              f"missed@5={ev['missed_at_5']}")
    # per-question chunk-level ranks for the headline run, for the post
    chunks = build_index(posts, 200)
    scorer = BM25(chunks)
    per_q = []
    for q in questions:
        r = rank(chunks, scorer, q["q"])
        post_rank = next((pos for pos, (i, _) in enumerate(r, start=1)
                          if chunks[i]["slug"] == q["gold"]), None)
        chunk_rank = next((pos for pos, (i, _) in enumerate(r, start=1)
                           if is_gold_chunk(chunks[i], q)), None)
        per_q.append({"id": q["id"], "gold": q["gold"],
                      "post_rank": post_rank, "answer_chunk_rank": chunk_rank})
    results["per_question_200w"] = per_q
    print("  per-question (post_rank -> answer_chunk_rank):")
    for row in per_q:
        print(f"    Q{row['id']:>2}: post rank {row['post_rank']} -> "
              f"answer chunk rank {row['answer_chunk_rank']}")

    # Rewording experiment: BM25 @ 200 words, original vs 2 variants
    chunks = build_index(posts, 200)
    scorer = BM25(chunks)
    rew = {"experiment": "rewording", "retriever": "bm25@200w", "items": []}
    print("\n== rewording (bm25@200w, recall@5) ==")
    for item in data["rewordings"]:
        q0 = next(q for q in questions if q["id"] == item["id"])
        rows = []
        for label, text in [("original", q0["q"])] + \
                [(f"variant{i+1}", v) for i, v in enumerate(item["variants"])]:
            r = rank(chunks, scorer, text)
            gold_rank = next((pos for pos, (i, _) in enumerate(r, start=1)
                              if chunks[i]["slug"] == q0["gold"]), None)
            chunk_rank = next((pos for pos, (i, _) in enumerate(r, start=1)
                               if is_gold_chunk(chunks[i], q0)), None)
            rows.append({"label": label, "text": text,
                         "gold_rank": gold_rank,
                         "answer_chunk_rank": chunk_rank,
                         "top5": [{"slug": chunks[i]["slug"], "score": round(s, 2),
                                   "preview": chunks[i]["text"][:110]}
                                  for i, s in r[:5]]})
        rew["items"].append({"id": item["id"], "gold": q0["gold"], "rows": rows})
        print(f"  Q{item['id']}: " + " | ".join(
            f"{row['label']} rank={row['gold_rank']}" for row in rows))
    results["rewording"] = rew

    # Top-5 dump for the headline run (BM25 @ 200w), for failure analysis
    dump = []
    for q in questions:
        r = rank(chunks, scorer, q["q"])
        gold_rank = next((pos for pos, (i, _) in enumerate(r, start=1)
                          if chunks[i]["slug"] == q["gold"]), None)
        dump.append({"id": q["id"], "q": q["q"], "gold": q["gold"],
                     "gold_rank": gold_rank,
                     "top5": [{"slug": chunks[i]["slug"], "score": round(s, 2),
                               "preview": chunks[i]["text"][:140]}
                              for i, s in r[:5]]})
    results["top5_bm25_200w"] = dump

    (HERE / "results.json").write_text(json.dumps(results, indent=2))
    print("\nwrote results.json")


if __name__ == "__main__":
    main()
