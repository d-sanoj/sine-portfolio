// The loader's circle popping into the page. The circle holds its breath for an instant (it
// shrinks a little), then it shatters into one bead per letter: the ring itself turns into a
// ring of beads. Each bead then sets off at its own random moment, along its own curved path,
// springing past its place and back by its own amount, so they pop into place one by one, like
// popcorn. The moment a bead lands, its letter starts forming from it. Lines (underlines, rules)
// come from the same circle: each is a bead too, and stretches into its line once it lands. A shock ring ripples out
// as the circle pops. A few beads are bolder in flight; all return to the normal line as they land.
// No drawing and no time in here: given the time, it says where every circle is.
import { FORM_TIME } from '../config.js';
import { GATHER_HOLD, GATHER_SCATTER, GATHER_FLIGHT, GATHER_BOLD, LINE_SEED } from '../config.js';

const clamp = (x) => Math.min(1, Math.max(0, x));
const mix = (a, b, t) => a + (b - a) * t;
const easeIn = (t) => t * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
// fast, a little past the end, then back: the spring of a pop; c1 is how far it overshoots
const spring = (t, c1) => { const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
// a steady pseudo-random number in 0..1 for a given integer
const rnd = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const SQUEEZE = 0.93; // how far the circle draws in before it pops (share of its radius)
const BEAD = 0.0095; // the beads' size at the start, as a share of the circle's radius

export class Gather {
  // circle: the loader's circle, { x, y, r } in page pixels
  // geo: where the page sits ({ em, ox, oy }); band: the part of the page on screen { top, bottom }
  // lines: the lines that are not part of the model (the rules that run the width of the screen)
  constructor(model, geo, circle, band, lines = []) {
    const { em, ox, oy } = geo;
    const cx = (circle.x - ox) / em, cv = (oy - circle.y) / em, R = circle.r / em;
    this.R = R;
    this.centre = [cx, cv];
    const pieces = [];
    let id = 0;
    for (const st of model.letters.concat(lines)) {
      const [, a, ph] = st.terms[0];
      const x = a * Math.cos(ph), v = a * Math.sin(ph); // where the letter starts (page ems)
      const sy = oy - v * em;
      if (sy < band.top || sy > band.bottom) continue;
      id++;
      pieces.push({
        st, id, to: [x, v], r: st.line ? LINE_SEED : st.terms[1][1], angle: Math.atan2(v - cv, x - cx),
        start: GATHER_HOLD + GATHER_SCATTER * Math.pow(rnd(id + 3), 1.3), // when it sets off
        flight: mix(GATHER_FLIGHT[0], GATHER_FLIGHT[1], rnd(id + 5)), // how long it takes
        bend: (rnd(id + 11) - 0.5) * 1.1, // how far its path curves to one side
        spring: 1.1 + 2.2 * Math.pow(rnd(id + 13), 2), // how far it overshoots its place
        swell: (0.8 + 1.8 * rnd(id + 21)) * (st.line ? 0.5 : 1), // how much it swells on the way
        bold: mix(GATHER_BOLD[0], GATHER_BOLD[1], rnd(id + 9)),
      });
    }
    // Where the beads start. When the loader hands over its small coloured circles, every letter's bead starts as one
    // of them (a circle with several letters to make splits into that many); otherwise the beads sit around the ring.
    // Either way each letter takes the place that matches its rank by direction, so nothing tangles.
    pieces.sort((a, b) => a.angle - b.angle);
    const dots = (circle.dots || []).map((d) => ({ x: (d.x - ox) / em, v: (oy - d.y) / em, r: d.r / em, rgb: d.rgb }));
    dots.forEach((d) => { d.angle = Math.atan2(d.v - cv, d.x - cx); });
    dots.sort((a, b) => a.angle - b.angle);
    this.dots = dots.length > 0;
    // the underlines of hyperlinks come from the yellowest (and biggest) coloured circles; the rest share the others
    let pool = dots;
    if (dots.length) {
      const under = pieces.filter((p) => p.st.underline);
      const score = (d) => Math.hypot(d.rgb[0] - 240, d.rgb[1] - 192, d.rgb[2] - 76) - 60 * d.r;
      const picks = dots.slice().sort((a, b) => score(a) - score(b)).slice(0, under.length);
      under.forEach((p, i) => { p.dot = picks[i]; });
      pool = dots.filter((d) => !picks.includes(d));
    }
    const rest = pieces.filter((p) => !p.dot);
    pieces.forEach((p, k) => {
      p.ring = -Math.PI + (2 * Math.PI * (k + 0.5)) / pieces.length;
      if (dots.length && !p.dot) {
        const r = rest.indexOf(p);
        p.dot = pool.length ? pool[Math.min(pool.length - 1, Math.floor((r * pool.length) / rest.length))] : dots[0];
      }
      if (p.dot) p.from = [cx + (p.dot.x - cx) * SQUEEZE, cv + (p.dot.v - cv) * SQUEEZE];
      else p.from = [cx + R * SQUEEZE * Math.cos(p.ring), cv + R * SQUEEZE * Math.sin(p.ring)];
      const dx = p.to[0] - p.from[0], dv = p.to[1] - p.from[1], len = Math.hypot(dx, dv) || 1;
      // the path is a curve: the straight line, pushed out sideways in the middle
      p.ctrl = [(p.from[0] + p.to[0]) / 2 - (dv / len) * len * p.bend, (p.from[1] + p.to[1]) / 2 + (dx / len) * len * p.bend];
      p.land = p.start + p.flight; // the moment it is in place and its letter starts forming
    });
    this.pieces = pieces;
    this.rep = pieces.length ? pieces[0].st : null;
    this.lastLand = pieces.reduce((m, p) => Math.max(m, p.land), GATHER_HOLD);
    this.duration = this.lastLand + FORM_TIME; // everything is finished when the last letter has formed
  }

  // the circle's radius at time t before it pops: it draws in a little
  squeeze(t) { return this.R * mix(1, SQUEEZE, easeIn(clamp(t / GATHER_HOLD))); }

  // What is on screen t seconds in:
  //   circles: [{ st, c: [x, v, radius], w: boldness, a: opacity, k: colour }]  the ring, beads in flight
  //   formed:  [{ st, p }]  letters whose circle has landed, p (0..1) how far they have formed
  at(t) {
    const circles = [], formed = [];
    const [cx, cv] = this.centre;
    const R = this.R;
    const rs = this.squeeze(t);
    // the circle itself, until it turns into its beads
    const turn = clamp(t / (GATHER_HOLD * 0.9));
    if (turn < 1 && this.rep) circles.push({ st: this.rep, c: [cx, cv, rs], w: 1, a: 1 - easeIn(turn), k: 0 });
    // a shock ring ripples out from the pop
    const sh = clamp((t - GATHER_HOLD) / 0.45);
    if (sh > 0 && sh < 1 && this.rep) circles.push({ st: this.rep, c: [cx, cv, mix(R * SQUEEZE, R * 1.55, easeOut(sh))], w: 1, a: 0.45 * (1 - sh), k: 0 });
    const r0 = R * BEAD;
    const sq = rs / R; // how far the circle has drawn in
    for (const p of this.pieces) {
      if (t >= p.land) { formed.push({ st: p.st, p: (t - p.land) / FORM_TIME }); continue; }
      const dot = p.dot, from = dot ? dot.rgb : null;
      if (t < p.start) {
        // still waiting where it started; once the circle has popped, it shivers, ready to go
        const shiver = t < GATHER_HOLD ? 0 : 0.12 * Math.sin(t * 46 + p.id) * clamp((t - GATHER_HOLD) / 0.1);
        if (dot) {
          const f = t < GATHER_HOLD ? sq : SQUEEZE;
          circles.push({ st: p.st, c: [cx + (dot.x - cx) * f + shiver, cv + (dot.v - cv) * f, dot.r * f], w: 1, a: 1, k: 0, solid: 1, from });
        } else {
          const rr = t < GATHER_HOLD ? rs : R * SQUEEZE;
          circles.push({ st: p.st, c: [cx + (rr + shiver) * Math.cos(p.ring), cv + (rr + shiver) * Math.sin(p.ring), r0], w: 1, a: easeIn(turn), k: 0 });
        }
        continue;
      }
      const u = clamp((t - p.start) / p.flight);
      const e = spring(u, p.spring);
      const b = 1 - e; // a curved path (it carries on past the end of the curve while it overshoots)
      const x = b * b * p.from[0] + 2 * b * e * p.ctrl[0] + e * e * p.to[0];
      const v = b * b * p.from[1] + 2 * b * e * p.ctrl[1] + e * e * p.to[1];
      // it swells in flight, and is the letter's own size when it lands
      const sw = Math.sin(Math.PI * Math.min(1, u * 1.1));
      const start = dot ? dot.r * SQUEEZE : r0;
      const r = mix(start, p.r, spring(u, 1.6 * p.spring)) + Math.max(p.r, 0.1) * p.swell * sw * sw;
      circles.push({
        st: p.st,
        c: [x, v, Math.max(0.02, r)],
        w: mix(p.bold, 1, easeOut(clamp(u * 1.15))),
        a: 1,
        k: easeOut(clamp(u * 1.5)), // the colour of the loader's circle (or of its coloured circle) turns into the letter's own
        ...(dot ? { solid: 1 - easeOut(clamp(u * 2.2)), from } : {}), // the solid coloured circle opens into the letter's ring
      });
    }
    return { circles, formed };
  }
}
