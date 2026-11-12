// Deck optimizer: hill-climb single-card swaps (and legend swaps) against the meta field.
//   npx tsx scripts/optimize.ts <deck> [--screen 70] [--confirm 280] [--candidates 40] [--bot lookahead] [--threads N]
//   npx tsx scripts/optimize.ts <deck> --vs <opponent> --sideboard     (Bo3 plan: only swaps using the deck's 7-card sideboard)
//   --out DIR   write the reports to DIR instead of reports/
//   --cache     read games already played with the same code, decks, seeds and bot from .cache/games and store new
//               ones (scripts/game-cache.ts); prints how many games were hits
// Synergy packages (opt-in, as in scripts/forge.ts; docs/SYNERGIES.md): --keep-packages a,b (default with any package
// flag: the deck objective's packages; "none" keeps nothing), --keep-built-around (also keep the list's own packages:
// those its game plan names, else the ones it is built around), --require-packages a,b, --avoid-packages a,b,
// --lock-cards id[:n],..., --package-moves (adds --package-cands N whole-package moves, default 3, to the candidates).
// --partner-aware (on by itself with any package flag; --plain-ranking turns it off): the weakest-card and strongest-card
// picks add each card's package stranding cost and add credit (src/lib/cutRanking.ts; no telemetry here, so no partner
// split). Without it the candidates are the pinned ones.
// Adoption rule and search depth (as in scripts/forge.ts; docs/SYNERGIES.md "When a deck change is adopted"):
//   --adopt evidence|any-gain (any-gain: the old report, best list = best stage-2 win rate)   --min-gain P (1)
//   --package-min-gain P   --min-games N (200)   --confirm-cap K (4)   --alpha A (0.05)
//   --futility-after N (2; 0 = off)   --futility-gain X (0): each nominee with a held-out paired mean gain of at most
//   X points after N stages stops early as "could not tell" (negative X as --futility-gain=-1)
//   --nominees N (6: the stage-1 leaders confirmed)   --cards-per-change N (1-3)   --packages-per-change N (1-2)
//   --combine-from N (4)   --budget N (12000)   --force
// Stage 1 screens many candidate swaps with a small sample on shared seeds; it only nominates. Stage 2 confirms the
// nominees (those that screened above the unmodified deck) against the unmodified deck on fresh, identical seeds,
// paired, in stages of --confirm games up to --confirm-cap stages. The best list is the adopted nominee with the
// highest corrected lower bound; with none adopted the list is kept. Writes reports/optimize-<deck>[-vs-<opp>]-latest.md
// and a .json twin (read by scripts/bundle-reports.ts).
import fs from 'node:fs';
import path from 'node:path';
import { exportOfficial } from '../src/engine/deck';
import { cardValue } from '../src/ai/knowledge';
import { bool, cli, int, loadLibrary, oneOf, resolveDeck, runJobs, runMain, SIM_BOTS, str, threadsOpt } from './lib-node';
import { optimizeCandidates, packageCandidates, type Cand } from './builder-moves';
import { exitOnPlanProblems, objectivePackages, packagesOn, partnerAwareOn, planFromFlags, tunerPackageFlags } from './package-flags';
import { adoptionFlags, budgetFlags, checkBudget, depthFlags, depthFromFlags, exitOnRuleProblems, ruleFromFlags } from './evidence-flags';
import { describeChanges, describePlan, packageChanges, packageProvenance } from '../src/lib/deckPackages';
import { gameRunManifest, manifestDeck } from '../src/lib/runManifest';
import { SIM_VERSION } from '../src/lib/tournament';
import { adoptionProvenance, confirmationWord, confirmStaged, describeRule, formatGain, nomineeRecord, pairedInterval, pickAdopted, scoreOf, type Confirmation } from '../src/lib/evidence';
import { combinedCandidates, estimateGames, listKeyOf } from '../src/lib/deckSearch';
import type { MatchJob } from './worker';
import { cliGameCache } from './game-cache';

const NOMINEES = 6;
const { values: V, positionals } = cli(
  import.meta.url,
  {
    screen: int(70, { min: 1 }),
    confirm: int(280, { min: 1 }),
    candidates: int(40, { min: 1 }),
    bot: oneOf(SIM_BOTS, 'lookahead'),
    vs: str(''),
    sideboard: bool(),
    threads: threadsOpt(),
    out: str(),
    cache: bool(),
    ...tunerPackageFlags(),
    ...adoptionFlags(),
    ...depthFlags(NOMINEES),
    ...budgetFlags(),
  },
  { minPositionals: 1, maxPositionals: 1 },
);
const base = resolveDeck(positionals[0]);
const SCREEN = V.screen;
const CONFIRM = V.confirm;
const NCAND = V.candidates;
const BOT = V.bot;
const VS = V.vs;
const SIDEBOARD = V.sideboard;
const THREADS = Math.min(V.threads, 16);
/** --cache: games already played with the same code are read from .cache/games (scripts/game-cache.ts) */
const cache = cliGameCache(V.cache);
const field = VS ? [resolveDeck(VS)] : loadLibrary().filter((d) => d.kind === 'meta' && d.deck.name !== base.deck.name);
const OUT = V.out;
const PACKAGES = packagesOn(V);
const PARTNER = partnerAwareOn(V);
const PLAN = planFromFlags(V, objectivePackages(base.file), base.deck);
exitOnPlanProblems(PLAN);
const RULE = ruleFromFlags(V);
exitOnRuleProblems(RULE);
const DEPTH = depthFromFlags(V, NOMINEES);
const LEGACY = RULE.kind === 'any-gain';
const SCREEN_SEED = 424242;
const CONFIRM_SEED = 777777;
const STAGES = LEGACY ? 1 : RULE.capStages;
if (SCREEN_SEED + SCREEN > CONFIRM_SEED) {
  console.error(`error: --screen ${SCREEN} would reach the confirmation seeds (${CONFIRM_SEED}).\nRun with --help for usage.`);
  process.exit(2);
}
const PKG_N = PACKAGES && !SIDEBOARD ? (V['package-moves'] ? V['package-cands'] : 0) + (V['require-packages'] ? V['package-cands'] : 0) : 0;
// the optimizer screens the unmodified deck among its candidates; legacy confirms the top 6 plus the baseline once
const ESTIMATE = estimateGames({ gens: 1, screenGames: SCREEN, singles: NCAND + 1, packageMoves: PKG_N, depth: LEGACY ? { ...DEPTH, nominees: 6 } : DEPTH, firstStage: CONFIRM, rule: RULE, baselineScreen: false });

function candidates(deck: (typeof base)['deck']): Cand[] {
  const out = optimizeCandidates(deck, SIDEBOARD, NCAND, PLAN, PARTNER);
  // package moves come after the shuffled swaps, so every one of them is screened
  if (PACKAGES && !SIDEBOARD) out.push(...packageCandidates(deck, PLAN, { moves: V['package-moves'], n: V['package-cands'], score: cardValue }));
  return out;
}

/** Per-game scores of every candidate on the same games (identical seeds for every candidate → paired comparisons). */
async function measure(cands: Cand[], gamesPerCand: number, seed0: number): Promise<number[][]> {
  const jobs: MatchJob[] = [];
  cands.forEach((c, ci) => {
    let seed = seed0;
    for (let k = 0; k < gamesPerCand; k++) {
      const opp = field[k % field.length];
      jobs.push({ a: { ...c.deck, name: `cand${ci}` }, b: opp.deck, seed: seed++, first: (Math.floor(k / field.length) % 2) as 0 | 1, bot: BOT });
    }
  });
  const res = await runJobs(jobs, { threads: THREADS, cache });
  const out: number[][] = cands.map(() => []);
  for (const r of res) out[+r.a.slice(4)].push(scoreOf(r.winner));
  return out;
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const pts = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}`;

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`Optimizing ${base.deck.name} vs ${field.length} meta decks (bot=${BOT})`);
  if (PACKAGES) console.log(`Packages: ${describePlan(PLAN)}${V['package-moves'] ? `; package moves on (${V['package-cands']})` : ''}`);
  if (PARTNER) console.log('Cut ranking: partner-aware (stranding cost and add credit; no telemetry, so no partner split)');
  console.log(`Adoption rule: ${describeRule(RULE, { firstStage: CONFIRM, nominees: DEPTH.nominees })}`);
  checkBudget('optimizer', ESTIMATE, V.budget, V.force);
  const cands: Cand[] = [{ label: '(unchanged)', deck: base.deck }, ...candidates(base.deck)];
  console.log(`Stage 1: ${cands.length} candidates × ${SCREEN} games`);
  const s1 = await measure(cands, SCREEN, SCREEN_SEED);
  const baseS1 = s1[0];
  let ranked = cands.map((c, i) => ({ c, wr: avg(s1[i]), iv: pairedInterval(s1[i], baseS1) })).sort((a, b) => b.wr - a.wr);
  // depth: combine the best screened single changes (those above the unmodified deck)
  const baseWr1 = avg(baseS1);
  const seen = new Set(cands.map((c) => listKeyOf(c.deck)));
  // card swaps and Legend swaps combine with each other (both change one card); package moves with package moves
  const above = (pkg: boolean) => ranked.filter((r) => r.c !== cands[0] && !!r.c.pkg === pkg && r.wr > baseWr1).map((r) => r.c);
  const make = (parts: Cand[], deck: Cand['deck']): Cand => ({ label: parts.map((p) => p.label).join(' + '), deck, combo: { parts: parts.map((p) => p.label), packages: parts.some((p) => !!p.pkg) } });
  const combos: Cand[] = [
    ...(DEPTH.cardsPerChange > 1 ? combinedCandidates(base.deck, above(false), { maxParts: DEPTH.cardsPerChange, from: DEPTH.combineFrom, plan: PLAN, seen }, make) : []),
    ...(DEPTH.packagesPerChange > 1 ? combinedCandidates(base.deck, above(true), { maxParts: DEPTH.packagesPerChange, from: DEPTH.combineFrom, plan: PLAN, seen }, make) : []),
  ];
  if (combos.length) {
    console.log(`Stage 1b: ${combos.length} combined candidates × ${SCREEN} games`);
    const sc = await measure(combos, SCREEN, SCREEN_SEED);
    ranked = [...ranked, ...combos.map((c, i) => ({ c, wr: avg(sc[i]), iv: pairedInterval(sc[i], baseS1) }))].sort((a, b) => b.wr - a.wr);
  }
  const allCands = [...cands, ...combos];
  // nominees: the stage-1 leaders (legacy: the top 6 whatever they scored; evidence: only those above the unmodified deck)
  const nominees = ranked.filter((r) => r.c !== cands[0] && (LEGACY || r.wr > baseWr1)).slice(0, LEGACY ? 6 : DEPTH.nominees);
  let confirmations: Confirmation[] = [];
  let baseWr = baseWr1;
  let best = -1;
  if (LEGACY) {
    // the old stage 2: top 6 + baseline × CONFIRM on identical seeds, best list = best stage-2 win rate
    console.log(`Stage 2: confirming top ${nominees.length} + baseline × ${CONFIRM} games`);
    const s2 = await measure([cands[0], ...nominees.map((n) => n.c)], CONFIRM, CONFIRM_SEED);
    confirmations = nominees.map((_, i) => {
      const iv = pairedInterval(s2[i + 1], s2[0]);
      return { outcome: iv.mean > 0 ? 'adopt' : 'reject', heldOut: iv, baseWr: avg(s2[0]), candWr: avg(s2[i + 1]), looks: 1, minGainPp: 0 };
    });
    baseWr = avg(s2[0]);
    best = confirmations.reduce((b, c, i) => (c.candWr > (confirmations[b]?.candWr ?? baseWr) ? i : b), -1);
  } else if (nominees.length) {
    console.log(`Stage 2: confirming ${nominees.length} nominee(s) on fresh paired games, stages of ${CONFIRM} up to ${CONFIRM * STAGES}`);
    const conf = await confirmStaged(
      RULE,
      nominees.map((n) => ({ minGainPp: n.c.pkg || n.c.combo?.packages ? RULE.packageMinGainPp : RULE.minGainPp })),
      CONFIRM,
      async ({ offset, games, active }) => {
        const [b, ...ns] = await measure([cands[0], ...active.map((i) => nominees[i].c)], games, CONFIRM_SEED + offset);
        return { base: b, nominees: ns };
      },
    );
    confirmations = conf.results;
    baseWr = confirmations[0]?.baseWr ?? baseWr1;
    best = pickAdopted(confirmations);
  }
  const bestDeck = best >= 0 ? nominees[best].c.deck : base.deck;
  const rule = describeRule(RULE, { firstStage: CONFIRM, nominees: nominees.length || DEPTH.nominees });
  const md = [
    `# Optimizer — ${base.deck.name}`,
    '',
    `Field: ${field.map((f) => f.deck.name).join(', ')}. Bot: ${BOT}. Stage 1 ${SCREEN} games/candidate (shared seeds; it only nominates), stage 2 from ${CONFIRM} fresh games per stage (the same seeds for the unmodified deck and every nominee).`,
    '',
    `Adoption rule: ${rule}.`,
    '',
    `Baseline win rate (stage 2): **${(baseWr * 100).toFixed(1)}%**`,
    '',
    ...(PACKAGES
      ? [`Packages: ${describePlan(PLAN)}${V['package-moves'] ? `; package moves on` : ''}. Best list vs the original (built around): ${describeChanges(packageChanges(base.deck, bestDeck))}.`, '']
      : []),
    ...(PARTNER ? ['Cut ranking: partner-aware (each cut adds its package stranding cost, each add its assembly-odds credit; no partner split without telemetry).', ''] : []),
    best >= 0
      ? `**Best list: ${nominees[best].c.label}**, held-out paired gain ${formatGain(confirmations[best].heldOut)}.`
      : nominees.length
        ? `**No change cleared the bar: the list is kept.**`
        : `**No candidate screened above the unmodified deck: the list is kept.**`,
    '',
    '| Change | Stage 1 | Screening gain | Stage 2 | Held-out paired gain | Outcome |',
    '|---|---|---|---|---|---|',
    ...nominees.map((n, i) => {
      const c = confirmations[i];
      return `| ${n.c.label} | ${(n.wr * 100).toFixed(1)}% | ${pts(n.iv.mean)} | ${c ? `${(c.candWr * 100).toFixed(1)}%` : '—'} | ${c ? formatGain(c.heldOut) : '—'} | ${c ? (LEGACY ? (i === best ? 'best' : '—') : confirmationWord(c, RULE.futilityMaxGainPp)) : '—'} |`;
    }),
    '',
    '## Stage 1 (all candidates)',
    '',
    ...ranked.map((r) => `- ${(r.wr * 100).toFixed(1)}% (${r.c === cands[0] ? 'baseline' : `${pts(r.iv.mean)} paired, 95% [${pts(r.iv.lower)}, ${pts(r.iv.upper)}]`}) — ${r.c.label}`),
    '',
    LEGACY ? 'Standard error at 280 games ≈ ±3%; treat gains under ~4 points as noise unless they repeat.' : 'Screening numbers are on shared seeds and only nominate; the held-out paired gain is the figure to trust.',
    '',
    '## Best list',
    '',
    '```',
    exportOfficial({ ...bestDeck, name: `${base.deck.name} (optimized)` }),
    '```',
  ].join('\n');
  const dir = OUT || 'reports';
  fs.mkdirSync(dir, { recursive: true });
  const slug = base.file.replace(/\.txt$/, '') + (VS ? `-vs-${field[0].file.replace(/\.txt$/, '')}` : '');
  fs.writeFileSync(OUT ? path.join(dir, `optimize-${slug}-latest.md`) : `reports/optimize-${slug}-latest.md`, md);
  // machine-readable twin of the stage-2 table (percent / points, 1 decimal, as printed)
  const p1 = (x: number) => +(x * 100).toFixed(1);
  const json = {
    deck: base.deck.name,
    file: base.file,
    vs: VS ? field[0].deck.name : 'meta field',
    vsFile: VS ? field[0].file : undefined,
    date: new Date().toISOString().slice(0, 10),
    bot: BOT,
    screen: SCREEN,
    confirm: CONFIRM,
    baseline: p1(baseWr),
    rows: nominees.map((n, i) => {
      const c = confirmations[i];
      const kind = n.c.combo ? `combo-${n.c.combo.packages ? 'packages' : 'cards'}` : n.c.pkg?.kind;
      return { change: n.c.label, s1: p1(n.wr), s2: c ? p1(c.candWr) : null, delta: c ? p1(c.heldOut.mean) : p1(n.iv.mean), ...(c && !LEGACY ? { outcome: c.outcome } : {}), ...(c?.stopped ? { stopped: c.stopped, heldOutGames: c.heldOut.games } : {}), ...(kind ? { package: kind } : {}) };
    }),
    nominees: nominees.map((n, i) => nomineeRecord(n.c.label, n.iv, confirmations[i], n.c.combo ? `combo-${n.c.combo.packages ? 'packages' : 'cards'}` : n.c.pkg?.kind)),
    best: best >= 0 ? { change: nominees[best].c.label, heldOut: confirmations[best].heldOut } : null,
    adoption: { text: rule },
    ...(PACKAGES ? { packages: { plan: PLAN, moves: V['package-moves'], best: packageChanges(base.deck, bestDeck) } } : {}),
    // stage 1 plays seeds from 424242, stage 2 from 777777 (the same seeds for every candidate), further stages after it
    manifest: gameRunManifest({
      purpose: 'optimize',
      decks: [base, ...field],
      fieldMode: VS ? `vs:${field[0].file}${SIDEBOARD ? ':sideboard' : ''}` : 'meta',
      fieldDeckIds: field.map((f) => manifestDeck(f).id),
      bot: BOT,
      seedBase: SCREEN_SEED,
      seatPolicy: 'alternate',
      plannedGames: ESTIMATE.max,
      gamesPerPair: null,
      simVersion: SIM_VERSION,
      createdAt: startedAt,
      ...(PACKAGES ? { packages: packageProvenance(PLAN, { moves: allCands.filter((c) => c.pkg || c.combo?.packages).map((c) => c.label) }) } : {}),
      adoption: adoptionProvenance(RULE, { firstStage: CONFIRM, nominees: LEGACY ? 6 : DEPTH.nominees, cardsPerChange: DEPTH.cardsPerChange, packagesPerChange: DEPTH.packagesPerChange }),
    }),
  };
  fs.writeFileSync(OUT ? path.join(dir, `optimize-${slug}-latest.json`) : `reports/optimize-${slug}-latest.json`, JSON.stringify(json, null, 1));
  console.log('\n' + md.split('## Stage 1')[0]);
}
runMain(main);
