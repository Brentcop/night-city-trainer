// Package context for the bots and the coach (docs/ROADMAP2.md §1 step 4, docs/SYNERGIES.md "How scoring uses packages").
//
// For one seat: the synergy packages its own list is built around (the deck objective's `synergies` when the owner named
// them for this exact list, else `synergiesIn(list)` with `builtAround`), and per-state facts about each one from that
// player's own view: pieces in hand, in play, among the Legends, in the trash and still in the deck, whether a partner of a
// piece can still be had, and, for the Gig-value and Street Cred packages, how close the Gigs are to what the package
// wants. A bot only ever asks about its own seat: never the rival's list or hidden cards.
//
// Plain data and pure functions; the per-list part is computed once per list fingerprint and cached here, outside the
// game state (bots structuredClone the state). Every evaluation term that uses it is weighted in src/ai/eval.ts
// (pkgHold, pkgAssembly, pkgSteer, pkgProtect), all 0 by default.
import type { Game } from '../engine/engine';
import { CARD_BY_ID } from '../engine/cards';
import { listFingerprint } from '../engine/deck';
import type { Gig, PlayerId } from '../engine/types';
import { covers, memberName, roleMap, SYNERGY_BY_ID, synergiesIn, zeroRoles, type PieceCount, type RoleCounts, type Synergy, type SynergyCondition, type SynergyRole } from '../content/synergies/index';
import { DECK_OBJECTIVES } from '../content/deckObjectives/index';

/** A quantity the deck's own choices can move toward a package's condition (which Gig to roll in, take or adjust). */
export type SteerKind = 'cred-low' | 'cred-high' | 'cred-20' | 'cred-even' | 'min-gig' | 'high-gig' | 'value-pair' | 'gig-spread';

export interface SeatPackage {
  id: string;
  name: string;
  family: Synergy['family'];
  bond: Synergy['bond'];
  needs: PieceCount;
  roles: ReadonlyMap<string, SynergyRole>;
  /** the steerable quantities in the package's `online` condition (none for board, trash, tempo or type packages) */
  steer: readonly SteerKind[];
  /** named in the deck objective for this list, or found by `builtAround` */
  source: 'objective' | 'built-around';
}

// ------------------------------------------------------------------ per list (cached)

/** Steerable quantities named by a condition (nested terms included). */
export function steerOf(c: SynergyCondition): SteerKind[] {
  const out = new Set<SteerKind>();
  const walk = (x: SynergyCondition) => {
    switch (x.term) {
      case 'all':
      case 'any':
        x.of.forEach(walk);
        break;
      case 'cred-vs-rival':
        out.add(x.cmp === 'less' ? 'cred-low' : 'cred-high');
        break;
      case 'cred-at-least':
        // the only threshold in the catalogue (Yorinobu: Embracing Destruction); another value would need its own kind
        if (x.value === 20) out.add('cred-20');
        break;
      case 'cred-even':
        out.add('cred-even');
        break;
      case 'min-gig':
        out.add('min-gig');
        break;
      case 'high-gig':
      case 'max-gig':
        out.add('high-gig');
        break;
      case 'value-pair':
        out.add('value-pair');
        break;
      case 'distinct-values':
      case 'even-and-odd':
        out.add('gig-spread');
        break;
      default:
        break;
    }
  };
  walk(c);
  return [...out];
}

function toSeat(s: Synergy, source: SeatPackage['source']): SeatPackage {
  return { id: s.id, name: s.name, family: s.family, bond: s.bond, needs: s.needs, roles: roleMap(s), steer: steerOf(s.online), source };
}

/** Objective-named packages per list fingerprint (only notes written for that exact list). */
let objectiveByList: Map<string, string[]> | null = null;
function objectivePackages(listId: string): string[] | undefined {
  if (!objectiveByList) {
    objectiveByList = new Map();
    for (const note of Object.values(DECK_OBJECTIVES)) if (note.synergies?.length) objectiveByList.set(note.listId, note.synergies);
  }
  return objectiveByList.get(listId);
}

const BY_LIST = new Map<string, readonly SeatPackage[]>();

/** The packages a list is built around: the objective's `synergies` when named for this list, else the built-around ones. */
export function packagesForList(deck: { legends: readonly string[]; main: readonly string[] }, listId = listFingerprint(deck as { legends: string[]; main: string[] })): readonly SeatPackage[] {
  let out = BY_LIST.get(listId);
  if (out) return out;
  const named = objectivePackages(listId);
  if (named) out = named.filter((id) => SYNERGY_BY_ID[id]).map((id) => toSeat(SYNERGY_BY_ID[id], 'objective'));
  else out = synergiesIn({ legends: [...deck.legends], main: [...deck.main] }).filter((x) => x.builtAround).map((x) => toSeat(x.synergy, 'built-around'));
  BY_LIST.set(listId, out);
  return out;
}

/** The list a seat plays, rebuilt from the cards it owns (only when the state carries no list fingerprint). */
function ownList(g: Game, p: PlayerId): { legends: string[]; main: string[] } {
  const legends: string[] = [];
  const main: string[] = [];
  for (const c of Object.values(g.s.cards)) {
    if (c.owner !== p) continue;
    (CARD_BY_ID[c.defId]?.type === 'Legend' ? legends : main).push(c.defId);
  }
  return { legends, main };
}

/** The packages seat p's own list is built around (cached by list fingerprint). */
export function seatPackages(g: Game, p: PlayerId): readonly SeatPackage[] {
  const id = g.P(p).listId;
  if (id) {
    const hit = BY_LIST.get(id);
    if (hit) return hit;
    return packagesForList(ownList(g, p), id);
  }
  return packagesForList(ownList(g, p));
}

// ------------------------------------------------------------------ per state

/** Where p's own copies of one package's members are, by role. */
export interface PackageFacts {
  pkg: SeatPackage;
  hand: RoleCounts;
  /** Units on the field (Legends there included), equipped Gear, face-up Legends in the Legends area */
  play: RoleCounts;
  /** face-down Legends (the owner knows which Legends are in the pool, not always which slot is which) */
  legendsDown: RoleCounts;
  trash: RoleCounts;
  deck: RoleCounts;
}

const add = (a: RoleCounts, b: RoleCounts): RoleCounts => ({ enabler: a.enabler + b.enabler, payoff: a.payoff + b.payoff, both: a.both + b.both, piece: a.piece + b.piece });
const total = (r: RoleCounts) => r.enabler + r.payoff + r.both + r.piece;

/** Facts for each of seat p's packages, from p's own view (own hand and deck contents, public board). */
export function packageFacts(g: Game, p: PlayerId, pkgs: readonly SeatPackage[] = seatPackages(g, p)): PackageFacts[] {
  if (!pkgs.length) return [];
  const P = g.P(p);
  const zones: { key: Exclude<keyof PackageFacts, 'pkg'>; ids: string[] }[] = [
    { key: 'hand', ids: P.hand.map((u) => g.c(u).defId) },
    { key: 'play', ids: inPlayIds(g, p) },
    { key: 'legendsDown', ids: P.legends.map((u) => g.c(u)).filter((c) => !c.faceUp).map((c) => c.defId) },
    { key: 'trash', ids: P.trash.map((u) => g.c(u).defId) },
    { key: 'deck', ids: P.deck.map((u) => g.c(u).defId) },
  ];
  return pkgs.map((pkg) => {
    const f: PackageFacts = { pkg, hand: zeroRoles(), play: zeroRoles(), legendsDown: zeroRoles(), trash: zeroRoles(), deck: zeroRoles() };
    for (const z of zones)
      for (const id of z.ids) {
        const r = pkg.roles.get(id);
        if (r) f[z.key][r]++;
      }
    return f;
  });
}

/** Card ids in play for p: Units on the field (Legends included), Gear equipped to them or to Legends, face-up Legends. */
export function inPlayIds(g: Game, p: PlayerId): string[] {
  const P = g.P(p);
  const out: string[] = [];
  for (const u of P.field) {
    const c = g.c(u);
    if (c.zone !== 'field') continue;
    out.push(c.defId);
    for (const x of c.gear) out.push(g.c(x).defId);
  }
  for (const u of P.legends) {
    const c = g.c(u);
    if (!c.faceUp) continue;
    out.push(c.defId);
    for (const x of c.gear) out.push(g.c(x).defId);
  }
  return out;
}

/** Pieces p can use now or soon: in hand, in play, or among the Legends (the catalogue counts Legends as held). */
export const availableOf = (f: PackageFacts) => add(add(f.hand, f.play), f.legendsDown);
/** Pieces p can still get: available, or still in the deck. */
export const obtainableOf = (f: PackageFacts) => add(availableOf(f), f.deck);

/** The roles that complete a piece of `role` (a `both` or `piece` card is completed by any other member). */
export function partnerRoles(role: SynergyRole, pkg: SeatPackage): SynergyRole[] {
  const split = (pkg.needs.enabler ?? 0) > 0 || (pkg.needs.payoff ?? 0) > 0;
  if (!split || role === 'piece' || role === 'both') return ['enabler', 'payoff', 'both', 'piece'];
  return role === 'enabler' ? ['payoff', 'both'] : ['enabler', 'both'];
}

const countRoles = (r: RoleCounts, roles: readonly SynergyRole[]) => roles.reduce((a, k) => a + r[k], 0);

/**
 * Whether a piece of `role` (one copy of it set aside, e.g. the card about to be sold) still has a partner p can get:
 * in hand, in play, among the Legends or in the deck.
 */
export function partnerObtainable(f: PackageFacts, role: SynergyRole): boolean {
  const pool = obtainableOf(f);
  const roles = partnerRoles(role, f.pkg);
  // the copy being judged is in hand: don't count it as its own partner
  const self = roles.includes(role) ? 1 : 0;
  return countRoles(pool, roles) - self >= 1;
}

/** Both halves (or two members) available together, covering what the package needs. */
export function assembled(f: PackageFacts): boolean {
  const a = availableOf(f);
  return covers(a, f.pkg.needs) && total(a) >= 2;
}

/** A payoff (or, for a package without one, any member) in hand, in play or among the Legends: something to use the condition. */
export function payoffAvailable(f: PackageFacts): boolean {
  const a = availableOf(f);
  const hasPayoffs = f.pkg.needs.payoff !== undefined || [...f.pkg.roles.values()].some((r) => r === 'payoff' || r === 'both');
  return hasPayoffs ? a.payoff + a.both > 0 : total(a) > 0;
}

// ------------------------------------------------------------------ the evaluation terms (unweighted)

/** The roles that can stand in for a piece of `role` (a `both` card stands in for either half). */
const sameRoles = (role: SynergyRole): SynergyRole[] => (role === 'enabler' ? ['enabler', 'both'] : role === 'payoff' ? ['payoff', 'both'] : role === 'both' ? ['enabler', 'payoff', 'both'] : ['piece', 'enabler', 'payoff', 'both']);

/**
 * pkgHold: how much keeping card `defId` is worth to p's packages. Per package whose partner p can still get: 1
 * (`helps` ½) divided by the copies p can still get that do the same job (this one included), so the last payoff counts
 * fully and one of twelve Programs-as-fuel barely at all. At most 2 over all packages.
 */
export function holdCredit(facts: readonly PackageFacts[], defId: string): number {
  let v = 0;
  for (const f of facts) {
    const r = f.pkg.roles.get(defId);
    if (!r || !partnerObtainable(f, r)) continue;
    const fill = Math.max(1, countRoles(obtainableOf(f), sameRoles(r)));
    v += (f.pkg.bond === 'requires' ? 1 : 0.5) / fill;
  }
  return Math.min(2, v);
}

/** pkgAssembly: 1 per package (`helps` ½) whose pieces are available together. */
export function assemblyCredit(facts: readonly PackageFacts[]): number {
  let v = 0;
  for (const f of facts) if (assembled(f)) v += f.pkg.bond === 'requires' ? 1 : 0.5;
  return v;
}

/** pkgProtect: for `requires` packages assembled IN PLAY, the members in play (at most 3): losing one costs this much. */
export function protectCredit(facts: readonly PackageFacts[]): number {
  let v = 0;
  for (const f of facts) {
    if (f.pkg.bond !== 'requires') continue;
    if (!covers(f.play, f.pkg.needs) || total(f.play) < 2) continue;
    v += Math.min(3, total(f.play));
  }
  return v;
}

const cred = (gigs: readonly Pick<Gig, 'value'>[]) => gigs.reduce((a, x) => a + x.value, 0);
const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));

/** How far a set of Gigs is toward a steerable quantity, in [−1, 1] (1 = the condition holds with room to spare). */
export function steerValue(kind: SteerKind, mine: readonly Pick<Gig, 'value' | 'sides'>[], theirs: readonly Pick<Gig, 'value' | 'sides'>[]): number {
  switch (kind) {
    case 'cred-low':
      // Null (no Gigs) counts as the lowest Street Cred
      return clamp1((cred(theirs) - cred(mine)) / 6);
    case 'cred-high':
      return clamp1((cred(mine) - cred(theirs)) / 6);
    case 'cred-20':
      // as cred-high, with 20 in place of the rival's Street Cred: 0 at 19, 1/6 at 20
      return clamp1((cred(mine) - 19) / 6);
    case 'cred-even':
      return mine.length && cred(mine) % 2 === 0 ? 1 : 0;
    case 'min-gig': {
      const ones = mine.filter((x) => x.value === 1).length;
      const twos = mine.filter((x) => x.value === 2).length;
      return (Math.min(2, ones) + 0.25 * Math.min(2, twos)) / 2;
    }
    case 'high-gig':
      return Math.min(2, mine.filter((x) => x.value >= 8 || x.value === x.sides).length) / 2;
    case 'value-pair': {
      const counts = new Map<number, number>();
      for (const x of mine) counts.set(x.value, (counts.get(x.value) ?? 0) + 1);
      let pairs = 0;
      for (const n of counts.values()) pairs += Math.floor(n / 2);
      return Math.min(2, pairs) / 2;
    }
    case 'gig-spread': {
      const distinct = new Set(mine.map((x) => x.value)).size;
      const evenOdd = mine.some((x) => x.value % 2 === 0) && mine.some((x) => x.value % 2 === 1);
      return distinct >= 3 || evenOdd ? 1 : (0.5 * distinct) / 3;
    }
  }
}

/** The steering kinds that count now: of packages with a payoff available to use the condition (each kind once). */
export function activeSteer(facts: readonly PackageFacts[]): SteerKind[] {
  const out = new Set<SteerKind>();
  for (const f of facts) if (f.pkg.steer.length && payoffAvailable(f)) for (const k of f.pkg.steer) out.add(k);
  return [...out];
}

/** pkgSteer: the sum of steerValue over the active kinds. */
export function steerCredit(kinds: readonly SteerKind[], mine: readonly Pick<Gig, 'value' | 'sides'>[], theirs: readonly Pick<Gig, 'value' | 'sides'>[]): number {
  let v = 0;
  for (const k of kinds) v += steerValue(k, mine, theirs);
  return v;
}

// ------------------------------------------------------------------ plain words (coach)

const STEER_WANT: Record<SteerKind, string> = {
  'cred-low': 'your Street Cred below the rival’s',
  'cred-high': 'your Street Cred above the rival’s',
  'cred-20': 'your Street Cred at 20 or more',
  'cred-even': 'your Street Cred even',
  'min-gig': 'a Gig at its lowest value',
  'high-gig': 'a Gig at 8 or more',
  'value-pair': 'two Gigs with the same value',
  'gig-spread': 'Gigs on different values',
};
export const steerWants = (k: SteerKind) => STEER_WANT[k];

/** The best partner card to name for a piece: the first member of a partner role p still has (hand, play, Legends, deck). */
export function partnerName(g: Game, p: PlayerId, f: PackageFacts, defId: string): string | null {
  const role = f.pkg.roles.get(defId);
  if (!role) return null;
  const roles = partnerRoles(role, f.pkg);
  const P = g.P(p);
  const pools = [P.hand, [...P.field, ...P.legends.filter((u) => g.c(u).faceUp)], P.legends, P.deck];
  for (const pool of pools)
    for (const u of pool) {
      const id = g.c(u).defId;
      if (id === defId) continue;
      const r = f.pkg.roles.get(id);
      if (r && roles.includes(r)) return memberName(id);
    }
  return null;
}
