import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import { makeTierBot } from '../src/ai/tiers';
import { reviewGame, ScriptedAgent, summarizeSeat } from '../src/ai/reviewer';
import type { Agent, Decision, DeckList } from '../src/engine/types';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];

class Recorder implements Agent {
  name = 'rec';
  choices: number[][] = [];
  constructor(private inner: Agent) {}
  async decide(g: Game, d: Decision) {
    const r = await this.inner.decide(g, d);
    this.choices.push([...r]);
    return r;
  }
}

describe('match reviewer', () => {
  it('replays a recorded human game exactly from its choices', async () => {
    const rec = new Recorder(makeTierBot('easy', 5));
    const a = await Game.create(decks, [rec, makeTierBot('easy', 6)], { seed: 42, log: false }).run();
    const b = await Game.create(decks, [new ScriptedAgent('you', rec.choices, makeTierBot('easy', 1)), makeTierBot('easy', 6)], { seed: 42, log: false }).run();
    expect(b.winner).toBe(a.winner);
    expect(b.turn).toBe(a.turn);
  });

  it('reviewing a game does not change how it plays out', async () => {
    const plain = await Game.create(decks, [makeTierBot('easy', 11), makeTierBot('easy', 12)], { seed: 7, log: false }).run();
    const r = await reviewGame({ decks, seed: 7, agents: [makeTierBot('easy', 11), makeTierBot('easy', 12)] }, { rollouts: 1, screen: 2 });
    expect(r.winner).toBe(plain.winner);
    expect(r.turns).toBe(plain.turn);
    expect(r.decisions.length).toBeGreaterThan(0);
    for (const d of r.decisions) expect(d.regret).toBeGreaterThanOrEqual(0);
    expect(r.seats).toHaveLength(2);
  }, 60_000);

  it('summarizes accuracy and blunders', () => {
    const s = summarizeSeat(0, 'A', 'easy', [
      { i: 0, turn: 1, player: 0, category: 'sell', options: 3, chosen: 'x', best: 'x', regret: 0, gameLosing: false },
      { i: 1, turn: 1, player: 0, category: 'unit', options: 3, chosen: 'y', best: 'z', regret: 30, gameLosing: false },
    ]);
    expect(s.accuracy).toBe(0.5);
    expect(s.blunders).toBe(1);
    expect(s.byCategory.unit?.regret).toBe(30);
  });
});
