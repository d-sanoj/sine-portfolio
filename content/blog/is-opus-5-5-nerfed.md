---
title: "Is Opus 5.5 nerfed? The trackers say no. One user's logs say yes. Measure it yourself."
slug: is-opus-5-5-nerfed
date: 2026-11-11
description: "Half my timeline says Opus 5.5 got dumber. The public trackers disagree, one user's 6,638-answer log shows a real step change, and the only way to know for yourself is a frozen test — so I built one."
tags: [ai, claude, claude-code, opus, benchmarks, tools]
cover: cover.png
coverAlt: "Title card reading 'Is Opus 5.5 nerfed?' over two diverging lines: a flat line labelled 'the trackers' and a falling line labelled 'one user's log'."
---

![Title card reading "Is Opus 5.5 nerfed?" over two diverging lines: a flat line labelled "the trackers" and a falling line labelled "one user's log".](cover.png)

Half my timeline says Claude Opus 5.5 got nerfed. "Nerfed" is the word of the week — the one developers reach for when a model that was sharp on Monday feels blunt on Friday. Data and AI engineer Irushi wrote that she "actually counted NINE times that it repeated the same rejected approach despite strict instructions." Another developer reported an overnight agent run that produced "complete garbage" and wrote: "This NEVER happened before." One count put it at roughly 2,700 posts on the topic in 24 hours. Some users now say they prefer Sonnet 5.5 for consistency.

And the trackers built to answer exactly this question say nothing happened. Both claims are on the table at the same time, and both have receipts. This post is about what each side actually measured, why they can both be right, and what you can do about it — which turns out to be more than arguing on X. I built a small frozen regression suite for your coding agent, [nerf-watch](https://github.com/d-sanoj/claude-skills/tree/skill/nerf-watch/nerf-watch), so the next time your model feels dumber, you can check a number instead of a vibe.

# The case for "nerfed"

The complaints are not new, and they did not start this week. The first cluster followed a Claude outage on September 29, when a Reddit thread titled "Opus 5.5 feels way dumber after today's outage, anyone else noticing this?" drew more than 400 upvotes, with commenters split roughly down the middle. On October 5, GitHub issue #99572 claimed quality had "degraded back to level of opus 5." On October 24, a former member of the Claude Code team asked on X whether Opus 5.5 had become dumber, in a post that passed 970,000 views.

The latest wave crested on November 4–6, and its shape is specific enough to take seriously. The complaint is not "it writes worse code." It is that the model ignores instructions, repeats solutions it was told to drop, and spawns sub-agents for small jobs. One user had Gemini 4 Argon analyze 1,400 of his own Claude Code sessions and found that around November 3 the model name stayed the same but its reasoning style took a sharp turn. That is one user's data, judged by another model, with the raw data not published — so treat it as a lead, not a verdict. But it is the kind of lead that fits the other reports: something changed around the start of November, and it changed in the harness around the model, not in a way anyone announced.

That timing matters, because the harness did change. Claude Code 2.1.316 added a `CLAUDE_CODE_SUBAGENT_EFFORT` setting, so sub-agents run at a named effort level instead of inheriting the session's. Version 2.1.318, shipped November 3, added an `effort` option on a mod's model fork, so a quick side job can run at `low` whatever effort the session uses. And T3 CEO Theo, after digging in, said Anthropic appears to be rolling out a change to the reasoning summarizer per account, and that he saw no sign of degraded capability. A summarizer change would explain exactly what the session-analysis user saw — the same model, a different-looking reasoning style — without any capability dropping at all. It would also be invisible to the person using the model, because on Opus 5.5 most thinking is hidden: Opus 5.5 launched with preserved thinking on API accounts created on or after August 31, 2026, which Anthropic describes as an anti-distillation safeguard, and the author of the GitHub issue below notes that only about one thinking block in ten carries visible text.

# The case against

Two public trackers measure Opus 5.5 every day, and neither sees a drop.

[LiveNerf](https://github.com/ninjahawk/livenerf) runs the same frozen panel of 78 questions through headless Claude Code on a Max subscription, with a pinned CLI version (2.1.280) and the UK AI Security Institute's Inspect framework. As of November 10 — day 48 — it reported "no change detected in Opus 5.5 on the frozen panel" across three full 10-day windows; the third window sat at +0.028 ± 0.023 versus launch week. Its pre-registered rule needs a significant shift before it calls one, and it can detect a change of roughly 6–7 points per window. A small drop could hide under that floor, but a "the model is ruined" drop could not.

BridgeBench's NerfBench reruns 50 coding and reasoning tasks three times each, and has kept every Opus 5.5 run inside 90–110% of its launch score — most recently 105.8% of launch, with the verdict "No nerfs detected" on October 16.

Anthropic has not publicly responded to the complaints — nothing found as of November 7 — which is the part of this story that should bother you most, and I will come back to it. But on the question "did the model's capability fall off a cliff," the independent measurements say no.

# The one log that won't go away

Then there is GitHub issue [#105112](https://github.com/anthropics/claude-code/issues/105112), and it is the reason this post exists. It is the most rigorous complaint on record, and it is hard to dismiss, because its author did the work the trackers cannot do: he measured his own real sessions.

He scored 6,638 Opus 5.5 answers from his local Claude Code transcripts — 5,738 in the four weeks before October 19, 900 after. A script flags each answer his next message corrects, or that Claude's next reply opens by retracting. Before October 19, 5.2% of answers were corrected. After, 25.4%. Counting only his own corrections, the rise is 3.3% to 20.2%. On the strictest measure — first answers, and fresh questions asked before any correction in the session — the rate tripled, from 5.2% to 15.4%. The step falls between Sunday, October 18, 8:52 PM and Monday, October 19, 1:13 PM Pacific. In a November 4 update, the rate for November 2–4 was still 17.0%, against 3.6–7.0% from late August to mid-October. A second user filed a similar report (#105477) on a different operating system and build.

The shape of the failure is what makes it interesting. This is not laziness. Per answer, Opus 5.5 does as much work as before or more: the same median of 6 tool calls, the same share of quick answers, and more billed thinking at medium, high, and xhigh effort. It reads the files and runs the lookups, sometimes reading the exact fact that settles the question — and then writes an answer that ignores or contradicts what it read. In blind labels of his corrections, "ignored context already loaded or on disk" rose from 1.14 to 9.36 per 100 prompts, the largest single type, while outright false statements stayed rare. One example: Claude recommended re-adding a fantasy-football player it had advised dropping hours earlier, with the row recording that drop in the last tool result it read before answering. Its answer even said the move "partly undoes" the earlier one, and recommended it anyway.

And raising effort does not help. The corrected share rose at every level:

| Effort | Before Oct 19 | Oct 19–25 |
| --- | --- | --- |
| Medium | 5.3% of 3,524 | 21.5% of 172 |
| High | 5.4% of 1,161 | 26.6% of 533 |
| Xhigh | 4.8% of 930 | 20.1% of 159 |
| Max | 5.6% of 108 | 50.0% of 36 |

More reasoning, same failure. The author puts it well: it buys more reasoning that gets dropped the same way.

The waste is the part that should make you wince. Since October 19, 15.5% of all tool calls and 20.7% of all billed thinking went into answers that were then corrected, against 4% to 6% in each earlier week. You pay in full for the research and the reasoning, those tokens are wasted when the answer leaves that work out, and then you pay again to correct it. The retry right after a correction was itself corrected 41.5% of the time, against 10.0% before.

He also checked what he could on his own side, and the checks are careful: the client build (2.1.303) ran on both sides of the window; the system-prompt and tool-definition hashes and request settings were identical; the fixed prefix read exactly 29,503 cached tokens on the first request of all 43 sessions; no context trimming ran; his CLAUDE.md and memory index were byte-identical in sessions started across the window. He cannot rule out a server-side change, because that is the one thing only Anthropic can see. That is the point.

# Why both sides can be right

"The model got worse" can mean four different things: the weights changed, the serving infrastructure changed, the harness around the model (Claude Code, system prompts, effort defaults) changed, or your own workload changed. Only the first is supposed to stay frozen behind a model name. The trackers and the issue measure different layers, and that is why they disagree.

LiveNerf and NerfBench measure capability on fixed, mostly single-shot questions, through a pinned client, with the effort set. The complaints come from long, stateful agent sessions in Claude Code where context, tools, memory files, and hidden system prompts all interact. A model can answer a frozen 78-question panel as well as ever and still get worse at "read this file, then act on it" inside a 200,000-token session. Issue #105112 is precisely about that gap: research done, then ignored.

Three known confounders sit in the harness layer, and each one explains part of the "feels dumber" reports without any weights changing:

**The effort default.** Opus 5.5 defaults to `medium` effort; Opus 5 defaulted to `high`. A request that omits effort runs one level lower than it did on the older model. In Claude Code the defaults are `medium` on Opus 5.5, Sonnet 5.5, and Haiku 5.5, `xhigh` on Opus 4.7, and `high` on other models. Anthropic's own testing says Opus 5.5 at `medium` matches or beats Opus 5 at `high` on coding evaluations — but "the default changed" and "the model got worse" feel identical from the outside, and most users never set effort explicitly. The scale is calibrated per model, so `medium` on Opus 5.5 is not the same amount of work as `medium` on Opus 5.

**The hidden reasoning.** Opus 5.5 launched with preserved thinking, which Anthropic describes as an anti-distillation safeguard, and only about one thinking block in ten carries visible text. Users cannot inspect why an answer went wrong, so "it feels worse" is hard to prove or disprove — and a summarizer rollout that changes what the visible reasoning looks like reads as a capability change.

**The client updates.** Claude Code ships most days, and the harness moves under you. In issue #99572, one commenter logged median thinking per turn falling from 196 to 63 tokens after a Claude Code auto-update and said rolling back "restores quality" — a single user's measurement, but the mechanism is real: a client update can change what the model is asked to do without the model changing at all.

![Two panels. Left: the trackers — a flat line labelled "LiveNerf, 78-question panel" stays level from launch week through November 10, and a second line labelled "NerfBench" stays inside a band marked 90 to 110 percent of launch. Right: one user's log — a bar chart of corrected answers per week, flat at about 5 percent for four weeks, then jumping to 25.4 percent in the week of October 19 and 17.0 percent for November 2–4.](two-sides.png)

:::describe
The diagram has two panels. The left panel, "The trackers", shows a flat line for LiveNerf's frozen 78-question panel from launch week through November 10, and a band from 90 to 110 percent of launch score holding NerfBench's runs. The right panel, "One user's log", is a bar chart of corrected answers per week from GitHub issue #105112: about 5 percent for the four weeks from September 21 to October 18, then 25.4 percent in the week of October 19, and 17.0 percent for November 2–4. The point is that fixed single-shot questions and long stateful sessions measure different things, so the two panels can both be right.
:::

# The real problem: you rent a moving target

Step back from who is right, because there is a structural problem underneath the argument: you rent a hosted model by name, and nothing in that name promises the behavior stays put. There is no changelog for serving, no notice when a safeguard routes your request to a different model, and no way to see the effort level actually applied to a given request, the hidden reasoning, or a server-side prompt change behind your answers. Anthropic's launch post says Opus 5.5's cybersecurity, biology, and distillation safeguards "fall back to another model transparently" — most cybersecurity tasks are re-routed to Opus 4.8. That is documented behavior. But "transparently" there means silently, and a user watching a coding session cannot tell a fallback from a regression.

Anthropic has degraded quality unintentionally before and said so. In its April 23, 2026 postmortem, the company traced weeks of Claude Code complaints to three product changes: a default effort cut from high to medium, a caching bug that repeatedly cleared prior thinking, and a system-prompt change to limit verbosity. All were fixed by April 20 in version 2.1.116. In both that case and a September 2025 postmortem, the model weights had not changed. The cause was the harness, both times.

So the most likely story is boring and important at once: nothing was "nerfed" in the weights, and something real changed in the stack around the model, for at least some users, and nobody outside Anthropic can see what. The biggest problem is the silence. A short statement — whether anything changed in serving, safeguards, or server-side prompts around October 19 — would settle more than any benchmark. Until labs publish serving-level change notes, every serious team needs its own frozen regression suite, explicit effort settings, and a tested fallback model.

That last sentence is the whole post, really. Here is the suite.

# Nerf-watch: measure it yourself

[nerf-watch](https://github.com/d-sanoj/claude-skills/tree/skill/nerf-watch/nerf-watch) is a new skill in my [claude-skills repo](https://github.com/d-sanoj/claude-skills). It runs eight small frozen tasks through Claude Code in headless mode — a median function, an off-by-one, a read-then-answer check, a filtered sum, a crashing startup, an explanation, an empty-input edge case, a deduplication refactor — with a pinned model and effort, and scores them with deterministic checks. Same tasks, same model, same effort, every week. If the score drops, something changed. If it doesn't, the model is fine and the problem is somewhere else.

![A five-step pipeline titled "How nerf-watch works". Step 1: freeze eight tasks — prompts, fixtures, and checks that never change. Step 2: run them weekly through claude --bare -p with a pinned model and effort. Step 3: score each task with deterministic checks. Step 4: log the result as one JSON file per run. Step 5: compare two runs — two or more tasks flipping is worth investigating, one is noise.](how-nerf-watch-works.png)

:::describe
The diagram is a top-to-bottom pipeline with five boxes joined by arrows. First, freeze eight tasks: prompts, fixtures, and checks that never change once they have a logged run. Second, run them weekly through Claude Code in headless mode with a pinned model and effort. Third, score each task with deterministic checks — shell commands that must exit zero, exact output, or strings the answer must contain. Fourth, log the result as one JSON file per run, recording the date, model, effort, CLI version, and cost. Fifth, compare two runs: two or more tasks flipping is worth investigating, one is noise on an eight-task panel.
:::

Install it by copying the folder into your skills directory:

```bash
cp -r nerf-watch ~/.claude/skills/
python3 ~/.claude/skills/nerf-watch/scripts/run_suite.py \
    --model claude-opus-5-5 --effort medium
```

The first run is your baseline. Run it again weekly, or after a Claude Code update, or whenever the model feels off, and compare:

```bash
cd ~/.claude/skills/nerf-watch
python3 scripts/compare.py results/<older>.json results/<newer>.json
```

Three rules keep the comparison honest: pin the model and the effort, freeze the tasks, and keep the log. The result file records the date, model, effort, CLI version, and cost of every run, because all of those are suspects when a score moves.

One of the eight tasks is there because of #105112. It hands the agent a notes file with two figures — 41,200 signups for the week of November 2, 47,800 for the week of November 9, marked the newest — and asks for the newest figure. The check requires the answer to name 47,800 and forbids it from naming 41,200. That is the exact failure shape from the issue: the research done, then dropped. A suite that cannot catch that failure is not measuring what the complaints are about.

![Animation of the failure shape from GitHub issue #105112. First, a notes file holds two figures, 41,200 for the week of November 2 and 47,800 for the week of November 9, marked newest. Second, the agent reads the file. Third, the agent answers with the old figure, 41,200 — the research was done, then dropped before the answer.](read-then-drop.gif){poster=read-then-drop-poster.png}

*The research gets done, then dropped. The animation shows a notes file with two figures, the agent reading it, and the answer naming the old figure instead of the newest.*

![Animation of one nerf-watch task running. First, the task prompt arrives with its fixture files in a fresh temp directory. Second, Claude Code runs headless with a pinned model and effort. Third, deterministic checks run against what the agent left behind. Fourth, the pass or fail is written to the run's JSON log.](suite-run.gif){poster=suite-run-poster.png}

*One task, end to end. The animation shows the prompt and fixtures arriving in a fresh directory, the headless run, the checks, and the result landing in the log.*

# What you can control

A suite is only half the answer. The other half is the settings that keep the harness still while you measure it:

**Set effort explicitly.** `/effort status` shows the current level in a session; `/effort high` changes it, and the level is saved for that model. For one command, `claude -p "..." --effort high`. The `CLAUDE_CODE_EFFORT_LEVEL` environment variable sets it for everything, and `CLAUDE_CODE_SUBAGENT_EFFORT` sets the level sub-agents run at (Claude Code 2.1.316 and later). If you have never touched effort on Opus 5.5, you are running at `medium` — which is the documented default, not a downgrade — and Anthropic's guidance is to run an effort sweep on your own evals rather than carrying over the `high` you used on Opus 5.

**Pin the CLI version while investigating.** `npm install -g @anthropic-ai/claude-code@<version>` installs exactly that version, and `claude --version` tells you what you have. A harness change can move scores without the model changing, and the result files record the version so you can see it.

**Keep a tested fallback model.** If Sonnet passes where Opus fails, the problem is specific to one model, not your setup. If the fallback fails too, the problem is your harness. And the fallback got better this week: Anthropic launched Claude Fable 5.2, at $8 and $40 per million input and output tokens, generating output up to 30% faster than Fable 5.1. At high effort it scores about level with Opus 5.5 at max effort on FrontierCode 2.0, for roughly half the cost per task — and Anthropic's own recommendation is still to start with Opus 5.5 as the daily driver and switch up to Fable for the hardest work. The escape hatch exists, and it is cheaper than the argument.

![Four stacked layers. At the bottom, "Weights" — the model itself, frozen behind its name. Above it, "Serving" — routing, safeguards, and fallbacks you cannot see. Above that, "Harness" — Claude Code, system prompts, and effort defaults, which ship most days. At the top, "Your workload" — session length, context size, and task mix. A note reads: only the bottom layer is supposed to stay frozen; a change in any of the other three feels exactly like a nerf.](four-layers.png)

:::describe
The diagram shows four stacked layers. At the bottom is Weights: the model itself, frozen behind its name. Above it is Serving: routing, safeguards, and fallbacks you cannot see. Above that is Harness: Claude Code, system prompts, and effort defaults, which ship most days. At the top is Your workload: session length, context size, and task mix. A note under the stack reads: only the bottom layer is supposed to stay frozen; a change in any of the other three feels exactly like a nerf.
:::

# What a drop means, and what it doesn't

Be honest about what eight tasks can and cannot tell you. The panel is small on purpose — it runs in minutes and should cost only cents. It can tell you *your* agent got worse at *your* kind of work. It cannot tell you the weights changed. It measures the whole stack — model, CLI version, system prompt, effort level — together, which is the point, because that is what you actually use. And it does not measure long sessions: the tasks are single-shot, while the #105112 failures showed up in long stateful work. If that is your workload, add a long-session task of your own, and keep it frozen once it exists.

A drop does not prove a nerf. Before blaming the model: check whether the CLI updated, whether the model or effort changed, whether any task file changed, re-run once, and then switch to your fallback model and re-run. Only after all five, file a report with your two result files attached. Numbers beat vibes, and a vendor can act on a frozen panel with dates. It cannot act on "feels dumber."

The honest summary of the week is this: the trackers say Opus 5.5 answers fixed questions as well as it did at launch. One user's careful log says it contradicts its own research a quarter of the time since October 19, at every effort level. Both measurements are real, they measure different things, and the gap between them is the harness — effort defaults, hidden reasoning, client updates, serving you cannot see. You cannot fix the harness. You can pin it, measure it, and keep a fallback ready. That is what nerf-watch is for.

# Sources

- Anthropic, [Introducing Claude Opus 5.5](https://www.anthropic.com/news/claude-opus-5-5) — launch pricing ($4/$20 per million input/output tokens, cache reads $0.20), 40% cheaper to run than Opus 5, 30% faster output, 66.4% on Terminal-Bench 4.0.
- Anthropic, [Introducing Claude Fable 5.2 and Claude Mythos 5.2](https://www.anthropic.com/news/claude-fable-and-mythos-5-2) — $8/$40 per million tokens, up to 30% faster outputs, Fable 5.2 at high effort about level with Opus 5.5 at max effort on FrontierCode 2.0 for roughly half the cost per task; Opus 5.5 recommended as the daily driver.
- Anthropic, [Claude Opus 5.5 migration guide](https://platform.claude.com/docs/en/models/opus-5-5/migration-guide) — Opus 5.5 defaults to `medium` effort where Opus 5 defaulted to `high`; set effort explicitly.
- Anthropic, [What's new in Claude Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5) — adaptive thinking always on, effort controls thinking depth.
- Anthropic, [An update on Claude Code quality reports (April 23, 2026)](https://www.anthropic.com/engineering/april-23-postmortem) — the April postmortem: effort default cut, caching bug, system-prompt change; fixed in 2.1.116.
- Anthropic, [A postmortem of three recent issues (September 17, 2025)](https://www.anthropic.com/research/a-postmortem-of-three-recent-issues) — three infrastructure bugs degraded responses for weeks; at the worst hour on August 31, 16% of Sonnet 4 requests were affected. The weights had not changed.
- GitHub, [Issue #105112: Opus 5.5 since Oct 19](https://github.com/anthropics/claude-code/issues/105112) — 6,638 answers scored; corrections 5.2% to 25.4%; the effort table; the step between October 18, 8:52 PM and October 19, 1:13 PM PT.
- [LiveNerf](https://github.com/ninjahawk/livenerf) — frozen 78-question panel, pinned CLI 2.1.280, no change detected through November 10.
- i10x, [Claude Opus 5.5 Nerfed? Complaints vs. Tracker Data](https://i10x.ai/news/claude-opus-5-5-nerf-complaints-data) — the ~2,700-post count, the NerfBench figures, the timeline of complaints, and the note that Anthropic had not publicly responded as of November 7.
- Claude Code changelog, [v2.1.316–v2.1.318](https://www.gradually.ai/en/changelogs/claude-code/) — `CLAUDE_CODE_SUBAGENT_EFFORT` (2.1.316), effort option on a mod's model fork (2.1.318, November 3).
- AICoder, [X Discussion: "Is Opus 5.5 Nerfed?"](https://aicoder.com/news/news-20261107-x-discussion-opus-5-5-nerf-debate-1400-claude-code-sessions-theo-reasoning-summarizer) — the 1,400-session analysis and Theo's reasoning-summarizer account.
