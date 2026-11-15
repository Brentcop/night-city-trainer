// The change ledger (docs/TUNING_STUDY_2026-11-13.md P1; docs/SYNERGIES.md "Pooling held-out games across runs"): the
// paired games of every deck change a builder screened or confirmed, kept game by game so that later runs can pool the
// held-out ones instead of starting from nothing.
//
// Plain data and plain functions only (no file system, no DOM), so it runs in Node and in the browser. What one run does
// with it, whatever keeps it, is src/lib/changeLedgerRun.ts; the Node store is scripts/ledger-store.ts and the Deck Lab's
// store (IndexedDB) src/lib/changeLedgerStore.ts. The strict pooling rule itself is in src/lib/evidence.ts (judgePooled,
// alwaysValidZ), which confirmStaged and the verdicts here share.
//
// - A change is named by the lists themselves: the base list's fingerprint plus the cards cut and added (with
//   multiplicity) over main deck and Legends (changeKey). The same change found as a card swap or a package move has
//   the same key; a renamed list keeps it; card order does not matter.
// - An entry is change + simulator version + bot + field (fieldFingerprint of the opponents' list fingerprints). Games
//   are never pooled across entries: another version, bot or field is another entry.
// - A game is seed + opponent (list fingerprint) + who went first, with the base list's and the candidate's scores
//   (0, ½, 1). Within one entry and kind a game is kept once; a second arrival with other scores is a conflict (the
//   earlier one is kept and the conflict counted).
// - Screening games are kept (kind 'screen') but never pooled into a confirmation: the screening winner reads 2 to 4
//   points too high. Only held-out games (kind 'heldout') are evidence, and a game that has screened a change is never
//   kept as held-out evidence for it afterwards (two runs' seed ranges can overlap, so a later run can play as a held-out
//   game one that an earlier run screened the change on).
import { fingerprintText, listFingerprint } from '../engine/deck';
import type { DeckList } from '../engine/types';
import { judgePooled, settleGamesFromSums, type AdoptionRule, type PairedInterval, type PairedScores } from './evidence';
import { pairedGroup, splitPaired, type GroupSummary } from './pairedSplit';

export { POOL_RHO } from './evidence';

export const LEDGER_KIND = 'nct-change-ledger';
export const LEDGER_SCHEMA = 1;
export type BatchKind = 'heldout' | 'screen';
export const BATCH_KINDS: readonly BatchKind[] = ['heldout', 'screen'];

// ---------------------------------------------------------------- keys

type Lists = Pick<DeckList, 'legends' | 'main'>;

/** Multiset difference: what `a` has that `b` lacks (sorted, with repeats). */
function minus(a: readonly string[], b: readonly string[]): string[] {
  const left = new Map<string, number>();
  for (const id of b) left.set(id, (left.get(id) ?? 0) + 1);
  const out: string[] = [];
  for (const id of a) {
    const k = left.get(id) ?? 0;
    if (k > 0) left.set(id, k - 1);
    else out.push(id);
  }
  return out.sort();
}

/**
 * The change from `base` to `cand` as one canonical string: the base's list fingerprint, then the cuts and adds of each
 * section with repeats, sorted: "0123456789abcdef -main:a,a +main:b,c -legend:x +legend:y" (empty parts left out).
 */
export function changeKey(base: Lists, cand: Lists): string {
  const parts = [listFingerprint(base)];
  const add = (sign: '-' | '+', section: 'main' | 'legend', ids: string[]) => {
    if (ids.length) parts.push(`${sign}${section}:${ids.join(',')}`);
  };
  add('-', 'main', minus(base.main, cand.main));
  add('+', 'main', minus(cand.main, base.main));
  add('-', 'legend', minus(base.legends, cand.legends));
  add('+', 'legend', minus(cand.legends, base.legends));
  return parts.join(' ');
}

const KEY_RE = /^[0-9a-f]{16}( [-+](main|legend):[^\s,:]+(,[^\s,:]+)*)*$/;
/** The base list's fingerprint a change key starts with (the Node store keeps one file per base list). */
export const changeBase = (key: string): string => key.slice(0, 16);

/** The field's identity: a fingerprint of its opponents' list fingerprints, sorted (repeats kept). */
export function fieldFingerprint(opponents: readonly string[]): string {
  return fingerprintText([...opponents].sort().join(','));
}

/** One entry's identity: games pool only within one. */
export interface EntryId {
  change: string;
  simVersion: number;
  /** canonical bot name (ledgerBot) */
  bot: string;
  field: string;
}
export const entryKey = (e: EntryId): string => `${e.change}#v${e.simVersion}#${e.bot}#${e.field}`;
const sameEntry = (a: EntryId, b: EntryId) => entryKey(a) === entryKey(b);

/**
 * The bot names the game worker takes (scripts/worker.ts mkAgent), mapped to the agent they build: `fast` is Easy and
 * `lookahead` is Medium (src/ai/tiers.ts), and `best` builds exactly Medium's agent (noise 0.15, the best profiles; the
 * equality is checked in tests/change-ledger.test.ts). `hard-v1` reads src/data/impact.json, so its games are not a
 * function of the simulator version alone: it is refused. `deep` (the pre-tier Deep bot), `mixed`, `plain` and
 * `random` each build an agent of their own and keep their name.
 */
const BOT_NAMES: Readonly<Record<string, string | null>> = {
  easy: 'easy',
  fast: 'easy',
  medium: 'medium',
  lookahead: 'medium',
  best: 'medium',
  hard: 'hard',
  deep: 'deep',
  mixed: 'mixed',
  plain: 'plain',
  random: 'random',
  'hard-v1': null,
};
export const LEDGER_BOTS: readonly string[] = [...new Set(Object.values(BOT_NAMES).filter((b): b is string => !!b))];

/** The canonical bot name for the ledger, or why a bot cannot use it. */
export function ledgerBot(name: string): { bot: string; problem?: undefined } | { bot?: undefined; problem: string } {
  const b = BOT_NAMES[name];
  if (b) return { bot: b };
  if (b === null) return { problem: `the change ledger cannot use the bot "${name}": it reads src/data/impact.json, so its games depend on more than the simulator version` };
  return { problem: `the change ledger does not know the bot "${name}"` };
}

// ---------------------------------------------------------------- games and batches

export interface LedgerGame {
  seed: number;
  /** the opponent's list fingerprint */
  opp: string;
  /** who went first: 0 = the list under test */
  first: 0 | 1;
  /** the base list's score and the candidate's (0, 0.5, 1) */
  base: number;
  cand: number;
}
/** A game's identity: the same seed, opponent and first player is the same game. */
export const gameId = (g: Pick<LedgerGame, 'seed' | 'opp' | 'first'>): string => `${g.seed}:${g.opp}:${g.first}`;

/** The unit appended: one change's games of one kind from one run. */
export interface LedgerBatch {
  entry: EntryId;
  kind: BatchKind;
  /** the change in words (presentation only: the key is what identifies it) */
  label: string;
  run: string;
  /** YYYY-MM-DD */
  date: string;
  games: LedgerGame[];
}

/** Everything the ledger holds about one entry. */
export interface LedgerEntry {
  id: EntryId;
  key: string;
  /** the latest label it was recorded under */
  label: string;
  heldout: LedgerGame[];
  screen: LedgerGame[];
  /** games that arrived again with other scores (the earlier ones are kept) */
  conflicts: { heldout: number; screen: number };
  runs: string[];
  firstDate: string;
  lastDate: string;
}

interface EntryIndex {
  /** game id → scores, per kind */
  held: Record<BatchKind, Map<string, string>>;
}
const scoresOf = (g: LedgerGame) => `${g.base}/${g.cand}`;
const indexes = new WeakMap<LedgerEntry, EntryIndex>();
function indexOf(e: LedgerEntry): EntryIndex {
  let ix = indexes.get(e);
  if (!ix) {
    ix = { held: { heldout: new Map(), screen: new Map() } };
    for (const k of BATCH_KINDS) for (const g of e[k]) ix.held[k].set(gameId(g), scoresOf(g));
    indexes.set(e, ix);
  }
  return ix;
}

/**
 * What adding a batch did: the games it added, and the ones dropped as already held (same scores), in conflict, or
 * (held-out batches only) because the game had already screened this change.
 */
export interface AddResult {
  added: LedgerGame[];
  duplicates: number;
  conflicts: number;
  /** held-out games left out because they had screened this change before (never evidence for it) */
  screened: number;
}

/** Whether this game has already screened the entry's change (then it is never kept as held-out evidence for it). */
export function screenedBefore(e: LedgerEntry, g: Pick<LedgerGame, 'seed' | 'opp' | 'first'>): boolean {
  return indexOf(e).held.screen.has(gameId(g));
}

/**
 * Add one batch to its entry in `entries` (created when new). Games already held are dropped; a conflict is counted; a
 * held-out game that screened the change earlier is left out (the games that picked a change must not vouch for it).
 */
export function addBatch(entries: Map<string, LedgerEntry>, b: LedgerBatch): AddResult {
  const key = entryKey(b.entry);
  let e = entries.get(key);
  if (!e) {
    e = { id: { ...b.entry }, key, label: b.label, heldout: [], screen: [], conflicts: { heldout: 0, screen: 0 }, runs: [], firstDate: b.date, lastDate: b.date };
    entries.set(key, e);
  }
  const ix = indexOf(e);
  const held = ix.held[b.kind];
  const out: AddResult = { added: [], duplicates: 0, conflicts: 0, screened: 0 };
  for (const g of b.games) {
    const id = gameId(g);
    if (b.kind === 'heldout' && ix.held.screen.has(id)) {
      out.screened++;
      continue;
    }
    const had = held.get(id);
    if (had === undefined) {
      held.set(id, scoresOf(g));
      e[b.kind].push({ ...g });
      out.added.push(g);
    } else if (had === scoresOf(g)) out.duplicates++;
    else out.conflicts++;
  }
  e.conflicts[b.kind] += out.conflicts;
  if (b.games.length) {
    e.label = b.label;
    if (!e.runs.includes(b.run)) e.runs.push(b.run);
    if (b.date < e.firstDate) e.firstDate = b.date;
    if (b.date > e.lastDate) e.lastDate = b.date;
  }
  return out;
}

/** Merge batches into entries, each game once per entry and kind (in the order given: the earlier arrival is kept). */
export function mergeBatches(batches: Iterable<LedgerBatch>): Map<string, LedgerEntry> {
  const entries = new Map<string, LedgerEntry>();
  for (const b of batches) addBatch(entries, b);
  return entries;
}

/**
 * The one entry these batches make. Throws when they belong to more than one entry: games of another simulator version,
 * bot or field must never be pooled with these.
 */
export function pool(batches: readonly LedgerBatch[]): LedgerEntry {
  const first = batches[0];
  if (!first) throw new Error('pool() needs at least one batch');
  for (const b of batches) if (!sameEntry(b.entry, first.entry)) throw new Error(`pool() was handed batches of more than one entry (${entryKey(first.entry)} and ${entryKey(b.entry)}); games are never pooled across versions, bots or fields`);
  const e = mergeBatches(batches).get(entryKey(first.entry));
  if (!e) throw new Error('pool(): no entry');
  return e;
}

/** Game ids, for the games a confirmation may play (left out of the prior). */
export const gameIds = (games: Iterable<Pick<LedgerGame, 'seed' | 'opp' | 'first'>>): Set<string> => new Set([...games].map(gameId));

/**
 * The prior of an entry for one confirmation: its held-out games, leaving out every game whose id is in `leaveOut` (the
 * games this confirmation may play, and those that screened the change), as paired scores for confirmStaged.
 */
export function priorOf(entry: LedgerEntry | undefined, leaveOut: ReadonlySet<string> = new Set()): PairedScores {
  const games = priorGamesOf(entry, leaveOut);
  return { base: games.map((g) => g.base), cand: games.map((g) => g.cand) };
}

/** The games priorOf takes, in its order, with where each sat (the builders' per-opponent figures of a pooled nominee). */
export function priorGamesOf(entry: LedgerEntry | undefined, leaveOut: ReadonlySet<string> = new Set()): LedgerGame[] {
  return (entry?.heldout ?? []).filter((g) => !leaveOut.has(gameId(g)));
}

// ---------------------------------------------------------------- summaries and verdicts

export type { GroupSummary };
export interface PooledSummary extends GroupSummary {
  /** plain sample SD of the per-game difference */
  sd: number;
  /** per opponent (list fingerprint), most games first */
  byOpp: (GroupSummary & { opp: string })[];
  /** going first (0) and second (1) */
  bySeat: (GroupSummary & { first: 0 | 1 })[];
}

/**
 * The pooled paired summary of some games: count, mean gain, SD, SE, per opponent and per seat (plain, no guard). The
 * split is splitPaired's (src/lib/pairedSplit.ts), the one definition the builders' nominees use too.
 */
export function summarize(games: readonly LedgerGame[]): PooledSummary {
  const all = pairedGroup(games.map((g) => g.cand - g.base));
  return { ...all, ...splitPaired(games.map((g) => g.cand), games.map((g) => g.base), games) };
}

export type LedgerVerdict = 'adopt' | 'reject' | 'undecided';
export interface VerdictOptions {
  /** nominees in the decision it would be judged in (default 1) */
  nominees?: number;
  /** the bar in points (default the rule's card bar) */
  minGainPp?: number;
}

/**
 * The verdict the strict pooling rule would give an entry's held-out games now, under `rule`, with the interval it is
 * judged by (judgePooled: the guarded interval at the always-valid z, as confirmStaged judges a pooled look).
 */
export function ledgerVerdict(heldout: readonly LedgerGame[], rule: AdoptionRule, o: VerdictOptions = {}): { iv: PairedInterval; verdict: LedgerVerdict } {
  const { iv, verdict } = judgePooled(
    heldout.map((g) => g.cand),
    heldout.map((g) => g.base),
    { alpha: rule.alpha, nominees: o.nominees ?? 1, minGainPp: o.minGainPp ?? rule.minGainPp, minGames: rule.minGames },
  );
  return { iv, verdict: verdict === 'adopt' || verdict === 'reject' ? verdict : 'undecided' };
}

/**
 * How many pooled held-out games the lower bound would need to clear the bar if the mean and the (guarded) spread stayed
 * as they are now: the total, not the games still to play (at least rule.minGames). Infinity when the mean is not above
 * the bar or there are no games.
 */
export function gamesToSettle(heldout: readonly LedgerGame[], rule: AdoptionRule, o: VerdictOptions = {}): number {
  let sum = 0;
  let sq = 0;
  for (const g of heldout) {
    const d = g.cand - g.base;
    sum += d;
    sq += d * d;
  }
  return gamesToSettleSums(heldout.length, sum, sq, rule, o);
}

/** gamesToSettle from the count, Σd and Σd² of the held-out paired differences (the shortlist and its simulation keep sums). */
export function gamesToSettleSums(n: number, sum: number, sq: number, rule: AdoptionRule, o: VerdictOptions = {}): number {
  // the computation is evidence.ts's, which "until settled" (confirmStaged) shares
  return settleGamesFromSums(n, sum, sq, { alpha: rule.alpha, nominees: o.nominees ?? 1, minGainPp: o.minGainPp ?? rule.minGainPp, minGames: rule.minGames });
}

// ---------------------------------------------------------------- the stored form

/**
 * A batch as stored (one JSON line in the Node store, one element of an export): the entry spelled out, the opponents
 * once, the lowest seed once (`s0`), and each game as [seed − s0, opponent index, first, base score × 2, candidate
 * score × 2]: about 13 bytes a game, plus a header of a few hundred bytes a batch.
 */
export interface CompactBatch {
  v: 1;
  change: string;
  sim: number;
  bot: string;
  field: string;
  kind: BatchKind;
  label: string;
  run: string;
  date: string;
  opps: string[];
  s0: number;
  g: [number, number, 0 | 1, number, number][];
}

export function encodeBatch(b: LedgerBatch): CompactBatch {
  const opps: string[] = [];
  const at = new Map<string, number>();
  const s0 = b.games.reduce((m, x) => Math.min(m, x.seed), b.games[0]?.seed ?? 0);
  const g = b.games.map((x): [number, number, 0 | 1, number, number] => {
    let i = at.get(x.opp);
    if (i === undefined) {
      i = opps.length;
      opps.push(x.opp);
      at.set(x.opp, i);
    }
    return [x.seed - s0, i, x.first, Math.round(x.base * 2), Math.round(x.cand * 2)];
  });
  return { v: 1, change: b.entry.change, sim: b.entry.simVersion, bot: b.entry.bot, field: b.entry.field, kind: b.kind, label: b.label, run: b.run, date: b.date, opps, s0, g };
}

/** One batch as a line of the Node store. */
export const batchLine = (b: LedgerBatch): string => JSON.stringify(encodeBatch(b));

/** Limits on untrusted input. */
export const LEDGER_LIMITS = Object.freeze({ gamesPerBatch: 200_000, opps: 1_000, label: 500, run: 200, key: 4_000, batches: 100_000, text: 64_000_000 });
const FP_RE = /^[0-9a-f]{16}$/;
const BOT_RE = /^[a-z0-9-]{1,32}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isStr = (x: unknown, max: number): x is string => typeof x === 'string' && x.length <= max;

/** A stored batch back as a LedgerBatch, checked field by field (never throws: a problem in words instead). */
export function decodeBatch(x: unknown): { batch: LedgerBatch; problem?: undefined } | { batch?: undefined; problem: string } {
  const bad = (problem: string) => ({ problem });
  if (!isObj(x)) return bad('a batch is not an object');
  if (x.v !== 1) return bad(typeof x.v === 'number' && x.v > 1 ? `a batch uses a newer format (v ${x.v}) than this version reads` : 'a batch has no format version');
  if (!isStr(x.change, LEDGER_LIMITS.key) || !KEY_RE.test(x.change)) return bad('a batch has no valid change key');
  if (typeof x.sim !== 'number' || !Number.isInteger(x.sim) || x.sim < 1 || x.sim > 100_000) return bad('a batch has no valid simulator version');
  if (!isStr(x.bot, 32) || !BOT_RE.test(x.bot) || x.bot === 'hard-v1') return bad('a batch has no valid bot');
  if (!isStr(x.field, 16) || !FP_RE.test(x.field)) return bad('a batch has no valid field fingerprint');
  if (x.kind !== 'heldout' && x.kind !== 'screen') return bad('a batch kind must be heldout or screen');
  if (!isStr(x.label, LEDGER_LIMITS.label)) return bad('a batch label is missing or too long');
  if (!isStr(x.run, LEDGER_LIMITS.run)) return bad('a batch run id is missing or too long');
  if (!isStr(x.date, 10) || !DATE_RE.test(x.date)) return bad('a batch date is not YYYY-MM-DD');
  if (!Array.isArray(x.opps) || x.opps.length > LEDGER_LIMITS.opps || !x.opps.every((o) => isStr(o, 16) && FP_RE.test(o))) return bad('a batch has no valid opponent list');
  if (typeof x.s0 !== 'number' || !Number.isSafeInteger(x.s0) || x.s0 < 0) return bad('a batch has no valid first seed');
  if (!Array.isArray(x.g) || x.g.length > LEDGER_LIMITS.gamesPerBatch) return bad('a batch has no valid game list');
  const s0 = x.s0;
  const opps = x.opps as string[];
  const games: LedgerGame[] = [];
  const seen = new Set<string>();
  for (const t of x.g as unknown[]) {
    if (!Array.isArray(t) || t.length !== 5) return bad('a game is not [seed − s0, opponent, first, base, candidate]');
    const [ds, oi, first, b2, c2] = t as unknown[];
    if (typeof ds !== 'number' || !Number.isSafeInteger(ds) || ds < 0 || !Number.isSafeInteger(s0 + ds)) return bad('a game has no valid seed');
    const seed = s0 + ds;
    if (typeof oi !== 'number' || !Number.isInteger(oi) || oi < 0 || oi >= opps.length) return bad('a game names no listed opponent');
    if (first !== 0 && first !== 1) return bad('a game has no valid first player');
    if ((b2 !== 0 && b2 !== 1 && b2 !== 2) || (c2 !== 0 && c2 !== 1 && c2 !== 2)) return bad('a game score is not 0, 1 or 2 halves');
    const g: LedgerGame = { seed, opp: opps[oi] ?? '', first, base: b2 / 2, cand: c2 / 2 };
    const id = gameId(g);
    if (seen.has(id)) return bad(`a batch holds the game ${id} twice`);
    seen.add(id);
    games.push(g);
  }
  return { batch: { entry: { change: x.change, simVersion: x.sim, bot: x.bot, field: x.field }, kind: x.kind, label: x.label, run: x.run, date: x.date, games } };
}

/** One line of the Node store back as a batch (never throws). */
export function parseBatchLine(line: string): { batch: LedgerBatch; problem?: undefined } | { batch?: undefined; problem: string } {
  if (line.length > LEDGER_LIMITS.text) return { problem: 'the line is too long' };
  let x: unknown;
  try {
    x = JSON.parse(line);
  } catch {
    return { problem: 'the line is not JSON' };
  }
  return decodeBatch(x);
}

/** The export document (`kind: 'nct-change-ledger'`, schema 1): every batch as stored. */
export interface LedgerExport {
  kind: typeof LEDGER_KIND;
  schema: 1;
  exported: string;
  batches: CompactBatch[];
}
export function ledgerExport(batches: readonly LedgerBatch[], now = new Date()): LedgerExport {
  return { kind: LEDGER_KIND, schema: 1, exported: now.toISOString(), batches: batches.map(encodeBatch) };
}

/**
 * An export read back strictly (untrusted input: a string or parsed JSON). A newer schema, another kind, a bad batch or
 * a file over the limits is refused as a whole with the reason; it never throws.
 */
export function parseLedgerExport(input: unknown): { batches: LedgerBatch[]; problem?: undefined } | { batches?: undefined; problem: string } {
  let data = input;
  if (typeof input === 'string') {
    if (input.length > LEDGER_LIMITS.text) return { problem: 'This file is too large to be a change ledger.' };
    try {
      data = JSON.parse(input);
    } catch {
      return { problem: 'This is not a JSON file.' };
    }
  }
  if (!isObj(data) || data.kind !== LEDGER_KIND) return { problem: 'This is not a change ledger file.' };
  if (data.schema !== LEDGER_SCHEMA) return { problem: typeof data.schema === 'number' && data.schema > LEDGER_SCHEMA ? `This file uses a newer format (schema ${data.schema}) than this version reads.` : 'This change ledger file has no valid schema.' };
  if (!Array.isArray(data.batches)) return { problem: 'The file has no batch list.' };
  if (data.batches.length > LEDGER_LIMITS.batches) return { problem: `The file holds more than ${LEDGER_LIMITS.batches.toLocaleString('en-US')} batches.` };
  const batches: LedgerBatch[] = [];
  for (let i = 0; i < data.batches.length; i++) {
    const r = decodeBatch(data.batches[i]);
    if (!r.batch) return { problem: `Batch ${i + 1}: ${r.problem}.` };
    batches.push(r.batch);
  }
  return { batches };
}
