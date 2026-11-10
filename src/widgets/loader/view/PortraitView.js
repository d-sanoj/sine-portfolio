// Drawing one portrait on a canvas at a given progress and pose.
import { Morph } from '/core/index.js';
import { INK, MAX_FRACTION, FILL, MAX_PIXEL_RATIO } from '../config.js';

export class PortraitView {
  // root: the element the canvas fills
  constructor(root) {
    this.root = root;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    root.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.resize();
  }

  resize() {
    // everything here moves, so a very sharp screen is drawn a little less sharp: far fewer pixels to fill every frame
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    this.dpr = dpr;
    this.w = this.root.clientWidth || window.innerWidth;
    this.h = this.root.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.done = null; // the finished portrait as a picture (see draw)
  }

  // An area's colour as a gradient along its axis: its mean colour where the shading is not in yet, the waves where it is.
  gradientFor(g, area, amount, ox, oy, s) {
    const [x0, v0, x1, v1] = area.shade.axis;
    const grad = g.createLinearGradient(ox + x0 * s, oy - v0 * s, ox + x1 * s, oy - v1 * s);
    const n = area.shade.stops.length - 1;
    area.shade.stops.forEach((c, i) => {
      const m = area.mean;
      grad.addColorStop(i / n, `rgb(${Math.round(m[0] + (c[0] - m[0]) * amount)},${Math.round(m[1] + (c[1] - m[1]) * amount)},${Math.round(m[2] + (c[2] - m[2]) * amount)})`);
    });
    return grad;
  }

  // The small coloured circles the portrait has become once it has dissolved (progress 0), where they sit on the
  // screen: [{ x, y, r, rgb }] in pixels. The page takes them over to turn them into its letters.
  dotsAt(item, pose) {
    if (!item.fills) return [];
    const [x0, v0, x1, v1] = item.box;
    const { s } = pose;
    const ox = pose.cx - ((x0 + x1) / 2) * s, oy = pose.cy + ((v0 + v1) / 2) * s;
    const dots = [];
    for (const area of item.fills) {
      for (const curve of area.curves) {
        const { xy } = Morph.shape(curve, 0.0001);
        const n = xy.length / 2 - 1;
        let cx = 0, cy = 0;
        for (let j = 0; j < n; j++) { cx += xy[2 * j]; cy += xy[2 * j + 1]; }
        dots.push({ x: ox + (cx / n) * s, y: oy - (cy / n) * s, r: curve.circle * s, rgb: area.mean });
      }
    }
    return dots;
  }

  // A pose says where the portrait's centre goes (cx, cy, in canvas pixels) and how
  // many pixels one picture-height is (s). This one fits the portrait inside a rectangle.
  fit(item, { x, y, w, h }) {
    const [x0, v0, x1, v1] = item.box;
    const s = Math.min(w / (x1 - x0), h / (v1 - v0));
    return { cx: x + w / 2, cy: y + h / 2, s };
  }

  // the loader's pose: most of the screen
  fullPose(item) {
    return this.fit(item, { x: (this.w * (1 - MAX_FRACTION.w)) / 2, y: (this.h * (1 - MAX_FRACTION.h)) / 2, w: this.w * MAX_FRACTION.w, h: this.h * MAX_FRACTION.h });
  }

  // item: { curve, box }; progress: 0 = circle, 1 = finished portrait
  draw(item, progress, pose = null) {
    // The finished portrait does not change while it is held, so it is painted once on a canvas of its own and that picture is
    // shown each frame, instead of filling a few hundred shapes again.
    if (progress >= 1 && !pose) {
      if (!this.done || this.done.item !== item) {
        const canvas = document.createElement('canvas');
        canvas.width = this.canvas.width;
        canvas.height = this.canvas.height;
        const cg = canvas.getContext('2d');
        cg.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.paint(cg, item, 1, this.fullPose(item));
        this.done = { item, canvas };
      }
      this.g.setTransform(1, 0, 0, 1, 0, 0);
      this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.g.drawImage(this.done.canvas, 0, 0);
      this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      return;
    }
    this.paint(this.g, item, progress, pose || this.fullPose(item));
  }

  paint(g, item, progress, pose) {
    const { w, h } = this;
    g.clearRect(0, 0, w, h);
    const [x0, v0, x1, v1] = item.box;
    const { s } = pose;
    const ox = pose.cx - ((x0 + x1) / 2) * s, oy = pose.cy + ((v0 + v1) / 2) * s;
    // the colour inside: solid areas, each forming from a small circle the way the outline forms from the big one
    if (item.fills) {
      const p = Math.max(0.0001, Math.min(1, progress)) ** FILL.lag; // a little behind the outline
      // the shading (the waves along an area's axis) comes in as its shape does: a small circle is one flat colour
      const shading = Math.min(1, Math.max(0, (p - 0.4) / 0.6));
      for (const area of item.fills) {
        g.fillStyle = area.shade && shading > 0 ? this.gradientFor(g, area, shading, ox, oy, s) : area.css;
        g.beginPath();
        for (const curve of area.curves) {
          const q = Math.max(0.0001, Math.min(1, (p - curve.delay) / (1 - curve.delay)));
          const { xy } = Morph.shape(curve, q);
          for (let j = 0; j < xy.length / 2; j++) {
            const px = ox + xy[2 * j] * s, py = oy - xy[2 * j + 1] * s;
            j ? g.lineTo(px, py) : g.moveTo(px, py);
          }
          g.closePath();
        }
        g.fill('evenodd');
      }
    }
    const { xy, hide, runs = item.curve.runs } = Morph.shape(item.curve, Math.max(0.0001, Math.min(1, progress)));
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = INK;
    g.lineWidth = Math.max(1.1, s * 0.0024);
    for (const run of runs) {
      if (run.hidden && hide >= 1) continue;
      // the stretches where the pen only travels show faint while the portrait forms, then fade
      g.globalAlpha = run.hidden ? 0.28 * (1 - hide) : 1;
      g.setLineDash(run.hidden ? [s * 0.006, s * 0.012] : []);
      g.beginPath();
      for (let j = run.a; j <= run.b; j++) {
        const px = ox + xy[2 * j] * s, py = oy - xy[2 * j + 1] * s;
        j === run.a ? g.moveTo(px, py) : g.lineTo(px, py);
      }
      g.stroke();
    }
    g.setLineDash([]);
    g.globalAlpha = 1;
  }
}
