// A stable shortlist from pooled evidence (docs/TUNING_STUDY_2026-11-13.md P5; docs/SYNERGIES.md "A shortlist carried
// across runs"): with the change ledger on, a tuning run screens again the most promising changes earlier runs left
// undecided, skips the ones earlier games say are not worth it, and nominates by the gain over all of a change's games
// rather than by its own 112 screening games, so repeated runs test the same changes and the ledger has something to pool.
//
// Plain data and plain functions only (Node and browser): the forge (scripts/forge.ts --pooled-ranking) and the Deck Lab
// tuner (src/lib/deckLab.ts, TuneOptions.shortlist) call the same functions, over the run logic they share
// (src/lib/changeLedgerRun.ts). Everything is per ledger entry context: this base list, simulator version, canonical bot
// and field.
//
// - A change's pooled games are its screening and held-out games in the ledger, each game once (by game id); its pooled
//   gain is the mean per-game difference over them, with the plain standard error.
// - Dropped: (a) pooled gain + dropSe standard errors below the nomination bar; (b) its held-out games alone rejected by
//   the strict pooling rule (judgePooled's look); (c) it has held-out games and would need more than `reach` held-out
//   games in all to be adopted at their present mean and spread (gamesToSettle), unless they already adopt it.
// - Carried: pooled games, not dropped, a one-card main-deck swap that still makes a legal list from the current base
//   list and respects the package plan; the best `carry` by pooled gain (ties by change key).
// - A generation's candidates: the carried ones first, then the generator's picks in its own order, skipping carried and
//   dropped ones, until `cands` in all (fewer when the generator runs out). Package moves and combined candidates are
//   neither carried nor skipped.
// - Nomination: by pooled gain over every pooled game (this generation's screening included), best first, at the same
//   nomination bar; a change with no earlier games keeps exactly its own screening figure, so it is judged as before.
import { listFingerprint, validateDeck } from '../engine/deck';
import type { DeckList } from '../engine/types';
import { changeKey, gameId, gamesToSettleSums, type LedgerEntry, type LedgerGame } from './changeLedger';
import type { ChangeLedgerRun } from './changeLedgerRun';
import { alwaysValidZ, guardedFromSums, judgeLook, pooledShare, type AdoptionRule, type PairedScores } from './evidence';
import { canCut, checkChange, isEmptyPlan, type PackagePlan } from './deckPackages';

export interface ShortlistOptions {
  /** changes carried into each generation, at most */
  carry: number;
  /** a change is dropped when its pooled gain + dropSe standard errors is below the nomination bar */
  dropSe: number;
  /** a change with held-out games is dropped when it would need more than this many held-out games in all to be adopted */
  reach: number;
}

/**
 * The shipped defaults (chosen by scripts/shortlist-sim.ts; docs/SYNERGIES.md "A shortlist carried across runs"). The
 * reach is 10,000 held-out games: at 4,500 a real change whose first confirmation read low was dropped (seen on real
 * games, and worse for swaps with a per-game SD above 0.3, which need more games for the same gain), and in the
 * simulation a longer reach costs nothing without "until settled" and adds gain with it.
 */
export const SHORTLIST_DEFAULTS: Readonly<ShortlistOptions> = Object.freeze({ carry: 2, dropSe: 0.5, reach: 10_000 });

export function shortlistOptions(o: Partial<ShortlistOptions> = {}): ShortlistOptions {
  return { carry: o.carry ?? SHORTLIST_DEFAULTS.carry, dropSe: o.dropSe ?? SHORTLIST_DEFAULTS.dropSe, reach: o.reach ?? SHORTLIST_DEFAULTS.reach };
}

/** What a change is judged against: the rule, the decision's nominees, its adoption bar and the nomination bar. */
export interface ShortlistRule {
  rule: AdoptionRule;
  /** nominees per decision (the strict rule's share of α) */
  nominees: number;
  /** the adoption bar in points (one-card swaps: rule.minGainPp) */
  minGainPp: number;
  /** the nomination bar, a fraction (0.02 = 2 points): the forge's 0.02, the Lab's minGain */
  nominateBar: number;
  shortlist: ShortlistOptions;
}

// ---------------------------------------------------------------- pooled games

/** An entry's screening and held-out games, each game once by its id (held-out first; a game in both counts once). */
export function pooledGames(e: LedgerEntry | undefined): LedgerGame[] {
  if (!e) return [];
  const seen = new Set<string>();
  const out: LedgerGame[] = [];
  for (const g of [...e.heldout, ...e.screen]) {
    const id = gameId(g);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(g);
  }
  return out;
}

export interface PooledGain {
  games: number;
  /** mean per-game difference, candidate minus base (a fraction) */
  mean: number;
  /** plain standard error (sample SD / √n); Infinity below 2 games */
  se: number;
}

/** Count, Σd and Σd² of some paired differences (the simulation, scripts/shortlist-sim.ts, keeps games as sums). */
export interface Sums {
  n: number;
  sum: number;
  sq: number;
}
const sumsOf = (games: readonly Pick<LedgerGame, 'base' | 'cand'>[]): Sums => {
  let sum = 0;
  let sq = 0;
  for (const g of games) {
    const d = g.cand - g.base;
    sum += d;
    sq += d * d;
  }
  return { n: games.length, sum, sq };
};
const scoresSums = (p: PairedScores): Sums => sumsOf(p.base.map((b, i) => ({ base: b, cand: p.cand[i] ?? 0 })));

/** The pooled gain of some games: mean and plain standard error. */
export function pooledGain(games: readonly Pick<LedgerGame, 'base' | 'cand'>[]): PooledGain {
  return pooledGainOfSums(sumsOf(games));
}

/** pooledGain from sums. */
export function pooledGainOfSums({ n, sum, sq }: Sums): PooledGain {
  if (!n) return { games: 0, mean: 0, se: Infinity };
  const mean = sum / n;
  return { games: n, mean, se: n > 1 ? Math.sqrt(Math.max(0, (sq - n * mean * mean) / (n - 1)) / n) : Infinity };
}

// ---------------------------------------------------------------- status

export type DropReason = 'below-bar' | 'rejected' | 'out-of-reach';
export type ChangeStatus =
  | { kind: 'untested' }
  | { kind: 'live'; gain: PooledGain; heldout: number }
  | { kind: 'dropped'; why: DropReason; gain: PooledGain; heldout: number; toSettle?: number };

/** The strict pooling rule's verdict on held-out games alone (judgePooled's look, from sums). */
export function heldoutVerdict(h: Sums, c: Pick<ShortlistRule, 'rule' | 'nominees' | 'minGainPp'>) {
  const iv = guardedFromSums(h.n, h.sum, h.sq, alwaysValidZ(h.n, pooledShare(c.rule.alpha, c.nominees)));
  return judgeLook(iv, { minGainPp: c.minGainPp, minGames: c.rule.minGames, last: false });
}

/**
 * Whether held-out games put a change out of reach: it would need more than `reach` held-out games in all to be adopted
 * at their present mean and (guarded) spread. Games that already adopt it never put it out of reach.
 */
export function outOfReach(h: Sums | PairedScores, c: Pick<ShortlistRule, 'rule' | 'nominees' | 'minGainPp'> & { reach: number }): { out: boolean; toSettle: number } {
  const s = 'n' in h ? h : scoresSums(h);
  if (!s.n) return { out: false, toSettle: Infinity };
  const toSettle = gamesToSettleSums(s.n, s.sum, s.sq, c.rule, { nominees: c.nominees, minGainPp: c.minGainPp });
  return { out: toSettle > c.reach && toSettle > s.n, toSettle };
}

/** A change's status from its ledger entry in the run's context (untested when it has no games). */
export function changeStatus(entry: LedgerEntry | undefined, c: ShortlistRule): ChangeStatus {
  const games = pooledGames(entry);
  if (!entry || !games.length) return { kind: 'untested' };
  return statusOfSums(sumsOf(games), sumsOf(entry.heldout), c);
}

/** changeStatus from sums: `pooled` = every pooled game (each once), `h` = the held-out games. */
export function statusOfSums(pooled: Sums, h: Sums, c: ShortlistRule): ChangeStatus {
  if (!pooled.n) return { kind: 'untested' };
  const gain = pooledGainOfSums(pooled);
  const heldout = h.n;
  if (h.n) {
    if (heldoutVerdict(h, c) === 'reject') return { kind: 'dropped', why: 'rejected', gain, heldout };
    const r = outOfReach(h, { ...c, reach: c.shortlist.reach });
    if (r.out) return { kind: 'dropped', why: 'out-of-reach', gain, heldout, toSettle: r.toSettle };
  }
  if (gain.mean + c.shortlist.dropSe * gain.se < c.nominateBar) return { kind: 'dropped', why: 'below-bar', gain, heldout };
  return { kind: 'live', gain, heldout };
}

// ---------------------------------------------------------------- one-card swaps from change keys

/** A change key read as a one-card main-deck swap (one cut, one add, nothing else), or null. */
export function swapOfKey(key: string): { base: string; cut: string; add: string } | null {
  const parts = key.split(' ');
  if (parts.length !== 3) return null;
  const [base, minus, plus] = parts as [string, string, string];
  if (!/^[0-9a-f]{16}$/.test(base) || !minus.startsWith('-main:') || !plus.startsWith('+main:')) return null;
  const cut = minus.slice('-main:'.length);
  const add = plus.slice('+main:'.length);
  if (!cut || !add || cut.includes(',') || add.includes(',')) return null;
  return { base, cut, add };
}

/**
 * The candidate list a one-card swap key makes from `base`, built the way the generators build it (the first copy of the
 * cut replaced in place, so a carried candidate plays the same games it played before): the inverse of changeKey. Null
 * when the key is not a one-card swap of this list, the cut is gone, the list would be illegal or the plan refuses it.
 */
export function rebuildSwap(base: DeckList, key: string, plan: PackagePlan = {}): DeckList | null {
  const s = swapOfKey(key);
  if (!s || s.base !== listFingerprint(base)) return null;
  const i = base.main.indexOf(s.cut);
  if (i < 0) return null;
  const main = [...base.main];
  main.splice(i, 1, s.add);
  const d: DeckList = { ...base, main };
  if (validateDeck({ ...d, sideboard: [] }).length) return null;
  if (!isEmptyPlan(plan) && (!canCut(base, s.cut, plan) || checkChange(base, d, plan).length)) return null;
  return d;
}

export interface Carried {
  key: string;
  cut: string;
  add: string;
  deck: DeckList;
  gain: PooledGain;
  heldout: number;
}

/**
 * The changes carried into a generation: from `entries` (this base list's, in the run's context), the live one-card swaps
 * that still apply to `base` under `plan`, best pooled gain first (ties by change key), at most `carry`.
 */
export function carriedChanges(entries: readonly LedgerEntry[], base: DeckList, plan: PackagePlan, c: ShortlistRule): Carried[] {
  const out: Carried[] = [];
  for (const e of entries) {
    const s = swapOfKey(e.id.change);
    if (!s) continue;
    const st = changeStatus(e, c);
    if (st.kind !== 'live') continue;
    const deck = rebuildSwap(base, e.id.change, plan);
    if (!deck) continue;
    out.push({ key: e.id.change, cut: s.cut, add: s.add, deck, gain: st.gain, heldout: st.heldout });
  }
  return out.sort((a, b) => b.gain.mean - a.gain.mean || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).slice(0, Math.max(0, c.shortlist.carry));
}

// ---------------------------------------------------------------- assembling a generation's candidates

export interface Skipped<T> {
  item: T;
  key: string;
  why: 'carried' | DropReason;
  status?: ChangeStatus;
}

/**
 * The carried candidates first, then `picks` in their order, skipping carried and dropped ones (by `statusOf`) and
 * repeats, until `cands` in all. `short`: how many fewer than `cands` there are (the generator ran out).
 */
export function assembleCandidates<T>(carried: readonly T[], picks: readonly T[], o: { cands: number; keyOf: (t: T) => string; statusOf: (key: string) => ChangeStatus }): { candidates: T[]; skipped: Skipped<T>[]; short: number } {
  const candidates = carried.slice(0, Math.max(0, o.cands));
  const carriedKeys = new Set(carried.map(o.keyOf));
  const taken = new Set(candidates.map(o.keyOf));
  const skipped: Skipped<T>[] = [];
  for (const p of picks) {
    if (candidates.length >= o.cands) break;
    const key = o.keyOf(p);
    if (carriedKeys.has(key)) {
      skipped.push({ item: p, key, why: 'carried' });
      continue;
    }
    if (taken.has(key)) continue;
    const st = o.statusOf(key);
    if (st.kind === 'dropped') {
      skipped.push({ item: p, key, why: st.why, status: st });
      continue;
    }
    taken.add(key);
    candidates.push(p);
  }
  return { candidates, skipped, short: Math.max(0, o.cands - candidates.length) };
}

/** What a generation's log keeps about the shortlist (forge JSON `shortlist`, TuneLog.shortlist). */
export interface ShortlistNote {
  /** changes carried from earlier runs: their pooled gain (a fraction) and games before this generation */
  carried: { label: string; gain: number; games: number; heldout: number }[];
  /** the generator's picks skipped: carried already, or dropped and why (with the pooled figures it was dropped on) */
  skipped: { label: string; why: 'carried' | DropReason; gain?: number; games?: number; heldout?: number; toSettle?: number }[];
  /** one-card candidates fewer than asked for: the generator ran out */
  short: number;
}

/**
 * One generation's one-card candidates with the shortlist: the carried changes (the generator's own pick when it offers
 * the same change, else `make`), then the generator's `picks` (its whole order: more than `cands`), as assembleCandidates.
 */
export function shortlistGeneration<T extends { label: string; deck: DeckList }>(o: {
  run: ChangeLedgerRun;
  base: DeckList;
  plan: PackagePlan;
  rule: ShortlistRule;
  picks: readonly T[];
  cands: number;
  make: (cut: string, add: string, deck: DeckList) => T;
}): { candidates: T[]; note: ShortlistNote } {
  const keyOf = (t: T) => changeKey(o.base, t.deck);
  const carried = carriedChanges(o.run.entries(o.base), o.base, o.plan, o.rule);
  const items = carried.map((c) => o.picks.find((p) => keyOf(p) === c.key && p.deck.main.join() === c.deck.main.join()) ?? o.make(c.cut, c.add, c.deck));
  const a = assembleCandidates(items, o.picks, { cands: o.cands, keyOf, statusOf: (key) => changeStatus(o.run.entryOf(key), o.rule) });
  const shown = new Set(a.candidates.map(keyOf));
  return {
    candidates: a.candidates,
    note: {
      carried: carried.flatMap((c, i) => (shown.has(c.key) ? [{ label: items[i]!.label, gain: c.gain.mean, games: c.gain.games, heldout: c.heldout }] : [])),
      skipped: a.skipped.map((s) => ({
        label: s.item.label,
        why: s.why,
        ...(s.status && s.status.kind === 'dropped' ? { gain: s.status.gain.mean, games: s.status.gain.games, heldout: s.status.heldout, ...(s.status.toSettle !== undefined ? { toSettle: s.status.toSettle } : {}) } : {}),
      })),
      short: a.short,
    },
  };
}

// ---------------------------------------------------------------- nomination by pooled gain

export interface PooledFigure {
  /** the pooled gain (a fraction): the run's own screening figure when the change has no earlier games */
  gain: number;
  games: number;
  /** pooled games that are not this generation's screening games */
  earlier: number;
}

/**
 * A screened change's figure for nomination: the pooled gain over every game its entry holds (this generation's
 * screening games included, each game once), or exactly `own` (the run's figure) when none of them is from earlier.
 */
export function pooledFigure(entry: LedgerEntry | undefined, own: { ids: ReadonlySet<string>; gain: number; games: number }): PooledFigure {
  const games = pooledGames(entry);
  const earlier = games.filter((g) => !own.ids.has(gameId(g))).length;
  if (!earlier) return { gain: own.gain, games: own.games, earlier: 0 };
  return { gain: pooledGain(games).mean, games: games.length, earlier };
}

/** `items` best pooled gain first (a stable sort: ties keep their order). */
export function byPooledGain<T>(items: readonly T[], figure: (t: T) => PooledFigure): T[] {
  return [...items].sort((a, b) => figure(b).gain - figure(a).gain);
}

// ---------------------------------------------------------------- words (no "ledger": the Lab shows them too)

const k = (x: number) => x.toLocaleString('en-US');
const pts = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)} pts`;

/** "+2.3 pts over 336 games (224 held-out)" */
export function pooledWords(gain: number, games: number, heldout?: number): string {
  return `${pts(gain)} over ${k(games)} game${games === 1 ? '' : 's'}${heldout ? ` (${k(heldout)} held-out)` : ''}`;
}

/** Why a change was skipped, in plain words. */
export function skippedWords(s: ShortlistNote['skipped'][number], o: { nominateBar: number; dropSe: number; reach: number }): string {
  if (s.why === 'carried') return 'already carried from earlier runs';
  const fig = s.gain !== undefined && s.games !== undefined ? `: ${pooledWords(s.gain, s.games, s.heldout)}` : '';
  if (s.why === 'rejected') return `its earlier held-out games reject it${fig}`;
  if (s.why === 'out-of-reach')
    return `earlier games put it out of reach${fig}; ${s.toSettle !== undefined && Number.isFinite(s.toSettle) ? `it would need about ${k(Math.round(s.toSettle))} held-out games in all` : 'its held-out gain is not above the bar'} (the reach is ${k(o.reach)})`;
  return `earlier games put it under the ${pts(o.nominateBar)} nomination bar${fig}, more than ${o.dropSe} standard error${o.dropSe === 1 ? '' : 's'} below`;
}

/** The shortlist settings in one line (the forge log; the Lab says it in its own sentence). */
export function describeShortlist(o: ShortlistOptions, nominateBar: number): string {
  return `pooled ranking on: up to ${o.carry} change${o.carry === 1 ? '' : 's'} carried from earlier runs (best pooled gain over screening and held-out games), a change dropped when its pooled gain + ${o.dropSe} standard errors is under the ${pts(nominateBar)} nomination bar, when its held-out games reject it, or when it would need more than ${k(o.reach)} held-out games in all to be adopted; nominees ranked by pooled gain`;
}
