// The slices of the telemetry reports the site loads (2026-11-24, after REVIEW_2026-11-24 B.2 made the reports cover all
// 71 library lists): each page loads the part it shows, never the whole report. Every slice is cut from one stored file,
// never recomputed, so a number is defined once:
//   - from the decision report (reports/decisions-latest.json, the full report `sim analyze --decisions` writes):
//       public/data/decisions.json            the index: the report without its decks' bodies and without the bot's
//                                             calibration (the Card stats → Decisions view shows neither at first)
//       public/data/decisions/<listId>.json   one deck's body, fetched when the view shows that deck
//       public/data/sells.json                per card, the counts the sell share reads (src/lib/sellShare.ts), per list
//                                             and pooled, for the Deck Lab's "the bot sells this" tags
//   - from the site copy of the analysis (src/data/analysis.json, which the Node tools read):
//       src/data/analysis/summary.json        per deck the figures the Play page, the coach's tips, the deck record and
//                                             the Card stats list show (win rates, the tempo row after turn 4, matchups)
//       src/data/analysis/decks/<listId>.json one deck's whole report, loaded when a page shows that deck's insights
// scripts/build-telemetry-slices.ts writes them (also `sim analyze` and `npm run refresh`); check:data compares them with
// a rebuild. Pure: the scripts read and write the files.
import type { CardReport, DecisionReport, DeckDecisionReport } from '../analysis/decisions';
import type { DeckReport } from '../analysis/analyze';
import type { SellModes, SellReport } from './sellShare';

export const DECISIONS_FULL_FILE = 'reports/decisions-latest.json';
export const DECISIONS_INDEX_FILE = 'public/data/decisions.json';
export const DECISION_PARTS_DIR = 'public/data/decisions';
export const SELLS_FILE = 'public/data/sells.json';
export const ANALYSIS_SITE_FILE = 'src/data/analysis.json';
export const ANALYSIS_SUMMARY_FILE = 'src/data/analysis/summary.json';
export const ANALYSIS_PARTS_DIR = 'src/data/analysis/decks';

// ---------------------------------------------------------------- the decision report

/** A deck in the index: who it is and its totals; its body is public/data/decisions/<listId>.json. */
export type DeckDecisionStub = Pick<DeckDecisionReport, 'listId' | 'name' | 'games' | 'winRate' | 'decisions'>;
/** public/data/decisions.json: the report with stub decks and no calibration. */
export type DecisionIndex = Omit<DecisionReport, 'decks' | 'calibration'> & { decks: DeckDecisionStub[] };

/** The index of a decision report (its keys in the report's order, `decks` stubbed, `calibration` left out). */
export function decisionIndex(r: DecisionReport): DecisionIndex {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (k === 'calibration') continue;
    out[k] = k === 'decks' ? r.decks.map((d) => ({ listId: d.listId, name: d.name, games: d.games, winRate: d.winRate, decisions: d.decisions })) : v;
  }
  return out as DecisionIndex;
}

/** A stub deck of the index (no body): its body must be fetched. */
export const isDeckStub = (d: DeckDecisionStub | DeckDecisionReport): d is DeckDecisionStub => !('cards' in d);

/** public/data/sells.json: per card [sells, plays, reactions] (the modes' `all.uses`), per list and pooled. */
export interface SellSlice {
  kind: 'nct-sells';
  schema: 1;
  telemetrySchema: number;
  bot: string | null;
  simVersion: number | null;
  runId: string | null;
  createdAt: string | null;
  games: number;
  pooled: Record<string, SellCounts>;
  lists: Record<string, Record<string, SellCounts>>;
}
export type SellCounts = [sells: number, plays: number, reactions: number];

function countsOf(cards: readonly Pick<CardReport, 'id' | 'modes'>[]): Record<string, SellCounts> {
  const out: Record<string, SellCounts> = {};
  for (const c of cards) {
    const k: SellCounts = [0, 0, 0];
    for (const m of c.modes) {
      const n = Number.isFinite(m.all.uses) ? m.all.uses : 0;
      if (m.mode === 'sell') k[0] += n;
      else if (m.mode === 'play') k[1] += n;
      else if (m.mode === 'react') k[2] += n;
    }
    if (k[0] || k[1] || k[2]) out[c.id] = k;
  }
  return out;
}

/** The sell slice of a decision report. */
export function sellSlice(r: DecisionReport): SellSlice {
  const m = r.manifest;
  return {
    kind: 'nct-sells',
    schema: 1,
    telemetrySchema: r.telemetrySchema,
    bot: m?.bot?.level ?? null,
    simVersion: typeof m?.simVersion === 'number' ? m.simVersion : null,
    runId: m?.runId ?? null,
    createdAt: m?.createdAt ?? null,
    games: r.games,
    pooled: countsOf(r.pooled),
    lists: Object.fromEntries(r.decks.map((d) => [d.listId, countsOf(d.cards)])),
  };
}

const modesOf = (k: SellCounts): SellModes => [
  { mode: 'sell', all: { uses: k[0] } },
  { mode: 'play', all: { uses: k[1] } },
  { mode: 'react', all: { uses: k[2] } },
];
const rowsOf = (cards: Record<string, SellCounts>) => Object.entries(cards).map(([id, k]) => ({ id, name: id, modes: modesOf(k) }));

/** The slice as the sell share reads a report (src/lib/sellShare.ts): the same counts, so the same shares. Card names are ids. */
export function sellReportOf(s: SellSlice): SellReport {
  return {
    games: s.games,
    decks: Object.entries(s.lists).map(([listId, cards]) => ({ listId, cards: rowsOf(cards) })),
    pooled: rowsOf(s.pooled),
    manifest: { bot: { level: s.bot ?? '' }, simVersion: s.simVersion ?? undefined, runId: s.runId ?? undefined, createdAt: s.createdAt ?? undefined } as SellReport['manifest'],
  };
}

/** A fetched sells.json, or null when it is not a slice this code reads (`telemetrySchema`: the one the site reads). */
export function readSellSlice(j: unknown, telemetrySchema: number): SellSlice | null {
  const s = j as SellSlice | null;
  if (!s || typeof s !== 'object' || s.kind !== 'nct-sells' || s.schema !== 1 || s.telemetrySchema !== telemetrySchema) return null;
  if (typeof s.pooled !== 'object' || s.pooled === null || typeof s.lists !== 'object' || s.lists === null) return null;
  return s;
}

// ---------------------------------------------------------------- the analysis

/** One deck of the summary: the figures shown without its whole report. */
export interface AnalysisSummaryDeck {
  deck: string;
  id?: string;
  games: number;
  wr: number;
  wrFirst: number;
  wrSecond: number;
  /** the tempo row after the deck's 4th turn (the coach's tip), null when the report has none */
  tempo4: DeckReport['tempo'][number] | null;
  matchups: Pick<DeckReport['matchups'][number], 'opp' | 'games' | 'wr' | 'wrFirst' | 'wrSecond'>[];
}
/** src/data/analysis/summary.json. */
export interface AnalysisSummary {
  date: string;
  games: number;
  bot: string;
  manifest: { simVersion?: number; bot?: { level: string }; runId?: string; createdAt?: string } | null;
  decks: AnalysisSummaryDeck[];
}
/** The site copy of the analysis as read here. */
export interface AnalysisSite {
  date: string;
  games: number;
  bot: string;
  manifest?: { simVersion?: number; bot?: { level: string }; runId?: string; createdAt?: string } | null;
  decks: DeckReport[];
}

export function analysisSummary(a: AnalysisSite): AnalysisSummary {
  const m = a.manifest;
  return {
    date: a.date,
    games: a.games,
    bot: a.bot,
    manifest: m ? { simVersion: m.simVersion, bot: m.bot, runId: m.runId, createdAt: m.createdAt } : null,
    decks: a.decks.map((r) => ({
      deck: r.deck,
      ...(r.id ? { id: r.id } : {}),
      games: r.games,
      wr: r.wr,
      wrFirst: r.wrFirst,
      wrSecond: r.wrSecond,
      tempo4: r.tempo?.[3] ?? null,
      matchups: r.matchups.map((x) => ({ opp: x.opp, games: x.games, wr: x.wr, wrFirst: x.wrFirst, wrSecond: x.wrSecond })),
    })),
  };
}

// ---------------------------------------------------------------- the files

/**
 * Every slice file (path from the repository root → its text), cut from the two stored reports; a report that is
 * missing gives none of its slices. Deck parts are keyed by list fingerprint: a deck with none in the analysis is left
 * out of the parts (and found by nothing).
 */
export function telemetrySliceFiles(o: { decisions: DecisionReport | null; analysis: AnalysisSite | null }): Map<string, string> {
  const out = new Map<string, string>();
  if (o.decisions) {
    out.set(DECISIONS_INDEX_FILE, JSON.stringify(decisionIndex(o.decisions)));
    for (const d of o.decisions.decks) out.set(`${DECISION_PARTS_DIR}/${d.listId}.json`, JSON.stringify(d));
    out.set(SELLS_FILE, JSON.stringify(sellSlice(o.decisions)));
  }
  if (o.analysis) {
    out.set(ANALYSIS_SUMMARY_FILE, JSON.stringify(analysisSummary(o.analysis)));
    for (const r of o.analysis.decks) if (r.id) out.set(`${ANALYSIS_PARTS_DIR}/${r.id}.json`, JSON.stringify(r));
  }
  return out;
}
