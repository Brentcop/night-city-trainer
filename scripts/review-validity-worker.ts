// Worker thread for scripts/review-validity.ts: plays and reviews one game, or measures one position of a reviewed game.
//   game  a player of a tier (seat 0) against Medium (seat 1), recorded as a practice game and reviewed as the browser
//         reviews it (src/sim/gameReviewRun.ts)
//   flag  a costly rating played on: the move made and the review's best move, each played to the end of the game with
//         Hard on both seats (the "truth": win rate), and each played over the oracle's horizon with Hard on both seats
//         (design (a) of docs/REVIEW_2026-11-25.md R2: a costly flag confirmed with a stronger continuation), timed
//   late  a late-game position (R6): every candidate the oracle would grade, played over the oracle's horizon in a pool of
//         worlds (each scored plainly and with the start-of-turn win, rolloutWins), and each played to the end with the
//         oracle's Medium-like bots (win rate)
import { parentPort } from 'node:worker_threads';
import { Game, GameOverSignal } from '../src/engine/engine';
import type { Action, Agent, Decision, DeckList, PlayerId, Reaction } from '../src/engine/types';
import { HeuristicAgent, hideInfo, isUnknownCall } from '../src/ai/heuristic';
import { BEST_PROFILES } from '../src/ai/archetype';
import { TIER_SETTINGS, makeTierBot } from '../src/ai/tiers';
import { DEFAULT_WEIGHTS } from '../src/ai/eval';
import { makeWorlds, playOut, playOutValue, nextStartResult, type PlayOutMove } from '../src/ai/playOut';
import { ScriptedAgent, type SeatAnswers } from '../src/ai/reviewer';
import { runGameReview } from '../src/sim/gameReviewRun';
import type { GameReviewRecord } from '../src/lib/gameReview';
import type { PracticeReviewSpec } from '../src/sim/practiceReview';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';

export interface Replay {
  decks: [DeckList, DeckList];
  seed: number;
  first: PlayerId;
  answers: [SeatAnswers, SeatAnswers];
}

export type ValidityJob =
  | { kind: 'game'; id: string; decks: [DeckList, DeckList]; seed: number; first: PlayerId; tier: string; confirm: number }
  | { kind: 'flag'; id: string; replay: Replay; p: PlayerId; at: number; best: string; truthWorlds: number; hardWorlds: number; seed: number }
  | { kind: 'late'; id: string; replay: Replay; p: PlayerId; at: number; pool: number; truthWorlds: number; seed: number };

export type ValidityResult =
  | { kind: 'game'; id: string; rec: GameReviewRecord; playMs: number; reviewMs: number; winner: PlayerId | 'tie' | null }
  | {
      kind: 'flag';
      id: string;
      /** win rate of the best move and the move made, played to the end (Hard on both seats), per world (1 win, 0.5 tie, 0 loss) */
      truthBest?: number[];
      truthMade?: number[];
      /** the oracle's horizon and scoring with Hard on both seats: per-world clamped values */
      hardBest?: number[];
      hardMade?: number[];
      hardMs?: number;
      skip?: string;
    }
  | {
      kind: 'late';
      id: string;
      turn?: number;
      /** candidate option indices; the move made; the quick screen's first choice and the move made's rank in its order */
      cand?: number[];
      chosen?: number;
      screen?: { top: number; order: number[] };
      /** per candidate, per world: the raw play-out value (plain), the raw value with the start-of-turn win scored, and whether the play-out ended the game (or reached a decided start of turn) */
      plain?: number[][];
      wins?: number[][];
      ended?: boolean[][];
      /** per candidate, per world: the result played to the end with the oracle's bots (1 win, 0.5 tie, 0 loss) */
      truth?: number[][];
      skip?: string;
    };

class Recorder implements Agent {
  name: string;
  choices: number[][] = [];
  choosesPayment?: boolean;
  choosesOrder?: boolean;
  constructor(private inner: Agent) {
    this.name = inner.name;
    this.choosesPayment = inner.choosesPayment;
    this.choosesOrder = inner.choosesOrder;
  }
  async decide(g: Game, d: Decision) {
    const r = await this.inner.decide(g, d);
    this.choices.push([...r]);
    return r;
  }
}

const hard = (seed: number) => {
  const { profiles: _p, ...rest } = TIER_SETTINGS.hard;
  return new HeuristicAgent({ ...rest, profiles: BEST_PROFILES, seed, quiet: true });
};
/** the oracle's play-out bots (src/ai/reviewer.ts oracleDetail) */
const medium = (seed: number) => new HeuristicAgent({ lookahead: true, maxCandidates: 14, profiles: BEST_PROFILES, seed });

async function playGame(job: Extract<ValidityJob, { kind: 'game' }>): Promise<ValidityResult> {
  const t0 = Date.now();
  const botSeed = job.seed + 5;
  const me = new Recorder(makeTierBot(job.tier, job.seed + 3));
  const st = await Game.create(job.decks, [me, makeTierBot('medium', botSeed, 'Bot')], { seed: job.seed, first: job.first, log: false }).run();
  const playMs = Date.now() - t0;
  const expect = st.winner === 0 || st.winner === 1 ? st.winner : 'tie';
  const spec: PracticeReviewSpec = { decks: job.decks, seed: job.seed, first: job.first, botLevel: 'medium', botSeed, choices: me.choices, payChoice: !!me.choosesPayment, orderChoice: !!me.choosesOrder, expect, turns: st.turn, simVersion: CURRENT_SIM_VERSION };
  const t1 = Date.now();
  const rec = await runGameReview({ id: job.id, spec, coach: [], confirm: job.confirm, made: 'validity' });
  return { kind: 'game', id: job.id, rec, playMs, reviewMs: Date.now() - t1, winner: st.winner };
}

class Stop extends Error {}

/** Replay a recorded game to seat p's decision number `at` and run `f` there (the game is abandoned afterwards). */
async function atDecision(r: Replay, p: PlayerId, at: number, f: (g: Game, d: Decision) => Promise<void>): Promise<boolean> {
  let k = 0;
  let reached = false;
  const seat = (q: PlayerId): Agent => {
    const a = r.answers[q];
    const s = new ScriptedAgent(q === 0 ? 'A' : 'B', a.choices, null, a.pay, a.order, !!a.endTurn);
    if (q !== p) return s;
    return {
      name: s.name,
      choosesPayment: s.choosesPayment,
      choosesOrder: s.choosesOrder,
      confirmsEndTurn: s.confirmsEndTurn,
      decide: async (g: Game, d: Decision) => {
        if (k++ === at) {
          reached = true;
          await f(g, d);
          throw new Stop();
        }
        return s.decide(g, d);
      },
    };
  };
  try {
    await Game.create(r.decks, [seat(0), seat(1)], { seed: r.seed, first: r.first, log: false }).run();
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
  }
  return reached;
}

function moveOf(g: Game, d: Decision, i: number): PlayOutMove | null {
  const o = d.options[i];
  if (!o) return null;
  if (d.kind === 'action') return { action: o.action as Action };
  if (d.kind === 'reaction' && g.s.attack) return { reaction: o.action as Reaction, attacker: g.s.attack.attacker };
  return null;
}

/** Play the move out for the oracle's horizon in a copy with the given bots; then, when `toEnd`, on to the end of the game. */
async function played(g: Game, p: PlayerId, move: PlayOutMove, w: { rng: number; a: number; b: number }, mk: (seed: number) => Agent, toEnd: boolean) {
  const cg = g.clone([mk(w.a), mk(w.b)]);
  cg.s.rng = w.rng;
  hideInfo(cg, p);
  await playOut(cg, p, move);
  const plain = playOutValue(cg, p, DEFAULT_WEIGHTS, { wins: false });
  const wins = playOutValue(cg, p, DEFAULT_WEIGHTS, { wins: true });
  const ended = cg.s.winner !== null || nextStartResult(cg) !== null;
  let result = 0.5;
  if (toEnd) {
    try {
      while (cg.s.winner === null) await cg.playTurn();
    } catch (e) {
      if (!(e instanceof GameOverSignal)) throw e;
    }
    result = cg.s.winner === p ? 1 : cg.s.winner === 'tie' || cg.s.winner === null ? 0.5 : 0;
  }
  return { plain, wins, ended, result };
}

function rnd(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

async function flag(job: Extract<ValidityJob, { kind: 'flag' }>): Promise<ValidityResult> {
  const out: Extract<ValidityResult, { kind: 'flag' }> = { kind: 'flag', id: job.id };
  const ok = await atDecision(job.replay, job.p, job.at, async (g, d) => {
    const made = job.replay.answers[job.p].choices[job.at]![0]!;
    const best = d.options.findIndex((o) => o.label === job.best);
    const mm = moveOf(g, d, made);
    const mb = best >= 0 ? moveOf(g, d, best) : null;
    if (!mm || !mb || best === made) return void (out.skip = best < 0 ? 'best not found' : best === made ? 'same move' : 'not an action or reaction');
    if (isUnknownCall(g, d.options[best]!.action as Action) || isUnknownCall(g, d.options[made]!.action as Action)) return void (out.skip = 'unknown Call');
    const r = rnd(job.seed);
    const tw = makeWorlds(job.truthWorlds, r);
    out.truthBest = [];
    out.truthMade = [];
    for (const w of tw) {
      out.truthBest.push((await played(g, job.p, mb, w, hard, true)).result);
      out.truthMade.push((await played(g, job.p, mm, w, hard, true)).result);
    }
    const hw = makeWorlds(job.hardWorlds, r);
    const t0 = Date.now();
    out.hardBest = [];
    out.hardMade = [];
    for (const w of hw) {
      out.hardBest.push((await played(g, job.p, mb, w, hard, false)).plain);
      out.hardMade.push((await played(g, job.p, mm, w, hard, false)).plain);
    }
    out.hardMs = Date.now() - t0;
  });
  if (!ok) out.skip ??= 'decision not reached';
  return out;
}

async function late(job: Extract<ValidityJob, { kind: 'late' }>): Promise<ValidityResult> {
  const out: Extract<ValidityResult, { kind: 'late' }> = { kind: 'late', id: job.id };
  const ok = await atDecision(job.replay, job.p, job.at, async (g, d) => {
    out.turn = g.s.turn;
    if (d.kind !== 'action' || d.options.length < 2) return void (out.skip = 'not a main-phase choice');
    const made = job.replay.answers[job.p].choices[job.at]![0]!;
    const actions = d.options.map((o) => o.action as Action);
    // the oracle's candidates (src/ai/reviewer.ts gradeAction): the move made, the quick screen's top 4 and passing
    const screen = new HeuristicAgent({ profiles: BEST_PROFILES });
    await screen.decide(g, d);
    const order = screen.lastAlternatives.map((x) => x.index);
    const cand = new Set<number>([made, ...order.slice(0, 4)]);
    const passI = actions.findIndex((a) => a.type === 'pass');
    if (passI >= 0) cand.add(passI);
    const list = [...cand].filter((i) => !isUnknownCall(g, actions[i]));
    if (!list.includes(made) || list.length < 2) return void (out.skip = 'unknown Call or one candidate');
    const r = rnd(job.seed);
    const pool = makeWorlds(job.pool, r);
    const tw = makeWorlds(job.truthWorlds, r);
    out.cand = list;
    out.chosen = made;
    if (order.length) out.screen = { top: order[0]!, order };
    out.plain = [];
    out.wins = [];
    out.ended = [];
    out.truth = [];
    for (const i of list) {
      const pl: number[] = [];
      const wn: number[] = [];
      const en: boolean[] = [];
      for (const w of pool) {
        const x = await played(g, job.p, { action: actions[i]! }, w, medium, false);
        pl.push(x.plain);
        wn.push(x.wins);
        en.push(x.ended);
      }
      const tr: number[] = [];
      for (const w of tw) tr.push((await played(g, job.p, { action: actions[i]! }, w, medium, true)).result);
      out.plain.push(pl);
      out.wins.push(wn);
      out.ended.push(en);
      out.truth.push(tr);
    }
  });
  if (!ok) out.skip ??= 'decision not reached';
  return out;
}

parentPort?.on('message', async (job: ValidityJob) => {
  try {
    const r = job.kind === 'game' ? await playGame(job) : job.kind === 'flag' ? await flag(job) : await late(job);
    parentPort!.postMessage(r);
  } catch (e) {
    parentPort!.postMessage({ kind: job.kind, id: job.id, skip: `error: ${String((e as Error)?.stack ?? e).slice(0, 400)}` });
  }
});
