// The outside picture on screen (components/OutsidePicture.tsx), with invented figures on real Legends: every row says
// its site, links to the page and gives the day it was collected; the deck block says the list may differ; Power ratings
// keeps the other site's columns apart from ours and says how much of the field the library covers; nothing shows for a
// trio no source has.
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN } from '../src/lib/browserLibrary';
import { coverageWords, DeckOutsidePanel, OutsidePictureSection, outsideCreditRow } from '../src/ui/components/OutsidePicture';
import type { OutsideMetaFile, OutsideTrio } from '../src/lib/outsideMeta';
import { CARD_BY_ID } from '../src/engine/cards';
import { setArtEnabled } from '../src/ui/art';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setArtEnabled(false);
});
afterEach(() => vi.unstubAllGlobals());

const deck = BUILTIN.find((d) => d.file === 'import-ladder-s1-1-v-smasher-padre-rrg.txt')!;
const meta = BUILTIN.find((d) => d.file === 'meta-bbg-cunningham-econ.txt')!;
const trio = (ids: readonly string[]): OutsideTrio => ({ names: ids.map((id) => CARD_BY_ID[id]!.name), ids: [...ids] });
const T = trio(deck.deck.legends);
const NOBODY: OutsideTrio = { names: ['Made', 'Up', 'Trio'], ids: [null, null, null] };

const DATA: OutsideMetaFile = {
  kind: 'nct-outside-meta',
  schema: 1,
  updated: '2026-11-18',
  unmatched: ['Made', 'Up', 'Trio'],
  sources: [
    {
      id: 'sim:made-up-season',
      kind: 'season',
      site: 'cyberpunk-tcg-sim.online',
      title: 'Made-up season report',
      link: 'https://cyberpunk-tcg-sim.online/meta/made-up-season',
      collected: '2026-11-18',
      published: '2026-11-15',
      shareOf: 'high-rank decks (both players in Division III or Master)',
      period: { from: '2026-09-01', to: '2026-11-15' },
      totals: { series: 1000 },
      field: [
        { trio: NOBODY, share: 30, winRate: 49 },
        { trio: T, share: 12.5, winRate: 53.3, wins: 160, losses: 140, players: 40 },
      ],
      tiers: [{ rank: 2, trio: T, tier: 1, winRate: 53.3, wins: 160, losses: 140, share: 12.5, players: 40 }],
      matchups: [],
    },
    {
      id: 'sim:made-up-cup',
      kind: 'tournament',
      site: 'cyberpunk-tcg-sim.online',
      title: 'Made-up Cup',
      link: 'https://cyberpunk-tcg-sim.online/meta/made-up-cup',
      collected: '2026-11-17',
      published: '',
      shareOf: 'players in the event',
      date: '2026-11-07',
      totals: { players: 40 },
      field: [{ trio: T, share: 10, players: 4, winRate: 60, wins: 12, losses: 8, top8: 1, best: 3 }],
      topCut: [{ place: 3, trio: T }],
    },
  ],
};

describe('a deck page: What other sites say', () => {
  it('shows each source with its numbers, its link and the day it was collected, and says the list may differ', () => {
    const html = renderToStaticMarkup(<DeckOutsidePanel d={deck} lib={BUILTIN} data={DATA} />);
    expect(html).toContain('What other sites say');
    expect(html).toContain('Same Legends; the list may differ');
    expect(html).toContain('never mixed into them');
    expect(html).toContain('Ranked <b>#2</b> of its top 1, the site’s <b>tier 1</b>');
    expect(html).toContain('53.3% over 300 games');
    expect(html).toContain('<b>12.5%</b> of high-rank decks');
    expect(html).toContain('href="https://cyberpunk-tcg-sim.online/meta/made-up-season"');
    expect(html).toContain('(2026-09-01 to 2026-11-15) · collected 2026-11-18');
    expect(html).toContain('Brought by <b>4</b> of 40 players (10.0%)');
    expect(html).toContain('top cut: <b>3rd</b>');
    expect(html).toContain('(played 2026-11-07) · collected 2026-11-17');
    expect(html).toMatch(/aria-labelledby="[^"]+"/);
  });
  it('shows choom.gg’s hand rating, labelled the same way, for a deck with an archetype’s Legends', () => {
    const html = renderToStaticMarkup(<DeckOutsidePanel d={meta} lib={BUILTIN} data={null} />);
    expect(html).toContain('choom.gg tier S');
    expect(html).toContain('BBG Cunningham Econ');
    expect(html).toContain('rated by hand by the choom.gg editors, not computed from results');
    expect(html).toContain('href="https://choom.gg/meta/bbg-cunningham-econ"');
    expect(html).toContain('collected 2026-11-09');
  });
  it('shows nothing for a trio no source has', () => {
    const other = BUILTIN.find((d) => d.deck.legends.length === 3 && !d.deck.legends.every((id) => deck.deck.legends.includes(id)) && !BUILTIN.some((m) => m.file.startsWith('meta-') && [...m.deck.legends].sort().join() === [...d.deck.legends].sort().join()))!;
    expect(renderToStaticMarkup(<DeckOutsidePanel d={other} lib={BUILTIN} data={DATA} />)).toBe('');
  });
});

describe('Power ratings: The outside picture', () => {
  it('keeps the site’s columns and ours apart, in the site’s order, each source cited', () => {
    const html = renderToStaticMarkup(<OutsidePictureSection lib={BUILTIN} data={DATA} />);
    expect(html).toContain('The outside picture');
    expect(html).toContain('cyberpunk-tcg-sim.online says');
    expect(html).toContain('Our library (same Legends; the list may differ)');
    expect(html.indexOf('Made / Up / Trio')).toBeLessThan(html.indexOf(T.names.join(' / ')));
    expect(html).toContain(`href="#/deck?d=${encodeURIComponent(deck.file)}"`);
    expect(html).toContain('none in the library');
    expect(html).toContain('choom.gg’s Night City Meta');
    expect(html).toContain('collected 2026-11-09');
    expect(html).toContain('#2, tier 1');
  });
  it('says how much of the field the library covers by trio', () => {
    const words = coverageWords(DATA.sources[0]!, BUILTIN);
    expect(words).toBe(
      'Our library plays the Legends of 1 of the 2 trios this report lists, 12.5% of its high-rank decks (both players in Division III or Master). The report breaks 42.5% of them down by trio; the other 57.5% are trios it does not list one by one. Listed but not in our library: Made / Up / Trio (30.0%).',
    );
  });
  it('without collected reports it still shows choom.gg, and the Credits row is left out', () => {
    const html = renderToStaticMarkup(<OutsidePictureSection lib={BUILTIN} data={null} />);
    expect(html).toContain('choom.gg’s Night City Meta');
    expect(html).not.toContain('cyberpunk-tcg-sim.online says');
    expect(outsideCreditRow(null)).toBeNull();
    expect(outsideCreditRow(DATA)?.[1]).toContain('never mixed into them; collected 2026-11-18');
  });
});
