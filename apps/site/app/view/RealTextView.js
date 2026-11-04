// The few bits of the page that are real text, not sine waves, so screen readers can read them, the keyboard can reach them and
// a click follows them (the "for accessible content click here" in the About section). The plain page marks them (data-sine-real),
// the measuring tool records where each piece sits, and here each piece is put at that place, in the page's own font, size and colour,
// in the gap the sine letters leave. They are one paragraph for a screen reader, however many rows they take on the screen.
import { LINK_YELLOW } from '../config.js';

export class RealTextView {
  constructor(view, model) {
    this.view = view;
    this.model = model;
    this.root = document.createElement('div');
    this.root.id = 'sine-real';
    this.root.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:3;opacity:0;transition:opacity 0.8s ease;';
    this.items = []; // { el, f, r, link }: the element of each piece, its numbers, and the link box it sits in (if any)
    this.links = []; // { el, frags: [f], r }: a link is a box around its pieces, so it is a real, reachable link
    const colours = model.palette || [];
    for (const r of model.real) {
      const p = document.createElement('p'); // one paragraph per marked piece of text, whatever rows it takes
      p.style.cssText = 'margin:0;';
      let group = null, prev = null;
      for (const f of r.frags) {
        // a row break swallows its space, so a space is put between pieces for a screen reader (it is not drawn: it has no width of its own)
        const gap = prev && Math.abs(prev.v - f.v) > f.h / 2 && !/\s$/.test(prev.t) && !/^\s/.test(f.t); // only where the text moved to another row
        const span = document.createElement('span');
        span.textContent = f.t;
        span.style.cssText = `position:absolute;white-space:pre;color:${colours[r.c] || 'inherit'};font-family:'Josefin Sans',system-ui,sans-serif;font-weight:${r.wt};`;
        if (f.href) {
          if (!group || group.href !== f.href) {
            if (gap) p.appendChild(document.createTextNode(' '));
            const a = document.createElement('a');
            a.href = f.href;
            a.className = 'sine-real-link';
            a.style.cssText = 'position:absolute;pointer-events:none;';
            p.appendChild(a);
            group = { el: a, href: f.href, frags: [], r };
            this.links.push(group);
          } else if (gap) {
            group.el.appendChild(document.createTextNode(' '));
          }
          span.style.pointerEvents = 'auto';
          span.style.textDecoration = 'underline';
          span.style.textDecorationColor = LINK_YELLOW;
          span.style.textDecorationThickness = '1px';
          span.style.textUnderlineOffset = '0.22em';
          group.el.appendChild(span);
          group.frags.push({ el: span, f });
        } else {
          group = null;
          if (gap) p.appendChild(document.createTextNode(' '));
          p.appendChild(span);
          this.items.push({ el: span, f, r });
        }
        prev = f;
      }
      this.root.appendChild(p);
    }
    for (const g of this.links) g.el.setAttribute('aria-label', g.frags.map(({ f }) => f.t.trim()).join(' ')); // its name for a screen reader: its own words
    if (this.items.length || this.links.length) document.body.appendChild(this.root);
  }

  // put every piece where the sine letters around it expect it (call after the page's geometry changes)
  place() {
    const { em, ox, oy } = this.view.geo;
    const style = (el, f, r) => {
      el.style.fontSize = (r.fs * em).toFixed(2) + 'px';
      el.style.letterSpacing = (r.ls * em).toFixed(2) + 'px';
      el.style.lineHeight = (f.h * em).toFixed(2) + 'px';
    };
    for (const { el, f, r } of this.items) {
      el.style.left = (ox + f.x * em).toFixed(2) + 'px';
      el.style.top = (oy - f.v * em).toFixed(2) + 'px';
      style(el, f, r);
    }
    for (const g of this.links) { // the link is a box around its pieces; the pieces sit inside it
      const x0 = Math.min(...g.frags.map(({ f }) => f.x)), x1 = Math.max(...g.frags.map(({ f }) => f.x + f.w));
      const top = Math.max(...g.frags.map(({ f }) => f.v)), bottom = Math.min(...g.frags.map(({ f }) => f.v - f.h));
      g.el.style.left = (ox + x0 * em).toFixed(2) + 'px';
      g.el.style.top = (oy - top * em).toFixed(2) + 'px';
      g.el.style.width = ((x1 - x0) * em).toFixed(2) + 'px';
      g.el.style.height = ((top - bottom) * em).toFixed(2) + 'px';
      for (const { el, f } of g.frags) {
        el.style.left = ((f.x - x0) * em).toFixed(2) + 'px';
        el.style.top = ((top - f.v) * em).toFixed(2) + 'px';
        style(el, f, g.r);
      }
    }
  }

  // the pieces fade in once the sine letters around them have formed
  show() { this.root.style.opacity = '1'; }

  // hovering a link piece counts as hovering a link of the page (the pointer is over this element, not the canvas)
  onPointerMove(handler) { this.root.addEventListener('pointermove', handler); }
}
