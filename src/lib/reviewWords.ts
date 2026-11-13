// How the Game review puts a rated move into words (src/lib/gameReview.ts rates it). Gap figures go through the coach's
// gapFigure / behindText (src/lib/coachWords.ts), so a review never prints more than CAP_GIGS either ("more than 3
// Gigs"), and option names through shownLabel ("End turn", "No reaction"), as the board and the coach name them. Kept
// apart from gameReview.ts because coachWords.ts reads gameReview.ts's constants when it loads.
import { behindText, gapFigure, gapSize, shownLabel } from './coachWords';
import { CLOSE_GIGS, fixedTerms, type ReviewMove } from './gameReview';

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

/** One or two plain sentences on a move: what was better and by how much, and the coach's reason when it had one. */
export function explain(m: ReviewMove): string {
  const g = rawGap(m);
  const chosen = shownLabel(m.chosen);
  const better = shownLabel(m.best ?? m.chosen);
  const who = m.src === 'coach' ? 'The coach' : 'The review';
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
  return m.why && m.src === 'coach' ? `${s} Coach: ${m.why}` : s;
}

/** A rated move's gap as a short tag: "−0.6 ± 0.1 Gigs", "more than 3 Gigs behind". */
export const gapTag = (m: Pick<ReviewMove, 'gap' | 'raw' | 'se'>) => behindText(rawGap(m), m.se);

/** After a rival Mistake or Blunder (src/lib/gameReview.ts rivalFollowUps): what your next turn had. */
export const FOLLOW_TEXT = {
  missed: 'Missed chance: your next turn had a Mistake or Blunder.',
  followed: 'Followed up: no costly move on your next turn (all Close call or better).',
} as const;
