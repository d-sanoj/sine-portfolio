// The page as the site animates it: every letter ready to draw, the links, the lines.
// No drawing and no events in here; the view draws it and the controllers drive it.
import { buildLetter, lineLetter, boxOf } from './Letter.js';
import { FORM_TIME } from '../config.js';

export class PageModel {
  // page: the JSON file made by the build (see src/core/layout/measured.js).
  constructor(page) {
    this.page = page;
    this.exact = !!page.px; // made from the measured plain page (true) or flowed (false)
    this.bounds = page.bounds;
    this.palette = page.palette || null;
    this.accent = page.accent || null;
    this.background = page.bg || null;
    this.rules = page.rules || [];
    this.anchors = page.anchors || {};
    this.letters = [];
    this.real = page.real || []; // text that stays real text (see views/RealTextView.js)
    this.links = []; // { href, box: [x0, v0, x1, v1], word }; a hoverable word with a picture has peek (its address) and no href
    let wordNo = 0;
    for (const line of page.lines) {
      for (const word of line) {
        const mine = [];
        const add = (letter, lw, line = false, underline = false) => {
          const st = buildLetter(letter, 0);
          st.line = line; // a straight line (an underline), not a letter
          st.underline = underline; // the underline of a hyperlink
          st.word = wordNo;
          st.link = !!word.h;
          st.ci = word.c || 0;
          st.lw = lw;
          this.letters.push(st);
          mine.push(st);
        };
        word.l.forEach((letter) => add(letter, word.w || 1)); // line weight: bold words are drawn heavier
        (word.u || []).forEach(([a, b, v]) => add(lineLetter(a, b, v), word.uw || 1, true, true)); // underline rows
        if (word.h) this.links.push({ href: word.h, word: wordNo, box: boxOf(mine), label: labelFor(word.h) });
        else if (word.peek) this.links.push({ href: null, peek: word.peek, word: wordNo, box: boxOf(mine) }); // hovering it shows a picture
        wordNo++;
      }
    }
    // a link in real text has no letters, but it is a link here too, so hovering it lights up the hint like the others
    let realNo = 1e6;
    for (const r of this.real) {
      for (const f of r.frags) {
        if (f.href) this.links.push({ href: f.href, word: realNo++, box: [f.x - 0.12, f.v - f.h - 0.12, f.x + f.w + 0.12, f.v + 0.12], real: true });
      }
    }
    this.end = this.letters.reduce((m, s) => Math.max(m, s.start + FORM_TIME), 0);
  }

  // Lines that run the width of the screen depend on the screen, so the view asks for them.
  // a and b are page ems; a function maps full-width lines to the current screen.
  ruleLetters(extent) {
    return this.rules.map((r) => {
      const a = r.full ? extent.left : r.a, b = r.full ? extent.right : r.b;
      const st = buildLetter(lineLetter(a, b, r.v), 0);
      st.ci = r.c || 0;
      st.lw = r.w || 1;
      st.line = true;
      return st;
    });
  }
}

// A name for a link, for a screen reader: the address says what it is. (The words
// themselves carry no text — they are sine letters — so the name comes from the href.)
function labelFor(href) {
  if (href[0] === '#') return 'Back to top';
  if (/^mailto:/i.test(href)) return `Email ${href.slice(7)}`;
  if (href === '../blog/') return 'Blog';
  const post = /^\.\.\/blog\/([\w-]+)\/$/.exec(href);
  if (post) {
    const s = post[1].replaceAll('-', ' ');
    return s[0].toUpperCase() + s.slice(1);
  }
  let u;
  try { u = new URL(href); } catch { return href; }
  if (u.hostname === 'github.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    const q = u.searchParams.get('q');
    if (q) return `GitHub repositories matching "${q}"`;
    if (parts.length <= 1) return 'Sanoj D on GitHub';
    return `${parts[1]} on GitHub`;
  }
  if (u.hostname === 'epigcorpus.sanoj.dev') return 'EpigCorpus live demo';
  return href;
}
