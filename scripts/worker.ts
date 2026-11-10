// Worker thread: plays one game per message.
import { parentPort } from 'node:worker_threads';
import { Game } from '../src/engine/engine';
import { HeuristicAgent } from '../src/ai/heuristic';
import { RandomAgent } from '../src/ai/random';
import { DEFAULT_WEIGHTS } from '../src/ai/eval';
import { BEST_PROFILES, DEFAULT_PROFILES } from '../src/ai/archetype';
import { summarize, type PlayerSummary } from '../src/analysis/summarize';
import type { Agent, DeckList } from '../src/engine/types';

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
}
export interface AgentSpec {
  lookahead?: boolean;
  weights?: Record<string, number>;
  noise?: number;
  deep?: number;
  /** 'default' = DEFAULT_PROFILES, or an explicit profile table */
  profiles?: 'default' | Record<string, Record<string, number>>;
}
export interface MatchResult {
  a: string;
  b: string;
  seed: number;
  first: 0 | 1;
  winner: 0 | 1 | 'tie' | null;
  reason: string;
  turns: number;
  overtime: boolean;
  gigs: [number, number];
  error?: string;
  summaries?: [PlayerSummary, PlayerSummary];
}

function fromSpec(spec: AgentSpec, seed: number): Agent {
  return new HeuristicAgent({ lookahead: spec.lookahead ?? true, weights: spec.weights ? ({ ...DEFAULT_WEIGHTS, ...spec.weights } as any) : undefined, noise: spec.noise ?? 0.15, seed, deep: spec.deep ?? 0, profiles: spec.profiles === 'default' ? DEFAULT_PROFILES : (spec.profiles as any) ?? null });
}

function mkAgent(kind: string, seed: number): Agent {
  if (kind === 'random') return new RandomAgent(seed);
  if (kind === 'fast') return new HeuristicAgent({ lookahead: false, seed });
  if (kind === 'deep') return new HeuristicAgent({ seed, noise: 0.15, deep: 3, profiles: BEST_PROFILES });
  if (kind === 'plain') return new HeuristicAgent({ seed, noise: 0.15 });
  return new HeuristicAgent({ seed, noise: 0.15, profiles: BEST_PROFILES });
}

parentPort?.on('message', async (job: MatchJob) => {
  let r: MatchResult;
  try {
    const A = job.agentA ? fromSpec(job.agentA, job.seed) : mkAgent(job.bot, job.seed);
    const B = job.agentB ? fromSpec(job.agentB, job.seed + 7777) : mkAgent(job.bot, job.seed + 7777);
    const g = Game.create([job.a, job.b], [A, B], {
      seed: job.seed,
      first: job.first,
      log: false,
      trace: job.trace,
    });
    const s = await g.run();
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
    };
  } catch (e: any) {
    r = { a: job.a.name, b: job.b.name, seed: job.seed, first: job.first, winner: 'tie', reason: 'error', turns: 0, overtime: false, gigs: [0, 0], error: String(e?.stack ?? e) };
  }
  parentPort!.postMessage(r);
});
