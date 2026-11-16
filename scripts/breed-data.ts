// Everything the deck breeder learns from past test runs, gathered in one place:
//   strength   — per-deck strength: power rating (tournament series), discounted by uncertainty, blended with the season
//                leaderboard only where its entry is current (src/lib/parentStrength.ts)
//   seasons    — the recorded season files, their simulator versions, and the Legend trios the gate kept out
//   deckImpact — per-list card impact ("Δ when drawn"), pooled from the review telemetry and every season round robin,
//                keyed by list fingerprint (data/seasons/deck-impact.json; src/lib/seasonDeckImpact.ts)
//   h2h        — head-to-head game records from every recorded tournament event
//   bosses     — the decks to beat (top of the strength list)
import fs from 'node:fs';
import path from 'node:path';
import type { DeckReport } from '../src/analysis/analyze';
import { parentStrength, seasonVersions, staleLeaderRow, type LeaderStrength, type RatedDeck } from '../src/lib/parentStrength';
import { SIM_VERSION } from '../src/lib/tournament';
import { IMPACT_MIN_DECK_GAMES } from '../src/analysis/impactData';
import { readEvents } from './lib-node';
import { poolEvents, selectEvents } from './event-pool';
import { h2hEstimator, type H2HRecord } from '../src/lib/h2hModel';
import { addCards, breederDeckImpact, emptyDeckImpact, parseDeckImpact, type DeckImpactFile } from '../src/lib/seasonDeckImpact';

export const DECK_IMPACT_FILE = 'data/seasons/deck-impact.json';

/** The pooled per-list impact file (keyed by list fingerprint), or an empty one; the old name-keyed file is refused. */
export function readDeckImpactFile(file = DECK_IMPACT_FILE): DeckImpactFile {
  if (!fs.existsSync(file)) return emptyDeckImpact();
  const r = parseDeckImpact(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (!r.file) throw new Error(`${file} ${r.problem}`);
  return r.file;
}

/**
 * Add season telemetry to the pooled per-list card impact. `fingerprintOf` gives the listFingerprint of the list each
 * report's deck played (the round robin's field); a report whose list it does not know is not recorded (returned).
 */
export function recordDeckImpact(reps: DeckReport[], fingerprintOf: (deckName: string) => string | undefined): string[] {
  const acc = readDeckImpactFile();
  const skipped: string[] = [];
  for (const r of reps) {
    const fp = fingerprintOf(r.deck);
    if (fp) addCards(acc, fp, r.deck, r.cards);
    else skipped.push(r.deck);
  }
  fs.writeFileSync(DECK_IMPACT_FILE, JSON.stringify(acc));
  return skipped;
}

/**
 * Per-list card impact (list fingerprint → card id → Δ when drawn), needing at least `min` games where the card was
 * drawn. The original review telemetry (src/data/analysis.json) counts too, matched by each report's fingerprint
 * (`id`); a report without one is left out.
 */
export function loadDeckImpact(min = IMPACT_MIN_DECK_GAMES): Record<string, Record<string, number>> {
  const acc = readDeckImpactFile();
  if (fs.existsSync('src/data/analysis.json'))
    for (const r of JSON.parse(fs.readFileSync('src/data/analysis.json', 'utf8')).decks as DeckReport[]) if (r.id) addCards(acc, r.id, r.deck, r.cards);
  return breederDeckImpact(acc, min);
}

export type H2H = (a: string, b: string) => H2HRecord;
/**
 * Head-to-head records from the pooled tournament events (ties count half; the default pool of scripts/event-pool.ts:
 * the newest event's sim version and bot), each with its estimate shrunk toward the power ratings (src/lib/h2hModel.ts),
 * which the breeder's counter ranking prefers. A pair that never met has g = 0 and the ratings' prediction.
 */
export function loadH2H(): H2H {
  const sel = selectEvents(readEvents());
  for (const w of sel.warnings) console.log(w);
  const games = poolEvents(sel.kept).games;
  if (!games.length) return () => ({ w: 0, g: 0 });
  return h2hEstimator(games).lookup;
}

/**
 * Deck strength for parent selection (src/lib/parentStrength.ts, the rule the Deck Lab uses too). Power ratings (every
 * deck vs every deck, Bradley–Terry) count at their conservative value, halfway down to the lower bound; a season
 * leaderboard entry (vs the meta) is blended in at 35%, or used alone for an unrated deck, only when it is current:
 * every season that added to it ran under the current simulator version. A stale entry is not used, so a deck with only
 * a stale entry has no strength (it is no parent candidate).
 */
export function strengthOf(leaderboard: readonly LeaderStrength[], ratingsFile = 'src/data/ratings.json'): Record<string, number> {
  const R = fs.existsSync(ratingsFile) ? JSON.parse(fs.readFileSync(ratingsFile, 'utf8')) : { decks: [] };
  return parentStrength(R.decks as RatedDeck[], leaderboard);
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

/** A leaderboard entry (data/seasons/leaderboard.json) as parent strength reads it. */
export function leaderStrength(e: { name: string; seasons?: Record<string, unknown> }, rating: number, versions: Readonly<Record<string, number | null>>, current = SIM_VERSION): LeaderStrength {
  return { name: e.name, rating, stale: staleLeaderRow(e, versions, current) };
}

/**
 * The Legend trios (sorted, joined by "|") of the bred decks that earlier seasons kept out at the gate (their season
 * file's gate.decks with entered false), so the breeder counts them as seen. `except`: a season to leave out (the one
 * being re-run).
 */
export function keptOutTriples(dir = SEASONS_DIR, except?: number): string[] {
  const out: string[] = [];
  for (const s of readSeasonFiles(dir)) {
    if (s.season === except) continue;
    const gate = s.data.gate as { decks?: { entered?: unknown; legends?: unknown }[] } | undefined;
    for (const d of gate?.decks ?? []) {
      if (d.entered !== false || !Array.isArray(d.legends)) continue;
      out.push([...(d.legends as string[])].map(String).sort().join('|'));
    }
  }
  return out;
}
