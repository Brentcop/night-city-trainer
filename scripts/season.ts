// Season runner: breed 8 new decks → gate each against its parent → write the decks that enter → forge them →
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
// parent) on the same games against the other meta decks, in stages, and enters unless a bot shows it worse ("could not
// tell" enters). A deck kept out gets no deck file; its list, reference, figures and verdict are kept in
// data/seasons/season-<N>.json ("gate") and the season report, and its Legend trio counts as seen when later seasons
// breed. Gate games count for no rating, leaderboard, card impact, change ledger or evidence file; their seeds are
// N·1,000,000 + 700,000 (first bot) and + 800,000 (confirming bot).
//   --gate on|off              default on; off enters every bred deck as before
//   --gate-bot BOT             the first bot (default medium)
//   --gate-confirm-bot BOT     the confirming bot, for decks the first bot did not show worse (default hard; none: no
//                              confirming bot; the first bot under another name plays nothing more)
//   --gate-rounds N            double rounds per stage (default 20: 280 games with 7 opponents, 240 with 6)
//   --gate-stages N            the first bot's stages at most (default 5)
//   --gate-confirm-stages N    the confirming bot's stages at most (default 2)
//   --gate-reference middle|parent   which reference (default middle): middle tests every bred deck against the middle
//                              meta deck by strength, one fixed bar for all; parent tests each against its best parent
//                              (an explorer, which has none, still plays the bar), the plan's original rule. The owner
//                              chose the bar on 2026-11-15 after the check on the recorded bred decks: with the parent
//                              as reference 2 of 16 would have entered and the five best-rated kept out; against the
//                              bar 9 (docs/SYNERGIES.md). Kept in the record's settings.
//   --gate-only                breed and gate, then stop: no deck file, leaderboard, impact file or report in the
//                              repository changes (a recorded season may be gated again this way: it breeds as a --force
//                              re-run would). With --gate off it breeds and stops.
//   --out DIR                  with --gate-only: write season-<N>-gate.json and season-<N>-gate.md into DIR
//
// One entry per list (src/lib/distinctLists.ts; scripts/season-field.ts): the round robin's field holds each list once.
// Two decks are the same list when their Legends and main deck are the same, whatever their names. An incumbent whose
// list is already in the field is passed over for the next one by strength, and the season prints which. A bred deck
// cannot be the same list as a library deck (it never gets a library deck's Legend trio); if one ever were, it would take
// no slot, and the season would say so before the gate.
//   --allow-same-lists         the field as before the rule (the first 8 incumbents whatever their lists), and bred decks
//                              are not checked
//
// Parents are ranked by strength (src/lib/parentStrength.ts): the conservative power rating, blended with the season
// leaderboard only where its entry is current (every season behind it ran under this simulator version).
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
// --until-settled (the evidence rule only; --reach N is its reach too) turns "until settled" on for the forge step
// (docs/SYNERGIES.md "Until settled"; off by default, and without it nothing changes); the forge-budget check counts the
// usual estimate, and the printed estimate says what it may add at most.
// --confirm-bot BOT has the forge step's confirmation stages played by BOT (its screening stays with lookahead, Medium;
// docs/SYNERGIES.md "Confirming with another bot"; default lookahead, and then nothing changes; not with --pooled-ranking).
//
// Outputs: data/decks/custom/s<N>-*.txt (the decks that entered), reports/season-<N>.md, data/seasons/season-<N>.json,
//          data/seasons/leaderboard.json, src/data/seasons.json (site), data/seasons/impact.json and deck-impact.json.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { breedSeason } from '../src/ai/breeder';
import { keptOutTriples, leaderStrength, loadH2H, loadImpactTables, recordSeasonImpact, SEASON_BOT, seasonImpactCount, seasonVersionsOnDisk, strengthOf } from './breed-data';
import { impactTablesWords, seasonCountWords } from '../src/lib/breederImpact';
import { rankParents } from '../src/lib/parentStrength';
import { confirmBotOf, enteredWords, gateDetectWords, gateGuaranteeWords, gateRuleWords, gateSeeds, gateStageGames, gateWords, planGate, runGate, spreadSeen, spreadSeenWords, stepWords, type GateOptions, type GateOutcome } from '../src/lib/breedGate';
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
import { adoptionArgs, adoptionFlags, checkBudget, confirmBotArgs, confirmBotFlag, confirmBotFromFlags, depthFlags, depthFromFlags, exitOnRuleProblems, ledgerArgs, ledgerFlags, ledgerFromFlags, ruleFromFlags, settleArgs, settleFlags, settleFromFlags, shortlistArgs, shortlistFlags, shortlistFromFlags } from './evidence-flags';
import { adoptionProvenance, describeRule, settleStages } from '../src/lib/evidence';
import { DEFAULT_GAME_BUDGET, estimateGames, settleExtra } from '../src/lib/deckSearch';
import { SIM_VERSION } from '../src/lib/tournament';
import { leftOutLine } from '../src/lib/distinctLists';
import { sameListBred, seasonField } from './season-field';

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
  ...confirmBotFlag(),
  ...seasonGateFlags(),
  'allow-same-lists': bool(),
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
// --until-settled goes to the forge step; refused here as the forge would refuse it
const SETTLE = settleFromFlags(V, { rule: RULE });
const DEPTH = depthFromFlags(V, 1);
/** the forge step's cost per new deck (5 candidate swaps, package moves when on), checked before the season starts */
const FORGE_ESTIMATE = estimateGames({
  gens: V['forge-gens'],
  screenGames: V['forge-games'],
  singles: 5,
  packageMoves: PACKAGES ? (V['package-moves'] ? 3 : 0) + (V['require-packages'] ? 3 : 0) : 0,
  depth: DEPTH,
  firstStage: V['forge-games'] * 2,
  rule: RULE,
});
/** --until-settled: what it may add at most per new deck (the forge's 50,000 confirmation seeds a generation, and the reach) */
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
  seeds: gateSeeds(SEASON),
};
function flagError(message: string): never {
  console.error(`error: ${message}${NL}Run with --help for usage.`);
  process.exit(2);
}
if (V.out !== undefined && !GATE_ONLY) flagError('--out writes the --gate-only files; a full season writes to the repository');
if (V.out !== undefined && fs.existsSync(V.out) && !fs.statSync(V.out).isDirectory()) flagError(`--out ${V.out} is a file, not a folder`);
if (GATE_ON) {
  const most = gateStageGames(GATE.rounds, 7);
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
const SEASON_FILE = `data/seasons/season-${SEASON}.json`;

// ---------------------------------------------------------------- leaderboard
interface Entry {
  name: string;
  file: string;
  kind: string;
  origin: string; // meta / guide / NC original / S<n> mutant|crossover|explorer / variant
  colors: string;
  arch: string;
  firstSeason: number;
  metaW: number; // wins (ties = 0.5) vs meta archetypes, pooled across seasons + finals
  metaG: number;
  seasons: Record<string, number>; // season -> round-robin win rate in that season
  finals?: number; // latest finals win rate vs meta
  idea?: string;
  /** what each season added to metaW/metaG (so a forced re-run can take it out again); finals: that season set `finals` */
  contrib?: Record<string, { w: number; g: number; finals?: boolean }>;
}
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
/**
 * Before a forced re-run: take season N's games back out of the leaderboard. Returns false (changing nothing) when the
 * season was counted before per-season totals were kept.
 */
function uncountSeason(lb: Record<string, Entry>, season: number): boolean {
  const k = String(season);
  const legacy = Object.values(lb).filter((e) => e.seasons[k] !== undefined && !e.contrib?.[k]);
  if (legacy.length) return false;
  for (const e of Object.values(lb)) {
    const c = e.contrib?.[k];
    if (c) {
      e.metaW -= c.w;
      e.metaG -= c.g;
      if (Math.abs(e.metaW) < 1e-9) e.metaW = 0;
      if (c.finals) delete e.finals;
      delete e.contrib![k];
    }
    delete e.seasons[k];
    if (e.firstSeason === season) delete lb[e.name];
  }
  return true;
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
    // refuse before anything is played or written: the forge step would refuse later, after the gate
    checkBudget(`season forge step, ${FORGE_GENS} generation${FORGE_GENS === 1 ? '' : 's'}`, FORGE_ESTIMATE, V['forge-budget'], false, FORGE_SETTLE_EXTRA, FORGE_CONFIRM ? { with: FORGE_CONFIRM, games: FORGE_GENS * FORGE_ESTIMATE.confirm } : undefined);
  }
  const lb = loadLB();
  // ---- refuse to count a season twice (--gate-only writes nothing, so it may look at a recorded season again)
  const counted = Object.values(lb).some((e) => e.seasons[String(SEASON)] !== undefined || e.contrib?.[String(SEASON)]);
  const rerun = counted || fs.existsSync(SEASON_FILE);
  if (rerun && !FORCE && !GATE_ONLY) {
    throw new Refusal(`season ${SEASON} is already recorded (${fs.existsSync(SEASON_FILE) ? SEASON_FILE : 'in data/seasons/leaderboard.json'}). Leave out --season to run season ${Math.max(SEASON, ...recordedSeasons()) + 1}, or pass --force to re-run it.`);
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
  // parents for breeding: every measured deck incl. meta archetypes, by strength (src/lib/parentStrength.ts: the
  // conservative power rating, blended with the shrunk vs-meta leaderboard rating only where that entry is current)
  const versions = seasonVersionsOnDisk();
  const strength = strengthOf(Object.values(lb).filter((e) => e.metaG > 0).map((e) => leaderStrength(e, rating(e), versions, SIM_VERSION)));
  const ranked = rankParents(strength, lib);
  const h2hAll = loadH2H();
  const hasH2H = ranked.slice(0, 4).some((x) => ranked.some((y) => h2hAll(y.deck.name, x.deck.name).g > 0));
  // 1. breed
  // (on a re-run, this season's own earlier decks don't count as seen, so the breeder makes the same choices; the Legend
  // trios that earlier seasons' gates kept out count as seen, so the same trio is not built again)
  const seen = new Set([...lib.filter((d) => !(rerun && d.file.startsWith(`s${SEASON}-`))).map((d) => [...d.deck.legends].sort().join('|')), ...keptOutTriples(undefined, rerun ? SEASON : undefined)]);
  // each bred list in the order its deck file will read back (asWritten): the card order changes the games a seed deals,
  // so the gate plays the list as the forge, the round robin and anyone replaying the record will have it. The deck
  // files are the same either way (the export does not depend on the order).
  const bredAll = breedSeason(SEASON, { ranked, impact: tables.impact, seenTriples: seen, seed: 1000 + SEASON * 77, deckImpact: tables.deckImpact, h2h: hasH2H ? h2hAll : undefined, ...(PACKAGES ? { packages: { plan: PLAN, seeds: SEEDS } } : {}) }, 8).map((b) => ({ ...b, deck: asWritten(b.deck) }));
  const fileOf = (d: DeckList) => `${slugify(d.name)}.txt`;
  // one entry per list: a bred deck with a library deck's list (or an earlier bred deck's) takes no slot. It cannot
  // happen (see scripts/season-field.ts), so this is a guard; this season's own earlier decks don't count on a re-run.
  const sameBred = ALLOW_SAME_LISTS ? { kept: bredAll, left: [] } : sameListBred(bredAll, lib.filter((d) => !(rerun && d.file.startsWith(`s${SEASON}-`))), fileOf);
  if (sameBred.left.length) console.log(`warning: ${leftOutLine(sameBred.left)} They take no season slot.`);
  const bred = sameBred.kept;
  if (!GATE_ONLY) {
    const clash = existing(bred.map((b) => `data/decks/custom/${fileOf(b.deck)}`));
    if (clash.length && !FORCE) throw new Refusal(`bred deck files already exist: ${clash.join(', ')}. Pass --force to overwrite them.`);
  }
  console.log(`Season ${SEASON}: bred ${bred.map((b) => b.deck.name).join(', ')}`);

  // 2. the gate: each bred deck against its reference, before it takes a slot
  let outcomes: GateOutcome[] | null = null;
  let gateLines: string[] = [];
  if (GATE_ON) {
    const plan = planGate(bred, ranked, metaDecks.map((d) => d.deck), GATE.reference);
    const header = gateHeaderLines(GATE, plan.map((p) => p.field.length));
    for (const l of header) console.log(l);
    outcomes = await runGate(plan, { ...GATE, onStep: ({ name, step, which }) => console.log(`  ${name}${which === 'confirm' ? ' (confirming)' : ''}: ${stepWords(step)}`) }, gatePlayOver(runJobs, { threads: THREADS }));
    const footer = gateFooterLines(outcomes);
    gateLines = [...header, '', ...outcomes.map((r) => `- **${r.name}**: ${gateWords(r)}`), '', ...footer];
    for (const r of outcomes) console.log(`${r.name}: ${gateWords(r)}`);
    for (const l of footer) console.log(l);
  }
  const enters = bred.map((_, i) => !outcomes || outcomes[i]!.entered);
  const entered = bred.filter((_, i) => enters[i]);
  console.log(`Season ${SEASON}: ${enteredWords(bred.length, entered.length)}`);
  const bredRecord = (b: (typeof bred)[number]) => ({ name: b.deck.name, method: b.method, parents: b.parents, idea: b.idea, ...(b.packages ? { packages: b.packages } : {}) });
  const gateRecord = outcomes
    ? {
        bred: bred.length,
        entered: entered.length,
        simVersion: SIM_VERSION,
        settings: gateSettings(GATE),
        words: { rule: gateRuleWords(GATE), guarantee: gateGuaranteeWords(GATE), detect: gateDetectWords({ ...GATE, opponents: outcomes.map((r) => r.field.length) }), spread: spreadSeenWords(outcomes) },
        spreadSeen: spreadSeen(outcomes),
        decks: outcomes.map((r, i) => gateDeckRecord(r, bred[i]!.deck, { method: bred[i]!.method, idea: bred[i]!.idea })),
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
    };
    const md = [
      `# Season ${SEASON}: ${outcomes ? 'bred and tested' : 'bred'}, nothing recorded`,
      '',
      `${enteredWords(bred.length, entered.length)}. Nothing was written to the repository.`,
      '',
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

  // 3. write the deck files of the decks that entered
  const newFiles = entered.map((b) => fileOf(b.deck));
  for (const b of entered) {
    const pkgLine = b.packages ? `// Packages: built around ${b.packages.builtAround.map(packageName).join(', ') || 'none'}${b.packages.seeded ? `; seeded from ${b.packages.seeded.map(packageName).join(' + ')}` : ''}; plan: ${describePlan(PLAN)}${b.packages.changes.length ? `; changes: ${b.packages.changes.join('; ')}` : ''}${NL}` : '';
    fs.writeFileSync(`data/decks/custom/${fileOf(b.deck)}`, `${exportOfficial(b.deck)}${NL}${NL}// Idea: ${b.idea}${NL}// Author: Night City Trainer breeder (season ${SEASON}, ${b.method})${NL}${pkgLine}`);
  }
  const leftOver = existing(bred.filter((_, i) => !enters[i]).map((b) => `data/decks/custom/${fileOf(b.deck)}`));
  if (leftOver.length) console.log(`warning: ${leftOver.join(', ')} ${leftOver.length === 1 ? 'is' : 'are'} from an earlier run of season ${SEASON}, and ${leftOver.length === 1 ? 'its deck' : 'their decks'} did not enter this time; left in place.`);

  // 4. forge the newcomers, before the round robin, so everything after it measures the forged lists
  if (newFiles.length) {
    console.log('Forging newcomers…');
    // with package flags, the forge keeps the seeded packages too (a kept package a deck doesn't hold changes nothing)
    const forgeArgs = PACKAGES ? ` ${planArgs({ ...V, 'keep-packages': [...new Set([...(PLAN.keep ?? []), ...SEEDS.flat()])].join(',') || 'none' }).join(' ')}` : '';
    // the adoption rule and depth flags that were given, and the budget the season already checked
    const ruleArgs = [...adoptionArgs(V), '--budget', String(V['forge-budget']), ...ledgerArgs(V).map((a) => (a.startsWith('--') ? a : JSON.stringify(a))), ...shortlistArgs(V), ...settleArgs(V), ...(FORGE_CONFIRM ? confirmBotArgs(V) : [])].join(' ');
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
  for (const d of newcomers) lb[d.deck.name] = mkEntry(d, SEASON, `S${SEASON} ${bred.find((b) => b.deck.name === d.deck.name)!.method}`);
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
    standings: seasonRows,
    leaderTop: board.slice(0, 12).map((e) => ({ name: e.name, vsMeta: e.vsMeta, percentile: e.percentile })),
    manifest,
  };
  fs.writeFileSync(`data/seasons/season-${SEASON}.json`, JSON.stringify(data, null, 1));
  saveLB(lb);
  const md = [
    `# Season ${SEASON}`,
    '',
    `${enteredWords(bred.length, entered.length)}. ${field.length} decks (7 meta, ${incumbents.length} incumbents, ${entered.length} new) × ${GAMES} games per pairing, ${BOT} bot, with telemetry. ${entered.length ? `The new decks were forged (${FORGE_GENS} gen) before the round robin, so the round robin, the finals vs the meta (${FINALS} games per opponent) and the leaderboard all measure the forged lists.` : 'No bred deck entered, so nothing was forged.'}`,
    '',
    ...(entered.length ? [`Forge adoption rule: ${describeRule(RULE, { firstStage: FORGE_GAMES * 2, nominees: DEPTH.nominees, ledger: V.ledger, ...(SETTLE ? { untilSettled: SETTLE } : {}), ...(FORGE_CONFIRM ? { confirmedWith: FORGE_CONFIRM } : {}) })}. Each change it adopted, with its held-out paired gain, is in reports/forge/ and on the deck file's "// Forged" line; "could not tell" changes were not adopted.`, ''] : []),
    ...(outcomes ? [`## Gate: ${enteredWords(bred.length, entered.length)}`, '', ...gateLines, ''] : []),
    '## New decks',
    ...(PACKAGES ? [`Package plan: ${describePlan(PLAN)}${SEEDS.length ? `; explorers seeded from ${SEEDS.map((c) => c.map(packageName).join(' + ')).join(', ')}` : ''}${V['keep-built-around'] ? "; the forge kept each new deck's built-around packages" : ''}${V['package-moves'] ? '; the forge tried package moves' : ''}.`, ''] : []),
    ...(entered.length ? [] : ['None entered.']),
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
