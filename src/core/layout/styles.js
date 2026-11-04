// The numbers that decide how a page looks when it is laid out by the flow
// layout, and the line width the measured layout and the player agree on.

export const DEFAULTS = { join: true, irr: 0.4, seed: 1, maxWidth: 14, track: 0, space: 0.3, lineHeight: 1.6, capGap: 0.07 };

// size: letter size relative to body text. before / after: empty space in body-text ems.
export const STYLES = {
  h1: { size: 2.0, before: 0.6, after: 0.35 },
  h2: { size: 1.55, before: 0.5, after: 0.3 },
  h3: { size: 1.3, before: 0.4, after: 0.25 },
  h4: { size: 1.15, before: 0.3, after: 0.2 },
  h5: { size: 1.05, before: 0.3, after: 0.2 },
  h6: { size: 1.0, before: 0.3, after: 0.2 },
  p: { size: 1, before: 0, after: 0.4 },
  li: { size: 1, before: 0, after: 0.12 },
  label: { size: 0.85, before: 1.8, after: 0.3 }, // small section labels (class="label")
  line: { size: 1, before: 0, after: 0 },
};

export const BOLD = 2.2; // line weight of bold words
export const LINE = 0.035; // line width as a share of the body em, before weights (matches the player)
