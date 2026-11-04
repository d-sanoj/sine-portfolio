// Plain markup, and the word collector both readers share.
// Blocks have the shape { kind, words: [{ t, h?, b?, br? }] }.

// A word being collected: its letters, link and how much of it is bold.
export function wordBuilder(out) {
  let cur = null;
  return {
    add(ch, href, bold) {
      for (const c of ch) {
        if (c === '​' || c === '­') continue; // invisible characters
        if (/\s/.test(c)) { this.end(); continue; }
        if (!cur) cur = { t: '', h: null, bold: 0, n: 0 };
        cur.t += c;
        if (href && !cur.h) cur.h = href;
        cur.n++;
        if (bold) cur.bold++;
      }
    },
    end() {
      if (!cur) return;
      const w = { t: cur.t };
      if (cur.h) w.h = cur.h;
      if (cur.bold * 2 >= cur.n) w.b = true;
      out.push(w);
      cur = null;
    },
  };
}

// One line of the text is one line of the page.
//   "# Heading"  "## Smaller"  "### Smaller still"   **bold**   [label](https://address)
export function parseMarkup(text) {
  const blocks = [];
  for (const raw of text.split('\n')) {
    let kind = 'line', line = raw;
    const m = /^(#{1,3})\s+(.*)$/.exec(raw);
    if (m) { kind = 'h' + m[1].length; line = m[2]; }
    const words = [];
    const wb = wordBuilder(words);
    let bold = false;
    const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/y;
    for (let i = 0; i < line.length;) {
      if (line.startsWith('**', i)) { bold = !bold; i += 2; continue; }
      if (line[i] === '[') {
        LINK.lastIndex = i;
        const lm = LINK.exec(line);
        if (lm) { for (const c of lm[1]) wb.add(c, lm[2], bold); i += lm[0].length; continue; }
      }
      wb.add(line[i], null, bold);
      i++;
    }
    wb.end();
    blocks.push({ kind, words });
  }
  return { blocks, notes: [] };
}
