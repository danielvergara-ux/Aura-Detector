#!/usr/bin/env node
/**
 * Generates the PWA icon set.
 *
 * Icons are drawn procedurally and encoded as PNG with zlib, so the repository
 * carries no binary assets and the mark can be restyled by editing numbers
 * here. Runs automatically on `prebuild`; run manually with `npm run icons`.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* --------------------------- PNG encoding --------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

/** Encodes an RGBA buffer (width*height*4) as a PNG. */
function encodePng(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Each scanline is prefixed with filter type 0 (none).
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ----------------------------- The mark ----------------------------- */

const AURA = [167, 139, 255];
const AURA_2 = [92, 214, 255];

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * Concentric aura rings around a bright core.
 * `padding` shrinks the mark for maskable icons, whose outer 10% can be cropped.
 */
function drawIcon(size, { padding = 0 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const usable = center * (1 - padding);

  const rings = [
    { radius: 0.92, width: 0.055, alpha: 0.55 },
    { radius: 0.7, width: 0.06, alpha: 0.85 },
    { radius: 0.46, width: 0.085, alpha: 1 },
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const dist = Math.sqrt(dx * dx + dy * dy) / usable;
      const index = (y * size + x) * 4;

      // Background: near-black with a soft aura bloom.
      const bloom = Math.max(0, 1 - dist * 1.05) ** 2.2;
      let [r, g, b] = mix([5, 5, 9], AURA, bloom * 0.5);

      // Hot core
      const core = Math.max(0, 1 - dist / 0.3);
      if (core > 0) {
        [r, g, b] = mix([r, g, b], [255, 255, 255], Math.min(1, core ** 2.4));
      }

      // Rings, antialiased by distance to the ring centreline.
      for (const ring of rings) {
        const delta = Math.abs(dist - ring.radius);
        const edge = 1 - Math.min(1, delta / ring.width);
        if (edge > 0) {
          const tone = mix(AURA, AURA_2, ring.radius * 0.7);
          [r, g, b] = mix([r, g, b], tone, edge ** 1.2 * ring.alpha);
        }
      }

      rgba[index] = r;
      rgba[index + 1] = g;
      rgba[index + 2] = b;
      // Rounded-square alpha so it looks intentional on both iOS and Android.
      const corner = Math.max(Math.abs(dx), Math.abs(dy)) / center;
      rgba[index + 3] = corner > 0.995 ? 0 : 255;
    }
  }

  return encodePng(rgba, size, size);
}

/**
 * Static fallback for the social card (1200×630).
 *
 * `next/og` renders the real cards at request time, but it cannot run when the
 * project path contains a space (a known @vercel/og limitation on Windows), so
 * the image routes fall back to this file instead of returning an error.
 */
function drawOgFallback(width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  const cx = width / 2;
  const cy = height * 0.46;
  const unit = height / 2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / unit;
      const index = (y * width + x) * 4;

      const bloom = Math.max(0, 1 - dist * 0.62) ** 2;
      let [r, g, b] = mix([5, 5, 9], mix(AURA_2, AURA, 0.6), bloom * 0.7);

      for (const ring of [0.55, 0.8, 1.05]) {
        const edge = 1 - Math.min(1, Math.abs(dist - ring) / 0.02);
        if (edge > 0) [r, g, b] = mix([r, g, b], AURA, edge * 0.7);
      }

      rgba[index] = r;
      rgba[index + 1] = g;
      rgba[index + 2] = b;
      rgba[index + 3] = 255;
    }
  }
  return encodePng(rgba, width, height);
}

/* ------------------------------- Write ------------------------------ */

const targets = [
  { path: 'public/icons/icon-192.png', size: 192 },
  { path: 'public/icons/icon-512.png', size: 512 },
  { path: 'public/icons/icon-maskable-512.png', size: 512, options: { padding: 0.22 } },
  { path: 'public/apple-touch-icon.png', size: 180 },
];

mkdirSync(join(root, 'public/icons'), { recursive: true });

for (const target of targets) {
  const png = drawIcon(target.size, target.options ?? {});
  writeFileSync(join(root, target.path), png);
  console.log(`icons: wrote ${target.path} (${png.length} bytes)`);
}

const og = drawOgFallback(1200, 630);
writeFileSync(join(root, 'public/og-fallback.png'), og);
console.log(`icons: wrote public/og-fallback.png (${og.length} bytes)`);
