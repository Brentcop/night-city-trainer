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

/** findNames, with the number of words each name took. */
export function findNameHits(ix: NameIndex, q: string, inPhrase: (id: string) => boolean = () => true): NameHit[] {
  const out: NameHit[] = [];
  const push = (ids: readonly string[], words: number) => {
    for (const id of ids) if (!out.some((h) => h.id === id)) out.push({ id, words });
  };
  const words = nameKey(q.replace(/[?!,;()"“”]/g, ' ')).split(' ').filter(Boolean);
  push(lookupName(ix, q), nameKey(q).split(' ').filter(Boolean).length);
  const taken: boolean[] = words.map(() => false);
  for (let n = Math.min(ix.maxWords, words.length); n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      if (taken.slice(i, i + n).some(Boolean)) continue;
      const phrase = words.slice(i, i + n).join(' ');
      const bare = phrase.replace(/[.:']+$/, '');
      const ids = (ix.byName.get(phrase) ?? ix.byName.get(bare) ?? []).filter(inPhrase);
      if (!ids.length || bare.length < MIN_PHRASE_CHARS) continue;
      push(ids, n);
      for (let j = i; j < i + n; j++) taken[j] = true;
    }
  }
  return out;
}
