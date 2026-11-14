// Card and package facts by code (docs/RAG_PLAN.md rules M3 to M5, step 2.4): one documented function per number a
// person asks about how the bot used a card or how a synergy package did, read from the measured reports and returned
// as plain data with what it was measured on (sim version, bot, the report's date and games, all from the report's own
// run manifest). Pure, Node and browser: every report is passed in, nothing is read, no clock, no locale.
//
// Everything here is ASSOCIATION, as in the reports themselves (src/analysis/decisions.ts, synergies.ts, analyze.ts):
// the win rate of the games where a card was used, drawn or a package came online is not what the card or package is
// worth, and nothing here is advice. A slice backed by fewer games than the report's minimum (MIN_SLICE_GAMES, 20)
// gets no rate: `thin` is true and the rate and its interval are null.
//
// The definitions, and the word each uses where the project has more than one (docs/RAG_PLAN.md §9):
//   - "Stage" is the decision report's (`stageOf` in src/analysis/decisions.ts): by round, round = ceil(global turn / 2),
//     so early is turns 1–4 of the game, middle turns 5–8, late turn 9 on. Not src/ai/benchmark.ts's stage.
//   - "Played" in the decision report is a main-phase play from hand; in the per-deck analysis (src/analysis/analyze.ts,
//     from game traces) it is any play, from any zone or window, an ordinary Legend play included. "Drawn" there means in
//     the kept opening hand, drawn, or played from hand (a card searched to hand is not counted).
//   - "Turn" in the analysis' mean turn played is the list's own turn (1 = its first turn); a decision's stage reads the
//     game's turn. "Games" in a pooled slice are player-games of different lists mixed together.
//   - analysis.json's top-level `games` is games per pairing, not the run's games: the run's games come from the
//     manifest (`sample.completedGames`).
import { IWD_CAVEAT, type CardStat, type DeckReport } from '../analysis/analyze';
import { MIN_SLICE_GAMES, wilson, type CardReport, type DecisionReport, type ModeReport, type Slice, type Stage, type Standing, type UseMode } from '../analysis/decisions';
import { IMPACT_MIN_DECK_GAMES, IMPACT_MIN_POOLED_GAMES, type ImpactData } from '../analysis/impactData';
import type { RateWithInterval, SynergyReport, SynergyRow } from '../analysis/synergies';
import { liftGate, newcombeDiff, seatLift } from '../ai/packageLift';
import { CURRENT_SIM_VERSION } from './playedRecord';
import type { RunManifest } from './runManifest';

export { IWD_CAVEAT } from '../analysis/analyze';

// ---------------------------------------------------------------- inputs

/** src/data/analysis.json: the parts read here. JSON turns NaN into null, so every number may be null. */
export interface AnalysisInput {
  date?: string;
  bot?: string;
  manifest?: RunManifest;
  decks: readonly DeckReport[];
}

/** What a measured number rests on, read from the report's own manifest (never assumed). */
export interface StatBasis {
  /** the report's path from the repository root */
  file: string;
  simVersion: number | null;
  /** the manifest's bot level, e.g. "deep" */
  bot: string | null;
  /** the run's recorded date (manifest `createdAt`, ISO as stored), never the clock */
  asOf: string | null;
  runId: string | null;
  /** games the whole run played (manifest `sample.completedGames`), null when the report has no manifest */
  games: number | null;
  /** measured under an older sim version than the current one, or an unversioned one (decision D5) */
  stale: boolean;
}

/** The basis of a report: its file, and the sim version, bot, date and games its manifest records. */
export function reportBasis(file: string, report: { manifest?: RunManifest } | null | undefined, current = CURRENT_SIM_VERSION): StatBasis {
  const m = report?.manifest;
  const simVersion = typeof m?.simVersion === 'number' ? m.simVersion : null;
  return {
    file,
    simVersion,
    bot: m?.bot?.level ?? null,
    asOf: m?.createdAt ?? null,
    runId: m?.runId ?? null,
    games: typeof m?.sample?.completedGames === 'number' ? m.sample.completedGames : null,
    stale: simVersion === null || simVersion < current,
  };
}

/** A win rate over games with its 95% Wilson interval; under the minimum it is `thin` and carries the games only. */
export interface WinRate {
  games: number;
  rate: number | null;
  low95: number | null;
  high95: number | null;
  thin: boolean;
}

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** A win rate from a report's slice (the report's own rate and interval), thin under `min` games. */
export function fromSlice(s: Pick<Slice, 'games' | 'winRate' | 'low95' | 'high95' | 'thin'>, min = MIN_SLICE_GAMES): WinRate {
  if (s.thin || s.games < min || !finite(s.winRate) || !finite(s.low95) || !finite(s.high95)) return { games: s.games, rate: null, low95: null, high95: null, thin: true };
  return { games: s.games, rate: s.winRate, low95: s.low95, high95: s.high95, thin: false };
}

/** A win rate from a score (wins, ties half) out of `games`, with the decision report's Wilson interval. */
export function winRateOf(score: number, games: number, min = MIN_SLICE_GAMES): WinRate {
  if (games < min || games <= 0 || !finite(score)) return { games, rate: null, low95: null, high95: null, thin: true };
  const w = wilson(score, games);
  return { games, rate: score / games, low95: w.low, high95: w.high, thin: false };
}

/** A share (n of `of`) with its interval: the synergy report's rate, thin under `min` in the denominator. */
export interface Share {
  n: number;
  of: number;
  rate: number | null;
  low95: number | null;
  high95: number | null;
  thin: boolean;
}

export function fromRate(r: RateWithInterval, min = MIN_SLICE_GAMES): Share {
  if (r.of < min || !finite(r.rate) || !finite(r.low95) || !finite(r.high95)) return { n: r.n, of: r.of, rate: null, low95: null, high95: null, thin: true };
  return { n: r.n, of: r.of, rate: r.rate, low95: r.low95, high95: r.high95, thin: false };
}

/** A difference of two win rates (first minus second) with Newcombe's 95% interval, when neither is thin. */
export interface Gap {
  gap: number;
  low95: number;
  high95: number;
}

export function gapOf(a: WinRate, b: WinRate): Gap | null {
  if (a.thin || b.thin || a.rate === null || b.rate === null || a.low95 === null || a.high95 === null || b.low95 === null || b.high95 === null) return null;
  return { gap: a.rate - b.rate, ...newcombeDiff(a.rate, a.low95, a.high95, b.rate, b.low95, b.high95) };
}

// ---------------------------------------------------------------- how a card was used (decision telemetry)

/** The decision report's stage and Gig-standing slices, and the report's own words for the stages. */
export const STAGE_KEYS: readonly Stage[] = ['early', 'middle', 'late'];
export const STANDING_KEYS: readonly Standing[] = ['ahead', 'even', 'behind'];

export interface UseModeFact {
  mode: UseMode;
  /** times used this way, in `games` games */
  uses: number;
  /** the win rate of the games with at least one such use */
  won: WinRate;
  /** decisions in which this use was a legal option, and in which it was chosen */
  offered: number;
  chosen: number;
  /** turns (attacks, for a reaction) in which it was legal, and in which it was used at least once */
  windows: number;
  windowsUsed: number;
  stage: Record<Stage, { uses: number; won: WinRate }>;
  standing: Record<Standing, { uses: number; won: WinRate }>;
  /** Go Solo / Legend play: uses the Legend helped pay for */
  selfPaid: number;
  /** attack: Gigs stolen in all */
  stolen: number | null;
}

export interface CardUseFact {
  basis: StatBasis;
  /** 'list': one list (`listId`); 'pooled': every list in the report that used the card, player-games mixed */
  scope: 'list' | 'pooled';
  listId: string | null;
  /** the list's name in the report, and its games and win rate (list scope) */
  deck: string | null;
  deckGames: number | null;
  card: { id: string; name: string };
  /** lists in the report with a row for this card (pooled scope: all of them; list scope: just this one) */
  lists: number;
  /** lists in the report */
  listsInReport: number;
  minSliceGames: number;
  /** the report's own words for the stages ("turns 1–4" …), from `stageOf` in src/analysis/decisions.ts */
  stages: Record<Stage, string>;
  modes: UseModeFact[];
}

function modeFact(m: ModeReport, min: number): UseModeFact {
  const part = <K extends string>(keys: readonly K[], src: Record<K, Slice>) => Object.fromEntries(keys.map((k) => [k, { uses: src[k].uses, won: fromSlice(src[k], min) }])) as Record<K, { uses: number; won: WinRate }>;
  return {
    mode: m.mode,
    uses: m.all.uses,
    won: fromSlice(m.all, min),
    offered: m.offered,
    chosen: m.chosen,
    windows: m.windows,
    windowsUsed: m.windowsUsed,
    stage: part(STAGE_KEYS, m.stage),
    standing: part(STANDING_KEYS, m.standing),
    selfPaid: m.selfPaid ?? 0,
    stolen: finite(m.stolen) ? m.stolen : null,
  };
}

/** The lists (fingerprints) whose rows in the decision report hold this card, in the report's order. */
export function cardUseLists(report: DecisionReport, cardId: string): string[] {
  return report.decks.filter((d) => d.cards.some((c) => c.id === cardId)).map((d) => d.listId);
}

/**
 * How the bot used a card, from the decision report: on one list (`listId`, a list fingerprint) or pooled over every
 * list in the report (the report's own `pooled` rows). For each use mode: uses, games, the win rate of those games
 * with its interval, how often it was chosen out of how often it was legal, and the same by stage and Gig standing.
 * Null when the report has no row for the card (on that list).
 */
export function cardUse(report: DecisionReport, file: string, cardId: string, o: { listId?: string } = {}): CardUseFact | null {
  const min = report.minSliceGames ?? MIN_SLICE_GAMES;
  let row: CardReport | undefined;
  let deck: DecisionReport['decks'][number] | undefined;
  if (o.listId !== undefined) {
    deck = report.decks.find((d) => d.listId === o.listId);
    row = deck?.cards.find((c) => c.id === cardId);
  } else row = report.pooled.find((c) => c.id === cardId);
  if (!row) return null;
  return {
    basis: reportBasis(file, report),
    scope: deck ? 'list' : 'pooled',
    listId: deck?.listId ?? null,
    deck: deck?.name ?? null,
    deckGames: deck?.games ?? null,
    card: { id: row.id, name: row.name },
    lists: deck ? 1 : cardUseLists(report, cardId).length,
    listsInReport: report.decks.length,
    minSliceGames: min,
    stages: report.stages,
    modes: row.modes.map((m) => modeFact(m, min)),
  };
}

// ---------------------------------------------------------------- what the per-deck analysis says (game traces)

export interface CardAnalysisFact {
  basis: StatBasis;
  listId: string | null;
  deck: string;
  /** the list's games in the run */
  deckGames: number;
  card: { id: string; name: string };
  /** drawn (kept opening hand, drawn, or played from hand) and the win rate of those games; and of the games without */
  drawnGames: number;
  wonDrawn: WinRate;
  wonNotDrawn: WinRate;
  /** won when drawn minus won when not drawn ("IWD"), with Newcombe's interval; null when either side is thin */
  gap: Gap | null;
  /** the stored gap (analysis.json `iwd`); null when the analysis gave none (under 8 games without the card) */
  storedGap: number | null;
  /** played any way (from any zone or window, Legend plays included) and the win rate of those games */
  playedGames: number;
  wonPlayed: WinRate;
  /** the mean of the list's own turn (1 = its first) on which it was first played, over the games it was played */
  meanTurnPlayed: number | null;
  /** games, of the drawn ones, in which it was sold at least once */
  soldGames: number;
  /** games it was in the kept opening hand */
  openingGames: number;
  /** Gigs stolen by its attacks per game it was played */
  stealsPerPlayedGame: number | null;
  /** the association caveat the analysis code exports (IWD_CAVEAT) */
  caveat: string;
}

/** The list fingerprints whose analysis rows hold this card (Legends have none: the analysis skips them). */
export function cardAnalysisLists(analysis: AnalysisInput, cardId: string): string[] {
  return analysis.decks.filter((d) => d.id && d.cards.some((c) => c.id === cardId)).map((d) => d.id!);
}

/**
 * What the per-deck analysis says about a card on one list: the win-rate gap when drawn with the games it was drawn
 * in, how often it was sold, the mean turn it was played. Association with the caveat the analysis exports. Rates are
 * rebuilt from the stored win rates and game counts (ties count half) with the decision report's Wilson interval.
 */
export function cardAnalysis(analysis: AnalysisInput, file: string, cardId: string, listId: string, min = MIN_SLICE_GAMES): CardAnalysisFact | null {
  const d = analysis.decks.find((x) => x.id === listId);
  const c: CardStat | undefined = d?.cards.find((x) => x.id === cardId);
  if (!d || !c) return null;
  const notDrawn = d.games - c.seenGames;
  const wonDrawn = winRateOf((c.wrSeen ?? NaN) * c.seenGames, c.seenGames, min);
  const wonNotDrawn = winRateOf((c.wrNotSeen ?? NaN) * notDrawn, notDrawn, min);
  return {
    basis: reportBasis(file, analysis),
    listId: d.id ?? null,
    deck: d.deck,
    deckGames: d.games,
    card: { id: c.id, name: c.name },
    drawnGames: c.seenGames,
    wonDrawn,
    wonNotDrawn,
    gap: gapOf(wonDrawn, wonNotDrawn),
    storedGap: finite(c.iwd) ? c.iwd : null,
    playedGames: c.playedGames,
    wonPlayed: winRateOf((c.wrPlayed ?? NaN) * c.playedGames, c.playedGames, min),
    meanTurnPlayed: finite(c.avgPlayTurn) ? c.avgPlayTurn : null,
    soldGames: Math.round((c.soldRate ?? 0) * c.seenGames),
    openingGames: c.openingGames,
    stealsPerPlayedGame: c.playedGames && finite(c.steals) ? c.steals : null,
    caveat: IWD_CAVEAT,
  };
}

/**
 * The format-wide gap the coach's impact table pools for a card (src/ai/impact.ts): the drawn-games-weighted mean of
 * the per-list gaps in src/data/impact.json, used by the coach only from IMPACT_MIN_POOLED_GAMES drawn-games on. A
 * weighted mean of gaps: it has no interval of its own.
 */
export interface PooledImpactFact {
  lists: number;
  drawnGames: number;
  gap: number | null;
  /** whether the coach's table uses it (drawn-games at least IMPACT_MIN_POOLED_GAMES) */
  coachUses: boolean;
  minPooledGames: number;
  /** per-list floor: a list's own gap is used only from this many drawn games */
  minDeckGames: number;
}

export function pooledImpact(impact: ImpactData, cardId: string): PooledImpactFact | null {
  let s = 0;
  let n = 0;
  let lists = 0;
  for (const d of impact.decks)
    for (const [id, iwd, seen] of d.cards) {
      if (id !== cardId || !finite(iwd)) continue;
      s += iwd * seen;
      n += seen;
      lists++;
    }
  if (!lists) return null;
  return { lists, drawnGames: n, gap: n ? s / n : null, coachUses: n >= IMPACT_MIN_POOLED_GAMES, minPooledGames: IMPACT_MIN_POOLED_GAMES, minDeckGames: IMPACT_MIN_DECK_GAMES };
}

// ---------------------------------------------------------------- how a synergy package did (synergy report)

export interface PackageMemberFact {
  id: string;
  name: string;
  role: string;
  /** won when used with a partner piece held, and with none */
  withPartner: WinRate;
  withoutPartner: WinRate;
}

export interface PackageFact {
  basis: StatBasis;
  scope: 'list' | 'pooled';
  listId: string | null;
  deck: string | null;
  package: { id: string; name: string };
  /** player-games with the package in the list */
  games: number;
  builtAround: boolean | null;
  copies: Record<string, number> | null;
  /** games with the needed pieces held at some point, and the win rate of those games */
  assembled: Share;
  wonAssembled: WinRate;
  /** games in which its board condition held at some point */
  online: Share;
  wonOnline: WinRate;
  wonNever: WinRate;
  /** won when online minus won when never, with Newcombe's interval (src/ai/packageLift.ts) */
  lift: Gap | null;
  medianRound: number | null;
  meanTurnsOnline: number | null;
  /** by the list's own turn N: games that reached it, pieces held and online by then, and the draw odds of holding them */
  byRound: { round: number; reached: number; assembled: number; online: number; odds: number | null }[];
  /**
   * What the coach's lift gate (`liftGate` over `seatLift`, src/ai/packageLift.ts) would say for this package on this
   * list (pooled: on a list with no measured row of its own): 'measured' (interval above 0), 'hidden', or 'unmeasured'
   * (no report of the current catalogue). `gateBasis`: which figure the gate read.
   */
  gate: 'measured' | 'hidden' | 'unmeasured';
  gateBasis: 'list' | 'pooled' | null;
  /** the report was made with the current package catalogue */
  currentCatalogue: boolean;
  members: PackageMemberFact[];
}

/** The lists (fingerprints) whose synergy rows hold this package, in the report's order. */
export function packageLists(report: SynergyReport, pkgId: string): string[] {
  return report.decks.filter((d) => d.synergies.some((s) => s.id === pkgId)).map((d) => d.listId);
}

/**
 * How a synergy package did, from the synergy report: on one list (`listId`) or pooled over every list that holds it.
 * Assembled and online shares with their intervals, the win rates online and never with theirs, the lift with its
 * interval, and whether the coach's gate would call it measured. `catalogueVersion` is the current catalogue's
 * (CATALOGUE_VERSION in src/content/synergies): a report made with another counts as no report for the gate.
 */
export function packageFact(report: SynergyReport, file: string, pkgId: string, o: { listId?: string; catalogueVersion: string }): PackageFact | null {
  const min = report.minSliceGames ?? MIN_SLICE_GAMES;
  let row: SynergyRow | undefined;
  let deck: SynergyReport['decks'][number] | undefined;
  if (o.listId !== undefined) {
    deck = report.decks.find((d) => d.listId === o.listId);
    row = deck?.synergies.find((s) => s.id === pkgId);
  } else row = report.pooled.find((s) => s.id === pkgId);
  if (!row) return null;
  const current = report.catalogueVersion === o.catalogueVersion;
  const lifts = seatLift(report, deck?.listId, current);
  const wonOnline = fromSlice(row.online, min);
  const wonNever = fromSlice(row.never, min);
  return {
    basis: reportBasis(file, report),
    scope: deck ? 'list' : 'pooled',
    listId: deck?.listId ?? null,
    deck: deck?.name ?? null,
    package: { id: row.id, name: row.name },
    games: row.games,
    builtAround: deck ? !!row.builtAround : null,
    copies: row.copies ? { ...row.copies } : null,
    assembled: fromRate(row.assembledRate, min),
    wonAssembled: fromSlice(row.assembled, min),
    online: fromRate(row.onlineRate, min),
    wonOnline,
    wonNever,
    lift: gapOf(wonOnline, wonNever),
    medianRound: finite(row.medianRound) ? row.medianRound : null,
    meanTurnsOnline: finite(row.meanTurnsOnline) ? row.meanTurnsOnline : null,
    byRound: row.byRound.map((b) => ({ round: b.round, reached: b.reached, assembled: b.assembled.n, online: b.online.n, odds: finite(b.expected) ? b.expected : null })),
    gate: liftGate(lifts ?? undefined, pkgId),
    gateBasis: lifts?.[pkgId]?.basis ?? null,
    currentCatalogue: current,
    members: row.cards.map((c) => ({ id: c.id, name: c.name, role: c.role, withPartner: fromSlice(c.present, min), withoutPartner: fromSlice(c.absent, min) })),
  };
}
