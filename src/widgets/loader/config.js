// How the loader looks and moves.
export const PORTRAITS_URL = 'data/portraits.json'; // relative to the page, so it works wherever the site is published

// the loader: a circle becomes a portrait, holds, and dissolves back
export const FORM_TIME = 1.0; // seconds for a circle to become a portrait
export const HOLD_TIME = 0.35; // seconds the finished portrait stays
export const UNFORM_TIME = 0.65; // seconds for it to dissolve back to a circle (the three add up to 2 seconds)
export const MIN_SHOW = 0; // the loader stays at least this long (seconds), then leaves on a finished portrait
export const FADE_TIME = 0.55; // seconds the loader takes to fade away

export const BACKGROUND = '#131313';
export const INK = '#ffffff'; // the lines of the portrait are white
export const MAX_FRACTION = { w: 0.96, h: 0.96 }; // the portrait fills the screen, leaving this much of it as a margin
export const CURVE_POINTS = 16384; // how finely the finished portrait is drawn (points along its curve)
export const MAX_PIXEL_RATIO = 1.5; // the loader's canvas is never drawn sharper than this many pixels per CSS pixel
export const CURVE_LEVELS = 6; // while it forms, it is drawn with half, a quarter, ... of that, as far as the waves in use need

// the colour inside the portrait: solid areas, each forming from a small circle (sizes are shares of the portrait's height)
export const FILL = {
  dot: 0.35, // a small circle's radius, as a share of its area's main wave (bigger areas start as bigger circles)
  minDot: 0.006, // ... but never smaller than this
  maxDot: 0.05, // ... or bigger than this
  home: 0.72, // at most this share of its distance from the middle of the picture is kept by the small circle
  lag: 1.3, // the colour forms as the portrait's progress to this power: a little behind the outline
  scatter: 0.3, // how far (in picture heights) a small circle may be thrown to one side of its place
  delay: 0.2, // the circles do not all set off together: each waits up to this much of the portrait's progress
  stops: 8, // an area's colour waves are read at this many places along its axis
  inside: 0.47, // the small circles are kept inside this radius, which is within the portrait's big circle (0.5)
};
