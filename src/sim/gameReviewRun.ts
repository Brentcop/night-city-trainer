// The Game review of a recorded practice game: re-simulate it (your seat replays your answers, the bot plays itself),
// grade both seats with the match reviewer's oracle, except your moves the coach already graded during play, and turn
// the result into the stored record (src/lib/gameReview.ts). One function for the browser's review worker and the CLI
// (scripts/review.ts), so both rate a game the same way. The replay is strict (src/sim/practiceReview.ts): a record from
// another simulator version, or one that no longer replays as the game that was played (or no longer reaches the
// position recorded with it), is a ReplayDiverged.
import { reviewGame } from '../ai/reviewer';
import { buildReviewRecord, coachSkip, confirmFlag, GAME_REVIEW_CONFIRM, GAME_REVIEW_ROLLOUTS, type CoachRating, type GameReviewRecord, type ReviewMove } from '../lib/gameReview';
import { checkReplayed, practiceAgents, refuseOtherVersion, replayedEnd, type PracticeReviewSpec, type ReplayedEnd } from './practiceReview';

// The play-outs and confirmation worlds are part of how a review is measured: they live beside REVIEW_MEASURE in
// src/lib/gameReview.ts (the store checks a stored review against them without loading the oracle).
export { GAME_REVIEW_CONFIRM, GAME_REVIEW_ROLLOUTS };

export interface GameReviewJob {
  /** the practice replay's id */
  id: string;
  spec: PracticeReviewSpec;
  /** your moves the coach graded during play (src/lib/gameReview.ts coachRatingOf) */
  coach: CoachRating[];
  /**
   * your coach-graded moves from an earlier review whose coach grades are no longer stored (re-rating a review made under
   * older rules): kept as they were rated, not played out again
   */
  keep?: ReviewMove[];
  rollouts?: number;
  /** fresh worlds a Slip-or-worse is confirmed on (default GAME_REVIEW_CONFIRM; 0: not confirmed) */
  confirm?: number;
  /** the oracle's seed (default: the game seed) */
  oracleSeed?: number;
  /** when the review is made (ISO; stored with it) */
  made: string;
}

export async function runGameReview(job: GameReviewJob, onProgress?: (decisions: number, turn: number) => void): Promise<GameReviewRecord> {
  const q = job.spec;
  refuseOtherVersion(q);
  let turn = 0;
  const agents = practiceAgents(q);
  const tracked = agents.map((a) => ({
    name: a.name,
    choosesPayment: a.choosesPayment,
    choosesOrder: a.choosesOrder,
    confirmsEndTurn: a.confirmsEndTurn,
    decide: (g: Parameters<typeof a.decide>[0], d: Parameters<typeof a.decide>[1]) => ((turn = g.s.turn), a.decide(g, d)),
  }));
  const me = q.pvp?.seat ?? 0;
  const names: [string, string] = q.pvp ? (me === 0 ? ['you', 'rival'] : ['rival', 'you']) : ['you', q.botLevel];
  const coachAt = coachSkip(job.coach, me);
  const kept = new Set((job.keep ?? []).filter((m) => m.p === me).map((m) => m.at));
  const confirm = job.confirm ?? GAME_REVIEW_CONFIRM;
  let end = null as ReplayedEnd | null;
  const review = await reviewGame(
    { decks: q.decks, seed: q.seed, first: q.first, agents: [tracked[0]!, tracked[1]!], agentNames: names },
    {
      rollouts: job.rollouts ?? GAME_REVIEW_ROLLOUTS,
      seats: [0, 1],
      skip: (seat, at) => coachAt(seat, at) || (seat === me && kept.has(at)),
      keepAnswers: true,
      ...(confirm > 0 ? { confirm: { worlds: confirm, flag: confirmFlag } } : {}),
      ...(job.oracleSeed !== undefined ? { oracleSeed: job.oracleSeed } : {}),
      onProgress: (n) => onProgress?.(n, turn),
      onEnd: (s) => (end = replayedEnd(s)),
    },
  );
  checkReplayed(q, agents, end!);
  return buildReviewRecord(review, job.coach, { id: job.id, made: job.made, me, confirm }, job.keep);
}
