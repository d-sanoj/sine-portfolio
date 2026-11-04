// Characters: which one is really drawn, and what HTML entities mean.

// A character with a designed shape is drawn as itself. One without is swapped
// for a close one, if there is one (see resolve below).
const SWAP = {
  '‘': "'", '’': "'", 'ʼ': "'", '“': '"', '”': '"', '„': '"',
  '–': '-', '—': '-', '―': '-', '−': '-', '‐': '-', '‑': '-',
  '…': '...', '•': '-', '·': '-', '●': '-', '▪': '-',
  '×': 'x', '÷': '/', '©': '(c)', '®': '(R)', '™': '', '​': '', '­': '',
};

// The text of a word as it will really be drawn, given the designed glyphs.
export function resolve(t, data) {
  let out = '';
  for (const ch of t) {
    if (data[ch]) { out += ch; continue; }
    out += SWAP[ch] !== undefined ? SWAP[ch] : ch.normalize('NFD').replace(/[̀-ͯ]/g, ''); // é -> e
  }
  return out;
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  bull: '•', copy: '©', reg: '®', trade: '™', times: '×', middot: '·', eacute: 'é',
};

export const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : m;
  }
  return ENTITIES[e.toLowerCase()] !== undefined ? ENTITIES[e.toLowerCase()] : m;
});
