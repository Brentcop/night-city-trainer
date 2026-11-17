// Tournament series from the CLI. Same rules, bots and seeds as the in-browser runner (src/lib/tournament.ts),
// so events recorded here replay exactly on the site while the code is at the same SIM_VERSION.
//
//   npx tsx scripts/tournament.ts [--events 12] [--start N] [--field all] [--rounds auto] [--top 8] [--bo 3] [--bot hard] [--threads N] [--force]
//
//   --start   id of the first event (default: one past the highest event recorded or archived in data/events/archive/,
//             so an archived id is never reused). The event id is also its seed.
//   --force   allow overwriting events that are already recorded (otherwise the run refuses before playing anything)
//   --field   all | meta | ladder | original | guide | shared | top16 | a comma list of deck files/names (e.g. meta-rry-smasher-aggro,s2-08-explorer-rrg)
//   --allow-same-lists   enter decks whose lists are the same (see "One entry per list" below)
//   --rounds  number of Swiss rounds, or auto (log2 of the field, plus a few)
//   --top     top-cut size (0 = none; rounded down to a power of two that fits the field)
//   --bo      1, 3 or 5 games per match
//   --bot     hard | mixed | medium | easy   (older names fast | lookahead | deep | hard-v1 still work)
//   --record  false to skip writing the site's event history (quick experiments)
//   --out     write events, their index, head-to-heads and evidence files to this directory instead of the site's data (experiments);
//             event ids still start after the highest event recorded in either place
//
// Formats and hand-arranged events (src/lib/eventFormats.ts). Any of these makes a "custom" event: its games count for
// ratings and head-to-heads, but titles, top-8 counts and Swiss records skip it.
//   --format       swiss | single-elim | round-robin | matches   (default swiss; inferred from --matches / --bracket)
//   --entrants     an ordered comma list of decks (seed order); a deck listed twice is entered twice, as "Name #2"
//   --pair "A vs B"   pair two decks in Swiss round 1 (repeatable); the others are paired by the algorithm
//   --cut-seeds    comma list: the Swiss top-cut seeds in order, instead of the standings
//   --bracket-bo   best-of per bracket round, first round first, e.g. 3,3,5 (Bo3 until a Bo5 final)
//   --bracket F    single-elim from a JSON list of first-round slots: deck names/files, null for a bye
//   --matches F    a match list (showdown) from JSON: [{ "a": "deck", "b": "deck", "bestOf": 5, "times": 2, "mirror": true, "round": 1 }]
//   --times N      round robin: play each pairing N times      --mirror   swap seats on every other repeat
//   --groups N     round robin in N groups                     --advance K   top K of each group go to a bracket
//   --game1        who goes first in game 1: coin | a | b | alternate (default coin, from the match seed)
//   --next         games 2+: loser | alternate (default loser: the loser of a game goes first next game)
//
// One entry per list (the guideline for every tournament and season field): a field holds each list once. Two decks are
// the same list when their Legends and main deck are the same, whatever their names, card order or sideboards. --field
// leaves out a deck whose list is already in the field (the first in library order stays) and says which, before
// anything is played; --entrants, --matches and --bracket refuse two different decks with the same list. To enter a list
// twice on purpose, name one deck twice in --entrants (it plays as "Name #2", a custom event), or pass --allow-same-lists.
//
// A game that throws aborts the event (nothing is recorded for it) and the run exits 1; it is never scored as a tie.
// Bad flags or an event that can't run (unknown deck, a deck paired twice, a bad bracket) exit 2 before anything is played.
// Outputs: public/tournaments/event-<n>.json (the one copy: the site fetches it and the scripts read it) and the index src/data/tournaments.json.
import fs from 'node:fs';
import path from 'node:path';
import { ARCHIVED_EVENTS_DIR, ArgError, bool, cli, EVENTS_DIR, existing, int, loadLibrary, many, maxEventId, oneOf, readEvents, resolveDeck, str, threadsOpt, TIER_BOTS, workerPool, writeJsonStamped } from './lib-node';
import { cutSize, runTournament, type BestOf, type BotLevel, type EventFormat, type Game1Rule, type NextRule, type PlayGame, type TourneyEvent } from '../src/lib/tournament';
import type { MatchJob, MatchResult } from './worker';
import { buildH2H } from './build-h2h';
import { rebuildEvidence } from './build-evidence';
import { buildEvent, fieldPool, pickField, type BuiltEvent } from './tournament-setup';
import { leftOutLine } from '../src/lib/distinctLists';

const { values: V } = cli(import.meta.url, {
  events: int(12, { min: 1 }),
  start: int(undefined, { min: 1 }),
  top: int(8, { min: 0 }),
  bo: oneOf(['1', '3', '5'], '3'),
  bot: oneOf(TIER_BOTS, 'hard'),
  field: str('all'),
  rounds: str('auto', (v) => (v === 'auto' || /^[1-9]\d*$/.test(v) ? undefined : `must be auto or a whole number ≥ 1, got "${v}"`)),
  record: oneOf(['true', 'false'], 'true'),
  out: str(),
  threads: threadsOpt(),
  force: bool(),
  format: oneOf(['swiss', 'single-elim', 'round-robin', 'matches']),
  entrants: str(),
  pair: many(),
  'cut-seeds': str(),
  'bracket-bo': str(),
  bracket: str(),
  matches: str(),
  times: int(1, { min: 1, max: 20 }),
  mirror: bool(),
  groups: int(1, { min: 1, max: 16 }),
  advance: int(0, { min: 0, max: 16 }),
  game1: oneOf(['coin', 'a', 'b', 'alternate'], 'coin'),
  next: oneOf(['loser', 'alternate'], 'loser'),
  'allow-same-lists': bool(),
});
const OUT = V.out;
const EV_DIR = OUT ?? EVENTS_DIR;
const EVENTS = V.events;
const START = V.start ?? Math.max(maxEventId(EVENTS_DIR, ARCHIVED_EVENTS_DIR), OUT ? maxEventId(OUT) : 0) + 1;
const TOP = V.top;
const BO = Number(V.bo) as BestOf;
const BOT = V.bot as BotLevel;
const FIELD = V.field;
const RECORD = V.record !== 'false';
const THREADS = Math.min(V.threads, 16);

// ---------------------------------------------------------------- refuse to overwrite recorded events
const planned = Array.from({ length: EVENTS }, (_, k) => START + k);
if (RECORD) {
  const clash = existing(planned.map((n) => `${EV_DIR}/event-${n}.json`));
  if (clash.length && !V.force) {
    console.error(`error: these events are already recorded: ${clash.join(', ')}.\nLeave out --start to continue after event ${maxEventId(EV_DIR, ARCHIVED_EVENTS_DIR)}, or pass --force to overwrite them.`);
    process.exit(1);
  }
  if (clash.length) console.log(`--force: overwriting ${clash.length} recorded event file(s)`);
}

// ---------------------------------------------------------------- field
// The automatic fields hold each list once (src/lib/distinctLists.ts; buildEvent leaves the rest out and names them)
const LIB = loadLibrary();
const ALL = fieldPool(LIB);
const find = (x: string) => ALL.find((y) => y.file === x || y.file === `${x}.txt` || y.deck.name === x) ?? resolveDeck(x, LIB);
const rated = (): { name: string }[] => (fs.existsSync('src/data/ratings.json') ? JSON.parse(fs.readFileSync('src/data/ratings.json', 'utf8')).decks : []);
const readJson = (flag: string, file: string | undefined) => {
  if (file === undefined) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch (e) {
    throw new ArgError(`--${flag}: can't read ${file} as JSON (${(e as Error).message})`);
  }
};
let built: BuiltEvent;
try {
  built = buildEvent(
    {
      format: V.format as EventFormat | undefined,
      bo: BO,
      rounds: V.rounds,
      top: TOP,
      pair: V.pair,
      matches: readJson('matches', V.matches),
      bracket: readJson('bracket', V.bracket),
      entrants: V.entrants,
      bracketBo: V['bracket-bo'],
      times: V.times,
      mirror: V.mirror,
      groups: V.groups,
      advance: V.advance,
      game1: V.game1 as Game1Rule,
      next: V.next as NextRule,
      cutSeeds: V['cut-seeds'],
      allowSameLists: V['allow-same-lists'],
    },
    () => {
      try {
        return pickField(FIELD, ALL, find, FIELD === 'top16' ? rated() : [], { allowSameLists: V['allow-same-lists'] });
      } catch (e) {
        throw new ArgError(`--field: ${(e as Error).message}`);
      }
    },
    find,
  );
} catch (e) {
  if (!(e instanceof ArgError)) throw e;
  console.error(`error: ${e.message}\nRun with --help for usage.`);
  process.exit(2);
}
if (built.decks.length < 2) {
  console.error(`error: --field ${FIELD} gives ${built.decks.length} deck(s); a tournament needs at least 2`);
  process.exit(2);
}
const ROUNDS = built.rounds;
// said before anything is played: the decks the field left out because their list was already in it
if (built.sameList.length) console.log(`${leftOutLine(built.sameList)} (Pass --allow-same-lists to enter ${built.sameList.length === 1 ? 'it' : 'them'} too.)`);

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
  fs.mkdirSync(EV_DIR, { recursive: true });
  fs.writeFileSync(`${EV_DIR}/event-${ev.id}.json`, JSON.stringify(ev));
}
function writeIndex() {
  const count = (parts: { matches: { games: unknown[] }[] }[]) => parts.reduce((a, r) => a + r.matches.reduce((b, m) => b + m.games.length, 0), 0);
  const events = readEvents(EV_DIR)
    .sort((a, b) => a.id - b.id)
    .map((e: any) => ({
      id: e.id,
      date: e.date,
      // the site labels an event historical from this (src/lib/playedRecord.ts isHistorical); absent on pre-version events
      ...(typeof e.simVersion === 'number' ? { simVersion: e.simVersion } : {}),
      bot: e.bot,
      format: e.format,
      // custom events (another format, or pairings set by hand) are marked; standard events carry neither field
      ...(e.custom ? { custom: true } : {}),
      ...(e.setup && e.setup.format !== 'swiss' ? { kind: e.setup.format } : {}),
      champion: e.champion,
      entrants: Object.keys(e.decks).length,
      games: count(e.rounds) + count(e.bracket),
      top8: e.standings.slice(0, e.seeds?.length ?? 8).map((s: any) => ({ deck: s.deck, mp: s.mp, record: `${s.mw}-${s.ml}`, omw: s.omw })),
      bracket: e.bracket.map((r: any) => ({ name: r.name, matches: r.matches.map((m: any) => ({ a: m.a, b: m.b, score: m.score, winner: m.winner })) })),
      standings: e.standings.map((s: any) => ({ deck: s.deck, mp: s.mp, record: `${s.mw}-${s.ml}`, games: `${s.gw}-${s.gl}`, omw: +s.omw.toFixed(3) })),
    }));
  writeJsonStamped(OUT ? path.join(OUT, 'tournaments.json') : 'src/data/tournaments.json', { updated: '', events });
  // keep the Deck Lab's head-to-head data (counter breeding) and the evidence files (docs/EVIDENCE.md) in step with the events
  if (OUT) {
    buildH2H(OUT, path.join(OUT, 'h2h.json'));
    console.log(rebuildEvidence({ out: path.join(OUT, 'evidence'), eventsDir: OUT, h2h: path.join(OUT, 'h2h.json') }));
  } else {
    buildH2H();
    console.log(rebuildEvidence());
  }
}

async function main() {
  const s = built.setup;
  const shape = s ? `${s.format}${s.pairings ? ', round-1 pairings set by hand' : ''}` : `Swiss ${ROUNDS} rounds Bo${BO}${cutSize(TOP, built.decks.length) ? ` + top ${cutSize(TOP, built.decks.length)}` : ''}`;
  console.log(`Tournament series: ${EVENTS} events × ${built.decks.length} decks (${V.entrants ? 'ordered list' : V.matches || V.bracket ? 'from the file' : FIELD}), ${shape} (${BOT} bot, ${THREADS} threads)`);
  console.log(`Event ids (= seeds): ${planned[0]}${planned.length > 1 ? `–${planned[planned.length - 1]}` : ''}${RECORD ? (OUT ? ` → ${OUT}` : '') : ' (not recorded)'}`);
  const pool = nodePool(THREADS);
  for (const n of planned) {
    let ev: TourneyEvent;
    try {
      ev = await runTournament(built.decks, { name: `Event #${n}`, rounds: ROUNDS, top: TOP, bestOf: BO, bot: BOT, seed: n }, pool.play, { id: n, ...(s ? { setup: s } : {}) });
    } catch (e) {
      console.error(`\nerror: event ${n} aborted, nothing recorded for it. ${e instanceof GameError ? e.message : String((e as Error)?.stack ?? e)}`);
      process.exit(1);
    }
    process.stderr.write('\n');
    console.log(`Event ${n} (${ev.format}): ${ev.champion ? `champion ${ev.champion}` : 'no champion (match list)'}${ev.seeds?.length ? `; bracket seeds: ${ev.seeds.join(' | ')}` : ''}`);
    if (RECORD) {
      writeEvent(ev);
      writeIndex();
    }
  }
  await pool.close();
}
main();
