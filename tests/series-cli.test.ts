// The rating series' command (scripts/series.ts, logic in scripts/series-run.ts; docs/SERIES.md): status --json for the
// workflow, a run on a tiny budget with a stub player (no Hard game is played here) on the repository's own data, the
// run file it writes passing check:data's run checks and coverage, the replay refusal, the switches and the exit codes.
// Whatever the recorded data holds, the tests hold: they read what is needed from it (with a width of 3 the series
// still has work; if it ever has none, the run is checked to do nothing).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXIT, runsWithImpact, seriesCommand, type SeriesIO, type SeriesStatus } from '../scripts/series-run';
import { loadLibrary, readEvents, readRuns, type RecordedEvent } from '../scripts/lib-node';
import { currentListGate, selectEvents } from '../scripts/event-pool';
import { fieldPool } from '../scripts/tournament-setup';
import { h2hOf } from '../scripts/build-h2h';
import { checkData, duplicateGames, runFileProblems, type CheckEvent } from '../scripts/check-data';
import { distinctLists } from '../src/lib/distinctLists';
import { defaultSiteConfig, siteConfigText } from '../src/lib/siteConfig';
import { SIM_VERSION } from '../src/lib/tournament';
import { RUN_SEED_SPAN, seriesSeed } from '../src/lib/seriesPlan';
import { seriesImpactProblems } from '../src/lib/seriesImpact';
import { parseCardImpact } from '../src/lib/seasonImpact';
import { parseDeckImpact } from '../src/lib/seasonDeckImpact';

const CONFIG = 'virtual/site-config.json';
const configWith = (automation: Partial<ReturnType<typeof defaultSiteConfig>['automation']>) => {
  const c = defaultSiteConfig();
  Object.assign(c.automation, automation);
  return siteConfigText(c);
};

/** The command on the repository's data, with a stub player and replay, a fake clock and writes kept in memory. */
function harness(o: { config?: string | null; replay?: string | null; secondsPerGame?: number; summaries?: boolean } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const written = new Map<string, string>();
  const appended = new Map<string, string>();
  let clock = Date.parse('2026-11-19T03:17:00.000Z');
  let playedJobs = 0;
  const io: SeriesIO = {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    read: (f) => (f === CONFIG ? (o.config === undefined ? configWith({ width: 3 }) : o.config) : fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null),
    write: (f, t) => void written.set(f, t),
    append: (f, t) => void appended.set(f, (appended.get(f) ?? '') + t),
    now: () => clock,
    play: async (jobs) => {
      playedJobs += jobs.length;
      clock += jobs.length * 1000 * (o.secondsPerGame ?? 0.5);
      // a stub game: the winner follows the seed, so the same run gives the same file
      return jobs.map((j) => {
        const winner = (Math.imul(j.seed, 2654435761) >>> 16) & 1 ? (0 as const) : (1 as const);
        // with summaries: each seat "draws" the cards of its main deck the seed picks (traced only when the job asks)
        const seen = (d: { main: string[] }, salt: number) => [...new Set(d.main.filter((_, k) => (Math.imul(j.seed + salt, 40503 + k) >>> 13) & 1))];
        const summaries = o.summaries && j.trace ? [{ deck: j.a, result: winner === 0 ? 1 : 0, seen: seen(j.decks[0], 1) }, { deck: j.b, result: winner === 1 ? 1 : 0, seen: seen(j.decks[1], 2) }] : undefined;
        return { winner, turns: 10 + (j.seed % 4), reason: 'stub', ...(summaries ? { summaries } : {}) };
      });
    },
    replay: async (games) => (o.replay === undefined ? null : o.replay === null ? null : `${games[0]?.label ?? 'a game'}: ${o.replay}`),
  };
  const run = (argv: string[]) => seriesCommand([...argv, '--config', CONFIG], io);
  return { io, out, err, written, appended, run, played: () => playedJobs };
}

const FIELD = distinctLists(fieldPool(loadLibrary())).kept;
const statusOf = async (config?: string) => {
  const h = harness({ config });
  expect(await h.run(['status', '--json'])).toBe(EXIT.done);
  return JSON.parse(h.out.join('\n')) as SeriesStatus;
};

describe('status --json (the workflow\'s decision step)', () => {
  it('says everything the decision needs, with the switches as the config reads them', async () => {
    const s = await statusOf(configWith({ width: 3 }));
    expect(Object.keys(s).sort()).toEqual(['block', 'bot', 'decks', 'expectedGames', 'games', 'minutes', 'needed', 'nextRun', 'over', 'simVersion', 'switches', 'target', 'unrated', 'why', 'widest'].sort());
    expect(s).toMatchObject({ simVersion: SIM_VERSION, bot: 'hard', decks: FIELD.length, switches: { series: true, arrivals: true, width: 3, maxGamesPerRun: 12_000, matchups: true, matchupDecks: 16, matchupGames: 100 } });
    // the matchup block: the 16 best-rated decks, 120 pairs; its games to go are counted in the expectation
    expect(s.block).toMatchObject({ target: 100, pairs: 120 });
    expect(s.block!.decks).toHaveLength(16);
    expect(s.expectedGames).toBeGreaterThanOrEqual(s.block!.games);
    expect(s.why.length).toBeGreaterThan(0);
    expect(s.nextRun).toMatch(/^run-\d+$/);
    expect(s.minutes.gamesPerSecond).toBeGreaterThan(0);
    if (s.needed) {
      expect(s.expectedGames).toBeGreaterThan(0);
      expect(s.minutes.estimate).toBe(Math.ceil(s.expectedGames / s.minutes.gamesPerSecond / 60));
    } else expect(s.expectedGames).toBe(0);
  });
  it('a key the file does not name takes its default; both switches off: nothing needed', async () => {
    const bare = JSON.stringify({ kind: 'nct-site-config', schema: 1 });
    expect((await statusOf(bare)).switches).toEqual(defaultSiteConfig().automation);
    const off = await statusOf(configWith({ series: false, arrivals: false }));
    expect(off.needed).toBe(false);
    expect(off.why.join(' ')).toContain('switched off');
  });
  it('a missing or broken config is exit 1, a bad command line exit 2', async () => {
    expect(await harness({ config: null }).run(['status'])).toBe(EXIT.error);
    expect(await harness({ config: '{"kind":"nct-site-config","schema":1,"automation":{"width":2}}' }).run(['status'])).toBe(EXIT.error);
    expect(await harness().run(['nonsense'])).toBe(EXIT.usage);
    expect(await harness().run(['status', '--dry-run'])).toBe(EXIT.usage);
    expect(await harness().run(['run', '--max-games', '0'])).toBe(EXIT.usage);
  });
});

describe('run (a tiny budget, a stub player)', () => {
  it('replays the newest recorded games first, plays chunks by the rule, writes one run file, and stops at its budget (exit 3)', async () => {
    const s = await statusOf();
    const h = harness();
    const code = await h.run(['run', '--max-games', '60', '--out', 'virtual/series']);
    if (!s.needed) {
      expect(code).toBe(EXIT.done);
      expect(h.written.size).toBe(0);
      return;
    }
    expect(code).toBe(EXIT.budget);
    expect(h.played()).toBe(60);
    expect([...h.written.keys()]).toEqual([path.join('virtual/series', `${s.nextRun}.json`)]);
    const run = JSON.parse([...h.written.values()][0]!);
    const n = Number(s.nextRun.slice(4));
    expect(run).toMatchObject({ kind: 'nct-rating-run', schema: 1, id: s.nextRun, bot: 'hard', simVersion: SIM_VERSION, stopped: 'budget', rate: { games: 60, seconds: 30, threads: 4 }, rule: { target: 'widest-half-width', width: 3, level: 0.9 } });
    expect(run.why).toEqual(s.why);
    expect(run.before.widest).toBeCloseTo(s.widest!.hw, 2);
    const games = run.rounds[0].matches.flatMap((m: { games: { seed: number }[] }) => m.games);
    expect(games.map((g: { seed: number }) => g.seed)).toEqual(games.map((_: unknown, k: number) => seriesSeed(n, k)));
    expect(Math.max(...games.map((g: { seed: number }) => g.seed))).toBeLessThan(seriesSeed(n, RUN_SEED_SPAN));
    // check:data: the run's own checks, no game twice with the recorded ones, and h2h.json's coverage once it is rebuilt
    const lib = loadLibrary();
    const file = `${s.nextRun}.json`;
    expect(runFileProblems([{ file, event: run as CheckEvent }], lib)).toMatchObject({ failures: [], manifests: 1 });
    const events = readEvents();
    const runs = readRuns();
    expect(duplicateGames([...events, ...runs, run] as unknown as CheckEvent[])).toEqual([]);
    const h2h = h2hOf(selectEvents([...events, ...runs, run as RecordedEvent]), currentListGate(lib));
    const index = JSON.parse(fs.readFileSync('src/data/tournaments.json', 'utf8'));
    const r = checkData({ index, events: events.map((e) => ({ file: `event-${e.id}.json`, event: e as unknown as CheckEvent })), runs: [...runs.map((e) => ({ file: `${e.id}.json`, event: e as unknown as CheckEvent })), { file, event: run }], library: lib, h2h });
    expect(r.failures).toEqual([]);
  });
  it('the same run twice writes the same bytes; --dry-run plays and writes nothing', async () => {
    const a = harness();
    const b = harness();
    const ca = await a.run(['run', '--max-games', '30', '--out', 'v']);
    const cb = await b.run(['run', '--max-games', '30', '--out', 'v']);
    expect(ca).toBe(cb);
    expect([...a.written.values()]).toEqual([...b.written.values()]);
    const dry = harness();
    const cd = await dry.run(['run', '--max-games', '30', '--dry-run']);
    expect(cd).toBe(ca);
    expect(dry.written.size).toBe(0);
    if (ca === EXIT.budget) expect(dry.out.join('\n')).toContain('--dry-run: would write');
  });
  it('stops on its clock (--minutes), before the next chunk', async () => {
    const s = await statusOf();
    if (!s.needed) return;
    const h = harness({ secondsPerGame: 3 });
    // one chunk of 300 games takes 15 minutes on this clock; a 10-minute budget stops after the first
    expect(await h.run(['run', '--minutes', '10', '--out', 'v'])).toBe(EXIT.budget);
    expect(h.played()).toBe(300);
  });
  it('refuses, naming the game, when a recorded game no longer replays (exit 4): nothing played, nothing written', async () => {
    const s = await statusOf();
    if (!s.needed) return;
    const h = harness({ replay: 'it ends in a win for B, not A as recorded' });
    expect(await h.run(['run', '--max-games', '30', '--out', 'v'])).toBe(EXIT.replayRefused);
    expect(h.played()).toBe(0);
    expect(h.written.size).toBe(0);
    expect(h.err.join('\n')).toMatch(/refused: (event|rating run) .+ vs .+, seed \d+/);
  });
  it('switched off, it plays nothing and exits 0', async () => {
    const h = harness({ config: configWith({ series: false, arrivals: false }) });
    expect(await h.run(['run', '--out', 'v'])).toBe(EXIT.done);
    expect(h.played()).toBe(0);
    expect(h.written.size).toBe(0);
  });
});

describe('verify (the workflow runs it on the main it commits onto)', () => {
  /** a small run written by the command itself, with the stub player */
  const makeRun = async () => {
    const h = harness();
    const code = await h.run(['run', '--max-games', '30', '--out', 'v']);
    return code === EXIT.budget ? JSON.parse([...h.written.values()][0]!) : null;
  };
  const verify = async (run: unknown, replay: string | null = null, extra: string[] = []) => {
    const h = harness({ replay });
    const files: Record<string, string> = { 'v/run.json': JSON.stringify(run) };
    h.io.read = (f) => files[f] ?? null;
    let asked = 0;
    const inner = h.io.replay;
    h.io.replay = async (g) => {
      asked = g.length;
      return inner(g);
    };
    const code = await seriesCommand(['verify', 'v/run.json', ...extra], h.io);
    return { code, err: h.err.join('\n'), out: h.out.join('\n'), asked };
  };
  it('passes a run of this simulator version whose games replay, replaying the first, the last and some between', async () => {
    const run = await makeRun();
    if (!run) return;
    const r = await verify(run);
    expect(r.code).toBe(EXIT.done);
    expect(r.asked).toBe(4);
    expect((await verify(run, null, ['--replay', '2'])).asked).toBe(2);
  });
  it('refuses (exit 4) a run of another simulator version, or one whose game no longer replays, naming it', async () => {
    const run = await makeRun();
    if (!run) return;
    const other = await verify({ ...run, simVersion: SIM_VERSION + 1 });
    expect(other.code).toBe(EXIT.replayRefused);
    expect(other.err).toContain(`simulator version ${SIM_VERSION + 1}`);
    const moved = await verify(run, 'it lasts 13 turns, not 12 as recorded');
    expect(moved.code).toBe(EXIT.replayRefused);
    expect(moved.err).toMatch(/refused: rating run run-\d+, .+ vs .+, seed \d+/);
  });
  it('exit 1 for a file that is not a rating run, exit 2 without a file', async () => {
    expect((await verify({ kind: 'event' })).code).toBe(EXIT.error);
    expect(await harness().run(['verify'])).toBe(EXIT.usage);
  });
});

describe('what the workflow reads (--github-output, --summary)', () => {
  it('status writes needed= and a summary; run writes written=, file=, stopped=', async () => {
    const h = harness();
    expect(await h.run(['status', '--github-output', 'o', '--summary', 's'])).toBe(EXIT.done);
    expect(h.appended.get('o')).toMatch(/^needed=(true|false)\n$/);
    expect(h.appended.get('s')).toContain('### Rating series:');
    const r = harness();
    const code = await r.run(['run', '--max-games', '30', '--out', 'v', '--github-output', 'o', '--summary', 's']);
    if (code === EXIT.budget) {
      expect(r.appended.get('o')).toMatch(/^written=true\nfile=v\/run-\d+\.json\nstopped=budget\n$/);
      expect(r.appended.get('s')).toContain('stopped at its budget');
    } else expect(r.appended.get('o')).toBe('written=false\nfile=\nstopped=nothing-needed\n');
    const off = harness({ config: configWith({ series: false, arrivals: false }) });
    await off.run(['run', '--github-output', 'o']);
    expect(off.appended.get('o')).toBe('written=false\nfile=\nstopped=nothing-needed\n');
  });
});

describe('the matchup block and the traced card impact (2026-11-24)', () => {
  // a width the recorded data meets, so the run goes to the block (if the data ever misses it, the width comes first)
  const WIDE = configWith({ width: 8 });
  it('a run with the width met plays the block\'s pairs, seats balanced, and its file carries the block and the card impact', async () => {
    const s = await statusOf(WIDE);
    expect(s.block).not.toBeNull();
    const h = harness({ config: WIDE, summaries: true });
    const code = await h.run(['run', '--max-games', '60', '--out', 'v']);
    if (!s.needed) return void expect(code).toBe(EXIT.done);
    expect(code).toBe(EXIT.budget);
    const run = JSON.parse([...h.written.values()][0]!);
    const games = run.rounds[0].matches.flatMap((m: { a: string; b: string; games: { first: number }[] }) => m.games.map((g) => ({ a: m.a, b: m.b, first: g.first })));
    expect(games).toHaveLength(60);
    if (s.over === 0) {
      // every game a pair of the block's decks, as the status named them
      expect(games.every((g: { a: string; b: string }) => s.block!.decks.includes(g.a) && s.block!.decks.includes(g.b))).toBe(true);
      expect(run.block).toMatchObject({ decks: s.block!.decks, target: 100, pairs: 120, before: { games: s.block!.games }, after: { games: s.block!.games - 60 } });
      expect(run.rule).toMatchObject({ matchups: true, matchupDecks: 16, matchupGames: 100 });
    }
    expect(run.impact).toMatchObject({ kind: 'nct-run-card-impact', schema: 1, games: 60 });
    expect(run.impact.decks.length).toBeGreaterThan(0);
    expect(h.out.join('\n')).toMatch(/Card impact traced: \d+ decks/);
    // check:data reads the run with its block and impact
    expect(runFileProblems([{ file: `${s.nextRun}.json`, event: run as CheckEvent }], loadLibrary())).toMatchObject({ failures: [] });
    const bad = { ...run, impact: { ...run.impact, games: 59 } };
    expect(runFileProblems([{ file: `${s.nextRun}.json`, event: bad as CheckEvent }], loadLibrary()).failures.join('\n')).toContain('its card impact traces 59 games, the run has 60');
    // --no-trace: the same games, no card impact
    const plain = harness({ config: WIDE, summaries: true });
    await plain.run(['run', '--max-games', '60', '--out', 'v', '--no-trace']);
    const p = JSON.parse([...plain.written.values()][0]!);
    expect(p.impact).toBeUndefined();
    expect(p.rounds).toEqual(run.rounds);
  });
  it('--dry-run prints the pairings it plays', async () => {
    const h = harness({ config: WIDE });
    const code = await h.run(['run', '--max-games', '30', '--dry-run']);
    if (code === EXIT.done) return;
    expect(h.out.join('\n')).toMatch(/ {2}pairs: .+ vs .+ ×\d+/);
    expect(h.written.size).toBe(0);
  });
  it('impact adds a traced run to the committed card tables once, in the (version, hard) entry; a second pass adds nothing', async () => {
    const h = harness({ config: WIDE, summaries: true });
    const code = await h.run(['run', '--max-games', '60', '--out', 'v']);
    if (code === EXIT.done) return;
    const text = [...h.written.values()][0]!;
    const run = JSON.parse(text);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'series-impact-'));
    try {
      fs.mkdirSync(path.join(tmp, 'series'));
      fs.mkdirSync(path.join(tmp, 'seasons'));
      // the recorded runs (the committed tables count the traced ones) and the new one
      for (const f of fs.readdirSync('data/series')) fs.copyFileSync(path.join('data/series', f), path.join(tmp, 'series', f));
      fs.writeFileSync(path.join(tmp, 'series', `${run.id}.json`), text);
      for (const f of ['impact.json', 'deck-impact.json']) fs.copyFileSync(path.join('data/seasons', f), path.join(tmp, 'seasons', f));
      const io = harness().io;
      const files = new Map<string, string>();
      io.read = (f) => files.get(f) ?? (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
      io.write = (f, t) => void files.set(f, t);
      const out: string[] = [];
      io.out = (l) => out.push(l);
      io.dirs = { series: path.join(tmp, 'series'), seasons: path.join(tmp, 'seasons') };
      expect(await seriesCommand(['impact'], io)).toBe(EXIT.done);
      expect(out.join('\n')).toContain(`rating ${run.id} (60 games`);
      const card = parseCardImpact(JSON.parse(files.get(path.join(tmp, 'seasons', 'impact.json'))!)).file!;
      const deck = parseDeckImpact(JSON.parse(files.get(path.join(tmp, 'seasons', 'deck-impact.json'))!)).file!;
      const hard = card.entries.find((e) => e.simVersion === SIM_VERSION && e.bot === 'hard')!;
      expect(hard.sources).toContainEqual({ kind: 'series', run: run.id, runId: run.manifest.runId });
      expect(seriesImpactProblems(card, deck, runsWithImpact(io, path.join(tmp, 'series')))).toEqual([]);
      // a second pass reads what the first wrote and adds nothing
      out.length = 0;
      const before = new Map(files);
      expect(await seriesCommand(['impact'], io)).toBe(EXIT.done);
      expect(out.join('\n')).toContain('Nothing to add');
      expect(files).toEqual(before);
      // --dry-run on the committed tables writes nothing
      files.clear();
      expect(await seriesCommand(['impact', '--dry-run'], io)).toBe(EXIT.done);
      expect(files.size).toBe(0);
      expect(await seriesCommand(['impact', '--json'], io)).toBe(EXIT.usage);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
