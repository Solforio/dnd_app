import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router';
import { TabNav } from './components/TabNav';
import { useCharacterStore } from './data/characterStore';
import { useSession } from './data/session';
import { AccountBar } from './features/account/AccountBar';
import { SignInPage } from './features/account/SignInPage';
import { UploadDialog } from './features/account/UploadDialog';
import { CharacterBar } from './features/character/CharacterBar';
import { CharactersPage } from './features/character/CharactersPage';
import { SpellDialog, SpellNotice } from './features/grimoire/SpellDialog';
import { CombatPage } from './features/combat/CombatPage';
import { GrimoirePage } from './features/grimoire/GrimoirePage';
import { D20Result } from './features/dice/D20Result';
import { DiceTray } from './features/dice/DiceTray';
import { FormulaRoller } from './features/dice/FormulaRoller';
import { History } from './features/dice/History';
import { ModeSelector } from './features/dice/ModeSelector';
import { Presets } from './features/dice/Presets';
import { DieIcon } from './features/dice/DieIcon';
import { HpManage } from './features/hp/HpPanel';
import { VitalStrip } from './features/vitals/VitalStrip';
import { InventoryPage } from './features/inventory/InventoryPage';
import { MapPage } from './features/maps/MapPage';
import { MapsPage } from './features/maps/MapsPage';
import { PartiesPage } from './features/party/PartiesPage';
import { PartyPage } from './features/party/PartyPage';
import { SheetPage } from './features/sheet/SheetPage';

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
        <HpManage />
        <History />
      </div>
    </main>
  );
}

/** Tabs, the upload offer after login, then the page. */
function WithTabs({ children }: { children: ReactNode }) {
  const phase = useSession((s) => s.phase);
  return (
    <>
      <TabNav />
      <VitalStrip />
      {phase === 'cloud' && (
        <div className="app-notice">
          <UploadDialog />
        </div>
      )}
      {children}
    </>
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
        <h1>
          <DieIcon sides={20} size={30} className="brand-die" />
          Compagno D&amp;D
        </h1>
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
          <Route path="/accedi" element={<SignInPage />} />
          <Route path="/scheda" element={<WithTabs><SheetPage /></WithTabs>} />
          <Route path="/combattimento" element={<WithTabs><CombatPage /></WithTabs>} />
          <Route path="/grimorio" element={<WithTabs><GrimoirePage /></WithTabs>} />
          <Route path="/zaino" element={<WithTabs><InventoryPage /></WithTabs>} />
          <Route path="/personaggi" element={<WithTabs><CharactersPage /></WithTabs>} />
          <Route path="/mappe" element={<WithTabs><MapsPage /></WithTabs>} />
          <Route path="/mappe/io/:mapId" element={<WithTabs><MapPage scope="personal" /></WithTabs>} />
          <Route path="/mappe/gruppo/:partyId/:mapId" element={<WithTabs><MapPage scope="party" /></WithTabs>} />
          <Route path="/gruppo" element={<WithTabs><PartiesPage /></WithTabs>} />
          <Route path="/gruppo/:partyId" element={<WithTabs><PartyPage /></WithTabs>} />
          <Route path="*" element={<WithTabs><Home /></WithTabs>} />
        </Routes>
      ) : (
        <main className="app-main">
          <p className="muted" role="status">
            Carico i tuoi personaggi…
          </p>
        </main>
      )}
      <SpellDialog />
      <SpellNotice />
      <footer className="app-footer small muted">
        {phase === 'cloud'
          ? 'I dati sono salvati sul tuo account e su questo dispositivo.'
          : 'I dati restano su questo dispositivo. Usa «Esporta» nella pagina Personaggi per un backup, o accedi per salvarli sull’account.'}
      </footer>
    </>
  );
}
