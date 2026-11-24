// Season runner: breed 8 new decks (or more with --breed-count, screened, the best 8 taken) → gate each against its
// reference (open slots refilled from the screen's runners-up, each gated too) → write the decks that enter → forge them →
// tournament (telemetry round robin) → finals vs meta → update the all-time leaderboard (pooled win rate vs the meta
// archetypes, with percentiles). The round robin comes after the forge, so the round robin, the finals and the
// leaderboard all measure the forged lists.
//
//   npx tsx scripts/season.ts [--season N] [--games 16] [--bot hard] [--finals 42] [--forge-gens 1] [--forge-games 112] [--threads N] [--force]
//
//   --season  defaults to the next season not yet recorded
//   --bot     the bot of the round robin and the finals (default hard, the bot seasons are played with since Season 3;
//             Seasons 1 and 2 used deep). data/seasons/impact.json and deck-impact.json keep each simulator version and
//             bot apart, and the round robin's numbers are added to the entry of the current version and this bot only.
//             The breeder reads one pair's numbers, never a sum of two (src/lib/breederImpact.ts): this version and bot;
//             when they have none yet, with a warning, the closest there are (this version with another bot, else the
//             highest other version); with none anywhere, card value alone, with a warning. Measured on Medium, numbers
//             from an older version bred better lists than none (docs/SYNERGIES.md, "The breeder's card impact").
//   --force   re-run a season that is already recorded. Its leaderboard totals (kept per season in leaderboard.json)
//             are taken out first, so nothing is counted twice; its s<N>-*.txt decks are bred again and overwritten
//             (a deck file of the earlier run whose deck does not enter this time is left in place, with a warning).
//             Seasons recorded before per-season totals existed cannot be taken out: restore leaderboard.json first.
//             The pooled card-impact files are not added to again on a re-run (the same seeds play the same games).
//             The same holds, re-run or not, when both card-impact files already count the season (a run that stopped
//             after writing them): the season says so at its start. When only one of the two counts it, the season
//             refuses to start, naming which (npm run check:data shows it too).
//
// The gate (docs/SYNERGIES.md "A bred deck's test against its parent"; src/lib/breedGate.ts): each bred deck plays its
// reference (by default the middle meta deck by strength, one fixed bar for all; with --gate-reference parent its best
// parent, with median the library's median deck by rating) on the same games against the other decks of the field, in
// stages, first with Medium, then with Hard for every deck, and enters unless Hard shows it worse ("could not tell"
// enters; since 2026-11-24, --gate-keep-out). A deck kept out gets no deck file; its list, reference, figures and
// verdict are kept in data/seasons/season-<N>.json ("gate") and the season report, and its Legend trio counts as seen
// when later seasons of the same simulator version breed. Gate games count for no rating, leaderboard, card impact,
// change ledger or evidence file; their seeds are N·1,000,000 + 700,000 (first bot) and + 800,000 (confirming bot).
// Before it plays, the gate prints what it may cost in all (at most 10,800 Medium and 4,320 Hard games for 8 decks
// against one fixed bar on the 6 other meta decks; more with --field-top).
//   --gate on|off              default on; off enters every bred deck as before
//   --gate-bot BOT             the first bot (default medium)
//   --gate-confirm-bot BOT     the confirming bot (default hard; none: no confirming bot, and the first bot decides; the
//                              first bot under another name plays nothing more)
//   --gate-keep-out confirming|either   which bot can keep a deck out (default confirming, since 2026-11-24): every deck
//                              plays the confirming bot's stages and is kept out only when the confirming bot shows it
//                              worse (the first bot's verdict is kept as information); either: the rule of 2026-11-15, a
//                              deck the first bot shows worse is kept out without the confirming bot playing
//   --gate-rounds N            double rounds per stage (default 20: 280 games with 7 opponents, 240 with 6)
//   --gate-stages N            the first bot's stages at most (default 5)
//   --gate-confirm-stages N    the confirming bot's stages at most (default 2)
//   --gate-reference middle|parent|median   which reference (default middle): middle tests every bred deck against the
//                              middle meta deck by strength, one fixed bar for all; parent tests each against its best
//                              parent (an explorer, which has none, still plays the bar), the plan's original rule;
//                              median (since 2026-11-24) tests every bred deck against the library deck at the median by
//                              rating, one fixed bar on the library's scale. The owner chose the middle bar on 2026-11-15
//                              after the check on the recorded bred decks: with the parent as reference 2 of 16 would
//                              have entered and the five best-rated kept out; against the bar 9 (docs/SYNERGIES.md).
//                              Kept in the record's settings.
//   --gate-only                breed and gate, then stop: no deck file, leaderboard, impact file or report in the
//                              repository changes (a recorded season may be gated again this way: it breeds as a --force
//                              re-run would). With --gate off it breeds and stops.
//   --out DIR                  with --gate-only: write season-<N>-gate.json and season-<N>-gate.md into DIR
//
// Breeding more than the slots (off by default):
//   --breed-count N            breed N candidates (more than 8) and screen them, then gate the best 8 (default 0: breed
//                              exactly 8, no screen)
//   --screen-games N           Medium games per candidate in the screen, against the meta decks (default 70)
//   When the gate keeps decks out, their slots go to the next runners-up by the screen, as many as there are open slots,
//   each gated the same way on the same games before it takes a slot; again until the slots are full or the runners-up
//   run out. A runner-up the gate keeps out is handled like any deck kept out. The season file's gate record lists every
//   deck tested, a runner-up with `refill` (its round), and `refills` (how many were tested).
//
// The four ways of breeding (src/ai/breeder.ts): mutants and crossovers of the top decks, counters and explorers (new
// Legend trios). A counter is bred from the decks with the best head-to-head estimates against the top 4; those
// estimates are shrunk toward the power ratings and today follow them almost exactly, so a counter is in effect a
// crossover of the top decks (on 2026-11-24 the counter score's rank correlation with the rating order was 0.995 to 0.999).
//
// One entry per list (src/lib/distinctLists.ts; scripts/season-field.ts): the round robin's field holds each list once.
// Two decks are the same list when their Legends and main deck are the same, whatever their names. An incumbent whose
// list is already in the field is passed over for the next one by strength, and the season prints which. A bred deck
// cannot be the same list as a library deck (it never gets a library deck's Legend trio); if one ever were, it would take
// no slot, and the season would say so before the gate.
//   --allow-same-lists         the field as before the rule (the first 8 incumbents whatever their lists), and bred decks
//                              are not checked
//
// Parents are ranked by strength (src/lib/parentStrength.ts): the power rating's estimate, for library decks with 100 or
// more games on their current list (since 2026-11-24: no leaderboard blend, no lower-bound discount; the season prints the
// decks left out for too few games). The breeder scores Legends by their marginal effect and holds every method to two
// colours (src/ai/breeder.ts BREED_POLICY, since 2026-11-24). Legend trios the gate kept out, or a season retired, count
// as seen only for later seasons of the same simulator version.
//
// The tuning field (since 2026-11-24; src/lib/tuningField.ts):
//   --field-top N              the screen, the gate and the forge step play the 7 meta decks and the library's top N
//                              lists by rating, one entry per list (default 0: the meta decks alone, as every season
//                              before). Passed to the forge as --field-top N. The change ledger keys its entries on the
//                              field's lists, so with another field the forge's ledger entries start afresh (games against
//                              the meta decks alone never pool with games against the wider field). The gate's stages
//                              grow with the field (2 × rounds × opponents games a stage).
//
// The round robin as a rating run (since 2026-11-24; scripts/season-run.ts, docs/SERIES.md):
//   --rating-run on|off        default on: after the round robin, its games are written as data/series/run-N.json (the
//                              next run number; a --force re-run replaces its own), checked against every recorded game
//                              first, so the ratings, head-to-heads and evidence count them once rebuilt (the season prints
//                              the rebuild commands). Only with --bot hard (the series' bot): a run with another bot would
//                              switch the ratings' pool. Past seasons' games were not stored, so this starts with Season 4.
//
// Retirement (opt-in, since 2026-11-24; scripts/season-retire.ts):
//   --retire-below-meta-median before breeding, every earlier season's bred deck rated below the meta decks' median
//                              (power rating estimate, 100 or more games) moves to data/decks/archive/<stem>-v<version>.txt
//                              with its note moved to src/content/deckObjectives/archived.ts; recorded in the season file
//                              (`retired`), its trio counted as seen. With --gate-only it only says which would retire.
//
// Synergy packages (opt-in; docs/SYNERGIES.md "Using packages when building"; without these flags the season breeds,
// forges and reports exactly as before):
//   --seed-packages a+b,c    the explorers are built around these combinations of one or two packages, in turn
//   --require-packages a,b   every bred deck is built around these
//   --keep-packages a,b      a bred deck is built around a kept package when a parent was; the forge never cuts it
//                            (the forge also keeps the seeded packages)
//   --avoid-packages a,b     no bred deck is built around these
//   --package-moves          the forge also tries whole-package moves
//   --keep-built-around      the forge also keeps each new deck's own built-around packages (the Deck Lab's default keep)
//   Bred deck files then carry a "// Packages:" line, and the season report and manifest name the plan.
//
// Adoption rule and search depth for the forge step (passed on to scripts/forge.ts; docs/SYNERGIES.md "When a deck
// change is adopted"): --adopt evidence|any-gain (default evidence; any-gain reproduces seasons before 2026-11-11),
// --min-gain P, --package-min-gain P, --min-games N, --confirm-cap K, --alpha A, --futility-after N (2; 0 = off),
// --futility-gain X (0), --cards-per-change N,
// --packages-per-change N, --nominees N, --combine-from N, and --forge-budget N (games per forged deck, default 12000:
// the season refuses to start when the forge step could play more).
// --ledger (and --ledger-dir DIR) turns the change ledger on for the forge step (docs/SYNERGIES.md "Pooling held-out
// games across runs"; off by default, and without it nothing changes).
// --pooled-ranking (with --ledger; and --carry N, --reach N) turns the shortlist from pooled evidence on for the forge
// step (docs/SYNERGIES.md "A shortlist carried across runs"; off by default, and without it nothing changes).
// --until-settled is on by default (the evidence rule only; --reach N is its reach too); --no-until-settled turns it off.
// The forge-budget check refuses on the usual estimate. The season passes --forge-budget to the forge as --budget, and
// since 2026-11-24 the forge caps until settled's further stages so the run stays within it (settleStagesWithin; the
// season never passes --force), so the printed line gives what they may add within the budget (settleExtraWithin).
// With --screen-rounds the season's estimate counts the rounds' own seed block as the forge's does, so the forge does not
// refuse a run the season's check let through.
// --confirm-bot BOT has the forge step's confirmation stages played by BOT (its screening stays with lookahead, Medium;
// docs/SYNERGIES.md "Confirming with another bot"; default lookahead, and then nothing changes).
// --screen-rounds N, --initial-cands N, --per-deck-adds and --per-deck-bot BOT go to the forge step (successive halving
// and per-deck additions, scripts/forge.ts; off by default, and without them nothing changes).
//
// Outputs: data/decks/custom/s<N>-*.txt (the decks that entered), reports/season-<N>.md, data/seasons/season-<N>.json,
//          data/seasons/leaderboard.json, src/data/seasons.json (site), data/seasons/impact.json and deck-impact.json,
//          data/series/run-<M>.json (the round robin as a rating run), and with --retire-below-meta-median the moved
//          deck files and notes.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { BREED_POLICY, breedSeason, pickScreened, screenSeeds, type Bred, type ScreenedBreed } from '../src/ai/breeder';
import { expiredTriples, keptOutTriples, loadH2H, loadImpactTables, readRatedDecks, recordSeasonImpact, SEASON_BOT, seasonImpactCount, strengthOf } from './breed-data';
import { impactTablesWords, seasonCountWords } from '../src/lib/breederImpact';
import { COUNTER_NOTE } from '../src/lib/bredDecks';
import { rankParents } from '../src/lib/parentStrength';
import { confirmBotOf, enteredWords, gateDetectWords, gateGuaranteeWords, gatePlanCostWords, gateRuleWords, gateSeeds, gateSlots, gateStageGames, gateWords, keepReferences, planGate, refillCounts, refillRoundWords, runGate, spreadSeen, spreadSeenWords, stepWords, type GateOptions, type SlotTest } from '../src/lib/breedGate';
import { DEFAULT_FIELD_TOP, tuningField, tuningFieldWords } from '../src/lib/tuningField';
import { ratingRunSkipWords, recordsRatingRun, SEASON_RUN_NEXT, seasonRatingRun, seasonRunFile, seasonRunNumber, writeSeasonRun } from './season-run';
import { RETIRE_NEXT, retireBelowMetaMedian, retirementWords, retireDecks, type Retired } from './season-retire';
import { asWritten, gateDeckRecord, gateFooterLines, gateHeaderLines, gatePlayOver, gateSettings, seasonGateFlags, seedProblem } from './gate-run';
import type { DeckList } from '../src/engine/types';
import { exportOfficial, deckColors, listFingerprint } from '../src/engine/deck';
import { analyzeAll } from '../src/analysis/analyze';
import { classify } from '../src/ai/archetype';
import { bool, cli, existing, Refusal, int, loadLibrary, oneOf, runJobs, runMain, SIM_BOTS, slugify, threadsOpt, writeJsonStamped } from './lib-node';
import { breederPackageFlags, exitOnPlanProblems, packagesOn, planArgs, planFromFlags, seedsFromFlags } from './package-flags';
import { describePlan, packageName, packageProvenance } from '../src/lib/deckPackages';
import type { MatchJob, MatchResult } from './worker';
import { gameRunManifest } from '../src/lib/runManifest';
import { adoptionArgs, adoptionFlags, checkBudget, confirmBotArgs, confirmBotFlag, confirmBotFromFlags, depthFlags, depthFromFlags, exitOnRuleProblems, halvingArgs, halvingFlags, ledgerArgs, ledgerFlags, ledgerFromFlags, ruleFromFlags, settleArgs, settleFlags, settleFromFlags, shortlistArgs, shortlistFlags, shortlistFromFlags } from './evidence-flags';
import { adoptionProvenance, describeRule, scoreOf, settleStages } from '../src/lib/evidence';
import { DEFAULT_GAME_BUDGET, detect, detectWords, estimateGames, perGameSd, settleExtra } from '../src/lib/deckSearch';
import { SIM_VERSION } from '../src/lib/tournament';
import { leftOutLine } from '../src/lib/distinctLists';
import { sameListBred, seasonField } from './season-field';
import { uncountSeason, type Entry } from './season-leaderboard';

const { values: V } = cli(import.meta.url, {
  season: int(undefined, { min: 1 }),
  games: int(16, { min: 1 }),
  bot: oneOf(SIM_BOTS, SEASON_BOT),
  finals: int(42, { min: 1 }),
  'forge-gens': int(1, { min: 1 }),
  'forge-games': int(112, { min: 1 }),
  threads: threadsOpt(),
  force: bool(),
  ...breederPackageFlags(),
  'package-moves': bool(),
  'keep-built-around': bool(),
  ...adoptionFlags(),
  ...depthFlags(1),
  'forge-budget': int(DEFAULT_GAME_BUDGET, { min: 1 }),
  ...ledgerFlags(),
  ...shortlistFlags(),
  ...settleFlags(),
  'no-until-settled': bool(),
  ...confirmBotFlag(),
  ...halvingFlags(),
  ...seasonGateFlags(),
  'allow-same-lists': bool(),
  'breed-count': int(0, { min: 0 }),
  'screen-games': int(70, { min: 1 }),
  'field-top': int(DEFAULT_FIELD_TOP, { min: 0, max: 64 }),
  'rating-run': oneOf(['on', 'off'] as const, 'on'),
  'retire-below-meta-median': bool(),
});
// checked here so a bad --ledger-dir use stops the season before it starts (the forge step runs with --bot lookahead)
const SEASON_LEDGER = ledgerFromFlags(V, { bot: 'lookahead' });
const PACKAGES = packagesOn(V);
const PLAN = planFromFlags(V);
exitOnPlanProblems(PLAN);
const RULE = ruleFromFlags(V);
exitOnRuleProblems(RULE);
// --confirm-bot goes to the forge step (whose --bot is lookahead); refused here as the forge would refuse it
const FORGE_CONFIRM = confirmBotFromFlags(V, { bot: 'lookahead' });
// --pooled-ranking (and --carry, --reach) go to the forge step; refused here as the forge would refuse them
shortlistFromFlags(V, { ledger: !!SEASON_LEDGER, rule: RULE });
// --until-settled is on by default for the season; --no-until-settled turns it off. The forge still takes the flag.
const SEASON_SETTLE_ON = !V['no-until-settled'] && (V['until-settled'] || RULE.kind === 'evidence');
const SETTLE = settleFromFlags({ ...V, 'until-settled': SEASON_SETTLE_ON }, { rule: RULE });
const DEPTH = depthFromFlags(V, 1);
const FORGE_SCREEN_ROUNDS = V['screen-rounds'] ?? 1;
/** the forge step's cost per new deck (5 candidate swaps, package moves when on, halving's own block when on), checked before the season starts */
const FORGE_ESTIMATE = estimateGames({
  gens: V['forge-gens'],
  screenGames: V['forge-games'],
  singles: 5,
  packageMoves: PACKAGES ? (V['package-moves'] ? 3 : 0) + (V['require-packages'] ? 3 : 0) : 0,
  depth: DEPTH,
  firstStage: V['forge-games'] * 2,
  rule: RULE,
  // the forge's own estimate for the halving flags passed on (--cands 5): its rounds play a seed block of their own
  ...(FORGE_SCREEN_ROUNDS > 1 ? { screenRounds: FORGE_SCREEN_ROUNDS, initialCands: V['initial-cands'] ?? 20 /* the forge's max(--cands 5, 20) */, ownHalvingBlock: true } : {}),
});
/** --until-settled: what it may add per new deck before the budget's cap (the forge's 50,000 confirmation seeds a generation, and the reach); checkBudget prints it within --forge-budget */
const FORGE_SETTLE_EXTRA = SETTLE
  ? settleExtra({
      gens: V['forge-gens'],
      firstStage: V['forge-games'] * 2,
      stages: settleStages({ seedStages: Math.floor(50_000 / (V['forge-games'] * 2)) - RULE.capStages, reach: SETTLE.reach, firstStage: V['forge-games'] * 2, capStages: RULE.capStages }),
      nominees: DEPTH.nominees,
    })
  : undefined;
const SEEDS = seedsFromFlags(V);
const NL = String.fromCharCode(10);
const SEASON_RE = /^season-(\d+)\.json$/;
const recordedSeasons = () => (fs.existsSync('data/seasons') ? fs.readdirSync('data/seasons').filter((f) => SEASON_RE.test(f)).map((f) => +f.match(SEASON_RE)![1]) : []);
const SEASON = V.season ?? Math.max(0, ...recordedSeasons()) + 1;
// ---- the gate's settings, refused (exit 2) before anything is read or played
const GATE_ON = V.gate === 'on';
const GATE_ONLY = V['gate-only'];
const GATE: GateOptions = {
  bot: V['gate-bot'],
  confirmBot: V['gate-confirm-bot'] === 'none' ? null : V['gate-confirm-bot'],
  rounds: V['gate-rounds'],
  stages: V['gate-stages'],
  confirmStages: V['gate-confirm-stages'],
  reference: V['gate-reference'],
  keepOut: V['gate-keep-out'],
  seeds: gateSeeds(SEASON),
};
/** --field-top N: the screen, the gate and the forge step play the meta decks and the library's top N lists (0: the meta decks) */
const FIELD_TOP = V['field-top'];
function flagError(message: string): never {
  console.error(`error: ${message}${NL}Run with --help for usage.`);
  process.exit(2);
}
if (V.out !== undefined && !GATE_ONLY) flagError('--out writes the --gate-only files; a full season writes to the repository');
if (V.out !== undefined && fs.existsSync(V.out) && !fs.statSync(V.out).isDirectory()) flagError(`--out ${V.out} is a file, not a folder`);
if (GATE_ON) {
  // the largest field a deck can face: the meta decks and the top lists (7 + N; a deck's own field leaves out its reference)
  const most = gateStageGames(GATE.rounds, 7 + FIELD_TOP);
  const sp = seedProblem({ first: GATE.seeds.first, confirm: GATE.seeds.confirm, firstGames: most * GATE.stages, confirmGames: confirmBotOf(GATE.bot, GATE.confirmBot) ? most * GATE.confirmStages : 0, limit: (SEASON + 1) * 1_000_000 });
  if (sp) flagError(sp);
}
const GAMES = V.games;
const BOT = V.bot;
const FINALS = V.finals;
const FORGE_GENS = V['forge-gens'];
const FORGE_GAMES = V['forge-games'];
const FORCE = V.force;
const THREADS = Math.min(V.threads, 16);
const ALLOW_SAME_LISTS = V['allow-same-lists'];
const BREED_COUNT = V['breed-count'] || 0; // 0 = breed exactly 8 (no screening)
const SCREEN_GAMES = V['screen-games'];
const SEASON_FILE = `data/seasons/season-${SEASON}.json`;

// ---------------------------------------------------------------- leaderboard
const LB_FILE = 'data/seasons/leaderboard.json';
const lib = loadLibrary();
const metaDecks = lib.filter((d) => d.kind === 'meta');
const metaNames = new Set(metaDecks.map((d) => d.deck.name));

function loadLB(): Record<string, Entry> {
  if (fs.existsSync(LB_FILE)) return JSON.parse(fs.readFileSync(LB_FILE, 'utf8'));
  // Season 0 seed: the 28-deck deep round robin (src/data/review.json) + finals reports
  const R = JSON.parse(fs.readFileSync('src/data/review.json', 'utf8'));
  const lb: Record<string, Entry> = {};
  for (const d of R.decks) {
    const L = lib.find((x) => x.deck.name === d.name);
    if (!L) continue;
    let W = 0;
    let G = 0;
    for (const m of metaNames) {
      if (m === d.name || R.matrix[d.name]?.[m] === undefined) continue;
      W += R.matrix[d.name][m] * R.games;
      G += R.games;
    }
    lb[d.name] = mkEntry(L, 0, L.kind === 'original' ? 'NC original' : L.kind === 'custom' ? 'variant' : L.kind);
    lb[d.name].metaW = W;
    lb[d.name].metaG = G;
    lb[d.name].seasons['0'] = d.winRate;
  }
  for (const L of lib) {
    const f = `reports/test-${L.file.replace(/\.txt$/, '')}-latest.json`;
    if (!fs.existsSync(f) || !lb[L.deck.name]) continue;
    addFinals(lb[L.deck.name], JSON.parse(fs.readFileSync(f, 'utf8')));
  }
  return lb;
}
function mkEntry(L: (typeof lib)[number], season: number, origin: string): Entry {
  return {
    name: L.deck.name,
    file: L.file,
    kind: L.kind,
    origin,
    colors: deckColors(L.deck),
    arch: classify(L.deck.main).arch,
    firstSeason: season,
    metaW: 0,
    metaG: 0,
    seasons: {},
    idea: L.idea,
  };
}
/** Add to an entry's pooled vs-meta record, remembering which season it came from (season 0 = the seed data). */
function credit(e: Entry, season: number, w: number, g: number) {
  e.metaW += w;
  e.metaG += g;
  if (!season) return;
  const c = ((e.contrib ??= {})[String(season)] ??= { w: 0, g: 0 });
  c.w += w;
  c.g += g;
}
function addFinals(e: Entry, t: { overall: number; rows: { b: string; aWins: number; ties: number; games: number }[] }, season = 0) {
  let w = 0;
  let g = 0;
  for (const r of t.rows) {
    if (!metaNames.has(r.b)) continue;
    w += r.aWins + r.ties / 2;
    g += r.games;
  }
  credit(e, season, w, g);
  if (g) {
    e.finals = w / g;
    if (season) e.contrib![String(season)].finals = true;
  }
}
const vsMeta = (e: Entry) => (e.metaG ? e.metaW / e.metaG : 0);
/** Ranking score: win rate vs meta shrunk toward 50% by a 60-game prior (small samples can't top the board). */
const PRIOR = 60;
const rating = (e: Entry) => (e.metaW + 0.5 * PRIOR) / (e.metaG + PRIOR);

function saveLB(lb: Record<string, Entry>) {
  const list = Object.values(lb).filter((e) => e.metaG > 0).sort((a, b) => rating(b) - rating(a));
  const n = list.length;
  const rows = list.map(({ contrib: _contrib, ...e }, i) => ({
    ...e,
    vsMeta: vsMeta(e),
    rating: rating(e),
    percentile: n > 1 ? Math.round((100 * (n - 1 - i)) / (n - 1)) : 100,
  }));
  fs.writeFileSync(LB_FILE, JSON.stringify(lb, null, 1));
  const seasons = fs
    .readdirSync('data/seasons')
    .filter((f) => /^season-\d+\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(`data/seasons/${f}`, 'utf8')))
    .sort((a, b) => a.season - b.season);
  // what the site reads to label the leaderboard current or historical (src/data/index.ts SeasonsData): the lowest sim
  // version of the recorded seasons, 0 when any season predates manifests, and each season's run
  const inputs = seasons.map((s) => ({ season: s.season as number, runId: (s.manifest?.runId as string | undefined) ?? null, simVersion: typeof s.manifest?.simVersion === 'number' ? (s.manifest.simVersion as number) : null }));
  const manifest = { kind: 'seasons', simVersion: inputs.length ? Math.min(...inputs.map((x) => x.simVersion ?? 0)) : SIM_VERSION, inputs };
  writeJsonStamped('src/data/seasons.json', { updated: '', leaderboard: rows, seasons, manifest }, { indent: 1 });
  return rows;
}

// ---------------------------------------------------------------- season
async function main() {
  const startedAt = new Date().toISOString();
  if (!GATE_ONLY) {
    console.log(`Forge adoption rule: ${describeRule(RULE, { firstStage: FORGE_GAMES * 2, nominees: DEPTH.nominees, ledger: V.ledger, ...(SETTLE ? { untilSettled: SETTLE } : {}), ...(FORGE_CONFIRM ? { confirmedWith: FORGE_CONFIRM } : {}) })}`);
    // what a first confirmation adopts: default spreads (the forge will refine per deck from the ledger)
    const detectLine = detectWords(detect({ rule: RULE, firstStage: FORGE_GAMES * 2, nominees: DEPTH.nominees, sd: perGameSd(undefined, FORGE_CONFIRM?.confirm), ...(SETTLE ? { untilSettled: SETTLE } : {}), ...(FORGE_CONFIRM ? { confirmedWith: FORGE_CONFIRM } : {}) }));
    console.log(detectLine);
    // refuse before anything is played or written: the forge step would refuse later, after the gate
    checkBudget(`season forge step, ${FORGE_GENS} generation${FORGE_GENS === 1 ? '' : 's'}`, FORGE_ESTIMATE, V['forge-budget'], false, FORGE_SETTLE_EXTRA, FORGE_CONFIRM ? { with: FORGE_CONFIRM, games: FORGE_GENS * FORGE_ESTIMATE.confirm } : undefined);
  }
  const lb = loadLB();
  // ---- refuse to count a season twice (--gate-only writes nothing, so it may look at a recorded season again)
  const counted = Object.values(lb).some((e) => e.seasons[String(SEASON)] !== undefined || e.contrib?.[String(SEASON)]);
  // (a run that stopped after writing its rating run, before the season file, counts as recorded too)
  const ownRun = seasonRunFile(SEASON);
  const rerun = counted || fs.existsSync(SEASON_FILE) || !!ownRun;
  if (rerun && !FORCE && !GATE_ONLY) {
    throw new Refusal(`season ${SEASON} is already recorded (${fs.existsSync(SEASON_FILE) ? SEASON_FILE : counted ? 'in data/seasons/leaderboard.json' : `as rating run data/series/${ownRun!.file}`}). Leave out --season to run season ${Math.max(SEASON, ...recordedSeasons()) + 1}, or pass --force to re-run it.`);
  }
  // (in memory until the leaderboard is saved; --gate-only never saves it)
  if (counted && !uncountSeason(lb, SEASON)) {
    if (!GATE_ONLY) throw new Refusal(`season ${SEASON} was counted into data/seasons/leaderboard.json before per-season totals were kept, so re-running it would count its games twice. Restore leaderboard.json to its state before season ${SEASON} (git history) or run a new season.`);
    console.log(`warning: season ${SEASON} was counted before per-season totals were kept; its games stay in the leaderboard numbers this run reads.`);
  }
  if (rerun && !GATE_ONLY) console.log(`--force: re-running season ${SEASON}; its previous leaderboard totals were taken out.`);
  if (rerun && Math.max(0, ...recordedSeasons()) > SEASON) console.log(`warning: later seasons (up to ${Math.max(...recordedSeasons())}) were bred from season ${SEASON}'s decks.`);
  // ---- is this season's round robin already in the card-impact files? Decided now, before anything is played: a run
  // that stopped after writing them (before the leaderboard and season file) is not a re-run, and must not fail at the
  // end; one file without the other is refused here (the throw in addToCardImpact / addToDeckImpact is the last guard)
  const impactCount = seasonImpactCount(SEASON);
  const countWords = seasonCountWords(SEASON, impactCount);
  if (countWords?.refuse && !GATE_ONLY) throw new Refusal(countWords.line);
  // (--gate-only writes no impact file, so it only warns about files out of step)
  if (countWords && (countWords.refuse || !GATE_ONLY)) console.log(countWords.refuse ? `warning: ${countWords.line}` : countWords.line);
  const impactRecorded = impactCount.state !== 'neither';
  // the card impact of one pair: this simulator version and the season's bot when they have numbers, else the closest
  // pair with a warning (src/lib/breederImpact.ts); the other pairs are kept in the files, not read
  const tables = loadImpactTables(BOT);
  for (const l of impactTablesWords(tables)) console.log(l);
  // 0. retirement (opt-in, --retire-below-meta-median): earlier seasons' bred decks rated below the meta decks' median
  // leave the library before anything is bred; the files move at step 3, with the other writes (scripts/season-retire.ts)
  const ratingsRows = readRatedDecks()?.decks ?? [];
  const retirement = V['retire-below-meta-median'] ? retireBelowMetaMedian(lib, ratingsRows, SEASON, SIM_VERSION) : null;
  if (retirement) for (const l of retirementWords(retirement, GATE_ONLY ? 'would retire' : 'retired')) console.log(l);
  const retiredFiles = new Set((retirement?.retired ?? []).map((r) => r.file));
  /** the library this season breeds from: without the decks it retires */
  const active = lib.filter((d) => !retiredFiles.has(d.file));
  // parents for breeding: every library deck with 100 or more games on its list, incl. the meta archetypes, by the power
  // rating's estimate (src/lib/parentStrength.ts; no leaderboard blend since 2026-11-24)
  const strength = strengthOf();
  const ranked = rankParents(strength, active);
  const h2hAll = loadH2H();
  const hasH2H = ranked.slice(0, 4).some((x) => ranked.some((y) => h2hAll(y.deck.name, x.deck.name).g > 0));
  // the screen's, the gate's and the forge's field: the meta decks, and with --field-top N the library's top N lists
  const tField = tuningField(active, ranked, FIELD_TOP);
  const tFieldDecks = tField.field.map((d) => d.deck);
  console.log(`Tuning field: ${tuningFieldWords(tField)}${tField.added.length ? ` (${tField.added.map((d) => d.deck.name).join(', ')})` : ''}.`);
  if (tField.left.length) console.log(`  passed over (their list is in the field already): ${tField.left.map((s) => `${s.deck.deck.name} (same list as ${s.sameAs.deck.name})`).join(', ')}`);
  /** the gate's options with the field named in its words */
  const gateOpts: GateOptions = { ...GATE, fieldWords: FIELD_TOP ? `the other decks of the field (${tuningFieldWords(tField)})` : 'the other meta decks' };
  // 1. breed
  // (on a re-run, this season's own earlier decks don't count as seen, so the breeder makes the same choices; the Legend
  // trios that earlier seasons of this simulator version kept out at the gate or retired count as seen, so the same trio
  // is not built again, and so do the trios this season retires)
  const expired = expiredTriples(undefined, rerun ? SEASON : undefined);
  if (expired) console.log(`${expired} Legend trio${expired === 1 ? '' : 's'} kept out or retired by seasons of another simulator version ${expired === 1 ? 'is' : 'are'} open again (they expire when the simulator version changes).`);
  const seen = new Set([
    ...active.filter((d) => !(rerun && d.file.startsWith(`s${SEASON}-`))).map((d) => [...d.deck.legends].sort().join('|')),
    ...keptOutTriples(undefined, rerun ? SEASON : undefined),
    ...(retirement?.retired ?? []).map((r) => [...r.legends].sort().join('|')),
  ]);
  // each bred list in the order its deck file will read back (asWritten): the card order changes the games a seed deals,
  // so the gate plays the list as the forge, the round robin and anyone replaying the record will have it. The deck
  // files are the same either way (the export does not depend on the order).
  const screening = BREED_COUNT > 8;
  // (the breeding policy since 2026-11-24: Legends by marginal effect, two colours at most for every method)
  const bredRaw = breedSeason(SEASON, { ranked, impact: tables.impact, seenTriples: seen, seed: 1000 + SEASON * 77, deckImpact: tables.deckImpact, h2h: hasH2H ? h2hAll : undefined, ...(PACKAGES ? { packages: { plan: PLAN, seeds: SEEDS } } : {}), ...BREED_POLICY }, 8, screening ? BREED_COUNT : undefined).map((b) => ({ ...b, deck: asWritten(b.deck) }));
  const fileOf = (d: DeckList) => `${slugify(d.name)}.txt`;
  // one entry per list: a bred deck with a library deck's list (or an earlier bred deck's) takes no slot. It cannot
  // happen (see scripts/season-field.ts), so this is a guard; this season's own earlier decks don't count on a re-run.
  const sameBred = ALLOW_SAME_LISTS ? { kept: bredRaw, left: [] } : sameListBred(bredRaw, active.filter((d) => !(rerun && d.file.startsWith(`s${SEASON}-`))), fileOf);
  if (sameBred.left.length) console.log(`warning: ${leftOutLine(sameBred.left)} They take no season slot.`);
  let bred: Bred[] = sameBred.kept;
  console.log(`Season ${SEASON}: bred ${bred.length} candidates (${bred.map((b) => b.deck.name).join(', ')})`);
  if (bred.some((b) => b.method === 'counter')) console.log(COUNTER_NOTE);

  // 1b. screen: when breeding more than 8, play each a short block of Medium games and pick the best 8
  let screenRecord: { breedCount: number; screenGames: number; screened: { name: string; method: string; wr: number; games: number }[] } | null = null;
  let runners: ScreenedBreed[] = [];
  if (screening && bred.length > 8) {
    const screenField = tFieldDecks;
    const screenSeed = screenSeeds(SEASON);
    console.log(`Screening ${bred.length} candidates: ${SCREEN_GAMES} Medium games each against ${tuningFieldWords(tField)}…`);
    const screenJobs: MatchJob[] = [];
    for (const b of bred) {
      const nf = screenField.length;
      for (let k = 0; k < SCREEN_GAMES; k++) screenJobs.push({ a: b.deck, b: screenField[k % nf]!, seed: screenSeed + screenJobs.length, first: (Math.floor(k / nf) % 2) as 0 | 1, bot: 'medium' });
    }
    const screenRes: MatchResult[] = await runJobs(screenJobs, { threads: THREADS });
    const screened: ScreenedBreed[] = bred.map((b, i) => {
      const myRes = screenRes.slice(i * SCREEN_GAMES, (i + 1) * SCREEN_GAMES);
      const w = myRes.reduce((s, r) => s + scoreOf(r.winner), 0);
      return { ...b, screenWr: w / myRes.length, screenGames: myRes.length };
    });
    for (const s of screened) console.log(`  ${s.deck.name}: ${(s.screenWr * 100).toFixed(1)}% (${s.screenGames} games)`);
    const { picked, runners: rest } = pickScreened(screened, 8);
    runners = rest;
    bred = picked;
    screenRecord = { breedCount: BREED_COUNT, screenGames: SCREEN_GAMES, screened: screened.map((s) => ({ name: s.deck.name, method: s.method, wr: s.screenWr, games: s.screenGames })).sort((a, b) => b.wr - a.wr) };
    console.log(`Screening: picked ${bred.map((b) => b.deck.name).join(', ')}`);
  }

  if (!GATE_ONLY) {
    // (a runner-up of the screen may take a slot when the gate keeps a deck out, so its file counts too)
    const clash = existing([...bred, ...(GATE_ON ? runners : [])].map((b) => `data/decks/custom/${fileOf(b.deck)}`));
    if (clash.length && !FORCE) throw new Refusal(`bred deck files already exist: ${clash.join(', ')}. Pass --force to overwrite them.`);
  }

  // 2. the gate: each bred deck against its reference, before it takes a slot. With screening runners-up (--breed-count),
  // the slots of decks the gate keeps out go to the next runners-up by the screen, each gated the same way on the same
  // games before it takes a slot (gateSlots), and the reference's blocks are played once across the rounds.
  let tested: SlotTest<Bred>[] | null = null;
  let gateLines: string[] = [];
  let entered: Bred[] = bred;
  if (GATE_ON) {
    const overRuns = gatePlayOver(runJobs, { threads: THREADS });
    const gatePlay = runners.length ? keepReferences(overRuns, new Map()) : overRuns;
    const roundLines: string[] = [];
    let header: string[] = [];
    const slots = await gateSlots<Bred>(bred, runners, 8, async (batch, refill) => {
      const plan = planGate(batch, ranked, metaDecks.map((d) => d.deck), GATE.reference, tFieldDecks);
      if (!refill) {
        header = [...gateHeaderLines(gateOpts, plan.map((p) => p.field.length)), gatePlanCostWords(gateOpts, plan)];
        for (const l of header) console.log(l);
      } else {
        const line = refillRoundWords(refill, batch.map((b) => b.deck.name));
        roundLines.push(line);
        console.log(line);
      }
      return runGate(plan, { ...gateOpts, onStep: ({ name, step, which }) => console.log(`  ${name}${which === 'confirm' ? ' (confirming)' : ''}: ${stepWords(step)}`) }, gatePlay);
    });
    tested = slots.tested;
    entered = slots.entered;
    const outcomes = tested.map((t) => t.outcome);
    const footer = gateFooterLines(outcomes);
    const deckLine = (t: SlotTest<Bred>) => `${t.outcome.name}${t.refill ? ` (runner-up of the screen, refill ${t.refill})` : ''}: ${gateWords(t.outcome)}`;
    gateLines = [...header, '', ...tested.map((t) => `- **${t.outcome.name}**${t.refill ? ` (runner-up of the screen, refill ${t.refill})` : ''}: ${gateWords(t.outcome)}`), ...(roundLines.length ? ['', ...roundLines] : []), '', ...footer];
    for (const t of tested) console.log(deckLine(t));
    for (const l of footer) console.log(l);
  }
  const refills = tested ? refillCounts(tested) : undefined;
  const seasonWords = enteredWords(bred.length, entered.length, refills);
  console.log(`Season ${SEASON}: ${seasonWords}`);
  const bredRecord = (b: (typeof bred)[number]) => ({ name: b.deck.name, method: b.method, parents: b.parents, idea: b.idea, ...(b.packages ? { packages: b.packages } : {}) });
  const outcomes = tested?.map((t) => t.outcome) ?? null;
  const gateRecord = tested && outcomes
    ? {
        bred: bred.length,
        entered: entered.length,
        simVersion: SIM_VERSION,
        settings: gateSettings(GATE, { fieldTop: tField.added.length }),
        ...(tField.added.length ? { field: tField.field.map((d) => d.deck.name) } : {}),
        words: { rule: gateRuleWords({ ...gateOpts, opponents: outcomes.map((r) => r.field.length) }), guarantee: gateGuaranteeWords(gateOpts), detect: gateDetectWords({ ...gateOpts, opponents: outcomes.map((r) => r.field.length) }), spread: spreadSeenWords(outcomes) },
        spreadSeen: spreadSeen(outcomes),
        // every deck tested for a slot: the bred decks, then the runners-up of the screen gated for the slots of decks kept out
        decks: tested.map((t) => gateDeckRecord(t.outcome, t.bred.deck, { method: t.bred.method, idea: t.bred.idea, ...(t.refill ? { refill: t.refill } : {}) })),
        ...(refills?.tested ? { refills: refills.tested } : {}),
      }
    : null;
  if (GATE_ONLY) {
    const doc = {
      kind: 'nct-season-gate',
      schema: 1,
      season: SEASON,
      date: new Date().toISOString(),
      simVersion: SIM_VERSION,
      bred: entered.map(bredRecord),
      ...(outcomes ? {} : { lists: bred.map((b) => ({ name: b.deck.name, list: exportOfficial(b.deck), legends: [...b.deck.legends] })) }),
      ...(gateRecord ? { gate: gateRecord } : {}),
      ...(screenRecord ? { screen: screenRecord } : {}),
      ...(retirement?.retired.length ? { wouldRetire: retirement.retired } : {}),
    };
    const md = [
      `# Season ${SEASON}: ${outcomes ? 'bred and tested' : 'bred'}, nothing recorded`,
      '',
      `${seasonWords}. Nothing was written to the repository.`,
      '',
      ...(retirement ? [...retirementWords(retirement, 'would retire'), ''] : []),
      ...(screenRecord ? [`Screened ${screenRecord.breedCount} candidates (${screenRecord.screenGames} Medium games each), picked the best 8.`, ''] : []),
      ...(outcomes ? gateLines : bred.map((b) => `- **${b.deck.name}** (${b.method}): ${b.idea}`)),
    ].join(NL);
    if (V.out !== undefined) {
      fs.mkdirSync(V.out, { recursive: true });
      fs.writeFileSync(path.join(V.out, `season-${SEASON}-gate.json`), `${JSON.stringify(doc, null, 1)}${NL}`);
      fs.writeFileSync(path.join(V.out, `season-${SEASON}-gate.md`), `${md}${NL}`);
      console.log(`Written: ${path.join(V.out, `season-${SEASON}-gate.json`)} and .md`);
    }
    return;
  }

  // 3. retire (with --retire-below-meta-median), then write the deck files of the decks that entered
  const retired: Retired[] = retirement?.retired ?? [];
  if (retired.length) {
    for (const f of retireDecks(retired, { date: startedAt, season: SEASON })) console.log(`Written: ${f}`);
    console.log(RETIRE_NEXT);
  }
  // the season file's record of retirements: this run's, and on a re-run the earlier run's (its decks are archived already)
  const earlierRetired = rerun && fs.existsSync(SEASON_FILE) ? ((JSON.parse(fs.readFileSync(SEASON_FILE, 'utf8')) as { retired?: Retired[] }).retired ?? []) : [];
  const retiredRecord: Retired[] = [...earlierRetired.filter((r) => !retired.some((x) => x.file === r.file)), ...retired];
  const newFiles = entered.map((b) => fileOf(b.deck));
  for (const b of entered) {
    const pkgLine = b.packages ? `// Packages: built around ${b.packages.builtAround.map(packageName).join(', ') || 'none'}${b.packages.seeded ? `; seeded from ${b.packages.seeded.map(packageName).join(' + ')}` : ''}; plan: ${describePlan(PLAN)}${b.packages.changes.length ? `; changes: ${b.packages.changes.join('; ')}` : ''}${NL}` : '';
    fs.writeFileSync(`data/decks/custom/${fileOf(b.deck)}`, `${exportOfficial(b.deck)}${NL}${NL}// Idea: ${b.idea}${NL}// Author: Night City Trainer breeder (season ${SEASON}, ${b.method})${NL}${pkgLine}`);
  }
  const leftOver = existing((tested ?? []).filter((t) => !t.outcome.entered).map((t) => `data/decks/custom/${fileOf(t.bred.deck)}`));
  if (leftOver.length) console.log(`warning: ${leftOver.join(', ')} ${leftOver.length === 1 ? 'is' : 'are'} from an earlier run of season ${SEASON}, and ${leftOver.length === 1 ? 'its deck' : 'their decks'} did not enter this time; left in place.`);

  // 4. forge the newcomers, before the round robin, so everything after it measures the forged lists
  if (newFiles.length) {
    console.log('Forging newcomers…');
    // with package flags, the forge keeps the seeded packages too (a kept package a deck doesn't hold changes nothing)
    const forgeArgs = PACKAGES ? ` ${planArgs({ ...V, 'keep-packages': [...new Set([...(PLAN.keep ?? []), ...SEEDS.flat()])].join(',') || 'none' }).join(' ')}` : '';
    // the adoption rule and depth flags that were given, and the budget the season already checked (the forge caps until
    // settled's further stages within it)
    const settleV = { ...V, 'until-settled': SEASON_SETTLE_ON };
    // (--field-top N: the forge's field is the season's tuning field too; the ledger keys its entries on the field)
    const ruleArgs = [...adoptionArgs(V), '--budget', String(V['forge-budget']), ...ledgerArgs(V).map((a) => (a.startsWith('--') ? a : JSON.stringify(a))), ...shortlistArgs(V), ...settleArgs(settleV), ...(FORGE_CONFIRM ? confirmBotArgs(V) : []), ...halvingArgs(V), ...(FIELD_TOP ? ['--field-top', String(FIELD_TOP)] : [])].join(' ');
    execSync(`npx tsx scripts/forge.ts ${newFiles.map((f) => f.replace(/\.txt$/, '')).join(' ')} --gens ${FORGE_GENS} --games ${FORGE_GAMES} --cands 5 --bot lookahead --threads ${THREADS}${forgeArgs} ${ruleArgs}`, { stdio: 'inherit' });
  } else console.log('No bred deck entered: nothing to forge.');

  // 5. round robin: meta + top 8 incumbents + the new decks as forged
  const lib2 = loadLibrary();
  // (one entry per list: an incumbent whose list is already in the field is passed over for the next by strength)
  const rr = seasonField({
    meta: lib2.filter((d) => d.kind === 'meta'),
    ranked: ranked.filter((r) => !metaNames.has(r.deck.name)).map((r) => lib2.find((d) => d.deck.name === r.deck.name)),
    newcomers: newFiles.map((f) => lib2.find((d) => d.file === f)!),
    slots: 8,
    allowSameLists: ALLOW_SAME_LISTS,
  });
  const { incumbents, field } = rr;
  const newcomers = field.filter((d) => newFiles.includes(d.file));
  if (rr.left.length) console.log(`${leftOutLine(rr.left)} (Pass --allow-same-lists to enter ${rr.left.length === 1 ? 'it' : 'them'} too.)`);
  for (const d of newcomers) lb[d.deck.name] = mkEntry(d, SEASON, `S${SEASON} ${entered.find((b) => b.deck.name === d.deck.name)!.method}`);
  // an incumbent chosen by its power rating that is not on the leaderboard yet (a guide, Trainer original or sim-ladder
  // list) joins it from this season on, so its round-robin games vs the meta and its finals count like every incumbent's
  // (a forced re-run takes it out again: its firstSeason is this season)
  const joined = incumbents.filter((d) => !lb[d.deck.name]);
  for (const d of joined) lb[d.deck.name] = mkEntry(d, SEASON, d.kind === 'original' ? 'NC original' : d.kind);
  if (joined.length) console.log(`Joining the leaderboard as incumbents: ${joined.map((d) => d.deck.name).join(', ')}`);
  console.log(`Field: ${field.length} decks × ${GAMES} games per pairing (${BOT})`);
  const jobs: MatchJob[] = [];
  let seed = SEASON * 1_000_000;
  for (let i = 0; i < field.length; i++)
    for (let j = i + 1; j < field.length; j++)
      for (let k = 0; k < GAMES; k++) jobs.push({ a: field[i].deck, b: field[j].deck, seed: seed++, first: (k % 2) as 0 | 1, bot: BOT, trace: true });
  const res: MatchResult[] = await runJobs(jobs, { threads: THREADS });
  // the round robin's manifest; the forge and finals steps run as their own processes and write their own reports
  const manifest = gameRunManifest({
    purpose: 'season',
    decks: field,
    fieldMode: `season-${SEASON}`,
    bot: BOT,
    seedBase: SEASON * 1_000_000,
    seatPolicy: 'alternate',
    plannedGames: jobs.length,
    completedGames: res.length,
    gamesPerPair: GAMES,
    trace: true,
    simVersion: SIM_VERSION,
    createdAt: startedAt,
    ...(PACKAGES ? { packages: packageProvenance(PLAN, { seeds: SEEDS }) } : {}),
    // the rule the forge step adopts changes by (the forge writes its own manifests too)
    adoption: adoptionProvenance(RULE, { firstStage: FORGE_GAMES * 2, nominees: DEPTH.nominees, cardsPerChange: DEPTH.cardsPerChange, packagesPerChange: DEPTH.packagesPerChange }, V.ledger, SETTLE ?? undefined, FORGE_CONFIRM?.confirm),
  });
  // the round robin as a rating run (scripts/season-run.ts): the only way its games reach the ratings, once (a re-run
  // replaces its own file); only with the series' bot, so the ratings' pool keeps its bot
  let ratingRun: { id: string; file: string } | null = null;
  const skipRun = ratingRunSkipWords(BOT);
  if (V['rating-run'] === 'off') console.log('The round robin is not recorded as a rating run (--rating-run off).');
  else if (skipRun) console.log(skipRun);
  else if (recordsRatingRun(BOT)) {
    const { n, replaces } = seasonRunNumber(SEASON);
    const run = seasonRatingRun({ season: SEASON, n, date: new Date().toISOString(), field, games: res, bot: BOT, gamesPerPair: GAMES, seedBase: SEASON * 1_000_000 });
    const file = writeSeasonRun(run, { replaces });
    ratingRun = { id: run.id, file: file.split(path.sep).join('/') };
    console.log(`Recorded the round robin as rating run ${run.id} (${file.split(path.sep).join('/')}${replaces ? `, replacing this season's earlier ${replaces}` : ''}): ${res.length} Hard games on the current lists.`);
    console.log(SEASON_RUN_NEXT);
  }
  const reps = analyzeAll(res.flatMap((r) => r.summaries ?? []));
  // not on a re-run, and not when an earlier run of this season already recorded it (the same seeds play the same games)
  if (!rerun && !impactRecorded) {
    // into the entry of this simulator version and BOT, per list keyed by the list each deck played in this round robin
    // (a new deck's list is the forged one: the forge ran first)
    const played = new Map(field.map((d) => [d.deck.name, listFingerprint(d.deck)]));
    const skipped = recordSeasonImpact(reps, { season: SEASON, runId: manifest.runId, simVersion: SIM_VERSION, bot: BOT }, (name) => played.get(name));
    if (skipped.length) console.log(`per-list card impact: no list known for ${skipped.join(', ')}; not recorded`);
  }
  // per-deck season win rate + pooled vs-meta record
  const tot: Record<string, { w: number; g: number }> = {};
  for (const r of res) {
    const s = r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0;
    for (const [me, opp, v] of [
      [r.a, r.b, s],
      [r.b, r.a, 1 - s],
    ] as [string, string, number][]) {
      (tot[me] ??= { w: 0, g: 0 }), (tot[me].w += v), tot[me].g++;
      if (metaNames.has(opp) && lb[me]) credit(lb[me], SEASON, v, 1);
    }
  }
  for (const [name, t] of Object.entries(tot)) if (lb[name]) lb[name].seasons[String(SEASON)] = t.w / t.g;
  saveLB(lb);
  // 6. finals vs meta for newcomers (as forged) and any incumbent without finals
  const lib3 = loadLibrary();
  const finalists = [...newFiles.map((f) => lib3.find((d) => d.file === f)!), ...incumbents.filter((d) => lb[d.deck.name] && lb[d.deck.name].finals === undefined)];
  for (const d of finalists) {
    console.log(`Finals: ${d.deck.name}`);
    execSync(`npx tsx scripts/simulate.ts test "${d.file.replace(/\.txt$/, '')}" --field meta --games ${Math.ceil(FINALS)} --bot ${BOT} --seed ${SEASON * 9000} --threads ${THREADS}`, { stdio: ['ignore', 'ignore', 'inherit'] });
    const f = `reports/test-${d.file.replace(/\.txt$/, '')}-latest.json`;
    if (fs.existsSync(f) && lb[d.deck.name]) addFinals(lb[d.deck.name], JSON.parse(fs.readFileSync(f, 'utf8')), SEASON);
  }
  const board = saveLB(lb);
  // 7. season report
  const seasonRows = field
    .map((d) => ({ name: d.deck.name, file: d.file, kind: d.kind, wr: tot[d.deck.name] ? tot[d.deck.name].w / tot[d.deck.name].g : 0, isNew: newFiles.includes(d.file) }))
    .sort((a, b) => b.wr - a.wr);
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const data = {
    season: SEASON,
    date: new Date().toISOString(),
    games: GAMES,
    bot: BOT,
    // the decks that entered (every bred deck with --gate off); `gate` is the test of every bred deck
    bred: entered.map(bredRecord),
    ...(gateRecord ? { gate: gateRecord } : {}),
    ...(screenRecord ? { screen: screenRecord } : {}),
    standings: seasonRows,
    leaderTop: board.slice(0, 12).map((e) => ({ name: e.name, vsMeta: e.vsMeta, percentile: e.percentile })),
    // the rating run the round robin was recorded as (data/series/run-N.json), and the decks retired before it bred
    ...(ratingRun ? { ratingRun: ratingRun.id } : {}),
    ...(retiredRecord.length ? { retired: retiredRecord } : {}),
    ...(tField.added.length ? { tuningField: tField.field.map((d) => d.deck.name) } : {}),
    manifest,
  };
  fs.writeFileSync(`data/seasons/season-${SEASON}.json`, JSON.stringify(data, null, 1));
  saveLB(lb);
  const md = [
    `# Season ${SEASON}`,
    '',
    `${seasonWords}. ${field.length} decks (7 meta, ${incumbents.length} incumbents, ${entered.length} new) × ${GAMES} games per pairing, ${BOT} bot, with telemetry. ${entered.length ? `The new decks were forged (${FORGE_GENS} gen) before the round robin, so the round robin, the finals vs the meta (${FINALS} games per opponent) and the leaderboard all measure the forged lists.` : 'No bred deck entered, so nothing was forged.'}`,
    '',
    ...(ratingRun ? [`The round robin is recorded as rating run ${ratingRun.id} (${ratingRun.file}): its games count for the power ratings, head-to-heads and evidence once those are rebuilt.`, ''] : []),
    ...(retirement && retired.length ? [...retirementWords(retirement, 'retired'), ''] : []),
    ...(tField.added.length ? [`Tuning field (screen, gate and forge): ${tuningFieldWords(tField)}: ${tField.field.map((d) => d.deck.name).join(', ')}.`, ''] : []),
    ...(entered.length ? [`Forge adoption rule: ${describeRule(RULE, { firstStage: FORGE_GAMES * 2, nominees: DEPTH.nominees, ledger: V.ledger, ...(SETTLE ? { untilSettled: SETTLE } : {}), ...(FORGE_CONFIRM ? { confirmedWith: FORGE_CONFIRM } : {}) })}. Each change it adopted, with its held-out paired gain, is in reports/forge/ and on the deck file's "// Forged" line; "could not tell" changes were not adopted.`, ''] : []),
    ...(screenRecord ? [`## Screening: ${screenRecord.breedCount} candidates, ${screenRecord.screenGames} Medium games each`, '', ...screenRecord.screened.map((s) => `- ${s.name} (${s.method}): ${(s.wr * 100).toFixed(1)}%`), ''] : []),
    ...(outcomes ? [`## Gate: ${seasonWords}`, '', ...gateLines, ''] : []),
    '## New decks',
    ...(PACKAGES ? [`Package plan: ${describePlan(PLAN)}${SEEDS.length ? `; explorers seeded from ${SEEDS.map((c) => c.map(packageName).join(' + ')).join(', ')}` : ''}${V['keep-built-around'] ? "; the forge kept each new deck's built-around packages" : ''}${V['package-moves'] ? '; the forge tried package moves' : ''}.`, ''] : []),
    ...(entered.length ? [] : ['None entered.']),
    ...(entered.some((b) => b.method === 'counter') ? [COUNTER_NOTE, ''] : []),
    ...entered.map(
      (b) =>
        `- **${b.deck.name}** (${b.method}) — ${b.idea}${b.packages ? ` Packages: built around ${b.packages.builtAround.map(packageName).join(', ') || 'none'}${b.packages.changes.length ? `; package changes: ${b.packages.changes.join('; ')}` : ''}.` : ''}`,
    ),
    '',
    '## Season standings (round robin)',
    '| # | Deck | Win % | |',
    '|---|---|---|---|',
    ...seasonRows.map((r, i) => `| ${i + 1} | ${r.name} | ${pct(r.wr)} | ${r.isNew ? 'NEW' : r.kind} |`),
    '',
    '## All-time leaderboard (pooled win % vs the meta archetypes)',
    '| # | Deck | Origin | vs meta (raw) | Rating | Games | Percentile |',
    '|---|---|---|---|---|---|---|',
    ...board.slice(0, 15).map((e, i) => `| ${i + 1} | ${e.name} | ${e.origin} | ${pct(e.vsMeta)} | ${pct(e.rating)} | ${e.metaG} | ${e.percentile} |`),
    '',
    'Rating = win rate vs the meta archetypes, shrunk toward 50% by a 60-game prior, so decks need volume to rank high. Percentile is the rank among all measured decks.',
  ].join(NL);
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(`reports/season-${SEASON}.md`, md);
  console.log(NL + md);
}
if (!GATE_ONLY) fs.mkdirSync('data/seasons', { recursive: true });
runMain(main);
