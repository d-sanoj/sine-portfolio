// Editing a glyph with the mouse and keyboard on the point editor:
// click to add, drag to move, click a line to insert, right-click or Delete to remove.
import { $ } from '../view/dom.js';
import { SNAP } from '../config.js';
import { anchorsOf } from '../model/anchors.js';

export class EditorPointerController {
  constructor({ model, canvases, refresher }) {
    Object.assign(this, { model, c: canvases, refresher });
    this.drag = null; // { kind: 'point' | 'in' | 'out' | 'adv', moved }
    const el = canvases.cv.editor;
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', () => { this.drag = null; });
    el.addEventListener('pointercancel', () => { this.drag = null; });
    el.addEventListener('contextmenu', (e) => this.onContextMenu(e));
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  // ---- positions ----
  pointer(e) {
    const r = this.c.cv.editor.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  worldOf(px, py) {
    let [x, v] = this.c.fromScreen('editor', px, py);
    if ($('snap').checked) { x = Math.round(x / SNAP) * SNAP; v = Math.round(v / SNAP) * SNAP; }
    return [+x.toFixed(4), +v.toFixed(4)];
  }

  // ---- what is under the pointer ----
  hitPoint(px, py) {
    const { model } = this;
    const gl = model.glyph();
    if (!gl) return null;
    // Prefer the selected piece, then the rest.
    const order = gl.strokes.map((_, i) => i).sort((a, b) => (a === model.sel.s ? -1 : b === model.sel.s ? 1 : 0));
    for (const s of order) {
      const pts = gl.strokes[s].pts;
      for (let p = pts.length - 1; p >= 0; p--) {
        const [x, y] = this.c.toScreen('editor', pts[p][0], pts[p][1]);
        if (Math.abs(x - px) <= 9 && Math.abs(y - py) <= 9) return { s, p };
      }
    }
    return null;
  }
  hitSegment(st, px, py) {
    const n = st.pts.length;
    const last = st.closed && n > 2 ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = this.c.toScreen('editor', ...st.pts[i]);
      const b = this.c.toScreen('editor', ...st.pts[(i + 1) % n]);
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2)) : 0;
      if (Math.hypot(a[0] + dx * t - px, a[1] + dy * t - py) <= 6) return i;
    }
    return -1;
  }
  // The join markers and the "next letter" line sit on top of the points.
  hitAnchor(px, py) {
    const gl = this.model.glyph();
    const a = gl && anchorsOf(gl);
    if (!a) return null;
    for (const key of ['in', 'out']) {
      const [x, y] = this.c.toScreen('editor', ...a[key]);
      if (Math.hypot(x - px, y - py) <= 10) return key;
    }
    const [ax] = this.c.toScreen('editor', a.adv, 0);
    return Math.abs(ax - px) <= 5 ? 'adv' : null;
  }

  // ---- events ----
  onDown(e) {
    if (e.button !== 0) return;
    const { model } = this;
    const [px, py] = this.pointer(e);
    const anchor = this.hitAnchor(px, py);
    const hit = anchor ? null : this.hitPoint(px, py);
    if (anchor) {
      this.drag = { kind: anchor, moved: false };
    } else if (hit) {
      model.select(hit.s, hit.p);
      this.drag = { kind: 'point', moved: false };
    } else {
      model.pushUndo();
      const gl = model.glyph(true);
      if (!gl.strokes.length) gl.strokes.push({ pts: [], closed: false });
      if (!gl.strokes[model.sel.s]) model.sel.s = gl.strokes.length - 1;
      const st = gl.strokes[model.sel.s];
      const seg = e.shiftKey ? -1 : this.hitSegment(st, px, py);
      if (seg >= 0) { st.pts.splice(seg + 1, 0, this.worldOf(px, py)); model.sel.p = seg + 1; }
      else { st.pts.push(this.worldOf(px, py)); model.sel.p = st.pts.length - 1; }
      this.drag = { kind: 'point', moved: true };
    }
    this.c.cv.editor.setPointerCapture(e.pointerId);
    this.refresher.refresh();
  }

  onMove(e) {
    if (!this.drag) return;
    const { model, drag } = this;
    const gl = model.glyph();
    const [px, py] = this.pointer(e);
    if (drag.kind === 'point') {
      const st = model.curStroke();
      if (!st || model.sel.p < 0) return;
      if (!drag.moved) { model.pushUndo(); drag.moved = true; }
      st.pts[model.sel.p] = this.worldOf(px, py);
    } else {
      if (!drag.moved) { model.pushUndo(); drag.moved = true; }
      const w = this.worldOf(px, py);
      if (drag.kind === 'adv') gl.adv = w[0];
      else gl[drag.kind] = w;
    }
    this.refresher.refresh();
  }

  deletePoint(s, p) {
    const { model } = this;
    const gl = model.glyph();
    if (!gl || !gl.strokes[s]) return;
    model.pushUndo();
    const st = gl.strokes[s];
    st.pts.splice(p, 1);
    if (!st.pts.length) gl.strokes.splice(s, 1);
    model.select(Math.max(0, Math.min(s, gl.strokes.length - 1)));
    this.refresher.refresh();
  }

  onContextMenu(e) {
    e.preventDefault();
    const hit = this.hitPoint(...this.pointer(e));
    if (hit) this.deletePoint(hit.s, hit.p);
  }

  onKey(e) {
    if (['TEXTAREA', 'INPUT', 'SELECT'].includes(e.target.tagName)) return;
    const { model } = this;
    if ((e.key === 'Delete' || e.key === 'Backspace') && model.sel.p >= 0) { e.preventDefault(); this.deletePoint(model.sel.s, model.sel.p); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (model.undo()) this.refresher.refresh();
    }
  }
}
