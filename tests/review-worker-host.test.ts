// One review worker per open Game review (src/ui/reviewWorkerHost.ts; ROADMAP2 §11 item 14): the Game review tab and
// "Play-out details" run on one shared worker, one review at a time, with the same replies, progress and cancel as when
// each had its own. A fake worker counts the workers started and the requests each was sent.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ReviewWorkerHost, type ReviewWorkerLike } from '../src/ui/reviewWorkerHost';
import type { ReviewReply, ReviewRequest } from '../src/sim/review.worker';

class FakeWorker implements ReviewWorkerLike {
  sent: ReviewRequest[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<ReviewReply>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: ((e: MessageEvent) => void) | null = null;
  postMessage(q: ReviewRequest) {
    this.sent.push(q);
  }
  terminate() {
    this.terminated = true;
  }
  reply(m: ReviewReply) {
    this.onmessage?.({ data: m } as MessageEvent<ReviewReply>);
  }
  crash(message: string) {
    this.onerror?.({ message, preventDefault() {} } as ErrorEvent);
  }
}

function setup() {
  const workers: FakeWorker[] = [];
  const host = new ReviewWorkerHost(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  });
  return { host, workers };
}

const gameReq = { kind: 'game', job: { id: 'g' } } as unknown as ReviewRequest;
const fullReq = { kind: 'practice', id: 'p' } as unknown as ReviewRequest;

function recorder() {
  const log: string[] = [];
  return {
    log,
    h: (tag: string) => ({
      start: () => log.push(`${tag} start`),
      reply: (m: ReviewReply) => log.push(`${tag} ${'progress' in m ? `progress ${m.progress}` : Object.keys(m)[0]}`),
      fail: (e: string) => log.push(`${tag} fail ${e}`),
    }),
  };
}

describe('the review worker host', () => {
  it('runs both tabs’ reviews on one worker, one after the other, each getting its own replies', () => {
    const { host, workers } = setup();
    const r = recorder();
    host.run(gameReq, r.h('game'));
    expect(host.busy).toBe(true);
    host.run(fullReq, r.h('full'));
    expect(workers).toHaveLength(1);
    expect(workers[0]!.sent).toEqual([gameReq]);
    workers[0]!.reply({ progress: 3, turn: 1 });
    workers[0]!.reply({ game: {} as never });
    // the second starts on the same worker once the first has ended
    expect(workers).toHaveLength(1);
    expect(workers[0]!.sent).toEqual([gameReq, fullReq]);
    expect(workers[0]!.terminated).toBe(false);
    workers[0]!.reply({ progress: 1 });
    workers[0]!.reply({ review: {} as never });
    expect(r.log).toEqual(['game start', 'game progress 3', 'game game', 'full start', 'full progress 1', 'full review']);
    expect(host.busy).toBe(false);
    // a review started later (Start again) still uses the same worker
    host.run(gameReq, r.h('again'));
    expect(workers).toHaveLength(1);
  });

  it('Stop on the running review stops its worker; the queued one starts on a fresh worker', () => {
    const { host, workers } = setup();
    const r = recorder();
    const stopGame = host.run(gameReq, r.h('game'));
    host.run(fullReq, r.h('full'));
    stopGame();
    expect(workers[0]!.terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers[1]!.sent).toEqual([fullReq]);
    // a late reply of the stopped worker reaches no one
    workers[0]!.reply({ game: {} as never });
    workers[1]!.reply({ review: {} as never });
    expect(r.log).toEqual(['game start', 'full start', 'full review']);
  });

  it('cancelling a queued review drops it without touching the running one', () => {
    const { host, workers } = setup();
    const r = recorder();
    host.run(gameReq, r.h('game'));
    const stopFull = host.run(fullReq, r.h('full'));
    stopFull();
    workers[0]!.reply({ game: {} as never });
    expect(workers[0]!.sent).toEqual([gameReq]);
    expect(workers[0]!.terminated).toBe(false);
    expect(r.log).toEqual(['game start', 'game game']);
  });

  it('cancelling a finished review does nothing', () => {
    const { host, workers } = setup();
    const r = recorder();
    const stop = host.run(gameReq, r.h('game'));
    workers[0]!.reply({ refused: 'not replayable' });
    stop();
    expect(workers[0]!.terminated).toBe(false);
    expect(r.log).toEqual(['game start', 'game refused']);
  });

  it('a crashed worker fails the running review only; the next one gets a fresh worker', () => {
    const { host, workers } = setup();
    const r = recorder();
    host.run(gameReq, r.h('game'));
    host.run(fullReq, r.h('full'));
    workers[0]!.crash('boom');
    expect(workers[0]!.terminated).toBe(true);
    expect(workers[1]!.sent).toEqual([fullReq]);
    workers[0]!.onmessageerror?.({} as MessageEvent);
    expect(r.log).toEqual(['game start', 'game fail boom', 'full start']);
    workers[1]!.onmessageerror?.({} as MessageEvent);
    expect(r.log.at(-1)).toBe('full fail the review worker sent an unreadable reply');
  });

  it('a worker that cannot be made fails the review with the reason', () => {
    const host = new ReviewWorkerHost(() => {
      throw new Error('no workers here');
    });
    const r = recorder();
    host.run(gameReq, r.h('game'));
    expect(r.log).toEqual(['game fail no workers here']);
    expect(host.busy).toBe(false);
  });

  it('closing the dialog stops everything; the host can start again (effects re-run)', () => {
    const { host, workers } = setup();
    const r = recorder();
    host.run(gameReq, r.h('game'));
    host.run(fullReq, r.h('full'));
    host.dispose();
    expect(workers[0]!.terminated).toBe(true);
    expect(host.busy).toBe(false);
    workers[0]!.reply({ game: {} as never });
    host.run(fullReq, r.h('full2'));
    expect(workers).toHaveLength(2);
    expect(r.log).toEqual(['game start', 'full2 start']);
  });

  it('only the host starts the review worker (no screen makes one of its own)', () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk(path.resolve('src/ui'));
    const starters = files.filter((f) => /new Worker\(new URL\([^)]*review\.worker/.test(readFileSync(f, 'utf8'))).map((f) => path.relative(process.cwd(), f).replace(/\\/g, '/'));
    expect(starters).toEqual(['src/ui/reviewWorkerHost.ts']);
  });
});
