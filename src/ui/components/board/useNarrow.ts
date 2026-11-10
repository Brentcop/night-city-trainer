import { useEffect, useState } from 'react';

/** True when the viewport is phone-sized (board switches to compact cards). */
export function useNarrow(query = '(max-width: 720px)'): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches;
  const [narrow, setNarrow] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const h = () => setNarrow(mq.matches);
    h();
    mq.addEventListener?.('change', h);
    return () => mq.removeEventListener?.('change', h);
  }, [query]);
  return narrow;
}
