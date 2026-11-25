---
title: "Your agent's code looks nothing like yours. Stop writing rules. Write checks."
slug: your-agents-code-looks-nothing-like-yours
date: 2026-11-15
description: "I measured my own repo conventions and found the enforceable ones are the boring mechanical ones, while error handling is mixed everywhere, so I built a skill that turns conventions into checks."
tags: [ai, claude-code, coding-agents, conventions, tools]
cover: img/cover.png
coverAlt: "Title card reading 'Your agent's code looks nothing like yours' with the subtitle 'Same task, different conventions — and the fix is a check, not a paragraph', over two code files side by side: one labelled 'how the repo writes it' and one labelled 'how the agent wrote it', joined by an unlabeled arrow."
---

![Title card reading "Your agent's code looks nothing like yours" with the subtitle "Same task, different conventions — and the fix is a check, not a paragraph", over two code files side by side: one labelled "how the repo writes it" and one labelled "how the agent wrote it", joined by an unlabeled arrow.](img/cover.png)

The first week with a coding agent is impressive. By the third week, the review comments start repeating: "we don't use that logger here", "this should follow the orders service", "don't call the payments API directly." The agent writes good code. It just keeps writing it the way most projects do, not the way yours does.

I know that pattern from the other side now, because this week I measured it on my own repo instead of nodding along. The repo is this site — 94 JavaScript files, 8,018 lines — and I thought I knew how it was written. I was wrong in the interesting direction: the conventions I could prove are not the ones I would have written down, and the convention I would have written down first turns out not to exist.

# Why telling it your style does not stick

A model learns its defaults from an enormous amount of public code. It knows how most projects name things, how most apps lay out components, which HTTP client most people reach for. Your team's conventions are, almost by definition, the places where you decided to do something different from the default. And those decisions rarely live in the code itself. They live in review comments from two years ago, a wiki page nobody opens, and the head of the engineer who set up the service.

When a coding agent starts a session, it sees the files it reads and the instructions it loads. If a convention is not in either, the agent falls back to the average choice — which is exactly the choice your team decided against.

The usual fix is to write the rules down where the agent reads them: a `CLAUDE.md` at the repo root, which Claude Code loads at the start of every session. Claude Code's own `/init` command will even generate a starter one from your codebase. That helps. But it is the weakest channel there is, and there is a good ranking of why. One write-up of this exact problem orders enforcement mechanisms by how hard they are to ignore: a formatter that rewrites the file, a linter with a non-zero exit code, a type system or a test that asserts structure, a committed example file — and last, a rule written in prose in your instructions file, which the agent ignores frequently. "Prose in a config file is a suggestion. A failing exit code is a fact."

That ranking is the whole argument of this post. I did not need a better instructions file. I needed to know what my repo already does, written as checks the agent runs on its own diff.

![A five-rung ladder of enforcement, strongest at the top, titled 'Push every rule as far up as it will go': 1, a formatter that rewrites the file; 2, a linter with a non-zero exit code; 3, a type system or a test that asserts structure; 4, a committed example file; 5, a rule written in prose in your instructions file, highlighted in red and labelled 'frequently ignored'.](img/tier-ladder.png)

# The experiment: measure the repo, don't assert about it

I wrote a small extractor — plain Python, no packages — that walks a repo and counts, per dimension, what the code actually does. File naming. Declarations. Quote style. Semicolons. Error handling per directory. Logging per directory. Module system. Commit messages. A pattern becomes a rule only when it is dominant: at least 80% of the measured cases, in the scope where it applies. Anything below that is reported as mixed — a decision for a human, not a rule for a checker. The threshold matters: without it, you end up enforcing coin flips.

Here is what my repo actually does, measured on 2026-11-15:

![Bar chart of measured conventions. const is 83% of declarations; single quotes are 91% of strings; semicolons end 92% of statement lines; 95% of non-merge commits carry an Area: prefix; 212 import statements against 0 require() calls. A separate note reads 'error handling: mixed in every directory — no rule'.](img/measured-conventions.png)

- **Declarations: `const`.** 1,821 of 2,187 declarations are `const` (83%). `let` is 355. `var` is 11 — and all eleven sit in a single file, `scripts/lib/blog.js`, a hand-written build script that generates the HTML pages, written in an older style.
- **Quotes: single.** 2,425 of 2,654 strings (91%). The rest cluster in HTML template strings and regex fragments, which matters later.
- **Semicolons: yes.** 92% of statement lines end with one.
- **Naming: kebab-case, with one real exception.** 57 files are kebab-case. 30 are PascalCase — and 28 of those 30 define a class of the same name. So the rule is not "kebab-case". It is "kebab-case, except a file that defines one class takes that class's PascalCase name." Six files are camelCase, and one is `functions/_middleware.js`, a name Cloudflare Pages dictates.
- **Logging: shipped code never logs.** Zero `console.log` calls in `apps/`, `src/`, and `functions/`. The 30 that exist are all in `scripts/` and `server/` — build tooling reporting progress. The two `console.warn` calls in `apps/` are both deliberate and commented: one in a catch block that must never stop an animation loop, one warning that no page has been built yet.
- **Modules: ESM only.** 212 `import` statements, zero `require()` calls.
- **Commit messages: `Area: summary`.** 35 of the last 37 non-merge commits carry an area prefix (95%). The top areas are Blog (25) and Loader (5).

That is nine rules, and the file that holds them is 799 tokens. The JavaScript source it describes is 107,672 tokens. The conventions file costs 0.7% of reading the whole repo — which is the point, for an agent that pays for every token it reads and re-reads on every turn.

And then the finding that made the post: **error handling is mixed everywhere.** In `apps/`, code throws 4 times, returns `null` 15 times, and logs an error once. In `scripts/`, it throws 79 times, returns `null` 15, logs an error 10, and exits the process 7. In `src/`, it returns `null` 9 times and never throws. No directory clears 80% for any one pattern, so the extractor refuses to make a rule out of it. If my `CLAUDE.md` said "handle errors consistently", that sentence would be describing an aspiration, not a convention — and the agent would have no way to know which of the three patterns I meant. The interesting conventions are the ones that need a human decision first. The measurable ones are the boring mechanical ones. That is exactly backwards from how style guides are usually written.

# Running the checker on its own repo

The extractor's second script checks changed files against the rules it found, and exits 1 with a violation list or 0 with "clean". Every violation carries the repo evidence behind its rule, so the agent sees *why* it is a rule. I ran it against all 94 files of the repo that produced the rules:

![The checker's report on the repo's own code: 19 hard violations in 9 files. Eleven var uses, all in scripts/lib/blog.js. Six camelCase service and model files. Two PascalCase files that define no class. Below, a separate line reads '95 advisory quote notes — reported, not failures'.](img/drift-report.png)

**19 hard violations in 9 files.** Eleven are the `var` uses in `scripts/lib/blog.js`. Six are camelCase service and model files — `exportData.js`, `glyphFit.js`, `measurePage.js`, `fitPortrait.js`, `lineArt.js`, `pageLoader.js` — each sitting in a model or services folder next to kebab-case siblings, so there is no sub-rule hiding there, just drift nobody noticed. Two are PascalCase files that define no class at all: `Letter.js` and `Timeline.js` both export helper functions, and their names are leftovers from a time when they presumably held classes.

None of this was visible before measuring. The repo's author — me — thought it was tidy. The checker disagrees, with file names and line numbers, which is the difference between a vibe and a finding.

The run also produced **95 advisory notes**, all about quote style, and they taught me something about what a regex checker can and cannot do. The first version of the checker flagged 121 double-quoted strings. Most of them were not drift. They were HTML attribute names inside the template strings of `scripts/lib/blog.js` (92 lines containing double quotes in that one file), regex fragments like `"[^"`, and data strings like `"done"`. A regex cannot tell a template string from a style violation, so quote style became an advisory rule: reported, never failing. After I also taught the checker to skip comment-only lines — my own fixture file's header comment described its violations using the words `var` and `console.log`, and the first checker version flagged the comments — the count settled at 95. Quote style is a formatter's job. The checker says so in the rule, instead of pretending otherwise.

![Animation of the workflow in three steps. First, the extractor measures the repo: 94 files become counts. Second, the counts become nine rules in a conventions file. Third, the checker runs on a changed file: it lists violations in red, the file is fixed, and the checker reports clean in green.](img/extract-check-fix.gif){poster=img/extract-check-fix-poster.png}

*Still frame: the checker runs on a changed file, lists its violations, and reports clean after the fix.*

![Animation of the quote-style lesson in three steps. First, the checker flags 121 double-quoted strings. Second, a close-up shows most of them are HTML attribute names inside template strings and regex fragments. Third, the verdict: quote style is advisory only — a formatter owns it, not the checker.](img/quotes-are-advisory.gif){poster=img/quotes-are-advisory-poster.png}

*Still frame: most flagged double quotes are HTML attribute names in template strings — so quote style stays advisory.*

# The skill: convention-check

The two scripts are a skill now, in the skills repo — `convention-check`, the fifth one there. The workflow is four steps, in order:

1. **Extract, don't assert.** Run the extractor. It writes `CONVENTIONS.md` (human-readable, every rule backed by a count) and `conventions.json` (machine-readable rules). Read the mixed section before you read the rules: it tells you where you have decisions to make.
2. **Record the outliers.** Every place the repo violates its own dominant pattern is either a deliberate exception to record — the hand-written build script, the framework-dictated filename — or the first thing to fix. Do not delete outliers from the report to make the numbers prettier.
3. **Check the diff, not the repo.** Run the checker on the files the change touched, before claiming the work is done — the same place you run the tests. A check the agent never runs is tier 5 with extra steps. Wire it into the same command the agent already runs after every edit, and put the same command in CI, so there is exactly one definition of "conforms".
4. **Keep a drift ledger.** When the checker catches something the rules did not cover, or a review corrects the agent on the same thing twice, that is a missing rule, not a bad prompt. Add it in the same PR as the fix. Re-extract after a big refactor — conventions drift, and a stale conventions file is a lie the agent will obediently follow.

```bash
python3 scripts/extract_conventions.py --root . --out .conventions
python3 scripts/check_conventions.py \
    --rules .conventions/conventions.json --root . --diff
```

The skill is deliberately small about what it measures. It covers JavaScript and TypeScript by regex and Python by the same heuristics, and it says so plainly: the checks are line-based, not a parser, and they will misread exotic code. When a check fires on code that is actually fine, that is a bug report about the checker — fix the check, do not teach the agent to ignore it. It also refuses to generalize from too little data: a single Python file in this repo uses double quotes 85% of the time, and the extractor declined to make that a rule, because one file is not a convention.

Related work, credited in the skill: Aider's repo map is the prior art for giving an agent a compact view of a repo — it parses the code, extracts the important symbols, ranks them, and fits them in a ~1,024-token budget. This skill is not a repo map. It does not map symbols; it answers a different question, *how* things are written here. Repo-map tools — repomap-cli, PinkyAI's repo-map skill, the context-tools plugin — all build the map in different packaging, and none of them extracts conventions or checks a diff. The onboarding skills that do extract conventions generate a `CLAUDE.md` from them, which is the prose route: useful, and the weakest tier.

# What it does not prove

A clean check does not mean the code is right. A check can say the file is named right and uses `const`; it cannot say the change is correct. Conventions are about reviewability, and reviewable code is where correctness problems get caught — but the check itself catches none of them. That is the same boundary as the testing skill from two days ago: a green suite is a claim, not evidence, and a clean conventions check is the same kind of claim, one rung down.

A dominant pattern is not necessarily a good one, either. If a repo is 90% one mediocre pattern, the extractor will bless the mediocre pattern. Dominance measures consistency, not quality. The 80% threshold keeps the checker from enforcing a coin flip; it does not keep it from enforcing a bad habit. Read the extracted rules before you commit them — that is the one step in the workflow where a human is not optional.

And some conventions cannot be measured this way at all. "New endpoints copy the structure of `api/orders/`" is a real convention, and no counter will find it. Those belong in the rules file as prose with a named example file — the one place prose earns its keep — not as checks.

The skill is tested end to end: a test script builds a small fixture repo, extracts its conventions, and checks two deliberately bad files and one advisory-only file against them — 21 assertions, all passing, including the one where the checker had to learn not to flag comments. A live run against a real agent session was not tested, and the skill says so: whether a given agent runs the checker before claiming done is yours to watch the first time you use it.

The skill is here: [convention-check](https://github.com/d-sanoj/claude-skills/tree/main/convention-check). Install it by copying the folder into `~/.claude/skills/`, run the extractor on your repo, and read the mixed section first. That is where your next decision is hiding — and it is probably not the one you expected.

# Sources

- "Why your AI coding agent ignores your team's conventions (and how to fix it)", dev.to, October 22, 2026. The repeating review comments, the average-choice argument, and the drift ledger: add the rule in the same PR as the fix. https://dev.to/aiworkspacebuilder/why-your-ai-coding-agent-ignores-your-teams-conventions-and-how-to-fix-it-2p8n
- "Make an AI Coding Agent Follow Your Code Style", swarmz.net, August 15, 2026. The five-tier enforcement hierarchy and "Prose in a config file is a suggestion. A failing exit code is a fact." https://swarmz.net/blog/make-an-ai-coding-agent-follow-your-code-style
- "Repository map", Aider docs. The repo map: tree-sitter parsing, graph-ranked symbols, ~1,024-token default budget. https://aider.chat/docs/repomap.html
- "I Built an OSS to Stop AI from Writing Inconsistent Code Every Time", dev.to. The AI Dev OS framework and the `getUsers()` / `fetchUserList()` / `loadAllUsers()` drift. https://dev.to/yun_bow/i-built-an-oss-to-stop-ai-from-writing-inconsistent-code-every-time-claude-code-cursor-kiro-1oe1
- `convention-check` skill, `d-sanoj/claude-skills`. The extractor, the checker, the worked example on this repo, and the 21-assertion test run. https://github.com/d-sanoj/claude-skills/tree/main/convention-check
- All repo measurements in this post were run on 2026-11-15 against `d-sanoj/sine-portfolio` at main (`f49a951`). The extractor and checker are in the skill linked above; rerun them to reproduce the counts.
