// Self-play tuning of matchup profiles (weight multipliers per my-archetype > rival-archetype).
//   npx tsx scripts/tune-profiles.ts [--games 160] [--seed 1] [--threads N] [--apply --min-gain 1]
// For each archetype pairing that exists in the deck library, try nudging one weight at a time for that
// pairing only; candidates use matched training games and are evaluated against defaults on held-out seeds.
// Applying a candidate requires an explicit practical-gain threshold and a held-out confidence bound above it.
import fs from 'node:fs';
import { deckFingerprint, fingerprintText } from '../src/engine/deck';
import { BEST_PROFILES, classify, type ProfileKey, type Profiles } from '../src/ai/archetype';
import { SIM_VERSION } from '../src/lib/tournament';
import { createRunManifest } from '../src/lib/runManifest';
import { bool, cli, int, loadLibrary, runJobs, runMain, threadsOpt } from './lib-node';
import type { MatchJob } from './worker';
import { summarizePaired } from './tuning';

const { values: V } = cli(import.meta.url, {
  games: int(160, { min: 1 }),
  seed: int(1, { min: 0 }),
  threads: threadsOpt(),
  apply: bool(),
  'min-gain': int(undefined, { min: 0, max: 100 }),
});
const GAMES = V.games;
const THREADS = Math.min(V.threads, 16);
const SEED_WINDOW = 2_000;
const trainSeed = 5_000 + (V.seed % 400) * SEED_WINDOW;
const validationSeed = trainSeed + 1_000_000;
const lib = loadLibrary().filter((d) => d.kind === 'meta');
const arch = new Map(lib.map((d) => [d.deck.name, classify(d.deck.main).arch]));
const original: Profiles = JSON.parse(JSON.stringify(BEST_PROFILES));
let current: Profiles = JSON.parse(JSON.stringify(original));
const WEIGHTS = ['gig', 'spentRisk', 'hand'] as const;
const seatWarned = new Set<ProfileKey>();

function pairsFor(key: ProfileKey) {
  const [me, opp] = key.split('>');
  return lib.flatMap((a) => lib.filter((b) => b !== a && arch.get(a.deck.name) === me && arch.get(b.deck.name) === opp).map((b) => [a, b] as const));
}

/** Win rate of `aProfiles` piloting deck A against current profiles on deck B, over pairings matching `key`. */
async function measure(key: ProfileKey, variant: Profiles, opponent: Profiles, seed0: number): Promise<number[]> {
  const pairs = pairsFor(key);
  if (pairs.length < 4) return [];
  if (GAMES % (2 * pairs.length) !== 0 && !seatWarned.has(key)) {
    seatWarned.add(key);
    console.warn(`  warning: ${key}: --games ${GAMES} is not a multiple of ${2 * pairs.length} (2 x ${pairs.length} pairings), so play/draw is not exactly balanced per pairing`);
  }
  const jobs: MatchJob[] = [];
  let seed = seed0;
  for (let k = 0; k < GAMES; k++) {
    const [a, b] = pairs[k % pairs.length];
    jobs.push({
      a: a.deck,
      b: b.deck,
      seed: seed++,
      // Alternate the seat each time the pairing list is cycled, so every pairing gets both play and draw.
      first: (Math.floor(k / pairs.length) % 2) as 0 | 1,
      bot: 'lookahead',
      agentA: { profiles: variant },
      agentB: { profiles: opponent },
    });
  }
  const res = await runJobs(jobs, { threads: THREADS });
  if (res.some((r) => r.winner === null)) throw new Error(`a tuning game failed for ${key}; refusing to score an incomplete sample`);
  return res.map((r) => (r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0));
}

async function main() {
  const keys = new Set<ProfileKey>();
  for (const a of lib) for (const b of lib) if (a !== b) keys.add(`${arch.get(a.deck.name)}>${arch.get(b.deck.name)}` as ProfileKey);
  console.log('Archetypes:', Object.fromEntries(arch));
  // Training seed0 advances 17 per log line; a key logs at most 3 lines per weight (x0.7, x1.4, adopt). The last
  // tuned key must still fit its GAMES seeds inside this --seed's window, or it would reuse the next --seed's seeds.
  const tunable = [...keys].filter((k) => pairsFor(k).length >= 4).length;
  const trainingSpan = Math.max(0, tunable - 1) * WEIGHTS.length * 3 * 17 + GAMES;
  if (trainingSpan > SEED_WINDOW) {
    throw new Error(
      `training may need ${trainingSpan} seeds (${tunable} archetype pairings, --games ${GAMES}) but each --seed has a ${SEED_WINDOW}-seed window; lower --games`,
    );
  }
  const log: string[] = [];
  for (const key of keys) {
    const seed0 = trainSeed + log.length * 17;
    let base = await measure(key, current, current, seed0);
    if (!base.length) continue;
    console.log(`${key} baseline ${(100 * base.reduce((s, x) => s + x, 0) / base.length).toFixed(1)}%`);
    for (const w of WEIGHTS) {
      for (const mult of [0.7, 1.4]) {
        const cur = current[key]?.[w] ?? 1;
        const variant: Profiles = JSON.parse(JSON.stringify(current));
        variant[key] = { ...(variant[key] ?? {}), [w]: +(cur * mult).toFixed(3) };
        const scores = await measure(key, variant, current, seed0);
        const summary = summarizePaired(scores, base);
        const line = `${key} ${w} x${mult} -> Δ ${(summary.mean * 100).toFixed(1)}pp [${(summary.lower95 * 100).toFixed(1)}, ${(summary.upper95 * 100).toFixed(1)}]`;
        console.log(line);
        log.push(line);
        if (summary.mean >= 0.05) {
          current = variant;
          base = await measure(key, current, current, seed0);
          console.log(`  adopt ${key}.${w}=${variant[key]![w]}`);
          log.push(`  adopt`);
          break;
        }
      }
    }
  }
  const heldOut: number[] = [];
  const heldOutBaseline: number[] = [];
  for (const key of keys) {
    const seed0 = validationSeed + heldOut.length * 17;
    const baseline = await measure(key, original, original, seed0);
    const candidate = await measure(key, current, original, seed0);
    if (!baseline.length) continue;
    heldOutBaseline.push(...baseline);
    heldOut.push(...candidate);
  }
  const validation = summarizePaired(heldOut, heldOutBaseline);
  const ids = lib.map((d) => d.deckId ?? deckFingerprint(d.deck));
  const manifest = createRunManifest({
    runId: `tune-profiles:${V.seed}:${new Date().toISOString()}`,
    createdAt: new Date().toISOString(),
    purpose: 'tuning',
    simVersion: SIM_VERSION,
    rulesVersion: null,
    faqVersion: null,
    bot: { level: 'lookahead', configHash: fingerprintText(JSON.stringify(current)) },
    decks: lib.map((d, i) => ({ id: ids[i], name: d.deck.name, file: d.file })),
    field: { mode: 'meta-archetype-pairings', deckIds: ids },
    sample: { plannedGames: heldOut.length, completedGames: heldOut.length, gamesPerPair: GAMES },
    seedBase: validationSeed,
    seatPolicy: 'alternate',
    trace: false,
  });
  console.log(
    `Held-out paired gain: ${(validation.mean * 100).toFixed(2)}pp [${(validation.lower95 * 100).toFixed(2)}, ${(validation.upper95 * 100).toFixed(2)}] (${validation.games} games)`,
  );
  console.log('Candidate profiles (not applied):\n' + JSON.stringify(current, null, 2));
  console.log('Run manifest:\n' + JSON.stringify(manifest, null, 2));
  fs.mkdirSync('reports', { recursive: true });
  const reportPath = `reports/tune-profiles-${V.seed}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({ manifest, original, candidate: current, trainingLog: log, validation }, null, 2), { flag: 'wx' });
  console.log(`Saved ${reportPath}`);
  if (V.apply) {
    if (V['min-gain'] === undefined) throw new Error('pass --min-gain as the minimum practical win-rate gain in percentage points before applying profiles');
    if (validation.lower95 <= V['min-gain'] / 100) {
      throw new Error(`held-out lower confidence bound ${(validation.lower95 * 100).toFixed(2)}pp does not exceed the ${V['min-gain']}pp practical-gain threshold`);
    }
    fs.writeFileSync('src/ai/profiles.tuned.json', JSON.stringify(current, null, 2));
    fs.writeFileSync('reports/tune-profiles.log', log.join('\n'));
    console.log('Applied profiles to src/ai/profiles.tuned.json');
  }
}
runMain(main);
