// Everything the deck breeder learns from past test runs, gathered in one place:
//   strength   — per-deck strength: the power rating's estimate, for decks with 100 or more games on their current list
//                (src/lib/parentStrength.ts; no leaderboard blend since 2026-11-24)
//   seasons    — the recorded season files, their simulator versions, and the Legend trios the gate kept out or a season
//                retired under the current simulator version
//   impact     — card impact ("Δ when drawn"), pooled by card (data/seasons/impact.json; src/lib/seasonImpact.ts) and per
//                list, keyed by list fingerprint (data/seasons/deck-impact.json; src/lib/seasonDeckImpact.ts): both kept
//                by simulator version and bot; the breeder reads one pair's numbers, the current simulator version and
//                the season's bot when it has any, else the closest pair with a warning (src/lib/breederImpact.ts); the
//                review telemetry counts as the pair its manifest names
//   h2h       — head-to-head game records from every recorded tournament event
//   bosses     — the decks to beat (top of the strength list)
import fs from 'node:fs';
import path from 'node:path';
import { parentStrength, ratingsVersionWarning, seasonVersions, tooFewGames, tooFewGamesWords, type RatedDeck } from '../src/lib/parentStrength';
import { SIM_VERSION } from '../src/lib/tournament';
import { loadLibrary, readPooled } from './lib-node';
import { currentListGate, poolEvents, selectEvents } from './event-pool';
import { h2hEstimator, type H2HRecord } from '../src/lib/h2hModel';
import { addToDeckImpact, emptyDeckImpact, parseDeckImpact, type DeckImpactFile } from '../src/lib/seasonDeckImpact';
import { addToCardImpact, emptyCardImpact, impactKey, parseCardImpact, type CardImpactFile, type ImpactCardStat, type ImpactKey } from '../src/lib/seasonImpact';
import { readImpactTables, seasonCountIn, type AnalysisLike, type ImpactTables, type SeasonCount } from '../src/lib/breederImpact';

export const CARD_IMPACT_FILE = 'data/seasons/impact.json';
export const DECK_IMPACT_FILE = 'data/seasons/deck-impact.json';
export const ANALYSIS_FILE = 'src/data/analysis.json';
/** The bot seasons are played with since Season 3 (scripts/season.ts --bot), and so the table the breeder reads by default. */
export const SEASON_BOT = 'hard';

/** The pooled card-impact file (entries by simulator version and bot), or an empty one; an old shape is refused. */
export function readCardImpactFile(file = CARD_IMPACT_FILE): CardImpactFile {
  if (!fs.existsSync(file)) return emptyCardImpact();
  const r = parseCardImpact(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (!r.file) throw new Error(`${file} ${r.problem}`);
  return r.file;
}

/** The per-list impact file (entries by simulator version and bot, lists by fingerprint), or an empty one; an old shape is refused. */
export function readDeckImpactFile(file = DECK_IMPACT_FILE): DeckImpactFile {
  if (!fs.existsSync(file)) return emptyDeckImpact();
  const r = parseDeckImpact(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (!r.file) throw new Error(`${file} ${r.problem}`);
  return r.file;
}

/**
 * Add a season round robin's telemetry to both impact files, in the entry of the simulator version and bot that played
 * it, with the season as the source. `fingerprintOf` gives the listFingerprint of the list each report's deck played
 * (the round robin's field); a report whose list it does not know is not recorded in the per-list file (returned).
 * Both files are read and added to before either is written, and a season already counted is refused.
 */
export function recordSeasonImpact(
  reps: readonly { deck: string; cards: readonly ImpactCardStat[] }[],
  run: { season: number; runId?: string; simVersion?: number; bot: string },
  fingerprintOf: (deckName: string) => string | undefined,
): string[] {
  const key = impactKey(run.simVersion ?? SIM_VERSION, run.bot);
  const source = { kind: 'season' as const, season: run.season, ...(run.runId ? { runId: run.runId } : {}) };
  const card = readCardImpactFile();
  const deck = readDeckImpactFile();
  addToCardImpact(card, key, source, reps);
  const skipped = addToDeckImpact(deck, key, source, reps, fingerprintOf);
  // both written in full to temporary names first, then renamed one after the other: a stop can leave the two out of
  // step only between the two renames (seasonImpactCount then refuses the next run at its start)
  const tmpCard = `${CARD_IMPACT_FILE}.tmp`;
  const tmpDeck = `${DECK_IMPACT_FILE}.tmp`;
  fs.writeFileSync(tmpCard, JSON.stringify(card));
  fs.writeFileSync(tmpDeck, JSON.stringify(deck));
  fs.renameSync(tmpCard, CARD_IMPACT_FILE);
  fs.renameSync(tmpDeck, DECK_IMPACT_FILE);
  return skipped;
}

/** Whether `season` is already counted in the impact files (both, one only, or neither): checked before a season plays. */
export const seasonImpactCount = (season: number): SeasonCount => seasonCountIn(readCardImpactFile(), readDeckImpactFile(), season);

/**
 * What the breeder reads (src/lib/breederImpact.ts readImpactTables): the pooled and per-list card impact of one pair,
 * the current simulator version and `bot` when they have numbers, else the closest pair (with a warning), never a sum of
 * two; src/data/analysis.json counts as the pair its manifest names. The one reader of the season (also --gate-only),
 * the preview and scripts/theorize-ladder.ts; `impactTablesWords` says what it read.
 */
export function loadImpactTables(bot: string = SEASON_BOT, o: { simVersion?: number; cardFile?: string; deckFile?: string; analysisFile?: string | null } = {}): ImpactTables {
  const key: ImpactKey = { simVersion: o.simVersion ?? SIM_VERSION, bot };
  const af = o.analysisFile === undefined ? ANALYSIS_FILE : o.analysisFile;
  const analysis = af && fs.existsSync(af) ? (JSON.parse(fs.readFileSync(af, 'utf8')) as AnalysisLike) : null;
  return readImpactTables({ cardFile: readCardImpactFile(o.cardFile), deckFile: readDeckImpactFile(o.deckFile), analysis, key });
}

export type H2H = (a: string, b: string) => H2HRecord;
/**
 * Head-to-head records from the pooled tournament events and rating runs (ties count half; the default pool of
 * scripts/event-pool.ts: the newest sim version and bot, games on the library's current lists only), each with its estimate shrunk toward the power ratings (src/lib/h2hModel.ts),
 * which the breeder's counter ranking prefers. A pair that never met has g = 0 and the ratings' prediction.
 */
export function loadH2H(): H2H {
  const sel = selectEvents(readPooled());
  for (const w of sel.warnings) console.log(w);
  const games = poolEvents(sel.kept, currentListGate(loadLibrary())).games;
  if (!games.length) return () => ({ w: 0, g: 0 });
  return h2hEstimator(games).lookup;
}

/** The ratings rows (src/data/ratings.json decks[]), or none when the file is missing. */
export function readRatedDecks(ratingsFile = 'src/data/ratings.json'): { decks: RatedDeck[]; manifest?: { simVersion?: unknown } } | null {
  return fs.existsSync(ratingsFile) ? (JSON.parse(fs.readFileSync(ratingsFile, 'utf8')) as { decks: RatedDeck[]; manifest?: { simVersion?: unknown } }) : null;
}

/**
 * Deck strength for parent selection (src/lib/parentStrength.ts, the rule the Deck Lab uses too): each deck's power
 * rating (every deck vs every deck, Bradley–Terry) at its point estimate, for decks with 100 or more games on their
 * current list (since 2026-11-24: no leaderboard blend, no lower-bound discount). Prints the warning for ratings fitted on
 * another simulator version and the decks left out for too few games.
 */
export function strengthOf(ratingsFile = 'src/data/ratings.json'): Record<string, number> {
  const R = readRatedDecks(ratingsFile);
  // ratings fitted on another simulator version still rank the parents, but say so (REVIEW_2026-11-24 A.11)
  const stale = R ? ratingsVersionWarning(R, ratingsFile) : null;
  if (stale) console.warn(stale);
  const few = tooFewGamesWords(tooFewGames(R?.decks ?? []));
  if (few) console.log(few);
  return parentStrength(R?.decks ?? []);
}

export const SEASONS_DIR = 'data/seasons';
const SEASON_FILE_RE = /^season-(\d+)\.json$/;

/** The recorded season files (data/seasons/season-N.json), parsed, by season number; unreadable files are skipped. */
export function readSeasonFiles(dir = SEASONS_DIR): { season: number; data: Record<string, unknown> }[] {
  if (!fs.existsSync(dir)) return [];
  const out: { season: number; data: Record<string, unknown> }[] = [];
  for (const f of fs.readdirSync(dir)) {
    const m = SEASON_FILE_RE.exec(f);
    if (!m) continue;
    try {
      out.push({ season: +m[1]!, data: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Record<string, unknown> });
    } catch {
      /* not a season record */
    }
  }
  return out.sort((a, b) => a.season - b.season);
}

/** Each recorded season's simulator version (from its manifest; null when it has none). */
export const seasonVersionsOnDisk = (dir = SEASONS_DIR): Record<string, number | null> =>
  seasonVersions(readSeasonFiles(dir).map((s) => ({ season: s.season, manifest: s.data.manifest as { simVersion?: unknown } | undefined })));

/** The simulator version a season file was played under: its gate record's, else its manifest's (null: none recorded). */
export function seasonFileVersion(data: Record<string, unknown>): number | null {
  const g = (data.gate as { simVersion?: unknown } | undefined)?.simVersion;
  if (typeof g === 'number' && Number.isFinite(g)) return g;
  const m = (data.manifest as { simVersion?: unknown } | undefined)?.simVersion;
  return typeof m === 'number' && Number.isFinite(m) ? m : null;
}

/**
 * The Legend trios (sorted, joined by "|") that earlier seasons of the current simulator version closed: the bred decks
 * their gate kept out (gate.decks with entered false) and the decks they retired (`retired`, scripts/season.ts
 * --retire-below-meta-median), so the breeder counts them as seen. Since 2026-11-24 a trio closed under another
 * simulator version (or a season file with no version) is open again: one 40-card fill's result on one version is no
 * reason to ban a trio for good (docs/REVIEW_2026-11-24.md R7). `except`: a season to leave out (the one being re-run).
 */
export function keptOutTriples(dir = SEASONS_DIR, except?: number, current: number = SIM_VERSION): string[] {
  const out: string[] = [];
  for (const s of readSeasonFiles(dir)) {
    if (s.season === except || seasonFileVersion(s.data) !== current) continue;
    const gate = s.data.gate as { decks?: { entered?: unknown; legends?: unknown }[] } | undefined;
    for (const d of gate?.decks ?? []) {
      if (d.entered !== false || !Array.isArray(d.legends)) continue;
      out.push([...(d.legends as string[])].map(String).sort().join('|'));
    }
    const retired = s.data.retired as { legends?: unknown }[] | undefined;
    for (const d of Array.isArray(retired) ? retired : []) if (Array.isArray(d.legends)) out.push([...(d.legends as string[])].map(String).sort().join('|'));
  }
  return out;
}

/** How many trios earlier seasons closed under another simulator version (or none recorded), now open again. */
export function expiredTriples(dir = SEASONS_DIR, except?: number, current: number = SIM_VERSION): number {
  let n = 0;
  for (const s of readSeasonFiles(dir)) {
    if (s.season === except || seasonFileVersion(s.data) === current) continue;
    const gate = s.data.gate as { decks?: { entered?: unknown }[] } | undefined;
    n += (gate?.decks ?? []).filter((d) => d.entered === false).length + (Array.isArray(s.data.retired) ? (s.data.retired as unknown[]).length : 0);
  }
  return n;
}
