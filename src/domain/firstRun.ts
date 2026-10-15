import { ABILITIES, LEVEL_MAX, type Ability } from './sheet/rules';
import { averageRoll, hitDieOf, hpGain } from './sheet/hitDice';
import { SHEET_LIMITS, abilityMod, defaultSheet, type ClassEntry, type Sheet } from './sheet/sheet';

/** The classes of the SRD, as offered when a character is created (Italian names). */
export const FIRST_RUN_CLASSES = ['Barbaro', 'Bardo', 'Chierico', 'Druido', 'Guerriero', 'Ladro', 'Mago', 'Monaco', 'Paladino', 'Ranger', 'Stregone', 'Warlock'] as const;

export interface FirstRunInput {
  className: string;
  level: number;
  abilities: Record<Ability, number>;
}

/**
 * Maximum HP for a new character by the SRD rule: the full hit die at level 1, then the fixed value
 * (half the die plus one) for each further level, plus the Constitution modifier every level, at least 1 each.
 */
export function startingHp(className: string, level: number, con: number): number {
  const entry: ClassEntry = { name: className, subclass: '', level: 1, hitDie: 0, hitDiceUsed: 0 };
  const die = hitDieOf(entry);
  const mod = abilityMod(con);
  const levels = Math.min(LEVEL_MAX, Math.max(1, Math.trunc(level)));
  return hpGain(die, mod) + (levels - 1) * hpGain(Math.floor(averageRoll(die)), mod);
}

/** The sheet of a freshly created character: one class at the chosen level and the six scores. */
export function sheetFromFirstRun(input: FirstRunInput, base: Sheet = defaultSheet()): Sheet {
  const level = Math.min(LEVEL_MAX, Math.max(1, Math.trunc(input.level) || 1));
  const abilities = { ...base.abilities };
  for (const a of ABILITIES) abilities[a] = Math.min(SHEET_LIMITS.score, Math.max(1, Math.trunc(input.abilities[a]) || 10));
  const className = input.className.trim().slice(0, 40);
  return { ...base, abilities, classes: className ? [{ name: className, subclass: '', level, hitDie: 0, hitDiceUsed: 0 }] : base.classes };
}
