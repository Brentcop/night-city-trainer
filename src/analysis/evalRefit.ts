// The refit of the bots' evaluation (REVIEW_2026-11-24 B7, C.3; scripts/eval-refit.ts). The calibration of 2026-11-12
// (src/analysis/evalCalibration.ts, `calibrated-2026-11`) fitted the result on the features at the ends of turns from
// the seat that had just ended its turn, with no control for the decks. This fit differs in three ways:
//  - deck controls: a strength per deck (own list +1, the rival's −1; the first deck the reference) and going first, so a
//    term is not credited with what the stronger list wins (a Blocker-heavy list losing more is not a Blocker's price);
//  - the rows are where the bots use the evaluation: `mid`, main-phase decision points from the active seat's view
//    (Medium's whole decision and Hard's screen score the position right after an action, in the main phase); `next`,
//    the end of a turn from the seat about to start (Hard's main-phase rollout cut: after the rival's end phase, scored
//    from the decider, who moves next); `ender`, the end of a turn from the seat that ended it (Hard's reaction cut,
//    after the decider's own turn);
//  - folds by game for the ridge penalty, and cluster-robust standard errors by game for what counts as identified.
// The target stays who won (win 1, tie ½, loss 0): the evaluation is a value estimate, and the final result is the only
// target that does not take the current evaluation's own errors as truth (a target read off the next cut would
// bootstrap from the weights being replaced). What "the next-turn view" changes is which positions and from whose seat:
// the `next` rows are exactly the position Hard scores at its cut, from the seat it scores for.
// The fitted coefficients are put on the gig scale (gig = 20, as every weight set), so the constants that sit beside
// the evaluation (win, playOutClamp, rivalLethal, the 5% one-step offset, the Call bonus) keep their meaning.
import { DEFAULT_WEIGHTS, EVAL_TERMS, type EvalTerm, type EvalWeights } from '../ai/eval';
import type { PlayerId } from '../engine/types';
import { other, type Game } from '../engine/engine';
import { brier, fitLogistic, logLoss, predict, type LogisticFit } from '../lib/logistic';
import { evalLeaf, profiledWeights, splitOf, type EvalLeaf, type LeafGame } from './evalCalibration';

export type RowKind = 'mid' | 'next' | 'ender';
export const ROW_KINDS: readonly RowKind[] = ['mid', 'next', 'ender'];

/** Is the k-th main-phase decision of the game with this seed a mid leaf (a hash below `rate`)? Draws no random number. */
export function sampled(seed: number, k: number, rate: number): boolean {
  let h = Math.imul(seed ^ 0x85ebca6b, 0x9e3779b1) ^ Math.imul(k + 1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296 < rate;
}

/**
 * Record the leaves of the live game g as it is played (scripts/worker.ts, `evalLeaves`): one after every end phase and,
 * with `mid` > 0, one at that share of the main-phase decisions (before the active seat chooses; `sampled` by the seed
 * and the decision's number). Each is evaluated on a copy and no random number is drawn, so the game is the same with or
 * without it (tests/eval-refit.test.ts); copies of g (lookahead) are not observed. Returns the list it fills.
 */
export function watchLeaves(g: Game, seed: number, o: { mid?: number; measure?: EvalWeights; compare?: EvalWeights } = {}): EvalLeaf[] {
  const leaves: EvalLeaf[] = [];
  let profiled: [EvalWeights, EvalWeights] | null = null;
  const lo = { measure: o.measure, compare: o.compare };
  const endPhase = g.endPhase.bind(g);
  g.endPhase = async () => {
    await endPhase();
    profiled ??= [profiledWeights(g, 0), profiledWeights(g, 1)];
    leaves.push(evalLeaf(g, profiled, lo));
  };
  const rate = o.mid ?? 0;
  if (rate > 0) {
    const chooseAction = g.chooseAction.bind(g);
    let k = 0;
    g.chooseAction = (p, actions) => {
      if (sampled(seed, k++, rate)) {
        profiled ??= [profiledWeights(g, 0), profiledWeights(g, 1)];
        leaves.push(evalLeaf(g, profiled, { ...lo, mid: true }));
      }
      return chooseAction(p, actions);
    };
  }
  return leaves;
}

/** The fold (0..k−1) of a game, by a hash of its seed independent of splitOf's. */
export function foldOf(seed: number, k: number): number {
  const h = Math.imul(seed ^ 0x27d4eb2f, 0x165667b1) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) % k;
}

export interface RefitRow {
  game: number;
  kind: RowKind;
  turn: number;
  /** the result for the viewing seat: win 1, tie ½, loss 0 */
  y: number;
  /** evaluate() with DEFAULT_WEIGHTS */
  v: number;
  /** evaluate() with the run's compared weights, when recorded */
  vc: number | null;
  /** the features in `terms` order */
  f: number[];
  deck: string;
  opp: string;
  wentFirst: boolean;
}

/**
 * The rows of the chosen kinds. `fileTerms` is the order the leaves' features were written in (EVAL_TERMS of the code
 * that played them); the rows come back in `terms` order, a term the file lacks as 0.
 */
export function refitRows(games: readonly LeafGame[], kinds: readonly RowKind[], fileTerms: readonly string[] = EVAL_TERMS, terms: readonly string[] = EVAL_TERMS): RefitRow[] {
  const ix = terms.map((t) => fileTerms.indexOf(t));
  const want = new Set(kinds);
  const rows: RefitRow[] = [];
  for (const gm of games)
    for (const l of gm.leaves) {
      const views: [RowKind, 0 | 1][] = l.kind === 'mid' ? [['mid', 0]] : [['ender', 0], ['next', 1]];
      for (const [kind, k] of views) {
        if (!want.has(kind)) continue;
        const p: PlayerId = k === 0 ? l.seat : other(l.seat);
        const raw = l.f[k];
        rows.push({
          game: gm.seed,
          kind,
          turn: l.turn,
          y: gm.winner === 'tie' ? 0.5 : gm.winner === p ? 1 : 0,
          v: l.v[k],
          vc: l.vc ? l.vc[k] : null,
          f: ix.map((j) => (j >= 0 ? raw[j]! : 0)),
          deck: p === 0 ? gm.a : gm.b,
          opp: p === 0 ? gm.b : gm.a,
          wentFirst: gm.first === p,
        });
      }
    }
  return rows;
}

/** The deck-control columns: a strength per deck (own +1, rival −1; the first deck in order is the reference) and going first (±1). */
export function deckControls(rows: readonly RefitRow[]): { decks: string[]; of: (r: RefitRow) => number[] } {
  const decks = [...new Set(rows.flatMap((r) => [r.deck, r.opp]))].sort().slice(1);
  const ix = new Map(decks.map((d, i) => [d, i]));
  return {
    decks,
    of: (r) => {
      const c = new Array<number>(decks.length + 1).fill(0);
      const a = ix.get(r.deck);
      const b = ix.get(r.opp);
      if (a !== undefined) c[a]! += 1;
      if (b !== undefined) c[b]! -= 1;
      c[decks.length] = r.wentFirst ? 1 : -1;
      return c;
    },
  };
}

/**
 * Terms whose weight the fit does not set, with the reason. Their features stay in the fit (so they absorb what they
 * stand for), and the candidate keeps the current value.
 */
export const FIXED_TERMS: Partial<Record<EvalTerm, string>> = {
  goSolo: 'by argument (BOT-A, SIM_VERSION 8): going solo makes the same Unit as the ordinary play, only ready, so the flag carries no lasting cost; the fit can only see an association',
  rivalLethal: 'a decided game (the rival starts its turn with 7+ Gigs): near-separation, so the coefficient is not a price; kept at its argued value',
};

export const REFIT_LAMBDAS = [0, 1e-4, 1e-3, 3e-3, 1e-2, 3e-2];

export interface RefitOptions {
  kinds?: readonly RowKind[];
  /** 'decks' (default): deck strengths and going first as controls; 'none': the features alone, as in 2026-11-12 */
  controls?: 'decks' | 'none';
  /** folds by game for choosing λ (default 5) */
  folds?: number;
  lambdas?: readonly number[];
  /** the weights the candidate departs from (default DEFAULT_WEIGHTS) */
  current?: EvalWeights;
  /** the order the leaves' features were written in (default EVAL_TERMS) */
  fileTerms?: readonly string[];
  /** switches the candidate carries (e.g. spentRiskMainOnly, which the features were measured under) */
  switches?: Partial<EvalWeights>;
}

export interface RefitTerm {
  term: EvalTerm;
  current: number;
  /** share of fitting rows where the feature is not 0 */
  nonzero: number;
  beta: number;
  /** model-based and cluster-robust (by game) standard errors of beta */
  se: number;
  seCluster: number;
  /** β × current gig / β_gig, and its cluster-robust SE */
  gigScale: number;
  gigScaleSe: number;
  identified: boolean;
  /** why the candidate keeps the current value, when it does */
  kept?: string;
  candidate: number;
  /** identified, both non-zero, and the candidate's sign differs from the current weight's */
  signFlip: boolean;
}

export interface RefitScore {
  model: string;
  params: number;
  /** held-out log-loss and Brier over all held-out rows, and the log-loss by row kind */
  logLoss: number;
  brier: number;
  byKind: Partial<Record<RowKind, number>>;
}

export interface RefitReport {
  kinds: RowKind[];
  controls: 'decks' | 'none';
  terms: readonly EvalTerm[];
  rows: { fit: number; test: number; byKind: Partial<Record<RowKind, { fit: number; test: number }>> };
  games: { fit: number; test: number };
  decks: number;
  folds: number;
  lambda: number;
  cvPath: { lambda: number; cvLogLoss: number }[];
  /** held-out scores (games none of the fits saw) */
  scores: RefitScore[];
  fitTerms: RefitTerm[];
  candidate: Partial<EvalWeights>;
  /**
   * How far the linear reading of the current weights (Σ current × feature) is from evaluate()'s value on the rows: the
   * features stand in for the evaluation only when this is small (the measuring weights' switches, rounding).
   */
  linearCheck: { meanAbs: number; maxAbs: number };
  /**
   * Rule 1's comparison with its noise (with deck controls only): the held-out log-loss of the candidate's value, and of
   * the recorded compared weights' when there are any, minus the current weights', each beside the deck controls; a
   * paired bootstrap over held-out games (BOOT resamples) gives the 95% interval. Below 0: better than the current.
   */
  paired: { model: string; diff: number; lo: number; hi: number }[];
}

export const BOOT = 2000;

/**
 * The mean of Σ_rows d over Σ_rows 1, and its 95% interval by resampling games (seeded, so the same rows give the same
 * interval). `perGame`: each game's sum of d and its row count.
 */
export function pairedBootstrap(perGame: readonly { sum: number; n: number }[], reps = BOOT, seed = 12345): { diff: number; lo: number; hi: number } {
  const tot = perGame.reduce((a, g) => ({ sum: a.sum + g.sum, n: a.n + g.n }), { sum: 0, n: 0 });
  let st = seed >>> 0;
  const u = () => (st = (st * 1664525 + 1013904223) >>> 0) / 4294967296;
  const stats: number[] = [];
  const G = perGame.length;
  for (let b = 0; b < reps; b++) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < G; i++) {
      const g = perGame[Math.floor(u() * G)]!;
      sum += g.sum;
      n += g.n;
    }
    stats.push(n ? sum / n : 0);
  }
  stats.sort((a, b) => a - b);
  return { diff: tot.n ? tot.sum / tot.n : 0, lo: stats[Math.floor(0.025 * reps)] ?? 0, hi: stats[Math.min(reps - 1, Math.ceil(0.975 * reps) - 1)] ?? 0 };
}

const rowLoss = (p: number, y: number) => {
  const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
};

const sig3 = (x: number) => +x.toPrecision(3);

/** σ(a·x) fitted on the fit rows (no intercept), scored on the test rows. */
function oneParam(fitX: number[], fitY: number[], testX: number[]): { a: number; p: number[] } {
  const f = fitLogistic(
    fitX.map((x) => [x]),
    fitY,
    { intercept: false },
  );
  return { a: f.beta[0]!, p: predict(f, testX.map((x) => [x])) };
}

/**
 * The refit: rows of the chosen kinds, held-out games by splitOf ('test'), λ by K folds of the other games, the final
 * fit on all of them with cluster-robust SEs, and a candidate weight set on the gig scale.
 */
export function refit(games: readonly LeafGame[], o: RefitOptions = {}): RefitReport {
  const kinds = [...(o.kinds ?? ROW_KINDS)];
  const controls = o.controls ?? 'decks';
  const K = o.folds ?? 5;
  const lambdas = o.lambdas ?? REFIT_LAMBDAS;
  const current = o.current ?? DEFAULT_WEIGHTS;
  const terms = EVAL_TERMS;
  const all = refitRows(games, kinds, o.fileTerms ?? EVAL_TERMS, terms);
  const fitRows = all.filter((r) => splitOf(r.game) !== 'test');
  const test = all.filter((r) => splitOf(r.game) === 'test');
  if (!fitRows.length || !test.length) throw new Error(`refit needs rows in both the fitting and the held-out games (got ${fitRows.length} and ${test.length})`);
  const ctl = controls === 'decks' ? deckControls(all) : null;
  const X = (rs: readonly RefitRow[]) => rs.map((r) => (ctl ? [...r.f, ...ctl.of(r)] : r.f));
  const Y = (rs: readonly RefitRow[]) => rs.map((r) => r.y);

  // λ by K folds of the fitting games (rows weighted equally)
  const cvPath = lambdas.map((lambda) => {
    let loss = 0;
    let n = 0;
    for (let k = 0; k < K; k++) {
      const tr = fitRows.filter((r) => foldOf(r.game, K) !== k);
      const va = fitRows.filter((r) => foldOf(r.game, K) === k);
      if (!tr.length || !va.length) continue;
      const f = fitLogistic(X(tr), Y(tr), { lambda });
      loss += logLoss(predict(f, X(va)), Y(va)) * va.length;
      n += va.length;
    }
    return { lambda, cvLogLoss: n ? loss / n : Infinity };
  });
  const lambda = cvPath.reduce((a, b) => (b.cvLogLoss < a.cvLogLoss ? b : a)).lambda;
  const fit: LogisticFit = fitLogistic(X(fitRows), Y(fitRows), { lambda, clusters: fitRows.map((r) => r.game) });

  // the terms on the gig scale
  const gi = terms.indexOf('gig');
  const s = current.gig / fit.beta[gi]!;
  const fitTerms: RefitTerm[] = terms.map((term, j) => {
    const nonzero = fitRows.filter((r) => r.f[j] !== 0).length / fitRows.length;
    const beta = fit.beta[j]!;
    const seCluster = fit.seCluster![j]!;
    const gigScale = beta * s;
    const gigScaleSe = seCluster * Math.abs(s);
    const cur = current[term];
    const identified = term === 'gig' || (nonzero >= 0.02 && 1.96 * gigScaleSe < Math.max(Math.abs(cur), Math.abs(gigScale)));
    const fixed = FIXED_TERMS[term];
    const kept = fixed ?? (identified ? undefined : 'not identified: varies in under 2% of rows, or its 95% interval is wider than both the current and the fitted value');
    const candidate = kept ? cur : term === 'gig' ? current.gig : sig3(gigScale);
    return { term, current: cur, nonzero, beta, se: fit.se[j]!, seCluster, gigScale, gigScaleSe, identified, kept, candidate, signFlip: !kept && cur !== 0 && candidate !== 0 && Math.sign(cur) !== Math.sign(candidate) };
  });
  const candidate: Partial<EvalWeights> = { ...(o.switches ?? {}) };
  for (const t of fitTerms) candidate[t.term] = t.candidate;

  // held-out scores
  const yt = Y(test);
  const yf = Y(fitRows);
  const byKind = (p: readonly number[]): Partial<Record<RowKind, number>> =>
    Object.fromEntries(
      kinds.map((k) => {
        const ix = test.map((r, i) => (r.kind === k ? i : -1)).filter((i) => i >= 0);
        return [k, ix.length ? logLoss(ix.map((i) => p[i]!), ix.map((i) => yt[i]!)) : NaN];
      }),
    );
  const score = (model: string, params: number, p: number[]): RefitScore => ({ model, params, logLoss: logLoss(p, yt), brier: brier(p, yt), byKind: byKind(p) });
  const base = yf.reduce((a, y) => a + y, 0) / yf.length;
  const lin = (w: Partial<EvalWeights>, r: RefitRow) => terms.reduce((a, t, j) => a + (w[t] ?? 0) * r.f[j]!, 0);
  const nCtl = ctl ? ctl.decks.length + 1 : 0;
  const scores: RefitScore[] = [score('coin (fitting win rate)', 1, test.map(() => base))];
  const paired: RefitReport['paired'] = [];
  const cur = oneParam(
    fitRows.map((r) => r.v),
    yf,
    test.map((r) => r.v),
  );
  scores.push(score('current weights: σ(a·value)', 1, cur.p));
  const cand = oneParam(
    fitRows.map((r) => lin(candidate, r)),
    yf,
    test.map((r) => lin(candidate, r)),
  );
  scores.push(score('candidate weights: σ(a·Σ candidate × feature)', 1, cand.p));
  // what keeping the unidentified terms at their current values costs: every term at its fitted value (fixed ones kept)
  const every: Partial<EvalWeights> = Object.fromEntries(fitTerms.map((t) => [t.term, FIXED_TERMS[t.term] ? t.current : t.term === 'gig' ? current.gig : t.gigScale]));
  const ev = oneParam(
    fitRows.map((r) => lin(every, r)),
    yf,
    test.map((r) => lin(every, r)),
  );
  scores.push(score('every term at its fitted value: σ(a·Σ fit × feature)', 1, ev.p));
  if (fitRows.every((r) => r.vc !== null) && test.every((r) => r.vc !== null)) {
    const cmp = oneParam(
      fitRows.map((r) => r.vc!),
      yf,
      test.map((r) => r.vc!),
    );
    scores.push(score('compared weights: σ(a·value) (recorded)', 1, cmp.p));
  }
  if (ctl) {
    // the decisive comparison: within one game the decks are fixed, so a weight that tracks list strength helps the
    // uncontrolled score and no decision; with the controls beside each value, only what varies within a game counts
    const withCtl = (name: string, val: (r: RefitRow) => number) => {
      const vx = (rs: readonly RefitRow[]) => rs.map((r) => [val(r), ...ctl.of(r)]);
      // the fit's λ on every column, the same for each value compared (deck strengths are many columns on few games each)
      const f = fitLogistic(vx(fitRows), yf, { lambda });
      const p = predict(f, vx(test));
      scores.push(score(`${name} + deck controls: σ(b + a·value + decks + first), λ ${lambda}`, nCtl + 2, p));
      return p;
    };
    const pc = withCtl('current weights', (r) => r.v);
    const against = (model: string, p: number[]) => {
      const byGame = new Map<number, { sum: number; n: number }>();
      test.forEach((r, i) => {
        const g = byGame.get(r.game) ?? { sum: 0, n: 0 };
        g.sum += rowLoss(p[i]!, r.y) - rowLoss(pc[i]!, r.y);
        g.n++;
        byGame.set(r.game, g);
      });
      paired.push({ model, ...pairedBootstrap([...byGame.values()]) });
    };
    against('candidate weights', withCtl('candidate weights', (r) => lin(candidate, r)));
    if (fitRows.every((r) => r.vc !== null) && test.every((r) => r.vc !== null)) against('compared weights (recorded)', withCtl('compared weights (recorded)', (r) => r.vc!));
    const fo = fitLogistic(
      fitRows.map((r) => ctl.of(r)),
      yf,
      { lambda },
    );
    scores.push(
      score(
        'deck controls only (no position)',
        nCtl + 1,
        predict(
          fo,
          test.map((r) => ctl.of(r)),
        ),
      ),
    );
  }
  scores.push(score(`ridge logistic on ${terms.length} features${ctl ? ` + ${ctl.decks.length} deck strengths + first player` : ''} (λ ${lambda})`, terms.length + nCtl + 1, predict(fit, X(test))));

  const diffs = all.map((r) => Math.abs(lin(current, r) - r.v));
  const byKindRows = Object.fromEntries(kinds.map((k) => [k, { fit: fitRows.filter((r) => r.kind === k).length, test: test.filter((r) => r.kind === k).length }]));
  return {
    kinds,
    controls,
    terms,
    rows: { fit: fitRows.length, test: test.length, byKind: byKindRows },
    games: { fit: new Set(fitRows.map((r) => r.game)).size, test: new Set(test.map((r) => r.game)).size },
    decks: ctl ? ctl.decks.length + 1 : new Set(all.flatMap((r) => [r.deck, r.opp])).size,
    folds: K,
    lambda,
    cvPath,
    scores,
    fitTerms,
    candidate,
    linearCheck: { meanAbs: diffs.reduce((a, x) => a + x, 0) / Math.max(1, diffs.length), maxAbs: diffs.reduce((a, x) => Math.max(a, x), 0) },
    paired,
  };
}

// ---------------------------------------------------------------- report

const f4 = (x: number) => (Number.isFinite(x) ? x.toFixed(4) : '—');

export function refitMarkdown(r: RefitReport): string {
  const L: string[] = [];
  L.push(`Rows: ${r.kinds.map((k) => `${k} ${r.rows.byKind[k]?.fit ?? 0} / ${r.rows.byKind[k]?.test ?? 0}`).join(', ')} (fitting / held-out); games ${r.games.fit} / ${r.games.test}; ${r.decks} decks; controls: ${r.controls === 'decks' ? 'deck strengths + going first' : 'none'}.`);
  L.push('');
  L.push(`Ridge λ by ${r.folds} folds of the fitting games: ${r.lambda} (${r.cvPath.map((p) => `${p.lambda}: ${f4(p.cvLogLoss)}`).join(', ')}).`);
  L.push('');
  L.push(`Linear reading of the current weights against evaluate(): mean |difference| ${r.linearCheck.meanAbs.toFixed(2)}, max ${r.linearCheck.maxAbs.toFixed(1)} evaluation points (the features were measured with the run's measuring weights).`);
  L.push('');
  L.push('### Held-out scores (games no fit saw)');
  L.push('');
  L.push(`| model | params | log-loss | Brier | ${r.kinds.map((k) => `log-loss ${k}`).join(' | ')} |`, `|---|---|---|---|${r.kinds.map(() => '---').join('|')}|`);
  for (const s of r.scores) L.push(`| ${s.model} | ${s.params} | ${f4(s.logLoss)} | ${f4(s.brier)} | ${r.kinds.map((k) => f4(s.byKind[k] ?? NaN)).join(' | ')} |`);
  L.push('');
  L.push('The comparison that decides (rule 1): the candidate (or compared) weights against the current weights, each "+ deck controls": one slope on the value the bot would compute, beside the same deck strengths and first player. Within a game the decks are fixed, so a weight that only tracks which list is stronger improves the lines without controls and no decision. The ridge line is the fit itself, which no bot can use.');
  L.push('');
  for (const p of r.paired)
    L.push(`Paired against the current weights (both + deck controls; ${BOOT} resamples of held-out games): ${p.model} ${p.diff >= 0 ? '+' : ''}${p.diff.toFixed(4)} log-loss [${p.lo.toFixed(4)}, ${p.hi.toFixed(4)}]${p.hi < 0 ? ': better' : p.lo > 0 ? ': worse' : ': not distinguishable'}.`);
  if (r.paired.length) L.push('');
  L.push('### Terms on the gig scale (gig = 20)');
  L.push('');
  L.push('Identified: varies in 2%+ of rows and the 95% interval (cluster-robust by game) is narrower than the larger of the current and fitted values. A sign flip needs a stated reason before the set is used.');
  L.push('');
  L.push('| term | current | fit ± 1.96 SE (by game) | SE ratio (by game / model) | rows ≠ 0 | candidate | note |', '|---|---|---|---|---|---|---|');
  for (const t of r.fitTerms)
    L.push(
      `| ${t.term} | ${t.current} | ${t.gigScale.toPrecision(3)} ± ${(1.96 * t.gigScaleSe).toPrecision(2)} | ${t.se > 0 ? (t.seCluster / t.se).toFixed(2) : '—'} | ${(100 * t.nonzero).toFixed(1)}% | ${t.candidate} | ${t.signFlip ? '**sign flip**' : t.kept ? (FIXED_TERMS[t.term] ? 'fixed by argument' : 'not identified') : ''} |`,
    );
  L.push('');
  const flips = r.fitTerms.filter((t) => t.signFlip);
  L.push(flips.length ? `Sign flips: ${flips.map((t) => `${t.term} (${t.current} → ${t.candidate})`).join(', ')}.` : 'Sign flips: none.');
  L.push('');
  return L.join('\n');
}

/** The candidate as a block for src/ai/weightSets.ts, with its provenance. */
export function weightSetBlock(name: string, constName: string, r: RefitReport, provenance: string[]): string {
  const ctl = r.controls === 'decks' ? ' + deck controls' : ': ';
  const cur = r.scores.find((s) => s.model.startsWith(`current weights${ctl}`))!;
  const cand = r.scores.find((s) => s.model.startsWith(`candidate weights${ctl}`))!;
  const L = ['/**', ` * ${name} (REVIEW_2026-11-24 C.3): ${provenance.join(' ')}`];
  L.push(` * Rows ${r.kinds.join(' + ')}, controls ${r.controls}, λ ${r.lambda} by ${r.folds} folds; held-out log-loss of σ(a·value${r.controls === 'decks' ? ' + decks' : ''}) ${cand.logLoss.toFixed(4)} against the current weights' ${cur.logLoss.toFixed(4)} on ${r.games.test} games.`);
  const kept = r.fitTerms.filter((t) => t.kept).map((t) => t.term);
  if (kept.length) L.push(` * Kept at the current value: ${kept.join(', ')}. Not the default: accept only with the per-deck report.`);
  L.push(' */');
  L.push(`export const ${constName}: Partial<EvalWeights> = {`);
  for (const [k, v] of Object.entries(r.candidate)) L.push(`  ${k}: ${v},`);
  L.push('};');
  return L.join('\n');
}
