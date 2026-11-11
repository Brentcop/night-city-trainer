// Deck objectives for the sim-ladder decks (data/decks/ladder-*.txt): Legend trios the owner brought in from the
// cyberpunk-tcg-sim.online Master ladder, with main decks theorized here. The owner writes these notes; until then each
// entry is a minimal PLACEHOLDER read off the list (Legends, curve, card text) and nothing more. Replace the entry's
// text, drop `placeholder`, and set `status: 'owner'`.
import type { ObjectiveTable } from './vocabulary';

export const LADDER_OBJECTIVES: ObjectiveTable = {
  'ladder-bbg-jackie-alt-hanako.txt': {
    listId: 'e7b0b38e8ab5b225',
    objective: 'Placeholder from the list: a Blue control shell that lowers Gigs for cheap Programs, answers Units with bottom-deck effects and Towerfall, and wins late with Placide.',
    plan: [
      { phase: 'early', text: 'Placeholder: set up min Gigs and value-pairs (Trust No One, Jackie) and dig with Three Mouths One Desire.' },
      { phase: 'closing', text: 'Placeholder: clear the board with Les Élémens, Maman Brigitte and Towerfall, then attack with Placide.' },
    ],
    keyCards: [
      { id: 'jackie_welles_pour_one_out_for_me', role: 'Legend: lowers a Gig on the first Blue play each turn; draws at a min Gig.' },
      { id: 'alt_cunningham_soulkiller_architect', role: 'Legend: discounts Programs per min Gig and replays one from the trash.' },
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'Legend: swaps Gigs; draws per value-pair each turn.' },
      { id: 'towerfall', role: 'Sweeper.' },
    ],
    signals: [
      { text: 'A min Gig by round 2', terms: ['min-gig', 'round'] },
      { text: 'A sweep or two removals by round 5', terms: ['sweep', 'removal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'needs-owner',
    placeholder: true,
  },

  'ladder-rrb-dexter-v-wakako.txt': {
    listId: 'b16b316cfec88abb',
    objective: 'Placeholder from the list: a Red curve of 4-cost 6-power Units and removal, with Dexter and Wakako Calls tipping fights and 10-power finishers to close.',
    plan: [
      { phase: 'early', text: 'Placeholder: a 4-cost 6-power Unit from your second turn (6th Street Recruits, Psycho Squad).' },
      { phase: 'closing', text: 'Placeholder: clear blockers with Bonnie and Clyde or Carnage, then attack with Animals Wrecker or Yorinobu.' },
    ],
    keyCards: [
      { id: 'dexter_deshawn_off_the_grid', role: 'Legend: +2 power to a Unit or draw 1; raises a Gig by up to 2.' },
      { id: 'wakako_okada_peace_and_harmony', role: 'Legend: −2 power to a rival Unit or draw 1; lowers a Gig.' },
      { id: 'v_streetkid', role: 'Legend: Call trashes 3 and returns a Braindance Program; Go Solo for 5.' },
      { id: 'animals_wrecker', role: '10-power Unit.' },
    ],
    signals: [
      { text: 'A Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'A 10-power attack by round 6', terms: ['ten-power', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'needs-owner',
    placeholder: true,
  },

  'ladder-rrg-v-smasher-padre.txt': {
    listId: 'f375b2d8199f4566',
    objective: 'Placeholder from the list: a Red/Green curve of 4–6 cost bodies with Red removal, Padre spending blockers, and Adam Smasher or 10-power Units to close.',
    plan: [
      { phase: 'early', text: 'Placeholder: a 4-cost 6-power Unit from your second turn (6th Street Recruits, Pepe Najarro).' },
      { phase: 'closing', text: 'Placeholder: Padre spends a blocker, then Animals Wrecker, Yorinobu or a Go Solo Adam Smasher attacks.' },
    ],
    keyCards: [
      { id: 'adam_smasher_ender_of_legends', role: 'Legend: Go Solo for 9 defeats a rival Unit and attacks.' },
      { id: 'padre_man_of_the_cross', role: 'Legend: Call spends a rival Unit or draws; sets a Gig to match another.' },
      { id: 'v_streetkid', role: 'Legend: Call trashes 3 and returns a Braindance Program; Go Solo for 5.' },
      { id: 'maxtac_av', role: '8-power Unit that swaps Gigs.' },
    ],
    signals: [
      { text: 'A Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'A Legend played with Go Solo by round 6', terms: ['go-solo', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'needs-owner',
    placeholder: true,
  },

  'ladder-rrg-v-smasher-saburo.txt': {
    listId: '779315ff7aa233e2',
    objective: 'Placeholder from the list: a Red/Green curve with removal where Saburo lifts Yorinobu and Adam Smasher to 10 power for two-Gig steals.',
    plan: [
      { phase: 'early', text: 'Placeholder: a 4-cost 6-power Unit from your second turn (6th Street Recruits, Pepe Najarro).' },
      { phase: 'closing', text: 'Placeholder: attack with Saburo-boosted Yorinobu or Adam Smasher, or Animals Wrecker, for two Gigs.' },
    ],
    keyCards: [
      { id: 'saburo_arasaka_stubborn_patriarch', role: 'Legend: +1 power to attacking Arasaka Units.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Legend: Go Solo for 9 defeats a rival Unit and attacks.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: '9-power Arasaka Unit that replays a 4-cost Unit.' },
      { id: 'animals_wrecker', role: '10-power Unit.' },
    ],
    signals: [
      { text: 'A Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'A two-Gig steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'needs-owner',
    placeholder: true,
  },

  'ladder-ryy-smasher-river-viktor.txt': {
    listId: '2ed4d4b9d64f948f',
    objective: 'Placeholder from the list: Yellow Gear on mid-cost bodies, with Viktor finding cheap Gear, River playing it for free, and Adam Smasher to close.',
    plan: [
      { phase: 'early', text: 'Placeholder: Call Viktor for cheap Gear; put it on 3–4 cost Units (Dexter DeShawn, 6th Street Recruits).' },
      { phase: 'closing', text: 'Placeholder: Gorilla Arms and the 8-power Units push Gigs; Adam Smasher Goes Solo to finish.' },
    ],
    keyCards: [
      { id: 'viktor_vektor_sit_down_and_relax', role: 'Legend: Call finds up to two Gear costing 2 or less.' },
      { id: 'river_ward_detective_on_the_hunt', role: 'Legend: plays a Gear costing 2 or less for free at Quick speed.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Legend: Go Solo for 9 defeats a rival Unit and attacks.' },
      { id: 'gorilla_arms', role: 'Gear (+3 power): the first steal each turn takes an extra Gig.' },
    ],
    signals: [
      { text: 'Two Units or Legends with Gear equipped by round 3', terms: ['gear-equipped', 'round'] },
      { text: 'First Gig stolen by round 3', terms: ['first-steal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'needs-owner',
    placeholder: true,
  },
};
