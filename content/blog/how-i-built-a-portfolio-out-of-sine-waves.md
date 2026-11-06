---
title: "How I built a portfolio out of sine waves"
slug: how-i-built-a-portfolio-out-of-sine-waves
date: 2026-11-06
description: "One sine curve per letter, no text, no images on the home page — how a video about a game with no assets turned into a portfolio drawn entirely from waves."
tags: [sine waves, portfolio, fourier]
cover: cover.png
coverAlt: "A single sine wave on the left, and the letter a drawn from 40 waves on the right."
---

I found the video the way you find most good ideas — not looking for it. A creator called Zanzlanz had released a game called *Crow Sign*, and the whole point of the video was what the game *doesn't* have: no image files, no audio files, no font files. Every picture, every sound, every letter is generated at runtime, from sine waves. The game is 455 KB in total, about eleven times smaller than the same game built with assets, and its music is roughly five hundred times smaller than looped MP3s — because the music isn't a recording at all, it's note data plus a tiny synthesizer. ([Video](https://youtu.be/Qr3VsZYQy4s?si=jcJW9ZHsVBTWCCWB))

The part that stuck with me wasn't the size. It was the font. The game needed text, and text needs a font, and a font is normally a file. So the video builds one out of harmonics instead: 26 cursive letters, each one a sum of sine waves, connecting between words. And underneath all of it sits one idea, stated plainly at the start of the video: any image, sound, or motion can be built by adding enough sine waves.

I kept thinking about that after the video ended. A game is one thing — games get to be strange. But a portfolio is mostly text. Text is mostly letters. And a letter, it turns out, is just a loop.

# One curve per letter

Here is the whole idea, and it fits in one sentence: every letter on my home page is a single sine curve.

Not a picture of a letter. Not a font rendered onto a canvas. One closed loop, drawn by adding sine waves together. The mathematics behind it is Fourier analysis, and the friendly version of it goes like this: a single sine wave, traced over time, draws a circle. Add a second wave and the circle bends. Add a third and it bends again. Keep adding waves — each one a circle spinning at its own speed, with its own size — and the path bends itself into whatever shape you want. A letter is just a loop with enough waves in it.

That is also how the letters get made. I drew each letter once, by hand, in a small designer tool that lives in the same repo. The designer takes the drawn stroke and fits a Fourier series to it: it samples 512 points around the loop and runs a discrete Fourier transform, looking at frequencies up to 128 in either direction, and keeps the strongest waves. What gets saved for the curve itself is nothing but the waves — each term is three numbers: frequency, amplitude, phase — plus a little routing metadata alongside: how wide the letter is, where joins enter and leave, and which stretches of the loop stay undrawn. The letter `a` is 40 waves. The digits are the fussiest letters I have, up to 96 waves each. All 161 letters together fit in a 175 KB file.

![The letter a drawn with 1, 5, 15, and 40 sine waves: one wave is a circle, and each added wave bends it closer to the letter.](forming-a.png)

:::describe
Four panels show the same letter `a` built from its real wave data. With one wave it is a plain circle. With five waves a stem starts to appear on the right. With fifteen the bowl and stem are nearly there. With all forty waves it is the finished letter. The waves are added strongest first, exactly as they fade in on the page.
:::

The moment a letter loads on the page, it draws itself the same way it was built: it starts as a single wave — a circle — and the waves fade in, strongest first, each one bending the path closer to the letter. You can watch it happen. The portrait that loads first forms the same way, one wave at a time.

![The letter a forming, step by step, from a circle to the finished letter.](forming-a.gif){poster=forming-a-poster.png}

*A still version is available: [poster frame](forming-a-poster.png).*

# The dot of the i

The first problem shows up about thirty seconds into the idea, and it is the letter `i`.

A letter is supposed to be *one* curve, but an `i` is two things: a stem and a dot. A `%` is worse. The trick the code uses is to chain the pieces into a single loop anyway — the pen travels from the end of one piece to the start of the next — and to record those travel stretches as gaps, ranges of the curve that are not drawn. The sine curve itself stays one loop; the pen just lifts where it needs to.

Two small details make that work. If the travel is very short, it is left drawn — the pieces touch, so nobody can see the join. And the pen runs straight on for a little way past the end of each piece before it turns to travel, because a cut-off Fourier series cuts corners: without that straight run, the visible end of a stroke would curl. The numbers are small and unglamorous — a bridge threshold of 0.012, a run of 0.09, in units where a letter is 1 em tall — but they are the difference between a letter and a smudge.

The second problem is sharp corners. A Fourier series is smooth by nature, and a corner is the least smooth thing there is. Cut the series short and the curve ripples next to the corner — Gibbs ringing, the same effect that makes a compressed photo shimmer around hard edges. The fix is to taper off the highest waves, a Lanczos sigma factor, so lines stay straight, while leaving the strong low waves almost untouched. It is a compromise, and like most compromises it is invisible when it works: the corners look like corners, and you never notice the waves that were sacrificed to make them so.

# The plain page is the truth

The letters were the fun part. The part that makes the site actually work is much duller, and it is the part I am proudest of: there is exactly one place where the words live.

That place is an ordinary HTML page, `apps/plain/index.html`. It is the whole site in plain form — the same words, the same links, readable by anything. The build reads it once and turns it into the sine version. Nothing is ever typed twice, and the two versions cannot drift apart, because there is only one of them.

Getting the sine page to look right takes one more step. A browser opens the plain page and measures where every letter actually sits — the exact positions, not an approximation. The build then places each letter's curve at its measured spot. Without those measurements the page falls back to a flow layout, which is only close, and close is visible when every letter is a drawing.

Then comes the part that surprised me most. The finished sine page, if you shipped it naively, would be about a megabyte of wave data — a copy of the sine waves for every letter on the page. Instead the site ships two small things: the measured layouts and the letters the page actually uses. The home page uses 71 of the 161 letters, 3,600 waves in total. When the page loads, deterministic code rebuilds the page from those two things, and the result is exactly the same page. It is the same idea as the game, one level up: don't ship the thing, ship the recipe for the thing.

![Four boxes with arrows: plain page, measure, layouts plus glyphs, canvas. The plain page holds the words, a browser measures where each letter sits, the layouts and glyphs are shipped instead of the page, and the canvas redraws the curves at load.](pipeline.png)

:::describe
The build pipeline in four steps. First, the plain page at apps/plain/index.html, the only place words live. Second, a browser measures where each letter sits on that page. Third, the measured layouts and the glyphs — 71 letters, 3,600 waves for the home page — are shipped instead of the finished page. Fourth, a canvas redraws the curves when the page loads, producing exactly the same page.
:::

The page itself is drawn on a 2D canvas, one letter at a time, skipping the gap stretches, with round caps and joins. Links get a warm peach stroke; body text gets a pale blue one. Line weight scales with size. None of that is visible as a decision — it just reads as a page.

# The numbers

I like posts that end with numbers, so here are mine, all measured rather than estimated:

- 161 letters designed, in a 175 KB file. Each curve is only its waves — frequency, amplitude, phase — plus a little routing metadata.
- The letter `a` is 40 waves. The digits run up to 96.
- The home page uses 71 letters, 3,600 waves in total.
- The letters are fitted from 512 samples around each loop, at frequencies up to ±128.
- The site ships layouts plus glyphs instead of a ~1 MB page of wave copies.

And for scale, the video that started all of this: *Crow Sign* is 455 KB, roughly eleven times smaller than the same game with assets, with music about five hundred times smaller than MP3 loops — all because every asset is a formula, not a file.

# Make your own

The whole thing is a public repo, and it is built to be stolen: [github.com/d-sanoj/sine-portfolio](https://github.com/d-sanoj/sine-portfolio). Fork it, put your own words in `apps/plain/index.html`, and rebuild. The letters live in `data/source/sine-glyphs.json`; the designer that drew them is in the repo too, under `apps/designer`. The site publishes from `main` on Cloudflare Pages, and the plain version of the site lives at [/boring/](/boring/) if you want to see the source of truth with your own eyes.

The constraint is the whole trick. One curve per letter sounds like a limitation, and it is — but it forced every other decision. The words live in one place because there is nowhere else for them to live. The page ships as a recipe because the waves are too heavy to ship as a picture. And the letters draw themselves when the page loads, because that is literally how they were made: one wave, then another, bending a circle until it becomes something you can read.

## Sources

- Zanzlanz, ["How I released a game that has no assets"](https://youtu.be/Qr3VsZYQy4s?si=jcJW9ZHsVBTWCCWB) — the video this post starts from. The *Crow Sign* figures (455 KB total, ~11× smaller, music ~500× smaller than MP3 loops, 26 harmonic letters) are as stated in the video.
- [Crow Sign: A Game Built from Sine Waves](https://frontier.catgameresearch.net/crow-sign-sine-companion.html) — a companion guide to the video's techniques, including Fourier synthesis, Audio Worklets, and the harmonic font.
- [sine-portfolio](https://github.com/d-sanoj/sine-portfolio) — the repo. Letter counts, wave counts, file sizes, and the build description above are from its source: `src/core/sine/fit.js` and `src/core/sine/series.js` for the fitting and tracing, `scripts/build.js` for the plain-page build and compact shipping, `src/core/animate/morph.js` for the draw-in animation.
