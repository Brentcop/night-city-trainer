// Knowledge pack (docs/RAG_PLAN.md): ask about cards, rulings, decks, deck notes, synergy packages, glossary terms,
// guides, docs, code headers, recorded events and rounds, power ratings and matchups, and the bot's card and package
// statistics, and get back the few records that answer, each with its source and version.
//   npm run kb -- search "<question>"   the best records: exact name, records linked to it, then keywords
//   npm run kb -- get <id or name>      every record with that id, title or alias, in full
//   npm run kb -- related <id or name>  the record and its neighbours, grouped by link type
//   npm run kb -- stats                 records by kind and scope, pack size, mentions left unlinked, dense ready or not
//   npm run kb -- build                 rebuild the local pack now
//   npm run kb -- embed                 build or refresh the dense vectors (step 4.1, scripts/kb-dense.ts): only records
//                                       whose text changed are embedded again; prints counts, time and size
//   npm run kb -- fact <name> …         an exact number computed from the recorded data, with its source file, bot and
//                                       sim version (src/lib/eventFacts.ts), never looked up by similarity:
//     fact champion --event 6                    the champion, the final and the runner-up
//     fact standings --event 6 [--round 5]       Swiss standings after a round (default: the last Swiss round)
//     fact round --event 6 --round 5             one round: matches, byes, sweeps, deciding games, leaders after it,
//                                                who moved into or out of the top-cut places, its upsets
//                                                (--round final | semifinals | quarterfinals for a top-cut round)
//     fact upsets --event 6 [--round 5]          matches won by the underdog by the ratings fitted on earlier events
//                                                only (src/lib/eventUpsets.ts), and what could not be judged
//     fact rating <deck>                         power rating, 90% range, Sim tier, Swiss record, titles, top cuts
//     fact ratings [--top N]                     the ratings table in its own order: expected win rate, 90% range,
//                                                rated games and Sim tier per deck, and which ranges overlap
//     fact finishes <deck>                       every standard event the deck entered
//     fact matchup "<deck a>" "<deck b>"         shrunk estimate, raw record and games (or: <deck a> vs <deck b>)
//     fact card <card> [--deck <deck>]           how the bot used a card on a library list, or every list pooled: uses,
//                                                games, win rates with 95% intervals by stage and Gig standing, the gap
//                                                when drawn (src/lib/cardFacts.ts; associations, not value)
//     fact package <package> [--deck <deck>]     how a synergy package did: assembled, online, win rates online and
//                                                never, the lift with its interval and the coach's gate
//   A deck is named by file, by name or by list fingerprint; an unknown name exits 1 and lists the nearest. A card or a
//   package is named by its name or id.
// Flags:
//   --k N                 results for search (default 5)
//   --kind a,b            only these kinds: card ruling faq rule trule errata deck objective package term guide doc code
//                         event round rating matchup cardstat pkgstat
//   --event N             fact: the recorded event's id
//   --round R             fact: a round number, or a top-cut round's name
//   --top N               fact ratings: only the first N decks (default all)
//   --deck D              fact card / package: one library list (file, name or list fingerprint; default every list pooled)
//   --scope S             public | local | all (default all)
//   --rankers a,b         search rankers to run: exact, linked, keyword, dense (default the first three). dense needs
//                         the embedding tools and model in .cache/kb-dense/ (exit 1 saying what is missing otherwise)
//   --json                JSON output
//   --max-tokens N        cap the output at about N tokens, counted as characters / 4 (default 2000)
// The local pack is a cache in .cache/kb/ (records.jsonl and manifest.json), rebuilt by itself when an input changed.
// Records from data/raw (rules, official FAQ wording, tournament rules, errata) are marked LOCAL-ONLY: never paste
// their text into a tracked file. Without data/raw they are simply absent.
import fs from 'node:fs';
import path from 'node:path';
import { ArgError, bool, int, oneOf, parseArgs, runMain, str, usageOf, writeIfChanged, type Values } from './lib-node';
import type { densePaths as DensePathsFn } from './kb-dense';
import { buildFromSources, hashInputs, inputFiles, loadCompetitive, loadStats, rawPresent } from './kb-sources';
import type { DenseIndex } from '../src/lib/kb/dense';
import type { CompetitiveSources } from '../src/lib/kb/build/events';
import { dossier } from '../src/lib/kb/dossier';
import { FACT_NEEDS, FACTS, type DeckResolver, type FactName, type FactRequest, type StatResolver } from '../src/lib/kb/factNames';
import { nameKey } from '../src/lib/kb/text';
import { KB_BUILDER_VERSION, packLines, packManifest, parsePackLines } from '../src/lib/kb/build/pack';
import { DOSSIER_COST, renderDossierJson, renderDossierText, renderRecordsJson, renderRecordsText, renderSearchJson, renderSearchText } from '../src/lib/kb/render';
import { buildIndex, lookup, RANKERS, search, type KbIndex, type Ranker } from '../src/lib/kb/search';
import { KB_KINDS, type KbKind, type KbManifest, type KbRecord } from '../src/lib/kb/types';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const CACHE_DIR = '.cache/kb';

const COMMANDS = ['search', 'get', 'related', 'stats', 'build', 'fact', 'embed'] as const;
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
  event: int(undefined, { min: 1 }),
  top: int(undefined, { min: 1, max: 1000 }),
  round: str(undefined, (v) => (/^\d+$/.test(v) ? (Number(v) >= 1 ? undefined : 'a round number from 1') : /^[a-z][a-z0-9 -]*$/i.test(v) ? undefined : 'a round number or a top-cut round name')),
  deck: str(undefined, (v) => (v.trim() ? undefined : 'a library deck: file, name or list fingerprint')),
};

/** The flags each command takes (anything else is an error, exit 2). */
const FLAGS: Record<Command, readonly (keyof typeof KB_SPEC)[]> = {
  search: ['k', 'kind', 'scope', 'rankers', 'json', 'max-tokens'],
  get: ['kind', 'scope', 'json', 'max-tokens'],
  related: ['kind', 'scope', 'json', 'max-tokens'],
  stats: ['json'],
  build: ['json'],
  fact: ['event', 'round', 'top', 'deck', 'json'],
  embed: [],
};

/** Commands that take no words. */
const BARE: readonly Command[] = ['stats', 'build', 'embed'];

export interface KbArgs {
  command: Command;
  /** the question, id or name (positional words joined by spaces) */
  query: string;
  values: Values<typeof KB_SPEC>;
  kinds?: KbKind[];
  rankers?: Ranker[];
  /** the fact command's request */
  fact?: FactRequest;
}

/** `fact <name> …`: check the fact's name, its flags and its decks (two for a matchup: two arguments, or "a vs b"). */
function parseFact(words: readonly string[], values: Values<typeof KB_SPEC>): FactRequest {
  const [name, ...rest] = words;
  if (!name) throw new ArgError(`fact needs a name (${FACTS.join(', ')})`);
  if (!(FACTS as readonly string[]).includes(name)) throw new ArgError(`unknown fact "${name}" (choose from ${FACTS.join(', ')})`);
  const fact = name as FactName;
  const need = FACT_NEEDS[fact];
  if (need.event && values.event === undefined) throw new ArgError(`fact ${fact} needs --event N`);
  if (!need.event && values.event !== undefined) throw new ArgError(`--event does not apply to fact ${fact}`);
  if (need.round === 'required' && values.round === undefined) throw new ArgError(`fact ${fact} needs --round`);
  if (need.round === 'no' && values.round !== undefined) throw new ArgError(`--round does not apply to fact ${fact}`);
  if (fact === 'standings' && values.round !== undefined && !/^\d+$/.test(values.round)) throw new ArgError('fact standings takes a round number');
  if (!need.top && values.top !== undefined) throw new ArgError(`--top does not apply to fact ${fact}`);
  if (!need.subject && values.deck !== undefined) throw new ArgError(`--deck does not apply to fact ${fact}`);
  if (need.subject) {
    const subject = rest.join(' ').trim();
    if (!subject) throw new ArgError(`fact ${fact} needs a ${need.subject} (name or id)`);
    return { fact, decks: [], subject, ...(values.deck !== undefined ? { deck: values.deck.trim() } : {}), json: values.json };
  }
  let decks: string[] = [];
  if (need.decks === 1) decks = rest.length ? [rest.join(' ').trim()] : [];
  else if (need.decks === 2) {
    const split = rest.join(' ').split(/\s+(?:vs\.?|versus|against)\s+/i);
    decks = rest.length === 2 ? [...rest] : split.length === 2 ? split : [];
    decks = decks.map((d) => d.trim());
  } else if (rest.length) throw new ArgError(`fact ${fact} takes no deck, got "${rest.join(' ')}"`);
  if (decks.length !== need.decks || decks.some((d) => !d))
    throw new ArgError(need.decks === 2 ? `fact ${fact} needs two decks: "<deck a>" "<deck b>", or <deck a> vs <deck b>` : `fact ${fact} needs a deck (file, name or list fingerprint)`);
  return {
    fact,
    ...(values.event !== undefined ? { event: values.event } : {}),
    ...(values.round !== undefined ? { round: values.round } : {}),
    ...(values.top !== undefined ? { top: values.top } : {}),
    decks,
    json: values.json,
  };
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
  if (BARE.includes(command) && rest.length) throw new ArgError(`${command} takes no arguments, got "${query}"`);
  if (!BARE.includes(command) && !query) throw new ArgError(`${command} needs ${command === 'search' ? 'a question' : command === 'fact' ? `a fact name (${FACTS.join(', ')})` : 'an id or a name'}`);
  return {
    command,
    query,
    values,
    kinds: values.kind?.split(',').map((x) => x.trim() as KbKind),
    rankers: values.rankers?.split(',').map((x) => x.trim() as Ranker),
    ...(command === 'fact' ? { fact: parseFact(rest, values) } : {}),
  };
}

/**
 * Deck names for `fact`: a recorded deck name (any case), else a library deck's file, file stem, list fingerprint or
 * deck id through the pack's deck records; an unknown name gets the three nearest deck records by search.
 */
export function deckResolver(ix: KbIndex, src: CompetitiveSources): DeckResolver {
  const known = new Map<string, string>();
  const add = (n: string) => known.set(nameKey(n), n);
  for (const r of src.ratings?.data.decks ?? []) add(r.name);
  for (const { event } of src.events) for (const n of Object.keys(event.decks)) if (!known.has(nameKey(n))) add(n);
  for (const n of src.h2h?.data.decks ?? []) if (!known.has(nameKey(n))) add(n);
  return (typed) => {
    const hit = known.get(nameKey(typed)) ?? known.get(nameKey(typed.replace(/\.txt$/i, '')));
    if (hit) return { name: hit };
    const decks = lookup(ix, typed).filter((r) => r.kind === 'deck');
    const named = decks.length === 1 ? known.get(nameKey(decks[0]!.title)) : undefined;
    if (named) return { name: named };
    return { nearest: search(ix, typed, { k: 3, kinds: ['deck'] }).hits.map((h) => `${h.record.title} (${String(h.record.fields?.file ?? h.record.id)})`) };
  };
}

/**
 * Names for `fact card` and `fact package`: a card or package record of the pack by id, name or alias (the bare card or
 * package id works too), and a library deck record by file, stem, name or list fingerprint; an unknown name gets the
 * three nearest records of that kind by search.
 */
export function statResolver(ix: KbIndex): StatResolver {
  const near = (typed: string, kind: KbKind) => search(ix, typed, { k: 3, kinds: [kind] }).hits.map((h) => `${h.record.title} (${h.record.id})`);
  const one = (typed: string, kind: KbKind, prefix: string) => {
    const hits = [...lookup(ix, typed), ...lookup(ix, `${prefix}:${typed.trim()}`)].filter((r) => r.kind === kind);
    const ids = [...new Set(hits.map((r) => r.id))];
    return ids.length === 1 ? hits[0]! : null;
  };
  return {
    card: (typed) => {
      const r = one(typed, 'card', 'card');
      return r ? { id: r.id.slice('card:'.length), name: r.title } : { nearest: near(typed, 'card') };
    },
    package: (typed) => {
      const r = one(typed, 'package', 'pkg');
      return r ? { id: r.id.slice('pkg:'.length), name: r.title } : { nearest: near(typed, 'package') };
    },
    deck: (typed) => {
      const r = one(typed.replace(/\.txt$/i, ''), 'deck', 'deck') ?? one(typed, 'deck', 'deck');
      const file = r?.fields?.file;
      const listId = r?.stamps?.listId;
      return r && typeof file === 'string' && listId ? { file, name: r.title, listId } : { nearest: near(typed, 'deck').map((n) => n) };
    },
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

/** One line on the dense ranker (step 4.1): ready or what is missing, and how many records have a current vector. */
export async function denseStatsText(records: readonly KbRecord[], dp: ReturnType<typeof DensePathsFn>): Promise<string> {
  const { denseStatus, DENSE_MODEL, vectorState } = await import('./kb-dense');
  const st = denseStatus(dp);
  if (!st.ready) return `dense: not ready (${st.missing.length} missing piece${st.missing.length > 1 ? 's' : ''}; \`npm run kb -- embed\` lists them); search is lexical only`;
  const v = vectorState(records, dp.vectors);
  return `dense: ready (${DENSE_MODEL.id}, ${DENSE_MODEL.dtype}, ${DENSE_MODEL.dims} dims); vectors ${v.built ? `current for ${v.current} of ${v.records} records, ${kb(v.bytes)}${v.current < v.records ? ' (the rest are embedded on the next dense search or `embed`)' : ''}` : 'not built yet (`npm run kb -- embed`)'}`;
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
export function runQuery(a: KbArgs, ix: KbIndex, dense?: { index: DenseIndex; query: ArrayLike<number> }): { out: string; code: number } {
  const max = a.values['max-tokens'];
  const json = a.values.json;
  if (a.command === 'search') {
    const res = search(ix, a.query, { k: a.values.k, kinds: a.kinds, scope: a.values.scope, rankers: a.rankers, ...(dense ? { dense } : {}) });
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
  const wantsDense = a.command === 'embed' || (a.command === 'search' && !!a.rankers?.includes('dense'));
  // the dense module only for dense, embed and stats; the facts module only for fact
  const kd = wantsDense || a.command === 'stats' ? await import('./kb-dense') : undefined;
  const dp = kd?.densePaths(ROOT);
  if (wantsDense && kd && dp) {
    const st = kd.denseStatus(dp);
    if (!st.ready) {
      console.error(`kb: ${kd.missingText(st)}`);
      process.exit(1);
    }
  }
  const pack = await ensurePack({ force: a.command === 'build' });
  if (pack.rebuilt && a.command !== 'build') console.error(`kb: pack rebuilt (inputs changed) in ${(pack.buildMs! / 1000).toFixed(1)} s`);
  if (wantsDense && kd && dp) {
    const t0 = performance.now();
    const embed = await kd.loadEmbedder(dp);
    const t1 = performance.now();
    const r = await kd.refreshVectors(pack.records, embed, dp.vectors);
    const t2 = performance.now();
    const line = `${r.embedded} records embedded, ${r.reused} reused, ${r.dropped} dropped; model loaded in ${((t1 - t0) / 1000).toFixed(1)} s, embedding took ${((t2 - t1) / 1000).toFixed(1)} s; ${path.relative(ROOT, dp.vectors).split(path.sep).join('/')}/ ${kb(r.bytes)}`;
    if (a.command === 'embed') {
      console.log(`kb embed: ${line}; ${(process.memoryUsage().rss / 2 ** 20).toFixed(0)} MB resident`);
      return;
    }
    if (r.embedded || r.dropped) console.error(`kb: dense vectors refreshed: ${line}`);
    const [query] = await kd.embedQueries(embed, [a.query]);
    const ix = buildIndex(pack.records);
    const { out, code } = runQuery(a, ix, { index: kd.denseFor(r.index, ix.records), query: query! });
    process.stdout.write(out);
    process.exitCode = code;
    return;
  }
  if (a.command === 'fact') {
    const { runFact } = await import('../src/lib/kb/facts');
    const src = loadCompetitive(ROOT);
    const ix = buildIndex(pack.records);
    let stats;
    if (FACT_NEEDS[a.fact!.fact].subject) {
      const { CATALOGUE_VERSION } = await import('../src/content/synergies/index');
      const decks = new Map(pack.records.filter((r) => r.kind === 'deck' && r.stamps?.listId).map((r) => [r.stamps!.listId!, { file: String(r.fields?.file), name: r.title }]));
      stats = { sources: loadStats(ROOT, CATALOGUE_VERSION), names: statResolver(ix), deckOf: (listId: string) => decks.get(listId) };
    }
    const { out, code } = runFact(a.fact!, src, deckResolver(ix, src), stats);
    process.stdout.write(out);
    process.exitCode = code;
    return;
  }
  if (a.command === 'build' || a.command === 'stats') {
    const st = kd && dp ? kd.denseStatus(dp) : undefined;
    const dense = kd && dp && st ? { dense: { ...st, ...(st.ready ? { vectors: kd.vectorState(pack.records, dp.vectors) } : {}) } } : {};
    if (a.values.json) console.log(JSON.stringify({ ...pack.manifest, bytes: pack.bytes, ...(pack.buildMs !== undefined ? { buildMs: Math.round(pack.buildMs) } : {}), ...dense }, null, 2));
    else {
      if (a.command === 'build') console.log(`kb: built ${CACHE_DIR}/ in ${(pack.buildMs! / 1000).toFixed(1)} s`);
      console.log(statsText(pack));
      if (a.command === 'stats' && dp) console.log(await denseStatsText(pack.records, dp));
    }
    return;
  }
  const { out, code } = runQuery(a, buildIndex(pack.records));
  process.stdout.write(out);
  process.exitCode = code;
}

if (/[\\/]kb\.ts$/.test(process.argv[1] ?? '')) runMain(main);
