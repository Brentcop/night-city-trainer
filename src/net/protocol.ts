// The online game's messages (src/net/): versioned (`v`), plain JSON, and checked on receipt. parseMessage() returns a
// fresh object built only from the fields it checked (every string and list is length-capped, every number checked),
// or null with the reason: a malformed message is dropped and logged, never acted on. Which messages are legal at a
// given moment (an answer to the decision actually waiting, a reveal after a commit…) is the session's check.
import type { CardInst, Decision, DecisionKind, GameState, LogEntry, PlayerId, Zone } from '../engine/types';

export const PROTOCOL_VERSION = 1;

/** Length caps, in characters or items. */
export const CAPS = {
  /** a whole message from the guest (the largest is the hello with a deck list) */
  guestMessage: 20_000,
  /** a whole message from the host (a view of the board) */
  hostMessage: 1_500_000,
  name: 30,
  deckName: 80,
  cardId: 80,
  legends: 5,
  main: 60,
  sideboard: 15,
  chat: 300,
  why: 300,
  token: 64,
  gameId: 40,
  hex: 64,
  prompt: 400,
  label: 300,
  options: 500,
  key: 60,
  cards: 1_000,
  zone: 400,
  mods: 600,
  log: 300,
  logText: 600,
  turnEvents: 400,
  record: 2_000,
} as const;

export interface DeckMsg {
  name: string;
  legends: string[];
  main: string[];
  sideboard: string[];
}

/** The record a guest may ask for once the game is over: enough to replay and review it. */
export interface GameRecordMsg {
  game: string;
  seed: number;
  first: PlayerId;
  decks: [DeckMsg, DeckMsg];
  /** each seat's answers, in engine seat order (the host is seat 0) */
  answers: [number[][], number[][]];
}

export type GuestMsg =
  | { v: 1; t: 'hello'; name: string; deck: DeckMsg; resume?: { game: string; token: string } }
  | { v: 1; t: 'commit'; h: string }
  | { v: 1; t: 'reveal'; n: string }
  | { v: 1; t: 'first'; first: boolean }
  | { v: 1; t: 'answer'; seq: number; i: number }
  | { v: 1; t: 'chat'; text: string }
  | { v: 1; t: 'ping'; at: number }
  | { v: 1; t: 'pong'; at: number }
  | { v: 1; t: 'concede' }
  | { v: 1; t: 'rematch' }
  | { v: 1; t: 'record' }
  | { v: 1; t: 'leave' };

export interface ViewMsg {
  v: 1;
  t: 'view';
  /** bumps with every view sent */
  n: number;
  state: GameState;
  /** your decision now waiting, if any: answer with its seq and an option index */
  decision: { seq: number; d: Decision } | null;
  /** milliseconds left on the turn timer for the decision waiting (either seat's), or null */
  timeLeft: number | null;
  /** whose decision the game is waiting on: 0 you, 1 the rival, null nobody */
  waiting: 0 | 1 | null;
  /** how the game ended (once it has): by whom, 0 you, 1 the rival */
  end: { why: 'finished' | 'conceded' | 'abandoned'; by: 0 | 1 | null } | null;
  /** the game stopped because of an error in the host's browser */
  error: string | null;
}

export type HostMsg =
  | { v: 1; t: 'welcome'; name: string; deckName: string; game: string; token: string; timer: number; resumed: boolean }
  | { v: 1; t: 'refuse'; why: string }
  | { v: 1; t: 'commit'; h: string }
  | { v: 1; t: 'reveal'; n: string }
  | { v: 1; t: 'start'; youFirst: boolean }
  | ViewMsg
  | { v: 1; t: 'reject'; why: string }
  | { v: 1; t: 'chat'; text: string }
  | { v: 1; t: 'ping'; at: number }
  | { v: 1; t: 'pong'; at: number }
  | { v: 1; t: 'rematch' }
  | { v: 1; t: 'record'; record: GameRecordMsg }
  | { v: 1; t: 'leave' };

export type Parsed<T> = { ok: true; msg: T } | { ok: false; why: string };

export const encode = (m: GuestMsg | HostMsg): string => JSON.stringify(m);

// ---------------------------------------------------------------- field checks

class Bad extends Error {}
const fail = (why: string): never => {
  throw new Bad(why);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const obj = (v: unknown, what: string): Record<string, unknown> => (isObj(v) ? v : fail(`${what} is not an object`));
function str(v: unknown, what: string, max: number, o: { empty?: boolean } = {}): string {
  if (typeof v !== 'string') return fail(`${what} is not text`);
  if (v.length > max) return fail(`${what} is longer than ${max}`);
  if (!o.empty && !v.length) return fail(`${what} is empty`);
  return v;
}
function int(v: unknown, what: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) return fail(`${what} is not a whole number from ${min} to ${max}`);
  return v;
}
function num(v: unknown, what: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fail(`${what} is not a number`);
  return v;
}
function bool(v: unknown, what: string): boolean {
  if (typeof v !== 'boolean') return fail(`${what} is not true or false`);
  return v;
}
function list<T>(v: unknown, what: string, max: number, each: (x: unknown, i: number) => T): T[] {
  if (!Array.isArray(v)) return fail(`${what} is not a list`);
  if (v.length > max) return fail(`${what} has more than ${max} items`);
  return v.map(each);
}
const seat = (v: unknown, what: string): PlayerId => (v === 0 || v === 1 ? v : fail(`${what} is not 0 or 1`));
const HEX = /^[0-9a-f]+$/;
const hex = (v: unknown, what: string, len: number) => {
  const s = str(v, what, len);
  return s.length === len && HEX.test(s) ? s : fail(`${what} is not ${len} hex digits`);
};

export function readDeck(v: unknown): DeckMsg {
  const d = obj(v, 'deck');
  const ids = (x: unknown, what: string, max: number) => list(x, what, max, (y, i) => str(y, `${what}[${i}]`, CAPS.cardId));
  return {
    name: str(d.name, 'deck.name', CAPS.deckName),
    legends: ids(d.legends, 'deck.legends', CAPS.legends),
    main: ids(d.main, 'deck.main', CAPS.main),
    sideboard: d.sideboard === undefined ? [] : ids(d.sideboard, 'deck.sideboard', CAPS.sideboard),
  };
}

// ---------------------------------------------------------------- guest → host

export function parseGuestMessage(text: unknown): Parsed<GuestMsg> {
  try {
    if (typeof text !== 'string') return fail('not text');
    if (text.length > CAPS.guestMessage) return fail(`longer than ${CAPS.guestMessage} characters`);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return fail('not JSON');
    }
    const m = obj(raw, 'message');
    if (m.v !== PROTOCOL_VERSION) return fail(`protocol version ${String(m.v)} (this site speaks ${PROTOCOL_VERSION})`);
    const v = 1 as const;
    switch (m.t) {
      case 'hello': {
        const out: GuestMsg = { v, t: 'hello', name: str(m.name, 'name', CAPS.name), deck: readDeck(m.deck) };
        if (m.resume !== undefined) {
          const r = obj(m.resume, 'resume');
          out.resume = { game: str(r.game, 'resume.game', CAPS.gameId), token: str(r.token, 'resume.token', CAPS.token) };
        }
        return { ok: true, msg: out };
      }
      case 'commit':
        return { ok: true, msg: { v, t: 'commit', h: hex(m.h, 'h', 64) } };
      case 'reveal':
        return { ok: true, msg: { v, t: 'reveal', n: hex(m.n, 'n', 32) } };
      case 'first':
        return { ok: true, msg: { v, t: 'first', first: bool(m.first, 'first') } };
      case 'answer':
        return { ok: true, msg: { v, t: 'answer', seq: int(m.seq, 'seq'), i: int(m.i, 'i', 0, CAPS.options) } };
      case 'chat':
        return { ok: true, msg: { v, t: 'chat', text: str(m.text, 'text', CAPS.chat) } };
      case 'ping':
      case 'pong':
        return { ok: true, msg: { v, t: m.t, at: num(m.at, 'at') } };
      case 'concede':
      case 'rematch':
      case 'record':
      case 'leave':
        return { ok: true, msg: { v, t: m.t } };
      default:
        return fail(`unknown message type ${JSON.stringify(m.t)?.slice(0, 40)}`);
    }
  } catch (e) {
    if (e instanceof Bad) return { ok: false, why: e.message };
    throw e;
  }
}

// ---------------------------------------------------------------- host → guest

const ZONES: readonly Zone[] = ['deck', 'hand', 'field', 'legends', 'eddies', 'trash', 'removed', 'limbo'];
const KINDS: readonly DecisionKind[] = ['action', 'reaction', 'mulligan', 'unit', 'card', 'gig', 'gigValue', 'number', 'mode', 'yesno', 'steal', 'legend', 'cardType', 'pay', 'order'];
const PHASES: readonly GameState['phase'][] = ['setup', 'start', 'main', 'end', 'over'];

function readCard(v: unknown, what: string): CardInst {
  const c = obj(v, what);
  const zone = str(c.zone, `${what}.zone`, 10) as Zone;
  if (!ZONES.includes(zone)) fail(`${what}.zone is not a zone`);
  return {
    uid: int(c.uid, `${what}.uid`),
    defId: str(c.defId, `${what}.defId`, CAPS.cardId),
    owner: seat(c.owner, `${what}.owner`),
    controller: seat(c.controller, `${what}.controller`),
    zone,
    spent: bool(c.spent, `${what}.spent`),
    faceUp: bool(c.faceUp, `${what}.faceUp`),
    lag: bool(c.lag, `${what}.lag`),
    gear: list(c.gear, `${what}.gear`, 20, (x, i) => int(x, `${what}.gear[${i}]`)),
    host: c.host === null ? null : int(c.host, `${what}.host`),
    enteredTurn: int(c.enteredTurn, `${what}.enteredTurn`),
    goSolo: bool(c.goSolo, `${what}.goSolo`),
    ...(c.known === true ? { known: true } : {}),
  };
}

const uids = (v: unknown, what: string) => list(v, what, CAPS.zone, (x, i) => int(x, `${what}[${i}]`));
const nums = (v: unknown, what: string) => list(v, what, 2, (x, i) => int(x, `${what}[${i}]`));

/** A view of the board as sent by the host: the shape the board needs, every part checked and capped. */
export function readViewState(v: unknown): GameState {
  const s = obj(v, 'state');
  const players = list(s.players, 'state.players', 2, (x, i) => {
    const P = obj(x, `players[${i}]`);
    const w = `players[${i}]`;
    return {
      id: seat(P.id, `${w}.id`),
      name: str(P.name, `${w}.name`, CAPS.deckName, { empty: true }),
      ...(typeof P.listId === 'string' && P.listId.length <= 64 ? { listId: P.listId } : {}),
      deck: uids(P.deck, `${w}.deck`),
      hand: uids(P.hand, `${w}.hand`),
      field: uids(P.field, `${w}.field`),
      legends: uids(P.legends, `${w}.legends`),
      eddies: uids(P.eddies, `${w}.eddies`),
      trash: uids(P.trash, `${w}.trash`),
      removed: uids(P.removed, `${w}.removed`),
      fixer: uids(P.fixer, `${w}.fixer`),
      gigs: uids(P.gigs, `${w}.gigs`),
      sideboard: [],
    };
  });
  if (players.length !== 2) fail('state.players does not have two players');
  const cardsRaw = obj(s.cards, 'state.cards');
  if (Object.keys(cardsRaw).length > CAPS.cards) fail(`state.cards has more than ${CAPS.cards} cards`);
  const cards: Record<number, CardInst> = {};
  for (const [k, x] of Object.entries(cardsRaw)) {
    const c = readCard(x, `cards.${k.slice(0, 12)}`);
    if (String(c.uid) !== k) fail(`cards.${k.slice(0, 12)} has another uid`);
    cards[c.uid] = c;
  }
  const gigsRaw = obj(s.gigs, 'state.gigs');
  if (Object.keys(gigsRaw).length > 40) fail('state.gigs has too many Gigs');
  const gigs: GameState['gigs'] = {};
  for (const [k, x] of Object.entries(gigsRaw)) {
    const g = obj(x, `gigs.${k.slice(0, 12)}`);
    const id = int(g.id, 'gig.id');
    gigs[id] = { id, sides: int(g.sides, 'gig.sides', 2, 100), value: int(g.value, 'gig.value', 0, 100), owner: seat(g.owner, 'gig.owner'), controller: g.controller === null ? null : seat(g.controller, 'gig.controller') };
  }
  const mods = list(s.mods, 'state.mods', CAPS.mods, (x, i) => {
    const m = obj(x, `mods[${i}]`);
    str(m.kind, `mods[${i}].kind`, 30);
    // mods are read by the board's power and cost sums: plain data from here on (JSON has no functions)
    return JSON.parse(JSON.stringify(m)) as GameState['mods'][number];
  });
  const log = list(s.log, 'state.log', CAPS.log, (x, i): LogEntry => {
    const l = obj(x, `log[${i}]`);
    return { turn: int(l.turn, `log[${i}].turn`), player: l.player === null ? null : seat(l.player, `log[${i}].player`), text: str(l.text, `log[${i}].text`, CAPS.logText, { empty: true }) };
  });
  const att = s.attack === null ? null : obj(s.attack, 'state.attack');
  const statsRaw = obj(s.stats, 'state.stats');
  const stat = (k: string) => nums(statsRaw[k], `stats.${k}`);
  const phase = str(s.phase, 'state.phase', 10) as GameState['phase'];
  if (!PHASES.includes(phase)) fail('state.phase is not a phase');
  const winner = s.winner === null || s.winner === 'tie' ? s.winner : seat(s.winner, 'state.winner');
  const counters: Record<string, number> = {};
  for (const [k, x] of Object.entries(obj(s.counters, 'state.counters')).slice(0, 200)) if (k.length <= 80) counters[k] = num(x, 'counter');
  const once: Record<string, number> = {};
  for (const [k, x] of Object.entries(obj(s.once, 'state.once')).slice(0, 200)) if (k.length <= 80) once[k] = num(x, 'once');
  return {
    rng: 0,
    turn: int(s.turn, 'state.turn', 0, 10_000),
    active: seat(s.active, 'state.active'),
    first: seat(s.first, 'state.first'),
    phase,
    players: [players[0]!, players[1]!],
    cards,
    gigs,
    mods,
    attack: att
      ? {
          attacker: int(att.attacker, 'attack.attacker'),
          attackerPlayer: seat(att.attackerPlayer, 'attack.attackerPlayer'),
          targetUnit: att.targetUnit === null ? null : int(att.targetUnit, 'attack.targetUnit'),
          targetGigs: att.targetGigs === null ? null : seat(att.targetGigs, 'attack.targetGigs'),
          step: str(att.step, 'attack.step', 10) as NonNullable<GameState['attack']>['step'],
          ended: bool(att.ended, 'attack.ended'),
          ...(att.readyTargetOk === true ? { readyTargetOk: true } : {}),
        }
      : null,
    winner,
    winReason: str(s.winReason, 'state.winReason', CAPS.why, { empty: true }),
    overtime: bool(s.overtime, 'state.overtime'),
    emptyFixerStreak: int(s.emptyFixerStreak, 'state.emptyFixerStreak'),
    nextUid: int(s.nextUid, 'state.nextUid'),
    nextModId: int(s.nextModId, 'state.nextModId'),
    once,
    counters,
    turnEvents: list(s.turnEvents ?? [], 'state.turnEvents', CAPS.turnEvents, (x, i) => {
      const e = obj(x, `turnEvents[${i}]`);
      return JSON.parse(JSON.stringify(e)) as NonNullable<GameState['turnEvents']>[number];
    }),
    log,
    stats: { attacks: stat('attacks'), gigsStolen: stat('gigsStolen'), unitsDefeated: stat('unitsDefeated'), cardsPlayed: stat('cardsPlayed'), sold: stat('sold'), calls: stat('calls') },
    maxTurns: int(s.maxTurns, 'state.maxTurns', 1, 10_000),
  };
}

export function readDecision(v: unknown): Decision {
  const d = obj(v, 'decision');
  const kind = str(d.kind, 'decision.kind', 20) as DecisionKind;
  if (!KINDS.includes(kind)) fail('decision.kind is not a decision kind');
  const options = list(d.options, 'decision.options', CAPS.options, (x, i) => {
    const o = obj(x, `options[${i}]`);
    return {
      label: str(o.label, `options[${i}].label`, CAPS.label, { empty: true }),
      ...(o.uid !== undefined ? { uid: int(o.uid, `options[${i}].uid`) } : {}),
      ...(o.gig !== undefined ? { gig: int(o.gig, `options[${i}].gig`) } : {}),
      ...(o.n !== undefined ? { n: int(o.n, `options[${i}].n`, -1000, 1000) } : {}),
      ...(o.key !== undefined ? { key: str(o.key, `options[${i}].key`, CAPS.key, { empty: true }) } : {}),
      ...(o.action !== undefined ? { action: JSON.parse(JSON.stringify(obj(o.action, `options[${i}].action`))) } : {}),
    };
  });
  if (!options.length) fail('decision has no options');
  return {
    player: 0,
    kind,
    prompt: str(d.prompt, 'decision.prompt', CAPS.prompt, { empty: true }),
    options,
    min: int(d.min, 'decision.min', 0, 10),
    max: int(d.max, 'decision.max', 0, 10),
    ...(d.source !== undefined ? { source: int(d.source, 'decision.source') } : {}),
    ...(d.intent === 'harm' || d.intent === 'help' || d.intent === 'neutral' ? { intent: d.intent } : {}),
    ...(typeof d.tag === 'string' && d.tag.length <= CAPS.key ? { tag: d.tag } : {}),
  };
}

const END_WHY = ['finished', 'conceded', 'abandoned'] as const;
function readEnd(v: unknown): ViewMsg['end'] {
  if (v === null || v === undefined) return null;
  const e = obj(v, 'end');
  const why = str(e.why, 'end.why', 12) as (typeof END_WHY)[number];
  if (!(END_WHY as readonly string[]).includes(why)) fail('end.why is not a way to end');
  return { why, by: e.by === null ? null : seat(e.by, 'end.by') };
}

function readRecord(v: unknown): GameRecordMsg {
  const r = obj(v, 'record');
  const ans = (x: unknown, what: string) => list(x, what, CAPS.record, (y, i) => list(y, `${what}[${i}]`, 10, (z, j) => int(z, `${what}[${i}][${j}]`, 0, CAPS.options)));
  const decks = list(r.decks, 'record.decks', 2, readDeck);
  const answers = list(r.answers, 'record.answers', 2, (x, i) => ans(x, `answers[${i}]`));
  if (decks.length !== 2 || answers.length !== 2) fail('record needs two decks and two answer lists');
  return { game: str(r.game, 'record.game', CAPS.gameId), seed: int(r.seed, 'record.seed', 0, 2 ** 32), first: seat(r.first, 'record.first'), decks: [decks[0]!, decks[1]!], answers: [answers[0]!, answers[1]!] };
}

export function parseHostMessage(text: unknown): Parsed<HostMsg> {
  try {
    if (typeof text !== 'string') return fail('not text');
    if (text.length > CAPS.hostMessage) return fail(`longer than ${CAPS.hostMessage} characters`);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return fail('not JSON');
    }
    const m = obj(raw, 'message');
    if (m.v !== PROTOCOL_VERSION) return fail(`protocol version ${String(m.v)} (this site speaks ${PROTOCOL_VERSION})`);
    const v = 1 as const;
    switch (m.t) {
      case 'welcome':
        return {
          ok: true,
          msg: {
            v,
            t: 'welcome',
            name: str(m.name, 'name', CAPS.name),
            deckName: str(m.deckName, 'deckName', CAPS.deckName),
            game: str(m.game, 'game', CAPS.gameId),
            token: str(m.token, 'token', CAPS.token),
            timer: int(m.timer, 'timer', 0, 3600),
            resumed: bool(m.resumed, 'resumed'),
          },
        };
      case 'refuse':
      case 'reject':
        return { ok: true, msg: { v, t: m.t, why: str(m.why, 'why', CAPS.why) } };
      case 'commit':
        return { ok: true, msg: { v, t: 'commit', h: hex(m.h, 'h', 64) } };
      case 'reveal':
        return { ok: true, msg: { v, t: 'reveal', n: hex(m.n, 'n', 32) } };
      case 'start':
        return { ok: true, msg: { v, t: 'start', youFirst: bool(m.youFirst, 'youFirst') } };
      case 'view': {
        const dec = m.decision === null ? null : obj(m.decision, 'decision');
        return {
          ok: true,
          msg: {
            v,
            t: 'view',
            n: int(m.n, 'n'),
            state: readViewState(m.state),
            decision: dec ? { seq: int(dec.seq, 'decision.seq'), d: readDecision(dec.d) } : null,
            timeLeft: m.timeLeft === null ? null : int(m.timeLeft, 'timeLeft', 0, 3_600_000),
            waiting: m.waiting === null ? null : seat(m.waiting, 'waiting'),
            end: readEnd(m.end),
            error: m.error === null || m.error === undefined ? null : str(m.error, 'error', CAPS.why, { empty: true }),
          },
        };
      }
      case 'chat':
        return { ok: true, msg: { v, t: 'chat', text: str(m.text, 'text', CAPS.chat) } };
      case 'ping':
      case 'pong':
        return { ok: true, msg: { v, t: m.t, at: num(m.at, 'at') } };
      case 'rematch':
      case 'leave':
        return { ok: true, msg: { v, t: m.t } };
      case 'record':
        return { ok: true, msg: { v, t: 'record', record: readRecord(m.record) } };
      default:
        return fail(`unknown message type ${JSON.stringify(m.t)?.slice(0, 40)}`);
    }
  } catch (e) {
    if (e instanceof Bad) return { ok: false, why: e.message };
    throw e;
  }
}
