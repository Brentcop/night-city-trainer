// Synergy packages in deck building (docs/ROADMAP2.md §1 step 3, docs/SYNERGIES.md "Using packages when building").
//
// The deck builders (season breeder, forge, optimizer, Deck Lab) change one card at a time and score cards one by one,
// so on their own they can cut one half of a pair or never try a whole package. This module is the shared, plain-data
// layer they all use:
//   - a PackagePlan (keep / require / avoid packages, lock cards) with one check for a candidate change and one for a
//     whole list, so a builder filters its candidates before any game is played;
//   - package moves beside the one-card swaps: complete a half-present package, add one, remove one, swap one for
//     another of similar size; every list they produce is legal (validateDeck) and respects the plan;
//   - seeding: the Legend trios that can hold one or two packages (with a plain reason when two can't share a deck),
//     and a template-filled list topped up to each package's built-around minimum.
// Pure functions over plain data: the Node scripts, the browser Deck Lab and the tests all import it. It never imports
// the breeder (the breeder imports it), so callers pass their own fill and card scores.
import { CARD_BY_ID, CARDS, cardLabel } from '../engine/cards';
import { counts, ramLimits, validateDeck } from '../engine/deck';
import type { CardDef, Color, DeckList } from '../engine/types';
import { CATALOGUE_VERSION, SYNERGIES, SYNERGY_BY_ID, covers, isDormant, meetsBuiltAround, membersOf, roleMap, zeroRoles, type PieceCount, type RoleCounts, type Synergy, type SynergyCondition, type SynergyRole } from '../content/synergies';

// ---------------------------------------------------------------- the plan

/**
 * What the owner dictates about packages for one build. Plain data (it is stored in manifests and deck notes).
 *   keep       packages whose pieces in the starting list may not be cut below the package's working minimum: its
 *              built-around minimum when the list meets it, else the pieces it needs at all (`needs`). Cards beyond that
 *              minimum stay free to change. A package the list does not hold is not affected.
 *   require    the result must be built around these (a change may not move a list further away from them).
 *   avoid      the result must not be built around these (a change may not add their pieces while it is).
 *   lockCards  card id → copies that may not be cut (a list holding fewer keeps what it has).
 */
export interface PackagePlan {
  keep?: string[];
  require?: string[];
  avoid?: string[];
  lockCards?: Record<string, number>;
}

/** Every package id, in catalogue order (dormant ones included: they may still be named by id). */
export const PACKAGE_IDS: readonly string[] = SYNERGIES.map((s) => s.id);
/** The ids builders use when not told otherwise: every package that is not dormant. */
export const ACTIVE_PACKAGE_IDS: readonly string[] = PACKAGE_IDS.filter((id) => !isDormant(id));
export const packageName = (id: string) => SYNERGY_BY_ID[id]?.name ?? id;

export function isEmptyPlan(p?: PackagePlan | null): boolean {
  return !p || (!p.keep?.length && !p.require?.length && !p.avoid?.length && !Object.keys(p.lockCards ?? {}).length);
}

/** The plan without empty parts (what manifests and headers record). */
export function compactPlan(p: PackagePlan): PackagePlan {
  return {
    ...(p.keep?.length ? { keep: [...p.keep] } : {}),
    ...(p.require?.length ? { require: [...p.require] } : {}),
    ...(p.avoid?.length ? { avoid: [...p.avoid] } : {}),
    ...(Object.keys(p.lockCards ?? {}).length ? { lockCards: { ...p.lockCards } } : {}),
  };
}

/** What is wrong with a plan: unknown package or card ids, a package both kept or required and avoided, bad lock counts. */
export function planProblems(p: PackagePlan): string[] {
  const out: string[] = [];
  for (const [part, ids] of [
    ['keep', p.keep],
    ['require', p.require],
    ['avoid', p.avoid],
  ] as const)
    for (const id of ids ?? []) if (!SYNERGY_BY_ID[id]) out.push(`${part}: unknown package "${id}"`);
  const avoid = new Set(p.avoid ?? []);
  for (const id of new Set([...(p.keep ?? []), ...(p.require ?? [])])) if (avoid.has(id)) out.push(`"${id}" is both ${p.require?.includes(id) ? 'required' : 'kept'} and avoided`);
  for (const [id, n] of Object.entries(p.lockCards ?? {})) {
    const c = CARD_BY_ID[id];
    if (!c) out.push(`lock: unknown card "${id}"`);
    else if (c.type === 'Legend') out.push(`lock: ${cardLabel(c)} is a Legend (package changes never touch Legends)`);
    if (!Number.isInteger(n) || n < 1 || n > 3) out.push(`lock: ${id} needs 1–3 copies, got ${n}`);
  }
  return out;
}

/** "keep Low Gigs; require …; avoid …; lock 2× X" */
export function describePlan(p: PackagePlan): string {
  const names = (ids?: string[]) => (ids ?? []).map(packageName).join(', ');
  const parts: string[] = [];
  if (p.keep?.length) parts.push(`keep ${names(p.keep)}`);
  if (p.require?.length) parts.push(`require ${names(p.require)}`);
  if (p.avoid?.length) parts.push(`avoid ${names(p.avoid)}`);
  const lock = Object.entries(p.lockCards ?? {});
  if (lock.length) parts.push(`lock ${lock.map(([id, n]) => `${n}× ${label(id)}`).join(', ')}`);
  return parts.join('; ') || 'no package plan';
}

// ---------------------------------------------------------------- parsing (CLI flags, shared with tests)

const VALID = () => `Valid ids: ${PACKAGE_IDS.join(', ')}`;

/** A comma-separated package list ("low-cred,program-fuel"); "none" is an empty list. */
export function parsePackageList(text: string): { ids: string[]; error?: string } {
  const t = text.trim();
  if (!t || t === 'none') return { ids: [] };
  const ids = [...new Set(t.split(',').map((x) => x.trim()).filter(Boolean))];
  const bad = ids.filter((id) => !SYNERGY_BY_ID[id]);
  if (bad.length) return { ids: [], error: `unknown package id${bad.length > 1 ? 's' : ''} ${bad.map((b) => `"${b}"`).join(', ')}. ${VALID()}` };
  return { ids };
}

/** Seed combinations: "a+b,c" → [[a, b], [c]]; one or two packages each, and the two must be able to share a deck. */
export function parseSeedCombos(text: string): { combos: string[][]; error?: string } {
  const combos: string[][] = [];
  for (const part of text.split(',').map((x) => x.trim()).filter(Boolean)) {
    const ids = [...new Set(part.split('+').map((x) => x.trim()).filter(Boolean))];
    const bad = ids.filter((id) => !SYNERGY_BY_ID[id]);
    if (bad.length) return { combos: [], error: `unknown package id${bad.length > 1 ? 's' : ''} ${bad.map((b) => `"${b}"`).join(', ')}. ${VALID()}` };
    if (ids.length > 2) return { combos: [], error: `"${part}": seed one or two packages at a time` };
    const c = packageCompatibility(ids);
    if (!c.ok) return { combos: [], error: c.reason };
    combos.push(ids);
  }
  if (!combos.length) return { combos: [], error: `name one or two packages, e.g. low-cred+program-fuel. ${VALID()}` };
  return { combos };
}

/** Locked cards: "id:2,id" (no count = every copy the list has, i.e. 3). */
export function parseLockCards(text: string): { lock: Record<string, number>; error?: string } {
  const lock: Record<string, number> = {};
  for (const part of text.split(',').map((x) => x.trim()).filter(Boolean)) {
    const m = part.match(/^([a-z0-9_]+)(?::(\d+))?$/);
    if (!m) return { lock: {}, error: `"${part}": write card-id or card-id:copies` };
    lock[m[1]!] = m[2] ? +m[2] : 3;
  }
  const p = planProblems({ lockCards: lock });
  return p.length ? { lock: {}, error: p.join('; ') } : { lock };
}

// ---------------------------------------------------------------- copies and minimums

const label = (id: string) => {
  const c = CARD_BY_ID[id];
  return c ? cardLabel(c) : id;
};
const total = (r: RoleCounts) => r.enabler + r.payoff + r.both + r.piece;
const plus = (a: RoleCounts, b: RoleCounts): RoleCounts => ({ enabler: a.enabler + b.enabler, payoff: a.payoff + b.payoff, both: a.both + b.both, piece: a.piece + b.piece });

export interface PackageCopies {
  main: RoleCounts;
  legends: RoleCounts;
  /** main plus Legends */
  copies: RoleCounts;
}
/** A package's copies per role in a list (main deck and Legends). */
export function packageCopies(s: Synergy, deck: Pick<DeckList, 'legends' | 'main'>): PackageCopies {
  const roles = roleMap(s);
  const main = zeroRoles();
  const legends = zeroRoles();
  for (const id of deck.main) {
    const r = roles.get(id);
    if (r) main[r]++;
  }
  for (const id of deck.legends) {
    const r = roles.get(id);
    if (r) legends[r]++;
  }
  return { main, legends, copies: plus(main, legends) };
}

/** The list meets the package's built-around minimum (by count; a dormant package too, when it is named by id). */
export const isBuiltAround = (id: string, deck: Pick<DeckList, 'legends' | 'main'>) => {
  const s = SYNERGY_BY_ID[id];
  return !!s && meetsBuiltAround(packageCopies(s, deck).copies, s.builtAround);
};
/** The list holds the package's needed pieces at all. */
export const holdsPackage = (id: string, deck: Pick<DeckList, 'legends' | 'main'>) => {
  const s = SYNERGY_BY_ID[id];
  return !!s && covers(packageCopies(s, deck).copies, s.needs);
};
/** Ids of the packages a list is built around, in catalogue order (never a dormant one). */
export const builtAroundIds = (deck: Pick<DeckList, 'legends' | 'main'>) => ACTIVE_PACKAGE_IDS.filter((id) => isBuiltAround(id, deck));

/** How many pieces short of a built-around minimum (0 when met); a `both` card counts toward each role. */
export function shortfall(c: RoleCounts, min: PieceCount): number {
  const e = Math.max(0, (min.enabler ?? 0) - c.enabler - c.both);
  const p = Math.max(0, (min.payoff ?? 0) - c.payoff - c.both);
  return Math.max(e + p, (min.any ?? 0) - total(c));
}

/** "2 enablers, 2 payoffs, 6 pieces in all" */
export function minimumText(m: PieceCount): string {
  const parts: string[] = [];
  if (m.enabler) parts.push(`${m.enabler} enabler${m.enabler === 1 ? '' : 's'}`);
  if (m.payoff) parts.push(`${m.payoff} payoff${m.payoff === 1 ? '' : 's'}`);
  if (m.any) parts.push(`${m.any} piece${m.any === 1 ? '' : 's'} in all`);
  return parts.join(', ');
}

/**
 * The working minimum `keep` protects in a list: the built-around minimum when the list meets it, otherwise the pieces
 * the package needs at all (both roles for a package whose pieces need each other). Null when the list doesn't hold it.
 */
export function keepFloor(s: Synergy, copies: RoleCounts): { kind: 'built-around' | 'needs'; min: PieceCount; met: (c: RoleCounts) => boolean } | null {
  if (meetsBuiltAround(copies, s.builtAround)) return { kind: 'built-around', min: s.builtAround, met: (c) => meetsBuiltAround(c, s.builtAround) };
  if (covers(copies, s.needs)) return { kind: 'needs', min: s.needs, met: (c) => covers(c, s.needs) };
  return null;
}

// ---------------------------------------------------------------- checks

export interface Violation {
  rule: 'keep' | 'require' | 'avoid' | 'lock' | 'deck';
  /** the package or card id the rule is about ('' for a deck-construction error) */
  id: string;
  text: string;
}

function diff(before: Pick<DeckList, 'legends' | 'main'>, after: Pick<DeckList, 'legends' | 'main'>): { cut: Map<string, number>; added: Map<string, number> } {
  const a = counts([...before.main, ...before.legends]);
  const b = counts([...after.main, ...after.legends]);
  const cut = new Map<string, number>();
  const added = new Map<string, number>();
  for (const [id, n] of a) if ((b.get(id) ?? 0) < n) cut.set(id, n - (b.get(id) ?? 0));
  for (const [id, n] of b) if ((a.get(id) ?? 0) < n) added.set(id, n - (a.get(id) ?? 0));
  return { cut, added };
}
const listCards = (m: Map<string, number>, ids?: (id: string) => boolean) =>
  [...m]
    .filter(([id]) => !ids || ids(id))
    .map(([id, n]) => `${n}× ${label(id)}`)
    .join(', ');

/**
 * Does changing `before` into `after` break the plan? Relative checks only (what this change does); `checkList` checks a
 * whole list. Empty when the change is allowed. Deck construction is not checked here (validateDeck does that).
 */
export function checkChange(before: Pick<DeckList, 'legends' | 'main'>, after: Pick<DeckList, 'legends' | 'main'>, plan: PackagePlan): Violation[] {
  if (isEmptyPlan(plan)) return [];
  const out: Violation[] = [];
  const d = diff(before, after);
  if (!d.cut.size && !d.added.size) return out;
  for (const id of plan.keep ?? []) {
    const s = SYNERGY_BY_ID[id];
    if (!s) continue;
    const floor = keepFloor(s, packageCopies(s, before).copies);
    if (!floor || floor.met(packageCopies(s, after).copies)) continue;
    const roles = roleMap(s);
    out.push({
      rule: 'keep',
      id,
      text: `cuts ${listCards(d.cut, (c) => roles.has(c))} from kept package ${s.name}, below its ${floor.kind === 'built-around' ? 'built-around minimum' : 'working pieces'} (${minimumText(floor.min)})`,
    });
  }
  for (const id of plan.require ?? []) {
    const s = SYNERGY_BY_ID[id];
    if (!s) continue;
    const was = shortfall(packageCopies(s, before).copies, s.builtAround);
    const now = shortfall(packageCopies(s, after).copies, s.builtAround);
    if (now > was) out.push({ rule: 'require', id, text: `moves away from required package ${s.name} (${now} pieces short of ${minimumText(s.builtAround)}, was ${was})` });
  }
  for (const id of plan.avoid ?? []) {
    const s = SYNERGY_BY_ID[id];
    if (!s) continue;
    const roles = roleMap(s);
    const adds = [...d.added.keys()].filter((c) => roles.has(c));
    if (adds.length && meetsBuiltAround(packageCopies(s, after).copies, s.builtAround))
      out.push({ rule: 'avoid', id, text: `adds ${listCards(d.added, (c) => roles.has(c))}, pieces of avoided package ${s.name}, while the list is built around it` });
  }
  for (const [id, n] of Object.entries(plan.lockCards ?? {})) {
    const had = d.cut.get(id);
    if (!had) continue;
    const before_ = before.main.filter((x) => x === id).length;
    const left = before_ - had;
    if (left < Math.min(n, before_)) out.push({ rule: 'lock', id, text: `cuts ${had}× ${label(id)}, locked at ${Math.min(n, before_)}` });
  }
  return out;
}

/** Does a whole list meet the plan and the deck-construction rules? (keep and require: built around; avoid: not built around; locks: held.) */
export function checkList(deck: DeckList, plan: PackagePlan): Violation[] {
  const out: Violation[] = validateDeck({ ...deck, sideboard: [] }).map((text) => ({ rule: 'deck' as const, id: '', text }));
  for (const [rule, ids] of [
    ['keep', plan.keep],
    ['require', plan.require],
  ] as const)
    for (const id of ids ?? []) {
      const s = SYNERGY_BY_ID[id];
      if (s && !meetsBuiltAround(packageCopies(s, deck).copies, s.builtAround)) out.push({ rule, id, text: `not built around ${s.name} (needs ${minimumText(s.builtAround)})` });
    }
  for (const id of plan.avoid ?? []) {
    const s = SYNERGY_BY_ID[id];
    if (s && meetsBuiltAround(packageCopies(s, deck).copies, s.builtAround)) out.push({ rule: 'avoid', id, text: `built around avoided package ${s.name}` });
  }
  for (const [id, n] of Object.entries(plan.lockCards ?? {})) {
    const have = deck.main.filter((x) => x === id).length;
    if (have < n && have < 3) out.push({ rule: 'lock', id, text: `holds ${have}× ${label(id)}, locked at ${n}` });
  }
  return out;
}

/** Can one card be cut (one copy) under the plan? The builders pick their cut candidates through this. */
export const canCut = (deck: DeckList, id: string, plan: PackagePlan) => {
  const i = deck.main.indexOf(id);
  if (i < 0) return false;
  const main = [...deck.main];
  main.splice(i, 1);
  return !checkChange(deck, { ...deck, main }, plan).length;
};

// ---------------------------------------------------------------- package moves

export type PackageMoveKind = 'complete' | 'add' | 'swap' | 'remove';
export const PACKAGE_MOVE_KINDS: readonly PackageMoveKind[] = ['complete', 'add', 'swap', 'remove'];

export interface PackageMove {
  kind: PackageMoveKind;
  label: string;
  deck: DeckList;
  /** the package the move adds or completes (swap: the one swapped in) */
  added: string | null;
  /** the package the move removes (swap: the one swapped out) */
  removed: string | null;
  /** card ids in and out, one entry per copy */
  cardsIn: string[];
  cardsOut: string[];
  /** sum of the builder's card scores in, minus out (orders candidates; the games decide) */
  prior: number;
}

export interface PackageMoveOptions {
  plan?: PackagePlan;
  /** the builder's card score (higher is better): picks members to add, fillers, and the cheapest cuts */
  score?: (id: string) => number;
  kinds?: readonly PackageMoveKind[];
  /** only these packages may be added, completed or swapped in (default: every package that is not dormant; a dormant one
   *  named here may also be swapped out or removed) */
  packages?: readonly string[];
  /** the most cards one move may change (default 10) */
  maxCards?: number;
  /** how many moves to return (default all), taken in turn from each kind */
  limit?: number;
  /** '-' instead of '−' in labels (the CLI reports) */
  ascii?: boolean;
}

/** The most cards one package move changes unless the caller says otherwise. */
export const DEFAULT_MAX_CARDS = 10;

const legalFor = (lim: Record<Color, number>) => (c: CardDef | undefined): c is CardDef => !!c && c.type !== 'Legend' && c.ram <= lim[c.color];
const labelCounts = (main: readonly string[]) => {
  const m = new Map<string, number>();
  for (const id of main) {
    const l = label(id);
    m.set(l, (m.get(l) ?? 0) + 1);
  }
  return m;
};

/** Members to add, one copy at a time, until `done` holds; null when it can't within `max` cards. */
function pickAdds(deck: DeckList, s: Synergy, target: PieceCount, mode: 'built-around' | 'covers', o: Required<Pick<PackageMoveOptions, 'score' | 'maxCards'>>): string[] | null {
  const done = (c: RoleCounts) => (mode === 'built-around' ? meetsBuiltAround(c, target) : covers(c, target));
  const legal = legalFor(ramLimits({ ...deck, sideboard: [] }));
  const pc = { ...packageCopies(s, deck).copies };
  const labels = labelCounts(deck.main);
  const inDeck = counts(deck.main);
  const members = membersOf(s).filter((m) => legal(CARD_BY_ID[m.id]));
  const adds: string[] = [];
  while (!done(pc)) {
    if (adds.length >= o.maxCards) return null;
    const eShort = (target.enabler ?? 0) - pc.enabler - pc.both > 0;
    const pShort = (target.payoff ?? 0) - pc.payoff - pc.both > 0;
    const prefer: SynergyRole[] = eShort && pShort ? ['both', 'enabler', 'payoff'] : eShort ? ['enabler', 'both'] : pShort ? ['payoff', 'both'] : ['enabler', 'payoff', 'both', 'piece'];
    const rank = (r: SynergyRole) => (eShort || pShort ? prefer.indexOf(r) : 0);
    let best: { id: string; role: SynergyRole; key: [number, number, number] } | null = null;
    for (const m of members) {
      if (!prefer.includes(m.role) || (labels.get(label(m.id)) ?? 0) >= 3) continue;
      const key: [number, number, number] = [rank(m.role), (inDeck.get(m.id) ?? 0) > 0 ? 0 : 1, -o.score(m.id)];
      if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && (key[2] < best.key[2] || (key[2] === best.key[2] && m.id < best.id))))))
        best = { id: m.id, role: m.role, key };
    }
    if (!best) return null;
    adds.push(best.id);
    pc[best.role]++;
    labels.set(label(best.id), (labels.get(label(best.id)) ?? 0) + 1);
    inDeck.set(best.id, (inDeck.get(best.id) ?? 0) + 1);
  }
  return adds;
}

/** Ids of the packages a card belongs to (cached). */
const PACKAGES_OF = new Map<string, string[]>();
function packagesOf(id: string): string[] {
  let p = PACKAGES_OF.get(id);
  if (!p) {
    p = SYNERGIES.filter((s) => roleMap(s).has(id)).map((s) => s.id);
    PACKAGES_OF.set(id, p);
  }
  return p;
}

/**
 * `n` cuts from the main deck to make room, never a card in `spare`, each one allowed by the plan's keep and lock rules.
 * Cheapest first: cards in no kept or required package before those in one, cards in fewer of the list's built-around
 * packages before cards in more, then the lowest score.
 */
function pickCuts(deck: DeckList, n: number, spare: ReadonlySet<string>, plan: PackagePlan, score: (id: string) => number): string[] | null {
  if (n <= 0) return [];
  const guarded = new Set([...(plan.keep ?? []), ...(plan.require ?? [])]);
  const around = new Set(builtAroundIds(deck));
  const holdPlan: PackagePlan = { keep: plan.keep, require: plan.require, lockCards: plan.lockCards };
  const ids = [...counts(deck.main).keys()]
    .filter((id) => !spare.has(id))
    .map((id) => ({ id, g: packagesOf(id).some((p) => guarded.has(p)) ? 1 : 0, a: packagesOf(id).filter((p) => around.has(p)).length, v: score(id) }))
    .sort((x, y) => x.g - y.g || x.a - y.a || x.v - y.v || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const cuts: string[] = [];
  let main = [...deck.main];
  for (const { id } of ids) {
    while (cuts.length < n) {
      const i = main.indexOf(id);
      if (i < 0) break;
      const next = [...main];
      next.splice(i, 1);
      if (checkChange(deck, { ...deck, main: next }, holdPlan).length) break;
      main = next;
      cuts.push(id);
    }
    if (cuts.length >= n) break;
  }
  return cuts.length === n ? cuts : null;
}

/** `n` filler cards (best score first, at most 2 new copies of one card), none of them in `banned`. */
function pickFillers(deck: DeckList, n: number, banned: ReadonlySet<string>, score: (id: string) => number): string[] | null {
  if (n <= 0) return [];
  const legal = legalFor(ramLimits({ ...deck, sideboard: [] }));
  const labels = labelCounts(deck.main);
  const pool = CARDS.filter((c) => legal(c) && !banned.has(c.id)).sort((a, b) => score(b.id) - score(a.id) || (a.id < b.id ? -1 : 1));
  const out: string[] = [];
  for (const c of pool) {
    for (let k = 0; k < 2 && out.length < n && (labels.get(cardLabel(c)) ?? 0) < 3; k++) {
      out.push(c.id);
      labels.set(cardLabel(c), (labels.get(cardLabel(c)) ?? 0) + 1);
    }
    if (out.length >= n) break;
  }
  return out.length === n ? out : null;
}

/** The copies a package-removal cuts: every main-deck piece, or (for a package too big to cut whole) the scarcer side. */
function removalSet(deck: DeckList, s: Synergy, plan: PackagePlan, maxCards: number): string[] | null {
  const roles = roleMap(s);
  const guarded = new Set([...(plan.keep ?? []), ...(plan.require ?? [])]);
  const locked = new Set(Object.keys(plan.lockCards ?? {}));
  const cuttable = deck.main.filter((id) => roles.has(id) && !locked.has(id) && !packagesOf(id).some((p) => p !== s.id && guarded.has(p)));
  if (!cuttable.length) return null;
  if (cuttable.length <= maxCards) return cuttable;
  // too many pieces to cut at once (e.g. Programs as fuel, where every Program is an enabler): cut the side that
  // dissolves the package — the payoffs, or the enablers when they are fewer — plus the cards that do both
  const side = (r: SynergyRole) => cuttable.filter((id) => roles.get(id) === r || roles.get(id) === 'both');
  const e = side('enabler');
  const p = side('payoff');
  const pick = p.length && (p.length <= e.length || !e.length) ? p : e;
  return pick.length && pick.length <= maxCards ? pick : null;
}

function removeFromMain(main: readonly string[], ids: readonly string[]): string[] {
  const out = [...main];
  for (const id of ids) {
    const i = out.indexOf(id);
    if (i >= 0) out.splice(i, 1);
  }
  return out;
}

function cardList(ids: readonly string[], sign: string): string {
  return [...counts([...ids])].map(([id, n]) => `${sign}${n} ${label(id)}`).join(', ');
}

function makeMove(deck: DeckList, kind: PackageMoveKind, added: Synergy | null, removed: Synergy | null, cardsIn: string[], cardsOut: string[], o: { score: (id: string) => number; ascii?: boolean; plan: PackagePlan }): PackageMove | null {
  if (!cardsIn.length && !cardsOut.length) return null;
  const main = [...removeFromMain(deck.main, cardsOut), ...cardsIn];
  const next: DeckList = { ...deck, main };
  if (main.length !== deck.main.length || validateDeck({ ...next, sideboard: [] }).length || checkChange(deck, next, o.plan).length) return null;
  const minus = o.ascii ? '-' : '−';
  const head =
    kind === 'swap' ? `Swap ${removed!.name} → ${added!.name}` : kind === 'remove' ? `Remove ${removed!.name}` : `${kind === 'complete' ? 'Complete' : 'Add'} ${added!.name}`;
  const body = [cardList(cardsIn, '+'), cardList(cardsOut, minus)].filter(Boolean).join(' / ');
  const prior = cardsIn.reduce((a, id) => a + o.score(id), 0) - cardsOut.reduce((a, id) => a + o.score(id), 0);
  return { kind, label: `${head}: ${body}`, deck: next, added: added?.id ?? null, removed: removed?.id ?? null, cardsIn, cardsOut, prior };
}

/** The pieces a half-present package lacks: the missing side up to its built-around count for that role. */
function completionTarget(s: Synergy, c: RoleCounts): PieceCount | null {
  if (!total(c) || covers(c, s.needs)) return null;
  const noE = !!s.needs.enabler && c.enabler + c.both === 0;
  const noP = !!s.needs.payoff && c.payoff + c.both === 0;
  if (!noE && !noP) return null;
  return {
    enabler: noE ? Math.max(s.needs.enabler ?? 0, s.builtAround.enabler ?? 0) : s.needs.enabler,
    payoff: noP ? Math.max(s.needs.payoff ?? 0, s.builtAround.payoff ?? 0) : s.needs.payoff,
    any: s.needs.any,
  };
}

/** Add (or complete) one package: its members up to the minimum, cutting the cheapest cards outside the kept packages. */
export function addPackage(deck: DeckList, id: string, o: PackageMoveOptions & { complete?: boolean } = {}): PackageMove | null {
  const s = SYNERGY_BY_ID[id];
  if (!s) return null;
  const plan = o.plan ?? {};
  const score = o.score ?? (() => 0);
  const maxCards = o.maxCards ?? DEFAULT_MAX_CARDS;
  const c = packageCopies(s, deck).copies;
  const target = o.complete ? completionTarget(s, c) : meetsBuiltAround(c, s.builtAround) ? null : s.builtAround;
  if (!target) return null;
  const adds = pickAdds(deck, s, target, o.complete ? 'covers' : 'built-around', { score, maxCards });
  if (!adds?.length) return null;
  const cuts = pickCuts(deck, adds.length, new Set(roleMap(s).keys()), plan, score);
  if (!cuts) return null;
  return makeMove(deck, o.complete ? 'complete' : 'add', s, null, adds, cuts, { score, ascii: o.ascii, plan });
}

/** Remove one package (see removalSet), refilling with the best cards outside it. */
export function removePackage(deck: DeckList, id: string, o: PackageMoveOptions = {}): PackageMove | null {
  const s = SYNERGY_BY_ID[id];
  if (!s) return null;
  const plan = o.plan ?? {};
  const score = o.score ?? (() => 0);
  const cuts = removalSet(deck, s, plan, o.maxCards ?? DEFAULT_MAX_CARDS);
  if (!cuts) return null;
  const rest = { ...deck, main: removeFromMain(deck.main, cuts) };
  const fill = pickFillers(rest, cuts.length, new Set([...roleMap(s).keys(), ...avoidedPieces(plan)]), score);
  if (!fill) return null;
  return makeMove(deck, 'remove', null, s, fill, cuts, { score, ascii: o.ascii, plan });
}

/** Cards that belong to an avoided package (fillers never bring them in). */
function avoidedPieces(plan: PackagePlan): string[] {
  return (plan.avoid ?? []).flatMap((id) => {
    const s = SYNERGY_BY_ID[id];
    return s ? membersOf(s).map((m) => m.id) : [];
  });
}

/** Swap one package for another of similar size (the two move sizes differ by at most 3 cards). */
export function swapPackage(deck: DeckList, out: string, inId: string, o: PackageMoveOptions = {}): PackageMove | null {
  const P = SYNERGY_BY_ID[out];
  const Q = SYNERGY_BY_ID[inId];
  if (!P || !Q || P === Q) return null;
  const plan = o.plan ?? {};
  const score = o.score ?? (() => 0);
  const maxCards = o.maxCards ?? DEFAULT_MAX_CARDS;
  const qMembers = roleMap(Q);
  const cuts0 = removalSet(deck, P, plan, maxCards)?.filter((id) => !qMembers.has(id));
  if (!cuts0?.length) return null;
  const rest = { ...deck, main: removeFromMain(deck.main, cuts0) };
  const qc = packageCopies(Q, rest).copies;
  if (meetsBuiltAround(qc, Q.builtAround)) return null;
  const adds = pickAdds(rest, Q, Q.builtAround, 'built-around', { score, maxCards });
  if (!adds?.length || Math.abs(adds.length - cuts0.length) > 3) return null;
  let cardsIn = adds;
  let cardsOut = cuts0;
  if (adds.length < cuts0.length) {
    const fill = pickFillers({ ...rest, main: [...rest.main, ...adds] }, cuts0.length - adds.length, new Set([...roleMap(P).keys(), ...avoidedPieces(plan)]), score);
    if (!fill) return null;
    cardsIn = [...adds, ...fill];
  } else if (adds.length > cuts0.length) {
    const more = pickCuts(rest, adds.length - cuts0.length, new Set([...qMembers.keys()]), plan, score);
    if (!more) return null;
    cardsOut = [...cuts0, ...more];
  }
  return makeMove(deck, 'swap', Q, P, cardsIn, cardsOut, { score, ascii: o.ascii, plan });
}

/**
 * Package-level candidates for a list: complete half-present packages, add packages it isn't built around, swap a
 * package it holds for one of similar size, remove a package it holds. Every move keeps the list legal and within the
 * plan (kept, required and locked pieces are never cut; avoided packages are never added). Ordered complete, add, swap,
 * remove, each by prior; with `limit`, taken in turn from each kind so every kind is tried.
 */
export function packageMoves(deck: DeckList, o: PackageMoveOptions = {}): PackageMove[] {
  const plan = o.plan ?? {};
  const kinds = new Set(o.kinds ?? PACKAGE_MOVE_KINDS);
  const avoid = new Set(plan.avoid ?? []);
  const guarded = new Set([...(plan.keep ?? []), ...(plan.require ?? [])]);
  // a dormant package is moved only when named in `packages`
  const may = (id: string) => !avoid.has(id) && (o.packages ? o.packages.includes(id) : !isDormant(id));
  const held = PACKAGE_IDS.filter((id) => holdsPackage(id, deck) && !guarded.has(id) && (!isDormant(id) || !!o.packages?.includes(id)));
  const byKind: Record<PackageMoveKind, PackageMove[]> = { complete: [], add: [], swap: [], remove: [] };
  const seen = new Set<string>();
  const keep = (m: PackageMove | null) => {
    if (!m) return;
    const key = [...m.deck.main].sort().join(',');
    if (seen.has(key)) return;
    seen.add(key);
    byKind[m.kind].push(m);
  };
  for (const id of PACKAGE_IDS) {
    if (!may(id)) continue;
    if (kinds.has('complete')) keep(addPackage(deck, id, { ...o, complete: true }));
    if (kinds.has('add')) keep(addPackage(deck, id, o));
  }
  if (kinds.has('swap')) for (const out of held) for (const inId of PACKAGE_IDS) if (may(inId) && inId !== out && !isBuiltAround(inId, deck)) keep(swapPackage(deck, out, inId, o));
  if (kinds.has('remove')) for (const id of held) keep(removePackage(deck, id, o));
  const order = PACKAGE_MOVE_KINDS.map((k) => byKind[k].sort((a, b) => b.prior - a.prior || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0)));
  const out: PackageMove[] = [];
  const limit = o.limit ?? Infinity;
  for (let i = 0; out.length < limit && order.some((l) => i < l.length); i++) for (const l of order) if (out.length < limit && l[i]) out.push(l[i]!);
  return out;
}

/**
 * Package moves for one tuning round (forge, optimizer, Deck Lab): `n` of them when package moves are on, and in any
 * case the moves that add or complete a required package the list is not built around yet, so a plan that requires one
 * can be met. Required ones first.
 */
export function tunerPackageMoves(deck: DeckList, plan: PackagePlan, o: { moves: boolean; n: number; score: (id: string) => number; ascii?: boolean }): PackageMove[] {
  const missing = (plan.require ?? []).filter((id) => !isBuiltAround(id, deck));
  const req = missing.length ? packageMoves(deck, { plan, score: o.score, kinds: ['complete', 'add'], packages: missing, limit: o.n, ascii: o.ascii }) : [];
  const more = o.moves ? packageMoves(deck, { plan, score: o.score, limit: o.n + req.length, ascii: o.ascii }).filter((m) => !req.some((x) => x.label === m.label)).slice(0, o.n) : [];
  return [...req, ...more];
}

// ---------------------------------------------------------------- package changes between two lists

export interface PackageChanges {
  /** built around in both */
  kept: string[];
  added: string[];
  removed: string[];
}
/** Which built-around packages a change kept, added and removed (for reports and the Lab result panel). */
export function packageChanges(before: Pick<DeckList, 'legends' | 'main'>, after: Pick<DeckList, 'legends' | 'main'>): PackageChanges {
  const a = new Set(builtAroundIds(before));
  const b = new Set(builtAroundIds(after));
  return { kept: [...a].filter((x) => b.has(x)), added: [...b].filter((x) => !a.has(x)), removed: [...a].filter((x) => !b.has(x)) };
}
/** "kept Low Gigs; added …; removed …" (or "no built-around package"). */
export function describeChanges(c: PackageChanges): string {
  const names = (ids: string[]) => ids.map(packageName).join(', ');
  const parts = [c.kept.length ? `kept ${names(c.kept)}` : '', c.added.length ? `added ${names(c.added)}` : '', c.removed.length ? `removed ${names(c.removed)}` : ''].filter(Boolean);
  return parts.join('; ') || 'no built-around package before or after';
}

// ---------------------------------------------------------------- seeding: Legends for one or two packages

const LEGEND_CARDS = CARDS.filter((c) => c.type === 'Legend').sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const COLOR_ORDER = 'RBGY';

/** The most copies per role a list with these Legends could hold of a package (3 per card name, Legends once). */
function maxCopies(s: Synergy, legends: readonly string[], lim: Record<Color, number>): RoleCounts {
  const legal = legalFor(lim);
  const out = zeroRoles();
  const names = new Set<string>();
  for (const m of membersOf(s)) {
    const c = CARD_BY_ID[m.id];
    if (!c) continue;
    if (c.type === 'Legend') {
      if (legends.includes(c.id)) out[m.role]++;
      continue;
    }
    if (!legal(c) || names.has(cardLabel(c))) continue;
    names.add(cardLabel(c));
    out[m.role] += 3;
  }
  return out;
}

export interface TripleOption {
  legends: string[];
  /** e.g. "BBG" */
  colors: string;
  /** Legends of the trio that are pieces of the packages */
  legendPieces: number;
  score: number;
}

/**
 * Legend trios that can hold every given package at its built-around minimum, best first: Legends that are pieces
 * themselves, the Legends' strength (if given), two colours or fewer, then room (more legal pieces to choose from).
 */
export function packageTriples(ids: readonly string[], o: { exclude?: ReadonlySet<string>; strength?: (legendId: string) => number; within?: readonly string[] } = {}): TripleOption[] {
  const ss = ids.map((id) => SYNERGY_BY_ID[id]).filter((s): s is Synergy => !!s);
  const out: TripleOption[] = [];
  const L = o.within ? LEGEND_CARDS.filter((c) => o.within!.includes(c.id)) : LEGEND_CARDS;
  for (let i = 0; i < L.length; i++)
    for (let j = i + 1; j < L.length; j++)
      for (let k = j + 1; k < L.length; k++) {
        const t = [L[i]!, L[j]!, L[k]!];
        if (new Set(t.map((c) => c.name)).size < 3) continue;
        const legends = t.map((c) => c.id);
        if (o.exclude?.has([...legends].sort().join('|'))) continue;
        const lim = ramLimits({ name: '', legends, main: [], sideboard: [] });
        let room = 0;
        let ok = true;
        let pieces = 0;
        for (const s of ss) {
          const m = maxCopies(s, legends, lim);
          if (!meetsBuiltAround(m, s.builtAround)) {
            ok = false;
            break;
          }
          room += total(m);
          const roles = roleMap(s);
          pieces += legends.filter((l) => roles.has(l)).length;
        }
        if (!ok) continue;
        const colorSet = new Set(t.map((c) => c.color));
        const strength = o.strength ? legends.reduce((a, l) => a + o.strength!(l), 0) / 3 : 0.5;
        const colors = t
          .map((c) => c.color[0]!)
          .sort((a, b) => COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b))
          .join('');
        out.push({ legends, colors, legendPieces: pieces, score: pieces + strength + (colorSet.size <= 2 ? 0.5 : 0) + 0.01 * Math.min(room, 30) });
      }
  return out.sort((a, b) => b.score - a.score || (a.legends.join() < b.legends.join() ? -1 : 1));
}

/** "all Blue", "Yellow, Red and Green" — the colours of a package's pieces, most first. */
export function packageColors(id: string): string {
  const s = SYNERGY_BY_ID[id];
  if (!s) return '';
  const n = new Map<string, number>();
  for (const m of membersOf(s)) {
    const c = CARD_BY_ID[m.id];
    if (c) n.set(c.color, (n.get(c.color) ?? 0) + 1);
  }
  const cs = [...n].sort((a, b) => b[1] - a[1] || COLOR_ORDER.indexOf(a[0][0]!) - COLOR_ORDER.indexOf(b[0][0]!)).map(([c]) => c);
  if (cs.length === 1) return `all ${cs[0]}`;
  return cs.length === 2 ? `${cs[0]} and ${cs[1]}` : `${cs.slice(0, -1).join(', ')} and ${cs[cs.length - 1]}`;
}

/**
 * Can these packages (one or two) share one deck? They can when some legal Legend trio gives enough RAM for every
 * package's built-around minimum. The reason says plainly why not.
 */
export function packageCompatibility(ids: readonly string[], o: { within?: readonly string[] } = {}): { ok: true; triples: number; warning?: string } | { ok: false; reason: string } {
  const unknown = ids.filter((id) => !SYNERGY_BY_ID[id]);
  if (unknown.length) return { ok: false, reason: `unknown package ${unknown.map((u) => `"${u}"`).join(', ')}. ${VALID()}` };
  const n = packageTriples(ids, { within: o.within }).length;
  if (n) {
    const warning = ids.length === 2 ? pullsApart(ids[0]!, ids[1]!) : undefined;
    return warning ? { ok: true, triples: n, warning } : { ok: true, triples: n };
  }
  const what = ids.map((id) => `${packageName(id)} (${packageColors(id)})`).join(' and ');
  const trio = o.within ? `these Legends (${o.within.map(label).join(' / ')})` : 'no legal trio of Legends';
  if (ids.length === 1) return { ok: false, reason: `${o.within ? `${trio} can't` : `${trio} can`} field ${what} at its built-around minimum (${minimumText(SYNERGY_BY_ID[ids[0]!]!.builtAround)}): not enough RAM in its colours.` };
  return {
    ok: false,
    reason: `${what} can't share ${o.within ? 'this' : 'a'} deck: ${o.within ? `${trio} don't give` : `${trio} gives`} enough RAM in the right colours for both built-around minimums (${ids.map((id) => minimumText(SYNERGY_BY_ID[id]!.builtAround)).join('; ')}).`,
  };
}

/** What a package's `online` condition pushes toward: Gig values low or high, Street Cred below or above the rival's. */
function leanings(s: Synergy): Set<string> {
  const out = new Set<string>();
  const walk = (c: SynergyCondition) => {
    if (c.term === 'all' || c.term === 'any') c.of.forEach(walk);
    else if (c.term === 'min-gig') out.add('gig-low');
    else if (c.term === 'high-gig' || c.term === 'max-gig') out.add('gig-high');
    else if (c.term === 'cred-vs-rival') out.add(c.cmp === 'less' ? 'cred-low' : 'cred-high');
    else if (c.term === 'cred-at-least') out.add('cred-high');
  };
  walk(s.online);
  return out;
}
const LEANING_TEXT: Record<string, string> = { 'gig-low': 'low Gig values', 'gig-high': 'high Gig values', 'cred-low': 'Street Cred below the rival’s', 'cred-high': 'high Street Cred' };
/** A plain warning when two packages' online conditions pull opposite ways (they can share a deck, but rarely both be online). */
export function pullsApart(a: string, b: string): string | undefined {
  const A = SYNERGY_BY_ID[a];
  const B = SYNERGY_BY_ID[b];
  if (!A || !B) return undefined;
  const la = leanings(A);
  const lb = leanings(B);
  for (const [x, y] of [
    ['gig-low', 'gig-high'],
    ['cred-low', 'cred-high'],
  ] as const) {
    const ab = la.has(x) && lb.has(y);
    const ba = la.has(y) && lb.has(x);
    if (ab || ba)
      return `${A.name} wants ${LEANING_TEXT[ab ? x : y]} and ${B.name} wants ${LEANING_TEXT[ab ? y : x]}: the colours fit, but the two will rarely be online at the same time.`;
  }
  return undefined;
}

export interface Seeded {
  deck: DeckList;
  /** the package moves that topped the template fill up to each minimum */
  moves: PackageMove[];
  /** what the result breaks: empty when it is legal and built around every seeded package */
  violations: Violation[];
}

/**
 * A list built around one or two packages: `fill` builds the template list for the Legends (the way explorers are filled),
 * then each package is topped up to its built-around minimum, the cuts coming from cards outside the seeded packages.
 */
export function seedAround(ids: readonly string[], legends: string[], fill: (legends: string[]) => DeckList, o: Omit<PackageMoveOptions, 'kinds' | 'packages' | 'limit'> = {}): Seeded {
  let deck = fill(legends);
  const plan = o.plan ?? {};
  const moves: PackageMove[] = [];
  const done: string[] = [];
  for (const id of ids) {
    // pieces of the packages already topped up stay (keep), and the cuts never take the next package's own pieces
    const m = addPackage(deck, id, { ...o, plan: { ...plan, keep: [...(plan.keep ?? []), ...done] } });
    if (m) {
      deck = m.deck;
      moves.push(m);
    }
    done.push(id);
  }
  return { deck, moves, violations: checkList(deck, { ...plan, require: [...new Set([...(plan.require ?? []), ...ids])] }) };
}

/**
 * Bring a bred list into line with a plan: add every package it must be built around (required, or kept when a parent
 * was built around it) and remove avoided packages it is built around. Null (with the reason) when it can't.
 */
export function fitToPlan(deck: DeckList, plan: PackagePlan, o: { score: (id: string) => number; parentsBuiltAround?: readonly string[]; ascii?: boolean }): { deck: DeckList; changes: string[] } | { error: string } {
  const must = [...new Set([...(plan.require ?? []), ...(plan.keep ?? []).filter((id) => o.parentsBuiltAround?.includes(id))])];
  const changes: string[] = [];
  let d = deck;
  const done: string[] = [];
  for (const id of must) {
    if (!isBuiltAround(id, d)) {
      const m = addPackage(d, id, { score: o.score, ascii: o.ascii, plan: { avoid: plan.avoid, keep: done } });
      if (!m) return { error: `can't build ${packageName(id)} into ${d.name}` };
      d = m.deck;
      changes.push(m.label);
    }
    done.push(id);
  }
  for (const id of plan.avoid ?? []) {
    if (!isBuiltAround(id, d)) continue;
    const m = removePackage(d, id, { score: o.score, ascii: o.ascii, plan: { keep: must } });
    if (!m) return { error: `can't take ${packageName(id)} out of ${d.name}` };
    d = m.deck;
    changes.push(m.label);
  }
  const v = checkList(d, { require: must, avoid: plan.avoid });
  return v.length ? { error: v.map((x) => x.text).join('; ') } : { deck: d, changes };
}

/** Provenance of a package-aware build, for run manifests (RunManifest.packages) and deck notes. */
export interface PackageProvenance {
  plan: PackagePlan;
  /** seed combinations the breeder built explorers around */
  seeds?: string[][];
  /** package moves tried or adopted, by label */
  moves?: string[];
  /** the catalogue the plan refers to (CATALOGUE_VERSION) */
  catalogue: string;
}
export function packageProvenance(plan: PackagePlan, extra: { seeds?: string[][]; moves?: string[] } = {}): PackageProvenance {
  return { plan: compactPlan(plan), ...(extra.seeds?.length ? { seeds: extra.seeds } : {}), ...(extra.moves?.length ? { moves: extra.moves } : {}), catalogue: CATALOGUE_VERSION };
}

/** Default `keep` for a deck: its objective's packages when the owner named some, else the packages it is built around. */
export function defaultKeep(deck: Pick<DeckList, 'legends' | 'main'>, objectiveSynergies?: readonly string[] | null): string[] {
  const named = (objectiveSynergies ?? []).filter((id) => SYNERGY_BY_ID[id]);
  return named.length ? [...named] : builtAroundIds(deck);
}
