import { formulaToText, parseFormula, DICE_LIMITS } from '../dice/parser';
import type { FormulaTerm } from '../dice/types';
import { isHitDie, recoverHitDice } from './hitDice';
import { defaultSpellcasting, restoreSlots, SLOT_LEVELS, SPELLCASTING_LIMITS, type ClassSpells, type Spellcasting } from './spellSlots';
import { asArray, asBool, asInt, asOneOf, asRecord, asString } from '../schema/sanitize';
import {
  ABILITIES,
  CONDITIONS,
  EXHAUSTION_MAX,
  LEVEL_MAX,
  SKILL_INFO,
  SKILLS,
  type Ability,
  type ConditionId,
  type SkillId,
} from './rules';

/** 0 none, 0.5 half (e.g. Jack of All Trades, rounded down), 1 proficient, 2 expertise. */
export type Proficiency = 0 | 0.5 | 1 | 2;
const PROFICIENCIES: readonly Proficiency[] = [0, 0.5, 1, 2];

export interface ClassEntry {
  name: string;
  subclass: string;
  level: number;
  /** 6, 8, 10 or 12; 0 means the SRD die for the class name (d8 if unknown). */
  hitDie: number;
  /** Hit dice spent since the last long rest. */
  hitDiceUsed: number;
}

export interface SaveEntry {
  proficient: boolean;
  /** Extra bonus, e.g. from a magic item. */
  bonus: number;
}

export interface SkillEntry {
  prof: Proficiency;
  bonus: number;
}

export interface Attack {
  id: string;
  name: string;
  ability: Ability | 'none';
  proficient: boolean;
  /** Extra to-hit bonus, e.g. a +1 weapon. */
  bonus: number;
  /** Damage dice, e.g. "1d8" or "2d6+1d4". Empty for attacks with no damage roll. */
  damage: string;
  addAbilityToDamage: boolean;
  damageBonus: number;
  damageType: string;
  notes: string;
}

export type Reset = 'short' | 'long';

export interface Uses {
  cur: number;
  max: number;
  reset: Reset;
}

export interface Feature {
  id: string;
  name: string;
  source: string;
  text: string;
  /** null when the feature has no limited uses. */
  uses: Uses | null;
}

export interface Sheet {
  race: string;
  background: string;
  alignment: string;
  /** At least one entry; several entries mean multiclassing. */
  classes: ClassEntry[];
  abilities: Record<Ability, number>;
  saves: Record<Ability, SaveEntry>;
  skills: Record<SkillId, SkillEntry>;
  ac: number;
  /** Metres, as in the Italian Player's Handbook (9 m = 30 ft). */
  speedM: number;
  initiativeBonus: number;
  attacks: Attack[];
  features: Feature[];
  conditions: ConditionId[];
  exhaustion: number;
  inspiration: boolean;
  languages: string[];
  darkvisionM: number;
  otherProficiencies: string;
  spellcasting: Spellcasting;
}

export const SHEET_LIMITS = {
  classes: 6,
  attacks: 30,
  features: 100,
  languages: 20,
  featureText: 4000,
  otherProficiencies: 2000,
  uses: 99,
  bonus: 50,
  score: 30,
  ac: 50,
  metres: 300,
} as const;

function mapRecord<K extends string, V>(keys: readonly K[], fn: (k: K) => V): Record<K, V> {
  return Object.fromEntries(keys.map((k) => [k, fn(k)])) as Record<K, V>;
}

export function defaultSheet(): Sheet {
  return {
    race: '',
    background: '',
    alignment: '',
    classes: [{ name: '', subclass: '', level: 1, hitDie: 0, hitDiceUsed: 0 }],
    abilities: mapRecord(ABILITIES, () => 10),
    saves: mapRecord(ABILITIES, () => ({ proficient: false, bonus: 0 })),
    skills: mapRecord(SKILLS, (): SkillEntry => ({ prof: 0, bonus: 0 })),
    ac: 10,
    speedM: 9,
    initiativeBonus: 0,
    attacks: [],
    features: [],
    conditions: [],
    exhaustion: 0,
    inspiration: false,
    languages: ['Comune'],
    darkvisionM: 0,
    otherProficiencies: '',
    spellcasting: defaultSpellcasting(),
  };
}

// --- Sanitizing (every source is untrusted) ---

/** Metres with at most one decimal (7,5 m). */
function asMetres(v: unknown, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(SHEET_LIMITS.metres, Math.max(0, Math.round(n * 10) / 10));
}

const asBonus = (v: unknown) => asInt(v, -SHEET_LIMITS.bonus, SHEET_LIMITS.bonus, 0);

function sanitizeClass(raw: unknown): ClassEntry {
  const c = asRecord(raw);
  const hitDie = asInt(c.hitDie, 0, 20, 0);
  return {
    name: asString(c.name, 40),
    subclass: asString(c.subclass, 60),
    level: asInt(c.level, 1, LEVEL_MAX, 1),
    hitDie: isHitDie(hitDie) ? hitDie : 0,
    hitDiceUsed: asInt(c.hitDiceUsed, 0, LEVEL_MAX, 0),
  };
}

/** Accepts only a parsable formula, stored in canonical form; anything else becomes empty. */
function sanitizeDamage(v: unknown): string {
  const text = asString(v, 100);
  if (text.trim() === '') return '';
  const parsed = parseFormula(text);
  return parsed.ok ? parsed.formula.text : '';
}

function sanitizeAttack(raw: unknown, newId: () => string): Attack {
  const a = asRecord(raw);
  return {
    id: asString(a.id, 64) || newId(),
    name: asString(a.name, 60) || 'Attacco',
    ability: asOneOf(a.ability, [...ABILITIES, 'none'] as const, 'str'),
    proficient: asBool(a.proficient, true),
    bonus: asBonus(a.bonus),
    damage: sanitizeDamage(a.damage),
    addAbilityToDamage: asBool(a.addAbilityToDamage, true),
    damageBonus: asBonus(a.damageBonus),
    damageType: asString(a.damageType, 30),
    notes: asString(a.notes, 200),
  };
}

function sanitizeUses(raw: unknown): Uses | null {
  if (raw === null || raw === undefined) return null;
  const u = asRecord(raw);
  const max = asInt(u.max, 1, SHEET_LIMITS.uses, 1);
  return { max, cur: asInt(u.cur, 0, max, max), reset: asOneOf(u.reset, ['short', 'long'] as const, 'long') };
}

function sanitizeFeature(raw: unknown, newId: () => string): Feature {
  const f = asRecord(raw);
  return {
    id: asString(f.id, 64) || newId(),
    name: asString(f.name, 80) || 'Capacità',
    source: asString(f.source, 60),
    text: asString(f.text, SHEET_LIMITS.featureText),
    uses: sanitizeUses(f.uses),
  };
}

const SPELL_LIST_LIMIT = 400;

function sanitizeSpellLists(raw: unknown): Record<string, ClassSpells> {
  const ids = (v: unknown) => [...new Set(asArray(v, SPELL_LIST_LIMIT).map((x) => asString(x, 80)).filter((x) => x !== ''))];
  return Object.fromEntries(
    Object.entries(asRecord(raw))
      .slice(0, 12)
      .map(([key, v]) => [key.slice(0, 30), { known: ids(asRecord(v).known), prepared: ids(asRecord(v).prepared) }]),
  );
}

function sanitizeSpellcasting(raw: unknown): Spellcasting {
  const r = asRecord(raw);
  const levels = (v: unknown, max: number) =>
    Array.from({ length: SLOT_LEVELS }, (_, i) => asInt(Array.isArray(v) ? v[i] : 0, 0, max, 0));
  return {
    slotsUsed: levels(r.slotsUsed, 99),
    pactUsed: asInt(r.pactUsed, 0, 99, 0),
    manualMax: Array.isArray(r.manualMax) ? levels(r.manualMax, SPELLCASTING_LIMITS.slots) : null,
    lists: sanitizeSpellLists(r.lists),
    ignoreLimits: asBool(r.ignoreLimits),
  };
}

export function sanitizeSheet(raw: unknown, newId: () => string): Sheet {
  const s = asRecord(raw);
  const d = defaultSheet();
  const abilities = asRecord(s.abilities);
  const saves = asRecord(s.saves);
  const skills = asRecord(s.skills);
  const classes = asArray(s.classes, SHEET_LIMITS.classes).map(sanitizeClass);
  const conditions = new Set(asArray(s.conditions, CONDITIONS.length * 2));

  return {
    race: asString(s.race, 60),
    background: asString(s.background, 60),
    alignment: asString(s.alignment, 40),
    classes: classes.length > 0 ? classes : d.classes,
    abilities: mapRecord(ABILITIES, (k) => asInt(abilities[k], 1, SHEET_LIMITS.score, 10)),
    saves: mapRecord(ABILITIES, (k) => {
      const e = asRecord(saves[k]);
      return { proficient: asBool(e.proficient), bonus: asBonus(e.bonus) };
    }),
    skills: mapRecord(SKILLS, (k) => {
      const e = asRecord(skills[k]);
      const prof = PROFICIENCIES.find((p) => p === e.prof) ?? 0;
      return { prof, bonus: asBonus(e.bonus) };
    }),
    ac: asInt(s.ac, 0, SHEET_LIMITS.ac, d.ac),
    speedM: asMetres(s.speedM, d.speedM),
    initiativeBonus: asBonus(s.initiativeBonus),
    attacks: asArray(s.attacks, SHEET_LIMITS.attacks).map((a) => sanitizeAttack(a, newId)),
    features: asArray(s.features, SHEET_LIMITS.features).map((f) => sanitizeFeature(f, newId)),
    // Kept in the canonical order, without duplicates or unknown ids.
    conditions: CONDITIONS.filter((c) => conditions.has(c)),
    exhaustion: asInt(s.exhaustion, 0, EXHAUSTION_MAX, 0),
    inspiration: asBool(s.inspiration),
    languages: Array.isArray(s.languages)
      ? asArray(s.languages, SHEET_LIMITS.languages)
          .map((l) => asString(l, 40).trim())
          .filter((l) => l !== '')
      : d.languages,
    darkvisionM: asMetres(s.darkvisionM, 0),
    otherProficiencies: asString(s.otherProficiencies, SHEET_LIMITS.otherProficiencies),
    spellcasting: sanitizeSpellcasting(s.spellcasting),
  };
}

// --- Calculations ---

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function totalLevel(classes: readonly ClassEntry[]): number {
  const sum = classes.reduce((acc, c) => acc + c.level, 0);
  return Math.min(LEVEL_MAX, Math.max(1, sum));
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.min(LEVEL_MAX, Math.max(1, level)) - 1) / 4);
}

export function sheetProficiency(s: Sheet): number {
  return proficiencyBonus(totalLevel(s.classes));
}

export function saveBonus(s: Sheet, ability: Ability): number {
  const e = s.saves[ability];
  return abilityMod(s.abilities[ability]) + (e.proficient ? sheetProficiency(s) : 0) + e.bonus;
}

export function skillBonus(s: Sheet, skill: SkillId): number {
  const e = s.skills[skill];
  const ability = SKILL_INFO[skill].ability;
  return abilityMod(s.abilities[ability]) + Math.floor(e.prof * sheetProficiency(s)) + e.bonus;
}

export function passivePerception(s: Sheet): number {
  return 10 + skillBonus(s, 'perception');
}

export function initiative(s: Sheet): number {
  return abilityMod(s.abilities.dex) + s.initiativeBonus;
}

function abilityModOrZero(s: Sheet, ability: Ability | 'none'): number {
  return ability === 'none' ? 0 : abilityMod(s.abilities[ability]);
}

export function attackBonus(s: Sheet, a: Attack): number {
  return abilityModOrZero(s, a.ability) + (a.proficient ? sheetProficiency(s) : 0) + a.bonus;
}

/** A d20 plus a flat modifier, e.g. "1d20+5", "1d20-1", "1d20". */
export function d20Formula(modifier: number): string {
  return formulaToText([
    { type: 'dice', sign: 1, count: 1, sides: 20 },
    ...(modifier === 0 ? [] : [{ type: 'flat', sign: modifier < 0 ? -1 : 1, value: Math.abs(modifier) } as const]),
  ]);
}

export function attackFormula(s: Sheet, a: Attack): string {
  return d20Formula(attackBonus(s, a));
}

/** Flat part of the damage: ability modifier (if added) plus the extra bonus. */
export function damageModifier(s: Sheet, a: Attack): number {
  return (a.addAbilityToDamage ? abilityModOrZero(s, a.ability) : 0) + a.damageBonus;
}

/**
 * Damage formula, or null when the attack has no damage dice. A critical hit
 * doubles every die (not the flat modifiers), as in the SRD.
 */
export function damageFormula(s: Sheet, a: Attack, critical = false): string | null {
  if (a.damage === '') return null;
  const parsed = parseFormula(a.damage);
  if (!parsed.ok) return null;
  const terms: FormulaTerm[] = parsed.formula.terms.map((t) =>
    critical && t.type === 'dice' && !t.keepDrop
      ? { ...t, count: Math.min(DICE_LIMITS.maxCount, t.count * 2) }
      : t,
  );
  const flat = damageModifier(s, a);
  if (flat !== 0) terms.push({ type: 'flat', sign: flat < 0 ? -1 : 1, value: Math.abs(flat) });
  return formulaToText(terms);
}

/** "Guerriero 5", "Mago 3 / Chierico 1", or "Livello 1" while no class name is set. */
export function classSummary(classes: readonly ClassEntry[]): string {
  const named = classes.filter((c) => c.name.trim() !== '');
  if (named.length === 0) return `Livello ${totalLevel(classes)}`;
  return named.map((c) => `${c.name.trim()} ${c.level}`).join(' / ');
}

// --- Rests ---

export interface RestResult {
  sheet: Sheet;
  /** Names of the features whose uses came back. */
  restored: string[];
  /** Hit dice regained (long rest only). */
  hitDice: number;
}

function restoreUses(s: Sheet, resets: readonly Reset[]): RestResult {
  const restored: string[] = [];
  const features = s.features.map((f) => {
    if (!f.uses || !resets.includes(f.uses.reset) || f.uses.cur === f.uses.max) return f;
    restored.push(f.name);
    return { ...f, uses: { ...f.uses, cur: f.uses.max } };
  });
  return { sheet: { ...s, features }, restored, hitDice: 0 };
}

export function shortRest(s: Sheet): RestResult {
  const r = restoreUses(s, ['short']);
  const slots = restoreSlots(r.sheet, 'short');
  return { ...r, sheet: slots.sheet, restored: [...r.restored, ...slots.restored] };
}

/** Restores every use and removes one level of exhaustion (SRD, assuming food and drink). */
export function longRestSheet(s: Sheet): RestResult {
  const r = restoreUses(s, ['short', 'long']);
  const dice = recoverHitDice(r.sheet);
  const slots = restoreSlots(dice.sheet, 'long');
  return {
    ...r,
    hitDice: dice.recovered,
    restored: [...r.restored, ...slots.restored],
    sheet: { ...slots.sheet, exhaustion: Math.max(0, s.exhaustion - 1) },
  };
}
