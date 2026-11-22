#!/usr/bin/env python3
"""How many sine waves does a letter need?

Measures, for every glyph in data/source/sine-glyphs.json (161 glyphs),
how far a truncated series strays from the stored series -- the curve the
site actually draws -- as waves are removed strongest-first, the same order
the site's scroll animation adds them (src/core/animate/morph.js: shape()).

Reference: the stored series sampled at M=1000 points, visible runs only
(gaps hide pen-travel stretches, as in src/core/sine/series.js: runs()).
Truncation keeps the DC term plus the first K stored terms (stored order is
strongest-first by pre-damping magnitude; see Sine.select in series.js).
Two variants: "plain" uses the stored amplitudes as-is (exactly the curve
the site shows mid-animation), "lanczos" re-applies the Lanczos sigma
damping from Sine.select with the new kmax (what the designer would have
stored had it chosen K in the first place).

Metric: symmetric worst distance, the same "worst()" the designer's autoK
uses (apps/designer/app/model/glyphFit.js): the farthest any point of one
curve sits from the other curve. Computed as nearest-point distance with a
KD-tree over densely sampled points (M=1000); validated against the exact
point-to-segment distance on one glyph (see VALIDATION below). Units are ems;
cap height is 0.7 em, x-height 0.5 em, and the designer's own tolerance is
TOL = 0.009 em (apps/designer/app/config.js).

Caveat: stored amplitudes already carry Lanczos damping from the original K
(select() damps after sorting by strength), so "strongest-first" here means
strongest by stored order, and the lanczos variant damps twice. The plain
variant is exact -- it is literally a frame of the site's animation.

Usage: python3 measure-glyphs.py  (run from the sine-portfolio repo root)
Writes results.json next to this script.
"""
import json
import math
import os
import sys

import numpy as np
from scipy.spatial import cKDTree

REPO = os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))))
# The script lives in content/blog/blog-21-11-22-2026/; repo root is 3 up.
# Fall back to cwd if that path has no data dir.
if not os.path.isdir(os.path.join(REPO, "data")):
    REPO = os.getcwd()

M = 1000
TOL = 0.009
K_VALUES = [1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32, 48, 64, 96, 128]
FEATURED = ["o", "0", "c", "A", "M", "2", "g", "S", "a", "e", "@", "I"]


def trace(terms, m=M):
    """Same curve as Sine.trace: x = sum a*cos(2*pi*k*t+p), y likewise sin."""
    t = np.arange(m + 1) / m
    z = np.zeros(m + 1, dtype=complex)
    for k, a, p in terms:
        z += a * np.exp(1j * (2 * np.pi * k * t + p))
    return np.column_stack([z.real, z.imag])


def visible_mask(gaps, m=M):
    """True where the pen is down, mirroring Sine.runs' hiddenAt on midpoints."""
    mid = (np.arange(m) + 0.5) / m
    vis = np.ones(m, dtype=bool)
    for a, b in gaps:
        vis &= ~(((mid >= a) & (mid < b)) | ((mid + 1 >= a) & (mid + 1 < b)))
    out = np.zeros(m + 1, dtype=bool)
    out[:m] = vis
    out[m] = vis[0]  # point M == point 0 (closed curve)
    return out


def lanczos(terms):
    """Re-apply Sine.select's sigma damping to a kept set (DC untouched)."""
    kept = [t for t in terms if t[0] != 0]
    kmax = max((abs(t[0]) for t in kept), default=1)
    out = []
    for k, a, p in terms:
        if k == 0:
            out.append([k, a, p])
        else:
            x = math.pi * abs(k) / (kmax + 1)
            out.append([k, a * math.sin(x) / x, p])
    return out


def worst(ref_pts, ref_vis, tru_pts, tru_vis):
    """Symmetric worst nearest-point distance between two visible point sets."""
    r = ref_pts[ref_vis]
    t = tru_pts[tru_vis]
    d1 = cKDTree(r).query(t, workers=-1)[0].max()
    d2 = cKDTree(t).query(r, workers=-1)[0].max()
    return float(max(d1, d2))


def exact_worst(ref_pts, ref_vis, tru_pts, tru_vis):
    """Exact point-to-segment worst distance (slow; validation only)."""
    def one_dir(pts, vis, seg_pts, seg_vis):
        # segments between consecutive visible points of seg curve
        a = seg_pts[:-1][seg_vis[:-1] & seg_vis[1:]]
        b = seg_pts[1:][seg_vis[:-1] & seg_vis[1:]]
        q = pts[vis]
        best = np.full(len(q), np.inf)
        for i in range(0, len(a), 200):
            aa, bb = a[i:i + 200], b[i:i + 200]
            ab = bb - aa
            l2 = np.einsum("ij,ij->i", ab, ab)
            tt = np.clip(((q[:, None, :] - aa[None, :, :]) * ab[None, :, :]).sum(-1)
                         / np.maximum(l2[None, :], 1e-12), 0, 1)
            proj = aa[None, :, :] + tt[:, :, None] * ab[None, :, :]
            d = np.linalg.norm(q[:, None, :] - proj, axis=-1).min(axis=1)
            best = np.minimum(best, d)
        return float(best.max())
    return max(one_dir(tru_pts, tru_vis, ref_pts, ref_vis),
               one_dir(ref_pts, ref_vis, tru_pts, tru_vis))


def main():
    data = json.load(open(os.path.join(REPO, "data/source/sine-glyphs.json")))
    glyphs = data["glyphs"]
    stored_k = {ch: len(v["s"]) - 1 for ch, v in glyphs.items()}
    total_terms = sum(len(v["s"]) for v in glyphs.values())

    # --- validation: KD-tree approximation vs exact segment distance ---
    gA = glyphs["A"]
    ref = trace(gA["s"])
    vis = visible_mask(gA.get("g", []))
    tru = trace(gA["s"][:9])  # K=8 plain
    approx = worst(ref, vis, tru, vis)
    exact = exact_worst(ref, vis, tru, vis)
    print(f"VALIDATION A K=8: approx {approx:.5f} em, exact {exact:.5f} em, "
          f"ratio {approx / exact:.3f}")

    # --- main sweep ---
    per_k = {variant: {k: [] for k in K_VALUES} for variant in ("plain", "lanczos")}
    worst_plain = {k: [] for k in K_VALUES}
    plain_series = {}  # ch -> {K: worst error} for the non-monotone check
    featured = {}
    for ch, gl in sorted(glyphs.items()):
        terms = gl["s"]
        gaps = gl.get("g", [])
        vis = visible_mask(gaps)
        ref = trace(terms)
        n = len(terms) - 1  # waves besides DC
        row = {}
        for variant in ("plain", "lanczos"):
            for k in K_VALUES:
                if k >= n:
                    w = 0.0
                else:
                    kept = terms[:k + 1]
                    if variant == "lanczos":
                        kept = lanczos(kept)
                    tru = trace(kept)
                    w = worst(ref, vis, tru, vis)
                per_k[variant][k].append(w)
                if variant == "plain":
                    worst_plain[k].append((w, ch))
                    plain_series.setdefault(ch, {})[k] = w
                if ch in FEATURED:
                    row.setdefault(variant, {})[k] = w
        if ch in FEATURED:
            row["stored_waves"] = n
            featured[ch] = row
    worst5 = {str(k): [[round(w, 4), ch] for w, ch in
                       sorted(worst_plain[k], reverse=True)[:5]]
              for k in K_VALUES}
    # Non-monotone steps from K=4 on (plain): a wave can overshoot, so the
    # error sometimes rises when a wave is added. Count rises between
    # consecutive measured K values starting at 4 -> 6.
    rises = []
    for ch, series in plain_series.items():
        ks = [k for k in K_VALUES if k >= 4]
        for a, b in zip(ks, ks[1:]):
            if series[b] > series[a]:
                rises.append({"glyph": ch, "from_k": a, "to_k": b,
                              "from_em": round(series[a], 4),
                              "to_em": round(series[b], 4)})
    rises.sort(key=lambda r: r["to_em"] - r["from_em"], reverse=True)
    nonmonotone = {"steps_from_k4": len(rises),
                   "largest_rises": rises[:5]}
    # Glyphs whose error is smaller under re-damping than under plain
    # truncation at the same K (the damping paragraph's exception: at K=3,
    # re-damping helps a few small glyphs).
    improved = {}
    for k in K_VALUES:
        n = 0
        who = []
        for ch, gl in sorted(glyphs.items()):
            terms = gl["s"]
            if k >= len(terms) - 1:
                continue
            gaps = gl.get("g", [])
            vis = visible_mask(gaps)
            ref = trace(terms)
            kept = terms[:k + 1]
            w_plain = worst(ref, vis, trace(kept), vis)
            w_lanc = worst(ref, vis, trace(lanczos(kept)), vis)
            if w_lanc < w_plain - 1e-12:
                n += 1
                who.append(ch)
        improved[str(k)] = {"n": n, "glyphs": who}

    def agg(vals):
        a = np.array(vals)
        return {"median": float(np.median(a)), "p90": float(np.percentile(a, 90)),
                "max": float(a.max()),
                "within_tol": int((a <= TOL).sum()), "n": int(len(a))}

    summary = {}
    for variant in ("plain", "lanczos"):
        summary[variant] = {str(k): agg(per_k[variant][k]) for k in K_VALUES}

    # --- cost: wave arithmetic and file size for the 71 glyphs the site uses ---
    used_file = json.load(open(os.path.join(REPO, "data/generated/glyphs-used.json")))
    used = used_file["glyphs"]
    used_terms = sum(len(v["s"]) for v in used.values())
    def ops(glyph_set, k=None):
        total = 0
        for v in glyph_set.values():
            n = len(v["s"]) if k is None else min(len(v["s"]), k + 1)
            m = min(320, 40 + 4 * n)
            total += n * (m + 1)  # trace() adds one wave at each of M+1 points
        return total
    def json_bytes(glyph_set, k=None):
        sub = {}
        for ch, v in glyph_set.items():
            vv = dict(v)
            if k is not None:
                vv["s"] = v["s"][:k + 1]
            sub[ch] = vv
        doc = {"format": used_file.get("format"), "options": used_file.get("options"),
               "glyphs": sub}
        return len(json.dumps(doc, separators=(",", ":")))
    cost = {
        "used_glyphs": len(used),
        "used_terms_full": used_terms,
        "ops_full": ops(used),
        "json_bytes_full": json_bytes(used),
        "json_file_bytes": os.path.getsize(
            os.path.join(REPO, "data/generated/glyphs-used.json")),
    }
    for k in (8, 12, 16, 24):
        cost[f"ops_k{k}"] = ops(used, k)
        cost[f"json_bytes_k{k}"] = json_bytes(used, k)

    # --- stored-K distribution ---
    ks = sorted(stored_k.values())
    dist = {"min": ks[0], "median": float(np.median(ks)), "max": ks[-1],
            "total_terms": total_terms,
            "by_k": {str(k): sum(1 for v in ks if v == k) for k in sorted(set(ks))}}

    results = {
        "glyphs": len(glyphs), "tol_em": TOL, "cap_height_em": 0.7,
        "x_height_em": 0.5, "M": M,
        "validation": {"glyph": "A", "K": 8, "approx_em": approx,
                       "exact_em": exact},
        "stored_k_distribution": dist,
        "summary": summary,
        "worst5_plain": worst5,
        "nonmonotone_from_k4": nonmonotone,
        "improved_under_lanczos": improved,
        "featured": featured,
        "cost": cost,
    }
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results.json")
    json.dump(results, open(out, "w"), indent=2)
    print(f"wrote {out}")
    print("stored K: min %d median %.0f max %d, total terms %d"
          % (ks[0], np.median(ks), ks[-1], total_terms))
    for variant in ("plain", "lanczos"):
        print(f"--- {variant} ---")
        for k in K_VALUES:
            a = summary[variant][str(k)]
            print(f"K={k:3d}  median {a['median']:.4f}  p90 {a['p90']:.4f}  "
                  f"max {a['max']:.4f}  within {TOL} em: {a['within_tol']}/{a['n']}")
    print("cost:", json.dumps(cost, indent=2))


if __name__ == "__main__":
    main()
