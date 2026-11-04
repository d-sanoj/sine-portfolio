// Exporting the glyph sines, and backing the editor up or restoring it from a file.
import { $ } from '../view/dom.js';
import { buildData, glyphFile } from '../model/exportData.js';
import { download, readJsonFile } from '../services/files.js';

export class FileController {
  constructor({ model, refresher, chrome }) {
    $('export').onclick = () => download('sine-glyphs.json', glyphFile(buildData(model.state.glyphs)));
    $('backup').onclick = () => download('sine-editor-backup.json', model.state);
    $('restore').onclick = () => $('restoreFile').click();
    $('restoreFile').onchange = async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const s = await readJsonFile(f);
        if (!s || typeof s.glyphs !== 'object') throw new Error('not an editor backup');
        model.pushUndo();
        model.replaceState(s);
        chrome.applySettings();
        refresher.refresh();
      } catch (err) {
        alert('Could not restore: ' + err.message);
      }
    };
  }
}
