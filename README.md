# sine.portfolio

My portfolio website — https://sanoj.dev/

The whole site is drawn entirely from sine waves. Every letter is one sine curve, and the home page has no text or images in the usual sense: it is built from an ordinary HTML page, so you only ever edit that page.

## Run it locally

```sh
npm install   # once
npm run dev   # http://localhost:5173/
```

`npm run build:dist` builds the site into `dist/`, which is what gets published.

| Address | What it is |
|---|---|
| `/` | the sine site |
| `/boring/` | the plain HTML site |
| `/blog/` | the notes, newest first |

## Edit the content

All the words on the site live in one file: `apps/plain/index.html`. Edit it, then rebuild. The sine home page is measured from that page, so your changes show up there automatically.

## Blog

Notes are Markdown files in `content/blog/`. To add one, create `content/blog/<slug>.md`:

```markdown
---
title: How a model reads a word
date: 2026-11-05
description: One sentence about the note.
cover: cover.png
coverAlt: What the cover image shows.
---

Your writing here. `#` is a section, `##` is a sub-section.
```

Images for that note go in `content/blog/<slug>/` and are linked by their file name, for example `![What the picture shows](diagram.png)`. Every image needs alt text, or the build stops.

## Smooth animation

The sine page draws on a canvas that is only a little taller than the screen and follows the page as it scrolls (`BAND_MARGIN` in `apps/site/app/config.js`). The canvas is never drawn sharper than 1.5 pixels per CSS pixel (`MAX_PIXEL_RATIO`). The loader adds up only the waves that change from one frame to the next. Together these keep the animation smooth on big screens and slower computers.

## Publishing

The site is published by Cloudflare Pages from the `main` branch: every push builds it with `npm ci && npm run build:dist` and publishes it at https://sanoj.dev/.

## Make it yours

Want a site like this for yourself? Fork the repo, put your own words in `apps/plain/index.html`, add your own notes under `content/blog/`, and point Cloudflare Pages (or any static host) at `main` with the build command above. The typeface is Josefin Sans, under the SIL Open Font License (`assets/fonts/OFL.txt`).
