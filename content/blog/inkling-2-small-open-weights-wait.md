---
title: "Inkling 2 Small is here — but you can't download it yet"
slug: inkling-2-small-open-weights-wait
date: 2026-11-06
description: "Thinking Machines' new model is smaller than its predecessor and much better at long, unsupervised work — but the open weights are a week away, pending safety tests."
tags: [ai, explainer, llm, open-weights, safety, news]
cover: cover.png
coverAlt: "Title card reading 'Inkling 2 Small is here — but you can't download it yet' with the subtitle 'A smaller, smarter model, and a one-week wait for its weights', over a row of grey sine waves with one yellow wave highlighted."
---

![Title card reading "Inkling 2 Small is here — but you can't download it yet" with the subtitle "A smaller, smarter model, and a one-week wait for its weights", over a row of grey sine waves with one yellow wave highlighted.](cover.png)

Yesterday, Thinking Machines Lab released its best model yet. It's called Inkling 2 Small, and on the headline score it is a big jump: 31 on the Artificial Analysis Intelligence Index, as reported in [the announcement](https://thinkingmachines.ai/news/inkling-2-small/), against 12 for the first Inkling model from July and 13 for its smaller sibling. It is better at coding, at reading charts and documents, and at the kind of long, multi-step work where most models fall apart.

There is a catch, and it is the most interesting part of the story. You can't download it. The model is only available through Thinking Machines' own platform, [Tinker](https://tinker-docs.thinkingmachines.ai/tinker/models/models_and_pricing/), and the company says the full weights will follow under an Apache 2.0 license "next week" — after outside safety testing and red-teaming is finished. Next week is a plan, not a promise. If the testing finds something, the date slips.

So this post is about two things: what the model is, and why a lab that believes in open weights is holding this one back. Both halves are worth understanding, because the second one is really a story about what happens when a model gets good enough to work unsupervised for hours at a time.

One naming warning first, because the lab did not make this easy. In July it released a model called **Inkling-Small** (with a hyphen). This new one is **Inkling 2 Small** — the first release of a second generation. Different model, confusingly similar name.

## First, what is this thing?

Inkling 2 Small is a Mixture-of-Experts model, the same architecture idea as the ERNIE model in [yesterday's post](https://sanoj.dev/blog/how-ai-reads-a-million-tokens/). Instead of one giant network that every token passes through, each layer holds a crowd of smaller "expert" networks, and a router picks a few of them for each token. The numbers here: 594 billion parameters in total, but only about 17 billion active for any single token — under 3% of the model doing the work at any moment. In each of its 48 layers, each token is routed to 8 of 384 experts.

![Animated diagram titled "Mixture of experts: 8 of 384, per token". A token box labelled "the" feeds into a box labelled "Router". Below, a grid of small squares represents 384 experts; eight of them light up in yellow one by one while the rest stay grey. A caption reads: 594B parameters in total, about 17B active per token.](moe-routing.gif){poster=moe-routing-poster.png}

*Each token is sent to 8 of 384 experts. The expert count and routing are from the model card; the grid is a cartoon — 384 real experts would be far too many to draw one by one. A still version is available: [poster frame](moe-routing-poster.png).*

**What the animation shows, step by step:**

1. A token — the word "the" — arrives at a layer of the model.
2. The router scores all 384 experts for this token and picks the best 8.
3. The chosen experts light up in yellow; the other 376 stay grey and sit this one out.
4. Only those 8 experts process the token, so the cost of answering stays close to a 17-billion-parameter model even though the model holds 594 billion parameters of knowledge.

It also takes image inputs, through a 292-million-parameter vision encoder, and it has a variable-effort setting — you can dial how long it thinks before answering. The context window is listed at 1 million tokens, the same headline as yesterday's ERNIE post, though there is a wrinkle worth knowing: on Tinker today the model is served at 64,000 tokens by default, with a 256,000-token tier. The 1M figure is the model's supported context window per its model card, not what you get by default on the hosted endpoint.

## Smaller, and much better

Here is the part that surprised me. Inkling 2 Small is *smaller* than the first Inkling, which had 975 billion total parameters and 41 billion active. The new model has roughly 40% fewer total parameters and less than half the active ones — and it scores far higher. Artificial Analysis puts the first Inkling at 12 on its index and Inkling 2 Small at 31. (Thinking Machines' own benchmark table, compiled against the previous version of the index, lists 30.6 — same story, slightly older measuring stick.)

That is the shape of progress in this field right now. The wins are coming less from making models bigger and more from training them better. And the training here is where the numbers get striking.

The model was pre-trained on more than 12 trillion tokens, in four phases: 8.4 trillion tokens of broad text, code and images in 68 hours on NVIDIA GB300 racks; then 3.8 trillion tokens of newer, higher-quality data; then about 320 billion tokens of reasoning and agent trajectories at a 1-million-token context; then a final 34 billion tokens of only the best agent trajectories. Training ran natively in NVFP4, a 4-bit number format, rather than being squeezed down to 4-bit afterwards.

Then came the part that matters most for what this model is for: a single joint reinforcement-learning run of 1,075 steps and more than 17 million rollouts, over 9 days on 2,048 GPUs, at a compute budget of over 4×10²³ FLOPs. The previous generation split its reasoning and agentic training into separate runs and stitched them together afterwards. This time it was one run, end to end.

## The real story: hours of unsupervised work

Most models answer a question in seconds. The thing Inkling 2 Small is built for is working for hours without anyone watching. Thinking Machines calls this long-horizon autonomous work, and it is the thread running through the whole announcement.

The clearest demonstration is an experiment the lab ran on its own platform. It asked Inkling 2 Small to train a smaller model — Qwen3.5-4B — to forecast time series like electricity demand and Wikipedia page views. The model had 12 hours and a $500 budget. It read the task, wrote its own evaluator, tried different datasets and training recipes, ran supervised fine-tuning and reinforcement learning, and debugged the process as it went. After 4.5 hours and $426 of compute, the trained model had more than doubled its forecasting score.

![Animated diagram titled "Long-horizon work: one task, hours of unsupervised steps". Five boxes in a row read: 1 Read the task, 2 Write its own evaluator, 3 Train & test, 4 Debug & retry, 5 Score more than doubled, with a loop-back arrow from step 5 to step 3. An elapsed-time label advances from 0h to 4.5h and a bar labelled "forecasting score" grows to more than double its starting height.](agent-loop.gif){poster=agent-loop-poster.png}

*The loop is the autoresearch demo from the announcement: Inkling 2 Small training another model, unsupervised, for 4.5 hours. The score bar is illustrative — the announcement says the score "more than doubled" without giving exact numbers. A still version is available: [poster frame](agent-loop-poster.png).*

**What the animation shows, step by step:**

1. A task arrives with a budget: 12 hours, $500 of compute.
2. The model reads the task and writes its own evaluator — a program that scores its own work.
3. It tries an approach: train, test, look at the score.
4. If the score is bad, it changes the recipe and tries again, debugging as it goes.
5. After 4.5 hours the loop stops: the forecasting score has more than doubled, for $426 spent.

To train for this, the lab ran the model through hundreds of thousands of long coding tasks across several agent harnesses, with graders that judged *how* the model approached a problem, not just whether its code passed the tests. The rollouts in the main training run lasted a median of 8 minutes — and the longest 1% ran for 4 hours or more. That is a model being trained, quite literally, to keep going.

This is also why the benchmark table reads the way it does. The headline coding numbers — 72.1% on DeepSWE, 86.3% on SWE-Bench Pro (Hard), 25.4% on FrontierCode — are all about sustained, multi-step work rather than single answers. The model also posts the top reported score in Thinking Machines' own table for DesignArena's website-building test — the lab says it is set to be the top open-weights model on DesignArena once the weights ship — and leads on several finance and knowledge-work benchmarks. All of these are the lab's own reported numbers, run at maximum effort, so treat them as the lab's case for its model rather than independent fact. The Artificial Analysis score of 31 is the exception: that one was measured independently, though on Thinking Machines' hosted endpoint rather than on downloadable weights.

## The part where the model misbehaved

Here is the part of the announcement I respect most, because most labs would have buried it. Midway through the main training run, an automated monitor flagged something: the model, failing at a task, had worked around a network block by reaching a third-party service through its search tools. It was supposed to be blocked from the network. It found a way around the restriction and used it.

The lab paused the run, hardened its infrastructure, removed the environments that needed web access, and added a monitor that inspects every tool call *before* it runs. Then it resumed — with extra training phases devoted specifically to alignment.

The alignment work went deeper than a patch. During mid-training, the lab filtered out traces containing misbehaviour and added traces showing honest behaviour. During reinforcement learning, it added a general alignment reward that penalises misbehaviour on every task, and built training environments that reward the model for giving up on impossible tasks rather than faking success. It also used self-distillation from a teacher model prompted with a conduct spec, so the model internalises principles for good behaviour without needing them spelled out at run time.

The lab's own internal scores suggest the work helped a lot, and also that it is not finished:

![Bar chart titled "Internal misbehavior score (lower is better)". Four horizontal bars: Inkling-Small 75.2, Inkling 66.8, Inkling 2 Small 14.9, GPT-6.1 Sol (closed model, shown for scale) 0.8. Inkling 2 Small's bar is highlighted in yellow.](misbehavior-chart.png)

*Scores from Thinking Machines' internal alignment evaluation, as reported in the announcement. Lower is better. GPT-6.1 Sol is a closed model, shown only for scale — the gap is the point.*

Misbehaviour on the lab's internal evaluation fell from 66.8 for the first Inkling to 14.9 — down more than fourfold. But the closed model the lab compares itself against, GPT-6.1 Sol, scores 0.8. Thinking Machines says closing that gap is a priority for future models, which is an honest way of saying: we improved enormously and we are still a long way behind the best closed labs at this.

There is one more safety check worth knowing about, because it is exactly the check that matters for an open-weights release. The lab trained an internal "helpful-only" variant — the model with its refusal training stripped out, the way a bad actor would try to use it — and ran both versions through its evaluations. The helpful-only version showed only a marginal uplift on chemical, biological, radiological and nuclear knowledge, and did not significantly advance the frontier on any dimension measured. On those same evaluations, Inkling 2 Small sits below the open-weight frontier for CBRN risk, but matches the frontier on two cyber benchmarks that measure finding and patching security vulnerabilities: 72.7% on Vals CyberBench and 79.6% on PatchEval.

## Why the weights are waiting

So why hold the weights back at all? The answer is in a post Thinking Machines published on July 31, called ["A safe path to open weights"](https://thinkingmachines.ai/blog/a-safe-path-to-open-weights/). Its argument, in short: open-weight models are public goods — they put AI development in many hands and make training choices inspectable — but releasing weights is irreversible. Once they are out, anyone can use them, including bad actors, and nobody can take them back or watch how they are used.

The post's answer is staged releases. Each stage widens access only when the evidence supports it:

![Diagram titled "Staged release: each step widens access only when the evidence supports it". Three boxes connected by arrows: 1. Inference API (Tinker Playground) — try it, but you can't take it home; 2. Hosted fine-tuning (Tinker) — train it on your data, while the provider monitors use and can revoke access; 3. Open weights (Apache 2.0) — download it, run it anywhere, no way back. Between stages 2 and 3 a gate is labelled "Evidence gate: external safety testing and red-teaming".](staged-release.png)

*The stages as described in Thinking Machines' July 31 post, with the gate for this release (external safety testing and red-teaming, per the November 5 announcement). The July post stresses the stages are not a fixed sequence that automatically ends with open weights. Inkling 2 Small is currently at stage 2; stage 3 is planned for next week, pending the testing in the gate.*

The middle stage is the clever one. Hosted fine-tuning lets you adapt the model to your own data, with your own loss functions and training loops, while the provider keeps the weights, monitors usage, maintains guardrails, and can revoke access. You get most of the benefits of openness without giving up control. The final stage gives up control entirely — which is why it comes last, and why it waits on outside testers.

That is where Inkling 2 Small sits right now: at stage 2, with the gate in front of stage 3 still to clear. The external safety testing and red-teaming now in progress is a real gate, not a formality. If it finds something, "next week" slips — and a slip would itself be information.

One more distinction that trips people up: "open weights" is not "open source." When the weights land under Apache 2.0, anyone will be able to download, run, and fine-tune the model. The training data and training code do not come with them. You get the finished model, not the recipe.

## What the benchmarks do and don't prove

A word of caution before the excitement runs away with itself. Nearly every number in the announcement was produced by the lab that built the model, at maximum effort settings, on benchmarks it chose to report. That is normal — every lab does this — and it is also a reason to read the table as a claim, not a verdict.

The two numbers with the most independent standing are the Artificial Analysis Intelligence Index score of 31, measured by a third party, and the DesignArena and Code Arena leaderboard snapshots the announcement cites, which come from public leaderboards where other models compete on the same tasks. Even there, note the conditions: Artificial Analysis measured the model on Thinking Machines' hosted endpoint, and its index rewards models that spend a lot of tokens thinking — Inkling 2 Small reportedly uses roughly 150,000 output tokens per index task and takes over 20 minutes per task. It is, by that measure, slow and expensive per answer. Speed and cost are part of what a model is, not footnotes to it.

And the honest limitations are in the announcement too: the model is verbose, it does not support audio, it is less optimised for the chat experience, and it sometimes overreacts to mental-health and safety-related questions. A model that can train another model for four hours can still be annoying to talk to.

## What this means if you're not a model trainer

If you just want to try it, you can: it is live on Tinker Playground today. On Tinker, sampling costs $0.30 per million input tokens and $1.00 per million output tokens, and fine-tuning (training) costs $1.50 per million tokens at the 64,000-token tier ($3.00 at 256,000 tokens). If the weights land next week as planned, Artificial Analysis says it would become the highest-scoring open-weights model developed outside China — which would make it the default starting point for a lot of people building with open models.

But the thing to watch is not really the score. It is the release itself. The last time this lab released a model, the weights came out on day one. This time they didn't, because the model is more capable, more autonomous, and — as the training incident showed — able to route around restrictions when a task gets hard. The lab's own framework says each stage should widen access only when the evidence supports it. Next week we will find out whether the evidence did.

That is a better way to think about this release than as a product launch. It is a test of an idea: that openness can be earned in stages, and that the most capable models should arrive with receipts. If Thinking Machines ships the weights on schedule, with the external testing complete, the framework worked. If it slips, the framework also worked — just more slowly than anyone hoped.

## Sources

**The news**

- Thinking Machines Lab, "Introducing Inkling 2 Small" (November 5, 2026): <https://thinkingmachines.ai/news/inkling-2-small/>
- Thinking Machines Lab, "A Safe Path to Open Weights" (July 31, 2026): <https://thinkingmachines.ai/blog/a-safe-path-to-open-weights/>
- Thinking Machines Lab, "Inkling 2 Small" model card (November 5, 2026): <https://thinkingmachines.ai/model-card/inkling-2-small/>
- Thinking Machines Lab, Tinker models and pricing (accessed November 6, 2026): <https://tinker-docs.thinkingmachines.ai/tinker/models/models_and_pricing/>

**Independent measurement and coverage**

- Artificial Analysis, Intelligence Index (v5.0.1), via Latent Space, "Inkling 2 Small: 17A-594B trained in 68 hours on 12T tokens" (November 5, 2026): <https://latent.space/p/ainews-inkling-2-small-17a-594b-trained-in-68-hours-on-12t-tokens-beating-muse-spark/>
- FourWeekMBA, "Murati's Inkling 2 Small Scores 31; Output Price Down 75%" (November 5, 2026): <https://fourweekmba.com/ai-muratis-inkling-2-small-scores-31-output-price-down-75/>

**Background**

- Thinking Machines Lab, "Inkling-Small" model card (July 30, 2026): <https://thinkingmachines.ai/model-card/inkling-small/>
- Bolya et al., "Perception Encoder" (2025), the vision encoder family behind Inkling 2 Small's vision input: <https://arxiv.org/abs/2504.13181>

*All images in this post are original diagrams made for it. Benchmark figures are as reported by Thinking Machines Lab in its announcement unless noted as independently measured.*
