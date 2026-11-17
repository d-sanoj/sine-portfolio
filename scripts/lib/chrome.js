// Finds a Chrome to measure with. The publish build runs on a machine that may not have one,
// so a missing browser is downloaded once (Chrome for Testing's headless shell).
// CI sets CHROME_PATH to a browser installed by browser-actions/setup-chrome.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { PATHS } from './paths.js';

const CATALOG = 'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json';
const DEBUG_WAIT_MS = 60000;
const LAUNCH_ATTEMPTS = 3;

function cacheDir() {
  const inModules = path.join(PATHS.dist, '..', 'node_modules', '.cache', 'sine-chrome');
  return fs.existsSync(path.join(PATHS.dist, '..', 'node_modules')) ? inModules : path.join(PATHS.dist, '..', '.cache', 'sine-chrome');
}

function platform() {
  if (process.platform === 'darwin') return process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
  if (process.platform === 'win32') return 'win64';
  return 'linux64';
}

function systemChrome() {
  if (process.env.SINE_MEASURE_CHROME === 'download') return null;
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'];
  const dirs = (process.env.PATH || '').split(path.delimiter).concat(['/usr/bin', '/usr/local/bin']);
  for (const dir of dirs) {
    for (const name of names) {
      const file = path.join(dir, name);
      if (file && fs.existsSync(file)) return file;
    }
  }
  return null;
}

function findBinary(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findBinary(full);
      if (found) return found;
    } else if (entry.name === 'chrome-headless-shell' || entry.name === 'chrome-headless-shell.exe') return full;
  }
  return null;
}

async function downloadChrome() {
  const res = await fetch(CATALOG);
  if (!res.ok) throw new Error('could not look up Chrome for Testing (' + res.status + ')');
  const catalog = await res.json();
  const version = catalog.channels.Stable.version;
  const plat = platform();
  const item = (catalog.channels.Stable.downloads['chrome-headless-shell'] || []).find((d) => d.platform === plat);
  if (!item) throw new Error('no chrome-headless-shell build for ' + plat);
  const dest = path.join(cacheDir(), version);
  const existing = fs.existsSync(dest) ? findBinary(dest) : null;
  if (existing) return existing;
  fs.mkdirSync(dest, { recursive: true });
  const zip = path.join(os.tmpdir(), 'chrome-headless-shell-' + version + '.zip');
  console.log('Downloading Chrome ' + version + ' (needed to measure the sine page; kept for next time)...');
  const bin = await fetch(item.url);
  if (!bin.ok) throw new Error('could not download Chrome (' + bin.status + ')');
  await pipeline(Readable.fromWeb(bin.body), createWriteStream(zip));
  execFileSync('python3', ['-c', 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zip, dest], { stdio: 'inherit' });
  fs.rmSync(zip, { force: true });
  const binary = findBinary(dest);
  if (!binary) throw new Error('Chrome downloaded but the browser binary was not in the archive');
  fs.chmodSync(binary, 0o755);
  return binary;
}

export async function findChrome() {
  return systemChrome() || downloadChrome();
}

function chromeArgs(binary, dataDir) {
  return [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--user-data-dir=' + dataDir,
    // Port 0 lets Chrome pick a free port and write it to DevToolsActivePort,
    // avoiding the race of reserving a port, closing it, then handing it to Chrome.
    '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1',
    binary.includes('headless-shell') ? '--headless' : '--headless=new',
    'about:blank',
  ];
}

function readDevToolsPort(dataDir) {
  const file = path.join(dataDir, 'DevToolsActivePort');
  if (!fs.existsSync(file)) return null;
  try {
    const first = fs.readFileSync(file, 'utf8').split('\n')[0].trim();
    const port = Number(first);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch (e) {
    return null;
  }
}

function withStderr(message, stderr) {
  const text = stderr && stderr.buf ? stderr.buf.trim().slice(-2000) : '';
  return text ? message + ':\n' + text : message;
}

async function waitForDevtools(proc, dataDir, stderr) {
  const deadline = Date.now() + DEBUG_WAIT_MS;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(withStderr('Chrome exited before it was ready', stderr));
    const port = readDevToolsPort(dataDir);
    if (port) {
      try {
        const res = await fetch('http://127.0.0.1:' + port + '/json/version');
        if (res.ok) return { port, version: await res.json() };
      } catch (e) { /* file exists but the port is not accepting yet */ }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(withStderr('Chrome did not open a debugging port', stderr));
}

export async function stopChrome(proc, dataDir) {
  if (proc && proc.exitCode === null) proc.kill('SIGKILL');
  if (proc) {
    await new Promise((resolve) => {
      if (proc.exitCode !== null) return resolve();
      const timer = setTimeout(resolve, 5000);
      proc.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
  if (!dataDir) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
      break;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

async function tryLaunch(binary, dataDir) {
  const proc = spawn(binary, chromeArgs(binary, dataDir), { stdio: ['ignore', 'ignore', 'pipe'] });
  const stderr = { buf: '' };
  proc.stderr.on('data', (c) => { stderr.buf += c.toString(); });
  proc.on('error', (err) => { stderr.buf += String(err.message || err) + '\n'; });
  try {
    const started = await waitForDevtools(proc, dataDir, stderr);
    return { proc, port: started.port, version: started.version, stderr };
  } catch (e) {
    await stopChrome(proc, null);
    throw e;
  }
}

export async function launchChrome() {
  const binary = await findChrome();
  console.log('Using Chrome at ' + binary);
  let lastError;
  for (let attempt = 1; attempt <= LAUNCH_ATTEMPTS; attempt++) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sine-chrome-'));
    try {
      const started = await tryLaunch(binary, dataDir);
      return { ...started, dataDir, binary };
    } catch (e) {
      lastError = e;
      console.warn('Chrome start attempt ' + attempt + ' of ' + LAUNCH_ATTEMPTS + ' failed: ' + e.message);
      await stopChrome(null, dataDir);
      if (attempt < LAUNCH_ATTEMPTS) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastError;
}
