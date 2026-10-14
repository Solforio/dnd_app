import { useId, useState } from 'react';
import { ImageError } from '../../data/imageStore';
import { pictureToDataUrl, type PictureKind } from '../../data/portraitImage';
import { setPicture, usePortraitStore } from '../../data/portraitStore';

/** Upload and remove buttons for one picture of a character; shows its own errors. */
export function PictureControls({ characterId, kind, hasPicture }: { characterId: string; kind: PictureKind; hasPicture: boolean }) {
  const inputId = useId();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saveError = usePortraitStore((s) => s.error);
  const noun = kind === 'portrait' ? 'ritratto' : 'immagine a figura intera';

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      await setPicture(characterId, kind, await pictureToDataUrl(file, kind));
    } catch (e) {
      setError(e instanceof ImageError ? e.message : 'Non riesco a usare questa immagine.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-tight">
      <div className="row">
        <label htmlFor={inputId} className={`button-like${busy ? ' disabled' : ''}`}>
          {busy ? 'Elaboro…' : hasPicture ? `Cambia ${noun}` : `Carica ${noun}`}
        </label>
        <input
          id={inputId}
          className="visually-hidden"
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {hasPicture && (
          <button type="button" className="ghost" onClick={() => void setPicture(characterId, kind, null)}>
            Togli
          </button>
        )}
      </div>
      {(error || saveError) && (
        <p className="small red" role="alert">
          {error || saveError}
        </p>
      )}
    </div>
  );
}
