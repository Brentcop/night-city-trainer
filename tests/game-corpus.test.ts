// The game corpus (data/benchmark/game-corpus.json, built by scripts/game-corpus.ts): seeded games over every library
// deck on Easy, Medium and Hard, each pinned by the SHA-256 of its final state with the log on. Same code + same seed =
// same game, so a change that is not meant to change play (a speed-up, a refactor of the engine or the bots) must leave
// every hash as it is. Each Hard game has its own test: alone they take 1 to 2 s, several times that with every core busy.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SIM_VERSION } from '../src/lib/tournament';
import { CORPUS_FILE, playCorpusGame, type CorpusGame, type GameCorpus } from '../scripts/game-corpus-play';

const corpus = JSON.parse(fs.readFileSync(CORPUS_FILE, 'utf8')) as GameCorpus;

const WHAT_TO_DO =
  'If your change was meant to alter how the engine or a bot plays, bump SIM_VERSION (src/lib/tournament.ts) and rebuild ' +
  'the corpus with `npx tsx scripts/game-corpus.ts --force`. If it was not meant to (a speed-up, a refactor), the change ' +
  'has a bug: the same seed no longer gives the same game.';

/** Games played together in one test: every Hard game alone, the quick ones in small groups. */
function groups(games: CorpusGame[]): CorpusGame[][] {
  const out: CorpusGame[][] = [];
  const quick: CorpusGame[] = [];
  for (const g of games) {
    if (g.seats.some((s) => s.tier === 'hard')) out.push([g]);
    else quick.push(g);
  }
  for (let i = 0; i < quick.length; i += 10) out.push(quick.slice(i, i + 10));
  return out;
}

describe('game corpus: the same seed gives the same game', () => {
  it('the corpus is for this simulator version and covers every tier', () => {
    expect(corpus.kind).toBe('nct-game-corpus');
    expect(corpus.schema).toBe(1);
    expect(
      corpus.simVersion,
      `${CORPUS_FILE} was built for SIM_VERSION ${corpus.simVersion}, the code is SIM_VERSION ${SIM_VERSION}: rebuild it with \`npx tsx scripts/game-corpus.ts --force\` after the change that bumped the version.`,
    ).toBe(SIM_VERSION);
    const tiers = new Set(corpus.games.flatMap((g) => g.seats.map((s) => s.tier)));
    expect([...tiers].sort()).toEqual(['easy', 'hard', 'medium']);
    expect(new Set(corpus.games.map((g) => g.first)).size).toBe(2);
    expect(new Set(corpus.games.flatMap((g) => g.seats.map((s) => s.list))).size).toBe(corpus.lists.length);
  });

  for (const group of groups(corpus.games)) {
    const name = group.length === 1 ? group[0]!.id : `${group[0]!.id} to ${group[group.length - 1]!.id}`;
    it(name, async () => {
      if (corpus.simVersion !== SIM_VERSION) return; // the version test above says what to do
      for (const g of group) {
        const r = await playCorpusGame(corpus.lists, g);
        const was = `${g.winner} on turn ${g.turns}`;
        const now = `${r.winner} on turn ${r.turns}`;
        expect(r.hash, `game ${g.id} (seed ${g.seed}) no longer ends in the recorded state (recorded: ${was}; now: ${now}). ${WHAT_TO_DO}`).toBe(g.hash);
      }
    });
  }
});
