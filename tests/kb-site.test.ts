// The site's knowledge pack (docs/RAG_PLAN.md step 3; src/lib/kb/site.ts, siteSearch.ts, tools/kb-site.ts): what the
// site ships (thirteen public kinds; no FAQ paraphrases, docs, code or local record; nothing from data/raw), that two
// builds give the same bytes, the groups, their part files and the manifest, the packing (cap, order, whole events,
// closed parts that never change), that the first-search groups rank every other question exactly as the whole pack
// does, loading every part of a group (and again after a failed part), the late statistics groups, each kind's link,
// the example questions, and the size budgets.
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
  packParts,
  parseShard,
  shardFileName,
  SITE_EXAMPLES,
  SITE_FIELDS,
  SITE_KINDS,
  SITE_LEFT_OUT,
  SITE_GROUPS,
  siteLink,
  siteManifest,
  siteRecords,
  siteShardFiles,
  utf8Bytes,
  type SiteShardFile,
  type SiteSizing,
} from '../src/lib/kb/site';
import { SITE_RESULTS, SiteSearch } from '../src/lib/kb/siteSearch';
import { archivedEventFiles, buildFromSources, deckFiles, rawPresent } from '../scripts/kb-sources';
import { EVAL_SPEC, evaluateScope } from '../scripts/kb-eval';
import type { KbQuestion } from '../src/lib/kb/eval';
import type { KbRecord } from '../src/lib/kb/types';
import { gzipBytes, SITE_SIZING, sitePartFiles } from '../tools/kb-site';
import { isKbFile, isSearchChunk, KB_FILE_CAP_KB, KB_FIRST_SEARCH_BUDGET_KB, kbPartName, SEARCH_BUDGET, SEARCH_CHUNK_BUDGET_KB, searchBudgetProblems } from '../tools/size-budget';

const ROOT = path.resolve(__dirname, '..');

const built = await buildFromSources(ROOT, { raw: false });
const files = sitePartFiles(built.records);
const byName = new Map(files.map((f) => [f.name, f]));
/** the records of every part of the named groups, read back as the page reads them */
const groupRecords = (groups: readonly string[], from: readonly SiteShardFile[] = files) => groups.flatMap((g) => from.filter((f) => f.group === g).flatMap((f) => parseShard(f.json, { name: f.name })));
const FIRST = SITE_GROUPS.filter((s) => !s.late).map((s) => s.name);
const ALL = SITE_GROUPS.map((s) => s.name);
const shipped = groupRecords(ALL);
/** a plain measure for tests: characters, with a cap that cuts every large group into several parts */
const SMALL: SiteSizing = { size: (json) => json.length, cap: 150_000 };
const small = siteShardFiles(built.records, SMALL);

describe('what the site ships', () => {
  it('holds every one of the thirteen site kinds and nothing else', () => {
    expect([...SITE_KINDS].sort()).toEqual(['card', 'cardstat', 'deck', 'event', 'finding', 'guide', 'lesson', 'matchup', 'objective', 'package', 'pkgstat', 'rating', 'round', 'term']);
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
    const again = sitePartFiles((await buildFromSources(ROOT, { raw: false })).records);
    expect(again.map((f) => [f.name, f.hash, f.json])).toEqual(files.map((f) => [f.name, f.hash, f.json]));
  }, 30_000);

  it.runIf(rawPresent(ROOT))('is the same bytes with data/raw present, and holds none of its wording', async () => {
    const withRaw = await buildFromSources(ROOT, { raw: true });
    expect(withRaw.local).toBe(true);
    expect(sitePartFiles(withRaw.records).map((f) => f.json)).toEqual(files.map((f) => f.json));
    const all = files.map((f) => JSON.parse(f.json) as { records: { text: string }[] }).flatMap((s) => s.records.map((r) => r.text)).join('\n');
    // every longer sentence of a local record (official rules, FAQ, tournament rules, errata) is absent
    const sentences = withRaw.records.filter((r) => r.scope === 'local').flatMap((r) => r.text.split(/(?<=[.!?])\s+|\n/).map((x) => x.trim()).filter((x) => x.length >= 60));
    expect(sentences.length).toBeGreaterThan(100);
    expect(sentences.filter((x) => all.includes(x))).toEqual([]);
  });
});

describe('groups, parts and manifest', () => {
  it('plans the groups: the authored and tournament kinds first, each statistics kind late, every kind once', () => {
    expect(SITE_GROUPS.map((s) => [s.name, s.late])).toEqual([
      ['core', false],
      ['decks', false],
      ['events', false],
      ['ratings', false],
      ['cardstat', true],
      ['pkgstat', true],
      ['finding', true],
    ]);
    const lateKinds = SITE_GROUPS.filter((s) => s.late).flatMap((s) => s.kinds).sort();
    expect(lateKinds).toEqual([...STAT_KINDS, 'finding'].sort());
    expect(SITE_KINDS.length).toBe(new Set(SITE_KINDS).size);
    expect(SITE_GROUPS.filter((s) => s.unit === 'event').map((s) => s.name)).toEqual(['events']);
  });

  for (const [what, cut, sizing] of [
    ['the build', files, SITE_SIZING],
    ['a small cap', small, SMALL],
  ] as const)
    it(`cuts every group into numbered parts under the cap (${what}), each in id order, holding only its group's kinds`, () => {
      for (const plan of SITE_GROUPS) {
        const parts = cut.filter((f) => f.group === plan.name);
        expect(parts.length, plan.name).toBeGreaterThan(0);
        expect(parts.map((f) => f.part)).toEqual(parts.map((_, i) => i + 1));
        const kinds = new Set<string>();
        for (const f of parts) {
          expect(f.name).toBe(`${plan.name}-${f.part}`);
          expect(f.late).toBe(plan.late);
          expect(sizing.size(f.json), f.name).toBeLessThanOrEqual(sizing.cap);
          const recs = parseShard(f.json, { name: f.name });
          expect(recs.length).toBe(f.records);
          for (const r of recs) kinds.add(r.kind);
          expect(recs.map((r) => r.id)).toEqual([...recs.map((r) => r.id)].sort());
        }
        expect([...kinds].sort(), plan.name).toEqual([...plan.kinds].sort());
      }
      // the same records whatever the cut
      expect(groupRecords(ALL, cut).map((r) => r.id).sort()).toEqual(shipped.map((r) => r.id).sort());
    });

  it('a small cap cuts the large groups into several parts, and an event never straddles two', () => {
    const count = (g: string) => small.filter((f) => f.group === g).length;
    expect(count('events')).toBeGreaterThan(1);
    expect(count('pkgstat')).toBeGreaterThan(1);
    const where = new Map<number, Set<string>>();
    for (const f of small.filter((x) => x.group === 'events'))
      for (const r of parseShard(f.json, { name: f.name })) {
        const e = Number(r.fields!.event);
        where.set(e, (where.get(e) ?? new Set()).add(f.name));
      }
    // the active events and the archived ones (data/events/archive, RAG_PLAN D9)
    expect(where.size).toBe(TOURNAMENT_INDEX.events.length + archivedEventFiles(ROOT).length);
    for (const [e, parts] of where) expect(parts.size, `event ${e}`).toBe(1);
    // and in event order: the parts' events run 1, 2, 3, … across the files
    const order = small.filter((x) => x.group === 'events').flatMap((f) => [...new Set(parseShard(f.json, { name: f.name }).map((r) => Number(r.fields!.event)))].sort((a, b) => a - b));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('names each file by its group, part and content hash and lists every part with its group in a small manifest', () => {
    for (const [cut, n] of [
      [files, files.length],
      [small, small.length],
    ] as const) {
      const m = siteManifest(cut, (f) => `assets/${shardFileName(f)}`);
      expect(m.kind).toBe('nct-kb-site');
      expect(m.schema).toBe(1);
      expect(m.parts.length).toBe(n);
      expect(m.parts.map((s) => s.name)).toEqual(cut.map((f) => f.name));
      expect([...new Set(m.parts.map((s) => s.group))]).toEqual(ALL);
      for (const s of m.parts) {
        const f = cut.find((x) => x.name === s.name)!;
        expect(s.group).toBe(f.group);
        expect(s.late).toBe(f.late);
        expect(s.url).toBe(`assets/kb-${s.name}-${f.hash}.json`);
        expect(s.url).toMatch(/^assets\/kb-[a-z]+-[1-9]\d*-[0-9a-f]{16}\.json$/);
        expect(s.bytes).toBe(Buffer.byteLength(f.json));
        expect(utf8Bytes(f.json)).toBe(s.bytes);
        expect(JSON.stringify(s).length).toBeLessThan(200);
      }
    }
    const m = siteManifest(files, (f) => `assets/${shardFileName(f)}`);
    // 20 parts since 2026-11-24 (3.2 kB): the card and package statistics became the Hard bot's on all 71 lists (REVIEW_2026-11-24
    // B.2), and those late groups went from 2 parts to 9; a part adds about 160 characters
    expect(JSON.stringify(m).length).toBeLessThan(4000);
    // an edit to one part changes its name and the pack hash, not the others'
    const edited: SiteShardFile[] = files.map((f) => (f.name === 'events-1' ? { ...f, hash: 'ffffffffffffffff' } : f));
    const m2 = siteManifest(edited, (f) => `assets/${shardFileName(f)}`);
    expect(m2.pack).not.toBe(m.pack);
    expect(m2.parts.filter((s, i) => s.url !== m.parts[i]!.url).map((s) => s.name)).toEqual(['events-1']);
  });

  it('refuses a file that is not a part, or another part than the one asked for', () => {
    expect(() => parseShard('{"kind":"x"}')).toThrow(/not a knowledge pack shard/);
    expect(() => parseShard(byName.get('core-1')!.json, { name: 'events-1' })).toThrow(/expected shard events-1/);
    expect(() => parseShard(small.find((f) => f.name === 'events-2')!.json, { name: 'events-1' })).toThrow(/expected shard events-1, got events-2/);
    expect(() => parseShard('{"kind":"nct-kb-shard","schema":1,"name":"core-1","records":[{"id":"ruling:1","kind":"ruling","title":"t","text":"x","links":[]}]}')).toThrow(/not a record/);
  });
});

describe('the packing (made-up units)', () => {
  // units of strings; a part file is its part number and items as JSON; the measure is the length
  const render = (items: readonly string[], part: number) => JSON.stringify({ part, items });
  const units = Array.from({ length: 60 }, (_, i) => Array.from({ length: 1 + ((i * 7) % 5) }, (_, j) => `u${i}-${'x'.repeat(5 + ((i * 13 + j * 3) % 17))}`));
  const sizing: SiteSizing = { size: (s) => s.length, cap: 260 };
  const label = (u: readonly string[]) => `unit ${u[0]!.split('-')[0]}`;
  const pack = (us: readonly (readonly string[])[], s: SiteSizing = sizing) => packParts(us, render, s, label);

  it('keeps every file under the cap, keeps the units whole and in order, and fills each part', () => {
    const parts = pack(units);
    expect(parts.length).toBeGreaterThan(5);
    expect(parts.flatMap((p) => p.units)).toEqual(units);
    let at = 0;
    parts.forEach((p, i) => {
      expect(p.json).toBe(render(p.units.flat(), i + 1));
      expect(p.json.length).toBeLessThanOrEqual(sizing.cap);
      at += p.units.length;
      // closed because the next unit did not fit
      if (at < units.length) expect(render([...p.units.flat(), ...units[at]!], i + 1).length).toBeGreaterThan(sizing.cap);
    });
  });

  it('is deterministic, and nothing at all makes no part', () => {
    expect(pack(units)).toEqual(pack(units));
    expect(pack([])).toEqual([]);
  });

  it('never changes a closed part when units are added at the end', () => {
    for (let n = 1; n < units.length; n++) {
      const before = pack(units.slice(0, n));
      const after = pack(units.slice(0, n + 1));
      // every part but the last is closed: the same bytes after one more unit
      for (let i = 0; i < before.length - 1; i++) expect(after[i]!.json, `${n} units, part ${i + 1}`).toBe(before[i]!.json);
      expect(after.length - before.length).toBeLessThanOrEqual(1);
    }
  });

  it('measures a few times per part, not once per unit', () => {
    let calls = 0;
    const counted: SiteSizing = { size: (s) => (calls++, s.length), cap: 5_000 };
    const many = Array.from({ length: 400 }, (_, i) => [`r${i}-${'y'.repeat(20)}`]);
    const parts = pack(many, counted);
    expect(parts.length).toBeGreaterThan(1);
    expect(calls).toBeLessThanOrEqual(parts.length * (2 * Math.ceil(Math.log2(many.length)) + 2));
  });

  it('a unit larger than the cap is an error that names it, never an oversize file', () => {
    const big = [...units.slice(0, 3), ['u99-' + 'z'.repeat(400)], ...units.slice(3, 5)];
    expect(() => pack(big)).toThrow(/^unit u99 weighs \d+ bytes on its own, over the per-file cap of 260: it cannot go in any part file\./);
  });
});

describe('the events group, from made-up records', () => {
  const rec = (id: string, kind: KbRecord['kind'], event: number | undefined, words: number): KbRecord => ({
    id,
    kind,
    title: id,
    text: Array.from({ length: words }, (_, i) => `w${(i * 31 + event!) % 97}`).join(' '),
    ...(event === undefined ? {} : { fields: { event } }),
    links: [],
    source: { file: 'public/tournaments/x.json' },
    origin: 'measured',
    scope: 'public',
    hash: '',
  });
  // event e: its record and 3 + e % 4 rounds, ids as the pack writes them
  const event = (e: number) => [rec(`event:${e}`, 'event', e, 40), ...Array.from({ length: 3 + (e % 4) }, (_, r) => rec(`round:${e}/${r + 1}`, 'round', e, 60 + 10 * r))];
  const sizing: SiteSizing = { size: (s) => s.length, cap: 6_000 };
  const eventsOf = (n: number) => siteShardFiles(Array.from({ length: n }, (_, i) => event(i + 1)).flat(), sizing).filter((f) => f.group === 'events');

  it('packs whole events in event order (event 10 after event 9, not after event 1)', () => {
    const parts = eventsOf(20);
    expect(parts.length).toBeGreaterThan(3);
    const runs = parts.map((f) => [...new Set(parseShard(f.json, { name: f.name }).map((r) => Number(r.fields!.event)))].sort((a, b) => a - b));
    expect(runs.flat()).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const f of parts) expect(f.json.length).toBeLessThanOrEqual(sizing.cap);
  });

  it('the parts built from events 1 to n and from events 1 to n + 1 agree on every closed part, byte for byte', () => {
    let closedSeen = 0;
    for (let n = 1; n < 30; n++) {
      const before = eventsOf(n);
      const after = eventsOf(n + 1);
      for (let i = 0; i < before.length - 1; i++) {
        expect([after[i]!.name, after[i]!.hash, after[i]!.json], `events 1 to ${n}, part ${i + 1}`).toEqual([before[i]!.name, before[i]!.hash, before[i]!.json]);
        closedSeen++;
      }
    }
    expect(closedSeen).toBeGreaterThan(30);
  });

  it('an event too large for a file of its own, or a record with no event number, is an error in a plain sentence', () => {
    const huge = [...event(1), ...Array.from({ length: 80 }, (_, r) => rec(`round:2/${r + 1}`, 'round', 2, 60)), rec('event:2', 'event', 2, 40)];
    expect(() => siteShardFiles(huge, sizing)).toThrow(/^Event 2 with its rounds \(81 records\) weighs \d+ bytes on its own, over the per-file cap of 6000: it cannot go in any part file\./);
    expect(() => siteShardFiles([...event(1), rec('round:3/1', 'round', undefined, 10)], sizing)).toThrow('round:3/1 has no event number: an event or round record must name its event');
  });
});

describe('searching what is loaded', () => {
  const first = buildIndex(groupRecords(FIRST));
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
    const titles = groupRecords(FIRST)
      .filter((_, i) => i % 4 === 0)
      .map((r) => r.title);
    const questions = [...titles, ...SITE_EXAMPLES, 'which decks win by filling the trash', 'cards that steal a gig', 'rockerboy deck plan', 'event 21 final', 'ratings of red decks', 'nothing about xyzzy'];
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
    expect(lateShardsFor(first, 'Who won event 20?')).toEqual([]);
    expect(lateShardsFor(first, 'Detonate stats')).toEqual(['cardstat', 'pkgstat']);
    expect(lateShardsFor(first, 'how often does the bot play Detonate')).toEqual(['cardstat']);
    const pkg = groupRecords(['core']).find((r) => r.kind === 'package')!;
    expect(lateShardsFor(first, `how often does ${pkg.title} come online`)).toContain('pkgstat');
  });

  it('answers each example question the page offers', () => {
    for (const q of SITE_EXAMPLES) {
      const r = search(first, q, { k: SITE_RESULTS });
      expect(r.noMatch, q).toBe(false);
      expect(r.hits.length, q).toBeGreaterThan(0);
    }
    expect(search(first, 'Who won event 20?').hits[0]!.record.id).toBe('event:20');
  });
});

describe('the search the page runs (SiteSearch)', () => {
  // over the build's own cut, and over a small cap's cut where every large group has several parts
  const fake = (cut: readonly SiteShardFile[] = files) => {
    const manifest = siteManifest(cut, (f) => `assets/${shardFileName(f)}`);
    const served = new Map(manifest.parts.map((s) => [s.url, cut.find((f) => f.name === s.name)!.json]));
    const asked: string[] = [];
    let fail = new Set<string>();
    const fetchText = async (url: string) => {
      asked.push(url);
      if ([...fail].some((n) => url.includes(`kb-${n}-`))) throw new Error('offline');
      const t = served.get(url);
      if (t === undefined) throw new Error(`404 ${url}`);
      return t;
    };
    const urls = (pred: (p: (typeof manifest.parts)[number]) => boolean) => manifest.parts.filter(pred).map((p) => p.url);
    return { s: new SiteSearch(manifest, fetchText), asked, urls, setFail: (n: string[]) => (fail = new Set(n)) };
  };
  const q = 'how often does the bot play Detonate';
  /** let the other parts' fetches, still on their way when one failed, come in */
  const settle = () => new Promise<void>((done) => setTimeout(done, 0));
  const full = (groups: readonly string[]) => search(buildIndex(groupRecords(groups)), q, { k: SITE_RESULTS }).hits.map((h) => h.record.id);

  for (const [what, cut] of [
    ['the build', files],
    ['a small cap', small],
  ] as const)
    it(`fetches nothing until asked, then every part of the first-search groups once (${what})`, async () => {
      const { s, asked, urls } = fake(cut);
      expect(asked).toEqual([]);
      expect(s.isReady).toBe(false);
      await Promise.all([s.ready(), s.ready()]);
      const first = urls((p) => !p.late);
      expect(first.length).toBe(cut.filter((f) => !f.late).length);
      expect(asked).toEqual(first);
      expect(asked.map((u) => u.replace(/-\d+-[0-9a-f]+\.json$/, '')).filter((u, i, a) => a.indexOf(u) === i)).toEqual(FIRST.map((g) => `assets/kb-${g}`));
      await s.ready();
      expect(asked.length).toBe(first.length);
      expect(s.loadedGroups).toEqual(FIRST);
      expect(s.run('Detonate').hits[0]!.record.id).toBe('card:detonate');
      expect(s.run('Detonate').hits.length).toBeLessThanOrEqual(8);
      // the index holds exactly the first-search groups' records
      expect(s.index().records.length).toBe(groupRecords(FIRST).length);
    });

  for (const [what, cut] of [
    ['the build', files],
    ['a small cap', small],
  ] as const)
    it(`a question asking for statistics needs a late group; every part of it comes in, and searched again the statistics lead (${what})`, async () => {
      const { s, asked, urls } = fake(cut);
      await s.ready();
      expect(s.missing(q)).toEqual(['cardstat']);
      const before = s.run(q);
      expect(before.hits.some((h) => h.record.kind === 'cardstat')).toBe(false);
      const n = asked.length;
      await s.load(s.missing(q));
      expect(asked.slice(n)).toEqual(urls((p) => p.group === 'cardstat'));
      expect(s.missing(q)).toEqual([]);
      const after = s.run(q);
      expect(after.hits[0]!.record.kind).toBe('cardstat');
      expect(after.hits[0]!.record.links.some((l) => l.to === 'card:detonate')).toBe(true);
      // the same as the whole site pack without the other statistics group
      expect(after.hits.map((h) => h.record.id)).toEqual(full([...FIRST, 'cardstat']));
    });

  it('a failed fetch is reported and can be tried again', async () => {
    const { s, setFail } = fake();
    setFail(['core-1']);
    await expect(s.ready()).rejects.toThrow('offline');
    expect(s.isReady).toBe(false);
    setFail([]);
    await s.ready();
    expect(s.isReady).toBe(true);
  });

  it('a failed part: the parts already in are kept, its group counts for nothing until it is in, and a retry fetches only it', async () => {
    const { s, asked, setFail, urls } = fake(small);
    const ev = urls((p) => p.group === 'events');
    expect(ev.length).toBeGreaterThan(1);
    setFail(['events-2']);
    await expect(s.ready()).rejects.toThrow('offline');
    await settle();
    expect(s.isReady).toBe(false);
    expect(s.loadedGroups).toEqual(FIRST.filter((g) => g !== 'events'));
    const n = asked.length;
    setFail([]);
    await s.ready();
    expect(asked.slice(n)).toEqual(ev.filter((u) => u.includes('kb-events-2-')));
    expect(s.isReady).toBe(true);
    expect(s.loadedGroups).toEqual(FIRST);

    // a late group with a part that fails is not searched in part: the search is the one without it
    const cs = urls((p) => p.group === 'cardstat');
    expect(cs.length).toBeGreaterThan(1);
    setFail(['cardstat-1']);
    await expect(s.load(['cardstat'])).rejects.toThrow('offline');
    await settle();
    expect(s.missing(q)).toEqual(['cardstat']);
    expect(s.run(q).hits.map((h) => h.record.id)).toEqual(full(FIRST));
    const m = asked.length;
    setFail([]);
    await s.load(s.missing(q));
    expect(asked.slice(m)).toEqual([cs[0]]);
    expect(s.missing(q)).toEqual([]);
    expect(s.run(q).hits.map((h) => h.record.id)).toEqual(full([...FIRST, 'cardstat']));
  });

  it('a group the manifest does not have is refused', async () => {
    const { s } = fake();
    await expect(s.load(['nothing'])).rejects.toThrow('no group nothing');
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
          // an archived event has no page on the site
          if (r.fields?.archived === true) {
            expect(l, where).toBeNull();
            expect(events.has(String(r.fields.event)), where).toBe(false);
            break;
          }
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
        case 'lesson':
          expect(l, where).toEqual({ to: 'page', href: '#/tutorial', label: 'Tutorial' });
          break;
        case 'finding':
          expect(l?.to, where).toBe('page');
          if (l?.to === 'page') expect(l.href, where).toMatch(/^#\/evidence\/[a-f0-9]+\?f=/);
          break;
        default:
          throw new Error(`unexpected kind ${r.kind}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('says what a measured record rests on, keeps the association wording, and nothing for authored records', () => {
    const ev = shipped.find((r) => r.id === 'event:20')!;
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
  const gz = (cut: readonly SiteShardFile[]) => cut.map((f) => ({ name: shardFileName(f), gzipBytes: gzipBytes(f.json), late: f.late }));

  it('every part file is under the per-file cap, and the first-search parts together under their budget', () => {
    const sized = gz(files);
    for (const f of sized) expect(f.gzipBytes / 1000, f.name).toBeLessThanOrEqual(KB_FILE_CAP_KB);
    const first = sized.filter((f) => !f.late).reduce((n, f) => n + f.gzipBytes, 0);
    expect(first / 1000).toBeLessThanOrEqual(KB_FIRST_SEARCH_BUDGET_KB);
    // the build cuts to the cap in gzip bytes, measured the way the budget check measures
    expect(SITE_SIZING).toEqual({ size: gzipBytes, cap: KB_FILE_CAP_KB * 1000 });
    expect(searchBudgetProblems([...sized, { name: 'Search-AbC_12.js', gzipBytes: 1 }], SITE_GROUPS)).toEqual([]);
  });

  it('reads part file names, and tells the pack files and the page chunk from the rest', () => {
    expect(kbPartName('assets/kb-events-12-0123abcd.json')).toEqual({ group: 'events', part: 12 });
    expect(kbPartName('kb-core-1-0123456789abcdef.json')).toEqual({ group: 'core', part: 1 });
    // an older shard name, or no part number
    expect(kbPartName('assets/kb-core-0123abcd.json')).toBeNull();
    expect(kbPartName('assets/kb-core-0-0123abcd.json')).toBeNull();
    expect(kbPartName('assets/index-0123.js')).toBeNull();
    expect(isKbFile('assets/kb-core-0123abcd.json')).toBe(true);
    expect(isKbFile('assets/kb-events-2-0123abcd.json')).toBe(true);
    expect(isKbFile('assets/index-0123.js')).toBe(false);
    expect(isSearchChunk('assets/Search-Dns1wkau.js')).toBe(true);
    expect(isSearchChunk('assets/Search-Dns1wkau.css')).toBe(false);
  });

  it('the budget check names a part over the cap, the first search over its budget, a file the plan does not know, a group with no part, and the page chunk', () => {
    const groups = [
      { name: 'core', late: false },
      { name: 'events', late: false },
      { name: 'stats', late: true },
    ];
    const kb = (k: number) => k * 1000;
    const chunk = { name: 'Search-AbC_12.js', gzipBytes: kb(SEARCH_CHUNK_BUDGET_KB) - 1 };
    const ok = [
      { name: 'kb-core-1-0123456789abcdef.json', gzipBytes: kb(KB_FILE_CAP_KB) },
      { name: 'kb-events-1-0123456789abcdef.json', gzipBytes: kb(KB_FILE_CAP_KB) },
      { name: 'kb-events-2-0123456789abcdef.json', gzipBytes: kb(KB_FILE_CAP_KB) },
      { name: 'kb-events-3-0123456789abcdef.json', gzipBytes: kb(KB_FIRST_SEARCH_BUDGET_KB - 3 * KB_FILE_CAP_KB) },
      // late parts do not count for the first search
      { name: 'kb-stats-1-0123456789abcdef.json', gzipBytes: kb(KB_FILE_CAP_KB) },
      { name: 'kb-stats-2-0123456789abcdef.json', gzipBytes: kb(KB_FILE_CAP_KB) },
      chunk,
      { name: 'index-0123.js', gzipBytes: 999_000 },
    ];
    expect(searchBudgetProblems(ok, groups)).toEqual([]);
    // one byte more on a late part: over the cap; one byte more on a first-search part under the cap: over the first-search budget
    const plus = (prefix: string) => ok.map((f) => (f.name.startsWith(prefix) ? { ...f, gzipBytes: f.gzipBytes + 1 } : f));
    expect(searchBudgetProblems(plus('kb-stats-2'), groups)).toEqual([
      `kb-stats-2-0123456789abcdef.json: ${KB_FILE_CAP_KB.toFixed(1)} kB gzip is over the per-file cap of ${KB_FILE_CAP_KB} kB (tools/size-budget.ts); the packing in src/lib/kb/site.ts should have cut it smaller`,
    ]);
    expect(searchBudgetProblems(plus('kb-events-3'), groups)).toEqual([
      `the parts that load with the first search weigh ${KB_FIRST_SEARCH_BUDGET_KB.toFixed(1)} kB gzip together, over the first-search budget of ${KB_FIRST_SEARCH_BUDGET_KB} kB (tools/size-budget.ts): trim the pack, or raise the budget on purpose`,
    ]);
    const bad = searchBudgetProblems(
      [
        { name: 'kb-core-0123abcd.json', gzipBytes: 10 },
        { name: 'kb-new-1-0123abcd.json', gzipBytes: 10 },
        { name: 'kb-events-1-0123abcd.json', gzipBytes: 10 },
      ],
      groups,
    );
    expect(bad).toEqual([
      'kb-core-0123abcd.json: a knowledge-pack file that is not a part of any group in the plan (SITE_GROUPS in src/lib/kb/site.ts)',
      'kb-new-1-0123abcd.json: a knowledge-pack file that is not a part of any group in the plan (SITE_GROUPS in src/lib/kb/site.ts)',
      'the core group of the knowledge pack built no part file',
      'the stats group of the knowledge pack built no part file',
      'the search page chunk (Search-*.js) was not built; update SEARCH_CHUNK_BUDGET_KB in tools/size-budget.ts',
    ]);
    expect(searchBudgetProblems([...ok.slice(0, 6), { ...chunk, gzipBytes: kb(SEARCH_CHUNK_BUDGET_KB) + 100 }], groups)).toEqual([
      `Search-AbC_12.js: ${(SEARCH_CHUNK_BUDGET_KB + 0.1).toFixed(1)} kB gzip is over the search page's budget of ${SEARCH_CHUNK_BUDGET_KB} kB (tools/size-budget.ts): trim it, or raise the budget on purpose`,
    ]);
    expect(SEARCH_BUDGET).toEqual({ fileCapKb: KB_FILE_CAP_KB, firstSearchKb: KB_FIRST_SEARCH_BUDGET_KB, chunkKb: SEARCH_CHUNK_BUDGET_KB });
  });

  it('nothing is committed: the parts are made by the build, not kept under public/', () => {
    expect(fs.existsSync(path.join(ROOT, 'public', 'data', 'kb'))).toBe(false);
    const cfg = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
    expect(cfg).toContain('kbSitePack()');
    expect(cfg).toContain("tsImport('./tools/kb-site.ts'");
    // the build checks the parts against the plan of groups
    expect(cfg).toContain('searchBudgetProblems(files, m.SITE_GROUPS)');
  });
});
