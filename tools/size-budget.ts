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
