// Played events (src/lib/playedEvent.ts): who runs each entrant and the presets; a round waits for every result; results
// played on the board, recorded by hand and simulated feed standings, tiebreaks, brackets and groups alike; a bot event
// set up through the new path is the event it always was (pins); a played run counts for no ledger, rating or upset;
// saving and resuming with a game in progress, a played match and a hand-recorded match; old runs and links still read.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstPlayer, isPlainSetup, isPlayedSetup, matchSeedBase, resumePlay, runTournament, setupProblems, winsNeeded, type EventSetup, type GameJob, type GameRec, type TourneyEvent } from '../src/lib/tournament';
import {
  applyPreset,
  draftSeatsFromLink,
  EMPTY_HAND_FORM,
  gameKey,
  handGames,
  handProblems,
  keepRuns,
  matchKind,
  NO_SEATS,
  noShowReason,
  personGames,
  PlayedGames,
  presetOf,
  readHandForm,
  seatFor,
  seatsFromLink,
  seatsToLink,
  setSeat,
  setupSeats,
  waitingMatch,
  type WaitingGame,
} from '../src/lib/playedEvent';
import { DEFAULT_DRAFT, draftSetup, entrantKey, type EventDraft } from '../src/lib/eventDraft';
import { BUILTIN } from '../src/lib/browserLibrary';
import { draftLinkQuery, parseRunParams, parseRuns, runParamsQuery } from '../src/ui/runParams';
import { ledgerRunOf, recordRun } from '../src/lib/runLedgerEntry';
import { eventRatedGames } from '../src/lib/ratingGames';
import { judgeMatches, PLAYED_NOT_JUDGED, upsetYardstick } from '../src/lib/eventUpsets';
import { fingerprintText } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';

const deck = (name: string, k = 0): DeckList => ({ name, legends: [`L${k}`], main: [`c${k}`, 'x'], sideboard: [] });
const field = (n: number) => Array.from({ length: n }, (_, i) => deck(`D${i}`, i));
const ent = (n: number) => field(n).map((d) => ({ name: d.name }));
// the fake game of tests/event-formats.test.ts, and one without ties (people record no draws)
const play = async (j: GameJob): Promise<GameRec> => {
  const h = Math.imul(j.seed ^ 0x9e3779b9, 2654435761) >>> 0;
  const a = +j.a.name.replace(/\D/g, '');
  const b = +j.b.name.replace(/\D/g, '');
  return { seed: j.seed, first: j.first, winner: (h >>> 7) % 13 === 0 ? 'tie' : (h >>> 10) % 100 < 50 + (b - a) * 3 + (j.first === 0 ? 5 : -5) ? 0 : 1, turns: 5 + (h % 9), reason: 'test' };
};
const noTie = async (j: GameJob): Promise<GameRec> => {
  const g = await play(j);
  return g.winner === 'tie' ? { ...g, winner: (j.seed >> 3) % 2 === 0 ? 0 : 1 } : g;
};
const cfg = (seed: number, o: Partial<{ rounds: number; top: number; bestOf: 1 | 3 | 5 }> = {}) => ({ name: 't', rounds: 3, top: 4, bestOf: 3 as const, bot: 'medium' as const, seed, ...o });
const tick = () => new Promise((r) => setTimeout(r, 0));

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

/** The games a person would record by hand for a match, from its waiting game: the same games the fake would play. */
async function sameAsFake(w: WaitingGame, bo: number, next?: EventSetup['next']): Promise<(0 | 1)[]> {
  const need = winsNeeded(bo);
  const out: (0 | 1)[] = [];
  const score = [0, 0];
  let prev: GameRec | undefined;
  for (let gi = w.gi; score[0]! < need && score[1]! < need; gi++) {
    const first = gi === w.gi ? w.job.first : firstPlayer({ gi, prev, seedBase: w.base, next });
    const g = await noTie({ ...w.job, seed: w.base + gi, first });
    out.push(g.winner as 0 | 1);
    score[g.winner as 0 | 1]!++;
    prev = g;
  }
  return out;
}

/** A person at the event: answers every waiting game as the fake would have played it (yours on the board, others by hand). */
function person(pg: PlayedGames, bestOf: (w: WaitingGame) => number, next?: EventSetup['next']) {
  const busy = new Set<string>();
  const answer = () => {
    for (const w of pg.waiting) {
      if (busy.has(w.id)) continue;
      busy.add(w.id);
      setTimeout(async () => {
        if (w.kind === 'you') expect(pg.finish(w.id, { ...(await noTie(w.job)), replay: `p-${w.id.length}` })).toBe(true);
        else expect(pg.record(w.id, { winners: await sameAsFake(w, bestOf(w), next) }, bestOf(w))).toEqual([]);
      }, 0);
    }
  };
  answer();
  return pg.subscribe(answer);
}

const comparable = (ev: TourneyEvent) => ({
  rounds: ev.rounds.map((r) => r.matches.map((m) => [m.a, m.b, m.winner, m.score, m.games.map((g) => [g.seed, g.first, g.winner])])),
  bracket: ev.bracket.map((r) => [r.name, r.matches.map((m) => [m.a, m.b, m.winner, m.score, m.games.map((g) => [g.seed, g.first, g.winner])])]),
  seeds: ev.seeds,
  standings: ev.standings.map((s) => [s.deck, s.mp, s.mw, s.ml, s.gw, s.gl, s.opps, s.omw, s.gwp]),
  groups: ev.groups,
  champion: ev.champion,
});

describe('seats and presets', () => {
  const keys = ['a#1', 'b#1', 'c#1'];
  it('the presets: bots only, play in it (you take one entrant), players only (you and other players)', () => {
    expect(presetOf(keys, NO_SEATS)).toBe('bots');
    const play = applyPreset(keys, NO_SEATS, 'play');
    expect(keys.map((k) => seatFor(play, k))).toEqual(['you', 'bot', 'bot']);
    expect(presetOf(keys, play)).toBe('play');
    const players = applyPreset(keys, setSeat(keys, play, 'b#1', 'you'), 'players');
    expect(keys.map((k) => seatFor(players, k))).toEqual(['player', 'you', 'player']);
    expect(presetOf(keys, players)).toBe('players');
    // an entrant added later takes the event's default: a player in a players-only event
    expect(seatFor(players, 'd#1')).toBe('player');
    expect(applyPreset(keys, players, 'bots')).toEqual(NO_SEATS);
  });
  it('one entrant is yours at most; a mix is "mixed"', () => {
    const d = setSeat(keys, applyPreset(keys, NO_SEATS, 'play'), 'c#1', 'you');
    expect(keys.map((k) => seatFor(d, k))).toEqual(['bot', 'bot', 'you']);
    const mixed = setSeat(keys, d, 'a#1', 'player');
    expect(presetOf(keys, mixed)).toBe('mixed');
    expect(setupSeats(keys.map((key, i) => ({ key, name: `D${i}` })), mixed)).toEqual({ D0: 'player', D2: 'you' });
    expect(setupSeats(keys.map((key, i) => ({ key, name: `D${i}` })), NO_SEATS)).toBeUndefined();
    expect(setupProblems({ format: 'swiss', entrants: ent(3), bestOf: 3, seats: { D0: 'you', D1: 'you' } })).toContain('you can play one entrant (set the others to another player or a bot)');
    expect(setupProblems({ format: 'swiss', entrants: ent(3), bestOf: 3, seats: { X: 'player' } })).toContain('X is not an entrant (who plays it)');
  });
  it('who decides a match', () => {
    const s = { seats: { D0: 'you' as const, D1: 'player' as const } };
    expect(matchKind(s, 'D2', 'D3')).toBe('bots');
    expect(matchKind(s, 'D0', 'D3')).toBe('you');
    expect(matchKind(s, 'D3', 'D0')).toBe('you');
    expect(matchKind(s, 'D0', 'D1')).toBe('hand');
    expect(matchKind(s, 'D1', 'D2')).toBe('hand');
    expect(isPlayedSetup(s)).toBe(true);
    expect(isPlayedSetup({ seats: {} })).toBe(false);
    expect(isPlayedSetup({ seats: 'you' })).toBe(false);
    expect(isPlayedSetup(null)).toBe(false);
  });
});

describe('a bot event through the new path is the event it always was', () => {
  const byFile = new Map(BUILTIN.map((d) => [d.file, d]));
  const meta = BUILTIN.filter((d) => d.kind === 'meta').slice(0, 6);
  const base: EventDraft = { ...DEFAULT_DRAFT, entrants: meta.map((d) => ({ file: d.file, copy: 1 })) };
  it('"Bots only", or seats set and taken back, builds the same setup as a draft from before seats existed', () => {
    const keys = base.entrants.map(entrantKey);
    const { seats: _s, seatDefault: _d, coach: _c, ...old } = base;
    const before = draftSetup(old as EventDraft, byFile);
    for (const d of [base, { ...base, ...applyPreset(keys, applyPreset(keys, NO_SEATS, 'players'), 'bots') }, { ...base, ...setSeat(keys, applyPreset(keys, NO_SEATS, 'play'), keys[0]!, 'bot') }]) {
      const now = draftSetup(d, byFile);
      expect(now.setup).toEqual(before.setup);
      expect(JSON.stringify(now.setup)).toBe(JSON.stringify(before.setup));
      expect('seats' in now.setup).toBe(false);
      expect(isPlainSetup(now.setup)).toBe(true);
    }
    const played = draftSetup({ ...base, ...applyPreset(keys, NO_SEATS, 'play') }, byFile).setup;
    expect(played.seats).toEqual({ [meta[0]!.deck.name]: 'you' });
    expect(isPlainSetup(played)).toBe(false);
  });
  it('the pinned default events are unchanged when played through PlayedGames with no people (and with no setup)', async () => {
    // the pins of tests/event-formats.test.ts "default Swiss events are unchanged"
    const norm = (ev: TourneyEvent) => JSON.stringify({ ...ev, date: '', manifest: { ...ev.manifest, runId: '', createdAt: '', cardDataVersion: '' } });
    const PINS: [number, number, number, 1 | 3, number, string][] = [
      [7, 3, 4, 3, 42, 'f2266d27da22b69c'],
      [8, 3, 8, 1, 7, 'f8247245836da5b8'],
    ];
    for (const [n, rounds, top, bestOf, seed, pin] of PINS) {
      const pg = new PlayedGames(undefined, play);
      const ev = await runTournament(field(n), { name: 'pin', rounds, top, bestOf, bot: 'medium', seed }, resumePlay(pg.play, null), { id: seed });
      expect(fingerprintText(norm(ev))).toBe(pin);
      expect(pg.version).toBe(0);
    }
  });
});

describe('a played event', () => {
  // 6 entrants, D0 yours, D1 another player: Swiss 3 rounds Bo3, top 4
  const setup: EventSetup = { format: 'swiss', entrants: ent(6), bestOf: 3, rounds: 3, top: 4, seats: { D0: 'you', D1: 'player' } };

  it('a round is not paired until every match of the one before has its result', async () => {
    const pg = new PlayedGames(setup, play);
    const shown: TourneyEvent[] = [];
    const run = runTournament(field(6), cfg(11), pg.play, { setup, onUpdate: (e) => shown.push(e) });
    for (let i = 0; i < 20; i++) await tick();
    // round 1 is paired; its bot matches are done; the people's matches wait, and round 2 is not paired
    expect(shown.at(-1)!.rounds).toHaveLength(1);
    expect(pg.waiting.length).toBeGreaterThan(0);
    for (const w of pg.waiting) expect(matchKind(setup, w.job.a.name, w.job.b.name)).not.toBe('bots');
    const stop = person(pg, () => 3);
    const ev = await run;
    stop();
    expect(ev.phase).toBe('done');
    expect(ev.rounds).toHaveLength(3);
    expect(ev.champion).toBeTruthy();
    // a played event records its setup and is seeded by match keys: every Swiss game's seed base is a keyed one
    expect(ev.setup?.seats).toEqual({ D0: 'you', D1: 'player' });
    expect(ev.manifest?.field.mode).toBe('swiss+played');
    expect(personGames(ev)).toBeGreaterThan(0);
    for (const [ri, r] of ev.rounds.entries()) for (const m of r.matches) if (m.b) expect(m.games[0]!.seed).toBe(matchSeedBase(11, `swiss:${ri + 1}:${m.a}|${m.b}`));
    for (const [ri, r] of ev.bracket.entries()) for (const m of r.matches) if (m.b) expect(m.games[0]!.seed).toBe(matchSeedBase(11, `top:${ri}:${m.a}|${m.b}`));
  });

  it.each<[string, EventSetup]>([
    ['Swiss + top cut', setup],
    ['a bracket', { format: 'single-elim', entrants: ent(8), bestOf: 3, seats: { D3: 'you', D5: 'player' }, bracketBestOf: [1, 3, 5] }],
    ['groups then a bracket', { format: 'round-robin', entrants: ent(8), bestOf: 1, groups: 2, advance: 2, seats: { D0: 'player', D3: 'you', D6: 'player' } }],
    ['a match list', { format: 'matches', entrants: ent(4), bestOf: 3, matches: [{ a: 'D0', b: 'D1', bestOf: 5 }, { a: 'D2', b: 'D3', round: 2 }, { a: 'D1', b: 'D2', round: 2 }], seats: { D0: 'you', D3: 'player' } }],
  ])('%s: results played on the board, recorded by hand and simulated count alike', async (_k, s) => {
    const n = s.entrants.length;
    // the same event with every game simulated (keyed seeds, as a played event has)
    const sim = await runTournament(field(n), cfg(23), noTie, { setup: s });
    const pg = new PlayedGames(s, noTie);
    let last: TourneyEvent | null = null;
    const stop = person(pg, (w) => waitingMatch(last, w)?.bestOf ?? s.bestOf, s.next);
    const ev = await runTournament(field(n), cfg(23), pg.play, { setup: s, onUpdate: (e) => (last = e) });
    stop();
    expect(comparable(ev)).toEqual(comparable(sim));
    const games = [...ev.rounds, ...ev.bracket].flatMap((r) => r.matches).flatMap((m) => m.games);
    expect(games.some((g) => g.by === 'you' && g.replay)).toBe(true);
    expect(games.some((g) => g.by === 'hand' && g.turns === 0)).toBe(true);
    expect(games.some((g) => !g.by)).toBe(true);
  });

  it('a forfeit: the side that did not play loses in straight games, with no game stats', async () => {
    const s: EventSetup = { format: 'matches', entrants: ent(2), bestOf: 3, matches: [{ a: 'D0', b: 'D1' }], seats: { D0: 'player', D1: 'player' } };
    const pg = new PlayedGames(s, play);
    const run = runTournament(field(2), cfg(3), pg.play, { setup: s });
    await tick();
    const [w] = pg.waiting;
    expect(w!.kind).toBe('hand');
    expect(pg.record(w!.id, { noShow: 0 }, 3)).toEqual([]);
    const ev = await run;
    const m = ev.rounds[0]!.matches[0]!;
    expect(m.winner).toBe('D1');
    expect(m.score).toEqual([0, 2]);
    expect(m.games.map((g) => g.reason)).toEqual([noShowReason('D0'), noShowReason('D0')]);
    const d1 = ev.standings.find((r) => r.deck === 'D1')!;
    expect([d1.mp, d1.gw, d1.gl, d1.games, d1.turns]).toEqual([3, 2, 0, 0, 0]);
  });

  it('counts for nothing a bot statistic reads: the ledger, the rated games, the upsets', async () => {
    const s: EventSetup = { format: 'swiss', entrants: ent(4), bestOf: 1, rounds: 2, top: 0, seats: { D0: 'you' } };
    const pg = new PlayedGames(s, play);
    const stop = person(pg, () => 1);
    const ev = await runTournament(field(4), cfg(9, { rounds: 2, top: 0, bestOf: 1 }), pg.play, { setup: s, id: 'run-played' });
    stop();
    expect(ev.phase).toBe('done');
    expect(ledgerRunOf(ev)).toBeNull();
    expect(recordRun(ev)).toBe('skipped');
    // its bot-against-bot games too
    expect(ev.rounds.flatMap((r) => r.matches).some((m) => m.b && m.games.every((g) => !g.by))).toBe(true);
    expect(eventRatedGames(ev)).toEqual([]);
    const asRecorded = { ...ev, id: 2, bot: 'medium', simVersion: ev.simVersion };
    const judged = judgeMatches(asRecorded, upsetYardstick([], asRecorded));
    expect(judged.length).toBeGreaterThan(0);
    expect(judged.every((m) => !m.judged && !m.upset && m.reason === PLAYED_NOT_JUDGED)).toBe(true);
    // the same event without people would count
    const bots = await runTournament(field(4), cfg(9, { rounds: 2, top: 0, bestOf: 1 }), play, { id: 'run-bots' });
    expect(ledgerRunOf(bots)).not.toBeNull();
    expect(eventRatedGames(bots).length).toBeGreaterThan(0);
  });
});

describe('recording a match by hand', () => {
  const job: GameJob = { a: deck('A'), b: deck('B'), seed: 1230, first: 1, bot: 'medium' };
  const w = { job, gi: 0, base: 1230 };
  it('checks the series: finished, nothing after the win, every game said', () => {
    expect(handProblems({ winners: [0, 0] }, 3)).toEqual([]);
    expect(handProblems({ winners: [0, 1, 1] }, 3)).toEqual([]);
    expect(handProblems({ winners: [0] }, 3)).toEqual(['the match is not finished: someone needs 2 wins']);
    expect(handProblems({ winners: [0, 0, 1] }, 3)).toEqual(['game 3 comes after the match was already won']);
    expect(handProblems({ winners: [] }, 1)).toEqual(['say who won the game']);
    expect(handProblems({ noShow: 1 }, 5)).toEqual([]);
  });
  it('the games carry the seeds and seats the event would give them, by hand, with no turns', () => {
    const gs = handGames(w, { winners: [1, 0, 0] }, 3, 'loser');
    expect(gs.map((g) => [g.seed, g.first, g.winner, g.turns, g.by])).toEqual([
      [1230, 1, 1, 0, 'hand'],
      [1231, 0, 0, 0, 'hand'],
      [1232, 1, 0, 0, 'hand'],
    ]);
    expect(handGames(w, { noShow: 1 }, 5).map((g) => g.winner)).toEqual([0, 0, 0]);
  });
  it('the form: one more game row while the match is undecided, the score, and what is missing', () => {
    expect(readHandForm(EMPTY_HAND_FORM, 3)).toMatchObject({ rows: 1, result: null });
    expect(readHandForm({ ...EMPTY_HAND_FORM, winners: [0] }, 3)).toMatchObject({ rows: 2, score: [1, 0], result: null });
    expect(readHandForm({ ...EMPTY_HAND_FORM, winners: [0, 1] }, 3)).toMatchObject({ rows: 3, score: [1, 1], result: null });
    expect(readHandForm({ ...EMPTY_HAND_FORM, winners: [0, 1, 1] }, 3)).toMatchObject({ rows: 3, score: [1, 2], result: { winners: [0, 1, 1] }, problems: [] });
    // a change early on that settles the match drops the games after it
    expect(readHandForm({ ...EMPTY_HAND_FORM, winners: [0, 0, 1] }, 3)).toMatchObject({ rows: 2, result: { winners: [0, 0] } });
    expect(readHandForm({ mode: 'noShow', winners: [], noShow: null }, 3).result).toBeNull();
    expect(readHandForm({ mode: 'noShow', winners: [], noShow: 0 }, 3)).toMatchObject({ score: [0, 2], result: { noShow: 0 } });
  });
  it('a result is taken once, for the match that waits', async () => {
    const pg = new PlayedGames({ seats: { A: 'player' } }, play);
    const p = pg.play(job);
    const id = gameKey('A', 'B', 1230, 1);
    expect(pg.waiting.map((x) => x.id)).toEqual([id]);
    expect(pg.record(id, { winners: [0] }, 3)).toEqual(['the match is not finished: someone needs 2 wins']);
    expect(pg.finish(id, { seed: 1230, first: 1, winner: 0, turns: 4, reason: '' })).toBe(false);
    expect(pg.record(id, { winners: [0, 0] }, 3)).toEqual([]);
    expect((await p).winner).toBe(0);
    expect(pg.waiting).toEqual([]);
    expect(pg.record(id, { winners: [0, 0] }, 3)).toEqual(['this match is not waiting for a result']);
    // the match's later game comes from the record without waiting
    const g2 = await pg.play({ ...job, seed: 1231, first: 1 });
    expect([g2.winner, g2.by]).toEqual([0, 'hand']);
  });
});

describe('saving and resuming', () => {
  // 4 entrants, Bo3 match list: D0 (yours) vs D1 (a bot), D2 vs D3 (another player), then round 2 D0 vs D2
  const s: EventSetup = {
    format: 'matches',
    entrants: ent(4),
    bestOf: 3,
    matches: [
      { a: 'D0', b: 'D1' },
      { a: 'D2', b: 'D3' },
      { a: 'D0', b: 'D2', round: 2 },
      { a: 'D1', b: 'D3', round: 2 },
    ],
    seats: { D0: 'you', D3: 'player' },
  };
  it('a stopped run keeps every result with its source and your game in progress; Resume asks for none of them again', async () => {
    const whole = await runTournament(field(4), cfg(77), noTie, { setup: s });
    // round 1: D0 vs D1 played to its end on the board, D2 vs D3 recorded by hand; round 2: D0's game 1 in progress
    const pg = new PlayedGames(s, noTie);
    let last: TourneyEvent | null = null;
    const answered: string[] = [];
    let stopAt = null as WaitingGame | null;
    pg.subscribe(() => {
      for (const w of pg.waiting) {
        if (answered.includes(w.id)) continue;
        answered.push(w.id);
        setTimeout(async () => {
          if (w.kind === 'hand') pg.record(w.id, { winners: await sameAsFake(w, 3) }, 3);
          else if (waitingMatch(last, w)?.round === 'Round 2') stopAt = w;
          else pg.finish(w.id, { ...(await noTie(w.job)), replay: 'p1' });
        }, 0);
      }
    });
    const run = runTournament(field(4), cfg(77), pg.play, { setup: s, onUpdate: (e) => (last = e) }).catch((e: Error) => e);
    while (!stopAt) await tick();
    // what the runner saves: the last update, stopped, with your game in progress (its save is opaque here)
    const save = { kind: 'nct-saved-game', note: 'a save' };
    const saved: TourneyEvent = JSON.parse(JSON.stringify({ ...last!, phase: 'stopped', played: { coach: true, current: { game: stopAt!.id, save } } }));
    pg.stop(Object.assign(new Error('stopped'), { name: 'PoolStoppedError' }));
    expect(await run).toBeInstanceOf(Error);
    const r1 = saved.rounds[0]!.matches;
    expect(r1.map((m) => [m.a, m.b, m.games.map((g) => g.by ?? 'bot')])).toEqual([
      ['D0', 'D1', r1[0]!.games.map(() => 'you')],
      ['D2', 'D3', r1[1]!.games.map(() => 'hand')],
    ]);
    expect(r1[0]!.games.every((g) => g.replay === 'p1')).toBe(true);
    // stored with the runner's runs and read back
    expect(parseRuns(JSON.stringify([saved]))[0]!.played).toEqual({ coach: true, current: { game: stopAt!.id, save } });

    // Resume: the finished games are reused; only the game in progress (and what follows) is asked again
    const pg2 = new PlayedGames(saved.setup, noTie);
    const asked: WaitingGame[] = [];
    pg2.subscribe(() => {
      for (const w of pg2.waiting) {
        if (asked.some((x) => x.id === w.id)) continue;
        asked.push(w);
        setTimeout(async () => {
          if (w.kind === 'hand') pg2.record(w.id, { winners: await sameAsFake(w, 3) }, 3);
          else pg2.finish(w.id, { ...(await noTie(w.job)), replay: 'p2' });
        }, 0);
      }
    });
    const out = await runTournament(field(4), cfg(77), resumePlay(pg2.play, saved), { setup: saved.setup });
    expect(asked[0]!.id).toBe(stopAt!.id);
    expect(asked.every((w) => w.job.a.name !== 'D2' || w.job.b.name !== 'D3')).toBe(true);
    expect(asked.every((w) => !(w.job.a.name === 'D0' && w.job.b.name === 'D1'))).toBe(true);
    expect(comparable(out)).toEqual(comparable(whole));
  });
  it('an old stored run (no played block, no game sources) reads as before', () => {
    const old = { id: 'r1', name: 'Run 1', date: '2026-11-12T00:00:00Z', bot: 'easy', format: 'Swiss', config: { name: 'x', rounds: 1, top: 0, bestOf: 1, bot: 'easy', seed: 3 }, decks: {}, rounds: [{ round: 1, matches: [{ a: 'A', b: 'B', games: [{ seed: 1, first: 0, winner: 0, turns: 5, reason: '' }], winner: 'A', score: [1, 0] }] }], bracket: [], standings: [], champion: 'A', phase: 'done' };
    const [r] = parseRuns(JSON.stringify([old]));
    expect(r).toEqual(old);
    expect(isPlayedSetup(r!.setup)).toBe(false);
    expect(personGames(r!)).toBe(0);
    expect(ledgerRunOf({ ...old, decks: { A: { legends: ['L'], main: ['a'] }, B: { legends: ['M'], main: ['b'] } } })).not.toBeNull();
  });
  it('the runs kept: the newest six as always; an unfinished played event goes only for a newer run', () => {
    const run = (id: string, o: Partial<{ phase: string; setup: unknown }> = {}) => ({ id, phase: 'done', ...o });
    const others = ['b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => run(id));
    expect(keepRuns(run('a'), others, 6).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    const open = run('h', { phase: 'stopped', setup: { seats: { X: 'you' } } });
    expect(keepRuns(run('a'), [...others.slice(0, 6), open], 6).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'h']);
    // a stopped bot run has no such priority
    expect(keepRuns(run('a'), [...others.slice(0, 6), run('h', { phase: 'stopped' })], 6).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});

describe('the setup link', () => {
  const bots = ['easy', 'medium', 'hard'];
  it('carries who runs each entrant; read back it gives the same seats; "you" is whoever opens it', () => {
    const entrants = [
      { file: 'x.txt', copy: 1 },
      { file: 'y.txt', copy: 1 },
      { file: 'x.txt', copy: 2 },
    ];
    const keys = entrants.map(entrantKey);
    const seats = setSeat(keys, applyPreset(keys, NO_SEATS, 'play'), 'y.txt#1', 'player');
    const q = draftLinkQuery({ ...DEFAULT_DRAFT, entrants, ...seats, coach: true }, 'medium', 77);
    expect(q.get('seat')).toBe('ypb');
    expect(q.get('coach')).toBe('1');
    const p = parseRunParams(q, bots);
    expect(p.seats).toEqual(['you', 'player', 'bot']);
    expect(p.coach).toBe(true);
    expect(runParamsQuery(p).toString()).toBe(q.toString());
    expect(draftSeatsFromLink(keys, p.seats!)).toEqual({ seats: { 'x.txt#1': 'you', 'y.txt#1': 'player' }, seatDefault: 'bot' });
  });
  it('a bot event’s link is what it always was, and an old link reads with every entrant a bot', () => {
    const q = draftLinkQuery({ ...DEFAULT_DRAFT, entrants: [{ file: 'x.txt', copy: 1 }, { file: 'y.txt', copy: 1 }] }, 'hard', 5);
    expect(q.toString()).toBe('f=custom&d=x.txt%2Cy.txt&fmt=swiss&t=8&bo=3&bot=hard&s=5');
    const old = parseRunParams(new URLSearchParams('f=custom&d=x.txt,y.txt&fmt=swiss&t=8&bo=3&bot=hard&s=5'), bots);
    expect(old.seats).toBeUndefined();
    expect(old.coach).toBeUndefined();
    expect(Object.keys(old)).not.toContain('seats');
  });
  it('a malformed seat value is ignored (every entrant a bot)', () => {
    for (const v of ['yy', 'bxz', '', 'b'.repeat(257)]) expect(seatsFromLink(v)).toBeNull();
    expect(parseRunParams(new URLSearchParams('f=meta&seat=y'), bots).seats).toBeUndefined();
    expect(seatsToLink(['bot', 'bot'])).toBeNull();
  });
});
