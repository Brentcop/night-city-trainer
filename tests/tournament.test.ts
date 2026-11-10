import { describe, expect, it } from 'vitest';
import { bracketOrder, cutSize, runTournament, type GameJob, type GameRec } from '../src/lib/tournament';
import type { DeckList } from '../src/engine/types';

const deck = (name: string): DeckList => ({ name, legends: [], main: [], sideboard: [] });
const field = Array.from({ length: 11 }, (_, i) => deck(`D${i}`));
// fake game: lower deck number wins most of the time, decided by the seed
const fake = (delay: (j: GameJob) => number) => (j: GameJob): Promise<GameRec> =>
  new Promise((res) =>
    setTimeout(() => {
      const a = +j.a.name.slice(1);
      const b = +j.b.name.slice(1);
      const aWins = (j.seed % 7) + a < (j.seed % 5) + b + 2;
      res({ seed: j.seed, first: j.first, winner: aWins ? 0 : 1, turns: 10, reason: 'test' });
    }, delay(j)),
  );
const cfg = { name: 't', rounds: 4, top: 8, bestOf: 3 as const, bot: 'fast' as const, seed: 5 };

describe('tournament', () => {
  it('seeds brackets 1v8, 4v5, 2v7, 3v6', () => {
    expect(bracketOrder(8)).toEqual([0, 7, 3, 4, 1, 6, 2, 5]);
    expect(bracketOrder(4)).toEqual([0, 3, 1, 2]);
  });
  it('fits the cut to the field', () => {
    expect(cutSize(8, 7)).toBe(4);
    expect(cutSize(8, 50)).toBe(8);
    expect(cutSize(0, 50)).toBe(0);
    expect(cutSize(16, 3)).toBe(2);
  });
  it('runs Swiss + top cut with a bye, no rematches and a champion', async () => {
    const ev = await runTournament(field, cfg, fake(() => 0));
    expect(ev.rounds).toHaveLength(4);
    expect(ev.rounds.every((r) => r.matches.filter((m) => !m.b).length === 1)).toBe(true); // odd field: one bye per round
    for (const s of ev.standings) expect(new Set(s.opps.filter((o) => o !== 'BYE')).size).toBe(s.opps.filter((o) => o !== 'BYE').length);
    expect(ev.bracket.map((r) => r.name)).toEqual(['Quarterfinals', 'Semifinals', 'Final']);
    expect(ev.champion).toBe(ev.bracket[2].matches[0].winner);
    for (const m of [...ev.rounds.flatMap((r) => r.matches), ...ev.bracket.flatMap((r) => r.matches)].filter((x) => x.b)) {
      expect(Math.max(...m.score)).toBe(2);
      // the loser of a game goes first in the next one
      for (let i = 1; i < m.games.length; i++) expect(m.games[i].first).toBe(1 - (m.games[i - 1].winner as number));
    }
  });
  it('gives the same event whatever order games finish in', async () => {
    const a = await runTournament(field, cfg, fake(() => 0));
    const b = await runTournament(field, cfg, fake((j) => (j.seed * 13) % 7));
    expect(b.standings.map((s) => s.deck)).toEqual(a.standings.map((s) => s.deck));
    expect(b.champion).toBe(a.champion);
  });
});
