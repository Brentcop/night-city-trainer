// Ordering your own pending effects (rule 10.12, ENG-3): asked only of agents that opt in (`choosesOrder`), only
// when the order could matter; everyone else resolves first in, first out.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { parseDeck } from '../src/engine/deck';
import { makeTierBot } from '../src/ai/tiers';
import { reviewGame, ScriptedAgent } from '../src/ai/reviewer';
import { coachAdvises } from '../src/ai/coach';
import { RecordingAgent } from '../src/lib/practiceSession';
import { buildInteraction } from '../src/ui/components/board/interaction';
import type { Agent, Decision } from '../src/engine/types';
import { eddies, equip, setup, spawn, type Hook } from './engine-helpers';

/** setup() with player 0 opted in to ordering (or not). */
function scene(hook: Hook | null = null, opt = true) {
  const { g, agents } = setup([hook, null]);
  if (opt) Object.assign(agents[0], { choosesOrder: true });
  const orders = () => agents[0].log.filter((d) => d.kind === 'order');
  return { g, agents, orders };
}
const last: Hook = (d) => (d.kind === 'order' ? d.options.length - 1 : undefined);

describe('pending order: opt-in', () => {
  it('the player picks which of their effects resolves next; the rival still resolves after them (10.14.1)', async () => {
    const { g, orders } = scene(last);
    const src = spawn(g, 0, 'psycho_squad', 'field');
    const out: string[] = [];
    g.enqueue(1, 'R', async () => void out.push('R'));
    for (const k of ['A', 'B', 'C']) g.enqueue(0, k, async () => void out.push(k), { source: src.uid });
    const rng = g.s.rng;
    await g.resolvePending();
    expect(out).toEqual(['C', 'B', 'A', 'R']);
    const asked = orders();
    expect(asked).toHaveLength(2); // 3 effects, then 2; the last one needs no choice
    expect(asked[0].options.map((o) => o.label)).toEqual(['A', 'B', 'C']);
    expect(asked[0].options.every((o) => o.uid === src.uid && o.key === 'effect')).toBe(true);
    expect(asked[0].tag).toBe('order');
    expect(asked[1].options.map((o) => o.label)).toEqual(['A', 'B']);
    expect(g.s.log.map((e) => e.text).filter((t) => t.startsWith('resolves'))).toEqual(['resolves C first', 'resolves B first']);
    expect(g.s.rng).toBe(rng);
  });

  it('an agent without the flag is never asked: first in, first out', async () => {
    const { g, orders } = scene(last, false);
    const out: string[] = [];
    for (const k of ['A', 'B', 'C']) g.enqueue(0, k, async () => void out.push(k));
    await g.resolvePending();
    expect(out).toEqual(['A', 'B', 'C']);
    expect(orders()).toHaveLength(0);
  });

  it('copies of the same effect are not a choice', async () => {
    const { g, orders } = scene(last);
    const out: number[] = [];
    for (const k of [1, 2]) g.enqueue(0, 'Same', async () => void out.push(k));
    await g.resolvePending();
    expect(out).toEqual([1, 2]);
    expect(orders()).toHaveLength(0);
  });

  it('effects that would do nothing now are not offered (and resolve in queue order)', async () => {
    // V's spend: Netdriver and Rippler on V trigger; the Netdriver on the other Unit becomes pending but does nothing
    const { g, orders } = scene(last);
    for (let i = 0; i < 4; i++) spawn(g, 0, 'psycho_squad', 'deck');
    const v = spawn(g, 0, 'psycho_squad', 'field');
    const other = spawn(g, 0, 'psycho_squad', 'field');
    equip(g, 0, 'netwatch_netdriver', v); // when this Unit is spent, draw 1
    equip(g, 0, 'tetratronic_rippler', v); // when this Unit is spent, you may trash the top card of your deck
    equip(g, 0, 'netwatch_netdriver', other);
    const from = g.s.log.length;
    g.spend(v.uid);
    expect(g.pending).toHaveLength(3);
    await g.resolvePending();
    const asked = orders();
    expect(asked).toHaveLength(1);
    expect(asked[0].options.map((o) => o.label)).toEqual(['NetWatch Netdriver (on Psycho Squad): when spent', 'Tetratronic Rippler (on Psycho Squad): when spent']);
    const lines = g.s.log.slice(from).map((e) => e.text);
    expect(lines.findIndex((t) => t.startsWith('trashes'))).toBeLessThan(lines.findIndex((t) => t.startsWith('draws')));
    expect(lines.filter((t) => t.startsWith('draws'))).toHaveLength(1);
  });

  it("Go Solo paying with itself: the player may resolve the Legend's {Play} before its spend trigger", async () => {
    const pickPlay: Hook = (d) => (d.kind === 'order' ? d.options.findIndex((o) => o.label.endsWith('{Play}')) : undefined);
    const { g, orders } = scene(pickPlay);
    for (const u of [...g.P(0).legends]) g.move(u, 'removed');
    const adam = spawn(g, 0, 'adam_smasher_ender_of_legends', 'legends');
    equip(g, 0, 'netwatch_netdriver', adam);
    spawn(g, 1, 'psycho_squad', 'field');
    for (let i = 0; i < 3; i++) spawn(g, 0, 'psycho_squad', 'deck');
    eddies(g, 0, 8);
    const from = g.s.log.length;
    await g.doAction(0, { type: 'goSolo', uid: adam.uid });
    await g.resolvePending();
    expect(orders()).toHaveLength(1);
    const lines = g.s.log.slice(from).map((e) => e.text);
    expect(lines.findIndex((t) => /is defeated/.test(t))).toBeLessThan(lines.findIndex((t) => t.startsWith('draws 1')));
  });

  it('the coach never advises on it; the board shows each effect as a button and its source card as clickable', async () => {
    const { g, orders } = scene();
    const a = spawn(g, 0, 'psycho_squad', 'field');
    const b = spawn(g, 0, 'mox_inciters', 'field');
    g.enqueue(0, 'A', async () => {}, { source: a.uid });
    g.enqueue(0, 'B1', async () => {}, { source: b.uid });
    g.enqueue(0, 'B2', async () => {}, { source: b.uid });
    await g.resolvePending();
    const d = orders()[0];
    expect(coachAdvises(d)).toBe(false);
    const ix = buildInteraction(g, d);
    expect(ix.buttonOpts).toEqual([0, 1, 2]);
    expect(ix.direct.get(a.uid)).toBe(0);
    expect(ix.direct.has(b.uid)).toBe(false); // two of the effects come from it: use the buttons
  });
});

// ---------------------------------------------------------------- whole games and replays

const deck = (f: string) => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;
const decks = [deck('meta-gry-trauma-team.txt'), deck('meta-rrb-wakako-midrange.txt')] as [ReturnType<typeof deck>, ReturnType<typeof deck>];

/** A seat that opts in to ordering and plays like an easy bot otherwise; `pick` answers the 'order' decisions. */
class Orderer implements Agent {
  name = 'you';
  choosesOrder = true;
  asked = 0;
  reordered = 0;
  private brain = makeTierBot('easy', 9);
  constructor(private pick: (d: Decision) => number) {}
  async decide(g: Game, d: Decision) {
    if (d.kind === 'order') {
      this.asked++;
      const i = this.pick(d);
      if (i !== 0) this.reordered++;
      return [i];
    }
    return this.brain.decide(g, d);
  }
}

async function replay(choices: number[][], orderChoice: boolean, seed: number) {
  let fallbacks = 0;
  const easy = makeTierBot('easy', 1);
  const fb: Agent = { name: 'fb', decide: (g, d) => (fallbacks++, easy.decide(g, d)) };
  const st = await Game.create(decks, [new ScriptedAgent('you', choices, fb, false, orderChoice), makeTierBot('medium', 4242, 'Bot')], { seed, first: 0 }).run();
  return { st, fallbacks };
}

describe('pending order: whole games', () => {
  it('opting in and always keeping the queue order plays exactly like not opting in (bots unchanged)', async () => {
    let asked = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      const keep = new Orderer(() => 0);
      const a = await Game.create(decks, [keep, makeTierBot('medium', 4242, 'Bot')], { seed, first: 0 }).run();
      const b = await Game.create(decks, [makeTierBot('easy', 9), makeTierBot('medium', 4242, 'Bot')], { seed, first: 0 }).run();
      expect(a.log).toEqual(b.log);
      expect(a.rng).toBe(b.rng);
      asked += keep.asked;
    }
    expect(asked).toBeGreaterThan(0);
  }, 120_000);

  it('a game recorded with a non-default order replays identically from the recorded choices (and through the reviewer)', async () => {
    let checked = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      const human = new Orderer((d) => d.options.length - 1);
      const choices: number[][] = [];
      const rec = new RecordingAgent(human, choices);
      expect(rec.choosesOrder).toBe(true);
      const a = await Game.create(decks, [rec, makeTierBot('medium', 4242, 'Bot')], { seed, first: 0 }).run();
      if (!human.reordered) continue;
      const { st, fallbacks } = await replay(choices, true, seed);
      expect(fallbacks).toBe(0);
      expect(st.log).toEqual(a.log);
      const r = await reviewGame(
        { decks, seed, first: 0, agents: [new ScriptedAgent('you', choices, makeTierBot('easy', 1), false, true), makeTierBot('medium', 4242, 'Bot')] },
        { rollouts: 1, screen: 1, seats: [0], shouldStop: () => true },
      );
      expect(r.winner).toBe(a.winner);
      expect(r.turns).toBe(a.turn);
      checked++;
      break;
    }
    expect(checked).toBe(1);
  }, 180_000);

  it('a game recorded without order choices (older replays) still replays identically', async () => {
    const choices: number[][] = [];
    const rec = new RecordingAgent(makeTierBot('easy', 9), choices);
    expect(rec.choosesOrder).toBeUndefined();
    const a = await Game.create(decks, [rec, makeTierBot('medium', 4242, 'Bot')], { seed: 3, first: 0 }).run();
    const { st, fallbacks } = await replay(choices, false, 3);
    expect(fallbacks).toBe(0);
    expect(st.log).toEqual(a.log);
  }, 60_000);
});
