// Plays the loader's circle popping into the page: the beads fly to their places at random
// moments and each letter forms as its bead lands. Tells when the whole page is done.
import { Gather } from '../model/Gather.js';

export class GatherController {
  constructor(view, model) {
    this.view = view;
    this.model = model;
  }

  // circle: the loader's circle, { x, y, r } in page pixels. onStart is called as the first frame
  // is drawn (the loader's own circle can go then, the page's copy takes over). Resolves when
  // every letter has formed, with the page finished.
  run(circle, { onStart = () => {} } = {}) {
    const { view, model } = this;
    const gather = new Gather(model, view.geo, circle, { top: window.scrollY - 40, bottom: window.scrollY + window.innerHeight + 40 }, view.ruleLetters);
    return new Promise((resolve) => {
      const t0 = performance.now();
      let first = true;
      const frame = (now) => {
        const t = Math.min((now - t0) / 1000, gather.duration);
        view.renderGather(gather.at(t));
        if (first) { first = false; onStart(); }
        if (t < gather.duration) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }
}
