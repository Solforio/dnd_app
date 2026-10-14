import { LEVEL_MAX } from './rules';
import type { ClassEntry, Sheet } from './sheet';

/** Hit dice the user can pick for a class (SRD classes use 6, 8, 10 or 12). */
export const HIT_DIE_OPTIONS = [6, 8, 10, 12] as const;
export const DEFAULT_HIT_DIE = 8;

/** SRD 5.1 hit die per class, by Italian and English name. */
const SRD_HIT_DIE: Readonly<Record<string, number>> = {
  barbaro: 12, barbarian: 12,
  guerriero: 10, fighter: 10, paladino: 10, paladin: 10, ranger: 10,
  bardo: 8, bard: 8, chierico: 8, cleric: 8, druido: 8, druid: 8, ladro: 8, rogue: 8, monaco: 8, monk: 8, warlock: 8,
  stregone: 6, sorcerer: 6, mago: 6, wizard: 6,
};

export function isHitDie(n: number): boolean {
  return (HIT_DIE_OPTIONS as readonly number[]).includes(n);
}

/** The hit die of a class: the one set by hand, else the SRD one for its name, else a d8. */
export function hitDieOf(c: ClassEntry): number {
  if (isHitDie(c.hitDie)) return c.hitDie;
  return SRD_HIT_DIE[c.name.trim().toLowerCase()] ?? DEFAULT_HIT_DIE;
}

/** SRD fixed value for a level: half the die, plus one. */
export function averageRoll(die: number): number {
  return die / 2 + 1;
}

/** HP gained at a level: the die value plus the CON modifier, never below 1 (SRD). */
export function hpGain(base: number, conMod: number): number {
  return Math.max(1, base + conMod);
}

/** Raises one class by a level and records the hit die chosen for it; null at the level cap. */
export function levelUp(s: Sheet, index: number, die: number): Sheet | null {
  const total = s.classes.reduce((sum, c) => sum + c.level, 0);
  if (total >= LEVEL_MAX || !s.classes[index]) return null;
  return {
    ...s,
    classes: s.classes.map((c, i) => (i === index ? { ...c, level: c.level + 1, hitDie: isHitDie(die) ? die : c.hitDie } : c)),
  };
}

export interface HitDicePool {
  index: number;
  name: string;
  die: number;
  total: number;
  left: number;
}

export function hitDicePools(s: Sheet): HitDicePool[] {
  return s.classes.map((c, index) => ({
    index,
    name: c.name.trim() || `Classe ${index + 1}`,
    die: hitDieOf(c),
    total: c.level,
    left: c.level - Math.min(c.hitDiceUsed, c.level),
  }));
}

/** Marks one hit die of a class as spent; the sheet is unchanged when none is left. */
export function spendHitDie(s: Sheet, index: number): Sheet {
  const pool = hitDicePools(s)[index];
  if (!pool || pool.left <= 0) return s;
  return {
    ...s,
    classes: s.classes.map((c, i) => (i === index ? { ...c, hitDiceUsed: Math.min(c.level, c.hitDiceUsed) + 1 } : c)),
  };
}

/** Long rest: regain up to half of the total hit dice (at least one), the biggest dice first. */
export function recoverHitDice(s: Sheet): { sheet: Sheet; recovered: number } {
  let budget = Math.max(1, Math.floor(s.classes.reduce((sum, c) => sum + c.level, 0) / 2));
  const used = s.classes.map((c) => Math.min(c.hitDiceUsed, c.level));
  const order = s.classes.map((_, i) => i).sort((a, b) => hitDieOf(s.classes[b]!) - hitDieOf(s.classes[a]!));
  let recovered = 0;
  for (const i of order) {
    const back = Math.min(used[i]!, budget);
    used[i] = used[i]! - back;
    budget -= back;
    recovered += back;
  }
  return { sheet: { ...s, classes: s.classes.map((c, i) => ({ ...c, hitDiceUsed: used[i]! })) }, recovered };
}
