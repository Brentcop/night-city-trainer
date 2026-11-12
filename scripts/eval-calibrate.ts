// INFO-4: calibrate the bots' evaluation against who actually won. Plays seeded games (every ordered pairing of the
// chosen decks, --per deals each, first player alternating), records evaluate()'s value and per-term features at the end
// of every turn (where deep rollouts evaluate) from both seats' view, then reports, on games split into train /
// validation / held-out (src/analysis/evalCalibration.ts):
//   - the win rate per bin of the current value (overall and by stage) and a one-parameter logistic Ïƒ(aÂ·value);
//   - a ridge logistic of the result on the unweighted features (Î» chosen on the validation games), its held-out
//     log-loss and Brier score against the one-parameter calibration, and the fitted weights next to the hand weights
//     on the gig scale (Î² Ã— 20 / Î²_gig), with a candidate EvalWeights set (unidentified terms keep their hand values).
//   npx tsx scripts/eval-calibrate.ts [--decks all|meta|<file prefix>] [--per 2] [--seed 70001] [--bot hard]
//     [--view ender|next|both] [--stages] [--deck-effects] [--from FILE] [--threads N] [--out DIR] [--force]
// --view: rows from the seat that just ended its turn (ender, default), the seat about to start (next: a deep rollout's
//   leaf, scored from the decider's view after the rival's reply), or both reported one after the other.
// --stages: also fit features Ã— stage (turns 1â€“4, 5â€“9, 10+) and report its held-out log-loss.
// --deck-effects: also fit a strength per deck (own +1, rival's −1) and going first, so a term is not credited with
//   what the stronger list or the first seat wins (the candidate still uses only the evaluation terms).
// --from FILE: re-analyse leaves saved by an earlier run (DIR/eval-leaves.json) instead of playing games.
// --out DIR: write DIR/eval-calibrate.md, DIR/eval-calibrate.json (report and run manifest) and DIR/eval-leaves.json
//   (the raw leaves, for --from); refuses to overwrite them without --force. Without --out the report goes to stdout
//   and nothing is written.
import fs from 'node:fs';
import path from 'node:path';
import { bool, cli, int, loadLibrary, oneOf, Refusal, runJobs, runMain, str, threadsOpt, TIER_BOTS } from './lib-node';
import { analyzeLeaves, reportMarkdown, type CalibrationReport, type LeafGame } from '../src/analysis/evalCalibration';
import { gameRunManifest } from '../src/lib/runManifest';
import { SIM_VERSION } from '../src/lib/tournament';
import type { MatchJob } from './worker';

const { values: V } = cli(import.meta.url, {
  decks: str('all', (v) => (/^[\w.-]+$/.test(v) ? undefined : 'a deck set: meta, all, or a file-name prefix')),
  per: int(2, { min: 1 }),
  seed: int(70001, { min: 0 }),
  bot: oneOf(TIER_BOTS, 'hard'),
  view: oneOf(['ender', 'next', 'both'] as const, 'ender'),
  stages: bool(),
  'deck-effects': bool(),
  from: str(),
  threads: threadsOpt(),
  out: str(),
  force: bool(),
});

async function main() {
  const files = V.out ? ['eval-calibrate.md', 'eval-calibrate.json', 'eval-leaves.json'].map((f) => path.join(V.out!, f)) : [];
  const clash = files.filter((f) => fs.existsSync(f) && !(V.from && path.resolve(f) === path.resolve(V.from)));
  if (clash.length && !V.force) throw new Refusal(`${clash.join(', ')} exist${clash.length === 1 ? 's' : ''}; pass --force to overwrite`);

  let games: LeafGame[];
  let manifest: unknown = null;
  const t0 = Date.now();
  if (V.from) {
    const saved = JSON.parse(fs.readFileSync(V.from, 'utf8')) as { manifest?: unknown; games: LeafGame[] };
    games = saved.games;
    manifest = saved.manifest ?? null;
    console.error(`Read ${games.length} games from ${V.from}.`);
  } else {
    const lib = loadLibrary();
    const base = (f: string) => f.slice(f.lastIndexOf('/') + 1);
    const field = V.decks === 'meta' ? lib.filter((d) => d.kind === 'meta') : V.decks === 'all' ? lib : lib.filter((d) => base(d.file).startsWith(V.decks));
    if (field.length < 2) throw new Refusal(`--decks ${V.decks} matches ${field.length} deck(s); at least 2 are needed`);
    const jobs: MatchJob[] = [];
    let seed = V.seed;
    for (const x of field) for (const y of field) if (x !== y) for (let k = 0; k < V.per; k++) jobs.push({ a: x.deck, b: y.deck, seed: seed++, first: (k % 2) as 0 | 1, bot: V.bot, evalLeaves: true });
    console.error(`Playing ${jobs.length} ${V.bot} games over ${field.length} decksâ€¦`);
    const res = await runJobs(jobs, { threads: V.threads, allowErrors: true });
    games = res.map((r) => ({ seed: r.seed, a: r.a, b: r.b, first: r.first, winner: r.winner as 0 | 1 | 'tie', leaves: r.evalLeaves ?? [] }));
    manifest = gameRunManifest({
      purpose: 'analysis',
      decks: field,
      fieldMode: V.decks,
      bot: V.bot,
      seedBase: V.seed,
      seatPolicy: 'alternate',
      plannedGames: jobs.length,
      completedGames: res.length,
      gamesPerPair: V.per,
      simVersion: SIM_VERSION,
    });
  }
  const secs = (Date.now() - t0) / 1000;
  const views = V.view === 'both' ? (['ender', 'next'] as const) : ([V.view] as const);
  const reports: CalibrationReport[] = views.map((v) => analyzeLeaves(games, v, { stageInteractions: V.stages, deckEffects: V['deck-effects'] }));
  const leaves = games.reduce((s, g) => s + g.leaves.length, 0);
  const md = [
    `# Evaluation calibration (INFO-4)`,
    '',
    `${games.length} games (${V.from ? `from ${V.from}` : `${V.bot}, --decks ${V.decks} --per ${V.per} --seed ${V.seed}, ${secs.toFixed(0)} s`}), ${leaves} ends of turns. Results are win 1 / tie Â½ / loss 0 for the viewing seat; the value is evaluate() with DEFAULT_WEIGHTS, features unweighted.`,
    '',
    ...reports.map(reportMarkdown),
  ].join('\n');
  if (!V.out) {
    console.log(md);
    return;
  }
  fs.mkdirSync(V.out, { recursive: true });
  const [mdFile, jsonFile, leavesFile] = files as [string, string, string];
  fs.writeFileSync(mdFile, md + '\n');
  fs.writeFileSync(jsonFile, JSON.stringify({ manifest, reports }, null, 1));
  if (!V.from) fs.writeFileSync(leavesFile, JSON.stringify({ manifest, games }));
  console.log(md);
  console.error(`\nWrote ${mdFile}, ${jsonFile}${V.from ? '' : `, ${leavesFile}`}.`);
}
runMain(main);
