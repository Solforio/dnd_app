import { useEffect } from 'react';
import { ensureSharedPortrait, sharedPortraitKey, useSharedPortraits } from '../../data/sharedPortraits';
import { Avatar } from '../portrait/Avatar';

/** The shared portrait of a party member, or their initials. */
export function MemberAvatar({ pid, uid, at, name, size }: { pid: string; uid: string; at: number | undefined; name: string; size?: number }) {
  const src = useSharedPortraits((s) => (at ? (s.byKey[sharedPortraitKey(pid, uid, at)] ?? null) : null));
  useEffect(() => {
    if (at) ensureSharedPortrait(pid, uid, at);
  }, [pid, uid, at]);
  return <Avatar src={src} name={name} size={size} />;
}
