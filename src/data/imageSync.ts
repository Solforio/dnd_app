import { collection, doc, getDoc, getDocs, writeBatch, type Firestore } from 'firebase/firestore';
import { chunksNeeded, IMAGE_SYNC, joinChunks, sanitizeImageMeta, splitChunks, type ImageMeta } from '../domain/imageSync';
import { ImageError, putImage, type StoredImage } from './imageStore';

/** Map images kept in the user's own account: users/{uid}/mapImages/{fingerprint} + .../chunks/{n}. */

const metaRef = (db: Firestore, uid: string, fp: string) => doc(db, 'users', uid, 'mapImages', fp);
const chunksOf = (db: Firestore, uid: string, fp: string) => collection(db, 'users', uid, 'mapImages', fp, 'chunks');

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new ImageError('Non riesco a leggere l’immagine.'));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(text: string, type: string): Blob {
  const bin = atob(text);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** A copy small enough for the account: the picture itself when it already fits, else a recompressed JPEG. */
async function shrinkForAccount(img: StoredImage): Promise<{ blob: Blob; width: number; height: number }> {
  if (img.blob.size <= IMAGE_SYNC.maxBytes && ['image/jpeg', 'image/png', 'image/webp'].includes(img.blob.type)) {
    return { blob: img.blob, width: img.width, height: img.height };
  }
  const bitmap = await createImageBitmap(img.blob);
  try {
    let side = Math.min(IMAGE_SYNC.maxSide, Math.max(bitmap.width, bitmap.height));
    for (let round = 0; round < 4; round++, side = Math.round(side * 0.8)) {
      const k = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * k));
      const height = Math.max(1, Math.round(bitmap.height * k));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new ImageError('Il browser non riesce a ridimensionare l’immagine.');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
      for (const q of [0.85, 0.75, 0.65, 0.55]) {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
        if (blob && blob.size <= IMAGE_SYNC.maxBytes) return { blob, width, height };
      }
    }
    throw new ImageError('Non riesco a ridurre abbastanza questa immagine per il tuo account.');
  } finally {
    bitmap.close();
  }
}

/** The description of the image kept in the account, or null when there is none. One read. */
export async function accountImageMeta(db: Firestore, uid: string, fingerprint: string): Promise<ImageMeta | null> {
  const snap = await getDoc(metaRef(db, uid, fingerprint));
  return snap.exists() ? sanitizeImageMeta(fingerprint, snap.data()) : null;
}

/** Saves the user's copy of an image in the account: one batch with the chunks and its description. */
export async function uploadAccountImage(db: Firestore, uid: string, img: StoredImage): Promise<void> {
  const small = await shrinkForAccount(img);
  const text = await blobToBase64(small.blob);
  if (chunksNeeded(text.length) === null) throw new ImageError('Questa immagine è troppo grande per il tuo account.');
  const chunks = splitChunks(text);
  const batch = writeBatch(db);
  chunks.forEach((data, i) => batch.set(doc(chunksOf(db, uid, img.fingerprint), String(i)), { data }));
  batch.set(metaRef(db, uid, img.fingerprint), {
    schemaVersion: 1,
    width: small.width,
    height: small.height,
    fileName: img.fileName.slice(0, 120),
    type: small.blob.type,
    chunks: chunks.length,
    updatedAt: Date.now(),
  });
  await batch.commit();
}

/** Brings the image of the account to this device (browser storage). Returns false when the account has none. */
export async function downloadAccountImage(db: Firestore, uid: string, fingerprint: string): Promise<boolean> {
  const meta = await accountImageMeta(db, uid, fingerprint);
  if (!meta) return false;
  const snap = await getDocs(chunksOf(db, uid, fingerprint));
  const byIndex = new Map(snap.docs.map((d) => [Number(d.id), String(d.data().data ?? '')]));
  const parts: string[] = [];
  for (let i = 0; i < meta.chunks; i++) {
    const part = byIndex.get(i);
    if (!part) throw new ImageError('L’immagine nel tuo account è incompleta: caricala di nuovo da un dispositivo che ce l’ha.');
    parts.push(part);
  }
  await putImage({
    fingerprint,
    blob: base64ToBlob(joinChunks(parts), meta.type),
    width: meta.width,
    height: meta.height,
    fileName: meta.fileName,
    savedAt: Date.now(),
  });
  return true;
}

/** Takes the image out of the account (the copy on this device stays). */
export async function removeAccountImage(db: Firestore, uid: string, fingerprint: string): Promise<void> {
  const snap = await getDocs(chunksOf(db, uid, fingerprint));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(metaRef(db, uid, fingerprint));
  await batch.commit();
}
