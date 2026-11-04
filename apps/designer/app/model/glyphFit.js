// A glyph is one sine curve however many pieces it was drawn with. The fit is cached
// per glyph and redone only when its points change.
import { Sine } from '/core/index.js';
import { DEFAULT_K, TOL, K_STEPS } from '../config.js';

const fits = new WeakMap();

export function fitOf(gl) {
  if (!gl) return null;
  const key = JSON.stringify(gl.strokes.map((st) => [st.closed, st.pts]));
  const c = fits.get(gl);
  if (c && c.key === key) return c.fit;
  const route = Sine.routeGlyph(gl.strokes);
  const fit = route ? Sine.fitRoute(route) : null;
  fits.set(gl, { key, fit });
  return fit;
}

// how many sine terms the glyph keeps
export const kOf = (gl) => (gl && gl.K) || DEFAULT_K;

// The fewest sine terms that keep the curve within TOL ems of the path it was
// fitted to, so straight edges and corners come out clean without wasted waves.
export function autoK(gl) {
  const fit = fitOf(gl);
  const route = Sine.routeGlyph(gl.strokes);
  if (!fit || !route) return DEFAULT_K;
  const { path, vis } = route;
  const segs = [];
  const dense = [];
  path.forEach((a, i) => {
    if (!vis[i]) return;
    const b = path[(i + 1) % path.length];
    segs.push([a, b]);
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.005));
    for (let k = 0; k <= n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  });
  const toSeg = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]);
  };
  const worst = (K) => {
    const M = 1000;
    const xy = Sine.trace(Sine.select(fit, K), M);
    const seen = [];
    for (const run of Sine.runs(M, fit.gaps)) {
      if (run.hidden) continue;
      for (let j = run.a; j <= run.b; j++) seen.push([xy[2 * j], xy[2 * j + 1]]);
    }
    let w = 0;
    for (const p of seen) { // drawn curve must stay on the path
      let d = Infinity;
      for (const [a, b] of segs) d = Math.min(d, toSeg(p, a, b));
      w = Math.max(w, d);
    }
    for (const p of dense) { // and the path must be reached
      let d = Infinity;
      for (const q of seen) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1]));
      w = Math.max(w, d);
    }
    return w;
  };
  let lo = 0, hi = K_STEPS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (worst(K_STEPS[mid]) <= TOL) hi = mid; else lo = mid + 1;
  }
  return K_STEPS[lo];
}
