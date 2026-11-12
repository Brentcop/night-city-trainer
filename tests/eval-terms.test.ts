// INFO-4: evaluateTerms() exposes evaluate()'s per-term features without changing evaluate(). On states taken all
// through seeded games, under several weight sets: evaluate() equals the code before the refactor exactly (a copy is
// kept below), evaluateTerms().total equals evaluate() exactly, and Σ weight × feature + packages equals it up to
// rounding.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game, other } from '../src/engine/engine';
import { parseDeck } from '../src/engine/deck';
import { HeuristicAgent } from '../src/ai/heuristic';
import { DEFAULT_WEIGHTS, EVAL_TERMS, evaluate, evaluateTerms, nextTurnTerms, packageTerms, planFor, planScore, unitValue, type EvalWeights } from '../src/ai/eval';
import type { Agent, CardInst, Decision, DeckList, PlayerId } from '../src/engine/types';

const DECKS: DeckList[] = readdirSync('data/decks')
  .filter((f) => f.endsWith('.txt'))
  .sort()
  .map((f) => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck);

/** evaluate() as it was before evaluateTerms() (2026-11-12), for the exactness check. */
function evaluateBefore(g: Game, p: PlayerId, w: EvalWeights): number {
  const s = g.s;
  if (s.winner !== null) return s.winner === 'tie' ? 0 : s.winner === p ? w.win : -w.win;
  const atRisk = (c: CardInst) => {
    const pw = g.power(c);
    return g.units(other(c.controller)).some((r) => g.power(r) > pw || (g.power(r) === pw && pw > 0));
  };
  const r = other(p);
  let v = 0;
  const myG = g.P(p).gigs.length;
  const rG = g.P(r).gigs.length;
  v += (myG - rG) * w.gig;
  if (myG >= 6) v += w.gigNear * (myG - 5);
  if (rG >= 6) v -= w.gigNear * (rG - 5);
  if (s.overtime) v += (myG - rG) * w.gig;
  for (const pl of [p, r] as PlayerId[]) {
    const sign = pl === p ? 1 : -1;
    let side = 0;
    for (const c of g.units(pl)) {
      let uv = unitValue(g, c, w);
      if (c.spent && pl === s.active && atRisk(c)) uv *= 1 - w.spentRisk;
      side += uv;
    }
    const P = g.P(pl);
    side += Math.min(P.hand.length, w.handCap) * w.hand;
    side += Math.min(P.eddies.length, w.eddieCap) * w.eddie;
    side += P.legends.filter((u) => g.c(u).faceUp).length * w.faceUpLegend;
    for (const u of P.legends) side += g.c(u).gear.length * w.legendGear;
    if (P.deck.length < w.lowDeckAt) side -= (w.lowDeckAt - P.deck.length) * w.lowDeck;
    side += planScore(g.gigsOf(pl), planFor(g, pl, p)) * w.plan;
    v += sign * side;
  }
  if (w.pkgAssembly !== 0 || w.pkgSteer !== 0 || w.pkgProtect !== 0) v += packageTerms(g, p, w);
  if (w.exposed !== 0 || w.threat !== 0 || w.rivalLethal !== 0) v += nextTurnTerms(g, p, w);
  return v;
}

const SETS: Record<string, EvalWeights> = {
  default: DEFAULT_WEIGHTS,
  nextTurn: { ...DEFAULT_WEIGHTS, exposed: 0.5, threat: 0.5, rivalLethal: 400 },
  packages: { ...DEFAULT_WEIGHTS, pkgAssembly: 6, pkgSteer: 6, pkgProtect: 3 },
  // every weight distinct, so a feature summed into the wrong term would show
  odd: { ...DEFAULT_WEIGHTS, gig: 17, gigNear: 31, unitPower: 1.7, unitCost: 0.9, unitBase: 2.3, blocker: 3.1, unitGear: 1.1, stealsTwo: 4.4, goSolo: 2.9, spentRisk: 0.21, hand: 4.1, eddie: 1.9, faceUpLegend: 5.3, legendGear: 2.7, lowDeck: 6.5, plan: 1.3, exposed: 0.37, threat: 0.61, rivalLethal: 230 },
};

/** Plays exactly as `inner`, checking the evaluation at every decision first. */
class Checker implements Agent {
  name = 'checker';
  states = 0;
  maxErr = 0;
  constructor(private inner: Agent) {}
  async decide(g: Game, d: Decision): Promise<number[]> {
    this.states++;
    for (const w of Object.values(SETS))
      for (const p of [0, 1] as PlayerId[]) {
        const v = evaluate(g, p, w);
        expect(v).toBe(evaluateBefore(g, p, w));
        const t = evaluateTerms(g, p, w);
        expect(t.total).toBe(v);
        const sum = EVAL_TERMS.reduce((s, k) => s + w[k] * t.features[k], 0) + t.packages;
        this.maxErr = Math.max(this.maxErr, Math.abs(sum - v));
        expect(Math.abs(sum - v)).toBeLessThan(1e-9 * (1 + Math.abs(v)));
      }
    return this.inner.decide(g, d);
  }
}

describe('evaluateTerms (INFO-4)', () => {
  it('evaluate() is unchanged and equals Σ weight × feature on states all through seeded games', async () => {
    let states = 0;
    for (let i = 0; i < 6; i++) {
      const a = DECKS[(i * 7) % DECKS.length];
      const b = DECKS[(i * 11 + 3) % DECKS.length];
      const A = new Checker(new HeuristicAgent({ seed: 100 + i, noise: 0.15 }));
      const B = new Checker(new HeuristicAgent({ seed: 200 + i, lookahead: false }));
      const g = Game.create([a, b], [A, B], { seed: 4000 + i, first: (i % 2) as 0 | 1, log: false });
      await g.run();
      // a finished game: ±win, every feature 0
      const t = evaluateTerms(g, 0);
      expect(t.terminal).toBe(true);
      expect(t.total).toBe(evaluate(g, 0));
      expect(EVAL_TERMS.every((k) => t.features[k] === 0)).toBe(true);
      states += A.states + B.states;
    }
    expect(states).toBeGreaterThan(300);
  }, 120_000);

  it('the next-turn features are recorded with their weights at 0, and match nextTurnTerms', async () => {
    const W = SETS.nextTurn;
    let nonzero = 0;
    const probe: Agent = {
      name: 'probe',
      decide: async (g, d) => {
        for (const p of [0, 1] as PlayerId[]) {
          const f = evaluateTerms(g, p, DEFAULT_WEIGHTS).features;
          const want = nextTurnTerms(g, p, W);
          const got = W.exposed * f.exposed + W.threat * f.threat + W.rivalLethal * f.rivalLethal;
          expect(Math.abs(got - want)).toBeLessThan(1e-9 * (1 + Math.abs(want)));
          if (f.exposed !== 0 || f.threat !== 0) nonzero++;
        }
        return inner.decide(g, d);
      },
    };
    const inner = new HeuristicAgent({ seed: 5, lookahead: false });
    const g = Game.create([DECKS[0], DECKS[1]], [probe, new HeuristicAgent({ seed: 6, lookahead: false })], { seed: 77, first: 0, log: false });
    await g.run();
    expect(nonzero).toBeGreaterThan(0);
  }, 60_000);
});
