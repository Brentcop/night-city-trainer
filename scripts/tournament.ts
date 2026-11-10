// Tournament series from the CLI. Same rules, bots and seeds as the in-browser runner (src/lib/tournament.ts),
// so events recorded here replay exactly on the site while the code is at the same SIM_VERSION.
//
//   npx tsx scripts/tournament.ts [--events 12] [--start N] [--field all] [--rounds auto] [--top 8] [--bo 3] [--bot deep] [--threads N] [--force]
//
//   --start   id of the first event (default: one past the highest recorded event). The event id is also its seed.
//   --force   allow overwriting events that are already recorded (otherwise the run refuses before playing anything)
//   --field   all | meta | ladder | original | guide | top16 | a comma list of deck files/names (e.g. meta-rry-smasher-aggro,s2-08-explorer-rrg)
//   --rounds  number of Swiss rounds, or auto (log2 of the field, plus a few)
//   --top     top-cut size (0 = none; rounded down to a power of two that fits the field)
//   --bo      1 or 3 games per match
//   --bot     hard | mixed | medium | easy   (older names fast | lookahead | deep | hard-v1 still work)
//   --record  false to skip writing the site's event history (quick experiments)
//
// A game that throws aborts the event (nothing is recorded for it) and the run exits 1; it is never scored as a tie.
// Outputs: public/tournaments/event-<n>.json (the one copy: the site fetches it and the scripts read it) and the index src/data/tournaments.json.
import fs from 'node:fs';
import { bool, cli, EVENTS_DIR, existing, int, loadLibrary, maxEventId, oneOf, readEvents, resolveDeck, str, threadsOpt, TIER_BOTS, workerPool, writeJsonStamped } from './lib-node';
import { autoRounds, cutSize, runTournament, type BotLevel, type PlayGame, type TourneyEvent } from '../src/lib/tournament';
import type { MatchJob, MatchResult } from './worker';
import type { LibraryDeck } from '../src/lib/library';
import { buildH2H } from './build-h2h';

const { values: V } = cli(import.meta.url, {
  events: int(12, { min: 1 }),
  start: int(undefined, { min: 1 }),
  top: int(8, { min: 0 }),
  bo: oneOf(['1', '3'], '3'),
  bot: oneOf(TIER_BOTS, 'hard'),
  field: str('all'),
  rounds: str('auto', (v) => (v === 'auto' || /^[1-9]\d*$/.test(v) ? undefined : `must be auto or a whole number ≥ 1, got "${v}"`)),
  record: oneOf(['true', 'false'], 'true'),
  threads: threadsOpt(),
  force: bool(),
});
const EVENTS = V.events;
const START = V.start ?? maxEventId(EVENTS_DIR) + 1;
const TOP = V.top;
const BO = V.bo === '1' ? 1 : 3;
const BOT = V.bot as BotLevel;
const FIELD = V.field;
const RECORD = V.record !== 'false';
const THREADS = Math.min(V.threads, 16);

// ---------------------------------------------------------------- refuse to overwrite recorded events
const planned = Array.from({ length: EVENTS }, (_, k) => START + k);
if (RECORD) {
  const clash = existing(planned.map((n) => `${EVENTS_DIR}/event-${n}.json`));
  if (clash.length && !V.force) {
    console.error(`error: these events are already recorded: ${clash.join(', ')}.\nLeave out --start to continue after event ${maxEventId(EVENTS_DIR)}, or pass --force to overwrite them.`);
    process.exit(1);
  }
  if (clash.length) console.log(`--force: overwriting ${clash.length} recorded event file(s)`);
}

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
  return FIELD.split(',').map((x) => all.find((y) => y.file === x || y.file === `${x}.txt` || y.deck.name === x) ?? resolveDeck(x));
}
let field: LibraryDeck[];
try {
  field = pickField();
} catch (e) {
  console.error(`error: --field: ${(e as Error).message}`);
  process.exit(2);
}
if (field.length < 2) {
  console.error(`error: --field ${FIELD} gives ${field.length} deck(s); a tournament needs at least 2`);
  process.exit(2);
}
const ROUNDS = V.rounds === 'auto' ? autoRounds(field.length) : +V.rounds;

// ---------------------------------------------------------------- games: the shared worker pool, one game per message
class GameError extends Error {}
function nodePool(size: number) {
  const pool = workerPool<MatchJob, MatchResult>(new URL('./worker-boot.mjs', import.meta.url), size);
  let done = 0;
  const play: PlayGame = (job) =>
    pool.run({ ...job, bot: job.bot }).then((r) => {
      // an exception is an error, never a tie: abort the event so nothing biased is recorded
      if (r.error) throw new GameError(`game ${job.a.name} vs ${job.b.name} (seed ${r.seed}, first ${r.first}) threw:\n${r.error}`);
      if (++done % 25 === 0) process.stderr.write(`\r  ${done} games`);
      return { seed: r.seed, first: r.first, winner: r.winner === null ? 'tie' : r.winner, turns: r.turns, reason: r.reason };
    });
  return { play, close: () => pool.close() };
}

// ---------------------------------------------------------------- outputs
function writeEvent(ev: TourneyEvent) {
  fs.mkdirSync(EVENTS_DIR, { recursive: true });
  fs.writeFileSync(`${EVENTS_DIR}/event-${ev.id}.json`, JSON.stringify(ev));
}
function writeIndex() {
  const count = (parts: { matches: { games: unknown[] }[] }[]) => parts.reduce((a, r) => a + r.matches.reduce((b, m) => b + m.games.length, 0), 0);
  const events = readEvents(EVENTS_DIR)
    .sort((a, b) => a.id - b.id)
    .map((e: any) => ({
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
  writeJsonStamped('src/data/tournaments.json', { updated: '', events });
  buildH2H(); // keep the Deck Lab's head-to-head data (counter breeding) in step with the events
}

async function main() {
  console.log(`Tournament series: ${EVENTS} events × ${field.length} decks (${FIELD}), Swiss ${ROUNDS} rounds Bo${BO}${cutSize(TOP, field.length) ? ` + top ${cutSize(TOP, field.length)}` : ''} (${BOT} bot, ${THREADS} threads)`);
  console.log(`Event ids (= seeds): ${planned[0]}${planned.length > 1 ? `–${planned[planned.length - 1]}` : ''}${RECORD ? '' : ' (not recorded)'}`);
  const pool = nodePool(THREADS);
  const decks = field.map((d) => ({ ...d.deck, file: d.file }));
  for (const n of planned) {
    let ev: TourneyEvent;
    try {
      ev = await runTournament(decks, { name: `Event #${n}`, rounds: ROUNDS, top: TOP, bestOf: BO, bot: BOT, seed: n }, pool.play, { id: n });
    } catch (e) {
      console.error(`\nerror: event ${n} aborted, nothing recorded for it. ${e instanceof GameError ? e.message : String((e as Error)?.stack ?? e)}`);
      process.exit(1);
    }
    process.stderr.write('\n');
    console.log(`Event ${n}: champion ${ev.champion}; top cut: ${(ev.seeds ?? []).join(' | ')}`);
    if (RECORD) {
      writeEvent(ev);
      writeIndex();
    }
  }
  await pool.close();
}
main();
