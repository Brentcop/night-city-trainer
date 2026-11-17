// "Watch" (a spectator's view of a match), the pure half: a game is played again exactly as it was played (an event game
// with the event's bot, a game a person played from its record, replayed strictly), or refused with one sentence; the
// frames the board is given carry both hands; the match planner follows the event's own rules (src/lib/watchMatch.ts);
// and the runner's note of dealt games changes nothing in the event it watches.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { CARD_BY_ID, CARDS } from '../src/engine/cards';
import { makeTierBot } from '../src/ai/tiers';
import type { Agent, Decision, DeckList, GameState } from '../src/engine/types';
import { stateHash } from '../src/lib/stateHash';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import type { PracticeReplay } from '../src/lib/practiceReplays';
import { eventVersionProblem, playWatchGame, WatchRefused, watchWords } from '../src/lib/watchGame';
import { DealtGames, movedCards, nextGame, nextOf, scoreOf, type WatchMatch } from '../src/lib/watchMatch';
import { recordTarget } from '../src/lib/watchRecord';
import { gameDeck, runTournament, type GameJob, type GameRec, type PlayGame } from '../src/lib/tournament';

const ROOT = path.resolve(__dirname, '..');

/** A recorded event and one short game of it (two decks of event 1, seed 1020010: 11 turns, about a third of a second). */
const ev = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/events/archive/event-1.json'), 'utf8')) as {
  bot: string;
  simVersion: number;
  decks: Record<string, { legends: string[]; main: string[] }>;
  rounds: { matches: { a: string; b: string | null; games: GameRec[] }[] }[];
};
const match = ev.rounds.flatMap((r) => r.matches).find((m) => m.b && m.games.some((g) => g.seed === 1020010))!;
const game = match.games.find((g) => g.seed === 1020010)!;
const deck = (name: string): DeckList => gameDeck({ name, ...ev.decks[name]! });
const eventSource = (o: Partial<{ seed: number; bot: string; simVersion: number | undefined }> = {}) => ({
  kind: 'event' as const,
  decks: [deck(match.a), deck(match.b!)] as [DeckList, DeckList],
  seed: o.seed ?? game.seed,
  first: game.first,
  bot: o.bot ?? ev.bot,
  ...('simVersion' in o ? (o.simVersion === undefined ? {} : { simVersion: o.simVersion }) : { simVersion: ev.simVersion }),
  expect: { winner: game.winner, turns: game.turns },
});

const refusal = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(WatchRefused);
    return (e as Error).message;
  }
  throw new Error('not refused');
};

describe('an event game, played again', () => {
  it('reaches the recorded winner after the recorded number of turns, with a board after every log line', async () => {
    const out = await playWatchGame(eventSource());
    expect(out.winner).toBe(game.winner);
    expect(out.turns).toBe(game.turns);
    expect(out.frames.length).toBeGreaterThan(20);
    // the last frame is the end of the game, and its line says who won
    const last = out.frames[out.frames.length - 1]!;
    expect(last.line.text).toContain(game.winner === 'tie' ? 'drawn' : `${[match.a, match.b][game.winner as 0 | 1]} wins`);
    // the board the spectator is given shows both hands: real cards, in both seats' hands, at some point
    const both = out.frames.find((f) => f.state.players[0].hand.length > 0 && f.state.players[1].hand.length > 0)!;
    for (const p of [0, 1] as const) for (const u of both.state.players[p].hand) expect(CARD_BY_ID[both.state.cards[u]!.defId]).toBeDefined();
  }, 60_000);

  it('a wrong seed or a wrong bot is refused with one sentence, never shown as the game', async () => {
    const seed = await refusal(playWatchGame(eventSource({ seed: game.seed + 1 })));
    expect(seed).toMatch(/^This game can't be watched: playing it again with this version of the bots and rules engine gives a different game \(it (ends in|lasts) .+ as recorded\)\.$/);
    const bot = await refusal(playWatchGame(eventSource({ bot: 'easy' })));
    expect(bot).toMatch(/^This game can't be watched: .+ as recorded\)\.$/);
  }, 60_000);

  it('an event of another simulator version, or one that predates the version, is refused before playing', async () => {
    expect(eventVersionProblem(CURRENT_SIM_VERSION)).toBeNull();
    const older = await refusal(playWatchGame(eventSource({ simVersion: CURRENT_SIM_VERSION - 1 })));
    expect(older).toBe(
      `This game can't be watched: its event was recorded with version ${CURRENT_SIM_VERSION - 1} of the bots and rules engine, and this is version ${CURRENT_SIM_VERSION}, so playing it again would not give the same game.`,
    );
    expect(await refusal(playWatchGame(eventSource({ simVersion: undefined })))).toMatch(/recorded before events kept the version/);
  });
});

// ---------------------------------------------------------------- a game a person played

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];

/** Your seat as a person plays it (choosing payment and order), answered by an Easy bot, every answer recorded. */
class Recorder implements Agent {
  name = 'you';
  choices: number[][] = [];
  readonly choosesPayment = true;
  readonly choosesOrder = true;
  constructor(private inner: Agent) {}
  async decide(g: Game, d: Decision) {
    const r = await this.inner.decide(g, d);
    this.choices.push([...r]);
    return r;
  }
}

/** A finished practice game against the Easy bot, as the site records it. */
async function practiceRecord(): Promise<PracticeReplay> {
  const you = new Recorder(makeTierBot('easy', 5));
  const st = await Game.create(decks, [you, makeTierBot('easy', 9, 'Bot')], { seed: 42, first: 0, log: false }).run();
  const w = st.winner;
  return {
    id: 'p1',
    date: '2026-11-16T00:00:00.000Z',
    decks,
    seed: 42,
    first: 0,
    botLevel: 'easy',
    botSeed: 9,
    choices: you.choices,
    payChoice: true,
    orderChoice: true,
    result: w === 0 ? 'win' : w === 1 ? 'loss' : 'draw',
    simVersion: CURRENT_SIM_VERSION,
    turns: st.turn,
    position: { hash: stateHash(st) },
  };
}

describe('a game a person played, from its record', () => {
  it('plays back to its recorded end, with both hands in the frames', async () => {
    const r = await practiceRecord();
    const t = recordTarget(r, { botLabel: 'Easy' });
    expect(t.kind).toBe('record');
    expect(t.names).toEqual(['You', 'Easy bot']);
    if (t.kind !== 'record') return;
    const out = await playWatchGame(t.source);
    expect(out.turns).toBe(r.turns);
    expect(out.winner === 0 ? 'win' : out.winner === 1 ? 'loss' : 'draw').toBe(r.result);
    const both = out.frames.find((f) => f.state.players[0].hand.length > 0 && f.state.players[1].hand.length > 0);
    expect(both).toBeDefined();
  }, 60_000);

  it('a record of another simulator version is refused with the Game review’s sentence, worded for watching', async () => {
    const r = { ...(await practiceRecord()), simVersion: CURRENT_SIM_VERSION - 1 };
    const t = recordTarget(r, { botLabel: 'Easy' });
    if (t.kind !== 'record') throw new Error('a record target');
    expect(await refusal(playWatchGame(t.source))).toMatch(/^This game can't be watched: it was recorded with version \d+ of the bots and rules engine/);
  }, 60_000);

  it('a record that no longer reaches its result (or one cut short: a game still in progress) is refused', async () => {
    const r = await practiceRecord();
    const flipped: PracticeReplay = { ...r, result: r.result === 'win' ? 'loss' : 'win' };
    const t = recordTarget(flipped, { botLabel: 'Easy' });
    if (t.kind !== 'record') throw new Error('a record target');
    expect(await refusal(playWatchGame(t.source))).toMatch(/^This game can't be watched: replaying its recorded moves .+ gives a different game/);
    // half the answers: the record runs out before the game is over, so it is never shown
    const cut: PracticeReplay = { ...r, choices: r.choices.slice(0, Math.floor(r.choices.length / 2)), position: undefined };
    const c = recordTarget(cut, { botLabel: 'Easy' });
    if (c.kind !== 'record') throw new Error('a record target');
    expect(await refusal(playWatchGame(c.source))).toMatch(/recorded moves ran out before the game ended/);
  }, 60_000);

  it('the Game review’s refusal is reworded, nothing else', () => {
    expect(watchWords("This game can't be reviewed: x.")).toBe("This game can't be watched: x.");
    expect(watchWords('Other words.')).toBe('Other words.');
  });

  it('an online game names the other player, and your seat where the engine had you', () => {
    const r = { id: 'o', date: 'd', decks, seed: 1, botLevel: 'pvp', botSeed: 0, choices: [], result: 'win' as const, pvp: { rival: 'Sam', seat: 1 as const, rivalChoices: [] } };
    expect(recordTarget(r, { botLabel: 'x' }).names).toEqual(['Sam', 'You']);
  });
});

// ---------------------------------------------------------------- the match planner

const rec = (seed: number, first: 0 | 1, winner: 0 | 1 | 'tie', turns = 10): GameRec => ({ seed, first, winner, turns, reason: '' });
const lists: WatchMatch['lists'] = [{ legends: ['x'], main: ['y'] }, { legends: ['x'], main: ['y'] }];
const watchMatch = (o: Partial<WatchMatch>): WatchMatch => ({ kind: 'match', names: ['A', 'B'], lists, bot: 'hard', simVersion: CURRENT_SIM_VERSION, recorded: () => [], complete: () => false, ...o });
const won = (...w: (0 | 1 | 'tie')[]) => w.map((winner) => ({ winner, turns: 10 }));

describe('the next game of a watched match', () => {
  it('plays the recorded games in order with their results to reach, and stops when a side has the wins it needs', () => {
    const games = [rec(100, 0, 0), rec(101, 1, 0)];
    const m = watchMatch({ bestOf: 3, recorded: () => games, complete: () => true });
    const n0 = nextGame(m, []);
    expect(n0).toMatchObject({ kind: 'game', index: 0, source: { kind: 'event', seed: 100, first: 0, bot: 'hard', simVersion: CURRENT_SIM_VERSION, expect: { winner: 0, turns: 10 } } });
    expect(nextGame(m, won(0))).toMatchObject({ kind: 'game', index: 1, source: { seed: 101, first: 1 } });
    expect(nextGame(m, won(0, 0))).toEqual({ kind: 'over' });
    // a tie counts for nobody: the match goes on
    expect(nextGame(watchMatch({ bestOf: 3, recorded: () => [rec(1, 0, 'tie'), rec(2, 1, 0)], complete: () => false, live: () => true }), won('tie'))).toMatchObject({ kind: 'game', index: 1 });
    expect(scoreOf(won(0, 'tie', 1, 1))).toEqual([1, 2]);
  });

  it('without a best-of, a finished match ends with its last recorded game', () => {
    const m = watchMatch({ recorded: () => [rec(5, 0, 1)], complete: () => true });
    expect(nextGame(m, won(1))).toEqual({ kind: 'over' });
  });

  it('a game the running event has dealt is played as it is being played (no result to reach); one not dealt yet is waited for', () => {
    let dealt: { seed: number; first: 0 | 1 } | null = null;
    let live = true;
    const m = watchMatch({ bestOf: 3, dealt: () => dealt, live: () => live });
    expect(nextGame(m, [])).toEqual({ kind: 'wait', index: 0 });
    dealt = { seed: 7, first: 1 };
    const n = nextGame(m, []);
    expect(n).toMatchObject({ kind: 'game', index: 0, source: { seed: 7, first: 1 } });
    expect(n.kind === 'game' && n.source.kind === 'event' && n.source.expect).toBeUndefined();
    dealt = null;
    live = false;
    expect(nextGame(m, won(0))).toEqual({ kind: 'stopped', index: 1 });
  });

  it('one game of a match: that game alone', () => {
    const m = watchMatch({ bestOf: 3, recorded: () => [rec(1, 0, 0), rec(2, 1, 1), rec(3, 0, 0)], complete: () => true, only: 2 });
    expect(nextGame(m, [])).toMatchObject({ kind: 'game', index: 2, source: { seed: 3 } });
    expect(nextGame(m, won(0))).toEqual({ kind: 'over' });
  });

  it('a recorded game is one game', async () => {
    const t = recordTarget(await practiceRecord(), { botLabel: 'Easy' });
    expect(nextOf(t, [])).toMatchObject({ kind: 'game', index: 0, source: { kind: 'record' } });
    expect(nextOf(t, won(0))).toEqual({ kind: 'over' });
  }, 60_000);
});

describe('the runner’s note of dealt games', () => {
  const job = (a: string, b: string, seed: number, first: 0 | 1): GameJob => ({ a: { name: a, legends: [], main: [], sideboard: [] }, b: { name: b, legends: [], main: [], sideboard: [] }, seed, first, bot: 'easy' });

  it('passes every job on unchanged and keeps the play function’s own properties', async () => {
    const seen: GameJob[] = [];
    const inner = Object.assign(((j: GameJob) => (seen.push(j), Promise.resolve(rec(j.seed, j.first, 0)))) as PlayGame, { reused: () => 3 });
    const d = new DealtGames();
    const play = d.wrap(inner);
    const j = job('A', 'B', 10, 1);
    expect(await play(j)).toEqual(rec(10, 1, 0));
    expect(seen).toEqual([j]);
    expect(play.reused()).toBe(3);
  });

  it('finds game 1 of a match with nothing recorded, later games by seed, and refuses to guess between two', async () => {
    const d = new DealtGames();
    const play = d.wrap((j: GameJob) => Promise.resolve(rec(j.seed, j.first, 0)));
    await play(job('A', 'B', 10, 1));
    expect(d.find('A', 'B', [], 0, () => false)).toEqual({ seed: 10, first: 1 });
    expect(d.find('A', 'B', [], 1, () => false)).toBeNull();
    await play(job('A', 'B', 11, 0));
    expect(d.find('A', 'B', [rec(10, 1, 0)], 1, () => false)).toEqual({ seed: 11, first: 0 });
    // the same pairing twice in a round, both waiting for their first game: either could be this one
    await play(job('C', 'D', 50, 0));
    await play(job('C', 'D', 70, 1));
    expect(d.find('C', 'D', [], 0, () => false)).toBeNull();
    // once one of them is recorded, the other is this match's game 1
    expect(d.find('C', 'D', [], 0, (s) => s === 50)).toEqual({ seed: 70, first: 1 });
  });

  it('a whole event run through the note is the same event (the note only notes)', async () => {
    const names = ['A', 'B', 'C', 'D'];
    const field = names.map((n, i) => ({ ...anyDeck(n, i % 2 ? ['Blue', 'Green'] : ['Red', 'Yellow']) }));
    const fake: PlayGame = (j) => Promise.resolve(rec(j.seed, j.first, (j.seed % 3 === 0 ? 'tie' : j.seed % 2) as 0 | 1 | 'tie'));
    const cfg = { name: 'x', rounds: 2, top: 2, bestOf: 3 as const, bot: 'easy' as const, seed: 99 };
    const plain = await runTournament(field, cfg, fake, { id: 'x' });
    const d = new DealtGames();
    const noted = await runTournament(field, cfg, d.wrap(fake), { id: 'x' });
    const strip = (e: typeof plain) => JSON.stringify({ ...e, date: '', manifest: { ...e.manifest, runId: '', createdAt: '' } });
    expect(strip(noted)).toBe(strip(plain));
  });
});

describe('the last move’s cards', () => {
  it('names the cards that moved, turned, were spent or readied, and nothing in the decks', () => {
    const mk = (cards: Record<number, Partial<GameState['cards'][number]>>): GameState =>
      ({ cards: Object.fromEntries(Object.entries(cards).map(([k, c]) => [k, { uid: +k, defId: 'x', owner: 0, controller: 0, zone: 'hand', spent: false, faceUp: true, lag: false, gear: [], host: null, enteredTurn: 0, goSolo: false, ...c }])) }) as unknown as GameState;
    const a = mk({ 1: { zone: 'deck' }, 2: { zone: 'hand' }, 3: { zone: 'field' }, 4: { zone: 'legends', faceUp: false } });
    const b = mk({ 1: { zone: 'hand' }, 2: { zone: 'field' }, 3: { zone: 'field', spent: true }, 4: { zone: 'legends', faceUp: false } });
    expect(movedCards(a, b).sort()).toEqual([1, 2, 3]);
    expect(movedCards(null, b)).toEqual([]);
  });
});
