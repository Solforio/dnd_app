/**
 * The single place where numbers become UI text: Spanish convention, comma for
 * decimals and period for thousands. es-ES normally leaves four-digit numbers
 * ungrouped ("1250"); this app always groups them ("1.250") for consistency.
 */

const cache = new Map<number, Intl.NumberFormat>();

function formatter(decimals: number): Intl.NumberFormat {
  let f = cache.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
      useGrouping: false,
    });
    cache.set(decimals, f);
  }
  return f;
}

/** Inserts a period every three digits of the integer part. Not left to Intl, so the rule is the same in every browser. */
function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatNumber(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '–';
  const raw = formatter(decimals).format(n); // e.g. "-1250,5"
  const negative = raw.startsWith('-');
  const [intPart = '', frac] = raw.replace(/^-/, '').split(',');
  const body = frac === undefined ? group(intPart) : `${group(intPart)},${frac}`;
  return negative ? `−${body}` : body;
}

/** Signed form for modifiers and subtotals: "+5", "−2", "0". */
export function formatSigned(n: number): string {
  return n > 0 ? `+${formatNumber(n)}` : formatNumber(n);
}
