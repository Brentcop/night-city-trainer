// A multi-day game against a person, played by sending turn packets (src/net/packet.ts) instead of over a live link:
// the record each device keeps of one game, its clock, the list of these games in this browser, and the export file.
// Plain data only (no engine code here, so the Play setup screen can list the games without loading the game code);
// the game itself runs in src/net/corrSession.ts.
//
// The full check of a stored or imported game, and the store the game code uses, are in corrStore.ts (they need the
// protocol's readers); this file stays light so the Play setup screen can list the games.
//
// The host's device runs the real game (HostGame, as in live online play) and keeps its save (setup + seed + both seats'
// answers); the guest's device keeps only what viewFor showed it, its decision now waiting and the log. There is no
// server: a game cannot wait online for an absent player, so the players carry the packets themselves.
//
// The clock: a chess clock in days. Each player has half the game's length (a 7-day game: 3½ days each); a player's
// clock runs from the moment the rival's packet was made (its stamp) until they make theirs. The stamps come from each
// device's own clock, so nothing is automatic: when a clock runs out, the other player may claim the win or give more
// time.
import type { Decision, DeckList, GameState } from '../engine/types';
import { BOT_GAMES_KEY, CORR_GAMES_KEY, ongoingChanged } from '../lib/ongoingBadge';
import type { EndWhy, HostSave } from './hostGame';
import type { GameRecordMsg } from './protocol';
import type { Side } from './packet';

export const CORR_KIND = 'nct-corr-game';
export const CORR_SCHEMA = 1;
export const DAY_MS = 86_400_000;
/** chat lines kept per game */
export const CORR_CHAT_KEEP = 200;
export { BOT_GAMES_KEY, CORR_GAMES_KEY };

export interface CorrClock {
  /** each player's time for the whole game (ms): half the game's length */
  bank: number;
  /** time used so far, by engine seat (0 host, 1 guest) */
  used: [number, number];
  /** extra time given, by engine seat */
  extra: [number, number];
  /** when the clock of the player on move started (the stamp of the last packet), or null before the game */
  since: number | null;
  /** whose clock runs (engine seat), or null */
  onMove: 0 | 1 | null;
}

export interface ChainLink {
  n: number;
  m: string;
  f: Side;
}

export type CorrStage = 'invited' | 'joined' | 'playing' | 'over' | 'refused';

export interface CorrEnd {
  result: 'win' | 'loss' | 'draw';
  reason: string;
  why: EndWhy;
  /** who ended it: true you (conceded, or ran out of time), false the rival, null nobody */
  byMe: boolean | null;
  /** the practice-log entry is written */
  recorded: boolean;
  /** the replay for the Game review is written (the guest gets the record from the host's last packet) */
  replay: boolean;
}

export interface CorrGame {
  kind: typeof CORR_KIND;
  schema: typeof CORR_SCHEMA;
  /** the game id (16 hex), in every packet */
  id: string;
  role: 'host' | 'guest';
  me: string;
  rival: string | null;
  myDeck: DeckList;
  rivalDeck: string | null;
  days: number;
  /** ISO times */
  created: string;
  lastPlayed: string;
  stage: CorrStage;
  /** each side's half of the game key (hex) */
  keys: { host: string; guest: string | null };
  /** my roll secret, and whether I go first if the roll picks me */
  nonce: string;
  prefFirst: boolean;
  /** the guest's payment and effect-order choices are answered the automatic way by the host */
  auto: boolean;
  /** the last packet of the game's chain (sent or received), and the one before it */
  head: ChainLink | null;
  prevHead: ChainLink | null;
  /** the last packet I made, to send (again) */
  outbox: { n: number; code: string; made: string } | null;
  clock: CorrClock;
  chat: { from: 'me' | 'rival' | 'system'; text: string; at: number }[];
  /** my chat lines waiting to ride in my next packet */
  unsent: string[];
  /** extra time I gave the rival (ms), still to send in my next packet */
  grantOwed: number;
  /** for the list */
  summary: { turn: number; gigs: [number, number]; yourMove: boolean; reaction: boolean };
  end: CorrEnd | null;
  /** why the game can't go on here (a packet that did not fit, a replay that failed) */
  problem: string | null;
  /** once the game is over: this side's last view (you are player 0), and the full record (the guest gets it from the host) */
  finalView: GameState | null;
  record: GameRecordMsg | null;
  host?: {
    save: HostSave | null;
    /** the last view sent to the guest (log left out) and how many log lines it had seen */
    sent: { view: GameState; logLen: number } | null;
    guestDeck: DeckList | null;
    /** the roll was sent (it goes in the first move packet) and who went first (engine seat) */
    rolled: boolean;
    first: 0 | 1 | null;
  };
  guest?: {
    /** the host's commitment to its roll secret (from the invite) */
    commit: string;
    view: GameState | null;
    decision: { seq: number; d: Decision } | null;
    /** whose decision the game waits on: 0 you, 1 the host */
    waiting: 0 | 1 | null;
  };
}

// ---------------------------------------------------------------- the clock

export const newClock = (days: number): CorrClock => ({ bank: Math.round((days * DAY_MS) / 2), used: [0, 0], extra: [0, 0], since: null, onMove: null });

/** The clock after the player in `seat` made a packet stamped `t`: their time stops and the other's starts. */
export function clockPass(c: CorrClock, seat: 0 | 1, t: number, over = false): CorrClock {
  const used: [number, number] = [c.used[0], c.used[1]];
  if (c.since !== null && c.onMove === seat) used[seat] += Math.max(0, t - c.since);
  return { ...c, used, extra: [c.extra[0], c.extra[1]], since: over ? null : t, onMove: over ? null : ((1 - seat) as 0 | 1) };
}

/** Start the clock: `seat` is on move from `t`. */
export const clockStart = (c: CorrClock, seat: 0 | 1, t: number): CorrClock => ({ ...c, used: [c.used[0], c.used[1]], extra: [c.extra[0], c.extra[1]], since: t, onMove: seat });

export function clockGrant(c: CorrClock, seat: 0 | 1, ms: number): CorrClock {
  const extra: [number, number] = [c.extra[0], c.extra[1]];
  extra[seat] += ms;
  return { ...c, used: [c.used[0], c.used[1]], extra };
}

/** Time left for `seat` at `now` (ms, may be below 0), counting its running clock if it is on move. */
export function timeLeft(c: CorrClock, seat: 0 | 1, now: number): number {
  const running = c.onMove === seat && c.since !== null ? Math.max(0, now - c.since) : 0;
  return c.bank + c.extra[seat] - c.used[seat] - running;
}

/** When the player on move runs out of time (epoch ms), or null. */
export function deadlineOf(c: CorrClock): number | null {
  if (c.onMove === null || c.since === null) return null;
  return c.since + c.bank + c.extra[c.onMove] - c.used[c.onMove];
}

export const mySeat = (g: CorrGame): 0 | 1 => (g.role === 'host' ? 0 : 1);

/** Where the clock stands for this device's player. */
export function clockState(g: CorrGame, now: number): { onMove: 'me' | 'rival' | null; deadline: number | null; mine: number; theirs: number; late: boolean; canClaim: boolean } {
  const me = mySeat(g);
  const c = g.clock;
  const onMove = g.stage !== 'playing' || c.onMove === null ? null : c.onMove === me ? 'me' : 'rival';
  const deadline = onMove ? deadlineOf(c) : null;
  const late = deadline !== null && now > deadline;
  return { onMove, deadline, mine: timeLeft(c, me, now), theirs: timeLeft(c, (1 - me) as 0 | 1, now), late, canClaim: late && onMove === 'rival' };
}

/** "3 days 4 h", "5 h 12 min", "12 min", "under a minute"; for a negative span "time is up". */
export function spanText(ms: number): string {
  if (ms <= 0) return 'time is up';
  const min = Math.floor(ms / 60_000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d} day${d === 1 ? '' : 's'}${h ? ` ${h} h` : ''}`;
  if (h > 0) return `${h} h${m ? ` ${m} min` : ''}`;
  return m > 0 ? `${m} min` : 'under a minute';
}

// ---------------------------------------------------------------- the list, read lightly

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isPair = (x: unknown): x is [number, number] => Array.isArray(x) && x.length === 2 && x.every((n) => typeof n === 'number' && Number.isFinite(n));

/**
 * The stored games as the Play setup screen lists them: only the fields the list shows are checked (the full check,
 * src/net/corrStore.ts parseCorrGame, runs when a game is opened, with the game code). Never throws.
 */
export function lightCorrList(raw: string | null): CorrGame[] {
  try {
    const v: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(v)) return [];
    return v.filter((g): g is CorrGame => {
      if (!isObj(g) || g.kind !== CORR_KIND || g.schema !== CORR_SCHEMA || typeof g.id !== 'string' || !/^[0-9a-f]{16}$/.test(g.id)) return false;
      if ((g.role !== 'host' && g.role !== 'guest') || typeof g.stage !== 'string' || typeof g.me !== 'string' || typeof g.lastPlayed !== 'string') return false;
      if (!isObj(g.myDeck) || typeof g.myDeck.name !== 'string' || !isObj(g.summary) || !isPair(g.summary.gigs) || typeof g.summary.turn !== 'number') return false;
      const c = g.clock;
      return isObj(c) && typeof c.bank === 'number' && isPair(c.used) && isPair(c.extra) && (c.since === null || typeof c.since === 'number') && (c.onMove === null || c.onMove === 0 || c.onMove === 1);
    });
  } catch {
    return [];
  }
}

function localKV(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** The games against a person in this browser, read lightly (for the list). */
export function listCorrGames(kv = localKV()): CorrGame[] {
  try {
    return lightCorrList(kv?.getItem(CORR_GAMES_KEY) ?? null);
  } catch {
    return [];
  }
}

/** Delete a game from this browser (its rival keeps theirs). */
export function deleteCorrGame(id: string, role: CorrGame['role'], kv = localKV()) {
  try {
    const raw: unknown = JSON.parse(kv?.getItem(CORR_GAMES_KEY) ?? '[]');
    if (!Array.isArray(raw)) return;
    kv?.setItem(CORR_GAMES_KEY, JSON.stringify(raw.filter((g) => !(isObj(g) && g.id === id && g.role === role))));
    ongoingChanged();
  } catch {
    /* storage blocked */
  }
}

/** What the list shows of one game against a person. */
export function corrStatus(g: CorrGame, now: number): string {
  const rival = g.rival ?? 'your rival';
  if (g.stage === 'refused') return g.problem ?? 'The game could not start.';
  if (g.stage === 'over') return g.end ? `Over: ${g.end.result === 'win' ? 'you won' : g.end.result === 'loss' ? 'you lost' : 'a draw'}${g.end.replay ? '' : g.role === 'guest' ? ' (waiting for the full record from the host)' : ''}` : 'Over';
  if (g.stage === 'invited') return `Waiting for ${rival} to join (send the invite)`;
  if (g.stage === 'joined') return `Waiting for ${rival}'s first move (you sent your reply)`;
  const c = clockState(g, now);
  if (c.canClaim) return `${rival}'s time is up: claim the win or give more time`;
  if (g.summary.yourMove) return c.late ? 'Your move — your time is up' : 'Your move';
  return g.summary.reaction ? `Waiting for ${rival}'s reaction` : `Waiting for ${rival}`;
}
