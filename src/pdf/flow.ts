import { COLOR, heading, type FontKey, type Page, type TextOptions } from './draw';

export interface Column {
  x: number;
  w: number;
}

export interface NewPage {
  page: Page;
  /** Where text starts on the new page (below any running head). */
  top: number;
}

/**
 * Text that runs down one or more columns and onto new pages when it reaches the bottom.
 * Every method places whole lines, so nothing is ever cut in half.
 */
export class Flow {
  page: Page;
  private col = 0;
  y: number;
  private baseTop: number;

  constructor(
    first: Page,
    top: number,
    private readonly columns: readonly Column[],
    private readonly bottom: number,
    private readonly newPage: () => NewPage,
  ) {
    this.page = first;
    this.y = top;
    this.baseTop = top;
  }

  get x(): number {
    return this.columns[this.col]!.x;
  }

  get w(): number {
    return this.columns[this.col]!.w;
  }

  /** Index of the column being filled, 0 for the first. */
  get column(): number {
    return this.col;
  }

  /** True while nothing has been placed yet in this column. */
  get atTop(): boolean {
    return this.y <= this.baseTop + 1;
  }

  /** Moves to the next column, or to a new page when the columns are used up. */
  nextColumn(): void {
    this.col += 1;
    if (this.col >= this.columns.length) {
      const next = this.newPage();
      this.page = next.page;
      this.baseTop = next.top;
      this.col = 0;
    }
    this.y = this.baseTop;
  }

  /** Makes room for a block `h` high: starts the next column if it does not fit here. */
  ensure(h: number): void {
    if (this.y + h > this.bottom && this.y > this.baseTop + 1) this.nextColumn();
  }

  gap(h: number): void {
    this.y += h;
  }

  /** A section heading; it never ends a column on its own (it needs room for a few lines after it). */
  heading(text: string, size = 9): void {
    this.ensure(46);
    if (!this.atTop) this.y += 8;
    heading(this.page, text, this.x, this.y + size, this.w, size);
    this.y += size + 11;
  }

  /** One line of text at the cursor. */
  line(text: string, o: TextOptions & { leading?: number; indent?: number } = {}): void {
    const size = o.size ?? 9;
    const leading = o.leading ?? size * 1.3;
    this.ensure(leading);
    this.page.text(text, this.x + (o.indent ?? 0), this.y + size, o);
    this.y += leading;
  }

  /** A paragraph, wrapped to the column; `lead` is an optional bold start («Nome.»). */
  paragraph(text: string, o: TextOptions & { leading?: number; indent?: number; lead?: string } = {}): void {
    const size = o.size ?? 8.6;
    const leading = o.leading ?? size * 1.32;
    const indent = o.indent ?? 0;
    const font: FontKey = o.font ?? 'body';
    const leadWidth = o.lead ? this.page.width(`${o.lead} `, 'bold', size) : 0;
    const lines = this.page.wrapFirst(text, this.w - indent - leadWidth, this.w - indent, font, size);
    let first = true;
    for (const line of lines) {
      this.ensure(leading);
      const x = this.x + indent;
      if (first && o.lead) {
        this.page.text(`${o.lead} `, x, this.y + size, { font: 'bold', size, color: o.color });
        this.page.text(line, x + leadWidth, this.y + size, { font, size, color: o.color });
      } else this.page.text(line, x, this.y + size, { font, size, color: o.color });
      first = false;
      this.y += leading;
    }
  }

  /** A horizontal rule across the column. */
  rule(color = COLOR.goldSoft): void {
    this.ensure(4);
    this.page.line(this.x, this.y + 1, this.x + this.w, this.y + 1, { color, lw: 0.5 });
    this.y += 4;
  }
}
