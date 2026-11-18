---
title: "I chunked my blog by section. Retrieval jumped from 73% to 91%."
slug: chunk-by-section-not-by-word-count
date: 2026-11-18
description: "I told you to chunk by structure without measuring it — now I have: section chunks lift the answering passage into the top five 91% of the time, up from 73%, matching the 400-word windows at about 60% of their words."
tags: [rag, retrieval, chunking, measurement, bm25]
cover: img/cover.png
coverAlt: "Title card reading 'I chunked my blog by section. Retrieval jumped from 73% to 91%.' Below it, two bars: 'fixed 200-word windows' at 73% in yellow, and 'section chunks' at 91% in green."
---

![Title card reading "I chunked my blog by section. Retrieval jumped from 73% to 91%." Below it, two bars: "fixed 200-word windows" at 73% in yellow, and "section chunks" at 91% in green.](img/cover.png)

Two days ago I wrote that if you change one thing about your retriever, change the chunk size — and that if your documents have natural boundaries, you should cut there instead of every N words and carry the heading with the chunk. That second half was advice I had not measured. I had measured four fixed window sizes. I had not measured a single structure-aware chunker. This post fixes that, because advice you haven't tested is just a preference with confidence.

Same setup as last time, extended by two days. The corpus is now fifteen posts — 41,375 words — and twenty-two questions: the same twenty, plus two about the jokeGPT post that landed yesterday. The retriever is the same BM25, same parameters (k1 1.5, b 0.75), no stemming, same small stopword list. The grading is the same two levels: post-level, did the right document make the top five, and chunk-level, did the chunk that actually contains the answer make the top five. A chunk counts as the answer only if it comes from the right post and contains at least two of the answer's key terms. The two posts that quote the questions — the retriever post itself and this one — are excluded from the corpus, so the questions can't leak into the documents. Frontmatter is stripped before chunking, so titles and descriptions can't leak in either — I caught that one mid-run, when a 400-word chunk opened with a post's frontmatter and ranked on its description's words.

Five chunkers, one corpus, one set of questions:

- **Fixed 200 words** — the baseline from last time: 200-word windows, 20% overlap.
- **Fixed 400 words** — the same, twice as big. Last time's winner.
- **Fixed 200 words + heading** — the same 200-word windows, each carrying the heading of the section it was cut from.
- **Section** — one chunk per markdown section, heading carried, long sections split at sentence boundaries with a 400-word cap.
- **Paragraph 200 words** — whole paragraphs accumulated to about 200 words, heading carried, never split mid-paragraph.

# The result: structure beats size, almost

Chunk-level strict recall@5 — the answering passage in the top five:

| Chunker | Chunks | Median words | Top-5 words | Recall@5 | Recall@1 | MRR |
|---|---|---|---|---|---|---|
| Fixed 200 words | 263 | 200 | ~1,000 | 73% (16/22) | 55% | 0.633 |
| Fixed 400 words | 132 | 400 | ~2,000 | 91% (20/22) | 64% | 0.769 |
| Fixed 200 + heading | 256 | 206 | ~1,030 | 77% (17/22) | 45% | 0.590 |
| **Section** | 170 | 236 | ~1,180 | **91% (20/22)** | 50% | 0.651 |
| Paragraph 200 words | 271 | 182 | ~910 | 73% (16/22) | 50% | 0.593 |

Post-level recall@5 is 100% — 22 of 22 — for four of the five chunkers. Fixed 200-word windows miss one document: the million-token question, whose post sits at rank 15. That is why I keep saying the document-level number is the wrong number to run your system on. Every chunker finds the document, almost always. The passage is the hard part.

Section chunking fixes five questions and breaks one, net plus four — and lands exactly where the 400-word windows land: 91%. The 400-word windows rank the answers higher on average (MRR 0.769 against 0.651) and get the learning question that sections miss, but they miss the nerf-watch question that sections nail at rank 1. Neither dominates. The difference between them is cost: sections hand the model about 1,180 words in the top five against about 2,000 for the 400-word windows. Same recall, about 60% of the prompt. That is the headline, and the rest of the post is the mechanism behind it.

![Grouped bars of chunk-level recall at the top 5, BM25, for five chunkers. Fixed 200 words: 73%. Fixed 400 words: 91%. Fixed 200 words plus heading: 77%. Section: 91%. Paragraph 200 words: 73%. A second annotation shows the words in the top five: about 1,000, 2,000, 1,030, 1,180, and 910.](img/results.png)

# The orphan problem: what fixed windows do to a section

The biggest single fix is the question about telling whether your model got worse after an update — the one whose answer is the frozen regression suite, nerf-watch. Under fixed 200-word windows, the chunk with the answer sat at rank 12. Under section chunks, it is rank 1. Nothing about the retriever changed. The chunk changed.

Here is what happened. The fixed window that holds the answer reads: "frozen regression suite for your coding agent, nerf-watch, so the next time your model feels dumber, you can check a number instead of a vibe." It names the answer. But the question doesn't use the name — it asks in plain words: "How can I tell if my model got worse after an update? Is there a way to measure it?" The fragment shares three words with that question — model, way, worse — and two of the three are borrowed from quotes: "way" from a quoted Reddit thread title ("Opus 5.5 feels way dumber after today's outage"), "worse" from a quoted complaint ("it writes worse code"). Only "model" is in the post's own voice. No "tell", no "measure", no "update". It answers in jargon — "frozen regression suite", "check a number instead of a vibe" — and the question is asked in the vocabulary of someone who doesn't know the jargon yet. Eleven other chunks rank ahead of it.

The section chunk holds the same answer, and it holds the bridge to it. Its heading is "What a drop means, and what it doesn't", and the section opens "Be honest about what eight tasks can and cannot tell you" — there is "tell", right at the top — and goes on: "It can tell you your agent got worse at your kind of work… It measures the whole stack — model, CLI version, system prompt, effort level — together." Five of the question's seven words appear in the section, tell and measure three times each, in the post's own voice. The section contains both vocabularies: the plain words the question uses and the jargon the answer uses. The fragment contains mostly the jargon. A chunk that shares three of the question's words, two of them borrowed from quotes, loses to a chunk that shares five, in its own voice.

![Two ways of cutting the same section about measuring model regressions. Left: a fixed 200-word window holding the answer — it names nerf-watch, but shares only three of the question's words, two of them inside a quote — which ranks 12th. Right: the whole section with its heading carried, holding both the question's plain words and the answer's jargon — which ranks 1st.](img/orphans.png)

![Animation of the same question under two chunkers. First, the fixed 200-word top five — the answer chunk is nowhere in it. Then the orphan chunk itself, naming nerf-watch but sharing one word with the question, at rank 12. Then the section top five, with the answer chunk at rank 1.](img/ranks-q6.gif){poster=img/ranks-q6-poster.png}

*Still frame: the same question, the same retriever — the answer chunk goes from rank 12 to rank 1 when only the chunking changes.*

The same fix, smaller, shows up in four more questions. "What should I do if my model's performance drops and the vendor says nothing changed?" goes from rank 22 to rank 2. "What does it mean to edit a model's weights directly, without retraining?" goes from 9 to 4. "How do I know if the tokenizer is charging me extra for non-English text?" goes from 8 to 4. "How many tokens does a sentence cost in different languages?" goes from 6 to 3. In each case the answering passage is a coherent section — a how-to, an experiment description, a worked example — and the fixed window had cut it in half, leaving the definition in one chunk and the name in another. A chunk that cannot say what it is about, in the words the question uses, will not be found by a question that asks about it. That was the sentence I wrote last time without having measured it. Now it has numbers behind it.

# The null results are the finding

Two of the five chunkers exist to tell me which part of "chunk by structure" actually matters, and they both came back flat.

**Paragraph boundaries do nothing.** Accumulating whole paragraphs to 200 words, heading carried, scores exactly the same as fixed 200-word windows: 73% — but not on the same questions. It fixes Q19 and Q20 and breaks Q10 and Q18 instead, so the headline is identical and the misses just move. MRR 0.593 against 0.633. Respecting paragraph boundaries feels like the careful, correct thing to do. It buys nothing on this corpus, because paragraphs in these posts are short and a 200-word window already lands on paragraph boundaries most of the time. The failure was never "split mid-paragraph". It was "split mid-section".

**The heading alone is worth four points, not eighteen.** Fixed 200-word windows with the section heading prepended go from 73% to 77% — one more question found. That is the cheap version of contextual retrieval I measured last time with the post title, which also moved nothing at the chunk level. A heading helps the retriever pick the document, and it helps a little at the passage level, but a heading on an orphan chunk is still an orphan chunk. The gain comes from keeping the whole section together, not from labelling the pieces.

So the mechanism is specific: the unit that matters is the section — a complete argument with its heading — not the paragraph and not the heading alone. Section chunks are bigger than 200-word windows (median 236 words, up to 408) but the size alone is not the story either, because fixed 400-word windows are bigger still and only tie sections on recall@5, while ranking the answers higher on average.

# What structure breaks: the answer that smears across a post

Section chunking breaks one question, and it is worth understanding because it is three failures at once, and only one of them is chunking.

"How does a language model actually learn from data — what's happening during training?" The answer needs three terms: gradient, loss, and learning rate. Under fixed 200-word windows the answering chunk is rank 4; under fixed 400-word windows it is rank 2; under section chunks it is rank 14 — a miss.

The first failure is not chunking at all. There is no stemming in this setup — the tokenizer splits on letters and matches exactly — so the question's key verb, "learn", never matches "learned" or "learning". The token "learn" appears in four of the 170 section chunks, and once in the post that explains learning — in the Sources section, in a link title. The post itself says "learning" twenty-four times and "learned" once. The question's most distinctive word matches almost nothing, so the ranking is decided by the generic words — model, training, data — which match training discussions everywhere.

The second failure is that the answer is smeared. Gradient, loss, and learning rate co-occur in four different sections of the learning post, so there is no single answer section for the ranker to find. The first gold chunk it finds is "Why mini-batches exist" — 216 words about computing the gradient of the average loss — at rank 14. The intro section, which holds all three terms, sits at rank 21. The section boundary didn't split the answer in two; the answer was never in one place.

The third failure is a near-duplicate competitor. The jokeGPT post is also about training a model, and its "What would actually fix it" chunk — about stopping a training run — outranks every section of the learning post. The question is generic enough that a post about training a joke model answers it, in BM25's eyes, better than the post about learning does.

The fixed 400-word window wins by pooling: its first 400 words contain the intro plus the next section, so the question's scattered matches — model, training, data, actually — land in one chunk, and it ranks 2nd. Sections keep those matches apart, and each section alone is too weak to win.

![Animation of the learning question under section chunking. First, the stemming gap: the question asks about 'learn', the post says 'learned' and 'learning' — the exact token 'learn' appears in 4 of 170 chunks. Second, the ranked list: the jokeGPT chunk ranks 1st, two non-answer sections of the learning post rank 2nd and 4th, the answer section 'Why mini-batches exist' ranks 14th, and the intro holding all three answer terms ranks 21st. Third, the fixed 400-word window pools the intro and the next section into one chunk, and the answer ranks 2nd.](img/split-answer.gif){poster=img/split-answer-poster.png}

*Still frame: the answer section 'Why mini-batches exist' at rank 14, below two non-answer sections of the same post — the answer's terms are smeared across four sections, and the question's word 'learn' matches none of them.*

The lesson is not "sections are bad". It is that a section boundary is a bet: it bets the answer lives inside one section. Usually it does — five questions fixed, one broken. But when the answer is a relationship smeared across a post, or the question is generic enough to match a neighbouring post better, the boundary is the wrong place to cut — and stemming would probably help here more than any chunking. That is a different measurement, for another day.

# What nothing fixes: the wording gap

One question misses under every chunker. "What happens inside a model when it reads a million tokens of context?" The answer chunk is an anecdote about ERNIE-5.5-Flash-Base, a 280-billion-parameter model, and gist tokens. Fixed 200 words puts it at rank 18. Fixed 400 words puts it at rank 12. Sections put it at rank 23. The question's words — inside, model, reads, million, tokens, context — match dozens of chunks about context windows, attention, and token costs. The answer chunk's distinctive words — ERNIE, 280B, gist — appear nowhere in the question. No chunking scheme can fix that, because chunking changes what the retriever sees, not what the question says. That is a wording gap, and it is the same failure I found last time when I reworded the question three ways: on the old corpus the original phrasing ranked 18th, keywords 2nd, plain words 13th — and on this corpus the fixed-window numbers reproduce almost exactly, 18th, 2nd, 13th.

I re-ran the rewording test for section chunks. Across the six reworded questions — eighteen phrasings in total — sections do better on seven, worse on three, and the same on eight. The worst case is still bad: the plain-words version of the million-token question ("What breaks when you paste a whole book into a chatbot?") ranks 7th under sections, 13th under fixed windows. Chunking is not a fix for wording. Embeddings are the usual answer to that, and I have not measured them on this golden set yet — that is the next run.

# What to do

In the order I would actually do it, based on what moved my numbers:

1. **Cut on headings, carry the heading, cap at about 400 words.** One chunk per section, split long sections at sentence boundaries. On my corpus that is 91% strict recall@5 at a median of 236 words per chunk — the same 91% as 400-word windows at about 60% of the words in the top five. If your documents have no headings, add them before you tune anything else; a document without headings is a document you cannot chunk by structure.
2. **If you can afford the words, chunk bigger anyway.** Fixed 400-word windows tie sections on recall@5 and rank the answers higher on average (MRR 0.769 against 0.651). They get the learning question that sections miss — but they miss the nerf-watch question that sections nail at rank 1. Structure is the efficient choice, not the maximum one. Pick based on what the prompt costs you, not on principle.
3. **Don't bother with paragraph boundaries.** They changed nothing here. And don't expect the heading alone to save a bad cut — it bought four points.
4. **Measure at the chunk level, strictly.** Post-level recall is 100% for four of the five chunkers I tried, and 95% for the worst one. If you only measure whether the document came back, every chunking scheme looks near-perfect and you will ship the 73% one.
5. **Check the smeared answers.** If your answers regularly spread across sections — a definition in one place, a parameter in another — section chunking will break some of them, and no chunking scheme fixes a question whose key word never appears in the answer's vocabulary. Look at your misses, not just your score.

# What this does not prove

The percentages do not generalize; the failure modes do. Fifteen posts is a small, friendly corpus: distinct topics, one author, no near-duplicates except the two training posts, which is exactly what cost me the learning question. Twenty-two questions is small enough that one question is four and a half points — so read 91% against 91% as a tie and 73% against 91% as the real difference. The questions are mine, written by the same person who wrote the posts, which almost certainly flatters the numbers.

The labels are where this measurement is most fragile, and I checked the obvious way it could fool me: the section chunks carry their heading as part of the chunk text, so a heading containing an answer term could count toward the two-term rule. Re-grading with the heading stripped out — judging the gold chunk on its body alone — gives the same 91%, the same two misses. The heading helps retrieval; it does not inflate the score.

Keyword retrieval is still the only method measured. Embeddings would change the rewording results, probably for the better, and I did not test that. A reranker over a wider candidate set would probably turn the rank-14 learning chunk into a top-five chunk. Test each change against your golden set, one at a time, and keep the one that moves the strict number.

What I do claim is narrower: last time I told you to chunk by structure, and I hadn't measured it. Now I have, on the same corpus and the same questions as the fixed-window numbers. The section is the unit that matters — not the paragraph, not the heading alone — and it buys eighteen points for about a hundred and eighty extra words in the top five. The 400-word window ties it on recall and ranks higher on average, so if you can pay for the words, take the bigger window; if you can't, structure gets you the same recall for fewer words. And the question you should be asking of your own chunker is not "did the document come back" but "did the passage that answers it come back, whole".

# Try it on your own docs

The script, the questions, and the full results are in the [retriever-doc-answer](https://github.com/d-sanoj/retriever-doc-answer) repo, so you can run the same test on your own docs. It needs Python 3 with numpy, no model, no API key. Point it at a folder of Markdown files, write twenty questions a real user would ask, label each with the passage that answers it — not the document, the passage — and run it twice: once with fixed windows, once with sections. If your section chunks beat your fixed windows by double digits, you had orphans. If they don't, your documents may already be written in short, self-contained sections, and the fixed windows were fine all along. Either way, you will know instead of guessing — which is the whole point.

# Sources

- My earlier post, [Your retriever finds the right document. It doesn't always find the answer.](/blog/retriever-finds-the-document-not-the-answer/) — the setup, the golden set, and the fixed-window numbers this post builds on. The 400-word result there (90% on 20 questions) and here (91% on 22) differ because the corpus and the questions grew; the within-run comparisons are the evidence.
- Barnett et al., "Seven Failure Points When Engineering a Retrieval Augmented Generation System" (arXiv:2401.05856, 2024) — seven failure points (missing content, missed top-ranked documents, not in context, not extracted, wrong format, incorrect specificity, incomplete) from three case studies in separate domains (research, education, biomedical). Chunking is not one of the seven; it is discussed in §6.1 as a research direction. The failure most relevant here is FP2, missed top-ranked documents.
- Anthropic, ["Introducing Contextual Retrieval"](https://www.anthropic.com/news/contextual-retrieval) (September 19, 2024) — the expensive version of carrying context with each chunk: an LLM-written paragraph situating the chunk in its document cut top-20 retrieval failures from 5.7% to 2.9% with contextual embeddings plus contextual BM25 on their test sets.
- All retrieval numbers are from `measure-chunking.py`, run on this blog's fifteen posts on 2026-11-18. Corpus: 41,375 words. BM25 k1 1.5, b 0.75; stopwords removed; no stemming. Section chunks carry their heading and are capped at 400 words, split at sentence boundaries.
