// The portraits being traced and what came out of each.
import { COUNT, photoUrl } from '../config.js';

export class PortraitModel {
  constructor() {
    // result: { W, H, pieces (px), fit: { terms, gaps, box, pieces }, ms } once traced
    this.items = Array.from({ length: COUNT }, (_, i) => ({ index: i, url: photoUrl(i), result: null, error: null }));
  }

  get done() { return this.items.filter((it) => it.result); }

  // the file the loader reads
  toFile() {
    return {
      format: 'sine-portraits', version: 1,
      note: 'Each portrait is one closed sine curve: s = [frequency, amplitude, phase] terms, x = sum a*cos(2*pi*f*t+p), y = sum a*sin(2*pi*f*t+p), t in 0..1; g = ranges of t that are not drawn. Units: the frame of the drawing is 1 tall, centred, y up. box = [x0, v0, x1, v1] of the frame. circle = the radius of the circle the morph begins as, centred in the frame. f = the colour inside: areas, each { c: [r, g, b] (its mean colour), s: [closed curves], g: its shading as sine waves } with every curve a series of terms in the same units, filled with the even-odd rule under the lines.',
      portraits: this.done.map((it) => ({ box: it.result.fit.box, circle: it.result.fit.circle, f: it.result.fit.regions, s: it.result.fit.terms, g: it.result.fit.gaps })),
    };
  }
}
