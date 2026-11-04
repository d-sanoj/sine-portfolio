// The numbers that decide how the site looks and moves.

export const PAD = 0.06; // flowed pages: side margin, as a share of the page width
export const MAX_EM = 34; // flowed pages: body text never grows past this many pixels per em
export const LINE = 0.035; // line width as a share of the body em, before a word's weight
export const FORM_TIME = 1.0; // seconds for every letter to form
export const START_DELAY = 0.4; // seconds between the data arriving and the animation starting
export const MIN_LINE_PX = { exact: 0.9, flowed: 1.5 }; // thinnest line drawn, in pixels
export const PHONE_MAX_WIDTH = 783; // screens up to this width get the narrow layout

// the loader's circle pops: it draws in a little, shatters into one bead per letter, and the beads
// spring to their places at random moments, each starting its letter as it lands
export const GATHER_HOLD = 0.14; // seconds the circle draws in before it pops
export const GATHER_SCATTER = 0.8; // seconds over which the beads set off: each at its own random moment
export const GATHER_FLIGHT = [0.55, 1.05]; // shortest and longest time a bead takes to fly to its place
export const GATHER_BOLD = [0.8, 1.8]; // the beads' line weights while they fly (1 is the normal line)
export const LINE_SEED = 0.16; // a line (underline, rule) is born from a circle this big (page ems) that stretches out into the line
export const LOADER_INK = '#ffffff'; // the colour of the loader's circle, which the beads start as

// scrolling: letters that come onto the screen form quickly from circles, flying in from nearby spots
export const SCROLL_FORM = 0.38; // seconds for a letter to form
export const SCROLL_STAGGER = 0.1; // seconds over which the letters of a newly shown part set off, at random
export const SCROLL_NEAR = 40; // pixels beyond the screen where a letter starts forming
export const SCROLL_FAR = 420; // pixels beyond the screen where a letter is let go, so it forms again when it returns
export const SCROLL_SHIFT = [0.8, 2.2]; // how far (page ems) a letter flies in from, nearest and farthest
export const LINK_YELLOW = '#f2c14e'; // the underlines of hyperlinks (the yellow of the portrait's shirt)

// over a link, the word "click" forms below it, toward its right end, growing out of the underline (sizes in pixels)
export const HINT = {
  wordUrl: '/data/click-word.json', // the word, in the designed letters (made by the build)
  words: { '/boring/': '/data/boring-word.json' }, // a link to this address shows these words instead of "click"; they start where "click" starts and run on to the right
  textEm: 12.32, // how many pixels one em of the word is
  radius: 3, // the small circle it starts as, on the underline
  lineWidth: 1.5,
  gap: 6, // pixels between the underline and the word
  inset: 4, // pixels between the word and the right end of the link
  steps: 20, // the word is redrawn through this many steps while it forms
  hoverDelay: 0.03, // seconds the pointer must be on a link before the word starts to form
  formTime: 0.65, // seconds for the word to form
  unformTime: 0.3, // ... and to go back
};
