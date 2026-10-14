import { Link } from 'react-router';
import { useCharacterStore } from '../../data/characterStore';

/** The saved rolls (presets) as one-tap buttons. They are created and deleted on the Tiri page. */
export function SavedRolls() {
  const presets = useCharacterStore((s) => s.character.presets);
  const roll = useCharacterStore((s) => s.roll);

  return (
    <section className="card stack" aria-labelledby="saved-rolls-title">
      <h2 id="saved-rolls-title">Tiri salvati</h2>
      {presets.length === 0 ? (
        <p className="small muted">
          Nessun tiro salvato: componi una formula nella pagina <Link to="/">Tiri</Link> e premi «Salva come preset».
        </p>
      ) : (
        <div className="chips">
          {presets.map((p) => (
            <button key={p.id} type="button" className="chip" onClick={() => roll(p.formula, p.name)}>
              {p.name} <code>{p.formula}</code>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
