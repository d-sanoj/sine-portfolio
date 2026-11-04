// The four canvases, their sizes, and the maths between glyph space and screen space.
import { $ } from './dom.js';
import { VIEW, ASPECT } from '../config.js';

export class Canvases {
  constructor() {
    this.dpr = window.devicePixelRatio || 1;
    this.cv = { editor: $('editor'), result: $('result'), spectrum: $('spectrum'), out: $('out') };
    this.ctx = {};
    this.size = {};
  }

  setSize(name, w, h) {
    const c = this.cv[name];
    c.width = Math.round(w * this.dpr);
    c.height = Math.round(h * this.dpr);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    this.ctx[name] = c.getContext('2d');
    this.ctx[name].setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.size[name] = { w, h };
  }

  // fit the panels to the window
  layout() {
    const colW = $('leftCol').clientWidth;
    const maxH = Math.max(380, window.innerHeight - 290);
    const w = Math.max(260, Math.min(colW, maxH * ASPECT));
    const h = w / ASPECT;
    this.setSize('editor', w, h);
    this.setSize('result', w, h);
    this.setSize('spectrum', w, 76);
    this.setSize('out', $('out').parentElement.clientWidth - 3, 120);
  }

  // glyph space (ems, v up) <-> pixels of one canvas
  toScreen(name, x, v) {
    const { w, h } = this.size[name];
    return [((x - VIEW.x0) / (VIEW.x1 - VIEW.x0)) * w, ((VIEW.v1 - v) / (VIEW.v1 - VIEW.v0)) * h];
  }
  fromScreen(name, px, py) {
    const { w, h } = this.size[name];
    return [VIEW.x0 + (px / w) * (VIEW.x1 - VIEW.x0), VIEW.v1 - (py / h) * (VIEW.v1 - VIEW.v0)];
  }
}
