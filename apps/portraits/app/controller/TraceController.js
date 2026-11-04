// Runs the tracing and saves the result.
import { lineArt } from '../services/lineArt.js';
import { fitPortrait } from '../services/fitPortrait.js';
import { colorRegions } from '../services/regions.js';
import { save } from '../services/save.js';

export class TraceController {
  constructor(model, view) {
    this.model = model;
    this.view = view;
    document.getElementById('run').onclick = () => this.traceAll();
    document.getElementById('save').onclick = () => this.save();
    view.onRetrace((i) => this.traceOne(i));
  }

  async traceOne(i) {
    const it = this.model.items[i];
    const p = this.view.params();
    const t0 = performance.now();
    this.view.info(i, 'tracing ...');
    try {
      const art = await lineArt(it.url, { ink: p.ink, thick: p.thick });
      const fit = fitPortrait(art.pieces, { keep: p.keep });
      fit.regions = colorRegions(art.rgb, art.W, art.H, art.ink, fit.frame); // the colour inside, as sine waves too
      it.result = { ...art, fit, ms: Math.round(performance.now() - t0) };
      it.error = null;
      this.view.drawResult(i);
    } catch (e) {
      it.error = e;
      this.view.info(i, 'failed: ' + e.message);
      console.error(e);
    }
  }

  async traceAll() {
    this.view.setBusy(true);
    for (let i = 0; i < this.model.items.length; i++) {
      this.view.setStatus('Tracing ' + (i + 1) + ' of ' + this.model.items.length + ' ...');
      await new Promise((r) => setTimeout(r, 0));
      await this.traceOne(i);
    }
    this.view.setStatus('Done: ' + this.model.done.length + ' portraits traced.');
    this.view.setBusy(false);
    window.__tracedAll = true;
  }

  async save() {
    const file = this.model.toFile();
    try {
      await save('portraits.json', file);
      this.view.setStatus('Saved data/generated/portraits.json (' + Math.round(JSON.stringify(file).length / 1024) + ' KB). Now run: npm run build:dist');
    } catch (e) {
      this.view.setStatus('SAVE FAILED: ' + e.message);
    }
  }
}
