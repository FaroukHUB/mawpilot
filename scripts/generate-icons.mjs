/**
 * Génère les icônes PWA de MAW Pilot sans aucune dépendance externe.
 *
 * Pourquoi un script maison : l'environnement de développement n'a pas d'accès
 * réseau, donc pas de bibliothèque d'images. Node fournit zlib, et un PNG est
 * simplement une suite de blocs compressés — une centaine de lignes suffisent.
 *
 * Usage : node scripts/generate-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "icons");

const ORANGE = [0xff, 0xa0, 0x00];
const BLACK = [0x11, 0x11, 0x11];

/** Suréchantillonnage : on dessine en grand puis on réduit (anticrénelage). */
const SS = 4;

function crc32(buffer) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** Encode un tableau RGBA (largeur × hauteur) en PNG. */
function encodePng(pixels, width, height) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filtre « none »
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (width * 4 + 1) + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Distance d'un point à un segment — sert à dessiner des traits épais. */
function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared)
        );
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Dessine l'icône : carré arrondi orange, « M » noir centré.
 * `padding` réserve la zone de sécurité des icônes « maskable ».
 */
function drawIcon(size, { maskable = false } = {}) {
  const big = size * SS;
  const buffer = new Uint8ClampedArray(big * big * 4);

  const radius = maskable ? big / 2 : big * 0.22;
  const inset = maskable ? 0 : 0;

  // Zone de sécurité : le « M » occupe 60 % de la surface sur une icône
  // maskable (les systèmes rognent jusqu'à 20 % de chaque côté).
  const glyphScale = maskable ? 0.44 : 0.56;
  const strokeWidth = big * (maskable ? 0.075 : 0.09);

  const cx = big / 2;
  const cy = big / 2;
  const w = big * glyphScale;
  const h = big * glyphScale * 0.86;

  // Les quatre segments du « M ».
  const left = cx - w / 2;
  const right = cx + w / 2;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  const middleX = cx;
  const middleY = cy + h * 0.16;

  const segments = [
    [left, bottom, left, top],
    [left, top, middleX, middleY],
    [middleX, middleY, right, top],
    [right, top, right, bottom],
  ];

  for (let y = 0; y < big; y++) {
    for (let x = 0; x < big; x++) {
      const index = (y * big + x) * 4;

      // Fond : carré arrondi (ou cercle plein si maskable).
      const insideBackground = isInsideRoundedSquare(
        x,
        y,
        inset,
        big - inset,
        radius
      );
      if (!insideBackground) {
        buffer[index + 3] = 0;
        continue;
      }

      buffer[index] = ORANGE[0];
      buffer[index + 1] = ORANGE[1];
      buffer[index + 2] = ORANGE[2];
      buffer[index + 3] = 255;

      // Glyphe.
      let minDistance = Infinity;
      for (const [x1, y1, x2, y2] of segments) {
        const d = distanceToSegment(x + 0.5, y + 0.5, x1, y1, x2, y2);
        if (d < minDistance) minDistance = d;
      }
      if (minDistance <= strokeWidth / 2) {
        buffer[index] = BLACK[0];
        buffer[index + 1] = BLACK[1];
        buffer[index + 2] = BLACK[2];
      }
    }
  }

  return downsample(buffer, big, size);
}

function isInsideRoundedSquare(x, y, min, max, radius) {
  const px = x + 0.5;
  const py = y + 0.5;
  if (px < min || px > max || py < min || py > max) return false;

  const innerMinX = min + radius;
  const innerMaxX = max - radius;
  const innerMinY = min + radius;
  const innerMaxY = max - radius;

  const nearestX = Math.max(innerMinX, Math.min(px, innerMaxX));
  const nearestY = Math.max(innerMinY, Math.min(py, innerMaxY));

  if (px >= innerMinX && px <= innerMaxX) return true;
  if (py >= innerMinY && py <= innerMaxY) return true;

  return Math.hypot(px - nearestX, py - nearestY) <= radius;
}

/** Réduit l'image suréchantillonnée : c'est ce qui lisse les bords. */
function downsample(source, sourceSize, targetSize) {
  const result = new Uint8ClampedArray(targetSize * targetSize * 4);
  const factor = sourceSize / targetSize;

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;

      for (let sy = 0; sy < factor; sy++) {
        for (let sx = 0; sx < factor; sx++) {
          const srcIndex =
            ((y * factor + sy) * sourceSize + (x * factor + sx)) * 4;
          const alpha = source[srcIndex + 3] / 255;
          r += source[srcIndex] * alpha;
          g += source[srcIndex + 1] * alpha;
          b += source[srcIndex + 2] * alpha;
          a += source[srcIndex + 3];
          count++;
        }
      }

      const index = (y * targetSize + x) * 4;
      const alphaAverage = a / count;
      const weight = alphaAverage === 0 ? 0 : count * (alphaAverage / 255);
      result[index] = weight === 0 ? 0 : r / weight;
      result[index + 1] = weight === 0 ? 0 : g / weight;
      result[index + 2] = weight === 0 ? 0 : b / weight;
      result[index + 3] = alphaAverage;
    }
  }

  return result;
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
  { name: "apple-touch-icon.png", size: 180, maskable: false },
  { name: "favicon-32.png", size: 32, maskable: false },
];

for (const target of targets) {
  const pixels = drawIcon(target.size, { maskable: target.maskable });
  const png = encodePng(pixels, target.size, target.size);
  writeFileSync(join(OUT_DIR, target.name), png);
  console.log(`✓ ${target.name} (${target.size}×${target.size})`);
}

console.log(`\nIcônes générées dans ${OUT_DIR}`);
