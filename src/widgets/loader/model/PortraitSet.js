// The portraits the loader can show, and which one comes next.
import { Morph } from '/core/index.js';
import { Sine } from '/core/index.js';
import { PORTRAITS_URL, CURVE_POINTS, CURVE_LEVELS, FILL } from '../config.js';

// a steady pseudo-random number in 0..1 for a given integer
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// The colour inside a portrait: areas, each a colour and some closed sine curves (see apps/portraits/app/services/regions.js).
// Every curve forms from a small circle exactly as the outline does (see startCircle in the morph). The circles
// start scattered inside the portrait's big circle, loosely where they belong, each setting off at its own moment,
// and settle into their places as they take their shape. Big areas are listed first, so small ones are drawn on top.
// An area's colour is sine waves too: its mean colour plus a few waves along its long axis (its shading).
function fillAreas(areas) {
  const size = (a) => a.s.reduce((m, t) => Math.max(m, t[1] ? t[1][1] : 0), 0);
  let seed = 0;
  return areas.slice().sort((a, b) => size(b) - size(a)).map((a) => ({
    css: `rgb(${a.c[0]},${a.c[1]},${a.c[2]})`,
    mean: a.c,
    shade: a.g ? shadeStops(a.g) : null,
    curves: a.s.map((terms, li) => {
      seed++;
      const k = terms.reduce((m, t) => Math.max(m, Math.abs(t[0])), 1);
      const r = Math.min(FILL.maxDot, Math.max(FILL.minDot, FILL.dot * (terms[1] ? terms[1][1] : 0))) * (0.7 + 0.8 * rnd(seed + 1));
      // where it starts: partway toward its place, then thrown off to a random side, but kept inside the big circle
      const dc = [(terms[0][1] || 0) * Math.cos(terms[0][2] || 0), (terms[0][1] || 0) * Math.sin(terms[0][2] || 0)];
      const far = Math.hypot(dc[0], dc[1]) || 1e-6;
      const home = Math.max(0, Math.min(FILL.home, (FILL.inside - r) / far));
      const ang = rnd(seed + 2) * 2 * Math.PI, dist = FILL.scatter * (0.25 + 0.75 * rnd(seed + 3));
      let start = [dc[0] * home + Math.cos(ang) * dist, dc[1] * home + Math.sin(ang) * dist];
      const lim = FILL.inside - r, len = Math.hypot(start[0], start[1]);
      if (len > lim) start = [(start[0] * lim) / len, (start[1] * lim) / len];
      const off = [start[0] - dc[0] * home, start[1] - dc[1] * home];
      const curve = Morph.buildCurve(terms, [], Math.max(96, 5 * k), r, { home, off, ramp: a.n ? a.n[li] : 0 }); // a.n: waves before trimming (see scripts/lib/trim.js)
      curve.delay = FILL.delay * rnd(seed + 4); // each circle sets off at its own moment
      return curve;
    }),
  }));
}

// An area's shading as colours along its axis: the series evaluated at a few places.
// g = { a: [x0, v0, x1, v1], w: [[a0, a1, p1, a2, p2, a3, p3] for red, green, blue] }
function shadeStops(g) {
  const at = (ch, u) => {
    const w = g.w[ch];
    let v = w[0];
    for (let k = 1; 2 * k < w.length; k++) v += w[2 * k - 1] * Math.cos(Math.PI * k * u + w[2 * k]);
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  const stops = [];
  for (let i = 0; i <= FILL.stops; i++) { const u = i / FILL.stops; stops.push([at(0, u), at(1, u), at(2, u)]); }
  return { axis: g.a, stops };
}

export class PortraitSet {
  // items: [{ curve, box, fills }]
  constructor(items) {
    this.items = items;
    this.last = -1;
  }

  // null when the file is missing or empty (the loader then simply does not show)
  static async load(url = PORTRAITS_URL) {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const file = await r.json();
      const items = (file.portraits || []).map((p) => {
        const curve = Morph.buildCurve(p.s, p.g, CURVE_POINTS, p.circle || 0, { levels: CURVE_LEVELS, ramp: p.n || 0 });
        curve.still = Sine.trace(curve.terms, curve.M); // the finished portrait, drawn from now on without recomputing
        return { curve, box: p.box, fills: p.f ? fillAreas(p.f) : null };
      });
      return items.length ? new PortraitSet(items) : null;
    } catch (e) {
      return null;
    }
  }

  // a random portrait, never the same one twice in a row
  next() {
    let i = Math.floor(Math.random() * this.items.length);
    if (this.items.length > 1 && i === this.last) i = (i + 1 + Math.floor(Math.random() * (this.items.length - 1))) % this.items.length;
    this.last = i;
    return this.items[i];
  }
}
