// The Play page's coach runs in a web worker (src/sim/coach.worker.ts) so the board can paint and take input while it
// thinks. Only the latest position matters: an advice request that is still queued when a newer one arrives is dropped.
// After you move, a move the coach did not value is scored in the worlds of its advice (`score`, INFO-1): those jobs
// queue behind advice (advice first, so the next position's advice is never kept waiting by a grade) and are never
// dropped. If the worker can't start or crashes, the coach falls back to the main thread (slower, but the game stays
// playable).
import { useEffect, useMemo, useRef } from 'react';
import type { Game } from '../engine/engine';
import type { Decision } from '../engine/types';
import { adviseRequest, coachRequest, scoreMoveRequest, type Advice, type CoachRequest, type GradedOption, type ScoreRequest } from '../ai/coach';
import type { CoachJob, CoachReply } from '../sim/coach.worker';

type Payload = { req: CoachRequest } | { score: ScoreRequest };

interface Job {
  id: number;
  payload: Payload;
  resolve: (r: Advice | GradedOption[]) => void;
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
  private scores: Job[] = [];
  /** the snapshot each advice was made from, by decision (a later score of the move made there needs it) */
  private reqs = new WeakMap<Decision, CoachRequest>();

  constructor(private make: () => Worker = startWorker) {}

  /** Advice for decision `d` in the game's current position (snapshotted now, so the game may move on). */
  advise(g: Game, d: Decision): Promise<Advice> {
    if (this.disposed) return Promise.reject(new Error('coach closed'));
    const req = coachRequest(g, d);
    this.reqs.set(d, req);
    return new Promise<Advice>((resolve, reject) => {
      this.next?.reject(new Error('superseded'));
      this.next = { id: ++this.seq, payload: { req }, resolve: resolve as Job['resolve'], reject };
      this.pump();
    });
  }

  /** Your move `chosen` at decision `d`, scored in the worlds of advice `a` (gradeMove's `extra`). Needs advise(g, d) first. */
  score(d: Decision, chosen: number, a: Advice): Promise<GradedOption[]> {
    if (this.disposed) return Promise.reject(new Error('coach closed'));
    const req = this.reqs.get(d);
    if (!req) return Promise.reject(new Error('no advice was asked for this decision'));
    return new Promise<GradedOption[]>((resolve, reject) => {
      this.scores.push({ id: ++this.seq, payload: { score: { req, chosen, coach: a.index, grade: a.grade } }, resolve: resolve as Job['resolve'], reject });
      this.pump();
    });
  }

  dispose() {
    this.disposed = true;
    this.w?.terminate();
    this.w = null;
    for (const j of [this.busy, this.next, ...this.scores]) j?.reject(new Error('coach closed'));
    this.busy = this.next = null;
    this.scores = [];
  }

  private pump() {
    if (this.busy || this.disposed) return;
    // advice first: you are waiting for it; a grade can wait
    const job = this.next ?? this.scores.shift() ?? null;
    if (!job) return;
    if (job === this.next) this.next = null;
    this.busy = job;
    if (this.broken || !this.ensureWorker()) return this.local(job);
    const msg: CoachJob = { id: job.id, ...job.payload };
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
    else if ('scored' in m) job.resolve(m.scored);
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
    const run: Promise<Advice | GradedOption[]> = 'req' in job.payload ? adviseRequest(job.payload.req) : scoreMoveRequest(job.payload.score);
    run.then(job.resolve, job.reject).finally(() => {
      if (this.busy === job) this.busy = null;
      this.pump();
    });
  }
}

export interface CoachApi {
  advise(g: Game, d: Decision): Promise<Advice>;
  score(d: Decision, chosen: number, a: Advice): Promise<GradedOption[]>;
}

/** A coach for one board: `advise(g, d)` and `score(d, chosen, advice)`; the worker is started on first use and stopped on unmount. */
export function useCoach(): CoachApi {
  const ref = useRef<CoachClient | null>(null);
  useEffect(
    () => () => {
      ref.current?.dispose();
      ref.current = null;
    },
    [],
  );
  return useMemo(() => {
    const client = () => (ref.current ??= new CoachClient());
    return { advise: (g, d) => client().advise(g, d), score: (d, chosen, a) => client().score(d, chosen, a) };
  }, []);
}
