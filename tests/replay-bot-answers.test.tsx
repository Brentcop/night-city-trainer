// A practice replay keeps the bot seat's answers (REVIEW_2026-11-25 R7), so a finished game no longer depends on the bot
// that played it: under a bumped simulator version (CURRENT_SIM_VERSION mocked one above SIM_VERSION, which still writes
// the records, as a deploy of the next version would read this version's games) a record with the bot's answers and its
// position is reviewed and watched with the current bots and says so once; one that no longer reaches its position (an
// engine or card change) is refused; one without the bot's answers is refused as before, showing the coach's grades from
// play instead; online records likewise. Review records name the simulator version that measured them, and one measured
// with other bots is stale. Crafted imports are refused before anything replays.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/playedRecord', async (importOriginal) => {
  const o = await importOriginal<typeof import('../src/lib/playedRecord')>();
  return { ...o, CURRENT_SIM_VERSION: o.CURRENT_SIM_VERSION + 1 };
});

import { renderToStaticMarkup } from 'react-dom/server';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import { makeTierBot } from '../src/ai/tiers';
import { ReplayDiverged } from '../src/ai/reviewer';
import type { Agent, Decision, DeckList } from '../src/engine/types';
import { checkReplayed, practiceAgents, refuseOtherVersion, replayedEnd } from '../src/sim/practiceReview';
import { runGameReview } from '../src/sim/gameReviewRun';
import { PracticeSession, type MatchSetup, type Running } from '../src/lib/practiceSession';
import { asReplay, loadReplays, parseReplays, practiceSpec, replayVersionProblem, type PracticeReplay } from '../src/lib/practiceReplays';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import { SIM_VERSION } from '../src/lib/tournament';
import { stateHash } from '../src/lib/stateHash';
import { buildSave, parseSavedGame, type SavedGame } from '../src/lib/savedGames';
import { timedOutRecords, BOT_MD_KIND, type BotMultiDay } from '../src/lib/multiDay';
import { otherVersionText, replayedFromOtherVersion, MAX_RECORDED_ANSWERS } from '../src/lib/practiceVerdict';
import { asReviewRecord, loadGameReview, saveGameReview } from '../src/lib/gameReviewStore';
import { GAME_REVIEW_CONFIRM, GAME_REVIEW_HARD, GAME_REVIEW_ROLLOUTS, measuredAsNow, REVIEW_MEASURE, REVIEW_RULES, REVIEW_SIM_BEFORE_KEPT, type CoachRating, type GameReviewRecord } from '../src/lib/gameReview';
import { parseCoachedReplay, buildCoachedReplay, COACHED_REPLAY_KIND } from '../src/lib/coachedReplay';
import { playWatchGame, WatchRefused } from '../src/lib/watchGame';
import { recordTarget } from '../src/lib/watchRecord';
import { GameReviewView } from '../src/ui/components/GameReview';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];
const setup = (seed: number, level = 'easy'): MatchSetup => ({ decks, seed, first: 0, level, botSeed: 4242 });

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

/** Plays your seat with an Easy "brain"; `hook` sees each new decision of yours first and may handle it instead. */
function drive(session: PracticeSession, hook?: (run: Running, d: Decision) => boolean) {
  const brain = makeTierBot('easy', 9);
  let last: Decision | null = null;
  return session.subscribe(() => {
    const run = session.current;
    const d = run?.human.pending?.d;
    if (!run || !d || d === last) return;
    last = d;
    setTimeout(async () => {
      if (run !== session.current || run.human.pending?.d !== d) return;
      if (hook?.(run, d)) return;
      const r = await brain.decide(run.g, d);
      run.human.answer(d, r[0]);
    }, 0);
  });
}

async function finish(session: PracticeSession): Promise<Running> {
  for (;;) {
    const r = session.current!;
    await r.done;
    if (session.current === r) return r;
  }
}

/** A practice game played to its end on the board through the session, and its stored record. */
async function played(seed: number, level = 'easy', hook?: (s: PracticeSession) => (run: Running, d: Decision) => boolean): Promise<{ r: PracticeReplay; run: Running }> {
  const session = new PracticeSession();
  drive(session, hook?.(session));
  session.start(setup(seed, level));
  const run = await finish(session);
  const reps = loadReplays();
  expect(reps).toHaveLength(1);
  return { r: reps[0]!, run };
}

/** The Game review's strict replay of a record (as the review worker and Watch run it). */
async function strict(r: PracticeReplay) {
  const q = practiceSpec(r);
  refuseOtherVersion(q);
  const agents = practiceAgents(q);
  const st = await Game.create(q.decks, agents, { seed: q.seed, first: q.first, log: false }).run();
  checkReplayed(q, agents, replayedEnd(st));
  return st;
}

const NO_BOT_WORDS = `This game can't be reviewed: it was recorded with version ${SIM_VERSION} of the bots and rules engine, and this is version ${SIM_VERSION + 1}. Its record does not hold the bot's moves (games played before they were kept with the game), so replaying it would not give the same game.`;

describe('a bumped simulator version (CURRENT_SIM_VERSION mocked one above the version that records)', () => {
  it('the mock is in place: records are written with SIM_VERSION, read by the next version', () => {
    expect(CURRENT_SIM_VERSION).toBe(SIM_VERSION + 1);
  });
});

describe("the bot's answers in the practice replay", () => {
  let game: { r: PracticeReplay; run: Running };
  beforeEach(async () => {
    if (!game) game = await played(7);
  }, 120_000);

  it('are recorded, small, and replay the game with no bot to the recorded position', async () => {
    const { r, run } = game;
    expect(r.simVersion).toBe(SIM_VERSION);
    expect(r.position?.hash).toBe(stateHash(run.g.s));
    expect(r.botChoices!.length).toBeGreaterThan(10);
    // a few kB at most (each answer is one or two small indices)
    const bytes = JSON.stringify(r.botChoices).length;
    expect(bytes).toBeLessThan(8_000);
    console.info(`bot answers: ${r.botChoices!.length} answers, ${bytes} bytes of JSON; yours: ${r.choices.length}, ${JSON.stringify(r.choices).length} bytes`);
    // a scripted seat, not the bot: the replay depends on the rules engine and the card scripts only
    const [, bot] = practiceAgents(practiceSpec(r));
    expect(bot.constructor.name).toBe('ScriptedAgent');
    const st = await strict(r);
    expect(stateHash(st)).toBe(r.position!.hash);
  }, 60_000);

  it('a record from the previous version with them is reviewed with the current bots, and says so once', async () => {
    const { r } = game;
    expect(replayVersionProblem(r)).toBeNull();
    expect(replayedFromOtherVersion(r)).toBe(SIM_VERSION);
    expect(otherVersionText(SIM_VERSION, { pvp: false })).toBe(
      `This game was played against an older bot (version ${SIM_VERSION} of the bots and rules engine; this is version ${SIM_VERSION + 1}). The bot's moves were kept with the game, so it replays to the same position, and every move is rated with the current bots.`,
    );
    const rec = await runGameReview({ id: r.id, spec: practiceSpec(r), coach: [], rollouts: 1, confirm: 0, made: 'm' });
    expect(rec.simVersion).toBe(SIM_VERSION + 1);
    expect(rec.gameSimVersion).toBe(SIM_VERSION);
    expect(rec.turns).toBe(r.turns);
    expect(rec.moves.some((m) => m.p === 1)).toBe(true);
    // measured as reviews are now (a test review plays 1 world and confirms on none: stored as the real ones are)
    const asNow = { ...rec, rollouts: GAME_REVIEW_ROLLOUTS, confirm: GAME_REVIEW_CONFIRM };
    expect(measuredAsNow(asNow)).toBe(true);
    // kept, read back and shown with the note
    saveGameReview(asNow);
    const back = loadGameReview(r.id, r.choices);
    expect(back?.review).toBeDefined();
    const html = renderToStaticMarkup(<GameReviewView src={{ replay: r, coach: [], persist: true }} />);
    expect(html.split('played against an older bot').length - 1).toBe(1);
    expect(html).not.toContain('can&#x27;t be reviewed');
  }, 120_000);

  it('Watch follows the same rule: the record plays out, and without the bot’s answers it is refused', async () => {
    const { r } = game;
    const sourceOf = (x: PracticeReplay) => {
      const t = recordTarget(x, { botLabel: 'Easy' });
      if (t.kind !== 'record') throw new Error('not a record target');
      return t.source;
    };
    const w = await playWatchGame(sourceOf(r));
    expect(w.turns).toBe(r.turns);
    expect(w.frames.length).toBeGreaterThan(10);
    const { botChoices: _b, ...older } = r;
    const e = await playWatchGame(sourceOf(older)).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(WatchRefused);
    expect((e as Error).message).toMatch(/^This game can't be watched: it was recorded with version/);
  }, 60_000);

  it('an engine-affecting difference is still refused: another position, or a card that plays differently', async () => {
    const { r } = game;
    const flip = (h: string) => (h[0] === '0' ? '1' : '0') + h.slice(1);
    await expect(strict({ ...r, position: { hash: flip(r.position!.hash) } })).rejects.toThrow(/\(it ends in a different position from the game that was played\)\.$/);
    // a card that behaves differently now (stood in for by another card in the bot's deck): the record no longer fits
    const main = [...r.decks[1].main];
    const other = CARDS.find((c) => c.type !== 'Legend' && !main.includes(c.id) && c.color === 'Blue')!;
    for (let i = 0; i < 6; i++) main[i] = other.id;
    const changed: PracticeReplay = { ...r, decks: [r.decks[0], { ...r.decks[1], main }] };
    await expect(strict(changed)).rejects.toBeInstanceOf(ReplayDiverged);
    await expect(runGameReview({ id: 'x', spec: practiceSpec(changed), coach: [], rollouts: 1, confirm: 0, made: 'm' })).rejects.toBeInstanceOf(ReplayDiverged);
    // a bot answer changed to another legal option parts from the game too
    const k = r.botChoices!.findIndex((c) => c.length === 1 && c[0] === 0);
    const bc = r.botChoices!.map((c) => [...c]);
    bc[k] = [1];
    await expect(strict({ ...r, botChoices: bc })).rejects.toBeInstanceOf(ReplayDiverged);
    // a record without a position can't be checked on another version: refused up front
    const { position: _p, ...noPos } = r;
    expect(replayVersionProblem(noPos)).toMatch(/does not hold the position the game reached/);
  }, 120_000);

  it('a record without them is refused as today, and the review shows the coach’s grades from play instead', async () => {
    const { r } = game;
    const { botChoices: _b, ...older } = r;
    expect(replayVersionProblem(older)).toBe(NO_BOT_WORDS);
    await expect(runGameReview({ id: 'x', spec: practiceSpec(older), coach: [], rollouts: 1, made: 'm' })).rejects.toThrow(NO_BOT_WORDS);
    const coach: CoachRating[] = [
      { at: 0, turn: 1, chose: 1, coach: 1, chosen: 'Keep hand', best: 'Keep hand', why: '', verdict: 'agree', gap: 0, alts: [[0, 0.2, 0.1]] },
      { at: 3, turn: 2, chose: 2, coach: 0, chosen: 'Pass turn', best: 'Play Big Unit', why: 'w', verdict: 'mistake', gap: 3.2, se: 0.1, alts: [] },
    ];
    const html = renderToStaticMarkup(<GameReviewView src={{ replay: older, coach, persist: false }} />);
    expect(html).toContain('This game can&#x27;t be reviewed');
    expect(html).toContain('The coach&#x27;s grades from play');
    expect(html).toContain('Blunder');
    expect(html).toContain('End turn');
    expect(html).toContain('coach&#x27;s pick: ');
    // a grade is never sized in Gigs (REVIEW_2026-11-25 row 6: ratings are said in win chance, src/lib/ratingCost.ts)
    expect(html).not.toContain('Gigs');
    // none kept: said so, not an empty list
    expect(renderToStaticMarkup(<GameReviewView src={{ replay: older, coach: [], persist: false }} />)).toContain('No move of yours was graded by the coach');
  });
});

describe('the session records the bot’s answers in step with yours', () => {
  it('after an Undo the bot’s answers are cut back with yours, and the record still replays exactly', async () => {
    let n = 0;
    const { r, run } = await played(11, 'easy', (session) => (_run, d) => d.kind === 'action' && ++n === 6 && session.undo());
    expect(r.undos).toBe(1);
    expect(stateHash(await strict(r))).toBe(stateHash(run.g.s));
  }, 120_000);

  it('a concession on the bot’s turn: the answer it was giving is not recorded, and the replay ends where the game did', async () => {
    const session = new PracticeSession({
      pace: (() => {
        let acts = 0;
        return () => {
          if (++acts === 12) setTimeout(() => session.concede(), 0);
          return 0;
        };
      })(),
    });
    drive(session);
    session.start(setup(13));
    const run = await finish(session);
    const r = loadReplays()[0]!;
    expect(r.conceded).toBe(true);
    expect(r.position?.at).toBeDefined();
    const st = await strict(r);
    expect(st.winner).toBe(1);
    expect(st.winReason).toBe('You conceded');
    expect(st.turn).toBe(run.g.s.turn);
  }, 120_000);

  it('a multi-day game closed on time keeps the bot’s answers from its save, and is reviewed on the next version', async () => {
    let save: SavedGame | null = null;
    let asked = 0;
    const session = new PracticeSession({
      onStable: (run) => {
        if (++asked !== 25 || save) return;
        save = buildSave({ replay: run.replay, grades: run.grades, stable: run.stable, log: run.g.s.log }, { id: 'auto', saved: 'now', coach: false });
        setTimeout(() => session.quit({ keepSave: true }), 0);
      },
    });
    drive(session);
    session.start(setup(17));
    await session.current!.done;
    expect(save).not.toBeNull();
    const s = save! as SavedGame;
    expect(s.botChoices!.length).toBeGreaterThan(0);
    // read back from storage or a file: the bot's answers come through, strictly
    const parsed = parseSavedGame(JSON.parse(JSON.stringify(s)));
    expect(parsed.ok && parsed.value.botChoices).toEqual(s.botChoices);
    const e: BotMultiDay = { kind: BOT_MD_KIND, schema: 1, id: s.replayId, days: 3, created: 'c', deadline: 'd', lastPlayed: 'l', save: s };
    const { replay } = timedOutRecords(e, Date.now());
    expect(replay.botChoices).toEqual(s.botChoices);
    expect(replayVersionProblem(replay)).toBeNull();
    const st = await strict(replay);
    expect(st.winReason).toBe('You ran out of time');
  }, 120_000);
});

class Stop extends Error {}
/** Records a seat's answers as a person's seat online does (payments and order chosen); stops after `limit` decisions. */
class Recorder implements Agent {
  name = 'rec';
  choices: number[][] = [];
  readonly choosesPayment = true;
  readonly choosesOrder = true;
  constructor(
    private inner: Agent,
    private shared: { n: number; limit: number },
  ) {}
  async decide(g: Game, d: Decision) {
    if (this.shared.n++ >= this.shared.limit) throw new Stop();
    const r = await this.inner.decide(g, d);
    this.choices.push([...r]);
    return r;
  }
}

describe('online records (both seats scripted already)', () => {
  it('one from the previous version with its final position is reviewed; one that ended off the board is refused', async () => {
    const shared = { n: 0, limit: Infinity };
    const a = new Recorder(makeTierBot('easy', 5), shared);
    const b = new Recorder(makeTierBot('easy', 9), shared);
    const st = await Game.create(decks, [a, b], { seed: 42, first: 0, log: false }).run();
    const winner = st.winner === 0 || st.winner === 1 ? st.winner : null;
    for (const seat of [0, 1] as const) {
      const r: PracticeReplay = {
        id: `o${seat}`,
        date: 'd',
        decks,
        seed: 42,
        first: 0,
        botLevel: 'pvp',
        botSeed: 0,
        choices: (seat === 0 ? a : b).choices,
        payChoice: true,
        orderChoice: true,
        result: winner === null ? 'draw' : winner === seat ? 'win' : 'loss',
        simVersion: SIM_VERSION,
        turns: st.turn,
        pvp: { rival: 'Riv', seat, rivalChoices: (seat === 0 ? b : a).choices },
        position: { hash: stateHash(st) },
      };
      expect(replayVersionProblem(r)).toBeNull();
      expect(otherVersionText(SIM_VERSION, { pvp: true })).toMatch(/^This game was recorded with an older version of the rules engine/);
      const rec = await runGameReview({ id: r.id, spec: practiceSpec(r), coach: [], rollouts: 1, confirm: 0, made: 'm' });
      expect(rec.me).toBe(seat);
      expect(rec.gameSimVersion).toBe(SIM_VERSION);
      // ended off the board (no position recorded): can't be checked on another version
      const { position: _p, ...off } = r;
      expect(replayVersionProblem({ ...off, pvp: { ...r.pvp!, rivalConceded: true } })).toMatch(/does not hold the position the game reached \(it ended off the board\)/);
    }
  }, 120_000);
});

describe('review records name the simulator version that measured them', () => {
  const base = (): GameReviewRecord => ({
    kind: 'nct-game-review',
    schema: 1,
    rules: REVIEW_RULES,
    measure: REVIEW_MEASURE,
    confirm: GAME_REVIEW_CONFIRM,
    hard: GAME_REVIEW_HARD,
    simVersion: CURRENT_SIM_VERSION,
    id: 'g1',
    made: 'm',
    rollouts: 8,
    oracleSeed: 1,
    names: ['you', 'easy'],
    winner: 0,
    reason: 'r',
    turns: 5,
    first: 0,
    me: 0,
    timeline: [],
    moves: [],
    forced: [0, 0],
    answers: [
      { choices: [[0]], pay: true, order: true },
      { choices: [], pay: false, order: false },
    ],
    ms: 1,
  });

  it('read with or without it; anything but a whole positive number is refused', () => {
    expect(asReviewRecord(base())).not.toBeNull();
    const { simVersion: _s, ...older } = base();
    expect(asReviewRecord(older)).not.toBeNull();
    for (const bad of ['9', 1.5, -1, 0, null]) expect(asReviewRecord({ ...base(), simVersion: bad })).toBeNull();
    expect(asReviewRecord({ ...base(), gameSimVersion: 'x' })).toBeNull();
  });

  it('a review measured with other bots, or stored before the field (version 9), is stale on this version', () => {
    expect(measuredAsNow(base())).toBe(true);
    expect(measuredAsNow({ ...base(), simVersion: SIM_VERSION })).toBe(false);
    const { simVersion: _s, ...older } = base();
    expect(measuredAsNow(older)).toBe(false);
    // and on the version it was measured on (9: stored before the field was kept), an older record counts as measured now
    expect(measuredAsNow(older, REVIEW_SIM_BEFORE_KEPT)).toBe(true);
    saveGameReview({ ...base(), simVersion: SIM_VERSION });
    const got = loadGameReview('g1', [[0]]);
    expect(got?.review).toBeUndefined();
    expect(got?.stale?.simVersion).toBe(SIM_VERSION);
  });
});

describe('a crafted import is refused before anything replays', () => {
  const good = (): PracticeReplay => ({ id: 'x', date: 'd', decks, seed: 1, first: 0, botLevel: 'easy', botSeed: 2, choices: [[0]], botChoices: [[0], [1, 2]], result: 'win', simVersion: SIM_VERSION, position: { hash: '0123456789abcdef' } });

  it('the bot’s answers must be lists of whole, small option indices, capped, and never beside an online game', () => {
    expect(asReplay(good())).not.toBeNull();
    const bad: unknown[] = [
      'not a list',
      [0, 1],
      [[0.5]],
      [[-1]],
      [[1e9]],
      [['0']],
      [[{ valueOf: 1 }]],
      [null],
      [Array.from({ length: 65 }, (_, i) => i)],
      Array.from({ length: MAX_RECORDED_ANSWERS + 1 }, () => [0]),
    ];
    for (const b of bad) expect(asReplay({ ...good(), botChoices: b })).toBeNull();
    expect(asReplay({ ...good(), pvp: { rival: 'R', seat: 0, rivalChoices: [] } })).toBeNull();
    // in storage, a bad entry is dropped and the rest are kept
    expect(parseReplays(JSON.stringify([{ ...good(), botChoices: [[-3]] }, good()]))).toHaveLength(1);
    // in an exported game file
    const file = buildCoachedReplay(good(), [], 'e', 40);
    expect(parseCoachedReplay(JSON.stringify(file)).ok).toBe(true);
    const crafted = { ...file, replay: { ...file.replay, botChoices: [[0], 'x'] } };
    expect(parseCoachedReplay(JSON.stringify(crafted))).toEqual({ ok: false, why: 'the replay record is incomplete' });
    expect(file.kind).toBe(COACHED_REPLAY_KIND);
  });

  it('in a save file too', () => {
    const save = {
      kind: 'nct-saved-game',
      schema: 1,
      id: 's',
      name: 'n',
      saved: 'd',
      simVersion: SIM_VERSION,
      replayId: 'p',
      started: 'd',
      decks,
      seed: 1,
      botLevel: 'easy',
      botSeed: 2,
      choices: [[0]],
      botChoices: [[0]],
      coach: false,
      grades: [],
      check: { at: 0, turn: 1, hash: 'h', decision: { kind: 'action', prompt: 'p', options: ['a'] } },
      turn: 1,
      gigs: [0, 0],
      log: [],
    };
    expect(parseSavedGame(save).ok).toBe(true);
    expect(parseSavedGame({ ...save, botChoices: [[0], [7.5]] })).toEqual({ ok: false, why: "This saved game is damaged: the bot's moves are incomplete." });
  });

  it('well-formed answers that do not fit the game part from it: refused, never reviewed as another game', async () => {
    const spec = practiceSpec({ ...good(), choices: [], botChoices: Array.from({ length: 5 }, () => [999]) });
    const e = await runGameReview({ id: 'x', spec, coach: [], rollouts: 1, made: 'm' }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ReplayDiverged);
    expect((e as Error).message).toMatch(/(the bot's recorded answer is not one of the choices offered|your recorded moves ran out)/);
  });
});
