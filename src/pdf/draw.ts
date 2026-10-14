import { rgb, type Color, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

/**
 * Drawing helpers for the character sheet PDF. The page is measured from its top-left corner, in points,
 * like a layout on screen (pdf-lib counts from the bottom-left): `y` is the distance from the top edge.
 */

export const A4 = { w: 595.28, h: 841.89 } as const;

/** Printable colours: dark ink on a cream page, crimson titles, gold rules. */
export const COLOR = {
  paper: rgb(0.984, 0.965, 0.914),
  ink: rgb(0.17, 0.12, 0.06),
  muted: rgb(0.42, 0.34, 0.22),
  crimson: rgb(0.48, 0.13, 0.08),
  gold: rgb(0.72, 0.52, 0.17),
  goldSoft: rgb(0.953, 0.906, 0.753),
  goldPale: rgb(0.976, 0.945, 0.846),
  white: rgb(1, 1, 1),
} as const;

export interface Fonts {
  /** Cinzel Decorative Bold: the big names. */
  title: PDFFont;
  /** Cinzel: labels and headings. */
  display: PDFFont;
  body: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

export type FontKey = keyof Fonts;
export type Align = 'left' | 'center' | 'right';

export interface TextOptions {
  font?: FontKey;
  size?: number;
  color?: Color;
  align?: Align;
}

/** Characters a font cannot draw are replaced, so a stray symbol never stops the whole export. */
const FALLBACKS: Record<string, string> = {
  '≥': '>=',
  '≤': '<=',
  '→': '->',
  '←': '<-',
  '−': '-',
  '–': '-',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '…': '...',
  '●': '*',
  '○': 'o',
  '✓': 'v',
  ' ': ' ',
  '\t': ' ',
};

export function safeText(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet());
  let out = '';
  for (const ch of text.replace(/\r/g, '')) {
    const cp = ch.codePointAt(0)!;
    if (ch === '\n') out += ch;
    else if (supported.has(cp)) out += ch;
    else {
      const alt = FALLBACKS[ch];
      out += alt && [...alt].every((c) => supported.has(c.codePointAt(0)!)) ? alt : '?';
    }
  }
  return out;
}

/** SVG path of a rectangle whose top-left and bottom-right corners are sharp and the other two round (the app's leaf shape). */
export function leafPath(w: number, h: number, r: number): string {
  const c = Math.min(r, w / 2, h / 2);
  return `M0 0 H${w - c} Q${w} 0 ${w} ${c} V${h} H${c} Q0 ${h} 0 ${h - c} Z`;
}

/** Border settings: a box with only a fill has no border; with nothing given it gets a gold one. */
function borderOf(o: { fill?: Color; stroke?: Color; lw?: number }, fallback: Color) {
  if (o.stroke) return { borderColor: o.stroke, borderWidth: o.lw ?? 0.9 };
  return o.fill ? {} : { borderColor: fallback, borderWidth: o.lw ?? 0.9 };
}

export class Page {
  constructor(
    readonly pdf: PDFPage,
    readonly fonts: Fonts,
  ) {}

  get w(): number {
    return this.pdf.getWidth();
  }

  get h(): number {
    return this.pdf.getHeight();
  }

  private py(y: number): number {
    return this.h - y;
  }

  width(text: string, font: FontKey, size: number): number {
    const f = this.fonts[font];
    return f.widthOfTextAtSize(safeText(f, text), size);
  }

  /** Draws one line of text with its baseline at `y`; with `align` other than left, `x` is the right edge or the centre. */
  text(text: string, x: number, y: number, o: TextOptions = {}): void {
    const font = o.font ?? 'body';
    const size = o.size ?? 9;
    const f = this.fonts[font];
    const t = safeText(f, text).replace(/\n/g, ' ');
    if (t === '') return;
    const wide = f.widthOfTextAtSize(t, size);
    const left = o.align === 'center' ? x - wide / 2 : o.align === 'right' ? x - wide : x;
    this.pdf.drawText(t, { x: left, y: this.py(y), size, font: f, color: o.color ?? COLOR.ink });
  }

  /** Cuts a text into lines no wider than `maxWidth` (explicit line breaks are kept). */
  wrap(text: string, maxWidth: number, font: FontKey, size: number): string[] {
    const f = this.fonts[font];
    const lines: string[] = [];
    for (const para of safeText(f, text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && f.widthOfTextAtSize(next, size) > maxWidth) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    return lines;
  }

  /** Like `wrap`, but the first line may have a different width (it starts after a bold lead). */
  wrapFirst(text: string, firstWidth: number, maxWidth: number, font: FontKey, size: number): string[] {
    const f = this.fonts[font];
    const lines: string[] = [];
    let limit = firstWidth;
    for (const para of safeText(f, text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && f.widthOfTextAtSize(next, size) > limit) {
          lines.push(line);
          limit = maxWidth;
          line = word;
        } else line = next;
      }
      lines.push(line);
      limit = maxWidth;
    }
    return lines;
  }

  /** The text cut to fit one line, ending with an ellipsis when it was too long. */
  fit(text: string, maxWidth: number, font: FontKey, size: number): string {
    const f = this.fonts[font];
    let t = safeText(f, text).replace(/\n/g, ' ');
    if (f.widthOfTextAtSize(t, size) <= maxWidth) return t;
    while (t.length > 1 && f.widthOfTextAtSize(`${t}...`, size) > maxWidth) t = t.slice(0, -1);
    return `${t.trimEnd()}...`;
  }

  /** A wrapped paragraph from `y` (first baseline); returns the y of the next free line. */
  paragraph(text: string, x: number, y: number, maxWidth: number, o: TextOptions & { leading?: number } = {}): number {
    const size = o.size ?? 9;
    const leading = o.leading ?? size * 1.28;
    let cursor = y;
    for (const line of this.wrap(text, maxWidth, o.font ?? 'body', size)) {
      this.text(line, x, cursor, o);
      cursor += leading;
    }
    return cursor;
  }

  /** A box; `leaf` gives the sheet's leaf corners instead of a plain rectangle. */
  box(x: number, y: number, w: number, h: number, o: { fill?: Color; stroke?: Color; lw?: number; leaf?: number } = {}): void {
    const border = borderOf(o, COLOR.gold);
    if (o.leaf) this.pdf.drawSvgPath(leafPath(w, h, o.leaf), { x, y: this.py(y), color: o.fill, ...border });
    else this.pdf.drawRectangle({ x, y: this.py(y + h), width: w, height: h, color: o.fill, ...border });
  }

  line(x1: number, y1: number, x2: number, y2: number, o: { color?: Color; lw?: number; dash?: number[] } = {}): void {
    this.pdf.drawLine({ start: { x: x1, y: this.py(y1) }, end: { x: x2, y: this.py(y2) }, thickness: o.lw ?? 0.6, color: o.color ?? COLOR.gold, dashArray: o.dash });
  }

  circle(cx: number, cy: number, r: number, o: { fill?: Color; stroke?: Color; lw?: number } = {}): void {
    this.pdf.drawCircle({ x: cx, y: this.py(cy), size: r, color: o.fill, ...borderOf(o, COLOR.ink) });
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, o: { fill?: Color; stroke?: Color; lw?: number } = {}): void {
    this.pdf.drawEllipse({ x: cx, y: this.py(cy), xScale: rx, yScale: ry, color: o.fill, ...borderOf(o, COLOR.gold) });
  }

  diamond(cx: number, cy: number, r: number, o: { fill?: Color } = {}): void {
    this.pdf.drawSvgPath(`M0 ${-r} L${r} 0 L0 ${r} L${-r} 0 Z`, { x: cx, y: this.py(cy), color: o.fill ?? COLOR.gold });
  }

  image(img: PDFImage, x: number, y: number, w: number, h: number): void {
    this.pdf.drawImage(img, { x, y: this.py(y + h), width: w, height: h });
  }

  fill(color: Color): void {
    this.pdf.drawRectangle({ x: 0, y: 0, width: this.w, height: this.h, color });
  }
}

// --- Ornaments ---

/** A gold rule with a diamond in the middle. */
export function ornamentRule(p: Page, x1: number, x2: number, y: number): void {
  const mid = (x1 + x2) / 2;
  p.line(x1, y, mid - 7, y, { lw: 0.7 });
  p.line(mid + 7, y, x2, y, { lw: 0.7 });
  p.diamond(mid, y, 3);
}

/** Corner brackets, like the corners of the cards on screen. */
export function cornerBrackets(p: Page, x: number, y: number, w: number, h: number, len = 14, lw = 1.4): void {
  const o = { color: COLOR.gold, lw };
  p.line(x, y, x + len, y, o);
  p.line(x, y, x, y + len, o);
  p.line(x + w, y, x + w - len, y, o);
  p.line(x + w, y, x + w, y + len, o);
  p.line(x, y + h, x + len, y + h, o);
  p.line(x, y + h, x, y + h - len, o);
  p.line(x + w, y + h, x + w - len, y + h, o);
  p.line(x + w, y + h, x + w, y + h - len, o);
}

/** The frame of every page: a double border with corner brackets. */
export function pageFrame(p: Page, margin = 16): void {
  p.box(margin, margin, p.w - 2 * margin, p.h - 2 * margin, { stroke: COLOR.gold, lw: 1.2 });
  p.box(margin + 3, margin + 3, p.w - 2 * margin - 6, p.h - 2 * margin - 6, { stroke: COLOR.goldSoft, lw: 0.6 });
  cornerBrackets(p, margin - 1, margin - 1, p.w - 2 * margin + 2, p.h - 2 * margin + 2, 18, 1.8);
}

/** A section heading: small display type in crimson over a fading gold rule. */
export function heading(p: Page, text: string, x: number, y: number, w: number, size = 9): void {
  p.diamond(x + 3, y - size * 0.32, 2.2, { fill: COLOR.gold });
  p.text(text.toUpperCase(), x + 10, y, { font: 'display', size, color: COLOR.crimson });
  p.line(x, y + 3.5, x + w, y + 3.5, { color: COLOR.gold, lw: 0.6 });
}

/** A labelled box: the label sits under the box, as on a printed sheet. */
export function labelled(p: Page, label: string, x: number, y: number, w: number, h: number, value?: string, o: { size?: number; fill?: boolean } = {}): void {
  p.box(x, y, w, h, { fill: o.fill === false ? undefined : COLOR.goldPale, stroke: COLOR.gold, leaf: 6 });
  if (value) p.text(p.fit(value, w - 8, 'body', o.size ?? 10), x + w / 2, y + h / 2 + (o.size ?? 10) * 0.32, { align: 'center', size: o.size ?? 10 });
  p.text(label.toUpperCase(), x + w / 2, y + h + 8, { font: 'display', size: 5.6, color: COLOR.muted, align: 'center' });
}
