// A small pool of game workers for the browser. play() queues a game and resolves with its result.
import type { GameJob, GameRec, PlayGame } from '../lib/tournament';

export const defaultThreads = () => Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));

export class GamePool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: { id: number; job: GameJob }[] = [];
  private waiting = new Map<number, { res: (r: GameRec) => void; rej: (e: Error) => void }>();
  private seq = 0;

  constructor(size = defaultThreads()) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('./game.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<{ id: number; rec?: GameRec; error?: string }>) => {
        const p = this.waiting.get(e.data.id);
        this.waiting.delete(e.data.id);
        if (e.data.rec) p?.res(e.data.rec);
        else p?.rej(new Error(e.data.error));
        this.idle.push(w);
        this.pump();
      };
      this.workers.push(w);
      this.idle.push(w);
    }
  }
  get size() {
    return this.workers.length;
  }
  play: PlayGame = (job) =>
    new Promise((res, rej) => {
      const id = ++this.seq;
      this.waiting.set(id, { res, rej });
      this.queue.push({ id, job });
      this.pump();
    });
  private pump() {
    while (this.idle.length && this.queue.length) this.idle.pop()!.postMessage(this.queue.shift()!);
  }
  /** Stop everything; queued and running games reject with 'stopped'. */
  terminate() {
    this.workers.forEach((w) => w.terminate());
    this.waiting.forEach((p) => p.rej(new Error('stopped')));
    this.workers = [];
    this.idle = [];
    this.queue = [];
    this.waiting.clear();
  }
}
