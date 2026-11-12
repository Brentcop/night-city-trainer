// Deck optimizer: hill-climb single-card swaps (and legend swaps) against the meta field.
//   npx tsx scripts/optimize.ts <deck> [--screen 70] [--confirm 280] [--candidates 40] [--bot lookahead] [--threads N]
//   npx tsx scripts/optimize.ts <deck> --vs <opponent> --sideboard     (Bo3 plan: only swaps using the deck's 7-card sideboard)
//   --out DIR   write the reports to DIR instead of reports/
// Synergy packages (opt-in, as in scripts/forge.ts; docs/SYNERGIES.md): --keep-packages a,b (default with any package
// flag: the deck objective's packages; "none" keeps nothing), --require-packages a,b, --avoid-packages a,b,
// --lock-cards id[:n],..., --package-moves (adds --package-cands N whole-package moves, default 3, to the candidates).
// Stage 1 screens many candidate swaps with a small sample; stage 2 re-tests the best few (and the
// unmodified deck) with a large sample on identical seeds. Writes reports/optimize-<deck>[-vs-<opp>]-latest.md
// and a .json twin (read by scripts/bundle-reports.ts).
import fs from 'node:fs';
import path from 'node:path';
import { exportOfficial } from '../src/engine/deck';
import { cardValue } from '../src/ai/knowledge';
import { bool, cli, int, loadLibrary, oneOf, resolveDeck, runJobs, runMain, SIM_BOTS, str, threadsOpt } from './lib-node';
import { optimizeCandidates, packageCandidates, type Cand } from './builder-moves';
import { exitOnPlanProblems, objectivePackages, packagesOn, planFromFlags, tunerPackageFlags } from './package-flags';
import { describeChanges, describePlan, packageChanges, packageProvenance } from '../src/lib/deckPackages';
import { gameRunManifest, manifestDeck } from '../src/lib/runManifest';
import { SIM_VERSION } from '../src/lib/tournament';
import type { MatchJob } from './worker';

const { values: V, positionals } = cli(
  import.meta.url,
  { screen: int(70, { min: 1 }), confirm: int(280, { min: 1 }), candidates: int(40, { min: 1 }), bot: oneOf(SIM_BOTS, 'lookahead'), vs: str(''), sideboard: bool(), threads: threadsOpt(), out: str(), ...tunerPackageFlags() },
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
const field = VS ? [resolveDeck(VS)] : loadLibrary().filter((d) => d.kind === 'meta' && d.deck.name !== base.deck.name);
const OUT = V.out;
const PACKAGES = packagesOn(V);
const PLAN = planFromFlags(V, objectivePackages(base.file));
exitOnPlanProblems(PLAN);

function candidates(deck: (typeof base)['deck']): Cand[] {
  const out = optimizeCandidates(deck, SIDEBOARD, NCAND, PLAN);
  // package moves come after the shuffled swaps, so every one of them is screened
  if (PACKAGES && !SIDEBOARD) out.push(...packageCandidates(deck, PLAN, { moves: V['package-moves'], n: V['package-cands'], score: cardValue }));
  return out;
}

async function measure(cands: Cand[], gamesPerCand: number, seed0: number): Promise<number[]> {
  const jobs: (MatchJob & { ci: number })[] = [];
  cands.forEach((c, ci) => {
    let seed = seed0; // identical seeds for every candidate -> lower variance comparisons
    for (let k = 0; k < gamesPerCand; k++) {
      const opp = field[k % field.length];
      jobs.push({ a: { ...c.deck, name: `cand${ci}` }, b: opp.deck, seed: seed++, first: (Math.floor(k / field.length) % 2) as 0 | 1, bot: BOT, ci });
    }
  });
  const res = await runJobs(jobs, { threads: THREADS });
  const tot = cands.map(() => ({ w: 0, g: 0 }));
  for (const r of res) {
    const ci = +r.a.slice(4);
    tot[ci].g++;
    tot[ci].w += r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0;
  }
  return tot.map((t) => t.w / Math.max(1, t.g));
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`Optimizing ${base.deck.name} vs ${field.length} meta decks (bot=${BOT})`);
  if (PACKAGES) console.log(`Packages: ${describePlan(PLAN)}${V['package-moves'] ? `; package moves on (${V['package-cands']})` : ''}`);
  const cands = [{ label: '(unchanged)', deck: base.deck }, ...candidates(base.deck)];
  console.log(`Stage 1: ${cands.length} candidates × ${SCREEN} games`);
  const s1 = await measure(cands, SCREEN, 424242);
  const ranked = cands.map((c, i) => ({ c, wr: s1[i] })).sort((a, b) => b.wr - a.wr);
  const top = [{ c: cands[0], wr: s1[0] }, ...ranked.filter((r) => r.c !== cands[0]).slice(0, 6)];
  console.log(`Stage 2: confirming top ${top.length - 1} + baseline × ${CONFIRM} games`);
  const s2 = await measure(top.map((t) => t.c), CONFIRM, 777777);
  const final = top.map((t, i) => ({ ...t, wr2: s2[i] })).sort((a, b) => b.wr2 - a.wr2);
  const baseWr = final.find((f) => f.c === cands[0])!.wr2;
  const md = [
    `# Optimizer — ${base.deck.name}`,
    '',
    `Field: ${field.map((f) => f.deck.name).join(', ')}. Bot: ${BOT}. Stage 1 ${SCREEN} games/candidate, stage 2 ${CONFIRM} games (same seeds for all candidates).`,
    '',
    `Baseline win rate (stage 2): **${(baseWr * 100).toFixed(1)}%**`,
    '',
    ...(PACKAGES
      ? [`Packages: ${describePlan(PLAN)}${V['package-moves'] ? `; package moves on` : ''}. Best list vs the original (built around): ${describeChanges(packageChanges(base.deck, final[0].c.deck))}.`, '']
      : []),
    '| Change | Stage 1 | Stage 2 | Δ vs baseline |',
    '|---|---|---|---|',
    ...final.map((f) => `| ${f.c.label} | ${(f.wr * 100).toFixed(1)}% | ${(f.wr2 * 100).toFixed(1)}% | ${f.c === cands[0] ? '—' : ((f.wr2 - baseWr) * 100 >= 0 ? '+' : '') + ((f.wr2 - baseWr) * 100).toFixed(1)} |`),
    '',
    '## Stage 1 (all candidates)',
    '',
    ...ranked.map((r) => `- ${(r.wr * 100).toFixed(1)}% — ${r.c.label}`),
    '',
    'Standard error at 280 games ≈ ±3%; treat gains under ~4 points as noise unless they repeat.',
    '',
    '## Best list',
    '',
    '```',
    exportOfficial({ ...final[0].c.deck, name: `${base.deck.name} (optimized)` }),
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
    rows: final.filter((f) => f.c !== cands[0]).map((f) => ({ change: f.c.label, s1: p1(f.wr), s2: p1(f.wr2), delta: p1(f.wr2 - baseWr), ...(f.c.pkg ? { package: f.c.pkg.kind } : {}) })),
    ...(PACKAGES ? { packages: { plan: PLAN, moves: V['package-moves'], best: packageChanges(base.deck, final[0].c.deck) } } : {}),
    // stage 1 plays seeds from 424242, stage 2 from 777777 (the same seeds for every candidate)
    manifest: gameRunManifest({
      purpose: 'optimize',
      decks: [base, ...field],
      fieldMode: VS ? `vs:${field[0].file}${SIDEBOARD ? ':sideboard' : ''}` : 'meta',
      fieldDeckIds: field.map((f) => manifestDeck(f).id),
      bot: BOT,
      seedBase: 424242,
      seatPolicy: 'alternate',
      plannedGames: cands.length * SCREEN + top.length * CONFIRM,
      gamesPerPair: null,
      simVersion: SIM_VERSION,
      createdAt: startedAt,
      ...(PACKAGES ? { packages: packageProvenance(PLAN, { moves: cands.filter((c) => c.pkg).map((c) => c.label) }) } : {}),
    }),
  };
  fs.writeFileSync(OUT ? path.join(dir, `optimize-${slug}-latest.json`) : `reports/optimize-${slug}-latest.json`, JSON.stringify(json, null, 1));
  console.log('\n' + md.split('## Stage 1')[0]);
}
runMain(main);
