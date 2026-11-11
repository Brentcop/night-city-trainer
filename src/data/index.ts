// Typed views of the bundled data files (src/data/*.json, written by the scripts; see CLAUDE.md). Pages and libraries
// import a file's data from here instead of re-typing the raw JSON with a cast at each use.
//
// Chunking: a module that statically imports a JSON file puts that file in every chunk that imports the module. The
// small files that the Home page (entry chunk) needs anyway are views here. The large ones each have their own module
// (src/data/analysisData.ts, deckReportsData.ts, tournamentIndex.ts) so that importing this file never pulls them into
// the entry; their types live here.
import type { DeckReport } from '../analysis/analyze';
import type { RatingRow, RatingsFile } from '../lib/playedRecord';
import type { EventLite } from '../lib/deckRecord';
import ratingsJson from './ratings.json';
import seasonsJson from './seasons.json';
import reviewJson from './review.json';

/** A file's run manifest, where only the simulator version is read in the UI. */
export type Versioned = { manifest?: { simVersion?: number } };

// ---------------------------------------------------------------- ratings.json (scripts/ratings.ts)
export interface RatingsRow extends RatingRow {
  origin?: string;
  /** standard error of the rating */
  se: number;
}
export interface RatingsData extends RatingsFile {
  updated: string;
  events: number;
  games: number;
  firstPlayerEdge: number;
  decks: RatingsRow[];
}
export const RATINGS = ratingsJson as unknown as RatingsData;

// ---------------------------------------------------------------- seasons.json (scripts/season.ts)
export interface LeaderRow {
  name: string;
  file: string;
  kind?: string;
  origin: string;
  colors: string;
  arch: string;
  firstSeason?: number;
  vsMeta: number;
  rating: number;
  metaW?: number;
  metaG: number;
  percentile: number;
  finals?: number;
  idea?: string;
  seasons: Record<string, number>;
}
export interface BredRecord {
  name: string;
  method: string;
  parents: string[];
  idea: string;
}
export interface SeasonRecord {
  season: number;
  date: string;
  games: number;
  bot: string;
  bred: BredRecord[];
  standings: { name: string; file: string; kind: string; wr: number; isNew: boolean }[];
}
export interface SeasonsData extends Versioned {
  updated: string;
  leaderboard: LeaderRow[];
  seasons: SeasonRecord[];
}
export const SEASONS = seasonsJson as unknown as SeasonsData;

// ---------------------------------------------------------------- review.json (round robin, scripts/review.ts)
export interface ReviewData {
  date: string;
  games: number;
  bot: string;
  decks: { name: string; file: string; winRate: number; games: number }[];
  matrix: Record<string, Record<string, number>>;
  firstPlayerWinRate: number;
}
export const REVIEW = reviewJson as unknown as ReviewData;

// ---------------------------------------------------------------- large files (views in their own modules)
/** analysis.json (`npm run sim -- analyze`): telemetry reports per deck. View: src/data/analysisData.ts. */
export interface AnalysisData extends Versioned {
  date: string;
  games: number;
  bot: string;
  decks: DeckReport[];
}
/** tournaments.json: the index of recorded events. View: src/data/tournamentIndex.ts. */
export interface TournamentIndex {
  updated: string;
  events: EventLite[];
}
