// Renders the PNG icons of the installable app from public/favicon.svg (a gold d20 on indigo).
// Run once after changing the favicon:  node scripts/build-icons.mjs
// Needs the dev dependency `sharp`. The PNGs are committed, so the build does not depend on it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../public/', import.meta.url);
const favicon = readFileSync(new URL('favicon.svg', root), 'utf8');
// The shapes inside the favicon's <svg> element, drawn on a 64 x 64 grid.
const shapes = favicon.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const BACKGROUND = '#1b1a2e';

/** The d20 on a square of the theme colour; `scale` is the share of the square the d20 takes. */
function squareIcon(size, scale) {
  const inner = size * scale;
  const offset = (size - inner) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${inner / 64})">${shapes}</g>
</svg>`;
}

const icons = [
  // `any`: the d20 fills most of the square.
  ['icon-192.png', 192, 0.86],
  ['icon-512.png', 512, 0.86],
  // `maskable`: everything important stays inside the central 80 % (the safe zone).
  ['icon-maskable-512.png', 512, 0.6],
  // iOS draws no transparency and rounds the corners itself.
  ['apple-touch-icon.png', 180, 0.8],
];

for (const [name, size, scale] of icons) {
  await sharp(Buffer.from(squareIcon(size, scale))).png().toFile(fileURLToPath(new URL(name, root)));
  console.log(`wrote public/${name}`);
}
