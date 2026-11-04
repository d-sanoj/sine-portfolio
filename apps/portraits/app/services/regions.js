// The colour inside a portrait, as sine waves too: the photo is split into areas of one colour (skin,
// shirt, hair ...), and each area's edge is a closed curve fitted with sine waves, to be filled with that
// colour under the white lines. An area with holes (a face with eyes and a mouth) is one fill with
// several closed curves, filled with the even-odd rule.
import { Sine } from '/core/index.js';
import { thickPart, grow } from './morphology.js';
import { contours } from './contours.js';

export const REGIONS = {
  colors: 9, // how many colours the photo is reduced to
  thickInk: 7, // dark marks at least this wide (px) are fills themselves (hair, beard); thinner ones are lines
  minArea: 60, // areas smaller than this (px) are merged into their neighbour
  whiteMax: 9000, // an enclosed white area bigger than this (a speech bubble) is left empty
  whiteEdge: 20, // an enclosed white area that touches the background at more than this many pixels is left empty (see-through glass)
  white: [244, 242, 236], // enclosed white (teeth, the whites of the eyes)
  step: 4, // every how-manyth pixel is used to find the colours
  shadeBins: 16, // along an area's long axis its colour is measured in this many places ...
  shadeWaves: 3, // ... and fitted with this many sine waves per channel
  edge: 3, // pixels next to the white background are blended with it: they take the colour of the fill further in
};

const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// k colours from a list of [r, g, b] (farthest-point start, then a few rounds of k-means)
function palette(samples, k, rounds = 10) {
  const centres = [samples[0].slice()];
  const dmin = new Float64Array(samples.length).fill(Infinity);
  while (centres.length < k) {
    const c = centres[centres.length - 1];
    let best = 0, bd = -1;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i], d = (s[0] - c[0]) ** 2 + (s[1] - c[1]) ** 2 + (s[2] - c[2]) ** 2;
      if (d < dmin[i]) dmin[i] = d;
      if (dmin[i] > bd) { bd = dmin[i]; best = i; }
    }
    centres.push(samples[best].slice());
  }
  for (let r = 0; r < rounds; r++) {
    const sum = centres.map(() => [0, 0, 0, 0]);
    for (const s of samples) {
      const j = nearest(centres, s[0], s[1], s[2]);
      sum[j][0] += s[0]; sum[j][1] += s[1]; sum[j][2] += s[2]; sum[j][3]++;
    }
    sum.forEach((a, j) => { if (a[3]) centres[j] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
  }
  return centres;
}

function nearest(centres, r, g, b) {
  let best = 0, bd = Infinity;
  for (let j = 0; j < centres.length; j++) {
    const c = centres[j], d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
    if (d < bd) { bd = d; best = j; }
  }
  return best;
}

// Solve the small linear system A x = b (Gaussian elimination, A is n x n)
function solve(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]]; [b[i], b[piv]] = [b[piv], b[i]];
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / (A[i][i] || 1e-12);
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let c = i + 1; c < n; c++) sum -= A[i][c] * x[c];
    x[i] = sum / (A[i][i] || 1e-12);
  }
  return x;
}

// An area's colour as sine waves: along the area's long axis (u from 0 at one end to 1 at the other),
//   channel(u) = a0 + a1 cos(pi u + p1) + a2 cos(2 pi u + p2) + a3 cos(3 pi u + p3).
// Fitted to what the photo really has there (its shading), by least squares. Returns
// { a: [x0, v0, x1, v1] (the axis, in the frame's units), w: [[a0, a1, p1, a2, p2, a3, p3] for red, green, blue] }.
function shadeSeries(pix, W, usable, px, frame, O) {
  let mx = 0, my = 0;
  for (const i of pix) { mx += i % W; my += (i / W) | 0; }
  mx /= pix.length; my /= pix.length;
  let cxx = 0, cyy = 0, cxy = 0;
  for (const i of pix) { const x = (i % W) - mx, y = ((i / W) | 0) - my; cxx += x * x; cyy += y * y; cxy += x * y; }
  const ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy), ux = Math.cos(ang), uy = Math.sin(ang);
  let lo = Infinity, hi = -Infinity;
  for (const i of pix) { const u = ((i % W) - mx) * ux + (((i / W) | 0) - my) * uy; lo = Math.min(lo, u); hi = Math.max(hi, u); }
  if (!(hi - lo > 6)) return null;
  const B = O.shadeBins, sum = Array.from({ length: B }, () => [0, 0, 0, 0]);
  for (const i of pix) {
    if (!usable(i)) continue;
    const u = (((i % W) - mx) * ux + (((i / W) | 0) - my) * uy - lo) / (hi - lo);
    const b = Math.min(B - 1, Math.max(0, Math.floor(u * B))), c = px(i);
    sum[b][0] += c[0]; sum[b][1] += c[1]; sum[b][2] += c[2]; sum[b][3]++;
  }
  const bins = sum.map((a, b) => (a[3] >= 6 ? { u: (b + 0.5) / B, c: [a[0] / a[3], a[1] / a[3], a[2] / a[3]] } : null)).filter(Boolean);
  if (bins.length < 4) return null;
  const Kw = O.shadeWaves, n = 1 + 2 * Kw;
  const basis = (u) => { const r = [1]; for (let k = 1; k <= Kw; k++) r.push(Math.cos(Math.PI * k * u), Math.sin(Math.PI * k * u)); return r; };
  const w = [0, 1, 2].map((ch) => {
    const A = Array.from({ length: n }, () => new Array(n).fill(0)), b = new Array(n).fill(0);
    for (const bin of bins) { const f = basis(bin.u); for (let r = 0; r < n; r++) { b[r] += f[r] * bin.c[ch]; for (let c = 0; c < n; c++) A[r][c] += f[r] * f[c]; } }
    for (let r = 1; r < n; r++) A[r][r] += 0.02; // a gentle pull toward the mean, so the waves stay small where the data is thin
    const x = solve(A, b), out = [+x[0].toFixed(2)];
    for (let k = 1; k <= Kw; k++) { const c = x[2 * k - 1], sn = x[2 * k]; out.push(+Math.hypot(c, sn).toFixed(2), +(-Math.atan2(sn, c)).toFixed(3)); }
    return out;
  });
  const d = frame.y1 - frame.y0, cx = (frame.x0 + frame.x1) / 2, cy = (frame.y0 + frame.y1) / 2;
  const at = (u) => { const x = mx + ux * u, y = my + uy * u; return [(x - cx) / d, (cy - y) / d]; };
  const [x0, v0] = at(lo), [x1, v1] = at(hi);
  return { a: [x0, v0, x1, v1].map((q) => +q.toFixed(4)), w };
}

// rgb: RGBA photo data; ink: mask of dark marks (see lineArt); frame: the drawing's frame in pixels (see fitPortrait)
// Returns [{ c: [r, g, b], s: [terms, terms, ...] }], terms being [frequency, amplitude, phase] in the frame's units.
export function colorRegions(rgb, W, H, ink, frame, opts = {}) {
  const O = { ...REGIONS, ...opts };
  const N = W * H;
  const px = (i) => [rgb[4 * i], rgb[4 * i + 1], rgb[4 * i + 2]];

  // dark masses (hair, beard) are fills; the rest of the ink is lines, which take the colour beside them
  const mass = grow(thickPart(ink, W, H, O.thickInk), W, H, 1);
  const THIN = -2, BG = -1, WHITE = O.colors;
  const label = new Int16Array(N);
  const nearWhite = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const [r, g, b] = px(i);
    nearWhite[i] = luma(r, g, b) > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 35 ? 1 : 0;
  }
  // the white that reaches the edge of the picture is the background
  const bg = new Uint8Array(N);
  const stack = [];
  const push = (i) => { if (nearWhite[i] && !bg[i]) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i / W) | 0;
    if (x > 0) push(i - 1);
    if (x < W - 1) push(i + 1);
    if (y > 0) push(i - W);
    if (y < H - 1) push(i + W);
  }
  // pixels along the edge of the background are part white: they are re-coloured from further in, like the lines
  const rim = grow(bg, W, H, O.edge);
  const isRim = (i) => rim[i] && !bg[i] && !mass[i];
  // the colours of what is left
  const samples = [];
  for (let i = 0; i < N; i += O.step) if (!bg[i] && !nearWhite[i] && !isRim(i) && (!ink[i] || mass[i])) samples.push(px(i));
  const centres = palette(samples, O.colors);
  for (let i = 0; i < N; i++) {
    if (bg[i]) label[i] = BG;
    else if (nearWhite[i]) label[i] = WHITE;
    else if ((ink[i] && !mass[i]) || isRim(i)) label[i] = THIN;
    else { const [r, g, b] = px(i); label[i] = nearest(centres, r, g, b); }
  }
  // lines take the label of the fill beside them (spread outward from the filled pixels)
  const queue = [];
  const around = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1];
  for (let i = 0; i < N; i++) {
    if (label[i] < 0) continue;
    for (const d of around) { const n = i + d; if (n >= 0 && n < N && label[n] === THIN) { queue.push(i); break; } }
  }
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h], x = i % W;
    for (const d of around) {
      const n = i + d, nx = n % W;
      if (n < 0 || n >= N || Math.abs(nx - x) > 1 || label[n] !== THIN) continue;
      label[n] = label[i];
      queue.push(n);
    }
  }
  for (let i = 0; i < N; i++) if (label[i] === THIN) label[i] = BG;

  // areas: connected pieces of one label; tiny ones are absorbed by what surrounds them
  const comps = (minKeep) => {
    const seen = new Uint8Array(N), out = [];
    const st = [];
    for (let s = 0; s < N; s++) {
      if (seen[s] || label[s] === BG) continue;
      const l = label[s], pix = [];
      seen[s] = 1; st.push(s);
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      const touch = new Map();
      while (st.length) {
        const i = st.pop(), x = i % W, y = (i / W) | 0;
        pix.push(i);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const [n, ok] of [[i - 1, x > 0], [i + 1, x < W - 1], [i - W, y > 0], [i + W, y < H - 1]]) {
          if (!ok) continue;
          if (label[n] === l) { if (!seen[n]) { seen[n] = 1; st.push(n); } } else touch.set(label[n], (touch.get(label[n]) || 0) + 1);
        }
      }
      if (pix.length < minKeep) {
        let best = BG, bc = -1;
        for (const [k, c] of touch) if (c > bc) { bc = c; best = k; }
        for (const i of pix) label[i] = best;
      } else out.push({ l, pix, box: [x0, y0, x1, y1], bgTouch: touch.get(BG) || 0 });
    }
    return out;
  };
  comps(O.minArea); // absorb the tiny ones
  const areas = comps(O.minArea);

  // each area's edges as closed sine curves
  const d = frame.y1 - frame.y0, cx = (frame.x0 + frame.x1) / 2, cy = (frame.y0 + frame.y1) / 2;
  const regions = [];
  for (const { l, pix, box: [x0, y0, x1, y1], bgTouch } of areas) {
    if (l === WHITE && pix.length > O.whiteMax) continue;
    // white that borders the background is a see-through part (the lens of the glasses over the page): left empty
    if (l === WHITE && bgTouch > O.whiteEdge) continue;
    const w = x1 - x0 + 3, h = y1 - y0 + 3;
    const m = new Uint8Array(w * h);
    for (const i of pix) m[((((i / W) | 0) - y0 + 1) * w) + (i % W) - x0 + 1] = 1;
    const curves = [];
    for (const loop of contours(m, w, h)) {
      let len = 0;
      for (let k = 1; k < loop.length; k++) len += Math.hypot(loop[k][0] - loop[k - 1][0], loop[k][1] - loop[k - 1][1]);
      if (len < 14) continue;
      const pts = loop.map(([x, y]) => [(x + x0 - 1 - cx) / d, (cy - (y + y0 - 1)) / d]);
      const K = Math.max(10, Math.min(150, Math.round(len / 9)));
      const spec = Sine.fit(pts, true, 1024, Math.max(40, Math.min(160, K + 20)));
      if (spec) curves.push(Sine.select(spec, K, 0, true));
    }
    if (!curves.length) continue;
    const c = l === WHITE ? O.white : centres[l].map(Math.round);
    const shade = l === WHITE || pix.length < 120 ? null : shadeSeries(pix, W, (i) => !isRim(i) && (!ink[i] || mass[i]), px, frame, O);
    const region = shade ? { c, s: curves, g: shade } : { c, s: curves };
    if (O.debug) region.debug = { box: [x0, y0, x1, y1], area: pix.length, bgTouch, white: l === WHITE };
    regions.push(region);
  }
  return regions;
}
