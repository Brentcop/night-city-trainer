// Parent strength for the breeders (src/lib/parentStrength.ts; docs/SYNERGIES.md "A bred deck's test against its
// parent"). Since 2026-11-24 (docs/REVIEW_2026-11-24.md B.5): a deck's strength is its power rating's estimate (no
// leaderboard blend, no lower-bound discount), and only decks with 100 or more games on their current list are parents.
// The season script (scripts/breed-data.ts strengthOf) and the Deck Lab (src/lib/deckLab.ts rankedParents) rank parents
// the same way from the same data. The leaderboard's staleness (staleLeaderRow) stays for the Seasons and deck pages.
// Last, the Legend trios earlier seasons kept out or retired count as seen only under the simulator version they ran on.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { DeckList } from '../src/engine/types';
import { RATINGS, SEASONS } from '../src/data/index';
import { rankedParents } from '../src/lib/deckLab';
import type { LibraryDeck } from '../src/lib/library';
import { PARENT_MIN_GAMES, parentStrength, rankLibraryParents, rankParents, ratingsVersionWarning, seasonVersions, staleLeaderRow, tooFewGames, tooFewGamesWords, type RatedDeck } from '../src/lib/parentStrength';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import { expiredTriples, keptOutTriples, seasonFileVersion, seasonVersionsOnDisk, strengthOf } from '../scripts/breed-data';
import { BUILTIN } from '../src/lib/browserLibrary';

/** The leaderboard rows with only Season 3 behind them (2026-11-16): its six bred decks and two decks that joined then. */
const SEASON_3_ONLY = [
  'ladder-rrg-v-smasher-padre.txt',
  'nc-07-braindance-burn-rrb.txt',
  's3-02-mutant-rgy.txt',
  's3-03-cross-rrr.txt',
  's3-05-counter-rrg.txt',
  's3-06-counter-rbg.txt',
  's3-07-explorer-rrg.txt',
  's3-08-explorer-rrb.txt',
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-strength-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const deck = (name: string, n: number): DeckList => ({ name, legends: [`legend_${n}`], main: [`card_${n}`], sideboard: [] });
const lib: LibraryDeck[] = ['A', 'B', 'C', 'D', 'E'].map((name, i) => ({ file: `${name.toLowerCase()}.txt`, deck: deck(name, i), kind: 'custom', prov: {} }));
const rated = (name: string, wrField: number, half = 0.04, games = 100): RatedDeck => ({ name, games, wrField, wrFieldLo: wrField - half, wrFieldHi: wrField + half });
const V = { '1': 5, '2': 5, '3': CURRENT_SIM_VERSION, '4': null } as Record<string, number | null>;

describe('stale leaderboard entries (the Seasons and deck pages still mark them)', () => {
  it('an entry is current only when every season behind it ran under the current simulator version', () => {
    expect(staleLeaderRow({ seasons: { '3': 0.5 } }, V)).toBe(false);
    expect(staleLeaderRow({ seasons: { '0': 0.6 } }, V)).toBe(true); // the seed data
    expect(staleLeaderRow({ seasons: { '1': 0.6, '3': 0.5 } }, V)).toBe(true); // one old season is enough
    expect(staleLeaderRow({ seasons: { '4': 0.6 } }, V)).toBe(true); // recorded without a version
    expect(staleLeaderRow({ seasons: { '9': 0.6 } }, V)).toBe(true); // a season with no record
    expect(staleLeaderRow({ seasons: {} }, V)).toBe(true);
    expect(staleLeaderRow({ seasons: { '3': 0.5 } }, V, 10)).toBe(true);
    expect(seasonVersions([{ season: 1, manifest: { simVersion: 5 } }, { season: 2 }, { season: 3, manifest: { simVersion: 'x' } }])).toEqual({ '1': 5, '2': null, '3': null });
  });

  it('on the bundled data: the rows with only Season 3 behind them are current, every other row is stale', () => {
    const versions = seasonVersions(SEASONS.seasons);
    expect(versions).toEqual({ '1': 5, '2': 5, '3': CURRENT_SIM_VERSION });
    expect(seasonVersionsOnDisk()).toEqual(versions);
    expect(SEASONS.leaderboard).toHaveLength(36);
    const current = SEASONS.leaderboard.filter((r) => !staleLeaderRow(r, versions));
    expect(current.map((r) => r.file).sort()).toEqual(SEASON_3_ONLY);
    const stale = SEASONS.leaderboard.filter((r) => staleLeaderRow(r, versions));
    expect(stale).toHaveLength(28);
  });
});

describe('parent strength', () => {
  it('is the rating’s estimate, whatever its range, for 100 or more games; fewer games and the deck is no parent', () => {
    expect(PARENT_MIN_GAMES).toBe(100);
    const decks = [rated('A', 0.6, 0.04), rated('B', 0.58, 0.2), rated('C', 0.7, 0.04, 99), rated('D', 0.5, 0, 400), { ...rated('E', 0.5), wrField: Number.NaN }];
    expect(parentStrength(decks)).toEqual({ A: 0.6, B: 0.58, D: 0.5 });
    // a wide range no longer lowers a deck: B ranks by its estimate, not by 0.58 − 0.5 · 0.2
    expect(rankParents(parentStrength(decks), lib).map((x) => x.deck.name)).toEqual(['A', 'B', 'D']);
    expect(tooFewGames(decks)).toEqual([{ name: 'C', games: 99 }]);
    expect(tooFewGamesWords(tooFewGames(decks))).toBe('Not parents (fewer than 100 games on their current list): C (99).');
    expect(tooFewGamesWords([])).toBeNull();
  });

  it('no leaderboard figure enters it (the 35% blend of 2026-11-15 is gone): the Lab ranks by the ratings alone', () => {
    const decks = [rated('A', 0.6), rated('C', 0.5), rated('E', 0.52)];
    expect(rankedParents(lib, decks).map((x) => [x.deck.name, x.wr])).toEqual([
      ['A', 0.6],
      ['E', 0.52],
      ['C', 0.5],
    ]);
    expect(rankLibraryParents(lib, decks)).toEqual(rankedParents(lib, decks));
  });
});

describe('ratings fitted on another simulator version are flagged', () => {
  it('a warning line for another or no version, nothing for the current one (so no number or output changes)', () => {
    expect(ratingsVersionWarning({ manifest: { simVersion: CURRENT_SIM_VERSION } })).toBeNull();
    if (RATINGS.manifest?.simVersion === CURRENT_SIM_VERSION) expect(ratingsVersionWarning(RATINGS)).toBeNull();
    expect(ratingsVersionWarning({ manifest: { simVersion: CURRENT_SIM_VERSION - 1 } })).toBe(
      `Warning: parent strength reads src/data/ratings.json, fitted on simulator v${CURRENT_SIM_VERSION - 1}, not the current v${CURRENT_SIM_VERSION}; the parents are ranked on old ratings until the series re-rates the library.`,
    );
    expect(ratingsVersionWarning({}, 'x.json')).toMatch(/^Warning: parent strength reads x\.json, fitted on an unversioned simulator/);
  });
});

describe('the script and the Deck Lab rank parents alike', () => {
  it('from the same ratings file', () => {
    const decks = [rated('A', 0.6), rated('B', 0.55, 0.1), rated('C', 0.5, 0.02, 40), rated('E', 0.58, 0.2)];
    const ratingsFile = path.join(tmp, 'ratings.json');
    fs.writeFileSync(ratingsFile, JSON.stringify({ decks }));
    const script = rankParents(strengthOf(ratingsFile), lib);
    const lab = rankedParents(lib, decks);
    expect(lab.map((x) => [x.deck.name, x.wr])).toEqual(script.map((x) => [x.deck.name, x.wr]));
    expect(script.map((x) => [x.deck.name, x.wr])).toEqual([
      ['A', 0.6],
      ['E', 0.58],
      ['B', 0.55],
    ]);
  });

  it('on the bundled data: every library deck with 100 or more games, by its estimate', () => {
    const lab = rankedParents(BUILTIN);
    const script = rankParents(strengthOf(), BUILTIN);
    expect(script.map((x) => [x.deck.name, x.wr])).toEqual(lab.map((x) => [x.deck.name, x.wr]));
    const names = new Set(BUILTIN.map((d) => d.deck.name));
    const want = RATINGS.decks.filter((d) => names.has(d.name) && d.games >= PARENT_MIN_GAMES);
    expect(lab).toHaveLength(want.length);
    for (const x of lab) expect(x.wr, x.deck.name).toBe(RATINGS.decks.find((d) => d.name === x.deck.name)!.wrField);
    for (let i = 1; i < lab.length; i++) expect(lab[i - 1]!.wr).toBeGreaterThanOrEqual(lab[i]!.wr);
    // the review's case (finding L4): with the blend gone, Ladder: V / Smasher / Padre ranks by its own rating
    const ladder = RATINGS.decks.find((d) => d.name === 'Ladder: V / Smasher / Padre (RRG)');
    if (ladder) expect(lab.findIndex((x) => x.deck.name === ladder.name)).toBe(lab.filter((x) => x.wr > ladder.wrField).length);
  });
});

describe('Legend trios kept out or retired by earlier seasons', () => {
  it('are read from the season files of the current simulator version only, except the season being re-run', () => {
    const dir = path.join(tmp, 'seasons');
    fs.mkdirSync(dir, { recursive: true });
    const v = CURRENT_SIM_VERSION;
    fs.writeFileSync(path.join(dir, 'season-3.json'), JSON.stringify({ season: 3, gate: { simVersion: v, decks: [{ entered: false, legends: ['z', 'a', 'm'] }, { entered: true, legends: ['b', 'c', 'd'] }] } }));
    fs.writeFileSync(path.join(dir, 'season-4.json'), JSON.stringify({ season: 4, manifest: { simVersion: v }, gate: { decks: [{ entered: false, legends: ['q', 'r', 's'] }] }, retired: [{ legends: ['y', 'x', 'w'] }] }));
    fs.writeFileSync(path.join(dir, 'season-5.json'), JSON.stringify({ season: 5, bred: [] }));
    // closed under another version (or none recorded): open again
    fs.writeFileSync(path.join(dir, 'season-2.json'), JSON.stringify({ season: 2, manifest: { simVersion: v - 1 }, gate: { decks: [{ entered: false, legends: ['o', 'l', 'd'] }] }, retired: [{ legends: ['e', 'f', 'g'] }] }));
    fs.writeFileSync(path.join(dir, 'season-1.json'), JSON.stringify({ season: 1, gate: { decks: [{ entered: false, legends: ['n', 'o', 'v'] }] } }));
    expect(keptOutTriples(dir)).toEqual(['a|m|z', 'q|r|s', 'w|x|y']);
    expect(keptOutTriples(dir, 4)).toEqual(['a|m|z']);
    expect(keptOutTriples(path.join(tmp, 'none'))).toEqual([]);
    // under the old version the old trios are the closed ones
    expect(keptOutTriples(dir, undefined, v - 1)).toEqual(['d|l|o', 'e|f|g']);
    expect(expiredTriples(dir)).toBe(3);
    expect(seasonFileVersion({ gate: { simVersion: 7 }, manifest: { simVersion: 6 } })).toBe(7);
    expect(seasonFileVersion({ manifest: { simVersion: 6 } })).toBe(6);
    expect(seasonFileVersion({})).toBeNull();
  });

  it('on the recorded seasons: Season 3’s two kept-out trios are closed under the current version', () => {
    expect(keptOutTriples()).toHaveLength(2);
    expect(expiredTriples()).toBe(0);
  });
});
