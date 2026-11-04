// Local dev server: shows every app at its real address and lets the tools save into data/.
//   npm run dev        then open  http://localhost:5173/            the sine site
//                                 http://localhost:5173/boring/     the plain site
//                                 http://localhost:5173/designer/   the letter designer
//                                 http://localhost:5173/measure/    measures the plain page
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from '../scripts/lib/paths.js';
import { ROUTES, WRITABLE } from './routes.js';

const PORT = +process.env.PORT || 5173;
for (const dir of [PATHS.source, PATHS.generated, PATHS.preview]) fs.mkdirSync(dir, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};
const MAX_BODY = 20 * 1024 * 1024;
const BY_LENGTH = [...ROUTES].sort((a, b) => b.prefix.length - a.prefix.length);

function send(res, code, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra });
  res.end(body);
}

function saveFile(req, res, name) {
  // The custom header forces a browser preflight, so other websites can't write here.
  if (!Object.hasOwn(WRITABLE, name) || req.headers['x-sine'] !== '1') return send(res, 403, 'not allowed');
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_BODY) { req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    const file = WRITABLE[name];
    const tmp = file + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFile(tmp, Buffer.concat(chunks), (err) => {
      if (err) return send(res, 500, 'write failed');
      return fs.rename(tmp, file, (err2) => (err2 ? send(res, 500, 'write failed') : send(res, 200, 'saved')));
    });
  });
  return undefined;
}

function serveFile(req, res, pathname) {
  const route = BY_LENGTH.find((r) => pathname.startsWith(r.prefix));
  if (!route) return send(res, 404, 'not found');
  let rel = decodeURIComponent(pathname.slice(route.prefix.length));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.join(route.dir, rel);
  const inside = file.startsWith(route.dir + path.sep);
  const hidden = rel.split('/').some((p) => p.startsWith('.'));
  if (!inside || hidden) return send(res, 404, 'not found');
  return fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'not found');
    return send(res, 200, req.method === 'HEAD' ? '' : buf, TYPES[path.extname(file)] || 'application/octet-stream');
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/ping') return send(res, 200, 'ok');
  if (req.method === 'POST' && url.pathname.startsWith('/api/save/')) return saveFile(req, res, decodeURIComponent(url.pathname.slice('/api/save/'.length)));
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
  // /boring -> /boring/ so relative links inside the app resolve
  const bare = ROUTES.find((r) => r.prefix.length > 1 && url.pathname === r.prefix.slice(0, -1) && r.prefix !== '/data/');
  if (bare) return send(res, 301, '', 'text/plain', { Location: bare.prefix });
  return serveFile(req, res, url.pathname);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Sine site:      http://localhost:' + PORT + '/');
  console.log('Plain site:     http://localhost:' + PORT + '/boring/');
  console.log('Designer:       http://localhost:' + PORT + '/designer/');
  console.log('Measure tool:   http://localhost:' + PORT + '/measure/');
});
