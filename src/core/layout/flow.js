// The flow layout: breaks content into lines and sets every letter itself.
// It is the fallback when the plain page has not been measured (see measured.js),
// and what the designer's text preview uses.
//
//   page   = { format, version, bounds: [x0, v0, x1, v1], lines: [ [ word, ... ], ... ] }
//   word   = { l: [ letter, ... ], h?: "https://link", w?: line weight (1 = normal) }
//   letter = { s: [[frequency, amplitude, phase], ...], g?: [[t0, t1], ...] }
//
// A letter is ONE closed sine curve. g lists the stretches of that loop that
// are not drawn (the pen travelling from the stem of an i to its dot).
//
// How structure survives without any text: it is read once, at build time, and
// turned into numbers. A heading is the same letters drawn bigger and with more
// space around them; bold is the same letters drawn with a heavier line (w).
// Links keep their address in h, invisible, used only on click.
import { Sine } from '../sine/index.js';
import { Content } from '../content/index.js';
import { mulberry32 } from './random.js';
import { DEFAULTS, STYLES, BOLD } from './styles.js';

const isLower = (c) => c >= 'a' && c <= 'z';
const isUpper = (c) => c >= 'A' && c <= 'Z';

// Where a letter's join starts and ends. Uses the anchors stored with the
// glyph; data without them falls back to the lowest point at each edge.
const anchorCache = new Map();
function anchors(ch, g) {
  if (g.in && g.out) return { entry: g.in, exit: g.out };
  const sig = ch + JSON.stringify(g.s);
  if (anchorCache.has(sig)) return anchorCache.get(sig);
  const xy = Sine.trace(g.s, 300);
  const pts = [];
  for (let j = 0; j < xy.length; j += 2) pts.push([xy[j], xy[j + 1]]);
  let minX = Infinity, maxX = -Infinity;
  for (const [x] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  const lowest = (list) => list.reduce((a, b) => (b[1] < a[1] ? b : a));
  const res = {
    entry: lowest(pts.filter((p) => p[0] <= minX + 0.03)),
    exit: lowest(pts.filter((p) => p[0] >= maxX - 0.03)),
  };
  if (anchorCache.size > 400) anchorCache.clear();
  anchorCache.set(sig, res);
  return res;
}

export function compose(input, data, options) {
  const o = { ...DEFAULTS, ...options };
  const rnd = mulberry32(o.seed);
  const R = () => rnd() * 2 - 1;
  const wordWidth = (t) => [...t].reduce((s, ch) => s + (data[ch] ? data[ch].adv + o.track : o.space), 0);

  // 1. break every block into lines that fit the page width
  const rows = [];
  const parsed = Content.parse(input).blocks.map((b) => ({ ...b, words: b.words.map((w) => (w.t === undefined ? w : { ...w, t: Content.resolve(w.t, data) })) }));
  for (const block of parsed) {
    const st = STYLES[block.kind] || STYLES.p;
    const limit = o.maxWidth / st.size;
    const first = rows.length;
    let row = [], x = 0;
    const push = () => { rows.push({ words: row, size: st.size, before: 0, after: 0 }); row = []; x = 0; };
    for (const w of block.words) {
      if (w.br) { push(); continue; }
      const ww = wordWidth(w.t);
      if (row.length && x + ww > limit) push();
      row.push(w);
      x += ww + o.space;
    }
    push();
    rows[first].before = st.before;
    rows[rows.length - 1].after = st.after;
  }
  if (!rows.length) rows.push({ words: [], size: 1, before: 0, after: 0 });

  // 2. draw each line at its own size, going down the page
  let widest = 1;
  let base = 0;
  const lines = rows.map((r, li) => {
    if (li > 0) {
      const prev = rows[li - 1];
      base -= o.lineHeight * (prev.size + r.size) / 2 + Math.max(prev.after, r.before);
    }
    const size = r.size;
    let cursor = 0;
    const words = r.words.map((w) => {
      const letters = [];
      let prev = null; // { ch, exit: [x, v] absolute }
      for (const ch of w.t) {
        const g = data[ch];
        if (!g) { cursor += o.space * size; prev = null; continue; }
        const an = anchors(ch, g);
        // size and position vary a little; there is no tilt and no slant
        const s = (1 + R() * 0.04 * o.irr) * size;
        const jx = R() * 0.008 * o.irr * size;
        let voff = R() * 0.006 * o.irr * size;
        const al = [s, 0], be = [0, 0];
        const entry0 = Sine.affinePoint(an.entry, al, be, [0, 0]);
        let x0 = cursor + jx;
        // capitals stand alone when joining is on: a gap so they never touch a neighbour
        if (o.join && prev && (isUpper(prev.ch) || isUpper(ch))) x0 += o.capGap * size;
        // lowercase letters meet: the exit of one is the entry of the next
        if (o.join && prev && isLower(prev.ch) && isLower(ch)) {
          const dx = prev.exit[0] - (x0 + entry0[0]);
          const dv = prev.exit[1] - (base + voff + entry0[1]);
          if (Math.abs(dx) < 0.1 * size) x0 += dx;
          if (Math.abs(dv) < 0.04 * size) voff = Math.max(-0.03 * size, Math.min(0.03 * size, voff + dv));
        }
        const tau = [x0, base + voff];
        const letter = { s: Sine.jitter(Sine.affineTerms(g.s, al, be, tau), R, o.irr) };
        if (g.g && g.g.length) letter.g = g.g;
        letters.push(letter);
        prev = { ch, exit: Sine.affinePoint(an.exit, al, be, tau) };
        cursor = x0 - jx + g.adv * s + o.track * size;
      }
      cursor += o.space * size;
      const word = { l: letters };
      if (w.h) word.h = w.h;
      if (w.b) word.w = BOLD;
      return word;
    });
    widest = Math.max(widest, cursor - o.space * size);
    return words;
  });

  const first = rows[0], last = rows[rows.length - 1];
  return {
    format: 'sine-page', version: 4,
    note: 'lines > words > letters. A letter is one closed curve: s = [frequency, amplitude, phase] terms, x = sum a*cos(2*pi*f*t+p), y = sum a*sin(2*pi*f*t+p), t in 0..1; g = ranges of t that are not drawn. Units are ems, y up. A word may carry h (the address it opens when clicked) and w (line weight, 1 = normal; bold is heavier). Headings are simply larger letters.',
    bounds: [-0.2, base - 0.45 * last.size, widest + 0.2, 1.05 * first.size],
    lines,
  };
}
