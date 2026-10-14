/**
 * A map image kept in the user's own account, so it follows them to every device. There is no Cloud
 * Storage (Blaze only): the picture is cut into text chunks that fit a Firestore document and stored
 * under the account, readable by its owner only. Used for the user's own copy of a file; never shared.
 */

export const IMAGE_SYNC = {
  /** Largest picture kept in the account, in bytes (bigger ones are recompressed). */
  maxBytes: 3_000_000,
  /** Characters per chunk: base64 text, well under the 1 MiB of a document. */
  chunkChars: 700_000,
  maxChunks: 8,
  /** Longest side after a recompression, in pixels. */
  maxSide: 3000,
} as const;

export function splitChunks(text: string, size: number = IMAGE_SYNC.chunkChars): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}

export const joinChunks = (chunks: readonly string[]): string => chunks.join('');

/** Number of chunks a text needs, or null when it would not fit in the allowed number. */
export function chunksNeeded(chars: number): number | null {
  const n = Math.max(1, Math.ceil(chars / IMAGE_SYNC.chunkChars));
  return n <= IMAGE_SYNC.maxChunks ? n : null;
}

export interface ImageMeta {
  fingerprint: string;
  width: number;
  height: number;
  fileName: string;
  /** MIME type of the stored picture. */
  type: string;
  chunks: number;
  updatedAt: number;
}

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Reads the description of a synced image; null when it is unusable. */
export function sanitizeImageMeta(fingerprint: string, raw: unknown): ImageMeta | null {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0);
  const chunks = num(r.chunks);
  const type = typeof r.type === 'string' && TYPES.includes(r.type) ? r.type : '';
  if (!type || chunks < 1 || chunks > IMAGE_SYNC.maxChunks || num(r.width) < 1 || num(r.height) < 1) return null;
  return {
    fingerprint,
    width: num(r.width),
    height: num(r.height),
    fileName: typeof r.fileName === 'string' ? r.fileName.slice(0, 120) : '',
    type,
    chunks,
    updatedAt: num(r.updatedAt),
  };
}
