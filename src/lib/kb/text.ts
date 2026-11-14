// Knowledge pack: the tokenizer and slugs. Accents and quotes are folded with the card-mention matcher's foldText, text
// is lower-cased and split on anything that is not a letter or digit (a dotted number such as a rule "1.10.2" stays one
// token), a short stop-word list is dropped and each word is stemmed in one of three modes (StemMode). The mode belongs
// to the index: search.ts `buildIndex(records, { stem })` stems the records with it and a search stems the question the
// same way. Exact names (nameKey) are never stemmed. Measured as docs/RAG_PLAN.md step 4.7a.
import { foldText } from '../cardMentions';

export const STOP_WORDS: ReadonlySet<string> = new Set(
  ('a an and are as at be by can do does for from has have how i if in into is it its me my of on or our so that the their ' +
    'then there these this those to was we what when where which who why will with you your').split(' '),
);

const TOKEN = /\d+(?:\.\d+)+|[\p{L}\p{N}]+/gu;

/**
 * How words are folded. `s`: a plural "s" only (the pack's first tokenizer). `light`: plurals, "-ing" and "-ed" undone
 * by the general rules of English spelling, and the irregular forms of verbs the game uses (IRREGULAR). `porter`: the
 * irregular forms, then the Porter (1980) algorithm. Anything with a digit is left alone in every mode, and so are short
 * words (three letters or fewer in `s` and `light`, two in `porter`, as the published algorithm has it).
 */
export const STEM_MODES = ['s', 'light', 'porter'] as const;
export type StemMode = (typeof STEM_MODES)[number];

/** Strip a plural "s" from a word of four letters or more ("gigs" → "gig"), but not "ss" ("class", "process"). */
function stemS(t: string): string {
  return t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !/\d/.test(t) ? t.slice(0, -1) : t;
}

/**
 * Irregular forms of verbs that the cards and rules use, each to its plain form ("stolen" → "steal"). Applied in
 * `light` and `porter` before anything else (also to words of three letters: "won", "ran", "met").
 */
export const IRREGULAR: Readonly<Record<string, string>> = Object.fromEntries(
  (
    [
      ['spend', 'spent'],
      ['sell', 'sold'],
      ['draw', 'drew drawn'],
      ['steal', 'stole stolen'],
      ['pay', 'paid'],
      ['choose', 'chose chosen'],
      ['win', 'won'],
      ['lose', 'lost'],
      ['take', 'took taken'],
      ['give', 'gave given'],
      ['go', 'goes went gone'],
      ['come', 'came'],
      ['become', 'became'],
      ['begin', 'began begun'],
      ['get', 'got gotten'],
      ['hold', 'held'],
      ['find', 'found'],
      ['show', 'shown'],
      ['know', 'knew known'],
      ['break', 'broke broken'],
      ['make', 'made'],
      ['see', 'seen'],
      ['meet', 'met'],
      ['fight', 'fought'],
      ['run', 'ran'],
      ['bring', 'brought'],
      ['send', 'sent'],
    ] as const
  ).flatMap(([base, forms]) => forms.split(' ').map((f) => [f, base])),
);

const isVowelChar = (c: string | undefined) => c !== undefined && 'aeiou'.includes(c);

/** `light`: the plural or third-person "s" ("abilities" → "ability", "classes" → "class", "dies" → "die"). */
function lightPlural(w: string): string {
  if (/(ss|us|is)$/.test(w)) return w; // class, bonus, analysis: not plurals
  if (w.endsWith('ies')) return w.length > 4 ? `${w.slice(0, -3)}y` : w.slice(0, -1); // abilities → ability; dies → die
  if (/(sses|xes|zzes|ches|shes)$/.test(w)) return w.slice(0, -2); // classes, boxes, buzzes, matches, wishes
  if (w.endsWith('oes') && w.length >= 6) return w.slice(0, -2); // heroes → hero
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

/**
 * `light`: whether a stem left by removing "-ing" or "-ed" (and not undoubled) had a silent "e" ("mak" → "make"). A
 * one-syllable stem ending in one vowel and one consonant other than w, x, y would have doubled it ("flip" →
 * "flipping"), so it had an "e"; and no English word ends in c, v, u, a consonant before l, dg, rg, n/r/p/l before s,
 * two vowels before s or z, -iz, a consonant before -at, or a consonant before -ar, -ir, -ur (or -uir) without one.
 */
function hadSilentE(b: string): boolean {
  if (/^[^aeiouy]*[aeiou][^aeiouwxy]$/.test(b)) return true; // mak(e), us(e), giv(e), rul(e)
  return /(c|v|u|[bcdfgkptz]l|dg|rg|[nrpl]s|[aeiou]{2}[sz]|iz|[^aeiou]at|[^aeiou][aiu]r|uir)$/.test(b);
}

/** `light`: "-ing" and "-ed" undone ("flipping" → "flip", "making" → "make", "copied" → "copy", "dying" → "die"). */
function lightVerb(w: string): string {
  if (w.endsWith('eed')) return w; // need, speed, proceed: not "-ed"
  if (w.endsWith('ied')) return w.length === 4 ? `${w[0]}ie` : w.length > 4 ? `${w.slice(0, -3)}y` : w; // died; copied
  if (w.length === 5 && w.endsWith('ying')) return `${w[0]}ie`; // dying, tying, lying
  const base = w.endsWith('ing') ? w.slice(0, -3) : w.endsWith('ed') ? w.slice(0, -2) : null;
  // the stem keeps a vowel: "ring", "bring", "red", "bed" are not inflections
  if (base === null || base.length < 2 || !/[aeiouy]/.test(base)) return w;
  // a doubled final consonant after a single vowel is undone ("flipp" → "flip", "equipp" → "equip": qu is a consonant
  // here), but not ll, ss, ff, zz ("call", "pass") and not after a vowel alone ("add")
  if (/(?:[^aeiou]|qu)[aeiou]([bdgmnprt])\1$/.test(base)) return base.slice(0, -1);
  return hadSilentE(base) ? `${base}e` : base;
}

/** `light`: plural first, then "-ing" / "-ed" ("rulings" → "ruling" → "rule"); a final "ie" is written "y" ("eddie"). */
function stemLight(w: string): string {
  const v = lightVerb(lightPlural(w));
  return v.length >= 5 && v.endsWith('ie') ? `${v.slice(0, -2)}y` : v;
}

// ---- Porter (1980), from the published description: M. F. Porter, "An algorithm for suffix stripping", Program 14(3).

/** A consonant is a letter other than a, e, i, o, u, and other than a y after a consonant. */
function isCons(w: string, i: number): boolean {
  const c = w[i]!;
  if (isVowelChar(c)) return false;
  if (c === 'y') return i === 0 || !isCons(w, i - 1);
  return true;
}

/** m in [C](VC)^m[V]. */
function measure(s: string): number {
  let m = 0;
  let i = 0;
  const n = s.length;
  while (i < n && isCons(s, i)) i++;
  while (i < n) {
    while (i < n && !isCons(s, i)) i++;
    if (i >= n) break;
    while (i < n && isCons(s, i)) i++;
    m++;
  }
  return m;
}

const hasVowel = (s: string) => [...s].some((_, i) => !isCons(s, i));
const endsDouble = (s: string) => s.length >= 2 && s[s.length - 1] === s[s.length - 2] && isCons(s, s.length - 1);
/** *o: the stem ends consonant-vowel-consonant, and the last consonant is not w, x or y. */
const endsCvc = (s: string) => s.length >= 3 && isCons(s, s.length - 3) && !isCons(s, s.length - 2) && isCons(s, s.length - 1) && !'wxy'.includes(s[s.length - 1]!);

/** One of steps 2 to 4: the longest suffix that matches is replaced when its stem passes `ok`; no other is tried. */
function replaceLongest(w: string, rules: readonly (readonly [string, string])[], ok: (stem: string, suffix: string) => boolean): string {
  let best: readonly [string, string] | undefined;
  for (const r of rules) if (w.endsWith(r[0]) && (!best || r[0].length > best[0].length)) best = r;
  if (!best) return w;
  const stem = w.slice(0, -best[0].length);
  return ok(stem, best[0]) ? stem + best[1] : w;
}

const STEP2: readonly (readonly [string, string])[] = [
  ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'], ['izer', 'ize'], ['abli', 'able'], ['alli', 'al'],
  ['entli', 'ent'], ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'], ['ator', 'ate'], ['alism', 'al'],
  ['iveness', 'ive'], ['fulness', 'ful'], ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'],
];
const STEP3: readonly (readonly [string, string])[] = [['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'], ['ical', 'ic'], ['ful', ''], ['ness', '']];
const STEP4: readonly (readonly [string, string])[] = ['al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement', 'ment', 'ent', 'ion', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize'].map((s) => [s, ''] as const);

/**
 * Words Porter would fold into a game term they are not a form of: "unite" (and its forms) would become "unit", a card
 * type. Kept whole.
 */
const PORTER_KEEP: Readonly<Record<string, string>> = { unite: 'unite', unites: 'unite', united: 'unite', uniting: 'unite' };

/** The Porter stemmer: steps 1a, 1b, 1c, 2, 3, 4, 5a and 5b. Words of one or two letters are left alone. */
export function porterStem(word: string): string {
  if (word.length <= 2) return word;
  let w = word;
  // step 1a
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies')) w = w.slice(0, -2);
  else if (!w.endsWith('ss') && w.endsWith('s')) w = w.slice(0, -1);
  // step 1b
  let again = false;
  if (w.endsWith('eed')) {
    if (measure(w.slice(0, -3)) > 0) w = w.slice(0, -1);
  } else if (w.endsWith('ed') && hasVowel(w.slice(0, -2))) {
    w = w.slice(0, -2);
    again = true;
  } else if (w.endsWith('ing') && hasVowel(w.slice(0, -3))) {
    w = w.slice(0, -3);
    again = true;
  }
  if (again) {
    if (/(at|bl|iz)$/.test(w)) w += 'e';
    else if (endsDouble(w) && !/[lsz]$/.test(w)) w = w.slice(0, -1);
    else if (measure(w) === 1 && endsCvc(w)) w += 'e';
  }
  // step 1c
  if (w.endsWith('y') && hasVowel(w.slice(0, -1))) w = `${w.slice(0, -1)}i`;
  // steps 2 to 4
  w = replaceLongest(w, STEP2, (s) => measure(s) > 0);
  w = replaceLongest(w, STEP3, (s) => measure(s) > 0);
  w = replaceLongest(w, STEP4, (s, suffix) => measure(s) > 1 && (suffix !== 'ion' || /[st]$/.test(s)));
  // step 5a
  if (w.endsWith('e')) {
    const s = w.slice(0, -1);
    const m = measure(s);
    if (m > 1 || (m === 1 && !endsCvc(s))) w = s;
  }
  // step 5b
  if (measure(w) > 1 && endsDouble(w) && w.endsWith('l')) w = w.slice(0, -1);
  return w;
}

/**
 * One word's search form in a mode. Anything with a digit is left alone in every mode; so are words of three letters
 * or fewer in `s` and `light` (but for an irregular form, "won" → "win"), and of two letters in `porter` (as the
 * published algorithm does). A word that is not plain a to z is stemmed as in `s`.
 */
export function stem(t: string, mode: StemMode = 's'): string {
  if (mode === 's' || /\d/.test(t)) return stemS(t);
  const memo = MEMO[mode];
  const known = memo.get(t);
  if (known !== undefined) return known;
  const irr = IRREGULAR[t];
  const w = irr ?? t;
  const out = !/^[a-z]+$/.test(w) ? stemS(w) : mode === 'light' ? (irr || w.length <= 3 ? w : stemLight(w)) : (PORTER_KEEP[w] ?? porterStem(w));
  if (memo.size < MEMO_MAX) memo.set(t, out);
  return out;
}

/** Each word's stem, remembered per mode (a pack has about 9,000 distinct words; the cap bounds a long-lived page). */
const MEMO: Record<Exclude<StemMode, 's'>, Map<string, string>> = { light: new Map(), porter: new Map() };
const MEMO_MAX = 50_000;

/** The words of a string before stemming, in order (duplicates kept). Single letters and stop words are dropped. */
export function words(s: string): string[] {
  const out: string[] = [];
  for (const m of foldText(s).toLowerCase().matchAll(TOKEN)) {
    const t = m[0];
    if (STOP_WORDS.has(t)) continue;
    if (t.length === 1 && !/\d/.test(t)) continue;
    out.push(t);
  }
  return out;
}

/** Search tokens of a string, in order (duplicates kept). Single letters are dropped; single digits are kept. */
export function tokenize(s: string, mode: StemMode = 's'): string[] {
  return words(s).map((t) => stem(t, mode));
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
