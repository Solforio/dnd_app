import type { Character } from '../domain/character';
import { formatNumber, formatSigned } from '../domain/format/number';
import { attackBonus, damageFormula } from '../domain/sheet/sheet';
import { A4, COLOR, heading, type Page } from './draw';
import { Flow } from './flow';
import { ruledLines } from './ornaments';
import { newSheetPage, type Doc, type FrontResult, type PdfAssets } from './sheetFront';

const COLS = [
  { x: 30, w: 261 },
  { x: 304, w: 261 },
] as const;
const BOTTOM = 800;

/** The four boxes a player fills in by hand on a printed sheet; the app does not store them. */
const PERSONALITY = ['Tratti caratteriali', 'Ideali', 'Legami', 'Difetti'] as const;

function personalityBox(p: Page, label: string, x: number, y: number, w: number, h: number): void {
  p.box(x, y, w, h, { stroke: COLOR.gold, leaf: 8 });
  p.text(label.toUpperCase(), x + 9, y + 12, { font: 'display', size: 6.4, color: COLOR.crimson });
  ruledLines(p, x + 8, y + 25, w - 16, Math.floor((h - 22) / 13), 13);
}

/**
 * Page 2 and the pages after it: the appearance, the four hand-written boxes, then every feature with its text,
 * what did not fit on the front page, and a page of notes.
 */
export function drawTraits(doc: Doc, c: Character, assets: PdfAssets, front: FrontResult): Page {
  const s = c.sheet;
  const first = newSheetPage(doc, c.name || 'Senza nome');
  heading(first, 'Aspetto e personalità', 30, 50, A4.w - 60, 9);

  // --- The band: pictures on the left, the four hand-written boxes beside or below ---
  const top = 62;
  let bandBottom: number;
  if (assets.portrait || assets.body) {
    let x = 30;
    if (assets.portrait) {
      first.box(x - 3, top - 3, 118, 118, { fill: COLOR.goldPale, stroke: COLOR.gold, leaf: 8 });
      first.image(assets.portrait, x, top, 112, 112);
      x += 126;
    }
    let bodyBottom = top + 118;
    if (assets.body) {
      const h = 214;
      const w = Math.min(150, (assets.body.width / assets.body.height) * h);
      first.box(x - 3, top - 3, w + 6, h + 6, { fill: COLOR.goldPale, stroke: COLOR.gold, leaf: 8 });
      first.image(assets.body, x, top, w, h);
      x += w + 14;
      bodyBottom = top + h + 6;
    }
    const bw = A4.w - 30 - x;
    const bh = (bodyBottom - top - 3 * 8) / 4;
    PERSONALITY.forEach((label, i) => personalityBox(first, label, x, top + i * (bh + 8), bw, bh));
    bandBottom = bodyBottom;
  } else {
    PERSONALITY.forEach((label, i) => personalityBox(first, label, 30 + (i % 2) * 274, top + Math.floor(i / 2) * 62, 261, 54));
    bandBottom = top + 116;
  }

  // --- The text that flows in two columns ---
  const flow = new Flow(first, bandBottom + 18, COLS, BOTTOM, () => ({ page: newSheetPage(doc, c.name || 'Senza nome'), top: 50 }));

  flow.heading('Capacità e tratti');
  if (s.features.length === 0) flow.line('Nessuna capacità inserita nella scheda.', { font: 'italic', size: 8.6, color: COLOR.muted });
  for (const f of s.features) {
    flow.ensure(34);
    flow.paragraph(f.text || '—', { lead: `${f.name}${f.source ? ` (${f.source})` : ''}.`, size: 8.6 });
    if (f.uses) {
      flow.line(`Usi: ${f.uses.cur}/${f.uses.max} · si ricaricano con un riposo ${f.uses.reset === 'short' ? 'breve' : 'lungo'}`, { font: 'italic', size: 7.8, color: COLOR.muted });
    }
    flow.gap(5);
  }

  if (front.overflow.attacks > 0) {
    flow.heading('Tutti gli attacchi');
    for (const a of s.attacks) {
      const dmg = damageFormula(s, a);
      flow.paragraph(`${formatSigned(attackBonus(s, a))} per colpire · ${dmg ?? 'nessun danno'}${a.damageType ? ` ${a.damageType}` : ''}${a.notes ? `. ${a.notes}` : ''}`, { lead: `${a.name}.`, size: 8.6 });
    }
    flow.gap(5);
  }

  flow.heading('Competenze e linguaggi');
  flow.paragraph(s.languages.join(', ') || '—', { lead: 'Linguaggi.', size: 8.6 });
  flow.paragraph(s.otherProficiencies || '—', { lead: 'Altre competenze.', size: 8.6 });
  flow.gap(5);

  const dv = s.darkvisionM > 0 ? `Scurovisione ${formatNumber(s.darkvisionM, 1)} m.` : '';
  if (dv || s.exhaustion > 0) flow.line([dv, s.exhaustion > 0 ? `Indebolimento ${s.exhaustion}.` : ''].filter(Boolean).join(' '), { size: 8.6 });

  // --- Notes: the free right column when the text stayed in the left one, else what is left of the last column ---
  if (flow.column === 0 && flow.page === first) {
    const y = bandBottom + 18;
    heading(first, 'Appunti', COLS[1].x, y + 9, COLS[1].w, 9);
    ruledLines(first, COLS[1].x, y + 28, COLS[1].w, Math.floor((BOTTOM - y - 30) / 14) + 1, 14);
  } else {
    const left = Math.floor((BOTTOM - flow.y - 24) / 14);
    if (left >= 4) {
      flow.heading('Appunti');
      ruledLines(flow.page, flow.x, flow.y + 8, flow.w, Math.min(left - 2, 22), 14);
    }
  }
  return flow.page;
}
