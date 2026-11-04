// Drawing the three glyph panels: the point editor, the sine result, and the strength plot.
import { Sine } from '/core/index.js';
import { GUIDES, INK, SPEC_RANGE } from '../config.js';
import { fitOf, kOf } from '../model/glyphFit.js';
import { anchorsOf, bbox } from '../model/anchors.js';

export class EditorView {
  constructor(model, canvases) {
    this.model = model;
    this.c = canvases;
  }

  draw() {
    this.drawEditor();
    this.drawResult();
    this.drawSpectrum();
  }

  // Letter heights of the traced font, so the guide lines match its letters.
  guideList() {
    const m = this.model.state.metrics;
    return m ? [[m.asc, 'ascender'], [m.cap, 'cap'], [m.x, 'x-height'], [0, 'baseline'], [-m.desc, 'descender']] : GUIDES;
  }

  drawGuides(name) {
    const g = this.c.ctx[name];
    g.save();
    g.font = '10px sans-serif';
    for (const [v, label] of this.guideList()) {
      const [, y] = this.c.toScreen(name, 0, v);
      g.strokeStyle = v === 0 ? 'rgba(232,241,248,0.45)' : 'rgba(232,241,248,0.16)';
      g.setLineDash(v === 0 ? [] : [4, 4]);
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, y); g.lineTo(this.c.size[name].w, y); g.stroke();
      g.fillStyle = 'rgba(232,241,248,0.35)';
      g.fillText(label, 6, y - 3);
    }
    g.restore();
  }

  // The join markers and the "next letter" line.
  drawAnchors(g, gl) {
    const a = anchorsOf(gl);
    if (!a) return;
    const { size } = this.c;
    const [ox] = this.c.toScreen('editor', 0, 0);
    g.save();
    g.setLineDash([3, 4]);
    g.strokeStyle = 'rgba(232,241,248,0.25)';
    g.beginPath(); g.moveTo(ox, 0); g.lineTo(ox, size.editor.h); g.stroke();
    const [ax] = this.c.toScreen('editor', a.adv, 0);
    g.strokeStyle = '#d9622b';
    g.beginPath(); g.moveTo(ax, 0); g.lineTo(ax, size.editor.h); g.stroke();
    g.setLineDash([]);
    g.font = '10px sans-serif';
    g.fillStyle = '#d9622b';
    g.fillText('next letter starts here', Math.min(ax + 4, size.editor.w - 110), 12);
    for (const [key, color, label] of [['in', '#5ad1ff', 'in'], ['out', '#ff8fd8', 'out']]) {
      const [x, y] = this.c.toScreen('editor', ...a[key]);
      g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.stroke();
      g.fillText(label, x - 6, y - 11);
    }
    g.restore();
  }

  drawEditor() {
    const { c, model } = this;
    const g = c.ctx.editor;
    g.clearRect(0, 0, c.size.editor.w, c.size.editor.h);
    this.drawGuides('editor');
    const gl = model.glyph();
    if (!gl) return;
    const b = bbox(gl);
    if (b) {
      const [x0, y0] = c.toScreen('editor', b.minX, b.maxV);
      const [x1, y1] = c.toScreen('editor', b.maxX, b.minV);
      g.strokeStyle = 'rgba(232,241,248,0.4)';
      g.lineWidth = 1;
      g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }
    gl.strokes.forEach((st, si) => {
      const on = si === model.sel.s;
      const pts = st.pts.map(([x, v]) => c.toScreen('editor', x, v));
      g.strokeStyle = on ? INK : 'rgba(232,241,248,0.5)';
      g.lineWidth = 1.5;
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      if (st.closed && pts.length > 2) g.closePath();
      g.stroke();
      pts.forEach(([x, y], pi) => {
        const isSel = on && pi === model.sel.p;
        g.fillStyle = isSel ? '#2bb84a' : pi === 0 ? '#d9622b' : on ? '#e8f1f8' : 'rgba(232,241,248,0.55)';
        const r = on ? 6 : 4;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      });
    });
    this.drawAnchors(g, gl);
  }

  drawResult() {
    const { c, model } = this;
    const g = c.ctx.result;
    g.clearRect(0, 0, c.size.result.w, c.size.result.h);
    this.drawGuides('result');
    const gl = model.glyph();
    const fit = fitOf(gl);
    if (!fit) return;
    const M = 480;
    const xy = Sine.trace(Sine.select(fit, kOf(gl)), M);
    g.lineWidth = 2;
    for (const run of Sine.runs(M, fit.gaps)) {
      g.save();
      g.strokeStyle = INK;
      // the stretches the pen travels without drawing are shown faint and dotted here only
      if (run.hidden) { g.globalAlpha = 0.3; g.setLineDash([3, 5]); g.lineWidth = 1; }
      g.beginPath();
      for (let j = run.a; j <= run.b; j++) {
        const [x, y] = c.toScreen('result', xy[2 * j], xy[2 * j + 1]);
        j === run.a ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
      g.restore();
    }
  }

  drawSpectrum() {
    const { c, model } = this;
    const g = c.ctx.spectrum;
    const { w, h } = c.size.spectrum;
    g.clearRect(0, 0, w, h);
    const gl = model.glyph();
    const spec = fitOf(gl);
    g.strokeStyle = 'rgba(232,241,248,0.4)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, h - 8.5); g.lineTo(w, h - 8.5); g.stroke();
    if (!spec) return;
    const H = Sine.H;
    const mag = (k) => Math.hypot(spec.re[k + H], spec.im[k + H]);
    let max = 1e-9;
    for (let k = -SPEC_RANGE; k <= SPEC_RANGE; k++) if (k) max = Math.max(max, mag(k));
    const px = (k) => ((k + SPEC_RANGE) / (2 * SPEC_RANGE)) * (w - 10) + 5;
    const py = (k) => h - 10 - (Math.min(mag(k), max) / max) * (h - 22);
    g.strokeStyle = '#d9622b';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let k = -SPEC_RANGE; k <= SPEC_RANGE; k++) k === -SPEC_RANGE ? g.moveTo(px(k), py(k)) : g.lineTo(px(k), py(k));
    g.stroke();
    const kept = Sine.select(spec, kOf(gl));
    g.fillStyle = '#ffd9c2';
    for (const [k] of kept) {
      if (!k || Math.abs(k) > SPEC_RANGE) continue;
      g.beginPath(); g.arc(px(k), py(k), 3, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(232,241,248,0.5)';
    g.font = '10px sans-serif';
    g.fillText('wave strength by frequency, ' + (-SPEC_RANGE) + ' to +' + SPEC_RANGE, 6, 11);
  }
}
