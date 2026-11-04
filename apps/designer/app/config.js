// Fixed facts about the designer: the characters it offers, the drawing space, tolerances.

export const STORAGE_KEY = 'sineGlyphEditor.v1'; // used only when the dev server is not running
export const TEXT_STORAGE_KEY = 'sineGlyphEditor.text';

export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const LOWER = 'abcdefghijklmnopqrstuvwxyz';
export const DIGITS = '0123456789';
export const PUNCT = '.,!?\'":;-()@/&+#_%*$=[]~';
// Every punctuation mark and symbol Josefin Sans has, beyond the common ones above.
// Spacing accents (diaeresis, acute, cedilla ...) are left out: they are Latin extras.
export const SYMBOLS = '{}<>|\\^`¡¢£¤¥¦§©«¬®°±¶·»¿×÷–—‘’“”‚„†‡•…‰‹›⁄₡₣₤₦₧₩₫€₭₱₲₵₹₺₼₽№™∆∏∑−∕∙√∞∫≈≠≤≥◊';
// the rows of the character picker: [element id, characters]
export const SETS = [['upper', UPPER], ['lower', LOWER], ['digits', DIGITS], ['punct', PUNCT], ['symbols', SYMBOLS]];
export const ALL = SETS.map(([, set]) => set).join('');

export const DEFAULT_TEXT = 'Welcome to my portfolio\n[This is a link](https://example.com)';

// World space of a glyph: em units, v points up, baseline at v = 0.
export const VIEW = { x0: -0.1, x1: 1.1, v0: -0.35, v1: 1.05 };
export const ASPECT = (VIEW.x1 - VIEW.x0) / (VIEW.v1 - VIEW.v0);
export const GUIDES = [[0.8, 'ascender'], [0.7, 'cap'], [0.5, 'x-height'], [0, 'baseline'], [-0.2, 'descender']];

export const DEFAULT_K = 28; // sine terms per glyph
export const SNAP = 0.025; // grid size when "Snap" is on
export const SPEC_RANGE = 64; // frequencies drawn in the strength plot, each way
export const INK = '#e8f1f8';

// The fewest sine terms are chosen that keep the curve within TOL ems of the path.
export const TOL = 0.009;
export const K_STEPS = [12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128];

// Ids of the page-setting inputs that are saved with the editor.
export const SETTING_IDS = ['size', 'join', 'irr', 'seed', 'lineW'];
