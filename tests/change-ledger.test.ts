// The change ledger (src/lib/changeLedger.ts, scripts/ledger-store.ts) and the strict pooling rule in confirmStaged
// (src/lib/evidence.ts; docs/SYNERGIES.md "Pooling held-out games across runs").
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addBatch,
  changeBase,
  changeKey,
  decodeBatch,
  encodeBatch,
  entryKey,
  fieldFingerprint,
  gameIds,
  gamesToSettle,
  ledgerBot,
  ledgerExport,
  ledgerVerdict,
  mergeBatches,
  parseBatchLine,
  parseLedgerExport,
  pool,
  POOL_RHO,
  priorOf,
  screenedBefore,
  summarize,
  batchLine,
  type EntryId,
  type LedgerBatch,
  type LedgerGame,
} from '../src/lib/changeLedger';
import {
  ADOPTION_DEFAULTS,
  adoptionProvenance,
  adoptionRule,
  alwaysValidZ,
  confirmStaged,
  describeRule,
  guardedInterval,
  judgePooled,
  nomineeRecord,
  pairedInterval,
  pooledGainWords,
  type AdoptionRule,
  type PairedScores,
  type PlayStage,
} from '../src/lib/evidence';
import { listFingerprint } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { synthDecks } from './builder-fixtures';
import { blockSlots, LedgerStore, readLedgerDir, RunLedger, scored } from '../scripts/ledger-store';
import { ledgerArgs } from '../scripts/evidence-flags';
import { ledgerFileProblems } from '../scripts/check-data';
import { lifeTable, rng, runOnce, type Sums } from '../scripts/ledger-sim';
import { makeTierBot } from '../src/ai/tiers';
import { HeuristicAgent } from '../src/ai/heuristic';
import { BEST_PROFILES } from '../src/ai/archetype';

const [A, B] = synthDecks() as [DeckList, DeckList];
/** A with its first main-deck card swapped for the first card of B's main deck that A does not run */
const outCard = A.main[0]!;
const inCard = B.main.find((id) => !A.main.includes(id))!;
const swapped: DeckList = { ...A, main: [inCard, ...A.main.slice(1)] };

const FP16 = (s: string) => listFingerprint({ legends: [], main: [s] });
const OPP = [FP16('o1'), FP16('o2'), FP16('o3')];
const entryOf = (o: Partial<EntryId> = {}): EntryId => ({ change: changeKey(A, swapped), simVersion: 9, bot: 'medium', field: fieldFingerprint(OPP), ...o });
const game = (seed: number, base: number, cand: number, opp = OPP[seed % 3]!, first: 0 | 1 = (seed % 2) as 0 | 1): LedgerGame => ({ seed, opp, first, base, cand });
const batch = (games: LedgerGame[], o: Partial<LedgerBatch> = {}): LedgerBatch => ({ entry: entryOf(), kind: 'heldout', label: 'swap', run: 'run 1', date: '2026-11-14', games, ...o });

describe('change keys', () => {
  it('is the base list fingerprint plus the sorted cuts and adds, whatever the card order or the list name', () => {
    const k = changeKey(A, swapped);
    expect(k.startsWith(`${listFingerprint(A)} `)).toBe(true);
    expect(k).toBe(`${listFingerprint(A)} -main:${outCard} +main:${inCard}`);
    expect(changeBase(k)).toBe(listFingerprint(A));
    const shuffled = (d: DeckList): DeckList => ({ ...d, main: [...d.main].reverse(), legends: [...d.legends].reverse() });
    expect(changeKey(shuffled(A), shuffled(swapped))).toBe(k);
    const renamed: DeckList[] = [{ ...A, name: 'Renamed' }, { ...swapped, name: 'Renamed (forged)' }];
    expect(changeKey(renamed[0]!, renamed[1]!)).toBe(k);
  });

  it('the same change found as a swap or as a package move (cut, then add at the end) has the same key; repeats count', () => {
    const asMove: DeckList = { ...A, main: [...A.main.slice(1), inCard] };
    expect(changeKey(A, asMove)).toBe(changeKey(A, swapped));
    const two: DeckList = { ...A, main: [...A.main.filter((id) => id !== outCard), inCard, inCard] };
    const copies = A.main.filter((id) => id === outCard).length;
    expect(changeKey(A, two)).toContain(`-main:${Array(copies).fill(outCard).join(',')}`);
    expect(changeKey(A, two)).toContain(`+main:${inCard},${inCard}`);
    // a Legend change is named in its own section
    const legend: DeckList = { ...A, legends: [B.legends[0]!, ...A.legends.slice(1)] };
    if (!A.legends.includes(B.legends[0]!)) expect(changeKey(A, legend)).toBe(`${listFingerprint(A)} -legend:${A.legends[0]} +legend:${B.legends[0]}`);
    // nothing changed: the base alone
    expect(changeKey(A, { ...A })).toBe(listFingerprint(A));
  });

  it('the field fingerprint ignores order and keeps repeats', () => {
    expect(fieldFingerprint([...OPP].reverse())).toBe(fieldFingerprint(OPP));
    expect(fieldFingerprint([...OPP, OPP[0]!])).not.toBe(fieldFingerprint(OPP));
  });

  it('bots: the canonical name of the agent each builds; hard-v1 is refused', () => {
    expect(ledgerBot('fast').bot).toBe('easy');
    expect(ledgerBot('lookahead').bot).toBe('medium');
    expect(ledgerBot('best').bot).toBe('medium');
    for (const b of ['easy', 'medium', 'hard', 'deep', 'mixed', 'plain', 'random']) expect(ledgerBot(b).bot).toBe(b);
    expect(ledgerBot('hard-v1').problem).toMatch(/impact\.json/);
    expect(ledgerBot('nonsense').problem).toBeTruthy();
    // scripts/worker.ts builds 'best' as HeuristicAgent({ seed, noise: 0.15, profiles: BEST_PROFILES }): Medium's agent
    const best = new HeuristicAgent({ seed: 5, noise: 0.15, profiles: BEST_PROFILES });
    expect(best.opts).toEqual(makeTierBot('medium', 5).opts);
    expect(makeTierBot('fast', 5).opts).toEqual(makeTierBot('easy', 5).opts);
    expect(makeTierBot('lookahead', 5).opts).toEqual(makeTierBot('medium', 5).opts);
    expect(makeTierBot('deep', 5).opts).not.toEqual(makeTierBot('hard', 5).opts);
  });
});

describe('entries', () => {
  it('never pools another version, bot or field: merge keeps them apart and pool() refuses them', () => {
    const g = [game(1, 0, 1), game(2, 1, 1)];
    const batches = [batch(g), batch(g, { entry: entryOf({ simVersion: 8 }) }), batch(g, { entry: entryOf({ bot: 'hard' }) }), batch(g, { entry: entryOf({ field: fieldFingerprint(OPP.slice(1)) }) })];
    const m = mergeBatches(batches);
    expect(m.size).toBe(4);
    for (const e of m.values()) expect(e.heldout).toHaveLength(2);
    expect(() => pool(batches)).toThrow(/more than one entry/);
    expect(() => pool([])).toThrow();
    expect(pool([batches[0]!, batch([game(3, 0, 0)])]).heldout).toHaveLength(3);
  });

  it('keeps a game once per entry and kind; a second arrival with other scores is a conflict and the earlier is kept', () => {
    const entries = new Map();
    expect(addBatch(entries, batch([game(1, 0, 1), game(2, 1, 1)]))).toMatchObject({ duplicates: 0, conflicts: 0 });
    const again = addBatch(entries, batch([game(1, 0, 1), game(2, 0, 1), game(3, 0.5, 0.5)], { run: 'run 2' }));
    expect(again).toMatchObject({ duplicates: 1, conflicts: 1 });
    expect(again.added).toHaveLength(1);
    const e = entries.get(entryKey(entryOf()))!;
    expect(e.heldout.map((g: LedgerGame) => [g.seed, g.base, g.cand])).toEqual([[1, 0, 1], [2, 1, 1], [3, 0.5, 0.5]]);
    expect(e.conflicts).toEqual({ heldout: 1, screen: 0 });
    expect(e.runs).toEqual(['run 1', 'run 2']);
    // the same game as a screening game is another kind: kept apart, never pooled
    addBatch(entries, batch([game(1, 1, 0)], { kind: 'screen' }));
    expect(e.screen).toHaveLength(1);
    expect(priorOf(e).base).toHaveLength(3);
  });

  it('a game that screened a change is never kept as held-out evidence for it afterwards', () => {
    const entries = new Map();
    // an earlier run screened the change on games 1 and 2 (and picked it because they went well)
    addBatch(entries, batch([game(1, 0, 1), game(2, 0, 1)], { kind: 'screen' }));
    const e = entries.get(entryKey(entryOf()))!;
    expect(screenedBefore(e, game(1, 0, 0))).toBe(true);
    expect(screenedBefore(e, game(3, 0, 0))).toBe(false);
    // a later run plays games 2 and 3 as held-out games: only game 3 is evidence
    const later = addBatch(entries, batch([game(2, 0, 1), game(3, 1, 0)], { run: 'run 2' }));
    expect(later).toMatchObject({ screened: 1, duplicates: 0, conflicts: 0 });
    expect(later.added.map((g) => g.seed)).toEqual([3]);
    expect(priorOf(e)).toEqual({ base: [1], cand: [0] });
    // the other way round nothing is lost: a game that was held-out first stays evidence when a later run screens on it
    addBatch(entries, batch([game(3, 1, 0)], { kind: 'screen', run: 'run 3' }));
    expect(priorOf(e)).toEqual({ base: [1], cand: [0] });
    // another change screened on the same game is not affected
    const otherChange = entryOf({ change: `${entryOf().change} +main:zzz` });
    expect(addBatch(entries, batch([game(1, 0, 1)], { entry: otherChange })).added).toHaveLength(1);
  });

  it('the prior is the held-out games minus the ones this confirmation may play', () => {
    const e = pool([batch([game(1, 0, 1), game(2, 1, 1), game(3, 0, 0)]), batch([game(4, 1, 0)], { kind: 'screen' })]);
    const p = priorOf(e, gameIds([game(2, 0, 0)]));
    expect(p).toEqual({ base: [0, 0], cand: [1, 0] });
    // the id is seed + opponent + first: another opponent or seat is another game
    expect(priorOf(e, gameIds([{ seed: 1, opp: OPP[2]!, first: 1 }])).base).toHaveLength(3);
    expect(priorOf(undefined)).toEqual({ base: [], cand: [] });
  });

  it('summarizes pooled games per opponent and per seat', () => {
    const s = summarize([game(0, 0, 1, OPP[0], 0), game(1, 1, 1, OPP[0], 1), game(2, 1, 0, OPP[1], 0), game(3, 0, 1, OPP[0], 0)]);
    expect(s.games).toBe(4);
    expect(s.mean).toBeCloseTo(0.25, 12);
    expect(s.sd).toBeCloseTo(Math.sqrt(((0.75 ** 2) * 2 + 0.25 ** 2 + 1.25 ** 2) / 3), 12);
    expect(s.se).toBeCloseTo(s.sd / 2, 12);
    expect(s.byOpp[0]).toMatchObject({ opp: OPP[0], games: 3 });
    expect(s.byOpp[0]!.mean).toBeCloseTo(2 / 3, 12);
    expect(s.bySeat.map((x) => x.games)).toEqual([3, 1]);
  });

  it('a builder block lays games out as the forge and optimizer jobs do', () => {
    const slots = blockSlots(100, 8, OPP);
    expect(slots.map((s) => [s.seed, OPP.indexOf(s.opp), s.first])).toEqual([[100, 0, 0], [101, 1, 0], [102, 2, 0], [103, 0, 1], [104, 1, 1], [105, 2, 1], [106, 0, 0], [107, 1, 0]]);
    expect(scored(slots.slice(0, 2), [1, 0], [1, 1]).map((g) => [g.base, g.cand])).toEqual([[1, 1], [0, 1]]);
    expect(() => scored(slots, [1], [1])).toThrow();
  });
});

describe('the always-valid boundary and the guard', () => {
  it('z(n) for a = 0.025 and ρ = 250 (the values the docs quote)', () => {
    expect(POOL_RHO).toBe(250);
    const at = [224, 448, 896, 1792, 3584, 7168].map((n) => +alwaysValidZ(n, 0.025).toFixed(2));
    expect(at).toEqual([3.77, 3.32, 3.11, 3.04, 3.06, 3.12]);
    // a smaller share is a higher bar; no games, no bound
    expect(alwaysValidZ(896, 0.0125)).toBeGreaterThan(alwaysValidZ(896, 0.025));
    expect(alwaysValidZ(0, 0.025)).toBe(Infinity);
  });

  it('the guard adds two pseudo-games (+1, −1) to the spread, not to the mean; the staged interval is unchanged', () => {
    const c = [1, 1, 0, 0, 1];
    const b = [0, 1, 0, 1, 0];
    // d = 1, 0, 0, -1, 1: Σd 1, Σd² 3; n′ 7, m′ 1/7, v = (3 + 2 − 7/49) / 6
    const iv = guardedInterval(c, b, 0.5);
    expect(iv.mean).toBeCloseTo(0.2, 12);
    expect(iv.upper - iv.mean).toBeCloseTo(0.5 * Math.sqrt((5 - 1 / 7) / 6 / 5), 12);
    expect(iv.mean - iv.lower).toBeCloseTo(0.5 * Math.sqrt((5 - 1 / 7) / 6 / 5), 12);
    // games that never differ still have a spread
    const same = Array(400).fill(1);
    expect(guardedInterval(same, same, 3).upper).toBeGreaterThan(0.01);
    expect(pairedInterval(same, same, 3)).toMatchObject({ lower: 0, upper: 0 });
  });

  it('judgePooled: the guarded interval at the always-valid z for this many games and nominees', () => {
    const c = Array.from({ length: 600 }, (_, i) => (i % 10 < 2 ? 1 : 0));
    const b = Array.from({ length: 600 }, (_, i) => (i % 10 === 0 ? 0 : i % 10 === 1 ? 1 : 0));
    const j = judgePooled(c, b, { alpha: 0.05, nominees: 2, minGainPp: 1, minGames: 200 });
    expect(j.iv.z).toBeCloseTo(alwaysValidZ(600, 0.0125), 12);
    expect(j.iv).toEqual(guardedInterval(c, b, j.iv.z));
  });
});

describe('verdicts from the ledger', () => {
  const games = (n: number, plus: number, minus: number) => Array.from({ length: n }, (_, i) => game(i, i % 100 < minus ? 1 : 0, i % 100 < minus ? 0 : i % 100 < minus + plus ? 1 : 0));

  it('ledgerVerdict judges the held-out games as a pooled look would', () => {
    const g = games(4000, 6, 1); // +5 points, rare differences
    const v = ledgerVerdict(g, ADOPTION_DEFAULTS);
    expect(v.verdict).toBe('adopt');
    expect(v.iv).toEqual(judgePooled(g.map((x) => x.cand), g.map((x) => x.base), { alpha: 0.05, nominees: 1, minGainPp: 1, minGames: 200 }).iv);
    expect(ledgerVerdict(games(4000, 1, 6), ADOPTION_DEFAULTS).verdict).toBe('reject');
    expect(ledgerVerdict(games(300, 3, 1), ADOPTION_DEFAULTS).verdict).toBe('undecided');
    expect(ledgerVerdict([], ADOPTION_DEFAULTS).verdict).toBe('undecided');
  });

  it('gamesToSettle: the first pooled count whose lower bound clears the bar at this mean and spread; Infinity at or below the bar', () => {
    const g = games(300, 3, 1); // +2 points
    const n = gamesToSettle(g, ADOPTION_DEFAULTS);
    expect(n).toBeGreaterThan(300);
    expect(Number.isFinite(n)).toBe(true);
    const d = g.map((x) => x.cand - x.base);
    const sum = d.reduce((s, x) => s + x, 0);
    const sq = d.reduce((s, x) => s + x * x, 0);
    const v = (sq + 2 - 302 * (sum / 302) ** 2) / 301;
    const lower = (k: number) => sum / 300 - alwaysValidZ(k, 0.025) * Math.sqrt(v / k);
    expect(lower(n)).toBeGreaterThan(0.01);
    expect(lower(n - 1)).toBeLessThanOrEqual(0.01);
    expect(gamesToSettle(games(300, 2, 1), ADOPTION_DEFAULTS)).toBe(Infinity); // +1 point: at the bar
    expect(gamesToSettle(games(300, 1, 2), ADOPTION_DEFAULTS)).toBe(Infinity);
    expect(gamesToSettle([], ADOPTION_DEFAULTS)).toBe(Infinity);
    const settled = games(4000, 6, 1);
    expect(gamesToSettle(settled, ADOPTION_DEFAULTS)).toBe(4000);
    // the minimum games hold
    expect(gamesToSettle(games(100, 30, 0), adoptionRule({ minGames: 500 }))).toBe(500);
  });
});

describe('the stored form', () => {
  const b = batch([game(10, 0, 1), game(11, 0.5, 1), game(12, 1, 0, OPP[0], 1)], { label: '−1 A → +1 B' });

  it('a batch round-trips through its line and through an export', () => {
    expect(parseBatchLine(batchLine(b)).batch).toEqual(b);
    const doc = ledgerExport([b, { ...b, kind: 'screen' }], new Date('2026-11-14T00:00:00Z'));
    expect(doc).toMatchObject({ kind: 'nct-change-ledger', schema: 1, exported: '2026-11-14T00:00:00.000Z' });
    expect(parseLedgerExport(JSON.stringify(doc)).batches).toEqual([b, { ...b, kind: 'screen' }]);
    expect(parseLedgerExport(doc).batches).toHaveLength(2);
  });

  it('is compact: about 13 bytes a game in JSON', () => {
    const big = batch(blockSlots(150_000, 448, OPP).map((s, i) => ({ ...s, base: i % 3 === 0 ? 1 : 0, cand: i % 4 === 0 ? 1 : i % 7 === 0 ? 0.5 : 0 })));
    const games = JSON.stringify(encodeBatch(big).g).length / 448;
    expect(games).toBeGreaterThan(10);
    expect(games).toBeLessThan(15);
    // the whole line, header and opponents included
    expect(batchLine(big).length / 448).toBeLessThan(15);
  });

  it('refuses bad input with a reason and never throws', () => {
    const line = encodeBatch(b);
    const bad = (patch: Record<string, unknown>) => decodeBatch({ ...line, ...patch }).problem;
    expect(bad({ v: 2 })).toMatch(/newer format/);
    expect(bad({ change: 'not a key' })).toMatch(/change key/);
    expect(bad({ bot: 'hard-v1' })).toMatch(/bot/);
    expect(bad({ sim: 0 })).toMatch(/simulator version/);
    expect(bad({ field: 'xyz' })).toMatch(/field/);
    expect(bad({ kind: 'later' })).toMatch(/kind/);
    expect(bad({ date: '14/11/2026' })).toMatch(/date/);
    expect(bad({ label: 'x'.repeat(501) })).toMatch(/label/);
    expect(bad({ g: [[1, 5, 0, 0, 2]] })).toMatch(/opponent/);
    expect(bad({ g: [[1, 0, 0, 3, 2]] })).toMatch(/score/);
    expect(bad({ g: [[1, 0, 2, 0, 2]] })).toMatch(/first/);
    expect(bad({ g: [[-1, 0, 0, 0, 2]] })).toMatch(/seed/);
    expect(bad({ g: [[1, 0, 0, 0, 2], [1, 0, 0, 2, 2]] })).toMatch(/twice/);
    expect(bad({ opps: ['zz'] })).toMatch(/opponent list/);
    for (const x of [null, 3, 'text', [], {}, { v: 1 }]) expect(decodeBatch(x).problem).toBeTruthy();
    expect(parseBatchLine('{not json').problem).toMatch(/not JSON/);
    expect(parseLedgerExport('nope').problem).toMatch(/not a JSON/);
    expect(parseLedgerExport({ kind: 'nct-tuned-decks', schema: 1 }).problem).toMatch(/not a change ledger/);
    expect(parseLedgerExport({ kind: 'nct-change-ledger', schema: 2, batches: [] }).problem).toMatch(/newer format/);
    expect(parseLedgerExport({ kind: 'nct-change-ledger', schema: 1 }).problem).toMatch(/batch list/);
    expect(parseLedgerExport({ kind: 'nct-change-ledger', schema: 1, batches: [line, { ...line, g: 'x' }] }).problem).toMatch(/^Batch 2:/);
    expect(parseLedgerExport(undefined).problem).toBeTruthy();
  });

  it('the Node store appends, a repeat appends nothing, and what is read back is what was written', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-ledger-'));
    try {
      const store = new LedgerStore(dir);
      expect(store.append(b)).toMatchObject({ written: 3, duplicates: 0, conflicts: 0 });
      const file = store.fileOf(changeBase(b.entry.change));
      const once = fs.readFileSync(file, 'utf8');
      expect(store.append(b)).toMatchObject({ written: 0, duplicates: 3 });
      // a fresh store reading the file drops it too
      expect(new LedgerStore(dir).append(b)).toMatchObject({ written: 0, duplicates: 3 });
      expect(fs.readFileSync(file, 'utf8')).toBe(once);
      // an empty batch writes nothing
      expect(store.append({ ...b, games: [] }).written).toBe(0);
      // a game back with other scores is written once (on record) and counted; the earlier scores are kept
      const other = batch([game(10, 1, 1), game(13, 0, 0)], { run: 'run 2' });
      expect(store.append(other)).toMatchObject({ written: 2, conflicts: 1 });
      expect(store.append(other)).toMatchObject({ written: 0, duplicates: 2 });
      const read = readLedgerDir(dir);
      expect(read.files).toHaveLength(1);
      expect(read.files[0]!.problems).toEqual([]);
      expect(read.files[0]!.batches.map((x) => x.batch)).toEqual([b, other]);
      const e = new LedgerStore(dir).entry(b.entry)!;
      expect(e.heldout.map((g) => [g.seed, g.base, g.cand])).toEqual([[10, 0, 1], [11, 0.5, 1], [12, 1, 0], [13, 0, 0]]);
      expect(e.conflicts.heldout).toBe(1);
      // check:data's reading: readable, the conflict counted, no duplicate
      const check = ledgerFileProblems([{ file: path.basename(file), text: fs.readFileSync(file, 'utf8') }]);
      expect(check).toMatchObject({ problems: [], batches: 2, games: 4, conflicts: 1 });
      expect(ledgerFileProblems([{ file: path.basename(file), text: `${once}${once}` }]).problems[0]).toMatch(/already in this entry/);
      expect(ledgerFileProblems([{ file: 'x.jsonl', text: 'oops\n' }]).problems).toHaveLength(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the Node store does not write a held-out game that screened the change in an earlier run', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-ledger-screened-'));
    try {
      const store = new LedgerStore(dir);
      expect(store.append(batch([game(20, 0, 1), game(21, 0, 1)], { kind: 'screen' }))).toMatchObject({ written: 2, screened: 0 });
      const held = batch([game(21, 0, 1), game(22, 1, 1), game(23, 0, 0)], { run: 'run 2' });
      expect(store.append(held)).toMatchObject({ written: 2, screened: 1, duplicates: 0 });
      // a repeat still leaves it out and writes nothing; a fresh store reading the files agrees
      expect(store.append(held)).toMatchObject({ written: 0, screened: 1, duplicates: 2 });
      const e = new LedgerStore(dir).entry(held.entry)!;
      expect(e.heldout.map((g) => g.seed)).toEqual([22, 23]);
      expect(e.screen.map((g) => g.seed)).toEqual([20, 21]);
      // all of a batch left out: nothing written
      expect(store.append(batch([game(20, 1, 1)], { run: 'run 3' }))).toMatchObject({ written: 0, screened: 1 });
      // check:data agrees with what the store wrote, and fails a file that holds such a game anyway
      const file = store.fileOf(changeBase(held.entry.change));
      const text = fs.readFileSync(file, 'utf8');
      expect(ledgerFileProblems([{ file: path.basename(file), text }]).problems).toEqual([]);
      const forged = `${text}${batchLine(batch([game(20, 1, 1)], { run: 'by hand' }))}\n`;
      expect(ledgerFileProblems([{ file: path.basename(file), text: forged }]).problems[0]).toMatch(/had already screened this change/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a run ledger records by change key and hands back the prior without the planned games', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-ledger-run-'));
    try {
      const run = new RunLedger({ dir, simVersion: 9, bot: 'medium', opponents: OPP, run: 'r1', date: '2026-11-14' });
      const slots = blockSlots(500, 6, OPP);
      run.record('heldout', A, swapped, 'swap', scored(slots, [0, 0, 1, 1, 0, 1], [1, 0, 1, 1, 1, 1]));
      run.record('screen', A, swapped, 'swap', scored(slots, [0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1]));
      expect(run.totals).toEqual({ heldout: { written: 6, duplicates: 0, conflicts: 0, screened: 0 }, screen: { written: 6, duplicates: 0, conflicts: 0, screened: 0 } });
      // the same change found another way reads the same entry; only held-out games make the prior
      const asMove: DeckList = { ...A, name: 'other name', main: [...A.main.slice(1), inCard] };
      expect(run.prior(A, asMove, new Set()).base).toHaveLength(6);
      expect(run.prior(A, asMove, gameIds(slots.slice(0, 4)))).toEqual({ base: [0, 1], cand: [1, 1] });
      // another bot is another entry
      const hard = new RunLedger({ dir, simVersion: 9, bot: 'hard', opponents: OPP, run: 'r2', date: '2026-11-14' });
      expect(hard.prior(A, swapped, new Set()).base).toHaveLength(0);
      expect(run.summary()).toMatch(/appended 6 screening and 6 held-out games/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('season passes the ledger flags on only when they are given', () => {
    expect(ledgerArgs({})).toEqual([]);
    expect(ledgerArgs({ ledger: true })).toEqual(['--ledger']);
    expect(ledgerArgs({ ledger: true, 'ledger-dir': 'x/y' })).toEqual(['--ledger', '--ledger-dir', 'x/y']);
  });
});

// ---------------------------------------------------------------- confirmStaged with priors

/** Deterministic scores by (stage, game, nominee): the same whichever nominees are still active. */
function fixedStages(gains: number[], o: { p?: number; same?: number; seed?: number } = {}): PlayStage {
  const p = o.p ?? 0.5;
  const same = o.same ?? 0.85;
  const u = (...xs: number[]) => {
    let h = (o.seed ?? 1) >>> 0;
    for (const x of xs) h = Math.imul(h ^ x, 2654435761) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  };
  return async ({ stage, games, active }) => {
    const base: number[] = [];
    for (let k = 0; k < games; k++) base.push(u(stage, k, 999) < p ? 1 : 0);
    const nominees = active.map((i) => base.map((b, k) => (u(stage, k, i, 1) < same ? b : u(stage, k, i, 2) < p + (gains[i] ?? 0) / (1 - same) ? 1 : 0)));
    return { base, nominees };
  };
}
const priorFrom = (n: number, gain: number, seed = 7): PairedScores => {
  const r = rng(seed);
  const base: number[] = [];
  const cand: number[] = [];
  for (let k = 0; k < n; k++) {
    const b = r() < 0.5 ? 1 : 0;
    base.push(b);
    cand.push(r() < 0.85 ? b : r() < 0.5 + gain / 0.15 ? 1 : 0);
  }
  return { base, cand };
};
const R = ADOPTION_DEFAULTS as AdoptionRule;

describe('confirmStaged with earlier games (the strict pooling rule)', () => {
  it('without priors (absent, empty, all undefined or empty) the result is exactly today’s', async () => {
    for (const gains of [[0.03], [0.0], [0.08, 0.0, -0.02]]) {
      const noms = gains.map(() => ({ minGainPp: 1 }));
      const today = await confirmStaged(R, noms, 224, fixedStages(gains));
      expect(await confirmStaged(R, noms, 224, fixedStages(gains), undefined, [])).toEqual(today);
      expect(await confirmStaged(R, noms, 224, fixedStages(gains), undefined, gains.map(() => undefined))).toEqual(today);
      expect(await confirmStaged(R, noms, 224, fixedStages(gains), undefined, gains.map(() => ({ base: [], cand: [] })))).toEqual(today);
      for (const c of today.results) expect(c.priorGames).toBeUndefined();
      expect(nomineeRecord('x', today.results[0]!.heldOut, today.results[0]).heldOut).not.toHaveProperty('priorGames');
    }
  });

  it('decides from the earlier games alone with 0 new games: adopt and reject', async () => {
    const big = priorFrom(6000, 0.06);
    const r = await confirmStaged(R, [{ minGainPp: 1 }], 224, fixedStages([0]), undefined, [big]);
    expect(r.games).toBe(0);
    expect(r.results[0]).toMatchObject({ outcome: 'adopt', looks: 0, priorGames: 6000 });
    expect(r.results[0]!.heldOut.games).toBe(6000);
    expect(r.results[0]!.heldOut.z).toBeCloseTo(alwaysValidZ(6000, 0.025), 12);
    expect(pooledGainWords(r.results[0]!)).toMatch(/6,000 games \(6,000 from earlier runs; always-valid z \d\.\d\d, decided by the earlier games alone\)$/);
    const bad = await confirmStaged(R, [{ minGainPp: 1 }], 224, fixedStages([0]), undefined, [priorFrom(6000, -0.06)]);
    expect(bad).toMatchObject({ games: 0, results: [{ outcome: 'reject', looks: 0 }] });
  });

  it('respects the minimum games: a large gain on fewer earlier games than minGames plays on', async () => {
    const small = priorFrom(150, 0.3);
    const r = await confirmStaged(R, [{ minGainPp: 1 }], 224, fixedStages([0.3]), undefined, [small]);
    expect(r.results[0]!.looks).toBeGreaterThan(0);
    expect(r.results[0]).toMatchObject({ outcome: 'adopt', priorGames: 150 });
    expect(r.results[0]!.heldOut.games).toBe(150 + 224 * r.results[0]!.looks);
    const strict = await confirmStaged({ ...R, minGames: 100_000 }, [{ minGainPp: 1 }], 224, fixedStages([0.3]), undefined, [small]);
    expect(strict.results[0]!.outcome).not.toBe('adopt');
  });

  it('pools after each new stage and judges by the always-valid z; could not tell at the cap', async () => {
    const r = await confirmStaged({ ...R, futilityAfterStages: 0 }, [{ minGainPp: 1 }], 224, fixedStages([0.01]), undefined, [priorFrom(400, 0.01)]);
    const c = r.results[0]!;
    expect(c.priorGames).toBe(400);
    if (c.outcome === 'inconclusive') expect(c.looks).toBe(4);
    expect(c.heldOut.games).toBe(400 + 224 * c.looks);
    expect(c.heldOut.z).toBeCloseTo(alwaysValidZ(c.heldOut.games, 0.025), 12);
    expect(r.games).toBe(2 * 224 * c.looks);
    // what it was judged on is the pooled guarded interval
    expect(c.heldOut.lower).toBeLessThan(c.heldOut.mean);
  });

  it('futility stops a pooled nominee after a new stage once the pooled games reach the futility size, never before a new stage', async () => {
    // earlier games with no gain at all (20 won, 20 lost, the rest the same game), and new games that never differ
    const flat = (n: number, flips: number): PairedScores => ({
      base: Array.from({ length: n }, (_, i) => (i < flips ? 0 : i < 2 * flips ? 1 : 1)),
      cand: Array.from({ length: n }, (_, i) => (i < flips ? 1 : i < 2 * flips ? 0 : 1)),
    });
    const same: PlayStage = async ({ games, active }) => ({ base: Array(games).fill(1), nominees: active.map(() => Array(games).fill(1)) });
    // 448 earlier games: not decided by themselves, not stopped before a new stage; stopped after the first one
    const r = await confirmStaged(R, [{ minGainPp: 1 }], 224, same, undefined, [flat(448, 20)]);
    expect(r.results[0]).toMatchObject({ outcome: 'inconclusive', stopped: 'futility', looks: 1, priorGames: 448 });
    expect(r.results[0]!.heldOut.games).toBe(672);
    // 100 earlier games: the pooled games reach 2 × 224 only after the second new stage
    const later = await confirmStaged(R, [{ minGainPp: 1 }], 224, same, undefined, [flat(100, 5)]);
    expect(later.results[0]).toMatchObject({ outcome: 'inconclusive', stopped: 'futility', looks: 2 });
    // off when futilityAfterStages is 0: it plays to the cap
    const off = await confirmStaged({ ...R, futilityAfterStages: 0 }, [{ minGainPp: 1 }], 224, same, undefined, [flat(448, 20)]);
    expect(off.results[0]!.stopped).toBeUndefined();
    expect(off.results[0]!.looks).toBe(4);
  });

  it('mixed nominees: the unpooled one is decided exactly as without the ledger, the pooled one by the strict rule', async () => {
    const gains = [0.03, 0.02];
    const noms = [{ minGainPp: 1 }, { minGainPp: 1 }];
    const plain = await confirmStaged(R, noms, 224, fixedStages(gains));
    const mixed = await confirmStaged(R, noms, 224, fixedStages(gains), undefined, [undefined, priorFrom(6000, 0.06)]);
    expect(mixed.results[0]).toEqual(plain.results[0]);
    expect(mixed.results[1]).toMatchObject({ outcome: 'adopt', looks: 0, priorGames: 6000 });
    // two nominees: each pooled look uses α / (2 · 2)
    expect(mixed.results[1]!.heldOut.z).toBeCloseTo(alwaysValidZ(6000, 0.0125), 12);
  });

  it('the Deck Lab’s Stop and any-gain behave as today (any-gain never pools)', async () => {
    const legacy = adoptionRule({ kind: 'any-gain' });
    const today = await confirmStaged(legacy, [{ minGainPp: 0 }], 224, fixedStages([0.02]));
    expect(await confirmStaged(legacy, [{ minGainPp: 0 }], 224, fixedStages([0.02]), undefined, [priorFrom(6000, -0.06)])).toEqual(today);
    let calls = 0;
    const stopped = await confirmStaged(R, [{ minGainPp: 1 }], 224, fixedStages([0.01]), () => ++calls > 0, [priorFrom(300, 0.01)]);
    expect(stopped.results[0]).toMatchObject({ outcome: 'inconclusive', stopped: true, looks: 1, priorGames: 300 });
  });

  it('the rule line and the manifest mention pooling only when the ledger is on', () => {
    const o = { firstStage: 224, nominees: 1 };
    expect(describeRule(R, { ...o, ledger: false })).toBe(describeRule(R, o));
    expect(describeRule(R, o)).not.toMatch(/ledger/);
    expect(describeRule(R, { ...o, ledger: true })).toBe(`${describeRule(R, o)}; change ledger on: a nominee with held-out games from earlier runs (same simulator version, bot and field) is judged on those games first, then on them and each new stage pooled, by an always-valid boundary (normal mixture, Howard et al. 2021, ρ = 250 games, one-sided 0.025 each: z = 3.32 at 448 games, 3.11 at 896, 3.04 at 1,792, 3.06 at 3,584)`);
    const p = { firstStage: 224, nominees: 1, cardsPerChange: 1, packagesPerChange: 1 };
    expect(adoptionProvenance(R, p, false)).toEqual(adoptionProvenance(R, p));
    expect(adoptionProvenance(R, p)).not.toHaveProperty('ledger');
    expect(adoptionProvenance(R, p, true)).toEqual({ ...adoptionProvenance(R, p), ledger: { boundary: 'normal-mixture', rho: 250 } });
    expect(adoptionProvenance(adoptionRule({ kind: 'any-gain' }), p, true)).not.toHaveProperty('ledger');
  });
});

// ---------------------------------------------------------------- the simulation (scripts/ledger-sim.ts)

describe('the pooling rule over many runs (synthetic)', () => {
  it('the simulation decides each run exactly as confirmStaged does on the same games', async () => {
    const r = rng(2026);
    for (let t = 0; t < 60; t++) {
      const m = 112;
      const priorN = t % 3 === 0 ? 0 : Math.floor(r() * 900) + 1;
      const mu = (r() - 0.3) * 0.08;
      const draw = (n: number) => {
        const base: number[] = [];
        const cand: number[] = [];
        // a changed game flips the result: +1 with probability 0.06 + mu/2, −1 with 0.06 − mu/2, else the same game
        for (let k = 0; k < n; k++) {
          const x = r();
          const b = r() < 0.5 ? 1 : 0;
          if (x < 0.06 + mu / 2) base.push(0), cand.push(1);
          else if (x < 0.12) base.push(1), cand.push(0);
          else base.push(b), cand.push(b);
        }
        return { base, cand };
      };
      const prior = draw(priorN);
      const stages = [draw(m), draw(m), draw(m), draw(m)];
      const sums = (s: { base: number[]; cand: number[] }): Sums => {
        const d = s.cand.map((c, k) => c - s.base[k]!);
        return { n: d.length, sum: d.reduce((a, x) => a + x, 0), sq: d.reduce((a, x) => a + x * x, 0) };
      };
      let at = 0;
      const sim = runOnce(R, m, sums(prior), () => sums(stages[at++]!), 'strict');
      const lib = await confirmStaged(R, [{ minGainPp: 1 }], m, async ({ stage }) => ({ base: stages[stage]!.base, nominees: [stages[stage]!.cand] }), undefined, [prior]);
      const c = lib.results[0]!;
      expect([sim.outcome, sim.looks], `case ${t}`).toEqual([c.outcome, c.looks]);
    }
  });

  it('strict pooling keeps the lifetime false-adopt rate at the bar low; the last-look line does not; a clear gain is adopted', () => {
    const lives = 1500;
    const atBar = (mode: 'strict' | 'last-look') => lifeTable({ mu: 0.01, sd: 0.24, m: 224, runs: 10, mode, lives, seed: 77 }).byRun[10]!;
    const strict = atBar('strict');
    const lastLook = atBar('last-look');
    // the bound is α/2 for the first confirmation plus α/2 for every pooled look together: 5%
    expect(strict).toBeLessThan(0.05);
    expect(lastLook).toBeGreaterThan(0.07);
    const clear = lifeTable({ mu: 0.04, sd: 0.24, m: 224, runs: 3, mode: 'strict', lives: 400, seed: 78 });
    expect(clear.byRun[3]!).toBeGreaterThan(0.95);
  });
});
