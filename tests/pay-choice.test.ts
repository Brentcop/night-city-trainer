// Choosing which Eddies / Legends pay a cost (rules 5.7.2, 11.11.1): asked only of agents that opt in.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import { makeTierBot } from '../src/ai/tiers';
import { reviewGame, ScriptedAgent } from '../src/ai/reviewer';
import { coachAdvises } from '../src/ai/coach';
import { RecordingAgent } from '../src/lib/practiceSession';
import { buildInteraction } from '../src/ui/components/board/interaction';
import type { Agent, Decision, DeckList, PlayerId } from '../src/engine/types';
import { eddies, setup, spawn, type Hook } from './engine-helpers';

/** setup() with player 0 opted in to payment choices (or not). Its Legends start spent and face-down. */
function scene(hook: Hook | null = null, opt = true) {
  const { g, agents } = setup([hook, null]);
  if (opt) Object.assign(agents[0], { choosesPayment: true });
  const legends = g.P(0).legends.map((u) => g.c(u));
  const pays = () => agents[0].log.filter((d) => d.kind === 'pay');
  return { g, agents, legends, pays };
}
const readyCount = (g: Game, p: PlayerId) => g.payables(p).length;

describe('payment choice: opt-in', () => {
  it('an agent without the flag is never asked, even when the choice would be real', async () => {
    const { g, legends, pays } = scene(null, false);
    eddies(g, 0, 2);
    legends[0].spent = false;
    expect(await g.pay(0, 1)).toBe(true);
    expect(pays()).toHaveLength(0);
    expect(legends[0].spent).toBe(false); // Eddies first, as always
    expect(readyCount(g, 0)).toBe(2);
  });

  it('is not asked when only Eddies can pay, or when every source must be spent', async () => {
    const a = scene();
    eddies(a.g, 0, 3);
    expect(await a.g.pay(0, 2)).toBe(true);
    expect(a.pays()).toHaveLength(0);

    const b = scene();
    eddies(b.g, 0, 1);
    b.legends[0].spent = false;
    expect(await b.g.pay(0, 2)).toBe(true);
    expect(b.pays()).toHaveLength(0);
    expect(b.legends[0].spent).toBe(true);
  });

  it('choosing a Legend spends it and leaves the Eddies ready; labels never name a face-down Legend', async () => {
    const { g, legends, pays } = scene((d) => (d.kind === 'pay' ? d.options.findIndex((o) => o.key === 'legend') : undefined));
    eddies(g, 0, 2);
    legends[1].spent = false;
    expect(legends[1].faceUp).toBe(false);
    expect(await g.pay(0, 1, [], 'Play Something')).toBe(true);
    const asked = pays();
    expect(asked).toHaveLength(1);
    const d = asked[0];
    expect(d.prompt).toBe('Play Something: pay €$ 1 of 1 — spend:');
    expect(d.options.map((o) => o.label)).toEqual(['an Eddie (2 ready)', 'face-down Legend (slot 2)']);
    expect(d.options[1].uid).toBe(legends[1].uid);
    for (const o of d.options) expect(o.label).not.toContain(g.name(legends[1]));
    expect(legends[1].spent).toBe(true);
    expect(g.P(0).eddies.every((u) => !g.c(u).spent)).toBe(true);
  });

  it('choosing an Eddie leaves the Legends ready', async () => {
    const { g, legends, pays } = scene((d) => (d.kind === 'pay' ? d.options.findIndex((o) => o.key === 'eddie') : undefined));
    eddies(g, 0, 1);
    legends[0].spent = false;
    legends[2].spent = false;
    expect(await g.pay(0, 1)).toBe(true);
    expect(pays()).toHaveLength(1);
    expect(legends[0].spent || legends[2].spent).toBe(false);
    expect(g.P(0).eddies.every((u) => g.c(u).spent)).toBe(true);
  });

  it('the first option is what automatic payment would have spent', async () => {
    const run = async (opt: boolean) => {
      const sc = scene(null, opt);
      // a face-up Legend that can pay, and a face-down one: the automatic rule prefers the face-down one
      const up = sc.legends[0];
      up.faceUp = true;
      up.spent = false;
      sc.legends[1].spent = false;
      sc.legends[1].faceUp = false;
      const before = sc.legends.filter((c) => !c.spent).map((c) => c.uid);
      expect(await sc.g.pay(0, 1)).toBe(true);
      return { spent: before.filter((u) => sc.g.c(u).spent), asked: sc.pays(), upName: sc.g.name(up) };
    };
    const auto = await run(false);
    const manual = await run(true);
    expect(auto.spent).toHaveLength(1);
    expect(manual.spent).toEqual(auto.spent);
    expect(manual.asked).toHaveLength(1);
    expect(manual.asked[0].options[0].uid).toBe(auto.spent[0]);
    expect(manual.asked[0].options[1].label).toBe(manual.upName); // face-up: named
  });

  it('paying 2 asks twice and the same Legend cannot be picked twice', async () => {
    const { g, legends, pays } = scene((d) => (d.kind === 'pay' ? d.options.findIndex((o) => o.key === 'legend') : undefined));
    eddies(g, 0, 1);
    legends[0].spent = false;
    legends[1].spent = false;
    expect(await g.pay(0, 2)).toBe(true);
    const asked = pays();
    expect(asked).toHaveLength(2);
    expect(asked[0].options).toHaveLength(3);
    expect(asked[1].options.map((o) => o.uid)).not.toContain(legends[0].uid);
    expect(asked[1].prompt).toContain('pay €$ 2 of 2');
    expect(legends[0].spent && legends[1].spent).toBe(true);
    expect(g.c(g.P(0).eddies[0]).spent).toBe(false);
  });

  it('keeps exclude (Go Solo never pays for itself)', async () => {
    const { g, legends, pays } = scene();
    eddies(g, 0, 1);
    legends[0].spent = false;
    expect(await g.pay(0, 1, [legends[0].uid])).toBe(true);
    expect(pays()).toHaveLength(0);
    expect(legends[0].spent).toBe(false);
  });

  it('Call a Legend as a reaction asks for the payment', async () => {
    const { g, legends, pays } = scene((d) => (d.kind === 'pay' ? d.options.findIndex((o) => o.key === 'legend') : undefined));
    g.s.active = 1;
    const att = spawn(g, 1, 'psycho_squad', 'field');
    g.s.attack = { attacker: att.uid, attackerPlayer: 1, targetUnit: null, targetGigs: 0, step: 'react', ended: false };
    eddies(g, 0, 1);
    legends[0].spent = false;
    legends[1].spent = false;
    const call = g.legalReactions(0).find((r) => r.type === 'call' && r.uid === legends[1].uid);
    expect(call).toBeDefined();
    await g.doReaction(0, call!);
    const asked = pays();
    expect(asked).toHaveLength(1);
    expect(asked[0].prompt).toMatch(/^Call .*: pay €\$ 1 of 1/);
    expect(legends[1].faceUp).toBe(true);
    expect(g.c(g.P(0).eddies[0]).spent).toBe(false);
    expect(legends[0].spent).toBe(true);
  });

  it('the coach never advises on a pay decision; the board shows every source as a button', async () => {
    const { g, legends, pays } = scene();
    eddies(g, 0, 1);
    legends[0].spent = false;
    await g.pay(0, 1);
    const d = pays()[0];
    expect(coachAdvises(d)).toBe(false);
    const ix = buildInteraction(g, d);
    expect(ix.buttonOpts).toEqual([0, 1]);
    expect(ix.direct.get(legends[0].uid)).toBe(1);
    expect(ix.cardOpts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- replays

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];

/** A "human" that opts in and pays with the last source offered (the opposite of the automatic rule). */
class ContraryPayer implements Agent {
  name = 'you';
  choosesPayment = true;
  pays = 0;
  private brain = makeTierBot('easy', 9);
  async decide(g: Game, d: Decision) {
    if (d.kind === 'pay') {
      this.pays++;
      return [d.options.length - 1];
    }
    return this.brain.decide(g, d);
  }
}

async function replay(choices: number[][], payChoice: boolean, seed: number) {
  let fallbacks = 0;
  const easy = makeTierBot('easy', 1);
  const fb: Agent = { name: 'fb', decide: (g, d) => (fallbacks++, easy.decide(g, d)) };
  const st = await Game.create(decks, [new ScriptedAgent('you', choices, fb, payChoice), makeTierBot('medium', 4242, 'Bot')], { seed, first: 0 }).run();
  return { st, fallbacks };
}

describe('payment choice: recorded games', () => {
  it('a game recorded with payment choices replays identically (and through the reviewer)', async () => {
    let checked = 0;
    for (const seed of [3, 5, 8, 13]) {
      const human = new ContraryPayer();
      const choices: number[][] = [];
      const rec = new RecordingAgent(human, choices);
      expect(rec.choosesPayment).toBe(true);
      const a = await Game.create(decks, [rec, makeTierBot('medium', 4242, 'Bot')], { seed, first: 0 }).run();
      if (!human.pays) continue;
      const { st, fallbacks } = await replay(choices, true, seed);
      expect(fallbacks).toBe(0);
      expect(st.log).toEqual(a.log);
      const r = await reviewGame(
        { decks, seed, first: 0, agents: [new ScriptedAgent('you', choices, makeTierBot('easy', 1), true), makeTierBot('medium', 4242, 'Bot')] },
        { rollouts: 1, screen: 1, seats: [0], shouldStop: () => true },
      );
      expect(r.winner).toBe(a.winner);
      expect(r.turns).toBe(a.turn);
      checked++;
      break;
    }
    expect(checked).toBe(1);
  }, 120_000);

  it('a game recorded without payment choices (older replays) still replays identically', async () => {
    const choices: number[][] = [];
    const rec = new RecordingAgent(makeTierBot('easy', 9), choices);
    expect(rec.choosesPayment).toBeUndefined();
    const a = await Game.create(decks, [rec, makeTierBot('medium', 4242, 'Bot')], { seed: 3, first: 0 }).run();
    const { st, fallbacks } = await replay(choices, false, 3);
    expect(fallbacks).toBe(0);
    expect(st.log).toEqual(a.log);
  }, 60_000);
});
