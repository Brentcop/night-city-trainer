// The rating series' command (scripts/series.ts, logic in scripts/series-run.ts; docs/SERIES.md): status --json for the
// workflow, a run on a tiny budget with a stub player (no Hard game is played here) on the repository's own data, the
// run file it writes passing check:data's run checks and coverage, the replay refusal, the switches and the exit codes.
// Whatever the recorded data holds, the tests hold: they read what is needed from it (with a width of 3 the series
// still has work; if it ever has none, the run is checked to do nothing).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXIT, seriesCommand, type SeriesIO, type SeriesStatus } from '../scripts/series-run';
import { loadLibrary, readEvents, readRuns, type RecordedEvent } from '../scripts/lib-node';
import { currentListGate, selectEvents } from '../scripts/event-pool';
import { fieldPool } from '../scripts/tournament-setup';
import { h2hOf } from '../scripts/build-h2h';
import { checkData, duplicateGames, runFileProblems, type CheckEvent } from '../scripts/check-data';
import { distinctLists } from '../src/lib/distinctLists';
import { defaultSiteConfig, siteConfigText } from '../src/lib/siteConfig';
import { SIM_VERSION } from '../src/lib/tournament';
import { RUN_SEED_SPAN, seriesSeed } from '../src/lib/seriesPlan';

const CONFIG = 'virtual/site-config.json';
const configWith = (automation: Partial<ReturnType<typeof defaultSiteConfig>['automation']>) => {
  const c = defaultSiteConfig();
  Object.assign(c.automation, automation);
  return siteConfigText(c);
};

/** The command on the repository's data, with a stub player and replay, a fake clock and writes kept in memory. */
function harness(o: { config?: string | null; replay?: string | null; secondsPerGame?: number } = {}) {
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
      return jobs.map((j) => ({ winner: (Math.imul(j.seed, 2654435761) >>> 16) & 1 ? (0 as const) : (1 as const), turns: 10 + (j.seed % 4), reason: 'stub' }));
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
    expect(Object.keys(s).sort()).toEqual(['bot', 'decks', 'expectedGames', 'games', 'minutes', 'needed', 'nextRun', 'over', 'simVersion', 'switches', 'target', 'unrated', 'why', 'widest'].sort());
    expect(s).toMatchObject({ simVersion: SIM_VERSION, bot: 'hard', decks: FIELD.length, switches: { series: true, arrivals: true, width: 3, maxGamesPerRun: 12_000 } });
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
