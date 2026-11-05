// Finds a Chrome to measure with. The publish build runs on a machine that may not have one,
// so a missing browser is downloaded once (Chrome for Testing's headless shell).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { PATHS } from './paths.js';

const CATALOG = 'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json';

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
