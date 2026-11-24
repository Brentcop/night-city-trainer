// Whether an automation the owner switches in #/admin is on: one site feature, read from the committed site config
// (public/site-config.json) the way the site reads it. The scheduled workflow .github/workflows/outside-meta.yml asks it
// before any request to another site (feature outsideMeta, "Figures from other sites").
//
// The rating series (docs/SERIES.md) reads its switches from the same file's `automation` section.
//
//   npx tsx scripts/automation-switch.ts NAME [--config FILE] [--github-output FILE] [--summary FILE]
//   npx tsx scripts/automation-switch.ts --json [--config FILE] [--github-output FILE]
//
// NAME without a dot is a feature (outsideMeta): prints "on" or "off". automation.series, automation.arrivals and
// automation.matchups print "on" or "off" the same way; automation.width, automation.maxGamesPerRun,
// automation.matchupDecks and automation.matchupGames print their value. --json prints the whole automation section as
// one JSON object. A key the file does not name takes its default (outsideMeta: on; the automation section: series on,
// arrivals on, width 4, maxGamesPerRun 12000, matchups on, matchupDecks 16, matchupGames 100).
//
//   --config FILE         the site config to read (default public/site-config.json)
//   --github-output FILE  also append on=true or on=false (a switch), value=N (a number) or automation={…} (--json) to
//                         FILE (GitHub's $GITHUB_OUTPUT)
//   --summary FILE        when a switch is off, append a notice to FILE (GitHub's $GITHUB_STEP_SUMMARY)
//
// Exits 0 with the answer; 1 when the config file is missing or has an error (nothing should run until a person looks);
// 2 on a bad command line or an unknown feature or setting.
import fs from 'node:fs';
import { automationSwitch } from './automation-switch-run';

process.exit(
  automationSwitch(process.argv.slice(2), {
    out: (l) => console.log(l),
    err: (l) => console.error(l),
    read: (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null),
    append: (f, t) => fs.appendFileSync(f, t),
  }),
);
