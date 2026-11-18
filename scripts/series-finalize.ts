// Prepare a rating-series commit on the main it will be pushed onto (docs/SERIES.md "Running by itself"): the
// workflow's finalize job runs this after the play job's run file is downloaded. It runs no network push and holds no
// write token; the push is scripts/series-push.mjs, in a job of its own that runs no repository code.
//
//   npx tsx scripts/series-finalize.ts --remote REMOTE --run-file FILE --out DIR [--branch main] [--work DIR]
//       [--verify CMD] [--rebuild CMD] [--checks CMD]
//
//   1. fetch REMOTE's branch and reset the work tree to it (git clean keeps ignored files such as node_modules);
//   2. the run file must be data/series/run-N.json with N exactly one past the highest run on that main (else someone
//      else's run is in: exit 6), and its id run-N;
//   3. place it, then --verify (default: npx tsx scripts/series.ts verify FILE: the run's simulator version is the
//      code's, and its own games replay; a refusal is exit 4);
//   4. --rebuild (default: ratings, head-to-heads, evidence) and --checks (default: what pages.yml's check job runs, and
//      the evidence check); a failure is exit 1, and nothing is committed;
//   5. only the run file and the files the rebuild writes may differ from main (data/series/run-N.json added,
//      src/data/ratings.json, public/data/h2h.json, reports/ratings-latest.md, public/data/evidence/*.json): anything
//      else is exit 7;
//   6. commit as github-actions[bot], hooks off, with the message "Series run N: G games, widest ±a to ±b (stopped)",
//      and write DIR/series.bundle (main..commit) and DIR/commit.json (base, commit, run, message) for the push job.
//
// The commands are shell strings run in the work tree (the tests hand in cheap stand-ins). Exits 0 prepared, 1 a check
// failed, 2 a bad command line, 4 the run does not belong to this code, 6 the run number is taken, 7 a path outside
// the list changed.
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** The paths a series commit may touch (scripts/series-push.mjs holds the same list; the tests compare them). */
export const SERIES_COMMIT_PATHS = [/^data\/series\/run-\d+\.json$/, /^src\/data\/ratings\.json$/, /^public\/data\/h2h\.json$/, /^reports\/ratings-latest\.md$/, /^public\/data\/evidence\/[^/]+\.json$/];
export const FINALIZE_EXIT = { prepared: 0, failed: 1, usage: 2, verify: 4, taken: 6, outside: 7 } as const;

/**
 * The entries of `git diff --raw --no-renames` that are not plain regular files: a symlink, a submodule, an executable
 * or a type change named like a data file would pass a path list (the deploy's build copies public/ and would follow a
 * link out of the checkout). Only an added or modified file of mode 100644, or a deleted file, is acceptable.
 * (scripts/series-push.mjs holds the same rule; the tests compare them.)
 */
export function irregularEntries(rawLines: readonly string[]): string[] {
  return rawLines.filter((l) => {
    const m = /^:(\d{6}) (\d{6}) \S+ \S+ ([AMD])\t/.exec(l);
    if (!m) return true;
    const [, was, now, status] = m;
    return status === 'D' ? now !== '000000' : now !== '100644' || (was !== '000000' && was !== '100644');
  });
}

export const DEFAULT_VERIFY = 'npx tsx scripts/series.ts verify';
export const DEFAULT_REBUILD = 'npx tsx scripts/ratings.ts && npx tsx scripts/build-h2h.ts && npx tsx scripts/build-evidence.ts';
export const DEFAULT_CHECKS = [
  'npm run typecheck',
  'npx vitest run',
  'python3 -m unittest discover -s tools -p "test_*.py"',
  'npm run lint',
  'npm run check:data',
  'npx tsx scripts/build-evidence.ts --check',
  'npx vite build',
].join(' && ');

const BOT_NAME = 'github-actions[bot]';
const BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';

export interface FinalizeOptions {
  remote: string;
  branch?: string;
  runFile: string;
  out: string;
  work?: string;
  verify?: string;
  rebuild?: string;
  checks?: string;
  log?: (line: string) => void;
}

class Stop extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

/** git's output, untrimmed at the start (a porcelain status line starts with a space). */
const gitRaw = (cwd: string, args: string[]) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\s+$/, '');
const git = (cwd: string, args: string[]) => gitRaw(cwd, args).trim();

/** Run a shell command in the work tree; its output goes to ours. True when it exits 0; the exit code otherwise. */
function sh(cwd: string, cmd: string): true | number {
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
    return true;
  } catch (e) {
    return (e as { status?: number }).status ?? 1;
  }
}

/** The commit message from the run file: "Series run N: G games, widest ±a to ±b (reached|budget)". */
export function commitMessage(run: { id?: unknown; rate?: { games?: unknown }; before?: { widest?: unknown }; after?: { widest?: unknown }; stopped?: unknown }): string {
  const n = String(run.id ?? '').replace(/^run-/, '');
  const w = (x: unknown) => (typeof x === 'number' ? `±${x.toFixed(2)}` : '±?');
  return `Series run ${n}: ${String(run.rate?.games ?? '?')} games, widest ${w(run.before?.widest)} to ${w(run.after?.widest)} (${String(run.stopped ?? '?')})`;
}

/** Prepare the commit (see the header). Returns the exit code. */
export function prepareSeriesCommit(o: FinalizeOptions): number {
  const log = o.log ?? ((l: string) => console.log(l));
  const work = path.resolve(o.work ?? '.');
  const branch = o.branch ?? 'main';
  try {
    const name = path.basename(o.runFile);
    const m = /^run-(\d+)\.json$/.exec(name);
    if (!m) throw new Stop(FINALIZE_EXIT.usage, `${name} is not a run file name (run-N.json)`);
    const n = Number(m[1]);
    const text = fs.readFileSync(o.runFile, 'utf8');
    const run = JSON.parse(text) as { id?: unknown };
    if (run.id !== `run-${n}`) throw new Stop(FINALIZE_EXIT.verify, `${name} holds the id ${JSON.stringify(run.id)}`);

    // 1. the main it will be pushed onto
    git(work, ['fetch', '-q', '--no-tags', o.remote, branch]);
    const base = git(work, ['rev-parse', 'FETCH_HEAD']);
    git(work, ['reset', '-q', '--hard', base]);
    git(work, ['clean', '-q', '-fd']);
    log(`On ${branch} at ${base.slice(0, 7)}.`);

    // 2. the run number is the next one on that main
    const dir = path.join(work, 'data/series');
    const taken = fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => /^run-(\d+)\.json$/.exec(f)?.[1]).filter((x): x is string => !!x).map(Number) : [];
    const next = (taken.length ? Math.max(...taken) : 0) + 1;
    if (n !== next) throw new Stop(FINALIZE_EXIT.taken, `${name} is run ${n}, but the next run on ${branch} is run ${next}: another run is already in (or one is missing); nothing is committed`);

    // 3. place it and verify it against this code
    const rel = `data/series/${name}`;
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(o.runFile, path.join(work, rel));
    const verified = sh(work, `${o.verify ?? DEFAULT_VERIFY} ${JSON.stringify(rel)}`);
    if (verified !== true) throw new Stop(FINALIZE_EXIT.verify, `the run does not belong to this code (verify exited ${verified}); nothing is committed`);

    // 4. rebuild and check, on this main
    const rebuilt = sh(work, o.rebuild ?? DEFAULT_REBUILD);
    if (rebuilt !== true) throw new Stop(FINALIZE_EXIT.failed, `the rebuild failed (exit ${rebuilt}); nothing is committed`);
    const checked = sh(work, o.checks ?? DEFAULT_CHECKS);
    if (checked !== true) throw new Stop(FINALIZE_EXIT.failed, `a check failed (exit ${checked}); nothing is committed`);

    // 5. only the run file and the derived files changed
    const status = gitRaw(work, ['status', '--porcelain', '--untracked-files=all', '--no-renames'])
      .split('\n')
      .filter(Boolean)
      .map((l) => ({ code: l.slice(0, 2), file: l.slice(3).replace(/^"|"$/g, '') }));
    const outside = status.filter((s) => !SERIES_COMMIT_PATHS.some((re) => re.test(s.file)));
    if (outside.length) throw new Stop(FINALIZE_EXIT.outside, `paths a series commit may not touch changed: ${outside.map((s) => s.file).join(', ')}; nothing is committed`);
    const runs = status.filter((s) => s.file.startsWith('data/series/'));
    if (runs.length !== 1 || runs[0]!.file !== rel || runs[0]!.code !== '??') throw new Stop(FINALIZE_EXIT.outside, `the commit must add ${rel} alone among the run files (it has ${runs.map((s) => `${s.code.trim()} ${s.file}`).join(', ') || 'none'})`);

    // 6. commit, and hand the commit over
    const message = commitMessage(JSON.parse(text));
    git(work, ['add', '-A', '--', ...status.map((s) => s.file)]);
    const irregular = irregularEntries(git(work, ['diff', '--cached', '--raw', '--no-renames']).split('\n').filter(Boolean));
    if (irregular.length) throw new Stop(FINALIZE_EXIT.outside, `the commit would hold something other than regular files: ${irregular.map((l) => l.split('\t')[1] ?? l).join(', ')}; nothing is committed`);
    git(work, ['-c', `user.name=${BOT_NAME}`, '-c', `user.email=${BOT_EMAIL}`, 'commit', '-q', '--no-verify', '-m', message]);
    const commit = git(work, ['rev-parse', 'HEAD']);
    fs.mkdirSync(o.out, { recursive: true });
    git(work, ['bundle', 'create', path.resolve(o.out, 'series.bundle'), 'HEAD', `^${base}`]);
    fs.writeFileSync(path.join(o.out, 'commit.json'), `${JSON.stringify({ base, commit, run: n, file: rel, message }, null, 1)}\n`);
    log(`Prepared ${commit.slice(0, 7)} on ${base.slice(0, 7)}: ${message} (${status.length} file(s)).`);
    return FINALIZE_EXIT.prepared;
  } catch (e) {
    if (e instanceof Stop) {
      log(`refused: ${e.message}`);
      return e.code;
    }
    log(`error: ${(e as Error).message}`);
    return FINALIZE_EXIT.failed;
  }
}

if (process.argv[1]?.endsWith('series-finalize.ts')) {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
    process.exit(0);
  }
  const v: Record<string, string> = {};
  const known = ['remote', 'run-file', 'out', 'branch', 'work', 'verify', 'rebuild', 'checks'];
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i]!.replace(/^--/, '');
    if (!argv[i]!.startsWith('--') || !known.includes(k) || argv[i + 1] === undefined) {
      console.error(`error: unknown or incomplete flag ${argv[i]}\nRun with --help for usage.`);
      process.exit(FINALIZE_EXIT.usage);
    }
    v[k] = argv[i + 1]!;
  }
  for (const need of ['remote', 'run-file', 'out'])
    if (!v[need]) {
      console.error(`error: --${need} is required\nRun with --help for usage.`);
      process.exit(FINALIZE_EXIT.usage);
    }
  process.exit(prepareSeriesCommit({ remote: v.remote!, runFile: v['run-file']!, out: v.out!, branch: v.branch, work: v.work, verify: v.verify, rebuild: v.rebuild, checks: v.checks }));
}
