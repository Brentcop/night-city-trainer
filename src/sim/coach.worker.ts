// Web Worker: the Play page's coach, off the main thread. One position per message: { id, req } → { id, advice } or
// { id, error } (the coach declined the position, e.g. effects still pending; the page shows no advice, as before).
import { adviseRequest, type Advice, type CoachRequest } from '../ai/coach';

export type CoachJob = { id: number; req: CoachRequest };
export type CoachReply = { id: number; advice: Advice } | { id: number; error: string };

self.onmessage = async (e: MessageEvent<CoachJob>) => {
  const { id, req } = e.data;
  const post = (m: CoachReply) => (self as unknown as Worker).postMessage(m);
  try {
    post({ id, advice: await adviseRequest(req) });
  } catch (err) {
    post({ id, error: String((err as Error)?.message ?? err) });
  }
};
