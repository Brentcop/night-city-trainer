// Which synergy packages a list has: the one answer every layer asks (docs/SYNERGIES.md "Which packages a list has";
// REVIEW_2026-11-24 S3, B.10). The bots and the coach (src/ai/packages.ts packagesForList / seatPackages), the Deck
// Lab's default keep (LabPackages.tsx labDefaultKeep), the forge's and optimizer's objective keep
// (scripts/package-flags.ts objectivePackages) and the package measurement (scripts/package-effects-run.ts) call it.
//
// In order:
//   1. `note`: the deck note's own `synergies`, when the caller has the note in hand (the Lab and the scripts, by file);
//   2. the slim table of the notes' synergies (src/content/deckObjectives/noteSynergies.ts) by the list's fingerprint.
//      scripts/note-synergies.ts writes a row for each note's `listId`, for the current list of the note's deck file
//      (so a list edited in place, by a forge or by hand after a re-measurement, keeps its note's packages) and for every
//      library file whose "// Parent list:" line names a list that has a row (so a forged copy keeps them);
//   3. `lineage`: the lists this one was made from, nearest first (the Deck Lab's tuned decks: the original's
//      fingerprint), each looked up in the same table;
//   4. else the packages the list is built around (synergiesIn, most built-around first).
// Unknown package ids are dropped. Plain data and pure; no note text (the game workers import this through the bots).
import { listFingerprint } from '../engine/deck';
import { SYNERGY_BY_ID, synergiesIn } from '../content/synergies/index';
import { NOTE_SYNERGIES } from '../content/deckObjectives/noteSynergies';

/** Where a list's packages came from: its note, a note of a list it was made from, or its own card counts. */
export type ListPackageSource = 'note' | 'parent-note' | 'built-around';

export interface ListPackages {
  /** package ids: the note's order, or synergiesIn's (most built-around first) */
  ids: readonly string[];
  source: ListPackageSource;
  /** the fingerprint whose note row named them ('parent-note': an ancestor's; absent for 'built-around' and a `note` given in hand) */
  from?: string;
}

export interface ListPackageOptions {
  /** the list's fingerprint, when the caller has it (else computed) */
  listId?: string;
  /** the deck note's own synergies, when the caller has the note (by file) */
  note?: readonly string[] | null;
  /** fingerprints of the lists this one was made from, nearest first */
  lineage?: readonly string[];
}

const known = (ids: readonly string[] | null | undefined): string[] => (ids ?? []).filter((id) => Object.prototype.hasOwnProperty.call(SYNERGY_BY_ID, id));
const row = (listId: string): string[] => (Object.prototype.hasOwnProperty.call(NOTE_SYNERGIES, listId) ? known(NOTE_SYNERGIES[listId]) : []);

/** The packages list `deck` has (see the header for the order of the rules). */
export function listPackages(deck: { legends: readonly string[]; main: readonly string[] }, o: ListPackageOptions = {}): ListPackages {
  const given = known(o.note);
  if (given.length) return { ids: given, source: 'note' };
  const listId = o.listId ?? listFingerprint({ legends: [...deck.legends], main: [...deck.main] });
  const own = row(listId);
  if (own.length) return { ids: own, source: 'note', from: listId };
  for (const parent of o.lineage ?? []) {
    const up = row(parent);
    if (up.length) return { ids: up, source: 'parent-note', from: parent };
  }
  return { ids: synergiesIn({ legends: [...deck.legends], main: [...deck.main] }).filter((x) => x.builtAround).map((x) => x.synergy.id), source: 'built-around' };
}

// ---------------------------------------------------------------- a deck file's lineage

const PARENT_RE = /^\/\/ Parent list: (.+)$/m;
const FP_RE = /^[0-9a-f]{16}$/;

/** The fingerprints a deck file's "// Parent list:" line names, nearest first (none without the line). */
export function parentListsOf(text: string): string[] {
  const m = PARENT_RE.exec(text.replace(/\r\n/g, '\n'));
  return m ? m[1]!.split(/,\s*/).map((x) => x.trim()).filter((x) => FP_RE.test(x)) : [];
}

/**
 * The "// Parent list:" line for a list made from list `parent` (the forge's deck files): `parent` first, then the lists
 * the parent's own file (`parentText`) names, each once, at most 8.
 */
export function parentListLine(parent: string, parentText = ''): string {
  const chain = [...new Set([parent, ...parentListsOf(parentText)])].slice(0, 8);
  return `// Parent list: ${chain.join(', ')}`;
}

/** The note-named packages alone (rules 1–3), or none: what a builder keeps by default when package flags are on. */
export function notePackages(deck: { legends: readonly string[]; main: readonly string[] }, o: ListPackageOptions = {}): string[] {
  const p = listPackages(deck, o);
  return p.source === 'built-around' ? [] : [...p.ids];
}
