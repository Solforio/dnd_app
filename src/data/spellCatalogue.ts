import { create } from 'zustand';
import { sanitizeCatalogue, type Spell } from '../domain/spells';

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
  fetch(`${import.meta.env.BASE_URL}srd/spells.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((raw: unknown) => {
      const spells = sanitizeCatalogue(raw);
      if (spells.length === 0) throw new Error('empty');
      useSpellCatalogue.setState({ status: 'ready', spells, byId: new Map(spells.map((s) => [s.id, s])) });
    })
    .catch(() => useSpellCatalogue.setState({ status: 'error' }));
}
