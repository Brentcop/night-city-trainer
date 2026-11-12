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
  /** analyze: observe the synergy packages (src/content/synergies) and write the synergy report */
  synergies: bool(),
  /** analyze: write ONLY the synergy report: no analysis, review, impact or decisions files */
  'synergies-only': bool(),
  /** analyze --out DIR: also write the adjusted card-impact estimate (INFO-2, src/analysis/impactAdjusted.ts) */
  'impact-adjusted': bool(),
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
  analyze: [[...GAME, 'field', 'deck', 'decisions', 'decision-samples', 'synergies', 'synergies-only', 'impact-adjusted', 'out', 'force'], 0, 0],
};

export interface AnalyzeFlags {
  decisions?: boolean;
  'decision-samples'?: number;
  out?: string;
  synergies?: boolean;
  'synergies-only'?: boolean;
  'impact-adjusted'?: boolean;
}

/** A combination of analyze flags that makes no sense (the CLI prints it and exits 2), or undefined. */
export function analyzeFlagProblem(v: AnalyzeFlags): string | undefined {
  if ((v['decision-samples'] ?? 0) > 0 && !v.decisions) return '--decision-samples needs --decisions';
  if (v['synergies-only'] && v.decisions) return '--synergies-only writes only the synergy report; use --synergies with --decisions';
  if (v['impact-adjusted'] && v['synergies-only']) return '--synergies-only writes only the synergy report; drop it to use --impact-adjusted';
  // a measurement, not the bots' data: keep it (and the run's impact.json) out of src/data/
  if (v['impact-adjusted'] && !v.out) return '--impact-adjusted needs --out DIR (the run would otherwise rewrite src/data/impact.json, which the Hard bot reads)';
  return undefined;
}

/** The run observes synergy packages (--synergies or --synergies-only). */
export const wantsSynergies = (v: AnalyzeFlags) => !!(v.synergies || v['synergies-only']);

/** Where `sim analyze` writes. `focus` is the focused deck's file stem (--deck), or null for a whole field. */
export interface AnalyzeOutputs {
  /** absent with --synergies-only */
  analysisMd?: string;
  analysisJson?: string;
  /** whole-field runs only: rankings, the site's telemetry and the bots' card impact */
  review?: string;
  analysisSite?: string;
  impact?: string;
  decisionsJson?: string;
  decisionsMd?: string;
  /** the copy the site's Card stats page fetches (whole-field runs only) */
  decisionsSite?: string;
  decisionSamples?: string;
  synergiesJson?: string;
  synergiesMd?: string;
  /** the copy the Card stats page's Synergies view and the deck profile fetch (whole-field runs only) */
  synergiesSite?: string;
  /** --impact-adjusted: the adjusted card-impact estimate (INFO-2) */
  impactAdjustedJson?: string;
  impactAdjustedMd?: string;
}
export function analyzeOutputs(v: AnalyzeFlags, focus: string | null): AnalyzeOutputs {
  const tag = focus ? `-${focus}` : '';
  const at = (dir: string, f: string) => (v.out ? path.join(v.out, f) : path.join(dir, f));
  const o: AnalyzeOutputs = {};
  if (v['synergies-only']) {
    o.synergiesJson = at('reports', `synergies${tag}-latest.json`);
    o.synergiesMd = at('reports', `synergies${tag}-latest.md`);
    if (!focus && !v.out) o.synergiesSite = 'public/data/synergies.json';
    return o;
  }
  o.analysisMd = at('reports', `analysis${tag}-latest.md`);
  o.analysisJson = at('reports', `analysis${tag}-latest.json`);
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
  if (v.synergies) {
    o.synergiesJson = at('reports', `synergies${tag}-latest.json`);
    o.synergiesMd = at('reports', `synergies${tag}-latest.md`);
    if (!focus && !v.out) o.synergiesSite = 'public/data/synergies.json';
  }
  if (v['impact-adjusted']) {
    o.impactAdjustedJson = at('reports', `impact-adjusted${tag}-latest.json`);
    o.impactAdjustedMd = at('reports', `impact-adjusted${tag}-latest.md`);
  }
  return o;
}

/**
 * Outputs `sim analyze` won't overwrite without --force: everything in an --out directory, the site's decisions report
 * (recorded data the site serves), and every synergy output (reports/synergies-latest.* and the site copy). The
 * long-standing outputs (reports/analysis-latest.*, reports/decisions-latest.*, src/data/analysis.json, review.json,
 * impact.json) are rewritten by every analyze run, as before.
 */
export function protectedOutputs(o: AnalyzeOutputs, v: AnalyzeFlags): string[] {
  if (v.out) return Object.values(o).filter((x): x is string => typeof x === 'string');
  return [o.decisionsSite, o.synergiesJson, o.synergiesMd, o.synergiesSite].filter((x): x is string => typeof x === 'string');
}
