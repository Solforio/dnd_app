import { useCharacterStore } from './data/characterStore';
import { CharacterBar } from './features/character/CharacterBar';
import { D20Result } from './features/dice/D20Result';
import { DiceTray } from './features/dice/DiceTray';
import { FormulaRoller } from './features/dice/FormulaRoller';
import { History } from './features/dice/History';
import { ModeSelector } from './features/dice/ModeSelector';
import { Presets } from './features/dice/Presets';
import { HpPanel } from './features/hp/HpPanel';

export function App() {
  const lastRoll = useCharacterStore((s) => s.character.history[0]);
  const rollMode = useCharacterStore((s) => s.character.rollMode);
  const setRollMode = useCharacterStore((s) => s.setRollMode);
  const warning = useCharacterStore((s) => s.storageWarning);

  return (
    <>
      <header className="app-header">
        <h1>Compagno D&amp;D</h1>
        <CharacterBar />
      </header>
      {warning && (
        <p className="warning" role="alert">
          {warning}
        </p>
      )}
      <main className="app-main">
        <div className="column">
          <section className="card stack" aria-label="Risultato">
            <D20Result roll={lastRoll} />
            <ModeSelector value={rollMode} onChange={setRollMode} />
          </section>
          <DiceTray />
          <FormulaRoller />
          <Presets />
        </div>
        <div className="column">
          <HpPanel />
          <History />
        </div>
      </main>
      <footer className="app-footer small muted">
        I dati restano su questo dispositivo. Usa «Esporta» per un backup.
      </footer>
    </>
  );
}
