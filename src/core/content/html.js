// A normal HTML page. Structure is read; looks (CSS, colours, fonts) are not.
// A few optional hints let one page serve both the plain site and the sine site:
//   data-sine="skip"   left out of the sine version      data-sine="only"  sine version only
//   class="num"        decorative, left out               class="item"      items in a row get a dot between them
//   <ul class="inline">  list items run on in one line, with dots between
//   <ol class="plain">   list items without "-" or "1." in front

import { decode } from './characters.js';
import { wordBuilder } from './markup.js';

const attrOf = (str, name) => {
  const m = new RegExp(name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(str);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
};

export const looksLikeHtml = (text) => /<\s*(!doctype|html|body|h[1-6]|p|div|ul|ol|li|section|article|main|header|footer|nav|br|a|b|strong|em|i|span)\b/i.test(text);

export function parseHtml(html) {
  const notes = new Map();
  const note = (what) => notes.set(what, (notes.get(what) || 0) + 1);
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  const body = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(html);
  if (body) html = body[1];
  html = html.replace(/<(script|style|head|template|noscript|iframe|select|textarea|button)\b[\s\S]*?<\/\1\s*>/gi, '');
  html = html.replace(/<(svg|canvas|video|audio|picture|object)\b[\s\S]*?<\/\1\s*>/gi, () => { note('graphics (images, svg, video)'); return ' '; });

  const blocks = [];
  let cur = null, words = null, wb = null;
  let bold = 0;
  const links = [];
  const lists = [];
  let skipTag = null, skipDepth = 0; // inside an element that is left out
  let items = 0; // how many class="item" elements came before in this block
  const flush = () => {
    if (!cur) return;
    wb.end();
    while (words.length && words[words.length - 1].br) words.pop();
    if (words.length) blocks.push({ kind: cur, words });
    cur = null;
  };
  const open = (kind) => {
    flush();
    cur = kind;
    words = [];
    wb = wordBuilder(words);
    items = 0;
  };

  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (skipTag) { // everything inside a left-out element is passed over
      if (m[4] === undefined && m[2].toLowerCase() === skipTag) {
        skipDepth += m[1] === '/' ? -1 : 1;
        if (skipDepth === 0) skipTag = null;
      }
      continue;
    }
    if (m[4] !== undefined) { // text
      if (!cur) open('p');
      const href = links.length ? links[links.length - 1] : null;
      for (const ch of decode(m[4])) wb.add(ch, href, bold > 0);
      continue;
    }
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (!closing) {
      const hint = attrOf(m[3], 'data-sine');
      const cls = (attrOf(m[3], 'class') || '').split(/\s+/);
      if (hint === 'skip' || cls.includes('num')) {
        if (!/^(img|br|hr|input|meta|link)$/.test(tag)) { skipTag = tag; skipDepth = 1; }
        continue;
      }
      if (tag === 'span' && cls.includes('item')) { // items in a row: a dot between them
        if (!cur) open('p');
        if (items++ > 0) { wb.end(); words.push({ t: '\u00b7' }); }
        continue;
      }
      if (tag === 'ul' || tag === 'ol') {
        flush();
        const list = { ordered: tag === 'ol' && !cls.includes('plain'), plain: cls.includes('plain'), inline: cls.includes('inline'), n: 0 };
        lists.push(list);
        if (list.inline) open('p');
        continue;
      }
    }
    if (/^h[1-6]$/.test(tag)) { if (closing) flush(); else open(tag); }
    else if (tag === 'li') {
      const list = lists[lists.length - 1];
      if (list && list.inline) { // runs on in the one block, a dot between items
        if (!closing) { wb.end(); if (list.n++ > 0) words.push({ t: '\u00b7' }); }
      } else if (closing) flush();
      else {
        open('li');
        if (list && list.plain) list.n++;
        else if (list) { list.n++; words.push({ t: list.ordered ? list.n + '.' : '-' }); }
        else words.push({ t: '-' });
      }
    } else if (tag === 'ul' || tag === 'ol') { // (the opening tag is handled above)
      flush();
      lists.pop();
    } else if (/^(p|div|section|article|header|footer|nav|main|aside|blockquote|tr|table|figure|figcaption|pre|dl|dt|dd|form|address|summary|details)$/.test(tag)) {
      if (closing) flush(); else open(tag === 'p' && /\blabel\b/.test(m[3]) ? 'label' : 'p');
    } else if (tag === 'br') {
      if (!cur) open('p');
      wb.end();
      words.push({ br: true });
    } else if (tag === 'b' || tag === 'strong') {
      bold += closing ? -1 : 1;
    } else if (tag === 'a') {
      if (closing) links.pop();
      else {
        const hm = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[3]);
        links.push(hm ? decode(hm[1] ?? hm[2] ?? hm[3]) : null);
      }
    } else if (tag === 'img' || tag === 'hr') {
      note(tag === 'img' ? 'graphics (images, svg, video)' : 'horizontal lines');
    } else if (tag === 'em' || tag === 'i' || tag === 'cite' || tag === 'u' || tag === 'mark') {
      if (!closing) note('italic / underline / highlight (no slant, so left plain)');
    }
    // span, code, small, sub, sup, td, th ... pass through as plain text
  }
  flush();
  return { blocks, notes: [...notes].map(([what, n]) => what + (n > 1 ? ' x' + n : '')) };
}
