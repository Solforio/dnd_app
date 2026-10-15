import { useState } from 'react';
import { useCharacterStore } from '../../data/characterStore';
import { AbilitiesCard } from './AbilitiesCard';
import { AttacksCard } from './AttacksCard';
import { Link } from 'react-router';
import { FeaturesCard } from './FeaturesCard';
import { FigureCard } from './FigureCard';
import { HitDiceCard } from './HitDiceCard';
import { IdentityCard } from './IdentityCard';
import { RollStrip } from './RollStrip';
import { SkillsCard } from './SkillsCard';
import { TraitsCard } from './TraitsCard';

/**
 * The character sheet. Play mode: every value is a button that rolls through
 * the dice module. Edit mode: the same sections become forms.
 */
export function SheetPage() {
  const [editing, setEditing] = useState(false);
  const status = useCharacterStore((s) => s.hpStatus);
  const { shortRest, longRest } = useCharacterStore.getState();

  return (
    <>
      <RollStrip />
      <main className="app-main sheet">
        <IdentityCard editing={editing} onToggleEdit={() => setEditing((e) => !e)} />
        <div className="column">
          <AbilitiesCard editing={editing} />
          <SkillsCard editing={editing} />
          <FigureCard />
        </div>
        <div className="column">
          {editing ? (
            <AttacksCard editing />
          ) : (
            <section className="card stack">
              <p className="small">
                Attacchi, condizioni e incantesimi pronti sono nella schermata <Link to="/combattimento">Combattimento</Link>. Per
                modificare gli attacchi usa «Modifica la scheda».
              </p>
            </section>
          )}
          <FeaturesCard editing={editing} />
          <TraitsCard editing={editing} />
          <HitDiceCard />
          <section className="card stack" aria-labelledby="rest-title">
            <h2 id="rest-title">Riposi</h2>
            <div className="row">
              <button type="button" onClick={shortRest}>
                Riposo breve
              </button>
              <button type="button" onClick={longRest}>
                Riposo lungo
              </button>
            </div>
            <p className="small muted">
              Il riposo breve recupera le capacità «a riposo breve» e gli slot del Patto del warlock. Il riposo lungo riporta i PF al massimo, recupera tutte le
              capacità e slot incantesimo, restituisce metà dei dadi vita e toglie un livello di indebolimento.
            </p>
            <p className="status-line" role="status" aria-live="polite">
              {status}
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
