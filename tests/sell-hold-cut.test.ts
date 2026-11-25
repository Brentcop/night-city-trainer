// REVIEW_2026-11-24 C.4 (B3: scarce package pieces sold), phase 1, opt-in: the sell comparison values the seller's hand
// where its play-out stops by the hand's hold credit (HeuristicOptions.sellHoldCut), and the hold credit counts the trash
// for packages whose `online` condition reads the trash (packageFacts' `readTrash`). Off (the default) every bot and the
// coach are exactly as before: no `trashFuel` in any fact, the same sell comparison values.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { parseDeck } from '../src/engine/deck';
import type { Action, Decision, DeckList, PlayerId } from '../src/engine/types';
import { availableOf, handHoldCredit, holdCredit, packageFacts, seatPackages, trashReadsOf } from '../src/ai/packages';
import { SYNERGY_BY_ID } from '../src/content/synergies/index';
import { HeuristicAgent } from '../src/ai/heuristic';
import { BEST_PROFILES } from '../src/ai/archetype';
import { fromSpec, HARD_SPEC } from '../scripts/agent-spec';
import { eddies, fillerDeck, Scripted } from './engine-helpers';

const deck = (f: string) => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;
/** Ripbecca (YYY): built around The Relic loop (Relic + Adam Smasher: Metal Over Meat) and Units in the trash, among others. */
const RIPBECCA = deck('YYY-ripbecca.txt');
const RELIC = 'the_relic_experimental_biochip';
const SMASHER = 'adam_smasher_metal_over_meat';

/** Seat 0 plays `list` in its main phase on turn 3, both hands put back in the decks; the rival plays plain Units. */
function game(list: DeckList, seed = 5): Game {
  const g = Game.create([list, fillerDeck('B')], [new Scripted(), new Scripted()], { seed, first: 0 });
  g.s.turn = 3;
  g.s.phase = 'main';
  g.s.active = 0;
  for (const p of [0, 1] as PlayerId[]) for (const u of [...g.P(p).hand]) g.move(u, 'deck');
  return g;
}
/** Move one copy of a card from p's deck to a zone. */
function take(g: Game, id: string, zone: 'hand' | 'trash' | 'eddies', p: PlayerId = 0) {
  const u = g.P(p).deck.find((x) => g.c(x).defId === id);
  if (u === undefined) throw new Error(`no ${id} left in the deck`);
  g.move(u, zone);
  return g.c(u);
}
const relicLoop = (g: Game, readTrash: boolean) => packageFacts(g, 0, seatPackages(g, 0), { readTrash }).find((f) => f.pkg.id === 'relic-loop')!;

describe('what a package condition reads in the trash', () => {
  it('is read off the online condition: a card type, or cards by id; none for a package that does not look there', () => {
    expect(trashReadsOf(SYNERGY_BY_ID['units-in-trash'].online)).toEqual({ types: ['Unit'], ids: [] });
    expect(trashReadsOf(SYNERGY_BY_ID['relic-loop'].online)).toEqual({ types: [], ids: [SMASHER] });
    // nested inside an `any`: an engine used with a Program played that turn or 2+ Programs in the trash
    expect(trashReadsOf(SYNERGY_BY_ID['program-fuel'].online)).toEqual({ types: ['Program'], ids: [] });
    expect(trashReadsOf(SYNERGY_BY_ID['min-gig'].online)).toBeNull();
    const pk = seatPackages(game(RIPBECCA), 0);
    expect(pk.find((x) => x.id === 'relic-loop')!.trashReads).toEqual({ types: [], ids: [SMASHER] });
    expect(pk.find((x) => x.id === 'gig-spread')!.trashReads).toBeNull();
  });
});

describe('availableOf with the trash (readTrash)', () => {
  it('off (the default): no fact carries trash fuel, so every reader is as before', () => {
    const g = game(RIPBECCA);
    take(g, SMASHER, 'trash');
    for (const f of packageFacts(g, 0)) expect('trashFuel' in f).toBe(false);
    expect(packageFacts(g, 0, seatPackages(g, 0), {})).toEqual(packageFacts(g, 0));
  });

  it('The Relic in hand with both Adam Smashers in the trash: no partner without the trash, one with it', () => {
    const g = game(RIPBECCA);
    take(g, SMASHER, 'trash');
    take(g, SMASHER, 'trash');
    take(g, RELIC, 'hand');
    const off = relicLoop(g, false);
    const on = relicLoop(g, true);
    // the trash holds both Smashers either way; only readTrash counts them as the loop's fuel (enablers)
    expect(off.trash.enabler).toBe(2);
    expect(on.trashFuel).toEqual({ enabler: 2, payoff: 0, both: 0, piece: 0 });
    expect(availableOf(off).enabler).toBe(0);
    expect(availableOf(on).enabler).toBe(2);
    expect(holdCredit([off], RELIC)).toBe(0);
    // `requires`: 1 over the three Relics still to be had (one in hand, two in the deck)
    expect(holdCredit([on], RELIC)).toBeCloseTo(1 / 3, 10);
  });

  it('counts only the cards the condition reads: a Relic in the trash is not the loop fuel, a Unit member is units-in-trash fuel', () => {
    const g = game(RIPBECCA);
    take(g, RELIC, 'trash');
    expect(relicLoop(g, true).trashFuel).toEqual({ enabler: 0, payoff: 0, both: 0, piece: 0 });
    const tto = take(g, 'trauma_team_operatives', 'trash');
    expect(g.def(tto).type).toBe('Unit');
    const units = packageFacts(g, 0, seatPackages(g, 0), { readTrash: true }).find((f) => f.pkg.id === 'units-in-trash')!;
    // Trauma Team Operatives is a payoff, but in the trash it is fuel for the condition (Units in the trash): an enabler
    expect(units.trash.payoff).toBeGreaterThanOrEqual(1);
    expect(units.trashFuel!.enabler).toBe(1);
    expect(units.trashFuel!.payoff).toBe(0);
  });
});

describe('the hand at the cut (handHoldCredit)', () => {
  it('sums the hold credit of the hand: selling a duplicate costs less than selling the only copy held', () => {
    const g = game(RIPBECCA);
    take(g, SMASHER, 'trash');
    take(g, SMASHER, 'trash');
    // the loop's part alone: Σ over the hand of the credit from The Relic loop's facts
    const loopHand = () => g.P(0).hand.reduce((a, u) => a + holdCredit([relicLoop(g, true)], g.c(u).defId), 0);
    const one = take(g, RELIC, 'hand');
    const withOne = handHoldCredit(g, 0);
    expect(withOne).toBeCloseTo(holdCredit(packageFacts(g, 0, seatPackages(g, 0), { readTrash: true }), RELIC), 10);
    // one of three Relics held: 1/3; selling it leaves nothing
    expect(loopHand()).toBeCloseTo(1 / 3, 10);
    // two of three held: 1/3 each; selling one leaves the other at 1/2 (two copies left to be had): a duplicate costs 1/6
    take(g, RELIC, 'hand');
    expect(loopHand()).toBeCloseTo(2 / 3, 10);
    expect(handHoldCredit(g, 0)).toBeGreaterThan(withOne);
    g.move(one.uid, 'eddies');
    expect(loopHand()).toBeCloseTo(1 / 2, 10);
    // an empty hand holds nothing
    for (const u of [...g.P(0).hand]) g.move(u, 'deck');
    expect(handHoldCredit(g, 0)).toBe(0);
  });

  it('reads only the seat’s own list and hand (the rival plain Units count for nothing)', () => {
    const g = game(RIPBECCA);
    expect(seatPackages(g, 1)).toEqual([]);
    expect(handHoldCredit(g, 1)).toBe(0);
  });
});

/** Ripbecca's turn 3 with The Relic, Augmented Negotiators and Cyberpsychosis in hand, 2 Eddies, the Smashers in `smashers`. */
function sellSpot(smashers: 'trash' | 'eddies') {
  const g = game(RIPBECCA);
  take(g, SMASHER, smashers);
  take(g, SMASHER, smashers);
  take(g, RELIC, 'hand');
  take(g, 'augmented_negotiators', 'hand');
  take(g, 'cyberpsychosis', 'hand');
  eddies(g, 0, 2);
  const actions = g.legalActions(0);
  const d: Decision = { player: 0, kind: 'action', prompt: '', min: 1, max: 1, options: actions.map((a) => ({ label: g.describeAction(a), action: a })) };
  return { g, d };
}
async function sold(opts: ConstructorParameters<typeof HeuristicAgent>[0]) {
  const { g, d } = sellSpot('trash');
  const bot = new HeuristicAgent({ noise: 0, seed: 3, profiles: BEST_PROFILES, sellLookahead: 3, ...opts });
  const [i] = await bot.decide(g, d);
  const a = d.options[i].action!;
  expect(a.type).toBe('sell');
  return { card: g.c((a as { uid: number }).uid).defId, scores: bot.lastScores! };
}

describe('the sell comparison with sellHoldCut', () => {
  it('is off by default, in the bot and in a worker spec', () => {
    expect(new HeuristicAgent().opts.sellHoldCut).toBe(0);
    expect(fromSpec(HARD_SPEC, 1).opts.sellHoldCut).toBe(0);
    expect(fromSpec({ ...HARD_SPEC, sellHoldCut: 20 }, 1).opts.sellHoldCut).toBe(20);
    expect(fromSpec({ ...HARD_SPEC, sellHoldCut: 20 }, 1).configLabel()).toContain('hold20');
  });

  it('one step ahead: the sells tie on the evaluation, so the first ranked (The Relic) goes; on, the scarce Relic is kept', async () => {
    const off = await sold({});
    expect(off.card).toBe(RELIC);
    expect(new Set(off.scores.opts.map((o) => o.v)).size).toBe(1);
    const on = await sold({ sellHoldCut: 20 });
    expect(on.card).not.toBe(RELIC);
    // the compared sells keep their places; only the values move, by 20 × the hold credit left in hand
    expect(on.scores.opts.map((o) => o.i)).toEqual(off.scores.opts.map((o) => o.i));
  });

  it('Hard (rollouts to the end of the rival’s turn): the same', async () => {
    const hard = { deep: 3, deepReactions: 3, mulligan: 'plain' as const };
    expect((await sold(hard)).card).toBe(RELIC);
    expect((await sold({ ...hard, sellHoldCut: 20 })).card).not.toBe(RELIC);
  });

  it('values each sell at the cut: the rollout value plus the weight × the hold credit left in the seller’s hand', async () => {
    const { g, d } = sellSpot('trash');
    const bot = new HeuristicAgent({ noise: 0, seed: 3, profiles: BEST_PROFILES, sellLookahead: 3, sellHoldCut: 20 });
    await bot.decide(g, d);
    const plain = new HeuristicAgent({ noise: 0, seed: 3, profiles: BEST_PROFILES, sellLookahead: 3 });
    for (const o of bot.lastScores!.opts) {
      const a = d.options[o.i].action as Action;
      // the step played by hand: sell, then the hand's credit
      const cg = g.clone([new Scripted(), new Scripted()]);
      cg.move((a as { uid: number }).uid, 'eddies');
      const base = await plain.simulate(g, 0, a);
      expect(o.v).toBeCloseTo(base + 20 * handHoldCredit(cg, 0), 6);
    }
  });
});
