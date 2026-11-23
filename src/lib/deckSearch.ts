// Search depth for the deck builders (ROADMAP2 §1 step 5): how many cards or packages one candidate may change, how many
// nominees are confirmed per generation, and what a run will cost in games before it starts. Shared by scripts/forge.ts,
// scripts/optimize.ts and the Deck Lab tuner (src/lib/deckLab.ts). Plain data, Node and browser.
//
// What a run can detect (docs/TUNING_STUDY_2026-11-13.md P4): adoptChance / detectable give the smallest real gain a first
// confirmation adopts 8 times in 10 (and, with "until settled", within the reach), gamesFor the held-out games a gain
// needs, perGameSd the per-game SD a run assumes (the ledger's, else the study's), detectWords the line a run prints.
//
// Candidates of more than one change are built from the best screened single changes (the top `combineFrom` that
// screened above the current list), never from the full cross product: pairs (and triples at depth 3) of those, each a
// legal list that respects the package plan like every other candidate.
import { validateDeck } from '../engine/deck';
import type { DeckList } from '../engine/types';
import { checkChange, isEmptyPlan, type PackagePlan } from './deckPackages';
import { alwaysValidZ, botWord, futilityApplies, lookZs, pooledShare, type AdoptionRule, type ConfirmedWith } from './evidence';
import { normalCdf } from './groupSequential';
import { ledgerBot, summarize, type LedgerEntry } from './changeLedger';
import { swapOfKey } from './shortlist';

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
  /** successive halving rounds (default 1 = no halving; each round halves the pool of single-swap candidates) */
  screenRounds?: number;
  /** initial candidates to start halving from (default = singles; must be >= singles when screenRounds > 1) */
  initialCands?: number;
}

/**
 * Games a run plays: `min` when nothing is nominated, `max` when every confirmation runs to the cap and every combined
 * candidate is built. Per generation: screening (baseline + singles + package moves + combinations), then the
 * confirmation (the current list and each nominee, every stage). The futility stop (src/lib/evidence.ts) only ever
 * ends confirmations sooner, so it lowers what a run plays but never the most it may play.
 *
 * With `screenRounds > 1` (successive halving), the swap candidates start at `initialCands` and are halved each round
 * on `ceil(screenGames / screenRounds)` games; package moves are added in the final round. Each round after the first
 * plays its own baseline (the first round reuses the telemetry baseline).
 */
export function estimateGames(o: BudgetInput): { min: number; max: number; screen: number; combos: number; confirm: number } {
  const legacy = o.rule.kind === 'any-gain';
  const combos =
    (o.depth.cardsPerChange > 1 ? maxCombined(Math.min(o.depth.combineFrom, o.singles), o.depth.cardsPerChange) : 0) +
    (o.depth.packagesPerChange > 1 ? maxCombined(Math.min(o.depth.combineFrom, o.packageMoves), o.depth.packagesPerChange) : 0);
  const rounds = o.screenRounds ?? 1;
  let screen: number;
  if (rounds <= 1) {
    screen = o.screenGames * ((o.baselineScreen === false ? 0 : 1) + o.singles + o.packageMoves);
  } else {
    const gpr = Math.ceil(o.screenGames / rounds);
    let pool = o.initialCands ?? o.singles;
    screen = 0;
    for (let r = 0; r < rounds; r++) {
      const rGames = r === rounds - 1 ? o.screenGames - r * gpr : gpr;
      const isLast = r === rounds - 1;
      const cands = pool + (isLast ? o.packageMoves : 0);
      const baseCost = r === 0 ? (o.baselineScreen === false ? 0 : 1) : 1;
      screen += rGames * (baseCost + cands);
      pool = Math.max(o.singles, Math.ceil(pool / 2));
    }
  }
  const combo = o.screenGames * combos;
  const confirm = o.firstStage * (legacy ? 1 : o.rule.capStages) * (1 + o.depth.nominees);
  return { min: o.gens * screen, max: o.gens * (screen + combo + confirm), screen, combos, confirm };
}

/**
 * What "until settled" may add to a run at most (never counted against the budget): every generation's nominees going on
 * for `stages` further stages each (settleStages: the seeds left and the reach, whichever allow fewer), the current list
 * playing each stage once beside them.
 */
export function settleExtra(o: { gens: number; firstStage: number; stages: number; nominees: number }): number {
  return o.gens * o.stages * o.firstStage * (1 + o.nominees);
}

/** Default most games one forge or optimizer run may plan per deck without --force. */
export const DEFAULT_GAME_BUDGET = 12_000;
/** The Deck Lab asks before a run that may play more than this. */
export const LAB_GAME_BUDGET = 12_000;

// ---------------------------------------------------------------- what a run can detect (docs/TUNING_STUDY_2026-11-13.md P4)

export interface PowerInput {
  /** games in the first confirmation stage */
  firstStage: number;
  rule: AdoptionRule;
  /** per-game SD of the paired difference (a one-card swap about 0.30, a package move about 0.55) */
  sd: number;
  /** nominees per decision (their share of α) */
  nominees?: number;
  /** the bar in points (default the card bar, rule.minGainPp) */
  minGainPp?: number;
  /** confirmation stages at most (default rule.capStages) */
  capStages?: number;
  /** "until settled" to this reach (held-out games in all; absent: a first confirmation alone) */
  reach?: number;
  /** grid points per look (odd, for Simpson's rule; default POWER_GRID) */
  grid?: number;
}

/** Grid points per look (odd, for Simpson's rule): 121 agrees with 241 to 0.01 points on detectable(). */
export const POWER_GRID = 121;
const SQRT2PI = Math.sqrt(2 * Math.PI);
const dnorm = (x: number) => Math.exp(-0.5 * x * x) / SQRT2PI;

/**
 * The chance that a confirmation adopts a change whose real gain is `gain` (a fraction: 0.03 = 3 points), under the
 * normal model of the paired differences: each stage's sum is normal with mean firstStage·gain and variance
 * firstStage·sd². Computed, not simulated: the density of the standardised running sum on the region that is still
 * undecided is carried from look to look by a Gaussian convolution on a grid (as src/lib/groupSequential.ts does for the
 * boundaries), so the exact rule is followed look by look: the staged z's (lookZs), the minimum games before any
 * adoption, rejection when the upper bound is below the bar, and the futility stop. A test checks it against a seeded
 * Monte-Carlo of confirmStaged (tests/detectable.test.ts).
 *
 * With `reach` ("until settled"), an undecided confirmation goes on past the cap in stages of the same size, each judged
 * by the pooled always-valid boundary (alwaysValidZ), with the futility stop on the pooled mean and the out-of-reach stop
 * before each further stage, until the reach. Approximations there: the spread is the true one (the rule uses the guarded
 * estimate, two pseudo-games added, which differs by O(1/n)); "would need more than the reach" is read as "the mean
 * gain over the bar is at most alwaysValidZ(reach)·sd/√reach", which is what gamesToSettle decides when the spread is
 * the true one (z(k)/√k falls with k); and the limit of one run's seeds is ignored, as if the shortlist carried the
 * change into the next run and its confirmation went on there with nothing else in between. The test checks it too.
 */
export function adoptChance(gain: number, o: PowerInput): number {
  const rule = o.rule;
  const m = o.firstStage;
  const sd = o.sd;
  if (!(m > 0) || !(sd > 0)) return 0;
  if (rule.kind === 'any-gain') return normalCdf((gain * Math.sqrt(m)) / sd);
  const nom = Math.max(1, o.nominees ?? 1);
  const K = o.capStages ?? rule.capStages;
  const zs = lookZs({ ...rule, capStages: K }, nom);
  const a = pooledShare(rule.alpha, nom);
  const bar = (o.minGainPp ?? rule.minGainPp) / 100;
  // x = Σ(d − bar) / sd: each stage adds N(drift, m)
  const drift = (m * (gain - bar)) / sd;
  const sdi = Math.sqrt(m);
  const futility = (rule.futilityMaxGainPp / 100 - bar) / sd;
  const reachSlope = o.reach ? alwaysValidZ(o.reach, a) / Math.sqrt(o.reach) : 0;
  const looks = o.reach ? K + Math.ceil(o.reach / m) + 1 : K;
  let xs: Float64Array | null = null;
  let f: Float64Array | null = null;
  let w: Float64Array | null = null;
  let adopt = 0;
  const G = o.grid ?? POWER_GRID;
  for (let k = 1; k <= looks; k++) {
    const n = k * m;
    const staged = k <= K;
    const z = staged ? (zs[k - 1] ?? 1.96) : alwaysValidZ(n, a);
    const up = n >= rule.minGames ? z * Math.sqrt(n) : Infinity;
    // the previous look's density times its Simpson weights
    const ws = w;
    const wf = xs && f && ws ? f.map((v, j) => v * ws[j]!) : null;
    const above = (b: number): number => {
      if (!xs || !wf) return 1 - normalCdf((b - drift) / sdi);
      let s = 0;
      for (let j = 0; j < xs.length; j++) s += wf[j]! * (1 - normalCdf((b - xs[j]! - drift) / sdi));
      return s;
    };
    if (up < Infinity) adopt += above(up);
    // the region still undecided after this look: below the adoption bound, above the rejection bound and the stops
    let lo = -z * Math.sqrt(n);
    if (staged && k < K) {
      if (futilityApplies(rule, k, K)) lo = Math.max(lo, futility * n);
    } else if (o.reach) {
      if (!staged && rule.futilityAfterStages > 0 && n >= rule.futilityAfterStages * m) lo = Math.max(lo, futility * n);
      // out of reach, checked before the next stage
      lo = Math.max(lo, reachSlope * n);
    } else break;
    const centre = k * drift;
    const top = Math.min(up, centre + 8 * Math.sqrt(n));
    const bottom = Math.max(lo, centre - 8 * Math.sqrt(n));
    if (!(top > bottom)) break;
    const h = (top - bottom) / (G - 1);
    const nx = new Float64Array(G);
    const nf = new Float64Array(G);
    for (let i = 0; i < G; i++) nx[i] = bottom + i * h;
    if (!xs || !wf) for (let i = 0; i < G; i++) nf[i] = dnorm((nx[i]! - drift) / sdi) / sdi;
    else
      for (let i = 0; i < G; i++) {
        let s = 0;
        for (let j = 0; j < xs.length; j++) s += wf[j]! * dnorm((nx[i]! - xs[j]! - drift) / sdi);
        nf[i] = s / sdi;
      }
    const nw = new Float64Array(G);
    for (let i = 0; i < G; i++) nw[i] = (i === 0 || i === G - 1 ? 1 : i % 2 ? 4 : 2) * (h / 3);
    xs = nx;
    f = nf;
    w = nw;
  }
  return Math.min(1, Math.max(0, adopt));
}

/** The largest gain detectable() looks at: 60 points (beyond it a change is "not within reach of this run"). */
const MAX_GAIN = 0.6;

/**
 * The smallest real gain (a fraction) that a first confirmation adopts with probability `power` (default 0.8, "8 times
 * in 10"), for this stage size, cap, per-game SD, rule and number of nominees; with `reach`, the gain "until settled"
 * adopts that often within the reach (adoptChance says how each is computed). Infinity when not even a 60-point gain is.
 */
export function detectable(o: PowerInput & { power?: number }): number {
  const power = o.power ?? 0.8;
  let lo = o.rule.kind === 'any-gain' ? 0 : (o.minGainPp ?? o.rule.minGainPp) / 100;
  // bracket from 15 points above the bar, widened to 60 when needed
  let hi = Math.min(MAX_GAIN, lo + 0.15);
  while (adoptChance(hi, o) < power) {
    if (hi >= MAX_GAIN) return Infinity;
    lo = hi;
    hi = Math.min(MAX_GAIN, hi * 2);
  }
  // to 0.005 points: the line shows one decimal
  while (hi - lo > 5e-5) {
    const mid = (lo + hi) / 2;
    if (adoptChance(mid, o) >= power) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * The held-out games (all stages to the cap: capStages × the first stage) a first confirmation needs to adopt a change of
 * real gain `gain` (a fraction) with probability `power` (default 0.8). Infinity when the gain is not above the bar.
 */
export function gamesFor(o: Omit<PowerInput, 'firstStage' | 'reach'> & { gain: number; power?: number }): number {
  const power = o.power ?? 0.8;
  const K = o.rule.kind === 'any-gain' ? 1 : (o.capStages ?? o.rule.capStages);
  const bar = o.rule.kind === 'any-gain' ? 0 : (o.minGainPp ?? o.rule.minGainPp) / 100;
  if (!(o.gain > bar)) return Infinity;
  const ok = (m: number) => adoptChance(o.gain, { ...o, firstStage: m }) >= power;
  let hi = 1;
  while (!ok(hi)) {
    hi *= 2;
    if (hi > 1 << 24) return Infinity;
  }
  let lo = hi / 2;
  if (hi === 1) return K;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return hi * K;
}

// ---------------------------------------------------------------- the per-game SD a run assumes

/** The tuning study's per-game SDs of the paired difference when the ledger holds too little (E3: 0.24 to 0.46 for cards). */
export const DEFAULT_SD: Readonly<{ card: number; package: number }> = Object.freeze({ card: 0.3, package: 0.55 });
/**
 * The per-game SDs with the Hard bot, measured on 2026-11-15 (plan P6, reports/tuning-study-2026-11-13/p6-transfer.txt):
 * the median of 11 one-card swaps (0.34; 0.30 with Medium on the same changes) and the two package swaps (0.56 and 0.62).
 * Used for a run confirmed with Hard when its own ledger changes are too few.
 */
export const HARD_SD: Readonly<{ card: number; package: number; date: string; swaps: number; packages: number }> = Object.freeze({ card: 0.34, package: 0.6, date: '2026-11-15', swaps: 11, packages: 2 });
/** What Hard showed of a gain measured with Medium, over 13 changes (2026-11-15): 0.75 of it, with a standard error of 0.19. */
export const HARD_OF_MEDIUM: Readonly<{ ratio: number; se: number; changes: number }> = Object.freeze({ ratio: 0.75, se: 0.19, changes: 13 });
/** A Hard game took about this many times as long as a Medium one when measured (2026-11-15). */
export const HARD_TIME_RATIO = 20;

/** A bot's canonical name (ledgerBot), or the name as given when the ledger does not know it. */
const canonical = (bot: string): string => ledgerBot(bot).bot ?? bot;

/**
 * The confirmation's bots when they are not the same (by canonical name: lookahead is Medium), else null: a run confirmed
 * with its own screening bot says nothing about bots.
 */
export function confirmedWith(screen: string, confirm: string | undefined): ConfirmedWith | null {
  if (confirm === undefined || canonical(confirm) === canonical(screen)) return null;
  return { screen, confirm };
}

/** Whether a confirmation is Hard after Medium (the pairing the 2026-11-15 measurements are of). */
export const hardAfterMedium = (c: ConfirmedWith | null | undefined): boolean => !!c && canonical(c.confirm) === 'hard' && canonical(c.screen) === 'medium';

/**
 * One sentence beside a run's game estimate when another bot confirms: how many of the games at most are its
 * confirmation games, and, for Hard after Medium, how much longer a Hard game took when measured.
 */
export function confirmGamesWords(c: ConfirmedWith, confirmGames: number, withOriginal = false): string {
  const k = confirmGames.toLocaleString('en-US');
  const slow = hardAfterMedium(c) ? ` A Hard game took about ${HARD_TIME_RATIO} times as long as a Medium one when measured.` : '';
  const what = withOriginal ? 'are the confirmations and the comparison with your original' : 'are confirmation games';
  return `Up to ${k} of them ${what}, played with the ${botWord(c.confirm)} bot.${slow}`;
}
/** A change counts toward the ledger's SD with this many held-out games or more. */
export const SD_MIN_HELDOUT = 200;
/** The ledger's SD is used when it has at least this many such changes of the kind (one-card swaps, or larger changes). */
export const SD_MIN_CHANGES = 3;

/** Per-game SDs of the held-out differences of some changes: one-card swaps apart from larger changes. */
export interface SdSamples {
  swaps: number[];
  larger: number[];
}

/** The SD of each change's held-out paired differences, for changes with SD_MIN_HELDOUT held-out games or more. */
export function heldoutSdSamples(entries: readonly Pick<LedgerEntry, 'id' | 'heldout'>[]): SdSamples {
  const out: SdSamples = { swaps: [], larger: [] };
  for (const e of entries) {
    if (e.heldout.length < SD_MIN_HELDOUT) continue;
    const sd = summarize(e.heldout).sd;
    (swapOfKey(e.id.change) ? out.swaps : out.larger).push(sd);
  }
  return out;
}

export interface PerGameSd {
  card: number;
  package: number;
  /** how many of this list's changes the figure is the median of (0: the study's default) */
  cardFrom: number;
  packageFrom: number;
  /** the defaults are the Hard bot's measured ones (HARD_SD), for a run confirmed with Hard; absent: the study's (DEFAULT_SD) */
  hard?: true;
}

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i]! : (s[i - 1]! + s[i]!) / 2;
};

/**
 * The SDs a run assumes: the median of the ledger's changes of each kind when it holds SD_MIN_CHANGES or more, else the
 * default. `confirmBot`: the bot that confirms when it is not the screening bot (the samples are then its entry's); for
 * Hard the defaults are Hard's measured ones (HARD_SD). Without it, DEFAULT_SD as before.
 */
export function perGameSd(s?: SdSamples, confirmBot?: string): PerGameSd {
  const swaps = s?.swaps ?? [];
  const larger = s?.larger ?? [];
  const card = swaps.length >= SD_MIN_CHANGES;
  const pkg = larger.length >= SD_MIN_CHANGES;
  const hard = confirmBot !== undefined && canonical(confirmBot) === 'hard';
  const d = hard ? HARD_SD : DEFAULT_SD;
  return { card: card ? median(swaps) : d.card, package: pkg ? median(larger) : d.package, cardFrom: card ? swaps.length : 0, packageFrom: pkg ? larger.length : 0, ...(hard ? { hard: true as const } : {}) };
}

export interface Detect {
  /** the gain (a fraction) a first confirmation adopts 8 times in 10: one-card swaps, package moves */
  card: number;
  package: number;
  /** with "until settled" on: the gain adopted 8 times in 10 within the reach */
  settled?: { card: number; package: number; reach: number };
  sd: PerGameSd;
  /** the legacy any-gain rule: it also adopts a change with no real gain about half the time, and the line says so */
  anyGain?: true;
  /** another bot confirms than screens (the line names it) */
  confirmedWith?: ConfirmedWith;
}

/**
 * What a run can detect: detectable() for a one-card swap and a package move, and with "until settled" when it is on.
 * `confirmedWith`: another bot confirms (the SDs are then its own: perGameSd with its name).
 */
export function detect(o: { rule: AdoptionRule; firstStage: number; nominees: number; sd: PerGameSd; untilSettled?: { reach: number }; confirmedWith?: ConfirmedWith | null }): Detect {
  const one = (sd: number, minGainPp: number, reach?: number) => detectable({ firstStage: o.firstStage, rule: o.rule, sd, nominees: o.nominees, minGainPp, ...(reach ? { reach } : {}) });
  const settle = o.untilSettled && o.rule.kind === 'evidence' ? o.untilSettled.reach : undefined;
  return {
    card: one(o.sd.card, o.rule.minGainPp),
    package: one(o.sd.package, o.rule.packageMinGainPp),
    ...(settle ? { settled: { card: one(o.sd.card, o.rule.minGainPp, settle), package: one(o.sd.package, o.rule.packageMinGainPp, settle), reach: settle } } : {}),
    sd: o.sd,
    ...(o.rule.kind === 'any-gain' ? { anyGain: true as const } : {}),
    ...(o.confirmedWith ? { confirmedWith: o.confirmedWith } : {}),
  };
}

/**
 * The line a run prints before it starts: "A first confirmation here adopts a real gain of +3.5 points 8 times in 10
 * (+5.8 for a package move); with until settled, about +2.4 (+4.1 for a package move) within 10,000 held-out games. It
 * assumes a per-game spread of 0.30 for a one-card swap and 0.55 for a package move (the tuning study's typical values)."
 * A run too small to adopt anything says "does not adopt even a real gain of +60 points 8 times in 10"; under the legacy
 * any-gain rule the line adds that a change with no real gain is adopted about half the time.
 */
export function detectWords(d: Detect): string {
  // detectable() gives Infinity when not even a 60-point gain is adopted that often
  const amount = (x: number) => (Number.isFinite(x) ? `+${(x * 100).toFixed(1)}` : 'not even +60');
  const pkgOf = (x: number) => `${amount(x)} for a package move`;
  const c = d.confirmedWith;
  const here = c ? `A first confirmation with the ${botWord(c.confirm)} bot here` : 'A first confirmation here';
  const first = Number.isFinite(d.card) ? `${here} adopts a real gain of ${amount(d.card)} points 8 times in 10 (${pkgOf(d.package)})` : `${here} does not adopt even a real gain of +60 points 8 times in 10 (${pkgOf(d.package)})`;
  const settled = d.settled ? `; with until settled, ${Number.isFinite(d.settled.card) ? 'about ' : ''}${amount(d.settled.card)} (${pkgOf(d.settled.package)}) within ${d.settled.reach.toLocaleString('en-US')} held-out games` : '';
  const anyGain = d.anyGain ? ' Under the any-gain rule a change with no real gain at all is adopted about half the time too.' : '';
  const from = (sd: number, k: number, what: string) => `${sd.toFixed(2)} for ${what}${k ? ` (the median of ${k} changes of this list with ${SD_MIN_HELDOUT} or more held-out games)` : ''}`;
  const both = !d.sd.cardFrom && !d.sd.packageFrom;
  const some = !d.sd.cardFrom || !d.sd.packageFrom;
  const typical = d.sd.hard
    ? both
      ? ` (measured with the Hard bot on ${HARD_SD.date}: ${HARD_SD.swaps} one-card swaps, ${HARD_SD.packages} package swaps)`
      : some
        ? `; the other is the Hard bot's value measured on ${HARD_SD.date}`
        : ''
    : both
      ? " (the tuning study's typical values)"
      : some
        ? "; the other is the tuning study's typical value"
        : '';
  const spread = `It assumes a per-game spread of ${from(d.sd.card, d.sd.cardFrom, 'a one-card swap')} and ${from(d.sd.package, d.sd.packageFrom, 'a package move')}${typical}.`;
  const transfer = hardAfterMedium(c) ? ` A gain measured with Medium showed at about ${HARD_OF_MEDIUM.ratio} of its size with Hard (± ${HARD_OF_MEDIUM.se}, ${HARD_OF_MEDIUM.changes} changes).` : '';
  return `${first}${settled}.${anyGain} ${spread}${transfer}`;
}
