import spellsJson from '../../public/srd/spells.json?raw';
import { describe, expect, it } from 'vitest';
import { defaultSheet, sanitizeSheet, type ClassEntry, type Sheet } from './sheet/sheet';
import { spendSlot } from './sheet/spellSlots';
import {
  addSpell,
  capacityOf,
  castable,
  castOptions,
  castSpell,
  listOf,
  maxSpellLevelOf,
  removeSpell,
  sanitizeCatalogue,
  spellClassOf,
  togglePrepared,
  type Spell,
} from './spells';

const catalogue = sanitizeCatalogue(JSON.parse(spellsJson));
const byId = new Map(catalogue.map((s) => [s.id, s]));
const spell = (id: string): Spell => {
  const s = byId.get(id);
  if (!s) throw new Error(`no spell ${id}`);
  return s;
};

const cls = (name: string, level: number, subclass = ''): ClassEntry => ({ name, subclass, level, hitDie: 0, hitDiceUsed: 0 });
const sheetOf = (c: ClassEntry, abilities: Partial<Sheet['abilities']> = {}): Sheet => ({
  ...defaultSheet(),
  classes: [c],
  abilities: { ...defaultSheet().abilities, ...abilities },
});
const capOf = (s: Sheet) => capacityOf(s.classes[0]!, s.abilities);
const classOf = (s: Sheet) => spellClassOf(s.classes[0]!)!;

describe('the catalogue', () => {
  it('is the SRD list: 319 spells, 24 cantrips, every one with a class list and a level 0-9', () => {
    expect(catalogue).toHaveLength(319);
    expect(catalogue.filter((s) => s.level === 0)).toHaveLength(24);
    expect(catalogue.every((s) => s.classes.length > 0 && s.level >= 0 && s.level <= 9 && s.text.length > 0)).toBe(true);
    expect(spell('fireball')).toMatchObject({ level: 3, school: 'Evocation', concentration: false });
    expect(spell('fireball').classes).toEqual(['sorcerer', 'wizard']);
    expect(spell('detect-magic')).toMatchObject({ ritual: true, concentration: true });
  });

  it('drops entries without an id or a name', () => {
    const odd = sanitizeCatalogue({ spells: [{ id: 'a' }, { name: 'B' }, { id: 'c', name: 'C', level: 99 }] });
    expect(odd.map((s) => [s.id, s.level])).toEqual([['c', 9]]);
    expect(sanitizeCatalogue(null)).toEqual([]);
  });
});

describe('which class a character casts with', () => {
  it('maps Italian and English names, and the third casters by subclass', () => {
    expect(spellClassOf(cls('Mago', 1))).toMatchObject({ key: 'wizard', mode: 'spellbook', ability: 'int' });
    expect(spellClassOf(cls('Cleric', 1))).toMatchObject({ key: 'cleric', mode: 'prepared', ability: 'wis' });
    expect(spellClassOf(cls('Stregone', 1))).toMatchObject({ key: 'sorcerer', mode: 'known', ability: 'cha' });
    expect(spellClassOf(cls('Guerriero', 3, 'Cavaliere Mistico'))).toMatchObject({ key: 'eldritch-knight', list: 'wizard' });
    expect(spellClassOf(cls('Ladro', 3, 'Arcane Trickster'))).toMatchObject({ key: 'arcane-trickster' });
    expect(spellClassOf(cls('Barbaro', 5))).toBeNull();
  });
});

describe('how many spells', () => {
  it('wizard: three cantrips, a six-spell book plus two per level, prepares INT + level', () => {
    expect(capOf(sheetOf(cls('Mago', 1), { int: 16 }))).toEqual({ cantrips: 3, spells: 6, prepared: 4, maxLevel: 1 });
    expect(capOf(sheetOf(cls('Mago', 5), { int: 16 }))).toEqual({ cantrips: 4, spells: 14, prepared: 8, maxLevel: 3 });
    expect(capOf(sheetOf(cls('Mago', 10), { int: 8 }))).toMatchObject({ cantrips: 5, prepared: 9 });
  });

  it('cleric and druid prepare WIS + level from the whole list, paladin CHA + half the level, at least 1', () => {
    expect(capOf(sheetOf(cls('Chierico', 3), { wis: 14 }))).toEqual({ cantrips: 3, spells: null, prepared: 5, maxLevel: 2 });
    expect(capOf(sheetOf(cls('Druido', 1), { wis: 8 }))).toMatchObject({ cantrips: 2, prepared: 1 });
    expect(capOf(sheetOf(cls('Paladino', 5), { cha: 16 }))).toEqual({ cantrips: 0, spells: null, prepared: 5, maxLevel: 2 });
    expect(capOf(sheetOf(cls('Paladino', 1)))).toEqual({ cantrips: 0, spells: null, prepared: null, maxLevel: 0 });
  });

  it('sorcerer, bard, warlock, ranger and third casters know a fixed number', () => {
    expect(capOf(sheetOf(cls('Stregone', 1)))).toEqual({ cantrips: 4, spells: 2, prepared: null, maxLevel: 1 });
    expect(capOf(sheetOf(cls('Bardo', 5)))).toMatchObject({ cantrips: 3, spells: 8, maxLevel: 3 });
    expect(capOf(sheetOf(cls('Warlock', 5)))).toEqual({ cantrips: 3, spells: 6, prepared: null, maxLevel: 3 });
    expect(capOf(sheetOf(cls('Ranger', 1)))).toMatchObject({ spells: null, maxLevel: 0 });
    expect(capOf(sheetOf(cls('Ranger', 5)))).toMatchObject({ cantrips: 0, spells: 4, maxLevel: 2 });
    expect(capOf(sheetOf(cls('Guerriero', 7, 'Cavaliere Mistico')))).toEqual({ cantrips: 2, spells: 5, prepared: null, maxLevel: 2 });
    expect(capOf(sheetOf(cls('Guerriero', 2, 'Cavaliere Mistico')))).toMatchObject({ cantrips: 0, maxLevel: 0 });
    expect(capOf(sheetOf(cls('Barbaro', 5)))).toEqual({ cantrips: 0, spells: null, prepared: null, maxLevel: 0 });
  });

  it('knows the highest spell level of each class', () => {
    expect([1, 3, 5, 9, 17].map((l) => maxSpellLevelOf(cls('Mago', l)))).toEqual([1, 2, 3, 5, 9]);
    expect([2, 5, 9, 13, 17].map((l) => maxSpellLevelOf(cls('Ranger', l)))).toEqual([1, 2, 3, 4, 5]);
    expect([1, 3, 5, 7, 9].map((l) => maxSpellLevelOf(cls('Warlock', l)))).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('adding spells', () => {
  const wizard = (level = 1) => sheetOf(cls('Mago', level), { int: 14 });

  it('puts cantrips and spellbook entries in the known list, up to the limits', () => {
    let s = wizard();
    for (const id of ['fire-bolt', 'light', 'mage-hand']) s = addSpell(s, classOf(s), capOf(s), spell(id), byId).sheet;
    expect(listOf(s, 'wizard').known).toEqual(['fire-bolt', 'light', 'mage-hand']);
    const fourth = addSpell(s, classOf(s), capOf(s), spell('prestidigitation'), byId);
    expect(fourth.error).toMatch(/trucchetti/);
    expect(fourth.sheet).toBe(s);
    expect(addSpell(s, classOf(s), capOf(s), spell('fire-bolt'), byId).error).toMatch(/già/);
  });

  it('refuses spells off the class list or above the reachable level', () => {
    const s = wizard();
    expect(addSpell(s, classOf(s), capOf(s), spell('cure-wounds'), byId).error).toMatch(/lista di questa classe/);
    expect(addSpell(s, classOf(s), capOf(s), spell('fireball'), byId).error).toMatch(/livello 3/);
  });

  it('limits the spellbook, and the wizard prepares only from it', () => {
    let s = wizard();
    const seven = catalogue.filter((x) => x.level === 1 && x.classes.includes('wizard')).slice(0, 7);
    for (const sp of seven.slice(0, 6)) s = addSpell(s, classOf(s), capOf(s), sp, byId).sheet;
    expect(addSpell(s, classOf(s), capOf(s), seven[6]!, byId).error).toMatch(/nel libro/);
    expect(togglePrepared(wizard(), classOf(s), capOf(s), seven[0]!.id).error).toMatch(/libro/);
    for (const sp of seven.slice(0, 3)) s = togglePrepared(s, classOf(s), capOf(s), sp.id).sheet;
    expect(listOf(s, 'wizard').prepared).toHaveLength(3); // INT 14: modifier 2 + level 1
    expect(togglePrepared(s, classOf(s), capOf(s), seven[3]!.id).error).toMatch(/preparato/);
    s = togglePrepared(s, classOf(s), capOf(s), seven[0]!.id).sheet;
    expect(listOf(s, 'wizard').prepared).toHaveLength(2);
  });

  it('lets a cleric prepare from the whole list, up to WIS + level', () => {
    let s = sheetOf(cls('Chierico', 1), { wis: 12 }); // modifier 1 + level 1 = 2
    const add = (id: string) => addSpell(s, classOf(s), capOf(s), spell(id), byId);
    for (const id of ['bless', 'cure-wounds']) s = add(id).sheet;
    expect(listOf(s, 'cleric').prepared).toEqual(['bless', 'cure-wounds']);
    expect(add('guiding-bolt').error).toMatch(/preparato/);
    s = removeSpell(s, 'cleric', 'bless');
    expect(add('guiding-bolt').error).toBeNull();
  });

  it('ignores every limit when asked', () => {
    const base = wizard();
    const s: Sheet = { ...base, spellcasting: { ...base.spellcasting, ignoreLimits: true } };
    expect(addSpell(s, classOf(s), capOf(s), spell('fireball'), byId).error).toBeNull();
    expect(addSpell(s, classOf(s), capOf(s), spell('cure-wounds'), byId).error).toBeNull();
  });

  it('removing a spell takes it out of both lists', () => {
    let s = wizard();
    s = addSpell(s, classOf(s), capOf(s), spell('magic-missile'), byId).sheet;
    s = togglePrepared(s, classOf(s), capOf(s), 'magic-missile').sheet;
    s = removeSpell(s, 'wizard', 'magic-missile');
    expect(listOf(s, 'wizard')).toEqual({ known: [], prepared: [] });
  });
});

describe('what can be cast', () => {
  it('known classes cast what they know; wizards only cantrips and prepared spells', () => {
    let s = sheetOf(cls('Mago', 1), { int: 14 });
    for (const id of ['fire-bolt', 'magic-missile', 'shield']) s = addSpell(s, classOf(s), capOf(s), spell(id), byId).sheet;
    s = togglePrepared(s, classOf(s), capOf(s), 'shield').sheet;
    expect(castable(s, classOf(s), byId).sort()).toEqual(['fire-bolt', 'shield']);

    const sorc = sheetOf(cls('Stregone', 1));
    const added = addSpell(sorc, classOf(sorc), capOf(sorc), spell('magic-missile'), byId).sheet;
    expect(castable(added, classOf(sorc), byId)).toEqual(['magic-missile']);
  });
});

describe('casting', () => {
  const kind = (o: { kind: string; level?: number }) => (o.kind === 'slot' ? o.level : o.kind);

  it('offers slots of the spell level or higher, pact slots and the ritual option', () => {
    const wiz = sheetOf(cls('Mago', 5)); // 4 / 3 / 2 slots
    expect(castOptions(wiz, spell('fire-bolt'))).toEqual([]);
    expect(castOptions(wiz, spell('magic-missile')).map(kind)).toEqual([1, 2, 3]);
    expect(castOptions(wiz, spell('fireball')).map(kind)).toEqual([3]);
    expect(castOptions(wiz, spell('detect-magic')).at(-1)).toEqual({ kind: 'ritual' });
    const warlock = sheetOf(cls('Warlock', 5)); // 2 pact slots of 3rd level
    expect(castOptions(warlock, spell('hellish-rebuke'))).toEqual([{ kind: 'pact', level: 3, left: 2 }]);
  });

  it('casting spends the chosen slot, the ritual nothing', () => {
    let s = sheetOf(cls('Mago', 5));
    s = castSpell(s, { kind: 'slot', level: 3, left: 2 });
    expect(castOptions(s, spell('fireball'))).toEqual([{ kind: 'slot', level: 3, left: 1 }]);
    expect(castSpell(s, { kind: 'ritual' })).toBe(s);
    s = spendSlot(s, 3);
    expect(castOptions(s, spell('fireball'))).toEqual([]);
  });
});

describe('sanitizing the lists', () => {
  it('keeps ids, drops duplicates and junk', () => {
    const raw = { spellcasting: { lists: { wizard: { known: ['a', 'a', 5, ''], prepared: ['b'] }, bad: 7 }, ignoreLimits: true } };
    const s = sanitizeSheet(raw, () => 'x');
    expect(s.spellcasting.lists.wizard).toEqual({ known: ['a'], prepared: ['b'] });
    expect(s.spellcasting.lists.bad).toEqual({ known: [], prepared: [] });
    expect(s.spellcasting.ignoreLimits).toBe(true);
    expect(sanitizeSheet({}, () => 'x').spellcasting.lists).toEqual({});
  });
});
