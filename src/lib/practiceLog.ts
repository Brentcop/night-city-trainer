// Per-browser practice history (localStorage). Never required for the app to work.
export interface PracticeGame {
  date: string;
  deck: string;
  opp: string;
  level: string;
  result: 'win' | 'loss' | 'draw';
  first: boolean;
  turns: number;
  reason: string;
}
const KEY = 'nct.practice.v1';

export function loadPractice(): PracticeGame[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}
export function recordPractice(g: PracticeGame) {
  try {
    const all = loadPractice();
    all.push(g);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-500)));
  } catch {
    /* ignore */
  }
}
export function clearPractice() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
