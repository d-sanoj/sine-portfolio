// Scrolling: content that comes onto the screen is drawn in again, quickly: every letter forms from
// its circle, flying in from a nearby spot, a few tenths of a second after it appears. A part that
// scrolls well away and comes back forms again, so the text is always rearranging itself as you move.
// (Nothing animates for people who prefer reduced motion: the page is simply drawn.)
import { SCROLL_FORM, SCROLL_STAGGER, SCROLL_NEAR, SCROLL_FAR, SCROLL_SHIFT } from '../config.js';

export class ScrollController {
  constructor(view, model, play) {
    this.view = view;
    this.model = model;
    this.play = play;
    this.active = false;
    this.raf = 0;
    this.still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.tick = this.tick.bind(this);
    window.addEventListener('scroll', () => { if (this.active) { this.sync(false); this.kick(); } }, { passive: true });
  }

  get letters() { return this.model.letters.concat(this.view.ruleLetters); }

  // take over drawing the page; what is on screen now stays as it is
  start() {
    if (this.still) { this.play.complete(); return; }
    this.active = true;
    this.play.alt = () => this.draw(performance.now());
    this.sync(true);
    this.draw(performance.now());
  }

  stop() {
    this.active = false;
    this.play.alt = null;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  // the screen changed shape: start again from what is on screen
  reset() { if (this.active) { this.sync(true); this.draw(performance.now()); } }

  // Which letters are on screen. A letter that has just come near starts forming (at a random
  // moment in the next instant); one that is far away is let go, so it forms again when it returns.
  // initial: everything near is shown as it is, with no animation.
  sync(initial) {
    const { em, oy } = this.view.geo;
    const now = performance.now();
    const top = window.scrollY, bottom = window.scrollY + window.innerHeight;
    for (const st of this.letters) {
      const sy = oy - st.cy * em, reach = st.line ? 4 : Math.min(st.rmax * em, 80);
      const lo = sy - reach, hi = sy + reach;
      const near = hi >= top - SCROLL_NEAR && lo <= bottom + SCROLL_NEAR;
      const far = hi >= top - SCROLL_FAR && lo <= bottom + SCROLL_FAR;
      if (initial) { st.vis = near; st.enter = -Infinity; st.shift = [0, 0]; continue; }
      if (!st.vis && near) {
        const a = Math.random() * Math.PI * 2, d = SCROLL_SHIFT[0] + (SCROLL_SHIFT[1] - SCROLL_SHIFT[0]) * Math.random();
        st.vis = true;
        st.enter = now + Math.random() * SCROLL_STAGGER * 1000;
        st.shift = [Math.cos(a) * d, Math.sin(a) * d * 0.7];
      } else if (st.vis && !far) {
        st.vis = false;
      }
    }
  }

  draw(now) { return this.view.renderScroll(this.letters, now, SCROLL_FORM * 1000); }

  kick() { if (!this.raf) this.raf = requestAnimationFrame(this.tick); }

  tick(now) {
    this.raf = 0;
    if (this.draw(performance.now())) this.kick();
  }
}
