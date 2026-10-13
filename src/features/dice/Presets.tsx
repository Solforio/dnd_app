import { useCharacterStore } from '../../data/characterStore';

export function Presets() {
  const presets = useCharacterStore((s) => s.character.presets);
  const roll = useCharacterStore((s) => s.roll);
  const removePreset = useCharacterStore((s) => s.removePreset);

  return (
    <section className="card" aria-labelledby="presets-title">
      <h2 id="presets-title">Preset</h2>
      {presets.length === 0 ? (
        <p className="muted">Nessun preset: componi una formula e premi «Salva come preset».</p>
      ) : (
        <ul className="list">
          {presets.map((p) => (
            <li className="preset" key={p.id}>
              <button type="button" className="roll-preset" onClick={() => roll(p.formula, p.name)}>
                <span>
                  <span className="visually-hidden">Lancia </span>
                  {p.name}
                </span>
                <code>{p.formula}</code>
              </button>
              <button
                type="button"
                className="ghost"
                aria-label={`Elimina il preset ${p.name}`}
                title="Elimina"
                onClick={() => removePreset(p.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
