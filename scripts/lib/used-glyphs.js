// The letters the measured page actually uses, so the site can ship those instead of every designed letter.
import fs from 'node:fs';
import path from 'node:path';
import { Content } from '../../src/core/index.js';
import { PATHS, LAYOUTS } from './paths.js';

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } };

export function editorOptions() {
  const ui = (readJson(PATHS.editorState) || {}).ui || {};
  const options = {};
  if (ui.join !== undefined) options.join = !!ui.join;
  if (ui.irr !== undefined) options.irr = +ui.irr;
  if (ui.seed !== undefined) options.seed = Math.max(1, Math.floor(+ui.seed || 1));
  return options;
}

function take(used, glyphs, group) {
  for (const [c0] of group.chars) {
    for (const ch of (glyphs[c0] ? c0 : Content.resolve(c0, glyphs))) if (glyphs[ch]) used.add(ch);
  }
}

// Rewrites data/generated/glyphs-used.json from the measured layouts (including the other greetings).
export function writeUsedGlyphs() {
  const glyphs = readJson(PATHS.glyphs).glyphs;
  const options = editorOptions();
  const used = new Set();
  for (const layout of LAYOUTS) {
    const L = readJson(path.join(PATHS.generated, layout.measured));
    if (!L) continue;
    for (const g of L.groups) take(used, glyphs, g);
    for (const gs of Object.values(L.greetings || {})) for (const g of gs) take(used, glyphs, g);
  }
  const subset = {};
  for (const ch of [...used].sort()) subset[ch] = glyphs[ch];
  fs.mkdirSync(PATHS.generated, { recursive: true });
  fs.writeFileSync(path.join(PATHS.generated, 'glyphs-used.json'), JSON.stringify({ format: 'sine-glyphs-used', options, glyphs: subset }));
  return used.size;
}
