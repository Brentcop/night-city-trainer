// The Game review replays a recorded game strictly (src/sim/practiceReview.ts, REV-1/REV-2): a record from another
// simulator version is refused up front; an answer that is not one of the options, a record that runs out (with no
// session ending) or is left over, another winner or another length is a typed ReplayDiverged with a plain sentence;
// a game the session ended (a concession, a clock, an abandoned online game) ends exactly where its record does, for
// either seat; and the guest of an online game is reviewed, and shown the board, from its own seat (REV-7).
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Game } from '../src/engine/engine';
import { CARD_BY_ID, CARDS } from '../src/engine/cards';
import { makeTierBot } from '../src/ai/tiers';
import { ReplayDiverged, reviewGame, type ReviewOptions } from '../src/ai/reviewer';
import type { Agent, Decision, DeckList, PlayerId } from '../src/engine/types';
import { checkReplayed, practiceAgents, refuseOtherVersion, type PracticeReviewSpec } from '../src/sim/practiceReview';
import { runGameReview } from '../src/sim/gameReviewRun';
import { practiceSpec, replayVersionProblem, type PracticeReplay } from '../src/lib/practiceReplays';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import { SIM_VERSION } from '../src/lib/tournament';
import { sessionEnding } from '../src/lib/practiceVerdict';
import { reviewFrames } from '../src/lib/reviewFrames';
import { replayOf, type OnlineOutcome } from '../src/net/record';
import type { GameRecordMsg } from '../src/net/protocol';
import { FrameBoard } from '../src/ui/components/ReplayBoard';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];

class Stop extends Error {}
/** Records a seat's answers; after `limit` decisions of the game (both seats) it stops the game, like a session verdict. */
class Recorder implements Agent {
  name = 'rec';
  choices: number[][] = [];
  /** as a person's seat online (both seats choose payment and order: src/sim/practiceReview.ts) */
  readonly choosesPayment = true;
  readonly choosesOrder = true;
  constructor(
    private inner: Agent,
    private shared: { n: number; limit: number; stoppedBy?: PlayerId },
    private seat: PlayerId,
  ) {}
  async decide(g: Game, d: Decision) {
    if (this.shared.n++ >= this.shared.limit) {
      this.shared.stoppedBy = this.seat;
      throw new Stop();
    }
    const r = await this.inner.decide(g, d);
    this.choices.push([...r]);
    return r;
  }
}

/** A game of two Easy bots, both seats recorded, stopped after `limit` decisions (Infinity: played to the end). */
async function recorded(limit = Infinity) {
  const shared: { n: number; limit: number; stoppedBy?: PlayerId } = { n: 0, limit };
  const a = new Recorder(makeTierBot('easy', 5), shared, 0);
  const b = new Recorder(makeTierBot('easy', 9, 'Bot'), shared, 1);
  const g = Game.create(decks, [a, b], { seed: 42, first: 0, log: false });
  let st = g.s;
  try {
    st = await g.run();
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
  }
  return { a, b, st, stoppedBy: shared.stoppedBy, turn: g.s.turn };
}

/** The practice spec of a bot game where seat 0 is you (the bot is Easy with seed 9, as recorded). */
const botSpec = (choices: number[][], o: Partial<PracticeReviewSpec> = {}): PracticeReviewSpec => ({ decks, seed: 42, first: 0, botLevel: 'easy', botSeed: 9, choices, payChoice: true, orderChoice: true, ...o });

const replayWith = async (q: PracticeReviewSpec) => {
  const agents = practiceAgents(q);
  const st = await Game.create(q.decks, agents, { seed: q.seed, first: q.first, log: false }).run();
  checkReplayed(q, agents, { winner: st.winner, turns: st.turn });
  return st;
};

describe('the strict replay (REV-1)', () => {
  it('a record from another simulator version is refused up front, in a plain sentence', async () => {
    expect(CURRENT_SIM_VERSION).toBe(SIM_VERSION);
    expect(replayVersionProblem({})).toBeNull();
    expect(replayVersionProblem({ simVersion: CURRENT_SIM_VERSION })).toBeNull();
    const why = replayVersionProblem({ simVersion: 3 })!;
    expect(why).toBe(`This game can't be reviewed: it was recorded with version 3 of the bots and rules engine, and this is version ${CURRENT_SIM_VERSION}, so replaying it would not give the same game.`);
    expect(() => refuseOtherVersion(botSpec([], { simVersion: 3 }))).toThrow(ReplayDiverged);
    await expect(runGameReview({ id: 'x', spec: botSpec([[0]], { simVersion: 3 }), coach: [], rollouts: 1, made: 'm' })).rejects.toThrow(why);
  });

  it('the recorded game replays and passes every check; a record that no longer fits is a ReplayDiverged', async () => {
    const { a, st } = await recorded();
    const ok = botSpec(a.choices, { expect: st.winner === 'tie' || st.winner === null ? 'tie' : st.winner, turns: st.turn, simVersion: CURRENT_SIM_VERSION });
    expect((await replayWith(ok)).winner).toBe(st.winner);
    // an answer that is not one of the options (the opening hand's yes/no answered with option 7)
    const bad = botSpec([[7], ...a.choices.slice(1)]);
    const e = await runGameReview({ id: 'x', spec: bad, coach: [], rollouts: 1, made: 'm' }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ReplayDiverged);
    expect((e as Error).message).toMatch(/^This game can't be reviewed: replaying its recorded moves with this version of the bots and rules engine gives a different game \(at turn \d+, your recorded answer is not one of the choices offered\)\.$/);
    // the record runs out before the game ends (and nobody conceded)
    await expect(replayWith(botSpec(a.choices.slice(0, 20)))).rejects.toThrow(/recorded moves ran out before the game ended/);
    // answers left over after the game ended
    await expect(replayWith(botSpec([...a.choices, [0], [0]]))).rejects.toThrow(/with 2 recorded moves still to play/);
    // another result, another length
    const other = st.winner === 0 ? 1 : 0;
    await expect(replayWith({ ...ok, expect: other })).rejects.toThrow(/it ends in a win for/);
    await expect(replayWith({ ...ok, turns: st.turn + 1 })).rejects.toThrow(`it lasts ${st.turn} turns, not ${st.turn + 1}`);
  }, 60_000);

  it('a conceded game ends where the record does, whoever was asked next', async () => {
    const { a, turn } = await recorded(60);
    const st = await replayWith(botSpec(a.choices, { conceded: true, expect: 1, turns: turn + 3 })); // turns: not checked for a session ending
    expect(st.winner).toBe(1);
    expect(st.winReason).toBe('You conceded');
  }, 60_000);
});

describe('confirming flagged moves on fresh worlds (REV-4)', () => {
  it('re-measures only the flagged decisions, from a stream of its own: every other decision is measured as before', async () => {
    const { a, st } = await recorded();
    const q = botSpec(a.choices, { expect: st.winner === 0 || st.winner === 1 ? st.winner : 'tie' });
    const run = (confirm?: ReviewOptions['confirm']) =>
      reviewGame({ decks: q.decks, seed: q.seed, first: q.first, agents: practiceAgents(q) }, { rollouts: 1, seats: [0, 1], ...(confirm ? { confirm } : {}) });
    const plain = await run();
    // flag every decision whose move made is not the best found
    const conf = await run({ worlds: 2, flag: (d) => !d.top });
    expect(conf.decisions.map((d) => [d.player, d.at])).toEqual(plain.decisions.map((d) => [d.player, d.at]));
    const confirmed = conf.decisions.filter((d) => d.confirmed === 2);
    expect(confirmed.length).toBeGreaterThan(0);
    for (const [k, d] of conf.decisions.entries()) {
      const p = plain.decisions[k]!;
      if (d.confirmed) {
        expect(d.top).toBe(false);
        expect(d.se).toBeDefined();
        expect(d.regret).toBeLessThanOrEqual(120);
      } else expect(d).toEqual(p);
    }
  }, 60_000);
});

describe('an online game ended by the clock (REV-2)', () => {
  it('the timed-out seat is never played on by a stand-in: the game ends there, for host or guest', async () => {
    const { a, b, stoppedBy, turn } = await recorded(50);
    expect(stoppedBy).toBeDefined();
    const timedOut = stoppedBy!;
    for (const seat of [0, 1] as const) {
      const pvp = { rival: 'Riv', seat, rivalChoices: (seat === 0 ? b : a).choices, timedOut };
      const q: PracticeReviewSpec = { decks, seed: 42, first: 0, botLevel: 'pvp', botSeed: 0, choices: (seat === 0 ? a : b).choices, pvp, expect: (1 - timedOut) as PlayerId };
      const st = await replayWith(q);
      expect(st.winner).toBe(1 - timedOut);
      expect(st.winReason).toBe(timedOut === seat ? 'You ran out of time' : 'Riv ran out of time');
      expect(st.turn).toBe(turn);
    }
    // the Game review rates nothing after the clock ran out, and grades the guest's seat as "you"
    const rec = await runGameReview({
      id: 'g',
      spec: { decks, seed: 42, first: 0, botLevel: 'pvp', botSeed: 0, choices: b.choices, pvp: { rival: 'Host', seat: 1, rivalChoices: a.choices, timedOut }, expect: (1 - timedOut) as PlayerId },
      coach: [],
      rollouts: 1,
      made: 'm',
    });
    expect(rec.me).toBe(1);
    expect(rec.turns).toBe(turn);
    expect(rec.answers![1].choices).toEqual(b.choices);
    for (const m of rec.moves) expect(m.turn).toBeLessThanOrEqual(turn);
  }, 120_000);

  it('the PvP replay carries who ran out of time; older records infer it from the result', () => {
    const o: OnlineOutcome = { id: 'c', date: 'd', result: 'win', reason: 'r', myDeck: 'A', rivalDeck: 'B', rival: 'Riv', first: true, turns: 9, gigs: [3, 2], conceded: false, rivalConceded: false, abandoned: false, rivalTimedOut: true, multiDay: { days: 7, timedOut: true } };
    const rec = { game: 'g', seed: 1, first: 0, decks: [decks[0], decks[1]], answers: [[[0]], [[0]]] } as unknown as GameRecordMsg;
    const r = replayOf(o, rec, 1);
    expect(r.pvp?.timedOut).toBe(0);
    expect(r.simVersion).toBe(CURRENT_SIM_VERSION);
    expect(r.turns).toBe(9);
    expect(replayOf({ ...o, rivalTimedOut: false, timedOut: true, result: 'loss' }, rec, 0).pvp?.timedOut).toBe(0);
    // recorded before `timedOut`: a multi-day game won on time by the guest means the host's clock ran out
    const { timedOut: _t, ...older } = r.pvp!;
    const old: PracticeReplay = { ...r, pvp: older };
    delete old.simVersion;
    delete old.turns;
    expect(practiceSpec(old).pvp?.timedOut).toBe(0);
    expect(sessionEnding(practiceSpec(old))).toEqual({ winner: 1, reason: 'Riv ran out of time' });
    // a conceded multi-day bot game closed on time reads as running out of time
    const bot: PracticeReplay = { id: 'b', date: 'd', decks, seed: 1, botLevel: 'easy', botSeed: 2, choices: [], result: 'loss', conceded: true, multiDay: { days: 3, timedOut: true } };
    expect(sessionEnding(practiceSpec(bot))).toEqual({ winner: 1, reason: 'You ran out of time' });
  });
});

describe('the guest’s seat on the review board (REV-7)', () => {
  it('frames end the way the session did, and the board shows the guest’s own hand', async () => {
    const { a, b, stoppedBy } = await recorded(40);
    const end = { winner: (1 - stoppedBy!) as PlayerId, reason: 'x ran out of time' };
    const f = await reviewFrames({ decks, seed: 42, first: 0, end }, [
      { choices: a.choices, pay: true, order: true },
      { choices: b.choices, pay: true, order: true },
    ]);
    expect(f.data.final.winner).toBe(end.winner);
    expect(f.data.final.winReason).toBe(end.reason);
    const state = f.data.frames[f.data.frames.length - 1]!.state;
    const nameOf = (uid: number) => CARD_BY_ID[state.cards[uid]!.defId]!.name;
    const guestHand = state.players[1].hand.map(nameOf);
    const hostOnly = state.players[0].hand.map(nameOf).filter((n) => !guestHand.includes(n));
    const html = renderToStaticMarkup(<FrameBoard state={state} names={['rival', 'you']} narrow={false} at={0} viewer={1} />);
    const hand = html.slice(html.indexOf('Your hand'));
    expect(html).toContain('Your hand');
    for (const n of guestHand) expect(hand).toContain(n);
    for (const n of hostOnly) expect(hand).not.toContain(n);
  }, 60_000);
});
