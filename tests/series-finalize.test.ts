// The rating series' commit (docs/SERIES.md "Running by itself"): scripts/series-finalize.ts prepares it on the main it
// will be pushed onto, scripts/series-push.mjs pushes it; the workflow alternates them up to three times. Here both run
// against a LOCAL BARE REPOSITORY in a temporary folder, with cheap stand-ins for the verify, rebuild and check
// commands, through every path: a clean success, a push race (the second attempt succeeds on the fresh main), a run of
// another simulator version, a path outside the list, a failed check, a run number already taken, three refused pushes,
// and a commit tampered with between the jobs. Nothing touches the network or this repository.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { commitMessage, FINALIZE_EXIT, irregularEntries as prepareIrregular, prepareSeriesCommit, SERIES_COMMIT_PATHS as PREPARE_PATHS } from '../scripts/series-finalize';
// @ts-expect-error: a plain Node module with no types (it runs with Node alone in the workflow's push jobs)
import { irregularEntries as pushIrregular, PUSH_EXIT, pushSeriesCommit, SERIES_COMMIT_PATHS as PUSH_PATHS } from '../scripts/series-push.mjs';

// Every test here starts many git processes (a bare repository, clones, bundles, pushes): on a loaded machine or a small runner
// one can pass the default 15 s, and the scheduled workflow runs this file inside its checks, where a timeout would cost the night's commit.
vi.setConfig({ testTimeout: 120_000 });

const ID = ['-c', 'user.name=Someone', '-c', 'user.email=someone@example.com', '-c', 'core.hooksPath=/dev/null', '-c', 'init.defaultBranch=main'];
const git = (cwd: string, ...args: string[]) => execFileSync('git', [...ID, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});

/** A toy repository on a bare remote: the derived files, a stand-in rebuild and verify, and run files in data/series. */
function toy(o: { runsOnMain?: number } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'series-finalize-'));
  roots.push(root);
  const remote = path.join(root, 'remote.git');
  git(root, 'init', '-q', '--bare', remote);
  const seed = path.join(root, 'seed');
  git(root, 'init', '-q', seed);
  const put = (dir: string, f: string, t: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), t);
  };
  put(seed, 'README.md', 'toy\n');
  put(seed, 'src/data/ratings.json', '{"runs":0}\n');
  put(seed, 'public/data/h2h.json', '{"runs":0}\n');
  put(seed, 'public/data/evidence/index.json', '{"runs":0}\n');
  put(seed, 'reports/ratings-latest.md', 'runs 0\n');
  for (let k = 1; k <= (o.runsOnMain ?? 0); k++) put(seed, `data/series/run-${k}.json`, JSON.stringify({ id: `run-${k}`, simVersion: 9 }));
  // the stand-ins: verify refuses another simulator version (exit 4, as series.ts verify does); the rebuild rewrites the
  // derived files from the run files, and writes EXTRA (a path outside the list) when asked
  put(seed, 'verify.cjs', "const r = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));\nprocess.exit(r.simVersion === 9 ? 0 : 4);\n");
  put(
    seed,
    'rebuild.cjs',
    "const fs = require('fs');\nconst n = fs.readdirSync('data/series').length;\nfor (const f of ['src/data/ratings.json', 'public/data/h2h.json', 'public/data/evidence/index.json']) fs.writeFileSync(f, JSON.stringify({ runs: n }) + '\\n');\nfs.writeFileSync('public/data/evidence/abcdef0123456789.json', JSON.stringify({ runs: n }) + '\\n');\nfs.writeFileSync('reports/ratings-latest.md', 'runs ' + n + '\\n');\nif (process.env.EXTRA) fs.writeFileSync(process.env.EXTRA, 'x');\n",
  );
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'toy');
  git(seed, 'push', '-q', remote, 'HEAD:refs/heads/main');
  const work = path.join(root, 'work');
  git(root, 'clone', '-q', remote, work);
  /** another session's commit landing on main */
  let other = 0;
  const race = () => {
    other++;
    put(seed, 'README.md', `toy, edited by someone else ${other}\n`);
    git(seed, 'commit', '-q', '-am', `someone else ${other}`);
    git(seed, 'pull', '-q', '--rebase', remote, 'main');
    git(seed, 'push', '-q', remote, 'HEAD:refs/heads/main');
  };
  const runFile = (n: number, fields: Record<string, unknown> = {}) => {
    const f = path.join(root, `play/run-${n}.json`);
    put(root, `play/run-${n}.json`, JSON.stringify({ kind: 'nct-rating-run', schema: 1, id: `run-${n}`, simVersion: 9, rate: { games: 600, seconds: 57, threads: 4 }, before: { widest: 7.44 }, after: { widest: 6.91 }, stopped: 'budget', ...fields }));
    return f;
  };
  const main = () => git(root, 'ls-remote', remote, 'refs/heads/main').split(/\s+/)[0]!;
  const log = () => git(root, '--git-dir', remote, 'log', '--format=%an|%s', 'main').split('\n');
  return { root, remote, work, race, runFile, main, log };
}

const STAND_INS = { verify: 'node verify.cjs', rebuild: 'node rebuild.cjs', checks: 'node -e "process.exit(0)"' };

/**
 * The workflow's alternation (finalize-1, push-1, finalize-2, push-2, finalize-3, push-3): prepare on the fresh main,
 * push; a push that finds main moved or is refused (exit 5) starts the next attempt; anything else ends the run.
 */
function finalize(t: ReturnType<typeof toy>, runFile: string, o: { checks?: string; beforePush?: (attempt: number) => void; env?: Record<string, string> } = {}) {
  const lines: string[] = [];
  const saved = { ...process.env };
  Object.assign(process.env, o.env ?? {}, { SERIES_TEST_PUSH_URL: t.remote });
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const out = path.join(t.root, `commit-${attempt}`);
      const p = prepareSeriesCommit({ remote: t.remote, runFile, out, work: t.work, ...STAND_INS, ...(o.checks ? { checks: o.checks } : {}), log: (l) => lines.push(l) });
      if (p !== FINALIZE_EXIT.prepared) return { stage: 'prepare', code: p, attempt, lines };
      o.beforePush?.(attempt);
      const q = pushSeriesCommit(['--remote', t.remote, '--bundle-dir', out, '--work', path.join(t.root, `push-${attempt}`), '--push-url-env', 'SERIES_TEST_PUSH_URL'], (l: string) => lines.push(l));
      if (q === PUSH_EXIT.pushed) return { stage: 'pushed', code: 0, attempt, lines };
      if (q !== PUSH_EXIT.retry) return { stage: 'push', code: q, attempt, lines };
    }
    return { stage: 'push', code: PUSH_EXIT.retry, attempt: 3, lines };
  } finally {
    process.env = saved;
  }
}

describe('the commit of a rating run (local bare repository)', () => {
  it('a clean run: prepared on main, pushed, the run file and the derived files only, as github-actions[bot]', () => {
    const t = toy();
    const before = t.main();
    const r = finalize(t, t.runFile(1));
    expect(r).toMatchObject({ stage: 'pushed', attempt: 1 });
    const [top, prev] = t.log();
    expect(top).toBe('github-actions[bot]|Series run 1: 600 games, widest ±7.44 to ±6.91 (budget)');
    expect(prev).toBe('Someone|toy');
    const files = git(t.root, '--git-dir', t.remote, 'diff', '--name-status', before, 'main').split('\n').sort();
    expect(files).toEqual(['A\tdata/series/run-1.json', 'A\tpublic/data/evidence/abcdef0123456789.json', 'M\tpublic/data/evidence/index.json', 'M\tpublic/data/h2h.json', 'M\treports/ratings-latest.md', 'M\tsrc/data/ratings.json'].sort());
  });

  it('a push race: another commit lands between the checks and the push; the second attempt succeeds on the fresh main', () => {
    const t = toy();
    const r = finalize(t, t.runFile(1), { beforePush: (k) => k === 1 && t.race() });
    expect(r).toMatchObject({ stage: 'pushed', attempt: 2 });
    expect(r.lines.join('\n')).toContain('main moved');
    expect(t.log().slice(0, 2)).toEqual(['github-actions[bot]|Series run 1: 600 games, widest ±7.44 to ±6.91 (budget)', 'Someone|someone else 1']);
  });

  it('three refused pushes: red, and nothing of the run reaches main', () => {
    const t = toy();
    const r = finalize(t, t.runFile(1), { beforePush: () => t.race() });
    expect(r).toMatchObject({ stage: 'push', code: PUSH_EXIT.retry, attempt: 3 });
    expect(t.log().every((l) => !l.startsWith('github-actions'))).toBe(true);
    expect(t.log()).toHaveLength(4);
  });

  it('a run of another simulator version is refused by verify (exit 4): nothing pushed', () => {
    const t = toy();
    const before = t.main();
    const r = finalize(t, t.runFile(1, { simVersion: 8 }));
    expect(r).toMatchObject({ stage: 'prepare', code: FINALIZE_EXIT.verify });
    expect(t.main()).toBe(before);
  });

  it('a path outside the list changed (exit 7): nothing pushed', () => {
    const t = toy();
    const before = t.main();
    const r = finalize(t, t.runFile(1), { env: { EXTRA: 'src/planted.ts' } });
    expect(r).toMatchObject({ stage: 'prepare', code: FINALIZE_EXIT.outside });
    expect(r.lines.join('\n')).toContain('src/planted.ts');
    expect(t.main()).toBe(before);
  });

  it('a failed check (exit 1): nothing committed, nothing pushed', () => {
    const t = toy();
    const before = t.main();
    const r = finalize(t, t.runFile(1), { checks: 'node -e "process.exit(3)"' });
    expect(r).toMatchObject({ stage: 'prepare', code: FINALIZE_EXIT.failed });
    expect(r.lines.join('\n')).toContain('a check failed (exit 3)');
    expect(t.main()).toBe(before);
    expect(git(t.work, 'status', '--porcelain')).not.toBe('');
  });

  it('the run number is taken on main (someone else\'s run is in, exit 6): nothing pushed', () => {
    const t = toy({ runsOnMain: 1 });
    const before = t.main();
    expect(finalize(t, t.runFile(1))).toMatchObject({ stage: 'prepare', code: FINALIZE_EXIT.taken });
    expect(finalize(t, t.runFile(3))).toMatchObject({ stage: 'prepare', code: FINALIZE_EXIT.taken });
    expect(t.main()).toBe(before);
    expect(finalize(t, t.runFile(2))).toMatchObject({ stage: 'pushed' });
  });

  it('the push job refuses a commit tampered with between the jobs (another path, exit 7), and checks only without a push address', () => {
    const t = toy();
    const before = t.main();
    const out = path.join(t.root, 'commit');
    expect(prepareSeriesCommit({ remote: t.remote, runFile: t.runFile(1), out, work: t.work, ...STAND_INS, log: () => {} })).toBe(FINALIZE_EXIT.prepared);
    const lines: string[] = [];
    expect(pushSeriesCommit(['--remote', t.remote, '--bundle-dir', out, '--work', path.join(t.root, 'check-only')], (l: string) => lines.push(l))).toBe(PUSH_EXIT.pushed);
    expect(lines.join('\n')).toContain('checked only, nothing pushed');
    // a planted file amended into the commit, with a fresh bundle and commit.json
    fs.writeFileSync(path.join(t.work, 'src/planted.ts'), 'x');
    git(t.work, 'add', 'src/planted.ts');
    git(t.work, 'commit', '-q', '--amend', '--no-edit');
    const commit = git(t.work, 'rev-parse', 'HEAD');
    git(t.work, 'bundle', 'create', path.join(out, 'series.bundle'), 'HEAD', `^${before}`);
    const meta = JSON.parse(fs.readFileSync(path.join(out, 'commit.json'), 'utf8'));
    fs.writeFileSync(path.join(out, 'commit.json'), JSON.stringify({ ...meta, commit }));
    process.env.SERIES_TEST_PUSH_URL = t.remote;
    const r: string[] = [];
    expect(pushSeriesCommit(['--remote', t.remote, '--bundle-dir', out, '--work', path.join(t.root, 'tampered'), '--push-url-env', 'SERIES_TEST_PUSH_URL'], (l: string) => r.push(l))).toBe(PUSH_EXIT.refused);
    delete process.env.SERIES_TEST_PUSH_URL;
    expect(r.join('\n')).toContain('src/planted.ts');
    expect(t.main()).toBe(before);
  });

  it('a link, an executable or a submodule named like a data file is refused: the push job (exit 7) and the rule both scripts share', () => {
    const t = toy();
    const before = t.main();
    const out = path.join(t.root, 'commit');
    expect(prepareSeriesCommit({ remote: t.remote, runFile: t.runFile(1), out, work: t.work, ...STAND_INS, log: () => {} })).toBe(FINALIZE_EXIT.prepared);
    // a symlink entry (no operating-system link needed) amended into the commit, with a fresh bundle and commit.json
    const blob = execFileSync('git', [...ID, 'hash-object', '-w', '--stdin'], { cwd: t.work, input: '/etc/hosts', encoding: 'utf8' }).trim();
    git(t.work, 'update-index', '--add', '--cacheinfo', `120000,${blob},public/data/evidence/link.json`);
    git(t.work, 'commit', '-q', '--amend', '--no-edit');
    const commit = git(t.work, 'rev-parse', 'HEAD');
    git(t.work, 'bundle', 'create', path.join(out, 'series.bundle'), 'HEAD', `^${before}`);
    const meta = JSON.parse(fs.readFileSync(path.join(out, 'commit.json'), 'utf8'));
    fs.writeFileSync(path.join(out, 'commit.json'), JSON.stringify({ ...meta, commit }));
    process.env.SERIES_TEST_PUSH_URL = t.remote;
    const r: string[] = [];
    expect(pushSeriesCommit(['--remote', t.remote, '--bundle-dir', out, '--work', path.join(t.root, 'link'), '--push-url-env', 'SERIES_TEST_PUSH_URL'], (l: string) => r.push(l))).toBe(PUSH_EXIT.refused);
    delete process.env.SERIES_TEST_PUSH_URL;
    expect(r.join('\n')).toContain('other than regular files: public/data/evidence/link.json');
    expect(t.main()).toBe(before);
    // the rule itself, the same in both scripts: added or modified files of mode 100644 and deletions pass; anything else does not
    const sha = 'a'.repeat(40);
    const raw = (was: string, now: string, status: string, file = 'src/data/ratings.json') => `:${was} ${now} ${sha} ${sha} ${status}\t${file}`;
    const ok = [raw('000000', '100644', 'A'), raw('100644', '100644', 'M'), raw('100644', '000000', 'D'), raw('120000', '000000', 'D')];
    const bad = [raw('000000', '120000', 'A'), raw('100644', '120000', 'M'), raw('100644', '100755', 'M'), raw('000000', '100755', 'A'), raw('000000', '160000', 'A'), raw('100644', '120000', 'T')];
    for (const fn of [prepareIrregular, pushIrregular as (l: string[]) => string[]]) {
      expect(fn(ok)).toEqual([]);
      expect(fn(bad)).toEqual(bad);
      expect(fn(['not a raw line'])).toEqual(['not a raw line']);
    }
  });

  it('both scripts hold the same list of paths, and the message reads the run file', () => {
    expect(PREPARE_PATHS.map(String)).toEqual((PUSH_PATHS as RegExp[]).map(String));
    expect(commitMessage({ id: 'run-12', rate: { games: 9600 }, before: { widest: 7.441 }, after: { widest: 3.999 }, stopped: 'reached' })).toBe('Series run 12: 9600 games, widest ±7.44 to ±4.00 (reached)');
  });
});
