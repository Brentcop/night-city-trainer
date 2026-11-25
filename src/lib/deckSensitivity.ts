// The per-deck sensitivity report (docs/REVIEW_2026-11-24.md row 15 and §10 D.3; scripts/deck-sensitivity.ts): which
// decks a bot or evaluation change favours. The same round robin (every ordered pairing, the same deals: decks, seed,
// first player) is played once under the base configuration and once under the change, both seats piloted by the
// configuration under test. Each deck's win rate against the field under each, its paired change (a pair is one deal
// under both configurations) with the standard error, its rank under each; then the summary: decks beyond 2 and 3 SE
// against the chance expectation, Spearman of the two orders with a paired bootstrap interval (src/lib/rankStability.ts),
// the share of deals with the same winner, the mean absolute change, and how the change lines up with list features and
// deck families. Plain data and plain functions; the games come from the caller.
import { CARD_BY_ID } from '../engine/cards';
import { classify, type Archetype } from '../ai/archetype';
import { comboOf } from './colorSplit';
import { lcg, pairedDeckDiff, pearson, quantile, rankStability, spearman, type Deal } from './rankStability';

/** P(|Z| > 2) and P(|Z| > 3) for a standard normal: the share of decks expected beyond 2 or 3 SE when nothing moved. */
export const TWO_SE_TAIL = 0.0455003;
export const THREE_SE_TAIL = 0.0026998;

/** List features the change is correlated with. Counts are main-deck cards with copies; Legends are counted where named. */
export interface DeckFeatures {
  units: number;
  /** main-deck cards with the Blocker keyword (Units and Gear) */
  blockers: number;
  programs: number;
  /** main-deck Programs with the Quick keyword */
  quickPrograms: number;
  gear: number;
  /**
   * cards that interact on the rival's turn: main-deck cards with the Quick keyword (Quick Programs, Rogue Amendiares,
   * Overwatch), plus each Legend with a {Quick} ability (Goro, Dum Dum, River Ward) or a reaction Call (a {Call} that
   * acts on a Unit this turn: Wakako, Padre, Dexter, Reyes; `isReactionCall`)
   */
  rivalTurn: number;
  /** Legends whose colour is Red */
  redLegends: number;
  /** the colour pill (`comboOf`, src/lib/colorSplit.ts) */
  combo: string;
  /** `classify` (src/ai/archetype.ts) on the main deck */
  archetype: Archetype;
  aggroScore: number;
}

/** The numeric features, in the order the report lists them, with their words. */
export const NUMERIC_FEATURES = [
  ['units', 'Units'],
  ['blockers', 'Blockers'],
  ['programs', 'Programs'],
  ['quickPrograms', 'Quick Programs'],
  ['gear', 'Gear'],
  ['rivalTurn', "Cards that act on the rival's turn"],
  ['redLegends', 'Red Legends'],
  ['aggroScore', 'aggroScore (src/ai/archetype.ts)'],
] as const satisfies readonly (readonly [keyof DeckFeatures, string])[];
export type NumericFeature = (typeof NUMERIC_FEATURES)[number][0];

/** The text of a Legend's {Call}: from the marker to the next ability marker on a new line (or the end). */
function callText(text: string): string | null {
  const at = text.indexOf('{Call}');
  if (at < 0) return null;
  const rest = text.slice(at + '{Call}'.length);
  const next = rest.search(/\n\{/);
  return next < 0 ? rest : rest.slice(0, next);
}

/** A Legend whose Call can matter in a reaction window: it acts on a Unit this turn (a power change, Spend, can't be defeated). */
export function isReactionCall(text: string): boolean {
  const call = callText(text);
  return call !== null && /this turn|a rival Unit/i.test(call);
}

export function deckFeatures(deck: { legends: readonly string[]; main: readonly string[] }): DeckFeatures {
  let units = 0;
  let blockers = 0;
  let programs = 0;
  let quickPrograms = 0;
  let gear = 0;
  let rivalTurn = 0;
  for (const id of deck.main) {
    const c = CARD_BY_ID[id];
    if (!c) continue;
    if (c.type === 'Unit') units++;
    if (c.type === 'Program') programs++;
    if (c.type === 'Gear') gear++;
    if (c.keywords.includes('blocker')) blockers++;
    if (c.keywords.includes('quick')) {
      rivalTurn++;
      if (c.type === 'Program') quickPrograms++;
    }
  }
  let redLegends = 0;
  for (const id of deck.legends) {
    const c = CARD_BY_ID[id];
    if (!c) continue;
    if (c.color === 'Red') redLegends++;
    if (c.keywords.includes('quick') || isReactionCall(c.text)) rivalTurn++;
  }
  const a = classify([...deck.main]);
  return { units, blockers, programs, quickPrograms, gear, rivalTurn, redLegends, combo: comboOf(deck.legends), archetype: a.arch, aggroScore: a.aggroScore };
}

/** A deck in the report: its library file, name, source key (deckSource, src/lib/deckSource.ts) and list. */
export interface SensitivityDeck {
  file: string;
  name: string;
  source: string;
  legends: readonly string[];
  main: readonly string[];
}

const legendNames = (d: SensitivityDeck) => d.legends.map((id) => CARD_BY_ID[id]?.name ?? id);

/** The deck families the report compares with the rest. Each names its rule. */
export interface Family {
  key: string;
  label: string;
  rule: string;
  test: (d: SensitivityDeck, f: DeckFeatures) => boolean;
}
export const FAMILIES: readonly Family[] = [
  { key: 'bbg', label: 'BBG control family (Jackie / Alt / Hanako, Cunningham)', rule: 'colour pill BBG', test: (_d, f) => f.combo === 'BBG' },
  {
    key: 'v-smasher',
    label: 'V / Smasher lists',
    rule: 'V and Adam Smasher both among the Legends',
    test: (d) => {
      const n = legendNames(d);
      return n.includes('V') && n.includes('Adam Smasher');
    },
  },
  { key: 'two-red', label: 'Two or more red Legends', rule: 'at least 2 Red Legends', test: (_d, f) => f.redLegends >= 2 },
  { key: 'bred', label: 'Bred decks', rule: 'season files s<N>- (source bred)', test: (d) => d.source === 'bred' },
  { key: 'imported', label: 'Imported player lists', rule: 'source shared (Origin "Imported from …", the import- files)', test: (d) => d.source === 'shared' },
];

export interface DeckSensitivityRow {
  deck: number;
  file: string;
  name: string;
  source: string;
  features: DeckFeatures;
  base: { wr: number; games: number; rank: number };
  change: { wr: number; games: number; rank: number };
  /** win rate under the change minus under the base (a share, not points), its paired SE and diff / SE (±Infinity when the SE is 0; null in JSON) */
  diff: number;
  se: number;
  z: number;
  /** rank under the change minus under the base (> 0: lower under the change), with its bootstrap 95% interval */
  rankShift: number;
  rankShiftLo: number;
  rankShiftHi: number;
}

export interface FeatureCorrelation {
  key: NumericFeature;
  label: string;
  pearson: number;
  spearman: number;
  /** two-sided permutation p of Pearson's r (the changes shuffled across decks) */
  p: number;
  /** mean change of the decks in the lowest and highest third of the feature (at or below the 1/3 quantile, at or above the 2/3) */
  low: { n: number; mean: number; upTo: number };
  high: { n: number; mean: number; from: number };
}

export interface GroupComparison {
  key: string;
  label: string;
  rule: string;
  n: number;
  mean: number;
  restN: number;
  restMean: number;
  /** mean in the family minus the rest, its Welch SE (decks as the units) and a two-sided permutation p */
  diff: number;
  se: number;
  p: number;
}

export interface GroupMean {
  value: string;
  n: number;
  mean: number;
}

export interface SensitivitySummary {
  decks: number;
  deals: number;
  beyond2: number;
  beyond3: number;
  /** decks expected beyond 2 and 3 SE when nothing moved (decks × the normal tail; the decks' changes are taken as independent) */
  chance2: number;
  chance3: number;
  spearman: { rho: number; lower: number; upper: number; boot: number };
  /** share of deals with the same result (same winner, or a tie both times) */
  sameWinner: number;
  /** mean over decks of |change| (a share) */
  meanAbsChange: number;
  /** SD of the changes across decks, the noise (root mean square SE) and the spread left beyond the noise */
  spread: number;
  noise: number;
  trueSpread: number;
  features: FeatureCorrelation[];
  families: GroupComparison[];
  byArchetype: GroupMean[];
  bySource: GroupMean[];
  byRedLegends: GroupMean[];
}

export interface SensitivityReport {
  rows: DeckSensitivityRow[];
  summary: SensitivitySummary;
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const variance = (xs: readonly number[]) => {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
};

/** Fisher–Yates with the seeded stream. */
function shuffled<T>(xs: readonly T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i] as T;
    a[i] = a[j] as T;
    a[j] = t;
  }
  return a;
}

/** Two-sided permutation p of Pearson's r (`perms` shuffles of y; the observed value counts once). */
export function permutationP(x: readonly number[], y: readonly number[], perms: number, rnd: () => number): number {
  const r = Math.abs(pearson(x, y));
  if (!Number.isFinite(r)) return NaN;
  let hits = 1;
  for (let k = 0; k < perms; k++) if (Math.abs(pearson(x, shuffled(y, rnd))) >= r - 1e-12) hits++;
  return hits / (perms + 1);
}

/** A family against the rest: means, the difference with its Welch SE, and a two-sided label-permutation p. */
export function compareGroup(values: readonly number[], inGroup: readonly boolean[], perms: number, rnd: () => number): Omit<GroupComparison, 'key' | 'label' | 'rule'> {
  const split = (mask: readonly boolean[]) => {
    const a: number[] = [];
    const b: number[] = [];
    values.forEach((v, i) => (mask[i] ? a : b).push(v));
    return [a, b] as const;
  };
  const [a, b] = split(inGroup);
  const diff = mean(a) - mean(b);
  const se = Math.sqrt(variance(a) / a.length + variance(b) / b.length);
  let p = NaN;
  if (a.length && b.length) {
    let hits = 1;
    for (let k = 0; k < perms; k++) {
      const [pa, pb] = split(shuffled(inGroup, rnd));
      if (Math.abs(mean(pa) - mean(pb)) >= Math.abs(diff) - 1e-12) hits++;
    }
    p = hits / (perms + 1);
  }
  return { n: a.length, mean: mean(a), restN: b.length, restMean: mean(b), diff, se, p };
}

function groupMeans(values: readonly number[], keys: readonly string[], order?: readonly string[]): GroupMean[] {
  const by = new Map<string, number[]>();
  keys.forEach((k, i) => {
    const g = by.get(k);
    const v = values[i] as number;
    if (g) g.push(v);
    else by.set(k, [v]);
  });
  const ks = [...by.keys()].sort((p, q) => (order ? order.indexOf(p) - order.indexOf(q) : 0) || p.localeCompare(q));
  return ks.map((k) => {
    const g = by.get(k) ?? [];
    return { value: k, n: g.length, mean: mean(g) };
  });
}

export interface SensitivityOptions {
  /** bootstrap resamples for Spearman's interval and the rank intervals (default 2000) */
  boot?: number;
  /** shuffles for the permutation p values (default 2000) */
  perms?: number;
  seed?: number;
}

/**
 * The report. `base[i]` and `change[i]` are the seat-0 deck's score in deal i (1 win, ½ tie, 0 loss) under the base and
 * the change; the same deals for both. `decks[k]` is deck index k of the deals.
 */
export function deckSensitivity(deals: readonly Deal[], base: readonly number[], change: readonly number[], decks: readonly SensitivityDeck[], o: SensitivityOptions = {}): SensitivityReport {
  if (base.length !== deals.length || change.length !== deals.length) throw new Error('base and change need a score for every deal');
  const n = decks.length;
  const boot = o.boot ?? 2000;
  const perms = o.perms ?? 2000;
  const rs = rankStability(deals, [base, change], n, { boot, seed: o.seed ?? 1 });
  const B = rs.bots[0]!;
  const C = rs.bots[1]!;
  const pair = rs.pairs[0]!;
  const diffs = pairedDeckDiff(deals, change, base, n);
  const features = decks.map(deckFeatures);
  const rows: DeckSensitivityRow[] = decks.map((d, k) => {
    const df = diffs[k]!;
    const mv = pair.decks[k]!;
    // rankStability's rankDelta is base rank minus change rank; the report gives change minus base
    return {
      deck: k,
      file: d.file,
      name: d.name,
      source: d.source,
      features: features[k]!,
      base: { wr: B.wr[k]!, games: B.n[k]!, rank: B.rank[k]! },
      change: { wr: C.wr[k]!, games: C.n[k]!, rank: C.rank[k]! },
      diff: df.diff,
      se: df.se,
      // an SE of 0 (every pair moved alike) makes any change infinitely many SE; no change is z 0
      z: df.se > 0 ? df.diff / df.se : df.diff === 0 ? 0 : Math.sign(df.diff) * Infinity,
      rankShift: -mv.rankDelta,
      rankShiftLo: -mv.rankHi,
      rankShiftHi: -mv.rankLo,
    };
  });
  const d = rows.map((r) => r.diff);
  const rnd = lcg((o.seed ?? 1) ^ 0x5eed);
  const featureRows: FeatureCorrelation[] = NUMERIC_FEATURES.map(([key, label]) => {
    const x = features.map((f) => f[key]);
    const lo = quantile(x, 1 / 3);
    const hi = quantile(x, 2 / 3);
    const low = d.filter((_, i) => x[i]! <= lo);
    const high = d.filter((_, i) => x[i]! >= hi);
    return {
      key,
      label,
      pearson: pearson(x, d),
      spearman: spearman(x, d),
      p: permutationP(x, d, perms, rnd),
      low: { n: low.length, mean: mean(low), upTo: lo },
      high: { n: high.length, mean: mean(high), from: hi },
    };
  });
  const families: GroupComparison[] = FAMILIES.map((f) => ({ key: f.key, label: f.label, rule: f.rule, ...compareGroup(d, decks.map((dk, i) => f.test(dk, features[i]!)), perms, rnd) }));
  const same = deals.reduce((s, _x, i) => s + (base[i] === change[i] ? 1 : 0), 0);
  const ses = rows.map((r) => r.se).filter((s) => Number.isFinite(s));
  const spread = Math.sqrt(variance(d));
  const noise = Math.sqrt(mean(ses.map((s) => s * s)));
  return {
    rows,
    summary: {
      decks: n,
      deals: deals.length,
      beyond2: rows.filter((r) => Math.abs(r.diff) > 2 * r.se).length,
      beyond3: rows.filter((r) => Math.abs(r.diff) > 3 * r.se).length,
      chance2: n * TWO_SE_TAIL,
      chance3: n * THREE_SE_TAIL,
      spearman: { rho: pair.rho, lower: pair.lower, upper: pair.upper, boot },
      sameWinner: deals.length ? same / deals.length : NaN,
      meanAbsChange: mean(d.map(Math.abs)),
      spread,
      noise,
      trueSpread: Math.sqrt(Math.max(0, spread * spread - noise * noise)),
      features: featureRows,
      families,
      byArchetype: groupMeans(d, features.map((f) => f.archetype), ['aggro', 'midrange', 'control']),
      bySource: groupMeans(d, decks.map((dk) => dk.source)),
      byRedLegends: groupMeans(d, features.map((f) => String(f.redLegends)), ['0', '1', '2', '3']),
    },
  };
}

/** The decks beyond `k` SE, largest |z| first. */
export function decksBeyond(rows: readonly DeckSensitivityRow[], k = 2): DeckSensitivityRow[] {
  return rows.filter((r) => Math.abs(r.diff) > k * r.se).sort((p, q) => Math.abs(q.z) - Math.abs(p.z) || p.deck - q.deck);
}
