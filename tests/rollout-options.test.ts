// BOT-1 (rolloutWins) and BOT-2 (deepWorlds): play-out scoring options of the deep bot, both off by default
// (docs/BOT_TOOLKIT.md, docs/IMPROVEMENT_BACKLOG.md WP-D1).
import { describe, expect, it } from 'vitest';
import { HeuristicAgent, isUnknownCall, standardError } from '../src/ai/heuristic';
import { DEFAULT_WEIGHTS, evaluate } from '../src/ai/eval';
import { nextStartResult, playOutValue, type World } from '../src/ai/playOut';
import type { Action, PlayerId } from '../src/engine/types';
import { eddies, gig, setup, spawn } from './engine-helpers';

/**
 * Seat 0 holds 6 Gigs (its fixer is empty) and one ready Unit (8 power this turn). The rival holds 1 Gig and one spent
 * 6-power Unit that can't ready until seat 0's next turn, and nothing it can attack with next turn. Seat 0 can attack
 * the rival's Gigs (the 7th Gig, held through the rival's turn: a win at seat 0's next start) or the rival's Unit (wins
 * the fight). The evaluation used ignores Gig counts (gig and gigNear 0), so only the win tells the Gig attack apart;
 * defeating the Unit is worth more board value.
 */
function closing() {
  const { g } = setup();
  for (const sides of [4, 6, 8, 10, 12, 20]) gig(g, 0, sides, 3);
  gig(g, 1, 4, 2);
  const mine = spawn(g, 0, 'psycho_squad', 'field');
  g.addMod({ kind: 'power', target: mine.uid, amount: 2, until: 'endOfTurn' });
  const theirs = spawn(g, 1, 'psycho_squad', 'field', { spent: true });
  g.addMod({ kind: 'cantReady', target: theirs.uid, until: 'startOfTurn', untilPlayer: 0 });
  return { g, mine, theirs };
}
const noGigWeights = { ...DEFAULT_WEIGHTS, gig: 0, gigNear: 0 };

async function choose(opts: ConstructorParameters<typeof HeuristicAgent>[0]) {
  const { g, theirs } = closing();
  const bot = new HeuristicAgent({ deep: 3, weights: noGigWeights, ...opts });
  g.agents[0] = bot;
  const a = await g.chooseAction(0, g.legalActions(0));
  return { a, theirs, bot };
}

describe('BOT-1: rolloutWins', () => {
  it('nextStartResult: the seat about to start its turn wins with 7+ Gigs; the turn limit comes first', () => {
    const { g } = setup();
    for (const sides of [4, 6, 8, 10, 12, 20]) gig(g, 0, sides, 3);
    g.s.active = 0;
    expect(nextStartResult(g)).toBe(null); // 6 Gigs
    gig(g, 1, 4, 2);
    g.P(0).gigs.push(g.P(1).gigs.pop()!); // 7
    expect(nextStartResult(g)).toBe(0);
    expect(playOutValue(g, 0, DEFAULT_WEIGHTS, { wins: true })).toBe(DEFAULT_WEIGHTS.win);
    expect(playOutValue(g, 1, DEFAULT_WEIGHTS, { wins: true, clamp: true })).toBe(-DEFAULT_WEIGHTS.playOutClamp);
    expect(playOutValue(g, 0)).toBe(evaluate(g, 0)); // off: plain evaluate()
    g.s.active = 1;
    expect(nextStartResult(g)).toBe(null); // the rival starts next, not the seat with 7
    g.s.active = 0;
    g.s.turn = g.s.maxTurns;
    expect(nextStartResult(g)).toBe('tie');
    expect(playOutValue(g, 0, DEFAULT_WEIGHTS, { wins: true })).toBe(0);
  });

  it('with the option on, the deep bot takes the 7th Gig it can hold through the rival turn', async () => {
    const { a } = await choose({ rolloutWins: true });
    expect(a).toMatchObject({ type: 'attack', targetGigs: 1 });
  });

  it('with the option off (default), it takes the better board instead, as before', async () => {
    const { a, theirs } = await choose({});
    expect(a).toMatchObject({ type: 'attack', targetUnit: theirs.uid });
    const off = await choose({ rolloutWins: false });
    expect(off.a).toEqual(a);
  });

  it('main-phase rollouts are clamped to ±playOutClamp only with the option on', async () => {
    const { g } = closing();
    const atk = g.legalActions(0).find((x) => x.type === 'attack' && x.targetGigs === 1)!;
    expect(await new HeuristicAgent({ weights: noGigWeights, rolloutWins: true }).rollout(g, 0, atk)).toBe(DEFAULT_WEIGHTS.playOutClamp);
    expect(Math.abs(await new HeuristicAgent({ weights: noGigWeights }).rollout(g, 0, atk))).toBeLessThan(DEFAULT_WEIGHTS.playOutClamp);
  });
});

describe('BOT-2: deepWorlds', () => {
  /** Record which world each rollout of a decision was played in. */
  function spy(bot: HeuristicAgent) {
    const calls: { a: Action; w: World | undefined }[] = [];
    const orig = bot.rollout.bind(bot);
    bot.rollout = async (g, p: PlayerId, a: Action, w?: World) => {
      calls.push({ a, w });
      return orig(g, p, a, w);
    };
    return calls;
  }

  it('0 and 1 are the default: same choice, same values, no standard errors', async () => {
    const base = await choose({});
    for (const n of [0, 1]) {
      const x = await choose({ deepWorlds: n });
      expect(x.a).toEqual(base.a);
      expect(x.bot.lastAlternatives).toEqual(base.bot.lastAlternatives);
      expect(x.bot.lastAlternatives.every((y) => y.se === undefined && y.seDiff === undefined)).toBe(true);
    }
  });

  it('every rolled-out candidate is scored in the same N worlds, and the alternatives carry standard errors', async () => {
    const { g } = closing();
    const bot = new HeuristicAgent({ deep: 3, weights: noGigWeights, deepWorlds: 3 });
    const calls = spy(bot);
    g.agents[0] = bot;
    await g.chooseAction(0, g.legalActions(0));
    const byCand = new Map<string, World[]>();
    for (const c of calls) {
      expect(c.w).toBeDefined();
      const k = JSON.stringify(c.a);
      byCand.set(k, [...(byCand.get(k) ?? []), c.w!]);
    }
    expect(byCand.size).toBeGreaterThan(1);
    const worlds = [...byCand.values()];
    for (const ws of worlds) expect(ws).toEqual(worlds[0]);
    expect(worlds[0]).toHaveLength(3);
    const alts = bot.lastAlternatives;
    expect(alts.length).toBeGreaterThan(1);
    for (const x of alts) {
      expect(x.se).toBeGreaterThanOrEqual(0);
      expect(x.seDiff).toBeGreaterThanOrEqual(0);
    }
    expect(alts[0].seDiff).toBe(0); // the chosen move against itself
  });

  it('unknown Calls are still one candidate, averaged over every unknown slot in each world', async () => {
    const { g } = setup();
    for (const u of g.P(0).legends) g.c(u).spent = false;
    eddies(g, 0, 6);
    spawn(g, 0, 'psycho_squad', 'field');
    const bot = new HeuristicAgent({ deep: 6, deepWorlds: 2 });
    const calls = spy(bot);
    g.agents[0] = bot;
    const actions = g.legalActions(0);
    const unknown = actions.filter((a) => isUnknownCall(g, a));
    expect(unknown.length).toBeGreaterThan(1);
    await g.chooseAction(0, actions);
    const callRollouts = calls.filter((c) => isUnknownCall(g, c.a));
    // each unknown slot once per world
    expect(callRollouts).toHaveLength(unknown.length * 2);
    const slotWorlds = (uid: number) => callRollouts.filter((c) => c.a.type === 'call' && c.a.uid === uid).map((c) => c.w);
    for (const a of unknown) if (a.type === 'call') expect(slotWorlds(a.uid)).toEqual(slotWorlds((unknown[0] as { uid: number }).uid));
  });

  it('standardError', () => {
    expect(standardError([1])).toBe(0);
    expect(standardError([1, 3])).toBeCloseTo(1, 9);
  });
});
