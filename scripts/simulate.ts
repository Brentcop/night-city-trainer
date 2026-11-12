// Deck matchup lab (CLI).
//
//   npm run sim -- catalog                         list decks in the library
//   npm run sim -- vs <deckA> <deckB> [--games 200]   head-to-head
//   npm run sim -- test <deck> [--games 100]          one deck vs every meta deck (or --field all)
//   npm run sim -- review [--games 60] [--field meta|all]   full round-robin matrix + rankings
//   npm run sim -- add <file.txt|-> [--name X] [--force]   import a deck list (choom.gg / official / sim JSON) into data/decks/custom
//   npm run sim -- show <deck>                        print a deck with validation
//   npm run sim -- analyze [--field meta|all] [--games 40] [--deck X]   telemetry analysis -> reports/analysis-latest.md + src/data/analysis.json
//        [--decisions]              also record every decision (docs/DECISION_TELEMETRY.md) -> reports/decisions-latest.{json,md}
//                                   and, for a whole field, public/data/decisions.json (the Card stats page's Decisions view)
//        [--decision-samples N]     with --decisions: dump the raw records of the first N games -> reports/decisions-samples-latest.json
//        [--synergies]              also observe the synergy packages (docs/SYNERGIES.md) -> reports/synergies-latest.{json,md}
//                                   and, for a whole field, public/data/synergies.json (Card stats → Synergies, deck profiles)
//        [--synergies-only]         write ONLY the synergy outputs (no analysis, review, impact or decisions files)
//        [--out DIR]                write every analyze output into DIR instead of reports/ and src/data/ (no site copy)
//        [--force]                  allow replacing public/data/decisions.json, the synergy outputs, or files already in DIR
//
// Game flags: --bot (default lookahead), --threads N, --seed N (default 1). --field: meta | all | custom | leaderboard:N.
// `add` refuses to replace an existing deck file unless --force (the file's provenance header is kept).
// A game that throws is an error, not a tie: the run prints the first stack, writes nothing and exits 1.
//
// Decks are matched by file name or deck name fragment (e.g. "rry", "meta-bbg", "Smash the Curve"),
// or by a path to a deck text file. Results are written to reports/.
import fs from 'node:fs';
import path from 'node:path';
import { exportOfficial, listFingerprint, parseDeck, validateDeck, deckColors } from '../src/engine/deck';
import { CARD_BY_ID, cardLabel } from '../src/engine/cards';
import type { DeckList } from '../src/engine/types';
import { cli, loadLibrary, mergeProvenance, Refusal, resolveDeck, runJobs as runPool, runMain, slugify, type Spec } from './lib-node';
import { ALL_FLAGS, analyzeFlagProblem, analyzeOutputs, COMMANDS, protectedOutputs, wantsSynergies } from './sim-flags';
import { shortCredit, type LibraryDeck } from '../src/lib/library';
import { SIM_VERSION } from '../src/lib/tournament';
import { gameRunManifest, type RunManifest } from '../src/lib/runManifest';
import { toImpactData } from '../src/analysis/impactData';
import type { MatchJob, MatchResult } from './worker';

const NL = String.fromCharCode(10);
const argv = process.argv.slice(2);
const cmd = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'help';
if (!COMMANDS[cmd]) {
  console.error(`error: unknown command "${cmd}". Commands: ${Object.keys(COMMANDS).join(', ')}`);
  process.exit(2);
}
const [allowed, minPos, maxPos] = COMMANDS[cmd];
const { values: V, positionals: positional } = cli(import.meta.url, Object.fromEntries(allowed.map((k) => [k, ALL_FLAGS[k]])) as Spec as typeof ALL_FLAGS, {
  argv: argv.slice(cmd === argv[0] ? 1 : 0),
  minPositionals: minPos,
  maxPositionals: maxPos,
});
{
  const problem = cmd === 'analyze' ? analyzeFlagProblem(V) : undefined;
  if (problem) {
    console.error(`error: ${problem}\nRun with --help for usage.`);
    process.exit(2);
  }
}
const THREADS = Math.min(V.threads ?? 1, 16);
const runJobs = (jobs: MatchJob[], onResult?: (r: MatchResult) => void): Promise<MatchResult[]> => runPool(jobs, { threads: THREADS, onResult });

interface Pair {
  a: DeckList;
  b: DeckList;
}
function jobsFor(pairs: Pair[], games: number, bot: string, trace = false): MatchJob[] {
  const jobs: MatchJob[] = [];
  let seed = V.seed ?? 1;
  for (const { a, b } of pairs) for (let i = 0; i < games; i++) jobs.push({ a, b, seed: seed++, first: (i % 2) as 0 | 1, bot, trace });
  return jobs;
}

interface Tally {
  a: string;
  b: string;
  games: number;
  aWins: number;
  bWins: number;
  ties: number;
  aFirstWins: number;
  aFirstGames: number;
  aSecondWins: number;
  aSecondGames: number;
  /** wins by B when B went first / second (ties are credited to neither seat) */
  bFirstWins: number;
  bSecondWins: number;
  turns: number;
  overtime: number;
}
function tally(results: MatchResult[]): Map<string, Tally> {
  const m = new Map<string, Tally>();
  for (const r of results) {
    const key = `${r.a}|||${r.b}`;
    let t = m.get(key);
    if (!t) m.set(key, (t = { a: r.a, b: r.b, games: 0, aWins: 0, bWins: 0, ties: 0, aFirstWins: 0, aFirstGames: 0, aSecondWins: 0, aSecondGames: 0, bFirstWins: 0, bSecondWins: 0, turns: 0, overtime: 0 }));
    t.games++;
    t.turns += r.turns;
    if (r.overtime) t.overtime++;
    if (r.winner === 0) t.aWins++;
    else if (r.winner === 1) t.bWins++;
    else t.ties++;
    if (r.first === 0) {
      t.aFirstGames++;
      if (r.winner === 0) t.aFirstWins++;
      if (r.winner === 1) t.bSecondWins++;
    } else {
      t.aSecondGames++;
      if (r.winner === 0) t.aSecondWins++;
      if (r.winner === 1) t.bFirstWins++;
    }
  }
  return m;
}
const pct = (x: number, n: number) => (n ? `${((100 * x) / n).toFixed(0)}%` : '—');
const wr = (t: Tally) => (t.aWins + 0.5 * t.ties) / Math.max(1, t.games);
/** Games won by whoever went first; ties count half for each seat. */
const firstSeatScore = (t: Tally) => t.aFirstWins + t.bFirstWins + 0.5 * t.ties;

function writeReport(name: string, data: any, md: string) {
  fs.mkdirSync('reports', { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  fs.writeFileSync(`reports/${name}-${stamp}.json`, JSON.stringify(data, null, 1));
  fs.writeFileSync(`reports/${name}-${stamp}.md`, md);
  fs.writeFileSync(`reports/${name}-latest.json`, JSON.stringify(data, null, 1));
  fs.writeFileSync(`reports/${name}-latest.md`, md);
  console.log(`\nSaved reports/${name}-latest.md (+ timestamped copy)`);
}

function makeRunManifest(purpose: RunManifest['purpose'], decks: LibraryDeck[], mode: string, gamesPerPair: number, games: number, trace = false, decisionTelemetry?: number): RunManifest {
  return gameRunManifest({ purpose, decks, fieldMode: mode, bot: V.bot ?? 'lookahead', seedBase: V.seed ?? 1, seatPolicy: 'alternate', plannedGames: games, gamesPerPair, trace, decisionTelemetry, simVersion: SIM_VERSION });
}

function fieldDecks(kind: string | undefined) {
  const lib = loadLibrary();
  // "leaderboard:N" = meta archetypes + the top N non-meta decks of the all-time season leaderboard
  if (kind?.startsWith('leaderboard:') && fs.existsSync('data/seasons/leaderboard.json')) {
    const n = +kind.split(':')[1];
    const lb = Object.values(JSON.parse(fs.readFileSync('data/seasons/leaderboard.json', 'utf8'))) as { name: string; metaW: number; metaG: number }[];
    const top = lb
      .filter((e) => e.metaG > 0 && !lib.find((d) => d.deck.name === e.name && d.kind === 'meta'))
      .sort((a, b) => (b.metaW + 30) / (b.metaG + 60) - (a.metaW + 30) / (a.metaG + 60))
      .slice(0, n)
      .map((e) => e.name);
    return [...lib.filter((d) => d.kind === 'meta'), ...lib.filter((d) => top.includes(d.deck.name))];
  }
  if (kind === 'all') return lib;
  if (kind === 'custom') return lib.filter((d) => d.kind === 'custom' || d.kind === 'original');
  return lib.filter((d) => d.kind === 'meta');
}

async function main() {
  const games = V.games ?? 0;
  const bot = V.bot ?? 'lookahead';
  switch (cmd) {
    case 'catalog': {
      const lib = loadLibrary();
      console.log('Decks in data/decks (use file name or a fragment):\n');
      for (const d of lib) {
        const v = validateDeck(d.deck);
        console.log(
          `${d.kind.padEnd(8)} ${deckColors(d.deck).padEnd(4)} ${d.file.padEnd(46)} ${d.deck.name.slice(0, 40).padEnd(40)} ${shortCredit(d)}${d.tier ? `  [tier ${d.tier}]` : ''}${v.length ? '  (!) ' + v[0] : ''}`,
        );
      }
      return;
    }
    case 'show': {
      const d = resolveDeck(positional[0]);
      console.log(exportOfficial(d.deck));
      const v = validateDeck(d.deck);
      console.log(v.length ? '\nProblems:\n- ' + v.join('\n- ') : '\nDeck is legal.');
      return;
    }
    case 'add': {
      const src = positional[0];
      const text = src === '-' || !src ? fs.readFileSync(0, 'utf8') : fs.readFileSync(src, 'utf8');
      const { deck, errors } = parseDeck(text, V.name ?? (src && src !== '-' ? path.basename(src, '.txt') : 'Custom deck'));
      if (V.name) deck.name = V.name;
      const slug = slugify(deck.name, 50);
      if (!slug) throw new Error(`deck name "${deck.name}" gives an empty file name; pass --name`);
      const file = `data/decks/custom/${slug}.txt`;
      const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (prev !== null && !V.force) {
        console.error(`error: ${file} already exists. Pass --force to replace its list (its provenance header is kept), or --name to save it under another name.`);
        process.exit(1);
      }
      fs.mkdirSync('data/decks/custom', { recursive: true });
      const out = exportOfficial(deck) + (deck.sideboard.length ? '\n\n// Sideboard\n' + [...new Set(deck.sideboard)].map((id) => `${deck.sideboard.filter((x) => x === id).length} ${cardLabel(CARD_BY_ID[id])}`).join('\n') : '') + '\n';
      fs.writeFileSync(file, mergeProvenance(out, prev));
      console.log(`${prev !== null ? 'Replaced' : 'Saved'} ${file}`);
      if (errors.length) console.log('Unrecognized lines:\n- ' + errors.join('\n- '));
      const v = validateDeck(deck);
      console.log(v.length ? 'Problems:\n- ' + v.join('\n- ') : 'Deck is legal.');
      return;
    }
    case 'vs': {
      const A = resolveDeck(positional[0]);
      const B = resolveDeck(positional[1]);
      const n = games || 200;
      console.log(`${A.deck.name}  vs  ${B.deck.name}   (${n} games, ${THREADS} threads, bot=${bot})`);
      const res = await runJobs(jobsFor([{ a: A.deck, b: B.deck }], n, bot));
      const manifest = makeRunManifest('matchup', [A, B], 'head-to-head', n, res.length);
      const t = [...tally(res).values()][0];
      const md = [
        `# ${A.deck.name} vs ${B.deck.name}`,
        '',
        `| | ${A.deck.name} | ${B.deck.name} | ties |`,
        '|---|---|---|---|',
        `| wins | ${t.aWins} (${pct(t.aWins, t.games)}) | ${t.bWins} (${pct(t.bWins, t.games)}) | ${t.ties} |`,
        `| ${A.deck.name} on the play | ${pct(t.aFirstWins, t.aFirstGames)} | | |`,
        `| ${A.deck.name} on the draw | ${pct(t.aSecondWins, t.aSecondGames)} | | |`,
        '',
        `Average length ${(t.turns / t.games).toFixed(1)} turns; overtime in ${pct(t.overtime, t.games)} of games.`,
      ].join('\n');
      console.log('\n' + md);
      writeReport(`vs-${A.file.replace('.txt', '')}-${B.file.replace('.txt', '')}`, { ...t, manifest }, md);
      return;
    }
    case 'test': {
      const A = resolveDeck(positional[0]);
      const field = fieldDecks(V.field).filter((d) => d.file !== A.file);
      const n = games || 100;
      console.log(`Testing ${A.deck.name} against ${field.length} decks × ${n} games`);
      const res = await runJobs(jobsFor(field.map((f) => ({ a: A.deck, b: f.deck })), n, bot));
      const manifest = makeRunManifest('matchup', [A, ...field], V.field ?? 'meta', n, res.length);
      const rows = [...tally(res).values()].sort((x, y) => wr(y) - wr(x));
      const all = rows.reduce((a, t) => a + t.aWins + 0.5 * t.ties, 0) / rows.reduce((a, t) => a + t.games, 0);
      const md = [
        `# ${A.deck.name} — gauntlet`,
        '',
        `Overall win rate: **${(all * 100).toFixed(1)}%** over ${rows.reduce((a, t) => a + t.games, 0)} games.`,
        '',
        '| Opponent | Win% | On play | On draw | Avg turns |',
        '|---|---|---|---|---|',
        ...rows.map((t) => `| ${t.b} | ${(wr(t) * 100).toFixed(0)}% | ${pct(t.aFirstWins, t.aFirstGames)} | ${pct(t.aSecondWins, t.aSecondGames)} | ${(t.turns / t.games).toFixed(1)} |`),
      ].join('\n');
      console.log('\n' + md);
      writeReport(`test-${A.file.replace('.txt', '')}`, { deck: A.deck.name, date: new Date().toISOString(), games: n, bot, seed: V.seed, overall: all, rows, manifest }, md);
      return;
    }
    case 'review': {
      const field = fieldDecks(V.field);
      const n = games || 60;
      const pairs: Pair[] = [];
      for (let i = 0; i < field.length; i++) for (let j = i + 1; j < field.length; j++) pairs.push({ a: field[i].deck, b: field[j].deck });
      console.log(`Round robin: ${field.length} decks, ${pairs.length} pairings × ${n} games = ${pairs.length * n} games (${THREADS} threads)`);
      const res = await runJobs(jobsFor(pairs, n, bot));
      const manifest = makeRunManifest('analysis', field, V.field ?? 'meta', n, res.length);
      const t = tally(res);
      const names = field.map((f) => f.deck.name);
      const M: Record<string, Record<string, number>> = {};
      const totals: Record<string, { w: number; g: number }> = {};
      for (const nm of names) {
        M[nm] = {};
        totals[nm] = { w: 0, g: 0 };
      }
      let firstWins = 0;
      let allGames = 0;
      for (const x of t.values()) {
        const r = wr(x);
        M[x.a][x.b] = r;
        M[x.b][x.a] = 1 - r;
        totals[x.a].w += x.aWins + 0.5 * x.ties;
        totals[x.a].g += x.games;
        totals[x.b].w += x.bWins + 0.5 * x.ties;
        totals[x.b].g += x.games;
        firstWins += firstSeatScore(x);
        allGames += x.games;
      }
      const ranked = [...names].sort((a, b) => totals[b].w / totals[b].g - totals[a].w / totals[a].g);
      const short = (s: string) => s.slice(0, 14);
      const md = [
        `# Matchup review (${new Date().toISOString().slice(0, 10)})`,
        '',
        `${field.length} decks, ${n} games per pairing (half on the play, half on the draw), bot: ${bot}.`,
        '',
        '## Rankings',
        '',
        '| # | Deck | Win% | Games |',
        '|---|---|---|---|',
        ...ranked.map((nm, i) => `| ${i + 1} | ${nm} | ${((100 * totals[nm].w) / totals[nm].g).toFixed(1)}% | ${totals[nm].g} |`),
        '',
        '## Matrix (row deck win% vs column deck)',
        '',
        `| | ${ranked.map(short).join(' | ')} |`,
        `|---|${ranked.map(() => '---').join('|')}|`,
        ...ranked.map((r) => `| ${short(r)} | ${ranked.map((c) => (r === c ? '—' : M[r][c] === undefined ? '' : `${Math.round(M[r][c] * 100)}`)).join(' | ')} |`),
        '',
        `Going first won about ${pct(firstWins, allGames)} of games.`,
      ].join('\n');
      console.log('\n' + md);
      const reviewData = { date: new Date().toISOString(), games: n, bot, field: V.field ?? 'meta', manifest, decks: ranked.map((nm) => ({ name: nm, file: field.find((f) => f.deck.name === nm)!.file, winRate: totals[nm].w / totals[nm].g, games: totals[nm].g })), matrix: M, firstPlayerWinRate: firstWins / allGames };
      fs.writeFileSync('src/data/review.json', JSON.stringify(reviewData, null, 1));
      writeReport('review', { ...reviewData, decks: ranked.map((nm) => ({ name: nm, winRate: totals[nm].w / totals[nm].g, games: totals[nm].g })) }, md);
      return;
    }
    case 'analyze': {
      const field = fieldDecks(V.field);
      const n = games || 40;
      const pairs: Pair[] = [];
      const focus = V.deck ? resolveDeck(V.deck) : null;
      if (focus) for (const f of field) { if (f.deck.name !== focus.deck.name) pairs.push({ a: focus.deck, b: f.deck }); }
      else for (let i = 0; i < field.length; i++) for (let j = i + 1; j < field.length; j++) pairs.push({ a: field[i].deck, b: field[j].deck });
      const runDecks = focus ? [focus, ...field.filter((f) => f.deck.name !== focus.deck.name)] : field;
      const out = analyzeOutputs(V, focus ? focus.file.replace('.txt', '') : null);
      // refuse before playing anything
      const clash = protectedOutputs(out, V).filter((f) => fs.existsSync(f));
      if (clash.length && !V.force) throw new Refusal(`${clash.join(', ')} already exist${clash.length === 1 ? 's' : ''}. Pass --force to replace ${clash.length === 1 ? 'it' : 'them'}${V.out ? ', or choose another --out directory' : ''}.`);
      // telemetry is grouped by deck name, and each report records the fingerprint of the list it measured (card impact
      // is looked up by it), so one name must mean one list in a run
      const listOf = new Map<string, string>();
      for (const d of runDecks) {
        const id = listFingerprint(d.deck);
        if (listOf.has(d.deck.name) && listOf.get(d.deck.name) !== id) throw new Error(`two different lists are named "${d.deck.name}" in this field; rename one before analysing`);
        listOf.set(d.deck.name, id);
      }
      const synergies = wantsSynergies(V);
      const only = !!V['synergies-only'];
      console.log(`Telemetry run: ${pairs.length} pairings × ${n} games (bot=${bot})${V.decisions ? ', with decision telemetry' : ''}${synergies ? `, observing synergy packages${only ? ' (synergy report only)' : ''}` : ''}`);
      // --synergies-only needs no per-card trace (the trace only observes; the games are the same either way)
      const jobs = jobsFor(pairs, n, bot, !only);
      const samples = V['decision-samples'] ?? 0;
      if (V.decisions) jobs.forEach((j, k) => Object.assign(j, { decisions: true, rawDecisions: k < samples }));
      if (synergies) jobs.forEach((j) => Object.assign(j, { synergies: true }));
      // decision and synergy aggregates are folded in as games finish and dropped from the results, so memory stays flat
      const { emptyAggregate, mergeAggregates } = await import('../src/analysis/decisions');
      const { emptySynergyAggregate, mergeSynergyAggregates } = await import('../src/analysis/synergies');
      let decisionAgg = emptyAggregate();
      let synergyAgg = emptySynergyAggregate();
      const size = { records: 0, rawBytes: 0, aggregateBytes: 0, games: 0 };
      const synSize = { games: 0, boards: 0, sightings: 0, rawBytes: 0, aggregateBytes: 0 };
      const sampleGames: unknown[] = [];
      const t0 = Date.now();
      const res = await runJobs(jobs, (r) => {
        if (r.synergies) {
          synergyAgg = mergeSynergyAggregates(synergyAgg, r.synergies);
          if (r.synergySize) {
            synSize.games++;
            synSize.boards += r.synergySize.boards;
            synSize.sightings += r.synergySize.sightings;
            synSize.rawBytes += r.synergySize.rawBytes;
            synSize.aggregateBytes += r.synergySize.aggregateBytes;
          }
          delete r.synergies;
        }
        if (!r.decisions) return;
        decisionAgg = mergeAggregates(decisionAgg, r.decisions);
        if (r.decisionSize) {
          size.games++;
          size.records += r.decisionSize.records;
          size.rawBytes += r.decisionSize.rawBytes;
          size.aggregateBytes += r.decisionSize.aggregateBytes;
        }
        if (r.decisionRecords) sampleGames.push({ a: r.a, b: r.b, seed: r.seed, first: r.first, winner: r.winner, turns: r.turns, records: r.decisionRecords });
        delete r.decisions;
        delete r.decisionRecords;
      });
      const seconds = (Date.now() - t0) / 1000;
      const { DECISION_TELEMETRY_SCHEMA } = await import('../src/engine/telemetry');
      const manifest = makeRunManifest('analysis', runDecks, focus?.file ?? V.field ?? 'meta', n, res.length, !only, V.decisions || synergies ? DECISION_TELEMETRY_SCHEMA : undefined);
      const write = (file: string, text: string) => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
      };
      if (synergies) {
        const { synergyMarkdown, synergyReport } = await import('../src/analysis/synergies');
        const g = Math.max(1, synSize.games);
        const measurements = {
          games: synSize.games,
          boardSnapshotsPerGame: synSize.boards / g,
          sightingsPerGame: synSize.sightings / g,
          rawBytesPerGame: synSize.rawBytes / g,
          aggregateBytesPerGame: synSize.aggregateBytes / g,
          mergedBytes: JSON.stringify(synergyAgg).length,
          seconds,
        };
        const report = synergyReport(synergyAgg, { manifest, measurements });
        write(out.synergiesJson!, JSON.stringify(report, null, 1));
        write(out.synergiesMd!, synergyMarkdown(report));
        // the site copy: compact, rates to 4 decimals (the page shows whole percents)
        if (out.synergiesSite) write(out.synergiesSite, JSON.stringify(report, (_k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e4) / 1e4 : v)));
        console.log(
          `Synergies: ${report.pooled.length} packages over ${synSize.games} games; ${measurements.boardSnapshotsPerGame.toFixed(0)} board snapshots/game, ` +
            `${(measurements.rawBytesPerGame / 1024).toFixed(1)} KB raw vs ${(measurements.aggregateBytesPerGame / 1024).toFixed(1)} KB aggregated per game. ` +
            `Saved ${[out.synergiesMd, out.synergiesSite].filter(Boolean).join(', ')}`,
        );
      }
      if (only) {
        console.log(`${NL}Synergy report only: no analysis, review, impact or decisions file was written.`);
        return;
      }
      const sums = res.flatMap((r) => r.summaries ?? []);
      const { analyzeAll, reportMarkdown } = await import('../src/analysis/analyze');
      let reps = analyzeAll(sums).map((r) => (listOf.has(r.deck) ? { ...r, id: listOf.get(r.deck) } : r));
      if (focus) reps = reps.filter((r) => r.deck === focus.deck.name);
      const md = reportMarkdown(reps);
      write(out.analysisMd!, md);
      write(out.analysisJson!, JSON.stringify({ manifest, decks: reps }, null, 1));
      if (V.decisions) {
        const { decisionMarkdown, decisionReport } = await import('../src/analysis/decisions');
        const g = Math.max(1, size.games);
        const measurements = { games: size.games, recordsPerGame: size.records / g, rawBytesPerGame: size.rawBytes / g, aggregateBytesPerGame: size.aggregateBytes / g, mergedBytes: JSON.stringify(decisionAgg).length, seconds };
        const report = decisionReport(decisionAgg, { manifest, measurements });
        const dmd = decisionMarkdown(report);
        write(out.decisionsJson!, JSON.stringify(report, null, 1));
        write(out.decisionsMd!, dmd);
        if (out.decisionsSite) write(out.decisionsSite, JSON.stringify(report));
        if (out.decisionSamples) write(out.decisionSamples, JSON.stringify({ telemetrySchema: DECISION_TELEMETRY_SCHEMA, manifest, games: sampleGames }, null, 1));
        console.log(
          `Decision telemetry: ${size.records} records over ${size.games} games (${measurements.recordsPerGame.toFixed(0)}/game); ` +
            `${(measurements.rawBytesPerGame / 1024).toFixed(1)} KB raw vs ${(measurements.aggregateBytesPerGame / 1024).toFixed(1)} KB aggregated per game; ` +
            `merged aggregate ${(measurements.mergedBytes / 1024).toFixed(1)} KB. Saved ${[out.decisionsMd, out.decisionsSite, out.decisionSamples].filter(Boolean).join(', ')}`,
        );
      }
      if (!focus) {
        // rankings + matrix from the same games (same format as `review`)
        const t = tally(res);
        const names = field.map((f) => f.deck.name);
        const M: Record<string, Record<string, number>> = Object.fromEntries(names.map((x) => [x, {}]));
        const tot: Record<string, { w: number; g: number }> = Object.fromEntries(names.map((x) => [x, { w: 0, g: 0 }]));
        let fw = 0;
        let ag = 0;
        for (const x of t.values()) {
          M[x.a][x.b] = wr(x);
          M[x.b][x.a] = 1 - wr(x);
          tot[x.a].w += x.aWins + 0.5 * x.ties;
          tot[x.a].g += x.games;
          tot[x.b].w += x.bWins + 0.5 * x.ties;
          tot[x.b].g += x.games;
          fw += firstSeatScore(x);
          ag += x.games;
        }
        const ranked = [...names].sort((a, b) => tot[b].w / tot[b].g - tot[a].w / tot[a].g);
        write(
          out.review!,
          JSON.stringify({ date: new Date().toISOString(), games: n, bot, field: V.field ?? 'meta', manifest, decks: ranked.map((nm) => ({ name: nm, file: field.find((f) => f.deck.name === nm)!.file, winRate: tot[nm].w / tot[nm].g, games: tot[nm].g })), matrix: M, firstPlayerWinRate: fw / ag }, null, 1),
        );
        // trimmed copy for the web app
        const trimmed = reps.map((r) => ({ ...r, cards: r.cards.slice(0, 40) }));
        write(out.analysisSite!, JSON.stringify({ date: new Date().toISOString(), games: n, bot, manifest, decks: trimmed }));
        // slim id/IWD/seenGames copy for the bots and the Deck Lab (src/ai/impact.ts); always written with analysis.json
        write(out.impact!, JSON.stringify(toImpactData(trimmed)));
      }
      console.log(md.split(NL).slice(0, 60).join(NL));
      console.log(`${NL}Saved ${out.analysisMd}`);
      return;
    }
    default:
      console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  }
}

runMain(main);
