// Retiring weak bred decks (docs/REVIEW_2026-11-24.md B.8, finding R1): opt-in, scripts/season.ts
// --retire-below-meta-median. Before a season breeds, every bred deck of an earlier season (data/decks/custom/s<N>-*.txt)
// whose power rating is below the meta decks' median rating is retired: its deck file moves to data/decks/archive/ as
// `<stem>-v<simulator version>.txt` (an archived deck of the 2026-11-11 baseline may already have its file name), with a
// "// Retired:" line, and its strategy note moves from src/content/deckObjectives/seasons.ts to RETIRED_OBJECTIVES in
// src/content/deckObjectives/archived.ts, keyed by the archived file, with one comment line saying when and why.
//
// The rule: a rating is the power rating's estimate (src/data/ratings.json wrField, the expected win rate against the
// library), the same number parent strength reads; a deck with fewer than PARENT_MIN_GAMES games on its current list is
// not judged (too few games to retire on); the bar is the median of the meta decks' ratings (on 2026-11-24 51.6, with 17
// of the 22 bred decks below it). The season file records each retired deck (`retired`) and its Legend trio counts as
// seen for later seasons of the same simulator version (scripts/breed-data.ts keptOutTriples), as a trio the gate kept
// out does. Nothing is retired by default: the default is the owner's call.
import fs from 'node:fs';
import path from 'node:path';
import type { LibraryDeck } from '../src/lib/library';
import { PARENT_MIN_GAMES, type RatedDeck } from '../src/lib/parentStrength';
import { RETIRED_MARKER } from '../src/content/deckObjectives/archived';

/** A bred deck to retire, and why. */
export interface Retired {
  file: string;
  /** the file it moves to in data/decks/archive/ */
  archived: string;
  name: string;
  legends: string[];
  /** the season that bred it */
  bredIn: number;
  wr: number;
  games: number;
  /** the meta decks' median rating, the bar */
  metaMedian: number;
}

const BRED_FILE = /^s(\d+)-.+\.txt$/;
const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i]! : (s[i - 1]! + s[i]!) / 2;
};

/**
 * The bred decks of seasons before `season` rated below the meta decks' median (both on the ratings' estimate; a deck
 * with fewer than PARENT_MIN_GAMES games is not judged). Null bar when no meta deck is rated. `simVersion` names the
 * archived files.
 */
export function retireBelowMetaMedian(lib: readonly LibraryDeck[], ratings: readonly RatedDeck[], season: number, simVersion: number): { metaMedian: number | null; retired: Retired[] } {
  const rated = new Map(ratings.filter((r) => Number.isFinite(r.wrField)).map((r) => [r.name, r]));
  const meta = lib.filter((d) => d.kind === 'meta').flatMap((d) => (rated.has(d.deck.name) ? [rated.get(d.deck.name)!.wrField] : []));
  if (!meta.length) return { metaMedian: null, retired: [] };
  const bar = median(meta);
  const retired: Retired[] = [];
  for (const d of lib) {
    const m = BRED_FILE.exec(d.file);
    if (!m || +m[1]! >= season) continue;
    const r = rated.get(d.deck.name);
    if (!r || !(r.games >= PARENT_MIN_GAMES) || !(r.wrField < bar)) continue;
    retired.push({ file: d.file, archived: `${d.file.replace(/\.txt$/, '')}-v${simVersion}.txt`, name: d.deck.name, legends: [...d.deck.legends], bredIn: +m[1]!, wr: r.wrField, games: r.games, metaMedian: bar });
  }
  return { metaMedian: bar, retired };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** One line per deck: "S1-02 Mutant (RYY): 31.4% on 412 games, below the meta decks' median 51.6%". */
export function retirementWords(r: { metaMedian: number | null; retired: readonly Retired[] }, act: 'retired' | 'would retire'): string[] {
  if (r.metaMedian === null) return ['Retirement: no meta deck is rated, so no bar; nothing retired.'];
  if (!r.retired.length) return [`Retirement: no bred deck is rated below the meta decks' median (${pct(r.metaMedian)}).`];
  return [
    `Retirement (${act}): ${r.retired.length} bred deck${r.retired.length === 1 ? '' : 's'} rated below the meta decks' median (${pct(r.metaMedian)}) on ${PARENT_MIN_GAMES} or more games:`,
    ...r.retired.map((d) => `  ${d.name}: ${pct(d.wr)} on ${d.games} games → data/decks/archive/${d.archived}`),
  ];
}

/**
 * The note text moved: `notes` (seasons.ts) without the entry keyed `file`, and `archived` (archived.ts) with it inserted
 * above RETIRED_MARKER, keyed `newKey`, after `comment`. Throws when the entry or the marker is missing.
 */
export function moveNote(notes: string, archived: string, file: string, newKey: string, comment: string): { notes: string; archived: string } {
  const lines = notes.split('\n');
  const start = lines.findIndex((l) => l === `  '${file}': {`);
  if (start < 0) throw new Error(`no note for ${file} in the season notes`);
  const end = lines.findIndex((l, i) => i > start && l === '  },');
  if (end < 0) throw new Error(`the note for ${file} has no end`);
  const block = lines.slice(start, end + 1);
  block[0] = `  '${newKey}': {`;
  const rest = [...lines.slice(0, start), ...lines.slice(end + 1)];
  const a = archived.split('\n');
  const mark = a.findIndex((l) => l.trim() === RETIRED_MARKER);
  if (mark < 0) throw new Error(`the archived notes have no "${RETIRED_MARKER}" line`);
  const out = [...a.slice(0, mark), `  // ${comment}`, ...block, ...a.slice(mark)];
  return { notes: rest.join('\n'), archived: out.join('\n') };
}

export const RETIRE_PATHS = {
  decks: 'data/decks/custom',
  archive: 'data/decks/archive',
  notes: 'src/content/deckObjectives/seasons.ts',
  archivedNotes: 'src/content/deckObjectives/archived.ts',
};

/**
 * Retire the decks: every check first (each deck file is there, no archived file of that name, each note is found),
 * then the moves. Returns the files written.
 */
export function retireDecks(retired: readonly Retired[], o: { date: string; season: number; paths?: typeof RETIRE_PATHS }): string[] {
  const p = o.paths ?? RETIRE_PATHS;
  if (!retired.length) return [];
  let notes = fs.readFileSync(p.notes, 'utf8');
  let archived = fs.readFileSync(p.archivedNotes, 'utf8');
  for (const d of retired) {
    if (!fs.existsSync(path.join(p.decks, d.file))) throw new Error(`${path.join(p.decks, d.file)} is not there`);
    if (fs.existsSync(path.join(p.archive, d.archived))) throw new Error(`${path.join(p.archive, d.archived)} exists already`);
    const why = `Retired ${o.date.slice(0, 10)} before Season ${o.season}: rated ${pct(d.wr)} against the library on ${d.games} games, below the meta decks' median ${pct(d.metaMedian)}.`;
    ({ notes, archived } = moveNote(notes, archived, d.file, d.archived, why));
  }
  const written: string[] = [];
  for (const d of retired) {
    const from = path.join(p.decks, d.file);
    const to = path.join(p.archive, d.archived);
    const text = fs.readFileSync(from, 'utf8').replace(/\n*$/, '\n');
    fs.mkdirSync(p.archive, { recursive: true });
    fs.writeFileSync(to, `${text}// Retired: ${o.date.slice(0, 10)}, before Season ${o.season} (rated ${pct(d.wr)} on ${d.games} games, below the meta decks' median ${pct(d.metaMedian)})\n`);
    fs.rmSync(from);
    written.push(to);
  }
  fs.writeFileSync(p.notes, notes);
  fs.writeFileSync(p.archivedNotes, archived);
  return [...written, p.notes, p.archivedNotes];
}

/** What is left after a retirement. */
export const RETIRE_NEXT = 'Retired decks: run npx tsx scripts/note-synergies.ts (a retired note may have named synergies), then npm run typecheck and npx vitest run tests/deck-objectives.test.ts.';
