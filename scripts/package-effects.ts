// Measure the synergy packages of library lists in pairs: each list against the same list with one package taken out,
// on the same games, and write public/data/package-effects.json, which the coach reads to decide which packages it may
// name (src/ai/packageEffect.ts; docs/SYNERGIES.md "The package's effect, measured in pairs"; REVIEW_2026-11-24 S1).
//
//   npx tsx scripts/package-effects.ts [deck …] [options]
//
// [deck …]   library decks by file or name (default: every library deck). Each list's packages are the one answer of
//            src/lib/listPackages.ts (its note's, else the ones it is built around); --notes-only measures only lists
//            whose note names packages.
//
// The list without a package: removePackage (src/lib/deckPackages.ts) with the hand-written card value as the score and
// the list's other packages kept, so only this package's own pieces are cut and the best other cards take their place.
// A package with no such list is listed as not measurable, with why.
//
// The games (the forge's layout, as npm run remeasure plays them):
//   --bot NAME      default hard (as the change ledger names bots; hard-v1 is refused: it reads card impact)
//   --games N       paired games a package (default 1120, a multiple of 14): game k plays meta deck k mod 7 with seed
//                   N + k, the list first when floor(k / 7) is even; the list itself is played once for all its packages
//   --seed N        default 9000000
//   --threads N     worker threads (default: all cores but one)
//   --cache         read games already played from .cache/games and keep the new ones
//
// The numbers: with the package minus without, per paired game, its mean and standard error, and an interval corrected
// for the packages measured on the same list (Bonferroni, two-sided 95% over the list's packages together). The coach
// names a package only when that interval is above 0.
//
//   --estimate      print the plan, the games and the machine time under Medium and Hard; play nothing
//   --out FILE      default public/data/package-effects.json; written after each list, earlier lists' rows kept
//   --force         measure lists the file already has for this bot and simulator version (their rows are replaced),
//                   or start a file made with another package catalogue again
//   --dry-run       play and print, write nothing
// Exits 2 on an unknown flag or a bad value, 1 on an error.
import { cliGameCache } from './game-cache';
import { runJobs, runMain } from './lib-node';
import { packageEffects } from './package-effects-run';

runMain(async () => {
  const code = await packageEffects(process.argv.slice(2), {
    out: (l) => console.log(l),
    err: (l) => console.error(l),
    play: (jobs, o) => runJobs(jobs, o),
    cache: cliGameCache,
  });
  process.exit(code);
});
