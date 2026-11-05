// A small Markdown reader for blog posts. It is not all of CommonMark: it is the
// subset the posts use (headings, lists, tables, quotes, fenced code, links, images),
// and it keeps enough structure that the blog can require alt text on every image.
export class BlogError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BlogError';
  }
}

const ALLOWED = new Set(['title', 'date', 'description', 'cover', 'coverAlt', 'draft', 'lang']);

function unquote(raw) {
  const v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

function checkDate(value, file) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new BlogError(file + ': date must be YYYY-MM-DD (got ' + JSON.stringify(value) + ')');
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
    throw new BlogError(file + ': ' + value + ' is not a real date');
  }
  return value;
}

export function parseFrontMatter(text, file) {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!src.startsWith('---\n')) throw new BlogError(file + ': start the file with --- front matter (title, date, description)');
  const end = src.indexOf('\n---\n', 4);
  if (end < 0) throw new BlogError(file + ': front matter is not closed with ---');
  const raw = src.slice(4, end);
  const body = src.slice(end + 5);
  const meta = {};
  raw.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    const m = /^([A-Za-z][A-Za-z0-9]*)\s*:\s*(.*)$/.exec(line);
    if (!m) throw new BlogError(file + ':' + (i + 2) + ': bad front matter line: ' + line);
    if (!ALLOWED.has(m[1])) throw new BlogError(file + ': unknown front matter field "' + m[1] + '" (allowed: ' + [...ALLOWED].join(', ') + ')');
    meta[m[1]] = unquote(m[2]);
  });
  if (!meta.title || !meta.title.trim()) throw new BlogError(file + ': front matter needs a title');
  if (!meta.description || !meta.description.trim()) throw new BlogError(file + ': front matter needs a description');
  if (!meta.date) throw new BlogError(file + ': front matter needs a date');
  meta.title = meta.title.trim();
  meta.description = meta.description.trim();
  meta.date = checkDate(meta.date.trim(), file);
  if (meta.draft !== undefined) meta.draft = /^(true|yes)$/i.test(meta.draft);
  else meta.draft = false;
  if (meta.cover && !meta.coverAlt) throw new BlogError(file + ': cover is set, so coverAlt is required (the text for that image)');
  if (meta.coverAlt && !meta.cover) throw new BlogError(file + ': coverAlt is set but there is no cover');
  meta.lang = meta.lang || 'en';
  const bodyStart = src.slice(0, end + 5).split('\n').length;
  return { meta, body, bodyStart };
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseAttrs(s) {
  const out = {};
  if (!s) return out;
  const inner = s.slice(1, -1).trim();
  if (!inner) return out;
  for (const part of inner.split(/\s+/)) {
    const eq = part.indexOf('=');
    if (eq === -1) out[part] = true;
    else out[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return out;
}

const IMAGE_LINE = /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)\s*(\{[^}]*\})?\s*$/;

function indentOf(text) {
  const m = /^ */.exec(text);
  return m ? m[0].length : 0;
}

function isBlank(line) { return line.text.trim() === ''; }

function findCloser(src, from, marker) {
  let i = from;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === '`') {
      let t = 1;
      while (src[i + t] === '`') t++;
      const end = src.indexOf('`'.repeat(t), i + t);
      if (end < 0) return -1;
      i = end + t;
      continue;
    }
    if (src.startsWith(marker, i)) return i;
    i++;
  }
  return -1;
}

function parseInline(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\' && i + 1 < src.length) { out += esc(src[i + 1]); i += 2; continue; }
    if (c === '`') {
      let ticks = 1;
      while (src[i + ticks] === '`') ticks++;
      const marker = '`'.repeat(ticks);
      const end = src.indexOf(marker, i + ticks);
      if (end < 0) { out += '`'; i++; continue; }
      let code = src.slice(i + ticks, end);
      if (code.startsWith(' ') && code.endsWith(' ') && code.trim() !== '') code = code.slice(1, -1);
      out += '<code>' + esc(code) + '</code>';
      i = end + ticks;
      continue;
    }
    if (c === '!' && src[i + 1] === '[') {
      // images belong on their own line, where they become figures
      const rest = src.slice(i);
      if (IMAGE_LINE.test(rest) || /^!\[[^\]]*\]\(/.test(rest)) {
        throw new BlogError('put each image on its own line, not inside a paragraph');
      }
    }
    if (c === '[') {
      const endText = src.indexOf(']', i + 1);
      if (endText > i && src[endText + 1] === '(') {
        const endHref = src.indexOf(')', endText + 2);
        if (endHref > 0) {
          const text = src.slice(i + 1, endText);
          let href = src.slice(endText + 2, endHref).trim();
          const titled = /^(.*?)\s+"[^"]*"\s*$/.exec(href);
          if (titled) href = titled[1];
          if (/^\s*javascript:/i.test(href)) throw new BlogError('links cannot use javascript:');
          out += '<a href="' + esc(href) + '">' + parseInline(text) + '</a>';
          i = endHref + 1;
          continue;
        }
      }
    }
    if (c === '*' && src[i + 1] === '*') {
      const end = findCloser(src, i + 2, '**');
      if (end > i) {
        out += '<strong>' + parseInline(src.slice(i + 2, end)) + '</strong>';
        i = end + 2;
        continue;
      }
    }
    if (c === '*' && (i === 0 || !/[A-Za-z0-9]/.test(src[i - 1])) && src[i + 1] && src[i + 1] !== ' ' && src[i + 1] !== '*') {
      const end = findStarEnd(src, i + 1);
      if (end > i) {
        out += '<em>' + parseInline(src.slice(i + 1, end)) + '</em>';
        i = end + 1;
        continue;
      }
    }
    out += esc(c);
    i++;
  }
  return out;
}

function findStarEnd(src, from) {
  for (let i = from; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === '`') {
      const end = src.indexOf('`', i + 1);
      if (end < 0) return -1;
      i = end;
      continue;
    }
    if (src[i] === '*' && src[i - 1] !== ' ' && (i + 1 >= src.length || !/[A-Za-z0-9]/.test(src[i + 1]))) return i;
  }
  return -1;
}

function plainish(md) {
  return md
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/[*_]/g, '')
    .trim();
}

function slugId(text, used) {
  let base = plainish(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
  let id = base;
  let n = 2;
  while (used.has(id)) { id = base + '-' + n; n++; }
  used.add(id);
  return id;
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function isSep(line) {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function alignOf(cell) {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return 'left';
}

export function parseBlocks(lines, file, usedIds) {
  const blocks = [];
  let i = 0;
  const err = (line, message) => { throw new BlogError(file + ':' + line.no + ': ' + message); };

  function parseList(startIndent) {
    const first = lines[i].text.slice(startIndent);
    const ordered = /^\d+\.\s+/.test(first);
    const items = [];
    while (i < lines.length) {
      if (isBlank(lines[i])) {
        let j = i + 1;
        while (j < lines.length && isBlank(lines[j])) j++;
        if (j < lines.length && indentOf(lines[j].text) === startIndent && /^(\d+\.\s+|[-*]\s+)/.test(lines[j].text.slice(startIndent))) {
          i = j;
          continue;
        }
        break;
      }
      const ind = indentOf(lines[i].text);
      if (ind < startIndent) break;
      if (ind > startIndent) break;
      const rest = lines[i].text.slice(startIndent);
      const marker = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      if (!marker.test(rest)) break;
      if (ordered && !/^\d+\.\s+/.test(rest)) break;
      if (!ordered && /^\d+\.\s+/.test(rest)) break;
      const itemLines = [{ text: rest.replace(marker, ''), no: lines[i].no }];
      i++;
      while (i < lines.length) {
        if (isBlank(lines[i])) {
          let j = i + 1;
          while (j < lines.length && isBlank(lines[j])) j++;
          if (j < lines.length && indentOf(lines[j].text) > startIndent) { itemLines.push({ text: '', no: lines[i].no }); i++; continue; }
          break;
        }
        if (indentOf(lines[i].text) <= startIndent) break;
        const cut = Math.min(indentOf(lines[i].text), startIndent + 2);
        itemLines.push({ text: lines[i].text.slice(cut), no: lines[i].no });
        i++;
      }
      items.push(parseBlocks(itemLines, file, usedIds));
    }
    return { type: 'list', ordered, items };
  }

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }
    const text = line.text;

    if (/^```/.test(text.trim()) || /^~~~/.test(text.trim())) {
      const fence = text.trim().startsWith('```') ? '```' : '~~~';
      const lang = text.trim().slice(fence.length).trim().split(/\s+/)[0] || '';
      const code = [];
      const openNo = line.no;
      i++;
      let closed = false;
      while (i < lines.length) {
        if (lines[i].text.trim().startsWith(fence) && lines[i].text.trim().replace(/`|~/g, '') === '') { closed = true; i++; break; }
        // a closing fence is a line that is only the fence (optional trailing space)
        if (lines[i].text.trim() === fence) { closed = true; i++; break; }
        code.push(lines[i].text);
        i++;
      }
      if (!closed) err({ no: openNo }, 'code block is not closed');
      blocks.push({ type: 'code', lang, text: code.join('\n') });
      continue;
    }

    if (/^#{1,6}\s+/.test(text.trim())) {
      const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(text.trim());
      const level = Math.min(6, m[1].length + 1); // the post title is the only h1
      const id = slugId(m[2], usedIds);
      blocks.push({ type: 'heading', level, text: m[2], id });
      i++;
      continue;
    }

    if (/^(\*\s*){3,}$/.test(text.trim()) || /^(-\s*){3,}$/.test(text.trim()) || /^(_\s*){3,}$/.test(text.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    if (text.trim() === ':::describe') {
      err(line, ':::describe has to follow an image (a blank line between them is fine)');
    }
    if (text.trim().startsWith(':::')) err(line, 'unknown block :::' + text.trim().slice(3));

    if (/^>\s?/.test(text)) {
      const inner = [];
      while (i < lines.length && /^>\s?/.test(lines[i].text)) {
        inner.push({ text: lines[i].text.replace(/^>\s?/, ''), no: lines[i].no });
        i++;
      }
      blocks.push({ type: 'quote', blocks: parseBlocks(inner, file, usedIds) });
      continue;
    }

    const listIndent = indentOf(text);
    if (/^(\d+\.\s+|[-*]\s+)/.test(text.slice(listIndent))) {
      blocks.push(parseList(listIndent));
      continue;
    }

    if (i + 1 < lines.length && text.includes('|') && isSep(lines[i + 1].text)) {
      let cap = null;
      if (blocks.length && blocks[blocks.length - 1].type === 'caption') cap = blocks.pop().text;
      const header = splitRow(text);
      const align = splitRow(lines[i + 1].text).map(alignOf);
      if (align.length !== header.length) err(lines[i + 1], 'table separator has ' + align.length + ' columns and the header has ' + header.length);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].text.includes('|') && lines[i].text.trim() !== '') {
        const cells = splitRow(lines[i].text);
        if (cells.length !== header.length) err(lines[i], 'this row has ' + cells.length + ' cells; the header has ' + header.length);
        rows.push(cells);
        i++;
      }
      blocks.push({ type: 'table', caption: cap, align, header, rows });
      continue;
    }

    if (/^Table:\s+\S/.test(text.trim()) && i + 2 < lines.length && lines[i + 1].text.includes('|') && isSep(lines[i + 2].text)) {
      blocks.push({ type: 'caption', text: text.trim().replace(/^Table:\s+/, '') });
      i++;
      continue;
    }

    if (IMAGE_LINE.test(text.trim())) {
      const m = IMAGE_LINE.exec(text.trim());
      const node = {
        type: 'image', alt: m[1], src: m[2], caption: m[3] || '', attrs: parseAttrs(m[4] || ''), describe: null, line: line.no,
      };
      i++;
      if (i < lines.length && isBlank(lines[i])) {
        // a describe block may sit after one blank line
        if (i + 1 < lines.length && lines[i + 1].text.trim() === ':::describe') i++;
      }
      if (i < lines.length && lines[i].text.trim() === ':::describe') {
        const openNo = lines[i].no;
        i++;
        const inner = [];
        let closed = false;
        while (i < lines.length) {
          if (lines[i].text.trim() === ':::') { closed = true; i++; break; }
          inner.push(lines[i]);
          i++;
        }
        if (!closed) err({ no: openNo }, ':::describe is not closed with :::');
        if (!inner.some((l) => l.text.trim())) err({ no: openNo }, ':::describe is empty');
        node.describe = parseBlocks(inner, file, usedIds);
      }
      blocks.push(node);
      continue;
    }

    if (text.trim().startsWith('![')) err(line, 'could not read this image. Use ![A description of the picture](file.png)');

    const para = [line];
    i++;
    while (i < lines.length && !isBlank(lines[i])) {
      const t = lines[i].text.trim();
      if (/^(#{1,6}\s+|```|~~~|>\s?|:::|(\*\s*){3,}$|(-{3,})$)/.test(t)) break;
      if (/^(\d+\.\s+|[-*]\s+)/.test(lines[i].text.slice(indentOf(lines[i].text))) && indentOf(lines[i].text) === 0) break;
      if (IMAGE_LINE.test(t)) break;
      para.push(lines[i]);
      i++;
    }
    let html = '';
    para.forEach((l, idx) => {
      const br = /  $/.test(l.text);
      const bit = br ? l.text.slice(0, -2) : l.text;
      if (idx) html += br ? '' : ' ';
      try { html += parseInline(bit); }
      catch (e) {
        if (e instanceof BlogError && !e.message.includes(file + ':')) throw new BlogError(file + ':' + l.no + ': ' + e.message);
        throw e;
      }
      if (br) html += '<br>';
    });
    blocks.push({ type: 'p', html });
  }
  return blocks;
}

// Parses one post's source into { meta, blocks }. Image files are checked later.
export function parseMarkdown(text, file) {
  const { meta, body, bodyStart } = parseFrontMatter(text, file);
  const rawLines = body.split('\n');
  const lines = rawLines.map((t, n) => ({ text: t, no: bodyStart + n }));
  const blocks = parseBlocks(lines, file, new Set());
  return { meta, blocks };
}

export function inlineHtml(src) {
  return parseInline(src);
}
