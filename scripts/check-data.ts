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
//   - public/data/lift.json (the Play page's lift slice) is exactly the slice derived from public/data/synergies.json
//     (`liftSliceText` in src/ai/packageLift.ts) whenever the report exists; `npx tsx scripts/build-lift.ts` rebuilds it
// Exits 1 when a check fails, 2 on a bad flag.
import fs from 'node:fs';
import path from 'node:path';
import { cli, EVENTS_DIR, eventFiles } from './lib-node';
import { KNOWN_MANIFEST_SCHEMAS, storedDeckId, type RecordedEventInput, type RunManifest } from '../src/lib/runManifest';
import { deckFingerprint } from '../src/engine/deck';
import { LIBRARY_DIRS } from '../src/lib/library';
import { isStandardSetup, setupProblems, type EventSetup } from '../src/lib/eventFormats';
import { issueLine, parseSiteConfigText } from '../src/lib/siteConfig';
import { liftSlice, liftSliceText, readLiftSlice, type LiftSlice } from '../src/ai/packageLift';
import type { SynergyReport } from '../src/analysis/synergies';

type StoredDeck = RecordedEventInput['decks'][string];
interface EventMatch {
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
}
export interface CheckInput {
  /** src/data/tournaments.json (null when missing) */
  index: { events: { id: number | string; champion?: string | null; games?: number; custom?: boolean }[] } | null;
  /** public/tournaments/event-N.json, parsed, with their file names */
  events: { file: string; event: CheckEvent }[];
  /** public/data/h2h.json (null when missing) */
  h2h: { events: number; games: number; manifest?: unknown; pool?: PoolRecordLike } | null;
  /** src/data/ratings.json (null when missing): only its manifest and pool are checked */
  ratings?: { manifest?: unknown; pool?: PoolRecordLike } | null;
  /** public/site-config.json's text (null when missing; not checked when absent) */
  siteConfig?: string | null;
  /** the library's deck files (data/decks), for the decks the site config names */
  deckFiles?: readonly string[];
  /** public/data/synergies.json, parsed (null when missing; the lift slice is not checked when absent) */
  synergies?: unknown;
  /** public/data/lift.json's text (null when missing) */
  lift?: string | null;
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
const gamesOf = (e: CheckEvent) => [...e.rounds, ...e.bracket].reduce((a, r) => a + r.matches.reduce((b, m) => b + (m.b ? m.games.length : 0), 0), 0);
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

  // ---- head-to-heads cover the recorded events
  if (!input.h2h) failures.push('public/data/h2h.json is missing (build it with npm run build-h2h)');
  else {
    const before = failures.length;
    const pooled = pooledEvents(input.h2h.pool, 'h2h.json', events, failures);
    const games = pooled.reduce((a, e) => a + gamesOf(e), 0);
    const left = events.length - pooled.length;
    if (left) info.push(`h2h.json leaves out ${left} event(s) of another sim version or bot (its pool: sim v${input.h2h.pool?.simVersion} ${input.h2h.pool?.bot})`);
    if (input.h2h.events !== pooled.length) failures.push(`h2h.json counts ${input.h2h.events} events, ${pooled.length} are recorded${left ? ' in its pool' : ''}${input.h2h.events < pooled.length ? ' (the Deck Lab shows it as stale)' : ''}`);
    if (input.h2h.games !== games) failures.push(`h2h.json counts ${input.h2h.games} games, the ${left ? 'pooled' : 'recorded'} events have ${games}`);
    if (input.h2h.manifest !== undefined) {
      const p = manifestProblems(input.h2h.manifest, 'h2h.json');
      manifestsChecked++;
      failures.push(...(p.length ? p : inputProblems(input.h2h.manifest as RunManifest, 'h2h.json', pooled)));
    } else info.push('h2h.json has no manifest (built before manifests)');
    if (failures.length === before) passed.push(`h2h.json covers the recorded events (${pooled.length} events, ${games} games${left ? `; ${left} left out` : ''})`);
  }
  if (input.ratings?.manifest !== undefined) {
    const p = manifestProblems(input.ratings.manifest, 'ratings.json');
    manifestsChecked++;
    const pooled = pooledEvents(input.ratings.pool, 'ratings.json', events, failures);
    if (pooled.length < events.length) info.push(`ratings.json leaves out ${events.length - pooled.length} event(s) of another sim version or bot`);
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
    for (const [name, d] of Object.entries(event.decks))
      if (d.id !== undefined && d.id !== listId(d)) failures.push(`${file}: deck "${name}" has id ${d.id}, its stored list fingerprints as ${listId(d)}`);
    // since the fresh baseline (2026-11-11, ROADMAP §1) every recorded event carries both; one without is a failure
    if (typeof event.simVersion !== 'number') failures.push(`${file}: no simVersion (every event since the 2026-11-11 baseline records one)`);
    if (event.manifest === undefined) {
      legacyEvents++;
      failures.push(`${file}: no run manifest (every event since the 2026-11-11 baseline records one)`);
      continue;
    }
    manifestsChecked++;
    const p = manifestProblems(event.manifest, file);
    if (p.length) {
      failures.push(...p);
      continue;
    }
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
  return { failures, passed, info, legacyEvents, manifestsChecked };
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
    h2h: read('public/data/h2h.json'),
    ratings: read('src/data/ratings.json'),
    siteConfig: fs.existsSync(path.join(root, 'public/site-config.json')) ? fs.readFileSync(path.join(root, 'public/site-config.json'), 'utf8') : null,
    synergies: read('public/data/synergies.json'),
    lift: fs.existsSync(path.join(root, 'public/data/lift.json')) ? fs.readFileSync(path.join(root, 'public/data/lift.json'), 'utf8') : null,
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
