// C.2 (docs/REVIEW_2026-11-24.md B1, §10 C.2): ready sources kept for tricks, and tricks inside the one-step projections.
// Both opt-in (HeuristicOptions.readyTricks / fastTricks, the specs' fields of the same names): off, every bot is the
// bot before (the game corpus, the benchmark and the recorded events pin that); on, in built positions, a bot holding a
// castable Quick Program keeps the sources up instead of spending them on a marginal play, and an attack projected into
// a ready trick is valued lower.
import { describe, expect, it } from 'vitest';
import type { Game } from '../src/engine/engine';
import type { Action, Decision, PlayerId } from '../src/engine/types';
import { DEFAULT_WEIGHTS, evaluate, evaluateTerms, readyTrickCover, readyTrickTerm } from '../src/ai/eval';
import { HAND_2026_10 } from '../src/ai/weightSets';
import { HeuristicAgent } from '../src/ai/heuristic';
import { fromSpec } from '../scripts/agent-spec';
import { eddies, equip, gig, setup, spawn } from './engine-helpers';

const actionDecision = (g: Game, p: PlayerId = 0, keep: (a: Action) => boolean = (a) => a.type !== 'sell'): Decision => {
  const actions = g.legalActions(p).filter(keep);
  return { player: p, kind: 'action', prompt: 'Choose an action', options: actions.map((a) => ({ label: g.describeAction(a), action: a })), min: 1, max: 1 };
};
const chosen = async (bot: HeuristicAgent, g: Game, d: Decision): Promise<Action> => d.options[(await bot.decide(g, d))[0]].action as Action;
const ON = 12;

/** p0's Legends out of the game (no Call, no Legend paying), so the ready sources are p0's Eddies alone. */
function noLegends(g: Game, p: PlayerId) {
  for (const u of [...g.P(p).legends]) g.move(u, 'removed');
}

describe('C.2 switches are off by default', () => {
  it('the weights, the agents and the specs leave the term and the projections as they were', () => {
    expect([DEFAULT_WEIGHTS.readyTrick, DEFAULT_WEIGHTS.readyCall, HAND_2026_10.readyTrick, HAND_2026_10.readyCall]).toEqual([0, 0, 0, 0]);
    const bot = new HeuristicAgent();
    expect(bot.opts.weights).toBe(DEFAULT_WEIGHTS);
    expect([bot.opts.readyTricks, bot.opts.fastTricks]).toEqual([0, false]);
    const spec = fromSpec({}, 1);
    expect([spec.opts.readyTricks, spec.opts.fastTricks, spec.opts.weights]).toEqual([0, false, DEFAULT_WEIGHTS]);
    const on = fromSpec({ readyTricks: ON, fastTricks: true }, 1);
    expect([on.opts.weights.readyTrick, on.opts.weights.readyCall, on.opts.fastTricks]).toEqual([ON, ON, true]);
    expect(on.configLabel()).toBe(`1ply noise0.15 ready${ON} ftricks`);
  });
});

describe('C.2 (a): readyTrickCover and readyTrickTerm', () => {
  it('covers the cheapest tricks first, each in full or not at all, from the ready sources only', () => {
    const { g } = setup();
    noLegends(g, 0);
    spawn(g, 0, 'take_control', 'hand'); // Quick, 2
    spawn(g, 0, 'floor_it', 'hand'); // Quick, 1
    spawn(g, 0, 'psycho_squad', 'hand'); // a Unit: no trick
    expect(readyTrickCover(g, 0, true)).toEqual({ trick: 0, call: 0 });
    eddies(g, 0, 2);
    expect(readyTrickCover(g, 0, true)).toEqual({ trick: 1, call: 0 }); // Floor It; Take Control needs 2 more
    eddies(g, 0, 1);
    expect(readyTrickCover(g, 0, true)).toEqual({ trick: 3, call: 0 });
    g.c(g.P(0).eddies[0]).spent = true; // a spent Eddie keeps nothing
    expect(readyTrickCover(g, 0, true)).toEqual({ trick: 1, call: 0 });
  });

  it("a Quick Program whose own play condition fails is no trick (Cyberpsychosis with no equipped Unit)", () => {
    const { g } = setup();
    noLegends(g, 0);
    eddies(g, 0, 3);
    spawn(g, 0, 'cyberpsychosis', 'hand');
    expect(readyTrickCover(g, 0, true).trick).toBe(0);
    equip(g, 0, 'mantis_blades', spawn(g, 0, 'psycho_squad', 'field'));
    expect(readyTrickCover(g, 0, true).trick).toBe(3);
  });

  it('a face-down Legend is a reaction Call at its Call cost, after the Programs of the same cost, only with calls', () => {
    const { g } = setup(); // p0's Legends are face-down and spent: they can be Called, not pay
    eddies(g, 0, 1);
    spawn(g, 0, 'floor_it', 'hand');
    expect(readyTrickCover(g, 0, true)).toEqual({ trick: 1, call: 0 });
    eddies(g, 0, 1);
    expect(readyTrickCover(g, 0, true)).toEqual({ trick: 1, call: 1 });
    expect(readyTrickCover(g, 0, false)).toEqual({ trick: 1, call: 0 });
  });

  it("counts for the seat that defends in the coming turn, signed from the viewer's side; evaluateTerms reports it", () => {
    const { g } = setup(); // p0's main phase: p1's turn comes next, p0 defends in it
    noLegends(g, 0);
    noLegends(g, 1);
    eddies(g, 0, 2);
    spawn(g, 0, 'take_control', 'hand');
    eddies(g, 1, 2);
    spawn(g, 1, 'safety_override', 'hand');
    const w = { ...DEFAULT_WEIGHTS, readyTrick: ON, readyCall: ON };
    // no reaction window without an attacker: p1 has no Unit yet
    expect(readyTrickTerm(g, 0, w)).toBe(0);
    spawn(g, 1, 'psycho_squad', 'field');
    spawn(g, 0, 'psycho_squad', 'field');
    expect(readyTrickTerm(g, 0, w)).toBe(2 * ON);
    expect(readyTrickTerm(g, 1, w)).toBe(-2 * ON);
    expect(evaluate(g, 0, w) - evaluate(g, 0)).toBeCloseTo(2 * ON, 9);
    const t = evaluateTerms(g, 0, w);
    expect([t.total, t.tricks]).toEqual([evaluate(g, 0, w), 2 * ON]);
    expect(evaluateTerms(g, 0).tricks).toBe(0);
    // p1 active: p0's turn comes next, so p1's held trick counts, against p0
    g.s.active = 1;
    expect(readyTrickTerm(g, 0, w)).toBe(-2 * ON);
  });
});

/**
 * p0 in its main phase (sell already done: the decision offers no sell) with a spent Psycho Squad made power 8, Take
 * Control (Quick, 2) and Kiroshi Optics (Gear, 1: +1 power) in hand and 2 ready Eddies. Kiroshi is a marginal play (about
 * +10 on the 1-ply screen; 8 or 9 power makes no difference against the rival's 6) that leaves 1 source, too few for
 * Take Control on the rival's turn. The rival has a ready Psycho Squad (6) that can attack p0's Gigs on its turn.
 */
function heldTrickPosition(seed = 1) {
  const { g } = setup([null, null], seed);
  noLegends(g, 0);
  noLegends(g, 1);
  const mine = spawn(g, 0, 'psycho_squad', 'field', { spent: true });
  g.givePower(mine.uid, 2, 'permanent');
  const tc = spawn(g, 0, 'take_control', 'hand');
  const kiroshi = spawn(g, 0, 'kiroshi_optics', 'hand');
  eddies(g, 0, 2);
  gig(g, 0, 6, 3);
  gig(g, 0, 8, 4);
  gig(g, 1, 6, 2);
  spawn(g, 1, 'psycho_squad', 'field');
  eddies(g, 1, 2);
  return { g, tc, kiroshi };
}

describe('C.2 (a): a bot holding a castable Quick Program keeps the sources up', () => {
  it('Medium: spends the sources on the marginal Gear without the term, passes with it', async () => {
    const { g, kiroshi } = heldTrickPosition();
    const d = actionDecision(g);
    const off = await chosen(new HeuristicAgent({ seed: 3 }), g, d);
    expect(off).toMatchObject({ type: 'play', uid: kiroshi.uid });
    const on = await chosen(new HeuristicAgent({ seed: 3, readyTricks: ON }), g, d);
    expect(on.type).toBe('pass');
  });

  it("Hard keeps them up too: its rollouts play the trick on the rival's turn, with or without the term", async () => {
    // Hard's main-phase rollouts end after the rival's turn, where p0's own term no longer counts (its sources ready at
    // its start), so Hard values the held trick by its rollout bots playing it; the term reaches Hard's root only as 5%
    // of the 1-ply value, and through the rollout bots' own choices.
    const { g } = heldTrickPosition();
    const d = actionDecision(g);
    const hard = { seed: 3, deep: 3, deepReactions: 3, sellLookahead: 3, mulligan: 'plain' as const };
    const gap = async (o: object) => {
      const bot = new HeuristicAgent({ ...hard, ...o });
      const a = await chosen(bot, g, d);
      const kiroshi = bot.lastAlternatives.find((x) => x.label.startsWith('Play Kiroshi'))!;
      return { a: a.type, gap: -kiroshi.delta };
    };
    const off = await gap({});
    const on = await gap({ readyTricks: ON, fastTricks: true });
    expect([off.a, on.a]).toEqual(['pass', 'pass']);
    expect(on.gap).toBeGreaterThan(off.gap);
  });
});

/**
 * p0 in its main phase with a ready Psycho Squad (power 6: steals 1) that can attack p1's Gig area; p1 has 2 Gigs, no
 * Unit, 2 ready Eddies, and every card p1 could hold is Take Control (Quick, 2: "a rival Unit steals 1 fewer Gig"), so
 * the projection's re-deal of p1's hand gives it the trick.
 */
function attackIntoTrick(trick = 'take_control') {
  const { g } = setup();
  noLegends(g, 0);
  noLegends(g, 1);
  const att = spawn(g, 0, 'psycho_squad', 'field');
  gig(g, 1, 6, 2);
  gig(g, 1, 8, 5);
  gig(g, 0, 6, 3);
  for (const u of [...g.P(1).deck]) g.move(u, 'removed');
  for (let i = 0; i < 6; i++) spawn(g, 1, trick, 'deck');
  spawn(g, 1, trick, 'hand');
  eddies(g, 1, 2);
  const attack = g.legalActions(0).find((a) => a.type === 'attack' && a.uid === att.uid && a.targetGigs !== null)!;
  return { g, attack, att };
}

describe('C.2 (b): the one-step projection lets the defender play a trick', () => {
  it('an attack into a ready Take Control is valued lower with fastTricks', async () => {
    const { g, attack } = attackIntoTrick();
    expect(attack).toBeDefined();
    const off = await new HeuristicAgent({ seed: 3 }).simulate(g, 0, attack);
    const on = await new HeuristicAgent({ seed: 3, fastTricks: true }).simulate(g, 0, attack);
    // a stolen Gig is worth about two gig weights to the attacker
    expect(off - on).toBeGreaterThan(DEFAULT_WEIGHTS.gig);
  });

  it('with no trick to play the projection is the same', async () => {
    const { g, attack } = attackIntoTrick('psycho_squad');
    const off = await new HeuristicAgent({ seed: 3 }).simulate(g, 0, attack);
    const on = await new HeuristicAgent({ seed: 3, fastTricks: true }).simulate(g, 0, attack);
    expect(on).toBe(off);
  });

  it('live Easy reactions are unchanged: the Easy tier never plays a reaction Program', async () => {
    const { g, att } = attackIntoTrick();
    // p1 reacts to the attack as Easy does: the fast rule, no Program
    const easy = new HeuristicAgent({ lookahead: false, seed: 3, easyGuard: true });
    g.s.attack = { attacker: att.uid, attackerPlayer: 0, targetUnit: null, targetGigs: 1, step: 'react', ended: false };
    const rx = g.legalReactions(1);
    expect(rx.some((r) => r.type === 'play')).toBe(true);
    const d: Decision = { player: 1, kind: 'reaction', prompt: 'react?', options: rx.map((r) => ({ label: g.describeAction(r), action: r })), min: 1, max: 1 };
    expect(rx[(await easy.decide(g, d))[0]].type).toBe('endReact');
    // a fast agent with the switch (as inside a projection) plays it
    const fast = new HeuristicAgent({ lookahead: false, seed: 3, fastTricks: true, trickWeights: DEFAULT_WEIGHTS });
    expect(rx[(await fast.decide(g, d))[0]].type).toBe('play');
  });
});
