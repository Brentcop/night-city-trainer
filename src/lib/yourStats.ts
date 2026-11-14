// Provisional ratings for your own lists: the lists in your tournaments (src/lib/runLedger.ts) that have no recorded
// rating, rated by src/lib/anchoredRating.ts against the recorded decks (src/data/ratings.json) held fixed. Pure: the
// recorded decks come in as (name, list fingerprint, rating, expected win rate) and the going-first edge as recorded.
//
// Only games played by the Hard bots on the current simulator count here: the recorded ratings are Hard-bot ratings, and
// other bots' games are not comparable, so they show in your record but never enter this rating.
import { fitAnchored, hFromEdge, type AnchoredRow } from './anchoredRating';
import { CURRENT_SIM_VERSION } from './playedRecord';
import type { RatedGame } from './ratingModel';
import { countedRuns, type Ledger } from './runLedger';
import { simTier, type SimTier } from './simTier';

/** The bot whose games the provisional rating reads (the recorded events' bot). */
export const RATED_BOT = 'hard';

export interface RecordedDeck {
  name: string;
  /** list fingerprint */
  list: string;
  /** recorded rating (logit scale) and expected win rate vs the field (ratings.json `rating`, `wrField`) */
  rating: number;
  wrField: number;
}

export interface Provisional extends AnchoredRow {
  /** list fingerprint */
  list: string;
  /** the tier by the Sim tier rule (src/lib/simTier.ts) from the provisional numbers; null when its games never reach a recorded deck */
  tier: SimTier | null;
  /** where its expected win rate would place it among the recorded decks: `place` of `of` (= recorded decks + 1) */
  place: number;
  of: number;
}

/** The Hard-bot games of the counted runs, as rated games between list fingerprints (two copies of one list: left out). */
export function ratedGamesByList(l: Ledger, simVersion = CURRENT_SIM_VERSION, bot = RATED_BOT): RatedGame[] {
  const out: RatedGame[] = [];
  for (const run of countedRuns(l, simVersion).counted) {
    if (run.bot !== bot) continue;
    for (const [a, b, first, s] of run.games) {
      const la = run.decks[a]?.list;
      const lb = run.decks[b]?.list;
      if (!la || !lb || la === lb) continue;
      out.push({ a: la, b: lb, first, s });
    }
  }
  return out;
}

/** Every unrated list's provisional rating from your Hard-bot games, by list fingerprint. */
export function provisionalRatings(l: Ledger, o: { recorded: readonly RecordedDeck[]; firstPlayerEdge: number; simVersion?: number }): Map<string, Provisional> {
  const anchors = new Map<string, RecordedDeck>();
  for (const d of o.recorded) if (!anchors.has(d.list)) anchors.set(d.list, d);
  const rows = fitAnchored({
    anchors: [...anchors.values()].map((d) => ({ key: d.list, rating: d.rating })),
    h: hFromEdge(o.firstPlayerEdge),
    games: ratedGamesByList(l, o.simVersion ?? CURRENT_SIM_VERSION),
  });
  const of = o.recorded.length + 1;
  const out = new Map<string, Provisional>();
  for (const r of rows) {
    const tier = r.connected ? simTier({ wrField: r.wr, wrFieldLo: r.lo, wrFieldHi: r.hi, games: r.games }) : null;
    const place = 1 + o.recorded.filter((d) => d.wrField > r.wr).length;
    out.set(r.key, { ...r, list: r.key, tier, place, of });
  }
  return out;
}
