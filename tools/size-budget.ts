// Size budget for the Web Worker bundles (APP-14). Each worker (src/sim/*.worker.ts) loads on first use (the coach,
// Game review, the Matchup Lab and the tournament runner), so its size is a first-load cost on phones. The budgets sit
// just above the sizes when they were set (2026-11-13: game 337 kB, coach 346 kB, review 351 kB), so growth fails the
// build (vite.config.ts) and becomes a decision: trim the bundle, or raise the number here on purpose.

/** kB (1000 bytes, as Vite prints them) per worker, by the name before ".worker". */
export const WORKER_BUDGET_KB: Readonly<Record<string, number>> = { game: 370, coach: 380, review: 385 };

/** "game.worker-CqcC5VWM.js" → "game"; null for a file that is not a worker bundle. */
export function workerName(file: string): string | null {
  const m = /(?:^|[\\/])([\w-]+)\.worker-[\w-]+\.js$/.exec(file);
  return m ? m[1]! : null;
}

/**
 * What is wrong with the built workers: one over its budget, one with no budget (a new worker: give it one), or a
 * budgeted worker that was not built (renamed or removed: update the list). Empty when all is well.
 */
export function budgetProblems(files: readonly { name: string; bytes: number }[], budget: Readonly<Record<string, number>> = WORKER_BUDGET_KB): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const w = workerName(f.name);
    if (!w) continue;
    seen.add(w);
    const kb = f.bytes / 1000;
    const max = budget[w];
    if (max === undefined) out.push(`${f.name}: a worker with no size budget (${kb.toFixed(1)} kB); add it to WORKER_BUDGET_KB in tools/size-budget.ts`);
    else if (kb > max) out.push(`${f.name}: ${kb.toFixed(1)} kB is over its budget of ${max} kB (tools/size-budget.ts): trim it, or raise the budget on purpose`);
  }
  for (const w of Object.keys(budget)) if (!seen.has(w)) out.push(`the ${w} worker was not built; update WORKER_BUDGET_KB in tools/size-budget.ts`);
  return out;
}

// Size budget for the site search (docs/RAG_PLAN.md step 3). The knowledge-pack shards (assets/kb-<shard>-<hash>.json,
// tools/kb-site.ts) and the search page's chunk load only when a visitor opens #/search and types, so their gzip size
// is what a search costs. Set 2026-11-14 a little above the sizes then (gzip, level 9: core 79.4 kB, events 33.0 kB,
// cardstat 81.9 kB, pkgstat 86.9 kB; the page chunk 11.8 kB): growth fails the build and becomes a decision.

/** gzip kB per knowledge-pack shard, by shard name. */
export const KB_SHARD_BUDGET_KB: Readonly<Record<string, number>> = { core: 88, events: 37, cardstat: 90, pkgstat: 96 };
/** gzip kB of the search page's chunk (Search-<hash>.js: the page and the search core). */
export const SEARCH_CHUNK_BUDGET_KB = 13;

/** "kb-core-0123abcd.json" → "core"; null for a file that is not a shard. */
export function kbShardName(file: string): string | null {
  const m = /(?:^|[\/])kb-([a-z]+)-[0-9a-f]+\.json$/.exec(file);
  return m ? m[1]! : null;
}

/** "Search-CqcC5VWM.js" → true: the search page's chunk. */
export const isSearchChunk = (file: string): boolean => /(?:^|[\/])Search-[\w-]+\.js$/.test(file);

/**
 * What is wrong with the search's files, by gzip size: a shard or the page chunk over its budget, a shard with no
 * budget, a budgeted shard or the page chunk not built. Empty when all is well.
 */
export function searchBudgetProblems(files: readonly { name: string; gzipBytes: number }[], budget: Readonly<Record<string, number>> = KB_SHARD_BUDGET_KB, chunkKb = SEARCH_CHUNK_BUDGET_KB): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let chunk = false;
  for (const f of files) {
    const kb = f.gzipBytes / 1000;
    if (isSearchChunk(f.name)) {
      chunk = true;
      if (kb > chunkKb) out.push(`${f.name}: ${kb.toFixed(1)} kB gzip is over the search page's budget of ${chunkKb} kB (tools/size-budget.ts): trim it, or raise the budget on purpose`);
      continue;
    }
    const s = kbShardName(f.name);
    if (!s) continue;
    seen.add(s);
    const max = budget[s];
    if (max === undefined) out.push(`${f.name}: a knowledge-pack shard with no size budget (${kb.toFixed(1)} kB gzip); add it to KB_SHARD_BUDGET_KB in tools/size-budget.ts`);
    else if (kb > max) out.push(`${f.name}: ${kb.toFixed(1)} kB gzip is over its budget of ${max} kB (tools/size-budget.ts): trim the pack, or raise the budget on purpose`);
  }
  for (const s of Object.keys(budget)) if (!seen.has(s)) out.push(`the ${s} knowledge-pack shard was not built; update KB_SHARD_BUDGET_KB in tools/size-budget.ts`);
  if (!chunk) out.push('the search page chunk (Search-*.js) was not built; update SEARCH_CHUNK_BUDGET_KB in tools/size-budget.ts');
  return out;
}
