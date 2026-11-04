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
| `/designer/` | the letter designer (development only) |
| `/measure/` | measures the plain page (development only) |
| `/portraits/` | traces the loader portraits from photos (development only) |

## Updating the content

1. Edit `apps/plain/index.html`.
2. Open `http://localhost:5173/measure/` once. It asks the browser where the plain page
   puts every character, line and underline, and saves the numbers.
3. `npm run build:dist`, then publish `dist/`.

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
(12.3 px per em) wherever it appears. The link to the plain page ("See it plain") says "boring text version" instead, starting where "click" starts and running on to the right (`HINT.words`; `data/generated/boring-word.json`, made by the same build step). The word comes from `data/generated/click-word.json`, made by the build (it moves everything after the "c" right by 0.1 em, because the designed "c" and "l" join up and read as a "d" at a small size; `SPLIT` in `scripts/build.js`),
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

## Publishing (GitHub Pages)

```
npm run deploy       builds dist/ and pushes it to the gh-pages branch (plain git, nothing else to set up)
```

In the repository, Settings -> Pages -> Source: **Deploy from a branch**, branch `gh-pages`, folder `/ (root)` (once). The site is then at
`https://<user>.github.io/<repository>/`; the sine page is at that address and the plain page is in `boring/` below it.
`main` holds the source and is pushed as usual; `gh-pages` holds only the finished website (`scripts/deploy.js`). The addresses
inside the site are relative (the code's imports go through an import map in `apps/site/index.html`, and the data, fonts and links
are relative to their page), so the same build works at the root of a domain or in a folder.

## Size, and going back

`npm run build:dist` makes a small website: opening `/` loads about **306 KB** uncompressed on a desktop (261 KB on a phone),
under the 512 KB Club's limit (which counts uncompressed bytes). It is smaller in three ways, and each can be turned off:

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
The plain page (`/boring/`) is about 130 KB, mostly its font.

## Layout

```
apps/                       each app is its own small MVC program
  site/                       the sine site       index.html + app/{model,view,controller,services}
  plain/                      the plain site      index.html (the one place the words live)
  designer/                   the letter designer index.html + styles.css + app/{model,view,controller,services}
  measure/                    the measuring tool  index.html + app/{view,services}
  portraits/                  the portrait tracer index.html + app/{model,view,controller,services}
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
