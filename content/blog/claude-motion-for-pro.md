---
title: "Claude Motion is Team-only. Here's the same trick on Pro"
slug: claude-motion-for-pro
date: 2026-11-07
description: "Anthropic's Motion turns a report into an animated explainer, but only on Team and Enterprise — so I simplified a community skill into motion-reel, one installable skill that renders the same films on Pro."
tags: [ai, claude, claude-code, explainer, news, skills]
cover: cover.png
coverAlt: "Title card reading 'Claude Motion is Team-only. Here's the same trick on Pro', over a row of grey sine waves with one yellow wave highlighted."
---

![Title card reading "Claude Motion is Team-only. Here's the same trick on Pro", over a row of grey sine waves with one yellow wave highlighted.](cover.png)

On October 8, Anthropic launched [Claude Motion](https://claude.com/resources/articles/dashboards-and-motion), and the idea is genuinely good. You describe an animation — a quarterly report as a 30-second explainer for an all-hands, motion on a chart in a board deck, a product walkthrough for onboarding — and Claude builds it. It plays like a short video, and you can download it as an MP4.

There is a catch, and it is the whole story. Motion is in beta on Team and Enterprise only. Not Free, not Pro, not Max — not even Ultra, the $200-a-month plan. A Pro subscriber paying $20 a month cannot use it. A Max subscriber paying $100 a month cannot use it. The cheapest way in is a Team plan, which needs at least two seats: $50 a month on monthly billing, $40 on annual billing. So the person most likely to want a quick animated explainer — one person, on Pro — is the person locked out.

This post is about the workaround that already exists, and the version of it I built for this blog's readers. A small community project rebuilt Motion's trick as code you run yourself, and it works on any Claude Code plan. I took that project, cut it down to the one job most people want, removed the paid parts, and shipped it as a skill you can install. It is called motion-reel, and it is [in the skills repo](https://github.com/d-sanoj/claude-skills/tree/skill/motion-reel/motion-reel).

## What Motion actually is

The first thing to get straight is what Motion is not. It is not a video generator. Anthropic says so plainly in [the announcement](https://claude.com/resources/articles/dashboards-and-motion): "It doesn't use a video generation model, so there's no generated footage and no AI-generated people." There is no model predicting pixels. Claude writes code that animates your text, charts, shapes and images, and the result plays like a short video.

That distinction is the whole reason the feature is good — and the whole reason it can be rebuilt. A video model gives you footage you cannot edit: if one number is wrong, you regenerate the whole clip and hope. Code gives you a timeline: every word, number and timing is a value you can change after the first version, and a re-render gives you the same film with one thing fixed. Motion is an artifact template in Claude — you type `/motion` in the message box, or pick the template in the Artifacts tab — and when you are done you download an MP4, or hand it off to Adobe, Descript, HeyGen, Runway and the rest.

So the job to be done is narrow and well defined: turn words and numbers into a short animation, as editable code, and export an MP4. Nothing in that job needs Anthropic's servers. It needs a browser that can play an animation, and a tool that can photograph each frame.

## The gate, precisely

Anthropic's own [artifacts help page](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them) has the plan table, and it is unambiguous. The Motion template in beta is available on Team and Enterprise, and on nothing else — Free, Pro, Max and Ultra all get a blank cell. The Dashboards template from the same launch is on every paid plan, so this is not a technical limit. It is a plan decision.

Two more details from the same sources. On Team, Motion is on by default. On Enterprise it is off by default until an owner turns it on under Organization settings, then Artifacts — so even some Team-and-Enterprise customers have to ask an admin first. And Motion counts toward your plan's usage limits: a longer or more complex animation uses more of your limit than a typical message. There is no separate Motion fee; it comes with the seat.

![A plan table titled "Who gets Claude Motion (beta)". Six rows: Free $0 — no; Pro $20 a month — no; Max $100 a month — no; Ultra $200 a month — no; Team, $20 to $25 a seat a month, two-seat minimum — yes; Enterprise, $20 a seat a month plus usage — yes. A caption notes the gate is per Anthropic's artifacts help page, checked November 7, 2026.](plans.png)

*The gate is the product decision, not a technical one: Dashboards from the same launch is on every paid plan. Team pricing is per Anthropic's pricing page as reported by [eesel.ai](https://www.eesel.ai/blog/claude-motion); the two-seat minimum is per [Zemith](https://www.zemith.com/en/contents/claude-motion-graphics). Enterprise pricing is from [Claude's pricing FAQ](https://claude.com/pricing).*

Read that table once more, because the shape of it is the joke. The most expensive individual plan, Ultra at $200 a month, does not get Motion. The cheapest way in is Team at $40 a month on annual billing — two seats at $20 — which means finding a second person to split it with. If you work alone, on Pro, the official answer is to pay two and a half times your current subscription on monthly billing ($50 vs $20) — twice on annual billing ($40 vs $20) — for a feature you would use a few times a month.

## The community already solved this

The workaround is not mine. Three and a half weeks ago, on October 13, a small project called [motion-skills](https://github.com/verbodh-pte-ltd/motion-skills) appeared on GitHub, and its tagline is the whole pitch: "Video as code, on any Claude Code plan." It is four skills for Claude Code that turn work you already do into short films: an animated explainer as a web page, a Manim motion video, a training guide from a setup you just did, and a narrated training video from that guide. It is MIT licensed, and its README is explicit that Claude Motion is Anthropic's product and the project is not affiliated with it.

It works on any plan for a simple reason: nothing in it touches Anthropic's feature flags. Claude Code is included in every paid Claude plan, including Pro, so the agent that writes the film is already on your machine. The film itself is a web page animated with [Motion](https://motion.dev), the open-source animation library, and the rendering is done locally: headless Chrome photographs each frame, and ffmpeg stitches the frames into an MP4. The main thing Anthropic's version has that this does not is the convenience of doing it inside a chat window.

I tested the idea the way this blog tests everything: by running it. The web-film skill renders a real MP4 from a page of code, deterministically — the same inputs give the same frames, every time — and the draft/final workflow is exactly the right shape: draft small and fast, look at the frames, render the final only when the draft is right. What it needed was not a rewrite. It needed to be smaller, simpler, and honest about what it costs.

## What I changed: motion-reel

The adapted skill is called **motion-reel**, and it is one folder in [the skills repo](https://github.com/d-sanoj/claude-skills/tree/skill/motion-reel/motion-reel). Here is what changed from motion-skills, and why:

- **One skill, not four.** The Manim skill, the training guide and the training video are gone. This is only the web-film skill, because a 15-second animated explainer is the job most people ask for, and four skills is a menu where one tool will do.
- **No paid voice.** The ElevenLabs path is removed entirely. Narration uses the free system voice on your machine — `say` on a Mac, Windows speech, `espeak-ng` on Linux — so a film costs nothing to narrate and there is no API key to set, or to leak. The trade is real: the system voice sounds like a system voice, and the skill says so in its own instructions rather than pretending otherwise.
- **No real-app screenshots.** The walkthrough template is gone with the training skills. Films are drawn cards and shapes, so nothing private can end up on screen by accident. That is a deliberate cut, and the next section explains why it matters right now.
- **A built-in look.** The example ships in this blog's sine style — dark ink, cream text, one yellow wave, Josefin Sans bundled in the folder so a film renders the same on any machine — instead of asking you to pick a palette from scratch every time.
- **A self-contained score.** The score synth is vendored into the skill, so it no longer depends on the Manim skill's folder sitting next to it.
- **A simpler install.** Copy the folder into `~/.claude/skills/`. No plugin marketplace, no installer script.

What stayed the same matters as much as what changed. The render script, the Motion runtime, the film player and the render test are copied verbatim — except for one disclosed change in `render.mjs`, which passes `--no-sandbox` when run as root — so a film written for the original skill still renders here. The MIT licence is kept, the original authors are credited in the skill's README, and the README lists every change above — this is an adaptation, not a rewrite, and it does not pretend otherwise.

## How a film is actually made

The mechanism is the interesting part, and it is simpler than it sounds. A film is two files. `film.json` holds the words, the colours, the score and the narration. `film.html` holds one section per scene, and a small module that describes each scene as Motion animation segments — which element moves, from where to where, and when. The player builds one paused Motion timeline out of all the scenes, so any moment in the film can be shown exactly, on demand.

![A four-box pipeline titled "How a motion-reel film is made". Box 1: film.json plus film.html — words, colours, scenes as code. Box 2: one paused Motion timeline — every frame addressable. Box 3: headless Chrome photographs each frame, 15 or 30 times a second. Box 4: ffmpeg stitches the frames with the score and voice into an MP4. A caption reads: the film is a paused timeline; Chrome photographs it, ffmpeg assembles it.](pipeline.png)

*The film is a paused timeline. Chrome photographs it, ffmpeg assembles it. There is no video model anywhere in the pipeline — the animation is code, and the MP4 is a recording of that code playing.*

Then the renderer takes over. It serves the film on `127.0.0.1`, drives headless Chrome, seeks the timeline to each frame time, screenshots it, and pipes the frames to ffmpeg. The score is synthesised from notes — sine, triangle, square and saw waves, plus short shaped sounds for the moments that land — and written as a WAV file, so there are no samples to download. If there is narration, each scene stretches to fit its spoken line, the voice clips are mixed in at the right times, and the score drops to 35% underneath so the words stay clear. One honest note: I rendered the example film without narration — the voice code is checked, but the free-voice path needs `espeak-ng` on Linux and this machine could not install it, so no narrated render was run here.

Two properties of this design do most of the work. The first is determinism: because the film is one paused timeline, seeking to the same time twice gives the same frame twice, and a re-render gives the same film. The render test checks exactly that. The second is the draft/final split. A draft renders at 960×540 and 15 frames a second, in about twenty seconds for a ten-second film, and you look at frames from the middle of each scene before you go further. The final renders at 1920×1080 and 30 frames a second, in about a minute for a ten-second film, and writes a poster frame from a second before the end. You never pay for a final render of a film you have not looked at.

## Try it: the example film

The skill ships with a working example — a ten-second film called "Motion, as code" that renders out of the box — and these are real frames from it, rendered on this machine with the skill's own test:

![Animated frames from the example film "Motion, as code". First the title "Motion, as code" fades in with the subtitle "a film written like a program" over a yellow sine wave. Then three numbered steps appear one by one: "Words live in film.json", "Motion plays the timeline", "Chrome and ffmpeg make the MP4". It closes on "Free. On your machine." and "motion-reel" over the wave.](reel-frames.gif){poster=reel-frames-poster.png}

*Real frames from the example film, rendered with `node scripts/render.mjs example draft`. The three scenes run 2.5, 5 and 2.5 seconds. A still from the middle of the film is available: [poster frame](reel-frames-poster.png).*

**What the animation shows, step by step:**

1. The title "Motion, as code" fades in with the subtitle "a film written like a program", and a yellow sine wave fades in underneath.
2. Three steps appear one by one, each with a soft pop in the score: the words live in `film.json`, Motion plays the timeline, Chrome and ffmpeg make the MP4.
3. It closes on "Free. On your machine." and the skill's name, over the same wave.

To run it yourself:

```bash
cp -r motion-reel ~/.claude/skills/
python ~/.claude/skills/motion-reel/scripts/check.py
node ~/.claude/skills/motion-reel/scripts/render.mjs \
  ~/.claude/skills/motion-reel/example draft
```

The check script lists what your machine is missing and how to install it — Node 22 or later, Chrome, ffmpeg, Python 3.10 or later, and `espeak-ng` on Linux for the voice. Then copy `example/` to a new folder, edit the words in `film.json`, and you have your own film. Ask Claude Code for one in plain words — *"a 15-second animated explainer of our pricing page: three plans, the middle one highlighted"* — and the skill asks for a style and colours, renders a draft, shows you frames, and renders the final only after you say it is right.

![A horizontal timeline titled "One timeline, every frame exact". Three blocks run left to right: Wake, 2.5 seconds; Idea, 5 seconds; Close, 2.5 seconds. A playhead line sweeps across the blocks and a clock reads the time. A caption reads: the timeline is built once, paused, and photographed frame by frame — so a re-render gives the same film.](timeline.gif){poster=timeline-poster.png}

*One timeline, every frame exact. The blocks are the example film's three scenes, 2.5, 5 and 2.5 seconds. The timeline is built once, paused, and photographed frame by frame — so a re-render gives the same film. A still version is available: [poster frame](timeline-poster.png).*

## The catch

Nothing here is free of trade-offs, and the honest ones are these.

First, the setup. Motion in Claude needs no setup at all on Team: you type `/motion` and it works. This skill needs Node, Chrome, ffmpeg and Python installed, and on Linux one more package for the voice. That is a real cost, paid once, and it is the price of doing the rendering on your own machine. The check script exists to make that cost visible up front.

Second, the voice. The system voice is free and it sounds free — flat, a little robotic, unmistakably a computer. If the film is for the public, record a human voice or ship it silent with the score. The skill does not dress the free voice up as a performance.

Third, time. A ten-second final takes about a minute to render, because Chrome screenshots every frame one by one at full size. A minute-long film takes several minutes. Motion in Claude is faster because the rendering happens on Anthropic's side. You are trading their speed for your control.

Fourth, the same limit Motion has: no footage, no AI-generated people. If you need a camera shot, or a presenter on screen, this is the wrong tool in both versions.

Fifth, the usage limits still apply — to Claude Code, not to the skill. The agent writing your film draws on your plan's limits, the same pool your chats draw on. The skill makes the rendering free; it does not make the agent's work free.

And one safety note, because it is live this week. The skill's rules say nothing private goes on screen or in a file, and there is a fresh reason to take that seriously: on November 5, a Claude Code user [reported](https://github.com/anthropics/claude-code/issues/107757) that the tool had been putting their account email into the User-Agent header of outgoing web requests, and that scam mail followed — dozens a day, by their account. The issue is open, it has hundreds of reactions, and Anthropic staff have confirmed the behaviour: a built-in privacy plugin shipped in Claude Code 2.1.317 to block it by default, and staff say the account email will leave the model context entirely in a release early next week. The lesson for film-making is narrow and practical: keep films to drawn shapes and made-up names, and look at what actually left your machine before you share anything. That is why the walkthrough template — real screenshots of real apps — is not in this skill.

## The money, plainly

Pro is $20 a month, or $17 on annual billing. The skill is $0. So the Pro route to animated explainers is $17–$20 a month, and the official route is a Team plan at $40 a month on annual billing, $50 month-to-month, for two seats you may not need.

What you lose against the official version is the convenience: no `/motion` in the chat box, no editor inside Claude, no one-click handoff to Adobe or Runway. What you gain is the film as files you own — the page, the words, the timeline — a re-render that gives the same film frame for frame, and a voice that costs nothing. If you are on a Team plan already, use Motion; it is the better product for you. If you are on Pro, this is the same trick, on your machine, for nothing extra.

That is the shape of the thing this blog keeps coming back to: when a good feature is paywalled by a plan rather than by technology, the interesting question is not whether to complain about the paywall. It is whether the feature is really a feature, or just code — and if it is just code, whose machine it can run on.

## Sources

- Anthropic, [Build live dashboards and animate explainers with Claude](https://claude.com/resources/articles/dashboards-and-motion), October 8, 2026 — the launch announcement; Motion in beta on Team and Enterprise, no video generation model, MP4 export.
- Claude Help Center, [What are artifacts and how do I use them?](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them) — the plan table: Motion template on Team and Enterprise only, Dashboards on every paid plan.
- [Claude pricing](https://claude.com/pricing) — Pro $17 a month on annual billing ($20 monthly), Max $100, Ultra $200, Claude Code included in paid plans, Enterprise $20 a seat a month plus usage.
- [motion-skills](https://github.com/verbodh-pte-ltd/motion-skills) — the community project this skill adapts; MIT, created October 13, 2026.
- [motion-reel](https://github.com/d-sanoj/claude-skills/tree/skill/motion-reel/motion-reel) — the adapted skill in this blog's skills repo: README, SKILL.md, scripts, runtime and the example film.
- [eesel.ai, Claude Motion](https://www.eesel.ai/blog/claude-motion) — Team pricing ($20 a seat a month annual, $25 monthly), no separate Motion fee, Motion counts toward plan usage limits.
- [Zemith, Claude Motion Graphics](https://www.zemith.com/en/contents/claude-motion-graphics) — Team sold for teams of 2 to 150 seats.
- [Claude Code issue #107757](https://github.com/anthropics/claude-code/issues/107757) — account email in User-Agent headers, filed November 5, 2026, open with hundreds of reactions.
