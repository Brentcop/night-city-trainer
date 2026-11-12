// The Deck Lab's honest trajectory (docs/SYNERGIES.md "The tuner's result against the original"): every generation
// screens on new games, so its per-generation score wanders even when nothing changes; the headline compares the
// current list with the ORIGINAL on one common held-out block, and the result says plainly when the tuned list is not
// shown better. Games are faked (a hash of the seed decides them), so every list's true win rate is known.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CARDS } from '../src/engine/cards';
import { listFingerprint } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { finalVsOriginal, trajectoryLine, tuneDeck, tunePlan, tuneSummaryText, vsOriginalGames, vsOriginalVerdict, type TuneLog, type TuneOptions } from '../src/lib/deckLab';
import { isTunedRecord, manifestTune, tunedRecord } from '../src/lib/tuneRecord';
import { adoptionProvenance, adoptionRule } from '../src/lib/evidence';
import type { GameJob, PlayGame } from '../src/lib/tournament';
import { CutTable, TuneTrajectory } from '../src/ui/components/LabEvidence';
import { GenerationSummary } from '../src/ui/pages/DeckLab';
import { allDecks, upsertCustom } from '../src/lib/browserLibrary';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const start = anyDeck('A', ['Red', 'Yellow']);
const field = [anyDeck('B', ['Blue', 'Green'])];
const changes = (d: DeckList) => {
  const left = [...start.main];
  let n = 0;
  for (const id of d.main) {
    const i = left.indexOf(id);
    if (i >= 0) left.splice(i, 1);
    else n++;
  }
  return n;
};
function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Every list wins with probability 0.5 + perChange × cards changed; `noise` of the games are a coin per list. */
const fake =
  (perChange: number, noise = 0): PlayGame =>
  async (j: GameJob) => {
    const key = j.a.main.join();
    const p = 0.5 + perChange * changes(j.a);
    const win = unit(`n:${j.seed}:${key}`) < noise ? unit(`c:${j.seed}:${key}`) < 0.5 : unit(`g:${j.seed}`) < p;
    return { seed: j.seed, first: j.first, turns: 5, reason: 'test', winner: win ? 0 : 1 };
  };
const OPTS: TuneOptions = { games: 40, gens: 3, cands: 3, bot: 'easy', minGain: 0.02, seedBase: 500_000, vsOriginal: vsOriginalGames(40) };

describe('no true gain: the per-generation score wanders, the headline does not', () => {
  it('a list that never changes shows different screening scores per generation, but the headline says it is still the original', async () => {
    // every list plays alike (no true gain); half the games are independent coins, so each generation's 40 games differ
    const end = await tuneDeck(start, field, OPTS, fake(0, 0.5), () => undefined, () => false);
    expect(end.logs).toHaveLength(3);
    expect(end.logs.every((l) => !l.adopted)).toBe(true);
    const shown = end.logs.map((l) => l.baseline);
    // the wander the owner saw: the same list scores differently on each generation's new games
    expect(new Set(shown).size).toBeGreaterThan(1);
    // ...but nothing presents it as a trend: every generation says the list is still the original, no games were spent
    for (const l of end.logs) {
      expect(l.vsOriginal).toEqual({ same: true, adopted: 0, measured: false });
      expect(trajectoryLine(l, 1)).toBe(`After generation ${l.gen}: no change adopted yet, so the list is still your original.`);
      const html = renderToStaticMarkup(<GenerationSummary log={l} />);
      expect(html).toContain('new games each generation, so not a trend');
      expect(html).not.toMatch(/baseline/i);
    }
    expect(tuneSummaryText(end.logs, { minGainPp: 1 })).toBe('After 3 generations: no change was adopted, so the result is your original list.');
    const head = renderToStaticMarkup(<TuneTrajectory logs={end.logs} minGainPp={1} games={160} finished />);
    expect(head).toContain('Your list against the original');
    expect(head).not.toMatch(/worse|declin/i);
  });

  it('a change adopted on noise (legacy rule) is compared with the original on common games, and not called an improvement', async () => {
    // the legacy any-gain rule adopts whatever scored higher once: with no true gain that is noise
    const end = await tuneDeck(start, field, { ...OPTS, minGain: -1, rule: { kind: 'any-gain' } }, fake(0, 0.5), () => undefined, () => false);
    const adoptedAt = end.logs.filter((l) => l.adopted).map((l) => l.gen);
    expect(adoptedAt.length).toBeGreaterThan(0);
    const v = finalVsOriginal(end.logs)!;
    expect(v.same).toBe(false);
    expect(v.gain!.games).toBe(160);
    expect(v.adopted).toBe(adoptedAt.length);
    const verdict = vsOriginalVerdict(v, 1)!;
    expect(verdict).not.toBe('better');
    const text = tuneSummaryText(end.logs, { minGainPp: 1 });
    expect(text).toMatch(new RegExp(`^After 3 generations: adopted ${adoptedAt.length} change`));
    expect(text).toContain('against your original list on the same held-out games');
    expect(text).toContain('your original list stays the result; the tuned list is kept below for reference.');
  });
});

describe('the vs-original comparison', () => {
  it('plays the original once and each adopted list once, on one block no screening or confirmation uses', async () => {
    const played: { seed: number; list: string }[] = [];
    const play = fake(0.1);
    const end = await tuneDeck(start, field, OPTS, async (j) => (played.push({ seed: j.seed, list: listFingerprint(j.a) }), play(j)), () => undefined, () => false);
    const adoptions = end.logs.filter((l) => l.adopted).length;
    expect(adoptions).toBeGreaterThan(0);
    const vsSeed = OPTS.seedBase! + (OPTS.gens + 1) * 10_000;
    const block = played.filter((x) => x.seed >= vsSeed);
    // the original once, then one block per adoption, all on the same seeds
    expect(block.length).toBe(160 * (1 + adoptions));
    expect(new Set(block.map((x) => x.seed)).size).toBe(160);
    expect(block.slice(0, 160).every((x) => x.list === listFingerprint(start))).toBe(true);
    // never a seed a generation used
    const gens = played.filter((x) => x.seed < vsSeed);
    expect(Math.max(...gens.map((x) => x.seed))).toBeLessThan(vsSeed);
    // the headline after the last adoption is the final list against the original
    const v = finalVsOriginal(end.logs)!;
    expect(v.measured || end.logs[end.logs.length - 1]!.adopted === null).toBe(true);
    expect(v.gain!.mean).toBeGreaterThan(0);
    expect(vsOriginalVerdict(v, 1)).toBe('better');
    expect(tuneSummaryText(end.logs, { minGainPp: 1 })).toMatch(/the tuned list is \+\d+\.\d pts \[\+\d+\.\d, \+\d+\.\d\], 160 games against your original list on the same held-out games — better \(the lower bound clears 1 point\)\.$/);
  });

  it('the summary maths: verdicts at the bar, and the budget', () => {
    const gain = (mean: number, lower: number, upper: number) => ({ same: false, gain: { mean, lower, upper, games: 448, z: 1.96 } });
    expect(vsOriginalVerdict(undefined, 1)).toBeNull();
    expect(vsOriginalVerdict({ same: true }, 1)).toBe('unchanged');
    expect(vsOriginalVerdict(gain(0.03, 0.011, 0.05), 1)).toBe('better');
    expect(vsOriginalVerdict(gain(0.02, 0.01, 0.03), 1)).toBe('unclear'); // the lower bound must clear the bar, not touch it
    expect(vsOriginalVerdict(gain(0.021, -0.004, 0.046), 1)).toBe('unclear');
    expect(vsOriginalVerdict(gain(-0.02, -0.039, -0.001), 1)).toBe('worse');
    const logs = [
      { gen: 1, adopted: 'x', vsOriginal: { same: false, adopted: 1, measured: true, gain: { mean: 0.021, lower: -0.004, upper: 0.046, games: 448, z: 1.96 } } },
      { gen: 2, adopted: null, vsOriginal: { same: false, adopted: 1, measured: false, gain: { mean: 0.021, lower: -0.004, upper: 0.046, games: 448, z: 1.96 } } },
      { gen: 3, adopted: null, vsOriginal: { same: false, adopted: 1, measured: false, gain: { mean: 0.021, lower: -0.004, upper: 0.046, games: 448, z: 1.96 } } },
    ];
    expect(tuneSummaryText(logs, { minGainPp: 1 })).toBe(
      'After 3 generations: adopted 1 change, but the tuned list is +2.1 pts [−0.4, +4.6], 448 games against your original list on the same held-out games — could not tell. It is not shown to be better, so your original list stays the result; the tuned list is kept below for reference.',
    );
    expect(trajectoryLine(logs[1]!, 1)).toBe('After generation 2: 1 change adopted (none this generation); +2.1 pts [−0.4, +4.6], 448 games against your original list (the same games for both) — could not tell.');
    expect(tuneSummaryText([{ gen: 1, adopted: 'x' }], { minGainPp: 1, partial: true })).toContain('the run ended before the tuned list was compared with your original list, so it is not shown to be better');
    // the estimate: the original once plus one block per generation at most
    const p = tunePlan({ games: 56, gens: 3, cands: 4, vsOriginal: vsOriginalGames(56) });
    expect(p.vsGames).toBe(224);
    expect(p.vsMax).toBe(224 * 4);
    expect(p.estimate.max - tunePlan({ games: 56, gens: 3, cands: 4 }).estimate.max).toBe(224 * 4);
    expect(p.estimate.min).toBe(tunePlan({ games: 56, gens: 3, cands: 4 }).estimate.min);
  });
});

describe('the Lab view and the saved record', () => {
  const v = { same: false, adopted: 1, measured: true, gain: { mean: 0.021, lower: -0.004, upper: 0.046, games: 448, z: 1.96 }, origWr: 0.45, curWr: 0.471 };
  const log: TuneLog = {
    gen: 1,
    baseline: 0.62,
    swaps: [{ label: '−1 A → +1 B', wr: 0.68, gain: { mean: 0.06, lower: 0.0, upper: 0.12, games: 112 } }],
    adopted: '−1 A → +1 B',
    adoptedGain: { mean: 0.03, lower: 0.011, upper: 0.05, games: 448, z: 2.5 },
    vsOriginal: v,
  };

  it('the headline reads the vs-original figure and says plainly that the tuned list is not shown better', () => {
    const html = renderToStaticMarkup(<TuneTrajectory logs={[log]} minGainPp={1} games={448} finished />);
    expect(html).toContain('After generation 1: 1 change adopted; +2.1 pts [−0.4, +4.6], 448 games against your original list (the same games for both) — could not tell.');
    expect(html).toContain('<span class="verdict neu">not shown better</span>');
    expect(html).toContain('your original list stays the result');
    // a generation's line puts the screening score after the decision, as screening, never as the deck's win rate
    const g = renderToStaticMarkup(<GenerationSummary log={log} />);
    expect(g.indexOf('adopted')).toBeLessThan(g.indexOf('screening games'));
    expect(g).toContain('<span class="muted"> · screening games: the list scored 62% on this generation’s 112 games (new games each generation, so not a trend)</span>');
  });

  it('the cut table explains the partner-aware ranking', () => {
    const cuts = [
      { id: 'a', name: 'Card A', plain: -0.2, score: -0.18, strand: [{ pkg: 'low-cred', pkgName: 'Behind on Street Cred', role: 'payoff' as const, before: 0.59, after: 0.44, penalty: 0.0075 }], offered: false, plainOffered: true, why: 'not offered: the package view moved it up — …' },
      { id: 'b', name: 'Card B', plain: -0.1, score: -0.1, strand: [], offered: true, plainOffered: false, why: 'offered as a cut (the package view moved it down) — Δ when drawn −10.0 pts' },
    ];
    const html = renderToStaticMarkup(<CutTable cuts={cuts} />);
    expect(html).toContain('Why these cuts (partner-aware ranking)');
    expect(html).toContain('not offered: the package view moved it up');
    expect(html).toMatch(/Card A<\/td><td class="num">−20\.0<\/td><td class="num">−18\.0<\/td><td>no<\/td>/);
  });

  it('the stored record carries what a tuned-decks page needs', () => {
    const rule = adoptionProvenance(adoptionRule(), { firstStage: 112, nominees: 1, cardsPerChange: 1, packagesPerChange: 1 });
    const final = { ...start, main: [...start.main.slice(1), field[0]!.main[0]!] };
    const r = tunedRecord({
      original: { ...start, file: 'meta-x.txt' },
      final,
      logs: [log],
      partial: false,
      gens: 3,
      rule,
      manifest: null,
      bot: 'medium',
      fieldMode: 'deck-lab-tune:meta',
      fieldDeckIds: ['f1'],
      partnerAware: true,
      date: '2026-11-12T00:00:00.000Z',
    });
    expect(r).toEqual({
      kind: 'deck-lab-tune',
      schema: 1,
      date: '2026-11-12T00:00:00.000Z',
      original: { name: 'A', file: 'meta-x.txt', listId: listFingerprint(start) },
      final: { listId: listFingerprint(final) },
      partial: false,
      generations: { planned: 3, run: 1 },
      changes: [{ gen: 1, label: '−1 A → +1 B', heldOut: { mean: 0.03, lower: 0.011, upper: 0.05, games: 448, z: 2.5 } }],
      vsOriginal: { verdict: 'unclear', gain: { mean: 0.021, lower: -0.004, upper: 0.046, games: 448, z: 1.96 }, origWr: 0.45, finalWr: 0.471, minGainPp: 1 },
      rule,
      field: { mode: 'deck-lab-tune:meta', deckIds: ['f1'] },
      bot: 'medium',
      partnerAware: true,
      runId: null,
    });
    expect(isTunedRecord(JSON.parse(JSON.stringify(r)))).toBe(true);
    expect(isTunedRecord({ ...r, kind: 'other' })).toBe(false);
    expect(manifestTune(r)).toEqual({ originalListId: r.original.listId, finalListId: r.final.listId, adopted: 1, vsOriginal: r.vsOriginal });
    // it survives the browser store (StoredDeck.tuned) and comes back on the library entry
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, x: string) => void m.set(k, String(x)), removeItem: (k: string) => void m.delete(k) });
    expect(upsertCustom({ ...final, name: 'A (tuned, not shown better)', tuned: r })).toBe(true);
    expect(allDecks().find((d) => d.deck.name === 'A (tuned, not shown better)')?.tuned).toEqual(r);
  });
  afterEach(() => vi.unstubAllGlobals());
});
