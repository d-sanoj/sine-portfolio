// Measures the plain page in a headless browser and saves layout-wide.json and layout-narrow.json.
// The dev server and `npm run build:dist` both call this, so a new note updates the sine home page
// without anyone opening /measure/ by hand. Chrome is only launched when the page or the posts changed.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PATHS, LAYOUTS } from './paths.js';
import { findChrome } from './chrome.js';
import { injectHome, publishedPosts, HOME_VERSION, BlogError } from './blog.js';
import { writeUsedGlyphs } from './used-glyphs.js';

const STAMP = path.join(PATHS.generated, 'home-stamp.txt');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((err) => err ? reject(err) : resolve(port));
    });
  });
}

function hashFile(h, file) {
  h.update('\0' + file + '\0');
  h.update(fs.readFileSync(file));
}

export function homeStamp() {
  const h = crypto.createHash('sha256');
  h.update(HOME_VERSION);
  hashFile(h, PATHS.plainPage);
  hashFile(h, fileURLToPath(new URL('./blog.js', import.meta.url)));
  hashFile(h, path.join(PATHS.measureApp, 'app', 'main.js'));
  hashFile(h, path.join(PATHS.measureApp, 'app', 'config.js'));
  hashFile(h, path.join(PATHS.measureApp, 'app', 'services', 'measurePage.js'));
  hashFile(h, path.join(PATHS.assets, 'fonts', 'JosefinSans-VF.ttf'));
  if (fs.existsSync(PATHS.blog)) {
    const files = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        if (name.startsWith('.')) continue;
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (name.endsWith('.md')) files.push(full);
      }
    };
    walk(PATHS.blog);
    for (const file of files.sort()) hashFile(h, file);
  }
  return h.digest('hex');
}

function layoutsReady() {
  return LAYOUTS.every((l) => fs.existsSync(path.join(PATHS.generated, l.measured)));
}

function pageText(layout) {
  const groups = layout.groups.concat(...Object.values(layout.greetings || {}));
  // spaces are not stored; words are separate groups, so compare with the spaces removed
  return groups.map((g) => g.chars.map((c) => c[0]).join('')).join('');
}

const flat = (s) => s.replace(/\s+/g, '');

function assertMeasured(posts) {
  const shown = posts.slice(0, 3);
  for (const layout of LAYOUTS) {
    const file = path.join(PATHS.generated, layout.measured);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const text = pageText(data);
    const hrefs = data.groups.map((g) => g.h).filter(Boolean);
    const heading = flat('A few things I wrote');
    if (shown.length && !text.includes(heading)) throw new Error(layout.measured + ' does not contain the blog heading');
    if (!shown.length && text.includes(heading)) throw new Error(layout.measured + ' still has the blog section though there are no notes');
    for (const post of shown) {
      if (!text.includes(flat(post.title))) throw new Error(layout.measured + ' is missing the note "' + post.title + '"');
      if (!hrefs.some((h) => h.includes('/blog/' + post.slug + '/'))) throw new Error(layout.measured + ' is missing the link to /blog/' + post.slug + '/');
      // sine home lists title and date only; the description stays on the plain page
      if (post.description && text.includes(flat(post.description))) {
        throw new Error(layout.measured + ' still draws the description of "' + post.title + '" (it should be plain-only)');
      }
    }
    if (!text.includes('Home') || !text.includes('Blog')) {
      throw new Error(layout.measured + ' is missing the Home / Blog links in the top bar');
    }
    if (!hrefs.some((h) => h === '../blog/' || h.endsWith('/blog/') || h === 'blog/')) {
      throw new Error(layout.measured + ' is missing the Blog nav link');
    }
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8',
};

function startServer() {
  const routes = [
    { prefix: '/boring/', dir: PATHS.plainApp, plain: true },
    { prefix: '/measure/', dir: PATHS.measureApp },
    { prefix: '/assets/', dir: PATHS.assets },
  ];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'POST' && url.pathname.startsWith('/api/save/')) {
      const name = decodeURIComponent(url.pathname.slice('/api/save/'.length));
      if ((name !== 'layout-wide.json' && name !== 'layout-narrow.json') || req.headers['x-sine'] !== '1') {
        res.writeHead(403); res.end('not allowed'); return;
      }
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const file = path.join(PATHS.generated, name);
        fs.mkdirSync(PATHS.generated, { recursive: true });
        fs.writeFileSync(file, Buffer.concat(chunks));
        res.writeHead(200); res.end('saved');
      });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end('method not allowed'); return; }
    const route = routes.find((r) => url.pathname.startsWith(r.prefix));
    if (!route) { res.writeHead(404); res.end('not found'); return; }
    let rel = decodeURIComponent(url.pathname.slice(route.prefix.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    if (rel.split('/').some((p) => p.startsWith('.') || p === '..')) { res.writeHead(404); res.end('not found'); return; }
    const file = path.join(route.dir, rel);
    if (!file.startsWith(route.dir + path.sep)) { res.writeHead(404); res.end('not found'); return; }
    if (route.plain && path.resolve(file) === path.resolve(PATHS.plainPage)) {
      const html = injectHome(fs.readFileSync(file, 'utf8'));
      res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? '' : html);
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? '' : buf);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function cdpSocket(ws) {
  let next = 0;
  const pending = new Map();
  const taps = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result || {});
    } else if (msg.method) for (const fn of taps) fn(msg);
  });
  return {
    send(method, params = {}) {
      const id = ++next;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    on(fn) { taps.push(fn); },
  };
}

function openSocket(url) {
  const ws = new WebSocket(url);
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', () => reject(new Error('could not connect to Chrome')));
  });
}

async function waitForDevtools(port, proc) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error('Chrome exited before it was ready');
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/version');
      if (res.ok) return await res.json();
    } catch (e) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Chrome did not open a debugging port');
}

async function runChrome(measureUrl) {
  const chrome = await findChrome();
  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sine-measure-'));
  const args = [
    '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--user-data-dir=' + dataDir, '--remote-debugging-port=' + port,
  ];
  args.push(chrome.includes('headless-shell') ? '--headless' : '--headless=new');
  args.push('about:blank');
  const proc = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (c) => { stderr += c.toString(); });
  const logs = [];
  try {
    const version = await waitForDevtools(port, proc);
    const browserWs = await openSocket(version.webSocketDebuggerUrl);
    const browser = cdpSocket(browserWs);
    const created = await browser.send('Target.createTarget', { url: measureUrl });
    const pageWs = await openSocket('ws://127.0.0.1:' + port + '/devtools/page/' + created.targetId);
    const page = cdpSocket(pageWs);
    await page.send('Runtime.enable');
    page.on((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        logs.push((d.exception && d.exception.description) || d.text || 'exception');
      }
    });
    const deadline = Date.now() + 90000;
    let done = false;
    while (Date.now() < deadline) {
      const result = await page.send('Runtime.evaluate', {
        expression: 'window.__extractDone ? "done" : (window.__extractError || "")',
        returnByValue: true,
      });
      const value = result.result && result.result.value;
      if (value === 'done') { done = true; break; }
      if (value) throw new Error(value + (logs.length ? '\n' + logs.join('\n') : ''));
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!done) throw new Error('measuring the plain page timed out' + (logs.length ? '\n' + logs.join('\n') : '') + (stderr ? '\n' + stderr.slice(-500) : ''));
    browserWs.close();
    pageWs.close();
  } finally {
    proc.kill('SIGKILL');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

async function measureNow(posts) {
  const { server, port } = await startServer();
  try {
    await runChrome('http://127.0.0.1:' + port + '/measure/');
    assertMeasured(posts);
    const n = writeUsedGlyphs();
    console.log('Measured the plain page (' + n + ' letters in the sine home page).');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

let measuring = null;

export async function ensureMeasured({ required = false } = {}) {
  if (!measuring) {
    measuring = (async () => {
      const posts = publishedPosts();
      const next = homeStamp();
      const saved = fs.existsSync(STAMP) ? fs.readFileSync(STAMP, 'utf8').trim() : '';
      if (saved === next && layoutsReady()) return;
      console.log('Measuring the plain page for the sine layout...');
      await measureNow(posts);
      fs.writeFileSync(STAMP, next + '\n');
    })().finally(() => { measuring = null; });
  }
  try { await measuring; }
  catch (e) {
    const message = e instanceof BlogError ? e.message : (e && e.message) || String(e);
    if (required) throw new BlogError(message);
    console.error('Could not remeasure the sine page (' + message + '). The plain page is still up to date; the sine page may be one change behind.');
  }
}
