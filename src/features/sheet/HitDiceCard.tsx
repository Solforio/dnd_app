import { useCharacterStore } from '../../data/characterStore';
import { FoldCard } from '../../components/FoldCard';
import { formatNumber } from '../../domain/format/number';
import { hitDicePools } from '../../domain/sheet/hitDice';
import { LevelUpSection } from './LevelUp';
import { useSheet } from './sheetHooks';

/** Hit dice (spend to heal, regained on a long rest) and the level-up flow that raises max HP. */
export function HitDiceCard() {
  const s = useSheet();
  const full = useCharacterStore((x) => x.character.hp.cur >= x.character.hp.max);
  const pools = hitDicePools(s);
  const spend = (i: number) => useCharacterStore.getState().spendHitDie(i);

  return (
    <FoldCard id="hitdice" title="Dadi vita e livello" summary={pools.map((p) => `d${p.die} ${p.left}/${p.total}`).join(" · ")} defaultOpen={false}>
      <ul className="plain stack">
        {pools.map((p) => (
          <li key={p.index} className="row" style={{ justifyContent: 'space-between' }}>
            <span>
              {p.name}: d{p.die}, {formatNumber(p.left)}/{formatNumber(p.total)} disponibili
            </span>
            <button
              type="button"
              disabled={p.left <= 0 || full}
              title={full ? 'I PF sono già al massimo' : undefined}
              aria-label={`Spendi un dado vita d${p.die} di ${p.name}`}
              onClick={() => spend(p.index)}
            >
              Spendi d{p.die}
            </button>
          </li>
        ))}
      </ul>
      <p className="small muted">
        Spendere un dado tira il dado più il modificatore di COS e cura quei PF, di solito durante un riposo breve. Il riposo
        lungo restituisce metà dei dadi vita totali (almeno uno).
      </p>
      <LevelUpSection />
    </FoldCard>
  );
}
