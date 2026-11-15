// The findings builder behind scripts/build-evidence.ts (docs/EVIDENCE.md): every kind of finding from the inputs it is
// handed, plain data in and plain data out, so tests build it from fixtures. Reading files and writing them is in
// build-evidence.ts.
//
// One definition per number: each figure comes from the function that already defines it (src/lib/eventFacts.ts,
// ratingGames.ts, ratingModel.ts, h2hModel.ts, cardFacts.ts, src/ai/packageLift.ts, changeLedger.ts, shortlist.ts,
// evidence.ts, deckSearch.ts); what is new here is the matchup interval, the seat residual and the length split, each
// documented where it is computed.
import { cardLabel, CARDS } from '../src/engine/cards';
import { listFingerprint } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import type { RatingsInput, H2HInput } from '../src/lib/eventFacts';
import { endReasons, firstPlayerSplit } from '../src/lib/eventFacts';
import type { MatchRec } from '../src/lib/tournament';
import { eventRatedGames, ratedGamesOf, type GamesEvent } from '../src/lib/ratingGames';
import { fitLogistic } from '../src/lib/logistic';
import { fitRatings, predictPair, type RatedGame, type RatingFit } from '../src/lib/ratingModel';
import { h2hEstimator, h2hFileLookup } from '../src/lib/h2hModel';
import { cardAnalysis, gapOf, packageFact, winRateOf, type AnalysisInput } from '../src/lib/cardFacts';
import type { SynergyReport } from '../src/analysis/synergies';
import { wilson } from '../src/analysis/decisions';
import type { AdjustedDeck } from '../src/analysis/impactAdjusted';
import { entryKey, fieldFingerprint, gamesToSettle, ledgerBot, ledgerVerdict, mergeBatches, summarize, type LedgerBatch, type LedgerEntry, type LedgerGame } from '../src/lib/changeLedger';
import { changeStatus, pooledGain, pooledGames, SHORTLIST_DEFAULTS, swapOfKey, type ShortlistRule } from '../src/lib/shortlist';
import { ADOPTION_DEFAULTS, ANY_GAIN_RULE, adoptionRule, describeRule, pairedInterval, type AdoptionProvenance, type AdoptionRule, type NomineeRecord } from '../src/lib/evidence';
import { detect, perGameSd } from '../src/lib/deckSearch';
import { normalCdf } from '../src/lib/groupSequential';
import { aggregateManifest, type RecordedEventInput, type RunManifest } from '../src/lib/runManifest';
import {
  bhPass,
  EVIDENCE_INDEX_KIND,
  EVIDENCE_KIND,
  EVIDENCE_IDS_KIND,
  EVIDENCE_RUNS_KIND,
  findingIds,
  idProblems,
  FLAG_CODES,
  GAME_THRESHOLDS,
  BH_Q,
  MIN_EFFECT,
  NATURE_OF,
  NO_DIFFERENCE_HALF_WIDTH,
  plain95,
  pValueOf,
  isStale,
  strengthOf,
  STRENGTHS,
  Z95,
  type AdjustedEstimate,
  type ChangeSubject,
  type DeckEvidence,
  type DeckRuns,
  type EvidenceIds,
  type EvidenceIndex,
  type Finding,
  type FindingRef,
  type FlagCode,
  type GapNote,
  type Method,
  type MethodClass,
  type OpenQuestion,
  type RunRecord,
  type SequentialKind,
  type Source,
  type Strength,
  type ToolHealth,
  type TopList,
  type TrialRecord,
} from '../src/lib/findings';
import { claimOf } from '../src/lib/findingWords';
import type { RemeasureFile } from '../src/lib/remeasure';
import { selectEvents } from './event-pool';
import { forEachGameOf, type RecordedEvent } from './lib-node';

// ---------------------------------------------------------------- inputs

/** A library deck as the builder needs it. */
export interface EvidenceDeck {
  file: string;
  deck: Pick<DeckList, 'name' | 'legends' | 'main'>;
}

/** A recorded forge report (reports/forge/<deck>.json): the parts read here. */
export interface ForgeReport {
  deck: string;
  file: string;
  date: string;
  field: string;
  adoption?: AdoptionProvenance & { text?: string };
  gens: {
    gen: number;
    baseline?: number;
    swaps: { swap: string; wr: number; delta: number; package?: string }[];
    verdict: string;
    nominees?: NomineeRecord[];
    confirm?: string;
  }[];
  summary?: { gen: number; wr: number; change: string }[];
  manifest: RunManifest;
}

export interface AdjustedFile {
  kind: 'impact-adjusted';
  manifest?: RunManifest;
  decks: AdjustedDeck[];
}

export interface EvidenceInputs {
  library: EvidenceDeck[];
  /** older lists of library decks (data/decks/custom/history), to tell how a change relates to the current list */
  history: Pick<DeckList, 'legends' | 'main'>[];
  /** every recorded event, in id order (the pool is chosen here, as the ratings choose it) */
  events: RecordedEvent[];
  ratings: (RatingsInput & { firstPlayerEdge?: number }) | null;
  h2h: H2HInput | null;
  analysis: AnalysisInput | null;
  synergies: SynergyReport | null;
  /** the current synergy catalogue version (CATALOGUE_VERSION) */
  catalogueVersion: string;
  /** the change ledger, file by file (readLedgerDir) */
  ledger: { file: string; batches: LedgerBatch[] }[];
  forge: { file: string; report: ForgeReport }[];
  remeasure: { file: string; data: RemeasureFile }[];
  adjusted: { file: string; data: AdjustedFile } | null;
  /** where each input lives, for the findings' sources */
  paths: { ratings: string; h2h: string; analysis: string; synergies: string; events: string; ledgerDir: string };
  simVersion: number;
}

export interface BuiltEvidence {
  decks: DeckEvidence[];
  /** each deck's runs, for the decks that have any (public/data/evidence/<listId>.runs.json) */
  runs: DeckRuns[];
  /** the short-id lookup (public/data/evidence/ids.json) */
  ids: EvidenceIds;
  index: EvidenceIndex;
  /** problems that stop a build (a short-id collision) */
  problems: string[];
}

// ---------------------------------------------------------------- small helpers

const DECIMALS = 6;
const round = (x: number) => (Number.isFinite(x) ? Math.round(x * 10 ** DECIMALS) / 10 ** DECIMALS : x);
/** Every non-integer number in a plain value rounded to DECIMALS places (the files' fixed precision). */
export function roundDeep<T>(x: T): T {
  if (typeof x === 'number') return (Number.isInteger(x) ? x : round(x)) as T;
  if (Array.isArray(x)) return x.map(roundDeep) as T;
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, roundDeep(v)])) as T;
  return x;
}
const σ = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));
const clamp01 = (p: number) => Math.min(1 - 1e-4, Math.max(1e-4, p));
const byStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const finite = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x);

/** Canonical bot name (ledgerBot) where the ledger knows it, else as recorded. */
const canonicalBot = (b: string) => ledgerBot(b).bot ?? b;

/** The field label of everything read from the recorded events (ratings, head-to-heads, results). */
export const EVENTS_FIELD = 'recorded-events';
/** The field label of a matchup: the opponent is the subject, so a matchup has no other field (both kinds share a question). */
export const PAIRING_FIELD = 'pairing';

/** χ² heterogeneity of group means around their weighted mean, with a Wilson–Hilferty p-value (groups of 20+ games). */
export function heterogeneity(groups: readonly { games: number; mean: number; se: number }[]): { chi2: number; df: number; p: number } | null {
  const gs = groups.filter((g) => g.games >= 20 && g.se > 0);
  if (gs.length < 2) return null;
  const w = gs.map((g) => 1 / g.se ** 2);
  const sw = w.reduce((a, b) => a + b, 0);
  const m = gs.reduce((a, g, i) => a + w[i]! * g.mean, 0) / sw;
  const chi2 = gs.reduce((a, g) => a + ((g.mean - m) / g.se) ** 2, 0);
  const df = gs.length - 1;
  const z = (Math.cbrt(chi2 / df) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return { chi2, df, p: 1 - normalCdf(z) };
}

// ---------------------------------------------------------------- change keys and labels

/** A change key in changeKey's canonical form (src/lib/changeLedger.ts), from the base fingerprint and the card lists. */
export function changeKeyOf(base: string, c: { cuts: readonly string[]; adds: readonly string[]; legendCuts?: readonly string[]; legendAdds?: readonly string[] }): string {
  const parts = [base];
  const add = (sign: '-' | '+', section: 'main' | 'legend', ids: readonly string[] | undefined) => {
    if (ids?.length) parts.push(`${sign}${section}:${[...ids].sort().join(',')}`);
  };
  add('-', 'main', c.cuts);
  add('+', 'main', c.adds);
  add('-', 'legend', c.legendCuts);
  add('+', 'legend', c.legendAdds);
  return parts.join(' ');
}

/** A change key read back into its parts. */
export function parseChangeKey(key: string): { base: string; cuts: string[]; adds: string[]; legendCuts: string[]; legendAdds: string[] } {
  const [base = '', ...rest] = key.split(' ');
  const out = { base, cuts: [] as string[], adds: [] as string[], legendCuts: [] as string[], legendAdds: [] as string[] };
  for (const p of rest) {
    const m = /^([-+])(main|legend):(.+)$/.exec(p);
    if (!m) continue;
    const ids = m[3]!.split(',');
    if (m[2] === 'main') (m[1] === '-' ? out.cuts : out.adds).push(...ids);
    else (m[1] === '-' ? out.legendCuts : out.legendAdds).push(...ids);
  }
  return out;
}

const NAME_TO_ID = (() => {
  const m = new Map<string, string>();
  for (const c of CARDS) {
    if (!m.has(cardLabel(c))) m.set(cardLabel(c), c.id);
  }
  return m;
})();

/**
 * The cuts and adds a forge label names, by card id: "-1 A → +1 B" (a swap) or "<move> <package…>: +3 A, +2 B / -2 C"
 * (a package move). Null when a name is not a card (the trial then has no key).
 */
export function parseChangeLabel(label: string): { cuts: string[]; adds: string[] } | null {
  const items = (text: string) => text.split(/, (?=[+-]\d+ )/).map((s) => /^([+-])(\d+) (.+)$/.exec(s.trim()));
  let parts: (RegExpExecArray | null)[];
  const swap = /^-(\d+) (.+?) → \+(\d+) (.+)$/.exec(label);
  if (swap) parts = [/^(-)(\d+) (.+)$/.exec(`-${swap[1]} ${swap[2]}`), /^(\+)(\d+) (.+)$/.exec(`+${swap[3]} ${swap[4]}`)];
  else {
    const at = label.search(/: [+-]\d+ /);
    if (at < 0) return null;
    parts = label
      .slice(at + 2)
      .split(' / ')
      .flatMap(items);
  }
  const cuts: string[] = [];
  const adds: string[] = [];
  for (const p of parts) {
    if (!p) return null;
    const id = NAME_TO_ID.get(p[3]!);
    if (!id) return null;
    for (let i = 0; i < Number(p[2]); i++) (p[1] === '-' ? cuts : adds).push(id);
  }
  return cuts.length || adds.length ? { cuts: cuts.sort(), adds: adds.sort() } : null;
}

/** Apply a change to a list (null when a cut is not in it). */
function applyChange(list: Pick<DeckList, 'legends' | 'main'>, c: { cuts: readonly string[]; adds: readonly string[]; legendCuts?: readonly string[]; legendAdds?: readonly string[] }): Pick<DeckList, 'legends' | 'main'> | null {
  const take = (from: string[], ids: readonly string[] | undefined) => {
    for (const id of ids ?? []) {
      const i = from.indexOf(id);
      if (i < 0) return false;
      from.splice(i, 1);
    }
    return true;
  };
  const main = [...list.main];
  const legends = [...list.legends];
  if (!take(main, c.cuts) || !take(legends, c.legendCuts)) return null;
  return { main: [...main, ...c.adds], legends: [...legends, ...(c.legendAdds ?? [])] };
}

/** How a change from `base` relates to the current list `listId`: starts from it, leads to it, or another list. */
function relationOf(listId: string, base: string, c: Parameters<typeof applyChange>[1], lists: ReadonlyMap<string, Pick<DeckList, 'legends' | 'main'>>, cand?: string): ChangeSubject['relation'] {
  if (base === listId) return 'from-this-list';
  if (cand !== undefined) return cand === listId ? 'to-this-list' : 'other-list';
  const b = lists.get(base);
  const after = b ? applyChange(b, c) : null;
  return after && listFingerprint(after) === listId ? 'to-this-list' : 'other-list';
}

// ---------------------------------------------------------------- drafts

/** A finding before its family is tested: everything but the ids, claim, nature, corrected and strength. */
interface Draft extends Omit<Finding, 'id' | 'short' | 'question' | 'nature' | 'claim' | 'corrected' | 'strength'> {
  /** how `corrected` is decided: Benjamini–Hochberg over the family, or given by the tool's own test */
  test: 'bh' | { corrected: boolean };
}

function finalize(drafts: Draft[], current: number): Finding[] {
  const rounded = drafts.map((d) => roundDeep(d));
  const families = new Map<string, Draft[]>();
  for (const d of rounded) {
    const k = d.family.key;
    const f = families.get(k) ?? [];
    f.push(d);
    families.set(k, f);
  }
  const corrected = new Map<Draft, boolean>();
  for (const fam of families.values()) {
    const bh = fam.filter((d) => d.test === 'bh');
    const pass = bhPass(bh.map((d) => pValueOf(d)));
    bh.forEach((d, i) => corrected.set(d, pass[i]!));
    for (const d of fam) if (d.test !== 'bh') corrected.set(d, d.test.corrected);
    for (const d of fam) d.family = { ...d.family, size: fam.length };
  }
  return rounded.map((d) => {
    const { test: _test, ...rest } = d;
    const ids = findingIds({ kind: d.kind, subject: d.subject, method: d.method, bot: d.bot, simVersion: d.simVersion, field: d.field });
    const flags = [...new Set<FlagCode>([...(isStale(d.simVersion, current) ? (['stale'] as const) : []), ...d.flags])].sort((a, b) => FLAG_CODES.indexOf(a) - FLAG_CODES.indexOf(b));
    const f: Finding = {
      ...ids,
      nature: NATURE_OF[d.kind],
      claim: '',
      ...rest,
      flags,
      corrected: corrected.get(d) ?? false,
      strength: 'not-enough',
    };
    f.claim = claimOf(f);
    f.strength = strengthOf(f, current);
    return orderKeys(f);
  });
}

/** A finding's keys in one fixed order (the files are compared byte for byte). */
function orderKeys(f: Finding): Finding {
  const { id, short, question, kind, nature, claim, subject, estimate, lower, upper, level, sequential, p95, baseline, games, n, method, simVersion, bot, field, sources, family, corrected, strength, flags, adjusted, detail } = f;
  return {
    id,
    short,
    question,
    kind,
    nature,
    claim,
    subject,
    estimate,
    lower,
    upper,
    level,
    ...(sequential ? { sequential } : {}),
    ...(p95 ? { p95 } : {}),
    baseline,
    games,
    n,
    method,
    simVersion,
    bot,
    field,
    sources,
    family,
    corrected,
    strength,
    flags,
    ...(adjusted ? { adjusted } : {}),
    ...(detail ? { detail } : {}),
  };
}

// ---------------------------------------------------------------- the recorded games

interface DeckGame {
  opp: string;
  first: boolean;
  /** the deck's score: 1, ½, 0 */
  s: number;
  turns: number;
  reason: string;
  winner: 0 | 1 | 'tie';
}

interface EventPool {
  events: RecordedEvent[];
  simVersion: number;
  bot: string;
  games: RatedGame[];
  /** per deck name: its games from its own side */
  byDeck: Map<string, DeckGame[]>;
  /** every game's turns and how it ended */
  all: { turns: number; reason: string; winner: 0 | 1 | 'tie' }[];
  /** per deck name: the list fingerprints it played under */
  lists: Map<string, Set<string>>;
}

function eventPool(events: RecordedEvent[]): EventPool {
  const sel = selectEvents(events);
  const kept = sel.kept;
  const byDeck = new Map<string, DeckGame[]>();
  const all: EventPool['all'] = [];
  const push = (d: string, g: DeckGame) => {
    const xs = byDeck.get(d) ?? [];
    xs.push(g);
    byDeck.set(d, xs);
  };
  // the pooled-records iteration (forEachGameOf, as scripts/build-h2h.ts): copies play as their deck, mirrors skipped
  forEachGameOf(kept, ({ game: g, decks: [a, b] }) => {
    if (a === b) return;
    const reason = g.reason ?? '';
    all.push({ turns: g.turns, reason, winner: g.winner });
    const sa = g.winner === 'tie' ? 0.5 : g.winner === 0 ? 1 : 0;
    push(a, { opp: b, first: g.first === 0, s: sa, turns: g.turns, reason, winner: g.winner === 'tie' ? 'tie' : g.winner === 0 ? 0 : 1 });
    push(b, { opp: a, first: g.first === 1, s: 1 - sa, turns: g.turns, reason, winner: g.winner === 'tie' ? 'tie' : g.winner === 1 ? 0 : 1 });
  });
  const games = ratedGamesOf(kept);
  if (games.length !== all.length) throw new Error(`the rated games (${games.length}) and the pooled games (${all.length}) disagree`);
  const lists = new Map<string, Set<string>>();
  for (const e of kept)
    for (const [name, d] of Object.entries(e.decks)) {
      const s = lists.get(name) ?? new Set<string>();
      s.add(listFingerprint(d));
      lists.set(name, s);
    }
  const newest = kept[kept.length - 1];
  return { events: kept, simVersion: typeof sel.simVersion === 'number' ? sel.simVersion : (newest?.simVersion as number | undefined) ?? 0, bot: sel.bot === 'all' ? 'all' : sel.bot, games, byDeck, all, lists };
}

/** A deck's games as one-game matches with the deck as seat A, for eventFacts' tallies. */
const asMatches = (gs: readonly DeckGame[], deck: string): MatchRec[] => gs.map((g, i) => ({ a: deck, b: g.opp, winner: '', score: [0, 0], games: [{ seed: i, first: g.first ? 0 : 1, winner: g.winner, turns: g.turns, reason: g.reason }] }));

// ---------------------------------------------------------------- length thirds

/**
 * The cut points of game length "thirds": turn counts are whole numbers and bunch up, so the short group is turns ≤ a and
 * the long group turns ≥ b (a < b), with (a, b) the pair whose three groups come closest to a third each (least squares
 * of the shares; ties to the smaller cut points).
 */
export function lengthCuts(turns: readonly number[]): { shortMax: number; longMin: number; shares: [number, number, number] } {
  const n = turns.length;
  const values = [...new Set(turns)].sort((x, y) => x - y);
  let best = { shortMax: values[0] ?? 0, longMin: values[values.length - 1] ?? 0, shares: [0, 0, 0] as [number, number, number], err: Infinity };
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++) {
      const a = values[i]!;
      const b = values[j]!;
      const s = turns.filter((t) => t <= a).length / n;
      const l = turns.filter((t) => t >= b).length / n;
      const m = 1 - s - l;
      const err = (s - 1 / 3) ** 2 + (m - 1 / 3) ** 2 + (l - 1 / 3) ** 2;
      if (err < best.err - 1e-12) best = { shortMax: a, longMin: b, shares: [s, m, l], err };
    }
  return { shortMax: best.shortMax, longMin: best.longMin, shares: best.shares };
}

// ---------------------------------------------------------------- matchups: the interval and its check

/** The variance of a seat-averaged prediction (predictPair) from the fit's full covariance (delta method). */
export function predictionVariance(fit: Pick<RatingFit, 'r' | 'h' | 'cov'>, i: number, j: number): number {
  const d = fit.r[i]! - fit.r[j]!;
  const p1 = σ(d + fit.h);
  const p2 = σ(d - fit.h);
  const w1 = p1 * (1 - p1);
  const w2 = p2 * (1 - p2);
  const n = fit.r.length;
  const g = new Map<number, number>([
    [i, (w1 + w2) / 2],
    [j, -(w1 + w2) / 2],
    [n, (w1 - w2) / 2],
  ]);
  let v = 0;
  for (const [a, ga] of g) for (const [b, gb] of g) v += ga * gb * fit.cov[a]![b]!;
  return Math.max(0, v);
}

/**
 * The variance of (a pairing's true win rate − its stored estimate). The estimate is p̂ = prediction + (w − e)/(g + M),
 * with M the head-to-head file's prior weight, so with the pair's true rate spread τ² around the prediction:
 *   Var = (M/(M + g))²·(Var(prediction) + τ²) + g·p(1−p)/(M + g)²
 * (the beta posterior of a prior worth M games when τ² = p(1−p)/(M + 1)).
 */
export const matchupVariance = (p: number, g: number, m: number, varPrediction: number, tau2: number): number => (m / (m + g)) ** 2 * (varPrediction + tau2) + (g * p * (1 - p)) / (m + g) ** 2;

/** A 95% interval for a rate from its variance, drawn on the logit scale (it stays inside 0–1). */
export function logitInterval(p: number, variance: number, z = Z95): [number, number] {
  const q = clamp01(p);
  const sd = Math.sqrt(variance) / (q * (1 - q));
  return [σ(logit(q) - z * sd), σ(logit(q) + z * sd)];
}

/** The pair spread used when the pairing table is missing or too small: an SD of 6 points. */
export const DEFAULT_PAIR_SD = 0.06;
/** The pairing table must hold at least this many pairings of at least MIN_PAIRING_GAMES games to measure the spread. */
export const MIN_SPREAD_PAIRINGS = 15;
export const MIN_PAIRING_GAMES = 100;

export interface PairSpread {
  /** τ²: the variance of a pairing's true win rate around the ratings' prediction, and its SD */
  tau2: number;
  sd: number;
  /** measured on the pairing table (false: the default) */
  measured: boolean;
  pairings: number;
  games: number;
  /** Σ (w − e)² / Σ p(1−p) per pairing, and its degrees of freedom (pairings − decks) */
  chi2: number | null;
  df: number | null;
}

/**
 * The pair spread τ² from the per-deck analysis' pairing table (src/data/analysis.json: every pairing of its decks at
 * many games, half on each seat). Each pairing is taken once (i < j in the file's deck order) and expanded into games
 * seat by seat (wins = rate × games per seat; the table is refused when those are not whole numbers); a Bradley–Terry fit
 * with a going-first term (fitRatings) gives each game's expected score with its seat; per pairing, w wins, e expected
 * wins, v = Σp(1−p), g games. Then τ² = max(0, (P/(P − K)·Σ(w − e)² − Σv) / Σg(g − 1)) with P pairings and K = the
 * decks (K − 1 ratings and the seat term). Fewer than MIN_SPREAD_PAIRINGS pairings of MIN_PAIRING_GAMES games: the default.
 */
export function pairSpread(analysis: AnalysisInput | null): PairSpread {
  const fallback: PairSpread = { tau2: DEFAULT_PAIR_SD ** 2, sd: DEFAULT_PAIR_SD, measured: false, pairings: 0, games: 0, chi2: null, df: null };
  if (!analysis) return fallback;
  const names = analysis.decks.map((d) => d.deck);
  const whole = (x: number) => Math.abs(x - Math.round(x)) < 1e-6;
  const games: RatedGame[] = [];
  const cells: { a: string; b: string; per: number; w: number }[] = [];
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const m = analysis.decks[i]!.matchups?.find((x) => x.opp === names[j]);
      if (!m || !(m.games >= MIN_PAIRING_GAMES)) continue;
      const per = m.games / 2;
      const wf = m.wrFirst * per;
      const ws = m.wrSecond * per;
      if (!whole(per) || !whole(wf) || !whole(ws)) return fallback;
      for (let k = 0; k < per; k++) games.push({ a: names[i]!, b: names[j]!, first: 0, s: k < Math.round(wf) ? 1 : 0 });
      for (let k = 0; k < per; k++) games.push({ a: names[i]!, b: names[j]!, first: 1, s: k < Math.round(ws) ? 1 : 0 });
      cells.push({ a: names[i]!, b: names[j]!, per, w: Math.round(wf) + Math.round(ws) });
    }
  if (cells.length < MIN_SPREAD_PAIRINGS) return fallback;
  const fit = fitRatings(games);
  const at = new Map(fit.names.map((n, k) => [n, k]));
  let sq = 0;
  let sv = 0;
  let sg = 0;
  let chi2 = 0;
  for (const c of cells) {
    const d = fit.r[at.get(c.a)!]! - fit.r[at.get(c.b)!]!;
    const p1 = σ(d + fit.h);
    const p2 = σ(d - fit.h);
    const e = c.per * (p1 + p2);
    const v = c.per * (p1 * (1 - p1) + p2 * (1 - p2));
    const g = 2 * c.per;
    sq += (c.w - e) ** 2;
    sv += v;
    sg += g * (g - 1);
    chi2 += (c.w - e) ** 2 / v;
  }
  const P = cells.length;
  const K = fit.names.length;
  const tau2 = Math.max(0, ((P / (P - K)) * sq - sv) / sg);
  return { tau2, sd: Math.sqrt(tau2), measured: true, pairings: P, games: games.length, chi2, df: P - K };
}

export interface MatchupCheck {
  matches: number;
  games: number;
  /** calibration: the logistic slope of the result on the logit of the per-seat chance, and its standard error */
  slope: number;
  slopeSe: number;
  /** the favoured deck's score and expected score */
  favouredWins: number;
  favouredExpected: number;
  /** mean product of the residuals of games 1 and 2 of each held-out match (the squared distance of truth from estimate) */
  squaredDistance: number;
  squaredDistanceSe: number;
  /** the mean variance the interval claims for the held-out pairings, with the pair spread and without it */
  claimedVariance: number;
  claimedWithoutSpread: number;
}

/** One event's matches, each as its rated games (eventRatedGames over the one match: copies play as their deck). */
export function eventMatches(e: GamesEvent): RatedGame[][] {
  return [...e.rounds, ...e.bracket].flatMap((part) => part.matches.map((m) => eventRatedGames({ ...(e.setup ? { setup: e.setup } : {}), rounds: [{ matches: [m] }], bracket: [] }))).filter((gs) => gs.length > 0);
}

/**
 * Leave one event out, match by match: fit ratings and shrinkage on the other events (h2hEstimator); each held-out game's
 * chance is the training fit's prediction for its seat plus the pairing's shrunk residual (estimate − seat-averaged
 * prediction). (a) Calibration: the logistic slope of the result on the logit of that chance (1 = calibrated, below 1 =
 * over-confident), and the favoured deck's score against expected. (b) The squared distance of the truth from the
 * estimate: given the pairing's true rate, the residuals of games 1 and 2 of a match are independent and both are always
 * played, so the mean of their product estimates it with no binomial correction; beside it, the mean variance the
 * interval claims (matchupVariance with τ², and without).
 */
export function matchupCheck(perEvent: readonly (readonly RatedGame[][])[], tau2: number): MatchupCheck {
  const names = [...new Set(perEvent.flatMap((e) => e.flatMap((m) => m.flatMap((g) => [g.a, g.b]))))];
  const xs: number[][] = [];
  const ys: number[] = [];
  let favW = 0;
  let favE = 0;
  const prods: number[] = [];
  let claimed = 0;
  let claimed0 = 0;
  let matches = 0;
  perEvent.forEach((held, e) => {
    const train = perEvent.flatMap((x, k) => (k === e ? [] : x.flat()));
    if (!train.length) return;
    const est = h2hEstimator(train, { names });
    const idx = new Map(est.fit.names.map((n, k) => [n, k]));
    for (const m of held) {
      const a = m[0]!.a;
      const b = m[0]!.b;
      const i = idx.get(a);
      const j = idx.get(b);
      if (a === b || i === undefined || j === undefined) continue;
      const rec = est.lookup(a, b);
      const pred = predictPair(est.fit, i, j);
      const p = rec.p ?? pred;
      const resid = p - pred;
      const d = est.fit.r[i]! - est.fit.r[j]!;
      const rs: number[] = [];
      for (const g of m) {
        const c = Math.min(1 - 1e-3, Math.max(1e-3, σ(d + (g.first === 0 ? est.fit.h : -est.fit.h)) + resid));
        xs.push([logit(c)]);
        ys.push(g.s);
        favW += c >= 0.5 ? g.s : 1 - g.s;
        favE += c >= 0.5 ? c : 1 - c;
        rs.push(g.s - c);
      }
      matches++;
      if (rs.length >= 2) {
        prods.push(rs[0]! * rs[1]!);
        const vp = predictionVariance(est.fit, i, j);
        claimed += matchupVariance(p, rec.g, est.shrinkage.priorGames, vp, tau2);
        claimed0 += matchupVariance(p, rec.g, est.shrinkage.priorGames, vp, 0);
      }
    }
  });
  const fit = xs.length ? fitLogistic(xs, ys) : null;
  const n = prods.length;
  const mean = n ? prods.reduce((s, x) => s + x, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(prods.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  return {
    matches,
    games: ys.length,
    slope: fit?.beta[0] ?? NaN,
    slopeSe: fit?.se[0] ?? NaN,
    favouredWins: favW,
    favouredExpected: favE,
    squaredDistance: mean,
    squaredDistanceSe: n > 1 ? sd / Math.sqrt(n) : 0,
    claimedVariance: n ? claimed / n : 0,
    claimedWithoutSpread: n ? claimed0 / n : 0,
  };
}

// ---------------------------------------------------------------- the build

interface Ctx {
  inputs: EvidenceInputs;
  current: number;
  pool: EventPool;
  ratingRow: Map<string, { i: number; row: RatingsInput['decks'][number] }>;
  /** every list of every library deck known (current and history), by fingerprint */
  lists: Map<string, Pick<DeckList, 'legends' | 'main'>>;
  lengthCut: ReturnType<typeof lengthCuts>;
  check: MatchupCheck;
  spread: PairSpread;
  fit: RatingFit | null;
  fitOk: boolean;
}

const eventsSource = (ctx: Ctx, path: string): Source => ({ file: ctx.inputs.paths.events, path: `event-${ctx.pool.events[0]?.id ?? 1}.json … event-${ctx.pool.events[ctx.pool.events.length - 1]?.id ?? 1}.json: ${path}` });

function deckStrength(ctx: Ctx, d: EvidenceDeck, listId: string, flags: FlagCode[]): Draft | null {
  const r = ctx.inputs.ratings;
  const hit = ctx.ratingRow.get(d.deck.name);
  if (!r || !hit) return null;
  const { i, row } = hit;
  const L = logit(clamp01(row.wrField));
  const widen = (b: number) => σ(L + (logit(clamp01(b)) - L) * (Z95 / 1.645));
  const p = ctx.inputs.paths.ratings;
  return {
    test: 'bh',
    kind: 'deck-strength',
    subject: { listId, deck: d.deck.name, file: d.file },
    estimate: row.wrField,
    lower: row.wrFieldLo,
    upper: row.wrFieldHi,
    level: 0.9,
    p95: [widen(row.wrFieldLo), widen(row.wrFieldHi)],
    baseline: 0.5,
    games: row.games,
    n: row.games,
    method: 'rating-model',
    simVersion: r.manifest?.simVersion ?? 0,
    bot: r.manifest?.bot?.level ?? '?',
    field: EVENTS_FIELD,
    sources: [
      { file: p, path: `decks[${i}].wrField` },
      { file: p, path: `decks[${i}].wrFieldLo` },
      { file: p, path: `decks[${i}].wrFieldHi` },
      { file: p, path: `decks[${i}].games` },
    ],
    family: { key: 'all:deck-strength', size: 0, correction: 'bh' },
    flags,
  };
}

function matchups(ctx: Ctx, d: EvidenceDeck, listId: string, idOf: ReadonlyMap<string, string>, flags: FlagCode[]): Draft[] {
  const h = ctx.inputs.h2h;
  if (!h?.model) return [];
  const lookup = h2hFileLookup(h);
  const idx = new Map(h.decks.map((x, k) => [x, k]));
  const fitIdx = new Map((ctx.fit?.names ?? []).map((x, k) => [x, k]));
  const pairIndex = new Map<string, number>();
  h.pairs.forEach(([i, j], q) => {
    pairIndex.set(`${i}|${j}`, q);
    pairIndex.set(`${j}|${i}`, q);
  });
  const m = h.model.priorGames;
  const tau2 = ctx.spread.tau2;
  const out: Draft[] = [];
  const a = d.deck.name;
  const ia = idx.get(a);
  if (ia === undefined) return [];
  for (const b of h.decks) {
    if (b === a) continue;
    const oppList = idOf.get(b);
    if (!oppList) continue;
    const ib = idx.get(b)!;
    const rec = lookup(a, b);
    if (rec.p === undefined) continue;
    const pred = predictPair({ r: h.model.ratings, h: h.model.firstPlayer }, ia, ib);
    const fa = fitIdx.get(a);
    const fb = fitIdx.get(b);
    const haveVar = ctx.fitOk && ctx.fit !== null && fa !== undefined && fb !== undefined;
    const varPred = haveVar ? predictionVariance(ctx.fit!, fa!, fb!) : 0;
    const [lo, hi] = logitInterval(rec.p, matchupVariance(rec.p, rec.g, m, varPred, tau2));
    const q = pairIndex.get(`${ia}|${ib}`);
    const p = ctx.inputs.paths.h2h;
    const ra = ctx.ratingRow.get(a)?.row.games ?? 0;
    const rb = ctx.ratingRow.get(b)?.row.games ?? 0;
    const f: FlagCode[] = [...flags];
    if (rec.g === 0) f.push('prediction-only');
    else if (rec.g < 6) f.push('few-direct-games');
    if (!haveVar) f.push('model-uncertainty-missing');
    if (!ctx.spread.measured) f.push('spread-default');
    out.push({
      test: 'bh',
      kind: 'matchup',
      subject: { listId, deck: a, file: d.file, opponent: { listId: oppList, deck: b } },
      estimate: rec.p,
      lower: lo,
      upper: hi,
      level: 0.95,
      baseline: 0.5,
      games: rec.g,
      n: Math.min(ra, rb),
      method: 'shrunk',
      simVersion: h.manifest?.simVersion ?? 0,
      bot: h.manifest?.bot?.level ?? '?',
      field: PAIRING_FIELD,
      // the shrunk figure and its record (pairs[q]) for a pairing that met; the ratings' prediction for one that never did
      sources: [{ file: p, path: q !== undefined ? `shrunk[${q}]` : `model.ratings[${ib}]` }],
      family: { key: `${listId}:matchups`, size: 0, correction: 'bh' },
      flags: f,
      detail: { raw: { wins: rec.w, games: rec.g }, prediction: pred, priorGames: m, pairSd: ctx.spread.sd },
    });
  }
  return out;
}

/**
 * A deck's direct matchups from the per-deck analysis' pairing table (the meta decks): the recorded win rate (ties half)
 * over the pairing's games with a Wilson 95% interval. Same subject and field as the head-to-head finding of the pairing,
 * so the two share a question.
 */
function directMatchups(ctx: Ctx, d: EvidenceDeck, listId: string, idOf: ReadonlyMap<string, string>): Draft[] {
  const an = ctx.inputs.analysis;
  const di = an ? an.decks.findIndex((x) => x.id === listId) : -1;
  const deck = an?.decks[di];
  if (!an || !deck) return [];
  const p = ctx.inputs.paths.analysis;
  return (deck.matchups ?? []).flatMap((m, j): Draft[] => {
    const opp = idOf.get(m.opp);
    if (!opp || !(m.games > 0) || !finite(m.wr)) return [];
    const wins = m.wr * m.games;
    const w = wilson(wins, m.games);
    return [
      {
        test: 'bh',
        kind: 'matchup',
        subject: { listId, deck: d.deck.name, file: d.file, opponent: { listId: opp, deck: m.opp } },
        estimate: m.wr,
        lower: w.low,
        upper: w.high,
        level: 0.95,
        baseline: 0.5,
        games: m.games,
        n: m.games,
        method: 'direct-games',
        simVersion: an.manifest?.simVersion ?? 0,
        bot: an.manifest?.bot?.level ?? '?',
        field: PAIRING_FIELD,
        sources: [{ file: p, path: `decks[${di}].matchups[${j}].wr` }],
        family: { key: `${listId}:direct-matchups`, size: 0, correction: 'bh' },
        flags: [],
        detail: { raw: { wins, games: m.games } },
      },
    ];
  });
}

/** P(the deck scores | its seat) from the ratings, through predictPair with the seat's edge folded into the rating. */
const seatProb = (rd: number, ro: number, h: number, first: boolean) => predictPair({ r: [rd + (first ? h : -h), ro], h: 0 }, 0, 1);

function seat(ctx: Ctx, d: EvidenceDeck, listId: string, flags: FlagCode[]): Draft | null {
  const r = ctx.inputs.ratings;
  const me = ctx.ratingRow.get(d.deck.name);
  const games = ctx.pool.byDeck.get(d.deck.name) ?? [];
  if (!r || !me || typeof r.firstPlayerEdge !== 'number' || !games.length) return null;
  const h = logit(0.5 + r.firstPlayerEdge);
  const res = { first: [] as number[], second: [] as number[] };
  for (const g of games) {
    const o = ctx.ratingRow.get(g.opp);
    if (!o) continue;
    (g.first ? res.first : res.second).push(g.s - seatProb(me.row.rating, o.row.rating, h, g.first));
  }
  const stat = (xs: number[]) => {
    const n = xs.length;
    const m = n ? xs.reduce((a, x) => a + x, 0) / n : 0;
    const v = n > 1 ? xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1) : 0;
    return { n, m, v };
  };
  const f = stat(res.first);
  const s = stat(res.second);
  if (f.n < 2 || s.n < 2) return null;
  const se = Math.sqrt(f.v / f.n + s.v / s.n);
  const est = f.m - s.m;
  const mine = asMatches(games, d.deck.name);
  const firstSplit = firstPlayerSplit(mine.filter((m) => m.games[0]!.first === 0));
  const opp = firstPlayerSplit(mine.filter((m) => m.games[0]!.first === 1));
  return {
    test: 'bh',
    kind: 'seat',
    subject: { listId, deck: d.deck.name, file: d.file },
    estimate: est,
    lower: est - Z95 * se,
    upper: est + Z95 * se,
    level: 0.95,
    baseline: 0,
    games: f.n + s.n,
    n: Math.min(f.n, s.n),
    method: 'model-residual',
    simVersion: ctx.pool.simVersion,
    bot: ctx.pool.bot,
    field: EVENTS_FIELD,
    sources: [eventsSource(ctx, 'rounds[].matches[].games[].first, winner'), { file: ctx.inputs.paths.ratings, path: `decks[${me.i}].rating` }, { file: ctx.inputs.paths.ratings, path: 'firstPlayerEdge' }],
    family: { key: 'all:seat', size: 0, correction: 'bh' },
    flags,
    detail: {
      first: firstSplit,
      // the opponent went first in these: the deck's wins are the decided games the first player lost
      second: { won: opp.decided - opp.won, decided: opp.decided, ties: opp.ties },
      residual: { first: f.m, second: s.m, firstGames: f.n, secondGames: s.n },
    },
  };
}

function length(ctx: Ctx, d: EvidenceDeck, listId: string, flags: FlagCode[]): Draft | null {
  const games = ctx.pool.byDeck.get(d.deck.name) ?? [];
  const { shortMax, longMin } = ctx.lengthCut;
  const groups = {
    short: games.filter((g) => g.turns <= shortMax),
    middle: games.filter((g) => g.turns > shortMax && g.turns < longMin),
    long: games.filter((g) => g.turns >= longMin),
  };
  const rate = (gs: DeckGame[]) => winRateOf(gs.reduce((a, g) => a + g.s, 0), gs.length, 1);
  const rs = { short: rate(groups.short), middle: rate(groups.middle), long: rate(groups.long) };
  const gap = gapOf(rs.short, rs.long);
  if (!gap) return null;
  const thirds = (['short', 'middle', 'long'] as const).flatMap((label) => {
    const r = rs[label];
    if (r.rate === null || r.low95 === null || r.high95 === null) return [];
    return [{ label, maxTurns: label === 'short' ? shortMax : label === 'middle' ? longMin - 1 : null, minTurns: label === 'long' ? longMin : label === 'middle' ? shortMax + 1 : null, games: r.games, rate: r.rate, lower: r.low95, upper: r.high95 }];
  });
  return {
    test: 'bh',
    kind: 'length',
    subject: { listId, deck: d.deck.name, file: d.file },
    estimate: gap.gap,
    lower: gap.low95,
    upper: gap.high95,
    level: 0.95,
    baseline: 0,
    games: games.length,
    n: Math.min(groups.short.length, groups.long.length),
    method: 'result-split',
    simVersion: ctx.pool.simVersion,
    bot: ctx.pool.bot,
    field: EVENTS_FIELD,
    sources: [eventsSource(ctx, 'rounds[].matches[].games[].turns, winner')],
    family: { key: 'all:length', size: 0, correction: 'bh' },
    flags,
    detail: { thirds },
  };
}

function endings(ctx: Ctx, d: EvidenceDeck, listId: string, flags: FlagCode[]): Draft[] {
  const games = ctx.pool.byDeck.get(d.deck.name) ?? [];
  const wins = asMatches(
    games.filter((g) => g.winner === 0),
    d.deck.name,
  );
  // the field: every decided pooled game, by how it ended (endReasons over one-game matches)
  const decided = ctx.pool.all.filter((g) => g.winner !== 'tie');
  const field = endReasons(decided.map((g, i) => ({ a: 'x', b: 'y', winner: '', score: [0, 0], games: [{ seed: i, first: 0, winner: g.winner, turns: g.turns, reason: g.reason }] })));
  const mine = new Map(endReasons(wins).map((r) => [r.reason, r.games]));
  const W = wins.length;
  if (!W) return [];
  return field.map(({ reason, games: fn }): Draft => {
    const n = mine.get(reason) ?? 0;
    const w = wilson(n, W);
    return {
      test: 'bh',
      kind: 'ending',
      subject: { listId, deck: d.deck.name, file: d.file, ending: reason },
      estimate: n / W,
      lower: w.low,
      upper: w.high,
      level: 0.95,
      baseline: fn / decided.length,
      games: W,
      n: W,
      method: 'result-split',
      simVersion: ctx.pool.simVersion,
      bot: ctx.pool.bot,
      field: EVENTS_FIELD,
      sources: [eventsSource(ctx, 'rounds[].matches[].games[].reason, winner')],
      family: { key: `${listId}:endings`, size: 0, correction: 'bh' },
      flags,
      detail: { share: { n, of: W, field: fn / decided.length, fieldN: fn, fieldOf: decided.length } },
    };
  });
}

/** The adjusted estimate of a card on a list from an --adjusted file (null without one). */
function adjustedOf(ctx: Ctx, listId: string, deckName: string, cardId: string): AdjustedEstimate | undefined {
  const a = ctx.inputs.adjusted;
  if (!a) return undefined;
  const di = a.data.decks.findIndex((x) => x.id === listId || (!x.id && x.deck === deckName));
  const deck = a.data.decks[di];
  const ci = deck ? deck.cards.findIndex((c) => c.id === cardId) : -1;
  const c = deck?.cards[ci];
  if (!deck || !c || !finite(c.adj) || !finite(c.se) || !finite(c.shrunk)) return undefined;
  // the shrunk value's posterior: normal prior N(0, τ²) and the estimate's normal likelihood
  const sdPost = Math.sqrt((deck.tau ** 2 * c.se ** 2) / (deck.tau ** 2 + c.se ** 2));
  return {
    method: 'landmark-stratified-shrunk',
    estimate: c.adj,
    lower: c.lo,
    upper: c.hi,
    shrunk: c.shrunk,
    shrunkLower: c.shrunk - Z95 * sdPost,
    shrunkUpper: c.shrunk + Z95 * sdPost,
    simVersion: a.data.manifest?.simVersion ?? 0,
    bot: a.data.manifest?.bot?.level ?? '?',
    source: { file: a.file, path: `decks[${di}].cards[${ci}].shrunk` },
  };
}

function cards(ctx: Ctx, d: EvidenceDeck, listId: string, gaps: GapNote[]): Draft[] {
  const an = ctx.inputs.analysis;
  const di = an ? an.decks.findIndex((x) => x.id === listId) : -1;
  const deck = an?.decks[di];
  if (!an || !deck) {
    gaps.push({ code: 'no-card-data' });
    return [];
  }
  if (!ctx.inputs.adjusted) gaps.push({ code: 'no-adjusted' });
  const p = ctx.inputs.paths.analysis;
  const out: Draft[] = [];
  let thin = 0;
  deck.cards.forEach((c, ci) => {
    const fact = cardAnalysis(an, p, c.id, listId);
    if (!fact?.gap || fact.wonDrawn.rate === null || fact.wonNotDrawn.rate === null) {
      thin++;
      return;
    }
    const adjusted = adjustedOf(ctx, listId, deck.deck, c.id);
    out.push({
      test: 'bh',
      kind: 'card-assoc',
      subject: { listId, deck: d.deck.name, file: d.file, card: { id: c.id, name: c.name } },
      estimate: fact.gap.gap,
      lower: fact.gap.low95,
      upper: fact.gap.high95,
      level: 0.95,
      baseline: 0,
      games: fact.deckGames,
      n: Math.min(fact.wonDrawn.games, fact.wonNotDrawn.games),
      method: 'association',
      simVersion: fact.basis.simVersion ?? 0,
      bot: fact.basis.bot ?? '?',
      field: an.manifest?.field?.mode ?? '?',
      sources: [
        { file: p, path: `decks[${di}].cards[${ci}].wrSeen` },
        { file: p, path: `decks[${di}].cards[${ci}].wrNotSeen` },
        { file: p, path: `decks[${di}].cards[${ci}].seenGames` },
        { file: p, path: `decks[${di}].games` },
      ],
      family: { key: `${listId}:cards`, size: 0, correction: 'bh' },
      flags: [],
      ...(adjusted ? { adjusted } : {}),
      detail: { rates: { a: fact.wonDrawn.rate, aGames: fact.wonDrawn.games, b: fact.wonNotDrawn.rate, bGames: fact.wonNotDrawn.games, aLabel: 'drawn', bLabel: 'not drawn' } },
    });
  });
  if (thin) gaps.push({ code: 'thin-cards', n: thin });
  return out;
}

function packages(ctx: Ctx, d: EvidenceDeck, listId: string, gaps: GapNote[]): Draft[] {
  const rep = ctx.inputs.synergies;
  const di = rep ? rep.decks.findIndex((x) => x.listId === listId) : -1;
  const deck = rep?.decks[di];
  if (!rep || !deck) return [];
  if (rep.catalogueVersion !== ctx.inputs.catalogueVersion) {
    gaps.push({ code: 'catalogue-changed' });
    return [];
  }
  const p = ctx.inputs.paths.synergies;
  const out: Draft[] = [];
  let thin = 0;
  deck.synergies.forEach((s, si) => {
    const fact = packageFact(rep, p, s.id, { listId, catalogueVersion: ctx.inputs.catalogueVersion });
    if (!fact?.lift || fact.wonOnline.rate === null || fact.wonNever.rate === null) {
      thin++;
      return;
    }
    out.push({
      test: 'bh',
      kind: 'package-assoc',
      subject: { listId, deck: d.deck.name, file: d.file, package: { id: s.id, name: s.name } },
      estimate: fact.lift.gap,
      lower: fact.lift.low95,
      upper: fact.lift.high95,
      level: 0.95,
      baseline: 0,
      games: fact.games,
      n: Math.min(fact.wonOnline.games, fact.wonNever.games),
      method: 'association',
      simVersion: fact.basis.simVersion ?? 0,
      bot: fact.basis.bot ?? '?',
      field: rep.manifest?.field?.mode ?? '?',
      sources: [
        { file: p, path: `decks[${di}].synergies[${si}].online` },
        { file: p, path: `decks[${di}].synergies[${si}].never` },
      ],
      family: { key: `${listId}:packages`, size: 0, correction: 'bh' },
      flags: [],
      detail: {
        rates: { a: fact.wonOnline.rate, aGames: fact.wonOnline.games, b: fact.wonNever.rate, bGames: fact.wonNever.games, aLabel: 'online', bLabel: 'never online' },
        ...(fact.assembled.rate !== null ? { assembled: fact.assembled.rate } : {}),
        ...(fact.online.rate !== null ? { online: fact.online.rate } : {}),
      },
    });
  });
  if (thin) gaps.push({ code: 'thin-packages', n: thin });
  return out;
}

// ---------------------------------------------------------------- changes

/** The rule the ledger's changes are judged by today: the builders' defaults, one nominee, the forge's 2-point nomination bar. */
export const LEDGER_RULE: AdoptionRule = { ...ADOPTION_DEFAULTS };
const shortlistRule = (minGainPp: number): ShortlistRule => ({ rule: LEDGER_RULE, nominees: 1, minGainPp, nominateBar: 0.02, shortlist: { ...SHORTLIST_DEFAULTS } });
const barOf = (key: string) => (swapOfKey(key) ? LEDGER_RULE.minGainPp : LEDGER_RULE.packageMinGainPp);

const scoresOf = (gs: readonly LedgerGame[]) => ({ cand: gs.map((g) => g.cand), base: gs.map((g) => g.base) });
function plainOf(gs: readonly LedgerGame[]) {
  const s = scoresOf(gs);
  return pairedInterval(s.cand, s.base, Z95);
}

function changeSubject(key: string, label: string, listId: string, ctx: Ctx, cand?: string): ChangeSubject {
  const p = parseChangeKey(key);
  return {
    key,
    base: p.base,
    cuts: p.cuts,
    adds: p.adds,
    ...(p.legendCuts.length ? { legendCuts: p.legendCuts } : {}),
    ...(p.legendAdds.length ? { legendAdds: p.legendAdds } : {}),
    label,
    relation: relationOf(listId, p.base, p, ctx.lists, cand),
  };
}

function ledgerChanges(ctx: Ctx, d: EvidenceDeck, listId: string, entries: LedgerEntry[], file: string): { drafts: Draft[]; open: OpenQuestion[] } {
  const drafts: Draft[] = [];
  const open: OpenQuestion[] = [];
  for (const e of entries) {
    const bar = barOf(e.id.change);
    const status = changeStatus(e, shortlistRule(bar));
    const pooled = pooledGain(pooledGames(e));
    const subject = changeSubject(e.id.change, e.label, listId, ctx);
    const where = `entry ${entryKey(e.id)}`;
    let findingId: string | undefined;
    let verdict: 'adopt' | 'reject' | 'undecided' = 'undecided';
    let toSettle: number | null = null;
    if (e.heldout.length >= 2) {
      const judged = ledgerVerdict(e.heldout, LEDGER_RULE, { nominees: 1, minGainPp: bar });
      verdict = judged.verdict;
      const plain = plainOf(e.heldout);
      const t = gamesToSettle(e.heldout, LEDGER_RULE, { nominees: 1, minGainPp: bar });
      toSettle = Number.isFinite(t) ? t : null;
      const sum = summarize(e.heldout);
      const screen = e.screen.length >= 2 ? plainOf(e.screen) : null;
      const het = heterogeneity(sum.byOpp);
      const draft: Draft = {
        test: { corrected: judged.iv.lower > 0 || judged.iv.upper < 0 },
        kind: 'change',
        subject: { listId, deck: d.deck.name, file: d.file, change: subject },
        estimate: judged.iv.mean,
        lower: judged.iv.lower,
        upper: judged.iv.upper,
        level: 0.95,
        sequential: 'always-valid',
        p95: [plain.lower, plain.upper],
        baseline: 0,
        games: e.heldout.length,
        n: e.heldout.length,
        method: 'paired-pooled',
        simVersion: e.id.simVersion,
        bot: e.id.bot,
        field: e.id.field,
        sources: [{ file: `${ctx.inputs.paths.ledgerDir}/${file}`, path: `${where} heldout` }],
        family: { key: `${listId}:change:${entryKey(e.id)}`, size: 1, correction: 'always-valid' },
        flags: het && het.p < 0.05 ? ['depends-on-opponent'] : [],
        detail: {
          ...(screen ? { screen: { games: screen.games, mean: screen.mean, lower: screen.lower, upper: screen.upper, flag: 'screening' as const } } : {}),
          verdict,
          runs: e.runs.length,
          status: status.kind,
          ...(status.kind === 'dropped' ? { dropped: status.why } : {}),
          toSettle,
          byOpp: sum.byOpp.map((o) => ({ opp: o.opp, games: o.games, mean: o.mean, se: o.se })),
          bySeat: sum.bySeat.map((o) => ({ first: o.first, games: o.games, mean: o.mean, se: o.se })),
          ...(het ? { heterogeneity: het } : {}),
          date: e.lastDate,
        },
      };
      drafts.push(draft);
      findingId = findingIds({ kind: 'change', subject: draft.subject, method: draft.method, bot: draft.bot, simVersion: draft.simVersion, field: draft.field }).id;
    }
    if ((status.kind === 'live' || status.kind === 'untested') && verdict === 'undecided') {
      open.push({
        ...(findingId ? { finding: findingId } : {}),
        change: subject,
        simVersion: e.id.simVersion,
        bot: e.id.bot,
        field: e.id.field,
        heldout: e.heldout.length,
        screen: e.screen.length,
        pooled: { games: pooled.games, mean: pooled.mean, se: Number.isFinite(pooled.se) ? pooled.se : 0 },
        toSettle,
        more: toSettle === null ? null : Math.max(0, toSettle - e.heldout.length),
        runs: e.runs.length,
      });
    }
  }
  return { drafts, open };
}

function forgeChanges(ctx: Ctx, d: EvidenceDeck, listId: string, reports: { file: string; report: ForgeReport }[]): Draft[] {
  const out: Draft[] = [];
  for (const { file, report } of reports) {
    const a = report.adoption;
    if (!a) continue;
    const base = report.manifest.decks[0]?.id ?? '';
    const field = fieldFingerprint(report.manifest.field.deckIds);
    const bot = canonicalBot(report.manifest.bot.level);
    report.gens.forEach((g, gi) => {
      const noms = g.nominees ?? [];
      noms.forEach((nom, ni) => {
        const h = nom.heldOut;
        if (!h || !nom.outcome) return;
        const parsed = parseChangeLabel(nom.label);
        const key = parsed ? changeKeyOf(base, parsed) : `${base} ?${nom.label}`;
        const half = h.z > 0 ? (h.upper - h.lower) / 2 / h.z : 0;
        const flags: FlagCode[] = [];
        if (h.looks === 1) flags.push('first-look');
        if (nom.stopped === 'futility') flags.push('stopped-futility');
        const seq: SequentialKind = a.correction === 'obrien-fleming' ? 'obrien-fleming' : 'bonferroni';
        const subject: ChangeSubject = parsed ? { ...changeSubject(key, nom.label, listId, ctx), relation: gi > 0 ? 'other-list' : relationOf(listId, base, parsed, ctx.lists) } : { key, base, cuts: [], adds: [], label: nom.label, relation: 'other-list' };
        out.push({
          test: { corrected: h.lower > 0 || h.upper < 0 },
          kind: 'change',
          subject: { listId, deck: d.deck.name, file: d.file, change: subject },
          estimate: h.mean,
          lower: h.lower,
          upper: h.upper,
          level: 0.95,
          sequential: seq,
          p95: [Math.max(-1, h.mean - Z95 * half), Math.min(1, h.mean + Z95 * half)],
          baseline: 0,
          games: h.games,
          n: h.games,
          method: 'paired-staged',
          simVersion: report.manifest.simVersion,
          bot,
          field,
          sources: [{ file, path: `gens[${gi}].nominees[${ni}].heldOut` }],
          family: { key: `${listId}:forge:${report.manifest.runId}:gen${g.gen}`, size: noms.length, correction: seq },
          flags,
          detail: { screen: { games: nom.screen.games, mean: nom.screen.mean, lower: nom.screen.lower, upper: nom.screen.upper, flag: 'screening' }, verdict: nom.outcome, looks: h.looks, date: report.date },
        });
      });
    });
  }
  return out;
}

function remeasured(ctx: Ctx, d: EvidenceDeck, listId: string, idOf: ReadonlyMap<string, string>): Draft[] {
  const out: Draft[] = [];
  for (const { file, data } of ctx.inputs.remeasure)
    data.measurements.forEach((m, mi) => {
      if (m.deck !== d.file) return;
      const key = changeKeyOf(m.baseListId, m);
      const het = m.byOpp ? heterogeneity(m.byOpp) : null;
      const oppIds = (m.byOpp ?? []).map((o) => o.oppListId ?? idOf.get(o.opp ?? '') ?? '');
      const field = oppIds.length && oppIds.every((x) => x) ? fieldFingerprint(oppIds) : m.opponents?.length ? fieldFingerprint(m.opponents) : 'unknown';
      const subject = changeSubject(key, m.label, listId, ctx, m.candListId);
      out.push({
        test: { corrected: m.mean - Z95 * m.se > 0 || m.mean + Z95 * m.se < 0 },
        kind: 'change',
        subject: { listId, deck: d.deck.name, file: d.file, change: subject },
        estimate: m.mean,
        lower: m.mean - Z95 * m.se,
        upper: m.mean + Z95 * m.se,
        level: 0.95,
        baseline: 0,
        games: m.games,
        n: m.games,
        method: 'paired',
        simVersion: m.simVersion,
        bot: canonicalBot(m.bot),
        field,
        sources: [{ file, path: `measurements[${mi}].mean` }],
        family: { key: `${listId}:remeasure:${m.id}`, size: 1, correction: 'none' },
        flags: het && het.p < 0.05 ? ['depends-on-opponent'] : [],
        detail: {
          ...(m.byOpp ? { byOpp: m.byOpp.map((o) => ({ opp: o.opp ?? o.oppListId ?? '?', games: o.games, mean: o.mean, se: o.se })) } : {}),
          ...(m.bySeat ? { bySeat: m.bySeat.map((o) => ({ first: o.first ?? 0, games: o.games, mean: o.mean, se: o.se })) } : {}),
          ...(het ? { heterogeneity: het } : {}),
          date: m.date,
          script: m.script,
          ...(m.record ? { record: m.record } : {}),
        },
      });
    });
  return out;
}

// ---------------------------------------------------------------- runs

const pct = (x: number) => x / 100;

function forgeRuns(ctx: Ctx, reports: { file: string; report: ForgeReport }[], entries: LedgerEntry[]): RunRecord[] {
  const byKey = new Map(entries.map((e) => [entryKey(e.id), e]));
  return reports.map(({ file, report }) => {
    const m = report.manifest;
    const a = report.adoption;
    const rule = a ? adoptionRule({ minGainPp: a.minGainPp, packageMinGainPp: a.packageMinGainPp, alpha: a.alpha, boundary: a.correction === 'obrien-fleming' ? 'obrien-fleming' : 'bonferroni', capStages: a.capStages, minGames: a.minGames, futilityAfterStages: a.futilityAfterStages ?? 0, futilityMaxGainPp: a.futilityMaxGainPp ?? 0 }) : ANY_GAIN_RULE;
    const det = a ? detect({ rule, firstStage: a.firstStage, nominees: a.nominees, sd: perGameSd() }) : null;
    const perTest = Number(/(\d+) games per test/.exec(report.field)?.[1] ?? NaN);
    const base = m.decks[0]?.id ?? '';
    const field = fieldFingerprint(m.field.deckIds);
    const bot = canonicalBot(m.bot.level);
    const trials: TrialRecord[] = [];
    for (const g of report.gens) {
      const noms = new Map((g.nominees ?? []).map((n) => [n.label, n]));
      // a Season 1 (any-gain) confirmation names no nominee: it confirmed the best screened swap
      const s1 = !a && /^\((\d+) fresh games\): baseline ([\d.]+)% vs swap ([\d.]+)%/.exec(g.confirm ?? '');
      g.swaps.forEach((s, si) => {
        const parsed = parseChangeLabel(s.swap);
        const key = parsed ? changeKeyOf(base, parsed) : undefined;
        const nom = noms.get(s.swap);
        const e = key ? byKey.get(`${key}#v${m.simVersion}#${bot}#${field}`) : undefined;
        const pooled = e ? pooledGain(pooledGames(e)) : null;
        const confirmed = s1 && si === 0;
        trials.push({
          label: s.swap,
          kind: s.package ? 'package' : 'card',
          ...(key ? { key } : {}),
          screen: nom ? { games: nom.screen.games, mean: nom.screen.mean, lower: nom.screen.lower, upper: nom.screen.upper } : { games: Number.isFinite(perTest) ? perTest : null, mean: pct(s.delta), lower: null, upper: null },
          heldOut: nom?.heldOut
            ? { games: nom.heldOut.games, mean: nom.heldOut.mean, lower: nom.heldOut.lower, upper: nom.heldOut.upper, z: nom.heldOut.z, looks: nom.heldOut.looks }
            : confirmed && s1
              ? { games: Number(s1[1]), mean: pct(Number(s1[3]) - Number(s1[2])), lower: null, upper: null, z: null, looks: 1 }
              : null,
          outcome: nom?.outcome ? outcomeText(nom.outcome) : confirmed ? (g.verdict === 'adopted' ? 'adopted' : g.verdict === 'rejected' ? 'rejected' : g.verdict) : 'not nominated',
          ...(pooled && pooled.games ? { pooled: { games: pooled.games, mean: pooled.mean, se: Number.isFinite(pooled.se) ? pooled.se : 0 } } : {}),
        });
      });
    }
    return {
      id: m.runId,
      tool: 'forge',
      date: report.date,
      bot,
      simVersion: m.simVersion,
      rule: a ? describeRule(rule, { firstStage: a.firstStage, nominees: a.nominees }) : describeRule(ANY_GAIN_RULE),
      games: m.sample.completedGames,
      detect: det && a ? { card: Number.isFinite(det.card) ? det.card : null, package: Number.isFinite(det.package) ? det.package : null, firstStage: a.firstStage, nominees: a.nominees, sdCard: det.sd.card, sdPackage: det.sd.package } : null,
      source: { file, path: 'gens' },
      stale: isStale(m.simVersion, ctx.current),
      trials,
    };
  });
}

const outcomeText = (o: string) => (o === 'adopt' ? 'adopted' : o === 'reject' ? 'rejected' : 'could not tell');

/** Runs the ledger holds games of for this list (grouped by run id), each change it screened or held out. */
function ledgerRuns(ctx: Ctx, batches: LedgerBatch[], entries: LedgerEntry[], file: string): RunRecord[] {
  const byKey = new Map(entries.map((e) => [entryKey(e.id), e]));
  const runs = new Map<string, LedgerBatch[]>();
  for (const b of batches) {
    const xs = runs.get(b.run) ?? [];
    xs.push(b);
    runs.set(b.run, xs);
  }
  return [...runs.entries()]
    .map(([run, bs]): RunRecord => {
      const first = bs[0]!;
      const changes = new Map<string, { screen?: LedgerGame[]; heldout?: LedgerGame[]; label: string; entry: string }>();
      for (const b of bs) {
        const c = changes.get(b.entry.change) ?? { label: b.label, entry: entryKey(b.entry) };
        c[b.kind === 'screen' ? 'screen' : 'heldout'] = [...(c[b.kind === 'screen' ? 'screen' : 'heldout'] ?? []), ...b.games];
        changes.set(b.entry.change, c);
      }
      const trials: TrialRecord[] = [...changes.entries()]
        .sort(([a], [b]) => byStr(a, b))
        .map(([key, c]) => {
          const sc = c.screen && c.screen.length >= 2 ? plainOf(c.screen) : null;
          const ho = c.heldout && c.heldout.length >= 2 ? plainOf(c.heldout) : null;
          const e = byKey.get(c.entry);
          const pooled = e ? pooledGain(pooledGames(e)) : null;
          return {
            label: c.label,
            kind: swapOfKey(key) ? 'card' : 'package',
            key,
            screen: sc ? { games: sc.games, mean: sc.mean, lower: sc.lower, upper: sc.upper } : null,
            heldOut: ho ? { games: ho.games, mean: ho.mean, lower: ho.lower, upper: ho.upper, z: Z95, looks: null } : null,
            outcome: ho ? 'nominated' : 'screened',
            ...(pooled && pooled.games ? { pooled: { games: pooled.games, mean: pooled.mean, se: Number.isFinite(pooled.se) ? pooled.se : 0 } } : {}),
          };
        });
      return {
        id: run,
        tool: run.split(' ')[0] ?? 'run',
        date: bs.map((b) => b.date).sort()[0] ?? first.date,
        bot: first.entry.bot,
        simVersion: first.entry.simVersion,
        rule: null,
        games: bs.reduce((a, b) => a + b.games.length, 0),
        detect: null,
        source: { file: `${ctx.inputs.paths.ledgerDir}/${file}`, path: `run ${run}` },
        stale: isStale(first.entry.simVersion, ctx.current),
        trials,
      };
    })
    .sort((a, b) => byStr(a.date, b.date) || byStr(a.id, b.id));
}

// ---------------------------------------------------------------- the whole build

const zOf = (f: Finding) => {
  const [lo, hi] = plain95(f);
  const se = (hi - lo) / (2 * Z95);
  return se > 0 ? Math.abs(f.estimate - f.baseline) / se : 0;
};
const STRENGTH_RANK: Readonly<Record<Strength, number>> = { strong: 0, moderate: 1, weak: 2, 'no-difference': 3, 'not-enough': 4 };

const TOP_N = 15;
/** At most this many of one kind in the results and patterns lists, so one kind (the matchups) cannot fill them. */
const PER_KIND = 5;

/**
 * One of the overview's lists from its whole candidate pool (the pool is the family): effects whose strength is strong or
 * moderate (a change keeps its tool's own correction, so no second test is added), results and associations that pass
 * Benjamini–Hochberg over the pool; strongest first, then by |estimate − baseline| / standard error.
 */
function topList(key: TopList['key'], pool: { f: Finding; listId: string; deck: string }[]): TopList {
  const pass = bhPass(pool.map((x) => pValueOf(x.f)));
  // every current measurement of a question in the pool: the effects list names a question once and counts the rest
  const measured = new Map<string, number>();
  for (const x of pool) measured.set(x.f.question, (measured.get(x.f.question) ?? 0) + 1);
  const named = new Set<string>();
  const items: FindingRef[] = pool
    .map((x, i) => ({ x, pass: pass[i]! }))
    .filter(({ x, pass }) => (key === 'effects' ? x.f.strength === 'strong' || x.f.strength === 'moderate' : pass))
    .sort((a, b) => STRENGTH_RANK[a.x.f.strength] - STRENGTH_RANK[b.x.f.strength] || zOf(b.x.f) - zOf(a.x.f) || byStr(a.x.f.id, b.x.f.id))
    .filter(({ x }) => {
      if (key !== 'effects') return true;
      if (named.has(x.f.question)) return false;
      named.add(x.f.question);
      return true;
    })
    .filter(({ x }, i, xs) => key === 'effects' || xs.slice(0, i).filter((y) => y.x.f.kind === x.f.kind).length < PER_KIND)
    .slice(0, TOP_N)
    .map(({ x, pass }) => ({
      id: x.f.id,
      short: x.f.short,
      question: x.f.question,
      kind: x.f.kind,
      nature: x.f.nature,
      claim: x.f.claim,
      estimate: x.f.estimate,
      lower: x.f.lower,
      upper: x.f.upper,
      level: x.f.level,
      ...(x.f.sequential ? { sequential: x.f.sequential } : {}),
      baseline: x.f.baseline,
      games: x.f.games,
      method: x.f.method,
      corrected: x.f.corrected,
      strength: x.f.strength,
      bot: x.f.bot,
      simVersion: x.f.simVersion,
      flags: x.f.flags,
      listId: x.listId,
      deck: x.deck,
      ...(x.f.detail?.raw ? { detail: { raw: x.f.detail.raw } } : {}),
      poolCorrected: pass,
      others: key === 'effects' ? (measured.get(x.f.question) ?? 1) - 1 : 0,
    }));
  return { key, family: { size: pool.length, correction: 'bh' }, items };
}

function health(decks: DeckEvidence[], forge: { file: string; report: ForgeReport }[], ledger: EvidenceInputs['ledger']): ToolHealth[] {
  const out: ToolHealth[] = [];
  // the forge (Season 2 reports: a staged rule with nominees)
  const noms = forge.flatMap(({ report }) => (report.adoption ? report.gens.flatMap((g) => (g.nominees ?? []).map((n) => ({ n, base: report.manifest.decks[0]?.id ?? '' }))) : []));
  if (noms.length) {
    const withBoth = noms.filter((x) => x.n.heldOut);
    const later = decks.flatMap((d) => d.findings.filter((f) => f.kind === 'change' && f.method === 'paired'));
    const diffs: number[] = [];
    for (const { n, base } of noms) {
      if (n.outcome !== 'adopt' || !n.heldOut) continue;
      const parsed = parseChangeLabel(n.label);
      if (!parsed) continue;
      const key = changeKeyOf(base, parsed);
      const re = later.find((f) => f.subject.change?.key === key);
      if (re) diffs.push(n.heldOut.mean - re.estimate);
    }
    out.push({
      tool: 'forge',
      nominees: noms.length,
      adopted: noms.filter((x) => x.n.outcome === 'adopt').length,
      rejected: noms.filter((x) => x.n.outcome === 'reject').length,
      couldNotTell: noms.filter((x) => x.n.outcome === 'inconclusive').length,
      screenMinusHeldOut: withBoth.length ? { mean: withBoth.reduce((a, x) => a + x.n.screen.mean - x.n.heldOut!.mean, 0) / withBoth.length, n: withBoth.length } : null,
      adoptedMinusLater: diffs.length ? { mean: diffs.reduce((a, x) => a + x, 0) / diffs.length, n: diffs.length } : null,
      repeatNominated: null,
    });
  }
  // the forge under the old any-gain rule (Season 1): confirmations without an interval
  const s1 = forge.filter(({ report }) => !report.adoption).flatMap(({ report }) => report.gens.filter((g) => g.confirm));
  if (s1.length) {
    const gaps = s1.flatMap((g) => {
      const c = /^\((\d+) fresh games\): baseline ([\d.]+)% vs swap ([\d.]+)%/.exec(g.confirm ?? '');
      const top = g.swaps[0];
      return c && top ? [pct(top.delta) - pct(Number(c[3]) - Number(c[2]))] : [];
    });
    out.push({
      tool: 'forge (any-gain)',
      nominees: s1.length,
      adopted: s1.filter((g) => g.verdict === 'adopted').length,
      rejected: s1.filter((g) => g.verdict === 'rejected').length,
      couldNotTell: 0,
      screenMinusHeldOut: gaps.length ? { mean: gaps.reduce((a, x) => a + x, 0) / gaps.length, n: gaps.length } : null,
      adoptedMinusLater: null,
      repeatNominated: null,
    });
  }
  // the ledger's runs: nominated = held-out games in the run; repeat = a later run nominated a change an earlier run had tested
  const batches = ledger.flatMap((f) => f.batches);
  if (batches.length) {
    const ctxKey = (b: LedgerBatch) => `${b.entry.change.slice(0, 16)}#${b.entry.simVersion}#${b.entry.bot}#${b.entry.field}`;
    const groups = new Map<string, LedgerBatch[]>();
    for (const b of batches) {
      const xs = groups.get(ctxKey(b)) ?? [];
      xs.push(b);
      groups.set(ctxKey(b), xs);
    }
    let later = 0;
    let repeat = 0;
    const gaps: number[] = [];
    let nominated = 0;
    for (const bs of groups.values()) {
      const runs = [...new Set(bs.map((b) => b.run))].sort((a, b) => byStr(bs.find((x) => x.run === a)!.date, bs.find((x) => x.run === b)!.date) || byStr(a, b));
      const tested = new Set<string>();
      runs.forEach((run, i) => {
        const mine = bs.filter((b) => b.run === run);
        const nom = [...new Set(mine.filter((b) => b.kind === 'heldout' && b.games.length).map((b) => b.entry.change))];
        nominated += nom.length;
        for (const c of nom) {
          const sc = mine.filter((b) => b.kind === 'screen' && b.entry.change === c).flatMap((b) => b.games);
          const ho = mine.filter((b) => b.kind === 'heldout' && b.entry.change === c).flatMap((b) => b.games);
          if (sc.length >= 2 && ho.length >= 2) gaps.push(plainOf(sc).mean - plainOf(ho).mean);
        }
        if (i > 0 && nom.length) {
          later++;
          if (nom.some((c) => tested.has(c))) repeat++;
        }
        for (const b of mine) tested.add(b.entry.change);
      });
    }
    out.push({
      tool: 'ledger runs',
      nominees: nominated,
      adopted: null,
      rejected: null,
      couldNotTell: null,
      screenMinusHeldOut: gaps.length ? { mean: gaps.reduce((a, x) => a + x, 0) / gaps.length, n: gaps.length } : null,
      adoptedMinusLater: null,
      repeatNominated: later ? { share: repeat / later, runs: later } : null,
    });
  }
  return out;
}

/** Build every deck's evidence and the index from the inputs. */
export function buildEvidence(inputs: EvidenceInputs): BuiltEvidence {
  const current = inputs.simVersion;
  const pool = eventPool(inputs.events);
  const ratingRow = new Map((inputs.ratings?.decks ?? []).map((row, i) => [row.name, { i, row }]));
  const lists = new Map<string, Pick<DeckList, 'legends' | 'main'>>();
  for (const l of inputs.history) lists.set(listFingerprint(l), l);
  for (const d of inputs.library) lists.set(listFingerprint(d.deck), d.deck);
  const idOf = new Map(inputs.library.map((d) => [d.deck.name, listFingerprint(d.deck)]));
  const spread = pairSpread(inputs.analysis);
  const check = matchupCheck(pool.events.map(eventMatches), spread.tau2);
  // the h2h file's fit, rebuilt from the same games (as scripts/build-h2h.ts fits it) for its covariance
  let fit: RatingFit | null = null;
  let fitOk = false;
  if (inputs.h2h?.model && pool.games.length) {
    fit = fitRatings(pool.games);
    const at = new Map(fit.names.map((n, k) => [n, k]));
    fitOk = inputs.h2h.decks.every((n, k) => {
      const j = at.get(n);
      return j !== undefined && Math.abs(fit!.r[j]! - (inputs.h2h!.model!.ratings[k] ?? NaN)) < 2e-4;
    });
  }
  const ctx: Ctx = { inputs, current, pool, ratingRow, lists, lengthCut: lengthCuts(pool.all.map((g) => g.turns)), check, spread, fit, fitOk };

  const drafts = new Map<string, Draft[]>();
  const extras = new Map<string, { open: OpenQuestion[]; runs: RunRecord[]; gaps: GapNote[] }>();
  for (const d of inputs.library) {
    const listId = listFingerprint(d.deck);
    const gaps: GapNote[] = [];
    const played = pool.lists.get(d.deck.name);
    const other = !!played && [...played].some((x) => x !== listId);
    if (other) gaps.push({ code: 'other-list-events' });
    const evFlags: FlagCode[] = other ? ['other-list'] : [];
    const ds: Draft[] = [];
    const strength = deckStrength(ctx, d, listId, evFlags);
    if (strength) ds.push(strength);
    ds.push(...matchups(ctx, d, listId, idOf, evFlags));
    ds.push(...directMatchups(ctx, d, listId, idOf));
    const st = seat(ctx, d, listId, evFlags);
    if (st) ds.push(st);
    const ln = length(ctx, d, listId, evFlags);
    if (ln) ds.push(ln);
    ds.push(...endings(ctx, d, listId, evFlags));
    ds.push(...cards(ctx, d, listId, gaps));
    ds.push(...packages(ctx, d, listId, gaps));
    // changes: the ledger's entries of this list, the recorded forge reports for its file, re-measurements
    const ledgerFile = inputs.ledger.find((f) => f.file === `${listId}.jsonl`);
    const batches = ledgerFile?.batches ?? [];
    const entries = [...mergeBatches(batches).values()].sort((a, b) => byStr(a.key, b.key));
    const lc = ledgerChanges(ctx, d, listId, entries, ledgerFile?.file ?? `${listId}.jsonl`);
    ds.push(...lc.drafts);
    const reports = inputs.forge.filter((f) => f.report.file === d.file).sort((a, b) => byStr(a.file, b.file));
    ds.push(...forgeChanges(ctx, d, listId, reports));
    ds.push(...remeasured(ctx, d, listId, idOf));
    const runs = [...forgeRuns(ctx, reports, entries), ...ledgerRuns(ctx, batches, entries, ledgerFile?.file ?? `${listId}.jsonl`)];
    if (reports.some((r) => !r.report.adoption)) gaps.push({ code: 'season1-no-interval' });
    const changes = ds.filter((x) => x.kind === 'change');
    if (!changes.length && !runs.length) gaps.push({ code: 'no-changes' });
    else if (changes.length && changes.every((x) => canonicalBot(x.bot) !== 'hard')) gaps.push({ code: 'no-hard-changes' });
    drafts.set(listId, ds);
    extras.set(listId, { open: lc.open, runs, gaps });
  }

  const all = finalize([...drafts.values()].flat(), current);
  // "Medium only" until the same question has a Hard measurement
  const hardQuestions = new Set(all.filter((f) => f.kind === 'change' && f.bot === 'hard').map((f) => f.question));
  for (const f of all) if (f.kind === 'change' && f.bot === 'medium' && !hardQuestions.has(f.question)) f.flags = [...f.flags, 'medium-only' as const].sort((a, b) => FLAG_CODES.indexOf(a) - FLAG_CODES.indexOf(b));

  // a repeated id or two ids with one short id stop the build (the cite line and the links need both unique)
  const problems = idProblems(all);

  const kindOrder = (f: Finding) => ['deck-strength', 'matchup', 'seat', 'length', 'ending', 'card-assoc', 'package-assoc', 'change'].indexOf(f.kind);
  const decks: DeckEvidence[] = inputs.library
    .map((d) => {
      const listId = listFingerprint(d.deck);
      const findings = all
        .filter((f) => f.subject.listId === listId)
        .sort((a, b) => kindOrder(a) - kindOrder(b) || byStr(a.subject.opponent?.deck ?? '', b.subject.opponent?.deck ?? '') || byStr(a.method, b.method) || byStr(a.subject.card?.name ?? a.subject.package?.name ?? a.subject.ending ?? '', b.subject.card?.name ?? b.subject.package?.name ?? b.subject.ending ?? '') || byStr(a.id, b.id));
      const x = extras.get(listId)!;
      const ev: DeckEvidence = { kind: EVIDENCE_KIND, schema: 1, simVersion: current, listId, deck: d.deck.name, file: d.file, findings, open: x.open, gaps: x.gaps };
      return roundDeep(ev);
    })
    .sort((a, b) => byStr(a.file, b.file));
  const runs: DeckRuns[] = decks.flatMap((d) => {
    const r = extras.get(d.listId)!.runs;
    return r.length ? [roundDeep<DeckRuns>({ kind: EVIDENCE_RUNS_KIND, schema: 1, simVersion: current, listId: d.listId, deck: d.deck, file: d.file, runs: r })] : [];
  });
  const runCount = new Map(runs.map((r) => [r.listId, r.runs.length]));
  const ids: EvidenceIds = { kind: EVIDENCE_IDS_KIND, schema: 1, decks: Object.fromEntries(decks.map((d) => [d.listId, d.findings.map((f) => f.short).join('')])) };

  const tagged = decks.flatMap((d) => d.findings.map((f) => ({ f, listId: d.listId, deck: d.deck })));
  const fresh = tagged.filter((x) => !x.f.flags.includes('stale'));
  // a matchup and its mirror are one fact: the pool keeps the side that is favoured (the first list id on an even one)
  const oneSide = (f: Finding) => f.kind !== 'matchup' || f.estimate > 0.5 || (f.estimate === 0.5 && f.subject.listId < (f.subject.opponent?.listId ?? ''));
  const top = [topList('effects', fresh.filter((x) => x.f.nature === 'effect')), topList('results', fresh.filter((x) => x.f.nature === 'result' && oneSide(x.f))), topList('patterns', fresh.filter((x) => x.f.nature === 'association'))];
  const counts = (fs: Finding[]) => Object.fromEntries(STRENGTHS.map((s) => [s, fs.filter((f) => f.strength === s).length])) as Record<Strength, number>;
  const thresholds = (k: 'min' | 'strong') => Object.fromEntries((Object.keys(GAME_THRESHOLDS) as MethodClass[]).map((c) => [c, GAME_THRESHOLDS[c][k]])) as Record<MethodClass, number>;
  const inputsList = [
    { file: inputs.paths.ratings, runId: inputs.ratings?.manifest ? ((inputs.ratings.manifest as RunManifest).runId ?? null) : null },
    { file: inputs.paths.h2h, runId: (inputs.h2h?.manifest as RunManifest | undefined)?.runId ?? null },
    { file: inputs.paths.analysis, runId: inputs.analysis?.manifest?.runId ?? null },
    { file: inputs.paths.synergies, runId: inputs.synergies?.manifest?.runId ?? null },
    ...pool.events.map((e) => ({ file: `${inputs.paths.events}/event-${e.id}.json`, runId: (e.manifest as RunManifest | undefined)?.runId ?? null })),
    ...inputs.forge.map((f) => ({ file: f.file, runId: f.report.manifest.runId })),
    ...inputs.remeasure.map((f) => ({ file: f.file, runId: null })),
    ...inputs.ledger.map((f) => ({ file: `${inputs.paths.ledgerDir}/${f.file}`, runId: null })),
    ...(inputs.adjusted ? [{ file: inputs.adjusted.file, runId: inputs.adjusted.data.manifest?.runId ?? null }] : []),
  ];
  const index: EvidenceIndex = roundDeep({
    kind: EVIDENCE_INDEX_KIND,
    schema: 1 as const,
    simVersion: current,
    decks: decks.map((d) => ({ file: d.file, deck: d.deck, listId: d.listId, path: `evidence/${d.listId}.json`, findings: d.findings.length, counts: counts(d.findings), stale: d.findings.filter((f) => f.flags.includes('stale')).length, runs: runCount.get(d.listId) ?? 0, runsPath: runCount.has(d.listId) ? `evidence/${d.listId}.runs.json` : null })),
    top,
    health: health(decks, inputs.forge, inputs.ledger),
    rules: {
      strength: { minimum: thresholds('min'), strong: thresholds('strong'), minEffect: MIN_EFFECT, noDifferenceHalfWidth: NO_DIFFERENCE_HALF_WIDTH, bhQ: BH_Q },
      length: ctx.lengthCut,
      matchup: {
        spreadSd: spread.sd,
        spreadMeasured: spread.measured,
        spreadPairings: spread.pairings,
        spreadGames: spread.games,
        chi2: spread.chi2,
        df: spread.df,
        heldOutMatches: check.matches,
        heldOutGames: check.games,
        slope: check.slope,
        slopeSe: check.slopeSe,
        favouredWins: check.favouredWins,
        favouredExpected: check.favouredExpected,
        squaredDistance: check.squaredDistance,
        squaredDistanceSe: check.squaredDistanceSe,
        claimedVariance: check.claimedVariance,
        claimedWithoutSpread: check.claimedWithoutSpread,
      },
    },
    gaps: [{ code: 'no-bot-transfer' }, { code: 'no-rank-stability' }, { code: 'no-ablations' }],
    inputs: inputsList,
    manifest: aggregateManifest('evidence', pool.events as unknown as RecordedEventInput[], { games: pool.all.length }),
  });
  return { decks, runs, ids, index, problems };
}

/** The kinds' methods, for the checks (an effect must be paired). */
export const PAIRED_METHODS: readonly Method[] = ['paired-pooled', 'paired-staged', 'paired'];
