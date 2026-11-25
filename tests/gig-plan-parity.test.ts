// C.1 (docs/REVIEW_2026-11-24.md B4): the Gig plan's Street Cred parity reading. The old parity pattern matched both the
// cards that want one even and one odd Gig (Bootleg Black Sapphire Show, Jackie Welles) and the ones that want an even
// Street Cred (Field Operator, Memory Relapse, Pacifica Netrunner), and planScore rewarded one even and one odd Gig for
// all of them, which with two Gigs is an odd Street Cred (Street Cred is the sum of the Gig values, CR 11.2). The switch
// (HeuristicOptions.credParity, EvalWeights.credParity) reads the two apart; off, everything is as before.
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { Game } from '../src/engine/engine';
import type { Agent, DeckList, Gig } from '../src/engine/types';
import { CRED_EVEN_PATTERN, CRED_ODD_PATTERN, GIG_PARITY_PATTERN, gigPlanOf } from '../src/ai/knowledge';
import { DEFAULT_WEIGHTS, evaluateTerms, planScore, readsCredParity, withPlanReading } from '../src/ai/eval';
import { FAST_WEIGHTS, HeuristicAgent } from '../src/ai/heuristic';
import { synergiesIn } from '../src/content/synergies';
import { fromSpec } from '../scripts/agent-spec';
import { loadLibrary } from '../scripts/lib-node';

const OLD_PARITY = /even value|odd value|even number|is an even/i;
const lib = loadLibrary();
const ids = (d: DeckList) => [...d.legends, ...d.main];
const gigs = (...values: number[]): Gig[] => values.map((value, id) => ({ id, value, sides: 6, owner: 0, controller: 0 }));
const prefers = (plan: ReturnType<typeof gigPlanOf>, a: number[], b: number[]) => planScore(gigs(...a), plan) - planScore(gigs(...b), plan);

describe('which reading each card gets', () => {
  it('every card the old parity pattern matches has exactly one reading: Gig parity or Street Cred parity', () => {
    const readings = Object.fromEntries(
      CARDS.filter((c) => OLD_PARITY.test(c.text)).map((c) => {
        const r = [GIG_PARITY_PATTERN.test(c.text) && 'gig parity', CRED_EVEN_PATTERN.test(c.text) && 'even Street Cred', CRED_ODD_PATTERN.test(c.text) && 'odd Street Cred'].filter(Boolean);
        return [c.id, r.join(', ')];
      }),
    );
    expect(readings).toEqual({
      bootleg_black_sapphire_show: 'gig parity', // draws 2 with an even and an odd Gig
      jackie_welles_ride_or_die_choom: 'gig parity', // +2 power per even Gig, draws per odd Gig when defeated
      field_operator: 'even Street Cred',
      memory_relapse: 'even Street Cred',
      pacifica_netrunner: 'even Street Cred',
    });
    // and the new patterns match nothing the old one did not (Rogue Amendiares reads a stolen Gig's parity: in neither)
    for (const c of CARDS) if (GIG_PARITY_PATTERN.test(c.text) || CRED_EVEN_PATTERN.test(c.text) || CRED_ODD_PATTERN.test(c.text)) expect(OLD_PARITY.test(c.text), c.id).toBe(true);
  });

  it('off, the plan is exactly the plan before C.1 (no Street Cred keys); on, only the parity keys differ', () => {
    for (const d of lib) {
      const before = gigPlanOf(ids(d.deck));
      expect(Object.keys(before)).toEqual(['high', 'low', 'pairs', 'diverse', 'parity', 'd20']);
      expect(gigPlanOf(ids(d.deck), false)).toEqual(before);
      const after = gigPlanOf(ids(d.deck), true);
      for (const k of ['high', 'low', 'pairs', 'diverse', 'd20'] as const) expect(after[k], `${d.file} ${k}`).toBe(before[k]);
      expect(after.credOdd).toBe(0); // no card asks for an odd Street Cred today
    }
  });
});

describe('planScore with the Street Cred parity reading', () => {
  const builtAround = lib.filter((d) => synergiesIn(d.deck).some((s) => s.synergy.id === 'cred-even' && s.builtAround));

  it('the 11 library decks built around an even Street Cred prefer Gigs that make one (old reading: the opposite)', () => {
    expect(builtAround.map((d) => d.file.slice(d.file.lastIndexOf('/') + 1)).sort()).toEqual([
      'import-ladder-s1-7-dexter-v-padre-rrg.txt',
      'ladder-rrg-v-smasher-saburo.txt',
      'meta-gry-trauma-team.txt',
      'meta-rainbow-fixer-stuff.txt',
      'nc-05-emperor-s-guard-ggb.txt',
      's1-06-cross-bgy.txt',
      's2-02-mutant-rgg.txt',
      's2-03-cross-rgy.txt',
      's2-04-cross-rrg.txt',
      's2-08-explorer-ggy.txt',
      's3-02-mutant-rgy.txt',
    ]);
    for (const d of builtAround) {
      const old = gigPlanOf(ids(d.deck));
      const plan = gigPlanOf(ids(d.deck), true);
      expect(plan.parity, d.file).toBe(0); // none of them holds Jackie Welles or Bootleg Black Sapphire Show
      expect(plan.credEven, d.file).toBe(old.parity); // the same cards, now read as what they ask for
      // Street Cred 6 over 5, 8 over 7, 10 over 9 (three Gigs), 4 over 3 (one Gig), by about twice the Street Cred weight
      // (values kept off 1 and the die's top, which other plan terms score, and with no two alike)
      for (const [even, odd] of [
        [[2, 4], [2, 3]],
        [[3, 5], [3, 4]],
        [[2, 3, 5], [2, 3, 4]],
        [[4], [3]],
      ] as const) {
        expect(prefers(plan, [...even], [...odd]), `${d.file} {${even}} over {${odd}}`).toBeGreaterThan(2 * plan.credEven! - 0.1);
      }
      expect(prefers(old, [2, 4], [2, 3]), d.file).toBeLessThan(0); // the bug the reading fixes
    }
  });

  it('decks that want one even and one odd Gig keep that reading', () => {
    const parityDecks = lib.filter((d) => ids(d.deck).some((x) => x === 'bootleg_black_sapphire_show' || x === 'jackie_welles_ride_or_die_choom'));
    expect(parityDecks.length).toBeGreaterThan(5);
    for (const d of parityDecks) {
      const old = gigPlanOf(ids(d.deck));
      const plan = gigPlanOf(ids(d.deck), true);
      expect(plan.parity, d.file).toBe(old.parity);
      expect(plan.parity, d.file).toBeGreaterThan(0);
      expect(plan.credEven, d.file).toBe(0); // none of them holds a Street Cred card
      expect(prefers(plan, [2, 3], [2, 4]), d.file).toBeCloseTo(prefers(old, [2, 3], [2, 4]), 9);
      expect(prefers(plan, [2, 3], [2, 4]), d.file).toBeGreaterThan(0);
    }
  });

  it('Null Street Cred (no Gig) is neither even nor odd', () => {
    const plan = { high: 0, low: 0, pairs: 0, diverse: 0, parity: 0, d20: 0, credEven: 1, credOdd: 1 };
    expect(planScore([], plan)).toBe(0);
    expect(planScore(gigs(2, 4), plan)).toBeCloseTo(2 + 0.3, 9);
    expect(planScore(gigs(2, 3), plan)).toBeCloseTo(2 + 0.25, 9);
  });
});

describe('the switch reaches every reader of the plan', () => {
  const noAgent: Agent = { name: 'none', decide: async () => [0] };
  const GRY = lib.find((d) => d.file.endsWith('meta-gry-trauma-team.txt'))!.deck;
  const YYB = lib.find((d) => d.file.endsWith('meta-yyb-rogue-gear.txt'))!.deck;

  it('off by default: the same weights object as before; on: folded into the weights', () => {
    expect(new HeuristicAgent().opts.weights).toBe(DEFAULT_WEIGHTS);
    expect(new HeuristicAgent({ lookahead: false }).opts.weights).toBe(FAST_WEIGHTS);
    expect('credParity' in DEFAULT_WEIGHTS).toBe(false);
    expect('credParity' in FAST_WEIGHTS).toBe(false);
    const on = new HeuristicAgent({ credParity: true });
    expect(on.opts.weights).toEqual({ ...DEFAULT_WEIGHTS, credParity: 1 });
    expect(on.credParity).toBe(true);
    expect(new HeuristicAgent({ weights: on.opts.weights }).credParity).toBe(true);
    expect(new HeuristicAgent({ weights: on.opts.weights, credParity: false }).credParity).toBe(false);
    expect(new HeuristicAgent({ lookahead: false, credParity: true }).opts.weights).toEqual({ ...FAST_WEIGHTS, credParity: 1 });
    expect(on.configLabel()).toBe('1ply cred');
    // a script's JSON spec
    expect(fromSpec({ credParity: true }, 1).credParity).toBe(true);
    expect(fromSpec({}, 1).opts.weights).toBe(DEFAULT_WEIGHTS);
    expect(withPlanReading(FAST_WEIGHTS, DEFAULT_WEIGHTS)).toBe(FAST_WEIGHTS);
    expect(readsCredParity(withPlanReading(FAST_WEIGHTS, on.opts.weights))).toBe(true);
  });

  it('the clone and rollout agents a bot makes read the plan as the bot does, on both seats', () => {
    for (const credParity of [false, true]) {
      const bot = new HeuristicAgent({ credParity, deep: 3 });
      const b = bot as unknown as { fastAgents(p: 0 | 1): HeuristicAgent[]; cloneAgents(p: 0 | 1, mk: (w: typeof DEFAULT_WEIGHTS) => HeuristicAgent): HeuristicAgent[] };
      for (const p of [0, 1] as const) {
        for (const a of b.fastAgents(p)) expect(a.credParity).toBe(credParity);
        for (const a of b.cloneAgents(p, (weights) => new HeuristicAgent({ lookahead: true, deep: 0, weights }))) expect(a.credParity).toBe(credParity);
      }
    }
  });

  it('the evaluation scores the plan by the reader’s weights', () => {
    const g = Game.create([GRY, YYB], [noAgent, noAgent], { seed: 11, first: 0, log: false });
    // give each seat two Gigs: {2,4} (Street Cred 6) for the GRY seat
    const own = g.P(0).fixer.slice(0, 2);
    const rival = g.P(1).fixer.slice(0, 2);
    if (own.length < 2 || rival.length < 2) throw new Error('expected two Gigs in each fixer area');
    for (const [id, v] of [
      [own[0], 2],
      [own[1], 4],
      [rival[0], 2],
      [rival[1], 3],
    ] as const) {
      g.s.gigs[id].value = v;
    }
    const take = (p: 0 | 1, gid: number) => {
      const P = g.P(p);
      P.fixer = P.fixer.filter((x) => x !== gid);
      P.gigs.push(gid);
      g.s.gigs[gid].controller = p;
    };
    for (const id of own) take(0, id);
    for (const id of rival) take(1, id);
    const plain = evaluateTerms(g, 0, DEFAULT_WEIGHTS).features.plan;
    const cred = evaluateTerms(g, 0, { ...DEFAULT_WEIGHTS, credParity: 1 }).features.plan;
    const oldPlan = gigPlanOf(ids(GRY));
    const newPlan = gigPlanOf(ids(GRY), true);
    // the rival's plan, as seat 0 sees it, is read from its visible cards only (none yet): the same in both readings
    // seat 0's own plan term: {2,4} is worth nothing to the old reading's parity, 2 × credEven to the new
    expect(cred - plain).toBeCloseTo(planScore(gigs(2, 4), newPlan) - planScore(gigs(2, 4), oldPlan), 9);
    expect(cred - plain).toBeCloseTo(2 * newPlan.credEven!, 9);
  });
});
