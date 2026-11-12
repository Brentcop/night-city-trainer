// Web Worker: the Play page's coach, off the main thread. One job per message:
//   { id, req }    → { id, advice }   advice for a position
//   { id, score }  → { id, scored }   your move scored in the worlds of that advice (INFO-1: gradeMove)
// or { id, error } (the coach declined the position, e.g. effects still pending; the page shows no advice, as before).
import { adviseRequest, scoreMoveRequest, type Advice, type CoachRequest, type GradedOption, type ScoreRequest } from '../ai/coach';

export type CoachJob = { id: number; req: CoachRequest } | { id: number; score: ScoreRequest };
export type CoachReply = { id: number; advice: Advice } | { id: number; scored: GradedOption[] } | { id: number; error: string };

self.onmessage = async (e: MessageEvent<CoachJob>) => {
  const job = e.data;
  const post = (m: CoachReply) => (self as unknown as Worker).postMessage(m);
  try {
    if ('score' in job) post({ id: job.id, scored: await scoreMoveRequest(job.score) });
    else post({ id: job.id, advice: await adviseRequest(job.req) });
  } catch (err) {
    post({ id: job.id, error: String((err as Error)?.message ?? err) });
  }
};
