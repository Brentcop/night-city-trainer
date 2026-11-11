// Play board preferences: the bot's pace (remembered in this browser) and panel states that last for the browser
// session (the "All actions" list and the game log drawer). Storage is optional: blocked storage just means defaults.
import { useCallback, useState } from 'react';

/** Bot pace after each of its actions, in ms. Normal is the default. */
export const BOT_SPEEDS = [
  { ms: 0, label: 'instant' },
  { ms: 500, label: 'fast' },
  { ms: 1200, label: 'normal' },
  { ms: 2400, label: 'slow' },
] as const;
export const DEFAULT_BOT_SPEED = 1200;
const SPEED_KEY = 'nct.botSpeed';

/**
 * A stored or chosen pace mapped onto the current options. 250 was "fast" before the options were slowed down, so it
 * maps to today's fast; anything unknown is normal.
 */
export function normalizeBotSpeed(v: unknown): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_BOT_SPEED;
  if (n === 250) return 500;
  return BOT_SPEEDS.some((s) => s.ms === n) ? n : DEFAULT_BOT_SPEED;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const local = (): Store | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};
const session = (): Store | null => {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
};

export function loadBotSpeed(store: Store | null = local()): number {
  try {
    return normalizeBotSpeed(store?.getItem(SPEED_KEY) ?? null);
  } catch {
    return DEFAULT_BOT_SPEED;
  }
}
export function saveBotSpeed(ms: number, store: Store | null = local()) {
  try {
    store?.setItem(SPEED_KEY, String(normalizeBotSpeed(ms)));
  } catch {
    /* storage blocked */
  }
}

/** Session-long panel flags. */
export const ALL_ACTIONS_KEY = 'nct.play.allActions';
export const LOG_OPEN_KEY = 'nct.play.logOpen';

export function readFlag(key: string, fallback: boolean, store: Store | null = session()): boolean {
  try {
    const v = store?.getItem(key);
    return v === '1' ? true : v === '0' ? false : fallback;
  } catch {
    return fallback;
  }
}
export function writeFlag(key: string, on: boolean, store: Store | null = session()) {
  try {
    store?.setItem(key, on ? '1' : '0');
  } catch {
    /* storage blocked */
  }
}

/**
 * A boolean that stays as the player left it for the rest of the browser session: across decisions, turns, Undo and
 * new games (the board keeps it in state; sessionStorage carries it across remounts).
 */
export function useSessionFlag(key: string, fallback: boolean): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => readFlag(key, fallback));
  const set = useCallback(
    (v: boolean) => {
      setOn(v);
      writeFlag(key, v);
    },
    [key],
  );
  return [on, set];
}
