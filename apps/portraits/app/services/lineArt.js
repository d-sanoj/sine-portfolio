// A cartoon photo -> line art: pieces drawn with a pen, in the image's pixels.
//
//   thin dark strokes   (the ink lines)          -> their centre-lines
//   thick dark shapes   (hair, beard, pupils)    -> their outlines (holes in them too)
import { loadLuma, blur3, closing } from './image.js';
import { thickPart, dropSpecks, grow, describe } from './morphology.js';
import { thin, chains } from './skeleton.js';
import { contours } from './contours.js';

export const DEFAULT_PARAMS = {
  height: 768, // working height in pixels
  ink: 105, // darker than this counts as ink
  line: 14, // a thin line this much darker than its surroundings counts too ...
  lineMax: 150, // ... if it is not lighter than this
  thick: 15, // ink at least this wide (px) is a shape (hair, beard) outlined; thinner is a stroke, drawn as one line (marker lettering)
  minPiece: 12, // pieces shorter than this (px) are dropped
  bridge: 1.6, // gaps up to about twice this (px) inside a stroke are closed
  barWidth: 18, // a thick mark narrower than this (px) and ...
  barLength: 3.2, // ... this many times longer than wide is drawn as one line, not outlined
  smooth: 2, // moving-average radius along each piece
  dotMax: 300, // a compact mark up to this many pixels across the area is a dot (an i, a full stop): drawn as a small loop
};

const len = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };

function smooth(pts, closed, r) {
  const n = pts.length;
  if (r < 1 || n < 2 * r + 2) return pts;
  return pts.map((p, i) => {
    if (!closed && (i === 0 || i === n - 1)) return p;
    let sx = 0, sy = 0, c = 0;
    for (let d = -r; d <= r; d++) {
      let j = i + d;
      if (closed) j = (j + n) % n; else if (j < 0 || j >= n) continue;
      sx += pts[j][0]; sy += pts[j][1]; c++;
    }
    return [sx / c, sy / c];
  });
}

const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]);
};
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = segDist(pts[i], pts[a], pts[b]); if (d > md) { md = d; mi = i; } }
    if (md > eps) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// url -> { W, H, pieces: [{ pts, closed }] } in pixels (y down)
export async function lineArt(url, params = {}) {
  const P = { ...DEFAULT_PARAMS, ...params };
  const { W, H, luma, rgb } = await loadLuma(url, P.height);
  const soft = blur3(luma, W, H);
  const ink = new Uint8Array(W * H);
  const closed = closing(soft, W, H, 4);
  for (let i = 0; i < W * H; i++) ink[i] = soft[i] < P.ink || (closed[i] - soft[i] > P.line && soft[i] < P.lineMax) ? 1 : 0;
  // a clear border keeps the walkers in bounds
  for (let x = 0; x < W; x++) { ink[x] = 0; ink[(H - 1) * W + x] = 0; }
  for (let y = 0; y < H; y++) { ink[y * W] = 0; ink[y * W + W - 1] = 0; }

  // thick shapes: ink that a disc P.thick pixels wide fits inside
  const shapes = dropSpecks(thickPart(ink, W, H, P.thick), W, H, 30);
  // narrow, long thick marks (eyebrows, creases) become one line; big masses (hair, beard) keep their outline
  const big = shapes.slice();
  for (const c of describe(shapes, W, H)) {
    if (c.width < P.barWidth && c.elongation > P.barLength) for (const p of c.pixels) big[p] = 0;
  }
  // strokes: the rest of the ink, ignoring the thin margin hugging the shapes
  const halo = grow(big, W, H, 2);
  const strokes = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) strokes[i] = ink[i] && !halo[i] ? 1 : 0;
  // close small breaks (the translucent lenses of glasses break their frames into pieces)
  const joined = grow(dropSpecks(strokes, W, H, 6), W, H, P.bridge);
  for (let i = 0; i < W * H; i++) joined[i] = joined[i] && !halo[i] ? 1 : 0;
  for (let x = 0; x < W; x++) { joined[x] = 0; joined[(H - 1) * W + x] = 0; }
  for (let y = 0; y < H; y++) { joined[y * W] = 0; joined[y * W + W - 1] = 0; }
  const strokesClean = dropSpecks(joined, W, H, 30);

  // dots: compact little marks, which thinning would shrink to nothing
  const dots = [];
  for (const c of describe(strokesClean, W, H)) {
    if (c.area < 18 || c.area > P.dotMax || c.elongation > 2.6) continue;
    let sx = 0, sy = 0;
    for (const m of c.pixels) { sx += m % W; sy += (m / W) | 0; }
    const r = Math.max(2.5, Math.sqrt(c.area / Math.PI) - P.bridge);
    const cx = sx / c.area, cy = sy / c.area;
    const pts = [];
    for (let k = 0; k < 12; k++) pts.push([cx + r * Math.cos((2 * Math.PI * k) / 12), cy + r * Math.sin((2 * Math.PI * k) / 12)]);
    dots.push({ pts, closed: true, dot: true });
  }
  thin(strokesClean, W, H);

  const pieces = [];
  for (const c of chains(strokesClean, W, H, { spur: 6 })) pieces.push(c);
  for (const d of dots) pieces.push(d);
  for (const loop of contours(big, W, H)) pieces.push({ pts: loop, closed: true });

  const out = [];
  for (const p of pieces) {
    if (!p.dot && len(p.pts) < P.minPiece) continue;
    const pts = rdp(smooth(p.pts, p.closed, P.smooth), 0.6);
    if (pts.length < 2 || (p.closed && pts.length < 3)) continue;
    out.push({ pts, closed: p.closed });
  }
  return { W, H, rgb, ink, pieces: out, params: P, masks: P.debug ? { ink, big, strokes: strokesClean } : null };
}
