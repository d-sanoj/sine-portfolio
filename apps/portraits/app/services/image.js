// Loading a photo as grey levels at a working size.
export async function loadLuma(url, height) {
  const blob = await (await fetch(url, { cache: 'no-store' })).blob();
  const bmp = await createImageBitmap(blob);
  const scale = height / bmp.height;
  const W = Math.round(bmp.width * scale), H = height;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const luma = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) luma[i] = 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2];
  return { W, H, luma, rgb: d };
}

// A light 3x3 blur, to calm noise before thresholding.
export function blur3(luma, W, H) {
  const out = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      out[i] = (luma[i - W - 1] + luma[i - W] + luma[i - W + 1] + luma[i - 1] + luma[i] * 2 + luma[i + 1] + luma[i + W - 1] + luma[i + W] + luma[i + W + 1]) / 10;
    }
  }
  return out;
}

// Grey-level closing with a square window (r pixels each way): fills in thin dark
// lines. closing - original is large exactly where a thin dark line is, however
// light that line is (the "black top-hat").
export function closing(luma, W, H, r) {
  const pass = (src, horizontal, take) => {
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let best = take === 'max' ? -1 : 1e9;
        for (let d = -r; d <= r; d++) {
          const xx = horizontal ? x + d : x, yy = horizontal ? y : y + d;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const v = src[yy * W + xx];
          if (take === 'max' ? v > best : v < best) best = v;
        }
        out[y * W + x] = best;
      }
    }
    return out;
  };
  let a = pass(luma, true, 'max');
  a = pass(a, false, 'max');
  a = pass(a, true, 'min');
  return pass(a, false, 'min');
}
