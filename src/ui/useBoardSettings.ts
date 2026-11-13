// React side of the Play board settings (src/lib/boardSettings.ts): one shared copy for the page, saved on every
// change, followed across tabs, and the accent colour applied to <html data-accent> for the whole site (index.html
// sets it before first paint from the same key).
import { useCallback, useSyncExternalStore } from 'react';
import { applyPatch, BOARD_SETTINGS_KEY, defaultBoardSettings, loadBoardSettings, saveBoardSettings, type Accent, type BoardSettings, type BoardSettingsPatch } from '../lib/boardSettings';

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

function set(next: BoardSettings) {
  current = next;
  saveBoardSettings(next);
  applyAccent(next.accent);
  for (const f of [...subs]) f();
}

function onStorage(e: StorageEvent) {
  if (e.key !== BOARD_SETTINGS_KEY) return;
  current = loadBoardSettings();
  applyAccent(current.accent);
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
