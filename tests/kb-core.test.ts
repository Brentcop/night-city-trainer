// Knowledge pack core (src/lib/kb, docs/RAG_PLAN.md step 1.1): tokenizer, BM25, name lookup, fusion, the no-match
// floor, dossiers, rendering and the token cap. Fixtures are invented records, never official wording.
import { describe, expect, it } from 'vitest';
import { fingerprintText } from '../src/engine/deck';
import { bm25Search, buildBm25, coverage } from '../src/lib/kb/bm25';
import { finishRecord, type RecordDraft } from '../src/lib/kb/build/record';
import { dossier, neighbours } from '../src/lib/kb/dossier';
import { buildNameIndex, findNameHits, findNames, lookupName } from '../src/lib/kb/names';
import { capBlocks, LOCAL_LABEL, renderDossierText, renderRecordsJson, renderSearchJson, renderSearchText, snippet, SNIPPET_MAX } from '../src/lib/kb/render';
import { buildIndex, cuedKinds, deckPairMatchups, fuse, MATCH_FLOOR, RRF_K, search, SEARCH_TUNING } from '../src/lib/kb/search';
import { slug, tokenize } from '../src/lib/kb/text';
import { estimateTokens, hashText, kindOfId, recordHash, type KbLink, type KbRecord } from '../src/lib/kb/types';

const rec = (id: string, title: string, text: string, more: Partial<RecordDraft> & { links?: KbLink[] } = {}): KbRecord =>
  finishRecord({ id, kind: kindOfId(id)!, title, text, source: { file: 'fixture' }, origin: 'authored', scope: 'public', ...more });

const FIXTURE: KbRecord[] = [
  rec('card:nova_vex_a', 'Nova Vex: Glass Saint', 'Nova Vex: Glass Saint is a Blue Legend that draws a card when a friendly Gig drops.', { aliases: ['Nova Vex', 'Glass Saint'] }),
  rec('card:nova_vex_b', 'Nova Vex: Iron Choir', 'Nova Vex: Iron Choir is a Red Unit with nine power.', { aliases: ['Nova Vex', 'Iron Choir'] }),
  rec('card:kilo_byte', 'Kilo Byte', 'Kilo Byte is a cheap Program that trashes the top card of your deck.'),
  rec('ruling:aaaaaaaa', 'Kilo Byte ruling 1', 'Ruling on Kilo Byte: it still trashes a card when the deck has one card left.', { links: [{ rel: 'card', to: 'card:kilo_byte' }] }),
  rec('deck:fixture-mill', 'Mirror Mill', 'Mirror Mill: a deck that fills its trash and replays Programs.', { links: [{ rel: 'card', to: 'card:kilo_byte' }, { rel: 'card', to: 'card:nova_vex_a' }] }),
  rec('term:lag', 'Lag', 'Lag: a new Unit cannot attack on the turn it enters the field.'),
  rec('doc:notes.md#method', 'Method', 'The method keeps records whole and ranks names before keywords.', { links: [{ rel: 'mentions', to: 'card:kilo_byte' }] }),
  rec('faq:aaaaaaaa', 'Invented FAQ item 1', 'An invented question and answer about Kilo Byte.', { scope: 'local', origin: 'official', links: [{ rel: 'ruling', to: 'ruling:aaaaaaaa' }] }),
];
const IX = buildIndex(FIXTURE);

describe('hashText', () => {
  it('gives the same value as fingerprintText (64-bit FNV-1a)', () => {
    for (const s of ['', 'a', 'Nova Vex: Glass Saint', 'é’€$ — ✓', 'x'.repeat(5000), JSON.stringify(FIXTURE)]) expect(hashText(s)).toBe(fingerprintText(s));
  });
  it('is the record hash over the content fields', () => {
    for (const r of FIXTURE) expect(r.hash).toBe(recordHash(r));
    const moved = { ...FIXTURE[0]!, source: { file: 'elsewhere' } };
    expect(recordHash(moved)).toBe(FIXTURE[0]!.hash);
  });
});

describe('tokenize', () => {
  it('folds accents and quotes, lower-cases and splits on non-alphanumerics', () => {
    expect(tokenize('Judy Álvarez’s DECK')).toEqual(['judy', 'alvarez', 'deck']);
  });
  it('drops stop words and single letters, keeps single digits and dotted numbers', () => {
    expect(tokenize('What is the rule 1.10.2 for a 7 Gig win?')).toEqual(['rule', '1.10.2', '7', 'gig', 'win']);
  });
  it('strips a plural s but not ss, and not from short words', () => {
    expect(tokenize('Gigs Programs class process bus')).toEqual(['gig', 'program', 'class', 'process', 'bus']);
  });
  it('makes id-safe slugs that keep rule numbers', () => {
    expect(slug('5. Steps & Stuff')).toBe('5-steps-stuff');
    expect(slug('Rule 1.10 (Win)')).toBe('rule-1.10-win');
    expect(slug('data/raw/')).toBe('data-raw');
  });
});

describe('bm25', () => {
  const ix = buildBm25([
    { id: 'b', title: 'Other', text: 'trash trash and more words here' },
    { id: 'a', title: 'Trash', text: 'a zone' },
    { id: 'c', title: 'Unrelated', text: 'nothing to see' },
    { id: 'd', title: 'Rare word', text: 'quasar trash' },
  ]);
  it('counts title tokens three times', () => {
    expect(bm25Search(ix, 'trash')[0]!.id).toBe('a');
  });
  it('weighs rare terms more', () => {
    expect(bm25Search(ix, 'quasar trash')[0]!.id).toBe('d');
  });
  it('returns only positive scores, ties by id', () => {
    const tie = buildBm25([
      { id: 'y', title: 'x', text: 'same' },
      { id: 'x', title: 'x', text: 'same' },
    ]);
    expect(bm25Search(tie, 'same').map((s) => s.id)).toEqual(['x', 'y']);
    expect(bm25Search(ix, 'absent')).toEqual([]);
  });
  it('measures the share of query words a document holds', () => {
    expect(coverage(ix, 'd', 'quasar trash pulsar')).toBeCloseTo(2 / 3);
    expect(coverage(ix, 'zz', 'trash')).toBe(0);
  });
});

describe('names', () => {
  const nx = buildNameIndex(FIXTURE);
  it('looks up by id, title and alias, any case, accents folded', () => {
    expect(lookupName(nx, 'card:kilo_byte')).toEqual(['card:kilo_byte']);
    expect(lookupName(nx, '  KILO   byte ')).toEqual(['card:kilo_byte']);
    expect(lookupName(nx, 'glass saint')).toEqual(['card:nova_vex_a']);
  });
  it('returns every record that shares a name', () => {
    expect(lookupName(nx, 'Nova Vex')).toEqual(['card:nova_vex_a', 'card:nova_vex_b']);
  });
  it('says how many words of the question named each record', () => {
    expect(findNameHits(nx, 'Kilo Byte')).toEqual([{ id: 'card:kilo_byte', words: 2 }]);
    expect(findNameHits(nx, 'does lag stop Nova Vex: Iron Choir')).toEqual([
      { id: 'card:nova_vex_b', words: 4 },
      { id: 'term:lag', words: 1 },
    ]);
  });
  it('finds names inside a question, longest first, within the allowed records', () => {
    expect(findNames(nx, 'How does Nova Vex: Iron Choir fight Kilo Byte?')).toEqual(['card:nova_vex_b', 'card:kilo_byte']);
    expect(findNames(nx, 'which method is used')).toEqual(['doc:notes.md#method']);
    expect(findNames(nx, 'which method is used', (id) => !id.startsWith('doc:'))).toEqual([]);
    expect(findNames(nx, 'Method', (id) => !id.startsWith('doc:'))).toEqual(['doc:notes.md#method']);
  });
});

describe('fuse', () => {
  it('sums weight / (60 + rank) over the lists, ties by id', () => {
    const f = fuse({ exact: ['x'], keyword: ['y', 'x'] }, { exact: 2, linked: 1, keyword: 1 });
    expect(f[0]).toEqual({ id: 'x', score: 2 / (RRF_K + 1) + 1 / (RRF_K + 2), ranks: { exact: 1, keyword: 2 } });
    expect(f[1]!.score).toBeCloseTo(1 / (RRF_K + 1));
    expect(fuse({ keyword: ['b'], linked: ['a'] }, { exact: 2, linked: 1, keyword: 1 }).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('search', () => {
  it('puts the record named in the question first, then its neighbours', () => {
    const r = search(IX, 'Kilo Byte');
    expect(r.hits[0]!.record.id).toBe('card:kilo_byte');
    expect(r.hits[0]!.ranks.exact).toBe(1);
    expect(r.hits.map((h) => h.record.id)).toContain('ruling:aaaaaaaa');
  });
  it('lets a neighbour of the kind the question asks for join the exact hits (kept by the step 1.4 measurement)', () => {
    expect([...cuedKinds('Kilo Byte rulings')]).toEqual(['ruling', 'faq']);
    expect([...cuedKinds('which decks play it, and the game plan')]).toEqual(['deck', 'objective']);
    expect(cuedKinds('Kilo Byte').size).toBe(0);
    const r = search(IX, 'Kilo Byte rulings');
    expect(r.hits[0]!.record.id).toBe('ruling:aaaaaaaa');
    expect(r.hits[0]!.ranks).toMatchObject({ exact: 2, linked: 1 });
    expect(r.hits[1]!.record.id).toBe('card:kilo_byte');
    // only with the linked ranker: exact alone finds the card and nothing it links to
    expect(search(IX, 'Kilo Byte rulings', { rankers: ['exact'] }).hits.map((h) => h.record.id)).toEqual(['card:kilo_byte']);
  });
  it('filters by kind and scope, and runs only the rankers asked for', () => {
    expect(search(IX, 'Kilo Byte', { kinds: ['ruling'] }).hits.map((h) => h.record.id)).toEqual(['ruling:aaaaaaaa']);
    expect(search(IX, 'Kilo Byte', { scope: 'local' }).hits.map((h) => h.record.id)).toEqual(['faq:aaaaaaaa']);
    const kw = search(IX, 'Kilo Byte', { rankers: ['keyword'] });
    expect(kw.hits.every((h) => h.ranks.exact === undefined && h.ranks.linked === undefined)).toBe(true);
    expect(search(IX, 'Kilo Byte', { k: 2 }).hits).toHaveLength(2);
  });
  it('says no match rather than returning noise', () => {
    expect(search(IX, 'xyzzy plugh').noMatch).toBe(true);
    // one word of four known, below the floor
    expect(MATCH_FLOOR).toBe(0.5);
    expect(search(IX, 'quasar pulsar nebula trash').noMatch).toBe(true);
    expect(search(IX, 'fills trash replays').noMatch).toBe(false);
  });
  it('keeps the step 1.6 settings at their defaults (none of the three experiments was kept)', () => {
    expect(SEARCH_TUNING).toEqual({ floor: MATCH_FLOOR, floorHits: 1, singleWordTermLinks: true, deckPairMatchup: false });
    expect([...cuedKinds('which decks are strongest')]).toEqual(['deck', 'rating']);
  });
  it('varies the floor and how many keyword hits may meet it, for experiments', () => {
    // one word of four known: refused at the default floor, answered at a quarter
    expect(search(IX, 'quasar pulsar nebula trash', { tuning: { floor: 0.25 } }).noMatch).toBe(false);
    // "quasar nebula": the best hit (by BM25) holds one of the two words, the second hit both
    const ix = buildIndex([
      rec('doc:a.md#a', 'Alpha', 'quasar quasar quasar quasar'),
      rec('doc:a.md#b', 'Beta', 'quasar nebula and many more filler words here to make this passage long'),
      ...['c', 'd', 'e'].map((x) => rec(`doc:a.md#${x}`, `Filler ${x}`, 'nebula')),
    ]);
    expect(bm25Search(ix.bm25, 'quasar nebula').slice(0, 2).map((s) => s.id)).toEqual(['doc:a.md#a', 'doc:a.md#b']);
    expect(search(ix, 'quasar nebula', { tuning: { floor: 1 } }).noMatch).toBe(true);
    expect(search(ix, 'quasar nebula', { tuning: { floor: 1, floorHits: 3 } }).noMatch).toBe(false);
  });
  it('can stop expanding links from a glossary term named by one word, which still counts as an exact hit', () => {
    const ix = buildIndex([
      rec('term:trash', 'Trash', 'Trash: the pile of used cards.'),
      rec('pkg:trash-fill', 'Filling the trash', 'A package that fills the pile.', { links: [{ rel: 'term', to: 'term:trash' }] }),
      rec('doc:x.md#y', 'Unrelated', 'Words about something else entirely.'),
    ]);
    const on = search(ix, 'what goes in the trash');
    expect(on.hits.find((h) => h.record.id === 'pkg:trash-fill')?.ranks.linked).toBe(1);
    const off = search(ix, 'what goes in the trash', { tuning: { singleWordTermLinks: false } });
    expect(off.noMatch).toBe(false);
    expect(off.hits[0]!.record.id).toBe('term:trash');
    expect(off.hits.find((h) => h.record.id === 'pkg:trash-fill')?.ranks.linked).toBeUndefined();
  });
  it('can add the matchup of two decks named in the question to the exact list', () => {
    const ix = buildIndex([
      rec('deck:alpha-list', 'Alpha List', 'An invented deck.'),
      rec('deck:bravo-list', 'Bravo List', 'Another invented deck.'),
      rec('matchup:alpha-list~bravo-list', 'Alpha List vs Bravo List', 'An invented head-to-head.', { links: [{ rel: 'deck', to: 'deck:alpha-list' }, { rel: 'deck', to: 'deck:bravo-list' }] }),
    ]);
    expect(deckPairMatchups(ix, ['deck:bravo-list', 'deck:alpha-list', 'card:x'])).toEqual(['matchup:alpha-list~bravo-list']);
    expect(deckPairMatchups(ix, ['deck:alpha-list'])).toEqual([]);
    const q = 'how does alpha list do against bravo list';
    // matchups are cue-only: without "vs" or "matchup" the record is not found, unless the setting is on
    expect(search(ix, q).hits.map((h) => h.record.id)).not.toContain('matchup:alpha-list~bravo-list');
    expect(search(ix, q, { tuning: { deckPairMatchup: true } }).hits.find((h) => h.record.id === 'matchup:alpha-list~bravo-list')?.ranks.exact).toBe(3);
  });
});

describe('dossier', () => {
  it('groups neighbours by link type; a reverse link by what the neighbour is, mentions stay mentions', () => {
    const g = neighbours(IX, 'card:kilo_byte');
    expect(g.map((x) => x.rel)).toEqual(['deck', 'ruling', 'mentions']);
    expect(g.find((x) => x.rel === 'mentions')!.records.map((r) => r.id)).toEqual(['doc:notes.md#method']);
    expect(neighbours(IX, 'ruling:aaaaaaaa').map((x) => x.rel)).toEqual(['card', 'official']);
  });
  it('cuts to a token budget and counts what it left out', () => {
    const full = dossier(IX, 'card:kilo_byte')!;
    expect(full.omitted).toBe(0);
    const tight = dossier(IX, 'card:kilo_byte', { maxTokens: estimateTokens(FIXTURE[2]!.text) + estimateTokens('Kilo Byte') + 20 + 12 })!;
    expect(tight.omitted).toBeGreaterThan(0);
    expect(tight.groups.reduce((a, x) => a + x.records.length, 0)).toBe(1);
    expect(renderDossierText(tight)).toMatch(/more cut by --max-tokens/);
    expect(dossier(IX, 'card:none')).toBeNull();
  });
});

describe('render', () => {
  const long = rec('doc:long.md#x', 'Long', `${'Filler words go here. '.repeat(30)}The quasar sentence is the one that matters. ${'More filler text. '.repeat(30)}`);
  it('cuts snippets to 300 characters, near the first query word', () => {
    const s = snippet(long.text, 'quasar');
    expect(s.length).toBeLessThanOrEqual(SNIPPET_MAX);
    expect(s).toContain('quasar');
    expect(s.startsWith('…')).toBe(true);
    expect(snippet('short text')).toBe('short text');
    expect(snippet(long.text).length).toBeLessThanOrEqual(SNIPPET_MAX);
  });
  it('labels local records as local-only, in text and JSON', () => {
    const r = search(IX, 'Kilo Byte', { scope: 'local' });
    expect(renderSearchText(r)).toContain(LOCAL_LABEL);
    expect(JSON.parse(renderSearchJson(r)).hits[0].localOnly).toBe(true);
    expect(renderSearchText(search(IX, 'Lag'))).not.toContain(LOCAL_LABEL);
  });
  it('shows id, title, kind, scope, origin and source', () => {
    const out = renderSearchText(search(IX, 'Lag'));
    expect(out).toMatch(/^1\. term:lag {2}Lag\n {2}\[term · authored · public\]\n {2}source: fixture\n/);
  });
  it('keeps the output within the token cap', () => {
    const many = buildIndex(Array.from({ length: 30 }, (_, i) => rec(`doc:m.md#p${String(i).padStart(2, '0')}`, `Passage ${i}`, `quasar ${'filler '.repeat(60)}`)));
    const res = search(many, 'quasar', { k: 30 });
    for (const max of [60, 200, 800]) {
      const out = renderSearchText(res, max);
      expect(estimateTokens(out)).toBeLessThanOrEqual(max);
      expect(out).toMatch(/more results cut by --max-tokens/);
      expect(estimateTokens(renderSearchJson(res, max))).toBeLessThanOrEqual(Math.max(max, 60));
    }
    expect(JSON.parse(renderRecordsJson(many.records, 300)).cut).toBeGreaterThan(0);
    expect(capBlocks(['a'.repeat(4000)], 100)).toMatch(/\(cut by --max-tokens\)$/);
    expect(estimateTokens(capBlocks(['a'.repeat(4000)], 100))).toBeLessThanOrEqual(100);
  });
});
