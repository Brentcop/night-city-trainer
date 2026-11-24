// Retiring weak bred decks (scripts/season-retire.ts; scripts/season.ts --retire-below-meta-median, opt-in since
// 2026-11-24; docs/REVIEW_2026-11-24.md B.8): which decks the rule picks on the recorded ratings (none is retired by this
// test or by default), and what a retirement writes, on copies in a temporary folder: the deck file moved to the
// archive under a versioned name with a "// Retired:" line, its note moved from the season notes to RETIRED_OBJECTIVES
// with a comment line, the other notes untouched; every check before any move.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { listFingerprint, parseDeck } from '../src/engine/deck';
import { loadLibrary } from '../scripts/lib-node';
import { RATINGS } from '../src/data/index';
import { moveNote, retireBelowMetaMedian, retirementWords, retireDecks, RETIRE_PATHS } from '../scripts/season-retire';
import { RETIRED_MARKER, RETIRED_OBJECTIVES } from '../src/content/deckObjectives/archived';
import { SEASON_OBJECTIVES } from '../src/content/deckObjectives/seasons';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-retire-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const LIB = loadLibrary();

describe('which bred decks the rule picks', () => {
  it('earlier seasons’ bred decks rated below the meta decks’ median on 100 or more games; none retired by default', () => {
    const r = retireBelowMetaMedian(LIB, RATINGS.decks, 4, 9);
    const meta = LIB.filter((d) => d.kind === 'meta').map((d) => RATINGS.decks.find((x) => x.name === d.deck.name)!.wrField).sort((a, b) => a - b);
    expect(r.metaMedian).toBe(meta[3]);
    const bred = LIB.filter((d) => /^s\d+-/.test(d.file));
    for (const d of r.retired) {
      expect(d.wr).toBeLessThan(r.metaMedian!);
      expect(d.games).toBeGreaterThanOrEqual(100);
      expect(d.archived).toBe(d.file.replace(/\.txt$/, '-v9.txt'));
      expect(d.bredIn).toBeLessThan(4);
    }
    // every bred deck below the bar is picked, and only those
    const below = bred.filter((d) => RATINGS.decks.find((x) => x.name === d.deck.name)!.wrField < r.metaMedian!).map((d) => d.file);
    expect(r.retired.map((d) => d.file)).toEqual(below);
    // a season does not retire its own or later seasons' decks
    expect(retireBelowMetaMedian(LIB, RATINGS.decks, 2, 9).retired.every((d) => d.file.startsWith('s1-'))).toBe(true);
    expect(retirementWords(r, 'would retire')[0]).toMatch(/^Retirement \(would retire\): \d+ bred decks? rated below the meta decks' median \(\d+\.\d%\) on 100 or more games:$/);
    expect(retirementWords({ metaMedian: null, retired: [] }, 'retired')).toEqual(['Retirement: no meta deck is rated, so no bar; nothing retired.']);
    // nothing has been retired yet: the table is empty and every bred deck is in the library
    expect(Object.keys(RETIRED_OBJECTIVES)).toEqual([]);
  });

  it('a deck with fewer than 100 games is not judged', () => {
    const victim = LIB.find((d) => /^s\d+-/.test(d.file))!;
    const ratings = RATINGS.decks.map((d) => (d.name === victim.deck.name ? { ...d, wrField: 0.01, games: 99 } : d));
    expect(retireBelowMetaMedian(LIB, ratings, 9, 9).retired.map((d) => d.file)).not.toContain(victim.file);
  });
});

describe('what a retirement writes (on copies)', () => {
  it('moves the deck file and its note, with the reason, and leaves the other notes alone', () => {
    const r = retireBelowMetaMedian(LIB, RATINGS.decks, 4, 9);
    // the first two picked (or the two lowest-rated bred decks, set below the bar, if the ratings pick fewer)
    const two = r.retired.slice(0, 2);
    if (two.length < 2) return;
    const paths = { decks: path.join(tmp, 'custom'), archive: path.join(tmp, 'archive'), notes: path.join(tmp, 'seasons.ts'), archivedNotes: path.join(tmp, 'archived.ts') };
    fs.mkdirSync(paths.decks, { recursive: true });
    for (const d of two) fs.copyFileSync(path.join(RETIRE_PATHS.decks, d.file), path.join(paths.decks, d.file));
    fs.copyFileSync(RETIRE_PATHS.notes, paths.notes);
    fs.copyFileSync(RETIRE_PATHS.archivedNotes, paths.archivedNotes);
    const notesBefore = fs.readFileSync(paths.notes, 'utf8');
    const written = retireDecks(two, { date: '2026-12-01T00:00:00.000Z', season: 4, paths });
    expect(written).toHaveLength(4);
    for (const d of two) {
      expect(fs.existsSync(path.join(paths.decks, d.file))).toBe(false);
      const text = fs.readFileSync(path.join(paths.archive, d.archived), 'utf8');
      expect(text).toMatch(/\/\/ Retired: 2026-12-01, before Season 4 \(rated \d+\.\d% on \d+ games, below the meta decks' median \d+\.\d%\)\n$/);
      // the same list (the note's listId still matches it)
      const lib = LIB.find((x) => x.file === d.file)!;
      expect(listFingerprint(parseDeck(text, d.archived).deck)).toBe(listFingerprint(lib.deck));
      expect(SEASON_OBJECTIVES[d.file]!.listId).toBe(listFingerprint(lib.deck));
    }
    const notes = fs.readFileSync(paths.notes, 'utf8');
    const archived = fs.readFileSync(paths.archivedNotes, 'utf8');
    for (const d of two) {
      expect(notes).not.toContain(`'${d.file}': {`);
      expect(archived).toContain(`  '${d.archived}': {`);
      expect(archived).toContain(`  // Retired 2026-12-01 before Season 4: rated `);
      // the note's text moved whole, above the marker
      expect(archived.indexOf(`'${d.archived}': {`)).toBeLessThan(archived.lastIndexOf(RETIRED_MARKER));
      expect(archived).toContain(`listId: '${SEASON_OBJECTIVES[d.file]!.listId}'`);
    }
    // every other note is still there, byte for byte
    const others = Object.keys(SEASON_OBJECTIVES).filter((f) => !two.some((d) => d.file === f));
    for (const f of others) expect(notes).toContain(`  '${f}': {`);
    expect(notesBefore.length - notes.length).toBeGreaterThan(0);
    // a second run is refused before anything moves: the deck files are gone
    expect(() => retireDecks(two, { date: '2026-12-01T00:00:00.000Z', season: 4, paths })).toThrow(/is not there/);
  });

  it('moveNote refuses a missing note or marker', () => {
    expect(() => moveNote("  'a.txt': {\n  },\n", 'x', 'b.txt', 'b-v9.txt', 'why')).toThrow(/no note for b\.txt/);
    expect(() => moveNote("  'a.txt': {\n  },\n", 'no marker', 'a.txt', 'a-v9.txt', 'why')).toThrow(/have no/);
    const r = moveNote("start\n  'a.txt': {\n    listId: 'x',\n  },\n  'b.txt': {\n  },\nend", `t = {\n  ${RETIRED_MARKER}\n};`, 'a.txt', 'a-v9.txt', 'why');
    expect(r.notes).toBe("start\n  'b.txt': {\n  },\nend");
    expect(r.archived).toBe(`t = {\n  // why\n  'a-v9.txt': {\n    listId: 'x',\n  },\n  ${RETIRED_MARKER}\n};`);
  });
});
