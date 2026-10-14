import { useCharacterStore } from '../../data/characterStore';

/** Saved rolls as one-tap buttons; the small cross deletes one. */
export function Presets() {
  const presets = useCharacterStore((s) => s.character.presets);
  const roll = useCharacterStore((s) => s.roll);
  const removePreset = useCharacterStore((s) => s.removePreset);

  return (
    <section className="card stack" aria-labelledby="presets-title">
      <h2 id="presets-title">Tiri salvati</h2>
      {presets.length === 0 ? (
        <p className="muted small">Nessun tiro salvato: componi una formula e premi «Salva come preset».</p>
      ) : (
        <ul className="plain preset-chips">
          {presets.map((p) => (
            <li className="preset-chip" key={p.id}>
              <button type="button" className="roll-preset" onClick={() => roll(p.formula, p.name)}>
                <span className="visually-hidden">Lancia </span>
                {p.name} <code>{p.formula}</code>
              </button>
              <button type="button" className="ghost" aria-label={`Elimina il preset ${p.name}`} title="Elimina" onClick={() => removePreset(p.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
