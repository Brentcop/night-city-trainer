// Re-measure one change to a library deck on fresh paired games, and append the result as a re-measurement row for the
// evidence builder (src/lib/remeasure.ts; docs/EVIDENCE.md "Re-measurements").
//
//   npm run remeasure -- <deck> --cut <card> --add <card> [options]
//   npm run remeasure -- <deck> --change "<label or change key>" [options]
//   npm run remeasure -- <deck> --before <deck file> [options]
//
// <deck>   a library deck, by file or name as the other scripts take it (data/decks, data/decks/custom).
//
// The change, one way only:
//   --cut <card> --add <card>     cards by id or exact name, each flag as often as needed (repeats are copies); a cut is
//                                 replaced in place by the add given at the same position, as the forge swaps a card.
//                                 Legends: --cut-legend <card> --add-legend <card>.
//   --change "<label or key>"     a change of the deck's current list in the change ledger, by its label (as the forge
//                                 or the Deck Lab wrote it) or its change key; --ledger-dir DIR (default data/ledger).
//   --before <deck file>          the list in that file against the library list: the change that made the list, e.g.
//                                 a file in data/decks/custom/history/.
// The changed list must be a legal deck. An unknown card, a cut the list does not hold, a label that matches no change or
// more than one, or an illegal list is refused in one sentence (exit 2).
//
// The games (the forge's layout, so games already played this way are found in the game cache with --cache):
//   --bot NAME      default hard (easy, medium, hard, … as the change ledger names them; hard-v1 is refused: it reads
//                   card impact)
//   --games N       default 1120; a multiple of 14, so each of the 7 meta decks gets the same games on each seat
//   --seed N        default 5000000: game k plays meta deck k mod 7 with seed N + k, the list going first when
//                   floor(k / 7) is even; the list before and after the change play the same k
//   --field meta    the 7 meta decks (the only field for now)
//   --threads N     worker threads (default: all cores but one)
//   --cache         read games already played from .cache/games and keep the new ones (scripts/game-cache.ts)
//
// It prints the paired difference (after minus before) with its plain 95% range, the per-game spread, the share of games
// that came out the same, both win rates, the figures per opponent and per seat, the interval stratified by opponent and
// seat, and the χ² test of whether the per-opponent figures differ by more than chance.
//
// The row:
//   --out FILE      append the row to FILE (default data/evidence/remeasure-<today>.json; created with its header when
//                   it does not exist). Earlier rows are kept byte for byte; a row is never edited.
//   --note TEXT     the note of a new file
//   --id ID         the row's id (default: from the deck, the change and the bot)
//   --record TEXT   what earlier record it re-measures, in words
//   --force         add the row although its id is taken or the same measurement (same lists, bot, simulator version,
//                   games and seed) is already recorded in FILE's directory: it is added under a new id, nothing is
//                   replaced
//   --dry-run       play and print, write nothing
// Then run npm run evidence to turn the row into a finding. Exits 2 on an unknown flag or a bad value.
import { cliGameCache } from './game-cache';
import { runJobs, runMain } from './lib-node';
import { remeasure } from './remeasure-run';

runMain(async () => {
  const code = await remeasure(process.argv.slice(2), {
    out: (l) => console.log(l),
    err: (l) => console.error(l),
    play: (jobs, o) => runJobs(jobs, o),
    cache: cliGameCache,
  });
  process.exit(code);
});
