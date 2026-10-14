import type { Character } from '../domain/character';
import { formatNumber, formatSigned } from '../domain/format/number';
import { ABILITY_LABELS } from '../domain/sheet/rules';
import { pactLeft, slotRows, SLOT_LEVELS, maxSlots } from '../domain/sheet/spellSlots';
import { listOf, spellClassOf, spellStats, type Spell } from '../domain/spells';
import { A4, COLOR, heading, labelled } from './draw';
import { Flow } from './flow';
import { newSheetPage, type Doc } from './sheetFront';

const COLS = [
  { x: 30, w: 261 },
  { x: 304, w: 261 },
] as const;
const BOTTOM = 800;

export const levelName = (level: number): string => (level === 0 ? 'Trucchetti' : `${level}° livello`);

interface Entry {
  spell: Spell;
  /** Castable now: a cantrip, a known spell of a class that casts what it knows, or a prepared spell. */
  ready: boolean;
}

/** The spells of the character, once each, sorted by level and name. */
export function spellEntries(c: Character, spells: ReadonlyMap<string, Spell>): Entry[] {
  const s = c.sheet;
  const seen = new Map<string, Entry>();
  for (const cls of s.classes) {
    const sc = spellClassOf(cls);
    if (!sc) continue;
    const list = listOf(s, sc.key);
    for (const id of new Set([...list.known, ...list.prepared])) {
      const spell = spells.get(id);
      if (!spell) continue;
      const ready = spell.level === 0 || sc.mode === 'known' || list.prepared.includes(id);
      const before = seen.get(id);
      seen.set(id, { spell, ready: ready || (before?.ready ?? false) });
    }
  }
  return [...seen.values()].sort((a, b) => a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name));
}

/** The pages on magic: slots, the list of spells, and the full text of each one. Nothing is added for a character who does not cast. */
export function drawSpells(doc: Doc, c: Character, spells: ReadonlyMap<string, Spell>): void {
  const s = c.sheet;
  const casters = s.classes.flatMap((cls) => {
    const sc = spellClassOf(cls);
    return sc ? [{ cls, sc }] : [];
  });
  const rows = slotRows(s);
  const pact = pactLeft(s);
  const entries = spellEntries(c, spells);
  if (casters.length === 0 && rows.length === 0 && !pact && entries.length === 0) return;

  const name = c.name || 'Senza nome';
  const first = newSheetPage(doc, name);
  heading(first, 'Incantesimi', 30, 50, A4.w - 60, 10);
  let y = 66;

  // --- Ability, save DC and attack bonus for each casting class ---
  for (const { cls, sc } of casters) {
    first.text(`${sc.label.toUpperCase()} ${cls.level}`, 30, y + 17, { font: 'display', size: 9, color: COLOR.crimson });
    const st = spellStats(s, sc);
    labelled(first, 'Caratteristica', 200, y, 110, 24, ABILITY_LABELS[sc.ability].long, { size: 9 });
    labelled(first, 'CD dei tiri salvezza', 320, y, 110, 24, formatNumber(st.dc), { size: 12 });
    labelled(first, 'Bonus di attacco', 440, y, 125, 24, formatSigned(st.attack), { size: 12 });
    y += 46;
  }

  // --- Slots: nine boxes with one circle per slot, filled when spent ---
  heading(first, 'Slot incantesimo', 30, y + 8, A4.w - 60, 8.5);
  y += 18;
  const max = maxSlots(s);
  const cell = (A4.w - 60 - 8 * 4) / 9;
  for (let i = 0; i < SLOT_LEVELS; i++) {
    const x = 30 + i * (cell + 4);
    first.box(x, y, cell, 50, { fill: COLOR.goldPale, stroke: COLOR.gold, leaf: 6 });
    first.text(`${i + 1}°`, x + cell / 2, y + 12, { font: 'display', size: 8.5, color: COLOR.crimson, align: 'center' });
    const total = max[i] ?? 0;
    if (total === 0) first.text('—', x + cell / 2, y + 33, { size: 9, color: COLOR.muted, align: 'center' });
    const used = Math.min(total, s.spellcasting.slotsUsed[i] ?? 0);
    for (let k = 0; k < total; k++) {
      const col = k % 4;
      const rowIdx = Math.floor(k / 4);
      first.circle(x + cell / 2 + (col - 1.5) * 9.2, y + 28 + rowIdx * 10, 3.5, { stroke: COLOR.gold, lw: 0.9, fill: k < used ? COLOR.crimson : COLOR.white });
    }
  }
  y += 66;
  if (pact) {
    first.text(`SLOT DEL PATTO (${pact.pact.level}° LIVELLO)`, 30, y + 5, { font: 'display', size: 7.4, color: COLOR.crimson });
    for (let k = 0; k < pact.pact.count; k++) {
      first.circle(190 + k * 14, y + 2.5, 4.4, { stroke: COLOR.gold, lw: 0.9, fill: k < Math.min(pact.pact.count, s.spellcasting.pactUsed) ? COLOR.crimson : COLOR.white });
    }
    y += 22;
  }

  // --- The list of spells, by level ---
  const newPage = () => ({ page: newSheetPage(doc, name), top: 50 });
  const list = new Flow(first, y + 10, COLS, BOTTOM, newPage);
  if (entries.length === 0) {
    list.line('Nessun incantesimo scelto: si aggiungono nella scheda Grimorio.', { font: 'italic', size: 8.6, color: COLOR.muted });
  }
  let level = -1;
  for (const { spell, ready } of entries) {
    if (spell.level !== level) {
      level = spell.level;
      list.heading(levelName(level), 8.5);
    }
    list.ensure(24);
    const x = list.x;
    const top = list.y;
    list.page.diamond(x + 4, top + 6, 3, { fill: ready ? COLOR.crimson : COLOR.white });
    if (!ready) list.page.box(x + 1.2, top + 3.2, 5.6, 5.6, { stroke: COLOR.gold, lw: 0.6 });
    const tags = `${spell.school}${spell.concentration ? ' · C' : ''}${spell.ritual ? ' · R' : ''}`;
    list.page.text(list.page.fit(spell.name, list.w - 80, 'bold', 8.8), x + 12, top + 8.6, { font: 'bold', size: 8.8 });
    list.page.text(tags, x + list.w, top + 8.6, { size: 6.8, color: COLOR.muted, align: 'right' });
    list.page.text(list.page.fit(`${spell.castingTime} · ${spell.range} · ${spell.duration}`, list.w - 14, 'italic', 7.2), x + 12, top + 17.6, { font: 'italic', size: 7.2, color: COLOR.muted });
    list.gap(23);
  }
  if (entries.length > 0) {
    list.gap(6);
    list.line('◆ pronto da lanciare   ◇ nel libro, da preparare   C concentrazione   R rituale'.replace(/[◆◇]/g, (ch) => (ch === '◆' ? '*' : 'o')), { font: 'italic', size: 7, color: COLOR.muted });
  }

  // --- The full text of each spell, on its own pages ---
  if (entries.length === 0) return;
  const text = new Flow(newSheetPage(doc, name), 50, COLS, BOTTOM, newPage);
  text.heading('Descrizioni degli incantesimi', 9.5);
  for (const { spell } of entries) {
    text.ensure(64);
    text.line(spell.name, { font: 'display', size: 9, color: COLOR.crimson, leading: 11.5 });
    text.paragraph(
      `${levelName(spell.level) === 'Trucchetti' ? 'Trucchetto' : levelName(spell.level)} di ${spell.school}${spell.concentration ? ', concentrazione' : ''}${spell.ritual ? ', rituale' : ''}.`,
      { font: 'italic', size: 7.5, color: COLOR.muted },
    );
    text.paragraph(`Tempo di lancio: ${spell.castingTime}. Gittata: ${spell.range}. Componenti: ${spell.components}${spell.material ? ` (${spell.material})` : ''}. Durata: ${spell.duration}.`, { size: 7.7 });
    for (const para of spell.text.split('\n\n')) text.paragraph(para, { size: 7.9 });
    if (spell.higher) text.paragraph(spell.higher, { lead: 'Ai livelli superiori.', size: 7.9 });
    text.gap(3);
    text.rule();
    text.gap(3);
  }
}
