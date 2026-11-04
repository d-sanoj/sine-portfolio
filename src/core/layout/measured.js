// The measured layout: the exact page.
//
// The browser has already placed every character of the plain page. fromLayout
// (data/generated/layout-*.json, made by apps/measure) puts each sine letter at that
// exact place, at that size, in that colour, with the line weight of that font
// weight; borders become rules and underlines are kept. Positions are in px in the
// layout and in ems of the body text (page.px pixels) in the page.
//
//   page.px      pixels per em          page.vw / page.height   size of the measured page
//   page.bg      page colour            page.palette / accent   colours (words refer to palette by number)
//   word.peek    a picture (address) shown when the word is hovered
//   word.c       colour number          word.u        underline rows [x0, x1, v] in ems, word.uw their weight
//   page.rules   [{ a, b, v, w, c, full }]  horizontal lines; full ones run the width of the screen
//   page.anchors { id: v }              where #links scroll to
//   page.slots   [{ id, x, v, w, h }]  boxes the sine page fills with something else, in ems (v = the top)
//   page.sr      [{ tag, t }]          text that is on the sine page only as hidden real text
//   page.real    [{ fs, wt, ls, c, frags: [{ t, x, v, w, h, href? }] }]  text that stays real text (page ems; v = top of the piece)
import { Sine } from '../sine/index.js';
import { Content } from '../content/index.js';
import { mulberry32 } from './random.js';
import { LINE } from './styles.js';

export function fromLayout(L, data, options) {
  const o = { irr: 0, seed: 1, ...options };
  const rnd = mulberry32(o.seed);
  const R = () => rnd() * 2 - 1;
  const px = L.px;
  // A drawn line a little thinner than the font's real stem looks the same: the centre-line
  // letters have round ends and overlap where strokes join, which reads heavier.
  const THIN = 0.72;
  const weightOf = (wt, fs) => +((THIN * (L.stems[wt] || 0.05) * fs) / (LINE * px)).toFixed(2);
  const words = [];
  for (const g of L.groups) {
    const letters = [];
    for (const [c0, x, y, fs] of g.chars) {
      // a character without a designed shape is swapped for a close one (which may be several characters)
      const shown = data[c0] ? c0 : Content.resolve(c0, data);
      let pen = x;
      for (const ch of shown) {
        const gl = data[ch];
        if (!gl) continue;
        const s = (fs / px) * (1 + R() * 0.03 * o.irr);
        const tau = [pen / px, -y / px + R() * 0.004 * o.irr];
        // The letter's position is its k = 0 term, stored as a radius and an angle. On a tall page the radius is large (about 190 ems
        // at the bottom), so an angle rounded to 3 decimals (as affineTerms does) can put the letter up to 0.1 em out: invisible near the
        // top, but as big as the gaps between letters at the bottom, and different for every letter. So the position is kept exactly.
        const placed = Sine.affineTerms(gl.s, [s, 0], [0, 0], tau).filter((t) => t[0] !== 0);
        const dc = gl.s.find((t) => t[0] === 0) || [0, 0, 0];
        const cx = s * dc[1] * Math.cos(dc[2]) + tau[0], cy = s * dc[1] * Math.sin(dc[2]) + tau[1];
        placed.unshift([0, +Math.hypot(cx, cy).toFixed(6), +Math.atan2(cy, cx).toFixed(7)]);
        const letter = { s: Sine.jitter(placed, R, o.irr) };
        if (gl.g && gl.g.length) letter.g = gl.g;
        letters.push(letter);
        pen += gl.adv * fs;
      }
    }
    if (!letters.length) continue;
    const [, , , fs, wt, ci] = g.chars[0];
    const word = { l: letters, c: ci };
    const w = weightOf(wt, fs);
    if (w !== 1) word.w = w;
    if (g.h) word.h = g.h;
    if (g.peek) word.peek = g.peek; // not a link: hovering it shows this picture
    if (g.u && g.u.length) {
      word.u = g.u.map(([x0, x1, y]) => [+(x0 / px).toFixed(4), +(x1 / px).toFixed(4), +(-y / px).toFixed(4)]);
      word.uw = +(g.u[0][3] / (LINE * px)).toFixed(2);
    }
    words.push(word);
  }
  // the narrowest screen this layout fits: the text column plus the side space the plain page keeps
  const xs = L.groups.flatMap((g) => g.chars.map((ch) => ch[1]));
  const ends = L.groups.flatMap((g) => g.chars.map((ch) => ch[1] + ch[6]));
  const contentW = Math.max(...ends) - Math.min(...xs);
  const rules = L.rules.map((r) => ({
    a: +(r.x0 / px).toFixed(4), b: +(r.x1 / px).toFixed(4), v: +(-r.y / px).toFixed(4),
    w: +(r.w / (LINE * px)).toFixed(2), c: r.ci, ...(r.full ? { full: true } : {}),
  }));
  const anchors = {};
  for (const [id, y] of Object.entries(L.anchors)) anchors[id] = +(-y / px).toFixed(4);
  const real = (L.real || []).map((r) => ({
    fs: +(r.fs / px).toFixed(4), wt: r.wt, ls: +(r.ls / px).toFixed(4), c: r.ci,
    frags: r.frags.map((f) => ({ t: f.t, x: +(f.x / px).toFixed(4), v: +(-f.y / px).toFixed(4), w: +(f.w / px).toFixed(4), h: +(f.h / px).toFixed(4), ...(f.href ? { href: f.href } : {}) })),
  }));
  return {
    format: 'sine-page', version: 5,
    note: 'lines > words > letters. A letter is one closed curve: s = [frequency, amplitude, phase] terms, x = sum a*cos(2*pi*f*t+p), y = sum a*sin(2*pi*f*t+p), t in 0..1; g = ranges of t that are not drawn. Units are ems of the body text (px pixels), y up, 0 = top of the page. Words carry c (colour number in palette), w (line weight), h (link), u (underline rows). rules are horizontal lines. anchors say where #links scroll to. real is text that stays real text.',
    px, vw: L.vw, fitW: Math.round(contentW + 48), height: L.height, bg: L.bg, accent: L.accent, palette: L.palette, anchors, rules,
    bounds: [0, -L.height / px, L.vw / px, 0],
    lines: [words],
    ...(real.length ? { real } : {}),
    ...((L.slots || []).length ? { slots: L.slots.map((b) => ({ id: b.id, x: +(b.x / px).toFixed(4), v: +(-b.y / px).toFixed(4), w: +(b.w / px).toFixed(4), h: +(b.h / px).toFixed(4) })) } : {}),
    ...((L.sr || []).length ? { sr: L.sr } : {}),
  };
}
