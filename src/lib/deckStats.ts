// One place to look up every measured statistic for a deck (by file or name).
import seasons from '../data/seasons.json';
import review from '../data/review.json';
import analysis from '../data/analysis.json';
import type { DeckReport } from '../analysis/analyze';

export interface LeaderRow {
  name: string;
  file: string;
  origin: string;
  colors: string;
  arch: string;
  vsMeta: number;
  rating: number;
  metaG: number;
  percentile: number;
  finals?: number;
  seasons: Record<string, number>;
}

export interface DeckStats {
  leader?: LeaderRow & { rank: number; of: number };
  review?: { winRate: number; rank: number; of: number; matrix: Record<string, number>; games: number; date: string };
  report?: DeckReport;
}

const S = seasons as unknown as { leaderboard: LeaderRow[]; seasons: { season: number; bred: { name: string; method: string; parents: string[]; idea: string }[]; standings: { name: string; wr: number }[] }[] };
const R = review as unknown as { date: string; games: number; decks: { name: string; file: string; winRate: number }[]; matrix: Record<string, Record<string, number>> };
const A = analysis as unknown as { decks: DeckReport[] };

export function deckStats(nameOrFile: string): DeckStats {
  const out: DeckStats = {};
  const li = S.leaderboard.findIndex((r) => r.file === nameOrFile || r.name === nameOrFile);
  if (li >= 0) out.leader = { ...S.leaderboard[li], rank: li + 1, of: S.leaderboard.length };
  const name = out.leader?.name ?? R.decks.find((d) => d.file === nameOrFile)?.name ?? nameOrFile;
  const ri = R.decks.findIndex((d) => d.name === name);
  if (ri >= 0) out.review = { winRate: R.decks[ri].winRate, rank: ri + 1, of: R.decks.length, matrix: R.matrix[name] ?? {}, games: R.games, date: R.date };
  out.report = A.decks.find((d) => d.deck === name);
  return out;
}

/** Season breeding record for a deck name (method, parents, idea), if it was bred. */
export function bredInfo(name: string) {
  for (const s of S.seasons) {
    const b = s.bred.find((x) => x.name === name);
    if (b) return { season: s.season, ...b, standing: s.standings.findIndex((x) => x.name === name) + 1, of: s.standings.length };
  }
  return undefined;
}

export const pct = (x: number | undefined | null, digits = 0) => (typeof x === 'number' && Number.isFinite(x) ? `${(x * 100).toFixed(digits)}%` : '—');
