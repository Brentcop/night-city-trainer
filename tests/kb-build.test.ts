// Knowledge pack builders (src/lib/kb/build, scripts/kb-sources.ts; docs/RAG_PLAN.md step 1.2): each builder on small
// invented fixtures, then one pass over the real public sources (ids unique, every link resolves, hashes stable, two
// builds byte-identical; the measured records name their bot and sim version and link as the plan says). Fixtures never hold official rules or FAQ wording; the data/raw check is structural only
// and is skipped when data/raw is absent.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { createRunManifest } from '../src/lib/runManifest';
import { RULES_VERSIONS } from '../src/lib/rulesVersions';
import { buildCards, cardDataVersion, type CardInput } from '../src/lib/kb/build/cards';
import { buildDecks, buildObjectives, type DeckInput, type ObjectiveInput } from '../src/lib/kb/build/decks';
import { buildCompetitive, MATCHUP_MIN_GAMES } from '../src/lib/kb/build/events';
import type { RecordedEvent } from '../src/lib/eventFacts';
import { buildErrata, buildFaq, buildRules, buildTournamentRules, citedRules, rulesDate } from '../src/lib/kb/build/local';
import { MAX_WORDS, mdSections, passages } from '../src/lib/kb/build/markdown';
import { mentionLinker } from '../src/lib/kb/build/mentions';
import { assemblePack, packLines, packManifest, parsePackLines } from '../src/lib/kb/build/pack';
import { buildGlossary, buildPackages, buildVocabulary } from '../src/lib/kb/build/packages';
import { buildCodeHeader, buildDocPassages, buildGuides, headerComment } from '../src/lib/kb/build/prose';
import { finishRecord } from '../src/lib/kb/build/record';
import { buildRulings } from '../src/lib/kb/build/rulings';
import { wordCount } from '../src/lib/kb/text';
import { recordHash } from '../src/lib/kb/types';
import { buildFromSources, loadCompetitive, RAW_FILES } from '../scripts/kb-sources';
import { FAQ_MATRIX } from './faq/matrix';

const ROOT = path.resolve(__dirname, '..');

const card = (id: string, name: string, subname: string | null, more: Partial<CardInput> = {}): CardInput => ({
  id,
  name,
  subname,
  displayName: subname ? `${name}: ${subname}` : name,
  color: 'Blue',
  type: 'Unit',
  cost: 3,
  power: 4,
  ram: 1,
  rarity: 'Common',
  tags: [],
  text: 'An invented effect.',
  keywords: [],
  sellable: true,
  set: 'fixture',
  number: '001',
  ...more,
});
const CARDS_FIX = [card('nova_a', 'Nova Vex', 'Glass Saint'), card('nova_b', 'Nova Vex', 'Iron Choir'), card('kilo', 'Kilo Byte', 'Router'), card('lag_trap', 'Lag Trap', null, { type: 'Program', power: null })];
const cardName = (id: string) => CARDS_FIX.find((c) => c.id === id)?.displayName;

describe('mention linker', () => {
  it('links full names and unique short forms, counts shared short forms', () => {
    const l = mentionLinker(CARDS_FIX);
    expect(l.cardsIn('Play Kilo Byte, then Nova Vex: Iron Choir and Lag Trap.')).toEqual(['kilo', 'nova_b', 'lag_trap']);
    expect(l.cardsIn('Nova Vex wins the fight.')).toEqual([]);
    expect(l.report()).toEqual({ mentions: 3, resolvedByDeck: 0, ambiguous: 1, ambiguousNames: { 'Nova Vex': 1 } });
  });
  it('resolves a shared name when exactly one of its cards is in the deck', () => {
    const l = mentionLinker(CARDS_FIX);
    expect(l.cardsIn('Nova Vex wins the fight.', ['nova_a', 'kilo'])).toEqual(['nova_a']);
    expect(l.cardsIn('Nova Vex wins the fight.', ['nova_a', 'nova_b'])).toEqual([]);
    expect(l.report()).toMatchObject({ resolvedByDeck: 1, ambiguous: 1 });
  });
});

describe('markdown', () => {
  const md = ['Intro line.', '', '# Title', 'Top text.', '## Part A', 'Alpha text.', '```', '## not a heading', '```', '### Deeper', 'Deep text.', '## Part A', 'Again.'].join('\n');
  it('splits at headings outside code fences, with unique slugs and heading paths', () => {
    const s = mdSections(md);
    expect(s.map((x) => x.slug)).toEqual(['intro', 'title', 'part-a', 'deeper', 'part-a-2']);
    expect(s[3]!.path).toEqual(['Title', 'Part A']);
    expect(s[2]!.body).toContain('## not a heading');
    expect(mdSections(md, { levels: [2] }).map((x) => x.slug)).toEqual(['intro', 'part-a', 'part-a-2']);
  });
  it('splits bold-lead bullets into sections of their own', () => {
    const s = mdSections('# Notes\n\n- **Stack:** one two.\n  - sub point.\n- **Engine:** three.\n', { bulletLeads: true });
    expect(s.map((x) => [x.heading, x.slug])).toEqual([
      ['Notes', 'notes'],
      ['Stack', 'stack'],
      ['Engine', 'engine'],
    ]);
    expect(s[1]!.body).toContain('sub point');
    expect(s[1]!.line).toBe(3);
  });
  it('cuts passages to at most MAX_WORDS words, keeping short blocks whole', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} has a few words.`).join(' ');
    const ps = passages(`Short block.\n\n${long}\n\n- item one\n- item two`);
    expect(ps.length).toBeGreaterThan(1);
    for (const p of ps) expect(wordCount(p)).toBeLessThanOrEqual(MAX_WORDS);
    expect(ps[0]!.startsWith('Short block.')).toBe(true);
    expect(passages('one '.repeat(300)).every((p) => wordCount(p) <= MAX_WORDS)).toBe(true);
  });
});

describe('builders on fixtures', () => {
  it('cards: one record each, short names and sub-names as aliases, the card data version stamped', () => {
    const rs = buildCards(CARDS_FIX, { file: 'cards.json', cardDataVersion: 'v1' });
    expect(rs.map((r) => r.id)).toEqual(['card:nova_a', 'card:nova_b', 'card:kilo', 'card:lag_trap']);
    expect(rs[0]!.aliases).toEqual(['Glass Saint', 'Nova Vex', 'nova_a']);
    expect(rs[3]!.text).toMatch(/^Lag Trap: a Blue Program card \(cost 3 €\$, RAM 1; Common\)\./);
    expect(rs[0]!.stamps).toEqual({ cardDataVersion: 'v1' });
    expect(rs[0]!.source).toEqual({ file: 'cards.json', at: '/0' });
  });

  it('cards: the data version is the run manifests’ cardDataVersion', () => {
    const m = createRunManifest({ runId: 'x', createdAt: '', purpose: 'analysis', simVersion: 0, ...RULES_VERSIONS, bot: { level: 'x' }, decks: [], field: { mode: 'x', deckIds: [] }, sample: { plannedGames: 0, completedGames: 0, gamesPerPair: null }, seedBase: 0, seatPolicy: 'alternate', trace: false });
    expect(cardDataVersion(CARDS)).toBe(m.cardDataVersion);
  });

  it('rulings: paraphrase, status and test, linked to the card and to other cards named', () => {
    const rs = buildRulings(
      [
        { id: 'abcdef12-0000', scope: 'card', cardId: 'kilo', paraphrase: 'Kilo Byte: Router still works beside Lag Trap', status: 'covered', test: 'tests/x.test.ts', file: 'tests/faq/entries/blue.ts', line: 4 },
        { id: '12345678-0000', scope: 'game', cardId: null, paraphrase: 'An invented general ruling', status: 'not-applicable', test: null, note: 'Nothing to model.', file: 'tests/faq/entries/general.ts' },
      ],
      { cardName, linker: mentionLinker(CARDS_FIX), faqVersion: 'f1', rulesVersion: 'r1' },
    );
    expect(rs[0]!.id).toBe('ruling:abcdef12');
    expect(rs[0]!.title).toBe('Kilo Byte: Router ruling 1');
    expect(rs[0]!.links).toEqual([
      { rel: 'card', to: 'card:kilo' },
      { rel: 'mentions', to: 'card:lag_trap' },
    ]);
    expect(rs[0]!.source).toEqual({ file: 'tests/faq/entries/blue.ts', at: 'L4' });
    expect(rs[1]!.title).toBe('Game rules ruling 1');
    expect(rs[1]!.text).toContain('Note: Nothing to model.');
    expect(rs[1]!.stamps).toEqual({ faqVersion: 'f1', rulesVersion: 'r1' });
  });

  const deck: DeckInput = { file: 'fx-mill.txt', path: 'data/decks/fx-mill.txt', name: 'Fixture Mill', kind: 'meta', legends: ['nova_a'], main: ['kilo', 'kilo', 'lag_trap'], sideboard: [], prov: { author: 'Someone' }, tier: 'B', listId: 'L1', deckId: 'D1', colors: 'B', packages: ['p1'] };

  it('decks: list, provenance and fingerprint; links to cards and packages', () => {
    const [r] = buildDecks([deck], { cardName, packageName: (id) => (id === 'p1' ? 'Package One' : undefined) });
    expect(r!.id).toBe('deck:fx-mill');
    expect(r!.aliases).toEqual(['D1', 'L1', 'fx-mill', 'fx-mill.txt']);
    expect(r!.text).toContain('Main deck (3 cards): 2 Kilo Byte: Router, 1 Lag Trap.');
    expect(r!.text).toContain('Built around: Package One.');
    expect(r!.stamps).toEqual({ listId: 'L1' });
    expect(r!.origin).toBe('imported');
    expect(r!.links.map((l) => l.to)).toEqual(['card:kilo', 'card:lag_trap', 'card:nova_a', 'pkg:p1']);
  });

  it('deck notes: tied to the list, linked to deck, key cards, signal terms; skipped without a library deck', () => {
    const note: ObjectiveInput = {
      listId: 'OLD',
      objective: 'Mill with Nova Vex and close with Lag Trap.',
      plan: [{ phase: 'early', text: 'Play Kilo Byte: Router.' }],
      keyCards: [{ id: 'kilo', role: 'Mills.' }],
      signals: [{ text: 'Trash of 8 by round 3', terms: ['trash-size', 'round'] }],
      risks: [],
      source: 'list',
      status: 'draft',
      basedOn: ['gone.txt', 'fx-mill.txt'],
    };
    const skipped: Record<string, number> = {};
    const rs = buildObjectives(
      { 'fx-mill.txt': note, 'missing.txt': note },
      { decks: new Map([['fx-mill.txt', { name: 'Fixture Mill', listId: 'L1', cards: ['nova_a', 'kilo', 'lag_trap'] }]]), cardName, linker: mentionLinker(CARDS_FIX), file: () => 'objectives.ts', skipped },
    );
    expect(rs).toHaveLength(1);
    expect(skipped).toEqual({ 'objective: deck not in the library': 1 });
    const r = rs[0]!;
    expect(r.id).toBe('objective:fx-mill');
    expect(r.fields).toMatchObject({ current: false, noteStatus: 'draft' });
    expect(r.status).toBe('draft');
    expect(r.text).toContain('written for an older list');
    // "Nova Vex" is shared by two cards; only nova_a is in this deck, so it resolves
    expect(r.links).toEqual([
      { rel: 'card', to: 'card:kilo' },
      { rel: 'deck', to: 'deck:fx-mill' },
      { rel: 'mentions', to: 'card:lag_trap' },
      { rel: 'mentions', to: 'card:nova_a' },
      { rel: 'term', to: 'term:signal/round' },
      { rel: 'term', to: 'term:signal/trash-size' },
    ]);
  });

  it('packages, glossary and vocabularies', () => {
    const linker = mentionLinker(CARDS_FIX);
    const [p] = buildPackages(
      [
        {
          id: 'p1',
          name: 'Package One',
          description: 'Fill the trash; Lag Trap likes it.',
          family: 'trash',
          bond: 'helps',
          status: 'owner',
          members: [{ id: 'kilo', role: 'enabler', note: 'mills' }],
          needs: { enabler: 1 },
          builtAround: { any: 3 },
          online: { term: 'all', of: [{ term: 'trash' }, { term: 'used' }] },
          onlineText: 'Trash holds cards.',
        },
      ],
      { cardName, linker, file: 'catalogue.ts', catalogueVersion: 'c1' },
    );
    expect(p!.id).toBe('pkg:p1');
    expect(p!.status).toBe('owner');
    expect(p!.links).toEqual([
      { rel: 'card', to: 'card:kilo' },
      { rel: 'mentions', to: 'card:lag_trap' },
      { rel: 'term', to: 'term:condition/all' },
      { rel: 'term', to: 'term:condition/trash' },
      { rel: 'term', to: 'term:condition/used' },
    ]);
    const [g] = buildGlossary([{ term: 'Win condition (7 Gigs)', group: 'Core', rule: 'CR 9.9', def: 'An invented definition naming Kilo Byte: Router.' }], { linker, file: 'glossary.ts' });
    expect(g!.id).toBe('term:win-condition-7-gigs');
    expect(g!.aliases).toEqual(['Win condition']);
    expect(g!.links).toEqual([{ rel: 'mentions', to: 'card:kilo' }]);
    const v = buildVocabulary({ 'b-term': 'Second.', 'a-term': 'First.' }, { family: 'signal', file: 'vocabulary.ts' });
    expect(v.map((r) => r.id)).toEqual(['term:signal/a-term', 'term:signal/b-term']);
    expect(v[0]!.aliases).toEqual(['a term']);
  });

  it('guides: one record per second-level section, linked to the intro and the deck', () => {
    const skipped: Record<string, number> = {};
    const rs = buildGuides(
      [
        { slug: 'g1', title: 'Guide One', deckFile: 'fx-mill.txt', summary: 'A summary.', md: 'Opening.\n## Game plan\nPlay Nova Vex early.\n### Detail\nMore.\n## Against it\nHit it.', file: 'guides.ts' },
        { slug: 'g2', title: 'Guide Two', deckFile: 'gone.txt', md: '## Only\nText.', file: 'guides.ts' },
      ],
      { decks: new Map([['fx-mill.txt', { id: 'deck:fx-mill', cards: ['nova_b'] }]]), linker: mentionLinker(CARDS_FIX), skipped },
    );
    expect(rs.map((r) => r.id)).toEqual(['guide:g1#intro', 'guide:g1#game-plan', 'guide:g1#against-it', 'guide:g2#intro', 'guide:g2#only']);
    expect(rs[0]!.text).toBe('A summary.\n\nOpening.');
    expect(rs[1]!.title).toBe('Guide One: Game plan');
    expect(rs[1]!.text).toContain('### Detail');
    expect(rs[1]!.links).toEqual([
      { rel: 'deck', to: 'deck:fx-mill' },
      { rel: 'mentions', to: 'card:nova_b' },
      { rel: 'parent', to: 'guide:g1#intro' },
    ]);
    expect(skipped).toEqual({ 'guide: deck not in the library': 1 });
  });

  it('docs: passages by heading, later parts linked to the first', () => {
    const body = Array.from({ length: 30 }, (_, i) => `Line ${i} of the long section talks about Kilo Byte: Router.`).join(' ');
    const rs = buildDocPassages('docs/X.md', `# X\n\n## Long one\n\n${body}\n\n## Empty\n\n## Short\n\nDone.`, { linker: mentionLinker(CARDS_FIX) });
    const ids = rs.map((r) => r.id);
    expect(ids[0]).toBe('doc:docs/X.md#long-one');
    expect(ids).toContain('doc:docs/X.md#long-one~2');
    expect(ids).toContain('doc:docs/X.md#short');
    expect(ids.some((i) => i.includes('empty'))).toBe(false);
    const second = rs.find((r) => r.id === 'doc:docs/X.md#long-one~2')!;
    expect(second.title).toBe('Long one (part 2)');
    expect(second.links).toContainEqual({ rel: 'parent', to: 'doc:docs/X.md#long-one' });
    expect(second.fields).toMatchObject({ file: 'docs/X.md', section: 'X > Long one', part: 2 });
    for (const r of rs) expect(wordCount(r.text)).toBeLessThanOrEqual(MAX_WORDS);
  });

  it('competitive: event, round, rating and matchup records, worded by templates, stamped and linked', () => {
    const g = (first: 0 | 1, winner: 0 | 1) => ({ seed: 0, first, winner, turns: 10, reason: 'invented end' });
    const event: RecordedEvent = {
      id: 9,
      name: 'Event #9',
      date: '2030-05-06T07:08:09.000Z',
      bot: 'fixture-bot',
      format: 'Swiss 1 round (Bo3) + top 2',
      config: { rounds: 1, top: 2, bestOf: 3 },
      decks: { 'Fixture Mill': { file: 'fx-mill.txt' }, 'Fixture Burn': { file: 'fx-burn.txt' }, Outsider: {} },
      rounds: [{ round: 1, matches: [{ a: 'Fixture Mill', b: 'Fixture Burn', games: [g(0, 0), g(1, 0)], winner: 'Fixture Mill', score: [2, 0] }, { a: 'Outsider', b: null, games: [], winner: 'Outsider', score: [2, 0] }] }],
      bracket: [{ name: 'Final', matches: [{ a: 'Fixture Mill', b: 'Outsider', games: [g(0, 1), g(1, 0), g(0, 0)], winner: 'Fixture Mill', score: [2, 1] }] }],
      standings: [],
      champion: 'Fixture Mill',
      simVersion: 7,
    };
    const row = (name: string, file: string, games: number) => ({ name, file, rating: 0.1, se: 0.2, games, wrField: 0.55, wrFieldLo: 0.45, wrFieldHi: 0.65, wrMeta: null, events: 1, titles: name === 'Fixture Mill' ? 1 : 0, top8: 1, avgFinish: 0.5, matches: '1-0', gamesRecord: '2-0' });
    const skipped: Record<string, number> = {};
    const rs = buildCompetitive(
      {
        events: [{ file: 'public/tournaments/event-9.json', event }],
        index: { file: 'index.json', data: { events: [{ id: 9, date: event.date, champion: 'Fixture Mill', simVersion: 7, bot: 'fixture-bot', top8: [{ deck: 'Fixture Mill' }, { deck: 'Outsider' }], standings: [{ deck: 'Fixture Mill', record: '1-0', games: '2-0' }, { deck: 'Outsider', record: '1-0', games: '0-0' }, { deck: 'Fixture Burn', record: '0-1', games: '0-2' }] }] } },
        ratings: { file: 'ratings.json', data: { events: 1, decks: [row('Fixture Mill', 'fx-mill.txt', 25), row('Fixture Burn', 'fx-burn.txt', 2)], manifest: { simVersion: 7, bot: { level: 'fixture-bot' }, createdAt: event.date } } },
        h2h: { file: 'h2h.json', data: { events: 1, decks: ['Fixture Mill', 'Fixture Burn', 'Outsider'], pairs: [[0, 1, 6, 7], [0, 2, 1, 2]], shrunk: [0.61, 0.5], model: { kind: 'bradley-terry-shrunk', ratings: [0.1, 0, 0], firstPlayer: 0.2, rho: 0.1, priorGames: 9 }, manifest: { simVersion: 7, bot: { level: 'fixture-bot' }, createdAt: event.date } } },
      },
      { deckId: (f) => (f === 'fx-mill.txt' || f === 'fx-burn.txt' ? `deck:${f.replace(/\.txt$/, '')}` : undefined), skipped },
    );
    expect(rs.map((r) => r.id)).toEqual(['event:9', 'round:9/1', 'round:9/final', 'rating:fx-mill', 'rating:fx-burn', 'rating:table', 'matchup:fx-burn~fx-mill']);
    const byId = new Map(rs.map((r) => [r.id, r]));
    for (const r of rs) {
      expect([r.origin, r.scope]).toEqual(['measured', 'public']);
      expect(r.stamps).toEqual({ asOf: '2030-05-06T07:08:09.000Z', bot: 'fixture-bot', simVersion: 7 });
      // the first sentence says what it is and names the bot and the sim version, and an old version is stale
      expect(r.text.split('\n')[0]).toContain('the fixture-bot bot on sim version 7 (stale: the current sim version is 8)');
      expect(r.fields?.stale).toBe(true);
      expect(r.text).not.toMatch(/\bbest deck\b|\byou should\b|\bbecause\b/i);
    }
    const ev = byId.get('event:9')!;
    expect(ev.aliases).toContain('event 9');
    expect(ev.links).toEqual([{ rel: 'deck', to: 'deck:fx-mill' }]);
    expect(ev.fields).toMatchObject({ champion: 'Fixture Mill', runnerUp: 'Outsider', games: 5, topCut: 2, entrants: 3, firstPlayerWins: 2, gamesWithWinner: 5 });
    expect(ev.text).toContain('The player going first won 2 of 5 (40.0%) games with a winner.');
    const r1 = byId.get('round:9/1')!;
    expect(r1.links).toEqual([{ rel: 'parent', to: 'event:9' }]);
    expect(r1.text).toContain('Leaders after round 1: Fixture Mill 1-0; Outsider 1-0 (2 decks on 3 match points).');
    expect(r1.fields).toMatchObject({ sweeps: 1, deciders: 0, byes: 1 });
    expect(byId.get('round:9/final')!.fields).toMatchObject({ sweeps: 0, deciders: 1 });
    expect(byId.get('round:9/final')!.aliases).toContain('final of event 9');
    const rating = byId.get('rating:fx-mill')!;
    expect(rating.title).toBe('Fixture Mill rating');
    expect(rating.links).toEqual([{ rel: 'deck', to: 'deck:fx-mill' }]);
    expect(rating.text).toContain('55.0% (90% range 45.0%–65.0%) over 25 rated games');
    expect(rating.text).toContain('Sim tier now: A.');
    expect(rating.fields).toMatchObject({ titles: 1, topCutAppearances: 1, swissTopEight: 1 });
    expect(Object.keys(rating.fields ?? {})).not.toContain('top8');
    expect(byId.get('rating:fx-burn')!.text).toContain('Sim tier now: unrated.');
    // the ratings table (step 1.6): the file's order, each deck with its range and games, the overlap said
    const table = byId.get('rating:table')!;
    expect(table.title).toBe('Power ratings table');
    expect(table.links).toEqual([]);
    expect(table.text.split('\n')).toEqual([
      'Power ratings table: the rated library decks in the order of their power rating, fitted over 1 recorded event played by the fixture-bot bot on sim version 7 (stale: the current sim version is 8), as of 2030-05-06. All 2 rated decks now:',
      '1. Fixture Mill: expected win rate against the whole field 55.0% (90% range 45.0%–65.0%) over 25 rated games; Sim tier now A.',
      '2. Fixture Burn: expected win rate against the whole field 55.0% (90% range 45.0%–65.0%) over 2 rated games; Sim tier now unrated.',
      'The 90% range of Fixture Mill overlaps the ranges of every other deck listed here: these games do not settle the order among them.',
      'Every neighbouring pair of ranges in this list overlaps.',
    ]);
    expect(table.fields).toMatchObject({ of: 2, shown: 2, first: 'Fixture Mill', stale: true });
    // only pairings with at least MATCHUP_MIN_GAMES games; written from the side whose key sorts first
    expect(MATCHUP_MIN_GAMES).toBe(6);
    const m = byId.get('matchup:fx-burn~fx-mill')!;
    expect(m.title).toBe('Fixture Burn vs Fixture Mill');
    expect(m.links).toEqual([
      { rel: 'deck', to: 'deck:fx-burn' },
      { rel: 'deck', to: 'deck:fx-mill' },
    ]);
    expect(m.text).toContain('Raw record: Fixture Burn won 1 of 7 (14.3%) games (ties count half)');
    expect(m.text).toContain('Shrunk estimate: 39.0% for Fixture Burn');
    expect(skipped).toEqual({});
  });

  it('code headers: line comments or a block comment at the top, nothing otherwise', () => {
    expect(headerComment('// One line header here.\n// Second line.\nimport x from "y";')).toEqual({ text: 'One line header here.\nSecond line.', from: 1, to: 2 });
    expect(headerComment('\n/**\n * Block header with words.\n */\nexport {};')).toEqual({ text: 'Block header with words.', from: 2, to: 4 });
    expect(headerComment('import x from "y";\n// later comment')).toBeNull();
    expect(headerComment('// eslint-disable-next-line\nx();')).toBeNull();
    const r = buildCodeHeader('src/lib/x.ts', '// Mentions Kilo Byte: Router in a header.\nexport {};', { linker: mentionLinker(CARDS_FIX) })!;
    expect(r.id).toBe('code:src/lib/x.ts');
    expect(r.aliases).toEqual(['src/lib/x', 'x.ts']);
    expect(r.links).toEqual([{ rel: 'mentions', to: 'card:kilo' }]);
  });
});

describe('local-only builders on invented text', () => {
  const rulesText = ['Preamble', 'LAST UPDATED', 'MAR 3, 2030', '01', 'FIRST CHAPTER', 'OPENING SECTION', '1.1', '', 'Invented rule text one.', '1.1.1', '(RECENTLY CHANGED)', '', 'Invented sub rule.', 'EXAMPLE: an invented example.', 'SECOND SECTION', '1.2', '', 'Invented rule two.', '1.3', 'More.',
    // a depth-2 rule with its own heading (a change mark between) and sub-rules; a titled sub-rule; an untitled sibling
    '1.4', '(RECENTLY CHANGED)', '', 'TITLED PART', '1.4.1', 'Invented text a.', '1.4.2', '', 'NAMED SUB', 'Invented text b.', '1.4.3', 'Invented text c.',
    // a chapter heading after a two-digit chapter number
    '02', 'SECOND CHAPTER', '2.1', 'Invented text d.', 'CREDITS', 'Names here'].join('\n');
  it('rules: one record per number, parent links, section titles, cited terms', () => {
    expect(rulesDate(rulesText)).toBe('2030-03-03');
    const rs = buildRules(rulesText, { file: 'raw/rules.txt', citations: [{ id: 'term:x', cite: 'CR 1.1–1.3' }] });
    expect(rs.map((r) => r.id)).toEqual(['rule:1.1', 'rule:1.1.1', 'rule:1.2', 'rule:1.3', 'rule:1.4', 'rule:1.4.1', 'rule:1.4.2', 'rule:1.4.3', 'rule:2.1']);
    expect(rs[0]!.title).toBe('Rule 1.1 (Opening Section)');
    expect(rs[1]!.title).toBe('Rule 1.1.1 (Opening Section)');
    expect(rs[1]!.text).toContain('EXAMPLE: an invented example.');
    expect(rs[1]!.fields).toMatchObject({ changed: true, chapter: 'First Chapter' });
    expect(rs[1]!.links).toEqual([{ rel: 'parent', to: 'rule:1.1' }]);
    expect(rs[2]!.title).toBe('Rule 1.2 (Second Section)');
    expect(rs[2]!.links).toEqual([{ rel: 'term', to: 'term:x' }]);
    expect(rs[3]!.title).toBe('Rule 1.3 (Second Section)');
    const [r14, r141, r142, r143, r21] = rs.slice(4);
    expect(r14!.title).toBe('Rule 1.4 (Titled Part)');
    expect(r14!.text).toBe('Comprehensive Rules 1.4, Titled Part: a section heading; its rules are 1.4.1, 1.4.2, 1.4.3.');
    expect(r14!.fields).toMatchObject({ changed: true, titled: true, section: 'Titled Part', chapter: 'First Chapter' });
    expect(r141!.title).toBe('Rule 1.4.1 (Titled Part)');
    expect(r141!.text).toBe('Comprehensive Rules 1.4.1, Titled Part: Invented text a.');
    expect(r142!.title).toBe('Rule 1.4.2 (Named Sub)');
    expect(r142!.text).toBe('Comprehensive Rules 1.4.2, Named Sub: Invented text b.');
    expect(r142!.fields).toMatchObject({ titled: true });
    // an untitled sibling after a titled one takes the parent's title, not the sibling's
    expect(r143!.title).toBe('Rule 1.4.3 (Titled Part)');
    expect(r143!.fields).toMatchObject({ section: 'Titled Part' });
    expect(r143!.fields?.titled).toBeUndefined();
    expect(r21!.title).toBe('Rule 2.1 (Second Chapter)');
    expect(r21!.fields).toMatchObject({ chapter: 'Second Chapter' });
    expect(r21!.text).not.toContain('Names here');
    for (const r of rs) expect([r.scope, r.origin, r.stamps?.rulesVersion]).toEqual(['local', 'official', '2030-03-03']);
    expect(citedRules('CR 1.1, 1.2.9, 1.3', new Set(['1.1', '1.3']))).toEqual(['rule:1.1', 'rule:1.3']);
  });
  it('faq: linked to the ruling with the same prefix and to its card', () => {
    const rs = buildFaq(
      [
        { id: 'abcdef12-0000', scope: 'card', question: 'Invented question?', answer: 'Invented answer.', card: { name: 'Kilo Byte' } },
        { id: 'ffffffff-0000', scope: 'game', question: 'Q?', answer: 'A.' },
      ],
      { file: 'raw/faq.json', version: 'v', rulingCard: new Map([['ruling:abcdef12', 'kilo']]) },
    );
    expect(rs[0]!.id).toBe('faq:abcdef12');
    expect(rs[0]!.links).toEqual([
      { rel: 'card', to: 'card:kilo' },
      { rel: 'ruling', to: 'ruling:abcdef12' },
    ]);
    expect(rs[1]!.links).toEqual([]);
    expect(rs[1]!.title).toBe('Official FAQ: game rules #1');
  });
  it('tournament rules by second-level entry, errata by entry', () => {
    const tr = buildTournamentRules('Intro line.\n1 Chapter One\n  1.1 First entry. More words.\n    1.1.1 ### Child  Child text.\n  1.2 Second entry\nB Appendix B', { file: 'raw/tr.txt' });
    expect(tr.map((r) => r.id)).toEqual(['trule:1.1', 'trule:1.2', 'trule:B']);
    expect(tr[0]!.title).toBe('Tournament rules 1.1: First entry');
    expect(tr[0]!.text).toContain('1.1.1 ### Child');
    const er = buildErrata('# Page\nIntro.\n## Set One\n### Kilo Byte: Router\nInvented change.\n### Kilo Byte: Router\nAgain.\n### FOOTER\nignored', { file: 'raw/errata.txt', linker: mentionLinker(CARDS_FIX) });
    expect(er.map((r) => r.id)).toEqual(['errata:kilo-byte-router', 'errata:kilo-byte-router-2']);
    expect(er[0]!.links).toEqual([{ rel: 'card', to: 'card:kilo' }]);
    expect(er[0]!.fields).toEqual({ set: 'Set One' });
  });
});

describe('assembling the pack', () => {
  const r = (id: string, scope: 'public' | 'local', to: string[] = []) =>
    finishRecord({ id, kind: 'doc', title: id, text: 'x', links: to.map((t) => ({ rel: 'mentions' as const, to: t })), source: { file: 'f' }, origin: 'authored', scope });
  const mentions = { mentions: 0, resolvedByDeck: 0, ambiguous: 0, ambiguousNames: {} };
  it('refuses duplicate ids', () => {
    expect(() => assemblePack([r('doc:a', 'public'), r('doc:a', 'public')], { mentions, skipped: {} })).toThrow(/duplicate record ids: doc:a/);
  });
  it('drops and lists dangling links and public-to-local links, sorts by id, rehashes', () => {
    const { records, report } = assemblePack([r('doc:b', 'public', ['doc:a', 'doc:zz', 'doc:loc']), r('doc:a', 'public'), r('doc:loc', 'local', ['doc:a'])], { mentions, skipped: { b: 1, a: 2 } });
    expect(records.map((x) => x.id)).toEqual(['doc:a', 'doc:b', 'doc:loc']);
    expect(records[1]!.links).toEqual([{ rel: 'mentions', to: 'doc:a' }]);
    expect(records[1]!.hash).toBe(recordHash(records[1]!));
    expect(records[2]!.links).toEqual([{ rel: 'mentions', to: 'doc:a' }]);
    expect(report.dangling).toEqual(['doc:b -mentions-> doc:loc', 'doc:b -mentions-> doc:zz']);
    expect(Object.keys(report.skipped)).toEqual(['a', 'b']);
  });
  it('writes one record per line and reads it back', () => {
    const rs = [r('doc:a', 'public'), r('doc:b', 'public')];
    const text = packLines(rs);
    expect(text.split('\n')).toHaveLength(3);
    expect(parsePackLines(text)).toEqual(rs);
    expect(() => parsePackLines('{"id":1}\n')).toThrow(/line 1/);
  });
});

describe('the real public sources', async () => {
  const a = await buildFromSources(ROOT, { raw: false });
  const b = await buildFromSources(ROOT, { raw: false });
  const ids = new Set(a.records.map((x) => x.id));
  const count = (k: string) => a.records.filter((x) => x.kind === k).length;

  it('builds every authored kind, public only', () => {
    expect(count('card')).toBe(CARDS.length);
    expect(count('ruling')).toBe(FAQ_MATRIX.length);
    expect(count('deck')).toBeGreaterThanOrEqual(40);
    expect(count('objective')).toBe(count('deck'));
    expect(count('package')).toBeGreaterThan(0);
    for (const k of ['term', 'guide', 'doc', 'code']) expect(count(k)).toBeGreaterThan(0);
    expect(a.local).toBe(false);
    expect(a.records.every((x) => x.scope === 'public')).toBe(true);
    expect(['faq', 'rule', 'trule', 'errata'].map(count)).toEqual([0, 0, 0, 0]);
  });

  it('has unique ids and every link resolves', () => {
    expect(ids.size).toBe(a.records.length);
    expect(a.report.dangling).toEqual([]);
    for (const x of a.records) for (const l of x.links) expect(ids.has(l.to), `${x.id} -> ${l.to}`).toBe(true);
  });

  it('keeps hashes that match the content, ids in order and forward-slash paths', () => {
    for (const x of a.records) expect(x.hash).toBe(recordHash(x));
    const sorted = [...a.records.map((x) => x.id)].sort((p, q) => (p < q ? -1 : p > q ? 1 : 0));
    expect(a.records.map((x) => x.id)).toEqual(sorted);
    for (const x of a.records) expect(x.source.file).not.toContain('\\');
  });

  it('builds byte-identical packs twice', () => {
    expect(packLines(b.records)).toBe(packLines(a.records));
    const man = (s: typeof a) => JSON.stringify(packManifest(s.records, { report: s.report, inputs: { x: '1' }, local: s.local, rulesVersion: s.rulesVersion, faqVersion: s.faqVersion, cardDataVersion: s.cardDataVersion }));
    expect(man(b)).toBe(man(a));
  });

  it('builds the measured records from the recorded events, ratings and head-to-heads', () => {
    const src = loadCompetitive(ROOT);
    expect(count('event')).toBe(src.events.length);
    expect(count('round')).toBe(src.events.reduce((a, e) => a + e.event.rounds.length + e.event.bracket.length, 0));
    // one per rated deck, and the table
    expect(count('rating')).toBe(src.ratings!.data.decks.length + 1);
    expect(count('matchup')).toBe(src.h2h!.data.pairs.filter((p) => p[3] >= MATCHUP_MIN_GAMES).length);
    const measured = a.records.filter((x) => ['event', 'round', 'rating', 'matchup'].includes(x.kind));
    for (const x of measured) {
      expect([x.origin, x.scope], x.id).toEqual(['measured', 'public']);
      const s = x.stamps!;
      expect(typeof s.simVersion === 'number' && typeof s.bot === 'string' && typeof s.asOf === 'string', x.id).toBe(true);
      expect(x.text.split('\n')[0], x.id).toContain(`the ${s.bot} bot on sim version ${s.simVersion}`);
      // D6: "top 8" only inside a recorded format label ("+ top 8") or naming the ratings file's count
      expect(x.text, x.id).not.toMatch(/(?<!\+ )\btop 8\b(?!" count)/i);
    }
    // links: a round to its event, an event to its champion's deck, a rating to its deck, a matchup to both decks; the
    // ratings table to nothing (it is found by name or keyword, not as every listed deck's neighbour)
    for (const x of measured) {
      const rels = x.links.map((l) => `${l.rel} ${l.to.slice(0, l.to.indexOf(':'))}`);
      if (x.kind === 'round') expect(rels).toEqual(['parent event']);
      if (x.id === 'rating:table') expect(rels).toEqual([]);
      else if (x.kind === 'event' || x.kind === 'rating') expect(rels).toEqual(['deck deck']);
      if (x.kind === 'matchup') expect(rels).toEqual(['deck deck', 'deck deck']);
    }
    const ev6 = a.records.find((x) => x.id === 'event:6');
    if (ev6) expect(ev6.stamps?.asOf).toBe(src.events.find((e) => e.event.id === 6)!.event.date);
  });

  it('reads no generated, tutorial or archived source', () => {
    for (const x of a.records) expect(x.source.file).not.toMatch(/^src\/content\/tutorial\/|tournamentPlan\.ts$|recommendation\.ts$|^scripts\/archive\/|^data\/decks\/archive\/|^data\/decks\/custom\/history\//);
    expect(ids.has('guide:tournament-plan#intro')).toBe(false);
  });

  const rawThere = Object.values(RAW_FILES).every((f) => fs.existsSync(path.join(ROOT, f)));
  it.skipIf(!rawThere)('with data/raw: local records only add to the public ones (structure only)', async () => {
    const full = await buildFromSources(ROOT, { raw: true });
    expect(full.local).toBe(true);
    const pub = full.records.filter((x) => x.scope === 'public');
    expect(packLines(pub)).toBe(packLines(a.records));
    const local = full.records.filter((x) => x.scope === 'local');
    for (const k of ['faq', 'rule', 'trule', 'errata']) expect(local.some((x) => x.kind === k)).toBe(true);
    for (const x of local) {
      expect(x.origin).toBe('official');
      expect(x.source.file.startsWith('data/raw/')).toBe(true);
    }
    expect(full.report.dangling).toEqual([]);
    const fullIds = new Set(full.records.map((x) => x.id));
    for (const x of full.records) for (const l of x.links) expect(fullIds.has(l.to)).toBe(true);
  });
});

