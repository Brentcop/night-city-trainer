// How good is the bots' mulligan rule? (BOT-6, docs/IMPROVEMENT_BACKLOG.md WP-D1.) Every deal is played twice with
// the same decks, seed and first player: once with the studied seat (seat 0) forced to keep its opening hand and once
// forced to mulligan it; nothing else differs (the mulligan's reshuffle does move the game's random stream on). The
// game whose forced choice matches the bot's own verdict is the game the bot would have played. So for every opening
// hand both outcomes are known, and any rule can be scored offline on the same hands.
//   npx tsx scripts/mulligan-check.ts [--per 60] [--decks meta|all|<file prefix>] [--bot hard] [--seed 50001]
//                                     [--threads N] [--out DIR]
// --per: deals per ordered pairing of the chosen decks (the studied deck in seat 0, first player alternating).
// --bot: the tier both seats play (src/ai/tiers.ts names); the verdict reported as "rule" is that bot's own.
// --out: also write every hand (features, verdicts, both outcomes) to DIR/mulligan-hands.json; nothing is written
//   without it.
// Prints per deck: hands, the rule's mulligan rate, the win rate of the played game when the rule kept and when it
// mulliganed, and the forced-choice gain of mulligan over keep (points, 95% interval) in the hands the rule keeps and in
// those it mulligans; then the plain rule (`mulligan: 'plain'`, src/ai/mulligan.ts: no card-impact keep) scored offline
// against the bot's rule on the same hands (only the hands where the two differ count).
import fs from 'node:fs';
import path from 'node:path';
import { cli, int, loadLibrary, oneOf, runJobsDetailed, str, threadsOpt, TIER_BOTS } from './lib-node';
import { pairedInterval, scoreOf } from '../src/lib/evidence';
import type { MatchJob, OpeningHand } from './worker';

const { values: V } = cli(import.meta.url, {
  per: int(60, { min: 1 }),
  decks: str('meta', (v) => (/^[\w.-]+$/.test(v) ? undefined : 'a deck set: meta, all, or a file-name prefix')),
  bot: oneOf(TIER_BOTS, 'hard'),
  seed: int(50001),
  threads: threadsOpt(),
  out: str(),
});

const lib = loadLibrary();
const baseName = (file: string) => file.slice(file.lastIndexOf('/') + 1);
const field = V.decks === 'meta' ? lib.filter((d) => d.kind === 'meta') : V.decks === 'all' ? lib : lib.filter((d) => baseName(d.file).startsWith(V.decks));
if (field.length < 2) {
  console.error(`error: --decks ${V.decks} matches ${field.length} deck${field.length === 1 ? '' : 's'}; at least 2 are needed.\nRun with --help for usage.`);
  process.exit(2);
}

const deal: Omit<MatchJob, 'mulliganA'>[] = [];
let seed = V.seed;
for (const x of field) for (const y of field) if (x !== y) for (let k = 0; k < V.per; k++) deal.push({ a: x.deck, b: y.deck, seed: seed++, first: (k % 2) as 0 | 1, bot: V.bot });
const half = Math.max(1, Math.ceil(V.threads / 2));
const [kept, mulled] = await Promise.all([
  runJobsDetailed(deal.map((j) => ({ ...j, mulliganA: 'keep' as const })), { threads: half, allowErrors: true }),
  runJobsDetailed(deal.map((j) => ({ ...j, mulliganA: 'mulligan' as const })), { threads: Math.max(1, V.threads - half), allowErrors: true, quiet: true }),
]);
const bySeed = (rs: typeof kept.results) => new Map(rs.map((r) => [r.seed, r]));
const [K, M] = [bySeed(kept.results), bySeed(mulled.results)];

export interface HandRow extends OpeningHand {
  deck: string;
  rival: string;
  seed: number;
  first: 0 | 1;
  /** seat 0's score with the hand kept / mulliganed */
  keepScore: number;
  mullScore: number;
}
const rows: HandRow[] = [];
for (const j of deal) {
  const k = K.get(j.seed);
  const m = M.get(j.seed);
  if (!k?.opening || !m) continue;
  rows.push({ ...k.opening, deck: j.a.name, rival: j.b.name, seed: j.seed, first: j.first, keepScore: scoreOf(k.winner), mullScore: scoreOf(m.winner) });
}

const pc = (x: number) => (100 * x).toFixed(1);
const iv = (c: number[], b: number[]) => {
  if (!c.length) return 'n/a';
  const r = pairedInterval(c, b);
  return `${r.mean >= 0 ? '+' : ''}${pc(r.mean)} [${pc(r.lower)}, ${pc(r.upper)}] n=${c.length}`;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
const played = (r: HandRow, mull: boolean) => (mull ? r.mullScore : r.keepScore);

console.log(`Mulligan check: bot ${V.bot}, ${rows.length} opening hands (${2 * rows.length} games), ${field.length} decks, --per ${V.per}, seed ${V.seed}`);
console.log('Gain = win points of mulligan minus keep on the same deal (95% paired interval).');
const groups = new Map<string, HandRow[]>();
for (const r of rows) (groups.get(r.deck) ?? groups.set(r.deck, []).get(r.deck)!).push(r);
groups.set('ALL', rows);
for (const [deck, rs] of groups) {
  const keepRs = rs.filter((r) => !r.rule);
  const mullRs = rs.filter((r) => r.rule);
  console.log(`\n${deck}: ${rs.length} hands, rule mulligans ${pc(mullRs.length / rs.length)}%`);
  console.log(`  win rate as played: rule kept ${pc(mean(keepRs.map((r) => r.keepScore)))}%, rule mulliganed ${pc(mean(mullRs.map((r) => r.mullScore)))}%`);
  console.log(`  gain of mulligan over keep: hands the rule keeps ${iv(keepRs.map((r) => r.mullScore), keepRs.map((r) => r.keepScore))}`);
  console.log(`                              hands the rule mulligans ${iv(mullRs.map((r) => r.mullScore), mullRs.map((r) => r.keepScore))}`);
  for (const alt of ['plain'] as const) {
    const diff = rs.filter((r) => r[alt] !== r.rule);
    console.log(`  '${alt}' rule mulligans ${pc(mean(rs.map((r) => +r[alt])))}%; against the bot's rule on the ${diff.length} hands where they differ: ${iv(diff.map((r) => played(r, r[alt])), diff.map((r) => played(r, r.rule)))}`);
  }
}
if (V.out) {
  fs.mkdirSync(V.out, { recursive: true });
  const file = path.join(V.out, 'mulligan-hands.json');
  fs.writeFileSync(file, JSON.stringify({ bot: V.bot, per: V.per, seed: V.seed, decks: V.decks, hands: rows }) + '\n');
  console.log(`\nwrote ${file}`);
}
const errs = [...kept.errors, ...mulled.errors];
if (errs.length) console.error(`${errs.length} game errors (their hands excluded)`);
