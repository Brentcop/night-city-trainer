// The round-trip check: are two games the same game? Card uids differ between a game and its replay (a replay may
// draw another copy of the same card), so each state is first written with every card named by where it is ("p1 field
// 2") and what it is, and then compared field by field. Everything is compared except the RNG value, the log and the
// trace (compared separately), the sideboard (no rule reads it), the order of the cards still in a deck (no one has seen
// it: compared as a multiset) and when a card that is not on the field last moved (the engine reads that only for Units
// on the field). Pure.
import type { GameState, LogEntry, PlayerId } from '../../engine/types';
import type { DecisionTrace } from './exporter';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const ZONES = ['hand', 'field', 'legends', 'eddies', 'trash', 'removed'] as const;

/** The state written without uids or the RNG (see the file header). */
export function canonicalState(s: GameState): Json {
  const name = new Map<number, string>();
  const cardOf = (u: number) => s.cards[u];
  const view = (u: number): Json => {
    const c = cardOf(u);
    if (!c) return `missing ${u}`;
    const v: { [k: string]: Json } = { id: c.defId, owner: c.owner, controller: c.controller, spent: c.spent, lag: c.lag, faceUp: c.faceUp, known: !!c.known, goSolo: c.goSolo };
    if (c.zone === 'field') v.enteredTurn = c.enteredTurn;
    if (c.gear.length) v.gear = c.gear.map((g) => name.get(g) ?? `?${g}`);
    if (c.host !== null) v.host = name.get(c.host) ?? `?${c.host}`;
    return v;
  };
  // names: zone and position (a deck sorted, its order being hidden), Gear by its host, cards resolving in limbo
  for (const p of [0, 1] as PlayerId[]) {
    const ps = s.players[p];
    for (const z of ZONES) ps[z].forEach((u, i) => name.set(u, `p${p + 1} ${z} ${i}`));
    const deckKey = (u: number) => JSON.stringify(view(u));
    [...ps.deck].sort((a, b) => deckKey(a).localeCompare(deckKey(b))).forEach((u, i) => name.set(u, `p${p + 1} deck ${i}`));
    for (const h of [...ps.field, ...ps.legends]) cardOf(h)?.gear.forEach((gu, j) => name.set(gu, `${name.get(h)} gear ${j}`));
  }
  Object.values(s.cards)
    .filter((c) => c.zone === 'limbo')
    .sort((a, b) => a.defId.localeCompare(b.defId))
    .forEach((c, i) => name.set(c.uid, `limbo ${i} ${c.defId}`));
  const nm = (u: number | null | undefined): Json => (u === null || u === undefined ? null : (name.get(u) ?? `?${u}`));
  const key = (k: string) => {
    const parts = k.split(':');
    if (/^(sell|call)$/.test(parts[0]!)) return k;
    return parts.map((x, i) => (i > 0 && /^\d+$/.test(x) && name.has(Number(x)) ? String(nm(Number(x))) : x)).join(':');
  };
  const mapData = (d: unknown): Json => {
    if (Array.isArray(d)) return d.map(mapData);
    if (d && typeof d === 'object') {
      const out: { [k: string]: Json } = {};
      for (const [k, v] of Object.entries(d)) out[k] = /^(uid|target|host|attacker|unit|source)$/.test(k) && typeof v === 'number' ? nm(v) : mapData(v);
      return out;
    }
    return (d ?? null) as Json;
  };
  const players = s.players.map((ps) => {
    const deck = [...ps.deck].map((u) => JSON.stringify(view(u))).sort();
    const out: { [k: string]: Json } = { name: ps.name, listId: ps.listId ?? null, deck, fixer: [...ps.fixer], gigs: [...ps.gigs] };
    for (const z of ZONES) out[z] = ps[z].map(view);
    return out;
  });
  const mods = s.mods.map((m): Json => {
    const v: { [k: string]: Json } = { kind: m.kind, until: m.until, turn: m.turn };
    if (m.untilPlayer !== undefined) v.untilPlayer = m.untilPlayer;
    if (m.target !== undefined) v.target = nm(m.target);
    if (m.source !== undefined) v.source = nm(m.source);
    if (m.player !== undefined) v.player = m.player;
    if (m.amount !== undefined) v.amount = m.amount;
    const value = (m as { value?: unknown }).value;
    if (value !== undefined) v.value = mapData(value);
    return v;
  });
  const once: { [k: string]: Json } = {};
  for (const [k, v] of Object.entries(s.once)) once[key(k)] = v;
  const counters: { [k: string]: Json } = {};
  for (const [k, v] of Object.entries(s.counters)) counters[key(k)] = v;
  return {
    turn: s.turn,
    active: s.active,
    first: s.first,
    phase: s.phase,
    winner: s.winner,
    winReason: s.winReason,
    overtime: s.overtime,
    emptyFixerStreak: s.emptyFixerStreak,
    maxTurns: s.maxTurns,
    nextUid: s.nextUid,
    nextModId: s.nextModId,
    stats: s.stats as unknown as Json,
    gigs: Object.values(s.gigs).map((g) => ({ id: g.id, sides: g.sides, value: g.value, owner: g.owner, controller: g.controller })),
    players,
    mods,
    once,
    counters,
    attack: s.attack ? { ...s.attack, attacker: nm(s.attack.attacker), targetUnit: nm(s.attack.targetUnit) } : null,
    turnEvents: (s.turnEvents ?? []).map((e) => ({ ...e, uid: nm(e.uid) }) as Json),
    limbo: Object.values(s.cards)
      .filter((c) => c.zone === 'limbo')
      .map((c) => c.defId)
      .sort(),
  };
}

/** The first place two JSON values differ ("players.0.hand.2.id: X vs Y"), or null when they are equal. */
export function firstDifference(a: Json, b: Json, path = ''): string | null {
  if (a === b) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object' || Array.isArray(a) !== Array.isArray(b)) return `${path || '(root)'}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (i >= a.length || i >= b.length) return `${path}.length: ${a.length} vs ${b.length}`;
      const d = firstDifference(a[i]!, b[i]!, `${path}.${i}`);
      if (d) return d;
    }
    return null;
  }
  const ao = a as { [k: string]: Json };
  const bo = b as { [k: string]: Json };
  for (const k of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
    if (!(k in ao) || !(k in bo)) return `${path}.${k}: ${k in ao ? 'only in the first' : 'only in the second'}`;
    const d = firstDifference(ao[k]!, bo[k]!, path ? `${path}.${k}` : k);
    if (d) return d;
  }
  return null;
}

/** The log as compared: a game ended by the session (a concession, a clock) words its last line differently. */
const logLines = (log: LogEntry[]) => log.map((e) => `${e.turn}|${e.player ?? '-'}|${e.text}`);

export interface GameComparison {
  same: boolean;
  /** decisions compared, and the first that differs */
  decisions: number;
  decisionDiff?: string;
  stateDiff?: string;
  logDiff?: string;
}

/** Compare a game with its replay: decision by decision, then the end state and the log. */
export function compareGames(a: { state: GameState; decisions: DecisionTrace[] }, b: { state: GameState; decisions: DecisionTrace[] }): GameComparison {
  const out: GameComparison = { same: true, decisions: Math.min(a.decisions.length, b.decisions.length) };
  const n = Math.max(a.decisions.length, b.decisions.length);
  for (let i = 0; i < n; i++) {
    const x = a.decisions[i];
    const y = b.decisions[i];
    const d = !x || !y ? `decision ${i}: only in the ${x ? 'first' : 'second'} game` : firstDifference(x as unknown as Json, y as unknown as Json, `decision ${i} (turn ${x.t}, p${x.p + 1} ${x.kind})`);
    if (d) {
      out.same = false;
      out.decisionDiff = d;
      break;
    }
  }
  const sessionEnd = (s: GameState) => /conceded|ran out of time|abandoned/i.test(s.winReason);
  const sa = canonicalState(a.state) as { [k: string]: Json };
  const sb = canonicalState(b.state) as { [k: string]: Json };
  if (sessionEnd(a.state) && sessionEnd(b.state)) {
    sa.winReason = sb.winReason = 'session';
  }
  const sd = firstDifference(sa, sb);
  if (sd) {
    out.same = false;
    out.stateDiff = sd;
  }
  const la = logLines(a.state.log);
  const lb = logLines(b.state.log);
  if (sessionEnd(a.state) && sessionEnd(b.state)) {
    la.pop();
    lb.pop();
  }
  const ld = firstDifference(la, lb, 'log');
  if (ld) {
    out.same = false;
    out.logDiff = ld;
  }
  return out;
}
