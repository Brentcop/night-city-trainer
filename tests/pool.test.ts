// GamePool against a mock Worker: results, game errors, crashed workers, terminate.
import { describe, expect, it } from 'vitest';
import { GameError, GamePool, PoolStoppedError, isStopped, type WorkerRequest, type WorkerResponse } from '../src/sim/pool';
import type { GameJob } from '../src/lib/tournament';

class MockWorker {
  onmessage: ((e: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: ((e: MessageEvent) => void) | null = null;
  sent: WorkerRequest[] = [];
  terminated = false;
  postMessage(m: WorkerRequest) {
    this.sent.push(m);
  }
  terminate() {
    this.terminated = true;
  }
  /** test helpers */
  get current() {
    return this.sent[this.sent.length - 1];
  }
  reply(r: Partial<WorkerResponse> = {}) {
    const id = this.current.id;
    this.onmessage?.({ data: { id, rec: { seed: this.current.job.seed, first: 0, winner: 0, turns: 5, reason: 'x' }, ...r } } as MessageEvent<WorkerResponse>);
  }
  crash(message = 'boom') {
    this.onerror?.({ message, preventDefault() {} } as ErrorEvent);
  }
}

function setup(size: number) {
  const made: MockWorker[] = [];
  const pool = new GamePool(size, () => {
    const w = new MockWorker();
    made.push(w);
    return w as unknown as Worker;
  });
  return { pool, made, live: () => made.filter((w) => !w.terminated) };
}
const job = (seed: number): GameJob => ({ a: { name: 'A', legends: [], main: [], sideboard: [] }, b: { name: 'B', legends: [], main: [], sideboard: [] }, seed, first: 0, bot: 'easy' });
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('GamePool', () => {
  it('resolves games and queues past the pool size', async () => {
    const { pool, made } = setup(1);
    const p1 = pool.play(job(1));
    const p2 = pool.play(job(2));
    expect(made[0].sent).toHaveLength(1);
    made[0].reply();
    expect((await p1).seed).toBe(1);
    expect(made[0].sent).toHaveLength(2);
    made[0].reply();
    expect((await p2).seed).toBe(2);
  });

  it('a game that throws rejects with its message (not a tie, not "stopped")', async () => {
    const { pool, made } = setup(1);
    const p = pool.play(job(1));
    made[0].reply({ rec: undefined, error: 'Unknown card id x', stack: 'at y' } as Partial<WorkerResponse>);
    const err = await p.catch((e) => e);
    expect(err).toBeInstanceOf(GameError);
    expect(err.message).toBe('Unknown card id x');
    expect(isStopped(err)).toBe(false);
    // the worker is idle again and takes the next job
    const q = pool.play(job(2));
    made[0].reply();
    expect((await q).seed).toBe(2);
  });

  it('a crashed worker fails only the job it held and is replaced', async () => {
    const { pool, made, live } = setup(2);
    const p1 = pool.play(job(1));
    const p2 = pool.play(job(2));
    const p3 = pool.play(job(3)); // queued
    const holder1 = made.find((w) => w.current?.job.seed === 1)!;
    const holder2 = made.find((w) => w.current?.job.seed === 2)!;
    holder1.crash('out of memory');
    const err = await p1.catch((e) => e);
    expect(err).toBeInstanceOf(GameError);
    expect(err.message).toContain('out of memory');
    expect(holder1.terminated).toBe(true);
    expect(live()).toHaveLength(2);
    expect(pool.size).toBe(2);
    // the replacement picked up the queued job
    const repl = made[made.length - 1];
    expect(repl.current.job.seed).toBe(3);
    repl.reply();
    holder2.reply();
    expect((await p3).seed).toBe(3);
    expect((await p2).seed).toBe(2);
  });

  it('messageerror also fails the held job', async () => {
    const { pool, made } = setup(1);
    const p = pool.play(job(1));
    made[0].onmessageerror?.({} as MessageEvent);
    await expect(p).rejects.toBeInstanceOf(GameError);
  });

  it('gives up instead of respawning forever when workers keep crashing', async () => {
    const { pool, made } = setup(1);
    const p = pool.play(job(1));
    for (let i = 0; i < 10 && !pool.terminated; i++) made[made.length - 1].crash('script failed to load');
    expect(pool.terminated).toBe(true);
    expect(made.length).toBeLessThan(10);
    await expect(p).rejects.toBeInstanceOf(GameError);
    await expect(pool.play(job(2))).rejects.toBeInstanceOf(PoolStoppedError);
  });

  it('terminate rejects running and queued games as stopped, and later play() rejects at once', async () => {
    const { pool, made } = setup(1);
    const p1 = pool.play(job(1));
    const p2 = pool.play(job(2));
    pool.terminate();
    const [e1, e2] = await Promise.all([p1.catch((e) => e), p2.catch((e) => e)]);
    expect(isStopped(e1)).toBe(true);
    expect(isStopped(e2)).toBe(true);
    expect(made.every((w) => w.terminated)).toBe(true);
    let settled = false;
    const late = pool.play(job(3)).catch((e) => ((settled = true), e));
    await tick();
    expect(settled).toBe(true);
    expect(isStopped(await late)).toBe(true);
    // a late message from a terminated worker is ignored
    expect(() => made[0].reply()).not.toThrow();
  });

  it('replay() asks the worker for frames and returns them', async () => {
    const { pool, made } = setup(1);
    const p = pool.replay({ ...job(4), seedB: 1003 });
    expect(made[0].current.job).toMatchObject({ seed: 4, seedB: 1003, replay: true });
    made[0].reply({ replay: { final: {} as never, frames: [] } } as Partial<WorkerResponse>);
    expect(await p).toEqual({ final: {}, frames: [] });
  });
});
