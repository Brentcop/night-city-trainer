// Export: any game the engine plays becomes a full-information record (./notation.ts): both opening hands and Legend
// layouts, every choice, every card drawn, milled, revealed or looked at, and every die. The game is run here, with the
// agents given, under the watch of ./instrument.ts (it only watches: the game is the same as without it), and each
// agent's answer is written as the line that names it (./describe.ts). No engine change: draws, looks and dice come
// from the instrument, ends of turn from the engine's trace, and the rest from the decisions themselves.
import { Game, GameOverSignal, other } from '../../engine/engine';
import type { Agent, Decision, DeckList, GameState, PlayerId } from '../../engine/types';
import { describeDecision, fullTexts, isRollIn, shortEvent } from './describe';
import { instrument, type ReadKind } from './instrument';
import { DEFAULT_MAX_TURNS, writeRecord, type DeckRef, type GameRecord, type RecordEvent, type RecordHeader, type RecordLine } from './notation';

/** One decision as the round-trip check compares it: who, what kind, every option in full, and the one chosen. */
export interface DecisionTrace {
  t: number;
  p: PlayerId;
  kind: string;
  tag?: string;
  options: string[];
  chosen: string;
}

/**
 * Is this decision compared decision by decision? Payment and effect-order choices are asked only of seats that opt in
 * (a record leaves them out when they are all the automatic pick), and a main phase whose only option is to end the turn
 * is asked only of seats that end their turns by hand; neither is a choice the two runs must share.
 */
export const traced = (d: Decision) => d.kind !== 'pay' && d.kind !== 'order' && !(d.kind === 'action' && d.options.length === 1);

export function traceOf(g: Game, d: Decision, chosen: number, texts = fullTexts(describeDecision(g, d))): DecisionTrace {
  const t: DecisionTrace = { t: g.s.turn, p: d.player, kind: d.kind, options: texts, chosen: texts[chosen] ?? `#${chosen}` };
  if (d.tag) t.tag = d.tag;
  return t;
}

/** The short reason a record's result line gives for the engine's reason, or undefined. */
export function reasonCode(winReason: string): string | undefined {
  if (winReason === 'controls 7+ Gigs at start of turn') return '7 gigs';
  if (/in overtime/.test(winReason)) return 'overtime';
  if (/draw from an empty deck/.test(winReason)) return 'deck out';
  if (winReason === 'turn limit reached') return 'turn limit';
  if (/conceded/i.test(winReason)) return 'concession';
  if (/ran out of time/i.test(winReason)) return 'time';
  if (/abandoned/i.test(winReason)) return 'abandoned';
  return undefined;
}

export interface ExportOptions {
  decks: [DeckList, DeckList];
  agents: [Agent, Agent];
  seed: number;
  first?: PlayerId;
  maxTurns?: number;
  /** how the header names each deck (default: the list itself, inline) */
  deckRefs?: [DeckRef, DeckRef];
  players?: [string | null, string | null];
  date?: string;
  source?: string;
}

export interface ExportResult {
  record: GameRecord;
  text: string;
  /** the game as it ended */
  state: GameState;
  decisions: DecisionTrace[];
}

/** An inline deck reference holding the list itself. */
export const inlineDeck = (d: DeckList): DeckRef => ({ kind: 'list', name: d.name, legends: [...d.legends], main: [...d.main] });

/** Play a game with these agents and write its full-information record. */
export async function exportGame(o: ExportOptions): Promise<ExportResult> {
  const lines: RecordEvent[] = [];
  const decisions: DecisionTrace[] = [];
  /** per seat: did it ever pick a payment source / an effect order other than the automatic one? */
  const ownPay = [false, false];
  const ownOrder = [false, false];
  /** pay and order lines with whether they were the automatic pick, filtered at the end */
  const autoPick = new Map<RecordEvent, boolean>();
  const pendingTop: { ev: RecordEvent & { k: 'reveal' | 'mill' }; uid: number }[] = [];
  const pendingRoll: [(RecordEvent & { k: 'roll' }) | null, (RecordEvent & { k: 'roll' }) | null] = [null, null];
  const passWritten = new Set<number>();
  let traceSeen = 0;
  let lastMarker = 0;
  let inst: ReturnType<typeof instrument> | null = null;
  let g!: Game;

  const sync = () => {
    const s = g.s;
    for (const t of pendingTop.splice(0)) if (s.cards[t.uid]?.zone === 'trash') (t.ev as { k: string }).k = 'mill';
    const trace = s.trace ?? [];
    for (; traceSeen < trace.length; traceSeen++) {
      const e = trace[traceSeen]!;
      if (e.k === 'turnEnd' && !passWritten.has(e.t)) {
        passWritten.add(e.t);
        lines.push({ k: 'pass', p: e.p });
      }
    }
    if (s.turn >= 1 && s.turn > lastMarker && s.turn <= s.maxTurns) {
      lastMarker = s.turn;
      lines.push({ k: 'turn', turn: s.turn, p: s.active });
    }
  };

  const wrap = (inner: Agent): Agent => {
    const a: Agent = {
      name: inner.name,
      async decide(game: Game, d: Decision) {
        sync();
        inst?.pause();
        let r: number[];
        try {
          const dd = describeDecision(game, d);
          try {
            r = await inner.decide(game, d);
          } catch (e) {
            if (e instanceof GameOverSignal && game.s.winner !== null) {
              const w = game.s.winner;
              const why = game.s.winReason;
              lines.push(w === 'tie' ? { k: 'end', p: null, how: 'abandoned' } : { k: 'end', p: other(w), how: /ran out of time/i.test(why) ? 'timeout' : 'concedes' });
            }
            throw e;
          }
          const k = r[0] ?? 0;
          const ev = shortEvent(dd, k);
          if (isRollIn(d)) pendingRoll[d.player] = ev as RecordEvent & { k: 'roll' };
          if (ev.k === 'pass') passWritten.add(game.s.turn);
          if (d.kind === 'pay' || d.kind === 'order') {
            autoPick.set(ev, k === 0);
            if (k !== 0) (d.kind === 'pay' ? ownPay : ownOrder)[d.player] = true;
          }
          lines.push(ev);
          if (traced(d)) decisions.push(traceOf(game, d, k, fullTexts(dd)));
        } finally {
          inst?.resume();
        }
        return r;
      },
    };
    if (inner.choosesPayment) a.choosesPayment = true;
    if (inner.choosesOrder) a.choosesOrder = true;
    if (inner.confirmsEndTurn) a.confirmsEndTurn = true;
    return a;
  };

  g = Game.create(o.decks, [wrap(o.agents[0]), wrap(o.agents[1])], {
    seed: o.seed,
    ...(o.first !== undefined ? { first: o.first } : {}),
    ...(o.maxTurns !== undefined ? { maxTurns: o.maxTurns } : {}),
    trace: true,
  });
  const s = g.s;
  const setup: RecordEvent[] = [];
  for (const p of [0, 1] as PlayerId[]) setup.push({ k: 'legends', p, cards: s.players[p].legends.map((u) => ({ id: s.cards[u]!.defId })) });
  for (const p of [0, 1] as PlayerId[]) setup.push({ k: 'hand', p, cards: s.players[p].hand.map((u) => ({ id: s.cards[u]!.defId })) });

  inst = instrument(g, {
    afterRead(p: PlayerId, kind: ReadKind, uids: number[]) {
      sync();
      if (!uids.length) return;
      const cards = uids.map((u) => ({ id: s.cards[u]!.defId }));
      if (kind === 'draw') lines.push({ k: s.turn === 0 ? 'hand' : 'draw', p, cards });
      else if (kind === 'look') lines.push({ k: 'look', p, cards });
      else {
        const ev: RecordEvent & { k: 'reveal' } = { k: 'reveal', p, cards };
        lines.push(ev);
        pendingTop.push({ ev, uid: uids[0]! });
      }
    },
    die(gig, how) {
      sync();
      if (how === 'in') {
        const pr = pendingRoll[gig.owner];
        pendingRoll[gig.owner] = null;
        if (pr && pr.sides === gig.sides && pr.value === null) pr.value = gig.value;
        else lines.push({ k: 'roll', p: gig.owner, sides: gig.sides, value: gig.value });
      } else lines.push({ k: 'roll', p: gig.controller ?? gig.owner, sides: gig.sides, value: gig.value, re: true });
    },
  });
  try {
    await g.run();
  } finally {
    inst.uninstall();
  }
  sync();
  const reason = reasonCode(s.winReason);
  const result: RecordEvent = { k: 'result', winner: s.winner ?? 'tie' };
  if (reason) result.reason = reason;

  // payment and order lines only for a seat that ever chose something other than the automatic pick (then all of them,
  // so each such decision has its line); adjacent reads of the same kind and player become one line
  const body: RecordEvent[] = [];
  for (const ev of [...setup, ...lines, result]) {
    if (ev.k === 'pay' && !ownPay[ev.p] && autoPick.get(ev)) continue;
    if (ev.k === 'order' && !ownOrder[ev.p] && autoPick.get(ev)) continue;
    const prev = body[body.length - 1];
    if (prev && (ev.k === 'draw' || ev.k === 'mill' || ev.k === 'reveal' || ev.k === 'hand') && prev.k === ev.k && 'p' in prev && prev.p === ev.p && setup.indexOf(prev) < 0) {
      prev.cards.push(...ev.cards);
      continue;
    }
    body.push(ev);
  }
  const header: RecordHeader = {
    players: o.players ?? [null, null],
    decks: o.deckRefs ?? [inlineDeck(o.decks[0]), inlineDeck(o.decks[1])],
    first: s.first,
  };
  if (s.maxTurns !== DEFAULT_MAX_TURNS) header.maxTurns = s.maxTurns;
  if (o.date) header.date = o.date;
  if (o.source) header.source = o.source;
  const record: GameRecord = { header, lines: body.map((ev): RecordLine => ({ line: 0, ev })) };
  return { record, text: writeRecord(record), state: s, decisions };
}
