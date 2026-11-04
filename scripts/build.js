// Rebuilds the sine pages from the plain page, without opening the designer.
//
//   npm run build                       content = apps/plain/index.html (one source for both sites)
//   node scripts/build.js --content f   content = any HTML page or text file instead
//   npm run build:dist                  also makes dist/: the whole website, ready to publish
//
// The content can be plain markup ("# Heading", "**bold**", "[label](https://...)")
// or an ordinary HTML page. Headings, bold, lists and links are read here, once,
// and baked into the sine data as sizes and line weights; the finished page
// contains no text and no tags. Letters themselves (data/source/sine-glyphs.json)
// only change when you redesign them in the designer.
import fs from 'node:fs';
import path from 'node:path';
import { Content, Layout, Sine } from '../src/core/index.js';
import { ROOT, PATHS, LAYOUTS } from './lib/paths.js';
import { makeDist } from './lib/dist.js';

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } };

const glyphs = readJson(PATHS.glyphs).glyphs;
const contentFile = arg('--content');
// The plain page is the one place the words live; the sine pages are built from it.
const contentPath = contentFile ? path.resolve(contentFile) : PATHS.plainPage;
const text = fs.readFileSync(contentPath, 'utf8');
console.log('Content from ' + path.relative(ROOT, contentPath));

// same page settings the designer last used (seed, irregularity)
const ui = (readJson(PATHS.editorState) || {}).ui || {};
const options = {};
if (ui.join !== undefined) options.join = !!ui.join;
if (ui.irr !== undefined) options.irr = +ui.irr;
if (ui.seed !== undefined) options.seed = Math.max(1, Math.floor(+ui.seed || 1));

const parsed = Content.parse(text);
const counts = {};
for (const b of parsed.blocks) counts[b.kind] = (counts[b.kind] || 0) + 1;
console.log('Read ' + parsed.blocks.length + ' blocks: ' + Object.entries(counts).map(([k, n]) => n + ' ' + k).join(', '));
for (const n of parsed.notes) console.warn('Left out: ' + n);
const used = new Set(parsed.blocks.flatMap((b) => b.words.flatMap((w) => [...Content.resolve(w.t || '', glyphs)])));
const missing = [...used].filter((c) => !glyphs[c]);
if (missing.length) console.warn('No letter designed for: ' + missing.join(' ') + ' (left as a gap)');

// Preferred: place every letter exactly where the browser put it in the plain page
// (run apps/measure once after changing apps/plain/index.html). Without those
// measurements the pages are laid out by the flow layout instead, which is only close.
fs.mkdirSync(PATHS.generated, { recursive: true });
for (const layout of LAYOUTS) {
  const measured = !contentFile && readJson(path.join(PATHS.generated, layout.measured));
  const page = measured
    ? Layout.fromLayout(measured, glyphs, options)
    : Layout.compose(parsed.blocks, glyphs, { ...options, maxWidth: layout.maxWidth });
  if (measured) console.log('Exact layout from data/generated/' + layout.measured);
  fs.writeFileSync(path.join(PATHS.generated, layout.page), JSON.stringify(page));
  console.log('Built data/generated/' + layout.page + ' (' + Math.round(JSON.stringify(page).length / 1024) + ' KB)');
}

// The compact way to ship the page: the sine page is made from two small things by deterministic code (Layout.fromLayout), so
// the website can carry those two and make the page itself when it loads, instead of carrying the whole page (about 1 MB, a
// copy of the sine waves for every letter). They are the measured layouts (layout-*.json) and the letters the page uses.
// The result is exactly the same page: scripts/check-compact.js proves it.
{
  const used = new Set();
  for (const layout of LAYOUTS) {
    const L = readJson(path.join(PATHS.generated, layout.measured));
    if (!L) continue;
    for (const g of L.groups) for (const [c0] of g.chars) for (const ch of (glyphs[c0] ? c0 : Content.resolve(c0, glyphs))) if (glyphs[ch]) used.add(ch);
  }
  const subset = {};
  for (const ch of [...used].sort()) subset[ch] = glyphs[ch];
  fs.writeFileSync(path.join(PATHS.generated, 'glyphs-used.json'), JSON.stringify({ format: 'sine-glyphs-used', options, glyphs: subset }));
  console.log('Built data/generated/glyphs-used.json (' + used.size + ' letters, ' + Math.round(JSON.stringify(subset).length / 1024) + ' KB)');
}

// The words shown below a hovered link, in the designed letters: laid out once and centred on the origin (units: ems, y up),
// so the page can grow them out of the link's underline. shift(i) moves letter i to the right (ems): at a small size some
// designed letters join up (the "c" and "l" of "click" read as a "d"), so a little room is added.
function hintWord(text, file, shift) {
  const composed = Layout.compose(Content.parse(text).blocks, glyphs, { ...options, maxWidth: 40 }).lines[0].flatMap((w) => w.l);
  const word = composed.map((l, i) => {
    const [k, a, ph] = l.s[0]; // the position of the letter is its first term (k = 0)
    const x = a * Math.cos(ph) + shift(i), v = a * Math.sin(ph);
    return { ...l, s: [[k, Math.hypot(x, v), Math.atan2(v, x)], ...l.s.slice(1)] };
  });
  let x0 = Infinity, v0 = Infinity, x1 = -Infinity, v1 = -Infinity;
  for (const l of word) {
    const xy = Sine.trace(l.s, 120);
    for (let j = 0; j < xy.length; j += 2) { x0 = Math.min(x0, xy[j]); x1 = Math.max(x1, xy[j]); v0 = Math.min(v0, xy[j + 1]); v1 = Math.max(v1, xy[j + 1]); }
  }
  const cx = (x0 + x1) / 2, cv = (v0 + v1) / 2;
  const letters = word.map((l) => {
    const [k, a, ph] = l.s[0];
    const x = a * Math.cos(ph) - cx, v = a * Math.sin(ph) - cv;
    return { s: [[k, +Math.hypot(x, v).toFixed(5), +Math.atan2(v, x).toFixed(5)], ...l.s.slice(1)], g: l.g || [] };
  });
  fs.writeFileSync(path.join(PATHS.generated, file), JSON.stringify({ format: 'sine-word', word: text, width: +(x1 - x0).toFixed(3), height: +(v1 - v0).toFixed(3), letters }));
  console.log('Built data/generated/' + file + ' (the words shown below a hovered link: ' + text + ')');
}
hintWord('click', 'click-word.json', (i) => (i === 0 ? 0 : 0.1)); // everything after the "c" moves right
hintWord('Sanoj', 'hero-word.json', (i) => 0.025 * i); // the word at the top of the sine page that you can drag (apps/site/app/view/HeroWord.js)
hintWord('boring text version', 'boring-word.json', (i) => 0.03 * i); // shown below the link to the plain page (HINT.words in apps/site/app/config.js)

if (process.argv.includes('--dist')) {
  await makeDist({ classic: process.argv.includes('--classic'), minify: !process.argv.includes('--no-minify') });
  console.log('Made dist/: the sine site at the root, the plain site in dist/boring/');
}
