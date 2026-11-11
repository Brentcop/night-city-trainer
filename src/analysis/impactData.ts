// Slim copy of the per-card impact numbers in src/data/analysis.json, for the bots (src/ai/impact.ts) and the
// Deck Lab. analysis.json is ~330 KB; they only need, per deck report, each card's id, IWD and seenGames.
// `npm run sim -- analyze` writes both files together so they cannot drift (tests/impact.test.ts checks it).
//
// Impact is measured on one list, so it is looked up by list fingerprint (listFingerprint in src/engine/deck.ts), not by
// deck name (backlog AI-11): a renamed list keeps its numbers, and another list that reuses the name gets none.

/** One card: [id, iwd ("Δ when drawn"; null when the report has none), seenGames]. */
export type ImpactCard = [id: string, iwd: number | null, seenGames: number];
export interface ImpactDeck {
  deck: string;
  /** listFingerprint of the list measured; absent in data written before fingerprints (legacy, see findImpactDeck) */
  id?: string;
  cards: ImpactCard[];
}
export interface ImpactData {
  decks: ImpactDeck[];
}

/** Build impact.json from analysis.json's deck reports, keeping deck and card order (and each report's list id). */
export function toImpactData(
  decks: readonly { deck: string; id?: string; cards: readonly { id: string; iwd?: number | null; seenGames: number }[] }[],
): ImpactData {
  return { decks: decks.map((r) => ({ deck: r.deck, ...(r.id ? { id: r.id } : {}), cards: r.cards.map((c): ImpactCard => [c.id, c.iwd ?? null, c.seenGames]) })) };
}

/** The deck asking for impact numbers: its name and the listFingerprint of the list it plays. */
export interface ImpactDeckRef {
  name: string;
  listId?: string;
}

/**
 * The impact entry measured on this deck's list, or undefined:
 *   1. the entry whose fingerprint is the deck's list fingerprint (whatever either is called);
 *   2. legacy data only: an entry without a fingerprint, with the deck's name, and only when the deck is the built-in
 *      library deck of that name — its list is the one `legacyLists` pins to that name. A custom deck that reuses a
 *      built-in name has another list, so it never inherits that deck's numbers.
 * A deck with no list id (a state built by hand) matches nothing.
 */
export function findImpactDeck<T extends { deck: string; id?: string }>(decks: readonly T[], ref: ImpactDeckRef, legacyLists: Readonly<Record<string, string>>): T | undefined {
  if (!ref.listId) return undefined;
  const hit = decks.find((d) => d.id === ref.listId);
  if (hit) return hit;
  if (!Object.hasOwn(legacyLists, ref.name) || legacyLists[ref.name] !== ref.listId) return undefined;
  return decks.find((d) => d.id === undefined && d.deck === ref.name);
}
