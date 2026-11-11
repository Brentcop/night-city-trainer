// The Card stats page's Decisions view (src/ui/components/DecisionStats.tsx): an empty state that says how the report
// is made, rates only for slices with enough games (thin ones underlined with their size), and no report bundled in the
// entry data. Server-rendered to HTML: there is no DOM here.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DecisionReportView, readReport } from '../src/ui/components/DecisionStats';
import { aggregateDecisions, decisionReport } from '../src/analysis/decisions';
import type { DecisionRecord, SideFeatures } from '../src/engine/telemetry';

const side = (): SideFeatures => ({ gigs: 0, cred: 0, units: 0, power: 0, ready: 0, eddies: 0, eddiesTotal: 0, payable: 0, hand: 0, deck: 0, legendsUp: 0 });
const play = (t: number, ch: string): DecisionRecord => ({ i: 0, t, p: 0, kind: 'action', w: 'main', o: ['pass', 'play:psycho_squad'], n: 2, c: [ch === 'pass' ? 0 : 1], ch: [ch], f: { me: side(), op: side(), lead: 0, active: true } });
const players = [
  { listId: 'L0', name: 'Deck Zero' },
  { listId: 'L1', name: 'Deck One' },
] as const;

describe('Decisions view', () => {
  it('with no report, says how to make one', () => {
    for (const loaded of [readReport(null), readReport({ kind: 'something-else' })]) {
      const html = renderToStaticMarkup(<DecisionReportView loaded={loaded} />);
      expect(html).toContain('No decisions report');
      expect(html).toContain('npm run sim -- analyze --decisions');
    }
    expect(renderToStaticMarkup(<DecisionReportView loaded={readReport({ kind: 'decision-telemetry', decks: [], telemetrySchema: 99 })} />)).toContain('schema 99');
  });

  it('shows uses, availability and win rates with intervals; thin slices show only their size', () => {
    // 25 games played on turn 1 (24 won), 5 games where it was legal but passed
    const games = [
      ...Array.from({ length: 25 }, (_, k) => ({ records: [play(1, 'play:psycho_squad')], players, winner: (k === 0 ? 1 : 0) as 0 | 1 })),
      ...Array.from({ length: 5 }, () => ({ records: [play(9, 'pass')], players, winner: 1 as const })),
      // and sold in 3 games: too few for a rate
      ...Array.from({ length: 3 }, () => ({ records: [{ ...play(5, 'pass'), o: ['pass', 'sell:psycho_squad'], ch: ['sell:psycho_squad'], c: [1] }], players, winner: 0 as const })),
    ];
    const loaded = readReport(JSON.parse(JSON.stringify(decisionReport(aggregateDecisions(games)))));
    expect(loaded.state).toBe('ready');
    const html = renderToStaticMarkup(<DecisionReportView loaded={loaded} deck="Deck Zero" />);
    expect(html).toContain('Association, not value.');
    expect(html).toContain('Psycho Squad');
    expect(html).toContain('30 → 25'); // legal on 30 turns, used on 25
    expect(html).toMatch(/class="num thin"[^>]*>n=3</);
    expect(html).toContain('17%'); // not taken on 5 of 30
    expect(html).toContain('96%'); // won 24 of 25
    expect(html).toMatch(/80–99 · n=25/); // Wilson interval for 24/25
    expect(html).toMatch(/aria-pressed="true"[^>]*>This list/);
    expect(html).toContain('<label');
  });

  it('no decisions report is bundled with the site', () => {
    expect(fs.existsSync('src/data/decisions.json')).toBe(false);
    expect(readReport(fs.existsSync('public/data/decisions.json') ? JSON.parse(fs.readFileSync('public/data/decisions.json', 'utf8')) : null).state).not.toBe('stale');
  });
});
