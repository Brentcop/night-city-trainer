// Plays watched games out in the watch worker (src/sim/watch.worker.ts), one at a time, off the page's thread: a Hard
// game takes about half a second to a second and a half of computing on a desktop (measured 2026-11-16 in Node on six
// games of event 1: 325 to 1,275 ms, median 605 ms), more on a phone, which would freeze the page if it ran here.
import type { WatchSource } from '../../../lib/watchMatch';
import type { WatchReply, WatchRequest } from '../../../sim/watch.worker';
import type { WatchResult } from './playback';

export type { WatchResult };

/** What plays games out for a spectator (the worker on the page; tests pass their own). */
export interface WatchComputer {
  compute(source: WatchSource): Promise<WatchResult>;
  dispose(): void;
}

/** One watch worker, made on first use, asked one game at a time; dispose() terminates it (pending games never answer). */
export function workerComputer(make: () => Worker = () => new Worker(new URL('../../../sim/watch.worker.ts', import.meta.url), { type: 'module' })): WatchComputer {
  let w: Worker | null = null;
  let seq = 0;
  let gone = false;
  let queue: Promise<unknown> = Promise.resolve();
  const ask = (source: WatchSource) =>
    new Promise<WatchResult>((resolve) => {
      if (gone) return;
      try {
        w ??= make();
      } catch (e) {
        resolve({ ok: false, error: String((e as Error)?.message ?? e) });
        return;
      }
      const id = ++seq;
      const worker = w;
      worker.onmessage = (e: MessageEvent<WatchReply>) => {
        const m = e.data;
        if (m.id !== id) return;
        resolve('game' in m ? { ok: true, game: m.game } : 'refused' in m ? { ok: false, refused: m.refused } : { ok: false, error: m.error });
      };
      worker.onerror = (e: ErrorEvent) => {
        e.preventDefault?.();
        worker.terminate();
        if (w === worker) w = null;
        resolve({ ok: false, error: e.message || 'the watch worker failed to start' });
      };
      worker.postMessage({ id, source } satisfies WatchRequest);
    });
  return {
    compute(source) {
      const run = queue.then(() => ask(source));
      queue = run.catch(() => undefined);
      return run;
    },
    dispose() {
      gone = true;
      w?.terminate();
      w = null;
    },
  };
}
