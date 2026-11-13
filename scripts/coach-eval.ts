// Coach evaluation: how good is the advice? Samples main-phase decisions from real bot games and compares each
// coach configuration against an oracle that scores every candidate action with several full-turn rollouts.
//
//   npx tsx scripts/coach-eval.ts [--samples 120] [--rollouts 8] [--seed 1] [--set base|deep|shipped]
//
// Every set includes the coach the Play page ships (makeCoach, src/ai/coach.ts); --set shipped compares it with the
// coach before the review-driven refinement (COACH_CONFIG_V1) only.
//
// Writes reports/coach-eval-<set>-latest.md.
//
// Metrics per coach config:
//   agreement — picks the oracle's best action
//   regret    — oracle value of the best action minus oracle value of the coach's action (evaluation points; lower is better)
//   blunders  — share of decisions with regret > 15 points (≈ giving up most of a Gig)
//   ms        — average thinking time per decision
import fs from 'node:fs';
import { Game, type Game as G } from '../src/engine/engine';
import { HeuristicAgent } from '../src/ai/heuristic';
import { makeWorlds, oracleValue } from '../src/ai/reviewer';
import { BEST_PROFILES } from '../src/ai/archetype';
import { COACH_CONFIG_V1, makeCoach } from '../src/ai/coach';
import type { Action, Agent, Decision } from '../src/engine/types';
import { cli, int, loadLibrary, oneOf, runMain } from './lib-node';

const { values: V } = cli(import.meta.url, { samples: int(120, { min: 1 }), rollouts: int(8, { min: 1 }), seed: int(1, { min: 0 }), set: oneOf(['base', 'deep', 'shipped'], 'base') });
const SAMPLES = V.samples;
const ROLLOUTS = V.rollouts;
let rngState = V.seed * 2654435761;
const rnd = () => ((rngState = (rngState * 1664525 + 1013904223) >>> 0) / 4294967296);

const SET = V.set;
const SHIPPED: Record<string, () => HeuristicAgent> = { 'shipped coach (makeCoach)': makeCoach };
const CONFIGS: Record<string, () => HeuristicAgent> = SET === 'shipped' ? {
  ...SHIPPED,
  'coach v1 (deep 12 + profiles + card impact)': () => new HeuristicAgent({ ...COACH_CONFIG_V1 }),
} : SET === 'deep' ? {
  ...SHIPPED,
  'deep 5 + profiles + card impact': () => new HeuristicAgent({ profiles: BEST_PROFILES, deep: 5, impact: 40 }),
  'deep 8 + profiles + card impact': () => new HeuristicAgent({ profiles: BEST_PROFILES, deep: 8, impact: 40 }),
  'deep 12 + profiles + card impact': () => new HeuristicAgent({ profiles: BEST_PROFILES, deep: 12, impact: 40 }),
  'deep 8 + profiles (no impact)': () => new HeuristicAgent({ profiles: BEST_PROFILES, deep: 8 }),
} : {
  ...SHIPPED,
  'current (1-ply + profiles)': () => new HeuristicAgent({ profiles: BEST_PROFILES }),
  '1-ply + profiles + card impact': () => new HeuristicAgent({ profiles: BEST_PROFILES, impact: 40 }),
  'deep 3 + profiles': () => new HeuristicAgent({ profiles: BEST_PROFILES, deep: 3 }),
  'deep 3 + profiles + card impact': () => new HeuristicAgent({ profiles: BEST_PROFILES, deep: 3, impact: 40 }),
  'deep 5 + profiles + card impact': () => new HeuristicAgent({ profiles: BEST_PROFILES, deep: 5, impact: 40 }),
};

interface Tally {
  regrets?: number[];
  losses?: number;
  n: number;
  agree: number;
  regret: number;
  blunders: number;
  ms: number;
}
const tally: Record<string, Tally> = Object.fromEntries(Object.keys(CONFIGS).map((k) => [k, { n: 0, agree: 0, regret: 0, blunders: 0, ms: 0 }]));
let samples = 0;

class Sampler implements Agent {
  name = 'sampler';
  base = new HeuristicAgent({ profiles: BEST_PROFILES, seed: Math.floor(rnd() * 1e9) });
  async decide(g: G, d: Decision): Promise<number[]> {
    if (d.kind === 'action' && d.options.length >= 3 && samples < SAMPLES && rnd() < 0.2) {
      samples++;
      const p = d.player;
      const actions = d.options.map((o) => o.action as Action);
      const picks: Record<string, number> = {};
      for (const [name, mk] of Object.entries(CONFIGS)) {
        const t0 = Date.now();
        const [i] = await mk().decide(g, d);
        tally[name].ms += Date.now() - t0;
        picks[name] = i;
      }
      // oracle scores: every action any config picked + the top candidates by a quick 1-ply screen
      const screen = new HeuristicAgent({ profiles: BEST_PROFILES });
      await screen.decide(g, d);
      const cand = new Set<number>([...Object.values(picks), ...screen.lastAlternatives.map((x) => x.index)]);
      const vals = new Map<number, number>();
      const worlds = makeWorlds(ROLLOUTS, rnd); // same worlds for every candidate (common random numbers)
      for (const i of cand) vals.set(i, await oracleValue(g, p, actions[i], worlds));
      const bestV = Math.max(...vals.values());
      const bestI = [...vals.entries()].find(([, v]) => v === bestV)![0];
      for (const [name, i] of Object.entries(picks)) {
        const r = bestV - (vals.get(i) ?? bestV);
        const t = tally[name];
        t.n++;
        t.regret += r;
        (t.regrets ??= []).push(r);
        if (r > 1000) t.losses = (t.losses ?? 0) + 1;
        if (i === bestI || r < 0.5) t.agree++;
        if (r > 15) t.blunders++;
      }
      if (samples % 10 === 0) process.stderr.write(`  ${samples}/${SAMPLES} decisions\n`);
    }
    return this.base.decide(g, d);
  }
}

async function main() {
  const meta = loadLibrary().filter((d) => d.kind === 'meta' || d.kind === 'original');
  let game = 0;
  while (samples < SAMPLES && game < 400) {
    const a = meta[Math.floor(rnd() * meta.length)];
    const b = meta[Math.floor(rnd() * meta.length)];
    const g = Game.create([a.deck, b.deck], [new Sampler(), new Sampler()], { seed: Math.floor(rnd() * 1e9), log: false });
    await g.run();
    game++;
  }
  const med = (xs: number[]) => {
    const a = [...xs].sort((x, y) => x - y);
    return a.length ? a[Math.floor(a.length / 2)] : 0;
  };
  const rows = Object.entries(tally).map(([k, t]) => ({
    k,
    agree: t.agree / t.n,
    regret: t.regret / t.n,
    blunders: t.blunders / t.n,
    ms: t.ms / t.n,
    n: t.n,
    trimmed: (t.regrets ?? []).filter((x) => x <= 1000).reduce((a, x) => a + x, 0) / Math.max(1, (t.regrets ?? []).filter((x) => x <= 1000).length),
    losses: t.losses ?? 0,
    med: med(t.regrets ?? []),
  }));
  const md = [
    `# Coach evaluation (${samples} decisions from ${game} games, oracle = ${ROLLOUTS} rollouts per candidate)`,
    '',
    '| Coach config | Agrees with oracle | Regret excl. game-losing (avg) | Game-losing picks | Blunders (>15 pts) | ms / decision |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.k} | ${(r.agree * 100).toFixed(0)}% | ${r.trimmed.toFixed(2)} | ${r.losses} of ${r.n} | ${(r.blunders * 100).toFixed(1)}% | ${Math.round(r.ms)} |`),
    '',
    'Regret is measured in evaluation points (a stolen Gig is worth ~40). Lower is better.',
  ].join('\n');
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(`reports/coach-eval-${SET}-latest.md`, md);
  console.log(md);
}
runMain(main);
