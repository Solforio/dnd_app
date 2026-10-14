import type { PDFDocument, PDFImage } from 'pdf-lib';
import type { Character } from '../domain/character';
import type { Spell } from '../domain/spells';
import type { Fonts } from './draw';
import { contentsLine, drawCover, type ContentsEntry } from './cover';
import { drawTraits } from './sheetBack';
import { drawFront, newSheetPage, type Doc, type PdfAssets } from './sheetFront';
import { drawPack } from './sheetPack';
import { drawSpells } from './sheetSpells';

/** The pictures of a character as stored (data URLs), if any. */
export interface PictureData {
  portrait: string | null;
  body: string | null;
}

export interface PdfInput {
  characters: readonly Character[];
  pictures: ReadonlyMap<string, PictureData>;
  spells: ReadonlyMap<string, Spell>;
  /** When the export was made (shown on the cover). */
  exportedAt: Date;
}

export interface FontBytes {
  /** Cinzel Decorative Bold. */
  title: Uint8Array;
  /** Cinzel (variable). */
  display: Uint8Array;
}

function dataUrlBytes(url: string): { bytes: Uint8Array; type: 'jpeg' | 'png' } | null {
  const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(url);
  if (!m) return null;
  const bin = atob(m[2]!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: m[1] as 'jpeg' | 'png' };
}

async function embedPicture(pdf: PDFDocument, url: string | null): Promise<PDFImage | null> {
  const data = url ? dataUrlBytes(url) : null;
  if (!data) return null;
  try {
    return data.type === 'jpeg' ? await pdf.embedJpg(data.bytes) : await pdf.embedPng(data.bytes);
  } catch {
    return null;
  }
}

/** Builds the PDF: a classic character sheet for each character. pdf-lib is loaded here, only when exporting. */
export async function buildPdf(input: PdfInput, fontBytes: FontBytes): Promise<Uint8Array> {
  const [{ PDFDocument, StandardFonts }, fontkit] = await Promise.all([import('pdf-lib'), import('@pdf-lib/fontkit')]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit.default);
  pdf.setTitle('D&D Pocket: schede dei personaggi');
  pdf.setProducer('D&D Pocket');
  pdf.setCreator('D&D Pocket');
  pdf.setCreationDate(input.exportedAt);
  const fonts: Fonts = {
    title: await pdf.embedFont(fontBytes.title, { subset: true }),
    display: await pdf.embedFont(fontBytes.display, { subset: true }),
    body: await pdf.embedFont(StandardFonts.TimesRoman),
    bold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    italic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
  };
  const doc: Doc = { pdf, fonts, pageNo: 1 };

  // With several characters the cover comes first; its list of pages is filled in once they are drawn.
  const cover = input.characters.length > 1 ? newSheetPage(doc) : null;
  const contents: ContentsEntry[] = [];

  for (const c of input.characters) {
    contents.push({ name: c.name || 'Senza nome', summary: contentsLine(c), page: doc.pageNo });
    const pics = input.pictures.get(c.id);
    const assets: PdfAssets = { portrait: await embedPicture(pdf, pics?.portrait ?? null), body: await embedPicture(pdf, pics?.body ?? null) };
    const front = drawFront(doc, c, assets);
    drawTraits(doc, c, assets, front.result);
    drawSpells(doc, c, input.spells);
    drawPack(doc, c);
  }
  if (cover) drawCover(cover, contents, input.exportedAt);
  return pdf.save();
}
