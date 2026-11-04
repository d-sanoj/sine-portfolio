// Asking the browser where the plain page puts everything.
//
// The page is opened in a hidden frame of the given width. Every character, line and
// underline is measured, and the numbers come back as one object (see
// src/core/layout/measured.js for what they become).
import { PAGE_URL } from '../config.js';

const toHex = (css) => {
  const m = /rgba?\(([^)]+)\)/.exec(css);
  if (!m) return css;
  const [r, g, b] = m[1].split(',').map((v) => Math.round(parseFloat(v)));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
};

async function openFrame(L) {
  const frame = document.createElement('iframe');
  frame.style.width = L.width + 'px';
  frame.style.height = L.height + 'px';
  frame.src = PAGE_URL;
  document.body.appendChild(frame);
  await new Promise((r) => { frame.onload = r; });
  const d = frame.contentDocument;
  await d.fonts.ready;
  await d.fonts.load('400 20px "Josefin Sans"');
  await d.fonts.load('300 20px "Josefin Sans"');
  return frame;
}

// the sine version of the page swaps a few links (e.g. "See in sine waves" -> "See in the boring way")
function swapSineLinks(d) {
  d.querySelectorAll('[data-sine-text]').forEach((el) => {
    el.textContent = el.dataset.sineText;
    if (el.dataset.sineHref) el.setAttribute('href', el.dataset.sineHref);
  });
}

// text drawn by CSS (the dots between links) becomes real text so it can be measured
function materialisePseudoText(d, w) {
  const style = d.createElement('style');
  style.textContent = '[data-pseudo-done]::before, [data-pseudo-done]::after { content: none !important; }';
  d.head.appendChild(style);
  for (const el of [...d.body.querySelectorAll('*')]) {
    for (const pseudo of ['::before', '::after']) {
      const cs = w.getComputedStyle(el, pseudo);
      const c = cs.content;
      if (!c || c === 'none' || c === 'normal' || c === '""' || c === "''") continue;
      const span = d.createElement('span');
      span.textContent = c.replace(/^["']|["']$/g, '');
      span.style.marginLeft = cs.marginLeft;
      span.style.marginRight = cs.marginRight;
      span.style.color = cs.color;
      span.style.fontWeight = cs.fontWeight;
      span.style.fontSize = cs.fontSize;
      span.style.textDecoration = 'none';
      if (pseudo === '::after') el.appendChild(span); else el.insertBefore(span, el.firstChild);
      el.setAttribute('data-pseudo-done', '');
    }
  }
}

export async function measurePage(L) {
  const frame = await openFrame(L);
  const w = frame.contentWindow, d = frame.contentDocument;
  swapSineLinks(d);
  materialisePseudoText(d, w);
  await new Promise((r) => setTimeout(r, 100));

  // a canvas that belongs to the measured page, so it uses that page's fonts
  const canvas = d.createElement('canvas').getContext('2d');
  const palette = [];
  const colorIndex = (css) => {
    const hex = toHex(css);
    let i = palette.indexOf(hex);
    if (i < 0) { palette.push(hex); i = palette.length - 1; }
    return i;
  };
  const sx = w.scrollX, sy = w.scrollY;
  const ascentOf = (cs) => {
    canvas.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return canvas.measureText('x').fontBoundingBoxAscent;
  };

  // ----- every character, grouped: a link is one group, other text is grouped by word -----
  const groups = [];
  const byLink = new Map();
  const weights = new Set();
  const walker = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const el = node.parentElement;
    if (!el || el.closest('script, style, noscript')) continue;
    const cs = w.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const a = el.closest('a');
    const upper = cs.textTransform === 'uppercase';
    const asc = ascentOf(cs);
    const fs = parseFloat(cs.fontSize);
    const wt = parseInt(cs.fontWeight, 10);
    const ci = colorIndex(cs.getPropertyValue('--sine-ink').trim() || cs.color); // --sine-ink: a colour only the sine page uses
    let plain = null;
    const text = node.nodeValue;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (/\s/.test(ch)) { plain = null; continue; }
      const range = d.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getClientRects()[0];
      if (!rect || rect.width === 0) continue;
      let g;
      if (a) {
        g = byLink.get(a);
        if (!g) {
          g = { h: a.getAttribute('href'), chars: [], u: [] };
          byLink.set(a, g);
          groups.push(g);
        }
      } else {
        if (!plain) { plain = { chars: [], u: [] }; groups.push(plain); }
        g = plain;
      }
      weights.add(wt);
      g.chars.push([upper ? ch.toUpperCase() : ch, +(rect.left + sx).toFixed(2), +(rect.top + sy + asc).toFixed(2), fs, wt, ci, +rect.width.toFixed(2)]);
    }
  }

  // ----- underlines: one line under each row of text of an underlined link -----
  for (const [a, g] of byLink) {
    const cs = w.getComputedStyle(a);
    if (!cs.textDecorationLine.includes('underline') || !g.chars.length) continue;
    const fs = g.chars[0][3];
    const off = parseFloat(cs.textUnderlineOffset);
    const thick = parseFloat(cs.textDecorationThickness) || 1;
    const rows = [];
    for (const c of g.chars) {
      let row = rows.find((r) => Math.abs(r.y - c[2]) < 3);
      if (!row) { row = { y: c[2], x0: c[1], x1: c[1] + c[6] }; rows.push(row); }
      row.x0 = Math.min(row.x0, c[1]);
      row.x1 = Math.max(row.x1, c[1] + c[6]);
    }
    for (const r of rows) g.u.push([+r.x0.toFixed(2), +r.x1.toFixed(2), +(r.y + (Number.isFinite(off) ? off : 0.1 * fs) + thick / 2).toFixed(2), thick]);
  }

  // ----- lines: the borders of boxes -----
  const rules = [];
  const vw = d.documentElement.clientWidth;
  for (const el of d.body.querySelectorAll('*')) {
    const cs = w.getComputedStyle(el);
    if (cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    for (const side of ['Top', 'Bottom']) {
      const bw = parseFloat(cs['border' + side + 'Width']);
      if (!(bw > 0) || cs['border' + side + 'Style'] === 'none') continue;
      const y = side === 'Top' ? r.top + sy + bw / 2 : r.bottom + sy - bw / 2;
      rules.push({ x0: +(r.left + sx).toFixed(2), x1: +(r.right + sx).toFixed(2), y: +y.toFixed(2), w: bw, ci: colorIndex(cs['border' + side + 'Color']), full: r.width >= vw - 1 });
    }
  }

  // ----- places the page can scroll to (#work, #contact ...) -----
  const anchors = {};
  d.querySelectorAll('[id]').forEach((el) => { anchors[el.id] = +(el.getBoundingClientRect().top + sy).toFixed(2); });

  // ----- how thick the font's strokes are at each weight, as a share of the font size -----
  const stems = {};
  for (const wt of weights) {
    canvas.font = `${wt} 500px "Josefin Sans"`;
    const m = canvas.measureText('l');
    stems[wt] = +((m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 500).toFixed(4);
  }

  const bodyCs = w.getComputedStyle(d.body);
  const rootCs = w.getComputedStyle(d.documentElement);
  const out = {
    vw,
    height: d.documentElement.scrollHeight,
    px: parseFloat(bodyCs.fontSize),
    bg: toHex(bodyCs.backgroundColor),
    accent: rootCs.getPropertyValue('--accent').trim() || null,
    palette, groups, rules, anchors, stems,
  };
  frame.remove();
  return out;
}
