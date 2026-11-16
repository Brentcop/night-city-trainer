// "Watch" a match as a spectator (src/ui/components/watch/): which game to show next, as plain data. Light on purpose
// (no engine, no bots): the tournament runner and the events page import it statically, and the heavy part (playing a
// game out, src/lib/watchGame.ts, in src/sim/watch.worker.ts) loads only when someone presses Watch.
//
// A game can be watched at all because the same code and the same seed give the same game. A game of an event is fixed
// by its two lists, its seed, who goes first and the event's bot; a game a person played is fixed by its record (the
// practice or online replay record the site keeps, src/lib/practiceReplays.ts). WatchSource names one game of either
// kind. A match is a series of such games: the games the event recorded, and while a tournament runs in this browser,
// the game its runner has dealt but not finished (DealtGames: the runner notes every game it hands to its play
// function, so a match can be watched as soon as it is paired, without the runner waiting for anyone).
import type { DeckList, GameState, PlayerId } from '../engine/types';
import type { PracticeReviewSpec } from '../sim/practiceReview';
import { winsNeeded } from './eventFormats';
import type { GameJob, GameRec, PlayGame } from './tournament';

/** A game of an event, played again with the event's bot: the lists, the seed, who goes first. */
export interface EventGameSource {
  kind: 'event';
  decks: [DeckList, DeckList];
  seed: number;
  first: PlayerId;
  bot: string;
  /** the simulator version the event was recorded with (absent: recorded before events kept it) */
  simVersion?: number;
  /** the recorded result the play-out must reach (absent: the game is not over yet in the running event) */
  expect?: { winner: PlayerId | 'tie'; turns: number };
}

/**
 * A finished game a person played: what its practice or online replay record (src/lib/practiceReplays.ts) says the
 * replay must do, as the Game review reads it (practiceSpec; built on the page by src/lib/watchRecord.ts).
 */
export interface RecordGameSource {
  kind: 'record';
  spec: PracticeReviewSpec;
}

/** One game to watch. */
export type WatchSource = EventGameSource | RecordGameSource;

/** How a watched game ended, as the play-out reached it. */
export interface WatchOutcome {
  winner: PlayerId | 'tie' | null;
  turns: number;
}

/** What a spectator is asked to watch: a match of an event (one game of it with `only`), or one recorded game. */
export type WatchTarget = WatchMatch | { kind: 'record'; title: string; names: [string, string]; source: RecordGameSource };

/** A match of an event to watch, read live while a tournament runs in this browser. */
export interface WatchMatch {
  kind: 'match';
  /** the decks' names in the event (the seats' names on the board) */
  names: [string, string];
  /** the two lists as the event stored them (sideboards play no part) */
  lists: [Pick<DeckList, 'legends' | 'main'>, Pick<DeckList, 'legends' | 'main'>];
  bot: string;
  simVersion?: number;
  /** games the match is played over (best of), when known: a match then ends as soon as a side has the wins it needs */
  bestOf?: number;
  /** the games the event has recorded for this match so far (read again at every look while the event runs) */
  recorded: () => readonly GameRec[];
  /** the event has finished this match: every game it played is recorded */
  complete: () => boolean;
  /** a game the running event has dealt and not finished yet, by its number in the match (0-based) */
  dealt?: (i: number) => { seed: number; first: PlayerId } | null;
  /** the event is still running (a game not dealt yet may still come) */
  live?: () => boolean;
  /** watch only this game of the match (0-based) */
  only?: number;
}

/** What comes next in a watched match. */
export type NextGame =
  | { kind: 'game'; index: number; source: WatchSource }
  /** the event has not dealt this game yet: look again shortly */
  | { kind: 'wait'; index: number }
  /** the match is over (or the one game asked for is shown) */
  | { kind: 'over' }
  /** the event stopped before this game was played */
  | { kind: 'stopped'; index: number };

const deckOf = (name: string, l: Pick<DeckList, 'legends' | 'main'>): DeckList => ({ name, legends: [...l.legends], main: [...l.main], sideboard: [] });

/**
 * The next game of a watched match, given the results of the games played out so far (in order, from game 1 or from
 * `only`). The match is over when a side has the wins it needs or every game of the best-of is played, as the event
 * plays it (src/lib/tournament.ts playMatch), or when the event has finished the match and every game it recorded is
 * played out. A game the event recorded is played again and must reach its recorded result; a game it dealt but has
 * not finished is played again as it is being played.
 */
export function nextGame(m: WatchMatch, seen: readonly WatchOutcome[]): NextGame {
  const i = (m.only ?? 0) + seen.length;
  if (m.only !== undefined && seen.length >= 1) return { kind: 'over' };
  if (m.only === undefined && m.bestOf !== undefined) {
    const [a, b] = scoreOf(seen);
    const need = winsNeeded(m.bestOf);
    if (i >= m.bestOf || a >= need || b >= need) return { kind: 'over' };
  }
  const recorded = m.recorded();
  const rec = recorded[i];
  const job = rec ?? m.dealt?.(i) ?? null;
  if (!job) {
    if (m.only === undefined && m.complete() && i >= recorded.length) return { kind: 'over' };
    return m.live?.() ? { kind: 'wait', index: i } : { kind: 'stopped', index: i };
  }
  return {
    kind: 'game',
    index: i,
    source: {
      kind: 'event',
      decks: [deckOf(m.names[0], m.lists[0]), deckOf(m.names[1], m.lists[1])],
      seed: job.seed,
      first: job.first,
      bot: m.bot,
      ...(m.simVersion !== undefined ? { simVersion: m.simVersion } : {}),
      ...(rec ? { expect: { winner: rec.winner, turns: rec.turns } } : {}),
    },
  };
}

/** The next game of any watch target: a match of an event (nextGame), or the one recorded game. */
export function nextOf(t: WatchTarget, seen: readonly WatchOutcome[]): NextGame {
  if (t.kind === 'match') return nextGame(t, seen);
  return seen.length ? { kind: 'over' } : { kind: 'game', index: 0, source: t.source };
}

/**
 * The cards the last move touched, to mark on the board: every card that is new, changed zone or controller, turned
 * face up or down, was spent or readied, or gained or lost Gear between two boards (cards in the decks are left out).
 */
export function movedCards(prev: GameState | null | undefined, next: GameState): number[] {
  if (!prev) return [];
  const out: number[] = [];
  for (const c of Object.values(next.cards)) {
    if (c.zone === 'deck') continue;
    const p = prev.cards[c.uid];
    if (!p || p.zone !== c.zone || p.controller !== c.controller || p.faceUp !== c.faceUp || p.spent !== c.spent || p.gear.length !== c.gear.length) out.push(c.uid);
  }
  return out;
}

/** The score of the games seen so far: [first deck's wins, second deck's wins]. */
export function scoreOf(seen: readonly WatchOutcome[]): [number, number] {
  const s: [number, number] = [0, 0];
  for (const o of seen) if (o.winner === 0 || o.winner === 1) s[o.winner]++;
  return s;
}

/** A game the running event handed to its play function. */
export interface DealtGame {
  a: string;
  b: string;
  seed: number;
  first: PlayerId;
}

/**
 * The games a running event has dealt, noted as the runner hands them to its play function (wrap()). It only notes: the
 * job goes on unchanged, so the event plays exactly as without it. A match's games have consecutive seeds (the match's
 * seed base plus the game's number), so once game 1 is known every later game is found by its seed.
 */
export class DealtGames {
  private jobs: DealtGame[] = [];

  /** The same play function, noting each job first (keeps the function's own properties, e.g. resumePlay's reused()). */
  wrap<P extends PlayGame>(play: P): P {
    const fn = (job: GameJob) => {
      this.jobs.push({ a: job.a.name, b: job.b.name, seed: job.seed, first: job.first });
      return play(job);
    };
    return Object.assign(fn, play) as P;
  }

  /** Forget every noted game (a new run starts). */
  clear() {
    this.jobs = [];
  }

  /**
   * Game `i` (0-based) of the match between `a` and `b`, given the games the event has recorded for that match. Game 1
   * of a match with nothing recorded is the one dealt game of that pairing whose seed no recorded game has; when two
   * matches of the same pairing are both waiting for their first game (a match list naming it twice in a round), none
   * is picked, since either could be this one.
   */
  find(a: string, b: string, recorded: readonly GameRec[], i: number, recordedAnywhere: (seed: number) => boolean): { seed: number; first: PlayerId } | null {
    const pair = this.jobs.filter((j) => j.a === a && j.b === b);
    if (recorded.length) {
      const seed = recorded[0]!.seed + i;
      const j = pair.find((x) => x.seed === seed);
      return j ? { seed: j.seed, first: j.first } : null;
    }
    if (i !== 0) return null;
    const open = pair.filter((x) => !recordedAnywhere(x.seed));
    return open.length === 1 ? { seed: open[0]!.seed, first: open[0]!.first } : null;
  }
}
