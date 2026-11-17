// The slim table of the deck notes' synergies (src/content/deckObjectives/noteSynergies.ts, written by
// scripts/note-synergies.ts): the stored module is what the notes say, the bots read it and nothing else of the notes, no
// file under src/engine, src/ai or src/sim reaches a note table (so the game workers do not carry the notes' text), and
// the command's --check, --help and flag refusal. Never writes into the repository: the command's failing check runs on
// a copy in a temporary folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { DECK_OBJECTIVES, type ObjectiveTable } from '../src/content/deckObjectives';
import { NOTE_SYNERGIES } from '../src/content/deckObjectives/noteSynergies';
import { packagesForList } from '../src/ai/packages';
import { SYNERGY_BY_ID } from '../src/content/synergies/index';
import { codeFiles } from '../scripts/game-cache';
import { NOTE_SYNERGIES_COMMAND, NOTE_SYNERGIES_FILE, noteSynergiesOf, noteSynergiesProblem, noteSynergiesText } from '../scripts/note-synergies';
import { filesUnder, importGraph, rel, ROOT, staticGraph } from './importGraph';

const stored = () => fs.readFileSync(path.join(ROOT, NOTE_SYNERGIES_FILE), 'utf8');
const withNote = (file: string, change: Partial<ObjectiveTable[string]>): ObjectiveTable => ({ ...DECK_OBJECTIVES, [file]: { ...DECK_OBJECTIVES[file]!, ...change } });
const named = Object.entries(DECK_OBJECTIVES).filter(([, n]) => n.synergies?.length);

describe('the slim table is what the notes say', () => {
  it('the stored module is the text the command writes from the notes, byte for byte', () => {
    const problem = noteSynergiesProblem(DECK_OBJECTIVES, stored());
    expect(problem, problem ?? '').toBeNull();
    expect(NOTE_SYNERGIES).toEqual(noteSynergiesOf(DECK_OBJECTIVES));
    expect(Object.keys(NOTE_SYNERGIES).length).toBeGreaterThan(10);
  });

  it('holds one row per list whose note names synergies, sorted by fingerprint, as plain data with no imports', () => {
    expect(Object.keys(NOTE_SYNERGIES)).toEqual(Object.keys(NOTE_SYNERGIES).slice().sort());
    expect(new Set(Object.keys(NOTE_SYNERGIES))).toEqual(new Set(named.map(([, n]) => n.listId)));
    for (const [, n] of named) expect(NOTE_SYNERGIES[n.listId]).toEqual(n.synergies);
    const text = stored();
    expect(text).not.toMatch(/^\s*import\b/m);
    expect(text).not.toContain('\r');
    expect(text).toContain(NOTE_SYNERGIES_COMMAND);
    expect(text).toMatch(/do not edit\n\/\/ it by hand/);
  });

  it('the bots read it: a list with a note that names synergies gets exactly those packages', () => {
    const none = { legends: [] as string[], main: [] as string[] };
    for (const [listId, pkgs] of Object.entries(NOTE_SYNERGIES)) {
      const got = packagesForList(none, listId);
      expect(got.map((p) => p.id), listId).toEqual(pkgs.filter((id) => SYNERGY_BY_ID[id]));
      expect(got.every((p) => p.source === 'objective')).toBe(true);
    }
    expect(packagesForList(none, '0000000000000000')).toEqual([]);
  });

  it('the text is the same on every run, with LF line endings', () => {
    expect(noteSynergiesText(DECK_OBJECTIVES)).toBe(noteSynergiesText({ ...DECK_OBJECTIVES }));
    expect(noteSynergiesText(DECK_OBJECTIVES).endsWith('};\n')).toBe(true);
    // the table's order does not change it
    expect(noteSynergiesText(Object.fromEntries(Object.entries(DECK_OBJECTIVES).reverse()))).toBe(noteSynergiesText(DECK_OBJECTIVES));
  });
});

describe('the check fails with one sentence that names the command', () => {
  const [file, note] = named[0]!;
  const sentence = (how: string) => `${NOTE_SYNERGIES_FILE} does not match the deck notes' synergies (${how}); rewrite it with ${NOTE_SYNERGIES_COMMAND}.`;

  it("after a note's synergies change", () => {
    expect(noteSynergiesProblem(withNote(file, { synergies: [...note.synergies!, 'comeback'] }), stored())).toBe(sentence(`1 list(s) differ: ${note.listId}`));
    expect(noteSynergiesProblem(withNote(file, { synergies: [] }), stored())).toBe(sentence(`1 list(s) differ: ${note.listId}`));
  });

  it("after a note's listId changes", () => {
    const moved = 'ffffffffffffffff';
    expect(noteSynergiesProblem(withNote(file, { listId: moved }), stored())).toBe(sentence(`2 list(s) differ: ${[note.listId, moved].sort().join(', ')}`));
  });

  it('when a note without synergies gains some, when the file is missing, and when it was edited by hand', () => {
    const [plain, plainNote] = Object.entries(DECK_OBJECTIVES).find(([, n]) => !n.synergies?.length && !NOTE_SYNERGIES[n.listId])!;
    expect(noteSynergiesProblem(withNote(plain, { synergies: ['high-gig'] }), stored())).toBe(sentence(`1 list(s) differ: ${plainNote.listId}`));
    expect(noteSynergiesProblem(DECK_OBJECTIVES, null)).toBe(`${NOTE_SYNERGIES_FILE} is missing; write it with ${NOTE_SYNERGIES_COMMAND}.`);
    expect(noteSynergiesProblem(DECK_OBJECTIVES, stored().replace('// Generated', '//  Generated'))).toBe(sentence('the same lists, other bytes'));
    expect(noteSynergiesProblem(DECK_OBJECTIVES, stored().replace(/'\],\n/, "'] ,\n"))).toBe(sentence('it is not in the shape the command writes'));
  });
});

describe('the game workers do not reach the notes', () => {
  const DIR = 'src/content/deckObjectives/';
  /** The slim table and the vocabulary's types and terms are not notes; every other file in the folder is a note table. */
  const ALLOWED = new Set([`${DIR}noteSynergies.ts`, `${DIR}vocabulary.ts`]);
  const isNoteTable = (f: string) => f.startsWith(DIR) && !ALLOWED.has(f);

  it('no file under src/engine, src/ai or src/sim, nor anything they import (statically or dynamically), reaches a note table', () => {
    const entries = ['src/engine', 'src/ai', 'src/sim'].flatMap(filesUnder);
    expect(entries.length).toBeGreaterThan(20);
    const graph = [...importGraph(entries, { dynamic: true })].map(rel);
    expect(graph.filter(isNoteTable)).toEqual([]);
    // the walk does reach the folder: the bots read the slim table
    expect(graph).toContain(`${DIR}noteSynergies.ts`);
    expect(graph).toContain('src/ai/packages.ts');
  });

  it('the guard sees a note table when one is reached', () => {
    expect([...staticGraph([path.join(ROOT, 'src', 'ui', 'pages', 'DeckProfile.tsx')])].map(rel).filter(isNoteTable)).toContain(`${DIR}index.ts`);
    expect(isNoteTable(`${DIR}imported.ts`) && isNoteTable(`${DIR}archived.ts`) && isNoteTable(`${DIR}bredLate.ts`)).toBe(true);
  });

  it("the game cache's code hash covers the slim table and no note table", () => {
    expect(codeFiles(path.join(ROOT, 'scripts', 'worker.ts'), ROOT).filter((f) => f.startsWith(DIR))).toEqual([`${DIR}noteSynergies.ts`]);
  });
});

describe('the command', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-note-synergies-'));
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const TSX = pathToFileURL(path.join(ROOT, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href;
  const SCRIPT = path.join(ROOT, 'scripts', 'note-synergies.ts');
  const run = (args: string[], cwd = ROOT) => spawnSync(process.execPath, ['--import', TSX, SCRIPT, ...args], { cwd, encoding: 'utf8' });

  it('--check passes on the committed state and writes nothing', () => {
    const before = stored();
    const r = run(['--check']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.trim()).toBe(`${NOTE_SYNERGIES_FILE} is what the deck notes say (${Object.keys(NOTE_SYNERGIES).length} lists with synergies).`);
    expect(stored()).toBe(before);
  });

  it('--check fails with the sentence on a copy that differs, and on a missing file, and writes nothing', () => {
    const copy = path.join(tmp, NOTE_SYNERGIES_FILE);
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    const edited = stored().replace(/'\],\n/, "', 'comeback'],\n");
    fs.writeFileSync(copy, edited);
    const r = run(['--check'], tmp);
    expect(r.status).toBe(1);
    expect(r.stderr.trim()).toMatch(/^src\/content\/deckObjectives\/noteSynergies\.ts does not match the deck notes' synergies \(1 list\(s\) differ: [0-9a-f]{16}\); rewrite it with npx tsx scripts\/note-synergies\.ts\.$/);
    expect(fs.readFileSync(copy, 'utf8')).toBe(edited);
    fs.rmSync(copy);
    const m = run(['--check'], tmp);
    expect(m.status).toBe(1);
    expect(m.stderr.trim()).toBe(`${NOTE_SYNERGIES_FILE} is missing; write it with ${NOTE_SYNERGIES_COMMAND}.`);
    expect(fs.existsSync(copy)).toBe(false);
  });

  it('without --check it writes the table where it is missing, the same bytes as the stored one', () => {
    const dir = path.join(tmp, 'write');
    fs.mkdirSync(dir);
    const r = run([], dir);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.trim()).toMatch(/^Wrote src\/content\/deckObjectives\/noteSynergies\.ts \(\d+ lists with synergies\)$/);
    expect(fs.readFileSync(path.join(dir, NOTE_SYNERGIES_FILE), 'utf8')).toBe(stored());
    expect(run([], dir).stdout.trim()).toMatch(/^Unchanged: /);
  });

  it('--help prints the usage; an unknown flag exits 2', () => {
    const h = run(['--help']);
    expect(h.status).toBe(0);
    expect(h.stdout).toContain('npx tsx scripts/note-synergies.ts --check');
    const bad = run(['--bogus']);
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain('unknown option --bogus');
  });
});
