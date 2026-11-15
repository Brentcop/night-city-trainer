// Evidence files (docs/EVIDENCE.md): every number the site reports about a deck as a finding, written for the evidence
// pages to fetch lazily: public/data/evidence/index.json and one public/data/evidence/<listId>.json per library deck.
//
//   npm run evidence [-- --out DIR] [--ledger-dir DIR] [--adjusted FILE] [--check] [--matchup-check]
//
//   --out DIR          write the files here instead of public/data/evidence
//   --ledger-dir DIR   the change ledger to read (default data/ledger)
//   --adjusted FILE    the adjusted card impact (impact-adjusted-latest.json from npm run sim -- analyze --impact-adjusted
//                      --out DIR): card associations get the adjusted, shrunk estimate beside the plain one
//   --check            write nothing: compare what would be written with what is stored (numbers within 2e-6), exit 1 on
//                      a difference
//   --matchup-check    write nothing: print the leave-one-event-out check of the matchup interval
//
// Reads tracked files only: src/data/ratings.json, public/data/h2h.json, src/data/analysis.json, public/data/synergies.json,
// the recorded events (public/tournaments), the forge reports (reports/forge/*.json), the re-measurements
// (data/evidence/*.json), the change ledger, the library (data/decks) and its older lists (data/decks/custom/history).
// A derived-data builder like scripts/build-h2h.ts: it overwrites its own output, and an unchanged rebuild leaves every
// file byte-identical (no build time is written; the manifest is derived from the input events). Run by
// `npm run refresh` (last) and after every recorded tournament; `npm run check:data` fails when the stored files differ
// from a rebuild. Exits 1 when a check fails or an input is unreadable, 2 on a bad flag.
import fs from 'node:fs';
import path from 'node:path';
import { bool, cli, EVENTS_DIR, loadLibrary, readEvents, str, writeIfChanged } from './lib-node';
import { readLedgerDir } from './ledger-store';
import { buildEvidence, eventMatches, matchupCheck, pairSpread, PAIRED_METHODS, type AdjustedFile, type BuiltEvidence, type EvidenceInputs, type ForgeReport } from './evidence-build';
import { selectEvents } from './event-pool';
import { parseDeck } from '../src/engine/deck';
import { CATALOGUE_VERSION } from '../src/content/synergies';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import { idProblems, strengthOf, type DeckEvidence, type EvidenceIds, type EvidenceIndex, type Finding } from '../src/lib/findings';
import { parseRemeasureFile } from '../src/lib/remeasure';

export const EVIDENCE_DIR = 'public/data/evidence';
export const LEDGER_DIR = 'data/ledger';
export const REMEASURE_DIR = 'data/evidence';
const FORGE_DIR = 'reports/forge';
const HISTORY_DIR = 'data/decks/custom/history';
const REBUILD = 'npm run evidence';

/** A path as the files record it: relative to the root with forward slashes when inside it, else as given. */
function shown(root: string, p: string): string {
  const abs = path.resolve(root, p);
  const rel = path.relative(path.resolve(root), abs);
  return (!rel.startsWith('..') && !path.isAbsolute(rel) ? rel : abs).split(path.sep).join('/');
}

const readJson = (file: string): unknown => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

/** Every input the builder reads, from a checkout (`root`), with any problem that stops a build. */
export function loadEvidenceInputs(root = '.', o: { ledgerDir?: string; adjusted?: string | null; eventsDir?: string; h2h?: string } = {}): { inputs: EvidenceInputs; problems: string[] } {
  const at = (p: string) => path.join(root, p);
  const problems: string[] = [];
  const ledgerDir = o.ledgerDir ?? LEDGER_DIR;
  const ledger = readLedgerDir(path.resolve(root, ledgerDir));
  for (const f of ledger.files) for (const p of f.problems) problems.push(`${shown(root, ledgerDir)}/${f.file}: ${p}`);
  const remeasure: EvidenceInputs['remeasure'] = [];
  if (fs.existsSync(at(REMEASURE_DIR)))
    for (const f of fs.readdirSync(at(REMEASURE_DIR)).filter((x) => x.endsWith('.json')).sort()) {
      const file = `${REMEASURE_DIR}/${f}`;
      let raw: unknown;
      try {
        raw = JSON.parse(fs.readFileSync(at(file), 'utf8'));
      } catch {
        problems.push(`${file}: not JSON`);
        continue;
      }
      const r = parseRemeasureFile(raw, file);
      if (r.file) remeasure.push({ file, data: r.file });
      else problems.push(...r.problems);
    }
  const forge = fs.existsSync(at(FORGE_DIR))
    ? fs
        .readdirSync(at(FORGE_DIR))
        .filter((x) => x.endsWith('.json'))
        .sort()
        .map((f) => ({ file: `${FORGE_DIR}/${f}`, report: JSON.parse(fs.readFileSync(at(`${FORGE_DIR}/${f}`), 'utf8')) as ForgeReport }))
        .filter((x) => x.report && Array.isArray(x.report.gens) && x.report.manifest)
    : [];
  const history = fs.existsSync(at(HISTORY_DIR))
    ? fs
        .readdirSync(at(HISTORY_DIR))
        .filter((x) => x.endsWith('.txt'))
        .sort()
        .map((f) => parseDeck(fs.readFileSync(at(`${HISTORY_DIR}/${f}`), 'utf8'), f.replace(/\.txt$/, '')).deck)
    : [];
  let adjusted: EvidenceInputs['adjusted'] = null;
  if (o.adjusted) {
    const data = readJson(path.resolve(root, o.adjusted)) as AdjustedFile | null;
    if (!data || data.kind !== 'impact-adjusted' || !Array.isArray(data.decks)) problems.push(`${o.adjusted}: not an adjusted card impact file (kind "impact-adjusted")`);
    else adjusted = { file: shown(root, o.adjusted), data };
  }
  const inputs: EvidenceInputs = {
    library: loadLibrary(at('data/decks')).map((d) => ({ file: d.file, deck: d.deck })),
    history,
    events: readEvents(at(o.eventsDir ?? EVENTS_DIR)),
    ratings: readJson(at('src/data/ratings.json')) as EvidenceInputs['ratings'],
    h2h: readJson(at(o.h2h ?? 'public/data/h2h.json')) as EvidenceInputs['h2h'],
    analysis: readJson(at('src/data/analysis.json')) as EvidenceInputs['analysis'],
    synergies: readJson(at('public/data/synergies.json')) as EvidenceInputs['synergies'],
    catalogueVersion: CATALOGUE_VERSION,
    ledger: ledger.files.map((f) => ({ file: f.file, batches: f.batches.map((b) => b.batch) })),
    forge,
    remeasure,
    adjusted,
    paths: { ratings: 'src/data/ratings.json', h2h: shown(root, o.h2h ?? 'public/data/h2h.json'), analysis: 'src/data/analysis.json', synergies: 'public/data/synergies.json', events: shown(root, o.eventsDir ?? EVENTS_DIR), ledgerDir: shown(root, ledgerDir) },
    simVersion: CURRENT_SIM_VERSION,
  };
  return { inputs, problems };
}

/** The files a build writes: path inside the evidence directory → text. */
export function evidenceTexts(b: BuiltEvidence): Map<string, string> {
  const out = new Map<string, string>();
  out.set('index.json', `${JSON.stringify(b.index)}\n`);
  out.set('ids.json', `${JSON.stringify(b.ids)}\n`);
  for (const d of b.decks) out.set(`${d.listId}.json`, `${JSON.stringify(d)}\n`);
  for (const r of b.runs) out.set(`${r.listId}.runs.json`, `${JSON.stringify(r)}\n`);
  return out;
}

const OWN_FILE = /^(index|ids|[0-9a-f]{16}(\.runs)?)\.json$/;

/** Write a build into `dir`: changed files only; a deck file no longer built (a list that changed) is removed. */
export function writeEvidence(dir: string, b: BuiltEvidence): { written: number; removed: number } {
  fs.mkdirSync(dir, { recursive: true });
  const texts = evidenceTexts(b);
  let written = 0;
  for (const [f, t] of texts) if (writeIfChanged(path.join(dir, f), t)) written++;
  let removed = 0;
  for (const f of fs.readdirSync(dir))
    if (OWN_FILE.test(f) && !texts.has(f)) {
      fs.unlinkSync(path.join(dir, f));
      removed++;
    }
  return { written, removed };
}

/** Where two parsed values differ: structure exactly, numbers within `tol` (at most `max` lines). */
export function jsonDifferences(a: unknown, b: unknown, where = '', tol = 2e-6, max = 20): string[] {
  const out: string[] = [];
  const walk = (x: unknown, y: unknown, p: string) => {
    if (out.length >= max) return;
    if (typeof x === 'number' && typeof y === 'number') {
      if (!(Math.abs(x - y) <= tol) && !(Number.isNaN(x) && Number.isNaN(y))) out.push(`${p}: ${y} stored, ${x} rebuilt`);
      return;
    }
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) out.push(`${p}: ${y.length} items stored, ${x.length} rebuilt`);
      for (let i = 0; i < Math.min(x.length, y.length); i++) walk(x[i], y[i], `${p}[${i}]`);
      return;
    }
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) {
      const kx = Object.keys(x);
      const ky = Object.keys(y);
      for (const k of kx) if (!ky.includes(k)) out.push(`${p}.${k}: missing in the stored file`);
      for (const k of ky) if (!kx.includes(k)) out.push(`${p}.${k}: not in the rebuild`);
      for (const k of kx) if (ky.includes(k)) walk((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k], `${p}.${k}`);
      return;
    }
    if (x !== y) out.push(`${p}: ${JSON.stringify(y)?.slice(0, 80)} stored, ${JSON.stringify(x)?.slice(0, 80)} rebuilt`);
  };
  walk(a, b, where);
  return out;
}

/** How the files in `dir` differ from a build (empty when they match). */
export function compareEvidence(dir: string, b: BuiltEvidence): string[] {
  const out: string[] = [];
  const texts = evidenceTexts(b);
  for (const [f, t] of texts) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) {
      out.push(`${f} is missing`);
      continue;
    }
    const stored = fs.readFileSync(p, 'utf8');
    if (stored === t) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(stored);
    } catch {
      out.push(`${f} is not JSON`);
      continue;
    }
    out.push(...jsonDifferences(JSON.parse(t), parsed, f));
  }
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (OWN_FILE.test(f) && !texts.has(f)) out.push(`${f} is not built any more (a list changed or a deck left the library)`);
  return out;
}

// ---------------------------------------------------------------- checks of the stored files (check:data)

const PATH_RE = /^[A-Za-z_$][\w$]*(\[\d+\]|\.[A-Za-z_$][\w$]*)*$/;
/** A JSON path ("decks[3].wrField") resolved in a parsed file (undefined when it does not resolve). */
export function resolvePath(data: unknown, p: string): unknown {
  let cur: unknown = data;
  for (const m of p.matchAll(/([A-Za-z_$][\w$]*)|\[(\d+)\]/g)) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = m[1] !== undefined ? (cur as Record<string, unknown>)[m[1]] : (cur as unknown[])[Number(m[2])];
  }
  return cur;
}

/** Where an effect's numbers may come from: the ledger, a recorded forge report, a re-measurement. */
const EFFECT_SOURCE = (file: string, ledgerDir: string) => file.startsWith(`${ledgerDir}/`) || file.startsWith(`${FORGE_DIR}/`) || file.startsWith(`${REMEASURE_DIR}/`);

/** Problems with stored evidence files on their own: ids, sources, effects, strength words. */
export function storedProblems(root: string, decks: readonly DeckEvidence[], ledgerDir = LEDGER_DIR, current = CURRENT_SIM_VERSION, ids?: EvidenceIds | null): string[] {
  const out: string[] = [];
  const all: Finding[] = decks.flatMap((d) => d.findings);
  out.push(...idProblems(all));
  // the short-id lookup holds every deck file's short ids, in its order, and nothing else
  if (ids !== undefined) {
    if (!ids || ids.kind !== 'nct-evidence-ids' || !ids.decks) out.push('ids.json is missing or not a short-id lookup');
    else {
      for (const d of decks) if (ids.decks[d.listId] !== d.findings.map((f) => f.short).join('')) out.push(`ids.json: the short ids of ${d.listId} are not those of its deck file`);
      for (const listId of Object.keys(ids.decks)) if (!decks.some((d) => d.listId === listId)) out.push(`ids.json: ${listId} has no deck file`);
    }
  }
  const cache = new Map<string, unknown>();
  const load = (file: string) => {
    if (!cache.has(file)) cache.set(file, readJson(path.join(root, file)));
    return cache.get(file);
  };
  for (const f of all) {
    const where = `${f.subject.listId}.json ${f.short} (${f.kind})`;
    for (const s of f.sources) {
      if (!fs.existsSync(path.join(root, s.file))) out.push(`${where}: source ${s.file} does not exist`);
      else if (s.file.endsWith('.json') && PATH_RE.test(s.path) && resolvePath(load(s.file), s.path) === undefined) out.push(`${where}: source ${s.file} has no ${s.path}`);
    }
    if (f.nature === 'effect') {
      if (!PAIRED_METHODS.includes(f.method)) out.push(`${where}: an effect with the method ${f.method}, not a paired one`);
      if (!f.sources.some((s) => EFFECT_SOURCE(s.file, ledgerDir))) out.push(`${where}: an effect with no ledger, forge report or re-measurement source`);
    }
    const s = strengthOf(f, current);
    if (s !== f.strength) out.push(`${where}: stored strength ${f.strength}, the rule gives ${s}`);
    if ((f.simVersion !== current) !== f.flags.includes('stale')) out.push(`${where}: the stale flag does not match its simulator version ${f.simVersion}`);
  }
  return out;
}

/** The stored files read back (null when the directory or index is missing). */
export function readStored(dir: string): { index: EvidenceIndex; decks: DeckEvidence[]; ids: EvidenceIds | null } | null {
  const idx = path.join(dir, 'index.json');
  if (!fs.existsSync(idx)) return null;
  const index = JSON.parse(fs.readFileSync(idx, 'utf8')) as EvidenceIndex;
  const decks = fs
    .readdirSync(dir)
    .filter((f) => /^[0-9a-f]{16}\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as DeckEvidence);
  const idsFile = path.join(dir, 'ids.json');
  const ids = fs.existsSync(idsFile) ? (JSON.parse(fs.readFileSync(idsFile, 'utf8')) as EvidenceIds) : null;
  return { index, decks, ids };
}

/**
 * The evidence check behind check:data: the stored files equal a rebuild from the tracked inputs (numbers within 2e-6),
 * and on their own their ids, sources, effects and strength words hold; the re-measurement inputs read. Read-only.
 */
export function evidenceCheck(root = '.'): { failures: string[]; passed: string[] } {
  const dir = path.join(root, EVIDENCE_DIR);
  const stored = readStored(dir);
  if (!stored) return { failures: [`${EVIDENCE_DIR}/ is missing (build it with ${REBUILD})`], passed: [] };
  // a build made with --adjusted names the file among its inputs: rebuild with it (it must be in the checkout)
  const adj = stored.index.inputs?.find((i) => /impact-adjusted/.test(i.file))?.file ?? null;
  const { inputs, problems } = loadEvidenceInputs(root, { adjusted: adj });
  const failures = problems.map((p) => `evidence input: ${p}`);
  if (problems.length) return { failures, passed: [] };
  const built = buildEvidence(inputs);
  failures.push(...built.problems);
  const diff = compareEvidence(dir, built);
  if (diff.length) failures.push(`${EVIDENCE_DIR}/ is not what the inputs build (new events, ratings, analysis, synergies, forge reports, re-measurements or ledger games?); rebuild it with ${REBUILD}: ${diff.slice(0, 8).join('; ')}${diff.length > 8 ? ` … (${diff.length} differences)` : ''}`);
  failures.push(...storedProblems(root, stored.decks, LEDGER_DIR, CURRENT_SIM_VERSION, stored.ids).map((p) => `${EVIDENCE_DIR}/${p}`));
  const n = stored.decks.reduce((a, d) => a + d.findings.length, 0);
  return { failures, passed: failures.length ? [] : [`${EVIDENCE_DIR}/ equals a rebuild (${stored.decks.length} decks, ${n} findings; ids, the short-id lookup, sources, effects and strength words check out; ${inputs.remeasure.reduce((a, f) => a + f.data.measurements.length, 0)} re-measurement(s) read)`] };
}

/**
 * Rebuild the evidence files after new data (scripts/tournament.ts calls it beside buildH2H): read, build, write. Never
 * throws: a problem comes back as the line to print, so recording an event is never undone by it.
 */
export function rebuildEvidence(o: { out?: string; eventsDir?: string; h2h?: string } = {}): string {
  try {
    const { inputs, problems } = loadEvidenceInputs('.', { eventsDir: o.eventsDir, h2h: o.h2h });
    if (problems.length) return `evidence not rebuilt: ${problems.join('; ')}`;
    const built = buildEvidence(inputs);
    if (built.problems.length) return `evidence not rebuilt: ${built.problems.join('; ')}`;
    const dir = o.out ?? EVIDENCE_DIR;
    const w = writeEvidence(dir, built);
    return `evidence: ${built.decks.length} decks → ${dir} (${w.written} file(s) written${w.removed ? `, ${w.removed} removed` : ''})`;
  } catch (e) {
    return `evidence not rebuilt: ${(e as Error).message}`;
  }
}

// ---------------------------------------------------------------- the command

if (process.argv[1]?.endsWith('build-evidence.ts')) {
  const { values: V } = cli(import.meta.url, { out: str(), 'ledger-dir': str(LEDGER_DIR), adjusted: str(), check: bool(), 'matchup-check': bool() });
  if (V['matchup-check']) {
    const sel = selectEvents(readEvents());
    const sp = pairSpread(loadEvidenceInputs('.').inputs.analysis);
    const c = matchupCheck(sel.kept.map(eventMatches), sp.tau2);
    const pt = (x: number) => (100 * x).toFixed(1);
    const sdOf = (v: number) => pt(Math.sqrt(Math.max(0, v)));
    console.log(sp.measured
      ? `Pair spread: a pairing's true win rate sits about ${pt(sp.sd)} points (SD) from the ratings' prediction, measured on ${sp.pairings} pairings of the analysis table (${sp.games} games); the fit misses those records by χ² = ${sp.chi2!.toFixed(1)} on ${sp.df} degrees of freedom.`
      : `Pair spread: the default of ${pt(sp.sd)} points (SD); the analysis table was missing or too small to measure it.`);
    console.log(`Leave one event out over ${sel.kept.length} events (${c.matches} held-out matches, ${c.games} games), each game's chance the training fit's for its seat plus the pairing's shrunk residual:`);
    console.log(`  Calibration: the logistic slope of the result on the logit of the chance is ${c.slope.toFixed(3)} ± ${c.slopeSe.toFixed(3)} (1 is calibrated; below 1, the chances are too far from even). The favoured deck scored ${c.favouredWins.toFixed(1)} against ${c.favouredExpected.toFixed(1)} expected.`);
    console.log(`  Distance of the truth from the estimate: the product of games 1 and 2's residuals averages ${c.squaredDistance.toFixed(4)} ± ${c.squaredDistanceSe.toFixed(4)} (SD about ${sdOf(c.squaredDistance)} points; 95% up to ${sdOf(c.squaredDistance + 1.96 * c.squaredDistanceSe)}).`);
    console.log(`  The interval claims ${c.claimedVariance.toFixed(4)} on average (SD ${sdOf(c.claimedVariance)} points) with the pair spread, ${c.claimedWithoutSpread.toFixed(4)} (SD ${sdOf(c.claimedWithoutSpread)} points) without it.`);
    process.exit(0);
  }
  const { inputs, problems } = loadEvidenceInputs('.', { ledgerDir: V['ledger-dir'], adjusted: V.adjusted ?? null });
  if (problems.length) {
    for (const p of problems) console.error(`error: ${p}`);
    process.exit(1);
  }
  const t0 = Date.now();
  const built = buildEvidence(inputs);
  if (built.problems.length) {
    for (const p of built.problems) console.error(`error: ${p}`);
    process.exit(1);
  }
  const dir = V.out ?? EVIDENCE_DIR;
  const n = built.decks.reduce((a, d) => a + d.findings.length, 0);
  if (V.check) {
    const diff = compareEvidence(dir, built);
    if (diff.length) {
      console.log(`${dir} differs from a rebuild (${diff.length} difference(s)); rebuild with ${REBUILD}:`);
      for (const d of diff.slice(0, 30)) console.log(`  ${d}`);
      process.exit(1);
    }
    console.log(`${dir} matches a rebuild (${built.decks.length} decks, ${n} findings)`);
    process.exit(0);
  }
  const w = writeEvidence(dir, built);
  const sizes = [...evidenceTexts(built).entries()].filter(([f]) => /^[0-9a-f]{16}\.json$/.test(f)).map(([, t]) => Buffer.byteLength(t));
  const kb = (x: number) => `${(x / 1024).toFixed(1)} kB`;
  console.log(
    `evidence: ${built.decks.length} decks, ${n} findings (${(['strong', 'moderate', 'weak', 'no-difference', 'not-enough'] as const).map((s) => `${built.decks.reduce((a, d) => a + d.findings.filter((f) => f.strength === s).length, 0)} ${s}`).join(', ')}) → ${dir} (${w.written} file(s) written${w.removed ? `, ${w.removed} removed` : ''}; largest deck file ${kb(Math.max(...sizes))}, all ${kb(sizes.reduce((a, x) => a + x, 0))}; ${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
}
