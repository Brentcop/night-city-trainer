// The Seasons page (src/ui/pages/Seasons.tsx, words and rows in src/lib/bredDecks.ts; docs/SYNERGIES.md "A bred deck's
// test against its parent"): "Bred decks, then and now" (the season's round robin beside the rating now and the best
// parent's, with the test at entry or "not tested before entering"), the decks a season's test did not let in, and the
// leaderboard's "older simulator" marks with the intro's sentence. Rendered with fixtures: a gated season (decks that
// entered and one that did not, its tests made by the real rule on faked games) and an ungated one; a stale and a
// current leaderboard row. Also the bundled data: Seasons 1 and 2 (simulator v5, untested) and Season 3 (2026-11-16, the
// current simulator, the first tested at entry, two decks kept out); the intro and each panel say which is historical
// from the season's own version.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DeckList } from '../src/engine/types';
import { RATINGS, SEASONS, type LeaderRow, type SeasonGate, type SeasonGateDeck, type SeasonRecord, type SeasonsData } from '../src/data/index';
import { BUILTIN } from '../src/lib/browserLibrary';
import { gateField, runGate, type GateEntry, type GatePlay, type ReferenceWhy } from '../src/lib/breedGate';
import {
  bredThenAndNow,
  leaderboardStaleWords,
  NOT_TESTED,
  notEntered,
  ratingNowWords,
  seasonListWords,
  seasonSimNote,
  seasonsSimWords,
  seasonTestWords,
  stepFigureWords,
  thenAndNowIntro,
  verdictAgainst,
} from '../src/lib/bredDecks';
import { rankLibraryParents, seasonVersions, staleLeaderRow } from '../src/lib/parentStrength';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
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
    const ranked = rankLibraryParents(BUILTIN, RATINGS.decks);
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
    // a bot that could not tell is named after the one that showed it better, never left out
    const explorer = by('S2-07 Explorer (RRB)');
    expect(explorer.first.verdict).toBe('shown-better');
    expect(seasonTestWords(explorer)).toBe(
      `Entered: shown better than BBG Cunningham Econ (the middle meta deck, as an explorer) with the Medium bot${explorer.confirm?.verdict === 'shown-better' ? ' and the Hard bot' : '; the Hard bot could not tell'}`,
    );
    const confirm = explorer.confirm!;
    expect(seasonTestWords({ ...explorer, confirm: { ...confirm, verdict: 'could-not-tell' } })).toBe(
      'Entered: shown better than BBG Cunningham Econ (the middle meta deck, as an explorer) with the Medium bot; the Hard bot could not tell',
    );
    expect(seasonTestWords({ ...explorer, confirm: { ...confirm, verdict: 'shown-better' } })).toBe('Entered: shown better than BBG Cunningham Econ (the middle meta deck, as an explorer) with the Medium bot and the Hard bot');
    expect(seasonTestWords({ ...explorer, first: { ...explorer.first, verdict: 'could-not-tell' }, confirm: { ...confirm, verdict: 'shown-better' } })).toBe(
      'Entered: shown better than BBG Cunningham Econ (the middle meta deck, as an explorer) with the Hard bot; the Medium bot could not tell',
    );
    // the fixture's gate ran the default since 2026-11-24 (keepOut 'confirming'): the Hard bot kept it out
    const kept = by('S3-04 Kept (BBG)');
    expect(kept.keepOut).toBe('confirming');
    expect(seasonTestWords(kept)).toBe('Kept out: shown worse than RRG Dexter Midrange (its best parent then) with the Hard bot');
    // a record of the rule of 2026-11-15 (no keepOut, the Hard part skipped): the Medium bot kept it out
    const { keepOut: _k, ...older } = kept;
    void _k;
    expect(seasonTestWords({ ...older, confirmSkipped: 'shown-worse' })).toBe('Kept out: shown worse than RRG Dexter Midrange (its best parent then) with the Medium bot');
    // under the new rule a deck the Medium bot showed worse and the Hard bot did not enters, and the words say both
    expect(seasonTestWords({ ...kept, entered: true, confirm: { ...kept.confirm!, verdict: 'could-not-tell' } })).toBe(
      'Entered: not shown worse than RRG Dexter Midrange (its best parent then) with the Hard bot; the Medium bot showed it worse, but only the Hard bot can keep a deck out',
    );
    expect(seasonTestWords({ ...kept, entered: true, confirm: { ...kept.confirm!, verdict: 'shown-better' } })).toBe(
      'Entered: shown better than RRG Dexter Midrange (its best parent then) with the Hard bot; the Medium bot showed it worse, but only the Hard bot can keep a deck out',
    );
    // a season run with --gate-reference middle: a deck with parents tested against the fixed bar
    const mutant = by('S2-02 Mutant (RGG)');
    expect(seasonTestWords({ ...mutant, reference: { ...mutant.reference, name: 'Meta 4', why: 'fixed-bar' } })).toBe('Entered: not shown worse than Meta 4 (the middle meta deck, that season’s fixed bar for every bred deck)');
    expect(stepFigureWords(by('S3-04 Kept (BBG)').first)).toMatch(/^Medium bot: −\d+\.\d points \(range −\d+\.\d to −\d+\.\d\), \d+ games each$/);
    expect(verdictAgainst('could-not-tell', 'X')).toBe('could not tell: not shown worse than X');
    expect(ratingNowWords(null)).toBe('not rated');
    expect(ratingNowWords({ wr: 0.623, lo: 0.581, hi: 0.66, games: 1238 })).toBe('62.3% (90% range 58.1%–66.0%), 1,238 games');
    // it names only what differs: the field always, the bot and the simulator when they are not the same
    expect(thenAndNowIntro({ season: 3, seasonBot: 'deep', seasonSim: 9, ratingsBot: 'hard', ratingsSim: 9 })).toBe(
      'The Season 3 number is each deck’s win rate in that season’s round robin (Deep bot, simulator v9); the rating now is its power rating from the recorded tournaments (Hard bot, simulator v9). They are different measures, with another field and bot but the same simulator, shown side by side to see how a deck that looked strong in its season rates today.',
    );
    expect(thenAndNowIntro({ season: 1, seasonBot: 'deep', seasonSim: 5, ratingsBot: 'hard', ratingsSim: 9 })).toContain('with another field, bot and simulator, shown side by side');
    expect(thenAndNowIntro({ season: 3, seasonBot: 'hard', seasonSim: 9, ratingsBot: 'hard', ratingsSim: 9 })).toContain(
      '(Hard bot, simulator v9); the rating now is its power rating from the recorded tournaments (Hard bot, simulator v9). They are different measures, with another field but the same bot and simulator, shown',
    );
    expect(thenAndNowIntro({ season: 2, seasonBot: 'hard', seasonSim: 5, ratingsBot: 'hard', ratingsSim: 9 })).toContain('with another field and simulator but the same bot, shown');
    // unknown on either side is never called the same
    expect(thenAndNowIntro({ season: 2, seasonBot: 'hard', seasonSim: null, ratingsBot: null, ratingsSim: null })).toContain('with another field, bot and simulator, shown');
    // which seasons are historical, from each season's own version
    expect(seasonListWords([3])).toBe('Season 3');
    expect(seasonListWords([2, 1])).toBe('Seasons 1 and 2');
    expect(seasonListWords([4, 1, 2])).toBe('Seasons 1, 2 and 4');
    expect(seasonsSimWords({ '1': 5, '2': 5 }, 9)).toBe('Seasons 1 and 2 were played on an older simulator (v5), so their results are historical (the current simulator is v9).');
    expect(seasonsSimWords({ '1': 5 }, 9)).toBe('Season 1 was played on an older simulator (v5), so its results are historical (the current simulator is v9).');
    expect(seasonsSimWords({ '1': 5, '2': 5, '3': 9 }, 9)).toBe('Seasons 1 and 2 were played on an older simulator (v5), so their results are historical; Season 3 was played on the current simulator (v9).');
    expect(seasonsSimWords({ '1': 4, '2': 5, '3': 9, '4': 9 }, 9)).toBe('Seasons 1 and 2 were played on an older simulator (v4 and v5), so their results are historical; Seasons 3 and 4 were played on the current simulator (v9).');
    expect(seasonsSimWords({ '3': 9, '4': 9 }, 9)).toBeNull();
    expect(seasonsSimWords({}, 9)).toBeNull();
    expect(seasonsSimWords({ '1': null, '2': 5, '3': 9 }, 9)).toBe(
      'Season 1 has no recorded simulator version and Season 2 was played on an older simulator (v5), so their results are historical; Season 3 was played on the current simulator (v9).',
    );
    expect(seasonsSimWords({ '1': null }, 9)).toBe('Season 1 has no recorded simulator version, so its results are historical (the current simulator is v9).');
    expect(seasonSimNote(9, 9)).toEqual({ text: 'simulator v9', historical: false });
    expect(seasonSimNote(5, 9)).toEqual({ text: 'simulator v5, historical', historical: true });
    expect(seasonSimNote(null, 9)).toEqual({ text: 'no simulator version recorded, historical', historical: true });
    expect(seasonSimNote(undefined, 9)).toEqual({ text: 'no simulator version recorded, historical', historical: true });
    expect(leaderboardStaleWords(0)).toBeNull();
    // since 2026-11-24 no leaderboard row, older or current, chooses parents: the same sentence either way
    const words = 'Rows marked “older simulator” include games of an older simulator. The breeder does not use the leaderboard to choose parents: it uses today’s power ratings.';
    expect(leaderboardStaleWords(2)).toBe(words);
    expect(leaderboardStaleWords(2, 3)).toBe(words);
    expect(leaderboardStaleWords(0, 3)).toBeNull();
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
    // the rating as RATINGS holds it today (every rating series run moves it): the cell's figures, the games with a comma
    const dexter = RATINGS.decks.find((d) => d.name === 'RRG Dexter Midrange')!;
    expect(t).toContain(`RRG Dexter Midrange ${(dexter.wrField * 100).toFixed(1)}% 90% range ${(dexter.wrFieldLo * 100).toFixed(1)}–${(dexter.wrFieldHi * 100).toFixed(1)}% ${dexter.games.toLocaleString('en-US')} games`);
    expect(t).toContain('Entered: not shown worse than RRG Dexter Midrange (its best parent then)');
    // the ungated season: every row says it was not tested
    expect(count(t, NOT_TESTED)).toBe(SEASONS.seasons[0]!.bred.length);
    // the deck the test kept out, only under the gated season
    expect(count(t, 'Bred, but did not enter')).toBe(1);
    // (the fixture runs the gate's default since 2026-11-24: only the Hard bot can keep a deck out)
    expect(t).toContain('S3-04 Kept (BBG) mutant Kept out: shown worse than RRG Dexter Midrange (its best parent then) with the Hard bot Medium bot: −');
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
    expect(count(t, 'Rows marked “older simulator”')).toBe(1); // the intro's sentence
    expect(count(html, '>older simulator</span>')).toBe(1); // S1-01's row only (season 1 ran under version 5)
    const s101 = html.slice(html.indexOf('S1-01 Mutant (RRY)</b>'), html.indexOf('S1-01 Mutant (RRY)</b>') + 2000);
    expect(s101).toContain('>older simulator</span>');
    // the intro names the historical season from its own version: the file's manifest (5, the oldest season's) is not read
    expect(t).toContain(
      'Season 1 was played on an older simulator (v5), so its results are historical; Season 3 was played on the current simulator (v9). Rows marked “older simulator” include games of an older simulator. The breeder does not use the leaderboard to choose parents: it uses today’s power ratings.',
    );
    expect(text(renderToStaticMarkup(<SeasonsView data={{ ...D, manifest: { simVersion: 9 } }} ratings={RATINGS} lib={BUILTIN} current={9} />))).toContain('Season 1 was played on an older simulator (v5)');
    // each season's panel names its simulator; the older one says it is historical
    expect(t).toMatch(/Season 3 \(2026-11-20 · 24 games per pairing · Deep bot · simulator v9\)/);
    expect(t).toMatch(/Season 1 \(2026-11-11 · \d+ games per pairing · Deep bot · simulator v5, historical \)/);
    expect(count(html, `title="${'This season was not played on the current simulator, so its numbers are historical: new games may differ.'}"`)).toBe(1);
    // every row and season current: no mark, no sentence
    const current = { ...D, leaderboard: [D.leaderboard[0]!], seasons: [D.seasons[1]!], manifest: { simVersion: 9 } };
    const h2 = renderToStaticMarkup(<SeasonsView data={current} ratings={RATINGS} lib={BUILTIN} current={9} />);
    expect(h2).not.toContain('older simulator');
    expect(h2).not.toContain('historical');
    // every season older: the sentence says so, with the current version
    const old = { ...D, seasons: [D.seasons[0]!] };
    expect(text(renderToStaticMarkup(<SeasonsView data={old} ratings={RATINGS} lib={BUILTIN} current={9} />))).toContain(
      'Season 1 was played on an older simulator (v5), so its results are historical (the current simulator is v9).',
    );
  });

  it('the bundled data: Seasons 1 and 2 are historical and untested; Season 3 is current, tested at entry, with two decks kept out', () => {
    const html = renderToStaticMarkup(<SeasonsView data={SEASONS} ratings={RATINGS} lib={BUILTIN} />);
    const t = text(html);
    const versions = seasonVersions(SEASONS.seasons);
    expect(versions).toEqual({ '1': 5, '2': 5, '3': CURRENT_SIM_VERSION });
    // the intro, from each season's own version (the file's own version is the oldest season's)
    expect(SEASONS.manifest?.simVersion).toBe(5);
    expect(t).toContain(`Seasons 1 and 2 were played on an older simulator (v5), so their results are historical; Season 3 was played on the current simulator (v${CURRENT_SIM_VERSION}).`);
    expect(t).not.toContain('These results were recorded before the current simulator');
    // each panel names its bot and simulator
    expect(t).toMatch(new RegExp(`Season 3 \\(2026-11-16 · 24 games per pairing · Hard bot · simulator v${CURRENT_SIM_VERSION}\\)`));
    expect(t).toMatch(/Season 2 \(2026-11-12 · 24 games per pairing · Deep bot · simulator v5, historical \)/);
    expect(t).toMatch(/Season 1 \(2026-11-11 · \d+ games per pairing · Deep bot · simulator v5, historical \)/);
    // the leaderboard: 28 of 36 rows have a season before 3 behind them and are marked; the 8 with only Season 3 are not
    expect(SEASONS.leaderboard).toHaveLength(36);
    expect(SEASONS.leaderboard.filter((r) => staleLeaderRow(r, versions))).toHaveLength(28);
    expect(count(html, '>older simulator</span>')).toBe(28);
    for (const r of SEASONS.leaderboard.filter((x) => !staleLeaderRow(x, versions))) {
      const at = html.indexOf(`${r.name.replace(/'/g, '&#x27;')}</b></a>`);
      expect(at, r.name).toBeGreaterThan(0);
      expect(html.slice(at, html.indexOf('</tr>', at)), r.name).not.toContain('older simulator');
    }
    // Seasons 1 and 2 were not tested at entry
    const untested = SEASONS.seasons.filter((s) => s.season < 3).reduce((n, s) => n + s.bred.length, 0);
    expect(untested).toBe(16);
    expect(count(t, NOT_TESTED)).toBe(untested);
    // Season 3: each entered deck with its test at entry in words (the fixed bar was YYB Rogue Gear)
    const s3 = SEASONS.seasons.find((s) => s.season === 3)!;
    expect(s3.bred.map((b) => b.name)).toEqual(['S3-02 Mutant (RGY)', 'S3-03 Cross (RRR)', 'S3-05 Counter (RRG)', 'S3-06 Counter (RBG)', 'S3-07 Explorer (RRG)', 'S3-08 Explorer (RRB)']);
    const bar = 'YYB Rogue Gear (the middle meta deck, that season’s fixed bar for every bred deck)';
    const asExplorer = 'YYB Rogue Gear (the middle meta deck, as an explorer)';
    const entered: [string, string][] = [
      ['S3-02 Mutant (RGY)', `Entered: shown better than ${bar} with the Medium bot; the Hard bot could not tell Medium bot: +11.3 points (range +1.8 to +20.7), 480 games each Hard bot: +5.0 points (range −0.6 to +10.6), 480 games each`],
      ['S3-03 Cross (RRR)', `Entered: not shown worse than ${bar} Medium bot: +3.4 points (range −0.3 to +7.1), 1,200 games each Hard bot: +3.8 points (range −1.8 to +9.3), 480 games each`],
      ['S3-05 Counter (RRG)', `Entered: shown better than ${bar} with the Medium bot; the Hard bot could not tell Medium bot: +4.3 points`],
      ['S3-06 Counter (RBG)', `Entered: not shown worse than ${bar} Medium bot: −2.8 points (range −6.4 to +0.7), 1,200 games each Hard bot: −2.5 points (range −7.8 to +2.8), 480 games each`],
      ['S3-07 Explorer (RRG)', `Entered: shown better than ${asExplorer} with the Medium bot; the Hard bot could not tell Medium bot: +5.8 points`],
      ['S3-08 Explorer (RRB)', `Entered: shown better than ${asExplorer} with the Medium bot; the Hard bot could not tell Medium bot: +6.7 points`],
    ];
    for (const [name, words] of entered) expect(t, name).toContain(words);
    // since event 15 (2026-11-16) the new decks have a power rating: it stands, with its range and games, beside their
    // Season 3 round robin figure (a deck without one reads "not rated": the synthetic cases above)
    const ranked = rankLibraryParents(BUILTIN, RATINGS.decks);
    const rows = bredThenAndNow(s3, BUILTIN, RATINGS.decks, ranked);
    const rated = new Map(RATINGS.decks.map((d) => [d.name, d]));
    expect(rows.map((r) => [r.name, r.now, r.test?.entered])).toEqual(
      s3.bred.map((b) => {
        const d = rated.get(b.name)!;
        return [b.name, { wr: d.wrField, lo: d.wrFieldLo, hi: d.wrFieldHi, games: d.games }, true];
      }),
    );
    for (const r of rows) expect(r.now!.games, r.name).toBeGreaterThanOrEqual(20);
    expect(t).toMatch(/S3-03 Cross \(RRR\) crossover Ladder: V \/ Smasher \/ Padre \(RRG\) \+ NC-07 Braindance Burn \(RRB\) 45\.0% \d+\.\d% 90% range \d+\.\d–\d+\.\d% \d+ games/);
    expect(t).toMatch(/S3-07 Explorer \(RRG\) explorer a new Legend trio 41\.3% \d+\.\d% 90% range \d+\.\d–\d+\.\d% \d+ games none: an explorer/);
    // Season 3 compares like with like on bot and simulator, and says so
    expect(t).toContain('with another field but the same bot and simulator');
    // the two decks it kept out, with the bot that showed each worse
    expect(count(t, 'Bred, but did not enter')).toBe(1);
    expect(notEntered(s3.gate).map((d) => d.name)).toEqual(['S3-01 Mutant (RBG)', 'S3-04 Cross (RBB)']);
    expect(t).toContain(`S3-01 Mutant (RBG) mutant Kept out: shown worse than ${bar} with the Hard bot Medium bot: −1.7 points (range −5.3 to +2.0), 1,200 games each Hard bot: −8.5 points (range −14.1 to −3.0), 480 games each`);
    expect(t).toContain(`S3-04 Cross (RBB) crossover Kept out: shown worse than ${bar} with the Medium bot Medium bot: −6.6 points (range −11.2 to −1.9), 960 games each`);
    expect(t).not.toMatch(/as good as/i);
  });
});
