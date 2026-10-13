import { useId } from 'react';
import { NumberField } from '../../components/NumberField';
import { TextField } from '../../components/TextField';
import { newId } from '../../domain/character';
import { formatNumber } from '../../domain/format/number';
import { SHEET_LIMITS, type Feature, type Uses } from '../../domain/sheet/sheet';
import { editSheet, replaceById, useSheet } from './sheetHooks';

const RESET_LABEL = { short: 'riposo breve', long: 'riposo lungo' } as const;

function setFeature(id: string, patch: Partial<Feature>) {
  editSheet((x) => ({ ...x, features: replaceById(x.features, id, patch) }));
}

function UsesControl({ feature, uses }: { feature: Feature; uses: Uses }) {
  const change = (delta: number) =>
    setFeature(feature.id, { uses: { ...uses, cur: Math.min(uses.max, Math.max(0, uses.cur + delta)) } });
  return (
    <div className="row uses" role="group" aria-label={`Usi di ${feature.name}`}>
      <button type="button" disabled={uses.cur <= 0} onClick={() => change(-1)}>
        Usa
      </button>
      <span aria-live="polite">
        {formatNumber(uses.cur)}/{formatNumber(uses.max)} <span className="small muted">({RESET_LABEL[uses.reset]})</span>
      </span>
      <button type="button" className="ghost" disabled={uses.cur >= uses.max} aria-label={`Recupera un uso di ${feature.name}`} onClick={() => change(1)}>
        +1
      </button>
    </div>
  );
}

function FeatureEditor({ feature }: { feature: Feature }) {
  const resetId = useId();
  const set = (patch: Partial<Feature>) => setFeature(feature.id, patch);
  const uses = feature.uses;
  return (
    <fieldset className="plain attack-edit">
      <legend className="visually-hidden">{feature.name}</legend>
      <div className="form-grid">
        <TextField label="Nome" value={feature.name} maxLength={80} onChange={(name) => set({ name })} />
        <TextField label="Fonte" value={feature.source} maxLength={60} placeholder="Classe, razza, talento…" onChange={(source) => set({ source })} />
      </div>
      <TextField label="Descrizione" multiline value={feature.text} maxLength={SHEET_LIMITS.featureText} onChange={(text) => set({ text })} />
      <label className="inline">
        <input
          type="checkbox"
          checked={uses !== null}
          onChange={(e) => set({ uses: e.target.checked ? { cur: 1, max: 1, reset: 'long' } : null })}
        />
        Usi limitati
      </label>
      {uses && (
        <div className="row">
          <NumberField
            label="Usi massimi"
            value={uses.max}
            min={1}
            max={SHEET_LIMITS.uses}
            onCommit={(max) => set({ uses: { ...uses, max, cur: Math.min(uses.cur, max) } })}
          />
          <div className="field">
            <label htmlFor={resetId}>Si recuperano con</label>
            <select id={resetId} value={uses.reset} onChange={(e) => set({ uses: { ...uses, reset: e.target.value as Uses['reset'] } })}>
              <option value="short">Riposo breve</option>
              <option value="long">Riposo lungo</option>
            </select>
          </div>
        </div>
      )}
      <div>
        <button type="button" className="danger" onClick={() => editSheet((x) => ({ ...x, features: x.features.filter((f) => f.id !== feature.id) }))}>
          Elimina «{feature.name}»
        </button>
      </div>
    </fieldset>
  );
}

export function FeaturesCard({ editing }: { editing: boolean }) {
  const s = useSheet();

  return (
    <section className="card stack" aria-labelledby="features-title">
      <h2 id="features-title">Capacità e tratti</h2>
      {s.features.length === 0 && !editing && (
        <p className="muted">Nessuna capacità: premi «Modifica la scheda» per aggiungere quelle di classe, razza e talenti.</p>
      )}
      <ul className="list">
        {s.features.map((f) => (
          <li key={f.id} className={editing ? undefined : 'feature'}>
            {editing ? (
              <FeatureEditor feature={f} />
            ) : (
              <>
                <div className="attack-name">
                  <strong>{f.name}</strong>
                  {f.source && <span className="small muted">{f.source}</span>}
                </div>
                {f.uses && <UsesControl feature={f} uses={f.uses} />}
                {f.text && (
                  <details>
                    <summary className="small muted">Descrizione</summary>
                    <p className="pre-wrap small">{f.text}</p>
                  </details>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {editing && s.features.length < SHEET_LIMITS.features && (
        <div>
          <button
            type="button"
            onClick={() =>
              editSheet((x) => ({
                ...x,
                features: [...x.features, { id: newId(), name: 'Nuova capacità', source: '', text: '', uses: null }],
              }))
            }
          >
            Aggiungi una capacità
          </button>
        </div>
      )}
    </section>
  );
}
