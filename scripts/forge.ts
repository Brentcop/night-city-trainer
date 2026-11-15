// Deck forge: telemetry-guided, multi-generation deck iteration against the meta field.
//
//   npx tsx scripts/forge.ts <deck...> [--gens 2] [--games 140] [--cands 6] [--bot lookahead] [--field meta|all] [--seed 1] [--threads N]
//   npx tsx scripts/forge.ts --nc          # all data/decks/custom/nc-*.txt
//   --out DIR   write the forged list and the reports to DIR (DIR/<file>, DIR/forge/) instead of the repository
//   --cache     read games already played with the same code, decks, seeds and bot from .cache/games and store new
//               ones (scripts/game-cache.ts); prints how many games were hits
//
// Synergy packages (opt-in; docs/SYNERGIES.md "Using packages when building"; without these flags nothing changes):
//   --keep-packages a,b      never cut these packages' pieces below their working minimum. When any package flag is
//                            given without this one, the deck objective's packages (if it names some) are kept;
//                            "none" keeps nothing
//   --require-packages a,b   the list must be built around these (moves that add a missing one are tried)
//   --avoid-packages a,b     never add pieces of these while the list is built around them
//   --lock-cards id[:n],...  never cut these cards below n copies (no n = every copy)
//   --package-moves          also try whole-package moves (complete, add, swap, remove); --package-cands N per
//                            generation (default 3)
//   --keep-built-around      also keep each list's own packages: the ones its game plan names, else the ones the
//                            starting list is built around (the Deck Lab's default keep), beside --keep-packages
//   --partner-aware          rank the cuts and adds partner-aware (src/lib/cutRanking.ts): a package card is judged by
//                            its games with a partner, a cut that lowers a package's assembly odds costs in proportion,
//                            an add that completes or deepens one earns the odds it adds; the log and JSON say why each
//                            card was or was not offered as a cut. On by itself with any package flag; --plain-ranking
//                            turns it off. Without either, the candidates are the pinned ones
//
// Adoption rule and search depth (docs/SYNERGIES.md "When a deck change is adopted"; src/lib/evidence.ts):
//   --adopt evidence|any-gain   default evidence; any-gain reproduces runs before 2026-11-11 (adopt on any gain)
//   --min-gain P (1)  --package-min-gain P (= min-gain)  --min-games N (200)  --confirm-cap K (4)  --alpha A (0.05)
//   --futility-after N (2; 0 = off)  --futility-gain X (0): after N stages a nominee whose held-out paired mean gain
//                     is at most X points stops early as "could not tell" (never adopted; negative X as --futility-gain=-1)
//   --cards-per-change N (1-3, default 1)   --packages-per-change N (1-2, default 1)   --nominees N (default 1)
//   --combine-from N (4)   --budget N (12000 games per deck; the estimate is printed first)   --force (go over it)
//
// Change ledger (opt-in; docs/SYNERGIES.md "Pooling held-out games across runs"; without it nothing changes):
//   --ledger          keep every screening and held-out paired game in the ledger (src/lib/changeLedger.ts), and judge a
//                     nominee that already has held-out games from earlier runs (same simulator version, bot and field)
//                     on them and the new games pooled, by the strict always-valid rule: its earlier games alone first
//                     (adopted or rejected with 0 new games), then after each new stage. A screened change whose earlier
//                     games alone already reject it is not nominated (the next best takes its place). The prior leaves
//                     out every game this confirmation may play and the games that screened the change, so repeating a
//                     one-generation run decides the same way and appends nothing (with --gens 2 or more, a later
//                     generation that nominates the same change again pools the earlier one's held-out games, and a
//                     repeat finds those too). Not with --bot hard-v1 (it reads card impact).
//   --ledger-dir DIR  default data/ledger (one <base list fingerprint>.jsonl per list); under --out DIR, DIR/ledger
//
// Shortlist from pooled evidence (opt-in, needs --ledger and the evidence rule; src/lib/shortlist.ts; docs/SYNERGIES.md
// "A shortlist carried across runs"; without it nothing changes):
//   --pooled-ranking  each generation screens first the --carry most promising one-card swaps earlier runs left undecided
//                     (best gain over all their screening and held-out games in the ledger, each game once), then the
//                     swap generator's picks in its own order, skipping a change earlier games drop (pooled gain + 0.5
//                     standard errors under the 2-point nomination bar, held-out games that reject it, or more than
//                     --reach held-out games needed to adopt it), up to --cands. Nominees are ranked by pooled gain over
//                     all their games, this generation's screening included, at the same 2-point bar; a change with no
//                     earlier games is judged exactly as before. Package moves and combined changes are screened as before.
//   --carry N (2)     --reach N (10000)
//
// Each generation:
//   1. Baseline: deck vs field with telemetry → win rate + per-card "Δ when drawn" (IWD).
//   2. Cuts: the deck's lowest-IWD cards. Adds: +1 of its best card, and the format's highest-impact legal cards
//      (from src/data/analysis.json, averaged across decks).
//   3. Screen each cut→add swap on the SAME seeds as the baseline (paired). With --cards-per-change 2 or 3 (or
//      --packages-per-change 2) the best screened single changes are also combined and screened. Screening only
//      nominates: the best --nominees changes that beat the baseline by 2+ points.
//   4. Confirm the nominees on fresh seeds (held out from the screening), paired with the current list, in stages of
//      2 × --games up to --confirm-cap stages. Adopt only when the corrected lower bound of the held-out paired gain is
//      above --min-gain; reject when the upper bound is below it; otherwise "could not tell" (kept). A nominee with no
//      gain after --futility-after stages stops early ("could not tell (stopped early: no gain after N games)"). The
//      reported gain is always the held-out one.
//   5. Save the new version (data/decks/custom/<slug>.txt), archive the old one (history/), log reports/forge/<slug>.md
//      (plus reports/forge/<slug>.json, which scripts/bundle-reports.ts reads).
// Seeds come from --seed, so a run can be repeated exactly.
import fs from 'node:fs';
import path from 'node:path';
import { exportOfficial, listFingerprint } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { analyzeDeck, type DeckReport } from '../src/analysis/analyze';
import analysis from '../src/data/analysis.json';
import { IMPACT_MIN_POOLED_GAMES } from '../src/analysis/impactData';
import { bool, cli, int, loadLibrary, oneOf, resolveDeck, runJobs, runMain, SIM_BOTS, str, threadsOpt } from './lib-node';
import { gameRunManifest, manifestDeck, type RunManifest } from '../src/lib/runManifest';
import { SIM_VERSION } from '../src/lib/tournament';
import type { MatchJob } from './worker';
import { cliGameCache } from './game-cache';
import { forgeScore, forgeSwaps, forgeSwapsExplained, isPackageChange, packageCandidates, combineMutations, type Mutation } from './builder-moves';
import { cutTableRows } from '../src/lib/cutRanking';
import { exitOnPlanProblems, objectivePackages, packagesOn, partnerAwareOn, planFromFlags, tunerPackageFlags } from './package-flags';
import { adoptionFlags, budgetFlags, checkBudget, depthFlags, depthFromFlags, exitOnRuleProblems, ledgerFlags, ledgerFromFlags, ruleFromFlags, shortlistFlags, shortlistFromFlags } from './evidence-flags';
import { CARD_BY_ID, cardLabel } from '../src/engine/cards';
import { byPooledGain, describeShortlist, outOfReach, pooledFigure, pooledWords, shortlistGeneration, skippedWords, type PooledFigure, type ShortlistNote } from '../src/lib/shortlist';
import { checkChange, describeChanges, describePlan, packageChanges, packageProvenance, type PackageChanges, type PackagePlan } from '../src/lib/deckPackages';
import { adoptionProvenance, confirmationWord, confirmStaged, describeRule, formatGain, judgePooled, nomineeRecord, outcomeWord, pairedInterval, pickAdopted, pooledGainWords, scoreOf, stoppedWords, type AdoptionProvenance, type Confirmation, type NomineeRecord, type PairedInterval, type PairedScores } from '../src/lib/evidence';
import { gameIds } from '../src/lib/changeLedger';
import { blockSlots, LedgerStore, RunLedger, scored, type GameSlot } from './ledger-store';
import { estimateGames, listKeyOf } from '../src/lib/deckSearch';
import { forgeSummaryMarkdown } from './forge-summary';

const { values: V, positionals } = cli(
  import.meta.url,
  {
    gens: int(2, { min: 1 }),
    games: int(140, { min: 1 }),
    cands: int(6, { min: 1 }),
    bot: oneOf(SIM_BOTS, 'lookahead'),
    field: oneOf(['meta', 'all'], 'meta'),
    nc: bool(),
    seed: int(1, { min: 0 }),
    threads: threadsOpt(),
    out: str(),
    cache: bool(),
    ...tunerPackageFlags(),
    ...adoptionFlags(),
    ...depthFlags(1),
    ...budgetFlags(),
    ...ledgerFlags(),
    ...shortlistFlags(),
  },
  { maxPositionals: Infinity },
);
const GENS = V.gens;
const GAMES = V.games;
const CANDS = V.cands;
const BOT = V.bot;
const FIELD = V.field;
const THREADS = Math.min(V.threads, 16);
/** --cache: games already played with the same code are read from .cache/games (scripts/game-cache.ts) */
const cache = cliGameCache(V.cache);
/** where the forged list and reports go: the repository (default) or --out DIR */
const OUT = V.out;
const PACKAGES = packagesOn(V);
/** partner-aware cut and add ranking (--partner-aware, or any package flag; --plain-ranking turns it off) */
const PARTNER = partnerAwareOn(V);
const RULE = ruleFromFlags(V);
exitOnRuleProblems(RULE);
const DEPTH = depthFromFlags(V, 1);
/** the first confirmation stage: the forge's confirmation size before staging existed */
const FIRST_STAGE = GAMES * 2;
/** confirmation seeds start this far after the generation's screening seeds */
const CONFIRM_GAP = 50_000;
const STAGES = RULE.kind === 'any-gain' ? 1 : RULE.capStages;
if (GAMES + 0 > CONFIRM_GAP || FIRST_STAGE * STAGES > CONFIRM_GAP) {
  console.error(`error: the confirmation may need ${FIRST_STAGE * STAGES} seeds but each generation has ${CONFIRM_GAP}; lower --games or --confirm-cap.\nRun with --help for usage.`);
  process.exit(2);
}
const lib = loadLibrary();
const field = lib.filter((d) => (FIELD === 'all' ? d.kind !== 'custom' : d.kind === 'meta'));
/** --ledger: where the change ledger is kept and the bot's canonical name (null when off) */
const LEDGER = ledgerFromFlags(V, { bot: BOT, out: OUT });
/** --pooled-ranking: the shortlist's settings (null when off) */
const SHORT = shortlistFromFlags(V, { ledger: !!LEDGER, rule: RULE });
/** the nomination bar: a change must beat the list by this much (a fraction) */
const NOMINATE_BAR = 0.02;
/** the field's list fingerprints, in the order the jobs use them (field[k % field.length]) */
const OPPONENTS = field.map((f) => listFingerprint(f.deck));
const LEDGER_STORE = LEDGER ? new LedgerStore(LEDGER.dir) : null;
const RUN_ID = `forge ${new Date().toISOString()} seed ${V.seed}`;
/** every game a generation's confirmation may play (each stage up to the cap), from its first confirmation seed */
const confirmSlots = (seed1: number): GameSlot[] => Array.from({ length: STAGES }, (_, s) => blockSlots(seed1 + s * FIRST_STAGE, FIRST_STAGE, OPPONENTS)).flat();

const targets = V.nc ? lib.filter((d) => d.kind === 'original') : positionals.map((q) => resolveDeck(q, lib));
if (!targets.length) {
  console.error('error: name at least one deck, or pass --nc');
  process.exit(2);
}
/** Deterministic per-run seed stream (was Math.random, so runs could not be repeated). */
let seedState = (V.seed * 2654435761) >>> 0 || 1;
const nextSeedOffset = () => (seedState = (seedState * 1664525 + 1013904223) >>> 0) % 90_000;

/** Format-wide card impact: IWD averaged across all analysed decks, weighted by sample size. */
const GLOBAL_IMPACT: Record<string, number> = (() => {
  const acc: Record<string, { s: number; n: number }> = {};
  for (const r of (analysis as any).decks as DeckReport[]) {
    for (const c of r.cards) {
      if (typeof c.iwd !== 'number' || !Number.isFinite(c.iwd)) continue;
      acc[c.id] ??= { s: 0, n: 0 };
      acc[c.id].s += c.iwd * c.seenGames;
      acc[c.id].n += c.seenGames;
    }
  }
  return Object.fromEntries(Object.entries(acc).filter(([, v]) => v.n >= IMPACT_MIN_POOLED_GAMES).map(([k, v]) => [k, v.s / v.n]));
})();

/** package moves screened per generation, at most (for the estimate) */
const PKG_N = PACKAGES ? (V['package-moves'] ? V['package-cands'] : 0) + (V['require-packages'] ? V['package-cands'] : 0) : 0;
const ESTIMATE = estimateGames({ gens: GENS, screenGames: GAMES, singles: CANDS, packageMoves: PKG_N, depth: DEPTH, firstStage: FIRST_STAGE, rule: RULE });

/** games played so far in this process (each forged deck's manifest counts its own) */
let gamesPlayed = 0;

const jobsFor = (deck: DeckList, seed0: number, games: number, trace: boolean): MatchJob[] =>
  Array.from({ length: games }, (_, k) => ({ a: deck, b: field[k % field.length].deck, seed: seed0 + k, first: (Math.floor(k / field.length) % 2) as 0 | 1, bot: BOT, trace }));

/** The baseline with telemetry: win rate, summaries and per-game scores. */
async function play(deck: DeckList, seed0: number, games: number, trace: boolean) {
  const res = await runJobs(jobsFor(deck, seed0, games, trace), { threads: THREADS, cache });
  gamesPlayed += res.length;
  const scores = res.map((r) => scoreOf(r.winner));
  const sums = trace ? res.map((r) => r.summaries![0]) : [];
  return { wr: scores.reduce((a, b) => a + b, 0) / scores.length, sums, scores };
}

/** Several lists on the same games (one worker pool): per-game scores for each, in game order. */
async function playMany(decks: DeckList[], seed0: number, games: number): Promise<number[][]> {
  const res = await runJobs(decks.flatMap((d) => jobsFor(d, seed0, games, false)), { threads: THREADS, cache });
  gamesPlayed += res.length;
  return decks.map((_, i) => res.slice(i * games, (i + 1) * games).map((r) => scoreOf(r.winner)));
}

/** The list's plan: the flags, with the deck objective's packages as the default keep (only when package flags are on). */
function planFor(target: (typeof lib)[number]): PackagePlan {
  const plan = planFromFlags(V, objectivePackages(target.file), target.deck);
  exitOnPlanProblems(plan);
  return plan;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
/** "could not tell (stopped early: no gain after 448 games)" and the like */
const word = (c: Confirmation) => confirmationWord(c, RULE.futilityMaxGainPp);
const mutKind = (m: Mutation) => (m.combo ? `combo-${m.combo.packages ? 'packages' : 'cards'}` : m.pkg?.kind);

interface Screened {
  m: Mutation;
  wr: number;
  /** paired with the baseline on the screening seeds (plain 95%) */
  iv: PairedInterval;
}

async function forge(target: (typeof lib)[number]) {
  let deck: DeckList = structuredClone(target.deck);
  const plan = planFor(target);
  const slug = target.file.replace(/\.txt$/, '');
  const ruleLine = describeRule(RULE, { firstStage: FIRST_STAGE, nominees: DEPTH.nominees, ledger: !!LEDGER });
  const log: string[] = [`# Forge log — ${deck.name}`, '', `Field: ${field.map((f) => f.deck.name).join(', ')} · bot ${BOT} · ${GAMES} games per test`, '', `Adoption rule: ${ruleLine}.`, ''];
  /** the change ledger for this deck's run (--ledger) */
  const ledger = LEDGER && LEDGER_STORE ? new RunLedger({ dir: LEDGER.dir, simVersion: SIM_VERSION, bot: LEDGER.bot, opponents: OPPONENTS, run: RUN_ID, date: new Date().toISOString().slice(0, 10), store: LEDGER_STORE }) : null;
  if (ledger) log.push(`Change ledger: ${LEDGER!.dir} (bot ${LEDGER!.bot}, simulator version ${SIM_VERSION}, field ${ledger.field}).`, '');
  if (SHORT) log.push(`Shortlist: ${describeShortlist(SHORT, NOMINATE_BAR)}.`, '');
  if (DEPTH.cardsPerChange > 1 || DEPTH.packagesPerChange > 1 || DEPTH.nominees > 1)
    log.push(`Search depth: up to ${DEPTH.cardsPerChange} card swap(s) and ${DEPTH.packagesPerChange} package move(s) per candidate (combined from the best ${DEPTH.combineFrom} screened), ${DEPTH.nominees} nominee(s) confirmed per generation.`, '');
  if (PACKAGES) log.push(`Packages: ${describePlan(plan)}${V['package-moves'] ? `; package moves on (${V['package-cands']} per generation)` : '; package moves off'}.`, '');
  if (PARTNER) log.push('Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).', '');
  /** package moves tried (labels), for the report and the manifest */
  const tried: string[] = [];
  const history: { gen: number; wr: number; change: string; gain?: PairedInterval; priorGames?: number; baseline: number; baselineGames: number }[] = [];
  // machine-readable twin of the log, for scripts/bundle-reports.ts (percentages and points, 1 decimal, as in the log)
  const p1 = (x: number) => +(x * 100).toFixed(1);
  const startedAt = new Date().toISOString();
  const playedBefore = gamesPlayed;
  const adoption: AdoptionProvenance = adoptionProvenance(RULE, { firstStage: FIRST_STAGE, nominees: DEPTH.nominees, cardsPerChange: DEPTH.cardsPerChange, packagesPerChange: DEPTH.packagesPerChange }, !!LEDGER);
  const json: {
    deck: string;
    file: string;
    date: string;
    seed: number;
    field: string;
    /** the adoption rule in words and numbers */
    adoption: AdoptionProvenance & { text: string };
    gens: {
      gen: number;
      baseline: number;
      /** `pooled` (--pooled-ranking, when the change has games from earlier runs): its gain in points over all its games */
      swaps: { swap: string; wr: number; delta: number; package?: string; pooled?: { gain: number; games: number; earlier: number } }[];
      /** --pooled-ranking: the changes carried from earlier runs, the generator's picks skipped and why (gains in points) */
      shortlist?: ShortlistNote;
      /** partner-aware runs: the cut ranking (plain and partner-aware scores in points, offered or not and why) */
      cuts?: { card: string; plain: number; score: number; offered: boolean; plainOffered: boolean; why: string }[];
      /** partner-aware runs: the swaps the plain ranking would have screened from the same games */
      plainSwaps?: string[];
      /** the nominees with their screening and held-out results */
      nominees?: NomineeRecord[];
      confirm?: string;
      verdict: 'adopted' | 'rejected' | 'inconclusive' | 'kept';
      /** held-out paired gain of the adopted change, points (`priorGames`: pooled, this many from earlier runs) */
      heldOutGain?: { mean: number; lower: number; upper: number; games: number; priorGames?: number };
    }[];
    summary: { gen: number; wr: number; change: string }[];
    /** with package flags only: the plan, and the built-around packages kept, added and removed from start to end */
    packages?: { plan: PackagePlan; moves: boolean; changes: PackageChanges; adopted: string[] };
    /** with --ledger only: where it is kept and what this run appended (games) */
    ledger?: { dir: string; bot: string; field: string; screen: { written: number; duplicates: number; conflicts: number }; heldout: { written: number; duplicates: number; conflicts: number } };
    /** with --pooled-ranking only: the shortlist's settings */
    shortlist?: { carry: number; dropSe: number; reach: number; nominateBarPp: number };
    manifest?: RunManifest;
  } = {
    deck: deck.name,
    file: target.file,
    date: new Date().toISOString().slice(0, 10),
    seed: V.seed,
    field: `${field.map((f) => f.deck.name).join(', ')} · bot ${BOT} · ${GAMES} games per test`,
    adoption: { ...adoption, text: ruleLine },
    gens: [],
    summary: [],
    ...(SHORT ? { shortlist: { ...SHORT, nominateBarPp: NOMINATE_BAR * 100 } } : {}),
  };
  const screen = async (muts: Mutation[], seed0: number, base: number[]): Promise<Screened[]> => {
    if (!muts.length) return [];
    const all = await playMany(muts.map((m) => m.deck), seed0, GAMES);
    const slots = blockSlots(seed0, GAMES, OPPONENTS);
    return muts.map((m, i) => {
      const s = all[i]!;
      ledger?.record('screen', deck, m.deck, m.label, scored(slots, base, s));
      const r = { m, wr: s.reduce((a, b) => a + b, 0) / s.length, iv: pairedInterval(s, base) };
      console.log(`  ${pct(r.wr)} (${(r.iv.mean * 100).toFixed(1)})  ${m.label}`);
      return r;
    });
  };
  for (let gen = 1; gen <= GENS; gen++) {
    const seed0 = 100_000 * gen + nextSeedOffset();
    const base = await play(deck, seed0, GAMES, true);
    const rep = analyzeDeck(deck.name, base.sums);
    console.log(`\n[${deck.name}] gen ${gen}: baseline ${pct(base.wr)}`);
    log.push(`## Generation ${gen} — baseline ${pct(base.wr)}`, '', ...rep.insights.slice(0, 4).map((s) => `- ${s}`), '');
    const partner = PARTNER ? { sums: base.sums } : undefined;
    // --pooled-ranking: the generator's whole order (its first CANDS are today's swaps), to fall back on past skipped picks
    const explained = forgeSwapsExplained(deck, rep, GLOBAL_IMPACT, SHORT ? Infinity : CANDS, plan, partner);
    let muts: Mutation[] = explained.swaps;
    /** the swaps the forge screens without --pooled-ranking (the plan's comparison below is against these) */
    const todays = SHORT ? explained.swaps.slice(0, CANDS) : muts;
    let shortNote: ShortlistNote | undefined;
    if (SHORT && ledger) {
      const g = shortlistGeneration({
        run: ledger,
        base: deck,
        plan,
        rule: { rule: RULE, nominees: DEPTH.nominees, minGainPp: RULE.minGainPp, nominateBar: NOMINATE_BAR, shortlist: SHORT },
        picks: explained.swaps,
        cands: CANDS,
        make: (cut, add, d) => ({ label: `-1 ${cardLabel(CARD_BY_ID[cut])} → +1 ${cardLabel(CARD_BY_ID[add])}`, deck: d, prior: 0 }),
      });
      muts = g.candidates;
      shortNote = g.note;
      const o = { nominateBar: NOMINATE_BAR, dropSe: SHORT.dropSe, reach: SHORT.reach };
      const lines = [
        ...shortNote.carried.map((c) => `- carried from earlier runs: ${c.label}, ${pooledWords(c.gain, c.games, c.heldout)}`),
        ...shortNote.skipped.map((s) => `- skipped: ${s.label}: ${skippedWords(s, o)}`),
        ...(shortNote.short ? [`- the swap generator ran out: ${CANDS - shortNote.short} one-card swap${CANDS - shortNote.short === 1 ? '' : 's'} screened instead of ${CANDS}`] : []),
      ];
      log.push('Shortlist (pooled across runs):', ...(lines.length ? lines : ['- nothing carried or skipped: no change offered here has games from earlier runs']), '');
      for (const l of lines) console.log(`  shortlist ${l.slice(2)}`);
    }
    const cutRows = explained.cuts ? cutTableRows(explained.cuts) : [];
    let genRecPlain: string[] | undefined;
    if (cutRows.length) {
      log.push('Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):', '', '| Card | Plain | Partner-aware score | Offered | Why |', '|---|---|---|---|---|', ...cutRows.map((r) => `| ${r.name} | ${((r.plain) * 100).toFixed(1)} | ${(r.score * 100).toFixed(1)} | ${r.offered ? 'yes' : 'no'} | ${r.why} |`), '');
      console.log(`  cuts (partner-aware): ${cutRows.filter((r) => r.offered).map((r) => r.name).join(', ')}${cutRows.some((r) => r.plainOffered !== r.offered) ? ` (plain ranking: ${cutRows.filter((r) => r.plainOffered).map((r) => r.name).join(', ')})` : ''}`);
      // the candidates the plain ranking would have screened from the same games, for comparison
      const plainMuts = forgeSwaps(deck, rep, GLOBAL_IMPACT, CANDS, plan);
      log.push('Screened (partner-aware):', ...muts.map((m) => `- ${m.label}`), '', 'The plain ranking would have screened:', ...plainMuts.map((m) => `- ${m.label}`), '');
      genRecPlain = plainMuts.map((m) => m.label);
    }
    if (PACKAGES) {
      // what the plan changed: the swaps the forge would have tried without it, and why each was not played
      const free = forgeSwaps(deck, rep, GLOBAL_IMPACT, CANDS, {}, partner);
      const dropped = free.filter((m) => !todays.some((x) => x.label === m.label));
      if (dropped.length) {
        log.push(`The package plan kept ${dropped.length} swap${dropped.length === 1 ? '' : 's'} from being played:`, ...dropped.map((m) => `- ${m.label}: ${checkChange(deck, m.deck, plan).map((v) => v.text).join('; ') || 'replaced by a better allowed swap'}`), '');
        console.log(`  plan: ${dropped.length} swap(s) not played (${dropped.map((m) => m.label).join('; ')})`);
      }
      muts.push(...packageCandidates(deck, plan, { moves: V['package-moves'], n: V['package-cands'], score: forgeScore(rep, GLOBAL_IMPACT) }));
    }
    tried.push(...muts.filter((m) => m.pkg).map((m) => m.label));
    const screened = await screen(muts, seed0, base.scores);
    // depth: combine the best screened single changes (only those that screened above the baseline)
    const seen = new Set([listKeyOf(deck), ...muts.map((m) => listKeyOf(m.deck))]);
    const above = (pkg: boolean) => screened.filter((r) => !!r.m.pkg === pkg && r.wr > base.wr).sort((a, b) => b.wr - a.wr).map((r) => r.m);
    const combos = [
      ...(DEPTH.cardsPerChange > 1 ? combineMutations(deck, above(false), { maxParts: DEPTH.cardsPerChange, from: DEPTH.combineFrom, plan, seen }) : []),
      ...(DEPTH.packagesPerChange > 1 ? combineMutations(deck, above(true), { maxParts: DEPTH.packagesPerChange, from: DEPTH.combineFrom, plan, seen }) : []),
    ];
    if (combos.length) {
      console.log(`  combined candidates: ${combos.length}`);
      tried.push(...combos.filter((m) => m.combo?.packages).map((m) => m.label));
      screened.push(...(await screen(combos, seed0, base.scores)));
    }
    const results = [...screened].sort((a, b) => b.wr - a.wr);
    /** --pooled-ranking: each screened change's gain over all its games (this generation's screening included, each game once) */
    const figs = new Map<Screened, PooledFigure>();
    if (SHORT && ledger) {
      const own = gameIds(blockSlots(seed0, GAMES, OPPONENTS));
      for (const r of results) figs.set(r, pooledFigure(ledger.entryOf(ledger.entryId(deck, r.m.deck).change), { ids: own, gain: r.wr - base.wr, games: GAMES }));
    }
    const pooledCell = (r: Screened) => {
      const f = figs.get(r);
      return f?.earlier ? pooledWords(f.gain, f.games) : '—';
    };
    log.push(
      `| Swap | Win % | Δ vs baseline | Paired 95% (screening) |${SHORT ? ' Pooled with earlier runs |' : ''}`,
      `|---|---|---|---|${SHORT ? '---|' : ''}`,
      ...results.map((r) => `| ${r.m.label} | ${pct(r.wr)} | ${((r.wr - base.wr) * 100).toFixed(1)} | [${(r.iv.lower * 100).toFixed(1)}, ${(r.iv.upper * 100).toFixed(1)}] |${SHORT ? ` ${pooledCell(r)} |` : ''}`),
      '',
    );
    const pooledOf = (r: Screened) => {
      const f = figs.get(r);
      return f?.earlier ? { pooled: { gain: p1(f.gain), games: f.games, earlier: f.earlier } } : {};
    };
    const genRec: (typeof json.gens)[number] = {
      gen,
      baseline: p1(base.wr),
      swaps: results.slice(0, PACKAGES || combos.length ? results.length : 5).map((r) => ({ swap: r.m.label, wr: p1(r.wr), delta: p1(r.wr - base.wr), ...(mutKind(r.m) ? { package: mutKind(r.m) } : {}), ...pooledOf(r) })),
      verdict: 'kept',
      ...(cutRows.length ? { cuts: cutRows.map((r) => ({ card: r.name, plain: p1(r.plain), score: p1(r.score), offered: r.offered, plainOffered: r.plainOffered, why: r.why })) } : {}),
      ...(genRecPlain ? { plainSwaps: genRecPlain } : {}),
      ...(shortNote
        ? {
            shortlist: {
              carried: shortNote.carried.map((c) => ({ ...c, gain: p1(c.gain) })),
              skipped: shortNote.skipped.map((s) => ({ ...s, ...(s.gain !== undefined ? { gain: p1(s.gain) } : {}), ...(s.toSettle !== undefined ? (Number.isFinite(s.toSettle) ? { toSettle: Math.round(s.toSettle) } : { toSettle: undefined }) : {}) })),
              short: shortNote.short,
            },
          }
        : {}),
    };
    json.gens.push(genRec);
    // screening only nominates: the best changes that beat the baseline by 2+ points on the shared seeds
    const seed1 = seed0 + CONFIRM_GAP;
    const barOf = (m: Mutation) => (isPackageChange(m) ? RULE.packageMinGainPp : RULE.minGainPp);
    /** --ledger: the games the prior leaves out (every game the confirmation may play, and the screening games) */
    const leaveOut = ledger ? gameIds([...confirmSlots(seed1), ...blockSlots(seed0, GAMES, OPPONENTS)]) : new Set<string>();
    const priorFor = (m: Mutation): PairedScores | undefined => (ledger && RULE.kind === 'evidence' ? ledger.prior(deck, m.deck, leaveOut) : undefined);
    // --pooled-ranking: nominees by pooled gain (a change with no earlier games keeps its own screening figure)
    const gainOf = (r: Screened) => figs.get(r)?.gain ?? r.wr - base.wr;
    const above2 = (SHORT ? byPooledGain(results, (r) => figs.get(r)!) : results).filter((r) => gainOf(r) >= NOMINATE_BAR);
    let nominated = above2.slice(0, DEPTH.nominees);
    if (ledger && RULE.kind === 'evidence') {
      // a change whose earlier held-out games alone already reject it is not nominated: the next best takes its place
      nominated = [];
      for (const r of above2) {
        if (nominated.length >= DEPTH.nominees) break;
        const p = priorFor(r.m);
        if (p?.base.length) {
          const j = judgePooled(p.cand, p.base, { alpha: RULE.alpha, nominees: DEPTH.nominees, minGainPp: barOf(r.m), minGames: RULE.minGames });
          if (j.verdict === 'reject') {
            const words = pooledGainWords({ heldOut: j.iv, looks: 0, priorGames: p.base.length });
            log.push(`Not nominated: ${r.m.label} (screening ${formatGain(r.iv)}): its earlier held-out games already reject it, ${words}.`, '');
            console.log(`  ledger: ${r.m.label} not nominated, earlier games reject it: ${words}`);
            continue;
          }
          // --pooled-ranking: nor a change its earlier held-out games put out of reach
          const reach = SHORT ? outOfReach(p, { rule: RULE, nominees: DEPTH.nominees, minGainPp: barOf(r.m), reach: SHORT.reach }) : null;
          if (SHORT && reach?.out) {
            const why = skippedWords({ label: r.m.label, why: 'out-of-reach', gain: j.iv.mean, games: p.base.length, heldout: p.base.length, toSettle: reach.toSettle }, { nominateBar: NOMINATE_BAR, dropSe: SHORT.dropSe, reach: SHORT.reach });
            log.push(`Not nominated: ${r.m.label} (screening ${formatGain(r.iv)}): ${why}.`, '');
            console.log(`  shortlist: ${r.m.label} not nominated, ${why}`);
            continue;
          }
        }
        nominated.push(r);
      }
    }
    if (!nominated.length) {
      log.push(SHORT ? `No change beat the baseline by 2+ points on its pooled games, or none could be nominated — **list kept**.` : `No swap beat the baseline by 2+ points — **list kept**.`, '');
      history.push({ gen, wr: base.wr, change: 'kept', baseline: base.wr, baselineGames: GAMES });
      continue;
    }
    // confirm on fresh seeds (never used by this generation's screening), paired, in stages
    const priors = ledger ? nominated.map((r) => priorFor(r.m)) : undefined;
    const conf = await confirmStaged(
      RULE,
      nominated.map((r) => ({ minGainPp: barOf(r.m) })),
      FIRST_STAGE,
      async ({ offset, games, active }) => {
        const [b, ...ns] = await playMany([deck, ...active.map((i) => nominated[i]!.m.deck)], seed1 + offset, games);
        if (ledger) {
          const slots = blockSlots(seed1 + offset, games, OPPONENTS);
          active.forEach((i, k) => ledger.record('heldout', deck, nominated[i]!.m.deck, nominated[i]!.m.label, scored(slots, b!, ns[k]!)));
        }
        return { base: b!, nominees: ns };
      },
      undefined,
      priors,
    );
    const pick = pickAdopted(conf.results);
    genRec.nominees = nominated.map((r, i) => nomineeRecord(r.m.label, r.iv, conf.results[i], mutKind(r.m)));
    nominated.forEach((r, i) => {
      const c = conf.results[i]!;
      const line = c.priorGames
        ? `baseline ${pct(c.baseWr)} vs swap ${pct(c.candWr)} (pooled); held-out paired gain ${pooledGainWords(c)}`
        : `baseline ${pct(c.baseWr)} vs swap ${pct(c.candWr)}; held-out paired gain ${formatGain(c.heldOut)}${RULE.kind === 'evidence' ? ` (z ${c.heldOut.z.toFixed(2)}, ${c.looks} stage${c.looks === 1 ? '' : 's'})` : ''}`;
      log.push(`Confirmation of ${r.m.label} (${c.priorGames ? 'held-out paired games pooled with earlier runs' : 'fresh paired games'}; screening ${formatGain(r.iv)}): ${line} → **${word(c)}**${c.outcome === 'adopt' && i !== pick ? ' (another nominee had the higher lower bound)' : ''}`, '');
      console.log(`  confirm ${r.m.label}: ${line} → ${outcomeWord(c.outcome).toUpperCase()}${c.stopped ? ` (${stoppedWords(c.stopped, c.heldOut.games, RULE.futilityMaxGainPp)})` : ''}`);
    });
    const shown = pick >= 0 ? pick : 0;
    const sc = conf.results[shown]!;
    genRec.confirm = sc.priorGames
      ? `(${sc.heldOut.games} paired games, ${sc.priorGames} of them from earlier runs): baseline ${pct(sc.baseWr)} vs swap ${pct(sc.candWr)}; held-out gain ${pooledGainWords(sc)} → ${word(sc)}`
      : `(${sc.heldOut.games} fresh paired games): baseline ${pct(sc.baseWr)} vs swap ${pct(sc.candWr)}; held-out gain ${formatGain(sc.heldOut)} → ${word(sc)}`;
    if (pick >= 0) {
      const won = nominated[pick]!;
      deck = won.m.deck;
      genRec.verdict = 'adopted';
      genRec.heldOutGain = { mean: p1(sc.heldOut.mean), lower: p1(sc.heldOut.lower), upper: p1(sc.heldOut.upper), games: sc.heldOut.games, ...(sc.priorGames ? { priorGames: sc.priorGames } : {}) };
      history.push({ gen, wr: sc.candWr, change: won.m.label, gain: sc.heldOut, ...(sc.priorGames ? { priorGames: sc.priorGames } : {}), baseline: base.wr, baselineGames: GAMES });
    } else if (conf.results.some((c) => c.outcome === 'inconclusive')) {
      genRec.verdict = 'inconclusive';
      const i = conf.results.findIndex((c) => c.outcome === 'inconclusive');
      const ci = conf.results[i]!;
      const why = stoppedWords(ci.stopped, ci.heldOut.games, RULE.futilityMaxGainPp);
      history.push({ gen, wr: ci.baseWr, change: `kept (could not tell: ${nominated[i]!.m.label}, ${ci.priorGames ? pooledGainWords(ci) : formatGain(ci.heldOut)}${why ? `; ${why}` : ''})`, baseline: base.wr, baselineGames: GAMES });
    } else {
      genRec.verdict = 'rejected';
      history.push({ gen, wr: sc.baseWr, change: 'kept (swap failed confirmation)', baseline: base.wr, baselineGames: GAMES });
    }
  }
  // save
  const adoptedRows = history.filter((h) => !h.change.startsWith('kept'));
  const changed = adoptedRows.length > 0;
  const pkgChanges = packageChanges(target.deck, deck);
  const adoptedPkg = adoptedRows.filter((h) => tried.includes(h.change)).map((h) => h.change);
  const pkgLine = PACKAGES ? `\n// Packages: ${describePlan(plan)}; ${describeChanges(pkgChanges)}${adoptedPkg.length ? `; package moves adopted: ${adoptedPkg.join('; ')}` : ''}` : '';
  const withGain = (h: (typeof history)[number]) => `${h.change}${h.gain ? ` (held-out ${formatGain(h.gain)}${h.priorGames ? `, pooled: ${h.priorGames} from earlier runs` : ''})` : ''}`;
  if (changed) {
    const inCustom = target.kind === 'custom' || target.kind === 'original';
    // ladder decks are our own theorized lists: forge them in place and keep their full provenance header
    const inPlace = inCustom || target.kind === 'ladder';
    const orig = path.join(inCustom ? 'data/decks/custom' : 'data/decks', target.file);
    if (!OUT) {
      const hist = path.join('data/decks/custom/history');
      fs.mkdirSync(hist, { recursive: true });
      if (fs.existsSync(orig)) fs.copyFileSync(orig, path.join(hist, `${slug}-${new Date().toISOString().slice(0, 10)}.txt`));
    } else fs.mkdirSync(OUT, { recursive: true });
    const outFile = OUT ? path.join(OUT, inPlace ? target.file : `${slug}-forged.txt`) : inPlace ? orig : path.join('data/decks/custom', `${slug}-forged.txt`);
    const prev = fs.existsSync(orig) ? fs.readFileSync(orig, 'utf8') : '';
    const idea =
      target.kind === 'ladder'
        ? (prev.match(/^\/\/ (Origin|Author|Source|Via|Credits|Parents|Added|Idea): .+$/gm) ?? []).join('\n')
        : (prev.match(/^\/\/ Idea: .+$/m)?.[0] ?? '');
    fs.writeFileSync(
      outFile,
      `${exportOfficial(inPlace ? deck : { ...deck, name: `${deck.name} (forged)` })}\n\n${idea}\n// Forged ${new Date().toISOString().slice(0, 10)}: ${adoptedRows.map(withGain).join('; ')}\n// Adoption: ${ruleLine}${pkgLine}\n`,
    );
    log.push(OUT ? `Saved ${outFile} (--out: the library was not changed).` : `Saved ${outFile} (previous version archived in data/decks/custom/history/).`);
  }
  if (PACKAGES) {
    log.push('', `Packages (built around, start → end): ${describeChanges(pkgChanges)}.${adoptedPkg.length ? ` Package moves adopted: ${adoptedPkg.join('; ')}.` : ''}`);
    json.packages = { plan, moves: V['package-moves'], changes: pkgChanges, adopted: adoptedPkg };
  }
  if (ledger && LEDGER) {
    const line = ledger.summary();
    log.push('', `Change ledger: ${line}.`);
    console.log(`  ledger: ${line}`);
    json.ledger = { dir: LEDGER.dir, bot: LEDGER.bot, field: ledger.field, screen: { ...ledger.totals.screen }, heldout: { ...ledger.totals.heldout } };
  }
  log.push(
    '',
    '## Summary',
    '',
    'Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.',
    '',
    '| Gen | Win % | Change |',
    '|---|---|---|',
    ...history.map((h) => `| ${h.gen} | ${pct(h.wr)} | ${withGain(h)} |`),
  );
  json.summary = history.map((h) => ({ gen: h.gen, wr: p1(h.wr), change: withGain(h) }));
  json.manifest = gameRunManifest({
    purpose: 'forge',
    decks: [target, ...field],
    fieldMode: FIELD,
    fieldDeckIds: field.map((f) => manifestDeck(f).id),
    bot: BOT,
    seedBase: V.seed,
    seatPolicy: 'alternate',
    // planned = the most this run could play (every confirmation to the cap); generations that keep the list skip it
    plannedGames: ESTIMATE.max,
    completedGames: gamesPlayed - playedBefore,
    gamesPerPair: null,
    trace: true,
    simVersion: SIM_VERSION,
    createdAt: startedAt,
    ...(PACKAGES ? { packages: packageProvenance(plan, { moves: tried }) } : {}),
    adoption,
  });
  const reportDir = OUT ? path.join(OUT, 'forge') : 'reports/forge';
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, `${slug}.md`), log.join('\n'));
  fs.writeFileSync(path.join(reportDir, `${slug}.json`), JSON.stringify(json, null, 1));
  return { name: deck.name, gens: history.map(({ gen, change, gain, priorGames, baseline, baselineGames }) => ({ gen, change, gain, ...(priorGames ? { priorGames } : {}), baseline, baselineGames })), games: gamesPlayed - playedBefore };
}

async function main() {
  console.log(`Forging ${targets.length} deck(s) × ${GENS} generations vs ${field.length} field decks`);
  console.log(`Adoption rule: ${describeRule(RULE, { firstStage: FIRST_STAGE, nominees: DEPTH.nominees, ledger: !!LEDGER })}`);
  checkBudget(`forge, ${GENS} generation${GENS === 1 ? '' : 's'}`, ESTIMATE, V.budget, V.force);
  const all = [];
  for (const t of targets) all.push(await forge(t));
  // leads with the held-out paired result; per-generation win rates are that generation's own games (scripts/forge-summary.ts)
  const md = forgeSummaryMarkdown(all, describeRule(RULE, { firstStage: FIRST_STAGE, nominees: DEPTH.nominees, ledger: !!LEDGER }));
  fs.mkdirSync(OUT ? path.join(OUT, 'forge') : 'reports/forge', { recursive: true });
  fs.writeFileSync(OUT ? path.join(OUT, 'forge', 'summary.md') : 'reports/forge/summary.md', md);
  console.log('\n' + md);
}
runMain(main);
