// Deck objectives for the bred decks of the earlier seasons 1–3, archived at the 2026-11-11 baseline
// (data/decks/archive/s1-*, s2-*, s3-*; see ./archived.ts). Drafts from the list and, for mutants and crossovers, from
// the parent decks' notes plus what changed. Parent files named in `basedOn` may be archived too.
import type { ObjectiveTable } from './vocabulary';

export const BRED_EARLY_OBJECTIVES: ObjectiveTable = {
  // ---------------- Season 1 ----------------
  's1-01-mutant-rrb.txt': {
    listId: '5d650e35c67b3bf8',
    objective: 'RRG Dexter Midrange without Saburo: a curve of 6-power bodies and Red removal, with V: Corporate Exile as an 8-power Go Solo threat instead of the Arasaka power boost.',
    plan: [
      { phase: 'early', text: 'Play 6th Street Recruits or Psycho Squad on curve and trade removal (Bonnie and Clyde, Over the Edge) for the rival’s first Units.' },
      { phase: 'mid', text: 'Go Solo with V at 5 €$ for a same-turn 8-power attack; raise Gigs with Dexter’s Spend to discount Carnage.' },
      { phase: 'closing', text: 'Close with the natural 10-power Animals Wrecker, Yorinobu: Steel Dragon replaying a 4-drop, or a 9 €$ Adam Smasher that defeats a Unit as it lands.' },
    ],
    keyCards: [
      { id: 'v_corporate_exile', role: 'Go Solo for 5: a ready 8-power attacker the turn it lands (the Legend swapped in for Saburo).' },
      { id: 'dexter_deshawn_off_the_grid', role: 'Call for +2 power or a card; Spend to raise a Gig by 2 toward 8+.' },
      { id: 'animals_wrecker', role: 'Printed 10 power: the double steal that no longer needs Saburo.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal that gets cheaper for each friendly 8+ Gig.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Late Go Solo that defeats the rival’s best Unit on arrival.' },
    ],
    signals: [
      { text: 'A Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'V played with Go Solo and attacking the same turn by round 4', terms: ['go-solo', 'same-turn-attack', 'round'] },
      { text: 'A double steal from a 10-power attacker by round 6', terms: ['double-steal', 'ten-power', 'round'] },
      { text: 'A high Gig before Carnage is cast', terms: ['high-gig'] },
    ],
    risks: [
      'Like its parent (RRG Dexter Midrange guide), its big threats are few, so bottom-deck effects on Animals Wrecker, Yorinobu or Adam hurt it.',
      'Without Saburo, Yorinobu and Adam attack at 9 and steal one Gig, not two.',
    ],
    source: 'parent',
    status: 'draft',
    basedOn: ['meta-rrg-dexter-midrange.txt'],
  },

  's1-02-mutant-bgy.txt': {
    listId: 'cb9875960769cd78',
    objective: 'A YYB Rogue Gear offshoot that trades River Ward for Saburo: Gig-adjusting value cards and Blue tempo into big Jackie Welles and Placide attacks.',
    plan: [
      { phase: 'early', text: 'Call Viktor to pull two cheap Gear; land Dexter: One Last Chance and adjust Gigs with him, Afterparty and Faceplate.' },
      { phase: 'mid', text: 'Hold rival attackers off with Chrome Reverie, Nocturne and Memory Relapse while Pepe and Psycho Squad take Gigs; a value-pair lets Pepe ready V for mana.' },
      { phase: 'closing', text: 'Jackie Welles: Ride or Die gains +2 per even Gig; Placide bottom-decks a blocker on play and attack.' },
    ],
    keyCards: [
      { id: 'viktor_vektor_sit_down_and_relax', role: 'Call to find up to two Gear costing 2 or less.' },
      { id: 'dexter_deshawn_one_last_chance', role: 'Cheap body that adjusts a Gig on play and attack, to shape even values and pairs.' },
      { id: 'jackie_welles_ride_or_die_choom', role: 'Main attacker: +2 power per friendly even Gig.' },
      { id: 'pepe_najarro_working_doubles', role: 'With a value-pair, readies MERC Legends (V) on attack.' },
      { id: 'placide_voodoo_sentinel', role: '10-power finisher that bottom-decks a rival Unit by discarding a Program.' },
    ],
    signals: [
      { text: 'Two Gear equipped by round 4', terms: ['gear-equipped', 'round'] },
      { text: 'A value-pair in place when Pepe attacks', terms: ['value-pair'] },
      { text: 'A double steal from Jackie or Placide by round 6', terms: ['double-steal', 'ten-power', 'round'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['meta-yyb-rogue-gear.txt'],
  },

  's1-03-mutant-rrr.txt': {
    listId: '3bc8aed8aa138d9a',
    objective: 'NC-07’s Red Dexter core with Yorinobu: Embracing Destruction in Judy’s seat: Arasaka attacks draw cards while Industrial Assembly and Dexter build high Gigs for Kerry and Carnage.',
    plan: [
      { phase: 'early', text: 'Use Industrial Assembly and Dexter’s Spend to get an 8+ Gig; curve 6th Street Recruits and Kerry: The Last Rockerboy.' },
      { phase: 'mid', text: 'Spend Kerry to draw 2 off the high Gig; clear blockers with Bonnie and Clyde, Over the Edge and cheap Carnage.' },
      { phase: 'closing', text: 'Animals Wrecker and Yorinobu: Steel Dragon attack for big steals; each Arasaka attack draws a card.' },
    ],
    keyCards: [
      { id: 'yorinobu_arasaka_embracing_destruction', role: 'Draws when an Arasaka Unit first attacks each turn (the Legend swapped in for Judy).' },
      { id: 'industrial_assembly', role: 'Raise a Gig by 4 to reach 8+, drawing if one is already there.' },
      { id: 'kerry_eurodyne_the_last_rockerboy', role: 'Spend to draw 2 while you control an 8+ Gig.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal discounted by each 8+ Gig.' },
      { id: 'animals_wrecker', role: '10-power finisher that steals two Gigs.' },
    ],
    signals: [
      { text: 'A high Gig by round 3', terms: ['high-gig', 'round'] },
      { text: 'Two or more extra cards drawn by round 4', terms: ['cards-drawn', 'round'] },
      { text: 'A double steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: ['Like its parent (NC-07 guide), it relies on a few big threats that bottom-deck effects answer cleanly.'],
    source: 'parent',
    status: 'draft',
    basedOn: ['nc-07-braindance-burn-rrb.txt'],
  },

  's1-04-cross-rbg.txt': {
    listId: 'fa0b6f14f3d893e1',
    objective: 'Crossing YYB Rogue Gear with RRG Dexter Midrange into a three-colour MERC/Arasaka deck: Street Racer surprise attacks, value-pairs for Pepe, and V, Adam Smasher and Placide as the threats.',
    plan: [
      { phase: 'early', text: 'Set up a value-pair with Peace Offering; play Pepe or Psycho Squad on curve.' },
      { phase: 'mid', text: 'Pepe’s attack readies V and Adam for extra mana; Street Racer gives a fresh 4–5 drop a same-turn attack. Over the Edge and Royce clear small blockers.' },
      { phase: 'closing', text: 'Adam Smasher hits as a 10 with Saburo; Placide bottom-decks the last blocker.' },
    ],
    keyCards: [
      { id: 'saburo_arasaka_stubborn_patriarch', role: '+1 power to attacking Arasaka Units: Adam reaches 10.' },
      { id: 'pepe_najarro_working_doubles', role: 'With a value-pair, readies V and Adam (MERC Legends) on attack.' },
      { id: 'valentino_street_racer', role: 'Gives another Unit costing 5 or less Adrenaline for a surprise attack.' },
      { id: 'peace_offering', role: 'Makes a value-pair and draws.' },
      { id: 'placide_voodoo_sentinel', role: 'Late 10-power finisher with bottom-deck removal.' },
    ],
    signals: [
      { text: 'A value-pair by round 3', terms: ['value-pair', 'round'] },
      { text: 'A same-turn attack from a Street Racer target', terms: ['same-turn-attack'] },
      { text: 'Adam Smasher played with Go Solo and stealing two Gigs', terms: ['go-solo', 'double-steal'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['meta-yyb-rogue-gear.txt', 'meta-rrg-dexter-midrange.txt'],
  },

  's1-05-cross-rgy.txt': {
    listId: '773f35ff541ef802',
    objective: 'Crossing NC-02 Stormrider Stampede with YYY Adam: a Green-Red board of 6–8 power Units that uses Gig manipulation and Kerry’s rerolls for cards, closing with Saul Bright and Adam Smasher.',
    plan: [
      { phase: 'early', text: 'Curve Maelstrom Goons and 6th Street Recruits; Kerry: Axe, Attitude, Audience rerolls rolled-in Gigs and draws on min or max rolls.' },
      { phase: 'mid', text: 'MaxTac AV swaps your low Gig for the rival’s best; Jackie Welles: Ride or Die grows on even Gigs; Memory Relapse spends a blocker before you attack.' },
      { phase: 'closing', text: 'Saul Bright (14 power) pumps every other attacker; Adam Smasher attacks as a 10 with Saburo.' },
    ],
    keyCards: [
      { id: 'kerry_eurodyne_axe_attitude_audience', role: 'Reroll a rolled-in Gig; draw on min or max (3 on a d20).' },
      { id: 'maxtac_av', role: '8-power body that swaps a friendly Gig with a rival Gig on play.' },
      { id: 'jackie_welles_ride_or_die_choom', role: '+2 power per even friendly Gig when it attacks.' },
      { id: 'saul_bright_stormrider', role: '14-power closer giving other attackers +2 and readying three Units.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Go Solo removal plus a 10-power attacker with Saburo.' },
    ],
    signals: [
      { text: 'Extra cards drawn from Gig rolls by round 3', terms: ['cards-drawn', 'round'] },
      { text: 'Three or more Units on the field by round 4', terms: ['units-on-field', 'round'] },
      { text: 'A double steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: ['Like NC-02 (its guide), a board of several Units is exposed to sweepers such as Towerfall and Live with the Aftermath.'],
    source: 'parent',
    status: 'draft',
    basedOn: ['nc-02-stormrider-stampede-ggr.txt', 'YYY-yyy-adam-ready-for-brawl.txt'],
  },

  's1-06-cross-rgg.txt': {
    listId: '761db37f5a335abd',
    objective: 'Crossing the RRG V + Dexter shell with NC-05 Emperor’s Guard: Hanako’s value-pair card draw and spend-then-defeat removal behind 6–8 power Units, ending with Saul Bright.',
    plan: [
      { phase: 'early', text: 'Make value-pairs with Peace Offering so Hanako draws each turn; curve 6th Street Recruits and Pepe.' },
      { phase: 'mid', text: 'MaxTac AV and Hanako’s Spend swap Gigs; Memory Relapse spends a rival Unit, then Wild in the Streets defeats it.' },
      { phase: 'closing', text: '(Don’t Fear) The Reaper spends the whole rival board and kills one; Saul Bright swings with +2 for every other attacker.' },
    ],
    keyCards: [
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'Draw 1 per friendly value-pair each turn; Spend to swap Gigs.' },
      { id: 'peace_offering', role: 'Sets a Gig to match another for a value-pair, then draws.' },
      { id: 'wild_in_the_streets', role: 'Defeats a spent Unit (after an attack or a spend effect).' },
      { id: 'don_t_fear_the_reaper', role: 'Spends all rival Units, then defeats one: clears the way for a big swing.' },
      { id: 'saul_bright_stormrider', role: '14-power closer that pumps the other attackers.' },
    ],
    signals: [
      { text: 'A value-pair by round 3', terms: ['value-pair', 'round'] },
      { text: 'Extra cards drawn from Hanako on two turns by round 5', terms: ['cards-drawn', 'round'] },
      { text: 'A rival Unit removed by an effect by round 4', terms: ['removal', 'round'] },
      { text: 'A double steal by round 7', terms: ['double-steal', 'round'] },
    ],
    risks: ['Like NC-05 (its guide), spend effects only buy a turn against a single 10-power Unit.'],
    source: 'parent',
    status: 'draft',
    basedOn: ['rrg-v-dexter-optimized.txt', 'nc-05-emperor-s-guard-ggb.txt'],
  },

  's1-07-explorer-bbg.txt': {
    listId: '3cc5f10c30d498a7',
    objective: 'An untested V / Sasha / Saburo trio built as Blue control: min-Gig card draw and bottom-deck removal, with two Go Solo Legends as the threats.',
    plan: [
      { phase: 'early', text: 'Trust No One drops a Gig to its minimum to turn on Three Mouths and Pyramid Song’s double mode.' },
      { phase: 'mid', text: 'Answer threats with Pyramid Song, Les Élémens and Maman Brigitte; Chrome Reverie stops an attacker and can Call a Legend for free.' },
      { phase: 'closing', text: 'Towerfall clears the board; V and Sasha Go Solo for same-turn attacks and Placide closes.' },
    ],
    keyCards: [
      { id: 'trust_no_one', role: 'Lowers a Gig to min, drawing a card, to switch on the Blue min-Gig bonuses.' },
      { id: 'three_mouths_one_desire', role: 'Digs for answers; extra card per min Gig.' },
      { id: 'les_elemens', role: 'Bottom-decks the rival’s lowest-power Unit.' },
      { id: 'towerfall', role: 'Sweeper: -5 to all rival Units or bottom-deck those at 0 (both when behind on Street Cred).' },
      { id: 'sasha_yakovleva_won_t_let_you_down', role: 'Go Solo threat whose attack draws and gains the drawn card’s cost in power.' },
    ],
    signals: [
      { text: 'A min Gig by round 2', terms: ['min-gig', 'round'] },
      { text: 'Two rival Units removed by effects by round 5', terms: ['removal', 'round'] },
      { text: 'A sweep of two or more rival Units', terms: ['sweep'] },
      { text: 'A Legend played with Go Solo and attacking the same turn', terms: ['go-solo', 'same-turn-attack'] },
    ],
    risks: [],
    source: 'list',
    status: 'draft',
  },

  's1-08-explorer-rrg.txt': {
    listId: '0bbe4834cda20572',
    objective: 'An untested Royce / Yorinobu / Hanako trio on the Red curve: Arasaka attacks draw, Hanako swaps Gigs, and 10-power Units steal two at a time.',
    plan: [
      { phase: 'early', text: 'Curve 6th Street Recruits and Pepe; equip Satori or the Radioport on Royce’s Legend, which gains +2 per Gear on your turn.' },
      { phase: 'mid', text: 'Use Hanako’s Spend to swap a low Gig for the rival’s high one; clear blockers with Bonnie and Clyde, Over the Edge and Carnage.' },
      { phase: 'closing', text: 'Animals Wrecker and Yorinobu: Steel Dragon attack for double steals; Royce Go Solos as a geared attacker.' },
    ],
    keyCards: [
      { id: 'royce_psycho_on_the_edge', role: 'Go Solo Legend with +2 power per equipped Gear on your turn.' },
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'Spend to swap a friendly Gig with a rival Gig; draws per value-pair.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Replays a 4-cost Unit free that can hit rival Units the same turn.' },
      { id: 'animals_wrecker', role: '10-power double-steal attacker.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal discounted by 8+ Gigs.' },
    ],
    signals: [
      { text: 'A Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'Gear equipped on Royce before he Goes Solo', terms: ['gear-equipped', 'go-solo'] },
      { text: 'A double steal by round 5', terms: ['double-steal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'draft',
  },

  // ---------------- Season 2 ----------------
  's2-01-mutant-rbb.txt': {
    listId: '667eccacebe319ae',
    objective: 'S1-07’s Blue control with Yorinobu: Embracing Destruction in place of Saburo: even more removal and min-Gig draw, plus a Red splash of Over the Edge and Shattered Memories.',
    plan: [
      { phase: 'early', text: 'Trust No One and Floor It for a min Gig and cards; Three Mouths finds the answers.' },
      { phase: 'mid', text: 'Trade removal one-for-one: Pyramid Song, Over the Edge, Unlikely Bond, Maman Brigitte, Les Élémens.' },
      { phase: 'closing', text: 'Towerfall resets the board, then V or Sasha Go Solo and Placide take the Gigs back.' },
    ],
    keyCards: [
      { id: 'three_mouths_one_desire', role: 'Card selection that scales with min Gigs.' },
      { id: 'pyramid_song', role: '-4 power or bottom-deck a 0-power Unit; both with a min d4.' },
      { id: 'towerfall', role: 'Board sweeper.' },
      { id: 'maman_brigitte_spirit_of_death', role: 'Discards two Programs to bottom-deck an unequipped rival Unit.' },
      { id: 'v_corporate_exile', role: 'Go Solo 8-power finisher once the board is clear.' },
    ],
    signals: [
      { text: 'A min Gig by round 2', terms: ['min-gig', 'round'] },
      { text: 'Three rival Units removed by effects by round 5', terms: ['removal', 'round'] },
      { text: 'A sweep of two or more rival Units', terms: ['sweep'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-07-explorer-bbg.txt'],
  },

  's2-02-mutant-rgg.txt': {
    listId: '8c23ab234cfee308',
    objective: 'S1-04’s crossover with Hanako in V’s seat: Green spend-and-defeat control with value-pair draw, Johnny and Sandayu as the bodies and Adam Smasher as the 10-power finisher.',
    plan: [
      { phase: 'early', text: 'Peace Offering into value-pairs for Hanako’s draw; Street Racer and Pepe on curve.' },
      { phase: 'mid', text: 'Memory Relapse or Sandayu spends rival Units; Wild in the Streets and The Reaper defeat them. Johnny Silverhand readies after winning a fight.' },
      { phase: 'closing', text: 'Adam Smasher Goes Solo, defeats a Unit and attacks as a 10 with Saburo.' },
    ],
    keyCards: [
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'Value-pair card draw and Gig swaps (the Legend swapped in for V).' },
      { id: 'sandayu_oda_hanako_s_guardian', role: 'Spends a rival Unit per value-pair and can attack Units the turn it lands.' },
      { id: 'wild_in_the_streets', role: 'Defeats a spent Unit.' },
      { id: 'johnny_silverhand_never_stop_fighting', role: '8-power fighter that readies after its first win each turn.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Removal on arrival and a 10-power attacker with Saburo.' },
    ],
    signals: [
      { text: 'A value-pair by round 3', terms: ['value-pair', 'round'] },
      { text: 'Two rival Units removed by effects by round 5', terms: ['removal', 'round'] },
      { text: 'A fight won by Johnny or Sandayu', terms: ['fight-won'] },
      { text: 'Adam played with Go Solo for a double steal', terms: ['go-solo', 'double-steal'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-04-cross-rbg.txt'],
  },

  's2-03-mutant-rbg.txt': {
    listId: '23b2560802e305f6',
    objective: 'S1-01 with Jackie Welles: Mama’s Favorite for Dexter, re-fitted into a low-curve tempo-control deck: stun and spend effects hold the board while three Go Solo MERC Legends attack.',
    plan: [
      { phase: 'early', text: 'Cheap Programs (Trust No One, Floor It, Peace Offering) for cards; Street Racer and Psycho Squad as the first bodies.' },
      { phase: 'mid', text: 'Chrome Reverie, Nocturne and Memory Relapse stop rival attacks; Royce, Over the Edge and Unlikely Bond remove Units.' },
      { phase: 'closing', text: 'V, Jackie and Adam Go Solo for same-turn attacks; Jackie can take a friendly Unit’s defeat for 1 €$.' },
    ],
    keyCards: [
      { id: 'jackie_welles_mama_s_favorite', role: 'Go Solo 8-power MERC; pays 1 €$ to be defeated instead of another Unit (the Legend swapped in for Dexter).' },
      { id: 'nocturne_op55_n1', role: 'Draw 2, stop an attacker, or discount a Go Solo by 2.' },
      { id: 'chrome_reverie', role: 'Stops a rival attacker; free Call with a min Gig.' },
      { id: 'royce_don_t_call_me_simon', role: 'Defeats a small rival Unit on play.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Go Solo finisher that removes a Unit.' },
    ],
    signals: [
      { text: 'Two Legends face-up by round 4', terms: ['legend-face-up', 'round'] },
      { text: 'A Legend played with Go Solo and attacking the same turn', terms: ['go-solo', 'same-turn-attack'] },
      { text: 'Rival attacks held off with no Gig stolen in rounds 3–4', terms: ['defence-held', 'round'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-01-mutant-rrb.txt'],
  },

  's2-04-cross-rrg.txt': {
    listId: '80c37583621a7fd5',
    objective: 'Crossing S1-05 and S1-08 into an Arasaka Red-Green midrange: Saburo pushes Yorinobu: Steel Dragon to 10, Yorinobu’s Legend draws on attacks, and Royce carries Gear.',
    plan: [
      { phase: 'early', text: 'Curve 6th Street Recruits and Pepe; Street Racer for a surprise attack.' },
      { phase: 'mid', text: 'Clear blockers with Bonnie and Clyde, Over the Edge and Carnage; equip Mantis Blades or Satori to Royce’s Legend for +2 each.' },
      { phase: 'closing', text: 'Animals Wrecker and a Saburo-boosted Steel Dragon steal two Gigs per attack.' },
    ],
    keyCards: [
      { id: 'saburo_arasaka_stubborn_patriarch', role: '+1 power to attacking Arasaka Units (Steel Dragon 10, Sandayu 9).' },
      { id: 'yorinobu_arasaka_embracing_destruction', role: 'Draws on the first Arasaka attack each turn.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Replays a 4-drop; 10-power attacker with Saburo.' },
      { id: 'animals_wrecker', role: '10-power double-steal attacker.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal discounted by 8+ Gigs.' },
    ],
    signals: [
      { text: 'A Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'A 10-power attack by round 5', terms: ['ten-power', 'round'] },
      { text: 'A double steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-05-cross-rgy.txt', 's1-08-explorer-rrg.txt'],
  },

  's2-05-cross-bgg.txt': {
    listId: 'f7dec7e3af608953',
    objective: 'Crossing S1-04 and S1-06 into Green-Blue pairs control: value-pairs for Hanako and Pepe, a wall of stun and spend effects, and MaxTac AV Gig swaps.',
    plan: [
      { phase: 'early', text: 'Peace Offering and Trust No One shape value-pairs; Hanako draws each turn.' },
      { phase: 'mid', text: 'Chrome Reverie, Nocturne and Memory Relapse keep rival Units from attacking; Wild in the Streets and Unlikely Bond remove spent ones.' },
      { phase: 'closing', text: 'MaxTac AV swaps Gigs; Pepe readies V for mana; Placide and The Reaper end it.' },
    ],
    keyCards: [
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'Value-pair draw and Gig swaps.' },
      { id: 'maxtac_av', role: '8-power body that swaps Gigs on play.' },
      { id: 'memory_relapse', role: 'Spends a rival Unit until your next turn (draws on even Street Cred).' },
      { id: 'wild_in_the_streets', role: 'Defeats a spent Unit.' },
      { id: 'don_t_fear_the_reaper', role: 'Spends all rival Units and defeats one.' },
    ],
    signals: [
      { text: 'A value-pair by round 3', terms: ['value-pair', 'round'] },
      { text: 'Extra cards drawn on three turns by round 5', terms: ['cards-drawn', 'round'] },
      { text: 'Rival attacks held off with no Gig stolen in rounds 2–4', terms: ['defence-held', 'round'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-04-cross-rbg.txt', 's1-06-cross-rgg.txt'],
  },

  's2-06-cross-rgg.txt': {
    listId: '5bef9ee9f9b20701',
    objective: 'Crossing S1-05 and S1-08 into Green Arasaka control: Hanako and Saburo with Yorinobu’s draw, spend-and-defeat removal, and Saul Bright as the closer.',
    plan: [
      { phase: 'early', text: 'Peace Offering for value-pairs; Street Racer and Pepe on the board.' },
      { phase: 'mid', text: 'Corporate Surveillance and Memory Relapse spend rival Units for Wild in the Streets; MaxTac AV swaps a Gig.' },
      { phase: 'closing', text: 'The Reaper clears blockers; Saul Bright gives every other attacker +2.' },
    ],
    keyCards: [
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'Value-pair draw and Gig swaps.' },
      { id: 'corporate_surveillance', role: 'Spends a rival Unit costing 4 or less.' },
      { id: 'wild_in_the_streets', role: 'Defeats a spent Unit.' },
      { id: 'maxtac_av', role: 'Gig swap on an 8-power body.' },
      { id: 'saul_bright_stormrider', role: '14-power finisher pumping the team.' },
    ],
    signals: [
      { text: 'A value-pair by round 3', terms: ['value-pair', 'round'] },
      { text: 'Two rival Units removed by effects by round 5', terms: ['removal', 'round'] },
      { text: 'A double steal by round 7', terms: ['double-steal', 'round'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-05-cross-rgy.txt', 's1-08-explorer-rrg.txt'],
  },

  's2-07-explorer-rrb.txt': {
    listId: '2a9a527893a1f110',
    objective: 'An untested V / Yorinobu / Dexter trio: the Red removal-and-curve core with Blue stun, La Llorona blockers and Deadman Transmitter protection.',
    plan: [
      { phase: 'early', text: 'La Llorona and Swordwise Huscle early; La Llorona raises a Gig by 3 when she blocks.' },
      { phase: 'mid', text: 'Dexter’s Spend and La Llorona build 8+ Gigs for cheap Carnage; Over the Edge and Bonnie and Clyde remove threats.' },
      { phase: 'closing', text: 'Animals Wrecker and Placide steal two; V Goes Solo for a surprise attack.' },
    ],
    keyCards: [
      { id: 'la_llorona_ghost_of_the_past', role: 'Cheap Blocker that raises a Gig by 3 when it blocks.' },
      { id: 'dexter_deshawn_off_the_grid', role: 'Call for +2 power or a card; Spend to raise a Gig.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal discounted by 8+ Gigs.' },
      { id: 'animals_wrecker', role: '10-power double-steal attacker.' },
      { id: 'deadman_transmitter', role: 'Gear that is defeated instead of its Unit.' },
    ],
    signals: [
      { text: 'A ready Blocker at the start of the rival’s turn in round 2', terms: ['ready-blocker', 'round'] },
      { text: 'A high Gig by round 4', terms: ['high-gig', 'round'] },
      { text: 'A double steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'draft',
  },

  's2-08-explorer-rrg.txt': {
    listId: '158e34a07c3083d5',
    objective: 'An untested Yorinobu / Jackie / Dexter trio: Red curve and removal with Green tempo, where Jackie: Mama’s Favorite protects the key Unit and Arasaka attacks draw cards.',
    plan: [
      { phase: 'early', text: 'Curve 6th Street Recruits and Pepe; Street Racer gives a 4-drop a surprise attack.' },
      { phase: 'mid', text: 'Bonnie and Clyde, Over the Edge and Carnage clear blockers; Deadman Transmitter and Jackie keep your best Unit alive.' },
      { phase: 'closing', text: 'Animals Wrecker and Yorinobu: Steel Dragon steal; Jackie Goes Solo as an extra 8-power attacker.' },
    ],
    keyCards: [
      { id: 'jackie_welles_mama_s_favorite', role: 'Go Solo 8-power MERC; takes a friendly Unit’s defeat for 1 €$.' },
      { id: 'yorinobu_arasaka_embracing_destruction', role: 'Draws on the first Arasaka attack each turn.' },
      { id: 'bonnie_and_clyde', role: 'Defeats a 4-or-less Unit, or two when you are 2+ Gigs behind.' },
      { id: 'animals_wrecker', role: '10-power double-steal attacker.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Replays a 4-drop free that can hit Units at once.' },
    ],
    signals: [
      { text: 'A Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'A rival Unit removed by an effect by round 3', terms: ['removal', 'round'] },
      { text: 'A double steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'draft',
  },

  // ---------------- Season 3 ----------------
  's3-01-mutant-rbg.txt': {
    listId: '40df2aac24089cdd',
    objective: 'S1-04 with Hanako in Saburo’s seat: three-colour tempo control that draws off value-pairs and min Gigs, with V and Adam Smasher as Go Solo threats.',
    plan: [
      { phase: 'early', text: 'Peace Offering and Trust No One for pairs, min Gigs and cards.' },
      { phase: 'mid', text: 'Nocturne, Chrome Reverie and Memory Relapse stall attackers; Royce, Over the Edge and Unlikely Bond remove them. Pepe readies V and Adam.' },
      { phase: 'closing', text: 'Adam Goes Solo to remove a blocker; Placide and V finish. We Gotta Live Together rebuys cheap Units when behind.' },
    ],
    keyCards: [
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'Value-pair draw and Gig swaps (the Legend swapped in for Saburo).' },
      { id: 'pepe_najarro_working_doubles', role: 'Readies MERC Legends V and Adam with a value-pair.' },
      { id: 'nocturne_op55_n1', role: 'Draw 2, stop an attacker, or discount a Go Solo.' },
      { id: 'royce_don_t_call_me_simon', role: 'Removes a small Unit on play.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Go Solo finisher with removal.' },
    ],
    signals: [
      { text: 'A value-pair by round 3', terms: ['value-pair', 'round'] },
      { text: 'Extra cards drawn on two turns by round 4', terms: ['cards-drawn', 'round'] },
      { text: 'A Legend played with Go Solo by round 6', terms: ['go-solo', 'round'] },
    ],
    risks: ['Without Saburo, Adam Smasher attacks at 9 and steals one Gig.'],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-04-cross-rbg.txt'],
  },

  's3-02-mutant-rrg.txt': {
    listId: '5db5b3eb95ad15b2',
    objective: 'S2-08 with Saburo for Jackie: the Red-Green Arasaka curve now pushes Steel Dragon to 10, with more card flow from Industrial Assembly and Shattered Memories.',
    plan: [
      { phase: 'early', text: 'Industrial Assembly raises a Gig to 8+; curve 6th Street Recruits, Street Racer and Pepe.' },
      { phase: 'mid', text: 'Cheap Carnage, Bonnie and Clyde and Over the Edge clear blockers; Memory Relapse spends one before you attack.' },
      { phase: 'closing', text: 'Animals Wrecker and a 10-power Steel Dragon double-steal; We Gotta Live Together refills when behind.' },
    ],
    keyCards: [
      { id: 'saburo_arasaka_stubborn_patriarch', role: '+1 power to attacking Arasaka Units: Steel Dragon reaches 10 (the Legend swapped in for Jackie).' },
      { id: 'industrial_assembly', role: 'Raises a Gig to 8+ and draws.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal discounted by 8+ Gigs.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Replays a 4-drop; 10-power attacker with Saburo.' },
      { id: 'animals_wrecker', role: '10-power double-steal attacker.' },
    ],
    signals: [
      { text: 'A high Gig by round 3', terms: ['high-gig', 'round'] },
      { text: 'A 10-power attack by round 5', terms: ['ten-power', 'round'] },
      { text: 'Two double steals in the game', terms: ['double-steal'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s2-08-explorer-rrg.txt'],
  },

  's3-03-mutant-rrb.txt': {
    listId: 'ef54cd9464157d3c',
    objective: 'S1-01 with Sasha Yakovleva for V: Red curve and removal with a Blue splash, where Sasha’s Go Solo attack draws a card and grows by its cost.',
    plan: [
      { phase: 'early', text: 'Swordwise Huscle and 6th Street Recruits; Trust No One for cards.' },
      { phase: 'mid', text: 'Dexter builds 8+ Gigs for Carnage; Bonnie and Clyde and Over the Edge clear blockers; Chrome Reverie and Nocturne slow the rival.' },
      { phase: 'closing', text: 'Animals Wrecker, Steel Dragon and Placide take Gigs; Sasha and Adam Go Solo for surprise attacks.' },
    ],
    keyCards: [
      { id: 'sasha_yakovleva_won_t_let_you_down', role: 'Go Solo attacker that draws and gains power equal to that card’s cost (the Legend swapped in for V).' },
      { id: 'dexter_deshawn_off_the_grid', role: '+2 power or a card on Call; raises Gigs on Spend.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal discounted by 8+ Gigs.' },
      { id: 'animals_wrecker', role: '10-power double-steal attacker.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Replays a 4-drop for free.' },
    ],
    signals: [
      { text: 'A high Gig by round 4', terms: ['high-gig', 'round'] },
      { text: 'Sasha played with Go Solo and attacking the same turn', terms: ['go-solo', 'same-turn-attack'] },
      { text: 'A double steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: ['Like its root parent RRG Dexter Midrange (its guide), the few big threats are exposed to bottom-deck effects.'],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-01-mutant-rrb.txt'],
  },

  's3-04-cross-rbg.txt': {
    listId: 'd93dab2a04556349',
    objective: 'Crossing S2-07 and S1-05 into a three-colour control deck: Blue stun and min-Gig draw, Green value-pairs and MaxTac AV swaps, with V as the Go Solo threat.',
    plan: [
      { phase: 'early', text: 'Trust No One and Peace Offering for cards and pairs; Street Racer and Pepe as early bodies.' },
      { phase: 'mid', text: 'Corporate Surveillance, Chrome Reverie, Nocturne and Memory Relapse keep rival Units from attacking; Over the Edge removes one.' },
      { phase: 'closing', text: 'MaxTac AV swaps Gigs back; Sandayu and Placide attack; V Goes Solo with a Nocturne discount.' },
    ],
    keyCards: [
      { id: 'nocturne_op55_n1', role: 'Draw 2, stop an attacker, or make V’s Go Solo 2 cheaper.' },
      { id: 'chrome_reverie', role: 'Stops a rival attacker; free Call with a min Gig.' },
      { id: 'maxtac_av', role: 'Swaps a friendly Gig for a rival Gig on play.' },
      { id: 'pepe_najarro_working_doubles', role: 'Readies V for mana with a value-pair.' },
      { id: 'placide_voodoo_sentinel', role: 'Late 10-power finisher with removal.' },
    ],
    signals: [
      { text: 'Rival attacks held off with no Gig stolen in rounds 2–4', terms: ['defence-held', 'round'] },
      { text: 'A value-pair by round 3', terms: ['value-pair', 'round'] },
      { text: 'Gig lead regained by round 6', terms: ['gig-lead', 'round'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s2-07-explorer-rrb.txt', 's1-05-cross-rgy.txt'],
  },

  's3-05-cross-rrb.txt': {
    listId: '00f1a8607c142d13',
    objective: 'Crossing S1-01 and S2-07 into Red-Blue removal control: the Red curve and removal suite with Yorinobu’s draw, Blue stun, and Adam Smasher and V as Go Solo threats.',
    plan: [
      { phase: 'early', text: 'Swordwise Huscle and 6th Street Recruits; Trust No One and Nocturne for cards.' },
      { phase: 'mid', text: 'Trade removal for every threat: Bonnie and Clyde, Over the Edge, Unlikely Bond, Carnage.' },
      { phase: 'closing', text: 'Animals Wrecker and Steel Dragon steal; Adam Goes Solo to remove the last blocker.' },
    ],
    keyCards: [
      { id: 'bonnie_and_clyde', role: 'Defeats a small Unit, or two when you are 2+ Gigs behind.' },
      { id: 'over_the_edge', role: 'Defeats a Unit with power up to a friendly d20’s value.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal discounted by 8+ Gigs.' },
      { id: 'animals_wrecker', role: '10-power double-steal attacker.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Go Solo finisher with removal.' },
    ],
    signals: [
      { text: 'Three rival Units removed by effects by round 5', terms: ['removal', 'round'] },
      { text: 'A Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'A double steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-01-mutant-rrb.txt', 's2-07-explorer-rrb.txt'],
  },

  's3-06-cross-rbg.txt': {
    listId: '622cc2b22384b4ea',
    objective: 'Crossing S2-08 and S1-04 into a MERC Go Solo control deck: Jackie and V Go Solo, Pepe readies them for mana, and Blue-Green tempo cards hold the board meanwhile.',
    plan: [
      { phase: 'early', text: 'Peace Offering for a value-pair; Street Racer and Pepe on curve.' },
      { phase: 'mid', text: 'Pepe’s attack readies Jackie and V; Nocturne, Chrome Reverie and Memory Relapse stall rival attackers; Royce and Over the Edge remove small Units.' },
      { phase: 'closing', text: 'V and Jackie Go Solo for same-turn attacks; Jackie absorbs a defeat; Placide closes.' },
    ],
    keyCards: [
      { id: 'jackie_welles_mama_s_favorite', role: 'Go Solo MERC that can take a friendly Unit’s defeat.' },
      { id: 'v_corporate_exile', role: 'Go Solo 8-power MERC.' },
      { id: 'pepe_najarro_working_doubles', role: 'Readies the MERC Legends with a value-pair.' },
      { id: 'zetatech_berserk', role: 'Gear that costs 1 less per face-up Legend.' },
      { id: 'placide_voodoo_sentinel', role: '10-power finisher with bottom-deck removal.' },
    ],
    signals: [
      { text: 'A value-pair by round 3', terms: ['value-pair', 'round'] },
      { text: 'Two Legends face-up by round 4', terms: ['legend-face-up', 'round'] },
      { text: 'A Legend played with Go Solo and attacking the same turn', terms: ['go-solo', 'same-turn-attack'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s2-08-explorer-rrg.txt', 's1-04-cross-rbg.txt'],
  },

  's3-07-explorer-rrg.txt': {
    listId: '2e1ac4ffb7e2c7ec',
    objective: 'An untested Royce / Dexter / Saburo trio: Red-Green curve with Gear on Royce’s Legend, Dexter-raised Gigs for Carnage, and Saul Bright plus Animals Wrecker for big steals.',
    plan: [
      { phase: 'early', text: 'Curve 6th Street Recruits, Street Racer and Pepe; put Mantis Blades, Satori or the Radioport on Royce’s Legend.' },
      { phase: 'mid', text: 'Dexter’s Spend raises Gigs for cheap Carnage; Bonnie and Clyde and Over the Edge clear blockers.' },
      { phase: 'closing', text: 'Royce Goes Solo with +2 per Gear; Animals Wrecker and Saul Bright steal two.' },
    ],
    keyCards: [
      { id: 'royce_psycho_on_the_edge', role: 'Go Solo Legend with +2 power per equipped Gear on your turn.' },
      { id: 'arasaka_emergency_radioport', role: 'When its bearer is spent, can Call an Arasaka or Go Solo Legend for free.' },
      { id: 'dexter_deshawn_off_the_grid', role: '+2 power or a card on Call; raises a Gig on Spend.' },
      { id: 'animals_wrecker', role: '10-power double-steal attacker.' },
      { id: 'saul_bright_stormrider', role: '14-power closer pumping other attackers.' },
    ],
    signals: [
      { text: 'Two Gear equipped by round 4', terms: ['gear-equipped', 'round'] },
      { text: 'Royce played with Go Solo and attacking the same turn', terms: ['go-solo', 'same-turn-attack'] },
      { text: 'A double steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'draft',
  },

  's3-08-explorer-rrb.txt': {
    listId: 'ea2b78a72f7e569d',
    objective: 'An untested V / Royce / Dexter trio built as Red-Blue control: heavy removal and card flow, then Go Solo Legends and 10-power Units to take the Gigs.',
    plan: [
      { phase: 'early', text: 'Trust No One, Floor It and Industrial Assembly for cards and Gig shaping; Swordwise Huscle early.' },
      { phase: 'mid', text: 'Remove each threat with Bonnie and Clyde, Over the Edge, Unlikely Bond and Carnage; Kerry draws 2 with an 8+ Gig.' },
      { phase: 'closing', text: 'Animals Wrecker and Placide steal two; V and a geared Royce Go Solo.' },
    ],
    keyCards: [
      { id: 'over_the_edge', role: 'Defeats a Unit with power up to a friendly d20’s value.' },
      { id: 'unlikely_bond', role: 'Trades a ready friendly Unit for a spent rival Unit, both bottom-decked.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal discounted by 8+ Gigs.' },
      { id: 'kerry_eurodyne_the_last_rockerboy', role: 'Spend to draw 2 with an 8+ Gig.' },
      { id: 'animals_wrecker', role: '10-power double-steal attacker.' },
    ],
    signals: [
      { text: 'Three rival Units removed by effects by round 5', terms: ['removal', 'round'] },
      { text: 'A high Gig by round 4', terms: ['high-gig', 'round'] },
      { text: 'A Legend played with Go Solo by round 6', terms: ['go-solo', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'draft',
  },
};
