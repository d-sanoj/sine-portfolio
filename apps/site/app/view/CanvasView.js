// Drawing the page on the canvas. Knows how the page sits on the screen; knows nothing
// about time or events (the controllers say when to draw and what is hovered).
import { shape, clamp, ease } from '/core/animate/morph.js';
import { Sine } from '/core/index.js';
import { PAD, MAX_EM, LINE, FORM_TIME, MIN_LINE_PX, LOADER_INK, LINE_SEED, LINK_YELLOW } from '../config.js';

// A line (an underline, a rule) forms from a small circle that swells and stretches out into the line.
// Its terms are the centre and two equal waves going opposite ways (see lineLetter).
const lineShape = (st, p) => {
  if (p >= 1) { if (!st.still) st.still = Sine.trace(st.terms, st.M); return { xy: st.still, hide: 1 }; }
  const a = st.terms[1][1], e = ease(clamp(p));
  const s = Math.min(1, LINE_SEED / a) + (1 - Math.min(1, LINE_SEED / a)) * e; // the circle swells to the line's size ...
  const [dc, w1, w2] = st.terms;
  const xy = Sine.trace([dc, [w1[0], w1[1] * s, w1[2]], [w2[0], w2[1] * s * e, w2[2]]], st.M); // ... as it flattens into it
  return { xy, hide: 1 };
};
const shapeOf = (st, p) => (st.line ? lineShape(st, p) : shape(st, p));

// a colour part of the way (k, 0..1) from one #rrggbb colour to another
const rgbOf = (x) => (Array.isArray(x) ? x : [0, 1, 2].map((i) => parseInt(x.slice(1 + 2 * i, 3 + 2 * i), 16))); // '#rrggbb' or [r, g, b]
const blend = (a, b, k) => {
  const A = rgbOf(a), B = rgbOf(b);
  const c = (i) => Math.round(A[i] + (B[i] - A[i]) * k);
  return `rgb(${c(0)},${c(1)},${c(2)})`;
};

export class CanvasView {
  constructor(canvas, model, options = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.model = model;
    this.hover = -1; // number of the word under the pointer, or -1
    this.line = options.color || '#e8f1f8';
    this.accent = (model.exact && model.accent) || options.accent || '#ffd9c2';
    this.ruleLetters = [];
    this.geo = { em: 1, ox: 0, oy: 0 }; // pixels per em, and where the page's (0, 0) is
    this.width = 0;
    this.height = 0;
    // the page colour comes from the plain page, so the two look the same
    if (model.exact && model.background) document.documentElement.style.background = document.body.style.background = model.background;
  }

  // where the page sits on screen
  geometry() {
    const { model, width: w } = this;
    if (model.exact) {
      // like the plain page: its pixel size, centred; only a screen narrower than the page shrinks it
      const contentW = model.page.fitW || model.page.vw;
      const scale = Math.min(1, w / contentW);
      return { em: model.page.px * scale, ox: (w - model.page.vw * scale) / 2, oy: 0, height: model.page.height * scale };
    }
    const [x0, v0, x1, v1] = model.bounds;
    const em = Math.min((w - 2 * w * PAD) / (x1 - x0), MAX_EM);
    const height = em * (v1 - v0) + 2 * w * PAD;
    return { em, ox: (w - em * (x1 - x0)) / 2 - x0 * em, oy: 0, height, flowed: true };
  }

  // Fit to the screen: sizes the canvas, places the page, remakes the width-dependent lines.
  resize() {
    const { canvas, g, model } = this;
    const dpr = window.devicePixelRatio || 1;
    let geo;
    for (let pass = 0; pass < 2; pass++) { // twice: a scrollbar appearing changes the width
      this.width = canvas.clientWidth;
      geo = this.geometry();
      this.height = Math.max(window.innerHeight, geo.height);
      canvas.style.height = this.height + 'px';
    }
    if (geo.flowed) {
      const [, v0, , v1] = model.bounds;
      geo.oy = (this.height - geo.em * (v1 - v0)) / 2 + v1 * geo.em;
    }
    this.geo = geo;
    // lines that run the width of the screen depend on the width
    this.ruleLetters = model.ruleLetters({ left: -geo.ox / geo.em, right: (this.width - geo.ox) / geo.em });
    canvas.width = Math.round(this.width * dpr);
    canvas.height = Math.round(this.height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const st of model.letters) st.still = null;
  }

  // client (screen) coordinates -> page ems
  toPage(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left - this.geo.ox) / this.geo.em, v: (this.geo.oy - (clientY - r.top)) / this.geo.em };
  }

  colorOf(st) {
    if (st.underline) return LINK_YELLOW; // hyperlinks are underlined in yellow
    const { model } = this;
    return model.exact && model.palette ? model.palette[st.ci] || this.line : this.line;
  }

  // the colour and thickness a letter is drawn with
  ink(st, hot, minPx = this.model.exact ? MIN_LINE_PX.exact : MIN_LINE_PX.flowed) {
    const { g, model } = this;
    const { em } = this.geo;
    g.strokeStyle = hot || (!model.exact && st.link) ? this.accent : this.colorOf(st);
    g.lineWidth = Math.max(minPx, em * (hot && !model.exact ? 0.05 : LINE)) * st.lw;
  }

  // draw a letter's points (page ems), the stretches where the pen only travels faint
  strokeRuns(st, xy, hide, alpha, dx = 0, dv = 0) {
    const { g } = this;
    const { em, ox, oy } = this.geo;
    for (const run of st.runs) {
      if (run.hidden && hide >= 1) continue;
      g.globalAlpha = alpha * (run.hidden ? 0.3 * (1 - hide) : 1);
      g.setLineDash(run.hidden ? [em * 0.03, em * 0.06] : []);
      g.beginPath();
      for (let j = run.a; j <= run.b; j++) {
        const px = ox + (xy[2 * j] + dx) * em, py = oy - (xy[2 * j + 1] + dv) * em;
        j === run.a ? g.moveTo(px, py) : g.lineTo(px, py);
      }
      g.stroke();
    }
  }

  // The letters arriving: the loader's circle has popped into beads that fly to their places.
  //   circles: [{ st, c: [x, v, r], w, a, k }]  the circle (page ems), its line weight (1 = normal), its
  //            opacity, and how far it is from the loader's colour (k = 0) to its letter's own (k = 1).
  //            `st` lends it a line pattern and a colour.
  //   formed:  [{ st, p }]  letters whose bead has landed; p (0..1) is how far they have formed
  // Lines (underlines, rules) are circles and formed letters too.
  renderGather({ circles, formed }) {
    const { g, width: w, height: h } = this;
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const { st, p } of formed) this.drawLetter(st, Math.min(1, p));
    for (const { st, c: [x, v, r], w: weight, a, k = 1, solid = 0, from = LOADER_INK } of circles) {
      // the same circle the morph starts from: the position wave plus the strongest wave
      const t1 = st.terms[1];
      const xy = Sine.trace([[0, Math.hypot(x, v), Math.atan2(v, x)], [t1[0], r, t1[2]]], st.M);
      this.ink(st, false);
      if (k < 1) g.strokeStyle = blend(from, this.colorOf(st), k); // from the loader's colour to the letter's own
      if (solid > 0) { // a solid coloured circle of the loader, opening into the letter's ring
        const { em, ox, oy } = this.geo;
        g.globalAlpha = solid * a;
        g.fillStyle = blend(from, this.colorOf(st), k);
        g.beginPath();
        g.arc(ox + x * em, oy - v * em, r * em, 0, Math.PI * 2);
        g.fill();
      }
      g.lineWidth *= weight;
      this.strokeRuns(st, xy, 0, a);
    }
    g.setLineDash([]);
    g.globalAlpha = 1;
  }

  // While scrolling: the letters that are on screen (`st.vis`), each forming from its circle from the moment
  // it came into view (`st.enter`, in ms), flying in from `st.shift`. Returns true while any is still moving.
  renderScroll(letters, now, formTime) {
    const { g, width: w, height: h } = this;
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    let moving = false;
    for (const st of letters) {
      if (!st.vis) continue;
      const p = (now - st.enter) / formTime;
      if (p < 1) moving = true;
      if (p <= 0) continue;
      const q = Math.min(1, p), left = q >= 1 ? 0 : 1 - (1 - Math.pow(1 - q, 3));
      this.drawLetter(st, q, st.word >= 0 && st.word === this.hover, st.shift[0] * left, st.shift[1] * left);
    }
    g.setLineDash([]);
    g.globalAlpha = 1;
    return moving;
  }

  // one letter at progress p (0 = its circle, 1 = the letter), shifted by (dx, dv) page ems
  drawLetter(st, p, hot = false, dx = 0, dv = 0) {
    this.ink(st, hot);
    const { xy, hide } = shapeOf(st, p);
    this.strokeRuns(st, xy, hide, clamp(p / 0.05), dx, dv);
  }

  // time is in seconds since the animation started; Infinity draws the finished page.
  render(time) {
    const { g, model, width: w, height: h } = this;
    const { em, ox, oy } = this.geo;
    const exact = model.exact;
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // while the letters are forming, only the ones on screen are drawn; afterwards, all of them
    const forming = time < model.end;
    const top = window.scrollY - 40, bottom = window.scrollY + window.innerHeight + 40;
    const minPx = exact ? MIN_LINE_PX.exact : MIN_LINE_PX.flowed;
    for (const st of model.letters.concat(this.ruleLetters)) {
      const p = (time - st.start) / FORM_TIME;
      if (p <= 0) continue;
      if (forming) {
        const sy = oy - st.cy * em, reach = st.rmax * em;
        if (sy + reach < top || sy - reach > bottom) continue;
      }
      const hot = st.word >= 0 && st.word === this.hover; // lines and anything without a word are never "hovered"
      this.ink(st, hot, minPx);
      const { xy, hide } = shapeOf(st, Math.min(1, p));
      this.strokeRuns(st, xy, hide, clamp(p / 0.05));
    }
    g.setLineDash([]);
    g.globalAlpha = 1;
  }
}
