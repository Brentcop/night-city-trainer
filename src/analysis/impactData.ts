// Slim copy of the per-card impact numbers in src/data/analysis.json, for the bots (src/ai/impact.ts) and the
// Deck Lab. analysis.json is ~330 KB; they only need, per deck report, each card's id, IWD and seenGames.
// `npm run sim -- analyze` writes both files together so they cannot drift (tests/impact.test.ts checks it).

/** One card: [id, iwd ("Δ when drawn"; null when the report has none), seenGames]. */
export type ImpactCard = [id: string, iwd: number | null, seenGames: number];
export interface ImpactData {
  decks: { deck: string; cards: ImpactCard[] }[];
}

/** Build impact.json from analysis.json's deck reports, keeping deck and card order. */
export function toImpactData(
  decks: readonly { deck: string; cards: readonly { id: string; iwd?: number | null; seenGames: number }[] }[],
): ImpactData {
  return { decks: decks.map((r) => ({ deck: r.deck, cards: r.cards.map((c): ImpactCard => [c.id, c.iwd ?? null, c.seenGames]) })) };
}
