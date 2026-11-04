// The preview section: the sandbox text, the page settings, and playing the result.
import { $ } from '../view/dom.js';
import { SETTING_IDS } from '../config.js';
import { download } from '../services/files.js';

export class PreviewController {
  constructor({ model, refresher }) {
    const uiValue = (id) => ($(id).type === 'checkbox' ? $(id).checked : $(id).value);
    // page settings are saved with the editor; the text is saved on its own
    SETTING_IDS.forEach((id) => {
      $(id).oninput = () => { model.state.ui = Object.fromEntries(SETTING_IDS.map((k) => [k, uiValue(k)])); refresher.refresh(); };
    });
    $('text').oninput = () => { model.content = $('text').value; refresher.refresh(); };
    $('reroll').onclick = () => { $('seed').value = 1 + Math.floor(Math.random() * 9999); $('seed').oninput(); };
    // play the preview page on the real site
    $('play').onclick = async () => {
      const w = window.open('', '_blank');
      await refresher.saveNow();
      if (w) w.location = '/?src=/preview/designer-page.json';
    };
    $('exportPage').onclick = () => { if (model.lastPage) download('sine-page.json', model.lastPage); };
  }
}
