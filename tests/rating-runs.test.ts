// Rating runs (data/series/run-N.json, docs/SERIES.md): games the rating series plays, pooled beside the recorded events
// for ratings, head-to-heads and the evidence, never listed as events. And the pools' list rule: a game counts only when
// both seats played the library's current list of their deck (a deck no longer in the library keeps its games).
// Every fixture is built here (runTournament with a stub player), so nothing depends on the recorded data.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runTournament, type GameJob, type GameRec, type TourneyEvent } from '../src/lib/tournament';
import { eventRatedGames, ratedGamesOf } from '../src/lib/ratingGames';
import { currentListGate, poolEvents, selectEvents, type PoolEvent } from '../scripts/event-pool';
import { eventFiles, isRun, loadLibrary, maxRunId, RATING_RUN_KIND, readEvents, readPooled, readRuns, runFiles, toRatingRun, type RecordedEvent } from '../scripts/lib-node';
import { h2hOf } from '../scripts/build-h2h';
import { checkData, duplicateGames, runFileProblems, type CheckEvent } from '../scripts/check-data';
import { competitiveFiles, loadCompetitive } from '../scripts/kb-sources';
import { buildCompetitive } from '../src/lib/kb/build/events';

const LIB = loadLibrary();
const DECKS = LIB.slice(0, 6);

/** A stub game: the winner follows the seed, so every fixture is the same on every run. */
const stub = async (job: GameJob): Promise<GameRec> => ({ seed: job.seed, first: job.first, winner: job.seed % 3 === 0 ? 1 : 0, turns: 10 + (job.seed % 5), reason: 'stub' });

/** A plain Swiss event of the six decks (3 rounds, best of 1), dated `date`. */
async function swissEvent(id: number, date: string, simVersion = 9): Promise<RecordedEvent> {
  const ev = await runTournament(
    DECKS.map((d) => ({ ...d.deck, file: d.file })),
    { name: `Event #${id}`, rounds: 3, top: 0, bestOf: 1, bot: 'hard', seed: id },
    stub,
    { id },
  );
  // the manifest says the version the event does (runTournament stamps SIM_VERSION, which check:data compares)
  return { ...ev, date, simVersion, manifest: ev.manifest && { ...ev.manifest, simVersion } } as unknown as RecordedEvent;
}

/** A rating run: a match list of `pairs` (each pairing 4 times, seats mirrored, best of 1), as run number `n`. */
async function ratingRun(n: number, date: string, pairs: [number, number][] = [[0, 1], [2, 3], [4, 5], [0, 5]], simVersion = 9): Promise<RecordedEvent> {
  const used = [...new Set(pairs.flat())].map((k) => DECKS[k]!);
  const ev: TourneyEvent = await runTournament(
    used.map((d) => ({ ...d.deck, file: d.file })),
    { name: `Run ${n}`, rounds: 1, top: 0, bestOf: 1, bot: 'hard', seed: 1_000_000_000 + n * 100_000 },
    stub,
    {
      id: `run-${n}`,
      setup: { format: 'matches', entrants: used.map((d) => ({ name: d.deck.name, file: d.file })), bestOf: 1, matches: pairs.map(([a, b]) => ({ a: DECKS[a]!.deck.name, b: DECKS[b]!.deck.name, times: 4, mirror: true })) },
    },
  );
  const r = toRatingRun(ev, n);
  return { ...r, date, simVersion, manifest: r.manifest && { ...r.manifest, simVersion } } as unknown as RecordedEvent;
}

const gamesIn = (e: RecordedEvent) => [...e.rounds, ...e.bracket].reduce((a, r) => a + r.matches.reduce((b, m) => b + (m.b ? m.games.length : 0), 0), 0);
/** A copy of a recorded file whose stored list of `deck` has one card swapped (an edited list). */
function edited(e: RecordedEvent, deck: string): RecordedEvent {
  const c = JSON.parse(JSON.stringify(e)) as RecordedEvent;
  const d = c.decks[deck]!;
  const other = LIB.flatMap((x) => x.deck.main).find((card) => !d.main.includes(card))!;
  d.main = [other, ...d.main.slice(1)];
  return c;
}

describe('the list rule (currentListGate)', () => {
  const gate = currentListGate(LIB);
  const d = DECKS[0]!.deck;
  it('a current list counts whatever its card order; an edited list does not; a deck not in the library and a missing list count', () => {
    expect(gate(d.name, { legends: d.legends, main: d.main })).toBe(true);
    expect(gate(d.name, { legends: [...d.legends].reverse(), main: [...d.main].reverse() })).toBe(true);
    const other = LIB.flatMap((x) => x.deck.main).find((card) => !d.main.includes(card))!;
    expect(gate(d.name, { legends: d.legends, main: [other, ...d.main.slice(1)] })).toBe(false);
    expect(gate('A deck that left the library', { legends: d.legends, main: [other] })).toBe(true);
    expect(gate(d.name, undefined)).toBe(true);
  });
  it('drops a game when either seat played an edited list, and only those games', async () => {
    const ev = await swissEvent(30, '2026-11-20T00:00:00.000Z');
    const all = eventRatedGames(ev);
    const ed = edited(ev, d.name);
    const kept = eventRatedGames(ed, gate);
    const involving = all.filter((g) => g.a === d.name || g.b === d.name).length;
    expect(involving).toBeGreaterThan(0);
    expect(kept.length).toBe(all.length - involving);
    expect(kept.some((g) => g.a === d.name || g.b === d.name)).toBe(false);
    // with every list current, the gate changes nothing
    expect(eventRatedGames(ev, gate)).toEqual(all);
    expect(ratedGamesOf([ev, ed], gate).length).toBe(all.length + kept.length);
  });
});

describe('rating runs in the pool', () => {
  it('count their games but no results, and are counted apart from custom events', async () => {
    const ev = await swissEvent(30, '2026-11-20T00:00:00.000Z');
    const run = await ratingRun(1, '2026-11-21T00:00:00.000Z');
    expect(isRun(run)).toBe(true);
    expect(isRun(ev)).toBe(false);
    const alone = poolEvents([ev] as unknown as PoolEvent[]);
    const both = poolEvents([ev, run] as unknown as PoolEvent[], currentListGate(LIB));
    expect(both.games.length).toBe(alone.games.length + gamesIn(run));
    expect(both.results).toEqual(alone.results);
    expect(both.runs).toBe(1);
    expect(both.customEvents).toBe(0);
  });
  it('with a run in the pool the newest is the newest by date; without one, by id as before', async () => {
    const e9 = await swissEvent(30, '2026-11-20T00:00:00.000Z', 9);
    const r10 = await ratingRun(1, '2026-11-22T00:00:00.000Z', undefined, 10);
    const e10early = { ...e9, id: 31, date: '2026-11-21T00:00:00.000Z', simVersion: 10 } as RecordedEvent;
    const sel = selectEvents([e9, e10early, r10]);
    expect(sel.simVersion).toBe(10);
    expect(sel.kept.map((e) => e.id)).toEqual([31, 'run-1']);
    // a run older than the newest event does not decide the pool
    const r9old = await ratingRun(2, '2026-11-19T00:00:00.000Z', undefined, 9);
    expect(selectEvents([e9, e10early, r9old]).simVersion).toBe(10);
    // events alone: by id, whatever the dates (unchanged)
    const later = { ...e9, id: 29, date: '2026-12-01T00:00:00.000Z', simVersion: 8 } as RecordedEvent;
    expect(selectEvents([later, e9]).simVersion).toBe(9);
  });
  it('the head-to-heads count the run apart, name it in the manifest, and leave out the games of an edited list', async () => {
    const ev = await swissEvent(30, '2026-11-20T00:00:00.000Z');
    const run = await ratingRun(1, '2026-11-21T00:00:00.000Z');
    const gate = currentListGate(LIB);
    const h = h2hOf(selectEvents([ev, run]), gate);
    expect(h.events).toBe(1);
    expect(h.runs).toBe(1);
    expect(h.games).toBe(gamesIn(ev) + gamesIn(run));
    expect(h.manifest!.inputs!.events.map((e) => e.id)).toEqual([30, 'run-1']);
    const noRun = h2hOf(selectEvents([ev]), gate);
    expect(noRun.runs).toBeUndefined();
    expect('runs' in noRun).toBe(false);
    const ed = edited(run, DECKS[0]!.deck.name);
    const h2 = h2hOf(selectEvents([ev, ed]), gate);
    const lost = [...run.rounds].flatMap((r) => r.matches).filter((m) => m.a === DECKS[0]!.deck.name || m.b === DECKS[0]!.deck.name).reduce((a, m) => a + m.games.length, 0);
    expect(lost).toBeGreaterThan(0);
    expect(h2.games).toBe(h.games - lost);
  });
});

describe('check:data reads the run files', () => {
  const asCheck = (e: RecordedEvent) => e as unknown as CheckEvent;
  it('a run as the series writes it passes; a wrong id, kind, schema, bye or missing manifest fails', async () => {
    const run = await ratingRun(1, '2026-11-21T00:00:00.000Z');
    expect(runFileProblems([{ file: 'run-1.json', event: asCheck(run) }], LIB)).toMatchObject({ failures: [], info: [], manifests: 1 });
    const bad = (f: (x: Record<string, unknown>) => void, file = 'run-1.json') => {
      const c = JSON.parse(JSON.stringify(run)) as Record<string, unknown>;
      f(c);
      return runFileProblems([{ file, event: c as unknown as CheckEvent }], LIB).failures;
    };
    expect(bad(() => {}, 'run-2.json').join()).toContain('the file name says "run-2"');
    expect(bad((c) => (c.kind = 'event')).join()).toContain('kind');
    expect(bad((c) => (c.schema = 2)).join()).toContain('schema 2');
    expect(bad((c) => delete c.manifest).join()).toContain('no run manifest');
    expect(bad((c) => ((c.rounds as { matches: { b: string | null }[] }[])[0]!.matches[0]!.b = null)).join()).toContain('unreadable');
    expect(bad((c) => ((c.setup as { format: string }).format = 'swiss')).join()).toContain('match list');
    expect(runFileProblems([{ file: 'run-1.json', event: asCheck(run) }, { file: 'run-1.json', event: asCheck(run) }], LIB).failures.join()).toContain('recorded twice');
  });
  it('an edited list is information (its games are left out), not a failure', async () => {
    const run = edited(await ratingRun(1, '2026-11-21T00:00:00.000Z'), DECKS[0]!.deck.name);
    // (the copy's stored ids no longer match the edited list, which fails on its own; here only the information matters)
    const r = runFileProblems([{ file: 'run-1.json', event: asCheck(run) }], LIB);
    expect(r.info.join()).toContain('no longer its current one');
  });
  it('the coverage counts: h2h.json must count the pooled runs and their games on the current lists', async () => {
    const ev = await swissEvent(30, '2026-11-20T00:00:00.000Z');
    const run = await ratingRun(1, '2026-11-21T00:00:00.000Z');
    const h = h2hOf(selectEvents([ev, run]), currentListGate(LIB));
    const base = { index: { events: [{ id: 30, champion: ev.champion, games: gamesIn(ev) }] }, events: [{ file: 'event-30.json', event: asCheck(ev) }], runs: [{ file: 'run-1.json', event: asCheck(run) }], library: LIB };
    const ok = checkData({ ...base, h2h: h });
    expect(ok.failures.filter((f) => /h2h|run/.test(f))).toEqual([]);
    expect(checkData({ ...base, h2h: { ...h, runs: 0 } }).failures.join()).toContain('rating runs');
    expect(checkData({ ...base, h2h: { ...h, games: h.games - 1 } }).failures.join()).toContain('games');
    expect(checkData({ ...base, runs: [], h2h: h }).failures.join()).toContain('rating runs');
  });
});

describe('a run is not an event: the events index, the Tournaments page and the search pack never see it', () => {
  it('in a checkout with a run file, only the pools read it', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-runs-'));
    try {
      const ev = await swissEvent(30, '2026-11-20T00:00:00.000Z');
      const run = await ratingRun(1, '2026-11-21T00:00:00.000Z');
      fs.mkdirSync(path.join(root, 'public/tournaments'), { recursive: true });
      fs.mkdirSync(path.join(root, 'data/series'), { recursive: true });
      fs.writeFileSync(path.join(root, 'public/tournaments/event-30.json'), JSON.stringify(ev));
      fs.writeFileSync(path.join(root, 'data/series/run-1.json'), JSON.stringify(run));
      const evDir = path.join(root, 'public/tournaments');
      const seriesDir = path.join(root, 'data/series');
      // the events (what the index writer, the event pages and the knowledge pack read)
      expect(eventFiles(evDir)).toEqual(['event-30.json']);
      expect(readEvents(evDir).map((e) => e.id)).toEqual([30]);
      expect(competitiveFiles(root)).toEqual(['public/tournaments/event-30.json']);
      const kb = buildCompetitive(loadCompetitive(root), { deckId: () => undefined, skipped: {} });
      expect(kb.map((r) => r.id).filter((id) => /run/.test(id))).toEqual([]);
      expect(kb.filter((r) => r.kind === 'event').length).toBe(1);
      // the pools
      expect(runFiles(seriesDir)).toEqual(['run-1.json']);
      expect(maxRunId(seriesDir)).toBe(1);
      expect(readRuns(seriesDir).map((e) => [e.id, e.kind])).toEqual([['run-1', RATING_RUN_KIND]]);
      expect(readPooled(evDir, seriesDir).map((e) => e.id)).toEqual([30, 'run-1']);
      expect(readPooled(evDir, null).map((e) => e.id)).toEqual([30]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('check:data: no game recorded twice', () => {
  const asCheck = (e: RecordedEvent) => e as unknown as CheckEvent;
  it('an event and a run with their own seeds pass; a game recorded again (same lists, seed and first player) fails, naming both', async () => {
    const ev = await swissEvent(30, '2026-11-20T00:00:00.000Z');
    const run = await ratingRun(1, '2026-11-21T00:00:00.000Z');
    expect(duplicateGames([asCheck(ev), asCheck(run)])).toEqual([]);
    const again = { ...JSON.parse(JSON.stringify(ev)), id: 31 } as RecordedEvent;
    const d = duplicateGames([asCheck(ev), asCheck(again)]);
    expect(d.length).toBeGreaterThan(0);
    expect(d[0]).toMatch(/event 30 .*event 31/);
    // the same seed with the seats the other way round, or another simulator version, is another game
    const swapped = JSON.parse(JSON.stringify(ev)) as RecordedEvent;
    swapped.id = 32;
    for (const r of swapped.rounds) for (const m of r.matches) if (m.b) [m.a, m.b] = [m.b, m.a];
    expect(duplicateGames([asCheck(ev), asCheck(swapped)])).toEqual([]);
    expect(duplicateGames([asCheck(ev), asCheck({ ...again, simVersion: 10 } as RecordedEvent)])).toEqual([]);
  });
});
