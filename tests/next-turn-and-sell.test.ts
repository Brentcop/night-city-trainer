// BOT-3 (the next-turn evaluation terms exposed / threat / rivalLethal; in DEFAULT_WEIGHTS since SIM_VERSION 6, 0 in the
// hand weights the tests below start from) and BOT-4 (sellSearch, off by default)
// (docs/BOT_TOOLKIT.md, docs/IMPROVEMENT_BACKLOG.md WP-D1).
import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS, evaluate, nextTurnSeat, nextTurnTerms, stealableNextTurn, type EvalWeights } from '../src/ai/eval';
import { HeuristicAgent } from '../src/ai/heuristic';
import { HAND_2026_10 } from '../src/ai/weightSets';
import type { Game } from '../src/engine/engine';
import type { Action, PlayerId } from '../src/engine/types';
import { eddies, gig, setup, spawn } from './engine-helpers';

const W = (o: Partial<EvalWeights>): EvalWeights => ({ ...HAND_2026_10, ...o });
const OFF = W({ exposed: 0, threat: 0, rivalLethal: 0 });

/** Seat 0 (in its main phase) holds 3 Gigs, the rival 2, and the rival has two 6-power Units on the field. */
function exposedState() {
  const { g } = setup();
  for (const s of [4, 6, 8]) gig(g, 0, s, 2);
  for (const s of [4, 6]) gig(g, 1, s, 2);
  const r1 = spawn(g, 1, 'psycho_squad', 'field');
  const r2 = spawn(g, 1, 'psycho_squad', 'field', { spent: true }); // readies at the rival's start
  return { g, r1, r2 };
}

/** The rival holds 7 Gigs (two moved over from seat 0's fixer), seat 0 none; seat 0 in its main phase. */
function lethalState() {
  const { g } = setup();
  for (const s of [4, 6, 8, 10, 12, 20]) gig(g, 1, s, 2);
  const id = gig(g, 0, 4, 1);
  g.P(0).gigs = g.P(0).gigs.filter((x) => x !== id);
  g.gig(id).controller = 1;
  g.P(1).gigs.push(id);
  return { g };
}

describe('BOT-3: next-turn terms', () => {
  it('all three weights 0: evaluate() is the hand evaluation and never reads the terms; the defaults set them', () => {
    expect([HAND_2026_10.exposed, HAND_2026_10.threat, HAND_2026_10.rivalLethal]).toEqual([0, 0, 0]);
    expect([DEFAULT_WEIGHTS.exposed, DEFAULT_WEIGHTS.threat, DEFAULT_WEIGHTS.rivalLethal]).toEqual([0.886, 0.971, 400]);
    const { g } = exposedState();
    expect(evaluate(g, 0, HAND_2026_10)).toBe(evaluate(g, 0, OFF));
    expect(evaluate(g, 0)).not.toBe(evaluate(g, 0, { ...DEFAULT_WEIGHTS, exposed: 0, threat: 0, rivalLethal: 0 }));
    expect(nextTurnTerms(g, 0, OFF)).toBe(0);
  });

  it('whose turn is next: the other seat during a turn, the active seat once an end phase has run', () => {
    const { g } = setup();
    expect(nextTurnSeat(g)).toBe(1);
    g.s.phase = 'end';
    expect(nextTurnSeat(g)).toBe(0);
  });

  it('stealableNextTurn: every rival Unit readies; each of our ready Blockers stops the biggest steal; capped at our Gigs', () => {
    const { g, r1 } = exposedState();
    expect(stealableNextTurn(g, 1, 0)).toBe(2);
    const b = spawn(g, 0, 'meredith_stout_stone_cold_corpo', 'field');
    expect(stealableNextTurn(g, 1, 0)).toBe(1);
    b.spent = true; // a spent Blocker doesn't ready before the rival's turn
    expect(stealableNextTurn(g, 1, 0)).toBe(2);
    g.addMod({ kind: 'power', target: r1.uid, amount: 4, until: 'permanent' }); // 10 power: steals 2
    expect(stealableNextTurn(g, 1, 0)).toBe(3);
    b.spent = false;
    expect(stealableNextTurn(g, 1, 0)).toBe(1); // the Blocker stops the 2-steal attacker
    g.P(0).gigs.splice(0, 3);
    expect(stealableNextTurn(g, 1, 0)).toBe(0);
  });

  it('a Unit that stays spent through the rival start (cantReady past it) is not counted', () => {
    const { g, r2 } = exposedState();
    g.addMod({ kind: 'cantReady', target: r2.uid, until: 'startOfTurn', untilPlayer: 0 });
    expect(stealableNextTurn(g, 1, 0)).toBe(1);
  });

  it('exposed: minus its share of the Gig swing, only when the rival moves next', () => {
    const { g } = exposedState();
    // 2 Gigs stolen: (3−2)·20 = 20 becomes (1−4)·20 = −60, a swing of 80
    expect(evaluate(g, 0, W({ exposed: 0.5 })) - evaluate(g, 0, OFF)).toBeCloseTo(-40, 6);
    g.s.phase = 'end'; // seat 0 starts next (the end of a play-out): no exposure
    expect(evaluate(g, 0, W({ exposed: 0.5 }))).toBe(evaluate(g, 0, OFF));
  });

  it('threat: plus its share of the swing of what we can steal, when we move next (symmetric with exposed)', () => {
    const { g } = exposedState();
    spawn(g, 0, 'psycho_squad', 'field', { spent: true });
    g.s.phase = 'end';
    // 1 Gig: (3−2)·20 = 20 becomes (4−1)·20 = 60
    expect(evaluate(g, 0, W({ threat: 0.5 })) - evaluate(g, 0, OFF)).toBeCloseTo(20, 6);
    // the same position from the rival's side, whose next turn it is not: exposed mirrors it
    expect(evaluate(g, 1, W({ exposed: 0.5 })) - evaluate(g, 1, OFF)).toBeCloseTo(-20, 6);
  });

  it('rivalLethal: applied when the rival holds 7 and we cannot steal it below 7 before its start', () => {
    const { g } = lethalState();
    const pen = (x: Game) => evaluate(x, 0, W({ rivalLethal: 300 })) - evaluate(x, 0, OFF);
    expect(pen(g)).toBe(-300); // no attacker
    const u = spawn(g, 0, 'psycho_squad', 'field');
    expect(pen(g)).toBe(0); // a ready Unit can still steal one back this turn
    const b = spawn(g, 1, 'meredith_stout_stone_cold_corpo', 'field');
    expect(pen(g)).toBe(-300); // ... unless a ready rival Blocker stops it
    b.spent = true;
    u.lag = true;
    expect(pen(g)).toBe(-300); // a lagging Unit can't attack
    u.lag = false;
    expect(pen(g)).toBe(0);
    g.s.phase = 'end';
    g.s.active = 1; // our turn is over: the rival starts next and wins
    expect(pen(g)).toBe(-300);
    g.s.active = 0; // our turn starts next: no rival lethal
    expect(pen(g)).toBe(0);
    g.s.phase = 'main';
    g.s.overtime = true; // in overtime 7 Gigs ends the game at once, so this term never applies
    expect(pen(g)).toBe(0);
  });
});

/** Seat 0 has 3 Eddies and three different sellable cards in hand; deep bot. */
function sellState() {
  const { g } = setup();
  eddies(g, 0, 3);
  for (const id of ['floor_it', 'trust_no_one', 'towerfall']) spawn(g, 0, id, 'hand');
  return { g };
}

/** Replace the bot's rollouts with fixed values: `noSell` for "don't sell", `sellV(uid)` for a sell, 0 for the rest. */
function stub(bot: HeuristicAgent, noSell: number, sellV: (uid: number) => number) {
  const calls: (Action | null)[] = [];
  (bot as any).rolloutMove = async (_g: Game, _p: PlayerId, a: Action | null) => {
    calls.push(a);
    if (a === null) return noSell;
    return a.type === 'sell' ? sellV(a.uid) : 0;
  };
  return calls;
}

describe('BOT-4: sellSearch', () => {
  it('off by default: the rule sells, with no rollout for the sell', async () => {
    const { g } = sellState();
    const bot = new HeuristicAgent({ deep: 3 });
    expect(bot.opts.sellSearch).toBe(false);
    const calls = stub(bot, 100, () => 0);
    g.agents[0] = bot;
    const a = await g.chooseAction(0, g.legalActions(0));
    expect(a.type).toBe('sell');
    expect(calls.some((x) => x === null || x.type === 'sell')).toBe(false);
  });

  it('compares "don\'t sell" with the two most sellable cards and takes the better sell', async () => {
    const { g } = sellState();
    const bot = new HeuristicAgent({ deep: 3, sellSearch: true });
    const ranked: number[] = (bot as any).sellRanking(g, 0, g.legalActions(0));
    expect(ranked.length).toBe(3);
    const calls = stub(bot, 0, (uid) => (uid === ranked[1] ? 5 : 1));
    g.agents[0] = bot;
    const a = await g.chooseAction(0, g.legalActions(0));
    expect(a).toEqual({ type: 'sell', uid: ranked[1] });
    const sellCalls = calls.filter((x) => x === null || x.type === 'sell');
    expect(sellCalls).toEqual([
      { type: 'sell', uid: ranked[0] },
      { type: 'sell', uid: ranked[1] },
      null,
    ]);
  });

  it('when not selling plays out best, it does not sell, and not again that turn', async () => {
    const { g } = sellState();
    const bot = new HeuristicAgent({ deep: 3, sellSearch: true });
    stub(bot, 50, () => 0);
    g.agents[0] = bot;
    expect((await g.chooseAction(0, g.legalActions(0))).type).not.toBe('sell');
    const calls = stub(bot, -50, () => 0); // a sell would now win, but the turn's decision stands
    expect((await g.chooseAction(0, g.legalActions(0))).type).not.toBe('sell');
    expect(calls.some((x) => x === null || x.type === 'sell')).toBe(false);
    g.s.turn += 2; // a later turn searches again
    expect((await g.chooseAction(0, g.legalActions(0))).type).toBe('sell');
  });

  it('ignored without deep rollouts; a "don\'t sell" play-out bot never sells that turn', async () => {
    const { g } = sellState();
    const medium = new HeuristicAgent({ sellSearch: true });
    g.agents[0] = medium;
    expect((await g.chooseAction(0, g.legalActions(0))).type).toBe('sell');
    const held = new HeuristicAgent({ noSellTurn: g.s.turn });
    g.agents[0] = held;
    expect((await g.chooseAction(0, g.legalActions(0))).type).not.toBe('sell');
  });

  it('sellEddieByStage: off by default; when set, each sell counts its Eddie at the stage value', async () => {
    expect(new HeuristicAgent({ deep: 3, sellSearch: true }).opts.sellEddieByStage).toBeNull();
    // rollouts: "don't sell" `noSell` Eddies (of the weights' value) ahead of every sell
    const pick = async (stage: [number, number, number] | undefined, turn: number, noSell: number) => {
      const { g } = sellState();
      g.s.turn = turn;
      const bot = new HeuristicAgent({ deep: 3, sellSearch: true, sellEddieByStage: stage });
      const eddie = bot.w(g, 0).eddie;
      stub(bot, noSell * eddie, () => 0);
      g.agents[0] = bot;
      return (await g.chooseAction(0, g.legalActions(0))).type;
    };
    expect(await pick(undefined, 3, 0.5)).not.toBe('sell');
    expect(await pick([200, 0, 0], 3, 0.5)).toBe('sell'); // early (turns 1–4): worth far more than the weights say
    expect(await pick(undefined, 7, -0.5)).toBe('sell');
    expect(await pick([200, 0, 0], 7, -0.5)).not.toBe('sell'); // mid (5–9): worth 0
    expect(await pick([200, 0, 100], 11, 0.5)).toBe('sell'); // late (10+)
  });

  it('the real "don\'t sell" rollout runs the rest of the turn and the rival reply', async () => {
    const { g } = sellState();
    const bot = new HeuristicAgent({ deep: 3, sellSearch: true });
    const v = await (bot as any).rolloutMove(g, 0, null);
    expect(Number.isFinite(v)).toBe(true);
    expect(g.P(0).hand.length).toBe(3); // the clone, not the game, played
  });
});
