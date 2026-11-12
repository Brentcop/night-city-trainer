// The Card stats page's Synergies view (src/ui/components/SynergyStats.tsx) and the deck profile's "Synergies in this
// list" block (DeckSynergies.tsx): an empty state that says how the report is made, rates only for slices with enough
// games, the draw odds from the catalogue, and the report never in the entry data. Server-rendered: no DOM here.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SynergyReportView } from '../src/ui/components/SynergyStats';
import { DeckSynergies } from '../src/ui/components/DeckSynergies';
import { readSynergyReport } from '../src/ui/synergyReport';
import { aggregateSynergyGame, mergeSynergyAggregates, synergyReport, type SynergyGame } from '../src/analysis/synergies';
import { BUILTIN } from '../src/lib/browserLibrary';
import { synergiesIn } from '../src/content/synergies';
import type { PlayerId } from '../src/engine/types';

const P0 = {
  listId: 'L0',
  name: 'Min Gig',
  legends: ['jackie_welles_pour_one_out_for_me', 'alt_cunningham_soulkiller_architect', 'wakako_okada_peace_and_harmony'],
  main: [...Array(3).fill('trust_no_one'), ...Array(3).fill('three_mouths_one_desire'), ...Array(34).fill('psycho_squad')] as string[],
};
const P1 = { listId: 'L1', name: 'Plain', legends: ['v_corporate_exile', 'rogue_amendiares_preem_solo', 'sasha_yakovleva_won_t_let_you_down'], main: Array(40).fill('psycho_squad') as string[] };
const board = (t: number, gigs: [number, number][]) => ({ t, p: 0 as PlayerId, at: 'end' as const, units: [], gear: [], equipped: 0, legends: ['alt_cunningham_soulkiller_architect'], legendsUp: 1, gigs, cred: null, opCred: null, opGigs: 0, opUnits: 0, trash: {} });
const game = (winner: PlayerId, online: boolean): SynergyGame => ({
  players: [P0, P1],
  first: 0,
  turns: 8,
  winner,
  records: [],
  sightings: [],
  boards: [board(3, online ? [[4, 1]] : [[4, 3]])],
});

describe('Synergies view', () => {
  it('with no report, says how to make one', () => {
    for (const loaded of [readSynergyReport(null), readSynergyReport({ kind: 'decision-telemetry', decks: [] })]) {
      const html = renderToStaticMarkup(<SynergyReportView loaded={loaded} />);
      expect(html).toContain('No synergy report');
      expect(html).toContain('npm run sim -- analyze --synergies');
    }
  });

  it('shows assembled and online rates, odds, and win rates only where the sample allows', () => {
    // 24 games online (18 won), 6 never online
    const aggs = [...Array.from({ length: 24 }, (_, k) => aggregateSynergyGame(game(k < 18 ? 0 : 1, true))), ...Array.from({ length: 6 }, () => aggregateSynergyGame(game(1, false)))];
    const loaded = readSynergyReport(JSON.parse(JSON.stringify(synergyReport(mergeSynergyAggregates(...aggs)))));
    expect(loaded.state).toBe('ready');
    if (loaded.state === 'ready') expect(loaded.current).toBe(true);
    const html = renderToStaticMarkup(<SynergyReportView loaded={loaded} deck="Min Gig" />);
    expect(html).toContain('Association, not value.');
    expect(html).toContain('Low Gigs (min Gig)');
    expect(html).toContain('built around');
    expect(html).toContain('24/30'); // online in 24 of 30 games
    expect(html).toContain('75%'); // won 18 of 24 when online
    expect(html).toMatch(/class="num thin"[^>]*>n=6</); // never online: too few games for a rate
    expect(html).toMatch(/aria-pressed="true"[^>]*>This list/);
    // a report from another catalogue says so
    const stale = readSynergyReport({ ...JSON.parse(JSON.stringify(synergyReport(mergeSynergyAggregates(...aggs)))), catalogueVersion: 'fnv1a64:old' });
    expect(renderToStaticMarkup(<SynergyReportView loaded={stale} />)).toContain('earlier version of the synergy catalogue');
  });

  it('the deck profile lists the packages a library deck holds, with copies and odds', () => {
    const d = BUILTIN.find((x) => x.file === 'meta-bbg-cunningham-econ.txt')!;
    const found = synergiesIn(d.deck);
    expect(found.some((x) => x.synergy.id === 'min-gig' && x.builtAround)).toBe(true);
    const html = renderToStaticMarkup(<DeckSynergies deck={d.deck} named={['min-gig']} />);
    expect(html).toContain('Synergies in this list');
    expect(html).toContain('Low Gigs (min Gig)');
    expect(html).toContain('in the game plan');
    expect(html).toMatch(/\d+%/);
  });

  it('no synergy report is bundled with the site; a published one reads', () => {
    expect(fs.existsSync('src/data/synergies.json')).toBe(false);
    if (fs.existsSync('public/data/synergies.json')) expect(readSynergyReport(JSON.parse(fs.readFileSync('public/data/synergies.json', 'utf8'))).state).toBe('ready');
  });
});
