---
title: How a model reads a word
date: 2026-11-05
description: A word becomes a token number, and that number picks the vector the model reads.
cover: cover.png
coverAlt: Three boxes in a row. The word star points to token 1421, which points to the vector 0.2, -0.4, 0.7.
---

A language model never sees a word the way you do. It sees a row of numbers. This is the short version of how a word gets there.

# From letters to a token

Text is split into tokens. A token is sometimes a whole word and sometimes a piece of one. The word "star" might be one token. "Unhappiness" might be three: "un", "happi", "ness". The model keeps a fixed list of pieces, and every piece has a number.

![The word star points to token 1421, which points to the vector 0.2, -0.4, 0.7](pipeline.svg "A word, its token number, and the vector that number selects")

:::describe
Three rounded boxes sit in a row on a dark background, joined by yellow arrows pointing right.

1. The first box reads "star".
2. The second box reads "1421", with the small label "token".
3. The third box reads "0.2, -0.4, 0.7".
:::

# The same steps, one at a time

The picture above shows every step at once. The next picture plays them in order. The one after that is the same idea as three frames of a GIF, so you can pause it whenever you like.

![A highlight moves from the word star, to token 1421, then to its vector](steps.svg "Each step lights up, then the next")

:::describe
The animation loops through three steps. Only the highlight and the caption change.

1. The box "star" is lit, and the caption says a word becomes one token.
2. The box "1421" is lit, and the caption says the token is a number.
3. The vector box is lit, and the caption says the number picks a vector.
4. The highlight returns to "star" and the loop repeats.
:::

![Three frames of the same steps: the word star, then token 1421, then the vector 0.2, -0.4, 0.7](lookup.gif "Frame by frame: word, token, vector")

:::describe
Three frames, each held for a moment, then the GIF repeats from the start.

1. Frame one highlights the box "star".
2. Frame two highlights the box "1421".
3. Frame three highlights the box "0.2, -0.4, 0.7".
:::

# A few real splits

Table: How a small tokenizer might split three words

| Word | Tokens |
| --- | --- |
| star | star |
| cat | cat |
| unhappiness | un, happi, ness |

The commas are only there so you can see the pieces. The model does not see the commas.

# What the vector is for

Each token number picks a list of numbers, called an embedding. Similar tokens end up with similar lists, because the model learned the lists by reading a lot of text. Nobody sits and types the numbers in.

> The model does not look the word up in a dictionary. It looks a number up in a table.

Here is the whole step with that table written out by hand. `table` stands in for the real embedding table, which is enormous:

```python
table = {
    1421: [0.2, -0.4, 0.7],
}

token = 1421
vector = table[token]
```

That vector is what the rest of the model reads. Attention, the later layers, the guess of the next word: all of it starts from rows like this one.
