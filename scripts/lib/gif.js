// GIF frames and small PNG/JPEG/SVG sizes. The blog build uses this to keep a still
// first frame of every animated GIF (no dependency, so the publish build stays small).
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
  return Buffer.concat([len, typeB, data, crc]);
}

// rgba: width * height * 4 bytes, top to bottom, straight alpha
export function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function lzwDecode(minCodeSize, data) {
  if (minCodeSize < 2 || minCodeSize > 8) throw new Error('bad gif code size');
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let dict = [];
  const clear = () => {
    dict = new Array(eoiCode + 1);
    codeSize = minCodeSize + 1;
    for (let i = 0; i < clearCode; i++) dict[i] = [i];
    dict[clearCode] = [];
    dict[eoiCode] = null;
  };
  clear();
  let pos = 0;
  const total = data.length * 8;
  const readCode = () => {
    if (pos + codeSize > total) return eoiCode;
    let code = 0;
    for (let i = 0; i < codeSize; i++) {
      if (data[pos >> 3] & (1 << (pos & 7))) code |= 1 << i;
      pos++;
    }
    return code;
  };
  const out = [];
  let code = null;
  while (true) {
    const last = code;
    code = readCode();
    if (code === clearCode) { clear(); continue; }
    if (code === eoiCode) break;
    if (last !== null && last !== clearCode && dict[last]) {
      if (code < dict.length && dict[code]) dict.push(dict[last].concat(dict[code][0]));
      else if (code === dict.length) dict.push(dict[last].concat(dict[last][0]));
      else throw new Error('corrupt gif');
    } else if (code >= dict.length || !dict[code]) {
      throw new Error('corrupt gif');
    }
    const entry = dict[code];
    if (!entry) throw new Error('corrupt gif');
    for (let i = 0; i < entry.length; i++) out.push(entry[i]);
    if (dict.length === (1 << codeSize) && codeSize < 12) codeSize++;
  }
  return out;
}

function deinterlace(indices, w, h) {
  const out = new Uint8Array(w * h);
  const passes = [[0, 8], [4, 8], [2, 4], [1, 2]];
  let i = 0;
  for (const [start, step] of passes) {
    for (let y = start; y < h; y += step) {
      for (let x = 0; x < w; x++) out[y * w + x] = indices[i++];
    }
  }
  if (i !== indices.length && i < w * h) {
    // a short index stream still paints the rows it has
  }
  return out;
}

// Reads a GIF. Throws if the bytes are not a GIF.
export function decodeGif(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const sig = b.toString('ascii', 0, 6);
  if (sig !== 'GIF87a' && sig !== 'GIF89a') throw new Error('not a gif');
  let p = 6;
  const width = b.readUInt16LE(p); p += 2;
  const height = b.readUInt16LE(p); p += 2;
  const packed = b[p++];
  const bgIndex = b[p++];
  p++; // pixel aspect
  const gctFlag = packed >> 7;
  const gctBytes = gctFlag ? 3 * (1 << ((packed & 7) + 1)) : 0;
  const gct = gctFlag ? b.subarray(p, p + gctBytes) : null;
  p += gctBytes;
  const frames = [];
  let gce = null;
  while (p < b.length) {
    const sep = b[p++];
    if (sep === 0x3b) break;
    if (sep === 0x21) {
      const label = b[p++];
      if (label === 0xf9) {
        p++; // block size (4)
        const gp = b[p++];
        p += 2; // delay
        const trans = b[p++];
        p++; // terminator
        gce = { transparent: (gp & 1) === 1, transIndex: trans };
      } else {
        while (p < b.length) {
          const size = b[p++];
          if (size === 0) break;
          p += size;
        }
      }
      continue;
    }
    if (sep !== 0x2c) throw new Error('bad gif block');
    const left = b.readUInt16LE(p); p += 2;
    const top = b.readUInt16LE(p); p += 2;
    const fw = b.readUInt16LE(p); p += 2;
    const fh = b.readUInt16LE(p); p += 2;
    const ip = b[p++];
    const lctFlag = ip >> 7;
    const interlace = (ip >> 6) & 1;
    const lctBytes = lctFlag ? 3 * (1 << ((ip & 7) + 1)) : 0;
    const lct = lctFlag ? b.subarray(p, p + lctBytes) : null;
    p += lctBytes;
    const minCodeSize = b[p++];
    const parts = [];
    while (p < b.length) {
      const size = b[p++];
      if (size === 0) break;
      parts.push(b.subarray(p, p + size));
      p += size;
    }
    const indices = lzwDecode(minCodeSize, Buffer.concat(parts));
    const pixels = interlace ? deinterlace(indices, fw, fh) : indices;
    frames.push({ left, top, width: fw, height: fh, pixels, colorTable: lct || gct, gce });
    gce = null;
  }
  return { width, height, bgIndex, gct, frames };
}

function blit(rgba, width, frame) {
  const table = frame.colorTable;
  if (!table) throw new Error('gif frame has no colour table');
  const transparent = frame.gce && frame.gce.transparent;
  const trans = frame.gce ? frame.gce.transIndex : -1;
  const pixels = frame.pixels;
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      const idx = pixels[y * frame.width + x];
      const dx = frame.left + x;
      const dy = frame.top + y;
      if (dx < 0 || dy < 0 || dx >= width || dy >= rgba.length / 4 / width) continue;
      const o = (dy * width + dx) * 4;
      if (transparent && idx === trans) {
        rgba[o] = rgba[o + 1] = rgba[o + 2] = rgba[o + 3] = 0;
        continue;
      }
      const c = idx * 3;
      if (c + 2 >= table.length) continue;
      rgba[o] = table[c];
      rgba[o + 1] = table[c + 1];
      rgba[o + 2] = table[c + 2];
      rgba[o + 3] = 255;
    }
  }
}

// First frame as RGBA, plus whether the file has more than one frame.
export function gifFirstFrame(buf) {
  const gif = decodeGif(buf);
  if (!gif.frames.length) throw new Error('gif has no frames');
  const rgba = Buffer.alloc(gif.width * gif.height * 4, 0);
  if (gif.gct && gif.bgIndex * 3 + 2 < gif.gct.length) {
    const r = gif.gct[gif.bgIndex * 3];
    const g = gif.gct[gif.bgIndex * 3 + 1];
    const b = gif.gct[gif.bgIndex * 3 + 2];
    for (let i = 0; i < gif.width * gif.height; i++) {
      rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255;
    }
  }
  blit(rgba, gif.width, gif.frames[0]);
  return { width: gif.width, height: gif.height, rgba, frames: gif.frames.length, animated: gif.frames.length > 1 };
}

export function pngSize(buf) {
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export function gifSize(buf) {
  if (buf.length < 10 || buf.toString('ascii', 0, 3) !== 'GIF') return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

// JPEG start-of-frame, enough to know the pixel size.
export function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let p = 2;
  while (p + 8 < buf.length) {
    if (buf[p] !== 0xff) { p++; continue; }
    const marker = buf[p + 1];
    if (marker === 0xd8 || marker === 0xd9) { p += 2; continue; }
    const len = buf.readUInt16BE(p + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(p + 5), width: buf.readUInt16BE(p + 7) };
    }
    p += 2 + len;
  }
  return null;
}

export function imageSize(buf) {
  return pngSize(buf) || gifSize(buf) || jpegSize(buf);
}
