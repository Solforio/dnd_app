import { asRecord } from './schema/sanitize';

/**
 * Character pictures. There is no Cloud Storage (Blaze only), so the browser
 * shrinks each picture and keeps it as a small `data:` URL in its own
 * document, apart from the character (which is rewritten on every save).
 */

export const PORTRAIT_SCHEMA_VERSION = 1;

export const PORTRAIT_LIMITS = {
  /** Portrait: a square of this many pixels. */
  portraitSide: 256,
  /** Full-body: fits inside a square of this many pixels. */
  bodySide: 768,
  /** Longest accepted data URL, in characters (base64 is a third bigger than the bytes). */
  portraitChars: 60_000,
  bodyChars: 220_000,
} as const;

export interface Portraits {
  portrait: string | null;
  body: string | null;
  updatedAt: number;
}

export const NO_PORTRAITS: Portraits = { portrait: null, body: null, updatedAt: 0 };

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

/** True for a base64 image data URL no longer than `maxChars`. */
export function isImageDataUrl(v: unknown, maxChars: number): v is string {
  return typeof v === 'string' && v.length <= maxChars && DATA_URL.test(v);
}

/** Coerces a stored or received document into safe pictures: anything unusable becomes null. */
export function sanitizePortraits(raw: unknown): Portraits {
  const r = asRecord(raw);
  return {
    portrait: isImageDataUrl(r.portrait, PORTRAIT_LIMITS.portraitChars) ? r.portrait : null,
    body: isImageDataUrl(r.body, PORTRAIT_LIMITS.bodyChars) ? r.body : null,
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? Math.trunc(r.updatedAt) : 0,
  };
}

export const hasAnyPortrait = (p: Portraits) => p.portrait !== null || p.body !== null;

/** The centred square that gets cropped out of a picture for the portrait. */
export function coverSquare(width: number, height: number): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height);
  return { sx: Math.round((width - size) / 2), sy: Math.round((height - size) / 2), size };
}

/** Size of a picture scaled to fit inside `max` pixels on its longest side; never enlarged. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** One or two capital letters for the avatar shown when there is no picture. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? [...words[0]!].slice(0, 2) : [[...words[0]!][0]!, [...words[words.length - 1]!][0]!];
  return letters.join('').toLocaleUpperCase('it');
}
