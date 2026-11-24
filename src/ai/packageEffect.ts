// The measured effect of a synergy package in one list (REVIEW_2026-11-24 S1, B.10; docs/SYNERGIES.md "The package's
// effect, measured in pairs"): the list against the same list with the package taken out (removePackage in
// src/lib/deckPackages.ts: its pieces cut, the best other cards by the hand-written card value in their place), on the
// same paired games, the forge's layout against the meta decks. Written by scripts/package-effects.ts into
// public/data/package-effects.json; the coach reads a seat's rows (seatEffects) and names a package only when its
// interval is above 0 (effectGate 'measured'), worded as a measured effect of the package in this list; a package
// measured without that is not named ('hidden'), and one this list has no current row for is worded as an unmeasured
// idea, as with no file at all.
//
// It replaces, for the coach, the online-against-never lift (src/ai/packageLift.ts), which follows what a package's
// `online` condition marks (winning or losing positions) and contradicted the held-out record (Blockers: lift −14.3,
// while S2-08's swap into it measured +15 points). The lift stays as an association on the Card stats page.
//
// The interval is corrected for the packages measured on the same list (Bonferroni: two-sided 95% over the `family`
// rows of that list), so a list's chance of naming any package with no effect stays at most 2.5%.
// Plain data and pure; no engine, no bots: the coach worker and the Play page import it.

export const PACKAGE_EFFECTS_KIND = 'nct-package-effects';
export const PACKAGE_EFFECTS_SCHEMA = 1;
/** Where the measurement is published (fetched by the Play page with the coach on). */
export const PACKAGE_EFFECTS_PATH = 'data/package-effects.json';

/** One package measured in one list. Differences are fractions of a game (0.01 = one point of win rate). */
export interface PackageEffectRow {
  /** the list measured, with the package (listFingerprint) and its library deck file */
  listId: string;
  deck: string;
  pkg: string;
  /** the list without the package, and the cards swapped to make it (out: the package's pieces; in: their replacements) */
  withoutListId: string;
  cardsOut: string[];
  cardsIn: string[];
  bot: string;
  simVersion: number;
  /** paired games (each list played every one), the first seed (game k used seed + k), the field's list fingerprints */
  games: number;
  seed: number;
  opponents: string[];
  /** with the package minus without, per paired game: mean, its standard error, the per-game spread */
  mean: number;
  se: number;
  sd: number;
  /** the packages measured on this list in the run: the Bonferroni family */
  family: number;
  /** the corrected interval: two-sided 95% over `family` */
  low: number;
  high: number;
  /** YYYY-MM-DD */
  date: string;
}

/** A package of a list that could not be measured, and why (in words). */
export interface PackageEffectSkip {
  listId: string;
  deck: string;
  pkg: string;
  why: string;
}

export interface PackageEffectFile {
  kind: typeof PACKAGE_EFFECTS_KIND;
  schema: 1;
  /** the synergy catalogue the packages were read from (CATALOGUE_VERSION); a file made with another counts as none */
  catalogueVersion: string;
  rows: PackageEffectRow[];
  skipped: PackageEffectSkip[];
  /** the run manifest of the games (src/lib/runManifest.ts), when written by the script */
  manifest?: unknown;
}

/** What the coach knows of one seat's packages: null (no usable file: every package unmeasured), else this list's rows by package id. */
export type SeatEffects = Record<string, PackageEffectRow> | null;

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const FP = /^[0-9a-f]{16}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CARD = /^[a-z0-9_]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const cards = (x: unknown) => Array.isArray(x) && x.length <= 60 && x.every((c) => typeof c === 'string' && CARD.test(c));

/** Problems with one row (empty when it reads). */
export function packageEffectRowProblems(x: unknown, where: string): string[] {
  if (!isObj(x)) return [`${where} is not an object`];
  const out: string[] = [];
  for (const k of ['listId', 'withoutListId'] as const) if (!(typeof x[k] === 'string' && FP.test(x[k] as string))) out.push(`${where}.${k} must be a list fingerprint (16 hex digits)`);
  if (!(typeof x.deck === 'string' && /\.txt$/.test(x.deck) && x.deck.length <= 200 && !x.deck.includes('..'))) out.push(`${where}.deck must be a deck file name (.txt)`);
  if (!(typeof x.pkg === 'string' && ID.test(x.pkg))) out.push(`${where}.pkg must be a package id`);
  if (!cards(x.cardsOut) || !cards(x.cardsIn) || !(x.cardsOut as unknown[]).length) out.push(`${where}.cardsOut and cardsIn must be lists of card ids (cardsOut not empty)`);
  if (!(typeof x.bot === 'string' && /^[a-z0-9-]{1,32}$/.test(x.bot))) out.push(`${where}.bot is missing`);
  if (!(Number.isInteger(x.simVersion) && (x.simVersion as number) >= 1)) out.push(`${where}.simVersion must be a whole number of 1 or more`);
  if (!(Number.isInteger(x.games) && (x.games as number) >= 2)) out.push(`${where}.games must be a whole number of 2 or more`);
  if (!(Number.isSafeInteger(x.seed) && (x.seed as number) >= 0)) out.push(`${where}.seed must be a whole number of 0 or more`);
  if (!(Array.isArray(x.opponents) && x.opponents.length > 0 && x.opponents.length <= 100 && x.opponents.every((o) => typeof o === 'string' && FP.test(o)))) out.push(`${where}.opponents must be a non-empty list of list fingerprints`);
  for (const k of ['mean', 'low', 'high'] as const) if (!num(x[k]) || Math.abs(x[k] as number) > 1) out.push(`${where}.${k} must be a number from -1 to 1`);
  if (!num(x.se) || (x.se as number) < 0) out.push(`${where}.se must be a number of 0 or more`);
  if (!num(x.sd) || (x.sd as number) < 0) out.push(`${where}.sd must be a number of 0 or more`);
  if (num(x.low) && num(x.high) && num(x.mean) && !((x.low as number) <= (x.mean as number) && (x.mean as number) <= (x.high as number))) out.push(`${where}: low ≤ mean ≤ high does not hold`);
  if (!(Number.isInteger(x.family) && (x.family as number) >= 1)) out.push(`${where}.family must be a whole number of 1 or more`);
  if (!(typeof x.date === 'string' && DATE.test(x.date))) out.push(`${where}.date must be YYYY-MM-DD`);
  return out;
}

/** Problems with a parsed file (empty when it reads): for npm run check:data and the reader. */
export function packageEffectsProblems(x: unknown, file = PACKAGE_EFFECTS_PATH): string[] {
  if (!isObj(x) || x.kind !== PACKAGE_EFFECTS_KIND) return [`${file}: not a package-effects file (kind "${PACKAGE_EFFECTS_KIND}")`];
  if (x.schema !== PACKAGE_EFFECTS_SCHEMA) return [`${file}: schema ${JSON.stringify(x.schema)} is not one this code reads (${PACKAGE_EFFECTS_SCHEMA})`];
  if (typeof x.catalogueVersion !== 'string' || !x.catalogueVersion) return [`${file}: no catalogueVersion`];
  if (!Array.isArray(x.rows) || !Array.isArray(x.skipped)) return [`${file}: rows and skipped must be lists`];
  const out: string[] = [];
  x.rows.forEach((r, i) => out.push(...packageEffectRowProblems(r, `${file}: rows[${i}]`)));
  const seen = new Set<string>();
  for (const r of x.rows as PackageEffectRow[]) {
    const key = `${r?.listId}\u0000${r?.pkg}\u0000${r?.bot}\u0000${r?.simVersion}`;
    if (seen.has(key)) out.push(`${file}: ${r.pkg} on list ${r.listId} is measured twice with one bot and simulator version`);
    seen.add(key);
  }
  x.skipped.forEach((s, i) => {
    if (!isObj(s) || typeof s.listId !== 'string' || !FP.test(s.listId) || typeof s.pkg !== 'string' || typeof s.why !== 'string' || typeof s.deck !== 'string') out.push(`${file}: skipped[${i}] must name a list, a deck, a package and why`);
  });
  return out;
}

/** A fetched package-effects file, or null when it is not one (untrusted input: any problem refuses the whole file). */
export function readPackageEffects(value: unknown): PackageEffectFile | null {
  return packageEffectsProblems(value).length ? null : (value as PackageEffectFile);
}

/**
 * A seat's rows: this list's rows measured under `simVersion` with the catalogue `catalogueVersion` (rows of another
 * version or catalogue are left out, so those packages read as unmeasured). With several bots for one package, the
 * row of `preferBot` (the ratings' bot, 'hard') first, else the one with the most games. Null without a file.
 */
export function seatEffects(file: PackageEffectFile | null | undefined, listId: string | undefined, now: { simVersion: number; catalogueVersion: string; preferBot?: string }): SeatEffects {
  if (!file) return null;
  if (file.catalogueVersion !== now.catalogueVersion) return null;
  const out: Record<string, PackageEffectRow> = {};
  if (!listId) return out;
  for (const r of file.rows) {
    if (r.listId !== listId || r.simVersion !== now.simVersion) continue;
    const had = out[r.pkg];
    const preferred = (x: PackageEffectRow) => (x.bot === now.preferBot ? 1 : 0);
    if (!had || preferred(r) > preferred(had) || (preferred(r) === preferred(had) && r.games > had.games)) out[r.pkg] = r;
  }
  return out;
}

/** How the coach may speak of a package: 'measured' (corrected interval above 0), 'unmeasured' (no current row), or 'hidden'. */
export function effectGate(effects: SeatEffects | undefined, id: string): 'measured' | 'unmeasured' | 'hidden' {
  const r = effects?.[id];
  if (!r) return 'unmeasured';
  return r.low > 0 ? 'measured' : 'hidden';
}

const pts = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;
const games = (n: number) => n.toLocaleString('en-US');
const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const botName = (b: string) => `${b.charAt(0).toUpperCase()}${b.slice(1)}`;

/**
 * The label a note carries for the packages it names: for each measured one, the paired effect in this list (the bot,
 * simulator version, games and the corrected range); for the ones without a current row, that they are ideas from the
 * catalogue. Hidden packages are not named at all.
 */
export function effectLabel(effects: SeatEffects | undefined, pkgs: readonly { id: string; name: string }[]): string {
  const out: string[] = [];
  const unmeasured = pkgs.filter((x) => effectGate(effects, x.id) === 'unmeasured').map((x) => x.name);
  if (unmeasured.length) out.push(`(${andList(unmeasured)} ${unmeasured.length > 1 ? 'are ideas' : 'is an idea'} from the package catalogue, not measured on this list.)`);
  for (const x of pkgs) {
    if (effectGate(effects, x.id) !== 'measured') continue;
    const r = effects![x.id]!;
    out.push(
      `(Measured on this list in the ${botName(r.bot)} bot's games, simulator version ${r.simVersion}: it won ${pts(r.mean).replace('+', '')} points more often than the same list with ${x.name}'s own ${r.cardsOut.length === 1 ? 'card' : `${r.cardsOut.length} cards`} swapped for others, range ${pts(r.low)} to ${pts(r.high)} points, over ${games(r.games)} paired games against the meta decks.)`,
    );
  }
  return out.join(' ');
}
