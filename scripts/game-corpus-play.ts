// The game corpus (data/benchmark/game-corpus.json): its format, the games it plays and how one is replayed. Shared by
// scripts/game-corpus.ts, which builds the file, and tests/game-corpus.test.ts, which replays every game and compares the
// hash. Same code + same seed = same game, so a change that is not meant to change play (a speed-up, a refactor) must
// leave every hash as it is.
import { createHash } from 'node:crypto';
import { Game } from '../src/engine/engine';
import { makeTierBot, type Tier } from '../src/ai/tiers';
import type { DeckList, GameState, PlayerId } from '../src/engine/types';

export const CORPUS_FILE = 'data/benchmark/game-corpus.json';

/** A deck list as Game.create reads it, in the order its deck file gives the cards (the order changes what a seed deals). */
export interface CorpusList {
  /** the library file it was taken from when the corpus was built (for reading only: the list below is what is played) */
  from: string;
  name: string;
  legends: string[];
  main: string[];
  sideboard: string[];
}

/** One seat: its bot (a tier name for makeTierBot and the bot's seed) and its list (an index into `lists`). */
export interface CorpusSeat {
  tier: Tier;
  seed: number;
  list: number;
}

export interface CorpusGame {
  id: string;
  seed: number;
  first: PlayerId;
  seats: [CorpusSeat, CorpusSeat];
  /** the result, to say what changed when a hash differs */
  winner: PlayerId | 'tie';
  turns: number;
  /** SHA-256 of JSON.stringify of the final state, log included */
  hash: string;
}

export interface GameCorpus {
  kind: 'nct-game-corpus';
  schema: 1;
  /** SIM_VERSION when the corpus was built: a corpus from another version is refused, never compared */
  simVersion: number;
  lists: CorpusList[];
  games: CorpusGame[];
}

/** A game of the corpus before it is played. */
export type CorpusPlan = Omit<CorpusGame, 'winner' | 'turns' | 'hash'>;

/** SHA-256 of a state as JSON (the log and everything else included). */
export const stateSha256 = (s: GameState): string => createHash('sha256').update(JSON.stringify(s)).digest('hex');

const deckOf = (l: CorpusList): DeckList => ({ name: l.name, legends: [...l.legends], main: [...l.main], sideboard: [...l.sideboard] });

/** Play one corpus game from the start with the log on and return its result and hash. */
export async function playCorpusGame(lists: readonly CorpusList[], g: CorpusPlan): Promise<{ winner: PlayerId | 'tie'; turns: number; hash: string }> {
  const [a, b] = g.seats;
  const la = lists[a.list];
  const lb = lists[b.list];
  if (!la || !lb) throw new Error(`game ${g.id}: no list ${!la ? a.list : b.list}`);
  const game = Game.create([deckOf(la), deckOf(lb)], [makeTierBot(a.tier, a.seed), makeTierBot(b.tier, b.seed)], { seed: g.seed, first: g.first, log: true });
  const end = await game.run();
  if (end.winner === null) throw new Error(`game ${g.id} ended without a result`);
  return { winner: end.winner, turns: end.turn, hash: stateSha256(end) };
}

/**
 * The corpus's games over `n` library decks (indices into the library in its load order): every deck in a Medium game
 * and an Easy game, four Hard-vs-Hard games and four games between different tiers, each seat going first about as often.
 * The Hard games are few because they are slow (about 1 to 3 s each alone, depending on the deal).
 */
export function corpusPlan(n: number, seedBase = 7_200_000): (Omit<CorpusPlan, 'seats'> & { seats: [{ tier: Tier; deck: number }, { tier: Tier; deck: number }] })[] {
  if (n < 2) throw new Error('the corpus needs at least 2 decks');
  const out: (Omit<CorpusPlan, 'seats'> & { seats: [{ tier: Tier; deck: number }, { tier: Tier; deck: number }] })[] = [];
  const add = (kind: string, a: Tier, da: number, b: Tier, db: number) => {
    const k = out.length;
    const seed = seedBase + 101 * k;
    const id = `${kind}-${String(out.filter((x) => x.id.startsWith(`${kind}-`)).length + 1).padStart(2, '0')}`;
    out.push({ id, seed, first: (k % 2) as PlayerId, seats: [{ tier: a, deck: da % n }, { tier: b, deck: db % n }] });
  };
  const at = (f: number) => Math.floor(f * n);
  // deck pairs picked (on SIM_VERSION 9) for full-length Hard games of about a second each, so no test nears its timeout
  for (const [x, y] of [
    [0.65, 0.85],
    [0.125, 0.625],
    [0.25, 0.75],
    [0.31, 0.69],
  ] as const)
    add('hard', 'hard', at(x), 'hard', at(y));
  add('mixed', 'hard', at(0.06), 'medium', at(0.44));
  add('mixed', 'medium', at(0.31), 'hard', at(0.69));
  add('mixed', 'hard', at(0.56), 'easy', at(0.94));
  add('mixed', 'easy', at(0.81), 'medium', at(0.19));
  const half = Math.ceil(n / 2);
  for (let k = 0; k < half; k++) add('medium', 'medium', 2 * k, 'medium', 2 * k + 1);
  for (let k = 0; k < half; k++) add('easy', 'easy', k, 'easy', k + half);
  return out;
}
