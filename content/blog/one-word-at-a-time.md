---
title: One word at a time
date: 2026-11-03
description: A model guesses the next piece of text, then feeds that guess back in.
---

A model does not plan the whole sentence and then type it. It guesses one token, adds that token to the input, and guesses again.

# The loop

1. Read the tokens so far.
2. Score every token that could come next.
3. Pick one. Temperature decides how bold that pick is.
4. Stick that token on the end, and go back to the start.

Stop when it emits a special end token, or when it hits a length you set.

# Why this matters

The model can paint itself into a corner, because an early guess is never revised. That is also why a longer answer can drift. Each new word only has to fit what is already on the page, not a plan made at the start.

If you want the mechanism under the guess, the note on [how a model reads a word](how-a-model-reads-a-word) is the place to start.
