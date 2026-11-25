// The coach's words (review 2026-11-13, COACH-1 … COACH-12): one formatter for a value gap that never prints more Gigs
// than can exist, the Game review's grade names in the toast and the scorecard, agreeing on a rule-decided choice is
// not measured, the board's option names, the mulligan's reason, and no empty or repeated alternatives.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { Game } from '../src/engine/engine';
import { parseDeck } from '../src/engine/deck';
import { makeTierBot } from '../src/ai/tiers';
import { DECIDED_EVAL, GIG_SWING } from '../src/ai/eval';
import { plainRuleMulligan } from '../src/ai/mulligan';
import { adviseRequest, COACH_CONFIG, coachRequest, coachWorthAsking, gradeMove, makeCoach, mulliganWhy, scoreMoveRequest, type Advice, type MoveGrade } from '../src/ai/coach';
import { behindText, coachCostWords, coachTablesWords, DECIDED_GIGS, gapFigure, optionName, shownLabel, verdictName } from '../src/lib/coachWords';
import { BLUNDER_GIGS, CAP_GIGS, coachRatingOf, MISTAKE_GIGS, RATING_INFO } from '../src/lib/gameReview';
import { CoachBox, CoachPanel, MoveToast, Scorecard, verdictText } from '../src/ui/components/board/CoachPanel';
import { restoredGrades, type SavedGame } from '../src/lib/savedGames';
import type { CoachedGrade } from '../src/lib/coachedReplay';
import type { Agent, Decision, DeckList } from '../src/engine/types';

/** Every "N Gigs" / "N ± M Gigs" figure in a text, as numbers (both the gap and its spread). */
const figures = (t: string) => [...t.matchAll(/(\d+(?:\.\d+)?)(?: ± (\d+(?:\.\d+)?))? Gigs/g)].flatMap((m) => [+m[1]!, ...(m[2] ? [+m[2]] : [])]);

describe('one formatter for a value gap', () => {
  it('the decided line is the evaluation’s', () => {
    expect(DECIDED_GIGS).toBe(DECIDED_EVAL / GIG_SWING);
  });
  it('a figure up to the cap, "more than 3 Gigs" past it, and a game-deciding gap in words', () => {
    expect(behindText(0.42, 0.11)).toBe('−0.4 ± 0.1 Gigs');
    expect(behindText(0.3, 0.01)).toBe('−0.3 Gigs'); // a spread that rounds to 0.0 is left out
    expect(behindText(2.96)).toBe('−3.0 Gigs');
    expect(behindText(3.2, 0.4)).toBe('more than 3 Gigs behind');
    expect(behindText(220.9)).toBe('decides the game in the play-outs');
    expect(gapFigure(1.24)).toBe('1.2 Gigs');
    expect(gapFigure(76)).toBe('more than 3 Gigs');
    expect(gapFigure(260)).toBe('a game-deciding amount');
    expect(behindText(1.6, 4.2)).toBe('−1.6 ± more than 3 Gigs');
    for (const g of [0, 0.1, 1, 2.99, 3, 3.01, 7, 50, 124.9, 125, 250, 1e4]) for (const se of [undefined, 0.2, 5]) expect(Math.max(0, ...figures(behindText(g, se)), ...figures(gapFigure(g, se)))).toBeLessThanOrEqual(CAP_GIGS);
  });
});

describe('names a player reads', () => {
  it('the board’s names for passing, declining a reaction and the opening hand', () => {
    expect(shownLabel('Pass turn')).toBe('End turn');
    expect(shownLabel('No (more) reactions')).toBe('No reaction');
    expect(shownLabel('Play X (3 €$)')).toBe('Play X (3 €$)');
    const mull = { kind: 'yesno', tag: 'mulligan', options: [{ label: 'Yes', key: 'yes' }, { label: 'No', key: 'no' }] };
    expect(optionName(mull, 0)).toBe('Mulligan');
    expect(optionName(mull, 1)).toBe('Keep hand');
  });
  it('verdicts read with the Game review’s rating names', () => {
    expect(verdictName('agree', 0)).toBe(RATING_INFO.best.label);
    expect(verdictName('best', -0.1)).toBe('Best');
    expect(verdictName('close', 0.4)).toBe('Close call');
    expect(verdictName('inaccuracy', 0.2)).toBe('Slip');
    // by the gap and the current lines (Mistake from MISTAKE_GIGS, Blunder from BLUNDER_GIGS): a 'mistake' stored from
    // 0.375 Gigs before the lines were raised (2026-11-25) reads as a Slip
    expect(verdictName('mistake', MISTAKE_GIGS - 0.05)).toBe('Slip');
    expect(verdictName('mistake', MISTAKE_GIGS)).toBe('Mistake');
    expect(verdictName('mistake', BLUNDER_GIGS - 0.05)).toBe('Mistake');
    expect(verdictName('mistake', BLUNDER_GIGS)).toBe('Blunder');
    expect(verdictName('mistake', null)).toBe('Mistake');
    expect(verdictName('unscored', null)).toBeNull();
  });
});

const decision = (kind: Decision['kind'], labels: string[], tag?: string): Decision => ({ player: 0, kind, ...(tag ? { tag } : {}), prompt: '?', options: labels.map((label) => ({ label })), min: 1, max: 1 });
const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
const scored = (worlds: number[][]): Advice => ({
  index: 0,
  why: '',
  alternatives: [],
  grade: { kind: 'main', opts: worlds.map((w, i) => ({ i, v: mean(w), w })), worlds: worlds[0]!.map((_, k) => ({ rng: k, a: k, b: k })) },
});

describe('agreeing is measured only where the coach measures', () => {
  it('a rule-decided choice that matches the coach is not measured, and the toast says so', () => {
    const d = decision('unit', ['Unit A', 'Unit B']);
    const gr = gradeMove(d, 0, { index: 0, why: '', alternatives: [] }, 2);
    expect(gr).toMatchObject({ verdict: 'unscored', gap: null });
    expect(verdictText(gr)).toBe("Same as the coach's pick (not measured)");
    expect(verdictText(gradeMove(d, 1, { index: 0, why: '', alternatives: [] }, 2))).toBe('Coach picked Unit A (not measured)');
  });
  it('another copy of the coach’s pick (the same name) agrees; names are the board’s', () => {
    const d = decision('action', ['Play X (3 €$)', 'Play X (3 €$)', 'Pass turn']);
    const a = scored([[100, 120, 90], [99, 121, 91], [60, 50, 40]]);
    expect(gradeMove(d, 1, a, 2)).toMatchObject({ verdict: 'agree', gap: 0 });
    const pass = gradeMove(d, 2, a, 2);
    expect(pass.chose).toBe('End turn');
    expect(verdictText(pass)).toContain('the coach preferred Play X (3 €$)');
  });
  it('a game-deciding gap never prints its raw size', () => {
    const d = decision('action', ['Attack', 'Pass turn']);
    const a = scored([[10_050, 10_020, 10_100], [40, 60, 20]]);
    const gr = gradeMove(d, 1, a, 5);
    expect(gr.gap).toBeGreaterThan(200); // kept raw for the export and the review
    expect(verdictText(gr)).toBe(`Blunder: the coach preferred Attack (${coachCostWords(gr.verdict, gr.gap)})`);
    expect(verdictText(gr)).not.toMatch(/Gig/);
  });
  it('the scorecard leaves unmeasured choices out of its count, and shows no letter when nothing was measured', () => {
    const g = (verdict: MoveGrade['verdict']): MoveGrade => ({ turn: 1, chose: 'A', coach: 'A', gap: verdict === 'unscored' ? null : 0, verdict });
    const html = renderToStaticMarkup(<Scorecard grades={[g('unscored'), g('unscored')]} />);
    expect(html).toContain('no decision that mattered was measured');
    expect(html).not.toContain('scorecard-grade');
    expect(html).not.toContain('100%');
    expect(renderToStaticMarkup(<Scorecard grades={[g('agree'), g('unscored')]} />)).toContain('Handled well: 1 of 1 decision that mattered (100%)');
    // REVIEW_2026-11-25 C3: a decision with no clear difference is left out, and said apart
    const unclear = renderToStaticMarkup(<Scorecard grades={[g('agree'), g('unclear'), g('unclear')]} />);
    expect(unclear).toContain('Handled well: 1 of 1 decision that mattered (100%)');
    expect(unclear).toContain('2 decisions made no clear difference (not counted).');
    // the headline is the costly moves, each confirmed
    // a costly move is a Mistake or Blunder (since 2026-11-25 a Mistake marks a measurable cost); Slips are said apart
    const costly = renderToStaticMarkup(
      <Scorecard grades={[g('agree'), { ...g('mistake'), gap: 1.2, se: 0.1, confirmed: 16 }, { ...g('mistake'), gap: 0.5, se: 0.1, confirmed: 16 }, { ...g('inaccuracy'), gap: 0.2, se: 0.05, confirmed: 16 }]} />,
    );
    expect(costly).toContain('Costly moves: 1 (1 Mistake), each checked on fresh play-outs');
    expect(costly).toContain('2 Slips: behind the coach’s pick in its play-outs by less than a Mistake');
    expect(costly).toContain('Handled well: 1 of 4 decisions that mattered (25%)');
    const slipsOnly = renderToStaticMarkup(<Scorecard grades={[g('agree'), { ...g('inaccuracy'), gap: 0.2, se: 0.05, confirmed: 16 }]} />);
    expect(slipsOnly).toContain('No costly moves against the coach’s pick');
    expect(slipsOnly).toContain('1 Slip: behind');
  });
  it('older records: a stored rule-decided "agree" is read as not measured', () => {
    const rec = { at: 3, turn: 2, options: ['A', 'B'], chose: 0, coach: 0, why: '', verdict: 'agree', gap: 0, scores: [] };
    expect(coachRatingOf({ ...rec, kind: 'gig' })).toBeNull();
    const scored = { ...rec, scores: [{ i: 0, v: 10 }, { i: 1, v: 0 }] };
    expect(coachRatingOf({ ...scored, kind: 'action', scoreKind: 'main' })).not.toBeNull();
    expect(coachRatingOf(scored)).not.toBeNull(); // no kind recorded: read as before
    // agreeing when the coach scored no other option measured nothing either: left to the review (REV-11)
    expect(coachRatingOf({ ...rec, kind: 'action', scoreKind: 'main' })).toBeNull();
    const grade = (kind: string): CoachedGrade => ({ turn: 1, chose: 'A', coach: 'A', gap: 0, verdict: 'agree', record: { at: 1, kind, verdict: 'agree', gap: 0 } as unknown as CoachedGrade['record'] });
    const back = restoredGrades({ grades: [grade('gig'), grade('action')] } as unknown as SavedGame);
    expect(back.map((x) => [x.verdict, x.record?.verdict])).toEqual([
      ['unscored', 'unscored'],
      ['agree', 'agree'],
    ]);
  });
});

describe('the coach box', () => {
  it('says it is thinking while advice is on its way', () => {
    expect(renderToStaticMarkup(<CoachBox thinking />)).toContain('thinking…');
    expect(renderToStaticMarkup(<CoachBox />)).toBe('');
  });
  it('shows the reason as text and the best other option (phones get a Why? toggle, never a tooltip)', () => {
    const next = { index: 2, label: 'Attack with Y (4) → Gig area', gap: '−0.4 ± 0.1 Gigs', gapGigs: 0.4, close: false };
    const desk = renderToStaticMarkup(<CoachBox pick="End turn" why="End turn: nothing else scores better." next={next} />);
    expect(desk).toContain('End turn: nothing else scores better.');
    expect(desk).toContain('Next best:');
    expect(desk).toContain('−0.4 ± 0.1 Gigs');
    const phone = renderToStaticMarkup(<CoachBox pick="End turn" why="End turn: nothing else scores better." next={next} compact className="pb-pp-coach" />);
    expect(phone).toContain('End turn: nothing else scores better.');
    expect(phone).toContain('Why?');
    expect(phone).not.toContain('title=');
  });
});

const deck = (f: string): DeckList => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;

describe('the mulligan', () => {
  it('the coach uses the plain keep rule and says what it looks at', async () => {
    expect(COACH_CONFIG.mulligan).toBe('plain');
    const idle: Agent = { name: 'idle', decide: async () => [0] };
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const g = Game.create([deck('meta-rrb-wakako-midrange.txt'), deck('meta-bbg-cunningham-econ.txt')], [idle, idle], { seed, first: 0, log: false });
      const mull = plainRuleMulligan(g, 0);
      expect(makeCoach().wantsMulligan(g, 0)).toBe(mull);
      const why = mulliganWhy(g, 0, mull);
      expect(why.startsWith(mull ? 'Mulligan: this hand has' : 'Keep: this hand has')).toBe(true);
      expect(why).toContain('at least one Unit costing 4 or less, three cards costing 4 or less and a card it can sell');
    }
  });
});

/** Seat 0: plays as a bot, asks the coach at each decision it would ask in play, grades the bot's move and keeps every text. */
class Sampler implements Agent {
  name = 'You';
  confirmsEndTurn = true;
  texts: { why: string; alts: string[]; toast: string; pick: string; altLabels: string[] }[] = [];
  asked = 0;
  constructor(private brain: Agent) {}
  async decide(g: Game, d: Decision): Promise<number[]> {
    const r = await this.brain.decide(g, d);
    if (!coachWorthAsking(d)) return r;
    this.asked++;
    const req = coachRequest(g, d);
    const a = await adviseRequest(req);
    let gr = gradeMove(d, r[0]!, a, g.s.turn);
    if (gr.verdict === 'pending') gr = gradeMove(d, r[0]!, a, g.s.turn, await scoreMoveRequest({ req, chosen: r[0]!, coach: a.index, grade: a.grade }));
    this.texts.push({ why: a.why, alts: a.alternatives.map((x) => `${x.label} ${x.gap}`), toast: verdictText(gr), pick: optionName(d, a.index), altLabels: a.alternatives.map((x) => x.label) });
    renderToStaticMarkup(<MoveToast gr={gr} />);
    return r;
  }
}

describe('what the coach prints over whole games', () => {
  it('no reason, alternative or toast claims more Gigs than the cap; no repeated alternatives; the board’s names', async () => {
    const all: Sampler['texts'] = [];
    for (const [a, b, seed] of [
      ['meta-gry-trauma-team.txt', 'meta-rry-smasher-aggro.txt', 202],
      ['meta-rrb-wakako-midrange.txt', 'meta-bbg-cunningham-econ.txt', 101],
    ] as const) {
      const s = new Sampler(makeTierBot('hard', seed));
      const g = Game.create([deck(a), deck(b)], [s, makeTierBot('hard', seed + 1)], { seed, first: 0, log: false });
      await g.run();
      expect(s.asked).toBeGreaterThan(20);
      all.push(...s.texts);
    }
    for (const t of all) {
      for (const text of [t.why, ...t.alts, t.toast]) {
        expect(Math.max(0, ...figures(text)), text).toBeLessThanOrEqual(CAP_GIGS);
        expect(text).not.toMatch(/Pass turn|No \(more\) reactions/);
        expect(text).not.toMatch(/roughly even with passing|the alternatives are worse/);
      }
      expect(t.altLabels).not.toContain(t.pick);
      expect(new Set(t.altLabels).size).toBe(t.altLabels.length);
    }
    // the mulligan has a reason, and these games reach gaps past the cap (so the capped wording is exercised)
    expect(all.some((t) => /^(Keep|Mulligan): this hand has/.test(t.why))).toBe(true);
    expect(all.some((t) => [t.why, ...t.alts].some((x) => /more than 3 Gigs|in the (coach's )?play-outs/.test(x)))).toBe(true);
  }, 180_000);
});

describe('where the coach’s card figures come from (A.11)', () => {
  it('names the bot and simulator version, and says when it is not the Hard bot', () => {
    expect(coachTablesWords('deep', 9)).toBe(
      "Card figures in these tips come from the Deep bot's games (simulator version 9), not the Hard bot the site's ratings use: they say what that bot did with a card, not how good the card is.",
    );
    expect(coachTablesWords('hard', 9)).toBe("Card figures in these tips come from the Hard bot's games (simulator version 9): they say what that bot did with a card, not how good the card is.");
    expect(coachTablesWords(null, 9)).toBeNull();
  });

  it('the panel shows it under the tips, and Play passes the analysis run’s bot', () => {
    const html = renderToStaticMarkup(<CoachPanel g={null as never} v={0} alts={[]} tips={['a tip']} warnings={[]} source="SOURCE LINE" />);
    expect(html).toContain('SOURCE LINE');
    expect(readFileSync('src/ui/pages/Play.tsx', 'utf8')).toContain('coachTablesWords(ANALYSIS_SUMMARY.bot, ANALYSIS_SUMMARY.manifest?.simVersion)');
  });
});
