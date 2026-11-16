// The Deck Lab's Breed tab: a bred deck's test against its reference (src/lib/breedGate.ts LAB_TEST, runLabTest,
// keepReferences; the view src/ui/components/LabBreedTest.tsx; docs/SYNERGIES.md "A bred deck's test against its
// parent"). Games are faked (a hash of the deal decides them), so the true difference is known. Checked: the sizes and
// seeds, the reference (best parent, else the middle meta deck), a reference played once across two presses (and played
// again after a failure), a block over the game pool in the season's layout, the sentence before the test and the result sentence for each verdict, and the rendered view
// in each state with no jargon and nothing that says "as good as".
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DeckList } from '../src/engine/types';
import {
  gateStageGames,
  keepReferences,
  LAB_TEST,
  labBeforeWords,
  labDetectable,
  labReferenceKept,
  labReferenceWords,
  labResultWords,
  labTestEntry,
  labTestOptions,
  runLabTest,
  type GateOutcome,
  type GatePlay,
  type GatePlayRequest,
  type ReferenceStore,
} from '../src/lib/breedGate';
import { gameRunManifest } from '../src/lib/runManifest';
import { labGatePlay } from '../src/lib/deckLab';
import type { GameJob, PlayGame } from '../src/lib/tournament';
import { gateJobs } from '../scripts/gate-run';
import { BreedTestView, type BreedTestState } from '../src/ui/components/LabBreedTest';

const deck = (name: string, n: number): DeckList => ({ name, legends: [`legend_${n}`], main: [`card_${n}`, `card_${n}`], sideboard: [] });
const META = Array.from({ length: 7 }, (_, i) => deck(`Meta ${i + 1}`, i + 1));
/** strength order: Meta 3, Meta 1, Meta 7, Meta 5, Meta 2, Meta 6, Meta 4 (Meta 5 is the middle one) */
const RANKED = [3, 1, 7, 5, 2, 6, 4].map((i, k) => ({ deck: META[i - 1]!, wr: 0.7 - k * 0.02 }));

function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Every list wins a deal when one common number for it is below its strength; "Even" lists win exactly the deals their reference loses. */
function fakePlay(strength: (name: string) => number, calls: GatePlayRequest[] = []): GatePlay {
  return async (r) => {
    calls.push(r);
    return Array.from({ length: r.games }, (_, k) => {
      if (r.deck.name.startsWith('Even')) return k % 2;
      const opp = r.field[k % r.field.length]!.name;
      return unit(`${r.seed0 + k}:${opp}:${Math.floor(k / r.field.length) % 2}`) < strength(r.deck.name) ? 1 : 0;
    });
  };
}
const flat = (x: number) => () => x;

describe('the Lab’s sizes and reference', () => {
  it('stages of 10 double rounds (120 games with 6 opponents, 140 with 7), up to 4, the Medium bot alone, the Lab’s seed', () => {
    expect(LAB_TEST).toEqual({ bot: 'medium', rounds: 10, stages: 4, seed: 77_000 });
    expect([gateStageGames(LAB_TEST.rounds, 6), gateStageGames(LAB_TEST.rounds, 7)]).toEqual([120, 140]);
    const o = labTestOptions();
    expect(o.confirmBot).toBeNull();
    expect(o.seeds.first).toBe(77_000);
  });

  it('a bred deck is tested against its best parent; an explorer, or a deck with no parent ranked, against the middle meta deck', () => {
    const mutant = labTestEntry({ deck: deck('Mutant', 20), parents: ['Meta 7', 'Meta 1'] }, RANKED, META);
    expect([mutant.reference.name, mutant.referenceWhy, mutant.field.length]).toEqual(['Meta 1', 'best-parent', 6]);
    const explorer = labTestEntry({ deck: deck('Explorer', 21), parents: [] }, RANKED, META);
    expect([explorer.reference.name, explorer.referenceWhy]).toEqual(['Meta 5', 'explorer']);
    const orphan = labTestEntry({ deck: deck('Orphan', 22), parents: ['Not ranked'] }, RANKED, META);
    expect([orphan.reference.name, orphan.referenceWhy]).toEqual(['Meta 5', 'no-parent-available']);
    // a parent outside the meta: the field is all 7 meta decks
    const outside = { deck: deck('S1-01', 30), wr: 0.9 };
    expect(labTestEntry({ deck: deck('Child', 31), parents: ['S1-01'] }, [outside, ...RANKED], META).field).toHaveLength(7);
  });
});

describe('a reference is played once', () => {
  it('across two presses with the same reference: its blocks are played once and reused; the deck’s own always play', async () => {
    const calls: GatePlayRequest[] = [];
    const play = fakePlay(flat(0.5), calls);
    const store: ReferenceStore = new Map();
    const a = labTestEntry({ deck: deck('Even A', 40), parents: ['Meta 1'] }, RANKED, META);
    const b = labTestEntry({ deck: deck('Even B', 41), parents: ['Meta 1'] }, RANKED, META);
    expect(labReferenceKept(store, a)).toBe(false);
    const first = await runLabTest(a, play, store);
    expect(labReferenceKept(store, b)).toBe(true);
    const second = await runLabTest(b, play, store);
    // both "could not tell" at the cap: 4 stages each, the reference's 4 blocks played once
    expect([first.first.verdict, first.first.looks, second.first.verdict, second.first.looks]).toEqual(['could-not-tell', 4, 'could-not-tell', 4]);
    const ref = calls.filter((c) => c.role === 'reference');
    expect(ref.map((c) => c.seed0)).toEqual([77_000, 77_120, 77_240, 77_360]);
    expect(ref.every((c) => c.deck.name === 'Meta 1' && c.games === 120 && c.bot === 'medium')).toBe(true);
    expect(calls.filter((c) => c.role === 'deck').map((c) => c.deck.name)).toEqual(['Even A', 'Even A', 'Even A', 'Even A', 'Even B', 'Even B', 'Even B', 'Even B']);
    // the same deck again: nothing of the reference is played
    const before = calls.length;
    await runLabTest(a, play, store);
    expect(calls.slice(before).every((c) => c.role === 'deck')).toBe(true);
    // another reference is its own block
    await runLabTest(labTestEntry({ deck: deck('Even C', 42), parents: ['Meta 3'] }, RANKED, META), play, store);
    expect(calls.filter((c) => c.role === 'reference' && c.deck.name === 'Meta 3')).toHaveLength(4);
  });

  it('a block that failed (or was stopped) is forgotten and played again on the next press', async () => {
    const calls: GatePlayRequest[] = [];
    const good = fakePlay(flat(0.5), calls);
    let fail = true;
    const play: GatePlay = (r) => (fail && r.role === 'reference' ? Promise.reject(new Error('worker crashed')) : good(r));
    const store: ReferenceStore = new Map();
    const a = labTestEntry({ deck: deck('Even A', 50), parents: ['Meta 1'] }, RANKED, META);
    await expect(runLabTest(a, play, store)).rejects.toThrow('worker crashed');
    expect(store.size).toBe(0);
    fail = false;
    const r = await runLabTest(a, play, store);
    expect(r.first.verdict).toBe('could-not-tell');
    expect(calls.filter((c) => c.role === 'reference')).toHaveLength(4);
  });

  it('keepReferences hands the deck’s blocks straight through and shares a block that is still playing', async () => {
    let n = 0;
    const play: GatePlay = async (r) => {
      n++;
      return Array.from({ length: r.games }, () => 1);
    };
    const store: ReferenceStore = new Map();
    const kept = keepReferences(play, store);
    const req = { deck: META[0]!, field: META.slice(1), seed0: 1, games: 12, bot: 'medium' };
    const [x, y] = await Promise.all([kept({ ...req, role: 'reference' }), kept({ ...req, role: 'reference' })]);
    expect(x).toBe(y);
    await kept({ ...req, role: 'deck' });
    await kept({ ...req, role: 'deck' });
    expect(n).toBe(3);
  });
});

describe('the Lab’s games', () => {
  it('a block over the game pool is the gate’s layout (the same jobs as the season’s, scripts/gate-run.ts gateJobs)', async () => {
    const jobs: GameJob[] = [];
    const play: PlayGame = async (j) => {
      jobs.push(j);
      return { winner: j.seed % 3 === 0 ? 0 : 1, turns: 1 } as unknown as Awaited<ReturnType<PlayGame>>;
    };
    let games = 0;
    const req = { deck: deck('Bred', 70), field: META.slice(1), seed0: 77_120, games: 24, bot: 'medium', role: 'deck' as const };
    const scores = await labGatePlay(play, () => games++)(req);
    const want = gateJobs(req);
    expect(jobs.map((j) => [j.a.name, j.b.name, j.seed, j.first, j.bot])).toEqual(want.map((j) => [j.a.name, j.b.name, j.seed, j.first, j.bot]));
    expect(scores).toEqual(jobs.map((j) => (j.seed % 3 === 0 ? 1 : 0)));
    expect(games).toBe(24);
  });
});

// ---------------------------------------------------------------- the words

const outcomeFor = async (strength: number, name = 'Bred'): Promise<GateOutcome> => {
  const e = labTestEntry({ deck: deck(name, 60), parents: ['Meta 1'] }, RANKED, META);
  return runLabTest(e, fakePlay((n) => (n === name ? strength : 0.6)), new Map());
};

describe('the Lab’s sentences', () => {
  it('before the test: what it may play and what it can tell', () => {
    expect(labDetectable(6)).toBeGreaterThan(labDetectable(7));
    expect(labBeforeWords({ reference: 'RRG Dexter Midrange', opponents: 6 })).toBe(
      'It plays up to 960 games with the Medium bot: this deck and RRG Dexter Midrange play the same deals against 6 meta decks, in batches of 120 games each, up to 4 batches, and it stops early once the difference is clear. ' +
        `It shows a deck worse (or better) 8 times in 10 only when the difference is about ${(labDetectable(6) * 100).toFixed(1)} points or more, so for smaller differences “could not tell” is the likely answer.`,
    );
    // at the Medium bot's spread measured on the recorded bred decks, 0.59 (breedGate.ts GATE_SD)
    expect((labDetectable(6) * 100).toFixed(1)).toBe('7.6');
    expect((labDetectable(7) * 100).toFixed(1)).toBe('7.1');
    expect(labBeforeWords({ reference: 'X', opponents: 7 })).toContain('up to 1,120 games');
    expect(labBeforeWords({ reference: 'X', opponents: 7, referenceKept: true })).toContain(' Games of X already played here are reused rather than played again. ');
  });

  it('the reference in one sentence', () => {
    expect(labReferenceWords('RRG Dexter Midrange', 'best-parent')).toBe('Tested against its best parent, RRG Dexter Midrange.');
    expect(labReferenceWords('Meta 5', 'explorer')).toBe('An explorer has no parent, so it is tested against the middle meta deck by strength, Meta 5.');
    expect(labReferenceWords('Meta 5', 'no-parent-available')).toBe('None of its parents is rated, so it is tested against the middle meta deck by strength, Meta 5.');
    // the Lab always tests against the best parent; a season run with the middle reference says this
    expect(labReferenceWords('Meta 5', 'fixed-bar')).toBe('Tested against the middle meta deck by strength, Meta 5, the same fixed bar for every bred deck.');
  });

  it('the result for each verdict, with the difference, its range, both win rates and the games; never "as good as"', async () => {
    const worse = await outcomeFor(0.3);
    const better = await outcomeFor(0.9);
    const even = await runLabTest(labTestEntry({ deck: deck('Even', 61), parents: ['Meta 1'] }, RANKED, META), fakePlay(flat(0.5)), new Map());
    expect([worse.first.verdict, better.first.verdict, even.first.verdict]).toEqual(['shown-worse', 'shown-better', 'could-not-tell']);
    const w = labResultWords(worse);
    expect(w.verdict).toBe('Shown worse than Meta 1.');
    expect(w.difference).toMatch(/^Difference in win rate, this deck minus Meta 1: −\d+\.\d points \(range −\d+\.\d to −\d+\.\d\)\.$/);
    expect(w.rates).toMatch(/^This deck won \d+\.\d% of its games, Meta 1 \d+\.\d%\.$/);
    expect(w.games).toBe(`${worse.first.judged.games} games each with the Medium bot, on the same deals against the same 6 meta decks.`);
    expect(labResultWords(better).verdict).toBe('Shown better than Meta 1.');
    expect(labResultWords(better).difference).toMatch(/: \+\d+\.\d points \(range \+\d+\.\d to \+\d+\.\d\)\.$/);
    const e = labResultWords(even);
    expect(e.verdict).toBe('Could not tell: not shown worse than Meta 1.');
    expect(e.games).toBe('480 games each with the Medium bot, on the same deals against the same 6 meta decks.');
    for (const r of [w, labResultWords(better), e]) expect(Object.values(r).join(' ')).not.toMatch(/as good as|entered|kept out/i);
  });
});

describe('the view', () => {
  const manifest = gameRunManifest({ purpose: 'browser', decks: [deck('Bred', 60), META[0]!, ...META.slice(1)], fieldMode: 'deck-lab-breed-test:meta', bot: 'medium', seedBase: 77_000, seatPolicy: 'alternate', plannedGames: 960, completedGames: 240, gamesPerPair: null, simVersion: 9 });
  const view = (state: BreedTestState | undefined, kept = false) =>
    renderToStaticMarkup(<BreedTestView reference="Meta 1" why="best-parent" opponents={6} referenceKept={kept} state={state} onTest={() => {}} onStop={() => {}} />);
  const BANNED = /held-out|ledger|nominee|shortlist|\bgate\b|as good as/i;

  it('before: the reference, what it may play and can tell, and the button naming the reference', () => {
    const html = view(undefined);
    expect(html).toContain('Tested against its best parent, Meta 1.');
    expect(html).toContain('It plays up to 960 games with the Medium bot');
    expect(html).toContain('▶ Test against Meta 1');
    expect(view(undefined, true)).toContain('Games of Meta 1 already played here are reused');
  });

  it('running: the games so far and Stop; stopped and failed say so and offer the button again', () => {
    const running = view({ kind: 'running', games: 240 });
    expect(running).toContain('Testing…');
    expect(running).toContain('240 games played');
    expect(running).toContain('■ Stop');
    const stopped = view({ kind: 'stopped' });
    expect(stopped).toContain('Stopped before it was decided.');
    expect(stopped).toContain('▶ Test against Meta 1');
    const failed = view({ kind: 'failed', error: 'worker crashed' });
    expect(failed).toContain('⚠ Test failed: worker crashed');
    expect(failed).toContain('▶ Test against Meta 1');
  });

  it('done: the verdict and its figures, the run details, no button, no jargon', async () => {
    for (const o of [await outcomeFor(0.3), await outcomeFor(0.9)]) {
      const html = view({ kind: 'done', outcome: o, manifest });
      const w = labResultWords(o);
      for (const s of Object.values(w)) expect(html).toContain(s.replace(/&/g, '&amp;'));
      expect(html).toContain('Run details');
      expect(html).not.toContain('▶ Test against');
      expect(html).not.toContain('It plays up to');
    }
    for (const s of [undefined, { kind: 'running', games: 1 } as const, { kind: 'done', outcome: await outcomeFor(0.6, 'Same'), manifest } as const]) expect(view(s)).not.toMatch(BANNED);
  });
});
