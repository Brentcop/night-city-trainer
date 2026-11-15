// npm run remeasure (scripts/remeasure.ts, logic in scripts/remeasure-run.ts; docs/EVIDENCE.md "Re-measurements"): the
// change built each of the three ways, every refusal in one sentence with exit 2, the forge's job layout exactly, a row
// that reads back through parseRemeasureFile, and an append that keeps the earlier rows byte for byte. The game runner is
// a stub: no game is played here.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { listFingerprint, parseDeck } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { batchLine, changeKey, type LedgerBatch } from '../src/lib/changeLedger';
import { parseRemeasureFile, type RemeasureFile } from '../src/lib/remeasure';
import { SIM_VERSION } from '../src/lib/tournament';
import { loadLibrary } from '../scripts/lib-node';
import { remeasure, remeasureJobs, type RemeasureIO } from '../scripts/remeasure-run';
import type { MatchJob } from '../scripts/worker';

const LIB = loadLibrary();
const META = LIB.filter((d) => d.kind === 'meta');
const S205 = LIB.find((d) => d.file === 's2-05-counter-rrg.txt')!;
const S206 = LIB.find((d) => d.file === 's2-06-counter-rgg.txt')!;
const HISTORY = 'data/decks/custom/history/s2-06-counter-rgg-2026-11-12.txt';
const DAY = new Date('2026-11-15T12:00:00Z');

function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-remeasure-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const fresh = () => path.join(tmp, `case-${++n}`);

/** Run the command with a stub runner (each list its own strength and its own coin in a third of the games). */
async function cmd(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const jobs: MatchJob[] = [];
  const io: RemeasureIO = {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    play: async (js) => {
      jobs.push(...js);
      return js.map((j) => {
        const fp = listFingerprint(j.a);
        // a third of the games are a coin per list, the rest the deal's game with the list's own strength
        const won = unit(`n:${j.seed}:${fp}`) < 0.3 ? unit(`c:${j.seed}:${fp}`) < 0.5 : unit(`g:${j.seed}:${j.b.name}:${j.first}`) < 0.4 + 0.2 * unit(`l:${fp}`);
        return { winner: won ? (0 as const) : (1 as const) };
      });
    },
    now: () => DAY,
    library: () => LIB,
  };
  const code = await remeasure(args, io);
  return { code, out, err, jobs };
}

const readRows = (file: string) => {
  const r = parseRemeasureFile(JSON.parse(fs.readFileSync(file, 'utf8')), file);
  expect(r.problems).toEqual([]);
  return r.file!.measurements;
};

describe('the change, three ways', () => {
  it('--cut and --add, by id or by exact name: replaced in place, as the forge swaps a card', async () => {
    const dir = fresh();
    const out = path.join(dir, 'r.json');
    const r = await cmd(['s2-05-counter-rrg', '--cut', 'Gunpoint Diplomacy', '--add', 'yorinobu_arasaka_steel_dragon', '--bot', 'medium', '--games', '28', '--out', out, '--note', 'test rows']);
    expect(r.err).toEqual([]);
    expect(r.code).toBe(0);
    const main = [...S205.deck.main];
    main[main.indexOf('gunpoint_diplomacy')] = 'yorinobu_arasaka_steel_dragon';
    const cand: DeckList = { ...S205.deck, main };
    const [row] = readRows(out);
    expect(row).toMatchObject({
      deck: 's2-05-counter-rrg.txt',
      label: '-1 Gunpoint Diplomacy → +1 Yorinobu Arasaka: Steel Dragon',
      baseListId: listFingerprint(S205.deck),
      candListId: listFingerprint(cand),
      cuts: ['gunpoint_diplomacy'],
      adds: ['yorinobu_arasaka_steel_dragon'],
      bot: 'medium',
      simVersion: SIM_VERSION,
      games: 28,
      seed: 5_000_000,
      date: '2026-11-15',
      script: 'scripts/remeasure.ts',
      opponents: META.map((d) => listFingerprint(d.deck)),
    });
    expect(row!.legendCuts).toBeUndefined();
    expect(row!.byOpp!.map((o) => [o.opp, o.oppListId, o.games])).toEqual(META.map((d) => [d.deck.name, listFingerprint(d.deck), 4]));
    expect(row!.bySeat!.map((s) => [s.first, s.games])).toEqual([
      [0, 14],
      [1, 14],
    ]);
    expect(row!.sd).toBeGreaterThan(0);
    // the changed list is the one played, card order and all
    expect(r.jobs.slice(28).every((j) => j.a.main.join() === main.join())).toBe(true);
    const doc = JSON.parse(fs.readFileSync(out, 'utf8')) as RemeasureFile;
    expect(doc.note).toBe('test rows');
    // what it printed: the figure, the splits, the test and what the number is
    const text = r.out.join('\n');
    expect(text).toMatch(/Paired difference \(after minus before\): [+−]\d+\.\d pts, 95% range/);
    expect(text).toMatch(/Games that came out the same for both lists: \d+\.\d%/);
    expect(text).toMatch(/Win rates: before \d+\.\d%, after \d+\.\d%/);
    expect(text).toMatch(/Stratified by opponent and seat \(14 cells\)/);
    expect(text).toContain('By opponent:');
    expect(text).toContain('going second');
    expect(text).toContain('Across opponents:');
    expect(r.out.at(-1)).toMatch(/^This is a paired comparison with the Medium bot under simulator version 9: .* run npm run evidence/);
  });

  it('--change, by its label or its key in the change ledger', async () => {
    const dir = fresh();
    const ledger = path.join(dir, 'ledger');
    fs.mkdirSync(ledger, { recursive: true });
    const main = [...S205.deck.main];
    main[main.indexOf('mantis_blades')] = 'nadia_fighting_through_grief';
    const key = changeKey(S205.deck, { ...S205.deck, main });
    const b: LedgerBatch = { entry: { change: key, simVersion: SIM_VERSION, bot: 'medium', field: '0123456789abcdef' }, kind: 'screen', label: '-1 Mantis Blades → +1 Nadia: Fighting Through Grief', run: 'r', date: '2026-11-14', games: [{ seed: 1, opp: '0123456789abcdef', first: 0, base: 1, cand: 1 }] };
    fs.writeFileSync(path.join(ledger, `${listFingerprint(S205.deck)}.jsonl`), `${batchLine(b)}\n`);
    for (const q of ['−1 Mantis Blades → +1 Nadia: Fighting Through Grief', key]) {
      const r = await cmd(['s2-05-counter-rrg', '--change', q, '--ledger-dir', ledger, '--games', '14', '--dry-run']);
      expect(r.err).toEqual([]);
      expect(r.code).toBe(0);
      expect(r.out[0]).toBe('S2-05 Counter (RRG): -1 Mantis Blades → +1 Nadia: Fighting Through Grief');
      expect(r.jobs.slice(14).every((j) => listFingerprint(j.a) === listFingerprint({ ...S205.deck, main }))).toBe(true);
      expect(r.jobs[0]!.bot).toBe('hard');
    }
  });

  it('--before: the list in the file against the library list', async () => {
    const out = path.join(fresh(), 'r.json');
    const r = await cmd(['s2-06-counter-rgg', '--before', HISTORY, '--games', '14', '--out', out]);
    expect(r.err).toEqual([]);
    expect(r.code).toBe(0);
    const before = parseDeck(fs.readFileSync(HISTORY, 'utf8'), HISTORY).deck;
    const [row] = readRows(out);
    expect(row).toMatchObject({ deck: 's2-06-counter-rgg.txt', baseListId: listFingerprint(before), candListId: listFingerprint(S206.deck), cuts: ['shattered_memories'], adds: ['6th_street_recruits'], bot: 'hard' });
    expect(r.jobs[0]!.a.main.join()).toBe(before.main.join());
    expect(r.jobs[14]!.a).toBe(S206.deck);
  });
});

describe('refusals: exit 2, one sentence', () => {
  const refused = async (args: string[], pattern: RegExp) => {
    const r = await cmd(args);
    expect(r.code).toBe(2);
    expect(r.err).toHaveLength(1);
    expect(r.err[0]).toMatch(/^error: /);
    expect(r.err[0]).toMatch(pattern);
    expect(r.jobs).toEqual([]);
  };
  it('an unknown card, a cut the list does not hold, an illegal list', async () => {
    await refused(['s2-05-counter-rrg', '--cut', 'No Such Card', '--add', 'mantis_blades', '--dry-run'], /"No Such Card" is no card/);
    await refused(['s2-05-counter-rrg', '--cut', 'rockn_rockerboy', '--add', 'mantis_blades', '--dry-run'], /S2-05 Counter \(RRG\) holds no Rockn' Rockerboy in its main deck to cut\.$/);
    await refused(['s2-05-counter-rrg', '--cut-legend', S205.deck.legends[0]!, '--dry-run'], /the changed list is not a legal deck \(Needs exactly 3 Legends \(has 2\)\)\.$/);
  });
  it('a label that matches no change, or more than one', async () => {
    const ledger = path.join(fresh(), 'ledger');
    fs.mkdirSync(ledger, { recursive: true });
    const swap = (cut: string, add: string) => {
      const main = [...S205.deck.main];
      main[main.indexOf(cut)] = add;
      return changeKey(S205.deck, { ...S205.deck, main });
    };
    const line = (change: string) => batchLine({ entry: { change, simVersion: SIM_VERSION, bot: 'medium', field: '0123456789abcdef' }, kind: 'screen', label: 'the same words', run: 'r', date: '2026-11-14', games: [{ seed: 1, opp: '0123456789abcdef', first: 0, base: 1, cand: 0 }] });
    fs.writeFileSync(path.join(ledger, `${listFingerprint(S205.deck)}.jsonl`), `${line(swap('mantis_blades', 'nadia_fighting_through_grief'))}\n${line(swap('gunpoint_diplomacy', 'nadia_fighting_through_grief'))}\n`);
    await refused(['s2-05-counter-rrg', '--change', 'the same words', '--ledger-dir', ledger, '--dry-run'], /"the same words" is the label of 2 changes of S2-05 Counter \(RRG\) in the change ledger: give the change key instead/);
    await refused(['s2-05-counter-rrg', '--change', 'other words', '--ledger-dir', ledger, '--dry-run'], /no change of S2-05 Counter \(RRG\) in the change ledger .* has the label or key "other words"\.$/);
  });
  it('games not a multiple of 14, an unknown flag, two ways at once, hard-v1', async () => {
    await refused(['s2-05-counter-rrg', '--cut', 'mantis_blades', '--add', 'nadia_fighting_through_grief', '--games', '100', '--dry-run'], /--games must be a multiple of 14 \(7 meta decks × 2 seats\).*got 100\.$/);
    await refused(['s2-05-counter-rrg', '--cut', 'mantis_blades', '--add', 'nadia_fighting_through_grief', '--gmaes', '28'], /unknown option --gmaes/);
    await refused(['s2-05-counter-rrg', '--cut', 'mantis_blades', '--add', 'nadia_fighting_through_grief', '--before', HISTORY], /name the change one way only/);
    await refused(['s2-05-counter-rrg', '--cut', 'mantis_blades', '--add', 'nadia_fighting_through_grief', '--bot', 'hard-v1'], /hard-v1/);
  });
  it('a repeated id, and an identical measurement; --force adds it under a new id and replaces nothing', async () => {
    const out = path.join(fresh(), 'r.json');
    const base = ['s2-05-counter-rrg', '--cut', 'mantis_blades', '--add', 'nadia_fighting_through_grief', '--games', '14', '--out', out];
    expect((await cmd([...base, '--id', 'one'])).code).toBe(0);
    // the same id on another measurement
    await refused([...base, '--id', 'one', '--seed', '7'], /the id one is already in use/);
    // the same measurement under another id
    await refused([...base, '--id', 'two'], /the same measurement is already recorded as one \(the same lists, bot, simulator version, games and seed\)/);
    const before = fs.readFileSync(out, 'utf8');
    const forced = await cmd([...base, '--id', 'one', '--force']);
    expect(forced.code).toBe(0);
    const rows = readRows(out);
    expect(rows.map((m) => m.id)).toEqual(['one', 'one-2']);
    expect(fs.readFileSync(out, 'utf8').startsWith(before.replace(/\n \]\n\}\n$/, ''))).toBe(true);
    // ids are checked across the directory's files too
    const other = path.join(path.dirname(out), 'other.json');
    await refused([...base.slice(0, -1), other, '--id', 'one', '--seed', '9'], /the id one is already in use/);
  });
});

describe('the games and the file', () => {
  it('the job layout is exactly the forge’s: opponent k mod 7, seed + k, the list first when floor(k / 7) is even', async () => {
    const EVIDENCE_FILES = fs.readdirSync('data/evidence');
    const r = await cmd(['s2-05-counter-rrg', '--cut', 'mantis_blades', '--add', 'nadia_fighting_through_grief', '--games', '56', '--seed', '123', '--bot', 'lookahead', '--dry-run']);
    expect(r.code).toBe(0);
    expect(r.jobs).toHaveLength(112);
    const field = META.map((d) => d.deck);
    r.jobs.forEach((j, i) => {
      const k = i % 56;
      expect(Object.keys(j).sort()).toEqual(['a', 'b', 'bot', 'first', 'seed']);
      expect(j.b).toBe(field[k % 7]);
      expect(j.seed).toBe(123 + k);
      expect(j.first).toBe(Math.floor(k / 7) % 2);
      // lookahead is Medium: the ledger's canonical name is played
      expect(j.bot).toBe('medium');
      expect(j.a).toBe(i < 56 ? S205.deck : r.jobs[56]!.a);
    });
    expect(remeasureJobs(S205.deck, S205.deck, field, 14, 5_000_000, 'hard').map((j) => [j.seed, j.first])).toEqual(
      [...Array(2)].flatMap(() => Array.from({ length: 14 }, (_, k) => [5_000_000 + k, k < 7 ? 0 : 1])),
    );
    // --dry-run wrote nothing (the default file would be data/evidence/remeasure-2026-11-15.json)
    expect(fs.readdirSync('data/evidence')).toEqual(EVIDENCE_FILES);
  });

  it('appends to a file written by hand, keeping its earlier rows byte for byte; the result reads back', async () => {
    const out = path.join(fresh(), 'r.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const real = fs.readFileSync('data/evidence/remeasure-2026-11-15-p5.json', 'utf8');
    fs.writeFileSync(out, real);
    const r = await cmd(['s2-05-counter-rrg', '--cut', 'mantis_blades', '--add', 'nadia_fighting_through_grief', '--games', '14', '--out', out]);
    expect(r.err).toEqual([]);
    const after = fs.readFileSync(out, 'utf8');
    const head = real.replace(/\n \]\n\}\n$/, '');
    expect(after.startsWith(head)).toBe(true);
    expect(after.endsWith('\n ]\n}\n')).toBe(true);
    const rows = readRows(out);
    const old = (JSON.parse(real) as RemeasureFile).measurements;
    expect(rows.slice(0, -1)).toEqual(old);
    expect(rows.at(-1)!.id).toMatch(/^s2-05-counter-rrg-[0-9a-f]{8}-hard$/);
    // the new row is indented as the others
    expect(after.slice(head.length)).toMatch(/^,\n  \{\n   "id": /);
  });
});
