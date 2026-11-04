// Working with a finished sine series: draw it, trim it, pass it through arithmetic.
//
// A stroke is a closed loop z(t) = x(t) + i*y(t), t in [0,1).
// Its complex Fourier series is  z(t) = sum_k c_k * e^(i*2*pi*k*t),
// which is the same as  x(t) = sum a_k cos(2*pi*k*t + p_k),
//                       y(t) = sum a_k sin(2*pi*k*t + p_k)
// with a_k = |c_k| and p_k = arg(c_k). Each term is stored as [k, a, p]:
// frequency, amplitude, phase. Nothing else about the shape is kept.

export const TAU = Math.PI * 2;

// M+1 points along the curve (last equals first so it draws closed).
// Each wave is stepped by a fixed rotation instead of calling cos and sin at
// every point, which is several times faster for letters with many waves.
// weights (optional) scales each wave, so a wave can be faded in.
export function trace(terms, M, weights) {
  const out = new Float64Array(2 * (M + 1));
  for (let q = 0; q < terms.length; q++) {
    const w = weights ? weights[q] : 1;
    if (!w) continue;
    const [k, a, p] = terms[q];
    const amp = a * w;
    const step = (TAU * k) / M;
    const cd = Math.cos(step), sd = Math.sin(step);
    let c = Math.cos(p), s = Math.sin(p);
    for (let j = 0; j <= M; j++) {
      out[2 * j] += amp * c;
      out[2 * j + 1] += amp * s;
      const nc = c * cd - s * sd;
      s = s * cd + c * sd;
      c = nc;
    }
  }
  return out;
}

// Runs of a polyline of M+1 points sampled at t = j/M, split where the
// curve is inside a gap: [{ a, b, hidden }] with point indices a..b.
export function runs(M, gaps) {
  const hiddenAt = (t) => gaps.some(([a, b]) => (t >= a && t < b) || (t + 1 >= a && t + 1 < b));
  const out = [];
  let cur = null;
  for (let j = 0; j < M; j++) {
    const hidden = hiddenAt((j + 0.5) / M);
    if (cur && cur.hidden === hidden) cur.b = j + 1;
    else { cur = { a: j, b: j + 1, hidden }; out.push(cur); }
  }
  return out;
}

// Keep the DC term (position) and the K strongest waves. dx moves the shape left.
// Cutting a series short makes it ripple next to sharp corners (Gibbs ringing).
// The highest waves are damped a little (Lanczos sigma) so lines stay straight;
// the strongest, low waves are left almost untouched.
export function select(spec, K, dx = 0, smooth = true) {
  const h = spec.h;
  const ks = [];
  for (let k = -h; k <= h; k++) if (k !== 0) ks.push(k);
  const mag = (k) => Math.hypot(spec.re[k + h], spec.im[k + h]);
  ks.sort((a, b) => mag(b) - mag(a));
  const keep = [0, ...ks.slice(0, K)];
  const kmax = keep.reduce((m, k) => Math.max(m, Math.abs(k)), 1);
  const sigma = (k) => {
    if (!smooth || k === 0) return 1;
    const x = (Math.PI * Math.abs(k)) / (kmax + 1);
    return Math.sin(x) / x;
  };
  return keep.map((k) => {
    let r = spec.re[k + h];
    const i = spec.im[k + h];
    if (k === 0) r -= dx;
    return [k, +(Math.hypot(r, i) * sigma(k)).toFixed(4), +Math.atan2(i, r).toFixed(3)];
  });
}

export const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];

// [k, a, p] list <-> Map(k -> [re, im])
export function toMap(terms) {
  const m = new Map();
  for (const [k, a, p] of terms) m.set(k, [a * Math.cos(p), a * Math.sin(p)]);
  return m;
}
export function fromMap(m, eps = 1e-4) {
  const out = [];
  for (const [k, [re, im]] of m) {
    const a = Math.hypot(re, im);
    if (k !== 0 && a < eps) continue;
    out.push([k, +a.toFixed(4), +Math.atan2(im, re).toFixed(3)]);
  }
  out.sort((p, q) => (p[0] === 0 ? -1 : q[0] === 0 ? 1 : q[1] - p[1]));
  return out;
}
