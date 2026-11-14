// The site's knowledge pack (docs/RAG_PLAN.md step 3; src/lib/kb/site.ts, siteSearch.ts, tools/kb-site.ts): what the
// site ships (twelve public kinds; no FAQ paraphrases, docs, code or local record; nothing from data/raw), that two
// builds give the same bytes, the shard and manifest shapes, that the first shards rank every other question exactly as
// the whole pack does, the late statistics shard, each kind's link, the example questions, and the size budgets.
// Questions here are written for this test; the evaluation question set is never read.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIDES } from '../src/content/guides';
import { GLOSSARY } from '../src/content/glossary';
import { ANALYSIS } from '../src/data/analysisData';
import { TOURNAMENT_INDEX } from '../src/data/tournamentIndex';
import { buildIndex, search, STAT_KINDS } from '../src/lib/kb/search';
import {
  associationLine,
  basisLine,
  KIND_LABEL,
  lateShardsFor,
  parseShard,
  shardFileName,
  SITE_EXAMPLES,
  SITE_FIELDS,
  SITE_KINDS,
  SITE_LEFT_OUT,
  SITE_SHARDS,
  siteLink,
  siteManifest,
  siteRecords,
  siteShardFiles,
  utf8Bytes,
  type SiteShardFile,
} from '../src/lib/kb/site';
import { SITE_RESULTS, SiteSearch } from '../src/lib/kb/siteSearch';
import { buildFromSources, deckFiles, rawPresent } from '../scripts/kb-sources';
import { EVAL_SPEC, evaluateScope } from '../scripts/kb-eval';
import type { KbQuestion } from '../src/lib/kb/eval';
import { gzipBytes } from '../tools/kb-site';
import { isSearchChunk, KB_SHARD_BUDGET_KB, kbShardName, SEARCH_CHUNK_BUDGET_KB, searchBudgetProblems } from '../tools/size-budget';

const ROOT = path.resolve(__dirname, '..');

const built = await buildFromSources(ROOT, { raw: false });
const files = siteShardFiles(built.records);
const byName = new Map(files.map((f) => [f.name, f]));
const shardRecords = (names: readonly string[]) => names.flatMap((n) => parseShard(byName.get(n)!.json, { name: n }));
const FIRST = SITE_SHARDS.filter((s) => !s.late).map((s) => s.name);
const ALL = SITE_SHARDS.map((s) => s.name);
const shipped = shardRecords(ALL);

describe('what the site ships', () => {
  it('holds every one of the twelve site kinds and nothing else', () => {
    expect([...SITE_KINDS].sort()).toEqual(['card', 'cardstat', 'deck', 'event', 'guide', 'matchup', 'objective', 'package', 'pkgstat', 'rating', 'round', 'term']);
    const kinds = new Set(shipped.map((r) => r.kind));
    expect([...kinds].sort()).toEqual([...SITE_KINDS].sort());
    for (const k of SITE_KINDS) expect(shipped.filter((r) => r.kind === k).length, k).toBeGreaterThan(0);
  });

  it('leaves out the FAQ paraphrases, the docs and code, and every local kind', () => {
    expect(SITE_LEFT_OUT).toEqual(expect.arrayContaining(['ruling', 'doc', 'code', 'faq', 'rule', 'trule', 'errata']));
    const all = files.map((f) => f.json).join('\n');
    expect(shipped.some((r) => SITE_LEFT_OUT.includes(r.kind))).toBe(false);
    // no id of a left-out record, not even as a link
    expect(all).not.toMatch(/"(ruling|doc|code|faq|rule|trule|errata):/);
    // the pack built for the command line does hold them: the filter is what keeps them out
    expect(built.records.filter((r) => r.kind === 'ruling').length).toBeGreaterThan(300);
    expect(siteRecords(built.records).length).toBe(shipped.length);
  });

  it('is public, keeps only the fields a result needs, and links only to shipped records', () => {
    const ids = new Set(shipped.map((r) => r.id));
    for (const r of shipped) {
      expect(r.scope).toBe('public');
      for (const k of Object.keys(r.fields ?? {})) expect(SITE_FIELDS, `${r.id} ${k}`).toContain(k);
      for (const l of r.links) expect(ids.has(l.to), `${r.id} -> ${l.to}`).toBe(true);
    }
    // no source paths or content hashes in the files
    for (const f of files) expect(f.json).not.toMatch(/"source":|"hash":|"scope":/);
  });

  it('builds the same bytes twice', async () => {
    const again = siteShardFiles((await buildFromSources(ROOT, { raw: false })).records);
    expect(again.map((f) => [f.name, f.hash, f.json])).toEqual(files.map((f) => [f.name, f.hash, f.json]));
  });

  it.runIf(rawPresent(ROOT))('is the same bytes with data/raw present, and holds none of its wording', async () => {
    const withRaw = await buildFromSources(ROOT, { raw: true });
    expect(withRaw.local).toBe(true);
    expect(siteShardFiles(withRaw.records).map((f) => f.json)).toEqual(files.map((f) => f.json));
    const all = files.map((f) => JSON.parse(f.json) as { records: { text: string }[] }).flatMap((s) => s.records.map((r) => r.text)).join('\n');
    // every longer sentence of a local record (official rules, FAQ, tournament rules, errata) is absent
    const sentences = withRaw.records.filter((r) => r.scope === 'local').flatMap((r) => r.text.split(/(?<=[.!?])\s+|\n/).map((x) => x.trim()).filter((x) => x.length >= 60));
    expect(sentences.length).toBeGreaterThan(100);
    expect(sentences.filter((x) => all.includes(x))).toEqual([]);
  });
});

describe('shards and manifest', () => {
  it('cuts the records into the planned shards: the authored and tournament kinds first, each statistics kind late', () => {
    expect(SITE_SHARDS.map((s) => [s.name, s.late])).toEqual([
      ['core', false],
      ['events', false],
      ['cardstat', true],
      ['pkgstat', true],
    ]);
    expect(SITE_SHARDS.filter((s) => s.late).flatMap((s) => s.kinds).sort()).toEqual([...STAT_KINDS].sort());
    for (const f of files) {
      const recs = parseShard(f.json, { name: f.name });
      expect(recs.length).toBe(f.records);
      expect(new Set(recs.map((r) => r.kind))).toEqual(new Set(f.kinds));
      expect(recs.map((r) => r.id)).toEqual([...recs.map((r) => r.id)].sort());
    }
  });

  it('names each file by its content hash and lists them in a small manifest', () => {
    const m = siteManifest(files, (f) => `assets/${shardFileName(f)}`);
    expect(m.kind).toBe('nct-kb-site');
    expect(m.schema).toBe(1);
    expect(m.shards.map((s) => s.name)).toEqual(ALL);
    for (const s of m.shards) {
      const f = byName.get(s.name)!;
      expect(s.url).toBe(`assets/kb-${s.name}-${f.hash}.json`);
      expect(s.url).toMatch(/^assets\/kb-[a-z]+-[0-9a-f]{16}\.json$/);
      expect(s.bytes).toBe(Buffer.byteLength(f.json));
      expect(utf8Bytes(f.json)).toBe(s.bytes);
    }
    expect(JSON.stringify(m).length).toBeLessThan(1500);
    // an edit to one shard changes its name and the pack hash, not the others'
    const edited: SiteShardFile[] = files.map((f) => (f.name === 'events' ? { ...f, hash: 'ffffffffffffffff' } : f));
    const m2 = siteManifest(edited, (f) => `assets/${shardFileName(f)}`);
    expect(m2.pack).not.toBe(m.pack);
    expect(m2.shards.filter((s, i) => s.url !== m.shards[i]!.url).map((s) => s.name)).toEqual(['events']);
  });

  it('refuses a file that is not a shard, or another shard than the one asked for', () => {
    expect(() => parseShard('{"kind":"x"}')).toThrow(/not a knowledge pack shard/);
    expect(() => parseShard(byName.get('core')!.json, { name: 'events' })).toThrow(/expected shard events/);
    expect(() => parseShard('{"kind":"nct-kb-shard","schema":1,"name":"core","records":[{"id":"ruling:1","kind":"ruling","title":"t","text":"x","links":[]}]}')).toThrow(/not a record/);
  });
});

describe('searching what is loaded', () => {
  const first = buildIndex(shardRecords(FIRST));
  const full = buildIndex(shipped);
  const ids = (ix: ReturnType<typeof buildIndex>, q: string) => {
    const r = search(ix, q, { k: SITE_RESULTS });
    return [r.noMatch, ...r.hits.map((h) => h.record.id)];
  };

  it('finds the same names with or without the statistics shards', () => {
    expect([...first.deckNames.byName]).toEqual([...full.deckNames.byName]);
    expect([...first.packageNames.byName]).toEqual([...full.packageNames.byName]);
  });

  it('ranks a question that does not ask for statistics exactly as the whole site pack does', () => {
    const titles = shardRecords(FIRST)
      .filter((_, i) => i % 4 === 0)
      .map((r) => r.title);
    const questions = [...titles, ...SITE_EXAMPLES, 'which decks win by filling the trash', 'cards that steal a gig', 'rockerboy deck plan', 'event 6 final', 'ratings of red decks', 'nothing about xyzzy'];
    let compared = 0;
    for (const q of questions) {
      if (lateShardsFor(first, q).length) continue;
      expect(ids(first, q), q).toEqual(ids(full, q));
      compared++;
    }
    expect(compared).toBeGreaterThan(150);
  });

  it('asks for a statistics shard only when the question asks for statistics', () => {
    expect(lateShardsFor(first, 'Which decks play Detonate?')).toEqual([]);
    expect(lateShardsFor(first, 'Who won event 7?')).toEqual([]);
    expect(lateShardsFor(first, 'Detonate stats')).toEqual(['cardstat', 'pkgstat']);
    expect(lateShardsFor(first, 'how often does the bot play Detonate')).toEqual(['cardstat']);
    const pkg = shardRecords(['core']).find((r) => r.kind === 'package')!;
    expect(lateShardsFor(first, `how often does ${pkg.title} come online`)).toContain('pkgstat');
  });

  it('answers each example question the page offers', () => {
    for (const q of SITE_EXAMPLES) {
      const r = search(first, q, { k: SITE_RESULTS });
      expect(r.noMatch, q).toBe(false);
      expect(r.hits.length, q).toBeGreaterThan(0);
    }
    expect(search(first, 'Who won event 7?').hits[0]!.record.id).toBe('event:7');
  });
});

describe('the search the page runs (SiteSearch)', () => {
  const manifest = siteManifest(files, (f) => `assets/${shardFileName(f)}`);
  const served = new Map(manifest.shards.map((s) => [s.url, byName.get(s.name)!.json]));
  const fake = () => {
    const asked: string[] = [];
    let fail = new Set<string>();
    const fetchText = async (url: string) => {
      asked.push(url);
      if ([...fail].some((n) => url.includes(`kb-${n}-`))) throw new Error('offline');
      const t = served.get(url);
      if (t === undefined) throw new Error(`404 ${url}`);
      return t;
    };
    return { s: new SiteSearch(manifest, fetchText), asked, setFail: (n: string[]) => (fail = new Set(n)) };
  };

  it('fetches nothing until asked, then the first shards once', async () => {
    const { s, asked } = fake();
    expect(asked).toEqual([]);
    expect(s.isReady).toBe(false);
    await Promise.all([s.ready(), s.ready()]);
    expect(asked.map((u) => u.replace(/-[0-9a-f]+\.json$/, ''))).toEqual(['assets/kb-core', 'assets/kb-events']);
    await s.ready();
    expect(asked.length).toBe(2);
    expect(s.run('Detonate').hits[0]!.record.id).toBe('card:detonate');
    expect(s.run('Detonate').hits.length).toBeLessThanOrEqual(8);
  });

  it('a question asking for statistics needs a late shard; searched again once it is in, the statistics lead', async () => {
    const { s, asked } = fake();
    await s.ready();
    const q = 'how often does the bot play Detonate';
    expect(s.missing(q)).toEqual(['cardstat']);
    const before = s.run(q);
    expect(before.hits.some((h) => h.record.kind === 'cardstat')).toBe(false);
    await s.load(s.missing(q));
    expect(asked.length).toBe(3);
    expect(s.missing(q)).toEqual([]);
    const after = s.run(q);
    expect(after.hits[0]!.record.kind).toBe('cardstat');
    expect(after.hits[0]!.record.links.some((l) => l.to === 'card:detonate')).toBe(true);
    // the same as the whole site pack
    expect(after.hits.map((h) => h.record.id)).toEqual(search(buildIndex(shardRecords(['core', 'events', 'cardstat'])), q, { k: SITE_RESULTS }).hits.map((h) => h.record.id));
  });

  it('a failed fetch is reported and can be tried again', async () => {
    const { s, setFail } = fake();
    setFail(['core']);
    await expect(s.ready()).rejects.toThrow('offline');
    expect(s.isReady).toBe(false);
    setFail([]);
    await s.ready();
    expect(s.isReady).toBe(true);
  });
});

describe('what a result shows', () => {
  const lib = new Set(deckFiles(ROOT).map((f) => path.basename(f)));
  const glossary = new Set(GLOSSARY.map((t) => t.term));
  const guides = new Set(GUIDES.map((g) => g.slug));
  const events = new Set(TOURNAMENT_INDEX.events.map((e) => String(e.id)));
  const analysisDecks = new Set(ANALYSIS.decks.map((d) => d.deck));
  const param = (href: string, k: string) => new URLSearchParams(href.split('?')[1] ?? '').get(k);

  it('names every kind in a plain word', () => {
    for (const k of SITE_KINDS) expect(KIND_LABEL[k], k).toMatch(/^[A-Z][a-z ]+$/);
    expect(KIND_LABEL.objective).toBe('Game plan');
    expect(KIND_LABEL.term).toBe('Glossary');
    expect(KIND_LABEL.cardstat).toBe('Card statistics');
  });

  it('links each kind to where it lives on the site', () => {
    const missing: string[] = [];
    for (const r of shipped) {
      const l = siteLink(r);
      const where = `${r.id} -> ${JSON.stringify(l)}`;
      switch (r.kind) {
        case 'card':
          expect(l, where).toEqual({ to: 'card', cardId: r.id.slice(5), label: 'Card' });
          break;
        case 'deck':
        case 'objective':
        case 'matchup':
          expect(l?.to === 'page' && l.href.startsWith('#/deck?d='), where).toBe(true);
          if (l?.to === 'page' && !lib.has(param(l.href, 'd')!)) missing.push(where);
          break;
        case 'term':
          if (r.fields?.vocabulary) expect(l, where).toBeNull();
          else {
            expect(l?.to === 'page' && l.href.startsWith('#/glossary?q='), where).toBe(true);
            if (l?.to === 'page' && !glossary.has(param(l.href, 'q')!)) missing.push(where);
          }
          break;
        case 'guide':
          expect(l?.to === 'page' && l.href.startsWith('#/guides?g='), where).toBe(true);
          if (l?.to === 'page' && !guides.has(param(l.href, 'g')!)) missing.push(where);
          break;
        case 'event':
        case 'round':
          expect(l?.to === 'page' && l.href.startsWith('#/tournaments?e='), where).toBe(true);
          if (l?.to === 'page' && !events.has(param(l.href, 'e')!)) missing.push(where);
          break;
        case 'rating':
          expect(l, where).toEqual({ to: 'page', href: '#/ratings', label: 'Power ratings' });
          break;
        case 'package':
          expect(l, where).toEqual({ to: 'page', href: '#/insights?v=synergies', label: 'Card stats: Synergies' });
          break;
        case 'cardstat': {
          expect(l?.to === 'page' && l.href.startsWith('#/insights?'), where).toBe(true);
          if (l?.to !== 'page') break;
          expect(param(l.href, 'v')).toBe('decisions');
          const d = param(l.href, 'd');
          if (r.id.includes('/')) {
            if (!d || !analysisDecks.has(d)) missing.push(where);
          } else expect(d, where).toBeNull();
          break;
        }
        case 'pkgstat':
          if (r.id.includes('/')) {
            expect(l?.to === 'page' && l.href.startsWith('#/deck?d='), where).toBe(true);
            if (l?.to === 'page' && !lib.has(param(l.href, 'd')!)) missing.push(where);
          } else expect(l, where).toEqual({ to: 'page', href: '#/insights?v=synergies', label: 'Card stats: Synergies' });
          break;
        default:
          throw new Error(`unexpected kind ${r.kind}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('says what a measured record rests on, keeps the association wording, and nothing for authored records', () => {
    const ev = shipped.find((r) => r.id === 'event:7')!;
    expect(basisLine(ev)).toMatch(/^Measured from the \w+ bot's games on sim version \d+, recorded \d{4}-\d{2}-\d{2}\.$/);
    for (const r of shipped.filter((x) => x.kind === 'cardstat' || x.kind === 'pkgstat')) {
      expect(basisLine(r), r.id).toContain('sim version');
      expect(associationLine(r), r.id).toMatch(/association/i);
    }
    const card = shipped.find((r) => r.kind === 'card')!;
    expect([basisLine(card), associationLine(card)]).toEqual([null, null]);
    expect(shipped.filter((r) => r.kind === 'objective').every((r) => r.status === 'draft' || r.status === 'owner')).toBe(true);
  });
});

describe('kb-eval --scope site', () => {
  it('searches exactly the shipped records and skips (counts) the questions only a left-out record answers', () => {
    const qs: KbQuestion[] = [
      { id: 'q1', q: 'Detonate', type: 'entity', scope: 'public', split: 'dev', expect: ['card:detonate'] },
      { id: 'q2', q: 'a ruling on Detonate', type: 'rules', scope: 'public', split: 'dev', expect: [built.records.find((r) => r.kind === 'ruling')!.id] },
      { id: 'q3', q: 'a doc section', type: 'dev', scope: 'public', split: 'dev', expect: [built.records.find((r) => r.kind === 'doc')!.id, 'card:detonate'] },
      { id: 'q4', q: 'xyzzy plugh frobnicate', type: 'none', scope: 'public', split: 'dev', expect: [] },
    ];
    const run = evaluateScope('site', built.records, qs, ['exact+linked+keyword']);
    expect(run.records).toBe(shipped.length);
    expect(run.localPresent).toBe(false);
    expect(run.skipped).toEqual(['q2']);
    // a left-out kind is not "stale", only not shipped
    expect(run.stale).toEqual({});
    const res = run.runs[0]!.results;
    expect(res.map((r) => r.id)).toEqual(['q1', 'q3', 'q4']);
    expect(res[0]!.rank).toBe(1);
    expect(res[2]!.refused).toBe(true);
    expect(EVAL_SPEC.scope).toBeDefined();
  });
});

describe('budgets', () => {
  it('each shard is within its gzip budget, and every shard has one', () => {
    for (const f of files) {
      const max = KB_SHARD_BUDGET_KB[f.name];
      expect(max, f.name).toBeDefined();
      expect(gzipBytes(f.json) / 1000, f.name).toBeLessThanOrEqual(max!);
    }
    expect(Object.keys(KB_SHARD_BUDGET_KB).sort()).toEqual([...ALL].sort());
  });

  it('the budget check names what is over, unbudgeted or missing', () => {
    const ok = [...Object.entries(KB_SHARD_BUDGET_KB).map(([n, kb]) => ({ name: `kb-${n}-0123456789abcdef.json`, gzipBytes: kb * 1000 - 1 })), { name: 'Search-AbC_12.js', gzipBytes: SEARCH_CHUNK_BUDGET_KB * 1000 - 1 }];
    expect(searchBudgetProblems(ok)).toEqual([]);
    expect(kbShardName('assets/kb-core-0123abcd.json')).toBe('core');
    expect(kbShardName('assets/index-0123.js')).toBeNull();
    expect(isSearchChunk('assets/Search-Dns1wkau.js')).toBe(true);
    expect(isSearchChunk('assets/Search-Dns1wkau.css')).toBe(false);
    const bad = searchBudgetProblems([{ name: 'kb-core-01.json', gzipBytes: 999_000 }, { name: 'kb-new-01.json', gzipBytes: 10 }]);
    expect(bad.join('\n')).toMatch(/kb-core-01\.json: .* over its budget/);
    expect(bad.join('\n')).toMatch(/kb-new-01\.json: a knowledge-pack shard with no size budget/);
    expect(bad.join('\n')).toMatch(/the events knowledge-pack shard was not built/);
    expect(bad.join('\n')).toMatch(/search page chunk \(Search-\*\.js\) was not built/);
  });

  it('nothing is committed: the shards are made by the build, not kept under public/', () => {
    expect(fs.existsSync(path.join(ROOT, 'public', 'data', 'kb'))).toBe(false);
    const cfg = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
    expect(cfg).toContain('kbSitePack()');
    expect(cfg).toContain("tsImport('./tools/kb-site.ts'");
  });
});
