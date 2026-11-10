// A practice game against a bot, without React: the paced bot, the recording human seat, Undo snapshots,
// cancellation, error capture, and recording the result once. The Play page drives it through usePracticeGame().
import { Game } from '../engine/engine';
import type { Agent, Decision, DecisionKind, DeckList, GameState, PlayerId } from '../engine/types';
import type { HeuristicAgent } from '../ai/heuristic';
import type { MoveGrade } from '../ai/coach';
import { makeTierBot } from '../ai/tiers';
import { HumanAgent } from '../ui/HumanAgent';
import { saveReplay, type PracticeReplay } from './practiceReplays';
import { recordPractice, type PracticeGame } from './practiceLog';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Thrown inside a game's agents once the game was quit, undone or replaced, so its loop unwinds quietly. */
export class GameCancelled extends Error {
  constructor() {
    super('game cancelled');
  }
}

export interface Cancellable {
  cancelled: boolean;
}

/** Wraps a bot so its moves are visible to the human. Stops the game once it is cancelled. */
export class PacedAgent implements Agent {
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
  constructor(
    public inner: Agent,
    public choices: number[][],
    private onAction?: (g: Game) => void,
    private run: Cancellable = { cancelled: false },
  ) {
    this.name = inner.name;
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
export function takeSnapshot(g: Game, bot: HeuristicAgent, choices: number, grades: number): Snapshot {
  const seat: Agent = { name: 'snapshot', decide: async () => [0] };
  return { state: g.clone([seat, seat]).s, bot: cloneBot(bot), choices, grades };
}

/**
 * Which snapshot Undo goes back to: the decision before the one you are in now (if you are in a main-phase
 * decision, its own snapshot is the newest), otherwise the newest (a sub-decision, game over or an error). -1 = none.
 */
export function undoTarget(snaps: readonly Snapshot[], pending: DecisionKind | undefined): number {
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
  /** coach grades of your moves, truncated by Undo like the recorded choices */
  grades: MoveGrade[];
  /** set when the game loop threw; the game is stopped but Undo and Quit still work */
  error: string | null;
  /** set on quit, undo, a new game or unmount: this game's agents stop and its result is never recorded */
  cancelled: boolean;
  /** settles when this game's loop ends (finished, errored or cancelled) */
  done: Promise<void>;
}

/** Undo is offered while you are deciding something, after the game ends, or after an error, if there is a snapshot to go to. */
export function canUndo(run: Running): boolean {
  if (!run.error && !run.human.pending && run.g.s.winner === null) return false;
  return undoTarget(run.snaps, run.human.pending?.d.kind) >= 0;
}

export interface MatchSetup {
  decks: [DeckList, DeckList];
  seed: number;
  first?: PlayerId;
  level: string;
  botSeed: number;
}

let replaySeq = 0;
export function newPracticeReplay(m: MatchSetup): PracticeReplay {
  return {
    id: `p${Date.now().toString(36)}${(replaySeq++ % 1296).toString(36)}`,
    date: new Date().toISOString(),
    decks: m.decks,
    seed: m.seed,
    first: m.first,
    botLevel: m.level,
    botSeed: m.botSeed,
    choices: [],
    result: 'draw',
  };
}

export const outcome = (st: GameState): PracticeReplay['result'] => (st.winner === 0 ? 'win' : st.winner === 1 ? 'loss' : 'draw');

/** The practice-log entry for a finished game, keyed by its replay id so a game finished again after Undo replaces it. */
export function practiceEntry(replay: PracticeReplay, st: GameState): PracticeGame {
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
  };
}

/** Save the replay and the practice-log entry of a finished game (both upsert by the replay id). */
export function recordFinished(replay: PracticeReplay, st: GameState) {
  replay.result = outcome(st);
  saveReplay(replay);
  recordPractice(practiceEntry(replay, st));
}

const errorText = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

export interface SessionOptions {
  /** bot delay after each of its actions, in ms */
  pace?: () => number;
  /** called after a finished game is recorded (default: save replay and practice entry) */
  record?: (replay: PracticeReplay, st: GameState) => void;
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
    const replay = newPracticeReplay(m);
    const bot = makeTierBot(m.level, m.botSeed, 'Bot') as HeuristicAgent;
    return this.launch((agents) => Game.create(m.decks, agents, { first: m.first, seed: m.seed }), bot, replay, [], [], ++this.matchSeq, false);
  }

  /** Go back to just before your previous main-phase decision (or the one you're in the middle of). */
  undo(): boolean {
    const run = this.current;
    if (!run || !canUndo(run)) return false;
    const k = undoTarget(run.snaps, run.human.pending?.d.kind);
    const target = run.snaps[k];
    run.snaps.length = k; // the restored decision takes a fresh snapshot when it is asked again
    run.replay.choices.length = target.choices;
    run.grades.length = target.grades;
    run.replay.undos = (run.replay.undos ?? 0) + 1;
    const state = structuredClone(target.state);
    this.launch((agents) => new Game(state, agents), cloneBot(target.bot), run.replay, run.snaps, run.grades, run.match, true);
    return true;
  }

  /** Stop the running game without recording anything. */
  quit() {
    if (!this.current) return;
    this.cancel(this.current);
    this.current = null;
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

  /** Wire up and run a game: a fresh one (run) or one restored from a snapshot (resume). */
  private launch(make: (agents: [Agent, Agent]) => Game, bot: HeuristicAgent, replay: PracticeReplay, snaps: Snapshot[], grades: MoveGrade[], match: number, resumed: boolean): Running {
    if (this.current) this.cancel(this.current);
    const human = new HumanAgent();
    const run = { match, human, bot, replay, snaps, grades, error: null, cancelled: false } as Omit<Running, 'g' | 'done'> as Running;
    const recorder = new RecordingAgent(human, replay.choices, (g) => snaps.push(takeSnapshot(g, bot, replay.choices.length, grades.length)), run);
    const g = make([recorder, new PacedAgent(bot, this.opts.pace ?? (() => 0), run)]);
    run.g = g;
    const tick = () => {
      if (!run.cancelled && this.current === run) this.changed();
    };
    g.onUpdate = tick;
    human.onChange = tick;
    this.current = run;
    run.done = (resumed ? g.resume() : g.run()).then(
      (st) => {
        if (run.cancelled) return;
        (this.opts.record ?? recordFinished)(replay, st);
        tick();
      },
      (e: unknown) => {
        if (run.cancelled || e instanceof GameCancelled) return;
        console.error('Practice game stopped by an error', e);
        run.error = errorText(e);
        tick();
      },
    );
    this.changed(true);
    return run;
  }
}
