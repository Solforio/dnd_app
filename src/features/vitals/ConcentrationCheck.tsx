import { useCharacterStore } from '../../data/characterStore';
import { formatNumber } from '../../domain/format/number';
import { d20Formula, saveBonus } from '../../domain/sheet/sheet';
import { rollFrom, useSheet } from '../sheet/sheetHooks';

/** After damage while concentrating: the Constitution save to keep the spell, until the player answers it. */
export function ConcentrationCheck() {
  const check = useCharacterStore((s) => s.concentrationCheck);
  const sheet = useSheet();
  const { resolveConcentration } = useCharacterStore.getState();
  if (!check) return null;

  return (
    <div className="concentration-check stack" role="alert">
      <p>
        <strong>Concentrazione su {check.spell}.</strong> Tiro salvezza su Costituzione, CD {formatNumber(check.dc)}.
      </p>
      <div className="row">
        <button type="button" onClick={() => rollFrom(d20Formula(saveBonus(sheet, 'con')), `Concentrazione, CD ${check.dc}`)}>
          Tira Costituzione
        </button>
        <button type="button" onClick={() => resolveConcentration(false)}>
          Ho mantenuto
        </button>
        <button type="button" className="danger" onClick={() => resolveConcentration(true)}>
          Perdo la concentrazione
        </button>
      </div>
    </div>
  );
}
