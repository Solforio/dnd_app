import { COLOR, type FontKey, type Page } from './draw';

/** Largest size, down to `min`, at which the text fits in `maxWidth`. */
export function fitSize(p: Page, text: string, maxWidth: number, font: FontKey, size: number, min = 10): number {
  let s = size;
  while (s > min && p.width(text, font, s) > maxWidth) s -= 0.5;
  return s;
}

/** A d20 seen face-on: a hexagon, the inner triangle and the lines that join them. */
export function d20Emblem(p: Page, cx: number, cy: number, r: number, o: { color?: typeof COLOR.gold; lw?: number } = {}): void {
  const color = o.color ?? COLOR.gold;
  const lw = o.lw ?? 0.9;
  const at = (deg: number, radius: number) => ({ x: cx + radius * Math.cos((deg * Math.PI) / 180), y: cy + radius * Math.sin((deg * Math.PI) / 180) });
  const hex = [-90, -30, 30, 90, 150, 210].map((d) => at(d, r));
  const tri = [-90, 30, 150].map((d) => at(d, r * 0.52));
  hex.forEach((v, i) => {
    const n = hex[(i + 1) % 6]!;
    p.line(v.x, v.y, n.x, n.y, { color, lw });
  });
  tri.forEach((v, i) => {
    const n = tri[(i + 1) % 3]!;
    p.line(v.x, v.y, n.x, n.y, { color, lw });
    // Each triangle corner reaches the hexagon corner in its direction and the two beside it.
    const k = i * 2;
    for (const j of [k, k + 1, k + 5]) {
      const h = hex[j % 6]!;
      p.line(v.x, v.y, h.x, h.y, { color, lw: lw * 0.8 });
    }
  });
}

/** Evenly spaced writing lines, for the notes a player adds by hand. */
export function ruledLines(p: Page, x: number, y: number, w: number, count: number, gap = 14): void {
  for (let i = 0; i < count; i++) p.line(x, y + i * gap, x + w, y + i * gap, { color: COLOR.goldSoft, lw: 0.6 });
}
