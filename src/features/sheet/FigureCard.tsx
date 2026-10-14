import { useEffect } from 'react';
import { FoldCard } from '../../components/FoldCard';
import { useCharacterStore } from '../../data/characterStore';
import { ensurePortraits, usePortraitStore } from '../../data/portraitStore';
import { PictureControls } from '../portrait/PictureControls';

/** The full-body picture of the character. It stays on the sheet: it is never shared with the party. */
export function FigureCard() {
  const id = useCharacterStore((s) => s.character.id);
  const name = useCharacterStore((s) => s.character.name);
  const body = usePortraitStore((s) => s.byId[id]?.body ?? null);
  useEffect(() => {
    void ensurePortraits(id);
  }, [id]);

  return (
    <FoldCard id="figure" title="Aspetto" summary="Immagine a figura intera" defaultOpen={false}>
      {body && <img className="figure" src={body} alt={`Immagine a figura intera di ${name || 'questo personaggio'}`} />}
      <PictureControls characterId={id} kind="body" hasPicture={body !== null} />
      <p className="small muted">Resta sulla tua scheda: non viene mai mostrata al gruppo.</p>
    </FoldCard>
  );
}
