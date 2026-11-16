---
title: "Your retriever finds the right document. It doesn't always find the answer."
slug: retriever-finds-the-document-not-the-answer
date: 2026-11-16
description: "I built a 20-question eval on my own blog and measured BM25 retrieval. The right document came back 95% of the time. The passage with the answer made the top five only 70% of the time."
tags: [rag, retrieval, measurement, bm25]
cover: cover.png
coverAlt: "Title card reading 'Your retriever finds the right document. It doesn't always find the answer.' Below it, two bars: 'right document in the top 5' at 95% in green, and 'passage with the answer in the top 5' at 70% in yellow."
---

![Title card reading "Your retriever finds the right document. It doesn't always find the answer." Below it, two bars: "right document in the top 5" at 95% in green, and "passage with the answer in the top 5" at 70% in yellow.](cover.png)

The RAG demo always works. You load twenty documents, ask five questions, and the answers come back crisp and cited. Then you load the real corpus, ship it, and the same assistant confidently answers questions using a chunk from the wrong page, the wrong month, or the wrong customer. Nothing errored. The retrieval "worked." It just returned the wrong thing, dressed up as the right thing.

When that happens, the reflex is to blame the model — a bigger one, a better prompt, an instruction to "only use the provided context." The model can only answer from what retrieval hands it, so I built the smallest honest test I could — twenty questions against my own blog, with the answers known in advance — and measured retrieval on its own. The retriever is better than the complaints say, and worse than the metrics say, at the same time. Both halves are measurable, and the gap between them is the post.

# The setup: twenty questions, one small corpus, no model

The corpus is this blog: fourteen posts, 38,433 words, everything from how embeddings work to how I measured my own repo's conventions. Small, but real — written for readers, not for the test. The questions are the kind a reader would actually ask: "How do I stop my coding agent from ignoring my team's style rules?" "Can I use Claude Motion on the Pro plan, or is it really Team-only?" "What does it mean to edit a model's weights directly, without retraining?" I wrote each one in ordinary words, deliberately not copying the post's phrasing, because a real user doesn't know the vocabulary of the document they're looking for. Each question has one gold post — the one that answers it.

The retrievers are the two classics, implemented from scratch in about a hundred lines: BM25 (k1 1.5, b 0.75) and TF-IDF with cosine similarity. No stemming, a small stopword list, nothing fancy — this is the retriever you get for free in every framework's quickstart. I did not test embedding retrieval; no embedding model was available in this run.

The chunks are fixed-size word windows: 100, 200, 400 and 800 words, plus whole posts, each with 20% overlap. And I graded at two levels, because the difference between them is the whole argument:

- **Post-level:** did any chunk from the right post make the top five? This is what most people measure, because it is easy.
- **Chunk-level:** did the chunk that actually contains the answer make the top five? A chunk counts as the answer only if it comes from the gold post and contains at least two of the answer's key terms — the weight-editing question needs two of "weight-space", "edited", "Astra". Strict, and I will show you where that strictness is itself a judgment call.

Top five, because that is roughly what a RAG system hands the model. The script, the questions, and the full results are in the [retriever-doc-answer](https://github.com/d-sanoj/retriever-doc-answer) repo, so you can run the same test on your own docs. The script excludes this post from its own corpus — it quotes the questions, so including it would change the measurement.

![A RAG pipeline in four boxes: a question goes to a retriever, which returns the top 5 chunks, and those 5 go to the model. Below, a ranked list shows ranks 1 to 5, then rank 8 in red: the chunk with the answer, outside the top 5 the model ever sees.](rag-pipeline.png)

# The comforting number: 95%

At 200-word chunks, BM25 puts the right post in the top five for 19 of 20 questions — 95% recall@5, 85% at rank one. TF-IDF is essentially tied. Bigger chunks are even kinder: at 400 words the right post is in the top five every time. If you stopped here, you would write the post I expected to write: retrieval is fine, the model is the problem, move on.

That number is real, and it is the wrong number to run your system on. The model never sees a post — it sees five chunks. Whether the right document is in the pile is a different question from whether the answering passage is in the five chunks the model reads.

# The number that matters: 70%

Same retriever, same chunks, same questions. The chunk that actually contains the answer made the top five for 14 of 20 questions — 70% recall@5, 55% at rank one. Six questions miss. And here is the detail that makes the gap concrete: for four of those six, the right post was ranked first. The retriever found the document and then handed the model the wrong part of it.

| Question | Right post rank | Answer chunk rank |
|---|---|---|
| How can I tell if my model got worse after an update? | 1 | 11 |
| How do I know if the tokenizer charges extra for non-English text? | 1 | 8 |
| What does it mean to edit a model's weights directly, without retraining? | 1 | 8 |
| What happens inside a model when it reads a million tokens? | 15 | 18 |
| How many tokens does a sentence cost in different languages? | 1 | 6 |
| What should I do if my model's performance drops and the vendor says nothing changed? | 2 | 19 |

The weight-editing question is the clearest case. Seven of the top ten chunks come from the right post. The model gets the introduction, the background on what weights are, the caveats. What it does not get is the experiment itself: the chunk describing the edit — "The edit: 131,072 weights change, 0.016% of the model… MATH-500 from 7.9% to 48.1%" — sits at rank 8, and the chunk introducing the experiment sits right behind it at rank 9. Both just outside the five chunks the model reads. The question's words ("edit", "directly", "retraining") match the post's throat-clearing better than they match its substance, because the substance uses different words ("Astra", "layers", "tensors").

![Animation of the ranked list for the weight-editing question. First, the top five chunks — four from the right post, one from another — which are what the model receives. Then the list shows ranks 6 to 10, where rank 8 is the chunk describing the edit itself and rank 9 introduces the experiment. Then a summary: the model gets 5 chunks, and the answer is at rank 8.](ranked-list.gif){poster=ranked-list-poster.png}

*Still frame: the model receives the top five chunks; the chunk with the answer sits at rank 8, just below the cutoff.*

The "model got worse" question is the same shape in miniature. The chunk that tells you what to do — the frozen regression suite, nerf-watch — is at rank 11. The chunks that beat it match the question's rarer words several at a time: "tell" appears in 4% of chunks, "worse" in 3%, "update" in 7%, "measure" in 11%. The how-to chunk matches mostly "model", which appears in half the chunks (123 of 244) and counts for almost nothing, plus "worse" and "way", once each. It says the model "feels dumber"; the question says "got worse". Same meaning, and the one word they share is the one that matters least.

# What "the answer" means changes the number

Before you quote 70%, know how much of it is my labeling. The strict rule — two answer terms in the chunk — is a judgment call. Loosen it to one term and the same run scores 95% at the top five, same as the post-level number. So which is it, 70 or 95?

Both, and the difference is the lesson. The loose number counts any chunk that mentions the answer's key idea; the strict number counts the chunk that explains it. The tokenizer question's plainest answer — "Amharic still costs 206 tokens for a sentence English says in 33" — sits at rank 3, and a human would count that as found. My strict labels said rank 8, because the rank-3 chunk carries only one of my three answer terms. So 70% is a floor, not a ceiling — and the floor is the number to design against, because a loosely graded near-miss is exactly what a model turns into a confident wrong answer. Measure both, report the strict one, and say which you did.

The labels are also where this measurement is most fragile, and I fixed one live while writing: the weight-editing question originally used "by hand" as an answer term, but that phrase appears only in the post's title and image text, never in the indexed body — so it could never match a chunk. Replacing it with "Astra" moved that question's answer chunk from rank 30 to rank 8. The headline did not move: still 70%, still six misses. If a single labeling choice moves your headline, say so; if it doesn't, say that too.

# Chunk size is the biggest lever I found

Strict chunk-level recall@5, BM25:

- 100-word chunks: 60% (12 of 20)
- 200-word chunks: 70% (14 of 20)
- 400-word chunks: 90% (18 of 20)

Small chunks are orphans: a 100-word chunk cut from mid-section often lacks the words that say what it's about — the heading stayed in the previous chunk, the context in the next. A 400-word chunk carries its own context: the definition, the example, the sentence that names the thing. That is why the same retriever gains 30 points just from cutting the documents differently.

It is not free: a 400-word chunk is twice the words of the 200-word chunks used through most of this post, for the same five slots, and more words per chunk means more noise — the model has to find the sentence inside a bigger haystack. The right size depends on your documents: dense writing survives small chunks; discursive writing with long build-ups does not. But if you change one thing, change the chunk size first — it is the only knob that moved my numbers by double digits. The cheap second knob, prepending the post title to every chunk, is a mirage, and it is the next section.

![Grouped bars of recall at the top 5, BM25, by chunk size. Post level: 95% at 100 words, 95% at 200, 100% at 400. Chunk level, strict: 60% at 100 words, 70% at 200, 90% at 400. The gap between the two bars shrinks as chunks get bigger, but never closes.](recall-gap.png)

# The title trick is a mirage

Prepending the post title to every chunk is the first fix everyone tries, and on the easy metric it works: post-level recall@5 goes from 95% to 100%. The document is found every time. But the chunk-level number does not move at all — still 70%. The title helps the retriever pick the document, and every chunk from that document gets the same title, so it cannot help pick the passage. It is a document-finding fix sold as a retrieval fix: measure only at the post level and you will ship it, watch the number hit 100%, and conclude retrieval is solved — while the model keeps getting the wrong paragraph.

# Wording is a lever you don't control

The same question, asked three ways, on the same retriever, same chunks:

![Animation of one question asked three ways. First, as a reader asks it: 'What happens inside a model when it reads a million tokens of context?' — the answer chunk lands at rank 18. Second, in keywords: 'million token context window attention cost' — rank 2. Third, in plain words: 'What breaks when you paste a whole book into a chatbot?' — rank 13. Same question, same corpus, three different ranks.](rewording.gif){poster=rewording-poster.png}

*Still frame: the same question in three phrasings — the answer chunk lands at rank 18, rank 2, and rank 13.*

"What happens inside a model when it reads a million tokens of context?" The answer chunk is at rank 18. Ask it in keywords — "million token context window attention cost" — and the answer is at rank 2. Ask it the way a person who has never read the post would — "What breaks when you paste a whole book into a chatbot?" — and it is at rank 13. The question and the answer are about the same thing in all three cases. The words are different, and keyword retrieval only sees the words.

The sharpest case is a question about giving an agent memory: "Can an AI coding helper remember what we did yesterday?" The answer chunk is at rank 17. It matches exactly one word of the question — "remember", once. The chunks that beat it match two: "coding" and "ai" in the conventions post, "yesterday" and "ai" in the Qwen news post. And "yesterday" is doing quiet damage: it is the opening word of two news posts, so a question that mentions yesterday gets news. The word "remember" is in the answer chunk — the post says "the first session has nothing to remember yet" — so this is not a stemming failure. It is arithmetic: one shared word loses to two.

There is no stemming in this setup — the tokenizer splits on letters and digits and matches exactly — so "edit" never matches "edited". Your users ask like the first phrasing; your eval, written from the documents, asks like the second. That gap is a bug in your eval, and it is flattering your system.

# Two failures multiply

There is a second failure hiding behind the first, and it is not in the retriever. Suppose the answer chunk is retrieved — at rank 8, because you pass ten chunks instead of five. Now it sits in the middle of a long prompt. Liu and colleagues showed in 2023 that models use information at the start and end of a long input far better than in the middle: accuracy on multi-document questions fell by more than 20 percentage points when the answer-bearing document moved to the middle, and in a 20-document setting GPT-3.5-Turbo with the answer buried mid-prompt scored below the same model answering with no documents at all. The curve is U-shaped, and it held for all four models they tested on multi-document QA, including the long-context ones; the paper notes exceptions elsewhere (Flan-UL2 was relatively robust within its training-time length; Llama-2 7B showed recency bias without the U-shape).

So retrieval rank and prompt position compound: a chunk at rank 8 is not merely "retrieved late", it lands mid-prompt, where the model is worst at using it. Passing more chunks can make generation worse, because every chunk you add pushes the good one further from the edges. The fix is not "retrieve more" — it is "retrieve the right passage, and put it where the model will read it", near the start or right next to the question.

# What to do

In the order I would actually do it, based on what moved my numbers:

1. **Build the golden set before you tune anything.** Twenty real questions, each with a known-correct passage, not a known-correct document. Measure recall@k at the chunk level, strictly, and separately from answer quality. Measure only whether the right document came back and you will conclude your retriever works and spend your week on the prompt. My numbers say the document test passes 95% of the time while the passage test passes 70% — that gap is where your users' bad answers live.
2. **Chunk bigger, or chunk by structure.** On my corpus, 400-word chunks beat 200-word chunks by 20 points at the strict level. If your documents have natural boundaries — headings, sections, list items — cut there instead of every N words, and carry the heading with the chunk. A chunk that cannot say what it is about will not be found by a question that asks about it.
3. **Prepend context to chunks, but know what it buys.** Anthropic's contextual retrieval — an LLM writes a short paragraph situating each chunk in its document — cut their top-20 retrieval failure rate from 5.7% to 2.9% with contextual BM25, and to 1.9% with a reranker, on their test sets. Those are their numbers, at k=20 — not a promise for your corpus. My cheap version, prepending the title, fixed document-finding and did nothing for passages. The expensive version earns its keep by giving each chunk its own context, not the document's.
4. **Hybrid search and reranking are the next rung, and I did not measure them.** BM25 and TF-IDF tied on my corpus, and neither sees meaning. Embeddings fix the synonym failures and introduce their own — they discard exact matches BM25 catches instantly. A reranker over a wider candidate set is the standard way to turn a rank-11 chunk into a rank-2 chunk. Test each change against your golden set, one at a time, and keep the one that moves the strict number.
5. **If the corpus is small, skip retrieval.** Anthropic's own guidance from the same write-up: if the whole knowledge base fits in about 200,000 tokens, put it all in the prompt and skip RAG. My corpus is 38,433 words — well under that line. Retrieval earns its place when the corpus doesn't fit, not before.

# What this does not prove

The percentages do not generalize; the failure modes do. Fourteen posts is a small, friendly corpus: distinct topics, one author, no near-duplicates to confuse the ranking. My questions are mine, written by the same person who wrote the posts, which almost certainly flatters the numbers. Keyword retrieval is the only method measured; embeddings would change the rewording results, probably for the better, and I did not test that. And the headline 70% depends on how I defined "the answer" — I showed you the definition and the alternative, so you can decide which one you believe.

What I do claim is narrower: grading retrieval at the document level overstates it. The model reads passages, not documents, and the answering passage is the unit that has to make the top five. Measure that, on questions written the way your users write them, and the fixes arrange themselves: chunk size first, context second, reranking third. The model is usually fine. Check what you handed it.

# Try it on your own docs

The whole experiment is now a standalone service: [retriever-doc-answer](https://github.com/d-sanoj/retriever-doc-answer) — the same BM25 experiment rebuilt as a FastAPI service, with the script, questions, and results included. Point the script at a folder of Markdown files, write twenty questions a real user would ask, label each with the passage that answers it — not the document, the passage — and run it. It needs Python 3 with numpy, no model, no API key. The script excludes this post from its own corpus, so the numbers in `results.json` reproduce exactly. If your document-level recall is 95% and your passage-level recall is 70%, you have the same system I have.

# Sources

- Liu, N. F., Lin, K., Hewitt, J., Paranjape, A., Bevilacqua, M., Petroni, F., & Liang, P., ["Lost in the Middle: How Language Models Use Long Contexts"](https://arxiv.org/abs/2307.03172) (arXiv:2307.03172, 2023) — U-shaped accuracy across context positions; GPT-3.5-Turbo mid-prompt below its no-documents baseline in the 20-document setting.
- Anthropic, ["Introducing Contextual Retrieval"](https://www.anthropic.com/news/contextual-retrieval) (September 19, 2024) — top-20 failure 5.7% baseline, 3.7% with contextual embeddings, 2.9% with contextual BM25, 1.9% with reranking; ~$1.02 per million document tokens; the 200,000-token guidance.
- Barnett et al., "Seven Failure Points When Engineering a Retrieval Augmented Generation System" (2024) — seven distinct failure points across chunking, embedding, ranking and generation, from three case studies in separate domains (research, education, biomedical).
- My earlier post, [Why embeddings make search work](/blog/why-embeddings-make-search-work/) — the background on BM25, sparse vectors, and the DPR dual encoder, which this post builds on rather than repeating.
- All retrieval numbers are from `measure-retrieval.py`, run on this blog's fourteen posts on 2026-11-16. Corpus: 38,433 words. BM25 k1 1.5, b 0.75; TF-IDF with sublinear term frequency and cosine similarity; stopwords removed; no stemming.
