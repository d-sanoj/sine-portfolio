// Shrinks the published code (dist/ only; the source in apps/, src/ stays as written). Every .js file keeps its own name and
// its imports, so the folder layout is the same; esbuild just takes out comments, spaces and long names. The page does the
// same thing, only smaller. `--no-minify` skips this step.
import fs from 'node:fs';
import path from 'node:path';

function* files(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (p.endsWith('.js')) yield p;
  }
}

// returns { files, before, after } in bytes, or null when esbuild is not installed (npm install)
export async function minifyDist(dir) {
  let esbuild;
  try { esbuild = await import('esbuild'); } catch (e) { return null; }
  let before = 0, after = 0, n = 0;
  for (const f of files(dir)) {
    const src = fs.readFileSync(f, 'utf8');
    const out = esbuild.transformSync(src, { minify: true, format: 'esm', target: 'es2022', legalComments: 'none' }).code;
    fs.writeFileSync(f, out);
    before += Buffer.byteLength(src); after += Buffer.byteLength(out); n++;
  }
  return { files: n, before, after };
}
