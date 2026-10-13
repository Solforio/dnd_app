import { create } from 'zustand';
import {
  addToHistory,
  createCharacter,
  newId,
  PRESET_LIMIT,
  type Character,
  type RollRecord,
} from '../domain/character';
import { rollFormula } from '../domain/dice/engine';
import { parseFormula } from '../domain/dice/parser';
import { cryptoDie } from '../domain/dice/rng';
import type { RollMode } from '../domain/dice/types';
import * as hpRules from '../domain/hp/hp';
import { longRestSheet, shortRest, type RestResult, type Sheet } from '../domain/sheet/sheet';
import {
  addAndSelect,
  duplicate,
  isFull,
  LIMIT_MESSAGE,
  removeFrom,
  selectIn,
  type Workspace,
} from '../domain/workspace';

/**
 * The characters on screen and every action on them. Where they are stored
 * (browser or account) is decided by session.ts, which watches `revision`,
 * `selection` and `removed`.
 */
interface CharacterStore {
  character: Character;
  /** Other characters of the same workspace. */
  others: Character[];
  /** Bumped by every user change to the active character, never by loading data, so loads are not saved back. */
  revision: number;
  /** Bumped when the user makes another character active (picking, creating, importing or removing one). */
  selection: number;
  /** Ids the user removed that storage has not deleted yet; session.ts empties it. */
  removed: string[];
  /** Last HP/death-save explanation, announced through aria-live. */
  hpStatus: string;

  /** Rolls a formula; returns an Italian error message, or null on success. */
  roll: (formula: string, label?: string) => string | null;
  setRollMode: (mode: RollMode) => void;
  clearHistory: () => void;
  addPreset: (name: string, formula: string) => string | null;
  removePreset: (id: string) => void;
  rename: (name: string) => void;
  /** Applies a change to the sheet of the active character. */
  editSheet: (fn: (sheet: Sheet) => Sheet) => void;

  damage: (amount: number) => void;
  heal: (amount: number) => void;
  gainTemp: (amount: number) => void;
  longRest: () => void;
  shortRest: () => void;
  editHp: (patch: Partial<hpRules.Hp>) => void;
  setDeathSaves: (saves: { successes: number; failures: number }) => void;
  rollDeathSave: () => void;

  /** These return an Italian error message, or null on success. */
  createNew: () => string | null;
  duplicateOf: (id: string) => string | null;
  /** Adds an imported character as active, replacing the one with the same id. */
  addImported: (c: Character) => string | null;
  select: (id: string) => void;
  remove: (id: string) => void;

  /** Shows a workspace loaded from storage. Not a user change: nothing is saved. */
  showWorkspace: (characters: Character[], activeId: string | null) => void;
}

function restoredText(r: RestResult): string {
  return r.restored.length > 0 ? ` Usi recuperati: ${r.restored.join(', ')}.` : '';
}

function touch(c: Character, patch: Partial<Character>): Character {
  return { ...c, ...patch, updatedAt: Date.now() };
}

function makeRecord(formula: string, mode: RollMode, label?: string): RollRecord | string {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return parsed.error;
  const outcome = rollFormula(parsed.formula, mode, cryptoDie);
  const record: RollRecord = { ...outcome, id: newId(), at: Date.now() };
  if (label) record.label = label;
  return record;
}

export function pickActive(characters: Character[], activeId: string | null) {
  const character = characters.find((c) => c.id === activeId) ?? characters[0] ?? createCharacter();
  return { character, others: characters.filter((c) => c.id !== character.id) };
}

export const useCharacterStore = create<CharacterStore>((set, get) => {
  const update = (patch: Partial<Character>) =>
    set((s) => ({ character: touch(s.character, patch), revision: s.revision + 1 }));

  const applyVitals = (change: hpRules.VitalsChange, extra: Partial<Character> = {}) =>
    set((s) => ({
      character: touch(s.character, { ...change.vitals, ...extra }),
      revision: s.revision + 1,
      hpStatus: change.message,
    }));

  const vitals = (): hpRules.Vitals => {
    const { hp, deathSaves } = get().character;
    return { hp, deathSaves };
  };

  /** Switches workspace content after a user action. `saveActive` also writes the new active character. */
  const switchTo = (w: Workspace, saveActive: boolean, extra: Partial<CharacterStore> = {}) =>
    set((s) => ({
      ...w,
      ...extra,
      selection: s.selection + 1,
      revision: saveActive ? s.revision + 1 : s.revision,
      hpStatus: '',
    }));

  /** Adds a brand-new character (created, duplicated or imported) as active, saved right away. */
  const addCharacter = (c: Character): string | null => {
    const s = get();
    const replacing = s.character.id === c.id || s.others.some((o) => o.id === c.id);
    if (!replacing && isFull(s)) return LIMIT_MESSAGE;
    switchTo(addAndSelect(s, c), true);
    return null;
  };

  return {
    // Placeholder until session.ts loads the real workspace, before the first render.
    character: createCharacter(),
    others: [],
    revision: 0,
    selection: 0,
    removed: [],
    hpStatus: '',

    roll: (formula, label) => {
      const c = get().character;
      const record = makeRecord(formula, c.rollMode, label);
      if (typeof record === 'string') return record;
      update({ history: addToHistory(c.history, record) });
      return null;
    },
    setRollMode: (rollMode) => update({ rollMode }),
    clearHistory: () => update({ history: [] }),
    addPreset: (name, formula) => {
      const parsed = parseFormula(formula);
      if (!parsed.ok) return parsed.error;
      const c = get().character;
      if (c.presets.length >= PRESET_LIMIT) return `Puoi salvare al massimo ${PRESET_LIMIT} preset.`;
      const cleanName = name.trim().slice(0, 80) || parsed.formula.text;
      update({ presets: [...c.presets, { id: newId(), name: cleanName, formula: parsed.formula.text }] });
      return null;
    },
    removePreset: (id) => update({ presets: get().character.presets.filter((p) => p.id !== id) }),
    rename: (name) => update({ name: name.slice(0, 80) }),
    editSheet: (fn) => update({ sheet: fn(get().character.sheet) }),

    damage: (n) => applyVitals(hpRules.applyDamage(vitals(), n)),
    heal: (n) => applyVitals(hpRules.applyHealing(vitals(), n)),
    gainTemp: (n) => applyVitals(hpRules.gainTempHp(vitals(), n)),
    longRest: () => {
      const change = hpRules.longRest(vitals());
      const rest = longRestSheet(get().character.sheet);
      const exhaustion = rest.sheet.exhaustion < get().character.sheet.exhaustion ? ' Un livello di indebolimento in meno.' : '';
      applyVitals({ ...change, message: change.message + restoredText(rest) + exhaustion }, { sheet: rest.sheet });
    },
    shortRest: () => {
      const rest = shortRest(get().character.sheet);
      set((s) => ({
        character: touch(s.character, { sheet: rest.sheet }),
        revision: s.revision + 1,
        hpStatus: 'Riposo breve.' + (rest.restored.length > 0 ? restoredText(rest) : ' Nessuna capacità da recuperare.'),
      }));
    },
    editHp: (patch) => applyVitals(hpRules.editHp(vitals(), patch)),
    setDeathSaves: (saves) => applyVitals(hpRules.setDeathSaves(vitals(), saves)),
    rollDeathSave: () => {
      const v = vitals();
      if (!hpRules.canRollDeathSave(v)) return;
      // Death saves always roll a plain d20: the advantage selector is meant for attacks and checks.
      const record = makeRecord('1d20', 'normal', 'Tiro salvezza contro morte');
      if (typeof record === 'string') return;
      const natural = record.terms[0]?.dice.find((d) => d.kept)?.value ?? 1;
      applyVitals(hpRules.applyDeathSave(v, natural), {
        history: addToHistory(get().character.history, record),
      });
    },

    createNew: () => addCharacter(createCharacter()),
    duplicateOf: (id) => {
      const s = get();
      const source = [s.character, ...s.others].find((c) => c.id === id);
      return source ? addCharacter(duplicate(source, newId())) : null;
    },
    addImported: (c) => addCharacter({ ...c, updatedAt: Date.now() }),
    select: (id) => {
      const s = get();
      if (s.character.id !== id) switchTo(selectIn(s, id), false);
    },
    remove: (id) => {
      const s = get();
      const next = removeFrom(s, id);
      if (s.character.id === id) switchTo(next, false, { removed: [...s.removed, id] });
      else set({ others: next.others, removed: [...s.removed, id] });
    },

    showWorkspace: (characters, activeId) => set({ ...pickActive(characters, activeId), hpStatus: '' }),
  };
});
