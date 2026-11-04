// Starter shapes: draw a character in a system font, thin it to a one-pixel
// centerline, and turn that into a few editable points per stroke.
// Output is in the editor's world space (ems, y up, baseline at 0).
export const Trace = (() => {
  const EM = 420; // px per em while tracing
  const PADX = 0.15; // left margin in ems
  const BASE = 1.0; // baseline distance from the top, in ems
  const W = Math.round(EM * 1.5);
  const H = Math.round(EM * 1.5);
  const SPUR = 0.05; // branches shorter than this (ems) that end in a tip are noise
  const SMALL = 0.45; // marks smaller than this (ems) are small: their real strokes are short
  const SPUR_SMALL = 0.015; // so only tiny branches count as noise there
  let spurNow = SPUR;
  const EPS = 0.006; // point simplification tolerance (ems)
  const EXTEND = 0.025; // thinning eats the tips of strokes; give that back (ems)

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const cx = canvas.getContext('2d', { willReadFrequently: true });

  // 8 neighbours, orthogonal first so walks prefer straight steps.
  const OFFS = [-W, 1, W, -1, -W + 1, W + 1, W - 1, -W - 1];

  function render(ch, family, weight) {
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = '#000';
    cx.font = `${weight} ${EM}px ${family}`;
    cx.textBaseline = 'alphabetic';
    cx.fillText(ch, PADX * EM, BASE * EM);
    const d = cx.getImageData(0, 0, W, H).data;
    const img = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) img[i] = d[4 * i + 3] > 110 ? 1 : 0;
    // keep a clear border so neighbour lookups stay in bounds
    for (let x = 0; x < W; x++) { img[x] = 0; img[(H - 1) * W + x] = 0; }
    for (let y = 0; y < H; y++) { img[y * W] = 0; img[y * W + W - 1] = 0; }
    return img;
  }

  // Thinning can erase a small round blob completely, so dots (the dot of i,
  // periods, colons) are taken out first and drawn as little circles.
  function extractDots(img) {
    const seen = new Uint8Array(W * H);
    const dots = [];
    for (let i = 0; i < W * H; i++) {
      if (!img[i] || seen[i]) continue;
      const comp = [i];
      seen[i] = 1;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let h = 0; h < comp.length; h++) {
        const x = comp[h] % W, y = (comp[h] / W) | 0;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        for (const o of OFFS) {
          const m = comp[h] + o;
          if (img[m] && !seen[m]) { seen[m] = 1; comp.push(m); }
        }
      }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      if (Math.max(w, h) <= 0.13 * EM && Math.min(w, h) / Math.max(w, h) >= 0.6) {
        for (const m of comp) img[m] = 0;
        const r = Math.min(0.06 * EM, Math.max(0.02 * EM, Math.sqrt(comp.length / Math.PI) * 0.8));
        dots.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, r });
      }
    }
    return dots;
  }

  // Zhang-Suen thinning.
  function thin(img) {
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

  // Moving average, ends fixed (open) or wrapped (closed).
  function smooth(pts, closed, r = 2) {
    const n = pts.length;
    if (n < 2 * r + 2) return pts;
    return pts.map((p, i) => {
      if (!closed && (i === 0 || i === n - 1)) return p;
      let sx = 0, sy = 0, c = 0;
      for (let d = -r; d <= r; d++) {
        let j = i + d;
        if (closed) j = (j + n) % n;
        else if (j < 0 || j >= n) continue;
        sx += pts[j][0]; sy += pts[j][1]; c++;
      }
      return [sx / c, sy / c];
    });
  }

  const segDist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]);
  };
  function douglasPeucker(pts, eps) {
    if (pts.length < 3) return pts;
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let md = 0, mi = -1;
      for (let i = a + 1; i < b; i++) {
        const d = segDist(pts[i], pts[a], pts[b]);
        if (d > md) { md = d; mi = i; }
      }
      if (md > eps) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  function simplify(pts, closed, eps) {
    if (!closed) return douglasPeucker(pts, eps);
    // split the loop at its farthest point so both halves are open runs
    let m = 0, md = -1;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
      if (d > md) { md = d; m = i; }
    }
    const first = douglasPeucker(pts.slice(0, m + 1), eps);
    const second = douglasPeucker(pts.slice(m).concat([pts[0]]), eps);
    return first.concat(second.slice(1, -1));
  }

  // The very tip of a thinned stroke is unreliable: it hooks toward the cut of the
  // stroke. Trim the last bit away, read the direction from the clean stretch
  // behind it, and run a straight tip out to where the stroke really ends.
  function extend(pts, atStart, ext) {
    const path = atStart ? pts.slice().reverse() : pts.slice(); // tip is last
    const trim = 0.03 * EM, win = 0.07 * EM;
    let len = 0;
    for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    let kept = path;
    if (len > 4 * trim) {
      let acc = 0, cut = path.length - 1;
      while (cut > 0 && acc < trim) {
        acc += Math.hypot(path[cut][0] - path[cut - 1][0], path[cut][1] - path[cut - 1][1]);
        cut--;
      }
      kept = path.slice(0, cut + 1);
    }
    const a = kept[kept.length - 1];
    let b = kept[0], acc = 0;
    for (let i = kept.length - 1; i > 0; i--) {
      acc += Math.hypot(kept[i][0] - kept[i - 1][0], kept[i][1] - kept[i - 1][1]);
      if (acc >= win) { b = kept[i - 1]; break; }
    }
    const dx = a[0] - b[0], dy = a[1] - b[1];
    const L = Math.hypot(dx, dy);
    const back = kept === path ? 0 : trim; // distance already removed
    if (L) kept = kept.concat([[a[0] + (dx / L) * (back + ext), a[1] + (dy / L) * (back + ext)]]);
    const res = atStart ? kept.reverse() : kept;
    pts.length = 0;
    res.forEach((p) => pts.push(p));
  }

  function centerlines(img) {
    const sk = img;
    const n = W * H;
    // tiny specks (the dots of i, j, colons, periods) become small loops up front
    const specks = [];
    const speck = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (!sk[i] || speck[i]) continue;
      const comp = [i];
      speck[i] = 1;
      for (let h = 0; h < comp.length; h++) {
        for (const o of OFFS) {
          const m = comp[h] + o;
          if (sk[m] && !speck[m]) { speck[m] = 1; comp.push(m); }
        }
      }
      if (comp.length < 8) {
        let sx = 0, sy = 0;
        for (const m of comp) { sx += m % W; sy += (m / W) | 0; sk[m] = 0; }
        const x = sx / comp.length, y = sy / comp.length, r = 0.04 * EM;
        specks.push({ pts: [[x, y - r], [x + r, y], [x, y + r], [x - r, y]], closed: true });
      }
    }
    // classify each skeleton pixel
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
    const spurPx = spurNow * EM;
    paths = paths.filter((p) => {
      if (polyLen(p.pts) >= spurPx) return true;
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
    const out = specks.concat(paths.map((p) => {
      const closed = p.a >= 0 && p.a === p.b && p.pts.length > 6;
      const pts = closed ? p.pts.slice(0, -1) : p.pts.slice();
      if (!closed) {
        if (nodes[p.a].kind === 'end') extend(pts, true, EXTEND * EM);
        if (p.b < 0 || nodes[p.b].kind === 'end') extend(pts, false, EXTEND * EM);
      }
      return { pts, closed };
    }));
    // rings and dots that never touched a node
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
      if (comp.length < 8) {
        let sx = 0, sy = 0;
        for (const m of comp) { sx += m % W; sy += (m / W) | 0; }
        const x = sx / comp.length, y = sy / comp.length, r = 0.04 * EM;
        out.push({ pts: [[x, y - r], [x + r, y], [x, y + r], [x - r, y]], closed: true });
        continue;
      }
      // walk the ring
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

  // Two symbols are pure geometry and too small for a raster centerline to get right,
  // so they are built from the size the font draws them at: box = { l, r, b, t } in ems.
  const OVERRIDES = {
    '\u00d7': (b) => [ // multiplication sign: two crossing lines
      { pts: [[b.l, b.t], [b.r, b.b]], closed: false },
      { pts: [[b.l, b.b], [b.r, b.t]], closed: false },
    ],
    '\u00a4': (b) => { // currency sign: a ring with four ticks
      const cx = (b.l + b.r) / 2, cv = (b.b + b.t) / 2, R = Math.min(b.r - b.l, b.t - b.b) / 2, r = R * 0.55;
      const ring = [];
      for (let k = 0; k < 16; k++) ring.push([cx + Math.cos((k / 16) * Math.PI * 2) * r, cv + Math.sin((k / 16) * Math.PI * 2) * r]);
      const ticks = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => ({
        pts: [[cx + sx * r * 0.7071, cv + sy * r * 0.7071], [cx + sx * R * 0.9, cv + sy * R * 0.9]], closed: false,
      }));
      return [{ pts: ring, closed: true }, ...ticks];
    },
  };

  // { strokes: [{ pts: [[x, v], ...], closed }], adv } in world space.
  // adv is the font's own advance width, so script fonts keep the spacing
  // they were designed with. x = 0 is the pen origin.
  function raw(ch, family, weight) {
    const img = render(ch, family, weight);
    const adv = +(cx.measureText(ch).width / EM).toFixed(4);
    // size of the ink decides how short a real stroke may be (the arms of an x or +)
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (let i = 0; i < W * H; i++) if (img[i]) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    spurNow = Math.max(x1 - x0, y1 - y0) / EM < SMALL ? SPUR_SMALL : SPUR;
    if (OVERRIDES[ch]) {
      const inset = 0.006;
      const w = (x, y) => [+(x / EM - PADX).toFixed(4), +(BASE - y / EM).toFixed(4)];
      const [l, t] = w(x0, y0), [r, bt] = w(x1, y1);
      return { adv, strokes: OVERRIDES[ch]({ l: l + inset, r: r - inset, b: bt + inset, t: t - inset }) };
    }
    const dots = extractDots(img);
    thin(img);
    const strokes = [];
    for (const d of dots) {
      const pts = [];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        pts.push([+((d.x + Math.cos(a) * d.r) / EM - PADX).toFixed(4), +(BASE - (d.y + Math.sin(a) * d.r) / EM).toFixed(4)]);
      }
      strokes.push({ pts, closed: true });
    }
    for (const s of centerlines(img)) {
      const world = s.pts.map(([x, y]) => [x / EM - PADX, BASE - y / EM]);
      const pts = simplify(smooth(world, s.closed), s.closed, EPS)
        .map(([x, v]) => [+x.toFixed(4), +v.toFixed(4)]);
      if (pts.length < 2 || (s.closed && pts.length < 3)) continue;
      strokes.push({ pts, closed: s.closed });
    }
    // read left to right, like writing
    strokes.sort((a, b) => Math.min(...a.pts.map((p) => p[0])) - Math.min(...b.pts.map((p) => p[0])));
    return { strokes, adv };
  }

  // How far the font leans: x moves this much per unit of height. Measured on
  // the steep parts of a few tall letters; the median keeps loops from skewing it.
  const slantCache = new Map();
  function slantOf(family, weight) {
    const key = family + '|' + weight;
    if (slantCache.has(key)) return slantCache.get(key);
    const samples = [];
    for (const ch of 'lhkbdtpfyqj') {
      for (const st of raw(ch, family, weight).strokes) {
        for (let i = 1; i < st.pts.length; i++) {
          const dx = st.pts[i][0] - st.pts[i - 1][0], dv = st.pts[i][1] - st.pts[i - 1][1];
          const len = Math.hypot(dx, dv);
          if (len > 0.03 && Math.abs(dv) > 1.7 * Math.abs(dx)) samples.push([dx / dv, len]);
        }
      }
    }
    samples.sort((a, b) => a[0] - b[0]);
    const total = samples.reduce((s, q) => s + q[1], 0);
    let acc = 0, slant = 0;
    for (const [v, w] of samples) { acc += w; if (acc >= total / 2) { slant = v; break; } }
    slantCache.set(key, slant);
    return slant;
  }

  // upright = true straightens a leaning font: x' = x - slant * height.
  function glyph(ch, family, weight, upright = true) {
    const g = raw(ch, family, weight);
    if (!upright) return g;
    const s = slantOf(family, weight);
    if (Math.abs(s) < 0.02) return g;
    return {
      adv: g.adv,
      strokes: g.strokes.map((st) => ({ closed: st.closed, pts: st.pts.map(([x, v]) => [+(x - s * v).toFixed(4), v]) })),
    };
  }

  // Letter heights of a font, in ems: capitals, small letters, tall letters, descenders.
  function metrics(family, weight) {
    cx.font = `${weight} ${EM}px ${family}`;
    const up = (ch) => cx.measureText(ch).actualBoundingBoxAscent / EM;
    const down = (ch) => cx.measureText(ch).actualBoundingBoxDescent / EM;
    const r = (n) => +n.toFixed(3);
    return { cap: r(up('H')), x: r(up('x')), asc: r(up('d')), desc: r(down('p')) };
  }

  return { glyph, slantOf, metrics };
})();
