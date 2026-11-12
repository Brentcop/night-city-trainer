// scripts/check-data.ts core logic, on small in-memory fixtures (npm run check:data reads the real files).
import { describe, expect, it } from 'vitest';
import { checkData, type CheckEvent, type CheckInput } from '../scripts/check-data';
import { runTournament, type GameJob, type GameRec } from '../src/lib/tournament';
import { aggregateManifest, type RecordedEventInput } from '../src/lib/runManifest';
import type { DeckList } from '../src/engine/types';

const deck = (name: string, sideboard: string[] = []): DeckList => ({ name, legends: ['l1', 'l2', 'l3'], main: [name, name], sideboard });
const fake = async (j: GameJob): Promise<GameRec> => ({ seed: j.seed, first: j.first, winner: j.a.name < j.b.name ? 0 : 1, turns: 8, reason: 'test' });
const cfg = (seed: number) => ({ name: `Event #${seed}`, rounds: 2, top: 0, bestOf: 1 as const, bot: 'hard' as const, seed });
const gamesOf = (e: CheckEvent) => [...e.rounds, ...e.bracket].reduce((a, r) => a + r.matches.reduce((b, m) => b + (m.b ? m.games.length : 0), 0), 0);

async function recorded(id: number): Promise<CheckEvent> {
  // D0 has a sideboard: the stored list must still reproduce its id
  const ev = await runTournament([deck('D0', ['s1']), deck('D1'), deck('D2'), deck('D3')], cfg(id), fake, { id });
  return JSON.parse(JSON.stringify(ev)) as CheckEvent;
}
/** An event as recorded before manifests and deck ids. */
function legacy(e: CheckEvent): CheckEvent {
  const { manifest: _m, simVersion: _s, ...rest } = e;
  return { ...rest, decks: Object.fromEntries(Object.entries(e.decks).map(([n, d]) => [n, { legends: d.legends, main: d.main }])) };
}
function input(events: CheckEvent[], o: { h2hManifest?: boolean } = {}): CheckInput {
  return {
    index: { events: events.map((e) => ({ id: e.id, champion: e.champion, games: gamesOf(e) })) },
    events: events.map((event) => ({ file: `event-${event.id}.json`, event })),
    h2h: {
      events: events.length,
      games: events.reduce((a, e) => a + gamesOf(e), 0),
      ...(o.h2hManifest ? { manifest: aggregateManifest('h2h', events as unknown as RecordedEventInput[], { games: events.reduce((a, e) => a + gamesOf(e), 0) }) } : {}),
    },
    ratings: null,
  };
}

describe('check-data', () => {
  it('passes consistent data and checks every manifest', async () => {
    const events = [await recorded(1), await recorded(2)];
    const r = checkData(input(events, { h2hManifest: true }));
    expect(r.failures).toEqual([]);
    expect(r.manifestsChecked).toBe(3);
    expect(r.legacyEvents).toBe(0);
    expect(r.passed).toHaveLength(3);
    expect(events[0].decks.D0.sideboard).toEqual(['s1']);
  });

  it('fails events without a manifest or a sim version (none predate them since the 2026-11-11 baseline)', async () => {
    const r = checkData(input([legacy(await recorded(1)), await recorded(2)]));
    expect(r.legacyEvents).toBe(1);
    expect(r.failures).toContain('event-1.json: no run manifest (every event since the 2026-11-11 baseline records one)');
    expect(r.failures).toContain('event-1.json: no simVersion (every event since the 2026-11-11 baseline records one)');
    expect(r.failures.some((f) => f.startsWith('event-2.json'))).toBe(false);
    const { simVersion: _s, ...noVersion } = await recorded(3);
    expect(checkData(input([noVersion])).failures).toEqual(['event-3.json: no simVersion (every event since the 2026-11-11 baseline records one)']);
  });

  it('finds index entries without a file and files missing from the index', async () => {
    const [e1, e2] = [await recorded(1), await recorded(2)];
    const i = input([e1, e2]);
    i.index = { events: [{ id: 1 }, { id: 3 }] };
    const r = checkData(i);
    expect(r.failures).toContain('tournaments.json lists event(s) with no file in public/tournaments: 3');
    expect(r.failures).toContain('event file(s) missing from tournaments.json: 2');
  });

  it('finds an index row that disagrees with its file, and a file named for another id', async () => {
    const e1 = await recorded(1);
    const i = input([e1]);
    i.index!.events[0].games = 999;
    i.events[0].file = 'event-7.json';
    const r = checkData(i);
    expect(r.failures.some((f) => /event 1: 999 games/.test(f))).toBe(true);
    expect(r.failures).toContain('event-7.json: its id is 1');
  });

  it('fails head-to-heads that do not cover the recorded events', async () => {
    const events = [await recorded(1), await recorded(2)];
    const stale = input(events);
    stale.h2h = { events: 1, games: gamesOf(events[0]) };
    expect(checkData(stale).failures.join('\n')).toMatch(/counts 1 events, 2 are recorded \(the Deck Lab shows it as stale\)/);
    const partial = input(events);
    partial.h2h!.manifest = aggregateManifest('h2h', [events[0]] as unknown as RecordedEventInput[], { games: 0 });
    expect(checkData(partial).failures).toContain('h2h.json: built without event(s) 2');
    expect(checkData({ ...input(events), h2h: null }).failures.join('\n')).toMatch(/h2h.json is missing/);
  });

  it('fails a manifest whose deck ids do not match the stored lists', async () => {
    const e = await recorded(1);
    e.decks.D1.main = ['changed'];
    const r = checkData(input([e]));
    expect(r.failures.some((f) => /deck "D1" has id .*, its stored list fingerprints as/.test(f))).toBe(true);
    expect(r.failures.some((f) => /manifest deck "D1" has id/.test(f))).toBe(true);
  });

  it('fails a manifest with an unknown schema or a deck missing from it', async () => {
    const e = await recorded(1);
    (e.manifest as { schema: number }).schema = 2;
    expect(checkData(input([e])).failures.join('\n')).toMatch(/manifest schema 2 is not one this code reads/);
    const f = await recorded(2);
    const m = f.manifest as { decks: { name: string }[] };
    m.decks = m.decks.filter((d) => d.name !== 'D3');
    expect(checkData(input([f])).failures).toContain('event-2.json: deck "D3" is not in the manifest');
  });

  it('checks arranged events: setup entrants, the custom flag, and the index flag', async () => {
    const decks = [deck('D0'), deck('D1'), deck('D2'), { ...deck('D2'), name: 'D2 #2' }];
    const ev = await runTournament(decks, cfg(3), fake, {
      id: 3,
      setup: { format: 'matches', entrants: [{ name: 'D0' }, { name: 'D1' }, { name: 'D2' }, { name: 'D2 #2', copyOf: 'D2' }], bestOf: 1, matches: [{ a: 'D0', b: 'D1' }, { a: 'D2', b: 'D2 #2' }] },
    });
    const e = JSON.parse(JSON.stringify(ev)) as CheckEvent;
    const plain = await recorded(1);
    const good = input([plain, e]);
    good.index!.events[1]!.custom = true;
    const r = checkData(good);
    expect(r.failures).toEqual([]);
    expect(r.passed).toContain('event setups and custom flags (1 arranged event(s))');
    // the index must carry the same flag
    expect(checkData(input([plain, e])).failures).toContain("tournaments.json event 3: not flagged custom, the file is");
    // the flag must match the setup
    const unflagged = { ...e, custom: undefined };
    const noFlag = input([unflagged]);
    expect(checkData(noFlag).failures).toContain('event-3.json: its setup is not a standard Swiss event but it is not flagged custom');
    const flaggedPlain = input([{ ...plain, custom: true }]);
    flaggedPlain.index!.events[0]!.custom = true;
    expect(checkData(flaggedPlain).failures).toContain('event-1.json: flagged custom but records no setup');
    // the setup must name the stored decks
    const missing = { ...e, setup: { ...e.setup!, entrants: e.setup!.entrants.slice(0, 3) } };
    const bad = input([missing]);
    bad.index!.events[0]!.custom = true;
    expect(checkData(bad).failures.join('\n')).toMatch(/setup entrants \(3\) are not the stored decks \(4\)/);
  });

  it('aggregate manifests mark custom input events, and only those', async () => {
    const plain = await recorded(1);
    const ev = await runTournament([deck('D0'), deck('D1')], cfg(2), fake, { id: 2, setup: { format: 'round-robin', entrants: [{ name: 'D0' }, { name: 'D1' }], bestOf: 1 } });
    const custom = JSON.parse(JSON.stringify(ev)) as CheckEvent;
    const m = aggregateManifest('h2h', [plain, custom] as unknown as RecordedEventInput[], { games: 0 });
    expect(m.inputs!.events.map((e) => e.custom)).toEqual([undefined, true]);
    // standard inputs keep the manifest they always had (the run id hashes the inputs)
    expect(aggregateManifest('h2h', [plain] as unknown as RecordedEventInput[], { games: 0 }).inputs!.events[0]).toEqual({ id: 1, simVersion: plain.simVersion, runId: (plain.manifest as { runId: string }).runId });
    const data = input([plain, custom], { h2hManifest: true });
    data.index!.events[1]!.custom = true;
    expect(checkData(data).failures).toEqual([]);
    const wrong = input([plain, custom]);
    wrong.index!.events[1]!.custom = true;
    wrong.h2h!.manifest = aggregateManifest('h2h', [plain, { ...custom, custom: undefined }] as unknown as RecordedEventInput[], { games: 0 });
    expect(checkData(wrong).failures).toContain('h2h.json: event 2 is listed as standard, the event is custom');
  });
});
