// Over a link, the word "click" forms below it, toward the right end of the link, growing out of the underline, in the
// designed letters (data/generated/click-word.json) and in the underline's yellow; it folds back when the pointer leaves.
// The link to the plain page says "boring text version" instead (HINT.words): it starts where "click" would start and runs
// on to the right.
// The underline itself is left as it is, and so is the system cursor. The pointer must be on the link a moment
// (HINT.hoverDelay) before the word starts, so that a quick pass over a link does not flash it.
import * as Morph from '/core/animate/morph.js';
import { HintView, FINAL_Y, W } from '../view/HintView.js';
import { LINK_YELLOW, HINT } from '../config.js';

export class HintController {
  constructor(view, model) {
    this.view = view; // the page's view: where the page sits, and which link is hovered
    this.model = model;
    this.hint = new HintView();
    this.sets = {}; // the words, by link address ('' = "click"): { word, curves }
    this.link = null; // the link the word is for
    this.p = 0; // 0 = the circle, 1 = the word
    this.onLink = 0; // how long the pointer has been on this link (seconds)
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    this.load();
    window.addEventListener('resize', () => this.hint.fit());
  }

  async load() {
    const radius = HINT.radius / HINT.textEm; // the small circle, in ems
    const get = async (url) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        const word = await r.json();
        return { word, curves: word.letters.map((l) => Morph.buildCurve(l.s, l.g, Math.min(320, 40 + l.s.length * 4), radius, { home: 0 })) };
      } catch (e) { return null; } // no word: links just light up
    };
    const [click, ...others] = await Promise.all([get(HINT.wordUrl), ...Object.values(HINT.words).map(get)]);
    if (click) this.sets[''] = click;
    Object.keys(HINT.words).forEach((href, i) => { if (others[i]) this.sets[href] = others[i]; });
    if (click) requestAnimationFrame(this.frame);
  }

  frame(now) {
    try { this.step(now); } catch (e) { console.warn('hint:', e); } // an error must never stop the loop
    requestAnimationFrame(this.frame);
  }

  step(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const hoverNo = this.view.hover;
    const hovered = hoverNo >= 0 ? this.model.links.find((l) => l.word === hoverNo) : null;
    if (hovered && hovered !== this.link) { this.link = hovered; this.p = 0; this.onLink = 0; } // a different link: start over
    this.onLink = hovered ? this.onLink + dt : 0;
    const forming = hovered && this.onLink > HINT.hoverDelay;
    this.p = Math.min(1, Math.max(0, this.p + (forming ? dt / HINT.formTime : hovered ? 0 : -dt / HINT.unformTime)));
    if (!this.link || (this.p <= 0 && !hovered)) { this.hint.place(null); return; }
    // where it goes: "click" has its right end under the right end of the link, below the underline; other words start where "click" starts
    const { em, ox, oy } = this.view.geo, box = this.link.box;
    const { word, curves } = this.sets[this.link.href] || this.sets[''];
    const wordW = word.width * HINT.textEm, wordH = word.height * HINT.textEm;
    const underlineY = oy - (box[1] + 0.12) * em; // the boxes are padded by 0.12 em
    const left = ox + box[2] * em - HINT.inset - this.sets[''].word.width * HINT.textEm;
    const x = word === this.sets[''].word ? left + wordW / 2 : Math.min(left, this.view.width - 10 - wordW) + wordW / 2; // on a narrow screen it is moved left to stay on the page
    const y = underlineY + HINT.gap + wordH / 2;
    this.hint.place(x, y);
    const step = Math.round(this.p * HINT.steps) / HINT.steps; // only redraw when the word has really changed
    // the circle starts on the underline, straight above where the word will be
    this.hint.draw(step, curves, { em: HINT.textEm, lineWidth: HINT.lineWidth, color: LINK_YELLOW, startX: W / 2, startY: FINAL_Y - (y - underlineY) });
  }
}
