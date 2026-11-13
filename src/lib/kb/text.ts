// Knowledge pack: the tokenizer and slugs. Accents and quotes are folded with the card-mention matcher's foldText, text
// is lower-cased and split on anything that is not a letter or digit (a dotted number such as a rule "1.10.2" stays one
// token), a short stop-word list is dropped and a plural "s" is stripped. No other stemming until the question set
// (docs/RAG_PLAN.md step 1.4) asks for it.
import { foldText } from '../cardMentions';

export const STOP_WORDS: ReadonlySet<string> = new Set(
  ('a an and are as at be by can do does for from has have how i if in into is it its me my of on or our so that the their ' +
    'then there these this those to was we what when where which who why will with you your').split(' '),
);

const TOKEN = /\d+(?:\.\d+)+|[\p{L}\p{N}]+/gu;

/** Strip a plural "s" from a word of four letters or more ("gigs" → "gig"), but not "ss" ("class", "process"). */
export function stem(t: string): string {
  return t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !/\d/.test(t) ? t.slice(0, -1) : t;
}

/** Search tokens of a string, in order (duplicates kept). Single letters are dropped; single digits are kept. */
export function tokenize(s: string): string[] {
  const out: string[] = [];
  for (const m of foldText(s).toLowerCase().matchAll(TOKEN)) {
    const t = m[0];
    if (STOP_WORDS.has(t)) continue;
    if (t.length === 1 && !/\d/.test(t)) continue;
    out.push(stem(t));
  }
  return out;
}

/** A name as the exact lookup compares it: folded, lower case, inner whitespace collapsed. */
export function nameKey(s: string): string {
  return foldText(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

/** An id-safe slug: folded, lower case, runs of other characters become one dash, no dash at either end. */
export function slug(s: string): string {
  return foldText(s)
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/\.(?![0-9])|(?<![0-9])\./g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Word count, as the passage splitter counts it. */
export const wordCount = (s: string): number => s.split(/\s+/).filter(Boolean).length;
