// Synergy catalogue (docs/SYNERGIES.md, docs/ROADMAP2.md §1): the packages, their resolved members, which packages a
// deck list contains, the draw odds of holding the needed pieces, and the `online` condition evaluator the telemetry
// observer (src/analysis/synergies.ts) uses. Plain data and pure functions only: the site, the CLI workers and tests
// all import it. Not imported by the Home entry chunk.
import { CARD_BY_ID, CARDS } from '../../engine/cards';
import { fingerprintText } from '../../engine/deck';
import type { CardDef, CardType, DeckList } from '../../engine/types';
import { SYNERGY_LIST } from './catalogue';
import type { CardPredicate, PieceCount, Synergy, SynergyCondition, SynergyRole } from './vocabulary';

export * from './vocabulary';

export const SYNERGIES: readonly Synergy[] = SYNERGY_LIST;
export const SYNERGY_BY_ID: Readonly<Record<string, Synergy>> = Object.fromEntries(SYNERGY_LIST.map((s) => [s.id, s]));
/** The packages that are switched on (not `dormant`), in catalogue order: what builders, scoring and headlines use by default. */
export const ACTIVE_SYNERGIES: readonly Synergy[] = SYNERGY_LIST.filter((s) => !s.dormant);
export const isDormant = (id: string) => !!SYNERGY_BY_ID[id]?.dormant;

/** Fingerprint of the catalogue: a report made with another catalogue says so (its packages may have changed). */
export const CATALOGUE_VERSION = `fnv1a64:${fingerprintText(JSON.stringify(SYNERGY_LIST))}`;

/** Cards in an opening hand; the engine draws one more at the start of every turn, the first player's first included. */
export const OPENING_HAND = 6;
/** The rounds (your own turns) the draw odds and the report's "by round" columns use. */
export const ODDS_ROUNDS: readonly number[] = [2, 4, 6];

/** Does a card belong to a plain-data class? (`text` is matched case-insensitively.) */
export function matchesPredicate(c: CardDef, p: CardPredicate): boolean {
  if (p.types) {
    const asUnit = p.goSoloLegends && p.types.includes('Unit') && c.type === 'Legend' && c.keywords.includes('goSolo');
    if (!p.types.includes(c.type) && !asUnit) return false;
  }
  if (p.tagsAny && !p.tagsAny.some((t) => c.tags.includes(t))) return false;
  if (p.keyword && !c.keywords.includes(p.keyword)) return false;
  if (p.minPower !== undefined && (c.power ?? 0) < p.minPower) return false;
  if (p.text !== undefined && !new RegExp(p.text, 'i').test(c.text)) return false;
  return true;
}

export interface ResolvedMember {
  id: string;
  role: SynergyRole;
  note?: string;
  /** 'explicit', or the label of the group the card came from */
  from: string;
}

const resolved = new Map<string, ResolvedMember[]>();
/** Every member of a package: the explicit ones first, then each group's cards (an explicit entry wins over a group). */
export function membersOf(s: Synergy): ResolvedMember[] {
  let out = resolved.get(s.id);
  if (out) return out;
  out = s.members.map((m) => ({ ...m, from: 'explicit' }));
  const have = new Set(out.map((m) => m.id));
  for (const g of s.groups ?? []) {
    const except = new Set((g.except ?? []).map((e) => e.id));
    for (const c of CARDS) {
      if (have.has(c.id) || except.has(c.id) || !matchesPredicate(c, g.where)) continue;
      have.add(c.id);
      out.push({ id: c.id, role: g.role, from: g.label });
    }
  }
  resolved.set(s.id, out);
  return out;
}

/** Card id → role in the package. */
export function roleMap(s: Synergy): Map<string, SynergyRole> {
  return new Map(membersOf(s).map((m) => [m.id, m.role]));
}

/** A member's role matches a role filter: no filter matches all; a `both` card matches 'enabler' and 'payoff'. */
export function roleMatches(role: SynergyRole, filter?: readonly SynergyRole[]): boolean {
  if (!filter) return true;
  return filter.includes(role) || (role === 'both' && (filter.includes('enabler') || filter.includes('payoff')));
}

export type RoleCounts = Record<SynergyRole, number>;
export const zeroRoles = (): RoleCounts => ({ enabler: 0, payoff: 0, both: 0, piece: 0 });

/** Whether held pieces (by role) cover a PieceCount: `both` cards fill enabler or payoff shortfalls, one each. */
export function covers(have: RoleCounts, need: PieceCount): boolean {
  const short = Math.max(0, (need.enabler ?? 0) - have.enabler) + Math.max(0, (need.payoff ?? 0) - have.payoff);
  if (short > have.both) return false;
  return have.enabler + have.payoff + have.both + have.piece >= (need.any ?? 0);
}

/** Whether a list's copies meet the "built around" minimum (here a `both` card counts toward each role it plays). */
export function meetsBuiltAround(copies: RoleCounts, min: PieceCount): boolean {
  const total = copies.enabler + copies.payoff + copies.both + copies.piece;
  return total >= (min.any ?? 0) && copies.enabler + copies.both >= (min.enabler ?? 0) && copies.payoff + copies.both >= (min.payoff ?? 0);
}

// ------------------------------------------------------------------ draw odds

const LOG_FACT: number[] = [0];
function logFact(n: number): number {
  for (let k = LOG_FACT.length; k <= n; k++) LOG_FACT.push(LOG_FACT[k - 1] + Math.log(k));
  return LOG_FACT[n];
}
const logChoose = (n: number, k: number) => (k < 0 || k > n ? -Infinity : logFact(n) - logFact(k) - logFact(n - k));

/**
 * Probability of holding the package's needed pieces after seeing `seen` cards of a `deckSize`-card main deck
 * (multivariate hypergeometric, exact). `main` and `legends` are the copies per role in the main deck and among the
 * Legends; Legends are counted as held from the start (they sit in the Legends area, though a face-down one still has to
 * be Called before it does anything).
 */
export function holdOdds(main: RoleCounts, legends: RoleCounts, deckSize: number, seen: number, need: PieceCount): number {
  const n = Math.max(0, Math.min(deckSize, seen));
  const rest = deckSize - main.enabler - main.payoff - main.both - main.piece;
  if (rest < 0) return 0;
  const total = logChoose(deckSize, n);
  let p = 0;
  for (let e = 0; e <= Math.min(main.enabler, n); e++)
    for (let y = 0; y <= Math.min(main.payoff, n - e); y++)
      for (let b = 0; b <= Math.min(main.both, n - e - y); b++)
        for (let q = 0; q <= Math.min(main.piece, n - e - y - b); q++) {
          const r = n - e - y - b - q;
          if (r > rest) continue;
          if (!covers({ enabler: e + legends.enabler, payoff: y + legends.payoff, both: b + legends.both, piece: q + legends.piece }, need)) continue;
          p += Math.exp(logChoose(main.enabler, e) + logChoose(main.payoff, y) + logChoose(main.both, b) + logChoose(main.piece, q) + logChoose(rest, r) - total);
        }
  return Math.min(1, p);
}

/** Cards seen by the end of your own `round`-th draw: the opening hand plus one per turn (the same on the play and the draw here). */
export const cardsSeenBy = (round: number) => OPENING_HAND + round;

// ------------------------------------------------------------------ a list's packages

export interface ListSynergy {
  synergy: Synergy;
  /** copies per role: main deck plus Legends */
  copies: RoleCounts;
  /** of those, among the Legends */
  legends: RoleCounts;
  /** the member cards in the list */
  cards: { id: string; role: SynergyRole; copies: number }[];
  /** the list meets the package's builtAround minimum (never for a dormant package) */
  builtAround: boolean;
  /** odds of holding the needed pieces by your own turn N (ODDS_ROUNDS) */
  odds: { round: number; p: number }[];
}

/**
 * The packages a list contains: those whose needed pieces it holds at all (every copy drawn would cover `needs`),
 * with copies per role, whether it is built around each, and the draw odds. Most built-around first, then by copies.
 * A dormant package is still listed when the list holds it, but never as built around.
 */
export function synergiesIn(deck: Pick<DeckList, 'legends' | 'main'>): ListSynergy[] {
  const out: ListSynergy[] = [];
  for (const s of SYNERGIES) {
    const roles = roleMap(s);
    const main = zeroRoles();
    const legends = zeroRoles();
    const counts = new Map<string, number>();
    for (const id of deck.main) {
      const r = roles.get(id);
      if (!r) continue;
      main[r]++;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const id of deck.legends) {
      const r = roles.get(id);
      if (!r) continue;
      legends[r]++;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const copies: RoleCounts = { enabler: main.enabler + legends.enabler, payoff: main.payoff + legends.payoff, both: main.both + legends.both, piece: main.piece + legends.piece };
    if (!covers(copies, s.needs)) continue;
    out.push({
      synergy: s,
      copies,
      legends,
      cards: [...counts].map(([id, n]) => ({ id, role: roles.get(id)!, copies: n })).sort((a, b) => b.copies - a.copies || a.id.localeCompare(b.id)),
      builtAround: !s.dormant && meetsBuiltAround(copies, s.builtAround),
      odds: ODDS_ROUNDS.map((round) => ({ round, p: holdOdds(main, legends, deck.main.length, cardsSeenBy(round), s.needs) })),
    });
  }
  const size = (x: ListSynergy) => x.copies.enabler + x.copies.payoff + x.copies.both + x.copies.piece;
  return out.sort((a, b) => Number(b.builtAround) - Number(a.builtAround) || size(b) - size(a) || a.synergy.id.localeCompare(b.synergy.id));
}

// ------------------------------------------------------------------ the online condition

/** What a condition is evaluated against: one player's own view at one moment (see BoardSnapshot in src/engine/telemetry.ts). */
export interface SynergyView {
  /** card ids in play for the player: Units on the field (Legends there included), equipped Gear, face-up Legends in the Legends area */
  inPlay: readonly string[];
  /** card ids the player used this turn, one entry per use */
  used: readonly string[];
  /** friendly Gigs as [sides, value] */
  gigs: readonly (readonly [number, number])[];
  cred: number | null;
  opCred: number | null;
  gigCount: number;
  opGigCount: number;
  equipped: number;
  legendsUp: number;
  trash: Partial<Record<CardType, number>>;
  /** printed costs of the cards in the player's own hand (absent in older snapshots: treated as none) */
  handCosts?: readonly number[];
  /** card ids in the player's own trash (public; absent in older snapshots: treated as none) */
  trashCards?: readonly string[];
}

function valuePairs(gigs: SynergyView['gigs']): number {
  const counts = new Map<number, number>();
  for (const [, v] of gigs) counts.set(v, (counts.get(v) ?? 0) + 1);
  let pairs = 0;
  for (const n of counts.values()) pairs += Math.floor(n / 2);
  return pairs;
}
const lessCred = (a: number | null, b: number | null) => (a === null ? b !== null : b !== null && a < b);
const moreCred = (a: number | null, b: number | null) => (a === null ? false : b === null || a > b);

/** Does `c` hold for package `s` (whose members' roles are `roles`) in view `v`? */
export function conditionHolds(c: SynergyCondition, v: SynergyView, roles: ReadonlyMap<string, SynergyRole>): boolean {
  const count = (ids: readonly string[], filter?: readonly SynergyRole[]) => {
    let n = 0;
    for (const id of ids) {
      const r = roles.get(id);
      if (r && roleMatches(r, filter)) n++;
    }
    return n;
  };
  switch (c.term) {
    case 'all':
      return c.of.every((x) => conditionHolds(x, v, roles));
    case 'any':
      return c.of.some((x) => conditionHolds(x, v, roles));
    case 'in-play':
      return count(v.inPlay, c.role) >= c.min;
    case 'used':
      return count(v.used, c.role) >= (c.min ?? 1);
    case 'min-gig':
      return v.gigs.filter(([, val]) => val === 1).length >= c.min;
    case 'high-gig':
      return v.gigs.filter(([, val]) => val >= (c.at ?? 8)).length >= c.min;
    case 'max-gig':
      return v.gigs.filter(([sides, val]) => val === sides).length >= c.min;
    case 'value-pair':
      return valuePairs(v.gigs) >= c.min;
    case 'distinct-values':
      return new Set(v.gigs.map(([, val]) => val)).size >= c.min;
    case 'even-and-odd':
      return v.gigs.some(([, val]) => val % 2 === 0) && v.gigs.some(([, val]) => val % 2 === 1);
    case 'cred-even':
      return v.cred !== null && v.cred % 2 === 0;
    case 'cred-vs-rival':
      return c.cmp === 'less' ? lessCred(v.cred, v.opCred) : moreCred(v.cred, v.opCred);
    case 'cred-at-least':
      return v.cred !== null && v.cred >= c.value;
    case 'gig-cost-match': {
      const costs = new Set(v.handCosts ?? []);
      return v.gigs.filter(([, val]) => costs.has(val)).length >= c.min;
    }
    case 'in-trash': {
      const ids = new Set(c.ids);
      return (v.trashCards ?? []).filter((id) => ids.has(id)).length >= c.min;
    }
    case 'gigs-behind':
      return v.opGigCount - v.gigCount >= c.by;
    case 'equipped':
      return v.equipped >= c.min;
    case 'legends-up':
      return v.legendsUp >= c.min;
    case 'trash':
      return (v.trash[c.type] ?? 0) >= c.min;
  }
}

/** Every term a condition uses, nested ones included (tests check each is defined). */
export function termsOf(c: SynergyCondition): string[] {
  return c.term === 'all' || c.term === 'any' ? [c.term, ...c.of.flatMap(termsOf)] : [c.term];
}

/** Every card id a condition names (`in-trash`), nested ones included (tests check each is a real card). */
export function conditionCardIds(c: SynergyCondition): string[] {
  if (c.term === 'all' || c.term === 'any') return c.of.flatMap(conditionCardIds);
  return c.term === 'in-trash' ? [...c.ids] : [];
}

/** A card's display label, or its id. */
export const memberName = (id: string) => CARD_BY_ID[id]?.displayName ?? id;
