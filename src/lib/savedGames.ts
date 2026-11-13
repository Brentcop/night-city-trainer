// Saved practice games (come back to a game later): the autosave of the game in progress and up to MAX_SLOTS named
// slots, kept in this browser (localStorage), and the same record as an export file (`kind: 'nct-saved-game'`,
// `schema: 1`, plain JSON).
//
// A save is the smallest thing that restores exactly: the match setup (decks, seeds, who goes first, bot tier) and every
// answer you gave. The engine and the bots are deterministic (same code + seed + decks + answers = same game), so
// PracticeSession.restore() replays it from the start without pacing and lands on the same decision with the same hand,
// board, log and bot (same tier and random state); Undo snapshots are rebuilt on the way, so Undo works before the
// resume point too. A save also carries a check: the state hash at the last decision you were asked (when it was
// asked), its prompt and options, and `simVersion`. A save from other bot or engine code (another SIM_VERSION, or a
// replay that no longer reaches the same state) is refused, never resumed into a different game; its log is kept so
// it can still be read. Coach grades are kept as data. Pure apart from the storage helpers at the end (each wrapped,
// so blocked storage only hides the feature).
import { CARD_BY_ID } from '../engine/cards';
import type { DeckList, GameState, LogEntry, PlayerId } from '../engine/types';
import type { CoachedGrade } from './coachedReplay';
import type { PracticeReplay } from './practiceReplays';
import { SIM_VERSION } from './tournament';

export const SAVED_GAME_KIND = 'nct-saved-game';
export const SAVED_GAME_SCHEMA = 1;
/** named save slots kept in this browser (the autosave is separate) */
export const MAX_SLOTS = 5;

/** The decision you were asked at the save's check point, as shown on the board. */
export interface SavedDecision {
  kind: string;
  prompt: string;
  options: string[];
}

/** A position the restore must reach exactly: the decision after `at` of your answers. */
export interface SaveCheck {
  /** how many of your answers came before this decision */
  at: number;
  turn: number;
  /** hash of the game state there (log left out: the log's wording may change without changing the game) */
  hash: string;
  decision: SavedDecision;
}

export interface SavedGame {
  kind: typeof SAVED_GAME_KIND;
  schema: typeof SAVED_GAME_SCHEMA;
  /** 'auto' for the autosave; a slot id otherwise */
  id: string;
  name: string;
  /** when it was saved (ISO) */
  saved: string;
  /** the bots' and engine's version when saved (SIM_VERSION): another version may play differently, so it is refused */
  simVersion: number;
  /** the practice replay this game records into (its id and start date are kept, so a finished game is recorded once) */
  replayId: string;
  started: string;
  decks: [DeckList, DeckList];
  seed: number;
  first?: PlayerId;
  botLevel: string;
  botSeed: number;
  /** you end each turn with End turn even when nothing else is left (absent: automatic, as every save made before it existed) */
  endTurnClick?: boolean;
  /** every answer you gave, in order (may run past `check.at` when you saved while the bot was moving) */
  choices: number[][];
  undos?: number;
  /** coach mode was on */
  coach: boolean;
  /** coach grades so far (with the export record of each) */
  grades: CoachedGrade[];
  check: SaveCheck;
  /** for the list: the turn, and Gigs controlled by you and the bot at the check point */
  turn: number;
  gigs: [number, number];
  /** the game log at the save (so a save that can no longer be resumed can still be read) */
  log: LogEntry[];
}

/** FNV-1a 32 of a string, twice with different seeds: 16 hex digits. */
function hash64(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
    b ^= b >>> 15;
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

/** The state a save checks: everything but the log and the trace. */
export function stateHash(st: GameState): string {
  const { log: _log, trace: _trace, ...rest } = st;
  return hash64(JSON.stringify(rest));
}

/** What the session knows about the game being saved (src/lib/practiceSession.ts Running). */
export interface SaveSource {
  replay: PracticeReplay;
  grades: readonly CoachedGrade[];
  /** the last decision you were asked (null before the first) */
  stable: (SaveCheck & { gigs: [number, number] }) | null;
  log: readonly LogEntry[];
}

/** "Deck vs Deck, turn N". */
export const defaultSaveName = (s: { decks: [DeckList, DeckList]; turn: number }) => `${s.decks[0].name} vs ${s.decks[1].name}, turn ${s.turn}`;

/** A save of the game, or null when there is no decision to come back to yet. Deep-copied: later play doesn't change it. */
export function buildSave(src: SaveSource, o: { id: string; name?: string; saved: string; coach: boolean }): SavedGame | null {
  const st = src.stable;
  if (!st) return null;
  const r = src.replay;
  const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  const base = { decks: r.decks, turn: st.turn };
  return {
    kind: SAVED_GAME_KIND,
    schema: SAVED_GAME_SCHEMA,
    id: o.id,
    name: (o.name ?? '').trim() || defaultSaveName(base),
    saved: o.saved,
    simVersion: SIM_VERSION,
    replayId: r.id,
    started: r.date,
    decks: copy(r.decks),
    seed: r.seed,
    ...(r.first !== undefined ? { first: r.first } : {}),
    botLevel: r.botLevel,
    botSeed: r.botSeed,
    ...(r.endTurnClick ? { endTurnClick: true } : {}),
    choices: copy(r.choices),
    ...(r.undos ? { undos: r.undos } : {}),
    coach: o.coach,
    grades: copy([...src.grades]),
    check: { at: st.at, turn: st.turn, hash: st.hash, decision: copy(st.decision) },
    turn: st.turn,
    gigs: [st.gigs[0], st.gigs[1]],
    log: src.log.map((e) => ({ turn: e.turn, player: e.player, text: e.text })),
  };
}

/** The practice replay a restored game records into (choices are re-recorded by the replay). */
export function replayOf(s: SavedGame): PracticeReplay {
  return {
    id: s.replayId,
    date: s.started,
    decks: s.decks,
    seed: s.seed,
    ...(s.first !== undefined ? { first: s.first } : {}),
    botLevel: s.botLevel,
    botSeed: s.botSeed,
    choices: [],
    payChoice: true,
    orderChoice: true,
    ...(s.endTurnClick ? { endTurnClick: true } : {}),
    result: 'draw',
    ...(s.undos ? { undos: s.undos } : {}),
  };
}

/**
 * Coach grades as restored: a grade whose scoring was still running when saved can't finish now, so it is unscored; so
 * is an older save's 'agree' with a choice the coach made by rule (a target, a Gig pick, the mulligan), which measured
 * nothing (the coach grades those 'unscored' since 2026-11-13, src/ai/coach.ts gradeMove).
 */
export function restoredGrades(s: SavedGame): CoachedGrade[] {
  return s.grades.map((g) => {
    const ruleAgree = g.verdict === 'agree' && !!g.record && g.record.kind !== undefined && g.record.kind !== 'action' && g.record.kind !== 'reaction' && g.record.scoreKind === undefined;
    if (g.verdict !== 'pending' && !ruleAgree) return { ...g };
    return { ...g, verdict: 'unscored', gap: null, ...(g.record ? { record: { ...g.record, verdict: 'unscored', gap: null } } : {}) };
  });
}

/** Why this code can't resume the save before even trying (another bot/engine version), or null. */
export function versionProblem(s: SavedGame): string | null {
  if (s.simVersion === SIM_VERSION) return null;
  return `It was saved with version ${s.simVersion} of the bots and rules engine, and this is version ${SIM_VERSION}: the game would not play on the same way.`;
}

/** Said when the replay doesn't reach the saved position. */
export const MISMATCH_WHY = 'On this version of the app the saved moves no longer lead to the same position (the rules engine or the bot changed since it was saved).';

// ------------------------------------------------------------------ validation

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isInt = (x: unknown): x is number => Number.isInteger(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.every(isStr);

function deckProblem(x: unknown): string | null {
  const d = x as DeckList | null;
  if (!d || typeof d !== 'object' || !isStr(d.name) || !isStrArr(d.legends) || !isStrArr(d.main) || (d.sideboard !== undefined && !isStrArr(d.sideboard))) return 'a deck is incomplete';
  const unknown = [...d.legends, ...d.main].find((id) => !CARD_BY_ID[id]);
  return unknown ? `the deck "${d.name}" has a card this app doesn't know (${unknown})` : null;
}

function isGrade(x: unknown): x is CoachedGrade {
  const g = x as CoachedGrade | null;
  return !!g && typeof g === 'object' && isNum(g.turn) && isStr(g.chose) && isStr(g.coach) && (g.gap === null || isNum(g.gap)) && isStr(g.verdict) && (g.record === undefined || (typeof g.record === 'object' && g.record !== null && isNum(g.record.at)));
}

const isLog = (x: unknown): x is LogEntry[] =>
  Array.isArray(x) && x.every((e) => !!e && typeof e === 'object' && isNum((e as LogEntry).turn) && isStr((e as LogEntry).text) && ((e as LogEntry).player === null || (e as LogEntry).player === 0 || (e as LogEntry).player === 1));

/** A save read back (from storage or a file), or why it is not one. Never throws. */
export function parseSavedGame(input: unknown): { ok: true; value: SavedGame } | { ok: false; why: string } {
  let v = input;
  if (typeof input === 'string') {
    try {
      v = JSON.parse(input);
    } catch {
      return { ok: false, why: 'This file is not a saved game (it is not JSON).' };
    }
  }
  const s = v as Partial<SavedGame> | null;
  if (!s || typeof s !== 'object' || s.kind !== SAVED_GAME_KIND) return { ok: false, why: 'This file is not a saved game.' };
  if (!isInt(s.schema) || s.schema > SAVED_GAME_SCHEMA) return { ok: false, why: `This saved game was made by a newer version of the app (save format ${String(s.schema)}; this version reads format ${SAVED_GAME_SCHEMA}). Update the app to open it.` };
  if (s.schema !== SAVED_GAME_SCHEMA) return { ok: false, why: `This saved game's format (${String(s.schema)}) can't be read here.` };
  const bad = (what: string) => ({ ok: false as const, why: `This saved game is damaged: ${what}.` });
  if (!isStr(s.id) || !isStr(s.name) || !isStr(s.saved) || !isStr(s.replayId) || !isStr(s.started)) return bad('its name or dates are missing');
  if (!isInt(s.simVersion)) return bad('its version is missing');
  if (!Array.isArray(s.decks) || s.decks.length !== 2) return bad('the decks are missing');
  for (const d of s.decks) {
    const p = deckProblem(d);
    if (p) return bad(p);
  }
  if (!isInt(s.seed) || !isInt(s.botSeed) || !isStr(s.botLevel) || (s.first !== undefined && s.first !== 0 && s.first !== 1)) return bad('the match setup is incomplete');
  if (!Array.isArray(s.choices) || !s.choices.every((c) => Array.isArray(c) && c.length > 0 && c.every((i) => isInt(i) && i >= 0))) return bad('the moves are incomplete');
  if (s.undos !== undefined && !isInt(s.undos)) return bad('the Undo count is not a number');
  if (s.endTurnClick !== undefined && typeof s.endTurnClick !== 'boolean') return bad('the End turn setting is not true or false');
  if (typeof s.coach !== 'boolean') return bad('the coach setting is missing');
  if (!Array.isArray(s.grades) || !s.grades.every(isGrade)) return bad('the coach grades are incomplete');
  const c = s.check;
  if (!c || typeof c !== 'object' || !isInt(c.at) || c.at < 0 || c.at > s.choices.length || !isInt(c.turn) || !isStr(c.hash) || !c.decision || !isStr(c.decision.kind) || !isStr(c.decision.prompt) || !isStrArr(c.decision.options))
    return bad('the position check is incomplete');
  if (!isInt(s.turn) || !Array.isArray(s.gigs) || s.gigs.length !== 2 || !s.gigs.every(isInt)) return bad('the turn or Gig count is missing');
  if (!isLog(s.log)) return bad('the log is incomplete');
  const decks = s.decks.map((d) => ({ ...d, sideboard: d.sideboard ?? [] })) as [DeckList, DeckList];
  return { ok: true, value: { ...(s as SavedGame), decks } };
}

/** A file name for an exported save. */
export function saveFileName(s: SavedGame): string {
  const slug = (x: string) => x.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return `nct-save-${slug(s.decks[0].name)}-vs-${slug(s.decks[1].name)}-turn${s.turn}-${s.saved.slice(0, 10)}.json`;
}

/** The export file's text (the slot's id is kept; an import gets a fresh one). */
export const saveFileText = (s: SavedGame) => JSON.stringify(s, null, 1);

// ------------------------------------------------------------------ storage (this browser)

const AUTO_KEY = 'nct.autosave.v1';
const SLOTS_KEY = 'nct.savedGames.v1';

/** True when this browser lets the page store data (private modes and blocked site data may not). */
export function storageWorks(): boolean {
  try {
    const k = 'nct.storageTest';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/** The game in progress, saved automatically, or null. */
export function loadAutosave(): SavedGame | null {
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    if (!raw) return null;
    const r = parseSavedGame(raw);
    return r.ok ? r.value : null;
  } catch {
    return null;
  }
}

/** Write the autosave; false if storage refused it. */
export function writeAutosave(s: SavedGame): boolean {
  try {
    localStorage.setItem(AUTO_KEY, JSON.stringify({ ...s, id: 'auto' }));
    return true;
  } catch {
    return false;
  }
}

export function clearAutosave() {
  try {
    localStorage.removeItem(AUTO_KEY);
  } catch {
    /* storage blocked */
  }
}

/** The named saves, oldest first (unreadable entries are skipped). */
export function loadSlots(): SavedGame[] {
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (!raw) return [];
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.flatMap((x) => {
      const r = parseSavedGame(x);
      return r.ok ? [r.value] : [];
    });
  } catch {
    return [];
  }
}

function writeSlots(list: SavedGame[]): string | null {
  try {
    localStorage.setItem(SLOTS_KEY, JSON.stringify(list));
    return null;
  } catch {
    return 'This browser refused to store the save (storage is full or blocked).';
  }
}

let slotSeq = 0;
export const newSlotId = () => `s${Date.now().toString(36)}${(slotSeq++ % 1296).toString(36)}`;

/** Add a named save. Refused (with the reason) when every slot is in use: a save is never overwritten silently. */
export function addSlot(s: SavedGame): { ok: true; list: SavedGame[] } | { ok: false; why: string } {
  const list = loadSlots();
  if (list.length >= MAX_SLOTS) return { ok: false, why: `All ${MAX_SLOTS} save slots are in use. Delete one first.` };
  const id = s.id === 'auto' || list.some((x) => x.id === s.id) ? newSlotId() : s.id;
  const next = [...list, { ...s, id }];
  const err = writeSlots(next);
  return err ? { ok: false, why: err } : { ok: true, list: next };
}

export function renameSlot(id: string, name: string): SavedGame[] {
  const list = loadSlots().map((x) => (x.id === id && name.trim() ? { ...x, name: name.trim() } : x));
  writeSlots(list);
  return list;
}

export function deleteSlot(id: string): SavedGame[] {
  const list = loadSlots().filter((x) => x.id !== id);
  writeSlots(list);
  return list;
}
