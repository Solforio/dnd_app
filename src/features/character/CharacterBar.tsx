import { useId, useRef, useState } from 'react';
import { useCharacterStore } from '../../data/characterStore';
import { exportCharacter } from '../../domain/character';

function fileName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${slug || 'personaggio'}.json`;
}

/** Character name plus JSON backup (export and import). */
export function CharacterBar() {
  const character = useCharacterStore((s) => s.character);
  const { rename, importJson } = useCharacterStore.getState();
  const nameId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const download = () => {
    const blob = new Blob([exportCharacter(character)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(character.name);
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Backup scaricato.');
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) {
      setMessage('Il file è troppo grande per essere un personaggio (massimo 2 MB).');
      return;
    }
    setPending(await file.text());
    setMessage('');
  };

  return (
    <div className="row" style={{ flex: 1, justifyContent: 'space-between' }}>
      <div className="field">
        <label htmlFor={nameId} className="visually-hidden">
          Nome del personaggio
        </label>
        <input
          id={nameId}
          className="name-input"
          value={character.name}
          maxLength={80}
          onChange={(e) => rename(e.target.value)}
        />
      </div>

      <div className="row">
        {pending !== null ? (
          <div className="row" role="group" aria-label="Conferma importazione">
            <span className="small">Sostituire «{character.name}» con il personaggio del file?</span>
            <button
              type="button"
              className="primary"
              autoFocus
              onClick={() => {
                const err = importJson(pending);
                setPending(null);
                setMessage(err ?? 'Personaggio importato.');
              }}
            >
              Sì, importa
            </button>
            <button type="button" onClick={() => setPending(null)}>
              Annulla
            </button>
          </div>
        ) : (
          <>
            <button type="button" onClick={download}>
              Esporta
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}>
              Importa
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              aria-label="File del personaggio da importare"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </>
        )}
        <span className="small muted" role="status" aria-live="polite">
          {message}
        </span>
      </div>
    </div>
  );
}
