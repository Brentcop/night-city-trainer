// data/seasons/deck-impact.json: per-list card impact ("Δ when drawn", pooled over every season round robin) that the
// season breeder reads (scripts/breed-data.ts → src/ai/breeder.ts seedsOf). Keyed by list fingerprint
// (listFingerprint in src/engine/deck.ts), like every other card-impact table: a list keeps its numbers only while
// its cards are unchanged, and a renamed list keeps them.
//
// Until 2026-11-14 the file was a plain object keyed by deck name. `parseDeckImpact` refuses that old shape (it is never
// read as if its names were fingerprints); `migrateDeckImpact` re-keys it by matching each name to exactly one list,
// and keeps a name it cannot match apart, unread, instead of guessing a fingerprint
// (scripts/migrate-deck-impact.ts runs it). Pure: the scripts read and write the file.

export const DECK_IMPACT_KIND = 'nct-deck-impact';
export const DECK_IMPACT_SCHEMA = 1;

/** Σ (Δ when drawn × games the card was drawn) and Σ games drawn, for one card in one list. */
export interface CardAcc {
  s: number;
  n: number;
}
export interface DeckImpactEntry {
  /** the list's name when its numbers were recorded (presentation only; the key is the fingerprint) */
  name: string;
  cards: Record<string, CardAcc>;
  /**
   * 'name': migrated from the name-keyed file, so the fingerprint is the list that had this name on the migration
   * date. Games recorded under that name before an earlier change to the list (a forge adoption) are pooled in.
   */
  keyedFrom?: 'name';
}
export interface DeckImpactFile {
  kind: typeof DECK_IMPACT_KIND;
  schema: typeof DECK_IMPACT_SCHEMA;
  keyedBy: 'listFingerprint';
  lists: Record<string, DeckImpactEntry>;
  /** old name-keyed entries that matched no single list at migration: kept for the record, never read */
  unmatched?: Record<string, { cards: Record<string, CardAcc>; why: string }>;
}

/** A card statistic as the analysis reports carry it (src/analysis/analyze.ts CardStat). */
export interface ImpactCardStat {
  id: string;
  iwd: number;
  seenGames: number;
}

const FINGERPRINT_RE = /^[0-9a-f]{16}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isAcc = (x: unknown): x is CardAcc => isObj(x) && typeof x.s === 'number' && Number.isFinite(x.s) && typeof x.n === 'number' && Number.isFinite(x.n) && x.n >= 0;
const isCards = (x: unknown): x is Record<string, CardAcc> => isObj(x) && Object.values(x).every(isAcc);

export const emptyDeckImpact = (): DeckImpactFile => ({ kind: DECK_IMPACT_KIND, schema: DECK_IMPACT_SCHEMA, keyedBy: 'listFingerprint', lists: {} });

/** The old file: deck name → card id → {s, n}, with no `kind`. */
export function isLegacyDeckImpact(raw: unknown): raw is Record<string, Record<string, CardAcc>> {
  return isObj(raw) && !('kind' in raw) && Object.values(raw).every(isCards);
}

export const LEGACY_DECK_IMPACT = 'is the old file keyed by deck name; re-key it by list fingerprint with npx tsx scripts/migrate-deck-impact.ts --write';

/** Read the file (already JSON-parsed). The old name-keyed shape and anything malformed are refused with a reason. */
export function parseDeckImpact(raw: unknown): { file: DeckImpactFile; problem?: undefined } | { file?: undefined; problem: string } {
  if (isLegacyDeckImpact(raw)) return { problem: LEGACY_DECK_IMPACT };
  if (!isObj(raw) || raw.kind !== DECK_IMPACT_KIND) return { problem: `is not a deck-impact file (kind "${DECK_IMPACT_KIND}")` };
  if (raw.schema !== DECK_IMPACT_SCHEMA) return { problem: `has schema ${String(raw.schema)}; this code reads schema ${DECK_IMPACT_SCHEMA}` };
  if (raw.keyedBy !== 'listFingerprint') return { problem: `is keyed by ${String(raw.keyedBy)}, not listFingerprint` };
  if (!isObj(raw.lists)) return { problem: 'has no lists' };
  for (const [fp, e] of Object.entries(raw.lists)) {
    if (!FINGERPRINT_RE.test(fp)) return { problem: `has a key that is not a list fingerprint: "${fp}"` };
    if (!isObj(e) || typeof e.name !== 'string' || !isCards(e.cards)) return { problem: `list ${fp}: needs a name and cards of {s, n}` };
    if (e.keyedFrom !== undefined && e.keyedFrom !== 'name') return { problem: `list ${fp}: unknown keyedFrom "${String(e.keyedFrom)}"` };
  }
  if (raw.unmatched !== undefined && (!isObj(raw.unmatched) || !Object.values(raw.unmatched).every((u) => isObj(u) && isCards(u.cards) && typeof u.why === 'string')))
    return { problem: 'has a malformed unmatched section' };
  return { file: raw as unknown as DeckImpactFile };
}

export interface MigrationResult {
  file: DeckImpactFile;
  /** names re-keyed, with the fingerprint each got */
  matched: { name: string; fingerprint: string; file?: string }[];
  /** names kept apart under `unmatched`, with why */
  unmatched: { name: string; why: string }[];
}

/**
 * Re-key the old name-keyed file by list fingerprint. A name re-keys only when exactly one of `lists` has it and no
 * other old name already took that fingerprint; otherwise it goes to `unmatched` with the reason (never a guessed
 * fingerprint). Entries and cards keep their order and their numbers exactly.
 */
export function migrateDeckImpact(old: Record<string, Record<string, CardAcc>>, lists: readonly { name: string; fingerprint: string; file?: string }[]): MigrationResult {
  const file = emptyDeckImpact();
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
export function addCards(file: DeckImpactFile, fp: string, name: string, cards: readonly ImpactCardStat[]) {
  const e = (file.lists[fp] ??= { name, cards: {} });
  for (const c of cards) {
    if (typeof c.iwd !== 'number' || !Number.isFinite(c.iwd) || !c.seenGames) continue;
    const a = (e.cards[c.id] ??= { s: 0, n: 0 });
    a.s += c.iwd * c.seenGames;
    a.n += c.seenGames;
  }
}

/** Per list fingerprint, card id → mean Δ when drawn, for cards drawn in at least `min` games (the breeder's input). */
export function breederDeckImpact(file: DeckImpactFile, min: number): Record<string, Record<string, number>> {
  return Object.fromEntries(
    Object.entries(file.lists).map(([fp, e]) => [
      fp,
      Object.fromEntries(
        Object.entries(e.cards)
          .filter(([, v]) => v.n >= min)
          .map(([id, v]) => [id, v.s / v.n]),
      ),
    ]),
  );
}
