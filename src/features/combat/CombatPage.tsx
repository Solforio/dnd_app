import { useEffect } from 'react';
import { ensureSpellCatalogue } from '../../data/spellCatalogue';
import { AttacksCard } from '../sheet/AttacksCard';
import { ConditionsCard } from '../sheet/ConditionsCard';
import { RollStrip } from '../sheet/RollStrip';
import { CombatHp } from './CombatHp';
import { CombatSpells } from './CombatSpells';
import { EffectsCard } from './EffectsCard';
import { KeyStats } from './KeyStats';
import { SavedRolls } from './SavedRolls';
import { TurnCard } from './TurnCard';

/**
 * Everything needed in a fight on one page, and a summary of the character for it. The attacks and the
 * conditions live here (not on the Scheda page); the stats are read-only mirrors of the sheet.
 */
export function CombatPage() {
  useEffect(() => ensureSpellCatalogue(), []);
  return (
    <main className="app-main sheet">
      <RollStrip />
      <TurnCard />
      <KeyStats />
      <div className="column">
        <CombatHp />
        <ConditionsCard />
        <EffectsCard />
      </div>
      <div className="column">
        <AttacksCard editing={false} />
        <SavedRolls />
        <CombatSpells />
      </div>
    </main>
  );
}
