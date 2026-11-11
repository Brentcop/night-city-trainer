// The lifecycle of a browser game pool behind a "run" button (Matchup Lab, Deck Lab, tournament runner):
// one pool per run, Stop terminates it (its games reject as stopped), and leaving the page terminates it too.
import { useEffect, useMemo, useRef } from 'react';
import { GamePool, defaultThreads } from '../sim/pool';

export interface PoolRun {
  /** Start a run on a fresh pool, terminating any earlier one. */
  open(threads?: number): GamePool;
  /** The live pool, or a fresh one if there is none: for several jobs that share one pool (close it after the last). */
  shared(threads?: number): GamePool;
  /** End a run: terminate its pool, and forget it if it is still the current one. */
  close(pool: GamePool): void;
  /** Stop the current run: its pending games reject with PoolStoppedError. */
  stop(): void;
}

export function usePoolRun(): PoolRun {
  const ref = useRef<GamePool | null>(null);
  // leaving the page stops the run (games live in workers, not in the component)
  useEffect(() => () => ref.current?.terminate(), []);
  return useMemo(
    () => ({
      open(threads = defaultThreads()) {
        ref.current?.terminate();
        const pool = new GamePool(threads);
        ref.current = pool;
        return pool;
      },
      shared(threads = defaultThreads()) {
        if (!ref.current || ref.current.terminated) ref.current = new GamePool(threads);
        return ref.current;
      },
      close(pool) {
        pool.terminate();
        if (ref.current === pool) ref.current = null;
      },
      stop() {
        ref.current?.terminate();
      },
    }),
    [],
  );
}
