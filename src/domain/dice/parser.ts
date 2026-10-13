import type { Formula, FormulaTerm, KeepDropKind } from './types';

export const DICE_LIMITS = {
  minCount: 1,
  maxCount: 100,
  minSides: 2,
  maxSides: 1000,
  maxTerms: 20,
  maxFlat: 100_000,
} as const;

export type ParseResult = { ok: true; formula: Formula } | { ok: false; error: string };

const EXAMPLES = 'Esempi validi: d20+5, 2d6+1d4+3, 4d6kh3.';
const DICE_TERM = /^(\d*)d(\d+)(?:(kh|kl|dh|dl)(\d*))?$/;
const FLAT_TERM = /^\d+$/;

function fail(message: string): ParseResult {
  return { ok: false, error: `${message} ${EXAMPLES}` };
}

export function termToText(term: FormulaTerm): string {
  if (term.type === 'flat') return String(term.value);
  const kd = term.keepDrop ? `${term.keepDrop.kind}${term.keepDrop.count}` : '';
  return `${term.count}d${term.sides}${kd}`;
}

export function formulaToText(terms: FormulaTerm[]): string {
  return terms
    .map((t, i) => {
      const body = termToText(t);
      if (i === 0) return t.sign === -1 ? `-${body}` : body;
      return `${t.sign === -1 ? '-' : '+'}${body}`;
    })
    .join('');
}

/**
 * Grammar: terms joined by "+" or "-" (the first term may carry a sign).
 * A term is a flat integer or NdM[kh|kl|dh|dl[K]]. Whitespace and case are ignored.
 */
export function parseFormula(input: string): ParseResult {
  const src = input.replace(/\s+/g, '').toLowerCase();
  if (src === '') return fail('Scrivi una formula.');

  // Split before every sign, keeping the sign with the term that follows it.
  const pieces = src.split(/(?=[+-])/);
  if (pieces.length > DICE_LIMITS.maxTerms) {
    return fail(`Troppi termini: al massimo ${DICE_LIMITS.maxTerms}.`);
  }

  const terms: FormulaTerm[] = [];
  for (const piece of pieces) {
    const sign: 1 | -1 = piece.startsWith('-') ? -1 : 1;
    const body = piece.replace(/^[+-]/, '');
    if (body === '') return fail('C’è un segno + o - senza un termine dopo.');

    if (FLAT_TERM.test(body)) {
      const value = Number(body);
      if (value > DICE_LIMITS.maxFlat) {
        return fail(`Il numero ${body} è troppo grande: al massimo ${DICE_LIMITS.maxFlat}.`);
      }
      terms.push({ type: 'flat', sign, value });
      continue;
    }

    const m = DICE_TERM.exec(body);
    if (!m) return fail(`Non capisco «${body}».`);

    const count = m[1] === '' ? 1 : Number(m[1]);
    const sides = Number(m[2]);
    if (count < DICE_LIMITS.minCount || count > DICE_LIMITS.maxCount) {
      return fail(
        `In «${body}» il numero di dadi deve essere tra ${DICE_LIMITS.minCount} e ${DICE_LIMITS.maxCount}.`,
      );
    }
    if (sides < DICE_LIMITS.minSides || sides > DICE_LIMITS.maxSides) {
      return fail(`In «${body}» le facce devono essere tra ${DICE_LIMITS.minSides} e ${DICE_LIMITS.maxSides}.`);
    }

    const kind = m[3] as KeepDropKind | undefined;
    if (!kind) {
      terms.push({ type: 'dice', sign, count, sides });
      continue;
    }
    const kdCount = m[4] === '' ? 1 : Number(m[4]);
    const keeps = kind === 'kh' || kind === 'kl';
    if (keeps && (kdCount < 1 || kdCount > count)) {
      return fail(`In «${body}» puoi tenere da 1 a ${count} dadi.`);
    }
    if (!keeps && (kdCount < 1 || kdCount >= count)) {
      return fail(
        count === 1
          ? `In «${body}» non puoi scartare l’unico dado.`
          : `In «${body}» puoi scartare da 1 a ${count - 1} dadi.`,
      );
    }
    terms.push({ type: 'dice', sign, count, sides, keepDrop: { kind, count: kdCount } });
  }

  return { ok: true, formula: { text: formulaToText(terms), terms } };
}
