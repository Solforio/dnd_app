import { asArray, asBool, asInt, asRecord, asString } from '../schema/sanitize';
import type { Spell } from '../spells';
import type { Sheet } from './sheet';

/**
 * Combat mode: a round counter and the effects running on the character
 * (spells, mostly), each with the rounds it has left. The turn button counts
 * them down. Stored in the sheet, so a reload in the middle of a fight loses nothing.
 */

export interface Effect {
  id: string;
  name: string;
  /** Rounds left, or null for an effect that is ended by hand (a long duration, «until dispelled»). */
  remaining: number | null;
  concentration: boolean;
  note: string;
  /** The SRD spell behind the effect, when there is one: its text can be read from the list. */
  spellId?: string;
}

export interface Combat {
  active: boolean;
  /** 1 while a combat is on, 0 otherwise. */
  round: number;
  effects: Effect[];
}

export const COMBAT_LIMITS = { effects: 30, round: 999, rounds: 999, name: 80, note: 200 } as const;

export function defaultCombat(): Combat {
  return { active: false, round: 0, effects: [] };
}

function sanitizeEffect(raw: unknown, newId: () => string): Effect {
  const e = asRecord(raw);
  const effect: Effect = {
    id: asString(e.id, 64) || newId(),
    name: asString(e.name, COMBAT_LIMITS.name) || 'Effetto',
    remaining: e.remaining === null || e.remaining === undefined ? null : asInt(e.remaining, 1, COMBAT_LIMITS.rounds, 1),
    concentration: asBool(e.concentration),
    note: asString(e.note, COMBAT_LIMITS.note),
  };
  const spellId = asString(e.spellId, 80);
  if (spellId) effect.spellId = spellId;
  return effect;
}

export function sanitizeCombat(raw: unknown, newId: () => string): Combat {
  const c = asRecord(raw);
  const active = asBool(c.active);
  return {
    active,
    round: active ? asInt(c.round, 1, COMBAT_LIMITS.round, 1) : 0,
    effects: asArray(c.effects, COMBAT_LIMITS.effects).map((e) => sanitizeEffect(e, newId)),
  };
}

const withCombat = (s: Sheet, combat: Combat): Sheet => ({ ...s, combat });

/** Starts a combat at round 1; effects already running are kept. */
export function startCombat(s: Sheet): Sheet {
  return withCombat(s, { ...s.combat, active: true, round: 1 });
}

/** Ends the combat and clears its effects (conditions are game state and stay). */
export function endCombat(s: Sheet): Sheet {
  return withCombat(s, defaultCombat());
}

export interface TurnResult {
  sheet: Sheet;
  /** Names of the effects that ran out at the end of this turn. */
  expired: string[];
}

/** End of my turn: the round advances and every timed effect has one round less; the ones at zero end. */
export function endTurn(s: Sheet): TurnResult {
  if (!s.combat.active) return { sheet: s, expired: [] };
  const expired: string[] = [];
  const effects = s.combat.effects.flatMap((e) => {
    if (e.remaining === null) return [e];
    if (e.remaining <= 1) {
      expired.push(e.name);
      return [];
    }
    return [{ ...e, remaining: e.remaining - 1 }];
  });
  return { sheet: withCombat(s, { ...s.combat, round: Math.min(COMBAT_LIMITS.round, s.combat.round + 1), effects }), expired };
}

export interface EffectChange {
  sheet: Sheet;
  /** The concentration effect that was dropped to make room for a new one. */
  dropped: string | null;
  /** Why nothing was added; null when it was. */
  error: string | null;
}

/** Adds an effect. A new concentration effect ends the old one (only one at a time, SRD). */
export function addEffect(s: Sheet, effect: Effect): EffectChange {
  const old = effect.concentration ? s.combat.effects.find((e) => e.concentration) : undefined;
  const kept = s.combat.effects.filter((e) => e !== old);
  if (kept.length >= COMBAT_LIMITS.effects) return { sheet: s, dropped: null, error: `Puoi tenere al massimo ${COMBAT_LIMITS.effects} effetti.` };
  return { sheet: withCombat(s, { ...s.combat, effects: [...kept, effect] }), dropped: old?.name ?? null, error: null };
}

export function removeEffect(s: Sheet, id: string): Sheet {
  return withCombat(s, { ...s.combat, effects: s.combat.effects.filter((e) => e.id !== id) });
}

/** Removes every concentration effect (concentration lost); returns their names too. */
export function dropConcentration(s: Sheet): { sheet: Sheet; dropped: string[] } {
  const dropped = s.combat.effects.filter((e) => e.concentration).map((e) => e.name);
  if (dropped.length === 0) return { sheet: s, dropped };
  return { sheet: withCombat(s, { ...s.combat, effects: s.combat.effects.filter((e) => !e.concentration) }), dropped };
}

/** Difficulty of the Constitution save to keep concentrating after damage: 10 or half the damage, whichever is higher. */
export function concentrationDC(damage: number): number {
  return Math.max(10, Math.floor(damage / 2));
}

export interface Duration {
  /** Rounds, when the duration is short enough to count turn by turn; null when it is ended by hand. */
  rounds: number | null;
}

/**
 * Reads an SRD duration («1 round», «Up to 1 minute», «Concentration…» is a separate flag). A minute is
 * ten rounds; anything from an hour up, «Until dispelled» and «Special» are ended by hand. Instantaneous
 * spells have no duration: null.
 */
export function durationOf(text: string): Duration | null {
  const t = text.toLowerCase().replace(/^up to /, '').trim();
  if (t === 'instantaneous') return null;
  const m = /^(\d+) (round|minute)s?$/.exec(t);
  if (!m) return { rounds: null };
  const n = Number(m[1]);
  return { rounds: m[2] === 'round' ? n : n * 10 };
}

/** The effect a spell leaves running, or null for an instantaneous one. */
export function effectFromSpell(spell: Spell, id: string): Effect | null {
  const d = durationOf(spell.duration);
  if (!d) return null;
  return {
    id,
    name: spell.name,
    remaining: d.rounds,
    concentration: spell.concentration,
    note: spell.duration,
    spellId: spell.id,
  };
}
