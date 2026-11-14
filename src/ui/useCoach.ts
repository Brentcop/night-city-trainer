// The Play page's coach runs in a web worker (src/sim/coach.worker.ts) so the board can paint and take input while it
// thinks. Only the latest position matters: an advice request that is still queued when a newer one arrives is dropped.
// After you move, a move the coach did not value is scored in the worlds of its advice (`score`, INFO-1): those jobs
// queue behind advice (advice first, so the next position's advice is never kept waiting by a grade) and are never
// dropped. If the worker can't start or crashes, the coach falls back to the main thread (slower, but the game stays
// playable). A position the coach already answered in this tab (Undo goes back to one; a game resumed here replays to
// one) is answered from memory, not computed again: see `answers`.
import { useEffect, useMemo, useRef } from 'react';
import type { Game } from '../engine/engine';
import type { Decision } from '../engine/types';
import { adviseRequest, coachRequest, scoreMoveRequest, type Advice, type CoachRequest, type GradedOption, type ScoreRequest } from '../ai/coach';
import type { CoachJob, CoachReply } from '../sim/coach.worker';
import type { SeatLift } from '../ai/packageLift';
import { exactText } from '../lib/exactText';

type Payload = { req: CoachRequest } | { score: ScoreRequest };

interface Job {
  id: number;
  payload: Payload;
  /** an advice job's cache key (the exact text of its request), null when the request has none */
  key?: string | null;
  resolve: (r: Advice | GradedOption[]) => void;
  reject: (e: Error) => void;
}

/**
 * The coach's answers already given in this tab, least recently used first, keyed by the exact text of the request
 * (src/lib/exactText.ts: types, numbers, key order and shared references all written apart). The coach depends only on
 * its request (CoachRequest: the state with its rng, the decision, the pending labels, the lift) and its own fixed seed,
 * so the same text gets the same advice; the Map compares the whole key on a hit, never a hash alone. Shared by every
 * board in the tab (a resumed game mounts a new one), in memory only: never stored, because a new build may advise
 * differently. One answer kept costs about 30 KB of memory (its key is about 16,000 characters, the advice under 2 KB as
 * JSON), so 32 answers stay under 1 MB. Undo goes back one of your main-phase decisions per press; 32 answers cover going
 * back well over ten of them with the prompts between (a whole game asks about 50). Making the key takes under 1 ms in
 * Node, computing an answer about 70 ms (median, 2026-11-14). Only successful advice is kept, and each caller gets its
 * own copy, so no caller can change another's answer (none does today: the Play page and the coach panel only read it).
 */
export const COACH_ANSWERS_MAX = 32;
const answers = new Map<string, Advice>();

function recall(key: string): Advice | undefined {
  const a = answers.get(key);
  if (!a) return undefined;
  answers.delete(key);
  answers.set(key, a);
  return structuredClone(a);
}

function remember(key: string, a: Advice) {
  answers.delete(key);
  answers.set(key, structuredClone(a));
  while (answers.size > COACH_ANSWERS_MAX) answers.delete(answers.keys().next().value!);
}

/** Forget every answer (tests: the coach without its cache). */
export function clearCoachAnswers() {
  answers.clear();
}

/** How many answers are kept (tests). */
export const coachAnswersKept = () => answers.size;

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

  /**
   * Advice for decision `d` in the game's current position (snapshotted now, so the game may move on). `lift`: the
   * deciding seat's measured package lift (INFO-8), sent with the position; absent = package notes worded as unmeasured.
   */
  advise(g: Game, d: Decision, lift?: SeatLift): Promise<Advice> {
    if (this.disposed) return Promise.reject(new Error('coach closed'));
    const req = coachRequest(g, d, lift);
    this.reqs.set(d, req);
    const key = exactText(req);
    const known = key === null ? undefined : recall(key);
    // a newer request supersedes a queued one either way
    this.next?.reject(new Error('superseded'));
    this.next = null;
    if (known) return Promise.resolve(known);
    return new Promise<Advice>((resolve, reject) => {
      this.next = { id: ++this.seq, payload: { req }, key, resolve: resolve as Job['resolve'], reject };
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
    if ('advice' in m) {
      if (job.key) remember(job.key, m.advice);
      job.resolve(m.advice);
    }
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
    const key = job.key;
    run.then((r) => {
      if (key) remember(key, r as Advice);
      job.resolve(r);
    }, job.reject).finally(() => {
      if (this.busy === job) this.busy = null;
      this.pump();
    });
  }
}

export interface CoachApi {
  advise(g: Game, d: Decision, lift?: SeatLift): Promise<Advice>;
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
    return { advise: (g, d, lift) => client().advise(g, d, lift), score: (d, chosen, a) => client().score(d, chosen, a) };
  }, []);
}
