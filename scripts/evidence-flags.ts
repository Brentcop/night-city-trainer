// Adoption-rule and search-depth flags shared by the deck builders (forge.ts, optimize.ts, season.ts); the rule is in
// src/lib/evidence.ts and the depth and game budget in src/lib/deckSearch.ts (docs/SYNERGIES.md "When a deck change is
// adopted").
//
//   --adopt evidence|any-gain   the adoption rule (default evidence; any-gain is the rule before 2026-11-11, for
//                               reproducing old runs: one confirmation, adopt on any gain; the numbers below are ignored)
//   --min-gain P                adopt only when the corrected lower bound of the held-out paired gain is above P points (1)
//   --package-min-gain P        the same for whole-package moves (default: --min-gain)
//   --min-games N               no adoption on fewer held-out paired games (200)
//   --confirm-cap K             confirmation stages at most, each the size of the first (4)
//   --alpha A                   two-sided error rate shared by the looks and nominees (0.05)
//   --boundary B                how the looks share it: obrien-fleming (default; alpha spending, strict early looks) or
//                               bonferroni (the same z at every look, the rule of 2026-11-11); nominees split it evenly
//   --futility-after N          futility stop: after N stages, a nominee whose held-out paired mean gain is at most
//                               --futility-gain stops early as "could not tell" (never adopted); 0 = off (2)
//   --futility-gain X           the futility stop's threshold in points; negative values as --futility-gain=-1 (0)
//   --cards-per-change N        combine up to N of the best screened one-card swaps in one candidate (1-3; default 1)
//   --packages-per-change N     combine up to N of the best screened package moves (1-2; default 1)
//   --nominees N                candidates confirmed per generation
//   --combine-from N            how many of the best screened single changes are combined (4)
//   --budget N                  refuse a run that may play more than N games per deck (12000) unless --force
//   --ledger                    the change ledger (src/lib/changeLedger.ts, scripts/ledger-store.ts): keep every screening
//                               and held-out paired game, and pool a nominee's held-out games from earlier runs (same
//                               simulator version, bot and field) by the strict rule (docs/SYNERGIES.md "Pooling held-out
//                               games across runs"); off by default, and without it nothing changes
//   --ledger-dir DIR            where the ledger is kept (default data/ledger; under --out DIR it is DIR/ledger)
//   --pooled-ranking            (forge; needs --ledger and the evidence rule) a shortlist from pooled evidence
//                               (src/lib/shortlist.ts, docs/SYNERGIES.md "A shortlist carried across runs"): carry the
//                               most promising one-card swaps of earlier runs into each generation, skip the ones earlier
//                               games say are not worth it, nominate by the gain over all of a change's games
//   --carry N                   changes carried into each generation (2)
//   --reach N                   drop a change that would need more than N held-out games in all to be adopted (10000)
import path from 'node:path';
import { ADOPTION_BOUNDARIES, adoptionRule, ruleProblems, type AdoptionBoundary, type AdoptionRule } from '../src/lib/evidence';
import { DEFAULT_GAME_BUDGET, DEPTH_DEFAULTS, type SearchDepth } from '../src/lib/deckSearch';
import { ledgerBot } from '../src/lib/changeLedger';
import { shortlistOptions, type ShortlistOptions } from '../src/lib/shortlist';
import { bool, int, num, oneOf, str } from './lib-node';

export const ADOPT_KINDS = ['evidence', 'any-gain'] as const;

/** The adoption-rule flags. */
export const adoptionFlags = () => ({
  adopt: oneOf(ADOPT_KINDS, 'evidence'),
  'min-gain': num(undefined, { min: 0, max: 50 }),
  'package-min-gain': num(undefined, { min: 0, max: 50 }),
  'min-games': int(undefined, { min: 0, max: 100_000 }),
  'confirm-cap': int(undefined, { min: 1, max: 16 }),
  alpha: num(undefined, { min: 0.0001, max: 0.5 }),
  boundary: oneOf(ADOPTION_BOUNDARIES, undefined),
  'futility-after': int(undefined, { min: 0, max: 16 }),
  'futility-gain': num(undefined, { min: -50, max: 50 }),
});
/** The search-depth flags (`nominees` default differs per builder: forge 1, optimizer 6). */
export const depthFlags = (nominees: number) => ({
  'cards-per-change': int(DEPTH_DEFAULTS.cardsPerChange, { min: 1, max: 3 }),
  'packages-per-change': int(DEPTH_DEFAULTS.packagesPerChange, { min: 1, max: 2 }),
  nominees: int(nominees, { min: 1, max: 12 }),
  'combine-from': int(DEPTH_DEFAULTS.combineFrom, { min: 2, max: 8 }),
});
/** The game budget (forge, optimizer). */
export const budgetFlags = () => ({ budget: int(DEFAULT_GAME_BUDGET, { min: 1 }), force: bool() });

export interface AdoptionFlagValues {
  adopt?: (typeof ADOPT_KINDS)[number];
  'min-gain'?: number;
  'package-min-gain'?: number;
  'min-games'?: number;
  'confirm-cap'?: number;
  alpha?: number;
  boundary?: AdoptionBoundary;
  'futility-after'?: number;
  'futility-gain'?: number;
}
export interface DepthFlagValues {
  'cards-per-change'?: number;
  'packages-per-change'?: number;
  nominees?: number;
  'combine-from'?: number;
}

export function ruleFromFlags(v: AdoptionFlagValues): AdoptionRule {
  return adoptionRule({
    kind: v.adopt ?? 'evidence',
    ...(v['min-gain'] !== undefined ? { minGainPp: v['min-gain'] } : {}),
    ...(v['package-min-gain'] !== undefined ? { packageMinGainPp: v['package-min-gain'] } : {}),
    ...(v['min-games'] !== undefined ? { minGames: v['min-games'] } : {}),
    ...(v['confirm-cap'] !== undefined ? { capStages: v['confirm-cap'] } : {}),
    ...(v.alpha !== undefined ? { alpha: v.alpha } : {}),
    ...(v.boundary !== undefined ? { boundary: v.boundary } : {}),
    ...(v['futility-after'] !== undefined ? { futilityAfterStages: v['futility-after'] } : {}),
    ...(v['futility-gain'] !== undefined ? { futilityMaxGainPp: v['futility-gain'] } : {}),
  });
}

export function depthFromFlags(v: DepthFlagValues, nominees: number = DEPTH_DEFAULTS.nominees): SearchDepth {
  return {
    cardsPerChange: v['cards-per-change'] ?? DEPTH_DEFAULTS.cardsPerChange,
    packagesPerChange: v['packages-per-change'] ?? DEPTH_DEFAULTS.packagesPerChange,
    nominees: v.nominees ?? nominees,
    combineFrom: v['combine-from'] ?? DEPTH_DEFAULTS.combineFrom,
  };
}

/** Refuse a rule whose numbers make no sense the way a bad flag is refused: exit code 2. */
export function exitOnRuleProblems(rule: AdoptionRule): void {
  const p = ruleProblems(rule);
  if (!p.length) return;
  console.error(`error: ${p.join('; ')}\nRun with --help for usage.`);
  process.exit(2);
}

/** The command-line form of the rule and depth flags that were given (season.ts passes them on to the forge). */
export function adoptionArgs(v: AdoptionFlagValues & DepthFlagValues): string[] {
  const out: string[] = [];
  if (v.adopt && v.adopt !== 'evidence') out.push('--adopt', v.adopt);
  for (const k of ['min-gain', 'package-min-gain', 'min-games', 'confirm-cap', 'alpha', 'futility-after'] as const) {
    const x = v[k];
    if (x !== undefined) out.push(`--${k}`, String(x));
  }
  if (v.boundary !== undefined) out.push('--boundary', v.boundary);
  // `--name=value`, so a negative threshold is not read as a flag
  if (v['futility-gain'] !== undefined) out.push(`--futility-gain=${v['futility-gain']}`);
  // depth flags have defaults, so only values that differ from the forge's defaults are passed on
  const d = depthFromFlags(v);
  if (d.cardsPerChange !== DEPTH_DEFAULTS.cardsPerChange) out.push('--cards-per-change', String(d.cardsPerChange));
  if (d.packagesPerChange !== DEPTH_DEFAULTS.packagesPerChange) out.push('--packages-per-change', String(d.packagesPerChange));
  if (d.nominees !== DEPTH_DEFAULTS.nominees) out.push('--nominees', String(d.nominees));
  if (d.combineFrom !== DEPTH_DEFAULTS.combineFrom) out.push('--combine-from', String(d.combineFrom));
  return out;
}

/** The change-ledger flags (forge, optimizer, season). */
export const ledgerFlags = () => ({ ledger: bool(), 'ledger-dir': str() });
export interface LedgerFlagValues {
  ledger?: boolean;
  'ledger-dir'?: string;
}
/** The default ledger directory (committed). */
export const LEDGER_DIR = 'data/ledger';

/**
 * The ledger's directory and canonical bot name, or null when --ledger is off. Exits 2 (a bad command line) on
 * --ledger-dir without --ledger, or a bot the ledger refuses (hard-v1 reads src/data/impact.json). `out` is the run's
 * --out directory: the ledger then goes to OUT/ledger, so a trial run never writes into the repository.
 */
export function ledgerFromFlags(v: LedgerFlagValues, o: { bot: string; out?: string }): { dir: string; bot: string } | null {
  const fail = (msg: string): never => {
    console.error(`error: ${msg}\nRun with --help for usage.`);
    process.exit(2);
  };
  if (!v.ledger) {
    if (v['ledger-dir'] !== undefined) fail('--ledger-dir needs --ledger');
    return null;
  }
  const b = ledgerBot(o.bot);
  if (!b.bot) return fail(`${b.problem}; pick another --bot or leave out --ledger`);
  return { dir: v['ledger-dir'] ?? (o.out ? path.join(o.out, 'ledger') : LEDGER_DIR), bot: b.bot };
}

/** The command-line form of the ledger flags (season.ts passes them on to the forge). */
export function ledgerArgs(v: LedgerFlagValues): string[] {
  if (!v.ledger) return [];
  return ['--ledger', ...(v['ledger-dir'] !== undefined ? ['--ledger-dir', v['ledger-dir']] : [])];
}

/** The shortlist flags (forge, and the season for its forge step): src/lib/shortlist.ts. */
export const shortlistFlags = () => ({ 'pooled-ranking': bool(), carry: int(undefined, { min: 0, max: 20 }), reach: int(undefined, { min: 1, max: 100_000_000 }) });
export interface ShortlistFlagValues {
  'pooled-ranking'?: boolean;
  carry?: number;
  reach?: number;
}

/** Why the shortlist flags cannot be used as given (null when they can, or are off). */
export function shortlistProblem(v: ShortlistFlagValues, o: { ledger: boolean; rule: Pick<AdoptionRule, 'kind'> }): string | null {
  if (!v['pooled-ranking']) {
    const stray = (['carry', 'reach'] as const).filter((k) => v[k] !== undefined);
    return stray.length ? `${stray.map((k) => `--${k}`).join(' and ')} need${stray.length === 1 ? 's' : ''} --pooled-ranking` : null;
  }
  if (!o.ledger) return '--pooled-ranking needs --ledger: the shortlist is built from the games the change ledger keeps';
  if (o.rule.kind !== 'evidence') return '--pooled-ranking needs the evidence rule: under --adopt any-gain earlier games are never pooled';
  return null;
}

/** The shortlist's settings, or null when --pooled-ranking is off. Exits 2 (a bad command line) on a problem. */
export function shortlistFromFlags(v: ShortlistFlagValues, o: { ledger: boolean; rule: Pick<AdoptionRule, 'kind'> }): ShortlistOptions | null {
  const p = shortlistProblem(v, o);
  if (p) {
    console.error(`error: ${p}\nRun with --help for usage.`);
    process.exit(2);
  }
  return v['pooled-ranking'] ? shortlistOptions({ ...(v.carry !== undefined ? { carry: v.carry } : {}), ...(v.reach !== undefined ? { reach: v.reach } : {}) }) : null;
}

/** The command-line form of the shortlist flags (season.ts passes them on to the forge). */
export function shortlistArgs(v: ShortlistFlagValues): string[] {
  if (!v['pooled-ranking']) return [];
  return ['--pooled-ranking', ...(v.carry !== undefined ? ['--carry', String(v.carry)] : []), ...(v.reach !== undefined ? ['--reach', String(v.reach)] : [])];
}

/**
 * Print the run's game estimate and refuse (exit 2) when its most could exceed `budget` without --force.
 * `what` names the run ("forge of 2 decks").
 */
export function checkBudget(what: string, est: { min: number; max: number }, budget: number, force: boolean): void {
  console.log(`Game budget (${what}): ${est.min.toLocaleString('en-US')} to ${est.max.toLocaleString('en-US')} games per deck (budget ${budget.toLocaleString('en-US')}).`);
  if (est.max <= budget || force) return;
  console.error(`error: this run may play ${est.max.toLocaleString('en-US')} games per deck, over the budget of ${budget.toLocaleString('en-US')}. Lower the depth (--cards-per-change, --packages-per-change, --nominees, --confirm-cap) or the games, raise --budget, or pass --force.`);
  process.exit(2);
}
