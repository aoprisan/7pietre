// Generate PWA icons as PNGs with ZERO third-party deps.
// Uses Node's built-in zlib for DEFLATE; PNG container + CRC32 written by hand.
// This is dev-time tooling only — nothing here ships in the runtime bundle.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
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
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // raw scanlines with filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- tiny software rasterizer over an RGBA buffer ---
function makeCanvas(w, h) {
  const buf = Buffer.alloc(w * h * 4);
  const blend = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return;
    const i = (y * w + x) * 4;
    const ia = 1 - a;
    buf[i] = Math.round(r * a + buf[i] * ia);
    buf[i + 1] = Math.round(g * a + buf[i + 1] * ia);
    buf[i + 2] = Math.round(b * a + buf[i + 2] * ia);
    buf[i + 3] = Math.min(255, Math.round(a * 255 + buf[i + 3] * ia));
  };
  return {
    buf, w, h,
    fill(r, g, b, a = 1) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) blend(x, y, r, g, b, a);
    },
    rect(x0, y0, rw, rh, r, g, b, a = 1, radius = 0) {
      for (let y = y0; y < y0 + rh; y++) {
        for (let x = x0; x < x0 + rw; x++) {
          if (radius > 0) {
            const cx = Math.max(x0 + radius, Math.min(x, x0 + rw - radius));
            const cy = Math.max(y0 + radius, Math.min(y, y0 + rh - radius));
            if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
          }
          blend(x, y, r, g, b, a);
        }
      }
    },
    circle(cx, cy, rad, r, g, b, a = 1) {
      for (let y = Math.floor(cy - rad); y <= cy + rad; y++) {
        for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
          const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (d <= rad) blend(x, y, r, g, b, a);
          else if (d <= rad + 1) blend(x, y, r, g, b, a * (rad + 1 - d));
        }
      }
    },
  };
}

function drawIcon(size, maskable) {
  const c = makeCanvas(size, size);
  const pad = maskable ? size * 0.16 : 0; // keep art inside the maskable safe zone
  const s = size - pad * 2;
  const ox = pad, oy = pad;
  // dusk courtyard background
  c.fill(0x2b, 0x20, 0x2e); // deep dusk
  c.rect(0, 0, size, size, 0xe7, 0x9a, 0x55, 0.0); // (noop base)
  // sky band
  for (let y = 0; y < size; y++) {
    const t = y / size;
    const r = Math.round(0x3a + (0xe7 - 0x3a) * Math.max(0, 0.55 - t) / 0.55);
    const g = Math.round(0x2c + (0x9a - 0x2c) * Math.max(0, 0.55 - t) / 0.55);
    const b = Math.round(0x3a + (0x55 - 0x3a) * Math.max(0, 0.55 - t) / 0.55);
    c.rect(0, y, size, 1, r, g, b, 1);
  }
  // ground
  c.rect(0, oy + s * 0.62, size, size - (oy + s * 0.62), 0x6a, 0x60, 0x57, 1);
  // chalk base circle
  c.circle(ox + s * 0.5, oy + s * 0.74, s * 0.2, 0xe9, 0xe2, 0xcf, 0.25);
  // stack of stones (warm slate), tapering
  const cx = ox + s * 0.5;
  const baseY = oy + s * 0.78;
  const stones = [
    [0.30, 0xb8, 0x6b, 0x4a],
    [0.26, 0x9c, 0x8a, 0x6f],
    [0.22, 0xc9, 0x8a, 0x5a],
    [0.18, 0x8a, 0x96, 0x8f],
    [0.14, 0xd9, 0xb0, 0x6a],
  ];
  let y = baseY;
  for (const [wFrac, r, g, b] of stones) {
    const sw = s * wFrac;
    const sh = s * 0.085;
    y -= sh + s * 0.012;
    c.rect(cx - sw / 2, y, sw, sh, r, g, b, 1, sh * 0.35);
    c.rect(cx - sw / 2, y, sw, sh * 0.4, 0xff, 0xff, 0xff, 0.08, sh * 0.35);
  }
  // a ball
  c.circle(ox + s * 0.78, oy + s * 0.5, s * 0.075, 0xe8, 0x5a, 0x3a, 1);
  c.circle(ox + s * 0.762, oy + s * 0.482, s * 0.03, 0xff, 0xd8, 0xb0, 0.5);
  return encodePng(size, size, c.buf);
}

const outDir = process.argv[2] || 'dist/icons';
mkdirSync(outDir, { recursive: true });

const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-192.png', 192, true],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
];
for (const [name, size, maskable] of targets) {
  const png = drawIcon(size, maskable);
  const p = join(outDir, name);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, png);
  console.log('icon ->', p, `(${png.length} bytes)`);
}
