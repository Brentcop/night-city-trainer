// Tournament series from the CLI. Same rules, bots and seeds as the in-browser runner (src/lib/tournament.ts),
// so events recorded here replay exactly on the site.
//
//   npx tsx scripts/tournament.ts [--events 12] [--start 1] [--field all] [--rounds auto] [--top 8] [--bo 3] [--bot deep] [--threads N]
//
//   --field   all | meta | ladder | original | guide | top16 | a comma list of deck files/names (e.g. meta-rry-smasher-aggro,s2-08-explorer-rrg)
//   --rounds  number of Swiss rounds, or auto (log2 of the field, plus a few)
//   --top     top-cut size (0 = none; rounded down to a power of two that fits the field)
//   --bo      1 or 3 games per match
//   --bot     hard | mixed | medium | easy   (older names fast | lookahead | deep still work)
//   --record  false to skip writing the site's event history (quick experiments)
//
// Outputs: data/tournaments/event-<n>.json (also public/tournaments/ for the site) and the index src/data/tournaments.json.
import fs from 'node:fs';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { loadLibrary, resolveDeck } from './lib-node';
import { autoRounds, cutSize, runTournament, type BotLevel, type GameRec, type PlayGame, type TourneyEvent } from '../src/lib/tournament';
import type { MatchJob, MatchResult } from './worker';
import type { LibraryDeck } from '../src/lib/library';

const args = process.argv.slice(2);
const flag = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const EVENTS = +flag('events', '12');
const START = +flag('start', '1');
const TOP = +flag('top', '8');
const BO = flag('bo', '3') === '1' ? 1 : 3;
const BOT = flag('bot', 'hard') as BotLevel;
const FIELD = flag('field', 'all');
const RECORD = flag('record', 'true') !== 'false';
const THREADS = Math.max(1, Math.min(+flag('threads', String(os.cpus().length - 1)), 16));

// ---------------------------------------------------------------- field
function distinct(lib: LibraryDeck[]) {
  const seen = new Set<string>();
  return lib.filter((d) => {
    if (/-eor\.txt$/.test(d.file)) return false; // tournament builds share the base list's main deck
    const sig = [...d.deck.legends].sort().join(',') + '|' + [...d.deck.main].sort().join(',');
    if (seen.has(sig) || seen.has(`n:${d.deck.name}`)) return false;
    seen.add(sig);
    seen.add(`n:${d.deck.name}`);
    return true;
  });
}
function pickField(): LibraryDeck[] {
  const all = distinct(loadLibrary());
  if (FIELD === 'all') return all;
  if (['meta', 'ladder', 'original', 'guide'].includes(FIELD)) return all.filter((d) => d.kind === FIELD);
  if (FIELD === 'top16') {
    const R = fs.existsSync('src/data/ratings.json') ? JSON.parse(fs.readFileSync('src/data/ratings.json', 'utf8')) : { decks: [] };
    return (R.decks as { name: string }[])
      .map((r) => all.find((d) => d.deck.name === r.name))
      .filter((d): d is LibraryDeck => !!d)
      .slice(0, 16);
  }
  return FIELD.split(',').map((x) => {
    const d = all.find((y) => y.file === x || y.file === `${x}.txt` || y.deck.name === x) ?? resolveDeck(x);
    if (!d) throw new Error(`unknown deck: ${x}`);
    return d as LibraryDeck;
  });
}
const field = pickField();
const ROUNDS = flag('rounds', 'auto') === 'auto' ? autoRounds(field.length) : +flag('rounds', '0');

// ---------------------------------------------------------------- persistent worker pool, one game per message
function nodePool(size: number) {
  const idle: Worker[] = [];
  const all: Worker[] = [];
  const queue: { job: MatchJob; res: (r: GameRec) => void }[] = [];
  const pending = new Map<Worker, (r: GameRec) => void>();
  let done = 0;
  const pump = () => {
    while (idle.length && queue.length) {
      const w = idle.pop()!;
      const { job, res } = queue.shift()!;
      pending.set(w, res);
      w.postMessage(job);
    }
  };
  for (let i = 0; i < size; i++) {
    const w = new Worker(new URL('./worker-boot.mjs', import.meta.url));
    w.on('message', (r: MatchResult) => {
      const res = pending.get(w)!;
      pending.delete(w);
      idle.push(w);
      if (r.error) process.stderr.write(`\n  game error (seed ${r.seed}): ${r.error.slice(0, 200)}\n`);
      if (++done % 25 === 0) process.stderr.write(`\r  ${done} games`);
      res({ seed: r.seed, first: r.first, winner: r.winner === null ? 'tie' : r.winner, turns: r.turns, reason: r.reason });
      pump();
    });
    all.push(w);
    idle.push(w);
  }
  const play: PlayGame = (job) => new Promise((res) => (queue.push({ job: { ...job, bot: job.bot }, res }), pump()));
  return { play, close: () => all.forEach((w) => w.terminate()) };
}

// ---------------------------------------------------------------- outputs
function writeEvent(ev: TourneyEvent) {
  fs.mkdirSync('data/tournaments', { recursive: true });
  fs.mkdirSync('public/tournaments', { recursive: true });
  const json = JSON.stringify(ev);
  fs.writeFileSync(`data/tournaments/event-${ev.id}.json`, json);
  fs.writeFileSync(`public/tournaments/event-${ev.id}.json`, json);
}
function writeIndex() {
  const files = fs.readdirSync('data/tournaments').filter((f) => /^event-\d+\.json$/.test(f));
  const count = (parts: { matches: { games: unknown[] }[] }[]) => parts.reduce((a, r) => a + r.matches.reduce((b, m) => b + m.games.length, 0), 0);
  const events = files
    .map((f) => JSON.parse(fs.readFileSync(`data/tournaments/${f}`, 'utf8')))
    .sort((a, b) => a.id - b.id)
    .map((e) => ({
      id: e.id,
      date: e.date,
      bot: e.bot,
      format: e.format,
      champion: e.champion,
      entrants: Object.keys(e.decks).length,
      games: count(e.rounds) + count(e.bracket),
      top8: e.standings.slice(0, e.seeds?.length ?? 8).map((s: any) => ({ deck: s.deck, mp: s.mp, record: `${s.mw}-${s.ml}`, omw: s.omw })),
      bracket: e.bracket.map((r: any) => ({ name: r.name, matches: r.matches.map((m: any) => ({ a: m.a, b: m.b, score: m.score, winner: m.winner })) })),
      standings: e.standings.map((s: any) => ({ deck: s.deck, mp: s.mp, record: `${s.mw}-${s.ml}`, games: `${s.gw}-${s.gl}`, omw: +s.omw.toFixed(3) })),
    }));
  fs.writeFileSync('src/data/tournaments.json', JSON.stringify({ updated: new Date().toISOString(), events }));
}

async function main() {
  console.log(`Tournament series: ${EVENTS} events × ${field.length} decks (${FIELD}), Swiss ${ROUNDS} rounds Bo${BO}${cutSize(TOP, field.length) ? ` + top ${cutSize(TOP, field.length)}` : ''} (${BOT} bot, ${THREADS} threads)`);
  const pool = nodePool(THREADS);
  const decks = field.map((d) => ({ ...d.deck, file: d.file }));
  for (let n = START; n < START + EVENTS; n++) {
    const ev = await runTournament(decks, { name: `Event #${n}`, rounds: ROUNDS, top: TOP, bestOf: BO, bot: BOT, seed: n }, pool.play, { id: n });
    process.stderr.write('\n');
    console.log(`Event ${n}: champion ${ev.champion}; top cut: ${(ev.seeds ?? []).join(' | ')}`);
    if (RECORD) {
      writeEvent(ev);
      writeIndex();
    }
  }
  pool.close();
}
main();
