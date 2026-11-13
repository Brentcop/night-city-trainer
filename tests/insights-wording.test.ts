// The deck reports' insight lines (src/analysis/analyze.ts insights()) describe what was seen in bot games, with the
// sample, and never turn an association into advice: no "keep", "sell first", "cut" or "mulligan" drawn from a win-rate
// gap (docs/TUNING_STUDY_2026-11-13.md "Honesty rules for the view", rule 1; docs/RAG_PLAN.md step 0.3). The lines are
// stored in src/data/analysis.json (Card stats, Guides, the deck profile) and copied by scripts/plan.ts into the
// tournament plan and the Home recommendation, so the stored copies are checked too.
import { describe, expect, it } from 'vitest';
import analysis from '../src/data/analysis.json';
import { IWD_CAVEAT, insights, type CardStat, type DeckReport } from '../src/analysis/analyze';
import { CARDS, cardLabel } from '../src/engine/cards';
import { BUILTIN } from '../src/lib/browserLibrary';
import { RECOMMENDATION } from '../src/content/recommendation';
import { TOURNAMENT_PLAN } from '../src/content/tournamentPlan';

/** An instruction to the player: an imperative opening a sentence or clause, or a known advice phrase. */
const ADVICE: RegExp[] = [
  /(^|[.!?;] |, so |\band )(keep|sell|cut|mulligan|choose|pick|prioriti[sz]e|plan|close|consider|sideboard|avoid|hold|attack|play|register|don[’']t)\b/i,
  /\b(sell|cut|keep|mulligan) (these|them|it|this)\b/i,
  /\b(should|must|need to|have to|choose to go)\b/i,
  /\bcards that win\b|\bunderperform/i,
];
/** Card and deck names are not words of the sentence ("Johnny Silverhand: Never Stop Fighting"), so they go first. */
const NAMES = [...CARDS.map(cardLabel), ...(analysis as unknown as { decks: DeckReport[] }).decks.flatMap((d) => [d.deck, ...d.matchups.map((m) => m.opp)])]
  .filter((n) => n.length > 2)
  .sort((a, b) => b.length - a.length);
const withoutNames = (line: string) => NAMES.reduce((l, n) => (l.includes(n) ? l.split(n).join('NAME') : l), line);
const adviceIn = (line: string) => {
  const text = withoutNames(line).replace(/\*\*[^*]+:\*\*\s*/g, '');
  return ADVICE.find((re) => re.test(text))?.source ?? null;
};
/** A line that carries a card's win-rate gap when drawn (IWD): "+12 points" or "-7 points". */
const iwdFigure = /[+-]\d+ points/;

function problems(lines: string[]): string[] {
  const bad: string[] = [];
  for (const l of lines) {
    const advice = adviceIn(l);
    if (advice) bad.push(`advice (${advice}): ${l}`);
    if (iwdFigure.test(l) && !l.includes(IWD_CAVEAT)) bad.push(`a win-rate gap without the association caveat: ${l}`);
    if (!/\d+ games?\b/.test(l)) bad.push(`no sample: ${l}`);
  }
  return bad;
}

const card = (id: string, iwd: number, soldRate = 0.1, seenGames = 120): CardStat => ({
  id,
  name: id,
  seenGames,
  wrSeen: 0.5 + iwd / 2,
  wrNotSeen: 0.5 - iwd / 2,
  iwd,
  playedGames: seenGames,
  wrPlayed: 0.5,
  avgPlayTurn: 3,
  soldRate,
  openingGames: 30,
  wrOpening: 0.5,
  steals: 0.2,
});

/** A report that reaches every branch of insights(). */
function fixture(o: Partial<DeckReport> = {}): DeckReport {
  return {
    deck: 'Fixture Deck',
    games: 400,
    wr: 0.55,
    wrFirst: 0.64,
    wrSecond: 0.46,
    wrMulligan: 0.41,
    mulliganRate: 0.12,
    avgTurns: 9.2,
    overtimeRate: 0.3,
    overtimeWr: 0.6,
    avgFirstAttack: 2.1,
    gigAttacksPerGame: 3,
    unitAttacksPerGame: 1,
    tempo: [1, 2, 3, 4].map((turn) => ({ turn, leadWr: 0.8, leadN: 150, evenWr: 0.5, evenN: 100, behindWr: 0.3, behindN: 150 })),
    diffCurve: [],
    firstCall: [
      { name: 'Legend A', games: 90, wr: 0.6 },
      { name: 'Legend B', games: 80, wr: 0.5 },
    ],
    reactCallRate: 0.2,
    cards: [card('good_one', 0.12), card('good_two', 0.05, 0.6), card('plain', 0, 0.7), card('weak_one', -0.06, 0.5), card('weak_two', -0.09)],
    matchups: [
      { opp: 'Easy Rival', games: 100, wr: 0.7, wrFirst: 0.7, wrSecond: 0.7, avgTurns: 9, overtimeRate: 0.2, topCards: [], attackRate: 3 },
      { opp: 'Hard Rival', games: 100, wr: 0.4, wrFirst: 0.4, wrSecond: 0.4, avgTurns: 9, overtimeRate: 0.2, topCards: [], attackRate: 3 },
    ],
    winReasons: {},
    insights: [],
    ...o,
  };
}

describe('insight lines: observations with their sample, never advice from an association', () => {
  it('the detector catches the old advice wording', () => {
    const old = [
      '**Cards that win games:** A (+12 pts when drawn). Keep these over everything when you sell or mulligan.',
      '**Underperformers:** B (-7 pts). Sell these first, and consider cutting them or moving them to the sideboard.',
      '**Seat:** 64% on the play vs 46% on the draw. When you choose (you lost the last game), choose to go **first**.',
      '**Seat:** about even (50% on the play / 49% on the draw), so pick based on the matchup table below.',
      '**Tempo check:** after your 4th turn you win 80% when ahead on Gigs and 30% when behind. Early Gig pressure decides this deck’s games, so prioritise attacking the Gig area early.',
      '**Tempo check:** after your 4th turn you win 80% when ahead and 60% when behind. This deck recovers from early deficits, so don’t over-commit to early trades.',
      '**Overtime:** 30% of games reach overtime, and you win 60% of those. The deck is built for the long game; plan to be the one at 7 when overtime starts.',
      '**Overtime:** 30% of games reach overtime, and you win 40% of those. You do worse in long games, so close it out before both players run out of dice.',
      "**Reactive Calls:** 20% of Legend Calls happen during the rival's attack, so keep 1 €$ open on the rival's turn.",
      '**Best matchup:** X (70%). **Worst:** Y (40%). Sideboard for the worst one first.',
    ];
    for (const l of old) expect(adviceIn(l), l).not.toBeNull();
    // and a win-rate gap stated without its caveat
    expect(problems(['**Cards most associated with wins:** A (+12 points, drawn in 120 games).'])).toHaveLength(1);
  });

  it('insights() on a fixture: every branch, no advice, the association caveat on every win-rate gap, a sample on every line', () => {
    const lines = insights(fixture());
    expect(lines.map((l) => l.match(/^\*\*([^*]+):\*\*/)?.[1])).toEqual([
      'Seat',
      'Cards most associated with wins',
      'Cards most associated with losses',
      'Usual Eddie fodder',
      'Tempo check',
      'Overtime',
      'Mulligans',
      'First Legend flipped',
      'Reactive Calls',
      'Best matchup',
    ]);
    expect(problems(lines)).toEqual([]);
    expect(lines[1]).toContain('good_one (+12 points, drawn in 120 games)');
    expect(lines[2]).toContain('weak_two (-9 points, drawn in 120 games)');
    // the even-seat line and a weaker tempo gap say no more than the numbers either
    const even = insights(fixture({ wrFirst: 0.55, wrSecond: 0.53, overtimeWr: 0.4 }));
    expect(even[0]).toMatch(/^\*\*Seat:\*\* about even in 400 games/);
    expect(problems(even)).toEqual([]);
  });

  it('the stored reports (src/data/analysis.json) say the same', () => {
    const decks = (analysis as unknown as { decks: DeckReport[] }).decks;
    expect(decks.length).toBeGreaterThan(0);
    for (const d of decks) expect(problems(d.insights), d.deck).toEqual([]);
  });

  it('the texts copied from them (tournament plan, Home recommendation) carry none of the old advice', () => {
    for (const text of [TOURNAMENT_PLAN, RECOMMENDATION]) {
      expect(text).not.toMatch(/Cards that win games|Underperformers|Keep these over everything|Sell these first|Sideboard for the worst/);
      const copied = text.split('\n').filter((l) => /^\s*- \*\*(Seat|Cards most associated|Usual Eddie|Tempo check|Overtime|Mulligans|First Legend|Reactive Calls|Best matchup)\b/.test(l));
      expect(problems(copied.map((l) => l.replace(/^\s*- /, '')))).toEqual([]);
    }
  });

  it('Home still finds its pick in the recommendation: the first bold name and the backup are library decks', () => {
    // the same two patterns as recommended() in src/ui/pages/Home.tsx; the copied insight lines come after them
    const names = new Set(BUILTIN.map((d) => d.deck.name));
    expect(names.has(RECOMMENDATION.match(/\*\*([^*]+)\*\*/)?.[1] ?? '')).toBe(true);
    expect(names.has(RECOMMENDATION.match(/Backup: \*\*([^*]+)\*\*/)?.[1] ?? '')).toBe(true);
  });
});
