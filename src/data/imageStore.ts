import { downscaleTarget } from '../domain/maps';

/**
 * Map images live only in this browser (IndexedDB), keyed by the fingerprint
 * of the original file: the same image used by a personal and a party map is
 * stored once, and a party map finds it again by itself.
 */

const DB_NAME = 'dnd-companion-images';
const STORE = 'images';

export interface StoredImage {
  fingerprint: string;
  blob: Blob;
  /** Size of the stored (possibly downscaled) image. */
  width: number;
  height: number;
  fileName: string;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'fingerprint' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('IndexedDB non disponibile'));
    };
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
      }),
  );
}

export async function getImage(fingerprint: string): Promise<StoredImage | null> {
  if (!fingerprint) return null;
  try {
    return ((await run('readonly', (s) => s.get(fingerprint))) as StoredImage | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function putImage(img: StoredImage): Promise<void> {
  await run('readwrite', (s) => s.put(img));
}

/** How many map images this browser holds and how much room they take. */
export async function imageUsage(): Promise<{ count: number; bytes: number }> {
  try {
    const all = (await run('readonly', (s) => s.getAll())) as StoredImage[];
    return { count: all.length, bytes: all.reduce((n, i) => n + (i.blob?.size ?? 0), 0) };
  } catch {
    return { count: 0, bytes: 0 };
  }
}

/** Removes every map image from this browser (the copies kept in an account stay there). */
export async function clearImages(): Promise<void> {
  await run('readwrite', (s) => s.clear());
}

export async function deleteImage(fingerprint: string): Promise<void> {
  await run('readwrite', (s) => s.delete(fingerprint));
}

/** SHA-256 of the file bytes, first 32 hex characters. */
export async function fingerprintOf(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

export class ImageError extends Error {}

/**
 * Reads a file chosen by the user: fingerprint of the original, then a
 * downscaled copy if it is too big for phones. Returns what to store.
 */
export async function prepareImage(file: File): Promise<StoredImage> {
  if (!file.type.startsWith('image/')) throw new ImageError(`«${file.name}» non è un’immagine.`);
  const fingerprint = await fingerprintOf(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError(`Non riesco a leggere «${file.name}»: forse è troppo grande per questo dispositivo. Provala da un computer.`);
  }
  const target = downscaleTarget(bitmap.width, bitmap.height);
  let blob: Blob = file;
  let { width, height } = bitmap;
  if (target) {
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError('Il browser non riesce a ridimensionare l’immagine.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageError('Ridimensionamento non riuscito.'))), 'image/jpeg', 0.9),
    );
    ({ width, height } = target);
  }
  bitmap.close();
  return { fingerprint, blob, width, height, fileName: file.name, savedAt: Date.now() };
}
