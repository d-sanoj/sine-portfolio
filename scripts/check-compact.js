// Proves the compact way of shipping the page gives exactly the same page as the finished one:
// the page made from layout-*.json and glyphs-used.json must equal sine-page*.json, byte for byte.
//   node scripts/check-compact.js
import fs from 'node:fs';
import path from 'node:path';
import { Layout } from '../src/core/index.js';
import { PATHS, LAYOUTS } from './lib/paths.js';

const read = (f) => fs.readFileSync(path.join(PATHS.generated, f), 'utf8');
const used = JSON.parse(read('glyphs-used.json'));
let ok = true;
for (const l of LAYOUTS) {
  const made = JSON.stringify(Layout.fromLayout(JSON.parse(read(l.measured)), used.glyphs, used.options));
  const finished = read(l.page);
  const same = made === finished;
  ok = ok && same;
  console.log((same ? 'same   ' : 'DIFFERS') + '  ' + l.page + '  (' + made.length + ' vs ' + finished.length + ' characters)');
}
process.exit(ok ? 0 : 1);
