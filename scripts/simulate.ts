// Deck matchup lab (CLI).
//
//   npm run sim -- catalog                         list decks in the library
//   npm run sim -- vs <deckA> <deckB> [--games 200]   head-to-head
//   npm run sim -- test <deck> [--games 100]          one deck vs every meta deck (or --field all)
//   npm run sim -- review [--games 60] [--field meta|all]   full round-robin matrix + rankings
//   npm run sim -- add <file.txt|-> [--name X]        import a deck list (choom.gg / official / sim JSON) into data/decks/custom
//   npm run sim -- show <deck>                        print a deck with validation
//   npm run sim -- analyze [--field meta|all] [--games 40] [--deck X]   telemetry analysis -> reports/analysis-latest.md + src/data/analysis.json
//
// Decks are matched by file name or deck name fragment (e.g. "rry", "meta-bbg", "Smash the Curve"),
// or by a path to a deck text file. Results are written to reports/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { exportOfficial, parseDeck, validateDeck, deckColors } from '../src/engine/deck';
import { CARD_BY_ID, cardLabel } from '../src/engine/cards';
import type { DeckList } from '../src/engine/types';
import { loadLibrary, resolveDeck } from './lib-node';
import { shortCredit } from '../src/lib/library';
import type { MatchJob, MatchResult } from './worker';

const args = process.argv.slice(2);
const cmd = args[0] ?? 'help';
const flag = (name: string, def?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const positional = args.slice(1).filter((a, i, arr) => !a.startsWith('--') && !(i > 0 && arr[i - 1].startsWith('--')));

const NL = String.fromCharCode(10);
const THREADS = Math.max(1, Math.min(+(flag('threads') ?? os.cpus().length - 1), 16));

export async function runJobs(jobs: MatchJob[]): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  let next = 0;
  let done = 0;
  const total = jobs.length;
  const t0 = Date.now();
  await new Promise<void>((resolve, reject) => {
    const workers: Worker[] = [];
    const n = Math.min(THREADS, jobs.length);
    if (!n) return resolve();
    for (let k = 0; k < n; k++) {
      const w = new Worker(new URL('./worker-boot.mjs', import.meta.url));
      workers.push(w);
      const feed = () => {
        if (next < jobs.length) w.postMessage(jobs[next++]);
        else {
          w.terminate();
          if (workers.every((x) => (x as any).__done || x === w)) resolve();
          (w as any).__done = true;
        }
      };
      w.on('message', (r: MatchResult) => {
        results.push(r);
        done++;
        if (done % 10 === 0 || done === total) process.stderr.write(`\r  ${done}/${total} games  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        feed();
      });
      w.on('error', reject);
      feed();
    }
  });
  process.stderr.write('\n');
  return results;
}

interface Pair {
  a: DeckList;
  b: DeckList;
}
function jobsFor(pairs: Pair[], games: number, bot: string, trace = false): MatchJob[] {
  const jobs: MatchJob[] = [];
  let seed = +(flag('seed') ?? 1);
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
  turns: number;
  overtime: number;
}
function tally(results: MatchResult[]): Map<string, Tally> {
  const m = new Map<string, Tally>();
  for (const r of results) {
    const key = `${r.a}|||${r.b}`;
    let t = m.get(key);
    if (!t) m.set(key, (t = { a: r.a, b: r.b, games: 0, aWins: 0, bWins: 0, ties: 0, aFirstWins: 0, aFirstGames: 0, aSecondWins: 0, aSecondGames: 0, turns: 0, overtime: 0 }));
    t.games++;
    t.turns += r.turns;
    if (r.overtime) t.overtime++;
    if (r.winner === 0) t.aWins++;
    else if (r.winner === 1) t.bWins++;
    else t.ties++;
    if (r.first === 0) {
      t.aFirstGames++;
      if (r.winner === 0) t.aFirstWins++;
    } else {
      t.aSecondGames++;
      if (r.winner === 0) t.aSecondWins++;
    }
  }
  return m;
}
const pct = (x: number, n: number) => (n ? `${((100 * x) / n).toFixed(0)}%` : '—');
const wr = (t: Tally) => (t.aWins + 0.5 * t.ties) / Math.max(1, t.games);

function writeReport(name: string, data: any, md: string) {
  fs.mkdirSync('reports', { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  fs.writeFileSync(`reports/${name}-${stamp}.json`, JSON.stringify(data, null, 1));
  fs.writeFileSync(`reports/${name}-${stamp}.md`, md);
  fs.writeFileSync(`reports/${name}-latest.json`, JSON.stringify(data, null, 1));
  fs.writeFileSync(`reports/${name}-latest.md`, md);
  console.log(`\nSaved reports/${name}-latest.md (+ timestamped copy)`);
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
  const games = +(flag('games') ?? 0);
  const bot = flag('bot', 'lookahead')!;
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
      const { deck, errors } = parseDeck(text, flag('name') ?? (src ? path.basename(src, '.txt') : 'Custom deck'));
      if (flag('name')) deck.name = flag('name')!;
      const slug = deck.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
      fs.mkdirSync('data/decks/custom', { recursive: true });
      const file = `data/decks/custom/${slug}.txt`;
      fs.writeFileSync(file, exportOfficial(deck) + (deck.sideboard.length ? '\n\n// Sideboard\n' + [...new Set(deck.sideboard)].map((id) => `${deck.sideboard.filter((x) => x === id).length} ${cardLabel(CARD_BY_ID[id])}`).join('\n') : '') + '\n');
      console.log(`Saved ${file}`);
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
      writeReport(`vs-${A.file.replace('.txt', '')}-${B.file.replace('.txt', '')}`, t, md);
      return;
    }
    case 'test': {
      const A = resolveDeck(positional[0]);
      const field = fieldDecks(flag('field')).filter((d) => d.file !== A.file);
      const n = games || 100;
      console.log(`Testing ${A.deck.name} against ${field.length} decks × ${n} games`);
      const res = await runJobs(jobsFor(field.map((f) => ({ a: A.deck, b: f.deck })), n, bot));
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
      writeReport(`test-${A.file.replace('.txt', '')}`, { deck: A.deck.name, overall: all, rows }, md);
      return;
    }
    case 'review': {
      const field = fieldDecks(flag('field'));
      const n = games || 60;
      const pairs: Pair[] = [];
      for (let i = 0; i < field.length; i++) for (let j = i + 1; j < field.length; j++) pairs.push({ a: field[i].deck, b: field[j].deck });
      console.log(`Round robin: ${field.length} decks, ${pairs.length} pairings × ${n} games = ${pairs.length * n} games (${THREADS} threads)`);
      const res = await runJobs(jobsFor(pairs, n, bot));
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
        firstWins += x.aFirstWins + (x.aSecondGames - x.aSecondWins - 0);
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
      const reviewData = { date: new Date().toISOString(), games: n, bot, field: flag('field') ?? 'meta', decks: ranked.map((nm) => ({ name: nm, file: field.find((f) => f.deck.name === nm)!.file, winRate: totals[nm].w / totals[nm].g, games: totals[nm].g })), matrix: M, firstPlayerWinRate: firstWins / allGames };
      fs.writeFileSync('src/data/review.json', JSON.stringify(reviewData, null, 1));
      writeReport('review', { date: new Date().toISOString(), games: n, bot, decks: ranked.map((nm) => ({ name: nm, winRate: totals[nm].w / totals[nm].g, games: totals[nm].g })), matrix: M, firstPlayerWinRate: firstWins / allGames }, md);
      return;
    }
    case 'analyze': {
      const field = fieldDecks(flag('field'));
      const n = games || 40;
      const pairs: Pair[] = [];
      const focus = flag('deck') ? resolveDeck(flag('deck')!) : null;
      if (focus) for (const f of field) { if (f.deck.name !== focus.deck.name) pairs.push({ a: focus.deck, b: f.deck }); }
      else for (let i = 0; i < field.length; i++) for (let j = i + 1; j < field.length; j++) pairs.push({ a: field[i].deck, b: field[j].deck });
      console.log(`Telemetry run: ${pairs.length} pairings × ${n} games (bot=${bot})`);
      const res = await runJobs(jobsFor(pairs, n, bot, true));
      const sums = res.flatMap((r) => r.summaries ?? []);
      const { analyzeAll, reportMarkdown } = await import('../src/analysis/analyze');
      let reps = analyzeAll(sums);
      if (focus) reps = reps.filter((r) => r.deck === focus.deck.name);
      const md = reportMarkdown(reps);
      fs.mkdirSync('reports', { recursive: true });
      fs.writeFileSync(`reports/analysis${focus ? '-' + focus.file.replace('.txt', '') : ''}-latest.md`, md);
      fs.writeFileSync(`reports/analysis${focus ? '-' + focus.file.replace('.txt', '') : ''}-latest.json`, JSON.stringify(reps, null, 1));
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
          fw += x.aFirstWins + (x.aSecondGames - x.aSecondWins);
          ag += x.games;
        }
        const ranked = [...names].sort((a, b) => tot[b].w / tot[b].g - tot[a].w / tot[a].g);
        fs.writeFileSync(
          'src/data/review.json',
          JSON.stringify({ date: new Date().toISOString(), games: n, bot, field: flag('field') ?? 'meta', decks: ranked.map((nm) => ({ name: nm, file: field.find((f) => f.deck.name === nm)!.file, winRate: tot[nm].w / tot[nm].g, games: tot[nm].g })), matrix: M, firstPlayerWinRate: fw / ag }, null, 1),
        );
        // trimmed copy for the web app
        const trimmed = reps.map((r) => ({ ...r, cards: r.cards.slice(0, 40) }));
        fs.writeFileSync('src/data/analysis.json', JSON.stringify({ date: new Date().toISOString(), games: n, bot, decks: trimmed }));
      }
      console.log(md.split(NL).slice(0, 60).join(NL));
      console.log(`${NL}Saved reports/analysis${focus ? '-' + focus.file.replace('.txt', '') : ''}-latest.md`);
      return;
    }
    default:
      console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  }
}

if (/simulate.ts$/.test(process.argv[1] ?? '')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
