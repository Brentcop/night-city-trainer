// The count of multi-day games waiting for you, shown on the Play tab (src/App.tsx). Kept tiny on purpose: the header is
// in the entry chunk, so it reads only the two lists' raw JSON (src/lib/multiDay.ts bot games, all waiting for you; and
// src/net/corr.ts games against a person, those whose `summary.yourMove` is set) and never imports the game code.
// Every storage access is wrapped: blocked storage just shows no count.

export const BOT_GAMES_KEY = 'nct.multiDay.bot.v1';
export const CORR_GAMES_KEY = 'nct.corr.v1';
/** fired on window when either list changes in this tab (other tabs get the storage event) */
export const ONGOING_EVENT = 'nct-ongoing';

function list(key: string): unknown[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Ongoing multi-day games waiting for your move in this browser. */
export function ongoingWaiting(): number {
  const bots = list(BOT_GAMES_KEY).length;
  const people = list(CORR_GAMES_KEY).filter((g) => {
    const o = g as { stage?: unknown; summary?: { yourMove?: unknown } } | null;
    return !!o && o.stage !== 'over' && o.summary?.yourMove === true;
  }).length;
  return bots + people;
}

/** Tell the header (this tab) that a list changed. */
export function ongoingChanged() {
  try {
    window.dispatchEvent(new Event(ONGOING_EVENT));
  } catch {
    /* no window (tests in Node) */
  }
}
