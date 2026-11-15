// The change ledger's shared run logic (src/lib/changeLedgerRun.ts), the browser store on the in-memory storage
// (src/lib/changeLedgerStore.ts: append, repeats, export and import, refusals, clear, counts, older simulator versions)
// and the Node export (`npm run ledger -- export`, exportLedgerDir in scripts/ledger-store.ts), which the Lab imports.
// docs/SYNERGIES.md "Pooling held-out games across runs".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { changeBase, changeKey, encodeBatch, fieldFingerprint, gameIds, ledgerExport, mergeBatches, parseLedgerExport, type EntryId, type LedgerBatch, type LedgerGame } from '../src/lib/changeLedger';
import { blockSlots, ChangeLedgerRun, confirmationSlots, LedgerCache, scored } from '../src/lib/changeLedgerRun';
import { BrowserLedgerStore, clearLedgerWords, earlierGamesRuleWords, holdingLine, importLine, keptLine, memoryLedgerStorage, runKeptLine } from '../src/lib/changeLedgerStore';
import { ADOPTION_DEFAULTS, adoptionRule } from '../src/lib/evidence';
import { exportLedgerDir, LedgerStore, RunLedger } from '../scripts/ledger-store';
import { listFingerprint } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { synthDecks } from './builder-fixtures';

const [A, B] = synthDecks() as [DeckList, DeckList];
const inCard = B.main.find((id) => !A.main.includes(id))!;
const swapped: DeckList = { ...A, main: [inCard, ...A.main.slice(1)] };
const inCard2 = B.main.filter((id) => !A.main.includes(id))[1]!;
const swapped2: DeckList = { ...A, main: [inCard2, ...A.main.slice(1)] };
const FP16 = (s: string) => listFingerprint({ legends: [], main: [s] });
const OPP = [FP16('o1'), FP16('o2'), FP16('o3')];
const BASE = listFingerprint(A);
const entryOf = (o: Partial<EntryId> = {}): EntryId => ({ change: changeKey(A, swapped), simVersion: 9, bot: 'medium', field: fieldFingerprint(OPP), ...o });
const game = (seed: number, base: number, cand: number): LedgerGame => ({ seed, opp: OPP[seed % 3]!, first: (seed % 2) as 0 | 1, base, cand });
const batch = (games: LedgerGame[], o: Partial<LedgerBatch> = {}): LedgerBatch => ({ entry: entryOf(), kind: 'heldout', label: 'swap', run: 'run 1', date: '2026-11-14', games, ...o });
const games = (from: number, n: number, f: (i: number) => [number, number] = (i) => [i % 2, 1]) => Array.from({ length: n }, (_, i) => game(from + i, ...f(i)));

async function loaded(storage = memoryLedgerStorage()) {
  const store = new BrowserLedgerStore(storage);
  await store.load(BASE);
  return { store, storage };
}

describe('the shared run ledger', () => {
  it('lays games out as the builders do and pairs the scores game for game', () => {
    const slots = blockSlots(100, 7, OPP);
    expect(slots.map((s) => [s.seed, s.opp, s.first])).toEqual([
      [100, OPP[0], 0],
      [101, OPP[1], 0],
      [102, OPP[2], 0],
      [103, OPP[0], 1],
      [104, OPP[1], 1],
      [105, OPP[2], 1],
      [106, OPP[0], 0],
    ]);
    // a confirmation's stages each start the layout afresh
    const c = confirmationSlots(1000, 4, 3, OPP);
    expect(c).toHaveLength(12);
    expect(c.slice(4, 8)).toEqual(blockSlots(1004, 4, OPP));
    expect(() => scored(slots, [1], [1])).toThrow();
  });

  it('a cache keeps each game once, counts conflicts and never keeps a screened game as held-out evidence', () => {
    const cache = new LedgerCache();
    expect(cache.has(BASE)).toBe(false);
    cache.loadBase(BASE, [batch(games(10, 3), { kind: 'screen' })]);
    const first = cache.append(batch([game(10, 1, 1), game(20, 0, 1), game(21, 0, 0)]));
    expect(first.result).toMatchObject({ written: 2, screened: 1, duplicates: 0, conflicts: 0 });
    expect(first.toWrite?.games.map((g) => g.seed)).toEqual([20, 21]);
    // a repeat writes nothing; other scores are written once (on record) but the earlier ones are kept
    expect(cache.append(batch([game(20, 0, 1)])).toWrite).toBeNull();
    const other = cache.append(batch([game(21, 1, 1)]));
    expect(other.result).toMatchObject({ written: 1, conflicts: 1 });
    expect(cache.append(batch([game(21, 1, 1)])).result).toMatchObject({ written: 0, duplicates: 1 });
    expect(cache.entry(entryOf())!.heldout.map((g) => [g.seed, g.cand])).toEqual([
      [20, 1],
      [21, 0],
    ]);
    cache.reset();
    expect(cache.entry(entryOf())).toBeUndefined();
  });

  it('the browser store and the Node store keep exactly the same games from the same batches', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-ledger-parity-'));
    try {
      const node = new LedgerStore(dir);
      const { store } = await loaded();
      const seq = [batch(games(1, 5), { kind: 'screen' }), batch(games(4, 6)), batch(games(4, 6)), batch([game(9, 1, 0)]), batch(games(30, 4), { entry: entryOf({ bot: 'hard' }) })];
      for (const b of seq) expect(store.append(b)).toEqual(node.append(b));
      await store.flush();
      for (const id of [entryOf(), entryOf({ bot: 'hard' })]) {
        const a = node.entry(id)!;
        const b = store.entry(id)!;
        expect(b.heldout).toEqual(a.heldout);
        expect(b.screen).toEqual(a.screen);
        expect(b.conflicts).toEqual(a.conflicts);
      }
      // and a fresh store reading the stored rows agrees
      const again = new BrowserLedgerStore(store.storage);
      await again.load(BASE);
      expect(again.entry(entryOf())!.heldout).toEqual(node.entry(entryOf())!.heldout);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a run over the browser store records by change key and hands back the prior without the planned games', async () => {
    const { store, storage } = await loaded();
    const run = new ChangeLedgerRun(store, { simVersion: 9, bot: 'medium', opponents: OPP, run: 'r1', date: '2026-11-14' });
    const slots = blockSlots(500, 6, OPP);
    run.record('heldout', A, swapped, 'swap', scored(slots, [0, 0, 1, 1, 0, 1], [1, 0, 1, 1, 1, 1]));
    run.record('screen', A, swapped, 'swap', scored(blockSlots(900, 6, OPP), [0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1]));
    expect(run.totals.heldout.written).toBe(6);
    expect(run.prior(A, swapped, gameIds(slots.slice(0, 4)))).toEqual({ base: [0, 1], cand: [1, 1] });
    // RunLedger (the Node run) is the same class over the file store
    expect(Object.getPrototypeOf(RunLedger.prototype)).toBe(ChangeLedgerRun.prototype);
    await store.flush();
    expect(storage.rows.map((r) => [r.base, r.batch.kind, r.batch.g.length])).toEqual([
      [BASE, 'heldout', 6],
      [BASE, 'screen', 6],
    ]);
  });
});

describe('the browser store', () => {
  it('appends, adds nothing on a repeat, and reads back what it wrote', async () => {
    const { store, storage } = await loaded();
    expect(store.append(batch(games(1, 10))).written).toBe(10);
    expect(store.append(batch(games(1, 10))).written).toBe(0);
    await store.flush();
    expect(storage.rows).toHaveLength(1);
    expect(storage.rows[0]!.batch).toEqual(encodeBatch(batch(games(1, 10))));
    const c = await store.counts(9);
    expect(c).toEqual({ heldout: 10, screen: 0, changes: 1, older: { batches: 0, games: 0 }, unreadable: 0 });
  });

  it('load waits for its own queued writes, and another tab’s rows are seen at the next load', async () => {
    const storage = memoryLedgerStorage();
    const a = new BrowserLedgerStore(storage);
    const b = new BrowserLedgerStore(storage);
    await a.load(BASE);
    await b.load(BASE);
    a.append(batch(games(1, 4)));
    expect(b.entry(entryOf())).toBeUndefined();
    await a.load(BASE);
    expect(storage.rows).toHaveLength(1);
    await b.load(BASE);
    expect(b.entry(entryOf())!.heldout).toHaveLength(4);
  });

  it('a write the storage refuses is counted, flush never rejects, and the next load reads only what was stored', async () => {
    const { store, storage } = await loaded();
    storage.fail = true;
    store.append(batch(games(1, 5)));
    await expect(store.flush()).resolves.toEqual({ failed: 5 });
    expect(store.lastError).toMatch(/refused/);
    storage.fail = false;
    await store.load(BASE);
    expect(store.entry(entryOf())).toBeUndefined();
    expect(store.append(batch(games(1, 5))).written).toBe(5);
    await store.flush();
    expect(storage.rows).toHaveLength(1);
  });

  it('export and import round-trip: a second browser gets every game, and importing again adds nothing', async () => {
    const { store } = await loaded();
    store.append(batch(games(1, 8), { kind: 'screen' }));
    store.append(batch(games(20, 12)));
    store.append(batch(games(40, 3), { entry: entryOf({ change: changeKey(A, swapped2) }) }));
    const doc = await store.exportDoc(new Date('2026-11-14T00:00:00Z'));
    expect(doc).toMatchObject({ kind: 'nct-change-ledger', schema: 1, exported: '2026-11-14T00:00:00.000Z' });
    expect(parseLedgerExport(JSON.stringify(doc)).batches).toHaveLength(3);

    const other = new BrowserLedgerStore(memoryLedgerStorage());
    const r = await other.importDoc(JSON.stringify(doc));
    expect(r).toEqual({ batches: 3, added: 23, already: 0, conflicts: 0, leftOut: 0, failed: 0 });
    expect(importLine(r)).toBe('Imported 23 games new to this browser; 0 games were already held.');
    expect(await other.counts(9)).toMatchObject({ heldout: 15, screen: 8, changes: 2 });
    const again = await other.importDoc(doc);
    expect(again).toMatchObject({ added: 0, already: 23 });
    expect(importLine(again)).toBe('Imported 0 games new to this browser; 23 games were already held.');
    // what the second browser exports is the same set of games
    const back = await other.exportDoc(new Date('2026-11-14T00:00:00Z'));
    const games2 = (d: typeof doc) => [...mergeBatches(parseLedgerExport(d).batches!).values()].map((e) => [e.key, e.heldout.length, e.screen.length]).sort();
    expect(games2(back)).toEqual(games2(doc));
  });

  it('import follows the store rules: other scores keep the held ones, a screened game is not taken as held-out evidence', async () => {
    const { store } = await loaded();
    store.append(batch(games(1, 4), { kind: 'screen' }));
    store.append(batch([game(10, 0, 1)]));
    const doc = ledgerExport([batch([game(1, 0, 1), game(10, 1, 1), game(11, 0, 1)])]);
    const r = await store.importDoc(doc);
    expect(r).toMatchObject({ added: 1, already: 0, conflicts: 1, leftOut: 1 });
    expect(importLine(r)).toBe('Imported 1 game new to this browser; 0 games were already held; 1 game came with other scores than the ones held here, which are kept; 1 game left out because they screened the same change here.');
    expect(store.entry(entryOf())!.heldout.map((g) => [g.seed, g.base])).toEqual([
      [10, 0],
      [11, 0],
    ]);
  });

  it('refuses a file that is not an export, a newer schema or a bad batch, and adds nothing', async () => {
    const { store, storage } = await loaded();
    const bad = [
      ['not json', /not a JSON file/],
      [JSON.stringify({ kind: 'nct-tuned-decks', schema: 1 }), /not a change ledger file/],
      [JSON.stringify({ kind: 'nct-change-ledger', schema: 2, batches: [] }), /newer format \(schema 2\)/],
      [JSON.stringify({ ...ledgerExport([batch(games(1, 2))]), batches: [{ ...encodeBatch(batch(games(1, 2))), bot: 'hard-v1' }] }), /Batch 1: a batch has no valid bot/],
    ] as const;
    for (const [text, why] of bad) {
      const r = await store.importDoc(text);
      expect(r.problem).toMatch(why);
      expect(importLine(r)).toMatch(/^Nothing imported: /);
    }
    expect(storage.rows).toHaveLength(0);
  });

  it('keeps batches of another simulator version: counted apart, exported, never used, removed by clear', async () => {
    const { store } = await loaded();
    store.append(batch(games(1, 6), { entry: entryOf({ simVersion: 8 }) }));
    store.append(batch(games(100, 4)));
    await store.flush();
    expect(await store.counts(9)).toMatchObject({ heldout: 4, changes: 1, older: { batches: 1, games: 6 } });
    // a run on version 9 sees only its own entry
    const run = new ChangeLedgerRun(store, { simVersion: 9, bot: 'medium', opponents: OPP, run: 'r', date: '2026-11-14' });
    await store.load(BASE);
    expect(run.prior(A, swapped, new Set()).base).toHaveLength(4);
    const h = await store.holding(BASE, { simVersion: 9, bot: 'medium', field: fieldFingerprint(OPP) });
    expect(h).toEqual({ heldout: 4, changes: 1, usable: 4, older: 6 });
    expect(holdingLine(h)).toBe('This browser holds 4 held-out games on 1 change of this list. 6 games from an earlier simulator version are kept but not used.');
    expect((await store.exportDoc()).batches).toHaveLength(2);
    expect(keptLine(await store.counts(9))).toMatch(/^4 held-out and 0 screening games on 1 change\. .* Also 6 games from an earlier simulator version, kept but never used; Clear removes them\.$/);
    await store.clear();
    expect(await store.counts(9)).toEqual({ heldout: 0, screen: 0, changes: 0, older: { batches: 0, games: 0 }, unreadable: 0 });
    expect(store.entry(entryOf())).toBeUndefined();
  });

  it('says what it holds for one list, and what a run with these bots and this field can use', async () => {
    const { store } = await loaded();
    const empty = await store.holding(BASE, { simVersion: 9, bot: 'medium', field: fieldFingerprint(OPP) });
    expect(holdingLine(empty)).toBe('This browser holds no held-out games of this list yet.');
    store.append(batch(games(1, 1000)));
    store.append(batch(games(2000, 792), { entry: entryOf({ change: changeKey(A, swapped2) }) }));
    store.append(batch(games(5000, 50), { entry: entryOf({ bot: 'hard' }) }));
    store.append(batch(games(6000, 9), { kind: 'screen', entry: entryOf({ change: changeKey(swapped, A) }) }));
    const h = await store.holding(BASE, { simVersion: 9, bot: 'medium', field: fieldFingerprint(OPP) });
    expect(h).toEqual({ heldout: 1842, changes: 2, usable: 1792, older: 0 });
    expect(holdingLine(h)).toBe('This browser holds 1,842 held-out games on 2 changes of this list; 1,792 of them were played with these bots against this field, so only those can be used.');
    expect(holdingLine({ ...h, usable: 0 })).toMatch(/none were played with these bots against this field, so none can be used\.$/);
    expect(holdingLine({ heldout: 1792, changes: 3, usable: 1792, older: 0 })).toBe('This browser holds 1,792 held-out games on 3 changes of this list.');
    // another list's changes are not this list's
    expect(changeBase(changeKey(swapped, A))).not.toBe(BASE);
  });

  it('words: what a run kept, and the Clear dialog', () => {
    const t = { heldout: { written: 448, duplicates: 0, conflicts: 0, screened: 2 }, screen: { written: 1232, duplicates: 4, conflicts: 1, screened: 0 } };
    // a screening game that came back with other scores is not mentioned (the same change screened twice in another card order)
    expect(runKeptLine(t)).toBe('This run kept 1,232 screening and 448 held-out games in this browser (4 already held; 2 games left out because an earlier run screened the change on them).');
    expect(runKeptLine({ ...t, heldout: { ...t.heldout, conflicts: 3 } })).toBe(
      'This run kept 1,232 screening and 448 held-out games in this browser (4 already held; 3 held-out games came back with other scores, the earlier kept; 2 games left out because an earlier run screened the change on them).',
    );
    expect(runKeptLine(t, 3)).toMatch(/3 games could not be written: this browser’s storage is full or blocked\.$/);
    // the Lab's plain sentence after its rule line (no "ledger", the two bars side by side)
    expect(earlierGamesRuleWords(ADOPTION_DEFAULTS)).toBe(
      'Earlier held-out games are used: a change that already has some (same list, bots, field and simulator version) is judged on them and the new games together, at a stricter bar that stays right however often the games are looked at (z 3.11 at 896 games, against 2.01 at a first confirmation’s last look). A change its earlier games already reject is not tested again.',
    );
    expect(earlierGamesRuleWords(adoptionRule({ kind: 'any-gain' }))).toMatch(/kept for later runs, but the any-gain rule never uses earlier ones\.$/);
    const w = clearLedgerWords({ heldout: 10, screen: 20, changes: 1, older: { batches: 1, games: 5 }, unreadable: 0 });
    expect(w.title).toBe('Clear the evidence kept in this browser?');
    expect(w.body).toMatch(/^All 35 games kept here .* This cannot be undone\.$/);
  });
});

describe('npm run ledger -- export', () => {
  it('writes the forge’s ledger as one export document the Lab imports, by list and simulator version', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-ledger-export-'));
    try {
      const node = new LedgerStore(dir);
      node.append(batch(games(1, 7)));
      node.append(batch(games(50, 5), { kind: 'screen' }));
      node.append(batch(games(80, 3), { entry: entryOf({ simVersion: 8 }) }));
      // another list's file
      const other: EntryId = { ...entryOf(), change: changeKey(B, { ...B, main: [A.main[0]!, ...B.main.slice(1)] }) };
      node.append(batch(games(90, 2), { entry: other }));
      fs.appendFileSync(node.fileOf(BASE), 'not a batch\n');
      const now = new Date('2026-11-14T12:00:00Z');
      const all = exportLedgerDir(dir, { now });
      expect(all.doc.batches).toHaveLength(4);
      expect(all.problems).toEqual([expect.stringMatching(/^[0-9a-f]{16}\.jsonl: line 4: the line is not JSON$/)]);
      const one = exportLedgerDir(dir, { bases: new Set([BASE]), simVersion: 9, now });
      expect(one).toMatchObject({ games: 12, otherVersions: 1 });
      expect(one.doc.batches.map((b) => b.kind)).toEqual(['heldout', 'screen']);
      // the Lab's store imports it as it is
      const lab = new BrowserLedgerStore(memoryLedgerStorage());
      expect(await lab.importDoc(JSON.stringify(one.doc))).toMatchObject({ added: 12, already: 0 });
      await lab.load(BASE);
      expect(lab.entry(entryOf())!.heldout).toEqual(node.entry(entryOf())!.heldout);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
