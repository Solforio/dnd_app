import { useId, useState, type FormEvent } from 'react';
import { useCharacterStore } from '../../data/characterStore';
import { firstRunDone, markFirstRunDone } from '../../data/firstRun';
import { FIRST_RUN_CLASSES, sheetFromFirstRun, startingHp } from '../../domain/firstRun';
import { isUntouchedDefault } from '../../domain/sync';
import { ABILITIES, ABILITY_LABELS, LEVEL_MAX } from '../../domain/sheet/rules';
import { SHEET_LIMITS } from '../../domain/sheet/sheet';

/** On a brand-new device: a short form (name, class, level, scores) instead of an empty sheet. */
export function FirstRunCard() {
  const character = useCharacterStore((s) => s.character);
  const others = useCharacterStore((s) => s.others.length);
  const [done, setDone] = useState(firstRunDone);
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [level, setLevel] = useState('1');
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(ABILITIES.map((a) => [a, '10'])));
  const ids = { name: useId(), cls: useId(), level: useId(), list: useId() };

  if (done || others > 0 || !isUntouchedDefault(character)) return null;

  const finish = () => {
    markFirstRunDone();
    setDone(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const abilities = Object.fromEntries(ABILITIES.map((a) => [a, Number(scores[a])])) as Record<(typeof ABILITIES)[number], number>;
    const input = { className, level: Number(level), abilities };
    const sheet = sheetFromFirstRun(input, character.sheet);
    const { rename, editSheet, editHp } = useCharacterStore.getState();
    if (name.trim()) rename(name.trim());
    editSheet(() => sheet);
    const lvl = sheet.classes.reduce((sum, c) => sum + c.level, 0);
    const max = startingHp(sheet.classes[0]?.name ?? '', lvl, sheet.abilities.con);
    editHp({ max, cur: max });
    finish();
  };

  return (
    <section className="card stack span-all first-run" aria-labelledby="first-run-title">
      <h2 id="first-run-title">Crea il tuo personaggio</h2>
      <p className="small muted">Quattro dati e sei pronto a tirare. Il resto lo completi dalla scheda quando vuoi.</p>
      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor={ids.name}>Nome</label>
            <input id={ids.name} value={name} maxLength={80} placeholder="Come si chiama?" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={ids.cls}>Classe</label>
            <input id={ids.cls} list={ids.list} value={className} maxLength={40} placeholder="Per esempio Mago" onChange={(e) => setClassName(e.target.value)} />
            <datalist id={ids.list}>
              {FIRST_RUN_CLASSES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor={ids.level}>Livello</label>
            <input id={ids.level} type="number" inputMode="numeric" min={1} max={LEVEL_MAX} value={level} onChange={(e) => setLevel(e.target.value)} />
          </div>
        </div>
        <fieldset className="plain stack">
          <legend className="label">Caratteristiche</legend>
          <div className="first-run-scores">
            {ABILITIES.map((a) => (
              <div className="field" key={a}>
                <label htmlFor={`${ids.name}-${a}`}>{ABILITY_LABELS[a].short}</label>
                <input
                  id={`${ids.name}-${a}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={SHEET_LIMITS.score}
                  value={scores[a]}
                  onChange={(e) => setScores((s) => ({ ...s, [a]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </fieldset>
        <div className="row">
          <button type="submit" className="primary">
            Crea il tuo personaggio
          </button>
          <button type="button" className="ghost" onClick={finish}>
            Più tardi
          </button>
        </div>
        <p className="small muted">I punti ferita partono dalla regola dell’SRD (dado vita + Costituzione); puoi correggerli quando vuoi.</p>
      </form>
    </section>
  );
}
