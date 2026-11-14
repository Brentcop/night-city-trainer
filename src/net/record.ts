// What an online game leaves behind in this browser (src/net/): one practice-log entry (level 'pvp', the rival's name)
// and, when the full record is known, a replay the Game review can re-simulate (both seats' answers). The host has the
// record at once; the guest receives it from the host after the game is over. Nothing here touches the bots' data,
// ratings or recorded events: PvP games never enter sim data.
import type { DeckList, PlayerId } from '../engine/types';
import { loadPractice, recordPractice, type MultiDayMark, type PracticeGame } from '../lib/practiceLog';
import { CURRENT_SIM_VERSION } from '../lib/playedRecord';
import { loadReplays, saveReplay, type PracticeReplay } from '../lib/practiceReplays';
import type { GameRecordMsg } from './protocol';

export const PVP_LEVEL = 'pvp';

/** How a game ended, from one player's side. */
export interface OnlineOutcome {
  /** the practice id (one per game and side) */
  id: string;
  date: string;
  result: 'win' | 'loss' | 'draw';
  reason: string;
  myDeck: string;
  rivalDeck: string;
  rival: string;
  first: boolean;
  turns: number;
  /** Gigs held at the end: [yours, the rival's] */
  gigs: [number, number];
  /** you conceded */
  conceded: boolean;
  rivalConceded: boolean;
  abandoned: boolean;
  /** a multi-day game ended on time: your clock ran out (the rival claimed the win), or the rival's did */
  timedOut?: boolean;
  rivalTimedOut?: boolean;
  /** a multi-day game played by turn packets (src/net/corrSession.ts) */
  multiDay?: MultiDayMark;
}

export function practiceEntryOf(o: OnlineOutcome): PracticeGame {
  return {
    id: o.id,
    date: o.date,
    deck: o.myDeck,
    opp: o.rivalDeck,
    level: PVP_LEVEL,
    rival: o.rival.slice(0, 30),
    result: o.result,
    first: o.first,
    turns: o.turns,
    reason: o.reason,
    gigs: o.gigs,
    ...(o.conceded ? { conceded: true } : {}),
    ...(o.multiDay ? { multiDay: { ...o.multiDay } } : {}),
  };
}

const deckOf = (d: GameRecordMsg['decks'][number]): DeckList => ({ name: d.name, legends: [...d.legends], main: [...d.main], sideboard: [...d.sideboard] });

/** The replay of an online game for the seat `seat` (0 host, 1 guest), from the full record. */
export function replayOf(o: OnlineOutcome, rec: GameRecordMsg, seat: PlayerId): PracticeReplay {
  const rival = (1 - seat) as PlayerId;
  return {
    id: o.id,
    date: o.date,
    decks: [deckOf(rec.decks[0]), deckOf(rec.decks[1])],
    seed: rec.seed,
    first: rec.first,
    botLevel: PVP_LEVEL,
    botSeed: 0,
    choices: rec.answers[seat].map((a) => [...a]),
    payChoice: true,
    orderChoice: true,
    ...(rec.endTurnClick?.[seat] ? { endTurnClick: true } : {}),
    result: o.result,
    ...(o.conceded ? { conceded: true } : {}),
    simVersion: CURRENT_SIM_VERSION,
    turns: o.turns,
    pvp: {
      rival: o.rival.slice(0, 30),
      seat,
      rivalChoices: rec.answers[rival].map((a) => [...a]),
      ...(o.rivalConceded ? { rivalConceded: true } : {}),
      ...(rec.endTurnClick?.[rival] ? { rivalEndTurnClick: true } : {}),
      ...(o.abandoned ? { abandoned: true } : {}),
      // the clock loss ends the replay where the game stopped (the Game review never plays the timed-out seat on)
      ...(o.timedOut ? { timedOut: seat } : o.rivalTimedOut ? { timedOut: rival } : {}),
    },
    ...(o.multiDay ? { multiDay: { ...o.multiDay } } : {}),
    // a game played to its end on the board: the Game review's replay must end in the host's final position (an ending
    // off the board carries none: both seats are scripted there, so no one seat's last decision stands for it)
    ...(rec.endHash && !offBoard(o) ? { position: { hash: rec.endHash } } : {}),
  };
}

/** The session ended the game (a concession, abandoned, a clock), not the rules. */
const offBoard = (o: OnlineOutcome) => o.conceded || o.rivalConceded || o.abandoned || !!o.timedOut || !!o.rivalTimedOut;

/** Writes an online game to this browser's practice log and replays (the default; tests pass their own). */
export interface OnlineRecorder {
  entry(o: OnlineOutcome): void;
  replay(r: PracticeReplay): void;
}
/**
 * Two tabs of one browser ("two tabs on this device") write the same storage at nearly the same moment, and a write
 * from one tab can reach the other only after it has read the log: so each write is checked again shortly after and
 * made again if the other tab's write replaced it (both are upserts by id, so this never doubles an entry).
 */
function writeAndCheck(write: () => void, present: () => boolean) {
  write();
  if (typeof window === 'undefined') return;
  for (const ms of [800, 2500]) setTimeout(() => !present() && write(), ms);
}
export const browserRecorder: OnlineRecorder = {
  entry: (o) => writeAndCheck(() => recordPractice(practiceEntryOf(o)), () => loadPractice().some((g) => g.id === o.id)),
  replay: (r) => writeAndCheck(() => saveReplay(r), () => loadReplays().some((x) => x.id === r.id)),
};
