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
import type { Action, Agent, Decision, DeckList, GameState, PlayerId, Reaction } from '../engine/types';
import { stateHash } from '../lib/stateHash';
import { optionName } from '../lib/coachWords';
import { HeuristicAgent, hideInfo, isUnknownCall, standardError } from './heuristic';
import { BEST_PROFILES } from './archetype';
import { TIER_SETTINGS } from './tiers';
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
  | 'react: ability'
  | 'mulligan'
  | 'gig dice';

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
  /**
   * A costly rating checked with a stronger continuation (ReviewOptions.hardCheck, 2026-11-25): the move made against the
   * best one found, played out on `worlds` fresh worlds with the Hard bot on both seats (eval points, as `regret` …). The
   * Game review rates the move from these when they are present (src/lib/gameReview.ts oracleMeasured).
   */
  hard?: { worlds: number; regret: number; raw: number; se: number; gameLosing: boolean };
}

/**
 * A decision the reviewer leaves unrated on purpose (2026-11-25): the mulligan. Its only measure was whole games played
 * out for each answer and scored by the result: on 480 mulligans the paired SE was about 5.7 Gigs, 87% came out "no clear
 * difference", and its Blunders did not follow skill (docs/REVIEW_2026-11-25.md R3). Listed, never counted.
 */
export interface UnratedDecision {
  player: PlayerId;
  at: number;
  seq: number;
  turn: number;
  category: Category;
  /** the move made, by the name the board shows (Keep hand / Mulligan) */
  chosen: string;
}

/**
 * A decision whose grading threw (a bug in the oracle or a card's play-out, never the move itself: the move is played
 * before it is graded). It is not counted and the review carries on; the error's message is kept for the log.
 */
export interface FailedDecision {
  player: PlayerId;
  at: number;
  seq: number;
  turn: number;
  category: Category;
  chosen: string;
  /** the error's message */
  reason: string;
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
  /** decisions left unrated on purpose (the mulligan): listed, not counted (absent when none) */
  unrated?: UnratedDecision[];
  /** decisions whose grading threw: not counted (absent when none) */
  failed?: FailedDecision[];
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

/** The oracle's play-out bots: Medium-like (one step ahead, the best profiles), on both seats. */
const oracleBot = (seed: number): Agent => new HeuristicAgent({ lookahead: true, maxCandidates: 14, profiles: BEST_PROFILES, seed });

/**
 * The stronger continuation a costly rating is checked with (ReviewOptions.hardCheck, 2026-11-25): the Hard bot's own
 * settings (src/ai/tiers.ts TIER_SETTINGS.hard), quiet like every play-out copy.
 */
const hardBot = (seed: number): Agent => {
  const { profiles: _p, ...rest } = TIER_SETTINGS.hard;
  return new HeuristicAgent({ ...rest, profiles: BEST_PROFILES, seed, quiet: true });
};

/** Oracle value plus the share of worlds in which the action led to a lost game (`mk`: the play-out bots). */
async function oracleDetail(g: Game, p: PlayerId, a: Action, worlds: World[], wins: boolean, mk: (seed: number) => Agent = oracleBot): Promise<Detail> {
  let sum = 0;
  let losses = 0;
  const per: number[] = [];
  for (const w of worlds) {
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
async function oracleReaction(g: Game, p: PlayerId, rx: Reaction, worlds: World[], wins: boolean, mk: (seed: number) => Agent = oracleBot): Promise<Detail> {
  let sum = 0;
  let losses = 0;
  const per: number[] = [];
  const attacker = g.s.attack!.attacker;
  for (const w of worlds) {
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

/**
 * Oracle values of a Gig choice's candidate options (each played out for the rest of the turn and the next one). Until
 * 2026-11-25 mulligans were valued here too, by whole games played out; they are no longer rated (UnratedDecision).
 */
async function gradeAllChoice(g: Game, p: PlayerId, cand: number[], worlds: World[], wins: boolean, d: Decision) {
  const vals = new Map<number, number>();
  const loss = new Map<number, number>();
  const per = new Map<number, number[]>();
  for (const i of cand) {
    const detail = await oracleGigChoice(g, p, i, d, worlds, wins);
    vals.set(i, detail.v);
    loss.set(i, detail.lossRate);
    per.set(i, detail.w);
  }
  return { vals, loss, per };
}

/**
 * A change the oracle makes to a copy outside a decision, followed as the engine follows the same change in a real
 * game: the effects it triggers resolve (10.12–10.14) and the state is checked, as `mainLoop` does after the action whose
 * effect made it. Without this a triggered effect stays pending and the next copy a bot makes throws (`clone()` refuses
 * pending effects): Meredith Stout's "When a Rival adjusts … friendly Gigs" did, for every graded Gig choice that
 * touched her controller's Gigs, until 2026-11-25. False when the game ended on the way (the play-out has nothing left).
 */
async function applyOutside(cg: Game, change: () => void): Promise<boolean> {
  try {
    change();
    await cg.resolvePending();
    cg.checkState();
    return true;
  } catch (e) {
    if (!(e instanceof GameOverSignal)) throw e;
    return false;
  }
}

/** How the engine changes a Gig for a gigValue decision: "set a Gig to another Gig's value" (tag setGig) is 'set', every other one 'adjust'. */
export const gigChangeKind = (d: Pick<Decision, 'tag'>): 'set' | 'adjust' => (d.tag === 'setGig' ? 'set' : 'adjust');

/** Gig dice oracle: clone, apply the gig value change (or leave unchanged) and what it triggers, then play out from here. */
async function oracleGigChoice(g: Game, p: PlayerId, optionIndex: number, d: Decision, worlds: World[], wins: boolean): Promise<Detail> {
  let sum = 0;
  let losses = 0;
  const per: number[] = [];
  const opt = d.options[optionIndex];
  const kind = gigChangeKind(d);
  for (const w of worlds) {
    const mk = (seed: number) => new HeuristicAgent({ lookahead: true, maxCandidates: 14, profiles: BEST_PROFILES, seed });
    const cg = g.clone([mk(w.a), mk(w.b)]);
    cg.s.rng = w.rng;
    hideInfo(cg, p);
    const going = opt.gig !== undefined && opt.n !== undefined ? await applyOutside(cg, () => cg.setGigValue(opt.gig!, opt.n!, p, kind)) : true;
    if (going) await playOut(cg, p, { rest: true });
    const e = playOutValue(cg, p, DEFAULT_WEIGHTS, { wins });
    if (e < LOST) losses++;
    const c = clampPlayOut(e);
    per.push(c);
    sum += c;
  }
  return { v: sum / worlds.length, lossRate: losses / worlds.length, w: per };
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** The best candidate's value and index (the first of equal ones), and whether the game is already decided (every option loses, or every option wins: differences between moves mean nothing). */
function bestOf(vals: Map<number, number>): { bestV: number; bestI: number; decided: boolean } {
  const bestV = Math.max(...vals.values());
  const decided = bestV <= -DECIDED || Math.min(...vals.values()) >= DECIDED;
  const bestI = [...vals.entries()].find(([, v]) => v === bestV)![0];
  return { bestV, bestI, decided };
}

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
  /** keep every answer of both seats (GameReview.answers) */
  keepAnswers?: boolean;
  /**
   * Confirm the decisions `flag` picks (the Game review's confirmFlag: those it would rate Slip or worse, and wide close
   * calls) on `worlds` fresh worlds from a separate seed stream: the move made and the best one found are played out
   * again and the gap, its SE and the game-losing flag are taken from the fresh play-outs only (the screening value of the
   * best is the maximum over every candidate in the same worlds, so it is biased upward). Other decisions are measured
   * exactly as without it.
   */
  confirm?: { worlds: number; flag: (d: DecisionReview) => boolean };
  /**
   * After the game, in a seat whose costly ratings (`flag`, after the confirmation: the Game review's Mistakes and
   * Blunders) number 1 to `maxFlags`, each such main-phase move or reaction is played out again, the move made against
   * the best one found, on `worlds` fresh worlds with the Hard bot on both seats (DecisionReview.hard). The oracle's
   * Medium-like continuation favours moves a Medium bot can follow up, which overstated a strong player's rare costly
   * ratings (docs/REVIEW_2026-11-25.md R2); capped at `maxFlags` a seat for its cost (reports/review-validity-2026-11-25.md).
   */
  hardCheck?: { worlds: number; maxFlags: number; flag: (d: DecisionReview) => boolean };
  /** called with the game's final state once it is over (the strict replay checks the position: src/sim/practiceReview.ts) */
  onEnd?: (s: GameState) => void;
}

/** Wraps a seat's agent: plays exactly as it would, and reviews its main-phase decisions on the side. */
class ReviewAgent implements Agent {
  name: string;
  choosesPayment?: boolean;
  choosesOrder?: boolean;
  confirmsEndTurn?: boolean;
  out: DecisionReview[] = [];
  timeline: { turn: number; v: number }[] = [];
  unrated: UnratedDecision[] = [];
  failed: FailedDecision[] = [];
  forced = 0;
  /** every answer of this seat (all of them: the strong check replays the game to its flagged decisions) */
  answers: number[][] = [];
  /** the best option found at each graded decision, by answer number */
  bestAt = new Map<number, number>();
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
    this.answers.push([...pick]);
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
    const isMulligan = d.kind === 'yesno' && d.tag === 'mulligan';
    const isGigDice = d.kind === 'gigValue';
    const gradable = (d.kind === 'action' || (d.kind === 'reaction' && !!g.s.attack) || isMulligan || isGigDice) && d.options.length >= 2;
    if (this.review && (d.kind === 'action' || d.kind === 'reaction') && d.options.length === 1) this.forced++;
    if (this.review && gradable && isMulligan) return this.leaveUnrated(g, d, at, 'mulligan');
    if (this.review && isGigDice && d.options.length >= 2 && g.pending.length === 0) return this.reviewChoice(g, d, at);
    if (this.review && d.kind === 'reaction' && d.options.length >= 2 && g.s.attack) return this.reviewReaction(g, d, at);
    if (!this.review || d.kind !== 'action' || d.options.length < 2) return this.play(g, d);
    // the move actually made (decide first: oracle play-outs are clones and never touch the real game)
    const pick = await this.play(g, d);
    const seq = this.shared.seq++;
    await this.graded(g, d, at, seq, pick[0], categoryOf(g, d.options[pick[0]].action as Action), () => this.gradeAction(g, d, at, seq, pick[0]));
    return pick;
  }

  /**
   * Grade one decision whose move is already made (`grade` records it in `out`), so that grading can never fail the
   * review: a throw leaves the decision out of `out` (anything it recorded is taken back) and lists it in `failed`, not
   * counted, with the error's message, and the game goes on. The move itself is never in question: it was played first.
   */
  private async graded(g: Game, d: Decision, at: number, seq: number, chosen: number, category: Category, grade: () => Promise<void>) {
    const kept = this.out.length;
    const count = this.count;
    try {
      await grade();
    } catch (e) {
      this.out.length = kept;
      this.count = count;
      this.failed.push({ player: this.seat, at, seq, turn: g.s.turn, category, chosen: d.options[chosen]?.label ?? String(chosen), reason: e instanceof Error ? e.message : String(e) });
    }
    this.shared.n++;
    this.opts.onProgress?.(this.shared.n);
  }

  /** A main-phase action: the move made, the quick screen's picks, the sell alternatives and passing, played out. */
  private async gradeAction(g: Game, d: Decision, at: number, seq: number, chosen: number) {
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
    const oracle = (a: Action, w: World[]) => oracleDetail(g, this.seat, a, w, this.opts.rolloutWins ?? false);
    const { vals, loss, per } = await gradeAll(g, [...cand], actions, (a) => oracle(a, worlds));
    const { bestV, bestI, decided } = bestOf(vals);
    this.bestAt.set(at, bestI);
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
    await this.confirmLast(g, actions, chosen, bestI, decided, oracle);
  }

  /** A decision left unrated on purpose (the mulligan, UnratedDecision): the move is played and listed, nothing is measured. */
  private async leaveUnrated(g: Game, d: Decision, at: number, category: Category): Promise<number[]> {
    const pick = await this.play(g, d);
    this.unrated.push({ player: this.seat, at, seq: this.shared.seq++, turn: g.s.turn, category, chosen: optionName(d, pick[0]) });
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
    await this.graded(g, d, at, seq, chosen, reactionCategory(rxs[chosen]), async () => {
      // every option is graded (unknown Calls collapse into one, so this stays small)
      const cand = rxs.map((_, i) => i);
      let coachI: number | undefined;
      if (this.opts.withCoach && this.opts.coach) [coachI] = await this.opts.coach().decide(g, d);
      const worlds = makeWorlds(this.opts.rollouts ?? DEFAULT_ROLLOUTS, this.rnd);
      const { vals, loss, per } = await gradeAll(g, cand, rxs, (r) => oracleReaction(g, this.seat, r, worlds, this.opts.rolloutWins ?? false));
      const { bestI, decided } = this.record(g, d, chosen, vals, loss, per, coachI, reactionCategory(rxs[chosen]), at, seq);
      await this.confirmLast(g, rxs, chosen, bestI, decided, (r, w) => oracleReaction(g, this.seat, r, w, this.opts.rolloutWins ?? false));
    });
    return pick;
  }

  /** A Gig dice choice (adjust, set or no change), graded like a reaction: each option played out from here. */
  private async reviewChoice(g: Game, d: Decision, at: number): Promise<number[]> {
    const pick = await this.play(g, d);
    const seq = this.shared.seq++;
    const chosen = pick[0];
    const category: Category = 'gig dice';
    await this.graded(g, d, at, seq, chosen, category, async () => {
      const cand = d.options.map((_, i) => i);
      let coachI: number | undefined;
      if (this.opts.withCoach && this.opts.coach) [coachI] = await this.opts.coach().decide(g, d);
      const worlds = makeWorlds(this.opts.rollouts ?? DEFAULT_ROLLOUTS, this.rnd);
      const { vals, loss, per } = await gradeAllChoice(g, this.seat, cand, worlds, this.opts.rolloutWins ?? false, d);
      const { bestI, decided } = this.record(g, d, chosen, vals, loss, per, coachI, category, at, seq);
      await this.confirmGap(chosen, bestI, decided, (w) => gradeAllChoice(g, this.seat, [bestI, chosen], w, this.opts.rolloutWins ?? false, d));
    });
    return pick;
  }

  /**
   * ReviewOptions.confirm for a move that is not the best found: the decision just recorded, when flagged, measured again
   * on fresh worlds (the move made against the best one found only). Its regret, raw gap, SE and game-losing flag come
   * from the fresh play-outs.
   */
  private async confirmGap(chosen: number, bestI: number, decided: boolean, grade: (w: World[]) => Promise<{ vals: Map<number, number>; loss: Map<number, number>; per: Map<number, number[]> }>) {
    const c = this.opts.confirm;
    const rec = this.out[this.out.length - 1];
    if (!c || !rec || decided || chosen === bestI || !c.flag(rec)) return;
    const worlds = makeWorlds(c.worlds, this.confirmRnd);
    const { vals, loss, per } = await grade(worlds);
    const raw = vals.get(bestI)! - vals.get(chosen)!;
    rec.first = { regret: rec.regret, raw: rec.raw, se: rec.se, gameLosing: rec.gameLosing };
    rec.regret = Math.min(CAP, Math.max(0, raw));
    rec.raw = round2(Math.max(0, raw));
    rec.se = round2(standardError(per.get(bestI)!.map((x, k) => x - per.get(chosen)![k])));
    rec.gameLosing = loss.get(chosen)! - loss.get(bestI)! >= 0.25;
    rec.confirmed = c.worlds;
  }

  /** ReviewOptions.confirm for an action or a reaction: a flagged move that is not the best found, confirmed by confirmGap. */
  private async confirmLast<T extends Action | Reaction>(g: Game, opts: T[], chosen: number, bestI: number, decided: boolean, oracle: (o: T, w: World[]) => Promise<Detail>) {
    await this.confirmGap(chosen, bestI, decided, (w) => gradeAll(g, [bestI, chosen], opts, (o) => oracle(o, w)));
  }

  private record(g: Game, d: Decision, chosen: number, vals: Map<number, number>, loss: Map<number, number>, per: Map<number, number[]>, coachI: number | undefined, category: Category, at: number, seq: number): { bestI: number; decided: boolean } {
    const { bestV, bestI, decided } = bestOf(vals);
    this.bestAt.set(at, bestI);
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

/** Thrown to end a replay once its last checked decision is passed. */
class ReplayDone extends Error {}

/**
 * ReviewOptions.hardCheck, once the game is over: in each reviewed seat whose costly ratings number 1 to `maxFlags`, its
 * costly main-phase moves and reactions are measured again with the Hard bot on both seats. The game is replayed from
 * the seats' recorded answers (no bot thinks) to each such decision, where the move made and the best one found are
 * played out on fresh worlds from a stream of the seat's own; the result is kept as DecisionReview.hard. A check that
 * throws leaves the move as the confirmation rated it.
 */
async function hardChecks(spec: ReviewSpec, ra: [ReviewAgent, ReviewAgent], opts: ReviewOptions, oracleSeed: number) {
  const h = opts.hardCheck;
  if (!h || h.worlds <= 0 || opts.shouldStop?.()) return;
  const todo = new Map<string, DecisionReview>();
  for (const a of ra) {
    if (!a.review) continue;
    const costly = a.out.filter(h.flag);
    if (!costly.length || costly.length > h.maxFlags) continue;
    for (const d of costly) if (d.category !== 'gig dice' && !d.decided && d.at !== undefined && a.bestAt.has(d.at)) todo.set(`${a.seat}:${d.at}`, d);
  }
  if (!todo.size) return;
  let left = todo.size;
  const streams = [0, 1].map((p) => rng(oracleSeed * 31 + p * 7 + 1 + 0x27d4eb2d));
  const seat = (a: ReviewAgent): Agent => {
    const script = new ScriptedAgent(a.name, a.answers, null, !!a.choosesPayment, !!a.choosesOrder, !!a.confirmsEndTurn);
    let k = 0;
    return {
      name: a.name,
      choosesPayment: a.choosesPayment,
      choosesOrder: a.choosesOrder,
      confirmsEndTurn: a.confirmsEndTurn,
      decide: async (g: Game, d: Decision) => {
        const at = k++;
        const rec = todo.get(`${a.seat}:${at}`);
        if (rec) {
          if (!opts.shouldStop?.()) await hardCheckOne(g, d, a, at, rec, h.worlds, streams[a.seat]!, opts.rolloutWins ?? false).catch(() => undefined);
          if (--left === 0) throw new ReplayDone();
        }
        return script.decide(g, d);
      },
    };
  };
  try {
    await Game.create(spec.decks, [seat(ra[0]), seat(ra[1])], { seed: spec.seed, first: spec.first, log: false }).run();
  } catch (e) {
    if (!(e instanceof ReplayDone)) throw e;
  }
}

/** One costly decision measured again with Hard play-outs (hardChecks): the best move found against the move made. */
async function hardCheckOne(g: Game, d: Decision, a: ReviewAgent, at: number, rec: DecisionReview, n: number, stream: () => number, wins: boolean) {
  const chosen = a.answers[at]![0]!;
  const best = a.bestAt.get(at)!;
  if (best === chosen) return;
  const worlds = makeWorlds(n, stream);
  const opts = d.options.map((o) => o.action as Action | Reaction);
  const graded =
    d.kind === 'reaction' && g.s.attack
      ? await gradeAll(g, [best, chosen], opts as Reaction[], (r) => oracleReaction(g, a.seat, r, worlds, wins, hardBot))
      : d.kind === 'action'
        ? await gradeAll(g, [best, chosen], opts as Action[], (x) => oracleDetail(g, a.seat, x, worlds, wins, hardBot))
        : null;
  if (!graded) return;
  const { vals, loss, per } = graded;
  const raw = vals.get(best)! - vals.get(chosen)!;
  rec.hard = {
    worlds: n,
    regret: Math.min(CAP, Math.max(0, raw)),
    raw: round2(Math.max(0, raw)),
    se: round2(standardError(per.get(best)!.map((x, k) => x - per.get(chosen)![k]))),
    gameLosing: loss.get(chosen)! - loss.get(best)! >= 0.25,
  };
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
  opts.onEnd?.(s);
  await hardChecks(spec, ra, opts, oracleSeed);
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
    ...(ra[0].unrated.length || ra[1].unrated.length ? { unrated: [...ra[0].unrated, ...ra[1].unrated].sort((a, b) => a.seq - b.seq) } : {}),
    ...(ra[0].failed.length || ra[1].failed.length ? { failed: [...ra[0].failed, ...ra[1].failed].sort((a, b) => a.seq - b.seq) } : {}),
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
 * `position` (a game the session ended off the board): the decision after `at` of these answers must be asked in the
 * position whose stateHash is `hash` (checked before that answer is used, or before `fallback` ends the game), else a
 * ReplayDiverged; `positionChecked` says whether the replay got there.
 */
export class ScriptedAgent implements Agent {
  private k = 0;
  /** the replay reached the decision `position.at` and its position matched */
  positionChecked = false;
  constructor(
    public name: string,
    private choices: number[][],
    private fallback: Agent | null,
    public choosesPayment = false,
    public choosesOrder = false,
    public confirmsEndTurn = false,
    private whose = name === 'You' ? 'your' : `${name}'s`,
    readonly position: { hash: string; at: number } | null = null,
  ) {}
  /** recorded answers not used (yet) */
  get left(): number {
    return this.choices.length - this.k;
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    const p = this.position;
    if (p && !this.positionChecked && this.k === p.at) {
      if (stateHash(g.s) !== p.hash) throw new ReplayDiverged(divergedText(`at turn ${g.s.turn} it reaches a different position from the one recorded`));
      this.positionChecked = true;
    }
    if (this.k < this.choices.length) return legalAnswer(this.choices[this.k++], d, g, this.whose);
    if (!this.fallback) throw new ReplayDiverged(divergedText(`at turn ${g.s.turn}, ${this.whose} recorded moves ran out before the game ended`));
    return this.fallback.decide(g, d);
  }
}
