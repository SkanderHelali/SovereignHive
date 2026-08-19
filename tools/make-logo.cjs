'use strict';
/**
 * SovereignHive brand mark — Sovereign Cypherpunk Honeycomb & Nostr Lightning Bolt.
 *
 * THE SVG IS THE SOURCE OF TRUTH.
 * Pure vector + self-contained mathematical distance-field rasterizer:
 *   docs/logo.svg          source of truth vector (full bleed, electric violet border)
 *   docs/logo.png          512  — site favicon, site header (dark), in-app toolbar
 *   docs/logo-light.png    512  — light variant with cyan accents
 *   docs/favicon-32.png     32  — native-size crisp favicon
 *   docs/apple-touch-icon.png 180
 *   build/icon.svg         app icon design source
 *   build/icon.png        1024  — Linux AppImage, and electron-builder base
 *   build/icon.ico               — Windows full-bleed multi-res ICO (16..256)
 *
 *   node tools/make-sovereign-logo.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');

// ── Palette (Inspired by helali.org + Nostr Cypherpunk) ───────────────────
const PALETTE = {
  obsidianDeep: [10, 8, 16],       // #0A0810 - Background
  obsidianPaper: [18, 15, 28],     // #120F1C - Surface
  obsidianSurface: [28, 22, 44],   // #1C162C - Elevated
  violetGlow: [139, 92, 246],      // #8B5CF6 - Electric Violet
  violetLight: [196, 181, 253],    // #C4B5FD - Violet highlight
  violetDark: [76, 29, 149],       // #4C1D95 - Deep Violet mesh
  cyanAccent: [56, 189, 248],      // #38BDF8 - Cyber Cyan
  cyanLight: [186, 230, 253],      // #BAE6FD - Cyan highlight
  goldBolt: [245, 158, 11],        // #F59E0B - Nostr Gold
  goldLight: [253, 224, 71],       // #FDE047 - Core bolt highlight
  white: [255, 255, 255]
};

// ── PNG Encoding ──────────────────────────────────────────────────────────
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(N, rgba) {
  const stride = N * 4 + 1;
  const raw = Buffer.alloc(N * stride);
  for (let y = 0; y < N; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * N * 4, (y + 1) * N * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ── Distance Field Math ───────────────────────────────────────────────────
function sdRoundRect(px, py, x, y, w, h, r) {
  const cx = x + w / 2, cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r), qy = Math.abs(py - cy) - (h / 2 - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdHexagon(px, py, cx, cy, r) {
  const qx = Math.abs(px - cx), qy = Math.abs(py - cy);
  const k = Math.sqrt(3);
  const d = Math.max(qy - r, (qx * k + qy) * 0.5 - r);
  return d;
}

// Point in polygon test for lightning bolt
function isPointInBolt(px, py) {
  const poly = [
    [540, 240],
    [385, 500],
    [485, 500],
    [430, 770],
    [640, 460],
    [530, 460]
  ];

  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ── Vector SVG Construction ───────────────────────────────────────────────
function buildSvg(N = 1024, isLight = false) {
  const bg = isLight ? '#0F0D1A' : '#0A0810';
  const border = isLight ? '#38BDF8' : '#8B5CF6';
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1A1429" />
      <stop offset="50%" stop-color="#0E0B18" />
      <stop offset="100%" stop-color="#06040A" />
    </linearGradient>

    <linearGradient id="violetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A78BFA" />
      <stop offset="100%" stop-color="#6D28D9" />
    </linearGradient>

    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#0284C7" />
    </linearGradient>

    <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE047" />
      <stop offset="60%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>

    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <clipPath id="tileClip">
      <rect x="32" y="32" width="960" height="960" rx="180" />
    </clipPath>
  </defs>

  <g clip-path="url(#tileClip)">
    <!-- Dark Cypherpunk Background -->
    <rect x="32" y="32" width="960" height="960" fill="url(#bgGrad)" />

    <!-- Honeycomb Mesh Network (Hexagons) -->
    <!-- Top Center -->
    <polygon points="512,180 620,242 620,366 512,428 404,366 404,242" fill="#1C1430" stroke="#8B5CF6" stroke-width="6" stroke-opacity="0.4" />
    <!-- Top Right -->
    <polygon points="730,305 838,367 838,491 730,553 622,491 622,367" fill="#151024" stroke="#38BDF8" stroke-width="6" stroke-opacity="0.3" />
    <!-- Bottom Right -->
    <polygon points="730,575 838,637 838,761 730,823 622,761 622,637" fill="#1C1430" stroke="#8B5CF6" stroke-width="6" stroke-opacity="0.3" />
    <!-- Bottom Center -->
    <polygon points="512,700 620,762 620,886 512,948 404,886 404,762" fill="#151024" stroke="#38BDF8" stroke-width="6" stroke-opacity="0.4" />
    <!-- Bottom Left -->
    <polygon points="294,575 402,637 402,761 294,823 186,761 186,637" fill="#1C1430" stroke="#8B5CF6" stroke-width="6" stroke-opacity="0.3" />
    <!-- Top Left -->
    <polygon points="294,305 402,367 402,491 294,553 186,491 186,367" fill="#151024" stroke="#38BDF8" stroke-width="6" stroke-opacity="0.3" />

    <!-- Inter-node Mesh Connections -->
    <line x1="512" y1="304" x2="730" y2="429" stroke="#8B5CF6" stroke-width="8" stroke-opacity="0.6" stroke-dasharray="12,12" />
    <line x1="730" y1="429" x2="730" y2="699" stroke="#38BDF8" stroke-width="8" stroke-opacity="0.6" />
    <line x1="730" y1="699" x2="512" y2="824" stroke="#8B5CF6" stroke-width="8" stroke-opacity="0.6" stroke-dasharray="12,12" />
    <line x1="512" y1="824" x2="294" y2="699" stroke="#38BDF8" stroke-width="8" stroke-opacity="0.6" />
    <line x1="294" y1="699" x2="294" y2="429" stroke="#8B5CF6" stroke-width="8" stroke-opacity="0.6" stroke-dasharray="12,12" />
    <line x1="294" y1="429" x2="512" y2="304" stroke="#38BDF8" stroke-width="8" stroke-opacity="0.6" />

    <!-- Central Sovereign Node Hexagon -->
    <polygon points="512,330 680,427 680,621 512,718 344,621 344,427" fill="#241544" stroke="url(#violetGrad)" stroke-width="16" />
    <polygon points="512,360 650,440 650,600 512,680 374,600 374,440" fill="#170B2E" stroke="#38BDF8" stroke-width="6" stroke-opacity="0.7" />

    <!-- Electric Nostr Lightning Bolt -->
    <path d="M 540,240 
             L 385,500 
             L 485,500 
             L 430,770 
             L 640,460 
             L 530,460 
             Z"
          fill="url(#boltGrad)" 
          stroke="#FFF" 
          stroke-width="8"
          filter="url(#neonGlow)" />

    <!-- Peer Connection Nodes (Glowing dots) -->
    <circle cx="512" cy="180" r="16" fill="#38BDF8" />
    <circle cx="730" cy="305" r="16" fill="#8B5CF6" />
    <circle cx="730" cy="823" r="16" fill="#38BDF8" />
    <circle cx="512" cy="948" r="16" fill="#8B5CF6" />
    <circle cx="186" cy="761" r="16" fill="#38BDF8" />
    <circle cx="186" cy="367" r="16" fill="#8B5CF6" />
  </g>

  <!-- Cypherpunk Neon Frame Border -->
  <rect x="32" y="32" width="960" height="960" rx="180" fill="none" stroke="${border}" stroke-width="24" />
</svg>
`;
}

// ── Multi-res Pixel Rasterizer ────────────────────────────────────────────
function rasterise(N, isLight = false) {
  const SS = 4;
  const out = Buffer.alloc(N * N * 4);
  const border = isLight ? PALETTE.cyanAccent : PALETTE.violetGlow;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let cov = 0, ink = 0, rSum = 0, gSum = 0, bSum = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = ((x + (sx + 0.5) / SS) / N) * 1024;
          const py = ((y + (sy + 0.5) / SS) / N) * 1024;

          const dTile = sdRoundRect(px, py, 32, 32, 960, 960, 180);
          if (dTile > 12) continue;
          cov++;

          if (dTile > -12) {
            ink++;
            continue;
          }

          // Core art color sampling
          const dHexCenter = sdHexagon(px, py, 512, 524, 180);
          const dHexOuter = sdHexagon(px, py, 512, 524, 300);

          let c = PALETTE.obsidianDeep;

          // Background gradient
          const gradT = (px + py) / 2048;
          c = [
            Math.round(PALETTE.obsidianPaper[0] * (1 - gradT) + PALETTE.obsidianDeep[0] * gradT),
            Math.round(PALETTE.obsidianPaper[1] * (1 - gradT) + PALETTE.obsidianDeep[1] * gradT),
            Math.round(PALETTE.obsidianPaper[2] * (1 - gradT) + PALETTE.obsidianDeep[2] * gradT)
          ];

          // Outer hex ring
          if (dHexOuter <= 0 && dHexOuter > -15) {
            c = PALETTE.violetDark;
          }

          // Center hex plate
          if (dHexCenter <= 0) {
            if (dHexCenter > -12) {
              c = PALETTE.violetGlow;
            } else if (dHexCenter > -20) {
              c = PALETTE.cyanAccent;
            } else {
              c = PALETTE.obsidianSurface;
            }
          }

          // Lightning Bolt check
          const inBolt = isPointInBolt(px, py);
          if (inBolt) {
            const boltY = (py - 240) / 530;
            c = [
              Math.round(PALETTE.goldLight[0] * (1 - boltY) + PALETTE.goldBolt[0] * boltY),
              Math.round(PALETTE.goldLight[1] * (1 - boltY) + PALETTE.goldBolt[1] * boltY),
              Math.round(PALETTE.goldLight[2] * (1 - boltY) + PALETTE.goldBolt[2] * boltY)
            ];
          }

          rSum += c[0]; gSum += c[1]; bSum += c[2];
        }
      }

      if (!cov) continue;
      const tileA = cov / (SS * SS);
      const i = (y * N + x) * 4;

      out[i] = Math.round((rSum + ink * border[0]) / cov);
      out[i + 1] = Math.round((gSum + ink * border[1]) / cov);
      out[i + 2] = Math.round((bSum + ink * border[2]) / cov);
      out[i + 3] = Math.round(tileA * 255);
    }
  }

  return encodePng(N, out);
}

// ── ICO Container Builder ─────────────────────────────────────────────────
function buildIco(pngs) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(pngs.length, 4);
  let offset = 6 + pngs.length * 16;
  const entries = [], bodies = [];
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e[2] = 0; e[3] = 0;
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); bodies.push(data);
    offset += data.length;
  }
  return Buffer.concat([dir, ...entries, ...bodies]);
}

// ── Generate All Brand & App Assets ───────────────────────────────────────
const D = (p) => path.join(ROOT, p);
const wrote = [];
const write = (rel, buf) => {
  const full = D(rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buf);
  wrote.push(`${rel.padEnd(28)} ${(buf.length / 1024).toFixed(1)} KB`);
};

console.log('Generating SovereignHive Cypherpunk Icons & Brand Assets...');

// 1. Vector SVG Source
write('docs/logo.svg', Buffer.from(buildSvg(1024, false)));
write('build/icon.svg', Buffer.from(buildSvg(1024, false)));

// 2. High Resolution PNGs
write('docs/logo.png', rasterise(512, false));
write('docs/logo-light.png', rasterise(512, true));
write('docs/favicon-32.png', rasterise(32, false));
write('docs/apple-touch-icon.png', rasterise(180, false));
write('build/icon.png', rasterise(1024, false));

// 3. Multi-resolution ICO (Windows)
write('build/icon.ico', buildIco([16, 32, 48, 64, 128, 256].map((size) => ({
  size, data: rasterise(size, false)
}))));

console.log('\nGenerated Assets:');
console.log(wrote.join('\n'));
