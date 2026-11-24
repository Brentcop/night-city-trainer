// Retiring weak bred decks (docs/REVIEW_2026-11-24.md B.8, finding R1; the owner's choice of 2026-11-24, "From next
// season on": each season retires its own bred decks that end below the bar; today's library stays as it is).
//
// The rule, "shown below the bar": a deck is retired when its 90% range on the expected win rate against the library lies
// wholly below the meta decks' median (the median of the meta decks' estimates on the same fit). A deck that could be
// at the bar stays, as "could not tell" does everywhere else in the project. The range is the power ratings' own
// (src/lib/ratingModel.ts fieldInterval, full covariance), so a deck with few games has a wide range and is rarely shown
// below.
//
// - By default (scripts/season.ts --retire on): at the season's end, the decks the season itself bred and entered, judged
//   on a fit that includes the season's own round robin (its rating run, pooled as the ratings pool it:
//   scripts/breed-data.ts fitPooledRatings). Never an earlier season's deck. Without the season's rating run (--rating-run
//   off, or a bot other than hard) the new decks have no games on the fit, and nothing is judged.
// - Opt-in (--retire-earlier): before breeding, the bred decks of earlier seasons, judged on src/data/ratings.json.
//
// A retired deck's file moves to data/decks/archive/ as `<stem>-v<simulator version>.txt` (an archived deck of the
// 2026-11-11 baseline may already have its file name), with a "// Retired:" line. Its strategy note moves from
// src/content/deckObjectives/seasons.ts to RETIRED_OBJECTIVES in src/content/deckObjectives/archived.ts, keyed by the
// archived file, with one comment line saying when and why; a deck of the season itself has no note yet, so it gets a
// one-line placeholder (retiredPlaceholder). The season file records each retired deck (`retired`), and its Legend trio
// counts as seen for later seasons of the same simulator version (scripts/breed-data.ts keptOutTriples), as a trio the
// gate kept out does.
import fs from 'node:fs';
import path from 'node:path';
import { listFingerprint, parseDeck } from '../src/engine/deck';
import type { LibraryDeck } from '../src/lib/library';
import type { RatedDeck } from '../src/lib/parentStrength';
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
  /** its estimate and 90% range on the win rate against the library */
  wr: number;
  lo: number;
  hi: number;
  games: number;
  /** the meta decks' median estimate, the bar */
  metaMedian: number;
}

/** The rule, in words (the usage text, the console and the season report say it this way). */
export const RETIRE_RULE_WORDS = "a deck is retired when its 90% range on the win rate against the library lies wholly below the meta decks' median (shown below the bar); a deck that could be at the bar stays";

const BRED_FILE = /^s(\d+)-.+\.txt$/;
const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i]! : (s[i - 1]! + s[i]!) / 2;
};

/**
 * Of `candidates`, the decks shown below the meta decks' median: their 90% range's upper end is below the median of the
 * meta decks' estimates, all read from `ratings`. A candidate without a row is not judged. Null bar when no meta deck is
 * rated. `simVersion` names the archived files.
 */
export function shownBelow(lib: readonly LibraryDeck[], ratings: readonly RatedDeck[], candidates: readonly LibraryDeck[], simVersion: number): { metaMedian: number | null; retired: Retired[]; judged: number } {
  const rated = new Map(ratings.filter((r) => Number.isFinite(r.wrField)).map((r) => [r.name, r]));
  const meta = lib.filter((d) => d.kind === 'meta').flatMap((d) => (rated.has(d.deck.name) ? [rated.get(d.deck.name)!.wrField] : []));
  if (!meta.length) return { metaMedian: null, retired: [], judged: 0 };
  const bar = median(meta);
  const retired: Retired[] = [];
  let judged = 0;
  for (const d of candidates) {
    const r = rated.get(d.deck.name);
    if (!r || !Number.isFinite(r.wrFieldHi)) continue;
    judged++;
    if (!(r.wrFieldHi < bar)) continue;
    const m = BRED_FILE.exec(d.file);
    retired.push({ file: d.file, archived: `${d.file.replace(/\.txt$/, '')}-v${simVersion}.txt`, name: d.deck.name, legends: [...d.deck.legends], bredIn: m ? +m[1]! : 0, wr: r.wrField, lo: r.wrFieldLo, hi: r.wrFieldHi, games: r.games, metaMedian: bar });
  }
  return { metaMedian: bar, retired, judged };
}

/** --retire-earlier (opt-in): the bred decks of seasons before `season` shown below the bar on `ratings`. */
export function retireEarlier(lib: readonly LibraryDeck[], ratings: readonly RatedDeck[], season: number, simVersion: number) {
  return shownBelow(lib, ratings, lib.filter((d) => { const m = BRED_FILE.exec(d.file); return !!m && +m[1]! < season; }), simVersion);
}

/** The default at a season's end: of the decks this season bred and entered (`files`), those shown below the bar on `ratings` (a fit with the season's round robin). */
export function retireOwn(lib: readonly LibraryDeck[], ratings: readonly RatedDeck[], files: readonly string[], simVersion: number) {
  return shownBelow(lib, ratings, lib.filter((d) => files.includes(d.file)), simVersion);
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** The verdict in words: a line for the rule and one per deck ("S1-02 Mutant (RYY): 31.4% (90% range 27.7–35.4%) on 367 games"). */
export function retirementWords(r: { metaMedian: number | null; retired: readonly Retired[]; judged?: number }, act: 'retired' | 'would retire', which = 'bred deck'): string[] {
  if (r.metaMedian === null) return ['Retirement: no meta deck is rated, so there is no bar; nothing retired.'];
  const judged = r.judged !== undefined ? ` (${r.judged} judged)` : '';
  if (!r.retired.length) return [`Retirement: no ${which} is shown below the meta decks' median (${pct(r.metaMedian)})${judged}: ${RETIRE_RULE_WORDS}.`];
  return [
    `Retirement (${act}): ${r.retired.length} ${which}${r.retired.length === 1 ? '' : 's'} shown below the meta decks' median (${pct(r.metaMedian)})${judged}: ${RETIRE_RULE_WORDS}.`,
    ...r.retired.map((d) => `  ${d.name}: ${pct(d.wr)} (90% range ${pct(d.lo)}–${pct(d.hi)}) on ${d.games} games → data/decks/archive/${d.archived}`),
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
  return { notes: rest.join('\n'), archived: insertAboveMarker(archived, [`  // ${comment}`, ...block]) };
}

/** `archived` with `lines` inserted above RETIRED_MARKER (throws when the marker is missing). */
function insertAboveMarker(archived: string, lines: readonly string[]): string {
  const a = archived.split('\n');
  const mark = a.findIndex((l) => l.trim() === RETIRED_MARKER);
  if (mark < 0) throw new Error(`the archived notes have no "${RETIRED_MARKER}" line`);
  return [...a.slice(0, mark), ...lines, ...a.slice(mark)].join('\n');
}

/** A one-line placeholder note for a retired deck that never had one (a deck retired at the end of its own season). */
export function placeholderLine(archivedFile: string, listId: string, legends: readonly string[]): string {
  return `  '${archivedFile}': retiredPlaceholder('${listId}', [${legends.map((l) => `'${l}'`).join(', ')}]),`;
}

export const RETIRE_PATHS = {
  decks: 'data/decks/custom',
  archive: 'data/decks/archive',
  notes: 'src/content/deckObjectives/seasons.ts',
  archivedNotes: 'src/content/deckObjectives/archived.ts',
};

/**
 * Retire the decks: every check first (each deck file is there; no archived file of that name, unless it holds the same
 * list, which a re-run of the season replaces), then the moves. A deck's note moves from the season notes when it has
 * one, else it gets a placeholder; a note already under the archived name (a re-run) is left as it is. Returns the files
 * written.
 */
export function retireDecks(retired: readonly Retired[], o: { date: string; season: number; paths?: typeof RETIRE_PATHS }): string[] {
  const p = o.paths ?? RETIRE_PATHS;
  if (!retired.length) return [];
  let notes = fs.readFileSync(p.notes, 'utf8');
  let archived = fs.readFileSync(p.archivedNotes, 'utf8');
  for (const d of retired) {
    const from = path.join(p.decks, d.file);
    if (!fs.existsSync(from)) throw new Error(`${from} is not there`);
    const text = fs.readFileSync(from, 'utf8');
    const listId = listFingerprint(parseDeck(text, d.file).deck);
    const to = path.join(p.archive, d.archived);
    if (fs.existsSync(to) && listFingerprint(parseDeck(fs.readFileSync(to, 'utf8'), d.archived).deck) !== listId) throw new Error(`${to} exists already, with another list`);
    const why = `Retired ${o.date.slice(0, 10)} ${d.bredIn === o.season ? `at the end of Season ${o.season}` : `before Season ${o.season}`}: rated ${pct(d.wr)} (90% range ${pct(d.lo)}–${pct(d.hi)}) against the library on ${d.games} games, wholly below the meta decks' median ${pct(d.metaMedian)}.`;
    if (archived.includes(`  '${d.archived}':`)) continue;
    if (notes.includes(`  '${d.file}': {`)) ({ notes, archived } = moveNote(notes, archived, d.file, d.archived, why));
    else archived = insertAboveMarker(archived, [`  // ${why}`, placeholderLine(d.archived, listId, d.legends)]);
  }
  const written: string[] = [];
  for (const d of retired) {
    const from = path.join(p.decks, d.file);
    const to = path.join(p.archive, d.archived);
    const text = fs.readFileSync(from, 'utf8').replace(/\n*$/, '\n');
    fs.mkdirSync(p.archive, { recursive: true });
    fs.writeFileSync(to, `${text}// Retired: ${o.date.slice(0, 10)}, ${d.bredIn === o.season ? `at the end of Season ${o.season}` : `before Season ${o.season}`} (rated ${pct(d.wr)}, 90% range ${pct(d.lo)}–${pct(d.hi)}, on ${d.games} games; the meta decks' median ${pct(d.metaMedian)})\n`);
    fs.rmSync(from);
    written.push(to);
  }
  fs.writeFileSync(p.notes, notes);
  fs.writeFileSync(p.archivedNotes, archived);
  return [...written, p.notes, p.archivedNotes];
}

/** What is left after a retirement. */
export const RETIRE_NEXT = 'Retired decks: run npx tsx scripts/note-synergies.ts (a retired note may have named synergies), then npm run typecheck and npx vitest run tests/deck-objectives.test.ts.';
