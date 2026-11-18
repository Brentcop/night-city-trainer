// The rating series (docs/SERIES.md): plays Hard-bot games, the decks with the widest rating ranges first, until every
// library deck's 90% range on its win rate against the field is at most the owner's width (automation.width in
// public/site-config.json), and writes one rating run file (data/series/run-N.json). The rule is src/lib/seriesPlan.ts;
// the scheduled workflow calls `status --json`, then `run`, then rebuilds ratings, head-to-heads and evidence and checks.
//
//   npx tsx scripts/series.ts status [--json] [--config FILE]
//   npx tsx scripts/series.ts run [--minutes 240] [--max-games N] [--threads 4] [--dry-run] [--replay 4] [--out DIR] [--config FILE]
//
// status   whether a run is needed and why, the widest range and the target, the unrated decks (no game on their
//          current list), the games the rule expects and the minutes at the last recorded rate (1.5 games a second
//          when no run has recorded one), the switches as the committed config reads (a key it does not name takes its
//          default); --json prints it as one JSON object for the workflow's decision step.
// run      first plays the newest recorded games of this simulator version again (--replay N, default 4; 0 skips) and
//          refuses, naming the game, when one ends differently; then plays chunks of 300 games by the rule through the
//          worker pool, refitting between chunks, until the rule holds or the budget is spent (--minutes, default 240,
//          checked before each chunk; --max-games, at most automation.maxGamesPerRun); writes ONE run file into
//          data/series/ (or --out DIR) and nothing else. Rebuilding ratings.json, h2h.json and the evidence is the next
//          step: npx tsx scripts/ratings.ts, npx tsx scripts/build-h2h.ts, npx tsx scripts/build-evidence.ts.
//          --dry-run plays for real and prints what it would write, writing nothing.
//   --config FILE   the site config to read (default public/site-config.json)
//   --threads N     game threads (default 4, a GitHub-hosted runner's vCPUs)
//
// Exit codes: 0 done (the rule holds, nothing was needed, or both switches are off); 3 stopped at its budget (the run
// file says "budget"; the next run carries on); 4 refused because a recorded game no longer replays (nothing played or
// written); 1 an error (the config is missing or broken, a game threw); 2 a bad command line.
import fs from 'node:fs';
import path from 'node:path';
import { workerPool } from './lib-node';
import { EXIT, seriesCommand, type SeriesIO } from './series-run';
import type { MatchJob, MatchResult } from './worker';
import { playWatchGame, WatchRefused } from '../src/lib/watchGame';

let pool: ReturnType<typeof workerPool<MatchJob, MatchResult>> | null = null;

const io: SeriesIO = {
  out: (l) => console.log(l),
  err: (l) => console.error(l),
  read: (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null),
  write: (f, t) => {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, t);
  },
  now: () => Date.now(),
  play: async (jobs, threads) => {
    pool ??= workerPool<MatchJob, MatchResult>(new URL('./worker-boot.mjs', import.meta.url), threads);
    const p = pool;
    const results = await Promise.all(jobs.map((j) => p.run({ a: j.decks[0], b: j.decks[1], seed: j.seed, first: j.first, bot: 'hard' })));
    return results.map((r, q) => {
      if (r.error) throw new Error(`game ${jobs[q]!.a} vs ${jobs[q]!.b} (seed ${r.seed}, first ${r.first}) threw:\n${r.error}`);
      return { winner: r.winner === null ? 'tie' : r.winner, turns: r.turns, reason: r.reason };
    });
  },
  replay: async (games) => {
    for (const g of games) {
      try {
        await playWatchGame({ kind: 'event', decks: g.decks, seed: g.seed, first: g.first, bot: g.bot, simVersion: g.simVersion, expect: g.expect });
      } catch (e) {
        if (e instanceof WatchRefused) return `${g.label}: ${e.message.replace(/^This game can't be watched: /, '')}`;
        throw e;
      }
    }
    return null;
  },
};

seriesCommand(process.argv.slice(2), io)
  .then(async (code) => {
    await pool?.close();
    process.exit(code);
  })
  .catch(async (e) => {
    console.error(`error: ${(e as Error)?.stack ?? e}`);
    await pool?.close().catch(() => {});
    process.exit(EXIT.error);
  });
