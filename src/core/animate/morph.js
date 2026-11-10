// How a curve forms: the same morph the designer's "Sine terms" slider shows.
// Used by the site (letters) and the loader (portraits). A curve is
// { terms, M, runs, gaps, still } (see buildCurve).
import { Sine } from '../sine/index.js';

export const clamp = (x) => Math.min(1, Math.max(0, x));
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// The letter at progress p (0..1): the position plus the strongest waves, strongest
// first. One wave is a circle; each added wave bends it closer to the letter.
// The slider is smoothed so the next wave fades in instead of popping in.
// Returns the curve's points and `hide`, how far the stretches where the pen only
// travels have faded away (0 = fully drawn faint, 1 = gone).
export function shape(letter, p) {
  if (p >= 1) {
    if (!letter.still) letter.still = Sine.trace(letter.terms, letter.M);
    return { xy: letter.still, hide: 1 };
  }
  if (letter.levels) return shapeLevels(letter, p);
  const terms = letter.circle ? startCircle(letter.terms, letter.circle, p, letter.home, letter.off) : letter.terms;
  const n = Math.max(1, (letter.ramp || letter.terms.length) - 1); // waves besides the position (`ramp`: how many there were before any were trimmed away)
  const K = Math.pow(n, ease(p)); // 1 wave at the start, all of them at the end
  const whole = Math.floor(K), frac = K - whole;
  const weights = letter.terms.map((_, q) => (q <= whole ? 1 : q === whole + 1 ? frac : 0));
  const xy = Sine.trace(terms, letter.M, weights);
  // like the designer, the stretches where the pen only travels are drawn faint
  // while the letter forms, then fade away at the end
  return { xy, hide: ease(clamp((p - 0.75) / 0.25)) };
}

// A curve with very many waves (a portrait) is drawn with only as many points as the waves in use need:
// while it is still forming, few waves are on, so far fewer points than the finished curve has.
// letter.levels[i] = { M: points, runs }, each level half the one before; letter.maxk[q] = the highest
// frequency among the first q waves. Returns { xy, hide, runs, step } where step says how many points
// of the finest level one point stands for (to look up things stored for the finest level, like colour).
function shapeLevels(letter, p) {
  const n = Math.max(1, (letter.ramp || letter.terms.length) - 1);
  const K = Math.pow(n, ease(p));
  const whole = Math.floor(K), frac = K - whole;
  const count = letter.terms.length;
  const need = 3 * letter.maxk[Math.min(count - 1, whole + 1)];
  let i = 0;
  while (i + 1 < letter.levels.length && letter.levels[i + 1].M >= need) i++;
  const { M, runs } = letter.levels[i];
  const terms = letter.circle ? startCircle(letter.terms, letter.circle, p, letter.home, letter.off) : letter.terms;
  // Adding up a thousand waves at thousands of points every frame is what made the loader slow. From one frame to the next
  // almost all the waves are the same, fully on. So their sum is kept (letter.sum: waves 2 .. n-1), and a frame only adds the
  // waves that have just come on (or takes away the ones that have gone, when the curve is dissolving). The first two waves are
  // left out of the sum: they are the ones startCircle changes. The sum is kept at the finest level the curve ever uses; a
  // coarser level's points are every 2nd, 4th ... of those, so changing level costs nothing. The result is the same curve as
  // adding all the waves.
  let sum = letter.sum;
  if (!sum) {
    let f = 0;
    while (f + 1 < letter.levels.length && letter.levels[f + 1].M >= 3 * letter.maxk[count - 1]) f++;
    sum = letter.sum = { M: letter.levels[f].M, n: 2, xy: new Float64Array(2 * (letter.levels[f].M + 1)) };
  }
  const want = Math.max(2, Math.min(count, whole + 1)); // waves 0 .. want-1 are fully on
  if (want !== sum.n) {
    if (want === 2) sum.xy.fill(0); // back to nothing: start clean, so rounding never builds up
    else addWaves(sum.xy, letter.terms, Math.min(want, sum.n), Math.max(want, sum.n), sum.M, want > sum.n ? 1 : -1);
    sum.n = want;
  }
  const head = [terms[0], terms[1]], weights = [1, whole >= 1 ? 1 : frac];
  if (whole + 1 >= 2 && whole + 1 < count) { head.push(terms[whole + 1]); weights.push(frac); } // the wave that is fading in
  const xy = Sine.trace(head, M, weights);
  const stride = sum.M / M;
  for (let j = 0; j <= M; j++) { xy[2 * j] += sum.xy[2 * j * stride]; xy[2 * j + 1] += sum.xy[2 * j * stride + 1]; }
  return { xy, hide: ease(clamp((p - 0.75) / 0.25)), runs, step: letter.M / M };
}

// add (sign 1) or take away (sign -1) waves from .. to-1 of `terms` to the points in xy (M + 1 points, as Sine.trace makes them)
function addWaves(xy, terms, from, to, M, sign) {
  for (let q = from; q < to; q++) {
    const [k, a, ph] = terms[q];
    if (!a) continue;
    const step = (2 * Math.PI * k) / M, cd = Math.cos(step), sd = Math.sin(step), amp = a * sign;
    let c = Math.cos(ph), s = Math.sin(ph);
    for (let j = 0; j <= M; j++) {
      xy[2 * j] += amp * c;
      xy[2 * j + 1] += amp * s;
      const nc = c * cd - s * sd;
      s = s * cd + c * sd;
      c = nc;
    }
  }
}

// A curve that has a fixed `circle` (a radius) starts as exactly that circle, centred on
// the origin, instead of whatever its first wave happens to be, so a set of such curves
// all begin alike. The position and the first wave grow into their own over the first third.
function startCircle(terms, radius, p, home = 0, off = null) {
  const s = ease(clamp(p / 0.35));
  return terms.map((t, q) => {
    if (q === 1) return [t[0], radius + (t[1] - radius) * s, t[2]];
    if (q !== 0) return t;
    const k = home + (1 - home) * s;
    if (!off) return [t[0], t[1] * k, t[2]];
    // it also starts off to one side (off), and comes back from there as it settles
    const x = t[1] * Math.cos(t[2]) * k + off[0] * (1 - s), y = t[1] * Math.sin(t[2]) * k + off[1] * (1 - s);
    return [t[0], Math.hypot(x, y), Math.atan2(y, x)];
  });
}

// A drawable curve from sine terms and the gaps where the pen only travels.
// M is how many points it is drawn with. `circle`: see startCircle.
export function buildCurve(terms, gaps = [], M = Math.min(320, 40 + terms.length * 4), circle = 0, { levels = 0, home = 0, off = null, ramp = 0 } = {}) {
  // off: [dx, dy], where a small circle starts relative to where its home would be
  // home (0..1): how much of its place in the picture a circle that starts small already has (see startCircle)
  const curve = { terms, gaps, M, circle, home, off, ramp, runs: Sine.runs(M, gaps), still: null };
  if (levels > 1) { // see shapeLevels; M should divide by 2 that many times
    curve.levels = Array.from({ length: levels }, (_, i) => ({ M: M >> i, runs: Sine.runs(M >> i, gaps) }));
    let top = 0;
    curve.maxk = terms.map((t) => (top = Math.max(top, Math.abs(t[0]))));
  }
  return curve;
}
