// Statistical card knowledge for the coach: how much each card swings games, per deck and format-wide,
// from bot-match telemetry ("Δ when drawn" = IWD). Reads src/data/impact.json, the slim id/IWD/seenGames copy of
// src/data/analysis.json that is written alongside it (see src/analysis/impactData.ts).
import impact from '../data/impact.json';
import type { ImpactData } from '../analysis/impactData';

const A = impact as unknown as ImpactData;
const MIN_SEEN = 30; // per-deck estimate needs this many games where the card was drawn

const perDeck = new Map<string, Map<string, number>>();
const pooled: Record<string, { s: number; n: number }> = {};
for (const r of A.decks) {
  const m = new Map<string, number>();
  for (const [id, iwd, seenGames] of r.cards) {
    if (typeof iwd !== 'number' || !Number.isFinite(iwd)) continue;
    if (seenGames >= MIN_SEEN) m.set(id, iwd);
    pooled[id] ??= { s: 0, n: 0 };
    pooled[id].s += iwd * seenGames;
    pooled[id].n += seenGames;
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
