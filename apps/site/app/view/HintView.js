// The word "click" shown below a hovered link. It is drawn on a small canvas of its own that sits in the page (it scrolls with
// it) just below the link's underline, toward the link's right end. It forms the way the page's letters do (the same morph):
// five circles, one for each letter, start stacked as one small circle on the underline, travel down below it, move apart and take the
// shape of their letters.
import { shape } from '/core/animate/morph.js';

export const W = 240, H = 70; // the canvas, in CSS pixels; the word's final centre is at (W / 2, FINAL_Y)
export const FINAL_Y = 48;

export class HintView {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'sine-hint';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;z-index:4;display:none;`;
    document.body.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.dpr = 0;
    this.key = '';
    this.fit();
  }

  fit() {
    const dpr = window.devicePixelRatio || 1;
    if (dpr === this.dpr) return;
    this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.key = '';
  }

  // put the final centre of the word at (x, y) in the page, or hide the canvas (x = null)
  place(x, y) {
    const s = this.canvas.style;
    if (x === null) { s.display = 'none'; return; }
    s.display = 'block';
    s.left = (x - W / 2).toFixed(1) + 'px';
    s.top = (y - FINAL_Y).toFixed(1) + 'px';
  }

  // p: 0 = the small circle, 1 = the finished word; (startX, startY): where the circle starts, in the canvas (on the underline)
  draw(p, curves, { em, lineWidth, color, startX, startY }) {
    if (!curves.length) return;
    const q = Math.max(0.0001, Math.min(1, p));
    const key = q.toFixed(4) + color + startX.toFixed(1) + startY.toFixed(1) + this.dpr;
    if (key === this.key) return;
    this.key = key;
    const { g } = this;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = color;
    g.lineWidth = lineWidth;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // the circle travels down from the underline to under the link while the letters form
    const t = Math.min(1, q / 0.55), move = t * t * (3 - 2 * t);
    const cx = startX + (W / 2 - startX) * move, cy = startY + (FINAL_Y - startY) * move;
    const list = p < 0.004 ? [curves[0]] : curves; // at rest the five letters are one circle
    for (const curve of list) {
      const { xy, hide } = shape(curve, q);
      for (const run of curve.runs) {
        if (run.hidden && hide >= 1) continue;
        g.globalAlpha = run.hidden ? 0.3 * (1 - hide) : 1;
        g.setLineDash(run.hidden ? [em * 0.03, em * 0.06] : []);
        g.beginPath();
        for (let j = run.a; j <= run.b; j++) {
          const x = cx + xy[2 * j] * em, y = cy - xy[2 * j + 1] * em;
          j === run.a ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    g.setLineDash([]);
    g.globalAlpha = 1;
  }
}
