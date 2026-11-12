// SIM-8: a cache of played games for the CLI sims (opt-in with --cache on botcheck, tune, forge, optimize and
// rank-stability). Same code + same seed + same decks + same bot spec = same game (src/lib/tournament.ts makeBot), so a
// game already played is read back instead of played again.
//
// The key of a game is a SHA-256 over:
//   - the whole job as canonical JSON (keys sorted): both deck lists in full (names, Legends, main deck, sideboard), the
//     seed, the first player, the `bot` name, both seats' full agent specs and every other job flag (trace, mulligan
//     probes, ...), plus each list's `listFingerprint`;
//   - SIM_VERSION (src/lib/tournament.ts);
//   - the code hash: SHA-256 of the bytes of every source file the game worker loads, found by following the relative
//     imports (static, dynamic and `export … from`) of scripts/worker.ts transitively. That covers src/engine, the card
//     scripts, src/ai, src/analysis, src/data/cards.json, src/data/impact.json and whatever else they import. npm
//     packages are not hashed (the engine and bots import none), so the Node version is part of the key instead.
// A stale hit is far worse than a miss: any edit to any of those files, even a comment, starts a fresh cache.
//
// Jobs that ask for decision telemetry, synergy snapshots or evaluation leaves are never cached (their results are
// large); a game that threw is never stored. The store is `.cache/games/<code hash>-v<SIM_VERSION>/games.jsonl`
// (gitignored), one `{"k": key, "r": result}` line per game, appended at the end of each batch. Delete `.cache/games` to
// clear it; a directory whose code hash is no longer current is never read again.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFingerprint } from '../src/engine/deck';
import { SIM_VERSION } from '../src/lib/tournament';
import type { MatchJob, MatchResult } from './worker';

export const CACHE_DIR = '.cache/games';
const WORKER_ENTRY = fileURLToPath(new URL('./worker.ts', import.meta.url));

/** JSON with object keys sorted at every level, so the same job always gives the same text. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : canonicalJson(x))).join(',')}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}

const IMPORT_RE = /(?:^|[\s;}])(?:import|export)\s+(?:type\s+)?[^'"`;]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;}(=])import\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[\s;])import\s+['"]([^'"]+)['"]/g;
const EXTS = ['', '.ts', '.tsx', '.mts', '.js', '.mjs', '.json', '/index.ts', '/index.tsx', '/index.js'];

function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null; // node: built-ins and npm packages
  const base = path.resolve(path.dirname(fromFile), spec.replace(/\?.*$/, ''));
  const tries = [...EXTS.map((e) => base + e), ...(base.endsWith('.js') ? [base.slice(0, -3) + '.ts', base.slice(0, -3) + '.tsx'] : [])];
  for (const f of tries) if (fs.existsSync(f) && fs.statSync(f).isFile()) return path.resolve(f);
  throw new Error(`game cache: cannot resolve import "${spec}" in ${fromFile}; refusing to cache without hashing it`);
}

/** Every source file reachable from `entry` by relative imports, sorted, as paths relative to `root`. */
export function codeFiles(entry = WORKER_ENTRY, root = process.cwd()): string[] {
  const seen = new Set<string>();
  const stack = [path.resolve(entry)];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    if (f.endsWith('.json')) continue;
    const text = fs.readFileSync(f, 'utf8');
    if (/import\.meta\.glob/.test(text)) throw new Error(`game cache: ${f} uses import.meta.glob, whose files cannot be followed; refusing to cache`);
    for (const m of text.matchAll(IMPORT_RE)) {
      const r = resolveImport(f, m[1] ?? m[2] ?? m[3]);
      if (r && !seen.has(r)) stack.push(r);
    }
  }
  return [...seen].map((f) => path.relative(root, f).split(path.sep).join('/')).sort();
}

/** SHA-256 over the paths and bytes of `codeFiles()`. */
export function codeHash(entry = WORKER_ENTRY, root = process.cwd()): { hash: string; files: string[] } {
  const files = codeFiles(entry, root);
  const h = crypto.createHash('sha256');
  for (const f of files) {
    h.update(f);
    h.update('\0');
    h.update(fs.readFileSync(path.resolve(root, f)));
    h.update('\0');
  }
  return { hash: h.digest('hex'), files };
}

/** Jobs whose results are too large to keep. */
export const cacheable = (j: MatchJob) => !j.decisions && !j.rawDecisions && !j.synergies && !j.evalLeaves;

export interface KeyParts {
  codeHash: string;
  simVersion: number;
  node: string;
}

/** The cache key of a job (see the header), or null when the job is not cached. */
export function gameKey(job: MatchJob, parts: KeyParts): string | null {
  if (!cacheable(job)) return null;
  const text = canonicalJson({
    v: 1,
    code: parts.codeHash,
    sim: parts.simVersion,
    node: parts.node,
    lists: [listFingerprint(job.a), listFingerprint(job.b)],
    job,
  });
  return crypto.createHash('sha256').update(text).digest('hex');
}

export interface GameCache {
  readonly dir: string;
  readonly parts: KeyParts;
  get(job: MatchJob): MatchResult | undefined;
  put(job: MatchJob, r: MatchResult): void;
  /** append the results stored since the last flush to the file */
  flush(): void;
  /** games looked up in this process: hits, misses (cacheable jobs only), and results stored */
  readonly stats: { hits: number; misses: number; stored: number };
}

export interface OpenOptions {
  dir?: string;
  codeHash?: string;
  simVersion?: number;
  node?: string;
}

/** Open (and read) the cache for the current code. */
export function openGameCache(o: OpenOptions = {}): GameCache {
  const parts: KeyParts = { codeHash: o.codeHash ?? codeHash().hash, simVersion: o.simVersion ?? SIM_VERSION, node: o.node ?? process.versions.node };
  const dir = path.join(o.dir ?? CACHE_DIR, `${parts.codeHash.slice(0, 16)}-v${parts.simVersion}`);
  const file = path.join(dir, 'games.jsonl');
  const map = new Map<string, string>();
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line) continue;
      try {
        const { k, r } = JSON.parse(line) as { k: string; r: MatchResult };
        if (typeof k === 'string' && r) map.set(k, JSON.stringify(r));
      } catch {
        // a line cut short by an interrupted write: skip it
      }
    }
  }
  let pending: string[] = [];
  const stats = { hits: 0, misses: 0, stored: 0 };
  return {
    dir,
    parts,
    stats,
    get(job) {
      const k = gameKey(job, parts);
      if (!k) return undefined;
      const hit = map.get(k);
      if (hit === undefined) {
        stats.misses++;
        return undefined;
      }
      stats.hits++;
      return JSON.parse(hit) as MatchResult;
    },
    put(job, r) {
      const k = gameKey(job, parts);
      if (!k || r.error || map.has(k)) return;
      const text = JSON.stringify(r);
      map.set(k, text);
      pending.push(`{"k":${JSON.stringify(k)},"r":${text}}\n`);
      stats.stored++;
    },
    flush() {
      if (!pending.length) return;
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(file, pending.join(''));
      pending = [];
    },
  };
}

/** The line a cached run prints: how many games were read from the cache. */
export function cacheSummary(c: GameCache): string {
  const { hits, misses, stored } = c.stats;
  const n = hits + misses;
  return `game cache: ${hits} of ${n} games were hits${n ? ` (${((100 * hits) / n).toFixed(1)}%)` : ''}, ${stored} stored in ${c.dir.split(path.sep).join('/')}`;
}

/**
 * For a script's --cache flag: the cache, or undefined when the flag is off. The totals are printed (stderr) when the
 * process exits, and anything not yet written is flushed then.
 */
export function cliGameCache(on: boolean): GameCache | undefined {
  if (!on) return undefined;
  const c = openGameCache();
  process.on('exit', () => {
    c.flush();
    process.stderr.write(`${cacheSummary(c)}\n`);
  });
  return c;
}
