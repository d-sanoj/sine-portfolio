// One drawn letter (or line) as the site keeps it while animating.
import { Sine } from '/core/index.js';

// A straight line from x = a to x = b at height v, written as sine waves:
// the centre, plus two equal waves going opposite ways, which trace a line.
export const lineLetter = (a, b, v) => {
  const cx = (a + b) / 2, half = (b - a) / 2;
  return { s: [[0, +Math.hypot(cx, v).toFixed(5), +Math.atan2(v, cx).toFixed(5)], [1, +(half / 2).toFixed(5), 0], [-1, +(half / 2).toFixed(5), 0]] };
};

// letter: { s: terms, g?: gaps } straight from the page file.
export function buildLetter(letter, start) {
  const M = Math.min(320, 40 + letter.s.length * 4);
  const gaps = letter.g || [];
  // where the letter sits and how far it can reach, so letters off screen can be skipped
  const dc = letter.s[0] && letter.s[0][0] === 0 ? letter.s[0] : [0, 0, 0];
  const rmax = letter.s.reduce((s, t) => s + (t[0] === 0 ? 0 : t[1]), 0);
  return {
    start, terms: letter.s, gaps, M, runs: Sine.runs(M, gaps), still: null,
    cy: dc[1] * Math.sin(dc[2]), rmax,
    ci: 0, lw: 1, word: -1, link: false, // colour number, line weight, which word it belongs to
  };
}

// Bounding box of finished letters, in page units, with a little room to click.
export function boxOf(letters) {
  let x0 = Infinity, v0 = Infinity, x1 = -Infinity, v1 = -Infinity;
  for (const st of letters) {
    const xy = Sine.trace(st.terms, 60);
    for (let j = 0; j < xy.length; j += 2) {
      x0 = Math.min(x0, xy[j]); x1 = Math.max(x1, xy[j]);
      v0 = Math.min(v0, xy[j + 1]); v1 = Math.max(v1, xy[j + 1]);
    }
  }
  const pad = 0.12;
  return [x0 - pad, v0 - pad, x1 + pad, v1 + pad];
}
