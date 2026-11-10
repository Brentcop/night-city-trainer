// Self-play tuning of matchup profiles (weight multipliers per my-archetype > rival-archetype).
//   npx tsx scripts/tune-profiles.ts [--games 160] [--seed 1] [--threads N]
// For each archetype pairing that exists in the deck library, try nudging one weight at a time for that
// pairing only; the variant plays the current profiles on the same seeds. Adopt clear winners.
// Writes src/ai/profiles.tuned.json (loaded as TUNED_PROFILES).
import fs from 'node:fs';
import { classify, DEFAULT_PROFILES, type ProfileKey, type Profiles } from '../src/ai/archetype';
import { cli, int, loadLibrary, runJobs, runMain, threadsOpt } from './lib-node';
import type { MatchJob } from './worker';

const { values: V } = cli(import.meta.url, { games: int(160, { min: 1 }), seed: int(1, { min: 0 }), threads: threadsOpt() });
const GAMES = V.games;
const THREADS = Math.min(V.threads, 16);
/** Deterministic seed stream from --seed (was Math.random). */
let seedState = (V.seed * 2654435761) >>> 0 || 1;
const nextSeed = () => 5000 + ((seedState = (seedState * 1664525 + 1013904223) >>> 0) % 1_000_000);
const lib = loadLibrary();
const arch = new Map(lib.map((d) => [d.deck.name, classify(d.deck.main).arch]));
let current: Profiles = JSON.parse(JSON.stringify(DEFAULT_PROFILES));
const WEIGHTS = ['gig', 'spentRisk', 'hand'] as const;

/** Win rate of `aProfiles` piloting deck A against current profiles on deck B, over pairings matching `key`. */
async function measure(key: ProfileKey, variant: Profiles, seed0: number): Promise<number> {
  const [me, opp] = key.split('>');
  const pairs = lib.flatMap((a) => lib.filter((b) => b !== a && arch.get(a.deck.name) === me && arch.get(b.deck.name) === opp).map((b) => [a, b] as const));
  if (pairs.length < 4) return NaN;
  const jobs: MatchJob[] = [];
  let seed = seed0;
  for (let k = 0; k < GAMES; k++) {
    const [a, b] = pairs[k % pairs.length];
    jobs.push({ a: a.deck, b: b.deck, seed: seed++, first: (Math.floor(k / pairs.length) % 2) as 0 | 1, bot: 'lookahead', agentA: { profiles: variant as any }, agentB: { profiles: current as any } });
  }
  const res = await runJobs(jobs, { threads: THREADS });
  return res.reduce((s, r) => s + (r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0), 0) / res.length;
}

async function main() {
  const keys = new Set<ProfileKey>();
  for (const a of lib) for (const b of lib) if (a !== b) keys.add(`${arch.get(a.deck.name)}>${arch.get(b.deck.name)}` as ProfileKey);
  console.log('Archetypes:', Object.fromEntries(arch));
  const log: string[] = [];
  for (const key of keys) {
    // baseline: current vs current on the same seeds (deck strength cancels out in the delta)
    const seed0 = nextSeed();
    let base = await measure(key, current, seed0);
    if (isNaN(base)) continue;
    console.log(`${key} baseline ${(base * 100).toFixed(1)}%`);
    for (const w of WEIGHTS) {
      for (const mult of [0.7, 1.4]) {
        const cur = current[key]?.[w] ?? 1;
        const variant: Profiles = JSON.parse(JSON.stringify(current));
        variant[key] = { ...(variant[key] ?? {}), [w]: +(cur * mult).toFixed(3) };
        const wr = await measure(key, variant, seed0);
        if (isNaN(wr)) break;
        const delta = wr - base;
        const line = `${key} ${w} x${mult} -> ${(wr * 100).toFixed(1)}% (Δ ${(delta * 100).toFixed(1)})`;
        console.log(line);
        log.push(line);
        if (delta >= 0.05) {
          current = variant;
          base = wr;
          console.log(`  adopt ${key}.${w}=${variant[key]![w]}`);
          log.push(`  adopt`);
          break;
        }
      }
    }
  }
  fs.writeFileSync('src/ai/profiles.tuned.json', JSON.stringify(current, null, 2));
  fs.writeFileSync('reports/tune-profiles.log', log.join('\n'));
  console.log('Saved src/ai/profiles.tuned.json', JSON.stringify(current));
}
runMain(main);
