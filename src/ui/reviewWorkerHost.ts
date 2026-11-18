// One review worker (src/sim/review.worker.ts) shared by the reviews of one open game: the Game review and its second
// tab, "Play-out details" (ROADMAP2 §11 item 14). Each used to start a worker of its own, so the worker's bundle (the
// engine, the bots and the cards) was loaded and booted twice for one game. A worker runs one review at a time anyway
// (a review never yields to the message loop), so the host queues them: the next starts when the one before ends, on the
// same worker. The worker protocol is unchanged: one request in, progress and one final reply out.
//
// Cancel behaves as before for the review cancelled: a running review is stopped by terminating the worker (the only way
// to stop a review mid-way); the next queued review then starts on a fresh worker, and a queued review is just dropped.
// `dispose` stops everything (the dialog closed); the host stays usable afterwards (React may re-run effects).
import { useEffect, useState } from 'react';
import type { ReviewReply, ReviewRequest } from '../sim/review.worker';

/** A review queued behind the other tab's on the dialog's one worker. */
export const WAITING_TEXT = 'Waiting for the other tab’s review to finish (one review runs at a time)…';

/** What the host needs of a Worker (a fake one in the tests). */
export interface ReviewWorkerLike {
  postMessage(q: ReviewRequest): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<ReviewReply>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  onmessageerror: ((e: MessageEvent) => void) | null;
}

export interface ReviewJobHandlers {
  /** every reply of this review's worker: progress, then one final reply */
  reply(m: ReviewReply): void;
  /** the worker failed to start, crashed or sent an unreadable reply (the words to show) */
  fail(error: string): void;
  /** the review leaves the queue and starts on the worker */
  start?(): void;
}

const makeReviewWorker = (): ReviewWorkerLike => new Worker(new URL('../sim/review.worker.ts', import.meta.url), { type: 'module' }) as unknown as ReviewWorkerLike;

interface Job {
  req: ReviewRequest;
  h: ReviewJobHandlers;
}

/** The final replies: the review is over after one of these. */
const isFinal = (m: ReviewReply) => !('progress' in m);

export class ReviewWorkerHost {
  private worker: ReviewWorkerLike | null = null;
  private current: Job | null = null;
  private queue: Job[] = [];

  constructor(private readonly make: () => ReviewWorkerLike = makeReviewWorker) {}

  /** A review is running or waiting. */
  get busy(): boolean {
    return !!this.current || this.queue.length > 0;
  }

  /** Run a review on the shared worker (after the reviews already queued). Returns its cancel. */
  run(req: ReviewRequest, h: ReviewJobHandlers): () => void {
    const job: Job = { req, h };
    this.queue.push(job);
    this.next();
    return () => this.cancel(job);
  }

  /** Stop every review and the worker (the dialog closed). */
  dispose(): void {
    this.queue = [];
    this.current = null;
    this.kill();
  }

  private cancel(job: Job): void {
    if (this.current === job) {
      // a review can only be stopped mid-way by stopping its worker; the next one gets a fresh worker
      this.current = null;
      this.kill();
      this.next();
    } else this.queue = this.queue.filter((j) => j !== job);
  }

  private kill(): void {
    const w = this.worker;
    this.worker = null;
    if (!w) return;
    w.onmessage = w.onerror = w.onmessageerror = null;
    w.terminate();
  }

  /** A worker failure ends the running review; the worker is dropped and the next review gets a fresh one. */
  private failed(job: Job, error: string): void {
    if (this.current !== job) return;
    this.current = null;
    this.kill();
    job.h.fail(error);
    this.next();
  }

  private next(): void {
    if (this.current) return;
    const job = this.queue.shift();
    if (!job) return;
    if (!this.worker) {
      try {
        this.worker = this.make();
      } catch (e) {
        job.h.fail(String((e as Error)?.message ?? e));
        this.next();
        return;
      }
      const w = this.worker;
      w.onmessage = (e) => {
        const j = this.current;
        if (!j || this.worker !== w) return;
        const m = e.data;
        if (isFinal(m)) this.current = null;
        j.h.reply(m);
        if (isFinal(m)) this.next();
      };
      // a worker that fails to load or crashes reports here (not via onmessage)
      w.onerror = (e) => {
        e.preventDefault();
        if (this.current) this.failed(this.current, e.message || 'the review worker failed to start');
      };
      w.onmessageerror = () => {
        if (this.current) this.failed(this.current, 'the review worker sent an unreadable reply');
      };
    }
    this.current = job;
    job.h.start?.();
    this.worker.postMessage(job.req);
  }
}

/**
 * The host a review runs on: the dialog's shared one (both tabs, one worker), else one of the component's own, stopped
 * when the component goes (a tournament game's review, one worker as before).
 */
export function useReviewHost(shared?: ReviewWorkerHost): ReviewWorkerHost {
  const [own] = useState(() => (shared ? null : new ReviewWorkerHost()));
  useEffect(() => (own ? () => own.dispose() : undefined), [own]);
  return shared ?? own!;
}
