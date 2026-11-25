// SIM_VERSION 10 (C.1, docs/REVIEW_2026-11-24.md B4): the Gig plan reads Gig parity and Street Cred parity apart. The
// old parity pattern matched both the cards that want one even and one odd Gig (Bootleg Black Sapphire Show, Jackie
// Welles) and the ones that want an even Street Cred (Field Operator, Memory Relapse, Pacifica Netrunner), and planScore
// rewarded one even and one odd Gig for all of them, which with two Gigs is an odd Street Cred (Street Cred is the sum
// of the Gig values, CR 11.2).
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { Game } from '../src/engine/engine';
import type { Agent, DeckList, Gig } from '../src/engine/types';
import { CRED_EVEN_PATTERN, CRED_ODD_PATTERN, GIG_PARITY_PATTERN, gigPlanOf } from '../src/ai/knowledge';
import { DEFAULT_WEIGHTS, evaluateTerms, planScore } from '../src/ai/eval';
import { synergiesIn } from '../src/content/synergies';
import { loadLibrary } from '../scripts/lib-node';

/** The pattern every card's parity was read by until SIM_VERSION 9. */
const OLD_PARITY = /even value|odd value|even number|is an even/i;
const lib = loadLibrary();
const ids = (d: DeckList) => [...d.legends, ...d.main];
const gigs = (...values: number[]): Gig[] => values.map((value, id) => ({ id, value, sides: 6, owner: 0, controller: 0 }));
type Plan = ReturnType<typeof gigPlanOf>;
const prefers = (plan: Plan, a: number[], b: number[]) => planScore(gigs(...a), plan) - planScore(gigs(...b), plan);
/** A plan as version 9 read it: the Street Cred cards counted as Gig parity. */
const asBefore = (p: Plan): Plan => ({ ...p, parity: p.parity + p.credEven + p.credOdd, credEven: 0, credOdd: 0 });

describe('which reading each card gets', () => {
  it('every card the old parity pattern matched has exactly one reading: Gig parity or Street Cred parity', () => {
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

  it('no card asks for an odd Street Cred today', () => {
    for (const d of lib) expect(gigPlanOf(ids(d.deck)).credOdd).toBe(0);
  });
});

describe('planScore with Street Cred parity', () => {
  const builtAround = lib.filter((d) => synergiesIn(d.deck).some((s) => s.synergy.id === 'cred-even' && s.builtAround));

  it('the 11 library decks built around an even Street Cred prefer Gigs that make one (version 9: the opposite)', () => {
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
      const plan = gigPlanOf(ids(d.deck));
      expect(plan.parity, d.file).toBe(0); // none of them holds Jackie Welles or Bootleg Black Sapphire Show
      expect(plan.credEven, d.file).toBeGreaterThan(0.6);
      // Street Cred 6 over 5, 8 over 7, 10 over 9 (three Gigs), 4 over 3 (one Gig), by about twice the Street Cred weight
      // (values kept off 1 and the die's top, which other plan terms score, and with no two alike)
      for (const [even, odd] of [
        [[2, 4], [2, 3]],
        [[3, 5], [3, 4]],
        [[2, 3, 5], [2, 3, 4]],
        [[4], [3]],
      ] as const) {
        expect(prefers(plan, [...even], [...odd]), `${d.file} {${even}} over {${odd}}`).toBeGreaterThan(2 * plan.credEven - 0.1);
      }
      expect(prefers(asBefore(plan), [2, 4], [2, 3]), d.file).toBeLessThan(0); // the bug the reading fixed
    }
  });

  it('decks that want one even and one odd Gig keep that reading', () => {
    const parityDecks = lib.filter((d) => ids(d.deck).some((x) => x === 'bootleg_black_sapphire_show' || x === 'jackie_welles_ride_or_die_choom'));
    expect(parityDecks.length).toBeGreaterThan(5);
    for (const d of parityDecks) {
      const plan = gigPlanOf(ids(d.deck));
      expect(plan.parity, d.file).toBeGreaterThan(0);
      expect(plan.credEven, d.file).toBe(0); // none of them holds a Street Cred card
      expect(plan, d.file).toEqual(asBefore(plan)); // the same plan as version 9's
      expect(prefers(plan, [2, 3], [2, 4]), d.file).toBeGreaterThan(0);
    }
  });

  it('Null Street Cred (no Gig) is neither even nor odd', () => {
    const plan: Plan = { high: 0, low: 0, pairs: 0, diverse: 0, parity: 0, credEven: 1, credOdd: 1, d20: 0 };
    expect(planScore([], plan)).toBe(0);
    expect(planScore(gigs(2, 4), plan)).toBeCloseTo(2 + 0.3, 9);
    expect(planScore(gigs(2, 3), plan)).toBeCloseTo(2 + 0.25, 9);
  });

  it('the evaluation scores an even Street Cred for a deck built around it', () => {
    const noAgent: Agent = { name: 'none', decide: async () => [0] };
    const GRY = lib.find((d) => d.file.endsWith('meta-gry-trauma-team.txt'))!.deck;
    const YYB = lib.find((d) => d.file.endsWith('meta-yyb-rogue-gear.txt'))!.deck;
    const planAt = (values: [number, number]) => {
      const g = Game.create([GRY, YYB], [noAgent, noAgent], { seed: 11, first: 0, log: false });
      const P = g.P(0);
      const two = P.fixer.slice(0, 2);
      if (two.length < 2) throw new Error('expected two Gigs in the fixer area');
      two.forEach((id, k) => {
        g.s.gigs[id].value = values[k];
        g.s.gigs[id].controller = 0;
      });
      P.fixer = P.fixer.filter((x) => !two.includes(x));
      P.gigs.push(...two);
      return evaluateTerms(g, 0, DEFAULT_WEIGHTS).features.plan;
    };
    const plan = gigPlanOf(ids(GRY));
    expect(planAt([2, 4]) - planAt([2, 3])).toBeCloseTo(2 * plan.credEven + 0.05, 9);
  });
});
