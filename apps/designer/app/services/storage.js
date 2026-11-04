// Loading and saving the designer's work.
// With the dev server running, work is written into data/ (source/ for what you author,
// preview/ for the page preview). Without it, the browser keeps the editor state.
import { STORAGE_KEY, TEXT_STORAGE_KEY } from '../config.js';
import { buildData, glyphFile } from '../model/exportData.js';

const fetchText = async (url) => {
  try { const r = await fetch(url, { cache: 'no-store' }); return r.ok ? await r.text() : null; } catch (e) { return null; }
};

export class Storage {
  constructor(model) {
    this.model = model;
    this.sent = {}; // what was last written, so unchanged files are not sent again
  }

  // Finds out whether the dev server is there, then loads whatever was saved.
  async load() {
    const { model } = this;
    try { model.serverMode = (await fetch('/api/ping', { cache: 'no-store' })).ok; } catch (e) { model.serverMode = false; }
    let loaded = false;
    if (model.serverMode) {
      try {
        const j = JSON.parse(await fetchText('/source/editor.json'));
        if (j && j.glyphs) { model.replaceState(j); loaded = true; }
      } catch (e) { /* nothing saved yet */ }
      const text = await fetchText('/source/designer-text.txt');
      if (text !== null) model.content = text;
    }
    if (!loaded) {
      // first run with the server: carry over anything the browser had kept
      try {
        const j = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (j && j.glyphs) model.replaceState(j);
        const t = localStorage.getItem(TEXT_STORAGE_KEY);
        if (t !== null && !model.serverMode) model.content = t;
      } catch (e) { /* nothing stored */ }
    }
  }

  async push(name, text) {
    if (this.sent[name] === text) return;
    const r = await fetch('/api/save/' + name, { method: 'POST', headers: { 'X-Sine': '1', 'Content-Type': 'text/plain' }, body: text });
    if (!r.ok) throw new Error(name + ' ' + r.status);
    this.sent[name] = text;
  }

  // Returns the message to show, or null when there is nothing to say.
  async saveAll() {
    const { model } = this;
    if (!model.serverMode) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(model.state));
        localStorage.setItem(TEXT_STORAGE_KEY, model.content);
      } catch (e) { /* ignore */ }
      return null;
    }
    try {
      await this.push('editor.json', JSON.stringify(model.state));
      await this.push('designer-text.txt', model.content);
      await this.push('sine-glyphs.json', JSON.stringify(glyphFile(buildData(model.state.glyphs))));
      if (model.lastPage) await this.push('designer-page.json', JSON.stringify(model.lastPage));
      return 'Saved to data/ at ' + new Date().toLocaleTimeString();
    } catch (e) {
      return 'SAVE FAILED: ' + e.message;
    }
  }
}
