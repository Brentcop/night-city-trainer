import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/engine';
import { RandomAgent } from '../src/ai/random';
import { CARDS } from '../src/engine/cards';
import type { Agent, Decision, DeckList } from '../src/engine/types';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}

const COLORS = ['Red', 'Blue', 'Green', 'Yellow'];

/** Checks at every decision that the state is plain data, and at action/reaction points that the game clones. */
function checked(a: Agent, stats: { decisions: number }): Agent {
  return {
    name: a.name,
    decide: async (g: Game, d: Decision) => {
      stats.decisions++;
      structuredClone(g.s);
      if (d.kind === 'action' || d.kind === 'reaction') g.clone([a, a]);
      return a.decide(g, d);
    },
  };
}

async function fingerprint(a: DeckList, b: DeckList, seed: number, stats: { decisions: number }) {
  const g = Game.create([a, b], [checked(new RandomAgent(seed), stats), checked(new RandomAgent(seed + 99), stats)], { seed, log: true });
  const st = await g.run();
  return JSON.stringify([st.winner, st.winReason, st.turn, st.rng, st.log, st.stats]);
}

describe('engine smoke', () => {
  it('same seed, same game; the state clones at every decision (20 random multi-colour games)', async () => {
    const stats = { decisions: 0 };
    for (let s = 1; s <= 20; s++) {
      const a = anyDeck('A', [COLORS[s % 4], COLORS[(s + 1) % 4]]);
      const b = anyDeck('B', [COLORS[(s + 2) % 4], COLORS[(s * 3) % 4]]);
      const first = await fingerprint(a, b, s, stats);
      const second = await fingerprint(a, b, s, stats);
      expect(second).toBe(first);
    }
    expect(stats.decisions).toBeGreaterThan(1000);
    // about 2 s alone, but close to the 5 s default when the whole suite runs in parallel
  }, 20_000);

  it('plays 30 random all-Yellow games to completion', async () => {
    const stats = { decisions: 0 };
    for (let s = 1; s <= 30; s++) {
      const g = Game.create([anyDeck('A', ['Yellow']), anyDeck('B', ['Yellow'])], [checked(new RandomAgent(s), stats), checked(new RandomAgent(s + 7), stats)], { seed: s, log: false });
      const st = await g.run();
      expect(st.winner).not.toBeNull();
    }
  }, 20_000);

  it('plays 50 random games to completion', async () => {
    for (let s = 1; s <= 50; s++) {
      const g = Game.create([anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])], [new RandomAgent(s), new RandomAgent(s + 99)], { seed: s, log: false });
      const st = await g.run();
      expect(st.winner).not.toBeNull();
    }
  }, 20_000);
});
