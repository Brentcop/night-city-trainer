// The regionals forecast's field input (src/lib/forecastField.ts): uniform, your own `deck name: weight` lines or JSON,
// and an outside source's shares (tested on an invented source: no outside data is in the repository). Every way names
// its source, normalises its weights, and lists what it could not place instead of inventing a deck for it.
import { describe, expect, it } from 'vitest';
import { fieldText, FieldError, jsonField, outsideField, parseFieldText, uniformField, userField } from '../src/lib/forecastField';
import type { OutsideSeasonSource, OutsideTrio } from '../src/lib/outsideMeta';

const NAMES = ['Ladder S1 #2: V / Smasher / Saburo (RRG)', 'RRG Dexter Midrange', 'Smash the Curve', 'BBG Draw and Wipe'];

describe('uniform', () => {
  it('every rated deck the same weight, labelled as an assumption', () => {
    const f = uniformField(NAMES);
    expect(f.weights).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(f.source).toMatch(/^assumed/);
    expect(f.source).toMatch(/no information about what people play/);
    expect(f.leftOutShare).toBe(0);
  });
});

describe('your field', () => {
  it('reads the weight after the last colon, so a deck name may hold one; % allowed; comments skipped', () => {
    const { given, problems } = parseFieldText(`# a comment\n${NAMES[0]}: 30\nRRG Dexter Midrange = 10%\n\nSmash the Curve\t2.5\nnot a line`);
    expect(given).toEqual([
      { name: NAMES[0], weight: 30 },
      { name: 'RRG Dexter Midrange', weight: 10 },
      { name: 'Smash the Curve', weight: 2.5 },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/line 6/);
  });
  it('decks not named weigh 0; names match ignoring case and spacing; an unknown name is left out with its share', () => {
    const f = userField(NAMES, 'rrg dexter   midrange: 3\nSmash the Curve: 1\nSome Deck We Lack: 4');
    expect(f.weights).toEqual([0, 0.75, 0.25, 0]);
    expect(f.leftOut).toEqual([{ name: 'Some Deck We Lack', weight: 4, share: 0.5, why: 'not a rated library deck' }]);
    expect(f.leftOutShare).toBe(0.5);
    expect(f.source).toBe('your list');
  });
  it('a name twice adds up, with a note; nothing placeable is refused', () => {
    const f = userField(NAMES, 'Smash the Curve: 1\nsmash the curve: 1\nBBG Draw and Wipe: 2');
    expect(f.weights).toEqual([0, 0, 0.5, 0.5]);
    expect(f.problems.join(' ')).toMatch(/more than once/);
    expect(() => userField(NAMES, 'Nope: 3')).toThrow(FieldError);
    expect(() => userField(NAMES, 'Smash the Curve: 0')).toThrow(/above 0/);
    expect(() => userField(NAMES, '')).toThrow(/lists no deck/);
  });
  it('JSON: an object of weights, the same under "weights" with a label and source, or a list of { deck, weight }', () => {
    const a = jsonField(NAMES, { 'Smash the Curve': 1, 'RRG Dexter Midrange': 3 }, 'file.json');
    const b = jsonField(NAMES, { label: 'My guess', source: 'my notes, 2026-11-18', weights: { 'Smash the Curve': 1, 'RRG Dexter Midrange': 3 } }, 'file.json');
    const c = jsonField(NAMES, [{ deck: 'Smash the Curve', weight: 1 }, { deck: 'RRG Dexter Midrange', weight: 3 }, { deck: 7 }], 'file.json');
    for (const f of [a, b, c]) expect(f.weights).toEqual([0, 0.75, 0.25, 0]);
    expect(a.label).toBe('file.json');
    expect(b.label).toBe('My guess');
    expect(b.source).toBe('my notes, 2026-11-18');
    expect(c.problems).toHaveLength(1);
    expect(() => jsonField(NAMES, 'text', 'x')).toThrow(FieldError);
  });
  it('fieldText writes the weights back as lines the reader takes', () => {
    const f = userField(NAMES, 'Smash the Curve: 1\nRRG Dexter Midrange: 3');
    const again = userField(NAMES, fieldText(NAMES, f.weights));
    expect(again.weights.map((x) => +x.toFixed(6))).toEqual(f.weights);
  });
});

describe('an outside source (invented data)', () => {
  const trio = (names: string[], ids: (string | null)[]): OutsideTrio => ({ names, ids });
  const lib = [
    { file: 'a.txt', deck: { name: NAMES[0]!, legends: ['L1', 'L2', 'L3'] } },
    { file: 'b.txt', deck: { name: NAMES[1]!, legends: ['L1', 'L2', 'L3'] } }, // same trio: shares split equally
    { file: 'c.txt', deck: { name: NAMES[2]!, legends: ['L4', 'L5', 'L6'] } },
    { file: 'd.txt', deck: { name: 'Unrated Deck', legends: ['L7', 'L8', 'L9'] } },
  ];
  const source: OutsideSeasonSource = {
    kind: 'season',
    id: 'sim:invented',
    site: 'cyberpunk-tcg-sim.online',
    title: 'Invented season',
    link: 'https://cyberpunk-tcg-sim.online/meta/invented',
    collected: '2026-11-18',
    published: '',
    shareOf: 'high-rank decks',
    totals: {},
    period: { from: '2026-10-01', to: '2026-11-01' },
    tiers: [],
    matchups: [],
    field: [
      { trio: trio(['A', 'B', 'C'], ['L1', 'L2', 'L3']), share: 40 },
      { trio: trio(['D', 'E', 'F'], ['L4', 'L5', 'L6']), share: 20 },
      { trio: trio(['G', 'H', 'I'], ['L7', 'L8', 'L9']), share: 10 },
      { trio: trio(['X', 'Y', 'Z'], ['L10', 'L11', 'L12']), share: 15 },
    ],
  };
  it('splits a trio equally among our decks of it; leaves out unrated decks, missing trios and the unlisted rest', () => {
    const f = outsideField(NAMES, lib, source);
    // placed: 20 + 20 + 20 = 60 of 100
    expect(f.weights.map((x) => +x.toFixed(6))).toEqual([+(1 / 3).toFixed(6), +(1 / 3).toFixed(6), +(1 / 3).toFixed(6), 0]);
    expect(f.leftOutShare).toBeCloseTo(0.4, 12);
    expect(f.leftOut.map((l) => [l.name, l.share, l.why])).toEqual([
      ['Unrated Deck', 0.1, 'a library deck with no rating'],
      ['X / Y / Z', 0.15, 'a Legend trio the library does not play'],
      ['Not broken down by trio', 0.15, 'the source does not name these decks'],
    ]);
    expect(f.source).toBe('cyberpunk-tcg-sim.online, Invented season (2026-10-01 to 2026-11-01), collected 2026-11-18');
    expect(f.kind).toBe('outside');
  });
  it('a source no rated deck plays is refused', () => {
    expect(() => outsideField(['Other'], lib, source)).toThrow(FieldError);
  });
});
