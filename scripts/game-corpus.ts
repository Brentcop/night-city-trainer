// Build the game corpus that tests/game-corpus.test.ts replays: a fixed set of seeded games over every library deck
// (Easy, Medium and Hard, and games between different tiers, each seat going first), each pinned by the SHA-256 of its
// final state with the log on. It proves that a change not meant to change play (a speed-up, a refactor) changes no
// game. The file is self-contained: the SIM_VERSION, each seat's bot and seed, and each list as the card ids in the
// order its deck file gave them, so it does not depend on the library's deck files staying as they are.
//   npx tsx scripts/game-corpus.ts [--out data/benchmark/game-corpus.json] [--force]
//   npx tsx scripts/game-corpus.ts --check [--out FILE]
// --check: replay the file and report the games whose hash differs; writes nothing.
// Rebuild it (--force) only together with a change that is meant to change how the engine or a bot plays, which also
// bumps SIM_VERSION (src/lib/tournament.ts). Refuses to overwrite the file without --force.
import fs from 'node:fs';
import path from 'node:path';
import { cli, str, bool, loadLibrary, runMain, Refusal } from './lib-node';
import { SIM_VERSION } from '../src/lib/tournament';
import { CORPUS_FILE, corpusPlan, playCorpusGame, type CorpusGame, type CorpusList, type GameCorpus } from './game-corpus-play';

const { values: V } = cli(import.meta.url, { out: str(CORPUS_FILE), force: bool(), check: bool() });

async function check(file: string) {
  if (!fs.existsSync(file)) throw new Refusal(`no corpus at ${file}`);
  const c = JSON.parse(fs.readFileSync(file, 'utf8')) as GameCorpus;
  if (c.kind !== 'nct-game-corpus' || c.schema !== 1) throw new Refusal(`${file} is not a game corpus (schema 1)`);
  if (c.simVersion !== SIM_VERSION) throw new Refusal(`${file} was built for SIM_VERSION ${c.simVersion}, the code is ${SIM_VERSION}`);
  let bad = 0;
  for (const g of c.games) {
    const r = await playCorpusGame(c.lists, g);
    if (r.hash !== g.hash) {
      bad++;
      console.log(`${g.id}: differs (recorded ${g.winner} on turn ${g.turns}, now ${r.winner} on turn ${r.turns})`);
    }
  }
  console.log(`${c.games.length - bad} of ${c.games.length} games replay to the recorded state`);
  if (bad) process.exitCode = 1;
}

async function build(file: string) {
  if (fs.existsSync(file) && !V.force) throw new Refusal(`${file} exists; pass --force to rebuild it (only with a change meant to change play, and a SIM_VERSION bump).`);
  const lib = loadLibrary();
  const plan = corpusPlan(lib.length);
  const lists: CorpusList[] = [];
  const listOf = new Map<number, number>();
  const list = (k: number) => {
    let i = listOf.get(k);
    if (i === undefined) {
      const d = lib[k]!;
      i = lists.push({ from: d.file, name: d.deck.name, legends: [...d.deck.legends], main: [...d.deck.main], sideboard: [...d.deck.sideboard] }) - 1;
      listOf.set(k, i);
    }
    return i;
  };
  const games: CorpusGame[] = [];
  const t0 = Date.now();
  for (const p of plan) {
    const [a, b] = p.seats;
    const g = { id: p.id, seed: p.seed, first: p.first, seats: [{ tier: a.tier, seed: p.seed, list: list(a.deck) }, { tier: b.tier, seed: p.seed + 7777, list: list(b.deck) }] } as Omit<CorpusGame, 'winner' | 'turns' | 'hash'>;
    const t = Date.now();
    const r = await playCorpusGame(lists, g);
    games.push({ ...g, ...r });
    console.log(`${g.id.padEnd(10)} ${lists[g.seats[0].list]!.from} v ${lists[g.seats[1].list]!.from}: ${r.winner} on turn ${r.turns}, ${Date.now() - t} ms`);
  }
  const corpus: GameCorpus = { kind: 'nct-game-corpus', schema: 1, simVersion: SIM_VERSION, lists, games };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(corpus, null, 1) + '\n');
  console.log(`wrote ${file}: ${games.length} games over ${lists.length} lists (of ${lib.length} library decks), ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

runMain(() => (V.check ? check(V.out) : build(V.out)));
