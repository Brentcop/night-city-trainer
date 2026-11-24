// The breeding policy of 2026-11-24 (src/ai/breeder.ts BREED_POLICY; docs/REVIEW_2026-11-24.md B.8, finding R7): Legends
// scored by their marginal effect (a ridge regression of deck strength on Legend indicators, legendEffects) rather than
// by the average strength of the decks using them, and two colours at most for every method. Without the policy the
// breeder breeds exactly as before (tests/deck-packages-defaults.test.ts pins that); here: the regression's arithmetic on
// planted data, a Legend not credited with its partners, the colour cap on every method over many seeds, and the season
// and the Deck Lab passing the policy. Last, the tuning field (src/lib/tuningField.ts): meta decks plus the top lists by
// rating, one entry per list.
import { describe, expect, it } from 'vitest';
import { CARD_BY_ID, CARDS } from '../src/engine/cards';
import type { DeckList } from '../src/engine/types';
import { BREED_POLICY, breedSeason, LEGEND_RIDGE, legendColors, legendEffects, legendScores, legendScoresByAverage, legendScoresByEffect } from '../src/ai/breeder';
import { DEFAULT_FIELD_TOP, tuningField, tuningFieldWords } from '../src/lib/tuningField';
import type { LibraryDeck } from '../src/lib/library';
import { synthBreedInput } from './builder-fixtures';
import fs from 'node:fs';

const deck = (name: string, legends: string[]): DeckList => ({ name, legends, main: [], sideboard: [] });

describe('Legend scores by marginal effect', () => {
  it('solves the ridge regression exactly: one deck, three Legends, each gets the residual over (3 + λ)', () => {
    // two decks: X = [[1,1,1,0],[0,0,0,1]]-like design; y − ȳ = ±0.1
    const ranked = [
      { deck: deck('A', ['a', 'b', 'c']), wr: 0.6 },
      { deck: deck('B', ['d', 'e', 'f']), wr: 0.4 },
    ];
    const { mean, effect, decks } = legendEffects(ranked, 2);
    expect(mean).toBeCloseTo(0.5, 12);
    // within a block of three Legends always together: (J + λI)β = 0.1·1 → β = 0.1 / (3 + λ)
    for (const l of ['a', 'b', 'c']) expect(effect.get(l)!).toBeCloseTo(0.1 / 5, 12);
    for (const l of ['d', 'e', 'f']) expect(effect.get(l)!).toBeCloseTo(-0.1 / 5, 12);
    expect(decks.get('a')).toBe(1);
    expect(LEGEND_RIDGE).toBe(2);
  });

  it('does not credit a Legend with its partners: a strong pair’s third Legend gets no more than it shows elsewhere', () => {
    // V and Smasher are strong wherever they are; Saburo appears only with them; Dum Dum only with weak partners but
    // lifts them. The average score ranks Saburo top and Dum Dum bottom; the marginal one does not.
    const ranked = [
      { deck: deck('VSS', ['v', 'smasher', 'saburo']), wr: 0.66 },
      { deck: deck('VSP', ['v', 'smasher', 'padre']), wr: 0.66 },
      { deck: deck('VSX', ['v', 'smasher', 'x1']), wr: 0.66 },
      { deck: deck('VSY', ['v', 'smasher', 'x2']), wr: 0.66 },
      { deck: deck('W1', ['w1', 'w2', 'dumdum']), wr: 0.5 },
      { deck: deck('W2', ['w1', 'w2', 'w3']), wr: 0.34 },
      { deck: deck('W3', ['w1', 'w2', 'w4']), wr: 0.34 },
      { deck: deck('W4', ['w1', 'w2', 'w5']), wr: 0.34 },
    ];
    const avg = legendScoresByAverage(ranked);
    const eff = legendScoresByEffect(ranked);
    const { mean } = legendEffects(ranked);
    // the average credits Saburo with V and Smasher's strength (55.3) and holds Dum Dum's partners against it (50.0)
    expect(avg('saburo')).toBeCloseTo((0.66 + 1) / 3, 12);
    expect(avg('dumdum')).toBeCloseTo(0.5, 12);
    expect(avg('saburo')).toBeGreaterThan(avg('dumdum'));
    // by effect the order turns: Dum Dum lifts a weak pair by 16 points (54.7), Saburo adds nothing V and Smasher do not
    // bring elsewhere (53.3, the same as their other third Legends)
    expect(eff('dumdum')).toBeGreaterThan(eff('saburo'));
    expect(eff('saburo')).toBeCloseTo(eff('x1'), 12);
    expect(eff('v')).toBeGreaterThan(eff('saburo'));
    expect(eff('dumdum')).toBeGreaterThan(mean);
    // an untested Legend scores the mean (the average Legend)
    expect(eff('nobody')).toBeCloseTo(mean, 12);
    expect(avg('nobody')).toBe(0.5);
    // the switch
    expect(legendScores(ranked)('saburo')).toBe(avg('saburo'));
    expect(legendScores(ranked, 'marginal')('saburo')).toBe(eff('saburo'));
  });
});

describe('two colours at most, for every method', () => {
  it('the policy is marginal scores and two colours', () => {
    expect(BREED_POLICY).toEqual({ legendScore: 'marginal', maxColors: 2 });
  });

  it('over many seeds, with the policy, no bred deck has more than two colours; without it some do (the breeder before)', () => {
    let before = 0;
    let after = 0;
    const methods = new Set<string>();
    for (let seed = 1; seed <= 16; seed++)
      for (const h2h of [false, true]) {
        const input = { ...synthBreedInput(h2h), seed: 1000 + seed * 77 };
        for (const b of breedSeason(seed, input, 8)) if (legendColors(b.deck.legends) > 2) before++;
        for (const b of breedSeason(seed, { ...input, ...BREED_POLICY }, 8)) {
          methods.add(b.method);
          if (legendColors(b.deck.legends) > 2) after++;
        }
      }
    expect(after).toBe(0);
    expect(before).toBeGreaterThan(0);
    // every method still breeds under the cap
    expect([...methods].sort()).toEqual(['counter', 'crossover', 'explorer', 'mutant']);
  });

  it('the season, the preview and the Deck Lab pass the policy', () => {
    for (const f of ['scripts/season.ts', 'scripts/breed-preview.ts', 'src/lib/deckLab.ts']) expect(fs.readFileSync(f, 'utf8'), f).toMatch(/\.\.\.BREED_POLICY/);
  });

  it('legendColors counts distinct colours', () => {
    const legends = CARDS.filter((c) => c.type === 'Legend');
    const red = legends.filter((c) => c.color === 'Red').slice(0, 2).map((c) => c.id);
    const blue = legends.find((c) => c.color === 'Blue')!.id;
    expect(legendColors(red)).toBe(1);
    expect(legendColors([...red, blue])).toBe(2);
    expect(CARD_BY_ID[blue]!.color).toBe('Blue');
  });
});

describe('the tuning field', () => {
  const d = (name: string, kind: string, legends: string[], main: string[] = ['c1']): LibraryDeck => ({ file: `${name}.txt`, kind: kind as LibraryDeck['kind'], deck: { name, legends, main, sideboard: [] }, prov: {} });
  const lib = [d('M1', 'meta', ['a']), d('M2', 'meta', ['b']), d('T1', 'ladder', ['c']), d('Twin', 'guide', ['a']), d('T2', 'shared', ['e']), d('T3', 'original', ['f'])];
  const ranked = ['T1', 'M1', 'Twin', 'T2', 'T3', 'Gone'].map((name) => ({ deck: { name } }));

  it('is the meta decks alone by default', () => {
    expect(DEFAULT_FIELD_TOP).toBe(0);
    const f = tuningField(lib, ranked);
    expect(f.field.map((x) => x.deck.name)).toEqual(['M1', 'M2']);
    expect(tuningFieldWords(f)).toBe('the 2 meta decks');
  });

  it('adds the top lists by rating, skipping meta decks, decks not in the library and a list already in the field', () => {
    const f = tuningField(lib, ranked, 2);
    expect(f.field.map((x) => x.deck.name)).toEqual(['M1', 'M2', 'T1', 'T2']);
    expect(f.left.map((s) => [s.deck.deck.name, s.sameAs.deck.name])).toEqual([['Twin', 'M1']]);
    expect(tuningFieldWords(f)).toBe("the 2 meta decks and the library's top 2 lists by rating (one entry per list)");
    expect(tuningField(lib, ranked, 10).added.map((x) => x.deck.name)).toEqual(['T1', 'T2', 'T3']);
  });
});
