import { useEffect, useState } from 'react';
import { useCharacterStore } from '../../data/characterStore';
import type { Preset } from '../../domain/character';

/** Saved rolls as one-tap buttons; the cross deletes one, and a notice for a few seconds offers to take it back. */
export function Presets() {
  const presets = useCharacterStore((s) => s.character.presets);
  const roll = useCharacterStore((s) => s.roll);
  const removePreset = useCharacterStore((s) => s.removePreset);
  const restorePreset = useCharacterStore((s) => s.restorePreset);
  const [removed, setRemoved] = useState<{ preset: Preset; index: number } | null>(null);

  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), 8000);
    return () => clearTimeout(timer);
  }, [removed]);

  const remove = (p: Preset) => {
    setRemoved({ preset: p, index: presets.findIndex((x) => x.id === p.id) });
    removePreset(p.id);
  };

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
              <button type="button" className="ghost" aria-label={`Elimina il preset ${p.name}`} title="Elimina" onClick={() => remove(p)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {removed && (
        <p className="small undo-notice" role="status">
          Eliminato «{removed.preset.name}».{' '}
          <button
            type="button"
            className="ghost"
            onClick={() => {
              restorePreset(removed.preset, removed.index);
              setRemoved(null);
            }}
          >
            Annulla
          </button>
        </p>
      )}
    </section>
  );
}
