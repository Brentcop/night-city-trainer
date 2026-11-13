// The leak search shared by the online tests (tests/online.test.ts) and the multi-day packet tests
// (tests/multi-day-corr.test.ts): which card ids a seat may know at a position, and a check that a text sent to that
// seat names no card it may not see.
import { expect } from 'vitest';
import type { GameState, PlayerId } from '../src/engine/types';

/** Card ids a seat may legitimately know: visible cards, this turn's plays, delayed effects' programs. */
export function knownIds(st: GameState, seat: PlayerId): Set<string> {
  const out = new Set<string>();
  for (const c of Object.values(st.cards)) {
    const vis = c.zone === 'field' || c.zone === 'trash' || c.zone === 'removed' || c.zone === 'limbo' || (c.zone === 'hand' && c.owner === seat) || (c.zone === 'legends' && (c.faceUp || (c.controller === seat && c.known)));
    if (vis) out.add(c.defId);
  }
  for (const e of st.turnEvents ?? []) out.add(e.defId);
  for (const m of st.mods) if (m.kind === 'delayed') out.add(m.value.defId);
  return out;
}

/** The real uids of the cards `seat` may not see at this position. */
export function hiddenUids(st: GameState, seat: PlayerId): number[] {
  const rival = (1 - seat) as PlayerId;
  const hidden = [...st.players[0].deck, ...st.players[1].deck, ...st.players[rival].hand, ...st.players[0].eddies, ...st.players[1].eddies];
  for (const p of [0, 1] as PlayerId[]) for (const u of st.players[p].legends) if (!st.cards[u]!.faceUp && !(st.cards[u]!.controller === seat && st.cards[u]!.known)) hidden.push(u);
  return hidden;
}

/** No card `seat` may not see is named in `text` (unless the seat knows that card id from elsewhere). */
export function expectNoHiddenIds(st: GameState, seat: PlayerId, text: string, where: string) {
  const known = knownIds(st, seat);
  for (const u of hiddenUids(st, seat)) {
    const id = st.cards[u]!.defId;
    if (!known.has(id)) expect(text.includes(`"${id}"`), `hidden ${id} (uid ${u}) in ${where}`).toBe(false);
  }
}
