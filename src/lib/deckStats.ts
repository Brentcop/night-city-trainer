// One place to look up a deck's season and round-robin statistics (by file or name). Small enough for the Home page's
// entry chunk; the telemetry report (analysis.json, ~330 KB) is separate: telemetryReport() in src/data/analysisData.ts.
import { REVIEW, SEASONS, type LeaderRow } from '../data/index';

export type { LeaderRow } from '../data/index';

export interface DeckStats {
  leader?: LeaderRow & { rank: number; of: number };
  review?: { winRate: number; rank: number; of: number; matrix: Record<string, number>; games: number; date: string };
}

const S = SEASONS;
const R = REVIEW;

/** The deck name the statistics are filed under: the leaderboard's or round robin's name for a file, else the argument. */
export function statsName(nameOrFile: string): string {
  return S.leaderboard.find((r) => r.file === nameOrFile || r.name === nameOrFile)?.name ?? R.decks.find((d) => d.file === nameOrFile)?.name ?? nameOrFile;
}

export function deckStats(nameOrFile: string): DeckStats {
  const out: DeckStats = {};
  const li = S.leaderboard.findIndex((r) => r.file === nameOrFile || r.name === nameOrFile);
  const leader = S.leaderboard[li];
  if (leader) out.leader = { ...leader, rank: li + 1, of: S.leaderboard.length };
  const name = out.leader?.name ?? R.decks.find((d) => d.file === nameOrFile)?.name ?? nameOrFile;
  const ri = R.decks.findIndex((d) => d.name === name);
  const rev = R.decks[ri];
  if (rev) out.review = { winRate: rev.winRate, rank: ri + 1, of: R.decks.length, matrix: R.matrix[name] ?? {}, games: R.games, date: R.date };
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
