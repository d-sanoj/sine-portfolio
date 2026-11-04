// Makes the tab icon: a solid yellow wobbly circle (an amoeba), drawn from a few sine waves like everything else on the site.
//
//   node scripts/make-favicon.js        writes assets/favicon.svg, favicon-32.png, apple-touch-icon.png and favicon.ico
//
// The shape is a circle whose radius wobbles: r(angle) = R * (1 + sum of a few small cosine waves of the angle). Change WAVES to
// change the blob. No libraries are needed: the PNGs are drawn here (with smooth edges) and the .ico just wraps the 32 px PNG.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PATHS } from './lib/paths.js';

const YELLOW = '#f2c14e'; // LINK_YELLOW in apps/site/app/config.js
const BACKGROUND = '#131313'; // the page colour, behind the blob in the iPhone home-screen icon
const WAVES = [ // [frequency around the circle, size as a share of the radius, phase]
  [2, 0.115, 0.6],
  [3, 0.085, 2.4],
  [5, 0.035, 4.1],
];
const POINTS = 120;

// the outline, as points around the centre (0, 0); `reach` is how far the widest lobe reaches
const factor = (a) => 1 + WAVES.reduce((s, [k, amp, ph]) => s + amp * Math.cos(k * a + ph), 0);
const WIDEST = Math.max(...Array.from({ length: 720 }, (_, i) => factor((2 * Math.PI * i) / 720)));
function outline(reach) {
  const R = reach / WIDEST;
  const pts = [];
  for (let i = 0; i < POINTS; i++) {
    const a = (2 * Math.PI * i) / POINTS;
    pts.push([R * factor(a) * Math.cos(a), R * factor(a) * Math.sin(a)]);
  }
  return pts;
}

// ----- the SVG: 100 x 100, the blob fills it -----
const svgPoints = outline(47).map(([x, y]) => [+(50 + x).toFixed(2), +(50 + y).toFixed(2)]);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="${YELLOW}" d="M${svgPoints.map((p) => p.join(' ')).join('L')}Z"/></svg>\n`;

// ----- the PNGs: draw the same shape at a size, with edges smoothed by sampling 4 x 4 points per pixel -----
function inside(pts, x, y) { // even-odd test: is (x, y) inside the polygon?
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function raster(size, reachShare, background) {
  const blob = outline(reachShare * size).map(([x, y]) => [x + size / 2, y + size / 2]);
  const [r, g, b] = hex(YELLOW), bg = background ? hex(background) : null;
  const S = 4, buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hit = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) if (inside(blob, px + (sx + 0.5) / S, py + (sy + 0.5) / S)) hit++;
      const a = hit / (S * S), o = (py * size + px) * 4;
      if (bg) { // opaque background, the blob over it
        buf[o] = Math.round(bg[0] + (r - bg[0]) * a); buf[o + 1] = Math.round(bg[1] + (g - bg[1]) * a); buf[o + 2] = Math.round(bg[2] + (b - bg[2]) * a); buf[o + 3] = 255;
      } else { // transparent background
        buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = Math.round(255 * a);
      }
    }
  }
  return png(size, buf);
}

const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const byte of buf) c = CRC[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0); head.writeUInt32BE(size, 4); head[8] = 8; head[9] = 6; // 8 bits per channel, RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); // each row starts with filter byte 0
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function ico(png32) { // an .ico file that holds one 32 x 32 PNG
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); // icon, one image
  head[6] = 32; head[7] = 32; head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); // 32 x 32, 32 bits
  head.writeUInt32LE(png32.length, 14); head.writeUInt32LE(22, 18);
  return Buffer.concat([head, png32]);
}

const png32 = raster(32, 0.47, null);
const out = PATHS.assets;
fs.writeFileSync(path.join(out, 'favicon.svg'), svg);
fs.writeFileSync(path.join(out, 'favicon-32.png'), png32);
fs.writeFileSync(path.join(out, 'favicon.ico'), ico(png32));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), raster(180, 0.34, BACKGROUND));
console.log('Made assets/favicon.svg, favicon-32.png, favicon.ico and apple-touch-icon.png');
