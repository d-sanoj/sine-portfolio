// Publishes the website to GitHub Pages with plain git commands:
//
//   npm run deploy        builds dist/ (npm run build:dist) and pushes it to the `gh-pages` branch of `origin`
//
// The branch holds only the finished website, as one commit that replaces the last one, so it stays small.
// GitHub Pages (Settings -> Pages -> Deploy from a branch -> gh-pages, folder /) serves it at
// https://<user>.github.io/<repository>/. main is not touched.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, PATHS } from './lib/paths.js';

const run = (cmd, args, cwd = ROOT) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'inherit', 'inherit'] });
const out = (cmd, args, cwd = ROOT) => execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim();

const remote = out('git', ['remote', 'get-url', 'origin']);
console.log('Building the website ...');
run('node', ['scripts/build.js', '--dist']);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sine-pages-'));
try {
  fs.cpSync(PATHS.dist, tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, '.nojekyll'), ''); // publish the files exactly as they are
  run('git', ['init', '-q', '-b', 'gh-pages'], tmp);
  run('git', ['add', '-A'], tmp);
  run('git', ['-c', 'user.name=' + out('git', ['config', 'user.name']), '-c', 'user.email=' + out('git', ['config', 'user.email']),
    'commit', '-q', '-m', 'Publish the website'], tmp);
  console.log('Pushing to the gh-pages branch of ' + remote + ' ...');
  run('git', ['push', '-f', remote, 'gh-pages'], tmp);
  console.log('Done. It is live in a minute or two.');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
