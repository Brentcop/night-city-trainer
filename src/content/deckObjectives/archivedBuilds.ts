// Deck objectives for the builds and optimizer variants retired from the active library at the 2026-11-11 baseline
// (data/decks/archive/: rrg-eor-build, rrg-v-dexter-optimized, rrg-v-smasher-optimized, s2-08-explorer-rrg-eor). They were
// derived from results of the earlier simulator; the notes are kept as written (parent notes + what changed). Not shown
// on the site: the archived lists are not in the library. See ./archived.ts.
import type { ObjectiveTable } from './vocabulary';

export const ARCHIVED_BUILD_OBJECTIVES: ObjectiveTable = {
  'rrg-eor-build.txt': {
    listId: 'd615ca2a4ad09bf8',
    objective: 'The stock RRG Dexter Midrange plan (4/6 curve, Red removal, 10-power closers), registered with a sideboard chosen per matchup.',
    plan: [
      { phase: 'early', text: 'A 4-cost 6-power Unit every turn from turn 2, as in the parent list.' },
      { phase: 'mid', text: 'Trade removal for blockers and attack the Gig area when the swing back is safe.' },
      { phase: 'closing', text: 'Close with 10-power attackers. Between games: against BBG swap Bonnie and Clyde for Royce: Don’t Call Me Simon; against aggro bring in Memory Relapse and Deadman Transmitter for Peace Offering and Detonate.' },
    ],
    keyCards: [
      { id: 'saburo_arasaka_stubborn_patriarch', role: 'Pushes ARASAKA attackers to the 10-power breakpoint.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Go Solo removal plus attacker.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Replays a 4-cost Unit for free.' },
      { id: 'animals_wrecker', role: '10-power double steal.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal, cheaper per 8+ Gig.' },
    ],
    signals: [
      { text: 'a 4-cost Unit played on curve in round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'first Gig stolen by round 3', terms: ['first-steal', 'round'] },
      { text: 'a 10-power attack by round 6', terms: ['ten-power', 'round'] },
    ],
    risks: ['As the parent: bottom-deck effects on the few big threats, and 7+ power Blockers.'],
    source: 'parent',
    status: 'draft',
    basedOn: ['meta-rrg-dexter-midrange.txt'],
  },
  'rrg-v-dexter-optimized.txt': {
    listId: '2155404788331519',
    objective: 'The RRG Dexter Midrange curve with V: Streetkid in Adam Smasher’s Legend slot: a cheaper Go Solo and Braindance recursion instead of the 9-cost finisher.',
    plan: [
      { phase: 'early', text: 'A 4/6 every turn from turn 2, as in the parent.' },
      { phase: 'mid', text: 'Call V to trash 3 and return a Braindance Program (Bonnie and Clyde, Carnage); win fights with removal and Dexter’s +2.' },
      { phase: 'closing', text: 'Close with Animals Wrecker and Saburo-boosted Yorinobu at 10 power; V can go solo for 5 as an extra attacker.' },
    ],
    keyCards: [
      { id: 'v_streetkid', role: 'Call recovers a Braindance Program; Go Solo for 5 as a same-turn attacker.' },
      { id: 'saburo_arasaka_stubborn_patriarch', role: 'Yorinobu attacks at 10.' },
      { id: 'dexter_deshawn_off_the_grid', role: 'Reactive +2 power or draw; raises Gigs.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal V can return from the trash.' },
      { id: 'animals_wrecker', role: '10-power double steal.' },
    ],
    signals: [
      { text: 'a 4-cost Unit played on curve in round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'two Legends face-up by round 4', terms: ['legend-face-up', 'round'] },
      { text: 'a 10-power attack by round 6', terms: ['ten-power', 'round'] },
    ],
    risks: ['As the parent: bottom-deck effects on the few big threats, and 7+ power Blockers.'],
    source: 'parent',
    status: 'draft',
    basedOn: ['meta-rrg-dexter-midrange.txt'],
  },
  'rrg-v-smasher-optimized.txt': {
    listId: '750a61ccf9cac8cc',
    objective: 'The RRG Dexter Midrange curve with V: Streetkid in Dexter’s slot, keeping Adam Smasher as the closer and trading Dexter’s combat trick for Braindance recursion.',
    plan: [
      { phase: 'early', text: 'A 4/6 every turn from turn 2, as in the parent.' },
      { phase: 'mid', text: 'Call V to trash 3 and return Bonnie and Clyde or Carnage; Gigs go up with Industrial Assembly rather than Dexter.' },
      { phase: 'closing', text: 'Saburo-boosted Yorinobu and Adam Smasher at 10, plus Animals Wrecker; V can also go solo for 5.' },
    ],
    keyCards: [
      { id: 'v_streetkid', role: 'Recovers a Braindance Program, or Go Solo for 5.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Go Solo removal and a 10-power attack with Saburo.' },
      { id: 'saburo_arasaka_stubborn_patriarch', role: '+1 to attacking ARASAKA Units.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Replays a 4-cost Unit for free.' },
      { id: 'bonnie_and_clyde', role: 'Cheap removal V can return.' },
    ],
    signals: [
      { text: 'a 4-cost Unit played on curve in round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'first Gig stolen by round 3', terms: ['first-steal', 'round'] },
      { text: 'a double steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: ['As the parent: bottom-deck effects on the few big threats, and 7+ power Blockers.'],
    source: 'parent',
    status: 'draft',
    basedOn: ['meta-rrg-dexter-midrange.txt'],
  },
  's2-08-explorer-rrg-eor.txt': {
    listId: '158e34a07c3083d5',
    objective: 'The S2-08 Explorer list unchanged (Red removal into 10-power Units, with Yorinobu drawing and Jackie protecting), registered with a per-matchup sideboard.',
    plan: [
      { phase: 'early', text: 'Street Racers and 4/6s (6th Street Recruits, Pepe) on curve; Take Control blunts the first big steal.' },
      { phase: 'mid', text: 'Clear blockers with Bonnie and Clyde, Over the Edge and Carnage; Yorinobu: Embracing Destruction draws when an ARASAKA Unit attacks.' },
      { phase: 'closing', text: 'Animals Wrecker and Yorinobu: Steel Dragon close; Jackie goes solo or saves your best Unit. Against BBG, swap one Memory Relapse for Royce: Don’t Call Me Simon.' },
    ],
    keyCards: [
      { id: 'yorinobu_arasaka_embracing_destruction', role: 'Draws the first time an ARASAKA Unit attacks each turn.' },
      { id: 'jackie_welles_mama_s_favorite', role: 'Go Solo 8-power, or takes a defeat for your best Unit.' },
      { id: 'animals_wrecker', role: '10-power double steal.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal, cheaper per 8+ Gig.' },
      { id: 'over_the_edge', role: 'Removal scaled by your d20.' },
    ],
    signals: [
      { text: 'a 4-cost Unit played on curve in round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'two rival Units removed by effects by round 5', terms: ['removal', 'round'] },
      { text: 'a 10-power attack by round 6', terms: ['ten-power', 'round'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s2-08-explorer-rrg.txt'],
  },
};
