// The logic of scripts/series.ts (docs/SERIES.md): read the switches, the series field and the pooled games, decide,
// and run the series with the player and the replay check handed in (the tests hand in stubs; the command hands in the
// worker pool and src/lib/watchGame.ts). The rule itself is src/lib/seriesPlan.ts.
import path from 'node:path';
import { ArgError, bool, int, isRun, loadLibrary, maxRunId, parseArgs, readPooled, str, usageOf, EVENTS_DIR, RATING_RUN_KIND, SERIES_DIR, type RecordedEvent } from './lib-node';
import { fieldPool } from './tournament-setup';
import { currentListGate, selectEvents } from './event-pool';
import { distinctLists } from '../src/lib/distinctLists';
import { ratedGamesOf } from '../src/lib/ratingGames';
import type { RatedGame } from '../src/lib/ratingModel';
import { decide, expectedGames, meetings, RUN_SEED_SPAN, runSeries, SERIES_BOT, SERIES_CHUNK, seriesFit, seriesSeed, type SeriesDecision, type SeriesGame, type SeriesJob, type SeriesResult, type SeriesSwitches } from '../src/lib/seriesPlan';
import { defaultSiteConfig, issueLine, parseSiteConfigText, type SiteConfig } from '../src/lib/siteConfig';
import { gameDeck, SIM_VERSION } from '../src/lib/tournament';
import { gameRunManifest } from '../src/lib/runManifest';
import type { DeckList } from '../src/engine/types';
import type { LibraryDeck } from '../src/lib/library';

/** Exit codes (docs/SERIES.md "What the workflow needs"). */
export const EXIT = { done: 0, error: 1, usage: 2, budget: 3, replayRefused: 4 } as const;

/** Games a second assumed when no run has recorded its rate: the low end of the 4 vCPU runner estimate (docs/SERIES.md E5). */
export const DEFAULT_RATE = 1.5;
/** Recorded games replayed before a run plays (the newest of the pool). */
export const REPLAY_SAMPLE = 4;

export interface SeriesIO {
  out: (line: string) => void;
  err: (line: string) => void;
  /** a file's text, or null when it does not exist */
  read: (file: string) => string | null;
  write: (file: string, text: string) => void;
  /** milliseconds, for the time budget and the rate */
  now: () => number;
  /** play games (the worker pool, or a stub in the tests) */
  play: (jobs: readonly (SeriesJob & { decks: [DeckList, DeckList] })[], threads: number) => Promise<SeriesResult[]>;
  /** play recorded games again; the first that ends differently, as a sentence naming it, or null */
  replay: (games: readonly ReplayGame[]) => Promise<string | null>;
  /** the checkout's directories (defaults: the repository's) */
  dirs?: { events?: string; series?: string; decks?: string };
}

/** A recorded game to play again, and how it ended. */
export interface ReplayGame {
  label: string;
  decks: [DeckList, DeckList];
  seed: number;
  first: 0 | 1;
  bot: string;
  simVersion: number | undefined;
  expect: { winner: 0 | 1 | 'tie'; turns: number };
}

export interface SeriesData {
  switches: SeriesSwitches & { maxGamesPerRun: number };
  config: SiteConfig;
  field: LibraryDeck[];
  sources: RecordedEvent[];
  decision: SeriesDecision;
  fit: ReturnType<typeof seriesFit>;
  /** the pooled games on current lists (what the fit read) */
  rated: RatedGame[];
  games: number;
  nextRun: number;
}

/** The status the workflow's decision step reads (status --json). */
export interface SeriesStatus {
  needed: boolean;
  why: string[];
  switches: SeriesData['switches'];
  simVersion: number;
  bot: string;
  /** pooled games on this simulator version and bot, current lists only */
  games: number;
  /** decks in the series field (the library, each list once) */
  decks: number;
  widest: { deck: string; hw: number } | null;
  target: number;
  /** decks above their target */
  over: number;
  unrated: string[];
  expectedGames: number;
  minutes: { estimate: number; gamesPerSecond: number; from: string };
  nextRun: string;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Read everything the decision needs. Throws ArgError for a config the job must not run on. */
export function loadSeries(io: SeriesIO, configFile: string): SeriesData {
  const text = io.read(configFile);
  if (text === null) throw new ArgError(`${configFile} does not exist, so the series switches cannot be read; nothing runs.`);
  const parsed = parseSiteConfigText(text);
  if (parsed.errors.length) throw new ArgError(`${configFile} has ${parsed.errors.length === 1 ? 'an error' : `${parsed.errors.length} errors`} (${parsed.errors.slice(0, 3).map(issueLine).join('; ')}); nothing runs until it is fixed.`);
  const config = parsed.config;
  const a = config.automation ?? defaultSiteConfig().automation;
  const lib = loadLibrary(io.dirs?.decks);
  const field = distinctLists(fieldPool(lib)).kept;
  // the pool the series works in: this code's simulator version and the series' bot (a version bump starts afresh)
  const sources = selectEvents(readPooled(io.dirs?.events ?? EVENTS_DIR, io.dirs?.series ?? SERIES_DIR), { simVersion: SIM_VERSION, bot: SERIES_BOT }).kept;
  const games = ratedGamesOf(sources, currentListGate(lib));
  const names = field.map((d) => d.deck.name);
  const fit = seriesFit(games, names);
  const switches = { series: a.series, arrivals: a.arrivals, width: a.width, maxGamesPerRun: a.maxGamesPerRun };
  const decision = decide({ games, field: names, switches }, fit);
  return { switches, config, field, sources, decision, fit, rated: games, games: games.length, nextRun: maxRunId(io.dirs?.series ?? SERIES_DIR) + 1 };
}

/** The last recorded run's rate (games a second), else the default. */
function lastRate(sources: readonly RecordedEvent[]): { gamesPerSecond: number; from: string } {
  const runs = sources.filter(isRun);
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = (runs[i] as { rate?: { games?: number; seconds?: number } }).rate;
    if (r && typeof r.games === 'number' && typeof r.seconds === 'number' && r.games > 0 && r.seconds > 0) return { gamesPerSecond: round2(r.games / r.seconds), from: String(runs[i]!.id) };
  }
  return { gamesPerSecond: DEFAULT_RATE, from: 'default' };
}

export function seriesStatus(d: SeriesData): SeriesStatus {
  const names = d.field.map((x) => x.deck.name);
  const expected = expectedGames({ fit: d.fit, decision: d.decision, field: names, met: meetings(d.rated), seed: seriesSeed(d.nextRun, 0) });
  const rate = lastRate(d.sources);
  const target = new Map(d.decision.eligible.map((e) => [e.deck, e.target]));
  return {
    needed: d.decision.needed,
    why: d.decision.why,
    switches: d.switches,
    simVersion: SIM_VERSION,
    bot: SERIES_BOT,
    games: d.games,
    decks: names.length,
    widest: d.decision.widest ? { deck: d.decision.widest.deck, hw: round2(d.decision.widest.hw) } : null,
    target: d.decision.target,
    over: d.decision.ranges.filter((r) => target.has(r.deck) && r.hw > target.get(r.deck)! + 1e-9).length,
    unrated: d.decision.unrated,
    expectedGames: expected,
    minutes: { estimate: Math.ceil(expected / rate.gamesPerSecond / 60), gamesPerSecond: rate.gamesPerSecond, from: rate.from },
    nextRun: `run-${d.nextRun}`,
  };
}

/** The newest pooled games, to play again before anything new is played (at most `n`, from the newest sources). */
export function replaySample(sources: readonly RecordedEvent[], n: number): ReplayGame[] {
  const out: ReplayGame[] = [];
  const byDate = [...sources].sort((x, y) => String(y.date).localeCompare(String(x.date)));
  // the newest event and the newest run each give their last games, so both kinds of record are checked
  const newest = [byDate.find((e) => isRun(e)), byDate.find((e) => !isRun(e))].filter((e): e is RecordedEvent => !!e);
  const per = Math.max(1, Math.ceil(n / Math.max(1, newest.length)));
  for (const e of newest) {
    const games = [...e.rounds, ...e.bracket].flatMap((p) => p.matches.filter((m) => m.b).flatMap((m) => m.games.map((g) => ({ m, g }))));
    for (const { m, g } of games.slice(-per)) {
      const da = e.decks[m.a];
      const db = e.decks[m.b!];
      if (!da || !db || g.winner === undefined) continue;
      out.push({
        label: `${isRun(e) ? `rating run ${e.id}` : `event ${e.id}`}, ${m.a} vs ${m.b}, seed ${g.seed}, ${g.first === 0 ? m.a : m.b} first`,
        decks: [gameDeck({ name: m.a, legends: da.legends, main: da.main }), gameDeck({ name: m.b!, legends: db.legends, main: db.main })],
        seed: g.seed,
        first: g.first,
        bot: e.bot,
        simVersion: typeof e.simVersion === 'number' ? e.simVersion : undefined,
        expect: { winner: g.winner, turns: g.turns },
      });
    }
  }
  return out.slice(0, n);
}

/** The run file (docs/SERIES.md "Run files"): a match list of best-of-one games, with the series' own fields. */
export function runFile(o: { run: number; date: string; field: readonly LibraryDeck[]; games: readonly SeriesGame[]; before: SeriesDecision; after: SeriesDecision; stopped: 'reached' | 'budget'; switches: SeriesSwitches; seconds: number; threads: number }) {
  const byName = new Map(o.field.map((d) => [d.deck.name, d]));
  const used = [...new Set(o.games.flatMap((g) => [g.a, g.b]))].sort();
  const decks = used.map((n) => byName.get(n)!);
  const manifest = gameRunManifest({
    purpose: 'analysis',
    decks: decks.map((d) => ({ deck: d.deck, file: d.file })),
    fieldMode: 'rating-series',
    bot: SERIES_BOT,
    seedBase: seriesSeed(o.run, 0),
    seatPolicy: 'alternate',
    plannedGames: o.games.length,
    gamesPerPair: null,
    simVersion: SIM_VERSION,
    createdAt: o.date,
    runId: `series:run-${o.run}:${o.date}`,
  });
  // one line of the match list per pick (consecutive games of one pairing), one best-of-one match per game
  const lines: { a: string; b: string; bestOf: 1; times: number }[] = [];
  for (const g of o.games) {
    const last = lines[lines.length - 1];
    if (last && last.a === g.a && last.b === g.b && last.times < 10) last.times++;
    else lines.push({ a: g.a, b: g.b, bestOf: 1, times: 1 });
  }
  const summary = (d: SeriesDecision) => {
    const target = new Map(d.eligible.map((e) => [e.deck, e.target]));
    return { widest: d.widest ? round2(d.widest.hw) : null, deck: d.widest?.deck ?? null, over: d.ranges.filter((r) => r.hw > (target.get(r.deck) ?? o.switches.width) + 1e-9).length, unrated: d.unrated.length };
  };
  return {
    kind: RATING_RUN_KIND,
    schema: 1 as const,
    id: `run-${o.run}`,
    name: `Rating run ${o.run}`,
    date: o.date,
    bot: SERIES_BOT,
    format: `Rating run: ${o.games.length} games`,
    config: { name: `Rating run ${o.run}`, rounds: 1, top: 0, bestOf: 1, bot: SERIES_BOT, seed: seriesSeed(o.run, 0) },
    decks: Object.fromEntries(decks.map((d) => [d.deck.name, { id: manifest.decks.find((x) => x.name === d.deck.name)!.id, file: d.file, legends: [...d.deck.legends], main: [...d.deck.main], ...(d.deck.sideboard?.length ? { sideboard: [...d.deck.sideboard] } : {}) }])),
    rounds: [
      {
        round: 1,
        matches: o.games.map((g) => ({
          a: g.a,
          b: g.b,
          games: [{ seed: g.seed, first: g.first, winner: g.winner, turns: g.turns, reason: g.reason }],
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
    rule: { target: 'widest-half-width', width: o.switches.width, level: 0.9, series: o.switches.series, arrivals: o.switches.arrivals },
    why: o.before.why,
    before: summary(o.before),
    after: summary(o.after),
    stopped: o.stopped,
    rate: { games: o.games.length, seconds: Math.round(o.seconds), threads: o.threads },
  };
}

const FLAGS = {
  json: bool(),
  config: str('public/site-config.json'),
  minutes: int(240, { min: 1, max: 600 }),
  'max-games': int(undefined, { min: 1, max: RUN_SEED_SPAN }),
  threads: int(4, { min: 1, max: 64 }),
  'dry-run': bool(),
  replay: int(REPLAY_SAMPLE, { min: 0, max: 50 }),
  out: str(),
};

/** The command: `status [--json]` or `run [...]`. Returns the exit code. */
export async function seriesCommand(argv: string[], io: SeriesIO): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    io.out(usageOf(new URL('./series.ts', import.meta.url).href));
    return EXIT.done;
  }
  let V: ReturnType<typeof parseArgs<typeof FLAGS>>['values'];
  let cmd: string;
  try {
    const p = parseArgs(FLAGS, argv, { minPositionals: 1, maxPositionals: 1 });
    V = p.values;
    cmd = p.positionals[0]!;
    if (cmd !== 'status' && cmd !== 'run') throw new ArgError(`unknown command "${cmd}" (status or run)`);
    if (cmd === 'status' && (V['dry-run'] || V.out || V['max-games'] !== undefined)) throw new ArgError('status takes --json and --config only');
  } catch (e) {
    if (!(e instanceof ArgError)) throw e;
    io.err(`error: ${e.message}\nRun with --help for usage.`);
    return EXIT.usage;
  }
  let data: SeriesData;
  try {
    data = loadSeries(io, V.config);
  } catch (e) {
    if (!(e instanceof ArgError)) throw e;
    io.err(`error: ${e.message}`);
    return EXIT.error;
  }
  if (cmd === 'status') {
    const s = seriesStatus(data);
    if (V.json) io.out(JSON.stringify(s, null, 1));
    else {
      io.out(`${s.needed ? 'A run is needed' : 'Nothing to play'} (sim v${s.simVersion}, ${s.bot} bot, ${s.games} pooled games, ${s.decks} decks; widest ${s.widest ? `${s.widest.deck} ±${s.widest.hw}` : 'none'}, target ±${s.target}).`);
      for (const w of s.why) io.out(`  ${w}`);
      if (s.needed) io.out(`  Expected: about ${s.expectedGames} games, ${s.minutes.estimate} minutes at ${s.minutes.gamesPerSecond} games a second (${s.minutes.from === 'default' ? 'an assumed rate' : `the rate of ${s.minutes.from}`}); the next run is ${s.nextRun}.`);
    }
    return EXIT.done;
  }

  // ---- run
  const d = data;
  for (const w of d.decision.why) io.out(w);
  if (!d.decision.needed) return EXIT.done;
  if (seriesSeed(d.nextRun, RUN_SEED_SPAN - 1) >= 2 ** 31) {
    io.err(`error: run ${d.nextRun} would play seeds at or past 2^31 (docs/SERIES.md "Seeds"); nothing runs.`);
    return EXIT.error;
  }
  if (V.replay > 0) {
    const sample = replaySample(d.sources, V.replay);
    if (sample.length) {
      io.out(`Playing ${sample.length} recorded game(s) again first (the code must still play them as recorded)…`);
      const problem = await io.replay(sample);
      if (problem) {
        io.err(`refused: ${problem} The code plays differently from the recorded games of simulator version ${SIM_VERSION}: bump SIM_VERSION if that was meant (src/lib/tournament.ts), or find the change. Nothing was played or written.`);
        return EXIT.replayRefused;
      }
    } else io.out(`No recorded game on simulator version ${SIM_VERSION} to play again (a fresh version): the game corpus test is the check.`);
  }
  const maxGames = Math.min(V['max-games'] ?? d.switches.maxGamesPerRun, d.switches.maxGamesPerRun, RUN_SEED_SPAN);
  const t0 = io.now();
  const byName = new Map(d.field.map((x) => [x.deck.name, gameDeck(x.deck)]));
  let played = 0;
  const outcome = await runSeries({
    run: d.nextRun,
    input: { games: d.rated, field: d.field.map((x) => x.deck.name), switches: d.switches },
    maxGames,
    outOfTime: () => io.now() - t0 >= V.minutes * 60_000,
    play: async (jobs) => {
      const r = await io.play(
        jobs.map((j) => ({ ...j, decks: [byName.get(j.a)!, byName.get(j.b)!] as [DeckList, DeckList] })),
        V.threads,
      );
      played += jobs.length;
      const secs = (io.now() - t0) / 1000;
      io.out(`  ${played} games, ${secs.toFixed(0)} s${secs > 0 ? ` (${(played / secs).toFixed(2)} games a second)` : ''}`);
      return r;
    },
    chunk: SERIES_CHUNK,
  });
  if (outcome.stopped === 'nothing-needed') return EXIT.done;
  const seconds = (io.now() - t0) / 1000;
  const date = new Date(io.now()).toISOString();
  const file = runFile({ run: d.nextRun, date, field: d.field, games: outcome.games, before: outcome.before, after: outcome.after, stopped: outcome.stopped, switches: d.switches, seconds, threads: V.threads });
  const text = JSON.stringify(file);
  const target = path.join(V.out ?? io.dirs?.series ?? SERIES_DIR, `run-${d.nextRun}.json`);
  const w = outcome.after.widest;
  io.out(
    `Run ${d.nextRun}: ${outcome.games.length} games in ${seconds.toFixed(0)} s (${seconds > 0 ? (outcome.games.length / seconds).toFixed(2) : '?'} games a second, ${V.threads} threads); widest ${outcome.before.widest ? `±${outcome.before.widest.hw.toFixed(2)}` : '?'} → ${w ? `±${w.hw.toFixed(2)} (${w.deck})` : '?'}; ${outcome.stopped === 'reached' ? 'the rule holds' : 'stopped at its budget: the next run carries on'}.`,
  );
  if (V['dry-run']) io.out(`--dry-run: would write ${target} (${text.length} bytes); nothing written.`);
  else {
    io.write(target, text);
    io.out(`wrote ${target}; now rebuild: npx tsx scripts/ratings.ts, npx tsx scripts/build-h2h.ts, npx tsx scripts/build-evidence.ts, then the checks.`);
  }
  return outcome.stopped === 'reached' ? EXIT.done : EXIT.budget;
}
