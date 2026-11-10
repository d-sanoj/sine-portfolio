---
title: "Your coding agent forgets everything. Claude-Mem remembers — and here's the bill"
slug: claude-mem-agent-memory
date: 2026-11-10
description: "Claude-Mem gives Claude Code a memory across sessions — 115,000 stars and counting. It works, and it's worth installing. Just don't install it the way the installer wants you to."
tags: [ai, claude, claude-code, agents, tools]
cover: cover.png
coverAlt: "Title card reading 'Your coding agent forgets everything. Claude-Mem remembers — and here's the bill', over a row of grey sine waves with one yellow wave highlighted."
---

![Title card reading "Your coding agent forgets everything. Claude-Mem remembers — and here's the bill", over a row of grey sine waves with one yellow wave highlighted.](cover.png)

Picture it: on Monday you fix a login bug with Claude Code. You decide together that card payments come before bank transfer in the checkout flow, and that the retry logic lives in one place, not three. On Tuesday you open a new session and ask it to finish the job. It asks you what bug you are talking about.

That is the deal with every coding agent right now. A session is a sealed room. When it closes, everything the agent learned about your project — the decisions, the dead ends, the bug you already fixed once — goes with it. The next session starts from zero, re-reads the same files, re-asks the same questions, and walks back into the same mistakes. The context window is the memory, and the context window gets thrown away.

[Claude-Mem](https://github.com/thedotmack/claude-mem) is the most popular answer to that problem. It is a plugin by Alex Newman that gives Claude Code — and Codex, Cursor, OpenCode, and eleven other agents — a memory that survives between sessions. It has more than 115,000 stars on GitHub, it topped GitHub's daily Trending page, and it is adding roughly a thousand stars a day. The idea is simple and the mechanism is sound. It is also, by default, a tool that watches everything your agent does, sends all of it to a second AI model, and steers you toward a $30-a-month hosted plan during install.

Both of those things are true at the same time. This post is about how the memory actually works, what it really costs, and how to install it so you get the memory without the bill you didn't agree to.

## The amnesia loop

The problem is not that agents are dumb. It is that their memory has the lifespan of a process. Claude Code keeps a transcript of the session on disk, but a new session does not read it. There is a `/compact` command and a resume flag, but those are manual, per-session, and they still hand the model a wall of raw transcript rather than the parts that matter.

So the loop looks like this: you explain the architecture, the agent does good work, the session ends, and tomorrow you explain the architecture again. The re-explanation costs tokens twice — once to say it, once for the agent to re-read the files to confirm it — and the decisions are the worst part, because nothing in the code says *why* card payments come first. That reasoning lived only in the conversation.

![Two loops side by side. On the left, without memory: a new session opens, you re-explain the project, the agent re-reads the same files, and it repeats a mistake you already fixed — then the session ends and the loop starts again. On the right, with memory: a new session opens with a short index of past decisions and fixes, the agent reads only the details it needs, and the loop ends with the work, not the re-explanation.](amnesia-loop.png)

:::describe
The diagram shows two loops. The left loop, labelled "without memory", has four steps in a column: a new session opens empty, you re-explain the project, the agent re-reads the same files, and it repeats a mistake you already fixed — then the session ends and the loop starts again. The right loop, labelled "with memory", has three steps in a column: a new session opens with a short index of past decisions and fixes, the agent reads only the details it needs, and the work gets done. The point is that the memory is not about storing more — it is about not paying the re-explanation tax every morning.
:::

A memory layer breaks the loop by doing the note-taking for you. That is the whole pitch, and it is a good pitch. The question is what the note-taker sees, who pays for the notes, and where they live.

## How it works: a second agent takes notes

Claude-Mem has four parts, and the design is the interesting half of this story. It is not a prompt trick. It is a small system that sits beside your agent.

**1. Hooks watch the work.** Claude Code has lifecycle hooks — events the editor fires when things happen. Claude-Mem registers hooks for SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, Stop, SubagentStop, and SessionEnd. Every time your agent reads a file, edits one, or runs a shell command, the PostToolUse hook hands that tool call — what it read, edited, and ran — to a small local worker. Nothing here is magic; it is the same hook system you could write yourself, wired to a note-taker instead of a log file.

**2. A second model, the observer, writes the notes.** The worker runs a second agent, called the observer, whose only job is turning tool activity into short observations: a bugfix, a decision, a discovery, a security note. The default observer is Haiku 5.5 — the `haiku` alias, which now resolves to Haiku 5.5 on the Anthropic API — Anthropic's cheapest fast model, and it runs on your own Claude plan unless you choose otherwise. When the session ends, the observer writes a summary of the whole session. This is the compression step, and it is the whole game: say a session cost you 200,000 tokens of back-and-forth; the notes become a few hundred tokens of "we decided X because Y, and the fix for Z is in this file".

**3. The notes live in a database on your machine.** Observations, sessions, and summaries go into SQLite at `~/.claude-mem/claude-mem.db`, with Chroma on top for vector search and SQLite's own full-text search for keywords. Nothing about the storage is exotic, which is the point: you can open the database and read your agent's memory yourself.

**4. The next session starts with an index, not a dump.** When a new session opens, Claude-Mem injects a compact index of the observations that matter for the project. The agent fetches full details only when it needs them. The same staged idea drives search: the mem-search skill runs three MCP tools — `search` for a compact index of results, `timeline` for the chronological context around them, and `get_observations` for the full text of only the IDs it picks. The project claims this staged search saves roughly 10x the tokens of fetching everything up front; that is the project's own number, not an independent measurement, but the direction is right — an index of 50–100 tokens per result is obviously cheaper than a pile of full observations.

![A five-step pipeline diagram titled "How claude-mem remembers". Step 1: hooks in Claude Code hand each tool call to a local worker. Step 2: the observer, a Haiku 5.5 model, turns tool activity into short observations. Step 3: observations, sessions, and summaries are stored in SQLite with Chroma for vector search. Step 4: the next session opens with a compact index of what matters. Step 5: the agent fetches full details only when it needs them, through search, timeline, and get_observations.](how-it-works.png)

:::describe
The diagram is a top-to-bottom pipeline with five boxes joined by arrows. First, hooks in Claude Code hand each tool call to a local worker. Second, the observer — a Haiku 5.5 model — turns that activity into short typed observations such as bugfix, decision, and discovery. Third, the observations land in SQLite on the machine, with Chroma adding vector search. Fourth, the next session opens with a compact index of the observations that matter for this project. Fifth, the agent fetches full details only when it needs them, using the three-step search. A note under the pipeline says the observer is a second model call, so memory costs model time on top of your own session.
:::

A few more pieces are worth knowing. Memory injection starts on your second session in a project — the first session has nothing to remember yet. If you want a whole repo front-loaded instead, there is a `/learn-codebase` command that walks the project and takes about five minutes on a typical repo, according to the README. You can also save a note on purpose with `save_memory`, and a viewer at the worker's local URL shows sessions, memory, and settings. Modes change what gets recorded: `code--chill` keeps only what would be painful to rediscover. And the plugin is not Claude-only: the installer covers Codex, Cursor, OpenCode, Gemini, Copilot, OpenClaw, Pi, and more, though Copilot CLI, Goose, Roo Code, and Warp can only search memory — their sessions are not recorded.

That is a real system, built in the open — Apache-2.0 licensed, version 15.15.1 as I write this, with 4,216 commits and a changelog that ships most days. The mechanism is the reason for the star count. The rest of this post is about the price of running it.

## The bill, part one: tokens

The observer is a second model call, and it runs once per tool event on the Claude path — the code sets the Claude observation batch size to 1, meaning one event per observer prompt. Every tool call your agent makes — except five skipped types, such as TodoWrite and AskUserQuestion — becomes an observer prompt carrying up to 16,000 characters each of the tool's input and output, plus the observer's running conversation, which the code retires and restarts once it passes 400,000 characters.

How much is that, in practice? The site [Socialvik counted its own sessions](https://www.socialvik.com/blog/claude-mem-secret-redaction-off-by-default): across 27 Claude Code sessions on its own repository, the median session made 225 tool calls, and 49% of them were shell commands. The median session sent about 219,000 tokens of tool data to the observer, which at Haiku 5.5's $0.10 per million input tokens is about $0.02 of observer input per session. That figure covers the tool data only. The observer's running conversation is re-sent in full on every call until it retires at 400,000 characters — Counterparts reports each observer turn can re-read about 100,000 tokens — which at the same short-prompt rate is roughly another $0.01 per turn, on top of the observer's replies and the context the next session injects. Cheap per call, and the reason the bill grows with session length. One more wrinkle: Haiku 5.5's cheap rate only applies to prompts up to 100,000 tokens; above that, input costs $0.50 per million, five times as much — and a conversation approaching the 400,000-character retirement cap can cross that line. That is their measurement of their own work, not a universal rate, and your mileage depends on how chatty your sessions are. But the shape of it is the point: the observer is cheap per call and constant per session, and it is a second meter running beside your own.

On the Claude provider path, that meter runs on your Claude plan. The README is upfront about the trade: the hosted observer exists so memory "runs off-plan, so you get up to 100% more usage from your plan". That "up to 100%" is the project's own pitch — a hardcoded number in its code, not a measurement — but the direction is right: on the local path every tool call is processed twice, once by the agent doing the work and once by the observer writing it down. That is the honest cost of the feature: a memory that writes itself is a memory that reads everything you do, twice.

## The bill, part two: money

This is where the installer earns its keep — for the company, not for you. Run `npx claude-mem install` interactively and the provider prompt comes with CMEM Pro, the hosted observer, already selected. The source code says so in plain language: "CMEM Pro pre-selected: it is the recommended path and the one the funnel is built around." Selecting it no longer means "pay now", the comment adds — it opens the offer page to read first. But the funnel is the funnel: the installer asks you to sign in with an email magic link, and choosing the hosted observer starts a 30-day free trial on a checkout page that asks for a payment method. The README says the sign-in needs no card; the checkout page is where the card comes in. The offer page itself is explicit: 30-day free trial, then $30 a month, card required, billing starts after 30 days or earlier if you spend the included usage, and plans automatically upgrade when you reach their included limit. Above Pro there are Heavy at $70 and Max at $100 a month.

None of that is hidden — the README says the trial's checkout page "asks for a payment method", and the code comment says the card requirement lives there deliberately: "The billing disclosure lives on the checkout page, not here. It is a term of the charge, so it belongs on the screen that takes the payment method." That is a defensible position and a convenient one. A trial that asks for a card and auto-upgrades on usage is a subscription that starts billing unless you act. When the trial ends, memory falls back to your Anthropic plan unless you subscribe — which is the graceful part — but the default path is still sign-in, card, trial, subscription.

The hosted observer is not the only path, and the project does not hide that either. Pass `--provider claude` and the installer skips the sign-in entirely; headless installs land on your own Claude plan by default. You can also use your own OpenRouter or Gemini key. Cloud sync is opt-in, and the memory itself lives in `~/.claude-mem` on your machine either way. The paid product is the hosted observer and the sync, not the memory. The problem is only that the default install is the paid path with the free path one flag away, and a thousand people a day are clicking through it.

![Animation of the observer at work: a tool call flows to the observer, which writes one short note — "Decision: card payments before bank transfer, because refunds are simpler" — into the SQLite database. The next day, the same note arrives in a new session as part of a compact index.](observer-notes.gif){poster=observer-notes-poster.png}

*One tool call becomes one note, and the note comes back. The animation shows a tool call flowing to the observer, the observer writing a short decision note, and that note arriving in the next day's session index.*

## The bill, part three: what the observer sees

A memory layer that watches every tool call is a privacy decision, and the defaults here are worth reading before you install, because three of them point the wrong way.

**Secret redaction is off by default.** The project ships 38 built-in redaction patterns — AWS keys, GitHub tokens, Anthropic and OpenAI keys, Slack tokens, JWTs, private keys, database URLs with passwords in them — plus four generic patterns for things like `password=` and `Authorization: Bearer`. All of it is opt-in: `CLAUDE_MEM_REDACT_ENABLED` defaults to `'false'` in the source. The docs say one line in `settings.json` turns the 38 patterns on. Until you write that line, the observer reads your tool calls unredacted, and half of a typical session's tool calls are shell commands — exactly where secrets print. A `curl` response echoing a bearer token, a `cat .env` while debugging a webhook, a database URL in a stack trace: all of it goes to the observer as input, and the observations it writes can carry the secret into the database. There is a manual escape hatch — wrap anything in `<private>` tags and it is stripped at the hook layer before storage — but you have to remember to wrap it, every time.

**Telemetry is on by default.** The telemetry doc says so directly: "It is on by default (opt-out)." The events are anonymous, identified only by a random install UUID, and every property passes a whitelist. The installer does ask once at the end of an interactive install, so the default is not silent for new installs — but in CI or non-interactive installs the prompt is skipped and telemetry stays on. `npx claude-mem telemetry disable` turns it off, and the standard `DO_NOT_TRACK` variable is honored. Still: a tool that watches your agent should not also phone home unless you said yes.

**Screenshots are kept by default.** Tool screenshots are converted and stored under `~/.claude-mem/media-v1/` unless you turn "Keep images" off in the viewer. They are uploaded to cmem.ai only when cloud sync is on, and sent to the observer only when image inference is separately enabled — but they are on disk by default, and screenshots of a terminal are where credentials tend to appear.

Then there is the incident. In version 15.2.0, released October 25, the browser setup page opened by the installer scanned local agent histories and uploaded the full text of the last 30 days of prompts — session IDs, project names, folder paths, timestamps — without asking. It stayed that way for eight days. Version 15.8.3, released November 2, fixed it: the scan now reads local history only, then stops and asks; a consent panel lists each detected tool with its prompt count, and only ticked tools are uploaded. The changelog is admirably blunt about it. It is also blunt about what the fix does not do: prompts already uploaded by earlier versions are not removed by the update, and "server-side handling at cmem.ai and privacy-policy wording are outside this change". The fix was fast and public, which counts for something. The eight days it took to notice counts too.

None of this makes claude-mem spyware. It makes it a tool built by people who optimise for growth — a pre-selected paid tier, telemetry on, redaction off, screenshots on — and then document all of it, in the open, where you can read it. That is a better position than most tools with this star count are in. It is still a position you should install around, not through.

## How to install it safely

The safe install is the same tool with different defaults. It takes five minutes, and it is the version of this post I would actually hand to a friend.

First, install with the local provider, so there is no sign-in and no trial:

```
npx claude-mem install --provider claude
```

That one flag skips the browser sign-in and the CMEM Pro offer entirely. Memory runs on your own Claude plan — the observer is Haiku 5.5, the cheap one — and no prompts, file contents, paths, or project names leave your machine (telemetry, which step 3 turns off, is the one exception).

Second, turn on secret redaction before your first real session. In `~/.claude-mem/settings.json`:

```json
{
  "CLAUDE_MEM_REDACT_ENABLED": "true",
  "CLAUDE_MEM_REDACT_GENERIC_ENABLED": "true"
}
```

That switches on the 38 built-in patterns plus the four generic ones, which catch the passwords and bearer tokens that have no recognisable key format. It will not catch everything — no regex list does — so keep the `<private>` habit for anything you would not paste into a chat window.

Third, turn off the two defaults that send data out or keep more than you need:

```
npx claude-mem telemetry disable
```

Then open the viewer and switch "Keep images" off, unless you actually want screenshots of your terminal in the database. If you work on one machine, leave cloud sync off; it is opt-in and off by default, and the local memory is the whole point.

Fourth, decide how chatty the memory should be. The default mode records nearly everything it sees. If you want fewer notes, set `"CLAUDE_MEM_MODE": "code--chill"` in the same settings file — it keeps only what would be painful to rediscover. Restart Claude Code after changing the mode.

Fifth, check what it wrote. After a session or two, open the viewer and read the observations. The database is at `~/.claude-mem/claude-mem.db`, and the viewer shows you the sessions and the notes. If a secret slipped in before you turned redaction on, you will see it there, and you can delete it — which is more than you can say for most tools that watch you work.

![Animation of a new session starting with memory: the session opens empty, a compact index of past observations slides in — three entries labelled decision, bugfix, and discovery — and the agent answers a question about the checkout flow using the decision entry, without re-reading the files.](recall.gif){poster=recall-poster.png}

*A new session opens with a short index of past decisions and fixes, and the agent answers from it. The animation shows the index arriving at session start and the agent using one entry to answer without re-reading the files.*

![A checklist titled "The safe install, in five steps". Step 1: install with --provider claude to skip the sign-in and the trial. Step 2: turn on redaction — 38 built-in patterns plus 4 generic — in settings.json. Step 3: disable telemetry and switch "Keep images" off. Step 4: pick code--chill mode if you want fewer notes. Step 5: open the viewer after a session or two and read what it wrote.](safe-install.png)

:::describe
The diagram is a checklist with five numbered steps. First, install with the --provider claude flag to skip the sign-in and the trial. Second, turn on redaction — 38 built-in patterns plus four generic ones — in settings.json. Third, disable telemetry with the telemetry command and switch "Keep images" off in the viewer. Fourth, pick code--chill mode if you want fewer, higher-value notes. Fifth, open the viewer after a session or two and read what the observer wrote. A note at the bottom says the memory lives in ~/.claude-mem on your machine either way; the paid product is the hosted observer and the sync, not the memory.
:::

## The verdict

Install it. The problem it solves is real — every coding agent forgets everything between sessions, and re-explaining your project every morning is a tax you pay in tokens, time, and repeated mistakes. The mechanism is the right one: hooks capture the work, a cheap model compresses it into typed notes, and the next session gets an index instead of a transcript dump. A hundred and fifteen thousand stars is not proof of quality, but it is proof that a lot of people with the same problem tried this and stayed. The project is Apache-2.0, the storage is a SQLite file you can open, and the changelog is honest about the incident that matters most.

But install it the way I described above, not the way the installer wants you to. The default path pre-selects a hosted trial that asks for a card, leaves secret redaction off, leaves telemetry on, and keeps screenshots — and for eight days last month it uploaded a month of your prompts without asking. None of those defaults is a reason to skip the tool. All of them together are a reason to spend five minutes setting it up deliberately. A memory layer should remember what you did. It should not also remember your passwords, phone home by default, and bill you for the privilege.

## Sources

- [Claude-Mem repository](https://github.com/thedotmack/claude-mem) — README, version 15.15.1, 115,631 stars and 10,039 forks as of November 10, 2026; "How It Works", the MCP search tools, the install instructions, and the provider and screenshot defaults are all from the README.
- [Claude-Mem changelog, versions 15.2.0 and 15.8.3](https://github.com/thedotmack/claude-mem/blob/main/docs/CHANGELOG.md) — the October 25 prompt upload and the November 2 consent-panel fix, including the note that already-uploaded prompts are not removed by the update.
- [Auto-redaction docs](https://github.com/thedotmack/claude-mem/blob/main/docs/public/usage/auto-redaction.mdx) — 38 built-in patterns, four generic patterns, both off by default.
- [Telemetry docs](https://github.com/thedotmack/claude-mem/blob/main/docs/public/telemetry.mdx) — on by default, anonymous, one command to opt out.
- [Security policy](https://github.com/thedotmack/claude-mem/blob/main/.github/SECURITY.md) — `<private>` tags stripped at the hook layer, command-injection fix of December 2025.
- [CMEM Pro offer page](https://cmem.ai/pro) — 30-day free trial, then $30 a month, card required, automatic upgrade on hitting the included limit; Heavy $70 and Max $100 tiers.
- [Socialvik, "Claude-Mem Privacy: Secret Redaction Is Off by Default"](https://www.socialvik.com/blog/claude-mem-secret-redaction-off-by-default) — median session of 225 tool calls, 49% shell commands, about 219,000 tokens sent to the observer, about $0.22 at Haiku 4.5's $1 per million input tokens; counted from the author's own 27 sessions, September 14 to October 16, 2026. (That $0.22 is at the Haiku 4.5 rate Socialvik used; at the current Haiku 5.5 rate the same 219,000 tokens cost about $0.02 — see the cost section.)
- [Counterparts, "Claude-Mem: CLAUDE.md files, usage costs, and where its data lives"](https://counterparts.ai/guides/claude-mem/) — the provider prompt, the trial terms, and the state of the three most-searched complaints as of version 15.9.0.
- [Solosoft, "Claude-Mem at 104,793 Stars"](https://www.solosoft.dev/post/claude-mem-104793-stars-memory-cost-and-silent-truncation/) — the installer source comments, the one-event-per-prompt batch size, and the offer-page wording.
- [Toolclove, "8 Trending GitHub Projects"](https://toolclove.com/blog/trending-github-projects-november-2026) — Claude-Mem topping GitHub's daily Trending page in early November, adding more than 1,500 stars in a day.
- [Anthropic API pricing](https://platform.claude.com/docs/en/about-claude/pricing) — Haiku 5.5 at $0.10 per million input tokens and $0.50 per million output tokens for prompts up to 100,000 tokens ($0.50/$2.50 above), the rate behind the observer cost estimates.
- Settings defaults, the installer provider prompt, and the observer conversation limit are from the project's own source on `main`: `src/shared/SettingsDefaultsManager.ts` (redaction off, batch size 1, 400,000-character observer conversation cap, provider default) and `src/npx-cli/commands/install.ts` (CMEM Pro pre-selected, billing disclosure on the checkout page). The Haiku 5.5 default is from `src/server/generation/providers/ClaudeObservationProvider.ts`, which names Haiku 5.5 as the observer's default model, and the `haiku` alias in `SettingsDefaultsManager.ts`.
