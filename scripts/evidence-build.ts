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
import { eventRatedGames, ratedGamesOf, type GamesEvent, type ListGate } from '../src/lib/ratingGames';
import { fitLogistic } from '../src/lib/logistic';
import { fitRatings, predictPair, type RatedGame, type RatingFit } from '../src/lib/ratingModel';
import { h2hEstimator, h2hFileLookup, MAX_PRIOR_GAMES, pairSpreadSd, pairSpreadVar } from '../src/lib/h2hModel';
import { cardAnalysis, gapOf, packageFact, winRateOf, type AnalysisInput } from '../src/lib/cardFacts';
import type { SynergyReport } from '../src/analysis/synergies';
import { wilson, type DecisionReport } from '../src/analysis/decisions';
import { cardSellShare } from '../src/lib/sellShare';
import type { AdjustedDeck } from '../src/analysis/impactAdjusted';
import { entryKey, fieldFingerprint, gamesToSettle, ledgerBot, ledgerVerdict, mergeBatches, summarize, type LedgerBatch, type LedgerEntry, type LedgerGame } from '../src/lib/changeLedger';
import { changeStatus, pooledGain, pooledGames, SHORTLIST_DEFAULTS, swapOfKey, type ShortlistRule } from '../src/lib/shortlist';
import { ADOPTION_DEFAULTS, ANY_GAIN_RULE, adoptionRule, describeRule, pairedInterval, type AdoptionProvenance, type AdoptionRule } from '../src/lib/evidence';
import { detect, perGameSd } from '../src/lib/deckSearch';
import { heterogeneity, type SplitNomineeRecord } from '../src/lib/pairedSplit';
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
  isOtherBot,
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
  type FindingDetail,
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
import { currentListGate, selectEvents } from './event-pool';
import { forEachGameOf, isRun, type RecordedEvent } from './lib-node';

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
    /** reports from 2026-11-15 on: each with its held-out games by opponent (list fingerprint) and seat */
    nominees?: SplitNomineeRecord[];
    confirm?: string;
  }[];
  summary?: { gen: number; wr: number; change: string }[];
  /**
   * forge --ledger only: where its games were kept, the bots and field, and (reports from 2026-11-16 on) the run label its
   * batches carry there (`run`), by which the report is joined to them (joinReports)
   */
  ledger?: { dir: string; bot: string; heldoutBot?: string; field: string; run?: string };
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
  /** every rating run (data/series, docs/SERIES.md), pooled beside the events; absent or empty when there are none */
  runs?: RecordedEvent[];
  ratings: (RatingsInput & { firstPlayerEdge?: number }) | null;
  h2h: H2HInput | null;
  analysis: AnalysisInput | null;
  synergies: SynergyReport | null;
  /** the decision telemetry report (public/data/decisions.json): each card's sells out of its uses from hand (src/lib/sellShare.ts); absent or null, card rows carry none */
  decisions?: DecisionReport | null;
  /** the current synergy catalogue version (CATALOGUE_VERSION) */
  catalogueVersion: string;
  /** the change ledger, file by file (readLedgerDir) */
  ledger: { file: string; batches: LedgerBatch[] }[];
  forge: { file: string; report: ForgeReport }[];
  remeasure: { file: string; data: RemeasureFile }[];
  adjusted: { file: string; data: AdjustedFile } | null;
  /** where each input lives, for the findings' sources */
  paths: { ratings: string; h2h: string; analysis: string; synergies: string; events: string; ledgerDir: string; series?: string; decisions?: string };
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

/** χ² heterogeneity of group means (src/lib/pairedSplit.ts, where the builders' nominees take it from too). */
export { heterogeneity };

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

// ---------------------------------------------------------------- a recorded run that is also in the ledger

/**
 * A recorded forge report joined to the run of the change ledger that holds its games (docs/EVIDENCE.md "When a recorded
 * run is also in the ledger"): the same forge process, so its nominees and its run are shown once.
 */
export interface ReportJoin {
  /** the report's file (reports/forge/<deck>.json) */
  report: string;
  /** the ledger file that holds the run's games on the report's starting list, and the run label its batches carry */
  file: string;
  run: string;
  /** 'label': the report names the run (forge --ledger from 2026-11-16 on); 'content': matched by content */
  how: 'label' | 'content';
}

/** A ledger directory as written in a report or given to the builder, in one spelling ("./data/ledger/" = "data/ledger"). */
const normDir = (d: string) => d.replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/\/+$/, '');

/** The change keys of every change a report screened (its trials), on the report's starting list. */
function trialKeys(report: ForgeReport, base: string): Set<string> {
  const out = new Set<string>();
  for (const g of report.gens)
    for (const s of g.swaps) {
      const parsed = parseChangeLabel(s.swap);
      if (parsed) out.add(changeKeyOf(base, parsed));
    }
  return out;
}

/**
 * Which ledger run holds a recorded report's games. A report takes part only when it has a `ledger` record whose
 * directory is the builder's ledger directory; its candidates are the runs in the ledger file of its starting list
 * (`manifest.decks[0].id`).
 * - By label: the report's `ledger.run` names a run in that file.
 * - By content (a report without the label): every batch of the run in that file has the report's date, simulator
 *   version and ledger field, its screening batches the report's screening bot and its held-out batches the report's
 *   held-out bot (`heldoutBot`, else the same bot), and every change it holds is one of the report's trials by change
 *   key; the report must have exactly one such run.
 * A (file, run) pair claimed by more than one report (by label or as a candidate) joins none of them: nothing is merged
 * and nothing hidden.
 */
export function joinReports(forge: readonly { file: string; report: ForgeReport }[], ledger: EvidenceInputs['ledger'], ledgerDir: string): ReportJoin[] {
  const pairKey = (file: string, run: string) => `${file}\u0001${run}`;
  const claims = new Map<string, number>();
  const claim = (k: string) => claims.set(k, (claims.get(k) ?? 0) + 1);
  const wanted: { report: string; file: string; runs: string[]; how: ReportJoin['how'] }[] = [];
  for (const { file: rf, report } of forge) {
    const l = report.ledger;
    if (!l || normDir(l.dir) !== normDir(ledgerDir)) continue;
    const base = report.manifest.decks[0]?.id ?? '';
    const lf = ledger.find((f) => f.file === `${base}.jsonl`);
    if (!lf) continue;
    const runs = new Map<string, LedgerBatch[]>();
    for (const b of lf.batches) runs.set(b.run, [...(runs.get(b.run) ?? []), b]);
    let found: string[];
    let how: ReportJoin['how'];
    if (l.run !== undefined) {
      found = runs.has(l.run) ? [l.run] : [];
      how = 'label';
    } else {
      const keys = trialKeys(report, base);
      const screenBot = canonicalBot(l.bot);
      const heldBot = canonicalBot(l.heldoutBot ?? l.bot);
      found = [...runs.entries()]
        .filter(([, bs]) => bs.every((b) => b.date === report.date && b.entry.simVersion === report.manifest.simVersion && b.entry.field === l.field && b.entry.bot === (b.kind === 'screen' ? screenBot : heldBot) && keys.has(b.entry.change)))
        .map(([run]) => run)
        .sort(byStr);
      how = 'content';
    }
    for (const run of found) claim(pairKey(lf.file, run));
    wanted.push({ report: rf, file: lf.file, runs: found, how });
  }
  return wanted.flatMap((w) => (w.runs.length === 1 && claims.get(pairKey(w.file, w.runs[0]!)) === 1 ? [{ report: w.report, file: w.file, run: w.runs[0]!, how: w.how }] : []));
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
    const flags = [...new Set<FlagCode>([...(isStale(d.simVersion, current) ? (['stale'] as const) : []), ...(isOtherBot(d.bot, NATURE_OF[d.kind]) ? (['other-bot'] as const) : []), ...d.flags])].sort((a, b) => FLAG_CODES.indexOf(a) - FLAG_CODES.indexOf(b));
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
  /** the pooled events (not the rating runs) */
  events: RecordedEvent[];
  /** the pooled rating runs */
  runs: RecordedEvent[];
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

function eventPool(events: RecordedEvent[], runs: readonly RecordedEvent[], gate: ListGate): EventPool {
  const sel = selectEvents([...events, ...runs]);
  const kept = sel.kept;
  const byDeck = new Map<string, DeckGame[]>();
  const all: EventPool['all'] = [];
  const push = (d: string, g: DeckGame) => {
    const xs = byDeck.get(d) ?? [];
    xs.push(g);
    byDeck.set(d, xs);
  };
  // the pooled-records iteration (forEachGameOf, as scripts/build-h2h.ts): copies play as their deck, mirrors skipped,
  // and a game counts only on the library's current lists (the gate, as ratings.ts and build-h2h.ts pool them)
  forEachGameOf(kept, ({ game: g, decks: [a, b] }) => {
    if (a === b) return;
    const reason = g.reason ?? '';
    all.push({ turns: g.turns, reason, winner: g.winner });
    const sa = g.winner === 'tie' ? 0.5 : g.winner === 0 ? 1 : 0;
    push(a, { opp: b, first: g.first === 0, s: sa, turns: g.turns, reason, winner: g.winner === 'tie' ? 'tie' : g.winner === 0 ? 0 : 1 });
    push(b, { opp: a, first: g.first === 1, s: 1 - sa, turns: g.turns, reason, winner: g.winner === 'tie' ? 'tie' : g.winner === 1 ? 0 : 1 });
  }, gate);
  const games = ratedGamesOf(kept, gate);
  if (games.length !== all.length) throw new Error(`the rated games (${games.length}) and the pooled games (${all.length}) disagree`);
  // the lists each deck name was recorded with, games counted or not (a list that differs from the current one is a gap)
  const lists = new Map<string, Set<string>>();
  for (const e of kept)
    for (const [name, d] of Object.entries(e.decks)) {
      const s = lists.get(name) ?? new Set<string>();
      s.add(listFingerprint(d));
      lists.set(name, s);
    }
  const newest = kept[kept.length - 1];
  return { events: kept.filter((e) => !isRun(e)), runs: kept.filter(isRun), simVersion: typeof sel.simVersion === 'number' ? sel.simVersion : (newest?.simVersion as number | undefined) ?? 0, bot: sel.bot === 'all' ? 'all' : sel.bot, games, byDeck, all, lists };
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

export interface PairSpread {
  /** τ² at an even pairing (p = ½): the variance of a pairing's true win rate around the ratings' prediction, and its SD */
  tau2: number;
  sd: number;
  /** the head-to-head file's prior weight in games: a pairing at p has τ² = p(1−p)/(M + 1) (`pairSpreadVar`) */
  priorGames: number;
  /** measured: the file's spread estimate is above the floor (false: no spread beyond chance, M at its cap, or no model) */
  measured: boolean;
  /** the pairings and games it was measured on, and the fit's χ² with its degrees of freedom (null in older files) */
  pairings: number;
  games: number;
  chi2: number | null;
  df: number | null;
}

/**
 * The pair spread the matchup intervals use: the head-to-head file's own (src/lib/h2hModel.ts `fitShrinkage`, the one
 * estimate of it since 2026-11-24, fitted on the pooled games with the fit's share added back), read from its model
 * block. A pairing at p has τ² = p(1−p)/(M + 1) with M the file's prior weight (`pairSpreadVar`), so the interval and the
 * stored estimate assume the same spread. Until 2026-11-24 τ² was measured apart, on the deep bot's meta pairings
 * (analysis.json), and the estimate's own spread was biased toward zero.
 */
export function pairSpread(h2h: Pick<NonNullable<EvidenceInputs['h2h']>, 'model' | 'pairs' | 'games'> | null): PairSpread {
  const m = h2h?.model;
  if (!m) return { tau2: pairSpreadVar(0.5, MAX_PRIOR_GAMES), sd: pairSpreadSd(MAX_PRIOR_GAMES), priorGames: MAX_PRIOR_GAMES, measured: false, pairings: 0, games: 0, chi2: null, df: null };
  const floor = 1 / (MAX_PRIOR_GAMES + 1);
  return {
    tau2: pairSpreadVar(0.5, m.priorGames),
    sd: pairSpreadSd(m.priorGames),
    priorGames: m.priorGames,
    measured: (m.rhoRaw ?? m.rho) > floor,
    pairings: h2h.pairs.length,
    games: h2h.games ?? h2h.pairs.reduce((a, x) => a + x[3], 0),
    chi2: m.chi2 ?? null,
    df: m.df ?? null,
  };
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
  /** each training fold's own shrinkage weight (games), in event order */
  foldPriorGames: number[];
}

/** One event's matches, each as its rated games (eventRatedGames over the one match: copies play as their deck). */
export function eventMatches(e: GamesEvent, gate?: ListGate): RatedGame[][] {
  return [...e.rounds, ...e.bracket].flatMap((part) => part.matches.map((m) => eventRatedGames({ ...(e.setup ? { setup: e.setup } : {}), ...(e.decks ? { decks: e.decks } : {}), rounds: [{ matches: [m] }], bracket: [] }, gate))).filter((gs) => gs.length > 0);
}

/**
 * Leave one event out, match by match: fit ratings and shrinkage on the other events (h2hEstimator); each held-out game's
 * chance is the training fit's prediction for its seat plus the pairing's shrunk residual (estimate − seat-averaged
 * prediction). (a) Calibration: the logistic slope of the result on the logit of that chance (1 = calibrated, below 1 =
 * over-confident), and the favoured deck's score against expected. (b) The squared distance of the truth from the
 * estimate: given the pairing's true rate, the residuals of games 1 and 2 of a match are independent and both are always
 * played, so the mean of their product estimates it with no binomial correction; beside it, the mean variance the
 * interval claims: matchupVariance with the fold's own shrinkage weight and the pair spread `pairSpreadVar` at
 * `spreadPriorGames` (the head-to-head file's prior weight, which the page's intervals use; default: each fold's own), and
 * without any spread.
 */
export function matchupCheck(perEvent: readonly (readonly RatedGame[][])[], spreadPriorGames?: number): MatchupCheck {
  const names = [...new Set(perEvent.flatMap((e) => e.flatMap((m) => m.flatMap((g) => [g.a, g.b]))))];
  const xs: number[][] = [];
  const ys: number[] = [];
  let favW = 0;
  let favE = 0;
  const prods: number[] = [];
  let claimed = 0;
  let claimed0 = 0;
  let matches = 0;
  const foldPriorGames: number[] = [];
  perEvent.forEach((held, e) => {
    const train = perEvent.flatMap((x, k) => (k === e ? [] : x.flat()));
    if (!train.length) return;
    const est = h2hEstimator(train, { names });
    foldPriorGames.push(est.shrinkage.priorGames);
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
        claimed += matchupVariance(p, rec.g, est.shrinkage.priorGames, vp, pairSpreadVar(p, spreadPriorGames ?? est.shrinkage.priorGames));
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
    foldPriorGames,
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

const eventsSource = (ctx: Ctx, path: string): Source => ({
  file: ctx.inputs.paths.events,
  path: `event-${ctx.pool.events[0]?.id ?? 1}.json … event-${ctx.pool.events[ctx.pool.events.length - 1]?.id ?? 1}.json${ctx.pool.runs.length ? ` and ${ctx.inputs.paths.series ?? 'data/series'}/${ctx.pool.runs[0]!.id}.json … ${ctx.pool.runs[ctx.pool.runs.length - 1]!.id}.json` : ''}: ${path}`,
});

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
    // the pair spread the stored estimate assumes (one estimate: h2hModel.ts fitShrinkage), at this pairing's rate
    const tau2 = pairSpreadVar(rec.p, m);
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
      detail: { raw: { wins: rec.w, games: rec.g }, prediction: pred, priorGames: m, pairSd: Math.sqrt(tau2) },
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

/** Each card's type, for the sell share (a Program cast in a reaction window is a use from hand). */
const CARD_TYPE = new Map(CARDS.map((c) => [c.id, c.type]));

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
  const dec = ctx.inputs.decisions ?? null;
  const dp = ctx.inputs.paths.decisions ?? 'public/data/decisions.json';
  const ddi = dec ? dec.decks.findIndex((x) => x.listId === listId) : -1;
  const out: Draft[] = [];
  let thin = 0;
  deck.cards.forEach((c, ci) => {
    const fact = cardAnalysis(an, p, c.id, listId);
    if (!fact?.gap || fact.wonDrawn.rate === null || fact.wonNotDrawn.rate === null) {
      thin++;
      return;
    }
    const adjusted = adjustedOf(ctx, listId, deck.deck, c.id);
    // how often the bot sold it, from the decision telemetry of this list (a Program's reactions are uses from hand too)
    const sold = dec && ddi >= 0 ? cardSellShare(dec, c.id, { listId, reactFromHand: CARD_TYPE.get(c.id) === 'Program' }) : null;
    const dci = sold ? dec!.decks[ddi]!.cards.findIndex((x) => x.id === c.id) : -1;
    const dm = dec?.manifest;
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
        ...(sold ? [{ file: dp, path: `decks[${ddi}].cards[${dci}].modes` }] : []),
      ],
      family: { key: `${listId}:cards`, size: 0, correction: 'bh' },
      flags: [],
      ...(adjusted ? { adjusted } : {}),
      detail: {
        rates: { a: fact.wonDrawn.rate, aGames: fact.wonDrawn.games, b: fact.wonNotDrawn.rate, bGames: fact.wonNotDrawn.games, aLabel: 'drawn', bLabel: 'not drawn' },
        ...(sold ? { sold: { n: sold.sold, of: sold.uses, bot: dm?.bot?.level ?? '?', simVersion: typeof dm?.simVersion === 'number' ? dm.simVersion : 0, run: dm?.runId ?? null, date: dm?.createdAt ?? null } } : {}),
      },
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

/** The entries that hold games of the same change (same simulator version and field) under another bot: a change screened
 *  by one bot and confirmed by another. Games of two bots never pool. */
const otherBots = (entries: readonly LedgerEntry[], e: LedgerEntry) => entries.filter((x) => x !== e && x.id.change === e.id.change && x.id.simVersion === e.id.simVersion && x.id.field === e.id.field);
/** A change's figure over all its games, screening included: only where one bot played them all. */
const soleEntry = (entries: readonly LedgerEntry[], e: LedgerEntry | undefined) => (e && otherBots(entries, e).length === 0 ? e : undefined);

/** What a joined report's nominee adds to the ledger finding of the same games: the run's own verdict, its flags and the report as a source. */
interface FromReport {
  confirmation?: NonNullable<FindingDetail['confirmation']>;
  flags: FlagCode[];
  source: Source;
}

/**
 * The nominees of this deck's recorded reports that the ledger finding already shows: the report is joined to a ledger
 * run in this deck's ledger file (joinReports), the nominee's change has an entry there in the nominee's context (its
 * simulator version, held-out bot and field) with a finding (2 or more held-out games), and that run holds held-out
 * games of it. Those nominees give no finding of their own (`skip`, by "<report>#<gen index>#<nominee index>"). When
 * every held-out game of the entry comes from that run and they are exactly the nominee's games, the ledger finding also
 * carries the run's own verdict, look and corrected range, and its `first-look` and `stopped-futility` flags (`onEntry`,
 * by entry key); otherwise the run's verdict stays in its run record.
 */
function nomineesInLedger(listId: string, reports: readonly { file: string; report: ForgeReport }[], entries: readonly LedgerEntry[], batches: readonly LedgerBatch[], joins: readonly ReportJoin[]): { skip: Set<string>; onEntry: Map<string, FromReport> } {
  const skip = new Set<string>();
  const onEntry = new Map<string, FromReport>();
  const byKey = new Map(entries.map((e) => [entryKey(e.id), e]));
  for (const { file, report } of reports) {
    const join = joins.find((j) => j.report === file && j.file === `${listId}.jsonl`);
    const a = report.adoption;
    if (!join || !a) continue;
    const base = report.manifest.decks[0]?.id ?? '';
    const field = fieldFingerprint(report.manifest.field.deckIds);
    const bot = canonicalBot(a.confirmBot ?? report.manifest.bot.level);
    report.gens.forEach((g, gi) =>
      (g.nominees ?? []).forEach((nom, ni) => {
        const h = nom.heldOut;
        const parsed = parseChangeLabel(nom.label);
        if (!h || !nom.outcome || !parsed) return;
        const key = entryKey({ change: changeKeyOf(base, parsed), simVersion: report.manifest.simVersion, bot, field });
        const e = byKey.get(key);
        if (!e || e.heldout.length < 2) return;
        const held = batches.filter((b) => b.kind === 'heldout' && entryKey(b.entry) === key);
        if (!held.some((b) => b.run === join.run)) return;
        skip.add(`${file}#${gi}#${ni}`);
        if (!held.every((b) => b.run === join.run) || e.heldout.length !== h.games || onEntry.has(key)) return;
        const flags: FlagCode[] = [];
        if (h.looks === 1) flags.push('first-look');
        if (nom.stopped === 'futility') flags.push('stopped-futility');
        onEntry.set(key, {
          confirmation: {
            outcome: nom.outcome,
            looks: h.looks,
            cap: a.capStages,
            ...(nom.stopped ? { stopped: nom.stopped === 'futility' ? 'futility' : 'stop' } : {}),
            lower: h.lower,
            upper: h.upper,
            sequential: a.correction === 'obrien-fleming' ? 'obrien-fleming' : 'bonferroni',
            run: report.manifest.runId,
          },
          flags,
          source: { file, path: `gens[${gi}].nominees[${ni}].heldOut` },
        });
      }),
    );
  }
  return { skip, onEntry };
}

/**
 * For `npm run ledger -- stats`: each ledger entry whose held-out games all come from one recorded forge run (the same
 * join and the same test as the evidence pages', nomineesInLedger, on the ledger file of the entry's base list), that
 * run's own verdict by its staged rule, by entry key. The ledger's pooled always-valid verdict on the same games may
 * differ; both are right under their own rules.
 */
export function stagedVerdicts(forge: readonly { file: string; report: ForgeReport }[], ledger: EvidenceInputs['ledger'], ledgerDir: string): Map<string, NonNullable<FindingDetail['confirmation']>> {
  const joins = joinReports(forge, ledger, ledgerDir);
  const out = new Map<string, NonNullable<FindingDetail['confirmation']>>();
  for (const f of ledger) {
    const base = f.file.replace(/\.jsonl$/, '');
    const entries = [...mergeBatches(f.batches).values()];
    const reports = forge.filter((r) => (r.report.manifest.decks[0]?.id ?? '') === base);
    for (const [key, rep] of nomineesInLedger(base, reports, entries, f.batches, joins).onEntry) if (rep.confirmation) out.set(key, rep.confirmation);
  }
  return out;
}

function ledgerChanges(ctx: Ctx, d: EvidenceDeck, listId: string, entries: LedgerEntry[], file: string, fromReport: ReadonlyMap<string, FromReport> = new Map()): { drafts: Draft[]; open: OpenQuestion[] } {
  const drafts: Draft[] = [];
  const open: OpenQuestion[] = [];
  // A change screened by one bot and confirmed by another keeps its screening games in one entry and its held-out games
  // in another (the same change, simulator version and field). Games of two bots never pool, so the held-out finding
  // takes its screening figure from the other entry, named by its bot, and the screening-only entry raises no question
  // of its own.
  for (const e of entries) {
    const siblings = otherBots(entries, e);
    const screenFrom = e.screen.length >= 2 ? e : siblings.filter((x) => x.screen.length >= 2).sort((a, b) => b.screen.length - a.screen.length || byStr(a.id.bot, b.id.bot))[0];
    const screenBot = screenFrom && screenFrom !== e ? screenFrom.id.bot : undefined;
    const heldElsewhere = e.heldout.length < 2 && siblings.some((x) => x.heldout.length >= 2);
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
      const screen = screenFrom ? plainOf(screenFrom.screen) : null;
      const het = heterogeneity(sum.byOpp);
      // a recorded forge run whose held-out games these all are: its own verdict, look and flags (nomineesInLedger)
      const rep = fromReport.get(entryKey(e.id));
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
        sources: [{ file: `${ctx.inputs.paths.ledgerDir}/${file}`, path: `${where} heldout` }, ...(rep ? [rep.source] : [])],
        family: { key: `${listId}:change:${entryKey(e.id)}`, size: 1, correction: 'always-valid' },
        flags: [...(het && het.p < 0.05 ? (['depends-on-opponent'] as const) : []), ...(rep?.flags ?? [])],
        detail: {
          ...(screen ? { screen: { games: screen.games, mean: screen.mean, lower: screen.lower, upper: screen.upper, flag: 'screening' as const, ...(screenBot ? { bot: screenBot } : {}) } } : {}),
          verdict,
          ...(rep?.confirmation ? { confirmation: rep.confirmation } : {}),
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
    if (!heldElsewhere && (status.kind === 'live' || status.kind === 'untested') && verdict === 'undecided') {
      open.push({
        ...(findingId ? { finding: findingId } : {}),
        change: subject,
        simVersion: e.id.simVersion,
        bot: e.id.bot,
        field: e.id.field,
        heldout: e.heldout.length,
        // screened by another bot: its screening games are counted and named apart, never read together with these
        screen: screenFrom ? screenFrom.screen.length : e.screen.length,
        ...(screenBot ? { screenBot } : {}),
        pooled: { games: pooled.games, mean: pooled.mean, se: Number.isFinite(pooled.se) ? pooled.se : 0 },
        toSettle,
        more: toSettle === null ? null : Math.max(0, toSettle - e.heldout.length),
        runs: e.runs.length,
      });
    }
  }
  return { drafts, open };
}

/** A recorded report's nominees as findings, except those the ledger's findings already show (`skip`, nomineesInLedger). */
function forgeChanges(ctx: Ctx, d: EvidenceDeck, listId: string, reports: { file: string; report: ForgeReport }[], skip: ReadonlySet<string> = new Set()): Draft[] {
  const out: Draft[] = [];
  for (const { file, report } of reports) {
    const a = report.adoption;
    if (!a) continue;
    const base = report.manifest.decks[0]?.id ?? '';
    const field = fieldFingerprint(report.manifest.field.deckIds);
    // the held-out figure is the confirmation's: its bot, when another bot than the run's confirmed (--confirm-bot)
    const bot = canonicalBot(a.confirmBot ?? report.manifest.bot.level);
    // the screening figure is then the run's bot's, and named
    const screenBot = canonicalBot(report.manifest.bot.level);
    report.gens.forEach((g, gi) => {
      const noms = g.nominees ?? [];
      noms.forEach((nom, ni) => {
        const h = nom.heldOut;
        if (!h || !nom.outcome || skip.has(`${file}#${gi}#${ni}`)) return;
        const parsed = parseChangeLabel(nom.label);
        const key = parsed ? changeKeyOf(base, parsed) : `${base} ?${nom.label}`;
        const half = h.z > 0 ? (h.upper - h.lower) / 2 / h.z : 0;
        const flags: FlagCode[] = [];
        if (h.looks === 1) flags.push('first-look');
        if (nom.stopped === 'futility') flags.push('stopped-futility');
        // a report that kept its held-out games by opponent and seat (older reports did not)
        const het = nom.heterogeneity;
        if (het && het.p < 0.05) flags.push('depends-on-opponent');
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
          detail: {
            screen: { games: nom.screen.games, mean: nom.screen.mean, lower: nom.screen.lower, upper: nom.screen.upper, flag: 'screening', ...(screenBot !== bot ? { bot: screenBot } : {}) },
            verdict: nom.outcome,
            looks: h.looks,
            ...(nom.byOpp ? { byOpp: nom.byOpp.map((o) => ({ opp: o.opp, games: o.games, mean: o.mean, se: o.se })) } : {}),
            ...(nom.bySeat ? { bySeat: nom.bySeat.map((o) => ({ first: o.first, games: o.games, mean: o.mean, se: o.se })) } : {}),
            ...(het ? { heterogeneity: { chi2: het.chi2, df: het.df, p: het.p } } : {}),
            date: report.date,
          },
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

function forgeRuns(ctx: Ctx, reports: { file: string; report: ForgeReport }[], entries: LedgerEntry[], joins: readonly ReportJoin[] = []): RunRecord[] {
  const byKey = new Map(entries.map((e) => [entryKey(e.id), e]));
  return reports.map(({ file, report }) => {
    const join = joins.find((j) => j.report === file);
    const m = report.manifest;
    const a = report.adoption;
    const rule = a ? adoptionRule({ minGainPp: a.minGainPp, packageMinGainPp: a.packageMinGainPp, alpha: a.alpha, boundary: a.correction === 'obrien-fleming' ? 'obrien-fleming' : 'bonferroni', capStages: a.capStages, minGames: a.minGames, futilityAfterStages: a.futilityAfterStages ?? 0, futilityMaxGainPp: a.futilityMaxGainPp ?? 0 }) : ANY_GAIN_RULE;
    const det = a ? detect({ rule, firstStage: a.firstStage, nominees: a.nominees, sd: perGameSd() }) : null;
    const perTest = Number(/(\d+) games per test/.exec(report.field)?.[1] ?? NaN);
    const base = m.decks[0]?.id ?? '';
    const field = fieldFingerprint(m.field.deckIds);
    const bot = canonicalBot(m.bot.level);
    const confirmBot = a?.confirmBot ? canonicalBot(a.confirmBot) : null;
    const trials: TrialRecord[] = [];
    for (const g of report.gens) {
      const noms = new Map((g.nominees ?? []).map((n) => [n.label, n]));
      // a Season 1 (any-gain) confirmation names no nominee: it confirmed the best screened swap
      const s1 = !a && /^\((\d+) fresh games\): baseline ([\d.]+)% vs swap ([\d.]+)%/.exec(g.confirm ?? '');
      g.swaps.forEach((s, si) => {
        const parsed = parseChangeLabel(s.swap);
        const key = parsed ? changeKeyOf(base, parsed) : undefined;
        const nom = noms.get(s.swap);
        // every game of the change over all runs, screening included: none for a change another bot confirmed
        const e = soleEntry(entries, key ? byKey.get(`${key}#v${m.simVersion}#${bot}#${field}`) : undefined);
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
      ...(confirmBot && confirmBot !== bot ? { confirmBot } : {}),
      simVersion: m.simVersion,
      rule: a ? describeRule(rule, { firstStage: a.firstStage, nominees: a.nominees }) : describeRule(ANY_GAIN_RULE),
      games: m.sample.completedGames,
      detect: det && a ? { card: Number.isFinite(det.card) ? det.card : null, package: Number.isFinite(det.package) ? det.package : null, firstStage: a.firstStage, nominees: a.nominees, sdCard: det.sd.card, sdPackage: det.sd.package } : null,
      source: { file, path: 'gens' },
      ...(join ? { ledgerRun: join.run } : {}),
      stale: isStale(m.simVersion, ctx.current),
      trials,
    };
  });
}

const outcomeText = (o: string) => (o === 'adopt' ? 'adopted' : o === 'reject' ? 'rejected' : 'could not tell');

/**
 * Runs the ledger holds games of for this list (grouped by run id), each change it screened or held out; a run joined
 * to a recorded report (`joined`: its labels in this file) is that report's run and is not listed again.
 */
function ledgerRuns(ctx: Ctx, batches: LedgerBatch[], entries: LedgerEntry[], file: string, joined: ReadonlySet<string> = new Set()): RunRecord[] {
  const byKey = new Map(entries.map((e) => [entryKey(e.id), e]));
  const runs = new Map<string, LedgerBatch[]>();
  for (const b of batches) {
    if (joined.has(b.run)) continue;
    const xs = runs.get(b.run) ?? [];
    xs.push(b);
    runs.set(b.run, xs);
  }
  return [...runs.entries()]
    .map(([run, bs]): RunRecord => {
      const first = bs[0]!;
      // a run whose confirmation another bot played keeps its screening under one bot and its held-out games under another
      const screenBot = bs.find((b) => b.kind === 'screen')?.entry.bot ?? first.entry.bot;
      const heldBot = bs.find((b) => b.kind === 'heldout')?.entry.bot;
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
          // every game of the change over all runs: none for a change whose held-out games another bot played
          const e = soleEntry(entries, byKey.get(c.entry));
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
        bot: screenBot,
        ...(heldBot && heldBot !== screenBot ? { confirmBot: heldBot } : {}),
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
/** And at most this many of one deck, so the strongest deck cannot fill them either. */
const PER_DECK = 3;

/**
 * One of the overview's lists from its whole candidate pool (the pool is the family): effects whose strength is strong or
 * moderate (a change keeps its tool's own correction, so no second test is added), results and associations that pass
 * Benjamini–Hochberg over the pool; strongest first, then by |estimate − baseline| / standard error.
 */
/** A finding as the index carries it: what a row and its sentence read, without the detail. */
function refOf(f: Finding, listId: string, deck: string, poolCorrected: boolean, others: number): FindingRef {
  return {
    id: f.id,
    short: f.short,
    question: f.question,
    kind: f.kind,
    nature: f.nature,
    claim: f.claim,
    estimate: f.estimate,
    lower: f.lower,
    upper: f.upper,
    level: f.level,
    ...(f.sequential ? { sequential: f.sequential } : {}),
    baseline: f.baseline,
    games: f.games,
    method: f.method,
    corrected: f.corrected,
    strength: f.strength,
    bot: f.bot,
    simVersion: f.simVersion,
    flags: f.flags,
    listId,
    deck,
    ...(f.detail?.raw ? { detail: { raw: f.detail.raw } } : {}),
    poolCorrected,
    others,
  };
}

function topList(key: TopList['key'], pool: { f: Finding; listId: string; deck: string }[]): TopList {
  const pass = bhPass(pool.map((x) => pValueOf(x.f)));
  // every current measurement of a question in the pool: the effects list names a question once and counts the rest
  const measured = new Map<string, number>();
  for (const x of pool) measured.set(x.f.question, (measured.get(x.f.question) ?? 0) + 1);
  type Entry = { x: (typeof pool)[number]; pass: boolean };
  const order = (a: Entry, b: Entry) => STRENGTH_RANK[a.x.f.strength] - STRENGTH_RANK[b.x.f.strength] || zOf(b.x.f) - zOf(a.x.f) || byStr(a.x.f.id, b.x.f.id);
  let listed: Entry[] = pool
    .map((x, i) => ({ x, pass: pass[i]! }))
    .filter(({ x, pass }) => (key === 'effects' ? x.f.strength === 'strong' || x.f.strength === 'moderate' : pass))
    .sort(order);
  if (key === 'effects') {
    // one row per question: its Hard measurement when that is strong or moderate (the recorded events are played by
    // Hard), else its best-supported one
    const byQuestion = new Map<string, Entry>();
    for (const e of listed) {
      const cur = byQuestion.get(e.x.f.question);
      if (!cur || (e.x.f.bot === 'hard' && cur.x.f.bot !== 'hard')) byQuestion.set(e.x.f.question, e);
    }
    listed = [...byQuestion.values()].sort(order);
  }
  const items: FindingRef[] = listed
    .filter(({ x }, i, xs) => key === 'effects' || xs.slice(0, i).filter((y) => y.x.f.kind === x.f.kind).length < PER_KIND)
    .filter(({ x }, i, xs) => key === 'effects' || xs.slice(0, i).filter((y) => y.x.listId === x.listId).length < PER_DECK)
    .slice(0, TOP_N)
    .map(({ x, pass }) => refOf(x.f, x.listId, x.deck, pass, key === 'effects' ? (measured.get(x.f.question) ?? 1) - 1 : 0));
  return { key, family: { size: pool.length, correction: 'bh' }, items };
}

/** A tool record's context: one simulator version, the screening bot and the held-out bot (sorting key and grouping key). */
type HealthCtx = { simVersion: number; bot: string; heldBot: string };
const ctxKeyOf = (c: HealthCtx) => `${c.simVersion}\u0001${c.bot}\u0001${c.heldBot}`;
/** Records in a fixed order: the newest simulator version first, then by bot, a same-bot record before a cross-bot one. */
const ctxOrder = (a: HealthCtx, b: HealthCtx) => b.simVersion - a.simVersion || byStr(a.bot, b.bot) || Number(a.heldBot !== a.bot) - Number(b.heldBot !== b.bot) || byStr(a.heldBot, b.heldBot);
const ctxFields = (c: HealthCtx) => ({ simVersion: c.simVersion, bot: c.bot, ...(c.heldBot !== c.bot ? { confirmBot: c.heldBot } : {}) });
function groupByCtx<T>(xs: readonly T[], ctxOf: (x: T) => HealthCtx): { ctx: HealthCtx; xs: T[] }[] {
  const m = new Map<string, { ctx: HealthCtx; xs: T[] }>();
  for (const x of xs) {
    const c = ctxOf(x);
    const g = m.get(ctxKeyOf(c)) ?? { ctx: c, xs: [] };
    g.xs.push(x);
    m.set(ctxKeyOf(c), g);
  }
  return [...m.values()].sort((a, b) => ctxOrder(a.ctx, b.ctx));
}
const meanOf = (xs: readonly number[]) => (xs.length ? { mean: xs.reduce((a, x) => a + x, 0) / xs.length, n: xs.length } : null);

/**
 * The tools' record (docs/EVIDENCE.md "The index"), one record per tool, simulator version and pair of bots (screening,
 * held-out): figures of different versions, or of same-bot and cross-bot runs, are never averaged together. Each nominee
 * is counted once: a ledger run joined to a recorded report (`joins`) is the report's, and its batches are left out of
 * the ledger's record.
 */
function health(decks: DeckEvidence[], forge: { file: string; report: ForgeReport }[], ledger: EvidenceInputs['ledger'], joins: readonly ReportJoin[], current: number): ToolHealth[] {
  const out: ToolHealth[] = [];
  // a later re-measurement of an adopted change: on fresh games with the same bot under the current simulator version,
  // the one with the most games
  const later = decks.flatMap((d) => d.findings.filter((f) => f.kind === 'change' && f.method === 'paired' && f.simVersion === current));
  const laterOf = (key: string, bot: string) => later.filter((f) => f.subject.change?.key === key && f.bot === bot).sort((a, b) => b.games - a.games || byStr(a.id, b.id))[0];
  // the forge (Season 2 on: a staged rule with nominees), screened by the run's bot and confirmed by it or by --confirm-bot
  const noms = forge.flatMap(({ report }) => {
    const a = report.adoption;
    if (!a) return [];
    const bot = canonicalBot(report.manifest.bot.level);
    const ctx: HealthCtx = { simVersion: report.manifest.simVersion, bot, heldBot: canonicalBot(a.confirmBot ?? report.manifest.bot.level) };
    return report.gens.flatMap((g) => (g.nominees ?? []).map((n) => ({ n, base: report.manifest.decks[0]?.id ?? '', ctx })));
  });
  for (const { ctx, xs } of groupByCtx(noms, (x) => x.ctx)) {
    const withBoth = xs.filter((x) => x.n.heldOut);
    const diffs: number[] = [];
    for (const { n, base } of xs) {
      if (n.outcome !== 'adopt' || !n.heldOut) continue;
      const parsed = parseChangeLabel(n.label);
      if (!parsed) continue;
      const re = laterOf(changeKeyOf(base, parsed), ctx.heldBot);
      if (re) diffs.push(n.heldOut.mean - re.estimate);
    }
    out.push({
      tool: 'forge',
      ...ctxFields(ctx),
      nominees: xs.length,
      adopted: xs.filter((x) => x.n.outcome === 'adopt').length,
      rejected: xs.filter((x) => x.n.outcome === 'reject').length,
      couldNotTell: xs.filter((x) => x.n.outcome === 'inconclusive').length,
      screenMinusHeldOut: meanOf(withBoth.map((x) => x.n.screen.mean - x.n.heldOut!.mean)),
      adoptedMinusLater: meanOf(diffs),
      repeatNominated: null,
    });
  }
  // the forge under the old any-gain rule (Season 1): confirmations without an interval, by the run's bot
  const s1 = forge
    .filter(({ report }) => !report.adoption)
    .flatMap(({ report }) => {
      const bot = canonicalBot(report.manifest.bot.level);
      return report.gens.filter((g) => g.confirm).map((g) => ({ g, ctx: { simVersion: report.manifest.simVersion, bot, heldBot: bot } }));
    });
  for (const { ctx, xs } of groupByCtx(s1, (x) => x.ctx)) {
    const gaps = xs.flatMap(({ g }) => {
      const c = /^\((\d+) fresh games\): baseline ([\d.]+)% vs swap ([\d.]+)%/.exec(g.confirm ?? '');
      const top = g.swaps[0];
      return c && top ? [pct(top.delta) - pct(Number(c[3]) - Number(c[2]))] : [];
    });
    out.push({
      tool: 'forge (any-gain)',
      ...ctxFields(ctx),
      nominees: xs.length,
      adopted: xs.filter(({ g }) => g.verdict === 'adopted').length,
      rejected: xs.filter(({ g }) => g.verdict === 'rejected').length,
      couldNotTell: 0,
      screenMinusHeldOut: meanOf(gaps),
      adoptedMinusLater: null,
      repeatNominated: null,
    });
  }
  // the ledger's runs, without those joined to a recorded report: a run on a list is its batches in one ledger file.
  // nominated = held-out games in the run; repeat = a later run on the list (same simulator version, field and screening
  // bot) nominated a change an earlier run had tested. A run is counted under its screening bot and the bot of its
  // held-out games (a run with none: its screening bot).
  const joined = new Set(joins.map((j) => `${j.file}\u0001${j.run}`));
  const runsOn = new Map<string, { file: string; run: string; bs: LedgerBatch[] }>();
  for (const f of ledger)
    for (const b of f.batches) {
      const k = `${f.file}\u0001${b.run}`;
      if (joined.has(k)) continue;
      const r = runsOn.get(k) ?? { file: f.file, run: b.run, bs: [] };
      r.bs.push(b);
      runsOn.set(k, r);
    }
  if (runsOn.size) {
    type Tally = { nominated: number; gaps: number[]; later: number; repeat: number };
    const tallies = new Map<string, { ctx: HealthCtx; t: Tally }>();
    const tallyOf = (ctx: HealthCtx) => {
      const k = ctxKeyOf(ctx);
      const x = tallies.get(k) ?? { ctx, t: { nominated: 0, gaps: [], later: 0, repeat: 0 } };
      tallies.set(k, x);
      return x.t;
    };
    const runs = [...runsOn.values()].map((r) => {
      const first = r.bs[0]!;
      const bot = r.bs.find((b) => b.kind === 'screen')?.entry.bot ?? first.entry.bot;
      const heldBot = r.bs.find((b) => b.kind === 'heldout')?.entry.bot ?? bot;
      return { ...r, ctx: { simVersion: first.entry.simVersion, bot, heldBot }, field: first.entry.field, date: first.date };
    });
    const lists = new Map<string, typeof runs>();
    for (const r of runs) {
      const k = `${r.file}\u0001${r.ctx.simVersion}\u0001${r.field}\u0001${r.ctx.bot}`;
      lists.set(k, [...(lists.get(k) ?? []), r]);
    }
    for (const rs of lists.values()) {
      rs.sort((a, b) => byStr(a.date, b.date) || byStr(a.run, b.run));
      const tested = new Set<string>();
      rs.forEach((r, i) => {
        const t = tallyOf(r.ctx);
        const nom = [...new Set(r.bs.filter((b) => b.kind === 'heldout' && b.games.length).map((b) => b.entry.change))];
        t.nominated += nom.length;
        for (const c of nom) {
          const sc = r.bs.filter((b) => b.kind === 'screen' && b.entry.change === c).flatMap((b) => b.games);
          const ho = r.bs.filter((b) => b.kind === 'heldout' && b.entry.change === c).flatMap((b) => b.games);
          if (sc.length >= 2 && ho.length >= 2) t.gaps.push(plainOf(sc).mean - plainOf(ho).mean);
        }
        if (i > 0 && nom.length) {
          t.later++;
          if (nom.some((c) => tested.has(c))) t.repeat++;
        }
        for (const b of r.bs) tested.add(b.entry.change);
      });
    }
    for (const { ctx, t } of [...tallies.values()].sort((a, b) => ctxOrder(a.ctx, b.ctx)))
      out.push({
        tool: 'ledger runs',
        ...ctxFields(ctx),
        nominees: t.nominated,
        adopted: null,
        rejected: null,
        couldNotTell: null,
        screenMinusHeldOut: meanOf(t.gaps),
        adoptedMinusLater: null,
        repeatNominated: t.later ? { share: t.repeat / t.later, runs: t.later } : null,
      });
  }
  return out;
}

/** Build every deck's evidence and the index from the inputs. */
export function buildEvidence(inputs: EvidenceInputs): BuiltEvidence {
  const current = inputs.simVersion;
  const gate = currentListGate(inputs.library);
  const pool = eventPool(inputs.events, inputs.runs ?? [], gate);
  const ratingRow = new Map((inputs.ratings?.decks ?? []).map((row, i) => [row.name, { i, row }]));
  const lists = new Map<string, Pick<DeckList, 'legends' | 'main'>>();
  for (const l of inputs.history) lists.set(listFingerprint(l), l);
  for (const d of inputs.library) lists.set(listFingerprint(d.deck), d.deck);
  const idOf = new Map(inputs.library.map((d) => [d.deck.name, listFingerprint(d.deck)]));
  const spread = pairSpread(inputs.h2h);
  const check = matchupCheck(pool.events.map((e) => eventMatches(e, gate)), spread.priorGames);
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
  // recorded forge reports whose games the ledger also keeps: each nominee and each run is shown once
  const joins = joinReports(inputs.forge, inputs.ledger, inputs.paths.ledgerDir);

  const drafts = new Map<string, Draft[]>();
  const extras = new Map<string, { open: OpenQuestion[]; runs: RunRecord[]; gaps: GapNote[] }>();
  for (const d of inputs.library) {
    const listId = listFingerprint(d.deck);
    const gaps: GapNote[] = [];
    const played = pool.lists.get(d.deck.name);
    const other = !!played && [...played].some((x) => x !== listId);
    // games recorded with another list of this deck are left out of the pool (the gate), so the findings are this list's
    // alone; the gap says that games were left out
    if (other) gaps.push({ code: 'other-list-events' });
    const evFlags: FlagCode[] = [];
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
    const reports = inputs.forge.filter((f) => f.report.file === d.file).sort((a, b) => byStr(a.file, b.file));
    const inLedger = nomineesInLedger(listId, reports, entries, batches, joins);
    const lc = ledgerChanges(ctx, d, listId, entries, ledgerFile?.file ?? `${listId}.jsonl`, inLedger.onEntry);
    ds.push(...lc.drafts);
    ds.push(...forgeChanges(ctx, d, listId, reports, inLedger.skip));
    ds.push(...remeasured(ctx, d, listId, idOf));
    // a ledger run joined to one of this deck's reports is that report's run
    const joinedRuns = new Set(joins.filter((j) => j.file === `${listId}.jsonl` && reports.some((r) => r.file === j.report)).map((j) => j.run));
    const runs = [...forgeRuns(ctx, reports, entries, joins), ...ledgerRuns(ctx, batches, entries, ledgerFile?.file ?? `${listId}.jsonl`, joinedRuns)];
    if (reports.some((r) => !r.report.adoption)) gaps.push({ code: 'season1-no-interval' });
    const changes = ds.filter((x) => x.kind === 'change');
    if (!changes.length && !runs.length) gaps.push({ code: 'no-changes' });
    else if (changes.length && changes.every((x) => canonicalBot(x.bot) !== 'hard')) gaps.push({ code: 'no-hard-changes' });
    drafts.set(listId, ds);
    extras.set(listId, { open: lc.open, runs, gaps });
  }

  const all = finalize([...drafts.values()].flat(), current);
  // What Hard says about a change measured with Medium: "Medium only" until the same question has a Hard measurement
  // under the current simulator version, then what that measurement (the one with the most games) shows on its own:
  // it finds no difference of a point or more, or does not settle it yet, or its range excludes no difference: then it
  // confirms the Medium finding's direction or reads the other way, or, where the Medium finding has no direction of its
  // own (its plain range includes no difference), it decides the question
  const hardOf = new Map<string, Finding>();
  for (const f of all) {
    if (f.kind !== 'change' || f.bot !== 'hard' || isStale(f.simVersion, current)) continue;
    const cur = hardOf.get(f.question);
    if (!cur || f.games > cur.games) hardOf.set(f.question, f);
  }
  const hardFlag = (f: Finding): FlagCode => {
    const h = hardOf.get(f.question);
    if (!h) return 'medium-only';
    if (h.strength === 'no-difference') return 'hard-no-difference';
    if (h.strength !== 'strong' && h.strength !== 'moderate') return 'hard-unsettled';
    const [lo, hi] = plain95(f);
    if (!(lo > f.baseline || hi < f.baseline)) return 'hard-decides';
    return Math.sign(h.estimate - h.baseline) === Math.sign(f.estimate - f.baseline) ? 'hard-confirms' : 'hard-opposite';
  };
  for (const f of all) if (f.kind === 'change' && f.bot === 'medium') f.flags = [...f.flags, hardFlag(f)].sort((a, b) => FLAG_CODES.indexOf(a) - FLAG_CODES.indexOf(b));

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
  const oneSide = (f: Finding) => {
    if (f.kind === 'matchup') return f.estimate > 0.5 || (f.estimate === 0.5 && f.subject.listId < (f.subject.opponent?.listId ?? ''));
    // an ending and its complement are one fact: the pool keeps the one above the field's share
    if (f.kind === 'ending') return f.estimate >= f.baseline;
    return true;
  };
  const top = [topList('effects', fresh.filter((x) => x.f.nature === 'effect')), topList('results', fresh.filter((x) => x.f.nature === 'result' && oneSide(x.f))), topList('patterns', fresh.filter((x) => x.f.nature === 'association'))];
  // each deck's strength finding, so the overview can state it without fetching 47 deck files
  const strengthRef = (d: DeckEvidence): FindingRef | null => {
    const f = d.findings.find((x) => x.kind === 'deck-strength');
    return f ? refOf(f, d.listId, d.deck, f.corrected, 0) : null;
  };
  const counts = (fs: Finding[]) => Object.fromEntries(STRENGTHS.map((s) => [s, fs.filter((f) => f.strength === s).length])) as Record<Strength, number>;
  const thresholds = (k: 'min' | 'strong') => Object.fromEntries((Object.keys(GAME_THRESHOLDS) as MethodClass[]).map((c) => [c, GAME_THRESHOLDS[c][k]])) as Record<MethodClass, number>;
  const inputsList = [
    { file: inputs.paths.ratings, runId: inputs.ratings?.manifest ? ((inputs.ratings.manifest as RunManifest).runId ?? null) : null },
    { file: inputs.paths.h2h, runId: (inputs.h2h?.manifest as RunManifest | undefined)?.runId ?? null },
    { file: inputs.paths.analysis, runId: inputs.analysis?.manifest?.runId ?? null },
    { file: inputs.paths.synergies, runId: inputs.synergies?.manifest?.runId ?? null },
    ...(inputs.decisions ? [{ file: inputs.paths.decisions ?? 'public/data/decisions.json', runId: inputs.decisions.manifest?.runId ?? null }] : []),
    ...pool.events.map((e) => ({ file: `${inputs.paths.events}/event-${e.id}.json`, runId: (e.manifest as RunManifest | undefined)?.runId ?? null })),
    ...pool.runs.map((e) => ({ file: `${inputs.paths.series ?? 'data/series'}/${e.id}.json`, runId: (e.manifest as RunManifest | undefined)?.runId ?? null })),
    ...inputs.forge.map((f) => ({ file: f.file, runId: f.report.manifest.runId })),
    ...inputs.remeasure.map((f) => ({ file: f.file, runId: null })),
    ...inputs.ledger.map((f) => ({ file: `${inputs.paths.ledgerDir}/${f.file}`, runId: null })),
    ...(inputs.adjusted ? [{ file: inputs.adjusted.file, runId: inputs.adjusted.data.manifest?.runId ?? null }] : []),
  ];
  const index: EvidenceIndex = roundDeep({
    kind: EVIDENCE_INDEX_KIND,
    schema: 1 as const,
    simVersion: current,
    decks: decks.map((d) => ({ file: d.file, deck: d.deck, listId: d.listId, path: `evidence/${d.listId}.json`, findings: d.findings.length, strength: strengthRef(d), counts: counts(d.findings), stale: d.findings.filter((f) => f.flags.includes('stale')).length, runs: runCount.get(d.listId) ?? 0, runsPath: runCount.has(d.listId) ? `evidence/${d.listId}.runs.json` : null })),
    top,
    health: health(decks, inputs.forge, inputs.ledger, joins, current),
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
    manifest: aggregateManifest('evidence', [...pool.events, ...pool.runs] as unknown as RecordedEventInput[], { games: pool.all.length }),
  });
  return { decks, runs, ids, index, problems };
}

/** The kinds' methods, for the checks (an effect must be paired). */
export const PAIRED_METHODS: readonly Method[] = ['paired-pooled', 'paired-staged', 'paired'];
