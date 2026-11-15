// The shortlist from pooled evidence (src/lib/shortlist.ts; docs/SYNERGIES.md "A shortlist carried across runs"): pooled
// games and gain, each drop reason, the carried changes and their order, change keys rebuilt into lists, the candidate
// assembly, the Deck Lab tuner with it on (TuneOptions.shortlist), and the forge's flags.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { listFingerprint } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { analyzeDeck } from '../src/analysis/analyze';
import { candidateSwaps, tuneDeck, type TuneOptions, type TuneProgress } from '../src/lib/deckLab';
import { SIM_VERSION, type GameJob, type PlayGame } from '../src/lib/tournament';
import { changeKey, fieldFingerprint, gamesToSettle, mergeBatches, type LedgerBatch, type LedgerEntry, type LedgerGame } from '../src/lib/changeLedger';
import { ChangeLedgerRun } from '../src/lib/changeLedgerRun';
import { BrowserLedgerStore, memoryLedgerStorage } from '../src/lib/changeLedgerStore';
import { ADOPTION_DEFAULTS } from '../src/lib/evidence';
import {
  assembleCandidates,
  byPooledGain,
  carriedChanges,
  changeStatus,
  outOfReach,
  pooledFigure,
  pooledGain,
  pooledGames,
  rebuildSwap,
  SHORTLIST_DEFAULTS,
  shortlistOptions,
  statusOfSums,
  swapOfKey,
  type ChangeStatus,
  type ShortlistRule,
} from '../src/lib/shortlist';
import { shortlistArgs, shortlistProblem } from '../scripts/evidence-flags';
import { ROWS, simulate } from '../scripts/shortlist-sim';
import { SHORTLIST_LINE } from '../src/ui/components/LabHeldOut';
import { shortlistLines, notNominatedText } from '../src/ui/components/LabEvidence';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const start = anyDeck('A', ['Red', 'Yellow']);
const field = [anyDeck('B', ['Blue', 'Green']), anyDeck('C', ['Blue', 'Red'])];
const OPP = field.map((d) => listFingerprint(d));
/** The generator's whole order on this list (no telemetry: format-wide impact only, so every run offers the same). */
const PICKS = candidateSwaps(start, analyzeDeck('A', []), Infinity);
const keyOf = (d: DeckList) => changeKey(start, d);
const entryId = (d: DeckList, bot = 'easy') => ({ change: keyOf(d), simVersion: SIM_VERSION, bot, field: fieldFingerprint(OPP) });

const RULE: ShortlistRule = { rule: ADOPTION_DEFAULTS, nominees: 1, minGainPp: ADOPTION_DEFAULTS.minGainPp, nominateBar: 0.02, shortlist: SHORTLIST_DEFAULTS };
/** n games whose paired difference is +1 in `plus` of them, −1 in `minus`, 0 otherwise, from seed `seed0` */
function games(seed0: number, n: number, plus: number, minus = 0): LedgerGame[] {
  return Array.from({ length: n }, (_, i) => ({ seed: seed0 + i, opp: OPP[i % 2]!, first: (Math.floor(i / 2) % 2) as 0 | 1, base: i < plus ? 0 : i < plus + minus ? 1 : 0.5, cand: i < plus ? 1 : i < plus + minus ? 0 : 0.5 }));
}
function entryWith(d: DeckList, o: { screen?: LedgerGame[]; heldout?: LedgerGame[] }): LedgerEntry {
  const b = (kind: 'screen' | 'heldout', g: LedgerGame[]): LedgerBatch => ({ entry: entryId(d), kind, label: 'x', run: 'r', date: '2026-11-14', games: g });
  // held-out first: a held-out batch after a screening batch of the same game would be left out (never evidence)
  const batches = [...(o.heldout ? [b('heldout', o.heldout)] : []), ...(o.screen ? [b('screen', o.screen)] : [])];
  return [...mergeBatches(batches).values()][0]!;
}

describe('pooled games and gain', () => {
  it('counts a game once when it is both a screening and a held-out game', () => {
    const shared = games(1000, 10, 4);
    // the held-out batch arrives first (an earlier run), then the same games as screening (a later run's overlapping seeds)
    const e = entryWith(PICKS[0]!.deck, { heldout: shared, screen: [...shared, ...games(2000, 6, 0, 3)] });
    expect(e.heldout).toHaveLength(10);
    expect(e.screen).toHaveLength(16);
    expect(pooledGames(e)).toHaveLength(16);
    expect(pooledGames(undefined)).toEqual([]);
  });

  it('pooled gain is the mean per-game difference with the plain standard error', () => {
    const g = games(0, 100, 30, 10);
    const ds = g.map((x) => x.cand - x.base);
    const mean = ds.reduce((a, b) => a + b, 0) / 100;
    const sd = Math.sqrt(ds.reduce((a, b) => a + (b - mean) ** 2, 0) / 99);
    const p = pooledGain(g);
    expect(p.games).toBe(100);
    expect(p.mean).toBeCloseTo(0.2, 12);
    expect(p.se).toBeCloseTo(sd / 10, 12);
    expect(pooledGain([]).se).toBe(Infinity);
    expect(pooledGain(games(0, 1, 1)).se).toBe(Infinity);
  });
});

describe('the status of a change', () => {
  const d = PICKS[0]!.deck;
  it('untested without games; live when nothing drops it', () => {
    expect(changeStatus(undefined, RULE)).toEqual({ kind: 'untested' });
    const s = changeStatus(entryWith(d, { screen: games(0, 112, 12) }), RULE);
    expect(s).toMatchObject({ kind: 'live', heldout: 0, gain: { games: 112 } });
  });

  it('(a) dropped when pooled gain + 0.5 standard errors is under the nomination bar', () => {
    // mean 0, SE about 0.042 over 112 games: 0 + 0.5·0.042 ≈ 0.021 ≥ 0.02 is live; a mean of −0.01 is not
    const zero = entryWith(d, { screen: games(0, 112, 11, 11) });
    expect(pooledGain(pooledGames(zero)).mean).toBe(0);
    const se = pooledGain(pooledGames(zero)).se;
    expect(se * 0.5).toBeGreaterThan(0.02);
    expect(changeStatus(zero, RULE).kind).toBe('live');
    const low = entryWith(d, { screen: games(0, 112, 3, 6) });
    expect(changeStatus(low, RULE)).toMatchObject({ kind: 'dropped', why: 'below-bar' });
    // a stricter drop (0 SE) drops the mean-0 change too
    expect(changeStatus(zero, { ...RULE, shortlist: { ...SHORTLIST_DEFAULTS, dropSe: 0 } })).toMatchObject({ kind: 'dropped', why: 'below-bar' });
  });

  it('(b) dropped when its held-out games alone are rejected by the strict rule', () => {
    const e = entryWith(d, { screen: games(0, 56, 20), heldout: games(10_000, 600, 0, 120) });
    expect(changeStatus(e, RULE)).toMatchObject({ kind: 'dropped', why: 'rejected', heldout: 600 });
  });

  it('(c) dropped when it would need more than the reach in held-out games; not when they already adopt it', () => {
    // +2 points over 224 held-out games with SD about 0.33: about 6,000 games to settle at the always-valid z
    const e = entryWith(d, { screen: games(0, 112, 20), heldout: games(10_000, 224, 15, 11) });
    const need = gamesToSettle(e.heldout, ADOPTION_DEFAULTS);
    expect(need).toBeGreaterThan(4_500);
    expect(Number.isFinite(need)).toBe(true);
    // it needs more than the shipped reach (and more than a reach of 4,500)
    expect(need).toBeGreaterThan(SHORTLIST_DEFAULTS.reach);
    expect(changeStatus(e, RULE)).toMatchObject({ kind: 'dropped', why: 'out-of-reach', toSettle: need });
    expect(changeStatus(e, { ...RULE, shortlist: { ...SHORTLIST_DEFAULTS, reach: 4_500 } })).toMatchObject({ kind: 'dropped', why: 'out-of-reach', toSettle: need });
    // the same games with a reach above what it needs: live
    expect(changeStatus(e, { ...RULE, shortlist: { ...SHORTLIST_DEFAULTS, reach: need } }).kind).toBe('live');
    // a held-out mean at or under the bar never settles: out of reach
    const flat = entryWith(d, { screen: games(0, 112, 30), heldout: games(10_000, 224, 3, 2) });
    expect(changeStatus(flat, RULE)).toMatchObject({ kind: 'dropped', why: 'out-of-reach', toSettle: Infinity });
    // held-out games that already adopt it (here 6,000 games at +5 points) are never out of reach, even past the reach
    const big = entryWith(d, { heldout: games(10_000, 6_000, 600, 300) });
    expect(gamesToSettle(big.heldout, ADOPTION_DEFAULTS)).toBe(6_000);
    expect(changeStatus(big, RULE).kind).toBe('live');
    expect(outOfReach({ base: big.heldout.map((g) => g.base), cand: big.heldout.map((g) => g.cand) }, { ...RULE, reach: 4_500 })).toEqual({ out: false, toSettle: 6_000 });
  });
});

describe('change keys rebuilt into lists', () => {
  it('a one-card swap key gives back the generator’s list, and the list gives back the key', () => {
    for (const p of PICKS.slice(0, 6)) {
      const key = keyOf(p.deck);
      const s = swapOfKey(key)!;
      expect(s.base).toBe(listFingerprint(start));
      const d = rebuildSwap(start, key)!;
      expect(d.main).toEqual(p.deck.main);
      expect(changeKey(start, d)).toBe(key);
    }
  });

  it('is null when the change no longer applies or breaks the plan', () => {
    const p = PICKS[0]!;
    const key = keyOf(p.deck);
    const cut = swapOfKey(key)!.cut;
    // another base list (the cut is gone): the key names another list, and no list without the cut can take it
    const other = { ...start, main: start.main.map((id) => (id === cut ? p.deck.main.find((x) => !start.main.includes(x))! : id)) };
    expect(rebuildSwap(other, key)).toBeNull();
    // the plan locks the cut card
    expect(rebuildSwap(start, key, { lockCards: { [cut]: 3 } })).toBeNull();
    // not a one-card swap: two cards, or a Legend
    const two = changeKey(start, { ...start, main: [...PICKS[1]!.deck.main.slice(0, 39), PICKS[2]!.deck.main.find((x) => !start.main.includes(x))!] });
    expect(swapOfKey(two)).toBeNull();
    expect(swapOfKey(`${listFingerprint(start)} -legend:a +legend:b`)).toBeNull();
    // an add that makes the list illegal (a fourth copy)
    const three = start.main.find((x) => x !== cut && start.main.filter((y) => y === x).length === 3)!;
    const fourth = `${listFingerprint(start)} -main:${cut} +main:${three}`;
    expect(rebuildSwap(start, fourth)).toBeNull();
  });
});

describe('the carried changes', () => {
  const live = (i: number, plus: number) => entryWith(PICKS[i]!.deck, { screen: games(0, 112, plus) });
  it('the best live ones by pooled gain, at most `carry`, in a fixed order', () => {
    const entries = [live(0, 10), live(1, 30), live(2, 20), entryWith(PICKS[3]!.deck, { screen: games(0, 112, 0, 20) })];
    const c = carriedChanges(entries, start, {}, RULE);
    expect(c.map((x) => x.key)).toEqual([keyOf(PICKS[1]!.deck), keyOf(PICKS[2]!.deck)]);
    expect(c[0]!.deck.main).toEqual(PICKS[1]!.deck.main);
    expect(c[0]!.gain.mean).toBeCloseTo(30 / 112, 12);
    // the same entries in another order give the same answer; ties go by change key
    expect(carriedChanges([...entries].reverse(), start, {}, RULE)).toEqual(c);
    const tie = carriedChanges([live(4, 10), live(5, 10), live(6, 10)], start, {}, RULE);
    expect(tie.map((x) => x.key)).toEqual([keyOf(PICKS[4]!.deck), keyOf(PICKS[5]!.deck), keyOf(PICKS[6]!.deck)].sort().slice(0, 2));
    expect(carriedChanges(entries, start, {}, { ...RULE, shortlist: shortlistOptions({ carry: 3 }) })).toHaveLength(3);
    expect(carriedChanges(entries, start, {}, { ...RULE, shortlist: shortlistOptions({ carry: 0 }) })).toEqual([]);
  });

  it('a swap that no longer applies or breaks the plan is not carried', () => {
    const entries = [live(0, 30), live(1, 20), live(2, 10)];
    const cut0 = swapOfKey(keyOf(PICKS[0]!.deck))!.cut;
    const plan = { lockCards: { [cut0]: 3 } };
    const c = carriedChanges(entries, start, plan, RULE);
    expect(c.map((x) => x.key)).not.toContain(keyOf(PICKS[0]!.deck));
    expect(c).toHaveLength(Math.min(2, entries.filter((e) => rebuildSwap(start, e.id.change, plan)).length));
  });
});

describe('assembling a generation’s candidates', () => {
  const status = (dropped: Record<string, ChangeStatus>) => (key: string): ChangeStatus => dropped[key] ?? { kind: 'untested' };
  const id = (x: string) => x;
  const dropped: ChangeStatus = { kind: 'dropped', why: 'below-bar', gain: { games: 112, mean: -0.05, se: 0.03 }, heldout: 0 };
  it('carried first; carried and dropped picks skipped; filled from the generator’s order', () => {
    const a = assembleCandidates(['c1', 'c2'], ['p1', 'c2', 'p2', 'p3', 'p4', 'p5'], { cands: 5, keyOf: id, statusOf: status({ p2: dropped }) });
    expect(a.candidates).toEqual(['c1', 'c2', 'p1', 'p3', 'p4']);
    expect(a.skipped.map((s) => [s.key, s.why])).toEqual([
      ['c2', 'carried'],
      ['p2', 'below-bar'],
    ]);
    expect(a.short).toBe(0);
  });
  it('fewer candidates when the generator runs out, and says how many fewer', () => {
    const a = assembleCandidates(['c1'], ['p1', 'p2', 'c1'], { cands: 5, keyOf: id, statusOf: status({ p2: dropped }) });
    expect(a.candidates).toEqual(['c1', 'p1']);
    expect(a.short).toBe(3);
  });
  it('carried changes count toward the candidates, never past them', () => {
    expect(assembleCandidates(['c1', 'c2'], ['p1'], { cands: 1, keyOf: id, statusOf: status({}) }).candidates).toEqual(['c1']);
  });
  it('nomination order by pooled gain: a change without earlier games keeps its own figure exactly', () => {
    const e = entryWith(PICKS[0]!.deck, { screen: games(0, 56, 5) });
    const own = { ids: new Set(e.screen.map((g) => `${g.seed}:${g.opp}:${g.first}`)), gain: 0.0893, games: 56 };
    expect(pooledFigure(e, own)).toEqual({ gain: 0.0893, games: 56, earlier: 0 });
    const more = entryWith(PICKS[0]!.deck, { screen: [...games(0, 56, 5), ...games(5000, 56, 25)], heldout: games(9000, 112, 0) });
    expect(pooledFigure(more, own)).toEqual({ gain: 30 / 224, games: 224, earlier: 168 });
    const figs = new Map([
      ['a', { gain: 0.05, games: 1, earlier: 0 }],
      ['b', { gain: 0.09, games: 1, earlier: 1 }],
      ['c', { gain: 0.05, games: 1, earlier: 0 }],
    ]);
    expect(byPooledGain(['a', 'b', 'c'], (x) => figs.get(x)!)).toEqual(['b', 'a', 'c']);
  });
});

// ---------------------------------------------------------------- the tuner

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
/**
 * Paired fake games where each change has its own effect: a win below 0.5 + effect, on one uniform number per game
 * shared by every list. `effect(i, era)`: the effect of PICKS[i] in era 'a' (seeds below 520,000: the first run) or 'b'.
 */
const fake =
  (effect: (i: number, era: 'a' | 'b') => number): PlayGame =>
  async (j: GameJob) => {
    const i = PICKS.findIndex((p) => p.deck.main.join() === j.a.main.join());
    const eff = i < 0 ? 0 : effect(i, j.seed < 520_000 ? 'a' : 'b');
    const u = unit(`g:${j.seed}:${j.b.name}:${j.first}`);
    return { seed: j.seed, first: j.first, turns: 5, reason: 'test', winner: u < 0.5 + eff ? 0 : 1 };
  };
const OPTS: TuneOptions = { games: 56, gens: 1, cands: 5, bot: 'easy', minGain: 0.02, seedBase: 500_000, rule: { capStages: 1 } };
const run = (o: TuneOptions, play: PlayGame) => tuneDeck(start, field, o, play, () => undefined, () => false);
const label = (i: number) => PICKS[i]!.label;
const screenedLabels = (p: TuneProgress) => p.logs[0]!.swaps.map((s) => s.label);

describe('the tuner with the shortlist', () => {
  // the first run's picks 0 and 1 gain, picks 2–4 lose; later picks are small gains
  const eff = (i: number) => (i === 0 ? 0.12 : i === 1 ? 0.08 : i <= 4 ? -0.12 : 0.01);

  it('a second run screens the first run’s two most promising changes again and three new ones', async () => {
    const store = new BrowserLedgerStore(memoryLedgerStorage());
    const first = await run({ ...OPTS, ledger: { store, run: 'one', date: '2026-11-14' }, shortlist: {} }, fake(eff));
    // an empty store: the generator's first five, nothing carried or skipped
    expect(screenedLabels(first).sort()).toEqual([0, 1, 2, 3, 4].map(label).sort());
    expect(first.logs[0]!.shortlist).toEqual({ carried: [], skipped: [], short: 0 });
    // its nominee (one stage of 112 is under the 200-game floor) could not be told: it stays open
    expect(first.logs[0]!.nominees![0]).toMatchObject({ label: label(0), outcome: 'inconclusive' });
    const second = await run({ ...OPTS, seedBase: 520_000, ledger: { store, run: 'two', date: '2026-11-15' }, shortlist: {} }, fake(eff));
    const l = second.logs[0]!;
    expect(l.shortlist!.carried.map((c) => c.label)).toEqual([label(0), label(1)]);
    expect(l.shortlist!.carried[0]).toMatchObject({ games: 56 + 112, heldout: 112 });
    expect(l.shortlist!.skipped.map((s) => [s.label, s.why])).toEqual([
      [label(0), 'carried'],
      [label(1), 'carried'],
      [label(2), 'below-bar'],
      [label(3), 'below-bar'],
      [label(4), 'below-bar'],
    ]);
    expect(screenedLabels(second).sort()).toEqual([0, 1, 5, 6, 7].map(label).sort());
    // the carried changes show their pooled gain beside this run's
    const s0 = l.swaps.find((s) => s.label === label(0))!;
    expect(s0.pooled).toMatchObject({ games: 56 + 112 + 56, earlier: 168 });
    expect(l.swaps.find((s) => s.label === label(5))!.pooled).toBeUndefined();
    // the words the Lab shows
    const words = shortlistLines(l.shortlist!, { nominateBar: 0.02, cands: 5 });
    expect(words[0]).toMatch(/^Tested again from earlier runs: .+, \+\d+\.\d pts over 168 games \(112 held-out\) so far\.$/);
    expect(words.join(' ')).toMatch(/Skipped .+: earlier games put it under the \+2\.0 pts nomination bar: −\d+\.\d pts over 56 games, more than 0\.5 standard errors below\./);
    expect(words.join(' ')).not.toMatch(/ledger/i);
    // the same store state, seeds and options make the same candidates and decisions
    const store2 = new BrowserLedgerStore(memoryLedgerStorage());
    await run({ ...OPTS, ledger: { store: store2, run: 'one', date: '2026-11-14' }, shortlist: {} }, fake(eff));
    const again = await run({ ...OPTS, seedBase: 520_000, ledger: { store: store2, run: 'two', date: '2026-11-15' }, shortlist: {} }, fake(eff));
    expect(again.logs).toEqual(second.logs);
  });

  it('nomination follows the pooled gain, not the run’s own best', async () => {
    // pick 0 gained in the first run (screened and confirmed there) but shows nothing on the second run's games; pick 5 is
    // the second run's own best. Pooled, pick 0 is still ahead (about +9 against +6), so it is the nominee.
    const e = (i: number, era: 'a' | 'b') => (i === 0 ? (era === 'a' ? 0.12 : 0) : i === 1 ? 0.04 : i === 5 ? 0.06 : i <= 4 ? -0.12 : 0);
    const store = new BrowserLedgerStore(memoryLedgerStorage());
    await run({ ...OPTS, ledger: { store }, shortlist: {} }, fake(e));
    const second = await run({ ...OPTS, seedBase: 520_000, ledger: { store }, shortlist: {} }, fake(e));
    const l = second.logs[0]!;
    const own = (i: number) => l.swaps.find((s) => s.label === label(i))!;
    expect(own(5).wr).toBeGreaterThan(own(0).wr);
    expect(own(0).pooled!.mean).toBeGreaterThan(own(5).wr - l.baseline);
    expect(l.nominees![0]!.label).toBe(label(0));
    // without the shortlist the same store and seeds screen the generator's first five again and nominate this run's best
    // of them (pick 1), not pick 0, which shows nothing on this run's games
    const store2 = new BrowserLedgerStore(memoryLedgerStorage());
    await run({ ...OPTS, ledger: { store: store2 } }, fake(e));
    const plain = await run({ ...OPTS, seedBase: 520_000, ledger: { store: store2 } }, fake(e));
    expect(plain.logs[0]!.nominees![0]!.label).toBe(label(1));
  });

  /** 448 earlier held-out games at about +1.6 points: not rejected, but about 28,000 games from settling */
  const FAR = () => games(900_000, 448, 25, 18);
  const recordHeldout = async (store: BrowserLedgerStore, i: number, g: LedgerGame[]) => {
    await store.load(listFingerprint(start));
    new ChangeLedgerRun(store, { simVersion: SIM_VERSION, bot: 'easy', opponents: OPP, run: 'earlier', date: '2026-11-01' }).record('heldout', start, PICKS[i]!.deck, label(i), g);
    await store.flush();
  };

  it('a pick its earlier held-out games put out of reach is skipped, never screened; with a wider reach it is screened', async () => {
    expect(gamesToSettle(FAR(), ADOPTION_DEFAULTS)).toBeGreaterThan(20_000);
    const store = new BrowserLedgerStore(memoryLedgerStorage());
    await recordHeldout(store, 0, FAR());
    const play = fake((i) => (i === 0 ? 0.12 : -0.05));
    const l = (await run({ ...OPTS, seedBase: 520_000, ledger: { store }, shortlist: {} }, play)).logs[0]!;
    expect(l.shortlist!.skipped[0]).toMatchObject({ label: label(0), why: 'out-of-reach', heldout: 448 });
    expect(l.shortlist!.skipped[0]!.toSettle).toBeGreaterThan(20_000);
    expect(l.swaps.map((s) => s.label)).not.toContain(label(0));
    expect(l.shortlist!.carried).toEqual([]);
    // a reach past what it needs: live, so carried (it has pooled games) and screened
    const wide = (await run({ ...OPTS, seedBase: 520_000, ledger: { store }, shortlist: { reach: 100_000 } }, play)).logs[0]!;
    expect(wide.shortlist!.carried.map((c) => c.label)).toEqual([label(0)]);
    expect(wide.swaps.map((s) => s.label)).toContain(label(0));
  });

  it('the nomination check refuses a screened change whose earlier held-out games alone are out of reach', async () => {
    // pick 0 holds the far games plus 112 strong ones at exactly this run's confirmation seeds: with them it is live (and
    // carried), but the confirmation's prior leaves out the games it may play, and what is left is out of reach
    const store = new BrowserLedgerStore(memoryLedgerStorage());
    await recordHeldout(store, 0, [...FAR(), ...games(535_000, 112, 100)]);
    const l = (await run({ ...OPTS, seedBase: 520_000, ledger: { store }, shortlist: {} }, fake((i) => (i === 0 ? 0.12 : i === 1 ? 0.06 : -0.05)))).logs[0]!;
    expect(l.shortlist!.carried.map((c) => c.label)).toEqual([label(0)]);
    expect(l.notNominated).toHaveLength(1);
    expect(l.notNominated![0]).toMatchObject({ label: label(0), why: 'out-of-reach', priorGames: 448, reach: SHORTLIST_DEFAULTS.reach });
    expect(l.notNominated![0]!.toSettle).toBeGreaterThan(20_000);
    // the next best takes its place
    expect(l.nominees![0]!.label).toBe(label(1));
    const x = notNominatedText(l.notNominated![0]!);
    expect(x).toMatch(/its 448 earlier held-out games show \+1\.6 pts over 448 games, and at that gain it would need about [\d,]+ held-out games in all to be adopted, more than the 10,000 a change is given\.$/);
    expect(x).not.toMatch(/ledger/i);
  });

  it('without the option the tuner screens and nominates as before; on an empty store the option changes only the note', async () => {
    const eff = (i: number) => (i === 0 ? 0.12 : i === 1 ? 0.08 : i <= 4 ? -0.12 : 0.01);
    const s1 = new BrowserLedgerStore(memoryLedgerStorage());
    const s2 = new BrowserLedgerStore(memoryLedgerStorage());
    const plain = await run({ ...OPTS, ledger: { store: s1, run: 'r', date: '2026-11-14' } }, fake(eff));
    const short = await run({ ...OPTS, ledger: { store: s2, run: 'r', date: '2026-11-14' }, shortlist: {} }, fake(eff));
    expect(plain.logs[0]!.shortlist).toBeUndefined();
    expect(plain.logs[0]!.swaps.some((s) => 'pooled' in s)).toBe(false);
    expect(screenedLabels(plain).sort()).toEqual(candidateSwaps(start, analyzeDeck('A', []), 5).map((s) => s.label).sort());
    expect(short.logs.map(({ shortlist, ...rest }) => (expect(shortlist).toEqual({ carried: [], skipped: [], short: 0 }), rest))).toEqual(plain.logs);
    expect(short.played).toBe(plain.played);
    // a second run without the option on the first run's store: no carried changes, no pooled figures, today's picks
    const again = await run({ ...OPTS, seedBase: 520_000, ledger: { store: s1 } }, fake(eff));
    expect(again.logs[0]!.shortlist).toBeUndefined();
    expect(screenedLabels(again).sort()).toEqual(screenedLabels(plain).sort());
  });

  it('refuses the option without earlier held-out games or under any-gain', async () => {
    await expect(run({ ...OPTS, shortlist: {} }, fake(() => 0))).rejects.toThrow(/needs earlier held-out games/);
    await expect(run({ ...OPTS, rule: { kind: 'any-gain' }, ledger: { store: new BrowserLedgerStore(memoryLedgerStorage()) }, shortlist: {} }, fake(() => 0))).rejects.toThrow(/evidence rule/);
  });

  it('the Lab says what the checkbox also does, in one sentence without "ledger"', () => {
    expect(SHORTLIST_DEFAULTS.carry).toBe(2);
    expect(SHORTLIST_LINE).toMatch(/two most promising changes from earlier runs/);
    expect(SHORTLIST_LINE).not.toMatch(/ledger/i);
  });
});

describe('the simulation (scripts/shortlist-sim.ts)', () => {
  it('is seeded: the same command gives the same numbers; its status is the library’s', () => {
    const o = { lives: 40, runs: 4, pool: 20, seed: 3 };
    for (const row of ROWS.slice(0, 3)) expect(simulate(row.p, o)).toEqual(simulate(row.p, o));
    expect(simulate(ROWS[0]!.p, o)).not.toEqual(simulate(ROWS[0]!.p, { ...o, seed: 4 }));
    // the shipped row uses the shipped defaults
    expect(ROWS[2]!.p.shortlist).toEqual({ ...SHORTLIST_DEFAULTS });
    // statusOfSums is what changeStatus decides on a real entry
    const e = entryWith(PICKS[0]!.deck, { screen: games(0, 112, 20), heldout: games(10_000, 224, 15, 11) });
    const sums = (g: LedgerGame[]) => ({ n: g.length, sum: g.reduce((a, x) => a + x.cand - x.base, 0), sq: g.reduce((a, x) => a + (x.cand - x.base) ** 2, 0) });
    expect(statusOfSums(sums(pooledGames(e)), sums(e.heldout), RULE)).toEqual(changeStatus(e, RULE));
  });
});

describe('the forge’s flags', () => {
  it('--pooled-ranking needs --ledger and the evidence rule; --carry and --reach need --pooled-ranking', () => {
    const ev = { kind: 'evidence' as const };
    expect(shortlistProblem({}, { ledger: false, rule: ev })).toBeNull();
    expect(shortlistProblem({ 'pooled-ranking': true }, { ledger: false, rule: ev })).toMatch(/needs --ledger/);
    expect(shortlistProblem({ 'pooled-ranking': true }, { ledger: true, rule: { kind: 'any-gain' } })).toMatch(/evidence rule/);
    expect(shortlistProblem({ carry: 3 }, { ledger: true, rule: ev })).toBe('--carry needs --pooled-ranking');
    // --reach is also "until settled"'s (P4), so it names both
    expect(shortlistProblem({ carry: 3, reach: 9 }, { ledger: true, rule: ev })).toBe('--carry needs --pooled-ranking; --reach needs --pooled-ranking or --until-settled');
    expect(shortlistProblem({ 'pooled-ranking': true, carry: 3 }, { ledger: true, rule: ev })).toBeNull();
    expect(shortlistArgs({})).toEqual([]);
    expect(shortlistArgs({ 'pooled-ranking': true })).toEqual(['--pooled-ranking']);
    expect(shortlistArgs({ 'pooled-ranking': true, carry: 3, reach: 9000 })).toEqual(['--pooled-ranking', '--carry', '3', '--reach', '9000']);
  });

  it('the forge exits 2 on --pooled-ranking without --ledger', () => {
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/forge.ts', 's2-05', '--pooled-ranking'], { encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--pooled-ranking needs --ledger/);
  }, 60_000);
});
