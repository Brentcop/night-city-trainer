// Your games in a played event (src/lib/playedEvent.ts), without React: a practice session (src/lib/practiceSession.ts)
// set up from the waiting game, whose finished game goes to two places: the practice history and its replay, tagged with
// the event and the match (`tourney`, like a multi-day game's `multiDay`), and the event, as the game's record. The board
// binding is src/ui/components/tourney/TourneyGame.tsx; this module loads with it, only when "Play your match" is
// pressed, never with the runner page.
//
// The game: your deck is seat 0 on the board (as in every practice game). When you are the match's second-named deck
// the decks are swapped for the board and swapped back in the record. The seed is the event's game seed and the bot's
// seed is the one its seat would have in a bot game (seat A the game seed, seat B the game seed + 7777), so the bot's
// side is the same whenever the event is set up again; your choices make the rest, and the practice replay records them.
// No Undo (the board hides it); a concession loses the game and is recorded like a finished one.
import type { GameState } from '../engine/types';
import { gameDeck, type GameRec } from './tournament';
import { PracticeSession, recordFinished, type MatchSetup, type Running } from './practiceSession';
import type { PracticeReplay } from './practiceReplays';
import type { TourneyMark } from './practiceLog';
import { buildSave, parseSavedGame, type SavedGame } from './savedGames';
import type { PlayedGames, WaitingGame } from './playedEvent';

/** Whether you are the match's first-named deck (seat A). */
const youAreA = (w: Pick<WaitingGame, 'job' | 'you'>) => (w.you ?? w.job.a.name) === w.job.a.name;

/** The practice game for a waiting game of yours. */
export function yourMatchSetup(w: Pick<WaitingGame, 'job' | 'you'>, o: { endTurnClick?: boolean } = {}): MatchSetup {
  const a = youAreA(w);
  const { job } = w;
  return {
    decks: a ? [gameDeck(job.a), gameDeck(job.b)] : [gameDeck(job.b), gameDeck(job.a)],
    seed: job.seed,
    first: a ? job.first : ((1 - job.first) as 0 | 1),
    level: job.bot,
    botSeed: a ? job.seed + 7777 : job.seed,
    ...(o.endTurnClick ? { endTurnClick: true } : {}),
  };
}

/** The event's record of a finished game of yours (seat A's view: 0 = the match's first-named deck won). */
export function yourGameRec(w: Pick<WaitingGame, 'job' | 'you'>, st: Pick<GameState, 'winner' | 'turn' | 'winReason'>, replayId: string): GameRec {
  const a = youAreA(w);
  const winner: GameRec['winner'] = st.winner === null || st.winner === 'tie' ? 'tie' : a ? st.winner : ((1 - st.winner) as 0 | 1);
  return { seed: w.job.seed, first: w.job.first, winner, turns: st.turn, reason: st.winReason ?? '', by: 'you', replay: replayId };
}

/** The practice tag of a game of yours. */
export function tourneyMark(event: { id: string | number; name?: string }, w: Pick<WaitingGame, 'job' | 'gi'>, round: string): TourneyMark {
  return { event: String(event.id), ...(event.name ? { name: event.name } : {}), round, a: w.job.a.name, b: w.job.b.name, game: w.gi + 1 };
}

/** A save that belongs to this waiting game (read back from a stored run: untrusted), or null. */
export function saveFor(w: Pick<WaitingGame, 'job' | 'you'>, raw: unknown): SavedGame | null {
  const p = parseSavedGame(raw);
  if (!p.ok) return null;
  const s = p.value;
  const want = yourMatchSetup(w);
  return s.seed === want.seed && s.botSeed === want.botSeed && s.botLevel === want.level && s.first === want.first && s.decks[0].name === want.decks[0].name && s.decks[1].name === want.decks[1].name ? s : null;
}

export interface YourGamesOptions {
  /** the run: its id and name (for the practice tag) */
  event: { id: string | number; name?: string };
  /** the round's name of a waiting game ("Round 2", "Final") */
  roundOf: (w: WaitingGame) => string;
  /** bot delay after each of its actions, in ms */
  pace?: () => number;
  /** the coach is on in this game (kept in the save as a record) */
  coach?: () => boolean;
  /** your game's save at each new decision of yours; null once it has ended (finished or conceded) */
  onSave?: (game: string, save: SavedGame | null) => void;
  /** the practice history or replay could not be stored (the event still takes the result) */
  onRecordRefused?: () => void;
}

/**
 * Plays your waiting games one at a time on a practice session. `start` begins a game; `resume` continues one from its
 * save (refused saves start nothing: the caller offers to start the game again). When a game ends it is recorded in the
 * practice history (tagged), then handed to the event (`PlayedGames.finish`), which moves on: the next game of the match
 * is then waiting, or the match is over.
 */
export class YourGames {
  readonly session: PracticeSession;
  /** the waiting game being played, by the practice replay's id */
  private games = new Map<string, WaitingGame>();

  constructor(
    private played: PlayedGames,
    private o: YourGamesOptions,
  ) {
    this.session = new PracticeSession({
      pace: o.pace,
      record: (replay, st) => this.recorded(replay, st),
      onStable: (run) => this.store(run),
      onClosed: (run, why) => {
        if (why === 'quit') return;
        const w = this.games.get(run.replay.id);
        if (w) o.onSave?.(w.id, null);
      },
    });
  }

  /** The waiting game the running game plays, if any. */
  waitingOf(run: Pick<Running, 'replay'> | null): WaitingGame | null {
    return run ? (this.games.get(run.replay.id) ?? null) : null;
  }

  /** Start a waiting game of yours from its first move. */
  start(w: WaitingGame, o: { endTurnClick?: boolean } = {}): Running {
    const run = this.session.start(yourMatchSetup(w, o));
    this.games.set(run.replay.id, w);
    return run;
  }

  /** Continue a waiting game of yours from its save (the save must be this game's: saveFor). */
  async resume(w: WaitingGame, save: SavedGame) {
    this.games.set(save.replayId, w);
    return this.session.restore(save);
  }

  /** Write the running game's save now (leaving the board, or the page being hidden). */
  flush() {
    this.store(this.session.current);
  }

  /** Leave the board: the game is kept (its save stays with the event) and stops here. */
  leave() {
    this.flush();
    this.session.quit({ keepSave: true });
  }

  private store(run: Running | null) {
    const w = this.waitingOf(run);
    if (!run || !w || run.cancelled || run.restoring || run.error || run.conceded || run.g.s.winner !== null) return;
    const save = buildSave({ replay: run.replay, grades: run.grades, stable: run.stable, log: run.g.s.log }, { id: 'tourney', saved: new Date().toISOString(), coach: this.o.coach?.() ?? false });
    if (save) this.o.onSave?.(w.id, save);
  }

  private recorded(replay: PracticeReplay, st: GameState): boolean {
    const w = this.games.get(replay.id);
    if (w) replay.tourney = tourneyMark(this.o.event, w, this.o.roundOf(w));
    const ok = recordFinished(replay, st);
    if (!ok) this.o.onRecordRefused?.();
    if (w) this.played.finish(w.id, yourGameRec(w, st, replay.id));
    return ok;
  }
}
