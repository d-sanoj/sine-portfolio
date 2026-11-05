// Checks the blog reader: a missing alt stops the build, the home page lists the three newest notes,
// and an animated GIF gets a still first frame.
//   node scripts/check-blog.js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BlogError, loadPosts, applyHome, buildBlog, renderPost } from './lib/blog.js';
import { gifFirstFrame } from './lib/gif.js';

let failed = 0;
const ok = (name) => console.log('ok  ' + name);
const bad = (name, err) => { failed++; console.error('FAIL  ' + name + '\n' + (err && err.stack || err)); };

function expectThrow(name, fn) {
  try {
    fn();
    bad(name, 'no error');
  } catch (e) {
    if (e instanceof BlogError || (e && e.name === 'BlogError')) ok(name + ' -> ' + e.message.split('\n')[0]);
    else bad(name, e);
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-check-'));
function write(slug, body, file) {
  fs.writeFileSync(path.join(root, slug + '.md'), body);
  if (file) {
    fs.mkdirSync(path.join(root, slug), { recursive: true });
    fs.writeFileSync(path.join(root, slug, file.name), file.body);
  }
}

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

write('no-alt', `---
title: No alt
date: 2026-01-01
description: This image has no description.
---

![](dot.png)
`, { name: 'dot.png', body: png });
expectThrow('missing alt', () => loadPosts(root));
fs.rmSync(path.join(root, 'no-alt.md'));
fs.rmSync(path.join(root, 'no-alt'), { recursive: true });

write('decor', `---
title: Decor
date: 2026-01-02
description: A decorative rule.
---

![](dot.png){decorative}
`, { name: 'dot.png', body: png });
try {
  const posts = loadPosts(root);
  if (posts[0].blocks.some((b) => b.type === 'image' && b.decorative)) ok('decorative image');
  else bad('decorative image', 'not marked decorative');
} catch (e) { bad('decorative image', e); }

// three notes plus an older fourth, so the home list must drop the oldest
for (const [slug, date, title] of [
  ['newer', '2026-05-03', 'Newer note'],
  ['middle', '2026-05-02', 'Middle note'],
  ['older', '2026-05-01', 'Older note'],
  ['oldest', '2026-04-01', 'Oldest note'],
]) {
  write(slug, `---
title: ${title}
date: ${date}
description: A short line about ${title}.
---

Just words.
`);
}
try {
  const posts = loadPosts(root).filter((p) => !p.draft);
  const html = applyHome('<!-- blog:section --><section id="blog"><ol><!-- blog:latest --><!-- /blog:latest --></ol></section><!-- /blog:section -->', posts);
  for (const title of ['Newer note', 'Middle note', 'Older note']) {
    if (!html.includes(title)) throw new Error('missing ' + title);
  }
  if (html.includes('Oldest note')) throw new Error('fourth note was included');
  if (!html.includes('../blog/newer/')) throw new Error('link was not rewritten for the home page');
  const first = html.indexOf('Newer note');
  const third = html.indexOf('Older note');
  if (!(first < third)) throw new Error('not newest first');
  ok('home lists the latest 3');
} catch (e) { bad('home lists the latest 3', e); }

try {
  const real = loadPosts();
  const third = real.find((p) => p.slug === 'one-word-at-a-time');
  const html = renderPost(third, real);
  if (!html.includes('href="../how-a-model-reads-a-word/"')) throw new Error('link to the other note was ' + (html.match(/href="[^"]*how-a-model[^"]*"/) || ['missing'])[0]);
  if (!html.includes('<time datetime="2026-11-03">')) throw new Error('no time element');
  ok('post links and dates');
} catch (e) { bad('post links and dates', e); }

try {
  const out = path.join(root, 'out');
  const n = buildBlog(out);
  if (n < 3) throw new Error('expected at least the sample posts, got ' + n);
  const still = path.join(out, 'how-a-model-reads-a-word', 'lookup.still.png');
  if (!fs.existsSync(still)) throw new Error('still frame was not written');
  const frame = gifFirstFrame(fs.readFileSync(path.join('content/blog/how-a-model-reads-a-word', 'lookup.gif')));
  if (frame.frames < 2) throw new Error('sample gif is not animated');
  const feed = fs.readFileSync(path.join(out, 'feed.xml'), 'utf8');
  if (!feed.includes('<feed xmlns="http://www.w3.org/2005/Atom">')) throw new Error('not an Atom feed');
  if (!feed.includes('How a model reads a word')) throw new Error('feed is missing the sample');
  ok('build writes pages, still frame and feed');
} catch (e) { bad('build writes pages, still frame and feed', e); }

process.exit(failed ? 1 : 0);
