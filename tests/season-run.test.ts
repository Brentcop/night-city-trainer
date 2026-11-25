// A season's round robin as a rating run (scripts/season-run.ts; docs/REVIEW_2026-11-24.md B.4; docs/SERIES.md "Seasons
// as rating runs"): the file is in the format check:data validates (runFileProblems, no game recorded twice), it numbers
// after the highest run and a re-run of the season replaces its own file, the games pool once for the ratings (by
// list, beside the events and the other runs), a game recorded elsewhere refuses the write, only the series' bot is
// written, and a round-robin game played the season's way (the worker, telemetry on) replays as the series' first step
// replays the newest run (playWatchGame). Fixtures are built here; two Easy games are played, nothing else.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { closeGamePool, loadLibrary, readPooled, runJobs, type RecordedEvent } from '../scripts/lib-node';
import { duplicateGames, runFileProblems, type CheckEvent } from '../scripts/check-data';
import { currentListGate, poolEvents, selectEvents } from '../scripts/event-pool';
import { fitPooledRatings } from '../scripts/breed-data';
import { ratingRunSkipWords, recordsRatingRun, seasonRatingRun, seasonRunDuplicates, seasonRunFile, seasonRunNumber, writeSeasonRun, type SeasonGame } from '../scripts/season-run';
import { replaySample } from '../scripts/series-run';
import { playWatchGame } from '../src/lib/watchGame';
import { SIM_VERSION } from '../src/lib/tournament';
import type { MatchJob, MatchResult } from '../scripts/worker';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-season-run-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
afterAll(() => closeGamePool());

const LIB = loadLibrary();
const FIELD = LIB.slice(0, 4);
const SEASON = 7;
const DATE = '2026-11-30T10:00:00.000Z';

/** The round robin's games as the worker returns them: every pairing `per` times, seats alternating, seeds from S·1,000,000. */
function roundRobin(per = 2): SeasonGame[] {
  const out: SeasonGame[] = [];
  let seed = SEASON * 1_000_000;
  for (let i = 0; i < FIELD.length; i++)
    for (let j = i + 1; j < FIELD.length; j++)
      for (let k = 0; k < per; k++) {
        const s = seed++;
        out.push({ a: FIELD[i]!.deck.name, b: FIELD[j]!.deck.name, seed: s, first: (k % 2) as 0 | 1, winner: s % 3 === 0 ? 1 : 0, turns: 10 + (s % 4), reason: 'stub' });
      }
  return out;
}
const run = (n: number, games = roundRobin()) => seasonRatingRun({ season: SEASON, n, date: DATE, field: FIELD, games, bot: 'hard', gamesPerPair: 2, seedBase: SEASON * 1_000_000 });

describe('the run file', () => {
  it('is a rating run check:data accepts: kind, schema, id, version, bot, manifest, a match list of the stored decks', () => {
    const r = run(5);
    expect(r).toMatchObject({ kind: 'nct-rating-run', schema: 1, id: 'run-5', bot: 'hard', simVersion: SIM_VERSION, season: SEASON, custom: true, bracket: [], standings: [] });
    expect(r.rounds[0]!.matches).toHaveLength(12);
    expect(r.setup.matches.reduce((s, m) => s + m.times, 0)).toBe(12);
    expect(r.manifest).toMatchObject({ purpose: 'season', simVersion: SIM_VERSION, seedBase: SEASON * 1_000_000, field: { mode: `season-${SEASON}` } });
    const p = runFileProblems([{ file: 'run-5.json', event: r as unknown as CheckEvent }], LIB);
    expect(p.failures).toEqual([]);
    expect(p.info).toEqual([]);
    expect(p.manifests).toBe(1);
    expect(duplicateGames([r as unknown as CheckEvent])).toEqual([]);
    // a game without a result is never written
    expect(() => run(5, [{ ...roundRobin()[0]!, winner: null }])).toThrow(/no result/);
  });

  it('its games pool once for the ratings, beside the recorded events and runs, by list', () => {
    const r = run(9) as unknown as RecordedEvent;
    const pooled = readPooled();
    const was = selectEvents(pooled);
    // the recorded pool on the current version (as it was until SIM_VERSION 10): the run adds to it; on an older one
    // (since 2026-11-25, until the series re-rates), the run, on the current version, starts the pool afresh
    const same = was.simVersion === SIM_VERSION;
    const before = same ? poolEvents(was.kept, currentListGate(LIB)).games.length : 0;
    const sel = selectEvents([...pooled, r]);
    // the newest source by date is the season's run, with the series' version and bot: the pool keeps its version and bot
    expect(sel.simVersion).toBe(SIM_VERSION);
    expect(sel.bot).toBe('hard');
    const after = poolEvents(sel.kept, currentListGate(LIB));
    expect(after.games.length - before).toBe(12);
    expect(after.runs).toBe(same ? pooled.filter((e) => e.kind === 'nct-rating-run').length + 1 : 1);
    // the fit the season judges its own decks on at its end (scripts/breed-data.ts fitPooledRatings) counts them
    const fitBefore = new Map(fitPooledRatings(pooled).map((x) => [x.name, x.games]));
    const fitAfter = new Map(fitPooledRatings([...pooled, r]).map((x) => [x.name, x.games]));
    for (const d of FIELD) expect(fitAfter.get(d.deck.name)! - (same ? fitBefore.get(d.deck.name)! : 0), d.deck.name).toBe(6);
  }, 60_000);

  it('numbers after the highest run, replaces its own on a re-run, and is refused when a game is recorded already', () => {
    const series = path.join(tmp, 'series');
    fs.mkdirSync(series, { recursive: true });
    fs.writeFileSync(path.join(series, 'run-1.json'), JSON.stringify({ kind: 'nct-rating-run', id: 'run-1', rounds: [], bracket: [], decks: {} }));
    expect(seasonRunNumber(SEASON, series)).toEqual({ n: 2, replaces: null });
    const first = run(2);
    const events = path.join(tmp, 'no-events');
    writeSeasonRun(first, { replaces: null, seriesDir: series, eventsDir: events });
    expect(seasonRunFile(SEASON, series)).toEqual({ file: 'run-2.json', n: 2 });
    expect(seasonRunNumber(SEASON + 1, series)).toEqual({ n: 3, replaces: null });
    // a re-run of the same season (the same seeds, the same games) replaces its own file, never adds a second
    const again = seasonRunNumber(SEASON, series);
    expect(again).toEqual({ n: 2, replaces: 'run-2.json' });
    expect(seasonRunDuplicates(run(again.n), { replaces: again.replaces, seriesDir: series, eventsDir: events })).toEqual([]);
    writeSeasonRun(run(again.n), { replaces: again.replaces, seriesDir: series, eventsDir: events });
    expect(fs.readdirSync(series).filter((f) => f.endsWith('.json')).sort()).toEqual(['run-1.json', 'run-2.json']);
    // the same games under another run number are recorded twice: refused, nothing written
    expect(() => writeSeasonRun(run(3), { replaces: null, seriesDir: series, eventsDir: events })).toThrow(/recorded already/);
    expect(fs.existsSync(path.join(series, 'run-3.json'))).toBe(false);
  });

  it('only the series’ bot is written (a run with another bot would switch the ratings’ pool)', () => {
    expect(recordsRatingRun('hard')).toBe(true);
    expect(ratingRunSkipWords('hard')).toBeNull();
    for (const bot of ['medium', 'deep', 'lookahead']) {
      expect(recordsRatingRun(bot)).toBe(false);
      expect(ratingRunSkipWords(bot)).toMatch(/not recorded as a rating run: it was played with the \w+ bot/);
    }
  });
});

describe('a round-robin game played the season’s way replays as the series replays the newest run', () => {
  it('two Easy games through the worker with telemetry on, then playWatchGame on the run file’s record', { timeout: 120_000 }, async () => {
    const [a, b] = FIELD;
    const jobs: MatchJob[] = [0, 1].map((k) => ({ a: a!.deck, b: b!.deck, seed: SEASON * 1_000_000 + k, first: k as 0 | 1, bot: 'easy', trace: true }));
    const res: MatchResult[] = await runJobs(jobs, { threads: 1, quiet: true });
    const r = seasonRatingRun({ season: SEASON, n: 4, date: DATE, field: FIELD, games: res, bot: 'easy', gamesPerPair: 2, seedBase: SEASON * 1_000_000 });
    const sample = replaySample([r as unknown as RecordedEvent], 2);
    expect(sample).toHaveLength(2);
    for (const g of sample) {
      const w = await playWatchGame({ kind: 'event', decks: g.decks, seed: g.seed, first: g.first, bot: g.bot, simVersion: g.simVersion, expect: g.expect });
      expect(w.winner ?? 'tie').toBe(g.expect.winner);
      expect(w.turns).toBe(g.expect.turns);
    }
  });
});
