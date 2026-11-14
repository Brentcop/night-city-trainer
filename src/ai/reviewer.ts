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
import { Game } from '../engine/engine';
import { CARD_BY_ID } from '../engine/cards';
import type { Action, Agent, Decision, DeckList, PlayerId, Reaction } from '../engine/types';
import { HeuristicAgent, hideInfo, isUnknownCall, standardError } from './heuristic';
import { BEST_PROFILES } from './archetype';
import { clampPlayOut, DECIDED_EVAL, DEFAULT_WEIGHTS, evaluate } from './eval';
import { makeWorlds, playOut, playOutValue, type World } from './playOut';

/** Decisions closer than this to the best move count as accurate (oracle noise floor, see validation in reports). */
export const NOISE = 4;
/** Regret above this is a blunder (≈ 0.4 Gigs). */
export const BLUNDER = 15;
/** Regret is capped here (3 Gigs) so a single game-ending line doesn't swamp the averages. */
export const CAP = 120;
/**
 * Play-outs per candidate, in shared worlds (common random numbers). Never checked against an independent oracle: the
 * reports/review-validate-*.md runs show the reviewer separates the tiers and catches injected random moves, but with
 * the bots' own evaluation. The position benchmark (scripts/benchmark.ts, docs/BOT_TOOLKIT.md §10) scores bots by
 * play-outs to the end of the game instead.
 */
const DEFAULT_ROLLOUTS = 8;

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
  /** the gap before the cap (eval points): the Game review tests noise on it (absent in reviews stored before it) */
  raw?: number;
  gameLosing: boolean; // the move made loses the game in the oracle's play-outs where the best one doesn't
  coachRegret?: number;
  /**
   * The raw measurements the Game review's ratings read (src/lib/gameReview.ts rateOracle); all optional, so reviews
   * stored before them still read. `at`: this seat's answer number in the game (its index among the seat's recorded
   * choices, which links a decision to the coach's record of it); `seq`: the decision's place among every decision of
   * both seats.
   */
  at?: number;
  seq?: number;
  /** the move made is the oracle's best (not just within the noise of it) */
  top?: boolean;
  /** paired standard error of the gap (best − move made) over the shared worlds, eval points, before the cap */
  se?: number;
  /** every other graded option's gap below the oracle's best and its paired SE, eval points, smallest gap first */
  others?: [number, number][];
  /**
   * The quick 1-ply screen's first choice (main phase only): its gap below the oracle's best and the paired SE, and the
   * move made's place in the screen's order (0 = its first choice, -1 = not in its shortlist).
   */
  screen?: { gap: number; se: number; chosenRank: number };
  /** every candidate is within reach of a won or lost game: differences between moves mean nothing (regret 0) */
  decided?: boolean;
  /** the gap, SE and game-losing flag were confirmed on this many fresh worlds (ReviewOptions.confirm) */
  confirmed?: number;
  /**
   * A confirmed decision's screening figures, before the confirmation replaced them: the Game review keeps them, since
   * whether a move is confirmed is a rating rule and a later rule may rate it from these (src/lib/gameReview.ts
   * rerateRecord). Kept only; nothing here reads them.
   */
  first?: Pick<DecisionReview, 'regret' | 'raw' | 'se' | 'gameLosing'>;
}

/** A decision the reviewer did not grade because it was graded already (ReviewOptions.skip): what the screen made of it. */
export interface SkippedDecision {
  player: PlayerId;
  at: number;
  seq: number;
  turn: number;
  /** the quick 1-ply screen's first choice and the move made's place in its order (-1 = not in its shortlist) */
  screenTop?: number;
  chosenRank?: number;
}

/** Every answer a seat gave, with its agent's payment, order and End turn flags (a ScriptedAgent needs them to line up). */
export interface SeatAnswers {
  choices: number[][];
  pay: boolean;
  order: boolean;
  /** the seat ended its turns by hand (confirmsEndTurn); absent in reviews stored before it existed: false */
  endTurn?: boolean;
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
  /** decisions left to an earlier grade (ReviewOptions.skip) */
  skipped?: SkippedDecision[];
  /** forced decisions (main phase or reaction with one option) per seat: not graded */
  forced?: [number, number];
  /** every answer of each seat (ReviewOptions.keepAnswers): replays the game with no bot thinking */
  answers?: [SeatAnswers, SeatAnswers];
  /** the seed the oracle's worlds were drawn from (ReviewOptions.oracleSeed; the game seed by default) */
  oracleSeed?: number;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Worlds (the hidden-information deal and the play-out bots' seeds) live with the play-out (playOut.ts).
export { makeWorlds, type World };

/** Every play-out score is clamped to ±TERMINAL, and a won or lost game counts as exactly ±TERMINAL (instead of the
 *  evaluation's ±win). Losing in 1 world of 8 then costs 1/8 of a game, and no position can score below an actual loss. */
const TERMINAL = DEFAULT_WEIGHTS.playOutClamp;
const LOST = -DECIDED_EVAL;
/** If every candidate is within this of a won or lost game, the game is already decided and moves are not graded. */
const DECIDED = 0.75 * TERMINAL;

/** Oracle value of an action for player p: average over play-outs in the given worlds (rest of turn + rival's full turn). */
export async function oracleValue(g: Game, p: PlayerId, a: Action, worlds: World[], wins = false): Promise<number> {
  return (await oracleDetail(g, p, a, worlds, wins)).v;
}

/** Oracle value plus the share of worlds in which the action led to a lost game. */
async function oracleDetail(g: Game, p: PlayerId, a: Action, worlds: World[], wins: boolean): Promise<Detail> {
  let sum = 0;
  let losses = 0;
  const per: number[] = [];
  for (const w of worlds) {
    const mk = (seed: number) => new HeuristicAgent({ lookahead: true, maxCandidates: 14, profiles: BEST_PROFILES, seed });
    const cg = g.clone([mk(w.a), mk(w.b)]);
    cg.s.rng = w.rng;
    hideInfo(cg, p);
    await playOut(cg, p, { action: a });
    const e = playOutValue(cg, p, DEFAULT_WEIGHTS, { wins });
    if (e < LOST) losses++;
    const c = clampPlayOut(e);
    per.push(c);
    sum += c;
  }
  return { v: sum / worlds.length, lossRate: losses / worlds.length, w: per };
}

/** One option's oracle value: the mean, the share of worlds lost, and the value in each world. */
interface Detail {
  v: number;
  lossRate: number;
  w: number[];
}

/** Oracle value of a reaction for the defending player p: resume the attack, finish the attacker's turn, play p's turn. */
async function oracleReaction(g: Game, p: PlayerId, rx: Reaction, worlds: World[], wins: boolean): Promise<Detail> {
  let sum = 0;
  let losses = 0;
  const per: number[] = [];
  const attacker = g.s.attack!.attacker;
  for (const w of worlds) {
    const mk = (seed: number) => new HeuristicAgent({ lookahead: true, maxCandidates: 14, profiles: BEST_PROFILES, seed });
    const cg = g.clone([mk(w.a), mk(w.b)]);
    cg.s.rng = w.rng;
    hideInfo(cg, p);
    await playOut(cg, p, { reaction: rx, attacker }); // the attacker finishes their turn, then our whole turn
    const e = playOutValue(cg, p, DEFAULT_WEIGHTS, { wins });
    if (e < LOST) losses++;
    const c = clampPlayOut(e);
    per.push(c);
    sum += c;
  }
  return { v: sum / worlds.length, lossRate: losses / worlds.length, w: per };
}

/**
 * Oracle values of the candidate options. Calls of face-down Legends the player can't tell apart are one move: each is
 * valued as the average over every unknown slot (in the same worlds), so no slot is graded on its hidden identity.
 */
async function gradeAll<T extends Action | Reaction>(g: Game, cand: number[], opts: T[], oracle: (a: T) => Promise<Detail>) {
  const vals = new Map<number, number>();
  const loss = new Map<number, number>();
  const per = new Map<number, number[]>();
  const unknown = opts.map((_, i) => i).filter((i) => isUnknownCall(g, opts[i]));
  let group: Detail | null = null;
  for (const i of cand) {
    let o: Detail;
    if (unknown.includes(i)) {
      if (!group) {
        let v = 0;
        let l = 0;
        let w: number[] = [];
        for (const k of unknown) {
          const x = await oracle(opts[k]);
          v += x.v;
          l += x.lossRate;
          w = w.length ? w.map((y, j) => y + x.w[j]) : [...x.w];
        }
        group = { v: v / unknown.length, lossRate: l / unknown.length, w: w.map((y) => y / unknown.length) };
      }
      o = group;
    } else o = await oracle(opts[i]);
    vals.set(i, o.v);
    loss.set(i, o.lossRate);
    per.set(i, o.w);
  }
  return { vals, loss, per };
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** The raw measurements behind a grade (DecisionReview's optional fields), from the oracle's values in each world. */
function measures(vals: Map<number, number>, per: Map<number, number[]>, chosen: number, bestI: number, decided: boolean, screen?: { top: number; order: number[] }) {
  const pairedSe = (a: number, b: number) => standardError(per.get(a)!.map((x, k) => x - per.get(b)![k]));
  const bestV = vals.get(bestI)!;
  const others = [...vals.keys()]
    .filter((i) => i !== bestI)
    .map((i): [number, number] => [round2(bestV - vals.get(i)!), round2(pairedSe(bestI, i))])
    .sort((a, b) => a[0] - b[0]);
  const out: Pick<DecisionReview, 'top' | 'se' | 'others' | 'screen' | 'decided'> = {
    top: chosen === bestI,
    se: chosen === bestI ? 0 : round2(pairedSe(bestI, chosen)),
    others,
  };
  if (screen && vals.has(screen.top))
    out.screen = { gap: round2(bestV - vals.get(screen.top)!), se: screen.top === bestI ? 0 : round2(pairedSe(bestI, screen.top)), chosenRank: screen.order.indexOf(chosen) };
  if (decided) out.decided = true;
  return out;
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
    case 'playLegend':
      return 'unit'; // a Legend played to the field by paying its cost is played as a Unit (4.5)
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
  /** score the start-of-turn win each play-out stops just before (playOutValue, BOT-1); off by default (grades unchanged) */
  rolloutWins?: boolean;
  /** the seed the oracle's worlds are drawn from (default: the game seed, as before; a re-run with another seed checks stability) */
  oracleSeed?: number;
  /** decisions graded already (the coach's grades from play): not played out again, only screened (GameReview.skipped) */
  skip?: (seat: PlayerId, at: number) => boolean;
  /** keep every answer of both seats (GameReview.answers) */
  keepAnswers?: boolean;
  /**
   * Confirm the decisions `flag` picks (the Game review: those it would rate Slip or worse) on `worlds` fresh worlds from
   * a separate seed stream: the move made and the best one found are played out again and the gap, its SE and the
   * game-losing flag are taken from the fresh play-outs only (the screening value of the best is the maximum over every
   * candidate in the same worlds, so it is biased upward). Other decisions are measured exactly as without it.
   */
  confirm?: { worlds: number; flag: (d: DecisionReview) => boolean };
}

/** Wraps a seat's agent: plays exactly as it would, and reviews its main-phase decisions on the side. */
class ReviewAgent implements Agent {
  name: string;
  choosesPayment?: boolean;
  choosesOrder?: boolean;
  confirmsEndTurn?: boolean;
  out: DecisionReview[] = [];
  timeline: { turn: number; v: number }[] = [];
  skipped: SkippedDecision[] = [];
  forced = 0;
  answers: number[][] = [];
  private rnd: () => number;
  /** the confirmation worlds' own stream, so confirming never moves the other decisions' worlds */
  private confirmRnd: () => number;
  private count = 0;
  /** this seat's answers so far (the `at` of the decision being made) */
  private at = 0;
  constructor(
    public inner: Agent,
    public seat: PlayerId,
    public review: boolean,
    private opts: ReviewOptions,
    seed: number,
    private shared: { n: number; lastTurn: number; seq: number },
  ) {
    this.name = inner.name;
    this.choosesPayment = inner.choosesPayment;
    this.choosesOrder = inner.choosesOrder;
    this.confirmsEndTurn = inner.confirmsEndTurn;
    this.rnd = rng(seed * 31 + seat * 7 + 1);
    this.confirmRnd = rng(seed * 31 + seat * 7 + 1 + 0x5bd1e995);
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    const at = this.at++;
    const pick = await this.decideAt(g, d, at);
    if (this.opts.keepAnswers) this.answers.push([...pick]);
    return pick;
  }

  /** The seat's own move, checked to be one of the options before anything reads it (a record can hand back anything). */
  private async play(g: Game, d: Decision): Promise<number[]> {
    return legalAnswer(await this.inner.decide(g, d), d, g, this.inner.name === 'You' ? 'your' : `${this.inner.name}'s`);
  }

  private async decideAt(g: Game, d: Decision, at: number): Promise<number[]> {
    if (d.kind === 'action' && this.shared.lastTurn !== g.s.turn) {
      this.shared.lastTurn = g.s.turn;
      this.timeline.push({ turn: g.s.turn, v: evaluate(g, 0) });
    }
    if (this.opts.shouldStop?.()) return this.play(g, d);
    const gradable = (d.kind === 'action' || (d.kind === 'reaction' && !!g.s.attack)) && d.options.length >= 2;
    if (this.review && (d.kind === 'action' || d.kind === 'reaction') && d.options.length === 1) this.forced++;
    if (this.review && gradable && this.opts.skip?.(this.seat, at)) return this.skipOne(g, d, at);
    if (this.review && d.kind === 'reaction' && d.options.length >= 2 && g.s.attack) return this.reviewReaction(g, d, at);
    if (!this.review || d.kind !== 'action' || d.options.length < 2) return this.play(g, d);
    // the move actually made (decide first: oracle play-outs are clones and never touch the real game)
    const pick = await this.play(g, d);
    const seq = this.shared.seq++;
    const chosen = pick[0];
    const actions = d.options.map((o) => o.action as Action);
    const cand = new Set<number>([chosen]);
    const screen = new HeuristicAgent({ profiles: BEST_PROFILES });
    await screen.decide(g, d);
    const screenOrder = screen.lastAlternatives.map((x) => x.index);
    for (const x of screen.lastAlternatives.slice(0, this.opts.screen ?? 4)) cand.add(x.index);
    // a sell: also grade "don't sell now" — the best move among the non-sell options (screened the same way)
    if (actions[chosen].type === 'sell') {
      const keep = actions.map((_a, i) => i).filter((i) => actions[i].type !== 'sell');
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
    const { vals, loss, per } = await gradeAll(g, [...cand], actions, (a) => oracleDetail(g, this.seat, a, worlds, this.opts.rolloutWins ?? false));
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
      raw: round2(Math.max(0, raw)),
      gameLosing: lostLine,
      coachRegret: cr !== undefined ? Math.max(0, cr) : undefined,
      at,
      seq,
      ...measures(vals, per, chosen, bestI, decided, screenOrder.length ? { top: screenOrder[0], order: screenOrder } : undefined),
    });
    await this.confirmLast(g, actions, chosen, bestI, decided, (a, w) => oracleDetail(g, this.seat, a, w, this.opts.rolloutWins ?? false));
    this.shared.n++;
    this.opts.onProgress?.(this.shared.n);
    return pick;
  }

  /** A decision graded already: play the move, and keep only what the quick screen made of it (for the rating's checks). */
  private async skipOne(g: Game, d: Decision, at: number): Promise<number[]> {
    const pick = await this.play(g, d);
    const seq = this.shared.seq++;
    const entry: SkippedDecision = { player: this.seat, at, seq, turn: g.s.turn };
    if (d.kind === 'action') {
      const screen = new HeuristicAgent({ profiles: BEST_PROFILES });
      await screen.decide(g, d);
      const order = screen.lastAlternatives.map((x) => x.index);
      if (order.length) {
        entry.screenTop = order[0];
        entry.chosenRank = order.indexOf(pick[0]);
      }
    }
    this.skipped.push(entry);
    this.shared.n++;
    this.opts.onProgress?.(this.shared.n);
    return pick;
  }

  /** Reactions (blocks, reaction-time calls and programs, or letting the attack through), graded like main-phase moves. */
  private async reviewReaction(g: Game, d: Decision, at: number): Promise<number[]> {
    const pick = await this.play(g, d);
    const seq = this.shared.seq++;
    const chosen = pick[0];
    const rxs = d.options.map((o) => o.action as Reaction);
    // every option is graded (unknown Calls collapse into one, so this stays small)
    const cand = rxs.map((_, i) => i);
    let coachI: number | undefined;
    if (this.opts.withCoach && this.opts.coach) [coachI] = await this.opts.coach().decide(g, d);
    const worlds = makeWorlds(this.opts.rollouts ?? DEFAULT_ROLLOUTS, this.rnd);
    const { vals, loss, per } = await gradeAll(g, cand, rxs, (r) => oracleReaction(g, this.seat, r, worlds, this.opts.rolloutWins ?? false));
    const { bestI, decided } = this.record(g, d, chosen, vals, loss, per, coachI, reactionCategory(rxs[chosen]), at, seq);
    await this.confirmLast(g, rxs, chosen, bestI, decided, (r, w) => oracleReaction(g, this.seat, r, w, this.opts.rolloutWins ?? false));
    this.shared.n++;
    this.opts.onProgress?.(this.shared.n);
    return pick;
  }

  /**
   * ReviewOptions.confirm: the decision just recorded, when flagged, measured again on fresh worlds (the move made against
   * the best one found only). Its regret, raw gap, SE and game-losing flag come from the fresh play-outs.
   */
  private async confirmLast<T extends Action | Reaction>(g: Game, opts: T[], chosen: number, bestI: number, decided: boolean, oracle: (o: T, w: World[]) => Promise<Detail>) {
    const c = this.opts.confirm;
    const rec = this.out[this.out.length - 1];
    if (!c || !rec || decided || chosen === bestI || !c.flag(rec)) return;
    const worlds = makeWorlds(c.worlds, this.confirmRnd);
    const { vals, loss, per } = await gradeAll(g, [bestI, chosen], opts, (o) => oracle(o, worlds));
    const raw = vals.get(bestI)! - vals.get(chosen)!;
    rec.first = { regret: rec.regret, raw: rec.raw, se: rec.se, gameLosing: rec.gameLosing };
    rec.regret = Math.min(CAP, Math.max(0, raw));
    rec.raw = round2(Math.max(0, raw));
    rec.se = round2(standardError(per.get(bestI)!.map((x, k) => x - per.get(chosen)![k])));
    rec.gameLosing = loss.get(chosen)! - loss.get(bestI)! >= 0.25;
    rec.confirmed = c.worlds;
  }

  private record(g: Game, d: Decision, chosen: number, vals: Map<number, number>, loss: Map<number, number>, per: Map<number, number[]>, coachI: number | undefined, category: Category, at: number, seq: number): { bestI: number; decided: boolean } {
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
      raw: round2(Math.max(0, raw)),
      gameLosing: !decided && loss.get(chosen)! - loss.get(bestI)! >= 0.25,
      coachRegret: cr !== undefined ? Math.max(0, cr) : undefined,
      at,
      seq,
      ...measures(vals, per, chosen, bestI, decided),
    });
    return { bestI, decided };
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
  const shared = { n: 0, lastTurn: -1, seq: 0 };
  const oracleSeed = opts.oracleSeed ?? spec.seed;
  const ra = [0, 1].map((p) => new ReviewAgent(spec.agents[p], p as PlayerId, seats.includes(p as PlayerId), opts, oracleSeed, shared)) as [ReviewAgent, ReviewAgent];
  const g = Game.create(spec.decks, ra, { seed: spec.seed, first: spec.first, log: false });
  const s = await g.run();
  const timeline = [...ra[0].timeline, ...ra[1].timeline].sort((a, b) => a.turn - b.turn);
  const swings = timeline
    .slice(1)
    .map((t, k) => ({ turn: timeline[k].turn, delta: t.v - timeline[k].v, active: (timeline[k].turn % 2 === 1 ? s.first : 1 - s.first) as PlayerId }))
    .filter((x) => Math.abs(x.delta) < DECIDED_EVAL)
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
    ...(opts.skip ? { skipped: [...ra[0].skipped, ...ra[1].skipped].sort((a, b) => a.seq - b.seq) } : {}),
    forced: [ra[0].forced, ra[1].forced],
    ...(opts.keepAnswers ? { answers: [answersOf(ra[0]), answersOf(ra[1])] as [SeatAnswers, SeatAnswers] } : {}),
    ...(opts.oracleSeed !== undefined ? { oracleSeed } : {}),
  };
}

const answersOf = (a: ReviewAgent): SeatAnswers => ({ choices: a.answers, pay: !!a.choosesPayment, order: !!a.choosesOrder, ...(a.confirmsEndTurn ? { endTurn: true } : {}) });

/**
 * A recorded game that this code does not replay as it was played: a recorded answer is not one of the options of the
 * decision asked, the record runs out before the game ends (or is left over after it), or the replay ends differently.
 * `message` is a plain sentence for the player (the review screens and scripts/review.ts show it as it is).
 */
export class ReplayDiverged extends Error {
  constructor(why: string) {
    super(why);
    this.name = 'ReplayDiverged';
  }
}

/** The sentence a refused replay starts with; `detail` says where it parted from the record. */
export const divergedText = (detail: string) =>
  `This game can't be reviewed: replaying its recorded moves with this version of the bots and rules engine gives a different game (${detail}).`;

/** `pick` when it is a legal answer to `d` (whole option indices, in range, none twice), else a ReplayDiverged. */
export function legalAnswer(pick: unknown, d: Decision, g: Game, whose: string): number[] {
  const ok = Array.isArray(pick) && pick.every((i) => Number.isInteger(i) && i >= 0 && i < d.options.length) && new Set(pick).size === pick.length;
  if (!ok) throw new ReplayDiverged(divergedText(`at turn ${g.s.turn}, ${whose} recorded answer is not one of the choices offered`));
  return pick as number[];
}

/**
 * An agent that replays recorded choices (a human's game). Every answer is checked against the decision asked (a
 * ReplayDiverged when it is not one of its options). When the record runs out it hands over to `fallback`; with no
 * fallback (null: the Game review's strict replay) that is a ReplayDiverged too, since the game went on past the record.
 * `choosesPayment`, `choosesOrder` and `confirmsEndTurn` must match the recording (a practice replay's `payChoice`,
 * `orderChoice` and `endTurnClick`), or the choices won't line up. `whose` names the seat in a refusal ("your").
 */
export class ScriptedAgent implements Agent {
  private k = 0;
  constructor(
    public name: string,
    private choices: number[][],
    private fallback: Agent | null,
    public choosesPayment = false,
    public choosesOrder = false,
    public confirmsEndTurn = false,
    private whose = name === 'You' ? 'your' : `${name}'s`,
  ) {}
  /** recorded answers not used (yet) */
  get left(): number {
    return this.choices.length - this.k;
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    if (this.k < this.choices.length) return legalAnswer(this.choices[this.k++], d, g, this.whose);
    if (!this.fallback) throw new ReplayDiverged(divergedText(`at turn ${g.s.turn}, ${this.whose} recorded moves ran out before the game ended`));
    return this.fallback.decide(g, d);
  }
}
