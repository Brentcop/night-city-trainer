// React binding for a PracticeSession: the page re-renders only when the running game is replaced (start, undo,
// quit); the board subscribes to engine ticks (and a concede, which ends the game in place) with useGameTick().
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { PracticeSession, type MatchSetup, type Running } from '../lib/practiceSession';

export function usePracticeGame(pace: () => number) {
  const paceRef = useRef(pace);
  paceRef.current = pace;
  const ref = useRef<PracticeSession | null>(null);
  if (!ref.current) ref.current = new PracticeSession({ pace: () => paceRef.current() });
  const session = ref.current;
  const game: Running | null = useSyncExternalStore(session.subscribeGame, () => session.current);
  // leaving the page stops the game: its bot stops and its result is never recorded
  useEffect(() => () => session.quit(), [session]);
  const start = useCallback((m: MatchSetup) => session.start(m), [session]);
  const undo = useCallback(() => void session.undo(), [session]);
  const quit = useCallback(() => session.quit(), [session]);
  const concede = useCallback(() => session.concede(), [session]);
  return { session, game, start, undo, quit, concede };
}

/** Re-render on every change of the running game (engine updates, new decisions, game over, errors). */
export function useGameTick(session: PracticeSession): number {
  return useSyncExternalStore(session.subscribe, () => session.version);
}
