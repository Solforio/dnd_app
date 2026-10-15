import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCharacterStore } from '../../data/characterStore';
import { parseImport } from '../../domain/backup';
import { exportCharacter, type Character } from '../../domain/character';
import { formatNumber } from '../../domain/format/number';
import { classSummary } from '../../domain/sheet/sheet';
import { CHARACTER_LIMIT } from '../../domain/workspace';
import { downloadBackup } from '../backup/downloadBackup';

function fileName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${slug || 'personaggio'}.json`;
}

function download(c: Character) {
  const blob = new Blob([exportCharacter(c)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(c.name);
  a.click();
  URL.revokeObjectURL(url);
}

/** List of the workspace's characters: pick, create, duplicate, export, import, delete. */
export function CharactersPage() {
  const active = useCharacterStore((s) => s.character);
  const others = useCharacterStore((s) => s.others);
  const { select, createNew, duplicateOf, addImported, remove } = useCharacterStore.getState();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<Character[] | null>(null);
  const [message, setMessage] = useState('');

  // Stable alphabetical order: the active character is marked, not moved.
  const all = [active, ...others].sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const full = all.length >= CHARACTER_LIMIT;
  const replacing = pendingImport && pendingImport.length === 1 ? all.find((c) => c.id === pendingImport[0]!.id) : undefined;
  const replacedCount = pendingImport ? pendingImport.filter((p) => all.some((c) => c.id === p.id)).length : 0;

  const report = (err: string | null, ok: string) => setMessage(err ?? ok);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) {
      setMessage('Il file è troppo grande per essere un personaggio (massimo 2 MB).');
      return;
    }
    try {
      setPendingImport(parseImport(await file.text()).characters);
      setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Importazione non riuscita.');
    }
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    let error: string | null = null;
    for (const c of pendingImport) {
      error = addImported(c);
      if (error) break;
    }
    const last = pendingImport[pendingImport.length - 1];
    report(
      error,
      pendingImport.length === 1 && last
        ? `Importato «${last.name}»: ora è il personaggio attivo.`
        : `Importati ${formatNumber(pendingImport.length)} personaggi.`,
    );
    setPendingImport(null);
  };

  return (
    <main className="app-main single">
      <section className="card stack" aria-labelledby="characters-title">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="characters-title" style={{ margin: 0 }}>
            Personaggi
          </h2>
          <span className="small muted">
            {formatNumber(all.length)} di {formatNumber(CHARACTER_LIMIT)}
          </span>
        </div>

        <ul className="list">
          {all.map((c) => {
            const isActive = c.id === active.id;
            return (
              <li key={c.id} className={`character-item${isActive ? ' active' : ''}`}>
                <div className="character-info">
                  <span className="character-name">{c.name || 'Senza nome'}</span>
                  {isActive && <span className="result-tag crit">attivo</span>}
                  <span className="small muted">
                    {classSummary(c.sheet.classes)} · PF {formatNumber(c.hp.cur)}/{formatNumber(c.hp.max)}
                  </span>
                </div>
                {confirmDelete === c.id ? (
                  <div className="row" role="group" aria-label={`Conferma eliminazione di ${c.name}`}>
                    <span className="small">Eliminare «{c.name}»? Non si può annullare: esporta prima un backup se ti serve.</span>
                    <button
                      type="button"
                      className="danger"
                      autoFocus
                      onClick={() => {
                        remove(c.id);
                        setConfirmDelete(null);
                        setMessage(`Eliminato «${c.name}».`);
                      }}
                    >
                      Sì, elimina
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(null)}>
                      Annulla
                    </button>
                  </div>
                ) : (
                  <div className="row">
                    {isActive ? (
                      <button type="button" className="primary" onClick={() => navigate('/scheda')}>
                        Apri la scheda
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="primary"
                        onClick={() => {
                          select(c.id);
                          setMessage(`Ora usi «${c.name}».`);
                        }}
                      >
                        Usa<span className="visually-hidden"> {c.name}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={full}
                      onClick={() => report(duplicateOf(c.id), `Creata una copia di «${c.name}»: ora è il personaggio attivo.`)}
                    >
                      Duplica<span className="visually-hidden"> {c.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        download(c);
                        setMessage(`Backup di «${c.name}» scaricato.`);
                      }}
                    >
                      Esporta<span className="visually-hidden"> {c.name}</span>
                    </button>
                    <button type="button" className="danger" onClick={() => setConfirmDelete(c.id)}>
                      Elimina<span className="visually-hidden"> {c.name}</span>
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {pendingImport ? (
          <div className="row" role="group" aria-label="Conferma importazione">
            <span className="small">
              {pendingImport.length > 1
                ? `Il file contiene ${formatNumber(pendingImport.length)} personaggi${replacedCount > 0 ? `; ${formatNumber(replacedCount)} di quelli che hai già verranno sostituiti` : ''}. Importarli?`
                : replacing
                  ? `Hai già «${replacing.name}»: sostituirlo con la versione del file «${pendingImport[0]!.name}»?`
                  : `Aggiungere «${pendingImport[0]!.name}» ai tuoi personaggi?`}
            </span>
            <button type="button" className={replacedCount > 0 ? 'danger' : 'primary'} autoFocus onClick={confirmImport}>
              {replacedCount > 0 ? 'Sì, sostituisci' : 'Sì, aggiungi'}
            </button>
            <button type="button" onClick={() => setPendingImport(null)}>
              Annulla
            </button>
          </div>
        ) : (
          <div className="row">
            <button
              type="button"
              className="primary"
              disabled={full}
              onClick={() => {
                if (createNew() === null) navigate('/scheda');
              }}
            >
              Crea personaggio
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}>
              Importa da file
            </button>
            <button
              type="button"
              onClick={() => {
                downloadBackup(all);
                setMessage(`Backup di ${formatNumber(all.length)} personaggi scaricato.`);
              }}
            >
              Esporta backup di tutti
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              aria-label="File del personaggio o del backup da importare"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        )}
        {full && (
          <p className="small muted">Hai raggiunto il massimo di {formatNumber(CHARACTER_LIMIT)} personaggi: eliminane uno per crearne un altro.</p>
        )}

        <p className="small muted status-line" role="status" aria-live="polite">
          {message}
        </p>
      </section>
    </main>
  );
}
