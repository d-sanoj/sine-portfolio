// The gallery: for each photo, the photo, the line art found in it, and the sine curve.
import { Sine } from '/core/index.js';

const $ = (id) => document.getElementById(id);

export class GalleryView {
  constructor(model) {
    this.model = model;
    this.cards = [];
    const gallery = $('gallery');
    for (const it of model.items) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="row">
          <div><img alt=""></div>
          <div><canvas class="art"></canvas></div>
          <div><canvas class="sine"></canvas></div>
        </div>
        <div class="cap"><span>photo</span><span>line art</span><span>sine curve</span></div>
        <div class="meta"><span class="info">waiting</span><button>Retrace</button></div>`;
      card.querySelector('img').src = it.url;
      gallery.appendChild(card);
      this.cards.push(card);
    }
  }

  onRetrace(handler) {
    this.cards.forEach((card, i) => { card.querySelector('button').onclick = () => handler(i); });
  }

  setStatus(text) { $('status').textContent = text; }
  setBusy(busy) { $('run').disabled = busy; $('save').disabled = busy || !this.model.done.length; }
  params() { return { ink: +$('ink').value, thick: +$('thick').value, keep: +$('keep').value }; }

  info(i, text) { this.cards[i].querySelector('.info').textContent = text; }

  // paint a canvas at its display size
  prepare(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 170;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    return { g, w, h };
  }

  drawResult(i) {
    const it = this.model.items[i];
    const r = it.result;
    const card = this.cards[i];
    // the pieces found, in pixels
    {
      const { g, w, h } = this.prepare(card.querySelector('.art'));
      const s = Math.min(w / r.W, h / r.H);
      const ox = (w - r.W * s) / 2, oy = (h - r.H * s) / 2;
      g.strokeStyle = '#ebe8e1';
      g.lineWidth = 1;
      for (const p of r.pieces) {
        g.beginPath();
        p.pts.forEach(([x, y], k) => (k ? g.lineTo(ox + x * s, oy + y * s) : g.moveTo(ox + x * s, oy + y * s)));
        if (p.closed) g.closePath();
        g.stroke();
      }
    }
    // the sine curve, with the pen-travel stretches left out
    {
      const { g, w, h } = this.prepare(card.querySelector('.sine'));
      const aspect = r.W / r.H;
      const s = Math.min(w / aspect, h);
      const ox = w / 2, oy = h / 2;
      for (const reg of r.fit.regions || []) {
        g.fillStyle = `rgb(${reg.c.join(',')})`;
        g.beginPath();
        for (const terms of reg.s) {
          const q = Sine.trace(terms, 240);
          for (let j = 0; j <= 240; j++) { const X = ox + q[2 * j] * s, Y = oy - q[2 * j + 1] * s; j ? g.lineTo(X, Y) : g.moveTo(X, Y); }
          g.closePath();
        }
        g.fill('evenodd');
      }
      const M = 9000;
      const xy = Sine.trace(r.fit.terms, M);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1;
      for (const run of Sine.runs(M, r.fit.gaps)) {
        if (run.hidden) continue;
        g.beginPath();
        for (let j = run.a; j <= run.b; j++) {
          const px = ox + xy[2 * j] * s, py = oy - xy[2 * j + 1] * s;
          j === run.a ? g.moveTo(px, py) : g.lineTo(px, py);
        }
        g.stroke();
      }
    }
    const kb = Math.round(JSON.stringify({ s: r.fit.terms, g: r.fit.gaps }).length / 1024);
    this.info(i, `${r.pieces.length} strokes · ${r.fit.terms.length} sine terms · ${kb} KB · ${r.ms} ms`);
  }
}
