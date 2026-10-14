import { coverSquare, fitWithin, PORTRAIT_LIMITS } from '../domain/portrait';
import { ImageError } from './imageStore';

export type PictureKind = 'portrait' | 'body';

const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];

/**
 * Turns a file chosen by the user into a small JPEG data URL: a centred
 * square for the portrait, a picture fitting 768 px for the full-body. The
 * quality, then the size, drop until it fits the limit.
 */
export async function pictureToDataUrl(file: File, kind: PictureKind): Promise<string> {
  if (!file.type.startsWith('image/')) throw new ImageError(`«${file.name}» non è un’immagine.`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError(`Non riesco a leggere «${file.name}».`);
  }
  try {
    const maxChars = kind === 'portrait' ? PORTRAIT_LIMITS.portraitChars : PORTRAIT_LIMITS.bodyChars;
    let side: number = kind === 'portrait' ? PORTRAIT_LIMITS.portraitSide : PORTRAIT_LIMITS.bodySide;
    for (let shrink = 0; shrink < 4; shrink++, side = Math.round(side * 0.8)) {
      const crop = kind === 'portrait' ? coverSquare(bitmap.width, bitmap.height) : { sx: 0, sy: 0, size: 0 };
      const size =
        kind === 'portrait'
          ? { width: side, height: side }
          : fitWithin(bitmap.width, bitmap.height, side);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new ImageError('Il browser non riesce a ridimensionare l’immagine.');
      // JPEG has no transparency: paint white first.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.imageSmoothingQuality = 'high';
      if (kind === 'portrait') ctx.drawImage(bitmap, crop.sx, crop.sy, crop.size, crop.size, 0, 0, size.width, size.height);
      else ctx.drawImage(bitmap, 0, 0, size.width, size.height);
      for (const q of QUALITIES) {
        const url = canvas.toDataURL('image/jpeg', q);
        if (url.length <= maxChars) return url;
      }
    }
    throw new ImageError('Non riesco a ridurre abbastanza questa immagine: provane una più semplice.');
  } finally {
    bitmap.close();
  }
}
