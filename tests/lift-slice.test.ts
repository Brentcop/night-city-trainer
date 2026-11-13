// RAG_PLAN step 0.1: the Play page reads the lift slice (public/data/lift.json), not the whole synergy report, and only
// while the coach is on. The slice must give the coach exactly the table the report gave (`seatLift`), for every list.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { liftSlice, liftSliceText, readLiftSlice, seatLift, seatLiftFromSlice } from '../src/ai/packageLift';
import type { SynergyReport, SynergyRow } from '../src/analysis/synergies';
import { checkData, liftProblems, type CheckInput } from '../scripts/check-data';

// useLiftSlice without a DOM: effects run at once, state is a plain holder (only the loader module sees this React)
const hook = vi.hoisted(() => ({ cleanups: [] as (() => void)[], values: [] as unknown[] }));
vi.mock('react', async (orig) => ({
  ...(await orig<typeof import('react')>()),
  useState: <T,>(init: T) => [init, (x: T) => void hook.values.push(x)] as const,
  useEffect: (f: () => void | (() => void)) => {
    const c = f();
    if (c) hook.cleanups.push(c);
  },
}));

const slice = (games: number, wr: number, lo: number, hi: number, thin = false) => ({ uses: 0, games, winRate: thin ? null : wr, low95: thin ? null : lo, high95: thin ? null : hi, thin });
const row = (id: string, on: ReturnType<typeof slice>, nv: ReturnType<typeof slice>) => ({ id, name: id, online: on, never: nv }) as unknown as SynergyRow;
const FIXTURE = {
  kind: 'synergy-report',
  catalogueVersion: 'fnv1a64:test',
  decks: [
    { listId: 'L1', name: 'x', games: 300, winRate: 0.5, synergies: [row('a', slice(100, 0.7, 0.6, 0.78), slice(100, 0.4, 0.3, 0.5)), row('b', slice(10, 0, 0, 0, true), slice(200, 0.5, 0.43, 0.57))] },
    // nothing measured on this list: left out of the slice, and the pooled table is all it gets
    { listId: 'L2', name: 'y', games: 20, winRate: 0.5, synergies: [row('a', slice(5, 0, 0, 0, true), slice(15, 0.5, 0.3, 0.7))] },
    // a second entry for L1 is never read (seatLift takes the first)
    { listId: 'L1', name: 'x again', games: 300, winRate: 0.5, synergies: [row('z', slice(100, 0.9, 0.8, 0.95), slice(100, 0.1, 0.05, 0.2))] },
  ],
  pooled: [row('b', slice(400, 0.6, 0.55, 0.65), slice(400, 0.5, 0.45, 0.55)), row('a', slice(500, 0.5, 0.46, 0.54), slice(500, 0.5, 0.46, 0.54)), row('c', slice(5, 0, 0, 0, true), slice(500, 0.5, 0.46, 0.54))],
} as unknown as SynergyReport;

const REAL = JSON.parse(readFileSync('public/data/synergies.json', 'utf8')) as SynergyReport;

/** The contract: for every list of the report, an unknown list, no list, and a report from another catalogue. */
function expectContract(report: SynergyReport) {
  const s = readLiftSlice(JSON.parse(liftSliceText(report)));
  expect(s).not.toBeNull();
  const ids = [...new Set(report.decks.map((d) => d.listId))];
  for (const id of [...ids, 'no-such-list', undefined, 'constructor'])
    for (const current of [true, false]) expect(seatLiftFromSlice(s, id, current), `${id} ${current}`).toEqual(seatLift(report, id, current));
  return ids.length;
}

describe('lift slice (src/ai/packageLift.ts)', () => {
  it('gives the same seat table as the report: a small fixture', () => {
    expect(expectContract(FIXTURE)).toBe(2);
    const s = liftSlice(FIXTURE);
    expect(Object.keys(s.lists)).toEqual(['L1']);
    expect(Object.keys(s.pooled)).toEqual(['a', 'b']); // sorted, the thin row left out
    expect(seatLiftFromSlice(null, 'L1')).toBeNull();
    expect(seatLiftFromSlice(s, 'L1')!.z).toBeUndefined();
  });

  it('gives the same seat table as the report: every list of public/data/synergies.json', () => {
    const n = expectContract(REAL);
    expect(n).toBe(REAL.decks.length);
    expect(n).toBeGreaterThan(40);
  });

  it('keeps the numbers unrounded and the bytes stable (rule M8)', () => {
    const s = liftSlice(REAL);
    const t = seatLift(REAL, REAL.decks[0]!.listId)!;
    for (const [id, l] of Object.entries(t)) expect(seatLiftFromSlice(s, REAL.decks[0]!.listId)![id]!.low95).toBe(l.low95);
    expect(liftSliceText(JSON.parse(JSON.stringify(REAL)))).toBe(liftSliceText(REAL));
  });

  it('readLiftSlice refuses what is not a slice', () => {
    const good = JSON.parse(liftSliceText(FIXTURE));
    expect(readLiftSlice(good)).toEqual(good);
    for (const bad of [
      null,
      42,
      [],
      { ...good, kind: 'synergy-report' },
      { ...good, schema: 2 },
      { ...good, catalogueVersion: 7 },
      { ...good, pooled: [] },
      { ...good, pooled: { a: { ...good.pooled.a, low95: '0.1' } } },
      { ...good, pooled: { a: { ...good.pooled.a, basis: 'other' } } },
      { ...good, lists: null },
      { ...good, lists: { L1: { a: null } } },
    ])
      expect(readLiftSlice(bad), JSON.stringify(bad)).toBeNull();
  });

  it('the tracked public/data/lift.json is the slice of the tracked report', () => {
    expect(readFileSync('public/data/lift.json', 'utf8')).toBe(liftSliceText(REAL));
  });
});

describe('check:data and the lift slice', () => {
  const base = (): CheckInput => ({ index: { events: [] }, events: [], h2h: { events: 0, games: 0 }, ratings: null });
  const text = liftSliceText(FIXTURE);

  it('passes the slice of the report and says so once', () => {
    const r = checkData({ ...base(), synergies: FIXTURE, lift: text });
    expect(r.failures).toEqual([]);
    expect(r.passed.filter((p) => p.includes('lift.json'))).toEqual(['public/data/lift.json is the slice of the synergy report (2 pooled rows, 1 lists)']);
    // no report: not checked
    expect(checkData({ ...base(), lift: text }).passed.some((p) => p.includes('lift.json'))).toBe(false);
  });

  it('fails a stale, missing or unreadable slice, saying what differs and how to rebuild it', () => {
    const stale = JSON.parse(text);
    stale.pooled.a.low95 = 0.5;
    delete stale.lists.L1;
    stale.lists.L9 = stale.pooled;
    const r = checkData({ ...base(), synergies: FIXTURE, lift: JSON.stringify(stale) });
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toMatch(/lift\.json is stale against public\/data\/synergies\.json: pooled row\(s\) differ: a; 1 list\(s\) missing \(L1\); 1 list\(s\) the report does not measure \(L9\)/);
    expect(r.failures[0]).toMatch(/npx tsx scripts\/build-lift\.ts/);
    // the report changed under the slice
    const moved = { ...FIXTURE, catalogueVersion: 'fnv1a64:new' } as SynergyReport;
    expect(liftProblems(moved, text)[0]).toMatch(/catalogue fnv1a64:test, the report's is fnv1a64:new/);
    // same content, other bytes
    expect(liftProblems(FIXTURE, JSON.stringify(JSON.parse(text), null, 1))[0]).toMatch(/same content, other bytes/);
    expect(liftProblems(FIXTURE, null)[0]).toMatch(/lift\.json is missing.*build-lift/);
    expect(liftProblems(FIXTURE, 'not json')[0]).toMatch(/is not a lift slice/);
  });
});

describe('Play loads the slice only while the coach is on', () => {
  let fetch: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.resetModules();
    hook.cleanups.length = 0;
    hook.values.length = 0;
    fetch = vi.fn(async () => ({ ok: true, json: async () => JSON.parse(liftSliceText(REAL)) }));
    vi.stubGlobal('fetch', fetch);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('useLiftSlice(false) makes no request; useLiftSlice(true) requests data/lift.json once', async () => {
    const { useLiftSlice } = await import('../src/ui/synergyReport');
    expect(useLiftSlice(false)).toEqual({ state: 'loading' });
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
    useLiftSlice(true);
    useLiftSlice(true); // a re-render or another board: the fetch is shared
    await vi.waitFor(() => expect(hook.values).toHaveLength(2));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]![0])).toMatch(/(^|\/)data\/lift\.json$/);
    expect(hook.values[0]).toMatchObject({ state: 'ready', current: true, slice: { kind: 'nct-lift' } });
  });

  it('a missing or malformed file reads as missing', async () => {
    fetch.mockImplementation(async () => ({ ok: false, json: async () => null }));
    const { loadLiftSlice } = await import('../src/ui/synergyReport');
    expect(await loadLiftSlice()).toEqual({ state: 'missing' });
  });

  it('Play.tsx no longer reads the whole report', () => {
    const src = readFileSync('src/ui/pages/Play.tsx', 'utf8');
    expect(src).not.toMatch(/useSynergyReport|synergies\.json/);
    expect(src).toContain('useLiftSlice(coach)');
  });
});
