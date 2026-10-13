export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export type KeepDropKind = 'kh' | 'kl' | 'dh' | 'dl';

export interface KeepDrop {
  kind: KeepDropKind;
  count: number;
}

export type FormulaTerm =
  | { type: 'dice'; sign: 1 | -1; count: number; sides: number; keepDrop?: KeepDrop }
  | { type: 'flat'; sign: 1 | -1; value: number };

export interface Formula {
  /** Canonical text, e.g. "1d20+5" or "4d6kh3". */
  text: string;
  terms: FormulaTerm[];
}

export interface DieResult {
  sides: number;
  value: number;
  kept: boolean;
}

export interface TermResult {
  sign: 1 | -1;
  /** Canonical text of the term without its sign, e.g. "1d20" or "5". */
  notation: string;
  /** Set for flat terms. */
  flat?: number;
  dice: DieResult[];
  subtotal: number;
}

export interface RollOutcome {
  formula: string;
  /** The mode actually applied: "normal" when no plain 1d20 term was present. */
  mode: RollMode;
  terms: TermResult[];
  total: number;
  crit: boolean;
  fumble: boolean;
}

/** Returns an integer in [1, sides]. */
export type DieRoller = (sides: number) => number;
