// A season's round robin recorded as a rating run (docs/REVIEW_2026-11-24.md B.4; docs/SERIES.md "Seasons as rating
// runs"). The round robin is already a Hard, bots-only match list on the current simulator version: every pairing of the
// season's field played `games` times, seats alternating, on the season's own seeds (S·1,000,000 onward). Until
// 2026-11-24 those games (about 4,000 to 5,000 a season) never reached the ratings that rank the next season's parents.
//
// After the round robin, scripts/season.ts writes them as data/series/run-N.json, in the series' format (the same
// fields as scripts/series-run.ts runFile writes, which check:data validates: kind, schema 1, id run-N, simVersion, bot,
// manifest, a match-list setup with every stored deck, one best-of-one match per game, no bracket), plus `season`, the
// season it came from. The ratings, the head-to-heads and the evidence then pool it like any run, by list (a game counts
// only on both decks' current lists) and with the pool's version and bot rule: so only a season played with the series'
// bot (hard) is written, since a run with another bot would switch the pool to that bot.
//
// Counted once: the season file and the leaderboard do not feed the ratings, so this file is the only way the season's
// games reach them; a season re-run with --force replaces its own run file (the same number, the same seeds), never adds
// a second; and before writing, the new games are checked against every recorded event and run with check:data's own
// duplicate test (duplicateGames: same version, bot, both lists in seat order, seed and first player). Rebuilding the
// ratings, head-to-heads and evidence is a separate step, as after a series run (the season prints the commands).
//
// Past seasons' round robins were never stored game by game (their season files keep standings only), so seasons 1 to 3
// cannot be added; this records Season 4 onward. Pure apart from the file helpers at the end.
import fs from 'node:fs';
import path from 'node:path';
import type { LibraryDeck } from '../src/lib/library';
import { gameRunManifest } from '../src/lib/runManifest';
import { SERIES_BOT } from '../src/lib/seriesPlan';
import { SIM_VERSION } from '../src/lib/tournament';
import { duplicateGames, type CheckEvent } from './check-data';
import { maxRunId, RATING_RUN_KIND, readPooled, runFiles, SERIES_DIR } from './lib-node';

/** One round-robin game as the worker returns it (scripts/worker.ts MatchResult): seat A is `a`. */
export interface SeasonGame {
  a: string;
  b: string;
  seed: number;
  first: 0 | 1;
  winner: 0 | 1 | 'tie' | null;
  turns: number;
  reason: string;
}

/** Whether a season with this bot is written as a rating run: only the series' bot (hard), so the pool's bot never switches. */
export const recordsRatingRun = (bot: string): boolean => bot === SERIES_BOT;

/** Why a season is not written as a rating run (null when it is). */
export function ratingRunSkipWords(bot: string): string | null {
  if (recordsRatingRun(bot)) return null;
  return `The round robin is not recorded as a rating run: it was played with the ${bot} bot, and the ratings pool the ${SERIES_BOT} bot's games (a run with another bot would switch the pool to it).`;
}

/** A recorded run file's season (its `season` field), or null for a series run. */
const seasonOf = (run: { season?: unknown }): number | null => (typeof run.season === 'number' ? run.season : null);

/** The run file a season already wrote (`run-N.json`, its number), if any. */
export function seasonRunFile(season: number, dir = SERIES_DIR): { file: string; n: number } | null {
  for (const f of runFiles(dir)) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { season?: unknown };
      if (seasonOf(r) === season) return { file: f, n: +f.match(/^run-(\d+)\.json$/)![1]! };
    } catch {
      /* an unreadable file is check:data's to report */
    }
  }
  return null;
}

/** The number a season's run takes: its own earlier run's (a re-run replaces it), else the next after the highest. */
export function seasonRunNumber(season: number, dir = SERIES_DIR): { n: number; replaces: string | null } {
  const own = seasonRunFile(season, dir);
  return own ? { n: own.n, replaces: own.file } : { n: maxRunId(dir) + 1, replaces: null };
}

/**
 * The run file: the series' format (scripts/series-run.ts runFile) with the season's own fields. Every game is a
 * best-of-one match; the match list groups consecutive games of one pairing, at most 10 a line, as the series does.
 */
export function seasonRatingRun(o: { season: number; n: number; date: string; field: readonly LibraryDeck[]; games: readonly SeasonGame[]; bot: string; gamesPerPair: number; seedBase: number }) {
  const bad = o.games.filter((g) => g.winner === null);
  if (bad.length) throw new Error(`${bad.length} round-robin game(s) have no result (seed ${bad[0]!.seed}): the season is not recorded as a rating run`);
  const byName = new Map(o.field.map((d) => [d.deck.name, d]));
  const used = [...new Set(o.games.flatMap((g) => [g.a, g.b]))].sort();
  const missing = used.filter((n) => !byName.has(n));
  if (missing.length) throw new Error(`round-robin decks not in the season's field: ${missing.join(', ')}`);
  const decks = used.map((n) => byName.get(n)!);
  const manifest = gameRunManifest({
    purpose: 'season',
    decks: decks.map((d) => ({ deck: d.deck, file: d.file })),
    fieldMode: `season-${o.season}`,
    bot: o.bot,
    seedBase: o.seedBase,
    seatPolicy: 'alternate',
    plannedGames: o.games.length,
    gamesPerPair: o.gamesPerPair,
    trace: true,
    simVersion: SIM_VERSION,
    createdAt: o.date,
    runId: `season:${o.season}:run-${o.n}:${o.date}`,
  });
  const lines: { a: string; b: string; bestOf: 1; times: number }[] = [];
  for (const g of o.games) {
    const last = lines[lines.length - 1];
    if (last && last.a === g.a && last.b === g.b && last.times < 10) last.times++;
    else lines.push({ a: g.a, b: g.b, bestOf: 1, times: 1 });
  }
  return {
    kind: RATING_RUN_KIND,
    schema: 1 as const,
    id: `run-${o.n}`,
    name: `Rating run ${o.n} (Season ${o.season} round robin)`,
    date: o.date,
    bot: o.bot,
    format: `Season ${o.season} round robin: ${o.games.length} games`,
    config: { name: `Rating run ${o.n} (Season ${o.season} round robin)`, rounds: 1, top: 0, bestOf: 1, bot: o.bot, seed: o.seedBase },
    decks: Object.fromEntries(decks.map((d) => [d.deck.name, { id: manifest.decks.find((x) => x.name === d.deck.name)!.id, file: d.file, legends: [...d.deck.legends], main: [...d.deck.main], ...(d.deck.sideboard?.length ? { sideboard: [...d.deck.sideboard] } : {}) }])),
    rounds: [
      {
        round: 1,
        matches: o.games.map((g) => ({
          a: g.a,
          b: g.b,
          games: [{ seed: g.seed, first: g.first, winner: g.winner as 0 | 1 | 'tie', turns: g.turns, reason: g.reason }],
          winner: g.winner === 0 ? g.a : g.winner === 1 ? g.b : '',
          score: [g.winner === 0 ? 1 : 0, g.winner === 1 ? 1 : 0],
        })),
      },
    ],
    standings: [],
    bracket: [],
    champion: null,
    phase: 'done',
    simVersion: SIM_VERSION,
    manifest,
    setup: { format: 'matches', entrants: decks.map((d) => ({ name: d.deck.name, file: d.file })), bestOf: 1, matches: lines },
    custom: true,
    season: o.season,
    rule: { target: 'season-round-robin', season: o.season, gamesPerPair: o.gamesPerPair },
  };
}

export type SeasonRun = ReturnType<typeof seasonRatingRun>;

/**
 * The games of `run` already recorded elsewhere (check:data's duplicateGames over every recorded event and run, the
 * season's own earlier run file left out when it is being replaced). Empty when the run may be written.
 */
export function seasonRunDuplicates(run: SeasonRun, o: { replaces: string | null; eventsDir?: string; seriesDir?: string } = { replaces: null }): string[] {
  const seriesDir = o.seriesDir ?? SERIES_DIR;
  // (a re-run replaces its own earlier file, which has the same id)
  const others = readPooled(o.eventsDir, seriesDir).filter((e) => !(o.replaces && e.id === run.id));
  return duplicateGames([...(others as unknown as CheckEvent[]), run as unknown as CheckEvent]).filter((d) => d.includes(`rating run ${run.id} `));
}

/** Write the run file (refused when any of its games is recorded elsewhere). Returns the path written. */
export function writeSeasonRun(run: SeasonRun, o: { replaces: string | null; seriesDir?: string; eventsDir?: string }): string {
  const seriesDir = o.seriesDir ?? SERIES_DIR;
  const dups = seasonRunDuplicates(run, { replaces: o.replaces, seriesDir, ...(o.eventsDir ? { eventsDir: o.eventsDir } : {}) });
  if (dups.length) throw new Error(`the season's round robin is not recorded as a rating run, because some of its games are recorded already: ${dups.slice(0, 3).join('; ')}`);
  fs.mkdirSync(seriesDir, { recursive: true });
  const file = path.join(seriesDir, `${run.id}.json`);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(run)}\n`);
  fs.renameSync(tmp, file);
  return file;
}

/** What is left after a run file is written: the rebuild order of docs/SERIES.md. */
export const SEASON_RUN_NEXT = 'Then rebuild, in this order: npx tsx scripts/ratings.ts, npx tsx scripts/build-h2h.ts, npm run evidence; then npm run check:data (it fails until the ratings and head-to-heads count the new run).';
