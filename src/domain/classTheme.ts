/** A colour for each SRD class (by Italian or English name), as the "r g b" triple CSS expects. */

const THEMES: Record<string, string> = {
  barbaro: '222 108 64',
  barbarian: '222 108 64',
  bardo: '226 110 170',
  bard: '226 110 170',
  chierico: '240 228 176',
  cleric: '240 228 176',
  druido: '124 190 100',
  druid: '124 190 100',
  guerriero: '196 204 220',
  fighter: '196 204 220',
  monaco: '244 176 70',
  monk: '244 176 70',
  paladino: '140 190 255',
  paladin: '140 190 255',
  ranger: '92 178 138',
  ladro: '168 156 210',
  rogue: '168 156 210',
  stregone: '232 96 108',
  sorcerer: '232 96 108',
  warlock: '186 104 228',
  mago: '104 150 245',
  wizard: '104 150 245',
};

export const DEFAULT_CLASS_RGB = '224 176 74';

/** The colour of a class name, or the gold default for an unknown or empty one. */
export function classRgb(name: string): string {
  return THEMES[name.trim().toLowerCase()] ?? DEFAULT_CLASS_RGB;
}
