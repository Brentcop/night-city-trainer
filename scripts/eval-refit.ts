// The refit of the bots' evaluation (REVIEW_2026-11-24 B7, C.3; the fit is src/analysis/evalRefit.ts). Plays seeded
// games (every ordered pairing of the chosen decks, --per deals each, first player alternating) and records evaluate()'s
// features at every end of turn from both seats and at a sample of the main-phase decision points from the active
// seat (worker jobs `evalLeaves` + `midLeaves`), then fits the result on them with deck controls, λ by folds of the
// fitting games, cluster-robust SEs by game, and held-out games for the scores. It writes a candidate weight set as a
// block for src/ai/weightSets.ts; it never changes DEFAULT_WEIGHTS.
//   npx tsx scripts/eval-refit.ts [--decks all|meta|<file prefix>] [--per 1] [--seed 80001] [--bot hard] [--mid 0.25]
//     [--rows mid,next,ender] [--controls decks|none] [--folds 5] [--spent-risk main|always] [--sub-choice-eval 1]
//     [--compare <weight set or JSON>] [--name refit-YYYY-MM-DD] [--from FILE] [--threads N] [--out DIR] [--force]
// --mid: the share of main-phase decisions recorded as mid rows (0 = ends of turns only, as the calibration).
// --rows: which rows the fit uses: mid (main-phase decision points, the active seat's view: where Medium and Hard's
//   screen evaluate), next (ends of turns from the seat about to start: Hard's rollout cut), ender (ends of turns from
//   the seat that ended it: Hard's reaction cut).
// --spent-risk: the rule the spentRisk feature is measured under, and the candidate's `spentRiskMainOnly`: main (only
//   while the active seat is in its main phase, the B7 fix) or always (as DEFAULT_WEIGHTS today).
// --sub-choice-eval: the candidate's `subChoiceEval` switch (1: Unit sub-choices ranked on the candidate's own scale).
// --compare: also record each leaf's value under these weights (a named set from src/ai/weightSets.ts, or JSON over
//   DEFAULT_WEIGHTS), scored beside the current weights on the held-out games: the fresh-games check of a candidate.
// --from FILE: re-fit leaves saved by an earlier run (DIR/eval-refit-leaves.json) instead of playing games.
// --out DIR: write DIR/eval-refit.md, DIR/eval-refit.json (report and manifest), DIR/eval-refit-leaves.json (for --from)
//   and DIR/weight-set.ts.txt (the candidate block); refuses to overwrite them without --force. Without --out the
//   report goes to stdout and nothing is written.
import fs from 'node:fs';
import path from 'node:path';
import { bool, cli, int, loadLibrary, num, oneOf, Refusal, runJobs, runMain, str, threadsOpt, TIER_BOTS } from './lib-node';
import { REFIT_TERMS, refit, refitMarkdown, ROW_KINDS, weightSetBlock, type RowKind } from '../src/analysis/evalRefit';
import type { LeafGame } from '../src/analysis/evalCalibration';
import { DEFAULT_WEIGHTS, type EvalWeights } from '../src/ai/eval';
import { weightSet } from '../src/ai/weightSets';
import { gameRunManifest } from '../src/lib/runManifest';
import { SIM_VERSION } from '../src/lib/tournament';
import type { MatchJob } from './worker';

const today = new Date().toISOString().slice(0, 10);
const { values: V } = cli(import.meta.url, {
  decks: str('all', (v) => (/^[\w.-]+$/.test(v) ? undefined : 'a deck set: meta, all, or a file-name prefix')),
  per: int(1, { min: 1 }),
  seed: int(80001, { min: 0 }),
  bot: oneOf(TIER_BOTS, 'hard'),
  mid: num(0.25, { min: 0, max: 1 }),
  rows: str('mid,next,ender', (v) => (v.split(',').every((k) => (ROW_KINDS as readonly string[]).includes(k)) ? undefined : `row kinds from ${ROW_KINDS.join(', ')}, comma-separated`)),
  controls: oneOf(['decks', 'none'] as const, 'decks'),
  folds: int(5, { min: 2, max: 20 }),
  'spent-risk': oneOf(['main', 'always'] as const, 'main'),
  'sub-choice-eval': int(1, { min: 0, max: 1 }),
  compare: str(),
  name: str(`refit-${today}`, (v) => (/^[a-z0-9-]+$/.test(v) ? undefined : 'lower-case letters, digits and dashes')),
  from: str(),
  threads: threadsOpt(),
  out: str(),
  force: bool(),
});

/** The compared weights: a named set or JSON, over DEFAULT_WEIGHTS. */
function compareWeights(spec: string | undefined): EvalWeights | undefined {
  if (!spec) return undefined;
  if (spec.trim().startsWith('{')) {
    let over: Record<string, number>;
    try {
      over = JSON.parse(spec) as Record<string, number>;
    } catch {
      throw new Refusal(`--compare: not JSON: ${spec}`);
    }
    for (const k of Object.keys(over)) if (!(k in DEFAULT_WEIGHTS)) throw new Refusal(`--compare: unknown weight ${k}`);
    return { ...DEFAULT_WEIGHTS, ...over };
  }
  try {
    return { ...DEFAULT_WEIGHTS, ...weightSet(spec) };
  } catch (e) {
    throw new Refusal(String((e as Error).message));
  }
}

interface LeavesFile {
  kind: 'nct-eval-refit-leaves';
  schema: 1;
  manifest: unknown;
  /** the order of every leaf's features (REFIT_TERMS of the code that played the games) */
  terms: string[];
  /** the weights the features were measured with (only the switches differ from DEFAULT_WEIGHTS) */
  measure: Partial<EvalWeights>;
  /** --compare as given: the leaves' `vc` values are evaluate() with these weights */
  compare?: string;
  games: LeafGame[];
}

async function main() {
  const files = V.out ? ['eval-refit.md', 'eval-refit.json', 'eval-refit-leaves.json', 'weight-set.ts.txt'].map((f) => path.join(V.out!, f)) : [];
  const clash = files.filter((f) => fs.existsSync(f) && !(V.from && path.resolve(f) === path.resolve(V.from)));
  if (clash.length && !V.force) throw new Refusal(`${clash.join(', ')} exist${clash.length === 1 ? 's' : ''}; pass --force to overwrite`);
  const kinds = V.rows.split(',') as RowKind[];
  const measureSwitches: Partial<EvalWeights> = { spentRiskMainOnly: V['spent-risk'] === 'main' ? 1 : 0 };

  let data: LeavesFile;
  const t0 = Date.now();
  if (V.from) {
    const saved = JSON.parse(fs.readFileSync(V.from, 'utf8')) as LeavesFile;
    if (saved.kind !== 'nct-eval-refit-leaves' || saved.schema !== 1) throw new Refusal(`${V.from} is not an eval-refit leaves file (kind nct-eval-refit-leaves, schema 1)`);
    if ((saved.measure.spentRiskMainOnly ?? 0) !== measureSwitches.spentRiskMainOnly) throw new Refusal(`${V.from} was measured with --spent-risk ${saved.measure.spentRiskMainOnly ? 'main' : 'always'}; pass that`);
    const missing = REFIT_TERMS.filter((t) => !saved.terms.includes(t));
    if (missing.length) console.error(`Warning: the leaves have no ${missing.join(', ')} (played by older code); those terms count as 0 and keep their current weights.`);
    data = saved;
    console.error(`Read ${data.games.length} games from ${V.from}.`);
  } else {
    const lib = loadLibrary();
    const base = (f: string) => f.slice(f.lastIndexOf('/') + 1);
    const field = V.decks === 'meta' ? lib.filter((d) => d.kind === 'meta') : V.decks === 'all' ? lib : lib.filter((d) => base(d.file).startsWith(V.decks));
    if (field.length < 2) throw new Refusal(`--decks ${V.decks} matches ${field.length} deck(s); at least 2 are needed`);
    const measure: EvalWeights = { ...DEFAULT_WEIGHTS, ...measureSwitches };
    const compare = compareWeights(V.compare);
    const jobs: MatchJob[] = [];
    let seed = V.seed;
    for (const x of field)
      for (const y of field)
        if (x !== y)
          for (let k = 0; k < V.per; k++)
            jobs.push({ a: x.deck, b: y.deck, seed: seed++, first: (k % 2) as 0 | 1, bot: V.bot, evalLeaves: true, midLeaves: V.mid, leafExtra: true, leafMeasure: measure, ...(compare ? { leafCompare: compare } : {}) });
    console.error(`Playing ${jobs.length} ${V.bot} games over ${field.length} decks…`);
    const res = await runJobs(jobs, { threads: V.threads, allowErrors: true });
    const ok = res.filter((r) => r.winner !== null);
    if (ok.length < res.length) console.error(`Warning: ${res.length - ok.length} game(s) threw and are left out.`);
    data = {
      kind: 'nct-eval-refit-leaves',
      schema: 1,
      terms: [...REFIT_TERMS],
      measure: measureSwitches,
      ...(V.compare ? { compare: V.compare } : {}),
      games: ok.map((r) => ({ seed: r.seed, a: r.a, b: r.b, first: r.first, winner: r.winner as 0 | 1 | 'tie', leaves: r.evalLeaves ?? [] })),
      manifest: gameRunManifest({
        purpose: 'analysis',
        decks: field,
        fieldMode: V.decks,
        bot: V.bot,
        seedBase: V.seed,
        seatPolicy: 'alternate',
        plannedGames: jobs.length,
        completedGames: ok.length,
        gamesPerPair: V.per,
        simVersion: SIM_VERSION,
      }),
    };
  }
  const secs = (Date.now() - t0) / 1000;
  const report = refit(data.games, {
    kinds,
    controls: V.controls,
    folds: V.folds,
    fileTerms: data.terms,
    switches: { ...measureSwitches, subChoiceEval: V['sub-choice-eval'] },
  });
  const fitSecs = (Date.now() - t0) / 1000 - secs;
  const m = data.manifest as { simVersion?: number; plannedGames?: number } | null;
  const decks = new Set(data.games.flatMap((g) => [g.a, g.b])).size;
  const provenance = [
    `${data.games.length} ${V.from ? '' : `${V.bot} `}games over ${decks} decks (${V.from ? `from ${path.basename(V.from)}` : `--decks ${V.decks} --per ${V.per} --seed ${V.seed} --mid ${V.mid}`}), SIM_VERSION ${m?.simVersion ?? SIM_VERSION}, fitted ${today}`,
    `with spentRisk measured ${V['spent-risk'] === 'main' ? 'only in the main phase' : 'as always'}.`,
  ];
  const constName = V.name.toUpperCase().replace(/-/g, '_');
  const block = weightSetBlock(V.name, constName, report, provenance);
  const md = [
    `# Evaluation refit (REVIEW_2026-11-24 C.3)`,
    '',
    `${data.games.length} games (${V.from ? `from ${V.from}` : `${V.bot}, --decks ${V.decks} --per ${V.per} --seed ${V.seed} --mid ${V.mid}, ${secs.toFixed(0)} s`}), fitted in ${fitSecs.toFixed(0)} s. Results are win 1 / tie ½ / loss 0 for the viewing seat; the current value is evaluate() with DEFAULT_WEIGHTS; the features were measured with spentRisk ${V['spent-risk'] === 'main' ? 'in the main phase only' : 'as always'}.`,
    '',
    refitMarkdown(report),
    '### Candidate (for src/ai/weightSets.ts; add it to WEIGHT_SETS as ' + `'${V.name}'` + ')',
    '',
    '```ts',
    block,
    '```',
    '',
  ].join('\n');
  if (!V.out) {
    console.log(md);
    return;
  }
  fs.mkdirSync(V.out, { recursive: true });
  const [mdFile, jsonFile, leavesFile, blockFile] = files as [string, string, string, string];
  fs.writeFileSync(mdFile, md + '\n');
  fs.writeFileSync(jsonFile, JSON.stringify({ manifest: data.manifest, measure: data.measure, report }, null, 1));
  if (!V.from) fs.writeFileSync(leavesFile, JSON.stringify(data));
  fs.writeFileSync(blockFile, block + '\n');
  console.log(md);
  console.error(`\nWrote ${mdFile}, ${jsonFile}${V.from ? '' : `, ${leavesFile}`}, ${blockFile}.`);
}
runMain(main);
