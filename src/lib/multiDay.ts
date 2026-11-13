// Multi-day games (features.multiDayGames): games kept until they are finished, played whenever you like over 3 to 20
// days (the site config's multiDay range).
//
// Against the bot: an ordinary practice game (src/lib/practiceSession.ts) whose save (src/lib/savedGames.ts: setup +
// seeds + your answers + the position check) is kept in its own list, not in the autosave, so the next quick game never
// replaces it. Resuming replays it exactly like a saved game (and refuses one from other code the same way). Its
// deadline is the start plus its length; once the deadline passes the game is not deleted: it is marked "time is up"
// and you choose to finish it anyway (recorded as usual, marked late) or to close it as a timed-out loss.
//
// Against a person: src/net/corr.ts (turn packets). This module lists both kinds together (OngoingItem, sortOngoing)
// and reads and writes the one-game export file (`kind: 'nct-ongoing-game'`, schema 1). Pure apart from the storage
// helpers, which are wrapped (blocked storage only hides the feature). Time is always passed in.
import { CORR_KIND, clockState, corrStatus, spanText, deadlineOf, type CorrGame } from '../net/corr';
import { BOT_GAMES_KEY, ongoingChanged } from './ongoingBadge';
import type { MultiDayMark, PracticeGame } from './practiceLog';
import type { PracticeReplay } from './practiceReplays';
import { parseSavedGame, replayOf, versionProblem, type SavedGame } from './savedGames';

export const DAY_MS = 86_400_000;
export const BOT_MD_KIND = 'nct-multiday-bot';
export const ONGOING_FILE_KIND = 'nct-ongoing-game';
export const ONGOING_FILE_SCHEMA = 1;
export { spanText };

/** One multi-day game against the bot. */
export interface BotMultiDay {
  kind: typeof BOT_MD_KIND;
  schema: 1;
  /** the practice replay's id (the game is recorded under it once) */
  id: string;
  days: number;
  /** ISO times */
  created: string;
  deadline: string;
  lastPlayed: string;
  /** you went first (known from the first decision) */
  wentFirst?: boolean;
  /** the deadline passed and you chose to finish it anyway */
  late?: boolean;
  /** the game as a save: replayed to resume it */
  save: SavedGame;
}

/** The deadline of a game started at `created` that lasts `days`. */
export const deadlineFrom = (created: number, days: number) => created + days * DAY_MS;

/** A whole number of days within the configured range. */
export function clampDays(n: number, range: { minDays: number; maxDays: number }): number {
  if (!Number.isFinite(n)) return range.minDays;
  return Math.min(range.maxDays, Math.max(range.minDays, Math.round(n)));
}

/** The game's deadline has passed and you have not chosen to finish it anyway. */
export const botExpired = (e: BotMultiDay, now: number) => !e.late && now > Date.parse(e.deadline);

/** A new entry for a game that has reached its first decision. */
export function newBotEntry(o: { save: SavedGame; days: number; created: number; now: number; wentFirst?: boolean }): BotMultiDay {
  return {
    kind: BOT_MD_KIND,
    schema: 1,
    id: o.save.replayId,
    days: o.days,
    created: new Date(o.created).toISOString(),
    deadline: new Date(deadlineFrom(o.created, o.days)).toISOString(),
    lastPlayed: new Date(o.now).toISOString(),
    ...(o.wentFirst !== undefined ? { wentFirst: o.wentFirst } : {}),
    save: o.save,
  };
}

/** What the running game knows of its multi-day settings (src/ui/usePracticeGame.ts MultiDayRun). */
export interface BotMultiDayRun {
  days: number;
  /** epoch ms */
  created: number;
  deadline: number;
  late: boolean;
  wentFirst?: boolean;
}

/** The stored entry of a running multi-day game at its latest save (its start and deadline never move). */
export function botEntry(m: BotMultiDayRun, save: SavedGame, now: number): BotMultiDay {
  return {
    kind: BOT_MD_KIND,
    schema: 1,
    id: save.replayId,
    days: m.days,
    created: new Date(m.created).toISOString(),
    deadline: new Date(m.deadline).toISOString(),
    lastPlayed: new Date(now).toISOString(),
    ...(m.wentFirst !== undefined ? { wentFirst: m.wentFirst } : {}),
    ...(m.late ? { late: true } : {}),
    save,
  };
}

/** The mark a finished multi-day bot game is recorded with. */
export const botMark = (e: Pick<BotMultiDay, 'days' | 'late'>): MultiDayMark => ({ days: e.days, ...(e.late ? { late: true } : {}) });

export const TIMED_OUT_REASON = 'Time ran out (multi-day game)';

/**
 * Close an expired game as a timed-out loss: the practice-log entry and a replay that stops where the game stopped (the
 * Game review replays your answers to there, like a conceded game).
 */
export function timedOutRecords(e: BotMultiDay, now: number): { entry: PracticeGame; replay: PracticeReplay } {
  const s = e.save;
  const mark: MultiDayMark = { days: e.days, timedOut: true };
  const replay: PracticeReplay = { ...replayOf(s), choices: s.choices.map((c) => [...c]), result: 'loss', conceded: true, multiDay: mark };
  const entry: PracticeGame = {
    id: s.replayId,
    date: new Date(now).toISOString(),
    deck: s.decks[0].name,
    opp: s.decks[1].name,
    level: s.botLevel,
    result: 'loss',
    first: !!e.wentFirst,
    turns: s.turn,
    reason: `${TIMED_OUT_REASON}: ${e.days} days`,
    gigs: [s.gigs[0], s.gigs[1]],
    multiDay: mark,
  };
  return { entry, replay };
}

// ---------------------------------------------------------------- reading

const isStr = (x: unknown): x is string => typeof x === 'string';

/** A stored or imported bot game, or why it is not one. Never throws. */
export function parseBotMultiDay(x: unknown): { ok: true; value: BotMultiDay } | { ok: false; why: string } {
  const e = x as Partial<BotMultiDay> | null;
  if (!e || typeof e !== 'object' || e.kind !== BOT_MD_KIND) return { ok: false, why: 'This is not a multi-day game against the bot.' };
  if (e.schema !== 1) return { ok: false, why: `This game's format (${String(e.schema)}) can't be read here.` };
  const bad = (what: string) => ({ ok: false as const, why: `This multi-day game is damaged: ${what}.` });
  if (!isStr(e.id) || !Number.isInteger(e.days) || (e.days as number) < 1 || (e.days as number) > 366) return bad('its length is missing');
  if (!isStr(e.created) || !isStr(e.deadline) || !isStr(e.lastPlayed) || !Number.isFinite(Date.parse(e.deadline)) || !Number.isFinite(Date.parse(e.created))) return bad('its dates are missing');
  if (e.wentFirst !== undefined && typeof e.wentFirst !== 'boolean') return bad('who went first is unreadable');
  if (e.late !== undefined && typeof e.late !== 'boolean') return bad('its late mark is unreadable');
  const s = parseSavedGame(e.save);
  if (!s.ok) return { ok: false, why: s.why };
  if (s.value.replayId !== e.id) return bad('its save belongs to another game');
  return {
    ok: true,
    value: {
      kind: BOT_MD_KIND,
      schema: 1,
      id: e.id,
      days: e.days as number,
      created: e.created,
      deadline: e.deadline,
      lastPlayed: e.lastPlayed,
      ...(e.wentFirst !== undefined ? { wentFirst: e.wentFirst } : {}),
      ...(e.late ? { late: true } : {}),
      save: s.value,
    },
  };
}

export function parseBotList(raw: string | null): BotMultiDay[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.flatMap((x) => {
      const r = parseBotMultiDay(x);
      return r.ok ? [r.value] : [];
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- the list shown on the Play setup screen

export interface OngoingItem {
  key: string;
  type: 'bot' | 'pvp';
  id: string;
  /** a game against a person: your side (both sides may be kept in one browser) */
  role?: 'host' | 'guest';
  /** "Deck vs Deck" */
  title: string;
  /** "Hard bot", or "vs Ana (you host)" */
  against: string;
  turn: number;
  gigs: [number, number];
  /** waiting for you (your move, or a claim you can make) */
  yourMove: boolean;
  status: string;
  lastPlayed: number;
  /** when the game (bot) or the player on move (person) runs out of time; null when no clock runs */
  deadline: number | null;
  /** the time is up: the bot game's deadline passed, or a person's clock ran out */
  expired: boolean;
  /** the bot game can't be resumed on this version of the app */
  stale?: string;
  over?: boolean;
}

export function botItem(e: BotMultiDay, now: number, tierName: (level: string) => string): OngoingItem {
  const expired = botExpired(e, now);
  const stale = versionProblem(e.save);
  return {
    key: `bot:${e.id}`,
    type: 'bot',
    id: e.id,
    title: `${e.save.decks[0].name} vs ${e.save.decks[1].name}`,
    against: `${tierName(e.save.botLevel)} bot`,
    turn: e.save.turn,
    gigs: [e.save.gigs[0], e.save.gigs[1]],
    yourMove: true,
    status: stale ? 'Made with another version: it can be read, not resumed' : expired ? 'The deadline passed: finish it late, or close it as a loss on time' : e.late ? 'Your move (finishing late)' : 'Your move',
    lastPlayed: Date.parse(e.lastPlayed) || 0,
    deadline: e.late ? null : Date.parse(e.deadline),
    expired,
    ...(stale ? { stale } : {}),
  };
}

export function corrItem(g: CorrGame, now: number): OngoingItem {
  const c = clockState(g, now);
  return {
    key: `pvp:${g.id}:${g.role}`,
    type: 'pvp',
    id: g.id,
    role: g.role,
    title: `${g.myDeck.name} vs ${g.rivalDeck ?? '?'}`,
    against: `vs ${g.rival ?? 'a person'} (${g.role === 'host' ? 'you host' : 'you joined'})`,
    turn: g.summary.turn,
    gigs: [g.summary.gigs[0], g.summary.gigs[1]],
    yourMove: g.stage !== 'over' && (g.summary.yourMove || c.canClaim),
    status: corrStatus(g, now),
    lastPlayed: Date.parse(g.lastPlayed) || 0,
    deadline: g.stage === 'playing' ? deadlineOf(g.clock) : null,
    expired: c.late,
    ...(g.stage === 'over' || g.stage === 'refused' ? { over: true } : {}),
  };
}

/** Your move first, then the soonest deadline, then the most recently played; finished games last. */
export function sortOngoing(items: readonly OngoingItem[]): OngoingItem[] {
  return [...items].sort((a, b) => {
    if (!!a.over !== !!b.over) return a.over ? 1 : -1;
    if (a.yourMove !== b.yourMove) return a.yourMove ? -1 : 1;
    const da = a.deadline ?? Infinity;
    const db = b.deadline ?? Infinity;
    if (da !== db) return da - db;
    return b.lastPlayed - a.lastPlayed;
  });
}

/** "4 days 3 h left", "Time is up", or '' when no clock runs. */
export function timeLeftText(item: Pick<OngoingItem, 'deadline' | 'expired'>, now: number): string {
  if (item.deadline === null) return '';
  const left = item.deadline - now;
  return left <= 0 ? 'Time is up' : `${spanText(left)} left`;
}

// ---------------------------------------------------------------- one game as a file (to move it to another device)

export type OngoingGame = { type: 'bot'; game: BotMultiDay } | { type: 'pvp'; game: CorrGame };

export function ongoingFileText(g: OngoingGame, exported: string): string {
  return JSON.stringify({ kind: ONGOING_FILE_KIND, schema: ONGOING_FILE_SCHEMA, exported, game: g.game }, null, 1);
}

export function ongoingFileName(g: OngoingGame, exported: string): string {
  const slug = (x: string) => x.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
  const title = g.type === 'bot' ? `${g.game.save.decks[0].name}-vs-${g.game.save.decks[1].name}` : `${g.game.myDeck.name}-vs-${g.game.rival ?? 'rival'}`;
  return `nct-multiday-${slug(title)}-${exported.slice(0, 10)}.json`;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; why: string };

/**
 * A one-game file read back, or why it is not one. Never throws. A game against a person is checked by `parseCorr`
 * (src/net/corrStore.ts parseCorrGame, loaded with the game code); without it such a file is refused.
 */
export function parseOngoingFile(text: string, parseCorr?: (x: unknown) => Parsed<CorrGame>): Parsed<OngoingGame> {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { ok: false, why: 'This file is not an ongoing game (it is not JSON).' };
  }
  const f = v as { kind?: unknown; schema?: unknown; game?: { kind?: unknown } } | null;
  if (!f || typeof f !== 'object' || f.kind !== ONGOING_FILE_KIND) return { ok: false, why: 'This file is not an ongoing multi-day game.' };
  if (f.schema !== ONGOING_FILE_SCHEMA) return { ok: false, why: `This file's format (${String(f.schema)}) can't be read here.` };
  if (f.game?.kind === BOT_MD_KIND) {
    const r = parseBotMultiDay(f.game);
    return r.ok ? { ok: true, value: { type: 'bot', game: r.value } } : r;
  }
  if (f.game?.kind === CORR_KIND) {
    if (!parseCorr) return { ok: false, why: 'This file holds a game against a person; it could not be checked here.' };
    const r = parseCorr(f.game);
    return r.ok ? { ok: true, value: { type: 'pvp', game: r.value } } : r;
  }
  return { ok: false, why: 'This file holds no game this version knows.' };
}

// ---------------------------------------------------------------- storage (this browser)

type KV = Pick<Storage, 'getItem' | 'setItem'>;
function localKV(): KV | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadBotGames(kv: KV | null = localKV()): BotMultiDay[] {
  try {
    return parseBotList(kv?.getItem(BOT_GAMES_KEY) ?? null);
  } catch {
    return [];
  }
}

/** Add or replace a bot game (by id); null when written, else why not. */
export function writeBotGame(e: BotMultiDay, kv: KV | null = localKV()): string | null {
  try {
    if (!kv) return 'This browser does not let the page store data.';
    const list = loadBotGames(kv).filter((x) => x.id !== e.id);
    list.push(e);
    kv.setItem(BOT_GAMES_KEY, JSON.stringify(list));
    ongoingChanged();
    return null;
  } catch {
    return 'This browser refused to store the game (storage is full or blocked).';
  }
}

export function removeBotGame(id: string, kv: KV | null = localKV()) {
  try {
    kv?.setItem(BOT_GAMES_KEY, JSON.stringify(loadBotGames(kv).filter((x) => x.id !== id)));
    ongoingChanged();
  } catch {
    /* storage blocked */
  }
}

/** Why another multi-day game can't be added (the cap counts games not yet over, of both kinds), or null. */
export function capProblem(counts: { bot: number; pvp: number }, cap: number): string | null {
  const n = counts.bot + counts.pvp;
  return n >= cap ? `You have ${n} ongoing multi-day games, the most this site keeps (${cap}). Finish or delete one first.` : null;
}
