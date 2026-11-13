// What a card mention needs once it is on screen: the name index (src/lib/cardMentions.ts), the cards by id and the hover
// preview. Loaded with the first text that can name a card (CardMention.tsx's loadMentionRuntime), never with the entry
// chunk's first paint; until then that text is plain.
import { CARD_BY_ID, CARDS } from '../../engine/cards';
import type { CardDef } from '../../engine/types';
import { buildCardIndex, namesWithMentions, splitMentions, type MentionPart } from '../../lib/cardMentions';
import { allDecks } from '../../lib/browserLibrary';
import { CardZoom } from './TcgCard';

export const INDEX = buildCardIndex(CARDS);
export const cardById = (id: string): CardDef | undefined => CARD_BY_ID[id];
export { CardZoom as Preview };

/** Deck names that would read as a card in prose ("Padre Control"): never linked. A deck named exactly as a card is left out (the card wins). */
let lib: ReturnType<typeof allDecks> | null = null;
let libSkips: string[] = [];
function deckSkips(): string[] {
  let l: ReturnType<typeof allDecks>;
  try {
    l = allDecks();
  } catch {
    return libSkips;
  }
  if (l !== lib) {
    lib = l;
    libSkips = namesWithMentions(
      INDEX,
      l.map((d) => d.deck.name),
    ).filter((n) => !INDEX.names.has(n));
  }
  return libSkips;
}

/** `text` cut into plain strings and card mentions, never inside a library deck name or one of `skip` (player names). */
export function split(text: string, skip?: readonly string[]): MentionPart[] {
  const base = deckSkips();
  return splitMentions(INDEX, text, skip?.length ? [...base, ...skip] : base);
}
