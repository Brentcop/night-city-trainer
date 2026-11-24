// What the bots sell (src/lib/sellShare.ts; docs/REVIEW_2026-11-24.md B1, §10 A.12): per card, sells out of its uses
// from hand in the decision telemetry, and the "the bot sells this" line from SELLS_SHARE on.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardSellShare, MIN_SELL_USES, SELLS_SHARE, sellBasis, sellShareOf, sellShares, type SellReport } from '../src/lib/sellShare';
import { cardUse } from '../src/lib/cardFacts';
import { CARD_BY_ID } from '../src/engine/cards';
import type { DecisionReport } from '../src/analysis/decisions';

const mode = (m: string, uses: number) => ({ mode: m, all: { uses } });

describe('sellShareOf', () => {
  it('counts plays and sells as uses from hand, a reaction only when cast from hand, never attacks or abilities', () => {
    const modes = [mode('play', 10), mode('sell', 80), mode('react', 10), mode('attack', 500), mode('ability', 30), mode('call', 4)];
    expect(sellShareOf('x', 'X', modes)).toEqual({ cardId: 'x', name: 'X', sold: 80, uses: 90, share: 80 / 90, sells: true });
    expect(sellShareOf('x', 'X', modes, { reactFromHand: true })).toMatchObject({ sold: 80, uses: 100, share: 0.8, sells: false });
  });

  it('flags from SELLS_SHARE on, and never under MIN_SELL_USES uses', () => {
    expect(SELLS_SHARE).toBe(0.85);
    expect(sellShareOf('x', 'X', [mode('play', 15), mode('sell', 85)]).sells).toBe(true);
    expect(sellShareOf('x', 'X', [mode('play', 16), mode('sell', 84)]).sells).toBe(false);
    expect(sellShareOf('x', 'X', [mode('sell', MIN_SELL_USES - 1)])).toMatchObject({ share: 1, sells: false });
    expect(sellShareOf('x', 'X', [mode('sell', MIN_SELL_USES)]).sells).toBe(true);
    expect(sellShareOf('x', 'X', [mode('attack', 9)])).toMatchObject({ uses: 0, share: null, sells: false });
  });

  it('reads a list or the pooled rows, highest share first, and names the run', () => {
    const report = {
      games: 100,
      manifest: { bot: { level: 'deep' }, simVersion: 9, runId: 'r1', createdAt: '2026-11-14T00:00:00.000Z' },
      decks: [{ listId: 'L', cards: [{ id: 'a', name: 'A', modes: [mode('play', 50), mode('sell', 50)] }, { id: 'b', name: 'B', modes: [mode('sell', 30)] }, { id: 'c', name: 'C', modes: [mode('attack', 5)] }] }],
      pooled: [{ id: 'q', name: 'Q', modes: [mode('play', 1), mode('sell', 3), mode('react', 6)] }],
    } as unknown as SellReport;
    expect(sellShares(report, { listId: 'L' }).map((s) => [s.cardId, s.share])).toEqual([
      ['b', 1],
      ['a', 0.5],
    ]);
    expect(sellShares(report, { reactFromHand: (id) => id === 'q' })[0]).toMatchObject({ cardId: 'q', uses: 10, sold: 3 });
    expect(cardSellShare(report, 'a', { listId: 'L' })).toMatchObject({ sold: 50, uses: 100 });
    expect(cardSellShare(report, 'c', { listId: 'L' })).toBeNull();
    expect(cardSellShare(report, 'zz')).toBeNull();
    expect(sellBasis(report)).toEqual({ bot: 'deep', simVersion: 9, runId: 'r1', asOf: '2026-11-14T00:00:00.000Z', games: 100 });
  });

  it('stays light: type imports only, so the Lab and the evidence page can use it without the engine or the bots', () => {
    const text = fs.readFileSync(path.resolve(__dirname, '../src/lib/sellShare.ts'), 'utf8');
    const value = [...text.matchAll(/^\s*import\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    expect(value).toEqual([]);
  });
});

const DEC_FILE = 'reports/decisions-latest.json';
const DEC = fs.existsSync(DEC_FILE) ? (JSON.parse(fs.readFileSync(DEC_FILE, 'utf8')) as DecisionReport) : null;

describe('on the recorded decision report', () => {
  it.skipIf(!DEC)('the Quick Programs the review names are sold at or above the line, pooled', () => {
    const program = (id: string) => CARD_BY_ID[id]?.type === 'Program';
    const all = sellShares(DEC!, { reactFromHand: program });
    const byName = new Map(all.map((s) => [s.name, s]));
    for (const name of ['Detonate', 'Synapse Burnout', 'Safety Override']) expect(byName.get(name)?.sells, name).toBe(true);
    // the figures the kb's card facts carry are the same
    const det = all.find((s) => s.name === 'Detonate')!;
    expect(cardUse(DEC!, DEC_FILE, det.cardId)!.sold).toEqual(det);
  });
});
