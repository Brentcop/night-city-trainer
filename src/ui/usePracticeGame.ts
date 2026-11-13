// React binding for a PracticeSession: the page re-renders only when the running game is replaced (start, undo,
// quit, resume); the board subscribes to engine ticks (and a concede, which ends the game in place) with useGameTick().
// Where the game is kept (the autosave, or a multi-day game's own list) is src/lib/gameKeeper.ts: written at each new
// decision of yours and when the page is hidden or left; "Save and exit" (leave) and leaving the page keep it, "Exit and
// discard" (quit) removes a quick game's autosave, and finishing or conceding removes it once the result is recorded. A
// refused write is reported in `storageNote` (the board shows it).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PracticeSession, type MatchSetup, type Running } from '../lib/practiceSession';
import type { SavedGame } from '../lib/savedGames';
import type { BotMultiDay } from '../lib/multiDay';
import { GameKeeper } from '../lib/gameKeeper';

export { saveOfRun, type MultiDayRun } from '../lib/gameKeeper';

/** `saves`: saved games are on (site config); off, no autosave is written. */
export function usePracticeGame(pace: () => number, coach: () => boolean = () => true, now: () => number = Date.now, saves: () => boolean = () => true) {
  const paceRef = useRef(pace);
  paceRef.current = pace;
  const coachRef = useRef(coach);
  coachRef.current = coach;
  const nowRef = useRef(now);
  nowRef.current = now;
  const savesRef = useRef(saves);
  savesRef.current = saves;
  // a storage write that failed, for the board's notice (`n` changes with each new report)
  const [storageNote, setStorageNote] = useState<{ text: string; n: number } | null>(null);
  const keeperRef = useRef<GameKeeper | null>(null);
  if (!keeperRef.current)
    keeperRef.current = new GameKeeper({
      coach: () => coachRef.current(),
      saves: () => savesRef.current(),
      now: () => nowRef.current(),
      onProblem: (text) => setStorageNote((x) => ({ text, n: (x?.n ?? 0) + 1 })),
    });
  const keeper = keeperRef.current;
  const ref = useRef<PracticeSession | null>(null);
  if (!ref.current)
    ref.current = new PracticeSession({
      pace: () => paceRef.current(),
      record: (replay, st) => keeper.record(replay, st),
      onStable: (run) => void keeper.store(run),
      onClosed: (run, why) => keeper.closed(run, why),
    });
  const session = ref.current;
  const game: Running | null = useSyncExternalStore(session.subscribeGame, () => session.current);
  // the latest position (answers given since the last decision included) is saved when the page is hidden or closed
  useEffect(() => {
    const flush = () => void keeper.store(session.current);
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
      // leaving the page stops the game (its bot stops and its result is never recorded) but keeps it saved
      flush();
      session.quit({ keepSave: true });
    };
  }, [session, keeper]);
  const start = useCallback(
    (m: MatchSetup) => {
      // the game being left is saved where it belongs first (a multi-day game is never lost to a new one)
      keeper.store(session.current);
      keeper.md = null;
      return session.start(m);
    },
    [session, keeper],
  );
  /** Start a multi-day game lasting `days` (its deadline counts from now). */
  const startMultiDay = useCallback(
    (m: MatchSetup, days: number) => {
      keeper.store(session.current);
      const t = nowRef.current();
      keeper.md = { replayId: null, days, created: t, deadline: t + days * 86_400_000, late: false };
      const run = session.start(m);
      keeper.md.replayId = run.replay.id;
      return run;
    },
    [session, keeper],
  );
  const resume = useCallback(
    (s: SavedGame) => {
      keeper.store(session.current);
      keeper.md = null;
      return session.restore(s);
    },
    [session, keeper],
  );
  /** Resume a multi-day game (`late`: its deadline passed and you chose to finish it anyway). */
  const resumeMultiDay = useCallback(
    async (e: BotMultiDay, late = false) => {
      keeper.store(session.current);
      const prev = keeper.md;
      keeper.md = { replayId: e.id, days: e.days, created: Date.parse(e.created), deadline: Date.parse(e.deadline), late: late || !!e.late, ...(e.wentFirst !== undefined ? { wentFirst: e.wentFirst } : {}) };
      const r = await session.restore(e.save);
      if (!r.ok) keeper.md = prev;
      else if (late && !e.late) keeper.store(r.run);
      return r;
    },
    [session, keeper],
  );
  const undo = useCallback(() => void session.undo(), [session]);
  /** Exit and discard: the game ends without a record and a quick game's autosave is removed (a multi-day game stays). */
  const quit = useCallback(() => session.quit(), [session]);
  /**
   * Save and exit: the game is stored where it belongs (the autosave, or its multi-day entry) and kept there, ready for
   * Resume. False (and the game goes on) when this browser refused to store it.
   */
  const leave = useCallback((): boolean => {
    if (!keeper.store(session.current)) return false;
    session.quit({ keepSave: true });
    return true;
  }, [session, keeper]);
  const concede = useCallback(() => session.concede(), [session]);
  /** The multi-day game the running game is, or null. */
  const multiDay = useCallback((run: Running | null) => (run && keeper.md?.replayId === run.replay.id ? keeper.md : null), [keeper]);
  return { session, game, start, startMultiDay, resume, resumeMultiDay, undo, quit, leave, concede, multiDay, storageNote };
}

/** Anything the board can follow: a practice session, or an online game (src/net/session.ts). */
export interface TickSource {
  subscribe: (fn: () => void) => () => void;
  readonly version: number;
}

/** Re-render on every change of the running game (engine updates, new decisions, game over, errors). */
export function useGameTick(session: TickSource): number {
  return useSyncExternalStore(session.subscribe, () => session.version);
}
