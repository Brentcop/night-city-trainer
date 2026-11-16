// "Watch" a finished game you played (Profile → History): its replay record turned into a watch target. Kept apart
// from src/lib/watchMatch.ts because the record's module (practiceReplays.ts) reads browser storage, which the watch
// worker must not load; the worker gets only what the replay must do (the Game review's practiceSpec).
import { practiceSpec, type PracticeReplay } from './practiceReplays';
import type { WatchTarget } from './watchMatch';

/**
 * A finished game you played, to watch with both hands face up. Seat 0 is drawn at the bottom; the seats are named
 * "You" and the rival (the other person online, else the bot by `botLabel`). A replay record exists only for a game
 * that is over (it is written when the game ends), and the replay must end as recorded (src/lib/watchGame.ts).
 */
export function recordTarget(r: PracticeReplay, o: { turns?: number; botLabel: string }): WatchTarget {
  const rival = r.pvp ? r.pvp.rival || 'Rival' : `${o.botLabel} bot`;
  const names: [string, string] = r.pvp?.seat === 1 ? [rival, 'You'] : ['You', rival];
  return { kind: 'record', title: `${r.decks[0].name} vs ${r.decks[1].name}`, names, source: { kind: 'record', spec: practiceSpec(r, o.turns) } };
}
