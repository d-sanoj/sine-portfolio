// The page preview: the sandbox text, laid out and drawn from the glyphs designed so far.
import { Content, Layout, PageCanvas } from '/core/index.js';
import { $ } from './dom.js';

export class PreviewView {
  constructor(model, canvases) {
    this.model = model;
    this.c = canvases;
  }

  // the page-setting inputs, read as layout options
  options() {
    return {
      join: $('join').checked,
      irr: +$('irr').value,
      seed: Math.max(1, Math.floor(+$('seed').value || 1)),
      maxWidth: +$('lineW').value || 14,
    };
  }

  draw(data) {
    const { model, c } = this;
    const parsed = Content.parse(model.content);
    model.lastPage = Layout.compose(parsed.blocks, data, this.options());
    this.showNotes(parsed, data);
    const [x0, v0, x1, v1] = model.lastPage.bounds;
    const width = $('out').parentElement.clientWidth - 3;
    const pad = 12;
    const em = Math.min(+$('size').value, (width - 2 * pad) / (x1 - x0));
    $('sizeVal').textContent = Math.round(em) + 'px';
    c.setSize('out', width, (v1 - v0) * em + 2 * pad);
    c.ctx.out.clearRect(0, 0, width, c.size.out.h);
    PageCanvas.draw(c.ctx.out, model.lastPage, pad - x0 * em, pad + v1 * em, em);
  }

  // what was read from the text, what was left out, and which characters have no letter yet
  showNotes(parsed, data) {
    const used = new Set(parsed.blocks.flatMap((b) => b.words.flatMap((w) => [...Content.resolve(w.t || '', data)])));
    const missing = [...used].filter((ch) => !data[ch]);
    const kinds = {};
    for (const b of parsed.blocks) kinds[b.kind] = (kinds[b.kind] || 0) + 1;
    $('parseNotes').textContent = 'Read: ' + (Object.entries(kinds).map(([k, n]) => n + ' ' + k).join(', ') || 'nothing')
      + (parsed.notes.length ? ' · Left out: ' + parsed.notes.join('; ') : '')
      + (missing.length ? ' · No letter designed for: ' + missing.join(' ') : '');
  }
}
