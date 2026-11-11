// A deck's list as structure: Legends, then each main-deck type by cost, then the sideboard. Shared by the deck profile,
// the deck editor, the Deck Lab and the tournament views (each shows card images for these groups). Pure: no React.
import { CARD_BY_ID, CARDS, cardLabel } from '../engine/cards';
import { counts } from '../engine/deck';
import type { CardDef, DeckList } from '../engine/types';

export interface CardEntry {
  id: string;
  n: number;
}
export interface CardGroup {
  key: 'legends' | 'Unit' | 'Gear' | 'Program' | 'sideboard';
  label: string;
  /** copies in the group */
  total: number;
  cards: CardEntry[];
}

const GROUP_LABEL: Record<CardGroup['key'], string> = { legends: 'Legends', Unit: 'Units', Gear: 'Gear', Program: 'Programs', sideboard: 'Sideboard' };

/** Cheapest first, then by name (unknown ids are dropped). */
export function byCost(entries: CardEntry[], byId: Record<string, CardDef> = CARD_BY_ID): CardEntry[] {
  return entries
    .flatMap((e) => {
      const c = byId[e.id];
      return c ? [{ e, c }] : [];
    })
    .sort((a, b) => (a.c.cost ?? 0) - (b.c.cost ?? 0) || cardLabel(a.c).localeCompare(cardLabel(b.c)))
    .map(({ e }) => e);
}

/**
 * The list grouped for display: Legends (in deck order), Units, Gear, Programs (each by cost, then name) and the
 * sideboard. Empty groups are left out, except Legends, so a list still being built shows where they go.
 */
export function groupDeck(deck: Pick<DeckList, 'legends' | 'main'> & { sideboard?: string[] }, byId: Record<string, CardDef> = CARD_BY_ID): CardGroup[] {
  const main = [...counts(deck.main).entries()].map(([id, n]) => ({ id, n }));
  const legends = deck.legends.filter((id) => byId[id]).map((id) => ({ id, n: 1 }));
  const out: CardGroup[] = [{ key: 'legends', label: GROUP_LABEL.legends, total: legends.length, cards: legends }];
  for (const t of ['Unit', 'Gear', 'Program'] as const) {
    const cards = byCost(
      main.filter((e) => byId[e.id]?.type === t),
      byId,
    );
    if (cards.length) out.push({ key: t, label: GROUP_LABEL[t], total: cards.reduce((a, e) => a + e.n, 0), cards });
  }
  const side = byCost(
    [...counts(deck.sideboard ?? []).entries()].map(([id, n]) => ({ id, n })),
    byId,
  );
  if (side.length) out.push({ key: 'sideboard', label: GROUP_LABEL.sideboard, total: side.reduce((a, e) => a + e.n, 0), cards: side });
  return out;
}

/** Main-deck changes from `a` to `b`: copies added (d > 0) or cut (d < 0), cuts first, each by cost. */
export function deckDiff(a: Pick<DeckList, 'main'>, b: Pick<DeckList, 'main'>): { id: string; d: number }[] {
  const A = counts(a.main);
  const B = counts(b.main);
  const out: { id: string; d: number }[] = [];
  for (const id of new Set([...A.keys(), ...B.keys()])) {
    const d = (B.get(id) ?? 0) - (A.get(id) ?? 0);
    if (d) out.push({ id, d });
  }
  const order = new Map(byCost(out.map((x) => ({ id: x.id, n: 0 }))).map((e, i) => [e.id, i]));
  return out.sort((x, y) => Math.sign(x.d) - Math.sign(y.d) || (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));
}

let byLabel: Map<string, string> | null = null;
/**
 * The cards in a Deck Lab swap label ("−1 Card A → +1 Card B", written by candidateSwaps in src/lib/deckLab.ts).
 * Either side is undefined when the label doesn't name a known card.
 */
export function parseSwap(label: string): { out?: string; in?: string } {
  byLabel ??= new Map(CARDS.map((c) => [cardLabel(c), c.id]));
  const [, cut, add] = label.match(/^[−-]1 (.+) → \+1 (.+)$/) ?? [];
  if (cut === undefined || add === undefined) return {};
  return { out: byLabel.get(cut), in: byLabel.get(add) };
}
