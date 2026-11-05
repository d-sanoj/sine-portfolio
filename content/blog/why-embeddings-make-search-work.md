---
title: "Why embeddings make semantic search possible"
slug: why-embeddings-make-search-work
date: 2026-11-04
description: "Keyword search needs shared words. Embeddings turn meaning into geometry so 'bad guy' can find 'villain'. A plain-language tour of vectors, neighbors, and dual encoders."
tags: [ai, explainer, embeddings, search, nlp]
cover: cover.png
coverAlt: "Title card reading 'Why embeddings make search work' with the subtitle 'How meaning becomes geometry, and why bad guy can find villain', over a row of grey sine waves with one yellow wave highlighted."
---

![Title card reading "Why embeddings make search work" with the subtitle "How meaning becomes geometry, and why bad guy can find villain", over a row of grey sine waves with one yellow wave highlighted.](cover.png)

Type "bad guy in lord of the rings" into a search box that only understands keywords, and you are gambling that the right page literally contains those words. Type the same thing into a system that understands *meaning*, and it can surface a sentence like "Sala Baker is best known for portraying the villain Sauron in the Lord of the Rings trilogy" — even though "bad guy" and "villain" share no tokens.

That second trick runs on **embeddings**: turning snippets of text into lists of numbers so that similar meanings land near each other in space. This post is the plain-language version of how that works, why it beats pure keyword search for many questions, and what still breaks.

The "bad guy / villain" example is not mine. It is the motivating case from the 2020 paper that made dense retrieval famous in open-domain question answering, [Dense Passage Retrieval for Open-Domain Question Answering](https://arxiv.org/abs/2004.04906) (DPR).

## First, the old way: sparse vectors and BM25

Before we talk about neural nets, it helps to respect what keyword search already does well.

Imagine every document as a gigantic scorecard with one slot per word in the vocabulary. Most slots are zero. The slots for words that actually appear get a weight. Classic weighting schemes boost rare words and discount words that show up everywhere. The family of ranking functions known as **BM25**, surveyed in Robertson and Zaragoza's [The Probabilistic Relevance Framework: BM25 and Beyond](https://www.nowpublishers.com/article/Details/INR-019), is still the default first stage in a huge amount of production search.

![Diagram titled "Two ways to turn text into something searchable". Left: sparse BM25-style vector for a passage about the villain Sauron in the Lord of the Rings, one dimension per vocabulary word, where villain, lord and rings are 1 and bad and guy are 0; it matches exact tokens and misses synonyms. Right: dense embedding as a short vector of real numbers where nearby vectors mean similar meaning.](sparse-vs-dense.png)

Sparse search is fast (inverted indexes are a miracle) and wonderfully precise when the user and the document share the important terms. It struggles when they don't: synonyms, paraphrases, and questions phrased unlike any document. "Bad guy" will not hit "villain" unless you hand-maintain a synonym list, and synonym lists never end.

Dense embeddings flip the representation. Instead of one dimension per word, you get a short vector of real numbers — hundreds of dimensions, not hundreds of thousands — where the axes no longer mean "the word *cat* appeared." The axes are latent. What matters is geometry: distance and direction.

## What an embedding actually is

An embedding model is a function:

**text → a vector of numbers**

`"puppy"` might become something like `[0.12, -0.44, 0.91, …]` with 384 or 768 entries. `"dog"` becomes a different list that points roughly the same way. `"truck"` points somewhere else.

You do not hand-write those numbers. You train a model so that texts that show up in similar contexts, or that humans label as related, end up close under a chosen similarity score. The most common scores are **cosine similarity** (the cosine of the angle between vectors) and the **dot product** (which agrees with cosine when vectors are length-normalized).

A useful intuition: cosine cares about direction more than length. Two reviews that say the same thing at different lengths can still align.

## How the map gets drawn

The modern story has a clear milestone in 2013. Mikolov and colleagues at Google showed that fairly simple models, trained on a lot of text, produce word vectors with striking linear structure. Their paper, [Efficient Estimation of Word Representations in Vector Space](https://arxiv.org/abs/1301.3781), introduced the continuous bag-of-words and skip-gram architectures that everyone still calls **word2vec**.

The party trick that made the internet notice was arithmetic roughly like:

**king − man + woman ≈ queen**

That is not magic and it is not always true for every model or every triple. It is evidence that directions in the space can encode relationships (gender, tense, capital-of) when the training data supports them.

![Animated diagram titled "Training pulls related words together". Words start scattered on a 2-D map, then dog and puppy, car and truck, and king and queen drift into clusters. A final box shows the illustrative equation king − man + woman ≈ queen.](neighbors.gif){poster=neighbors-poster.png}

*A still version is available: [poster frame](neighbors-poster.png).*

**What the animation shows, step by step:**

1. Start: words are scattered in a cartoon 2-D slice of embedding space.
2. The model sees "dog" and "puppy" used in similar ways.
3. Their vectors get nudged closer.
4. After many examples, clusters appear — animals, vehicles, people.
5. Classic demo: king − man + woman ≈ queen (illustrative, not a guarantee).

![Diagram titled "Meaning as a map (cartoon 2-D slice)". A scatter plot shows dog near puppy, cat near kitten, car near truck, and king near queen, with notes that real embeddings live in hundreds of dimensions and this is a toy projection.](meaning-map.png)

One honest caveat about the picture. Real embedding spaces have hundreds of dimensions. Any 2-D drawing is a projection, which means some neighbors on the page might not be true neighbors in the full space, and some true neighbors might look far apart after flattening. Treat the diagrams as cartoons of the idea, not measurements.

## From words to sentences and passages

Word vectors are not enough for search. Queries and documents are sentences and paragraphs. If you average the word vectors in a sentence, you get a rough sentence vector, but you lose a lot of structure ("not good" is not halfway between "not" and "good").

Two later ideas matter for search:

**Contextual encoders.** Models like BERT assign a vector to each token *in context*, so the word "bank" in "river bank" differs from "bank" in "investment bank." That is huge for meaning, but a vanilla BERT still does not give you one neat vector per sentence that is ready for cosine search.

**Sentence embeddings.** [Sentence-BERT](https://arxiv.org/abs/1908.10084) (Reimers and Gurevych, 2019) fine-tunes BERT-like models with a siamese setup so that the resulting sentence vectors *are* comparable with cosine similarity. That paper is the reason a huge number of "embed this paragraph" libraries feel fast and good enough out of the box.

Once you can embed a passage into a single vector, you can embed a whole corpus offline and store the vectors in an index built for nearest-neighbor or maximum inner-product search.

## Dense retrieval: the dual encoder

Here is the architecture behind most modern semantic search and retrieval-augmented generation stacks.

![Diagram titled "Dual encoder at a glance". A query encoder outputs a q vector; a passage encoder outputs p vectors that are indexed offline. A panel on the right shows score = q · p, then take top-k neighbors. A note says passages are embedded once, offline, and queries at search time.](dual-encoder-static.png)

You train (or download) **two** encoders, or one encoder used twice:

- a **query encoder** that turns the user's question into vector `q`
- a **passage encoder** that turns each document chunk into vector `p`

At index time, you embed every passage once and store the vectors. At query time, you embed only the query and ask: which stored `p` vectors have the largest dot product with `q`? Return the top *k*.

That is the dual-encoder setup used by [DPR](https://arxiv.org/abs/2004.04906). The training objective is conceptually simple: push the vector of a question toward the vectors of passages that contain its answer, and away from passages that do not. DPR showed you can do this with relatively modest amounts of question–passage pairs and still beat a strong BM25 baseline on top-20 retrieval accuracy by large margins on several open-domain QA datasets.

![Animated diagram titled "Dense retrieval with a dual encoder". A query about the bad guy in Lord of the Rings is encoded into a vector; precomputed passage vectors are scored by dot product; the passage mentioning villain Sauron gets the highest score even though it does not contain the words bad guy.](dual-encoder.gif){poster=dual-encoder-poster.png}

*A still version is available: [poster frame](dual-encoder-poster.png).*

**What the animation shows, step by step:**

1. The query appears: "Who is the bad guy in Lord of the Rings?"
2. The query encoder turns it into one vector.
3. Passages are already embedded in an index.
4. Each candidate gets a score `q · p`.
5. The passage with "villain Sauron" ranks first — meaning matched where keywords would not.

Why two encoders instead of one giant model that reads the query and a document *together*? Because the joint model (a cross-encoder) is more accurate *per pair* and impossibly expensive across millions of documents. The dual encoder lets you precompute passage vectors and use fast nearest-neighbor search. Many production systems retrieve with a dual encoder (or hybrid sparse+dense), then re-rank a short list of top candidates with a cross-encoder.

## What "near" buys you, and what it costs

**Buys you**

- Synonym and paraphrase matching without maintaining lists
- Questions that do not look like the documents they need
- A single representation you can also use for clustering, deduplication, and recommendations

**Costs you**

- **False neighbors.** Embeddings smooth. That is the point. Sometimes they smooth too much and retrieve a passage that is topically adjacent but factually wrong for the question.
- **Missed exact needles.** If the user wants an error code, a SKU, or a rare proper name, BM25's exact-token bias is often healthier. This is why hybrid retrieval (dense + sparse) is so common.
- **Chunking choices.** You embed *passages*, not infinite documents. Too-small chunks lose context. Too-large chunks blur the vector. The "right" size is an empirical mess that depends on the corpus.
- **Domain shift.** A model trained on Wikipedia-style QA may be mediocre on legal contracts or your private Slack export until you fine-tune or swap in a domain-adapted encoder.
- **Index freshness.** Sparse inverted indexes update cheaply when a document changes. Dense indexes must re-embed changed text. For huge corpora that churn, that operational cost is real.

I also want to separate two claims that marketing pages love to fuse. "We use embeddings" does not automatically mean "we understand your documents." It means "we project text into a space where geometric nearness correlates with the similarity signal we trained for." If that signal matches your users' intent, search feels magical. If it does not, you get confidently weird neighbors.

## A tiny geometric sketch (no final exam)

Suppose normalized vectors `q` and `p`. Cosine similarity is just `q · p`. If the angle is 0°, similarity is 1. If they are orthogonal, 0. If they point opposite directions, -1.

Training does not "assign meaning" to dimension 17. It adjusts the encoder weights so that, across many examples, true pairs score higher than false pairs. The dimensions are a coordinate system the model invents. Trying to interpret a single coordinate is usually a trap; looking at nearest neighbors of a vector is much more informative.

If you want a visual walk through word embeddings, including the king − man + woman direction trick, 3Blue1Brown's [Transformers, the tech behind LLMs](https://www.youtube.com/watch?v=wjZofJX0v4M) (Deep Learning Chapter 5) covers them early on. For sentence-level practice, the [Sentence-Transformers documentation](https://www.sbert.net/) is the rare library doc that teaches while it configures.

## Putting it next to keyword search

I do not think of embeddings as a replacement for BM25. I think of them as a second sense.

| | Sparse (BM25) | Dense (embeddings) |
|---|---|---|
| Strength | Exact tokens, rare IDs, auditability | Synonyms, paraphrases, vague questions |
| Failure mode | Vocabulary mismatch | Soft, wrong neighbors |
| Indexing | Inverted index | Vector index (HNSW, IVF, …) |
| Update cost | Usually cheap | Re-embed changed text |

The boring mature answer in 2026 is hybrid: retrieve from both, fuse the rankings, optionally re-rank. DPR's contribution was proving the dense side could stand on its own for open-domain QA retrieval. Production search engines, and the retrieval layer in front of many chatbots, quietly kept the sparse side anyway.

## What I make of it

Embeddings are how we convinced computers that meaning can be a place. Not a perfect place — a wrinkled, biased, training-data-shaped place — but a place you can do geometry in. Once meaning has coordinates, search stops being only string matching and starts being nearest-neighbor lookup.

That single move explains a surprising fraction of modern AI product demos: semantic file search, "chat with your PDF," recommendation carousels, retrieval-augmented answers. Under the chat UI, something embedded your question, something embedded your stuff, and a vector index returned the neighbors.

If you remember only one sentence, make it this: **an embedding does not store the text; it stores a position, and search is asking who lives nearby.**

## Sources

**Papers**

- Mikolov, Chen, Corrado, Dean, "Efficient Estimation of Word Representations in Vector Space" (2013): <https://arxiv.org/abs/1301.3781>
- Reimers and Gurevych, "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks" (2019): <https://arxiv.org/abs/1908.10084>
- Karpukhin et al., "Dense Passage Retrieval for Open-Domain Question Answering" (2020): <https://arxiv.org/abs/2004.04906>
- Robertson and Zaragoza, "The Probabilistic Relevance Framework: BM25 and Beyond" (2009): <https://www.nowpublishers.com/article/Details/INR-019> (open PDF: <https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf>)

**Code and docs**

- Facebook Research, DPR repository: <https://github.com/facebookresearch/DPR>
- Sentence-Transformers documentation: <https://www.sbert.net/>
- 3Blue1Brown, "Transformers, the tech behind LLMs | Deep Learning Chapter 5" (YouTube): <https://www.youtube.com/watch?v=wjZofJX0v4M>
- Sentence-Transformers publications list (includes SBERT bib entry): <https://sbert.net/docs/publications.html>

*All images in this post are original diagrams made for it. Nearest-neighbor layouts and similarity scores in the animations are illustrative cartoons, not outputs of a particular trained model.*
