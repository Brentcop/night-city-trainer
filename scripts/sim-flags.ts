// Flags of scripts/simulate.ts (`npm run sim`), kept apart from the script so tests can parse them without running it.
import path from 'node:path';
import { bool, int, oneOf, SIM_BOTS, str, threadsOpt } from './lib-node';

const FIELD_RE = /^(meta|all|custom|leaderboard:\d+)$/;
export const ALL_FLAGS = {
  games: int(undefined, { min: 1 }),
  bot: oneOf(SIM_BOTS, 'lookahead'),
  threads: threadsOpt(),
  seed: int(1, { min: 0 }),
  field: str('meta', (v) => (FIELD_RE.test(v) ? undefined : `must be meta | all | custom | leaderboard:N, got "${v}"`)),
  deck: str(),
  name: str(),
  force: bool(),
  /** analyze: record decision telemetry and write the decisions report */
  decisions: bool(),
  /** analyze --decisions: also dump the raw records of the first N games */
  'decision-samples': int(0, { min: 0, max: 1000 }),
  /** analyze: write every output into this directory instead of reports/ and src/data/ (and no site copy in public/data/) */
  out: str(undefined, (v) => (v.trim() ? undefined : 'needs a directory')),
};
export type Flag = keyof typeof ALL_FLAGS;
const GAME: Flag[] = ['games', 'bot', 'threads', 'seed'];
/** command -> [flags it takes, min positionals, max positionals] */
export const COMMANDS: Record<string, [Flag[], number, number]> = {
  catalog: [[], 0, 0],
  help: [[], 0, 0],
  show: [[], 1, 1],
  add: [['name', 'force'], 0, 1],
  vs: [GAME, 2, 2],
  test: [[...GAME, 'field'], 1, 1],
  review: [[...GAME, 'field'], 0, 0],
  analyze: [[...GAME, 'field', 'deck', 'decisions', 'decision-samples', 'out', 'force'], 0, 0],
};

export interface AnalyzeFlags {
  decisions?: boolean;
  'decision-samples'?: number;
  out?: string;
}

/** A combination of analyze flags that makes no sense (the CLI prints it and exits 2), or undefined. */
export function analyzeFlagProblem(v: AnalyzeFlags): string | undefined {
  if ((v['decision-samples'] ?? 0) > 0 && !v.decisions) return '--decision-samples needs --decisions';
  return undefined;
}

/** Where `sim analyze` writes. `focus` is the focused deck's file stem (--deck), or null for a whole field. */
export interface AnalyzeOutputs {
  analysisMd: string;
  analysisJson: string;
  /** whole-field runs only: rankings, the site's telemetry and the bots' card impact */
  review?: string;
  analysisSite?: string;
  impact?: string;
  decisionsJson?: string;
  decisionsMd?: string;
  /** the copy the site's Card stats page fetches (whole-field runs only) */
  decisionsSite?: string;
  decisionSamples?: string;
}
export function analyzeOutputs(v: AnalyzeFlags, focus: string | null): AnalyzeOutputs {
  const tag = focus ? `-${focus}` : '';
  const at = (dir: string, f: string) => (v.out ? path.join(v.out, f) : path.join(dir, f));
  const o: AnalyzeOutputs = { analysisMd: at('reports', `analysis${tag}-latest.md`), analysisJson: at('reports', `analysis${tag}-latest.json`) };
  if (!focus) {
    o.review = at('src/data', 'review.json');
    o.analysisSite = at('src/data', 'analysis.json');
    o.impact = at('src/data', 'impact.json');
  }
  if (v.decisions) {
    o.decisionsJson = at('reports', `decisions${tag}-latest.json`);
    o.decisionsMd = at('reports', `decisions${tag}-latest.md`);
    // the site copy is the same report, compact; an --out run keeps everything in its directory and writes no site copy
    if (!focus && !v.out) o.decisionsSite = 'public/data/decisions.json';
    if ((v['decision-samples'] ?? 0) > 0) o.decisionSamples = at('reports', `decisions${tag}-samples-latest.json`);
  }
  return o;
}

/**
 * Outputs `sim analyze` won't overwrite without --force: everything in an --out directory, and the site's decisions
 * report (recorded data the site serves). The long-standing outputs (reports/*-latest, src/data/analysis.json, review.json,
 * impact.json) are rewritten by every analyze run, as before.
 */
export function protectedOutputs(o: AnalyzeOutputs, v: AnalyzeFlags): string[] {
  if (v.out) return Object.values(o).filter((x): x is string => typeof x === 'string');
  return o.decisionsSite ? [o.decisionsSite] : [];
}
