// Knowledge pack evaluation (docs/RAG_PLAN.md step 1.4, rule M9): the question set's shape, the metrics (recall at 1,
// 5 and 10 and MRR at 10, by type and split), a seeded paired bootstrap for the difference between two configurations
// on the same questions, and answer size in tokens. Pure: scripts/kb-eval.ts reads the files and prints the tables.
// A question is found at k when any record it expects is among the first k results (each expected record answers it
// on its own); an expectation ending in `*` accepts any passage of one doc section (`doc:<path>#<slug>` or `…~N`).
// Questions of type `none` (step 1.6) have no answer in the pack: they are scored by refusal (the search says "no
// match") and left out of recall and MRR; an answerable question the search refuses counts as wrongly refused.
import { renderSearchText } from './render';
import { search, type KbIndex, type Ranker, type SearchTuning } from './search';
import { estimateTokens, KB_KINDS, KIND_PREFIX, type KbKind } from './types';

export const QUESTION_TYPES = ['entity', 'paraphrase', 'cross', 'number', 'dev', 'rules', 'none'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
/** The types that have an answer in the pack (scored by recall and MRR). */
export const ANSWERABLE_TYPES: readonly QuestionType[] = QUESTION_TYPES.filter((t) => t !== 'none');
export const isAnswerable = (r: { type: QuestionType | string }): boolean => r.type !== 'none';
export const QUESTION_SCOPES = ['public', 'local'] as const;
export const QUESTION_SPLITS = ['dev', 'test'] as const;
export type QuestionSplit = (typeof QUESTION_SPLITS)[number];

export interface KbQuestion {
  /** q001, q002, … */
  id: string;
  /** the question as a person would type it */
  q: string;
  type: QuestionType;
  /** `local` when only a record from data/raw answers it */
  scope: 'public' | 'local';
  split: QuestionSplit;
  /** every record that answers it on its own; `…*` = any passage of one doc section; empty for type `none` */
  expect: string[];
}

export interface KbQuestionFile {
  kind: 'nct-kb-questions';
  schema: 1;
  status: 'draft' | 'owner';
  notes?: string[];
  questions: KbQuestion[];
}

/** Kinds whose records come only from data/raw: absent from a public pack, so never "stale" there. */
export const LOCAL_KINDS: readonly KbKind[] = ['faq', 'rule', 'trule', 'errata'];

/** Problems with the file's shape (empty when it is well formed). */
export function questionFileProblems(f: unknown): string[] {
  const out: string[] = [];
  const o = f as Partial<KbQuestionFile> | null;
  if (!o || typeof o !== 'object') return ['not an object'];
  if (o.kind !== 'nct-kb-questions') out.push(`kind is ${JSON.stringify(o.kind)}, not "nct-kb-questions"`);
  if (o.schema !== 1) out.push(`schema is ${JSON.stringify(o.schema)}, not 1`);
  if (o.status !== 'draft' && o.status !== 'owner') out.push(`status is ${JSON.stringify(o.status)}`);
  if (!Array.isArray(o.questions)) return [...out, 'questions is not a list'];
  const seen = new Set<string>();
  for (const [i, q] of o.questions.entries()) {
    const at = `question ${i + 1}${q && typeof q.id === 'string' ? ` (${q.id})` : ''}`;
    if (!q || typeof q !== 'object') {
      out.push(`${at}: not an object`);
      continue;
    }
    if (typeof q.id !== 'string' || !/^q\d{3,}$/.test(q.id)) out.push(`${at}: id must look like q001`);
    else if (seen.has(q.id)) out.push(`${at}: duplicate id`);
    else seen.add(q.id);
    if (typeof q.q !== 'string' || !q.q.trim()) out.push(`${at}: empty question`);
    if (!(QUESTION_TYPES as readonly string[]).includes(q.type)) out.push(`${at}: unknown type ${JSON.stringify(q.type)}`);
    if (!(QUESTION_SCOPES as readonly string[]).includes(q.scope)) out.push(`${at}: unknown scope ${JSON.stringify(q.scope)}`);
    if (!(QUESTION_SPLITS as readonly string[]).includes(q.split)) out.push(`${at}: unknown split ${JSON.stringify(q.split)}`);
    if (q.type === 'none') {
      if (q.scope !== 'public') out.push(`${at}: a none question is public (it is asked of every pack)`);
      if (!Array.isArray(q.expect) || q.expect.length) out.push(`${at}: a none question expects nothing (expect: [])`);
    } else if (!Array.isArray(q.expect) || !q.expect.length || q.expect.some((e) => typeof e !== 'string' || !e)) out.push(`${at}: expect must be a non-empty list of ids`);
    else {
      for (const e of q.expect) if (!expectKind(e)) out.push(`${at}: "${e}" is not a record id`);
      if (new Set(q.expect).size !== q.expect.length) out.push(`${at}: an id is expected twice`);
    }
  }
  return out;
}

/** The kind an expected id names (undefined when the prefix is no kind's). */
export function expectKind(e: string): KbKind | undefined {
  const p = e.slice(0, e.indexOf(':'));
  return KB_KINDS.find((k) => KIND_PREFIX[k] === p);
}

/** Whether a result id meets one expectation (`doc:x#y*` accepts `doc:x#y` and `doc:x#y~N`). */
export function meets(id: string, e: string): boolean {
  if (!e.endsWith('*')) return id === e;
  const base = e.slice(0, -1);
  return id === base || (id.startsWith(`${base}~`) && /^\d+$/.test(id.slice(base.length + 1)));
}

/** The 1-based rank of the first expected record in a ranked list, or null when none is in it. */
export function firstRank(ranked: readonly string[], expect: readonly string[]): number | null {
  const i = ranked.findIndex((id) => expect.some((e) => meets(id, e)));
  return i < 0 ? null : i + 1;
}

/** How deep a ranking is read: recall at 10 and MRR at 10. */
export const EVAL_DEPTH = 10;

export interface Metrics {
  n: number;
  r1: number;
  r5: number;
  r10: number;
  mrr: number;
}

export const hitAt = (rank: number | null, k: number): number => (rank !== null && rank <= k ? 1 : 0);
export const reciprocal = (rank: number | null): number => (rank !== null && rank <= EVAL_DEPTH ? 1 / rank : 0);

const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function metrics(ranks: readonly (number | null)[]): Metrics {
  return {
    n: ranks.length,
    r1: mean(ranks.map((r) => hitAt(r, 1))),
    r5: mean(ranks.map((r) => hitAt(r, 5))),
    r10: mean(ranks.map((r) => hitAt(r, 10))),
    mrr: mean(ranks.map(reciprocal)),
  };
}

/** A small seeded generator (mulberry32): uniform in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BOOTSTRAP_RESAMPLES = 2000;

export interface PairedInterval {
  /** questions paired */
  n: number;
  /** mean of b − a */
  diff: number;
  /** 95% percentile interval of the resampled mean difference */
  lo: number;
  hi: number;
}

/**
 * Paired bootstrap: resample questions with replacement and take the mean of b − a each time. `a` and `b` are one
 * value per question (a hit at 5, a reciprocal rank), in the same question order.
 */
export function pairedBootstrap(a: readonly number[], b: readonly number[], o: { seed?: number; resamples?: number } = {}): PairedInterval {
  if (a.length !== b.length) throw new Error(`paired bootstrap needs equal lengths, got ${a.length} and ${b.length}`);
  const n = a.length;
  const d = a.map((x, i) => b[i]! - x);
  if (!n) return { n, diff: 0, lo: 0, hi: 0 };
  const rand = seededRandom(o.seed ?? 1);
  const reps = o.resamples ?? BOOTSTRAP_RESAMPLES;
  const means: number[] = [];
  for (let r = 0; r < reps; r++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += d[Math.floor(rand() * n)]!;
    means.push(s / n);
  }
  means.sort((x, y) => x - y);
  return { n, diff: mean(d), lo: quantile(means, 0.025), hi: quantile(means, 0.975) };
}

/** The q-quantile of sorted values by the nearest-rank rule (0 for an empty list). */
export function quantile(sorted: readonly number[], q: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[i]!;
}

export interface SizeStats {
  mean: number;
  p90: number;
}

/** Mean and 90th percentile (nearest rank) of answer sizes in tokens. */
export function sizeStats(tokens: readonly number[]): SizeStats {
  return { mean: mean(tokens), p90: quantile([...tokens].sort((x, y) => x - y), 0.9) };
}

/** The ranker subsets the evaluation compares; the last is the default search. */
export const EVAL_CONFIGS = {
  exact: ['exact'],
  keyword: ['keyword'],
  'exact+keyword': ['exact', 'keyword'],
  'exact+linked+keyword': ['exact', 'linked', 'keyword'],
} as const satisfies Record<string, readonly Ranker[]>;
export type EvalConfig = keyof typeof EVAL_CONFIGS;
export const EVAL_CONFIG_NAMES = Object.keys(EVAL_CONFIGS) as EvalConfig[];

/** The answer size is measured on a default-sized answer. */
export const ANSWER_K = 5;

export interface QuestionResult {
  id: string;
  type: QuestionType;
  split: QuestionSplit;
  /** rank of the first expected record in the first EVAL_DEPTH results, or null */
  rank: number | null;
  /** the first EVAL_DEPTH result ids */
  top: string[];
  /** tokens of the plain-text answer at ANSWER_K results */
  tokens: number;
  /** the search said "no match" (right for a `none` question, wrong for any other) */
  refused: boolean;
}

export interface Availability {
  /** expectations no record meets (and not merely absent because data/raw is) */
  stale: string[];
  /** true when no expectation can be met in this pack: the question is skipped */
  skip: boolean;
}

/**
 * Which expectations can be met in an index. An id of a local kind is unavailable, not stale, when the pack holds no
 * local records; a local question is skipped then.
 */
export function availability(q: KbQuestion, has: (id: string) => boolean, hasPrefix: (base: string) => boolean, localPresent: boolean): Availability {
  // a none question expects nothing and is asked of every pack
  if (q.type === 'none') return { stale: [], skip: false };
  const stale: string[] = [];
  let usable = 0;
  for (const e of q.expect) {
    const found = e.endsWith('*') ? hasPrefix(e.slice(0, -1)) : has(e);
    if (found) usable++;
    else if (localPresent || !LOCAL_KINDS.includes(expectKind(e)!)) stale.push(e);
  }
  return { stale, skip: (q.scope === 'local' && !localPresent) || usable === 0 };
}

/** Run one configuration over questions (callers filter by split and scope first). `tuning`: experiments only. */
export function runQuestions(ix: KbIndex, questions: readonly KbQuestion[], config: EvalConfig, tuning?: Partial<SearchTuning>): QuestionResult[] {
  const rankers = EVAL_CONFIGS[config];
  return questions.map((q) => {
    const deep = search(ix, q.q, { k: EVAL_DEPTH, rankers, ...(tuning ? { tuning } : {}) });
    const top = deep.hits.map((h) => h.record.id);
    const answer = deep.noMatch ? deep : { ...deep, hits: deep.hits.slice(0, ANSWER_K) };
    return { id: q.id, type: q.type, split: q.split, rank: firstRank(top, q.expect), top, tokens: estimateTokens(renderSearchText(answer)), refused: deep.noMatch };
  });
}

/** The settings `scripts/kb-eval.ts --tune` may vary, and how each value is read. */
const TUNE_KEYS: Readonly<Record<keyof SearchTuning, 'share' | 'count' | 'bool'>> = { floor: 'share', floorHits: 'count', singleWordTermLinks: 'bool', deckPairMatchup: 'bool' };

/**
 * Parse `key=value,key=value` into search settings (floor: a share from 0 to 1; floorHits: a whole number from 1 to 100;
 * singleWordTermLinks, deckPairMatchup: true or false). Returns the problem as a string when the text is not valid.
 */
export function parseTuning(text: string): Partial<SearchTuning> | string {
  const out: Partial<Record<keyof SearchTuning, number | boolean>> = {};
  for (const part of text.split(',').map((x) => x.trim())) {
    const m = /^([A-Za-z]+)=(.+)$/.exec(part);
    const key = m?.[1] as keyof SearchTuning | undefined;
    const raw = m?.[2]?.trim() ?? '';
    if (!key || !Object.prototype.hasOwnProperty.call(TUNE_KEYS, key)) return `give key=value pairs with keys ${Object.keys(TUNE_KEYS).join(', ')}, not "${part}"`;
    if (key in out) return `${key} is given twice`;
    const how = TUNE_KEYS[key];
    if (how === 'bool') {
      if (raw !== 'true' && raw !== 'false') return `${key} takes true or false, not "${raw}"`;
      out[key] = raw === 'true';
    } else {
      const v = Number(raw);
      if (!/^\d+(\.\d+)?$/.test(raw) || (how === 'share' ? v > 1 : !Number.isInteger(v) || v < 1 || v > 100)) return how === 'share' ? `${key} takes a share from 0 to 1, not "${raw}"` : `${key} takes a whole number from 1 to 100, not "${raw}"`;
      out[key] = v;
    }
  }
  return out as Partial<SearchTuning>;
}

/** Refusals among some questions: how many there were, how many the search refused, and the share. */
export interface RefusalCount {
  n: number;
  refused: number;
  rate: number;
}

export const refusals = (rs: readonly Pick<QuestionResult, 'refused'>[]): RefusalCount => {
  const refused = rs.filter((r) => r.refused).length;
  return { n: rs.length, refused, rate: rs.length ? refused / rs.length : 0 };
};

/**
 * Recall, MRR and answer size over the answerable questions (`n` counts those only), the refusal of the `none`
 * questions (right) and the refusal of the answerable ones (wrong).
 */
export interface Summary extends Metrics {
  tokens: SizeStats;
  /** `none` questions: refused is right */
  refusal: RefusalCount;
  /** answerable questions refused (wrong) */
  wrongRefusals: RefusalCount;
}

export function summarize(rs: readonly QuestionResult[]): Summary {
  const ans = rs.filter(isAnswerable);
  return { ...metrics(ans.map((r) => r.rank)), tokens: sizeStats(ans.map((r) => r.tokens)), refusal: refusals(rs.filter((r) => !isAnswerable(r))), wrongRefusals: refusals(ans) };
}

/** Summaries grouped by a key, keys in the order given. Groups with no question are left out. */
export function groupBy<K extends string>(rs: readonly QuestionResult[], key: (r: QuestionResult) => K, order: readonly K[]): { key: K; summary: Summary }[] {
  return order.map((k) => ({ key: k, rs: rs.filter((r) => key(r) === k) })).filter((g) => g.rs.length).map((g) => ({ key: g.key, summary: summarize(g.rs) }));
}

export type PairedMetric = 'r5' | 'mrr';

/** Per-question values of a metric, for the paired bootstrap. */
export const metricValues = (rs: readonly Pick<QuestionResult, 'rank'>[], m: PairedMetric): number[] => rs.map((r) => (m === 'r5' ? hitAt(r.rank, 5) : reciprocal(r.rank)));

/** Pair two runs on the answerable questions both hold, in id order, and bootstrap b − a for a metric. */
export function compareRuns(a: readonly Pick<QuestionResult, 'id' | 'type' | 'rank'>[], b: readonly Pick<QuestionResult, 'id' | 'type' | 'rank'>[], m: PairedMetric, o: { seed?: number; resamples?: number } = {}): PairedInterval {
  const bById = new Map(b.filter(isAnswerable).map((r) => [r.id, r]));
  const pairs = a.filter((r) => isAnswerable(r) && bById.has(r.id)).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return pairedBootstrap(metricValues(pairs, m), metricValues(pairs.map((r) => bById.get(r.id)!), m), o);
}
