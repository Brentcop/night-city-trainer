// The rating series (docs/SERIES.md): which decks need games, the stopping rule, which games to play next and how many
// the rule expects, and the run loop itself with the player handed in. Pure (no files, no clock, no workers): the
// command (scripts/series.ts) reads the data and plays the games; the tests run the loop with a stub player.
//
// The rule. A deck's range is the 90% range of its expected win rate against the field (`fieldInterval` in
// src/lib/ratingModel.ts, the full covariance of the fit: what ratings.json stores as wrFieldLo / wrFieldHi), and its
// half-width is (hi − lo) / 2 in points. With the series on, every deck of the series field (the library, each list
// once) must reach `width`; with arrivals on (the series off), every unrated deck (no game on its current list) must
// reach the widest range among the other decks at the start of the run (`width` when no other deck is rated).
//
// The games ("widest first", docs/SERIES.md E1 to E4). One pick at a time: the eligible deck whose expected range is
// widest (the covariance updated rank-one after every pick, nothing played) plays BATCH games, best of one, seats
// alternating, against the field deck it has met least, ties broken by a seeded random draw. The opponent is never
// chosen by rating: in simulation that kept the 90% ranges covering their truth 89.9 to 90.8% of the time when the rule
// stopped, where pairing by the estimated ratings (the greedy planner) covered 87.8 to 89.4%. The ratings are refitted
// every CHUNK games.
//
// The matchup block (2026-11-24, docs/REVIEW_2026-11-24.md B.9, docs/SERIES.md "The matchup block"). Once the width rule
// holds (or as soon as it holds within a run), and with the series and `matchups` on, the run plays the pairs among the
// top `matchupDecks` decks by fitted rating (ties by name) until every such pair has `matchupGames` games on current
// lists: the fewest-played pair first (ties by the seeded draw), BATCH games at a time, each game's first player the deck
// of the pair that has gone first less often, so a pair's seats come out equal. The top decks are fixed when the block
// starts (from the recorded games and the run's own games before it): the choice reads results only, so the likelihood
// stays valid, as with Swiss pairing. Its objective is a count per pair (each pair's own record, which the head-to-head
// model weighs against its prior), not the ratings' variance: the width rule already spreads games for the ratings, and
// a matchup effect is learned only from games of that pair.
//
// Seeds: game k of run n plays seed seriesSeed(n, k) = 1,000,000,000 + n × 100,000 + k, outside every event's, the gate's,
// the forge's and the re-measurements' ranges, below 2³¹ up to run 11,473 (docs/SERIES.md "Seeds").
import { fieldInterval, fitRatings, seededRandom, type RatedGame, type RatingFit } from './ratingModel';

/** Games between refits, and games a pick plays (one pairing, best of one, seats alternating). */
export const SERIES_CHUNK = 300;
export const SERIES_BATCH = 10;
/** The range level: 90% (z = 1.645), the one ratings.json stores. */
export const SERIES_Z = 1.645;
/** The series' bot: the recorded events' (ratings pool one simulator version and bot). */
export const SERIES_BOT = 'hard';
/** A run never plays more than this many games (the seed range of one run). */
export const RUN_SEED_SPAN = 100_000;
/** Game k of run n plays this seed. */
export const seriesSeed = (run: number, k: number): number => 1_000_000_000 + run * RUN_SEED_SPAN + k;
/** The expectation stops counting here (a target the rule cannot reach in a sensible number of games). */
export const EXPECT_CAP = 200_000;

export interface SeriesSwitches {
  series: boolean;
  arrivals: boolean;
  /** ± points */
  width: number;
  /** the matchup block (played only with the series on); absent = off */
  matchups?: boolean;
  /** the block's decks: the top this many by rating */
  matchupDecks?: number;
  /** the block's target: games a pair */
  matchupGames?: number;
}

/** The matchup block's state: its decks, its target and how far its pairs are from it. */
export interface BlockState {
  /** the top decks by fitted rating, best first */
  decks: string[];
  /** games a pair */
  target: number;
  pairs: number;
  /** pairs with at least `target` games */
  done: number;
  /** games still to play for every pair to reach its target */
  games: number;
  /** the fewest games any pair has */
  least: number;
}

/** What the decision reads: the pooled games (current lists only, this simulator version and bot) and the field. */
export interface SeriesInput {
  games: readonly RatedGame[];
  /** the series field: the library's decks, each list once, by name (the decks the series may play) */
  field: readonly string[];
  switches: SeriesSwitches;
}

export interface DeckRange {
  deck: string;
  games: number;
  /** half-width of the 90% range, in points */
  hw: number;
}

export interface SeriesDecision {
  needed: boolean;
  /** one sentence per reason, in plain words */
  why: string[];
  /** the widest range among the field's decks */
  widest: DeckRange | null;
  /** the target of the eligible decks (± points) */
  target: number;
  /** the decks the run plays for, each with its target */
  eligible: { deck: string; target: number }[];
  /** field decks with no game on their current list */
  unrated: string[];
  /** every field deck's range now */
  ranges: DeckRange[];
  /** the matchup block (null: switched off, or fewer than two rated decks) */
  block: BlockState | null;
}

/**
 * The fit the rule reads: every pooled game, names = the field first (in order), then any other deck that has games. Its
 * prior sd is fitted to the games as ratings.json's is (`fitRatings`, since 2026-11-24), so the ranges the rule reads are
 * the ones the ratings show. On very thin data (20 decks of 20 games) that sd can collapse toward 0 and narrow every
 * range; at the library's size (71 decks, 300 games or more) it does not (0.51 on the pool of 2026-11-22).
 */
export function seriesFit(games: readonly RatedGame[], field: readonly string[]): RatingFit {
  const names = [...field];
  const seen = new Set(names);
  for (const g of games)
    for (const n of [g.a, g.b])
      if (!seen.has(n)) {
        seen.add(n);
        names.push(n);
      }
  return fitRatings(games, { names });
}

/** Every fitted deck's half-width (points), the field being every fitted deck (as scripts/ratings.ts draws it). */
export function halfWidths(fit: Pick<RatingFit, 'names' | 'r' | 'h' | 'cov' | 'diagSe' | 'played' | 'prior'>): number[] {
  const all = fit.names.map((_, k) => k);
  return fit.names.map((_, k) => {
    const iv = fieldInterval(fit as RatingFit, k, all, { z: SERIES_Z });
    return 50 * (iv.hi - iv.lo);
  });
}

const pts = (x: number) => `±${x.toFixed(1)}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Whether a run is needed, why, and which decks it plays for (each with its target). */
export function decide(input: SeriesInput, fit: RatingFit = seriesFit(input.games, input.field)): SeriesDecision {
  const { switches: sw, field } = input;
  const hw = halfWidths(fit);
  const at = new Map(fit.names.map((n, k) => [n, k]));
  const ranges: DeckRange[] = field.map((d) => ({ deck: d, games: fit.played[at.get(d)!] ?? 0, hw: hw[at.get(d)!]! }));
  const unrated = ranges.filter((r) => r.games === 0).map((r) => r.deck);
  const rated = ranges.filter((r) => r.games > 0);
  const widest = ranges.length ? ranges.reduce((a, b) => (b.hw > a.hw ? b : a)) : null;
  const why: string[] = [];
  let eligible: { deck: string; target: number }[] = [];
  let target = sw.width;
  if (!sw.series && !sw.arrivals) why.push('The rating series and arrivals are both switched off (automation.series and automation.arrivals in public/site-config.json).');
  else if (sw.series) {
    const over = ranges.filter((r) => r.hw > sw.width + 1e-9);
    eligible = over.length ? ranges.map((r) => ({ deck: r.deck, target: sw.width })) : [];
    if (over.length) why.push(`${plural(over.length, 'deck')} of ${ranges.length} ${over.length === 1 ? 'has' : 'have'} a range wider than ${pts(sw.width)} (the widest: ${widest!.deck}, ${pts(widest!.hw)}).`);
    if (unrated.length) why.push(`${plural(unrated.length, 'deck')} ${unrated.length === 1 ? 'has' : 'have'} no game on ${unrated.length === 1 ? 'its' : 'their'} current list: ${unrated.join(', ')}.`);
    if (!over.length) why.push(`Every deck's range is at most ${pts(sw.width)} (the widest: ${widest ? `${widest.deck}, ${pts(widest.hw)}` : 'none'})${blockOn(sw) ? '' : '; nothing to play'}.`);
  } else {
    target = rated.length ? Math.max(sw.width, Math.max(...rated.map((r) => r.hw))) : sw.width;
    eligible = unrated.map((deck) => ({ deck, target }));
    if (unrated.length) why.push(`Arrivals: ${plural(unrated.length, 'deck')} with no game on ${unrated.length === 1 ? 'its' : 'their'} current list (${unrated.join(', ')}), played until ${unrated.length === 1 ? 'its range is' : 'their ranges are'} at most ${pts(target)}, the widest among the other decks (the series itself is switched off).`);
    else why.push('Arrivals: every deck has games on its current list (the series itself is switched off); nothing to play.');
  }
  const block = blockOn(sw) ? blockState(blockDecks(fit, field, sw.matchupDecks!), sw.matchupGames!, meetings(input.games)) : null;
  if (block) why.push(blockWords(block, eligible.length > 0));
  return { needed: eligible.length > 0 || (!!block && block.games > 0), why, widest, target, eligible, unrated, ranges, block };
}

/** The block is played only with the series on, `matchups` on, at least two decks and a target. */
export const blockOn = (sw: SeriesSwitches): boolean => sw.series && !!sw.matchups && (sw.matchupDecks ?? 0) >= 2 && (sw.matchupGames ?? 0) >= 1;

/** The top `k` field decks by fitted rating (rated decks only; ties by name), best first. */
export function blockDecks(fit: Pick<RatingFit, 'names' | 'r' | 'played'>, field: readonly string[], k: number): string[] {
  const at = new Map(fit.names.map((n, q) => [n, q]));
  return field
    .filter((d) => at.has(d) && (fit.played[at.get(d)!] ?? 0) > 0)
    .sort((a, b) => fit.r[at.get(b)!]! - fit.r[at.get(a)!]! || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, k);
}

const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

/** The block's pairs (every two of `decks`; within a pair, a before b by name), each with the games it has. */
export function blockPairs(decks: readonly string[], met: ReadonlyMap<string, number>): { a: string; b: string; games: number }[] {
  const names = [...decks].sort();
  const out: { a: string; b: string; games: number }[] = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) out.push({ a: names[i]!, b: names[j]!, games: met.get(pairKey(names[i]!, names[j]!)) ?? 0 });
  return out;
}

/** How far the block over `decks` is from `target` games a pair (null for fewer than two decks). */
export function blockState(decks: readonly string[], target: number, met: ReadonlyMap<string, number>): BlockState | null {
  if (decks.length < 2) return null;
  const pairs = blockPairs(decks, met);
  return {
    decks: [...decks],
    target,
    pairs: pairs.length,
    done: pairs.filter((p) => p.games >= target).length,
    games: pairs.reduce((s, p) => s + Math.max(0, target - p.games), 0),
    least: Math.min(...pairs.map((p) => p.games)),
  };
}

function blockWords(b: BlockState, widthFirst: boolean): string {
  const head = `Matchup block: the ${b.decks.length} best-rated decks, ${b.pairs} pairs, ${b.target} games a pair`;
  if (!b.games) return `${head}: every pair has its games.`;
  return `${head}: ${b.done} of ${b.pairs} pairs have them (the fewest a pair has: ${b.least}); ${b.games} games to go${widthFirst ? ', once the ranges above are within the width' : ''}.`;
}

/** One pick: `games` games of a against b, seats alternating (a on the play first). */
export interface SeriesPick {
  a: string;
  b: string;
  games: number;
  /** each game's first player (0 = a); absent: seats alternate, a first */
  firsts?: (0 | 1)[];
}

/** The planning state: the fit's covariance, updated rank-one as picks are added. */
class Planner {
  readonly n: number;
  readonly cov: number[][];
  readonly grads: number[][];
  readonly met = new Map<string, number>();
  constructor(
    readonly fit: RatingFit,
    readonly field: readonly number[],
  ) {
    this.n = fit.names.length;
    this.cov = fit.cov.map((row) => [...row]);
    const all = fit.names.map((_, k) => k);
    this.grads = all.map((k) => gradient(fit.r, k, all));
  }
  key(i: number, j: number) {
    return i < j ? `${i}|${j}` : `${j}|${i}`;
  }
  sd(k: number): number {
    const g = this.grads[k]!;
    let s = 0;
    for (let i = 0; i <= this.n; i++) {
      const gi = g[i]!;
      if (!gi) continue;
      const row = this.cov[i]!;
      for (let j = 0; j <= this.n; j++) if (g[j]) s += gi * row[j]! * g[j]!;
    }
    return Math.sqrt(Math.max(0, s));
  }
  /** the expected half-width (points) of every fitted deck under the current covariance */
  widths(): number[] {
    return halfWidths({ ...this.fit, cov: this.cov });
  }
  add(i: number, j: number, games: number) {
    const p = σ(this.fit.r[i]! - this.fit.r[j]!);
    addInfo(this.cov, i, j, games * p * (1 - p));
    this.met.set(this.key(i, j), (this.met.get(this.key(i, j)) ?? 0) + games);
  }
}

const σ = (x: number) => 1 / (1 + Math.exp(-x));

function gradient(r: readonly number[], k: number, pool: readonly number[]): number[] {
  const g = new Array<number>(r.length + 1).fill(0);
  const others = pool.filter((j) => j !== k);
  for (const j of others) {
    const p = σ(r[k]! - r[j]!);
    const d = (p * (1 - p)) / Math.max(1, others.length);
    g[k]! += d;
    g[j]! -= d;
  }
  return g;
}

/** Sherman–Morrison for adding `amount` of information along e_i − e_j. */
function addInfo(cov: number[][], i: number, j: number, amount: number) {
  const n = cov.length;
  const sx = new Array<number>(n);
  for (let r = 0; r < n; r++) sx[r] = cov[r]![i]! - cov[r]![j]!;
  const xsx = sx[i]! - sx[j]!;
  const c = amount / (1 + amount * xsx);
  for (let r = 0; r < n; r++) {
    const row = cov[r]!;
    const a = c * sx[r]!;
    if (a) for (let q = 0; q < n; q++) row[q]! -= a * sx[q]!;
  }
}

/** Games already played between two decks (both seats), from the pooled games. */
export function meetings(games: readonly RatedGame[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of games) {
    const k = g.a < g.b ? `${g.a}\u0000${g.b}` : `${g.b}\u0000${g.a}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Per pair and deck (the pair's key, then the deck's name), the games of that pair the deck went first in. */
export function firstsOf(games: readonly RatedGame[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of games) {
    const k = `${pairKey(g.a, g.b)}\u0000${g.first === 0 ? g.a : g.b}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/**
 * The block's next `budget` games: the pair with the fewest games first (ties by `rnd`), up to BATCH games a pick and
 * never past the target; each game's first player is the deck of the pair that has gone first less often (a, on a tie).
 * Planned games count as played for the picks after them. Deterministic for the same inputs and random stream.
 */
export function planBlockPicks(o: { decks: readonly string[]; target: number; met: ReadonlyMap<string, number>; firsts: ReadonlyMap<string, number>; budget: number; rnd: () => number; batch?: number }): SeriesPick[] {
  const batch = o.batch ?? SERIES_BATCH;
  const pairs = blockPairs(o.decks, o.met).map((p) => ({ ...p, fa: o.firsts.get(`${pairKey(p.a, p.b)}\u0000${p.a}`) ?? 0, fb: o.firsts.get(`${pairKey(p.a, p.b)}\u0000${p.b}`) ?? 0 }));
  const picks: SeriesPick[] = [];
  let left = o.budget;
  while (left > 0) {
    let best: (typeof pairs)[number] | null = null;
    let bk = Infinity;
    for (const p of pairs) {
      if (p.games >= o.target) continue;
      const key = p.games + o.rnd();
      if (key < bk) {
        bk = key;
        best = p;
      }
    }
    if (!best) break;
    const n = Math.min(batch, o.target - best.games, left);
    const firsts: (0 | 1)[] = [];
    for (let g = 0; g < n; g++) {
      const aFirst = best.fa <= best.fb;
      firsts.push(aFirst ? 0 : 1);
      if (aFirst) best.fa++;
      else best.fb++;
    }
    best.games += n;
    left -= n;
    picks.push({ a: best.a, b: best.b, games: n, firsts });
  }
  return picks;
}

/**
 * The next `budget` games: widest first (the eligible deck whose expected range, with the picks so far, is widest),
 * against the field deck it has met least, ties broken by `rnd`. Deterministic for the same inputs and random stream.
 */
export function planPicks(o: { fit: RatingFit; field: readonly string[]; eligible: readonly string[]; met: ReadonlyMap<string, number>; budget: number; rnd: () => number; batch?: number }): SeriesPick[] {
  const batch = o.batch ?? SERIES_BATCH;
  const at = new Map(o.fit.names.map((n, k) => [n, k]));
  const fieldIdx = o.field.map((d) => at.get(d)!);
  const elig = o.eligible.map((d) => at.get(d)!).filter((k) => k !== undefined);
  const P = new Planner(o.fit, fieldIdx);
  const metOf = (i: number, j: number) => {
    const a = o.fit.names[i]!;
    const b = o.fit.names[j]!;
    return (o.met.get(a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`) ?? 0) + (P.met.get(P.key(i, j)) ?? 0);
  };
  const picks: SeriesPick[] = [];
  if (!elig.length || fieldIdx.length < 2) return picks;
  for (let t = 0; t < Math.floor(o.budget / batch); t++) {
    let k = elig[0]!;
    let best = -1;
    for (const q of elig) {
      const s = P.sd(q);
      if (s > best + 1e-15) {
        best = s;
        k = q;
      }
    }
    let opp = -1;
    let bk = Infinity;
    for (const j of fieldIdx) {
      if (j === k) continue;
      const key = metOf(k, j) + o.rnd();
      if (key < bk) {
        bk = key;
        opp = j;
      }
    }
    P.add(k, opp, batch);
    picks.push({ a: o.fit.names[k]!, b: o.fit.names[opp]!, games: batch });
  }
  return picks;
}

/**
 * Games the rule expects to need: picks as planPicks makes them, the covariance updated with each pick's expected
 * information, no game played, no refit, until every eligible deck's expected range is at most its target (EXPECT_CAP
 * when it is not reached by then). An estimate: the ratings move as games come in.
 */
export function expectedGames(o: { fit: RatingFit; decision: SeriesDecision; field: readonly string[]; met: ReadonlyMap<string, number>; seed?: number; cap?: number }): number {
  const { fit, decision } = o;
  if (!decision.needed) return 0;
  const at = new Map(fit.names.map((n, k) => [n, k]));
  const fieldIdx = o.field.map((d) => at.get(d)!);
  const targets = decision.eligible.map((e) => ({ k: at.get(e.deck)!, t: e.target }));
  const P = new Planner(fit, fieldIdx);
  const rnd = seededRandom(o.seed ?? 1);
  const metOf = (i: number, j: number) => {
    const a = fit.names[i]!;
    const b = fit.names[j]!;
    return (o.met.get(a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`) ?? 0) + (P.met.get(P.key(i, j)) ?? 0);
  };
  const cap = o.cap ?? EXPECT_CAP;
  let games = 0;
  let open = targets.filter(({ k, t }) => P.widths()[k]! > t + 1e-9);
  while (open.length && games < cap) {
    // a chunk's worth of picks between checks, as the run does, but the check reads the expected widths
    for (let c = 0; c < SERIES_CHUNK / SERIES_BATCH && games < cap; c++) {
      let k = open[0]!.k;
      let best = -1;
      for (const { k: q } of open) {
        const s = P.sd(q);
        if (s > best + 1e-15) {
          best = s;
          k = q;
        }
      }
      let opp = -1;
      let bk = Infinity;
      for (const j of fieldIdx) {
        if (j === k) continue;
        const key = metOf(k, j) + rnd();
        if (key < bk) {
          bk = key;
          opp = j;
        }
      }
      P.add(k, opp, SERIES_BATCH);
      games += SERIES_BATCH;
    }
    const w = P.widths();
    open = targets.filter(({ k, t }) => w[k]! > t + 1e-9);
  }
  return Math.min(games, cap);
}

// ---------------------------------------------------------------- the run

/** One game to play: seat A is `a`; `first` 0 = a on the play. */
export interface SeriesJob {
  a: string;
  b: string;
  seed: number;
  first: 0 | 1;
}
/** How it ended (winner 0 = a). */
export interface SeriesResult {
  winner: 0 | 1 | 'tie';
  turns: number;
  reason: string;
}
export interface SeriesGame extends SeriesJob, SeriesResult {}

export interface RunOptions {
  /** the run's number (its seeds and its random stream) */
  run: number;
  input: SeriesInput;
  /** the games to play: the same order out as in; a game that throws ends the run (the caller reports it) */
  play: (jobs: readonly SeriesJob[]) => Promise<SeriesResult[]>;
  maxGames: number;
  /** checked before each chunk: true stops the run at its budget (the clock lives with the caller) */
  outOfTime?: () => boolean;
  chunk?: number;
}

export interface RunOutcome {
  games: SeriesGame[];
  stopped: 'reached' | 'budget' | 'nothing-needed';
  before: SeriesDecision;
  after: SeriesDecision;
  /** the matchup block this run played (its decks fixed when it started): its state then and at the end */
  block?: { start: BlockState; end: BlockState };
}

/** The stopping rule on a decision taken during the run: every deck the run plays for is at its own target. */
export function reached(start: SeriesDecision, now: SeriesDecision): boolean {
  const hw = new Map(now.ranges.map((r) => [r.deck, r.hw]));
  return start.eligible.every((e) => (hw.get(e.deck) ?? Infinity) <= e.target + 1e-9);
}

/**
 * Play chunks of games by the rule until it holds or the budget (games, time) is spent: first the width rule (every
 * eligible deck at its target, fixed at the start; arrivals: the other decks' widest range then), then the matchup
 * block (its decks fixed when the width rule holds, from the games so far). Returns every game played, in order.
 */
export async function runSeries(o: RunOptions): Promise<RunOutcome> {
  const chunk = o.chunk ?? SERIES_CHUNK;
  const sw = o.input.switches;
  const before = decide(o.input);
  if (!before.needed) return { games: [], stopped: 'nothing-needed', before, after: before };
  const rnd = seededRandom(seriesSeed(o.run, 0));
  const all: RatedGame[] = [...o.input.games];
  const met = meetings(all);
  const firsts = firstsOf(all);
  const played: SeriesGame[] = [];
  let fit = seriesFit(all, o.input.field);
  let now = before;
  const eligible = before.eligible.map((e) => e.deck);
  let block: { decks: string[]; start: BlockState } | null = null;
  const outcome = (stopped: 'reached' | 'budget'): RunOutcome => {
    const end = block ? blockState(block.decks, sw.matchupGames!, met) : null;
    return { games: played, stopped, before, after: now, ...(block && end ? { block: { start: block.start, end } } : {}) };
  };
  for (;;) {
    let picks: SeriesPick[];
    const budget = Math.min(chunk, o.maxGames - played.length);
    if (!reached(before, now)) {
      if (played.length >= o.maxGames || o.outOfTime?.()) return outcome('budget');
      const open = eligible.filter((d) => (now.ranges.find((r) => r.deck === d)?.hw ?? Infinity) > (before.eligible.find((e) => e.deck === d)?.target ?? 0) + 1e-9);
      picks = planPicks({ fit, field: o.input.field, eligible: open, met, budget, rnd });
    } else {
      if (!blockOn(sw)) break;
      if (!block) {
        const decks = blockDecks(fit, o.input.field, sw.matchupDecks!);
        const start = blockState(decks, sw.matchupGames!, met);
        if (!start) break;
        block = { decks, start };
      }
      if (!blockState(block.decks, sw.matchupGames!, met)!.games) break;
      if (played.length >= o.maxGames || o.outOfTime?.()) return outcome('budget');
      picks = planBlockPicks({ decks: block.decks, target: sw.matchupGames!, met, firsts, budget, rnd });
    }
    if (!picks.length) return outcome('budget');
    const jobs: SeriesJob[] = [];
    for (const p of picks)
      for (let g = 0; g < p.games; g++) jobs.push({ a: p.a, b: p.b, seed: seriesSeed(o.run, played.length + jobs.length), first: p.firsts?.[g] ?? ((g % 2) as 0 | 1) });
    const results = await o.play(jobs);
    jobs.forEach((j, q) => {
      const r = results[q]!;
      played.push({ ...j, winner: r.winner, turns: r.turns, reason: r.reason });
      all.push({ a: j.a, b: j.b, first: j.first, s: r.winner === 0 ? 1 : r.winner === 1 ? 0 : 0.5 });
      const k = pairKey(j.a, j.b);
      met.set(k, (met.get(k) ?? 0) + 1);
      const f = `${k}\u0000${j.first === 0 ? j.a : j.b}`;
      firsts.set(f, (firsts.get(f) ?? 0) + 1);
    });
    fit = seriesFit(all, o.input.field);
    now = decide({ ...o.input, games: all }, fit);
  }
  return outcome('reached');
}
