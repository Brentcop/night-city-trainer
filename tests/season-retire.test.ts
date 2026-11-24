// Retiring weak bred decks (scripts/season-retire.ts; scripts/season.ts --retire, on by default since 2026-11-24 for the
// season's own decks at its end, and the opt-in --retire-earlier; docs/REVIEW_2026-11-24.md B.8). The rule, "shown below
// the bar": a deck is retired when its 90% range on the win rate against the library lies wholly below the meta decks'
// median, so a deck that could be at the bar stays. Here: the rule on planted rows and on the recorded ratings (nothing
// is retired by this test), the fit the season judges its own decks on (the ratings' own pool and numbers), and what a
// retirement writes, on copies in a temporary folder: the deck file moved under a versioned name with a "// Retired:"
// line, an earlier deck's note moved with a comment line, a new deck's placeholder line, a re-run replacing its own.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { listFingerprint, parseDeck } from '../src/engine/deck';
import { loadLibrary } from '../scripts/lib-node';
import { fitPooledRatings } from '../scripts/breed-data';
import { RATINGS } from '../src/data/index';
import type { LibraryDeck } from '../src/lib/library';
import type { RatedDeck } from '../src/lib/parentStrength';
import { moveNote, placeholderLine, retireDecks, retireEarlier, retirementWords, retireOwn, RETIRE_PATHS, RETIRE_RULE_WORDS, shownBelow, type Retired } from '../scripts/season-retire';
import { RETIRED_MARKER, RETIRED_OBJECTIVES, retiredPlaceholder } from '../src/content/deckObjectives/archived';
import { SEASON_OBJECTIVES } from '../src/content/deckObjectives/seasons';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-retire-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const LIB = loadLibrary();
const BRED = LIB.filter((d) => /^s\d+-/.test(d.file));
const META = LIB.filter((d) => d.kind === 'meta');

describe('the rule: shown below the bar', () => {
  it('retires a deck only when its whole 90% range is below the meta decks’ median', () => {
    const row = (name: string, wr: number, lo: number, hi: number): RatedDeck => ({ name, games: 300, wrField: wr, wrFieldLo: lo, wrFieldHi: hi });
    // meta estimates 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70: the median is 0.55
    const ratings = [...META.map((d, i) => row(d.deck.name, 0.4 + 0.05 * i, 0.4 + 0.05 * i - 0.04, 0.4 + 0.05 * i + 0.04))];
    const [a, b, c, d] = BRED;
    ratings.push(row(a!.deck.name, 0.45, 0.41, 0.549), row(b!.deck.name, 0.5, 0.45, 0.551), row(c!.deck.name, 0.3, 0.2, 0.6));
    const r = shownBelow(LIB, ratings, [a!, b!, c!, d!], 9);
    expect(r.metaMedian).toBeCloseTo(0.55, 12);
    // a: wholly below; b: its range reaches the bar (could be at it): stays; c: far below by estimate, but its range is wide: stays; d: no row, not judged
    expect(r.retired.map((x) => x.file)).toEqual([a!.file]);
    expect(r.judged).toBe(3);
    expect(r.retired[0]).toMatchObject({ archived: a!.file.replace(/\.txt$/, '-v9.txt'), wr: 0.45, lo: 0.41, hi: 0.549, games: 300 });
    expect(retirementWords(r, 'retired', 'new deck')[0]).toBe(`Retirement (retired): 1 new deck shown below the meta decks' median (55.0%) (3 judged): ${RETIRE_RULE_WORDS}.`);
    expect(retirementWords(r, 'retired', 'new deck')[1]).toMatch(/: 45\.0% \(90% range 41\.0%–54\.9%\) on 300 games → data\/decks\/archive\/.*-v9\.txt$/);
    expect(retirementWords({ metaMedian: 0.55, retired: [], judged: 2 }, 'retired', 'new deck')).toEqual([`Retirement: no new deck is shown below the meta decks' median (55.0%) (2 judged): ${RETIRE_RULE_WORDS}.`]);
    expect(RETIRE_RULE_WORDS).toContain('a deck that could be at the bar stays');
  });

  it('by default a season judges only its own new decks; --retire-earlier the earlier seasons’ (on today’s ratings, 9 of 22)', () => {
    const own = retireOwn(LIB, RATINGS.decks, ['s3-06-counter-rbg.txt'], 9);
    expect(own.judged).toBe(1);
    expect(own.retired.every((d) => d.file === 's3-06-counter-rbg.txt')).toBe(true);
    const earlier = retireEarlier(LIB, RATINGS.decks, 4, 9);
    const meta = META.map((d) => RATINGS.decks.find((x) => x.name === d.deck.name)!.wrField).sort((x, y) => x - y);
    expect(earlier.metaMedian).toBe(meta[3]);
    const below = BRED.filter((d) => RATINGS.decks.find((x) => x.name === d.deck.name)!.wrFieldHi < earlier.metaMedian!).map((d) => d.file);
    expect(earlier.retired.map((d) => d.file)).toEqual(below);
    for (const d of earlier.retired) expect(d.hi).toBeLessThan(earlier.metaMedian!);
    // a season never judges its own or later seasons' decks as earlier ones
    expect(retireEarlier(LIB, RATINGS.decks, 2, 9).retired.every((d) => d.file.startsWith('s1-'))).toBe(true);
    // nothing has been retired yet
    expect(Object.keys(RETIRED_OBJECTIVES)).toEqual([]);
  });
});

describe('the fit a season judges its own decks on', () => {
  it('is the ratings’ own pool and numbers (equal to src/data/ratings.json while that file is current)', () => {
    const rows = fitPooledRatings();
    const byName = new Map(rows.map((r) => [r.name, r]));
    expect(rows).toHaveLength(RATINGS.decks.length);
    for (const d of RATINGS.decks) {
      const r = byName.get(d.name)!;
      expect(r.games, d.name).toBe(d.games);
      expect(r.wrField, d.name).toBeCloseTo(d.wrField, 9);
      expect(r.wrFieldLo, d.name).toBeCloseTo(d.wrFieldLo, 9);
      expect(r.wrFieldHi, d.name).toBeCloseTo(d.wrFieldHi, 9);
    }
  }, 60_000);
});

describe('what a retirement writes (on copies)', () => {
  const setup = (name: string) => {
    const paths = { decks: path.join(tmp, name, 'custom'), archive: path.join(tmp, name, 'archive'), notes: path.join(tmp, name, 'seasons.ts'), archivedNotes: path.join(tmp, name, 'archived.ts') };
    fs.mkdirSync(paths.decks, { recursive: true });
    fs.copyFileSync(RETIRE_PATHS.notes, paths.notes);
    fs.copyFileSync(RETIRE_PATHS.archivedNotes, paths.archivedNotes);
    return paths;
  };
  const retiredOf = (d: LibraryDeck, bredIn: number): Retired => ({ file: d.file, archived: d.file.replace(/\.txt$/, '-v9.txt'), name: d.deck.name, legends: [...d.deck.legends], bredIn, wr: 0.4, lo: 0.36, hi: 0.44, games: 320, metaMedian: 0.516 });

  it('an earlier season’s deck: the file and its note move, with the reason; the other notes stay', () => {
    const paths = setup('earlier');
    const two = BRED.slice(0, 2).map((d) => retiredOf(d, +d.file.match(/^s(\d+)-/)![1]!));
    for (const d of two) fs.copyFileSync(path.join(RETIRE_PATHS.decks, d.file), path.join(paths.decks, d.file));
    const written = retireDecks(two, { date: '2026-12-01T00:00:00.000Z', season: 4, paths });
    expect(written).toHaveLength(4);
    const notes = fs.readFileSync(paths.notes, 'utf8');
    const archived = fs.readFileSync(paths.archivedNotes, 'utf8');
    for (const d of two) {
      expect(fs.existsSync(path.join(paths.decks, d.file))).toBe(false);
      const text = fs.readFileSync(path.join(paths.archive, d.archived), 'utf8');
      expect(text).toMatch(/\/\/ Retired: 2026-12-01, before Season 4 \(rated 40\.0%, 90% range 36\.0%–44\.0%, on 320 games; the meta decks' median 51\.6%\)\n$/);
      const lib = LIB.find((x) => x.file === d.file)!;
      expect(listFingerprint(parseDeck(text, d.archived).deck)).toBe(listFingerprint(lib.deck));
      expect(notes).not.toContain(`'${d.file}': {`);
      expect(archived).toContain(`  '${d.archived}': {`);
      expect(archived.indexOf(`'${d.archived}': {`)).toBeLessThan(archived.lastIndexOf(RETIRED_MARKER));
      expect(archived).toContain(`listId: '${SEASON_OBJECTIVES[d.file]!.listId}'`);
    }
    expect(archived).toContain('  // Retired 2026-12-01 before Season 4: rated 40.0% (90% range 36.0%–44.0%) against the library on 320 games, wholly below the meta decks\' median 51.6%.');
    for (const f of Object.keys(SEASON_OBJECTIVES).filter((f) => !two.some((d) => d.file === f))) expect(notes).toContain(`  '${f}': {`);
    // a second run is refused before anything moves: the deck files are gone
    expect(() => retireDecks(two, { date: '2026-12-01T00:00:00.000Z', season: 4, paths })).toThrow(/is not there/);
  });

  it('the season’s own new deck (no note yet): a placeholder line; a re-run replaces its own archived file and adds no second note', () => {
    const paths = setup('own');
    const src = BRED[0]!;
    const own: Retired = { ...retiredOf(src, 7), file: 's7-01-mutant-xyz.txt', archived: 's7-01-mutant-xyz-v9.txt' };
    const text = fs.readFileSync(path.join(RETIRE_PATHS.decks, src.file), 'utf8');
    fs.writeFileSync(path.join(paths.decks, own.file), text);
    retireDecks([own], { date: '2026-12-01T00:00:00.000Z', season: 7, paths });
    const listId = listFingerprint(src.deck);
    const archived = fs.readFileSync(paths.archivedNotes, 'utf8');
    expect(archived).toContain(placeholderLine(own.archived, listId, own.legends));
    expect(archived).toContain('  // Retired 2026-12-01 at the end of Season 7: rated 40.0%');
    expect(fs.readFileSync(path.join(paths.archive, own.archived), 'utf8')).toMatch(/\/\/ Retired: 2026-12-01, at the end of Season 7 /);
    // the --force re-run: the same deck again
    fs.writeFileSync(path.join(paths.decks, own.file), text);
    retireDecks([own], { date: '2026-12-02T00:00:00.000Z', season: 7, paths });
    expect(fs.readFileSync(paths.archivedNotes, 'utf8').split(`'${own.archived}'`)).toHaveLength(2);
    // another list under that archived name is refused
    fs.writeFileSync(path.join(paths.decks, own.file), fs.readFileSync(path.join(RETIRE_PATHS.decks, BRED[1]!.file), 'utf8'));
    expect(() => retireDecks([own], { date: '2026-12-02T00:00:00.000Z', season: 7, paths })).toThrow(/exists already, with another list/);
    // the placeholder note is a valid note for that list
    const note = retiredPlaceholder(listId, own.legends);
    expect(note).toMatchObject({ listId, placeholder: true, status: 'needs-owner' });
    expect(note.keyCards.map((k) => k.id)).toEqual([...new Set(own.legends)]);
  });

  it('moveNote refuses a missing note or marker', () => {
    expect(() => moveNote("  'a.txt': {\n  },\n", 'x', 'b.txt', 'b-v9.txt', 'why')).toThrow(/no note for b\.txt/);
    expect(() => moveNote("  'a.txt': {\n  },\n", 'no marker', 'a.txt', 'a-v9.txt', 'why')).toThrow(/have no/);
    const r = moveNote("start\n  'a.txt': {\n    listId: 'x',\n  },\n  'b.txt': {\n  },\nend", `t = {\n  ${RETIRED_MARKER}\n};`, 'a.txt', 'a-v9.txt', 'why');
    expect(r.notes).toBe("start\n  'b.txt': {\n  },\nend");
    expect(r.archived).toBe(`t = {\n  // why\n  'a-v9.txt': {\n    listId: 'x',\n  },\n  ${RETIRED_MARKER}\n};`);
  });
});
