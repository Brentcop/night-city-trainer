// Web Worker: plays one game out for a spectator ("Watch", src/ui/components/watch/) per message, off the page's
// thread (a Hard game takes about half a second to a second and a half of computing on a desktop, more on a phone).
// Protocol: { id, source } → { id, game } | { id, refused } (the plain sentence) | { id, error }.
import { playWatchGame, WatchRefused, type WatchedGame } from '../lib/watchGame';
import type { WatchSource } from '../lib/watchMatch';

export interface WatchRequest {
  id: number;
  source: WatchSource;
}
export type WatchReply = { id: number; game: WatchedGame } | { id: number; refused: string } | { id: number; error: string };

const post = (m: WatchReply) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<WatchRequest>) => {
  const { id, source } = e.data;
  try {
    post({ id, game: await playWatchGame(source) });
  } catch (err) {
    if (err instanceof WatchRefused) post({ id, refused: err.message });
    else post({ id, error: String((err as Error)?.message ?? err) || 'the game failed' });
  }
};
