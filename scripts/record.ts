// Game records (docs/GAME_RECORD.md): write a game the engine plays as a plain-text record, and check that a record
// replays. Nothing is written without --out.
//
//   npm run record -- export --decks <deck a>,<deck b> --seed N [--bot easy] [--first p1|p2] [--max-turns N]
//   npm run record -- export --event N (--match "<deck a> vs <deck b>" [--game G] | --index K)
//   npm run record -- export --replay <practice replay .json> [--id ID]
//   npm run record -- check <record file> [--seed N]
//   npm run record -- roundtrip [--games N] [--bot easy] [--seed N]
//   npm run record -- compare <record file> [--seat p1|p2|both] [--bots medium,hard|none] [--seeds N] [--seed N] [--bot-seed N] [--json] [--out FILE] [--force]
//   npm run record -- show <record file> --line N [--seed N]
//
// export   plays the game and prints its full-information record (or writes it to --out FILE; an existing file is
//          replaced only with --force). A deck is named by its library file when the list and name match one, otherwise
//          written out in the header. Decks are library file or deck names (as `npm run sim -- catalog` lists them) or
//          paths to deck text files. --bot is a tier name (easy, medium, hard, mixed, deep, ...); seat 2 plays seed + 7777.
//          --event: a game of a recorded event in public/tournaments/ (--index K: the K-th game of the event, from 0, in
//          round, match and game order). --replay: a practice replay saved from the site (one replay, or an array of them
//          with --id), re-simulated with the bot it was played against.
// check    parses the record, replays it from --seed (default 1; any seed gives the same game) and says that it replays
//          to the end, with the result, or where it stops and why. Exit 1 when it does not replay (or does not parse).
// roundtrip  plays N games of the library decks (every third with a seat that picks some moves at random and chooses
//          its payments, effect order and ends of turn), exports, parses, writes and replays each from two other seeds,
//          and compares every decision, the end state and the log. Prints how many round-trip exactly; writes nothing.
// compare  replays a full-information record and, at every decision of --seat (default both), says what the coach would
//          do (its pick, and the move made graded as the Play page grades it) and what each bot in --bots would choose
//          (easy, medium, hard; default medium,hard; none for the coach alone), beside the record's move; then a summary
//          (decisions compared and skipped, the scorecard, agreement, the costliest moves with their line numbers).
//          The coach's grades carry noise, so the record is compared under --seeds N replay seeds (1 to 9, default 5:
//          --seed, --seed + 1, …; --seed defaults to 1): each grade is given as how often it came up, the summary as
//          ranges, and the costly moves split into settled (a Mistake or worse under at least four fifths of the seeds)
//          and sometimes. --seeds 1 is one plain run. --json prints the report as JSON. The same record gives the same
//          report (fixed replay, coach and bot seeds); timing goes to stderr. A record with a hidden card (?) on a
//          compared seat is refused (exit 1).
// show     prints the table as it stands just before line --line of the record: each side's Legends, field, Gigs,
//          Eddies, hand, and deck and trash counts.
// Exit 2 on a bad command line.
import fs from 'node:fs';
import path from 'node:path';
import { makeTierBot } from '../src/ai/tiers';
import { listFingerprint } from '../src/engine/deck';
import type { Agent, Decision, DeckList, PlayerId } from '../src/engine/types';
import type { Game } from '../src/engine/engine';
import { readLiftSlice, seatLiftFromSlice, type LiftSlice } from '../src/ai/packageLift';
import { CATALOGUE_VERSION } from '../src/content/synergies/index';
import { COMPARE_BOTS, compareSeeds, DEFAULT_COMPARE_BOTS, DEFAULT_COMPARE_SEEDS, MAX_COMPARE_SEEDS, replaySeeds, seedsJson, seedsText, type CompareBot } from '../src/lib/gameRecord/coachCompare';
import { compareGames } from '../src/lib/gameRecord/compare';
import { exportGame, inlineDeck } from '../src/lib/gameRecord/exporter';
import { parseRecord, writeRecord, type DeckRef, type GameRecord } from '../src/lib/gameRecord/notation';
import { replayRecord } from '../src/lib/gameRecord/replay';
import { showAt } from '../src/lib/gameRecord/show';
import type { LibraryDeck } from '../src/lib/library';
import { parseReplays, type PracticeReplay } from '../src/lib/practiceReplays';
import { checkReplayed, practiceAgents, refuseOtherVersion } from '../src/sim/practiceReview';
import { ArgError, bool, cli, Refusal, forEachGameOf, int, loadLibrary, readEvents, resolveDeck, runMain, str, TIER_BOTS, type RecordedGame } from './lib-node';

const { values: V, positionals } = cli(
  import.meta.url,
  {
    decks: str(),
    seed: int(undefined, { min: 0, max: 2 ** 31 - 1 }),
    bot: str(),
    first: str(),
    'max-turns': int(undefined, { min: 1, max: 500 }),
    event: int(undefined, { min: 1 }),
    match: str(),
    game: int(undefined, { min: 0 }),
    index: int(undefined, { min: 0 }),
    replay: str(),
    id: str(),
    games: int(undefined, { min: 1, max: 5000 }),
    out: str(),
    force: bool(),
    seat: str(),
    bots: str(),
    'bot-seed': int(undefined, { min: 0, max: 2 ** 31 - 1 }),
    seeds: int(undefined, { min: 1, max: MAX_COMPARE_SEEDS }),
    json: bool(),
    line: int(undefined, { min: 1 }),
  },
  { minPositionals: 1, maxPositionals: 2 },
);

const usage = (msg: string): never => {
  console.error(`error: ${msg}\nRun with --help for usage.`);
  process.exit(2);
};

const cmd = positionals[0]!;
const FILE_CMDS = ['check', 'compare', 'show'];
if (!['export', 'roundtrip', ...FILE_CMDS].includes(cmd)) usage(`unknown command "${cmd}": export, check, roundtrip, compare or show`);
if (!FILE_CMDS.includes(cmd) && positionals.length > 1) usage(`${cmd} takes no file argument (use --out to write the record)`);
if (FILE_CMDS.includes(cmd) && positionals.length !== 2) usage(`${cmd} needs the record file: npm run record -- ${cmd} <file>`);
const used = (keys: string[]) => keys.filter((k) => (V as Record<string, unknown>)[k] !== undefined && (V as Record<string, unknown>)[k] !== false);
const allow = (keys: string[]) => {
  const extra = used(Object.keys(V)).filter((k) => !keys.includes(k));
  if (extra.length) usage(`${cmd} does not take ${extra.map((k) => `--${k}`).join(', ')}`);
};
if (V.bot !== undefined && !(TIER_BOTS as readonly string[]).includes(V.bot)) usage(`--bot must be one of ${TIER_BOTS.join(', ')}`);
if (V.first !== undefined && !/^p[12]$/i.test(V.first)) usage('--first must be p1 or p2');

let library: LibraryDeck[] | null = null;
const lib = () => (library ??= loadLibrary());

/** How the header names a deck: its library file when one holds exactly this list under this name, else the list. */
function deckRef(d: DeckList): DeckRef {
  const fp = listFingerprint(d);
  const hits = lib().filter((x) => x.deck.name === d.name && listFingerprint(x.deck) === fp);
  const byFile = hits.filter((x) => lib().filter((y) => y.file.toLowerCase() === x.file.toLowerCase()).length === 1);
  return byFile.length === 1 ? { kind: 'file', file: byFile[0]!.file } : inlineDeck(d);
}

/** The replay's deck lookup: a library file or deck name, or the inline list. */
function resolveRef(ref: DeckRef, seat: PlayerId): DeckList | string {
  const who = seat === 0 ? 'p1' : 'p2';
  if (ref.kind === 'list') return { name: ref.name, legends: [...ref.legends], main: [...ref.main], sideboard: [] };
  if (ref.kind === 'unknown') return `The header does not say ${who}'s deck.`;
  const hits = ref.kind === 'file' ? lib().filter((x) => x.file.toLowerCase() === ref.file.toLowerCase()) : lib().filter((x) => x.deck.name.toLowerCase() === ref.name.toLowerCase());
  const what = ref.kind === 'file' ? `file ${ref.file}` : `deck name "${ref.name}"`;
  if (!hits.length) return `The header names ${who}'s deck by ${what}, but no deck in the library (data/decks) has it.`;
  if (hits.length > 1) return `The header names ${who}'s deck by ${what}, which more than one library deck has (${hits.map((x) => x.file).join(', ')}); name it by file.`;
  const d = hits[0]!.deck;
  return { name: d.name, legends: [...d.legends], main: [...d.main], sideboard: [] };
}

const gameDeck = (d: Pick<DeckList, 'name' | 'legends' | 'main'>): DeckList => ({ name: d.name, legends: [...d.legends], main: [...d.main], sideboard: [] });

function deckArg(q: string): DeckList {
  try {
    return gameDeck(resolveDeck(q.trim(), lib()).deck);
  } catch (e) {
    return usage((e as Error).message);
  }
}

async function writeOut(text: string) {
  if (!V.out) {
    process.stdout.write(text);
    return;
  }
  if (fs.existsSync(V.out) && !V.force) usage(`${V.out} exists; pass --force to replace it`);
  fs.mkdirSync(path.dirname(path.resolve(V.out)), { recursive: true });
  fs.writeFileSync(V.out, text);
  console.error(`wrote ${V.out} (${text.split('\n').length - 1} lines, ${Buffer.byteLength(text)} bytes)`);
}

async function exportCmd() {
  const modes = [V.decks !== undefined, V.event !== undefined, V.replay !== undefined].filter(Boolean).length;
  if (modes !== 1) usage('export needs exactly one of --decks, --event or --replay');
  const today = new Date().toISOString().slice(0, 10);
  if (V.decks !== undefined) {
    allow(['decks', 'seed', 'bot', 'first', 'max-turns', 'out', 'force']);
    if (V.seed === undefined) usage('export --decks needs --seed');
    const names = V.decks.split(',');
    if (names.length !== 2 || names.some((x) => !x.trim())) usage('--decks takes two decks separated by a comma');
    const decks: [DeckList, DeckList] = [deckArg(names[0]!), deckArg(names[1]!)];
    const bot = V.bot ?? 'easy';
    const seed = V.seed!;
    const ex = await exportGame({
      decks,
      agents: [makeTierBot(bot, seed), makeTierBot(bot, seed + 7777)],
      seed,
      ...(V.first ? { first: (V.first.toLowerCase() === 'p1' ? 0 : 1) as PlayerId } : {}),
      ...(V['max-turns'] !== undefined ? { maxTurns: V['max-turns'] } : {}),
      deckRefs: [deckRef(decks[0]), deckRef(decks[1])],
      players: [`${bot} bot`, `${bot} bot`],
      date: today,
      source: `npm run record -- export, bot ${bot}, seed ${seed}`,
    });
    return writeOut(ex.text);
  }
  if (V.event !== undefined) {
    allow(['event', 'match', 'game', 'index', 'out', 'force']);
    if ((V.match === undefined) === (V.index === undefined)) usage('export --event needs --match "<deck a> vs <deck b>" or --index K');
    if (V.game !== undefined && V.match === undefined) usage('--game goes with --match');
    const ev = readEvents().find((e) => e.id === V.event);
    if (!ev) usage(`no recorded event ${V.event} in public/tournaments`);
    const games: RecordedGame[] = [];
    forEachGameOf([ev!], (x) => games.push(x));
    let pick: RecordedGame | undefined;
    if (V.index !== undefined) {
      pick = games[V.index];
      if (!pick) usage(`event ${V.event} has ${games.length} games (--index 0 to ${games.length - 1})`);
    } else {
      const m = V.match!.split(/\s+vs\.?\s+/i);
      if (m.length !== 2) usage('--match takes "<deck a> vs <deck b>"');
      const [a, b] = m.map((x) => x.trim().toLowerCase());
      const inMatch = games.filter((x) => x.match.a.toLowerCase() === a && x.match.b.toLowerCase() === b);
      if (!inMatch.length) usage(`event ${V.event} has no match "${V.match}" (deck a first, as the event lists it)`);
      pick = inMatch[V.game ?? 0];
      if (!pick) usage(`that match has ${inMatch.length} games (--game 0 to ${inMatch.length - 1})`);
    }
    const g = pick!;
    const list = (name: string, base: string) => gameDeck({ name, legends: ev!.decks[base]!.legends, main: ev!.decks[base]!.main });
    const decks: [DeckList, DeckList] = [list(g.match.a, g.decks[0]), list(g.match.b, g.decks[1])];
    const ex = await exportGame({
      decks,
      agents: [makeTierBot(ev!.bot, g.game.seed), makeTierBot(ev!.bot, g.game.seed + 7777)],
      seed: g.game.seed,
      first: g.game.first,
      deckRefs: [deckRef(decks[0]), deckRef(decks[1])],
      players: [`${ev!.bot} bot`, `${ev!.bot} bot`],
      date: ev!.date,
      source: `event ${ev!.id}, ${g.match.a} vs ${g.match.b}, game ${g.match.games.indexOf(g.game)}`,
    });
    if ((ex.state.winner ?? 'tie') !== g.game.winner || ex.state.turn !== g.game.turns)
      throw new Refusal(`this game no longer plays as the event recorded it (the event says ${g.game.winner} at turn ${g.game.turns}, it now ends ${ex.state.winner} at turn ${ex.state.turn}): the bots or the engine changed since`);
    return writeOut(ex.text);
  }
  allow(['replay', 'id', 'out', 'force']);
  let raw: string;
  try {
    raw = fs.readFileSync(V.replay!, 'utf8');
  } catch (e) {
    return usage(`can't read ${V.replay}: ${(e as Error).message}`);
  }
  const parsed = raw.trim().startsWith('[') ? parseReplays(raw) : parseReplays(`[${raw}]`);
  const r: PracticeReplay | undefined = V.id ? parsed.find((x) => x.id === V.id) : parsed.length === 1 ? parsed[0] : undefined;
  if (!r) return usage(V.id ? `no replay with id ${V.id} in ${V.replay}` : `${V.replay} holds ${parsed.length} complete replays; pick one with --id`);
  const decks: [DeckList, DeckList] = [gameDeck(r.decks[0]), gameDeck(r.decks[1])];
  const spec = { ...r, decks };
  refuseOtherVersion(spec);
  const agents = practiceAgents(spec);
  const ex = await exportGame({
    decks,
    agents,
    seed: r.seed,
    ...(r.first !== undefined ? { first: r.first } : {}),
    deckRefs: [deckRef(decks[0]), deckRef(decks[1])],
    players: r.pvp ? (r.pvp.seat === 0 ? ['You', r.pvp.rival] : [r.pvp.rival, 'You']) : ['You', `${r.botLevel} bot`],
    date: r.date.slice(0, 10),
    source: `practice replay ${r.id}`,
  });
  checkReplayed(spec, agents, { winner: ex.state.winner, turns: ex.state.turn });
  return writeOut(ex.text);
}

/** The record file named on the command line, parsed; prints the problems and exits 1 when it does not parse. */
function readRecordFile(): { file: string; pr: ReturnType<typeof parseRecord> & { record: GameRecord } } {
  const file = positionals[1]!;
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return usage(`can't read ${file}: ${(e as Error).message}`);
  }
  const pr = parseRecord(text);
  if (!pr.record) {
    for (const e of pr.errors) console.log(`line ${e.line}: ${e.message}`);
    console.log(`${file} does not parse (${pr.errors.length} problem${pr.errors.length === 1 ? '' : 's'}).`);
    process.exit(1);
  }
  return { file, pr: pr as ReturnType<typeof parseRecord> & { record: GameRecord } };
}

async function compareCmd() {
  allow(['seat', 'bots', 'seed', 'seeds', 'bot-seed', 'json', 'out', 'force']);
  const seat = (V.seat ?? 'both').toLowerCase();
  if (!['p1', 'p2', 'both'].includes(seat)) usage('--seat must be p1, p2 or both');
  const seats: PlayerId[] = seat === 'p1' ? [0] : seat === 'p2' ? [1] : [0, 1];
  const botList = (V.bots ?? DEFAULT_COMPARE_BOTS.join(',')).toLowerCase();
  const bots = botList === 'none' ? [] : botList.split(',').map((x) => x.trim());
  for (const b of bots) if (!(COMPARE_BOTS as readonly string[]).includes(b)) usage(`--bots takes ${COMPARE_BOTS.join(', ')} (comma-separated) or none, got "${b}"`);
  if (new Set(bots).size !== bots.length) usage('--bots names a bot twice');
  const { file, pr } = readRecordFile();
  // the coach's package notes read the lift slice as the Play page does (read only; absent = worded as unmeasured)
  let slice: LiftSlice | null = null;
  let current = false;
  try {
    slice = readLiftSlice(JSON.parse(fs.readFileSync('public/data/lift.json', 'utf8')));
    current = slice?.catalogueVersion === CATALOGUE_VERSION;
  } catch {
    slice = null;
  }
  const t0 = Date.now();
  const ms = { coach: [] as number[], bots: {} as Record<string, number[]> };
  let compared = 0;
  const seeds = replaySeeds(V.seed ?? 1, V.seeds ?? DEFAULT_COMPARE_SEEDS);
  const reports = await compareSeeds(pr.record, {
    botSeed: V['bot-seed'] ?? 1,
    seats,
    bots: bots as CompareBot[],
    resolveDeck: resolveRef,
    lift: (g, p) => seatLiftFromSlice(slice, g.P(p).listId, current),
    onStep: (x) => {
      if (!x.compared) return;
      compared++;
      ms.coach.push(x.ms.coach);
      for (const [b, t] of Object.entries(x.ms.bots)) (ms.bots[b] ??= []).push(t);
      if (compared % 20 === 0) process.stderr.write(`  ${compared} decisions compared (${((Date.now() - t0) / 1000).toFixed(1)} s)\n`);
    },
  }, seeds);
  const r = reports[0]!;
  if (r.refused) {
    console.log(r.refused);
    process.exit(1);
  }
  const total = (Date.now() - t0) / 1000;
  const mean = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(0) : '—');
  const sum = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / 1000).toFixed(1);
  process.stderr.write(
    `Compared ${r.compared.length} decisions under ${seeds.length} replay seed${seeds.length === 1 ? '' : 's'} (${seeds.join(', ')}) in ${total.toFixed(1)} s: coach ${sum(ms.coach)} s (${mean(ms.coach)} ms a decision)${Object.entries(ms.bots)
      .map(([b, xs]) => `, ${b} ${sum(xs)} s (${mean(xs)} ms)`)
      .join('')}.\n`,
  );
  const text = V.json ? `${JSON.stringify(seedsJson(reports), null, 2)}\n` : seedsText(reports, path.basename(file));
  await writeOut(text);
  if (reports.some((x) => !x.ok)) process.exit(1);
}

async function showCmd() {
  allow(['line', 'seed']);
  if (V.line === undefined) usage('show needs --line N');
  const { pr } = readRecordFile();
  const r = await showAt(pr.record, V.line!, { seed: V.seed ?? 1, resolveDeck: resolveRef });
  if (!r.ok) {
    console.log(r.message);
    process.exit(1);
  }
  process.stdout.write(r.text);
}

async function checkCmd() {
  allow(['seed']);
  const { pr } = readRecordFile();
  const lines = pr.record.lines.filter((l) => l.ev.k !== 'note').length;
  if (pr.unknownLines.length) console.log(`Lines with hidden cards or values (?): ${pr.unknownLines.join(', ')}.`);
  const seed = V.seed ?? 1;
  const r = await replayRecord(pr.record, { seed, resolveDeck: resolveRef });
  if (!r.ok) {
    console.log(`Stops${r.stop!.line ? ` at line ${r.stop!.line}` : ''}: ${r.stop!.message}`);
    process.exit(1);
  }
  const s = r.state!;
  const winner = s.winner === null || s.winner === 'tie' ? 'a draw' : `${s.winner === 0 ? 'p1' : 'p2'} (${s.players[s.winner].name}) wins`;
  console.log(`Replays to the end (seed ${seed}): ${winner} at turn ${s.turn}, ${s.winReason}. ${lines} lines, ${r.decisions.length} decisions replayed.`);
}

/** A seat that picks some moves at random and chooses its own payments, effect order and ends of turn. */
class RandomPerson implements Agent {
  name = 'person';
  choosesPayment = true;
  choosesOrder = true;
  confirmsEndTurn = true;
  private r: number;
  private inner: Agent;
  constructor(seed: number, bot: string) {
    this.r = seed >>> 0;
    this.inner = makeTierBot(bot, seed + 99);
  }
  private rnd() {
    this.r = (Math.imul(this.r, 1664525) + 1013904223) >>> 0;
    return this.r / 2 ** 32;
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    if (d.kind === 'pay' || d.kind === 'order') return [this.rnd() < 0.5 ? 0 : Math.floor(this.rnd() * d.options.length)];
    if (d.options.length > 1 && this.rnd() < 0.3) return [Math.floor(this.rnd() * d.options.length)];
    if (d.kind === 'action' && d.options.length === 1) return [0];
    return this.inner.decide(g, d);
  }
}

async function roundtripCmd() {
  allow(['games', 'bot', 'seed']);
  const n = V.games ?? 30;
  const bot = V.bot ?? 'easy';
  const base = V.seed ?? 1000;
  const decks = lib().map((x) => gameDeck(x.deck));
  let exact = 0;
  const problems: string[] = [];
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const seed = base + i;
    const pair: [DeckList, DeckList] = [decks[seed % decks.length]!, decks[(seed * 13 + 5) % decks.length]!];
    const agents: [Agent, Agent] = [i % 3 === 2 ? new RandomPerson(seed, bot) : makeTierBot(bot, seed), makeTierBot(bot, seed + 7777)];
    const ex = await exportGame({ decks: pair, agents, seed, first: (seed % 2) as PlayerId });
    const pr = parseRecord(ex.text);
    if (!pr.record) {
      problems.push(`seed ${seed}: does not parse: line ${pr.errors[0]!.line}: ${pr.errors[0]!.message}`);
      continue;
    }
    if (writeRecord(pr.record) !== ex.text) {
      problems.push(`seed ${seed}: parse then write does not give the same text`);
      continue;
    }
    let ok = true;
    for (const rs of [seed * 31 + 7, seed * 17 + 3]) {
      const r = await replayRecord(pr.record, { seed: rs, resolveDeck: resolveRef });
      if (!r.ok) {
        problems.push(`seed ${seed}: replay from seed ${rs} stops${r.stop!.line ? ` at line ${r.stop!.line}` : ''}: ${r.stop!.message}`);
        ok = false;
        break;
      }
      const c = compareGames(ex, { state: r.state!, decisions: r.decisions });
      if (!c.same) {
        problems.push(`seed ${seed}: replay from seed ${rs} differs: ${c.decisionDiff ?? c.stateDiff ?? c.logDiff}`);
        ok = false;
        break;
      }
    }
    if (ok) exact++;
  }
  console.log(`${exact} of ${n} games round-trip exactly (bot ${bot}, seeds ${base}–${base + n - 1}, ${((Date.now() - t0) / 1000).toFixed(1)} s).`);
  for (const p of problems.slice(0, 20)) console.log(`  ${p}`);
  if (exact < n) process.exit(1);
}

runMain(async () => {
  try {
    if (cmd === 'export') await exportCmd();
    else if (cmd === 'check') await checkCmd();
    else if (cmd === 'compare') await compareCmd();
    else if (cmd === 'show') await showCmd();
    else await roundtripCmd();
  } catch (e) {
    if (e instanceof ArgError) usage(e.message);
    // a practice replay that no longer plays as recorded (src/ai/reviewer.ts ReplayDiverged): its sentence, no stack
    if (e instanceof Error && e.name === 'ReplayDiverged') throw new Refusal(e.message);
    throw e;
  }
});
