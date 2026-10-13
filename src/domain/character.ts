import { parseFormula } from './dice/parser';
import type { DieResult, RollMode, RollOutcome, TermResult } from './dice/types';
import { HP_LIMIT, type DeathSaves, type Hp, type SaveCount } from './hp/hp';
import { runMigrations, SchemaError, type Migration } from './schema/migrate';
import { asArray, asBool, asInt, asOneOf, asRecord, asString } from './schema/sanitize';

export const CHARACTER_SCHEMA_VERSION = 1;
export const HISTORY_LIMIT = 100;
export const PRESET_LIMIT = 50;
const ROLL_MODES: readonly RollMode[] = ['normal', 'advantage', 'disadvantage'];

export interface RollRecord extends RollOutcome {
  id: string;
  label?: string;
  /** Epoch milliseconds. */
  at: number;
}

export interface Preset {
  id: string;
  name: string;
  formula: string;
}

export interface Character {
  schemaVersion: typeof CHARACTER_SCHEMA_VERSION;
  id: string;
  name: string;
  hp: Hp;
  deathSaves: DeathSaves;
  rollMode: RollMode;
  /** Presets belong to the character: an attack bonus only makes sense for one character. */
  presets: Preset[];
  /** Newest first, at most HISTORY_LIMIT entries. */
  history: RollRecord[];
  updatedAt: number;
}

/** Index n upgrades a character from version n to n + 1. Empty until the shape first changes. */
export const characterMigrations: Readonly<Record<number, Migration>> = {};

export function newId(): string {
  return crypto.randomUUID();
}

export function defaultPresets(): Preset[] {
  return [
    { id: newId(), name: 'Spada lunga: attacco', formula: '1d20+7' },
    { id: newId(), name: 'Spada lunga: danni', formula: '1d8+4' },
    { id: newId(), name: 'Caratteristica (4d6, tieni i 3 migliori)', formula: '4d6kh3' },
  ];
}

export const DEFAULT_CHARACTER_NAME = 'Nuovo personaggio';

export function createCharacter(name = DEFAULT_CHARACTER_NAME): Character {
  return {
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    id: newId(),
    name,
    hp: { cur: 10, max: 10, temp: 0 },
    deathSaves: { successes: 0, failures: 0 },
    rollMode: 'normal',
    presets: defaultPresets(),
    history: [],
    updatedAt: Date.now(),
  };
}

const MAX_TOTAL = 10_000_000;

function sanitizeDie(raw: unknown): DieResult | null {
  const d = asRecord(raw);
  const sides = asInt(d.sides, 2, 1000, 0);
  if (sides === 0) return null;
  return { sides, value: asInt(d.value, 1, sides, 1), kept: asBool(d.kept, true) };
}

function sanitizeTerm(raw: unknown): TermResult {
  const t = asRecord(raw);
  const dice = asArray(t.dice, 200)
    .map(sanitizeDie)
    .filter((d): d is DieResult => d !== null);
  const term: TermResult = {
    sign: t.sign === -1 ? -1 : 1,
    notation: asString(t.notation, 20, '?'),
    dice,
    subtotal: asInt(t.subtotal, -MAX_TOTAL, MAX_TOTAL, 0),
  };
  if (typeof t.flat === 'number') term.flat = asInt(t.flat, 0, MAX_TOTAL, 0);
  return term;
}

function sanitizeRoll(raw: unknown): RollRecord | null {
  const r = asRecord(raw);
  const formula = asString(r.formula, 200);
  if (formula === '') return null;
  const record: RollRecord = {
    id: asString(r.id, 64) || newId(),
    formula,
    mode: asOneOf(r.mode, ROLL_MODES, 'normal'),
    terms: asArray(r.terms, 20).map(sanitizeTerm),
    total: asInt(r.total, -MAX_TOTAL, MAX_TOTAL, 0),
    crit: asBool(r.crit),
    fumble: asBool(r.fumble),
    at: asInt(r.at, 0, Number.MAX_SAFE_INTEGER, 0),
  };
  const label = asString(r.label, 80);
  if (label) record.label = label;
  return record;
}

function sanitizePreset(raw: unknown): Preset | null {
  const p = asRecord(raw);
  const formula = asString(p.formula, 200);
  if (!parseFormula(formula).ok) return null;
  return { id: asString(p.id, 64) || newId(), name: asString(p.name, 80) || formula, formula };
}

/** Coerces an already-migrated document into a valid current Character, clamping every value. */
export function sanitizeCharacter(doc: Record<string, unknown>): Character {
  const hpRaw = asRecord(doc.hp);
  const max = asInt(hpRaw.max, 1, HP_LIMIT, 10);
  const savesRaw = asRecord(doc.deathSaves);
  return {
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    id: asString(doc.id, 64) || newId(),
    name: asString(doc.name, 80) || 'Senza nome',
    hp: {
      max,
      cur: asInt(hpRaw.cur, 0, max, max),
      temp: asInt(hpRaw.temp, 0, HP_LIMIT, 0),
    },
    deathSaves: {
      successes: asInt(savesRaw.successes, 0, 3, 0) as SaveCount,
      failures: asInt(savesRaw.failures, 0, 3, 0) as SaveCount,
    },
    rollMode: asOneOf(doc.rollMode, ROLL_MODES, 'normal'),
    presets: asArray(doc.presets, PRESET_LIMIT)
      .map(sanitizePreset)
      .filter((p): p is Preset => p !== null),
    history: asArray(doc.history, HISTORY_LIMIT)
      .map(sanitizeRoll)
      .filter((r): r is RollRecord => r !== null),
    updatedAt: asInt(doc.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

/** The one entry point for character data from any source: migrate, then sanitize. Throws SchemaError. */
export function loadCharacter(raw: unknown): Character {
  return sanitizeCharacter(runMigrations(raw, CHARACTER_SCHEMA_VERSION, characterMigrations));
}

export function addToHistory(history: RollRecord[], record: RollRecord): RollRecord[] {
  return [record, ...history].slice(0, HISTORY_LIMIT);
}

// --- JSON export / import (manual backup and device transfer) ---

const EXPORT_KIND = 'dnd-companion/character';

export function exportCharacter(c: Character): string {
  return JSON.stringify({ kind: EXPORT_KIND, exportedAt: new Date().toISOString(), character: c }, null, 2);
}

/** Throws SchemaError with an Italian message when the file is not a character export. */
export function importCharacter(json: string): Character {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SchemaError('Il file non è un JSON valido.');
  }
  const envelope = asRecord(parsed);
  if (envelope.kind !== EXPORT_KIND) {
    throw new SchemaError('Il file non è un’esportazione di un personaggio di questa app.');
  }
  return loadCharacter(envelope.character);
}

