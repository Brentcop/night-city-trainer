// Findings (docs/EVIDENCE.md; docs/TUNING_STUDY_2026-11-13.md "Proposed evidence view", plan P2): every number the site
// reports about a deck as one plain-data record with its estimate, interval and level, the games behind it, a strength
// word given by a stated rule, a stable id, and its nature: a recorded result, a measured effect, or an association.
//
// Pure, Node and browser. Nothing here reads a file, the engine, the bots or the simulator: scripts/build-evidence.ts
// builds the findings from the measured reports and writes public/data/evidence/, and a page reads them with these types.
// The fixed wording (claims, chip words, flags, why an association may mislead) is in src/lib/findingWords.ts.
//
//   - Three natures, never mixed: 'result' (what the deck's recorded games show), 'effect' (a paired comparison of two
//     lists on the same seeds, opponents and seats; the only nature that may say "adds" or "costs"), 'association'
//     (games where a card was drawn or a package was online).
//   - The strength rule (`strengthOf`) is a table: games under a minimum are 'not-enough'; a plain 95% interval that
//     excludes the baseline is 'moderate', or 'strong' when the family test passes too, the effect is at least a point,
//     the games reach the strong threshold, it is current and it is not an association (unless an adjusted estimate also
//     clears the bar); an interval that includes the baseline is 'weak' (effect a point or more), 'no-difference' (under
//     a point, half-width at most 2 points) or 'not-enough'.
//   - Families: a deck's matchups, cards, packages and endings are each tested together by Benjamini–Hochberg at
//     q = 0.10 (`bhPass`); a change keeps the correction its tool applied.
//   - Ids are a hash of what was measured (kind, subject, method, bot, simulator version, field), never of the result.
import { normalCdf } from './groupSequential';
import { CURRENT_SIM_VERSION } from './playedRecord';
import { hash64 } from './stateHash';
import type { RunManifest } from './runManifest';

export const EVIDENCE_KIND = 'nct-evidence';
export const EVIDENCE_INDEX_KIND = 'nct-evidence-index';
export const EVIDENCE_RUNS_KIND = 'nct-evidence-runs';
export const EVIDENCE_IDS_KIND = 'nct-evidence-ids';
export const EVIDENCE_SCHEMA = 1;

export type FindingKind = 'deck-strength' | 'matchup' | 'seat' | 'length' | 'ending' | 'card-assoc' | 'package-assoc' | 'change';
export const FINDING_KINDS: readonly FindingKind[] = ['deck-strength', 'matchup', 'seat', 'length', 'ending', 'card-assoc', 'package-assoc', 'change'];

export type Nature = 'result' | 'effect' | 'association';
export const NATURE_OF: Readonly<Record<FindingKind, Nature>> = {
  'deck-strength': 'result',
  matchup: 'result',
  seat: 'result',
  length: 'result',
  ending: 'result',
  'card-assoc': 'association',
  'package-assoc': 'association',
  change: 'effect',
};

export type Strength = 'strong' | 'moderate' | 'weak' | 'not-enough' | 'no-difference';
export const STRENGTHS: readonly Strength[] = ['strong', 'moderate', 'weak', 'no-difference', 'not-enough'];

/**
 * How a number was measured:
 * - 'rating-model': the power ratings' expected win rate against the field (src/lib/ratingModel.ts);
 * - 'shrunk': a head-to-head shrunk toward the ratings' prediction (src/lib/h2hModel.ts);
 * - 'direct-games': a pairing's own recorded win rate over many games (the per-deck analysis' pairing table);
 * - 'model-residual': the deck's results minus the ratings' prediction for each game, split two ways (seat);
 * - 'result-split': win rates or shares of the recorded games, split two ways (length, ending);
 * - 'association': win rate when drawn or online minus when not;
 * - 'paired-pooled': a change's held-out paired games pooled across runs (the change ledger);
 * - 'paired-staged': a change's held-out paired games from one staged confirmation (a recorded forge report);
 * - 'paired': a single fixed-size paired re-measurement (data/evidence/).
 */
export type Method = 'rating-model' | 'shrunk' | 'direct-games' | 'model-residual' | 'result-split' | 'association' | 'paired-pooled' | 'paired-staged' | 'paired';
/** The class a method's game minimums are read from. */
export type MethodClass = 'paired' | 'model' | 'split' | 'association';
export const METHOD_CLASS: Readonly<Record<Method, MethodClass>> = {
  'rating-model': 'model',
  shrunk: 'model',
  'direct-games': 'split',
  'model-residual': 'split',
  'result-split': 'split',
  association: 'association',
  'paired-pooled': 'paired',
  'paired-staged': 'paired',
  paired: 'paired',
};

/**
 * The game minimums of the strength rule, by method class. `min`: below it a finding is 'not-enough' whatever its
 * interval. `strong`: a finding is 'strong' only from here on. What `n` counts: paired games (paired); rated games, the
 * fewer of both decks for a matchup (model); games on the smaller side of the comparison (split, association).
 */
export const GAME_THRESHOLDS: Readonly<Record<MethodClass, { min: number; strong: number }>> = {
  paired: { min: 200, strong: 1000 },
  model: { min: 20, strong: 200 },
  split: { min: 20, strong: 200 },
  association: { min: 20, strong: 200 },
};

/** One point of win rate. */
export const POINT = 0.01;
/** The smallest effect the rule calls more than nothing: one point. */
export const MIN_EFFECT = POINT;
/** Under a point, an interval this narrow (half-width, two points) says "no difference"; a wider one "not enough". */
export const NO_DIFFERENCE_HALF_WIDTH = 2 * POINT;
/** Benjamini–Hochberg's false discovery rate within a family. */
export const BH_Q = 0.1;
/** z of a plain two-sided 95% interval. */
export const Z95 = 1.96;

/** Codes a page turns into words (src/lib/findingWords.ts FLAG_WORDS). */
export type FlagCode =
  | 'stale'
  | 'medium-only'
  | 'first-look'
  | 'stopped-futility'
  | 'few-direct-games'
  | 'prediction-only'
  | 'depends-on-opponent'
  | 'other-list'
  | 'model-uncertainty-missing'
  | 'spread-default';
export const FLAG_CODES: readonly FlagCode[] = ['stale', 'medium-only', 'first-look', 'stopped-futility', 'few-direct-games', 'prediction-only', 'depends-on-opponent', 'other-list', 'model-uncertainty-missing', 'spread-default'];

/** A sequentially corrected interval: which correction drew it. */
export type SequentialKind = 'always-valid' | 'obrien-fleming' | 'bonferroni';
/** How a family was tested: Benjamini–Hochberg, the tools' own sequential corrections, or none (a family of one). */
export type Correction = 'bh' | 'always-valid' | 'obrien-fleming' | 'bonferroni' | 'none';

/** Where a number comes from: a tracked file and the field path inside it. */
export interface Source {
  file: string;
  /** a JSON path ("decks[3].wrField") or, for a ledger file, the entry ("entry <change key> v9 medium <field>") */
  path: string;
}

/** A change between two lists, by card id (with repeats), as the ledger keys it (changeKey in src/lib/changeLedger.ts). */
export interface ChangeSubject {
  /** the change key: base list fingerprint, then the sorted cuts and adds */
  key: string;
  /** the list the change starts from */
  base: string;
  cuts: string[];
  adds: string[];
  legendCuts?: string[];
  legendAdds?: string[];
  /** the change in words, as the tool recorded it */
  label: string;
  /** whether it starts from this deck's list, leads to it, or concerns another list of the deck */
  relation: 'from-this-list' | 'to-this-list' | 'other-list';
}

export interface Subject {
  /** the deck's list fingerprint (listFingerprint) and its name and library file */
  listId: string;
  deck: string;
  file: string;
  card?: { id: string; name: string };
  package?: { id: string; name: string };
  opponent?: { listId: string; deck: string };
  change?: ChangeSubject;
  /** an ending: the game-end reason string as recorded */
  ending?: string;
}

/** An adjusted, shrunk association estimate (landmark, by opponent and seat; src/analysis/impactAdjusted.ts). */
export interface AdjustedEstimate {
  method: 'landmark-stratified-shrunk';
  /** the adjusted estimate with its plain 95% interval */
  estimate: number;
  lower: number;
  upper: number;
  /** the shrunk value (normal prior N(0, τ²)) and its posterior 95% interval */
  shrunk: number;
  shrunkLower: number;
  shrunkUpper: number;
  simVersion: number;
  bot: string;
  source: Source;
}

/** Display numbers that only some kinds carry. */
export interface FindingDetail {
  /** matchup: the raw record (a's wins, ties half, of games), the ratings' prediction and the prior's weight in games */
  raw?: { wins: number; games: number };
  prediction?: number;
  priorGames?: number;
  /** matchup: the pair spread (SD of a pairing's true win rate around the ratings' prediction) the interval assumes */
  pairSd?: number;
  /** seat: the raw split from the recorded games, wins (ties out) of decided games each way */
  first?: { won: number; decided: number; ties: number };
  second?: { won: number; decided: number; ties: number };
  /** seat: mean result minus prediction going first and going second, with the games each way */
  residual?: { first: number; second: number; firstGames: number; secondGames: number };
  /** length: the cut points and the win rates (ties half) of each third with their Wilson intervals */
  thirds?: { label: 'short' | 'middle' | 'long'; maxTurns: number | null; minTurns: number | null; games: number; rate: number; lower: number; upper: number }[];
  /** ending: the deck's wins that ended this way, of its wins, and the field's share */
  share?: { n: number; of: number; field: number; fieldN: number; fieldOf: number };
  /** associations: the two win rates compared and their games */
  rates?: { a: number; aGames: number; b: number; bGames: number; aLabel: string; bLabel: string };
  /** package-assoc: assembled and online rates (share of games) */
  assembled?: number;
  online?: number;
  /** change: the screening games' figure (plain 95%), always optimistic: shown greyed, never as the result */
  screen?: { games: number; mean: number; lower: number; upper: number; flag: 'screening' };
  /** change: the verdict the tool's rule gives, the runs that tested it, and its status in the shortlist */
  verdict?: 'adopt' | 'reject' | 'undecided' | 'inconclusive';
  runs?: number;
  status?: 'live' | 'dropped' | 'untested';
  dropped?: 'below-bar' | 'rejected' | 'out-of-reach';
  /** change: pooled held-out games needed in all to settle it at its present mean and spread (null: mean not above the bar) */
  toSettle?: number | null;
  /** change: the looks the staged confirmation used */
  looks?: number;
  /** change: per opponent (by name or list id) and per seat, mean and standard error, with games */
  byOpp?: { opp: string; games: number; mean: number; se: number }[];
  bySeat?: { first: 0 | 1; games: number; mean: number; se: number }[];
  /** change: heterogeneity across opponents (χ² of the per-opponent means around the pooled mean) */
  heterogeneity?: { chi2: number; df: number; p: number };
  /** change: when it was measured (YYYY-MM-DD) and by which script (re-measurements) */
  date?: string;
  script?: string;
  /** change: the earlier record a re-measurement re-measured, in words */
  record?: string;
}

export interface Finding {
  /** a hash of what was measured (kind, subject, method, bot, simulator version, field): 16 hex digits */
  id: string;
  /** the id's first 8 hex digits (unique in the evidence files) */
  short: string;
  /**
   * the same hash without bot, simulator version and method: "same question, another measurement" (a change measured by
   * the forge, the ledger and a re-measurement is one question)
   */
  question: string;
  kind: FindingKind;
  nature: Nature;
  /** one line, without the numbers (src/lib/findingWords.ts claimOf) */
  claim: string;
  subject: Subject;
  /** a win rate, a share, or a difference (a fraction: 0.01 = one point) */
  estimate: number;
  lower: number;
  upper: number;
  level: 0.9 | 0.95;
  /** the interval [lower, upper] is a sequentially corrected one, drawn by this correction */
  sequential?: SequentialKind;
  /** the plain 95% interval the strength rule reads, when [lower, upper] is not one */
  p95?: [number, number];
  /** what "no difference" is: 0 for a difference, 0.5 for a win rate, or the field's value */
  baseline: number;
  /** the games behind the number (paired games, direct games of a matchup, the deck's games) */
  games: number;
  /** the count the strength rule's game minimums read (GAME_THRESHOLDS) */
  n: number;
  method: Method;
  simVersion: number;
  bot: string;
  /** the field it was measured against */
  field: string;
  sources: Source[];
  family: { key: string; size: number; correction: Correction };
  /** it passed its family's test (Benjamini–Hochberg at q = 0.10, or the tool's sequential correction) */
  corrected: boolean;
  strength: Strength;
  flags: FlagCode[];
  adjusted?: AdjustedEstimate;
  detail?: FindingDetail;
}

// ---------------------------------------------------------------- the strength rule

/** The plain 95% interval of a finding: `p95` when stored, else its own interval (which then is one). */
export const plain95 = (f: Pick<Finding, 'lower' | 'upper' | 'p95'>): [number, number] => f.p95 ?? [f.lower, f.upper];

/** Measured under another simulator version than the current one. */
export const isStale = (simVersion: number, current: number = CURRENT_SIM_VERSION): boolean => simVersion !== current;

/** An adjusted estimate clears the bar: its shrunk posterior interval excludes 0 and the shrunk value is a point or more. */
export function adjustedClears(a: AdjustedEstimate | undefined, sign: number): boolean {
  if (!a) return false;
  const excludes = a.shrunkLower > 0 || a.shrunkUpper < 0;
  return excludes && Math.abs(a.shrunk) >= MIN_EFFECT && Math.sign(a.shrunk) === sign;
}

export type StrengthInput = Pick<Finding, 'estimate' | 'lower' | 'upper' | 'p95' | 'baseline' | 'n' | 'method' | 'nature' | 'corrected' | 'simVersion' | 'adjusted'>;

/** Why a finding got its strength word, step by step (for the doc's table and a page's "why"). */
export type StrengthStep = 'under-minimum' | 'excludes-strong' | 'excludes-moderate' | 'includes-weak' | 'includes-no-difference' | 'includes-not-enough';

/** The step of the strength rule a finding lands on. */
export function strengthStep(f: StrengthInput, current: number = CURRENT_SIM_VERSION): StrengthStep {
  const cls = METHOD_CLASS[f.method];
  const t = GAME_THRESHOLDS[cls];
  if (!(f.n >= t.min)) return 'under-minimum';
  const effect = f.estimate - f.baseline;
  const [lo, hi] = plain95(f);
  const excludes = lo > f.baseline || hi < f.baseline;
  // a hair under a point (rounding) still counts as under a point
  const big = Math.abs(effect) >= MIN_EFFECT - 1e-12;
  if (excludes) {
    const assocOk = f.nature !== 'association' || adjustedClears(f.adjusted, Math.sign(effect));
    const strong = f.corrected && big && f.n >= t.strong && !isStale(f.simVersion, current) && assocOk;
    return strong ? 'excludes-strong' : 'excludes-moderate';
  }
  if (big) return 'includes-weak';
  return (hi - lo) / 2 <= NO_DIFFERENCE_HALF_WIDTH + 1e-12 ? 'includes-no-difference' : 'includes-not-enough';
}

const STEP_WORD: Readonly<Record<StrengthStep, Strength>> = {
  'under-minimum': 'not-enough',
  'excludes-strong': 'strong',
  'excludes-moderate': 'moderate',
  'includes-weak': 'weak',
  'includes-no-difference': 'no-difference',
  'includes-not-enough': 'not-enough',
};

/** The strength word of a finding, from its stored fields alone (check:data recomputes every stored one). */
export const strengthOf = (f: StrengthInput, current: number = CURRENT_SIM_VERSION): Strength => STEP_WORD[strengthStep(f, current)];

// ---------------------------------------------------------------- families

/**
 * The two-sided p-value the plain 95% interval implies: the standard error is read from the half of the interval that
 * faces the baseline (intervals of rates are not symmetric), so "p < 0.05" and "the interval excludes the baseline"
 * agree. Approximate for Wilson, Newcombe and logit intervals; exact for a normal one.
 */
export function pValueOf(f: Pick<Finding, 'estimate' | 'lower' | 'upper' | 'p95' | 'baseline'>): number {
  const [lo, hi] = plain95(f);
  const effect = f.estimate - f.baseline;
  const half = effect >= 0 ? f.estimate - lo : hi - f.estimate;
  if (!(half > 0)) return effect === 0 ? 1 : 0;
  const z = Math.abs(effect) / (half / Z95);
  return Math.min(1, 2 * (1 - normalCdf(z)));
}

/**
 * Benjamini–Hochberg at `q` over one family's p-values: which ones it rejects (the largest k with p₍ₖ₎ ≤ k·q/m, and every
 * p up to it). The order of the input is kept.
 */
export function bhPass(ps: readonly number[], q: number = BH_Q): boolean[] {
  const m = ps.length;
  const order = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p || a.i - b.i);
  let k = 0;
  order.forEach((x, r) => {
    if (x.p <= ((r + 1) * q) / m) k = r + 1;
  });
  const out = new Array<boolean>(m).fill(false);
  for (let r = 0; r < k; r++) out[order[r]!.i] = true;
  return out;
}

/** About how many of a family's interval-excluding findings chance alone would give (m · 0.05 when nothing is real). */
export const expectedByChance = (familySize: number): number => familySize * 0.05;

// ---------------------------------------------------------------- ids

/** What a finding's id is a hash of: never the result. */
export interface MeasurementKey {
  kind: FindingKind;
  subject: Pick<Subject, 'listId' | 'card' | 'package' | 'opponent' | 'change' | 'ending'>;
  method: Method;
  bot: string;
  simVersion: number;
  field: string;
}

/** The subject's identity in one string: list, card, package, opponent, change key, ending. */
export function subjectKey(s: MeasurementKey['subject']): string {
  return [s.listId, s.card?.id ?? '', s.package?.id ?? '', s.opponent?.listId ?? '', s.change?.key ?? '', s.ending ?? ''].join('\u0001');
}

/** The id (16 hex digits), its short form (8) and the question key (the id without bot, simulator version and method). */
export function findingIds(k: MeasurementKey): { id: string; short: string; question: string } {
  const id = hash64(JSON.stringify(['finding', 1, k.kind, subjectKey(k.subject), k.method, k.bot, k.simVersion, k.field]));
  const question = hash64(JSON.stringify(['question', 1, k.kind, subjectKey(k.subject), k.field]));
  return { id, short: id.slice(0, 8), question };
}

/** Problems with a set of findings' ids: a repeated id, or two ids with the same short id. */
export function idProblems(fs: readonly Pick<Finding, 'id' | 'short'>[]): string[] {
  const out: string[] = [];
  const ids = new Map<string, number>();
  const shorts = new Map<string, string>();
  for (const f of fs) {
    ids.set(f.id, (ids.get(f.id) ?? 0) + 1);
    const other = shorts.get(f.short);
    if (other !== undefined && other !== f.id) out.push(`short id ${f.short} is shared by ${other} and ${f.id}`);
    else shorts.set(f.short, f.id);
    if (f.short !== f.id.slice(0, 8)) out.push(`short id ${f.short} is not the start of ${f.id}`);
  }
  for (const [id, n] of ids) if (n > 1) out.push(`id ${id} is used ${n} times`);
  return out;
}

// ---------------------------------------------------------------- numbers and the cite line

/** Whether a kind's estimate is a rate (shown as a percentage) or a difference (shown in points). */
export const unitOf = (kind: FindingKind): 'rate' | 'points' => (kind === 'deck-strength' || kind === 'matchup' || kind === 'ending' ? 'rate' : 'points');

/** A number as a page shows it: "63.0%" for a rate, "+1.2 pts" for a difference (with − for minus). */
export function formatValue(x: number, unit: 'rate' | 'points', o: { bare?: boolean } = {}): string {
  if (unit === 'rate') return `${(x * 100).toFixed(1)}%`;
  const s = `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;
  return o.bare ? s : `${s} pts`;
}

const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** The bots as people name them (the canonical ledger names and the older worker names). */
export const BOT_NAMES: Readonly<Record<string, string>> = { easy: 'Easy', fast: 'Easy', medium: 'Medium', lookahead: 'Medium', best: 'Medium', hard: 'Hard', deep: 'Deep', mixed: 'Mixed', plain: 'Plain', random: 'Random' };
export const botName = (bot: string): string => BOT_NAMES[bot] ?? bot;

/**
 * The cite line: "[F:<short id>] <claim> (<estimate> [<lo>, <hi>], <games> games, <bot> v<sim>)", e.g.
 * "[F:9f3a2c1d] −1 We Gotta Live Together → +1 Yorinobu Arasaka: Steel Dragon adds to S2-05 Counter (RRG) (+1.2 pts
 * [−0.1, +2.5], 6,112 games, Medium v8)". The claim comes from src/lib/findingWords.ts (citeOf joins the two).
 */
export function citeLine(f: Pick<Finding, 'short' | 'kind' | 'estimate' | 'lower' | 'upper' | 'games' | 'bot' | 'simVersion'> & { method?: Method }, claim: string): string {
  const u = unitOf(f.kind);
  const v = (x: number) => (u === 'rate' ? formatValue(x, u) : formatValue(x, u, { bare: true }));
  const est = formatValue(f.estimate, u);
  // a ratings-based matchup rests on the ratings: its games are the direct ones, and the line says so
  const games = f.kind === 'matchup' && f.method === 'shrunk' ? `from the ratings, ${thousands(f.games)} direct game${f.games === 1 ? '' : 's'}` : `${thousands(f.games)} games`;
  return `[F:${f.short}] ${claim} (${est} [${v(f.lower)}, ${v(f.upper)}], ${games}, ${botName(f.bot)} v${f.simVersion})`;
}

// ---------------------------------------------------------------- the files (public/data/evidence/)

/** A change from the ledger still undecided and not dropped: how many held-out games it has and about how many more would settle it. */
export interface OpenQuestion {
  /** the change finding's id (absent when the change has screening games only) */
  finding?: string;
  change: ChangeSubject;
  simVersion: number;
  bot: string;
  field: string;
  /** held-out and screening games in the ledger */
  heldout: number;
  screen: number;
  /** pooled gain over screening and held-out games (each game once), and its standard error */
  pooled: { games: number; mean: number; se: number };
  /** held-out games in all that would settle it at its present mean and spread (null: its held-out mean is not above the bar, or it has none) */
  toSettle: number | null;
  /** of those, still to play */
  more: number | null;
  runs: number;
}

/** One candidate a recorded run tried. */
export interface TrialRecord {
  label: string;
  kind: 'card' | 'package' | 'combo';
  /** the change key when the label could be read as one (cards by id) */
  key?: string;
  /** screening figure (a fraction): always optimistic for the winner; the interval is plain 95% when recorded */
  screen: { games: number | null; mean: number; lower: number | null; upper: number | null } | null;
  /** held-out figure with the tool's interval (null: recorded without one, or not confirmed) */
  heldOut: { games: number; mean: number; lower: number | null; upper: number | null; z: number | null; looks: number | null } | null;
  /** a forge report's: 'adopted', 'rejected', 'could not tell' or 'not nominated'; a ledger run's: 'nominated' (held-out games) or 'screened' */
  outcome: string;
  /** the change's pooled figure from the ledger across all runs, when it has one */
  pooled?: { games: number; mean: number; se: number };
}

/** A recorded run for a deck: a forge report, or a run the ledger holds games of. */
export interface RunRecord {
  id: string;
  tool: string;
  date: string;
  bot: string;
  simVersion: number;
  /** the adoption rule in words (describeRule), null when the run recorded none */
  rule: string | null;
  games: number | null;
  /** what the run could detect at its stage sizes (detect() in src/lib/deckSearch.ts): gains (fractions) adopted 8 times in 10 */
  detect: { card: number | null; package: number | null; firstStage: number; nominees: number; sdCard: number; sdPackage: number } | null;
  source: Source;
  stale: boolean;
  trials: TrialRecord[];
}

/** A structured note on what is not measured and what would measure it (words in src/lib/findingWords.ts GAP_WORDS). */
export interface GapNote {
  code: string;
  /** numbers the words fill in */
  n?: number;
}

/** One deck's evidence file: public/data/evidence/<listId>.json. */
export interface DeckEvidence {
  kind: typeof EVIDENCE_KIND;
  schema: 1;
  simVersion: number;
  listId: string;
  deck: string;
  file: string;
  findings: Finding[];
  open: OpenQuestion[];
  gaps: GapNote[];
}

/** One deck's recorded runs: public/data/evidence/<listId>.runs.json (written only when the deck has runs). */
export interface DeckRuns {
  kind: typeof EVIDENCE_RUNS_KIND;
  schema: 1;
  simVersion: number;
  listId: string;
  deck: string;
  file: string;
  runs: RunRecord[];
}

/**
 * public/data/evidence/ids.json: each deck's short ids, concatenated (8 hex digits each, in the deck file's order), so a
 * page can open a finding from its cite id alone (`shortIdDeck`).
 */
export interface EvidenceIds {
  kind: typeof EVIDENCE_IDS_KIND;
  schema: 1;
  decks: Record<string, string>;
}

/** The deck (list id) whose file holds the finding with this short id ("9f3a2c1d" or "F:9f3a2c1d"), or null. */
export function shortIdDeck(ids: Pick<EvidenceIds, 'decks'>, short: string): string | null {
  const s = short.replace(/^\[?F:/i, '').replace(/\]$/, '').toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(s)) return null;
  for (const [listId, all] of Object.entries(ids.decks)) for (let i = 0; i + 8 <= all.length; i += 8) if (all.slice(i, i + 8) === s) return listId;
  return null;
}

/** A finding as the overview lists it. */
export type FindingRef = Pick<Finding, 'id' | 'short' | 'question' | 'kind' | 'nature' | 'claim' | 'estimate' | 'lower' | 'upper' | 'level' | 'sequential' | 'baseline' | 'games' | 'method' | 'corrected' | 'strength' | 'bot' | 'simVersion' | 'flags'> & {
  listId: string;
  deck: string;
  /** a matchup's direct record, for its sentence */
  detail?: Pick<FindingDetail, 'raw'>;
  /** passed Benjamini–Hochberg over the list's whole candidate pool */
  poolCorrected: boolean;
  /** other current measurements of the same question (the effects list names a question once, by its best-supported measurement) */
  others: number;
};

export interface TopList {
  key: 'effects' | 'results' | 'patterns';
  /** the whole candidate pool counts as the family */
  family: { size: number; correction: 'bh' };
  items: FindingRef[];
}

/** One tool's record of nominees and how they held. */
export interface ToolHealth {
  tool: string;
  /** nominees confirmed; adopted, rejected and could-not-tell by the tool's own verdict (null: the record does not say) */
  nominees: number;
  adopted: number | null;
  rejected: number | null;
  couldNotTell: number | null;
  /** mean screening figure minus held-out figure over nominees with both (points as a fraction), and how many */
  screenMinusHeldOut: { mean: number; n: number } | null;
  /** mean held-out figure at adoption minus a later re-measurement of the same change, and how many */
  adoptedMinusLater: { mean: number; n: number } | null;
  /** ledger: of the runs after the first on a list, the share that nominated a change an earlier run had tested */
  repeatNominated: { share: number; runs: number } | null;
}

/** The matchup interval's pair spread and its leave-one-event-out check (docs/EVIDENCE.md "The matchup interval"). */
export interface MatchupRules {
  /** the pair spread: SD of a pairing's true win rate around the ratings' prediction, and whether it was measured here */
  spreadSd: number;
  spreadMeasured: boolean;
  /** the pairings and games it was measured on (0 when the default is used), and the fit's χ² with its degrees of freedom */
  spreadPairings: number;
  spreadGames: number;
  chi2: number | null;
  df: number | null;
  /** held-out matches and games scored */
  heldOutMatches: number;
  heldOutGames: number;
  /** calibration: the logistic slope of the result on the logit of the per-seat chance, and its standard error */
  slope: number;
  slopeSe: number;
  /** the favoured deck's score and its expected score over the held-out games */
  favouredWins: number;
  favouredExpected: number;
  /** squared distance of the truth from the estimate (mean product of games 1 and 2's residuals) and its standard error */
  squaredDistance: number;
  squaredDistanceSe: number;
  /** the mean variance the interval claims for the held-out pairings, and the same without the pair spread */
  claimedVariance: number;
  claimedWithoutSpread: number;
}

/** public/data/evidence/index.json. */
export interface EvidenceIndex {
  kind: typeof EVIDENCE_INDEX_KIND;
  schema: 1;
  simVersion: number;
  /** `strength` is the deck's deck-strength finding (null when it has no rating), so the overview states it without the deck files */
  decks: { file: string; deck: string; listId: string; path: string; findings: number; strength: FindingRef | null; counts: Record<Strength, number>; stale: number; runs: number; runsPath: string | null }[];
  top: TopList[];
  health: ToolHealth[];
  /** the rules the builder used, with their measured figures */
  rules: {
    strength: { minimum: Record<MethodClass, number>; strong: Record<MethodClass, number>; minEffect: number; noDifferenceHalfWidth: number; bhQ: number };
    length: { shortMax: number; longMin: number; shares: [number, number, number] };
    matchup: MatchupRules;
  };
  gaps: GapNote[];
  /** the input files and the manifests' run ids they carried */
  inputs: { file: string; runId: string | null }[];
  /** an aggregate manifest derived from the input events (aggregateManifest in src/lib/runManifest.ts) */
  manifest: RunManifest;
}
