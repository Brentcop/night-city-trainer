// Knowledge pack builders: card names in prose become `mentions` links, found with the card-mention matcher
// (src/lib/cardMentions.ts: full names, and short forms only when one card has them). A short form that several cards
// share ("Goro Takemura") is never guessed: it is counted in the build report, unless the text is about one deck and
// exactly one of those cards is in that deck's list, which then resolves it.
import { buildCardIndex, findMentions, MIN_SHORT, type CardIndex, type MentionCard } from '../../cardMentions';
import { byString } from '../types';

export interface MentionReport {
  mentions: number;
  resolvedByDeck: number;
  ambiguous: number;
  ambiguousNames: Record<string, number>;
}

export interface MentionLinker {
  /** Card ids named in `text`, in order of first appearance. `deckCards`: the list the text is about, if any. */
  cardsIn(text: string, deckCards?: readonly string[]): string[];
  report(): MentionReport;
}

export function mentionLinker(cards: readonly MentionCard[]): MentionLinker {
  const index = buildCardIndex(cards);
  const byShort = new Map<string, string[]>();
  for (const c of cards) if (c.subname) byShort.set(c.name, [...(byShort.get(c.name) ?? []), c.id]);
  const plain = new Set(cards.filter((c) => !c.subname).map((c) => c.name));
  // names several cards share, long enough to be read as a name (the Legend "V" is not)
  const shared = [...byShort].filter(([n, ids]) => ids.length > 1 && n.length >= MIN_SHORT && !plain.has(n)).map(([n]) => n).sort(byString);
  const sharedIndex: CardIndex = buildCardIndex(shared.map((n) => ({ id: n, name: n, subname: null, displayName: n })));
  const rep: MentionReport = { mentions: 0, resolvedByDeck: 0, ambiguous: 0, ambiguousNames: {} };
  return {
    cardsIn(text, deckCards) {
      const found = findMentions(index, text);
      const hits: { at: number; id: string }[] = found.map((m) => ({ at: m.start, id: m.id }));
      rep.mentions += found.length;
      for (const s of findMentions(sharedIndex, text)) {
        if (found.some((m) => m.start < s.end && s.start < m.end)) continue;
        const inDeck = deckCards ? (byShort.get(s.id) ?? []).filter((id) => deckCards.includes(id)) : [];
        if (inDeck.length === 1) {
          rep.resolvedByDeck++;
          hits.push({ at: s.start, id: inDeck[0]! });
        } else {
          rep.ambiguous++;
          rep.ambiguousNames[s.id] = (rep.ambiguousNames[s.id] ?? 0) + 1;
        }
      }
      return [...new Set(hits.sort((a, b) => a.at - b.at).map((h) => h.id))];
    },
    report: () => ({ ...rep, ambiguousNames: Object.fromEntries(Object.entries(rep.ambiguousNames).sort(([a], [b]) => byString(a, b))) }),
  };
}
