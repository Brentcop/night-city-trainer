// scripts/tournament.ts flags for formats and hand-arranged events (scripts/tournament-setup.ts buildEvent), the
// repeatable --pair flag (lib-node many()), and how ratings and head-to-heads pool custom events (scripts/event-pool.ts,
// scripts/build-h2h.ts).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ArgError, many, parseArgs, str } from '../scripts/lib-node';
import { buildEvent, parsePair, type SetupFlags } from '../scripts/tournament-setup';
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
