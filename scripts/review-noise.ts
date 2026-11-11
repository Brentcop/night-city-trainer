// Reviewer validation: how noisy is the oracle? Samples real decisions and scores every candidate twice with
// independent play-outs. If verdicts flip between the two runs, the thresholds (NOISE, BLUNDER) or the number of
// play-outs need to change.
//
//   npx tsx scripts/review-noise.ts [--samples 80] [--rollouts 4,8]
import fs from 'node:fs';
import { Game } from '../src/engine/engine';
import { HeuristicAgent } from '../src/ai/heuristic';
import { BEST_PROFILES } from '../src/ai/archetype';
import { BLUNDER, CAP, NOISE, makeWorlds, oracleValue } from '../src/ai/reviewer';
import { GIG_SWING } from '../src/ai/eval';
import type { Action, Agent, Decision } from '../src/engine/types';
import { cli, int, loadLibrary, runMain, str } from './lib-node';

const { values: V } = cli(import.meta.url, {
  samples: int(80, { min: 1 }),
  rollouts: str('4,8', (v) => (/^[1-9]\d*(,[1-9]\d*)*$/.test(v) ? undefined : `must be a comma list of whole numbers ≥ 1, got "${v}"`)),
});
const SAMPLES = V.samples;
const RS = V.rollouts.split(',').map(Number);
let st = 99;
const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
const mkRng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

interface Row {
  R: number;
  absDiff: number[];
  bestSame: number;
  n: number;
  regretDiff: number[];
  flips: number; // blunder in one run, accurate in the other
  verdictSame: number;
}
const rows: Row[] = RS.map((R) => ({ R, absDiff: [], bestSame: 0, n: 0, regretDiff: [], flips: 0, verdictSame: 0 }));
let samples = 0;
const verdict = (r: number) => (r <= NOISE ? 'ok' : r > BLUNDER ? 'blunder' : 'inacc');

class Sampler implements Agent {
  name = 'sampler';
  base = new HeuristicAgent({ profiles: BEST_PROFILES, seed: Math.floor(rnd() * 1e9), noise: 0.15 });
  async decide(g: Game, d: Decision): Promise<number[]> {
    const pick = await this.base.decide(g, d);
    if (d.kind === 'action' && d.options.length >= 3 && samples < SAMPLES && rnd() < 0.15) {
      samples++;
      const actions = d.options.map((o) => o.action as Action);
      const cand = new Set<number>([pick[0], ...this.base.lastAlternatives.slice(0, 4).map((x) => x.index)]);
      const pass = actions.findIndex((a) => a.type === 'pass');
      if (pass >= 0) cand.add(pass);
      for (const row of rows) {
        const A = new Map<number, number>();
        const B = new Map<number, number>();
        // two independent reviews; within each, every candidate shares the same worlds (as the reviewer does)
        const wa = makeWorlds(row.R, mkRng(samples * 1000 + row.R));
        const wb = makeWorlds(row.R, mkRng(samples * 1000 + row.R + 500));
        for (const i of cand) {
          A.set(i, await oracleValue(g, d.player, actions[i], wa));
          B.set(i, await oracleValue(g, d.player, actions[i], wb));
        }
        for (const i of cand) row.absDiff.push(Math.abs(A.get(i)! - B.get(i)!));
        const best = (m: Map<number, number>) => [...m.entries()].sort((x, y) => y[1] - x[1])[0][0];
        const regret = (m: Map<number, number>) => Math.min(CAP, Math.max(0, Math.max(...m.values()) - m.get(pick[0])!));
        row.n++;
        if (best(A) === best(B)) row.bestSame++;
        const rA = regret(A);
        const rB = regret(B);
        row.regretDiff.push(Math.abs(rA - rB));
        if (verdict(rA) === verdict(rB)) row.verdictSame++;
        if ((rA > BLUNDER && rB <= NOISE) || (rB > BLUNDER && rA <= NOISE)) row.flips++;
      }
      if (samples % 10 === 0) process.stderr.write(`  ${samples}/${SAMPLES}\n`);
    }
    return pick;
  }
}

async function main() {
  const meta = loadLibrary().filter((d) => d.kind === 'meta');
  let games = 0;
  while (samples < SAMPLES && games < 200) {
    const a = meta[Math.floor(rnd() * meta.length)];
    const b = meta[Math.floor(rnd() * meta.length)];
    await Game.create([a.deck, b.deck], [new Sampler(), new Sampler()], { seed: Math.floor(rnd() * 1e9), log: false }).run();
    games++;
  }
  const q = (xs: number[], p: number) => {
    const s = [...xs].sort((x, y) => x - y);
    return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0;
  };
  const md = [
    `# Reviewer noise check (${samples} decisions from ${games} games; every candidate scored twice with independent play-outs)`,
    '',
    '| Play-outs per candidate | Same best move | Same verdict on the move made | Blunder ↔ accurate flips | Value gap, median / 90th pct (Gigs) | Regret gap, median / 90th pct (Gigs) |',
    '|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.R} | ${Math.round((100 * r.bestSame) / r.n)}% | ${Math.round((100 * r.verdictSame) / r.n)}% | ${Math.round((100 * r.flips) / r.n)}% | ${(q(r.absDiff, 0.5) / GIG_SWING).toFixed(2)} / ${(q(r.absDiff, 0.9) / GIG_SWING).toFixed(2)} | ${(q(r.regretDiff, 0.5) / GIG_SWING).toFixed(2)} / ${(q(r.regretDiff, 0.9) / GIG_SWING).toFixed(2)} |`,
    ),
    '',
    `Current thresholds: accurate ≤ ${(NOISE / GIG_SWING).toFixed(2)} Gigs, blunder > ${(BLUNDER / GIG_SWING).toFixed(2)} Gigs.`,
  ].join('\n');
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/review-noise.md', md);
  console.log(md);
}
runMain(main);
