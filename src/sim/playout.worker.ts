// Web Worker: runs batched rollout tasks for the coach's parallel play-outs (Gain 9).
// Each message is a PlayoutBatch; each reply is a PlayoutResult with one value per task (two, value then grade-scale
// value, when the config carries gradeWeights: the coach, src/ai/coach.ts).
import type { PlayoutBatch, PlayoutResult } from '../ai/playoutPool';
import { runPlayoutBatch } from './playoutBatch';

self.onmessage = async (e: MessageEvent<PlayoutBatch>) => {
  const { id, ...batch } = e.data;
  (self as unknown as Worker).postMessage({ id, values: await runPlayoutBatch(batch) } satisfies PlayoutResult);
};
