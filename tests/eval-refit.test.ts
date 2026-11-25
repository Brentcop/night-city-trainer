// The refit of the evaluation (REVIEW_2026-11-24 B7, C.3): the fit (src/analysis/evalRefit.ts), the leaves it reads
// (mid leaves leave the game unchanged), cluster-robust SEs (src/lib/logistic.ts), and the two opt-in switches carried
// with the weights (spentRiskMainOnly, subChoiceEval), both 0 by default so no recorded game moves.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import type { Decision } from '../src/engine/types';
import { DEFAULT_WEIGHTS, EVAL_TERMS, evaluate, evaluateTerms, unitValue, type EvalWeights } from '../src/ai/eval';
import { FAST_WEIGHTS, HeuristicAgent } from '../src/ai/heuristic';
import { HAND_2026_10 } from '../src/ai/weightSets';
import { analyzeLeaves, type LeafGame } from '../src/analysis/evalCalibration';
import { foldOf, pairedBootstrap, REFIT_TERMS, refit, refitRows, sampled, watchLeaves } from '../src/analysis/evalRefit';
import { fitLogistic } from '../src/lib/logistic';
import { makeBot } from '../src/lib/tournament';
import { stateHash } from '../src/lib/savedGames';
import { loadLibrary } from '../scripts/lib-node';
import { setup, spawn } from './engine-helpers';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
}

const T = (k: string) => REFIT_TERMS.indexOf(k as (typeof REFIT_TERMS)[number]);

/**
 * Synthetic games over 8 decks: deck d has strength (d − 3.5) × 0.25 in log-odds and holds about d/2 more Blockers than
 * the rival, while a Blocker itself is worth nothing. The result follows gig (20 on the gig scale) and hand (8). Each
 * game has several rows (two ends of turns from both views and one mid row) sharing its result.
 */
function synthGames(n: number): LeafGame[] {
  const u = rng(17);
  const games: LeafGame[] = [];
  for (let s = 0; s < n; s++) {
    const a = Math.floor(u() * 8);
    let b = Math.floor(u() * 7);
    if (b >= a) b++;
    const strength = 0.25 * (a - b);
    const leaves: LeafGame['leaves'] = [];
    let z0 = 0;
    const feats: number[][] = [];
    for (let k = 0; k < 3; k++) {
      const f = REFIT_TERMS.map(() => 0);
      f[T('gig')] = Math.round((u() - 0.5) * 6);
      f[T('hand')] = Math.round((u() - 0.5) * 8);
      f[T('blocker')] = Math.round((a - b) / 2 + (u() - 0.5) * 2);
      f[T('eddie')] = Math.round((u() - 0.5) * 6);
      feats.push(f);
      z0 += 0.03 * (20 * f[T('gig')]! + 8 * f[T('hand')]!);
    }
    const z = z0 / 3 + strength;
    const aWins = u() < 1 / (1 + Math.exp(-z));
    for (let k = 0; k < 3; k++) {
      const f = feats[k]!;
      const v = 20 * f[T('gig')]! + 4.54 * f[T('hand')]! - 44.1 * f[T('blocker')]!;
      const neg = f.map((x) => -x);
      // seat 0 plays deck a; leaf k = 2 is a mid leaf from seat 0's view
      if (k < 2) leaves.push({ turn: 3 + k, seat: 0, overtime: false, v: [v, -v], vp: [v, -v], f: [f, neg] });
      else leaves.push({ turn: 5, seat: 0, overtime: false, v: [v, -v], vp: [v, -v], f: [f, neg], kind: 'mid' });
    }
    games.push({ seed: s, a: `D${a}`, b: `D${b}`, first: (s % 2) as 0 | 1, winner: aWins ? 0 : 1, leaves });
  }
  return games;
}

describe('eval refit: the fit', () => {
  it('sampling and folds: deterministic, near the rate, every fold used', () => {
    let n = 0;
    for (let k = 0; k < 20000; k++) if (sampled(81, k, 0.25)) n++;
    expect(n / 20000).toBeGreaterThan(0.23);
    expect(n / 20000).toBeLessThan(0.27);
    expect(sampled(81, 5, 0.25)).toBe(sampled(81, 5, 0.25));
    expect([0, 1, 2].every((k) => !sampled(1, k, 0))).toBe(true);
    const folds = new Array(5).fill(0);
    for (let s = 0; s < 5000; s++) folds[foldOf(s, 5)]++;
    expect(Math.min(...folds)).toBeGreaterThan(850);
  });

  it('rows: mid leaves from the active seat, ends of turns from both; terms read by name', () => {
    const games = synthGames(5);
    const rows = refitRows(games, ['mid', 'next', 'ender']);
    expect(rows.filter((r) => r.kind === 'mid')).toHaveLength(5);
    expect(rows.filter((r) => r.kind === 'next')).toHaveLength(10);
    const ender = rows.find((r) => r.kind === 'ender')!;
    const next = rows.find((r) => r.kind === 'next' && r.game === ender.game && r.turn === ender.turn)!;
    expect(next.y).toBe(1 - ender.y);
    expect(next.f[T('gig')]).toBe(-ender.f[T('gig')]!);
    // a file written by code with fewer terms: the missing term reads 0, the others by name
    const fileTerms = REFIT_TERMS.filter((t) => t !== 'hand');
    const short: LeafGame[] = games.map((g) => ({ ...g, leaves: g.leaves.map((l) => ({ ...l, f: [l.f[0].filter((_, j) => j !== T('hand')), l.f[1].filter((_, j) => j !== T('hand'))] })) }));
    const r2 = refitRows(short, ['ender'], fileTerms);
    expect(r2.every((r) => r.f[T('hand')] === 0)).toBe(true);
    expect(r2.map((r) => r.f[T('gig')])).toEqual(rows.filter((r) => r.kind === 'ender').map((r) => r.f[T('gig')]));
  });

  it('the calibration of 2026-11-12 ignores mid leaves', () => {
    const games = synthGames(400);
    const noMid = games.map((g) => ({ ...g, leaves: g.leaves.filter((l) => l.kind !== 'mid') }));
    expect(analyzeLeaves(games, 'ender').terms).toEqual(analyzeLeaves(noMid, 'ender').terms);
  });

  it('deck controls take deck strength off a term that only goes with the stronger list', () => {
    const games = synthGames(6000);
    const withDecks = refit(games, { folds: 3, lambdas: [0, 1e-3] });
    const none = refit(games, { folds: 3, lambdas: [0, 1e-3], controls: 'none' });
    const term = (r: typeof withDecks, k: string) => r.fitTerms.find((t) => t.term === k)!;
    expect(term(withDecks, 'gig').gigScale).toBeCloseTo(20, 6);
    expect(Math.abs(term(withDecks, 'hand').gigScale - 8)).toBeLessThan(2);
    // the blocker column carries the deck strength when there is no control for it
    expect(term(none, 'blocker').gigScale).toBeGreaterThan(5);
    expect(Math.abs(term(withDecks, 'blocker').gigScale)).toBeLessThan(Math.abs(term(none, 'blocker').gigScale) / 2);
    // rows of one game share its result: the by-game SE is the honest one, and larger
    expect(term(withDecks, 'gig').seCluster).toBeGreaterThan(term(withDecks, 'gig').se);
    // the fixed terms keep their current values; blocker's sign moved from −44.1 and is reported
    expect(withDecks.candidate.rivalLethal).toBe(DEFAULT_WEIGHTS.rivalLethal);
    expect(withDecks.candidate.goSolo).toBe(DEFAULT_WEIGHTS.goSolo);
    expect(withDecks.candidate.gig).toBe(20);
    const ll = (r: typeof withDecks, m: string) => r.scores.find((s) => s.model.startsWith(m))!.logLoss;
    // with the deck strengths beside each value the candidate predicts better; without them the current weights' −44.1
    // Blocker looks better only because it tracks the stronger list (no decision within a game can use that)
    expect(ll(withDecks, 'candidate weights + deck controls')).toBeLessThan(ll(withDecks, 'current weights + deck controls'));
    expect(ll(withDecks, 'candidate weights: ')).toBeGreaterThan(ll(withDecks, 'current weights: '));
    // rule 1's paired comparison over held-out games: better beyond the noise
    expect(withDecks.paired.map((p) => p.model)).toEqual(['candidate weights']);
    expect(withDecks.paired[0]!.hi).toBeLessThan(0);
    expect(none.paired).toEqual([]);
    expect(withDecks.rows.byKind.mid!.fit).toBeGreaterThan(0);
    expect(withDecks.decks).toBe(8);
  });

  it('switches ride on the candidate', () => {
    const r = refit(synthGames(800), { folds: 2, lambdas: [1e-3], switches: { spentRiskMainOnly: 1, subChoiceEval: 1 } });
    expect(r.candidate.spentRiskMainOnly).toBe(1);
    expect(r.candidate.subChoiceEval).toBe(1);
  });
});

describe('the paired bootstrap over games', () => {
  it('a constant difference has no spread; a mixed one straddles its mean', () => {
    const flat = pairedBootstrap(Array.from({ length: 50 }, () => ({ sum: -0.2, n: 10 })));
    for (const x of [flat.diff, flat.lo, flat.hi]) expect(x).toBeCloseTo(-0.02, 12);
    const mixed = pairedBootstrap(Array.from({ length: 200 }, (_, i) => ({ sum: i % 2 ? 1 : -1, n: 4 })));
    expect(mixed.diff).toBe(0);
    expect(mixed.lo).toBeLessThan(0);
    expect(mixed.hi).toBeGreaterThan(0);
    expect(pairedBootstrap([{ sum: 1, n: 2 }, { sum: 3, n: 2 }], 500, 7)).toEqual(pairedBootstrap([{ sum: 1, n: 2 }, { sum: 3, n: 2 }], 500, 7));
  });
});

describe('cluster-robust standard errors', () => {
  it('every row twice, each pair one cluster: the SE of the single rows', () => {
    const u = rng(3);
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 4000; i++) {
      const x = [u() - 0.5, u() - 0.5];
      X.push(x);
      y.push(u() < 1 / (1 + Math.exp(-(1.5 * x[0]! - x[1]!))) ? 1 : 0);
    }
    const single = fitLogistic(X, y);
    const dup = fitLogistic([...X, ...X], [...y, ...y], { clusters: [...X.keys(), ...X.keys()] });
    expect(single.seCluster).toBeUndefined();
    for (let j = 0; j < 2; j++) {
      expect(dup.beta[j]).toBeCloseTo(single.beta[j]!, 6);
      expect(dup.se[j]! * Math.SQRT2).toBeCloseTo(single.se[j]!, 6);
      expect(dup.seCluster![j]! / single.se[j]!).toBeGreaterThan(0.9);
      expect(dup.seCluster![j]! / single.se[j]!).toBeLessThan(1.1);
    }
  });
});

describe('the leaves leave the game unchanged', () => {
  const lib = loadLibrary();
  const meta = lib.filter((d) => d.kind === 'meta');
  it('a Medium game with end and mid leaves plays as without them', async () => {
    const play = async (watch: boolean) => {
      const g = Game.create([meta[0]!.deck, meta[1]!.deck], [makeBot('medium', 41), makeBot('medium', 41 + 7777)], { seed: 41, first: 0, log: false });
      const leaves = watch ? watchLeaves(g, 41, { mid: 0.5, measure: { ...DEFAULT_WEIGHTS, spentRiskMainOnly: 1 }, compare: HAND_2026_10, extra: true }) : [];
      const end = await g.run();
      return { hash: stateHash(end), leaves };
    };
    const a = await play(false);
    const b = await play(true);
    expect(b.hash).toBe(a.hash);
    expect(b.leaves.some((l) => l.kind === 'mid')).toBe(true);
    expect(b.leaves.some((l) => l.kind === undefined)).toBe(true);
    expect(b.leaves.every((l) => l.vc && l.f[0].length === REFIT_TERMS.length)).toBe(true);
    // the features read evaluate()'s value back: Σ DEFAULT_WEIGHTS × feature (readyTrick included) is the value, up to
    // the spent-risk discount the measuring weights leave out after an end phase
    const close = b.leaves.filter((l) => l.kind === 'mid').every((l) => Math.abs(REFIT_TERMS.reduce((a, k, j) => a + DEFAULT_WEIGHTS[k] * l.f[0][j]!, 0) - l.v[0]) < 0.01);
    expect(close).toBe(true);
    // the same sample every time
    const c = await play(true);
    expect(c.leaves).toEqual(b.leaves);
  });
});

describe('spentRiskMainOnly (B7)', () => {
  function riskState() {
    const { g } = setup();
    spawn(g, 0, 'psycho_squad', 'field', { spent: true }); // our spent Unit: the rival's ready 6-power Unit can beat it
    spawn(g, 1, 'psycho_squad', 'field');
    return g;
  }
  const ON: EvalWeights = { ...DEFAULT_WEIGHTS, spentRiskMainOnly: 1 };
  it('the same in the main phase; after an end phase the about-to-ready Units are not discounted', () => {
    const g = riskState();
    expect(DEFAULT_WEIGHTS.spentRiskMainOnly).toBe(0);
    expect(evaluate(g, 0, ON)).toBe(evaluate(g, 0, DEFAULT_WEIGHTS));
    g.s.phase = 'end';
    const uv = unitValue(g, g.c(g.P(0).field[0]!), DEFAULT_WEIGHTS);
    expect(evaluate(g, 0, ON) - evaluate(g, 0, DEFAULT_WEIGHTS)).toBeCloseTo(DEFAULT_WEIGHTS.spentRisk * uv, 6);
    // the feature follows the rule, so Σ weight × feature is still the value
    const t = evaluateTerms(g, 0, ON);
    expect(t.features.spentRisk).toBe(0);
    const sum = EVAL_TERMS.reduce((a, k) => a + ON[k] * t.features[k], 0) + t.packages;
    expect(sum).toBeCloseTo(t.total, 6);
  });
});

describe('subChoiceEval (B7)', () => {
  /** A harm choice between the rival's Meredith Stout (4 cost, 5 power, Blocker) and a Psycho Squad (4 cost, 6 power). */
  function harm() {
    const { g } = setup();
    const mer = spawn(g, 1, 'meredith_stout_stone_cold_corpo', 'field');
    const psy = spawn(g, 1, 'psycho_squad', 'field');
    const d: Decision = { player: 0, kind: 'unit', prompt: 'defeat a Unit', tag: 'defeat', intent: 'harm', min: 1, max: 1, options: [{ label: 'Meredith', uid: mer.uid }, { label: 'Psycho', uid: psy.uid }] };
    return { g, d, mer, psy };
  }
  const pick = async (w: EvalWeights, lookahead = true) => {
    const { g, d } = harm();
    return (await new HeuristicAgent({ seed: 3, weights: w, lookahead }).decide(g, d))[0];
  };
  it('off: the hand weights rank them (Blocker +2); on: the evaluation’s own weights (Blocker −44.1)', async () => {
    const { g, mer, psy } = harm();
    expect(g.hasKw(mer, 'blocker')).toBe(true);
    expect(unitValue(g, mer, FAST_WEIGHTS)).toBeGreaterThan(unitValue(g, psy, FAST_WEIGHTS));
    expect(unitValue(g, mer, DEFAULT_WEIGHTS)).toBeLessThan(unitValue(g, psy, DEFAULT_WEIGHTS));
    expect(await pick(DEFAULT_WEIGHTS)).toBe(0);
    expect(await pick({ ...DEFAULT_WEIGHTS, subChoiceEval: 1 })).toBe(1);
    // the fast policy's own weights are the hand weights: the switch changes nothing there
    expect(await pick({ ...FAST_WEIGHTS, subChoiceEval: 1 }, false)).toBe(await pick(FAST_WEIGHTS, false));
  });
  it('both switches are 0 in every built-in set', () => {
    for (const w of [DEFAULT_WEIGHTS, HAND_2026_10, FAST_WEIGHTS]) expect([w.spentRiskMainOnly, w.subChoiceEval]).toEqual([0, 0]);
  });
});
