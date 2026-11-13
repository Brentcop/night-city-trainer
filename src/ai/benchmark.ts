// INFO-5: the fixed benchmark of decision positions (docs/BOT_TOOLKIT.md §10). A position is rebuilt by replaying a
// recorded game from its seed: every answer before the position is played back by a scripted agent (no bot thinks, so the
// replay is cheap and does not depend on the bots' code), and the game is paused at the position's decision. There a bot
// can be asked for its move (scripts/benchmark.ts), or the oracle can play a candidate out to the end of the game
// (scripts/benchmark-build.ts): the hidden information is re-dealt from the decider's view (`hideInfo`, the bots' own
// lookahead rule), the candidate is played, and two reference bots finish the game. The oracle is the game's result,
// never `evaluate()`. Statistics are in src/lib/benchmarkStats.ts.
import { Game } from '../engine/engine';
import type { Agent, CardInst, Decision, DeckList, GameState, PlayerId } from '../engine/types';
import { hideInfo } from './heuristic';
import { makeTierBot } from './tiers';
import type { World } from './playOut';
import { unpackOutcomes } from '../lib/benchmarkStats';

/** The decision types the suite is stratified by. 'sell' is a main-phase decision with a sell among its options. */
export const BENCH_KINDS = ['mulligan', 'main', 'sell', 'react', 'effect'] as const;
export type BenchKind = (typeof BENCH_KINDS)[number];
/** Game stage by global turn: opening (the mulligan), early (turns 1–4), mid (5–9), late (10+). */
export const BENCH_STAGES = ['opening', 'early', 'mid', 'late'] as const;
export type BenchStage = (typeof BENCH_STAGES)[number];

export const stageOf = (turn: number): BenchStage => (turn === 0 ? 'opening' : turn <= 4 ? 'early' : turn <= 9 ? 'mid' : 'late');

/** Answers as text: decisions separated by '.', the indices of one answer by ','. */
export const encodeAnswers = (a: readonly (readonly number[])[]): string => a.map((x) => x.join(',')).join('.');
export const decodeAnswers = (s: string): number[][] => (s === '' ? [] : s.split('.').map((x) => (x === '' ? [] : x.split(',').map(Number))));

/** How to replay a recorded game: the decks, the seed, who went first and the answers given, in order. */
export interface GameRef {
  decks: [DeckList, DeckList];
  seed: number;
  first: PlayerId;
  answers: readonly (readonly number[])[];
}

/** A game paused at a decision. `answer` gives the choice, hands the rest of the game to `after` and plays it to the end. */
export interface Paused {
  g: Game;
  d: Decision;
  answer(choice: number[], after: [Agent, Agent]): Promise<GameState>;
}

class Controller {
  private i = 0;
  after: [Agent, Agent] | null = null;
  constructor(
    private answers: GameRef['answers'],
    private k: number,
    private onTarget: (g: Game, d: Decision) => Promise<number[]>,
  ) {}
  async decide(g: Game, d: Decision): Promise<number[]> {
    const i = this.i++;
    if (i < this.k) {
      const a = this.answers[i];
      if (!a || a.some((x) => x < 0 || x >= d.options.length)) throw new Error(`replay diverged at decision ${i}: recorded ${JSON.stringify(a)} for ${d.options.length} options (${d.prompt})`);
      return [...a];
    }
    if (i === this.k) return this.onTarget(g, d);
    if (!this.after) throw new Error('replay went past its target decision');
    return this.after[d.player].decide(g, d);
  }
}

/** Replay `ref` up to decision k (0-based, counting every question asked of either seat) and pause there. */
export function pauseAt(ref: GameRef, k: number): Promise<Paused> {
  if (k > ref.answers.length) return Promise.reject(new Error(`decision ${k} is past the ${ref.answers.length} recorded answers`));
  return new Promise<Paused>((resolve, reject) => {
    let done: Promise<GameState> | null = null;
    const ctl: Controller = new Controller(ref.answers, k, (g, d) =>
      new Promise<number[]>((release) =>
        resolve({
          g,
          d,
          answer(choice, after) {
            ctl.after = after;
            release(choice);
            return done!;
          },
        }),
      ),
    );
    const seat: Agent = { name: 'replay', decide: (g, d) => ctl.decide(g, d) };
    const g = Game.create(ref.decks, [seat, seat], { seed: ref.seed, first: ref.first, log: false });
    done = g.run();
    // the game ending first means the position is not in this game; after the pause, the caller awaits `done` itself
    done.then(() => reject(new Error(`the game ended before decision ${k}`)), reject);
  });
}

/** The decider's score of a finished game: 1 won, 0.5 tie, 0 lost. */
export const scoreFor = (s: GameState, p: PlayerId): number => (s.winner === p ? 1 : s.winner === 'tie' ? 0.5 : 0);

/**
 * The oracle: play option `choice` at decision k in `world` and finish the game with two `oracle` tier bots. The world
 * fixes the engine's random state (set, then the hidden information is re-dealt from the decider's view) and the two
 * bots' seeds, so every candidate of a position is played in the same worlds (common random numbers).
 */
export async function oracleOutcome(ref: GameRef, k: number, choice: number, world: World, oracle = 'medium'): Promise<number> {
  const at = await pauseAt(ref, k);
  const p = at.d.player;
  at.g.s.rng = world.rng;
  hideInfo(at.g, p);
  const s = await at.answer([choice], [makeTierBot(oracle, world.a), makeTierBot(oracle, world.b)]);
  return scoreFor(s, p);
}

/** Ask `agent` for its move at decision k. The paused game is dropped afterwards. */
export async function askAt(ref: GameRef, k: number, agent: Agent): Promise<number[]> {
  const at = await pauseAt(ref, k);
  return agent.decide(at.g, at.d);
}

// ---------------------------------------------------------------------------------------------------------- positions

/** What the suite records about a decision when it is met in a game. */
export interface PositionMeta {
  k: number;
  p: PlayerId;
  turn: number;
  kind: BenchKind;
  stage: BenchStage;
  /** the engine's decision kind and tag */
  dk: string;
  tag?: string;
  labels: string[];
  /** per option, the index of the first option it is interchangeable with (itself when none) */
  groups: number[];
  /** why it cannot be a benchmark position, when it can't */
  skip?: string;
}

const uidOf = (o: Decision['options'][number]): number | undefined => o.uid ?? (o.action && 'uid' in o.action ? o.action.uid : undefined);

/** The decision type of d. */
export function benchKind(d: Decision): BenchKind {
  if (d.kind === 'yesno' && d.tag === 'mulligan') return 'mulligan';
  if (d.kind === 'action') return d.options.some((o) => o.action?.type === 'sell') ? 'sell' : 'main';
  if (d.kind === 'reaction') return 'react';
  return 'effect';
}

/**
 * Interchangeable options: the same kind of choice of the same card in the decider's own hand (three copies of a card are
 * three options), and Calls of the decider's own face-down Legends it has not looked at (it can't tell them apart).
 * Every other option is its own group.
 */
export function optionGroups(g: Game, d: Decision): number[] {
  const seen = new Map<string, number>();
  return d.options.map((o, i) => {
    const u = uidOf(o);
    let key: string | null = null;
    if (u !== undefined) {
      const c: CardInst | undefined = g.s.cards[u];
      const type = o.action?.type ?? 'card';
      if (c && c.zone === 'hand' && c.controller === d.player && (!o.action || o.action.type !== 'activate')) key = `${type}:${c.defId}:hand`;
      else if (c && o.action?.type === 'call' && c.zone === 'legends' && !c.faceUp && !c.known) key = 'call:?';
    }
    if (key === null) return i;
    const first = seen.get(key);
    if (first !== undefined) return first;
    seen.set(key, i);
    return i;
  });
}

/** Distinct groups of an option list, in order (each group's first option). */
export const groupReps = (groups: readonly number[]): number[] => groups.filter((x, i) => x === i);

/** Describe decision k (before it is answered) and say whether it can be a benchmark position. */
export function describeDecision(g: Game, d: Decision, k: number): PositionMeta {
  const groups = optionGroups(g, d);
  const meta: PositionMeta = { k, p: d.player, turn: g.s.turn, kind: benchKind(d), stage: stageOf(g.s.turn), dk: d.kind, ...(d.tag ? { tag: d.tag } : {}), labels: d.options.map((o) => o.label), groups };
  const hiddenFromDecider = (u: number) => {
    const c = g.s.cards[u];
    return !!c && (c.zone === 'deck' || (c.zone === 'hand' && c.controller !== d.player));
  };
  if (d.kind === 'pay' || d.kind === 'order') meta.skip = 'not asked of bots';
  else if (d.max !== 1 || d.min > 1) meta.skip = 'multiple choice';
  else if (groupReps(groups).length < 2) meta.skip = 'one distinct option';
  else if (d.options.some((o) => {
    const u = uidOf(o);
    return u !== undefined && hiddenFromDecider(u);
  }))
    meta.skip = 'an option names a card the re-deal would move';
  return meta;
}

/** Wraps a game's two agents and records every answer, and every decision's description. Plays exactly as the inner agents. */
export class GameRecorder {
  answers: number[][] = [];
  metas: PositionMeta[] = [];
  readonly agents: [Agent, Agent];
  constructor(inner: [Agent, Agent]) {
    const wrap = (a: Agent): Agent => ({
      name: a.name,
      ...(a.choosesPayment ? { choosesPayment: true } : {}),
      ...(a.choosesOrder ? { choosesOrder: true } : {}),
      ...(a.confirmsEndTurn ? { confirmsEndTurn: true } : {}),
      decide: async (g, d) => {
        const k = this.answers.length;
        this.metas.push(describeDecision(g, d, k));
        this.answers.push([]); // reserve the index while the agent thinks
        const r = await a.decide(g, d);
        this.answers[k] = [...r];
        return r;
      },
    });
    this.agents = [wrap(inner[0]), wrap(inner[1])];
  }
}

// ---------------------------------------------------------------------------------------------------------- the suite file

/** One recorded game of the suite: its decks (keys into `BenchSuite.decks`), seed, first player and answers up to its last position. */
export interface SuiteGame {
  id: string;
  a: string;
  b: string;
  seed: number;
  first: PlayerId;
  /** encodeAnswers() of the answers before its last position */
  answers: string;
}

/** One labelled position. */
export interface SuitePosition {
  /** stable id: the game's id and the decision index */
  id: string;
  /** index into `BenchSuite.games` */
  game: number;
  k: number;
  p: PlayerId;
  turn: number;
  kind: BenchKind;
  stage: BenchStage;
  dk: string;
  tag?: string;
  labels: string[];
  groups: number[];
  /** the worlds are makeWorlds(n, worldRandom(worldSeed)), in order; option i was played in the first n[i] */
  worldSeed: number;
  /** per option (a group's first index): packed scores (src/lib/benchmarkStats.ts packOutcomes) and how many */
  out: Record<string, string>;
  n: Record<string, number>;
  /** summary when built (recomputed from `out` by readers): win rate per option, the best option, the best-vs-second SE */
  wr: Record<string, number>;
  best: number;
  seBestSecond: number | null;
  indifferent: boolean;
}

export interface BenchSuite {
  schema: 1;
  kind: 'nct-benchmark';
  /** ISO date the suite was built */
  built: string;
  /** SIM_VERSION when built: the replays depend on the engine, not the bots */
  simVersion: number;
  source: { bot: string; decks: string; games: number; seed: number };
  oracle: { bot: string; worlds: number; maxWorlds: number; contenders: number; contenderZ: number; bestZ: number; maxOptions: number; labelSeconds: number };
  decks: Record<string, DeckList>;
  games: SuiteGame[];
  positions: SuitePosition[];
}

/** The random stream a position's worlds are drawn from (an LCG seeded by `worldSeed`). */
export function worldRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** How to rebuild a suite position. */
export function suiteRef(suite: BenchSuite, pos: SuitePosition): GameRef {
  const g = suite.games[pos.game];
  if (!g) throw new Error(`position ${pos.id}: no game ${pos.game}`);
  const a = suite.decks[g.a];
  const b = suite.decks[g.b];
  if (!a || !b) throw new Error(`game ${g.id}: unknown deck`);
  return { decks: [a, b], seed: g.seed, first: g.first, answers: decodeAnswers(g.answers) };
}

/** A position's per-option scores, unpacked (keys: each group's first option index). */
export function positionOutcomes(pos: SuitePosition): Map<number, number[]> {
  return new Map(Object.entries(pos.out).map(([k, s]) => [Number(k), unpackOutcomes(s, pos.n[k] ?? 0)]));
}
