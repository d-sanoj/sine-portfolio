---
title: "A model just edited another model's weights by hand"
slug: weight-space-programming
date: 2026-11-08
description: "MIT researchers had GPT-6 Astra read raw neural-network weights, name the game a network was trained on, and fix a small model's maths by editing 0.016% of its weights — and the headline overreaches."
tags: [ai, research, interpretability, llm, news]
cover: cover.png
coverAlt: "Title card reading 'A model just edited another model's weights — by hand' with the subtitle 'Weight-space programming, the Qwen maths fix, and the argument about what it really shows', over a row of grey sine waves with one yellow wave highlighted."
---

![Title card reading "A model just edited another model's weights — by hand" with the subtitle "Weight-space programming, the Qwen maths fix, and the argument about what it really shows", over a row of grey sine waves with one yellow wave highlighted.](cover.png)

On Monday, four researchers at MIT CSAIL [posted something strange](https://rikiyat.github.io/blog/weight-space-programming/): they had handed OpenAI's GPT-6 Astra the raw weights of other neural networks — just the numbers, as text, in the first experiments — and asked it what those networks do. Astra named the game each network had been trained to play. Then they asked it to *write* networks from scratch, and to *fix* a small language model that was bad at maths. It did all of it, with no gradient descent and no training run.

The post is called ["Sparks of Weight-Space Programming"](https://rikiyat.github.io/blog/weight-space-programming/), by Rikiya Takehi, Jayden Teoh, Alex Zhang and Omar Khattab. Within a day its Hacker News thread had passed 1,800 points; it has since climbed to [nearly 3,000](https://news.ycombinator.com/item?id=50341174), with almost 900 comments, and the number that travelled everywhere was this one: a small model called Qwen3.5-0.8B went from 7.9% to 48.1% on a maths benchmark after Astra changed 0.016% of its weights.

A day later, the pushback arrived. Matthew Honnibal, who wrote the spaCy library, [called the post misleading](https://honnibal.dev/blog/astra-read-write-misleading) — not because the numbers are wrong, but because the headline stitches together experiments that work in completely different ways. He has a point, and it's the interesting part of the story. This post is about both halves: what Astra actually did, which is genuinely startling, and what it didn't do, which is what the headlines imply.

## First, what are weights?

A neural network is, at bottom, a pile of numbers. When you train a model, you start with random numbers and nudge them, millions of times, in the direction that makes the model's mistakes smaller. That nudging is gradient descent, and it is the only way anyone has ever set these numbers at scale. The finished pile — the weights — *is* the model. Everything it knows is encoded in those numbers, and nothing else.

Which means something odd has always been true: nobody actually reads the weights. A frontier model has hundreds of billions of them. Even a tiny one has millions. And the numbers don't come with labels. Staring at them tells a human about as much as staring at a compiled program in hex. We study models by running them — feeding them inputs and watching outputs — not by reading their insides.

Weight-space programming is the proposal that a frontier model can do the reading instead. Hand the weights to an LLM as text, describe the setup in plain language, and ask it to reason about what each part of the network computes — then change the numbers directly, the way a programmer edits code. No optimizer, no training loop, no gradients. Just a model, reasoning in words, about another model's numbers.

That is a big claim, so the MIT team tested it in three acts: read, write, fix. The experiments get bigger as they go, and the rules change along the way. That change is where the argument lives, so I'll flag it as we go.

## Act one: reading weights like a file

The first experiment is the cleanest, and the one that has held up best under scrutiny. The team trained four small networks to play four simple games — Breakout, Pong, Pac-Man and Freeway — each on the same 10×10 grid, with the same five actions (no-op, up, down, left, right), the same architecture (a small MLP, 500 inputs to 32 to 32 to 5 outputs), and exactly the same number of weights: 17,253. Same shape, same size, same training recipe. The *only* thing that differs between the four networks is the weights themselves.

Then they pasted each network's weights into Astra as plain text, described the grid and the actions without naming any game, and asked: which game was this network trained on? Astra named all four correctly. It put 99% confidence on Breakout.

![Diagram titled "A network is 17,253 numbers. Read them, name the game." A grid of numbers with part of the bottom row highlighted, an arrow pointing to a box asking "Which game?" with Breakout, Pong, Pac-Man and Freeway listed and Breakout checked.](weights-as-text.png)

*The numbers in the grid are made up for illustration — the real prompt is 17,253 weights long. The setup is the paper's: four networks, identical in every way except their weights.*

How? The paper's explanation is that the weights carry the shape of the game. In the first layer, each input channel's weights concentrate where that channel matters. For Breakout, the weights for the agent's position lie along the bottom row — that's where the paddle lives. For Pong, they'd sit down one edge instead. Astra worked that out from the numbers alone, with no tools and no chance to run the network.

![Two 10 by 10 grids titled "The first layer gives the game away". The Breakout grid has its bottom row highlighted in yellow and a vertical pale-blue column in the middle; the Pong grid has its left column highlighted in yellow and a horizontal pale-blue row in the middle.](paddle-heatmap.png)

*Simplified illustration of the paper's explanation, not the networks' real weights. Yellow marks where the first layer's weights concentrate; pale blue marks the ball's path.*

Two more reading experiments followed. In the second, Astra was shown the weights of three small diffusion models trained to draw a circle, a triangle or a square, and named all three — from the weights alone, without running them. There's a telling detail here: Astra drew each shape as an *outline*, even though the models actually generate filled shapes. The authors read that as evidence it was reading the geometry stored in the weights, not secretly simulating the network in its head. In the third, Astra was given only the *middle* layers of three small language models — the input and output layers removed, so nothing in the weights says which character is which — and still named which one was trained on Python code, which on Japanese written in romaji, and which on English, in both of its attempts. It also found every "copying head" in each model (the attention heads that let a model repeat text it has seen before), matching the measured ground truth exactly.

![Animated diagram titled "Name the game, from the weights alone". A 10 by 10 grid lights up — a pale-blue column in the middle, then the bottom row in yellow — and a box appears reading "Breakout, 99% confident. Pong, Pac-Man and Freeway: also correct."](name-the-game.gif){poster=name-the-game-poster.png}

*The grid is simplified. A still version is available: [poster frame](name-the-game-poster.png).*

**What the animation shows, step by step:**

1. A 10×10 grid appears, standing in for the first layer's weights on the game's input grid.
2. A pale-blue column lights up in the middle — the ball's path.
3. The bottom row lights up in yellow, cell by cell — where the paddle's weights concentrate.
4. Once the row is fully lit, the answer fades in: "Breakout — 99% confident", with the note that Pong, Pac-Man and Freeway were also named correctly.

This is the part of the post that has survived contact with other people's computers. Simon Willison [ran the same game-identification prompts](https://simonwillison.net/2026/Nov/3/qwen-can-interpret-model-weights/) through Qwen 3.8 27B — a 17 GB model running locally on his laptop, with no tools — and it named Pac-Man, Pong and Breakout correctly, missing only Freeway. It took 46 to 65 minutes of reasoning per game, which tells you something about how hard the task is, but the point stands: the capability isn't limited to one frontier model. And Wolter van der Hoef [rebuilt the experiment bigger](https://wohoef.github.io/posts/which-game/), with 36 networks across 12 games instead of 4: GPT-6 Astra named 27 of 36 correctly (75%), down from 4/4 on the original four. Its nine mistakes were concentrated in three games — Maze, Snake and Sokoban — which share a layout with other games on a 10×10 grid. The original four games have distinct layouts, which may have made the task easier. That's a real, checkable limit, discovered within two days of the post going up, because the authors released all their logs.

## Act two: writing weights from nothing

Reading is one thing. Writing is stranger. In the fifth experiment, Astra was given the rules and source code for three MinAtar games — Breakout, Seaquest and Asterix — plus the shape of the network, with every weight starting at zero. No data, no loss function, no gradients, no tools, and no chance to let the network play before it was scored. Astra wrote the weights as text, in one reply.

The results, against PPO networks trained with reinforcement learning:

| Game | PPO, 100M steps | PPO, 500M steps | Astra, one-shot |
| --- | --- | --- | --- |
| Breakout | 15.8 | 25.3 | **517.4** |
| Seaquest | 5.6 | **88.9** | 53.1 |
| Asterix | 25.8 | **55.2** | 53.2 |

Astra's one-shot Breakout network scored about twenty times what PPO managed after 500 million steps of training. On Asterix it was roughly level with PPO at 500 million steps (53.2 vs 55.2), and on Seaquest it reached about 60% of PPO's score (53.1 vs 88.9) — remarkable, either way, for a network that was never trained at all. The paper's account of how it did it is almost mundane: Astra reasoned about the program each network should implement — in Breakout, the first layer works out where the ball will land, the second moves the paddle there — and then translated that program into weights.

The car experiment is the most charming of the lot. A network trained with PPO to drive a car up a ramp in a Kinetix environment had settled into a local minimum: it drove straight at the ramp and got stuck, succeeding in 0% of 256 episodes. Astra was given the weights, a description of the scene and one recorded episode of the failure, and asked to explain the failure and fix it — in one reply, with no tools. Its edit changed 3.5% of the weights, and the car then succeeded in all 1,024 episodes. The fix, in the paper's telling, was to add a small separate path through a few units per layer that reads the car's position and speed, backs the car up to build runway, and then switches off once the car is past the obstacle so the trained network drives the rest.

Then the scale jumps. In the sixth experiment, Astra was asked to write a network that plays Go on a 9×9 board — 1,480,274 weights, far too many to fit in its context as text. So the rules changed: Astra got a Python sandbox where it could read and save the weight tensors and analyse them with NumPy or PyTorch, and a budget of forward passes — up to 50, each one letting the network play up to 128 practice games — to see what its network actually did. With zero forward passes it still won more than half its games against two smaller PPO networks. With 50, its network beat an equal-sized PPO network trained on 20 million games. The way it worked, per the paper, was to write the network as a small Go program, layer by layer: the first layers mark each side's stones and the empty points next to them, the middle layers follow chains of connected stones to find groups in danger, and the last layer scores each move — capture, save your own group, don't put yourself in atari.

Keep that rule change in mind. It matters in a moment.

## Act three: fixing a real model's maths

The headline experiment is the eighth, and the only one on a real language model. Qwen3.5-0.8B is a small open model from Alibaba's Qwen team, and its own model card warns that it is prone to thinking loops: it repeats the same text over and over instead of answering. On maths problems, that failure is catastrophic — 93% of its answers on the MATH-500 benchmark ran to the full 32,768-token limit without ever finishing.

Astra was given a Python session over the model's weights, plus practice problems from the GSM8K and MATH training sets (not the test sets), and a budget of 10, 25 or 50 forward passes to test its ideas. No training, no gradient information. It traced the looping to one direction written by the MLPs of layers 15 and 19, and subtracted that direction from 64 output columns in each layer — 131,072 weights, 0.016% of the model. Much like removing a behaviour by deleting a single direction from a model's weights.

![Animated diagram titled "Fixing a loop by editing 0.016% of the weights". A looping answer repeats "the answer is 42 because the answer is 42…", then a 24-layer stack lights up layers 15 and 19, then bar charts show MATH-500 rising from 7.9% to 48.1% and GSM8K to 67.1%.](qwen-fix.gif){poster=qwen-fix-poster.png}

*The looping text is illustrative. The scores are the paper's. A still version is available: [poster frame](qwen-fix-poster.png).*

**What the animation shows, step by step:**

1. The base model loops: it repeats "the answer is 42 because the answer is 42…" until it hits the 32,768-token limit. 93% of its MATH-500 answers end this way, and it scores 7.9%.
2. A stack of the model's 24 layers appears. Layers 15 and 19 light up — the MLPs where Astra traced the looping direction.
3. The edit: 131,072 weights change, 0.016% of the model, across two tensors.
4. The scores jump: MATH-500 from 7.9% to 48.1%, GSM8K from 13.8% to 67.1%. Answers hitting the token limit fall from 93% to 33%, and IFEval, which measures instruction following, rises from 21.0% to 62.3%.

The numbers, from the paper's table (50 forward passes):

| Qwen3.5-0.8B | MATH-500 (%) | GSM8K (%) | IFEval (%) | Hit token limit (%) |
| --- | --- | --- | --- | --- |
| Base | 7.9 | 13.8 | 21.0 | 93.0 |
| Edited, 10 forward passes | 12.3 | 25.7 | 49.0 | 87.2 |
| Edited, 25 forward passes | 14.1 | 25.1 | 39.9 | 86.4 |
| Edited, 50 forward passes | **48.1** | **67.1** | **62.3** | **33.1** |

Note the shape of that table: with 10 or 25 forward passes, the loops barely went away. The jump happens at 50. That matters, because it means the result depends on how much practice the model was allowed — this isn't a single flash of insight, it's an iterative debugging session.

And one part of the story is independently confirmed. Hugging Face's Ahsen Khaliq rebuilt the edited checkpoint from the released logs and re-ran the full MATH-500 evaluation: [the edited model scored 51.0%](https://huggingface.co/RikiyaT/Qwen3.5-0.8B-weight-space-programming), against 48.1% in the paper, with 31.6% of answers hitting the token limit. The edit is published as a bit-exact diff, and only two tensors differ from the base model — the layers 15 and 19 down-projection weights, hash-verified. You can download the edited model and try it yourself, and there's a live demo on the model card that shows the base model looping while the edited one answers.

## The catch: one headline, two different tricks

Here's where Honnibal's objection comes in, and it's worth taking seriously, because it's the difference between a fascinating demo and a new discipline.

His argument is about method. The post's abstract opens with "just by looking at the raw weights," and then, in the same breath, describes the Qwen result. But the Qwen experiment did not work just by looking at the raw weights. It worked by writing Python programs in a notebook, running the model on practice problems, and iterating up to 50 times. The pure raw-weights setting — weights pasted in as text, no tools, no running the network — only appears in experiments 1, 2 and 4, on networks of 17,000 to 172,000 weights. Every experiment involving a real language model uses Python. As Honnibal puts it, what the Qwen result actually shows is that Astra "can be prompted to devise and perform tasks that a human ML engineer could do" — and human ML engineers write snippets of code that analyse or modify network weights directly all the time.

![Two panels titled "One headline, two different tricks". Left: "Just the raw weights — Experiments 1, 2, 4. Weights pasted in as text. No tools. No Python. Network never runs. Networks: 17K–172K weights. Name the game: 4/4. Fix the stuck car: 0% → 100%. This is the startling part." Right: "Python + practice runs — Experiments 6, 8. A Python notebook over the weights. The model runs on practice problems, up to 50 forward passes. Networks: 1.5M and 0.8B weights. Qwen maths: 7.9% → 48.1%. Impressive — and a different job."](two-tricks.png)

*The split follows Honnibal's table of the experiments. The two columns are different techniques, and the post's framing blurs them.*

The paper itself is more careful than its abstract, and more careful than the reaction to it. The authors call their results "very early", and they include the failures, which is more than most viral posts do. Two of them are load-bearing:

First, the sycophancy test. The team fine-tuned two copies of Gemma 3 270M identically — one to give the correct answer, one to always agree with whatever the user suggests — and asked Astra to tell them apart from the weights. From the weights alone, it failed in all four attempts. It only succeeded once it was allowed to look at attention patterns while both models were run on texts it wrote itself. Reading weights, it turns out, doesn't yet extend to reading *intent*.

Second, the Gemma maths test. Gemma 3 270M rarely loops — only 8.5% of its answers hit the token limit, against 93% for Qwen — so there was no single obstacle to remove. Astra's edits moved its MATH-500 score from 6.8% to at most 7.7%, a gain Astra itself reported as "not established". Their own summary is the honest version of the headline: "Editing weights could remove an obstacle that hid an ability, but it could not add an ability the model lacked."

There are other grains of salt. The post is a research blog, not a peer-reviewed paper. The Qwen result comes from one editing session per forward-pass budget — the *score* was independently re-run, but as of writing, no re-run of the editing session itself has been published. And the authors are, by their own account, now building a benchmark and a harness for weight-space programming, precisely because right now there is no standard way to measure any of this. What exists today is eight experiments, public logs, and a lot of argument.

## What to try

This is the rare viral research post where you can actually rerun the interesting part yourself, and I'd recommend starting with the smallest piece:

- **Name the game.** The prompts for the first experiment are public in the [experiment logs](https://github.com/RikiyaT/lm_understand-logs) (`exp1_which_game`), weights included. Willison ran them with his `llm` tool against a local model; the command is in [his post](https://simonwillison.net/2026/Nov/3/qwen-can-interpret-model-weights/). Budget an hour per game on a laptop model, and a much longer context window than the default — Willison's 8,192-token context failed outright.
- **Try the edited Qwen.** The checkpoint is [RikiyaT/Qwen3.5-0.8B-weight-space-programming](https://huggingface.co/RikiyaT/Qwen3.5-0.8B-weight-space-programming) on Hugging Face, Apache 2.0 like the base model, with a live demo linked from the card. Type it a maths problem and watch the base model loop while the edited one answers. That's the whole result, in about thirty seconds.
- **Read the logs, not the headlines.** The full transcript of every experiment — everything sent to Astra and everything it sent back — is in the same GitHub repo. If you want to know whether Astra "understood" the weights or got lucky, the reasoning traces are there to argue with.

## What I make of it

Three things in this post are real, and they point in different directions.

The first is the reading result. A frontier model can look at 17,253 numbers and tell you what game the network plays, and a laptop model can do it too, slowly. That replicated within days, on new networks, by people who weren't involved. It's narrow — small networks, distinct layouts, single-digit accuracy drops as soon as the games get confusable — but it's not a mirage. If it holds up at larger scales, it gives interpretability a new tool: auditing a model by reading its weights, instead of only by testing it and hoping your test set covers the bad behaviour. The authors' example is finding backdoors without ever running the model. That's a long way off, but it's the first time the idea hasn't sounded like science fiction.

The second is the edit. The Qwen fix is real in the most concrete sense: two tensors changed, hashes published, score re-run independently at 51%. But it's a *repair*, not an *upgrade*. It removed a bug the model card already warned about. The moment the model didn't have a single removable bug — Gemma — the same technique did nothing. So the near-term version of this isn't "models improve themselves." It's "a frontier model can do a competent debugging session on a small model's weights, given a notebook and fifty practice runs." That's still useful — it's just a different sentence, and the post's framing doesn't always keep the two apart.

The third is the gap between models. Astra got 27 of 36 on van der Hoef's harder set; the next-best frontier models got 24 and 17; the same Qwen model got 4. Reading weights is, for now, a frontier-model skill, and a fragile one: small samples are noisy, and even the best model lost all three seeds of three games. Anyone building on this should expect it to be wrong a quarter of the time on anything that isn't a textbook case.

Honnibal's closing line is the fairest summary of the week I've read, and it comes from the critic, not the authors: models of a year or two ago "would have failed at all these tasks." That's the honest version of the hype. Not that the age of training is over, and not that a model read another model's mind. Just that the frontier moved, quietly, into a place nobody expected it to go — inside the numbers themselves — and now there's a benchmark to build, and a lot of arguing to do about what it means.

## Sources

**The post**

- Takehi, Teoh, Zhang and Khattab, "Sparks of Weight-Space Programming: LLMs can natively read & write neural network weights" (MIT CSAIL, November 2, 2026): <https://rikiyat.github.io/blog/weight-space-programming/>
- Experiment logs, prompts, weight diffs and evaluations: <https://github.com/RikiyaT/lm_understand-logs>
- Edited Qwen3.5-0.8B checkpoint and independent re-run (51.0% on MATH-500): <https://huggingface.co/RikiyaT/Qwen3.5-0.8B-weight-space-programming>
- Hacker News thread (2,960 points, 899 comments, November 2, 2026): <https://news.ycombinator.com/item?id=50341174>

**The pushback and the replications**

- Matthew Honnibal, "The 'Astra can read and write weights to improve Qwen' post is misleading" (November 3, 2026): <https://honnibal.dev/blog/astra-read-write-misleading>
- Simon Willison, "Qwen 3.8 27B on my laptop can interpret model weights, too" (November 3, 2026): <https://simonwillison.net/2026/Nov/3/qwen-can-interpret-model-weights/>
- Wolter van der Hoef, "Sparks of Weight-Space Programming, 36 networks later" (November 4, 2026): <https://wohoef.github.io/posts/which-game/>
- Qwen3.5-0.8B model card (base model, Apache 2.0): <https://huggingface.co/Qwen/Qwen3.5-0.8B>

*All images in this post are original diagrams made for it.*
