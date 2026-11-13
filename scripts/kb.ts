// Knowledge pack (docs/RAG_PLAN.md): ask about cards, rulings, decks, deck notes, synergy packages, glossary terms,
// guides, docs and code headers, and get back the few records that answer, each with its source and version.
//   npm run kb -- search "<question>"   the best records: exact name, records linked to it, then keywords
//   npm run kb -- get <id or name>      every record with that id, title or alias, in full
//   npm run kb -- related <id or name>  the record and its neighbours, grouped by link type
//   npm run kb -- stats                 records by kind and scope, pack size, mentions left unlinked
//   npm run kb -- build                 rebuild the local pack now
// Flags:
//   --k N                 results for search (default 5)
//   --kind a,b            only these kinds: card ruling faq rule trule errata deck objective package term guide doc code
//   --scope S             public | local | all (default all)
//   --rankers a,b         search rankers to run: exact, linked, keyword (default all three)
//   --json                JSON output
//   --max-tokens N        cap the output at about N tokens, counted as characters / 4 (default 2000)
// The local pack is a cache in .cache/kb/ (records.jsonl and manifest.json), rebuilt by itself when an input changed.
// Records from data/raw (rules, official FAQ wording, tournament rules, errata) are marked LOCAL-ONLY: never paste
// their text into a tracked file. Without data/raw they are simply absent.
import fs from 'node:fs';
import path from 'node:path';
import { ArgError, bool, int, oneOf, parseArgs, runMain, str, usageOf, writeIfChanged, type Values } from './lib-node';
import { buildFromSources, hashInputs, inputFiles, rawPresent } from './kb-sources';
import { dossier } from '../src/lib/kb/dossier';
import { KB_BUILDER_VERSION, packLines, packManifest, parsePackLines } from '../src/lib/kb/build/pack';
import { DOSSIER_COST, renderDossierJson, renderDossierText, renderRecordsJson, renderRecordsText, renderSearchJson, renderSearchText } from '../src/lib/kb/render';
import { buildIndex, lookup, RANKERS, search, type KbIndex, type Ranker } from '../src/lib/kb/search';
import { KB_KINDS, type KbKind, type KbManifest, type KbRecord } from '../src/lib/kb/types';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const CACHE_DIR = '.cache/kb';

const COMMANDS = ['search', 'get', 'related', 'stats', 'build'] as const;
type Command = (typeof COMMANDS)[number];

const listOf = (all: readonly string[]) => (v: string) => {
  const parts = v.split(',').map((x) => x.trim());
  const bad = parts.filter((x) => !all.includes(x));
  if (!parts.length || parts.some((x) => !x)) return `give a comma-separated list of ${all.join(', ')}`;
  return bad.length ? `unknown ${bad.join(', ')} (choose from ${all.join(', ')})` : undefined;
};

export const KB_SPEC = {
  k: int(5, { min: 1, max: 100 }),
  kind: str(undefined, listOf(KB_KINDS)),
  scope: oneOf(['public', 'local', 'all'], 'all'),
  rankers: str(undefined, listOf(RANKERS)),
  json: bool(),
  'max-tokens': int(2000, { min: 50, max: 1_000_000 }),
};

/** The flags each command takes (anything else is an error, exit 2). */
const FLAGS: Record<Command, readonly (keyof typeof KB_SPEC)[]> = {
  search: ['k', 'kind', 'scope', 'rankers', 'json', 'max-tokens'],
  get: ['kind', 'scope', 'json', 'max-tokens'],
  related: ['kind', 'scope', 'json', 'max-tokens'],
  stats: ['json'],
  build: ['json'],
};

export interface KbArgs {
  command: Command;
  /** the question, id or name (positional words joined by spaces) */
  query: string;
  values: Values<typeof KB_SPEC>;
  kinds?: KbKind[];
  rankers?: Ranker[];
}

/** Parse a kb command line; throws ArgError on anything invalid. */
export function parseKbArgs(argv: string[]): KbArgs {
  const { values, positionals } = parseArgs(KB_SPEC, argv, { minPositionals: 1, maxPositionals: Infinity });
  const [cmd, ...rest] = positionals;
  if (!(COMMANDS as readonly string[]).includes(cmd!)) throw new ArgError(`unknown command "${cmd}" (choose from ${COMMANDS.join(', ')})`);
  const command = cmd as Command;
  const given = Object.keys(KB_SPEC).filter((k) => argv.some((a) => a === `--${k}` || a.startsWith(`--${k}=`))) as (keyof typeof KB_SPEC)[];
  const wrong = given.filter((k) => !FLAGS[command].includes(k));
  if (wrong.length) throw new ArgError(`${wrong.map((k) => `--${k}`).join(', ')} does not apply to ${command}`);
  const query = rest.join(' ').trim();
  if ((command === 'stats' || command === 'build') && rest.length) throw new ArgError(`${command} takes no arguments, got "${query}"`);
  if (command !== 'stats' && command !== 'build' && !query) throw new ArgError(`${command} needs ${command === 'search' ? 'a question' : 'an id or a name'}`);
  return {
    command,
    query,
    values,
    kinds: values.kind?.split(',').map((x) => x.trim() as KbKind),
    rankers: values.rankers?.split(',').map((x) => x.trim() as Ranker),
  };
}

export interface Pack {
  records: KbRecord[];
  manifest: KbManifest;
  /** size of records.jsonl in bytes */
  bytes: number;
  rebuilt: boolean;
  buildMs?: number;
}

/**
 * Load the local pack, rebuilding it first when an input file, the builder or the presence of data/raw changed.
 * `cacheDir` other than .cache/kb is for tests, which must pass `raw: false` (rule M6: data/raw text goes nowhere else).
 */
export async function ensurePack(o: { root?: string; cacheDir?: string; force?: boolean; raw?: boolean } = {}): Promise<Pack> {
  const root = o.root ?? ROOT;
  const dir = path.resolve(root, o.cacheDir ?? CACHE_DIR);
  const raw = o.raw ?? rawPresent(root);
  const inputs = hashInputs(root, inputFiles(root, { raw }));
  const recordsFile = path.join(dir, 'records.jsonl');
  const manifestFile = path.join(dir, 'manifest.json');
  if (!o.force && fs.existsSync(recordsFile) && fs.existsSync(manifestFile)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as KbManifest;
      if (manifest.builder === KB_BUILDER_VERSION && JSON.stringify(manifest.inputs) === JSON.stringify(inputs)) {
        const text = fs.readFileSync(recordsFile, 'utf8');
        return { records: parsePackLines(text), manifest, bytes: Buffer.byteLength(text), rebuilt: false };
      }
    } catch {
      // unreadable cache: rebuild
    }
  }
  const t0 = performance.now();
  const b = await buildFromSources(root, { raw });
  const manifest = packManifest(b.records, { report: b.report, inputs, local: b.local, rulesVersion: b.rulesVersion, faqVersion: b.faqVersion, cardDataVersion: b.cardDataVersion });
  const lines = packLines(b.records);
  writeIfChanged(recordsFile, lines);
  writeIfChanged(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  return { records: b.records, manifest, bytes: Buffer.byteLength(lines), rebuilt: true, buildMs: performance.now() - t0 };
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

export function statsText(p: Pick<Pack, 'manifest' | 'bytes' | 'records'>): string {
  const m = p.manifest;
  const r = m.report;
  const links = p.records.reduce((a, x) => a + x.links.length, 0);
  const ambiguous = Object.entries(r.ambiguousNames).map(([n, c]) => `${n} ${c}`).join(', ');
  return [
    `kb pack: ${m.records} records (public ${m.scopes.public}, local ${m.scopes.local}${m.local ? '' : ', no data/raw'}), records.jsonl ${kb(p.bytes)}, ${links} links`,
    `by kind: ${Object.entries(m.counts).map(([k, n]) => `${k} ${n}`).join(', ')}`,
    `card mentions linked: ${r.mentions}; resolved by the deck's list: ${r.resolvedByDeck}; ambiguous, left unlinked: ${r.ambiguous}${ambiguous ? ` (${ambiguous})` : ''}`,
    `dangling links dropped: ${r.dangling.length}${r.dangling.length ? ` (${r.dangling.slice(0, 5).join('; ')}${r.dangling.length > 5 ? '; …' : ''})` : ''}`,
    `skipped: ${Object.entries(r.skipped).map(([k, n]) => `${k} ${n}`).join('; ') || 'none'}`,
    `versions: rules ${m.rulesVersion}, FAQ ${m.faqVersion}, card data ${m.cardDataVersion}; ${Object.keys(m.inputs).length} input files`,
  ].join('\n');
}

/** Records named `q`, filtered by --kind and --scope. */
function named(ix: KbIndex, a: KbArgs): KbRecord[] {
  return lookup(ix, a.query).filter((r) => (!a.kinds || a.kinds.includes(r.kind)) && (a.values.scope === 'all' || r.scope === a.values.scope));
}

function notFound(ix: KbIndex, a: KbArgs): { out: string; code: number } {
  const near = search(ix, a.query, { k: 3 }).hits.map((h) => `  ${h.record.id}  ${h.record.title}`);
  return { out: `no record named "${a.query}"${near.length ? `; nearest:\n${near.join('\n')}` : ''}\n`, code: 1 };
}

/** Run a query command against an index. Returns the output and the exit code (1 when nothing was found). */
export function runQuery(a: KbArgs, ix: KbIndex): { out: string; code: number } {
  const max = a.values['max-tokens'];
  const json = a.values.json;
  if (a.command === 'search') {
    const res = search(ix, a.query, { k: a.values.k, kinds: a.kinds, scope: a.values.scope, rankers: a.rankers });
    return { out: (json ? renderSearchJson(res, max) : renderSearchText(res, max)) + '\n', code: res.noMatch ? 1 : 0 };
  }
  const rs = named(ix, a);
  if (!rs.length) return notFound(ix, a);
  if (a.command === 'get') return { out: (json ? renderRecordsJson(rs, max) : renderRecordsText(rs, max)) + '\n', code: 0 };
  const share = Math.floor(max / rs.length);
  const ds = rs.map((r) => dossier(ix, r.id, { maxTokens: share, ...DOSSIER_COST })!);
  return { out: json ? `[${ds.map(renderDossierJson).join(',\n')}]\n` : ds.map(renderDossierText).join('\n'), code: 0 };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usageOf(import.meta.url));
    return;
  }
  let a: KbArgs;
  try {
    a = parseKbArgs(argv);
  } catch (e) {
    if (!(e instanceof ArgError)) throw e;
    console.error(`error: ${e.message}\nRun with --help for usage.`);
    process.exit(2);
  }
  const pack = await ensurePack({ force: a.command === 'build' });
  if (pack.rebuilt && a.command !== 'build') console.error(`kb: pack rebuilt (inputs changed) in ${(pack.buildMs! / 1000).toFixed(1)} s`);
  if (a.command === 'build' || a.command === 'stats') {
    if (a.values.json) console.log(JSON.stringify({ ...pack.manifest, bytes: pack.bytes, ...(pack.buildMs !== undefined ? { buildMs: Math.round(pack.buildMs) } : {}) }, null, 2));
    else {
      if (a.command === 'build') console.log(`kb: built ${CACHE_DIR}/ in ${(pack.buildMs! / 1000).toFixed(1)} s`);
      console.log(statsText(pack));
    }
    return;
  }
  const { out, code } = runQuery(a, buildIndex(pack.records));
  process.stdout.write(out);
  process.exitCode = code;
}

if (/[\\/]kb\.ts$/.test(process.argv[1] ?? '')) runMain(main);
