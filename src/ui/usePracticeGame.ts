// React binding for a PracticeSession: the page re-renders only when the running game is replaced (start, undo,
// quit, resume); the board subscribes to engine ticks (and a concede, which ends the game in place) with useGameTick().
// It also keeps the autosave (src/lib/savedGames.ts): written at each new decision of yours and when the page is
// hidden or left, cleared when the game is finished, conceded or exited. A multi-day game (src/lib/multiDay.ts) is saved
// to its own list instead, at the same moments, and is not removed by Exit: it stays until it is finished or conceded;
// the autosave of a quick game is never touched by it.
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { PracticeSession, recordFinished, type MatchSetup, type Running } from '../lib/practiceSession';
import { buildSave, clearAutosave, writeAutosave, type SavedGame } from '../lib/savedGames';
import { botEntry, botMark, removeBotGame, writeBotGame, type BotMultiDay, type BotMultiDayRun } from '../lib/multiDay';

/** A save of the running game (null when there is nothing to come back to: no decision yet, over, or failed). */
export function saveOfRun(run: Running | null, coach: boolean, id = 'auto', name?: string): SavedGame | null {
  if (!run || run.cancelled || run.restoring || run.error || run.conceded || run.g.s.winner !== null) return null;
  return buildSave({ replay: run.replay, grades: run.grades, stable: run.stable, log: run.g.s.log }, { id, name, saved: new Date().toISOString(), coach });
}

/** The multi-day game being played (null: a quick game). `replayId` is null until the started game is known. */
export interface MultiDayRun extends BotMultiDayRun {
  replayId: string | null;
}

export function usePracticeGame(pace: () => number, coach: () => boolean = () => true, now: () => number = Date.now) {
  const paceRef = useRef(pace);
  paceRef.current = pace;
  const coachRef = useRef(coach);
  coachRef.current = coach;
  const nowRef = useRef(now);
  nowRef.current = now;
  const mdRef = useRef<MultiDayRun | null>(null);
  /** the multi-day game this run belongs to, if any */
  const mdOf = (run: Running | null): MultiDayRun | null => {
    const m = mdRef.current;
    if (!m || !run) return null;
    if (m.replayId === null) m.replayId = run.replay.id;
    return m.replayId === run.replay.id ? m : null;
  };
  /** write the running game where it belongs: its multi-day entry, or the autosave */
  const store = (run: Running | null) => {
    const m = mdOf(run);
    const s = saveOfRun(run, coachRef.current(), m ? 'md' : 'auto');
    if (!s || !run) return;
    if (!m) {
      writeAutosave(s);
      return;
    }
    if (m.wentFirst === undefined) m.wentFirst = run.g.s.first === 0;
    writeBotGame(botEntry(m, s, nowRef.current()));
  };
  const storeRef = useRef(store);
  storeRef.current = store;
  const ref = useRef<PracticeSession | null>(null);
  if (!ref.current)
    ref.current = new PracticeSession({
      pace: () => paceRef.current(),
      record: (replay, st) => {
        const m = mdRef.current && mdRef.current.replayId === replay.id ? mdRef.current : null;
        // a multi-day game finished after its deadline is recorded as usual, marked late
        if (m) replay.multiDay = botMark({ days: m.days, late: m.late || nowRef.current() > m.deadline });
        recordFinished(replay, st);
      },
      onStable: (run) => storeRef.current(run),
      onClosed: (run, why) => {
        const m = mdRef.current && mdRef.current.replayId === run.replay.id ? mdRef.current : null;
        if (!m) clearAutosave();
        // Exit keeps a multi-day game; finishing or conceding it removes it from the ongoing list (it is recorded)
        else if (why !== 'quit') removeBotGame(run.replay.id);
      },
    });
  const session = ref.current;
  const game: Running | null = useSyncExternalStore(session.subscribeGame, () => session.current);
  // the latest position (answers given since the last decision included) is saved when the page is hidden or closed
  useEffect(() => {
    const flush = () => storeRef.current(session.current);
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
  }, [session]);
  const start = useCallback(
    (m: MatchSetup) => {
      // the game being left is saved where it belongs first (a multi-day game is never lost to a new one)
      storeRef.current(session.current);
      mdRef.current = null;
      return session.start(m);
    },
    [session],
  );
  /** Start a multi-day game lasting `days` (its deadline counts from now). */
  const startMultiDay = useCallback(
    (m: MatchSetup, days: number) => {
      storeRef.current(session.current);
      const t = nowRef.current();
      mdRef.current = { replayId: null, days, created: t, deadline: t + days * 86_400_000, late: false };
      const run = session.start(m);
      mdRef.current.replayId = run.replay.id;
      return run;
    },
    [session],
  );
  const resume = useCallback(
    (s: SavedGame) => {
      storeRef.current(session.current);
      mdRef.current = null;
      return session.restore(s);
    },
    [session],
  );
  /** Resume a multi-day game (`late`: its deadline passed and you chose to finish it anyway). */
  const resumeMultiDay = useCallback(
    async (e: BotMultiDay, late = false) => {
      storeRef.current(session.current);
      const prev = mdRef.current;
      mdRef.current = { replayId: e.id, days: e.days, created: Date.parse(e.created), deadline: Date.parse(e.deadline), late: late || !!e.late, ...(e.wentFirst !== undefined ? { wentFirst: e.wentFirst } : {}) };
      const r = await session.restore(e.save);
      if (!r.ok) mdRef.current = prev;
      else if (late && !e.late) storeRef.current(r.run);
      return r;
    },
    [session],
  );
  const undo = useCallback(() => void session.undo(), [session]);
  const quit = useCallback(() => session.quit(), [session]);
  const concede = useCallback(() => session.concede(), [session]);
  /** The multi-day game the running game is, or null. */
  const multiDay = useCallback((run: Running | null) => (run && mdRef.current?.replayId === run.replay.id ? mdRef.current : null), []);
  return { session, game, start, startMultiDay, resume, resumeMultiDay, undo, quit, concede, multiDay };
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
