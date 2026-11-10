// A small pool of game workers for the browser. play() queues a game and resolves with its result.
// A game that throws in a worker rejects with a GameError carrying the engine's message (never a silent tie);
// terminate() rejects everything pending with a PoolStoppedError, so callers can tell "stopped by you" from "failed".
import type { GameJob, GameRec, PlayGame } from '../lib/tournament';
import type { ReplayData } from '../lib/replayFrames';

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

type Pending = { res: (r: WorkerResult) => void; rej: (e: Error) => void };
type MakeWorker = () => Worker;
const defaultWorker: MakeWorker = () => new Worker(new URL('./game.worker.ts', import.meta.url), { type: 'module' });

export class GamePool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: WorkerRequest[] = [];
  private waiting = new Map<number, Pending>();
  /** which job each busy worker holds, so a crashed worker can fail exactly that job */
  private busy = new Map<Worker, number>();
  private seq = 0;
  private dead = false;
  /** crashes since the last finished game */
  private crashes = 0;

  constructor(
    size = defaultThreads(),
    private make: MakeWorker = defaultWorker,
  ) {
    for (let i = 0; i < Math.max(1, size); i++) this.spawn();
  }
  get size() {
    return this.workers.length;
  }
  get terminated() {
    return this.dead;
  }

  private spawn() {
    const w = this.make();
    w.onmessage = (e: MessageEvent<WorkerResponse>) => this.done(w, e.data);
    w.onerror = (e: ErrorEvent) => {
      e.preventDefault?.();
      this.crash(w, `game worker crashed${e.message ? `: ${e.message}` : ''}`);
    };
    w.onmessageerror = () => this.crash(w, 'game worker sent a message that could not be read');
    this.workers.push(w);
    this.idle.push(w);
  }
  private done(w: Worker, msg: WorkerResponse) {
    if (this.dead) return;
    this.busy.delete(w);
    this.crashes = 0;
    const p = this.waiting.get(msg.id);
    this.waiting.delete(msg.id);
    if ('rec' in msg && msg.rec) p?.res({ rec: msg.rec, replay: msg.replay });
    else p?.rej(new GameError('error' in msg && msg.error ? msg.error : 'game failed without a message', 'stack' in msg ? msg.stack : undefined));
    this.idle.push(w);
    this.pump();
  }
  /** The worker died: fail the job it held, replace it, keep the rest of the queue going. */
  private crash(w: Worker, why: string) {
    if (this.dead) return;
    const id = this.busy.get(w);
    this.busy.delete(w);
    w.terminate();
    this.workers = this.workers.filter((x) => x !== w);
    this.idle = this.idle.filter((x) => x !== w);
    if (id !== undefined) {
      const p = this.waiting.get(id);
      this.waiting.delete(id);
      p?.rej(new GameError(why));
    }
    // A worker that cannot even start (e.g. its script failed to load) would crash forever: after a few crashes in a
    // row with no finished game, give up and fail everything still waiting instead of respawning in a loop.
    if (++this.crashes > Math.max(3, this.size + 2)) {
      const pending = [...this.waiting.values()];
      this.shutdown();
      pending.forEach((p) => p.rej(new GameError(`${why} (game workers keep crashing; giving up)`)));
      return;
    }
    this.spawn();
    this.pump();
  }

  /** Run one job; resolves with the record (and the replay when `job.replay`). */
  run(job: WorkerJob): Promise<WorkerResult> {
    if (this.dead) return Promise.reject(new PoolStoppedError());
    return new Promise((res, rej) => {
      const id = ++this.seq;
      this.waiting.set(id, { res, rej });
      this.queue.push({ id, job });
      this.pump();
    });
  }
  play: PlayGame = (job) => this.run(job).then((r) => r.rec);
  /** Re-simulate one game in a worker and capture its replay frames. */
  replay = (job: WorkerJob): Promise<ReplayData> => this.run({ ...job, replay: true }).then((r) => r.replay!);

  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      const req = this.queue.shift()!;
      this.busy.set(w, req.id);
      w.postMessage(req);
    }
  }
  /** Stop everything; queued and running games reject with PoolStoppedError, and later play() calls reject at once. */
  terminate() {
    if (this.dead) return;
    const pending = [...this.waiting.values()];
    this.shutdown();
    pending.forEach((p) => p.rej(new PoolStoppedError()));
  }
  private shutdown() {
    this.dead = true;
    this.workers.forEach((w) => w.terminate());
    this.workers = [];
    this.idle = [];
    this.queue = [];
    this.busy.clear();
    this.waiting.clear();
  }
}
