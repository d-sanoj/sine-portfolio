// A smaller portraits.json for the website. The file the portrait tracer saves (data/generated/portraits.json) stays as it
// is, complete; the website gets a copy without the part that draws nothing: the outline waves stored with an amplitude of 0
// (they were rounded away when the portrait was traced, and they are the last half of the list, about 1,100 of 2,200).
// The animation times how much detail has appeared by how many waves a curve has, so the original count is kept (`n`) and the
// website uses it for that: the animation runs at the same speed and the finished portrait is identical, pixel for pixel.
// (Only the sampling the unused waves asked for at the very end of the forming goes: a pixel here and there on the outline
// between 80% and 95% of the forming moves by a fraction of a pixel.)
//
// fillMin > 0 also drops the colour areas' waves smaller than that (in picture heights: 0.0004 is a third of a pixel on a tall
// screen). That saves another 26 KB but changes the finished portrait slightly (about 1% of its edge pixels), so it is off.
// The first term of every curve is its position and is always kept. Terms are sorted strongest first, so trimming only
// removes the end of each list.
export function trimPortraits(file, { fillMin = 0 } = {}) {
  const cut = (terms) => terms.filter((t, i) => i === 0 || t[1] >= fillMin);
  return {
    ...file,
    portraits: file.portraits.map((p) => ({
      ...p,
      n: p.s.length,
      s: p.s.filter((t, i) => i === 0 || t[1] > 0),
      f: p.f && fillMin > 0 ? p.f.map((a) => ({ ...a, n: a.s.map((loop) => loop.length), s: a.s.map(cut) })) : p.f,
    })),
  };
}
