// data/seasons/deck-impact.json: per-list card impact ("Δ when drawn", summed over the season round robins) that the
// season breeder reads (scripts/breed-data.ts → src/ai/breeder.ts seedsOf). Keyed by list fingerprint
// (listFingerprint in src/engine/deck.ts), like every other card-impact table: a list keeps its numbers only while
// its cards are unchanged, and a renamed list keeps them.
//
// Schema 2 (2026-11-16) keeps the sums apart by simulator version and bot, like the pooled table beside it
// (src/lib/seasonImpact.ts): one entry per (simulator version, bot) pair with the seasons it came from, and the breeder
// reads one pair's entry, the same pair as the pooled table: the current one when it has numbers, else the closest, with
// a warning (src/lib/breederImpact.ts). Schema 1 pooled every season in one `lists` object;
// it is refused with a sentence naming scripts/migrate-season-impact.ts, which split the committed file exactly.
//
// Until 2026-11-14 the file was a plain object keyed by deck name. `parseDeckImpact` refuses that old shape too (it is
// never read as if its names were fingerprints); `migrateDeckImpact` re-keyed it into schema 1 by matching each name to
// exactly one list, and kept a name it could not match apart, unread, instead of guessing a fingerprint
// (scripts/migrate-deck-impact.ts runs it). Pure: the scripts read and write the file.
import { addStats, cardMeans, entriesProblem, entryHeaderProblem, impactKey, isCards, isObj, sameKey, SEASON_IMPACT_MIGRATION, seasonCounted, sourceWords, type CardAcc, type ImpactCardStat, type ImpactKey, type ImpactSource } from './seasonImpact';

export type { CardAcc, ImpactCardStat } from './seasonImpact';

export const DECK_IMPACT_KIND = 'nct-deck-impact';
export const DECK_IMPACT_SCHEMA = 2;

/** One list's card sums in one entry. */
export interface DeckImpactList {
  /** the list's name when its numbers were recorded (presentation only; the key is the fingerprint) */
  name: string;
  cards: Record<string, CardAcc>;
  /**
   * 'name': migrated from the name-keyed file, so the fingerprint is the list that had this name on the migration
   * date. Games recorded under that name before an earlier change to the list (a forge adoption) are pooled in.
   */
  keyedFrom?: 'name';
}
/** Old name-keyed entries that matched no single list at migration: kept for the record, never read. */
export type UnmatchedLists = Record<string, { cards: Record<string, CardAcc>; why: string }>;

/** The per-list sums of one simulator version and bot. */
export interface DeckImpactEntry extends ImpactKey {
  sources: ImpactSource[];
  lists: Record<string, DeckImpactList>;
  unmatched?: UnmatchedLists;
}
export interface DeckImpactFile {
  kind: typeof DECK_IMPACT_KIND;
  schema: typeof DECK_IMPACT_SCHEMA;
  keyedBy: 'listFingerprint';
  entries: DeckImpactEntry[];
}
/** Schema 1 (2026-11-14 to 2026-11-16): every season pooled in one `lists` object. Read only by the migrations. */
export interface DeckImpactFileV1 {
  kind: typeof DECK_IMPACT_KIND;
  schema: 1;
  keyedBy: 'listFingerprint';
  lists: Record<string, DeckImpactList>;
  unmatched?: UnmatchedLists;
}

export const FINGERPRINT_RE = /^[0-9a-f]{16}$/;

export const emptyDeckImpact = (): DeckImpactFile => ({ kind: DECK_IMPACT_KIND, schema: DECK_IMPACT_SCHEMA, keyedBy: 'listFingerprint', entries: [] });
export const emptyDeckImpactV1 = (): DeckImpactFileV1 => ({ kind: DECK_IMPACT_KIND, schema: 1, keyedBy: 'listFingerprint', lists: {} });

/** The old file: deck name → card id → {s, n}, with no `kind`. */
export function isLegacyDeckImpact(raw: unknown): raw is Record<string, Record<string, CardAcc>> {
  return isObj(raw) && !('kind' in raw) && Object.values(raw).every(isCards);
}

export const LEGACY_DECK_IMPACT = 'is the old file keyed by deck name; re-key it by list fingerprint with npx tsx scripts/migrate-deck-impact.ts --write';
export const V1_DECK_IMPACT = `is schema 1, with every season pooled whatever its simulator version or bot; split it by simulator version and bot with ${SEASON_IMPACT_MIGRATION} (see its header)`;

/** Why a lists object is malformed, or null. */
function listsProblem(lists: unknown, what: string): string | null {
  if (!isObj(lists)) return `${what}has no lists`;
  for (const [fp, e] of Object.entries(lists)) {
    if (!FINGERPRINT_RE.test(fp)) return `${what}has a key that is not a list fingerprint: "${fp}"`;
    if (!isObj(e) || typeof e.name !== 'string' || !isCards(e.cards)) return `${what}list ${fp}: needs a name and cards of {s, n}`;
    if (e.keyedFrom !== undefined && e.keyedFrom !== 'name') return `${what}list ${fp}: unknown keyedFrom "${String(e.keyedFrom)}"`;
  }
  return null;
}
const unmatchedOk = (u: unknown) => u === undefined || (isObj(u) && Object.values(u).every((x) => isObj(x) && isCards(x.cards) && typeof x.why === 'string'));

/** Read the file (already JSON-parsed). Schema 1, the old name-keyed shape and anything malformed are refused with a reason. */
export function parseDeckImpact(raw: unknown): { file: DeckImpactFile; problem?: undefined } | { file?: undefined; problem: string } {
  if (isLegacyDeckImpact(raw)) return { problem: LEGACY_DECK_IMPACT };
  if (!isObj(raw) || raw.kind !== DECK_IMPACT_KIND) return { problem: `is not a deck-impact file (kind "${DECK_IMPACT_KIND}")` };
  if (raw.schema === 1) return { problem: V1_DECK_IMPACT };
  if (raw.schema !== DECK_IMPACT_SCHEMA) return { problem: `has schema ${String(raw.schema)}; this code reads schema ${DECK_IMPACT_SCHEMA}` };
  if (raw.keyedBy !== 'listFingerprint') return { problem: `is keyed by ${String(raw.keyedBy)}, not listFingerprint` };
  if (!Array.isArray(raw.entries)) return { problem: 'has no entries' };
  for (const [i, e] of (raw.entries as unknown[]).entries()) {
    if (!isObj(e)) return { problem: `entry ${i + 1} is not an object` };
    const p = entryHeaderProblem(e, `entry ${i + 1}`) ?? listsProblem(e.lists, `entry ${i + 1}: `);
    if (p) return { problem: p };
    if (!unmatchedOk(e.unmatched)) return { problem: `entry ${i + 1}: has a malformed unmatched section` };
  }
  const file = raw as unknown as DeckImpactFile;
  const p = entriesProblem(file.entries);
  if (p) return { problem: p };
  return { file };
}

/** Read a schema 1 file (the migrations' input only); anything else is refused. */
export function parseDeckImpactV1(raw: unknown): { file: DeckImpactFileV1; problem?: undefined } | { file?: undefined; problem: string } {
  if (isLegacyDeckImpact(raw)) return { problem: LEGACY_DECK_IMPACT };
  if (!isObj(raw) || raw.kind !== DECK_IMPACT_KIND) return { problem: `is not a deck-impact file (kind "${DECK_IMPACT_KIND}")` };
  if (raw.schema !== 1) return { problem: `has schema ${String(raw.schema)}, not schema 1` };
  if (raw.keyedBy !== 'listFingerprint') return { problem: `is keyed by ${String(raw.keyedBy)}, not listFingerprint` };
  const p = listsProblem(raw.lists, '');
  if (p) return { problem: p };
  if (!unmatchedOk(raw.unmatched)) return { problem: 'has a malformed unmatched section' };
  return { file: raw as unknown as DeckImpactFileV1 };
}

export interface MigrationResult {
  file: DeckImpactFileV1;
  /** names re-keyed, with the fingerprint each got */
  matched: { name: string; fingerprint: string; file?: string }[];
  /** names kept apart under `unmatched`, with why */
  unmatched: { name: string; why: string }[];
}

/**
 * Re-key the old name-keyed file by list fingerprint (into schema 1, the shape of 2026-11-14). A name re-keys only when
 * exactly one of `lists` has it and no other old name already took that fingerprint; otherwise it goes to `unmatched`
 * with the reason (never a guessed fingerprint). Entries and cards keep their order and their numbers exactly.
 */
export function migrateDeckImpact(old: Record<string, Record<string, CardAcc>>, lists: readonly { name: string; fingerprint: string; file?: string }[]): MigrationResult {
  const file = emptyDeckImpactV1();
  const matched: MigrationResult['matched'] = [];
  const unmatched: MigrationResult['unmatched'] = [];
  const keep = (name: string, cards: Record<string, CardAcc>, why: string) => {
    (file.unmatched ??= {})[name] = { cards, why };
    unmatched.push({ name, why });
  };
  for (const [name, cards] of Object.entries(old)) {
    const fps = [...new Set(lists.filter((l) => l.name === name).map((l) => l.fingerprint))];
    const fp = fps[0];
    if (fp === undefined) keep(name, cards, 'no current library list has this name');
    else if (fps.length > 1) keep(name, cards, `${fps.length} different library lists have this name`);
    else if (file.lists[fp]) keep(name, cards, `its list is the same as "${file.lists[fp].name}", already keyed`);
    else {
      file.lists[fp] = { name, cards, keyedFrom: 'name' };
      const l = lists.find((x) => x.fingerprint === fp && x.name === name);
      matched.push({ name, fingerprint: fp, ...(l?.file ? { file: l.file } : {}) });
    }
  }
  return { file, matched, unmatched };
}

/** Add one report's card numbers to the list with fingerprint `fp` (created under `name` when new). */
export function addCards(lists: Record<string, DeckImpactList>, fp: string, name: string, cards: readonly ImpactCardStat[]) {
  addStats((lists[fp] ??= { name, cards: {} }).cards, cards);
}

/** The entry for `key` (created, at the end, when the file has none). */
export function deckEntry(file: DeckImpactFile, key: ImpactKey): DeckImpactEntry {
  const k = impactKey(key.simVersion, key.bot);
  let e = file.entries.find((x) => sameKey(x, k));
  if (!e) file.entries.push((e = { ...k, sources: [], lists: {} }));
  return e;
}

/**
 * Add one run's reports to the entry for `key`, each under the list fingerprint `fingerprintOf` gives its deck, and
 * record the source. A report whose list is unknown is not recorded (its deck name is returned). Throws when the source
 * is already counted.
 */
export function addToDeckImpact(file: DeckImpactFile, key: ImpactKey, source: ImpactSource, reports: readonly { deck: string; cards: readonly ImpactCardStat[] }[], fingerprintOf: (deckName: string) => string | undefined): string[] {
  if (seasonCounted(file.entries, source)) throw new Error(`data/seasons/deck-impact.json already counts ${sourceWords(source)}`);
  const e = deckEntry(file, key);
  e.sources.push(source);
  const skipped: string[] = [];
  for (const r of reports) {
    const fp = fingerprintOf(r.deck);
    if (fp) addCards(e.lists, fp, r.deck, r.cards);
    else skipped.push(r.deck);
  }
  return skipped;
}

/** Per list fingerprint, card id → mean Δ when drawn, for cards drawn in at least `min` games (the breeder's input). */
export function breederDeckImpact(lists: Readonly<Record<string, DeckImpactList>>, min: number): Record<string, Record<string, number>> {
  return Object.fromEntries(Object.entries(lists).map(([fp, e]) => [fp, cardMeans(e.cards, min)]));
}
