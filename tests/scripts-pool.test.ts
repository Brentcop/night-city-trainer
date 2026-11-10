import { Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import { GameErrors, loadLibrary, runJobs, runJobsDetailed, workerPool } from '../scripts/lib-node';
import type { MatchJob } from '../scripts/worker';

// Eval workers stand in for the game worker. A job is { x, crash?, throw?, once? }:
//   crash: the worker exits (process.exit) instead of replying
//   throw: an uncaught exception in the worker
//   once:  only the first worker to see the job crashes (a shared flag in workerData), so a retry succeeds
const CODE = `
const { parentPort, workerData } = require('node:worker_threads');
const flag = new Int32Array(workerData.shared);
parentPort.on('message', (j) => {
  const first = j.once ? Atomics.add(flag, 0, 1) === 0 : true;
  if (j.crash && first) process.exit(3);
  if (j.throw && first) setTimeout(() => { throw new Error('boom in worker'); });
  else setTimeout(() => parentPort.postMessage(j.x * 2), j.delay || 0);
});
`;
type Job = { x: number; crash?: boolean; throw?: boolean; once?: boolean; delay?: number };
function makePool(size: number, spawned: Worker[] = []) {
  const shared = new SharedArrayBuffer(4);
  return workerPool<Job, number>(() => {
    const w = new Worker(CODE, { eval: true, workerData: { shared } });
    spawned.push(w);
    return w;
  }, size);
}

describe('workerPool (scripts/lib-node.ts)', () => {
  it('runs every job and returns each result to its caller', async () => {
    const pool = makePool(3);
    const out = await Promise.all(Array.from({ length: 20 }, (_, i) => pool.run({ x: i, delay: (i * 7) % 5 })));
    expect(out).toEqual(Array.from({ length: 20 }, (_, i) => i * 2));
    await pool.close();
  });

  it('replaces a crashed worker and retries its job', async () => {
    const spawned: Worker[] = [];
    const pool = makePool(2, spawned);
    const out = await Promise.all([pool.run({ x: 1 }), pool.run({ x: 2, crash: true, once: true }), pool.run({ x: 3 }), pool.run({ x: 4 })]);
    expect(out).toEqual([2, 4, 6, 8]);
    expect(spawned.length).toBe(3); // two at start + one replacement
    expect(pool.failed).toBeNull();
    await pool.close();
  });

  it('retries after an uncaught exception in the worker', async () => {
    const pool = makePool(1);
    expect(await pool.run({ x: 5, throw: true, once: true })).toBe(10);
    await pool.close();
  });

  it('gives up on a job that keeps crashing: rejects everything pending and terminates every worker', async () => {
    const spawned: Worker[] = [];
    const pool = makePool(2, spawned);
    const exited = spawned.map((w) => new Promise((res) => w.once('exit', res)));
    const bad = pool.run({ x: 1, throw: true });
    const others = Promise.allSettled([pool.run({ x: 2, delay: 200 }), pool.run({ x: 3, delay: 200 }), pool.run({ x: 4, delay: 200 })]);
    await expect(bad).rejects.toThrow(/crashed its worker 2 times[\s\S]*boom in worker/);
    const settled = await others;
    expect(settled.some((s) => s.status === 'rejected')).toBe(true);
    expect(pool.failed).toBeInstanceOf(Error);
    await expect(pool.run({ x: 9 })).rejects.toBe(pool.failed);
    await Promise.all(exited); // the original workers are gone, nothing left running
  });

  it('rejects new jobs after close', async () => {
    const pool = makePool(1);
    await pool.close();
    await expect(pool.run({ x: 1 })).rejects.toThrow(/closed/);
  });
});

describe('runJobs (real game worker)', () => {
  it('counts a game that throws as an error, never a tie, and refuses to return a partial tally', async () => {
    const meta = loadLibrary().filter((d) => d.kind === 'meta');
    const good: MatchJob = { a: meta[0].deck, b: meta[1].deck, seed: 1, first: 0, bot: 'easy' };
    // a deck with no cards cannot be played: the engine throws inside the worker
    const broken: MatchJob = { a: { name: 'Broken', legends: [], main: [], sideboard: [] }, b: meta[1].deck, seed: 2, first: 0, bot: 'easy' };
    const before = process.exitCode;
    const err = console.error;
    console.error = () => {};
    try {
      const { results, errors } = await runJobsDetailed([good, broken], { threads: 2, quiet: true });
      expect(errors).toHaveLength(1);
      expect(errors[0].winner).toBeNull();
      expect(errors[0].error).toBeTruthy();
      expect(results).toHaveLength(1);
      expect(results[0].winner).not.toBeNull();
      await expect(runJobs([broken], { threads: 1, quiet: true })).rejects.toBeInstanceOf(GameErrors);
    } finally {
      console.error = err;
      process.exitCode = before;
    }
  }, 60_000);
});
