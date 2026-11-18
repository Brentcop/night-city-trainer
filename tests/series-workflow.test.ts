// The rating series' scheduled workflow (.github/workflows/series.yml; docs/SERIES.md "Running by itself"), read as
// text the way tests/outside-meta-refresh.test.ts reads its own: pinned actions, read-only by default, the write token
// only in the push steps of jobs that install nothing, no expression inside a run: line, the schedule and the dispatch
// inputs, one run at a time, decide before play before finalize before push, the guard tests before any game, the run
// file kept whatever happens, three attempts at the commit, and pages.yml started after a push.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const text = fs.readFileSync('.github/workflows/series.yml', 'utf8').replace(/\r\n/g, '\n');
const lines = text.split('\n');
const indent = (l: string) => l.length - l.trimStart().length;
/** the lines of a top-level key's block, or of a job's */
const block = (start: RegExp) => {
  const i = lines.findIndex((l) => start.test(l));
  expect(i, String(start)).toBeGreaterThanOrEqual(0);
  const own = indent(lines[i]!);
  const out = [lines[i]!];
  for (const l of lines.slice(i + 1)) {
    if (l.trim() && indent(l) <= own) break;
    out.push(l);
  }
  return out;
};
const code = (l: string) => l.replace(/\s+#.*$/, '').replace(/^\s*#.*$/, '');
const JOBS = ['decide', 'play', 'finalize-1', 'push-1', 'finalize-2', 'push-2', 'finalize-3', 'push-3'] as const;
const job = (name: string) => block(new RegExp(`^ {2}${name}:$`)).join('\n');
/** the steps of a job, each as its text */
const steps = (name: string) =>
  job(name)
    .split(/\n(?= {6}- )/)
    .slice(1);

describe('the workflow file (.github/workflows/series.yml)', () => {
  it('is named "Rating series", and its jobs are decide, play, then three finalize and push pairs, in that order', () => {
    expect(text).toMatch(/^name: Rating series$/m);
    const names = lines.filter((l) => /^ {2}[\w-]+:$/.test(l) && lines.indexOf(l) > lines.indexOf('jobs:')).map((l) => l.trim().slice(0, -1));
    expect(names).toEqual([...JOBS]);
    expect(job('play')).toMatch(/needs: decide/);
    expect(job('finalize-1')).toMatch(/needs: play/);
    for (const k of [1, 2, 3]) expect(job(`push-${k}`)).toMatch(new RegExp(`needs: finalize-${k}`));
    expect(job('finalize-2')).toMatch(/needs: push-1\n.*if: \$\{\{ !github\.event\.repository\.fork && needs\.push-1\.outputs\.refused == 'true' \}\}/);
    expect(job('finalize-3')).toMatch(/needs: push-2\n.*if: \$\{\{ !github\.event\.repository\.fork && needs\.push-2\.outputs\.refused == 'true' \}\}/);
    expect(job('play')).toMatch(/if: \$\{\{ !github\.event\.repository\.fork && needs\.decide\.outputs\.needed == 'true' \}\}/);
    expect(job('finalize-1')).toMatch(/if: \$\{\{ !github\.event\.repository\.fork && needs\.play\.outputs\.written == 'true' && inputs\.dry_run != true && github\.ref == 'refs\/heads\/main' \}\}/);
    for (const j of JOBS) expect(job(j), j).toMatch(/if: \$\{\{ !github\.event\.repository\.fork\b/);
  });

  it('pins every action to a full commit SHA with its tag beside it, the same pins as outside-meta.yml', () => {
    const uses = lines.filter((l) => /^\s*(-\s+)?uses:/.test(l));
    expect(uses.length).toBeGreaterThanOrEqual(20);
    for (const l of uses) expect(l, l).toMatch(/uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/);
    const other = fs.readFileSync('.github/workflows/outside-meta.yml', 'utf8');
    for (const action of ['actions/checkout', 'actions/setup-node', 'actions/upload-artifact', 'actions/download-artifact']) {
      const pins = (t: string) => [...t.matchAll(new RegExp(`${action}@([0-9a-f]{40}) # (v[\\d.]+)`, 'g'))].map((m) => `${m[1]} ${m[2]}`);
      expect(new Set(pins(text)), action).toEqual(new Set(pins(other)));
    }
  });

  it('reads only at the top; writes only in the push jobs, which install nothing and keep the token to the push step', () => {
    expect(block(/^permissions:$/).map((l) => l.trim())).toEqual(['permissions:', 'contents: read', '']);
    for (const j of ['decide', 'play', 'finalize-1', 'finalize-2', 'finalize-3']) {
      expect(job(j).split('\n').some((l) => /:\s*write\b/.test(code(l))), j).toBe(false);
      expect(job(j), j).toMatch(/permissions:\n {6}contents: read\n/);
    }
    for (const k of [1, 2, 3]) {
      const p = job(`push-${k}`);
      expect(p).toMatch(/permissions:\n {6}contents: write\n {6}actions: write\n/);
      const c = p.split('\n').map(code).join('\n');
      // Node alone: no npm, npx or tsx, and no npm cache
      expect(c).not.toMatch(/\b(npm|npx|tsx|python3?)\b|cache: npm/);
      expect(c).toMatch(/node scripts\/series-push\.mjs/);
    }
    // the token: only as GH_TOKEN, only in the step "Push to main and start the deploy" of each push job
    const tokenLines = lines.filter((l) => /github\.token|secrets\.|GITHUB_TOKEN/.test(code(l)));
    expect(tokenLines.map((l) => l.trim())).toEqual(['GH_TOKEN: ${{ github.token }}', 'GH_TOKEN: ${{ github.token }}', 'GH_TOKEN: ${{ github.token }}']);
    for (const k of [1, 2, 3]) {
      const withToken = steps(`push-${k}`).filter((s) => /github\.token/.test(s));
      expect(withToken).toHaveLength(1);
      expect(withToken[0]).toMatch(/name: Push to main and start the deploy/);
      expect(withToken[0]).toMatch(/env:\n {10}GH_TOKEN: \$\{\{ github\.token \}\}/);
    }
    // every checkout keeps no token
    const checkouts = text.split(/\n(?= {6}- )/).filter((s) => /actions\/checkout@/.test(s));
    expect(checkouts).toHaveLength(8);
    for (const s of checkouts) expect(s).toMatch(/persist-credentials: false/);
    // the finalize jobs install with no install scripts
    for (const k of [1, 2, 3]) expect(job(`finalize-${k}`)).toMatch(/- run: npm ci --ignore-scripts/);
  });

  it('never puts an expression inside a run: line', () => {
    let inRun = -1;
    let runs = 0;
    for (const l of lines) {
      if (inRun >= 0 && l.trim() && indent(l) <= inRun) inRun = -1;
      const m = l.match(/^(\s*)(-\s+)?run:\s*(.*)$/);
      if (m) {
        runs++;
        expect(m[3], l).not.toContain('${{');
        if (m[3] === '|' || m[3] === '>') inRun = m[1]!.length + (m[2]?.length ?? 0);
        continue;
      }
      if (inRun >= 0) expect(l, l).not.toContain('${{');
    }
    expect(runs).toBeGreaterThanOrEqual(14);
  });

  it('runs daily at 03:17 UTC and on demand with dry_run, max_games and minutes; one run at a time', () => {
    expect(text).toMatch(/^on:\n {2}schedule:\n(?: {4}#.*\n)? {4}- cron: '17 3 \* \* \*'\n {2}workflow_dispatch:\n {4}inputs:\n {6}dry_run:/m);
    const inputs = block(/^ {4}inputs:$/).join('\n');
    expect(inputs).toMatch(/dry_run:\n(?: {8}.*\n)*? {8}type: boolean/);
    expect(inputs).toMatch(/max_games:\n(?: {8}.*\n)*? {8}type: number/);
    expect(inputs).toMatch(/minutes:\n(?: {8}.*\n)*? {8}type: number\n {8}default: 240/);
    expect(block(/^concurrency:$/).join('\n')).toMatch(/group: series\n {2}cancel-in-progress: false/);
  });

  it('decides first; the play job checks that the code still plays the recorded games before any game, and keeps the run file whatever follows', () => {
    expect(job('decide')).toMatch(/npx tsx scripts\/series\.ts status --github-output "\$GITHUB_OUTPUT" --summary "\$GITHUB_STEP_SUMMARY"/);
    expect(job('decide')).toMatch(/needed: \$\{\{ steps\.status\.outputs\.needed \}\}/);
    const p = job('play');
    const at = (s: string) => p.indexOf(s);
    expect(at('npx vitest run tests/game-corpus.test.ts tests/replay-events.test.ts')).toBeGreaterThan(0);
    expect(at('npx vitest run tests/game-corpus.test.ts')).toBeLessThan(at('scripts/series.ts run'));
    // exit 3 (stopped at its budget) is not a failure; exit 4 is
    expect(p).toMatch(/3\) echo "Stopped at its budget/);
    expect(p).toMatch(/4\) echo "::error::A recorded game no longer replays/);
    expect(p).toMatch(/--dry-run --max-games "\$\{MAX_GAMES:-600\}"/);
    // the upload comes right after the run, runs whatever else happens, and holds the run file only
    const s = steps('play');
    const run = s.findIndex((x) => /id: run\n/.test(x));
    const upload = s.findIndex((x) => /actions\/upload-artifact@/.test(x));
    expect(upload).toBe(run + 1);
    expect(s[upload]).toMatch(/if: \$\{\{ always\(\) && steps\.run\.outputs\.written == 'true' && inputs\.dry_run != true \}\}/);
    expect(s[upload]).toMatch(/name: series-run\n {10}path: \$\{\{ steps\.run\.outputs\.file \}\}\n {10}if-no-files-found: error\n {10}retention-days: 14/);
    // then the early rebuild and checks
    expect(s[upload + 1]).toMatch(/scripts\/ratings\.ts[\s\S]*build-h2h\.ts[\s\S]*build-evidence\.ts[\s\S]*check:data[\s\S]*build-evidence\.ts --check/);
    expect(p).toMatch(/timeout-minutes: 300/);
  });

  it('each finalize prepares the commit with series-finalize.ts on main and hands over a bundle; each push pushes it and starts pages.yml', () => {
    for (const k of [1, 2, 3]) {
      const f = job(`finalize-${k}`);
      expect(f).toMatch(/name: series-run\n/);
      expect(f).toMatch(/npx tsx scripts\/series-finalize\.ts --remote origin --run-file "\$files" --out "\$OUT"/);
      expect(f).toMatch(new RegExp(`name: series-commit-${k}\\n`));
      expect(f).toMatch(/ref: main\n {10}fetch-depth: 0/);
      const p = job(`push-${k}`);
      expect(p).toMatch(new RegExp(`name: series-commit-${k}\\n`));
      expect(p).toMatch(/--push-url-env SERIES_PUSH_URL/);
      expect(p).toMatch(/gh workflow run pages\.yml --ref main --repo "\$REPO"/);
      // the push comes before the deploy, in the same step
      expect(p.indexOf('node scripts/series-push.mjs')).toBeLessThan(p.indexOf('gh workflow run pages.yml'));
    }
    // a refused push hands on to the next attempt; the third refusal is red
    expect(job('push-1')).toMatch(/refused: \$\{\{ steps\.push\.outputs\.refused \}\}/);
    expect(job('push-2')).toMatch(/refused: \$\{\{ steps\.push\.outputs\.refused \}\}/);
    expect(job('push-3')).toMatch(/::error::Not pushed after 3 attempts/);
    expect(job('push-3')).not.toMatch(/refused=true/);
  });
});
