// Consistency check for the recorded data the site ships (read-only; writes nothing).
//
//   npm run check:data
//
// Checks:
//   - src/data/tournaments.json lists exactly the events in public/tournaments/event-N.json (same ids, no orphans either
//     way; each file's id matches its name; champion and game count match the file)
//   - public/data/h2h.json covers the recorded events: its event and game counts match them (the Deck Lab calls it
//     stale when it counts fewer events than the index), and its manifest, when it has one, names exactly those events;
//     events it lists as left out of its pool (`pool.excluded`, SIM-7: another sim version or bot) are subtracted first,
//     and each must be a recorded event outside the pooled version and bot (the same holds for ratings.json)
//   - every run manifest in those files (and src/data/ratings.json) has a known schema, and its deck ids are the
//     fingerprints of the deck lists stored next to it
//   - every event records its simVersion and a run manifest: an event without either fails (the data was restarted from
//     Season 1 on 2026-11-11, so nothing recorded predates them any more)
//   - an event with a setup (another format, or pairings set by hand: src/lib/eventFormats.ts) names exactly its stored
//     decks as entrants, is flagged `custom` exactly when it is not a standard event, and the index carries the same flag
//   - public/site-config.json (the owner's site config, src/lib/siteConfig.ts) reads without a problem, and the decks and
//     event it names exist
//   - public/data/package-effects.json (the paired package measurements the coach reads, src/ai/packageEffect.ts),
//     when it exists, reads as one (`packageEffectsProblems`)
//   - public/data/lift.json (the Play page's lift slice) is exactly the slice derived from public/data/synergies.json
//     (`liftSliceText` in src/ai/packageLift.ts) whenever the report exists; `npx tsx scripts/build-lift.ts` rebuilds it
//   - data/seasons/impact.json and deck-impact.json (the season breeder's pooled and per-list card impact,
//     src/lib/seasonImpact.ts and src/lib/seasonDeckImpact.ts), when they exist, are kept by simulator version and bot:
//     their kinds and schemas, one entry per simulator version and canonical bot name, finite sums, well-formed list
//     fingerprints and sources, each season counted once and under the same pair in both files, and under the pair its
//     season file's manifest names. An old shape (no simulator version or bot, or keyed by deck name) fails, as the
//     breeder refuses to read it; the failure names the migration
//   - src/data/impact.json (the coach's and the Deck Lab's card table) is the rebuild of the lists of the pair the season
//     breeder reads (scripts/breed-data.ts buildImpactData); `npx tsx scripts/build-impact.ts` rebuilds it
//   - the telemetry slices the site loads (public/data/decisions.json and decisions/, public/data/sells.json,
//     src/data/analysis/) are cut from reports/decisions-latest.json and src/data/analysis.json (src/lib/telemetrySlices.ts);
//     `npx tsx scripts/build-telemetry-slices.ts` rebuilds them
//   - data/ledger/*.jsonl (the change ledger, src/lib/changeLedger.ts), when the folder exists: every line is a readable
//     batch whose change starts from the file's list, no entry holds the same game twice (a game that came back with
//     other scores is counted as information, not a failure), and no held-out game had already screened its change
//   - public/data/evidence/ (the findings, docs/EVIDENCE.md) equals a rebuild from the tracked inputs (numbers within
//     2e-6), so a forgotten rebuild after new events, ratings, analysis, synergies, forge reports, re-measurements or
//     ledger games fails; on their own, the stored findings' ids and short ids are unique, every source exists, every
//     effect is paired with a ledger, forge-report or re-measurement source, every strength word is what the rule
//     gives, the short-id lookup (ids.json) matches the deck files, and the re-measurements (data/evidence/*.json)
//     read. `npm run evidence` rebuilds them
//   - src/data/outsideMeta.json (the outside picture, src/lib/outsideMeta.ts), when it exists: its kind and schema, every
//     day a YYYY-MM-DD date, links on the two sites only, shares and win rates between 0 and 100 (a field's shares at
//     most 100 together), and every trio's ids Legend cards of src/data/cards.json or kept as text and listed unmatched
//   - src/content/deckObjectives/noteSynergies.ts (the slim table of the deck notes' synergies the bots read) is what
//     the notes say, byte for byte; `npx tsx scripts/note-synergies.ts` rewrites it
//   - data/series/run-N.json (rating runs, docs/SERIES.md), when the folder exists: each file's id is "run-N" and unique,
//     its kind and schema, simVersion, bot and manifest (deck ids are the fingerprints of the stored lists, as for
//     events), a setup that is a bots-only match list with no byes or bracket, readable games; a stored list that is not
//     the library's current list of that deck (its games are left out of the pool) or a deck no longer in the library is
//     information. h2h.json and ratings.json count the pooled runs (`runs`), list them in their manifests, and count
//     only the games on the library's current lists (scripts/event-pool.ts currentListGate)
// Exits 1 when a check fails, 2 on a bad flag.
import fs from 'node:fs';
import path from 'node:path';
import { cli, EVENTS_DIR, eventFiles, loadLibrary, RATING_RUN_KIND, runFiles, SERIES_DIR } from './lib-node';
import { currentListGate, type GateDeck } from './event-pool';
import type { ListGate } from '../src/lib/ratingGames';
import { KNOWN_MANIFEST_SCHEMAS, storedDeckId, type RecordedEventInput, type RunManifest } from '../src/lib/runManifest';
import { deckFingerprint, listFingerprint } from '../src/engine/deck';
import { LIBRARY_DIRS } from '../src/lib/library';
import { entrantBase, isPlayedSetup, isStandardSetup, setupProblems, type EventSetup } from '../src/lib/eventFormats';
import { issueLine, parseSiteConfigText } from '../src/lib/siteConfig';
import { liftSlice, liftSliceText, readLiftSlice, type LiftSlice } from '../src/ai/packageLift';
import { packageEffectsProblems, type PackageEffectFile } from '../src/ai/packageEffect';
import type { SynergyReport } from '../src/analysis/synergies';
import { parseDeckImpact } from '../src/lib/seasonDeckImpact';
import { parseCardImpact, cardTotals } from '../src/lib/seasonImpact';
import { analysisKey, impactFileWords, impactFilesProblems, type AnalysisLike, type SeasonPair } from '../src/lib/breederImpact';
import { changeBase, entryKey, gameId, parseBatchLine } from '../src/lib/changeLedger';
import { evidenceCheck } from './build-evidence';
import { noteSynergiesCheck } from './note-synergies';
import { sliceProblems } from './build-telemetry-slices';
import { ANALYSIS_FILE, buildImpactData, CARD_IMPACT_FILE, DECK_IMPACT_FILE, IMPACT_DATA_FILE } from './breed-data';
import { outsideMetaProblems } from '../src/lib/outsideMeta';
import { CARD_BY_ID } from '../src/engine/cards';

type StoredDeck = RecordedEventInput['decks'][string];
interface EventMatch {
  a?: string;
  b: string | null;
  games: unknown[];
}
/** The parts of an event file the checks read. */
export interface CheckEvent {
  id: number | string;
  champion?: string | null;
  simVersion?: number;
  bot?: string;
  manifest?: unknown;
  decks: Record<string, StoredDeck>;
  rounds: { matches: EventMatch[] }[];
  bracket: { matches: EventMatch[] }[];
  /** how a non-plain event was arranged; absent on plain Swiss events */
  setup?: EventSetup;
  custom?: boolean;
  /** a rating run's kind and schema (absent on events) */
  kind?: unknown;
  schema?: unknown;
}
export interface CheckInput {
  /** src/data/tournaments.json (null when missing) */
  index: { events: { id: number | string; champion?: string | null; games?: number; custom?: boolean }[] } | null;
  /** public/tournaments/event-N.json, parsed, with their file names */
  events: { file: string; event: CheckEvent }[];
  /** public/data/h2h.json (null when missing) */
  h2h: { events: number; runs?: number; games: number; manifest?: unknown; pool?: PoolRecordLike } | null;
  /** src/data/ratings.json (null when missing): only its manifest, pool and run count are checked */
  ratings?: { manifest?: unknown; pool?: PoolRecordLike; runs?: number } | null;
  /** data/series/run-N.json (rating runs, docs/SERIES.md), parsed, with their file names (absent: none) */
  runs?: { file: string; event: CheckEvent }[];
  /** the library's decks, for the pools' list rule (absent: every game counts, as before the rule) */
  library?: readonly GateDeck[];
  /** public/site-config.json's text (null when missing; not checked when absent) */
  siteConfig?: string | null;
  /** the library's deck files (data/decks), for the decks the site config names */
  deckFiles?: readonly string[];
  /** public/data/synergies.json, parsed (null when missing; the lift slice is not checked when absent) */
  synergies?: unknown;
  /** public/data/lift.json's text (null when missing) */
  lift?: string | null;
  /** public/data/package-effects.json, parsed (null or absent when the file does not exist: not checked) */
  packageEffects?: unknown;
  /** data/seasons/deck-impact.json, parsed (null when missing; not checked when absent) */
  deckImpact?: unknown;
  /** data/seasons/impact.json, parsed (null when missing; not checked when absent) */
  cardImpact?: unknown;
  /**
   * src/data/impact.json's text (null when missing) and the rebuild it should equal (buildImpactData in
   * scripts/breed-data.ts: the lists of the pair the breeder reads); absent: not checked
   */
  impactData?: { stored: string | null; built: string; lists: number } | null;
  /** the telemetry slices against their rebuild (sliceProblems in scripts/build-telemetry-slices.ts; absent: not checked) */
  telemetrySlices?: { failures: string[]; passed: string[] } | null;
  /** each recorded season's round robin pair, from data/seasons/season-N.json (absent: not checked) */
  seasons?: SeasonPair[];
  /** data/ledger/*.jsonl, the change ledger's files with their text (null or absent when the folder does not exist) */
  ledger?: { file: string; text: string }[] | null;
  /** the evidence check's result (evidenceCheck in scripts/build-evidence.ts; absent: not checked) */
  evidence?: { failures: string[]; passed: string[] } | null;
  /** the slim table of the notes' synergies against the notes (noteSynergiesCheck in scripts/note-synergies.ts; absent: not checked) */
  noteSynergies?: { failures: string[]; passed: string[] } | null;
  /** src/data/outsideMeta.json, parsed (null or absent when the file does not exist: not checked) */
  outsideMeta?: unknown;
}
/** An aggregate file's `pool` field (scripts/event-pool.ts PoolRecord): the events it left out and why. */
interface PoolRecordLike {
  simVersion: number | null | 'all';
  bot: string | 'all';
  excluded: { id: number | string; simVersion: number | null; bot: string }[];
}
export interface CheckResult {
  failures: string[];
  /** checks that passed */
  passed: string[];
  /** information that is not a failure (legacy data, missing manifests) */
  info: string[];
  legacyEvents: number;
  manifestsChecked: number;
}

const EVENT_FILE_RE = /^event-(\d+)\.json$/;
const RUN_FILE_RE = /^run-(\d+)\.json$/;
const gamesOf = (e: CheckEvent) => [...e.rounds, ...e.bracket].reduce((a, r) => a + r.matches.reduce((b, m) => b + (m.b ? m.games.length : 0), 0), 0);
/** The games the pools count (scripts/lib-node.ts forEachGameOf with the list gate): byes out, both seats' lists current. */
const pooledGamesOf = (e: CheckEvent, gate: ListGate | null) =>
  gate
    ? [...e.rounds, ...e.bracket].reduce(
        (a, r) => a + r.matches.reduce((b, m) => b + (m.b && gate(entrantBase(e.setup, m.a ?? ''), e.decks[m.a ?? '']) && gate(entrantBase(e.setup, m.b), e.decks[m.b]) ? m.games.length : 0), 0),
        0,
      )
    : gamesOf(e);
const isRunEvent = (e: CheckEvent) => e.kind === RATING_RUN_KIND;

/**
 * Games recorded twice: two games with the same identity (simulator version, bot, both seats' list fingerprints in seat
 * order, the seed and who went first) are the same game, and a pool would count it twice. Events and rating runs together.
 */
export function duplicateGames(sources: readonly CheckEvent[]): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  const fp = new Map<object, string>();
  const lf = (d: StoredDeck) => {
    let x = fp.get(d);
    if (x === undefined) fp.set(d, (x = listFingerprint({ legends: [...d.legends], main: [...d.main] })));
    return x;
  };
  for (const e of sources)
    for (const part of [...e.rounds, ...e.bracket])
      for (const m of part.matches) {
        if (!m.b || !m.a) continue;
        const da = e.decks[m.a];
        const db = e.decks[m.b];
        if (!da || !db) continue;
        for (const g of m.games as { seed?: unknown; first?: unknown }[]) {
          const key = `${e.simVersion ?? '?'}|${e.bot ?? '?'}|${lf(da)}|${lf(db)}|${String(g.seed)}|${String(g.first)}`;
          const where = `${isRunEvent(e) ? 'rating run' : 'event'} ${e.id} (${m.a} vs ${m.b}, seed ${String(g.seed)})`;
          const prev = seen.get(key);
          if (prev) {
            if (out.length < 20) out.push(`the same game is recorded twice, in ${prev} and ${where}: a pool would count it twice`);
          } else seen.set(key, where);
        }
      }
  return out;
}
const listId = (d: StoredDeck) => deckFingerprint({ legends: d.legends, main: d.main, sideboard: d.sideboard ?? [] });

/** Shape and schema problems of one manifest (empty when it is readable). */
function manifestProblems(m: unknown, where: string): string[] {
  if (!m || typeof m !== 'object') return [`${where}: manifest is not an object`];
  const x = m as Partial<RunManifest>;
  if (!KNOWN_MANIFEST_SCHEMAS.includes(x.schema as number)) return [`${where}: manifest schema ${JSON.stringify(x.schema)} is not one this code reads (${KNOWN_MANIFEST_SCHEMAS.join(', ')})`];
  const out: string[] = [];
  if (typeof x.runId !== 'string' || !x.runId) out.push(`${where}: manifest has no runId`);
  if (!Array.isArray(x.decks) || x.decks.some((d) => !d || typeof d.id !== 'string' || typeof d.name !== 'string')) out.push(`${where}: manifest decks must be { id, name } records`);
  if (!x.field || !Array.isArray(x.field.deckIds)) out.push(`${where}: manifest field.deckIds is missing`);
  return out;
}

/** Inputs of an aggregate manifest (h2h, ratings) against the recorded events. */
function inputProblems(m: RunManifest, where: string, events: CheckEvent[]): string[] {
  const out: string[] = [];
  if (!m.inputs) return [`${where}: aggregate manifest has no inputs`];
  const want = events.map((e) => String(e.id));
  const got = m.inputs.events.map((e) => String(e.id));
  const missing = want.filter((id) => !got.includes(id));
  const extra = got.filter((id) => !want.includes(id));
  if (missing.length) out.push(`${where}: built without event(s) ${missing.join(', ')}`);
  if (extra.length) out.push(`${where}: built from event(s) no longer recorded: ${extra.join(', ')}`);
  const byId = new Map(events.map((e) => [String(e.id), e]));
  for (const inp of m.inputs.events) {
    const e = byId.get(String(inp.id));
    if (!e) continue;
    const sim = typeof e.simVersion === 'number' ? e.simVersion : null;
    const run = (e.manifest as RunManifest | undefined)?.runId ?? null;
    if (inp.simVersion !== sim) out.push(`${where}: event ${inp.id} is listed with sim version ${inp.simVersion}, the event has ${sim}`);
    if (inp.runId !== run) out.push(`${where}: event ${inp.id} is listed with run ${inp.runId}, the event has ${run}`);
    if (!!inp.custom !== !!e.custom) out.push(`${where}: event ${inp.id} is listed as ${inp.custom ? 'custom' : 'standard'}, the event is ${e.custom ? 'custom' : 'standard'}`);
  }
  const lists = new Set(events.flatMap((e) => Object.entries(e.decks).map(([name, d]) => `${name}\u0000${storedDeckId(d)}`)));
  for (const d of m.decks) if (!lists.has(`${d.name}\u0000${d.id}`)) out.push(`${where}: deck "${d.name}" ${d.id} is not a list stored in any recorded event`);
  return out;
}

/**
 * The recorded events an aggregate file pooled: every event except those its `pool` lists as left out. A listed event must
 * exist, carry the version and bot listed, and fall outside the pooled version and bot; every pooled one must fall inside.
 */
function pooledEvents(pool: PoolRecordLike | undefined, where: string, events: CheckEvent[], failures: string[]): CheckEvent[] {
  if (!pool) return events;
  const byId = new Map(events.map((e) => [String(e.id), e]));
  const out = new Set<string>();
  const ver = (e: CheckEvent) => (typeof e.simVersion === 'number' ? e.simVersion : null);
  const bot = (e: CheckEvent) => e.bot ?? '?';
  const inside = (e: CheckEvent) => (pool.simVersion === 'all' || ver(e) === pool.simVersion) && (pool.bot === 'all' || bot(e) === pool.bot);
  for (const x of pool.excluded ?? []) {
    const e = byId.get(String(x.id));
    if (!e) failures.push(`${where}: leaves out event ${x.id}, which is not recorded`);
    else if (ver(e) !== x.simVersion || bot(e) !== x.bot) failures.push(`${where}: leaves out event ${x.id} as sim v${x.simVersion} ${x.bot}, the event is sim v${ver(e)} ${bot(e)}`);
    else if (inside(e)) failures.push(`${where}: leaves out event ${x.id}, but it has the pooled sim version and bot`);
    out.add(String(x.id));
  }
  const kept = events.filter((e) => !out.has(String(e.id)));
  for (const e of kept) if (!inside(e)) failures.push(`${where}: pools event ${e.id} (sim v${ver(e)} ${bot(e)}) outside its sim v${pool.simVersion} ${pool.bot} pool`);
  return kept;
}

/** Problems with the owner's site config: every parser error, and decks or an event it names that do not exist. */
export function siteConfigProblems(text: string | null, deckFiles: readonly string[] | undefined, eventIds: readonly string[]): { failures: string[]; info: string[] } {
  if (text === null) return { failures: ['public/site-config.json is missing (the site would use its built-in defaults; restore it from git or the editor at #/admin)'], info: [] };
  const p = parseSiteConfigText(text);
  const failures = p.errors.map((e) => `site-config.json: ${issueLine(e)}`);
  const info = p.warnings.map((w) => `site-config.json: ${issueLine(w)}`);
  if (failures.length) return { failures, info };
  const c = p.config;
  if (deckFiles) {
    if (c.home.featuredDeck && !deckFiles.includes(c.home.featuredDeck)) failures.push(`site-config.json: home.featuredDeck: no library deck ${c.home.featuredDeck} (the recommendation would show)`);
    for (const f of c.decks.hidden) if (!deckFiles.includes(f)) failures.push(`site-config.json: decks.hidden: no library deck ${f}`);
  }
  if (c.home.featuredEvent && !eventIds.includes(c.home.featuredEvent)) failures.push(`site-config.json: home.featuredEvent: no recorded event ${c.home.featuredEvent}`);
  return { failures, info };
}

const REBUILD_LIFT = 'rebuild it with npx tsx scripts/build-lift.ts';
const REBUILD_IMPACT = 'rebuild it with npx tsx scripts/build-impact.ts';

/** How public/data/lift.json differs from the slice of the synergy report (empty when it is that slice, byte for byte). */
export function liftProblems(report: unknown, liftText: string | null): string[] {
  const r = report as SynergyReport | null;
  if (!r || r.kind !== 'synergy-report' || !Array.isArray(r.decks) || !Array.isArray(r.pooled)) return ['public/data/synergies.json is not a synergy report, so lift.json cannot be checked'];
  if (liftText === null) return [`public/data/lift.json is missing (the coach would word every package as unmeasured); ${REBUILD_LIFT}`];
  const want = liftSliceText(r);
  if (liftText === want) return [];
  let got: LiftSlice | null = null;
  try {
    got = readLiftSlice(JSON.parse(liftText));
  } catch {
    // not JSON: said below
  }
  if (!got) return [`public/data/lift.json is not a lift slice; ${REBUILD_LIFT}`];
  const exp = liftSlice(r);
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const diff: string[] = [];
  if (got.catalogueVersion !== exp.catalogueVersion) diff.push(`catalogue ${got.catalogueVersion}, the report's is ${exp.catalogueVersion}`);
  const keys = (a: object, b: object) => [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const pooled = keys(got.pooled, exp.pooled).filter((k) => !same(got.pooled[k], exp.pooled[k]));
  if (pooled.length) diff.push(`pooled row(s) differ: ${pooled.join(', ')}`);
  const lists = keys(got.lists, exp.lists);
  const missing = lists.filter((k) => !Object.hasOwn(got.lists, k));
  const extra = lists.filter((k) => !Object.hasOwn(exp.lists, k));
  const changed = lists.filter((k) => Object.hasOwn(got.lists, k) && Object.hasOwn(exp.lists, k) && !same(got.lists[k], exp.lists[k]));
  if (missing.length) diff.push(`${missing.length} list(s) missing (${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ', …' : ''})`);
  if (extra.length) diff.push(`${extra.length} list(s) the report does not measure (${extra.slice(0, 3).join(', ')}${extra.length > 3 ? ', …' : ''})`);
  if (changed.length) diff.push(`${changed.length} list(s) with other rows (${changed.slice(0, 3).join(', ')}${changed.length > 3 ? ', …' : ''})`);
  if (!diff.length) diff.push('same content, other bytes (key order or formatting)');
  return [`public/data/lift.json is stale against public/data/synergies.json: ${diff.join('; ')}; ${REBUILD_LIFT}`];
}

/**
 * The change ledger's files (src/lib/changeLedger.ts): every line is a readable batch whose change starts from the
 * file's list, and no entry holds the same game twice with the same scores (the store never writes that). A game that
 * came back with other scores is written once more on purpose (the earlier scores are kept): counted, not a failure.
 * A held-out game that an earlier line screened the same change on is a failure: the store never writes one, because
 * the games that picked a change must not vouch for it.
 */
export function ledgerFileProblems(files: readonly { file: string; text: string }[]): { problems: string[]; batches: number; games: number; conflicts: number } {
  const problems: string[] = [];
  let batches = 0;
  let games = 0;
  let conflicts = 0;
  for (const { file, text } of files) {
    const where = `data/ledger/${file}`;
    if (!/^[0-9a-f]{16}\.jsonl$/.test(file)) problems.push(`${where}: the file name is not a list fingerprint`);
    const seen = new Map<string, Map<string, string>>();
    text.split('\n').forEach((raw, i) => {
      const line = raw.replace(/\r$/, '');
      if (!line.trim()) return;
      const r = parseBatchLine(line);
      if (!r.batch) return void problems.push(`${where} line ${i + 1}: ${r.problem}`);
      const b = r.batch;
      if (changeBase(b.entry.change) !== file.slice(0, 16)) problems.push(`${where} line ${i + 1}: the change starts from another list (${changeBase(b.entry.change)})`);
      batches++;
      const k = `${entryKey(b.entry)}|${b.kind}`;
      let held = seen.get(k);
      if (!held) seen.set(k, (held = new Map()));
      const screenedSoFar = b.kind === 'heldout' ? seen.get(`${entryKey(b.entry)}|screen`) : undefined;
      for (const g of b.games) {
        const id = gameId(g);
        // the store never writes a held-out game that had screened the same change on an earlier line
        if (screenedSoFar?.has(id)) {
          problems.push(`${where} line ${i + 1}: the held-out game ${id} had already screened this change (such a game is never evidence for it)`);
          continue;
        }
        const sc = `${g.base}/${g.cand}`;
        const had = held.get(id);
        if (had === undefined) {
          held.set(id, sc);
          games++;
        } else if (had === sc) problems.push(`${where} line ${i + 1}: the game ${id} is already in this entry`);
        else conflicts++;
      }
    });
  }
  return { problems, batches, games, conflicts };
}

/** A recorded file's stored deck ids and run manifest (events and rating runs alike): the failures, and whether a manifest was read. */
function recordedManifestProblems(file: string, event: CheckEvent): { failures: string[]; manifest: boolean } {
  const failures: string[] = [];
  for (const [name, d] of Object.entries(event.decks))
    if (d.id !== undefined && d.id !== listId(d)) failures.push(`${file}: deck "${name}" has id ${d.id}, its stored list fingerprints as ${listId(d)}`);
  if (typeof event.simVersion !== 'number') failures.push(`${file}: no simVersion (every event since the 2026-11-11 baseline records one)`);
  if (event.manifest === undefined) {
    failures.push(`${file}: no run manifest (every event since the 2026-11-11 baseline records one)`);
    return { failures, manifest: false };
  }
  const p = manifestProblems(event.manifest, file);
  if (p.length) return { failures: [...failures, ...p], manifest: true };
  const m = event.manifest as RunManifest;
  if (typeof event.simVersion === 'number' && m.simVersion !== event.simVersion) failures.push(`${file}: manifest sim version ${m.simVersion}, the event says ${event.simVersion}`);
  const named = new Set(m.decks.map((d) => d.name));
  for (const rec of m.decks) {
    const stored = event.decks[rec.name];
    if (!stored) failures.push(`${file}: manifest deck "${rec.name}" has no stored list`);
    else if (listId(stored) !== rec.id) failures.push(`${file}: manifest deck "${rec.name}" has id ${rec.id}, its stored list fingerprints as ${listId(stored)}`);
  }
  for (const name of Object.keys(event.decks)) if (!named.has(name)) failures.push(`${file}: deck "${name}" is not in the manifest`);
  const ids = new Set(m.decks.map((d) => d.id));
  for (const id of m.field.deckIds) if (!ids.has(id)) failures.push(`${file}: manifest field deck ${id} is not one of its decks`);
  return { failures, manifest: true };
}

/**
 * The rating runs (data/series, docs/SERIES.md): ids, kind, schema, version, bot, manifest, a bots-only match list,
 * readable games; lists that are no longer the library's are information (their games are left out of the pools).
 */
export function runFileProblems(runs: readonly { file: string; event: CheckEvent }[], library: readonly GateDeck[] | undefined): { failures: string[]; info: string[]; manifests: number } {
  const failures: string[] = [];
  const info: string[] = [];
  let manifests = 0;
  const seen = new Set<string>();
  const current = new Map<string, Set<string>>();
  const lf = (d: { legends: readonly string[]; main: readonly string[] }) => listFingerprint({ legends: [...d.legends], main: [...d.main] });
  for (const d of library ?? []) current.set(d.deck.name, (current.get(d.deck.name) ?? new Set<string>()).add(lf(d.deck)));
  for (const { file, event: e } of runs) {
    const where = `${SERIES_DIR}/${file}`;
    const n = file.match(RUN_FILE_RE)?.[1];
    if (n === undefined) failures.push(`${where}: not a run file name (run-N.json)`);
    else if (e.id !== `run-${n}`) failures.push(`${where}: its id is ${JSON.stringify(e.id)}, the file name says "run-${n}"`);
    if (seen.has(String(e.id))) failures.push(`${where}: run id ${JSON.stringify(e.id)} is recorded twice`);
    seen.add(String(e.id));
    if (e.kind !== RATING_RUN_KIND) failures.push(`${where}: kind ${JSON.stringify(e.kind)}, a rating run's is "${RATING_RUN_KIND}"`);
    if (e.schema !== 1) failures.push(`${where}: schema ${JSON.stringify(e.schema)} is not one this code reads (1)`);
    if (typeof e.bot !== 'string' || !e.bot) failures.push(`${where}: no bot`);
    const m = recordedManifestProblems(where, e);
    failures.push(...m.failures);
    if (m.manifest) manifests++;
    if (!e.setup || e.setup.format !== 'matches' || !Array.isArray(e.setup.entrants)) failures.push(`${where}: a run's setup must be a match list (format "matches")`);
    else {
      if (isPlayedSetup(e.setup)) failures.push(`${where}: a run is played by bots only (its setup names seats run by people)`);
      const names = e.setup.entrants.map((x) => x.name).sort();
      if (names.join('\u0000') !== Object.keys(e.decks).sort().join('\u0000')) failures.push(`${where}: setup entrants are not the stored decks`);
    }
    if (!Array.isArray(e.rounds) || !Array.isArray(e.bracket)) failures.push(`${where}: no rounds or bracket arrays`);
    else {
      if (e.bracket.length) failures.push(`${where}: a run has no bracket`);
      let bad = 0;
      for (const r of e.rounds)
        for (const mm of r.matches) {
          if (!mm.b || !mm.a || !e.decks[mm.a] || !e.decks[mm.b]) bad++;
          for (const g of mm.games as { seed?: unknown; first?: unknown; winner?: unknown; turns?: unknown }[])
            if (!Number.isInteger(g.seed) || (g.first !== 0 && g.first !== 1) || (g.winner !== 0 && g.winner !== 1 && g.winner !== 'tie') || !Number.isInteger(g.turns)) bad++;
        }
      if (bad) failures.push(`${where}: ${bad} match(es) or game(s) unreadable (a bye, a deck with no stored list, or a game without seed, first, winner and turns)`);
    }
    if (library)
      for (const [name, d] of Object.entries(e.decks)) {
        const base = entrantBase(e.setup, name);
        const want = current.get(base);
        if (!want) info.push(`${where}: "${base}" is not a library deck (a retired list: its games still count)`);
        else if (!want.has(lf(d))) info.push(`${where}: "${base}" was played with a list that is no longer its current one: those games are left out of ratings and head-to-heads`);
      }
  }
  return { failures, info, manifests };
}

export function checkData(input: CheckInput): CheckResult {
  const failures: string[] = [];
  const passed: string[] = [];
  const info: string[] = [];
  let legacyEvents = 0;
  let manifestsChecked = 0;
  const events = input.events.map((x) => x.event);

  // ---- event files and their index
  for (const { file, event } of input.events) {
    const n = file.match(EVENT_FILE_RE)?.[1];
    if (n !== undefined && String(event.id) !== n) failures.push(`${file}: its id is ${JSON.stringify(event.id)}`);
  }
  const fileIds = input.events.map((x) => String(x.event.id));
  const dupFiles = fileIds.filter((id, i) => fileIds.indexOf(id) !== i);
  if (dupFiles.length) failures.push(`event id(s) recorded in more than one file: ${[...new Set(dupFiles)].join(', ')}`);
  if (!input.index) failures.push('src/data/tournaments.json is missing');
  else {
    const indexIds = input.index.events.map((e) => String(e.id));
    const dupIndex = indexIds.filter((id, i) => indexIds.indexOf(id) !== i);
    if (dupIndex.length) failures.push(`tournaments.json lists event(s) twice: ${[...new Set(dupIndex)].join(', ')}`);
    const noFile = indexIds.filter((id) => !fileIds.includes(id));
    const notIndexed = fileIds.filter((id) => !indexIds.includes(id));
    if (noFile.length) failures.push(`tournaments.json lists event(s) with no file in ${EVENTS_DIR}: ${noFile.join(', ')}`);
    if (notIndexed.length) failures.push(`event file(s) missing from tournaments.json: ${notIndexed.join(', ')}`);
    const byId = new Map(events.map((e) => [String(e.id), e]));
    let mismatched = 0;
    for (const row of input.index.events) {
      const e = byId.get(String(row.id));
      if (!e) continue;
      if (row.champion !== undefined && row.champion !== e.champion) (failures.push(`tournaments.json event ${row.id}: champion ${JSON.stringify(row.champion)}, the file says ${JSON.stringify(e.champion)}`), mismatched++);
      if (row.games !== undefined && row.games !== gamesOf(e)) (failures.push(`tournaments.json event ${row.id}: ${row.games} games, the file has ${gamesOf(e)}`), mismatched++);
      if (!!row.custom !== !!e.custom) (failures.push(`tournaments.json event ${row.id}: ${row.custom ? 'flagged' : 'not flagged'} custom, the file ${e.custom ? 'is' : "isn't"}`), mismatched++);
    }
    if (!noFile.length && !notIndexed.length && !dupIndex.length && !mismatched) passed.push(`index matches the event files (${indexIds.length} events)`);
  }

  // ---- rating runs (docs/SERIES.md)
  const runs = (input.runs ?? []).map((x) => x.event);
  if (input.runs?.length) {
    const r = runFileProblems(input.runs, input.library);
    failures.push(...r.failures);
    info.push(...r.info);
    manifestsChecked += r.manifests;
    if (!r.failures.length) passed.push(`${SERIES_DIR}/ reads (${input.runs.length} rating run(s), ${runs.reduce((a, e) => a + gamesOf(e), 0)} games)`);
  }
  const sources = [...events, ...runs];
  const dups = duplicateGames(sources);
  failures.push(...dups);
  if (!dups.length) passed.push(`no game is recorded twice (${sources.length} event(s) and run(s): same lists in seat order, seed and first player)`);
  const gate = input.library ? currentListGate(input.library) : null;

  // ---- head-to-heads cover the recorded events and rating runs
  if (!input.h2h) failures.push('public/data/h2h.json is missing (build it with npm run build-h2h)');
  else {
    const before = failures.length;
    const pooledAll = pooledEvents(input.h2h.pool, 'h2h.json', sources, failures);
    const pooled = pooledAll.filter((e) => !isRunEvent(e));
    const pooledRuns = pooledAll.length - pooled.length;
    const games = pooledAll.reduce((a, e) => a + pooledGamesOf(e, gate), 0);
    const left = sources.length - pooledAll.length;
    if (left) info.push(`h2h.json leaves out ${left} event(s) or run(s) of another sim version or bot (its pool: sim v${input.h2h.pool?.simVersion} ${input.h2h.pool?.bot})`);
    if (input.h2h.events !== pooled.length) failures.push(`h2h.json counts ${input.h2h.events} events, ${pooled.length} are recorded${left ? ' in its pool' : ''}${input.h2h.events < pooled.length ? ' (the Deck Lab shows it as stale)' : ''}`);
    if ((input.h2h.runs ?? 0) !== pooledRuns) failures.push(`h2h.json counts ${input.h2h.runs ?? 0} rating runs, ${pooledRuns} are recorded${left ? ' in its pool' : ''}`);
    if (input.h2h.games !== games) failures.push(`h2h.json counts ${input.h2h.games} games, the ${left ? 'pooled' : 'recorded'} events${runs.length ? ' and runs' : ''} have ${games}${gate ? ' on the current lists' : ''}`);
    if (input.h2h.manifest !== undefined) {
      const p = manifestProblems(input.h2h.manifest, 'h2h.json');
      manifestsChecked++;
      failures.push(...(p.length ? p : inputProblems(input.h2h.manifest as RunManifest, 'h2h.json', pooledAll)));
    } else info.push('h2h.json has no manifest (built before manifests)');
    if (failures.length === before) passed.push(`h2h.json covers the recorded events (${pooled.length} events, ${pooledRuns ? `${pooledRuns} rating run${pooledRuns === 1 ? '' : 's'}, ` : ''}${games} games${left ? `; ${left} left out` : ''})`);
  }
  if (input.ratings?.manifest !== undefined) {
    const p = manifestProblems(input.ratings.manifest, 'ratings.json');
    manifestsChecked++;
    const pooled = pooledEvents(input.ratings.pool, 'ratings.json', sources, failures);
    if (pooled.length < sources.length) info.push(`ratings.json leaves out ${sources.length - pooled.length} event(s) or run(s) of another sim version or bot`);
    const pooledRuns = pooled.filter(isRunEvent).length;
    if ((input.ratings.runs ?? 0) !== pooledRuns) failures.push(`ratings.json counts ${input.ratings.runs ?? 0} rating runs, ${pooledRuns} are recorded in its pool`);
    failures.push(...(p.length ? p : inputProblems(input.ratings.manifest as RunManifest, 'ratings.json', pooled)));
  } else if (input.ratings) info.push('ratings.json has no manifest (built before manifests)');

  // ---- event setups (formats and hand-arranged events) and the custom flag
  const beforeSetups = failures.length;
  let setups = 0;
  for (const { file, event } of input.events) {
    if (!event.setup) {
      if (event.custom) failures.push(`${file}: flagged custom but records no setup`);
      continue;
    }
    setups++;
    const s = event.setup;
    if (!s || typeof s !== 'object' || !Array.isArray(s.entrants)) {
      failures.push(`${file}: setup is malformed`);
      continue;
    }
    const names = s.entrants.map((x) => x.name).sort();
    const stored = Object.keys(event.decks).sort();
    if (names.join('\u0000') !== stored.join('\u0000')) failures.push(`${file}: setup entrants (${names.length}) are not the stored decks (${stored.length})`);
    for (const p of setupProblems(s)) failures.push(`${file}: setup: ${p}`);
    if (!!event.custom !== !isStandardSetup(s)) failures.push(`${file}: ${event.custom ? 'flagged custom but its setup is a standard Swiss event' : 'its setup is not a standard Swiss event but it is not flagged custom'}`);
  }
  if (setups && failures.length === beforeSetups) passed.push(`event setups and custom flags (${setups} arranged event(s))`);

  // ---- event manifests and stored deck ids
  const beforeEvents = failures.length;
  for (const { file, event } of input.events) {
    // since the fresh baseline (2026-11-11, ROADMAP §1) every recorded event carries both; one without is a failure
    const m = recordedManifestProblems(file, event);
    failures.push(...m.failures);
    if (m.manifest) manifestsChecked++;
    else legacyEvents++;
  }
  if (failures.length === beforeEvents) passed.push(`event manifests and stored deck ids (${manifestsChecked} manifest(s) checked in all files)`);

  // ---- the owner's site config
  if (input.siteConfig !== undefined) {
    const sc = siteConfigProblems(input.siteConfig, input.deckFiles, events.map((e) => String(e.id)));
    failures.push(...sc.failures);
    info.push(...sc.info);
    if (!sc.failures.length) passed.push('public/site-config.json reads as a valid site config');
  }

  // ---- the Play page's lift slice is the one derived from the synergy report
  if (input.synergies !== undefined && input.synergies !== null) {
    const p = liftProblems(input.synergies, input.lift ?? null);
    failures.push(...p);
    if (!p.length) {
      const s = liftSlice(input.synergies as SynergyReport);
      passed.push(`public/data/lift.json is the slice of the synergy report (${Object.keys(s.pooled).length} pooled rows, ${Object.keys(s.lists).length} lists)`);
    }
  } else if (input.synergies === null && typeof input.lift === 'string') info.push('public/data/lift.json has no synergy report beside it to be checked against');

  // ---- the paired package measurements the coach reads (scripts/package-effects.ts)
  if (input.packageEffects !== undefined && input.packageEffects !== null) {
    const p = packageEffectsProblems(input.packageEffects, 'public/data/package-effects.json');
    failures.push(...p);
    if (!p.length) passed.push(`public/data/package-effects.json reads (${(input.packageEffects as PackageEffectFile).rows.length} packages measured, ${(input.packageEffects as PackageEffectFile).skipped.length} not measurable)`);
  }

  // ---- the season breeder's card impact: pooled and per list, each kept by simulator version and bot
  const cardFile = input.cardImpact !== undefined && input.cardImpact !== null ? parseCardImpact(input.cardImpact) : null;
  if (cardFile && !cardFile.file) failures.push(`data/seasons/impact.json ${cardFile.problem}`);
  else if (cardFile?.file) {
    const f = cardFile.file;
    passed.push(`data/seasons/impact.json is kept by simulator version and bot (${impactFileWords(f, (i) => `${cardTotals(f.entries[i]!.cards).cards} cards`)})`);
  }
  const deckFile = input.deckImpact !== undefined && input.deckImpact !== null ? parseDeckImpact(input.deckImpact) : null;
  if (deckFile && !deckFile.file) failures.push(`data/seasons/deck-impact.json ${deckFile.problem}`);
  else if (deckFile?.file) {
    const f = deckFile.file;
    const fromName = f.entries.reduce((k, e) => k + Object.values(e.lists).filter((l) => l.keyedFrom === 'name').length, 0);
    const unmatched = f.entries.reduce((k, e) => k + Object.keys(e.unmatched ?? {}).length, 0);
    passed.push(
      `data/seasons/deck-impact.json is keyed by list fingerprint and kept by simulator version and bot (${impactFileWords(f, (i) => `${Object.keys(f.entries[i]!.lists).length} lists`)}${fromName ? `; ${fromName} lists migrated from names` : ''}${unmatched ? `; ${unmatched} old name(s) kept apart, unread` : ''})`,
    );
  }
  if (cardFile?.file && deckFile?.file) {
    const p = impactFilesProblems(cardFile.file, deckFile.file, input.seasons ?? []);
    failures.push(...p.map((x) => `data/seasons impact files: ${x}`));
    if (!p.length) passed.push(`data/seasons/impact.json and deck-impact.json count each season once, under the same simulator version and bot, and the one its season file names`);
  }

  // ---- the coach's and the Deck Lab's card table is the breeder's (REVIEW_2026-11-24 B.2)
  if (input.impactData) {
    const { stored, built, lists } = input.impactData;
    if (stored === null) failures.push(`src/data/impact.json is missing; ${REBUILD_IMPACT}`);
    else if (stored.trimEnd() !== built) failures.push(`src/data/impact.json is not the card table of the pair the breeder reads (data/seasons and src/data/analysis.json); ${REBUILD_IMPACT}`);
    else passed.push(`src/data/impact.json is the card table the breeder reads, per list (${lists} lists)`);
  }

  // ---- the slices of the telemetry reports the site loads are cut from the reports
  if (input.telemetrySlices) {
    failures.push(...input.telemetrySlices.failures);
    passed.push(...input.telemetrySlices.passed);
  }

  // ---- the change ledger reads line by line, each game once per entry
  if (input.ledger) {
    const r = ledgerFileProblems(input.ledger);
    failures.push(...r.problems);
    if (!r.problems.length) passed.push(`data/ledger/ reads (${input.ledger.length} list file(s), ${r.batches} batches, ${r.games} games, each once per entry)`);
    if (r.conflicts) info.push(`data/ledger/: ${r.conflicts} game(s) came back with other scores (the earlier ones are kept; see npm run ledger -- stats)`);
  }
  // ---- the evidence files are a rebuild of the tracked inputs
  if (input.evidence) {
    failures.push(...input.evidence.failures);
    passed.push(...input.evidence.passed);
  }
  // ---- the bots' slim table of the notes' synergies is what the notes say
  if (input.noteSynergies) {
    failures.push(...input.noteSynergies.failures);
    passed.push(...input.noteSynergies.passed);
  }
  // ---- the outside picture (another site's figures, kept apart from ours)
  if (input.outsideMeta !== undefined && input.outsideMeta !== null) {
    const isLegend = (id: string) => Object.prototype.hasOwnProperty.call(CARD_BY_ID, id) && CARD_BY_ID[id]!.type === 'Legend';
    const p = outsideMetaProblems(input.outsideMeta, isLegend);
    failures.push(...p.map((x) => `src/data/outsideMeta.json: ${x}`));
    if (!p.length) {
      const o = input.outsideMeta as { sources: unknown[]; updated: string; unmatched: string[] };
      passed.push(`src/data/outsideMeta.json reads (${o.sources.length} report(s), collected up to ${o.updated})`);
      if (o.unmatched.length) info.push(`src/data/outsideMeta.json: ${o.unmatched.length} Legend name(s) kept as text, matching no card: ${o.unmatched.join(', ')}`);
    }
  } else if (input.outsideMeta === null) info.push('src/data/outsideMeta.json is not in this checkout: the outside picture shows choom.gg only (docs/DECK_IMPORT.md "The outside meta")');
  return { failures, passed, info, legacyEvents, manifestsChecked };
}

/** src/data/impact.json against its rebuild (null when a season file cannot be read: their own checks say why). */
function impactDataCheck(root: string): CheckInput['impactData'] {
  const p = path.join(root, IMPACT_DATA_FILE);
  try {
    const b = buildImpactData(undefined, { cardFile: path.join(root, CARD_IMPACT_FILE), deckFile: path.join(root, DECK_IMPACT_FILE), analysisFile: path.join(root, ANALYSIS_FILE) });
    return { stored: fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null, built: b.text, lists: b.data.decks.length };
  } catch {
    return null;
  }
}

/** Read the recorded data from a checkout. */
export function loadCheckInput(root = '.'): CheckInput {
  const read = (f: string) => {
    const p = path.join(root, f);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  };
  const dir = path.join(root, EVENTS_DIR);
  return {
    index: read('src/data/tournaments.json'),
    events: eventFiles(dir).map((file) => ({ file, event: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as CheckEvent })),
    runs: runFiles(path.join(root, SERIES_DIR)).map((file) => ({ file, event: JSON.parse(fs.readFileSync(path.join(root, SERIES_DIR, file), 'utf8')) as CheckEvent })),
    library: loadLibrary(path.join(root, 'data/decks')),
    h2h: read('public/data/h2h.json'),
    ratings: read('src/data/ratings.json'),
    siteConfig: fs.existsSync(path.join(root, 'public/site-config.json')) ? fs.readFileSync(path.join(root, 'public/site-config.json'), 'utf8') : null,
    synergies: read('public/data/synergies.json'),
    lift: fs.existsSync(path.join(root, 'public/data/lift.json')) ? fs.readFileSync(path.join(root, 'public/data/lift.json'), 'utf8') : null,
    packageEffects: read('public/data/package-effects.json'),
    deckImpact: read('data/seasons/deck-impact.json'),
    cardImpact: read('data/seasons/impact.json'),
    impactData: impactDataCheck(root),
    telemetrySlices: sliceProblems(root),
    seasons: fs.existsSync(path.join(root, 'data/seasons'))
      ? fs
          .readdirSync(path.join(root, 'data/seasons'))
          .flatMap((f) => {
            const m = /^season-(\d+)\.json$/.exec(f);
            if (!m) return [];
            const s = read(`data/seasons/${f}`) as Pick<AnalysisLike, 'manifest'> | null;
            return [{ season: Number(m[1]), key: analysisKey({ manifest: s?.manifest ?? null }) }];
          })
          .sort((a, b) => a.season - b.season)
      : [],
    ledger: fs.existsSync(path.join(root, 'data/ledger'))
      ? fs
          .readdirSync(path.join(root, 'data/ledger'))
          .filter((f) => f.endsWith('.jsonl'))
          .sort()
          .map((file) => ({ file, text: fs.readFileSync(path.join(root, 'data/ledger', file), 'utf8') }))
      : null,
    evidence: evidenceCheck(root),
    noteSynergies: noteSynergiesCheck(root),
    outsideMeta: read('src/data/outsideMeta.json'),
    deckFiles: LIBRARY_DIRS.flatMap((d) => {
      const dir = path.join(root, 'data/decks', d);
      return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.txt')) : [];
    }),
  };
}

if (process.argv[1]?.endsWith('check-data.ts')) {
  cli(import.meta.url, {});
  const r = checkData(loadCheckInput());
  for (const n of r.passed) console.log(`  ok    ${n}`);
  for (const n of r.info) console.log(`  info  ${n}`);
  for (const f of r.failures) console.log(`  FAIL  ${f}`);
  console.log(r.failures.length ? `check:data failed: ${r.failures.length} problem(s)` : 'check:data passed');
  process.exitCode = r.failures.length ? 1 : 0;
}
