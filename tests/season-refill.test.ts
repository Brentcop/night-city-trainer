// The season's refills (scripts/season.ts --breed-count; src/lib/breedGate.ts gateSlots), with a fake play function: no
// game is played here. When the gate keeps some of the screen's best decks out, the next runners-up by the screen are
// gated for the open slots, round by round, on the same games, so every deck that takes a slot has passed the gate; a
// runner-up kept out is listed like any deck kept out (its trio counts as seen); with no runners-up it is one gate call,
// as before. The words count refills (enteredWords, seasonTestWords), and a counter is labelled for what it is.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { DeckList } from '../src/engine/types';
import { enteredWords, gateField, gateSeeds, gateSlots, keepReferences, planGate, refillCounts, refillRoundWords, runGate, type GateOptions, type GateOutcome, type GatePlay, type GatePlayRequest } from '../src/lib/breedGate';
import { BRED_METHOD_WORDS, bredMethodWords, COUNTER_NOTE, notEntered, seasonTestWords } from '../src/lib/bredDecks';
import { keptOutTriples } from '../scripts/breed-data';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-refill-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const deck = (name: string, n: number): DeckList => ({ name, legends: [`legend_${n}`, `legend_${n + 100}`, `legend_${n + 200}`], main: [`card_${n}`, `card_${n}`], sideboard: [] });
const META = Array.from({ length: 7 }, (_, i) => deck(`Meta ${i + 1}`, i + 1));
const RANKED = [3, 1, 7, 5, 2, 6, 4].map((i, k) => ({ deck: META[i - 1]!, wr: 0.7 - k * 0.02 }));

/** A deterministic number in [0, 1) from a string. */
function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Strength by name: "Weak …" decks lose clearly to the reference, "Even …" decks are equal to it, meta decks 0.5. */
const strength = (name: string) => (name.startsWith('Weak') ? 0.25 : 0.5);
function fakePlay(calls: GatePlayRequest[] = []): GatePlay {
  return async (r) => {
    calls.push(r);
    return Array.from({ length: r.games }, (_, k) => {
      const opp = r.field[k % r.field.length]!.name;
      const first = Math.floor(k / r.field.length) % 2;
      return unit(`${r.seed0 + k}:${opp}:${first}:${r.bot}`) < strength(r.deck.name) ? 1 : 0;
    });
  };
}

const OPTS: GateOptions = { bot: 'medium', confirmBot: 'hard', rounds: 20, stages: 5, confirmStages: 2, seeds: gateSeeds(4), reference: 'middle' };
interface B {
  deck: DeckList;
  parents: string[];
  method: string;
}
const bred = (name: string, n: number, method = 'crossover'): B => ({ deck: deck(name, n), parents: ['Meta 3', 'Meta 1'], method });
/** The season's gate for one batch: planGate in the season's mode, then runGate over `play`. */
const seasonGate = (play: GatePlay, rounds: { refill: number; names: string[] }[] = []) => (batch: readonly B[], refill: number) => {
  rounds.push({ refill, names: batch.map((b) => b.deck.name) });
  return runGate(planGate(batch, RANKED, META, 'middle'), OPTS, play);
};

describe('refilling the slots of decks kept out', () => {
  it('with no runners-up it is one gate call, the same outcomes as runGate on the decks alone', async () => {
    const picked = [bred('Even A', 10), bred('Weak B', 11), bred('Even C', 12)];
    const rounds: { refill: number; names: string[] }[] = [];
    const r = await gateSlots(picked, [], 3, seasonGate(fakePlay(), rounds));
    const alone = await runGate(planGate(picked, RANKED, META, 'middle'), OPTS, fakePlay());
    expect(rounds).toEqual([{ refill: 0, names: ['Even A', 'Weak B', 'Even C'] }]);
    expect(r.tested.map((t) => t.outcome)).toEqual(alone);
    expect(r.tested.every((t) => t.refill === undefined)).toBe(true);
    expect(r.entered.map((b) => b.deck.name)).toEqual(['Even A', 'Even C']);
    expect(refillCounts(r.tested)).toEqual({ tested: 0, entered: 0 });
  });

  it('gates the next runners-up for the open slots, round by round, until the slots are full; only decks that passed enter', async () => {
    const picked = [bred('Even A', 10), bred('Weak B', 11), bred('Weak C', 12), bred('Even D', 13)];
    // the screen's order: a weak runner-up first, so a second round is needed for the second open slot
    const runners = [bred('Weak R1', 20), bred('Even R2', 21), bred('Even R3', 22), bred('Even R4', 23)];
    const rounds: { refill: number; names: string[] }[] = [];
    const r = await gateSlots(picked, runners, 4, seasonGate(fakePlay(), rounds));
    expect(rounds).toEqual([
      { refill: 0, names: ['Even A', 'Weak B', 'Weak C', 'Even D'] },
      { refill: 1, names: ['Weak R1', 'Even R2'] },
      { refill: 2, names: ['Even R3'] },
    ]);
    expect(r.entered.map((b) => b.deck.name)).toEqual(['Even A', 'Even D', 'Even R2', 'Even R3']);
    // every deck that took a slot was gated and entered; every deck gated is in the record, runners-up with their round
    const byName = new Map(r.tested.map((t) => [t.bred.deck.name, t]));
    for (const b of r.entered) expect(byName.get(b.deck.name)!.outcome.entered).toBe(true);
    expect(r.tested.map((t) => [t.bred.deck.name, t.refill ?? 0, t.outcome.entered])).toEqual([
      ['Even A', 0, true],
      ['Weak B', 0, false],
      ['Weak C', 0, false],
      ['Even D', 0, true],
      ['Weak R1', 1, false],
      ['Even R2', 1, true],
      ['Even R3', 2, true],
    ]);
    expect(byName.has('Even R4')).toBe(false);
    expect(refillCounts(r.tested)).toEqual({ tested: 3, entered: 2 });
    // a runner-up is tested like the others: the same reference (the fixed bar) and the same seeds
    const ra = byName.get('Even R3')!.outcome;
    const a = byName.get('Even A')!.outcome;
    expect(ra.reference).toEqual(a.reference);
    expect(ra.first.seed0).toBe(a.first.seed0);
  });

  it('stops when the runners-up run out, with slots left open', async () => {
    const r = await gateSlots([bred('Weak A', 10), bred('Even B', 11)], [bred('Weak R1', 20)], 2, seasonGate(fakePlay()));
    expect(r.entered.map((b) => b.deck.name)).toEqual(['Even B']);
    expect(r.tested).toHaveLength(3);
  });

  it('a reference block is played once across the rounds when the play function keeps it (keepReferences)', async () => {
    const calls: GatePlayRequest[] = [];
    const play = keepReferences(fakePlay(calls), new Map());
    await gateSlots([bred('Weak A', 10), bred('Even B', 11)], [bred('Even R1', 20)], 2, seasonGate(play));
    const refCalls = calls.filter((c) => c.role === 'reference');
    const keys = refCalls.map((c) => `${c.deck.name}|${c.bot}|${c.seed0}`);
    expect(new Set(keys).size).toBe(keys.length);
    // the bar's blocks: up to 5 Medium stages and 2 Hard stages, played once for all three decks
    expect(refCalls.length).toBeLessThanOrEqual(5 + 2);
  });

  it('a runner-up kept out is listed with the decks kept out, and its trio counts as seen in later seasons', async () => {
    const r = await gateSlots([bred('Weak A', 10)], [bred('Weak R1', 20), bred('Even R2', 21)], 1, seasonGate(fakePlay()));
    const decks = r.tested.map((t) => ({ ...t.outcome, method: t.bred.method, legends: [...t.bred.deck.legends], ...(t.refill ? { refill: t.refill } : {}) }));
    const gate = { bred: 1, entered: r.entered.length, refills: refillCounts(r.tested).tested, decks };
    expect(notEntered(gate).map((d) => d.name)).toEqual(['Weak A', 'Weak R1']);
    fs.writeFileSync(path.join(tmp, 'season-4.json'), JSON.stringify({ season: 4, gate }));
    const seen = keptOutTriples(tmp);
    expect(seen).toContain([...deck('Weak R1', 20).legends].sort().join('|'));
    expect(seen).not.toContain([...deck('Even R2', 21).legends].sort().join('|'));
  });
});

describe('the words', () => {
  it('count refills, and are as before without them', () => {
    expect(enteredWords(8, 5)).toBe('8 bred, 5 entered');
    expect(enteredWords(8, 5, { tested: 0, entered: 0 })).toBe('8 bred, 5 entered');
    expect(enteredWords(8, 7, { tested: 3, entered: 2 })).toBe('8 bred, 7 entered, 2 of them runners-up of the screen (3 runners-up tested for the slots of decks kept out)');
    expect(enteredWords(8, 6, { tested: 1, entered: 1 })).toBe('8 bred, 6 entered, 1 of them a runner-up of the screen (1 runner-up tested for the slot of a deck kept out)');
    expect(enteredWords(8, 5, { tested: 3, entered: 0 })).toBe('8 bred, 5 entered; 3 runners-up of the screen were tested for the slots of decks kept out, and none entered');
    expect(refillRoundWords(1, ['S4-11 Cross (RRG)', 'S4-12 Mutant (RGG)'])).toBe('Refill 1: S4-11 Cross (RRG), S4-12 Mutant (RGG) (the next runners-up of the screen) are tested for slots left by decks kept out, on the same games.');
  });

  it('a season’s test of a runner-up says it was one', async () => {
    const r = await gateSlots([bred('Weak A', 10)], [bred('Even R1', 20)], 1, seasonGate(fakePlay()));
    const [a, r1] = r.tested as [{ outcome: GateOutcome }, { outcome: GateOutcome; refill: number }];
    expect(seasonTestWords(a.outcome)).toMatch(/^Kept out: shown worse than Meta 5 /);
    expect(seasonTestWords({ ...r1.outcome, refill: r1.refill })).toMatch(/^Entered: .*\. Tested as a runner-up of the screen, for a slot a deck kept out left open$/);
  });

  it('a counter is labelled for what it is today: in effect a crossover of the top decks', () => {
    expect(bredMethodWords('counter')).toMatch(/in effect a crossover of the top decks/);
    expect(COUNTER_NOTE).toMatch(/follow the power ratings/);
    expect(Object.keys(BRED_METHOD_WORDS).sort()).toEqual(['counter', 'crossover', 'explorer', 'mutant']);
    expect(bredMethodWords('something')).toBe('something');
  });
});

it('the field leaves out the reference (sanity for the fixtures)', () => {
  expect(gateField(META, META[4]!).map((d) => d.name)).not.toContain('Meta 5');
});
