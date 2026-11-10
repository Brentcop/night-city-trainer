import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/engine';
import { RandomAgent } from '../src/ai/random';
import { CARDS } from '../src/engine/cards';
import type { DeckList } from '../src/engine/types';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}

describe('engine smoke', () => {
  it('plays 50 random games to completion', async () => {
    for (let s = 1; s <= 50; s++) {
      const g = Game.create([anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])], [new RandomAgent(s), new RandomAgent(s + 99)], { seed: s, log: false });
      const st = await g.run();
      expect(st.winner).not.toBeNull();
    }
  });
});
