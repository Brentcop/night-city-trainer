// A practice game against a bot, without React: the paced bot, the recording human seat, Undo snapshots,
// cancellation, error capture, and recording the result once. The Play page drives it through usePracticeGame().
import { Game } from '../engine/engine';
import type { Agent, Decision, DecisionKind, DeckList, GameState, PlayerId } from '../engine/types';
import type { HeuristicAgent } from '../ai/heuristic';
import type { CoachedGrade } from './coachedReplay';
import { makeTierBot } from '../ai/tiers';
import { HumanAgent } from '../ui/HumanAgent';
import { saveReplay, type PracticeReplay } from './practiceReplays';
import { recordPractice, type PracticeGame } from './practiceLog';
import { CONCEDED_REASON } from './practiceVerdict';
import { MISMATCH_WHY, replayOf, restoredGrades, stateHash, versionProblem, type SaveCheck, type SavedGame } from './savedGames';
import { SIM_VERSION } from './tournament';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Thrown inside a game's agents once the game was quit, undone or replaced, so its loop unwinds quietly. */
class GameCancelled extends Error {
  constructor() {
    super('game cancelled');
  }
}

export interface Cancellable {
  cancelled: boolean;
}

/** Wraps a bot so its moves are visible to the human. Stops the game once it is cancelled. */
class PacedAgent implements Agent {
  name: string;
  constructor(
    public inner: Agent,
    public ms: () => number,
    private run: Cancellable = { cancelled: false },
  ) {
    this.name = inner.name;
  }
  async decide(g: Game, d: Decision) {
    if (this.run.cancelled) throw new GameCancelled();
    const r = await this.inner.decide(g, d);
    if (d.kind === 'action' || d.kind === 'reaction') await delay(this.ms());
    if (this.run.cancelled) throw new GameCancelled();
    return r;
  }
}

/** Records every answer the human gives (for reviews) and lets the caller snapshot the game before each main-phase choice (for Undo). */
export class RecordingAgent implements Agent {
  name: string;
  choosesPayment?: boolean;
  choosesOrder?: boolean;
  confirmsEndTurn?: boolean;
  constructor(
    public inner: Agent,
    public choices: number[][],
    private onAction?: (g: Game) => void,
    private run: Cancellable = { cancelled: false },
  ) {
    this.name = inner.name;
    this.choosesPayment = inner.choosesPayment;
    this.choosesOrder = inner.choosesOrder;
    this.confirmsEndTurn = inner.confirmsEndTurn;
  }
  async decide(g: Game, d: Decision) {
    if (this.run.cancelled) throw new GameCancelled();
    if (d.kind === 'action') this.onAction?.(g);
    const r = await this.inner.decide(g, d);
    if (this.run.cancelled) throw new GameCancelled();
    this.choices.push([...r]);
    return r;
  }
}

/** Thrown while restoring a saved game when the replay does not reach the saved position: other code, never resumed. */
class ReplayMismatch extends Error {
  constructor(why: string) {
    super(why);
    this.name = 'ReplayMismatch';
  }
}

/** The answers a restore replays, the check it must pass, and the saved coach grades it hands back in step. */
interface Feed {
  choices: number[][];
  check: SaveCheck;
  grades: CoachedGrade[];
  /** called once the replay has given every saved answer and your next decision is waiting */
  onReached: () => void;
}

/**
 * Your seat while a saved game is restored: answers from the save until they run out, then hands over to you. Checks
 * the position at the save's check point (state hash, prompt and options) and each answer's range; any difference
 * stops the restore (ReplayMismatch). Hands back each saved coach grade as the answer it graded is replayed.
 */
class FeedAgent implements Agent {
  name: string;
  readonly choosesPayment = true;
  readonly choosesOrder = true;
  readonly confirmsEndTurn: boolean;
  private i = 0;
  private reached = false;
  constructor(
    private inner: HumanAgent,
    private feed: Feed,
    private grades: CoachedGrade[],
  ) {
    this.name = inner.name;
    this.confirmsEndTurn = inner.confirmsEndTurn;
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    const f = this.feed;
    if (this.reached) return this.inner.decide(g, d);
    if (this.i === f.check.at) {
      const c = f.check;
      const same =
        stateHash(g.s) === c.hash &&
        d.kind === c.decision.kind &&
        d.prompt === c.decision.prompt &&
        d.options.length === c.decision.options.length &&
        d.options.every((o, k) => o.label === c.decision.options[k]);
      if (!same) throw new ReplayMismatch(MISMATCH_WHY);
    }
    const r = f.choices[this.i];
    if (r) {
      if (!r.every((x) => Number.isInteger(x) && x >= 0 && x < d.options.length)) throw new ReplayMismatch(MISMATCH_WHY);
      for (const gr of f.grades) if (gr.record?.at === this.i) this.grades.push(gr);
      this.i++;
      return [...r];
    }
    const answer = this.inner.decide(g, d);
    if (!this.reached) {
      this.reached = true;
      f.onReached();
    }
    return answer;
  }
}

/** A copy of a bot including its private random state, so a restored game plays on exactly as before. */
export function cloneBot<T extends HeuristicAgent>(b: T): T {
  return Object.assign(Object.create(Object.getPrototypeOf(b)), structuredClone({ ...b })) as T;
}

/** The game just before one of your main-phase decisions. */
export interface Snapshot {
  state: GameState;
  bot: HeuristicAgent;
  /** how many of your answers had been recorded */
  choices: number;
  /** how many coach grades had been given */
  grades: number;
}

/**
 * Snapshot a game for Undo. This is the only place the session clones a game: the snapshot must keep the game log
 * (the restored game shows it and replays continue from it).
 */
function takeSnapshot(g: Game, bot: HeuristicAgent, choices: number, grades: number): Snapshot {
  const seat: Agent = { name: 'snapshot', decide: async () => [0] };
  return { state: g.clone([seat, seat], { keepLog: true }).s, bot: cloneBot(bot), choices, grades };
}

/**
 * Which snapshot Undo goes back to: the decision before the one you are in now (if you are in a main-phase
 * decision, its own snapshot is the newest), otherwise the newest (a sub-decision, game over or an error). -1 = none.
 */
function undoTarget(snaps: readonly Snapshot[], pending: DecisionKind | undefined): number {
  return pending === 'action' ? snaps.length - 2 : snaps.length - 1;
}

/** One practice match; Undo replaces the game but keeps the match id, replay, snapshots and grades. */
export interface Running {
  /** stable for the whole match (Undo keeps it), so the board doesn't remount */
  match: number;
  g: Game;
  human: HumanAgent;
  bot: HeuristicAgent;
  replay: PracticeReplay;
  /** one snapshot before each of your main-phase decisions (for Undo) */
  snaps: Snapshot[];
  /** coach grades of your moves with the advice behind each (for the export, INFO-9), truncated by Undo like the recorded choices */
  grades: CoachedGrade[];
  /** set when the game loop threw; the game is stopped but Undo and Quit still work */
  error: string | null;
  /**
   * set on quit, undo, a new game, unmount or concede: this game's agents stop and the game loop never records a
   * result (a concede records its own, once)
   */
  cancelled: boolean;
  /** you conceded this game: it is over as a recorded loss, and Undo still works */
  conceded: boolean;
  /** settles when this game's loop ends (finished, errored or cancelled) */
  done: Promise<void>;
  /** the last decision you were asked (for saves): set when it is asked */
  stable: (SaveCheck & { gigs: [number, number] }) | null;
  /** being restored from a save: the replay runs unpaced, nothing is recorded, and the board isn't shown yet */
  restoring: boolean;
}

/** Undo is offered while you are deciding something, after the game ends, or after an error, if there is a snapshot to go to. */
export function canUndo(run: Running): boolean {
  if (!run.error && !run.human.pending && run.g.s.winner === null) return false;
  return undoTarget(run.snaps, run.human.pending?.d.kind) >= 0;
}

/** Concede is offered while the game is on (your turn or the bot's, with or without a prompt), not after it ended or failed. */
export function canConcede(run: Running): boolean {
  return !run.cancelled && !run.error && run.g.s.winner === null;
}

export { CONCEDED_REASON };

export interface MatchSetup {
  decks: [DeckList, DeckList];
  seed: number;
  first?: PlayerId;
  level: string;
  botSeed: number;
  /** you end each turn with End turn, even when nothing else is left (the board setting at the start; absent: automatic) */
  endTurnClick?: boolean;
}

/**
 * A rematch of the game just played: its own decks, bot tier and seat rule (a fixed seat stays fixed; a random one is
 * drawn again), new seeds, and the End turn mode of the board settings now (as any new game). Built from the game's
 * record, so a resumed game's rematch is that game's matchup, not whatever the setup screen shows.
 */
export function rematchOf(replay: Pick<PracticeReplay, 'decks' | 'botLevel' | 'first'>, o: { endTurnClick: boolean; seed: number; botSeed: number }): MatchSetup {
  return {
    decks: [replay.decks[0], replay.decks[1]],
    seed: o.seed,
    ...(replay.first !== undefined ? { first: replay.first } : {}),
    level: replay.botLevel,
    botSeed: o.botSeed,
    ...(o.endTurnClick ? { endTurnClick: true } : {}),
  };
}

let replaySeq = 0;
function newPracticeReplay(m: MatchSetup): PracticeReplay {
  return {
    id: `p${Date.now().toString(36)}${(replaySeq++ % 1296).toString(36)}`,
    date: new Date().toISOString(),
    decks: m.decks,
    seed: m.seed,
    first: m.first,
    botLevel: m.level,
    botSeed: m.botSeed,
    choices: [],
    payChoice: true,
    orderChoice: true,
    ...(m.endTurnClick ? { endTurnClick: true } : {}),
    result: 'draw',
  };
}

export const outcome = (st: GameState): PracticeReplay['result'] => (st.winner === 0 ? 'win' : st.winner === 1 ? 'loss' : 'draw');

/** The practice-log entry for a finished game, keyed by its replay id so a game finished again after Undo replaces it. */
function practiceEntry(replay: PracticeReplay, st: GameState): PracticeGame {
  return {
    id: replay.id,
    date: new Date().toISOString(),
    deck: replay.decks[0].name,
    opp: replay.decks[1].name,
    level: replay.botLevel,
    result: outcome(st),
    first: st.first === 0,
    turns: st.turn,
    reason: st.winReason,
    gigs: [st.players[0].gigs.length, st.players[1].gigs.length],
    ...(replay.conceded ? { conceded: true } : {}),
    ...(replay.multiDay ? { multiDay: { ...replay.multiDay } } : {}),
  };
}

/**
 * Save the replay and the practice-log entry of a finished game (both upsert by the replay id). A conceded game is
 * recorded the same way; `replay.conceded` marks it. False when this browser refused to store either (storage full or
 * blocked): the caller keeps anything it would otherwise delete (a multi-day game's entry) and says so.
 */
export function recordFinished(replay: PracticeReplay, st: GameState): boolean {
  replay.result = outcome(st);
  // what the Game review checks its replay against: this code's version, and how long the game lasted
  replay.simVersion = SIM_VERSION;
  replay.turns = st.turn;
  const kept = saveReplay(replay);
  const logged = recordPractice(practiceEntry(replay, st));
  return kept && logged;
}

const errorText = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

export interface SessionOptions {
  /** bot delay after each of its actions, in ms */
  pace?: () => number;
  /** called after a finished game is recorded (default: save replay and practice entry); false: storage refused it */
  record?: (replay: PracticeReplay, st: GameState) => boolean | void;
  /** a new decision of yours is waiting (the moment a save can come back to): the autosave is written here */
  onStable?: (run: Running) => void;
  /**
   * the game ended for good: finished, conceded, or quit with Exit (the autosave is cleared here). Leaving the page
   * (quit with keepSave) doesn't call it.
   */
  onClosed?: (run: Running, why: 'finished' | 'conceded' | 'quit') => void;
}

/** What restore() gives back: the resumed game, or why it can't be resumed (`mismatch`: other code; offer the log). */
export type RestoreResult = { ok: true; run: Running } | { ok: false; why: string; mismatch: boolean };

/** The position check for the decision now waiting for you. */
function stableOf(run: Running): Running['stable'] {
  const d = run.human.pending?.d;
  if (!d) return run.stable;
  const st = run.g.s;
  return {
    at: run.replay.choices.length,
    turn: st.turn,
    hash: stateHash(st),
    decision: { kind: d.kind, prompt: d.prompt, options: d.options.map((o) => o.label) },
    gigs: [st.players[0].gigs.length, st.players[1].gigs.length],
  };
}

/**
 * Runs practice games one at a time. `subscribe` fires on every change (engine tick, new decision, game over,
 * error); `subscribeGame` only when the running game is replaced (start, undo, quit).
 */
export class PracticeSession {
  current: Running | null = null;
  /** bumped on every change, for useSyncExternalStore */
  version = 0;
  private ticks = new Set<() => void>();
  private games = new Set<() => void>();
  private matchSeq = 0;
  /** bumped by start and quit: a restore still replaying when either happens is dropped */
  private restoreSeq = 0;

  constructor(private opts: SessionOptions = {}) {}

  subscribe = (fn: () => void) => {
    this.ticks.add(fn);
    return () => void this.ticks.delete(fn);
  };
  subscribeGame = (fn: () => void) => {
    this.games.add(fn);
    return () => void this.games.delete(fn);
  };

  /** Start a new match (cancels any running one). */
  start(m: MatchSetup): Running {
    this.restoreSeq++;
    const replay = newPracticeReplay(m);
    const bot = makeTierBot(m.level, m.botSeed, 'Bot') as HeuristicAgent;
    return this.launch((agents) => Game.create(m.decks, agents, { first: m.first, seed: m.seed }), bot, replay, [], [], ++this.matchSeq, false);
  }

  /**
   * Resume a saved game (src/lib/savedGames.ts): replay it from the start with its seeds and your saved answers, unpaced
   * and unseen, to the decision you were at; check the position on the way; then show it. Undo works throughout (its
   * snapshots are rebuilt by the replay) and the coach grades come back with the answers they graded. A save from other
   * code is refused (another SIM_VERSION, or a replay that doesn't reach the saved state), never resumed into a
   * different game. The running game, if any, is replaced only once the restore succeeded.
   */
  async restore(save: SavedGame): Promise<RestoreResult> {
    const problem = versionProblem(save);
    if (problem) return { ok: false, why: problem, mismatch: true };
    const token = ++this.restoreSeq;
    const replay = replayOf(save);
    let reached!: () => void;
    let failed!: (e: unknown) => void;
    const ready = new Promise<void>((res, rej) => {
      reached = res;
      failed = rej;
    });
    const feed: Feed = { choices: save.choices, check: save.check, grades: restoredGrades(save), onReached: () => reached() };
    let run: Running;
    try {
      const bot = makeTierBot(save.botLevel, save.botSeed, 'Bot') as HeuristicAgent;
      run = this.launch((agents) => Game.create(save.decks, agents, { first: save.first, seed: save.seed }), bot, replay, [], [], ++this.matchSeq, false, feed);
    } catch (e) {
      return { ok: false, why: `${MISMATCH_WHY} (${errorText(e)})`, mismatch: true };
    }
    // the game loop ending before your decision came back (an error, a mismatch, or the game over) fails the restore
    void run.done.then(() => failed(new Error(run.error ?? MISMATCH_WHY)));
    try {
      await ready;
    } catch (e) {
      this.cancel(run);
      return { ok: false, why: e instanceof Error ? e.message : String(e), mismatch: true };
    }
    if (token !== this.restoreSeq) {
      this.cancel(run);
      return { ok: false, why: 'The restore was stopped.', mismatch: false };
    }
    run.restoring = false;
    run.stable = stableOf(run);
    if (this.current && this.current !== run) this.cancel(this.current);
    this.current = run;
    this.opts.onStable?.(run);
    this.changed(true);
    return { ok: true, run };
  }

  /** Go back to just before your previous main-phase decision (or the one you're in the middle of). */
  undo(): boolean {
    const run = this.current;
    if (!run || !canUndo(run)) return false;
    const k = undoTarget(run.snaps, run.human.pending?.d.kind);
    const target = run.snaps[k];
    if (!target) return false;
    run.snaps.length = k; // the restored decision takes a fresh snapshot when it is asked again
    run.replay.choices.length = target.choices;
    run.grades.length = target.grades;
    run.replay.undos = (run.replay.undos ?? 0) + 1;
    // undoing a concession takes it back: the game goes on, and is recorded again (same id) when it ends
    delete run.replay.conceded;
    // the position recorded when the game ended (finished or conceded) belongs to that ending, not to the game going on
    delete run.replay.position;
    const state = structuredClone(target.state);
    this.launch((agents) => new Game(state, agents), cloneBot(target.bot), run.replay, run.snaps, run.grades, run.match, true);
    return true;
  }

  /**
   * Concede the running game: it ends at once as a loss for you and is recorded like a finished game (practice log
   * and replay, both marked conceded). Works on your turn, on the bot's turn and while a prompt waits for you. This is
   * the session's verdict, not an engine action: the game loop is stopped the way Quit stops it, then the result is
   * written onto the final state. Undo afterwards works as after any game over (back to before your last main-phase
   * decision); finishing the game again replaces this record (same replay id).
   */
  concede(): boolean {
    const run = this.current;
    if (!run || !canConcede(run)) return false;
    this.cancel(run);
    run.conceded = true;
    const g = run.g;
    const st = g.s;
    st.winner = 1;
    st.winReason = CONCEDED_REASON;
    st.phase = 'over';
    g.log(null, `${CONCEDED_REASON}: ${g.P(1).name} wins`);
    run.replay.conceded = true;
    // the Game review's replay must reach the last decision you were asked, as it was (none asked yet: not checked)
    const at = run.stable;
    if (at) run.replay.position = { hash: at.hash, at: at.at };
    else delete run.replay.position;
    (this.opts.record ?? recordFinished)(run.replay, st);
    this.opts.onClosed?.(run, 'conceded');
    this.changed();
    return true;
  }

  /**
   * Stop the running game without recording anything. "Exit and discard" (the default) ends it for good (onClosed: the
   * autosave is cleared); `keepSave` ("Save and exit", or leaving the page) keeps the autosave so the game can be resumed.
   */
  quit(o: { keepSave?: boolean } = {}) {
    this.restoreSeq++;
    const run = this.current;
    if (!run) return;
    this.cancel(run);
    this.current = null;
    if (!o.keepSave) this.opts.onClosed?.(run, 'quit');
    this.changed(true);
  }

  private cancel(run: Running) {
    run.cancelled = true;
    run.g.onUpdate = null;
    run.human.onChange = null;
    run.human.cancel();
  }

  private changed(game = false) {
    this.version++;
    for (const f of [...this.ticks]) f();
    if (game) for (const f of [...this.games]) f();
  }

  /**
   * Wire up and run a game: a fresh one (run), one restored from a snapshot (resume), or one replayed from a save
   * (`feed`: unpaced and not the current game until restore() shows it).
   */
  private launch(make: (agents: [Agent, Agent]) => Game, bot: HeuristicAgent, replay: PracticeReplay, snaps: Snapshot[], grades: CoachedGrade[], match: number, resumed: boolean, feed?: Feed): Running {
    if (this.current && !feed) this.cancel(this.current);
    // the game's End turn mode comes from its record, so Undo and a restore play it the same way
    const human = new HumanAgent({ confirmsEndTurn: !!replay.endTurnClick });
    const run = { match, human, bot, replay, snaps, grades, error: null, cancelled: false, conceded: false, stable: null, restoring: !!feed } as Omit<Running, 'g' | 'done'> as Running;
    const seat: Agent = feed ? new FeedAgent(human, feed, grades) : human;
    const recorder = new RecordingAgent(seat, replay.choices, (g) => snaps.push(takeSnapshot(g, bot, replay.choices.length, grades.length)), run);
    const pace = this.opts.pace ?? (() => 0);
    const g = make([recorder, new PacedAgent(bot, () => (run.restoring ? 0 : pace()), run)]);
    run.g = g;
    const tick = () => {
      if (!run.cancelled && this.current === run) this.changed();
    };
    g.onUpdate = tick;
    let asked: Decision | null = null;
    human.onChange = () => {
      // a new decision of yours: the position a save comes back to
      const d = human.pending?.d ?? null;
      if (d && d !== asked && !run.restoring && !run.cancelled) {
        asked = d;
        run.stable = stableOf(run);
        if (this.current === run) this.opts.onStable?.(run);
      }
      tick();
    };
    if (!feed) this.current = run;
    run.done = (resumed ? g.resume() : g.run()).then(
      (st) => {
        if (run.cancelled || run.restoring) return;
        // played to its end on the board: the Game review's replay must end in this very position
        replay.position = { hash: stateHash(st) };
        (this.opts.record ?? recordFinished)(replay, st);
        this.opts.onClosed?.(run, 'finished');
        tick();
      },
      (e: unknown) => {
        if (run.cancelled || e instanceof GameCancelled) return;
        if (run.restoring) {
          run.error = e instanceof ReplayMismatch ? e.message : `${MISMATCH_WHY} (${errorText(e)})`;
          return;
        }
        console.error('Practice game stopped by an error', e);
        run.error = errorText(e);
        tick();
      },
    );
    if (!feed) this.changed(true);
    return run;
  }
}
