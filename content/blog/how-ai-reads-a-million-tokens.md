---
title: "How an AI reads a million tokens (and why that's so hard)"
slug: how-ai-reads-a-million-tokens
date: 2026-11-05
description: "Baidu just released an open model that can take in a million tokens at once. Here's a plain-language tour of tokens, next-token prediction and attention, and the memory trick that makes a million tokens affordable."
tags: [ai, explainer, transformers, attention, llm, news]
cover: cover.png
coverAlt: "Title card reading 'How an AI reads a million tokens' with the subtitle 'Tokens, attention, and the memory problem behind ERNIE 5.5 Flash', over a row of grey sine waves with one yellow wave highlighted."
---

![Title card reading "How an AI reads a million tokens" with the subtitle "Tokens, attention, and the memory problem behind ERNIE 5.5 Flash", over a row of grey sine waves with one yellow wave highlighted.](cover.png)

This morning Baidu put out a new open model called [ERNIE-5.5-Flash-Base](https://ernie.baidu.com/release/ernie-5-5-flash-base/), with the weights up on [Hugging Face](https://huggingface.co/baidu/ERNIE-5.5-Flash-Base). The headline numbers are the kind that make most people's eyes glaze over: 280 billion parameters, only 14 billion of them "activated per token", trained on 33.5 trillion tokens, and able to handle "a 1M-token context for fine-tuning and inference."

I read the whole announcement twice. The first time I mostly nodded along. The second time I realised something: almost every interesting sentence in it is about one problem. How do you let a model read a really, really long document without it running out of memory?

That's what this post is about. It's my first one here, so I wanted to start at the bottom. If you've ever wondered what's actually going on when ChatGPT or Claude or Gemini "reads" your message, by the end you should have a decent mental picture. And then the ERNIE news will make a lot more sense, I promise.

## First, what's a token?

Language models don't read letters, and they don't really read words either. They read **tokens**, which are chunks of text taken from a fixed vocabulary. A common word like "the" is usually one token. A rarer word gets split into pieces. "Tokenizers" might become "token" + "izers". Spaces usually stick to the front of the next chunk.

![Diagram titled "Models read tokens, not letters". The sentence "Sanoj's blog explains tokenizers" is shown split into six boxes: "Sanoj", "'s", "·blog", "·explains", "·token", "izers", where a dot marks a space that belongs to the token. Below, the number 1,234,567 is shown as three yellow boxes, "1", "234" and "567", with the note that millions, thousands and ones line up.](tokens.png)

*The first row is an illustrative split, not the output of any particular tokenizer. The second row shows how ERNIE 5.5 Flash groups digits, as described in its announcement.*

The most common way to build that vocabulary is a method borrowed from data compression called byte-pair encoding. You start with single characters and keep merging the pairs that show up together most often, until you have a vocabulary of the size you want. It was popularised for language models by a [2015 paper on translating rare words with subword units](https://arxiv.org/abs/1508.07909). ERNIE 5.5 Flash uses [a BPE tokenizer with a vocabulary of about 200K entries](https://ernie.baidu.com/release/ernie-5-5-flash-base/).

There's a detail in the ERNIE post I really liked, because it shows how much these small choices matter. Numbers get split **right-to-left in groups of up to three digits**, so 1,234,567 becomes `1` `234` `567`. Why bother? Think about how you learned to add numbers on paper. You line them up by the ones column. If a tokenizer chops 1234567 into `123` `456` `7`, the "thousands" part of one number won't line up with the "thousands" part of another. Baidu says grouping from the right [helps with arithmetic and number-heavy text](https://ernie.baidu.com/release/ernie-5-5-flash-base/). It's such a human fix, and I love that.

So when we say "a million tokens," picture something like a few thick novels' worth of text. The exact number of words depends on the language and the tokenizer, so I'm not going to pretend there's a precise conversion. It's a lot.

## The whole trick: guess the next token

Here's the part that surprised me most when I first learned it. Under all the chat interfaces, a base language model does one thing. You give it a sequence of tokens, and it gives you back a score for **every token in its vocabulary**, saying how likely each one is to come next.

That's it. To write a paragraph, the model picks one token from that list, sticks it on the end, and runs the whole thing again with the slightly longer text. Over and over.

![Animated diagram titled "Next-token prediction, one step at a time". The tokens "The cat sat on the" flow into a box labelled "Language model (stack of transformer layers)". Bars appear showing probabilities for the next token: mat 41%, floor 17%, sofa 12%, bed 8%, roof 3%. "mat" is highlighted and appended, and the loop repeats with new bars for what comes after "mat".](next-token.gif){poster=next-token-poster.png}

*Next-token prediction. The probabilities here are made up for illustration; a real model scores every entry in its vocabulary, which for ERNIE 5.5 Flash is about 200,000 options. A still version is available: [poster frame](next-token-poster.png).*

**What the animation shows, step by step:**

1. The input "The cat sat on the" is shown as five token boxes.
2. A dot travels from the tokens into the box labelled "Language model".
3. A bar chart grows, giving each candidate next token a probability: mat 41%, floor 17%, sofa 12%, bed 8%, roof 3%.
4. "mat" is highlighted in yellow with the note "Pick 'mat' and add it to the end."
5. The loop runs again on "The cat sat on the mat", producing new bars (a full stop, "and", a comma, and so on).
6. The final frame shows "The cat sat on the mat ." and the line "...and so on, one token at a time."

If that sounds too simple to produce anything clever, I felt the same way. The cleverness isn't in the loop. It's in how the model comes up with those scores. To guess the next word in "The detective looked at the muddy boots and finally knew who the killer was. It was..." you need to have actually followed the story. Get good enough at guessing the next token across trillions of tokens of text, and a lot of what looks like understanding falls out of it. Andrej Karpathy's [Let's build GPT](https://www.youtube.com/watch?v=kCc8FmEb1nY) video builds exactly this loop from scratch in code, and it's the best two hours you can spend if you want to see it with your own eyes.

This is also where the word "Base" in ERNIE-5.5-Flash-Base comes from. A base model has only been through this pre-training stage. Baidu says the released weights are [the checkpoint at the end of pre-training, before any mid- or post-training](https://ernie.baidu.com/release/ernie-5-5-flash-base/). It's not a chatbot yet. It's the raw next-token guesser, which other people can then shape into an assistant, a coding agent, or whatever they want. Baidu says the post-trained ERNIE 5.5 Flash [will follow](https://ernie.baidu.com/release/ernie-5-5-flash-base/).

## Attention, or how a word figures out what it's about

So how does the model use the earlier text? The answer, since the 2017 paper [Attention Is All You Need](https://arxiv.org/abs/1706.03762), is a mechanism called **attention**. It's the core of the "transformer" architecture that pretty much every big language model uses today.

Take this sentence:

> The trophy didn't fit in the suitcase because it was too big.

What was too big? You know it's the trophy. Swap "big" for "small" and suddenly "it" means the suitcase. Sentences like this are famous in AI research, because they're the style of puzzle used in the [Winograd Schema Challenge](https://cs.nyu.edu/~davise/papers/WinogradSchemas/WS.html), a test designed so you can't solve it without some common sense.

Attention is how a transformer handles this. Every token gets to look back at the tokens before it (and itself) and decide how much each one matters to it right now.

![Animated diagram titled "Attention: what is 'it' looking at?". The sentence "The trophy didn't fit in the suitcase because it was too big" is shown as token boxes, with "it" outlined in yellow. Curved lines grow from each earlier word to "it". The lines then thicken by weight: trophy 55%, suitcase 18%, it itself 9%, fit 8%, and 3% or less for the rest. A final box reads: new meaning of "it" is about 55% trophy plus 18% suitcase plus 9% itself plus the rest.](attention.gif){poster=attention-poster.png}

*One attention head, as a cartoon. The percentages are illustrative, not measured from a real model. A still version is available: [poster frame](attention-poster.png).*

**What the animation shows, step by step:**

1. The sentence appears as token boxes, with "it" highlighted. The caption says every token can look back at every earlier token.
2. Thin curved lines grow from each earlier word to "it", meaning "it" is scoring how relevant each one is.
3. The lines change thickness and percentages appear under each word. "trophy" gets 55% and "suitcase" 18%, both in yellow. "it" itself gets 9%, "fit" 8%, and every other word 3% or less. Together they add up to 100%.
4. A box appears explaining that the new meaning of "it" is a blend: about 55% trophy, 18% suitcase, 9% itself, and a little of everything else.

Here's how I think about it. Every token walks into a room carrying three cards. One card is a **question** ("I'm a pronoun, who am I pointing at?"). One is a **label** describing what it has to offer ("I'm a noun, an object, a thing that can be big"). And one is the actual **information** it's willing to share. In the paper these are called the query, the key, and the value.

For "it", the model compares its question against every earlier token's label. Good matches get high scores. Those scores get squashed into percentages that add up to 100 (that's a function called softmax). Then "it" builds its new meaning by mixing everyone's information cards according to those percentages. After that, "it" isn't just a generic pronoun anymore. It carries a good chunk of "trophy" inside it.

One honest wrinkle about my cartoon. A GPT-style model reads strictly left to right, and a token can never peek at words that come after it. So when the model is sitting on "it", it hasn't seen "big" yet. In a real model, the word "big" does its own looking back, at "it" and at "trophy", and that's where the puzzle actually gets solved. I put the arrows on "it" because it's easier to picture.

A real model doesn't do this once. It does it in many parallel "heads", each free to care about different things (one might track grammar, another who-did-what), and it repeats the whole thing across dozens of layers. ERNIE 5.5 Flash, for example, has [43 transformer layers and 64 attention heads](https://ernie.baidu.com/release/ernie-5-5-flash-base/). If you want to go deeper here, Jay Alammar's [The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/), Lilian Weng's [Attention? Attention!](https://lilianweng.github.io/posts/2018-06-24-attention/) and 3Blue1Brown's [Attention in transformers, step-by-step](https://www.youtube.com/watch?v=eMlx5fFNoYc) are the three explanations that finally made it click for me.

## Why a million tokens hurts

Now we can get to the actual news.

Look back at the attention picture. To process "it", the model needed the label and information cards of every earlier token. And when it generates the *next* token, it needs them all again, plus one more. Recomputing everything from scratch every single step would be painfully slow, so models save those cards as they go. That saved pile is called the **KV cache** (K for keys, V for values). Hugging Face has a nice [walkthrough of building a KV cache from scratch](https://huggingface.co/blog/kv-cache) if you like code.

The catch is that the cache grows with every token you feed in, in every layer. At a few thousand tokens nobody cares. At a million tokens, that pile of cards becomes a serious amount of GPU memory, and on top of that every new token has to compare its question against all of them. Baidu's post says this directly: agents bring [multi-turn interactions and long contexts](https://ernie.baidu.com/release/ernie-5-5-flash-base/), and both add to compute and memory costs, so they weighed "activated compute, KV cache and long-context cost together."

My analogy: imagine reading a thousand-page novel, and before writing each new word of your book report you have to re-skim your notes on every single page. Fine for a short story. Miserable for War and Peace.

## ERNIE's trick: most layers only need the gist

This is the part of the announcement I found genuinely clever. Baidu's argument is that **most layers don't need to see every distant token individually**. A coarse summary of the far past is enough for them.

So ERNIE 5.5 Flash mixes two kinds of attention layers. In most layers it uses what it calls Heavily Compressed Attention: [each layer compresses every 128 tokens into a single cached entry](https://ernie.baidu.com/release/ernie-5-5-flash-base/), then attends to all those summaries plus a short window of recent tokens kept at full detail. Only **one layer in seven** keeps token-level access to the whole context, using a different scheme called Multi-head Latent Attention.

![Diagram titled "Two ways to look back over a long document". Top: "Full attention (like ERNIE's MLA layers)" keeps every past token in memory, drawn as a long unbroken pale blue bar; the note says memory grows one entry per token, so 1,000,000 tokens means 1,000,000 entries. Bottom: "Compressed attention (like ERNIE's HCA layers)" squashes each block of 128 tokens into one summary, drawn as five yellow blocks each labelled "128 to 1", followed by a short blue bar marked "recent window"; the note says 1,000,000 tokens becomes about 7,800 entries. A box at the bottom says ERNIE 5.5 Flash mixes both: about 1 layer in 7 keeps full token-level access and reads only its top-scoring tokens, and the rest use 128x compressed summaries. Simplified illustration, not to scale.](full-vs-compressed.png)

*Simplified and not to scale. The 7,800 figure is just 1,000,000 divided by 128, ignoring the recent window.*

It's a lot like how you'd actually remember that novel. You don't remember chapter 3 word for word. You remember "that's where the brother left town." But you keep one sharp, detailed set of notes for when you need to go back and find an exact quote.

They go one step further with those few detailed layers. Even there, the model doesn't compare against every past token. A [lightweight indexer scores past positions, and core attention is computed only over the top-k highest-scoring ones](https://ernie.baidu.com/release/ernie-5-5-flash-base/), so the cost of that main attention step for each new token stays constant as the context grows (the quick scoring pass still looks at everything, but it's cheap). In my novel analogy, it's checking the index at the back of the book first, then only flipping to the handful of pages that look relevant.

Does throwing away all that detail hurt? According to Baidu's own numbers, not much. They write that [although 37 of the 43 layers attend over a sequence compressed 128x, the six full-context layers are enough to keep performance strong on their six long-context benchmarks](https://ernie.baidu.com/release/ernie-5-5-flash-base/). Those are Baidu's self-reported results comparing base models, so I'd wait for independent testing before getting too excited. But the idea is sound and it's easy to see why it saves so much memory.

## The other number: 280B parameters, 14B at a time

One more piece of the headline, since it's the other thing everyone quotes. ERNIE 5.5 Flash is a **Mixture-of-Experts** model. Instead of one giant block of neurons that every token passes through, each layer has a crowd of smaller "expert" blocks, plus a router that picks a few of them for each token. ERNIE has [512 routed experts per layer and picks the top 10, plus 1 shared expert](https://ernie.baidu.com/release/ernie-5-5-flash-base/) that's always on.

So the model holds 280 billion parameters of knowledge, but any single token only travels through about 14 billion of them. Think of a big hospital. It employs hundreds of specialists, but you only see the two or three you need. The idea of mixing experts is older than deep learning, but the version big language models use today goes back to Google's 2017 paper on the [sparsely-gated Mixture-of-Experts layer](https://arxiv.org/abs/1701.06538). Baidu's twist is using several routers instead of one to decide which experts to call, because they found [a single router's scores correlate only weakly with how useful each expert actually is](https://ernie.baidu.com/release/ernie-5-5-flash-base/).

## What I make of it

Here's my honest take. A million-token context is not new as a marketing number. What's interesting about this release is how openly it treats long context as a cost problem and not a bragging right. Almost every design decision in the post is about spending memory where it matters and saving it everywhere else.

That matters for normal people more than it sounds. The "AI agent" stuff everyone is building right now (models that read your whole codebase, or a stack of contracts, or a week of chat history, then take actions) lives or dies on long context being cheap. It's not a coincidence that a day earlier, Tencent's [Hy4 announcement](https://www.tencent.com/tencent-launches-hy4-joining-the-ranks-of-the-worlds-leading-open-source-ai-models/) also talked up long-context comprehension and "long-horizon agentic tasks." Everyone is racing toward the same wall.

It's also a base model with open weights, which means researchers and smaller companies can study and fine-tune it without spending the money to pre-train something of this size themselves. That's exactly the pitch Baidu makes: they hope it [spares more developers the cost of large-scale pre-training](https://ernie.baidu.com/release/ernie-5-5-flash-base/). Whether people actually build on it, and whether the benchmarks hold up outside Baidu's own harness, we'll find out over the next few weeks.

And a caveat I want to be upfront about. Being able to *accept* a million tokens and being able to *use* them well are different things. Compression means the model is, by design, remembering most of your document as a blurry summary. For "what's this contract about?" that's probably fine. For "find the one clause on page 412 that contradicts page 3," it depends heavily on those few detailed layers doing their job. I'd test it on my own long documents before trusting it.

Still, I came away from this announcement with something I didn't expect: a better feel for how *all* of these models work. Tokens go in. Each one asks the others a question, gathers up a blend of answers, and passes it to the next layer. At the end, out comes a guess for what comes next. Everything else, including million-token tricks and hospitals full of experts, is about doing that loop faster and cheaper.

If there's a concept you'd like me to break down next, tell me. I'm keeping a list.

## Sources

**The news**

- Baidu ERNIE, "ERNIE 5.5 Flash Base" (November 5, 2026): <https://ernie.baidu.com/release/ernie-5-5-flash-base/>
- Hugging Face, baidu/ERNIE-5.5-Flash-Base model card: <https://huggingface.co/baidu/ERNIE-5.5-Flash-Base>
- Tencent, "Tencent Launches Hy4, Joining the Ranks of the World's Leading Open-Source AI Models" (November 4, 2026): <https://www.tencent.com/tencent-launches-hy4-joining-the-ranks-of-the-worlds-leading-open-source-ai-models/>

**Papers**

- Vaswani et al., "Attention Is All You Need" (2017): <https://arxiv.org/abs/1706.03762>
- Sennrich, Haddow and Birch, "Neural Machine Translation of Rare Words with Subword Units" (2015): <https://arxiv.org/abs/1508.07909>
- Shazeer et al., "Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer" (2017): <https://arxiv.org/abs/1701.06538>
- Ernest Davis (NYU), "The Winograd Schema Challenge" collection: <https://cs.nyu.edu/~davise/papers/WinogradSchemas/WS.html>

**Explainers I learned from**

- Jay Alammar, "The Illustrated Transformer": <https://jalammar.github.io/illustrated-transformer/>
- Jay Alammar, "How GPT3 Works - Visualizations and Animations": <https://jalammar.github.io/how-gpt3-works-visualizations-animations/>
- Lilian Weng, "Attention? Attention!": <https://lilianweng.github.io/posts/2018-06-24-attention/>
- Andrej Karpathy, "Let's build GPT: from scratch, in code, spelled out." (YouTube): <https://www.youtube.com/watch?v=kCc8FmEb1nY>
- 3Blue1Brown, "Attention in transformers, step-by-step | Deep Learning Chapter 6" (YouTube): <https://www.youtube.com/watch?v=eMlx5fFNoYc>
- Hugging Face, "KV Cache from scratch in nanoVLM": <https://huggingface.co/blog/kv-cache>

*All images in this post are original diagrams made for it.*
