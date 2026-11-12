// Deck objectives for the sim-ladder decks (data/decks/ladder-*.txt): Legend trios the owner brought in from the
// cyberpunk-tcg-sim.online Master ladder, with main decks theorized here. The owner asked for agent-written drafts
// instead of writing these from scratch: each entry is read off the list (Legends, curve, card text and scripts) with
// its central synergy packages, and has not been checked by the owner yet. To correct one, edit it and set
// `status: 'owner'`.
import type { ObjectiveTable } from './vocabulary';

export const LADDER_OBJECTIVES: ObjectiveTable = {
  'ladder-bbg-jackie-alt-hanako.txt': {
    listId: 'e7b0b38e8ab5b225',
    objective: 'Blue control: hold your own Gigs at their minimum so the Programs get cheaper and dig deeper, bottom-deck the rival’s Units one by one, and win late with Placide.',
    plan: [
      { phase: 'early', text: 'Sell and Call Jackie or Alt on turn one. Roll the d4 in early and take it to 1 with Trust No One, or let Jackie lower a Gig when you play Psycho Squad or Dying Night. Two Gigs at 1 are also a value-pair, so Hanako draws an extra card each turn.' },
      { phase: 'mid', text: 'Trade with Psycho Squad and Pepe and answer threats one at a time: Pyramid Song (both modes while the d4 shows 1), Les Élémens, Maman Brigitte. Alt’s Spend takes 1 €$ off the next Program per min Gig, or replays a removal Program from the trash.' },
      { phase: 'mid', text: 'Save Towerfall for a turn you are behind on Street Cred: both modes then remove every rival Unit of 5 power or less, and a Floor It first brings one 6-power Unit into range. Hanako’s or MaxTac AV’s swap can take a rival’s 8+ Gig, but it raises your Street Cred, so not on a Towerfall turn.' },
      { phase: 'closing', text: 'Placide attacks for 10 and steals two Gigs, bottom-decking a Unit for one discarded Program as it enters and on each attack; Chrome Reverie and Nocturne keep the rival’s best attacker home.' },
    ],
    keyCards: [
      { id: 'jackie_welles_pour_one_out_for_me', role: 'Legend: your first Blue Unit or Gear each turn lowers a Gig by up to 2, and draws if it lands on the minimum.' },
      { id: 'alt_cunningham_soulkiller_architect', role: 'Legend: discounts the next Program per min Gig, or replays a Program from the trash for 1 €$.' },
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'Legend: draws per value-pair at the start of your turn (two Gigs at 1 count); Spend swaps a Gig with the rival.' },
      { id: 'three_mouths_one_desire', role: 'Card selection: keeps one extra card per friendly min Gig.' },
      { id: 'towerfall', role: 'Sweeper: with less Street Cred than the rival, removes every rival Unit of 5 power or less.' },
      { id: 'placide_voodoo_sentinel', role: 'Finisher: 10 power, and bottom-decks a rival Unit on entering and on each attack.' },
    ],
    signals: [
      { text: 'A min Gig by round 2', terms: ['min-gig', 'round'] },
      { text: 'Three or more extra cards drawn by round 4', terms: ['cards-drawn', 'round'] },
      { text: 'Two rival Units removed by card effects by round 5', terms: ['removal', 'round'] },
      { text: 'Placide attacks at 10 power by round 7', terms: ['ten-power', 'round'] },
    ],
    risks: [
      'Wide boards of 6-power Units: Les Élémens, Pyramid Song, Maman Brigitte and Placide take one Unit each, and even both modes of Towerfall leave a 6-power Unit standing.',
      'Maman Brigitte only hits unequipped Units, so against Gear decks the cheap bottom-deck answer is often off.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['min-gig', 'program-fuel', 'low-cred'],
  },

  'ladder-rrb-dexter-v-wakako.txt': {
    listId: 'b16b316cfec88abb',
    objective: 'Red midrange with Blue tricks: curve 4-cost 6-power Units, tip fights with Dexter and Wakako Calls, clear blockers with Red removal and finish with 10-power attackers.',
    plan: [
      { phase: 'early', text: 'A 2- or 3-drop, then a 4/6 each turn (6th Street Recruits, Psycho Squad). Mantis Blades on Swordwise Huscle makes it 5 power, so it draws when it attacks. Keep a fixer Legend face-down when you can: Called in a fight, Dexter gives your Unit +2 and Wakako gives theirs −2.' },
      { phase: 'mid', text: 'Split your Gigs: Wakako’s Spend or Trust No One holds one at 1 (Chrome Reverie then Calls a Legend for free), while Dexter’s Spend and 6th Street Recruits push another to 8+ so Carnage costs less. Bonnie and Clyde and Carnage clear the way; V’s Call trashes 3 and returns one of them.' },
      { phase: 'closing', text: 'Animals Wrecker attacks for 10 and steals two Gigs; Yorinobu replays a 4/6 from hand or trash for free. Nocturne stops the rival’s best attacker or lets V Go Solo for 3; Over the Edge comes online once your d20 is rolled in.' },
    ],
    keyCards: [
      { id: 'dexter_deshawn_off_the_grid', role: 'Legend: Call for +2 power to a Unit or a card; Spend raises a Gig by up to 2 toward 8+.' },
      { id: 'wakako_okada_peace_and_harmony', role: 'Legend: Call for −2 power to a rival Unit or a card; Spend lowers a Gig by up to 2.' },
      { id: 'v_streetkid', role: 'Legend: Call trashes 3 and returns a Braindance Program (Bonnie and Clyde, Carnage); Go Solo for 5.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal that costs 1 less per friendly 8+ Gig.' },
      { id: 'animals_wrecker', role: '10 power for 6: steals two Gigs without help.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Top end: replays a 4-cost Unit from hand or trash for free.' },
    ],
    signals: [
      { text: 'A 4-cost Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'Dexter or Wakako Called during a rival attack', terms: ['call-in-react'] },
      { text: 'An 8+ Gig held by round 5', terms: ['high-gig', 'round'] },
      { text: 'A 10-power attack by round 6', terms: ['ten-power', 'round'] },
    ],
    risks: [
      'Over the Edge needs a friendly d20, the last Gig you roll in: it usually sits in hand until your sixth turn unless you steal one.',
      'Lowering your own Gigs (Wakako, Trust No One) can leave you behind on Street Cred, and then Gunpoint Diplomacy gives only the effect the rival picks.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['braindance', 'high-gig'],
  },

  'ladder-rrg-v-smasher-padre.txt': {
    listId: 'f375b2d8199f4566',
    objective: 'Red/Green midrange: curve 4/6s into 8-power MaxTac AVs, spend or remove the rival’s blockers, and use Padre’s Gig-setting for value-pairs and 8+ Gigs before Animals Wrecker and Adam Smasher close.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one, then a 4/6 each turn (6th Street Recruits, Pepe Najarro). Valentino Street Racer gives a 4- or 5-cost Unit Adrenaline for an attack the rival didn’t plan for.' },
      { phase: 'mid', text: 'Padre’s Call or Memory Relapse spends a rival Unit, so it can’t block and can be attacked. Padre’s Spend sets your Gig to a rival’s value: match another of your Gigs for a value-pair (Pepe’s attack then readies V and Adam Smasher to pay again), or copy an 8+ for Carnage and Kerry. MaxTac AV can swap for the rival’s 8+.' },
      { phase: 'closing', text: 'Animals Wrecker steals two at 10 power. Yorinobu (9) and a Go Solo Adam Smasher (9, defeats a Unit as he enters) need Mantis Blades, Satori or Gunpoint Diplomacy to reach 10; Bonnie and Clyde and Carnage clear the last blockers.' },
    ],
    keyCards: [
      { id: 'padre_man_of_the_cross', role: 'Legend: Call spends a rival Unit or draws; Spend sets a Gig to another player’s Gig value.' },
      { id: 'pepe_najarro_working_doubles', role: 'A 4/6 that readies face-up MERC Legends (V, Adam Smasher) when it attacks with a value-pair.' },
      { id: 'maxtac_av', role: '8 power for 5; may swap a friendly Gig for a rival’s when played.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Legend: Go Solo for 9 defeats a rival Unit and attacks the same turn.' },
      { id: 'animals_wrecker', role: '10 power for 6: the deck’s only double steal without Gear.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal that costs 1 less per friendly 8+ Gig.' },
    ],
    signals: [
      { text: 'A 4-cost Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'A value-pair held by round 4', terms: ['value-pair', 'round'] },
      { text: 'A Unit attacks the turn it entered (Street Racer or Go Solo) by round 5', terms: ['same-turn-attack', 'round'] },
      { text: 'A two-Gig steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: [
      'Only Animals Wrecker reaches 10 power by itself: without Saburo, Yorinobu and Adam Smasher steal one Gig unless they carry Gear or Gunpoint Diplomacy.',
      'Over the Edge needs a friendly d20, the last Gig you roll in, so it is a late card.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['value-pair', 'high-gig', 'braindance'],
  },

  'ladder-rrg-v-smasher-saburo.txt': {
    listId: '779315ff7aa233e2',
    objective: 'Red/Green curve deck where Saburo lifts Yorinobu and a Go Solo Adam Smasher to 10 power, so with Animals Wrecker the late game steals two Gigs per attack.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one, then a 4/6 each turn (6th Street Recruits, Pepe Najarro). Saburo’s bonus only works face-up, so make sure he is Called before the first Yorinobu or Smasher attacks.' },
      { phase: 'mid', text: 'Clear blockers with Bonnie and Clyde, Memory Relapse (the spent Unit can then be attacked) and Carnage, which gets cheaper per friendly 8+ Gig (6th Street Recruits raises one after a d6 steal). V’s Call trashes 3 and returns a Braindance Program; 4-cost Units it trashes can come back with Yorinobu.' },
      { phase: 'closing', text: 'Yorinobu replays a 4/6 from hand or trash and attacks for 10 the next turn; Adam Smasher Goes Solo, defeats a Unit and attacks for 10 at once; Animals Wrecker is 10 on its own.' },
    ],
    keyCards: [
      { id: 'saburo_arasaka_stubborn_patriarch', role: 'Legend: ARASAKA Units get +1 power while attacking, turning the 9-power Yorinobu and Smasher into double steals.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Legend: Go Solo for 9 defeats a rival Unit and attacks at 10 with Saburo.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Replays a 4-cost Unit from hand or trash; attacks at 10 with Saburo.' },
      { id: 'animals_wrecker', role: '10 power for 6: steals two Gigs without help.' },
      { id: 'v_streetkid', role: 'Legend: Call trashes 3 and returns a Braindance Program (Bonnie and Clyde, Carnage, Memory Relapse).' },
      { id: 'carnage_at_the_colosseum', role: 'Removal that costs 1 less per friendly 8+ Gig.' },
    ],
    signals: [
      { text: 'A 4-cost Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'Saburo face-up before the first Yorinobu or Smasher attack', terms: ['legend-face-up'] },
      { text: 'A two-Gig steal by round 6', terms: ['double-steal', 'ten-power', 'round'] },
      { text: 'Gig lead held entering round 5', terms: ['gig-lead', 'round'] },
    ],
    risks: [
      'Saburo has nothing to boost until the 7-cost Yorinobu or the 9-cost Go Solo (Field Operator is the only cheap ARASAKA Unit), so the early game is a plain 4/6 curve.',
      'Over the Edge needs a friendly d20, the last Gig you roll in, so it is a late card.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['arasaka', 'braindance', 'high-gig'],
  },

  'ladder-ryy-smasher-river-viktor.txt': {
    listId: '2ed4d4b9d64f948f',
    objective: 'Yellow Gear aggro: arm Units and face-up Legends with cheap Gear, keep Gig values mixed so the Yellow cards draw and Jackie hits hard, steal extra Gigs with Gorilla Arms, and close with Adam Smasher.',
    plan: [
      { phase: 'early', text: 'Sell and Call Viktor to pull up to two 2-cost Gear from the top five. Then Dexter DeShawn: One Last Chance (adjusts a Gig on play and on attack) and the 4-drops (6th Street Recruits, Kerry); River’s Quick Spend plays a 2-cost Gear for free, even on the rival’s turn.' },
      { phase: 'mid', text: 'Zetatech Faceplate on a face-up Legend adjusts a Gig, and may draw, every time that Legend pays; Alt Cunningham: Mother of Daemons draws whenever an equipped Unit or Legend is spent. Gorilla Arms takes an extra Gig on the first steal each turn; The Heist plays it free while a friendly Gig shows 4.' },
      { phase: 'mid', text: 'Keep both even and odd Gigs: Jackie Welles: Ride or Die gets +2 per even Gig when he attacks (one makes him a 10), and Afterparty and Bootleg Black Sapphire Show draw on mixed values. Live with the Aftermath costs you your weakest Unit (T-Bug Calls a Legend for free when defeated); it is best when the rival has a single Unit.' },
      { phase: 'closing', text: 'Adam Smasher Goes Solo, defeats a Unit and attacks; a free 2-cost Gear from River (Adrenaline Converter, +3) lifts him past 10 for a double steal. MaxTac Suppression Team stops the rival’s same-turn attacks on the swing back.' },
    ],
    keyCards: [
      { id: 'viktor_vektor_sit_down_and_relax', role: 'Legend: Call finds up to two Gear costing 2 or less in the top five.' },
      { id: 'river_ward_detective_on_the_hunt', role: 'Legend: Quick Spend plays a 2-cost-or-less Gear from hand for free.' },
      { id: 'gorilla_arms', role: 'Gear (+3 power): the first steal each turn takes an extra rival Gig.' },
      { id: 'jackie_welles_ride_or_die_choom', role: '8-power attacker that gains +2 per friendly even Gig.' },
      { id: 'alt_cunningham_mother_of_daemons', role: 'Draws whenever an equipped Unit or Legend is spent; can discard to stop a steal.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Legend: Go Solo for 9 defeats a rival Unit and attacks the same turn.' },
    ],
    signals: [
      { text: 'Two Units or Legends with Gear equipped by round 3', terms: ['gear-equipped', 'round'] },
      { text: 'First Gig stolen by round 3', terms: ['first-steal', 'round'] },
      { text: 'Jackie or Adam Smasher attacks at 10+ power by round 6', terms: ['ten-power', 'round'] },
    ],
    risks: [
      'Only four Gear cost 2 or less (two Adrenaline Converter, two Zetatech Faceplate), so Viktor’s Call often finds none and River has little to play; the three Gorilla Arms must be drawn or found with The Heist.',
      'In bot games (228), an equipped Unit or Legend with River or Alt Cunningham in play came up in under a third of games: the Gear engine assembles more slowly than the card counts suggest.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['gear-equipped', 'cyberware', 'gig-spread'],
  },
};
