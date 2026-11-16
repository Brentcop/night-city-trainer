// A deck entered more than once in an event ("X" and "X #2"): the one resolver the event views use (src/lib/entrants.ts
// `entrantDeckName`, src/ui/deckLookup.ts `eventLib`), its narrow fallback for an event read without its setup, the
// "By deck" summary (src/lib/eventByDeck.ts), and a copy's finish on the deck page (src/lib/deckRecord.ts).
import { describe, expect, it } from 'vitest';
import { copyName, copyNumber, copyWords, entrantBase, entrantDeckName } from '../src/lib/entrants';
import { copyName as copyNameFromFormats, entrantBase as entrantBaseFromFormats } from '../src/lib/eventFormats';
import { byName, eventLib } from '../src/ui/deckLookup';
import type { LibraryDeck } from '../src/lib/library';
import { byDeck, recordText } from '../src/lib/eventByDeck';
import { deckRecord, eventFinishes, type EventLite } from '../src/lib/deckRecord';

const deck = (name: string, file = `${name.toLowerCase().replace(/\W+/g, '-')}.txt`): LibraryDeck =>
  ({ file, kind: 'meta', deck: { name, legends: [], main: [], sideboard: [] } }) as unknown as LibraryDeck;

describe('entrantDeckName: the deck an entrant plays', () => {
  const names = new Set(['Alpha', 'Bravo', 'Echo #2']);
  const isDeck = (n: string) => names.has(n);

  it('reads the setup when it lists the entrant, and never guesses past it', () => {
    const setup = { entrants: [{ name: 'Alpha' }, { name: 'Alpha #2', copyOf: 'Alpha' }, { name: 'Bravo #3' }] };
    expect(entrantDeckName(setup, 'Alpha #2', isDeck)).toBe('Alpha');
    expect(entrantDeckName(setup, 'Alpha', isDeck)).toBe('Alpha');
    // listed without copyOf: it is its own entrant, even though its name looks like a copy
    expect(entrantDeckName(setup, 'Bravo #3', isDeck)).toBe('Bravo #3');
    // the data side's rule agrees wherever the setup speaks
    expect(entrantBase(setup, 'Alpha #2')).toBe('Alpha');
    expect(entrantBase(setup, 'Bravo #3')).toBe('Bravo #3');
  });

  it('without a setup: only "X #k" (k ≥ 2) that is not a deck, with X a deck', () => {
    expect(entrantDeckName(undefined, 'Alpha #2', isDeck)).toBe('Alpha');
    expect(entrantDeckName(null, 'Alpha #16', isDeck)).toBe('Alpha');
    expect(entrantDeckName({}, 'Alpha #2', isDeck)).toBe('Alpha');
    // a setup that does not list the name falls back the same way
    expect(entrantDeckName({ entrants: [{ name: 'Bravo' }] }, 'Alpha #2', isDeck)).toBe('Alpha');
    expect(entrantDeckName(null, 'Alpha #1', isDeck)).toBe('Alpha #1');
    expect(entrantDeckName(null, 'Alpha #0', isDeck)).toBe('Alpha #0');
    expect(entrantDeckName(null, 'Alpha#2', isDeck)).toBe('Alpha#2');
    expect(entrantDeckName(null, 'Alpha #2b', isDeck)).toBe('Alpha #2b');
    expect(entrantDeckName(null, 'Zulu #2', isDeck)).toBe('Zulu #2'); // Zulu is no deck
    expect(entrantDeckName(null, 'Alpha', isDeck)).toBe('Alpha');
    // the data side never falls back
    expect(entrantBase(null, 'Alpha #2')).toBe('Alpha #2');
  });

  it('a deck whose own name ends in "#2" is itself', () => {
    expect(entrantDeckName(null, 'Echo #2', (n) => n === 'Echo #2' || n === 'Echo')).toBe('Echo #2');
    // and its own copy is a copy of it
    expect(entrantDeckName(null, 'Echo #2 #2', isDeck)).toBe('Echo #2');
  });

  it('says which entry a copy is', () => {
    expect(copyNumber('Alpha #2', 'Alpha')).toBe(2);
    expect(copyNumber('Alpha', 'Alpha')).toBeNull();
    expect(copyWords('Alpha #2', 'Alpha')).toBe('second entry of Alpha');
    expect(copyWords('Alpha #3', 'Alpha')).toBe('third entry of Alpha');
    expect(copyWords('Alpha #16', 'Alpha')).toBe('sixteenth entry of Alpha');
    expect(copyWords('Second Alpha', 'Alpha')).toBe('another entry of Alpha');
    expect(copyName('Alpha', 2)).toBe('Alpha #2');
  });

  it('eventFormats re-exports the same rules', () => {
    expect(copyNameFromFormats).toBe(copyName);
    expect(entrantBaseFromFormats).toBe(entrantBase);
  });
});

describe('eventLib: the one resolver of the event views', () => {
  const builtinFoo = deck('Foo', 'meta-foo.txt');
  const customFoo = deck('Foo', 'custom:Foo');
  const bar = deck('Bar', 'meta-bar.txt');
  const names = byName([builtinFoo, bar, customFoo]);

  it('a copy plays its deck: the built-in one when a saved deck has the same name', () => {
    const lib = eventLib(names, { entrants: [{ name: 'Foo' }, { name: 'Foo #2', copyOf: 'Foo' }, { name: 'Bar' }] });
    expect(lib.deck('Foo #2')?.file).toBe('meta-foo.txt');
    expect(lib.deck('Foo')?.file).toBe('meta-foo.txt');
    expect(lib.base('Foo #2')).toBe('Foo');
    expect(lib.copyText('Foo #2')).toBe('second entry of Foo');
    expect(lib.copyText('Foo')).toBeNull();
    expect(lib.hasCopies).toBe(true);
  });

  it('without a setup: the fallback, and no copies claimed', () => {
    const lib = eventLib(names, undefined);
    expect(lib.deck('Bar #2')?.file).toBe('meta-bar.txt');
    expect(lib.deck('Nobody #2')).toBeUndefined();
    expect(lib.hasCopies).toBe(false);
  });

  it('an event without copies: every name is itself', () => {
    const lib = eventLib(names, { entrants: [{ name: 'Foo' }, { name: 'Bar' }] });
    expect(lib.base('Foo')).toBe('Foo');
    expect(lib.copyText('Bar')).toBeNull();
    expect(lib.hasCopies).toBe(false);
  });
});

describe('byDeck: the results per deck', () => {
  const base = (n: string) => n.replace(/ #\d+$/, '');
  const g = (winner: 0 | 1 | 'tie') => ({ winner });
  const ev = {
    entrants: ['A', 'A #2', 'B', 'C', 'C #2'],
    rounds: [
      {
        matches: [
          { a: 'A', b: 'A #2', winner: 'A', games: [g(0), g(1), g(0)] }, // mirror: apart
          { a: 'B', b: 'C', winner: 'C', games: [g(1), g(1)] },
          { a: 'C #2', b: null, winner: 'C #2', games: [] }, // a bye
        ],
      },
      {
        matches: [
          { a: 'A #2', b: 'B', winner: 'A #2', games: [g(0), g('tie'), g(0)] },
          { a: 'A', b: 'C', winner: 'C', games: [g(1), g(0), g(1)] },
          { a: 'C #2', b: 'B', winner: '', live: true, games: [g(0)] }, // still playing: not counted
        ],
      },
    ],
    bracket: [{ name: 'Final', matches: [{ a: 'C', b: 'A #2', winner: 'A #2', games: [g(1), g(1)] }] }],
    standings: [{ deck: 'C' }, { deck: 'A #2' }, { deck: 'A' }, { deck: 'C #2' }, { deck: 'B' }],
    champion: 'A #2',
  };

  it('puts the entries together, with mirror games apart, byes and the best finish', () => {
    const rows = byDeck(ev, base);
    expect(rows.map((r) => r.deck)).toEqual(['A', 'C']);
    const [a, c] = rows;
    expect(a!.entries).toEqual(['A', 'A #2']);
    expect(a!.matches).toEqual({ won: 2, lost: 1 }); // beat B, lost to C, won the final
    expect(a!.games).toEqual({ won: 5, lost: 2, tied: 1 });
    expect(a!.mirror).toEqual({ matches: 1, games: 3 });
    expect(a!.best).toEqual({ kind: 'champion', entry: 'A #2' });
    expect(c!.matches).toEqual({ won: 2, lost: 1 });
    expect(c!.games).toEqual({ won: 4, lost: 3, tied: 0 });
    expect(c!.byes).toBe(1);
    expect(c!.mirror).toEqual({ matches: 0, games: 0 });
    expect(c!.best).toEqual({ kind: 'bracket', entry: 'C', round: 'Final' });
  });

  it('no deck entered twice: no rows; no bracket: the best place', () => {
    expect(byDeck({ ...ev, entrants: ['A', 'B', 'C'] }, (n) => n)).toEqual([]);
    const rows = byDeck({ ...ev, bracket: [], champion: null }, base);
    expect(rows.find((r) => r.deck === 'A')!.best).toEqual({ kind: 'place', entry: 'A #2', place: 2, of: 5 });
  });

  it('writes records as the standings do', () => {
    expect(recordText(5, 3)).toBe('5-3');
    expect(recordText(5, 3, 1)).toBe('5-3-1');
  });
});

describe('a copy on the deck page', () => {
  const ev = (id: number, standings: string[], champion: string | null, custom = false): EventLite => ({
    id,
    date: '2026-11-16T00:00:00Z',
    champion,
    ...(custom ? { custom: true } : {}),
    top8: standings.slice(0, 2).map((deck) => ({ deck })),
    standings: standings.map((deck) => ({ deck, record: '1-0', games: '2-0' })),
  });
  const isDeck = (n: string) => n === 'A' || n === 'B';

  it("a finish of the deck's second entry is the deck's, at its best entry", () => {
    const events = [ev(1, ['B', 'A #2', 'A'], 'B'), ev(2, ['A #2', 'B', 'A'], 'A #2')];
    const f = eventFinishes('A', events, isDeck);
    expect(f.map((x) => [x.id, x.place, x.champion])).toEqual([
      [2, 1, true],
      [1, 2, false],
    ]);
    // without the library names nothing changes: the exact name only
    expect(eventFinishes('A', events).map((x) => [x.id, x.place, x.champion])).toEqual([
      [2, 3, false],
      [1, 3, false],
    ]);
    expect(deckRecord({ name: 'A', events, isDeck }).finishes.length).toBe(2);
  });
});
