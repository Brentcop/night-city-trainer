// INFO-3: the coach says where its card values come from: this list's own bot matches, figures pooled from other decks,
// or nothing (src/ai/impact.ts impactBasis, src/ai/coach.ts sellWhy / matchupTips).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseDeck, listFingerprint } from '../src/engine/deck';
import { Game } from '../src/engine/engine';
import { impactBasis, topImpactCards } from '../src/ai/impact';
import { COACH_TABLES, matchupTips, sellPlayedOutWhy, sellWhy } from '../src/ai/coach';
import type { Agent } from '../src/engine/types';
import analysisJson from '../src/data/analysis.json';

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

  it("a sell's reason names the bot and simulator version its card values come from (2026-11-24)", () => {
    const run = analysisJson as unknown as { bot: string; manifest: { simVersion: number } };
    expect(COACH_TABLES).toEqual({ bot: run.bot, simVersion: run.manifest.simVersion });
    expect(sellWhy('Sell X', 'own', { bot: 'deep', simVersion: 9 })).toBe(
      "Sell X: one sell a turn is your mana growth, and this is the least valuable card in hand for your deck (by bot-match telemetry on this list: the Deep bot's games, simulator version 9, not the Hard bot the site's ratings use).",
    );
    expect(sellWhy('Sell X', 'pooled', { bot: 'hard', simVersion: 9 })).toBe(
      "Sell X: one sell a turn is your mana growth, and this is the least valuable card in hand for your deck (card values pooled from bot matches of other decks, the Hard bot's games, simulator version 9; this list has none of its own).",
    );
    expect(sellPlayedOutWhy('Sell X', 'own', 3, { bot: 'deep', simVersion: 9 })).toContain("card value (by bot-match telemetry on this list: the Deep bot's games, simulator version 9, not the Hard bot the site's ratings use), selling this one");
    // by default the bundled analysis run's bot is named; without tables the old words
    expect(sellWhy('Sell X', 'own')).toBe(sellWhy('Sell X', 'own', COACH_TABLES));
    expect(sellWhy('Sell X', 'own', null)).toBe('Sell X: one sell a turn is your mana growth, and this is the least valuable card in hand for your deck (by bot-match telemetry on this list).');
    expect(sellWhy('Sell X', 'none', { bot: 'deep', simVersion: 9 })).toBe(sellWhy('Sell X', 'none', null));
  });

  it('no data: no claim', () => {
    expect(impactBasis({ name: 'Nobody', listId: 'none' }, ['not-a-card'])).toBe('none');
    expect(sellWhy('Sell X', 'none')).toBe('Sell X: one sell a turn is your mana growth, and this is the least valuable card in hand for your deck.');
  });

  it('matchup tips name the cards most associated with wins only for a list measured on its own, as an association', () => {
    const idle: Agent = { name: 'idle', decide: async () => [0] } as unknown as Agent;
    const tips = (a: string, b: string) => matchupTips(Game.create([deck(a), deck(b)], [idle, idle], { seed: 1, first: 0, log: false }), 0).join('\n');
    expect(tips(META, OFF_META)).toMatch(/Cards most associated with wins.*an association, not proof/);
    // no causal instruction from a pooled association (COACH-12)
    expect(tips(META, OFF_META)).not.toMatch(/Keep them|game-winners/);
    expect(tips(OFF_META, META)).not.toMatch(/associated with wins/);
  });
});
