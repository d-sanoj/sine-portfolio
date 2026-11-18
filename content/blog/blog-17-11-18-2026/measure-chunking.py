#!/usr/bin/env python3
"""Measure structure-aware chunking against fixed windows on the sanoj.dev
blog corpus — the sequel to the 2026-11-16 retriever post, which recommended
"chunk by structure... carry the heading with the chunk" without measuring it.

Corpus: the 16 posts on main (blog-1 .. blog-16), excluding
blog-15-11-16-2026 (the retriever post quotes the golden questions) and
this post's own folder (it will quote them too). 22 questions: the 20 from
2026-11-16 plus 2 for the jokeGPT post. Same grading as measure-retrieval.py
(post-level and chunk-level strict recall@5, BM25 k1 1.5 b 0.75).

Chunkers:
  fixed200       fixed 200-word windows, 20% overlap (the 2026-11-16 baseline)
  fixed200+head  fixed 200-word windows, each carrying its section heading
  section        one chunk per markdown section (heading carried), long
                 sections split at sentence boundaries, max ~400 words
  para200        whole paragraphs accumulated to ~200 words, heading carried,
                 never split mid-paragraph

Run: python3 measure-chunking.py  (stdlib + numpy only)
Writes results.json next to the script.
"""
import json
import math
import re
from pathlib import Path

import numpy as np

BLOG = Path.home() / "workspace" / "sine-portfolio" / "content" / "blog"
HERE = Path(__file__).parent
EXCLUDE_FOLDERS = {"blog-15-11-16-2026", "blog-17-11-18-2026"}

STOP = set("""a an the and or but if then else when at by for with about against
between into through during before after above below to from up down in out on off
over under again further once here there all any both each few more most other some
such no nor not only own same so than too very can will just should now is am are was
were be been being have has had having do does did doing would could ought i you he
she it we they me him her us them my your his its our their this that these those
of as what which who whom how why when where is it s t d ll m re ve don aren isn wasn
weren hasn haven hadn doesn didn won wouldn shan shouldn can couldn mustn needn""".split())

TOKEN_RE = re.compile(r"[a-z0-9]+")
SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


def tokenize(text):
    return [t for t in TOKEN_RE.findall(text.lower()) if t not in STOP]


def strip_frontmatter(md: str) -> str:
    if md.startswith("---"):
        end = md.find("\n---", 3)
        if end != -1:
            return md[end + 4:]
    return md


def clean_text(text: str) -> str:
    text = strip_frontmatter(text)
    lines = []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("```"):
            continue
        if s.startswith("!["):
            continue
        if s.startswith(":::"):
            continue
        if s.startswith("|") and s.endswith("|"):
            s = s.replace("|", " ")
        lines.append(s)
    text = " ".join(lines)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[*_`#>]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def split_sections(md: str):
    """Return [(heading, body)] split on markdown headings. The first chunk
    (before any heading) gets the post title as its heading."""
    md = strip_frontmatter(md)
    sections = []
    heading, buf = None, []
    for line in md.splitlines():
        s = line.strip()
        if s.startswith("#"):
            if buf or heading is not None:
                sections.append((heading, "\n".join(buf)))
            heading = s.lstrip("#").strip()
            buf = []
        else:
            buf.append(line)
    sections.append((heading, "\n".join(buf)))
    return sections


def load_posts():
    posts = {}
    for path in sorted(BLOG.glob("blog-*/*.md")):
        if path.parent.name in EXCLUDE_FOLDERS:
            continue
        raw = path.read_text()
        posts[path.stem] = {"title": path.stem, "text": clean_text(raw),
                            "words": len(clean_text(raw).split()),
                            "sections": [(h, clean_text(b))
                                         for h, b in split_sections(raw)]}
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


def split_sentences(text, max_words):
    """Split text into chunks of at most max_words at sentence boundaries."""
    words = text.split()
    if len(words) <= max_words:
        return [text]
    out, cur = [], []
    for sent in SENT_SPLIT.split(text):
        sw = sent.split()
        if len(cur) + len(sw) > max_words and cur:
            out.append(" ".join(cur))
            cur = sw
        else:
            cur.extend(sw)
    if cur:
        out.append(" ".join(cur))
    return out


def build_index(posts, kind):
    """Returns list of chunks: {slug, text, tokens}."""
    chunks = []
    for slug, post in posts.items():
        title = post["title"].replace("-", " ")
        if kind == "fixed200":
            for t in chunk_words(post["text"].split(), 200, 40):
                chunks.append({"slug": slug, "text": t, "tokens": tokenize(t)})
        elif kind == "fixed400":
            for t in chunk_words(post["text"].split(), 400, 80):
                chunks.append({"slug": slug, "text": t, "tokens": tokenize(t)})
        elif kind == "fixed200+head":
            # map each word offset to its section heading
            sections = post["sections"]
            # rebuild word list with heading boundaries
            words, heads = [], []
            for h, body in sections:
                bw = body.split()
                words.extend(bw)
                heads.extend([h or title] * len(bw))
            for i in range(0, len(words), 160):
                c = words[i:i + 200]
                if len(c) < 20 and chunks and i > 0:
                    break
                head = heads[i] if i < len(heads) else title
                text = head + " — " + " ".join(c)
                chunks.append({"slug": slug, "text": text,
                               "tokens": tokenize(text)})
                if i + 200 >= len(words):
                    break
        elif kind == "section":
            for h, body in post["sections"]:
                head = h or title
                for piece in split_sentences(body, 400):
                    text = head + " — " + piece if piece else head
                    chunks.append({"slug": slug, "text": text,
                                   "tokens": tokenize(text)})
        elif kind == "para200":
            for h, body in post["sections"]:
                head = h or title
                # body is already cleaned to one line; split back into
                # sentences and accumulate ~200 words per chunk
                cur = []
                for sent in SENT_SPLIT.split(body):
                    sw = sent.split()
                    if len(cur) + len(sw) > 200 and cur:
                        text = head + " — " + " ".join(cur)
                        chunks.append({"slug": slug, "text": text,
                                       "tokens": tokenize(text)})
                        cur = sw
                    else:
                        cur.extend(sw)
                if cur:
                    text = head + " — " + " ".join(cur)
                    chunks.append({"slug": slug, "text": text,
                                   "tokens": tokenize(text)})
        else:
            raise ValueError(kind)
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


def rank(chunks, scorer, query):
    s = scorer.scores(tokenize(query))
    order = np.argsort(-s, kind="stable")
    return [(int(i), float(s[i])) for i in order]


def is_gold_chunk(chunk, q, min_terms=2):
    if chunk["slug"] != q["gold"]:
        return False
    text = chunk["text"].lower()
    hits = sum(1 for t in q.get("answer_terms", []) if t.lower() in text)
    return hits >= min_terms


def evaluate_ranks(ranks_list, chunks, questions, gold_fn):
    ranks = []
    for q, r in zip(questions, ranks_list):
        gold_rank = None
        for pos, i in enumerate(r, start=1):
            if gold_fn(chunks[i], q):
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


def main():
    posts = load_posts()
    data = json.loads((HERE / "questions.json").read_text())
    questions = data["questions"]
    total_words = sum(p["words"] for p in posts.values())
    print(f"corpus: {len(posts)} posts, {total_words:,} words, "
          f"{len(questions)} questions")
    print(f"excluded folders: {sorted(EXCLUDE_FOLDERS)}")

    results = {"corpus": {"posts": len(posts), "words": total_words,
                          "files": sorted(posts),
                          "generated": "2026-11-18",
                          "excluded_folders": sorted(EXCLUDE_FOLDERS)},
               "questions": len(questions), "experiments": {}}

    per_q = {}
    for kind in ("fixed200", "fixed400", "fixed200+head", "section", "para200"):
        chunks = build_index(posts, kind)
        sizes = [len(c["text"].split()) for c in chunks]
        print(f"\n== {kind}: {len(chunks)} chunks, "
              f"median {int(np.median(sizes))} words, "
              f"max {max(sizes)} words ==")
        zero = [q["id"] for q in questions
                if not any(is_gold_chunk(c, q) for c in chunks)]
        print(f"  questions with zero gold chunks: {zero or 'none'}")
        scorer = BM25(chunks)
        ranks_list = [[i for i, _ in rank(chunks, scorer, q["q"])]
                      for q in questions]
        for level, fn, prefix in (("post", lambda c, q: c["slug"] == q["gold"], ""),
                                  ("chunk", is_gold_chunk, "chunk-")):
            ev = evaluate_ranks(ranks_list, chunks, questions, fn)
            key = f"{prefix}bm25@{kind}"
            results["experiments"][key] = {
                "chunks": len(chunks),
                "median_chunk_words": int(np.median(sizes)),
                **{k: v for k, v in ev.items()}}
            print(f"  {key:26s} recall@1={ev['recall@1']:.2f} "
                  f"recall@5={ev['recall@5']:.2f} mrr={ev['mrr']:.3f} "
                  f"median_rank={ev['median_gold_rank']:.0f} "
                  f"missed@5={ev['missed_at_5']} never={ev['never_found']}")
        per_q[kind] = []
        for qi, q in enumerate(questions):
            def at(ranks):
                return next((pos for pos, i in enumerate(ranks, start=1)
                             if is_gold_chunk(chunks[i], q)), None)
            post_rank = next((pos for pos, i in enumerate(ranks_list[qi], start=1)
                              if chunks[i]["slug"] == q["gold"]), None)
            per_q[kind].append({"id": q["id"], "gold": q["gold"],
                                "post_rank": post_rank,
                                "answer_chunk_rank": at(ranks_list[qi])})
    results["per_question"] = per_q

    # Rewording: fixed200 vs section, same 6 items
    rew = {"experiment": "rewording", "items": []}
    print("\n== rewording (answer-chunk rank) ==")
    idx = {k: build_index(posts, k) for k in ("fixed200", "section")}
    sco = {k: BM25(v) for k, v in idx.items()}
    for item in data["rewordings"]:
        q0 = next(q for q in questions if q["id"] == item["id"])
        rows = []
        for label, text in [("original", q0["q"])] + \
                [(f"variant{i+1}", v) for i, v in enumerate(item["variants"])]:
            row = {"label": label, "text": text}
            for k in ("fixed200", "section"):
                r = rank(idx[k], sco[k], text)
                row[k] = next((pos for pos, (i, _) in enumerate(r, start=1)
                               if is_gold_chunk(idx[k][i], q0)), None)
            rows.append(row)
        rew["items"].append({"id": item["id"], "gold": q0["gold"], "rows": rows})
        print(f"  Q{item['id']}: " + " | ".join(
            f"{row['label']} fixed200={row['fixed200']} section={row['section']}"
            for row in rows))
    results["rewording"] = rew

    # Top-5 dump for the headline run (section), for failure analysis
    chunks = build_index(posts, "section")
    scorer = BM25(chunks)
    dump = []
    for q in questions:
        r = rank(chunks, scorer, q["q"])
        dump.append({"id": q["id"], "q": q["q"], "gold": q["gold"],
                     "top5": [{"slug": chunks[i]["slug"], "score": round(s, 2),
                               "preview": chunks[i]["text"][:140]}
                              for i, s in r[:5]]})
    results["top5_bm25_section"] = dump

    (HERE / "results-chunking.json").write_text(json.dumps(results, indent=2))
    print("\nwrote results-chunking.json")


if __name__ == "__main__":
    main()
