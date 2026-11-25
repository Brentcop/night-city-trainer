// How the Game review puts a rated move into words (src/lib/gameReview.ts rates it). Gap figures go through the coach's
// gapFigure / behindText (src/lib/coachWords.ts), so a review never prints more than CAP_GIGS either ("more than 3
// Gigs"), and option names through shownLabel ("End turn", "No reaction"), as the board and the coach name them. Kept
// apart from gameReview.ts because coachWords.ts reads gameReview.ts's constants when it loads.
import { behindText, gapFigure, gapSize, shownLabel, verdictName } from './coachWords';
import { CLOSE_GIGS, fixedTerms, type CoachSaid, type ReviewMove } from './gameReview';

/**
 * What the ratings rest on, in plain words, for the screen and the legend: the bots' own evaluation a turn or so ahead
 * (AI-8), in worlds where hidden cards were re-dealt, so a rating means best given what you could see.
 */
export const REVIEW_BASIS =
  "How these ratings are made: each option is played out by the bots for about a turn (to the end of the rival's next turn; for a block or other reaction, to the end of your own next turn), with the cards you couldn't see re-dealt, and scored by the bots' own evaluation. So a rating means best given what you could see then, not with hindsight, and a plan that pays off later than that, or one the bots wouldn't follow up, can be rated lower than it deserves.";

/** A gap's size after "preferred X": "about 0.6 ± 0.1 Gigs" or "more than 3 Gigs". */
const bySize = (g: number, se?: number | null) => (gapSize(g) === 'figure' ? `about ${gapFigure(g, se)}` : gapFigure(g, se));

/** A move's gap before the cap (Gigs): what its words describe. */
const rawGap = (m: Pick<ReviewMove, 'gap' | 'raw'>) => Math.max(0, m.raw ?? m.gap ?? 0);

/** The ending-the-turn move by its board name (older records say "Pass turn"). */
const isPass = (label: string) => shownLabel(label) === 'End turn';

/**
 * A move's name as the board shows it: "End turn", "No reaction", and for the opening hand "Keep hand" / "Mulligan"
 * (reviews stored before 2026-11-25 kept the engine's "Yes" / "No" for a mulligan).
 */
export function moveName(m: Pick<ReviewMove, 'cat' | 'chosen'>): string {
  if (m.cat === 'mulligan') return m.chosen === 'Yes' ? 'Mulligan' : m.chosen === 'No' ? 'Keep hand' : m.chosen;
  return shownLabel(m.chosen);
}

/** Why a mulligan is not rated (the 'unrated' rating), in plain words. */
export const UNRATED_TEXT =
  'Mulligans are not rated: the only way to measure one is to play whole games out for each answer, and the difference stays inside the noise almost every time, so a rating would be a guess. Not counted.';

/**
 * One or two plain sentences on a move: what was better and by how much (the coach's reason in reviews that rated by it).
 */
export function explain(m: ReviewMove): string {
  const g = rawGap(m);
  const chosen = moveName(m);
  const better = m.best !== undefined ? moveName({ cat: m.cat, chosen: m.best }) : chosen;
  const who = m.src === 'coach' ? 'The coach' : 'The review';
  // Sharp and Inspired appear only in reviews stored before 2026-11-25 (src/lib/gameReview.ts rateMeasured)
  let s: string;
  switch (m.r) {
    case 'inspired':
      s = `${who} rates this the only good move: every other option it measured was clearly worse, and a quick read would have picked one that was a whole Gig or more worse.`;
      break;
    case 'sharp':
      s = isPass(m.chosen)
        ? `Holding back was the only good move: every play ${who === 'The coach' ? 'the coach' : 'the review'} measured was clearly worse, by a mistake or more.`
        : `${who} rates this the only good move: every other option it measured was clearly worse, by a mistake or more, and a quick read would have picked another.`;
      break;
    case 'unrated':
      s = UNRATED_TEXT;
      break;
    case 'best':
      s = better === chosen || g <= 0 ? `${who} rates this the best move found.` : `As good as ${better} (within 0.1 Gigs).`;
      break;
    case 'close':
      if (g < CLOSE_GIGS) s = `${who} slightly preferred ${better}, by ${gapFigure(g)}: too small to matter.`;
      else if (fixedTerms(m.se)) s = `${who} preferred ${better} by ${gapFigure(g)}, but the play-outs all gave about that difference: it comes from fixed terms of the bots' evaluation, not from the play-outs, and under 0.5 Gigs that is too little to call.`;
      else s = `${who} preferred ${better} by ${gapFigure(g, m.se)}, but its play-outs disagree too much to call it.`;
      break;
    case 'unclear':
      s = 'Every option measured comes out about the same here (or the game was already decided), so this move is not counted.';
      break;
    case 'forced':
      s = 'The only option.';
      break;
    default:
      s =
        (gapSize(g) === 'decided' ? `${who} preferred ${better}: in its play-outs the difference decides the game.` : `${who} preferred ${better}, ${bySize(g, m.se)} better.`) +
        (m.lost ? ` It also lost the game in at least 1 in 4 more of the play-outs than ${better}.` : '');
  }
  if (m.src === 'oracle' && m.ms?.h) s += ` ${HARD_CHECK_TEXT}`;
  return m.why && m.src === 'coach' ? `${s} Coach: ${m.why}` : s;
}

/** After a move rated from its Hard check (ReviewMove.ms.h; src/ai/reviewer.ts ReviewOptions.hardCheck). */
export const HARD_CHECK_TEXT = "Measured again with the Hard bot playing on for both sides, as a side's rare costly moves are: this rating is from that check.";

/**
 * The coach's grade of your move during play, kept beside the review's rating for reference (ReviewMove.said): "During
 * play the coach said Mistake: it preferred X (−0.6 ± 0.1 Gigs). Coach: …". The coach measured fewer worlds, a shorter
 * way, so the two can differ; the review's rating is the one counted.
 */
export function saidText(s: CoachSaid, cat: string): string {
  const pick = s.best !== undefined ? moveName({ cat, chosen: s.best }) : null;
  const name = verdictName(s.v, s.gap) ?? 'not measured';
  const head =
    s.v === 'agree'
      ? 'During play the coach said this was its own pick'
      : `During play the coach said ${name}${pick && s.v !== 'best' ? `: it preferred ${pick} (${behindText(s.gap, s.se)})` : pick ? `: as good as ${pick}` : ''}`;
  return `${head}.${s.why ? ` Coach: ${s.why}` : ''}`;
}

/** Under the review's progress: how every move is measured. */
export const REVIEW_RUNNING_TEXT =
  "Every move of both sides is compared with the alternatives by playing each out for about a turn, yours the same way as the rival's; the coach's grades from play are shown beside yours for reference.";

/** The seat cards' note: both seats are rated by the same play-outs; the coach's grades from play are shown beside yours. */
export const sameInstrumentText = (saidCount: number) =>
  saidCount ? `rated by the review's play-outs, as the rival's; ${saidCount === 1 ? '1 also graded' : `${saidCount} also graded`} by the coach during play, shown beside it` : "rated by the review's play-outs, as the rival's";

/** A rated move's gap as a short tag: "−0.6 ± 0.1 Gigs", "more than 3 Gigs behind". */
export const gapTag = (m: Pick<ReviewMove, 'gap' | 'raw' | 'se'>) => behindText(rawGap(m), m.se);

/** Above a stored review rated again under newer rules from the measurements kept with it (src/lib/gameReview.ts rerateRecord). */
export const RERATED_TEXT = 'Rated again with the current rating rules, from the measurements kept with this review.';

/**
 * Above a stored review that could not be rated again and whose game no longer replays, so it is shown as it was:
 * made with older rating rules, or measured another way than reviews are now (src/lib/gameReview.ts measuredAsNow).
 */
export const staleText = (olderRules: boolean) =>
  olderRules ? 'The review below was made earlier, with older rating rules, and is shown as it was.' : 'The review below was made earlier, measured in an older way, and is shown as it was.';

/** After a rival Mistake or Blunder (src/lib/gameReview.ts rivalFollowUps): what your next turn had. */
export const FOLLOW_TEXT = {
  missed: 'Missed chance: your next turn had a Mistake or Blunder.',
  followed: 'Followed up: no costly move on your next turn (all Close call or better).',
} as const;

/**
 * Above the moves the review could not measure (its grading threw: GameReviewRecord.failed, GameReview.failed): they
 * are not counted, and the error is kept for the log. `n` moves.
 */
export const failedText = (n: number) =>
  `${n === 1 ? '1 move' : `${n} moves`} could not be measured: the review's play-outs ran into an error there, so ${n === 1 ? 'it is' : 'they are'} not counted. The rest of the review is unaffected.`;
