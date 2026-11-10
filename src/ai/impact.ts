// Statistical card knowledge for the coach: how much each card swings games, per deck and format-wide,
// from bot-match telemetry (src/data/analysis.json, "Δ when drawn" = IWD).
import analysis from '../data/analysis.json';
import type { DeckReport } from '../analysis/analyze';

const A = analysis as unknown as { decks: DeckReport[] };
const MIN_SEEN = 30; // per-deck estimate needs this many games where the card was drawn

const perDeck = new Map<string, Map<string, number>>();
const pooled: Record<string, { s: number; n: number }> = {};
for (const r of A.decks) {
  const m = new Map<string, number>();
  for (const c of r.cards) {
    if (typeof c.iwd !== 'number' || !Number.isFinite(c.iwd)) continue;
    if (c.seenGames >= MIN_SEEN) m.set(c.id, c.iwd);
    pooled[c.id] ??= { s: 0, n: 0 };
    pooled[c.id].s += c.iwd * c.seenGames;
    pooled[c.id].n += c.seenGames;
  }
  perDeck.set(r.deck, m);
}
const GLOBAL = new Map(Object.entries(pooled).filter(([, v]) => v.n >= 60).map(([k, v]) => [k, v.s / v.n]));

/**
 * Impact of a card for a given deck (win-rate points as a fraction, e.g. 0.08 = +8 pts when drawn).
 * Uses the deck's own telemetry when there is enough of it, otherwise a shrunk format-wide estimate.
 */
export function cardImpact(deckName: string, cardId: string): number {
  const d = perDeck.get(deckName)?.get(cardId);
  if (d !== undefined) return d;
  return 0.5 * (GLOBAL.get(cardId) ?? 0);
}

/** The deck's top cards by impact (for coach tips). */
export function topImpactCards(deckName: string, n = 3): { id: string; iwd: number }[] {
  const m = perDeck.get(deckName);
  if (!m) return [];
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, iwd]) => ({ id, iwd }));
}

export function hasDeckTelemetry(deckName: string) {
  return (perDeck.get(deckName)?.size ?? 0) > 0;
}
