// The package's effect measured in pairs (REVIEW_2026-11-24 S1, B.10; src/ai/packageEffect.ts and
// scripts/package-effects.ts): the file read strictly, a seat's rows, the coach's gate and words, and the command with a
// stub game runner (no game is played here): the forge's job layout, one base block per list, the Bonferroni interval,
// the file written and merged, refusals.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { listFingerprint, parseDeck } from '../src/engine/deck';
import type { Decision, PlayerId } from '../src/engine/types';
import { CATALOGUE_VERSION } from '../src/content/synergies';
import { adviseRequest, coachRequest, packageNotes, packageWarnings } from '../src/ai/coach';
import { effectGate, effectLabel, PACKAGE_EFFECTS_KIND, packageEffectsProblems, readPackageEffects, seatEffects, type PackageEffectFile, type PackageEffectRow, type SeatEffects } from '../src/ai/packageEffect';
import { normalQuantile } from '../src/lib/evidence';
import { SIM_VERSION } from '../src/lib/tournament';
import { loadLibrary } from '../scripts/lib-node';
import { effectsText, estimateLines, familyZ, listJobs, listPlan, measurable, mergeList, packageEffects, type PackageEffectsIO } from '../scripts/package-effects-run';
import { remeasureJobs } from '../scripts/remeasure-run';
import type { MatchJob } from '../scripts/worker';
import { fillerDeck, gig, Scripted } from './engine-helpers';

const deck = (f: string) => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;
const BBG = deck('meta-bbg-cunningham-econ.txt');
const RRY = deck('meta-rry-smasher-aggro.txt');
const BBG_ID = listFingerprint(BBG);

const row = (o: Partial<PackageEffectRow> = {}): PackageEffectRow => ({
  listId: BBG_ID,
  deck: 'meta-bbg-cunningham-econ.txt',
  pkg: 'low-cred',
  withoutListId: '0123456789abcdef',
  cardsOut: ['towerfall', 'towerfall', 'towerfall'],
  cardsIn: ['psycho_squad', 'psycho_squad', 'psycho_squad'],
  bot: 'hard',
  simVersion: SIM_VERSION,
  games: 1120,
  seed: 9_000_000,
  opponents: ['0123456789abcdef'],
  mean: 0.061,
  se: 0.017,
  sd: 0.57,
  family: 3,
  low: 0.02,
  high: 0.102,
  date: '2026-11-24',
  ...o,
});
const file = (rows: PackageEffectRow[]): PackageEffectFile => ({ kind: PACKAGE_EFFECTS_KIND, schema: 1, catalogueVersion: CATALOGUE_VERSION, rows, skipped: [] });
const NOW = { simVersion: SIM_VERSION, catalogueVersion: CATALOGUE_VERSION, preferBot: 'hard' };

describe('the file and a seat’s rows', () => {
  it('reads a good file, refuses a bad one whole', () => {
    expect(readPackageEffects(file([row()]))).not.toBeNull();
    expect(packageEffectsProblems(file([row({ low: 0.2 })]))[0]).toContain('low ≤ mean ≤ high');
    expect(readPackageEffects({ ...file([row()]), schema: 2 })).toBeNull();
    expect(readPackageEffects(file([row(), row()]))).toBeNull();
    expect(readPackageEffects(file([row({ listId: 'nope' })]))).toBeNull();
    expect(readPackageEffects(null)).toBeNull();
  });

  it("a seat gets its list's rows of the current version and catalogue, the ratings' bot first", () => {
    const f = file([row(), row({ bot: 'medium', games: 5600, low: 0.05 }), row({ pkg: 'min-gig', simVersion: SIM_VERSION - 1 }), row({ listId: 'ffffffffffffffff' })]);
    const s = seatEffects(f, BBG_ID, NOW)!;
    expect(Object.keys(s)).toEqual(['low-cred']);
    expect(s['low-cred']!.bot).toBe('hard');
    expect(seatEffects(f, BBG_ID, { ...NOW, preferBot: 'medium' })!['low-cred']!.bot).toBe('medium');
    expect(seatEffects(f, BBG_ID, { ...NOW, catalogueVersion: 'other' })).toBeNull();
    expect(seatEffects(null, BBG_ID, NOW)).toBeNull();
    expect(seatEffects(f, undefined, NOW)).toEqual({});
  });

  it('the gate: a corrected interval above 0 is measured, a row without that hidden, no row unmeasured', () => {
    const s: SeatEffects = { a: row({ pkg: 'a' }), b: row({ pkg: 'b', low: 0, mean: 0.03 }), c: row({ pkg: 'c', low: -0.05, mean: -0.01, high: 0.03 }) };
    expect(effectGate(s, 'a')).toBe('measured');
    expect(effectGate(s, 'b')).toBe('hidden');
    expect(effectGate(s, 'c')).toBe('hidden');
    expect(effectGate(s, 'd')).toBe('unmeasured');
    expect(effectGate(null, 'a')).toBe('unmeasured');
    expect(effectLabel(s, [{ id: 'd', name: 'D' }, { id: 'e', name: 'E' }])).toBe('(D and E are ideas from the package catalogue, not measured on this list.)');
    expect(effectLabel(s, [{ id: 'a', name: 'A' }])).toBe(
      `(Measured on this list in the Hard bot's games, simulator version ${SIM_VERSION}: it won 6.1 points more often than the same list with A's own 3 cards swapped for others, range +2.0 to +10.2 points, over 1,120 paired games against the meta decks.)`,
    );
    expect(effectLabel(s, [{ id: 'b', name: 'B' }])).toBe('');
  });
});

// ---------------------------------------------------------------- the coach

function game(list = BBG): Game {
  const g = Game.create([list, fillerDeck('B')], [new Scripted(), new Scripted()], { seed: 5, first: 0 });
  g.s.turn = 3;
  g.s.phase = 'main';
  g.s.active = 0;
  for (const p of [0, 1] as PlayerId[]) for (const u of [...g.P(p).hand]) g.move(u, 'deck');
  return g;
}
function take(g: Game, p: PlayerId, id: string, zone: 'hand' | 'field' | 'trash') {
  const u = g.P(p).deck.find((x) => g.c(x).defId === id);
  if (u === undefined) throw new Error(`no ${id} left in the deck`);
  g.move(u, zone);
  return g.c(u);
}
function bbgSell() {
  const g = game();
  take(g, 0, 'towerfall', 'trash');
  take(g, 0, 'towerfall', 'trash');
  const keep = take(g, 0, 'towerfall', 'hand');
  const sell = take(g, 0, 'psycho_squad', 'hand');
  const d: Decision = { player: 0, kind: 'action', prompt: '', min: 1, max: 1, options: [{ label: `Sell ${g.name(sell.uid)}`, action: { type: 'sell', uid: sell.uid } }, { label: `Sell ${g.name(keep.uid)}`, action: { type: 'sell', uid: keep.uid } }] };
  return { g, d };
}
const KEEP = 'Keep Towerfall: it is your only payoff for Behind on Street Cred left, and it pairs with Jackie Welles: Pour One Out For Me in your deck.';

describe('the coach, gated by the paired measurement', () => {
  it('BBG sell: measured above 0 named with the effect; not above 0 left out; no row (or no file) an unmeasured idea', () => {
    const { g, d } = bbgSell();
    expect(packageNotes(g, d, 0, undefined, { 'low-cred': row() })).toEqual([
      `${KEEP} (Measured on this list in the Hard bot's games, simulator version ${SIM_VERSION}: it won 6.1 points more often than the same list with Behind on Street Cred's own 3 cards swapped for others, range +2.0 to +10.2 points, over 1,120 paired games against the meta decks.)`,
    ]);
    expect(packageNotes(g, d, 0, undefined, { 'low-cred': row({ low: -0.01 }) })).toEqual([]);
    const idea = `${KEEP} (Behind on Street Cred is an idea from the package catalogue, not measured on this list.)`;
    expect(packageNotes(g, d, 0, undefined, {})).toEqual([idea]);
    expect(packageNotes(g, d, 0, undefined, null)).toEqual([idea]);
    // the paired measurement wins over a lift that would hide the package
    const hidingLift = { 'low-cred': { basis: 'list' as const, online: 0.4, never: 0.5, onlineGames: 100, neverGames: 100, lift: -0.1, low95: -0.2, high95: 0 } };
    expect(packageNotes(g, d, 0, hidingLift)).toEqual([]);
    expect(packageNotes(g, d, 0, hidingLift, { 'low-cred': row() })).toHaveLength(1);
  });

  it('RRY warning follows the same gate', () => {
    const g = game(RRY);
    take(g, 0, 'gunpoint_diplomacy', 'hand');
    gig(g, 0, 4, 2);
    gig(g, 1, 6, 5);
    expect(packageWarnings(g, 0, undefined, { 'high-cred': row({ pkg: 'high-cred', low: -0.02 }) })).toEqual([]);
    expect(packageWarnings(g, 0, undefined, {})[0]).toContain('not measured on this list');
  });

  it('the measurement crosses to the worker in the request', async () => {
    const { g, d } = bbgSell();
    const req = structuredClone(coachRequest(g, d, undefined, { 'low-cred': row() }));
    expect(req.effects).toEqual({ 'low-cred': row() });
    expect((await adviseRequest(req)).why).toContain('Measured on this list');
    expect('effects' in coachRequest(g, d)).toBe(false);
    expect(coachRequest(g, d, undefined, null).effects).toBeNull();
  }, 30_000);
});

describe('the published file and the Play page', () => {
  it('public/data/package-effects.json reads, names its bot on every row, and gives a library list its rows', () => {
    const f = readPackageEffects(JSON.parse(readFileSync('public/data/package-effects.json', 'utf8')))!;
    expect(f).not.toBeNull();
    expect(f.catalogueVersion).toBe(CATALOGUE_VERSION);
    expect(f.rows.length).toBeGreaterThan(100);
    // one simulator version for the whole file: measured 2026-11-24 on version 9, so since SIM_VERSION 10 (2026-11-25)
    // the coach reads none of its rows (a row of another version is never used) until the file is measured again
    const v = f.rows[0]!.simVersion;
    expect(f.rows.every((r) => r.bot && r.simVersion === v)).toBe(true);
    expect(v).toBeLessThanOrEqual(SIM_VERSION);
    const own = seatEffects(f, BBG_ID, { ...NOW, simVersion: v })!;
    expect(Object.keys(own).length).toBeGreaterThan(0);
    if (v !== SIM_VERSION) expect(Object.keys(seatEffects(f, BBG_ID, NOW) ?? {})).toEqual([]);
  });

  it('Play fetches it only while the coach is on and sends the seat’s rows in place of the lift', () => {
    const play = readFileSync('src/ui/pages/Play.tsx', 'utf8');
    expect(play).toContain('usePackageEffects(coach)');
    expect(play).toContain('advise(g, pend, undefined, effects0)');
    expect(play).not.toContain('useLiftSlice');
  });
});

// ---------------------------------------------------------------- the command

const LIB = loadLibrary();
const META = LIB.filter((d) => d.kind === 'meta');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-package-effects-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const fresh = () => path.join(tmp, `case-${++n}.json`);

function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

async function cmd(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const jobs: MatchJob[] = [];
  const io: PackageEffectsIO = {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    play: async (js) => {
      jobs.push(...js);
      // each list its own strength; the full list a little stronger than every list without a package
      return js.map((j) => {
        const fp = listFingerprint(j.a);
        const strength = fp === BBG_ID ? 0.6 : 0.45 + 0.1 * unit(`l:${fp}`);
        return { winner: unit(`g:${j.seed}:${j.b.name}:${j.first}:${fp}`) < strength ? (0 as const) : (1 as const) };
      });
    },
    now: () => new Date('2026-11-24T12:00:00Z'),
    library: () => LIB,
  };
  const code = await packageEffects(args, io);
  return { code, out, err, jobs };
}

describe('the command (scripts/package-effects.ts)', () => {
  const bbg = LIB.find((d) => d.file === 'meta-bbg-cunningham-econ.txt')!;
  const plan = listPlan(bbg);
  const items = plan.items.filter(measurable);

  it("plans each of the list's packages with the list's other packages kept, or says why not", () => {
    expect(plan.listId).toBe(BBG_ID);
    expect(items.length).toBeGreaterThan(0);
    for (const x of items) {
      expect(x.cardsOut.length).toBeGreaterThan(0);
      expect(x.without.main.length).toBe(BBG.main.length);
      expect(listFingerprint(x.without)).not.toBe(BBG_ID);
    }
    for (const x of plan.items.filter((y) => !measurable(y))) expect((x as { why: string }).why).toMatch(/^no legal list without /);
  });

  it('plays the list once and each list without a package on the same games, the forge’s layout; writes rows that read back', async () => {
    const out = fresh();
    const r = await cmd(['meta-bbg-cunningham-econ.txt', '--games', '28', '--out', out, '--bot', 'medium']);
    expect(r.code, r.err.join('\n')).toBe(0);
    expect(r.jobs).toHaveLength(28 * (1 + items.length));
    expect(r.jobs.slice(0, 28)).toEqual(remeasureJobs(bbg.deck, items[0]!.without, META.map((d) => d.deck), 28, 9_000_000, 'medium').slice(0, 28));
    expect(r.jobs.slice(28, 56)).toEqual(listJobs(items[0]!.without, META.map((d) => d.deck), 28, 9_000_000, 'medium'));
    const f = readPackageEffects(JSON.parse(fs.readFileSync(out, 'utf8')))!;
    expect(f).not.toBeNull();
    expect(f.rows.map((x) => x.pkg).sort()).toEqual(items.map((x) => x.pkg).sort());
    for (const x of f.rows) {
      expect(x.family).toBe(items.length);
      expect(x.bot).toBe('medium');
      expect(x.games).toBe(28);
      expect(x.high - x.mean).toBeCloseTo(familyZ(items.length) * x.se, 5);
    }
    expect(f.skipped.map((s) => s.pkg).sort()).toEqual(plan.items.filter((x) => !measurable(x)).map((x) => x.pkg).sort());
    expect(fs.readFileSync(out, 'utf8')).toBe(effectsText(f));
    // again without --force: refused before any game; with it, the rows are replaced, not doubled
    const again = await cmd(['meta-bbg-cunningham-econ.txt', '--games', '28', '--out', out, '--bot', 'medium']);
    expect(again.code).toBe(2);
    expect(again.jobs).toHaveLength(0);
    expect(again.err[0]).toContain('already measured');
    expect((await cmd(['meta-bbg-cunningham-econ.txt', '--games', '28', '--out', out, '--bot', 'medium', '--force'])).code).toBe(0);
    expect(readPackageEffects(JSON.parse(fs.readFileSync(out, 'utf8')))!.rows).toHaveLength(items.length);
  });

  it('--estimate and --dry-run write nothing; bad values are refused with exit 2', async () => {
    const out = fresh();
    const e = await cmd(['meta-bbg-cunningham-econ.txt', '--estimate', '--out', out]);
    expect(e.code).toBe(0);
    expect(e.jobs).toHaveLength(0);
    expect(e.out.join('\n')).toMatch(/Hard: about .* on \d+ threads/);
    expect((await cmd(['meta-bbg-cunningham-econ.txt', '--games', '14', '--dry-run', '--out', out])).code).toBe(0);
    expect(fs.existsSync(out)).toBe(false);
    expect((await cmd(['meta-bbg-cunningham-econ.txt', '--games', '15'])).code).toBe(2);
    expect((await cmd(['meta-bbg-cunningham-econ.txt', '--bot', 'hard-v1'])).code).toBe(2);
    expect((await cmd(['no-such-deck-anywhere'])).code).toBe(2);
    expect((await cmd(['--bogus'])).code).toBe(2);
  });

  it('merging keeps other lists and other bots, replaces this list’s rows for this bot', () => {
    const f = file([row(), row({ bot: 'lookahead' }), row({ listId: 'ffffffffffffffff' })]);
    const m = mergeList(f, BBG_ID, [row({ mean: 0.07, high: 0.11 })], [], 'hard');
    expect(m.rows).toHaveLength(3);
    expect(m.rows.find((x) => x.listId === BBG_ID && x.bot === 'hard')!.mean).toBe(0.07);
  });

  it('the Bonferroni z and the estimate', () => {
    expect(familyZ(1)).toBeCloseTo(1.96, 2);
    expect(familyZ(4)).toBeCloseTo(normalQuantile(1 - 0.05 / 8), 10);
    const lines = estimateLines([plan], 1120, 12);
    expect(lines[1]).toContain(`${(1120 * (1 + items.length)).toLocaleString('en-US')} games in all`);
  });
});
