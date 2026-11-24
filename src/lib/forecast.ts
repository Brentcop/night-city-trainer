// The regionals forecast (ROADMAP2 §13 goal 5; docs/FORECAST.md): a field of N players drawn from a field you give, a
// Swiss tournament played the way the recorded events are paired and ranked, a top cut, many times over, under the
// uncertainty of the fitted ratings. Pure and seeded: no DOM, no engine, no bots; the same inputs and seed give the same
// numbers in Node (scripts/forecast.ts, scripts/forecast-backtest.ts) and in the browser (#/forecast).
//
// The model of one match (between decks x and y)
//   - The per-game win probability is the head-to-head estimate of src/lib/h2hModel.ts: the power ratings' prediction
//     for the pairing (Bradley–Terry with a going-first term, both seats averaged) plus the pair's own residual shrunk by
//     the beta-binomial weight `priorGames`. A pair that never met gets the prediction alone. This is what
//     `h2hFileLookup` returns for a file with a model.
//   - Seats: game 1's seat is a coin flip and after each game the loser goes first (the events' rule,
//     src/lib/eventFormats.ts `firstPlayer`). The seat-averaged probability is split into on-the-play and on-the-draw
//     probabilities with the fitted going-first term (logit d with (σ(d+h) + σ(d−h))/2 = the estimate).
//   - Games are independent given the decks and seats; game ties and tied matches are not modelled.
//
// Parameter uncertainty (the ranges): each draw takes the ratings and the going-first term from a normal with the fit's
// full covariance (the inverse Hessian, as `fieldInterval` uses), recomputes every pair's prediction and shrunk estimate
// from them, and adds each pair's own deviation from its beta-binomial posterior (normal approximation, variance
// μ(1−μ)/(priorGames + games + 1)). Each draw then plays `trials` tournaments. A 90% range is the 5th to 95th percentile of
// the per-draw figures; it includes the draws' own sampling noise (reported as `noiseShare`), so it is a little wider
// than parameter uncertainty alone. It does NOT include model error (pairs whose real matchup differs from the
// Bradley–Terry picture beyond what the shrinkage allows, a deck changing between events) or how people play compared
// with the Hard bot.
//
// The tournament: Swiss rounds paired exactly as `swissPairings` (src/lib/eventFormats.ts) pairs them (players ranked by
// match points with a random order inside a point group, a backtracking search with no avoidable rematch, the bye to
// the lowest-ranked player without one), 3 points a match win, a bye a match win; standings as `computeStandings`
// (src/lib/tournament.ts): match points, then opponents' match-win % (each floored at 1/3, byes left out), then game-win
// % (floored at 1/3), then the name. tests/forecast.test.ts replays the recorded events' rounds through this port and
// checks every pairing and every standings row. Anonymous players (a field of weights) break the last tie by player
// number, which is random with respect to decks. The top K by standings make the cut; the cut is played as a single
// elimination seeded 1vK, 2v(K−1)… (bracketOrder) to give a title chance.
import { predictPair, seededRandom, type PriorChoice, type RatedGame, type RatingFit } from './ratingModel';
import { fitRatings } from './ratingModel';
import { fitShrinkage, type H2HFileLike } from './h2hModel';
import { bracketOrder, cutSize, swissPairings, type PairingRow } from './eventFormats';

const σ = (x: number) => 1 / (1 + Math.exp(-x));
const EPS = 1e-3;
const clampP = (p: number) => Math.min(1 - EPS, Math.max(EPS, p));

// ---------------------------------------------------------------- the model

/** Where the model's numbers came from (shown beside every figure). */
export interface ForecastSource {
  /** recorded event ids the fit read */
  events: (number | string)[];
  games: number;
  simVersion: number | null;
  bot: string;
  /** 'h2h-file': public/data/h2h.json (the covariance rebuilt from its pair counts); 'games': fitted here from the games */
  from: 'h2h-file' | 'games';
}

export interface ForecastModel {
  names: string[];
  /** ratings (logit scale) and the going-first term */
  r: number[];
  h: number;
  /** lower Cholesky factor of the covariance of (r₁…rₙ, h), (n+1)² row-major */
  chol: Float64Array;
  /** the shrinkage's prior weight in games (Infinity: no pair effect at all) */
  priorGames: number;
  /** per unordered pair, index i·n + j with i < j: i's wins (ties half), games, games i went first (NaN: unknown) */
  pw: Float64Array;
  pg: Float64Array;
  pf: Float64Array;
  source: ForecastSource;
}

/** Lower Cholesky factor of a symmetric positive semi-definite matrix (a zero pivot leaves a zero column). */
export function cholesky(m: readonly (readonly number[])[]): Float64Array {
  const n = m.length;
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = m[i]![j]!;
      for (let k = 0; k < j; k++) s -= L[i * n + k]! * L[j * n + k]!;
      if (i === j) L[i * n + i] = s > 1e-14 ? Math.sqrt(s) : 0;
      else L[i * n + j] = L[j * n + j]! > 0 ? s / L[j * n + j]! : 0;
    }
  return L;
}

function emptyPairs(n: number) {
  return { pw: new Float64Array(n * n), pg: new Float64Array(n * n), pf: new Float64Array(n * n).fill(Number.NaN) };
}

/** A model from its parts (tests, and the two builders below). `cov` is (n+1)² over (r, h). */
export function modelFromParts(o: {
  names: readonly string[];
  r: readonly number[];
  h: number;
  cov: readonly (readonly number[])[];
  priorGames: number;
  pairs?: readonly { a: string; b: string; w: number; g: number; aFirst?: number }[];
  source: ForecastSource;
}): ForecastModel {
  const n = o.names.length;
  const idx = new Map(o.names.map((x, k) => [x, k]));
  const P = emptyPairs(n);
  for (const p of o.pairs ?? []) {
    const a = idx.get(p.a);
    const b = idx.get(p.b);
    if (a === undefined || b === undefined || a === b) continue;
    const [i, j, w, f] = a < b ? [a, b, p.w, p.aFirst] : [b, a, p.g - p.w, p.aFirst === undefined ? undefined : p.g - p.aFirst];
    const q = i * n + j;
    P.pw[q]! += w;
    P.pg[q]! += p.g;
    P.pf[q] = f === undefined ? Number.NaN : (Number.isNaN(P.pf[q]!) ? 0 : P.pf[q]!) + f;
  }
  return { names: [...o.names], r: [...o.r], h: o.h, chol: cholesky(o.cov), priorGames: o.priorGames, ...P, source: o.source };
}

/**
 * The model fitted here from rated games (the backtest's folds): the same fit and shrinkage as h2h.json, seats known; the
 * rating prior's sd and the pair spread fitted on these games alone, by the same rules (`fitRatings`, `fitShrinkage`).
 */
export function modelFromGames(games: readonly RatedGame[], source: Omit<ForecastSource, 'from' | 'games'>, o: { names?: readonly string[]; prior?: PriorChoice } = {}): ForecastModel & { fit: RatingFit } {
  const fit = fitRatings(games, o);
  const shrink = fitShrinkage(fit, games);
  const pairs = games.filter((g) => g.a !== g.b).map((g) => ({ a: g.a, b: g.b, w: g.s, g: 1, aFirst: g.first === 0 ? 1 : 0 }));
  return { ...modelFromParts({ names: fit.names, r: fit.r, h: fit.h, cov: fit.cov, priorGames: shrink.priorGames, pairs, source: { ...source, games: games.length, from: 'games' } }), fit };
}

/** What modelFromH2HFile reads of h2h.json (its manifest names the events, the simulator version and the bot). */
export interface H2HForecastFile extends H2HFileLike {
  games?: number;
  manifest?: { simVersion?: number | null; bot?: { level?: string }; inputs?: { events?: { id: number | string }[] } };
}

/**
 * The model from public/data/h2h.json: its ratings, going-first term and shrinkage weight, and the covariance rebuilt
 * from its pair counts. The file keeps games per pair but not who went first, so the rebuilt information matrix weighs
 * each game by p(1−p) averaged over the two seats and leaves out the small coupling between the ratings and the
 * going-first term (the seats of a pair are close to balanced); tests/forecast.test.ts compares it with the covariance
 * fitted from the recorded games. `prior` is the rating fit's prior sd: by default the one the file's fit used, fitted to
 * its games (`model.priorSd`, since 2026-11-24), else 1 (files built before).
 */
export function modelFromH2HFile(file: H2HForecastFile, o: { prior?: number } = {}): ForecastModel {
  const m = file.model;
  if (!m) throw new Error('h2h.json has no model block: rebuild it with scripts/build-h2h.ts');
  const n = file.decks.length;
  const prior = o.prior ?? m.priorSd ?? 1;
  const H: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === j && i < n ? 1 / prior ** 2 : 0)));
  const r = m.ratings;
  const h = m.firstPlayer;
  for (const [i, j, , g] of file.pairs) {
    const d = r[i]! - r[j]!;
    const p1 = σ(d + h);
    const p2 = σ(d - h);
    const w = g * ((p1 * (1 - p1) + p2 * (1 - p2)) / 2);
    H[i]![i]! += w;
    H[j]![j]! += w;
    H[i]![j]! -= w;
    H[j]![i]! -= w;
    H[n]![n]! += w;
  }
  if (H[n]![n]! <= 0) H[n]![n] = 1;
  const cov = invertSpdLocal(H);
  const games = file.games ?? file.pairs.reduce((s, p) => s + p[3], 0);
  return modelFromParts({
    names: file.decks,
    r,
    h,
    cov,
    priorGames: m.priorGames,
    pairs: file.pairs.map(([i, j, w, g]) => ({ a: file.decks[i]!, b: file.decks[j]!, w, g })),
    source: { events: (file.manifest?.inputs?.events ?? []).map((e) => e.id), games, simVersion: file.manifest?.simVersion ?? null, bot: file.manifest?.bot?.level ?? '?', from: 'h2h-file' },
  });
}

function invertSpdLocal(m: number[][]): number[][] {
  const n = m.length;
  const L = cholesky(m);
  // L⁻¹, then (L⁻¹)ᵀ L⁻¹
  const Li = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    if (!(L[i * n + i]! > 0)) throw new Error('matrix is not positive definite');
    Li[i * n + i] = 1 / L[i * n + i]!;
    for (let j = 0; j < i; j++) {
      let s = 0;
      for (let k = j; k < i; k++) s -= L[i * n + k]! * Li[k * n + j]!;
      Li[i * n + j] = s / L[i * n + i]!;
    }
  }
  const out: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = 0;
      for (let k = i; k < n; k++) s += Li[k * n + i]! * Li[k * n + j]!;
      out[i]![j] = s;
      out[j]![i] = s;
    }
  return out;
}

/** The covariance a model draws from (for tests): L·Lᵀ. */
export function modelCov(model: ForecastModel): number[][] {
  const n = model.names.length + 1;
  const L = model.chol;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let s = 0;
      for (let k = 0; k <= Math.min(i, j); k++) s += L[i * n + k]! * L[j * n + k]!;
      return s;
    }),
  );
}

// ---------------------------------------------------------------- per-game and per-match probabilities

/**
 * The per-game win probability of every ordered pair (row-major n×n, x's chance against y, seats averaged) at the
 * ratings `r`, `h`: the prediction plus the pair's shrunk residual, as h2hModel.ts `h2hEstimator` computes it (expected
 * wins counted seat by seat when the seats are known, else from the seat-averaged prediction). `pairNoise`, when given,
 * adds each pair's posterior deviation (one standard normal per unordered pair, i < j in row order).
 */
export function pairProbabilities(model: ForecastModel, r: ArrayLike<number>, h: number, pairNoise?: () => number): Float64Array {
  const n = model.names.length;
  const out = new Float64Array(n * n);
  const m = model.priorGames;
  for (let i = 0; i < n; i++) {
    out[i * n + i] = 0.5;
    for (let j = i + 1; j < n; j++) {
      const q = i * n + j;
      const d = r[i]! - r[j]!;
      const pred = (σ(d + h) + σ(d - h)) / 2;
      const g = model.pg[q]!;
      let mu = pred;
      if (g > 0 && Number.isFinite(m)) {
        const f = model.pf[q]!;
        const e = Number.isNaN(f) ? g * pred : f * σ(d + h) + (g - f) * σ(d - h);
        mu = Math.min(1, Math.max(0, pred + (model.pw[q]! - e) / (g + m)));
      }
      let p = mu;
      if (pairNoise && Number.isFinite(m)) {
        const z = pairNoise();
        p = mu + Math.sqrt((mu * (1 - mu)) / (m + g + 1)) * z;
      }
      p = clampP(p);
      out[q] = p;
      out[j * n + i] = 1 - p;
    }
  }
  return out;
}

/** Split a seat-averaged game probability into on the play / on the draw with going-first term h. */
export function seatSplit(p: number, h: number): [number, number] {
  if (h === 0) return [p, p];
  let x = Math.log(p / (1 - p));
  for (let it = 0; it < 8; it++) {
    const a = σ(x + h);
    const b = σ(x - h);
    const f = (a + b) / 2 - p;
    const df = (a * (1 - a) + b * (1 - b)) / 2;
    if (!(df > 0)) break;
    x -= f / df;
    if (Math.abs(f) < 1e-12) break;
  }
  return [σ(x + h), σ(x - h)];
}

/**
 * The final scores of a best-of-`bo` series (game 1's seat a coin flip, then the loser goes first) into `p` / `ga` / `gb`
 * from `at`, best for a first: need-0, need-1 … need-(need−1), then (need−1)-need … 0-need. Returns how many (2·need).
 */
function seriesInto(pFirst: number, pSecond: number, bo: number, p: Float64Array, ga: Int8Array, gb: Int8Array, at: number): number {
  const need = Math.ceil(bo / 2);
  const S = need + 1;
  const st = new Float64Array(S * S * 2); // [a][b][a first]
  st[1] = 0.5;
  st[0] = 0.5;
  for (let total = 0; total <= 2 * need - 2; total++)
    for (let a = 0; a <= Math.min(total, need - 1); a++) {
      const b = total - a;
      if (b > need - 1) continue;
      for (let f = 0; f < 2; f++) {
        const q = st[(a * S + b) * 2 + f]!;
        if (!q) continue;
        const w = f ? pFirst : pSecond;
        st[((a + 1) * S + b) * 2]! += q * w; // a won: b, the loser, goes first
        st[(a * S + b + 1) * 2 + 1]! += q * (1 - w);
      }
    }
  let i = at;
  for (let b = 0; b < need; b++, i++) {
    p[i] = st[(need * S + b) * 2]! + st[(need * S + b) * 2 + 1]!;
    ga[i] = need;
    gb[i] = b;
  }
  for (let a = need - 1; a >= 0; a--, i++) {
    p[i] = st[(a * S + need) * 2]! + st[(a * S + need) * 2 + 1]!;
    ga[i] = a;
    gb[i] = need;
  }
  return 2 * need;
}

/** Final scores of a best-of-`bo` series and their chances: game 1 a coin flip for seats, then the loser goes first. */
export function matchOutcomes(pFirst: number, pSecond: number, bo: number): { a: number; b: number; p: number }[] {
  const k = 2 * Math.ceil(bo / 2);
  const p = new Float64Array(k);
  const ga = new Int8Array(k);
  const gb = new Int8Array(k);
  seriesInto(pFirst, pSecond, bo, p, ga, gb, 0);
  return Array.from({ length: k }, (_, i) => ({ a: ga[i]!, b: gb[i]!, p: p[i]! }));
}

// ---------------------------------------------------------------- the tournament

export interface ForecastTournament {
  players: number;
  rounds: number;
  bestOf: 1 | 3 | 5;
  /** top cut (a power of two no larger than the field; 0 = none) */
  top: number;
  /** play the cut as single elimination for a title chance */
  playCut: boolean;
}

/** Swiss rounds by default: enough for one undefeated player, ⌈log₂ N⌉ (an assumption; the regionals' own count may differ). */
export const defaultRounds = (players: number) => Math.max(1, Math.ceil(Math.log2(Math.max(2, players))));

/** The tournament with its defaults filled in and its numbers checked (the cut is rounded down to a power of two). */
export function tournamentOf(t: Partial<ForecastTournament> & { players: number }): ForecastTournament {
  const players = Math.floor(t.players);
  if (!(players >= 2 && players <= 4096)) throw new Error('players must be between 2 and 4096');
  const rounds = Math.floor(t.rounds ?? defaultRounds(players));
  if (!(rounds >= 1 && rounds <= 20)) throw new Error('rounds must be between 1 and 20');
  const bestOf = t.bestOf ?? 3;
  if (![1, 3, 5].includes(bestOf)) throw new Error('best of must be 1, 3 or 5');
  return { players, rounds, bestOf, top: cutSize(t.top ?? 8, players), playCut: t.playCut ?? true };
}

/** Swiss pairing and standings state for one tournament (players by index). */
class SwissTable {
  readonly P: number;
  readonly R: number;
  mp: Int32Array;
  mw: Int32Array;
  ml: Int32Array;
  gw: Int32Array;
  gl: Int32Array;
  /** opponents round by round (−1 = bye) */
  opps: Int32Array;
  nOpp: Int32Array;
  hadBye: Uint8Array;
  met: Uint8Array;
  played = 0;
  // scratch
  order: Int32Array;
  keys: Float64Array;
  used: Uint8Array;
  pa: Int32Array;
  pb: Int32Array;
  constructor(P: number, R: number) {
    this.P = P;
    this.R = R;
    this.mp = new Int32Array(P);
    this.mw = new Int32Array(P);
    this.ml = new Int32Array(P);
    this.gw = new Int32Array(P);
    this.gl = new Int32Array(P);
    this.opps = new Int32Array(P * Math.max(1, R));
    this.nOpp = new Int32Array(P);
    this.hadBye = new Uint8Array(P);
    this.met = new Uint8Array(P * P);
    this.order = new Int32Array(P);
    this.keys = new Float64Array(P);
    this.used = new Uint8Array(P);
    this.pa = new Int32Array(P);
    this.pb = new Int32Array(P);
  }
  reset() {
    this.mp.fill(0);
    this.mw.fill(0);
    this.ml.fill(0);
    this.gw.fill(0);
    this.gl.fill(0);
    this.nOpp.fill(0);
    this.hadBye.fill(0);
    this.met.fill(0);
    this.played = 0;
  }
  /**
   * Rank by match points (desc) with a random order inside each point group. `exact`: swissPairings' own rule, a key
   * per player drawn in player order and a stable sort on (points, key), so the same random stream gives the same
   * ranking (tests/forecast.test.ts). Otherwise (the simulation) each point group is shuffled (Fisher–Yates): sorting
   * independent uniform keys is a uniformly random order, so the two rules rank alike in distribution, and the shuffle
   * is several times cheaper.
   */
  rank(r: () => number, exact = false) {
    const { P, keys, order, mp } = this;
    if (exact) {
      for (let p = 0; p < P; p++) keys[p] = r();
      const idx = Array.from({ length: P }, (_, p) => p);
      idx.sort((a, b) => mp[b]! - mp[a]! || keys[a]! - keys[b]!);
      for (let i = 0; i < P; i++) order[i] = idx[i]!;
      return;
    }
    let maxMp = 0;
    for (let p = 0; p < P; p++) if (mp[p]! > maxMp) maxMp = mp[p]!;
    const start = this.bucketStart(maxMp);
    const fill = start.slice();
    for (let p = 0; p < P; p++) order[fill[maxMp - mp[p]!]!++] = p;
    for (let g = 0; g + 1 < start.length; g++) {
      const lo = start[g]!;
      for (let i = start[g + 1]! - 1; i > lo; i--) {
        const j = lo + Math.floor(r() * (i - lo + 1));
        const x = order[i]!;
        order[i] = order[j]!;
        order[j] = x;
      }
    }
    // keys consistent with this order, for the rare hand-over to swissPairings
    for (let i = 0; i < P; i++) keys[order[i]!] = i / P;
  }
  private bucketStart(maxMp: number): Int32Array {
    const start = new Int32Array(maxMp + 2);
    for (let p = 0; p < this.P; p++) start[maxMp - this.mp[p]! + 1]!++;
    for (let k = 1; k < start.length; k++) start[k]! += start[k - 1]!;
    return start;
  }
  /**
   * Pair the ranked players as swissPairings does: the bye candidates lowest-ranked first (players without a bye; all if
   * every one had one), then a backtracking search for a rematch-free matching in score order; when none exists, the
   * original function's fewest-rematches search (it is given the same keys, so it ranks identically). Returns the
   * number of pairs (pa/pb) and the bye (−1 for none).
   */
  pair(): { n: number; bye: number } {
    const { P, order, used, met, pa, pb } = this;
    const LIMIT = 200_000;
    const cands: number[] = [];
    if (P % 2) {
      for (let i = P - 1; i >= 0; i--) if (!this.hadBye[order[i]!]) cands.push(order[i]!);
      if (!cands.length) cands.push(order[P - 1]!);
    } else cands.push(-1);
    const bound = this.played; // no player has met more real opponents than rounds played
    let steps = 0;
    const rec = (from: number, remaining: number, depth: number): boolean => {
      let di = from;
      while (di < P && used[order[di]!]) di++;
      if (remaining === 0) return true;
      if (++steps > LIMIT) return false;
      if (remaining - 1 <= bound) {
        // the prune: every remaining player must still have a legal partner among the remaining
        for (let xi = di; xi < P; xi++) {
          const x = order[xi]!;
          if (used[x]) continue;
          let ok = false;
          for (let oi = di; oi < P && !ok; oi++) {
            const o = order[oi]!;
            if (o !== x && !used[o] && !met[x * P + o]) ok = true;
          }
          if (!ok) return false;
        }
      }
      const d = order[di]!;
      used[d] = 1;
      for (let oi = di + 1; oi < P; oi++) {
        const o = order[oi]!;
        if (used[o] || met[d * P + o]) continue;
        used[o] = 1;
        pa[depth] = d;
        pb[depth] = o;
        if (rec(di + 1, remaining - 2, depth + 1)) return true;
        used[o] = 0;
      }
      used[d] = 0;
      return false;
    };
    for (const bye of cands) {
      steps = 0;
      used.fill(0);
      if (bye >= 0) used[bye] = 1;
      if (rec(0, bye >= 0 ? P - 1 : P, 0)) return { n: (bye >= 0 ? P - 1 : P) / 2, bye };
    }
    // no rematch-free matching: hand over to the original (same keys, so the same ranking)
    const st = new Map<string, PairingRow>();
    for (let p = 0; p < P; p++) {
      const opps: string[] = [];
      for (let k = 0; k < this.nOpp[p]!; k++) opps.push(this.opps[p * this.R + k]! < 0 ? 'BYE' : String(this.opps[p * this.R + k]));
      st.set(String(p), { deck: String(p), mp: this.mp[p]!, opps });
    }
    let kq = 0;
    const res = swissPairings(st, () => this.keys[kq++]!);
    res.pairs.forEach(([a, b], i) => {
      pa[i] = Number(a);
      pb[i] = Number(b);
    });
    return { n: res.pairs.length, bye: res.bye === null ? -1 : Number(res.bye) };
  }
  /** Record a match: a's and b's game wins. */
  result(a: number, b: number, ga: number, gb: number) {
    const { R, P } = this;
    this.opps[a * R + this.nOpp[a]!++] = b;
    this.opps[b * R + this.nOpp[b]!++] = a;
    this.met[a * P + b] = 1;
    this.met[b * P + a] = 1;
    this.gw[a]! += ga;
    this.gl[a]! += gb;
    this.gw[b]! += gb;
    this.gl[b]! += ga;
    if (ga > gb) {
      this.mp[a]! += 3;
      this.mw[a]!++;
      this.ml[b]!++;
    } else {
      this.mp[b]! += 3;
      this.mw[b]!++;
      this.ml[a]!++;
    }
  }
  bye(a: number) {
    this.mp[a]! += 3;
    this.mw[a]!++;
    this.opps[a * this.R + this.nOpp[a]!++] = -1;
    this.hadBye[a] = 1;
  }
  /**
   * The first `top` places of the standings as computeStandings sorts them; `nameRank` breaks the last tie (lower
   * first). Only the players with at least the match points of place `top` are sorted (no one with fewer can pass them).
   */
  standings(nameRank: ArrayLike<number>, top = this.P): { order: number[]; omw: Float64Array; gwp: Float64Array } {
    const { P, R } = this;
    const floor3 = (x: number) => Math.max(1 / 3, x);
    const mwp = new Float64Array(P);
    for (let p = 0; p < P; p++) mwp[p] = floor3(this.mw[p]! / Math.max(1, this.mw[p]! + this.ml[p]!));
    const omw = new Float64Array(P);
    const gwp = new Float64Array(P);
    // the match points of place `top`
    let cut = 0;
    if (top < P) {
      let maxMp = 0;
      for (let p = 0; p < P; p++) if (this.mp[p]! > maxMp) maxMp = this.mp[p]!;
      const cnt = new Int32Array(maxMp + 1);
      for (let p = 0; p < P; p++) cnt[this.mp[p]!]!++;
      let seen = 0;
      for (let m = maxMp; m >= 0; m--) {
        seen += cnt[m]!;
        if (seen >= top) {
          cut = m;
          break;
        }
      }
    }
    const cands: number[] = [];
    for (let p = 0; p < P; p++) {
      if (this.mp[p]! < cut) continue;
      cands.push(p);
      let s = 0;
      let c = 0;
      for (let k = 0; k < this.nOpp[p]!; k++) {
        const o = this.opps[p * R + k]!;
        if (o < 0) continue;
        s += mwp[o]!;
        c++;
      }
      omw[p] = c ? s / c : 0;
      gwp[p] = floor3(this.gw[p]! / Math.max(1, this.gw[p]! + this.gl[p]!));
    }
    cands.sort((a, b) => this.mp[b]! - this.mp[a]! || omw[b]! - omw[a]! || gwp[b]! - gwp[a]! || nameRank[a]! - nameRank[b]!);
    return { order: cands.slice(0, top), omw, gwp };
  }
}

/**
 * The Swiss pairing port on its own, for tests: rows in the standings' insertion order (match points and opponents,
 * −1 = bye), the pairing RNG; the same result swissPairings gives on the same rows with the same RNG.
 */
export function portSwissPairings(rows: readonly { mp: number; opps: readonly number[] }[], r: () => number): { pairs: [number, number][]; bye: number | null } {
  const R = Math.max(1, ...rows.map((x) => x.opps.length + 1));
  const t = new SwissTable(rows.length, R);
  t.played = Math.max(0, ...rows.map((x) => x.opps.length));
  rows.forEach((x, p) => {
    t.mp[p] = x.mp;
    for (const o of x.opps) {
      t.opps[p * R + t.nOpp[p]!++] = o;
      if (o < 0) t.hadBye[p] = 1;
      else t.met[p * rows.length + o] = 1;
    }
  });
  t.rank(r, true);
  const { n, bye } = t.pair();
  return { pairs: Array.from({ length: n }, (_, i) => [t.pa[i]!, t.pb[i]!] as [number, number]), bye: bye < 0 ? null : bye };
}

/** The standings port on its own, for tests: rows with their opponents (−1 = bye) and records, names for the last tie. */
export function portStandings(rows: readonly { mp: number; mw: number; ml: number; gw: number; gl: number; opps: readonly number[] }[], nameRank: readonly number[]): { order: number[]; omw: number[]; gwp: number[] } {
  const R = Math.max(1, ...rows.map((x) => x.opps.length));
  const t = new SwissTable(rows.length, R);
  rows.forEach((x, p) => {
    t.mp[p] = x.mp;
    t.mw[p] = x.mw;
    t.ml[p] = x.ml;
    t.gw[p] = x.gw;
    t.gl[p] = x.gl;
    for (const o of x.opps) t.opps[p * R + t.nOpp[p]!++] = o;
  });
  const s = t.standings(nameRank);
  return { order: s.order, omw: [...s.omw], gwp: [...s.gwp] };
}

// ---------------------------------------------------------------- the field

/** Who plays: a weight per model deck (players draw a deck each, independently), or a fixed list of entrants. */
export type FieldSpec = { weights: readonly number[] } | { entrants: readonly number[] };

/** Weights made non-negative and summing to 1 (all zero is refused). */
export function normaliseWeights(w: readonly number[]): number[] {
  const clean = w.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const s = clean.reduce((a, x) => a + x, 0);
  if (!(s > 0)) throw new Error('the field has no deck with a positive weight');
  return clean.map((x) => x / s);
}

// ---------------------------------------------------------------- the run

export interface ForecastOptions {
  /** parameter draws (each a full set of ratings, going-first term and pair deviations) */
  draws: number;
  /** tournaments played per draw */
  trials: number;
  seed: number;
  /** false: every draw uses the point estimate (no parameter uncertainty; tests and the "deterministic" check) */
  uncertainty?: boolean;
}

export const FORECAST_DEFAULTS = { draws: 100, trials: 300, seed: 1 } as const;
/** Opponent share change the "what decides it" sensitivity is stated for (+5 points of the field). */
export const SENSITIVITY_SHARE = 0.05;

/** A figure with its 90% range across the parameter draws (mean of the draws, 5th and 95th percentiles). */
export interface Range {
  mean: number;
  lo: number;
  hi: number;
}

export interface Decider {
  k: number;
  name: string;
  /** times a player of the deck meets this opponent in the Swiss rounds, per event */
  meets: number;
  /** the deck's chance to win a match against it, with its range */
  matchWin: Range;
  /** first-order change of the deck's conversion when this opponent's share of the field rises by SENSITIVITY_SHARE */
  perShare: number;
}

export interface DeckForecast {
  k: number;
  name: string;
  /** share of the field (0–1) */
  weight: number;
  expectedPlayers: number;
  /** chance a single player with the deck makes the cut */
  conversion: Range;
  /** chance at least one player with it makes the cut */
  anyInCut: Range;
  /** expected share of the cut's seats */
  cutShare: Range;
  /** chance it wins the event (the cut played out), or null when the cut is not played */
  title: Range | null;
  /** its expected match-win chance over the Swiss matches it plays (pooled over every draw) */
  matchWin: number;
  /** of the spread of the per-draw conversions, the share that is the draws' own sampling noise (0–1) */
  noiseShare: number;
  /** the opponents whose share moves its conversion most, worst first (at most 5) */
  decides: Decider[];
}

export interface ForecastResult {
  tournament: ForecastTournament;
  draws: number;
  drawsDone: number;
  trials: number;
  seed: number;
  uncertainty: boolean;
  /** every deck in the field (weight > 0, or entered), in model order */
  decks: DeckForecast[];
  source: ForecastSource;
  /** the median over decks of the conversion's range width (points), for "how wide the ranges are" */
  medianWidth: number;
}

const mix = (seed: number, k: number) => {
  let x = (Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  return x >>> 0;
};
const gaussOf = (r: () => number) => () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

export function quantile(sorted: readonly number[], q: number): number {
  if (!sorted.length) return Number.NaN;
  const x = (sorted.length - 1) * q;
  const lo = Math.floor(x);
  const hi = Math.ceil(x);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (x - lo);
}
const rangeOf = (xs: readonly number[]): Range => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return { mean: v.length ? v.reduce((a, x) => a + x, 0) / v.length : Number.NaN, lo: quantile(v, 0.05), hi: quantile(v, 0.95) };
};

/**
 * A forecast run, one parameter draw per `step()` so a page can run it in slices and stop it. Draw k uses its own
 * random stream (from the seed and k), so the result does not depend on how the run is sliced.
 */
export class ForecastRun {
  readonly model: ForecastModel;
  readonly t: ForecastTournament;
  readonly o: Required<ForecastOptions>;
  readonly n: number;
  /** per player slot: fixed deck (entrants), or null (drawn from the weights) */
  private readonly entrants: Int32Array | null;
  private readonly cum: Float64Array | null;
  private readonly cumDecks: Int32Array | null;
  readonly weights: Float64Array;
  private readonly nameRank: Int32Array;
  private readonly table: SwissTable;
  done = 0;
  // per draw, per deck
  private readonly conv: Float64Array;
  private readonly any: Float64Array;
  private readonly share: Float64Array;
  private readonly title: Float64Array;
  private readonly noise: Float64Array;
  // per draw match-win matrix (n×n), Float32 to keep it small
  private readonly mwin: Float32Array;
  // pooled over draws
  private readonly meets: Float64Array;
  private readonly expWins: Float64Array;
  private readonly winsHist: Float64Array;
  private readonly cutByWins: Float64Array;
  private readonly playersByWins: Float64Array;

  constructor(model: ForecastModel, field: FieldSpec, tournament: ForecastTournament, opts: ForecastOptions) {
    this.model = model;
    this.n = model.names.length;
    const n = this.n;
    this.o = { uncertainty: true, ...opts };
    if (!(this.o.draws >= 1 && this.o.trials >= 1)) throw new Error('draws and trials must be at least 1');
    if ('entrants' in field) {
      const e = field.entrants.map((k) => {
        if (!(Number.isInteger(k) && k >= 0 && k < n)) throw new Error(`entrant ${k} is not a deck of the model`);
        return k;
      });
      this.t = { ...tournament, players: e.length, top: cutSize(tournament.top, e.length) };
      this.entrants = Int32Array.from(e);
      this.cum = null;
      this.cumDecks = null;
      this.weights = new Float64Array(n);
      for (const k of e) this.weights[k]! += 1 / e.length;
      // events break the last tie by name (computeStandings: localeCompare)
      const names = e.map((k) => model.names[k]!);
      const sorted = names.map((x, p) => ({ x, p })).sort((a, b) => a.x.localeCompare(b.x));
      this.nameRank = new Int32Array(e.length);
      sorted.forEach((s, i) => (this.nameRank[s.p] = i));
    } else {
      if (field.weights.length !== n) throw new Error(`the field gives ${field.weights.length} weights for ${n} decks`);
      const w = normaliseWeights(field.weights);
      this.t = tournament;
      this.weights = Float64Array.from(w);
      const ks = w.map((x, k) => (x > 0 ? k : -1)).filter((k) => k >= 0);
      this.cumDecks = Int32Array.from(ks);
      this.cum = new Float64Array(ks.length);
      let s = 0;
      ks.forEach((k, i) => (this.cum![i] = s += w[k]!));
      this.cum[ks.length - 1] = 1;
      this.entrants = null;
      // anonymous players: the player number breaks the last tie
      this.nameRank = Int32Array.from({ length: tournament.players }, (_, p) => p);
    }
    this.table = new SwissTable(this.t.players, this.t.rounds);
    const D = this.o.draws;
    this.conv = new Float64Array(D * n).fill(Number.NaN);
    this.any = new Float64Array(D * n);
    this.share = new Float64Array(D * n);
    this.title = new Float64Array(D * n);
    this.noise = new Float64Array(D * n).fill(Number.NaN);
    this.mwin = new Float32Array(D * n * n);
    this.meets = new Float64Array(n * n);
    this.expWins = new Float64Array(n);
    this.winsHist = new Float64Array(n * (this.t.rounds + 1));
    this.cutByWins = new Float64Array(this.t.rounds + 1);
    this.playersByWins = new Float64Array(this.t.rounds + 1);
  }

  get total() {
    return this.o.draws;
  }
  get finished() {
    return this.done >= this.o.draws;
  }

  /** Run the next parameter draw (its `trials` tournaments). Returns false when every draw is done. */
  step(): boolean {
    if (this.finished) return false;
    const d = this.done;
    const n = this.n;
    const { model, t } = this;
    const rng = seededRandom(mix(this.o.seed, d));
    const gauss = gaussOf(rng);
    // the parameters of this draw
    let r: ArrayLike<number> = model.r;
    let h = model.h;
    let noise: (() => number) | undefined;
    if (this.o.uncertainty) {
      const m = n + 1;
      const z = new Float64Array(m);
      for (let i = 0; i < m; i++) z[i] = gauss();
      const th = new Float64Array(m);
      for (let i = 0; i < m; i++) {
        let s = 0;
        for (let k = 0; k <= i; k++) s += model.chol[i * m + k]! * z[k]!;
        th[i] = (i < n ? model.r[i]! : model.h) + s;
      }
      r = th.subarray(0, n);
      h = th[n]!;
      noise = gauss;
    }
    const p = pairProbabilities(model, r, h, noise);
    // match outcome tables: for x < y, cumulative chances of x's outcomes (x's game wins, y's game wins)
    const bo = t.bestOf;
    const nOut = 2 * Math.ceil(bo / 2);
    const cumP = new Float64Array(n * n * nOut);
    const ga = new Int8Array(n * n * nOut);
    const gb = new Int8Array(n * n * nOut);
    const mw = this.mwin.subarray(d * n * n, (d + 1) * n * n);
    for (let x = 0; x < n; x++)
      for (let y = x; y < n; y++) {
        const [pf, ps] = seatSplit(p[x * n + y]!, h);
        const bx = (x * n + y) * nOut;
        const by = (y * n + x) * nOut;
        seriesInto(pf, ps, bo, cumP, ga, gb, bx);
        // y's side: the same scores read the other way, best for y first
        let win = 0;
        for (let i = 0; i < nOut; i++) {
          const j = nOut - 1 - i;
          if (y !== x) {
            cumP[by + i] = cumP[bx + j]!;
            ga[by + i] = gb[bx + j]!;
            gb[by + i] = ga[bx + j]!;
          }
          if (i < nOut / 2) win += cumP[bx + i]!;
        }
        mw[x * n + y] = win;
        mw[y * n + x] = 1 - win;
        for (const base of y === x ? [bx] : [bx, by]) {
          let c = 0;
          for (let i = 0; i < nOut; i++) cumP[base + i] = c += cumP[base + i]!;
          cumP[base + nOut - 1] = 1;
        }
      }
    const sample = (x: number, y: number): number => {
      const base = (x * n + y) * nOut;
      const u = rng();
      let i = 0;
      while (i < nOut - 1 && u >= cumP[base + i]!) i++;
      return base + i;
    };

    const P = t.players;
    const K = t.top;
    const R = t.rounds;
    const deckOf = new Int32Array(P);
    const players = new Float64Array(n);
    const inCut = new Float64Array(n);
    const anyT = new Float64Array(n);
    const titles = new Float64Array(n);
    const seen = new Uint8Array(n);
    const tb = this.table;
    for (let trial = 0; trial < this.o.trials; trial++) {
      // the field
      if (this.entrants) deckOf.set(this.entrants);
      else {
        const cum = this.cum!;
        const ks = this.cumDecks!;
        for (let q = 0; q < P; q++) {
          const u = rng();
          let lo = 0;
          let hi = cum.length - 1;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (u < cum[mid]!) hi = mid;
            else lo = mid + 1;
          }
          deckOf[q] = ks[lo]!;
        }
      }
      tb.reset();
      for (let round = 0; round < R; round++) {
        tb.rank(rng);
        const { n: np, bye } = tb.pair();
        for (let i = 0; i < np; i++) {
          const a = tb.pa[i]!;
          const b = tb.pb[i]!;
          const da = deckOf[a]!;
          const db = deckOf[b]!;
          const s = sample(da, db);
          tb.result(a, b, ga[s]!, gb[s]!);
          this.meets[da * n + db]!++;
          this.meets[db * n + da]!++;
          this.expWins[da]! += mw[da * n + db]!;
          this.expWins[db]! += mw[db * n + da]!;
        }
        if (bye >= 0) tb.bye(bye);
        tb.played++;
      }
      const { order } = tb.standings(this.nameRank, Math.max(1, K));
      seen.fill(0);
      for (let q = 0; q < P; q++) {
        const dk = deckOf[q]!;
        players[dk]!++;
        const wins = tb.mw[q]!;
        this.winsHist[dk * (R + 1) + wins]!++;
        this.playersByWins[wins]!++;
      }
      for (let i = 0; i < K; i++) {
        const q = order[i]!;
        const dk = deckOf[q]!;
        inCut[dk]!++;
        this.cutByWins[tb.mw[q]!]!++;
        if (!seen[dk]) {
          seen[dk] = 1;
          anyT[dk]!++;
        }
      }
      if (K >= 2 && t.playCut) {
        let alive = bracketOrder(K).map((i) => order[i]!);
        while (alive.length > 1) {
          const next: number[] = [];
          for (let i = 0; i < alive.length; i += 2) {
            const a = alive[i]!;
            const b = alive[i + 1]!;
            const s = sample(deckOf[a]!, deckOf[b]!);
            next.push(ga[s]! > gb[s]! ? a : b);
          }
          alive = next;
        }
        titles[deckOf[alive[0]!]!]!++;
      } else if (K === 0 && t.playCut) titles[deckOf[order[0]!]!]!++;
    }
    const T = this.o.trials;
    for (let k = 0; k < n; k++) {
      const q = d * n + k;
      if (players[k]! > 0) {
        const c = inCut[k]! / players[k]!;
        this.conv[q] = c;
        this.noise[q] = (c * (1 - c)) / players[k]!;
      }
      this.any[q] = anyT[k]! / T;
      this.share[q] = K ? inCut[k]! / (T * K) : 0;
      this.title[q] = titles[k]! / T;
    }
    this.done++;
    return !this.finished;
  }

  /** The forecast from the draws run so far. */
  result(): ForecastResult {
    const n = this.n;
    const D = this.done;
    const R = this.t.rounds;
    const decks: DeckForecast[] = [];
    // P(cut | match wins), pooled: the first-order value of one more match win
    const c = Array.from({ length: R + 1 }, (_, w) => (this.playersByWins[w]! ? this.cutByWins[w]! / this.playersByWins[w]! : Number.NaN));
    // fill gaps (no player at that many wins) from the neighbours, so the steps stay defined
    for (let w = 0; w <= R; w++) if (Number.isNaN(c[w]!)) c[w] = w === 0 ? 0 : c[w - 1]!;
    const per = (arr: Float64Array, k: number) => Array.from({ length: D }, (_, d) => arr[d * n + k]!);
    // the match-win chance of every ordered pair, averaged over the draws
    const mwMean = new Float64Array(n * n);
    for (let d = 0; d < D; d++) for (let q = 0; q < n * n; q++) mwMean[q]! += this.mwin[d * n * n + q]! / D;
    for (let k = 0; k < n; k++) {
      if (!(this.weights[k]! > 0)) continue;
      const convs = per(this.conv, k);
      const conversion = rangeOf(convs);
      const fin = convs.filter((x) => Number.isFinite(x));
      const mean = fin.reduce((a, x) => a + x, 0) / Math.max(1, fin.length);
      const varAll = fin.length > 1 ? fin.reduce((a, x) => a + (x - mean) ** 2, 0) / (fin.length - 1) : 0;
      const noises = per(this.noise, k).filter((x) => Number.isFinite(x));
      const varNoise = noises.length ? noises.reduce((a, x) => a + x, 0) / noises.length : 0;
      const noiseShare = varAll > 0 ? Math.min(1, varNoise / varAll) : fin.length > 1 ? 1 : 0;
      // the deck's win distribution and the value of a win
      let tot = 0;
      let kappa = 0;
      for (let w = 0; w < R; w++) {
        const f = this.winsHist[k * (R + 1) + w]!;
        tot += f;
        kappa += f * (c[w + 1]! - c[w]!);
      }
      kappa = tot ? kappa / tot : 0;
      // meetings per player of the deck, and the opponents that cost it most
      let playersAll = 0;
      for (let w = 0; w <= R; w++) playersAll += this.winsHist[k * (R + 1) + w]!;
      let meetAll = 0;
      for (let o = 0; o < n; o++) meetAll += this.meets[k * n + o]!;
      const mwAt = (o: number) => {
        const xs = Array.from({ length: D }, (_, d) => this.mwin[d * n * n + k * n + o]!);
        return rangeOf(xs);
      };
      // every opponent's match-win chance weighted by how often it is met
      let swAll = 0;
      let smAll = 0;
      for (let x = 0; x < n; x++) {
        const mx = this.meets[k * n + x]!;
        swAll += mx;
        smAll += mx * mwMean[k * n + x]!;
      }
      const cands: { o: number; meets: number; m: number; perShare: number }[] = [];
      for (let o = 0; o < n; o++) {
        if (o === k || !(this.weights[o]! > 0)) continue;
        const meets = playersAll ? this.meets[k * n + o]! / playersAll : 0;
        if (!(meets > 0)) continue;
        const m = mwMean[k * n + o]!;
        // the other opponents' average, weighted by how often they are met
        const sw = swAll - this.meets[k * n + o]!;
        const others = sw > 0 ? (smAll - this.meets[k * n + o]! * m) / sw : 0.5;
        const dMeets = (meets * SENSITIVITY_SHARE) / this.weights[o]!;
        cands.push({ o, meets, m, perShare: kappa * dMeets * (m - others) });
      }
      cands.sort((a, b) => a.perShare - b.perShare);
      const decides: Decider[] = cands.slice(0, 5).filter((x) => x.perShare < 0).map((x) => ({ k: x.o, name: this.model.names[x.o]!, meets: x.meets, matchWin: mwAt(x.o), perShare: x.perShare }));
      decks.push({
        k,
        name: this.model.names[k]!,
        weight: this.weights[k]!,
        expectedPlayers: this.weights[k]! * this.t.players,
        conversion,
        anyInCut: rangeOf(per(this.any, k)),
        cutShare: rangeOf(per(this.share, k)),
        title: this.t.playCut ? rangeOf(per(this.title, k)) : null,
        matchWin: meetAll ? this.expWins[k]! / meetAll : Number.NaN,
        noiseShare,
        decides,
      });
    }
    const widths = decks.map((x) => 100 * (x.conversion.hi - x.conversion.lo)).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    return { tournament: this.t, draws: this.o.draws, drawsDone: D, trials: this.o.trials, seed: this.o.seed, uncertainty: this.o.uncertainty, decks, source: this.model.source, medianWidth: quantile(widths, 0.5) };
  }
}

/** Run every draw at once (the CLI, the backtest, tests). */
export function runForecast(model: ForecastModel, field: FieldSpec, tournament: ForecastTournament, opts: ForecastOptions): ForecastResult {
  const run = new ForecastRun(model, field, tournament, opts);
  while (run.step());
  return run.result();
}

/** The per-game estimate the forecast uses for a pairing at the point estimate (x's chance against y, seats averaged). */
export function pointEstimate(model: ForecastModel, x: number, y: number): number {
  const p = pairProbabilities(model, model.r, model.h);
  return p[x * model.names.length + y]!;
}

/** The ratings' prediction alone for a pairing (no pair residual), for comparison. */
export const ratingPrediction = (model: ForecastModel, x: number, y: number) => predictPair({ r: model.r, h: model.h }, x, y);
