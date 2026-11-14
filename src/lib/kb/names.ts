// Knowledge pack: exact lookup by id, title and alias, case-insensitive and with accents and quotes folded. Every
// record that shares a name is returned (two cards with one name are both found), in id order.
import { nameKey } from './text';
import { byString } from './types';

export interface NamedRecord {
  id: string;
  title: string;
  aliases?: readonly string[];
}

export interface NameIndex {
  /** name key → record ids, sorted */
  byName: Map<string, string[]>;
  /** the longest name, in words (bounds the phrase scan in findNames) */
  maxWords: number;
}

export function buildNameIndex(records: readonly NamedRecord[]): NameIndex {
  const byName = new Map<string, string[]>();
  let maxWords = 1;
  const add = (name: string, id: string) => {
    const k = nameKey(name);
    if (!k) return;
    const list = byName.get(k) ?? [];
    if (!list.includes(id)) list.push(id);
    byName.set(k, list);
    maxWords = Math.max(maxWords, k.split(' ').length);
  };
  for (const r of records) {
    add(r.id, r.id);
    add(r.title, r.id);
    for (const a of r.aliases ?? []) add(a, r.id);
  }
  for (const list of byName.values()) list.sort(byString);
  return { byName, maxWords };
}

/** The records whose id, title or an alias is exactly `q` (folded, any case). */
export function lookupName(ix: NameIndex, q: string): string[] {
  return [...(ix.byName.get(nameKey(q)) ?? [])];
}

/** Adds a cleaned form to `out` when it has two words or more, differs from the title and is not there yet. */
function addForm(out: string[], title: string, s: string): void {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.split(' ').length >= 2 && nameKey(t) !== nameKey(title) && !out.some((o) => nameKey(o) === nameKey(t))) out.push(t);
}

/**
 * The shorter forms players use for a deck's title (step 4.7b): without the colour code in brackets at the end
 * ("NC-03 Static Shock (BBR)" → "NC-03 Static Shock"), then also without the code in front (a colour code such as
 * "RRB", a set number such as "NC-03" or "S1-01", or "Ladder:"), and a ladder's "A / B / C" also as "A B C". Only
 * forms of two words or more, and not the title itself; shortNames decides which of them are safe to use.
 */
export function deckNameForms(title: string): string[] {
  const out: string[] = [];
  const bare = title.replace(/\s*\([RGBY]{3}\)\s*$/i, '');
  const front = bare.replace(/^(?:[RGBY]{3}|(?:NC|S\d+)-\d+|Ladder:)\s+/i, '');
  for (const f of [bare, front]) {
    addForm(out, title, f);
    if (f.includes('/')) addForm(out, title, f.replace(/\s*\/\s*/g, ' '));
  }
  return out;
}

/**
 * The shorter forms people use for a synergy package's title (step 4.7b, statistics experiment): without the note in
 * brackets at the end ("High Gigs (8+)" → "High Gigs", "Rocker Units (Johnny Silverhand)" → "Rocker Units"), also
 * without a leading "The", and without commas ("Spend, then punish" → "Spend then punish": a question's commas are
 * dropped before its phrases are looked up, so a name with a comma could never be found inside one). Two words or more.
 */
export function packageNameForms(title: string): string[] {
  const out: string[] = [];
  const bare = title.replace(/\s*\([^()]*\)\s*$/, '');
  for (const f of [title, bare, bare.replace(/^the\s+/i, '')]) addForm(out, title, f.replace(/,/g, ' '));
  return out;
}

/**
 * Short names safe to look for inside a question: a form (from `forms`) that no other record of the set shares
 * ("Mutant" and "Cross" name several season decks) and that is not already the name of another record (a card or a
 * term keeps its name). `taken`: whether a folded name already names some record.
 */
export function shortNames(records: readonly NamedRecord[], forms: (title: string) => string[], taken: (key: string) => boolean): { id: string; name: string }[] {
  const owners = new Map<string, Set<string>>();
  const all = records.flatMap((d) => forms(d.title).map((name) => ({ id: d.id, name })));
  for (const f of all) owners.set(nameKey(f.name), (owners.get(nameKey(f.name)) ?? new Set()).add(f.id));
  return all.filter((f) => owners.get(nameKey(f.name))!.size === 1 && !taken(nameKey(f.name)));
}

/** Deck short names (deckNameForms) safe to look for inside a question; see shortNames. */
export const deckShortNames = (decks: readonly NamedRecord[], taken: (key: string) => boolean) => shortNames(decks, deckNameForms, taken);

/** Names shorter than this are found only when they are the whole query (a phrase scan would hit the Legend "V"). */
export const MIN_PHRASE_CHARS = 3;

/**
 * Records named inside a question: every run of whole words that is some record's name. Longer names first, then by
 * position in the question; a shorter name inside a longer one already found is skipped. The whole query, when it
 * is a name, comes first. `inPhrase` limits which records a part of the question may name (a doc heading such as
 * "Method" should not match the word "method"); the whole query may name any record.
 */
export function findNames(ix: NameIndex, q: string, inPhrase: (id: string) => boolean = () => true): string[] {
  return findNameHits(ix, q, inPhrase).map((h) => h.id);
}

/** A record named in a question, and how many words of the question named it (the whole query counts all its words). */
export interface NameHit {
  id: string;
  words: number;
}

/** findNames, with the number of words each name took. `given`: one name index, or several read as one. */
export function findNameHits(given: NameIndex | readonly NameIndex[], q: string, inPhrase: (id: string) => boolean = () => true): NameHit[] {
  const ixs: readonly NameIndex[] = Array.isArray(given) ? given : [given as NameIndex];
  const named = (key: string): readonly string[] | undefined => {
    if (ixs.length === 1) return ixs[0]!.byName.get(key);
    const ids = ixs.flatMap((x) => x.byName.get(key) ?? []);
    return ids.length ? [...new Set(ids)].sort(byString) : undefined;
  };
  const maxWords = Math.max(...ixs.map((x) => x.maxWords));
  const out: NameHit[] = [];
  const push = (ids: readonly string[], words: number) => {
    for (const id of ids) if (!out.some((h) => h.id === id)) out.push({ id, words });
  };
  const words = nameKey(q.replace(/[?!,;()"“”]/g, ' ')).split(' ').filter(Boolean);
  push(named(nameKey(q)) ?? [], nameKey(q).split(' ').filter(Boolean).length);
  const taken: boolean[] = words.map(() => false);
  for (let n = Math.min(maxWords, words.length); n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      if (taken.slice(i, i + n).some(Boolean)) continue;
      const phrase = words.slice(i, i + n).join(' ');
      const bare = phrase.replace(/[.:']+$/, '');
      const ids = (named(phrase) ?? named(bare) ?? []).filter(inPhrase);
      if (!ids.length || bare.length < MIN_PHRASE_CHARS) continue;
      push(ids, n);
      for (let j = i; j < i + n; j++) taken[j] = true;
    }
  }
  return out;
}
