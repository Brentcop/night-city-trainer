// The Deck Lab's half of REVIEW_2026-11-24 §10 A.3 and A.12: successive halving (TuneOptions.screenRounds, opt-in)
// keeps one entry per candidate (its last round's, paired with that round's own baseline on its own block of seeds),
// nominates from the last round only and never logs a candidate twice after a Stop; and a cut the bot mostly sells is
// flagged from the decision telemetry (components/LabSells.tsx). Default runs are pinned in tests/deck-lab-ledger.test.ts.
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { listFingerprint } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { DECISION_TELEMETRY_SCHEMA } from '../src/engine/telemetry';
import { halvingRounds, tuneDeck, tunePlan, type TuneOptions } from '../src/lib/deckLab';
import { estimateGames } from '../src/lib/deckSearch';
import type { GameJob, PlayGame } from '../src/lib/tournament';
import { labSellLookup, readSellReport, sellNoteTitle } from '../src/ui/components/LabSells';
import type { SellReport } from '../src/lib/sellShare';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const start = anyDeck('A', ['Red', 'Yellow']);
const field = [anyDeck('B', ['Blue', 'Green']), anyDeck('C', ['Blue', 'Red'])];
function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
/** A fake game: each list wins with its own chance (0.5 for the start, a fixed per-list offset for the others). */
const fake: PlayGame = async (j: GameJob) => {
  const key = j.a.main.join();
  const p = key === start.main.join() ? 0.5 : 0.4 + 0.3 * unit(`list:${key}`);
  return { seed: j.seed, first: j.first, turns: 5, reason: 'test', winner: unit(`g:${j.seed}:${j.b.name}:${j.first}:${key}`) < p ? 0 : 1 };
};
const OPTS: TuneOptions = { games: 40, gens: 1, cands: 2, initialCands: 6, screenRounds: 2, bot: 'easy', minGain: -1, seedBase: 600_000 };

describe('successive halving in the Lab', () => {
  it('screens on a block of its own with a baseline per round, logs each candidate once and nominates from the last round', async () => {
    const jobs: { seed: number; list: string }[] = [];
    const end = await tuneDeck(start, field, OPTS, async (j) => (jobs.push({ seed: j.seed, list: j.a.main.join() }), fake(j)), () => undefined, () => false);
    const l = end.logs[0]!;
    const seed0 = 600_000 + 10_000;
    const rounds = halvingRounds(seed0, 40, 2);
    expect(rounds).toEqual([
      { seed: seed0 + 40, games: 20 },
      { seed: seed0 + 60, games: 20 },
    ]);
    // the telemetry baseline on its block, then each round's own baseline (the start list) on the round's seeds
    const own = jobs.filter((x) => x.list === start.main.join());
    for (const r of rounds) expect(own.filter((x) => x.seed >= r.seed && x.seed < r.seed + r.games).length).toBe(r.games);
    // no candidate plays the baseline's block: the cuts are never screened on the games that chose them
    expect(jobs.filter((x) => x.list !== start.main.join() && x.seed >= seed0 && x.seed < seed0 + 40)).toEqual([]);
    // one entry per candidate: 6 in round 1, the best half (3, at least cands) again in round 2
    const labels = l.swaps.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.length).toBe(6);
    expect(l.swaps.filter((s) => s.round === 2).length).toBe(3);
    expect(l.swaps.filter((s) => s.round === 1).length).toBe(3);
    expect(l.halving).toEqual({ rounds: 2, baselineGames: 40 });
    // the last round's entries come first; each figure is on its round's 20 games
    expect(l.swaps.slice(0, 3).every((s) => s.round === 2)).toBe(true);
    expect(l.swaps.every((s) => s.gain!.games === 20)).toBe(true);
    // the nominee is from the last round (minGain −1: the best of the last round)
    expect(l.nominees?.length).toBe(1);
    expect(l.swaps.find((s) => s.label === l.nominees![0]!.label)!.round).toBe(2);
    expect(l.nominees![0]!.label).toBe(l.swaps[0]!.label);
    // the plan counts the layout: the baseline's block, then each round's baseline and candidates
    const p = tunePlan(OPTS);
    expect(p.estimate.screen).toBe(estimateGames({ gens: 1, screenGames: 40, singles: 2, packageMoves: 0, depth: p.depth, firstStage: 80, rule: p.rule, screenRounds: 2, initialCands: 6, ownHalvingBlock: true }).screen);
    expect(p.estimate.screen).toBe(40 + 20 * (1 + 6) + 20 * (1 + 3));
  });

  it('after a Stop no candidate is logged twice and nothing is nominated from an unfinished round', async () => {
    let n = 0;
    let stopped = false;
    const end = await tuneDeck(
      start,
      field,
      OPTS,
      async (j) => {
        if (++n === 40 + 20 * 5 + 5) stopped = true;
        return fake(j);
      },
      () => undefined,
      () => stopped,
    );
    const l = end.logs[0]!;
    const labels = l.swaps.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(l.nominees).toBeUndefined();
    expect(l.adopted).toBeNull();
  });

  it('refuses a round with no games', async () => {
    await expect(tuneDeck(start, field, { ...OPTS, games: 3, screenRounds: 4 }, fake, () => undefined, () => false)).rejects.toThrow(/at least one game a round/);
  });
});

describe('the bot sells this', () => {
  const ids = CARDS.filter((c) => c.type !== 'Legend').slice(0, 3).map((c) => c.id);
  const row = (id: string, play: number, sell: number) => ({ id, name: CARDS.find((c) => c.id === id)!.name, modes: [{ mode: 'play', all: { uses: play } }, { mode: 'sell', all: { uses: sell } }] });
  const report = {
    kind: 'decision-telemetry',
    telemetrySchema: DECISION_TELEMETRY_SCHEMA,
    games: 100,
    decks: [{ listId: listFingerprint(start), cards: [row(ids[0]!, 5, 95), row(ids[1]!, 50, 50)] }],
    pooled: [row(ids[0]!, 10, 30), row(ids[1]!, 2, 98), row(ids[2]!, 1, 9)],
    manifest: { bot: { level: 'deep' }, simVersion: 9, runId: 'r', createdAt: '2026-11-14T15:47:12.017Z' },
  } as unknown as SellReport;

  it('reads only a decision report of this telemetry schema', () => {
    expect(readSellReport(report)).toBe(report);
    expect(readSellReport({ ...report, telemetrySchema: -1 })).toBeNull();
    expect(readSellReport({ kind: 'other' })).toBeNull();
    expect(readSellReport(null)).toBeNull();
  });

  it('flags a card sold in at least 85% of 20 or more uses: the list’s own row, else the pooled rows', () => {
    const own = labSellLookup(report, listFingerprint(start));
    expect(own(ids[0]!)?.share.share).toBe(0.95);
    expect(own(ids[0]!)?.scope).toBe('list');
    expect(own(ids[1]!)).toBeNull();
    const pooled = labSellLookup(report, 'not-in-the-report');
    expect(pooled(ids[0]!)).toBeNull();
    expect(pooled(ids[1]!)?.scope).toBe('pooled');
    // too few uses: never flagged
    expect(pooled(ids[2]!)).toBeNull();
    const t = sellNoteTitle(own(ids[0]!)!);
    expect(t).toContain('Sold in 95% of 100 uses from hand');
    expect(t).toContain('the Deep bot’s run of 2026-11-14 (simulator version 9');
    expect(t).toContain('on this list as it started');
    expect(sellNoteTitle(pooled(ids[1]!)!)).toContain('pooled over the 1 deck it played, not this list');
  });
});
