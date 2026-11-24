// The logic of scripts/series.ts (docs/SERIES.md): read the switches, the series field and the pooled games, decide,
// and run the series with the player and the replay check handed in (the tests hand in stubs; the command hands in the
// worker pool and src/lib/watchGame.ts). The rule itself is src/lib/seriesPlan.ts. Since 2026-11-24 a run also counts
// its games' card impact as they arrive (the player returns each game's trace summaries; src/lib/seriesImpact.ts) and
// carries it in the run file, and `impact` adds the runs that carry it to the season breeder's card tables.
import path from 'node:path';
import { ArgError, bool, int, isRun, loadLibrary, maxRunId, parseArgs, readPooled, runFiles, str, usageOf, EVENTS_DIR, RATING_RUN_KIND, SERIES_DIR, type RecordedEvent } from './lib-node';
import { fieldPool } from './tournament-setup';
import { currentListGate, selectEvents } from './event-pool';
import { distinctLists } from '../src/lib/distinctLists';
import { ratedGamesOf } from '../src/lib/ratingGames';
import type { RatedGame } from '../src/lib/ratingModel';
import { decide, expectedGames, meetings, RUN_SEED_SPAN, runSeries, SERIES_BOT, SERIES_CHUNK, seriesFit, seriesSeed, type BlockState, type RunOutcome, type SeriesDecision, type SeriesGame, type SeriesJob, type SeriesResult, type SeriesSwitches } from '../src/lib/seriesPlan';
import { addRunImpact, ImpactCounter, readRunImpact, type RunImpact, type RunWithImpact, type SummaryLike } from '../src/lib/seriesImpact';
import { emptyCardImpact, parseCardImpact } from '../src/lib/seasonImpact';
import { emptyDeckImpact, parseDeckImpact } from '../src/lib/seasonDeckImpact';
import { listFingerprint } from '../src/engine/deck';
import { CARD_BY_ID } from '../src/engine/cards';
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
  /** append to a file (GitHub's $GITHUB_OUTPUT and $GITHUB_STEP_SUMMARY) */
  append: (file: string, text: string) => void;
  /** milliseconds, for the time budget and the rate */
  now: () => number;
  /**
   * play games (the worker pool, or a stub in the tests); a result may carry both seats' trace summaries, and when every
   * game of a run does, the run counts and carries their card impact
   */
  play: (jobs: readonly (SeriesJob & { decks: [DeckList, DeckList]; trace?: boolean })[], threads: number) => Promise<(SeriesResult & { summaries?: readonly SummaryLike[] })[]>;
  /** play recorded games again; the first that ends differently, as a sentence naming it, or null */
  replay: (games: readonly ReplayGame[]) => Promise<string | null>;
  /** the checkout's directories (defaults: the repository's; seasons: the card tables' folder, data/seasons) */
  dirs?: { events?: string; series?: string; decks?: string; seasons?: string };
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
  switches: Required<SeriesSwitches> & { maxGamesPerRun: number };
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
  /** the matchup block: its decks (by rating now), target, pairs, pairs at the target, games to go (null: off) */
  block: BlockState | null;
  /** the width rule's expected games plus the block's games to go */
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
  const switches = { series: a.series, arrivals: a.arrivals, width: a.width, maxGamesPerRun: a.maxGamesPerRun, matchups: a.matchups, matchupDecks: a.matchupDecks, matchupGames: a.matchupGames };
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
  const expected = expectedGames({ fit: d.fit, decision: d.decision, field: names, met: meetings(d.rated), seed: seriesSeed(d.nextRun, 0) }) + (d.decision.block?.games ?? 0);
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
    block: d.decision.block,
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
export function runFile(o: { run: number; date: string; field: readonly LibraryDeck[]; games: readonly SeriesGame[]; before: SeriesDecision; after: SeriesDecision; stopped: 'reached' | 'budget'; switches: SeriesSwitches; seconds: number; threads: number; block?: RunOutcome['block']; impact?: RunImpact | null }) {
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
    rule: { target: 'widest-half-width', width: o.switches.width, level: 0.9, series: o.switches.series, arrivals: o.switches.arrivals, ...(o.switches.matchups ? { matchups: o.switches.matchups, matchupDecks: o.switches.matchupDecks, matchupGames: o.switches.matchupGames } : {}) },
    why: o.before.why,
    before: summary(o.before),
    after: summary(o.after),
    stopped: o.stopped,
    rate: { games: o.games.length, seconds: Math.round(o.seconds), threads: o.threads },
    // the matchup block this run played: its decks (best first, fixed when it started), target, and pairs at it before and after
    ...(o.block ? { block: { decks: o.block.start.decks, target: o.block.start.target, pairs: o.block.start.pairs, before: { done: o.block.start.done, games: o.block.start.games }, after: { done: o.block.end.done, games: o.block.end.games } } } : {}),
    // the games' card impact, for the season breeder's tables (src/lib/seriesImpact.ts; added by `series.ts impact`)
    ...(o.impact ? { impact: o.impact } : {}),
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
  'github-output': str(),
  summary: str(),
  'no-trace': bool(),
};

/** A run's own games to play again (verify): the first, the last and some between, at most `n`. */
export function runSample(run: RecordedEvent, n: number): ReplayGame[] {
  const games = [...run.rounds, ...run.bracket].flatMap((p) => p.matches.filter((m) => m.b).flatMap((m) => m.games.map((g) => ({ m, g }))));
  if (!games.length || n <= 0) return [];
  const picks = n === 1 ? [games.length - 1] : [...new Set(Array.from({ length: Math.min(n, games.length) }, (_, i) => Math.round((i * (games.length - 1)) / Math.max(1, Math.min(n, games.length) - 1))))];
  return picks.flatMap((q) => {
    const { m, g } = games[q]!;
    const da = run.decks[m.a];
    const db = run.decks[m.b!];
    if (!da || !db) return [];
    return [
      {
        label: `rating run ${run.id}, ${m.a} vs ${m.b}, seed ${g.seed}, ${g.first === 0 ? m.a : m.b} first`,
        decks: [gameDeck({ name: m.a, legends: da.legends, main: da.main }), gameDeck({ name: m.b!, legends: db.legends, main: db.main })] as [DeckList, DeckList],
        seed: g.seed,
        first: g.first,
        bot: run.bot,
        simVersion: typeof run.simVersion === 'number' ? run.simVersion : undefined,
        expect: { winner: g.winner, turns: g.turns },
      },
    ];
  });
}

/**
 * `verify <run file>`: the run was played by this code. Refuses (exit 4, naming the game) when its simulator version is
 * not the code's, or when one of its own games, played again through Watch's replay, ends differently (the code changed
 * play while the run was playing). Exit 1 when the file cannot be read as a rating run.
 */
async function verifyRun(file: string, replay: number, io: SeriesIO): Promise<number> {
  const text = io.read(file);
  let run: RecordedEvent;
  try {
    if (text === null) throw new Error('it does not exist');
    run = JSON.parse(text) as RecordedEvent;
    if (run.kind !== RATING_RUN_KIND || !Array.isArray(run.rounds) || !run.decks) throw new Error(`it is not a rating run (kind ${JSON.stringify(run.kind)})`);
  } catch (e) {
    io.err(`error: ${file} cannot be read as a rating run: ${(e as Error).message}.`);
    return EXIT.error;
  }
  if (run.simVersion !== SIM_VERSION) {
    io.err(`refused: ${file} was played on simulator version ${JSON.stringify(run.simVersion)}, and this code is version ${SIM_VERSION}; its games would be pooled with games of another version. Nothing to commit.`);
    return EXIT.replayRefused;
  }
  const sample = runSample(run, replay);
  if (sample.length) {
    const problem = await io.replay(sample);
    if (problem) {
      io.err(`refused: ${problem} This code does not play the run's games as they were played: the code changed while the run was playing, without a SIM_VERSION bump. Nothing to commit.`);
      return EXIT.replayRefused;
    }
  }
  io.out(`${file}: simulator version ${SIM_VERSION}${sample.length ? `, and ${sample.length} of its games replay as recorded` : ''}.`);
  return EXIT.done;
}

const md = (t: string) => t.replace(/[<>]/g, '');

/** A chunk's pairings in one line: "A vs B ×10, …" (consecutive games of a pairing together, seats either way). */
export function pairsLine(jobs: readonly { a: string; b: string }[]): string {
  const out: { a: string; b: string; n: number }[] = [];
  for (const j of jobs) {
    const last = out[out.length - 1];
    if (last && last.a === j.a && last.b === j.b) last.n++;
    else out.push({ a: j.a, b: j.b, n: 1 });
  }
  return out.map((x) => `${x.a} vs ${x.b} ×${x.n}`).join(', ');
}

export const CARD_IMPACT_PATH = 'impact.json';
export const DECK_IMPACT_PATH = 'deck-impact.json';

/**
 * `impact [--dry-run]`: add every recorded run that carries card impact (src/lib/seriesImpact.ts) to the season breeder's
 * two tables, each file only where it does not count that run yet, in the entry of the run's simulator version and bot.
 * Exit 0 (nothing to add is fine), 1 when a run's block is malformed, a table cannot be read, or a table counts a run
 * under another run id (nothing is written).
 */
function impactCommand(io: SeriesIO, dry: boolean): number {
  const dir = io.dirs?.series ?? SERIES_DIR;
  const seasons = io.dirs?.seasons ?? 'data/seasons';
  const cardPath = path.join(seasons, CARD_IMPACT_PATH);
  const deckPath = path.join(seasons, DECK_IMPACT_PATH);
  try {
    const parse = <T>(file: string, text: string | null, parser: (raw: unknown) => { problem?: string; file?: T }, empty: () => T): T => {
      if (text === null) return empty();
      const r = parser(JSON.parse(text));
      if (!r.file) throw new Error(`${file} ${r.problem}`);
      return r.file;
    };
    const card = parse(cardPath, io.read(cardPath), parseCardImpact, emptyCardImpact);
    const deck = parse(deckPath, io.read(deckPath), parseDeckImpact, emptyDeckImpact);
    const runs = runsWithImpact(io, dir);
    const lines: string[] = [];
    for (const r of runs) {
      const added = addRunImpact(card, deck, r);
      if (added.card || added.deck)
        lines.push(`rating ${r.id} (${r.impact.games} games, ${r.impact.decks.length} decks): added to ${[added.card ? 'impact.json' : '', added.deck ? 'deck-impact.json' : ''].filter(Boolean).join(' and ')}, simulator version ${r.simVersion}, ${r.bot} bot`);
    }
    for (const l of lines) io.out(l);
    if (!lines.length) {
      io.out(`Nothing to add: ${runs.length ? `the card tables count every run that carries card impact (${runs.map((r) => r.id).join(', ')})` : 'no recorded run carries card impact'}.`);
      return EXIT.done;
    }
    if (dry) io.out(`--dry-run: ${cardPath} and ${deckPath} not written.`);
    else {
      io.write(cardPath, JSON.stringify(card));
      io.write(deckPath, JSON.stringify(deck));
      io.out(`wrote ${cardPath} and ${deckPath}.`);
    }
    return EXIT.done;
  } catch (e) {
    io.err(`error: ${(e as Error).message}`);
    return EXIT.error;
  }
}

/** The recorded runs that carry card impact, in run order; a malformed block throws, naming the file. */
export function runsWithImpact(io: Pick<SeriesIO, 'read'>, dir: string): RunWithImpact[] {
  const out: RunWithImpact[] = [];
  for (const f of runFiles(dir)) {
    const run = JSON.parse(io.read(path.join(dir, f)) ?? 'null') as { id?: unknown; simVersion?: unknown; bot?: unknown; manifest?: { runId?: unknown }; impact?: unknown } | null;
    if (!run || run.impact === undefined) continue;
    const r = readRunImpact(run.impact);
    if (!r.impact) throw new Error(`${path.join(dir, f)}: its card impact ${r.problem}`);
    if (typeof run.id !== 'string' || typeof run.simVersion !== 'number' || typeof run.bot !== 'string' || typeof run.manifest?.runId !== 'string') throw new Error(`${path.join(dir, f)}: a run that carries card impact needs its id, simulator version, bot and manifest run id`);
    out.push({ id: run.id, runId: run.manifest.runId, simVersion: run.simVersion, bot: run.bot, impact: r.impact });
  }
  return out;
}

/** The command: `status [--json]` or `run [...]`. Returns the exit code. */
export async function seriesCommand(argv: string[], io: SeriesIO): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    io.out(usageOf(new URL('./series.ts', import.meta.url).href));
    return EXIT.done;
  }
  let V: ReturnType<typeof parseArgs<typeof FLAGS>>['values'];
  let cmd: string;
  try {
    const p = parseArgs(FLAGS, argv, { minPositionals: 1, maxPositionals: 2 });
    V = p.values;
    cmd = p.positionals[0]!;
    if (cmd !== 'status' && cmd !== 'run' && cmd !== 'verify' && cmd !== 'impact') throw new ArgError(`unknown command "${cmd}" (status, run, verify or impact)`);
    if (cmd === 'verify' ? p.positionals.length !== 2 : p.positionals.length !== 1) throw new ArgError(cmd === 'verify' ? 'verify takes one run file' : `${cmd} takes no file`);
    if (cmd === 'status' && (V['dry-run'] || V.out || V['max-games'] !== undefined || V['no-trace'])) throw new ArgError('status takes --json, --config, --github-output and --summary only');
    if (cmd === 'impact' && (V.out || V['max-games'] !== undefined || V['no-trace'] || V.json)) throw new ArgError('impact takes --dry-run only');
    if (cmd === 'verify') return await verifyRun(p.positionals[1]!, V.replay, io);
    if (cmd === 'impact') return impactCommand(io, V['dry-run']);
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
    if (V['github-output']) io.append(V['github-output'], `needed=${s.needed}\n`);
    if (V.summary)
      io.append(
        V.summary,
        `### Rating series: ${s.needed ? 'a run is needed' : 'nothing to play'}\n\n${s.why.map((w) => `- ${md(w)}`).join('\n')}\n\n` +
          `Simulator version ${s.simVersion}, the ${s.bot} bot: ${s.games} pooled games, ${s.decks} decks; widest range ${s.widest ? `±${s.widest.hw} (${md(s.widest.deck)})` : 'none'}, target ±${s.target}, ${s.over} deck(s) over it.` +
          (s.needed ? ` The rule expects about ${s.expectedGames} games: ${s.minutes.estimate} minutes at ${s.minutes.gamesPerSecond} games a second (${s.minutes.from === 'default' ? 'an assumed rate' : `the rate of ${s.minutes.from}`}). The next run is ${s.nextRun}.` : '') +
          '\n\n',
      );
    if (V.json) io.out(JSON.stringify(s, null, 1));
    else {
      io.out(`${s.needed ? 'A run is needed' : 'Nothing to play'} (sim v${s.simVersion}, ${s.bot} bot, ${s.games} pooled games, ${s.decks} decks; widest ${s.widest ? `${s.widest.deck} ±${s.widest.hw}` : 'none'}, target ±${s.target}).`);
      for (const w of s.why) io.out(`  ${w}`);
      if (s.block) io.out(`  The block's decks by rating now (best first): ${s.block.decks.join(', ')}.`);
      if (s.needed) io.out(`  Expected: about ${s.expectedGames} games, ${s.minutes.estimate} minutes at ${s.minutes.gamesPerSecond} games a second (${s.minutes.from === 'default' ? 'an assumed rate' : `the rate of ${s.minutes.from}`}); the next run is ${s.nextRun}.`);
    }
    return EXIT.done;
  }

  // ---- run
  const d = data;
  const report = (written: string | null, stopped: string, lines: string[]) => {
    if (V['github-output']) io.append(V['github-output'], `written=${written !== null}\nfile=${written ?? ''}\nstopped=${stopped}\n`);
    if (V.summary) io.append(V.summary, `### Rating series run${V['dry-run'] ? ' (dry run)' : ''}\n\n${lines.map((l) => `- ${md(l)}`).join('\n')}\n\n`);
  };
  for (const w of d.decision.why) io.out(w);
  if (!d.decision.needed) {
    report(null, 'nothing-needed', d.decision.why);
    return EXIT.done;
  }
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
        const why = `refused: ${problem} The code plays differently from the recorded games of simulator version ${SIM_VERSION}: bump SIM_VERSION if that was meant (src/lib/tournament.ts), or find the change. Nothing was played or written.`;
        io.err(why);
        report(null, 'replay-refused', [why]);
        return EXIT.replayRefused;
      }
    } else io.out(`No recorded game on simulator version ${SIM_VERSION} to play again (a fresh version): the game corpus test is the check.`);
  }
  const maxGames = Math.min(V['max-games'] ?? d.switches.maxGamesPerRun, d.switches.maxGamesPerRun, RUN_SEED_SPAN);
  const t0 = io.now();
  const byName = new Map(d.field.map((x) => [x.deck.name, gameDeck(x.deck)]));
  const fingerprints = new Map(d.field.map((x) => [x.deck.name, listFingerprint(x.deck)]));
  // card impact, counted as the games arrive; given up (no block in the run file) as soon as one game has no summaries
  let counter: ImpactCounter | null = V['no-trace'] ? null : new ImpactCounter((id) => CARD_BY_ID[id]?.type === 'Legend');
  let played = 0;
  const outcome = await runSeries({
    run: d.nextRun,
    input: { games: d.rated, field: d.field.map((x) => x.deck.name), switches: d.switches },
    maxGames,
    outOfTime: () => io.now() - t0 >= V.minutes * 60_000,
    play: async (jobs) => {
      const r = await io.play(
        jobs.map((j) => ({ ...j, decks: [byName.get(j.a)!, byName.get(j.b)!] as [DeckList, DeckList], trace: !!counter })),
        V.threads,
      );
      for (const x of r) {
        if (!counter) break;
        if (x.summaries?.length === 2) counter.add(x.summaries);
        else counter = null;
      }
      if (V['dry-run']) io.out(`  pairs: ${pairsLine(jobs)}`);
      played += jobs.length;
      const secs = (io.now() - t0) / 1000;
      io.out(`  ${played} games, ${secs.toFixed(0)} s${secs > 0 ? ` (${(played / secs).toFixed(2)} games a second)` : ''}`);
      return r;
    },
    chunk: SERIES_CHUNK,
  });
  if (outcome.stopped === 'nothing-needed') {
    report(null, 'nothing-needed', outcome.before.why);
    return EXIT.done;
  }
  const seconds = (io.now() - t0) / 1000;
  const date = new Date(io.now()).toISOString();
  const impact = counter && counter.games === outcome.games.length ? counter.result((name) => fingerprints.get(name)) : null;
  const file = runFile({ run: d.nextRun, date, field: d.field, games: outcome.games, before: outcome.before, after: outcome.after, stopped: outcome.stopped, switches: d.switches, seconds, threads: V.threads, block: outcome.block, impact });
  const text = JSON.stringify(file);
  const target = path.join(V.out ?? io.dirs?.series ?? SERIES_DIR, `run-${d.nextRun}.json`);
  const w = outcome.after.widest;
  const line = `Run ${d.nextRun}: ${outcome.games.length} games in ${seconds.toFixed(0)} s (${seconds > 0 ? (outcome.games.length / seconds).toFixed(2) : '?'} games a second, ${V.threads} threads); widest ${outcome.before.widest ? `±${outcome.before.widest.hw.toFixed(2)}` : '?'} → ${w ? `±${w.hw.toFixed(2)} (${w.deck})` : '?'}; ${outcome.stopped === 'reached' ? 'the rule holds' : 'stopped at its budget: the next run carries on'}.`;
  io.out(line);
  const b = outcome.block;
  const blockLine = b ? `Matchup block (${b.start.decks.length} decks, ${b.start.pairs} pairs, ${b.start.target} games a pair): ${b.start.done} → ${b.end.done} pairs at the target, ${b.end.games} games to go.` : null;
  if (blockLine) io.out(blockLine);
  io.out(impact ? `Card impact traced: ${impact.decks.length} decks, ${impact.decks.reduce((s, x) => s + x.cards.length, 0)} card figures (added to data/seasons by npx tsx scripts/series.ts impact).` : 'Card impact: not traced (the run file carries none).');
  if (V['dry-run']) {
    io.out(`--dry-run: would write ${target} (${text.length} bytes); nothing written.`);
    report(null, outcome.stopped, [...outcome.before.why, line, ...(blockLine ? [blockLine] : []), `Dry run: would write ${target} (${text.length} bytes); nothing written.`]);
  } else {
    io.write(target, text);
    io.out(`wrote ${target}; now rebuild: npx tsx scripts/ratings.ts, npx tsx scripts/build-h2h.ts, npx tsx scripts/series.ts impact, npx tsx scripts/build-evidence.ts, then the checks.`);
    report(target.split(path.sep).join('/'), outcome.stopped, [...outcome.before.why, line, ...(blockLine ? [blockLine] : []), `Wrote ${target.split(path.sep).join('/')}.`]);
  }
  return outcome.stopped === 'reached' ? EXIT.done : EXIT.budget;
}
