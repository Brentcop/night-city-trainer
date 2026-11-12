// Shared helpers for the Node scripts: deck library, strict CLI flags, one worker pool, recorded-event iteration,
// slugs, deck-file provenance headers and change-only writes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs as nodeParseArgs } from 'node:util';
import { Worker } from 'node:worker_threads';
import { LIBRARY_DIRS, libraryDeck, type LibraryDeck } from '../src/lib/library';
import { parseDeck } from '../src/engine/deck';
import type { MatchJob, MatchResult } from './worker';
import { WorkPool, type PooledWorker, type WorkerLink } from '../src/lib/workPool';
import { entrantBase, type EventSetup } from '../src/lib/eventFormats';

// ================================================================ deck library

/** The deck library (LIBRARY_DIRS, src/lib/library.ts): data/decks/*.txt, then data/decks/custom/*.txt, each by file name. */
export function loadLibrary(dir = 'data/decks'): LibraryDeck[] {
  const out: LibraryDeck[] = [];
  for (const sub of LIBRARY_DIRS) {
    const d = path.join(dir, sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.txt')).sort()) {
      const deck = libraryDeck(sub ? `${sub}/${f}` : f, fs.readFileSync(path.join(d, f), 'utf8'));
      if (deck) out.push(deck);
    }
  }
  return out;
}

/** Resolve a deck by file name fragment, deck name fragment, or a path to a deck text file. */
export function resolveDeck(q: string, lib = loadLibrary()): LibraryDeck {
  if (fs.existsSync(q) && fs.statSync(q).isFile()) {
    const txt = fs.readFileSync(q, 'utf8');
    return { file: path.basename(q), deck: parseDeck(txt, path.basename(q)).deck, kind: 'custom', prov: { origin: 'Custom (file)' } };
  }
  const ql = q.toLowerCase().replace(/.txt$/, '');
  const f = (d: LibraryDeck) => d.file.toLowerCase().replace(/\.txt$/, '');
  const hit =
    lib.find((d) => f(d) === ql || d.deck.name.toLowerCase() === ql) ??
    lib.find((d) => d.kind === 'meta' && (f(d).includes(ql) || d.deck.name.toLowerCase().includes(ql))) ??
    lib.find((d) => d.kind === 'custom' && (f(d).includes(ql) || d.deck.name.toLowerCase().includes(ql))) ??
    lib.find((d) => f(d).includes(ql) || d.deck.name.toLowerCase().includes(ql));
  if (!hit) throw new Error(`No deck matches "${q}". Try: npm run sim -- catalog`);
  return hit;
}

/** File-name slug for a deck name: lower case, runs of other characters become one dash, no dash at either end. */
export function slugify(name: string, max = Infinity): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
}

// ================================================================ CLI flags

/** A bad command line. `cli()` prints the message and exits with code 2 before the script does any work. */
export class ArgError extends Error {}
/** A run the script refuses to do (e.g. it would overwrite recorded data); runMain prints just the message. */
export class Refusal extends Error {}

interface IntOpt<D> {
  type: 'int';
  default: D;
  min?: number;
  max?: number;
}
interface NumOpt<D> {
  type: 'number';
  default: D;
  min?: number;
  max?: number;
}
interface StrOpt<D> {
  type: 'string';
  default: D;
  /** return an error message for an invalid value */
  check?: (v: string) => string | void;
}
interface EnumOpt<C extends string, D> {
  type: 'enum';
  choices: readonly C[];
  default: D;
}
interface BoolOpt {
  type: 'boolean';
}
/** A string flag that may be given more than once (`--pair "A vs B" --pair "C vs D"`); its value is every one, in order. */
interface ListOpt {
  type: 'strings';
}
export type Opt = IntOpt<number | undefined> | NumOpt<number | undefined> | StrOpt<string | undefined> | EnumOpt<string, string | undefined> | BoolOpt | ListOpt;
export type Spec = Record<string, Opt>;

/** Flag builders: `int(12, { min: 1 })`, `oneOf(['meta', 'all'], 'meta')`, `str()`, `bool()`. */
export const int = <D extends number | undefined = undefined>(def?: D, o: { min?: number; max?: number } = {}): IntOpt<D> => ({ type: 'int', default: def as D, ...o });
export const num = <D extends number | undefined = undefined>(def?: D, o: { min?: number; max?: number } = {}): NumOpt<D> => ({ type: 'number', default: def as D, ...o });
export const str = <D extends string | undefined = undefined>(def?: D, check?: (v: string) => string | void): StrOpt<D> => ({ type: 'string', default: def as D, check });
export const oneOf = <const C extends string, D extends C | undefined = undefined>(choices: readonly C[], def?: D): EnumOpt<C, D> => ({ type: 'enum', choices, default: def as D });
export const bool = (): BoolOpt => ({ type: 'boolean' });
export const many = (): ListOpt => ({ type: 'strings' });

type ValueOf<O> = O extends BoolOpt
  ? boolean
  : O extends ListOpt
    ? string[]
    : O extends IntOpt<infer D> | NumOpt<infer D>
    ? D extends number ? number : number | undefined
    : O extends EnumOpt<infer C, infer D>
      ? D extends string ? C : C | undefined
      : O extends StrOpt<infer D>
        ? D extends string ? string : string | undefined
        : never;
export type Values<S extends Spec> = { [K in keyof S]: ValueOf<S[K]> };

export interface ParseOptions {
  /** how many positional arguments the command takes (default: none) */
  minPositionals?: number;
  maxPositionals?: number;
}

/**
 * Strict flag parsing on top of node:util parseArgs. Unknown flags, missing values, non-integers, numbers out of range
 * and values outside an enum all throw ArgError, so a typo never runs (or writes) anything.
 * `--name value` and `--name=value` both work; booleans take no value.
 */
export function parseArgs<S extends Spec>(spec: S, argv: string[], o: ParseOptions = {}): { values: Values<S>; positionals: string[] } {
  const options: Record<string, { type: 'string' | 'boolean'; multiple?: boolean }> = {};
  for (const [k, v] of Object.entries(spec)) options[k] = v.type === 'strings' ? { type: 'string', multiple: true } : { type: v.type === 'boolean' ? 'boolean' : 'string' };
  let parsed: { values: Record<string, string | boolean | string[] | undefined>; positionals: string[] };
  try {
    parsed = nodeParseArgs({ args: argv, options, strict: true, allowPositionals: true }) as typeof parsed;
  } catch (e) {
    const code = (e as { code?: string }).code;
    const msg = (e as Error).message;
    if (code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
      const flag = msg.match(/'([^']+)'/)?.[1] ?? msg;
      const known = Object.keys(spec).map((k) => `--${k}`);
      throw new ArgError(`unknown option ${flag}${known.length ? `. Options: ${known.join(', ')}` : ' (this command takes no options)'}`);
    }
    if (code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') throw new ArgError(msg.replace(/^Option '([^']+)'.*?argument (is )?(missing|ambiguous).*$/s, (_m, f, _i, w) => `option ${f.replace(/ <value>$/, '')} needs a value${w === 'ambiguous' ? ' (it looks like another option)' : ''}`));
    throw new ArgError(msg);
  }
  const values: Record<string, unknown> = {};
  for (const [k, opt] of Object.entries(spec)) {
    const raw = parsed.values[k];
    if (opt.type === 'boolean') {
      values[k] = raw === true;
      continue;
    }
    if (opt.type === 'strings') {
      values[k] = Array.isArray(raw) ? raw.map(String) : raw === undefined ? [] : [String(raw)];
      continue;
    }
    if (raw === undefined) {
      values[k] = opt.default;
      continue;
    }
    const s = String(raw);
    if (opt.type === 'int' || opt.type === 'number') {
      const ok = opt.type === 'int' ? /^-?\d+$/.test(s.trim()) : s.trim() !== '' && Number.isFinite(Number(s));
      const n = Number(s);
      if (!ok) throw new ArgError(`--${k} must be ${opt.type === 'int' ? 'a whole number' : 'a number'}, got "${s}"`);
      if (opt.min !== undefined && n < opt.min) throw new ArgError(`--${k} must be at least ${opt.min}, got ${n}`);
      if (opt.max !== undefined && n > opt.max) throw new ArgError(`--${k} must be at most ${opt.max}, got ${n}`);
      values[k] = n;
    } else if (opt.type === 'enum') {
      if (!opt.choices.includes(s)) throw new ArgError(`--${k} must be one of ${opt.choices.join(' | ')}, got "${s}"`);
      values[k] = s;
    } else {
      const err = opt.check?.(s);
      if (err) throw new ArgError(`--${k}: ${err}`);
      values[k] = s;
    }
  }
  const pos = parsed.positionals;
  const min = o.minPositionals ?? 0;
  const max = o.maxPositionals ?? 0;
  if (pos.length < min) throw new ArgError(`expected ${min === max ? min : `at least ${min}`} argument${min === 1 ? '' : 's'}, got ${pos.length}`);
  if (pos.length > max) throw new ArgError(max ? `too many arguments (at most ${max}): ${pos.join(' ')}` : `unexpected argument "${pos[0]}" (this command takes only --options)`);
  return { values: values as Values<S>, positionals: pos };
}

/** The leading `//` comment block of a script, used as its --help text. */
export function usageOf(scriptUrl: string): string {
  const lines = fs.readFileSync(new URL(scriptUrl), 'utf8').split(/\r?\n/);
  const out: string[] = [];
  for (const l of lines) {
    if (!l.startsWith('//')) break;
    out.push(l.replace(/^\/\/ ?/, ''));
  }
  return out.join('\n');
}

/**
 * parseArgs for a script entry point: `--help` prints the script's header comment; a bad flag prints the reason and
 * exits with code 2 before anything is read or written.
 */
export function cli<S extends Spec>(scriptUrl: string, spec: S, o: ParseOptions & { argv?: string[] } = {}): { values: Values<S>; positionals: string[] } {
  const argv = o.argv ?? process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usageOf(scriptUrl));
    process.exit(0);
  }
  try {
    return parseArgs(spec, argv, o);
  } catch (e) {
    if (!(e instanceof ArgError)) throw e;
    console.error(`error: ${e.message}\nRun with --help for usage.`);
    process.exit(2);
  }
}

/** Default --threads: all cores but one, at most 16. */
export const defaultThreads = () => Math.max(1, Math.min(os.cpus().length - 1, 16));
export const threadsOpt = () => int(defaultThreads(), { min: 1, max: 64 });

/** Bot names the game worker understands (scripts/worker.ts). */
export const SIM_BOTS = ['easy', 'medium', 'hard', 'hard-v1', 'mixed', 'fast', 'lookahead', 'deep', 'random', 'plain', 'best'] as const;
/** Bot names for tournaments and reviews (src/ai/tiers.ts makeTierBot). */
export const TIER_BOTS = ['easy', 'medium', 'hard', 'hard-v1', 'mixed', 'fast', 'lookahead', 'deep'] as const;

// ================================================================ worker pool

export interface PoolOptions {
  /** times one job may be attempted when its worker crashes (default 2: one retry) */
  maxAttempts?: number;
  /** total worker crashes tolerated before the pool gives up (default 2 × size + 2) */
  maxCrashes?: number;
}
export interface Pool<J, R> {
  run(job: J): Promise<R>;
  close(): Promise<void>;
  /** set once the pool has given up; every pending and later run() rejects with it */
  readonly failed: Error | null;
}

/**
 * A fixed-size pool of worker threads, one job per message, one reply per job (a WorkPool, src/lib/workPool.ts, with a
 * worker_threads adapter).
 * A worker that crashes (uncaught error or unexpected exit) is replaced and its in-flight job is queued again; a job
 * that keeps crashing workers, or too many crashes overall, is fatal: every worker is terminated and every pending
 * job rejects. Pass a URL to a worker script, or a factory (tests use eval workers).
 */
export function workerPool<J, R>(source: URL | (() => Worker), size: number, o: PoolOptions = {}): Pool<J, R> {
  const make = typeof source === 'function' ? source : () => new Worker(source);
  const maxCrashes = o.maxCrashes ?? 2 * size + 2;
  const spawn = (link: WorkerLink<R>): PooledWorker<J> => {
    const w = make();
    let lastError: Error | undefined;
    w.on('message', (r: R) => link.done(r));
    w.on('error', (e) => (lastError = e));
    w.on('messageerror', (e) => (lastError = e));
    w.on('exit', (code) => link.died(lastError ? String(lastError.stack ?? lastError) : `worker exited with code ${code}`));
    return { post: (job) => w.postMessage(job), terminate: () => w.terminate() };
  };
  const pool = new WorkPool<J, R>(spawn, size, {
    maxAttempts: o.maxAttempts ?? 2,
    crashLimit: () => maxCrashes,
    resetCrashesOnDone: false,
    jobFailureIsFatal: true,
    jobFailed: (why, attempts) => new Error(`a job crashed its worker ${attempts} times; giving up.\n${why}`),
    gaveUp: (why, crashes) => new Error(`${crashes} worker crashes; giving up.\n${why}`),
    refused: (failed) => failed ?? new Error('worker pool is closed'),
    onRestart: (why, retrying) => {
      process.stderr.write(`\n  worker crashed (${why.split('\n')[0]}); restarting it${retrying ? ' and retrying its job' : ''}\n`);
    },
  });
  return {
    run: (job: J) => pool.run(job),
    async close() {
      await pool.stop(new Error('worker pool closed'), 'abandon');
    },
    get failed() {
      return pool.failed;
    },
  };
}

const GAME_WORKER = new URL('./worker-boot.mjs', import.meta.url);

/** Thrown by runJobs when games threw: their results would otherwise count as ties and drag every deck toward 50%. */
export class GameErrors extends Error {
  constructor(
    public errors: MatchResult[],
    public total: number,
  ) {
    super(`${errors.length} of ${total} games threw an error (first: ${errors[0].a} vs ${errors[0].b}, seed ${errors[0].seed}); no results were recorded.`);
  }
}

export interface RunJobsOptions {
  threads: number;
  /** return the good results (and the errors) instead of throwing GameErrors; the exit code is still set to 1 */
  allowErrors?: boolean;
  quiet?: boolean;
  /** called with each result as it arrives (in completion order), before it is kept: e.g. to fold a bulky field into a running total and drop it */
  onResult?: (r: MatchResult) => void;
}

/** Play every job in the game worker pool. Results come back in job order; games that threw are reported, never counted. */
export async function runJobsDetailed(jobs: MatchJob[], o: RunJobsOptions): Promise<{ results: MatchResult[]; errors: MatchResult[] }> {
  if (!jobs.length) return { results: [], errors: [] };
  const pool = workerPool<MatchJob, MatchResult>(GAME_WORKER, Math.min(o.threads, jobs.length));
  const t0 = Date.now();
  let done = 0;
  try {
    const all = await Promise.all(
      jobs.map((j) =>
        pool.run(j).then((r) => {
          done++;
          if (!r.error) o.onResult?.(r);
          if (!o.quiet && (done % 10 === 0 || done === jobs.length)) process.stderr.write(`\r  ${done}/${jobs.length} games  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
          return r;
        }),
      ),
    );
    if (!o.quiet) process.stderr.write('\n');
    const errors = all.filter((r) => r.error);
    if (errors.length) {
      process.exitCode = 1;
      console.error(`\n${errors.length} of ${all.length} games threw an error. First (${errors[0].a} vs ${errors[0].b}, seed ${errors[0].seed}, first ${errors[0].first}):\n${errors[0].error}`);
    }
    return { results: all.filter((r) => !r.error), errors };
  } finally {
    await pool.close();
  }
}

/** runJobsDetailed that throws GameErrors (after printing the first stack) unless `allowErrors`. */
export async function runJobs(jobs: MatchJob[], o: RunJobsOptions): Promise<MatchResult[]> {
  const { results, errors } = await runJobsDetailed(jobs, o);
  if (errors.length && !o.allowErrors) throw new GameErrors(errors, jobs.length);
  return results;
}

/** Run an async main(): print the error (without a stack for GameErrors/ArgError) and exit 1. */
export function runMain(main: () => Promise<unknown>) {
  main().catch((e) => {
    if (e instanceof GameErrors || e instanceof ArgError || e instanceof Refusal) console.error(`\nerror: ${e.message}`);
    else console.error(e);
    process.exit(1);
  });
}

// ================================================================ recorded tournament events

/** Recorded events live in one place: the site fetches them from here and the scripts read them from here. */
export const EVENTS_DIR = 'public/tournaments';
const EVENT_RE = /^event-(\d+)\.json$/;

/** event-N.json file names in a directory, in numeric order. */
export function eventFiles(dir = EVENTS_DIR): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => EVENT_RE.test(f))
    .sort((a, b) => +a.match(EVENT_RE)![1] - +b.match(EVENT_RE)![1]);
}
/** Highest recorded event id (0 if none) across the given directories. */
export function maxEventId(...dirs: string[]): number {
  let m = 0;
  for (const d of dirs.length ? dirs : [EVENTS_DIR]) for (const f of eventFiles(d)) m = Math.max(m, +f.match(EVENT_RE)![1]);
  return m;
}

/** Loosely typed recorded event (public/tournaments/event-N.json). */
export interface RecordedEvent {
  id: number;
  date: string;
  bot: string;
  format?: unknown;
  champion: string;
  decks: Record<string, { legends: string[]; main: string[] }>;
  rounds: RecordedPart[];
  bracket: RecordedPart[];
  standings: { deck: string; mp: number; mw: number; ml: number; gw: number; gl: number; omw: number }[];
  seeds?: string[];
  /** not a standard event (another format, or pairings/seeds set by hand): games count, titles and finishes don't */
  custom?: true;
  /** how a non-plain event was arranged (src/lib/eventFormats.ts EventSetup) */
  setup?: EventSetup;
  [k: string]: unknown;
}
export interface RecordedPart {
  name?: string;
  matches: RecordedMatch[];
}
export interface RecordedMatch {
  a: string;
  b: string | null;
  games: { seed: number; first: 0 | 1; winner: 0 | 1 | 'tie'; turns: number; reason?: string }[];
  score?: [number, number];
  winner?: string;
}

/** Every recorded event, parsed, in id order. */
export function readEvents(dir = EVENTS_DIR): RecordedEvent[] {
  return eventFiles(dir).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as RecordedEvent);
}

export interface RecordedGame {
  event: RecordedEvent;
  match: RecordedMatch & { b: string };
  game: RecordedMatch['games'][number];
  /** 'swiss': the event's rounds (Swiss, round robin or a match list); 'top': its bracket */
  stage: 'swiss' | 'top';
  /** the library decks the two seats played: an explicit copy "X #2" plays X (the same as match.a/b otherwise) */
  decks: [string, string];
}
/**
 * Visit every game of every recorded event (byes skipped), in event, round, match and game order. Pooled records
 * (head-to-heads, breeding) read `decks`, so a deck entered twice counts as itself and its mirror games are skipped there.
 */
export function forEachRecordedGame(cb: (g: RecordedGame) => void, dir = EVENTS_DIR) {
  for (const event of readEvents(dir))
    for (const [pi, part] of [...event.rounds, ...event.bracket].entries())
      for (const match of part.matches) {
        if (!match.b) continue;
        const decks: [string, string] = [entrantBase(event.setup, match.a), entrantBase(event.setup, match.b)];
        for (const game of match.games) cb({ event, match: match as RecordedMatch & { b: string }, game, stage: pi < event.rounds.length ? 'swiss' : 'top', decks });
      }
}

// ================================================================ writes

/** Write a file only if its content differs. Returns whether it was written. */
export function writeIfChanged(file: string, content: string): boolean {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

/**
 * Write JSON with a timestamp key (default "updated") that only moves when the rest of the content changes,
 * so regenerating unchanged data leaves the file byte-identical.
 */
export function writeJsonStamped(file: string, data: Record<string, unknown>, o: { key?: string; indent?: number } = {}): boolean {
  const key = o.key ?? 'updated';
  const body = (d: Record<string, unknown>) => JSON.stringify({ ...d, [key]: '' }, null, o.indent);
  if (fs.existsSync(file)) {
    try {
      const old = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (body(old) === body(data)) return false;
    } catch {
      // unreadable: rewrite
    }
  }
  return writeIfChanged(file, JSON.stringify({ ...data, [key]: new Date().toISOString() }, null, o.indent));
}

// ================================================================ deck-file provenance headers

/** Header keys written by scripts/tag-provenance.ts (and read by src/lib/library.ts), in their canonical order. */
export const PROVENANCE_KEYS = ['Origin', 'Author', 'Source', 'Via', 'Credits', 'Parents', 'Added', 'Tier', 'Idea', 'Forged'] as const;
const HEADER_RE = new RegExp(`^// (${PROVENANCE_KEYS.join('|')}): (.*)$`);

/**
 * Rewrite a deck file's text but keep the provenance lines of the version already on disk. Keys the old file has win
 * (they were curated by tag-provenance.ts), except those in `refresh` (e.g. Tier from a fresh import); keys only the new
 * text has are kept too. The block goes right after the first line (the deck name), in canonical order.
 */
export function mergeProvenance(newText: string, oldText: string | null, refresh: readonly string[] = []): string {
  if (!oldText) return newText;
  const NL = '\n';
  const take = (t: string) => {
    const h = new Map<string, string>();
    for (const l of t.split(/\r?\n/)) {
      const m = l.match(HEADER_RE);
      if (m && !h.has(m[1])) h.set(m[1], m[2]);
    }
    return h;
  };
  const oldH = take(oldText);
  const newH = take(newText);
  const merged = new Map<string, string>();
  for (const k of PROVENANCE_KEYS) {
    const v = refresh.includes(k) ? newH.get(k) ?? oldH.get(k) : oldH.get(k) ?? newH.get(k);
    if (v !== undefined) merged.set(k, v);
  }
  const body = newText.split(/\r?\n/).filter((l) => !HEADER_RE.test(l));
  return [body[0], ...[...merged].map(([k, v]) => `// ${k}: ${v}`), ...body.slice(1)].join(NL);
}

/** Paths among `files` that already exist. */
export const existing = (files: string[]) => files.filter((f) => fs.existsSync(f));
