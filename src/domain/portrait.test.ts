import { describe, expect, it } from 'vitest';
import { coverSquare, fitWithin, hasAnyPortrait, initials, isImageDataUrl, NO_PORTRAITS, PORTRAIT_LIMITS, sanitizePortraits } from './portrait';

const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

describe('image data URLs', () => {
  it('accepts small base64 jpeg, png and webp only', () => {
    expect(isImageDataUrl(tiny, 100)).toBe(true);
    expect(isImageDataUrl('data:image/png;base64,iVBORw0KGgo=', 100)).toBe(true);
    expect(isImageDataUrl('data:image/webp;base64,UklGRg==', 100)).toBe(true);
    expect(isImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=', 100)).toBe(false);
    expect(isImageDataUrl('data:text/html;base64,PGI+', 100)).toBe(false);
    expect(isImageDataUrl('https://example.com/a.jpg', 100)).toBe(false);
    expect(isImageDataUrl('data:image/jpeg;base64,<script>', 100)).toBe(false);
    expect(isImageDataUrl(42, 100)).toBe(false);
  });

  it('refuses a URL longer than the limit', () => {
    expect(isImageDataUrl(tiny, tiny.length)).toBe(true);
    expect(isImageDataUrl(tiny, tiny.length - 1)).toBe(false);
  });
});

describe('sanitizePortraits', () => {
  it('keeps valid pictures and nulls everything else', () => {
    expect(sanitizePortraits({ portrait: tiny, body: 'nope', updatedAt: 5 })).toEqual({ portrait: tiny, body: null, updatedAt: 5 });
    expect(sanitizePortraits(null)).toEqual(NO_PORTRAITS);
    expect(sanitizePortraits({ portrait: 'x'.repeat(PORTRAIT_LIMITS.portraitChars + 1) }).portrait).toBeNull();
  });

  it('knows when there is any picture', () => {
    expect(hasAnyPortrait(NO_PORTRAITS)).toBe(false);
    expect(hasAnyPortrait({ ...NO_PORTRAITS, body: tiny })).toBe(true);
  });
});

describe('picture geometry', () => {
  it('crops the centred square', () => {
    expect(coverSquare(400, 200)).toEqual({ sx: 100, sy: 0, size: 200 });
    expect(coverSquare(300, 900)).toEqual({ sx: 0, sy: 300, size: 300 });
  });

  it('fits inside the limit without enlarging', () => {
    expect(fitWithin(1536, 1024, 768)).toEqual({ width: 768, height: 512 });
    expect(fitWithin(300, 200, 768)).toEqual({ width: 300, height: 200 });
  });

  it('makes initials', () => {
    expect(initials('Thorin Scudodiquercia')).toBe('TS');
    expect(initials('  elminster ')).toBe('EL');
    expect(initials('')).toBe('?');
  });
});
