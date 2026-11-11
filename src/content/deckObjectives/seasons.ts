// Deck objectives for the bred decks of the seasons run since the 2026-11-11 baseline (data/decks/custom/s<N>-*.txt).
// Short drafts: mutants and crossovers from their parents' notes plus what changed (source 'parent'), explorers from
// the list (source 'list'). The owner corrects an entry by editing it and setting `status: 'owner'`.
import type { ObjectiveTable } from './vocabulary';

export const SEASON_OBJECTIVES: ObjectiveTable = {
  // ---------------- Season 1 (2026-11-11) ----------------
  's1-01-mutant-rry.txt': {
    listId: '52592f87a5675ab9',
    objective: 'RRG Dexter Midrange’s 4/6 curve and Red removal with Dum Dum in Saburo’s seat: card draw from Gear instead of the Arasaka attack bonus.',
    plan: [
      { phase: 'early', text: 'Play 6th Street Recruits or Kerry: The Last Rockerboy on curve; Call Dum Dum to draw.' },
      { phase: 'mid', text: 'Trade Bonnie and Clyde, Over the Edge and Carnage for blockers; Dexter’s Spend raises Gigs toward 8+.' },
      { phase: 'closing', text: 'Animals Wrecker at 10 power steals two; Yorinobu: Steel Dragon replays a 4-drop; Adam Smasher goes solo to defeat a Unit.' },
    ],
    keyCards: [
      { id: 'dum_dum_maelstrom_triggerman', role: 'Call to draw (2 by defeating a friendly Gear); the Legend swapped in for Saburo.' },
      { id: 'dexter_deshawn_off_the_grid', role: 'Call for +2 power or a card; Spend to raise a Gig by up to 2.' },
      { id: 'animals_wrecker', role: 'Printed 10 power: a double steal without help.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal, cheaper for each friendly 8+ Gig.' },
    ],
    signals: [
      { text: 'A Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'A high Gig before Carnage is cast', terms: ['high-gig'] },
      { text: 'A double steal from a 10-power attacker by round 6', terms: ['double-steal', 'ten-power', 'round'] },
    ],
    risks: ['Without Saburo, Yorinobu attacks at 9 and steals one Gig.'],
    source: 'parent',
    status: 'draft',
    basedOn: ['meta-rrg-dexter-midrange.txt'],
  },
  's1-02-mutant-ryy.txt': {
    listId: 'eb4d7d725ffe407d',
    objective: 'YYB Rogue Gear’s cheap Gear and big Yellow bodies with Dexter: Off the Grid in V’s seat, raising Gigs and pumping attackers.',
    plan: [
      { phase: 'early', text: 'Call Viktor to find two cheap Gear; River Ward plays a 2-cost Gear for free.' },
      { phase: 'mid', text: 'Gorilla Arms on an 8-power Rockn’ Rockerboy or Heywood steals an extra Gig; Dexter adds +2 power or a card.' },
      { phase: 'closing', text: 'Minotaur clears a small blocker on arrival; The Relic brings a defeated Unit back.' },
    ],
    keyCards: [
      { id: 'viktor_vektor_sit_down_and_relax', role: 'Call to find up to two Gear costing 2 or less.' },
      { id: 'river_ward_detective_on_the_hunt', role: 'Spend to play a cheap Gear for free, even in the rival’s turn.' },
      { id: 'gorilla_arms', role: 'The first steal each turn takes a second Gig.' },
      { id: 'dexter_deshawn_off_the_grid', role: 'Call for +2 power or a card (the Legend swapped in for V).' },
    ],
    signals: [
      { text: 'Two Gear equipped by round 4', terms: ['gear-equipped', 'round'] },
      { text: 'First Gig stolen by round 3', terms: ['first-steal', 'round'] },
      { text: 'Holding more Gigs than the rival after round 5', terms: ['gig-lead', 'round'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['meta-yyb-rogue-gear.txt'],
  },
  's1-03-mutant-rbg.txt': {
    listId: '1abcf0f14da08881',
    objective: 'Rainbow Fixer Stuff’s Arasaka bodies and bottom-deck removal with Saburo in Padre’s seat, so Arasaka attackers reach the 10-power double steal.',
    plan: [
      { phase: 'early', text: 'Valentino Street Racer gives a 4-drop a same-turn attack; Wakako shrinks a rival Unit or draws.' },
      { phase: 'mid', text: 'Nocturne, Memory Relapse and Unlikely Bond keep the board clear while Psycho Squad and Pepe attack.' },
      { phase: 'closing', text: 'Placide bottom-decks a blocker on play and attack; Adam Smasher goes solo to defeat a Unit.' },
    ],
    keyCards: [
      { id: 'saburo_arasaka_stubborn_patriarch', role: '+1 power to attacking ARASAKA Units (the Legend swapped in for Padre).' },
      { id: 'wakako_okada_peace_and_harmony', role: 'Call for −2 power on a rival Unit or a card; Spend to lower a Gig.' },
      { id: 'placide_voodoo_sentinel', role: '10-power finisher that bottom-decks a rival Unit for a Program.' },
      { id: 'valentino_street_racer', role: 'Gives a cheaper Unit a same-turn attack.' },
    ],
    signals: [
      { text: 'A Unit attacks the turn it entered by round 3', terms: ['same-turn-attack', 'round'] },
      { text: 'Two rival Units removed by effects by round 5', terms: ['removal', 'round'] },
      { text: 'A double steal from a 10-power attacker', terms: ['double-steal', 'ten-power'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['meta-rainbow-fixer-stuff.txt'],
  },
  's1-04-cross-rbg.txt': {
    listId: 'f399d36fac78a13b',
    objective: 'The S1-03 shell with Dexter: Off the Grid in Adam Smasher’s seat: Rainbow Fixer Stuff’s cards with RRG Dexter Midrange’s Gig raising and combat tricks.',
    plan: [
      { phase: 'early', text: 'Valentino Street Racer and 4/6 bodies on curve; Wakako and Dexter Called for a card or a fight trick.' },
      { phase: 'mid', text: 'Bottom-deck and spend rival Units with Unlikely Bond, Nocturne and Memory Relapse while Saburo-boosted attackers steal.' },
      { phase: 'closing', text: 'Placide and Nadia close; Nadia can attack the turn she lands when behind on Gigs.' },
    ],
    keyCards: [
      { id: 'dexter_deshawn_off_the_grid', role: 'Call for +2 power or a card; Spend to raise a Gig.' },
      { id: 'saburo_arasaka_stubborn_patriarch', role: '+1 power to attacking ARASAKA Units.' },
      { id: 'placide_voodoo_sentinel', role: '10-power finisher that bottom-decks a rival Unit.' },
      { id: 'nadia_fighting_through_grief', role: 'Attacks the Gig area the turn she is played when the rival leads.' },
    ],
    signals: [
      { text: 'A Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'Two rival Units removed by effects by round 5', terms: ['removal', 'round'] },
      { text: 'Holding more Gigs than the rival after round 5', terms: ['gig-lead', 'round'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['meta-rainbow-fixer-stuff.txt', 'meta-rrg-dexter-midrange.txt'],
  },
  's1-05-cross-rbb.txt': {
    listId: '9f01127eb8f41dda',
    objective: 'BBG Cunningham Econ’s Blue bottom-deck control with GRY Trauma Team’s Red bodies: remove the rival’s board, then win with Placide and Johnny.',
    plan: [
      { phase: 'early', text: 'Cheap Units (Jacked-In Voodoo Boy, Valentino Guerrera) and Trust No One; Jackie lowers a Gig when a Blue Unit lands.' },
      { phase: 'mid', text: 'Les Élémens, Towerfall and Maman Brigitte bottom-deck rival Units; Alt Cunningham replays a Program from the trash.' },
      { phase: 'closing', text: 'Placide and Johnny Silverhand attack into an empty board; V can go solo for 5.' },
    ],
    keyCards: [
      { id: 'alt_cunningham_soulkiller_architect', role: 'Cheaper Programs per min Gig, and Programs replayed from the trash.' },
      { id: 'jackie_welles_pour_one_out_for_me', role: 'Lowers a Gig when a Blue Unit or Gear is played, drawing at a min Gig.' },
      { id: 'les_elemens', role: 'Bottom-decks the rival’s lowest-power Unit.' },
      { id: 'towerfall', role: 'Board-wide −5 power or bottom-deck at 0 power.' },
      { id: 'placide_voodoo_sentinel', role: '10-power finisher that bottom-decks a rival Unit.' },
    ],
    signals: [
      { text: 'A min Gig by round 3', terms: ['min-gig', 'round'] },
      { text: 'Two rival Units removed by effects by round 5', terms: ['removal', 'round'] },
      { text: 'A program played from the trash', terms: ['program-played'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['meta-bbg-cunningham-econ.txt', 'meta-gry-trauma-team.txt'],
  },
  's1-06-cross-bgy.txt': {
    listId: 'f6bd56f9c63a5b11',
    objective: 'A Program-heavy Blue/Green control list (13 Units) from BBG Cunningham Econ and GRY Trauma Team: stop attackers, draw off value-pairs, and finish with a few big Units.',
    plan: [
      { phase: 'early', text: 'Afterparty, Floor It and Trust No One shape Gigs; Hanako swaps Gigs into value-pairs to draw each turn.' },
      { phase: 'mid', text: 'Chrome Reverie, Nocturne and Memory Relapse stop rival attacks; Take Control blunts a steal.' },
      { phase: 'closing', text: 'Trauma Team Operatives and Placide attack once the rival’s board is spent or gone.' },
    ],
    keyCards: [
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'Spend to swap Gigs; draws for each friendly value-pair.' },
      { id: 'alt_cunningham_soulkiller_architect', role: 'Cheaper Programs per min Gig, and Programs replayed from the trash.' },
      { id: 'chrome_reverie', role: 'A rival Unit can’t attack until your next turn.' },
      { id: 'placide_voodoo_sentinel', role: '10-power finisher that bottom-decks a rival Unit.' },
    ],
    signals: [
      { text: 'A value-pair by round 3', terms: ['value-pair', 'round'] },
      { text: 'Two extra cards drawn by round 4', terms: ['cards-drawn', 'round'] },
      { text: 'A rival Gig attack held off', terms: ['defence-held'] },
    ],
    risks: ['Only 13 Units: running out of threats loses the race.'],
    source: 'parent',
    status: 'draft',
    basedOn: ['meta-bbg-cunningham-econ.txt', 'meta-gry-trauma-team.txt'],
  },
  's1-07-explorer-ryy.txt': {
    listId: '3066980fc1c3c3a2',
    objective: 'Yellow Gear and big bodies around three untested Legends: River Ward’s free Gear, Johnny Silverhand’s attacks on spent Units, and Kerry’s draws off Gig rolls.',
    plan: [
      { phase: 'early', text: 'Cheap Units and Satori or Gorilla Arms played for free with River Ward.' },
      { phase: 'mid', text: 'Johnny lets a fresh Unit attack spent rival Units; Minotaur and Live with the Aftermath clear blockers.' },
      { phase: 'closing', text: '8- and 9-power Units with Gorilla Arms steal two Gigs; The Relic replays a defeated Unit.' },
    ],
    keyCards: [
      { id: 'river_ward_detective_on_the_hunt', role: 'Spend to play a Gear costing 2 or less for free.' },
      { id: 'johnny_silverhand_rocking_renegade', role: 'A Unit attacks spent rival Units the turn it is played.' },
      { id: 'kerry_eurodyne_axe_attitude_audience', role: 'Rerolls a Gig roll-in and draws on min or max rolls.' },
      { id: 'gorilla_arms', role: 'The first steal each turn takes a second Gig.' },
    ],
    signals: [
      { text: 'Two Gear equipped by round 4', terms: ['gear-equipped', 'round'] },
      { text: 'A fight won against a spent rival Unit', terms: ['fight-won'] },
      { text: 'Holding more Gigs than the rival after round 5', terms: ['gig-lead', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'draft',
  },
  's1-08-explorer-bgg.txt': {
    listId: '693057e28a588ff7',
    objective: 'Green Arasaka attackers around three untested Legends: Saburo’s attack bonus, Hanako’s value-pair draws and Judy’s Braindance boosts, with Green and Blue removal.',
    plan: [
      { phase: 'early', text: 'Valentino Street Racer and Pepe on curve; Hanako swaps toward a value-pair.' },
      { phase: 'mid', text: 'Overwatch, Memory Relapse and Unlikely Bond remove or stop blockers while Psycho Squad and Pepe attack.' },
      { phase: 'closing', text: '(Don’t Fear) The Reaper and Wild in the Streets clear the way for Placide and Nadia.' },
    ],
    keyCards: [
      { id: 'saburo_arasaka_stubborn_patriarch', role: '+1 power to attacking ARASAKA Units.' },
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'Spend to swap Gigs; draws for each friendly value-pair.' },
      { id: 'placide_voodoo_sentinel', role: '10-power finisher that bottom-decks a rival Unit for a Program.' },
      { id: 'don_t_fear_the_reaper', role: 'Spends every rival Unit, then defeats one.' },
    ],
    signals: [
      { text: 'A value-pair by round 3', terms: ['value-pair', 'round'] },
      { text: 'A Unit attacks the turn it entered by round 3', terms: ['same-turn-attack', 'round'] },
      { text: 'Two rival Units removed by effects by round 5', terms: ['removal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'draft',
  },
};
