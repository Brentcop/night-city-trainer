// What a costly rating costs in win chance: the one place the coach's grades and the Game review's ratings are put into
// win chance (docs/REVIEW_2026-11-25.md row 6, R5). Both instruments measure a move's gap in "Gigs", the bots' own unit
// of value (one Gig = 40 evaluation points), which was never tied to win chance: played on to the end, a rated Gig was
// worth about 4 points of win chance with the Hard bot, and gaps above 1 Gig hardly cost more. So a player is told what
// moves of a band cost on average, measured, never the gap's size.
//
// Measured on 2026-11-25 (reports/review-validity-2026-11-25.md, "Row 6"; scripts/review-validity.ts, steps `coach` and
// `costs`): 240 bot games of the meta decks (Easy and Hard players against Medium), every costly rating of a main-phase
// action or reaction with a named better move, by the Game review as it rates today and by the coach as the Play page
// grades a move; for a random sample of each band, the recommended move and the move made each played to the end of the
// game with the Hard bot on both sides, on paired worlds. A band's figure is the mean gain in win chance over the band's
// ratings in those games (by player type, weighted by its share), with its 90% interval. The rule for the words was
// written before the results: the mean rounded to a whole point, "on average", the measurement named; a band whose
// interval includes 0 "often costs nothing measurable". tests/rating-cost.test.ts pins these figures to the report.
// What it found under the old lines (Mistake from 0.375 Gigs, Blunder from 1): only Blunders showed a cost (about 8 points
// of win chance for the coach's, 10 for the review's); Slips and Mistakes cost nothing measurable. So the owner decided to
// raise the Mistake line (2026-11-25, "Raise it"): the lines were set on the same data, binned by gap, by a rule written
// first (the report's "Raising the Mistake line": Mistake from 1 Gig, Blunder from 3, src/lib/gameReview.ts MISTAKE_GIGS,
// BLUNDER_GIGS), with 173 more positions measured in the thin bins, and the figures below are the new bands': a Slip (now
// everything clearly behind under 1 Gig) still costs nothing measurable, a Mistake about 4 points (coach) or 7 (review), a
// Blunder about 15 or 12. Not covered: a rating whose move or better move is a Call of a face-down Legend (it cannot be
// played both ways), about a quarter of the sample.
//
// Pure data and words, no imports: src/lib/gameReview.ts (the legend), src/lib/coachWords.ts and src/lib/reviewWords.ts
// read it, and the review worker carries it.

/** The bands a cost is measured for (the review's names; a coach grade by its gap, src/lib/coachWords.ts verdictRating). */
export type CostBand = 'slip' | 'mistake' | 'blunder';
/** Who rated the move: the live coach during play, or the Game review after it. */
export type CostInstrument = 'coach' | 'review';

export interface BandCost {
  /** mean gain of the recommended move over the move made, points of win chance (0–100 scale) */
  mean: number;
  /** its 90% interval */
  lo: number;
  hi: number;
  /** ratings measured, and ratings of the band in the games */
  measured: number;
  ratings: number;
}

/** The measurement: what it was, when, on which simulator version and with which bot playing on. */
export const RATING_COST_SOURCE = {
  date: '2026-11-25',
  simVersion: 9,
  bot: 'hard',
  games: 240,
  report: 'reports/review-validity-2026-11-25.md',
  /** the report's section with the figures of the current bands */
  section: '## Raising the Mistake line',
  /** the bands' lines in Gigs (src/lib/gameReview.ts MISTAKE_GIGS, BLUNDER_GIGS; tests/rating-cost.test.ts checks they agree) */
  lines: { mistake: 1, blunder: 3 },
} as const;

export const RATING_COST: Record<CostInstrument, Record<CostBand, BandCost>> = {
  coach: {
    slip: { mean: 1.8, lo: -0.1, hi: 3.6, measured: 169, ratings: 343 },
    mistake: { mean: 4.1, lo: 1.9, hi: 6.3, measured: 183, ratings: 726 },
    blunder: { mean: 15.0, lo: 9.8, hi: 20.2, measured: 57, ratings: 437 },
  },
  review: {
    slip: { mean: 1.1, lo: -1.1, hi: 3.4, measured: 141, ratings: 251 },
    mistake: { mean: 7.4, lo: 4.9, hi: 9.9, measured: 151, ratings: 614 },
    blunder: { mean: 12.0, lo: 7.1, hi: 16.9, measured: 58, ratings: 363 },
  },
};

const LABEL: Record<CostBand, string> = { slip: 'Slip', mistake: 'Mistake', blunder: 'Blunder' };

/** A band's cost as shown: the mean in whole points, or null when its 90% interval includes 0 (the rule written first). */
export function shownCost(inst: CostInstrument, band: CostBand): number | null {
  const c = RATING_COST[inst][band];
  return c.lo > 0 ? Math.round(c.mean) : null;
}

/** "about 6% win chance on average" / "often nothing measurable". */
export function costWords(inst: CostInstrument, band: CostBand): string {
  const n = shownCost(inst, band);
  return n === null ? 'often nothing measurable' : `about ${n}% win chance on average`;
}

/** How it was measured, for the end of a sentence: "when the Hard bot played on from them to the end (measured 2026-11-25)". */
export const COST_MEASURED = `when the Hard bot played on from them to the end (measured ${RATING_COST_SOURCE.date})`;

/**
 * One sentence for a rated move: "Moves the review rates Mistake cost about 6% win chance on average when the Hard bot
 * played on from them to the end (measured 2026-11-25)." or "… often cost nothing measurable …".
 */
export function costSentence(inst: CostInstrument, band: CostBand): string {
  const n = shownCost(inst, band);
  const who = inst === 'coach' ? 'the coach rates' : 'the review rates';
  const what = n === null ? 'often cost nothing measurable' : `cost about ${n}% win chance on average`;
  return `Moves ${who} ${LABEL[band]} ${what} ${COST_MEASURED}.`;
}

/** A short tag after a grade: "about 6% win chance" / "often costs nothing measurable". */
export function costTag(inst: CostInstrument, band: CostBand): string {
  const n = shownCost(inst, band);
  return n === null ? 'often costs nothing measurable' : `about ${n}% win chance on average`;
}

/** The three bands in a line, for a footnote: "Slip about 2%, Mistake about 5%, Blunder about 8%" (or "Slip often nothing measurable"). */
export function costLine(inst: CostInstrument): string {
  const part = (b: CostBand) => {
    const n = shownCost(inst, b);
    return n === null ? `${LABEL[b]} often nothing measurable` : `${LABEL[b]} about ${n}%`;
  };
  return `${part('slip')}, ${part('mistake')}, ${part('blunder')}`;
}

/**
 * A footnote naming the measurement: "What the coach's grades cost in win chance on average, when the Hard bot played on
 * from such moves to the end (measured 2026-11-25 on 240 bot games): Slip …, Mistake …, Blunder …."
 */
export function costNote(inst: CostInstrument): string {
  const whose = inst === 'coach' ? "the coach's grades" : "the review's ratings";
  return `What ${whose} cost in win chance on average, when the Hard bot played on from such moves to the end (measured ${RATING_COST_SOURCE.date} on ${RATING_COST_SOURCE.games} bot games): ${costLine(inst)}.`;
}
