// The buttons, tabs and readouts around the canvases: keeps them in step with the model.
import { $ } from './dom.js';
import { SETS, SETTING_IDS } from '../config.js';
import { fitOf, kOf } from '../model/glyphFit.js';
import { buildData, encodeGlyph } from '../model/exportData.js';

export class ChromeView {
  constructor(model) {
    this.model = model;
  }

  // one button per character; onPick(ch) says which was chosen
  buildPicker(onPick) {
    for (const [id, set] of SETS) {
      const row = $(id);
      row.innerHTML = '';
      for (const ch of set) {
        const b = document.createElement('button');
        b.textContent = ch;
        b.dataset.ch = ch;
        b.onclick = () => onPick(ch);
        row.appendChild(b);
      }
    }
  }

  // Brings every readout up to date; returns the glyph data (the preview needs it).
  update(onPiece) {
    const { model } = this;
    document.querySelectorAll('.picker button[data-ch]').forEach((b) => {
      b.classList.toggle('has', !!fitOf(model.state.glyphs[b.dataset.ch]));
      b.classList.toggle('cur', b.dataset.ch === model.state.current);
    });
    const gl = model.glyph();
    const tabs = $('tabs');
    tabs.innerHTML = '';
    (gl ? gl.strokes : []).forEach((st, i) => {
      const b = document.createElement('button');
      b.textContent = 'Piece ' + (i + 1);
      b.className = i === model.sel.s ? 'on' : '';
      b.onclick = () => onPiece(i);
      tabs.appendChild(b);
    });
    const st = model.curStroke();
    $('closed').disabled = !st;
    $('closed').checked = !!(st && st.closed);
    $('terms').disabled = !gl;
    $('terms').value = kOf(gl);
    $('termsVal').textContent = gl ? ($('terms').value + ' + position') : '';
    $('delStroke').disabled = !st;
    $('undo').disabled = !model.undoStack.length;
    const data = buildData(model.state.glyphs);
    const own = gl && encodeGlyph(gl);
    const stat = own ? JSON.stringify(own).length + ' bytes for "' + model.state.current + '" · ' : '';
    $('total').textContent = stat + Object.keys(data).length + ' glyphs · ' + JSON.stringify(data).length + ' bytes total';
    return data;
  }

  setSavedMessage(text) { if (text !== null) $('saved').textContent = text; }

  // Fill the font and page-setting inputs from what was saved.
  applySettings() {
    const { model } = this;
    const { state } = model;
    if (state.font) {
      $('font').value = state.font.family;
      $('weight').value = state.font.weight;
      $('upright').checked = state.font.upright !== false;
    }
    if (state.ui) {
      for (const id of SETTING_IDS) {
        if (!(id in state.ui)) continue;
        if ($(id).type === 'checkbox') $(id).checked = state.ui[id]; else $(id).value = state.ui[id];
      }
    }
    $('text').value = model.content;
  }

  // Without the dev server the work stays in the browser and the export buttons appear.
  showServerMode() {
    const on = this.model.serverMode;
    $('export').hidden = $('exportPage').hidden = on;
    if (!on) $('saved').textContent = 'Not saving to the project folder. Run: npm run dev';
  }
}
