// Bot-level guarantees: same seed → same game for every tier, the breeder is legal and reproducible, and the
// precomputed Gig-plan vectors match the card-text patterns they replace.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import { parseDeck, validateDeck } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { makeTierBot } from '../src/ai/tiers';
import { breedSeason } from '../src/ai/breeder';
import { gigPlanOf, type GigPlan } from '../src/ai/knowledge';

const meta: DeckList[] = readdirSync('data/decks')
  .filter((f) => f.startsWith('meta-') && f.endsWith('.txt'))
  .sort()
  .map((f) => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck);

async function play(level: string, seed: number) {
  const s = await Game.create([meta[0], meta[3]], [makeTierBot(level, seed), makeTierBot(level, seed + 7777)], { seed, first: 1, log: false }).run();
  const { log: _log, ...rest } = s;
  return { winner: s.winner, turns: s.turn, state: JSON.stringify(rest) };
}

describe('determinism', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    it(`${level}: the same seed plays the same game`, async () => {
      const a = await play(level, 31);
      const b = await play(level, 31);
      expect(b.winner).toBe(a.winner);
      expect(b.turns).toBe(a.turns);
      expect(b.state).toBe(a.state);
    }, 120_000);
  }
});

describe('deck breeder', () => {
  const input = (seed: number) => ({
    ranked: meta.map((deck, k) => ({ deck, wr: 0.6 - k * 0.02 })),
    impact: {},
    seenTriples: new Set<string>(),
    seed,
    h2h: (a: string, b: string) => ({ w: (a.length * 7 + b.length) % 5, g: 6 }),
  });
  it('breeds legal decks', () => {
    const out = breedSeason(1, input(5));
    expect(out.length).toBeGreaterThan(4);
    for (const b of out) {
      expect(validateDeck(b.deck)).toEqual([]);
      expect(b.deck.main).toHaveLength(40);
      expect(new Set(b.deck.legends.map((id) => CARDS.find((c) => c.id === id)!.name)).size).toBe(3);
    }
  });
  it('the same seed breeds the same decks', () => {
    expect(breedSeason(1, input(5))).toEqual(breedSeason(1, input(5)));
    expect(JSON.stringify(breedSeason(1, input(6)))).not.toBe(JSON.stringify(breedSeason(1, input(5))));
  });
});

describe('Gig plans', () => {
  // the card-text patterns the precomputed plan vectors replace (knowledge.ts PLAN_PATTERNS)
  const PATTERNS: [keyof GigPlan, RegExp][] = [
    ['high', /8\+|Increase a Gig|max Gig/i],
    ['low', /min Gig|Decrease a Gig/i],
    ['pairs', /value-pair/i],
    ['diverse', /different values|not shared by a friendly Gig/i],
    ['parity', /even value|odd value|even number|is an even/i],
    ['d20', /d20/i],
  ];
  const reference = (ids: string[]): GigPlan => {
    const plan: GigPlan = { high: 0, low: 0, pairs: 0, diverse: 0, parity: 0, d20: 0 };
    for (const id of ids) {
      const c = CARDS.find((x) => x.id === id);
      if (!c) continue;
      for (const [k, re] of PATTERNS) if (re.test(c.text)) plan[k] += 1;
    }
    const n = Math.max(1, ids.length) / 10;
    for (const k of Object.keys(plan) as (keyof GigPlan)[]) plan[k] = Math.min(1.5, plan[k] / n);
    return plan;
  };
  it('match the regex version exactly, card by card and for whole decks', () => {
    for (const c of CARDS) expect(gigPlanOf([c.id])).toEqual(reference([c.id]));
    for (const d of meta) {
      const ids = [...d.legends, ...d.main];
      expect(gigPlanOf(ids)).toEqual(reference(ids));
    }
    expect(gigPlanOf(['not_a_card'])).toEqual(reference(['not_a_card']));
  });
});
