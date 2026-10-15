import { describe, expect, it } from 'vitest';
import { installHint, isIos } from './install';

describe('isIos', () => {
  it('recognises iPhone and iPad, and an iPad that says it is a Mac', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
  });

  it('does not mistake a real Mac or an Android phone for one', () => {
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIos('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe(false);
  });
});

describe('installHint', () => {
  it('shows nothing once installed', () => {
    expect(installHint({ standalone: true, canPrompt: true, ios: true })).toBe('installed');
  });

  it('prefers the install button when the browser offers it', () => {
    expect(installHint({ standalone: false, canPrompt: true, ios: false })).toBe('prompt');
  });

  it('explains «Aggiungi alla schermata Home» on iOS, and says nothing elsewhere', () => {
    expect(installHint({ standalone: false, canPrompt: false, ios: true })).toBe('ios');
    expect(installHint({ standalone: false, canPrompt: false, ios: false })).toBe('none');
  });
});
