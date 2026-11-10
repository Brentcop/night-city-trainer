// Post-game match reviewer. Replays a finished game exactly (same seeds, same bots, or the human's recorded choices)
// and scores every main-phase decision of the reviewed seats against an oracle: each candidate action is played out
// several times (rest of the turn + the rival's whole reply, hidden information re-dealt) and the averages compared.
//
//   regret    = oracle value of the best candidate − oracle value of the move made (evaluation points; ~40 = one Gig)
//   accuracy  = share of decisions within the noise band of the best move
//   blunder   = regret above BLUNDER points
//
// Shared by scripts/review.ts (batches, backfill) and the browser (Play, Tournaments → match → Review).
// Caveat: the oracle values positions with the bots' own evaluation, so it finds tactical slips, not new strategy.
import { Game, GameOverSignal } from '../engine/engine';
import { CARD_BY_ID } from '../engine/cards';
import type { Action, Agent, Decision, DeckList, PlayerId, Reaction } from '../engine/types';
import { HeuristicAgent, hideInfo, isUnknownCall } from './heuristic';
import { BEST_PROFILES } from './archetype';
import { evaluate } from './eval';

/** Decisions closer than this to the best move count as accurate (oracle noise floor, see validation in reports). */
export const NOISE = 4;
/** Regret above this is a blunder (≈ 0.4 Gigs). */
export const BLUNDER = 15;
/** Regret is capped here (3 Gigs) so a single game-ending line doesn't swamp the averages. */
export const CAP = 120;
/** Play-outs per candidate (validated: 8 with common random numbers, see reports/review-validation.md). */
export const DEFAULT_ROLLOUTS = 8;

export type Category =
  | 'sell'
  | 'unit'
  | 'program'
  | 'gear'
  | 'call'
  | 'attack gigs'
  | 'attack unit'
  | 'activate'
  | 'go solo'
  | 'end turn'
  | 'block'
  | 'no reaction'
  | 'react: call'
  | 'react: program'
  | 'react: ability';

export interface DecisionReview {
  i: number; // decision number in the game
  turn: number;
  player: PlayerId;
  category: Category;
  options: number;
  chosen: string;
  best: string;
  coach?: string;
  regret: number; // capped, eval points
  gameLosing: boolean; // the move made loses the game in the oracle's play-outs where the best one doesn't
  coachRegret?: number;
}
export interface CatStat {
  n: number;
  regret: number; // average
  blunders: number;
  accuracy: number;
}
export interface SeatReview {
  player: PlayerId;
  name: string;
  agent: string;
  decisions: number;
  accuracy: number;
  avgRegret: number; // eval points
  blunders: number;
  gameLosing: number;
  coachAgree?: number; // share where the coach picked the oracle's best (or within noise)
  byCategory: Partial<Record<Category, CatStat>>;
  worst: DecisionReview[];
}
export interface GameReview {
  version: number;
  seed: number;
  first: PlayerId;
  winner: PlayerId | 'tie' | null;
  reason: string;
  turns: number;
  names: [string, string];
  rollouts: number;
  seats: SeatReview[];
  /** evaluation from player 0's side at the start of each turn */
  timeline: { turn: number; v: number }[];
  swings: { turn: number; delta: number; active: PlayerId }[];
  decisions: DecisionReview[];
  ms: number;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** One random "world" for a play-out: the hidden-information deal and the play-out bots' seeds. */
export interface World {
  rng: number;
  a: number;
  b: number;
}
/** n worlds. Score every candidate of a decision in the SAME worlds (common random numbers): only the move differs,
 *  so the comparison is far less noisy than scoring each candidate in its own random worlds. */
export const makeWorlds = (n: number, rnd: () => number): World[] =>
  Array.from({ length: n }, () => ({ rng: Math.floor(rnd() * 2 ** 31), a: Math.floor(rnd() * 1e9), b: Math.floor(rnd() * 1e9) }));

/** Every play-out score is clamped to ±TERMINAL, and a won or lost game counts as exactly ±TERMINAL (instead of the
 *  engine's ±10000). Losing in 1 world of 8 then costs 1/8 of a game, and no position can score below an actual loss. */
const TERMINAL = 600;
/** If every candidate is within this of a won or lost game, the game is already decided and moves are not graded. */
const DECIDED = 0.75 * TERMINAL;

/** Oracle value of an action for player p: average over play-outs in the given worlds (rest of turn + rival's full turn). */
export async function oracleValue(g: Game, p: PlayerId, a: Action, worlds: World[]): Promise<number> {
  return (await oracleDetail(g, p, a, worlds)).v;
}

/** Oracle value plus the share of worlds in which the action led to a lost game. */
async function oracleDetail(g: Game, p: PlayerId, a: Action, worlds: World[]): Promise<{ v: number; lossRate: number }> {
  let sum = 0;
  let losses = 0;
  for (const w of worlds) {
    const mk = (seed: number) => new HeuristicAgent({ lookahead: true, maxCandidates: 14, profiles: BEST_PROFILES, seed });
    const cg = g.clone([mk(w.a), mk(w.b)]);
    cg.s.rng = w.rng;
    hideInfo(cg, p);
    try {
      if (a.type !== 'pass') {
        await cg.doAction(p, a);
        await cg.resolvePending();
        cg.checkState();
        await cg.mainLoop();
      }
      await cg.endPhase();
      await cg.startPhase();
      await cg.mainLoop();
      await cg.endPhase();
    } catch (e) {
      if (!(e instanceof GameOverSignal)) throw e;
    }
    const e = evaluate(cg, p);
    if (e < -5000) losses++;
    sum += Math.max(-TERMINAL, Math.min(TERMINAL, e));
  }
  return { v: sum / worlds.length, lossRate: losses / worlds.length };
}

/** Oracle value of a reaction for the defending player p: resume the attack, finish the attacker's turn, play p's turn. */
async function oracleReaction(g: Game, p: PlayerId, rx: Reaction, worlds: World[]): Promise<{ v: number; lossRate: number }> {
  let sum = 0;
  let losses = 0;
  const attacker = g.s.attack!.attacker;
  for (const w of worlds) {
    const mk = (seed: number) => new HeuristicAgent({ lookahead: true, maxCandidates: 14, profiles: BEST_PROFILES, seed });
    const cg = g.clone([mk(w.a), mk(w.b)]);
    cg.s.rng = w.rng;
    hideInfo(cg, p);
    try {
      if (rx.type === 'endReact') await cg.attackRest(attacker, true);
      else {
        await cg.doReaction(p, rx);
        await cg.resolvePending();
        await cg.attackRest(attacker);
      }
      cg.checkState();
      await cg.mainLoop(); // the attacker finishes their turn
      await cg.endPhase();
      await cg.startPhase(); // then our whole turn
      await cg.mainLoop();
      await cg.endPhase();
    } catch (e) {
      if (!(e instanceof GameOverSignal)) throw e;
    }
    const e = evaluate(cg, p);
    if (e < -5000) losses++;
    sum += Math.max(-TERMINAL, Math.min(TERMINAL, e));
  }
  return { v: sum / worlds.length, lossRate: losses / worlds.length };
}

/**
 * Oracle values of the candidate options. Calls of face-down Legends the player can't tell apart are one move: each is
 * valued as the average over every unknown slot (in the same worlds), so no slot is graded on its hidden identity.
 */
async function gradeAll<T extends Action | Reaction>(g: Game, cand: number[], opts: T[], oracle: (a: T) => Promise<{ v: number; lossRate: number }>) {
  const vals = new Map<number, number>();
  const loss = new Map<number, number>();
  const unknown = opts.map((_, i) => i).filter((i) => isUnknownCall(g, opts[i]));
  let group: { v: number; lossRate: number } | null = null;
  for (const i of cand) {
    let o: { v: number; lossRate: number };
    if (unknown.includes(i)) {
      if (!group) {
        let v = 0;
        let l = 0;
        for (const k of unknown) {
          const x = await oracle(opts[k]);
          v += x.v;
          l += x.lossRate;
        }
        group = { v: v / unknown.length, lossRate: l / unknown.length };
      }
      o = group;
    } else o = await oracle(opts[i]);
    vals.set(i, o.v);
    loss.set(i, o.lossRate);
  }
  return { vals, loss };
}

function reactionCategory(rx: Reaction): Category {
  return rx.type === 'endReact' ? 'no reaction' : rx.type === 'block' ? 'block' : rx.type === 'call' ? 'react: call' : rx.type === 'play' ? 'react: program' : 'react: ability';
}

function categoryOf(g: Game, a: Action): Category {
  switch (a.type) {
    case 'pass':
      return 'end turn';
    case 'sell':
      return 'sell';
    case 'call':
      return 'call';
    case 'goSolo':
      return 'go solo';
    case 'activate':
      return 'activate';
    case 'attack':
      return a.targetUnit !== null ? 'attack unit' : 'attack gigs';
    case 'play': {
      const t = CARD_BY_ID[g.c(a.uid).defId]?.type;
      return t === 'Program' ? 'program' : t === 'Gear' ? 'gear' : 'unit';
    }
  }
}

export interface ReviewOptions {
  rollouts?: number;
  /** seats to review (default both) */
  seats?: PlayerId[];
  /** also ask the coach for each reviewed decision (slower; measures the coach against the oracle) */
  withCoach?: boolean;
  coach?: () => Agent & { decide(g: Game, d: Decision): Promise<number[]> };
  /** alternatives screened by a quick 1-ply pass, besides the move made */
  screen?: number;
  onProgress?: (decisions: number) => void;
  shouldStop?: () => boolean;
}

/** Wraps a seat's agent: plays exactly as it would, and reviews its main-phase decisions on the side. */
export class ReviewAgent implements Agent {
  name: string;
  choosesPayment?: boolean;
  out: DecisionReview[] = [];
  timeline: { turn: number; v: number }[] = [];
  private rnd: () => number;
  private count = 0;
  constructor(
    public inner: Agent,
    public seat: PlayerId,
    public review: boolean,
    private opts: ReviewOptions,
    seed: number,
    private shared: { n: number; lastTurn: number },
  ) {
    this.name = inner.name;
    this.choosesPayment = inner.choosesPayment;
    this.rnd = rng(seed * 31 + seat * 7 + 1);
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    if (d.kind === 'action' && this.shared.lastTurn !== g.s.turn) {
      this.shared.lastTurn = g.s.turn;
      this.timeline.push({ turn: g.s.turn, v: evaluate(g, 0) });
    }
    if (this.opts.shouldStop?.()) return this.inner.decide(g, d);
    if (this.review && d.kind === 'reaction' && d.options.length >= 2 && g.s.attack) return this.reviewReaction(g, d);
    if (!this.review || d.kind !== 'action' || d.options.length < 2) return this.inner.decide(g, d);
    // the move actually made (decide first: oracle play-outs are clones and never touch the real game)
    const pick = await this.inner.decide(g, d);
    const chosen = pick[0];
    const actions = d.options.map((o) => o.action as Action);
    const cand = new Set<number>([chosen]);
    const screen = new HeuristicAgent({ profiles: BEST_PROFILES });
    await screen.decide(g, d);
    for (const x of screen.lastAlternatives.slice(0, this.opts.screen ?? 4)) cand.add(x.index);
    // a sell: also grade "don't sell now" — the best move among the non-sell options (screened the same way)
    if (actions[chosen].type === 'sell') {
      const keep = actions.map((a, i) => i).filter((i) => actions[i].type !== 'sell');
      if (keep.length > 1) {
        const ns = new HeuristicAgent({ profiles: BEST_PROFILES });
        const [k] = await ns.decide(g, { ...d, options: keep.map((i) => d.options[i]) });
        cand.add(keep[k]);
      }
    }
    // sells: the real question is which card (if any) to sell, so compare other sellable cards (one per distinct card)
    if (actions[chosen].type === 'sell' || screen.lastAlternatives.length === 0) {
      const seen = new Set<string>();
      const ch = actions[chosen];
      if (ch.type === 'sell') seen.add(g.c(ch.uid).defId);
      for (let i = 0; i < actions.length && seen.size < 5; i++) {
        const a = actions[i];
        if (a.type !== 'sell' || seen.has(g.c(a.uid).defId)) continue;
        seen.add(g.c(a.uid).defId);
        cand.add(i);
      }
    }
    // not acting is always a baseline
    const passI = actions.findIndex((a) => a.type === 'pass');
    if (passI >= 0) cand.add(passI);
    let coachI: number | undefined;
    if (this.opts.withCoach && this.opts.coach) {
      [coachI] = await this.opts.coach().decide(g, d);
      cand.add(coachI);
    }
    const worlds = makeWorlds(this.opts.rollouts ?? DEFAULT_ROLLOUTS, this.rnd);
    const { vals, loss } = await gradeAll(g, [...cand], actions, (a) => oracleDetail(g, this.seat, a, worlds));
    const bestV = Math.max(...vals.values());
    // already decided (every option loses, or every option wins): differences between moves mean nothing
    const decided = bestV <= -DECIDED || Math.min(...vals.values()) >= DECIDED;
    const bestI = [...vals.entries()].find(([, v]) => v === bestV)![0];
    const raw = decided ? 0 : bestV - vals.get(chosen)!;
    // game-losing: the move made loses in clearly more worlds than the best move (at least 1 world in 4 more)
    const lostLine = !decided && loss.get(chosen)! - loss.get(bestI)! >= 0.25;
    const cr = coachI !== undefined ? (decided ? 0 : Math.min(CAP, bestV - vals.get(coachI)!)) : undefined;
    this.out.push({
      i: this.count++,
      turn: g.s.turn,
      player: this.seat,
      category: categoryOf(g, actions[chosen]),
      options: d.options.length,
      chosen: d.options[chosen].label,
      best: d.options[bestI].label,
      coach: coachI !== undefined ? d.options[coachI].label : undefined,
      regret: Math.min(CAP, Math.max(0, raw)),
      gameLosing: lostLine,
      coachRegret: cr !== undefined ? Math.max(0, cr) : undefined,
    });
    this.shared.n++;
    this.opts.onProgress?.(this.shared.n);
    return pick;
  }

  /** Reactions (blocks, reaction-time calls and programs, or letting the attack through), graded like main-phase moves. */
  private async reviewReaction(g: Game, d: Decision): Promise<number[]> {
    const pick = await this.inner.decide(g, d);
    const chosen = pick[0];
    const rxs = d.options.map((o) => o.action as Reaction);
    // every option is graded (unknown Calls collapse into one, so this stays small)
    const cand = rxs.map((_, i) => i);
    let coachI: number | undefined;
    if (this.opts.withCoach && this.opts.coach) [coachI] = await this.opts.coach().decide(g, d);
    const worlds = makeWorlds(this.opts.rollouts ?? DEFAULT_ROLLOUTS, this.rnd);
    const { vals, loss } = await gradeAll(g, cand, rxs, (r) => oracleReaction(g, this.seat, r, worlds));
    this.record(g, d, chosen, vals, loss, coachI, reactionCategory(rxs[chosen]));
    return pick;
  }

  private record(g: Game, d: Decision, chosen: number, vals: Map<number, number>, loss: Map<number, number>, coachI: number | undefined, category: Category) {
    const bestV = Math.max(...vals.values());
    const decided = bestV <= -DECIDED || Math.min(...vals.values()) >= DECIDED;
    const bestI = [...vals.entries()].find(([, v]) => v === bestV)![0];
    const raw = decided ? 0 : bestV - vals.get(chosen)!;
    const cr = coachI !== undefined ? (decided ? 0 : Math.min(CAP, bestV - vals.get(coachI)!)) : undefined;
    this.out.push({
      i: this.count++,
      turn: g.s.turn,
      player: this.seat,
      category,
      options: d.options.length,
      chosen: d.options[chosen].label,
      best: d.options[bestI].label,
      coach: coachI !== undefined ? d.options[coachI].label : undefined,
      regret: Math.min(CAP, Math.max(0, raw)),
      gameLosing: !decided && loss.get(chosen)! - loss.get(bestI)! >= 0.25,
      coachRegret: cr !== undefined ? Math.max(0, cr) : undefined,
    });
    this.shared.n++;
    this.opts.onProgress?.(this.shared.n);
  }
}

export function summarizeSeat(player: PlayerId, name: string, agent: string, ds: DecisionReview[]): SeatReview {
  const cats: Partial<Record<Category, CatStat>> = {};
  for (const d of ds) {
    const c = (cats[d.category] ??= { n: 0, regret: 0, blunders: 0, accuracy: 0 });
    c.n++;
    c.regret += d.regret;
    if (d.regret > BLUNDER) c.blunders++;
    if (d.regret <= NOISE) c.accuracy++;
  }
  for (const c of Object.values(cats)) (c!.regret /= c!.n), (c!.accuracy /= c!.n);
  const withCoach = ds.filter((d) => d.coachRegret !== undefined);
  return {
    player,
    name,
    agent,
    decisions: ds.length,
    accuracy: ds.length ? ds.filter((d) => d.regret <= NOISE).length / ds.length : 1,
    avgRegret: ds.length ? ds.reduce((a, d) => a + d.regret, 0) / ds.length : 0,
    blunders: ds.filter((d) => d.regret > BLUNDER).length,
    gameLosing: ds.filter((d) => d.gameLosing).length,
    coachAgree: withCoach.length ? withCoach.filter((d) => d.coachRegret! <= NOISE).length / withCoach.length : undefined,
    byCategory: cats,
    worst: [...ds].sort((a, b) => b.regret - a.regret).filter((d) => d.regret > NOISE).slice(0, 5),
  };
}

export interface ReviewSpec {
  decks: [DeckList, DeckList];
  seed: number;
  first?: PlayerId;
  agents: [Agent, Agent];
  agentNames?: [string, string];
}

/** Replay a game with the given agents and review it. */
export async function reviewGame(spec: ReviewSpec, opts: ReviewOptions = {}): Promise<GameReview> {
  const t0 = Date.now();
  const seats = opts.seats ?? [0, 1];
  const shared = { n: 0, lastTurn: -1 };
  const ra = [0, 1].map((p) => new ReviewAgent(spec.agents[p], p as PlayerId, seats.includes(p as PlayerId), opts, spec.seed, shared)) as [ReviewAgent, ReviewAgent];
  const g = Game.create(spec.decks, ra, { seed: spec.seed, first: spec.first, log: false });
  const s = await g.run();
  const timeline = [...ra[0].timeline, ...ra[1].timeline].sort((a, b) => a.turn - b.turn);
  const swings = timeline
    .slice(1)
    .map((t, k) => ({ turn: timeline[k].turn, delta: t.v - timeline[k].v, active: (timeline[k].turn % 2 === 1 ? s.first : 1 - s.first) as PlayerId }))
    .filter((x) => Math.abs(x.delta) < 5000)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
  const decisions = [...ra[0].out, ...ra[1].out].sort((a, b) => a.turn - b.turn || a.i - b.i);
  return {
    version: 1,
    seed: spec.seed,
    first: s.first,
    winner: s.winner,
    reason: s.winReason,
    turns: s.turn,
    names: [s.players[0].name, s.players[1].name],
    rollouts: opts.rollouts ?? DEFAULT_ROLLOUTS,
    seats: seats.map((p) => summarizeSeat(p, s.players[p].name, spec.agentNames?.[p] ?? spec.agents[p].name, ra[p].out)),
    timeline,
    swings,
    decisions,
    ms: Date.now() - t0,
  };
}

/**
 * An agent that replays recorded choices (a human's game). Falls back to `fallback` if the record runs out.
 * `choosesPayment` must match the recording (a practice replay's `payChoice`), or the choices won't line up.
 */
export class ScriptedAgent implements Agent {
  private k = 0;
  constructor(
    public name: string,
    private choices: number[][],
    private fallback: Agent,
    public choosesPayment = false,
  ) {}
  async decide(g: Game, d: Decision): Promise<number[]> {
    if (this.k < this.choices.length) return this.choices[this.k++];
    return this.fallback.decide(g, d);
  }
}
