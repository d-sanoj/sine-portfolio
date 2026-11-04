// Links: the system cursor becomes a hand over them, they light up, and a click follows them.
export class LinkController {
  constructor(canvas, view, model, play) {
    this.canvas = canvas;
    this.view = view;
    this.model = model;
    this.play = play;
    this.pointer = null; // where the pointer last was: { x, y } in screen pixels, or null when it is not over the page
    canvas.addEventListener('pointermove', (e) => { this.pointer = { x: e.clientX, y: e.clientY }; this.onMove(e); });
    canvas.addEventListener('click', (e) => this.onClick(e));
    // Whether the pointer is on a link can change without the pointer moving: the page scrolls (wheel, trackpad,
    // keyboard) or changes size under it, or the pointer leaves the window. So it is checked again then too.
    window.addEventListener('scroll', () => this.recheck(), { passive: true });
    window.addEventListener('resize', () => this.recheck());
    window.addEventListener('mouseout', (e) => { if (!e.relatedTarget) this.leave(); }); // out of the window
    document.documentElement.addEventListener('mouseleave', () => this.leave());
    // Another tab or window takes over (or the page is hidden): nothing is hovered for now, but the pointer may well be
    // where it was when the page comes back (a keyboard shortcut moves no pointer), so where it was is kept and checked again.
    const away = () => this.set(-1);
    const back = () => this.recheck();
    window.addEventListener('blur', away);
    window.addEventListener('focus', back);
    window.addEventListener('pageshow', back);
    document.addEventListener('visibilitychange', () => (document.hidden ? away() : back()));
  }

  linkAtPoint(x, y) {
    const p = this.view.toPage(x, y);
    return this.model.links.find((l) => p.x >= l.box[0] && p.x <= l.box[2] && p.v >= l.box[1] && p.v <= l.box[3]);
  }

  linkAt(e) { return this.linkAtPoint(e.clientX, e.clientY); }

  set(word) {
    this.canvas.style.cursor = word >= 0 ? 'pointer' : 'default'; // the system's own cursor: a hand over a link
    if (word === this.view.hover) return;
    this.view.hover = word;
    if (this.play.done) this.play.redraw();
  }

  onMove(e) {
    const l = this.linkAt(e);
    this.set(l ? l.word : -1);
  }

  // the pointer has not moved, but what is under it may have
  recheck() {
    if (!this.pointer) return;
    const l = this.linkAtPoint(this.pointer.x, this.pointer.y);
    this.set(l ? l.word : -1);
  }

  // the pointer is no longer over the page
  leave() {
    this.pointer = null;
    this.set(-1);
  }

  onClick(e) {
    const l = this.linkAt(e);
    if (!l) return;
    follow(l.href, this.model.anchors, this.view.geo.em);
  }
}

// Where a link goes. Only ordinary web, mail and phone links and pages of this site are followed.
function follow(href, anchors, em) {
  if (href[0] === '#') { // somewhere further down this page
    const v = anchors[href.slice(1)];
    if (v !== undefined) window.scrollTo({ top: -v * em, behavior: 'smooth' });
  } else if (/^(https?:|mailto:|tel:)/i.test(href)) {
    window.open(href, '_blank', 'noopener'); // other sites open in a new tab
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    window.location.assign(new URL(href, window.location.href)); // a page of this site
  }
}
