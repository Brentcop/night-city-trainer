// Card mentions: finds card names in a piece of text (a log line, an option label, a coach reason, a guide), so the UI
// can let a player point at a name and see the card (src/ui/components/CardMention.tsx). Pure: the caller passes the
// cards, builds the index once and asks it about each string (answers are memoised per string).
//
// Rules:
// - Longest name first at each position, and whole names only: the characters on either side of a match must not be
//   letters or digits ("Padre's" matches Padre, "Padres" does not).
// - Every card's full name matches ("Goro Takemura: Vengeful Bodyguard", "Corpo Security"). The part before the colon
//   (the short form, "Satori", "Dying Night") matches only when exactly one card has that name and it is at least
//   MIN_SHORT characters long, so "Goro Takemura" (three cards) and the Legend "V" never match by themselves.
// - Capitals matter where the name has them: each word that starts with a capital in the name must start with one in
//   the text ("Take Control" is a card, "take control of the board" is not); the rest of the letters may differ in case.
// - Accents, curly quotes and backticks are folded ("Judy Alvarez", "Tyger’s Whisper" match), one character for one,
//   so the positions returned are positions in the original string.
// - `skip` strings (deck names, player names) are never read as cards: a match overlapping one is dropped.
// Engine labels need nothing special: "Play X (3 €$)", "Sell X for an Eddie", "X attacks Y", "X {Play}" all match X.

/** The fields of a card the matcher reads (CardDef has them all). */
export interface MentionCard {
  id: string;
  name: string;
  subname: string | null;
  displayName: string;
}

/** A card name found in a string: [start, end) in the original string, and the card's id. */
export interface Mention {
  start: number;
  end: number;
  id: string;
}

/** A string cut into plain text and card mentions, in order. */
export type MentionPart = string | { text: string; id: string };

interface Candidate {
  /** the name, folded (lower case, accents and quotes plain): compared with the folded text */
  folded: string;
  /** offsets in the name of word starts that must be capitals in the text */
  caps: number[];
  id: string;
}

export interface CardIndex {
  /** candidates by their first two folded characters, longest first */
  readonly buckets: ReadonlyMap<string, readonly Candidate[]>;
  /** every name the index answers to, for tests and diagnostics: name → card id */
  readonly names: ReadonlyMap<string, string>;
  /** memo: string → mentions (no skip applied) */
  readonly memo: Map<string, Mention[]>;
}

/** A short form shorter than this never matches (the Legend "V"). */
export const MIN_SHORT = 4;
/** How many strings the memo keeps before it starts over (a long session's log stays well inside). */
const MEMO_MAX = 5000;

const WORD = /[\p{L}\p{N}_]/u;
const isWordChar = (ch: string | undefined) => ch !== undefined && WORD.test(ch);

/** One character, folded: accents dropped, curly quotes and backticks as ', lower case. Always one UTF-16 unit for one. */
function foldChar(ch: string): string {
  if (ch === '’' || ch === '‘' || ch === '`' || ch === 'ʼ') return "'";
  const code = ch.charCodeAt(0);
  if (code < 128) return ch.toLowerCase();
  const base = ch.normalize('NFD')[0] ?? ch;
  const low = base.toLowerCase();
  return low.length === 1 ? low : ch;
}

/** A whole string folded character by character (same length as the input). */
export function foldText(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) out += foldChar(s[i]!);
  return out;
}

const isUpper = (ch: string) => ch !== ch.toLowerCase() && ch === ch.toUpperCase();

function candidate(name: string, id: string): Candidate {
  const caps: number[] = [];
  for (let i = 0; i < name.length; i++) {
    const ch = name[i]!;
    const start = i === 0 || !isWordChar(name[i - 1]);
    if (start && isUpper(ch)) caps.push(i);
  }
  return { folded: foldText(name), caps, id };
}

/** Build the index for a card list (once per page load; the UI loads it with the first text that needs it). */
export function buildCardIndex(cards: readonly MentionCard[]): CardIndex {
  const names = new Map<string, string>();
  for (const c of cards) names.set(c.displayName, c.id);
  // short forms: the name before the colon, when exactly one card has it, it is long enough and no card's full name
  const byShort = new Map<string, MentionCard[]>();
  for (const c of cards) if (c.subname) byShort.set(c.name, [...(byShort.get(c.name) ?? []), c]);
  const fullNames = new Set(cards.map((c) => foldText(c.displayName)));
  const plainNames = new Set(cards.filter((c) => !c.subname).map((c) => foldText(c.name)));
  for (const [short, list] of byShort) {
    if (list.length !== 1 || short.length < MIN_SHORT) continue;
    if (fullNames.has(foldText(short)) || plainNames.has(foldText(short))) continue;
    if (cards.some((c) => c.subname && c.name !== short && foldText(c.name) === foldText(short))) continue;
    names.set(short, list[0]!.id);
  }
  const buckets = new Map<string, Candidate[]>();
  for (const [name, id] of names) {
    const cand = candidate(name, id);
    const key = cand.folded.slice(0, 2);
    const list = buckets.get(key) ?? [];
    list.push(cand);
    buckets.set(key, list);
  }
  for (const list of buckets.values()) list.sort((a, b) => b.folded.length - a.folded.length);
  return { buckets, names, memo: new Map() };
}

function scan(index: CardIndex, text: string): Mention[] {
  const out: Mention[] = [];
  if (text.length < 2) return out;
  const ft = foldText(text);
  for (let i = 0; i < text.length - 1; i++) {
    if (i > 0 && isWordChar(text[i - 1])) continue;
    const list = index.buckets.get(ft.slice(i, i + 2));
    if (!list) continue;
    for (const c of list) {
      const end = i + c.folded.length;
      if (end > text.length || isWordChar(text[end])) continue;
      if (!ft.startsWith(c.folded, i)) continue;
      if (!c.caps.every((k) => isUpper(text[i + k]!))) continue;
      out.push({ start: i, end, id: c.id });
      i = end - 1;
      break;
    }
  }
  return out;
}

/** Ranges of `text` covered by any of the `skip` strings (exact, case-sensitive). */
function skipRanges(text: string, skip: readonly string[]): [number, number][] {
  const out: [number, number][] = [];
  for (const s of skip) {
    if (!s) continue;
    for (let at = text.indexOf(s); at >= 0; at = text.indexOf(s, at + s.length)) out.push([at, at + s.length]);
  }
  return out;
}

/** The card names in `text`, in order (memoised per string). A match overlapping a `skip` string is left out. */
export function findMentions(index: CardIndex, text: string, skip?: readonly string[]): Mention[] {
  let found = index.memo.get(text);
  if (!found) {
    found = scan(index, text);
    if (index.memo.size >= MEMO_MAX) index.memo.clear();
    index.memo.set(text, found);
  }
  if (!found.length || !skip?.length) return found;
  const ranges = skipRanges(text, skip);
  if (!ranges.length) return found;
  return found.filter((m) => !ranges.some(([a, b]) => m.start < b && a < m.end));
}

/** `text` cut into plain strings and mentions; a string with no card names comes back as [text]. */
export function splitMentions(index: CardIndex, text: string, skip?: readonly string[]): MentionPart[] {
  const ms = findMentions(index, text, skip);
  if (!ms.length) return [text];
  const out: MentionPart[] = [];
  let last = 0;
  for (const m of ms) {
    if (m.start > last) out.push(text.slice(last, m.start));
    out.push({ text: text.slice(m.start, m.end), id: m.id });
    last = m.end;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The strings among `names` that would otherwise read as a card (worth passing as `skip`); the rest cost nothing to drop. */
export function namesWithMentions(index: CardIndex, names: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const n of names) if (n && findMentions(index, n).length) out.add(n);
  return [...out];
}
