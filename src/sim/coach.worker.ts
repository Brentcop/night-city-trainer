// Web Worker: the Play page's coach, off the main thread. One job per message:
//   { id, req }    → { id, advice }   advice for a position
//   { id, score }  → { id, scored }   your move scored in the worlds of that advice (INFO-1: gradeMove)
// or { id, error } (the coach declined the position, e.g. effects still pending; the page shows no advice, as before).
// Gain 9: spawns 2 playout sub-workers for parallel deep play-outs; the Node path stays single-threaded.
import { adviseRequest, scoreMoveRequest, type Advice, type CoachRequest, type GradedOption, type ScoreRequest } from '../ai/coach';
import type { PlayoutBatch, PlayoutResult, RolloutPool, RolloutTask, PlayoutConfig } from '../ai/playoutPool';
import type { GameState, PlayerId } from '../engine/types';

export type CoachJob = { id: number; req: CoachRequest } | { id: number; score: ScoreRequest };
export type CoachReply = { id: number; advice: Advice } | { id: number; scored: GradedOption[] } | { id: number; error: string };

function createPlayoutPool(size: number): RolloutPool {
  const workers: Worker[] = Array.from({ length: size }, () => new Worker(new URL('./playout.worker.ts', import.meta.url), { type: 'module' }));
  const pending = new Map<number, { resolve: (v: number[]) => void; reject: (e: Error) => void }>();
  let nextId = 0;
  for (const w of workers) {
    w.onmessage = (e: MessageEvent<PlayoutResult>) => {
      const p = pending.get(e.data.id);
      if (p) { pending.delete(e.data.id); p.resolve(e.data.values); }
    };
    w.onerror = () => {
      for (const [id, p] of pending) { pending.delete(id); p.reject(new Error('playout worker crashed')); }
    };
  }
  return {
    async runBatch(state: GameState, pend: { player: PlayerId; label: string }[], player: PlayerId, tasks: RolloutTask[], config: PlayoutConfig) {
      if (tasks.length === 0) return [];
      const n = Math.min(workers.length, tasks.length);
      const perWorker = Math.ceil(tasks.length / n);
      const promises: Promise<number[]>[] = [];
      for (let i = 0; i < n; i++) {
        const slice = tasks.slice(i * perWorker, (i + 1) * perWorker);
        if (slice.length === 0) continue;
        const id = nextId++;
        promises.push(new Promise<number[]>((resolve, reject) => {
          pending.set(id, { resolve, reject });
          workers[i].postMessage({ id, state, pending: pend, player, tasks: slice, config } satisfies PlayoutBatch);
        }));
      }
      return (await Promise.all(promises)).flat();
    },
    dispose() {
      for (const w of workers) w.terminate();
      workers.length = 0;
      for (const [, p] of pending) p.reject(new Error('pool disposed'));
      pending.clear();
    },
  };
}

const pool: RolloutPool = createPlayoutPool(2);

self.onmessage = async (e: MessageEvent<CoachJob>) => {
  const job = e.data;
  const post = (m: CoachReply) => (self as unknown as Worker).postMessage(m);
  try {
    if ('score' in job) post({ id: job.id, scored: await scoreMoveRequest(job.score, pool) });
    else post({ id: job.id, advice: await adviseRequest(job.req, pool) });
  } catch (err) {
    post({ id: job.id, error: String((err as Error)?.message ?? err) });
  }
};
