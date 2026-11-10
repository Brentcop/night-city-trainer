import { describe, expect, it } from 'vitest';
import { autoRounds, bracketOrder, cutSize, runTournament, SIM_VERSION, type GameJob, type GameRec, type TourneyEvent } from '../src/lib/tournament';
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

  it('gives the same full event for the same config and seed', async () => {
    const strip = (ev: TourneyEvent) => ({
      rounds: ev.rounds.map((r) => r.matches.map((m) => ({ a: m.a, b: m.b, winner: m.winner, score: m.score, games: m.games.map((g) => [g.seed, g.first, g.winner]) }))),
      bracket: ev.bracket.map((r) => ({ name: r.name, matches: r.matches.map((m) => ({ a: m.a, b: m.b, winner: m.winner, games: m.games.map((g) => [g.seed, g.first, g.winner]) })) })),
      seeds: ev.seeds,
      standings: ev.standings,
      champion: ev.champion,
    });
    const a = await runTournament(field, cfg, fake(() => 0));
    const b = await runTournament(field, cfg, fake((j) => (j.seed * 13) % 7));
    expect(strip(b)).toEqual(strip(a));
    expect(a.simVersion).toBe(SIM_VERSION);
    expect(a.phase).toBe('done');
    // a different seed gives a different event
    const c = await runTournament(field, { ...cfg, seed: 6 }, fake(() => 0));
    expect(strip(c).rounds).not.toEqual(strip(a).rounds);
  });

  it('plays Bo1 matches as a single game', async () => {
    const ev = await runTournament(field, { ...cfg, bestOf: 1 }, fake(() => 0));
    expect(ev.format).toBe('Swiss 4 rounds (Bo1) + top 8');
    for (const m of [...ev.rounds.flatMap((r) => r.matches), ...ev.bracket.flatMap((r) => r.matches)].filter((x) => x.b)) {
      expect(m.games).toHaveLength(1);
      expect([...m.score].sort()).toEqual([0, 1]);
      expect(m.winner).toBe(m.score[0] ? m.a : m.b);
    }
    expect(ev.standings.reduce((n, s) => n + s.games, 0)).toBe(2 * (4 * 5 + 7)); // 5 Swiss matches a round, 7 top-cut matches
  });

  it('gives no bye in an even field', async () => {
    const even = field.slice(0, 8);
    const ev = await runTournament(even, { ...cfg, rounds: 3 }, fake(() => 0));
    for (const r of ev.rounds) {
      expect(r.matches).toHaveLength(4);
      expect(r.matches.every((m) => m.b)).toBe(true);
      expect(new Set(r.matches.flatMap((m) => [m.a, m.b])).size).toBe(8);
    }
    expect(ev.standings.every((s) => !s.opps.includes('BYE') && s.opps.length === 3)).toBe(true);
  });

  it('crowns the Swiss leader when there is no top cut', async () => {
    const ev = await runTournament(field, { ...cfg, top: 0 }, fake(() => 0));
    expect(ev.format).toBe('Swiss 4 rounds (Bo3)');
    expect(ev.bracket).toEqual([]);
    expect(ev.seeds).toBeUndefined();
    expect(ev.champion).toBe(ev.standings[0].deck);
  });

  it('breaks a tied match evenly and deterministically', async () => {
    const tie = async (j: GameJob): Promise<GameRec> => ({ seed: j.seed, first: j.first, winner: 'tie', turns: 10, reason: 'test' });
    const pair = [deck('D0'), deck('D1')];
    let aWins = 0;
    const N = 200;
    for (let seed = 1; seed <= N; seed++) {
      for (const bestOf of [1, 3] as const) {
        const conf = { ...cfg, rounds: 1, top: 0, bestOf, seed };
        const ev = await runTournament(pair, conf, tie);
        const m = ev.rounds[0].matches[0];
        expect(m.score).toEqual([0, 0]);
        expect(m.games).toHaveLength(bestOf);
        expect([m.a, m.b]).toContain(m.winner);
        expect((await runTournament(pair, conf, tie)).rounds[0].matches[0].winner).toBe(m.winner);
        if (m.winner === m.a) aWins++;
      }
    }
    // the old `seed % 2` rule gave every tie to deck B (game-1 seeds are even)
    expect(aWins / (2 * N)).toBeGreaterThan(0.35);
    expect(aWins / (2 * N)).toBeLessThan(0.65);
  });

  it('avoids rematches whenever a rematch-free round exists (sizes 4-16, 100 seeds)', async () => {
    // fake game decided by a hash of the seed, lower deck numbers slightly favoured
    const play = async (j: GameJob): Promise<GameRec> => {
      const h = Math.imul(j.seed ^ 0x9e3779b9, 2654435761) >>> 0;
      const a = +j.a.name.slice(1);
      const b = +j.b.name.slice(1);
      return { seed: j.seed, first: j.first, winner: (h >>> 10) % 100 < 50 + (b - a) * 2 ? 0 : 1, turns: 10, reason: 'test' };
    };
    // independent check: is there a perfect matching of `ds` with no pair in `met`?
    const canPair = (ds: string[], met: Map<string, Set<string>>): boolean => {
      if (!ds.length) return true;
      const [d, ...rest] = ds;
      return rest.some((o, i) => !met.get(d)!.has(o) && canPair([...rest.slice(0, i), ...rest.slice(i + 1)], met));
    };
    let rounds = 0;
    let forced = 0;
    for (let n = 4; n <= 16; n++) {
      const decks = Array.from({ length: n }, (_, i) => deck(`D${i}`));
      const R = autoRounds(n);
      for (let seed = 1; seed <= 100; seed++) {
        const ev = await runTournament(decks, { name: 't', rounds: R, top: 0, bestOf: 1, bot: 'fast', seed }, play);
        expect(ev.rounds).toHaveLength(R);
        const met = new Map(decks.map((d) => [d.name, new Set<string>()]));
        const byes = new Map(decks.map((d) => [d.name, 0]));
        for (const r of ev.rounds) {
          rounds++;
          const names = r.matches.flatMap((m) => (m.b ? [m.a, m.b] : [m.a]));
          expect(names.sort()).toEqual(decks.map((d) => d.name).sort()); // everyone plays or has the bye, once
          const bye = r.matches.filter((m) => !m.b);
          expect(bye).toHaveLength(n % 2);
          for (const m of bye) byes.set(m.a, byes.get(m.a)! + 1);
          const rematch = r.matches.some((m) => m.b && met.get(m.a)!.has(m.b));
          if (rematch) {
            forced++;
            // only allowed when no bye choice (among decks without one) leaves a rematch-free matching
            const all = decks.map((d) => d.name);
            const cands = n % 2 ? all.filter((d) => !met.get(d)!.has('BYE')) : [null];
            expect(cands.some((c) => canPair(all.filter((d) => d !== c), met))).toBe(false);
          }
          for (const m of r.matches) {
            if (!m.b) met.get(m.a)!.add('BYE');
            else met.get(m.a)!.add(m.b), met.get(m.b)!.add(m.a);
          }
        }
        for (const [, k] of byes) expect(k).toBeLessThanOrEqual(1);
      }
    }
    expect(forced / rounds).toBeLessThan(0.05);
  }, 60_000);
});
