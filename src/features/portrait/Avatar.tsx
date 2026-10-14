import { useEffect } from 'react';
import { ensurePortraits, usePortraitStore } from '../../data/portraitStore';
import { initials } from '../../domain/portrait';

/** A round picture, or the initials of the name when there is none. Decorative: the name is always written next to it. */
export function Avatar({ src, name, size = 40 }: { src: string | null | undefined; name: string; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  return src ? (
    <img className="avatar" src={src} alt="" style={style} />
  ) : (
    <span className="avatar fallback" aria-hidden="true" style={style}>
      {initials(name)}
    </span>
  );
}

/** The portrait of one of my characters, loaded when shown. */
export function CharacterAvatar({ characterId, name, size }: { characterId: string; name: string; size?: number }) {
  const portrait = usePortraitStore((s) => s.byId[characterId]?.portrait ?? null);
  useEffect(() => {
    void ensurePortraits(characterId);
  }, [characterId]);
  return <Avatar src={portrait} name={name} size={size} />;
}
