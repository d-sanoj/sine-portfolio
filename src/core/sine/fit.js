// Turning drawn points into a sine series (the analysis direction).

import { TAU } from './series.js';

export const N = 512; // samples taken around the loop
export const H = 128; // highest frequency analysed (both signs)

const tableCache = new Map();
function tables(n) {
  if (!tableCache.has(n)) {
    const c = new Float64Array(n);
    const s = new Float64Array(n);
    for (let i = 0; i < n; i++) { c[i] = Math.cos((TAU * i) / n); s[i] = Math.sin((TAU * i) / n); }
    tableCache.set(n, { c, s });
  }
  return tableCache.get(n);
}

// Open strokes are walked out and back so they become a closed loop.
export function loopPath(pts, closed) {
  if (pts.length < 2) return null;
  if (!closed && pts.length > 2) return pts.concat(pts.slice(1, -1).reverse());
  return pts;
}

// n points spaced evenly by arc length around the loop.
function resample(path, n) {
  const m = path.length;
  const cum = [0];
  for (let i = 0; i < m; i++) {
    const a = path[i];
    const b = path[(i + 1) % m];
    cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[m];
  if (total < 1e-9) return null;
  const out = new Float64Array(2 * n);
  let seg = 0;
  for (let j = 0; j < n; j++) {
    const s = (total * j) / n;
    while (cum[seg + 1] < s) seg++;
    const a = path[seg];
    const b = path[(seg + 1) % m];
    const len = cum[seg + 1] - cum[seg];
    const u = len > 0 ? (s - cum[seg]) / len : 0;
    out[2 * j] = a[0] + (b[0] - a[0]) * u;
    out[2 * j + 1] = a[1] + (b[1] - a[1]) * u;
  }
  return out;
}

// Spectrum of n evenly spaced samples: re[k+h], im[k+h] for k = -h..h.
function dft(xy, n, h) {
  const { c: COS, s: SIN } = tables(n);
  const re = new Float64Array(2 * h + 1);
  const im = new Float64Array(2 * h + 1);
  for (let k = -h; k <= h; k++) {
    let sr = 0;
    let si = 0;
    for (let j = 0; j < n; j++) {
      const idx = (((k * j) % n) + n) % n;
      const c = COS[idx];
      const s = SIN[idx];
      const x = xy[2 * j];
      const y = xy[2 * j + 1];
      sr += x * c + y * s;
      si += y * c - x * s;
    }
    re[k + h] = sr / n;
    im[k + h] = si / n;
  }
  return { re, im, h };
}

// Spectrum of one stroke (a list of points). Null if unusable.
export function fit(pts, closed, n = N, h = H) {
  const path = loopPath(pts, closed);
  const xy = path && resample(path, n);
  return xy ? dft(xy, n, h) : null;
}

// ---- a whole glyph as ONE closed curve ----
// The pieces a letter is drawn with (stem, bowl, the dot of an i ...) are
// chained into a single loop. Where the pen has to travel between pieces the
// path crosses empty space; those stretches are recorded as gaps (ranges of
// t that are not drawn), so the sine curve itself stays a single loop.
export const BRIDGE = 0.012; // travel shorter than this is left drawn: the pieces touch
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// The pen runs straight on for RUN beyond where a piece ends, and straight in
// before the next one starts, so the sharp turn into the travel stretch happens
// where nothing is drawn. Without it a truncated Fourier series cuts the corner
// and curls the visible end of the stroke.
export const RUN = 0.09;
const unit = (a, b) => { const d = dist(a, b) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };

// bridge and run are in the same units as the points; the defaults suit a glyph (1 em tall).
export function routeGlyph(strokes, { bridge = BRIDGE, run = RUN } = {}) {
  const left = strokes.filter((s) => s.pts.length >= 2)
    .map((s) => ({ pts: s.closed && s.pts.length > 2 ? s.pts.concat([s.pts[0]]) : s.pts, closed: s.closed && s.pts.length > 2 }));
  if (!left.length) return null;
  const path = [];
  const vis = []; // vis[i]: is the segment path[i] -> path[i+1] drawn
  const add = (p, drawn) => { if (path.length) vis.push(drawn); path.push(p); };
  const runOut = () => {
    const n = path.length;
    const d = n > 1 ? unit(path[n - 2], path[n - 1]) : [0, 0];
    return [path[n - 1][0] + d[0] * run, path[n - 1][1] + d[1] * run];
  };
  const runIn = (pts) => {
    const d = unit(pts[0], pts[1]);
    return [pts[0][0] - d[0] * run, pts[0][1] - d[1] * run];
  };
  const first = left.shift();
  first.pts.forEach((p, i) => add(p, i > 0));
  while (left.length) {
    const last = path[path.length - 1];
    let best = null;
    left.forEach((piece, idx) => {
      const cands = [];
      if (piece.closed) {
        const ring = piece.pts.slice(0, -1);
        ring.forEach((p, i) => cands.push([dist(last, p), idx, ring.slice(i).concat(ring.slice(0, i + 1))]));
      } else {
        cands.push([dist(last, piece.pts[0]), idx, piece.pts]);
        cands.push([dist(last, piece.pts[piece.pts.length - 1]), idx, piece.pts.slice().reverse()]);
      }
      for (const c of cands) if (!best || c[0] < best[0]) best = c;
    });
    left.splice(best[1], 1);
    const pts = best[2];
    if (dist(last, pts[0]) > bridge) { // pen travels: leave straight on, arrive straight in
      add(runOut(), false);
      add(runIn(pts), false);
      add(pts[0], false);
      pts.slice(1).forEach((p) => add(p, true));
    } else {
      pts.forEach((p) => add(p, true));
    }
  }
  // closing stretch back to the start
  if (dist(path[path.length - 1], path[0]) > bridge && path.length > 1) {
    const start = unit(path[0], path[1]);
    path.unshift([path[0][0] - start[0] * run, path[0][1] - start[1] * run]);
    vis.unshift(false);
    add(runOut(), false);
    vis.push(false);
  } else {
    vis.push(true);
  }
  return { path, vis };
}

// Ranges [t0, t1] of the loop that are not drawn (t1 may pass 1 when it wraps).
function gapsOf(hid, n) {
  const start = hid.findIndex((h) => !h);
  if (start < 0) return [];
  const out = [];
  let from = -1;
  const r = (v) => +(v / n).toFixed(4);
  for (let k = 0; k < n; k++) {
    const hidden = hid[(start + k) % n];
    if (hidden && from < 0) from = k;
    if (!hidden && from >= 0) { out.push([r(start + from), r(start + k)]); from = -1; }
  }
  if (from >= 0) out.push([r(start + from), r(start + n)]);
  return out;
}

export function fitRoute(route, n = N, h = H) {
  const { path, vis } = route;
  const m = path.length;
  if (m < 2) return null;
  const cum = [0];
  for (let i = 0; i < m; i++) cum.push(cum[i] + dist(path[i], path[(i + 1) % m]));
  const total = cum[m];
  if (total < 1e-9) return null;
  const xy = new Float64Array(2 * n);
  const hid = new Uint8Array(n);
  let seg = 0;
  for (let j = 0; j < n; j++) {
    const s = (total * j) / n;
    while (cum[seg + 1] < s) seg++;
    const a = path[seg];
    const b = path[(seg + 1) % m];
    const len = cum[seg + 1] - cum[seg];
    const u = len > 0 ? (s - cum[seg]) / len : 0;
    xy[2 * j] = a[0] + (b[0] - a[0]) * u;
    xy[2 * j + 1] = a[1] + (b[1] - a[1]) * u;
    hid[j] = vis[seg] ? 0 : 1;
  }
  const spec = dft(xy, n, h);
  spec.gaps = gapsOf(hid, n);
  return spec;
}
