// scripts/tournament.ts flags for formats and hand-arranged events (scripts/tournament-setup.ts buildEvent), the
// repeatable --pair flag (lib-node many()), and how ratings and head-to-heads pool custom events (scripts/event-pool.ts,
// scripts/build-h2h.ts).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ArgError, loadLibrary, many, parseArgs, str } from '../scripts/lib-node';
import { buildEvent, FIELD_KEYS, fieldPool, parsePair, pickField, type SetupFlags } from '../scripts/tournament-setup';
import { distinctLists, leftOutLine } from '../src/lib/distinctLists';
import { poolEvents, type PoolEvent } from '../scripts/event-pool';
import { buildH2H } from '../scripts/build-h2h';
import type { LibraryDeck } from '../src/lib/library';
import { runTournament, type GameJob, type GameRec } from '../src/lib/tournament';

const lib: LibraryDeck[] = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map((name, i) => ({
  file: `${name.toLowerCase()}.txt`,
  deck: { name, legends: [`l${i}`], main: [`c${i}`], sideboard: [] },
  kind: 'meta',
  prov: {},
}));
const resolve = (ref: string) => {
  const d = lib.find((x) => x.file === ref || x.file === `${ref}.txt` || x.deck.name === ref);
  if (!d) throw new Error(`No deck matches "${ref}"`);
  return d;
};
const flags = (o: Partial<SetupFlags> = {}): SetupFlags => ({ bo: 3, rounds: 'auto', top: 8, pair: [], times: 1, mirror: false, groups: 1, advance: 0, game1: 'coin', next: 'loser', ...o });
const build = (o: Partial<SetupFlags> = {}) => buildEvent(flags(o), () => lib, resolve);

describe('tournament CLI flags', () => {
  it('a plain run records no setup (events stay exactly as before)', () => {
    const b = build();
    expect(b.setup).toBeUndefined();
    expect(b.decks.map((d) => d.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
    expect(b.rounds).toBe(4);
  });
  it('--pair sets Swiss round-1 pairings by file or name', () => {
    const b = build({ pair: ['alpha vs Echo', 'bravo.txt VS charlie'] });
    expect(b.setup?.pairings).toEqual({
      1: [
        { a: 'Alpha', b: 'Echo' },
        { a: 'Bravo', b: 'Charlie' },
      ],
    });
    expect(parsePair('A v. B')).toEqual(['A', 'B']);
    expect(() => parsePair('A and B')).toThrow(ArgError);
    expect(() => build({ pair: ['alpha vs alpha'] })).toThrow(/itself/);
    expect(() => build({ pair: ['alpha vs bravo', 'alpha vs charlie'] })).toThrow(/twice/);
    expect(() => build({ pair: ['alpha vs zulu'] })).toThrow(ArgError);
  });
  it('--entrants is an ordered list; a deck listed twice is entered twice', () => {
    const b = build({ entrants: 'echo,alpha,echo', format: 'round-robin' });
    expect(b.decks.map((d) => d.name)).toEqual(['Echo', 'Alpha', 'Echo #2']);
    expect(b.setup?.entrants).toEqual([
      { name: 'Echo', file: 'echo.txt' },
      { name: 'Alpha', file: 'alpha.txt' },
      { name: 'Echo #2', file: 'echo.txt', copyOf: 'Echo' },
    ]);
  });
  it('--matches builds a match list (format inferred) from its decks', () => {
    const b = build({ matches: [{ a: 'alpha', b: 'bravo', bestOf: 5, times: 2, mirror: true }, { a: 'charlie', b: 'charlie #2', round: 2 }] });
    expect(b.setup?.format).toBe('matches');
    expect(b.decks.map((d) => d.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Charlie #2']);
    expect(b.setup?.matches).toEqual([
      { a: 'Alpha', b: 'Bravo', bestOf: 5, times: 2, mirror: true },
      { a: 'Charlie', b: 'Charlie #2', round: 2 },
    ]);
    expect(() => build({ matches: { nope: 1 } })).toThrow(/JSON list/);
    expect(() => build({ matches: [{ a: 'alpha' }] })).toThrow(/needs "a" and "b"/);
    expect(() => build({ matches: [{ a: 'alpha', b: 'bravo', bestOf: 4 }] })).toThrow(/1, 3 or 5/);
  });
  it('--bracket places slots, --bracket-bo sets best-of per round', () => {
    const b = build({ bracket: ['alpha', null, 'bravo', 'charlie'], bracketBo: '3,5' });
    expect(b.setup).toMatchObject({ format: 'single-elim', bracket: ['Alpha', null, 'Bravo', 'Charlie'], bracketBestOf: [3, 5] });
    expect(() => build({ bracket: ['alpha', 'bravo', 'charlie'] })).toThrow(/power-of-two/);
    expect(() => build({ bracket: [null, null, 'alpha', 'bravo'] })).toThrow(/two byes/);
    expect(() => build({ bracketBo: '3,4' })).toThrow(/1, 3 or 5/);
  });
  it('round robin, groups, first-player rules and manual top-cut seeds', () => {
    expect(build({ format: 'round-robin', times: 2, mirror: true, groups: 2, advance: 1 }).setup).toMatchObject({ format: 'round-robin', times: 2, mirror: true, groups: 2, advance: 1 });
    expect(build({ game1: 'b', next: 'alternate' }).setup).toMatchObject({ format: 'swiss', game1: 'b', next: 'alternate' });
    expect(build({ top: 4, cutSeeds: 'echo,delta,charlie,bravo' }).setup?.cutSeeds).toEqual(['Echo', 'Delta', 'Charlie', 'Bravo']);
  });
  it('refuses flags that do not fit the format', () => {
    expect(() => build({ format: 'round-robin', pair: ['alpha vs bravo'] })).toThrow(/--pair/);
    expect(() => build({ format: 'matches' })).toThrow(/needs --matches/);
    expect(() => build({ format: 'swiss', matches: [] })).toThrow(/--matches needs --format matches/);
    expect(() => build({ groups: 2 })).toThrow(/--groups/);
    expect(() => build({ times: 2 })).toThrow(/--times/);
    expect(() => build({ format: 'round-robin', cutSeeds: 'alpha,bravo' })).toThrow(/--cut-seeds/);
  });
  it('--pair is repeatable', () => {
    const spec = { pair: many(), out: str() };
    expect(parseArgs(spec, ['--pair', 'A vs B', '--pair=C vs D']).values.pair).toEqual(['A vs B', 'C vs D']);
    expect(parseArgs(spec, []).values.pair).toEqual([]);
  });
});

describe('one entry per list (--field, --entrants, --allow-same-lists)', () => {
  // Alpha's list under another name: a planted same-list deck (no deck file is added to the repository)
  const fox: LibraryDeck = { file: 'foxtrot.txt', deck: { name: 'Foxtrot', legends: ['l0'], main: ['c0'], sideboard: ['s9'] }, kind: 'meta', prov: {} };
  const lib2 = [...lib, fox];
  const resolve2 = (ref: string) => lib2.find((x) => x.file === ref || x.file === `${ref}.txt` || x.deck.name === ref) ?? resolve(ref);
  const build2 = (o: Partial<SetupFlags> = {}) => buildEvent(flags(o), () => lib2, resolve2);
  it('an automatic field leaves out a deck whose list is already in it, and says which', () => {
    const b = build2();
    expect(b.decks.map((d) => d.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
    expect(b.setup).toBeUndefined();
    expect(b.sameList.map((s) => [s.deck.deck.name, s.sameAs.deck.name])).toEqual([['Foxtrot', 'Alpha']]);
    expect(leftOutLine(b.sameList)).toBe('Left out one deck whose list is already in the field: Foxtrot (same list as Alpha).');
    // the same for every format with an automatic field
    expect(build2({ format: 'round-robin' }).decks.map((d) => d.name)).not.toContain('Foxtrot');
    expect(build2({ format: 'single-elim' }).sameList).toHaveLength(1);
  });
  it('--allow-same-lists enters it too', () => {
    const b = build2({ allowSameLists: true });
    expect(b.decks.map((d) => d.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot']);
    expect(b.sameList).toEqual([]);
  });
  it('--entrants: one deck named twice is an explicit copy; two decks with one list are refused, unless allowed', () => {
    const copy = build2({ entrants: 'alpha,bravo,alpha' });
    expect(copy.decks.map((d) => d.name)).toEqual(['Alpha', 'Bravo', 'Alpha #2']);
    expect(copy.setup?.entrants[2]).toEqual({ name: 'Alpha #2', file: 'alpha.txt', copyOf: 'Alpha' });
    expect(() => build2({ entrants: 'alpha,bravo,foxtrot' })).toThrow(ArgError);
    expect(() => build2({ entrants: 'alpha,bravo,foxtrot' })).toThrow('"Alpha" and "Foxtrot" are the same list (the same Legends and main deck under two names), and a field holds each list once. To enter that list twice on purpose, name one of them twice (it plays as "Alpha #2"), or pass --allow-same-lists.');
    expect(build2({ entrants: 'alpha,bravo,foxtrot', allowSameLists: true }).decks.map((d) => d.name)).toEqual(['Alpha', 'Bravo', 'Foxtrot']);
    // a match list and a bracket name their decks by hand too
    expect(() => build2({ matches: [{ a: 'alpha', b: 'foxtrot' }] })).toThrow(/same list/);
    expect(() => build2({ bracket: ['alpha', 'foxtrot'] })).toThrow(/same list/);
    expect(build2({ matches: [{ a: 'alpha', b: 'alpha #2' }] }).decks.map((d) => d.name)).toEqual(['Alpha', 'Alpha #2']);
  });
  it('--field top16 reads down the ratings until it has 16 different lists', () => {
    const many: LibraryDeck[] = Array.from({ length: 18 }, (_, i) => ({ file: `d${i}.txt`, deck: { name: `D${i}`, legends: [`L${i}`], main: ['m'], sideboard: [] }, kind: 'guide', prov: {} }));
    many[3] = { ...many[3]!, deck: { ...many[3]!.deck, legends: ['L0'] } }; // D3 is D0's list
    const rated = many.map((d) => ({ name: d.deck.name }));
    const find = (x: string) => many.find((d) => d.file === x)!;
    const picked = pickField('top16', many, find, rated);
    expect(picked).toHaveLength(17);
    const b = buildEvent(flags(), () => picked, find);
    expect(b.decks).toHaveLength(16);
    expect(b.sameList.map((s) => s.deck.deck.name)).toEqual(['D3']);
    expect(pickField('top16', many, find, rated, { allowSameLists: true }).map((d) => d.deck.name)).toEqual(many.slice(0, 16).map((d) => d.deck.name));
  });
  it('with the library as it is, every automatic field is the one the runs before the rule played', () => {
    const LIB = loadLibrary();
    expect(LIB.length).toBeGreaterThan(40);
    // the field rule before this change (scripts/tournament.ts distinct(), kept here as the reference)
    const before = (() => {
      const seen = new Set<string>();
      return LIB.filter((d) => {
        if (/-eor\.txt$/.test(d.file)) return false;
        const sig = [...d.deck.legends].sort().join(',') + '|' + [...d.deck.main].sort().join(',');
        if (seen.has(sig) || seen.has(`n:${d.deck.name}`)) return false;
        seen.add(sig);
        seen.add(`n:${d.deck.name}`);
        return true;
      });
    })();
    const rated: { name: string }[] = JSON.parse(fs.readFileSync('src/data/ratings.json', 'utf8')).decks;
    const oldPick = (field: string) =>
      field === 'all'
        ? before
        : field === 'top16'
          ? rated.map((r) => before.find((d) => d.deck.name === r.name)).filter((d): d is LibraryDeck => !!d).slice(0, 16)
          : before.filter((d) => d.kind === field);
    const pool = fieldPool(LIB);
    const find = (x: string) => pool.find((d) => d.file === x || d.file === `${x}.txt` || d.deck.name === x)!;
    for (const field of FIELD_KEYS) {
      const b = buildEvent(flags(), () => pickField(field, pool, find, rated), find);
      expect(b.sameList, field).toEqual([]);
      expect(b.decks.map((d) => d.file), field).toEqual(oldPick(field).map((d) => d.file));
    }
    // no two decks in the library share a list today
    expect(distinctLists(LIB).left).toEqual([]);
  });
});

describe('ratings and head-to-heads from custom events', () => {
  const g = (first: 0 | 1, winner: 0 | 1 | 'tie') => ({ first, winner });
  const standard: PoolEvent = {
    champion: 'A',
    standings: [
      { deck: 'A', mw: 2, ml: 0, gw: 4, gl: 1 },
      { deck: 'B', mw: 0, ml: 2, gw: 1, gl: 4 },
    ],
    rounds: [{ matches: [{ a: 'A', b: 'B', games: [g(0, 0), g(1, 0)] }] }],
    bracket: [],
  };
  const custom: PoolEvent = {
    champion: 'B',
    custom: true,
    setup: { entrants: [{ name: 'A' }, { name: 'B' }, { name: 'B #2', copyOf: 'B' }] },
    standings: [
      { deck: 'B', mw: 3, ml: 0, gw: 6, gl: 0 },
      { deck: 'A', mw: 0, ml: 3, gw: 0, gl: 6 },
    ],
    rounds: [{ matches: [{ a: 'B #2', b: 'A', games: [g(0, 0), g(1, 'tie')] }, { a: 'B', b: 'B #2', games: [g(0, 1)] }] }],
    bracket: [],
  };
  it('games from every event count (copies as their deck, mirrors left out); titles and finishes only from standard events', () => {
    const { games, results, customEvents } = poolEvents([standard, custom]);
    expect(customEvents).toBe(1);
    expect(games).toEqual([
      { a: 'A', b: 'B', first: 0, s: 1 },
      { a: 'A', b: 'B', first: 1, s: 1 },
      { a: 'B', b: 'A', first: 0, s: 1 },
      { a: 'B', b: 'A', first: 1, s: 0.5 },
    ]);
    expect(results.A).toMatchObject({ events: 1, titles: 1, top8: 1, mw: 2, ml: 0 });
    expect(results.B).toMatchObject({ events: 1, titles: 0, mw: 0, ml: 2 });
  });
  it('the head-to-head file counts every game, pairs copies with their deck and skips mirror pairs', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-h2h-'));
    try {
      const fake = async (j: GameJob): Promise<GameRec> => ({ seed: j.seed, first: j.first, winner: j.a.name < j.b.name ? 0 : 1, turns: 8, reason: 'test' });
      const d = (name: string) => ({ name, legends: ['l'], main: [name.replace(/ #\d$/, '')], sideboard: [] });
      const ev = await runTournament([d('A'), d('B'), d('B #2')], { name: 'x', rounds: 0, top: 0, bestOf: 1, bot: 'hard', seed: 3 }, fake, {
        id: 7,
        setup: { format: 'round-robin', entrants: [{ name: 'A' }, { name: 'B' }, { name: 'B #2', copyOf: 'B' }], bestOf: 1 },
      });
      fs.writeFileSync(path.join(dir, 'event-7.json'), JSON.stringify(ev));
      const out = buildH2H(dir, path.join(dir, 'h2h.json'))!;
      expect(out.games).toBe(3);
      expect(out.decks.sort()).toEqual(['A', 'B']);
      expect(out.pairs).toHaveLength(1);
      expect(out.pairs[0]![3]).toBe(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
