// Runs the loader: cycles through random portraits until the page is ready (and the
// loader has been up long enough), then leaves on a finished portrait. It leaves in one of two ways:
//   mode 'fade'    the loader fades away (the plain page)
//   mode 'circle'  the portrait dissolves into a circle and hands that circle to the page,
//                  which divides it into its letters' circles (the sine page)
import { MIN_SHOW, FADE_TIME } from '../config.js';
import { at, cycleTime, LOADER_TIMES } from '../model/Timeline.js';

export class LoaderController {
  // ready: a promise that settles when the page is ready to be shown
  constructor({ root, set, view, ready, savedOverflow, mode = 'fade' }) {
    Object.assign(this, { root, set, view, savedOverflow, mode });
    this.state = 'loading'; // loading -> closing -> waiting -> gone
    this.ready = false;
    this.item = set.next();
    this.t0 = performance.now();
    this.cycleStart = this.t0;
    ready.then(() => { this.ready = true; }, () => { this.ready = true; });
    // resolves when the loader starts to leave: the page's own animation can begin then
    this.finished = new Promise((resolve) => { this.finish = resolve; });
    // resolves with the circle the portrait has become, { x, y, r } in page pixels
    this.circle = new Promise((resolve) => { this.giveCircle = resolve; });
    this.frame = this.frame.bind(this);
    window.addEventListener('resize', () => { if (this.state !== 'gone') this.view.resize(); this.redraw(); });
    requestAnimationFrame(this.frame);
  }

  frame(now) {
    if (this.state === 'gone' || this.state === 'waiting') return;
    let lt = (now - this.cycleStart) / 1000;
    if (this.state === 'loading' && lt >= cycleTime(LOADER_TIMES)) { // the next portrait, chosen at random
      this.item = this.set.next();
      this.cycleStart = now;
      lt = 0;
    }
    const { phase, progress } = at(lt, LOADER_TIMES);
    this.progress = progress;
    this.view.draw(this.item, progress);
    // it leaves once the page is ready and the portrait has formed; the circle mode can carry on
    // through the dissolve, so a page that is a little late never waits for a whole extra cycle
    const formed = this.mode === 'fade' ? phase === 'hold' : phase !== 'form';
    if (this.state === 'loading' && this.ready && (now - this.t0) / 1000 >= MIN_SHOW && formed) {
      if (this.mode === 'fade') { this.fade(); return; }
      this.state = 'closing'; // let the finished portrait dissolve into its circle
    }
    if (this.state === 'closing' && lt >= cycleTime(LOADER_TIMES)) {
      this.state = 'waiting';
      this.progress = 0;
      this.view.draw(this.item, 0);
      this.giveCircle(this.circleNow());
      return;
    }
    requestAnimationFrame(this.frame);
  }

  redraw() {
    if (this.state === 'waiting') this.view.draw(this.item, 0);
  }

  // the circle on screen now, in page pixels, with the small coloured circles inside it (dots)
  circleNow() {
    const pose = this.view.fullPose(this.item);
    const dots = this.view.dotsAt(this.item, pose).map((d) => ({ ...d, x: d.x + window.scrollX, y: d.y + window.scrollY }));
    return { x: pose.cx + window.scrollX, y: pose.cy + window.scrollY, r: pose.s * 0.5, dots };
  }

  unlock() { document.documentElement.style.overflow = this.savedOverflow || ''; }

  // the page draws underneath now: the loader's own background goes, its circle stays a little longer
  showPage() { this.root.style.background = 'transparent'; this.root.style.pointerEvents = 'none'; }

  // the loader goes
  release({ instant = false } = {}) {
    this.state = 'gone';
    this.unlock();
    if (instant) { this.root.remove(); return; }
    this.root.style.transition = `opacity ${FADE_TIME * 0.55}s ease`;
    this.root.style.opacity = '0';
    setTimeout(() => this.root.remove(), FADE_TIME * 550 + 50);
  }

  fade() {
    this.unlock();
    this.root.style.pointerEvents = 'none';
    this.finish();
    this.state = 'gone';
    this.root.style.transition = `opacity ${FADE_TIME}s ease`;
    this.root.style.opacity = '0';
    setTimeout(() => this.root.remove(), FADE_TIME * 1000 + 50);
  }
}
