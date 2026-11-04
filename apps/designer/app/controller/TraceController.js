// Starting glyphs from a font: trace one, the empty ones, the lowercase ones, or everything.
import { $ } from '../view/dom.js';
import { ALL, LOWER } from '../config.js';
import { Trace } from '../services/tracer.js';
import { autoK } from '../model/glyphFit.js';

const BUTTONS = ['traceOne', 'traceAll', 'traceLower', 'traceReplace'];

export class TraceController {
  constructor({ model, refresher }) {
    Object.assign(this, { model, refresher });
    $('traceOne').onclick = () => this.traceCurrent();
    $('traceAll').onclick = () => this.traceMany([...ALL].filter((ch) => {
      const gl = model.state.glyphs[ch];
      return !(gl && gl.strokes.length);
    }));
    $('traceReplace').onclick = () => {
      if (confirm('Replace EVERY glyph (letters, numbers, punctuation) with a fresh trace of this font? Your edits to them are lost; Undo brings them back.')) this.traceMany([...ALL]);
    };
    $('traceLower').onclick = () => {
      if (confirm('Replace all 26 lowercase letters with a fresh trace? Everything else is not touched.')) this.traceMany([...LOWER]);
    };
    // remember the font choice
    const remember = () => { model.state.font = { family: $('font').value, weight: $('weight').value, upright: $('upright').checked }; refresher.saveSoon(); };
    $('font').onchange = remember;
    $('weight').onchange = remember;
    $('upright').onchange = remember;
  }

  traceOf(ch) {
    return Trace.glyph(ch, $('font').value.trim() || 'sans-serif', $('weight').value, $('upright').checked);
  }

  // wait until the chosen font is really available before drawing letters from it
  async ensureFont() {
    const fam = $('font').value.trim() || 'sans-serif';
    try { await document.fonts.load(`${$('weight').value} 100px ${fam}`, 'Hxgd'); } catch (e) { /* system font */ }
    this.model.state.metrics = Trace.metrics(fam, $('weight').value);
  }

  // store a traced glyph, with as many sine terms as it needs
  place(ch, traced) {
    const g = { strokes: traced.strokes.map((s) => ({ pts: s.pts, closed: s.closed })), adv: traced.adv };
    this.model.state.glyphs[ch] = g;
    g.K = autoK(g);
  }

  async traceCurrent() {
    const { model } = this;
    const ch = model.state.current;
    await this.ensureFont();
    const t = this.traceOf(ch);
    model.pushUndo();
    if (t.strokes.length) this.place(ch, t);
    else delete model.state.glyphs[ch];
    model.select(0);
    $('traceMsg').textContent = t.strokes.length ? '' : 'Nothing found for "' + ch + '"';
    this.refresher.refresh();
  }

  async traceMany(chars) {
    const { model } = this;
    if (!chars.length) { $('traceMsg').textContent = 'Nothing to trace'; return; }
    model.pushUndo();
    BUTTONS.forEach((id) => { $(id).disabled = true; });
    await this.ensureFont();
    for (let i = 0; i < chars.length; i++) {
      $('traceMsg').textContent = 'Tracing ' + chars[i] + ' (' + (i + 1) + '/' + chars.length + ')';
      await new Promise((r) => setTimeout(r, 0));
      const t = this.traceOf(chars[i]);
      if (t.strokes.length) this.place(chars[i], t);
    }
    BUTTONS.forEach((id) => { $(id).disabled = false; });
    $('traceMsg').textContent = 'Done: ' + chars.length + ' glyphs traced. Undo reverts all.';
    model.select(0);
    this.refresher.refresh();
  }
}
