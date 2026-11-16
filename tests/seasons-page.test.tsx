// The Seasons page (src/ui/pages/Seasons.tsx, words and rows in src/lib/bredDecks.ts; docs/SYNERGIES.md "A bred deck's
// test against its parent"): "Bred decks, then and now" (the season's round robin beside the rating now and the best
// parent's, with the test at entry or "not tested before entering"), the decks a season's test did not let in, and the
// leaderboard's "older simulator" marks with the intro's sentence. Rendered with fixtures: a gated season (decks that
// entered and one that did not, its tests made by the real rule on faked games) and an ungated one; a stale and a
// current leaderboard row. Also the bundled data, where every row is stale and no season was tested.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DeckList } from '../src/engine/types';
import { RATINGS, SEASONS, type LeaderRow, type SeasonGate, type SeasonGateDeck, type SeasonRecord, type SeasonsData } from '../src/data/index';
import { BUILTIN } from '../src/lib/browserLibrary';
import { gateField, runGate, type GateEntry, type GatePlay, type ReferenceWhy } from '../src/lib/breedGate';
import { bredThenAndNow, leaderboardStaleWords, NOT_TESTED, notEntered, ratingNowWords, seasonTestWords, stepFigureWords, thenAndNowIntro, verdictAgainst } from '../src/lib/bredDecks';
import { rankLibraryParents } from '../src/lib/parentStrength';
import { SeasonsView } from '../src/ui/pages/Seasons';
import { setArtEnabled } from '../src/ui/art';

setArtEnabled(false);

const fake = (name: string, n: number): DeckList => ({ name, legends: [`legend_${n}`], main: [`card_${n}`], sideboard: [] });
const META = ['RRG Dexter Midrange', 'BBG Cunningham Econ', 'Meta 3', 'Meta 4', 'Meta 5', 'Meta 6', 'Meta 7'].map((n, i) => fake(n, i));

function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  return (h >>> 0) / 4294967296;
}
const STRENGTH: Record<string, number> = { 'S2-02 Mutant (RGG)': 0.6, 'S3-02 Gone (RRB)': 0.6, 'S2-07 Explorer (RRB)': 0.9, 'S3-04 Kept (BBG)': 0.3 };
const play: GatePlay = async (r) => Array.from({ length: r.games }, (_, k) => (unit(`${r.seed0 + k}:${r.field[k % r.field.length]!.name}:${r.bot}`) < (STRENGTH[r.deck.name] ?? 0.6) ? 1 : 0));

async function gateRecord(): Promise<SeasonGate> {
  const plan: [string, string, ReferenceWhy, string[], string][] = [
    ['S2-02 Mutant (RGG)', 'RRG Dexter Midrange', 'best-parent', ['RRG Dexter Midrange'], 'mutant'],
    ['S3-02 Gone (RRB)', 'RRG Dexter Midrange', 'no-parent-available', ['Unranked A', 'Unranked B'], 'crossover'],
    ['S2-07 Explorer (RRB)', 'BBG Cunningham Econ', 'explorer', [], 'explorer'],
    ['S3-04 Kept (BBG)', 'RRG Dexter Midrange', 'best-parent', ['RRG Dexter Midrange'], 'mutant'],
  ];
  const entries: GateEntry[] = plan.map(([name, ref, why, parents], i) => {
    const deck = fake(name, 20 + i);
    const reference = META.find((m) => m.name === ref)!;
    return { deck, reference, referenceWhy: why, parents, field: gateField(META, reference, deck) };
  });
  const outcomes = await runGate(entries, { bot: 'medium', confirmBot: 'hard', rounds: 2, stages: 3, confirmStages: 2, seeds: { first: 3_700_000, confirm: 3_800_000 } }, play);
  const decks: SeasonGateDeck[] = outcomes.map((o, i) => ({ ...o, method: plan[i]![4], idea: '', words: '', list: '', legends: [] }));
  return {
    bred: 4,
    entered: decks.filter((d) => d.entered).length,
    simVersion: 9,
    settings: { bot: 'medium', confirmBot: 'hard', rounds: 2, stages: 3, confirmStages: 2, alpha: 0.05, seeds: { first: 3_700_000, confirm: 3_800_000 } },
    words: { rule: '', guarantee: '', detect: '', spread: '' },
    spreadSeen: { first: null, firstDecks: 0, confirm: null, confirmDecks: 0 },
    decks,
  };
}

const row = (name: string, file: string, seasons: Record<string, number>): LeaderRow => ({ name, file, origin: 'S origin', colors: 'RGG', arch: 'midrange', vsMeta: 0.6, rating: 0.58, metaG: 100, percentile: 50, seasons });

async function fixture(): Promise<SeasonsData> {
  const gate = await gateRecord();
  const s3: SeasonRecord = {
    season: 3,
    date: '2026-11-20T10:00:00.000Z',
    games: 24,
    bot: 'deep',
    bred: gate.decks.filter((d) => d.entered).map((d) => ({ name: d.name, method: d.method, parents: d.parents, idea: '' })),
    standings: [
      { name: 'S2-07 Explorer (RRB)', file: 'x.txt', kind: 'original', wr: 0.655, isNew: true },
      { name: 'S2-02 Mutant (RGG)', file: 'y.txt', kind: 'original', wr: 0.61, isNew: true },
    ],
    gate,
    manifest: { simVersion: 9 },
  };
  return {
    updated: '',
    leaderboard: [row('S2-02 Mutant (RGG)', 's2-02-mutant-rgg.txt', { '3': 0.61 }), row('S1-01 Mutant (RRY)', 's1-01-mutant-rry.txt', { '1': 0.76, '3': 0.6 })],
    seasons: [SEASONS.seasons[0]!, s3],
    manifest: { simVersion: 5 },
  };
}

describe('then and now, as rows', () => {
  it('each bred deck: its season number, its rating now, its best parent now, its test; nothing computed between them', async () => {
    const D = await fixture();
    const s3 = D.seasons[1]!;
    const ranked = rankLibraryParents(BUILTIN, RATINGS.decks, D, 9);
    const rows = bredThenAndNow(s3, BUILTIN, RATINGS.decks, ranked);
    expect(rows.map((r) => r.name)).toEqual(['S2-02 Mutant (RGG)', 'S3-02 Gone (RRB)', 'S2-07 Explorer (RRB)']);
    const [mutant, gone, explorer] = rows as [(typeof rows)[0], (typeof rows)[0], (typeof rows)[0]];
    const rated = (n: string) => RATINGS.decks.find((d) => d.name === n)!;
    expect(mutant.file).toBe('s2-02-mutant-rgg.txt');
    expect(mutant.season).toBe(0.61);
    expect(mutant.now).toEqual({ wr: rated('S2-02 Mutant (RGG)').wrField, lo: rated('S2-02 Mutant (RGG)').wrFieldLo, hi: rated('S2-02 Mutant (RGG)').wrFieldHi, games: rated('S2-02 Mutant (RGG)').games });
    expect(mutant.parent?.name).toBe('RRG Dexter Midrange');
    expect(mutant.parent?.now?.wr).toBe(rated('RRG Dexter Midrange').wrField);
    expect(mutant.test?.first.verdict).toBe('could-not-tell');
    expect(Object.keys(mutant)).not.toContain('difference');
    expect([gone.file, gone.now, gone.parent, gone.season, gone.explorer]).toEqual([null, null, null, null, false]);
    expect([explorer.explorer, explorer.parent]).toEqual([true, null]);
    expect(notEntered(s3.gate).map((d) => d.name)).toEqual(['S3-04 Kept (BBG)']);
    expect(notEntered(undefined)).toEqual([]);
  });

  it('the words', async () => {
    const D = await fixture();
    const gate = D.seasons[1]!.gate!;
    const by = (n: string) => gate.decks.find((d) => d.name === n)!;
    expect(seasonTestWords(by('S2-02 Mutant (RGG)'))).toBe('Entered: not shown worse than RRG Dexter Midrange (its best parent then)');
    expect(seasonTestWords(by('S3-02 Gone (RRB)'))).toBe('Entered: not shown worse than RRG Dexter Midrange (the middle meta deck, as none of its parents was ranked)');
    expect(seasonTestWords(by('S2-07 Explorer (RRB)'))).toMatch(/^Entered: shown better than BBG Cunningham Econ \(the middle meta deck, as an explorer\) with the Medium bot( and the Hard bot)?$/);
    expect(seasonTestWords(by('S3-04 Kept (BBG)'))).toBe('Kept out: shown worse than RRG Dexter Midrange (its best parent then) with the Medium bot');
    // a season run with --gate-reference middle: a deck with parents tested against the fixed bar
    const mutant = by('S2-02 Mutant (RGG)');
    expect(seasonTestWords({ ...mutant, reference: { ...mutant.reference, name: 'Meta 4', why: 'fixed-bar' } })).toBe('Entered: not shown worse than Meta 4 (the middle meta deck, that season’s fixed bar for every bred deck)');
    expect(stepFigureWords(by('S3-04 Kept (BBG)').first)).toMatch(/^Medium bot: −\d+\.\d points \(range −\d+\.\d to −\d+\.\d\), \d+ games each$/);
    expect(verdictAgainst('could-not-tell', 'X')).toBe('could not tell: not shown worse than X');
    expect(ratingNowWords(null)).toBe('not rated');
    expect(ratingNowWords({ wr: 0.623, lo: 0.581, hi: 0.66, games: 1238 })).toBe('62.3% (90% range 58.1%–66.0%), 1,238 games');
    expect(thenAndNowIntro({ season: 3, seasonBot: 'deep', seasonSim: 9, ratingsBot: 'hard', ratingsSim: 9 })).toBe(
      'The Season 3 number is each deck’s win rate in that season’s round robin (Deep bot, simulator v9); the rating now is its power rating from the recorded tournaments (Hard bot, simulator v9). They are different measures, with another field, bot and simulator, shown side by side to see how a deck that looked strong in its season rates today.',
    );
    expect(leaderboardStaleWords(0)).toBeNull();
    expect(leaderboardStaleWords(2)).toBe('The breeder no longer uses numbers from an older simulator (rows marked “older simulator”) to choose parents; it uses today’s power ratings.');
  });
});

const count = (s: string, sub: string) => s.split(sub).length - 1;
const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, '’').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');

describe('the page', () => {
  it('a gated season and an ungated one: the table, the links, the tests, and the decks that did not enter', async () => {
    const D = await fixture();
    const html = renderToStaticMarkup(<SeasonsView data={D} ratings={RATINGS} lib={BUILTIN} current={9} />);
    const t = text(html);
    expect(count(html, 'Bred decks, then and now')).toBe(2);
    expect(t).toContain('Season 3 round robin');
    expect(t).toContain('Season 1 round robin');
    // the gated season: linked when in the library, named without a link otherwise
    expect(html).toContain('href="#/deck?d=s2-02-mutant-rgg.txt"><b>S2-02 Mutant (RGG)</b></a>');
    expect(html).toMatch(/<td[^>]*><b>S3-02 Gone \(RRB\)<\/b>/);
    expect(t).toContain('a new Legend trio');
    expect(t).toContain('none: an explorer');
    expect(t).toContain('none of its parents is rated now');
    expect(t).toContain('not rated');
    const dexter = RATINGS.decks.find((d) => d.name === 'RRG Dexter Midrange')!;
    expect(t).toContain(`RRG Dexter Midrange ${(dexter.wrField * 100).toFixed(1)}% 90% range ${(dexter.wrFieldLo * 100).toFixed(1)}–${(dexter.wrFieldHi * 100).toFixed(1)}% ${dexter.games} games`);
    expect(t).toContain('Entered: not shown worse than RRG Dexter Midrange (its best parent then)');
    // the ungated season: every row says it was not tested
    expect(count(t, NOT_TESTED)).toBe(SEASONS.seasons[0]!.bred.length);
    // the deck the test kept out, only under the gated season
    expect(count(t, 'Bred, but did not enter')).toBe(1);
    expect(t).toContain('S3-04 Kept (BBG) mutant Kept out: shown worse than RRG Dexter Midrange (its best parent then) with the Medium bot Medium bot: −');
    // two different measures, said once per season, never a difference between them
    expect(count(t, 'They are different measures')).toBe(2);
    expect(t).not.toMatch(/as good as/i);
    // the tables scroll inside their panels
    expect(count(html, 'class="scroll-x"')).toBeGreaterThanOrEqual(4);
  });

  it('the leaderboard: the stale row is marked, the current one is not, and the intro says what the breeder uses', async () => {
    const D = await fixture();
    const html = renderToStaticMarkup(<SeasonsView data={D} ratings={RATINGS} lib={BUILTIN} current={9} />);
    const t = text(html);
    expect(count(t, 'rows marked “older simulator”')).toBe(1); // the intro's sentence
    expect(count(html, '>older simulator</span>')).toBe(1); // S1-01's row only (season 1 ran under version 5)
    const s101 = html.slice(html.indexOf('S1-01 Mutant (RRY)</b>'), html.indexOf('S1-01 Mutant (RRY)</b>') + 2000);
    expect(s101).toContain('>older simulator</span>');
    expect(t).toContain('These results were recorded before the current simulator (v9), so they are historical. The breeder no longer uses numbers from an older simulator (rows marked “older simulator”) to choose parents; it uses today’s power ratings.');
    // every row current: no mark, no sentence
    const current = { ...D, leaderboard: [D.leaderboard[0]!], seasons: [D.seasons[1]!], manifest: { simVersion: 9 } };
    const h2 = renderToStaticMarkup(<SeasonsView data={current} ratings={RATINGS} lib={BUILTIN} current={9} />);
    expect(h2).not.toContain('older simulator');
    expect(h2).not.toContain('historical');
  });

  it('the bundled data: every leaderboard row is marked, and no recorded season was tested', () => {
    const html = renderToStaticMarkup(<SeasonsView data={SEASONS} ratings={RATINGS} lib={BUILTIN} />);
    expect(count(html, '>older simulator</span>')).toBe(SEASONS.leaderboard.length);
    expect(count(text(html), NOT_TESTED)).toBe(SEASONS.seasons.reduce((n, s) => n + s.bred.length, 0));
    expect(html).not.toContain('Bred, but did not enter');
  });
});
