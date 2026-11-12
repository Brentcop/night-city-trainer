// SIM-7: ratings and head-to-heads pool only one sim version and bot by default (scripts/event-pool.ts selectEvents),
// tested with a Medium event among Hard ones; check:data accepts the events a file left out on purpose and nothing else.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePoolFilter, poolRecord, selectEvents } from '../scripts/event-pool';
import { buildH2H } from '../scripts/build-h2h';
import { checkData, type CheckEvent } from '../scripts/check-data';
import { runTournament, type GameJob, type GameRec } from '../src/lib/tournament';
import type { DeckList } from '../src/engine/types';

const deck = (name: string): DeckList => ({ name, legends: ['l1', 'l2', 'l3'], main: [name, name], sideboard: [] });
const fake = async (j: GameJob): Promise<GameRec> => ({ seed: j.seed, first: j.first, winner: j.a.name < j.b.name ? 0 : 1, turns: 8, reason: 'test' });
async function recorded(id: number, bot: 'hard' | 'medium'): Promise<CheckEvent & { bot: string }> {
  const ev = await runTournament([deck('D0'), deck('D1'), deck('D2'), deck('D3')], { name: `Event #${id}`, rounds: 2, top: 0, bestOf: 1, bot, seed: id }, fake, { id });
  return JSON.parse(JSON.stringify(ev)) as CheckEvent & { bot: string };
}
const gamesOf = (e: CheckEvent) => [...e.rounds, ...e.bracket].reduce((a, r) => a + r.matches.reduce((b, m) => b + (m.b ? m.games.length : 0), 0), 0);

describe('selectEvents', () => {
  const ev = (id: number, simVersion: number, bot: string) => ({ id, simVersion, bot });

  it('one version and bot: everything pooled, nothing to say', () => {
    const s = selectEvents([ev(1, 5, 'hard'), ev(2, 5, 'hard')]);
    expect(s.kept.map((e) => e.id)).toEqual([1, 2]);
    expect(s.excluded).toEqual([]);
    expect(s.warnings).toEqual([]);
    expect(poolRecord(s)).toBeUndefined();
    expect(s).toMatchObject({ simVersion: 5, bot: 'hard' });
  });

  it('a Medium event among Hard ones: the newest event decides the pool, the rest is left out with a warning', () => {
    const older = selectEvents([ev(1, 5, 'medium'), ev(2, 5, 'hard'), ev(3, 5, 'hard')]);
    expect(older.kept.map((e) => e.id)).toEqual([2, 3]);
    expect(older.excluded).toEqual([{ id: 1, simVersion: 5, bot: 'medium' }]);
    expect(older.warnings[0]).toMatch(/^warning: the recorded events mix sim versions or bots \(sim v5 hard \(2 events\), sim v5 medium \(1 event\)\); pooling sim v5 with hard only, 1 event\(s\) left out/);
    expect(poolRecord(older)).toEqual({ simVersion: 5, bot: 'hard', excluded: [{ id: 1, simVersion: 5, bot: 'medium' }] });
    const newest = selectEvents([ev(1, 5, 'hard'), ev(2, 5, 'hard'), ev(3, 5, 'medium')]);
    expect(newest.kept.map((e) => e.id)).toEqual([3]);
    // pooled on request, still with a warning
    const all = selectEvents([ev(1, 5, 'medium'), ev(2, 5, 'hard')], { bot: 'all' });
    expect(all.kept).toHaveLength(2);
    expect(all.warnings[0]).toMatch(/^warning: pooling events from different sim versions or bots/);
  });

  it('an older sim version is left out by default, kept by --sim-version all or by naming it', () => {
    const evs = [ev(1, 4, 'hard'), ev(2, 5, 'hard')];
    expect(selectEvents(evs).kept.map((e) => e.id)).toEqual([2]);
    expect(selectEvents(evs, parsePoolFilter({ 'sim-version': 'all' })).kept.map((e) => e.id)).toEqual([1, 2]);
    expect(selectEvents(evs, parsePoolFilter({ 'sim-version': '4' })).kept.map((e) => e.id)).toEqual([1]);
    expect(selectEvents([], {})).toMatchObject({ kept: [], excluded: [], warnings: [] });
  });
});

describe('build-h2h and check:data with a Medium event', () => {
  it('the file pools the Hard events, lists the Medium one as left out, and check:data agrees', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-pool-'));
    try {
      const events = [await recorded(1, 'hard'), await recorded(2, 'medium'), await recorded(3, 'hard')];
      for (const e of events) fs.writeFileSync(path.join(dir, `event-${e.id}.json`), JSON.stringify(e));
      const out = path.join(dir, 'h2h.json');
      const h2h = buildH2H(dir, out)!;
      expect(h2h.events).toBe(2);
      expect(h2h.pool).toEqual({ simVersion: events[0]!.simVersion, bot: 'hard', excluded: [{ id: 2, simVersion: events[1]!.simVersion, bot: 'medium' }] });
      expect(h2h.games).toBe(gamesOf(events[0]!) + gamesOf(events[2]!));
      expect(h2h.manifest?.inputs?.events.map((e) => e.id)).toEqual([1, 3]);
      expect(h2h.model?.kind).toBe('bradley-terry-shrunk');
      expect(h2h.shrunk).toHaveLength(h2h.pairs.length);
      const input = {
        index: { events: events.map((e) => ({ id: e.id, champion: e.champion, games: gamesOf(e) })) },
        events: events.map((event) => ({ file: `event-${event.id}.json`, event })),
        h2h,
        ratings: null,
      };
      const ok = checkData(input);
      expect(ok.failures).toEqual([]);
      expect(ok.info.join('\n')).toMatch(/h2h.json leaves out 1 event/);
      // a file that leaves out a Hard event (one inside its pool) fails, and so does one that pools the Medium event
      const wrong = checkData({ ...input, h2h: { ...h2h, pool: { ...h2h.pool!, excluded: [{ id: 3, simVersion: events[2]!.simVersion ?? null, bot: 'hard' }] } } });
      expect(wrong.failures.join('\n')).toMatch(/leaves out event 3, but it has the pooled sim version and bot/);
      expect(wrong.failures.join('\n')).toMatch(/pools event 2 \(sim v\d+ medium\) outside its/);
      // without the pool record the Medium event is simply missing
      const { pool: _p, ...noPool } = h2h;
      expect(checkData({ ...input, h2h: noPool }).failures.join('\n')).toMatch(/h2h.json counts 2 events, 3 are recorded/);
      // pooled on request: no pool record, every event counted
      const pooled = buildH2H(dir, out, { simVersion: 'all', bot: 'all' })!;
      expect(pooled.pool).toBeUndefined();
      expect(pooled.events).toBe(3);
      expect(checkData({ ...input, h2h: pooled }).failures).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
