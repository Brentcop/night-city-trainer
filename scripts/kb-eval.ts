// Knowledge pack evaluation (docs/RAG_PLAN.md step 1.4, rule M9): runs ranker configurations over the question set
// (data/kb/questions.json) and prints recall at 1, 5 and 10, MRR at 10 and the answer size in tokens (characters / 4,
// at 5 results), by configuration, split and question type, over the answerable questions; beside them the refusal
// rate of the questions the pack cannot answer (type none: "no match" is right) and the answerable questions wrongly
// refused (step 1.6).
//   npm run kb:eval                          every configuration, both scopes, every split
//   npm run kb:eval -- --split dev --config exact+keyword,exact+linked+keyword --compare exact+keyword,exact+linked+keyword
//   npm run kb:eval -- --out                 also write reports/kb-eval-latest.md and .json (only when they change)
//   npm run kb:eval -- --dense               also the three configurations with the dense ranker (step 4.1)
// Flags:
//   --config a,b       configurations to run: exact, keyword, exact+keyword, exact+linked+keyword (the default search;
//                      default these four), and with --dense also dense, keyword+dense, exact+linked+keyword+dense
//   --dense            add the dense configurations (default all three). Needs the embedding tools and model in
//                      .cache/kb-dense/ (scripts/kb-dense.ts; exit 1 saying what is missing otherwise); the vectors are
//                      refreshed first and each question is embedded once. Dense results go to stdout, and with --out
//                      to .cache/kb-dense/kb-eval-dense.md and .json; the tracked reports hold the lexical
//                      configurations only, so they are the same on every machine.
//   --split S          dev | test | all (default all). Tune on dev, report on test.
//   --scope S          public | all (default both, one after the other). `all` searches the whole local pack;
//                      `public` searches the public records only, as a checkout without data/raw does, and skips the
//                      questions only a data/raw record answers (counted as skipped).
//   --compare a,b      paired bootstrap of b minus a (recall at 5 and MRR at 10) on the same questions
//   --against FILE     paired bootstrap of this run minus an earlier JSON report (from --json or --out), for each
//                      configuration and scope both hold: how a ranking change is judged
//   --seed N           bootstrap seed (default 1; 2,000 resamples, 95% percentile interval)
//   --tune k=v,…       experiments only: run the search with other settings than SEARCH_TUNING (src/lib/kb/search.ts):
//                      floor=0.4 (the "no match" share), floorHits=3 (the floor is met by any of the first N keyword
//                      hits), singleWordTermLinks=false, deckPairMatchup=true, denseWeight=2 (the dense list's fusion
//                      weight), denseFloor=0.75 (the best dense similarity that still answers without an exact or keyword
//                      hit over the floor). The report records the setting.
//   --questions FILE   the question set (default data/kb/questions.json)
//   --json             JSON on stdout instead of tables
//   --strict           exit 1 when an expected id is not in the pack (stale expectations are always listed)
// Reports carry ids and public titles only, never record text: a local-only (data/raw) record shows by its id alone,
// so its wording never reaches a tracked file.
// The per-question listing shows dev questions only: test results are read as totals (rule M9).
import fs from 'node:fs';
import path from 'node:path';
import { ArgError, bool, cli, int, oneOf, Refusal, runMain, str, writeIfChanged, type Values } from './lib-node';
import { ensurePack, ROOT } from './kb';
import { alignDense, type DenseIndex } from '../src/lib/kb/dense';
import {
  ANSWERABLE_TYPES,
  availability,
  compareRuns,
  EVAL_CONFIG_NAMES,
  EVAL_DEPTH,
  groupBy,
  isAnswerable,
  needsDense,
  parseTuning,
  QUESTION_SPLITS,
  QUESTION_TYPES,
  questionFileProblems,
  refusals,
  runQuestions,
  summarize,
  type EvalConfig,
  type KbQuestion,
  type KbQuestionFile,
  type PairedInterval,
  type PairedMetric,
  type QuestionResult,
  type QuestionSplit,
  type RefusalCount,
  type Summary,
} from '../src/lib/kb/eval';
import { buildIndex, type KbIndex, type SearchTuning } from '../src/lib/kb/search';
import { byString, type KbRecord } from '../src/lib/kb/types';

const QUESTIONS_FILE = 'data/kb/questions.json';
const REPORT_MD = 'reports/kb-eval-latest.md';
const REPORT_JSON = 'reports/kb-eval-latest.json';
const DEFAULT_CONFIG: EvalConfig = 'exact+linked+keyword';
const WORST = 10;

const configList = (v: string) => {
  const parts = v.split(',').map((x) => x.trim());
  const bad = parts.filter((x) => !(EVAL_CONFIG_NAMES as string[]).includes(x));
  if (!parts.length || parts.some((x) => !x)) return `give a comma-separated list of ${EVAL_CONFIG_NAMES.join(', ')}`;
  return bad.length ? `unknown ${bad.join(', ')} (choose from ${EVAL_CONFIG_NAMES.join(', ')})` : undefined;
};

export const EVAL_SPEC = {
  config: str(undefined, configList),
  split: oneOf(['dev', 'test', 'all'], 'all'),
  scope: oneOf(['public', 'all']),
  compare: str(undefined, (v) => configList(v) ?? (v.split(',').length !== 2 ? 'give exactly two configurations, a,b' : undefined)),
  against: str(),
  seed: int(1, { min: 0, max: 2 ** 31 - 1 }),
  tune: str(undefined, (v) => {
    const t = parseTuning(v);
    return typeof t === 'string' ? t : undefined;
  }),
  questions: str(QUESTIONS_FILE),
  json: bool(),
  out: bool(),
  strict: bool(),
  dense: bool(),
};

/** The configurations without the dense ranker: the default list, and the only ones in the tracked reports. */
export const LEXICAL_CONFIGS: readonly EvalConfig[] = EVAL_CONFIG_NAMES.filter((c) => !needsDense(c));
const DENSE_REPORT = 'kb-eval-dense';

type ScopeName = 'all' | 'public';
const SCOPE_TITLE: Record<ScopeName, string> = {
  all: 'all records (the local pack, with data/raw when present)',
  public: 'public records only (what a checkout without data/raw searches)',
};

interface ConfigRun {
  config: EvalConfig;
  results: QuestionResult[];
}

interface ScopeRun {
  scope: ScopeName;
  /** whether local (data/raw) records were searched */
  localPresent: boolean;
  records: number;
  skipped: string[];
  /** question id → expectations no record meets */
  stale: Record<string, string[]>;
  runs: ConfigRun[];
}

interface Comparison {
  scope: ScopeName;
  a: string;
  b: string;
  /** answerable questions both runs hold */
  r5: PairedInterval;
  mrr: PairedInterval;
  /** refusals of the none questions both runs hold, and of the answerable ones (null: a run did not record them) */
  refusal: { a: RefusalCount; b: RefusalCount } | null;
  wrongRefusals: { a: RefusalCount; b: RefusalCount } | null;
}

type Scored = Pick<QuestionResult, 'id' | 'type' | 'rank'> & { refused?: boolean };

/** The refusal counts of two runs over the questions both hold (null when one of them did not record refusals). */
function pairedRefusals(a: readonly Scored[], b: readonly Scored[], none: boolean): { a: RefusalCount; b: RefusalCount } | null {
  const bById = new Map(b.map((r) => [r.id, r]));
  const both = a.filter((r) => bById.has(r.id) && isAnswerable(r) !== none);
  if (both.some((r) => r.refused === undefined || bById.get(r.id)!.refused === undefined)) return null;
  return { a: refusals(both.map((r) => ({ refused: r.refused! }))), b: refusals(both.map((r) => ({ refused: bById.get(r.id)!.refused! }))) };
}

function comparison(scope: ScopeName, a: string, b: string, ra: readonly Scored[], rb: readonly Scored[], seed: number): Comparison {
  const one = (m: PairedMetric) => compareRuns(ra, rb, m, { seed });
  return { scope, a, b, r5: one('r5'), mrr: one('mrr'), refusal: pairedRefusals(ra, rb, true), wrongRefusals: pairedRefusals(ra, rb, false) };
}

export function readQuestions(file: string): KbQuestionFile {
  const abs = path.resolve(ROOT, file);
  if (!fs.existsSync(abs)) throw new Refusal(`no question file at ${file}`);
  const parsed = JSON.parse(fs.readFileSync(abs, 'utf8')) as unknown;
  const problems = questionFileProblems(parsed);
  if (problems.length) throw new Refusal(`${file} is not a valid question set:\n  ${problems.join('\n  ')}`);
  return parsed as KbQuestionFile;
}

/** The dense run (--dense): which model made the vectors. Never in the tracked reports. */
export interface DenseNote {
  model: string;
}

/** Evaluate configurations over one scope's index. `dense`: the whole pack's vectors and one vector per question id. */
export function evaluateScope(scope: ScopeName, records: readonly KbRecord[], questions: readonly KbQuestion[], configs: readonly EvalConfig[], tuning?: Partial<SearchTuning>, dense?: { index: DenseIndex; queries: ReadonlyMap<string, Float32Array> }): ScopeRun {
  const recs = scope === 'public' ? records.filter((r) => r.scope === 'public') : records;
  const ix: KbIndex = buildIndex(recs);
  const localPresent = recs.some((r) => r.scope === 'local');
  const ids = ix.records.map((r) => r.id);
  const hasPrefix = (base: string) => ids.some((id) => id === base || id.startsWith(`${base}~`));
  const skipped: string[] = [];
  const stale: Record<string, string[]> = {};
  const scored: KbQuestion[] = [];
  for (const q of questions) {
    const a = availability(q, (id) => ix.byId.has(id), hasPrefix, localPresent);
    if (a.stale.length) stale[q.id] = a.stale;
    if (a.skip) skipped.push(q.id);
    else scored.push(q);
  }
  const run = dense ? { index: alignDense(dense.index, ix.records.map((r) => r.id)).index, queries: dense.queries } : undefined;
  return { scope, localPresent, records: recs.length, skipped, stale, runs: configs.map((config) => ({ config, results: runQuestions(ix, scored, config, tuning, needsDense(config) ? run : undefined) })) };
}

const pct = (x: number) => (100 * x).toFixed(1);
const num = (x: number) => x.toFixed(3);
const signed = (x: number, f: (v: number) => string) => (x > 0 ? '+' : x < 0 ? '−' : '±') + f(Math.abs(x));

function splitRows(rs: readonly QuestionResult[], splits: readonly (QuestionSplit | 'all')[]): { split: string; s: Summary }[] {
  return splits.map((sp) => ({ split: sp, rs: sp === 'all' ? rs : rs.filter((r) => r.split === sp) })).filter((g) => g.rs.length).map((g) => ({ split: g.split, s: summarize(g.rs) }));
}

const splitsOf = (split: string): (QuestionSplit | 'all')[] => (split === 'all' ? ['dev', 'test', 'all'] : [split as QuestionSplit]);

/** Columns aligned right in the markdown tables. */
const NUMERIC_HEADS = new Set(['n', 'rank', 'R@1 %', 'R@5 %', 'R@10 %', 'MRR@10', 'tokens mean', 'tokens p90', 'R@5 diff (pp)', 'MRR diff', 'none refused', 'wrongly refused', 'refused']);

/** "7 of 12 (58.3%)", or "–" when there is no such question. */
const ofCell = (c: RefusalCount) => (c.n ? `${c.refused} of ${c.n} (${pct(c.rate)}%)` : '–');

function table(head: string[], rows: string[][]): string[] {
  return [`| ${head.join(' | ')} |`, `|${head.map((h) => (NUMERIC_HEADS.has(h) ? '---:' : '---')).join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)];
}

const metricCells = (s: Summary) => [String(s.n), pct(s.r1), pct(s.r5), pct(s.r10), num(s.mrr)];

/** The markdown report (also the plain-text output: markdown tables read fine in a terminal). */
export function renderMarkdown(o: { file: KbQuestionFile; questionsFile: string; split: string; seed: number; scopes: ScopeRun[]; titles: Map<string, string>; questions: Map<string, KbQuestion>; comparisons: Comparison[]; against?: string; tuning?: Partial<SearchTuning>; dense?: DenseNote }): string {
  const qs = o.file.questions;
  const count = (pick: (q: KbQuestion) => string, keys: readonly string[]) => keys.map((k) => `${k} ${qs.filter((q) => pick(q) === k).length}`).join(', ');
  const L: string[] = [
    '# Knowledge pack evaluation',
    '',
    'Written by `npm run kb:eval -- --out` (scripts/kb-eval.ts, docs/RAG_PLAN.md step 1.4). Ids and public titles only,',
    'never record text (a local-only record shows by its id). Recall at k: the share of questions with an expected',
    'record in the first k results. MRR at 10: the mean of 1 / rank of the first expected record (0 when it is not in',
    'the first 10). Tokens: the plain-text answer at 5 results, characters / 4. These are over the answerable',
    'questions (`n`). None refused: the questions the pack cannot answer (type none) for which the search said "no',
    'match", which is right. Wrongly refused: answerable questions for which it said "no match".',
    '',
    `Question set: \`${o.questionsFile}\` (${o.file.status}), ${qs.length} questions. Types: ${count((q) => q.type, QUESTION_TYPES.filter((t) => qs.some((q) => q.type === t)))}.`,
    `Scopes: ${count((q) => q.scope, ['public', 'local'])}. Splits: ${count((q) => q.split, QUESTION_SPLITS)}. Shown here: split ${o.split}.`,
    ...(o.tuning ? [`Search settings changed for an experiment (--tune): ${Object.entries(o.tuning).map(([k, x]) => `${k}=${String(x)}`).join(', ')}.`] : []),
    ...(o.dense ? [`Dense ranker (--dense, step 4.1): ${o.dense.model}; not part of the tracked reports.`] : []),
    '',
  ];
  for (const sc of o.scopes) {
    L.push(`## Scope: ${SCOPE_TITLE[sc.scope]}`, '');
    L.push(`${sc.records} records searched; local records ${sc.localPresent ? 'present' : 'absent'}. Questions skipped (nothing they expect is in this pack): ${sc.skipped.length}.`);
    const stale = Object.entries(sc.stale).sort(([a], [b]) => byString(a, b));
    L.push(stale.length ? `Stale expectations (not in the pack): ${stale.map(([q, es]) => `${q}: ${es.join(', ')}`).join('; ')}.` : 'Stale expectations: none.', '');
    L.push('### By configuration and split', '');
    L.push(
      ...table(
        ['configuration', 'split', 'n', 'R@1 %', 'R@5 %', 'R@10 %', 'MRR@10', 'tokens mean', 'tokens p90', 'none refused', 'wrongly refused'],
        sc.runs.flatMap((r) => splitRows(r.results, splitsOf(o.split)).map(({ split, s }) => [r.config, split, ...metricCells(s), s.tokens.mean.toFixed(0), String(s.tokens.p90), ofCell(s.refusal), ofCell(s.wrongRefusals)])),
      ),
      '',
    );
    L.push('### By question type', '');
    const typeRows: string[][] = [];
    for (const r of sc.runs)
      for (const sp of splitsOf(o.split))
        for (const g of groupBy(sp === 'all' ? r.results : r.results.filter((x) => x.split === sp), (x) => x.type, ANSWERABLE_TYPES)) typeRows.push([r.config, g.key, sp, ...metricCells(g.summary), String(g.summary.wrongRefusals.refused)]);
    L.push(...table(['configuration', 'type', 'split', 'n', 'R@1 %', 'R@5 %', 'R@10 %', 'MRR@10', 'refused'], typeRows), '');
    const def = sc.runs.find((r) => r.config === DEFAULT_CONFIG) ?? sc.runs[sc.runs.length - 1];
    const dev = def ? def.results.filter((r) => r.split === 'dev') : [];
    const name = (id: string) => (o.titles.has(id) ? `${id} (${o.titles.get(id)!.replace(/\|/g, '/')})` : id);
    if (def && dev.some(isAnswerable)) {
      const worst = dev.filter((r) => isAnswerable(r) && r.rank !== 1).sort((a, b) => (b.rank ?? EVAL_DEPTH + 1) - (a.rank ?? EVAL_DEPTH + 1) || byString(a.id, b.id)).slice(0, WORST);
      L.push(`### Worst dev questions under ${def.config}`, '');
      if (!worst.length) L.push('Every dev question has an expected record first.', '');
      else {
        L.push('Rank "–" means no expected record in the first 10; "refused" means the search said "no match". "Ranked above" lists up to three records before it.', '');
        L.push(
          ...table(
            ['question', 'type', 'rank', 'asked', 'expected (first)', 'ranked above'],
            worst.map((r) => {
              const q = o.questions.get(r.id)!;
              const above = r.top.slice(0, Math.min(3, (r.rank ?? EVAL_DEPTH + 1) - 1));
              return [r.id, r.type, r.refused ? 'refused' : r.rank === null ? '–' : String(r.rank), q.q.replace(/\|/g, '/'), q.expect[0]!, above.map(name).join('; ')];
            }),
          ),
          '',
        );
      }
    }
    const answered = def ? dev.filter((r) => !isAnswerable(r) && !r.refused) : [];
    if (def && dev.some((r) => !isAnswerable(r))) {
      L.push(`### Dev questions the pack cannot answer, answered anyway under ${def.config}`, '');
      if (!answered.length) L.push('Every dev none question was refused.', '');
      else
        L.push(
          ...table(
            ['question', 'asked', 'first results'],
            answered.map((r) => [r.id, o.questions.get(r.id)!.q.replace(/\|/g, '/'), r.top.slice(0, 3).map(name).join('; ')]),
          ),
          '',
        );
    }
  }
  if (o.comparisons.length) {
    L.push(`## Paired comparisons (b minus a, ${o.against ? `this run minus ${o.against}` : 'configurations'}; seed ${o.seed}, 2,000 resamples, 95% interval)`, '');
    L.push('Recall and MRR over the answerable questions both runs hold; refusals counted over the questions both runs hold.', '');
    const pair = (p: { a: RefusalCount; b: RefusalCount } | null) => (p ? `${ofCell(p.a)} → ${ofCell(p.b)}` : 'not recorded');
    L.push(
      ...table(
        ['scope', 'a', 'b', 'n', 'R@5 diff (pp)', 'R@5 95% interval', 'MRR diff', 'MRR 95% interval', 'none refused (a → b)', 'wrongly refused (a → b)'],
        o.comparisons.map((c) => [c.scope, c.a, c.b, String(c.r5.n), signed(c.r5.diff, pct), `${pct(c.r5.lo)} to ${pct(c.r5.hi)}`, signed(c.mrr.diff, num), `${num(c.mrr.lo)} to ${num(c.mrr.hi)}`, pair(c.refusal), pair(c.wrongRefusals)]),
      ),
      '',
    );
  }
  return L.join('\n');
}

const round = (x: number) => Math.round(x * 1e4) / 1e4;
const countJson = (c: RefusalCount) => ({ n: c.n, refused: c.refused, rate: round(c.rate) });
const pairJson = (p: { a: RefusalCount; b: RefusalCount }) => ({ a: countJson(p.a), b: countJson(p.b) });
const summaryJson = (s: Summary) => ({
  n: s.n,
  r1: round(s.r1),
  r5: round(s.r5),
  r10: round(s.r10),
  mrr: round(s.mrr),
  tokensMean: round(s.tokens.mean),
  tokensP90: s.tokens.p90,
  ...(s.refusal.n ? { refusal: countJson(s.refusal) } : {}),
  wrongRefusals: countJson(s.wrongRefusals),
});
const intervalJson = (p: PairedInterval) => ({ n: p.n, diff: round(p.diff), lo: round(p.lo), hi: round(p.hi) });

export function reportJson(o: { file: KbQuestionFile; questionsFile: string; split: string; seed: number; scopes: ScopeRun[]; comparisons: Comparison[]; against?: string; tuning?: Partial<SearchTuning>; dense?: DenseNote }) {
  return {
    kind: 'nct-kb-eval',
    schema: 1,
    questions: o.questionsFile,
    status: o.file.status,
    split: o.split,
    seed: o.seed,
    ...(o.tuning ? { tuning: o.tuning } : {}),
    ...(o.dense ? { dense: o.dense } : {}),
    scopes: o.scopes.map((sc) => ({
      scope: sc.scope,
      localPresent: sc.localPresent,
      records: sc.records,
      skipped: sc.skipped,
      stale: sc.stale,
      configs: sc.runs.map((r) => ({
        config: r.config,
        splits: Object.fromEntries(splitRows(r.results, splitsOf(o.split)).map(({ split, s }) => [split, summaryJson(s)])),
        types: Object.fromEntries(
          splitsOf(o.split).map((sp) => [sp, Object.fromEntries(groupBy(sp === 'all' ? r.results : r.results.filter((x) => x.split === sp), (x) => x.type, ANSWERABLE_TYPES).map((g) => [g.key, summaryJson(g.summary)]))]),
        ),
        results: r.results.map((x) => ({ id: x.id, type: x.type, split: x.split, rank: x.rank, refused: x.refused, tokens: x.tokens })),
      })),
    })),
    ...(o.comparisons.length
      ? {
          comparisons: o.comparisons.map((c) => ({ scope: c.scope, a: c.a, b: c.b, r5: intervalJson(c.r5), mrr: intervalJson(c.mrr), refusal: c.refusal && pairJson(c.refusal), wrongRefusals: c.wrongRefusals && pairJson(c.wrongRefusals) })),
          ...(o.against ? { against: o.against } : {}),
        }
      : {}),
  };
}

type ReportJson = ReturnType<typeof reportJson>;

/** An earlier JSON report, for --against; throws ArgError when it is missing or not one. */
export function readReport(file: string): ReportJson {
  const abs = path.resolve(ROOT, file);
  if (!fs.existsSync(abs)) throw new ArgError(`--against: no file at ${file}`);
  let parsed: ReportJson;
  try {
    parsed = JSON.parse(fs.readFileSync(abs, 'utf8')) as ReportJson;
  } catch {
    throw new ArgError(`--against: ${file} is not JSON`);
  }
  if (parsed?.kind !== 'nct-kb-eval' || !Array.isArray(parsed.scopes)) throw new ArgError(`--against: ${file} is not a kb-eval report`);
  return parsed;
}

function compare(scopes: readonly ScopeRun[], a: string, b: string, seed: number): Comparison[] {
  return scopes.flatMap((sc) => {
    const ra = sc.runs.find((r) => r.config === a);
    const rb = sc.runs.find((r) => r.config === b);
    if (!ra || !rb) return [];
    return [comparison(sc.scope, a, b, ra.results, rb.results, seed)];
  });
}

/** This run minus an earlier report, per scope and configuration both hold, on this run's split. */
function compareAgainst(scopes: readonly ScopeRun[], earlier: ReportJson, file: string, split: string, seed: number): Comparison[] {
  const out: Comparison[] = [];
  for (const sc of scopes) {
    const old = earlier.scopes.find((s) => s.scope === sc.scope);
    if (!old) continue;
    for (const run of sc.runs) {
      const prev = old.configs.find((c) => c.config === run.config);
      if (!prev) continue;
      const inSplit = (r: { split: string }) => split === 'all' || r.split === split;
      // an older report has no refused field: its refusals are "not recorded"
      const before: Scored[] = (prev.results as { id: string; type: string; split: string; rank: number | null; refused?: boolean }[])
        .filter(inSplit)
        .map((r) => ({ id: r.id, type: r.type as QuestionResult['type'], rank: r.rank, ...(typeof r.refused === 'boolean' ? { refused: r.refused } : {}) }));
      out.push(comparison(sc.scope, `${run.config} (${file})`, `${run.config} (now)`, before, run.results.filter(inSplit), seed));
    }
  }
  return out;
}

/** A markdown and a JSON report. */
export interface ReportPair {
  md: string;
  json: string;
}

export interface EvalOutput {
  /** what the run prints (with --dense: the dense configurations too) */
  stdout: string;
  /** what --out writes to reports/: the lexical configurations only, so the same on every machine */
  tracked: ReportPair;
  /** with --dense: the whole report, which --out writes under .cache/kb-dense/ */
  dense?: ReportPair & { dir: string };
  staleCount: number;
}

/**
 * Run the evaluation for parsed flags. Throws ArgError for a dense configuration named without --dense, and Refusal
 * (with what is missing) for --dense when the dense ranker is not ready.
 */
export async function runEval(v: Values<typeof EVAL_SPEC>, earlier?: ReportJson): Promise<EvalOutput> {
  const named = [...(v.config?.split(',') ?? []), ...(v.compare?.split(',') ?? [])].map((x) => x.trim() as EvalConfig);
  const denseNamed = named.filter(needsDense);
  if (denseNamed.length && !v.dense) throw new ArgError(`${[...new Set(denseNamed)].join(', ')} needs --dense`);
  const configs = new Set<EvalConfig>(v.config ? (v.config.split(',').map((x) => x.trim()) as EvalConfig[]) : v.dense ? EVAL_CONFIG_NAMES : LEXICAL_CONFIGS);
  const pair = v.compare?.split(',').map((x) => x.trim()) as [EvalConfig, EvalConfig] | undefined;
  if (pair) for (const c of pair) configs.add(c);
  const configList = EVAL_CONFIG_NAMES.filter((c) => configs.has(c));

  // the dense ranker is loaded only for --dense
  const kd = v.dense ? await import('./kb-dense') : undefined;
  const dp = kd?.densePaths(ROOT);
  if (kd && dp) {
    const st = kd.denseStatus(dp);
    if (!st.ready) throw new Refusal(`--dense: ${kd.missingText(st)}`);
  }
  const file = readQuestions(v.questions);
  const questions = file.questions.filter((q) => v.split === 'all' || q.split === v.split);
  const pack = await ensurePack();
  if (pack.rebuilt) console.error(`kb: pack rebuilt (inputs changed) in ${(pack.buildMs! / 1000).toFixed(1)} s`);
  const scopeNames: ScopeName[] = v.scope ? [v.scope] : ['all', 'public'];
  const tuned = v.tune === undefined ? undefined : parseTuning(v.tune);
  const tuning = typeof tuned === 'object' ? tuned : undefined;
  // the dense configurations: vectors refreshed and every question embedded once
  let dense: { index: DenseIndex; queries: Map<string, Float32Array> } | undefined;
  let denseNote: DenseNote | undefined;
  if (kd && dp && configList.some(needsDense)) {
    const embed = await kd.loadEmbedder(dp);
    const r = await kd.refreshVectors(pack.records, embed, dp.vectors);
    if (r.embedded || r.dropped) console.error(`kb-eval: dense vectors refreshed (${r.embedded} embedded, ${r.dropped} dropped)`);
    const vecs = await kd.embedQueries(embed, questions.map((q) => q.q));
    dense = { index: r.index, queries: new Map(questions.map((q, i) => [q.id, vecs[i]!])) };
    denseNote = { model: `${kd.DENSE_MODEL.id} ${kd.DENSE_MODEL.dtype}` };
  }
  const scopes = scopeNames.map((s) => evaluateScope(s, pack.records, questions, configList, tuning, dense));
  const comparisonsOf = (scs: ScopeRun[]) => [...(pair ? compare(scs, pair[0], pair[1], v.seed) : []), ...(earlier ? compareAgainst(scs, earlier, v.against!, v.split, v.seed) : [])];
  // public titles only: a local title can hold the first words of official text (rule M6)
  const titles = new Map(pack.records.filter((r) => r.scope === 'public').map((r) => [r.id, r.title]));
  const qById = new Map(file.questions.map((q) => [q.id, q]));
  const reports = (scs: ScopeRun[], note?: DenseNote): ReportPair => {
    const common = { file, questionsFile: v.questions, split: v.split, seed: v.seed, scopes: scs, comparisons: comparisonsOf(scs), against: v.against, tuning, dense: note };
    return { md: renderMarkdown({ ...common, titles, questions: qById }) + '\n', json: JSON.stringify(reportJson(common), null, 2) + '\n' };
  };
  const full = reports(scopes, denseNote);
  const tracked = denseNote ? reports(scopes.map((sc) => ({ ...sc, runs: sc.runs.filter((r) => !needsDense(r.config)) }))) : full;
  return {
    stdout: v.json ? full.json : full.md,
    tracked,
    ...(denseNote && dp ? { dense: { ...full, dir: dp.dir } } : {}),
    staleCount: scopes.reduce((a, s) => a + Object.keys(s.stale).length, 0),
  };
}

async function main() {
  const { values: v } = cli(import.meta.url, EVAL_SPEC);
  let earlier: ReportJson | undefined;
  let out: EvalOutput;
  try {
    if (v.against) earlier = readReport(v.against);
    out = await runEval(v, earlier);
  } catch (e) {
    if (!(e instanceof ArgError)) throw e;
    console.error(`error: ${e.message}\nRun with --help for usage.`);
    process.exit(2);
  }
  process.stdout.write(out.stdout);
  if (v.out) {
    const write = (file: string, text: string) => writeIfChanged(file, text) && path.relative(ROOT, file).split(path.sep).join('/');
    const wrote = [write(path.join(ROOT, REPORT_MD), out.tracked.md), write(path.join(ROOT, REPORT_JSON), out.tracked.json)];
    if (out.dense) wrote.push(write(path.join(out.dense.dir, `${DENSE_REPORT}.md`), out.dense.md), write(path.join(out.dense.dir, `${DENSE_REPORT}.json`), out.dense.json));
    const list = wrote.filter(Boolean);
    console.error(list.length ? `kb-eval: wrote ${list.join(', ')}` : 'kb-eval: reports unchanged');
  }
  if (out.staleCount) console.error(`kb-eval: ${out.staleCount} question(s) expect records that are not in the pack (listed under "Stale expectations")`);
  if (v.strict && out.staleCount) process.exitCode = 1;
}

if (/[\\/]kb-eval\.ts$/.test(process.argv[1] ?? '')) runMain(main);
