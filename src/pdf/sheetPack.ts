import type { Character } from '../domain/character';
import { formatNumber } from '../domain/format/number';
import {
  attunedCount,
  ATTUNEMENT_LIMIT,
  capacityLb,
  carriedWeightLb,
  CATEGORY_LABELS,
  COIN_LABELS,
  COINS,
  contentsWeightLb,
  ENCUMBRANCE_LABELS,
  encumbrance,
  formatGp,
  formatWeight,
  totalValueCp,
  type Item,
} from '../domain/inventory';
import { A4, COLOR, heading, labelled, type Page } from './draw';
import { Flow } from './flow';
import { newSheetPage, type Doc } from './sheetFront';

const X = { qty: 54, name: 62, kind: 300, weight: 436, value: 496, flags: 504 } as const;
const BOTTOM = 800;
const WIDTH = A4.w - 60;

function tableHead(p: Page, y: number): void {
  const o = { font: 'display', size: 6.4, color: COLOR.muted } as const;
  p.text('Q.TÀ', X.qty, y, { ...o, align: 'right' });
  p.text('OGGETTO', X.name, y, o);
  p.text('TIPO', X.kind, y, o);
  p.text('PESO', X.weight, y, { ...o, align: 'right' });
  p.text('VALORE (MO)', X.value, y, { ...o, align: 'right' });
  p.text('NOTE', X.flags, y, o);
  p.line(30, y + 4, A4.w - 30, y + 4, { color: COLOR.gold, lw: 0.8 });
}

/** The backpack page: coins, totals, and every object, with the contents of each container under it. */
export function drawPack(doc: Doc, c: Character): void {
  const inv = c.inventory;
  const unit = inv.settings.weightUnit;
  const name = c.name || 'Senza nome';
  const first = newSheetPage(doc, name);
  heading(first, 'Zaino e monete', 30, 50, WIDTH, 10);

  // --- Coins and totals ---
  [...COINS].reverse().forEach((coin, i) => labelled(first, COIN_LABELS[coin].long, 30 + i * 107, 64, 100, 28, formatNumber(inv.coins[coin]), { size: 11 }));
  const carried = carriedWeightLb(inv);
  const capacity = capacityLb(c.sheet.abilities.str, inv.settings);
  const load = encumbrance(carried, capacity, inv.settings.variantEncumbrance);
  const totals: [string, string][] = [
    ['Peso trasportato', `${formatWeight(carried, unit)} su ${formatWeight(capacity, unit)}`],
    ['Ingombro', ENCUMBRANCE_LABELS[load]],
    ['Valore totale', formatGp(totalValueCp(inv))],
    ['Sintonizzati', `${attunedCount(inv.items)} su ${ATTUNEMENT_LIMIT}`],
  ];
  totals.forEach(([label, value], i) => {
    const x = 30 + (i % 2) * 274;
    const y = 118 + Math.floor(i / 2) * 13;
    first.text(`${label}:`, x, y, { font: 'bold', size: 8.4 });
    first.text(value, x + 261, y, { size: 8.4, align: 'right' });
  });

  // --- Objects ---
  const flow = new Flow(first, 156, [{ x: 30, w: WIDTH }], BOTTOM, () => {
    const page = newSheetPage(doc, name);
    tableHead(page, 58);
    return { page, top: 66 };
  });
  tableHead(first, 150);
  flow.gap(6);

  const row = (item: Item, indent: number) => {
    const noteLines = item.notes ? flow.page.wrap(item.notes, X.kind - X.name - indent - 6, 'italic', 7) : [];
    flow.ensure(13 + noteLines.length * 8);
    const p = flow.page;
    const y = flow.y + 9;
    p.text(item.quantity > 1 ? String(item.quantity) : '', X.qty, y, { align: 'right', size: 8.6, font: 'bold' });
    p.text(p.fit(`${item.name}${item.isContainer ? ' (contenitore)' : ''}`, X.kind - X.name - indent - 6, 'body', 8.8), X.name + indent, y, { size: 8.8, font: item.isContainer ? 'bold' : 'body' });
    p.text(CATEGORY_LABELS[item.category], X.kind, y, { size: 7.6, color: COLOR.muted });
    const weight = item.isContainer ? item.weightLb + (item.weightlessContents ? 0 : contentsWeightLb(inv.items, item.id)) : item.weightLb * item.quantity;
    p.text(weight > 0 ? formatWeight(weight, unit) : '—', X.weight, y, { size: 8, align: 'right' });
    p.text(item.valueCp > 0 ? formatGp(item.valueCp * item.quantity) : '—', X.value, y, { size: 8, align: 'right' });
    const flags = [item.equipped ? 'equip.' : '', item.attuned ? 'sint.' : item.requiresAttunement ? 'da sint.' : ''].filter(Boolean).join(' · ');
    p.text(flags, X.flags, y, { size: 7, color: COLOR.crimson });
    noteLines.forEach((l, i) => p.text(l, X.name + indent + 6, y + 8 + i * 8, { font: 'italic', size: 7, color: COLOR.muted }));
    flow.page.line(30, y + 3.5 + noteLines.length * 8, A4.w - 30, y + 3.5 + noteLines.length * 8, { color: COLOR.goldSoft, lw: 0.4 });
    flow.gap(12.4 + noteLines.length * 8);
  };

  const loose = inv.items.filter((i) => !i.isContainer && i.containerId === null);
  const containers = inv.items.filter((i) => i.isContainer);
  if (inv.items.length === 0) flow.line('Lo zaino è vuoto.', { font: 'italic', size: 9, color: COLOR.muted });
  loose.forEach((i) => row(i, 0));
  for (const box of containers) {
    row(box, 0);
    inv.items.filter((i) => i.containerId === box.id).forEach((i) => row(i, 12));
  }
}
