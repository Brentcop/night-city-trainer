// Push a prepared rating-series commit to main (docs/SERIES.md "Running by itself"). The workflow's push jobs run this
// with Node alone: no npm install, no repository dependency, a fresh repository of their own, git's global and system
// configuration ignored, no hooks. It never builds or checks anything itself; the finalize job did that on the main the
// commit sits on (scripts/series-finalize.ts), and this refuses unless main is still exactly that commit's parent.
//
//   node scripts/series-push.mjs --remote URL --bundle-dir DIR --work DIR [--branch main] [--push-url-env NAME]
//
//   --remote URL        where to read main from (the public https address, or a path in the tests)
//   --bundle-dir DIR    the finalize job's output: series.bundle and commit.json
//   --work DIR          an empty or missing directory for the fresh repository
//   --push-url-env NAME the environment variable holding the address to push to (with the token in the workflow; never
//                       printed); without it, nothing is pushed (a check only)
//
// Exits 0 pushed (or checked, without --push-url-env); 5 main moved since the commit was prepared, or the push was
// refused (the workflow prepares it again on the new main); 7 the commit is not what a series commit may be (another
// path, another parent, another run); 1 any other failure; 2 a bad command line.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The paths a series commit may touch (scripts/series-finalize.ts holds the same list; tests/series-finalize.test.ts compares them). */
export const SERIES_COMMIT_PATHS = [/^data\/series\/run-\d+\.json$/, /^src\/data\/ratings\.json$/, /^public\/data\/h2h\.json$/, /^reports\/ratings-latest\.md$/, /^public\/data\/evidence\/[^/]+\.json$/];
export const PUSH_EXIT = { pushed: 0, error: 1, usage: 2, retry: 5, refused: 7 };

/**
 * The entries of `git diff --raw --no-renames` that are not plain regular files: a symlink, a submodule, an executable
 * or a type change named like a data file would pass a path list (the deploy's build copies public/ and would follow a
 * link out of the checkout). Only an added or modified file of mode 100644, or a deleted file, is acceptable.
 * (scripts/series-finalize.ts holds the same rule; the tests compare them.)
 */
export function irregularEntries(rawLines) {
  return rawLines.filter((l) => {
    const m = /^:(\d{6}) (\d{6}) \S+ \S+ ([AMD])\t/.exec(l);
    if (!m) return true;
    const [, was, now, status] = m;
    return status === 'D' ? now !== '000000' : now !== '100644' || (was !== '000000' && was !== '100644');
  });
}

class Stop extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** An empty file to stand for git's global configuration (os.devNull is not a path git reads on every system). */
let emptyConfig = null;
function emptyGitConfig() {
  if (!emptyConfig) {
    emptyConfig = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'series-push-')), 'empty.gitconfig');
    fs.writeFileSync(emptyConfig, '');
  }
  return emptyConfig;
}

/** git with no global or system configuration (a planted url.insteadOf or helper cannot redirect the push) and no hooks. */
function git(cwd, args) {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'credential.helper=', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_CONFIG_GLOBAL: emptyGitConfig(), GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

function parse(argv) {
  const v = { branch: 'main' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const m = /^--(remote|bundle-dir|work|branch|push-url-env)$/.exec(k ?? '');
    if (!m || argv[i + 1] === undefined) throw new Stop(PUSH_EXIT.usage, `unknown or incomplete flag ${k}`);
    v[m[1]] = argv[++i];
  }
  for (const need of ['remote', 'bundle-dir', 'work']) if (!v[need]) throw new Stop(PUSH_EXIT.usage, `--${need} is required`);
  return v;
}

/** Check the prepared commit against main and push it. Returns the exit code; `log` gets every line to show. */
export function pushSeriesCommit(argv, log = (l) => console.log(l)) {
  try {
    const v = parse(argv);
    const meta = JSON.parse(fs.readFileSync(path.join(v['bundle-dir'], 'commit.json'), 'utf8'));
    const bundle = path.resolve(v['bundle-dir'], 'series.bundle');
    if (!/^[0-9a-f]{40}$/.test(meta.base ?? '') || !/^[0-9a-f]{40}$/.test(meta.commit ?? '') || !Number.isInteger(meta.run)) throw new Stop(PUSH_EXIT.refused, 'commit.json does not name a base, a commit and a run');
    const work = path.resolve(v.work);
    if (fs.existsSync(work) && fs.readdirSync(work).length) throw new Stop(PUSH_EXIT.usage, `${work} is not empty`);
    fs.mkdirSync(work, { recursive: true });
    git(work, ['init', '-q']);
    git(work, ['fetch', '-q', '--no-tags', v.remote, `${v.branch}`]);
    const main = git(work, ['rev-parse', 'FETCH_HEAD']);
    if (main !== meta.base) throw new Stop(PUSH_EXIT.retry, `main moved from ${meta.base.slice(0, 7)} to ${main.slice(0, 7)} since the commit was prepared: it is prepared again on the new main`);
    git(work, ['bundle', 'verify', '-q', bundle]);
    git(work, ['fetch', '-q', bundle, 'HEAD']);
    const commit = git(work, ['rev-parse', 'FETCH_HEAD']);
    if (commit !== meta.commit) throw new Stop(PUSH_EXIT.refused, `the bundle holds ${commit.slice(0, 7)}, commit.json names ${meta.commit.slice(0, 7)}`);
    const parents = git(work, ['rev-list', '--parents', '-n', '1', commit]).split(' ').slice(1);
    if (parents.length !== 1 || parents[0] !== meta.base) throw new Stop(PUSH_EXIT.refused, `the commit's parent is not main (${parents.join(', ')})`);
    const changes = git(work, ['diff', '--name-status', '--no-renames', meta.base, commit])
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [status, file] = l.split('\t');
        return { status, file };
      });
    const runFile = `data/series/run-${meta.run}.json`;
    const outside = changes.filter((c) => !SERIES_COMMIT_PATHS.some((re) => re.test(c.file)));
    if (outside.length) throw new Stop(PUSH_EXIT.refused, `the commit touches paths a series commit may not: ${outside.map((c) => c.file).join(', ')}`);
    const runs = changes.filter((c) => c.file.startsWith('data/series/'));
    if (runs.length !== 1 || runs[0].file !== runFile || runs[0].status !== 'A') throw new Stop(PUSH_EXIT.refused, `the commit must add ${runFile} and no other run file (it has ${runs.map((c) => `${c.status} ${c.file}`).join(', ') || 'none'})`);
    const irregular = irregularEntries(git(work, ['diff', '--raw', '--no-renames', meta.base, commit]).split('\n').filter(Boolean));
    if (irregular.length) throw new Stop(PUSH_EXIT.refused, `the commit holds something other than regular files: ${irregular.map((l) => l.split('\t')[1] ?? l).join(', ')}`);
    log(`The commit ${commit.slice(0, 7)} adds ${runFile} and changes ${changes.length - 1} derived file(s) on main ${main.slice(0, 7)}.`);
    if (!v['push-url-env']) {
      log('No --push-url-env: checked only, nothing pushed.');
      return PUSH_EXIT.pushed;
    }
    const url = process.env[v['push-url-env']];
    if (!url) throw new Stop(PUSH_EXIT.usage, `${v['push-url-env']} is empty`);
    try {
      git(work, ['push', '-q', url, `${commit}:refs/heads/${v.branch}`]);
    } catch {
      // the message may hold the address; it is not shown
      throw new Stop(PUSH_EXIT.retry, 'the push was refused (main moved in the meantime, most likely): it is prepared again on the new main');
    }
    log(`Pushed ${commit.slice(0, 7)} to ${v.branch}.`);
    return PUSH_EXIT.pushed;
  } catch (e) {
    if (e instanceof Stop) {
      log(`${e.code === PUSH_EXIT.retry ? 'not pushed' : 'refused'}: ${e.message}`);
      return e.code;
    }
    log(`error: ${String(e?.message ?? e).replace(/https?:\/\/[^\s]*@/g, 'https://***@')}`);
    return PUSH_EXIT.error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(pushSeriesCommit(process.argv.slice(2)));
