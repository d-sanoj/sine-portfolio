// Line-art pieces -> one closed sine curve (with the stretches where the pen only
// travels recorded as gaps), the same idea as a glyph but with many more waves.
import { Sine } from '/core/index.js';

export const FIT = {
  samples: 32768, // points taken around the loop
  maxFreq: 4000, // highest frequency analysed, each way
  keep: 2200, // sine terms kept
  bridge: 0.004, // pen travel shorter than this (drawing heights) stays drawn: pieces that touch
  run: 0.02, // the pen runs straight on this far before turning toward the next piece
  margin: 0.03, // room kept around the drawing, as a share of its larger side
};

// The frame of a drawing: the box that holds all its pieces (pixels, y down), with a little room.
export function frameOf(pieces, margin = FIT.margin) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pieces) for (const [x, y] of p.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const pad = margin * Math.max(x1 - x0, y1 - y0);
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

// pieces in pixels (y down) -> normalised: the frame is 1 tall, its centre is the origin, y up
export function normalise(pieces, frame) {
  const d = frame.y1 - frame.y0, cx = (frame.x0 + frame.x1) / 2, cy = (frame.y0 + frame.y1) / 2;
  return pieces.map((p) => ({
    closed: p.closed,
    pts: p.pts.map(([x, y]) => [(x - cx) / d, (cy - y) / d]),
  }));
}

export function fitPortrait(pieces, opts = {}) {
  const O = { ...FIT, ...opts };
  const frame = frameOf(pieces, O.margin);
  const strokes = normalise(pieces, frame);
  const route = Sine.routeGlyph(strokes, { bridge: O.bridge, run: O.run });
  const spec = Sine.fitRoute(route, O.samples, O.maxFreq);
  // raw amplitudes: the smoothing used for letters would blur the fine detail away
  const terms = Sine.select(spec, O.keep, 0, false);
  // the portrait fills its frame; it begins as a circle as wide as the frame is tall, in the middle of it
  const w = (frame.x1 - frame.x0) / (frame.y1 - frame.y0);
  return { terms, gaps: spec.gaps, box: [-w / 2, -0.5, w / 2, 0.5].map((n) => +n.toFixed(4)), circle: 0.5, pieces: strokes.length, route, frame, samples: O.samples };
}
