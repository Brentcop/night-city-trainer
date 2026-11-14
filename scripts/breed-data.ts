// Everything the deck breeder learns from past test runs, gathered in one place:
//   strength   — per-deck strength: power rating (tournament series) blended with the season leaderboard, discounted by uncertainty
//   deckImpact — per-list card impact ("Δ when drawn"), pooled from the review telemetry and every season round robin,
//                keyed by list fingerprint (data/seasons/deck-impact.json; src/lib/seasonDeckImpact.ts)
//   h2h        — head-to-head game records from every recorded tournament event
//   bosses     — the decks to beat (top of the strength list)
import fs from 'node:fs';
import type { DeckReport } from '../src/analysis/analyze';
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
 * Deck strength for parent selection. Power ratings (every deck vs every deck, Bradley–Terry) are the best signal when
 * a deck has enough tournament games; the season leaderboard (vs the meta) fills in the rest. Uncertain decks are
 * pulled toward 50% so a lucky small sample doesn't breed the next generation.
 */
export function strengthOf(leaderboard: Record<string, number>): Record<string, number> {
  const R = fs.existsSync('src/data/ratings.json') ? JSON.parse(fs.readFileSync('src/data/ratings.json', 'utf8')) : { decks: [] };
  const out: Record<string, number> = { ...leaderboard };
  for (const d of R.decks as { name: string; wrField: number; wrFieldLo: number; wrFieldHi: number; games: number }[]) {
    if (!(d.games >= 20) || !Number.isFinite(d.wrField)) continue;
    const half = Math.max(0, (d.wrFieldHi - d.wrFieldLo) / 2);
    const rated = d.wrField - 0.5 * half; // conservative: half-way to the lower bound
    out[d.name] = d.name in leaderboard ? 0.65 * rated + 0.35 * leaderboard[d.name] : rated;
  }
  return out;
}
