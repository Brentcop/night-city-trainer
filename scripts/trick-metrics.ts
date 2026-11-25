// C.2's intended-effect metrics (docs/REVIEW_2026-11-24.md B1 and §10 C.2): how one bot configuration uses its tricks.
// Self-play (the same configuration on both seats) over every ordered pairing of the chosen decks, --per deals each,
// with the decision telemetry on (src/engine/telemetry.ts, aggregated by src/analysis/decisions.ts), then:
//   - each Quick Program's uses from hand (main-phase plays, sells, reaction plays) and the share that were sells
//     (sellShareOf, src/lib/sellShare.ts, reaction plays counted as uses from hand), and all seven together;
//   - reaction-window chances: attacks in which a Quick Program was castable in the defender's window (counted per card:
//     two castable Programs in one window are two chances), and of those the ones in which it was played; per game;
//   - reaction choices per game by kind (a Quick Program, a Call, a Block, a quick ability);
//   - Gunpoint Diplomacy (B2, a side observation): the turns it was castable in the main phase, those it was played in,
//     and its sells.
//   npx tsx scripts/trick-metrics.ts <tier | JSON spec> [JSON overrides] [--decks meta|all|<prefix>] [--per 1]
//     [--seed 52001] [--threads N] [--json FILE] [--force]
// The configuration is a tier name (easy, medium, hard, hard-main: its spec from scripts/agent-spec.ts) or a JSON spec as
// botcheck takes; a second JSON object is merged over it, e.g. `medium '{"readyTricks":12,"fastTricks":true}'`.
// --json writes the figures (refuses an existing file without --force). Nothing is cached (decision jobs are not).
import { existsSync, writeFileSync } from 'node:fs';
import { bool, cli, int, loadLibrary, runJobsDetailed, str, threadsOpt } from './lib-node';
import { TIER_SPECS, VARIANT_SPECS, type AgentSpec } from './agent-spec';
import { mergeAggregates, type DecisionAggregate, type ModeAgg, type UseMode } from '../src/analysis/decisions';
import { sellShareOf } from '../src/lib/sellShare';
import { CARDS } from '../src/engine/cards';
import type { MatchJob } from './worker';

const { values: V, positionals } = cli(
  import.meta.url,
  {
    per: int(1, { min: 1 }),
    decks: str('meta', (v) => (/^[\w.-]+$/.test(v) ? undefined : 'a deck set: meta, all, or a file-name prefix')),
    seed: int(52001),
    threads: threadsOpt(),
    json: str(undefined, (v) => (v.trim() ? undefined : 'needs a file')),
    force: bool(),
  },
  { minPositionals: 1, maxPositionals: 2 },
);

const parseJson = (s: string, which: string): AgentSpec => {
  try {
    const v = JSON.parse(s);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
    return v;
  } catch (e) {
    console.error(`error: ${which} must be a tier name or a JSON object (${(e as Error).message})\nRun with --help for usage.`);
    process.exit(2);
  }
};
const named: Record<string, AgentSpec> = { ...TIER_SPECS, ...VARIANT_SPECS };
const base = Object.prototype.hasOwnProperty.call(named, positionals[0]) ? named[positionals[0]] : parseJson(positionals[0], 'the configuration');
const spec: AgentSpec = { ...base, ...(positionals[1] ? parseJson(positionals[1], 'the overrides') : {}) };
if (V.json && existsSync(V.json) && !V.force) {
  console.error(`error: ${V.json} exists; pass --force to overwrite it.`);
  process.exit(2);
}

const lib = loadLibrary();
const baseName = (file: string) => file.slice(file.lastIndexOf('/') + 1);
const field = V.decks === 'meta' ? lib.filter((d) => d.kind === 'meta') : V.decks === 'all' ? lib : lib.filter((d) => baseName(d.file).startsWith(V.decks));
if (field.length < 2) {
  console.error(`error: --decks ${V.decks} matches ${field.length} deck${field.length === 1 ? '' : 's'}; at least 2 are needed.\nRun with --help for usage.`);
  process.exit(2);
}
const jobs: MatchJob[] = [];
let seed = V.seed;
for (const x of field) for (const y of field) if (x !== y) for (let k = 0; k < V.per; k++) jobs.push({ a: x.deck, b: y.deck, seed: seed++, first: (k % 2) as 0 | 1, bot: 'lookahead', agentA: spec, agentB: spec, decisions: true });
const { results, errors } = await runJobsDetailed(jobs, { threads: V.threads, allowErrors: true });
const aggs = results.map((r) => r.decisions).filter((x): x is DecisionAggregate => !!x);
const agg = mergeAggregates(...aggs);
const games = agg.games;

const QUICK = CARDS.filter((c) => c.type === 'Program' && c.keywords.includes('quick')).map((c) => c.id).sort();
const GUNPOINT = 'gunpoint_diplomacy';
/** One card's modes summed over every deck. */
function modesOf(id: string): Partial<Record<UseMode, ModeAgg>> {
  const out: Partial<Record<UseMode, ModeAgg>> = {};
  for (const d of Object.values(agg.decks)) {
    const c = d.cards[id];
    if (!c) continue;
    for (const [m, a] of Object.entries(c) as [UseMode, ModeAgg][]) {
      const o = (out[m] ??= { all: { uses: 0, games: 0, wins: 0 }, stage: {}, standing: {}, offered: 0, chosen: 0, windows: 0, windowsUsed: 0 });
      o.all.uses += a.all.uses;
      o.all.games += a.all.games;
      o.offered += a.offered;
      o.chosen += a.chosen;
      o.windows += a.windows;
      o.windowsUsed += a.windowsUsed;
    }
  }
  return out;
}
const name = (id: string) => CARDS.find((c) => c.id === id)?.name ?? id;
const pc = (x: number | null) => (x === null ? '—' : `${(100 * x).toFixed(1)}%`);
const per = (n: number) => (games ? (n / games).toFixed(3) : '—');

const rows = QUICK.map((id) => {
  const m = modesOf(id);
  const uses = (k: UseMode) => m[k]?.all.uses ?? 0;
  const share = sellShareOf(id, name(id), (Object.entries(m) as [UseMode, ModeAgg][]).map(([mode, a]) => ({ mode, all: a.all })), { reactFromHand: true });
  return { id, name: name(id), play: uses('play'), sell: uses('sell'), react: uses('react'), uses: share.uses, sellShare: share.share, windows: m.react?.windows ?? 0, windowsUsed: m.react?.windowsUsed ?? 0 };
});
const tot = rows.reduce((a, r) => ({ play: a.play + r.play, sell: a.sell + r.sell, react: a.react + r.react, uses: a.uses + r.uses, windows: a.windows + r.windows, windowsUsed: a.windowsUsed + r.windowsUsed }), { play: 0, sell: 0, react: 0, uses: 0, windows: 0, windowsUsed: 0 });
const choices: Record<string, number> = {};
for (const d of Object.values(agg.decks)) for (const [k, n] of Object.entries(d.reactions.choices)) choices[k] = (choices[k] ?? 0) + n;
const gp = modesOf(GUNPOINT);
const gunpoint = { castableTurns: gp.play?.windows ?? 0, playedTurns: gp.play?.windowsUsed ?? 0, sells: gp.sell?.all.uses ?? 0, plays: gp.play?.all.uses ?? 0 };

console.log(`Configuration ${JSON.stringify(spec)}: ${games} games (self-play, ${field.length} decks, --per ${V.per}, seeds from ${V.seed})${errors.length ? `, ${errors.length} game errors left out: ${errors[0].error?.slice(0, 200)}` : ''}`);
console.log('');
console.log('| Quick Program | plays | sells | reaction plays | uses from hand | sold | castable windows | used |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.name} | ${r.play} | ${r.sell} | ${r.react} | ${r.uses} | ${pc(r.sellShare)} | ${r.windows} | ${r.windowsUsed} |`);
console.log(`| all seven | ${tot.play} | ${tot.sell} | ${tot.react} | ${tot.uses} | ${pc(tot.uses ? tot.sell / tot.uses : null)} | ${tot.windows} | ${tot.windowsUsed} |`);
console.log('');
console.log(`Per game: castable windows ${per(tot.windows)}, used ${per(tot.windowsUsed)}; Quick Program sells ${per(tot.sell)}, reaction plays ${per(tot.react)}.`);
console.log(`Reaction choices per game: ${['play', 'call', 'block', 'ability', 'endReact'].map((k) => `${k} ${per(choices[k] ?? 0)}`).join(', ')}.`);
console.log(`Gunpoint Diplomacy: castable on ${gunpoint.castableTurns} turns, played on ${gunpoint.playedTurns} (${pc(gunpoint.castableTurns ? gunpoint.playedTurns / gunpoint.castableTurns : null)}); ${gunpoint.plays} plays, ${gunpoint.sells} sells.`);
if (V.json) {
  writeFileSync(V.json, JSON.stringify({ kind: 'nct-trick-metrics', schema: 1, spec, decks: V.decks, per: V.per, seed: V.seed, games, errors: errors.length, quick: rows, total: tot, reactionChoices: choices, gunpoint }, null, 1) + '\n');
  console.log(`Wrote ${V.json}.`);
}
if (errors.length) process.exitCode = 1;
