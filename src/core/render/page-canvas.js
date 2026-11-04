// Drawing a finished (static) page onto a 2D canvas context.
// Used by the designer's text preview; the site's animated drawing lives in apps/site.
import { Sine } from '../sine/index.js';

// Draw one letter's curve, skipping the stretches listed in its gaps.
function drawLetter(g, letter, ox, oy, em) {
  const M = Math.min(400, 60 + letter.s.length * 4);
  const xy = Sine.trace(letter.s, M);
  for (const run of Sine.runs(M, letter.g || [])) {
    if (run.hidden) continue;
    g.beginPath();
    for (let j = run.a; j <= run.b; j++) {
      const px = ox + xy[2 * j] * em, py = oy - xy[2 * j + 1] * em;
      j === run.a ? g.moveTo(px, py) : g.lineTo(px, py);
    }
    g.stroke();
  }
}

// (ox, oy) is where page coordinates (0, 0) land, em is pixels per em.
function draw(g, page, ox, oy, em) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const line of page.lines) for (const word of line) {
    g.strokeStyle = word.h ? '#ffd9c2' : '#e8f1f8';
    g.lineWidth = Math.max(1.5, em * 0.035) * (word.w || 1);
    for (const letter of word.l) drawLetter(g, letter, ox, oy, em);
  }
}

export const PageCanvas = { draw, drawLetter };
