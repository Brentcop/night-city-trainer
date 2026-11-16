// The command-line step of a deck import (scripts/import-links.ts, docs/DECK_IMPORT.md): read a deck-import file, check
// every deck with src/lib/deckImport.ts (the admin page's code), and with --write write library deck files and their
// placeholder notes. The file system is real; the output, the library and the clock are handed in, so the tests run it
// on a temporary folder.
import fs from 'node:fs';
import path from 'node:path';
import { MIN_BRED_UNITS, unitCount } from '../src/ai/breeder';
import { CARD_BY_ID, cardLabel } from '../src/engine/cards';
import type { LibraryDeck } from '../src/lib/library';
import {
  buildDeck,
  deckFileName,
  deckFileProblem,
  deckFileText,
  holderWords,
  NOTE_MARKER,
  noteString,
  placeholderNote,
  readImport,
  sameListHolders,
  type ImportedDeck,
} from '../src/lib/deckImport';
import { ArgError, bool, parseArgs, str, usageOf } from './lib-node';

export interface ImportLinksIO {
  out: (line: string) => void;
  err: (line: string) => void;
  library: () => readonly Pick<LibraryDeck, 'file' | 'deck'>[];
  now?: () => Date;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FLAGS = {
  dir: str('data/decks'),
  prefix: str('import-', (v) => (/^[a-z0-9][a-z0-9-]{0,30}$/.test(v) ? undefined : 'use lower-case letters, digits and dashes (at most 31)')),
  notes: str('src/content/deckObjectives/imported.ts'),
  date: str(undefined, (v) => (DATE.test(v) && !Number.isNaN(Date.parse(v)) ? undefined : 'must be a date as YYYY-MM-DD')),
  write: bool(),
  force: bool(),
};

class Refusal extends Error {}

export function importLinksCommand(argv: string[], io: ImportLinksIO): number {
  if (argv.includes('--help') || argv.includes('-h')) {
    io.out(usageOf(new URL('./import-links.ts', import.meta.url).href));
    return 0;
  }
  try {
    return run(argv, io);
  } catch (e) {
    if (e instanceof Refusal || e instanceof ArgError) {
      io.err(`error: ${e.message.replace(/\.$/, '')}.`);
      io.err('Run with --help for usage.');
      return 2;
    }
    throw e;
  }
}

/** A deck in the run: what was built, and what this step does with it. */
interface Planned {
  d: ImportedDeck;
  file: string;
  skip: string;
}

function run(argv: string[], io: ImportLinksIO): number {
  const { values: V, positionals } = parseArgs(FLAGS, argv, { minPositionals: 1, maxPositionals: 1 });
  const input = positionals[0]!;
  let raw: string;
  try {
    raw = fs.readFileSync(input, 'utf8');
  } catch {
    throw new Refusal(`cannot read ${input}`);
  }
  const read = readImport(raw);
  if (!read.ok) throw new Refusal(read.why);
  if (!fs.existsSync(V.dir) || !fs.statSync(V.dir).isDirectory()) throw new Refusal(`--dir ${V.dir} is not a folder`);
  const date = V.date ?? (io.now?.() ?? new Date()).toISOString().slice(0, 10);

  const decks = read.doc.decks.map(buildDeck);
  const holders = sameListHolders(decks, io.library());
  const names = decks.map((d) => d.deck.name);
  const taken = new Set<string>();
  const plan: Planned[] = decks.map((d, i) => {
    let file = deckFileName(d.deck.name, V.prefix);
    for (let k = 2; taken.has(file); k++) file = deckFileName(`${d.deck.name} ${k}`, V.prefix);
    taken.add(file);
    const h = holders[i];
    const at = path.join(V.dir, file);
    const skip = d.unmatched.length
      ? `${d.unmatched.length === 1 ? 'a card' : `${d.unmatched.length} cards`} not matched`
      : d.illegal.length
        ? 'the list is not legal'
        : h
          ? holderWords(h, names)
          : fs.existsSync(at) && !V.force
            ? `${at} exists already (--force replaces it)`
            : deckFileProblem(file, deckFileText(d, date), d);
    return { d, file, skip };
  });

  io.out(`${input}: ${decks.length} deck${decks.length === 1 ? '' : 's'}${read.doc.ran ? `, collected ${read.doc.ran}` : ''}.`);
  for (const w of read.warnings) io.out(`  ${w}`);
  plan.forEach(({ d, file, skip }, i) => {
    const s = d.raw.source;
    io.out('');
    io.out(`${i + 1}. ${d.deck.name}${d.raw.author ? ` by ${d.raw.author}` : ''} (${s.site || 'unknown site'}${s.placement ? `, ${s.placement}` : ''})`);
    if (s.link) io.out(`   source: ${s.link}`);
    if (s.pageLink && s.pageLink !== s.link) io.out(`   found on: ${s.page ? `${s.page}, ` : ''}${s.pageLink}`);
    io.out(`   Legends: ${d.deck.legends.map((id) => cardLabel(CARD_BY_ID[id]!)).join(' / ') || 'none matched'}; main deck ${d.deck.main.length}, sideboard ${d.deck.sideboard.length}`);
    for (const u of d.unmatched) io.out(`   not matched: ${u}`);
    for (const p of d.illegal) io.out(`   not legal: ${p}`);
    for (const n of d.raw.notes) io.out(`   note: ${n}`);
    if (!skip && unitCount(d.deck) < MIN_BRED_UNITS) io.out(`   note: ${unitCount(d.deck)} Units, fewer than any hand-built library list (${MIN_BRED_UNITS}); see the last steps below`);
    io.out(skip ? `   skipped: ${skip}` : `   ${V.write ? 'writes' : 'would write'} ${path.join(V.dir, file)}`);
  });

  const ready = plan.filter((p) => !p.skip);
  io.out('');
  if (!ready.length) {
    io.out('No deck to write.');
    return 1;
  }
  if (!V.write) {
    io.out(`${ready.length} deck${ready.length === 1 ? '' : 's'} would be written. Run again with --write to write ${ready.length === 1 ? 'it' : 'them'}.`);
    return 0;
  }

  let notes: string | null = null;
  try {
    notes = fs.readFileSync(V.notes, 'utf8');
  } catch {
    notes = null;
  }
  const noteLater: string[] = [];
  for (const { d, file } of ready) {
    fs.writeFileSync(path.join(V.dir, file), deckFileText(d, date));
    io.out(`Wrote ${path.join(V.dir, file)}.`);
    const entry = placeholderNote(file, d);
    if (notes !== null && notes.includes(`${noteString(file)}: {`)) io.out(`  ${V.notes} has a note for ${file} already: check that its listId is '${d.listId}'.`);
    else if (notes !== null && notes.includes(NOTE_MARKER)) {
      notes = notes.replace(NOTE_MARKER, `${entry}\n\n${NOTE_MARKER}`);
      io.out(`  Added a placeholder note for it to ${V.notes}.`);
    } else noteLater.push(entry);
  }
  if (notes !== null) fs.writeFileSync(V.notes, notes);

  io.out('');
  io.out('Still to do before these are library decks:');
  if (noteLater.length) {
    io.out(`- Add these entries to the deck-note table (${V.notes} has no "${NOTE_MARKER.trim()}" line):`);
    for (const e of noteLater) io.out(e);
  }
  io.out(`- Write each deck's note: replace its placeholder in ${V.notes} and set status: 'owner' (the placeholder is enough for the tests).`);
  const fewUnits = ready.filter(({ d }) => unitCount(d.deck) < MIN_BRED_UNITS);
  if (fewUnits.length)
    io.out(
      `- ${fewUnits.map(({ file }) => file).join(', ')} ${fewUnits.length === 1 ? 'has' : 'have'} fewer than ${MIN_BRED_UNITS} Units, the fewest any hand-built library list has: tests/breeder-units.test.ts fails until MIN_BRED_UNITS in src/ai/breeder.ts (the bred decks' floor, with its reasoning) is revisited. That is the owner's call: it changes what the breeder makes.`,
    );
  io.out('- Run npm run evidence (every library deck has an evidence file), then npm run check:data.');
  io.out('- Run npm run typecheck and npx vitest run tests/deck-objectives.test.ts, then the whole suite before committing.');
  io.out('- The deck plays in tournaments and gets a rating once an event that includes it is recorded.');
  return 0;
}
