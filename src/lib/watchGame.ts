// Playing one game out for a spectator ("Watch", src/ui/components/watch/): the game is played again with the engine
// exactly as the events and the Game review play it, and the board is captured after every log line (the visual
// replay's frames, src/lib/replayFrames.ts). Runs in src/sim/watch.worker.ts, off the page's thread.
//   - An event game (src/lib/watchMatch.ts EventGameSource): both seats are the event's bot, seat A on the game's seed
//     and seat B on seed + 7777 (makeBot, as the tournament worker plays them). An event recorded with another
//     simulator version is refused before playing (the rule "Run this event again" uses, src/ui/eventRerun.ts), and a
//     recorded game must end with the recorded winner after the recorded number of turns.
//   - A recorded game a person played (RecordGameSource): the practice or online replay record, replayed strictly by
//     the Game review's own agents and checks (src/sim/practiceReview.ts: refuseOtherVersion, practiceAgents,
//     checkReplayed). Only a finished game has such a record, and the check needs the replay to end as recorded, so a
//     game still in progress can never be shown here.
// A replay that does not reproduce the game is refused with one plain sentence (WatchRefused), never shown as if it were
// the game. Nothing here hides anything: a spectator sees both hands and every face-down Legend (src/ui/components/watch/).
import { Game } from '../engine/engine';
import type { PlayerId } from '../engine/types';
import { ReplayDiverged } from '../ai/reviewer';
import { checkReplayed, practiceAgents, refuseOtherVersion, replayedEnd } from '../sim/practiceReview';
import { CURRENT_SIM_VERSION } from './playedRecord';
import { captureFrames, type ReplayFrame } from './replayFrames';
import { makeBot } from './tournament';
import type { EventGameSource, RecordGameSource, WatchSource } from './watchMatch';

/** A game played out for watching: the board after every log line, and how it ended. */
export interface WatchedGame {
  frames: ReplayFrame[];
  winner: PlayerId | 'tie' | null;
  reason: string;
  turns: number;
}

/** A game that can't be watched: `message` is the plain sentence the spectator is shown. */
export class WatchRefused extends Error {
  constructor(why: string) {
    super(why);
    this.name = 'WatchRefused';
  }
}

/** The Game review's refusals start "This game can't be reviewed"; a spectator is told it can't be watched. */
export const watchWords = (why: string) => why.replace(/^This game can't be reviewed/, "This game can't be watched");

/** Why an event game can't be played again as it was played, before trying (another simulator version), or null. */
export function eventVersionProblem(simVersion: number | undefined, now = CURRENT_SIM_VERSION): string | null {
  if (simVersion === now) return null;
  if (simVersion === undefined) return "This game can't be watched: its event was recorded before events kept the version of the bots and rules engine, so playing it again would not give the same game.";
  return `This game can't be watched: its event was recorded with version ${simVersion} of the bots and rules engine, and this is version ${now}, so playing it again would not give the same game.`;
}

const resultWords = (w: PlayerId | 'tie' | null, names: readonly string[]) => (w === 0 || w === 1 ? `a win for ${names[w]}` : 'a draw');

/** Play an event game out with the event's bot. */
async function playEvent(q: EventGameSource): Promise<WatchedGame> {
  const why = eventVersionProblem(q.simVersion);
  if (why) throw new WatchRefused(why);
  const g = Game.create(q.decks, [makeBot(q.bot, q.seed), makeBot(q.bot, q.seed + 7777)], { seed: q.seed, first: q.first });
  const frames = captureFrames(g);
  const s = await g.run();
  const winner = s.winner ?? 'tie';
  const e = q.expect;
  if (e && (winner !== e.winner || s.turn !== e.turns)) {
    const names = [q.decks[0].name, q.decks[1].name];
    const what = winner !== e.winner ? `it ends in ${resultWords(winner, names)}, not ${resultWords(e.winner, names)} as recorded` : `it lasts ${s.turn} turns, not ${e.turns} as recorded`;
    throw new WatchRefused(`This game can't be watched: playing it again with this version of the bots and rules engine gives a different game (${what}).`);
  }
  return { frames, winner: s.winner, reason: s.winReason ?? '', turns: s.turn };
}

/** Replay a finished game a person played from its record, strictly (the Game review's checks). */
async function playRecord(q: RecordGameSource): Promise<WatchedGame> {
  const spec = q.spec;
  refuseOtherVersion(spec);
  const agents = practiceAgents(spec);
  const g = Game.create(spec.decks, agents, { seed: spec.seed, first: spec.first });
  const frames = captureFrames(g);
  const s = await g.run();
  checkReplayed(spec, agents, replayedEnd(s));
  return { frames, winner: s.winner, reason: s.winReason ?? '', turns: s.turn };
}

/**
 * Play one game out for watching. Throws a WatchRefused with the sentence to show when the game can't be played again
 * as it was played; any other error is a failure of the game itself.
 */
export async function playWatchGame(q: WatchSource): Promise<WatchedGame> {
  try {
    return q.kind === 'event' ? await playEvent(q) : await playRecord(q);
  } catch (e) {
    if (e instanceof ReplayDiverged) throw new WatchRefused(watchWords(e.message));
    throw e;
  }
}
