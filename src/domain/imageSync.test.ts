import { describe, expect, it } from 'vitest';
import { chunksNeeded, IMAGE_SYNC, joinChunks, sanitizeImageMeta, splitChunks } from './imageSync';

describe('chunks', () => {
  it('cuts a text into pieces that join back to the same text', () => {
    const text = 'abcdefghij'.repeat(25);
    const chunks = splitChunks(text, 100);
    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50]);
    expect(joinChunks(chunks)).toBe(text);
    expect(splitChunks('', 100)).toEqual([]);
  });

  it('counts how many chunks a picture needs and refuses what does not fit', () => {
    expect(chunksNeeded(10)).toBe(1);
    expect(chunksNeeded(IMAGE_SYNC.chunkChars)).toBe(1);
    expect(chunksNeeded(IMAGE_SYNC.chunkChars + 1)).toBe(2);
    // 3 MB of picture is 4 million characters of base64: six chunks.
    expect(chunksNeeded(Math.ceil((IMAGE_SYNC.maxBytes * 4) / 3))).toBe(6);
    expect(chunksNeeded(IMAGE_SYNC.chunkChars * IMAGE_SYNC.maxChunks + 1)).toBeNull();
  });
});

describe('image description', () => {
  const ok = { width: 4317, height: 3030, fileName: 'faerun.jpg', type: 'image/jpeg', chunks: 4, updatedAt: 5 };

  it('keeps a valid one', () => {
    expect(sanitizeImageMeta('a'.repeat(32), ok)).toEqual({ fingerprint: 'a'.repeat(32), ...ok });
  });

  it('refuses what cannot be rebuilt', () => {
    const fp = 'a'.repeat(32);
    expect(sanitizeImageMeta(fp, { ...ok, type: 'image/svg+xml' })).toBeNull();
    expect(sanitizeImageMeta(fp, { ...ok, chunks: 0 })).toBeNull();
    expect(sanitizeImageMeta(fp, { ...ok, chunks: IMAGE_SYNC.maxChunks + 1 })).toBeNull();
    expect(sanitizeImageMeta(fp, { ...ok, width: 0 })).toBeNull();
    expect(sanitizeImageMeta(fp, null)).toBeNull();
  });
});
