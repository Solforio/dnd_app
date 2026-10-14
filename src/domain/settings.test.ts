import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings, TEXT_SCALE, TEXT_SIZES, vibrationPattern } from './settings';

describe('settings', () => {
  it('start with the comfortable defaults', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ textSize: 'normal', density: 'comfortable', ornaments: true, vibration: false });
  });

  it('keep valid values and drop everything else', () => {
    expect(sanitizeSettings({ textSize: 'huge', density: 'compact', ornaments: false, vibration: true })).toEqual({
      textSize: 'huge',
      density: 'compact',
      ornaments: false,
      vibration: true,
    });
    expect(sanitizeSettings({ textSize: 'giant', density: 3, ornaments: 'no', vibration: 1 })).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('text')).toEqual(DEFAULT_SETTINGS);
  });

  it('offer text sizes that grow, with the browser size as the normal one', () => {
    const scales = TEXT_SIZES.map((s) => TEXT_SCALE[s]);
    expect(scales).toEqual([...scales].sort((a, b) => a - b));
    expect(TEXT_SCALE.normal).toBe(100);
  });

  it('buzzes differently for an ordinary roll, a critical hit and a fumble', () => {
    const plain = vibrationPattern({ crit: false, fumble: false });
    expect(plain).toEqual([25]);
    expect(vibrationPattern({ crit: true, fumble: false }).length).toBeGreaterThan(plain.length);
    expect(vibrationPattern({ crit: false, fumble: true })[0]).toBeGreaterThan(plain[0]!);
  });
});
