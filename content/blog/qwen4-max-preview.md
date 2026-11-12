---
title: "Qwen4-Max is out — for two weeks only"
slug: qwen4-max-preview
date: 2026-11-12
description: "Alibaba's next flagship arrived on November 11 with a printed expiry date: November 25, then retired. Here is what it is, what it isn't, and what to test before it vanishes."
tags: [ai, qwen, alibaba, models, api, benchmarks]
cover: cover.png
coverAlt: "Title card reading 'Qwen4-Max is out — for two weeks only' above a calendar strip from November 11 to November 25, with the final day marked 'retired'."
---

![Title card reading "Qwen4-Max is out — for two weeks only" above a calendar strip from November 11 to November 25, with the final day marked "retired".](cover.png)

Yesterday morning, Alibaba opened the first model of its next generation. Qwen4-Max-Preview went live at 10:00 Beijing time on November 11, and the documentation carries a sentence you do not usually see on a flagship launch: the preview runs until 24:00 on November 25, "no changes will be made during this period, and the model will be retired after the preview ends."

So this is a flagship with a kill switch. Within hours the announcement was on Hacker News and being discussed across Reddit's local-model communities, and it was one of the day's top stories in the AI news roundups. That is worth pausing on, because Qwen is the model family a large part of the local-AI world builds on — the community treats it as the backbone of local AI — and the first Qwen4 model anyone can actually touch arrived not as a release but as a two-week demo with a printed expiry date.

This post is about what shipped, what didn't, how to try it, and what the two-week window is actually for.

# What actually shipped

The only official specification is Alibaba's Model Studio documentation page, and it is short. Here is everything it confirms:

| Spec | What Alibaba documents |
| --- | --- |
| Model ID | `qwen4-max-preview` |
| Context length | 1,000,000 tokens |
| Maximum output | 393,216 tokens, shared by thinking and the final answer |
| Inputs | Text, images, and video |
| Thinking | Enabled by default; `reasoning_effort` low, medium, or xhigh (default) |
| Tool calling | Function calling, web search, built-in tools |
| Structured outputs | JSON Object and JSON Schema |
| API compatibility | OpenAI Chat Completions, Responses, and Anthropic Messages APIs |
| Designed for | Coding, office productivity, frontend design, complex agentic tasks |

That is a serious spec sheet on its own terms. A million-token context with nearly 400,000 tokens of output is a lot of room to think and answer in, and video input — already accepted by Qwen3.8-Max — is still there. But notice what the headline number is not: new. Qwen3.8-Max, the previous flagship, launched on August 3 with a million-token context of its own. The context window did not grow. What changed is the access model — and that is the real story of this launch.

# What didn't ship

The missing half of the launch is longer than the shipped half:

- **No benchmarks.** Alibaba has published no scores — vendor-reported or independent — on reasoning, coding, or anything else. There is nothing to compare against Claude Fable 5.2, GPT-6, or Gemini 4 Carbon.
- **No parameter count.** Neither the total nor the activated count is published, so memory and speed cannot be estimated.
- **No model card.** No documented capabilities, limits, or training data.
- **No per-token price.** Access runs through a Token Plan subscription; Alibaba lists no per-token rate for this model, and pay-as-you-go access is explicitly not supported.
- **No weights.** Nothing named Qwen4 exists in the Qwen organisation on Hugging Face as of November 11, so there is nothing to self-host or fine-tune.
- **No full release date.** The rest of the Qwen4 family — Qwen4-Plus, Qwen4-Flash, and the 27B model meant for local deployment — has no announced date.

So every quality claim about Qwen4-Max is, for now, Alibaba's word. There is no independent measurement of any kind, and the model you would measure is frozen for two weeks and then retired. That is not a criticism of the model — it might be excellent. It is a statement about the evidence: there is none yet, and the window for collecting it is roughly two weeks long.

![Two columns. Left, "What shipped": a million-token context, 393,216 tokens of output, thinking on by default, text, image, and video input, tool calling, and OpenAI and Anthropic API compatibility. Right, "What didn't": no benchmarks, no parameter count, no model card, no per-token price, no weights, and no pay-as-you-go access.](shipped-vs-missing.png)

:::describe
The diagram has two columns. The left column, headed "What shipped", lists a million-token context; 393,216 tokens of output; thinking on by default; text, image, and video input; tool calling; and OpenAI and Anthropic API compatibility. The right column, headed "What didn't", lists no benchmarks; no parameter count; no model card; no per-token price; no weights; and no pay-as-you-go access. The point is that the missing half of the launch is longer than the shipped half.
:::

# How to try it

The quickest route is Qwen Studio, Alibaba's chat app at chat.qwen.ai, where Qwen4-Max-Preview appears in the model picker next to Qwen3.8-Max. Early access also runs inside Alibaba's own apps — QwenWork, Qoder, the Qwen app, and QwenStudio.

For the API, the route is narrow and specific. Qwen4-Max-Preview is available through Token Plan only — a monthly subscription for coding and agent tools. A standard Qwen Cloud API key will not reach it. The documented steps are: subscribe to Token Plan Personal or Team and get a dedicated API key, point your client at the dedicated base URL `https://token-plan.ap-southeast-1.maas.aliyuncs.com`, and set the model ID to `qwen4-max-preview`. Independent coverage of the pricing page lists the Individual plans at $6 (Lite), $10 (Essential), $18 (Standard), and $43 (Pro) a month. The endpoint works with Qwen Code, Cline, Claude Code, Cursor, OpenCode, and Codex.

One documentation detail can break existing code, and it is worth reading before you call the API. Starting with this model, `max_tokens` is equivalent to `max_completion_tokens`: both limit the combined tokens for thinking and the final answer. Thinking consumes part of the same budget, so a limit previously sized for the answer alone may truncate output. If you set a 32,768-token limit — the default output limit Qwen Code applies to this model, according to independent coverage — and the model spends 30,000 tokens thinking, you get about 2,700 tokens of answer. Allow room for both when choosing the limit.

![A horizontal bar labelled "393,216-token output budget, shared by thinking and the final answer". The left portion, in yellow, is "thinking" and takes most of the bar; the right portion, in blue, is "the answer". The 70/30 split is illustrative — the docs give the 393,216-token total, not the ratio. A note below reads: "Starting with qwen4-max-preview, max_tokens counts thinking and the answer together. A limit sized for the answer alone can cut the output short."](output-budget.png)

:::describe
The diagram is a single horizontal bar representing the 393,216-token output budget. The left portion, in yellow and labelled "thinking", takes most of the bar; the right portion, in blue and labelled "the answer", takes the rest. The 70/30 split is illustrative — the docs give the 393,216-token total, not the ratio. A note below reads: "Starting with qwen4-max-preview, max_tokens counts thinking and the answer together. A limit sized for the answer alone can cut the output short." The point is that the output budget is shared, so a limit set for the answer alone will truncate the response.
:::

![Animation of the three steps to try Qwen4-Max-Preview. First, subscribe to Token Plan and get a dedicated API key. Second, point your client at the Token Plan base URL and set the model ID to qwen4-max-preview. Third, send a first call — the easiest route is Qwen Studio, where the model is in the picker.](try-it.gif){poster=try-it-poster.png}

*Three steps to a first call. The animation shows subscribing to Token Plan for a dedicated key, pointing a client at the Token Plan base URL with the model ID set, and sending a first call — or skipping the API entirely and picking the model in Qwen Studio.*

# Three things worth testing in fourteen days

With no benchmarks, your own run is the only benchmark. If you have a Token Plan subscription or a Qwen Studio account, here are the three tests that would actually tell you something — and each one maps to a claim in the spec sheet.

**1. Does the million-token context hold up?** The headline number is the same as Qwen3.8-Max, so the question is not whether the window is big but whether retrieval stays accurate deep inside it. Load a large repo plus its docs — a few hundred thousand tokens — put a fact in the middle, and ask for it. Then ask for a fact that requires combining two passages from opposite ends. A model that answers from the edges and guesses in the middle has a million-token window on paper and a much smaller one in practice.

**2. An agentic coding task, with the output limit raised.** The spec sheet pitches "complex agentic tasks," so give it one: a real multi-file change in Qwen Code or Cline, with tools enabled, and the output limit set high enough for thinking plus answer. Watch two things — whether it finishes the change, and whether it truncates. The second is the more useful observation: the shared output budget is the kind of detail that only shows up in real use.

**3. A multimodal check.** Video input is not new — Qwen3.8-Max already accepted it — but it is the least-tested part of this spec sheet at a million-token context. Feed it a screenshot of a UI and ask what is wrong with the layout, or a long document and ask it to extract a table. Then try a short video clip and ask it to describe what happens in it. Text and image understanding are table stakes for a flagship now; video is where this model either earns its "multimodal" label or doesn't.

Test, don't build. Anything you wire into a workflow — a prompt tuned to this model's quirks, a script pointed at the Token Plan endpoint — stops working on November 25. The preview is a tasting menu, not a dependency.

# Why a two-week preview

The preview makes more sense against the run-up to it. At the Apsara Conference on September 22, Alibaba confirmed Qwen4 was in training on a new-generation architecture, with no date. On November 2, Qwen's head stated that Qwen 4.0 and 5.0 will stay open source — a post that drew about 4,550 upvotes on r/LocalLLaMA, because rumours had circulated that Qwen4 would be the last open-weight series. On November 6, the official Qwen account posted a teaser: a poster of birds over a dark sea, the flock shaped like a fish, with the line "The becoming begins." Since around October 22, an unreleased model under the codename Kalmia has been appearing in the Arena's anonymous testing, and testers have attributed it to Qwen4 based on its output style — but that attribution is unconfirmed, and the Arena's own FAQ says pre-release models appear there without confirmation.

Read that sequence as a whole and the preview looks like a deliberate middle step, not a launch that ran out of time. Alibaba gets two weeks of real usage on a frozen model — the docs promise no changes during the window — before the real family lands, and the expiry date caps what anyone can expect from it: no support burden, no migration story, no one building a product on a model that disappears. The teaser, the open-source pledge, and the preview are all doing the same job: keeping the Qwen audience warm while the actual release — the weights, the 27B local model, the benchmarks — is still being finished.

![Animation of the two-week window. A timeline runs from November 11 to November 25, 2026. A marker moves along it in stages, and on November 25 the timeline ends and a stamp reads "RETIRED — Test it. Don't build on it".](two-weeks.gif){poster=two-weeks-poster.png}

*Fourteen days, then gone. The animation moves a marker along the timeline from November 11 to November 25, 2026, and ends with a stamp reading "RETIRED". Alibaba's docs say no changes will be made during the window and the model will be retired when it ends.*

# The verdict

Do not build on Qwen4-Max-Preview. Test it, note what it does well and where it truncates or refuses, and then let it go. If you need a Qwen flagship in production today, Qwen3.8-Max is the one with a published price and pay-as-you-go access. The dates that matter are November 25, when this preview is retired, and whenever the 27B weights and the first benchmarks land — that is when Qwen4 becomes real for the people who made Qwen the default local stack.

A flagship launch with an expiry date is a strange thing to ship. It is also, on reflection, an honest one: Alibaba is telling you exactly what this is — a look, not a product — and giving you fourteen days to look. Take the look. Just don't mistake it for the release.

# Sources

- Alibaba Cloud Model Studio, [Qwen4-Max-Preview documentation](https://www.alibabacloud.com/help/en/model-studio/qwen4-max-preview) — model ID, 1M context, 393,216-token shared output budget, thinking on by default, Token Plan only, preview November 11–25, 2026 (UTC+8), retired after; the `max_tokens` output-budget change.
- Qwen on X, [launch announcement](https://twitter.com/Alibaba_Qwen/status/2120335993643684315) — November 11, 02:01 UTC.
- Hacker News, [Qwen4-Max is now in Preview](https://news.ycombinator.com/item?id=50449130) — discussion thread, November 11.
- Yotta Labs, [Qwen 4: Release Date, Qwen4-Max Preview, and What's Confirmed (2026)](https://www.yottalabs.ai/post/qwen-4-release-date-what-is-known-how-to-prepare-2026) — Apsara Conference September 22, November 6 teaser, November 11 preview details, Kalmia Arena sightings (unconfirmed), early access in QwenWork, Qoder, the Qwen app, and QwenStudio.
- AI Signal, [November 3, 2026 digest](https://ai-signal.ericblue.com/posts/ai-signal-2026-11-03/) — the November 2 statement that Qwen 4.0 and 5.0 will stay open source, r/LocalLLaMA score 4,550.
- Fello AI, [Qwen 4 Release Date: Qwen4-Max Preview Is Out](https://felloai.com/qwen-4/) — Token Plan prices ($6/$10/$18/$43 a month), Qwen Studio in the model picker, no weights, no model card, no per-token price.
- Modelfit, [Qwen4-Max Preview: 1M Context, Cloud Only, No Weights](https://modelfit.io/blog/qwen4-max-preview-cloud-only-no-weights/) — no Qwen4 weights in the Qwen organisation on Hugging Face as of November 11; no benchmarks, no parameter count, no per-token price.
- QuantSlant, [Qwen4: Alibaba's new model family](https://quantslant.com/qwen4/) — Qwen3.8-Max launched August 3, 2026 with 1M context; Qwen Code's 32,768-token default output limit for this model.
- QwenCloud, [Token Plan pricing](https://qwencloud.com/pricing/token-plan) — Individual and Team plans, credits model.
