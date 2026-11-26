// What a costly rating costs in win chance (src/lib/ratingCost.ts, docs/REVIEW_2026-11-25.md row 6): the figures are the
// report's, the shown words follow the rule written before the measurement, and no verdict a player reads is sized in Gigs.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { costLine, costNote, costSentence, costTag, costWords, RATING_COST, RATING_COST_SOURCE, shownCost, type CostBand, type CostInstrument } from '../src/lib/ratingCost';
import { COACH_COST_NOTE, coachCostWords, GIG_NOTE } from '../src/lib/coachWords';
import { BLUNDER_GIGS, MISTAKE_GIGS, RATING_INFO, type ReviewMove } from '../src/lib/gameReview';
import { ACCURACY_TEXT, costTagOf, explain, REVIEW_GIG_NOTE, saidText } from '../src/lib/reviewWords';
import { verdictText } from '../src/ui/components/board/CoachPanel';
import type { MoveGrade } from '../src/ai/coach';

const INSTS: CostInstrument[] = ['coach', 'review'];
const BANDS: CostBand[] = ['slip', 'mistake', 'blunder'];

describe('rating cost figures', () => {
  const report = fs.readFileSync(RATING_COST_SOURCE.report, 'utf8');
  // the current bands' figures (Mistake from 1 Gig, Blunder from 3 since 2026-11-25), not Row 6's under the old lines
  const section = report.slice(report.indexOf(RATING_COST_SOURCE.section));

  it('are the report’s table for the current bands, figure for figure, measured on the current lines', () => {
    expect(report.indexOf(RATING_COST_SOURCE.section)).toBeGreaterThan(0);
    expect(RATING_COST_SOURCE.lines).toEqual({ mistake: MISTAKE_GIGS, blunder: BLUNDER_GIGS });
    for (const inst of INSTS)
      for (const band of BANDS) {
        const c = RATING_COST[inst][band];
        const row = section.split('\n').find((l) => l.startsWith(`| ${inst} | ${band} |`));
        expect(row, `${inst} ${band}`).toBeDefined();
        const cells = row!.split('|').map((x) => x.trim());
        // | inst | band | ratings | measured | gap | mean ± se | [lo, hi] | …
        expect(Number(cells[3])).toBe(c.ratings);
        expect(Number(cells[4])).toBe(c.measured);
        expect(cells[6]).toMatch(new RegExp(`^${c.mean.toFixed(1)} ± `));
        expect(cells[7]).toBe(`[${c.lo.toFixed(1)}, ${c.hi.toFixed(1)}]`);
        // the report's "shown as" column is the rule's output
        const n = shownCost(inst, band);
        expect(cells[9]).toBe(n === null ? 'often costs nothing measurable' : `about ${n} points`);
      }
  });

  it('name the measurement', () => {
    expect(RATING_COST_SOURCE).toMatchObject({ date: '2026-11-25', simVersion: 9, bot: 'hard' });
    expect(section).toContain(`${RATING_COST_SOURCE.games} games`);
  });

  it('follow the rule written first: a whole-point mean when the 90% interval is above 0, else no figure', () => {
    for (const inst of INSTS)
      for (const band of BANDS) {
        const c = RATING_COST[inst][band];
        expect(c.lo).toBeLessThanOrEqual(c.mean);
        expect(c.hi).toBeGreaterThanOrEqual(c.mean);
        const n = shownCost(inst, band);
        if (c.lo > 0) {
          expect(n).toBe(Math.round(c.mean));
          expect(costWords(inst, band)).toBe(`about ${n}% win chance on average`);
          expect(costSentence(inst, band)).toMatch(new RegExp(`cost about ${n}% win chance on average when the Hard bot played on from them to the end \\(measured 2026-11-25\\)\\.$`));
        } else {
          expect(n).toBeNull();
          expect(costTag(inst, band)).toBe('often costs nothing measurable');
          expect(costSentence(inst, band)).toContain('often cost nothing measurable');
        }
      }
    expect(costNote('coach')).toContain(costLine('coach'));
    expect(costNote('review')).toContain('Hard bot');
  });
});

describe('ratings worded in win chance, not Gigs', () => {
  const grade = (verdict: MoveGrade['verdict'], gap: number, se = 0.1, confirmed?: number): MoveGrade => ({ turn: 3, chose: 'Play A', coach: 'Play B', gap, se, verdict, ...(confirmed ? { confirmed } : {}) });

  it("the coach's toast says what the band costs, never the gap", () => {
    for (const [v, gap, band] of [
      ['inaccuracy', 0.3, 'slip'],
      ['mistake', 0.6, 'slip'],
      ['mistake', 1.4, 'mistake'],
      ['mistake', 3.4, 'blunder'],
    ] as const) {
      const t = verdictText(grade(v, gap, 0.1, 16));
      expect(t).not.toMatch(/Gig/);
      expect(t).toContain('checked on 16 fresh play-outs');
      expect(t).toContain(coachCostWords(v, gap)!);
      const n = shownCost('coach', band);
      expect(t).toContain(n === null ? 'often cost nothing measurable' : `about ${n}% win chance on average`);
    }
    // a wide close call says it is too noisy, with no figure
    expect(verdictText(grade('close', 0.6, 0.4, 16))).not.toMatch(/Gig/);
    expect(verdictText(grade('close', 0.4, 0.01))).not.toMatch(/Gig/);
    expect(coachCostWords('close', 0.1)).toBeNull();
  });

  it("the coach's notes define a Gig as not win chance and name the measurement", () => {
    expect(GIG_NOTE).toContain('not win chance');
    expect(GIG_NOTE).toContain(COACH_COST_NOTE);
    expect(COACH_COST_NOTE).not.toMatch(/Gig/);
    expect(COACH_COST_NOTE).toContain('Hard bot');
  });

  const mv = (m: Partial<ReviewMove>): ReviewMove => ({ seq: 0, p: 0, at: 0, turn: 4, cat: 'unit', chosen: 'Play A', r: 'best', gap: 0, src: 'oracle', ...m });

  it("the review's move line says what the band costs, never the gap", () => {
    for (const [r, gap] of [
      ['slip', 0.3],
      ['mistake', 0.6],
      ['blunder', 1.4],
    ] as const) {
      const t = explain(mv({ r, gap, se: 0.1, best: 'Play B' }));
      expect(t).toBe(`The review preferred Play B. ${costSentence('review', r)}`);
      expect(t).not.toMatch(/Gig/);
      expect(costTagOf(mv({ r }))).toBe(costTag('review', r));
    }
    for (const m of [mv({ r: 'best', gap: 0.05, best: 'Play B' }), mv({ r: 'close', gap: 0.1, best: 'Play B' }), mv({ r: 'close', gap: 0.6, se: 0.4, best: 'Play B' }), mv({ r: 'close', gap: 0.4, se: 0.01, best: 'Play B' })])
      expect(explain(m)).not.toMatch(/Gig/);
    expect(saidText({ v: 'mistake', gap: 0.62, se: 0.1, best: 'Play B', why: '' }, 'unit')).not.toMatch(/Gig/);
  });

  it('the legend says what each costly band costs, and no threshold in Gigs', () => {
    for (const r of ['best', 'close', 'slip', 'mistake', 'blunder', 'unclear'] as const) expect(RATING_INFO[r].means).not.toMatch(/Gig/);
    for (const r of BANDS) expect(RATING_INFO[r].means).toContain(costSentence('review', r));
  });

  it('Play-out details keeps Gigs and says they are not win chance', () => {
    expect(REVIEW_GIG_NOTE).toContain('not win chance');
    expect(REVIEW_GIG_NOTE).toContain(costLine('review'));
  });

  it('accuracy is not claimed to pick the better of two strong players', () => {
    expect(ACCURACY_TEXT).toContain('not two strong players apart');
    expect(ACCURACY_TEXT).not.toMatch(/Gig/);
  });
});
