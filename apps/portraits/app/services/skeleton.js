// Thin ink strokes -> centre-lines. The same method the letter tracer uses
// (apps/designer/app/services/tracer.js), written for any image size:
// thin the strokes to one pixel, then walk the one-pixel lines into polylines.

const offsets = (W) => [-W, 1, W, -1, -W + 1, W + 1, W - 1, -W - 1]; // orthogonal steps first

// Zhang-Suen thinning, in place. The mask needs a clear border.
export function thin(img, W, H) {
  const rm = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      rm.length = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          if (!img[i]) continue;
          const p2 = img[i - W], p3 = img[i - W + 1], p4 = img[i + 1], p5 = img[i + W + 1];
          const p6 = img[i + W], p7 = img[i + W - 1], p8 = img[i - 1], p9 = img[i - W - 1];
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const A = (p2 === 0 && p3 === 1) + (p3 === 0 && p4 === 1) + (p4 === 0 && p5 === 1) + (p5 === 0 && p6 === 1)
            + (p6 === 0 && p7 === 1) + (p7 === 0 && p8 === 1) + (p8 === 0 && p9 === 1) + (p9 === 0 && p2 === 1);
          if (A !== 1) continue;
          if (pass === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue; }
          else if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
          rm.push(i);
        }
      }
      for (const i of rm) { img[i] = 0; changed = true; }
    }
  }
}

const polyLen = (pts) => {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
};

// One-pixel lines -> [{ pts: [[x, y], ...], closed }] in pixel coordinates.
// spur: branches shorter than this (px) that end in a tip are noise and dropped.
export function chains(sk, W, H, { spur = 6 } = {}) {
  const n = W * H;
  const OFFS = offsets(W);
  // classify each pixel
  const nbrs = new Uint8Array(n);
  const cross = new Uint8Array(n);
  for (let i = W + 1; i < n - W - 1; i++) {
    if (!sk[i]) continue;
    const ring = [sk[i - W], sk[i - W + 1], sk[i + 1], sk[i + W + 1], sk[i + W], sk[i + W - 1], sk[i - 1], sk[i - W - 1]];
    let b = 0, a = 0;
    for (let k = 0; k < 8; k++) { b += ring[k]; if (ring[k] === 0 && ring[(k + 1) % 8] === 1) a++; }
    nbrs[i] = b;
    cross[i] = a;
  }
  // nodes: tips (one neighbour) and junction clusters
  const nodeOf = new Int32Array(n).fill(-1);
  const nodes = [];
  const isJunc = (i) => sk[i] && cross[i] >= 3 && nbrs[i] >= 3;
  for (let i = 0; i < n; i++) {
    if (!sk[i] || nodeOf[i] >= 0) continue;
    if (nbrs[i] === 1) {
      nodeOf[i] = nodes.length;
      nodes.push({ x: i % W, y: (i / W) | 0, kind: 'end' });
    } else if (isJunc(i)) {
      const id = nodes.length;
      const q = [i];
      nodeOf[i] = id;
      let sx = 0, sy = 0, c = 0;
      while (q.length) {
        const p = q.pop();
        sx += p % W; sy += (p / W) | 0; c++;
        for (const o of OFFS) {
          const m = p + o;
          if (sk[m] && nodeOf[m] < 0 && isJunc(m)) { nodeOf[m] = id; q.push(m); }
        }
      }
      nodes.push({ x: sx / c, y: sy / c, kind: 'junc' });
    }
  }
  // walk the edges between nodes
  const visited = new Uint8Array(n);
  let paths = [];
  for (let p = 0; p < n; p++) {
    if (nodeOf[p] < 0) continue;
    for (const o of OFFS) {
      const q = p + o;
      if (!sk[q] || nodeOf[q] >= 0 || visited[q]) continue;
      const start = nodeOf[p];
      const pts = [[nodes[start].x, nodes[start].y]];
      let prev = p, cur = q, end = -1;
      for (;;) {
        visited[cur] = 1;
        pts.push([cur % W, (cur / W) | 0]);
        let hit = -1;
        for (const o2 of OFFS) {
          const m = cur + o2;
          if (!sk[m] || m === prev || nodeOf[m] < 0) continue;
          if (nodeOf[m] !== start || pts.length > 4) { hit = nodeOf[m]; break; }
        }
        if (hit >= 0) { end = hit; pts.push([nodes[hit].x, nodes[hit].y]); break; }
        let next = -1;
        for (const o2 of OFFS) {
          const m = cur + o2;
          if (sk[m] && !visited[m] && m !== prev && nodeOf[m] < 0) { next = m; break; }
        }
        if (next < 0) break;
        prev = cur; cur = next;
      }
      paths.push({ pts, a: start, b: end });
    }
  }
  // drop short spurs that end in a tip
  paths = paths.filter((p) => {
    if (polyLen(p.pts) >= spur) return true;
    const aEnd = nodes[p.a].kind === 'end';
    const bEnd = p.b < 0 || nodes[p.b].kind === 'end';
    const aJ = nodes[p.a].kind === 'junc';
    const bJ = p.b >= 0 && nodes[p.b].kind === 'junc';
    return !((aEnd && bJ) || (bEnd && aJ));
  });
  // join paths through junctions that now have only two ways out
  for (;;) {
    const inc = new Map();
    for (const p of paths) {
      for (const [e, nd] of [['a', p.a], ['b', p.b]]) {
        if (nd >= 0 && nodes[nd].kind === 'junc') {
          if (!inc.has(nd)) inc.set(nd, []);
          inc.get(nd).push({ p, e });
        }
      }
    }
    let did = false;
    for (const list of inc.values()) {
      if (list.length !== 2 || list[0].p === list[1].p) continue;
      const [u, v] = list;
      const first = u.e === 'b' ? u.p.pts : u.p.pts.slice().reverse();
      const from = u.e === 'b' ? u.p.a : u.p.b;
      const second = v.e === 'a' ? v.p.pts : v.p.pts.slice().reverse();
      const to = v.e === 'a' ? v.p.b : v.p.a;
      paths = paths.filter((x) => x !== u.p && x !== v.p);
      paths.push({ pts: first.concat(second.slice(1)), a: from, b: to });
      did = true;
      break;
    }
    if (!did) break;
  }
  const out = paths.map((p) => {
    const closed = p.a >= 0 && p.a === p.b && p.pts.length > 6;
    return { pts: closed ? p.pts.slice(0, -1) : p.pts.slice(), closed };
  });
  // rings that never touched a node
  const touched = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!(visited[i] || nodeOf[i] >= 0)) continue;
    touched[i] = 1;
    for (const o of OFFS) touched[i + o] = 1;
  }
  const seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!sk[i] || touched[i] || seen[i]) continue;
    const comp = [i];
    seen[i] = 1;
    for (let h = 0; h < comp.length; h++) {
      for (const o of OFFS) {
        const m = comp[h] + o;
        if (sk[m] && !touched[m] && !seen[m]) { seen[m] = 1; comp.push(m); }
      }
    }
    if (comp.length < 8) continue;
    const used = new Set();
    const pts = [];
    let cur = i, prev = -1;
    for (;;) {
      used.add(cur);
      pts.push([cur % W, (cur / W) | 0]);
      let next = -1;
      for (const o of OFFS) {
        const m = cur + o;
        if (sk[m] && !touched[m] && !used.has(m) && m !== prev) { next = m; break; }
      }
      if (next < 0) break;
      prev = cur; cur = next;
    }
    out.push({ pts, closed: true });
  }
  return out;
}
