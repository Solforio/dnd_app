import { vibrationPattern } from '../domain/settings';
import { useSettings } from './settingsStore';

/** A short buzz for a roll, when the device supports it and the user turned it on in the settings. */
export function buzzForRoll(roll: { crit: boolean; fumble: boolean }): void {
  if (!useSettings.getState().settings.vibration) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(vibrationPattern(roll));
}
