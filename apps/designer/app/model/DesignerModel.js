// The designer's data: the glyphs being designed, which one is open, what is selected,
// and the undo history. No drawing and no events in here.
import { DEFAULT_TEXT } from '../config.js';

export class DesignerModel {
  constructor() {
    // saved with the editor: { glyphs, current, font?, ui?, metrics? }
    this.state = { glyphs: {}, current: 'A' };
    this.content = DEFAULT_TEXT; // the sandbox text for the page preview
    this.sel = { s: 0, p: -1 }; // selected piece and point
    this.undoStack = [];
    this.serverMode = false; // true when the dev server can save into data/
    this.lastPage = null; // the page last composed for the preview
  }

  // ---- glyphs ----
  // The open glyph, or undefined; create = true starts an empty one.
  glyph(create = false) {
    let g = this.state.glyphs[this.state.current];
    if (!g && create) g = this.state.glyphs[this.state.current] = { strokes: [] };
    return g;
  }
  curStroke() { const g = this.glyph(); return g && g.strokes[this.sel.s]; }

  open(ch) {
    this.state.current = ch;
    this.sel = { s: 0, p: -1 };
    this.undoStack = [];
  }

  select(s, p = -1) { this.sel = { s, p }; }

  // ---- undo ----
  pushUndo() {
    this.undoStack.push(JSON.stringify(this.state.glyphs));
    if (this.undoStack.length > 100) this.undoStack.shift();
  }
  // true if something was undone
  undo() {
    if (!this.undoStack.length) return false;
    this.state.glyphs = JSON.parse(this.undoStack.pop());
    this.sel = { s: 0, p: -1 };
    return true;
  }

  // Replace everything (loading from disk, or restoring a backup).
  replaceState(state) {
    this.state = state;
    this.state.current = state.current || 'A';
    this.sel = { s: 0, p: -1 };
  }
}
