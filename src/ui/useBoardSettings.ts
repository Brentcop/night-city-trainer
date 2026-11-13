// React side of the Play board settings (src/lib/boardSettings.ts): one shared copy for the page, saved on every
// change, followed across tabs, and the look applied to <html> for the whole site (index.html sets the same attributes
// before first paint from the same key): data-accent (none for the default yellow), data-card-back, data-glow,
// data-frame, data-numerals, and the motion level resolved against the device (data-motion 'full' | 'reduced' | 'off',
// data-ambient 'on' when effects that run all the time may run). The CSS for them is src/ui/themes.css.
import { useCallback, useSyncExternalStore } from 'react';
import { applyPatch, BOARD_SETTINGS_KEY, defaultBoardSettings, loadBoardSettings, saveBoardSettings, type Accent, type BoardSettings, type BoardSettingsPatch, type Motion } from '../lib/boardSettings';

let current: BoardSettings | null = null;
const subs = new Set<() => void>();

function get(): BoardSettings {
  if (!current) current = loadBoardSettings();
  return current;
}

/** Put the accent on <html> ('yellow', the default, is no attribute at all). */
export function applyAccent(accent: Accent) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (accent === 'yellow') root.removeAttribute('data-accent');
  else root.setAttribute('data-accent', accent);
}

const media = (q: string): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(q).matches;
  } catch {
    return false;
  }
};

/**
 * The motion level in effect: 'system' becomes 'off' when the device asks for reduced motion (as the site always did)
 * and 'full' otherwise. Ambient effects (they run all the time: the active side's travelling light, rain, the header
 * line) need full motion, and with 'system' also a mouse-like pointer, so phones don't run them unless asked.
 */
export function resolveMotion(m: Motion, reduceAsked: boolean, finePointer: boolean): { level: 'full' | 'reduced' | 'off'; ambient: boolean } {
  if (m === 'system') return reduceAsked ? { level: 'off', ambient: false } : { level: 'full', ambient: finePointer };
  return { level: m, ambient: m === 'full' };
}

/** Whether script-driven motion (count-ups and the like) should be skipped: the Motion setting in effect, else the device. */
export function lessMotion(): boolean {
  const level = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-motion') : null;
  if (level) return level !== 'full';
  return media('(prefers-reduced-motion: reduce)');
}

let lastLook: BoardSettings | null = null;
let listening = false;

/** Put the whole look on <html>: accent, card back, glow, frame, numerals and the resolved motion. */
export function applyLook(s: BoardSettings) {
  if (typeof document === 'undefined') return;
  lastLook = s;
  const root = document.documentElement;
  applyAccent(s.accent);
  root.setAttribute('data-card-back', s.cardBack);
  root.setAttribute('data-glow', s.glow);
  root.setAttribute('data-frame', s.frame);
  root.setAttribute('data-numerals', s.numerals);
  const m = resolveMotion(s.motion, media('(prefers-reduced-motion: reduce)'), media('(hover: hover) and (pointer: fine)'));
  root.setAttribute('data-motion', m.level);
  root.setAttribute('data-ambient', m.ambient ? 'on' : 'off');
  if (!listening && typeof window !== 'undefined' && window.matchMedia) {
    listening = true;
    const again = () => lastLook && applyLook(lastLook);
    for (const q of ['(prefers-reduced-motion: reduce)', '(hover: hover) and (pointer: fine)']) {
      try {
        window.matchMedia(q).addEventListener?.('change', again);
      } catch {
        /* old browsers: the look follows on the next change */
      }
    }
  }
}

function set(next: BoardSettings) {
  current = next;
  saveBoardSettings(next);
  applyLook(next);
  for (const f of [...subs]) f();
}

function onStorage(e: StorageEvent) {
  if (e.key !== BOARD_SETTINGS_KEY) return;
  current = loadBoardSettings();
  applyLook(current);
  for (const f of [...subs]) f();
}

function subscribe(fn: () => void) {
  subs.add(fn);
  if (subs.size === 1 && typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    subs.delete(fn);
    if (!subs.size && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/** The settings, a change (applied live and saved), and Reset to defaults. */
export function useBoardSettings(): [BoardSettings, (patch: BoardSettingsPatch) => void, () => void] {
  const s = useSyncExternalStore(subscribe, get, get);
  const update = useCallback((patch: BoardSettingsPatch) => set(applyPatch(get(), patch)), []);
  const reset = useCallback(() => set(defaultBoardSettings()), []);
  return [s, update, reset];
}
