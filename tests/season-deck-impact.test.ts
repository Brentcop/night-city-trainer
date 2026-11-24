// The season breeder's card-impact files (data/seasons/impact.json, src/lib/seasonImpact.ts; data/seasons/deck-impact.json,
// src/lib/seasonDeckImpact.ts), kept by simulator version and bot, and what the breeder reads from them
// (src/lib/breederImpact.ts): old shapes are refused with the migration named, never misread; a season adds to the
// entry of its own pair, once; the breeder reads one pair's numbers (the current pair when it has any, else the closest,
// with a warning), never a sum of two; the one-off split of 2026-11-16 is exact; the season and the preview share one
// reader; a season already counted is found before it plays; check:data checks the shapes.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addCards, addToDeckImpact, breederDeckImpact, emptyDeckImpact, emptyDeckImpactV1, isLegacyDeckImpact, LEGACY_DECK_IMPACT, migrateDeckImpact, parseDeckImpact, parseDeckImpactV1, V1_DECK_IMPACT, type DeckImpactFile } from '../src/lib/seasonDeckImpact';
import { addToCardImpact, emptyCardImpact, impactBot, LEGACY_CARD_IMPACT, parseCardImpact, SEASON_IMPACT_MIGRATION, type CardImpactFile } from '../src/lib/seasonImpact';
import { addsUpTo, checkSplit, choosePair, exactDifference, impactFilesProblems, impactTablesWords, readImpactTables, seasonCountIn, seasonCountWords, splitImpactFiles, tablesEmpty } from '../src/lib/breederImpact';
import { IMPACT_MIN_DECK_GAMES, IMPACT_MIN_POOLED_GAMES } from '../src/analysis/impactData';
import { seedsOf } from '../src/ai/breeder';
import { listFingerprint } from '../src/engine/deck';
import { SIM_VERSION } from '../src/lib/tournament';
import { checkData } from '../scripts/check-data';
import { runFiles, SERIES_DIR } from '../scripts/lib-node';
import { loadImpactTables, SEASON_BOT } from '../scripts/breed-data';
import { synthDecks } from './builder-fixtures';

const OLD = {
  'Deck A': { c1: { s: 3, n: 30 }, c2: { s: -1.5, n: 10 } },
  'Deck B': { c1: { s: 0.25, n: 50 } },
  'Gone deck': { c3: { s: 1, n: 40 } },
};
const A = 'aaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbb';
const json = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const stat = (id: string, iwd: number, seenGames: number) => ({ id, iwd, seenGames });

describe('the per-list file (deck-impact.json)', () => {
  it('refuses the name-keyed file and the pooled schema 1, each naming its migration, and anything malformed', () => {
    expect(isLegacyDeckImpact(OLD)).toBe(true);
    expect(parseDeckImpact(OLD)).toEqual({ problem: LEGACY_DECK_IMPACT });
    const v1 = { ...emptyDeckImpactV1(), lists: { [A]: { name: 'X', cards: { c: { s: 1, n: 2 } } } } };
    expect(parseDeckImpact(v1)).toEqual({ problem: V1_DECK_IMPACT });
    expect(V1_DECK_IMPACT).toContain(SEASON_IMPACT_MIGRATION);
    expect(parseDeckImpact({ ...emptyDeckImpact(), schema: 3 }).problem).toMatch(/schema 3/);
    expect(parseDeckImpact(null).problem).toMatch(/not a deck-impact file/);
    const entry = (lists: unknown, extra: object = {}) => ({ ...emptyDeckImpact(), entries: [{ simVersion: 9, bot: 'hard', sources: [{ kind: 'season', season: 3 }], lists, ...extra }] });
    expect(parseDeckImpact(entry({ 'Deck A': { name: 'Deck A', cards: {} } })).problem).toMatch(/not a list fingerprint/);
    expect(parseDeckImpact(entry({ [A]: { name: 'X', cards: { c: { s: 'a', n: 1 } } } })).problem).toMatch(/cards of/);
    expect(parseDeckImpact(entry({ [A]: { name: 'X', cards: { c: { s: Number.NaN, n: 1 } } } })).problem).toMatch(/cards of/);
    expect(parseDeckImpact(entry({}, { bot: 'lookahead' })).problem).toMatch(/not the canonical name \("medium"\)/);
    expect(parseDeckImpact(entry({}, { simVersion: 0 })).problem).toMatch(/simulator version/);
    expect(parseDeckImpact(entry({}, { sources: [{ kind: 'season', season: 3 }, { kind: 'season', season: 3 }] })).problem).toMatch(/listed twice/);
    const two = { ...emptyDeckImpact(), entries: [entry({}).entries[0], { ...entry({}).entries[0], sources: [] }] };
    expect(parseDeckImpact(two).problem).toMatch(/two entries for simulator version 9, hard bot/);
    const sameSeason = { ...emptyDeckImpact(), entries: [entry({}).entries[0], { ...entry({}).entries[0], simVersion: 8 }] };
    expect(parseDeckImpact(sameSeason).problem).toMatch(/counts season 3 in two entries/);
    const ok = parseDeckImpact(json(entry({ [A]: { name: 'X', cards: { c: { s: 1, n: 2 } }, keyedFrom: 'name' } })));
    expect(ok.file?.entries[0]?.lists[A]?.cards.c).toEqual({ s: 1, n: 2 });
    // the migrations read schema 1 only
    expect(parseDeckImpactV1(v1).file).toBeTruthy();
    expect(parseDeckImpactV1(ok.file).problem).toMatch(/not schema 1/);
  });

  it('migrates names by name only when exactly one list has it, keeping numbers and order, and never guesses the rest', () => {
    const lists = [
      { name: 'Deck A', fingerprint: A, file: 'a.txt' },
      { name: 'Deck B', fingerprint: B },
      { name: 'Deck B', fingerprint: 'cccccccccccccccc' },
    ];
    const m = migrateDeckImpact(OLD, lists);
    expect(m.matched).toEqual([{ name: 'Deck A', fingerprint: A, file: 'a.txt' }]);
    expect(m.unmatched.map((u) => u.name)).toEqual(['Deck B', 'Gone deck']);
    expect(m.file.lists).toEqual({ [A]: { name: 'Deck A', cards: OLD['Deck A'], keyedFrom: 'name' } });
    expect(Object.keys(m.file.lists[A]!.cards)).toEqual(['c1', 'c2']);
    expect(m.file.unmatched?.['Gone deck']).toEqual({ cards: OLD['Gone deck'], why: 'no current library list has this name' });
    expect(m.file.unmatched?.['Deck B']?.why).toMatch(/2 different library lists/);
    expect(parseDeckImpactV1(json(m.file)).file).toBeTruthy();
    const twin = migrateDeckImpact({ 'Deck A': OLD['Deck A'], 'Deck A again': OLD['Deck B'] }, [
      { name: 'Deck A', fingerprint: A },
      { name: 'Deck A again', fingerprint: A },
    ]);
    expect(twin.unmatched).toEqual([{ name: 'Deck A again', why: 'its list is the same as "Deck A", already keyed' }]);
  });

  it('pools reports by fingerprint and gives the breeder means over cards drawn in enough games', () => {
    const lists = {};
    addCards(lists, A, 'Deck A', [stat('c1', 0.1, 30), stat('c2', Number.NaN, 30), stat('c3', 0.2, 0)]);
    addCards(lists, A, 'Renamed A', [stat('c1', -0.1, 10)]);
    expect(lists).toEqual({ [A]: { name: 'Deck A', cards: { c1: { s: 0.1 * 30 - 0.1 * 10, n: 40 } } } });
    expect(breederDeckImpact(lists, 40)).toEqual({ [A]: { c1: (0.1 * 30 - 0.1 * 10) / 40 } });
    expect(breederDeckImpact(lists, 41)).toEqual({ [A]: {} });
  });

  it('the breeder reads a parent’s impact by its list, never by its name', () => {
    const [d] = synthDecks();
    const id = d!.main[0]!;
    const byList = { [listFingerprint(d!)]: { [id]: -0.2 } };
    expect(seedsOf([d!], byList).get(id)).toBe(0);
    expect(seedsOf([{ ...d!, name: 'Renamed' }], byList).get(id)).toBe(0);
    expect(seedsOf([d!], { [d!.name]: { [id]: -0.2 } }).get(id)).toBeGreaterThan(0);
    const changed = { ...d!, main: [...d!.main, id] };
    expect(listFingerprint(changed)).not.toBe(listFingerprint(d!));
    expect(seedsOf([changed], byList).get(id)).toBeGreaterThan(0);
  });
});

describe('the pooled file (impact.json)', () => {
  it('refuses the old shape with the migration named, and malformed files', () => {
    const old = { c1: { s: 1, n: 2 }, c2: { s: -3, n: 70 } };
    expect(parseCardImpact(old)).toEqual({ problem: LEGACY_CARD_IMPACT });
    expect(LEGACY_CARD_IMPACT).toContain(SEASON_IMPACT_MIGRATION);
    expect(parseCardImpact({ kind: 'nct-card-impact', schema: 2, entries: [] }).problem).toMatch(/schema 2/);
    expect(parseCardImpact({ kind: 'other' }).problem).toMatch(/not a card-impact file/);
    const e = { simVersion: 9, bot: 'hard', sources: [{ kind: 'season', season: 3 }], cards: { c: { s: 1, n: 2 } } };
    expect(parseCardImpact({ ...emptyCardImpact(), entries: [{ ...e, cards: { c: { s: Infinity, n: 2 } } }] }).problem).toMatch(/finite/);
    expect(parseCardImpact({ ...emptyCardImpact(), entries: [{ ...e, cards: { c: { s: 1, n: -2 } } }] }).problem).toMatch(/finite/);
    expect(parseCardImpact({ ...emptyCardImpact(), entries: [{ ...e, sources: [{ kind: 'analysis' }] }] }).problem).toMatch(/source is malformed/);
    expect(parseCardImpact({ ...emptyCardImpact(), entries: [e, { ...e, sources: [] }] }).problem).toMatch(/two entries/);
    expect(parseCardImpact(json({ ...emptyCardImpact(), entries: [e] })).file?.entries[0]?.cards).toEqual({ c: { s: 1, n: 2 } });
  });

  it('a season adds to the entry of its own simulator version and canonical bot, and is counted once', () => {
    const f = emptyCardImpact();
    addToCardImpact(f, { simVersion: 5, bot: 'deep' }, { kind: 'season', season: 1 }, [{ cards: [stat('c1', 0.5, 10)] }]);
    addToCardImpact(f, { simVersion: 9, bot: 'hard' }, { kind: 'season', season: 3, runId: 'r3' }, [{ cards: [stat('c1', -0.2, 20), stat('c2', 0.1, 0)] }]);
    // lookahead is Medium: one entry for both names
    addToCardImpact(f, { simVersion: 9, bot: 'lookahead' }, { kind: 'season', season: 4 }, [{ cards: [stat('c1', 0.3, 10)] }]);
    addToCardImpact(f, { simVersion: 9, bot: 'medium' }, { kind: 'season', season: 5 }, [{ cards: [stat('c1', 0.1, 10)] }]);
    expect(f.entries.map((e) => [e.simVersion, e.bot, e.sources.map((s) => (s.kind === 'season' ? s.season : 0))])).toEqual([
      [5, 'deep', [1]],
      [9, 'hard', [3]],
      [9, 'medium', [4, 5]],
    ]);
    expect(f.entries[1]!.cards).toEqual({ c1: { s: -4, n: 20 } });
    expect(f.entries[2]!.cards.c1!.n).toBe(20);
    expect(() => addToCardImpact(f, { simVersion: 9, bot: 'hard' }, { kind: 'season', season: 1 }, [])).toThrow(/already counts season 1/);
    expect(parseCardImpact(json(f)).file).toBeTruthy();
    const d = emptyDeckImpact();
    const skipped = addToDeckImpact(d, { simVersion: 9, bot: 'best' }, { kind: 'season', season: 4 }, [{ deck: 'Deck A', cards: [stat('c1', 0.5, 4)] }, { deck: 'Unknown', cards: [] }], (n) => (n === 'Deck A' ? A : undefined));
    expect(skipped).toEqual(['Unknown']);
    expect(d.entries).toEqual([{ simVersion: 9, bot: 'medium', sources: [{ kind: 'season', season: 4 }], lists: { [A]: { name: 'Deck A', cards: { c1: { s: 2, n: 4 } } } } }]);
    expect(() => addToDeckImpact(d, { simVersion: 9, bot: 'hard' }, { kind: 'season', season: 4 }, [], () => A)).toThrow(/already counts season 4/);
  });

  it('a season already counted is found before it plays: in both files it is said and skipped, in one only it is refused', () => {
    const card = (seasons: number[]): CardImpactFile => ({ ...emptyCardImpact(), entries: [{ simVersion: 9, bot: 'hard', sources: seasons.map((season) => ({ kind: 'season' as const, season })), cards: {} }] });
    const deck = (seasons: number[]): DeckImpactFile => ({ ...emptyDeckImpact(), entries: [{ simVersion: 9, bot: 'hard', sources: seasons.map((season) => ({ kind: 'season' as const, season })), lists: {} }] });
    expect(seasonCountIn(card([3]), deck([3]), 4)).toEqual({ state: 'neither' });
    expect(seasonCountWords(4, { state: 'neither' })).toBeNull();
    expect(seasonCountIn(card([3, 4]), deck([3, 4]), 4)).toEqual({ state: 'both' });
    expect(seasonCountWords(4, { state: 'both' })).toEqual({ refuse: false, line: "Season 4's round robin is already in the card-impact tables (data/seasons/impact.json and deck-impact.json): it will not be added again." });
    // under another pair counts too: a season is counted once, whatever its pair
    const old = { ...emptyCardImpact(), entries: [{ simVersion: 5, bot: 'deep', sources: [{ kind: 'season' as const, season: 4 }], cards: {} }] };
    expect(seasonCountIn(old, deck([4]), 4)).toEqual({ state: 'both' });
    const one = seasonCountIn(card([3, 4]), deck([3]), 4);
    expect(one).toEqual({ state: 'one', has: 'impact.json', lacks: 'deck-impact.json' });
    expect(seasonCountWords(4, one)).toEqual({
      refuse: true,
      line: 'data/seasons/impact.json counts season 4 but data/seasons/deck-impact.json does not (a run stopped between the two writes); npm run check:data shows it. Put the two files back in step (from git history) before running season 4: nothing is guessed.',
    });
    expect(seasonCountIn(card([3]), deck([3, 4]), 4)).toEqual({ state: 'one', has: 'deck-impact.json', lacks: 'impact.json' });
  });

  it('canonical bot names are the change ledger’s', () => {
    expect(['lookahead', 'best', 'medium'].map(impactBot)).toEqual(['medium', 'medium', 'medium']);
    expect(['fast', 'easy', 'hard', 'deep', 'hard-v1', 'someday'].map(impactBot)).toEqual(['easy', 'easy', 'hard', 'deep', 'hard-v1', 'someday']);
  });
});

describe('what the breeder reads', () => {
  const cardFile = (): CardImpactFile => ({
    kind: 'nct-card-impact',
    schema: 1,
    entries: [
      { simVersion: 5, bot: 'deep', sources: [{ kind: 'season', season: 1 }], cards: { old: { s: 600, n: 600 }, c1: { s: 900, n: 900 } } },
      { simVersion: 9, bot: 'hard', sources: [{ kind: 'season', season: 3 }], cards: { c1: { s: -6, n: 60 }, c2: { s: 5.9, n: 59 } } },
    ],
  });
  const deckFile = (): DeckImpactFile => ({
    ...emptyDeckImpact(),
    entries: [
      { simVersion: 5, bot: 'deep', sources: [{ kind: 'season' as const, season: 1 }], lists: { [A]: { name: 'A', cards: { c1: { s: 30, n: 30 } } } } },
      { simVersion: 9, bot: 'hard', sources: [{ kind: 'season' as const, season: 3 }], lists: { [B]: { name: 'B', cards: { c1: { s: 3, n: 30 }, c2: { s: 2.9, n: 29 } } } } },
    ],
  });
  const analysis = (simVersion: number, level: string) => ({ manifest: { simVersion, bot: { level }, runId: 'an' }, decks: [{ deck: 'A', id: A, cards: [stat('c2', 1, 1), stat('c3', 0.5, 60)] }] });

  it('with numbers for the current simulator version and bot, reads that entry alone, with the minimum games', () => {
    const t = readImpactTables({ cardFile: cardFile(), deckFile: deckFile(), key: { simVersion: 9, bot: 'hard' } });
    expect(t.impact).toEqual({ c1: -0.1 });
    expect(t.deckImpact).toEqual({ [B]: { c1: 0.1 } });
    expect(t.minPooled).toBe(IMPACT_MIN_POOLED_GAMES);
    expect(t.minDeck).toBe(IMPACT_MIN_DECK_GAMES);
    expect(t.kept).toEqual([{ simVersion: 5, bot: 'deep' }]);
    expect(t.pooled).toMatchObject({ cards: 2, usable: 1, drawnGames: 119 });
    expect(impactTablesWords(t)).toEqual([
      'Card impact read for simulator version 9, hard bot: 2 cards over 119 drawn-games (1 drawn in 60+ games), and per-list numbers for 1 list; from season 3. Kept, not read: 1 entry of another simulator version or bot (simulator version 5, deep bot).',
    ]);
    // the files are not changed by reading
    const f = cardFile();
    readImpactTables({ cardFile: f, deckFile: deckFile(), analysis: analysis(9, 'hard'), key: { simVersion: 9, bot: 'hard' } });
    expect(f).toEqual(cardFile());
  });

  it('the exact pair is said to be read exactly', () => {
    const t = readImpactTables({ cardFile: cardFile(), deckFile: deckFile(), key: { simVersion: 9, bot: 'hard' } });
    expect([t.match, t.wanted, t.read]).toEqual(['exact', { simVersion: 9, bot: 'hard' }, { simVersion: 9, bot: 'hard' }]);
  });

  it('with no numbers for the pair, the same simulator version with another bot comes first, with a warning', () => {
    const t = readImpactTables({ cardFile: cardFile(), deckFile: deckFile(), key: { simVersion: 9, bot: 'lookahead' } });
    expect([t.match, t.wanted, t.read]).toEqual(['other-bot', { simVersion: 9, bot: 'medium' }, { simVersion: 9, bot: 'hard' }]);
    // that pair's own numbers, the per-list table with them
    expect(t.impact).toEqual({ c1: -0.1 });
    expect(t.deckImpact).toEqual({ [B]: { c1: 0.1 } });
    expect(t.kept).toEqual([{ simVersion: 5, bot: 'deep' }]);
    expect(impactTablesWords(t)).toEqual([
      'Warning: no card-impact numbers for simulator version 9, medium bot yet, so the breeder reads those of simulator version 9, hard bot instead: 2 cards over 119 drawn-games (1 drawn in 60+ games), and per-list numbers for 1 list; from season 3. Numbers measured on another bot can mislead. A season\'s round robin on simulator version 9, medium bot records current numbers, which the next season reads (docs/SYNERGIES.md, "The breeder\'s card impact"). Kept, not read: 1 entry of another simulator version or bot (simulator version 5, deep bot).',
    ]);
    // the same version with another bot beats a higher version with the wanted bot
    const f = cardFile();
    f.entries.push({ simVersion: 12, bot: 'medium', sources: [{ kind: 'season', season: 9 }], cards: { c1: { s: 70, n: 70 } } });
    expect(readImpactTables({ cardFile: f, deckFile: deckFile(), key: { simVersion: 9, bot: 'medium' } }).read).toEqual({ simVersion: 9, bot: 'hard' });
  });

  it('else the highest other simulator version, with a warning; within it the season’s bot, then the most drawn-games', () => {
    const t = readImpactTables({ cardFile: cardFile(), deckFile: deckFile(), key: { simVersion: 10, bot: 'hard' } });
    expect([t.match, t.read]).toEqual(['other-version', { simVersion: 9, bot: 'hard' }]);
    expect(t.impact).toEqual({ c1: -0.1 });
    expect(impactTablesWords(t)[0]).toMatch(/^Warning: no card-impact numbers for simulator version 10, hard bot yet, so the breeder reads those of simulator version 9, hard bot instead: .* Numbers measured on another simulator version can mislead\. A season's round robin on simulator version 10, hard bot records current numbers/);
    const entry = (simVersion: number, bot: string, n: number, season: number) => ({ simVersion, bot, sources: [{ kind: 'season' as const, season }], cards: { c1: { s: n / 10, n } } });
    const pick = (entries: ReturnType<typeof entry>[], key = { simVersion: 10, bot: 'hard' }) => readImpactTables({ cardFile: { ...emptyCardImpact(), entries }, deckFile: emptyDeckImpact(), key }).read;
    // the highest version, though an older one holds more games
    expect(pick([entry(8, 'hard', 9000, 1), entry(9, 'easy', 100, 2)])).toEqual({ simVersion: 9, bot: 'easy' });
    // within it the season's bot, though another holds more games
    expect(pick([entry(9, 'medium', 9000, 1), entry(9, 'hard', 100, 2)])).toEqual({ simVersion: 9, bot: 'hard' });
    // else the most drawn-games
    expect(pick([entry(9, 'medium', 100, 1), entry(9, 'easy', 200, 2)])).toEqual({ simVersion: 9, bot: 'easy' });
    // a version above the current one counts as another version too
    expect(pick([entry(11, 'hard', 100, 1), entry(9, 'hard', 200, 2)])).toEqual({ simVersion: 11, bot: 'hard' });
  });

  it('choosePair breaks ties by per-list games, then by the bot’s name, never by file order', () => {
    const c = (bot: string, drawnGames: number, listGames: number) => ({ key: { simVersion: 9, bot }, drawnGames, listGames });
    expect(choosePair({ simVersion: 10, bot: 'hard' }, [c('medium', 100, 5), c('easy', 100, 9)])).toEqual({ key: { simVersion: 9, bot: 'easy' }, match: 'other-version' });
    expect(choosePair({ simVersion: 10, bot: 'hard' }, [c('medium', 100, 5), c('easy', 100, 5)])).toEqual({ key: { simVersion: 9, bot: 'easy' }, match: 'other-version' });
    expect(choosePair({ simVersion: 10, bot: 'hard' }, [c('easy', 100, 5), c('medium', 100, 5)])).toEqual({ key: { simVersion: 9, bot: 'easy' }, match: 'other-version' });
    // a pair with no games is no candidate, even the wanted one
    expect(choosePair({ simVersion: 9, bot: 'hard' }, [c('hard', 0, 0), c('medium', 1, 0)])).toEqual({ key: { simVersion: 9, bot: 'medium' }, match: 'other-bot' });
    expect(choosePair({ simVersion: 9, bot: 'hard' }, [c('hard', 0, 0)])).toBeNull();
  });

  it('with no numbers anywhere the breeder gets empty tables and a warning', () => {
    const none = readImpactTables({ cardFile: emptyCardImpact(), deckFile: emptyDeckImpact(), key: { simVersion: 9, bot: 'hard' } });
    expect([none.match, none.read, none.impact, none.deckImpact]).toEqual(['none', null, {}, {}]);
    expect(tablesEmpty(none)).toBe(true);
    expect(impactTablesWords(none)).toEqual([
      'Warning: no card-impact numbers for simulator version 9, hard bot or any other simulator version or bot, so the breeder ranks cards by their card value alone, which bred clearly weaker lists when it was measured. A season\'s round robin on simulator version 9, hard bot records current numbers, which the next season reads (docs/SYNERGIES.md, "The breeder\'s card impact"). No entries of another simulator version or bot.',
    ]);
    // an entry with no games is no numbers either
    const hollow = { ...emptyCardImpact(), entries: [{ simVersion: 9, bot: 'hard', sources: [], cards: {} }] };
    expect(readImpactTables({ cardFile: hollow, deckFile: emptyDeckImpact(), key: { simVersion: 9, bot: 'hard' } }).match).toBe('none');
  });

  it('never sums two pairs: whatever is read is one pair’s own numbers', () => {
    // every pair holds c1 with its own mean (simulator version × 0.01 + a bot term), so a sum of two would show
    const bots = ['easy', 'medium', 'hard', 'deep'];
    const mean = (v: number, b: string) => v / 100 + bots.indexOf(b) / 1000;
    const entries = [5, 9].flatMap((v) => bots.map((b, i) => ({ simVersion: v, bot: b, sources: [{ kind: 'season' as const, season: v * 10 + i }], cards: { c1: { s: mean(v, b) * 100, n: 100 } } })));
    const lists = entries.map((e) => ({ simVersion: e.simVersion, bot: e.bot, sources: e.sources, lists: { [A]: { name: 'A', cards: { c1: { s: e.cards.c1.s, n: 100 } } } } }));
    const an = { manifest: { simVersion: 9, bot: { level: 'deep' }, runId: 'an' }, decks: [{ deck: 'A', id: A, cards: [stat('c1', mean(9, 'deep'), 100)] }] };
    for (const v of [5, 7, 9, 10])
      for (const b of [...bots, 'random']) {
        const t = readImpactTables({ cardFile: { ...emptyCardImpact(), entries }, deckFile: { ...emptyDeckImpact(), entries: lists }, analysis: an, key: { simVersion: v, bot: b } });
        const r = t.read!;
        expect(t.impact.c1, `${v} ${b}`).toBeCloseTo(mean(r.simVersion, r.bot), 12);
        expect(t.deckImpact[A]!.c1, `${v} ${b}`).toBeCloseTo(mean(r.simVersion, r.bot), 12);
        // the review telemetry joins only its own pair (9, deep), whose drawn-games it then doubles
        expect(t.pooled.drawnGames).toBe(r.simVersion === 9 && r.bot === 'deep' ? 200 : 100);
        expect(t.kept).toHaveLength(entries.length - 1);
      }
  });

  it('the review telemetry is a pair of its own when nothing else is there, and adds to a season entry of its pair', () => {
    const an = { manifest: { simVersion: 9, bot: { level: 'deep' }, runId: 'an' }, decks: [{ deck: 'A', id: A, cards: [stat('c1', 0.2, 100)] }] };
    const alone = readImpactTables({ cardFile: emptyCardImpact(), deckFile: emptyDeckImpact(), analysis: an, key: { simVersion: 9, bot: 'hard' } });
    expect([alone.match, alone.read, alone.analysis]).toEqual(['other-bot', { simVersion: 9, bot: 'deep' }, { state: 'added', runId: 'an' }]);
    expect(alone.impact).toEqual({ c1: 0.2 });
    expect(impactTablesWords(alone)[0]).toContain('instead: 1 card over 100 drawn-games (1 drawn in 60+ games), and per-list numbers for 1 list; from src/data/analysis.json (an).');
    const withSeason = readImpactTables({
      cardFile: { ...emptyCardImpact(), entries: [{ simVersion: 9, bot: 'deep', sources: [{ kind: 'season', season: 3 }], cards: { c1: { s: 0, n: 100 } } }] },
      deckFile: emptyDeckImpact(),
      analysis: an,
      key: { simVersion: 9, bot: 'hard' },
    });
    expect(withSeason.impact).toEqual({ c1: 0.1 });
    expect(withSeason.pooled.drawnGames).toBe(200);
  });

  it('adds the review telemetry only when its manifest names the same simulator version and bot', () => {
    const same = readImpactTables({ cardFile: cardFile(), deckFile: deckFile(), analysis: analysis(9, 'hard'), key: { simVersion: 9, bot: 'hard' } });
    expect(same.analysis).toEqual({ state: 'added', runId: 'an' });
    expect(same.impact).toEqual({ c1: -0.1, c2: (5.9 + 1) / 60, c3: 0.5 });
    expect(same.deckImpact[A]).toEqual({ c3: 0.5 });
    expect(impactTablesWords(same)[0]).toContain('from season 3, src/data/analysis.json (an)');
    const other = readImpactTables({ cardFile: cardFile(), deckFile: deckFile(), analysis: analysis(9, 'deep'), key: { simVersion: 9, bot: 'hard' } });
    expect(other.analysis).toEqual({ state: 'other', key: { simVersion: 9, bot: 'deep' } });
    expect(other.impact).toEqual({ c1: -0.1 });
    expect(impactTablesWords(other)[1]).toBe('src/data/analysis.json is not added: it was measured on simulator version 9, deep bot.');
    const unlabelled = readImpactTables({ cardFile: cardFile(), deckFile: deckFile(), analysis: { decks: analysis(9, 'hard').decks }, key: { simVersion: 9, bot: 'hard' } });
    expect(unlabelled.analysis).toEqual({ state: 'other', key: null });
    expect(unlabelled.impact).toEqual({ c1: -0.1 });
  });

  it('the season, its --gate-only run and the preview use the one reader, and the committed files give the table it prints', () => {
    for (const f of ['scripts/season.ts', 'scripts/breed-preview.ts', 'scripts/theorize-ladder.ts']) {
      const text = fs.readFileSync(f, 'utf8');
      expect(text, f).toMatch(/loadImpactTables\(/);
      // nobody reads the files or the analysis numbers on the side
      expect(text, f).not.toMatch(/seasons\/impact\.json'|deck-impact\.json'|analysis\.json'|v\.n >= \d/);
    }
    expect(fs.readFileSync('scripts/season.ts', 'utf8')).toMatch(/bot: oneOf\(SIM_BOTS, SEASON_BOT\)/);
    expect(fs.readFileSync('scripts/breed-preview.ts', 'utf8')).toMatch(/bot: oneOf\(SIM_BOTS, SEASON_BOT\)/);
    expect(SEASON_BOT).toBe('hard');
    const t = loadImpactTables();
    expect(t.wanted).toEqual({ simVersion: SIM_VERSION, bot: 'hard' });
    expect(t.match).toBe('exact');
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/breed-preview.ts'], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    for (const l of impactTablesWords(t)) expect(r.stdout).toContain(`  ${l}`);
  }, 120_000);
});

describe('the split of 2026-11-16', () => {
  const beforeCard = { c1: { s: 3, n: 30 }, c2: { s: -84.82288973953976, n: 50 } };
  const nowCard = { c1: { s: 3.5, n: 40 }, c2: { s: -9.325442946801726, n: 80 }, c3: { s: 1, n: 5 } };
  const beforeDeck = { ...emptyDeckImpactV1(), lists: { [A]: { name: 'A', cards: { c1: { s: 3, n: 30 } }, keyedFrom: 'name' as const } } };
  const nowDeck = { ...emptyDeckImpactV1(), lists: { [A]: { name: 'A', cards: { c1: { s: 3.5, n: 40 } }, keyedFrom: 'name' as const }, [B]: { name: 'B', cards: { c3: { s: 1, n: 5 } } } } };
  const earlier = { key: { simVersion: 5, bot: 'deep' }, sources: [{ kind: 'season' as const, season: 1 }], pooledOnly: [{ kind: 'analysis' as const, runId: 'base' }] };
  const later = { key: { simVersion: 9, bot: 'hard' }, sources: [{ kind: 'season' as const, season: 3 }] };

  it('the earlier entry is the before file, the later the difference, and the two add up exactly where a float can', () => {
    const input = { beforeCard, nowCard, beforeDeck, nowDeck };
    const r = splitImpactFiles({ ...input, earlier, later });
    expect(r.problems).toEqual([]);
    expect(r.card.entries[0]).toEqual({ simVersion: 5, bot: 'deep', sources: [{ kind: 'analysis', runId: 'base' }, { kind: 'season', season: 1 }], cards: beforeCard });
    expect(r.card.entries[1]!.cards).toEqual({ c1: { s: 0.5, n: 10 }, c2: { s: r.card.entries[1]!.cards.c2!.s, n: 30 }, c3: { s: 1, n: 5 } });
    // the per-list file never stored the review telemetry: its sources are the seasons only
    expect(r.deck.entries.map((e) => e.sources)).toEqual([[{ kind: 'season', season: 1 }], [{ kind: 'season', season: 3 }]]);
    expect(r.deck.entries[1]!.lists).toEqual({ [A]: { name: 'A', cards: { c1: { s: 0.5, n: 10 } } }, [B]: { name: 'B', cards: { c3: { s: 1, n: 5 } } } });
    expect(r.deck.entries[0]!.lists).toBe(beforeDeck.lists);
    const c = checkSplit(r, input);
    expect(c.problems).toEqual([]);
    // c2's total is much smaller than its parts: no float makes the sum exact, and it is one rounding step off
    expect(c.rounded.map((x) => x.what)).toEqual(['impact.json card c2']);
    expect(Math.abs(c.rounded[0]!.off)).toBeLessThan(1e-14);
    expect(parseCardImpact(json(r.card)).file).toBeTruthy();
    expect(parseDeckImpact(json(r.deck)).file).toBeTruthy();
  });

  it('refuses a card that lost games, and a check catches an entry that does not add up', () => {
    const bad = splitImpactFiles({ beforeCard, nowCard: { ...nowCard, c1: { s: 3, n: 20 } }, beforeDeck, nowDeck, earlier, later });
    expect(bad.problems.some((p) => /fewer drawn-games/.test(p))).toBe(true);
    const input = { beforeCard, nowCard, beforeDeck, nowDeck };
    const r = splitImpactFiles({ ...input, earlier, later });
    r.card.entries[1]!.cards.c1 = { s: 0.6, n: 10 };
    const p = checkSplit(r, input).problems;
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/^impact\.json card c1: the sums do not add up to the later file \(off by 0\.1/);
  });

  it('exactDifference finds the float that sums exactly, when there is one', () => {
    expect(exactDifference(0.3, 0.1)).not.toBeNull();
    expect(0.1 + exactDifference(0.3, 0.1)!).toBe(0.3);
    expect(exactDifference(-9.325442946801726, -84.82288973953976)).toBeNull();
    expect(addsUpTo(0.1, 0.2, 0.3)).toMatchObject({ exact: false, withinRounding: true });
  });

  it('the committed files: Season 3 in the entry of simulator version 9 and Hard, the earlier games in version 5 and deep', () => {
    const card = parseCardImpact(JSON.parse(fs.readFileSync('data/seasons/impact.json', 'utf8'))).file!;
    const deck = parseDeckImpact(JSON.parse(fs.readFileSync('data/seasons/deck-impact.json', 'utf8'))).file!;
    // the (9, hard) entry also takes the rating series' traced runs and the Hard telemetry since 2026-11-24 (src/lib/seriesImpact.ts):
    // the seasons are pinned, and the season-3 figures exactly while nothing else is in that entry
    const seasonsOf = (e: { simVersion: number; bot: string; sources: { kind: string; season?: number }[] }) => [e.simVersion, e.bot, e.sources.filter((s) => s.kind !== 'series' && !(e.simVersion === 9 && s.kind === 'analysis')).map((s) => s.season ?? s.kind)];
    expect(card.entries.map(seasonsOf)).toEqual([
      [5, 'deep', ['analysis', 1, 2]],
      [9, 'hard', [3]],
    ]);
    expect(deck.entries.map(seasonsOf)).toEqual([
      [5, 'deep', [1, 2]],
      [9, 'hard', [3]],
    ]);
    const n = (cards: Record<string, { n: number }>) => Object.values(cards).reduce((k, v) => k + v.n, 0);
    expect([Object.keys(card.entries[0]!.cards).length, n(card.entries[0]!.cards)]).toEqual([90, 277_376]);
    expect(Object.keys(deck.entries[0]!.lists).length).toBe(28);
    const hard = card.entries[1]!;
    if (hard.sources.length === 1) {
      expect([Object.keys(hard.cards).length, n(hard.cards)]).toEqual([77, 109_287]);
      expect(Object.keys(deck.entries[1]!.lists).length).toBe(21);
    } else {
      expect(n(hard.cards)).toBeGreaterThan(109_287);
      expect(Object.keys(deck.entries[1]!.lists).length).toBeGreaterThanOrEqual(21);
    }
  });
});

describe('check:data', () => {
  const base = { index: { events: [] }, events: [], h2h: null };
  it('fails the old shapes, naming the migration, and passes the committed files', () => {
    expect(checkData({ ...base, deckImpact: OLD }).failures).toContain(`data/seasons/deck-impact.json ${LEGACY_DECK_IMPACT}`);
    expect(checkData({ ...base, cardImpact: { c1: { s: 1, n: 2 } } }).failures).toContain(`data/seasons/impact.json ${LEGACY_CARD_IMPACT}`);
    expect(checkData({ ...base, deckImpact: { ...emptyDeckImpactV1() } }).failures).toContain(`data/seasons/deck-impact.json ${V1_DECK_IMPACT}`);
    const cardImpact = JSON.parse(fs.readFileSync('data/seasons/impact.json', 'utf8'));
    const deckImpact = JSON.parse(fs.readFileSync('data/seasons/deck-impact.json', 'utf8'));
    const seasons = [1, 2, 3].map((s) => ({ season: s, key: s < 3 ? { simVersion: 5, bot: 'deep' } : { simVersion: 9, bot: 'hard' } }));
    // the recorded rating runs: a table counts the traced ones (src/lib/seriesImpact.ts), and check:data reads them beside it
    const runs = runFiles().map((file) => ({ file, event: JSON.parse(fs.readFileSync(`${SERIES_DIR}/${file}`, 'utf8')) }));
    const r = checkData({ ...base, cardImpact, deckImpact, seasons, runs });
    expect(r.failures.filter((x) => x.includes('impact'))).toEqual([]);
    expect(r.passed.some((x) => x.startsWith('data/seasons/deck-impact.json is keyed by list fingerprint and kept by simulator version and bot'))).toBe(true);
    expect(r.passed.some((x) => x.startsWith('data/seasons/impact.json is kept by simulator version and bot (2 entries'))).toBe(true);
    // a season counted under another pair than its manifest names fails
    const wrong = checkData({ ...base, cardImpact, deckImpact, seasons: [{ season: 3, key: { simVersion: 9, bot: 'medium' } }] });
    expect(wrong.failures).toContain('data/seasons impact files: season 3 was played on simulator version 9, medium bot (its manifest) but is counted under simulator version 9, hard bot');
  });

  it('fails a season counted in one file and not the other, or under two pairs', () => {
    const card = (season: number, bot: string): CardImpactFile => ({ ...emptyCardImpact(), entries: [{ simVersion: 9, bot, sources: [{ kind: 'season', season }], cards: {} }] });
    const deck = (season: number, bot: string) => ({ ...emptyDeckImpact(), entries: [{ simVersion: 9, bot, sources: [{ kind: 'season' as const, season }], lists: {} }] });
    expect(impactFilesProblems(card(3, 'hard'), deck(3, 'hard'), [])).toEqual([]);
    expect(impactFilesProblems(card(3, 'hard'), deck(4, 'hard'), [])).toEqual([
      'season 3 is counted in data/seasons/impact.json but not in deck-impact.json',
      'season 4 is counted in data/seasons/deck-impact.json but not in impact.json',
    ]);
    expect(impactFilesProblems(card(3, 'hard'), deck(3, 'medium'), [])).toEqual(['season 3 is counted under simulator version 9, hard bot in impact.json and simulator version 9, medium bot in deck-impact.json']);
  });
});
