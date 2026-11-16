// One-off (2026-11-16, kept for the record; do not run it again on the split files, which it leaves alone): split the
// season breeder's two card-impact files by simulator version and bot.
//
//   npx tsx scripts/migrate-season-impact.ts --before-impact FILE --before-deck-impact FILE --baseline-analysis FILE
//       --split-at N [--impact data/seasons/impact.json] [--deck-impact data/seasons/deck-impact.json] [--write]
//
// Until then data/seasons/impact.json (card → {s, n}) and data/seasons/deck-impact.json (schema 1: list fingerprint →
// card → {s, n}) were plain sums that every season round robin added to, whatever its simulator version or bot. Both are
// additive, so a later part can be separated exactly: `--before-impact` and `--before-deck-impact` are the two files as
// they were before season `--split-at` (taken from git by whoever runs this; the script does not use git), the files at
// `--impact` and `--deck-impact` are the pooled ones now. The earlier entry is the before files exactly; the later entry
// is the difference, card by card and list by list, each sum chosen among the nearest floating-point numbers so that the
// two entries add up to today's numbers exactly. Each entry is labelled with the simulator version and bot of its
// seasons, read from the season files' manifests (data/seasons/season-N.json; the seasons of one part must agree), and
// with its sources: the earlier pooled entry also holds the review telemetry it was seeded from when it was started,
// `--baseline-analysis` (src/data/analysis.json as it was then), whose manifest must name the same pair.
//
// Checks printed before anything is written: the split is exact (the earlier entry equals the before files, the two add
// up to today's files, the later one is the difference; drawn-games never go down), and each pooled entry agrees with its
// per-list entry summed over lists (plus the baseline for the earlier one) within rounding.
//
// What it did on 2026-11-16: --before-* = the files at 007e7d4~1 (the commit before Season 3), --baseline-analysis =
// src/data/analysis.json at da61782 (run analysis:2026-11-11T21:39:39.918Z:1, simulator version 5, deep bot),
// --split-at 3. Earlier entry: simulator version 5, deep bot, the baseline and Seasons 1 and 2; later entry: simulator
// version 9, hard bot, Season 3. Without --write it only prints. Exits 1 when a check fails.
import fs from 'node:fs';
import { bool, cli, int, str } from './lib-node';
import { readSeasonFiles } from './breed-data';
import { analysisKey, checkSplit, splitImpactFiles, sumLists, type AnalysisLike, type SplitPart } from '../src/lib/breederImpact';
import { addStats, cardTotals, isLegacyCardImpact, keyWords, parseCardImpact, sameKey, sourceWords, type CardAcc, type ImpactKey, type ImpactSource } from '../src/lib/seasonImpact';
import { parseDeckImpact, parseDeckImpactV1 } from '../src/lib/seasonDeckImpact';

const { values: V } = cli(import.meta.url, {
  'before-impact': str(''),
  'before-deck-impact': str(''),
  'baseline-analysis': str(''),
  'split-at': int(0, { min: 0 }),
  impact: str('data/seasons/impact.json'),
  'deck-impact': str('data/seasons/deck-impact.json'),
  'seasons-dir': str('data/seasons'),
  write: bool(),
});
function fail(message: string, code = 1): never {
  console.error(`error: ${message}`);
  process.exit(code);
}
const readJson = (f: string): unknown => {
  if (!fs.existsSync(f)) fail(`${f} does not exist`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
};

const nowCardRaw = readJson(V.impact);
const nowDeckRaw = readJson(V['deck-impact']);
if (parseCardImpact(nowCardRaw).file && parseDeckImpact(nowDeckRaw).file) {
  console.log(`${V.impact} and ${V['deck-impact']} are already kept by simulator version and bot; nothing to do`);
  process.exit(0);
}
for (const f of ['before-impact', 'before-deck-impact', 'baseline-analysis'] as const) if (!V[f]) fail(`--${f} is required (see the header)`, 2);
if (!V['split-at']) fail('--split-at is required: the first season of the later part', 2);

const legacyCards = (raw: unknown, f: string): Record<string, CardAcc> => {
  if (!isLegacyCardImpact(raw)) fail(`${f} is not the old pooled card file (card → {s, n})`);
  return raw;
};
const v1 = (raw: unknown, f: string) => {
  const r = parseDeckImpactV1(raw);
  if (!r.file) fail(`${f} ${r.problem}`);
  return r.file;
};
const nowCard = legacyCards(nowCardRaw, V.impact);
const nowDeck = v1(nowDeckRaw, V['deck-impact']);
const beforeCard = legacyCards(readJson(V['before-impact']), V['before-impact']);
const beforeDeck = v1(readJson(V['before-deck-impact']), V['before-deck-impact']);
const baseline = readJson(V['baseline-analysis']) as AnalysisLike;

// ---- the pair and sources of each part, from the season files' manifests
const seasons = readSeasonFiles(V['seasons-dir']);
const part = (pick: (n: number) => boolean, what: string): SplitPart => {
  const ss = seasons.filter((s) => pick(s.season));
  if (!ss.length) fail(`no recorded season in the ${what} part`);
  let key: ImpactKey | null = null;
  const sources: ImpactSource[] = [];
  for (const s of ss) {
    const m = s.data.manifest as { simVersion?: unknown; bot?: { level?: unknown }; runId?: unknown } | undefined;
    const k = analysisKey({ manifest: m ?? null });
    if (!k) fail(`season ${s.season}'s file has no manifest with a simulator version and bot`);
    if (key && !sameKey(key, k)) fail(`the ${what} part mixes ${keyWords(key)} and ${keyWords(k)} (season ${s.season}): split it further first`);
    key = k;
    sources.push({ kind: 'season', season: s.season, ...(typeof m?.runId === 'string' ? { runId: m.runId } : {}) });
  }
  return { key: key!, sources };
};
const earlier = part((n) => n < V['split-at'], 'earlier');
const later = part((n) => n >= V['split-at'], 'later');
const bk = analysisKey(baseline);
const baseRun = baseline.manifest?.runId;
if (!bk || typeof baseRun !== 'string') fail(`${V['baseline-analysis']} has no manifest with a simulator version, bot and run id`);
if (!sameKey(bk, earlier.key)) fail(`the baseline was measured on ${keyWords(bk)}, the earlier seasons on ${keyWords(earlier.key)}`);
earlier.pooledOnly = [{ kind: 'analysis', runId: baseRun }];

// ---- split and check
const input = { beforeCard, nowCard, beforeDeck, nowDeck };
const r = splitImpactFiles({ ...input, earlier, later });
for (const p of r.problems) console.log(`  problem: ${p}`);
if (r.problems.length) fail(`${r.problems.length} problem(s); nothing written`);
const c = checkSplit(r, input);
for (const p of c.problems) console.log(`  problem: ${p}`);
if (c.problems.length) fail(`the split is not exact (${c.problems.length} problem(s)); nothing written`);

const [ce, cl] = r.card.entries;
const [de, dl] = r.deck.entries;
const fmt = (n: number) => n.toLocaleString('en-US');
for (const [what, e, d] of [
  ['earlier', ce!, de!],
  ['later', cl!, dl!],
] as const) {
  const t = cardTotals(e.cards);
  console.log(`${what} entry: ${keyWords(e)}; sources: impact.json ${e.sources.map(sourceWords).join(', ')}; deck-impact.json ${d.sources.map(sourceWords).join(', ')}`);
  console.log(`  impact.json: ${fmt(t.cards)} cards, ${fmt(t.drawnGames)} drawn-games; deck-impact.json: ${fmt(Object.keys(d.lists).length)} lists, ${fmt(cardTotals(sumLists(d.lists)).drawnGames)} drawn-games`);
  // the pooled entry against its lists summed (the earlier one also holds the baseline, which the per-list file never stored)
  const expect = sumLists(d.lists);
  if (what === 'earlier') for (const rep of baseline.decks ?? []) addStats(expect, rep.cards);
  let nOff = 0;
  let sOff = 0;
  for (const id of new Set([...Object.keys(expect), ...Object.keys(e.cards)])) {
    if ((expect[id]?.n ?? 0) !== (e.cards[id]?.n ?? 0)) nOff++;
    sOff = Math.max(sOff, Math.abs((expect[id]?.s ?? 0) - (e.cards[id]?.s ?? 0)));
  }
  console.log(`  pooled vs per-list summed${what === 'earlier' ? ' + baseline' : ''}: ${nOff} card(s) with other drawn-games, largest sum difference ${sOff.toExponential(2)}`);
  if (nOff) fail(`the ${what} pooled entry does not match its per-list entry`);
}
console.log(
  `checked ${fmt(c.checked)} card rows (${fmt(c.cards)} cards of impact.json, every card of all ${fmt(c.lists)} lists of deck-impact.json): the earlier entry is the file before season ${V['split-at']} bit for bit; earlier + later drawn-games = the pooled file exactly; the later entry is the difference (${fmt(c.laterCards)} cards, ${fmt(c.laterLists)} lists); earlier + later sums = the pooled file exactly in ${fmt(c.checked - c.rounded.length)} rows`,
);
for (const x of c.rounded) console.log(`  one rounding step off (no float sums exactly, the total is much smaller than its parts): ${x.what}, ${x.off.toExponential(2)}`);
if (V.write) {
  fs.writeFileSync(V.impact, JSON.stringify(r.card));
  fs.writeFileSync(V['deck-impact'], JSON.stringify(r.deck));
  console.log(`wrote ${V.impact} and ${V['deck-impact']}`);
} else console.log('dry run: pass --write to rewrite the files');
