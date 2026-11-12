// Deck forge: telemetry-guided, multi-generation deck iteration against the meta field.
//
//   npx tsx scripts/forge.ts <deck...> [--gens 2] [--games 140] [--cands 6] [--bot lookahead] [--field meta|all] [--seed 1] [--threads N]
//   npx tsx scripts/forge.ts --nc          # all data/decks/custom/nc-*.txt
//   --out DIR   write the forged list and the reports to DIR (DIR/<file>, DIR/forge/) instead of the repository
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
//
// Each generation:
//   1. Baseline: deck vs field with telemetry → win rate + per-card "Δ when drawn" (IWD).
//   2. Cuts: the deck's lowest-IWD cards. Adds: +1 of its best card, and the format's highest-impact legal cards
//      (from src/data/analysis.json, averaged across decks).
//   3. Test each cut→add swap on the SAME seeds as the baseline (paired comparison).
//   4. Confirm the best swap on fresh seeds; adopt only if it still beats the baseline.
//   5. Save the new version (data/decks/custom/<slug>.txt), archive the old one (history/), log reports/forge/<slug>.md
//      (plus reports/forge/<slug>.json, which scripts/bundle-reports.ts reads).
// Seeds come from --seed, so a run can be repeated exactly.
import fs from 'node:fs';
import path from 'node:path';
import { exportOfficial } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { analyzeDeck, type DeckReport } from '../src/analysis/analyze';
import analysis from '../src/data/analysis.json';
import { IMPACT_MIN_POOLED_GAMES } from '../src/analysis/impactData';
import { bool, cli, int, loadLibrary, oneOf, resolveDeck, runJobs, runMain, SIM_BOTS, str, threadsOpt } from './lib-node';
import { gameRunManifest, manifestDeck, type RunManifest } from '../src/lib/runManifest';
import { SIM_VERSION } from '../src/lib/tournament';
import type { MatchJob } from './worker';
import { forgeScore, forgeSwaps, packageCandidates, type Mutation } from './builder-moves';
import { exitOnPlanProblems, objectivePackages, packagesOn, planFromFlags, tunerPackageFlags } from './package-flags';
import { checkChange, describeChanges, describePlan, packageChanges, packageProvenance, type PackageChanges, type PackagePlan } from '../src/lib/deckPackages';

const { values: V, positionals } = cli(
  import.meta.url,
  { gens: int(2, { min: 1 }), games: int(140, { min: 1 }), cands: int(6, { min: 1 }), bot: oneOf(SIM_BOTS, 'lookahead'), field: oneOf(['meta', 'all'], 'meta'), nc: bool(), seed: int(1, { min: 0 }), threads: threadsOpt(), out: str(), ...tunerPackageFlags() },
  { maxPositionals: Infinity },
);
const GENS = V.gens;
const GAMES = V.games;
const CANDS = V.cands;
const BOT = V.bot;
const FIELD = V.field;
const THREADS = Math.min(V.threads, 16);
/** where the forged list and reports go: the repository (default) or --out DIR */
const OUT = V.out;
const PACKAGES = packagesOn(V);
const lib = loadLibrary();
const field = lib.filter((d) => (FIELD === 'all' ? d.kind !== 'custom' : d.kind === 'meta'));

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

/** games played so far in this process (each forged deck's manifest counts its own) */
let gamesPlayed = 0;

async function play(deck: DeckList, seed0: number, games: number, trace: boolean) {
  const jobs: MatchJob[] = [];
  let seed = seed0;
  for (let k = 0; k < games; k++) {
    const opp = field[k % field.length];
    jobs.push({ a: deck, b: opp.deck, seed: seed++, first: (Math.floor(k / field.length) % 2) as 0 | 1, bot: BOT, trace });
  }
  const res = await runJobs(jobs, { threads: THREADS });
  gamesPlayed += res.length;
  const wr = res.reduce((a, r) => a + (r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0), 0) / res.length;
  const sums = trace ? res.map((r) => r.summaries![0]) : [];
  return { wr, sums };
}

/** The list's plan: the flags, with the deck objective's packages as the default keep (only when package flags are on). */
function planFor(target: (typeof lib)[number]): PackagePlan {
  const plan = planFromFlags(V, objectivePackages(target.file));
  exitOnPlanProblems(plan);
  return plan;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

async function forge(target: (typeof lib)[number]) {
  let deck: DeckList = structuredClone(target.deck);
  const plan = planFor(target);
  const slug = target.file.replace(/\.txt$/, '');
  const log: string[] = [`# Forge log — ${deck.name}`, '', `Field: ${field.map((f) => f.deck.name).join(', ')} · bot ${BOT} · ${GAMES} games per test`, ''];
  if (PACKAGES) log.push(`Packages: ${describePlan(plan)}${V['package-moves'] ? `; package moves on (${V['package-cands']} per generation)` : '; package moves off'}.`, '');
  /** package moves tried (labels), for the report and the manifest */
  const tried: string[] = [];
  const history: { gen: number; wr: number; change: string }[] = [];
  // machine-readable twin of the log, for scripts/bundle-reports.ts (percentages and points, 1 decimal, as in the log)
  const p1 = (x: number) => +(x * 100).toFixed(1);
  const startedAt = new Date().toISOString();
  const playedBefore = gamesPlayed;
  const json: {
    deck: string;
    file: string;
    date: string;
    seed: number;
    field: string;
    gens: { gen: number; baseline: number; swaps: { swap: string; wr: number; delta: number; package?: string }[]; confirm?: string; verdict: 'adopted' | 'rejected' | 'kept' }[];
    summary: { gen: number; wr: number; change: string }[];
    /** with package flags only: the plan, and the built-around packages kept, added and removed from start to end */
    packages?: { plan: PackagePlan; moves: boolean; changes: PackageChanges; adopted: string[] };
    manifest?: RunManifest;
  } = {
    deck: deck.name,
    file: target.file,
    date: new Date().toISOString().slice(0, 10),
    seed: V.seed,
    field: `${field.map((f) => f.deck.name).join(', ')} · bot ${BOT} · ${GAMES} games per test`,
    gens: [],
    summary: [],
  };
  for (let gen = 1; gen <= GENS; gen++) {
    const seed0 = 100_000 * gen + nextSeedOffset();
    const base = await play(deck, seed0, GAMES, true);
    const rep = analyzeDeck(deck.name, base.sums);
    console.log(`\n[${deck.name}] gen ${gen}: baseline ${pct(base.wr)}`);
    log.push(`## Generation ${gen} — baseline ${pct(base.wr)}`, '', ...rep.insights.slice(0, 4).map((s) => `- ${s}`), '');
    const muts: Mutation[] = forgeSwaps(deck, rep, GLOBAL_IMPACT, CANDS, plan);
    if (PACKAGES) {
      // what the plan changed: the swaps the forge would have tried without it, and why each was not played
      const free = forgeSwaps(deck, rep, GLOBAL_IMPACT, CANDS);
      const dropped = free.filter((m) => !muts.some((x) => x.label === m.label));
      if (dropped.length) {
        log.push(`The package plan kept ${dropped.length} swap${dropped.length === 1 ? '' : 's'} from being played:`, ...dropped.map((m) => `- ${m.label}: ${checkChange(deck, m.deck, plan).map((v) => v.text).join('; ') || 'replaced by a better allowed swap'}`), '');
        console.log(`  plan: ${dropped.length} swap(s) not played (${dropped.map((m) => m.label).join('; ')})`);
      }
      muts.push(...packageCandidates(deck, plan, { moves: V['package-moves'], n: V['package-cands'], score: forgeScore(rep, GLOBAL_IMPACT) }));
    }
    tried.push(...muts.filter((m) => m.pkg).map((m) => m.label));
    const results: { m: Mutation; wr: number }[] = [];
    for (const m of muts) {
      const r = await play(m.deck, seed0, GAMES, false);
      results.push({ m, wr: r.wr });
      console.log(`  ${pct(r.wr)} (${((r.wr - base.wr) * 100).toFixed(1)})  ${m.label}`);
    }
    results.sort((a, b) => b.wr - a.wr);
    log.push('| Swap | Win % | Δ vs baseline |', '|---|---|---|', ...results.map((r) => `| ${r.m.label} | ${pct(r.wr)} | ${((r.wr - base.wr) * 100).toFixed(1)} |`), '');
    const genRec: (typeof json.gens)[number] = {
      gen,
      baseline: p1(base.wr),
      swaps: results.slice(0, PACKAGES ? results.length : 5).map((r) => ({ swap: r.m.label, wr: p1(r.wr), delta: p1(r.wr - base.wr), ...(r.m.pkg ? { package: r.m.pkg.kind } : {}) })),
      verdict: 'kept',
    };
    json.gens.push(genRec);
    const best = results[0];
    if (!best || best.wr - base.wr < 0.02) {
      log.push(`No swap beat the baseline by 2+ points — **list kept**.`, '');
      history.push({ gen, wr: base.wr, change: 'kept' });
      continue;
    }
    // confirm on fresh seeds, bigger sample
    const seed1 = seed0 + 50_000;
    const [cb, cm] = [await play(deck, seed1, GAMES * 2, false), await play(best.m.deck, seed1, GAMES * 2, false)];
    const ok = cm.wr > cb.wr;
    log.push(`Confirmation (${GAMES * 2} fresh games): baseline ${pct(cb.wr)} vs swap ${pct(cm.wr)} → **${ok ? 'adopted' : 'rejected'}**`, '');
    genRec.confirm = `(${GAMES * 2} fresh games): baseline ${pct(cb.wr)} vs swap ${pct(cm.wr)}`;
    genRec.verdict = ok ? 'adopted' : 'rejected';
    console.log(`  confirm: ${pct(cb.wr)} → ${pct(cm.wr)} ${ok ? 'ADOPT' : 'reject'}`);
    if (ok) {
      deck = best.m.deck;
      history.push({ gen, wr: cm.wr, change: best.m.label });
    } else history.push({ gen, wr: cb.wr, change: 'kept (swap failed confirmation)' });
  }
  // save
  const changed = history.some((h) => !h.change.startsWith('kept'));
  const pkgChanges = packageChanges(target.deck, deck);
  const adoptedPkg = history.filter((h) => !h.change.startsWith('kept') && tried.includes(h.change)).map((h) => h.change);
  const pkgLine = PACKAGES ? `\n// Packages: ${describePlan(plan)}; ${describeChanges(pkgChanges)}${adoptedPkg.length ? `; package moves adopted: ${adoptedPkg.join('; ')}` : ''}` : '';
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
      `${exportOfficial(inPlace ? deck : { ...deck, name: `${deck.name} (forged)` })}\n\n${idea}\n// Forged ${new Date().toISOString().slice(0, 10)}: ${history.filter((h) => !h.change.startsWith('kept')).map((h) => h.change).join('; ')}${pkgLine}\n`,
    );
    log.push(OUT ? `Saved ${outFile} (--out: the library was not changed).` : `Saved ${outFile} (previous version archived in data/decks/custom/history/).`);
  }
  if (PACKAGES) {
    log.push('', `Packages (built around, start → end): ${describeChanges(pkgChanges)}.${adoptedPkg.length ? ` Package moves adopted: ${adoptedPkg.join('; ')}.` : ''}`);
    json.packages = { plan, moves: V['package-moves'], changes: pkgChanges, adopted: adoptedPkg };
  }
  log.push('', '## Summary', '', '| Gen | Win % | Change |', '|---|---|---|', ...history.map((h) => `| ${h.gen} | ${pct(h.wr)} | ${h.change} |`));
  json.summary = history.map((h) => ({ gen: h.gen, wr: p1(h.wr), change: h.change }));
  // planned = every generation testing every candidate and confirming; generations that keep the list skip the confirmation
  json.manifest = gameRunManifest({
    purpose: 'forge',
    decks: [target, ...field],
    fieldMode: FIELD,
    fieldDeckIds: field.map((f) => manifestDeck(f).id),
    bot: BOT,
    seedBase: V.seed,
    seatPolicy: 'alternate',
    plannedGames: GENS * GAMES * (1 + CANDS + 4),
    completedGames: gamesPlayed - playedBefore,
    gamesPerPair: null,
    trace: true,
    simVersion: SIM_VERSION,
    createdAt: startedAt,
    ...(PACKAGES ? { packages: packageProvenance(plan, { moves: tried }) } : {}),
  });
  const reportDir = OUT ? path.join(OUT, 'forge') : 'reports/forge';
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, `${slug}.md`), log.join('\n'));
  fs.writeFileSync(path.join(reportDir, `${slug}.json`), JSON.stringify(json, null, 1));
  return { name: deck.name, history };
}

async function main() {
  console.log(`Forging ${targets.length} deck(s) × ${GENS} generations vs ${field.length} field decks`);
  const all = [];
  for (const t of targets) all.push(await forge(t));
  const md = [
    '# Forge summary',
    '',
    '| Deck | Start | End | Changes |',
    '|---|---|---|---|',
    ...all.map((a) => `| ${a.name} | ${pct(a.history[0]?.wr ?? 0)} | ${pct(a.history[a.history.length - 1]?.wr ?? 0)} | ${a.history.filter((h) => !h.change.startsWith('kept')).map((h) => h.change).join('; ') || '—'} |`),
  ].join('\n');
  fs.writeFileSync(OUT ? path.join(OUT, 'forge', 'summary.md') : 'reports/forge/summary.md', md);
  console.log('\n' + md);
}
runMain(main);
