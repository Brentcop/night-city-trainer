// Statistical card knowledge for the coach: how much each card swings games, per deck and format-wide,
// from bot-match telemetry ("Δ when drawn" = IWD). Reads src/data/impact.json, the slim id/IWD/seenGames copy of
// src/data/analysis.json that is written alongside it (see src/analysis/impactData.ts).
// Per-deck numbers belong to the list they were measured on: a deck is matched by its list fingerprint (PlayerState.listId),
// never by name alone (findImpactDeck; legacy name-only entries via LEGACY_IMPACT_LISTS).
import impact from '../data/impact.json';
import { findImpactDeck, type ImpactData, type ImpactDeck, type ImpactDeckRef } from '../analysis/impactData';
import { LEGACY_IMPACT_LISTS } from '../analysis/legacyImpactLists';

const A = impact as unknown as ImpactData;
const MIN_SEEN = 30; // per-deck estimate needs this many games where the card was drawn

const perDeck = new Map<ImpactDeck, Map<string, number>>();
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
  perDeck.set(r, m);
}
const GLOBAL = new Map(Object.entries(pooled).filter(([, v]) => v.n >= 60).map(([k, v]) => [k, v.s / v.n]));

/** Lookups are on the bots' hot path: remember each (list, name) → entry answer. */
const resolved = new Map<string, ImpactDeck | null>();
function entryFor(ref: ImpactDeckRef): ImpactDeck | null {
  if (!ref.listId) return null;
  const key = `${ref.listId}\u0000${ref.name}`;
  let e = resolved.get(key);
  if (e === undefined) resolved.set(key, (e = findImpactDeck(A.decks, ref, LEGACY_IMPACT_LISTS) ?? null));
  return e;
}

/** Name of the analysed deck report that describes this deck's list (for analysis.json lookups), or null. */
export function impactDeckName(ref: ImpactDeckRef): string | null {
  return entryFor(ref)?.deck ?? null;
}

/**
 * Impact of a card for a given deck (win-rate points as a fraction, e.g. 0.08 = +8 pts when drawn).
 * Uses the telemetry measured on the deck's own list when there is enough of it, otherwise a shrunk format-wide estimate.
 * `deck` is the player (PlayerState: name + listId).
 */
export function cardImpact(deck: ImpactDeckRef, cardId: string): number {
  const e = entryFor(deck);
  const d = e ? perDeck.get(e)!.get(cardId) : undefined;
  if (d !== undefined) return d;
  return 0.5 * (GLOBAL.get(cardId) ?? 0);
}

/** The deck's top cards by impact (for coach tips). */
export function topImpactCards(deck: ImpactDeckRef, n = 3): { id: string; iwd: number }[] {
  const e = entryFor(deck);
  if (!e) return [];
  return [...perDeck.get(e)!.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, iwd]) => ({ id, iwd }));
}
