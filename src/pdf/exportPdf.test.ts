import { describe, expect, it } from 'vitest';
import cinzelInline from '../assets/fonts/Cinzel-Variable.ttf?inline';
import decorativeInline from '../assets/fonts/CinzelDecorative-Bold.ttf?inline';
import spellsJson from '../../public/srd/spells.json?raw';
import { createCharacter } from '../domain/character';
import { sanitizeCatalogue } from '../domain/spells';
import { sampleCharacter } from './testSample';
import { buildPdf, type FontBytes, type PdfInput } from './exportPdf';

function inlineBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(',')[1]!);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

export const testFonts = (): FontBytes => ({ title: inlineBytes(decorativeInline), display: inlineBytes(cinzelInline) });

const catalogue = new Map(sanitizeCatalogue(JSON.parse(spellsJson)).map((sp) => [sp.id, sp]));

const input = (names: string[], spells = catalogue): PdfInput => ({
  characters: names.map((n) => sampleCharacter(n)),
  pictures: new Map(),
  spells,
  exportedAt: new Date('2026-10-14T20:00:00Z'),
});

describe('the character sheet PDF', () => {
  it('is a valid PDF: front page, traits, spells with their text and the backpack', async () => {
    const bytes = await buildPdf(input(['Elowen']), testFonts());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(5);
    expect(doc.getTitle()).toBe('D&D Pocket: schede dei personaggi');
    const page = doc.getPage(0);
    expect(Math.round(page.getWidth())).toBe(595);
    expect(Math.round(page.getHeight())).toBe(842);
  });

  it('adds a cover only when there are several characters', async () => {
    const { PDFDocument } = await import('pdf-lib');
    const one = await PDFDocument.load(await buildPdf(input(['A']), testFonts()));
    const three = await PDFDocument.load(await buildPdf(input(['A', 'B', 'C']), testFonts()));
    expect(three.getPageCount()).toBe(one.getPageCount() * 3 + 1);
  });

  it('leaves out the magic pages for a character who does not cast, and still adds the backpack', async () => {
    const { PDFDocument } = await import('pdf-lib');
    const plain = { ...input([]), characters: [createCharacter('Tizio')] };
    const doc = await PDFDocument.load(await buildPdf(plain, testFonts()));
    expect(doc.getPageCount()).toBe(3);
  });

  it('shows the spells without text when the catalogue could not be loaded', async () => {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(await buildPdf(input(['A'], new Map()), testFonts()));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
  });

  it('embeds a portrait', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const c = sampleCharacter('Con ritratto');
    const withPic: PdfInput = { ...input([]), characters: [c], pictures: new Map([[c.id, { portrait: png, body: null }]]) };
    const plain = await buildPdf({ ...withPic, pictures: new Map() }, testFonts());
    const bytes = await buildPdf(withPic, testFonts());
    expect(bytes.length).toBeGreaterThan(plain.length);
  });

  it('survives characters with characters a font cannot draw', async () => {
    const odd = input(['Ægir ✓ 魔法使い']);
    await expect(buildPdf(odd, testFonts())).resolves.toBeInstanceOf(Uint8Array);
  });
});
