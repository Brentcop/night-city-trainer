// INFO-3: the coach says where its card values come from: this list's own bot matches, figures pooled from other decks,
// or nothing (src/ai/impact.ts impactBasis, src/ai/coach.ts sellWhy / matchupTips).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseDeck, listFingerprint } from '../src/engine/deck';
import { Game } from '../src/engine/engine';
import { impactBasis, topImpactCards } from '../src/ai/impact';
import { matchupTips, sellWhy } from '../src/ai/coach';
import type { Agent } from '../src/engine/types';

const deck = (f: string) => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;
const ref = (f: string) => {
  const d = deck(f);
  return { name: d.name, listId: listFingerprint(d) };
};
const META = 'meta-bbg-cunningham-econ.txt';
const OFF_META = 'BBB-running-and-dancing.txt';

describe('coach wording about card impact', () => {
  it('a meta list has telemetry of its own', () => {
    const d = deck(META);
    expect(impactBasis(ref(META), [...d.main])).toBe('own');
    expect(topImpactCards(ref(META)).length).toBeGreaterThan(0);
    expect(sellWhy('Sell X', 'own')).toMatch(/by bot-match telemetry on this list/);
  });

  it('a list without an entry of its own: the figure is pooled from other decks', () => {
    const d = deck(OFF_META);
    const ids = [...d.main];
    expect(impactBasis(ref(OFF_META), ids)).toBe('pooled');
    expect(topImpactCards(ref(OFF_META))).toEqual([]);
    const why = sellWhy('Sell X', 'pooled');
    expect(why).toMatch(/pooled from bot matches of other decks/);
    expect(why).not.toMatch(/telemetry/);
  });

  it('no data: no claim', () => {
    expect(impactBasis({ name: 'Nobody', listId: 'none' }, ['not-a-card'])).toBe('none');
    expect(sellWhy('Sell X', 'none')).toBe('Sell X: one sell a turn is your mana growth, and this is the least valuable card in hand for your deck.');
  });

  it('matchup tips name game-winners only for a list measured on its own', () => {
    const idle: Agent = { name: 'idle', decide: async () => [0] } as unknown as Agent;
    const tips = (a: string, b: string) => matchupTips(Game.create([deck(a), deck(b)], [idle, idle], { seed: 1, first: 0, log: false }), 0).join('\n');
    expect(tips(META, OFF_META)).toMatch(/game-winners/);
    expect(tips(OFF_META, META)).not.toMatch(/game-winners/);
  });
});
