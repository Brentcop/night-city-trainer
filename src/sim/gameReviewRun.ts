// The Game review of a recorded practice game: re-simulate it (your seat replays your answers, the bot plays itself),
// grade both seats with the match reviewer's oracle in the same way (since 2026-11-25: your moves too, with the coach's
// grade from play kept beside each for reference; a seat's rare costly ratings, CHECK_GIGS or more behind, checked again with Hard play-outs),
// and turn the result into the stored record (src/lib/gameReview.ts). One function for the browser's review worker and
// the CLI (scripts/review.ts), so both rate a game the same way. The replay is strict (src/sim/practiceReview.ts): a
// record from another simulator version that does not keep both seats' answers and its position, or one that no longer
// replays as the game that was played (or no longer reaches the position recorded with it), is a ReplayDiverged. The
// record names the simulator version that measured it and, when another, the game's own (gameSimVersion).
import { reviewGame } from '../ai/reviewer';
import { buildReviewRecord, confirmFlag, GAME_REVIEW_CONFIRM, GAME_REVIEW_HARD, GAME_REVIEW_ROLLOUTS, HARD_CHECK_MAX_FLAGS, hardFlag, type CoachRating, type GameReviewRecord } from '../lib/gameReview';
import { checkReplayed, practiceAgents, refuseOtherVersion, replayedEnd, type PracticeReviewSpec, type ReplayedEnd } from './practiceReview';

// The play-outs and confirmation worlds are part of how a review is measured: they live beside REVIEW_MEASURE in
// src/lib/gameReview.ts (the store checks a stored review against them without loading the oracle).
export { GAME_REVIEW_CONFIRM, GAME_REVIEW_HARD, GAME_REVIEW_ROLLOUTS };

export interface GameReviewJob {
  /** the practice replay's id */
  id: string;
  spec: PracticeReviewSpec;
  /** your moves the coach graded during play (src/lib/gameReview.ts coachRatingOf): kept beside the review's ratings, for reference */
  coach: CoachRating[];
  rollouts?: number;
  /** fresh worlds a flagged move (Slip or worse, a wide close call) is confirmed on (default GAME_REVIEW_CONFIRM; 0: not confirmed) */
  confirm?: number;
  /** fresh worlds a rating CHECK_GIGS or more behind is checked on with Hard play-outs, in a seat with at most HARD_CHECK_MAX_FLAGS of them (default GAME_REVIEW_HARD; 0: not checked) */
  hard?: number;
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
  const confirm = job.confirm ?? GAME_REVIEW_CONFIRM;
  const hard = job.hard ?? GAME_REVIEW_HARD;
  let end = null as ReplayedEnd | null;
  const review = await reviewGame(
    { decks: q.decks, seed: q.seed, first: q.first, agents: [tracked[0]!, tracked[1]!], agentNames: names },
    {
      rollouts: job.rollouts ?? GAME_REVIEW_ROLLOUTS,
      seats: [0, 1],
      keepAnswers: true,
      ...(confirm > 0 ? { confirm: { worlds: confirm, flag: confirmFlag } } : {}),
      ...(hard > 0 ? { hardCheck: { worlds: hard, maxFlags: HARD_CHECK_MAX_FLAGS, flag: hardFlag } } : {}),
      ...(job.oracleSeed !== undefined ? { oracleSeed: job.oracleSeed } : {}),
      onProgress: (n) => onProgress?.(n, turn),
      onEnd: (s) => (end = replayedEnd(s)),
    },
  );
  checkReplayed(q, agents, end!);
  return buildReviewRecord(review, job.coach, { id: job.id, made: job.made, me, confirm, hard, ...(q.simVersion !== undefined ? { gameSimVersion: q.simVersion } : {}) });
}
