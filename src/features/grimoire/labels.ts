/** Spell level as shown on screen. */
export function levelLabel(level: number): string {
  return level === 0 ? 'Trucchetto' : `${level}° livello`;
}

/** The start of a description, cut at a word, for lists. */
export function excerpt(text: string, max = 130): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40))}…`;
}
