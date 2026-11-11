// Legacy path for card impact (backlog AI-11). src/data/impact.json was written before analysis recorded list
// fingerprints, so its entries carry only a deck name. Each such name is pinned here to the listFingerprint of the
// built-in library deck that had that name when impact moved to fingerprints (2026-11-11; data/decks/ at that commit).
// A name-only entry is used only for that exact list (findImpactDeck in ./impactData.ts):
//   - the built-in deck itself keeps its numbers, so bot games between library decks play exactly as before;
//   - a custom deck that reuses the name, or a later edit of the built-in list, gets nothing.
// Once `npm run sim -- analyze` rewrites impact.json, every entry has its own fingerprint and this table is unused;
// delete it then. Do not add names to it.
export const LEGACY_IMPACT_LISTS: Readonly<Record<string, string>> = {
  'S1-01 Mutant (RRB)': '5d650e35c67b3bf8', // data/decks/custom/s1-01-mutant-rrb.txt
  'S1-04 Cross (RBG)': 'fa0b6f14f3d893e1', // s1-04-cross-rbg.txt
  'S3-04 Cross (RBG)': 'd93dab2a04556349', // s3-04-cross-rbg.txt
  'S2-08 Explorer (RRG)': '158e34a07c3083d5', // s2-08-explorer-rrg.txt
  'S3-05 Cross (RRB)': '00f1a8607c142d13', // s3-05-cross-rrb.txt
  'S1-05 Cross (RGY)': '773f35ff541ef802', // s1-05-cross-rgy.txt
  'S1-07 Explorer (BBG)': '3cc5f10c30d498a7', // s1-07-explorer-bbg.txt
  'S2-07 Explorer (RRB)': '2a9a527893a1f110', // s2-07-explorer-rrb.txt
  'S2-04 Cross (RRG)': '80c37583621a7fd5', // s2-04-cross-rrg.txt
  'S1-08 Explorer (RRG)': '0bbe4834cda20572', // s1-08-explorer-rrg.txt
  'S3-06 Cross (RBG)': '622cc2b22384b4ea', // s3-06-cross-rbg.txt
  'S1-06 Cross (RGG)': '761db37f5a335abd', // s1-06-cross-rgg.txt
  'RRG Dexter Midrange': 'd615ca2a4ad09bf8', // data/decks/meta-rrg-dexter-midrange.txt
  'YYB Rogue Gear': '078ce02dba6dd2c0', // meta-yyb-rogue-gear.txt
  'BBG Cunningham Econ': '0b6272134a22585c', // meta-bbg-cunningham-econ.txt
  'RRY Smasher Aggro': 'ee779ed4dea87217', // meta-rry-smasher-aggro.txt
  'RRB Wakako Midrange': '06552ee884386887', // meta-rrb-wakako-midrange.txt
  'Rainbow Fixer Stuff': '189f8a3b59f1117f', // meta-rainbow-fixer-stuff.txt
  'GRY Trauma Team': '3d6b0327f672d914', // meta-gry-trauma-team.txt
};
