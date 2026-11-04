// The animation clock: starts it, steps it every frame, and redraws on request.
import { START_DELAY } from '../config.js';

export class PlayController {
  constructor(view, model, options = {}) {
    this.view = view;
    this.model = model;
    this.delay = options.delay ?? START_DELAY;
    this.t0 = 0;
    this.raf = 0;
    this.done = false;
    this.alt = null; // when set, draws the page instead (the scrolling controller, see ScrollController)
    this.onStart = null; // called when an animation starts
    this.onDone = null; // called when it has finished
    this.frame = this.frame.bind(this);
  }

  frame(now) {
    const time = (now - this.t0) / 1000;
    this.view.render(time);
    if (time >= this.model.end) { this.done = true; if (this.onDone) this.onDone(); return; }
    this.raf = requestAnimationFrame(this.frame);
  }

  play() {
    cancelAnimationFrame(this.raf);
    this.done = false;
    if (this.onStart) this.onStart();
    for (const st of this.model.letters) st.still = null;
    this.t0 = performance.now() + this.delay * 1000;
    this.raf = requestAnimationFrame(this.frame);
  }

  // the page was brought in by something else (see GatherController): it is finished
  complete() {
    cancelAnimationFrame(this.raf);
    this.done = true;
    this.redraw();
  }

  // draw again where we are (after a resize or a hover change)
  redraw() {
    if (this.alt) { this.alt(); return; }
    this.view.render(this.done ? Infinity : (performance.now() - this.t0) / 1000);
  }
}
