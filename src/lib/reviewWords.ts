// How the Game review puts a rated move into words (src/lib/gameReview.ts rates it). A rating is never sized in Gigs, the
// bots' unit of value, which is not win chance: a costly rating says what moves of its band cost in win chance on
// average, as measured (src/lib/ratingCost.ts, docs/REVIEW_2026-11-25.md row 6); the gaps in Gigs stay in the Play-out
// details tab and in gapTag for the command line. Option names go through shownLabel ("End turn", "No reaction"), as the
// board and the coach name them. Kept apart from gameReview.ts because coachWords.ts reads gameReview.ts's constants when
// it loads.
import { behindText, gapSize, shownLabel, verdictName } from './coachWords';
import { CLOSE_GIGS, fixedTerms, RATING_INFO, type CoachSaid, type ReviewMove } from './gameReview';
import { costNote, costSentence, costTag, type CostBand } from './ratingCost';

/**
 * What the ratings rest on, in plain words, for the screen and the legend: the bots' own evaluation a turn or so ahead
 * (AI-8), in worlds where hidden cards were re-dealt, so a rating means best given what you could see.
 */
export const REVIEW_BASIS =
  "How these ratings are made: each option is played out by the bots for about a turn (to the end of the rival's next turn; for a block or other reaction, to the end of your own next turn), with the cards you couldn't see re-dealt, and scored by the bots' own evaluation. So a rating means best given what you could see then, not with hindsight, and a plan that pays off later than that, or one the bots wouldn't follow up, can be rated lower than it deserves.";

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

/** A costly rating's band (Slip, Mistake, Blunder), else null. */
const costBand = (r: string): CostBand | null => (r === 'slip' || r === 'mistake' || r === 'blunder' ? r : null);

/**
 * One or two plain sentences on a move: what was better, and for a costly rating what moves of its band cost in win
 * chance on average (src/lib/ratingCost.ts), never its gap in Gigs (the coach's reason in reviews that rated by it).
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
      s = better === chosen || g <= 0 ? `${who} rates this the best move found.` : `As good as ${better}: no measurable difference.`;
      break;
    case 'close':
      if (g < CLOSE_GIGS) s = `${who} slightly preferred ${better}: too small to matter.`;
      else if (fixedTerms(m.se)) s = `${who} preferred ${better}, but every play-out gave about the same small difference: it comes from fixed terms of the bots' evaluation, not from the play-outs, and is too little to call.`;
      else s = `${who} preferred ${better}, but its play-outs disagree too much to call it.`;
      break;
    case 'unclear':
      s = 'Every option measured comes out about the same here (or the game was already decided), so this move is not counted.';
      break;
    case 'forced':
      s = 'The only option.';
      break;
    default: {
      const band = costBand(m.r);
      s =
        (gapSize(g) === 'decided' ? `${who} preferred ${better}: in its play-outs the difference decides the game.` : `${who} preferred ${better}.`) +
        (m.lost ? ` It also lost the game in at least 1 in 4 more of the play-outs than ${better}.` : '') +
        (band ? ` ${costSentence(m.src === 'coach' ? 'coach' : 'review', band)}` : '');
    }
  }
  if (m.src === 'oracle' && m.ms?.h) s += ` ${HARD_CHECK_TEXT}`;
  return m.why && m.src === 'coach' ? `${s} Coach: ${m.why}` : s;
}

/** After a move rated from its Hard check (ReviewMove.ms.h; src/ai/reviewer.ts ReviewOptions.hardCheck). */
export const HARD_CHECK_TEXT = "Measured again with the Hard bot playing on for both sides, as a side's rare costly moves are: this rating is from that check.";

/**
 * The coach's grade of your move during play, kept beside the review's rating for reference (ReviewMove.said): "During
 * play the coach said Mistake: it preferred X. Coach: …". The coach measured fewer worlds, a shorter way, so the two can
 * differ; the review's rating is the one counted. No gap in Gigs (row 6: the size is a poor guide to the cost).
 */
export function saidText(s: CoachSaid, cat: string): string {
  const pick = s.best !== undefined ? moveName({ cat, chosen: s.best }) : null;
  const name = verdictName(s.v, s.gap) ?? 'not measured';
  // a confirmed grade is the confirmation's (its gap and SE); the coach checked it before showing it
  const checked = s.confirmed ? `, after checking it on ${s.confirmed} fresh play-outs` : '';
  const head = s.unclear
    ? `During play the coach said No clear difference${pick ? ` (it would have picked ${pick})` : ''}: every option it measured came out about the same`
    : s.v === 'agree'
      ? 'During play the coach said this was its own pick'
      : `During play the coach said ${name}${checked}${pick && s.v !== 'best' ? `: it preferred ${pick}` : pick ? `: as good as ${pick}` : ''}`;
  return `${head}.${s.why ? ` Coach: ${s.why}` : ''}`;
}

/**
 * Under the two seats' accuracies: what accuracy shows and what it does not (docs/REVIEW_2026-11-25.md §2). It follows
 * skill across bot tiers (the figures: today's review on the 240 games of reports/review-validity-2026-11-25.md, "Row
 * 6"), but in 60 Hard-vs-Hard mirror matches the side with the higher accuracy won 29: it does not say which of two
 * strong players played better.
 */
export const ACCURACY_TEXT =
  "Accuracy is how little a side's counted moves gave away by these play-outs. It tells a weak player from a strong one (bot players on the same deals: Easy about 66, Medium about 76, Hard about 95), but not two strong players apart: in games between two Hard bots with the same deck, the side with the higher accuracy won about half of them. It also runs higher in won games, because a lost position offers fewer good moves.";

/**
 * Under Play-out details, which keeps the gaps in Gigs: a Gig is the bots' unit, not win chance, and what the ratings cost
 * in win chance (src/lib/ratingCost.ts).
 */
export const REVIEW_GIG_NOTE = `Gaps here are in Gigs, the bots' own unit of value (one Gig = 40 points of their evaluation), not Gigs on the board and not win chance: a bigger gap is not reliably a costlier move. ${costNote('review')}`;

/** Under the review's progress: how every move is measured. */
export const REVIEW_RUNNING_TEXT =
  "Every move of both sides is compared with the alternatives by playing each out for about a turn, yours the same way as the rival's; the coach's grades from play are shown beside yours for reference.";

/** The seat cards' note: both seats are rated by the same play-outs; the coach's grades from play are shown beside yours. */
export const sameInstrumentText = (saidCount: number) =>
  saidCount ? `rated by the review's play-outs, as the rival's; ${saidCount === 1 ? '1 also graded' : `${saidCount} also graded`} by the coach during play, shown beside it` : "rated by the review's play-outs, as the rival's";

/** A rated move's gap as a short tag in Gigs: "−0.6 ± 0.1 Gigs", "more than 3 Gigs behind" (the command line; the screen shows costTagOf). */
export const gapTag = (m: Pick<ReviewMove, 'gap' | 'raw' | 'se'>) => behindText(rawGap(m), m.se);

/**
 * A rated move's tag on the screen (the turning point): for a Slip, Mistake or Blunder what moves of its band cost, "about
 * 6% win chance on average" or "often costs nothing measurable" (src/lib/ratingCost.ts); else the rating's name.
 */
export function costTagOf(m: Pick<ReviewMove, 'r' | 'src'>): string {
  const band = costBand(m.r);
  return band ? costTag(m.src === 'coach' ? 'coach' : 'review', band) : RATING_INFO[m.r].label;
}

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
