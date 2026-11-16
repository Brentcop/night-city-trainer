// Gate one library deck against another: the season's test of a bred deck against its parent (src/lib/breedGate.ts;
// docs/SYNERGIES.md "A bred deck's test against its parent"), with the same rule and words. Writes nothing unless --out.
//
//   npm run gate -- <deck> --ref <deck> [options]
//
// <deck>, --ref <deck>   library decks, by file or name as the other scripts take them (data/decks, data/decks/custom).
//                        The field is the meta decks other than these two.
//
// The rule: in stages of --rounds double rounds (each field deck, each seat, that many times: 280 games with 7 opponents,
// 240 with 6), the deck and the reference play the same games; after each stage the paired difference (deck minus
// reference) is judged with α 0.05 spent over the looks by an O'Brien–Fleming-type boundary: shown worse when its upper
// bound is below 0, shown better when its lower bound is above 0, could not tell at the cap. A deck the first bot did not
// show worse goes on to the confirming bot. It "enters" unless a bot shows it worse.
//
//   --bot NAME             the first bot (default medium)
//   --confirm-bot NAME     the confirming bot (default hard; none for no confirming bot; the same bot as --bot under
//                          another name, e.g. lookahead and medium, plays nothing more)
//   --rounds N             double rounds per stage (default 20)
//   --stages N             the first bot's stages at most (default 5)
//   --confirm-stages N     the confirming bot's stages at most (default 2)
//   --seed N               the first bot's seeds (default 7000000): stage k plays seeds N + k·(stage games) onward,
//                          game j of a stage the field deck j mod n, the deck first when floor(j / n) is even
//   --confirm-seed N       the confirming bot's seeds (default 7100000); the two blocks may not overlap
//   --no-early-stop        play every stage of both bots (also the confirming bot's for a deck shown worse) and still
//                          report where the staged rule would have stopped and with which verdict, beside the figure
//                          over every game played
//   --threads N            worker threads (default: all cores but one)
//   --cache                read games already played from .cache/games and keep the new ones (scripts/game-cache.ts)
//   --json                 print the record as JSON instead of the text
//   --out DIR              write gate-<deck>-vs-<ref>.json and .md into DIR
//
// It prints the rule, what it guarantees, what it can detect (the deficit each bot shows worse 8 times in 10 at a per-game
// spread measured for each bot on the recorded bred decks: 0.59 with Medium, 0.60 with Hard and any other bot), each bot's verdict with its interval, the figures per opponent and per seat, and the spread seen.
// Gate games count for no rating, leaderboard, change ledger or evidence file. Exits 2 on an unknown flag, a bad value or
// a deck that is not in the library.
import { cliGameCache } from './game-cache';
import { gateCommand } from './gate-run';
import { runJobs, runMain } from './lib-node';

runMain(async () => {
  const code = await gateCommand(process.argv.slice(2), {
    out: (l) => console.log(l),
    err: (l) => console.error(l),
    play: (jobs, o) => runJobs(jobs, o),
    cache: cliGameCache,
  });
  process.exit(code);
});
