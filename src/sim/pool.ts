// A small pool of game workers for the browser (a WorkPool, src/lib/workPool.ts, with a Web Worker adapter). play()
// queues a game and resolves with its result.
// A game that throws in a worker rejects with a GameError carrying the engine's message (never a silent tie);
// terminate() rejects everything pending with a PoolStoppedError, so callers can tell "stopped by you" from "failed".
import type { GameJob, GameRec, PlayGame } from '../lib/tournament';
import type { ReplayData } from '../lib/replayFrames';
import { WorkPool, type PooledWorker, type WorkerLink, type WorkPoolPolicy } from '../lib/workPool';

export const defaultThreads = () => Math.max(1, Math.min(8, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) - 1));

/** A game job as the worker understands it: a tournament job plus optional extras (additive to GameJob). */
export interface WorkerJob extends GameJob {
  /** seat B's bot seed (default `seed + 7777`, as in tournaments; the Matchup Lab uses `seed + 999`) */
  seedB?: number;
  /** capture a board frame after every log line and return the replay (used by "Watch") */
  replay?: boolean;
}
export interface WorkerResult {
  rec: GameRec;
  replay?: ReplayData;
}
/** Messages exchanged with game.worker.ts. */
export interface WorkerRequest {
  id: number;
  job: WorkerJob;
}
export type WorkerResponse = { id: number; rec: GameRec; replay?: ReplayData } | { id: number; error: string; stack?: string };

/** A game threw inside the worker (or the worker itself crashed). `message` is the engine's error message. */
export class GameError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
    this.name = 'GameError';
  }
}
/** The pool was terminated (Stop, or the page closed) before the game finished. */
export class PoolStoppedError extends Error {
  constructor() {
    super('stopped');
    this.name = 'PoolStoppedError';
  }
}
export const isStopped = (e: unknown) => e instanceof PoolStoppedError || (e as Error)?.name === 'PoolStoppedError';
/** Human-readable text for an error caught from a pool run. */
export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

type MakeWorker = () => Worker;
const defaultWorker: MakeWorker = () => new Worker(new URL('./game.worker.ts', import.meta.url), { type: 'module' });

/**
 * A crashed game worker fails the game it held (no retry); after more crashes in a row than workers + 2, give up
 * ("workers" = the pool's intended size, so the limit stays put while crashed workers are being replaced).
 */
const GAME_POLICY: WorkPoolPolicy = {
  maxAttempts: 1,
  crashLimit: (size) => size + 2,
  resetCrashesOnDone: true,
  jobFailureIsFatal: false,
  jobFailed: (why) => new GameError(why),
  gaveUp: (why) => new GameError(`${why} (game workers keep crashing; giving up)`),
  refused: () => new PoolStoppedError(),
};

/** The Web Worker adapter: requests and replies carry an id (game.worker.ts's protocol); a game error is a failed job. */
function gameWorker(make: MakeWorker) {
  let seq = 0;
  return (link: WorkerLink<WorkerResult>): PooledWorker<WorkerJob> => {
    const w = make();
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if ('rec' in msg && msg.rec) link.done({ rec: msg.rec, replay: msg.replay });
      else link.failed(new GameError('error' in msg && msg.error ? msg.error : 'game failed without a message', 'stack' in msg ? msg.stack : undefined));
    };
    w.onerror = (e: ErrorEvent) => {
      e.preventDefault?.();
      link.died(`game worker crashed${e.message ? `: ${e.message}` : ''}`);
    };
    w.onmessageerror = () => link.died('game worker sent a message that could not be read');
    return {
      post: (job) => w.postMessage({ id: ++seq, job } satisfies WorkerRequest),
      terminate: () => w.terminate(),
    };
  };
}

export class GamePool {
  private pool: WorkPool<WorkerJob, WorkerResult>;

  constructor(size = defaultThreads(), make: MakeWorker = defaultWorker) {
    this.pool = new WorkPool(gameWorker(make), size, GAME_POLICY);
  }
  get size() {
    return this.pool.size;
  }
  get terminated() {
    return this.pool.closed;
  }

  /** Run one job; resolves with the record (and the replay when `job.replay`). */
  run(job: WorkerJob): Promise<WorkerResult> {
    return this.pool.run(job);
  }
  play: PlayGame = (job) => this.run(job).then((r) => r.rec);
  /** Re-simulate one game in a worker and capture its replay frames. */
  replay = (job: WorkerJob): Promise<ReplayData> => this.run({ ...job, replay: true }).then((r) => r.replay!);

  /** Stop everything; queued and running games reject with PoolStoppedError, and later play() calls reject at once. */
  terminate() {
    void this.pool.stop(new PoolStoppedError());
  }
}
