// Where a letter's join starts (in) and ends (out), and where the next letter
// begins (adv). Stored on the glyph once dragged; otherwise guessed from its points.

export function bbox(gl) {
  let minX = Infinity, maxX = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const st of gl.strokes) for (const [x, v] of st.pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  return isFinite(minX) ? { minX, maxX, minV, maxV } : null;
}

function autoAnchors(gl) {
  const pts = [];
  for (const st of gl.strokes) if (st.pts.length > 1) pts.push(...st.pts);
  if (!pts.length) return null;
  let minX = Infinity, maxX = -Infinity;
  for (const [x] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  const lowest = (list) => list.reduce((a, b) => (b[1] < a[1] ? b : a));
  return {
    in: lowest(pts.filter((p) => p[0] <= minX + 0.03)),
    out: lowest(pts.filter((p) => p[0] >= maxX - 0.03)),
    adv: maxX + 0.06,
  };
}

// { in: [x, v], out: [x, v], adv } or null for an empty glyph
export function anchorsOf(gl) {
  const a = autoAnchors(gl);
  if (!a) return null;
  return { in: gl.in || a.in, out: gl.out || a.out, adv: gl.adv != null ? gl.adv : a.adv };
}
