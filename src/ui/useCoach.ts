// The Play page's coach runs in a web worker (src/sim/coach.worker.ts) so the board can paint and take input while it
// thinks. Only the latest position matters: a request that is still queued when a newer one arrives is dropped. If the
// worker can't start or crashes, the coach falls back to the main thread (slower, but the game stays playable).
import { useCallback, useEffect, useRef } from 'react';
import type { Game } from '../engine/engine';
import type { Decision } from '../engine/types';
import { adviseRequest, coachRequest, type Advice, type CoachRequest } from '../ai/coach';
import type { CoachJob, CoachReply } from '../sim/coach.worker';

interface Job {
  id: number;
  req: CoachRequest;
  resolve: (a: Advice) => void;
  reject: (e: Error) => void;
}

const startWorker = () => new Worker(new URL('../sim/coach.worker.ts', import.meta.url), { type: 'module' });

export class CoachClient {
  private w: Worker | null = null;
  /** the worker failed: compute on the main thread from now on */
  broken = false;
  private disposed = false;
  private seq = 0;
  private busy: Job | null = null;
  private next: Job | null = null;

  constructor(private make: () => Worker = startWorker) {}

  /** Advice for decision `d` in the game's current position (snapshotted now, so the game may move on). */
  advise(g: Game, d: Decision): Promise<Advice> {
    if (this.disposed) return Promise.reject(new Error('coach closed'));
    const req = coachRequest(g, d);
    return new Promise<Advice>((resolve, reject) => {
      this.next?.reject(new Error('superseded'));
      this.next = { id: ++this.seq, req, resolve, reject };
      this.pump();
    });
  }

  dispose() {
    this.disposed = true;
    this.w?.terminate();
    this.w = null;
    for (const j of [this.busy, this.next]) j?.reject(new Error('coach closed'));
    this.busy = this.next = null;
  }

  private pump() {
    if (this.busy || !this.next || this.disposed) return;
    const job = this.next;
    this.next = null;
    this.busy = job;
    if (this.broken || !this.ensureWorker()) return this.local(job);
    const msg: CoachJob = { id: job.id, req: job.req };
    this.w!.postMessage(msg);
  }

  private ensureWorker(): boolean {
    if (this.w) return true;
    try {
      const w = this.make();
      w.onmessage = (e: MessageEvent<CoachReply>) => this.reply(e.data);
      // a worker that fails to load or crashes reports here (not via onmessage)
      w.onerror = (e: ErrorEvent) => {
        e.preventDefault?.();
        this.fail();
      };
      w.onmessageerror = () => this.fail();
      this.w = w;
      return true;
    } catch {
      this.broken = true;
      return false;
    }
  }

  private reply(m: CoachReply) {
    const job = this.busy;
    if (!job || job.id !== m.id) return;
    this.busy = null;
    if ('advice' in m) job.resolve(m.advice);
    else job.reject(new Error(m.error));
    this.pump();
  }

  private fail() {
    this.broken = true;
    this.w?.terminate();
    this.w = null;
    const job = this.busy;
    this.busy = null;
    if (job) this.local(job);
    else this.pump();
  }

  private local(job: Job) {
    this.busy = job;
    adviseRequest(job.req)
      .then(job.resolve, job.reject)
      .finally(() => {
        if (this.busy === job) this.busy = null;
        this.pump();
      });
  }
}

/** A coach for one board: `advise(g, d)`; the worker is started on first use and stopped on unmount. */
export function useCoach(): (g: Game, d: Decision) => Promise<Advice> {
  const ref = useRef<CoachClient | null>(null);
  useEffect(
    () => () => {
      ref.current?.dispose();
      ref.current = null;
    },
    [],
  );
  return useCallback((g: Game, d: Decision) => {
    if (!ref.current) ref.current = new CoachClient();
    return ref.current.advise(g, d);
  }, []);
}
