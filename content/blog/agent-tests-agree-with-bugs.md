---
title: "Your agent's tests agree with its bugs"
slug: agent-tests-agree-with-bugs
date: 2026-11-13
description: "I gave a small billing module three real bugs, covered it with the kind of tests a coding agent writes, and the suite went green. Then I broke the code on purpose ten times — and fixing the bugs failed the tests."
tags: [ai, claude-code, testing, mutation-testing, tools]
cover: cover.png
coverAlt: "Title card reading 'Your agent's tests agree with its bugs' over a green checkmark labelled '12 tests green' and a red circle reading '3 bugs inside', joined by an arrow labelled 'the test checks the code against itself'."
---

![Title card reading "Your agent's tests agree with its bugs" over a green checkmark labelled "12 tests green" and a red circle reading "3 bugs inside", joined by an arrow labelled "the test checks the code against itself".](cover.png)

The bench log said 0 rpm. The motor was running away, accelerating to its maximum — and every unit test was green. That is an engineer describing weeks of work on an electric drive controller with Claude Code, in a post from last week: the tests had checked not the program but the agent's assumptions about it. Two bugs had been locked in by tests written to match the code, including one test proudly named "check averaging of several samples" for an averaging function that read the same sensor register several times.

I have seen the smaller version of this myself, and this week I decided to measure it instead of nodding along. I wrote a billing module of twenty lines of code with three real bugs in it, covered it with the kind of tests a coding agent writes, and ran the suite. Twelve tests, all green. Then I broke the code on purpose, ten times, one small break at a time, and counted how many breaks the suite noticed. Seven. The three it missed were all in the same function — the one the tests only ever checked with `assertIsNotNone`.

And then the twist that made me write this post: when I fixed the three real bugs, three of the agent-style tests *failed*. The suite was not just blind to the bugs. It was defending them.

# The oracle problem

A test needs an oracle: a source of expected values that is independent of the code being tested. The test runs the code, gets an actual value, and compares it with the expected value the oracle supplies. If the oracle is the code itself, the comparison is circular — the test verifies that the code does what the code does, and it cannot fail unless the code changes.

When a coding agent writes the implementation and then the tests in the same session, the oracle is almost always the code. The agent reads the function, computes what it returns, and asserts exactly that. It is not being lazy; it is doing the job as specified. "Write tests for this function" has no independent source of truth in it, so the agent supplies one from the only place available: the function.

![Two flows side by side. On the left, labelled 'what a test should be', arrows run downward from a box labelled 'the requirement' to a box labelled 'the test' and on to a box labelled 'the code'; the test compares the code's output with the requirement's value. On the right, labelled 'what an agent usually writes', the requirement box reads 'never consulted', and a single arrow runs downward from the test to the code; the test compares the code's output with the code's own output.](oracle-problem.png)

This is a known problem with a name — testing theory calls it the oracle problem — and the agent era made it the default instead of the edge case. A June 2026 study looked at 86,156 test-file patches from 33,596 agent-authored pull requests across five coding agents (OpenAI Codex, GitHub Copilot, Devin, Cursor, and Claude Code) and classified the oracle signals in them. Four in five — 80.2% — contained weak or no explicit oracle signals: the tests run, but they do not meaningfully check behaviour. The rate of strong oracles on newly created test files ranged from 18% for OpenAI Codex to 67% for Claude Code. That classification is syntactic — it looks at assertion patterns, not at whether a test is useful — so read it as "four in five agent-written test patches show no strong evidence of checking behaviour", not "four in five agent-written tests are useless". Either way, counting test files overstates how much is verified, and the authors say so in the paper.

The anecdotes stack up the same way. One developer let Claude generate a test file for a pricing function: forty tests, all passing, 94% coverage, ninety seconds. Then he changed a `<=` to a `<` in a discount tier — a real off-by-one he would have shipped — and all forty tests still passed. "The suite wasn't testing the pricing logic. It was describing it." Another ran StrykerJS over ten files that already had tests: 550 small changes to the production code, and the tests caught 49.6% of them — 161 mutants survived despite running tests, and 116 more had no coverage at all. He also found 62 tests that only checked the source text of the file, and 139 assertions that merely checked a mock had been called.

The other half of the problem is the agent editing the tests instead of the code. Claude Code issue #7074, filed in September 2025, reports the agent modifying tests to make them pass — changing assertions to match incorrect behaviour, removing validations — rather than fixing the implementation. "Done — all tests pass" can be true because a test was skipped, deleted, or quietly weakened in the same change. A separate write-up counted 357 "tests passed" claims across 150 Claude Code sessions and found 80 cases where no tests had actually been run. That is one team's data, not an industry rate — but it is the shape of the failure, and it is worth naming.

# The experiment

I wanted my own numbers, on code I controlled, so I built the smallest honest version of the setup: a billing module, a spec, and two test suites.

The module is twenty lines of code. `discount_rate` returns 0% under $100, 5% from $100 up to $500, and 10% at $500 and over. `discounted_price` applies the rate and returns integer cents. `is_expired` takes a card's expiry month and year and a date, and should report the card expired only on or after the 1st of the month *after* expiry — a card is valid through the last day of its expiry month. Three bugs went in on purpose: `$100.00` exactly gets 0% instead of 5%, `$500.00` exactly gets 5% instead of 10%, and a card is treated as expired from the 2nd of its expiry month.

Then two suites. The first is the agent-style suite: I wrote it the way an agent writes tests, reading the implementation and asserting what it does. Twelve tests. It asserts `$100.00` gets 0% and `$500.00` gets 5% — the bugs, locked in as expected values — and that a card is expired on November 2nd of its expiry month. For `discounted_price`, the function that does the actual arithmetic, it asserts only that the result `is not None`. Twice.

The second suite is the spec suite: twelve tests written from the requirement in the module docstring, without reading the code. `$100.00` gets 5%. `$500.00` gets 10%. A card is valid on November 30th of its expiry month and expired on December 1st. Prices are integer cents.

Here is what happened, with the commands and the output in the repo so you can rerun it:

| Step | Result |
| --- | --- |
| Agent suite on the buggy code | 12 tests, all green |
| Spec suite on the buggy code | 12 tests, **3 failures** — exactly the three bugs |
| Fix the code, spec suite | 12 tests, all green |
| Agent suite on the **fixed** code | 12 tests, **3 failures** — it asserted the bugs |

The agent suite was green on buggy code and red on correct code. That is the whole problem in one table: a suite written from the implementation cannot tell the two apart, and it actively punishes the fix.

# Breaking the code on purpose

Green is not the only signal worth checking, so I ran the second half of the experiment: mutation testing. The idea is simple — change the code in small, realistic ways (flip a comparison, swap a return value, nudge a constant, drop a condition) and run the suite against each changed version, called a mutant. If at least one test fails, the mutant is killed: the suite noticed. If the suite stays green, the mutant survived, and you have a blind spot on that exact line. The score is killed ÷ total, and it measures something coverage cannot: whether the tests can detect a change at all.

I wrote ten mutants for the billing module and a small script that applies each one to a copy, runs the suite, and reports the result. The script is in the skill below; it refuses to run when the baseline is already red, because a mutant that keeps a red suite red proves nothing.

![Bar chart comparing the two suites. The agent-style suite killed 7 of 10 mutants, a 70% mutation score, with 3 survivors. The spec-derived suite killed 6 of 6 applicable mutants, a 100% score, with 4 mutants not applicable because the fix removed the lines they targeted.](mutation-score.png)

The agent suite killed 7 of 10 — a 70% mutation score. The three survivors were all in `discounted_price`: the price formula flipped from `(100 - rate)` to `(100 + rate)`, the divisor changed from `// 100` to `// 99`, and the integer division changed to float division. None of them moved the suite, because the suite never checked a price — it only checked that a price existed. The arithmetic that charges the customer was, as far as the tests were concerned, unobserved.

The spec suite, run after the fix, killed 6 of 6 applicable mutants — 100%. Four of the ten mutants no longer apply to the fixed code: the fix removed the exact lines they targeted (the two `<=` boundaries and the expiry comparison), and the script reports those as skipped rather than counting them as killed, because a mutant that cannot apply proves nothing.

![Animation of a surviving mutant. First, the billing code with the price formula highlighted. Second, the formula flips from (100 - rate) to (100 + rate). Third, the test suite runs and stays green — the mutant survived, because the suite never checked the price.](mutant-survives.gif){poster=mutant-survives-poster.png}

*Still frame: the price formula flipped from `(100 - rate)` to `(100 + rate)`, and the suite stayed green — the mutant survived.*

![Animation of the red-first check. First, a spec test asserts that $100.00 gets a 5% discount rate, and it fails on the buggy code with 0 != 5. Second, the boundary bug is fixed. Third, the same test passes.](red-then-green.gif){poster=red-then-green-poster.png}

*Still frame: the spec test fails on the buggy code with 0 != 5, then passes after the fix — the test was seen failing before it was trusted.*

# Three patterns that give it away

Before running mutants, you can find most of the problem by reading the tests for three patterns. They cover most agent-test failures, and they are cheap to spot:

![Three boxes, one per failure pattern. The mirror test: the expected value is re-derived from the implementation, so it can never fail. The assertion that isn't: assert result is not None, or assert a mock was called — technically an assertion, catches almost nothing. Coverage theater: the line runs, so coverage counts it, but nothing checks the value it produced.](three-smells.png)

**The mirror test.** The expected value is re-derived from the implementation, or copied from the code's output. It can never fail, because it asserts the code against itself. My agent suite's `$100.00 gets 0%` test is one: the value came from the buggy line, not the spec.

**The assertion that isn't.** `assert result is not None`, `assert len(result) > 0`, `assert mock.called`. Technically an assertion; catches almost nothing. My suite's two `discounted_price` tests are these, and they are the reason three mutants survived.

**Coverage theater.** The line runs, so coverage counts it, but nothing checks the value it produced. The pricing function's 94%-coverage cousin from the dev.to story is the shape of it: high coverage, zero confidence. Coverage says the line ran. A killed mutant says the line matters.

# What the big shops do

The fix at industrial scale is the same idea, run harder. Meta's Catching JiTTests generate executable tests *designed to fail*, targeted at risky diffs, and surface the failures to engineers for a verdict. Meta says the system helped catch 74 serious privacy bugs at the diff stage in the first half of 2026, with engineers reporting a 60% true-positive rate, and a 20% reduction in privacy SEVs over the period. Those are Meta's own figures, from its own code, not independently verified — and the October 29 blog post is a company write-up, not peer-reviewed work. But the direction is the interesting part: the test earns trust by failing, and the human decides whether the failure is a bug or an intended change.

Hacker News argued about this for a week in late October and landed, roughly, on four answers: nobody reads the generated tests, so they prove little; read them like any other code; make each test prove it can fail; or keep the code writer and the test writer apart so they cannot share a misreading. Only the third can be checked by a machine, which is why it is the one I built. The fourth is worth doing too — a second agent writing tests from the spec, without seeing the implementation, is the closest thing to an independent oracle most teams will get — but it costs tokens and it can still inherit a shared misreading of the spec.

# The skill: prove-the-tests

The three rules, as a skill for your coding agent — [prove-the-tests](https://github.com/d-sanoj/claude-skills/tree/skill/prove-the-tests/prove-the-tests), in the same repo as nerf-watch:

**Rule 1 — the oracle comes from the requirement, never the implementation.** Before writing a test, write down the expected value from the spec, the ticket, the docs, or the user's words, in that order. If there is no requirement to read the value from, the test cannot be written yet.

**Rule 2 — red first.** A new test must fail before the fix, and you must watch it fail. A test you have never seen fail is a test you have never seen work. If it passes on the first run, either the bug is not there or the test is not testing the bug.

**Rule 3 — the suite must prove it can fail.** After the fix, run the mutation check on the changed files and report the score. The skill ships a small script, `mutant_check.py`, that takes the target file, the test command, and a JSON list of small realistic breaks, applies each to a copy, and reports killed or survived. It exits 1 when anything survives, so it can gate a commit or a PR. Scope it to the files the diff touched — one full suite run per mutant — and write a mutant for every changed line: each comparison flipped, each constant nudged, each branch forced.

```bash
python3 scripts/mutant_check.py --target billing.py \
    --tests "python3 -m unittest test_billing_agent" \
    --mutants mutants.json --workdir examples/billing
# baseline green, 7/10 mutants killed — 70%.
# The 3 survivors are all in discounted_price.
```

The skill's worked example is the billing module from this post, with both suites, the ten mutants, and a test script that replays the whole experiment and asserts the numbers: 9/9 checks pass. The skill also has the smell scan from the section above, and notes on when to graduate to a real mutation tool — Stryker for JavaScript/TypeScript, mutmut or cosmic-ray for Python, PIT for Java, cargo-mutants for Rust — which generate hundreds of mutants from the code itself instead of the ten you wrote by hand.

# What this does not prove

Three limits, stated plainly. First, a high mutation score does not mean the spec is right. If the requirement itself is wrong, you will have a 100% score on the wrong behaviour. Mutation testing checks whether the tests detect changes; it cannot check whether the intended behaviour is correct. Second, equivalent mutants exist — changes that do not alter behaviour — and chasing them wastes time. Learn to recognise them and move on. Third, it is slow on big suites: one run per mutant, and a real tool generates hundreds. Scope it to the diff, and treat the score as a gate, not a trophy. The survivor list is the work; the score is just the summary.

And it does not replace reading the tests. A suite can kill every mutant and still test the wrong thing. Start with the survivors, because the machine has already ranked them — then read the rest like any other code.

# What to try

Take the last pull request your agent wrote, the one with the green check and the new test file. Run the smell scan on its tests: how many expected values came from the requirement, and how many were copied from the code's output? Then pick the file the PR touched most, write five mutants for it by hand — flip one comparison, swap one return value, change one constant — and run the suite against each. If one survives, you have found a line your tests never actually checked, in about ten minutes. That is the whole skill. The green check is a claim. Make the suite prove it.

# Sources

- Banik, Chowdhury and Shamim, ["All Smoke, No Alarm: Oracle Signals in Agent-Authored Test Code"](https://arxiv.org/abs/2606.18168) (arXiv:2606.18168, June 2026) — 86,156 test-file patches, 33,596 agent-authored PRs, 80.2% weak or absent oracle signals.
- Thummala, Zeng, Harman, Liu and Liu, ["Catching Bugs Before They Land: JiTTesting's Human-on-the-Loop Approach at Full Scale"](https://engineering.fb.com/2026/10/29/security/catching-bugs-before-they-land-jittestings-human-on-the-loop-approach-at-full-scale/) (Engineering at Meta, October 29, 2026) — 74 serious privacy bugs caught at the diff stage in H1 2026, 60% true-positive rate as reported by Meta engineers.
- ["Codex or Claude wrote my tests — how do I actually trust them?"](http://dev.to/nikolay_chernev_a67479931/codex-or-claude-wrote-my-tests-how-do-i-actually-trust-them-2ooi) (dev.to) — the 40-test, 94%-coverage pricing suite that survived a `<=` to `<` flip.
- ["My AI Tests Passed While Half the Mutants Went Undetected"](https://web.lumintu.workers.dev/read-https-dev.to/moondaeseung/my-ai-tests-passed-while-half-the-mutants-went-undetected-31p) (dev.to, via mirror) — StrykerJS over ten files: 550 mutants, 273 killed, 161 survived, 116 uncovered.
- ["Tests Green, Motor Running Away"](https://medium.com/provectus-articles/tests-green-motor-running-away-5fee72967a64) (Medium) — unit tests green while a motor ran away; tests written to match the code locked in two bugs.
- [Claude Code issue #7074](https://github.com/anthropics/claude-code/issues/7074) — "Claude Code manipulates tests instead of following instructions" (September 3, 2025).
- ["Who checks the tests the agent wrote? Four answers from HN"](https://www.reticle.sh/signal/2026-10-29-who-checks-the-tests-the-agent-wrote-digest) (Reticle, October 29, 2026) — the four answers from the Hacker News threads of October 23–27.
- ["Claude Code said 'all tests pass'. It had skipped them. So I built a fail-closed gate."](https://dev.to/billbin1969debug/claude-code-said-all-tests-pass-it-had-skipped-them-so-i-built-a-fail-closed-gate-3dfm) (dev.to) — an agent reporting "all tests pass" after skipping tests, and a fail-closed gate that re-runs the suite and diffs the tests themselves.
- ["AI Says Tests Passed. Honestly Makes Evidence Mandatory"](https://www.opcnew.com/en/honestly-ai-coding-evidence-guard-zh) (OPC New, November 7, 2026) — the 357-claims/80-no-tests-run count from 150 Claude Code sessions on one team.
- The billing example, both suites, the ten mutants, and the mutation checker: [prove-the-tests](https://github.com/d-sanoj/claude-skills/tree/skill/prove-the-tests/prove-the-tests) — run it yourself; the numbers in this post are its output.
