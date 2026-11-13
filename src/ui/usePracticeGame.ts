// React binding for a PracticeSession: the page re-renders only when the running game is replaced (start, undo,
// quit, resume); the board subscribes to engine ticks (and a concede, which ends the game in place) with useGameTick().
// It also keeps the autosave (src/lib/savedGames.ts): written at each new decision of yours and when the page is
// hidden or left, cleared when the game is finished, conceded or exited.
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { PracticeSession, type MatchSetup, type Running } from '../lib/practiceSession';
import { buildSave, clearAutosave, writeAutosave, type SavedGame } from '../lib/savedGames';

/** A save of the running game (null when there is nothing to come back to: no decision yet, over, or failed). */
export function saveOfRun(run: Running | null, coach: boolean, id = 'auto', name?: string): SavedGame | null {
  if (!run || run.cancelled || run.restoring || run.error || run.conceded || run.g.s.winner !== null) return null;
  return buildSave({ replay: run.replay, grades: run.grades, stable: run.stable, log: run.g.s.log }, { id, name, saved: new Date().toISOString(), coach });
}

export function usePracticeGame(pace: () => number, coach: () => boolean = () => true) {
  const paceRef = useRef(pace);
  paceRef.current = pace;
  const coachRef = useRef(coach);
  coachRef.current = coach;
  const ref = useRef<PracticeSession | null>(null);
  if (!ref.current)
    ref.current = new PracticeSession({
      pace: () => paceRef.current(),
      onStable: (run) => {
        const s = saveOfRun(run, coachRef.current());
        if (s) writeAutosave(s);
      },
      onClosed: () => clearAutosave(),
    });
  const session = ref.current;
  const game: Running | null = useSyncExternalStore(session.subscribeGame, () => session.current);
  // the latest position (answers given since the last decision included) is saved when the page is hidden or closed
  useEffect(() => {
    const flush = () => {
      const s = saveOfRun(session.current, coachRef.current());
      if (s) writeAutosave(s);
    };
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
  const start = useCallback((m: MatchSetup) => session.start(m), [session]);
  const resume = useCallback((s: SavedGame) => session.restore(s), [session]);
  const undo = useCallback(() => void session.undo(), [session]);
  const quit = useCallback(() => session.quit(), [session]);
  const concede = useCallback(() => session.concede(), [session]);
  return { session, game, start, resume, undo, quit, concede };
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
