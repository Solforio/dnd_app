import { useEffect, useId, useMemo, useState } from 'react';
import { ensureMonsterCatalogue, useMonsterCatalogue } from '../../data/monsterCatalogue';
import { useMonsterDialog } from '../../data/monsterDialog';
import { AddToParty } from './AddToParty';
import {
  CR_STEPS,
  filterMonsters,
  formatCr,
  NO_FILTER,
  SIZE_LABELS,
  SIZES,
  TYPE_LABELS,
  typeLabel,
  type MonsterFilter,
} from '../../domain/bestiary';
import { formatNumber } from '../../domain/format/number';


const PAGE = 40;

/** The catalogue of every SRD monster: search, filters and the full stat block of each. */
export function BestiaryPage() {
  const { monsters, status } = useMonsterCatalogue();
  const open = useMonsterDialog((s) => s.open);
  const [filter, setFilter] = useState<MonsterFilter>(NO_FILTER);
  const [shown, setShown] = useState(PAGE);
  const ids = { q: useId(), type: useId(), size: useId(), min: useId(), max: useId() };

  useEffect(() => ensureMonsterCatalogue(), []);

  const matches = useMemo(() => filterMonsters(monsters, filter), [monsters, filter]);
  const set = (patch: Partial<MonsterFilter>) => {
    setFilter((f) => ({ ...f, ...patch }));
    setShown(PAGE);
  };

  return (
    <main className="app-main single">
      <section className="card stack" aria-labelledby="bestiary-title">
        <h2 id="bestiary-title">Bestiario</h2>
        <p className="small muted">
          Tutti i mostri del System Reference Document 5.1: sono {monsters.length > 0 ? formatNumber(monsters.length) : 'oltre trecento'}, in
          inglese. Il bestiario che il gruppo compila durante la campagna è nella pagina del gruppo.
        </p>

        <div className="row filters">
          <div className="field grow">
            <label htmlFor={ids.q}>Cerca per nome</label>
            <input id={ids.q} type="search" value={filter.query} onChange={(e) => set({ query: e.target.value })} placeholder="Goblin" />
          </div>
          <div className="field">
            <label htmlFor={ids.type}>Tipo</label>
            <select id={ids.type} value={filter.type} onChange={(e) => set({ type: e.target.value })}>
              <option value="">Tutti</option>
              {Object.entries(TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={ids.size}>Taglia</label>
            <select id={ids.size} value={filter.size} onChange={(e) => set({ size: e.target.value })}>
              <option value="">Tutte</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {SIZE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={ids.min}>GS da</label>
            <select id={ids.min} value={filter.crMin} onChange={(e) => set({ crMin: Number(e.target.value), crMax: Math.max(Number(e.target.value), filter.crMax) })}>
              {CR_STEPS.map((c) => (
                <option key={c} value={c}>
                  {formatCr(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={ids.max}>a</label>
            <select id={ids.max} value={filter.crMax} onChange={(e) => set({ crMax: Number(e.target.value), crMin: Math.min(Number(e.target.value), filter.crMin) })}>
              {CR_STEPS.map((c) => (
                <option key={c} value={c}>
                  {formatCr(c)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {status === 'loading' && <p className="muted">Carico l’elenco dei mostri…</p>}
        {status === 'error' && (
          <p className="red" role="alert">
            Non riesco a caricare l’elenco dei mostri: controlla la connessione e riapri la pagina.
          </p>
        )}
        {status === 'ready' && (
          <p className="small muted" role="status" aria-live="polite">
            {matches.length === 0 ? 'Nessun mostro trovato.' : `${formatNumber(matches.length)} mostri`}
          </p>
        )}

        <ul className="plain monster-list">
          {matches.slice(0, shown).map((m) => (
            <li key={m.id}>
              <button type="button" className="monster-row" onClick={() => open(m, <AddToParty monster={m} />)}>
                <span className="monster-name">{m.name}</span>
                <span className="small muted">
                  GS {formatCr(m.cr)} · {typeLabel(m.type)} · {SIZE_LABELS[m.size] ?? m.size}
                </span>
                <span className="small monster-stats">
                  CA {m.ac} · PF {formatNumber(m.hp)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {matches.length > shown && (
          <div>
            <button type="button" onClick={() => setShown((n) => n + PAGE)}>
              Mostra altri ({formatNumber(matches.length - shown)})
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
