// Replay: a full-information record (./notation.ts) drives a real game, from any random seed, so that every decision and
// every chance outcome is the record's. Nothing in the engine changes; ./instrument.ts gives the hooks:
//  - opening hands and Legend layouts: arranged in the state right after Game.create, before the game starts;
//  - who goes first and the turn limit: passed to Game.create;
//  - every draw, mill, reveal and look: just before the engine reads the top of a deck, the recorded cards are put
//    there (a copy of each card from further down the deck changes places with what was on top);
//  - every die: while the next line is a roll, each random number is drawn from a state picked (by walking the RNG's own
//    sequence) so that the die shows the recorded result;
//  - every decision: the line is matched to one of the options the engine offers (./describe.ts).
// It is strict: where the record cannot be followed (a move that is not legal there, a card the deck doesn't hold, a
// line the engine never reaches, a game that goes on past the record or stops before it) the replay stops and says in one
// sentence which line, what it says and what the engine offers. It never guesses and never skips a line. The one thing
// it answers by itself is a choice the record leaves out and the engine decides by rule anyway: a payment source or an
// effect order with no line (the automatic pick), a choice with a single option, and the end of a turn with nothing else
// to do.
import { Game, GameOverSignal, other } from '../../engine/engine';
import { nextRandom } from '../../engine/rng';
import type { Agent, Decision, DeckList, GameState, Gig, PlayerId } from '../../engine/types';
import { decisionWhat, describeDecision, fittingOptions, fullTexts, isRollIn, optionText, optionTexts, seatName, shortEvent, type DescribedDecision } from './describe';
import { reasonCode, traceOf, traced, type DecisionTrace } from './exporter';
import { instrument, type Instrument, type ReadKind } from './instrument';
import { cardName, DEFAULT_MAX_TURNS, eventText, hasUnknown, type DeckRef, type GameRecord, type RecordEvent, type RecordLine } from './notation';

export interface ReplayOptions {
  /** the seed the game is created with; any seed gives the same game, since every chance outcome comes from the record */
  seed: number;
  /** turn a header's deck into a list (a library lookup for `file` and `name`); a string says why it can't */
  resolveDeck(ref: DeckRef, seat: PlayerId): DeckList | string;
  /**
   * Called at each decision, after the line that answers it is found and before the answer is given. Hooks are off and
   * the state is plain data, so a coach or bot may look at (or copy) the game here. `line` is null for an answer the
   * replay gave by rule (see the file header).
   */
  onDecision?(x: { game: Game; decision: Decision; line: RecordLine | null; answer: number }): void | Promise<void>;
}

export interface ReplayStop {
  /** the record line it stopped at (1-based), or null when the record ran out or the header is the problem */
  line: number | null;
  message: string;
}

export interface ReplayResult {
  ok: boolean;
  stop?: ReplayStop;
  /** the game's state where it ended or stopped (null when it never started) */
  state: GameState | null;
  decisions: DecisionTrace[];
}

class RecordStop extends Error {
  constructor(
    readonly line: number | null,
    message: string,
  ) {
    super(message);
  }
}

const quote = (l: RecordLine) => `“${eventText(l.ev)}”`;
const saysAt = (l: RecordLine) => `Line ${l.line} says ${quote(l)}`;
const list = (xs: string[], max = 10) => (xs.length > max ? `${xs.slice(0, max).join(', ')} and ${xs.length - max} more` : xs.join(', '));

/** Which line kinds may answer a decision of this kind. */
function answerKinds(d: Decision): RecordEvent['k'][] {
  if (d.kind === 'action') return ['pass', 'sell', 'play', 'call', 'solo', 'use', 'attack'];
  if (d.kind === 'reaction') return ['noReaction', 'call', 'block', 'play', 'use'];
  if (d.kind === 'yesno' && d.tag === 'mulligan') return ['mulligan'];
  if (isRollIn(d)) return ['roll'];
  if (d.kind === 'pay') return ['pay'];
  if (d.kind === 'order') return ['order'];
  return ['choose'];
}

const readWords = (kind: ReadKind, p: PlayerId, n: number) =>
  kind === 'draw' ? `draws a card for ${seatName(p)}` : kind === 'top' ? `reads the top card of ${seatName(p)}'s deck` : `looks at the top ${n === 1 ? 'card' : `${n} cards`} of ${seatName(p)}'s deck`;
const readExample = (kind: ReadKind, p: PlayerId) => (kind === 'draw' ? `${seatName(p)} draws …` : kind === 'top' ? `${seatName(p)} reveals …” or “${seatName(p)} mills …` : `${seatName(p)} looks at …`);

const resultWords = (w: PlayerId | 'tie' | null) => (w === null || w === 'tie' ? 'a draw' : `a win for ${seatName(w)}`);

/** Replay a record. Resolves with ok, or with where and why it stopped; never throws for a record that doesn't fit. */
export async function replayRecord(rec: GameRecord, o: ReplayOptions): Promise<ReplayResult> {
  const decisions: DecisionTrace[] = [];
  let game: Game | null = null;
  const fail = (line: number | null, message: string): ReplayResult => ({ ok: false, stop: { line, message }, state: game?.s ?? null, decisions });

  // ---- what this replay can't take: hidden cards, unknown decks
  for (const p of [0, 1] as PlayerId[])
    if (rec.header.decks[p].kind === 'unknown') return fail(null, `The header does not say ${seatName(p)}'s deck (“${seatName(p)} deck: ?”); this replay needs both deck lists.`);
  if (rec.header.first === null) return fail(null, 'The header does not say who goes first (“first: ?”); this replay needs it.');
  for (const l of rec.lines)
    if (hasUnknown(l.ev)) return fail(l.line, `${saysAt(l)}, which holds a hidden card or value (?); this replay needs every card and every die, and records with hidden information can't be replayed yet.`);

  const decks: DeckList[] = [];
  for (const p of [0, 1] as PlayerId[]) {
    const d = o.resolveDeck(rec.header.decks[p], p);
    if (typeof d === 'string') return fail(null, d);
    decks.push(d);
  }

  // ---- the setup lines: both Legend layouts and opening hands, before anything else
  const L = rec.lines.filter((l) => l.ev.k !== 'note');
  const legends: (RecordLine | null)[] = [null, null];
  const hands: (RecordLine | null)[] = [null, null];
  let cur = 0;
  for (; cur < L.length; cur++) {
    const l = L[cur]!;
    if (l.ev.k !== 'legends' && l.ev.k !== 'hand') break;
    const slot = l.ev.k === 'legends' ? legends : hands;
    if (slot[l.ev.p]) return fail(l.line, `${saysAt(l)}, but ${seatName(l.ev.p)}'s ${l.ev.k === 'legends' ? 'Legends were' : 'opening hand was'} already given at line ${slot[l.ev.p]!.line}.`);
    slot[l.ev.p] = l;
  }
  for (const p of [0, 1] as PlayerId[]) {
    if (!legends[p]) return fail(L[cur]?.line ?? null, `The record must give ${seatName(p)}'s Legends, left to right (“${seatName(p)} legends: …”), before the game starts.`);
    if (!hands[p]) return fail(L[cur]?.line ?? null, `The record must give ${seatName(p)}'s opening hand (“${seatName(p)} hand: …”) before the game starts.`);
  }

  // ---- the agents: each answers from the record
  const choosesPayment = [false, false];
  const choosesOrder = [false, false];
  for (const l of L) {
    if (l.ev.k === 'pay') choosesPayment[l.ev.p] = true;
    if (l.ev.k === 'order') choosesOrder[l.ev.p] = true;
  }
  let used = 0; // cards of L[cur] already read (card lines)
  let rollChosen = false; // L[cur] is a roll whose die choice was made and whose result is still to come
  const passConsumed = new Set<number>();
  let traceSeen = 0;
  let inst: Instrument | null = null;
  const peek = () => L[cur];
  const advance = () => {
    cur++;
    used = 0;
    rollChosen = false;
  };

  /** Lines the engine passes by itself: turn starts, and ends of turn it made with nothing else to do. */
  const settle = (g: Game) => {
    const s = g.s;
    const trace = s.trace ?? [];
    for (; traceSeen < trace.length; traceSeen++) {
      const e = trace[traceSeen]!;
      if (e.k !== 'turnEnd' || passConsumed.has(e.t)) continue;
      passConsumed.add(e.t);
      const l = peek();
      if (l && l.ev.k === 'pass' && l.ev.p === e.p) advance();
    }
    for (;;) {
      const l = peek();
      if (!l || l.ev.k !== 'turn') break;
      if (s.turn === l.ev.turn) {
        if (l.ev.p !== undefined && l.ev.p !== s.active) throw new RecordStop(l.line, `${saysAt(l)}, but turn ${s.turn} is ${seatName(s.active)}'s.`);
        advance();
        continue;
      }
      if (s.turn > l.ev.turn) throw new RecordStop(l.line, `${saysAt(l)}, but the game is already in turn ${s.turn} there.`);
      break;
    }
  };

  const optionsWords = (dd: DescribedDecision) => list(optionTexts(dd));

  const agent = (seat: PlayerId): Agent => {
    const a: Agent = {
      name: `record ${seatName(seat)}`,
      async decide(g: Game, d: Decision) {
        inst?.pause();
        try {
          settle(g);
          const dd = describeDecision(g, d);
          const what = decisionWhat(g, d);
          const l = peek();
          if (l && l.ev.k === 'end') {
            advance();
            const ev = l.ev;
            if (ev.how === 'abandoned') g.endGame('tie', 'abandoned');
            const p = ev.p ?? d.player;
            g.endGame(other(p), ev.how === 'concedes' ? `${seatName(p)} conceded` : `${seatName(p)} ran out of time`);
          }
          let k = 0;
          let line: RecordLine | null = null;
          const kinds = answerKinds(d);
          const fitsHere = (x: RecordLine | undefined) => !!x && kinds.includes(x.ev.k) && 'p' in x.ev && x.ev.p === d.player && !(x.ev.k === 'roll' && (x.ev.re || rollChosen));
          if (d.kind === 'pay' || d.kind === 'order' || d.options.length === 1) {
            // left out = the automatic pick (option 0); a line is used when it is there and names an option
            if (fitsHere(l)) {
              const f = fittingOptions(dd, l!.ev);
              if (f.options.length && (f.interchangeable || d.options.length === 1)) {
                k = f.options[0]!;
                line = l!;
              } else if (d.kind === 'pay' || d.kind === 'order') {
                throw new RecordStop(l!.line, `${saysAt(l!)}, but ${seatName(d.player)} can't pay or resolve that here; the engine offers: ${optionsWords(dd)}.`);
              }
            }
          } else {
            if (!l) throw new RecordStop(null, `The record ends, but the game goes on: at turn ${g.s.turn} the engine asks ${seatName(d.player)} to ${what}; the options are: ${optionsWords(dd)}.`);
            if (l.ev.k === 'result') throw new RecordStop(l.line, `${saysAt(l)}, but the game is not over: at turn ${g.s.turn} the engine asks ${seatName(d.player)} to ${what}; the options are: ${optionsWords(dd)}.`);
            if (!fitsHere(l)) throw new RecordStop(l.line, `${saysAt(l)}, but here the engine asks ${seatName(d.player)} to ${what}; the options are: ${optionsWords(dd)}.`);
            const f = fittingOptions(dd, l.ev);
            if (!f.options.length) throw new RecordStop(l.line, `${saysAt(l)}, but that is not one of the options here (turn ${g.s.turn}, ${seatName(d.player)} to ${what}): ${optionsWords(dd)}.`);
            if (!f.interchangeable) {
              const texts = [...new Set(f.options.map((j) => optionText(shortEvent(dd, j))))];
              throw new RecordStop(l.line, `${saysAt(l)}, which fits more than one option that are not the same: ${list(texts)}; say whose it is (p1's, p2's), where it is (from hand, from trash...) or which copy ([n], counted in the order of its zone).`);
            }
            k = f.options[0]!;
            line = l;
          }
          if (line) {
            if (line.ev.k === 'roll') rollChosen = true;
            else advance();
            if (line.ev.k === 'pass') passConsumed.add(g.s.turn);
          }
          if (traced(d)) decisions.push(traceOf(g, d, k, fullTexts(dd)));
          await o.onDecision?.({ game: g, decision: d, line, answer: k });
          return [k];
        } finally {
          inst?.resume();
        }
      },
    };
    if (choosesPayment[seat]) a.choosesPayment = true;
    if (choosesOrder[seat]) a.choosesOrder = true;
    return a;
  };

  const h = rec.header;
  const g = Game.create([decks[0]!, decks[1]!], [agent(0), agent(1)], { seed: o.seed, first: h.first!, maxTurns: h.maxTurns ?? DEFAULT_MAX_TURNS, trace: true });
  game = g;
  const s = g.s;

  // ---- arrange the setup: Legend slots (the first player's two left-most spent, rule 7.7.4) and opening hands
  for (const p of [0, 1] as PlayerId[]) {
    const ps = s.players[p];
    const ll = legends[p]!;
    if (ll.ev.k !== 'legends') continue;
    const pool = [...ps.legends];
    const laid: number[] = [];
    for (const c of ll.ev.cards) {
      const i = pool.findIndex((u) => s.cards[u]!.defId === c!.id);
      if (i < 0) return fail(ll.line, `${saysAt(ll)}, but ${seatName(p)}'s deck list has no Legend ${cardName(c!.id)}${laid.some((u) => s.cards[u]!.defId === c!.id) ? ' twice' : ''}.`);
      laid.push(pool.splice(i, 1)[0]!);
    }
    if (pool.length) return fail(ll.line, `${saysAt(ll)}, but ${seatName(p)}'s deck list also has ${list(pool.map((u) => cardName(s.cards[u]!.defId)))}: name every Legend, left to right.`);
    ps.legends = laid;
    laid.forEach((u, i) => (s.cards[u]!.spent = p === s.first && i < 2));
    const hl = hands[p]!;
    if (hl.ev.k !== 'hand') continue;
    const all = [...ps.hand, ...ps.deck];
    const hand: number[] = [];
    for (const c of hl.ev.cards) {
      const i = all.findIndex((u) => s.cards[u]!.defId === c!.id);
      if (i < 0) return fail(hl.line, `${saysAt(hl)}, but ${seatName(p)}'s deck list has ${hand.some((u) => s.cards[u]!.defId === c!.id) ? 'no more copies of' : 'no'} ${cardName(c!.id)}.`);
      hand.push(all.splice(i, 1)[0]!);
    }
    if (hand.length !== ps.hand.length) return fail(hl.line, `${saysAt(hl)}, but an opening hand has ${ps.hand.length} cards, not ${hand.length}.`);
    for (const u of hand) s.cards[u]!.zone = 'hand';
    for (const u of all) s.cards[u]!.zone = 'deck';
    ps.hand = hand;
    ps.deck = all;
  }

  const takeCards = (p: PlayerId, kind: ReadKind, count: number): { ids: string[]; lines: RecordLine[] } => {
    const ids: string[] = [];
    const lines: RecordLine[] = [];
    while (ids.length < count) {
      const l = peek();
      const ok = (ev: RecordEvent) => 'p' in ev && ev.p === p && (kind === 'draw' ? ev.k === (s.turn === 0 ? 'hand' : 'draw') : ev.k === 'mill' || ev.k === 'reveal' || ev.k === 'look');
      if (!l) throw new RecordStop(null, `The record ends, but the game goes on: at turn ${s.turn} the engine ${readWords(kind, p, count)}.`);
      if (!ok(l.ev) || !('cards' in l.ev)) throw new RecordStop(l.line, `${saysAt(l)}, but here the engine ${readWords(kind, p, count)}; the record should say which (“${readExample(kind, p)}”).`);
      const cards = l.ev.cards;
      lines.push(l);
      while (used < cards.length && ids.length < count) ids.push(cards[used++]!.id);
      if (used >= cards.length) advance();
    }
    return { ids, lines };
  };

  inst = instrument(g, {
    rng(state) {
      // while the next line (past turn starts and ends of turn) is a die, draw every random number so it shows that result
      let i = cur;
      while (L[i] && (L[i]!.ev.k === 'turn' || L[i]!.ev.k === 'pass')) i++;
      const l = L[i];
      if (!l || l.ev.k !== 'roll' || l.ev.value === null) return state;
      const want = l.ev.value - 1;
      const sides = l.ev.sides;
      let pre = state;
      for (let k = 0; k < 1_000_000; k++) {
        const probe = { rng: pre };
        if (Math.floor(nextRandom(probe) * sides) === want) return pre;
        pre = probe.rng;
      }
      return state;
    },
    beforeRead(p, kind, n, deck) {
      settle(g);
      const count = Math.min(kind === 'look' ? n : 1, deck.length);
      if (!count) return;
      const { ids, lines } = takeCards(p, kind, count);
      const where = lines[0]!;
      for (let t = 0; t < count; t++) {
        const want = ids[t]!;
        if (s.cards[deck[t]!]!.defId === want) continue;
        let j = -1;
        for (let x = t + 1; x < deck.length; x++)
          if (s.cards[deck[x]!]!.defId === want) {
            j = x;
            break;
          }
        if (j < 0) {
          const inList = decks[p]!.main.includes(want);
          throw new RecordStop(where.line, `${saysAt(where)}, but ${seatName(p)}'s deck holds no ${cardName(want)} there${inList ? '' : ` (${seatName(p)}'s deck list has none)`}.`);
        }
        [deck[t], deck[j]] = [deck[j]!, deck[t]!];
      }
    },
    die(gig: Gig, how) {
      settle(g);
      const who = how === 'in' ? gig.owner : (gig.controller ?? gig.owner);
      const doing = `${how === 'in' ? 'rolls in' : 'rerolls'} ${seatName(who)}'s d${gig.sides}`;
      const l = peek();
      if (!l) throw new RecordStop(null, `The record ends, but the game goes on: at turn ${s.turn} the engine ${doing}.`);
      const ev = l.ev;
      if (ev.k !== 'roll' || !!ev.re !== (how === 're') || ev.p !== who || ev.sides !== gig.sides)
        throw new RecordStop(l.line, `${saysAt(l)}, but here the engine ${doing}; the record should give its result (“${seatName(who)} ${how === 'in' ? 'rolls in' : 'rerolls'} d${gig.sides}: …”).`);
      if (ev.value !== gig.value) throw new RecordStop(l.line, `${saysAt(l)}, but the die could not be made to show ${ev.value} (it shows ${gig.value}).`);
      advance();
    },
  });

  try {
    await g.run();
  } catch (e) {
    inst.uninstall();
    if (e instanceof RecordStop) return fail(e.line, e.message);
    if (e instanceof GameOverSignal) return fail(null, `The game ended unexpectedly: ${e.message}.`);
    return fail(L[cur]?.line ?? null, `The engine failed while replaying${L[cur] ? ` near line ${L[cur]!.line}` : ''}: ${(e as Error).message}`);
  }
  inst.uninstall();
  try {
    settle(g);
  } catch (e) {
    if (e instanceof RecordStop) return fail(e.line, e.message);
    throw e;
  }
  const end = `the game ended at turn ${s.turn} with ${resultWords(s.winner)}${reasonCode(s.winReason) ? ` (${reasonCode(s.winReason)})` : ''}`;
  const l = peek();
  if (l && (used > 0 || rollChosen)) return fail(l.line, `${saysAt(l)}, but ${end} before all of it happened.`);
  if (l && l.ev.k !== 'result') return fail(l.line, `The record goes on, but ${end}: line ${l.line} says ${quote(l)}.`);
  if (l && l.ev.k === 'result') {
    if ((l.ev.winner === 'tie' ? 'tie' : l.ev.winner) !== (s.winner ?? 'tie')) return fail(l.line, `${saysAt(l)}, but ${end}.`);
    const code = reasonCode(s.winReason);
    if (l.ev.reason && code && l.ev.reason !== code) return fail(l.line, `${saysAt(l)}, but ${end}.`);
    advance();
  }
  return { ok: true, state: s, decisions };
}
