// Knowledge pack (docs/RAG_PLAN.md §6): the record model, ids, link types and the content hash. Pure: no DOM, no
// `node:` imports, so the site and the command line share it. Nothing under src/engine, src/ai or src/sim imports
// src/lib/kb (rule M10, tests/kb-guards.test.ts).

/** Record kinds. `faq`, `rule`, `trule` (tournament rules) and `errata` come from data/raw and are always `local`. */
export const KB_KINDS = ['card', 'ruling', 'faq', 'rule', 'trule', 'errata', 'deck', 'objective', 'package', 'term', 'guide', 'doc', 'code'] as const;
export type KbKind = (typeof KB_KINDS)[number];

/** The id prefix of each kind: ids are '<prefix>:<stable key>'. */
export const KIND_PREFIX: Readonly<Record<KbKind, string>> = {
  card: 'card',
  ruling: 'ruling',
  faq: 'faq',
  rule: 'rule',
  trule: 'trule',
  errata: 'errata',
  deck: 'deck',
  objective: 'objective',
  package: 'pkg',
  term: 'term',
  guide: 'guide',
  doc: 'doc',
  code: 'code',
};

/** Link types. A link is stored once, on the record that names the other; the index adds the reverse direction. */
export const KB_RELS = ['card', 'deck', 'package', 'ruling', 'rule', 'objective', 'guide', 'term', 'official', 'test', 'parent', 'mentions'] as const;
export type KbRel = (typeof KB_RELS)[number];

export type KbOrigin = 'authored' | 'imported' | 'generated' | 'measured' | 'official';
export type KbScope = 'public' | 'local';
export type KbFieldValue = string | number | boolean | null;

export interface KbLink {
  rel: KbRel;
  to: string;
}

export interface KbStamps {
  simVersion?: number;
  bot?: string;
  rulesVersion?: string | null;
  faqVersion?: string | null;
  listId?: string;
  cardDataVersion?: string;
  asOf?: string;
}

export interface KbRecord {
  /** '<kind prefix>:<stable key>' */
  id: string;
  kind: KbKind;
  /** the name people use; boosted in search */
  title: string;
  aliases?: string[];
  /** self-contained: the first sentence says what the thing is */
  text: string;
  /** flat facts for exact answers */
  fields?: Record<string, KbFieldValue>;
  links: KbLink[];
  /** path (forward slashes, from the repository root) and a line range or JSON pointer */
  source: { file: string; at?: string };
  origin: KbOrigin;
  scope: KbScope;
  /** drafts and owner-confirmed notes (deck notes, packages) */
  status?: 'draft' | 'owner';
  stamps?: KbStamps;
  /** hashText over id, title, aliases, text, fields, links and stamps */
  hash: string;
}

/** The local pack's manifest (.cache/kb/manifest.json). */
export interface KbManifest {
  kind: 'nct-kb';
  schema: 1;
  /** bumped when the builders change what they make from the same inputs */
  builder: number;
  records: number;
  counts: Record<string, number>;
  scopes: { public: number; local: number };
  /** whether data/raw was read (local records present) */
  local: boolean;
  rulesVersion: string | null;
  faqVersion: string | null;
  cardDataVersion: string;
  /** input file (forward slashes) → content hash */
  inputs: Record<string, string>;
  report: KbBuildReport;
}

/** What a build could not link: counted, never guessed. */
export interface KbBuildReport {
  /** card names found in prose and linked */
  mentions: number;
  /** names shared by several cards, resolved because exactly one of them is in the deck the text is about */
  resolvedByDeck: number;
  /** names shared by several cards and left unlinked */
  ambiguous: number;
  /** the ambiguous names and how often each was seen */
  ambiguousNames: Record<string, number>;
  /** links whose target is not in the pack (dropped); a public build must have none */
  dangling: string[];
  /** inputs skipped, with the reason, e.g. "code: no header comment" */
  skipped: Record<string, number>;
}

export const kindOfId = (id: string): KbKind | undefined => {
  const p = id.slice(0, id.indexOf(':'));
  return KB_KINDS.find((k) => KIND_PREFIX[k] === p);
};

/** A rough token count: characters divided by 4. */
export const estimateTokens = (s: string): number => Math.ceil(s.length / 4);

/**
 * 64-bit FNV-1a over UTF-16 code units: the same value as `fingerprintText` in src/engine/deck.ts (checked in
 * tests/kb-core.test.ts), on 16-bit limbs so that hashing the whole pack stays fast and this module imports nothing.
 */
export function hashText(value: string): string {
  let h0 = 0x2325, h1 = 0x8422, h2 = 0x9ce4, h3 = 0xcbf2;
  for (let i = 0; i < value.length; i++) {
    h0 ^= value.charCodeAt(i);
    // multiply by the FNV prime 0x100000001b3 (limbs 0x01b3, 0, 0x0100, 0), keeping the low 64 bits
    const t0 = h0 * 0x1b3;
    const t1 = h1 * 0x1b3 + (t0 >>> 16);
    const t2 = h2 * 0x1b3 + h0 * 0x100 + (t1 >>> 16);
    const t3 = h3 * 0x1b3 + h1 * 0x100 + (t2 >>> 16);
    h0 = t0 & 0xffff;
    h1 = t1 & 0xffff;
    h2 = t2 & 0xffff;
    h3 = t3 & 0xffff;
  }
  const hex = (n: number) => n.toString(16).padStart(4, '0');
  return hex(h3) + hex(h2) + hex(h1) + hex(h0);
}

/** The content hash of a record (everything that says what it is, not where it was read from). */
export function recordHash(r: Pick<KbRecord, 'id' | 'title' | 'aliases' | 'text' | 'fields' | 'links' | 'stamps'>): string {
  return hashText(JSON.stringify([r.id, r.title, r.aliases ?? [], r.text, r.fields ?? {}, r.links, r.stamps ?? {}]));
}

/** Plain code-unit order: the same on every machine and locale. */
export const byString = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
