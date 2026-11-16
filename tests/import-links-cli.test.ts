// The command-line step of a deck import (scripts/import-links.ts, logic in scripts/import-links-run.ts): usage and
// refusals, the dry run, and --write into a temporary folder (deck files with their header, placeholder notes added to a
// copy of the note table, never over a file without --force, never a list the library has, never an unmatched card or
// an illegal list). Never writes into the repository.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { importLinksCommand } from '../scripts/import-links-run';
import { buildDeck, decodeDeckBuilder, IMPORT_KIND, NOTE_MARKER, type RawDeck } from '../src/lib/deckImport';
import { libraryDeck } from '../src/lib/library';
import { CARDS, CARD_BY_ID } from '../src/engine/cards';
import { ramLimits, validateDeck } from '../src/engine/deck';
import { MIN_BRED_UNITS, unitCount } from '../src/ai/breeder';
import { byIdLink, OWNER_COMPACT } from './deckImportFixtures';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-import-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const raw = (link: string): RawDeck => {
  const r = decodeDeckBuilder(new URL(link));
  if ('why' in r) throw new Error(r.why);
  return r.deck;
};

function setup(name: string, decks: RawDeck[]) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(path.join(dir, 'decks'), { recursive: true });
  const file = path.join(dir, 'in.json');
  fs.writeFileSync(file, JSON.stringify({ kind: IMPORT_KIND, schema: 1, ran: '2026-11-16T10:00:00Z', links: [], decks }));
  const notes = path.join(dir, 'imported.ts');
  fs.writeFileSync(notes, fs.readFileSync('src/content/deckObjectives/imported.ts', 'utf8'));
  return { dir, decksDir: path.join(dir, 'decks'), file, notes };
}

function cmd(argv: string[], library: { file: string; deck: { name: string; legends: string[]; main: string[]; sideboard: string[] } }[] = []) {
  const out: string[] = [];
  const err: string[] = [];
  const code = importLinksCommand(argv, { out: (l) => out.push(l), err: (l) => err.push(l), library: () => library, now: () => new Date('2026-11-16T12:00:00Z') });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const good = raw(byIdLink('Player One - Made Up Cup (1st)'));
const second = raw(byIdLink('Player Two - Made Up Cup (2nd)'));
second.main = second.main.map((r, i) => (i === 3 ? { ...r, count: r.count - 1 } : r));
second.main.push({ ref: 'cb-detonate', by: 'id', count: 1 });
const unmatched = { ...raw(byIdLink('Unmatched')), main: [...good.main, { ref: 'cb-not-a-card', by: 'id' as const, count: 1 }] };
const illegal = { ...raw(byIdLink('Illegal')), main: good.main.slice(0, 5) };

/** The made-up list with Units swapped for Programs and Gear until it has `units` Units (still legal). */
function fewUnits(units: number): RawDeck {
  const d = buildDeck(good).deck;
  const lim = ramLimits(d);
  const spare = CARDS.filter((c) => c.type !== 'Unit' && c.type !== 'Legend' && c.ram <= lim[c.color]).map((c) => c.id);
  const main = [...d.main];
  const copies = (id: string) => main.filter((x) => x === id).length;
  while (unitCount({ main }) > units) {
    const at = main.findIndex((id) => CARD_BY_ID[id]!.type === 'Unit');
    main[at] = spare.find((id) => copies(id) < 3)!;
  }
  const counts = new Map<string, number>();
  for (const id of main) counts.set(id, (counts.get(id) ?? 0) + 1);
  return { ...raw(byIdLink('Few Units')), main: [...counts].map(([ref, count]) => ({ ref, by: 'id' as const, count })) };
}

describe('scripts/import-links.ts', () => {
  it('prints its usage and refuses a bad command line with exit 2', () => {
    const h = cmd(['--help']);
    expect(h.code).toBe(0);
    expect(h.out).toMatch(/^Write library deck files from a deck-import file/);
    const { file } = setup('usage', [good]);
    for (const [argv, why] of [
      [[], /expected 1 argument/],
      [[file, '--nope'], /unknown option --nope/],
      [[file, '--date', '16/11/2026'], /--date: must be a date/],
      [[file, '--prefix', 'Bad Prefix'], /--prefix: use lower-case/],
      [[path.join(tmp, 'missing.json')], /cannot read/],
      [[file, '--dir', path.join(tmp, 'no-such-dir')], /is not a folder/],
    ] as const) {
      const r = cmd([...argv]);
      expect(r.code, argv.join(' ')).toBe(2);
      expect(r.err).toMatch(why);
    }
    const notImport = path.join(tmp, 'not-import.json');
    fs.writeFileSync(notImport, JSON.stringify({ kind: 'nct-profile', schema: 1 }));
    expect(cmd([notImport]).err).toMatch(/not a deck-import file/);
  });

  it('only prints without --write: each deck, its checks and the file it would write', () => {
    const s = setup('dry', [good, second, unmatched, illegal, raw(OWNER_COMPACT)]);
    const r = cmd([s.file, '--dir', s.decksDir, '--notes', s.notes]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('1. Player One - Made Up Cup (1st) by Player One (cyberpunk-tcg-sim.online, 1st)');
    expect(r.out).toContain(`would write ${path.join(s.decksDir, 'import-player-one-made-up-cup-1st.txt')}`);
    expect(r.out).toContain(`would write ${path.join(s.decksDir, 'import-player-two-made-up-cup-2nd.txt')}`);
    expect(r.out).toMatch(/not matched: cb-not-a-card is not a card this trainer knows\.\n {3}skipped: a card not matched/);
    expect(r.out).toMatch(/not legal: Main deck must be 40–50 cards \(has 13\)\.[\s\S]*skipped: the list is not legal/);
    expect(r.out).toContain('skipped: Same list as deck 1 of this import (Player One - Made Up Cup (1st)).');
    expect(r.out).toContain('2 decks would be written. Run again with --write to write them.');
    expect(fs.readdirSync(s.decksDir)).toEqual([]);
    expect(fs.readFileSync(s.notes, 'utf8')).not.toContain('import-player');
  });

  it('writes the deck files and their placeholder notes with --write, never over a file without --force', () => {
    const s = setup('write', [good, second]);
    const r = cmd([s.file, '--dir', s.decksDir, '--notes', s.notes, '--write']);
    expect(r.code).toBe(0);
    expect(fs.readdirSync(s.decksDir).sort()).toEqual(['import-player-one-made-up-cup-1st.txt', 'import-player-two-made-up-cup-2nd.txt']);
    const text = fs.readFileSync(path.join(s.decksDir, 'import-player-one-made-up-cup-1st.txt'), 'utf8');
    expect(text).toMatch(/^\/\/ Player One - Made Up Cup \(1st\)\n\/\/ Origin: Imported from cyberpunk-tcg-sim.online \(placed 1st\)\n\/\/ Author: Player One\n\/\/ Source: https:\/\/cyberpunk-tcg-sim.online\/deck-builder\/\?deck=/);
    expect(text).toContain('// Via: cyberpunk-tcg-sim.online (collected 2026-11-16)');
    const back = libraryDeck('import-player-one-made-up-cup-1st.txt', text)!;
    expect(back.deck.main.length).toBe(40);
    const notes = fs.readFileSync(s.notes, 'utf8');
    const one = buildDeck(good);
    expect(notes).toContain(`  'import-player-one-made-up-cup-1st.txt': importedPlaceholder('${one.listId}', [${one.deck.legends.map((id) => `'${id}'`).join(', ')}]),\n`);
    expect(notes).toContain(`  'import-player-two-made-up-cup-2nd.txt': importedPlaceholder('${buildDeck(second).listId}', [`);
    // one line each, just above the marker
    expect(notes).toMatch(/importedPlaceholder\([^\n]*\),\n {2}'import-player-two-made-up-cup-2nd.txt': importedPlaceholder\([^\n]*\),\n {2}\/\/ new imported decks are added above this line/);
    expect(notes).toContain(NOTE_MARKER);
    expect(r.out).toContain('Still to do before these are library decks:');
    expect(r.out).toContain('npm run evidence');

    // again: the files exist
    const again = cmd([s.file, '--dir', s.decksDir, '--notes', s.notes, '--write']);
    expect(again.code).toBe(1);
    expect(again.out).toContain('exists already (--force replaces it)');
    expect(again.out).toContain('No deck to write.');
    // with --force they are written again, and the notes are not added twice
    const forced = cmd([s.file, '--dir', s.decksDir, '--notes', s.notes, '--write', '--force']);
    expect(forced.code).toBe(0);
    expect(forced.out).toContain('has a note for import-player-one-made-up-cup-1st.txt already');
    expect(fs.readFileSync(s.notes, 'utf8').split("'import-player-one-made-up-cup-1st.txt':").length).toBe(2);
    expect(fs.readFileSync(s.notes, 'utf8')).toBe(notes);
    // a note the owner has written (a full object) is recognised too, and left as it is
    const owned = notes.replace(/ {2}'import-player-one-made-up-cup-1st.txt': importedPlaceholder\([^\n]*\),/, "  'import-player-one-made-up-cup-1st.txt': {\n    listId: 'x',\n    status: 'owner',\n  },");
    expect(owned).not.toBe(notes);
    fs.writeFileSync(s.notes, owned);
    const ownedRun = cmd([s.file, '--dir', s.decksDir, '--notes', s.notes, '--write', '--force']);
    expect(ownedRun.out).toContain('has a note for import-player-one-made-up-cup-1st.txt already');
    expect(fs.readFileSync(s.notes, 'utf8')).toBe(owned);
  });

  it('never writes a list the library already has', () => {
    const s = setup('library', [good]);
    const d = buildDeck(good).deck;
    const r = cmd([s.file, '--dir', s.decksDir, '--notes', s.notes, '--write'], [{ file: 'meta-twin.txt', deck: { ...d, name: 'Twin' } }]);
    expect(r.code).toBe(1);
    expect(r.out).toContain('skipped: The library already has this list: Twin (meta-twin.txt).');
    expect(fs.readdirSync(s.decksDir)).toEqual([]);
  });

  it('notes a list with fewer Units than the bred decks’ floor, as information only (imported lists are not held to it)', () => {
    const few = fewUnits(MIN_BRED_UNITS - 3);
    const built = buildDeck(few);
    expect(validateDeck(built.deck)).toEqual([]);
    expect(unitCount(built.deck)).toBe(MIN_BRED_UNITS - 3);
    const s = setup('units', [few]);
    const r = cmd([s.file, '--dir', s.decksDir, '--notes', s.notes, '--write']);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`note: ${MIN_BRED_UNITS - 3} Units; the bred decks' floor is ${MIN_BRED_UNITS}`);
    // no instruction to revisit the floor: the floor test does not count imported lists (tests/breeder-units.test.ts)
    expect(r.out).not.toContain('breeder-units');
    expect(r.out).not.toContain('MIN_BRED_UNITS');
    // the made-up list at the floor gets no such line
    expect(cmd([setup('units-ok', [good]).file, '--dir', s.decksDir]).out).not.toContain("the bred decks' floor");
  });

  it('prints the notes to add when the note table has no marker line', () => {
    const s = setup('nomarker', [good]);
    fs.writeFileSync(s.notes, 'export const IMPORTED_OBJECTIVES = {};\n');
    const r = cmd([s.file, '--dir', s.decksDir, '--notes', s.notes, '--write', '--prefix', 'x-']);
    expect(r.code).toBe(0);
    expect(fs.readdirSync(s.decksDir)).toEqual(['x-player-one-made-up-cup-1st.txt']);
    expect(r.out).toContain('Add these entries to the deck-note table');
    expect(r.out).toContain(`  'x-player-one-made-up-cup-1st.txt': importedPlaceholder('${buildDeck(good).listId}', [`);
    expect(fs.readFileSync(s.notes, 'utf8')).toBe('export const IMPORTED_OBJECTIVES = {};\n');
  });
});
