// The word at the top of the sine page, drawn in sine waves, that you can play with: drag across it and the letters morph between
// circles and finished letters (the same morph every letter does as it forms). Let go and it settles back into the word.
// It has a canvas of its own over a slot the layout keeps free (data-sine-slot="hero" in the plain page), so dragging redraws only
// this small canvas, not the whole page. It plays itself once when the page is ready, and gives one small nudge to say "drag me".
import * as Morph from '/core/animate/morph.js';

const WORD = { url: 'data/hero-word.json', circle: 0.2, stagger: 0.55, width: 0.034 }; // circle: the radius letters start as (ems); width: line width in ems

export class HeroWord {
  // slot: { x, v, w, h } in page ems (v = the top); colour: the ink colour
  constructor(view, slot, colour) {
    this.view = view;
    this.slot = slot;
    this.colour = colour || '#ebe8e1';
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'The word Sanoj drawn in sine waves. Drag across it to play with it.');
    this.canvas.style.cssText = 'position:absolute;z-index:3;touch-action:pan-y;cursor:ew-resize;opacity:0;transition:opacity 0.6s ease;';
    document.body.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.word = null;
    this.curves = [];
    this.u = 0; // how formed the word is: 0 = circles, 1 = letters
    this.target = 0;
    this.rate = 2.4; // how fast u chases its target (per second)
    this.dragging = false;
    this.touched = false;
    this.raf = 0;
    this.last = 0;
    this.shown = false;
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.intro = new Promise((resolve) => { this.endIntro = resolve; }); // settles when the word has formed for the first time
    this.introDone = false;
    this.tick = this.tick.bind(this);
    this.canvas.addEventListener('pointerdown', (e) => this.down(e));
    this.canvas.addEventListener('pointermove', (e) => { if (this.dragging) this.move(e); });
    this.canvas.addEventListener('pointerup', (e) => this.up(e));
    this.canvas.addEventListener('pointercancel', (e) => this.up(e));
    this.load();
  }

  async load() {
    try {
      const r = await fetch(WORD.url);
      if (!r.ok) { this.endIntro(); return; }
      this.word = await r.json();
      this.curves = this.word.letters.map((l) => Morph.buildCurve(l.s, l.g, 240, WORD.circle, { home: 1 }));
      this.place();
      if (this.shown) this.start();
    } catch (e) { this.endIntro(); /* no word: the space stays empty */ }
  }

  // put the canvas over its slot (call after the page's geometry changes)
  place() {
    const { em, ox, oy } = this.view.geo, dpr = window.devicePixelRatio || 1;
    const w = this.slot.w * em, h = this.slot.h * em;
    const s = this.canvas.style;
    s.left = (ox + this.slot.x * em).toFixed(1) + 'px';
    s.top = (oy - this.slot.v * em).toFixed(1) + 'px';
    s.width = w.toFixed(1) + 'px';
    s.height = h.toFixed(1) + 'px';
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssW = w;
    this.cssH = h;
    this.draw();
  }

  // the page is ready: show it, and let it form from its circles (once)
  show() {
    this.shown = true;
    this.canvas.style.opacity = '1';
    if (this.word) this.start();
  }

  start() {
    if (this.started) return;
    this.started = true;
    if (this.reduce) { this.u = this.target = 1; this.draw(); this.introDone = true; this.endIntro(); return; }
    this.u = 0; this.target = 1; this.rate = 2.4;
    this.kick();
    setTimeout(() => { if (!this.touched) this.nudge(); }, 3200); // one small hint that it can be dragged
  }

  nudge() {
    if (this.dragging || this.reduce) return;
    this.target = 0.72; this.rate = 3.2;
    this.kick();
    setTimeout(() => { if (!this.dragging) { this.target = 1; this.rate = 2.6; this.kick(); } }, 650);
  }

  // where the word sits inside the canvas (px): its scale (px per em), and its left and width
  fit() {
    const S = Math.min((this.cssW * 0.92) / this.word.width, (this.cssH * 0.86) / this.word.height);
    return { S, left: (this.cssW - S * this.word.width) / 2, width: S * this.word.width };
  }

  uAt(e) {
    const r = this.canvas.getBoundingClientRect(), f = this.fit();
    return Math.min(1, Math.max(0, (e.clientX - r.left - f.left) / f.width));
  }

  down(e) {
    if (!this.word) return;
    this.dragging = true; this.touched = true;
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* a pointer that cannot be captured still drags */ }
    this.canvas.style.cursor = 'grabbing';
    this.target = this.uAt(e); this.rate = 24;
    this.kick();
  }

  move(e) { this.target = this.uAt(e); this.kick(); }

  up(e) {
    if (!this.dragging) return;
    this.dragging = false;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    this.canvas.style.cursor = 'ew-resize';
    this.target = 1; this.rate = 4.2; // settles back into the word
    this.kick();
  }

  kick() { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); } }

  tick(now) {
    this.raf = 0;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.u += (this.target - this.u) * (1 - Math.exp(-this.rate * dt));
    if (Math.abs(this.target - this.u) < 0.0015) this.u = this.target;
    this.draw();
    // once it looks finished (not when it has settled to the last hair) the page may scroll
    if (!this.introDone && this.started && this.target === 1 && this.u > 0.992) { this.introDone = true; this.endIntro(); }
    if (this.u !== this.target || this.dragging) this.kick();
  }

  draw() {
    const { g } = this;
    g.clearRect(0, 0, this.cssW || 0, this.cssH || 0);
    if (!this.word || !this.curves.length) return;
    const { S } = this.fit(), n = this.curves.length;
    const cx = this.cssW / 2, cy = this.cssH / 2;
    g.strokeStyle = this.colour;
    g.lineWidth = Math.max(1.6, S * WORD.width);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let i = 0; i < n; i++) {
      // the letters form one after the other, left to right, as you drag
      const p = Math.min(1, Math.max(0.0001, this.u * (1 + WORD.stagger) - (i / Math.max(1, n - 1)) * WORD.stagger));
      const curve = this.curves[i];
      const { xy, hide } = Morph.shape(curve, p);
      for (const run of curve.runs) {
        if (run.hidden && hide >= 1) continue;
        g.globalAlpha = run.hidden ? 0.3 * (1 - hide) : 1;
        g.setLineDash(run.hidden ? [S * 0.012, S * 0.03] : []);
        g.beginPath();
        for (let j = run.a; j <= run.b; j++) {
          const x = cx + xy[2 * j] * S, y = cy - xy[2 * j + 1] * S;
          j === run.a ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    g.setLineDash([]);
    g.globalAlpha = 1;
  }
}
