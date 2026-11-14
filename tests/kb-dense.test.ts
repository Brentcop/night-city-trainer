// Knowledge pack embeddings (docs/RAG_PLAN.md step 4.1): the dense index and ranker (src/lib/kb/dense.ts) on hand-made
// vectors, the dense list in the fusion and the "no match" rule with a fake index, the vector cache of
// scripts/kb-dense.ts with a fake embedder in a temp directory, and the messages when the tools are absent. None of this
// needs the model; one test at the end runs only when the real tools and model are in .cache/kb-dense/.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EVAL_SPEC, LEXICAL_CONFIGS, runEval, type ReportPair } from '../scripts/kb-eval';
import { denseFor, DENSE_DIR, densePaths, denseStatus, DENSE_MODEL, embedQueries, loadEmbedder, missingText, QUERY_PREFIX, readVectors, refreshVectors, textHash, vectorState, type Embed } from '../scripts/kb-dense';
import { denseStatsText, parseKbArgs } from '../scripts/kb';
import { ArgError, parseArgs } from '../scripts/lib-node';
import { finishRecord } from '../src/lib/kb/build/record';
import { alignDense, denseIndex, denseText, rankDense, type DenseIndex } from '../src/lib/kb/dense';
import { EVAL_CONFIG_NAMES, needsDense, parseTuning, runQuestions, type KbQuestion } from '../src/lib/kb/eval';
import { buildIndex, DEFAULT_RANKERS, RRF_K, search, SEARCH_TUNING } from '../src/lib/kb/search';
import { kindOfId, type KbRecord } from '../src/lib/kb/types';

const ROOT = path.resolve(__dirname, '..');

const rec = (id: string, title: string, text: string): KbRecord => finishRecord({ id, kind: kindOfId(id)!, title, text, source: { file: 'fixture' }, origin: 'authored', scope: 'public' });

/** A unit vector in `dims` dimensions pointing mostly along axis `axis`, tilted toward axis `axis + 1` by `tilt`. */
function unit(dims: number, axis: number, tilt = 0): Float32Array {
  const v = new Float32Array(dims);
  v[axis % dims] = 1;
  v[(axis + 1) % dims] = tilt;
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
}

function indexOf(dims: number, rows: [string, Float32Array][]): DenseIndex {
  const sorted = [...rows].sort(([a], [b]) => (a < b ? -1 : 1));
  const vectors = new Float32Array(sorted.length * dims);
  sorted.forEach(([, v], i) => vectors.set(v, i * dims));
  return denseIndex('fake', dims, sorted.map(([id]) => id), vectors);
}

describe('the dense index and ranker', () => {
  const ix = indexOf(4, [
    ['card:b', unit(4, 0)],
    ['card:a', unit(4, 0)],
    ['card:c', unit(4, 0, 0.5)],
    ['card:d', unit(4, 2)],
  ]);
  it('ranks by dot product, ties by id, cut at the depth', () => {
    const r = rankDense(ix, unit(4, 0), 3);
    expect(r.map((s) => s.id)).toEqual(['card:a', 'card:b', 'card:c']);
    expect(r[0]!.score).toBeCloseTo(1);
    expect(r[2]!.score).toBeCloseTo(1 / Math.hypot(1, 0.5));
    expect(rankDense(ix, unit(4, 2), 1)).toEqual([{ id: 'card:d', score: expect.closeTo(1) }]);
    expect(rankDense(ix, unit(4, 0), 0)).toEqual([]);
  });
  it('refuses vectors of the wrong size and unsorted ids', () => {
    expect(() => rankDense(ix, new Float32Array(3), 5)).toThrow(/3 dims, the index 4/);
    expect(() => denseIndex('m', 2, ['a', 'b'], new Float32Array(3))).toThrow(/needs 4 numbers/);
    expect(() => denseIndex('m', 2, ['b', 'a'], new Float32Array(4))).toThrow(/sorted and distinct/);
    expect(() => denseIndex('m', 2, ['a', 'a'], new Float32Array(4))).toThrow(/sorted and distinct/);
  });
  it('aligns to the current records: drops vectors of records gone, lists records with none', () => {
    const { index, missing } = alignDense(ix, ['card:d', 'card:a', 'card:new']);
    expect(index.ids).toEqual(['card:a', 'card:d']);
    expect(Array.from(index.vectors.subarray(4, 8))).toEqual(Array.from(unit(4, 2)));
    expect(missing).toEqual(['card:new']);
  });
  it('embeds a record as its title, a newline and its text', () => {
    expect(denseText({ title: 'Kilo Byte', text: 'An invented Program.' })).toBe('Kilo Byte\nAn invented Program.');
  });
});

describe('the dense list in search', () => {
  // invented records; the dense vectors are hand-made so that "beta" is the dense neighbour of every query
  const records = [
    rec('card:alpha', 'Alpha Unit', 'An invented Unit that trashes cards.'),
    rec('card:beta', 'Beta Program', 'An invented Program about something else.'),
    rec('doc:x.md#gamma', 'Gamma', 'Notes on alpha and trashes.'),
    rec('matchup:a~b', 'A vs B', 'An invented head-to-head about trashes.'),
  ];
  const ix = buildIndex(records);
  const dims = 4;
  const dense = {
    index: indexOf(dims, [
      ['card:alpha', unit(dims, 1)],
      ['card:beta', unit(dims, 0)],
      ['doc:x.md#gamma', unit(dims, 2)],
      ['matchup:a~b', unit(dims, 0, 0.1)],
    ]),
    query: unit(dims, 0),
  };
  const all = ['exact', 'linked', 'keyword', 'dense'] as const;

  it('runs only when asked for and given an index: the default search is unchanged', () => {
    expect(DEFAULT_RANKERS).toEqual(['exact', 'linked', 'keyword']);
    const q = 'which card trashes';
    const plain = search(ix, q);
    expect(search(ix, q, { dense })).toEqual(plain);
    expect(search(ix, q, { rankers: all })).toEqual(plain);
    const on = search(ix, q, { rankers: all, dense });
    expect(on.hits.find((h) => h.record.id === 'card:beta')?.ranks.dense).toBe(1);
  });
  it('joins the fusion with its own weight', () => {
    const q = 'which card trashes';
    const beta = (w: number) => search(ix, q, { rankers: all, dense, tuning: { denseWeight: w } }).hits.find((h) => h.record.id === 'card:beta')!;
    expect(beta(1).score).toBeCloseTo(1 / (RRF_K + 1));
    expect(beta(2).score).toBeCloseTo(2 / (RRF_K + 1));
    expect(SEARCH_TUNING.denseWeight).toBe(0.5);
  });
  it('leaves out cue-only kinds unless the question asks for them, as the keyword list does', () => {
    const ids = (q: string) => search(ix, q, { rankers: ['dense'], dense, tuning: { denseFloor: 0 } }).hits.map((h) => h.record.id);
    expect(ids('which card trashes')).not.toContain('matchup:a~b');
    expect(ids('the matchup that trashes')).toContain('matchup:a~b');
  });
  it('lifts "no match" only when its best similarity reaches the dense floor', () => {
    const q = 'quasar pulsar nebula'; // no exact hit, no keyword hit
    expect(search(ix, q).noMatch).toBe(true);
    expect(search(ix, q, { rankers: all, dense, tuning: { denseFloor: 1.01 } }).noMatch).toBe(true);
    const lifted = search(ix, q, { rankers: all, dense, tuning: { denseFloor: 0.99 } });
    expect(lifted.noMatch).toBe(false);
    expect(lifted.hits[0]!.record.id).toBe('card:beta');
    // a weak dense neighbour does not: the query points between axes, best similarity about 0.71
    const weak = { index: dense.index, query: unit(dims, 3, 1) };
    expect(search(ix, q, { rankers: all, dense: weak, tuning: { denseFloor: 0.75 } }).noMatch).toBe(true);
  });
  it('runs the dense configurations of the evaluation only with vectors for every question', () => {
    const qs: KbQuestion[] = [{ id: 'q001', q: 'quasar pulsar nebula', type: 'paraphrase', scope: 'public', split: 'dev', expect: ['card:beta'] }];
    expect(needsDense('exact+linked+keyword+dense')).toBe(true);
    expect(needsDense('exact+linked+keyword')).toBe(false);
    expect(() => runQuestions(ix, qs, 'dense')).toThrow(/needs the dense vectors/);
    expect(() => runQuestions(ix, qs, 'dense', undefined, { index: dense.index, queries: new Map() })).toThrow(/no dense vector for question q001/);
    const [r] = runQuestions(ix, qs, 'dense', { denseFloor: 0.9 }, { index: dense.index, queries: new Map([['q001', dense.query]]) });
    expect([r!.rank, r!.refused]).toEqual([1, false]);
  });
  it('reads the dense settings from --tune', () => {
    expect(parseTuning('denseWeight=2,denseFloor=0.75')).toEqual({ denseWeight: 2, denseFloor: 0.75 });
    for (const bad of ['denseWeight=11', 'denseWeight=-1', 'denseFloor=1.2', 'denseFloor=x']) expect(typeof parseTuning(bad), bad).toBe('string');
  });
});

describe('the vector cache (scripts/kb-dense.ts)', () => {
  const dirs: string[] = [];
  const temp = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-kb-dense-'));
    dirs.push(d);
    return d;
  };
  afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });

  /** A fake embedder: a vector from the text's characters, unit length; it records what it was asked to embed. */
  function fakeEmbed(): { embed: Embed; seen: string[] } {
    const seen: string[] = [];
    const embed: Embed = async (texts) =>
      texts.map((t) => {
        seen.push(t);
        const v = new Float32Array(DENSE_MODEL.dims);
        for (let i = 0; i < t.length; i++) v[(t.charCodeAt(i) * 7 + i) % DENSE_MODEL.dims]! += 1;
        const n = Math.hypot(...v) || 1;
        return v.map((x) => x / n);
      });
    return { embed, seen };
  }

  const recs = [rec('card:a', 'Alpha', 'First invented record.'), rec('card:b', 'Beta', 'Second invented record.'), rec('card:c', 'Gamma', 'Third invented record.')];

  it('embeds every record once, then reuses vectors by text hash', async () => {
    const dir = temp();
    const f = fakeEmbed();
    const first = await refreshVectors(recs, f.embed, dir);
    expect([first.embedded, first.reused, first.dropped, first.wrote]).toEqual([3, 0, 0, true]);
    expect(f.seen).toEqual(recs.map(denseText));
    const bin = fs.readFileSync(path.join(dir, 'vectors.f32'));
    expect(bin.length).toBe(3 * DENSE_MODEL.dims * 4);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
    expect(meta).toMatchObject({ kind: 'nct-kb-vectors', schema: 1, model: DENSE_MODEL.id, revision: DENSE_MODEL.revision, dtype: 'q8', dims: 384, queryPrefix: QUERY_PREFIX, textVersion: 1, ids: ['card:a', 'card:b', 'card:c'] });
    expect(meta.hashes).toEqual(recs.map(textHash));
    const g = fakeEmbed();
    const second = await refreshVectors([...recs].reverse(), g.embed, dir);
    expect([second.embedded, second.reused, second.wrote]).toEqual([0, 3, false]);
    expect(g.seen).toEqual([]);
    expect(Array.from(second.index.vectors)).toEqual(Array.from(first.index.vectors));
  });

  it('embeds a changed record again, drops a removed one and rebuilds when the settings differ', async () => {
    const dir = temp();
    await refreshVectors(recs, fakeEmbed().embed, dir);
    const changed = [recs[0]!, rec('card:b', 'Beta', 'Second invented record, edited.')];
    const f = fakeEmbed();
    const r = await refreshVectors(changed, f.embed, dir);
    expect([r.embedded, r.reused, r.dropped]).toEqual([1, 1, 1]);
    expect(f.seen).toEqual(['Beta\nSecond invented record, edited.']);
    expect(readVectors(dir)!.meta.ids).toEqual(['card:a', 'card:b']);
    expect(vectorState(changed, dir)).toMatchObject({ built: true, current: 2, records: 2 });
    expect(vectorState([...changed, recs[2]!], dir)).toMatchObject({ current: 2, records: 3 });
    // a cache made by another model (or revision, prefix, template) is not read
    const mf = path.join(dir, 'index.json');
    fs.writeFileSync(mf, fs.readFileSync(mf, 'utf8').replace(DENSE_MODEL.revision, 'another-revision'));
    expect(readVectors(dir)).toBeNull();
    const g = fakeEmbed();
    expect((await refreshVectors(changed, g.embed, dir)).embedded).toBe(2);
    // a truncated vector file is not read either
    fs.writeFileSync(path.join(dir, 'vectors.f32'), Buffer.alloc(10));
    expect(readVectors(dir)).toBeNull();
  });

  it('cuts the index to the records of a scope', async () => {
    const r = await refreshVectors(recs, fakeEmbed().embed, temp());
    expect(denseFor(r.index, [recs[2]!, recs[0]!]).ids).toEqual(['card:a', 'card:c']);
  });

  it('prefixes questions, and only questions', async () => {
    const f = fakeEmbed();
    await embedQueries(f.embed, ['which deck']);
    expect(f.seen).toEqual(['Represent this sentence for searching relevant passages: which deck']);
  });

  it('says exactly what is missing when the tools or the model are absent, and loads nothing', async () => {
    const p = densePaths(ROOT, temp());
    const st = denseStatus(p);
    expect(st.ready).toBe(false);
    expect(st.missing).toHaveLength(2);
    expect(st.missing[0]).toMatch(/@huggingface\/transformers 4\.3\.2 .*npm install @huggingface\/transformers@4\.3\.2` run inside that folder/);
    expect(st.missing[1]).toMatch(/missing: config\.json, tokenizer\.json, tokenizer_config\.json, special_tokens_map\.json, onnx\/model_quantized\.onnx\); .*revision ea104dac/);
    expect(missingText(st)).toMatch(/^the dense ranker is not ready\. Missing:\n {2}- .*\nNothing was fetched or written\.$/s);
    await expect(loadEmbedder(p)).rejects.toThrow(/not ready/);
    // the library present, the model still absent
    fs.mkdirSync(path.join(p.tools, 'node_modules', '@huggingface', 'transformers'), { recursive: true });
    fs.writeFileSync(path.join(p.tools, 'package.json'), '{}');
    fs.writeFileSync(path.join(p.tools, 'node_modules', '@huggingface', 'transformers', 'package.json'), '{}');
    expect(denseStatus(p).missing).toHaveLength(1);
    expect(await denseStatsText(recs, p)).toBe('dense: not ready (1 missing piece; `npm run kb -- embed` lists them); search is lexical only');
  });

  it('the command line exits 1 for dense when the tools folder is absent, before reading the pack', () => {
    const tsx = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const env = { ...process.env, KB_DENSE_DIR: temp() };
    for (const args of [['search', 'which deck', '--rankers', 'exact,linked,keyword,dense'], ['embed']]) {
      const r = spawnSync(process.execPath, [tsx, 'scripts/kb.ts', ...args], { cwd: ROOT, encoding: 'utf8', env });
      expect(r.status, args.join(' ')).toBe(1);
      expect(r.stderr).toMatch(/^kb: the dense ranker is not ready\. Missing:/);
      expect(r.stderr).toContain('@huggingface/transformers');
      expect(r.stderr).toContain('Nothing was fetched or written.');
      expect(r.stdout).toBe('');
    }
    // the evaluation: --dense exits 1 saying what is missing; a dense configuration without --dense is a usage error
    const ev = (...args: string[]) => spawnSync(process.execPath, [tsx, 'scripts/kb-eval.ts', ...args], { cwd: ROOT, encoding: 'utf8', env });
    const refused = ev('--dense', '--split', 'dev', '--scope', 'public', '--json');
    expect(refused.status).toBe(1);
    expect(refused.stderr).toMatch(/error: --dense: the dense ranker is not ready\. Missing:/);
    expect(refused.stdout).toBe('');
    const usage = ev('--config', 'keyword,dense');
    expect(usage.status).toBe(2);
    expect(usage.stderr).toMatch(/error: dense needs --dense/);
  }, 120_000);
});

describe('the tracked evaluation reports (kb:eval --out)', () => {
  // what --out writes to reports/ must not depend on the machine: the same with the dense tools absent and present
  const flags = (...extra: string[]) => parseArgs(EVAL_SPEC, ['--out', '--split', 'dev', '--scope', 'public', ...extra]).values;
  async function withDenseDir<T>(dir: string, f: () => Promise<T>): Promise<T> {
    const prev = process.env.KB_DENSE_DIR;
    process.env.KB_DENSE_DIR = dir;
    try {
      return await f();
    } finally {
      if (prev === undefined) delete process.env.KB_DENSE_DIR;
      else process.env.KB_DENSE_DIR = prev;
    }
  }
  const emptyDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nct-kb-dense-eval-'));
  const lexicalOnly = (r: ReportPair) => {
    const json = JSON.parse(r.json);
    expect(json.dense).toBeUndefined();
    expect(r.md).not.toContain('Dense ranker');
    for (const sc of json.scopes) expect(sc.configs.map((c: { config: string }) => c.config)).toEqual([...LEXICAL_CONFIGS]);
  };

  it('hold the four lexical configurations only, and --dense refuses when the tools are absent', async () => {
    const dir = emptyDir();
    try {
      const out = await withDenseDir(dir, () => runEval(flags()));
      lexicalOnly(out.tracked);
      expect(out.dense).toBeUndefined();
      expect(out.stdout).toBe(out.tracked.md);
      await expect(withDenseDir(dir, () => runEval(flags('--dense')))).rejects.toThrow(/^--dense: the dense ranker is not ready/);
      await expect(withDenseDir(dir, () => runEval(flags('--config', 'exact,dense')))).rejects.toThrow(ArgError);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  // the second half needs the real tools and model (skipped without them, as in CI)
  const realDir = process.env.KB_DENSE_DIR || DENSE_DIR;
  it.skipIf(!denseStatus(densePaths(ROOT, realDir)).ready)('are byte-identical with the dense tools present, with or without --dense', async () => {
    const dir = emptyDir();
    try {
      const without = await withDenseDir(dir, () => runEval(flags()));
      const plain = await withDenseDir(realDir, () => runEval(flags()));
      const dense = await withDenseDir(realDir, () => runEval(flags('--dense')));
      expect(plain.tracked).toEqual(without.tracked);
      expect(dense.tracked).toEqual(without.tracked);
      // the dense results go to stdout and to the untracked files under the dense folder
      expect(dense.dense!.dir).toBe(densePaths(ROOT, realDir).dir);
      expect(dense.dense!.md).toContain('Dense ranker (--dense, step 4.1)');
      expect(JSON.parse(dense.dense!.json).scopes[0].configs.map((c: { config: string }) => c.config)).toEqual([...EVAL_CONFIG_NAMES]);
      expect(dense.stdout).toBe(dense.dense!.md);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 180_000);
});

describe('the command line', () => {
  it('reads embed and the dense ranker', () => {
    expect(parseKbArgs(['embed']).command).toBe('embed');
    expect(parseKbArgs(['search', 'x', '--rankers', 'keyword,dense']).rankers).toEqual(['keyword', 'dense']);
    for (const argv of [['embed', 'extra'], ['embed', '--k', '3'], ['embed', '--json'], ['search', 'x', '--rankers', 'vector']]) expect(() => parseKbArgs(argv), argv.join(' ')).toThrow(ArgError);
  });
});

// Only with the real tools and model on this machine (CI has neither): skipped otherwise.
const real = densePaths(ROOT);
describe.skipIf(!denseStatus(real).ready)('the real model (local only)', () => {
  it('gives 384-dimension unit vectors and a sensible similarity order', async () => {
    const embed = await loadEmbedder(real);
    const [card, event] = await embed(['A red Program card that defeats a rival Gear with power 2 or less.', 'The tournament had nine Swiss rounds and then a top cut of eight.']);
    const [q] = await embedQueries(embed, ['which card destroys enemy equipment']);
    for (const v of [card!, event!, q!]) {
      expect(v.length).toBe(384);
      expect(Math.hypot(...v)).toBeCloseTo(1, 4);
    }
    const dot = (a: Float32Array, b: Float32Array) => a.reduce((s, x, i) => s + x * b[i]!, 0);
    expect(dot(q!, card!)).toBeGreaterThan(dot(q!, event!));
    // one text per call: the same text gives the same vector whatever came with it
    const [again] = await embed(['A red Program card that defeats a rival Gear with power 2 or less.']);
    expect(Array.from(again!)).toEqual(Array.from(card!));
  }, 60_000);
});
