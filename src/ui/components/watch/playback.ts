// The spectator's playback ("Watch") as a pure state machine: which game of the match is on the table, which move of
// it is shown, the pace, and the pause between games. The hook (useWatchPlayback.ts) only adds the timers and the
// worker; everything that decides what the screen shows is here, so it is tested without a browser.
//
// Nothing about a game is revealed before the playback reaches its end: the score counts only the games whose last
// move was shown, whether another game follows is known only once the game on the table is over, and the games played
// out ahead (at most one) are never shown before their turn.
import { BOT_SPEEDS, DEFAULT_BOT_SPEED } from '../board/prefs';
import type { WatchedGame } from '../../../lib/watchGame';
import { scoreOf, type NextGame, type WatchOutcome, type WatchSource } from '../../../lib/watchMatch';

/** Seconds between the end of a game and the next one, as at a live match. */
export const BETWEEN_GAMES_S = 5;
/** The quickest pace (BOT_SPEEDS' "instant" is 0 ms: a spectator still sees each move, for this long). */
export const MIN_STEP_MS = 80;
/** How often a game the running event has not dealt yet is looked for again (ms). */
export const WAIT_POLL_MS = 1000;

/** A game played out, or why it can't be shown (`refused`: the plain sentence) or failed (`error`). */
export type WatchResult = { ok: true; game: WatchedGame } | { ok: false; refused: string } | { ok: false; error: string };

/** One game of the match as played out in the worker. */
export interface WatchEntry {
  /** the game's number in the match (0-based) */
  index: number;
  source: WatchSource;
  game?: WatchedGame;
  refused?: string;
  error?: string;
}

export interface PlaybackState {
  entries: WatchEntry[];
  /** how the planning ended: the match is over, or the event stopped before a game (its number) */
  end: { kind: 'over' } | { kind: 'stopped'; index: number } | null;
  /** the event has not dealt the game waited for yet (its number, 0-based), or null */
  waiting: number | null;
  /** the entry on the table (it may not exist yet: being dealt or played out) */
  shown: number;
  /** the move shown: an index into the frames of the entry on the table */
  fi: number;
  /** games whose end the spectator has reached: their results may be shown */
  reached: number;
  playing: boolean;
  /** ms per move (one of BOT_SPEEDS) */
  speed: number;
  /** seconds before the next game starts, while counting down */
  left: number | null;
  /** "Skip to the match result": every game goes straight to its end */
  skipAll: boolean;
}

export type PlaybackAction =
  /** the planner's answer for the entry after the last one (`at`: how many entries there were when it was asked) */
  | { type: 'planned'; at: number; next: NextGame }
  | { type: 'computed'; k: number; result: WatchResult }
  /** the pace's timer: the next move */
  | { type: 'tick' }
  /** the countdown's timer: one second less */
  | { type: 'second' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'step' }
  | { type: 'nextTurn' }
  | { type: 'restart' }
  | { type: 'skip' }
  | { type: 'skipMatch' }
  | { type: 'speed'; ms: number }
  | { type: 'startNext' };

export const initialPlayback = (playing: boolean): PlaybackState => ({
  entries: [],
  end: null,
  waiting: null,
  shown: 0,
  fi: 0,
  reached: 0,
  playing,
  speed: DEFAULT_BOT_SPEED,
  left: null,
  skipAll: false,
});

const frameCount = (s: PlaybackState) => s.entries[s.shown]?.game?.frames.length ?? 0;
const lastFrame = (s: PlaybackState) => Math.max(0, frameCount(s) - 1);
/** The game on the table has been played out and can be shown. */
export const ready = (s: PlaybackState) => !!s.entries[s.shown]?.game;
/** The game on the table is at its last move. */
export const atEnd = (s: PlaybackState) => ready(s) && s.fi >= lastFrame(s);
/** Another game follows the one on the table: known only once that one is over. */
export const nextComing = (s: PlaybackState) => atEnd(s) && (s.entries.length > s.shown + 1 || s.waiting !== null);
/** The match is over and its last game's end is shown. */
export const matchShown = (s: PlaybackState) => s.end?.kind === 'over' && atEnd(s) && s.shown >= s.entries.length - 1;

const outcome = (g: WatchedGame): WatchOutcome => ({ winner: g.winner, turns: g.turns });
/** The results of the games played out so far, in order (what the planner reads). */
export const playedOut = (s: PlaybackState): WatchOutcome[] => s.entries.flatMap((e) => (e.game ? [outcome(e.game)] : []));
/** The score of the games whose end the spectator has seen. */
export const shownScore = (s: PlaybackState): [number, number] => scoreOf(s.entries.slice(0, s.reached).flatMap((e) => (e.game ? [outcome(e.game)] : [])));

/**
 * Whether to ask the planner for the next game now: the planning has not ended, the last game asked for is played out
 * (one that was refused or failed stops the match there), and no game is waiting ahead of the table already.
 */
export function wantsPlan(s: PlaybackState): boolean {
  if (s.end) return false;
  const last = s.entries[s.entries.length - 1];
  if (last && !last.game) return false;
  return s.entries.length <= s.shown + 1;
}

/** What follows from the state itself: a reached end, the countdown to the next game, skipping. */
function settle(s: PlaybackState): PlaybackState {
  let x = s;
  const last = lastFrame(x);
  if (ready(x) && x.fi > last) x = { ...x, fi: last };
  if (x.skipAll && ready(x) && x.fi < last) x = { ...x, fi: last };
  if (atEnd(x) && x.reached < x.shown + 1) x = { ...x, reached: x.shown + 1 };
  if (nextComing(x) && x.skipAll) return settle({ ...x, shown: x.shown + 1, fi: 0, left: null });
  if (nextComing(x) && x.playing) {
    if (x.left === null) x = { ...x, left: BETWEEN_GAMES_S };
  } else if (x.left !== null) x = { ...x, left: null };
  return x;
}

export function playbackReduce(s: PlaybackState, a: PlaybackAction): PlaybackState {
  switch (a.type) {
    case 'planned': {
      if (a.at !== s.entries.length || s.end) return s;
      const n = a.next;
      if (n.kind === 'over') return settle({ ...s, waiting: null, end: { kind: 'over' } });
      if (n.kind === 'stopped') return settle({ ...s, waiting: null, end: { kind: 'stopped', index: n.index } });
      if (n.kind === 'wait') return settle({ ...s, waiting: n.index });
      return settle({ ...s, waiting: null, entries: [...s.entries, { index: n.index, source: n.source }] });
    }
    case 'computed': {
      const e = s.entries[a.k];
      if (!e || e.game || e.refused || e.error) return s;
      const r = a.result;
      const done: WatchEntry = r.ok ? { ...e, game: r.game } : 'refused' in r ? { ...e, refused: r.refused } : { ...e, error: r.error };
      return settle({ ...s, entries: s.entries.map((x, j) => (j === a.k ? done : x)) });
    }
    case 'tick':
      return s.playing && ready(s) && !atEnd(s) ? settle({ ...s, fi: s.fi + 1 }) : s;
    case 'second':
      if (s.left === null) return s;
      return s.left <= 1 ? settle({ ...s, shown: s.shown + 1, fi: 0, left: null }) : { ...s, left: s.left - 1 };
    case 'play':
      return settle({ ...s, playing: true });
    case 'pause':
      return settle({ ...s, playing: false });
    case 'step':
      return ready(s) ? settle({ ...s, playing: false, fi: Math.min(lastFrame(s), s.fi + 1) }) : s;
    case 'nextTurn': {
      const frames = s.entries[s.shown]?.game?.frames;
      if (!frames) return s;
      const turn = frames[s.fi]?.line.turn ?? 0;
      const j = frames.findIndex((f, i) => i > s.fi && f.line.turn > turn);
      return settle({ ...s, fi: j < 0 ? lastFrame(s) : j });
    }
    case 'restart':
      return settle({ ...s, fi: 0, skipAll: false, left: null });
    case 'skip':
      return ready(s) ? settle({ ...s, fi: lastFrame(s) }) : s;
    case 'skipMatch':
      return settle({ ...s, skipAll: true });
    case 'speed':
      return { ...s, speed: BOT_SPEEDS.some((x) => x.ms === a.ms) ? a.ms : DEFAULT_BOT_SPEED };
    case 'startNext':
      return nextComing(s) ? settle({ ...s, shown: s.shown + 1, fi: 0, left: null }) : s;
  }
}
