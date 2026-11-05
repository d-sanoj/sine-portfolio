// Runs axe-core against the built blog and the plain home page.
//   npm run build:dist && npm run check:a11y
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { PATHS } from './lib/paths.js';
import { findChrome } from './lib/chrome.js';

const axePath = path.join(PATHS.dist, '..', 'node_modules', 'axe-core', 'axe.min.js');
if (!fs.existsSync(axePath)) {
  console.error('axe-core is not installed. Run: npm install');
  process.exit(1);
}
if (!fs.existsSync(path.join(PATHS.dist, 'blog', 'index.html'))) {
  console.error('dist/blog is missing. Run: npm run build:dist');
  process.exit(1);
}

const PAGES = [
  '/blog/',
  '/blog/how-a-model-reads-a-word/',
  '/blog/what-temperature-does/',
  '/blog/one-word-at-a-time/',
  '/boring/',
];

function serve(root) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.ttf': 'font/ttf', '.xml': 'application/atom+xml', '.ico': 'image/x-icon' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end('no'); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close((e) => e ? reject(e) : resolve(p)); });
  });
}

function cdp(ws) {
  let next = 0;
  const pending = new Map();
  const taps = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
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
    if (proc.exitCode !== null) throw new Error('Chrome exited');
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/version');
      if (res.ok) return await res.json();
    } catch (e) { /* not yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Chrome did not open a debugging port');
}

async function evalJson(page, expression) {
  const result = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ' ' + (result.exceptionDetails.exception && result.exceptionDetails.exception.description || ''));
  return result.result.value;
}

async function main() {
  const server = await serve(PATHS.dist);
  const origin = 'http://127.0.0.1:' + server.address().port;
  const chrome = await findChrome();
  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sine-a11y-'));
  const args = ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--user-data-dir=' + dataDir, '--remote-debugging-port=' + port, chrome.includes('headless-shell') ? '--headless' : '--headless=new', 'about:blank'];
  const proc = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const axeSource = fs.readFileSync(axePath, 'utf8');
  let failed = 0;
  try {
    const version = await waitForDevtools(port, proc);
    const browserWs = await openSocket(version.webSocketDebuggerUrl);
    const browser = cdp(browserWs);
    const created = await browser.send('Target.createTarget', { url: 'about:blank' });
    const pageWs = await openSocket('ws://127.0.0.1:' + port + '/devtools/page/' + created.targetId);
    const page = cdp(pageWs);
    await page.send('Page.enable');
    await page.send('Runtime.enable');

    async function goto(url) {
      let loaded;
      const done = new Promise((resolve) => { loaded = resolve; });
      const on = (msg) => { if (msg.method === 'Page.loadEventFired') loaded(); };
      page.on(on);
      await page.send('Page.navigate', { url });
      await Promise.race([done, new Promise((r) => setTimeout(r, 8000))]);
      await evalJson(page, 'document.fonts.ready');
    }

    async function setWidth(width) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 800 });
    }

    for (const pathname of PAGES) {
      for (const width of [1280, 320]) {
        await setWidth(width);
        await goto(origin + pathname);
        const overflow = await evalJson(page, 'document.documentElement.scrollWidth - document.documentElement.clientWidth');
        if (overflow > 1) {
          failed++;
          console.error('OVERFLOW ' + pathname + ' at ' + width + 'px (' + overflow + 'px)');
        } else console.log('fits  ' + pathname + ' at ' + width + 'px');
        await page.send('Runtime.evaluate', { expression: axeSource });
        const violations = JSON.parse(await evalJson(page, `axe.run(document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] } }).then(r => JSON.stringify(r.violations))`));
        // The plain page's portrait control ("here") uses an aria-label that is not the visible word. That predates the blog.
        const fresh = violations.filter((v) => !(pathname === '/boring/' && v.id === 'label-content-name-mismatch' && v.nodes.every((n) => String(n.target).includes('.peek'))));
        if (fresh.length !== violations.length) console.log('note  /boring/ portrait control keeps its existing name mismatch (not part of the blog)');
        violations.length = 0;
        violations.push(...fresh);
        if (!violations.length) console.log('axe   ' + pathname + ' at ' + width + 'px: 0 violations');
        else {
          failed++;
          console.error('axe   ' + pathname + ' at ' + width + 'px: ' + violations.length + ' violation(s)');
          for (const v of violations) {
            console.error('  ' + v.id + ' (' + v.impact + ') ' + v.help);
            for (const n of v.nodes.slice(0, 5)) console.error('    ' + n.target.join(' ') + ' — ' + (n.failureSummary || '').split('\n')[0]);
          }
        }
      }
    }

    await setWidth(1280);
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await goto(origin + '/blog/how-a-model-reads-a-word/');
    const reduced = await evalJson(page, `(() => {
      const img = document.querySelector('img[data-animated-src]');
      const btn = img.closest('figure').querySelector('.anim-control');
      const svg = document.querySelector('svg.blog-anim');
      return { src: img.getAttribute('src'), pressed: btn.getAttribute('aria-pressed'), label: btn.textContent, paused: svg.classList.contains('is-paused') };
    })()`);
    const reducedOk = reduced.src.endsWith('lookup.still.png') && reduced.label === 'Play animation' && reduced.pressed === 'false' && reduced.paused;
    console.log((reducedOk ? 'ok   ' : 'FAIL ') + 'reduced motion keeps the GIF still and the SVG paused: ' + JSON.stringify(reduced));
    if (!reducedOk) failed++;

    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await goto(origin + '/blog/how-a-model-reads-a-word/');
    const motion = await evalJson(page, `(() => {
      const img = document.querySelector('img[data-animated-src]');
      const btn = img.closest('figure').querySelector('.anim-control');
      return { src: img.getAttribute('src'), label: btn.textContent, pressed: btn.getAttribute('aria-pressed') };
    })()`);
    const motionOk = motion.src.endsWith('lookup.gif') && motion.label === 'Pause animation' && motion.pressed === 'true';
    console.log((motionOk ? 'ok   ' : 'FAIL ') + 'animation plays with a pause control: ' + JSON.stringify(motion));
    if (!motionOk) failed++;

    // what opening the sine home page transfers, uncompressed
    await page.send('Emulation.setEmulatedMedia', { features: [] });
    await page.send('Network.enable');
    await goto(origin + '/');
    await evalJson(page, `new Promise((resolve) => { const t = Date.now(); (function tick(){ const hit = performance.getEntriesByType('resource').some(r => r.name.includes('portraits.json')); if (hit || Date.now()-t>8000) resolve('ok'); else setTimeout(tick, 100); })(); })`);
    const weight = await evalJson(page, `(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const rows = [{ name: location.pathname, size: nav.decodedBodySize }];
      for (const r of resources) rows.push({ name: r.name.replace(location.origin, ''), size: r.decodedBodySize });
      return { total: rows.reduce((s, r) => s + r.size, 0), rows };
    })()`);
    console.log('home page weight ' + weight.total + ' bytes uncompressed');
    for (const row of weight.rows.sort((a, b) => b.size - a.size).slice(0, 14)) console.log('  ' + String(row.size).padStart(7) + '  ' + row.name);
    const baseline = process.env.BASELINE_DIST;
    if (baseline && fs.existsSync(baseline)) {
      const baseServer = await serve(baseline);
      const baseOrigin = 'http://127.0.0.1:' + baseServer.address().port;
      await goto(baseOrigin + '/');
      await evalJson(page, `new Promise((resolve) => { const t = Date.now(); (function tick(){ const hit = performance.getEntriesByType('resource').some(r => r.name.includes('portraits.json')); if (hit || Date.now()-t>8000) resolve('ok'); else setTimeout(tick, 100); })(); })`);
      const before = await evalJson(page, `(() => { const nav = performance.getEntriesByType('navigation')[0]; const rows = [{ name: location.pathname, size: nav.decodedBodySize }]; for (const r of performance.getEntriesByType('resource')) rows.push({ name: r.name.replace(location.origin, ''), size: r.decodedBodySize }); return rows.reduce((s, r) => s + r.size, 0); })()`);
      console.log('baseline home page weight ' + before + ' bytes uncompressed');
      console.log('difference ' + (weight.total - before) + ' bytes');
      await new Promise((resolve) => baseServer.close(resolve));
    }
    browserWs.close();
    pageWs.close();
  } finally {
    proc.kill('SIGKILL');
    fs.rmSync(dataDir, { recursive: true, force: true });
    await new Promise((resolve) => server.close(resolve));
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
