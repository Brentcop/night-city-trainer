// The Play page's coach runs in a worker from a serialised position: it must give exactly the advice advise() gives on
// the live game, and fall back to the main thread when the worker fails.
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Game } from '../src/engine/engine';
import { parseDeck } from '../src/engine/deck';
import { makeTierBot } from '../src/ai/tiers';
import { advise, adviseRequest, coachAdvises, coachRequest, type Advice } from '../src/ai/coach';
import { clearCoachAnswers, CoachClient } from '../src/ui/useCoach';
import type { Agent, Decision, DeckList } from '../src/engine/types';

const deck = (f: string): DeckList => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;
const decks: [DeckList, DeckList] = [deck('meta-rrb-wakako-midrange.txt'), deck('meta-bbg-cunningham-econ.txt')];

type Outcome = { advice: Advice } | { error: string };
const outcome = (p: Promise<Advice>): Promise<Outcome> => p.then((advice) => ({ advice }), (e) => ({ error: String((e as Error).message) }));

/** Plays seat 0 with a bot, and at the chosen decisions records the coach's view both ways. */
class Sampler implements Agent {
  name = 'Sampler';
  n = 0;
  pairs: { d: Decision; live: Outcome; worker: Outcome }[] = [];
  reqs: { g: Game; d: Decision; live: Outcome }[] = [];
  constructor(private brain: Agent, private at: Set<number>) {}
  async decide(g: Game, d: Decision): Promise<number[]> {
    if (coachAdvises(d) && this.at.has(this.n++)) {
      // as postMessage does: the request crosses as a structured clone
      const req = structuredClone(coachRequest(g, d));
      const live = await outcome(advise(g, d));
      const worker = await outcome(adviseRequest(structuredClone(req)));
      this.pairs.push({ d, live, worker });
      // a frozen copy of this position (the live game moves on)
      const frozen = new Game(structuredClone(req.state), [this, this]);
      frozen.pending = req.pending.map((x) => ({ ...x, run: async () => undefined }));
      this.reqs.push({ g: frozen, d: req.decision, live });
    }
    return this.brain.decide(g, d);
  }
}

async function sample(seed: number, at: number[]) {
  const s = new Sampler(makeTierBot('easy', seed), new Set(at));
  const g = Game.create(decks, [s, makeTierBot('easy', seed + 1)], { seed, first: 0, maxTurns: 8 });
  await g.run();
  return s;
}

describe('coach worker entry', () => {
  // each test starts with no remembered answers (src/ui/useCoach.ts keeps them for the whole module)
  beforeEach(() => clearCoachAnswers());

  it('gives exactly the advice advise() gives on the live game', async () => {
    const s = await sample(11, [0, 1, 3, 6, 10, 15, 21]);
    expect(s.pairs.length).toBeGreaterThanOrEqual(5);
    expect(s.pairs.some((p) => p.d.kind === 'action')).toBe(true);
    expect(s.pairs.filter((p) => 'advice' in p.live && p.live.advice.why).length).toBeGreaterThanOrEqual(3);
    for (const p of s.pairs) expect(p.worker).toEqual(p.live);
  }, 60_000);

  it('snapshots the position and leaves the live game untouched', async () => {
    const g = Game.create(decks, [makeTierBot('easy', 3), makeTierBot('easy', 4)], { seed: 3, first: 1, maxTurns: 4 });
    const before = { log: g.s.log, trace: g.s.trace };
    const req = coachRequest(g, { player: 0, kind: 'yesno', prompt: '?', options: [{ label: 'Yes' }, { label: 'No' }], min: 1, max: 1 } as Decision);
    expect(req.state.log).toEqual([]);
    expect(g.s.log).toBe(before.log);
    expect(req.state).not.toBe(g.s);
    expect(req.state.players).toEqual(g.s.players);
  });

  it('falls back to the main thread when the worker cannot start, or crashes', async () => {
    const s = await sample(5, [4, 8]);
    expect(s.reqs.length).toBe(2);
    const noStart = new CoachClient(() => {
      throw new Error('no workers here');
    });
    for (const r of s.reqs) expect(await outcome(noStart.advise(r.g, r.d))).toEqual(r.live);
    expect(noStart.broken).toBe(true);

    // a worker that loads and then fails with an error event (the answers just computed are forgotten first: a known
    // position would be answered from memory without starting the worker)
    clearCoachAnswers();
    const fake = { onmessage: null, onerror: null as null | ((e: unknown) => void), onmessageerror: null, terminate() {}, postMessage() {
      setTimeout(() => fake.onerror?.({ preventDefault() {} }), 0);
    } };
    const crashy = new CoachClient(() => fake as unknown as Worker);
    expect(await outcome(crashy.advise(s.reqs[0].g, s.reqs[0].d))).toEqual(s.reqs[0].live);
    expect(crashy.broken).toBe(true);
  }, 60_000);

  it('drops a queued request when a newer one arrives', async () => {
    const posted: number[] = [];
    const fake = {
      onmessage: null as null | ((e: { data: unknown }) => void), onerror: null, onmessageerror: null, terminate() {},
      postMessage(m: { id: number }) {
        posted.push(m.id);
        setTimeout(() => fake.onmessage?.({ data: { id: m.id, advice: { index: m.id, why: '', alternatives: [] } } }), 5);
      },
    };
    const c = new CoachClient(() => fake as unknown as Worker);
    const g = Game.create(decks, [makeTierBot('easy', 1), makeTierBot('easy', 2)], { seed: 1, first: 0 });
    const d = { player: 0, kind: 'yesno', prompt: '?', options: [{ label: 'Yes' }, { label: 'No' }], min: 1, max: 1 } as Decision;
    const a = c.advise(g, d);
    const b = outcome(c.advise(g, d));
    const cc = c.advise(g, d);
    expect((await a).index).toBe(1);
    expect(await b).toEqual({ error: 'superseded' });
    expect((await cc).index).toBe(3);
    expect(posted).toEqual([1, 3]);
    c.dispose();
    await expect(c.advise(g, d)).rejects.toThrow('coach closed');
  });
});
