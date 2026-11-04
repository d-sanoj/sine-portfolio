// The designed glyphs as sine data: what is saved for the build and the site.
import { Sine } from '/core/index.js';
import { fitOf, kOf } from './glyphFit.js';
import { anchorsOf } from './anchors.js';

const r4 = (n) => +n.toFixed(4);

// one glyph: { adv, in, out, s: terms, g?: gaps }, or null if it has nothing to draw
export function encodeGlyph(gl) {
  const fit = fitOf(gl);
  if (!fit) return null;
  const a = anchorsOf(gl);
  const out = { adv: r4(a.adv), in: a.in.map(r4), out: a.out.map(r4), s: Sine.select(fit, kOf(gl)) };
  if (fit.gaps.length) out.g = fit.gaps;
  return out;
}

// every designed glyph, by character
export function buildData(glyphs) {
  const out = {};
  for (const [ch, gl] of Object.entries(glyphs)) {
    const e = encodeGlyph(gl);
    if (e) out[ch] = e;
  }
  return out;
}

// the file the build reads
export const glyphFile = (data) => ({
  format: 'sine-glyphs', version: 2,
  note: 'Each stroke is a list of [frequency, amplitude, phase]. x = sum a*cos(2*pi*f*t+p), y = sum a*sin(2*pi*f*t+p), t in 0..1. Units are ems, y up, baseline 0, pen origin x = 0. adv = where the next letter starts; in / out = where a join enters and leaves.',
  glyphs: data,
});
