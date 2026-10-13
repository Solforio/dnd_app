import { create } from 'zustand';
import {
  addToHistory,
  importCharacter as parseImport,
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
import { loadLocal, saveLocal } from './localStore';

interface CharacterStore {
  character: Character;
  /** Other characters kept in storage; the picker arrives in Phase 2. */
  others: Character[];
  unreadable: unknown[];
  /** Last HP/death-save explanation, announced through aria-live. */
  hpStatus: string;
  storageWarning?: string;

  /** Rolls a formula; returns an Italian error message, or null on success. */
  roll: (formula: string, label?: string) => string | null;
  setRollMode: (mode: RollMode) => void;
  clearHistory: () => void;
  addPreset: (name: string, formula: string) => string | null;
  removePreset: (id: string) => void;
  rename: (name: string) => void;

  damage: (amount: number) => void;
  heal: (amount: number) => void;
  gainTemp: (amount: number) => void;
  longRest: () => void;
  editHp: (patch: Partial<hpRules.Hp>) => void;
  setDeathSaves: (saves: { successes: number; failures: number }) => void;
  rollDeathSave: () => void;

  /** Replaces the current character with an imported one; returns an error message or null. */
  importJson: (json: string) => string | null;
}

const initial = loadLocal();
const initialCharacter = initial.characters.find((c) => c.id === initial.activeCharacterId)!;

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

export const useCharacterStore = create<CharacterStore>((set, get) => {
  const update = (patch: Partial<Character>) => set((s) => ({ character: touch(s.character, patch) }));

  const applyVitals = (change: hpRules.VitalsChange, extra: Partial<Character> = {}) =>
    set((s) => ({
      character: touch(s.character, { ...change.vitals, ...extra }),
      hpStatus: change.message,
    }));

  const vitals = (): hpRules.Vitals => {
    const { hp, deathSaves } = get().character;
    return { hp, deathSaves };
  };

  return {
    character: initialCharacter,
    others: initial.characters.filter((c) => c !== initialCharacter),
    unreadable: initial.unreadable,
    hpStatus: '',
    storageWarning: initial.warning,

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

    damage: (n) => applyVitals(hpRules.applyDamage(vitals(), n)),
    heal: (n) => applyVitals(hpRules.applyHealing(vitals(), n)),
    gainTemp: (n) => applyVitals(hpRules.gainTempHp(vitals(), n)),
    longRest: () => applyVitals(hpRules.longRest(vitals())),
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

    importJson: (json) => {
      try {
        const imported = parseImport(json);
        // A different character is not thrown away: it stays in storage for the Phase 2 picker.
        set((s) => ({
          character: imported,
          others: [
            ...(s.character.id === imported.id ? [] : [s.character]),
            ...s.others.filter((c) => c.id !== imported.id),
          ],
          hpStatus: `Importato «${imported.name}».`,
        }));
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Importazione non riuscita.';
      }
    },
  };
});

// --- Persistence: debounced write to localStorage, flushed when the page is hidden. ---

let timer: ReturnType<typeof setTimeout> | undefined;

function flush() {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  const { character, others, unreadable } = useCharacterStore.getState();
  const ok = saveLocal({ characters: [character, ...others], activeCharacterId: character.id, unreadable });
  if (!ok) {
    useCharacterStore.setState({
      storageWarning: 'Il browser non permette di salvare: i dati andranno persi alla chiusura. Esporta un backup.',
    });
  }
}

useCharacterStore.subscribe((s, prev) => {
  if (s.character === prev.character && s.others === prev.others) return;
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(flush, 400);
});

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}
