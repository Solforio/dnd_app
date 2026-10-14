/** Spell level as shown on screen. */
export function levelLabel(level: number): string {
  return level === 0 ? 'Trucchetto' : `${level}° livello`;
}
