// Size budget for the Web Worker bundles (APP-14). Each worker (src/sim/*.worker.ts) loads on first use (the coach,
// Game review, the Matchup Lab and the tournament runner), so its size is a first-load cost on phones. The budgets sit
// just above the sizes when they were set (2026-11-13: game 337 kB, coach 346 kB, review 351 kB), so growth fails the
// build (vite.config.ts) and becomes a decision: trim the bundle, or raise the number here on purpose.
// Added 2026-11-16: the watch worker ("Watch", src/sim/watch.worker.ts: a game played out for a spectator), 355.9 kB
// when added (the engine, the bots and the Game review's strict replay), with the same headroom as the others.
// Lowered 2026-11-16: every worker carried the deck notes' text (src/content/deckObjectives, about 95 kB of it), because
// src/ai/packages.ts imported the whole note table to read the packages each list is built around. It now reads the
// generated slim table (src/content/deckObjectives/noteSynergies.ts, scripts/note-synergies.ts), and the workers went
// from game 356.1, coach 365.0, review 372.9 and watch 359.4 kB to 261.2, 270.2, 278.0 and 264.5 kB. The budgets are
// set about 15 kB above those sizes again (rounded to 5), so the room the notes took is not quietly used up.
// The slim table is all a note still costs a worker: when the 18 player lists' notes were drafted the same day and
// named their packages (19 to 37 lists in the table), each worker grew by 1.0 kB (262.3, 271.2, 279.0, 265.5 kB).

/** kB (1000 bytes, as Vite prints them) per worker, by the name before ".worker". */
// Raised 2026-11-24 on purpose, a deliberate cost accepted the same day (REVIEW_2026-11-24 B.2; about +9 kB gzip per
// worker): src/data/impact.json, the card table src/ai/impact.ts reads and
// so every worker carries, went from the deep bot's 7 meta lists (5.8 kB, 2.7 kB gzip) to the breeder's table of all 71
// library lists (46.7 kB, 11.5 kB gzip), so the coach covers every library list instead of pooling for 64 of them.
// Each worker grew by about 40 kB (game 265.1 → 304.6, coach 279.3 → 318.7, review 285.1 → 324.5, watch 268.3 → 307.8,
// bot 262.8 → 302.2, playout 262.4 → 301.8); the budgets moved by 40 kB, keeping the headroom they had. Easy, Medium and
// Hard read none of the table, so a later trim could load it only where the coach or hard-v1 needs it.
export const WORKER_BUDGET_KB: Readonly<Record<string, number>> = { game: 315, coach: 325, review: 335, watch: 320, bot: 315, playout: 315 };

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

// Size budget for the site search (docs/RAG_PLAN.md step 3). The knowledge-pack files (now part files,
// assets/kb-<group>-<part>-<hash>.json, tools/kb-site.ts) and the search page's chunk load only when a visitor opens #/search and types, so their gzip size
// is what a search costs. Set 2026-11-14 a little above the sizes then (gzip, level 9: core 79.4 kB, events 33.0 kB,
// cardstat 81.9 kB, pkgstat 86.9 kB; the page chunk 11.8 kB): growth fails the build and becomes a decision.
// Decided 2026-11-14: `events` raised from 37 to 84 when events 8 to 14 were recorded (seven more, each with all 47
// decks: the shard went from 33.0 to 77.0 kB). The shard grows with every recorded event, about 6 kB for one with the
// whole library; if that becomes too much for a first search, split it (rounds by event) rather than raise it again.
// Decided 2026-11-16: `events` raised once more, from 84 to 90, for event 15 (all 53 decks: 84.4 kB), which gives the
// Season 3 decks their first ratings. That is room for this one event only: the split is the next step (docs/ROADMAP2.md
// §11 item 19), and the next recorded event fails here until it is done.
// Decided 2026-11-16: `core` raised from 88 to 93 when 18 lists imported from players joined the library (kind
// `shared`: each a deck record and a placeholder note; the shard went from 84.2 to 90.9 kB). It grows by about 0.37 kB
// for each library deck with its note.
// Decided 2026-11-16 (docs/ROADMAP2.md §11 item 19): the files now grow in number, not in size. The pack is a plan of
// groups (src/lib/kb/site.ts SITE_GROUPS), each cut into part files under one per-file cap, and the per-shard budgets
// above are replaced by two numbers: that cap, which the packing keeps to (checked again here as a guard), and a
// budget for everything that loads with the first search (every part of the core, decks, events and ratings groups).
// The first-search sum is 175.9 kB with events 1 to 15 and 185.2 kB with event 16 (71 decks), each group in one part.
// Measured on that data by taking records away: one more event with the whole library adds about 4.6 kB to the events
// group (event 15, 53 decks: 3.1 kB), and the refitted ratings about 0.05 kB for each matchup record that reaches its
// games (event 16 added 37 of them, and first ratings for 18 decks at about 0.15 kB each): about 5 to 7 kB an event.
// One more library deck with its note adds about 0.56 kB (0.23 to 1.15, over every deck and its note; the 0.37 kB
// above was for lists with placeholder notes) to the decks group, and once rated about
// 0.15 kB plus its matchups. So 300 kB is room for about 15 to 20 more full-field events. Raising it is a decision: the
// alternative, loading older events only when asked, needs the keyword ranker's word counts shipped apart from the
// records (every first-search kind counts in them, search.ts STATS_FREE_KINDS), which is a larger change.
// Measured again 2026-11-16 on events 17 to 19 (71 decks each): the sum went from 185.2 to 209.9 kB, 8.2 kB an event
// and more than the 5 to 7 estimated above. The events group took 4.4 kB an event as expected (46.0 to 59.3 kB); the
// ratings group took 3.8 kB an event (47.3 to 58.7 kB), because 169 more pairings got a matchup record in those three
// events (551 to 720 of the 2,485 possible; one is written once a pairing has 6 games, MATCHUP_MIN_GAMES in
// src/lib/kb/build/events.ts). So 300 kB is room for about 11 more full-field events at that rate, not 15 to 20,
// and the ratings group keeps growing until most pairings have their record.
// Measured again 2026-11-16 when the 18 player lists' placeholder notes became drafted notes (each 3,200 to 3,700
// characters, longer than the older notes' 1,800 to 3,000): the decks group went from 46.8 to 59.3 kB and the sum
// from 209.9 to 222.3 kB, 0.69 kB a note. A library deck with a note of that length adds about 1.1 kB, and the room
// left is about 9 full-field events.

/** gzip kB: the most one knowledge-pack part file may weigh (the packing in src/lib/kb/site.ts cuts to it). */
export const KB_FILE_CAP_KB = 90;
/** gzip kB: every part that loads with the first search, together. */
export const KB_FIRST_SEARCH_BUDGET_KB = 300;
/** gzip kB of the search page's chunk (Search-<hash>.js: the page and the search core; 12.26 kB since RAG_PLAN step 4.9). */
export const SEARCH_CHUNK_BUDGET_KB = 13;

/** "kb-events-2-0123abcd.json" → { group: 'events', part: 2 }; null for any other name (an older shard name too). */
export function kbPartName(file: string): { group: string; part: number } | null {
  const m = /(?:^|[\\/])kb-([a-z]+)-([1-9]\d*)-[0-9a-f]+\.json$/.exec(file);
  return m ? { group: m[1]!, part: Number(m[2]) } : null;
}

/** Whether a file is the knowledge pack's (assets/kb-*.json), whatever its name says after that. */
export const isKbFile = (file: string): boolean => /(?:^|[\\/])kb-[^\\/]*\.json$/.test(file);

/** "Search-CqcC5VWM.js" → true: the search page's chunk. */
export const isSearchChunk = (file: string): boolean => /(?:^|[\\/])Search-[\w-]+\.js$/.test(file);

export interface SearchBudget {
  fileCapKb: number;
  firstSearchKb: number;
  chunkKb: number;
}
export const SEARCH_BUDGET: SearchBudget = { fileCapKb: KB_FILE_CAP_KB, firstSearchKb: KB_FIRST_SEARCH_BUDGET_KB, chunkKb: SEARCH_CHUNK_BUDGET_KB };

/**
 * What is wrong with the search's files, by gzip size, against the plan of groups (`groups`: name and whether it loads
 * late): a part file over the per-file cap, the first-search parts together over their budget, a knowledge-pack file
 * the plan does not know, a planned group with no part, the page chunk over its budget or not built. Empty when all is
 * well.
 */
export function searchBudgetProblems(files: readonly { name: string; gzipBytes: number }[], groups: readonly { name: string; late: boolean }[], budget: SearchBudget = SEARCH_BUDGET): string[] {
  const out: string[] = [];
  const late = new Map(groups.map((g) => [g.name, g.late]));
  const built = new Set<string>();
  let first = 0;
  let chunk = false;
  for (const f of files) {
    const kb = f.gzipBytes / 1000;
    if (isSearchChunk(f.name)) {
      chunk = true;
      if (kb > budget.chunkKb) out.push(`${f.name}: ${kb.toFixed(1)} kB gzip is over the search page's budget of ${budget.chunkKb} kB (tools/size-budget.ts): trim it, or raise the budget on purpose`);
      continue;
    }
    if (!isKbFile(f.name)) continue;
    const p = kbPartName(f.name);
    if (!p || !late.has(p.group)) {
      out.push(`${f.name}: a knowledge-pack file that is not a part of any group in the plan (SITE_GROUPS in src/lib/kb/site.ts)`);
      continue;
    }
    built.add(p.group);
    if (kb > budget.fileCapKb) out.push(`${f.name}: ${kb.toFixed(1)} kB gzip is over the per-file cap of ${budget.fileCapKb} kB (tools/size-budget.ts); the packing in src/lib/kb/site.ts should have cut it smaller`);
    if (!late.get(p.group)) first += f.gzipBytes;
  }
  for (const g of groups) if (!built.has(g.name)) out.push(`the ${g.name} group of the knowledge pack built no part file`);
  if (first / 1000 > budget.firstSearchKb)
    out.push(`the parts that load with the first search weigh ${(first / 1000).toFixed(1)} kB gzip together, over the first-search budget of ${budget.firstSearchKb} kB (tools/size-budget.ts): trim the pack, or raise the budget on purpose`);
  if (!chunk) out.push('the search page chunk (Search-*.js) was not built; update SEARCH_CHUNK_BUDGET_KB in tools/size-budget.ts');
  return out;
}
