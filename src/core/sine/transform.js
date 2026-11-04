// Moving, scaling and roughening a stored sine series without redrawing it.

import { cmul, toMap, fromMap } from './series.js';

// Any scale / rotate / slant / move, applied to the terms:
//   z' = al * z + be * conj(z) + tau        (al, be, tau are [re, im])
// Conjugating z swaps frequency k with -k, so pairs of terms mix.
export function affineTerms(terms, al, be, tau) {
  const m = toMap(terms);
  const keys = new Set();
  for (const k of m.keys()) { keys.add(k); keys.add(-k); }
  const out = new Map();
  for (const k of keys) {
    const c = m.get(k) || [0, 0];
    const d = m.get(-k) || [0, 0];
    let re = al[0] * c[0] - al[1] * c[1] + be[0] * d[0] + be[1] * d[1];
    let im = al[0] * c[1] + al[1] * c[0] - be[0] * d[1] + be[1] * d[0];
    if (k === 0) { re += tau[0]; im += tau[1]; }
    out.set(k, [re, im]);
  }
  return fromMap(out);
}

export function affinePoint(p, al, be, tau) {
  const a = cmul(al, p);
  const b = cmul(be, [p[0], -p[1]]);
  return [a[0] + b[0] + tau[0], a[1] + b[1] + tau[1]];
}

// Small random wobble on every wave except position. amt 0..1.
export function jitter(terms, rnd, amt) {
  return terms.map(([k, a, p]) => (k === 0 ? [k, a, p]
    : [k, +(a * (1 + rnd() * 0.08 * amt)).toFixed(4), +(p + rnd() * 0.1 * amt).toFixed(3)]));
}
