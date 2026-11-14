// Knowledge pack evaluation (src/lib/kb/eval.ts, scripts/kb-eval.ts; docs/RAG_PLAN.md step 1.4): the metric maths on
// invented fixtures, the seeded paired bootstrap, the question file's shape and split rule, and that every expected
// card, deck, deck note, package, term, ruling and guide is a record of a pack built from the real public sources.
// Doc and code expectations are checked only as far as their file existing (a renamed heading is reported as stale
// by the script, not failed here); rules, FAQ, tournament-rule and errata ids come from data/raw and are not checked.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateScope, readQuestions, renderMarkdown, reportJson } from '../scripts/kb-eval';
import { buildFromSources } from '../scripts/kb-sources';
import { finishRecord } from '../src/lib/kb/build/record';
import {
  availability,
  compareRuns,
  expectKind,
  firstRank,
  LOCAL_KINDS,
  meets,
  metrics,
  pairedBootstrap,
  parseTuning,
  QUESTION_SPLITS,
  QUESTION_TYPES,
  quantile,
  questionFileProblems,
  runQuestions,
  seededRandom,
  sizeStats,
  summarize,
  type KbQuestion,
  type QuestionResult,
} from '../src/lib/kb/eval';
import { buildIndex } from '../src/lib/kb/search';
import { kindOfId, type KbLink, type KbRecord } from '../src/lib/kb/types';

const ROOT = path.resolve(__dirname, '..');

const rec = (id: string, title: string, text: string, more: { links?: KbLink[]; scope?: 'public' | 'local'; aliases?: string[] } = {}): KbRecord =>
  finishRecord({ id, kind: kindOfId(id)!, title, text, source: { file: 'fixture' }, origin: more.scope === 'local' ? 'official' : 'authored', scope: 'public', ...more });

const FIXTURE = [
  rec('card:kilo_byte', 'Kilo Byte', 'Kilo Byte is an invented Program that trashes the top card of your deck.'),
  rec('ruling:aaaaaaaa', 'Kilo Byte ruling 1', 'Invented ruling: Kilo Byte still trashes with one card left.', { links: [{ rel: 'card', to: 'card:kilo_byte' }] }),
  rec('doc:notes.md#method', 'Method', 'The method ranks names before keywords.'),
  rec('doc:notes.md#method~2', 'Method (part 2)', 'Quasar passages continue the method.'),
  rec('rule:9.9', 'Rule 9.9 (Invented)', 'An invented rule about quasars.', { scope: 'local' }),
];

const q = (id: string, text: string, expect: string[], more: Partial<KbQuestion> = {}): KbQuestion => ({ id, q: text, type: 'entity', scope: 'public', split: 'dev', expect, ...more });

describe('matching and ranks', () => {
  it('meets an id exactly, or any passage of a doc section with a trailing *', () => {
    expect(meets('card:x', 'card:x')).toBe(true);
    expect(meets('card:xy', 'card:x')).toBe(false);
    expect(meets('doc:a.md#b', 'doc:a.md#b*')).toBe(true);
    expect(meets('doc:a.md#b~12', 'doc:a.md#b*')).toBe(true);
    expect(meets('doc:a.md#b-c', 'doc:a.md#b*')).toBe(false);
    expect(meets('doc:a.md#b~x', 'doc:a.md#b*')).toBe(false);
  });
  it('finds the 1-based rank of the first expected record', () => {
    expect(firstRank(['a:1', 'card:x', 'card:y'], ['card:y', 'card:x'])).toBe(2);
    expect(firstRank(['a:1'], ['card:x'])).toBeNull();
    expect(firstRank([], ['card:x'])).toBeNull();
  });
  it('names the kind of an expected id', () => {
    expect(expectKind('pkg:relic-loop')).toBe('package');
    expect(expectKind('doc:a.md#b*')).toBe('doc');
    expect(expectKind('nope:x')).toBeUndefined();
  });
});

describe('metrics', () => {
  it('computes recall at 1, 5 and 10 and MRR at 10', () => {
    const m = metrics([1, 2, 5, 6, 10, 11, null, 3]);
    expect(m.n).toBe(8);
    expect(m.r1).toBeCloseTo(1 / 8);
    expect(m.r5).toBeCloseTo(4 / 8);
    expect(m.r10).toBeCloseTo(6 / 8);
    expect(m.mrr).toBeCloseTo((1 + 1 / 2 + 1 / 5 + 1 / 6 + 1 / 10 + 1 / 3) / 8);
    expect(metrics([])).toEqual({ n: 0, r1: 0, r5: 0, r10: 0, mrr: 0 });
  });
  it('takes quantiles by the nearest-rank rule, and the mean and 90th percentile of sizes', () => {
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
    expect(quantile([5], 0.9)).toBe(5);
    expect(quantile([], 0.5)).toBe(0);
    expect(sizeStats([30, 10, 20, 40, 100, 50, 60, 70, 80, 90])).toEqual({ mean: 55, p90: 90 });
  });
});

describe('paired bootstrap', () => {
  const a = [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0];
  const b = [1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0];
  it('is the same for the same seed and moves with the seed', () => {
    const x = pairedBootstrap(a, b, { seed: 7 });
    expect(pairedBootstrap(a, b, { seed: 7 })).toEqual(x);
    expect(x.n).toBe(12);
    expect(x.diff).toBeCloseTo(4 / 12);
    expect(x.lo).toBeLessThanOrEqual(x.diff);
    expect(x.hi).toBeGreaterThanOrEqual(x.diff);
    expect(x.lo).toBeGreaterThan(0);
    // another seed draws other resamples (the interval of 0/1 data may still land on the same values)
    const draws = (seed: number) => Array.from({ length: 5 }, seededRandom(seed));
    expect(draws(8)).not.toEqual(draws(7));
    const few = (seed: number) => pairedBootstrap([0.1, 0.7, 0.3, 0.9, 0.2], [0.4, 0.6, 0.8, 0.5, 0.95], { seed, resamples: 50 });
    expect(few(1)).toEqual(few(1));
    expect(few(2)).not.toEqual(few(1));
  });
  it('gives a zero-width interval when every difference is the same, and refuses unequal lengths', () => {
    expect(pairedBootstrap([0, 0, 0], [1, 1, 1])).toEqual({ n: 3, diff: 1, lo: 1, hi: 1 });
    expect(pairedBootstrap([], [])).toEqual({ n: 0, diff: 0, lo: 0, hi: 0 });
    expect(() => pairedBootstrap([1], [1, 2])).toThrow();
  });
  it('uses its own seeded generator, uniform in [0, 1)', () => {
    const r = seededRandom(1);
    const xs = Array.from({ length: 1000 }, r);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(xs.reduce((s, x) => s + x, 0) / xs.length).toBeCloseTo(0.5, 1);
    expect(seededRandom(1)()).toBe(xs[0]);
  });
  it('pairs two runs by question id', () => {
    const run = (ranks: Record<string, number | null>): QuestionResult[] => Object.entries(ranks).map(([id, rank]) => ({ id, type: 'entity', split: 'dev', rank, top: [], tokens: 0, refused: false }));
    const before = run({ q1: null, q2: 1, q3: 4 });
    const after = run({ q3: 1, q2: 1, q1: 2, q9: 1 });
    const c = compareRuns(before, after, 'mrr', { seed: 1 });
    expect(c.n).toBe(3);
    expect(c.diff).toBeCloseTo((1 / 2 + 0 + (1 - 1 / 4)) / 3);
    expect(compareRuns(before, after, 'r5').diff).toBeCloseTo(1 / 3);
  });
});

describe('questions the pack cannot answer (type none)', () => {
  const r = (id: string, type: QuestionResult['type'], rank: number | null, refused: boolean): QuestionResult => ({ id, type, split: 'dev', rank, top: [], tokens: 10, refused });
  const rs = [r('q1', 'entity', 1, false), r('q2', 'rules', null, true), r('q3', 'none', null, true), r('q4', 'none', null, false), r('q5', 'none', null, true)];

  it('leaves them out of recall and MRR, and counts refusals right and wrong', () => {
    const s = summarize(rs);
    expect([s.n, s.r1, s.mrr]).toEqual([2, 0.5, 0.5]);
    expect(s.refusal).toEqual({ n: 3, refused: 2, rate: 2 / 3 });
    expect(s.wrongRefusals).toEqual({ n: 2, refused: 1, rate: 0.5 });
    expect(summarize([]).refusal).toEqual({ n: 0, refused: 0, rate: 0 });
  });
  it('pairs only answerable questions in a comparison', () => {
    const after = rs.map((x) => ({ ...x, rank: x.type === 'none' ? 1 : x.rank }));
    expect(compareRuns(rs, after, 'mrr')).toMatchObject({ n: 2, diff: 0 });
  });
  it('asks them of every pack: never skipped, never stale', () => {
    expect(availability(q('q1', 'x', [], { type: 'none' }), () => false, () => false, false)).toEqual({ stale: [], skip: false });
  });
  it('scores a refusal on an index', () => {
    const [none, kilo] = runQuestions(buildIndex(FIXTURE), [q('q001', 'xyzzy plugh', [], { type: 'none' }), q('q002', 'Kilo Byte', ['card:kilo_byte'])], 'exact+linked+keyword');
    expect([none!.refused, kilo!.refused, kilo!.rank]).toEqual([true, false, 1]);
  });
});

describe('search settings for experiments (--tune)', () => {
  it('reads key=value pairs and refuses anything else', () => {
    expect(parseTuning('floor=0.34,floorHits=3,singleWordTermLinks=false,deckPairMatchup=true')).toEqual({ floor: 0.34, floorHits: 3, singleWordTermLinks: false, deckPairMatchup: true });
    expect(parseTuning('floor=1')).toEqual({ floor: 1 });
    for (const bad of ['', 'floor', 'floor=1.5', 'floor=-1', 'floorHits=0', 'floorHits=2.5', 'singleWordTermLinks=yes', 'speed=3', 'floor=0.4,floor=0.3']) expect(typeof parseTuning(bad), bad).toBe('string');
  });
});

describe('running questions', () => {
  const ix = buildIndex(FIXTURE);
  it('ranks, scores and sizes each question', () => {
    const rs = runQuestions(ix, [q('q001', 'Kilo Byte', ['card:kilo_byte']), q('q002', 'Kilo Byte rulings', ['ruling:aaaaaaaa']), q('q003', 'quasar method', ['doc:notes.md#method*']), q('q004', 'xyzzy plugh', ['card:kilo_byte'])], 'exact+linked+keyword');
    // "rulings" asks for a ruling: the card's ruling joins the exact hits and comes first
    expect(rs.map((r) => r.rank)).toEqual([1, 1, 1, null]);
    expect(rs[3]!.top).toEqual([]);
    expect(rs.every((r) => r.tokens > 0)).toBe(true);
    expect(runQuestions(ix, [q('q001', 'Kilo Byte rulings', ['ruling:aaaaaaaa'])], 'exact')[0]!.rank).toBeNull();
  });
  it('treats a missing local id as unavailable without data/raw, and as stale with it', () => {
    const has = (id: string) => FIXTURE.some((r) => r.id === id);
    const hasPrefix = (b: string) => FIXTURE.some((r) => r.id === b || r.id.startsWith(`${b}~`));
    expect(availability(q('q1', 'x', ['rule:1.1'], { scope: 'local' }), has, hasPrefix, false)).toEqual({ stale: [], skip: true });
    expect(availability(q('q1', 'x', ['rule:1.1'], { scope: 'local' }), has, hasPrefix, true)).toEqual({ stale: ['rule:1.1'], skip: true });
    expect(availability(q('q1', 'x', ['card:kilo_byte', 'rule:1.1']), has, hasPrefix, false)).toEqual({ stale: [], skip: false });
    expect(availability(q('q1', 'x', ['card:gone', 'doc:notes.md#method*']), has, hasPrefix, false)).toEqual({ stale: ['card:gone'], skip: false });
    expect(availability(q('q1', 'x', ['doc:notes.md#other*']), has, hasPrefix, false)).toEqual({ stale: ['doc:notes.md#other*'], skip: true });
  });
  it('searches only public records in the public scope and skips local questions there', () => {
    const qs = [q('q001', 'quasar rule', ['rule:9.9'], { scope: 'local', type: 'rules' }), q('q002', 'Kilo Byte', ['card:kilo_byte'])];
    const all = evaluateScope('all', FIXTURE, qs, ['keyword']);
    const pub = evaluateScope('public', FIXTURE, qs, ['keyword']);
    expect(all.localPresent).toBe(true);
    expect(all.runs[0]!.results.map((r) => r.id)).toEqual(['q001', 'q002']);
    expect(pub.localPresent).toBe(false);
    expect(pub.skipped).toEqual(['q001']);
    expect(pub.records).toBe(FIXTURE.length - 1);
  });
  it('writes reports with ids and titles, not record text, and the same bytes twice', () => {
    const qs = [q('q001', 'quasar rule', ['rule:9.9'], { scope: 'local', type: 'rules' }), q('q002', 'method quasar', ['card:kilo_byte']), q('q003', 'xyzzy plugh', [], { type: 'none' }), q('q004', 'Kilo Byte price', [], { type: 'none' })];
    const file = { kind: 'nct-kb-questions' as const, schema: 1 as const, status: 'draft' as const, questions: qs };
    const make = () => {
      const scopes = [evaluateScope('all', FIXTURE, qs, ['keyword', 'exact+linked+keyword']), evaluateScope('public', FIXTURE, qs, ['exact+linked+keyword'])];
      const common = { file, questionsFile: 'fixture.json', split: 'all', seed: 1, scopes, comparisons: [] };
      // as the script does: titles of public records only
      const titles = new Map(FIXTURE.filter((r) => r.scope === 'public').map((r) => [r.id, r.title]));
      return renderMarkdown({ ...common, titles, questions: new Map(qs.map((x) => [x.id, x])) }) + JSON.stringify(reportJson(common));
    };
    const out = make();
    expect(make()).toBe(out);
    expect(out).toMatch(/rule:9\.9(?! \()/);
    expect(out).not.toContain('Rule 9.9 (Invented)');
    expect(out).toMatch(/doc:notes\.md#method(~2)? \(Method/);
    for (const r of FIXTURE) expect(out).not.toContain(r.text);
    // refusal beside recall: one of the two none questions refused, the other answered (and listed for dev)
    expect(out).toMatch(/\| exact\+linked\+keyword \| dev \| 2 \|.*\| 1 of 2 \(50\.0%\) \| \d+ of 2 /);
    expect(out).toContain('### Dev questions the pack cannot answer, answered anyway under exact+linked+keyword');
    expect(out).toMatch(/\| q004 \| Kilo Byte price \| card:kilo_byte \(Kilo Byte\)/);
    expect(out).toContain('"refusal":{"n":2,"refused":1,"rate":0.5}');
  });
});

describe('the question set', () => {
  const file = readQuestions('data/kb/questions.json');
  const qs = file.questions;

  it('is well formed: kind, schema, unique ids, known types, scopes and splits', () => {
    expect(questionFileProblems(file)).toEqual([]);
    expect(file.status).toBe('draft');
    expect(new Set(qs.map((x) => x.id)).size).toBe(qs.length);
    expect(qs.length).toBeGreaterThanOrEqual(176);
    // ids run q001, q002, … in file order (questions are only ever appended)
    qs.forEach((x, i) => expect(x.id).toBe(`q${String(i + 1).padStart(3, '0')}`));
    // every type has questions (step 1.6 added none 12, rules 10, number 8; q147-q176 added paraphrase 30); number
    // questions expect measured records only
    const counts = Object.fromEntries(QUESTION_TYPES.map((t) => [t, qs.filter((x) => x.type === t).length]));
    expect(counts).toEqual({ entity: 20, paraphrase: 55, cross: 15, number: 24, dev: 20, rules: 30, none: 12 });
    for (const x of qs.filter((y) => y.type === 'number')) for (const e of x.expect) expect(['event', 'round', 'rating', 'matchup'], `${x.id} ${e}`).toContain(expectKind(e));
    // none questions: public, nothing expected
    for (const x of qs.filter((y) => y.type === 'none')) expect([x.scope, x.expect], x.id).toEqual(['public', []]);
    for (const x of qs) {
      expect(QUESTION_TYPES).toContain(x.type);
      expect(QUESTION_SPLITS).toContain(x.split);
    }
    expect(questionFileProblems({ kind: 'x', schema: 2, status: 'draft', questions: [{ id: 'q1', q: '', type: 'nope', scope: 'x', split: 'y', expect: ['nope:1'] }] }).length).toBeGreaterThanOrEqual(7);
    const one = (x: Partial<KbQuestion>) => questionFileProblems({ kind: 'nct-kb-questions', schema: 1, status: 'draft', questions: [{ id: 'q001', q: 'x', type: 'none', scope: 'public', split: 'dev', expect: [], ...x }] });
    expect(one({})).toEqual([]);
    expect(one({ expect: ['card:x'] })).toEqual(['question 1 (q001): a none question expects nothing (expect: [])']);
    expect(one({ scope: 'local' })).toEqual(['question 1 (q001): a none question is public (it is asked of every pack)']);
    expect(one({ type: 'entity' })).toEqual(['question 1 (q001): expect must be a non-empty list of ids']);
  });

  it('follows its split rule: within each type, position i is test when i mod 5 is 1 or 3 (40%)', () => {
    for (const t of QUESTION_TYPES) {
      const ofType = qs.filter((x) => x.type === t);
      ofType.forEach((x, i) => expect(x.split, x.id).toBe(i % 5 === 1 || i % 5 === 3 ? 'test' : 'dev'));
    }
    const test = qs.filter((x) => x.split === 'test').length;
    expect(test / qs.length).toBeCloseTo(0.4, 1);
  });

  it('marks local exactly the questions that only data/raw records answer', () => {
    for (const x of qs.filter((y) => y.type !== 'none')) {
      const onlyLocal = x.expect.every((e) => LOCAL_KINDS.includes(expectKind(e)!));
      expect(x.scope, x.id).toBe(onlyLocal ? 'local' : 'public');
    }
  });

  it('expects only records that exist: public records in a pack built from the real sources, files for docs and code', async () => {
    const { records } = await buildFromSources(ROOT, { raw: false });
    const ids = new Set(records.map((r) => r.id));
    const missing: string[] = [];
    for (const x of qs)
      for (const e of x.expect) {
        const kind = expectKind(e)!;
        if (LOCAL_KINDS.includes(kind)) continue;
        if (kind === 'doc' || kind === 'code') {
          const file = e.slice(e.indexOf(':') + 1).replace(/[#*].*$/, '');
          if (!fs.existsSync(path.join(ROOT, file))) missing.push(`${x.id}: ${e}`);
        } else if (!ids.has(e)) missing.push(`${x.id}: ${e}`);
      }
    expect(missing).toEqual([]);
  }, 30_000);
});

describe('the script', () => {
  const tsx = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const run = (...args: string[]) => spawnSync(process.execPath, [tsx, 'scripts/kb-eval.ts', ...args], { cwd: ROOT, encoding: 'utf8' });
  it('prints its header for --help and exits 2 on a bad command line, before reading the pack', () => {
    const help = run('--help');
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/^Knowledge pack evaluation/);
    expect(help.stdout).toContain('--compare a,b');
    expect(help.stdout).toContain('--tune k=v');
    for (const bad of [['--bogus'], ['--split', 'train'], ['--scope', 'local'], ['--config', 'vector'], ['--compare', 'exact'], ['--seed', 'x'], ['--against', 'no/such/file.json'], ['--tune', 'floor=2'], ['--tune', 'speed=1']]) {
      const r = run(...bad);
      expect(r.status, bad.join(' ')).toBe(2);
      expect(r.stderr).toMatch(/error: /);
    }
  }, 60_000);
});
