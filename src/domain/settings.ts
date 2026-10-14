import { asBool, asOneOf, asRecord } from './schema/sanitize';

/** The preferences of this device (not of a character or an account): how the app looks and behaves. */

export const TEXT_SIZES = ['small', 'normal', 'large', 'huge'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

/** Share of the browser's text size each choice gives. */
export const TEXT_SCALE: Readonly<Record<TextSize, number>> = { small: 90, normal: 100, large: 115, huge: 130 };

export const TEXT_SIZE_LABELS: Readonly<Record<TextSize, string>> = {
  small: 'Piccolo',
  normal: 'Normale',
  large: 'Grande',
  huge: 'Molto grande',
};

export const DENSITIES = ['comfortable', 'compact'] as const;
export type Density = (typeof DENSITIES)[number];

export const DENSITY_LABELS: Readonly<Record<Density, string>> = {
  comfortable: 'Comoda',
  compact: 'Compatta',
};

export interface Settings {
  textSize: TextSize;
  density: Density;
  /** The frame details of the fantasy skin: gold corners, card grain, diamonds and rules. */
  ornaments: boolean;
  /** A short buzz when the dice are rolled (phones that support it). */
  vibration: boolean;
}

export const DEFAULT_SETTINGS: Settings = { textSize: 'normal', density: 'comfortable', ornaments: true, vibration: false };

/** Reads what was stored (it can be anything: old versions, edits by hand). */
export function sanitizeSettings(raw: unknown): Settings {
  const r = asRecord(raw);
  return {
    textSize: asOneOf(r.textSize, TEXT_SIZES, DEFAULT_SETTINGS.textSize),
    density: asOneOf(r.density, DENSITIES, DEFAULT_SETTINGS.density),
    ornaments: asBool(r.ornaments, DEFAULT_SETTINGS.ornaments),
    vibration: asBool(r.vibration, DEFAULT_SETTINGS.vibration),
  };
}

/** The pattern for the buzz of a roll: short for an ordinary one, a flourish for a critical hit, long for a fumble. */
export function vibrationPattern(roll: { crit: boolean; fumble: boolean }): number[] {
  if (roll.crit) return [60, 40, 60, 40, 140];
  if (roll.fumble) return [220];
  return [25];
}
