// Re-simulate one game in a worker (so the page stays responsive) and capture its replay frames.
// Each start() cancels the previous one; cancel() and unmounting terminate the worker, and a cancelled run resolves to null.
import { useCallback, useEffect, useRef } from 'react';
import { GamePool, isStopped, type WorkerJob } from '../sim/pool';
import type { ReplayData } from '../lib/replayFrames';

export function useReplayWorker() {
  const pool = useRef<GamePool | null>(null);
  const cancel = useCallback(() => {
    pool.current?.terminate();
    pool.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  const start = useCallback(
    async (job: WorkerJob): Promise<ReplayData | null> => {
      cancel();
      const p = new GamePool(1);
      pool.current = p;
      try {
        return await p.replay(job);
      } catch (e) {
        if (isStopped(e)) return null;
        throw e;
      } finally {
        p.terminate();
        if (pool.current === p) pool.current = null;
      }
    },
    [cancel],
  );
  return { start, cancel };
}
