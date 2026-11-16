// Played events: tournaments that people play in (#/run, feature `playedTournaments`). Pure and light: the runner page
// imports it; the game board and the practice session are bound to it elsewhere (src/lib/playedGame.ts, loaded only
// when "Play your match" is pressed).
//
// Who runs each entrant: a bot (the default, and every entrant of a bot event), you (you play its matches on this
// device's board against the bot), or another player (a person elsewhere: the organiser records the result by hand).
// The event's setup carries the people (`EventSetup.seats`, entrant name to 'you' | 'player'); a setup with none is a
// bot event and exactly what it always was.
//
// How a match gets its result. The event runs as the formats define it (runTournament, src/lib/tournament.ts): it asks
// for one game at a time through a PlayGame function, and a round is paired, and the bracket advances, only once every
// match of the round has its result. PlayedGames is that function for a played event:
//   - bot against bot: simulated by the bots, as in any event;
//   - you against a bot: the game waits until you play it on the board (`finish` hands back its record);
//   - a match with another player in it (you against them, or two of them): the game waits until the whole match is
//     recorded by hand (`record`: who won each game, or who did not play); its later games come from that record.
// Seeds: a played event seeds every match by its stable key (eventFormats.ts "Seeds"), so the same event set up twice
// deals the same games to the bot's side; your own games replay from their practice records, not from the seed alone.
//
// A played event counts for nothing a bot statistic reads: no ratings, head-to-heads or upsets (ratingGames.ts and
// eventUpsets.ts refuse it), and no "Your tournaments" record (runLedgerEntry.ts), its bot-against-bot games included.
import { firstPlayer, isPlayedSetup, winsNeeded, type EventSetup, type NextRule } from './eventFormats';
import type { GameJob, GameRec, MatchRec, PlayGame, TourneyEvent } from './tournament';

export { isPlayedSetup };

// ---------------------------------------------------------------- seats

/** Who runs an entrant. */
export type EntrantSeat = 'bot' | 'you' | 'player';
export const SEAT_LABEL: Readonly<Record<EntrantSeat, string>> = { bot: 'Bot', you: 'You', player: 'Another player' };

/** Who runs this entrant in this setup. */
export const seatOf = (setup: Pick<EventSetup, 'seats'> | null | undefined, name: string): EntrantSeat => setup?.seats?.[name] ?? 'bot';

/** The entrant you play, or null. */
export function youEntrant(setup: Pick<EventSetup, 'seats'> | null | undefined): string | null {
  for (const [name, seat] of Object.entries(setup?.seats ?? {})) if (seat === 'you') return name;
  return null;
}

/** How a match gets its result: simulated ('bots'), played by you on the board ('you'), or recorded by hand ('hand'). */
export type MatchKind = 'bots' | 'you' | 'hand';
export function matchKind(setup: Pick<EventSetup, 'seats'> | null | undefined, a: string, b: string): MatchKind {
  const sa = seatOf(setup, a);
  const sb = seatOf(setup, b);
  if (sa === 'player' || sb === 'player') return 'hand';
  if (sa === 'you' && sb === 'you') return 'hand';
  return sa === 'you' || sb === 'you' ? 'you' : 'bots';
}

/** A played event: some entrant is run by a person. */
export const isPlayedEvent = (ev: { setup?: unknown }) => isPlayedSetup(ev.setup);

// ---------------------------------------------------------------- the setup form's seats

/** The setup form's seats: an explicit seat per entrant row (by entrantKey), and the seat of every other row. */
export interface DraftSeats {
  seats: Readonly<Record<string, EntrantSeat>>;
  /** the seat of an entrant with none set: 'bot', or 'player' in a players-only event (late additions are players too) */
  seatDefault: 'bot' | 'player';
}
export const NO_SEATS: DraftSeats = { seats: {}, seatDefault: 'bot' };

export type SeatPreset = 'bots' | 'play' | 'players';
export const SEAT_PRESETS: readonly { key: SeatPreset; label: string; hint: string }[] = [
  { key: 'bots', label: 'Bots only', hint: 'Bots play every match, as in any event.' },
  { key: 'play', label: 'Play in it', hint: 'You play one entrant on the game board; bots run all the others.' },
  { key: 'players', label: 'Players only', hint: 'Every entrant is you or another player: no bot games. You record the results of other players’ matches here.' },
];

/** One line for the setup: the event lives on this device only. */
export const ONE_DEVICE_NOTE = 'Other players do not see this event update by themselves: there is no server, so this device holds the event and you record their results here.';

/** The seat of an entrant row. */
export const seatFor = (d: DraftSeats, key: string): EntrantSeat => d.seats[key] ?? d.seatDefault;

/** The row you play, among these rows (null: none). */
export const youKey = (d: DraftSeats, keys: readonly string[]): string | null => keys.find((k) => seatFor(d, k) === 'you') ?? null;

/**
 * A preset: "Bots only" (every entrant a bot), "Play in it" (you take one entrant, bots the rest) or "Players only"
 * (every entrant you or another player). You keep the entrant you already play, else the first one.
 */
export function applyPreset(keys: readonly string[], d: DraftSeats, preset: SeatPreset): DraftSeats {
  if (preset === 'bots') return NO_SEATS;
  const you = youKey(d, keys) ?? keys[0];
  return { seats: you ? { [you]: 'you' } : {}, seatDefault: preset === 'players' ? 'player' : 'bot' };
}

/** Which preset the seats are, or 'mixed' when they were set entrant by entrant into something else. */
export function presetOf(keys: readonly string[], d: DraftSeats): SeatPreset | 'mixed' {
  const seats = keys.map((k) => seatFor(d, k));
  const you = seats.filter((s) => s === 'you').length;
  if (seats.every((s) => s === 'bot')) return 'bots';
  if (you <= 1 && seats.every((s) => s !== 'bot')) return 'players';
  if (you === 1 && seats.every((s) => s !== 'player')) return 'play';
  return 'mixed';
}

/** Set one row's seat. You play one entrant at most: choosing you for another row gives the old one the default. */
export function setSeat(keys: readonly string[], d: DraftSeats, key: string, seat: EntrantSeat): DraftSeats {
  const seats: Record<string, EntrantSeat> = {};
  for (const k of keys) {
    const s = k === key ? seat : seatFor(d, k);
    const keep = seat === 'you' && k !== key && s === 'you' ? d.seatDefault : s;
    if (keep !== d.seatDefault) seats[k] = keep;
  }
  return { seats, seatDefault: d.seatDefault };
}

/** The setup's `seats` for these rows (name and key per row): only the people, absent when every entrant is a bot. */
export function setupSeats(rows: readonly { key: string; name: string }[], d: DraftSeats): EventSetup['seats'] {
  const out: Record<string, 'you' | 'player'> = {};
  for (const r of rows) {
    const s = seatFor(d, r.key);
    if (s !== 'bot') out[r.name] = s;
  }
  return Object.keys(out).length ? out : undefined;
}

// ---------------------------------------------------------------- the setup link

const LINK_CHAR: Readonly<Record<EntrantSeat, string>> = { bot: 'b', you: 'y', player: 'p' };
/**
 * The setup link's `seat=` value: one letter per entrant in the link's order (b a bot, y you, p another player), or
 * null when every entrant is a bot (a bot event's link is unchanged). In a link, y means the person who opens it.
 */
export function seatsToLink(seats: readonly EntrantSeat[]): string | null {
  return seats.some((s) => s !== 'bot') ? seats.map((s) => LINK_CHAR[s]).join('') : null;
}
/** A link's `seat=` value read back (null when absent or malformed: then every entrant is a bot). */
export function seatsFromLink(s: string | null | undefined): EntrantSeat[] | null {
  if (!s || !/^[byp]{1,256}$/.test(s) || (s.match(/y/g)?.length ?? 0) > 1) return null;
  return [...s].map((c) => (c === 'y' ? 'you' : c === 'p' ? 'player' : 'bot'));
}
/** Draft seats from a link's seats for these rows (in the link's order; rows past the link's letters are bots). */
export function draftSeatsFromLink(keys: readonly string[], seats: readonly EntrantSeat[] | null): DraftSeats {
  if (!seats) return NO_SEATS;
  const out: Record<string, EntrantSeat> = {};
  keys.forEach((k, i) => {
    const s = seats[i];
    if (s && s !== 'bot') out[k] = s;
  });
  return { seats: out, seatDefault: 'bot' };
}

// ---------------------------------------------------------------- games waiting for a person

/** Every match's game seeds are its seed base (a multiple of 10) plus the game index (eventFormats.ts matchSeedBase). */
export const gameIndex = (seed: number) => seed % 10;
export const matchBase = (seed: number) => seed - (seed % 10);
/** A game's id: the decks in seat order, its seed and who went first (the key resumePlay finds games by). */
export const gameKey = (a: string, b: string, seed: number, first: 0 | 1) => `${a}\u0000${b}\u0000${seed}\u0000${first}`;

/** A game of a played event that waits for a person. */
export interface WaitingGame {
  /** gameKey */
  id: string;
  /** 'you': you play it on the board; 'hand': its match is recorded by hand */
  kind: 'you' | 'hand';
  job: GameJob;
  /** 0-based game of its match */
  gi: number;
  /** its match's seed base */
  base: number;
  /** kind 'you': the entrant you play (job.a's name or job.b's) */
  you?: string;
}

/** A match recorded by hand: who won each game in order (0 = the first-named deck), or which side did not play. */
export type HandResult = { winners: (0 | 1)[] } | { noShow: 0 | 1 };

/** Why a hand-recorded result can't be taken for a best-of-`bo` match (empty: it is fine). */
export function handProblems(r: HandResult, bo: number): string[] {
  if ('noShow' in r) return r.noShow === 0 || r.noShow === 1 ? [] : ['say which side did not play'];
  const need = winsNeeded(bo);
  const out: string[] = [];
  const score = [0, 0];
  for (const [i, w] of r.winners.entries()) {
    if (w !== 0 && w !== 1) {
      out.push(`say who won game ${i + 1}`);
      return out;
    }
    if ((score[0] ?? 0) >= need || (score[1] ?? 0) >= need) {
      out.push(`game ${i + 1} comes after the match was already won`);
      return out;
    }
    score[w] = (score[w] ?? 0) + 1;
  }
  if (Math.max(score[0] ?? 0, score[1] ?? 0) < need) out.push(bo === 1 ? 'say who won the game' : `the match is not finished: someone needs ${need} wins`);
  return out;
}

/** The "Record the result" form: played game by game, or not played (a forfeit). */
export interface HandForm {
  mode: 'played' | 'noShow';
  /** game by game, in order (null: not chosen yet) */
  winners: (0 | 1 | null)[];
  /** the side that did not play */
  noShow: 0 | 1 | null;
}
export const EMPTY_HAND_FORM: HandForm = { mode: 'played', winners: [], noShow: null };

/**
 * What the form says so far: how many game rows to show (one more while the match is undecided, up to the best-of),
 * the score, the result when it is complete, and what is still missing.
 */
export function readHandForm(f: HandForm, bo: number): { rows: number; score: [number, number]; result: HandResult | null; problems: string[] } {
  if (f.mode === 'noShow') {
    const result: HandResult | null = f.noShow === 0 || f.noShow === 1 ? { noShow: f.noShow } : null;
    const need = winsNeeded(bo);
    return { rows: 0, score: f.noShow === 0 ? [0, need] : f.noShow === 1 ? [need, 0] : [0, 0], result, problems: result ? [] : ['say which side did not play'] };
  }
  const need = winsNeeded(bo);
  const score: [number, number] = [0, 0];
  const picked: (0 | 1)[] = [];
  for (const w of f.winners) {
    if (w === null || score[0] >= need || score[1] >= need) break;
    picked.push(w);
    score[w]++;
  }
  const decided = score[0] >= need || score[1] >= need;
  const rows = Math.min(bo, decided ? picked.length : picked.length + 1);
  const result: HandResult = { winners: picked };
  const problems = handProblems(result, bo);
  return { rows, score, result: problems.length ? null : result, problems };
}

export const HAND_REASON = 'Recorded by hand';
export const noShowReason = (name: string) => `Not played: ${name} did not play`;

/**
 * The games of a match recorded by hand, from the waiting game on: the seed each game would have had, who goes first by
 * the event's rule for later games, the winner, no turns. A side that did not play loses as many games as a match win
 * takes (a forfeit counts like a win in straight games).
 */
export function handGames(w: Pick<WaitingGame, 'job' | 'gi' | 'base'>, r: HandResult, bo: number, next?: NextRule): GameRec[] {
  const noShow = 'noShow' in r;
  const winners = noShow ? Array.from({ length: winsNeeded(bo) }, () => (1 - r.noShow) as 0 | 1) : r.winners;
  const reason = noShow ? noShowReason(r.noShow === 0 ? w.job.a.name : w.job.b.name) : HAND_REASON;
  const out: GameRec[] = [];
  let prev: GameRec | undefined;
  winners.forEach((winner, i) => {
    const gi = w.gi + i;
    const first = i === 0 ? w.job.first : firstPlayer({ gi, prev, seedBase: w.base, next });
    const g: GameRec = { seed: w.base + gi, first, winner, turns: 0, reason, by: 'hand' };
    out.push(g);
    prev = g;
  });
  return out;
}

/**
 * The PlayGame of a played event (wrap it in resumePlay to carry on a saved run): bot matches go to the bots, the rest
 * wait for a person. `waiting` lists them; `subscribe` fires whenever it changes. `stop` rejects every waiting game
 * (Stop, or leaving the page), so the event ends as stopped and can be resumed.
 */
export class PlayedGames {
  version = 0;
  private subs = new Set<() => void>();
  private waits = new Map<string, { w: WaitingGame; resolve: (g: GameRec) => void; reject: (e: unknown) => void }>();
  /** games already known from a match recorded by hand, handed out when the event asks for them */
  private known = new Map<string, GameRec>();
  private stoppedWith: unknown = null;

  constructor(
    private setup: Pick<EventSetup, 'seats' | 'next'> | undefined,
    private bots: PlayGame,
  ) {}

  play: PlayGame = (job) => {
    const kind = matchKind(this.setup, job.a.name, job.b.name);
    if (kind === 'bots') return this.bots(job);
    const id = gameKey(job.a.name, job.b.name, job.seed, job.first);
    const k = this.known.get(id);
    if (k) {
      this.known.delete(id);
      return Promise.resolve({ ...k });
    }
    if (this.stoppedWith) return Promise.reject(this.stoppedWith);
    const you = youEntrant(this.setup);
    const w: WaitingGame = {
      id,
      kind,
      job,
      gi: gameIndex(job.seed),
      base: matchBase(job.seed),
      ...(kind === 'you' && you ? { you } : {}),
    };
    return new Promise<GameRec>((resolve, reject) => {
      this.waits.set(id, { w, resolve, reject });
      this.changed();
    });
  };

  /** The games waiting for a person, in the order the event asked for them. */
  get waiting(): WaitingGame[] {
    return [...this.waits.values()].map((x) => x.w);
  }
  get(id: string): WaitingGame | null {
    return this.waits.get(id)?.w ?? null;
  }

  /** Your game is over (played on the board): the event takes its record. False when that game is not waiting. */
  finish(id: string, rec: GameRec): boolean {
    const x = this.waits.get(id);
    if (!x || x.w.kind !== 'you') return false;
    this.waits.delete(id);
    this.changed();
    x.resolve({ ...rec, by: 'you' });
    return true;
  }

  /** A match recorded by hand, from its waiting game. Returns the problems (empty: taken). */
  record(id: string, r: HandResult, bo: number): string[] {
    const x = this.waits.get(id);
    if (!x || x.w.kind !== 'hand') return ['this match is not waiting for a result'];
    const bad = handProblems(r, bo);
    if (bad.length) return bad;
    const [head, ...rest] = handGames(x.w, r, bo, this.setup?.next);
    for (const g of rest) this.known.set(gameKey(x.w.job.a.name, x.w.job.b.name, g.seed, g.first), g);
    this.waits.delete(id);
    this.changed();
    x.resolve(head!);
    return [];
  }

  /** Reject every waiting game (and any asked for later) with `err`. */
  stop(err: unknown) {
    this.stoppedWith = err;
    const all = [...this.waits.values()];
    this.waits.clear();
    if (all.length) this.changed();
    for (const x of all) x.reject(err);
  }

  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => void this.subs.delete(fn);
  };
  private changed() {
    this.version++;
    for (const f of [...this.subs]) f();
  }
}

// ---------------------------------------------------------------- reading the event

/** A waiting game's match in the event as shown: the match, its round's name and its best-of (null while not shown yet). */
export function waitingMatch(ev: Pick<TourneyEvent, 'rounds' | 'bracket' | 'config'> | null | undefined, w: Pick<WaitingGame, 'job' | 'gi'>): { match: MatchRec; round: string; bestOf: number } | null {
  if (!ev) return null;
  const hit = (m: MatchRec) => m.a === w.job.a.name && m.b === w.job.b.name && m.games.length === w.gi && !m.winner;
  for (const r of ev.rounds) for (const m of r.matches) if (hit(m)) return { match: m, round: `Round ${r.round}`, bestOf: m.bestOf ?? ev.config?.bestOf ?? 3 };
  for (const r of ev.bracket) for (const m of r.matches) if (hit(m)) return { match: m, round: r.name, bestOf: m.bestOf ?? ev.config?.bestOf ?? 3 };
  return null;
}

/** The games of an event that a person decided (played here or recorded by hand). */
export function personGames(ev: Pick<TourneyEvent, 'rounds' | 'bracket'>): number {
  let n = 0;
  for (const part of [...ev.rounds, ...ev.bracket]) for (const m of part.matches) for (const g of m.games) if (g.by) n++;
  return n;
}

/** A match's results were recorded by hand. */
export const byHand = (m: { games?: readonly { by?: string }[] }) => !!m.games?.some((g) => g.by === 'hand');
/** A match you played on the board. */
export const byYou = (m: { games?: readonly { by?: string }[] }) => !!m.games?.some((g) => g.by === 'you');

// ---------------------------------------------------------------- the runner's saved runs

/**
 * The runs kept in this browser after `saved` is stored: `saved` first, then the others in their order, `max` in all.
 * An unfinished played event is kept before any other run (it may hold days of play); with more unfinished played
 * events than room, the oldest of them goes. Without played events this is the newest `max`, as it always was.
 */
export function keepRuns<T extends { id: unknown; phase?: string; setup?: unknown }>(saved: T, others: readonly T[], max: number): T[] {
  const rest = others.filter((r) => r.id !== saved.id);
  const room = Math.max(0, max - 1);
  const pick = new Set<T>();
  for (const r of rest) if (pick.size < room && r.phase !== 'done' && isPlayedSetup(r.setup)) pick.add(r);
  for (const r of rest) if (pick.size < room) pick.add(r);
  return [saved, ...rest.filter((r) => pick.has(r))];
}
