// The forge's CLI summary (scripts/forge-summary.ts): it leads with the held-out paired result, and labels the
// per-generation win rates as each generation's own screening games, not a start-to-end trend.
import { describe, expect, it } from 'vitest';
import { forgeGenerationsText, forgeResultText, forgeSummaryMarkdown, type ForgeDeckSummary } from '../scripts/forge-summary';

const gain = { games: 448, mean: 0.067, lower: 0.034, upper: 0.1, z: 2.5 };
const adopted: ForgeDeckSummary = {
  name: 'Adopted deck',
  games: 1568,
  gens: [{ gen: 1, baseline: 0.589, baselineGames: 112, change: '-1 Modded Kusanagi → +1 Placide', gain }],
};
const unsure: ForgeDeckSummary = {
  name: 'Unsure deck',
  games: 1680,
  gens: [
    { gen: 1, baseline: 0.625, baselineGames: 140, change: 'kept (could not tell: -1 Meredith Stout → +1 Gunpoint Diplomacy, +0.0 pts [−3.0, +3.0], 448 games; stopped early: no gain after 448 games)' },
    { gen: 2, baseline: 0.55, baselineGames: 140, change: 'kept' },
  ],
};
const quiet: ForgeDeckSummary = { name: 'Quiet deck', games: 672, gens: [{ gen: 1, baseline: 0.5, baselineGames: 112, change: 'kept' }] };

describe('forge summary', () => {
  it('leads with the held-out paired gain of each adopted change', () => {
    expect(forgeResultText(adopted)).toBe('adopted -1 Modded Kusanagi → +1 Placide (held-out +6.7 pts [+3.4, +10.0], 448 games)');
  });

  it('says "no change adopted" when nothing was, with the changes it could not tell about', () => {
    expect(forgeResultText(quiet)).toBe('no change adopted');
    expect(forgeResultText(unsure)).toMatch(/^no change adopted \(could not tell: -1 Meredith Stout → \+1 Gunpoint Diplomacy, \+0\.0 pts .*stopped early: no gain after 448 games\)$/);
  });

  it('labels each generation’s win rate with its own games, and never prints Start / End', () => {
    expect(forgeGenerationsText(unsure)).toBe('gen 1: 62.5% on 140 games; gen 2: 55.0% on 140 games');
    const md = forgeSummaryMarkdown([adopted, unsure, quiet], 'evidence rule');
    expect(md).toContain('| Deck | Result (held-out, paired) | Each generation (its own screening games) | Games |');
    expect(md).toContain('| Quiet deck | no change adopted | gen 1: 50.0% on 112 games | 672 |');
    expect(md).toContain('not a trend');
    expect(md).not.toMatch(/\| Start \| End \|/);
  });
});
