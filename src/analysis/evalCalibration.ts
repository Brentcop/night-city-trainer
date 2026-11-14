// INFO-4: does evaluate() predict who wins? Leaves are the ends of turns of real games (where deep rollouts evaluate),
// each with evaluate()'s features from both seats' view and the game's result. scripts/eval-calibrate.ts collects them
// (scripts/worker.ts, `evalLeaves`) and runs analyzeLeaves(): a calibration table of the current value, a one-parameter
// logistic on it, a ridge logistic on the features (src/lib/logistic.ts), and a candidate weight set on the gig scale.
import { other, type Game } from '../engine/engine';
import type { PlayerId } from '../engine/types';
import { DEFAULT_WEIGHTS, EVAL_TERMS, evaluateTerms, seatArchetype, type EvalTerm, type EvalWeights } from '../ai/eval';
import { applyProfile, BEST_PROFILES } from '../ai/archetype';
import { brier, chooseRidge, fitLogistic, logLoss, predict, type LogisticFit } from '../lib/logistic';

/** One end of a turn: evaluate()'s value and features from the view of the seat that just ended it and of the seat about to start. */
export interface EvalLeaf {
  /** the game's turn counter (both players' turns) at that end of turn */
  turn: number;
  /** the seat that just ended its turn */
  seat: PlayerId;
  overtime: boolean;
  /** evaluate() with DEFAULT_WEIGHTS: [ender's view, next seat's view] */
  v: [number, number];
  /** evaluate() with each viewing seat's matchup-profiled weights (Hard's: DEFAULT_WEIGHTS × BEST_PROFILES) */
  vp: [number, number];
  /** features in EVAL_TERMS order, measured with DEFAULT_WEIGHTS: [ender's view, next seat's view] */
  f: [number[], number[]];
}

export interface LeafGame {
  seed: number;
  a: string;
  b: string;
  first: PlayerId;
  winner: PlayerId | 'tie';
  leaves: EvalLeaf[];
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** The weights a Hard-like bot (BEST_PROFILES) uses for seat p in this game. */
export function profiledWeights(g: Game, p: PlayerId, base: EvalWeights = DEFAULT_WEIGHTS): EvalWeights {
  const me = seatArchetype(g, p);
  const opp = seatArchetype(g, other(p));
  return applyProfile(base, BEST_PROFILES, me, opp);
}

/**
 * The leaf for the end of the turn just played (call it after the end phase has run: the active seat is the one about to
 * start). Evaluated on a copy, so the game's own state and caches are not touched.
 */
export function evalLeaf(g: Game, profiled: readonly [EvalWeights, EvalWeights]): EvalLeaf {
  const c = g.clone(g.agents);
  const next = c.s.active;
  const ender = other(next);
  const views = [ender, next] as const;
  const t = views.map((p) => evaluateTerms(c, p, DEFAULT_WEIGHTS));
  const vp = views.map((p) => evaluateTerms(c, p, profiled[p]).total);
  return {
    turn: c.s.turn,
    seat: ender,
    overtime: c.s.overtime,
    v: [r4(t[0]!.total), r4(t[1]!.total)],
    vp: [r4(vp[0]!), r4(vp[1]!)],
    f: [EVAL_TERMS.map((k) => r4(t[0]!.features[k])), EVAL_TERMS.map((k) => r4(t[1]!.features[k]))],
  };
}

// ---------------------------------------------------------------- analysis

export type Stage = 'early' | 'mid' | 'late';
/** Game stage by the turn counter, as the benchmark (INFO-5): turns 1–4, 5–9, 10+. */
export const stageOf = (turn: number): Stage => (turn <= 4 ? 'early' : turn <= 9 ? 'mid' : 'late');
export const STAGES: readonly Stage[] = ['early', 'mid', 'late'];

/** Train / validation / held-out by game, from a hash of the seed (≈ 60 / 15 / 25%). */
export function splitOf(seed: number): 'train' | 'valid' | 'test' {
  const h = (Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0) % 100;
  return h < 60 ? 'train' : h < 75 ? 'valid' : 'test';
}

/** The view a row is taken from: the seat that just ended its turn, or the seat about to start (a rollout's leaf). */
export type View = 'ender' | 'next';

export interface Row {
  game: number;
  turn: number;
  stage: Stage;
  y: number;
  v: number;
  vp: number;
  f: number[];
  /** the viewing seat's deck and the rival's, and whether the viewing seat went first */
  deck: string;
  opp: string;
  wentFirst: boolean;
}

export function rowsOf(games: readonly LeafGame[], view: View): Row[] {
  const k = view === 'ender' ? 0 : 1;
  const rows: Row[] = [];
  for (const gm of games)
    for (const l of gm.leaves) {
      const p = k === 0 ? l.seat : other(l.seat);
      const y = gm.winner === 'tie' ? 0.5 : gm.winner === p ? 1 : 0;
      rows.push({ game: gm.seed, turn: l.turn, stage: stageOf(l.turn), y, v: l.v[k], vp: l.vp[k], f: l.f[k], deck: p === 0 ? gm.a : gm.b, opp: p === 0 ? gm.b : gm.a, wentFirst: gm.first === p });
    }
  return rows;
}

export interface CalibrationBin {
  lo: number;
  hi: number;
  n: number;
  meanV: number;
  winRate: number;
  /** binomial standard error of winRate */
  se: number;
}

/** Evaluation points: bins of the current value (edges in evaluation points; GIG_SWING = 40 is one stolen Gig). */
export const VALUE_EDGES = [-200, -120, -80, -50, -25, -10, 10, 25, 50, 80, 120, 200];

export function calibrationTable(rows: readonly { v: number; y: number }[], edges: readonly number[] = VALUE_EDGES): CalibrationBin[] {
  const bounds = [-Infinity, ...edges, Infinity];
  const out: CalibrationBin[] = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const lo = bounds[i]!;
    const hi = bounds[i + 1]!;
    const sel = rows.filter((r) => r.v > lo && r.v <= hi);
    const n = sel.length;
    const w = n ? sel.reduce((s, r) => s + r.y, 0) / n : 0;
    out.push({ lo, hi, n, meanV: n ? sel.reduce((s, r) => s + r.v, 0) / n : 0, winRate: w, se: n ? Math.sqrt((w * (1 - w)) / n) : 0 });
  }
  return out;
}

export interface ScoreLine {
  model: string;
  params: number;
  logLoss: number;
  brier: number;
}

export interface TermWeight {
  term: EvalTerm;
  hand: number;
  /** share of rows where the feature is not 0 */
  nonzero: number;
  /** fitted coefficient (log-odds per unit of the feature) and its SE */
  beta: number;
  se: number;
  /** fitted coefficient on the gig scale: β × hand gig / β_gig */
  gigScale: number;
  gigScaleSe: number;
  /** fitted coefficient on the current value's scale: β / a, a = the one-parameter slope on evaluate() */
  valueScale: number;
  identified: boolean;
}

export interface CalibrationReport {
  view: View;
  rows: { train: number; valid: number; test: number };
  games: { train: number; valid: number; test: number };
  /** win rate per value bin, held-out + training rows together (the value is not fitted) */
  table: CalibrationBin[];
  tableByStage: Record<Stage, CalibrationBin[]>;
  /** σ(a × value) fitted on train: slope per evaluation point */
  slope: number;
  slopeByStage: Record<Stage, number>;
  /** held-out scores */
  scores: ScoreLine[];
  lambda: number;
  ridgePath: { lambda: number; validLogLoss: number }[];
  terms: TermWeight[];
  intercept: number;
  /** held-out log-loss with stage interactions, and the λ chosen for them */
  stageModel: { lambda: number; logLoss: number; brier: number; gigScaleByStage: Record<Stage, Record<string, number>> } | null;
  /** the candidate weight set: identified terms on the gig scale, the rest at their hand values */
  candidate: Partial<EvalWeights>;
}

export const RIDGE_GRID = [0, 1e-4, 3e-4, 1e-3, 3e-3, 1e-2, 3e-2, 0.1];

const constant = (p: number, n: number) => new Array<number>(n).fill(p);

/** Identified: the feature varies in at least 2% of rows and its 95% interval on the gig scale is narrower than the larger of the hand and fitted magnitudes. */
const identifiedRule = (nonzero: number, gigScale: number, gigScaleSe: number, hand: number) => nonzero >= 0.02 && 1.96 * gigScaleSe < Math.max(Math.abs(hand), Math.abs(gigScale));

export function analyzeLeaves(games: readonly LeafGame[], view: View, o: { stageInteractions?: boolean; deckEffects?: boolean; hand?: EvalWeights } = {}): CalibrationReport {
  const hand = o.hand ?? DEFAULT_WEIGHTS;
  const all = rowsOf(games, view);
  const part = { train: [] as Row[], valid: [] as Row[], test: [] as Row[] };
  for (const r of all) part[splitOf(r.game)].push(r);
  const fitRows = [...part.train, ...part.valid];
  const gamesIn = (rs: Row[]) => new Set(rs.map((r) => r.game)).size;
  const yOf = (rs: Row[]) => rs.map((r) => r.y);
  const test = part.test;
  const yt = yOf(test);

  // the current value, one parameter: σ(a v); then with an intercept
  const one = fitLogistic(
    fitRows.map((r) => [r.v]),
    yOf(fitRows),
    { intercept: false },
  );
  const slope = one.beta[0]!;
  const two = fitLogistic(
    fitRows.map((r) => [r.v]),
    yOf(fitRows),
  );
  const oneP = fitLogistic(
    fitRows.map((r) => [r.vp]),
    yOf(fitRows),
    { intercept: false },
  );
  const slopeByStage = Object.fromEntries(
    STAGES.map((st) => {
      const rs = fitRows.filter((r) => r.stage === st);
      return [st, rs.length ? fitLogistic(rs.map((r) => [r.v]), yOf(rs), { intercept: false }).beta[0]! : 0];
    }),
  ) as Record<Stage, number>;
  const base = yOf(fitRows).reduce((s, y) => s + y, 0) / Math.max(1, fitRows.length);
  const score = (model: string, params: number, p: number[]): ScoreLine => ({ model, params, logLoss: logLoss(p, yt), brier: brier(p, yt) });
  const scores: ScoreLine[] = [
    score('coin (training win rate)', 1, constant(base, test.length)),
    score('σ(a·value), DEFAULT_WEIGHTS', 1, predict(one, test.map((r) => [r.v]))),
    score('σ(b + a·value)', 2, predict(two, test.map((r) => [r.v]))),
    score('σ(a·value), profiled weights (Hard)', 1, predict(oneP, test.map((r) => [r.vp]))),
    score('σ(a_stage·value), slope per stage', 3, test.map((r) => 1 / (1 + Math.exp(-slopeByStage[r.stage] * r.v)))),
  ];

  // the features; with deckEffects also a strength per deck (+1 own, −1 rival's; the first deck is the reference) and
  // going first, so a term is not credited with what the stronger list or the seat wins
  const decks = o.deckEffects ? [...new Set(all.flatMap((r) => [r.deck, r.opp]))].sort().slice(1) : [];
  const deckIx = new Map(decks.map((d, i) => [d, i]));
  const controls = (r: Row): number[] => {
    if (!o.deckEffects) return [];
    const c = new Array<number>(decks.length + 1).fill(0);
    const a = deckIx.get(r.deck);
    const b = deckIx.get(r.opp);
    if (a !== undefined) c[a] = (c[a] ?? 0) + 1;
    if (b !== undefined) c[b] = (c[b] ?? 0) - 1;
    c[decks.length] = r.wentFirst ? 1 : -1;
    return c;
  };
  const X = (rs: Row[]) => rs.map((r) => [...r.f, ...controls(r)]);
  const ridge = chooseRidge({ X: X(part.train), y: yOf(part.train) }, { X: X(part.valid), y: yOf(part.valid) }, RIDGE_GRID);
  const fit: LogisticFit = fitLogistic(X(fitRows), yOf(fitRows), { lambda: ridge.lambda });
  const nControls = o.deckEffects ? decks.length + 1 : 0;
  scores.push(score(`ridge logistic on ${EVAL_TERMS.length} features${o.deckEffects ? ` + ${decks.length} deck strengths + first player` : ''} (λ ${ridge.lambda})`, EVAL_TERMS.length + nControls + 1, predict(fit, X(test))));
  if (o.deckEffects) {
    const ctl = (rs: Row[]) => rs.map(controls);
    const only = fitLogistic(ctl(fitRows), yOf(fitRows));
    scores.push(score('decks + first player only (no position)', nControls + 1, predict(only, ctl(test))));
  }
  const gi = EVAL_TERMS.indexOf('gig');
  const s = hand.gig / fit.beta[gi]!;
  const terms: TermWeight[] = EVAL_TERMS.map((term, j) => {
    const nonzero = fitRows.filter((r) => r.f[j] !== 0).length / Math.max(1, fitRows.length);
    const beta = fit.beta[j]!;
    const se = fit.se[j]!;
    const gigScale = beta * s;
    const gigScaleSe = se * Math.abs(s);
    return { term, hand: hand[term], nonzero, beta, se, gigScale, gigScaleSe, valueScale: beta / slope, identified: term === 'gig' || identifiedRule(nonzero, gigScale, gigScaleSe, hand[term]) };
  });
  const candidate: Partial<EvalWeights> = {};
  for (const t of terms) candidate[t.term] = t.identified ? +t.gigScale.toPrecision(3) : hand[t.term];

  let stageModel: CalibrationReport['stageModel'] = null;
  if (o.stageInteractions) {
    const Xs = (rs: Row[]) => rs.map((r) => [...r.f, ...r.f.map((x) => (r.stage === 'mid' ? x : 0)), ...r.f.map((x) => (r.stage === 'late' ? x : 0)), ...controls(r)]);
    const rs = chooseRidge({ X: Xs(part.train), y: yOf(part.train) }, { X: Xs(part.valid), y: yOf(part.valid) }, RIDGE_GRID);
    const sf = fitLogistic(Xs(fitRows), yOf(fitRows), { lambda: rs.lambda });
    const p = predict(sf, Xs(test));
    const d = EVAL_TERMS.length;
    const gigScaleByStage = Object.fromEntries(
      STAGES.map((st, k) => {
        const coef = (j: number) => sf.beta[j]! + (k > 0 ? sf.beta[j + k * d]! : 0);
        const sc = hand.gig / coef(gi);
        return [st, Object.fromEntries(EVAL_TERMS.map((t, j) => [t, +(coef(j) * sc).toPrecision(3)]))];
      }),
    ) as Record<Stage, Record<string, number>>;
    stageModel = { lambda: rs.lambda, logLoss: logLoss(p, yt), brier: brier(p, yt), gigScaleByStage };
    scores.push({ model: `ridge logistic, features × stage (λ ${rs.lambda})`, params: 3 * d + 1, logLoss: stageModel.logLoss, brier: stageModel.brier });
  }

  const tableByStage = Object.fromEntries(STAGES.map((st) => [st, calibrationTable(all.filter((r) => r.stage === st))])) as Record<Stage, CalibrationBin[]>;
  return {
    view,
    rows: { train: part.train.length, valid: part.valid.length, test: test.length },
    games: { train: gamesIn(part.train), valid: gamesIn(part.valid), test: gamesIn(test) },
    table: calibrationTable(all),
    tableByStage,
    slope,
    slopeByStage,
    scores,
    lambda: ridge.lambda,
    ridgePath: ridge.path,
    terms,
    intercept: fit.intercept,
    stageModel,
    candidate,
  };
}

// ---------------------------------------------------------------- report

const pct = (x: number) => (100 * x).toFixed(1);
const edge = (x: number) => (x === -Infinity ? '−∞' : x === Infinity ? '+∞' : String(x));

function tableMd(bins: readonly CalibrationBin[]): string[] {
  const out = ['| value (eval points) | rows | mean value | win rate | ± SE |', '|---|---|---|---|---|'];
  for (const b of bins) if (b.n) out.push(`| (${edge(b.lo)}, ${edge(b.hi)}] | ${b.n} | ${b.meanV.toFixed(0)} | ${pct(b.winRate)}% | ${pct(b.se)} |`);
  return out;
}

export function reportMarkdown(r: CalibrationReport): string {
  const L: string[] = [];
  L.push(`## View: ${r.view === 'ender' ? 'the seat that just ended its turn' : 'the seat about to start its turn (a deep rollout’s leaf)'}`);
  L.push('');
  L.push(`Rows (ends of turns) train ${r.rows.train} / validation ${r.rows.valid} / held-out ${r.rows.test}; games ${r.games.train} / ${r.games.valid} / ${r.games.test} (split by game).`);
  L.push('');
  L.push('### Calibration of the current value (DEFAULT_WEIGHTS), all rows');
  L.push('');
  L.push(...tableMd(r.table));
  L.push('');
  L.push(`One-parameter slope σ(a·value): a = ${r.slope.toPrecision(3)} per point (a Gig swing of 40 points moves the odds ×${Math.exp(40 * r.slope).toFixed(2)}). By stage: ${STAGES.map((s) => `${s} ${r.slopeByStage[s].toPrecision(3)}`).join(', ')}.`);
  L.push('');
  for (const st of STAGES) {
    L.push(`#### ${st} (turns ${st === 'early' ? '1–4' : st === 'mid' ? '5–9' : '10+'})`);
    L.push('');
    L.push(...tableMd(r.tableByStage[st]));
    L.push('');
  }
  L.push('### Held-out scores');
  L.push('');
  L.push('| model | params | log-loss | Brier |', '|---|---|---|---|');
  for (const s of r.scores) L.push(`| ${s.model} | ${s.params} | ${s.logLoss.toFixed(4)} | ${s.brier.toFixed(4)} |`);
  L.push('');
  L.push(`Ridge λ chosen on the validation split: ${r.lambda} (${r.ridgePath.map((p) => `${p.lambda}: ${p.validLogLoss.toFixed(4)}`).join(', ')}).`);
  L.push('');
  L.push('### Fitted weights against the hand weights');
  L.push('');
  L.push('Gig scale: β × 20 / β_gig (so gig = 20). Value scale: β / a (what the term is worth if the whole evaluation keeps its current slope). Identified: the feature varies in 2%+ of rows and the 95% interval on the gig scale is narrower than the larger of the hand and fitted values; the candidate keeps the hand value otherwise.');
  L.push('');
  L.push('| term | hand | fit (gig scale) ± 1.96 SE | fit (value scale) | rows ≠ 0 | identified | candidate |', '|---|---|---|---|---|---|---|');
  for (const t of r.terms)
    L.push(`| ${t.term} | ${t.hand} | ${t.gigScale.toPrecision(3)} ± ${(1.96 * t.gigScaleSe).toPrecision(2)} | ${t.valueScale.toPrecision(3)} | ${pct(t.nonzero)}% | ${t.identified ? 'yes' : 'no'} | ${r.candidate[t.term]} |`);
  L.push('');
  if (r.stageModel) {
    L.push(`### With stage interactions (λ ${r.stageModel.lambda}): held-out log-loss ${r.stageModel.logLoss.toFixed(4)}`);
    L.push('');
    L.push(`| term | ${STAGES.join(' | ')} |`, `|---|${STAGES.map(() => '---').join('|')}|`);
    for (const t of EVAL_TERMS) L.push(`| ${t} | ${STAGES.map((s) => r.stageModel!.gigScaleByStage[s][t]).join(' | ')} |`);
    L.push('');
  }
  return L.join('\n');
}
