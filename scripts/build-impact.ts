// Build the card table the coach and the Deck Lab read (src/data/impact.json) from the one the season breeder reads:
// the lists of the pair `loadImpactTables` chooses (scripts/breed-data.ts; the current simulator version and the
// season's bot, Hard: Season 3's round robin in data/seasons/deck-impact.json plus the review telemetry
// src/data/analysis.json when its manifest names that pair), through `impactDataOf` in src/lib/breederImpact.ts. So the
// coach, the Deck Lab, the forge's additions and the breeder read one table (REVIEW_2026-11-24 B.2). `sim analyze`
// writes it after a whole-field run; this rebuilds it (after a season records its round robin, for one), and runs in
// `npm run refresh`. Deterministic, and an unchanged file is not rewritten. `npm run check:data` fails when the stored
// file is not this rebuild. The file is in every game worker: the bots of the site (Easy, Medium, Hard) read no card
// impact, so their games do not move, but the game cache's code hash covers it.
//   npx tsx scripts/build-impact.ts
// Exits 2 on a bad flag.
import { cli, runMain, writeIfChanged } from './lib-node';
import { buildImpactData, IMPACT_DATA_FILE } from './breed-data';
import { impactDataWords } from '../src/lib/breederImpact';

cli(import.meta.url, {});

runMain(async () => {
  const { data, text, tables } = buildImpactData();
  const changed = writeIfChanged(IMPACT_DATA_FILE, text);
  for (const l of impactDataWords(tables, data)) console.log(l);
  console.log(`${changed ? 'Wrote' : 'Unchanged:'} ${IMPACT_DATA_FILE} (${data.decks.length} lists, ${(text.length / 1000).toFixed(1)} kB)`);
});
