import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { MAIN_TYPES, typeSplit, typeSplitText } from '../src/lib/deckTypes';

describe('typeSplit', () => {
  const byId = { u: { type: 'Unit' }, g: { type: 'Gear' }, p: { type: 'Program' }, l: { type: 'Legend' } } as const;

  it('counts Units, Gear and Programs in order and skips unknown ids', () => {
    const s = typeSplit(['u', 'u', 'g', 'p', 'p', 'p', 'nope'], byId);
    expect(s.types).toEqual([
      ['Unit', 2],
      ['Gear', 1],
      ['Program', 3],
    ]);
    expect(s.total).toBe(6);
  });

  it('counts other known types in the total only', () => {
    expect(typeSplit(['l', 'u'], byId)).toEqual({ types: [['Unit', 1], ['Gear', 0], ['Program', 0]], total: 2 });
  });

  it('describes the split in words', () => {
    expect(typeSplitText(typeSplit(['u', 'g', 'g', 'p'], byId))).toBe('1 Unit, 2 Gear, 1 Program');
    expect(typeSplitText(typeSplit([], byId))).toBe('0 Units, 0 Gear, 0 Programs');
  });

  it('uses the real card data by default', () => {
    const ids = MAIN_TYPES.map((t) => CARDS.find((c) => c.type === t)!.id);
    expect(typeSplit(ids).types.map(([, c]) => c)).toEqual([1, 1, 1]);
  });
});
