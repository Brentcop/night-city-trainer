// The Sim tier (src/lib/simTier.ts): a letter from our own tournament results, from fixed bands on the power rating's
// expected win rate vs the field; unrated below the small-sample threshold; marked ± when the 90% range reaches two
// bands away. The badges name their source so the Sim tier and choom.gg's tier are never confused.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RATINGS } from '../src/data/index';
import { bandOf, bandRange, bandsLine, bandWords, SIM_TIER_BANDS, SIM_TIER_MIN_GAMES, simTier, simTierShort, simTierText } from '../src/lib/simTier';
import { SMALL_SAMPLE } from '../src/lib/playedRecord';
import { ChoomTierBadge, SimTierBadge, simTierFor, tierOptionText } from '../src/ui/components/TierBadges';

const row = (wrField: number, lo: number, hi: number, games = 50) => ({ wrField, wrFieldLo: lo, wrFieldHi: hi, games });

describe('Sim tier bands', () => {
  it('fixed bands, best first, lower bounds inclusive', () => {
    expect(SIM_TIER_BANDS.map((b) => b.letter)).toEqual(['S', 'A', 'B', 'C', 'D']);
    expect(bandOf(0.64)).toBe('S');
    expect(bandOf(0.6399)).toBe('A');
    expect(bandOf(0.55)).toBe('A');
    expect(bandOf(0.5)).toBe('B');
    expect(bandOf(0.45)).toBe('B');
    expect(bandOf(0.4)).toBe('C');
    expect(bandOf(0.36)).toBe('C');
    expect(bandOf(0.2)).toBe('D');
    expect(bandOf(0)).toBe('D');
  });
  it('describes each band', () => {
    expect(bandWords('S')).toBe('64% or more');
    expect(bandWords('B')).toBe('45%–55%');
    expect(bandWords('D')).toBe('under 36%');
    expect(bandRange('A')).toEqual({ min: 0.55, max: 0.64 });
    expect(bandsLine()).toBe('S 64% or more · A 55%–64% · B 45%–55% · C 36%–45% · D under 36%');
  });
});

describe('Sim tier of a ratings row', () => {
  it('a firm letter when the range stays within a neighbouring band', () => {
    const t = simTier(row(0.7, 0.6, 0.8));
    expect(t).toMatchObject({ letter: 'S', straddle: false, loLetter: 'A', hiLetter: 'S', games: 50 });
    expect(simTierShort(t)).toBe('S');
  });
  it('± when the 90% range reaches two bands away', () => {
    const t = simTier(row(0.52, 0.41, 0.645));
    expect(t).toMatchObject({ letter: 'B', straddle: true, loLetter: 'C', hiLetter: 'S' });
    expect(simTierShort(t)).toBe('B±');
    expect(simTierText(t)).toMatch(/Uncertain: the range reaches from tier C to tier S/);
  });
  it('unrated with no games, or fewer than the small-sample threshold', () => {
    expect(SIM_TIER_MIN_GAMES).toBe(SMALL_SAMPLE);
    expect(simTier(undefined)).toMatchObject({ letter: null, unrated: 'no-games' });
    expect(simTier(row(0.7, 0.6, 0.8, 0))).toMatchObject({ letter: null, unrated: 'no-games' });
    const few = simTier(row(0.7, 0.4, 0.9, SIM_TIER_MIN_GAMES - 1));
    expect(few).toMatchObject({ letter: null, unrated: 'few-games', games: SIM_TIER_MIN_GAMES - 1 });
    expect(simTierShort(few)).toBe('–');
    expect(simTierText(few)).toMatch(/too few games \(19 of the 20 needed\)/);
    expect(simTier(row(0.7, 0.6, 0.8, SIM_TIER_MIN_GAMES)).letter).toBe('S');
  });
  it('the tooltip says where it comes from, the number, range and games', () => {
    expect(simTierText(simTier(row(0.583, 0.481, 0.679, 52)))).toBe(
      "Sim tier, from this trainer's recorded tournaments (power rating): A. Expected 58.3% vs the field (90% range 48.1%–67.9%) over 52 games; tier A is 55%–64%.",
    );
  });
  it('is read from the bundled ratings, so every rated deck with enough games gets the letter of its band', () => {
    for (const r of RATINGS.decks) {
      const t = simTierFor(r.name);
      if (r.games >= SIM_TIER_MIN_GAMES) expect(t.letter).toBe(bandOf(r.wrField));
      else expect(t.letter).toBeNull();
    }
    expect(simTierFor('No such deck').unrated).toBe('no-games');
  });
});

describe('tier badges', () => {
  it('the Sim badge names its source, marks uncertainty and carries the tooltip', () => {
    const html = renderToStaticMarkup(<SimTierBadge tier={simTier(row(0.52, 0.41, 0.645))} />);
    expect(html).toContain('tierb-sim');
    expect(html).toContain('is-unsure');
    expect(html).toContain('>Sim<');
    expect(html).toContain('>B±<');
    expect(html).toContain('Sim tier B, uncertain');
    expect(html).toMatch(/title="Sim tier, from this trainer&#x27;s recorded tournaments/);
  });
  it('an unrated deck shows a dash only when asked, and nothing without recorded games unless always', () => {
    const few = simTier(row(0.6, 0.4, 0.8, 5));
    expect(renderToStaticMarkup(<SimTierBadge tier={few} />)).toBe('');
    expect(renderToStaticMarkup(<SimTierBadge tier={few} showUnrated />)).toContain('>–<');
    expect(renderToStaticMarkup(<SimTierBadge tier={simTier(undefined)} showUnrated />)).toBe('');
    expect(renderToStaticMarkup(<SimTierBadge tier={simTier(undefined)} showUnrated="always" />)).toContain('is-unrated');
  });
  it('the choom badge is labelled choom.gg, not ours', () => {
    const html = renderToStaticMarkup(<ChoomTierBadge tier="A" />);
    expect(html).toContain('tierb-choom');
    expect(html).toContain('>choom<');
    expect(html).toContain('choom.gg tier A');
    expect(html).toContain('not our results');
    expect(renderToStaticMarkup(<ChoomTierBadge tier={undefined} />)).toBe('');
  });
  it('picker options spell out both sources', () => {
    expect(tierOptionText('S', simTier(row(0.58, 0.5, 0.66)))).toBe(' [choom S] [Sim A]');
    expect(tierOptionText(undefined, simTier(undefined))).toBe('');
  });
});
