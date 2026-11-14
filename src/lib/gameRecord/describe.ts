// What each option of an engine decision is, in the record's terms (./notation.ts): the exporter writes the chosen one,
// the replay finds the option a line names, and both use the same words, so a record written from a game reads back to
// the same choices. Pure: reads the game, changes nothing.
import { CARD_BY_ID } from '../../engine/cards';
import type { Game } from '../../engine/engine';
import { SCRIPTS } from '../../engine/scripts';
import type { Decision, Opt, PlayerId } from '../../engine/types';
import { CARD_ZONES, eventText, type CardRef, type CardZone, type ChooseVerb, type GigRef, type RecordEvent } from './notation';

/** Which copy of its card a card is, 1-based, in the order of the zone it is in (Gear: along its controller's hosts). */
export function ordinal(g: Game, uid: number): number | undefined {
  const c = g.s.cards[uid];
  if (!c) return undefined;
  if (c.host !== null) {
    let k = 0;
    const ps = g.P(c.controller);
    for (const h of [...ps.field, ...ps.legends])
      for (const gu of g.s.cards[h]?.gear ?? []) {
        if (g.s.cards[gu]?.defId === c.defId) k++;
        if (gu === uid) return k;
      }
    return undefined;
  }
  if (c.zone === 'deck' || c.zone === 'limbo') return undefined; // a deck's order is hidden; a resolving card is alone
  const list = g.zoneList(c.zone === 'field' || c.zone === 'legends' || c.zone === 'eddies' ? c.controller : c.owner, c.zone);
  if (!list) return undefined;
  let k = 0;
  for (const u of list) {
    if (g.s.cards[u]?.defId === c.defId) k++;
    if (u === uid) return k;
  }
  return undefined;
}

/** A card in full: its id, whose it is, where it is and which copy there (see CardRef). */
export function cardRef(g: Game, uid: number): CardRef {
  const c = g.s.cards[uid]!;
  const ref: CardRef = { id: c.defId };
  const inPlay = c.zone === 'field' || c.zone === 'legends' || c.zone === 'eddies';
  ref.who = inPlay ? c.controller : c.owner;
  if ((CARD_ZONES as readonly string[]).includes(c.zone)) ref.zone = c.zone as CardZone;
  const n = ordinal(g, uid);
  if (n !== undefined) ref.n = n;
  return ref;
}

/**
 * What tells a card apart from another copy of it, for the rules: two copies with the same signature are interchangeable
 * (any of them may be the one a line names). Zone and orientation, Gear, the effects on it, its once-per-turn marks.
 */
export function cardSig(g: Game, uid: number): string {
  const c = g.s.cards[uid];
  if (!c) return `?${uid}`;
  // per-card marks are keyed "<name>:<uid>[:...]"; "sell:<player>" and "call:<player>" are per player
  const mine = (key: string) => !/^(sell|call):/.test(key) && key.split(':').slice(1).some((x) => x === String(uid));
  return JSON.stringify([
    c.defId,
    c.zone,
    c.controller,
    c.owner,
    c.spent,
    c.lag,
    c.faceUp,
    !!c.known,
    c.goSolo,
    c.zone === 'field' ? c.enteredTurn : 0,
    c.gear.map((u) => g.s.cards[u]?.defId),
    c.host !== null ? g.s.cards[c.host]?.defId : null,
    g.s.mods.filter((m) => m.target === uid || m.source === uid).map((m) => [m.kind, m.target === uid, m.amount, JSON.stringify((m as { value?: unknown }).value ?? null), m.until, m.untilPlayer]),
    Object.keys(g.s.once).filter(mine).map((k) => k.split(':')[0]),
    Object.keys(g.s.counters).filter(mine).map((k) => k.split(':')[0]),
    g.s.attack ? [g.s.attack.attacker === uid, g.s.attack.targetUnit === uid] : null,
  ]);
}

const abilityCount = (defId: string) => SCRIPTS[defId]?.abilities?.length ?? 0;

function chooseVerb(d: Decision): ChooseVerb {
  if (d.tag === 'discard') return 'discards';
  if (d.tag === 'steal') return 'steals';
  return 'chooses';
}

function gigRef(g: Game, id: number): GigRef {
  const x = g.s.gigs[id]!;
  return { owner: x.owner, sides: x.sides, value: x.value };
}

/** Is this the roll-in choice (which die to roll in from the fixer area)? */
export const isRollIn = (d: Decision) => d.kind === 'gig' && d.tag === 'rollIn';

/**
 * One option in full: every card with its copy number, every Gig with its owner and value. (A record usually writes
 * less: see `shortEvent`.)
 */
export function optionEvent(g: Game, d: Decision, o: Opt, k: number): RecordEvent {
  const p = d.player;
  const a = o.action;
  if (a) {
    switch (a.type) {
      case 'pass':
        return { k: 'pass', p };
      case 'endReact':
        return { k: 'noReaction', p };
      case 'sell':
      case 'play':
      case 'call':
      case 'block':
        return { k: a.type, p, card: cardRef(g, a.uid) };
      case 'goSolo':
        return { k: 'solo', p, card: cardRef(g, a.uid) };
      case 'playLegend':
        return { k: 'play', p, card: cardRef(g, a.uid) };
      case 'activate': {
        const ev: RecordEvent = { k: 'use', p, card: cardRef(g, a.uid) };
        if (a.host !== a.uid) ev.host = cardRef(g, a.host);
        if (abilityCount(g.s.cards[a.uid]!.defId) > 1) ev.ability = a.index + 1;
        return ev;
      }
      case 'attack':
        return { k: 'attack', p, card: cardRef(g, a.uid), target: a.targetUnit !== null ? cardRef(g, a.targetUnit) : 'gigs' };
    }
  }
  if (d.kind === 'yesno' && d.tag === 'mulligan') return { k: 'mulligan', p, yes: o.key === 'yes' };
  if (isRollIn(d)) return { k: 'roll', p, sides: g.s.gigs[o.gig!]!.sides, value: null };
  if (d.kind === 'pay') return { k: 'pay', p, source: o.key === 'eddie' ? 'eddie' : cardRef(g, o.uid!) };
  if (d.kind === 'order') return o.uid !== undefined ? { k: 'order', p, card: cardRef(g, o.uid), n: k + 1 } : { k: 'order', p, card: undefined, n: k + 1 };
  const verb = chooseVerb(d);
  if (o.key === 'yes' || o.key === 'no' || o.key === 'none') return { k: 'choose', p, verb, what: { c: o.key } };
  if (d.kind === 'mode') return { k: 'choose', p, verb, what: { c: 'mode', n: k + 1 } };
  if (o.gig !== undefined) return { k: 'choose', p, verb, what: d.kind === 'gigValue' && o.n !== undefined ? { c: 'gig', gig: gigRef(g, o.gig), to: o.n } : { c: 'gig', gig: gigRef(g, o.gig) } };
  if (o.uid !== undefined) return { k: 'choose', p, verb, what: { c: 'card', card: cardRef(g, o.uid) } };
  if (o.n !== undefined) return { k: 'choose', p, verb, what: { c: 'number', n: o.n } };
  return { k: 'choose', p, verb, what: { c: 'option', n: k + 1 } };
}

/** The uids and Gig ids an option is about, for telling equivalent options apart. */
function optionSig(g: Game, d: Decision, o: Opt, k: number): string {
  const a = o.action;
  const parts: string[] = [];
  if (a) {
    parts.push(a.type);
    if ('uid' in a) parts.push(cardSig(g, a.uid));
    if (a.type === 'activate') parts.push(cardSig(g, a.host), String(a.index));
    if (a.type === 'attack') parts.push(a.targetUnit !== null ? cardSig(g, a.targetUnit) : `gigs${a.targetGigs}`);
    return parts.join('|');
  }
  if (o.uid !== undefined) parts.push(cardSig(g, o.uid));
  if (o.gig !== undefined) parts.push(`gig${o.gig}`);
  if (o.n !== undefined) parts.push(`n${o.n}`);
  if (o.key !== undefined) parts.push(`k${o.key}`);
  if (d.kind === 'mode' || d.kind === 'order' || !parts.length) parts.push(`#${k}`);
  return parts.join('|');
}

// ------------------------------------------------------------------ matching a line to an option

const sameCard = (line: CardRef | null | undefined, opt: CardRef | null | undefined): boolean => {
  if (line === undefined || opt === undefined) return line === opt;
  if (line === null || opt === null) return false;
  return line.id === opt.id && (line.n === undefined || line.n === opt.n) && (line.who === undefined || line.who === opt.who) && (line.zone === undefined || line.zone === opt.zone);
};
const sameGig = (line: GigRef, opt: GigRef) => line.sides === opt.sides && (line.owner === undefined || line.owner === opt.owner) && (line.value === undefined || line.value === opt.value);

/** Does what a line says fit this option (written in full by optionEvent)? Unstated details (which copy, a Gig's owner) fit any. */
export function lineFits(line: RecordEvent, opt: RecordEvent): boolean {
  if ('p' in line && 'p' in opt && line.p !== opt.p) return false;
  switch (line.k) {
    case 'pass':
    case 'noReaction':
      return opt.k === line.k;
    case 'mulligan':
      return opt.k === 'mulligan' && opt.yes === line.yes;
    case 'roll':
      return opt.k === 'roll' && !line.re && opt.sides === line.sides;
    case 'sell':
    case 'play':
    case 'call':
    case 'solo':
    case 'block':
      return opt.k === line.k && sameCard(line.card, opt.card);
    case 'use':
      return opt.k === 'use' && sameCard(line.card, opt.card) && (line.host === undefined || sameCard(line.host, opt.host)) && (line.ability === undefined || line.ability === (opt.ability ?? 1));
    case 'attack':
      if (opt.k !== 'attack' || !sameCard(line.card, opt.card)) return false;
      return line.target === 'gigs' || opt.target === 'gigs' ? line.target === opt.target : sameCard(line.target, opt.target);
    case 'pay':
      if (opt.k !== 'pay') return false;
      return line.source === 'eddie' || opt.source === 'eddie' ? line.source === opt.source : sameCard(line.source, opt.source);
    case 'order':
      if (opt.k !== 'order') return false;
      return line.card === undefined ? line.n === opt.n : sameCard(line.card, opt.card);
    case 'choose': {
      if (opt.k !== 'choose') return false;
      const a = line.what;
      const b = opt.what;
      switch (a.c) {
        case 'yes':
        case 'no':
        case 'none':
          return b.c === a.c;
        case 'mode':
        case 'number':
        case 'option':
          return b.c === a.c && b.n === a.n;
        case 'card':
          return b.c === 'card' && sameCard(a.card, b.card);
        case 'gig':
          return b.c === 'gig' && sameGig(a.gig, b.gig) && a.to === b.to;
      }
      return false;
    }
    default:
      return false;
  }
}

export interface DescribedDecision {
  /** each option in full */
  full: RecordEvent[];
  sigs: string[];
}

export function describeDecision(g: Game, d: Decision): DescribedDecision {
  return { full: d.options.map((o, k) => optionEvent(g, d, o, k)), sigs: d.options.map((o, k) => optionSig(g, d, o, k)) };
}

/** The options a line fits, and whether they are all interchangeable (then any of them is the one it names). */
export function fittingOptions(dd: DescribedDecision, line: RecordEvent): { options: number[]; interchangeable: boolean } {
  const options = dd.full.flatMap((o, k) => (lineFits(line, o) ? [k] : []));
  const first = options[0];
  return { options, interchangeable: first !== undefined && options.every((k) => dd.sigs[k] === dd.sigs[first]) };
}

type RefField = 'card' | 'host' | 'target' | 'source' | 'what';
/** What a card ref may add to its id, from least to most: whose, where, which copy. */
type Detail = 'who' | 'zone' | 'n';
const DETAIL_SETS: readonly (readonly Detail[])[] = [[], ['who'], ['zone'], ['n'], ['who', 'zone'], ['who', 'n'], ['zone', 'n'], ['who', 'zone', 'n']];
type Keep = Partial<Record<RefField, readonly Detail[]>>;

/** A copy of an event with each card ref cut to the details `keep` gives its field, and Gig owners left out unless kept. */
function loosen(ev: RecordEvent, keep: Keep = {}): RecordEvent {
  const strip = (c: CardRef | null | undefined, f: RefField): CardRef | null | undefined => {
    if (!c) return c;
    const out: CardRef = { id: c.id };
    for (const d of keep[f] ?? []) if (c[d] !== undefined) (out as unknown as Record<Detail, unknown>)[d] = c[d];
    return out;
  };
  switch (ev.k) {
    case 'sell':
    case 'play':
    case 'call':
    case 'solo':
    case 'block':
      return { ...ev, card: strip(ev.card, 'card') as CardRef };
    case 'use': {
      const out: RecordEvent = { k: 'use', p: ev.p, card: strip(ev.card, 'card') as CardRef };
      if (ev.host !== undefined) out.host = strip(ev.host, 'host') as CardRef;
      if (ev.ability !== undefined) out.ability = ev.ability;
      return out;
    }
    case 'attack':
      return { ...ev, card: strip(ev.card, 'card') as CardRef, target: ev.target === 'gigs' ? 'gigs' : (strip(ev.target, 'target') as CardRef) };
    case 'pay':
      return { ...ev, source: ev.source === 'eddie' ? 'eddie' : (strip(ev.source, 'source') as CardRef) };
    case 'order':
      return ev.card === undefined ? ev : { k: 'order', p: ev.p, card: strip(ev.card, 'card') as CardRef };
    case 'choose': {
      const w = ev.what;
      if (w.c === 'card') return { ...ev, what: { c: 'card', card: strip(w.card, 'what') as CardRef } };
      if (w.c === 'gig') {
        const gig: GigRef = { sides: w.gig.sides };
        if (w.gig.value !== undefined) gig.value = w.gig.value;
        if (keep.what?.includes('who') && w.gig.owner !== undefined) gig.owner = w.gig.owner;
        return { ...ev, what: w.to !== undefined ? { c: 'gig', gig, to: w.to } : { c: 'gig', gig } };
      }
      return ev;
    }
    default:
      return ev;
  }
}

/** The card-ref fields an event has (a Gig choice counts as 'what': its owner is its one detail). */
function refFields(ev: RecordEvent): RefField[] {
  switch (ev.k) {
    case 'sell':
    case 'play':
    case 'call':
    case 'solo':
    case 'block':
      return ev.card ? ['card'] : [];
    case 'use':
      return ev.host ? ['card', 'host'] : ['card'];
    case 'attack':
      return ev.target === 'gigs' ? ['card'] : ['card', 'target'];
    case 'pay':
      return ev.source === 'eddie' ? [] : ['source'];
    case 'order':
      return ev.card ? ['card'] : [];
    case 'choose':
      return ev.what.c === 'card' || ev.what.c === 'gig' ? ['what'] : [];
    default:
      return [];
  }
}

/** Every way to give the fields their details, fewest details first. */
function keeps(fields: RefField[]): Keep[] {
  let out: Keep[] = [{}];
  for (const f of fields) out = out.flatMap((k) => DETAIL_SETS.map((d) => ({ ...k, [f]: d })));
  const size = (k: Keep) => Object.values(k).reduce((n, d) => n + (d?.length ?? 0), 0);
  return out.sort((a, b) => size(a) - size(b));
}

/**
 * The way a record writes option k: as little as makes the replay pick the same option. The replay refuses a line that
 * fits options that are not the same (another copy with Gear, or spent, or the rival's), and takes the first of options
 * that are, so a card is given whose it is, where it is or which copy only when without it the line would fit a
 * different option, or the same card in an earlier place of its zone (in hand, in the trash, on the field), which would
 * change that zone's order. A Gig keeps its value: it says which Gig to a reader at a glance.
 */
export function shortEvent(dd: DescribedDecision, k: number): RecordEvent {
  const full = dd.full[k]!;
  for (const keep of keeps(refFields(full))) {
    const ev = loosen(full, keep);
    const fits = fittingOptions(dd, ev);
    if (fits.options[0] === k && fits.interchangeable) return ev;
  }
  if (full.k === 'order') return { k: 'order', p: full.p, card: undefined, n: full.n ?? k + 1 };
  return full;
}

/** An option as a message lists it: the line without its player, a die to roll in without a result. */
export const optionText = (ev: RecordEvent) => (ev.k === 'roll' && ev.value === null ? `rolls in d${ev.sides}` : eventText(ev).replace(/^p[12] /, ''));

/** The text of every option as a record would write it (for messages), one per group of options that are the same. */
export function optionTexts(dd: DescribedDecision): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  dd.full.forEach((_, k) => {
    const sig = dd.sigs[k]!;
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push(optionText(shortEvent(dd, k)));
  });
  return out;
}

/** A one-phrase description of what a decision asks, for messages ("choose a main-phase action"). */
export function decisionWhat(g: Game, d: Decision): string {
  const src = d.source !== undefined && g.s.cards[d.source] ? CARD_BY_ID[g.s.cards[d.source]!.defId]?.displayName : undefined;
  switch (d.kind) {
    case 'action':
      return 'choose a main-phase action';
    case 'reaction':
      return 'react to an attack';
    case 'mulligan':
      return 'keep or mulligan';
    case 'pay':
      return 'choose what pays';
    case 'order':
      return 'choose which effect resolves first';
    default:
      if (d.kind === 'yesno' && d.tag === 'mulligan') return 'keep or mulligan';
      if (isRollIn(d)) return 'choose which Gig to roll in';
      return `answer "${d.prompt}"${src && !d.prompt.includes(src) ? ` (${src})` : ''}`;
  }
}

/** The decision's options in full, as text: what the round-trip comparison compares, decision by decision. */
export function fullTexts(dd: DescribedDecision): string[] {
  return dd.full.map((e) => eventText(e));
}

export const seatName = (p: PlayerId) => (p === 0 ? 'p1' : 'p2');
