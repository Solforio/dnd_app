import { Route, Routes } from 'react-router';
import { useCharacterStore } from './data/characterStore';
import { useSession } from './data/session';
import { AccountBar } from './features/account/AccountBar';
import { SignInPage } from './features/account/SignInPage';
import { UploadDialog } from './features/account/UploadDialog';
import { CharacterBar } from './features/character/CharacterBar';
import { D20Result } from './features/dice/D20Result';
import { DiceTray } from './features/dice/DiceTray';
import { FormulaRoller } from './features/dice/FormulaRoller';
import { History } from './features/dice/History';
import { ModeSelector } from './features/dice/ModeSelector';
import { Presets } from './features/dice/Presets';
import { HpPanel } from './features/hp/HpPanel';

function Home() {
  const lastRoll = useCharacterStore((s) => s.character.history[0]);
  const rollMode = useCharacterStore((s) => s.character.rollMode);
  const setRollMode = useCharacterStore((s) => s.setRollMode);

  return (
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
  );
}

export function App() {
  const phase = useSession((s) => s.phase);
  const warning = useSession((s) => s.warning);
  const writeError = useSession((s) => s.writeError);
  const ready = phase === 'local' || phase === 'cloud';

  return (
    <>
      <header className="app-header">
        <h1>Compagno D&amp;D</h1>
        {ready && <CharacterBar />}
        <AccountBar />
      </header>
      {[warning, writeError].filter(Boolean).map((text) => (
        <p key={text} className="warning" role="alert">
          {text}
        </p>
      ))}
      {ready ? (
        <Routes>
          <Route
            path="/"
            element={
              <>
                {phase === 'cloud' && (
                  <div className="app-notice">
                    <UploadDialog />
                  </div>
                )}
                <Home />
              </>
            }
          />
          <Route path="/accedi" element={<SignInPage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      ) : (
        <main className="app-main">
          <p className="muted" role="status">
            Carico i tuoi personaggi…
          </p>
        </main>
      )}
      <footer className="app-footer small muted">
        {phase === 'cloud'
          ? 'I dati sono salvati sul tuo account e su questo dispositivo.'
          : 'I dati restano su questo dispositivo. Usa «Esporta» per un backup, o accedi per salvarli sull’account.'}
      </footer>
    </>
  );
}
