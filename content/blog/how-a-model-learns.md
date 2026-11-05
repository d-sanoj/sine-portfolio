---
title: "How a model learns: gradient descent, one small correction at a time"
slug: how-a-model-learns
date: 2026-11-03
description: "Prediction is a frozen model answering. Learning is the model changing. Here's a plain-language tour of loss, parameters, gradients, learning rates, mini-batches, and generalization."
tags: [ai, explainer, machine-learning, optimization, training]
cover: cover.png
coverAlt: "Title card reading 'How a model learns' with the subtitle 'Gradient descent, one small correction at a time' and the line 'Loss, parameters, gradients, and why tiny steps beat giant guesses', over a row of grey sine waves with one yellow wave highlighted."
---

![Title card reading "How a model learns" with the subtitle "Gradient descent, one small correction at a time" and the line "Loss, parameters, gradients, and why tiny steps beat giant guesses", over a row of grey sine waves with one yellow wave highlighted.](cover.png)

When people say a model "learned" something, it sounds mysterious. It isn't magic, and it isn't the same thing as the model answering your question. Answering is **prediction**: freeze the knobs, run the input through, read the output. Learning is the other loop: look at how wrong the output was, figure out which way to twist each knob, and twist them a little.

That twisting process, for almost every neural network you hear about, is some flavor of **gradient descent**. The idea is older than computers — Augustin Cauchy described walking downhill along derivatives in an 1847 note on solving systems of equations ([Méthode générale pour la résolution des systèmes d'équations simultanées](https://www.probabilityandfinance.com/pulskamp/Cauchy/Orbits/1847%20CR%20536%28383%29.pdf), *Comptes Rendus* 25:536–538). Modern deep learning is that idea, run millions of times, on a loss that measures "how wrong," with gradients computed by backpropagation.

This post stays on the learning loop. If you've ever wondered what a "learning rate" actually is, or why training talks about batches, this is the mental model I use.

## Prediction is not learning

I want to put this on a sticky note before anything else, because chat demos blur the two.

![Diagram titled "Prediction and learning are different loops". Left panel: Prediction (forward) — input plus current parameters produce an output; parameters stay frozen; this is what happens when you ask ChatGPT a question. Right panel: Learning (training) — compare output to a target, measure loss, compute gradient, nudge parameters; parameters change; repeat on many examples.](predict-vs-learn.png)

When you send a prompt to a finished chatbot, the weights are not updating. The system is doing a forward pass with a fixed parameter vector. Training — the weeks of GPU time that produced those weights — was a separate process that *did* update parameters, using labeled or self-supervised objectives, over and over.

Goodfellow, Bengio, and Courville make a related point in [*Deep Learning*](https://www.deeplearningbook.org/) (Chapter 8): training a model is related to classical optimization, but it is not the same as minimizing a known closed-form function once and for all. We care about performance on *new* data, and we usually only see a sample of the data-generating process.

So: **prediction uses parameters; learning changes parameters.** Everything below is about the second sentence.

## The pieces: parameters, loss, and "wrong"

A model is a function with knobs. Call the knobs **parameters** and write them as a big vector `w` (weights, biases, and whatever else is trainable). For a tiny linear model predicting house price from size, `w` might be two numbers. For a large language model, `w` is billions of numbers. The geometry is the same; only the dimension changes.

You also need a score for "how wrong." That score is the **loss** (also called cost or objective), written `L(w)`. Lower is better.

- For regression, a common choice is mean squared error: average of `(prediction − target)²`.
- For classification, a common choice is cross-entropy between the predicted probabilities and the true label.
- For language models during pre-training, the loss is usually the negative log probability of the next token — a close cousin of cross-entropy — averaged over tokens.

The loss is not the thing users see. Users see answers. The loss is the training-time critic. Rumelhart, Hinton, and Williams, in their 1986 Nature letter on backpropagation, describe the procedure as repeatedly adjusting weights "so as to minimize a measure of the difference between the actual output vector of the net and the desired output vector" ([Learning representations by back-propagating errors](https://www.nature.com/articles/323533a0)).

One useful rephrase: **learning is optimization of the loss with respect to the parameters, using data.**

## The landscape and the slope

If you could plot loss against a single parameter, you would get a curve. With two parameters, a surface. With millions, a landscape you cannot draw — but you can still stand on it and feel the slope under your feet.

![Diagram titled "A loss landscape (cartoon, 1 parameter)". A wavy blue curve plots loss L against parameter w, with a yellow point on the downhill side of a hump, a tangent line labelled "gradient ≈ slope here", and an arrow "step this way" pointing down the slope toward the valley. Caption notes the curve is illustrative.](loss-curve.png)

The **gradient** `∇L(w)` is the vector of partial derivatives: how much the loss would change if you nudged each parameter a tiny bit. In one dimension it is just the slope. In high dimensions it points in the direction of **steepest ascent** — the fastest way *uphill*.

That last word matters. We want to go down. So we step the other way.

## The update rule

Here is the entire algorithm in one line, the way every textbook writes it:

![Diagram titled "The update rule in one line". A yellow-outlined box shows w ← w − η · ∇L(w), with the plain-language gloss "new params = old params − learning rate × gradient", plus notes that η is step size and the minus sign walks downhill.](update-rule.png)

- `w` — current parameters  
- `∇L(w)` — gradient of the loss at those parameters  
- `η` (eta) — **learning rate**, a positive scalar that says how big a step to take  
- The minus sign — move opposite the gradient  

Cauchy's 1847 note already has the essence: from a point, move against the derivatives so the objective decreases, choosing a step size small enough (or optimal along the line). A clear modern walkthrough of that lineage is in Lemaréchal's historical note [Cauchy and the Gradient Method](https://ems.press/content/book-chapter-files/27368?nt=1).

Neural nets add one crucial engineering fact: you can compute `∇L(w)` efficiently with **backpropagation**, applying the chain rule backward through the model's computation graph. That is what Rumelhart, Hinton, and Williams popularized for multilayer networks in 1986, and what every deep-learning framework automates today as reverse-mode automatic differentiation. The [Deep Learning](https://www.deeplearningbook.org/) book (Chapter 6) treats backprop as the practical engine behind gradient-based learning for deep nets.

You do not need to hand-derive millions of partial derivatives. You need a differentiable loss and a differentiable model. The library gives you the gradient vector; gradient descent tells you what to do with it.

## Watch one parameter take a walk

Let's make the abstract concrete with a **toy** one-parameter problem. The numbers below are invented for the animation. They are not logs from training a real network.

![Animated diagram titled "Gradient descent: walk downhill in parameter space". A blue loss curve is shown with a yellow particle starting high on the left and stepping toward a valley on the right. A side panel shows illustrative values of w and L updating as steps accumulate: w moves from 0.18 to about 0.60 and L falls from 0.47 to 0.04.](descent-steps.gif){poster=descent-steps-poster.png}

*A still version is available: [poster frame](descent-steps-poster.png).*

**What the animation shows, step by step:**

1. Start with a random guess for the parameter `w`.
2. Measure the loss `L(w)` — how wrong the model is with the current knobs.
3. Compute the gradient: which way is uphill on this cartoon curve?
4. Take a small step opposite the gradient, scaled by the learning rate `η`.
5. Repeat. The marker slides toward a valley; the reported toy loss falls.

That is learning, in miniature. A real run does the same thing in a space with millions of axes at once. You cannot watch all the axes. You watch the loss go down (and, separately, you watch metrics on held-out data — more on that later).

3Blue1Brown's [gradient descent](https://www.youtube.com/watch?v=IHZwWFHWa-w) video is still the best visual companion I know if you want the calculus intuition without a classroom.

## Learning rate: the most human hyperparameter

The learning rate `η` is boring to define and dramatic in practice.

- **Too small:** each correction is tiny. Training crawls. You may stop before the model gets good, or burn money waiting.
- **Too large:** you overshoot the valley. Loss bounces. Sometimes it explodes into `NaN`.
- **About right:** loss trends down, with noise that looks survivable.

![Animated diagram titled "Learning rate and mini-batches change the walk". First three panels compare paths for η too small, η too large, and η just right on the same cartoon valley. Then panels contrast full-batch gradients (smooth, expensive) with mini-batch gradients (noisy, cheap).](lr-and-batches.gif){poster=lr-and-batches-poster.png}

*A still version is available: [poster frame](lr-and-batches-poster.png).*

**What the animation shows, step by step:**

1. `η` too small — many short hops; progress is slow.
2. `η` too large — the path overshoots and zigzags.
3. `η` in a sensible range — steady movement into the valley.
4. Full-batch gradient — average over the entire training set, then step (accurate, costly).
5. Mini-batch gradient — average over a small random slice, then step (noisy, cheap; the usual choice).

There is no universal best `η`. It depends on the model, the loss scale, and how parameters are initialized. In practice people use schedules (start larger, decay later) or adaptive methods (Adam and friends) that adjust effective step sizes per parameter. Those are elaborations on the same descent idea, not a different philosophy. Chapter 8 of [*Deep Learning*](https://www.deeplearningbook.org/) surveys this family under "Optimization for Training Deep Models."

## Why mini-batches exist

If the training set has a million examples, computing the exact gradient of the average loss means a forward and backward pass on all million before every tiny update. That is **full-batch** gradient descent. Mathematically tidy. Computationally painful.

**Stochastic gradient descent (SGD)** estimates the gradient from one random example (classic SGD) or from a **mini-batch** of tens to thousands of examples (the practical default). The estimate is noisy. Amazingly, that is often fine — and for large datasets, it is essential.

Léon Bottou's chapter [Stochastic Gradient Descent Tricks](https://leon.bottou.org/publications/pdf/tricks-2012.pdf) (in *Neural Networks: Tricks of the Trade*, 2012) is the clear-eyed reference I keep recommending. His punchline matches modern experience: when data is huge and compute is the bottleneck, SGD-style methods are not a sad approximation of "real" gradient descent; they are the right tool. He also hammers practical details people skip: shuffle your data; monitor training *and* validation error; do not fetishize driving training loss to zero.

Mini-batches have a second, more mundane benefit: they fit GPU parallelism. One example underuses the hardware. A batch of 32 or 256 turns into nice matrix multiplies.

So when a training log says `batch_size=128`, read it as: **each parameter update was based on the average gradient from 128 examples, not the whole dataset.**

## Generalization: the plot twist

Here is the part that separates machine learning from pure optimization.

You can drive training loss almost to zero by memorizing the training set — especially with an oversized model. That can look like triumph in the training curve and fail in the real world.

![Diagram titled "Fitting the training set is not the goal". Left: train loss can go very low by memorizing examples the model has seen. Right: test or validation loss on held-out examples is the score that matters; when train falls but test rises, you are overfitting.](generalization.png)

**Training loss** measures error on data the optimizer is allowed to see (and, in the usual setup, to update on).

**Validation / test loss** measures error on data held out of the parameter updates. That is the proxy for "will this work tomorrow on new emails, new images, new prompts?"

When train loss falls and validation loss rises, the usual diagnosis is **overfitting**. Regularization (weight decay, dropout, early stopping, data augmentation, more data) is a set of tactics for preferring solutions that generalize. Chapter 7 of [*Deep Learning*](https://www.deeplearningbook.org/) is the standard tour.

This is also why "the loss went down" is not the same sentence as "the product got better." Loss is the training critic. Product quality needs the held-out critic — and eventually, humans.

## A worked micro-example (fully illustrative)

Suppose a cartoon model predicts `ŷ = w · x` with one parameter `w`, and we use squared error on a single example `(x=2, y=10)`.

1. Start at `w = 1.0`. Prediction: `2.0`. Loss: `(2 − 10)² = 64`.
2. Gradient of loss w.r.t. `w`: for `L = (wx − y)²`, the derivative is `2(wx − y)·x = 2(2 − 10)·2 = −32`.
3. Pick `η = 0.01`. Update: `w ← 1.0 − 0.01·(−32) = 1.32`.
4. New prediction: `2.64`. New loss: `(2.64 − 10)² ≈ 54.0` — lower.

Again: these numbers are a blackboard example, not a training run. But the algebra is exactly what a framework does, automatically, for every parameter at once.

## What this does *not* explain (yet)

Gradient descent answers "how do the knobs move?" It does not, by itself, answer:

- Where the training data comes from, or whether it is biased  
- How architecture choices (convolutions, attention, residual links) shape the landscape  
- How reinforcement learning assigns credit when there is no direct target vector  
- Why some large models suddenly get better at a skill after a certain scale  

Those are neighboring chapters. The through-line still helps: somewhere, a scalar loss is being reduced by following an estimated gradient.

## The picture I keep

Learning is not the model "understanding" in the human sense. Learning is:

1. Define a differentiable notion of wrong (`L`).  
2. Measure how wrong you are on some data.  
3. Compute how each parameter contributed to that wrongness (`∇L`).  
4. Nudge parameters against that direction by a cautious amount (`η`).  
5. Repeat until held-out performance stops improving in a way you trust.

Prediction is what you do when you stop nudging and just run the function.

Once you see those as two loops, a lot of ML conversation gets quieter. "The model said X" is prediction. "We trained for two more epochs" is learning. "Validation perplexity ticked up" is generalization complaining. Same system — different verbs.

## Sources

**Primary and classical**

- A. Cauchy, "Méthode générale pour la résolution des systèmes d'équations simultanées," *Comptes Rendus Acad. Sci. Paris* 25:536–538 (1847). English translation PDF: <https://www.probabilityandfinance.com/pulskamp/Cauchy/Orbits/1847%20CR%20536%28383%29.pdf>
- C. Lemaréchal, historical discussion of Cauchy's gradient method (EMS book chapter PDF): <https://ems.press/content/book-chapter-files/27368?nt=1>
- Rumelhart, Hinton, Williams, "Learning representations by back-propagating errors," *Nature* 323:533–536 (1986): <https://www.nature.com/articles/323533a0> (DOI: <https://doi.org/10.1038/323533a0>)

**Modern references**

- Goodfellow, Bengio, Courville, *Deep Learning* (MIT Press) — especially Ch. 5 (ML basics / SGD), Ch. 6 (backprop), Ch. 7 (regularization), Ch. 8 (optimization): <https://www.deeplearningbook.org/>
- Léon Bottou, "Stochastic Gradient Descent Tricks," in *Neural Networks: Tricks of the Trade* (2012): <https://leon.bottou.org/publications/pdf/tricks-2012.pdf>

**Visual explainer**

- 3Blue1Brown, "Gradient descent, how neural networks learn" (YouTube): <https://www.youtube.com/watch?v=IHZwWFHWa-w>

*All images in this post are original diagrams made for it. Numeric values in the animations and the one-parameter worked example are illustrative toys, not measurements from a real training run.*
