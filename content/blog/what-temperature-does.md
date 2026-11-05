---
title: What temperature does
date: 2026-11-04
description: Temperature is how sharply the model picks its next word.
---

When a model writes, it does not always choose the most likely next word. Temperature is the dial that decides how often it takes a chance.

# A sharper or a softer choice

The model ends each step with a score for every token it could write next. A low temperature makes the high scores even higher, so the usual word wins more often. A high temperature flattens the scores, so less likely words get a turn.

- At a low temperature the writing is steady and a little plain.
- At a high temperature it wanders, and it can stop making sense.
- Near zero it always takes the top word.

# In one line

```python
next_word = sample(scores, temperature=0.7)
```

`scores` is one number per token, and a higher number means more likely. The dial is not a heat you can feel. It is just the name the field kept.
