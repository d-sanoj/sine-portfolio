---
title: "I decoded all 100,277 tokens in GPT-4's vocabulary. Most of it is English."
slug: inside-gpt-tokenizer-vocabulary
date: 2026-11-14
description: "I opened up the tokenizer behind GPT-4, decoded every entry in its vocabulary, and measured what the same sentence costs in nine languages and the same facts cost in five formats."
tags: [ai, tokenizers, llm, measurement, multilingual]
cover: cover.png
coverAlt: "Title card reading 'I decoded all 100,277 tokens in GPT-4's vocabulary' with the subtitle 'Most of it is English — and that decides what AI costs you, in tokens, in languages, in formats', and a third line reading '69,868 of the entries are plain ASCII words. Devanagari gets 23.', over a row of grey sine waves with one yellow wave highlighted."
---

![Title card reading "I decoded all 100,277 tokens in GPT-4's vocabulary" with the subtitle "Most of it is English — and that decides what AI costs you, in tokens, in languages, in formats", and a third line reading "69,868 of the entries are plain ASCII words. Devanagari gets 23.", over a row of grey sine waves with one yellow wave highlighted.](cover.png)

Everything an AI service charges you for is counted in tokens: the price, the size of the context window, the speed of the reply. The token is the unit of the whole business, and I realised I had never actually looked inside one. So this week I did the most literal thing I could think of. I took the tokenizer behind GPT-4, decoded every single entry in its vocabulary, and counted what is in there. Then I ran the same sentence through it in nine languages, and the same facts through it in five formats, to see what the vocabulary does to real text.

All the numbers below are from my own runs. The script that produced them, the data it counted, and its full output are linked at the end of the post, so you can rerun every number. The two big claims from other people's research — that the same text costs far more tokens in some languages than in English — check out against my numbers, and I'll say where my sample is too small to stand on its own.

## What a vocabulary actually is

A language model never sees your words. It sees tokens: chunks of text from a fixed list, the vocabulary. The list is built by a method borrowed from data compression called byte-pair encoding, from a [2015 paper on translating rare words with subword units](https://arxiv.org/abs/1508.07909). You start with single characters and keep merging the pairs that show up together most often, until the list is the size you want. If you want the longer version of that story, my earlier post on [how an AI reads a million tokens](/blog/how-ai-reads-a-million-tokens/) covers tokens and attention from the bottom up.

The practical consequence is simple and easy to miss: the vocabulary is a fossil of the text the tokenizer was trained on. Whatever showed up a lot got merged into big, efficient pieces. Whatever barely showed up never got merged at all, and has to be spelled out byte by byte. So the contents of the list decide, before any model is involved, how many tokens your text becomes — and therefore what it costs and how much of it fits in a prompt.

I used [tiktoken](https://github.com/openai/tiktoken), OpenAI's open-source tokenizer library, and two of its encodings: `cl100k_base`, the tokenizer behind GPT-3.5 Turbo and GPT-4, and `o200k_base`, the one behind GPT-4o. The first has 100,277 entries in tiktoken's table, special tokens included. The second has 200,019. I decoded every entry in both, classified each one by what it contains, and counted.

## The census: 100,277 entries, and what they are

Here is the whole of `cl100k_base`, the GPT-4 tokenizer, sorted into buckets:

| What's in the entry | Entries | Share |
|---|---:|---:|
| Pure ASCII letter-runs (" the", "ing", "Token") | 69,868 | 69.7% |
| ASCII fragments with letters mixed in ("://", ".com", "();") | 18,396 | 18.3% |
| Punctuation and symbols | 5,424 | 5.4% |
| Non-ASCII text of any kind | 4,249 | 4.2% |
| Digit-runs ("123", " 42") | 1,110 | 1.1% |
| Whitespace-only | 441 | 0.4% |
| Partial-byte fragments (not valid text on their own) | 789 | 0.8% |

Seven out of ten entries are plain ASCII letter sequences. Fewer than one in twenty contains any character outside ASCII at all. And the typical entry is short: the most common lengths are 4 and 5 bytes, which is a whole English word fragment with its leading space attached.

The non-ASCII bucket is where it gets stark. This is the count of entries containing each script in the GPT-4 tokenizer:

![Bar chart titled "Non-English scripts in GPT-4's vocabulary". Latin extended has 1,442 entries, CJK characters 1,004, Cyrillic 729, other scripts 548, Hangul 281, Arabic 103, Thai 58, Greek 44, Devanagari 23, Hebrew 20, Bengali 6, and Tamil 3. A note reads: entries can contain more than one script, so the bars overlap slightly. The total non-ASCII bucket is 4,249 entries out of 100,277.](vocab-census.png)

*An entry mixing scripts is counted once per script it contains, so the bars add to slightly more than the 4,249-entry non-ASCII bucket. Counts are from decoding every entry of `cl100k_base` with tiktoken.*

Read the bottom of that chart slowly. The tokenizer behind GPT-4 has **23 entries containing Devanagari** — the script Hindi is written in, spoken by roughly 600 million people — and **3 entries containing Tamil**. Arabic, spoken by about 380 million people, gets 103. The whole of the non-Latin world shares 4,249 entries out of 100,277, while English word fragments alone take nearly 70,000.

Two details in the table deserve a word, because they are not bugs. The 789 partial-byte fragments exist on purpose: the tokenizer starts from raw bytes, so any text at all can be encoded even if none of its characters appear in the vocabulary — it just falls back to spelling the text out byte by byte. And the 1,110 digit entries are the reason numbers behave oddly: the vocabulary holds every one-, two- and three-digit run — 10 + 100 + 1,000, exactly 1,110 — but no space-prefixed versions, so a space before a number is a token of its own. A number is therefore chopped into groups of at most three digits. `1000000` becomes `100` `000` `0`; `1,000,000` becomes five tokens, because the commas cost tokens too. My earlier post noted the same three-digit group size in ERNIE's tokenizer — though ERNIE groups right-to-left and GPT left-to-right; it is a common design choice, and it is why a date like `2026-11-14` costs six tokens and a phone number nine.

## Then GPT-4o doubled the vocabulary. Who won?

OpenAI's newer tokenizer, `o200k_base`, has roughly twice the entries: 200,019. The interesting question is where the extra 100,000 went.

| Script | Entries in GPT-4's tokenizer | Entries in GPT-4o's tokenizer |
|---|---:|---:|
| Devanagari (Hindi, Marathi, Nepali) | 23 | 3,963 |
| Tamil | 3 | 962 |
| Bengali | 6 | 2,104 |
| Arabic | 103 | 8,044 |
| Cyrillic | 729 | 14,211 |
| CJK characters | 1,004 | 8,271 |
| Thai | 58 | 1,545 |
| Hebrew | 20 | 2,366 |
| Non-ASCII entries overall | 4,249 (4.2%) | 69,557 (34.8%) |

About two-thirds of the growth went to non-English scripts. Devanagari went from 23 entries to 3,963 — a 172-fold increase. The share of the vocabulary that is non-ASCII rose from about 4% to about 35%. English word fragments are still the biggest single bucket, at 106,934 entries, but they are no longer the overwhelming majority.

That is a real improvement, and it shows up directly in what text costs. But the new list is still lopsided: Tamil's 962 entries are a rounding error next to English's 106,934, and some scripts are still barely there. The question is how much of that unevenness survives into the bill.

## The same sentence, nine languages, two tokenizers

To measure that, I took Article 1 of the Universal Declaration of Human Rights — "All human beings are born free and equal in dignity and rights…" — in nine languages, from the [UDHR in XML project](https://github.com/unicode-org/udhr), and counted the tokens in each. Same meaning, professionally translated, only the language changes. Here is what one article costs:

| Language | Tokens, GPT-4 tokenizer | Tokens, GPT-4o tokenizer | Premium vs English, GPT-4o |
|---|---:|---:|---:|
| English | 33 | 33 | 1.00× |
| Spanish | 44 | 38 | 1.15× |
| French | 50 | 41 | 1.24× |
| Chinese (Simplified) | 50 | 35 | 1.06× |
| Arabic | 88 | 44 | 1.33× |
| Hindi | 182 | 54 | 1.64× |
| Thai | 133 | 62 | 1.88× |
| Japanese | 93 | 72 | 2.18× |
| Amharic | 305 | 206 | 6.24× |

![Grouped bar chart titled "The same article in nine languages". For each language there are two bars, one for the GPT-4 tokenizer and one for GPT-4o. English is 33 tokens in both. Hindi falls from 182 to 54. Amharic falls from 305 to 206 and is still the tallest bar by far. A note reads: Article 1 of the Universal Declaration of Human Rights, counted with tiktoken.](language-premium.png)

*Article 1 of the Universal Declaration of Human Rights, counted with tiktoken. My sample is one article in nine languages; the direction matches the large-scale studies cited below.*

The improvement is dramatic where the vocabulary grew most. Hindi fell from 182 tokens to 54 — the same words, 3.4 times fewer tokens, because the new vocabulary finally has Devanagari pieces to build them from. Thai fell by more than half, Arabic by exactly half. Spanish and French barely moved, because they were already cheap: Latin script was well covered in both lists. One cleaning step to disclose: the Thai text in the dataset carries an editor's bracketed alternative spelling, which I removed before counting; with it left in, Thai is 148 tokens on the GPT-4 tokenizer and 72 on GPT-4o's.

But look at the last row. Amharic still costs 206 tokens for a sentence English says in 33 — more than six times as much. And the raw character counts explain why. In the GPT-4 tokenizer, English averages 5.15 characters per token; Amharic averages 0.34 — roughly three tokens per character. An Amharic character is three bytes in UTF-8, and with no Ethiopic entries in the vocabulary at all, the tokenizer has nothing to merge them into, so it pays one token per byte.

The picture below is the first sentence of that article, split the way each tokenizer actually splits it. English comes apart into 13 tokens — 12 words and a full stop. Hindi, on the GPT-4 tokenizer, comes apart into 85 fragments, most of them a single character or less — 26 of them are single bytes:

![Animated diagram titled "The same sentence, split two ways". The English sentence "All human beings are born free and equal in dignity and rights." is shown as 13 boxes, one per token. Below it, the Hindi translation is shown as 85 narrow slivers on the GPT-4 tokenizer, then re-splits into 25 wider boxes on the GPT-4o tokenizer. A caption reads: 13 tokens in English, 85 in Hindi on GPT-4, 25 in Hindi on GPT-4o.](token-split.gif){poster=token-split-poster.png}

*The first sentence of UDHR Article 1. English: 13 tokens on both tokenizers. Hindi: 85 tokens on the GPT-4 tokenizer, 25 on GPT-4o's. The Hindi token text is not labelled box by box because on the older tokenizer most tokens are a single character or less, not words. A still version is available: [poster frame](token-split-poster.png).*

**What the animation shows, step by step:**

1. The English sentence appears, split into 13 boxes — one per token, most of them whole words.
2. The Hindi sentence appears below it, split the way the GPT-4 tokenizer splits it: 85 narrow slivers, most of them a single character or less.
3. The Hindi row re-splits the way the GPT-4o tokenizer splits it: 25 boxes, most of them whole syllables and words.
4. A final line gives the counts: 13, 85, 25.

My sample is small — one article, nine languages — so I checked it against the studies that did this properly. In [Language Model Tokenizers Introduce Unfairness Between Languages](https://arxiv.org/abs/2305.15425) (Petrov and colleagues, NeurIPS 2023), the same text measured over 2,000 professionally translated sentences needed about 1.6 times the tokens in Italian, 3 times in Arabic, and up to 15 times in Shan, on the ChatGPT/GPT-4 tokenizer. My numbers land in the same places: my French premium is 1.52×, my Arabic 2.67×. And in [Do All Languages Cost the Same?](https://arxiv.org/abs/2305.13707) (Ahia and colleagues, EMNLP 2023), the authors ran 22 languages through a commercial API and found speakers of many of them were overcharged while getting poorer results — often in the regions where the API was least affordable to begin with.

Put in plain terms: a thousand tokens buys you about 5,150 characters of English. On the GPT-4 tokenizer it buys you about 340 characters of Amharic. The same prompt, the same question, the same answer — and one user gets a fifteenth of the room. GPT-4o raises that to about 500 characters — about one and a half times as much — which is progress and still a long way from parity.

## The formatting tax: the same facts, five ways

The vocabulary does not only decide what languages cost. It decides what *formats* cost, because the same information can be spelled out in very different numbers of tokens. I took eight products — a name, a price, and a stock count each — and wrote them five ways: as sentences, as JSON, as a Markdown table, as a Python list of dicts, and as CSV. Same eight facts every time. Here is what each version costs on the GPT-4o tokenizer:

| Format | Tokens |
|---|---:|
| CSV | 81 |
| Markdown table | 110 |
| Plain sentences | 133 |
| JSON | 173 |
| Python list of dicts | 184 |

![Bar chart titled "The same eight products, five formats". CSV costs 81 tokens, Markdown table 110, plain sentences 133, JSON 173, and a Python list of dicts 184. A note reads: eight products, each with a name, a price, and a stock count; counted with the GPT-4o tokenizer.](formatting-tax.png)

*Eight products, each with a name, a price and a stock count, written five ways and counted with the GPT-4o tokenizer.*

CSV costs 81 tokens. The Python version costs 184 — more than double — for the same eight facts. JSON, the default format of nearly every agent and API in the world, costs 173, about 30% more than plain sentences and more than twice CSV. The Markdown table beats the sentences by 17%.

Why? Look at what the formats repeat. The sentences repeat "costs" and "and we have" and "in stock" eight times — words that are cheap individually but add up. JSON repeats `"name":`, `"price":`, `"stock":`, braces and quotes on every row. CSV and the table say the labels once and then let the positions do the work. The vocabulary rewards structure that repeats compactly and punishes structure that spells the same words out again.

The same pattern shows up in the other places agents spend tokens. A small Python function I tested costs 41 tokens formatted with indentation, a docstring and spaces — and 22 tokens minified, a 46% saving for the same logic. And a tool call has a wrapper tax of its own: the payload `{"product": "Oak desk", "quantity": 2}` is 13 tokens, but wrapped in a typical function-call envelope with the tool name, an id and a type field it becomes 43 tokens. The envelope costs more than twice the actual order. If your agent makes hundreds of tool calls, that wrapper is a line item on the bill.

The animation below runs the same eight products through the formats in order, with the token count ticking as it goes:

![Animated diagram titled "Same facts, fewer tokens". Three of the eight products appear first as sentences at 133 tokens, then as JSON at 173 tokens, then as a Markdown table at 110 tokens, then as CSV at 81 tokens. A caption reads: the labels are said once in CSV; JSON repeats them on every row.](format-morph.gif){poster=format-morph-poster.png}

*The same eight products in four formats. The token count is the whole point: CSV says each label once, JSON repeats them on every row. A still version is available: [poster frame](format-morph-poster.png).*

**What the animation shows, step by step:**

1. Three of the eight products appear as plain sentences, and the counter reads 133 tokens — the count for all eight.
2. They rearrange into JSON, and the counter rises to 173 — the labels repeat on every row.
3. They rearrange into a Markdown table, and the counter falls to 110.
4. They rearrange into CSV, and the counter falls to 81. The labels are said once, and position does the rest.

## What to do about it

None of this is a reason to stop using these models. It is a reason to count before you build, because the tokenizer is part of the system you are shipping, not a detail under it.

**If you build agents or RAG pipelines:** measure the formats you actually send. For tabular data, a Markdown table or CSV is usually much cheaper than JSON or sentences carrying the same facts — on my eight products, CSV cost less than half the Python dict. Strip the formatting you do not need before text crosses the API boundary: minify code, drop the docstring, drop the indentation. And look at your tool-call envelopes: if the wrapper costs twice the payload, shorten the tool names and the ids, or batch calls. These are small savings per call, and they compound over thousands of calls.

**If you serve users who do not write in English:** measure your own corpus with the tokenizer you actually ship. The library is small — `tiktoken` plus ten lines of Python — and the number you get is the number your users pay. Expect roughly 1.1–1.6× the English token count for European languages, around 1.6× for Hindi on a modern tokenizer, and several times for languages whose scripts are still thinly covered. If you offer a fixed token budget — a free tier, a context window, a summary length — remember that the budget buys very different amounts of text in different languages.

**If you choose a model:** the tokenizer is part of the choice. A model with a larger multilingual vocabulary does not just "support" more languages; it charges their speakers less for the same words. The jump from GPT-4's tokenizer to GPT-4o's cut Hindi's cost by more than two-thirds on my sample. Ask what the tokenizer is, not just what the benchmark score is.

And a note for anyone who writes about this: the numbers above are measurements, not constants. The language premiums come from one article in nine languages — the direction matches the 2,000-sentence FLORES-200 studies, but the exact multiples will move with the text you pick. The formatting numbers come from my eight products and my exact strings; the pattern — structure beats repetition — is the durable part. The vocabulary census, on the other hand, is exact: it is the whole table, decoded entry by entry, and it will not change until someone ships a new tokenizer.

The token is the unit everything is priced in, and the unit turns out to have opinions. It thinks English is the default, that a date is six pieces, that a comma in a million is worth paying for, and that a table is cheaper than a sentence. None of that was decided by anyone, exactly. It is a fossil of what the machine was fed. But now that you know what is in the list, you can count — and once you count, you can choose.

## Sources

**The measurements (mine, run 2026-11-14)**

- OpenAI, `tiktoken` (open-source tokenizer library): <https://github.com/openai/tiktoken>
- Universal Declaration of Human Rights, Article 1, in nine languages, from the UDHR in XML project: <https://github.com/unicode-org/udhr>
- The vocabulary census, the language counts and the formatting counts were computed with tiktoken's `cl100k_base` (GPT-3.5 Turbo / GPT-4) and `o200k_base` (GPT-4o) encodings. The script that produced every number in this post, the nine UDHR texts it counted, and its full output are in the post folder: [measure-tokens.py](measure-tokens.py), [udhr-article-1.json](udhr-article-1.json), [results.json](results.json). Run the script with tiktoken installed and it reproduces every number here.

**Papers**

- Petrov, La Malfa, Torr and Bibi, "Language Model Tokenizers Introduce Unfairness Between Languages" (NeurIPS 2023): <https://arxiv.org/abs/2305.15425>
- Ahia, Kumar, Gonen, Kasai, Mortensen, Smith and Tsvetkov, "Do All Languages Cost the Same? Tokenization in the Era of Commercial Language Models" (EMNLP 2023): <https://arxiv.org/abs/2305.13707>
- Sennrich, Haddow and Birch, "Neural Machine Translation of Rare Words with Subword Units" (2015): <https://arxiv.org/abs/1508.07909>

**Background**

- My earlier post on tokens and attention: [How an AI reads a million tokens](/blog/how-ai-reads-a-million-tokens/)

*All images in this post are original diagrams made for it.*
