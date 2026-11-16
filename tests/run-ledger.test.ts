// Your tournaments (src/lib/runLedger.ts, src/lib/runLedgerEntry.ts): the ledger entry of a finished run (the games the
// recorded ratings read, by list), add / replace / cap, the one-time fold of the runner's saved runs, the simulator
// filter, malformed input, the record per list by bots, and the storage helpers (checked writes; nct.runs.v1 never
// written). Pure where it can be; storage is an in-memory stand-in.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN } from '../src/lib/browserLibrary';
import { listFingerprint } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import {
  addRun,
  capLedger,
  clearedLedger,
  clearLedger,
  countedRuns,
  emptyLedger,
  LEDGER_KEY,
  LEDGER_KIND,
  ledgerSummary,
  loadLedger,
  parseLedger,
  parseRun,
  saveLedger,
  yourRecords,
  type LedgerRun,
} from '../src/lib/runLedger';
import { foldSavedRuns, ledgerRunOf, migrateSavedRuns, recordRun, SAVED_RUNS_KEY } from '../src/lib/runLedgerEntry';

const [D0, D1, D2] = BUILTIN.map((d) => d.deck) as [DeckList, DeckList, DeckList];
const fp = (d: DeckList) => listFingerprint(d);
/** D0 with one card changed: an edited list */
const EDITED: DeckList = { ...D0, name: 'Edited', main: [D1.main[0]!, ...D0.main.slice(1)] };

type G = [first: 0 | 1, winner: 0 | 1 | 'tie'];
/** A runner event (TourneyEvent's shape) with these decks and matches (one round each). */
function event(o: {
  id?: string | number;
  phase?: string;
  simVersion?: number;
  bot?: string;
  date?: string;
  decks: Record<string, DeckList>;
  matches: [string, string | null, G[]][];
  champion?: string | null;
  setup?: unknown;
}) {
  return {
    id: o.id ?? 'run-1',
    date: o.date ?? '2026-11-14T10:00:00.000Z',
    bot: o.bot ?? 'hard',
    format: 'Swiss · Bo3',
    name: 'Swiss · 3 decks',
    decks: Object.fromEntries(Object.entries(o.decks).map(([n, d]) => [n, { legends: d.legends, main: d.main }])),
    rounds: o.matches.map(([a, b, games], i) => ({ round: i + 1, matches: [{ a, b, games: games.map(([first, winner], k) => ({ seed: k, first, winner, turns: 9, reason: '' })), winner: a, score: [0, 0] }] })),
    bracket: [],
    standings: [],
    champion: o.champion ?? null,
    phase: o.phase ?? 'done',
    simVersion: o.simVersion ?? CURRENT_SIM_VERSION,
    ...(o.setup ? { setup: o.setup } : {}),
  };
}

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('ledger entry of a run', () => {
  it('keeps every game as (a, b, who went first, a’s score) and each deck as its list', () => {
    const run = ledgerRunOf(
      event({
        decks: { A: D0, B: D1, C: D2 },
        matches: [
          ['A', 'B', [[0, 0], [1, 1], [0, 'tie']]],
          ['C', null, []],
        ],
        champion: 'B',
      }),
    )!;
    expect(run.decks).toEqual([
      { name: 'A', list: fp(D0) },
      { name: 'B', list: fp(D1) },
      { name: 'C', list: fp(D2) },
    ]);
    expect(run.games).toEqual([
      [0, 1, 0, 1],
      [0, 1, 1, 0],
      [0, 1, 0, 0.5],
    ]);
    expect(run.champion).toBe(1);
    expect(run.simVersion).toBe(CURRENT_SIM_VERSION);
    expect(run.bot).toBe('hard');
    // the stored entry reads back as itself
    expect(parseRun(JSON.parse(JSON.stringify(run)))).toEqual(run);
  });

  it('only a finished run gives one', () => {
    const e = { decks: { A: D0, B: D1 }, matches: [['A', 'B', [[0, 0]]]] as [string, string, G[]][] };
    expect(ledgerRunOf(event({ ...e, phase: 'done' }))).not.toBeNull();
    for (const phase of ['stopped', 'swiss', 'rounds', 'top']) expect(ledgerRunOf(event({ ...e, phase }))).toBeNull();
  });

  it('a copy ("X #2") plays as X, and its games against X count for neither', () => {
    const setup = { format: 'swiss', bestOf: 3, entrants: [{ name: 'A' }, { name: 'A #2', copyOf: 'A' }, { name: 'B' }] };
    const run = ledgerRunOf(
      event({
        decks: { A: D0, 'A #2': D0, B: D1 },
        matches: [
          ['A', 'A #2', [[0, 0], [1, 0]]],
          ['A #2', 'B', [[0, 0]]],
        ],
        champion: 'A #2',
        setup,
      }),
    )!;
    expect(run.decks.map((d) => d.name)).toEqual(['A', 'B']);
    expect(run.games).toEqual([[0, 1, 0, 1]]);
    expect(run.champion).toBe(0);
  });

  it('a finished run with copies: every copy’s games count under the deck’s list, the mirror games for nothing', () => {
    // A and two copies; B once. A vs A #2 and A #2 vs A #3 are mirrors (5 games); the rest are 6 games against B.
    const setup = { format: 'round-robin', bestOf: 3, entrants: [{ name: 'A' }, { name: 'A #2', copyOf: 'A' }, { name: 'A #3', copyOf: 'A' }, { name: 'B' }] };
    const ev = event({
      decks: { A: D0, 'A #2': D0, 'A #3': D0, B: D1 },
      matches: [
        ['A', 'A #2', [[0, 0], [1, 1], [0, 0]]],
        ['A #2', 'A #3', [[0, 1], [1, 'tie']]],
        ['A', 'B', [[0, 0], [1, 0]]],
        ['B', 'A #2', [[0, 0], [1, 1]]],
        ['A #3', 'B', [[0, 'tie'], [1, 1]]],
      ],
      champion: 'A #3',
      setup,
    });
    expect(recordRun(ev)).toBe('saved');
    const ledger = loadLedger();
    // stored: the deck once (its name, not an entrant's), only the six games against B
    expect(ledger.runs[0]!.decks.map((d) => d.name)).toEqual(['A', 'B']);
    expect(ledger.runs[0]!.games).toHaveLength(6);
    const a = yourRecords(ledger).get(fp(D0))!;
    // A: won 2 (A vs B), 1-1 (A #2 vs B, from A #2's side: B won game 1, A #2 won game 2), a tie and a loss (A #3 vs B)
    expect([a.games, a.wins, a.losses, a.ties]).toEqual([6, 3, 2, 1]);
    expect(a.runs).toBe(1); // one tournament, though entered three times
    expect(a.won).toBe(1); // the copy's title is the deck's
    const b = yourRecords(ledger).get(fp(D1))!;
    expect([b.games, b.wins, b.losses, b.ties]).toEqual([6, 2, 3, 1]);
    expect(ledgerSummary(ledger).games).toBe(6);
  });

  it('two entrants with the same list under different names: their games count for neither', () => {
    const run = ledgerRunOf(event({ decks: { A: D0, 'Renamed A': { ...D0, name: 'Renamed A' }, B: D1 }, matches: [['A', 'Renamed A', [[0, 0]]], ['Renamed A', 'B', [[1, 1]]]] }))!;
    expect(run.games).toEqual([[1, 2, 1, 0]]);
    // and both names keep one record, by list
    const rec = yourRecords(addRun(emptyLedger(), run)).get(fp(D0))!;
    expect(rec.games).toBe(1);
    expect(rec.losses).toBe(1);
  });

  it('reads a malformed run without throwing: no run, or the well-formed games only', () => {
    for (const x of [null, 3, 'x', [], {}, { phase: 'done' }, { phase: 'done', id: 1, date: 'not a date', decks: {} }]) expect(ledgerRunOf(x)).toBeNull();
    const bad = event({ decks: { A: D0, B: D1, C: { name: 'C', legends: 'x' } as unknown as DeckList }, matches: [['A', 'B', [[0, 0], [2 as 0, 0], [0, 'draw' as 'tie']]], ['A', 'C', [[0, 0]]]] });
    const run = ledgerRunOf(bad)!;
    expect(run.games).toEqual([[0, 1, 0, 1]]);
    expect(run.decks.map((d) => d.name)).toEqual(['A', 'B']);
  });
});

const run = (id: string, o: Partial<LedgerRun> = {}): LedgerRun => ({
  id,
  date: '2026-11-14T10:00:00.000Z',
  simVersion: CURRENT_SIM_VERSION,
  bot: 'hard',
  format: 'Swiss',
  decks: [
    { name: 'A', list: 'aaaa' },
    { name: 'B', list: 'bbbb' },
  ],
  games: [[0, 1, 0, 1]],
  champion: 0,
  ...o,
});

describe('the ledger document', () => {
  it('adds runs newest first, replaces a run added twice, and remembers every id taken in', () => {
    let l = addRun(emptyLedger(), run('r1', { date: '2026-11-10T00:00:00Z' }));
    l = addRun(l, run('r2', { date: '2026-11-12T00:00:00Z' }));
    l = addRun(l, run('r1', { date: '2026-11-10T00:00:00Z', games: [] }));
    expect(l.runs.map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(l.runs[1]!.games).toEqual([]);
    expect(l.folded.sort()).toEqual(['r1', 'r2']);
  });

  it('is capped by runs and by size, oldest first', () => {
    let l = emptyLedger();
    for (let i = 0; i < 6; i++) l = addRun(l, run(`r${i}`, { date: `2026-11-1${i}T00:00:00Z` }), { maxRuns: 4 });
    expect(l.runs.map((r) => r.id)).toEqual(['r5', 'r4', 'r3', 'r2']);
    const one = JSON.stringify({ ...emptyLedger(), runs: [run('x')] }).length;
    const capped = capLedger({ ...l, runs: l.runs }, { maxChars: one + 100 });
    expect(capped.runs.map((r) => r.id)).toEqual(['r5']);
    // a lone run bigger than the cap is not kept
    expect(capLedger(l, { maxChars: 10 }).runs).toEqual([]);
  });

  it('reads malformed input as an empty ledger or drops only the bad runs, never throwing', () => {
    for (const raw of [null, '', 'not json', '[]', '{"kind":"other","schema":1}', `{"kind":"${LEDGER_KIND}","schema":2,"runs":[]}`]) expect(parseLedger(raw)).toEqual(emptyLedger());
    const good = run('ok');
    const raw = JSON.stringify({
      kind: LEDGER_KIND,
      schema: 1,
      runs: [good, { ...good, id: 'bad-game', games: [[0, 5, 0, 1]] }, { ...good, id: 'bad-score', games: [[0, 1, 0, 0.7]] }, { ...good, id: 'bad-list', decks: [{ name: 'A', list: 'NOT A FP!' }] }, 'x', good],
      folded: ['ok', 3, 'b'],
    });
    const l = parseLedger(raw);
    expect(l.runs.map((r) => r.id)).toEqual(['ok']);
    expect(l.folded).toEqual(['ok', 'b']);
  });

  it('counts only the current simulator; older runs are kept and counted as left out', () => {
    const l = addRun(addRun(emptyLedger(), run('new')), run('old', { simVersion: CURRENT_SIM_VERSION - 1, date: '2026-11-01T00:00:00Z' }));
    expect(countedRuns(l).counted.map((r) => r.id)).toEqual(['new']);
    expect(countedRuns(l).older).toBe(1);
    expect(l.runs).toHaveLength(2);
    expect(yourRecords(l).get('aaaa')!.games).toBe(1);
    expect(ledgerSummary(addRun(l, run('unknown', { simVersion: null })))).toMatchObject({ runs: 1, games: 1, older: 2 });
  });

  it('a list’s record: by bots, ties half, tournaments played and won', () => {
    let l = addRun(emptyLedger(), run('h', { games: [[0, 1, 0, 1], [0, 1, 1, 0.5], [1, 0, 0, 1]] }));
    l = addRun(l, run('m', { bot: 'medium', champion: 1, games: [[0, 1, 0, 0]], date: '2026-11-13T00:00:00Z' }));
    const a = yourRecords(l).get('aaaa')!;
    expect(a).toMatchObject({ games: 4, wins: 1, losses: 2, ties: 1, runs: 2, won: 1, name: 'A' });
    expect(a.wr).toBeCloseTo(1.5 / 4);
    expect(a.byBot).toEqual([
      { bot: 'hard', rec: { games: 3, wins: 1, losses: 1, ties: 1 } },
      { bot: 'medium', rec: { games: 1, wins: 0, losses: 1, ties: 0 } },
    ]);
    expect(yourRecords(l).get('bbbb')).toMatchObject({ games: 4, wins: 2, losses: 1, ties: 1, won: 1 });
    expect(ledgerSummary(l)).toEqual({ runs: 2, games: 4, hardRuns: 1, hardGames: 3, older: 0 });
  });
});

describe('the saved runs (nct.runs.v1) are folded in once each', () => {
  const doneA = event({ id: 'run-a', decks: { A: D0, B: D1 }, matches: [['A', 'B', [[0, 0]]]], date: '2026-11-10T00:00:00Z' });
  const doneB = event({ id: 'run-b', decks: { A: D0, B: D1 }, matches: [['A', 'B', [[1, 1]]]], date: '2026-11-11T00:00:00Z' });
  const stopped = event({ id: 'run-c', phase: 'stopped', decks: { A: D0, B: D1 }, matches: [['A', 'B', [[1, 1]]]] });
  // the runner keeps its saved runs newest first
  const saved = JSON.stringify([stopped, doneB, doneA]);

  it('takes the finished runs, skips the unfinished, and does nothing the second time', () => {
    const first = foldSavedRuns(emptyLedger(), saved);
    expect(first.added).toBe(2);
    expect(first.ledger.runs.map((r) => r.id)).toEqual(['run-b', 'run-a']);
    expect(first.ledger.folded).not.toContain('run-c');
    const again = foldSavedRuns(first.ledger, saved);
    expect(again.changed).toBe(false);
    expect(again.ledger).toBe(first.ledger);
  });

  it('a cleared ledger does not take them back; garbage is ignored', () => {
    const cleared = clearedLedger(foldSavedRuns(emptyLedger(), saved).ledger);
    expect(cleared.runs).toEqual([]);
    expect(foldSavedRuns(cleared, saved).changed).toBe(false);
    for (const raw of [null, 'x', '{}', '[1, null, {"phase":"done"}]']) expect(foldSavedRuns(emptyLedger(), raw).added).toBe(0);
    // a finished run that cannot be read is remembered, so it is not read again
    const broken = foldSavedRuns(emptyLedger(), JSON.stringify([{ id: 'zz', phase: 'done', date: 'nope', decks: {} }]));
    expect(broken.ledger.folded).toEqual(['zz']);
    expect(broken.ledger.runs).toEqual([]);
  });

  it('storage: migrate and record write the ledger only, never the saved runs', () => {
    localStorage.setItem(SAVED_RUNS_KEY, saved);
    expect(migrateSavedRuns()).toBe(true);
    expect(loadLedger().runs.map((r) => r.id)).toEqual(['run-b', 'run-a']);
    expect(localStorage.getItem(SAVED_RUNS_KEY)).toBe(saved);
    // the runner records a finished run, and not a stopped one
    expect(recordRun({ ...stopped, id: 'run-d' })).toBe('skipped');
    expect(loadLedger().runs).toHaveLength(2);
    expect(recordRun({ ...doneA, id: 'run-e', date: '2026-11-12T00:00:00Z' })).toBe('saved');
    expect(loadLedger().runs.map((r) => r.id)).toEqual(['run-e', 'run-b', 'run-a']);
    // recorded twice: replaced, not doubled
    expect(recordRun({ ...doneA, id: 'run-e', date: '2026-11-12T00:00:00Z' })).toBe('saved');
    expect(loadLedger().runs).toHaveLength(3);
    expect(localStorage.getItem(SAVED_RUNS_KEY)).toBe(saved);
    // clear: runs gone, the saved runs stay and are not folded in again
    expect(clearLedger()).toBe(true);
    expect(loadLedger().runs).toEqual([]);
    expect(migrateSavedRuns()).toBe(true);
    expect(loadLedger().runs).toEqual([]);
    expect(localStorage.getItem(SAVED_RUNS_KEY)).toBe(saved);
  });

  it('a refused write is reported, and nothing else is touched', () => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k === SAVED_RUNS_KEY ? '[]' : null),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    });
    expect(saveLedger(addRun(emptyLedger(), run('x')))).toBe(false);
    expect(recordRun(doneA)).toBe('refused');
    expect(clearLedger()).toBe(false);
    // storage that cannot even be read gives an empty ledger
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(loadLedger()).toEqual(emptyLedger());
    expect(migrateSavedRuns()).toBe(true);
  });

  it('the stored document has its own kind and schema', () => {
    expect(saveLedger(addRun(emptyLedger(), run('x')))).toBe(true);
    expect(JSON.parse(localStorage.getItem(LEDGER_KEY)!)).toMatchObject({ kind: 'nct-tournament-ledger', schema: 1 });
  });
});

describe('an edited list starts afresh, a renamed one keeps its record', () => {
  it('records are keyed by list, not by name', () => {
    const l = addRun(
      emptyLedger(),
      ledgerRunOf(event({ decks: { Renamed: { ...D0, name: 'Renamed' }, Edited: EDITED, B: D1 }, matches: [['Renamed', 'B', [[0, 0]]], ['Edited', 'B', [[0, 0]]]] }))!,
    );
    const r = yourRecords(l);
    expect(r.get(fp(D0))!.games).toBe(1);
    expect(r.get(fp(EDITED))!.games).toBe(1);
    expect(fp(EDITED)).not.toBe(fp(D0));
  });
});
