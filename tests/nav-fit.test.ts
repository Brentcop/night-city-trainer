// The site header's tabs on one row (UX-7, review 2026-11-13): which tabs show and which go under More, from measured
// widths (src/lib/navFit.ts; MainNav measures them).
import { describe, expect, it } from 'vitest';
import { fitTabs } from '../src/lib/navFit';

const W = [90, 95, 85, 150, 95, 105]; // Home, Decks, Play, Tournaments, Learn, Profile (620 in all)

describe('fitTabs', () => {
  it('shows every tab when they all fit, with no More', () => {
    expect(fitTabs(W, 90, 620, 0)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('keeps the longest run from the start that fits beside More', () => {
    expect(fitTabs(W, 90, 619, 0)).toEqual([0, 1, 2, 3, 4]); // 515 + 90
    expect(fitTabs(W, 90, 604, 0)).toEqual([0, 1, 2, 3]); // 420 + 90
    expect(fitTabs(W, 90, 360, 0)).toEqual([0, 1, 2]); // 270 + 90
    expect(fitTabs(W, 90, 359, 0)).toEqual([0, 1]);
  });
  it('always shows the active tab, in place of the last one that would show', () => {
    expect(fitTabs(W, 90, 380, 5)).toEqual([0, 1, 5]); // 290 + 90
    expect(fitTabs(W, 90, 360, 5)).toEqual([0, 5]);
    // a wide active tab pushes one more under More
    expect(fitTabs(W, 90, 360, 3)).toEqual([0, 3]);
    expect(fitTabs(W, 90, 400, 1)).toEqual([0, 1, 2]);
  });
  it('with no room for a tab beside More, shows the active one alone, or none', () => {
    expect(fitTabs(W, 90, 200, 3)).toEqual([]);
    expect(fitTabs(W, 90, 200, 4)).toEqual([4]);
    expect(fitTabs(W, 90, 100, null)).toEqual([]);
  });
});
