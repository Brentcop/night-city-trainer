// The season leaderboard's entry (data/seasons/leaderboard.json) and the one step a forced re-run needs before it plays
// (scripts/season.ts --force): taking the season's games back out. Pure (the leaderboard object is changed in place,
// nothing is read or written here), so tests/season-uncount.test.ts can run it on a copy.

export interface Entry {
  name: string;
  file: string;
  kind: string;
  origin: string; // meta / guide / NC original / S<n> mutant|crossover|explorer / variant
  colors: string;
  arch: string;
  firstSeason: number;
  metaW: number; // wins (ties = 0.5) vs meta archetypes, pooled across seasons + finals
  metaG: number;
  seasons: Record<string, number>; // season -> round-robin win rate in that season
  finals?: number; // latest finals win rate vs meta
  idea?: string;
  /** what each season added to metaW/metaG (so a forced re-run can take it out again); finals: that season set `finals` */
  contrib?: Record<string, { w: number; g: number; finals?: boolean }>;
}

/**
 * Before a forced re-run: take season N's games back out of the leaderboard. Returns false (changing nothing) when the
 * season was counted before per-season totals were kept.
 */
export function uncountSeason(lb: Record<string, Entry>, season: number): boolean {
  const k = String(season);
  const legacy = Object.values(lb).filter((e) => e.seasons[k] !== undefined && !e.contrib?.[k]);
  if (legacy.length) return false;
  for (const e of Object.values(lb)) {
    const c = e.contrib?.[k];
    if (c) {
      e.metaW -= c.w;
      e.metaG -= c.g;
      if (Math.abs(e.metaW) < 1e-9) e.metaW = 0;
      if (c.finals) delete e.finals;
      delete e.contrib![k];
    }
    delete e.seasons[k];
    if (e.firstSeason === season) delete lb[e.name];
  }
  return true;
}
