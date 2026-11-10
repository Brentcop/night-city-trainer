import { useEffect, useState } from 'react';

/**
 * Compact play layout: a narrow screen, or a short one (a phone in landscape). Short screens up to 1100px wide count
 * even without a touch pointer, because some browsers don't report one in landscape.
 */
export const COMPACT_QUERY = '(max-width: 720px), (max-height: 520px) and (max-width: 1100px), (max-height: 520px) and (pointer: coarse)';

/** True when the play board should use its compact (phone) layout. Re-checked on rotation and resize. */
export function useNarrow(query = COMPACT_QUERY): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches;
  const [narrow, setNarrow] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const h = () => setNarrow(window.matchMedia(query).matches);
    h();
    mq.addEventListener?.('change', h);
    // some browsers miss media-query change events on rotation; resize/orientationchange always fire
    window.addEventListener('resize', h);
    window.addEventListener('orientationchange', h);
    return () => {
      mq.removeEventListener?.('change', h);
      window.removeEventListener('resize', h);
      window.removeEventListener('orientationchange', h);
    };
  }, [query]);
  return narrow;
}
