// A fixed-size pool of workers that run one job at a time, shared by the browser's game pool (src/sim/pool.ts, Web
// Workers) and the scripts' pool (scripts/lib-node.ts workerPool, worker_threads). Each side passes a thin adapter that
// turns its worker's events into WorkerLink calls, and a policy that says what a crash costs: whether the job is
// retried, when the pool gives up, and which errors callers see.

/** What a worker tells the pool about the job it holds. */
export interface WorkerLink<R> {
  /** the job finished */
  done(r: R): void;
  /** the job failed but the worker is fine and takes the next job (e.g. a game threw and the worker reported it) */
  failed(e: Error): void;
  /** the worker is gone (crashed, failed to load, exited); `why` says how */
  died(why: string): void;
}

/** The pool's handle on one worker. */
export interface PooledWorker<J> {
  post(job: J): void;
  terminate(): unknown;
}

export interface WorkPoolPolicy {
  /** times a job may be tried when its worker dies (1: it fails at once; 2: one retry) */
  maxAttempts: number;
  /** the pool gives up once its worker deaths exceed this; `alive` = workers left after the latest death */
  crashLimit(alive: number): number;
  /** a finished job resets the death count (only deaths in a row count) */
  resetCrashesOnDone: boolean;
  /** a job that may not be tried again ends the whole pool (true) or only fails that job (false) */
  jobFailureIsFatal: boolean;
  /** the error of a job whose worker died and that may not be tried again */
  jobFailed(why: string, attempts: number): Error;
  /** the error every pending job gets when there were too many deaths */
  gaveUp(why: string, crashes: number): Error;
  /** the error run() rejects with once the pool has stopped (`failed` = the error it gave up with, if it did) */
  refused(failed: Error | null): Error;
  /** told after a dead worker is replaced (`retrying`: its job went back to the front of the queue) */
  onRestart?(why: string, retrying: boolean): void;
}

interface Task<J, R> {
  job: J;
  resolve: (r: R) => void;
  reject: (e: Error) => void;
  attempts: number;
}
interface Slot<J, R> {
  w: PooledWorker<J>;
  task: Task<J, R> | null;
  retired: boolean;
}

export class WorkPool<J, R> {
  private slots: Slot<J, R>[] = [];
  private queue: Task<J, R>[] = [];
  private crashes = 0;
  private failure: Error | null = null;
  private stopped = false;

  constructor(
    private spawn: (link: WorkerLink<R>) => PooledWorker<J>,
    size: number,
    private policy: WorkPoolPolicy,
  ) {
    for (let i = 0; i < Math.max(1, size); i++) this.add();
  }

  /** workers alive now */
  get size() {
    return this.slots.length;
  }
  /** the error the pool gave up with, or null */
  get failed() {
    return this.failure;
  }
  /** stopped by stop() or given up: run() rejects at once */
  get closed() {
    return this.stopped || this.failure !== null;
  }

  run(job: J): Promise<R> {
    if (this.closed) return Promise.reject(this.policy.refused(this.failure));
    return new Promise<R>((resolve, reject) => {
      this.queue.push({ job, resolve, reject, attempts: 0 });
      this.pump();
    });
  }

  /**
   * Stop for good and terminate every worker. Queued jobs reject with `err`; running jobs do too when `running` is
   * 'reject', and are dropped unsettled when it is 'abandon'. Resolves once every worker is terminated.
   */
  stop(err: Error, running: 'reject' | 'abandon'): Promise<unknown> {
    if (this.closed) return Promise.resolve();
    this.stopped = true;
    const slots = this.slots.splice(0);
    for (const s of slots) {
      s.retired = true;
      if (running === 'reject') s.task?.reject(err);
      s.task = null;
    }
    for (const t of this.queue.splice(0)) t.reject(err);
    return Promise.all(slots.map((s) => s.w.terminate()));
  }

  private add() {
    const slot: Slot<J, R> = { w: null as unknown as PooledWorker<J>, task: null, retired: false };
    slot.w = this.spawn({
      done: (r) => this.settle(slot, (t) => t.resolve(r)),
      failed: (e) => this.settle(slot, (t) => t.reject(e)),
      died: (why) => this.died(slot, why),
    });
    this.slots.push(slot);
  }

  private settle(slot: Slot<J, R>, how: (t: Task<J, R>) => void) {
    if (slot.retired) return;
    const t = slot.task;
    slot.task = null;
    if (this.policy.resetCrashesOnDone) this.crashes = 0;
    if (t) how(t);
    this.pump();
  }

  /** A worker died: replace it and retry or fail its job, or give up when deaths pile up. */
  private died(slot: Slot<J, R>, why: string) {
    if (slot.retired) return;
    slot.retired = true;
    this.slots.splice(this.slots.indexOf(slot), 1);
    void slot.w.terminate();
    this.crashes++;
    const t = slot.task;
    slot.task = null;
    let retrying = false;
    if (t) {
      if (t.attempts >= this.policy.maxAttempts) {
        const err = this.policy.jobFailed(why, t.attempts);
        t.reject(err);
        if (this.policy.jobFailureIsFatal) return this.giveUp(err);
      } else {
        this.queue.unshift(t);
        retrying = true;
      }
    }
    // A worker that cannot even start would die forever: past the limit, fail everything instead of respawning.
    if (this.crashes > this.policy.crashLimit(this.slots.length)) return this.giveUp(this.policy.gaveUp(why, this.crashes));
    this.policy.onRestart?.(why, retrying);
    this.add();
    this.pump();
  }

  private giveUp(err: Error) {
    if (this.closed) return;
    this.failure = err;
    for (const s of this.slots.splice(0)) {
      s.retired = true;
      s.task?.reject(err);
      s.task = null;
      void s.w.terminate();
    }
    for (const t of this.queue.splice(0)) t.reject(err);
  }

  private pump() {
    for (const s of this.slots) {
      const t = this.queue[0];
      if (!t) return;
      if (s.task || s.retired) continue;
      this.queue.shift();
      s.task = t;
      t.attempts++;
      s.w.post(t.job);
    }
  }
}
