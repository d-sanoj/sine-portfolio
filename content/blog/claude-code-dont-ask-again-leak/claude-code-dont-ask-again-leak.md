---
title: "Your Claude Code approvals are leaking secrets onto GitHub"
slug: claude-code-dont-ask-again-leak
date: 2026-11-09
description: "Apiiro found 1,122 public settings files holding real credentials — 215 of them invisible to the usual scanners. I built claude-guard, a skill that finds and fixes them."
tags: [ai, claude, claude-code, security, skills]
cover: cover.png
coverAlt: "Title card reading 'Your Claude Code approvals are leaking secrets onto GitHub' with the subtitle 'How \"Don't Ask Again\" saves passwords in plain text — and the skill I built to find them', over a row of grey sine waves with one yellow wave highlighted."
---

![Title card reading "Your Claude Code approvals are leaking secrets onto GitHub" with the subtitle "How \"Don't Ask Again\" saves passwords in plain text — and the skill I built to find them", over a row of grey sine waves with one yellow wave highlighted.](cover.png)

Every time you click "Yes, and don't ask again" in Claude Code, you are saving a rule. The rule is the exact command you approved, word for word, in a file inside your project. If that command held a password or an API key, the secret is now sitting in plain text in your project folder — and if that file gets committed, it is on GitHub for anyone to read.

That is not a hypothetical. Security firm Apiiro [scanned public GitHub](https://apiiro.com/blog/coding-agents-leaking-secrets-github-dont-ask-again) between November 1 and 3 and found 104,185 public copies of the file, `.claude/settings.local.json`, in 103,617 repositories. In 1,122 of them — about 1.1% — there was at least one real secret: 1,379 distinct credentials in total. The worst cases were a database vendor's own admin-level cloud key and the owner password of a medical-records database. The story [hit Hacker News on November 7](https://news.ycombinator.com/item?id=50407882) and is at 611 points with 410 comments as I write this.

This post is about three things: how the leak actually works, why the protection you think you have does not cover it, and the skill I built to find it in your own repos — because the fix is a ten-minute job once you know where to look, and a very bad day if you don't.

## How a secret lands in the file

The mechanism is documented in Anthropic's own docs, and it is worth reading precisely, because the details are where the leak lives.

Claude Code asks before it runs most shell commands. When you pick "Yes, and don't ask again", [it saves the rule](https://code.claude.com/docs/en/permissions) to `.claude/settings.local.json` at the root of the git repository, so matching commands run without asking in later sessions. The rule is the command as offered: sometimes that is a pattern, such as `Bash(npm run *)`, and sometimes it is one exact command. A rule with no `*` [matches one exact command](https://code.claude.com/docs/en/permissions) — and if you typed a password into that command, the password is part of the rule.

That is the whole mechanism, and it is easy to picture happening to you. You are debugging a login failure in staging. Claude proposes `PGPASSWORD=hunter2 psql -h db.internal -U app -d appdb -c 'SELECT count(*) FROM users'`. You approve it with "don't ask again" because you are going to run that query five more times today. The password is now a permanent allow rule in a JSON file in your project. You did nothing careless in the moment — you approved a command you wanted to run — and the secret is saved anyway.

Apiiro reproduced this with the current models, Opus 5.5 and Fable 5.1, and called it a property of Claude Code, not of the model. The model does not matter because the model never touches the file: the product writes the rule.

![A four-step diagram titled "How a secret lands in the file". Step 1: Claude proposes a shell command with a password in it. Step 2: you pick "Yes, and don't ask again". Step 3: Claude Code saves the exact command, password included, as an allow rule in .claude/settings.local.json. Step 4: the file is committed, and the secret is public on GitHub. A note below reads: a rule with no wildcard matches one exact command — the secret is part of the rule.](how-it-happens.png)

:::describe
The diagram has four boxes joined by arrows. First, a terminal prompt shows Claude proposing a database command with a password in it. Second, the permission prompt with "Yes, and don't ask again" highlighted. Third, a JSON file, .claude/settings.local.json, with an allow rule containing the same password. Fourth, a GitHub repository with the file committed and the password visible. The point of the sequence is that no step looks like a leak: each one is a reasonable action, and the secret survives all four.
:::

## The protection that doesn't travel

Claude Code does try to keep the file out of git. [Its settings docs](https://code.claude.com/docs/en/settings) say that the first time it writes the file in a git repository that doesn't already ignore it, it adds `**/.claude/settings.local.json` to your global git excludes file — the per-user ignore list git applies to every repository on that machine. On paper, that sounds like the problem is solved. In practice it fails in four ways, and Apiiro measured all four.

First, the protection lives on one machine, in one user's git settings. It does nothing for a file that was already committed, and Claude Code never adds the file to the project's own `.gitignore`, so the protection does not travel with the project — not to a teammate's clone, not to a fork, not to a fresh checkout on a new laptop.

Second, the file gets committed anyway, often by Claude itself. In 539 of the 1,105 repositories Apiiro traced, a commit listing Claude as a co-author had changed the file. When the agent commits your work, it commits the file it wrote. The global-excludes entry only protects you if the file was never added to the index before — and once it is in, git keeps tracking it.

Third, deleting the file does not undo the leak. Older versions of the file hold 734 more secrets across 509 repositories that no current copy holds, usually because the file was deleted. Forks spread the files further: 211 forks of 74 repositories carry the same secrets as the originals. And as of the research, every file with a secret was still on its repository's default branch — in half of those repositories it had been there for at least 217 days.

Fourth, the shared settings file has the same problem on purpose. The file teams are *supposed* to commit, `.claude/settings.json`, holds secrets in 298 of its 76,011 public copies, mostly inside allow rules. Including those, the older versions, and saved agent chat logs, Apiiro's total is 2,539 secrets across 1,994 repositories.

The numbers, in one place:

![A table titled "What Apiiro found (GitHub code search, Nov 1–3, 2026)". Rows: public copies of .claude/settings.local.json checked: 104,185 in 103,617 repos. Copies holding at least one real secret: 1,122 (1.1%), 1,379 distinct secrets. Database passwords: 379. SSH logins for public servers: 43. GitHub, GitLab and npm tokens: 42. AWS keys: 23. Total including history, shared settings and transcripts: 2,539 secrets in 1,994 repos. A caption notes the counts are Apiiro's, and no credential was tested.](numbers.png)

A note on what these numbers are and aren't. Apiiro counted a value as a real secret when it matched a known provider format, or when a password or token sat beside the address of a public server — and an AI reviewer also had to agree. It did not test whether any credential still works, and it contacted no host, so the count is a measure of exposure, not of confirmed compromise. The one confirmation comes from the other direction: Apiiro notified affected organisations on November 2 and 3, and one confirmed that the key it flagged was still live. Apiiro sells application-security products, so it has a stake in this topic, and nobody has independently repeated the counts. But the mechanism is not Apiiro's claim — it is in Anthropic's own documentation — and the files are public, so the counts are checkable in a way most vendor research is not.

## Why the usual scanners miss it

Here is the part that should worry you most, because it defeats the defence most teams already have. Apiiro ran gitleaks and TruffleHog over the 1,122 files with a real secret, without the tools' verification step. Gitleaks flagged 564. TruffleHog flagged 643. **Neither flagged 215** — about one in five.

The misses are almost all passwords typed inside commands. Secret scanners look for known key formats: a string starting with `ghp_`, or `AKIA`, or a long token with the right shape. A password after `PGPASSWORD=`, or `sshpass -p`, or `mysql -p` looks like an ordinary word in an ordinary command line. There is no format to match, so the scanner walks past it. That is the gap this whole story is about: the file is not a `.env` file full of keys, it is a list of commands, and the secrets are camouflaged as command arguments.

![A still frame from an animation: a red secret travels from a terminal command into .claude/settings.local.json, then into a git commit, then onto GitHub. A shield labelled "global git excludes" covers only the developer's own laptop; a fork of the repo on the right still shows the secret. The frame is labelled "The leak, step by step".](leak-path-poster.png)

*The leak, step by step: the command is saved verbatim, the file is committed, and the global-excludes protection only covers the machine it was set on. A fork carries the secret with it.*

![Animation of the same path: a password is typed into a command, approved with "don't ask again", saved into the settings file, committed, and published — while the global-excludes shield stays on the original laptop.](leak-path.gif){poster=leak-path-poster.png}

*The animation above shows the same path in motion: the secret never changes form, it just changes location — from a command, to a file, to a commit, to a public repository.*

## This was reported fifteen months ago

None of this is new to Anthropic. A [bug report filed on August 11, 2025](https://github.com/anthropics/claude-code/issues/5544) described exactly this: approved commands with API keys and tokens stored word for word in `settings.local.json`, with no sanitisation. It asked for credentials to be redacted or excluded from the auto-approval list. An automated bot closed it as "not planned" on January 3, after 60 days without activity. Apiiro cites four related reports; all four have now been closed by the same bot, and none got a reply from Anthropic.

Boris Cherny, from the Claude Code team, did reply in the Hacker News thread. His reply is worth quoting — the first sentence is the whole official position:

> "Historically Claude Code has not done secret scrubbing (there are many good tools for that), but we are looking into what we can do to prevent this."

He added three points: the file is meant to stay local and "we automatically gitignore it when Claude creates the file, so in this case the files were manually created and checked in"; permission rules are "old hat" and everyone should use auto mode instead; and regardless of agent, you should have secret scanning enabled.

The first of those does not survive the research. The docs say Claude Code adds the file to global excludes when *it* creates the file — and if you created the file by hand, you must add it to `.gitignore` yourself. But a file Claude Code created can still end up committed: the global-excludes entry is per-machine, and in 539 of the 1,105 repositories Apiiro traced, a Claude-co-authored commit touched the file. "Manually created and checked in" is not the whole story when the agent does the committing. The auto-mode point is fair as advice — in auto mode the classifier approves actions instead of prompting, so there is no prompt to save a rule from — but it is advice to change how you work, not a fix for the files already public. And the secret-scanning point is exactly what the 215 missed files disprove: the standard scanners do not catch this class of secret.

## What to do about it

Apiiro's recommendations, condensed, in the order that matters:

1. **Search your organisation for the file** — `.claude/settings.local.json` and `.claude/settings.json` — and check each repository's git history for them, even where the files are gone.
2. **Rotate every password, token and key the files have ever held, before cleaning up.** Deleting the file first means you may forget what was in it. Start with credentials paired with a public server.
3. **Stop tracking the local file**: `git rm --cached .claude/settings.local.json`, and add it to the repository's own `.gitignore` — not just the global excludes.
4. **Open the file on your own computer**, even if it was never committed, and delete every rule that contains a secret.
5. **Keep secrets out of commands.** Refer to them as variables from a secrets manager — `$DATABASE_URL` — so the saved rule holds the variable name and not the secret.
6. **Approve patterns, not single commands** — `Bash(npm run *)` instead of one exact command.

Copies that never reach GitHub still matter. The file is plain JSON in the project folder, and it can also end up inside an npm package, a Docker image, a zip archive, or a synced folder. And for security teams: treat agent folders — `.claude/`, `.cursor/`, `.gemini/` and `.specstory/`, Apiiro's list, plus `.codex/` — and agent memory files as holding secrets, the same way you treat `.env` files.

## The skill: claude-guard

The research tells you what to do, but doing it by hand across every repo you have touched means opening every settings file and reading every rule. That is the job I automated. The new skill is called **claude-guard**, and it is [in the skills repo](https://github.com/d-sanoj/claude-skills/tree/skill/claude-guard/claude-guard). It is original work — no adapted code — built from the research above.

It has two scripts, both plain Python with no dependencies. The scanner finds your settings files, checks every allow, deny and ask rule, every `env` value and every hook command, and reports three git facts per file: tracked, in history, and ignored. It looks for the known key formats, and — the part the usual scanners miss — for passwords inside commands: `PGPASSWORD=`, `MYSQL_PWD=`, `sshpass -p`, `mysql -p`, `--password`, `--token`, `curl -u`, `Authorization:` headers, and passwords embedded in URLs. It also flags long mixed-case strings it cannot identify, so a human can review them. It never contacts a host, never tries a credential, and never prints a full secret: values are shown redacted, first four characters and last two, so the report is safe to paste into a ticket.

The fixer does the cleanup, in the right order. It removes every rule with a confirmed or likely secret, blanks secret `env` values, removes hook commands that embed a secret, keeps a timestamped backup, adds the file to the project's own `.gitignore`, and re-scans the cleaned file to prove it is clean — flagging anything it could not remove, instead of staying quiet about it. Rules it can only call "possible" are left in place and flagged for review by hand. For each rule it removes, it prints a safe replacement — a wildcard pattern, or the same command with the secret as an environment variable. After you have rotated the secrets, `--after-rotation` runs `git rm --cached` to untrack the file, and when the file is in git history it prints the `git filter-repo` command for purging it.

I tested it the way this blog tests everything: by running it. The test builds a temporary git repo, plants fake secrets in a settings file, commits it, and checks the whole flow — the scanner finds the secrets and reports the file as tracked, in history, and not ignored; the fixer removes the rules and the re-scan comes back clean; a clean repo scans clean. All 37 checks pass. One thing I did not test: I did not run it against a real leaked repo, for obvious reasons — the test fixtures use fake values like the documented AWS example key.

One more honest note: I ran the scanner on this site's own repo first. It found nothing, because the site has never had a `.claude` folder. If you use Claude Code daily, your result will very likely be different — that is the point.

![A still frame from an animation: a terminal shows scan.py finding three secrets in a settings file, then fix.py removing the rules and adding the file to .gitignore, then a re-scan reporting zero secrets. The frame is labelled "Scan, rotate, fix, verify".](scan-fix-poster.png)

*Scan, rotate, fix, verify: the skill's loop, in four steps. Rotation comes before cleanup — the one ordering rule that matters.*

![Animation of the skill running: the scanner flags three secrets, the fixer removes the rules and adds the gitignore entry, and a re-scan reports zero confirmed secrets.](scan-fix.gif){poster=scan-fix-poster.png}

*The animation above shows the same loop in motion: find, rotate, fix, verify clean.*

## A wider wobble

This story did not land alone. The same week, two other Claude Code stories topped Hacker News: Goldman Sachs is [pulling Claude Code from its bankers and traders](https://news.ycombinator.com/item?id=50415628) (802 points), and a developer's detailed account of [quitting Claude Code for Pi](https://news.ycombinator.com/item?id=50410107), an open-source harness (779 points), after 244 releases in a year, more than three-quarters of which changed the system prompt or the tool descriptions. Those are different complaints — a bank's risk decision, one developer's frustration with churn — and neither is about this leak. But together they describe a shift in how the tool is talked about: the argument is no longer whether the agent is good, it is who controls the loop between a person and a model, and what the harness does with your trust. A tool that saves your passwords into a file you did not know existed is the sharp end of that argument.

The practical version is simpler. Open your settings file and read it. It takes thirty seconds, and it is the only check that cannot be delegated to a scanner that does not know what to look for.

## Sources

- Apiiro, ["Coding Agents Are Leaking Your Secrets to GitHub"](https://apiiro.com/blog/coding-agents-leaking-secrets-github-dont-ask-again), Shmulik Cohen and Matan Giladi, November 5, 2026 — the research; all counts in this post are theirs, collected by GitHub code search on default branches, November 1–3, 2026.
- [Hacker News discussion](https://news.ycombinator.com/item?id=50407882) (611 points, 410 comments), including [Boris Cherny's reply](https://news.ycombinator.com/item?id=50408126).
- Anthropic, [Settings files and precedence](https://code.claude.com/docs/en/settings) and [Configure permissions](https://code.claude.com/docs/en/permissions) — the mechanism, the global-excludes behaviour, and the exact-command rule matching.
- [GitHub issue #5544](https://github.com/anthropics/claude-code/issues/5544), "approved bash commands containing credentials are stored as is with plain text credentials in settings.local.json", August 11, 2025.
- [The Hacker News](https://thehackernews.com/2026/11/claude-codes-dont-ask-again-file.html) — secondary summary of the Apiiro research, with the scanner counts and the remediation steps.
- [claude-guard](https://github.com/d-sanoj/claude-skills/tree/skill/claude-guard/claude-guard) — the skill built for this post, in the skills repo.
- Goldman Sachs and Pi: [Hacker News](https://news.ycombinator.com/item?id=50415628) (802 points) and [Hacker News](https://news.ycombinator.com/item?id=50410107) (779 points); the original Pi post is [caleb.software](https://caleb.software/posts/claude-to-pi.html).
