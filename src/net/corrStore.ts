// The games against a person kept in this browser (src/net/corr.ts): the full check of a stored or imported game
// (every field, the boards and decisions with the protocol's readers, the host's save), and the store the game code
// uses. Loaded with the game code (src/ui/pages/PlayCorr.tsx), not by the Play setup screen.
import type { Decision, DeckList, GameState } from '../engine/types';
import { ongoingChanged } from '../lib/ongoingBadge';
import { CORR_CHAT_KEEP, CORR_GAMES_KEY, CORR_KIND, CORR_SCHEMA, type ChainLink, type CorrGame, type CorrStage } from './corr';
import { parseHostSave } from './hostGame';
import { readDecision, readDeck, readRecord, readViewState, tryRead } from './protocol';

const isStr = (x: unknown): x is string => typeof x === 'string';
const isInt = (x: unknown): x is number => Number.isInteger(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const HEX = (len: number) => (x: unknown): x is string => isStr(x) && x.length === len && /^[0-9a-f]+$/.test(x);
const isLink = (x: unknown): x is ChainLink => {
  const l = x as ChainLink | null;
  return !!l && typeof l === 'object' && isInt(l.n) && isStr(l.m) && (l.f === 'h' || l.f === 'g');
};
const deckOk = (x: unknown): DeckList | null => {
  const r = tryRead(() => readDeck(x));
  return r.ok ? { name: r.value.name, legends: r.value.legends, main: r.value.main, sideboard: [] } : null;
};
const view = (x: unknown): GameState | null => {
  const r = tryRead(() => readViewState(x));
  return r.ok ? r.value : null;
};
const pair = (x: unknown): x is [number, number] => Array.isArray(x) && x.length === 2 && x.every(isNum);

/** A stored or imported game, checked field by field, or why it is not one. Never throws. */
export function parseCorrGame(x: unknown): { ok: true; value: CorrGame } | { ok: false; why: string } {
  const g = x as Partial<CorrGame> | null;
  const bad = (what: string) => ({ ok: false as const, why: `This game against a person is damaged: ${what}.` });
  if (!g || typeof g !== 'object' || g.kind !== CORR_KIND) return { ok: false, why: 'This is not a multi-day game against a person.' };
  if (g.schema !== CORR_SCHEMA) return { ok: false, why: `This game's format (${String(g.schema)}) can't be read here.` };
  if (!HEX(16)(g.id) || (g.role !== 'host' && g.role !== 'guest')) return bad('its id is missing');
  if (!isStr(g.me) || !(g.rival === null || isStr(g.rival)) || !(g.rivalDeck === null || isStr(g.rivalDeck))) return bad('the names are missing');
  const myDeck = deckOk(g.myDeck);
  if (!myDeck) return bad('your deck is incomplete');
  if (!isInt(g.days) || g.days < 1 || g.days > 366 || !isStr(g.created) || !isStr(g.lastPlayed)) return bad('its length or dates are missing');
  if (!['invited', 'joined', 'playing', 'over', 'refused'].includes(g.stage as string)) return bad('its stage is unknown');
  if (!g.keys || !HEX(64)(g.keys.host) || !(g.keys.guest === null || HEX(64)(g.keys.guest))) return bad('its keys are missing');
  if (!HEX(32)(g.nonce) || typeof g.prefFirst !== 'boolean' || typeof g.auto !== 'boolean') return bad('the roll is missing');
  if (!(g.head === null || isLink(g.head)) || !(g.prevHead === null || isLink(g.prevHead))) return bad('the packet chain is damaged');
  const ob = g.outbox;
  if (!(ob === null || (ob && isInt(ob.n) && isStr(ob.code) && ob.code.length < 500_000 && isStr(ob.made)))) return bad('the last packet is damaged');
  const c = g.clock;
  if (!c || !isNum(c.bank) || !pair(c.used) || !pair(c.extra) || !(c.since === null || isNum(c.since)) || !(c.onMove === null || c.onMove === 0 || c.onMove === 1)) return bad('the clock is damaged');
  if (!Array.isArray(g.chat) || !g.chat.every((l) => l && isStr(l.text) && isNum(l.at) && ['me', 'rival', 'system'].includes(l.from))) return bad('the chat is damaged');
  if (!Array.isArray(g.unsent) || !g.unsent.every(isStr) || !isNum(g.grantOwed)) return bad('the unsent lines are damaged');
  const s = g.summary;
  if (!s || !isInt(s.turn) || !pair(s.gigs) || typeof s.yourMove !== 'boolean' || typeof s.reaction !== 'boolean') return bad('its summary is missing');
  const e = g.end;
  if (!(e === null || (e && ['win', 'loss', 'draw'].includes(e.result) && isStr(e.reason) && isStr(e.why) && (e.byMe === null || typeof e.byMe === 'boolean') && typeof e.recorded === 'boolean' && typeof e.replay === 'boolean'))) return bad('its result is damaged');
  if (!(g.problem === null || isStr(g.problem))) return bad('its note is damaged');
  const out: CorrGame = {
    kind: CORR_KIND,
    schema: CORR_SCHEMA,
    id: g.id,
    role: g.role,
    me: g.me,
    rival: g.rival,
    myDeck,
    rivalDeck: g.rivalDeck,
    days: g.days,
    created: g.created,
    lastPlayed: g.lastPlayed,
    stage: g.stage as CorrStage,
    keys: { host: g.keys.host, guest: g.keys.guest },
    nonce: g.nonce,
    prefFirst: g.prefFirst,
    auto: g.auto,
    head: g.head ? { ...g.head } : null,
    prevHead: g.prevHead ? { ...g.prevHead } : null,
    outbox: ob ? { ...ob } : null,
    clock: { bank: c.bank, used: [c.used[0], c.used[1]], extra: [c.extra[0], c.extra[1]], since: c.since, onMove: c.onMove },
    chat: g.chat.slice(-CORR_CHAT_KEEP).map((l) => ({ from: l.from, text: l.text.slice(0, 300), at: l.at })),
    unsent: g.unsent.slice(0, 10).map((t) => t.slice(0, 300)),
    grantOwed: g.grantOwed,
    summary: { turn: s.turn, gigs: [s.gigs[0], s.gigs[1]], yourMove: s.yourMove, reaction: s.reaction },
    end: e ? { ...e } : null,
    problem: g.problem ?? null,
    finalView: null,
    record: null,
  };
  if (g.finalView) {
    const v = view(g.finalView);
    if (!v) return bad('the last board is damaged');
    out.finalView = v;
  }
  if (g.record) {
    const r = tryRead(() => readRecord(g.record));
    if (!r.ok) return bad('the record is damaged');
    out.record = r.value;
  }
  if (g.role === 'host') {
    const h = g.host;
    if (!h) return bad("the host's game is missing");
    const save = h.save === null ? null : parseHostSave(JSON.stringify(h.save));
    if (h.save !== null && !save) return bad("the host's save is damaged");
    const sentView = h.sent ? view(h.sent.view) : null;
    if (h.sent && (!sentView || !isInt(h.sent.logLen))) return bad('the last view sent is damaged');
    const guestDeck = h.guestDeck === null ? null : deckOk(h.guestDeck);
    if (h.guestDeck !== null && !guestDeck) return bad("the rival's deck is damaged");
    if (typeof h.rolled !== 'boolean' || !(h.first === null || h.first === 0 || h.first === 1)) return bad('the roll is damaged');
    out.host = { save, sent: h.sent && sentView ? { view: sentView, logLen: h.sent.logLen } : null, guestDeck, rolled: h.rolled, first: h.first };
  } else {
    const q = g.guest;
    if (!q || !HEX(64)(q.commit)) return bad("the guest's game is missing");
    const v = q.view === null ? null : view(q.view);
    if (q.view !== null && !v) return bad('the board is damaged');
    let decision: { seq: number; d: Decision } | null = null;
    if (q.decision) {
      const d = tryRead(() => readDecision(q.decision!.d));
      if (!d.ok || !isInt(q.decision.seq)) return bad('the decision waiting is damaged');
      decision = { seq: q.decision.seq, d: d.value };
    }
    if (!(q.waiting === null || q.waiting === 0 || q.waiting === 1)) return bad('whose move it is is missing');
    out.guest = { commit: q.commit, view: v, decision, waiting: q.waiting };
  }
  return { ok: true, value: out };
}

// ---------------------------------------------------------------- the list in this browser

/** Where the games are kept: this browser's localStorage, or memory in tests. */
export interface CorrStore {
  load(): CorrGame[];
  /** null when written, else why not */
  save(g: CorrGame): string | null;
  /** remove one side's copy of a game (both sides may live in one browser: two tabs, for a try) */
  remove(id: string, role: CorrGame['role']): void;
}

export function parseCorrList(raw: string | null): CorrGame[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.flatMap((x) => {
      const r = parseCorrGame(x);
      return r.ok ? [r.value] : [];
    });
  } catch {
    return [];
  }
}

/** A store over a key-value storage (localStorage by default). */
export function kvCorrStore(kv: Pick<Storage, 'getItem' | 'setItem'> | null, key = CORR_GAMES_KEY): CorrStore {
  const read = () => {
    try {
      return parseCorrList(kv?.getItem(key) ?? null);
    } catch {
      return [];
    }
  };
  return {
    load: read,
    save: (g) => {
      try {
        if (!kv) return 'This browser does not let the page store data.';
        const list = read().filter((x) => x.id !== g.id || x.role !== g.role);
        list.push(g);
        kv.setItem(key, JSON.stringify(list));
        ongoingChanged();
        return null;
      } catch {
        return 'This browser refused to store the game (storage is full or blocked).';
      }
    },
    remove: (id, role) => {
      try {
        kv?.setItem(key, JSON.stringify(read().filter((x) => x.id !== id || x.role !== role)));
        ongoingChanged();
      } catch {
        /* storage blocked */
      }
    },
  };
}

export function browserCorrStore(): CorrStore {
  let kv: Storage | null = null;
  try {
    kv = typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    kv = null;
  }
  return kvCorrStore(kv);
}

