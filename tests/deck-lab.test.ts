// Deck Lab tuning after Stop (backlog APP-7): a stopped or failed run can still save the swaps it had confirmed.
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { partialTune, tunedName, tuneDeck, type TuneProgress } from '../src/lib/deckLab';
import type { DeckList } from '../src/engine/types';
import type { GameJob, PlayGame } from '../src/lib/tournament';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const start = anyDeck('A', ['Red', 'Yellow']);
const field = [anyDeck('B', ['Blue', 'Green'])];
const sameList = (a: DeckList, b: DeckList) => [...a.main].sort().join() === [...b.main].sort().join();

/** A fake game: any list that differs from the starting list wins, the starting list loses. */
const play: PlayGame = async (j: GameJob) => ({ seed: j.seed, first: j.first, turns: 5, reason: 'test', winner: sameList(j.a, start) ? 1 : 0 });
const OPTS = { games: 4, gens: 3, cands: 2, bot: 'easy', minGain: 0.02, seedBase: 500_000 };

describe('Deck Lab partial tune', () => {
  it('keeps only the swaps confirmed before Stop', async () => {
    let last: TuneProgress | null = null;
    // stop as soon as generation 1 has adopted a swap
    const stop = () => !!last?.logs.some((l) => l.adopted);
    const end = await tuneDeck(start, field, OPTS, play, (p) => (last = p), stop);
    expect(end.phase).toBe('Stopped');
    expect(end.logs).toHaveLength(1);
    const part = partialTune(end);
    expect(part).not.toBeNull();
    expect(part!.adopted).toEqual([end.logs[0].adopted]);
    expect(sameList(part!.deck, start)).toBe(false);
    expect(end.played).toBeLessThan(end.total);
  });

  it('a run cut off mid-generation (the pool rejects) still reports the list confirmed before it', async () => {
    let last: TuneProgress | null = null;
    let adoptedAt = -1;
    let calls = 0;
    // after the first adoption, the next game fails the way a stopped pool rejects its games in flight
    const failing: PlayGame = (j) => {
      calls++;
      if (adoptedAt >= 0 && calls > adoptedAt) return Promise.reject(new Error('stopped'));
      return play(j);
    };
    const onProgress = (p: TuneProgress) => {
      last = p;
      if (adoptedAt < 0 && p.logs.some((l) => l.adopted)) adoptedAt = calls;
    };
    await expect(tuneDeck(start, field, OPTS, failing, onProgress, () => false)).rejects.toThrow('stopped');
    const part = partialTune(last);
    expect(part?.adopted).toHaveLength(1);
    expect(sameList(part!.deck, start)).toBe(false);
  });

  it('offers nothing when no swap was confirmed', async () => {
    let n = 0;
    const end = await tuneDeck(start, field, OPTS, play, () => undefined, () => ++n > 1);
    expect(end.logs.every((l) => !l.adopted)).toBe(true);
    expect(partialTune(end)).toBeNull();
    expect(partialTune(null)).toBeNull();
  });

  it('names partial results so they are not mistaken for a finished tune', () => {
    expect(tunedName('Red Rush')).toBe('Red Rush (tuned)');
    expect(tunedName('Red Rush', true)).toBe('Red Rush (tuned, partial)');
    expect(tunedName('Red Rush (tuned)')).toBe('Red Rush (tuned)');
    expect(tunedName('Red Rush (tuned)', true)).toBe('Red Rush (tuned, partial)');
    expect(tunedName('Red Rush (tuned, partial)')).toBe('Red Rush (tuned)');
  });
});
