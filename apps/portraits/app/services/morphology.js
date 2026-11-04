// Shapes in a binary mask: how thick is each part, and which parts are thick.
// Everything here works on Uint8Array masks (1 = ink) of W x H pixels.

const INF = 1e20;

// Squared distance from every pixel to the nearest pixel where `isTarget(i)` (Felzenszwalb).
function squaredDistance(W, H, isTarget) {
  const f = new Float64Array(Math.max(W, H));
  const d = new Float64Array(Math.max(W, H));
  const v = new Int32Array(Math.max(W, H));
  const z = new Float64Array(Math.max(W, H) + 1);
  const out = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = isTarget(i) ? 0 : INF;
  const pass = (n, get, set) => {
    for (let q = 0; q < n; q++) f[q] = get(q);
    let k = 0;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
    for (let q = 0; q < n; q++) set(q, d[q]);
  };
  for (let x = 0; x < W; x++) pass(H, (y) => out[y * W + x], (y, val) => { out[y * W + x] = val; });
  for (let y = 0; y < H; y++) pass(W, (x) => out[y * W + x], (x, val) => { out[y * W + x] = val; });
  return out;
}

// The parts of the mask at least `width` thick (an opening): everything a disc of
// diameter `width` can be rolled through. Thin strokes drop out.
export function thickPart(mask, W, H, width) {
  const r = width / 2;
  // erode: ink pixels farther than r from any non-ink pixel
  const toBackground = squaredDistance(W, H, (i) => !mask[i]);
  const core = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) core[i] = toBackground[i] > r * r ? 1 : 0;
  // dilate the core back by r
  const toCore = squaredDistance(W, H, (i) => core[i] === 1);
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = toCore[i] <= r * r ? 1 : 0;
  return out;
}

// Mask with its small connected pieces (fewer than `min` pixels) removed.
export function dropSpecks(mask, W, H, min) {
  const seen = new Uint8Array(W * H);
  const out = mask.slice();
  for (let i = 0; i < W * H; i++) {
    if (!mask[i] || seen[i]) continue;
    const comp = [i];
    seen[i] = 1;
    for (let h = 0; h < comp.length; h++) {
      const p = comp[h], x = p % W, y = (p / W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const m = ny * W + nx;
          if (mask[m] && !seen[m]) { seen[m] = 1; comp.push(m); }
        }
      }
    }
    if (comp.length < min) for (const m of comp) out[m] = 0;
  }
  return out;
}

// The mask grown outward by r pixels (a dilation).
export function grow(mask, W, H, r) {
  const toInk = squaredDistance(W, H, (i) => mask[i] === 1);
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = toInk[i] <= r * r ? 1 : 0;
  return out;
}

// How thick each connected piece of the mask is, and how elongated.
// Returns [{ pixels, area, width, elongation }]; width is twice the biggest disc that fits.
export function describe(mask, W, H) {
  const dt = squaredDistance(W, H, (i) => !mask[i]);
  const seen = new Uint8Array(W * H);
  const out = [];
  for (let i = 0; i < W * H; i++) {
    if (!mask[i] || seen[i]) continue;
    const pixels = [i];
    seen[i] = 1;
    let maxD = 0;
    for (let h = 0; h < pixels.length; h++) {
      const p = pixels[h], x = p % W, y = (p / W) | 0;
      maxD = Math.max(maxD, dt[p]);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const m = ny * W + nx;
          if (mask[m] && !seen[m]) { seen[m] = 1; pixels.push(m); }
        }
      }
    }
    const width = 2 * Math.sqrt(maxD);
    out.push({ pixels, area: pixels.length, width, elongation: pixels.length / Math.max(1, width * width) });
  }
  return out;
}
