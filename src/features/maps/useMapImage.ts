import { useEffect, useState } from 'react';
import { getImage } from '../../data/imageStore';

export type MapImage =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; url: string; width: number; height: number };

/** The map's image from this browser's storage, as an object URL (revoked when no longer shown). */
export function useMapImage(fingerprint: string | undefined, reload: number): MapImage {
  const [state, setState] = useState<{ key: string; image: MapImage }>({ key: '', image: { status: 'loading' } });
  const key = `${fingerprint}|${reload}`;

  useEffect(() => {
    if (!fingerprint) return;
    let url: string | null = null;
    let cancelled = false;
    void getImage(fingerprint).then((img) => {
      if (cancelled) return;
      if (!img) {
        setState({ key, image: { status: 'missing' } });
        return;
      }
      url = URL.createObjectURL(img.blob);
      setState({ key, image: { status: 'ready', url, width: img.width, height: img.height } });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fingerprint, key]);

  if (!fingerprint) return { status: 'missing' };
  return state.key === key ? state.image : { status: 'loading' };
}
