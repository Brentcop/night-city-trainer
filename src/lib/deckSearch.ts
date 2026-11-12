// Search depth for the deck builders (ROADMAP2 §1 step 5): how many cards or packages one candidate may change, how many
// nominees are confirmed per generation, and what a run will cost in games before it starts. Shared by scripts/forge.ts,
// scripts/optimize.ts and the Deck Lab tuner (src/lib/deckLab.ts). Plain data, Node and browser.
//
// Candidates of more than one change are built from the best screened single changes (the top `combineFrom` that
// screened above the current list), never from the full cross product: pairs (and triples at depth 3) of those, each a
// legal list that respects the package plan like every other candidate.
import { validateDeck } from '../engine/deck';
import type { DeckList } from '../engine/types';
import { checkChange, isEmptyPlan, type PackagePlan } from './deckPackages';
import type { AdoptionRule } from './evidence';

export interface SearchDepth {
  /** one-card swaps combined in one candidate: 1 (today), 2 or 3 */
  cardsPerChange: number;
  /** package moves combined in one candidate: 1 (today) or 2 ("swap A for B and complete C") */
  packagesPerChange: number;
  /** nominees confirmed per generation (forge and Lab 1, optimizer 6, as before) */
  nominees: number;
  /** how many of the best screened single changes are combined */
  combineFrom: number;
}

export const MAX_CARDS_PER_CHANGE = 3;
export const MAX_PACKAGES_PER_CHANGE = 2;
/** Defaults reproduce the breadth before depth existed: one change per candidate, one nominee. */
export const DEPTH_DEFAULTS: Readonly<SearchDepth> = Object.freeze({ cardsPerChange: 1, packagesPerChange: 1, nominees: 1, combineFrom: 4 });

export function depthProblems(d: SearchDepth): string[] {
  const out: string[] = [];
  if (!Number.isInteger(d.cardsPerChange) || d.cardsPerChange < 1 || d.cardsPerChange > MAX_CARDS_PER_CHANGE) out.push(`cards per change must be 1 to ${MAX_CARDS_PER_CHANGE} (got ${d.cardsPerChange})`);
  if (!Number.isInteger(d.packagesPerChange) || d.packagesPerChange < 1 || d.packagesPerChange > MAX_PACKAGES_PER_CHANGE) out.push(`packages per change must be 1 to ${MAX_PACKAGES_PER_CHANGE} (got ${d.packagesPerChange})`);
  if (!Number.isInteger(d.nominees) || d.nominees < 1) out.push(`nominees must be 1 or more (got ${d.nominees})`);
  if (!Number.isInteger(d.combineFrom) || d.combineFrom < 2) out.push(`combine-from must be 2 or more (got ${d.combineFrom})`);
  return out;
}

// ---------------------------------------------------------------- combining changes

/** Order-free key of a list (Legends and main deck). */
export const listKeyOf = (d: Pick<DeckList, 'legends' | 'main'>) => `${[...d.legends].sort().join(',')}|${[...d.main].sort().join(',')}`;

function multisetDiff(before: readonly string[], after: readonly string[]): { removed: string[]; added: string[] } {
  const left = new Map<string, number>();
  for (const id of before) left.set(id, (left.get(id) ?? 0) + 1);
  const added: string[] = [];
  for (const id of after) {
    const k = left.get(id) ?? 0;
    if (k > 0) left.set(id, k - 1);
    else added.push(id);
  }
  const removed: string[] = [];
  for (const [id, k] of left) for (let i = 0; i < k; i++) removed.push(id);
  return { removed, added };
}

/**
 * The list with every part's changes applied to `base` (main deck: each part's cuts replaced in place by its adds;
 * Legends: slot by slot). Null when two parts conflict (both change the same Legend slot, one adds a card another cuts,
 * or together they cut more copies than the list holds).
 */
export function combineDecks(base: DeckList, parts: readonly Pick<DeckList, 'legends' | 'main'>[]): DeckList | null {
  const main = [...base.main];
  const legends = [...base.legends];
  const changedSlot = new Set<number>();
  const addedAll = new Set<string>();
  const removedAll = new Set<string>();
  for (const p of parts) {
    const { removed, added } = multisetDiff(base.main, p.main);
    for (const id of removed) removedAll.add(id);
    for (const id of added) addedAll.add(id);
    for (let i = 0; i < Math.max(removed.length, added.length); i++) {
      const r = removed[i];
      const a = added[i];
      if (r !== undefined) {
        const at = main.indexOf(r);
        if (at < 0) return null;
        if (a !== undefined) main.splice(at, 1, a);
        else main.splice(at, 1);
      } else if (a !== undefined) main.push(a);
    }
    for (let k = 0; k < legends.length; k++) {
      const want = p.legends[k];
      if (want === undefined || want === base.legends[k]) continue;
      if (changedSlot.has(k)) return null;
      changedSlot.add(k);
      legends[k] = want;
    }
  }
  for (const id of addedAll) if (removedAll.has(id)) return null;
  return { ...base, main, legends };
}

/** Every k-element subset of `xs`, in order. */
export function combinations<T>(xs: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const pick = (from: number, acc: T[]) => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = from; i < xs.length; i++) {
      acc.push(xs[i] as T);
      pick(i + 1, acc);
      acc.pop();
    }
  };
  if (k > 0) pick(0, []);
  return out;
}

/** The most combined candidates `from` singles give at up to `maxParts` parts (pairs, triples). */
export function maxCombined(from: number, maxParts: number): number {
  let n = 0;
  for (let k = 2; k <= maxParts; k++) n += combinations(Array.from({ length: from }, (_, i) => i), k).length;
  return n;
}

/**
 * Combined candidates from `singles` (best first, already screened above the current list): every pair (and triple, at
 * `maxParts` 3) of the first `from` of them that makes a legal list, respects `plan`, and is not already a candidate
 * (`seen`, list keys; extended here). `make` builds the candidate from its parts and list.
 */
export function combinedCandidates<C extends { label: string; deck: DeckList }>(
  base: DeckList,
  singles: readonly C[],
  o: { maxParts: number; from: number; plan?: PackagePlan; seen?: Set<string> },
  make: (parts: C[], deck: DeckList) => C,
): C[] {
  const pool = singles.slice(0, o.from);
  const seen = o.seen ?? new Set<string>([listKeyOf(base), ...singles.map((s) => listKeyOf(s.deck))]);
  const planned = !isEmptyPlan(o.plan);
  const out: C[] = [];
  for (let k = 2; k <= o.maxParts; k++)
    for (const parts of combinations(pool, k)) {
      const d = combineDecks(base, parts.map((p) => p.deck));
      if (!d) continue;
      const key = listKeyOf(d);
      if (seen.has(key)) continue;
      if (validateDeck({ ...d, sideboard: [] }).length) continue;
      if (planned && checkChange(base, d, o.plan ?? {}).length) continue;
      seen.add(key);
      out.push(make(parts, d));
    }
  return out;
}

// ---------------------------------------------------------------- game budget

export interface BudgetInput {
  gens: number;
  /** games per screening (each candidate and the baseline) */
  screenGames: number;
  /** one-card swaps (or the optimizer's candidates) screened per generation */
  singles: number;
  /** package moves screened per generation, at most */
  packageMoves: number;
  depth: SearchDepth;
  /** games in the first confirmation stage */
  firstStage: number;
  rule: AdoptionRule;
  /** the baseline plays its own screening (forge, Lab); the optimizer counts it among the singles */
  baselineScreen?: boolean;
}

/**
 * Games a run plays: `min` when nothing is nominated, `max` when every confirmation runs to the cap and every combined
 * candidate is built. Per generation: screening (baseline + singles + package moves + combinations), then the
 * confirmation (the current list and each nominee, every stage). The futility stop (src/lib/evidence.ts) only ever
 * ends confirmations sooner, so it lowers what a run plays but never the most it may play.
 */
export function estimateGames(o: BudgetInput): { min: number; max: number; screen: number; combos: number; confirm: number } {
  const legacy = o.rule.kind === 'any-gain';
  const combos =
    (o.depth.cardsPerChange > 1 ? maxCombined(Math.min(o.depth.combineFrom, o.singles), o.depth.cardsPerChange) : 0) +
    (o.depth.packagesPerChange > 1 ? maxCombined(Math.min(o.depth.combineFrom, o.packageMoves), o.depth.packagesPerChange) : 0);
  const screen = o.screenGames * ((o.baselineScreen === false ? 0 : 1) + o.singles + o.packageMoves);
  const combo = o.screenGames * combos;
  const confirm = o.firstStage * (legacy ? 1 : o.rule.capStages) * (1 + o.depth.nominees);
  return { min: o.gens * screen, max: o.gens * (screen + combo + confirm), screen, combos, confirm };
}

/** Default most games one forge or optimizer run may plan per deck without --force. */
export const DEFAULT_GAME_BUDGET = 12_000;
/** The Deck Lab asks before a run that may play more than this. */
export const LAB_GAME_BUDGET = 12_000;
