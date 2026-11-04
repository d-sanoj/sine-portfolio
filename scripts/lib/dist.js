// Assembles dist/, the folder that is published. It has the same URL layout the dev
// server shows, so a page works the same in both:
//
//   /                 apps/site            the sine site            (index.html, app/)
//   /boring/          apps/plain           the plain site
//   /core/            src/core             shared logic (the site imports it)
//   /widgets/         src/widgets          shared page pieces (the portrait loader)
//   /assets/          assets               fonts
//   /data/            data/generated       the sine pages
//
// The designer, the measuring tool, the dev server and the raw data are never published.
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, LAYOUTS } from './paths.js';
import { trimPortraits } from './trim.js';
import { minifyDist } from './minify.js';

const notHidden = (src) => !path.basename(src).startsWith('.');
const copyDir = (from, to) => fs.cpSync(from, to, { recursive: true, filter: notHidden });

// classic: ship the finished pages (sine-page*.json, about 1 MB each) and the complete portraits instead of the compact ones
// minify: false keeps the code as written
export async function makeDist({ classic = false, minify = true } = {}) {
  const out = PATHS.dist;
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'data'), { recursive: true });

  copyDir(PATHS.siteApp, out); // index.html and app/
  copyDir(PATHS.core, path.join(out, 'core'));
  copyDir(PATHS.widgets, path.join(out, 'widgets'));
  copyDir(PATHS.assets, path.join(out, 'assets'));
  fs.mkdirSync(path.join(out, 'boring'), { recursive: true });
  fs.copyFileSync(PATHS.plainPage, path.join(out, 'boring', 'index.html'));
  // Cloudflare Pages: the function in functions/_middleware.js only needs to run for the home page (static files stay free and unlimited)
  fs.writeFileSync(path.join(out, '_routes.json'), JSON.stringify({ version: 1, include: ['/', '/index.html'], exclude: [] }));
  if (classic) {
    for (const l of LAYOUTS) fs.copyFileSync(path.join(PATHS.generated, l.page), path.join(out, 'data', l.page));
  } else {
    // the site makes the page itself from the measured layouts and the letters it uses (see scripts/build.js)
    for (const l of LAYOUTS) fs.copyFileSync(path.join(PATHS.generated, l.measured), path.join(out, 'data', l.measured));
    fs.copyFileSync(path.join(PATHS.generated, 'glyphs-used.json'), path.join(out, 'data', 'glyphs-used.json'));
  }
  for (const f of ['click-word.json', 'boring-word.json']) fs.copyFileSync(path.join(PATHS.generated, f), path.join(out, 'data', f)); // the words shown below a hovered link
  // the portraits the loader draws (traced with apps/portraits); the photos themselves are never published
  if (fs.existsSync(PATHS.portraits)) {
    const dest = path.join(out, 'data', 'portraits.json');
    if (classic) fs.copyFileSync(PATHS.portraits, dest);
    else fs.writeFileSync(dest, JSON.stringify(trimPortraits(JSON.parse(fs.readFileSync(PATHS.portraits, 'utf8'))))); // see trim.js
  }
  if (minify && !classic) {
    const r = await minifyDist(out);
    if (!r) console.warn('esbuild is not installed (run npm install): the code is published as written');
    else console.log('Minified ' + r.files + ' scripts: ' + Math.round(r.before / 1024) + ' KB -> ' + Math.round(r.after / 1024) + ' KB');
  }
}
