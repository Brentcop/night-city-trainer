// The Deck Lab tuner with earlier held-out games (TuneOptions.ledger; docs/SYNERGIES.md "Pooling held-out games across
// runs"): it records every screening and held-out game as the forge does, judges a nominee that has held-out games from
// an earlier run on them and the new ones pooled, does not nominate a change its earlier games already reject, never
// pools under any-gain, records only whole confirmation stages, and without a ledger plays and logs exactly as before
// (pinned on hashes taken from the code before the ledger existed).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { listFingerprint } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { analyzeDeck } from '../src/analysis/analyze';
import { candidateSwaps, tuneDeck, type TuneOptions, type TuneProgress } from '../src/lib/deckLab';
import { SIM_VERSION, type GameJob, type PlayGame } from '../src/lib/tournament';
import { changeKey, fieldFingerprint } from '../src/lib/changeLedger';
import { ChangeLedgerRun } from '../src/lib/changeLedgerRun';
import { BrowserLedgerStore, memoryLedgerStorage } from '../src/lib/changeLedgerStore';

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
/** A paired fake game: the same uniform number per game for every list; a win below 50% + perChange per changed card; `noise` of the games are a coin per list. */
const fake =
  (perChange: number, noise = 0): PlayGame =>
  async (j: GameJob) => {
    const key = j.a.main.join();
    const p = 0.5 + perChange * changes(j.a);
    const u = unit(`g:${j.seed}:${j.b.name}:${j.first}`);
    const win = unit(`n:${j.seed}:${key}`) < noise ? unit(`c:${j.seed}:${key}`) < 0.5 : u < p;
    return { seed: j.seed, first: j.first, turns: 5, reason: 'test', winner: win ? 0 : 1 };
  };
const run = (o: TuneOptions, play: PlayGame, stop: () => boolean = () => false, onProgress: (p: TuneProgress) => void = () => undefined) => tuneDeck(start, field, o, play, onProgress, stop);
const hash = (end: TuneProgress) => createHash('sha256').update(JSON.stringify({ logs: end.logs, deck: end.deck, played: end.played, total: end.total })).digest('hex').slice(0, 16);
const OPTS: TuneOptions = { games: 56, gens: 1, cands: 3, bot: 'easy', minGain: 0.02, seedBase: 500_000 };
/** The change the fake's ties put first: every one-card swap scores alike, so the screening keeps the candidates' order. */
const SWAPS = candidateSwaps(start, analyzeDeck('A', []), 3);
const newStore = () => new BrowserLedgerStore(memoryLedgerStorage());
const entryOf = (cand: DeckList, bot = 'easy') => ({ change: changeKey(start, cand), simVersion: SIM_VERSION, bot, field: fieldFingerprint(OPP) });

describe('without a ledger the tuner is unchanged', () => {
  // hashes taken from src/lib/deckLab.ts before the ledger existed (the same fake games and options). Re-taken on 2026-11-24
  // when src/data/impact.json became the breeder's (9, hard) table (REVIEW_2026-11-24 B.2): the tuner's candidates read it, and
  // the same code with the old table still gave the old hashes (702275e885a067ca, 6fd09f3881e93bfe, 117279e0cb5559bb,
  // eb15cc612a9459b7), so the move is the table's
  const CASES: [string, TuneOptions, PlayGame, string][] = [
    ['adopt', { games: 56, gens: 2, cands: 3, bot: 'medium', minGain: 0.02, seedBase: 500_000, vsOriginal: 224, partnerAware: true }, fake(0.08), 'bb93eeac290dff64'],
    ['noisy', { games: 40, gens: 1, cands: 3, bot: 'medium', minGain: -1, seedBase: 500_100 }, fake(0, 0.9), '26f0f0788f459a62'],
    ['any-gain', { games: 40, gens: 1, cands: 3, bot: 'medium', minGain: -1, seedBase: 500_200, rule: { kind: 'any-gain' } }, fake(0.01, 0.9), '308087519ae0b479'],
    ['depth', { games: 56, gens: 1, cands: 3, bot: 'medium', minGain: 0.02, seedBase: 500_300, depth: { cardsPerChange: 2, nominees: 2 } }, fake(0.06), '574f03ebd48bce66'],
  ];
  for (const [name, o, play, h] of CASES)
    it(`${name}: the same games and logs as before`, async () => {
      const end = await run(o, play);
      expect(hash(end)).toBe(h);
      expect(end.ledger).toBeUndefined();
      // a first run with an empty ledger decides the same way and logs the same (nothing to pool yet)
      const withLedger = await run({ ...o, ledger: { store: newStore(), run: 'r', date: '2026-11-14' } }, play);
      expect(withLedger.logs).toEqual(end.logs);
      expect(withLedger.played).toBe(end.played);
    });
});

describe('the tuner with earlier held-out games', () => {
  it('a first run keeps its screening and held-out games; a repeat decides the same way and adds nothing', async () => {
    const store = newStore();
    const o: TuneOptions = { ...OPTS, ledger: { store, run: 'first', date: '2026-11-14' } };
    const end = await run(o, fake(0.15));
    const l = end.logs[0]!;
    expect(l.adopted).toBe(SWAPS[0]!.label);
    // two stages of 112: the first is under the 200-game floor
    expect(l.nominees![0]).toMatchObject({ outcome: 'adopt', heldOut: { games: 224, looks: 2 } });
    expect(l.nominees![0]!.heldOut!.priorGames).toBeUndefined();
    // 3 swaps × 56 screening games; the one nominee's 224 held-out games
    expect(end.ledger!.screen.written).toBe(3 * 56);
    expect(end.ledger!.heldout.written).toBe(224);
    expect(await store.counts(SIM_VERSION)).toMatchObject({ heldout: 224, screen: 168, changes: 3 });
    await store.load(listFingerprint(start));
    expect(store.entry(entryOf(SWAPS[0]!.deck))!.heldout.map((g) => g.seed)).toEqual(Array.from({ length: 224 }, (_, i) => 515_000 + i));
    // the same run again: its own games are left out of the prior, so it decides alike and every game is already held
    const again = await run(o, fake(0.15));
    expect(again.logs).toEqual(end.logs);
    expect(again.ledger).toMatchObject({ screen: { written: 0, duplicates: 168 }, heldout: { written: 0, duplicates: 224 } });
  });

  it('a later run that nominates the same change is decided on the pooled games and says how many came from earlier runs', async () => {
    const store = newStore();
    // the first run's single stage of 112 games is under the 200-game floor: could not tell
    const first = await run({ ...OPTS, rule: { capStages: 1 }, ledger: { store } }, fake(0.15));
    expect(first.logs[0]!.nominees![0]).toMatchObject({ outcome: 'inconclusive', heldOut: { games: 112 } });
    const played: number[] = [];
    const play = fake(0.15);
    const second = await run({ ...OPTS, seedBase: 501_000, ledger: { store } }, async (j) => (played.push(j.seed), play(j)));
    const l = second.logs[0]!;
    const n = l.nominees![0]!;
    expect(n.label).toBe(SWAPS[0]!.label);
    // the earlier 112 alone are under the floor; one new stage of 112 makes 224 pooled games, which adopt it
    expect(n).toMatchObject({ outcome: 'adopt', heldOut: { games: 224, looks: 1, priorGames: 112 } });
    expect(l.confirm).toMatchObject({ outcome: 'adopt', priorGames: 112 });
    expect(l.adoptedPriorGames).toBe(112);
    expect(l.adoptedGain!.games).toBe(224);
    // the pooled look uses the always-valid boundary, not the staged z
    expect(l.adoptedGain!.z).toBeGreaterThan(3);
    // new games: one confirmation stage only
    expect(played.filter((s) => s >= 516_000 && s < 517_000)).toHaveLength(2 * 112);
    expect(second.ledger!.heldout.written).toBe(112);
  });

  it('a change whose earlier held-out games alone settle it plays no new confirmation game', async () => {
    const store = newStore();
    await run({ ...OPTS, ledger: { store } }, fake(0.15));
    const second = await run({ ...OPTS, seedBase: 501_000, ledger: { store } }, fake(0.15));
    const n = second.logs[0]!.nominees![0]!;
    expect(n).toMatchObject({ outcome: 'adopt', heldOut: { games: 224, looks: 0, priorGames: 224 } });
    expect(second.ledger!.heldout.written).toBe(0);
  });

  it('a change its earlier held-out games already reject is not nominated; the next best is', async () => {
    const store = newStore();
    await store.load(listFingerprint(start));
    // 400 earlier held-out games in which the top change lost half the games the list won
    const pre = new ChangeLedgerRun(store, { simVersion: SIM_VERSION, bot: 'easy', opponents: OPP, run: 'earlier', date: '2026-11-01' });
    pre.record(
      'heldout',
      start,
      SWAPS[0]!.deck,
      SWAPS[0]!.label,
      Array.from({ length: 400 }, (_, i) => ({ seed: 900_000 + i, opp: OPP[i % 2]!, first: (Math.floor(i / 2) % 2) as 0 | 1, base: 1, cand: i % 2 })),
    );
    await store.flush();
    const end = await run({ ...OPTS, minGain: -1, ledger: { store } }, fake(0.15));
    const l = end.logs[0]!;
    expect(l.notNominated).toHaveLength(1);
    expect(l.notNominated![0]).toMatchObject({ label: SWAPS[0]!.label, priorGames: 400, heldOut: { games: 400 } });
    expect(l.notNominated![0]!.heldOut.upper).toBeLessThan(0.01);
    expect(l.nominees!.map((x) => x.label)).toEqual([SWAPS[1]!.label]);
    expect(l.adopted).toBe(SWAPS[1]!.label);
    // the rejected change's screening games were still kept
    expect(store.entry(entryOf(SWAPS[0]!.deck))!.screen).toHaveLength(56);
    // another bot's games are another entry: a Medium run does not see the Easy games
    const medium = await run({ ...OPTS, bot: 'medium', minGain: -1, ledger: { store } }, fake(0.15));
    expect(medium.logs[0]!.notNominated).toBeUndefined();
    expect(medium.logs[0]!.nominees![0]!.label).toBe(SWAPS[0]!.label);
  });

  it('under the any-gain rule the games are recorded but never pooled', async () => {
    const store = newStore();
    await run({ ...OPTS, ledger: { store } }, fake(0.15));
    const legacy = await run({ ...OPTS, seedBase: 501_000, rule: { kind: 'any-gain' }, ledger: { store } }, fake(0.15));
    const n = legacy.logs[0]!.nominees![0]!;
    expect(n.heldOut).toMatchObject({ games: 112, looks: 1 });
    expect(n.heldOut!.priorGames).toBeUndefined();
    expect(legacy.logs[0]!.notNominated).toBeUndefined();
    expect(legacy.ledger!.heldout.written).toBe(112);
    expect((await store.counts(SIM_VERSION)).heldout).toBe(224 + 112);
  });

  it('a run cut off in the middle of a confirmation stage records only whole stages, all written', async () => {
    const storage = memoryLedgerStorage();
    const store = new BrowserLedgerStore(storage);
    const play = fake(0, 0.9);
    let calls = 0;
    // the baseline, 3 screened swaps and the first stage (2 × 112) play; the second stage fails part way, as Stop does
    const cut = 56 + 3 * 56 + 2 * 112 + 30;
    const failing: PlayGame = (j) => (++calls > cut ? Promise.reject(new Error('stopped')) : play(j));
    let last: TuneProgress | null = null;
    await expect(run({ ...OPTS, minGain: -1, ledger: { store } }, failing, () => false, (p) => (last = p))).rejects.toThrow('stopped');
    expect(last!.logs[0]!.nominees).toBeUndefined();
    const fresh = new BrowserLedgerStore(storage);
    expect(await fresh.counts(SIM_VERSION)).toMatchObject({ heldout: 112, screen: 3 * 56 });
  });

  it('refuses a bot the ledger cannot use', async () => {
    await expect(run({ ...OPTS, bot: 'hard-v1', ledger: { store: newStore() } }, fake(0.15))).rejects.toThrow(/impact\.json/);
  });
});
