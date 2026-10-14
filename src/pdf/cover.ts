import type { Character } from '../domain/character';
import { formatNumber } from '../domain/format/number';
import { classSummary } from '../domain/sheet/sheet';
import { A4, COLOR, ornamentRule, type Page } from './draw';
import { d20Emblem } from './ornaments';

export interface ContentsEntry {
  name: string;
  summary: string;
  page: number;
}

const DATE = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

/** The cover of an export with several characters: the title, a large d20 and the list with page numbers. */
export function drawCover(p: Page, contents: readonly ContentsEntry[], exportedAt: Date): void {
  const cx = A4.w / 2;
  d20Emblem(p, cx, 205, 92, { color: COLOR.gold, lw: 1.6 });
  d20Emblem(p, cx, 205, 104, { color: COLOR.goldSoft, lw: 0.8 });
  p.text('D&D Pocket', cx, 380, { font: 'title', size: 46, color: COLOR.crimson, align: 'center' });
  ornamentRule(p, 120, A4.w - 120, 400);
  p.text('SCHEDE DEI PERSONAGGI', cx, 424, { font: 'display', size: 13, color: COLOR.muted, align: 'center' });

  p.text('INDICE', 70, 486, { font: 'display', size: 8.5, color: COLOR.crimson });
  p.line(70, 491, A4.w - 70, 491, { color: COLOR.gold, lw: 0.8 });
  const rows = contents.slice(0, 22);
  rows.forEach((e, i) => {
    const y = 509 + i * 14.5;
    p.text(p.fit(e.name, 190, 'bold', 9.5), 70, y, { font: 'bold', size: 9.5 });
    p.text(p.fit(e.summary, 230, 'body', 8.6), 270, y, { size: 8.6, color: COLOR.muted });
    p.text(String(e.page), A4.w - 70, y, { font: 'display', size: 8.5, align: 'right' });
    p.line(70, y + 4, A4.w - 70, y + 4, { color: COLOR.goldSoft, lw: 0.4 });
  });
  if (contents.length > rows.length) p.text(`e altri ${contents.length - rows.length} personaggi`, 70, 509 + rows.length * 14.5, { font: 'italic', size: 8, color: COLOR.muted });
  p.text(`Esportato il ${DATE.format(exportedAt)}`, cx, A4.h - 44, { font: 'italic', size: 8.5, color: COLOR.muted, align: 'center' });
}

export function contentsLine(c: Character): string {
  return `${classSummary(c.sheet.classes)} · PF ${formatNumber(c.hp.max)}`;
}
