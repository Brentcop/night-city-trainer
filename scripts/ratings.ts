// Power ratings: a Bradley–Terry model (with a going-first term) fitted to every game of the pooled tournament events.
//
//   npx tsx scripts/ratings.ts [--sim-version latest|all|N] [--bot latest|all|NAME] [--diagonal]
//
// P(A beats B | A on the play) = σ(rA − rB + h·[A first] − h·[B first]); ties count half a win for each side.
// A weak Gaussian prior (sd 1) keeps decks with few games near average. The model and its maths are in
// src/lib/ratingModel.ts. 90% intervals on the expected win rate come from the full covariance of the fit (the inverse of
// the whole Hessian, so the opponents' own uncertainty counts; SIM-6, 2026-11-12); --diagonal draws them the old way
// (the deck's own diagonal information only, every other rating fixed) and only prints, for comparison (writes nothing). Each deck also gets:
//   • expected win rate vs the whole field (average over every other deck) and vs the choom.gg meta archetypes;
//   • tournament results: events played, titles, top-8s, average Swiss finish percentile, match record.
// Which events are pooled (SIM-7): by default only those with the sim version and bot of the newest recorded event, so
// games from another simulator version or bot never mix in silently; --sim-version / --bot pick another group or `all`
// (pooled, with a warning line). Left-out events are listed in the file's `pool` field.
// Every pooled event's games feed the fit, whatever its format or pairing method. Tournament results (events, titles,
// top 8s, finishes, match records) come only from standard events: an event flagged `custom` (another format, or
// pairings or seeds set by hand: src/lib/eventFormats.ts) is skipped there. A deck entered twice ("X #2") plays as X,
// and its games against its own copy are left out of the fit.
// Output: src/data/ratings.json (site) and reports/ratings-latest.md. ratings.json carries a manifest naming the input
// events, their sim versions and run ids (src/lib/runManifest.ts aggregateManifest).
import fs from 'node:fs';
import { bool, cli, loadLibrary, readEvents, str, writeJsonStamped } from './lib-node';
import { aggregateManifest, type RecordedEventInput } from '../src/lib/runManifest';
import { checkSimVersionFlag, parsePoolFilter, poolEvents, poolRecord, selectEvents } from './event-pool';
import { fieldInterval, fitRatings } from '../src/lib/ratingModel';
import { ordinal } from '../src/lib/playedRecord';

const { values: V } = cli(import.meta.url, { 'sim-version': str('latest', checkSimVersionFlag), bot: str('latest'), diagonal: bool() });

const σ = (x: number) => 1 / (1 + Math.exp(-x));
const lib = loadLibrary();
const metaNames = new Set(lib.filter((d) => d.kind === 'meta').map((d) => d.deck.name));

const recorded = readEvents();
const selection = selectEvents(recorded, parsePoolFilter(V));
for (const w of selection.warnings) console.log(w);
const events = selection.kept;
const { games, results, customEvents } = poolEvents(events);
if (customEvents) console.log(`note: ${customEvents} custom event(s) (another format, or pairings set by hand): their games count, their titles and finishes don't`);
if (!games.length) {
  console.log('No tournament games yet (run scripts/tournament.ts).');
  process.exit(0);
}

const fit = fitRatings(games);
const { names, r, h, played } = fit;
const expVs = (k: number, rk: number, pool: number[]) => pool.filter((j) => j !== k).reduce((a, j) => a + σ(rk - r[j]), 0) / Math.max(1, pool.filter((j) => j !== k).length);
const MODE = V.diagonal ? 'diagonal' : 'full';
const all = names.map((_, k) => k);
const metaIdx = names.map((n, k) => (metaNames.has(n) ? k : -1)).filter((k) => k >= 0);
const rows = names
  .map((n, k) => {
    const iv = fieldInterval(fit, k, all, { mode: MODE });
    const se = iv.sdRating;
    const L = lib.find((d) => d.deck.name === n);
    const res = results[n];
    return {
      name: n,
      file: L?.file ?? '',
      origin: L?.prov.origin ?? '',
      rating: r[k],
      se,
      games: played[k],
      wrField: expVs(k, r[k], all),
      wrFieldLo: iv.lo,
      wrFieldHi: iv.hi,
      wrMeta: metaIdx.length ? expVs(k, r[k], metaIdx) : null,
      events: res?.events ?? 0,
      titles: res?.titles ?? 0,
      top8: res?.top8 ?? 0,
      avgFinish: res ? res.finishes.reduce((a, x) => a + x, 0) / res.finishes.length : null,
      matches: res ? `${res.mw}-${res.ml}` : '',
      gamesRecord: res ? `${res.gw}-${res.gl}` : '',
    };
  })
  .sort((a, b) => b.rating - a.rating);
// derived from the events only (no clock), so an unchanged rebuild leaves ratings.json byte-identical
const manifest = aggregateManifest('ratings', events as unknown as RecordedEventInput[], { games: games.length });
if (manifest.inputs?.mixedSimVersions) console.log(`note: these events span sim versions ${manifest.inputs.simVersions.map((v) => v ?? 'none').join(', ')} (see manifest.inputs)`);
const pool = poolRecord(selection);
// `intervals` says how the 90% ranges were drawn ('full-covariance' since SIM-6; files without it used the diagonal)
const out = { updated: '', events: events.length, games: games.length, firstPlayerEdge: σ(h) - 0.5, intervals: V.diagonal ? 'diagonal' : 'full-covariance', decks: rows, ...(pool ? { pool } : {}), manifest };
if (!V.diagonal) writeJsonStamped('src/data/ratings.json', out, { indent: 1 });
const pct = (x: number | null) => (x === null ? '—' : `${(x * 100).toFixed(1)}%`);
const md = [
  `# Power ratings (${events.length} events, ${games.length} games)`,
  '',
  `Bradley–Terry fit over every pooled tournament game (sim v${selection.simVersion === 'all' ? 'all' : (selection.simVersion ?? '?')}, ${selection.bot} bot; 90% ranges from the ${V.diagonal ? 'diagonal information' : 'full covariance'}). Going first adds ${(100 * (σ(h) - 0.5)).toFixed(1)} points of win probability.`,
  '',
  '| # | Deck | Exp. win % vs field (90% CI) | vs meta | Titles | Top 8 | Avg finish | Matches | Games |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows.map((x, i) => `| ${i + 1} | ${x.name} | ${pct(x.wrField)} (${pct(x.wrFieldLo)}–${pct(x.wrFieldHi)}) | ${pct(x.wrMeta)} | ${x.titles} | ${x.top8}/${x.events} | ${x.avgFinish === null ? '—' : `${ordinal(Math.round(x.avgFinish * 100))} pct`} | ${x.matches} | ${x.games} |`),
].join('\n');
if (!V.diagonal) fs.writeFileSync('reports/ratings-latest.md', md);
console.log(md.split('\n').slice(0, 25).join('\n'));
