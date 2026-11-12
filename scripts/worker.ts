// Worker thread: plays one game per message.
import { parentPort } from 'node:worker_threads';
import { Game } from '../src/engine/engine';
import { HeuristicAgent } from '../src/ai/heuristic';
import { RandomAgent } from '../src/ai/random';
import { makeTierBot } from '../src/ai/tiers';
import { DEFAULT_WEIGHTS } from '../src/ai/eval';
import { BEST_PROFILES, DEFAULT_PROFILES } from '../src/ai/archetype';
import { summarize, type PlayerSummary } from '../src/analysis/summarize';
import { aggregateGame, type DecisionAggregate } from '../src/analysis/decisions';
import { aggregateSynergyGame, type SynergyAggregate } from '../src/analysis/synergies';
import { DecisionRecorder, type DecisionRecord } from '../src/engine/telemetry';
import type { Agent, Decision, DeckList } from '../src/engine/types';
import { holdCredit, packageFacts, seatPackages } from '../src/ai/packages';
import { handFeatures, plainRuleMulligan, type HandFeatures, type MulliganRule } from '../src/ai/mulligan';

export interface MatchJob {
  a: DeckList;
  b: DeckList;
  seed: number;
  first: 0 | 1;
  bot: string;
  /** optional per-seat agent specs (override bot) */
  agentA?: AgentSpec;
  agentB?: AgentSpec;
  /** record telemetry and return per-player summaries */
  trace?: boolean;
  /** record decision telemetry (src/engine/telemetry.ts) and return this game's aggregate (src/analysis/decisions.ts) */
  decisions?: boolean;
  /** with `decisions`: also return the raw records (for a sample dump) */
  rawDecisions?: boolean;
  /** observe the synergy packages (board snapshots on the recorder) and return this game's aggregate (src/analysis/synergies.ts) */
  synergies?: boolean;
  /**
   * scripts/package-scoring.ts: before every decision of seat A (seat 0), ask a shadow bot built from this spec, in the
   * same state with the same random stream, and count where it would choose differently (by decision kind/tag). The
   * game is the one seat A plays; the shadow only observes.
   */
  shadowA?: AgentSpec;
  /** scripts/package-scoring.ts: count seat A's sells and give-up choices of package pieces whose partner it could still get */
  piecesA?: boolean;
  /**
   * scripts/mulligan-check.ts: force seat A's (seat 0's) opening-hand decision ('keep' or 'mulligan'; omitted = its bot
   * decides) and return the hand's features with the bot's own verdict (`opening`). Nothing else in the game changes.
   */
  mulliganA?: 'keep' | 'mulligan';
  /** with or without mulliganA: return seat A's opening-hand features (`opening`) */
  openingA?: boolean;
}
export interface AgentSpec {
  lookahead?: boolean;
  weights?: Record<string, number>;
  noise?: number;
  deep?: number;
  impact?: number;
  deepAttacks?: number;
  sellLookahead?: number;
  deepReactions?: number;
  /** BOT-1 (HeuristicOptions.rolloutWins): play-outs score the next start-of-turn win; main-phase rollouts clamped */
  rolloutWins?: boolean;
  /** BOT-2 (HeuristicOptions.deepWorlds): main-phase rollouts averaged over N shared worlds */
  deepWorlds?: number;
  /** BOT-4 (HeuristicOptions.sellSearch): "don't sell" and the two most sellable cards compared by the deep rollout */
  sellSearch?: boolean;
  /** BOT-5 (HeuristicOptions.turnPlan / turnPlanNodes / turnPlanBeam): candidates valued by the best line of the turn */
  turnPlan?: number;
  turnPlanNodes?: number;
  turnPlanBeam?: number;
  /** BOT-6 (HeuristicOptions.mulligan): which opening-hand rule */
  mulligan?: MulliganRule;
  /** 'default' = DEFAULT_PROFILES, 'best' = BEST_PROFILES (tuned), or an explicit profile table */
  profiles?: 'default' | 'best' | Record<string, Record<string, number>>;
}
export interface MatchResult {
  a: string;
  b: string;
  seed: number;
  first: 0 | 1;
  /** null only together with `error` */
  winner: 0 | 1 | 'tie' | null;
  reason: string;
  turns: number;
  overtime: boolean;
  gigs: [number, number];
  error?: string;
  summaries?: [PlayerSummary, PlayerSummary];
  /** decision telemetry for this game, aggregated in the worker so only counts cross to the main thread */
  decisions?: DecisionAggregate;
  /** records in this game and their size as JSON, raw vs aggregated (bytes) */
  decisionSize?: { records: number; rawBytes: number; aggregateBytes: number };
  /** the raw records, only when the job asked for them */
  decisionRecords?: DecisionRecord[];
  /** synergy observation for this game, aggregated in the worker */
  synergies?: SynergyAggregate;
  /** board snapshots and card sightings this game recorded, and their size as JSON (bytes) */
  synergySize?: { boards: number; sightings: number; rawBytes: number; aggregateBytes: number };
  /** with `shadowA`: per decision kind/tag, [decisions, decisions where the shadow chose differently] */
  shadow?: Record<string, [number, number]>;
  /** with `piecesA`: seat A's package-piece sells and give-ups (see PieceCounts) */
  pieces?: PieceCounts;
  /** with `openingA` / `mulliganA`: seat A's opening hand and what was done with it */
  opening?: OpeningHand;
}

/** Seat A's opening hand (before any mulligan), the bot's own verdict and the decision played (scripts/mulligan-check.ts). */
export interface OpeningHand extends HandFeatures {
  /** the bot's own mulligan verdict on this hand (its `mulligan` option, card impact included) */
  rule: boolean;
  /** the plain rule's verdict (`mulligan: 'plain'`: no card-impact keep) */
  plain: boolean;
  /** what was played: the forced choice, or the rule's */
  mulligan: boolean;
}

/** Seat A's agent with its opening-hand decision recorded and optionally forced. Plays exactly as `inner` otherwise. */
class MulliganProbe implements Agent {
  name: string;
  opening: OpeningHand | null = null;
  constructor(
    private inner: Agent,
    private bot: HeuristicAgent,
    private force: 'keep' | 'mulligan' | undefined,
  ) {
    this.name = inner.name;
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    if (d.kind === 'yesno' && d.tag === 'mulligan' && this.opening === null) {
      const rule = this.bot.wantsMulligan(g, d.player);
      const mulligan = this.force ? this.force === 'mulligan' : rule;
      this.opening = { ...handFeatures(g, d.player), rule, plain: plainRuleMulligan(g, d.player), mulligan };
      if (this.force) return [mulligan ? 0 : 1];
    }
    return this.inner.decide(g, d);
  }
}

/** Seat A's sells and give-up choices (discard, trash, bottom-deck from hand), and how many were package pieces with a partner still obtainable. */
export interface PieceCounts {
  sells: number;
  /** sells where at least one sellable card was such a piece */
  sellsWithPieceOption: number;
  pieceSells: number;
  giveUps: number;
  giveUpsWithPieceOption: number;
  pieceGiveUps: number;
}

const GIVE_UP_TAGS = new Set(['discard', 'trash', 'bottom', 'bottomdeck']);

/** Seat A's agent, observed: shadow decisions and package-piece counts (scripts/package-scoring.ts). Plays exactly as `inner`. */
class ObservedAgent implements Agent {
  name: string;
  shadow: Record<string, [number, number]> = {};
  pieces: PieceCounts = { sells: 0, sellsWithPieceOption: 0, pieceSells: 0, giveUps: 0, giveUpsWithPieceOption: 0, pieceGiveUps: 0 };
  constructor(
    private inner: HeuristicAgent,
    private shadowAgent: HeuristicAgent | null,
    private countPieces: boolean,
  ) {
    this.name = inner.name;
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    let alt: number[] | null = null;
    if (this.shadowAgent) {
      this.shadowAgent.syncFrom(this.inner);
      alt = await this.shadowAgent.decide(g, d);
    }
    const piece = this.countPieces ? this.pieceTest(g, d.player) : null;
    const r = await this.inner.decide(g, d);
    if (alt) {
      const key = `${d.kind}/${d.tag ?? ''}`;
      const c = (this.shadow[key] ??= [0, 0]);
      c[0]++;
      if (alt.join(',') !== r.join(',')) c[1]++;
    }
    if (piece) {
      const pick = (i: number) => d.options[i];
      if (d.kind === 'action') {
        const a = pick(r[0])?.action;
        if (a && a.type === 'sell') {
          this.pieces.sells++;
          if (d.options.some((o) => o.action?.type === 'sell' && piece(g.c(o.action.uid).defId))) this.pieces.sellsWithPieceOption++;
          if (piece(g.c(a.uid).defId)) this.pieces.pieceSells++;
        }
      } else if (d.kind === 'card' && GIVE_UP_TAGS.has(d.tag ?? '')) {
        const own = (u: number | undefined) => u !== undefined && g.c(u).controller === d.player && g.c(u).zone === 'hand';
        const chosen = r.map((i) => pick(i)?.uid).filter(own);
        if (chosen.length) {
          this.pieces.giveUps++;
          if (d.options.some((o) => own(o.uid) && piece(g.c(o.uid!).defId))) this.pieces.giveUpsWithPieceOption++;
          if (chosen.some((u) => piece(g.c(u!).defId))) this.pieces.pieceGiveUps++;
        }
      }
    }
    return r;
  }
  /**
   * A card of p's is a scarce package piece whose partner p can still get (judged before the decision): its hold credit
   * is at least ¼, i.e. at most 4 obtainable copies do its job in a `requires` package, at most 2 in a `helps` one.
   */
  private pieceTest(g: Game, p: 0 | 1): ((defId: string) => boolean) | null {
    const pkgs = seatPackages(g, p);
    if (!pkgs.length) return () => false;
    const facts = packageFacts(g, p, pkgs);
    return (id) => holdCredit(facts, id) >= 0.25;
  }
}

function fromSpec(spec: AgentSpec, seed: number): HeuristicAgent {
  return new HeuristicAgent({ lookahead: spec.lookahead ?? true, weights: spec.weights ? ({ ...DEFAULT_WEIGHTS, ...spec.weights } as any) : undefined, noise: spec.noise ?? 0.15, seed, deep: spec.deep ?? 0, impact: spec.impact ?? 0, deepAttacks: spec.deepAttacks ?? 0, sellLookahead: spec.sellLookahead ?? 0, deepReactions: spec.deepReactions ?? 0, rolloutWins: spec.rolloutWins ?? false, deepWorlds: spec.deepWorlds ?? 0, sellSearch: spec.sellSearch ?? false, turnPlan: spec.turnPlan ?? 0, turnPlanNodes: spec.turnPlanNodes, turnPlanBeam: spec.turnPlanBeam, mulligan: spec.mulligan, profiles: spec.profiles === 'default' ? DEFAULT_PROFILES : spec.profiles === 'best' ? BEST_PROFILES : (spec.profiles as any) ?? null });
}

function mkAgent(kind: string, seed: number): Agent {
  if (kind === 'random') return new RandomAgent(seed);
  if (['easy', 'medium', 'hard', 'hard-v1', 'mixed', 'fast', 'deep', 'lookahead'].includes(kind)) return makeTierBot(kind, seed);
  if (kind === 'plain') return new HeuristicAgent({ seed, noise: 0.15 });
  return new HeuristicAgent({ seed, noise: 0.15, profiles: BEST_PROFILES });
}

parentPort?.on('message', async (job: MatchJob) => {
  let r: MatchResult;
  try {
    const A0 = job.agentA ? fromSpec(job.agentA, job.seed) : mkAgent(job.bot, job.seed);
    const observed =
      (job.shadowA || job.piecesA) && A0 instanceof HeuristicAgent ? new ObservedAgent(A0, job.shadowA ? fromSpec(job.shadowA, job.seed) : null, !!job.piecesA) : null;
    const probe = (job.mulliganA || job.openingA) && A0 instanceof HeuristicAgent ? new MulliganProbe(observed ?? A0, A0, job.mulliganA) : null;
    const A = probe ?? observed ?? A0;
    const B = job.agentB ? fromSpec(job.agentB, job.seed + 7777) : mkAgent(job.bot, job.seed + 7777);
    const g = Game.create([job.a, job.b], [A, B], {
      seed: job.seed,
      first: job.first,
      log: false,
      trace: job.trace,
    });
    // the recorder only observes (tests/decision-telemetry.test.ts): with or without it the game is the same
    const rec = job.decisions || job.synergies ? new DecisionRecorder({ boards: !!job.synergies }) : null;
    g.telemetry = rec;
    const s = await g.run();
    let decisions: Pick<MatchResult, 'decisions' | 'decisionSize' | 'decisionRecords' | 'synergies' | 'synergySize'> = {};
    if (rec) {
      const records = rec.finish(g);
      if (job.decisions) {
        const agg = aggregateGame({ records, players: [s.players[0], s.players[1]], winner: s.winner });
        decisions = {
          decisions: agg,
          decisionSize: { records: records.length, rawBytes: JSON.stringify(records).length, aggregateBytes: JSON.stringify(agg).length },
          ...(job.rawDecisions ? { decisionRecords: records } : {}),
        };
      }
      if (job.synergies) {
        const lists = [job.a, job.b] as const;
        const player = (p: 0 | 1) => ({ listId: s.players[p].listId, name: s.players[p].name, legends: lists[p].legends, main: lists[p].main });
        const agg = aggregateSynergyGame({
          records,
          boards: rec.boards,
          sightings: rec.sightings,
          players: [player(0), player(1)],
          winner: s.winner,
          first: s.first,
          turns: s.turn,
        });
        decisions.synergies = agg;
        decisions.synergySize = { boards: rec.boards.length, sightings: rec.sightings.length, rawBytes: JSON.stringify(rec.boards).length + JSON.stringify(rec.sightings).length, aggregateBytes: JSON.stringify(agg).length };
      }
    }
    r = {
      a: job.a.name,
      b: job.b.name,
      seed: job.seed,
      first: job.first,
      winner: s.winner,
      reason: s.winReason,
      turns: s.turn,
      overtime: s.overtime,
      gigs: [s.players[0].gigs.length, s.players[1].gigs.length],
      summaries: job.trace ? summarize(s) : undefined,
      ...decisions,
      ...(observed && job.shadowA ? { shadow: observed.shadow } : {}),
      ...(observed && job.piecesA ? { pieces: observed.pieces } : {}),
      ...(probe?.opening ? { opening: probe.opening } : {}),
    };
  } catch (e: any) {
    // an exception is an error, never a result: callers report it and leave the game out of every tally
    r = { a: job.a.name, b: job.b.name, seed: job.seed, first: job.first, winner: null, reason: 'error', turns: 0, overtime: false, gigs: [0, 0], error: String(e?.stack ?? e) };
  }
  parentPort!.postMessage(r);
});
