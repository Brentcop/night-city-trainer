// Made-up deck-builder links shared by the deck-import tests (tests/deck-import.test.ts, tests/import-links-cli.test.ts,
// tests/deck-import-ui.test.tsx): the owner's compact example, and a link by card id built from it.
import { buildDeck, decodeDeckBuilder, type RawDeck } from '../src/lib/deckImport';

/** The owner's example: a compact deck-builder link (no name). The saved-deck id in it is made up: the list is in `d=`, and the reader ignores the rest. */
export const OWNER_COMPACT =
  'https://cyberpunk-tcg-sim.online/deck-builder/?deck=saved-00000000-0000-4000-8000-000000000000&d=l.w1.w22.w5-a.d.3_w6.3_w7.3_wt.3_wu.1_wv.2_wx.1_w27.3_wp.3_w2s.2_we.3_w2t.3_w2e.1_w2m.3_wq.2_w2u.1_w2j.3_wm.s.1_wv.1_ww.1_w2m.3_wg.1_w2u';

/** A made-up deck-builder link by card id: the same list as the owner's example, with a sideboard and a name. */
export function byIdLink(name = 'Player One - Made Up Cup (1st)'): string {
  const d = buildDeck(fromLink(OWNER_COMPACT));
  const part = (ids: string[]) => {
    const m = new Map<string, number>();
    for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
    return [...m].map(([id, n]) => `cb-${id.replace(/_/g, '-')}:${n}`).join(',');
  };
  return `https://cyberpunk-tcg-sim.online/deck-builder/?deck=${part(d.deck.legends)},${part(d.deck.main)}&sideboard=${part(d.deck.sideboard)}&type=cyberpunk&name=${encodeURIComponent(name)}`;
}

export function fromLink(link: string): RawDeck {
  const r = decodeDeckBuilder(new URL(link));
  if ('why' in r) throw new Error(r.why);
  return r.deck;
}
