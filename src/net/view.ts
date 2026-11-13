// What one seat of an online game may see (src/net/: the host's browser runs the real Game; the guest only ever gets
// this). viewFor(state, seat) is pure: a new state, seen from `seat` and turned round so that seat is player 0 (the Play
// board always draws "you" as player 0), with everything that seat may not see under the rules removed or masked:
//   - both decks: only the count stays (placeholder cards, no ids, no order);
//   - the rival's hand: only the count;
//   - every Eddie (face-down: rule 5.8 says nobody may look at them): only count and spent / ready;
//   - face-down Legends, unless the seat knows that one of its own (`known`): masked, their slot and spent state kept;
//   - the random state (the seed would give away every shuffle), the trace, a delayed effect's private data, and the
//     rival's list fingerprint (it would name their exact list);
//   - the rival's log lines that name a card they took into their hand without revealing it. (A card sold with the Sell
//     for Turn action is revealed first, Comprehensive Rules 8.11 and 5.8.2.2, so "sells X for an Eddie" stays named, as
//     in a practice game's log; an effect that sells a card unseen logs no name.)
// A hidden card gets a stand-in uid by position (HIDDEN_BASE and up), never its real uid: real uids follow the deck
// list's order, so they would tell which card it is. viewDecision() turns that seat's own decision round the same way.
// ViewGame wraps a view so the board's Game calls (power, names, costs) work on it; a stand-in card reads as a blank
// card (a face-down Legend as a blank Legend: the card back shows it is one, rule 3.x).
import { CARD_BY_ID } from '../engine/cards';
import { Game } from '../engine/engine';
import type { Action, Agent, CardDef, CardInst, Decision, GameState, LogEntry, Mod, Opt, PlayerId, PlayerState, Reaction } from '../engine/types';

export const HIDDEN_CARD = 'hidden-card';
export const HIDDEN_LEGEND = 'hidden-legend';
/** Stand-in uids start here (real uids are small: one per card in the two lists, plus a few made in play). */
export const HIDDEN_BASE = 1_000_000;
/** The view keeps the last this many log lines (the board shows 250). */
export const VIEW_LOG_LINES = 250;

const ZONE_CODE = { deck: 0, hand: 1, eddies: 2, legends: 3 } as const;
type HiddenZone = keyof typeof ZONE_CODE;

/** The stand-in uid of the k-th hidden card of a zone of a seat (as numbered in the view). */
export const hiddenUid = (viewSeat: PlayerId, zone: HiddenZone, k: number) => HIDDEN_BASE + viewSeat * 100_000 + ZONE_CODE[zone] * 10_000 + k;
export const isHiddenUid = (uid: number) => uid >= HIDDEN_BASE;

const blankDef = (id: string, type: CardDef['type'], name: string): CardDef => ({
  id,
  name,
  subname: null,
  displayName: name,
  color: 'Red',
  type,
  cost: null,
  power: 0,
  ram: 0,
  rarity: '',
  tags: [],
  text: '',
  keywords: [],
  sellable: false,
  set: '',
  number: '',
  image: null,
});
const HIDDEN_DEFS: Record<string, CardDef> = {
  [HIDDEN_CARD]: blankDef(HIDDEN_CARD, 'Unit', 'Face-down card'),
  [HIDDEN_LEGEND]: blankDef(HIDDEN_LEGEND, 'Legend', 'Face-down Legend'),
};

/** Who may see a card's face (in the real state's numbering). */
function visibleTo(c: CardInst, seat: PlayerId): boolean {
  switch (c.zone) {
    case 'field':
    case 'trash':
    case 'removed':
    case 'limbo':
      return true;
    case 'legends':
      return c.faceUp || (c.controller === seat && !!c.known);
    case 'hand':
      return c.owner === seat;
    default:
      // deck and eddies: nobody looks
      return false;
  }
}

/** A rival's log line with the card it names left out, when the line names a card they kept hidden. */
const HIDDEN_LINES: [RegExp, string][] = [[/^adds .+ to hand$/, 'adds a card to hand']];
export function redactLine(text: string): string {
  for (const [re, to] of HIDDEN_LINES) if (re.test(text)) return to;
  return text;
}

/** The log as `seat` reads it: the last VIEW_LOG_LINES lines, turned round, the rival's hidden cards left unnamed. */
export function viewLog(log: readonly LogEntry[], seat: PlayerId): LogEntry[] {
  const sw = (p: PlayerId): PlayerId => (seat === 0 ? p : ((1 - p) as PlayerId));
  return log.slice(-VIEW_LOG_LINES).map((l) => ({
    turn: l.turn,
    player: l.player === null ? null : sw(l.player),
    text: l.player !== null && l.player !== seat ? redactLine(l.text) : l.text,
  }));
}

/** Real uid → view uid for the hidden cards of a state seen by `seat` (visible cards keep their uid). */
export function hiddenAliases(st: GameState, seat: PlayerId): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of [0, 1] as PlayerId[]) {
    const vp: PlayerId = seat === 0 ? p : ((1 - p) as PlayerId);
    const P = st.players[p];
    P.deck.forEach((u, k) => out.set(u, hiddenUid(vp, 'deck', k)));
    P.eddies.forEach((u, k) => out.set(u, hiddenUid(vp, 'eddies', k)));
    if (p !== seat) P.hand.forEach((u, k) => out.set(u, hiddenUid(vp, 'hand', k)));
    P.legends.forEach((u, k) => {
      const c = st.cards[u];
      if (c && !visibleTo(c, seat)) out.set(u, hiddenUid(vp, 'legends', k));
    });
  }
  return out;
}

const ONCE_SEAT = /^(sell|call):([01])$/;

/**
 * The state as `seat` may see it, turned round so that seat is player 0. Pure: the state is not changed and nothing in
 * the result is shared with it.
 */
export function viewFor(st: GameState, seat: PlayerId): GameState {
  const sw = (p: PlayerId): PlayerId => (seat === 0 ? p : ((1 - p) as PlayerId));
  const alias = hiddenAliases(st, seat);
  const uidOf = (u: number) => alias.get(u) ?? u;
  // a reference from public data (a mod, this turn's history) to a card now hidden points nowhere: even its stand-in
  // would tie a known card to a hidden position
  const refOf = (u: number) => (alias.has(u) ? 0 : u);
  const cards: Record<number, CardInst> = {};
  const keep = (u: number) => {
    const c = st.cards[u];
    if (!c || alias.has(u)) return;
    cards[u] = { ...c, owner: sw(c.owner), controller: sw(c.controller), gear: [...c.gear] };
    for (const gu of c.gear) keep(gu);
  };
  const stand = (u: number, zone: CardInst['zone'], owner: PlayerId, controller: PlayerId) => {
    const c = st.cards[u];
    const v = alias.get(u)!;
    cards[v] = {
      uid: v,
      defId: zone === 'legends' ? HIDDEN_LEGEND : HIDDEN_CARD,
      owner: sw(owner),
      controller: sw(controller),
      zone,
      // the slot's spent state is public (a face-down Legend or an Eddie may pay)
      spent: zone === 'legends' || zone === 'eddies' ? !!c?.spent : false,
      faceUp: false,
      lag: false,
      gear: [],
      host: null,
      enteredTurn: 0,
      goSolo: false,
      // a rival may see that a face-down Legend is "known" to its controller, not which it is (rule 5.7)
      ...(zone === 'legends' && c?.known ? { known: true } : {}),
    };
  };
  const players = ([seat, (1 - seat) as PlayerId] as PlayerId[]).map((p): PlayerState => {
    const P = st.players[p];
    const vp = sw(p);
    for (const u of [...P.field, ...P.trash, ...P.removed]) keep(u);
    for (const u of P.legends) (alias.has(u) ? stand(u, 'legends', p, st.cards[u]?.controller ?? p) : keep(u));
    for (const u of P.hand) (alias.has(u) ? stand(u, 'hand', p, p) : keep(u));
    for (const u of P.deck) stand(u, 'deck', p, p);
    for (const u of P.eddies) stand(u, 'eddies', st.cards[u]?.owner ?? p, p);
    return {
      id: vp,
      name: P.name,
      ...(p === seat && P.listId ? { listId: P.listId } : {}),
      deck: P.deck.map(uidOf),
      hand: P.hand.map(uidOf),
      field: [...P.field],
      legends: P.legends.map(uidOf),
      eddies: P.eddies.map(uidOf),
      trash: [...P.trash],
      removed: [...P.removed],
      fixer: [...P.fixer],
      gigs: [...P.gigs],
      sideboard: [],
    };
  });
  // a card being played (limbo) is public; it is in no player's list
  for (const c of Object.values(st.cards)) if (c.zone === 'limbo') keep(c.uid);
  const gigs: GameState['gigs'] = {};
  for (const g of Object.values(st.gigs)) gigs[g.id] = { ...g, owner: sw(g.owner), controller: g.controller === null ? null : sw(g.controller) };
  const mods = st.mods.map((m) => viewMod(m, sw, refOf));
  const once: Record<string, number> = {};
  for (const [k, t] of Object.entries(st.once)) {
    const m = k.match(ONCE_SEAT);
    once[m ? `${m[1]}:${sw(Number(m[2]) as PlayerId)}` : k] = t;
  }
  const pair = (xs: number[]) => (seat === 0 ? [xs[0] ?? 0, xs[1] ?? 0] : [xs[1] ?? 0, xs[0] ?? 0]);
  const att = st.attack;
  return {
    rng: 0,
    turn: st.turn,
    active: sw(st.active),
    first: sw(st.first),
    phase: st.phase,
    players: [players[0]!, players[1]!],
    cards,
    gigs,
    mods,
    attack: att ? { ...att, attackerPlayer: sw(att.attackerPlayer), targetGigs: att.targetGigs === null ? null : sw(att.targetGigs) } : null,
    winner: st.winner === null || st.winner === 'tie' ? st.winner : sw(st.winner),
    winReason: st.winReason,
    overtime: st.overtime,
    emptyFixerStreak: st.emptyFixerStreak,
    nextUid: st.nextUid,
    nextModId: st.nextModId,
    once,
    counters: { ...st.counters },
    turnEvents: (st.turnEvents ?? []).map((e) => ({ ...e, p: sw(e.p), uid: refOf(e.uid) })),
    log: viewLog(st.log, seat),
    stats: {
      attacks: pair(st.stats.attacks),
      gigsStolen: pair(st.stats.gigsStolen),
      unitsDefeated: pair(st.stats.unitsDefeated),
      cardsPlayed: pair(st.stats.cardsPlayed),
      sold: pair(st.stats.sold),
      calls: pair(st.stats.calls),
    },
    maxTurns: st.maxTurns,
  };
}

function viewMod(m: Mod, sw: (p: PlayerId) => PlayerId, uidOf: (u: number) => number): Mod {
  const o: Record<string, unknown> = { ...m };
  if (typeof m.target === 'number') o.target = uidOf(m.target);
  if (typeof m.source === 'number') o.source = uidOf(m.source);
  if (m.player !== undefined) o.player = sw(m.player);
  if (m.until === 'startOfTurn') o.untilPlayer = sw(m.untilPlayer);
  if (m.kind === 'delayed') o.value = { defId: m.value.defId, event: m.value.event, data: {} };
  else if (m.kind === 'costMod' && m.value) o.value = { ...m.value, ...(typeof m.value.uid === 'number' ? { uid: uidOf(m.value.uid) } : {}) };
  else if ('value' in m && m.value !== null && typeof m.value === 'object') o.value = { ...(m.value as object) };
  return o as unknown as Mod;
}

/** A decision of `seat` as that seat's view numbers it (the answer is still an option index, unchanged). */
export function viewDecision(st: GameState, d: Decision, seat: PlayerId): Decision {
  const sw = (p: PlayerId): PlayerId => (seat === 0 ? p : ((1 - p) as PlayerId));
  const alias = hiddenAliases(st, seat);
  const uidOf = (u: number) => alias.get(u) ?? u;
  const act = (a: Action | Reaction): Action | Reaction => {
    const o: Record<string, unknown> = { ...a };
    if ('uid' in a && typeof a.uid === 'number') o.uid = uidOf(a.uid);
    if ('host' in a && typeof a.host === 'number') o.host = uidOf(a.host);
    if ('targetUnit' in a && typeof a.targetUnit === 'number') o.targetUnit = uidOf(a.targetUnit);
    if ('targetGigs' in a && (a.targetGigs === 0 || a.targetGigs === 1)) o.targetGigs = sw(a.targetGigs);
    return o as unknown as Action | Reaction;
  };
  const options = d.options.map((x): Opt => ({
    label: x.label,
    ...(x.uid !== undefined ? { uid: uidOf(x.uid) } : {}),
    ...(x.gig !== undefined ? { gig: x.gig } : {}),
    ...(x.n !== undefined ? { n: x.n } : {}),
    ...(x.key !== undefined ? { key: x.key } : {}),
    ...(x.action ? { action: act(x.action) } : {}),
  }));
  return {
    player: 0,
    kind: d.kind,
    prompt: d.prompt,
    options,
    min: d.min,
    max: d.max,
    ...(d.source !== undefined ? { source: uidOf(d.source) } : {}),
    ...(d.intent ? { intent: d.intent } : {}),
    ...(d.tag ? { tag: d.tag } : {}),
  };
}

const NO_AGENT: Agent = {
  name: 'view',
  decide: async () => {
    throw new Error('a view never decides');
  },
};

/** A Game over a view (never run): the board reads it like the real game. Stand-in cards read as blank cards. */
export class ViewGame extends Game {
  constructor(state: GameState) {
    super(state, [NO_AGENT, NO_AGENT]);
    this.logEnabled = false;
  }
  override def(x: number | CardInst): CardDef {
    const ci = typeof x === 'number' ? this.s.cards[x] : x;
    if (!ci) return HIDDEN_DEFS[HIDDEN_CARD]!;
    return CARD_BY_ID[ci.defId] ?? HIDDEN_DEFS[ci.defId] ?? HIDDEN_DEFS[HIDDEN_CARD]!;
  }
}

/** An empty board for before the first view arrives. */
export function emptyView(names: [string, string]): GameState {
  const P = (id: PlayerId): PlayerState => ({ id, name: names[id], deck: [], hand: [], field: [], legends: [], eddies: [], trash: [], removed: [], fixer: [], gigs: [], sideboard: [] });
  return {
    rng: 0,
    turn: 0,
    active: 0,
    first: 0,
    phase: 'setup',
    players: [P(0), P(1)],
    cards: {},
    gigs: {},
    mods: [],
    attack: null,
    winner: null,
    winReason: '',
    overtime: false,
    emptyFixerStreak: 0,
    nextUid: 1,
    nextModId: 1,
    once: {},
    counters: {},
    turnEvents: [],
    log: [],
    stats: { attacks: [0, 0], gigsStolen: [0, 0], unitsDefeated: [0, 0], cardsPlayed: [0, 0], sold: [0, 0], calls: [0, 0] },
    maxTurns: 60,
  };
}
