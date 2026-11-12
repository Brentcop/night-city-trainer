// Package scoring, measured (docs/ROADMAP2.md §1 step 4, docs/BOT_TOOLKIT.md §3): every library deck built around a
// synergy package plays every meta deck with the package weights on (seat A), and the same games with them off. Same
// seeds, seats, play/draw and opponents (the opponent is the same bot with the weights off), so the per-game difference
// is paired. Writes nothing outside --out; never applies anything.
//   npx tsx scripts/package-scoring.ts --out DIR [--configs "hold:pkgHold=4;steer:pkgSteer=6"] [--bot hard]
//        [--phase train|heldout] [--per 2] [--seed-base N] [--shadow-games 0] [--decks all|<file,file>] [--threads N]
// --configs   name:weight=value,... separated by ';' (weights: pkgHold, pkgAssembly, pkgSteer, pkgProtect)
// --phase     picks the default seed base: train 3,000,000, heldout 3,500,000 (disjoint)
// --per       games per (deck, meta opponent), play/draw alternating
// --shadow-games  for this many games per config (spread over the decks), also ask the weights-off bot at every one
//             of seat A's decisions and count where it would have chosen otherwise (by decision kind/tag)
// Every run also counts seat A's sells and give-ups of package pieces whose partner it could still get, off vs on.
// Report: paired gain with a 95% interval overall, per package family, per package and per deck, and the apply gate
// (held-out lower bound above +1 point; no deck with 300+ games below −1 point at its upper bound).
import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_WEIGHTS } from '../src/ai/eval';
import { packagesForList } from '../src/ai/packages';
import { summarizePaired, type PairedSummary } from '../src/lib/evidence';
import { SIM_VERSION } from '../src/lib/tournament';
import { bool, cli, int, loadLibrary, oneOf, runJobs, runMain, str, threadsOpt } from './lib-node';
import type { AgentSpec, MatchJob, MatchResult, PieceCounts } from './worker';

const { values: V } = cli(import.meta.url, {
  out: str(),
  configs: str('hold:pkgHold=4;assembly:pkgAssembly=6;steer:pkgSteer=6;protect:pkgProtect=3'),
  bot: oneOf(['hard', 'deep'], 'hard'),
  phase: oneOf(['train', 'heldout'], 'train'),
  per: int(2, { min: 1, max: 200 }),
  'seed-base': int(undefined, { min: 0 }),
  'shadow-games': int(0, { min: 0 }),
  decks: str('all'),
  threads: threadsOpt(),
  'no-baseline-pieces': bool(),
});

if (!V.out) {
  console.error('error: --out DIR is required (trial output never goes to the repository).\nRun with --help for usage.');
  process.exit(2);
}

type Weights = Partial<Record<(typeof PACKAGE_WEIGHTS)[number], number>>;
function parseConfigs(s: string): { name: string; weights: Weights }[] {
  return s
    .split(';')
    .filter(Boolean)
    .map((part) => {
      const [name, body] = part.split(':');
      if (!name || !body) throw new Error(`bad config "${part}" (name:weight=value,...)`);
      const weights: Weights = {};
      for (const kv of body.split(',')) {
        const [k, v] = kv.split('=');
        if (!(PACKAGE_WEIGHTS as readonly string[]).includes(k)) throw new Error(`unknown weight "${k}" (${PACKAGE_WEIGHTS.join(', ')})`);
        if (!Number.isFinite(Number(v))) throw new Error(`bad value for ${k}: "${v}"`);
        weights[k as keyof Weights] = Number(v);
      }
      return { name, weights };
    });
}
let CONFIGS: { name: string; weights: Weights }[];
try {
  CONFIGS = parseConfigs(V.configs);
} catch (e) {
  console.error(`error: ${(e as Error).message}\nRun with --help for usage.`);
  process.exit(2);
}

const SEED_BASE = V['seed-base'] ?? (V.phase === 'train' ? 3_000_000 : 3_500_000);
const lib = loadLibrary();
const metas = lib.filter((d) => d.kind === 'meta');
const wanted = V.decks === 'all' ? null : new Set(V.decks.split(','));
const field = lib.filter((d) => (wanted ? wanted.has(d.file) || wanted.has(d.file.replace(/\.txt$/, '')) : true)).filter((d) => packagesForList(d.deck).length > 0);
if (!field.length) {
  console.error('error: no library deck matches --decks and is built around a package.');
  process.exit(2);
}

/** The tier's settings as a worker spec (the same bot makeTierBot builds). */
const tierSpec = (): AgentSpec =>
  V.bot === 'hard' ? { noise: 0.15, deep: 3, impact: 40, deepAttacks: 0, deepReactions: 3, profiles: 'best' } : { noise: 0.15, deep: 3, profiles: 'best' };

interface JobMeta {
  deck: string;
  opp: string;
  packages: string[];
  families: string[];
}
const metaOf: JobMeta[] = [];
const baseJobs: MatchJob[] = [];
{
  let seed = SEED_BASE;
  for (const d of field) {
    const pkgs = packagesForList(d.deck);
    for (const o of metas)
      for (let k = 0; k < V.per; k++) {
        baseJobs.push({ a: d.deck, b: o.deck, seed: seed++, first: (k % 2) as 0 | 1, bot: V.bot, agentA: tierSpec(), agentB: tierSpec() });
        metaOf.push({ deck: d.file, opp: o.file, packages: pkgs.map((p) => p.id), families: [...new Set(pkgs.map((p) => p.family))] });
      }
  }
}

const score = (r: MatchResult): number => (r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0);
const pp = (x: number) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)}`;
const fmt = (s: PairedSummary) => `${pp(s.mean)} [${pp(s.lower95)}, ${pp(s.upper95)}] (n=${s.games})`;

function addPieces(a: PieceCounts, b: PieceCounts | undefined) {
  if (!b) return;
  for (const k of Object.keys(a) as (keyof PieceCounts)[]) a[k] += b[k];
}
const zeroPieces = (): PieceCounts => ({ sells: 0, sellsWithPieceOption: 0, pieceSells: 0, giveUps: 0, giveUpsWithPieceOption: 0, pieceGiveUps: 0 });

function groupSummaries(cand: number[], base: number[], key: (m: JobMeta) => string[]) {
  const groups = new Map<string, { c: number[]; b: number[] }>();
  metaOf.forEach((m, i) => {
    for (const k of key(m)) {
      const g = groups.get(k) ?? { c: [], b: [] };
      g.c.push(cand[i]);
      g.b.push(base[i]);
      groups.set(k, g);
    }
  });
  return Object.fromEntries([...groups].sort((a, b) => a[0].localeCompare(b[0])).map(([k, g]) => [k, g.c.length >= 2 ? summarizePaired(g.c, g.b) : null]));
}

async function main() {
  fs.mkdirSync(V.out!, { recursive: true });
  const t0 = Date.now();
  console.log(`${field.length} decks × ${metas.length} meta opponents × ${V.per} = ${baseJobs.length} games per config; bot ${V.bot}; seeds from ${SEED_BASE}; SIM_VERSION ${SIM_VERSION}.`);
  const baseline = await runJobs(
    baseJobs.map((j) => ({ ...j, piecesA: !V['no-baseline-pieces'] })),
    { threads: V.threads },
  );
  const baseScores = baseline.map(score);
  const basePieces = zeroPieces();
  for (const r of baseline) addPieces(basePieces, r.pieces);
  console.log(`baseline: ${(100 * (baseScores.reduce((a, x) => a + x, 0) / baseScores.length)).toFixed(1)}% (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  const stride = V['shadow-games'] > 0 ? Math.max(1, Math.floor(baseJobs.length / V['shadow-games'])) : 0;
  const out: Record<string, unknown>[] = [];
  for (const cfg of CONFIGS) {
    const t1 = Date.now();
    const jobs = baseJobs.map((j, i) => ({
      ...j,
      agentA: { ...tierSpec(), weights: cfg.weights as Record<string, number> },
      piecesA: true,
      ...(stride && i % stride === 0 && i / stride < V['shadow-games'] ? { shadowA: tierSpec() } : {}),
    }));
    const res = await runJobs(jobs, { threads: V.threads });
    const cand = res.map(score);
    const overall = summarizePaired(cand, baseScores);
    const diverged = res.filter((r, i) => r.winner !== baseline[i].winner || r.turns !== baseline[i].turns || r.gigs.join() !== baseline[i].gigs.join()).length;
    const shadow: Record<string, [number, number]> = {};
    let shadowGames = 0;
    for (const r of res) {
      if (!r.shadow) continue;
      shadowGames++;
      for (const [k, [n, d]] of Object.entries(r.shadow)) {
        const c = (shadow[k] ??= [0, 0]);
        c[0] += n;
        c[1] += d;
      }
    }
    const pieces = zeroPieces();
    for (const r of res) addPieces(pieces, r.pieces);
    const perDeck = groupSummaries(cand, baseScores, (m) => [m.deck]);
    const perFamily = groupSummaries(cand, baseScores, (m) => m.families);
    const perPackage = groupSummaries(cand, baseScores, (m) => m.packages);
    const harmed = Object.entries(perDeck).filter(([, s]) => s && s.games >= 300 && s.upper95 < -0.01);
    const gate = { overallLowerAbove1pp: overall.lower95 > 0.01, decksHarmed: harmed.map(([d]) => d), passes: overall.lower95 > 0.01 && harmed.length === 0 };
    const changed = Object.values(shadow).reduce((a, [, d]) => a + d, 0);
    const asked = Object.values(shadow).reduce((a, [n]) => a + n, 0);
    console.log(`\n${cfg.name} ${JSON.stringify(cfg.weights)}: ${fmt(overall)}; games that changed ${diverged}/${res.length}; ${((Date.now() - t1) / 1000).toFixed(0)} s`);
    if (shadowGames) {
      console.log(`  decisions changed (${shadowGames} shadowed games): ${changed} of ${asked}`);
      for (const [k, [n, d]] of Object.entries(shadow).sort((a, b) => b[1][1] - a[1][1]).filter(([, [, d]]) => d > 0)) console.log(`    ${k.padEnd(24)} ${d} of ${n}`);
    }
    console.log(`  piece sells (partner obtainable): off ${basePieces.pieceSells}/${basePieces.sells} sells, on ${pieces.pieceSells}/${pieces.sells}; give-ups off ${basePieces.pieceGiveUps}/${basePieces.giveUps}, on ${pieces.pieceGiveUps}/${pieces.giveUps}`);
    for (const [f, s] of Object.entries(perFamily)) if (s) console.log(`  family ${f.padEnd(12)} ${fmt(s)}`);
    console.log(`  gate: ${gate.passes ? 'PASSES' : 'does not pass'} (overall lower ${pp(overall.lower95)}; decks with 300+ games harmed: ${gate.decksHarmed.length})`);
    out.push({ name: cfg.name, weights: cfg.weights, overall, diverged, games: res.length, shadowGames, shadow, pieces, perFamily, perPackage, perDeck, gate });
  }
  const file = path.join(V.out!, `package-scoring-${V.phase}-${V.bot}-${SEED_BASE}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ simVersion: SIM_VERSION, bot: V.bot, phase: V.phase, seedBase: SEED_BASE, per: V.per, decks: field.map((d) => d.file), opponents: metas.map((d) => d.file), baseline: { score: baseScores.reduce((a, x) => a + x, 0) / baseScores.length, pieces: basePieces }, configs: out, seconds: (Date.now() - t0) / 1000 }, null, 1),
  );
  console.log(`\nSaved ${file} (${((Date.now() - t0) / 1000).toFixed(0)} s in all)`);
}
runMain(main);
