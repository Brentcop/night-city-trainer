// Replayable records of practice games (seeds + every human choice), so a finished game can be reviewed later.
// Kept per browser (localStorage), newest last, capped. Never required for the app to work.
import type { DeckList, PlayerId } from '../engine/types';
import type { ReviewRequest } from '../sim/practiceReview';

export interface PracticeReplay {
  id: string;
  date: string;
  decks: [DeckList, DeckList];
  seed: number;
  first?: PlayerId;
  botLevel: string;
  botSeed: number;
  choices: number[][];
  /**
   * The human chose payment sources (the choices include 'pay' answers). Replays saved before payment choices existed
   * lack it, and must be replayed with automatic payment to line up.
   */
  payChoice?: boolean;
  /**
   * The human chose the order of their own pending effects (the choices include 'order' answers). Replays saved before
   * that existed lack it, and must be replayed with first-in-first-out resolution to line up.
   */
  orderChoice?: boolean;
  result: 'win' | 'loss' | 'draw';
  /** how many times Undo was used (the recorded choices are the final line of play) */
  undos?: number;
  /**
   * You conceded (result 'loss'): the recorded choices stop at the position you conceded from, so a re-simulation
   * that runs past them is no longer your game.
   */
  conceded?: boolean;
}
export const REPLAYS_KEY = 'nct.practiceReplays.v1';
const KEY = REPLAYS_KEY;
const MAX = 25;

const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === 'string');
const isDeck = (x: unknown): x is DeckList => {
  const d = x as DeckList | null;
  return !!d && typeof d === 'object' && typeof d.name === 'string' && isStrArr(d.legends) && isStrArr(d.main) && (d.sideboard === undefined || isStrArr(d.sideboard));
};

/** True if a stored value has everything a review needs to re-simulate the game. */
function isReplay(x: unknown): x is PracticeReplay {
  const r = x as PracticeReplay | null;
  return (
    !!r &&
    typeof r === 'object' &&
    typeof r.id === 'string' &&
    typeof r.date === 'string' &&
    Array.isArray(r.decks) &&
    r.decks.length === 2 &&
    r.decks.every(isDeck) &&
    typeof r.seed === 'number' &&
    (r.first === undefined || r.first === 0 || r.first === 1) &&
    typeof r.botLevel === 'string' &&
    typeof r.botSeed === 'number' &&
    Array.isArray(r.choices) &&
    r.choices.every((c) => Array.isArray(c) && c.every((i) => typeof i === 'number')) &&
    (r.payChoice === undefined || typeof r.payChoice === 'boolean') &&
    (r.orderChoice === undefined || typeof r.orderChoice === 'boolean') &&
    (r.conceded === undefined || typeof r.conceded === 'boolean') &&
    (r.result === 'win' || r.result === 'loss' || r.result === 'draw')
  );
}

const withSideboards = (r: PracticeReplay): PracticeReplay => ({ ...r, decks: [{ ...r.decks[0], sideboard: r.decks[0].sideboard ?? [] }, { ...r.decks[1], sideboard: r.decks[1].sideboard ?? [] }] });

/** Parse stored replays, keeping only complete ones (never throws). */
export function parseReplays(raw: string | null): PracticeReplay[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(isReplay).map(withSideboards);
  } catch {
    return [];
  }
}

/** One replay record read back from elsewhere (an exported file, src/lib/coachedReplay.ts), or null when incomplete. */
export function asReplay(x: unknown): PracticeReplay | null {
  return isReplay(x) ? withSideboards(x) : null;
}

export function loadReplays(): PracticeReplay[] {
  try {
    return parseReplays(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}
export function saveReplay(r: PracticeReplay) {
  try {
    const all = loadReplays().filter((x) => x.id !== r.id);
    all.push(r);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-MAX)));
  } catch {
    /* storage full or blocked */
  }
}

/** Remove every recorded replay (the practice log is cleared apart: src/lib/practiceLog.ts clearPractice). */
export function clearReplays() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** The result a review's re-simulation should reproduce (a conceded game's re-simulation ends at the concession). */
export const reviewExpect = (r: PracticeReplay): 0 | 1 | 'tie' => (r.result === 'win' ? 0 : r.result === 'loss' ? 1 : 'tie');

/** Review request for a recorded practice game (your decisions only, with the coach's view of each; a conceded game ends where you conceded). */
export function practiceRequest(r: PracticeReplay): ReviewRequest {
  return { kind: 'practice', decks: r.decks, seed: r.seed, first: r.first, botLevel: r.botLevel, botSeed: r.botSeed, choices: r.choices, payChoice: !!r.payChoice, orderChoice: !!r.orderChoice, conceded: !!r.conceded, rollouts: 8, withCoach: true };
}
