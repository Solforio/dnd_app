import { termToText } from './parser';
import type {
  DieResult,
  DieRoller,
  Formula,
  FormulaTerm,
  KeepDrop,
  RollMode,
  RollOutcome,
  TermResult,
} from './types';

/** Indices of the dice that survive a keep/drop rule. Ties go to the earlier die. */
function keptIndices(values: number[], rule: KeepDrop): Set<number> {
  const highFirst = rule.kind === 'kh' || rule.kind === 'dh';
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => (highFirst ? b.value - a.value : a.value - b.value) || a.index - b.index)
    .map((d) => d.index);
  const keeps = rule.kind === 'kh' || rule.kind === 'kl';
  return new Set(keeps ? order.slice(0, rule.count) : order.slice(rule.count));
}

function isPlainD20(term: FormulaTerm): boolean {
  return term.type === 'dice' && term.count === 1 && term.sides === 20 && !term.keepDrop;
}

function rollTerm(term: FormulaTerm, mode: RollMode, roll: DieRoller): TermResult {
  if (term.type === 'flat') {
    return {
      sign: term.sign,
      notation: termToText(term),
      flat: term.value,
      dice: [],
      subtotal: term.sign * term.value,
    };
  }

  let rule = term.keepDrop;
  let count = term.count;
  if (mode !== 'normal' && isPlainD20(term)) {
    count = 2;
    rule = { kind: mode === 'advantage' ? 'kh' : 'kl', count: 1 };
  }

  const values = Array.from({ length: count }, () => roll(term.sides));
  const kept = rule ? keptIndices(values, rule) : null;
  const dice: DieResult[] = values.map((value, i) => ({
    sides: term.sides,
    value,
    kept: kept ? kept.has(i) : true,
  }));
  const sum = dice.reduce((acc, d) => (d.kept ? acc + d.value : acc), 0);
  return { sign: term.sign, notation: termToText(term), dice, subtotal: term.sign * sum };
}

/**
 * Rolls every term. The d20 mode applies to each plain 1d20 term (no keep or
 * drop suffix). Crit and fumble are flagged only for terms that keep exactly
 * one die and that die is a d20; a crit anywhere wins over a fumble.
 */
export function rollFormula(formula: Formula, mode: RollMode, roll: DieRoller): RollOutcome {
  const terms = formula.terms.map((t) => rollTerm(t, mode, roll));

  let crit = false;
  let fumble = false;
  for (const t of terms) {
    const kept = t.dice.filter((d) => d.kept);
    const only = kept[0];
    if (kept.length === 1 && only && only.sides === 20) {
      if (only.value === 20) crit = true;
      if (only.value === 1) fumble = true;
    }
  }
  if (crit) fumble = false;

  return {
    formula: formula.text,
    mode: formula.terms.some(isPlainD20) ? mode : 'normal',
    terms,
    total: terms.reduce((acc, t) => acc + t.subtotal, 0),
    crit,
    fumble,
  };
}
