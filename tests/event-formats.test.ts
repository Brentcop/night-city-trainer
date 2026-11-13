// Event formats and hand-arranged events (src/lib/eventFormats.ts, runTournament in src/lib/tournament.ts): the pinned
// default Swiss event, pairings set by hand, byes and brackets, round-robin schedules, match lists, best-of per round,
// first-player rules, the keyed seed scheme, round-by-round input, resuming, and what an event records.
import { describe, expect, it } from 'vitest';
import {
  avgGames,
  bracketOrder,
  bracketProblems,
  copyName,
  entrantBase,
  estimateGames,
  expandMatchList,
  fieldMode,
  firstPlayer,
  forcedPairProblems,
  formatLabel,
  groupSeeds,
  groupSplit,
  hashBit,
  isPlainSetup,
  isStandardSetup,
  matchListProblems,
  matchSeedBase,
  pairingRng,
  rankByBracket,
  resumePlay,
  roundRobinSchedule,
  runTournament,
  seededSlots,
  setupProblems,
  swissPairings,
  swissRound1,
  type EventSetup,
  type GameJob,
  type GameRec,
  type TourneyEvent,
} from '../src/lib/tournament';
import { fingerprintText } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';

const deck = (name: string, k = 0): DeckList => ({ name, legends: [`L${k}`], main: [`c${k}`, 'x'], sideboard: [] });
const field = (n: number) => Array.from({ length: n }, (_, i) => deck(`D${i}`, i));
const names = (n: number) => field(n).map((d) => d.name);
const ent = (n: number) => names(n).map((name) => ({ name }));
// fake game decided by a hash of the seed and seat, lower deck numbers favoured, some ties
const play = async (j: GameJob): Promise<GameRec> => {
  const h = Math.imul(j.seed ^ 0x9e3779b9, 2654435761) >>> 0;
  const a = +j.a.name.replace(/\D/g, '');
  const b = +j.b.name.replace(/\D/g, '');
  return { seed: j.seed, first: j.first, winner: (h >>> 7) % 13 === 0 ? 'tie' : (h >>> 10) % 100 < 50 + (b - a) * 3 + (j.first === 0 ? 5 : -5) ? 0 : 1, turns: 5 + (h % 9), reason: 'test' };
};
const slow = (j: GameJob) => new Promise<GameRec>((res) => setTimeout(() => void play(j).then(res), (j.seed * 13) % 7));
const cfg = (seed: number, o: Partial<{ rounds: number; top: number; bestOf: 1 | 3 | 5 }> = {}) => ({ name: 't', rounds: 3, top: 4, bestOf: 3 as const, bot: 'medium' as const, seed, ...o });
const all = (ev: TourneyEvent) => [...ev.rounds.flatMap((r) => r.matches), ...ev.bracket.flatMap((r) => r.matches)].filter((m) => m.b);
const strip = (ev: TourneyEvent) => ({
  rounds: ev.rounds.map((r) => r.matches.map((m) => [m.a, m.b, m.winner, m.score, m.set ?? false, m.games.map((g) => [g.seed, g.first, g.winner])])),
  bracket: ev.bracket.map((r) => [r.name, r.matches.map((m) => [m.a, m.b, m.winner, m.games.map((g) => [g.seed, g.first, g.winner])])]),
  seeds: ev.seeds,
  standings: ev.standings.map((s) => [s.deck, s.mp, s.gw, s.gl]),
  champion: ev.champion,
  setup: ev.setup,
  custom: ev.custom,
  format: ev.format,
});

describe('default Swiss events are unchanged', () => {
  // Fingerprints of whole events (timestamps and run ids blanked) taken on the code before formats existed (ef3a160),
  // re-taken 2026-11-12 for SIM_VERSION 6 (the bots' weights and the version in the manifest changed; formats did not).
  // Was 45897336bdcc9ad0, 54bbe7499b81c094, 9877c9cc94e35543, dd86acc9077ee253.
  // Re-taken again 2026-11-12 for SIM_VERSION 7 (only the version in the manifest changed: these events use a fake
  // game function). Version 6: bc64b9aabb9a4dfe, 2b85388a6d682872, c8f7538ddb12de79, c84960e51169155d.
  // Re-taken 2026-11-13 for SIM_VERSION 8, again only the manifest's version (with SIM_VERSION set back to 7 the code
  // still gives the version-7 pins). Version 7: abb0e5798905aa04, e3b98158213cee00, adeae78bf7917247, 098da3332766617b.
  // A default event must stay byte-identical: same pairings, seeds, seats, standings, manifest, and no new fields.
  const norm = (ev: TourneyEvent) => JSON.stringify({ ...ev, date: '', manifest: { ...ev.manifest, runId: '', createdAt: '', cardDataVersion: '' } });
  const PINS: [number, number, number, 1 | 3, number, string][] = [
    [7, 3, 4, 3, 42, 'fb4dd43487ba9eb6'],
    [8, 3, 8, 1, 7, '861d838bef23e75a'],
    [11, 4, 8, 3, 5, '512b71e0e413b941'],
    [2, 1, 0, 3, 9, 'f7f4d7f68ce15749'],
  ];
  it.each(PINS)('%i decks, %i rounds, top %i, Bo%i, seed %i', async (n, rounds, top, bestOf, seed, pin) => {
    const ev = await runTournament(field(n), { name: 'pin', rounds, top, bestOf, bot: 'medium', seed }, play, { id: seed });
    expect(fingerprintText(norm(ev))).toBe(pin);
    expect(ev.setup).toBeUndefined();
    expect(ev.custom).toBeUndefined();
    expect(ev.manifest?.field.mode).toBe('swiss');
  });
  it('passing a plain setup changes nothing', async () => {
    const plainSetup: EventSetup = { format: 'swiss', entrants: ent(7), bestOf: 3, rounds: 3, top: 4 };
    expect(isPlainSetup(plainSetup)).toBe(true);
    const a = await runTournament(field(7), cfg(42), play, { id: 1 });
    const b = await runTournament(field(7), cfg(42), play, { id: 1, setup: plainSetup });
    expect(strip(b)).toEqual(strip(a));
    expect(b.setup).toBeUndefined();
  });
});

describe('Swiss pairings set by hand', () => {
  const st = (n: number, opps: Record<string, string[]> = {}) => new Map(names(n).map((d) => [d, { deck: d, mp: 0, opps: opps[d] ?? [] }]));
  it('pairs the rest among themselves and draws every deck its random key', () => {
    let calls = 0;
    const counted = (r: () => number) => () => (calls++, r());
    const out = swissPairings(st(7), counted(pairingRng(3)), [{ a: 'D0', b: 'D5' }]);
    expect(calls).toBe(7);
    const used = out.pairs.flat();
    expect(used).not.toContain('D0');
    expect(used).not.toContain('D5');
    expect(new Set([...used, out.bye]).size).toBe(5);
    calls = 0;
    swissPairings(st(7), counted(pairingRng(3)));
    expect(calls).toBe(7);
  });
  it('validates: unknown decks, a deck with itself or twice, rematches only when ticked', () => {
    const met = (a: string, b: string) => (a === 'D0' && b === 'D1') || (a === 'D1' && b === 'D0');
    expect(forcedPairProblems(names(4), [{ a: 'D0', b: 'D2' }, { a: 'D1', b: 'D3' }], met)).toEqual([]);
    expect(forcedPairProblems(names(4), [{ a: 'D0', b: 'X' }])).toEqual(['X is not an entrant']);
    expect(forcedPairProblems(names(4), [{ a: 'D0', b: 'D0' }])).toEqual(["D0 can't play itself"]);
    expect(forcedPairProblems(names(4), [{ a: 'D0', b: 'D1' }, { a: 'D0', b: 'D2' }])).toEqual(['D0 is paired twice in the round']);
    expect(forcedPairProblems(names(4), [{ a: 'D0', b: 'D1' }], met)[0]).toMatch(/rematch/);
    expect(forcedPairProblems(names(4), [{ a: 'D0', b: 'D1', rematch: true }], met)).toEqual([]);
  });
  it('the setup preview is exactly the round the runner plays', async () => {
    for (const forced of [[], [{ a: 'D2', b: 'D6' }], [{ a: 'D0', b: 'D1' }, { a: 'D3', b: 'D4' }]]) {
      const setup: EventSetup = { format: 'swiss', entrants: ent(7), bestOf: 3, rounds: 2, top: 0, ...(forced.length ? { pairings: { 1: forced } } : {}) };
      const ev = await runTournament(field(7), cfg(11, { rounds: 2, top: 0 }), play, { setup });
      const preview = swissRound1(names(7), 11, forced);
      expect(ev.rounds[0]!.matches.map((m) => [m.a, m.b, !!m.set])).toEqual(preview.map((m) => [m.a, m.b, !!m.set]));
    }
  });
  it('marks hand-set matches, records them, and flags the event custom', async () => {
    const setup: EventSetup = { format: 'swiss', entrants: ent(8), bestOf: 3, rounds: 3, top: 4, pairings: { 1: [{ a: 'D0', b: 'D7' }], 2: [{ a: 'D0', b: 'D1' }] } };
    const ev = await runTournament(field(8), cfg(4), play, { setup });
    expect(ev.rounds[0]!.matches[0]).toMatchObject({ a: 'D0', b: 'D7', set: true });
    expect(ev.rounds[1]!.matches[0]).toMatchObject({ a: 'D0', b: 'D1', set: true });
    expect(ev.rounds[2]!.matches.some((m) => m.set)).toBe(false);
    expect(ev.custom).toBe(true);
    expect(ev.setup?.pairings).toEqual(setup.pairings);
    expect(ev.format).toBe('Swiss 3 rounds (Bo3) + top 4 · custom pairings');
    expect(ev.manifest?.field.mode).toBe('swiss+custom-pairings');
    for (const r of ev.rounds) expect(new Set(r.matches.flatMap((m) => [m.a, m.b])).size).toBe(8);
  });
  it('rejects a hand-set rematch that is not ticked, and plays one that is', async () => {
    const base: EventSetup = { format: 'swiss', entrants: ent(4), bestOf: 1, rounds: 2, top: 0, pairings: { 1: [{ a: 'D0', b: 'D1' }], 2: [{ a: 'D0', b: 'D1' }] } };
    await expect(runTournament(field(4), cfg(1, { rounds: 2, top: 0, bestOf: 1 }), play, { setup: base })).rejects.toThrow(/rematch/);
    const ok = await runTournament(field(4), cfg(1, { rounds: 2, top: 0, bestOf: 1 }), play, { setup: { ...base, pairings: { 1: [{ a: 'D0', b: 'D1' }], 2: [{ a: 'D0', b: 'D1', rematch: true }] } } });
    expect(ok.rounds[1]!.matches[0]).toMatchObject({ a: 'D0', b: 'D1', set: true });
  });
  it('round by round: pairings handed in at a pause give the same event as the same pairings in the setup', async () => {
    const steps: string[] = [];
    let set: { a: string; b: string }[] = [];
    const viaPause = await runTournament(field(7), cfg(8), slow, {
      beforeRound: (s) => {
        steps.push(`${s.stage}:${s.round}`);
        if (s.stage !== 'swiss' || s.round !== 2) return undefined;
        // pair the bottom two decks that have not met (the owner reading the standings)
        const rows = [...s.event.standings].reverse();
        const a = rows[0]!;
        const b = rows.find((x) => x.deck !== a.deck && !a.opps.includes(x.deck))!;
        set = [{ a: a.deck, b: b.deck }];
        return { pairs: set };
      },
    });
    const viaSetup = await runTournament(field(7), cfg(8), play, { setup: { format: 'swiss', entrants: ent(7), bestOf: 3, rounds: 3, top: 4, pairings: { 2: set } } });
    expect(viaPause.rounds[1]!.matches[0]).toMatchObject({ ...set[0], set: true });
    expect(viaPause.setup?.pairings).toEqual({ 2: set });
    expect(strip(viaPause)).toEqual(strip(viaSetup));
    expect(steps).toEqual(['swiss:1', 'swiss:2', 'swiss:3', 'cut:0', 'bracket:2']);
  });
  it('a hand-set round seeds its matches by key: the same pairing plays the same games at any table', async () => {
    const one = await runTournament(field(6), cfg(2, { rounds: 1, top: 0 }), play, { setup: { format: 'swiss', entrants: ent(6), bestOf: 3, rounds: 1, top: 0, pairings: { 1: [{ a: 'D0', b: 'D1' }, { a: 'D2', b: 'D3' }] } } });
    const two = await runTournament(field(6), cfg(2, { rounds: 1, top: 0 }), play, { setup: { format: 'swiss', entrants: ent(6), bestOf: 3, rounds: 1, top: 0, pairings: { 1: [{ a: 'D2', b: 'D3' }, { a: 'D0', b: 'D1' }] } } });
    const games = (ev: TourneyEvent, a: string) => ev.rounds[0]!.matches.find((m) => m.a === a)!.games.map((g) => [g.seed, g.first, g.winner]);
    expect(games(two, 'D0')).toEqual(games(one, 'D0'));
    expect(games(two, 'D2')).toEqual(games(one, 'D2'));
    expect(one.rounds[0]!.matches.find((m) => m.a === 'D0')!.games[0]!.seed).toBe(matchSeedBase(2, 'swiss:1:D0|D1'));
  });
  it('a manual top-cut order is used and recorded', async () => {
    const setup: EventSetup = { format: 'swiss', entrants: ent(8), bestOf: 1, rounds: 2, top: 4, cutSeeds: ['D7', 'D6', 'D5', 'D4'] };
    const ev = await runTournament(field(8), cfg(3, { rounds: 2, top: 4, bestOf: 1 }), play, { setup });
    expect(ev.seeds).toEqual(['D7', 'D6', 'D5', 'D4']);
    expect(ev.bracket[0]!.matches.map((m) => [m.a, m.b])).toEqual([
      ['D7', 'D4'],
      ['D6', 'D5'],
    ]);
    expect(ev.custom).toBe(true);
    expect(fieldMode(ev.setup)).toBe('swiss+manual-seeds');
  });
});

describe('brackets', () => {
  it('byes go to the top seeds in a non-power-of-two field', () => {
    expect(bracketOrder(8)).toEqual([0, 7, 3, 4, 1, 6, 2, 5]);
    expect(seededSlots(['A', 'B', 'C', 'D', 'E'])).toEqual(['A', null, 'D', 'E', 'B', null, 'C', null]);
    expect(seededSlots(['A', 'B', 'C', 'D', 'E', 'F'])).toEqual(['A', null, 'D', 'E', 'B', null, 'C', 'F']);
    expect(seededSlots(['A', 'B', 'C'])).toEqual(['A', null, 'B', 'C']);
    expect(seededSlots(['A', 'B'])).toEqual(['A', 'B']);
  });
  it('validates a hand-placed bracket', () => {
    expect(bracketProblems(['A', 'B', 'C', null], ['A', 'B', 'C'])).toEqual([]);
    expect(bracketProblems(['A', 'B', 'C'], ['A', 'B', 'C'])[0]).toMatch(/power-of-two/);
    expect(bracketProblems(['A', 'A', 'B', null], ['A', 'B'])).toContain('A is in the bracket twice');
    expect(bracketProblems([null, null, 'A', 'B'], ['A', 'B'])).toContain('first-round match 1 has two byes');
    expect(bracketProblems(['A', 'Z', null, 'B'], ['A', 'B'])).toContain('Z is not an entrant');
  });
  it('plays a 6-deck bracket with byes and Bo1 → Bo3 → Bo5, standings in bracket order', async () => {
    const setup: EventSetup = { format: 'single-elim', entrants: ent(6), bestOf: 3, bracketBestOf: [1, 3, 5] };
    const ev = await runTournament(field(6), cfg(5), play, { setup });
    expect(ev.bracket.map((r) => r.name)).toEqual(['Quarterfinals', 'Semifinals', 'Final']);
    expect(ev.bracket[0]!.matches.filter((m) => !m.b).map((m) => m.a)).toEqual(['D0', 'D1']);
    for (const m of ev.bracket[0]!.matches.filter((x) => x.b)) expect(m.games).toHaveLength(1);
    const final = ev.bracket[2]!.matches[0]!;
    expect(final.bestOf).toBe(5);
    expect(Math.max(...final.score)).toBe(3);
    expect(ev.champion).toBe(final.winner);
    expect(ev.standings[0]!.deck).toBe(ev.champion);
    expect(ev.standings[1]!.deck).toBe(final.winner === final.a ? final.b : final.a);
    expect(ev.rounds).toEqual([]);
    expect(ev.format).toBe('Single elimination, 6 decks (Bo1/Bo3/Bo5)');
    expect(ev.seeds).toEqual(names(6));
  });
  it('plays a bracket placed slot by slot', async () => {
    const slots = ['D3', 'D0', null, 'D1', 'D2', null, 'D4', 'D5'];
    const ev = await runTournament(field(6), cfg(5), play, { setup: { format: 'single-elim', entrants: ent(6), bestOf: 1, bracket: slots } });
    expect(ev.bracket[0]!.matches.map((m) => [m.a, m.b])).toEqual([
      ['D3', 'D0'],
      ['D1', null],
      ['D2', null],
      ['D4', 'D5'],
    ]);
    expect(ev.seeds).toBeUndefined();
    expect(fieldMode(ev.setup)).toBe('single-elim+custom-bracket');
  });
  it('ranks by how far each deck got', () => {
    const rows = ['A', 'B', 'C', 'D'].map((deck) => ({ deck }));
    const bracket = [{ matches: [{ a: 'A', b: 'D' }, { a: 'B', b: 'C' }] }, { matches: [{ a: 'D', b: 'C' }] }];
    expect(rankByBracket(rows, bracket, 'C').map((r) => r.deck)).toEqual(['C', 'D', 'A', 'B']);
  });
});

describe('round robin', () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 9])('%i decks: every pairing once, no deck twice in a round, seats balanced', (n) => {
    const sched = roundRobinSchedule(names(n));
    expect(sched).toHaveLength(n % 2 ? n : n - 1);
    const seen = new Set<string>();
    const seatA = new Map(names(n).map((d) => [d, 0]));
    for (const round of sched) {
      const decks = round.flatMap((m) => [m.a, m.b]);
      expect(new Set(decks).size).toBe(decks.length);
      for (const m of round) {
        const k = [m.a, m.b].sort().join('|');
        expect(seen.has(k)).toBe(false);
        seen.add(k);
        seatA.set(m.a, seatA.get(m.a)! + 1);
      }
    }
    expect(seen.size).toBe((n * (n - 1)) / 2);
    for (const [, k] of seatA) expect(Math.abs(k - (n - 1) / 2)).toBeLessThanOrEqual(1);
  });
  it('repeats each pairing, mirroring the seats on every other pass', () => {
    const sched = roundRobinSchedule(names(4), 2, true);
    expect(sched).toHaveLength(6);
    const first = sched.slice(0, 3).flat();
    const second = sched.slice(3).flat();
    expect(second.map((m) => [m.a, m.b, m.rep])).toEqual(first.map((m) => [m.b, m.a, 1]));
    expect(roundRobinSchedule(names(4), 2, false).slice(3).flat().map((m) => [m.a, m.b])).toEqual(first.map((m) => [m.a, m.b]));
  });
  it('splits groups by snake order and seeds the bracket winners first', () => {
    expect(groupSplit(names(8), 2)).toEqual([
      ['D0', 'D3', 'D4', 'D7'],
      ['D1', 'D2', 'D5', 'D6'],
    ]);
    expect(groupSplit(names(7), 3)).toEqual([['D0', 'D5', 'D6'], ['D1', 'D4'], ['D2', 'D3']]);
    expect(groupSeeds([['A1', 'A2', 'A3'], ['B1', 'B2']], 2)).toEqual(['A1', 'B1', 'A2', 'B2']);
  });
  it('plays a round robin: no byes scored, champion tops the table', async () => {
    const ev = await runTournament(field(5), cfg(6), play, { setup: { format: 'round-robin', entrants: ent(5), bestOf: 1 } });
    expect(ev.rounds).toHaveLength(5);
    expect(ev.rounds.every((r) => r.matches.length === 2 && r.matches.every((m) => m.b))).toBe(true);
    expect(ev.standings.reduce((a, s) => a + s.mw + s.ml, 0)).toBe(2 * 10);
    expect(ev.standings.every((s) => !s.opps.includes('BYE') && s.opps.length === 4)).toBe(true);
    expect(ev.champion).toBe(ev.standings[0]!.deck);
    expect(ev.custom).toBe(true);
    expect(ev.manifest?.field.mode).toBe('round-robin');
  });
  it('groups then a bracket', async () => {
    const ev = await runTournament(field(8), cfg(6), play, { setup: { format: 'round-robin', entrants: ent(8), bestOf: 1, groups: 2, advance: 2, bracketBestOf: [1, 3] } });
    expect(ev.groups?.map((g) => g.name)).toEqual(['Group A', 'Group B']);
    expect(ev.rounds).toHaveLength(3);
    expect(ev.bracket.map((r) => r.name)).toEqual(['Semifinals', 'Final']);
    const [a, b] = ev.groups!.map((g) => ev.standings.filter((s) => g.decks.includes(s.deck)).map((s) => s.deck));
    expect(ev.seeds).toEqual([a![0], b![0], a![1], b![1]]);
    // winners meet the other group's runner-up
    expect(ev.bracket[0]!.matches.map((m) => [m.a, m.b])).toEqual([
      [a![0], b![1]],
      [b![0], a![1]],
    ]);
    expect(ev.champion).toBe(ev.bracket[1]!.matches[0]!.winner);
    expect(fieldMode(ev.setup)).toBe('groups');
  });
});

describe('match lists', () => {
  const specs = [
    { a: 'D0', b: 'D1', times: 3, mirror: true },
    { a: 'D2', b: 'D3', bestOf: 5 as const, round: 2 },
    { a: 'D0', b: 'D1' },
  ];
  it('expands repeats, mirrors seats and groups rounds', () => {
    const ex = expandMatchList(specs, 3);
    expect(ex.map((r) => r.round)).toEqual([1, 2]);
    expect(ex[0]!.matches.map((m) => [m.a, m.b, m.rep, m.occ])).toEqual([
      ['D0', 'D1', 0, 0],
      ['D1', 'D0', 1, 0],
      ['D0', 'D1', 2, 1],
      ['D0', 'D1', 0, 2],
    ]);
    expect(ex[1]!.matches[0]).toMatchObject({ bestOf: 5 });
  });
  it('validates the list', () => {
    expect(matchListProblems(specs, names(4))).toEqual([]);
    expect(matchListProblems([], names(4))).toEqual(['the match list is empty']);
    expect(matchListProblems([{ a: 'D0', b: 'D0' }], names(4))[0]).toMatch(/itself/);
    expect(matchListProblems([{ a: 'D0', b: 'Z', times: 0 }], names(4))).toEqual(['match 1: Z is not an entrant', 'match 1: times must be a whole number from 1 to 100']);
  });
  it('plays exactly the listed matches with no champion; adding a match leaves the others alone', async () => {
    const setup: EventSetup = { format: 'matches', entrants: ent(4), bestOf: 3, matches: specs };
    const ev = await runTournament(field(4), cfg(9), slow, { setup });
    expect(ev.rounds.map((r) => r.matches.length)).toEqual([4, 1]);
    expect(ev.rounds[1]!.matches[0]!.bestOf).toBe(5);
    expect(ev.champion).toBeNull();
    expect(ev.format).toBe('Match list: 5 matches in 2 rounds');
    expect(ev.manifest?.field.mode).toBe('custom-matches');
    const more = await runTournament(field(4), cfg(9), play, { setup: { ...setup, matches: [{ a: 'D3', b: 'D1' }, ...specs] } });
    const games = (e: TourneyEvent) => e.rounds.flatMap((r) => r.matches).filter((m) => !(m.a === 'D3' && m.b === 'D1')).map((m) => m.games.map((g) => [g.seed, g.first, g.winner]));
    expect(games(more)).toEqual(games(ev));
  });
  it('a deck entered twice plays its own copy', async () => {
    const decks = [deck('D0'), { ...deck('D0'), name: copyName('D0', 2) }];
    const setup: EventSetup = { format: 'matches', entrants: [{ name: 'D0' }, { name: 'D0 #2', copyOf: 'D0' }], bestOf: 1, matches: [{ a: 'D0', b: 'D0 #2' }] };
    const ev = await runTournament(decks, cfg(1), play, { setup });
    expect(ev.rounds[0]!.matches[0]!.games).toHaveLength(1);
    expect(ev.decks['D0 #2']!.id).toBe(ev.decks.D0!.id);
    expect(entrantBase(ev.setup, 'D0 #2')).toBe('D0');
    expect(entrantBase(ev.setup, 'D0')).toBe('D0');
    expect(entrantBase(undefined, 'X #2')).toBe('X #2');
  });
});

describe('series rules', () => {
  it('the default rule is the coin flip from the seed base, then the loser', () => {
    for (const seedBase of [10, 20, 1230, 99990]) expect(firstPlayer({ gi: 0, seedBase })).toBe(hashBit(seedBase) ? 1 : 0);
    expect(firstPlayer({ gi: 1, seedBase: 10, prev: { first: 0, winner: 0 } })).toBe(1);
    expect(firstPlayer({ gi: 1, seedBase: 10, prev: { first: 0, winner: 1 } })).toBe(0);
    expect(firstPlayer({ gi: 1, seedBase: 10, prev: { first: 1, winner: 'tie' } })).toBe(0);
  });
  it('seat A, seat B, alternating by table, alternating seats', () => {
    expect(firstPlayer({ gi: 0, seedBase: 10, game1: 'a' })).toBe(0);
    expect(firstPlayer({ gi: 0, seedBase: 10, game1: 'b' })).toBe(1);
    expect([0, 1, 2, 3].map((alt) => firstPlayer({ gi: 0, seedBase: 10, game1: 'alternate', alt }))).toEqual([0, 1, 0, 1]);
    expect(firstPlayer({ gi: 1, seedBase: 10, next: 'alternate', prev: { first: 0, winner: 1 } })).toBe(1);
  });
  it('a whole event follows the rules: game 1 seat A, then alternating', async () => {
    const setup: EventSetup = { format: 'round-robin', entrants: ent(4), bestOf: 5, game1: 'a', next: 'alternate' };
    const ev = await runTournament(field(4), cfg(2), play, { setup });
    for (const m of all(ev)) m.games.forEach((g, i) => expect(g.first).toBe(i % 2));
    expect(ev.manifest?.seatPolicy).toBe('alternate');
    expect(ev.format).toMatch(/game 1: first-named deck, seats alternate/);
    expect(isStandardSetup(setup)).toBe(false);
  });
  it('Bo5 needs three wins', async () => {
    const ev = await runTournament(field(4), cfg(7, { rounds: 2, top: 0, bestOf: 5 }), play, { setup: { format: 'swiss', entrants: ent(4), bestOf: 5, rounds: 2, top: 0 } });
    for (const m of all(ev)) {
      expect(m.games.length).toBeGreaterThanOrEqual(3);
      expect(m.games.length).toBeLessThanOrEqual(5);
      if (m.games.every((g) => g.winner !== 'tie')) expect(Math.max(...m.score)).toBe(3);
    }
    // a standard event in Bo5 is not custom, but records its setup
    expect(ev.custom).toBeUndefined();
    expect(ev.setup?.bestOf).toBe(5);
  });
});

describe('determinism and resuming', () => {
  const setups: [string, EventSetup][] = [
    ['swiss', { format: 'swiss', entrants: ent(7), bestOf: 3, rounds: 3, top: 4, pairings: { 1: [{ a: 'D0', b: 'D6' }] }, bracketBestOf: [3, 5] }],
    ['single-elim', { format: 'single-elim', entrants: ent(7), bestOf: 3 }],
    ['round-robin', { format: 'round-robin', entrants: ent(6), bestOf: 3, times: 2, mirror: true }],
    ['matches', { format: 'matches', entrants: ent(4), bestOf: 3, matches: [{ a: 'D0', b: 'D1', times: 2 }, { a: 'D2', b: 'D3', round: 2 }] }],
  ];
  it.each(setups)('%s: same seed + same setup = same event, whatever order games finish in', async (_k, setup) => {
    const n = setup.entrants.length;
    const a = await runTournament(field(n), cfg(31), play, { setup });
    const b = await runTournament(field(n), cfg(31), slow, { setup });
    expect(strip(b)).toEqual(strip(a));
    const c = await runTournament(field(n), cfg(32), play, { setup });
    expect(strip(c)).not.toEqual(strip(a));
  });
  it.each(setups)('%s: a stopped run resumed with its games rebuilds the same event', async (_k, setup) => {
    const n = setup.entrants.length;
    const whole = await runTournament(field(n), cfg(5), play, { setup });
    let played = 0;
    let stop = false;
    const counting = (j: GameJob) => {
      if (++played >= 6) stop = true;
      return play(j);
    };
    const part = await runTournament(field(n), cfg(5), counting, { setup, shouldStop: () => stop });
    expect(part.phase).toBe('stopped');
    const saved = JSON.parse(JSON.stringify(part)) as TourneyEvent;
    let fresh = 0;
    const resumed = resumePlay((j) => (fresh++, play(j)), saved);
    const out = await runTournament(field(n), cfg(5), resumed, { setup: saved.setup ?? setup });
    expect(strip(out)).toEqual(strip(whole));
    expect(resumed.reused()).toBeGreaterThan(0);
    expect(resumed.reused() + fresh).toBe(whole.progress!.games);
  });
});

describe('setups', () => {
  it('estimates games; a plain Swiss event keeps the old numbers', () => {
    const s: EventSetup = { format: 'swiss', entrants: ent(11), bestOf: 3, rounds: 4, top: 8 };
    expect(estimateGames(s, 11)).toEqual({ estimate: Math.round(4 * 5 * 2.5 + 7 * 2.5), min: 4 * 5 * 2 + 7 * 2, max: 4 * 5 * 3 + 7 * 3, matches: 27 });
    // 6 decks in a bracket of 8: two byes, so two real quarterfinals
    expect(estimateGames({ format: 'single-elim', entrants: ent(6), bestOf: 1, bracketBestOf: [1, 3, 5] }, 6)).toEqual({ estimate: Math.round(2 + 2 * 2.5 + 4.125), min: 2 + 4 + 3, max: 2 + 6 + 5, matches: 5 });
    expect(estimateGames({ format: 'round-robin', entrants: ent(5), bestOf: 1, times: 2 }, 5).matches).toBe(20);
    expect(avgGames(5)).toBe(4.125);
  });
  it('lists what stops a setup from running', () => {
    expect(setupProblems({ format: 'swiss', entrants: ent(1), bestOf: 3 })).toEqual(['Swiss needs at least 2 entrants']);
    expect(setupProblems({ format: 'swiss', entrants: [{ name: 'A' }, { name: 'A' }], bestOf: 3 })[0]).toMatch(/unique/);
    expect(setupProblems({ format: 'round-robin', entrants: ent(5), bestOf: 3, groups: 3 })).toEqual(['3 groups need at least 6 entrants']);
    expect(setupProblems({ format: 'swiss', entrants: ent(8), bestOf: 3, cutSeeds: ['D0', 'D1', 'D2'] })[0]).toMatch(/2, 4, 8 or 16/);
    expect(setupProblems({ format: 'swiss', entrants: ent(8), bestOf: 4 as never })).toContain('best-of must be 1, 3 or 5');
  });
  it('labels formats', () => {
    expect(formatLabel({ format: 'swiss', entrants: ent(8), bestOf: 3, rounds: 3, top: 8 }, 8)).toBe('Swiss 3 rounds (Bo3) + top 8');
    expect(formatLabel({ format: 'swiss', entrants: ent(8), bestOf: 3, rounds: 3, top: 8, bracketBestOf: [3, 3, 5] }, 8)).toBe('Swiss 3 rounds (Bo3) + top 8, Bo3/Bo3/Bo5');
    expect(formatLabel({ format: 'round-robin', entrants: ent(6), bestOf: 1, times: 2, mirror: true }, 6)).toBe('Round robin ×2 mirrored (Bo1)');
    expect(formatLabel({ format: 'round-robin', entrants: ent(8), bestOf: 1, groups: 2, advance: 2 }, 8)).toBe('2 round-robin groups (Bo1) + top 2 per group (Bo1)');
  });
  it('a game that throws fails the event, never a tie', async () => {
    const bad = async (j: GameJob): Promise<GameRec> => {
      if (j.a.name === 'D1') throw new Error('boom');
      return play(j);
    };
    await expect(runTournament(field(4), cfg(1), bad, { setup: { format: 'round-robin', entrants: ent(4), bestOf: 1 } })).rejects.toThrow('boom');
  });
  it('refuses a setup that does not match the decks', async () => {
    await expect(runTournament(field(4), cfg(1), play, { setup: { format: 'round-robin', entrants: ent(5), bestOf: 1 } })).rejects.toThrow(/different entrants/);
    await expect(runTournament(field(4), cfg(1), play, { setup: { format: 'matches', entrants: ent(4), bestOf: 1, matches: [] } })).rejects.toThrow(/match list is empty/);
  });
});
