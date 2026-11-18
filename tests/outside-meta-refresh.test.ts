// The unattended refresh of the outside picture (.github/workflows/outside-meta.yml; docs/DECK_IMPORT.md "Running by
// itself"): the converter carrying the previous file forward (mergeOutside, --merge), the owner's switch
// (scripts/automation-switch.ts), the last step's diff (scripts/outside-meta-diff.ts), the workflow's safety properties
// read from its text, and a rehearsal of a whole run: the Python step on invented pages behind a fake opener
// (tools/rehearse_outside_meta.py), then the converter into a temporary folder. Nothing here touches the network or
// writes into the repository.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { mergeOutside, OUTSIDE_MAX_SOURCES, outsideMetaProblems, RAW_KIND, readOutsideImport, sameFigures, shrinkWhy, type LegendCard, type OutsideMetaFile, type OutsideSource } from '../src/lib/outsideMeta';
import { importOutsideCommand, outsideFileText } from '../scripts/import-outside-meta-run';
import { automationSwitch } from '../scripts/automation-switch-run';
import { diffVerdict, porcelainPaths } from '../scripts/outside-meta-diff-run';
import { CARD_BY_ID, CARDS } from '../src/engine/cards';
import { defaultSiteConfig, siteConfigText } from '../src/lib/siteConfig';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-outside-refresh-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const LEGENDS: LegendCard[] = [
  { id: 'ana_one', name: 'Ana', subname: 'One' },
  { id: 'bo_two', name: 'Bo', subname: 'Two' },
  { id: 'cy_x', name: 'Cy', subname: 'Ex' },
];
const isLegend = (id: string) => LEGENDS.some((l) => l.id === id);
const realLegends = () => CARDS.filter((c) => c.type === 'Legend');
const realIsLegend = (id: string) => Object.prototype.hasOwnProperty.call(CARD_BY_ID, id) && CARD_BY_ID[id]!.type === 'Legend';

const link = (slug: string) => `https://cyberpunk-tcg-sim.online/meta/${slug}`;
const TRIO = ['Ana', 'Bo', 'Cy: Ex'];

/** A raw page of a tournament report with `n` field rows (each the same trio, so the shares are easy). */
function cup(slug: string, collected: string, published: string, n = 4, topCut = 4) {
  return {
    kind: 'tournament',
    link: link(slug),
    title: `Cup ${slug}`,
    published,
    collected,
    date: published,
    totals: { players: 100, topCut },
    field: Array.from({ length: n }, (_, i) => ({ trio: i % 2 ? TRIO : ['Ana', 'Bo', 'Zed'], players: 5 + i, winRate: 50 })),
    topCut: Array.from({ length: topCut }, (_, i) => ({ place: i + 1, trio: TRIO })),
    notes: [],
  };
}
function season(slug: string, collected: string, published: string, ranked = 4) {
  return {
    kind: 'season',
    link: link(slug),
    title: `Season ${slug}`,
    published,
    collected,
    period: { from: '2026-09-01', to: '2026-11-15' },
    totals: { series: 10 },
    tiers: Array.from({ length: ranked }, (_, i) => ({ rank: i + 1, trio: i ? ['Ana', 'Bo', `X${i}`] : TRIO, tier: 1, winRate: 50, wins: 10, losses: 10, share: 2 })),
    field: [{ trio: TRIO, share: 10, winRate: 52 }],
    matchups: [],
    notes: [],
  };
}
const raw = (pages: unknown[], links: unknown[] = []) => JSON.stringify({ kind: RAW_KIND, schema: 1, ran: '2026-11-18T09:00:00Z', tool: 'tools/import_outside_meta.py', links, pages });
function file(pages: unknown[]): OutsideMetaFile {
  const r = readOutsideImport(raw(pages), LEGENDS);
  if (!r.ok) throw new Error(r.why);
  return r.file;
}

describe('carrying the previous file forward (mergeOutside)', () => {
  const before = file([season('s1', '2026-11-10', '2026-11-09'), cup('c1', '2026-11-10', '2026-11-07')]);

  it('keeps a report not read this run, older day and all, and says why', () => {
    const m = mergeOutside(before, file([season('s1', '2026-11-18', '2026-11-16', 5)]), new Map([['sim:c1', 'failed: the site answered 500']]));
    expect(m.file.sources.map((s) => [s.id, s.collected])).toEqual([
      ['sim:s1', '2026-11-18'],
      ['sim:c1', '2026-11-10'],
    ]);
    expect(m.notes).toEqual(['Cup c1: kept as collected 2026-11-10; not read this run (failed: the site answered 500).']);
    expect(m.file.updated).toBe('2026-11-18');
    expect(outsideMetaProblems(JSON.parse(outsideFileText(m.file)), isLegend)).toEqual([]);
    expect(mergeOutside(before, file([season('s1', '2026-11-18', '2026-11-16', 5)])).notes[0]).toContain('not among this run’s reports');
  });

  it('keeps the previous entry over a hollow reading (under half its rows: a layout change)', () => {
    const prev = file([season('s1', '2026-11-10', '2026-11-09', 10), cup('c1', '2026-11-10', '2026-11-07', 6, 8)]);
    expect(shrinkWhy(prev.sources[0]!, file([season('s1', '2026-11-18', '2026-11-09', 4)]).sources[0]!)).toBe('it read with 4 ranked decks, under half the 10 it had');
    expect(shrinkWhy(prev.sources[0]!, file([season('s1', '2026-11-18', '2026-11-09', 5)]).sources[0]!)).toBeNull();
    const m = mergeOutside(prev, file([season('s1', '2026-11-18', '2026-11-09', 4), cup('c1', '2026-11-18', '2026-11-07', 2, 8)]));
    expect(m.file.sources.map((s) => s.collected)).toEqual(['2026-11-10', '2026-11-10']);
    expect(m.notes).toEqual([
      'Season s1: kept as collected 2026-11-10, because it read with 4 ranked decks, under half the 10 it had (the page’s layout may have changed).',
      'Cup c1: kept as collected 2026-11-10, because it read with 2 field trios, under half the 6 it had (the page’s layout may have changed).',
    ]);
    // the top cut counts too, and a report that changed kind is hollow
    expect(shrinkWhy(prev.sources[1]!, file([cup('c1', '2026-11-18', '2026-11-07', 6, 3)]).sources[0]!)).toBe('it read with 3 top-cut places, under half the 8 it had');
    expect(shrinkWhy(prev.sources[1]!, file([{ ...season('s9', '2026-11-18', '2026-11-07'), link: link('c1') }]).sources[0]!)).toContain('not the tournament report');
  });

  it('never takes a reading older than the entry it has', () => {
    const m = mergeOutside(before, file([season('s1', '2026-11-01', '2026-11-09', 9)]));
    expect(m.file.sources.find((s) => s.id === 'sim:s1')!.collected).toBe('2026-11-10');
    expect(m.notes[0]).toBe('Season s1: kept as collected 2026-11-10; this reading (collected 2026-11-01) is older.');
  });

  it('is byte for byte the same when nothing but the day collected changed', () => {
    const again = file([season('s1', '2026-11-25', '2026-11-09'), cup('c1', '2026-11-25', '2026-11-07')]);
    expect(sameFigures(before.sources[0]!, again.sources[0]!)).toBe(true);
    const m = mergeOutside(before, again);
    expect(outsideFileText(m.file)).toBe(outsideFileText(mergeOutside(null, before).file));
    expect(m.notes).toEqual([]);
    // keys written in another order are the same figures
    const shuffled = JSON.parse(JSON.stringify(before.sources[0]), (_k, v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v)) as OutsideSource;
    expect(sameFigures(shuffled, before.sources[0]!)).toBe(true);
    // one figure moved: the new reading is taken, with its day
    const moved = season('s1', '2026-11-25', '2026-11-09');
    moved.field[0]!.share = 11;
    expect(mergeOutside(before, file([moved])).file.sources.find((s) => s.id === 'sim:s1')!.collected).toBe('2026-11-25');
  });

  it('keeps the eight newest reports by published day (else collected), and says which were dropped', () => {
    const pages = Array.from({ length: 10 }, (_, i) => cup(`c${i}`, '2026-11-18', i === 9 ? '' : `2026-10-${String(10 + i).padStart(2, '0')}`));
    const m = mergeOutside(null, file(pages));
    expect(m.file.sources).toHaveLength(OUTSIDE_MAX_SOURCES);
    // c9 has no published day, so its collected day (the newest) puts it first
    expect(m.file.sources.map((s) => s.id)).toEqual(['sim:c9', 'sim:c8', 'sim:c7', 'sim:c6', 'sim:c5', 'sim:c4', 'sim:c3', 'sim:c2']);
    expect(m.notes).toEqual(['Cup c1: dropped; the file keeps the 8 newest reports (this one is from 2026-10-11).', 'Cup c0: dropped; the file keeps the 8 newest reports (this one is from 2026-10-10).']);
    // the order does not depend on the order read
    expect(outsideFileText(mergeOutside(null, file([...pages].reverse())).file)).toBe(outsideFileText(m.file));
  });

  it('works unmatched names out again from the reports kept', () => {
    const m = mergeOutside(file([cup('c1', '2026-11-10', '2026-11-07')]), file([season('s1', '2026-11-18', '2026-11-16')]));
    expect(m.file.unmatched).toEqual(['X1', 'X2', 'X3', 'Zed']);
    expect(outsideMetaProblems(JSON.parse(outsideFileText(m.file)), isLegend)).toEqual([]);
  });
});

describe('scripts/import-outside-meta.ts --merge and --previous', () => {
  const dir = path.join(tmp, 'cli');
  fs.mkdirSync(dir, { recursive: true });
  const cmd = (argv: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = importOutsideCommand(argv, { out: (l) => out.push(l), err: (l) => err.push(l), legends: () => LEGENDS });
    return { code, out: out.join('\n'), err: err.join('\n') };
  };
  const input = (name: string, pages: unknown[], links: unknown[] = []) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, raw(pages, links));
    return p;
  };
  const out = path.join(dir, 'data', 'outsideMeta.json');

  it('writes the first file, then replaces it in place with --merge only, carrying forward what was not read', () => {
    expect(cmd([input('one.json', [season('s1', '2026-11-10', '2026-11-09'), cup('c1', '2026-11-10', '2026-11-07')]), '--out', out, '--merge']).code).toBe(0);
    const first = fs.readFileSync(out, 'utf8');
    // a later run that could not read the cup: without --merge or --force the file is not touched
    const later = input('two.json', [season('s1', '2026-11-18', '2026-11-16', 6)], [{ link: link('c1'), status: 'failed', note: 'the site answered 500' }]);
    const refused = cmd([later, '--out', out]);
    expect(refused.code).toBe(2);
    expect(refused.err).toContain('pass --merge');
    expect(fs.readFileSync(out, 'utf8')).toBe(first);
    const summary = path.join(dir, 'summary.md');
    const merged = cmd([later, '--out', out, '--merge', '--summary', summary]);
    expect(merged.code).toBe(0);
    expect(merged.out).toContain('Cup c1: kept as collected 2026-11-10; not read this run (failed: the site answered 500).');
    const written = JSON.parse(fs.readFileSync(out, 'utf8')) as OutsideMetaFile;
    expect(written.sources.map((s) => [s.id, s.collected])).toEqual([
      ['sim:s1', '2026-11-18'],
      ['sim:c1', '2026-11-10'],
    ]);
    expect(fs.readFileSync(summary, 'utf8')).toContain('### Outside meta: what changed');
    // the same run again: nothing to write, and the summary says so
    expect(cmd([later, '--out', out, '--merge', '--summary', summary]).out).toContain('already holds these figures; nothing to write');
    expect(fs.readFileSync(summary, 'utf8')).toContain('### Outside meta: no change');
  });

  it('refuses --merge onto a file other than the one it carried forward, and a previous file that is not sound', () => {
    const other = path.join(dir, 'other.json');
    fs.writeFileSync(other, outsideFileText(file([cup('c7', '2026-11-01', '2026-11-01')])));
    const r = cmd([input('three.json', [cup('c8', '2026-11-18', '2026-11-18')]), '--out', other, '--previous', out, '--merge']);
    expect(r.code).toBe(2);
    expect(r.err).toContain('pass --merge');
    expect(cmd([input('four.json', [cup('c8', '2026-11-18', '2026-11-18')]), '--previous', path.join(dir, 'missing.json'), '--out', path.join(dir, 'new.json')]).err).toContain('does not exist');
    const broken = path.join(dir, 'broken.json');
    fs.writeFileSync(broken, '{"kind":"nct-outside-meta","schema":1,"updated":"x","sources":[],"unmatched":[]}');
    const b = cmd([input('five.json', [cup('c8', '2026-11-18', '2026-11-18')]), '--out', broken, '--merge']);
    expect(b.code).toBe(2);
    expect(b.err).toContain('is not a sound outside-meta file');
    expect(cmd([input('five.json', [cup('c8', '2026-11-18', '2026-11-18')]), '--out', broken, '--fresh', '--force']).code).toBe(0);
    expect(cmd([input('five.json', [cup('c8', '2026-11-18', '2026-11-18')]), '--out', broken, '--fresh', '--merge']).code).toBe(2);
  });
});

describe('the switch (scripts/automation-switch.ts)', () => {
  const run = (argv: string[], files: Record<string, string>) => {
    const out: string[] = [];
    const err: string[] = [];
    const appended: Record<string, string> = {};
    const code = automationSwitch(argv, {
      out: (l) => out.push(l),
      err: (l) => err.push(l),
      read: (f) => files[f] ?? null,
      append: (f, t) => (appended[f] = (appended[f] ?? '') + t),
    });
    return { code, out: out.join('\n'), err: err.join('\n'), appended };
  };
  const config = (features: Record<string, boolean>) => JSON.stringify({ kind: 'nct-site-config', schema: 1, features });

  it('says on for the committed site config, and for a file that does not name the feature (its default)', () => {
    const committed = fs.readFileSync('public/site-config.json', 'utf8');
    expect(run(['outsideMeta'], { 'public/site-config.json': committed }).out).toBe('on');
    const r = run(['outsideMeta', '--config', 'c.json', '--github-output', 'o'], { 'c.json': config({ coach: false }) });
    expect(r).toMatchObject({ code: 0, out: 'on', appended: { o: 'on=true\n' } });
    expect(run(['outsideMeta'], { 'public/site-config.json': siteConfigText(defaultSiteConfig()) }).out).toBe('on');
  });

  it('says off when the owner unticked it, and leaves a notice in the summary', () => {
    const r = run(['outsideMeta', '--config', 'c.json', '--github-output', 'o', '--summary', 's'], { 'c.json': config({ outsideMeta: false }) });
    expect(r.code).toBe(0);
    expect(r.out).toBe('off');
    expect(r.appended.o).toBe('on=false\n');
    expect(r.appended.s).toContain('Figures from other sites: switched off');
  });

  it('fails closed on a missing or broken file (exit 1) and refuses an unknown feature (exit 2)', () => {
    expect(run(['outsideMeta'], {}).code).toBe(1);
    expect(run(['outsideMeta', '--config', 'c.json'], { 'c.json': '{not json' }).code).toBe(1);
    expect(run(['outsideMeta', '--config', 'c.json'], { 'c.json': JSON.stringify({ kind: 'nct-site-config', schema: 1, features: { outsideMeta: 'yes' } }) }).code).toBe(1);
    expect(run(['noSuchFeature'], {}).code).toBe(2);
    expect(run([], {}).code).toBe(2);
    expect(run(['outsideMeta', '--bogus'], {}).code).toBe(2);
  });
});

describe('the last step (scripts/outside-meta-diff.ts)', () => {
  it('reads git status', () => {
    expect(porcelainPaths(' M src/data/outsideMeta.json\n?? new.txt\nR  a.ts -> b.ts\n')).toEqual(['src/data/outsideMeta.json', 'new.txt', 'b.ts']);
  });
  it('commits the data file alone', () => {
    expect(diffVerdict('', false)).toMatchObject({ changed: false, others: [] });
    expect(diffVerdict('?? src/data/outsideMeta.json\n', false).changed).toBe(true);
    expect(diffVerdict(' M src/data/outsideMeta.json\n', true).summary.join(' ')).toContain('dry run');
    const other = diffVerdict(' M src/data/outsideMeta.json\n M src/lib/outsideMeta.ts\n', false);
    expect(other.changed).toBe(false);
    expect(other.others).toEqual(['src/lib/outsideMeta.ts']);
  });
});

describe('the workflow file (.github/workflows/outside-meta.yml)', () => {
  const text = fs.readFileSync('.github/workflows/outside-meta.yml', 'utf8').replace(/\r\n/g, '\n');
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
  const jobs = { refresh: block(/^ {2}refresh:$/), commit: block(/^ {2}commit:$/) };

  it('pins every action to a full commit SHA with its tag beside it, reusing pages.yml’s pins', () => {
    const uses = lines.filter((l) => /^\s*(-\s+)?uses:/.test(l));
    expect(uses.length).toBeGreaterThanOrEqual(5);
    for (const l of uses) expect(l, l).toMatch(/uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/);
    const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
    for (const action of ['actions/checkout', 'actions/setup-node']) {
      const pin = (t: string) => t.match(new RegExp(`${action}@([0-9a-f]{40})`))?.[1];
      expect(pin(text), action).toBe(pin(pages));
    }
  });

  it('reads only at the top, and writes only in the commit job, which runs no repository code', () => {
    expect(block(/^permissions:$/).map((l) => l.trim())).toEqual(['permissions:', 'contents: read', '']);
    const writes = lines.filter((l) => /:\s*write\b/.test(code(l)));
    expect(writes.map((l) => l.trim())).toEqual(['contents: write', 'actions: write']);
    expect(jobs.commit.some((l) => /contents: write/.test(l))).toBe(true);
    expect(jobs.refresh.some((l) => /:\s*write\b/.test(code(l)))).toBe(false);
    const commitCode = jobs.commit.map(code).join('\n');
    expect(commitCode).not.toMatch(/\b(npm|npx|node|tsx|python3?)\b|setup-node/);
    expect(jobs.commit.join('\n')).toMatch(/needs: refresh/);
    expect(jobs.commit.join('\n')).toMatch(/if: \$\{\{ !github\.event\.repository\.fork && needs\.refresh\.outputs\.changed == 'true' && inputs\.dry_run != true && github\.ref == 'refs\/heads\/main' \}\}/);
    // the refresh checks out without keeping a token, and has a time limit
    expect(jobs.refresh.join('\n')).toMatch(/persist-credentials: false/);
    expect(jobs.refresh.join('\n')).toMatch(/timeout-minutes: 30/);
    expect(jobs.refresh.join('\n')).toMatch(/if: \$\{\{ !github\.event\.repository\.fork \}\}/);
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
    expect(runs).toBeGreaterThanOrEqual(10);
  });

  it('runs weekly and on demand with a dry-run choice, one run at a time', () => {
    expect(text).toMatch(/^on:\n {2}schedule:\n(?: {4}#.*\n)? {4}- cron: '\d{1,2} \d{1,2} \* \* \d'\n {2}workflow_dispatch:\n {4}inputs:\n {6}dry_run:/m);
    expect(block(/^concurrency:$/).join('\n')).toMatch(/group: outside-meta\n {2}cancel-in-progress: false/);
  });

  it('asks the switch before any request to the site, and runs pages.yml’s checks before anything is uploaded', () => {
    const r = jobs.refresh.join('\n');
    const at = (s: string) => r.indexOf(s);
    expect(at('scripts/automation-switch.ts outsideMeta')).toBeGreaterThan(0);
    expect(at('scripts/automation-switch.ts')).toBeLessThan(at('tools/import_outside_meta.py'));
    for (const check of ['npm run typecheck', 'npx vitest run', 'python3 -m unittest discover -s tools', 'npm run lint', 'npm run check:data', 'npx vite build']) {
      expect(at(check), check).toBeGreaterThan(at('scripts/import-outside-meta.ts'));
      expect(at(check), check).toBeLessThan(at('actions/upload-artifact'));
    }
    expect(r).toMatch(/path: src\/data\/outsideMeta\.json/);
    expect(jobs.commit.join('\n')).toMatch(/gh workflow run pages\.yml --ref main/);
  });
});

// ---------------------------------------------------------------- the rehearsal

/** A Python 3 to run the script with, or null (the check job has python3; Windows has python). */
function pythonExe(): string | null {
  for (const exe of ['python3', 'python']) {
    const r = spawnSync(exe, ['--version'], { encoding: 'utf8' });
    if (r.status === 0 && /Python 3\./.test(`${r.stdout}${r.stderr}`)) return exe;
  }
  return null;
}
const PYTHON = pythonExe();

describe.skipIf(!PYTHON)('a rehearsal of the scheduled run, on invented pages behind a fake opener', () => {
  const dir = path.join(tmp, 'rehearsal');
  fs.mkdirSync(dir, { recursive: true });
  // the Python tests' invented pages, with real Legend names so most of them match the card data
  const dump = PYTHON
    ? spawnSync(
        PYTHON,
        [
          '-c',
          'import json, sys; sys.path.insert(0, "tools"); import test_import_outside_meta as t, test_import_decks as d; print(json.dumps({"season": t.SEASON_LINKED, "cup": t.CUP, "index": t.INDEX, "new": t.NEW_CUP, "odd": t.ODD, "robots": d.SIM_ROBOTS}))',
        ],
        { encoding: 'utf8' },
      )
    : { status: null, stdout: '', stderr: 'no Python 3' };
  const names: [RegExp, string][] = [
    [/\bGamma: Gee\b/g, 'V: Streetkid'],
    [/\bAlpha\b/g, 'Adam Smasher'],
    [/\bBeta\b/g, 'Padre'],
    [/\bTheta\b/g, 'V: Corporate Exile'],
    [/\bDelta\b/g, 'River Ward'],
    [/\bEta\b/g, 'Muamar Reyes'],
  ];
  const fx = JSON.parse(dump.stdout || '{}') as Record<string, string>;
  const real = (s: string) => names.reduce((t, [re, n]) => t.replace(re, n), s);
  const ROBOTS = 'https://cyberpunk-tcg-sim.online/robots.txt';
  const SEASON = link('made-up-season');
  const CUP = link('made-up-cup');
  const pagesFor = (over: Record<string, [number | string, string]> = {}) => ({
    [ROBOTS]: [200, fx.robots!],
    [SEASON]: [200, real(fx.season!)],
    [CUP]: [200, real(fx.cup!)],
    'https://cyberpunk-tcg-sim.online/meta': [200, fx.index!],
    [link('new-cup')]: [200, real(fx.new!)],
    [link('odd-page')]: [200, fx.odd!],
    ...over,
  });
  const data = path.join(dir, 'src', 'data', 'outsideMeta.json');
  const rawOut = path.join(dir, 'outside-meta-import.json');
  const summary = path.join(dir, 'summary.md');

  /** The workflow's two steps: the Python step (fake opener), then the converter with --merge if the first passed. */
  function step(pages: Record<string, unknown>, now: string) {
    const pagesFile = path.join(dir, 'pages.json');
    const asked = path.join(dir, 'asked.json');
    fs.writeFileSync(pagesFile, JSON.stringify(pages));
    fs.rmSync(rawOut, { force: true });
    fs.writeFileSync(summary, '');
    // the default run: the two default reports (here invented ones) are given as links with --discover, since the
    // script's own defaults name the real site's reports
    const py = spawnSync(PYTHON!, ['tools/rehearse_outside_meta.py', pagesFile, asked, now, SEASON, CUP, '--discover', '--out', rawOut, '--summary', summary], { encoding: 'utf8' });
    const requests = JSON.parse(fs.readFileSync(asked, 'utf8')) as string[];
    if (py.status !== 0) return { python: py.status, requests, convert: null as number | null, out: py.stdout + py.stderr };
    const lines: string[] = [];
    const convert = importOutsideCommand([rawOut, '--out', data, '--merge', '--summary', summary], { out: (l) => lines.push(l), err: (l) => lines.push(l), legends: realLegends });
    return { python: py.status, requests, convert, out: lines.join('\n') };
  }

  it('finds its fixtures', () => {
    expect(dump.status, dump.stderr).toBe(0);
    expect(fx.robots).toContain('Content-Signal: search=yes,ai-train=no,use=reference');
  });

  it('reads the robots file first, follows the breadcrumb to a new report, writes a data file that passes check:data', () => {
    const r = step(pagesFor(), '2026-11-18T04:37:00Z');
    expect(r.python, r.out).toBe(0);
    expect(r.convert, r.out).toBe(0);
    expect(r.requests).toEqual([ROBOTS, SEASON, CUP, 'https://cyberpunk-tcg-sim.online/meta', link('new-cup'), link('odd-page')]);
    const written = JSON.parse(fs.readFileSync(data, 'utf8')) as OutsideMetaFile;
    expect(outsideMetaProblems(written, realIsLegend)).toEqual([]);
    expect(written.sources.map((s) => s.id).sort()).toEqual(['sim:made-up-cup', 'sim:made-up-season', 'sim:new-cup']);
    expect(written.updated).toBe('2026-11-18');
    const rawDoc = JSON.parse(fs.readFileSync(rawOut, 'utf8')) as { robots: { verdict: string; sha256: string }[]; links: { status: string }[] };
    expect(rawDoc.robots[0]!.verdict).toBe('kept to');
    expect(rawDoc.links.map((l) => l.status)).toContain('not a report');
    const said = fs.readFileSync(summary, 'utf8');
    expect(said).toContain(rawDoc.robots[0]!.sha256);
    expect(said).toContain('new: ');
  });

  it('a week later with the same figures, writes nothing: the file is byte for byte the same', () => {
    const before = fs.readFileSync(data, 'utf8');
    const r = step(pagesFor(), '2026-11-25T04:37:00Z');
    expect(r.convert, r.out).toBe(0);
    expect(r.out).toContain('already holds these figures');
    expect(fs.readFileSync(data, 'utf8')).toBe(before);
  });

  it('a page whose layout changed keeps its previous entry', () => {
    const before = JSON.parse(fs.readFileSync(data, 'utf8')) as OutsideMetaFile;
    const hollow = real(fx.season!).replace(/<article class="report-rank[\s\S]*?<\/article>/g, '');
    const r = step(pagesFor({ [SEASON]: [200, hollow] }), '2026-11-25T04:37:00Z');
    expect(r.convert, r.out).toBe(0);
    expect(r.out).toContain('because it read with 0 ranked decks, under half the 2 it had');
    const after = JSON.parse(fs.readFileSync(data, 'utf8')) as OutsideMetaFile;
    expect(after.sources.find((s) => s.id === 'sim:made-up-season')).toEqual(before.sources.find((s) => s.id === 'sim:made-up-season'));
  });

  it('stops before any page when the content signals change (exit 3), and leaves the data alone', () => {
    const before = fs.readFileSync(data, 'utf8');
    const r = step(pagesFor({ [ROBOTS]: [200, fx.robots!.replace('ai-train=no', 'ai-train=yes')] }), '2026-12-02T04:37:00Z');
    expect(r.python).toBe(3);
    expect(r.requests).toEqual([ROBOTS]);
    const stopped = JSON.parse(fs.readFileSync(rawOut, 'utf8')) as { pages: unknown[]; stopped: string; robots: { genericSignals: Record<string, string> }[] };
    expect(stopped.pages).toEqual([]);
    expect(stopped.stopped).toContain('ai-train=yes');
    expect(stopped.robots[0]!.genericSignals['ai-train']).toBe('yes');
    expect(fs.readFileSync(summary, 'utf8')).toContain('Stopped by the site');
    expect(fs.readFileSync(data, 'utf8')).toBe(before);
    // a missing robots file stops the same way
    const missing = pagesFor();
    delete (missing as Record<string, unknown>)[ROBOTS];
    expect(step(missing, '2026-12-02T04:37:00Z')).toMatchObject({ python: 3, requests: [ROBOTS] });
  });

  it('stops at a 403 (exit 1), and leaves the data alone', () => {
    const before = fs.readFileSync(data, 'utf8');
    const r = step(pagesFor({ [SEASON]: [403, ''] }), '2026-12-02T04:37:00Z');
    expect(r.python).toBe(1);
    expect(r.requests).toEqual([ROBOTS, SEASON]);
    expect(r.convert).toBeNull();
    expect(fs.readFileSync(data, 'utf8')).toBe(before);
  });
});
