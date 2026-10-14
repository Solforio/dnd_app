import { ensurePortraits, usePortraitStore } from '../data/portraitStore';
import { ensureSpellCatalogue, useSpellCatalogue } from '../data/spellCatalogue';
import { useCharacterStore } from '../data/characterStore';
import type { Character } from '../domain/character';
import cinzelUrl from '../assets/fonts/Cinzel-Variable.ttf?url';
import decorativeUrl from '../assets/fonts/CinzelDecorative-Bold.ttf?url';
import type { PictureData } from './exportPdf';

async function bytesOf(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`font ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function spellsReady() {
  ensureSpellCatalogue(true);
  for (let i = 0; i < 100 && useSpellCatalogue.getState().status === 'loading'; i++) await new Promise((r) => setTimeout(r, 50));
  // Without the catalogue (offline, never loaded) the sheet is still exported, with the spell names missing.
  return useSpellCatalogue.getState().byId;
}

export const exportFileName = (when = new Date()): string => `dnd-pocket-schede-${when.toISOString().slice(0, 10)}.pdf`;

/** Every character of this workspace as one PDF, downloaded by the browser. Returns how many characters it holds. */
export async function exportAllPdf(): Promise<number> {
  const { character, others } = useCharacterStore.getState();
  const characters: Character[] = [character, ...others];
  await Promise.all(characters.map((c) => ensurePortraits(c.id)));
  const pictures = new Map<string, PictureData>();
  for (const c of characters) {
    const p = usePortraitStore.getState().byId[c.id];
    if (p) pictures.set(c.id, { portrait: p.portrait, body: p.body });
  }
  const [{ buildPdf }, title, display, spells] = await Promise.all([import('./exportPdf'), bytesOf(decorativeUrl), bytesOf(cinzelUrl), spellsReady()]);
  const bytes = await buildPdf({ characters, pictures, spells, exportedAt: new Date() }, { title, display });
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return characters.length;
}
