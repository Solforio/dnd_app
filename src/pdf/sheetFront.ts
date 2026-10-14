import type { PDFDocument, PDFImage } from 'pdf-lib';
import type { Character } from '../domain/character';
import { formatNumber, formatSigned } from '../domain/format/number';
import { COIN_LABELS, COINS } from '../domain/inventory';
import { ABILITIES, ABILITY_LABELS, CONDITION_LABELS, SKILL_INFO, SKILLS } from '../domain/sheet/rules';
import { hitDicePools } from '../domain/sheet/hitDice';
import {
  attackBonus,
  classSummary,
  damageFormula,
  initiative,
  passivePerception,
  saveBonus,
  sheetProficiency,
  skillBonus,
  abilityMod,
} from '../domain/sheet/sheet';
import { d20Emblem, fitSize } from './ornaments';
import { A4, COLOR, heading, labelled, ornamentRule, pageFrame, Page, type Fonts } from './draw';

/** Everything the PDF needs besides the character itself. */
export interface PdfAssets {
  portrait: PDFImage | null;
  body: PDFImage | null;
}

export interface Doc {
  pdf: PDFDocument;
  fonts: Fonts;
  /** Number of the next page, counted over the whole file. */
  pageNo: number;
}

/** A new page: cream paper, the double frame and the foot line. `head` is the small running title. */
export function newSheetPage(doc: Doc, head?: string): Page {
  const page = new Page(doc.pdf.addPage([A4.w, A4.h]), doc.fonts);
  page.fill(COLOR.paper);
  pageFrame(page);
  const no = doc.pageNo++;
  page.text('D&D Pocket', 30, A4.h - 22, { font: 'display', size: 6.5, color: COLOR.muted });
  page.text(String(no), A4.w / 2, A4.h - 22, { font: 'display', size: 7, color: COLOR.muted, align: 'center' });
  if (head) page.text(head, A4.w - 30, A4.h - 22, { font: 'display', size: 6.5, color: COLOR.muted, align: 'right' });
  return page;
}

export interface FrontResult {
  /** Parts that did not fit and are printed in full on the next page. */
  overflow: { attacks: number; proficiencies: boolean; languages: boolean };
}

const PROF_LEVELS = [0, 0.5, 1, 2] as const;

/** The marker of a proficiency: empty, half, filled, filled with a ring (expertise). */
function marker(p: Page, x: number, y: number, level: (typeof PROF_LEVELS)[number]): void {
  p.circle(x, y, 2.6, { stroke: COLOR.gold, lw: 0.8 });
  if (level === 0.5) p.circle(x, y, 1, { fill: COLOR.gold });
  if (level >= 1) p.circle(x, y, 1.7, { fill: COLOR.crimson });
  if (level >= 2) p.circle(x, y, 3.8, { stroke: COLOR.crimson, lw: 0.6 });
}

function titleBox(p: Page, x: number, y: number, w: number, h: number, label: string, value: string): void {
  labelled(p, label, x, y, w, h, value, { size: 8.5 });
}

const ownerName = (c: Character) => c.name.trim() || 'Senza nome';

/** Page 1: the classic sheet. Left: abilities, saves, skills. Middle: combat. Right: senses, proficiencies, features. */
export function drawFront(doc: Doc, c: Character, assets: PdfAssets): { page: Page; result: FrontResult } {
  const p = newSheetPage(doc, ownerName(c));
  const s = c.sheet;
  const prof = sheetProficiency(s);
  const overflow: FrontResult['overflow'] = { attacks: 0, proficiencies: false, languages: false };

  // --- Header: the name, and who and what the character is ---
  const nameSize = fitSize(p, ownerName(c), 300, 'title', 24, 13);
  p.text(p.fit(ownerName(c), 300, 'title', nameSize), 30, 60, { font: 'title', size: nameSize, color: COLOR.crimson });
  p.line(30, 66, 330, 66, { color: COLOR.gold, lw: 0.9 });
  p.text('NOME DEL PERSONAGGIO', 30, 76, { font: 'display', size: 5.6, color: COLOR.muted });
  const classes = classSummary(s.classes);
  titleBox(p, 345, 28, 108, 22, 'Classe e livello', classes);
  titleBox(p, 459, 28, 106, 22, 'Background', s.background || '—');
  titleBox(p, 345, 64, 108, 22, 'Razza', s.race || '—');
  titleBox(p, 459, 64, 106, 22, 'Allineamento', s.alignment || '—');
  ornamentRule(p, 30, A4.w - 30, 104);

  // --- Left column: abilities, inspiration and proficiency, saves, skills ---
  const lx = 30;
  const lw = 140;
  ABILITIES.forEach((a, i) => {
    const y = 114 + i * 50;
    p.box(lx, y, lw, 46, { fill: COLOR.goldPale, stroke: COLOR.gold, leaf: 8 });
    p.text(ABILITY_LABELS[a].long.toUpperCase(), lx + 9, y + 16, { font: 'display', size: 7.4, color: COLOR.crimson });
    p.text(`Punteggio ${s.abilities[a]}`, lx + 9, y + 35, { size: 8, color: COLOR.muted });
    p.ellipse(lx + lw - 36, y + 23, 25, 18, { fill: COLOR.white, stroke: COLOR.gold, lw: 1 });
    p.text(formatSigned(abilityMod(s.abilities[a])), lx + lw - 36, y + 31, { font: 'display', size: 19, align: 'center' });
  });
  labelled(p, 'Ispirazione', lx, 416, 68, 22);
  if (s.inspiration) p.diamond(lx + 34, 427, 6, { fill: COLOR.crimson });
  labelled(p, 'Competenza', lx + 72, 416, 68, 22, formatSigned(prof), { size: 12 });

  p.box(lx, 458, lw, 94, { stroke: COLOR.gold, leaf: 8 });
  heading(p, 'Tiri salvezza', lx + 8, 471, lw - 16, 7.6);
  ABILITIES.forEach((a, i) => {
    const y = 485 + i * 11;
    marker(p, lx + 12, y - 2.5, s.saves[a].proficient ? 1 : 0);
    p.text(formatSigned(saveBonus(s, a)), lx + 34, y, { font: 'bold', size: 8, align: 'right' });
    p.text(ABILITY_LABELS[a].long, lx + 42, y, { size: 8 });
  });

  const skillsSorted = [...SKILLS].sort((a, b) => SKILL_INFO[a].label.localeCompare(SKILL_INFO[b].label, 'it'));
  p.box(lx, 560, lw, 227, { stroke: COLOR.gold, leaf: 8 });
  heading(p, 'Abilità', lx + 8, 573, lw - 16, 7.6);
  skillsSorted.forEach((k, i) => {
    const y = 587 + i * 10.9;
    marker(p, lx + 12, y - 2.5, PROF_LEVELS.find((l) => l === s.skills[k].prof) ?? 0);
    p.text(formatSigned(skillBonus(s, k)), lx + 34, y, { font: 'bold', size: 7.8, align: 'right' });
    p.text(SKILL_INFO[k].label, lx + 42, y, { size: 7.8 });
    p.text(ABILITY_LABELS[SKILL_INFO[k].ability].short, lx + lw - 8, y, { size: 6, color: COLOR.muted, align: 'right' });
  });

  // --- Middle column: combat numbers, hit points, hit dice and death saves, attacks, equipment ---
  const mx = 180;
  const mw = 222;
  const speedM = formatNumber(s.speedM, 1);
  labelled(p, 'Classe armatura', mx, 114, 68, 44, formatNumber(s.ac), { size: 17 });
  labelled(p, 'Iniziativa', mx + 77, 114, 68, 44, formatSigned(initiative(s)), { size: 17 });
  labelled(p, 'Velocità', mx + 154, 114, 68, 44, `${speedM} m`, { size: 13 });

  heading(p, 'Punti ferita', mx, 190, mw, 8);
  labelled(p, 'Massimi', mx, 198, 72, 44, formatNumber(c.hp.max), { size: 14 });
  labelled(p, 'Attuali', mx + 74, 198, 74, 44, formatNumber(c.hp.cur), { size: 20 });
  labelled(p, 'Temporanei', mx + 150, 198, 72, 44, c.hp.temp > 0 ? formatNumber(c.hp.temp) : '', { size: 14 });

  const pools = hitDicePools(s);
  labelled(p, 'Dadi vita', mx, 262, 108, 44, pools.map((q) => `${q.total}d${q.die}`).join(' + '), { size: 10 });
  if (pools.length > 0) {
    p.text(`rimasti: ${pools.map((q) => `${q.left}d${q.die}`).join(' + ')}`, mx + 54, 296, { size: 6.4, color: COLOR.muted, align: 'center' });
  }
  p.box(mx + 114, 262, 108, 44, { fill: COLOR.goldPale, stroke: COLOR.gold, leaf: 6 });
  (['Successi', 'Fallimenti'] as const).forEach((label, row) => {
    const y = 278 + row * 17;
    p.text(label, mx + 122, y + 3, { size: 7.6 });
    const count = row === 0 ? c.deathSaves.successes : c.deathSaves.failures;
    for (let i = 0; i < 3; i++) {
      p.circle(mx + 178 + i * 14, y, 4.2, { stroke: COLOR.gold, lw: 0.9, fill: i < count ? (row === 0 ? COLOR.gold : COLOR.crimson) : COLOR.white });
    }
  });
  p.text('SALVEZZE CONTRO MORTE', mx + 168, 314, { font: 'display', size: 5.6, color: COLOR.muted, align: 'center' });

  heading(p, 'Attacchi e incantesimi', mx, 338, mw, 8);
  p.box(mx, 346, mw, 137, { stroke: COLOR.gold, leaf: 8 });
  d20Emblem(p, mx + mw - 38, 452, 22, { color: COLOR.goldSoft, lw: 0.8 });
  p.text('NOME', mx + 9, 358, { font: 'display', size: 5.8, color: COLOR.muted });
  p.text('BONUS', mx + 124, 358, { font: 'display', size: 5.8, color: COLOR.muted, align: 'center' });
  p.text('DANNI E TIPO', mx + 144, 358, { font: 'display', size: 5.8, color: COLOR.muted });
  p.line(mx + 6, 361, mx + mw - 6, 361, { color: COLOR.goldSoft, lw: 0.6 });
  const rows = 7;
  s.attacks.slice(0, rows).forEach((a, i) => {
    const y = 374 + i * 15;
    p.text(p.fit(a.name, 104, 'body', 8.4), mx + 9, y, { size: 8.4 });
    p.text(formatSigned(attackBonus(s, a)), mx + 124, y, { font: 'bold', size: 8.4, align: 'center' });
    const dmg = damageFormula(s, a);
    p.text(p.fit(`${dmg ?? '—'}${a.damageType ? ` ${a.damageType}` : ''}`, 72, 'body', 8), mx + 144, y, { size: 8 });
    p.line(mx + 6, y + 4, mx + mw - 6, y + 4, { color: COLOR.goldSoft, lw: 0.4 });
  });
  if (s.attacks.length > rows) {
    overflow.attacks = s.attacks.length - rows;
    p.text(`e altri ${overflow.attacks}: vedi pagina 2`, mx + 9, 478, { font: 'italic', size: 7, color: COLOR.muted });
  } else if (s.attacks.length === 0) {
    p.text('Nessun attacco: si scrivono nella scheda.', mx + 9, 376, { font: 'italic', size: 8, color: COLOR.muted });
  }

  heading(p, 'Equipaggiamento', mx, 500, mw, 8);
  p.box(mx, 508, mw, 279, { stroke: COLOR.gold, leaf: 8 });
  [...COINS].reverse().forEach((coin, i) => {
    const y = 516 + i * 46;
    p.box(mx + 7, y, 40, 34, { fill: COLOR.goldPale, stroke: COLOR.gold, leaf: 6 });
    p.text(formatNumber(c.inventory.coins[coin]), mx + 27, y + 22, { font: 'display', size: 9.5, align: 'center' });
    p.text(COIN_LABELS[coin].short.toUpperCase(), mx + 27, y + 43, { font: 'display', size: 5.6, color: COLOR.muted, align: 'center' });
  });
  const items = c.inventory.items;
  const maxItems = 21;
  items.slice(0, maxItems).forEach((it, i) => {
    const y = 523 + i * 11.6;
    p.text(p.fit(`${it.quantity > 1 ? `${it.quantity} × ` : ''}${it.name}${it.equipped ? ' (equip.)' : ''}`, mw - 70, 'body', 8.2), mx + 56, y, { size: 8.2 });
  });
  if (items.length > maxItems) p.text(`e altri ${items.length - maxItems}: vedi lo zaino`, mx + 56, 523 + maxItems * 11.6 + 3, { font: 'italic', size: 7, color: COLOR.muted });
  if (items.length === 0) p.text('Zaino vuoto.', mx + 56, 524, { font: 'italic', size: 8, color: COLOR.muted });

  // --- Right column: senses, conditions, proficiencies, features ---
  const rx = 412;
  const rw = 155;
  labelled(p, 'Percezione passiva', rx, 114, rw, 30, formatNumber(passivePerception(s)), { size: 13 });
  labelled(p, 'Scurovisione', rx, 164, rw, 30, s.darkvisionM > 0 ? `${formatNumber(s.darkvisionM, 1)} m` : '—', { size: 11 });

  p.box(rx, 214, rw, 50, { stroke: COLOR.gold, leaf: 8 });
  heading(p, 'Condizioni', rx + 8, 226, rw - 16, 7.4);
  const conds = [...s.conditions.map((k) => CONDITION_LABELS[k]), ...(s.exhaustion > 0 ? [`Indebolimento ${s.exhaustion}`] : [])];
  p.paragraph(conds.join(', ') || 'Nessuna', rx + 8, 238, rw - 16, { size: 7.6, leading: 9, font: conds.length ? 'body' : 'italic', color: conds.length ? COLOR.crimson : COLOR.muted });

  p.box(rx, 282, rw, 190, { stroke: COLOR.gold, leaf: 8 });
  heading(p, 'Competenze e linguaggi', rx + 8, 294, rw - 16, 7.4);
  let y = 307;
  p.text('Linguaggi', rx + 8, y, { font: 'bold', size: 7.4, color: COLOR.crimson });
  y += 9;
  const langLines = p.wrap(s.languages.join(', ') || '—', rw - 16, 'body', 7.6);
  langLines.slice(0, 4).forEach((l) => {
    p.text(l, rx + 8, y, { size: 7.6 });
    y += 9;
  });
  if (langLines.length > 4) overflow.languages = true;
  y += 5;
  p.text('Altre competenze', rx + 8, y, { font: 'bold', size: 7.4, color: COLOR.crimson });
  y += 9;
  const profLines = p.wrap(s.otherProficiencies || '—', rw - 16, 'body', 7.6);
  const room = Math.max(0, Math.floor((464 - y) / 9));
  profLines.slice(0, room).forEach((l) => {
    p.text(l, rx + 8, y, { size: 7.6 });
    y += 9;
  });
  if (profLines.length > room) {
    overflow.proficiencies = true;
    p.text('... (continua a pagina 2)', rx + 8, 466, { font: 'italic', size: 6.6, color: COLOR.muted });
  }

  p.box(rx, 490, rw, 297, { stroke: COLOR.gold, leaf: 8 });
  heading(p, 'Capacità e tratti', rx + 8, 502, rw - 16, 7.4);
  let fy = 516;
  let shown = 0;
  for (const f of s.features) {
    const uses = f.uses ? ` (${f.uses.cur}/${f.uses.max})` : '';
    const lines = p.wrap(`${f.name}${uses}`, rw - 16, 'body', 7.8);
    if (fy + lines.length * 9.2 > 776) break;
    lines.forEach((l, i) => {
      p.text(l, rx + (i === 0 ? 8 : 14), fy, { size: 7.8, font: i === 0 ? 'bold' : 'body' });
      fy += 9.2;
    });
    shown++;
  }
  if (s.features.length > shown) p.text(`e altre ${s.features.length - shown}: vedi pagina 2`, rx + 8, 782, { font: 'italic', size: 6.6, color: COLOR.muted });
  if (s.features.length === 0) p.text('Nessuna capacità inserita.', rx + 8, 517, { font: 'italic', size: 7.8, color: COLOR.muted });

  void assets;
  return { page: p, result: { overflow } };
}
