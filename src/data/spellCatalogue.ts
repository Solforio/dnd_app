import { create } from 'zustand';
import { applyItalian, sanitizeCatalogue, type Spell } from '../domain/spells';

/** The SRD spell list (public/srd/spells.json), fetched the first time the grimoire needs it. */

interface CatalogueState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  spells: Spell[];
  byId: ReadonlyMap<string, Spell>;
}

export const useSpellCatalogue = create<CatalogueState>(() => ({ status: 'idle', spells: [], byId: new Map() }));

export function ensureSpellCatalogue(retry = false): void {
  const { status } = useSpellCatalogue.getState();
  if (status === 'loading' || status === 'ready' || (status === 'error' && !retry)) return;
  useSpellCatalogue.setState({ status: 'loading' });
  const load = (file: string): Promise<unknown> =>
    fetch(`${import.meta.env.BASE_URL}srd/${file}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
  // The Italian texts are optional: without them the English SRD is shown.
  Promise.all([load('spells.json'), load('spells.it.json').catch(() => null)])
    .then(([raw, italian]) => {
      const spells = applyItalian(sanitizeCatalogue(raw), italian);
      if (spells.length === 0) throw new Error('empty');
      useSpellCatalogue.setState({ status: 'ready', spells, byId: new Map(spells.map((s) => [s.id, s])) });
    })
    .catch(() => useSpellCatalogue.setState({ status: 'error' }));
}
