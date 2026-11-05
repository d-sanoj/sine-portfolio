# sine.portfolio

A portfolio drawn entirely from sine waves. Every letter is one sine curve; the page
has no text and no images. It is built from an ordinary HTML page, so you only ever
edit that page.

```
npm run dev          start the dev server  ->  http://localhost:5173/
npm run build        rebuild the sine pages from the plain page
npm run build:dist   rebuild and make dist/, the folder you publish
```

| Address | What it is |
|---|---|
| `/` | the sine site (the default) |
| `/boring/` | the plain HTML site |
| `/blog/` | the notes, newest first, and `/blog/<slug>/` for one note |
| `/designer/` | the letter designer (development only) |
| `/measure/` | measures the plain page (development only; the build does this itself) |
| `/portraits/` | traces the loader portraits from photos (development only) |

## Updating the content

Edit `apps/plain/index.html`, then `npm run build:dist`. The build measures the plain page
(headless Chrome) whenever that file or the notes have changed, and writes `dist/`. You do not
have to open `/measure/` first. The dev server measures too, the next time the sine page is
asked for after a change. `/measure/` is still there if you want to watch the measuring happen.

## Blog

Notes are Markdown files. The blog is plain HTML, in the same type and colours as `/boring/`.
Only the home page draws the latest notes as sine waves. `npm run dev` serves the notes at
`/blog/`, and `npm run build:dist` writes them into `dist/blog/`.

| Address | What it is |
|---|---|
| `/blog/` | every published note, newest first |
| `/blog/<slug>/` | one note |
| `/blog/feed.xml` | the Atom feed |

### Writing a note

Add `content/blog/<slug>.md`. The file name is the address (`how-a-model-reads-a-word.md` is
`/blog/how-a-model-reads-a-word/`), lowercase words separated by hyphens. Images for that note
go in `content/blog/<slug>/` and are named from the note: `![...](diagram.svg)` means
`content/blog/<slug>/diagram.svg`.

```markdown
---
title: How a model reads a word
date: 2026-11-05
description: One sentence. The home page draws every letter of this.
cover: cover.png
coverAlt: What the cover image shows.
---
```

| Field | |
|---|---|
| `title` | required. The page's only `h1`. |
| `date` | required, `YYYY-MM-DD`. Newest first. |
| `description` | required. Also the meta description. Keep it to one sentence: the home page draws it. |
| `cover`, `coverAlt` | optional image for sharing. `coverAlt` is required when there is a cover. |
| `draft` | `true` leaves it off the site, the feed and the home page. The dev server still opens it. |
| `lang` | optional, defaults to `en`. |

In the body, `#` is a section (`h2`) and `##` is `h3`. The title is already the `h1`.
Lists, tables (`Table: caption` on the line above), quotes, fenced code and links are the ordinary Markdown ones. To link another note, use its slug: `[How a model reads a word](how-a-model-reads-a-word)`.

An image is its own line. The words in brackets are the alt text, and the build **stops** if they are missing:

```markdown
![What the picture shows](diagram.svg "A short caption under it")

:::describe
A longer account of a diagram or an animation: paragraphs and lists.
:::
```

`:::describe` is optional. It becomes a disclosure under the figure ("Text description of this diagram", or "of this animation"). Use it when the alt text cannot carry the whole thing, which is the usual case for a step-by-step picture.

An empty alt is allowed only when you mark the image as decoration: `![](rule.svg){decorative}`.

A GIF, and an SVG whose CSS or SMIL animates, gets a Pause button. Someone who prefers reduced motion gets a still first frame (the build keeps frame 1 of a GIF) or the SVG held at the start, and Play. `{poster=still.png}` uses your own still instead of frame 1. Put the animation on its own line so the button belongs to it.

Publishing is adding the `.md` (and its images) and pushing. Cloudflare runs `npm ci && npm run build:dist`. The three newest notes are filled into the home page, in the same rows as the projects: title (a link), then the date and the description. The markers are `<!-- blog:latest -->` in `apps/plain/index.html`; editing those rows by hand does nothing. The link written there is `../blog/<slug>/`, which lands on the note from both `/` and `/boring/`.

`/blog/` is a static file. `functions/_middleware.js` only answers `/` (see `_routes.json`), so a phone opens the blog as the blog, not the plain home page.

`npm run check:blog` checks that a missing alt stops the build. `npm run check:a11y` runs axe-core against the built blog after `npm run build:dist`.

The three notes already in `content/blog/` are samples. Delete them when real ones replace them.

## One page, two versions

`apps/plain/index.html` is the one place the words live, and the sine page is measured from it (`/measure/`). A few bits differ:
`data-plain-only` marks something only the plain page has (its first About line, which links to the sine page); `data-sine="only" hidden`
marks something only the sine page has (its About hook line, with the "click here" link to the plain page). The measuring tool removes
the first kind and shows the second, so the sine layout is the plain page as the sine page should have it.

## Where each letter sits

A letter's position is its first term (k = 0), stored as a radius and an angle. On a tall page the radius is large (about 190 ems at the
bottom), so an angle rounded to 3 decimals, which is what `affineTerms` does, could put a letter up to about 2 px out: unnoticeable
near the top, but as big as the gaps between letters near the bottom, and different for every letter (it looked like "sometimes bad
spacing"). `fromLayout` (`src/core/layout/measured.js`) therefore sets each position exactly. Checked against the browser's own letter
positions: the error went from an average of 0.4 px (worst about 2 px) to 0.

## Updates reach visitors at once

Browsers keep scripts for hours, so an update could be seen with old code and new data. The build prevents that
(`stampScripts` in `scripts/lib/dist.js`): every script gets a fingerprint of its contents, `dist/index.html`'s import map sends
each import to `file.js?v=<fingerprint>`, and the page's own `<script>` tag gets one too. A script that changed has a new address and
is fetched again; one that did not keeps its address and stays cached. (The dev server does not do this; it does not cache.)

## The greeting

The big heading is "Good morning / afternoon / evening. I’m Sanoj." by the visitor’s own clock: morning 5 am to noon, afternoon noon to 5 pm,
evening from 5 pm all night. The greeting is a line of its own in `apps/plain/index.html` (`data-greet`), so all three take the same room
and nothing below moves. The plain page sets it with a few lines of script. On the sine page the letters are drawn from measured positions,
so the measuring tool measures all three greetings (`greeting` in `apps/measure/app/main.js`), the page holds the evening’s words
(flagged `greet`) and the others in `greetings`, and `applyGreeting` in `apps/site/app/services/pageLoader.js` swaps in the right ones before
anything is built. `?greeting=morning` (or `afternoon`, `evening`) shows one on purpose. To change the hours, change them in both places.

## No scrolling during the first animation

The sine page does not scroll until its first animation is over (the loader, then the letters arriving): `lock` and `unlock` in
`apps/site/app/main.js` hold the window still, with a 9 second timer so it can never stay locked. People who prefer reduced motion are not locked.

## A word that shows a picture

The "here" in the last About line is not a link: hovering it (or focusing it, or tapping it on a phone) shows a pencil portrait
(`assets/portrait.jpg`, fetched only the first time). On the plain page that is the `.peek` span and the small script at the end of
`apps/plain/index.html` (`data-peek`). On the sine page the measuring tool records the word as a word with a `peek` picture
(`data-sine-peek` gives the address from the home page), it is underlined in yellow like a link, and `apps/site/app/view/PeekView.js`
shows the picture above it while it is hovered. To use another picture, replace `assets/portrait.jpg` (about 512 x 640 keeps it light).

## Real text on the sine page

Everything on the sine page is drawn, except what the plain page marks `data-sine-real` (now: "for accessible content click here"
in the About hook). The measuring tool does not turn those words into sine letters; it records where each piece sits (one piece per
row of text and per link) in `layout-*.json` (`real`), and `apps/site/app/view/RealTextView.js` puts real HTML text there, in the
page's own font (`assets/fonts/JosefinSans-VF.ttf`, loaded by `apps/site/index.html`), so the words around it stay sine waves and
this part is real text: a screen reader reads it as one paragraph, the link can be reached with the keyboard (Tab) and followed, and the
text can be selected. A link in it also lights up the hover hint like any other link. It fades in after the letters have formed.

## The portrait

The sine home page opens with one big portrait loader, centred on the screen (the plain page has none; it just appears). While the page loads, a circle
forms a portrait, holds, dissolves back to a circle, and does it again with another random portrait,
until the page is ready. One cycle takes 2 seconds (1.0 forming, 0.35 holding, 0.65 dissolving); the loader
leaves at the end of the cycle it is in once the page is ready (`MIN_SHOW` can make it stay longer).

- **Sine home page (`/`):** the portrait then dissolves into a big circle, which pops: it draws in a little,
  then shatters into one bead per letter (the ring itself turns into a ring of beads). Every bead sets off at
  its own random moment, along its own curved path, and springs past its place and back by its own amount, so
  they pop into place one by one, like popcorn. The moment a bead lands, its letter starts forming from it
  (the usual circle-to-letter morph). Lines (underlines, rules) come from the same circle: each is a bead too,
  and when it lands it swells and stretches out into its line. The code: `apps/site/app/model/Gather.js` and
  `controller/GatherController.js`; `startLoader({ mode: 'circle' })` hands over the circle. Timing and
  boldness are in `apps/site/app/config.js` (`GATHER_*`).
- **Plain page (`/boring/`):** has no loader at all.

**Scrolling (sine home page):** content that comes onto the screen is drawn in again, quickly. Every letter on
it forms from its circle in about 0.4 seconds, flying in from a nearby spot, a random few hundredths of a second
after the part appears. A part that scrolls well away and comes back forms again, so the text keeps rearranging as
you move. Code: `apps/site/app/controller/ScrollController.js`; timing and distances are `SCROLL_*` in
`apps/site/app/config.js`. People who prefer reduced motion get the page drawn without the animation.

**Hovering a link (sine home page):** the system cursor is left as it is (a hand over a link). The word "click" forms below the
link, toward its right end, growing out of the underline: five circles, one for each letter of the word in the designed
letters, start stacked as one small circle on the underline, travel down below it, move apart and take their letter shapes
(the same circle-to-letter morph as the page's letters), in the underline's yellow. It starts 30 ms after the pointer reaches
the link, takes 0.65 s to form in 20 steps, and folds back in 0.3 s when the pointer leaves; the word is the same size
(12.3 px per em) wherever it appears. The link to the plain page (the "click here" in the About section) says "boring text version" instead, starting where "click" starts and running on to the right (`HINT.words`; `data/generated/boring-word.json`, made by the same build step). The word comes from `data/generated/click-word.json`, made by the build (it moves everything after the "c" right by 0.1 em, because the designed "c" and "l" join up and read as a "d" at a small size; `SPLIT` in `scripts/build.js`),
(`npm run build`) from `data/source/sine-glyphs.json`, so it changes when you redesign the letters. Whether the pointer is on a
link is checked on every pointer move and also when the page scrolls or resizes under a still pointer, when the pointer
leaves the window, and when the tab or window comes back to the front. Code: `apps/site/app/controller/HintController.js` and
`view/HintView.js`; sizes and timings in `HINT` in `apps/site/app/config.js`.

There is no portrait in the page itself. With `?noloader`, or reduced motion, there is no loader and the page just starts.

The portrait is one closed sine curve (about 2,200 waves) traced from `data/source/photos/portrait-01.jpg`.
It is not cropped: the loader fills the screen with the whole drawing. It begins as a circle as wide as the
drawing is tall, in the middle of the screen (see `startCircle` in `src/core/animate/morph.js`).
The lines are white. The colour is inside them, and it is sine waves too: the photo is reduced to 9 colours, split
into areas of one colour (skin, shirt, hair, the whites of the eyes ...), and each area's edge is fitted as a closed
sine curve (an area with holes is several curves, filled with the even-odd rule). They are the `f` list in
`portraits.json` (about 200 areas, a few thousand waves). Each area's colour is sine waves too: its mean colour plus
three waves per channel along the area's long axis (`g`), fitted to the shading the photo really has there.
The fills are solid and form the way the outline does: at the start, inside the big white circle, there are small
circles of the colours needed (one per area, bigger for bigger areas), scattered loosely where they belong, each
setting off at its own moment; they grow, move to their places and take their shape with the same circle-to-shape
morph as the outline, a little behind it, and the shading comes in as they form. They dissolve back to small circles
as the portrait dissolves. `FILL` in `src/widgets/loader/config.js` sets their size, scatter and timing.
At the end these same coloured circles are what pops into the page: the loader hands them over, each letter's bead
starts as one of them (a circle with several letters to make splits into that many), and its colour turns into the
letter's colour as it flies and the solid circle opens into the letter's ring. The underlines of hyperlinks are yellow
(`LINK_YELLOW` in `apps/site/app/config.js`), and they come from the yellowest, biggest of the coloured circles (the
shirt's); each swells and stretches out into its underline when it lands.
Lines take the colour of the fill beside them, so the dark outline of the photo is
absorbed; the speech bubble is left empty. Code: `apps/portraits/app/services/regions.js`.
While it forms, the curve is drawn with only as many points as the waves in use need (`CURVE_LEVELS`), so the
heavy final curve costs nothing until the end.
For now there is just one portrait; the loader and the tracer take any number (`COUNT` in
`apps/portraits/app/config.js`), and the loader shows them in random order.

Timing is in `src/widgets/loader/config.js` (the portrait) and `apps/site/app/config.js` (the dividing).

To change them: put photos in `data/source/photos/` as `portrait-01.jpg`, `portrait-02.jpg`, ... (and set `COUNT`),
open `/portraits/`, click **Trace all**, then **Save portraits**, then `npm run build:dist`.
The loader is skipped for people who prefer reduced motion, and when the address has `?noloader`.

## Publishing (Cloudflare Pages)

The site is published by Cloudflare Pages from this repository's `main` branch: every push builds it and publishes it at
https://sanoj.dev/ (the plain page is at `/boring/`, the notes at `/blog/`). The Pages project (Workers & Pages -> `sine-portfolio`) uses:

| Setting | Value |
|---|---|
| Build command | `npm ci && npm run build:dist` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION` = `22` |

The addresses inside the site are relative (the code's imports go through an import map in `apps/site/index.html`, and the data,
fonts and links are relative to their page), so the same build works at the root of a domain or in a folder.
The earlier version of the site is kept at https://archive.sanoj.dev/.

**Phones get the plain page.** `functions/_middleware.js` (a Cloudflare Pages Function) answers the home page `/` for a phone
with the plain page (`boring/index.html`) under the same address; computers and tablets get the sine page. It only runs for `/`
(`_routes.json` in `dist/`, written by `scripts/lib/dist.js`), so it stays within the free plan. On a phone the plain page keeps its
link to the sine page (the bold "sine waves" in the first About line), but tapping it opens a pop-up ("Best on a bigger screen") instead of going to the sine page, which skips frames on phones
(`.sine-modal` in `apps/plain/index.html`; the measuring tool ignores it because it is not drawn).
To try it without deploying: `npx wrangler pages dev dist` after `npm run build:dist`, then ask for `/` with a phone's user agent.
The local dev server (`npm run dev`) does not run the function, so there a phone still gets the sine page.

## The tab icon

A solid yellow wobbly circle (an amoeba): a circle whose radius is wobbled by a few sine waves. `node scripts/make-favicon.js` draws it
into `assets/` (`favicon.svg` for the tab, `favicon-32.png` and `favicon.ico` as fallbacks, `apple-touch-icon.png` for a phone's home
screen); the waves, the yellow and the size are at the top of that script. Both pages link to the icons in their `<head>`. Browsers keep a page's tab icon for a long time, so after changing the icon, raise the `?v=` number on those links so they download it again.

## Size, and going back

`npm run build:dist` makes a small website: opening `/` loads about **463 KB** uncompressed on a desktop,
under the 512 KB Club's limit (which counts uncompressed bytes). The three notes on the home page are about 10 KB of that, because every new letter is another position in the measured layout. A phone is sent the plain page, about 140 KB, mostly the font. The site is smaller in three ways, and each can be turned off:

| What | Instead of | Same look? | To go back |
|---|---|---|---|
| The page is made in the browser from `layout-*.json` + `glyphs-used.json` (about 120 KB) | shipping `sine-page*.json` (about 1 MB each) | yes: `node scripts/check-compact.js` shows the result is the same page. (In a browser a few numbers differ in the last digit from Node's, about 0.06 px.) | `--classic`, or `?classic` in the address while developing |
| `portraits.json` is published without the outline waves that have an amplitude of 0 (`scripts/lib/trim.js`) | all 2,200 waves (156 KB -> 136 KB) | the finished portrait is identical; between 80% and 95% of the forming about 1% of the outline's edge pixels move by a fraction of a pixel | `--classic` |
| The published scripts are minified by esbuild (`scripts/lib/minify.js`) | the code as written (102 KB -> 45 KB) | identical | `--no-minify` |

```
npm run build:dist                       the small website
node scripts/build.js --dist --no-minify  small data, readable code (good for debugging dist/)
node scripts/build.js --dist --classic    the complete old way: 1 MB pages, whole portraits, unminified
```

The source (`apps/`, `src/`, `data/generated/portraits.json`) is never changed by any of this, only the copy in `dist/`.
The site's own address `?classic` / `?src` switches back to the finished pages in development too (`apps/site/app/services/pageLoader.js`).
`npm install` is needed once for esbuild; without it the build still works and publishes the code as written.
The plain page (`/boring/`) is about 140 KB, mostly its font.

## Layout

```
apps/                       each app is its own small MVC program
  site/                       the sine site       index.html + app/{model,view,controller,services}
  plain/                      the plain site      index.html (the one place the words live)
  designer/                   the letter designer index.html + styles.css + app/{model,view,controller,services}
  measure/                    the measuring tool  index.html + app/{view,services}
  portraits/                  the portrait tracer index.html + app/{model,view,controller,services}
content/blog/               the notes: one `<slug>.md`, images in `<slug>/`
src/core/                   the shared model layer: pure logic, no DOM, no Node, no files
  sine/                       the math (series.js, fit.js, transform.js)
  content/                    reading text, markup and HTML into blocks
  layout/                     blocks (or a measured layout) -> a sine page
  render/                     drawing a finished page on a canvas
  animate/                    how a curve forms from a circle (shared by the site and the loader)
src/widgets/loader/        the portrait loader the sine page shows while loading (model, view, controller)
server/                     the dev server (infrastructure; development only)
scripts/                   the build (infrastructure): build.js, lib/{paths,dist}.js
assets/fonts/              Josefin Sans (the source of the letter shapes)
data/
  source/                    what people author: editor.json, sine-glyphs.json, designer-text.txt
                              photos/ the photos the loader portraits come from (not kept in git, never published)
  generated/                 what the tools make: layout-*.json, portraits.json, the small word files (sine-page*.json is
                              made again by `npm run build` and is not kept in git)
  preview/                   the designer's page preview (not kept in git)
dist/                      the published website (made by the build, not kept in git)
```

## The layers

Dependencies point inward only:

```
apps/*/app/controller  ->  model, view, services
apps/*/app/view        ->  model (reads it, never changes it)
apps/*/app/model       ->  src/core
apps/*/app/services    ->  the outside world (files, server, fonts, the browser)
src/core               ->  nothing
scripts, server        ->  src/core, scripts/lib/paths.js
```

- **Model** holds data and rules, and knows nothing about the screen.
- **View** draws the model and never changes it.
- **Controller** turns events (mouse, buttons, time) into changes to the model, then asks the view to redraw.
- Each app's `main.js` only wires these together.

`src/core` is used by the browser apps (served at `/core/...`) and by the Node build
(imported by path), so the same code makes the pages in both places.

## Notes

- The published site has the same URL layout the dev server shows, so nothing changes
  between development and the real site (see `scripts/lib/dist.js`).
- Josefin Sans is under the SIL Open Font License (`assets/fonts/OFL.txt`).
