// The buttons above the point editor, the sine-terms slider, and picking a character.
import { $ } from '../view/dom.js';

export class ToolbarController {
  constructor({ model, refresher, chrome }) {
    Object.assign(this, { model, refresher });
    chrome.buildPicker((ch) => { model.open(ch); refresher.refresh(); });

    $('addStroke').onclick = () => {
      const gl = model.glyph(true);
      model.pushUndo();
      gl.strokes.push({ pts: [], closed: false });
      model.select(gl.strokes.length - 1);
      refresher.refresh();
    };
    $('delStroke').onclick = () => {
      const gl = model.glyph();
      if (!gl || !gl.strokes[model.sel.s]) return;
      model.pushUndo();
      gl.strokes.splice(model.sel.s, 1);
      model.select(Math.max(0, model.sel.s - 1));
      refresher.refresh();
    };
    $('closed').onchange = (e) => {
      const st = model.curStroke();
      if (!st) return;
      model.pushUndo();
      st.closed = e.target.checked;
      refresher.refresh();
    };
    $('terms').oninput = (e) => {
      const gl = model.glyph();
      if (!gl) return;
      gl.K = +e.target.value;
      refresher.refresh();
    };
    $('undo').onclick = () => { if (model.undo()) refresher.refresh(); };
    $('clear').onclick = () => {
      if (!model.glyph()) return;
      model.pushUndo();
      delete model.state.glyphs[model.state.current];
      model.select(0);
      refresher.refresh();
    };
    $('resetAnchors').onclick = () => {
      const gl = model.glyph();
      if (!gl) return;
      model.pushUndo();
      delete gl.in;
      delete gl.out;
      refresher.refresh();
    };
  }
}
