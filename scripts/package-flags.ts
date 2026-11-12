// Synergy-package flags shared by the deck builders (season.ts, breed-preview.ts, forge.ts, optimize.ts); the logic is in
// src/lib/deckPackages.ts. Every flag is opt-in: with none of them a builder runs exactly as it did before packages.
//
//   --keep-packages a,b      never cut these packages' pieces below their working minimum ("none": keep nothing)
//   --require-packages a,b   the result must be built around these
//   --avoid-packages a,b     the result must not be built around these
//   --lock-cards id[:n],…    never cut these cards below n copies (no n = every copy) — forge and optimizer only
//   --seed-packages a+b,c    breed explorers around these combinations of one or two packages — breeder only
//   --package-moves          also try whole-package moves: complete, add, swap, remove — forge and optimizer
//   --package-cands N        how many package moves to try per round (default 3)
//   --partner-aware          rank cuts and adds partner-aware (src/lib/cutRanking.ts) — forge and optimizer; on by
//                            itself whenever any package flag is given; --plain-ranking turns it off again
// Unknown ids exit with code 2 and the list of valid ids.
import { DECK_OBJECTIVES } from '../src/content/deckObjectives';
import { compactPlan, isEmptyPlan, parseLockCards, parsePackageList, parseSeedCombos, planProblems, type PackagePlan } from '../src/lib/deckPackages';
import { bool, int, str } from './lib-node';

const listCheck = (v: string) => parsePackageList(v).error;
/** The plan flags (keep / require / avoid). */
export const planFlags = () => ({
  'keep-packages': str(undefined, listCheck),
  'require-packages': str(undefined, listCheck),
  'avoid-packages': str(undefined, listCheck),
});
/** For the list tuners (forge, optimizer): locks and package moves too. */
export const tunerPackageFlags = () => ({
  ...planFlags(),
  'lock-cards': str(undefined, (v) => parseLockCards(v).error),
  'package-moves': bool(),
  'package-cands': int(3, { min: 1, max: 12 }),
  'partner-aware': bool(),
  'plain-ranking': bool(),
});
/** For the breeder: seed combinations. */
export const breederPackageFlags = () => ({
  ...planFlags(),
  'seed-packages': str(undefined, (v) => parseSeedCombos(v).error),
});

export interface PackageFlagValues {
  'keep-packages'?: string;
  'require-packages'?: string;
  'avoid-packages'?: string;
  'lock-cards'?: string;
  'package-moves'?: boolean;
  'seed-packages'?: string;
  'partner-aware'?: boolean;
  'plain-ranking'?: boolean;
}

/** Whether any package flag was given (only then does a builder do anything package-related). */
export function packagesOn(v: PackageFlagValues): boolean {
  return v['keep-packages'] !== undefined || v['require-packages'] !== undefined || v['avoid-packages'] !== undefined || v['lock-cards'] !== undefined || !!v['package-moves'] || v['seed-packages'] !== undefined;
}

/**
 * Whether the tuners rank cuts and adds partner-aware (src/lib/cutRanking.ts): --partner-aware, or any package flag,
 * unless --plain-ranking. With neither, the candidates are exactly the pinned ones (tests/deck-packages-defaults.test.ts).
 */
export function partnerAwareOn(v: PackageFlagValues): boolean {
  if (v['plain-ranking']) return false;
  return !!v['partner-aware'] || packagesOn(v);
}

/**
 * The plan the flags describe (already validated by the flag checks). `objectiveKeep`: a deck objective's packages, the
 * default `keep` when package flags are on but --keep-packages is not given.
 */
export function planFromFlags(v: PackageFlagValues, objectiveKeep?: readonly string[]): PackagePlan {
  if (!packagesOn(v)) return {};
  const ids = (x?: string) => (x === undefined ? undefined : parsePackageList(x).ids);
  const avoid = ids(v['avoid-packages']) ?? [];
  // an objective's packages yield to an explicit --avoid-packages; explicit flags that contradict each other are refused
  const keep = ids(v['keep-packages']) ?? (objectiveKeep ?? []).filter((id) => !avoid.includes(id));
  return compactPlan({ keep, require: ids(v['require-packages']), avoid, lockCards: v['lock-cards'] ? parseLockCards(v['lock-cards']).lock : undefined });
}

/** Refuse a contradictory plan (a package both kept or required and avoided) the way a bad flag is refused: exit code 2. */
export function exitOnPlanProblems(plan: PackagePlan): void {
  const p = planProblems(plan);
  if (!p.length) return;
  console.error(`error: ${p.join('; ')}
Run with --help for usage.`);
  process.exit(2);
}

export const seedsFromFlags = (v: PackageFlagValues) => (v['seed-packages'] ? parseSeedCombos(v['seed-packages']).combos : []);

/** The packages a library deck's objective names (the default keep). A note written for an earlier list still counts. */
export function objectivePackages(file: string): string[] {
  return [...(DECK_OBJECTIVES[file]?.synergies ?? [])];
}

/** The command-line form of a plan (season.ts passes it on to the forge). */
export function planArgs(v: PackageFlagValues): string[] {
  const out: string[] = [];
  for (const k of ['keep-packages', 'require-packages', 'avoid-packages'] as const) if (v[k] !== undefined) out.push(`--${k}`, v[k] || 'none');
  if (v['package-moves']) out.push('--package-moves');
  if (v['partner-aware']) out.push('--partner-aware');
  if (v['plain-ranking']) out.push('--plain-ranking');
  return out;
}

export { isEmptyPlan };
