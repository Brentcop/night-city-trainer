import { useEffect, useState } from 'react';
import { layoutMode, type BoardMode } from './layout';

/**
 * Compact play layout: a narrow screen, or a short one (a phone in landscape). Short screens up to 1100px wide count
 * even without a touch pointer, because some browsers don't report one in landscape. board.css's compact media rules
 * use this query; the board itself decides with layoutMode() (layout.ts), the same test in script.
 */
export const COMPACT_QUERY = '(max-width: 720px), (max-height: 520px) and (max-width: 1100px), (max-height: 520px) and (pointer: coarse)';

export interface Viewport {
  mode: BoardMode;
  /** the viewport in CSS px (the height is the dynamic one: mobile browser bars already taken off) */
  w: number;
  h: number;
}

function read(): Viewport {
  if (typeof window === 'undefined') return { mode: 'full', w: 1280, h: 800 };
  const w = window.innerWidth;
  const h = window.innerHeight;
  const coarse = !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return { mode: layoutMode(w, h, coarse), w, h };
}

/** The board's layout mode and the viewport size, re-checked on resize and rotation (the single switch for phones). */
export function useViewport(): Viewport {
  const [v, setV] = useState(read);
  useEffect(() => {
    const h = () =>
      setV((old) => {
        const n = read();
        return n.mode === old.mode && n.w === old.w && n.h === old.h ? old : n;
      });
    h();
    // some browsers miss media-query change events on rotation; resize/orientationchange always fire
    window.addEventListener('resize', h);
    window.addEventListener('orientationchange', h);
    window.visualViewport?.addEventListener('resize', h);
    return () => {
      window.removeEventListener('resize', h);
      window.removeEventListener('orientationchange', h);
      window.visualViewport?.removeEventListener('resize', h);
    };
  }, []);
  return v;
}

/** True when the play board should use its compact (phone) layout, portrait or landscape. */
export function useNarrow(): boolean {
  return useViewport().mode !== 'full';
}
