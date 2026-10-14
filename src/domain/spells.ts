import { asArray, asBool, asInt, asRecord, asString } from './schema/sanitize';
import type { Ability } from './sheet/rules';
import { addEffect, effectFromSpell } from './sheet/combat';
import { abilityMod, sheetProficiency, type ClassEntry, type Sheet } from './sheet/sheet';
import { casterKindOf, pactLeft, pactOf, slotRows, slotsFromClasses, spendPact, spendSlot, type ClassSpells, type Spellcasting } from './sheet/spellSlots';

/** A spell of the SRD 5.1 catalogue (public/srd/spells.json, English text). */
export interface Spell {
  id: string;
  name: string;
  /** 0 for cantrips. */
  level: number;
  school: string;
  /** SRD class lists the spell is on: 'wizard', 'cleric'… */
  classes: string[];
  castingTime: string;
  range: string;
  components: string;
  material?: string;
  ritual: boolean;
  concentration: boolean;
  duration: string;
  text: string;
  higher?: string;
}

export const SPELL_LIMITS = { catalogue: 400, perList: 400, textChars: 6000 } as const;

export function sanitizeCatalogue(raw: unknown): Spell[] {
  const root = asRecord(raw);
  return asArray(root.spells, SPELL_LIMITS.catalogue).flatMap((x) => {
    const s = asRecord(x);
    const id = asString(s.id, 80);
    const name = asString(s.name, 80);
    if (!id || !name) return [];
    const spell: Spell = {
      id,
      name,
      level: asInt(s.level, 0, 9, 0),
      school: asString(s.school, 30),
      classes: asArray(s.classes, 12).map((c) => asString(c, 20)),
      castingTime: asString(s.castingTime, 80),
      range: asString(s.range, 80),
      components: asString(s.components, 20),
      ritual: asBool(s.ritual),
      concentration: asBool(s.concentration),
      duration: asString(s.duration, 80),
      text: asString(s.text, SPELL_LIMITS.textChars),
    };
    if (typeof s.material === 'string') spell.material = asString(s.material, 400);
    if (typeof s.higher === 'string') spell.higher = asString(s.higher, SPELL_LIMITS.textChars);
    return [spell];
  });
}

// --- How each class handles its spells (SRD 5.1) ---

/**
 * `known`: a fixed number of spells known, all castable (bard, sorcerer, warlock, ranger, third casters).
 * `prepared`: prepares from the whole class list (cleric, druid, paladin).
 * `spellbook`: copies spells into a book and prepares some of them (wizard).
 */
export type SpellMode = 'known' | 'prepared' | 'spellbook';

export interface SpellClass {
  /** Where this class's spells are stored in the sheet. */
  key: string;
  label: string;
  mode: SpellMode;
  ability: Ability;
  /** The SRD class list the spells are picked from. */
  list: string;
}

const BASE: Record<string, Omit<SpellClass, 'key'>> = {
  bard: { label: 'Bardo', mode: 'known', ability: 'cha', list: 'bard' },
  cleric: { label: 'Chierico', mode: 'prepared', ability: 'wis', list: 'cleric' },
  druid: { label: 'Druido', mode: 'prepared', ability: 'wis', list: 'druid' },
  paladin: { label: 'Paladino', mode: 'prepared', ability: 'cha', list: 'paladin' },
  ranger: { label: 'Ranger', mode: 'known', ability: 'wis', list: 'ranger' },
  sorcerer: { label: 'Stregone', mode: 'known', ability: 'cha', list: 'sorcerer' },
  warlock: { label: 'Warlock', mode: 'known', ability: 'cha', list: 'warlock' },
  wizard: { label: 'Mago', mode: 'spellbook', ability: 'int', list: 'wizard' },
  'eldritch-knight': { label: 'Cavaliere Mistico', mode: 'known', ability: 'int', list: 'wizard' },
  'arcane-trickster': { label: 'Mistificatore Arcano', mode: 'known', ability: 'int', list: 'wizard' },
};

const NAME_TO_KEY: Record<string, string> = {
  bardo: 'bard', bard: 'bard', chierico: 'cleric', cleric: 'cleric', druido: 'druid', druid: 'druid',
  paladino: 'paladin', paladin: 'paladin', ranger: 'ranger', stregone: 'sorcerer', sorcerer: 'sorcerer',
  warlock: 'warlock', mago: 'wizard', wizard: 'wizard',
};

/** The spell rules of a class entry, or null when it does not cast. */
export function spellClassOf(c: ClassEntry): SpellClass | null {
  const kind = casterKindOf(c);
  if (!kind) return null;
  const name = c.name.trim().toLowerCase();
  const key =
    kind === 'third'
      ? name === 'guerriero' || name === 'fighter'
        ? 'eldritch-knight'
        : 'arcane-trickster'
      : NAME_TO_KEY[name];
  const base = key ? BASE[key] : undefined;
  return key && base ? { key, ...base } : null;
}

const stepFrom = (level: number, steps: readonly number[]) => steps.reduce((n, from, i) => (level >= from ? i : n), -1);

/** Cantrips known by class level. */
function cantripsKnown(key: string, level: number): number {
  const by = (counts: readonly [number, number, number]) => counts[stepFrom(level, [1, 4, 10])] ?? 0;
  switch (key) {
    case 'bard': case 'druid': case 'warlock': return by([2, 3, 4]);
    case 'cleric': case 'wizard': return by([3, 4, 5]);
    case 'sorcerer': return by([4, 5, 6]);
    case 'eldritch-knight': return level < 3 ? 0 : level < 10 ? 2 : 3;
    case 'arcane-trickster': return level < 3 ? 0 : level < 10 ? 3 : 4;
    default: return 0;
  }
}

const KNOWN_BY_LEVEL: Record<string, readonly number[]> = {
  bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
  third: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
};

export interface Capacity {
  cantrips: number;
  /** Spells known (known mode) or in the spellbook (wizard); null when the class prepares from its whole list. */
  spells: number | null;
  /** Spells prepared at a time; null for the known mode. */
  prepared: number | null;
  /** Highest spell level the class can cast. */
  maxLevel: number;
}

/** Highest spell level a class can cast on its own, from its slots (the pact level for a warlock). */
export function maxSpellLevelOf(c: ClassEntry): number {
  if (casterKindOf(c) === 'pact') return pactOf([c])?.level ?? 0;
  const slots = slotsFromClasses([c]);
  return slots.reduce((top, n, i) => (n > 0 ? i + 1 : top), 0);
}

/** How many cantrips and spells a class may have, from its level and ability score (SRD 5.1). */
export function capacityOf(c: ClassEntry, abilities: Record<Ability, number>): Capacity {
  const sc = spellClassOf(c);
  const none: Capacity = { cantrips: 0, spells: null, prepared: null, maxLevel: 0 };
  if (!sc) return none;
  const maxLevel = maxSpellLevelOf(c);
  if (maxLevel === 0) return none;
  const mod = abilityMod(abilities[sc.ability]);
  const level = c.level;
  const cantrips = cantripsKnown(sc.key, level);
  if (sc.mode === 'known') {
    const table = KNOWN_BY_LEVEL[sc.key] ?? KNOWN_BY_LEVEL.third!;
    return { cantrips, spells: table[Math.min(20, level) - 1] ?? 0, prepared: null, maxLevel };
  }
  if (sc.key === 'wizard') {
    return { cantrips, spells: 6 + 2 * (level - 1), prepared: Math.max(1, mod + level), maxLevel };
  }
  const base = sc.key === 'paladin' ? Math.floor(level / 2) : level;
  return { cantrips, spells: null, prepared: Math.max(1, mod + base), maxLevel };
}

// --- The character's lists ---

export type { ClassSpells };

export const NO_SPELLS: ClassSpells = { known: [], prepared: [] };

export const listOf = (s: Sheet, key: string): ClassSpells => s.spellcasting.lists[key] ?? NO_SPELLS;

type Catalogue = ReadonlyMap<string, Spell>;

const countLevel = (ids: readonly string[], spells: Catalogue, test: (level: number) => boolean) =>
  ids.filter((id) => {
    const sp = spells.get(id);
    return sp !== undefined && test(sp.level);
  }).length;

function withList(s: Sheet, key: string, list: ClassSpells): Sheet {
  const sc: Spellcasting = { ...s.spellcasting, lists: { ...s.spellcasting.lists, [key]: list } };
  return { ...s, spellcasting: sc };
}

export interface SpellChange {
  sheet: Sheet;
  /** Why nothing changed, in Italian; null when the change was made. */
  error: string | null;
}

/**
 * Adds a spell: a cantrip or, for a known-mode class or a wizard, a spell known; for a class that
 * prepares from its list, a prepared spell. Enforces the class list, the highest spell level and
 * the counts, unless the sheet ignores the limits.
 */
export function addSpell(s: Sheet, sc: SpellClass, cap: Capacity, spell: Spell, spells: Catalogue): SpellChange {
  const list = listOf(s, sc.key);
  const fail = (error: string): SpellChange => ({ sheet: s, error });
  const ignore = s.spellcasting.ignoreLimits;
  const isCantrip = spell.level === 0;
  const target = isCantrip || sc.mode !== 'prepared' ? 'known' : 'prepared';
  if (list.known.includes(spell.id) || list.prepared.includes(spell.id)) return fail(`«${spell.name}» è già nella lista.`);
  if (!ignore) {
    if (!spell.classes.includes(sc.list)) return fail(`«${spell.name}» non è nella lista di questa classe.`);
    if (spell.level > cap.maxLevel) return fail(`Al livello attuale non puoi ancora usare incantesimi di livello ${spell.level}.`);
    if (isCantrip && countLevel(list.known, spells, (l) => l === 0) >= cap.cantrips) {
      return fail(`Hai già tutti i trucchetti che puoi conoscere (${cap.cantrips}).`);
    }
    if (!isCantrip && target === 'known' && cap.spells !== null && countLevel(list.known, spells, (l) => l > 0) >= cap.spells) {
      return fail(`Hai già tutti gli incantesimi che puoi ${sc.mode === 'spellbook' ? 'avere nel libro' : 'conoscere'} (${cap.spells}).`);
    }
    if (target === 'prepared' && cap.prepared !== null && list.prepared.length >= cap.prepared) {
      return fail(`Hai già preparato tutti gli incantesimi che puoi (${cap.prepared}). Togline uno prima.`);
    }
  }
  return {
    sheet: withList(s, sc.key, target === 'known' ? { ...list, known: [...list.known, spell.id] } : { ...list, prepared: [...list.prepared, spell.id] }),
    error: null,
  };
}

/** Removes a spell from the class's lists (a wizard's spellbook entry takes its preparation with it). */
export function removeSpell(s: Sheet, key: string, id: string): Sheet {
  const list = listOf(s, key);
  return withList(s, key, { known: list.known.filter((x) => x !== id), prepared: list.prepared.filter((x) => x !== id) });
}

/** The wizard prepares from the spellbook: toggles the preparation of a spell already in it. */
export function togglePrepared(s: Sheet, sc: SpellClass, cap: Capacity, id: string): SpellChange {
  const list = listOf(s, sc.key);
  if (list.prepared.includes(id)) {
    return { sheet: withList(s, sc.key, { ...list, prepared: list.prepared.filter((x) => x !== id) }), error: null };
  }
  if (!list.known.includes(id)) return { sheet: s, error: 'Prima aggiungi l’incantesimo al libro.' };
  if (!s.spellcasting.ignoreLimits && cap.prepared !== null && list.prepared.length >= cap.prepared) {
    return { sheet: s, error: `Hai già preparato tutti gli incantesimi che puoi (${cap.prepared}).` };
  }
  return { sheet: withList(s, sc.key, { ...list, prepared: [...list.prepared, id] }), error: null };
}

/** The spells the character can cast right now from one class: cantrips plus known or prepared spells. */
export function castable(s: Sheet, sc: SpellClass, spells: Catalogue): string[] {
  const list = listOf(s, sc.key);
  if (sc.mode === 'known') return list.known;
  // A wizard's book holds more than is prepared: only its cantrips and the prepared spells count.
  const known = sc.mode === 'spellbook' ? list.known.filter((id) => spells.get(id)?.level === 0) : list.known;
  return [...known, ...list.prepared];
}

// --- Casting ---

export type CastChoice =
  | { kind: 'slot'; level: number; left: number }
  | { kind: 'pact'; level: number; left: number }
  | { kind: 'ritual' }
  /** A cantrip: no slot to spend. */
  | { kind: 'free' };

/** Ways to cast a spell now: a slot of its level or higher, a pact slot, or as a ritual. */
export function castOptions(s: Sheet, spell: Spell): CastChoice[] {
  if (spell.level === 0) return [];
  const options: CastChoice[] = slotRows(s)
    .filter((r) => r.level >= spell.level && r.left > 0)
    .map((r) => ({ kind: 'slot', level: r.level, left: r.left }));
  const pact = pactLeft(s);
  if (pact && pact.left > 0 && pact.pact.level >= spell.level) options.push({ kind: 'pact', level: pact.pact.level, left: pact.left });
  if (spell.ritual) options.push({ kind: 'ritual' });
  return options;
}

export function castSpell(s: Sheet, choice: CastChoice): Sheet {
  if (choice.kind === 'slot') return spendSlot(s, choice.level);
  if (choice.kind === 'pact') return spendPact(s);
  return s;
}

export interface CastResult {
  sheet: Sheet;
  /** The effect now running because of the cast (only during a combat), or null. */
  tracked: boolean;
  /** The concentration spell that ended to make room for this one. */
  dropped: string | null;
}

/** Casts a spell; during a combat a spell that lasts leaves an effect on the list, counted down by the turn button. */
export function castWithEffect(s: Sheet, choice: CastChoice, spell: Spell, newId: () => string): CastResult {
  const cast = castSpell(s, choice);
  const effect = cast.combat.active ? effectFromSpell(spell, newId()) : null;
  if (!effect) return { sheet: cast, tracked: false, dropped: null };
  const added = addEffect(cast, effect);
  return { sheet: added.sheet, tracked: added.error === null, dropped: added.dropped };
}

export interface SpellStats {
  /** Save DC: 8 + proficiency bonus + the casting ability modifier. */
  dc: number;
  /** Spell attack bonus: proficiency bonus + the casting ability modifier. */
  attack: number;
}

export function spellStats(s: Sheet, sc: SpellClass): SpellStats {
  const mod = abilityMod(s.abilities[sc.ability]);
  const prof = sheetProficiency(s);
  return { dc: 8 + prof + mod, attack: prof + mod };
}
