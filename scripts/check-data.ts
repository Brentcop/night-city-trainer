// Consistency check for the recorded data the site ships (read-only; writes nothing).
//
//   npm run check:data
//
// Checks:
//   - src/data/tournaments.json lists exactly the events in public/tournaments/event-N.json (same ids, no orphans either
//     way; each file's id matches its name; champion and game count match the file)
//   - public/data/h2h.json covers the recorded events: its event and game counts match them (the Deck Lab calls it
//     stale when it counts fewer events than the index), and its manifest, when it has one, names exactly those events
//   - every run manifest in those files (and src/data/ratings.json) has a known schema, and its deck ids are the
//     fingerprints of the deck lists stored next to it
// Events without a manifest are legacy (recorded before manifests) and are counted, not failed.
// Exits 1 when a check fails, 2 on a bad flag.
import fs from 'node:fs';
import path from 'node:path';
import { cli, EVENTS_DIR, eventFiles } from './lib-node';
import { KNOWN_MANIFEST_SCHEMAS, storedDeckId, type RecordedEventInput, type RunManifest } from '../src/lib/runManifest';
import { deckFingerprint } from '../src/engine/deck';

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
  manifest?: unknown;
  decks: Record<string, StoredDeck>;
  rounds: { matches: EventMatch[] }[];
  bracket: { matches: EventMatch[] }[];
}
export interface CheckInput {
  /** src/data/tournaments.json (null when missing) */
  index: { events: { id: number | string; champion?: string | null; games?: number }[] } | null;
  /** public/tournaments/event-N.json, parsed, with their file names */
  events: { file: string; event: CheckEvent }[];
  /** public/data/h2h.json (null when missing) */
  h2h: { events: number; games: number; manifest?: unknown } | null;
  /** src/data/ratings.json (null when missing): only its manifest is checked */
  ratings?: { manifest?: unknown } | null;
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
  }
  const lists = new Set(events.flatMap((e) => Object.entries(e.decks).map(([name, d]) => `${name}\u0000${storedDeckId(d)}`)));
  for (const d of m.decks) if (!lists.has(`${d.name}\u0000${d.id}`)) out.push(`${where}: deck "${d.name}" ${d.id} is not a list stored in any recorded event`);
  return out;
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
    }
    if (!noFile.length && !notIndexed.length && !dupIndex.length && !mismatched) passed.push(`index matches the event files (${indexIds.length} events)`);
  }

  // ---- head-to-heads cover the recorded events
  if (!input.h2h) failures.push('public/data/h2h.json is missing (build it with npm run build-h2h)');
  else {
    const games = events.reduce((a, e) => a + gamesOf(e), 0);
    const before = failures.length;
    if (input.h2h.events !== events.length) failures.push(`h2h.json counts ${input.h2h.events} events, ${events.length} are recorded${input.h2h.events < events.length ? ' (the Deck Lab shows it as stale)' : ''}`);
    if (input.h2h.games !== games) failures.push(`h2h.json counts ${input.h2h.games} games, the recorded events have ${games}`);
    if (input.h2h.manifest !== undefined) {
      const p = manifestProblems(input.h2h.manifest, 'h2h.json');
      manifestsChecked++;
      failures.push(...(p.length ? p : inputProblems(input.h2h.manifest as RunManifest, 'h2h.json', events)));
    } else info.push('h2h.json has no manifest (built before manifests)');
    if (failures.length === before) passed.push(`h2h.json covers the recorded events (${events.length} events, ${games} games)`);
  }
  if (input.ratings?.manifest !== undefined) {
    const p = manifestProblems(input.ratings.manifest, 'ratings.json');
    manifestsChecked++;
    failures.push(...(p.length ? p : inputProblems(input.ratings.manifest as RunManifest, 'ratings.json', events)));
  } else if (input.ratings) info.push('ratings.json has no manifest (built before manifests)');

  // ---- event manifests and stored deck ids
  const beforeEvents = failures.length;
  for (const { file, event } of input.events) {
    for (const [name, d] of Object.entries(event.decks))
      if (d.id !== undefined && d.id !== listId(d)) failures.push(`${file}: deck "${name}" has id ${d.id}, its stored list fingerprints as ${listId(d)}`);
    if (event.manifest === undefined) {
      legacyEvents++;
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
  if (legacyEvents) info.push(`${legacyEvents} legacy event(s) without a manifest (recorded before manifests; not checked)`);
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
