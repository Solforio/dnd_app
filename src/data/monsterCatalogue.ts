import { create } from 'zustand';
import { sanitizeMonsterCatalogue, type Monster } from '../domain/bestiary';

/** The SRD monster list (public/srd/monsters.json), fetched the first time the bestiary needs it. */

interface CatalogueState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  monsters: Monster[];
  byId: ReadonlyMap<string, Monster>;
}

export const useMonsterCatalogue = create<CatalogueState>(() => ({ status: 'idle', monsters: [], byId: new Map() }));

export function ensureMonsterCatalogue(retry = false): void {
  const { status } = useMonsterCatalogue.getState();
  if (status === 'loading' || status === 'ready' || (status === 'error' && !retry)) return;
  useMonsterCatalogue.setState({ status: 'loading' });
  fetch(`${import.meta.env.BASE_URL}srd/monsters.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((raw: unknown) => {
      const monsters = sanitizeMonsterCatalogue(raw);
      if (monsters.length === 0) throw new Error('empty');
      useMonsterCatalogue.setState({ status: 'ready', monsters, byId: new Map(monsters.map((m) => [m.id, m])) });
    })
    .catch(() => useMonsterCatalogue.setState({ status: 'error' }));
}
