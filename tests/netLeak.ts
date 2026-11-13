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

// ---------------------------------------------------------------- network addresses

/** The placeholders a cleaned session description uses (no one's address). */
const PLACEHOLDERS = new Set(['0.0.0.0', '127.0.0.1', '::']);
const V4 = /(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])/g;
// 2 to 7 colons between hex groups, not inside a longer colon run (a DTLS fingerprint has 31 colons)
const V6 = /(?<![\w:])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?![\w:])/gi;
const MDNS = /[0-9a-z-]+\.local\b/gi;

/** Every IPv4 / IPv6 address (and, with `mdns`, every `.local` name) in a text. */
export function addressesIn(text: string, mdns = false): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(V4)) if (m.slice(1, 5).every((x) => Number(x) <= 255) && !PLACEHOLDERS.has(m[0])) out.push(m[0]);
  for (const m of text.matchAll(V6)) if (!PLACEHOLDERS.has(m[0]) && (m[0].match(/:/g) ?? []).length >= 2 && /[0-9a-f]/i.test(m[0])) out.push(m[0].toLowerCase());
  if (mdns) for (const m of text.matchAll(MDNS)) out.push(m[0]);
  return out;
}

/**
 * No network address in `text` except the ones `allowed` (the public address a direct connection needs, say). Random
 * `.local` names stand in for addresses and reveal none, so they are allowed unless `mdns` is false.
 */
export function expectNoAddresses(text: string, where: string, allowed: readonly string[] = [], o: { mdns?: boolean } = {}) {
  const ok = new Set(allowed.map((a) => a.toLowerCase()));
  const found = addressesIn(text, o.mdns === false).filter((a) => !ok.has(a));
  expect(found, `addresses in ${where}`).toEqual([]);
}

/** No card `seat` may not see is named in `text` (unless the seat knows that card id from elsewhere). */
export function expectNoHiddenIds(st: GameState, seat: PlayerId, text: string, where: string) {
  const known = knownIds(st, seat);
  for (const u of hiddenUids(st, seat)) {
    const id = st.cards[u]!.defId;
    if (!known.has(id)) expect(text.includes(`"${id}"`), `hidden ${id} (uid ${u}) in ${where}`).toBe(false);
  }
}
