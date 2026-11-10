// Replayable records of practice games (seeds + every human choice), so a finished game can be reviewed later.
// Kept per browser (localStorage), newest last, capped. Never required for the app to work.
import type { DeckList, PlayerId } from '../engine/types';

export interface PracticeReplay {
  id: string;
  date: string;
  decks: [DeckList, DeckList];
  seed: number;
  first?: PlayerId;
  botLevel: string;
  botSeed: number;
  choices: number[][];
  result: 'win' | 'loss' | 'draw';
  /** how many times Undo was used (the recorded choices are the final line of play) */
  undos?: number;
}
const KEY = 'nct.practiceReplays.v1';
const MAX = 25;

export function loadReplays(): PracticeReplay[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
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
