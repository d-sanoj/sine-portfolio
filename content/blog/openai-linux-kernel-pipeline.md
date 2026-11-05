---
title: "How OpenAI's security pipeline found 948 ways to take root on Linux"
slug: openai-linux-kernel-pipeline
date: 2026-11-05
description: "OpenAI pointed an autonomous pipeline at the Linux kernel and came back with 948 working root exploits for about $1.2 million — here's how the five-stage funnel works."
tags: [ai, security, openai, linux, agents, news]
cover: cover.png
coverAlt: "Title card reading 'How OpenAI's security pipeline found 948 ways to take root on Linux' over a row of grey sine waves with one yellow wave highlighted."
---

![Title card reading "How OpenAI's security pipeline found 948 ways to take root on Linux" over a row of grey sine waves with one yellow wave highlighted.](cover.png)

On November 4, OpenAI published a research post with a number that is hard to wave off. In a single run in mid-October, an autonomous pipeline found, proved, and drafted patches for **948 distinct ways for an ordinary user to take full control of a Linux machine**. The bill was $1,213,430 in API credits — about $1,279 per flaw.

The post is called ["A thousand fewer paths to root"](https://openai.com/index/a-thousand-fewer-paths-to-root/), and it is worth reading carefully, because the headline number is the least interesting part. The interesting part is the funnel: how 5,034 places to look became 948 working exploits, what each stage cost, and where the whole thing nearly fooled itself.

## First, what does "take root" mean here?

Linux has a user called root that can do anything on the machine: read any file, install anything, turn off the security. A **local privilege escalation** flaw — LPE for short — is a bug that lets someone who already has an ordinary, low-privilege account climb up to root. The attacker needs a foothold first, a normal login. That sounds like a big caveat, and it is, until you remember how many people share one machine: a university server, a container host, a CI runner, a cloud VM with several tenants. In effect, a foothold on an unpatched machine is nearly as good as root — which is why the report treats privilege escalation as the finding that matters.

Every exploit in this run was counted as a success only when it produced a working root shell, on a stock desktop Linux with the usual protections switched on — the same ground rules as the Pwn2Own and TyphoonPWN hacking contests.

## The funnel: 5,034 targets in, 948 flaws out

![Funnel diagram titled "From 5,034 targets to 948 flaws". Five bars shrink from left to right: 5,034 audit targets, 2,308 candidate findings, 1,724 reproduced, 1,169 working exploits, 948 distinct flaws. Each bar is labelled with its stage cost in API credits.](funnel.png)

*Counts and costs as reported by OpenAI on November 4, 2026. The funnel covers about 7% of the Linux kernel — roughly 2.8 million lines of code out of more than 40 million.*

The pipeline has five stages, and each one is a different kind of agent doing a different job:

1. **Discovery.** Scout agents read through the kernel and pick the places worth auditing — code reachable by low-privileged users. That gave 5,034 audit targets, about 7% of the kernel, for $3,426. Analyst agents then read each target, worked out its threat model, and looked for bugs. In 12 hours they produced 2,308 candidate findings, for $316,549.
2. **Dynamic validation.** A candidate is not a vulnerability until it actually happens. A triage agent wrote a small test program for each candidate and ran it inside an isolated virtual machine, on a kernel built with a memory-error detector called KASAN, refining the test until the bug reproduced or it gave up. Within 30 hours, 1,724 of the 2,308 reproduced — about 75%. Only 3.1% of the failures were the model simply getting the analysis wrong; the rest needed privileges the test didn't have, or were hard to trigger. This stage cost $73,330.
3. **Exploitability assessment.** Not every real bug matters equally, so the pipeline ranked them. An initial screening agent first narrowed the 1,724 validated bugs to 313 likely information leaks and 1,238 likely privilege escalations, for $44,194. Exploit agents then went after them with the kernel's protections on, and came back with 291 leak proofs of concept and 1,169 working root exploits. This was the expensive stage by far: $775,929 in total. OpenAI puts the average cost of developing one successful exploit at about $359.
4. **Patch generation.** For each validated flaw the pipeline also wrote a candidate patch. Variant analysis — grouping exploits that traced back to the same underlying bug — collapsed the 1,169 exploits into 948 distinct flaws, each with its own patch. That grouping is where the headline number comes from.
5. **Human review.** Security researchers reviewed the exploit, the patch, and the proposed severity before anything went to a maintainer.

## The most important number is 20

Here is the part of the report I keep coming back to. During an early run, the pipeline reported 200 successful exploits. Human review found that **20 of them had reached root through a different zero-day flaw than the one they were assigned**. The agent got the right result — a root shell — by the wrong route, and a system that only checked the result would have marked all 200 as correct.

OpenAI tightened the task and added an independent check that each exploit really used its assigned vulnerability. Their takeaway, in their words: for autonomous security research, verify the path to a result in addition to verifying the result itself. It is a good rule for all agent work, not just security: an agent that can pass its own test by accident is an agent you cannot trust yet.

The rest of the fine print matters too. These are candidate patches, not fixes already shipped — the patches go to kernel maintainers for review, and while the run was still going, 61 of the flaws were already patched upstream by other people, 43 had staging patches, and 299 were being discussed publicly. And the whole run covered 7% of the kernel. Scale it up in your head and the human review queue, not the model, becomes the bottleneck.

## Why this changes the economics

OpenAI priced its own work against the bug bounties that Pwn2Own and TyphoonPWN have historically paid for Linux kernel exploits — $20,000 to $70,000 each. On that math, the 948 exploits would hypothetically be worth $18.9 million to $66.3 million, 16 to 55 times what the run cost. That is a hypothetical valuation, not money anyone was paid: as CSO notes, the comparison doesn't establish that every finding would qualify for those rewards. But the direction is the point: finding a serious bug used to be a weeks-long investigation by a specialist. Here it cost about $1,279.

The capability is also moving fast. In late July, an earlier model, GPT-5.6 Sol, found 166 unique flaws on the same kind of scan for $513,690. Three months later, with three more months of kernel hardening in between, the newer model found 948. In a sample of 166 of the new exploits, OpenAI says the agents used 10 exploitation techniques that were new even to the kernel experts they checked with. On a harder target — Google's kernelCTF, a hardened kernel with a smaller attack surface — the pipeline still produced 21 root exploits and 25 leak demonstrations in 112 hours for about $32,936.

The defensive moral, which OpenAI states outright, is to scan your own software before someone else does. The cost of finding a flaw has collapsed; the cost of leaving one in place has not. And if you do hand this kind of work to agents, check their working, not just their answers — because the first time OpenAI didn't, 20 out of 200 "successes" were right for the wrong reason.

## Sources

- OpenAI, ["A thousand fewer paths to root"](https://openai.com/index/a-thousand-fewer-paths-to-root/) (November 4, 2026) — the report itself: pipeline stages, counts, costs, and the wrong-zero-day finding.
- CSO Online, ["OpenAI built an AI pipeline to find, exploit and patch Linux flaws"](https://www.csoonline.com/article/4245265/openai-built-an-ai-pipeline-to-find-exploit-and-patch-linux-flaws.html) (November 5, 2026) — independent coverage of the same report, including the enterprise patching context.
