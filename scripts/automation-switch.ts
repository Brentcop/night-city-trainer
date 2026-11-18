// Whether an automation the owner switches in #/admin is on: one site feature, read from the committed site config
// (public/site-config.json) the way the site reads it. The scheduled workflow .github/workflows/outside-meta.yml asks it
// before any request to another site (feature outsideMeta, "Figures from other sites").
//
//   npx tsx scripts/automation-switch.ts FEATURE [--config FILE] [--github-output FILE] [--summary FILE]
//
// Prints "on" or "off". A feature the file does not name takes its default (outsideMeta: on).
//
//   --config FILE         the site config to read (default public/site-config.json)
//   --github-output FILE  also append on=true or on=false to FILE (GitHub's $GITHUB_OUTPUT)
//   --summary FILE        when off, append a notice to FILE (GitHub's $GITHUB_STEP_SUMMARY)
//
// Exits 0 with the answer; 1 when the config file is missing or has an error (nothing should run until a person looks);
// 2 on a bad command line or an unknown feature.
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
