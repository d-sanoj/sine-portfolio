// The outline of every shape in a binary mask, as closed polylines (marching squares).
// Points sit halfway between ink and non-ink pixels, in pixel coordinates.

export function contours(mask, W, H) {
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : mask[y * W + x]);
  // an edge midpoint is named by the pixel it starts at and its direction
  const hKey = (x, y) => y * (W + 1) * 2 + x * 2; // between (x,y) and (x+1,y)
  const vKey = (x, y) => y * (W + 1) * 2 + x * 2 + 1; // between (x,y) and (x,y+1)
  const pos = new Map();
  const adj = new Map();
  const link = (a, b) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  };
  for (let y = -1; y < H; y++) {
    for (let x = -1; x < W; x++) {
      const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
      const c = tl * 8 + tr * 4 + br * 2 + bl;
      if (c === 0 || c === 15) continue;
      const T = hKey(x, y), R = vKey(x + 1, y), B = hKey(x, y + 1), L = vKey(x, y);
      for (const [k, px, py] of [[T, x + 0.5, y], [R, x + 1, y + 0.5], [B, x + 0.5, y + 1], [L, x, y + 0.5]]) pos.set(k, [px, py]);
      switch (c) {
        case 1: link(L, B); break;
        case 2: link(B, R); break;
        case 3: link(L, R); break;
        case 4: link(T, R); break;
        case 5: link(T, R); link(L, B); break;
        case 6: link(T, B); break;
        case 7: link(T, L); break;
        case 8: link(T, L); break;
        case 9: link(T, B); break;
        case 10: link(T, L); link(B, R); break;
        case 11: link(T, R); break;
        case 12: link(L, R); break;
        case 13: link(B, R); break;
        case 14: link(L, B); break;
        default: break;
      }
    }
  }
  // follow the links into closed loops
  const used = new Set();
  const loops = [];
  for (const start of adj.keys()) {
    if (used.has(start)) continue;
    const pts = [];
    let prev = -1, cur = start;
    while (cur !== undefined && !used.has(cur)) {
      used.add(cur);
      pts.push(pos.get(cur));
      const next = adj.get(cur).find((n) => n !== prev && !used.has(n));
      prev = cur;
      cur = next;
    }
    if (pts.length > 3) loops.push(pts);
  }
  return loops;
}
