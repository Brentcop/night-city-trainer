// Deck objectives for library decks imported from shared links (scripts/import-links.ts, docs/DECK_IMPORT.md): decks
// other players built and shared on choom.gg or cyberpunk-tcg-sim.online, whose header's Origin starts "Imported from".
// The 18 entries below are agent-written drafts the owner asked for on 2026-11-16: each is read off its list (Legends,
// curve, card text and scripts) with the synergy packages it is built around, and has not been checked by the owner.
// To correct one, edit it and set `status: 'owner'`. A deck the import step adds later still gets one line above the
// marker, `'<file>': importedPlaceholder('<listId>', [<the three Legends>]),`: a `needs-owner` placeholder tied to the
// list, so the test suite passes, until its note is written.
import type { DeckObjective, ObjectiveTable } from './vocabulary';

/**
 * The placeholder note of an imported deck, the one definition of its words: tied to the list, the Legends as its key
 * cards, two plan lines and two signals for the owner to replace. A fresh object on every call.
 */
export function importedPlaceholder(listId: string, legends: readonly string[]): DeckObjective {
  return {
    listId,
    objective: 'Placeholder: an imported deck; the owner writes its note.',
    plan: [
      { phase: 'early', text: 'Placeholder: to be written by the owner.' },
      { phase: 'closing', text: 'Placeholder: to be written by the owner.' },
    ],
    keyCards: [...new Set(legends)].map((id) => ({ id, role: 'Legend.' })),
    signals: [
      { text: 'A Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'The first Gig stolen by round 4', terms: ['first-steal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'needs-owner',
    placeholder: true,
  };
}

export const IMPORTED_OBJECTIVES: ObjectiveTable = {
  'import-discord-5k-1-smasher-river-reyes-ryy.txt': {
    listId: 'b304c27396a06e82',
    objective: 'Red/Yellow Gear midrange: cheap Gear on cheap bodies, blocks turned into removal by Safety Override, and Johnny Silverhand: Never Stop Fighting and a geared Adam Smasher: Ender of Legends to close.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one. Equip Secondhand Bombus, Sketchy Ripper and Dexter DeShawn: One Last Chance with the 1- and 2-cost Gear (Mantis Blades, Satori: Sword of Saburo, Zetatech Faceplate, Adrenaline Converter); Sketchy Ripper digs a Gear out of the top three cards each time it attacks. Once River Ward is face-up, River’s Quick Spend plays such a Gear for free, even during the rival’s attack.' },
      { phase: 'mid', text: 'Block with Meredith Stout (5 power, 7 against a Legend), Secondhand Bombus or a Unit carrying Mandibular Upgrade, then arm Safety Override on the blocker: if it loses the fight, the attacker is defeated too. If a Call during that attack turns up Muamar Reyes, his Call also keeps the blocker from being defeated.' },
      { phase: 'mid', text: 'Royce: Don’t Call Me Simon defeats a rival Unit of 2 power or less (3 with more Street Cred); Live with the Aftermath makes each player defeat one of their Units, so give up a Bombus when the rival has only one. Keep an even and an odd Gig (Dexter and Zetatech Faceplate adjust one by up to 1, Muamar’s Spend by exactly 1) so Bootleg Black Sapphire Show draws 2 besides making an Eddie.' },
      { phase: 'closing', text: 'Johnny Silverhand readies after the first fight he wins each turn, so he attacks a spent Unit and then the Gig area; he wins every fight against a CORPO Unit. Adam Smasher Goes Solo for 9, defeats a rival Unit and attacks at once, keeping Gear equipped while he was a face-up Legend: with Mantis Blades or Satori he steals two.' },
    ],
    keyCards: [
      { id: 'river_ward_detective_on_the_hunt', role: 'Legend: Quick Spend plays a Gear costing 2 or less from hand for free.' },
      { id: 'muamar_reyes_el_capitan', role: 'Legend: Call keeps a friendly Unit from being defeated in a fight this turn, or draws; Spend adjusts a Gig by 1.' },
      { id: 'safety_override', role: 'Quick: when the chosen Unit loses a fight this turn, the rival Unit it fought is defeated.' },
      { id: 'secondhand_bombus', role: 'A 2-cost 0-power Blocker: the body to block with, or to give up to Live with the Aftermath.' },
      { id: 'johnny_silverhand_never_stop_fighting', role: '8 power for 6: readies after his first won fight each turn.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Legend: Go Solo for 9 defeats a rival Unit and attacks at once, with the Gear he carried as a Legend.' },
    ],
    signals: [
      { text: 'Two Units or Legends with Gear equipped by round 3', terms: ['gear-equipped', 'round'] },
      { text: 'First Gig stolen by round 3', terms: ['first-steal', 'round'] },
      { text: 'A rival Unit defeated by Safety Override, Royce or Live with the Aftermath by round 4', terms: ['removal', 'round'] },
      { text: 'Adam Smasher Goes Solo and attacks at 10+ power by round 6', terms: ['go-solo', 'ten-power', 'round'] },
    ],
    risks: [
      'Five of the 16 Units have 0 power (Secondhand Bombus, Sketchy Ripper) and steal nothing until they carry Gear.',
      'Double steals come from Gear on the 8- and 9-power bodies (one Rockn’ Rockerboy, three Johnny Silverhand, Adam Smasher); smaller Units need two Gear to reach 10, and the single Gorilla Arms is the only other extra steal.',
      'Live with the Aftermath costs you a Unit too: with no cheap body on the field it takes one of your attackers.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['block-punish', 'gear-equipped', 'gig-spread'],
  },

  'import-discord-5k-2-jackie-alt-hanako-bbg.txt': {
    listId: 'ea9c3ecbf1a7f9de',
    objective: 'Blue/Green control: lower your own Gigs to 1 so the Programs draw, dig and cost less, bottom-deck or lock down every rival Unit, and win by stealing a Gig at a time with Pepe Najarro and the small Units once the rival’s board is empty.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one, and roll your d4 in among the first dice. Trust No One lowers a Gig by up to 3 and draws if you then hold a Gig at 1; Jackie Welles: Pour One Out For Me lowers a friendly Gig by up to 2 on your first Blue Unit each turn (Jacked-In Voodoo Boy, Maman Brigitte) and draws if it lands on 1. Floor It (three copies) and Three Mouths, One Desire keep the cards coming.' },
      { phase: 'mid', text: 'Two Gigs at 1 are min Gigs and a value-pair at once: Hanako Arasaka: Daughter of the Emperor draws 1 more each turn, and Alt Cunningham: Soulkiller Architect’s Spend takes 1 €$ per min Gig off your next Program. Peace Offering copies a Gig’s value to make the pair; Pepe Najarro attacking with a pair readies Jackie and Alt, so Alt can Spend twice in a turn.' },
      { phase: 'mid', text: 'Answer threats one at a time: Pyramid Song (both modes while your d4 shows 1: a Unit of 4 power or less), Les Élémens (the lowest-power Unit), Maman Brigitte (discard 2 Programs: any unequipped Unit). Save Towerfall for a turn your Street Cred is below the rival’s: both modes bottom-deck every rival Unit of 5 power or less, and a Floor It first brings a 6 into range.' },
      { phase: 'closing', text: 'Chrome Reverie and Nocturne OP55 N1 stop a Unit from attacking until your next turn, Take Control makes an attacker steal one fewer Gig, and Riot Shield makes a Blocker. Each of your Units steals one Gig (Jacked-In Voodoo Boy only on a turn you played a Program), so attack once the rival’s field is clear.' },
    ],
    keyCards: [
      { id: 'alt_cunningham_soulkiller_architect', role: 'Legend: Spend takes 1 €$ off the next Program per min Gig, or replays a Program from the trash and bottom-decks it.' },
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'Legend: draws 1 per friendly value-pair at the start of your turn; Spend swaps a friendly Gig with a rival Gig.' },
      { id: 'trust_no_one', role: '1 €$: lowers a Gig by up to 3, then draws if you hold a Gig at 1.' },
      { id: 'towerfall', role: 'With less Street Cred than the rival, bottom-decks every rival Unit of 5 power or less.' },
      { id: 'maman_brigitte_spirit_of_death', role: 'Discard 2 Programs as she enters to bottom-deck a rival unequipped Unit of any power.' },
      { id: 'pepe_najarro_working_doubles', role: '6 power for 4, the strongest attacker; with a value-pair it readies Jackie and Alt.' },
    ],
    signals: [
      { text: 'A Gig at 1 by round 2', terms: ['min-gig', 'round'] },
      { text: 'Three or more extra cards drawn by round 4', terms: ['cards-drawn', 'round'] },
      { text: 'Three rival Units removed by card effects by round 6', terms: ['removal', 'round'] },
      { text: 'A Gig lead by round 7', terms: ['gig-lead', 'round'] },
    ],
    risks: [
      'No Unit has more than 6 power, so every attack steals one Gig: the rival’s board must stay clear for several turns, and three of the ten Units are 2-power Voodoo Boys.',
      'A big equipped Unit beside a smaller one is hard to remove: Les Élémens takes the lowest-power Unit, Maman Brigitte only unequipped ones, and Pyramid Song and Towerfall reach only 4 and 5 power.',
      'Hanako’s swap gives you the rival’s higher Gig, which can lift your Street Cred above theirs and leave Towerfall with one mode.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['min-gig', 'program-fuel', 'low-cred'],
  },

  'import-discord-5k-3-smasher-river-viktor-ryy.txt': {
    listId: '7d4d4fa3bc95f94d',
    objective: 'Red/Yellow Gear midrange with removal: cheap Gear found by Viktor Vektor: Sit Down and Relax and played free by River Ward, Blockers and Safety Override on defence, and 8-power Units and a geared Adam Smasher: Ender of Legends to win.',
    plan: [
      { phase: 'early', text: 'Call on turn one: if Viktor Vektor turns up, his Call adds up to two Gear costing 2 or less from your top five (16 of your 40 cards qualify). Equip Secondhand Bombus, Sketchy Ripper and Dexter DeShawn: One Last Chance with Mantis Blades, Satori: Sword of Saburo, Zetatech Faceplate or Adrenaline Converter; River Ward’s Quick Spend plays one for free, even during the rival’s attack.' },
      { phase: 'mid', text: 'Arasaka Emergency Radioport looks at a face-down Legend each time its holder is spent: if it is Adam Smasher and you have not Called this turn, Call him for free; if not, you know what your next Call turns up. Meredith Stout blocks at 5 (7 against a Legend), Safety Override defeats the attacker when your blocker loses, and MaxTac Suppression Team stops rival Units attacking the turn they are played.' },
      { phase: 'mid', text: 'Royce: Don’t Call Me Simon defeats a small Unit, Heywood Ripperdoc (8 power) may defeat a Gear as it enters, and Live with the Aftermath makes each player defeat one of their Units (yours a 0-power body). Shattered Memories refills both hands to five when yours is nearly empty; Bootleg Black Sapphire Show makes an Eddie and draws 2 while you hold an even and an odd Gig.' },
      { phase: 'closing', text: 'Johnny Silverhand: Never Stop Fighting readies after the first fight he wins each turn and attacks again. Adam Smasher Goes Solo for 9, defeats a Unit and attacks: a +2 Gear equipped while he was face-up, or a free one from River after he lands, makes him a double steal; Gorilla Arms takes one more Gig on its holder’s first steal each turn, one whose value none of your Gigs shows.' },
    ],
    keyCards: [
      { id: 'viktor_vektor_sit_down_and_relax', role: 'Legend: Call adds up to two Gear costing 2 or less from the top five cards.' },
      { id: 'river_ward_detective_on_the_hunt', role: 'Legend: Quick Spend plays a Gear costing 2 or less from hand for free.' },
      { id: 'arasaka_emergency_radioport', role: 'When its Unit or Legend is spent, look at a face-down Legend; if it is Adam Smasher, Call him for free.' },
      { id: 'heywood_ripperdoc', role: '8 power for 6 that defeats a Gear as it enters.' },
      { id: 'johnny_silverhand_never_stop_fighting', role: '8 power for 6: readies after his first won fight each turn and wins every fight against a CORPO Unit.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Legend: Go Solo for 9 defeats a rival Unit and attacks at once.' },
    ],
    signals: [
      { text: 'Two Units or Legends with Gear equipped by round 3', terms: ['gear-equipped', 'round'] },
      { text: 'Adam Smasher face-up by round 4', terms: ['legend-face-up', 'round'] },
      { text: 'Two rival Units removed by card effects by round 5', terms: ['removal', 'round'] },
      { text: 'A two-Gig steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: [
      'Four of the 16 Units have 0 power (Secondhand Bombus, Sketchy Ripper), so the early steals need Gear on them first.',
      'Unit removal is thin: one Royce (small Units only), two Live with the Aftermath (which cost you a Unit too) and Safety Override, which needs one of your Units to lose a fight.',
      'Shattered Memories empties your hand as well as the rival’s; played from a full hand it throws away your own plan.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['gear-equipped', 'cyberware', 'gig-spread'],
  },

  'import-discord-5k-4-jackie-alt-hanako-bbg.txt': {
    listId: 'ce2f062981fe76d2',
    objective: 'Blue/Green control that keeps its own Street Cred low: drive your Gigs to 1 for cheap, card-drawing Programs, clear the rival’s Units with bottom-deck effects and two-mode Towerfalls, and steal one Gig per attack with Pepe Najarro and a Unit carrying Dying Night: V’s Pistol.',
    plan: [
      { phase: 'early', text: 'Call on turn one and roll the d4 in among your first dice: Pyramid Song is at its best while it shows 1. Lower Gigs with Trust No One (up to 3) and with Jackie Welles: Pour One Out For Me, who takes a friendly Gig down by up to 2 on your first Blue Unit or Gear each turn (Jacked-In Voodoo Boy, Maman Brigitte, Dying Night) and draws if it lands on 1.' },
      { phase: 'mid', text: 'Dying Night on a Unit lowers a Gig by up to 2 each time that Unit attacks, so a Voodoo Boy or Pepe Najarro keeps pushing your Gigs down while it steals. Peace Offering copies one Gig’s value onto another: Hanako Arasaka: Daughter of the Emperor draws 1 per value-pair each turn, and Pepe attacking with a pair readies Jackie and Alt Cunningham: Soulkiller Architect to pay or Spend again.' },
      { phase: 'mid', text: 'Remove Units one at a time with Les Élémens (the lowest-power one), Maman Brigitte (discard 2 Programs: any unequipped Unit) and Pyramid Song; Alt’s Spend takes 1 €$ per min Gig off your next Program, or replays a Program from the trash. With your Street Cred below the rival’s, Towerfall bottom-decks every rival Unit of 5 power or less.' },
      { phase: 'closing', text: 'Take Control (an attacker steals one fewer Gig), Chrome Reverie and Nocturne OP55 N1 (a Unit can’t attack until your next turn; Nocturne costs 1 €$ once all your dice are rolled in) and a Riot Shield Blocker keep the rival from stealing back while each of your Units steals one Gig a turn.' },
    ],
    keyCards: [
      { id: 'jackie_welles_pour_one_out_for_me', role: 'Legend: your first Blue Unit or Gear each turn lowers a friendly Gig by up to 2, and draws if it lands on 1.' },
      { id: 'alt_cunningham_soulkiller_architect', role: 'Legend: Spend for 1 €$ off the next Program per min Gig, or 1 €$ and Spend to replay a Program from the trash.' },
      { id: 'dying_night_v_s_pistol', role: 'Blue Gear (+2 power): lowers a Gig by up to 2 each time its Unit attacks.' },
      { id: 'pyramid_song', role: 'Both modes while your d4 shows 1: −4 power to a rival Unit, then bottom-deck a 0-power rival Unit.' },
      { id: 'les_elemens', role: 'Bottom-decks the rival’s lowest-power Unit; against a lone Unit, whatever its size.' },
      { id: 'towerfall', role: 'With less Street Cred than the rival, removes every rival Unit of 5 power or less.' },
    ],
    signals: [
      { text: 'A Gig at 1 by round 2', terms: ['min-gig', 'round'] },
      { text: 'Your d4 at 1 when you play Pyramid Song', terms: ['min-gig'] },
      { text: 'Two rival Units removed by card effects by round 5', terms: ['removal', 'round'] },
      { text: 'A Towerfall with less Street Cred than the rival removes two or more Units', terms: ['sweep'] },
    ],
    risks: [
      'Only ten Units, none above 6 power: each attack steals one Gig, and losing Pepe Najarro and Maman Brigitte leaves little to steal with.',
      'Dying Night is a single copy, and Jackie only triggers on Blue Units and Gear (Pepe Najarro, Valentino Street Racer and Riot Shield are Green), so Trust No One does much of the lowering.',
      'Hanako’s swap gives you the rival’s higher Gig, which can lift your Street Cred above theirs and leave Towerfall with one mode.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['min-gig', 'low-cred', 'value-pair'],
  },

  'import-discord-5k-5-v-smasher-padre-rrg.txt': {
    listId: 'ed49b03d1aaca128',
    objective: 'Red/Green midrange: curve 4-cost 6-power Units, push Gigs to 8 or more and into value-pairs with Industrial Assembly, Peace Offering and Padre, clear blockers with Braindance removal, and close with Animals Wrecker, Yorinobu Arasaka: Steel Dragon and a Go Solo Adam Smasher: Ender of Legends.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one, then a 4-cost Unit each turn: 6th Street Recruits or Pepe Najarro (6 power), or Meredith Stout (5 power) as a Blocker. Valentino Street Racer gives another Unit of cost 5 or less Adrenaline, so a 4-drop played just before the Racer attacks that same turn. Industrial Assembly (+4 to a Gig, draws with an 8+ Gig) and Peace Offering (copies a Gig’s value, draws with a pair) cost 1 each.' },
      { phase: 'mid', text: 'Padre’s Spend sets a Gig to the value of a Gig on the other side of the table: copy a rival’s 8+ onto a die big enough to show it, for Carnage at the Colosseum (1 €$ less per friendly 8+ Gig), or copy a rival value that one of your Gigs already shows, for a value-pair (Peace Offering pairs two of your own Gigs directly). With a pair, Pepe Najarro’s attack readies a face-up V: Streetkid and Adam Smasher in the Legends area, so they can pay again that turn. When a friendly Unit steals a d6, 6th Street Recruits raises a Gig by up to 6.' },
      { phase: 'mid', text: 'Clear the way with Bonnie and Clyde (a Unit of 4 power or less, two while the rival has 2 more Gigs), Carnage (a Unit weaker than your strongest) and Memory Relapse, which spends a rival Unit until your next turn so it can’t block and can be attacked, and draws with even Street Cred. Padre’s Call spends a rival Unit or draws; V’s Call trashes 3 and returns a Braindance Program from the trash. Synapse Burnout gives a fighting Unit +1 per face-up Legend.' },
      { phase: 'closing', text: 'Animals Wrecker steals two at 10 power. Yorinobu (9) plays a Unit costing 4 or less from hand or trash for free, which may attack rival Units that turn; with Mantis Blades or Satori: Sword of Saburo he is an 11-power double steal. Adam Smasher Goes Solo for 9, defeats a Unit and attacks the same turn; a Gear put on him while he was face-up carries over.' },
    ],
    keyCards: [
      { id: 'padre_man_of_the_cross', role: 'Legend: Call spends a rival Unit or draws; Spend sets a Gig to another player’s Gig value.' },
      { id: 'industrial_assembly', role: '1 €$: raises a Gig by up to 4 and draws with an 8+ Gig.' },
      { id: 'pepe_najarro_working_doubles', role: 'A 4/6 whose attack, with a value-pair, readies face-up V and Adam Smasher.' },
      { id: 'memory_relapse', role: 'Spends a rival Unit that then can’t ready until your next turn; draws with even Street Cred.' },
      { id: 'carnage_at_the_colosseum', role: 'Defeats a rival Unit weaker than your strongest; 1 €$ cheaper per friendly 8+ Gig.' },
      { id: 'animals_wrecker', role: '10 power for 6: a double steal with no help.' },
    ],
    signals: [
      { text: 'A 4-cost Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'An 8+ Gig held by round 4', terms: ['high-gig', 'round'] },
      { text: 'A value-pair held by round 4', terms: ['value-pair', 'round'] },
      { text: 'A two-Gig steal by round 5', terms: ['double-steal', 'round'] },
    ],
    risks: [
      'Only the two Animals Wrecker reach 10 by themselves: Yorinobu and a Go Solo Adam Smasher steal one Gig unless they carry Mantis Blades or Satori.',
      'Synapse Burnout counts only in fights against rival Units, so it adds nothing to an attack on the Gig area.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['high-gig', 'value-pair', 'braindance'],
  },

  'import-discord-5k-6-jackie-alt-hanako-bbg.txt': {
    listId: '1f877a91f82bb1bb',
    objective: 'Blue/Green control with more Units: lower your Gigs to 1 to power the Programs, remove or lock down the rival’s Units, and steal with Pepe Najarro, Valentino Street Racer’s Adrenaline and a Modded Kusanagi that hits for 8 and goes back to your hand.',
    plan: [
      { phase: 'early', text: 'Call on turn one and get a Gig to 1 with Trust No One or with Jackie Welles: Pour One Out For Me, who lowers a friendly Gig by up to 2 on your first Blue Unit or Gear each turn. Eight of the 13 Units are Blue (Jacked-In Voodoo Boy among them), so Jackie works on most turns you add to the board.' },
      { phase: 'mid', text: 'With a Gig at 1, Three Mouths, One Desire keeps an extra card, Chrome Reverie adds a free Call, and Alt Cunningham: Soulkiller Architect’s Spend cuts the next Program’s cost. Lizzy Wizzy plays a Program costing 3 or less from hand or trash for free as she enters, then stays as a Blocker. Peace Offering makes value-pairs for Hanako Arasaka: Daughter of the Emperor’s draws and Pepe Najarro’s readying of Jackie and Alt.' },
      { phase: 'mid', text: 'Remove Units with Les Élémens, Maman Brigitte and Pyramid Song, and keep Towerfall for a turn your Street Cred is below the rival’s (every rival Unit of 5 power or less goes). Mox Inciters makes a rival Unit attack on their next turn if it can, which leaves it spent on your turn for your Units to attack; Riot Shield on Pepe makes a 7-power Blocker to meet it.' },
      { phase: 'closing', text: 'Modded Kusanagi has Adrenaline: it attacks for 8 the turn you play it and returns to your hand at the end of your turn, so it can’t be attacked back and triggers Jackie again when replayed. Valentino Street Racer gives another Unit of cost 5 or less Adrenaline, so one played just before it attacks that turn too. Chrome Reverie, Nocturne OP55 N1 and Take Control keep the rival from stealing back.' },
    ],
    keyCards: [
      { id: 'jackie_welles_pour_one_out_for_me', role: 'Legend: the first Blue Unit or Gear you play each turn lowers a friendly Gig by up to 2, and draws if it lands on 1.' },
      { id: 'alt_cunningham_soulkiller_architect', role: 'Legend: Spend for 1 €$ off the next Program per min Gig, or replay a Program from the trash.' },
      { id: 'lizzy_wizzy_delicate_weapon', role: 'Plays a Program costing 3 or less from hand or trash for free as she enters, then blocks.' },
      { id: 'modded_kusanagi', role: '8 power with Adrenaline: steals the turn it is played, then returns to your hand.' },
      { id: 'towerfall', role: 'Both modes with less Street Cred than the rival: −5 power to every rival Unit, then bottom-deck those at 0.' },
      { id: 'pepe_najarro_working_doubles', role: '6 power for 4; attacking with a value-pair readies Jackie and Alt.' },
    ],
    signals: [
      { text: 'A Gig at 1 by round 2', terms: ['min-gig', 'round'] },
      { text: 'A Program played for free by Lizzy Wizzy or from the trash', terms: ['program-played'] },
      { text: 'Two rival Units removed by card effects by round 5', terms: ['removal', 'round'] },
      { text: 'Modded Kusanagi or a Unit given Adrenaline attacks the turn it is played', terms: ['same-turn-attack'] },
    ],
    risks: [
      'Apart from the single Modded Kusanagi no Unit has more than 6 power, so each attack steals one Gig and the rival’s board must stay clear for several turns.',
      'Large equipped Units are hard to remove: Maman Brigitte skips equipped Units, Les Élémens takes the lowest-power one, and Pyramid Song and Towerfall reach only 4 and 5 power.',
      'Mox Inciters forces an attack the rival may want anyway: without a Blocker that wins the fight or a Take Control, it can cost you a Gig.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['min-gig', 'program-fuel', 'low-cred'],
  },

  'import-discord-5k-7-smasher-river-viktor-ryy.txt': {
    listId: '95e79a39a67668bb',
    objective: 'Red/Yellow Gear beatdown: equip a wide board of cheap and 8-power Units with Gear found by Viktor Vektor: Sit Down and Relax, block with Meredith Stout and Secondhand Bombus, and take two Gigs at a time with a geared Rockn’ Rockerboy, Johnny Silverhand: Never Stop Fighting or Adam Smasher: Ender of Legends.',
    plan: [
      { phase: 'early', text: 'Call on turn one; when Viktor Vektor turns up, his Call adds up to two Gear costing 2 or less from the top five, and every one of your 18 Gear costs 2 or less. Put Gear on Secondhand Bombus and Sketchy Ripper (Mantis Blades or Satori: Sword of Saburo makes them 2-power attackers) and, once River Ward is face-up, play a Gear for free with River’s Quick Spend.' },
      { phase: 'mid', text: '6th Street Recruits and Meredith Stout come down at 4, Rockn’ Rockerboy (8 power) at 5. Any +2 Gear on Rockerboy or Johnny Silverhand makes a 10-power attacker that steals two Gigs; Adrenaline Converter gives +3 and lets the Unit carrying it attack the turn it is played while the rival holds 2 more Gigs than you. When a friendly Unit steals a d6, 6th Street Recruits raises a Gig by up to 6.' },
      { phase: 'mid', text: 'Three Arasaka Emergency Radioport look at a face-down Legend whenever their holder is spent (attacking, blocking, or paying from the Legends area): if it is Adam Smasher, Call him for free. Zetatech Faceplate adjusts a Gig by up to 1 each time its holder is spent and draws with three different Gig values; Bootleg Black Sapphire Show draws 2 with an even and an odd Gig. Live with the Aftermath is best when the rival has a single Unit and you have a Bombus to give.' },
      { phase: 'closing', text: 'Adam Smasher Goes Solo for 9, defeats a rival Unit and attacks at once; Gear equipped to him while he is face-up stays on him, so he steals two. Meredith Stout, Bombus and Units with Mandibular Upgrade block the swing back.' },
    ],
    keyCards: [
      { id: 'viktor_vektor_sit_down_and_relax', role: 'Legend: Call adds up to two Gear costing 2 or less from the top five; every Gear in this list qualifies.' },
      { id: 'arasaka_emergency_radioport', role: 'When its holder is spent, look at a face-down Legend and Call it for free if it is Adam Smasher.' },
      { id: 'rockn_rockerboy', role: '8 power for 5: with any +2 Gear it steals two Gigs.' },
      { id: 'mantis_blades', role: '+2 power for 1 €$: turns an 8-power Unit into a double steal.' },
      { id: 'johnny_silverhand_never_stop_fighting', role: '8 power for 6: readies after his first won fight each turn.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Legend: Go Solo for 9 defeats a rival Unit and attacks the same turn.' },
    ],
    signals: [
      { text: 'Three Units or Legends with Gear equipped by round 3', terms: ['gear-equipped', 'round'] },
      { text: 'A 4-cost Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'A two-Gig steal by round 5', terms: ['double-steal', 'round'] },
      { text: 'Adam Smasher Goes Solo by round 6', terms: ['go-solo', 'round'] },
    ],
    risks: [
      'Extra Gigs come only from 10-power attacks, and a block only removes the attacker when your blocker wins the fight: the list has no card that punishes a lost block.',
      'Five Units have 0 power (Secondhand Bombus, Sketchy Ripper) and Mandibular Upgrade adds no power: a draw heavy in them steals slowly.',
      'Live with the Aftermath costs a Unit of yours too; with only 8-power Units on the field it trades one of them.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['gear-equipped', 'cyberware', 'gig-spread'],
  },

  'import-discord-5k-8-v-smasher-saburo-rrg.txt': {
    listId: '8f9412a543230da8',
    objective: 'Red/Green ARASAKA curve deck: Saburo Arasaka lifts Yorinobu Arasaka: Steel Dragon and a Go Solo Adam Smasher: Ender of Legends to 10 while attacking, Arasaka Emergency Radioport flips Legends for free, and Saul Bright: Stormrider makes every other attacker 2 stronger.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one, then Pepe Najarro, Meredith Stout or Maelstrom Zealots at 4. Arasaka Emergency Radioport looks at a face-down Legend whenever its holder is spent; every Legend in this trio is ARASAKA or has Go Solo, so you may Call the one you looked at for free (if you have not Called this turn). All is Lost trashes 3 and keeps a Unit from them.' },
      { phase: 'mid', text: 'Clear blockers with Bonnie and Clyde, Carnage at the Colosseum (1 €$ less per friendly 8+ Gig; Industrial Assembly raises a Gig by up to 4) and Memory Relapse, which spends a Unit until your next turn so you can attack it. Maelstrom Zealots defeats the Unit it loses a fight to: Yorinobu can play it free from hand or trash and it may attack a spent rival Unit at once. Detonate defeats a rival Gear of 2 power or less.' },
      { phase: 'mid', text: 'MaxTac AV (8 power) may swap your low Gig for a rival’s high one as it enters. Peace Offering makes a value-pair, so Pepe Najarro’s attack readies a face-up V: Streetkid and Adam Smasher to pay again; V’s Call trashes 3 and returns a Braindance Program from the trash.' },
      { phase: 'closing', text: 'With Saburo face-up, Yorinobu attacks for 10 and Adam Smasher Goes Solo, defeats a Unit and attacks for 10: both steal two, like Animals Wrecker. Saul Bright (14 power for 8) gives your other attackers +2, which makes MaxTac AV a 10, and readies up to three of your Units at the end of your turn, so they are ready again on the rival’s turn.' },
    ],
    keyCards: [
      { id: 'saburo_arasaka_stubborn_patriarch', role: 'Legend: friendly ARASAKA Units get +1 power while attacking, making Yorinobu and a Go Solo Adam Smasher 10.' },
      { id: 'arasaka_emergency_radioport', role: 'When its holder is spent, look at a face-down Legend and Call it for free: all three Legends here qualify.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: '9 power for 7: plays a Unit costing 4 or less from hand or trash for free as it enters.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Legend: Go Solo for 9 defeats a rival Unit and attacks at once, at 10 with Saburo.' },
      { id: 'saul_bright_stormrider', role: '14 power for 8: your other attackers get +2, and up to three of your Units ready at the end of your turn.' },
      { id: 'maelstrom_zealots', role: '0 power for 4: when it loses a fight, the rival Unit it fought is defeated.' },
    ],
    signals: [
      { text: 'Two Legends face-up by round 3', terms: ['legend-face-up', 'round'] },
      { text: 'Saburo face-up before the first Yorinobu or Adam Smasher attack', terms: ['legend-face-up'] },
      { text: 'Two rival Units removed by card effects by round 5', terms: ['removal', 'round'] },
      { text: 'A two-Gig steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: [
      'Saburo’s bonus needs him face-up and reaches only ARASAKA Units (Yorinobu, Adam Smasher): Pepe Najarro, MaxTac AV and Animals Wrecker gain nothing from him.',
      'Saul Bright is a single 8-cost copy; without him MaxTac AV and Pepe Najarro steal one Gig each.',
      'Maelstrom Zealots has no Blocker and 0 power: it only works when it attacks a spent Unit or is attacked while spent.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['arasaka', 'braindance', 'units-in-trash'],
  },

  'import-ladder-s1-1-v-smasher-padre-rrg.txt': {
    listId: '8ae99326b1f93b7d',
    objective: 'Red/Green curve deck: a 4-cost 6-power Unit each turn, Padre and Memory Relapse to spend the rival’s blockers, Gigs pushed to 8+ and into value-pairs, and three Animals Wrecker and three Yorinobu Arasaka: Steel Dragon as the top end.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one, then 6th Street Recruits, Pepe Najarro or Meredith Stout on curve. Peace Offering copies one Gig’s value onto another and draws with a value-pair; Industrial Assembly raises a Gig by up to 4 and draws with an 8+ Gig. Detonate answers a rival Gear of 2 power or less at Quick speed.' },
      { phase: 'mid', text: 'Spend the rival’s best blocker with Padre’s Call or Memory Relapse (it then can’t ready until your next turn) and attack it, or remove it: Bonnie and Clyde takes a Unit of 4 power or less, Carnage at the Colosseum one weaker than your strongest Unit and costs 1 less per friendly 8+ Gig. Maelstrom Zealots has 0 power but defeats the Unit it loses a fight to, so send it at a spent rival Unit.' },
      { phase: 'mid', text: 'Padre’s Spend sets a Gig to the value of a Gig on the other side of the table: copy a rival’s 8+ for Carnage, or a rival value one of your Gigs already shows, for a pair (Peace Offering pairs two of your own Gigs directly). With a pair, Pepe Najarro’s attack readies a face-up V: Streetkid and Adam Smasher: Ender of Legends to pay again. Synapse Burnout gives +1 per face-up Legend to a Unit fighting a rival Unit this turn; V’s Call trashes 3 and returns a Braindance Program from the trash.' },
      { phase: 'closing', text: 'Animals Wrecker attacks for 10 and steals two. Yorinobu plays a Unit costing 4 or less from hand or trash for free, which may attack rival Units that turn (a Zealots from the trash trades with a spent rival Unit at once); Mantis Blades or Satori: Sword of Saburo make him a double steal. Adam Smasher Goes Solo for 9 and defeats a Unit as he enters.' },
    ],
    keyCards: [
      { id: 'padre_man_of_the_cross', role: 'Legend: Call spends a rival Unit or draws; Spend sets a Gig to another player’s Gig value.' },
      { id: 'memory_relapse', role: 'Spends a rival Unit until your next turn, so it can neither block nor attack; draws with even Street Cred.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Plays a Unit costing 4 or less from hand or trash for free; 9 power, 11 with a +2 Gear.' },
      { id: 'animals_wrecker', role: '10 power for 6, three copies: the main double steal.' },
      { id: 'maelstrom_zealots', role: '0 power, but the rival Unit it loses a fight to is defeated.' },
      { id: 'carnage_at_the_colosseum', role: 'Defeats a rival Unit weaker than your strongest; 1 €$ cheaper per friendly 8+ Gig.' },
    ],
    signals: [
      { text: 'A 4-cost Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'A fight won against a Unit you spent with Padre or Memory Relapse', terms: ['fight-won'] },
      { text: 'An 8+ Gig held by round 5', terms: ['high-gig', 'round'] },
      { text: 'A two-Gig steal by round 5', terms: ['double-steal', 'round'] },
    ],
    risks: [
      'Only Animals Wrecker reaches 10 by itself; Yorinobu and Adam Smasher need one of the six +2 Gear for a double steal.',
      'An 8+ Gig comes from a high roll on one of the bigger dice, the two Industrial Assembly, a d6 steal with 6th Street Recruits out, or a high Gig to copy with Padre or Peace Offering: without one, Carnage stays at full price.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['braindance', 'high-gig', 'value-pair'],
  },

  'import-ladder-s1-2-v-smasher-saburo-rrg.txt': {
    listId: '16141b3be2bf22c2',
    objective: 'Red/Green Program-heavy midrange: twenty Programs clear and spend the rival’s Units while a few big threats (three Animals Wrecker, three Yorinobu Arasaka: Steel Dragon, a Go Solo Adam Smasher: Ender of Legends) attack for 10 with Saburo Arasaka’s help.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one; the 1-cost Programs (Industrial Assembly, Peace Offering, Synapse Burnout, Detonate) fill the early turns while Pepe Najarro and Meredith Stout come down at 4. Industrial Assembly raises a Gig by up to 4 and draws with an 8+ Gig; Peace Offering sets a Gig to another’s value and draws with a pair.' },
      { phase: 'mid', text: 'Remove what blocks: Bonnie and Clyde (power 4 or less, two Units when the rival has 2 more Gigs), Carnage at the Colosseum (weaker than your strongest Unit, 1 €$ less per 8+ Gig), and Memory Relapse to spend a Unit until your next turn so it can be attacked. Synapse Burnout is Quick: a Unit fighting a rival Unit gets +1 per face-up Legend, up to +3, so a Meredith Stout block or a Pepe attack can win a fight it would lose.' },
      { phase: 'mid', text: 'V: Streetkid’s Call trashes 3 and returns a Braindance Program (Bonnie and Clyde, Carnage, Memory Relapse, Industrial Assembly, Peace Offering) from the trash; Yorinobu later plays a Unit costing 4 or less from hand or trash for free. With a value-pair, Pepe’s attack readies a face-up V and Adam Smasher to pay again.' },
      { phase: 'closing', text: 'Animals Wrecker is 10 by itself; with Saburo face-up, Yorinobu attacks for 10 and Adam Smasher Goes Solo, defeats a Unit and attacks for 10. Mantis Blades and Satori: Sword of Saburo add 2 to anything else; Riot Shield makes a Blocker and charges the rival 2 more to Go Solo.' },
    ],
    keyCards: [
      { id: 'saburo_arasaka_stubborn_patriarch', role: 'Legend: friendly ARASAKA Units get +1 power while attacking: Yorinobu and a Go Solo Adam Smasher hit 10.' },
      { id: 'animals_wrecker', role: '10 power for 6, three copies: a double steal with no help.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: '9 power for 7 that plays a Unit costing 4 or less from hand or trash for free.' },
      { id: 'memory_relapse', role: 'Spends a rival Unit that can’t ready until your next turn; draws with even Street Cred.' },
      { id: 'synapse_burnout', role: 'Quick, 1 €$: +1 power per face-up Legend to a Unit fighting a rival Unit this turn.' },
      { id: 'carnage_at_the_colosseum', role: 'Defeats a rival Unit weaker than your strongest; 1 €$ cheaper per friendly 8+ Gig.' },
    ],
    signals: [
      { text: 'A 4-cost Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'Saburo face-up before the first Yorinobu or Adam Smasher attack', terms: ['legend-face-up'] },
      { text: 'Two rival Units removed by card effects by round 5', terms: ['removal', 'round'] },
      { text: 'A two-Gig steal by round 5', terms: ['double-steal', 'round'] },
    ],
    risks: [
      'Only twelve Units: if the first Animals Wrecker or Yorinobu is answered, the Programs have little to protect and the deck can run short of attackers.',
      'Saburo’s +1 reaches only Yorinobu and Adam Smasher, and only while he is face-up; Pepe Najarro and Meredith Stout stay at their printed power.',
      'Synapse Burnout does nothing for an attack on the Gig area: it only counts in fights against rival Units.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['braindance', 'arasaka', 'high-gig'],
  },

  'import-ladder-s1-3-smasher-dexter-saburo-rrg.txt': {
    listId: '3c962618a3babce7',
    objective: 'Red/Green midrange: a 4-cost 6-power Unit every turn, Gigs raised past 8 by Dexter DeShawn: Off the Grid and 6th Street Recruits, removal for blockers, and Saburo Arasaka turning Yorinobu Arasaka: Steel Dragon, Minotaur and a Go Solo Adam Smasher: Ender of Legends into 10-power attackers.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one, then 6th Street Recruits, Pepe Najarro, Meredith Stout or Maelstrom Zealots at 4. Once Dexter is face-up, his Spend raises a Gig by up to 2 every turn, so a big die reaches 8 for Carnage at the Colosseum; if he turns up on a Call during the rival’s attack or before your own, his Call gives your Unit +2 this turn; otherwise take the draw.' },
      { phase: 'mid', text: 'Spend blockers with Memory Relapse (no readying until your next turn) and attack them, or remove them with Bonnie and Clyde (4 power or less) and Carnage (weaker than your strongest Unit, 1 €$ less per 8+ Gig). Maelstrom Zealots defeats the Unit it loses a fight to; Yorinobu plays it free from hand or trash and it may attack a spent rival Unit at once. Riot Shield makes a Blocker and charges the rival 2 more to Go Solo.' },
      { phase: 'mid', text: 'Minotaur (9 power) defeats a rival Unit of 5 power or less as it enters if your Street Cred is higher, which Dexter’s Spend and 6th Street Recruits (up to +6 when a friendly Unit steals a d6) help with. Synapse Burnout gives a Unit +1 per face-up Legend while it fights rival Units this turn; Detonate defeats a rival Gear of 2 power or less.' },
      { phase: 'closing', text: 'With Saburo face-up, Yorinobu and Minotaur attack for 10 and Adam Smasher Goes Solo, defeats a Unit and attacks for 10: each steals two, like the three Animals Wrecker. Mantis Blades or Satori: Sword of Saburo push any of them further.' },
    ],
    keyCards: [
      { id: 'dexter_deshawn_off_the_grid', role: 'Legend: Spend raises a Gig by up to 2; Call gives a friendly Unit +2 this turn or draws.' },
      { id: 'saburo_arasaka_stubborn_patriarch', role: 'Legend: friendly ARASAKA Units get +1 power while attacking: Yorinobu, Minotaur and a Go Solo Adam Smasher hit 10.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: '9 power for 7 that plays a Unit costing 4 or less from hand or trash for free.' },
      { id: 'minotaur', role: '9-power ARASAKA Unit that defeats a rival Unit of 5 power or less when your Street Cred is higher.' },
      { id: 'animals_wrecker', role: '10 power for 6: a double steal with no help.' },
      { id: 'carnage_at_the_colosseum', role: 'Defeats a rival Unit weaker than your strongest; 1 €$ cheaper per friendly 8+ Gig.' },
    ],
    signals: [
      { text: 'A 4-cost Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'An 8+ Gig held by round 4', terms: ['high-gig', 'round'] },
      { text: 'Saburo face-up before the first Yorinobu, Minotaur or Adam Smasher attack', terms: ['legend-face-up'] },
      { text: 'A two-Gig steal by round 5', terms: ['double-steal', 'round'] },
    ],
    risks: [
      'Saburo has to be face-up and only boosts ARASAKA Units (Yorinobu, Minotaur, Adam Smasher); Pepe Najarro, 6th Street Recruits and Meredith Stout stay at 5 or 6.',
      'Minotaur’s removal needs more Street Cred than the rival; against a rival with high Gigs it is a plain 9-power Unit.',
      'Pepe Najarro’s readying does little here: Adam Smasher is the only MERC Legend in the trio.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['high-gig', 'arasaka'],
  },

  'import-ladder-s1-4-v-padre-jackie-rgg.txt': {
    listId: '51a1196a3827dcb4',
    objective: 'Green/Red spend-and-punish: spend the rival’s Units with Padre, Memory Relapse and (Don’t Fear) The Reaper, defeat the spent ones with Wild in the Streets and Overwatch: Panam’s Gift, and attack past them with MaxTac AV, Johnny Silverhand: Never Stop Fighting and two Go Solo Legends.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one. The early Units hold the ground: Corpo Security (a Blocker that can’t attack), La Llorona (a Blocker that raises a Gig by up to 3 when it blocks), MaxTac Squadron and Meredith Stout. A spent MaxTac Squadron readies a face-up Legend at the end of your turn, so that Legend can pay on the rival’s turn.' },
      { phase: 'mid', text: 'Padre’s Call or Memory Relapse spends a rival Unit (Memory Relapse also keeps it from readying until your next turn); then Wild in the Streets defeats a spent Unit, or your Units attack it. (Don’t Fear) The Reaper spends every rival Unit and defeats one, so nothing can block that turn. V: Streetkid’s Call trashes 3 and returns Memory Relapse or Peace Offering from the trash.' },
      { phase: 'mid', text: 'Overwatch: Panam’s Gift is Quick: for 1 €$ and a Spend of its ready holder, discard a card and defeat a spent rival Unit costing no more than it, even right after a rival Unit attacks. Sandevistan readies its holder at the end of your turn, so a Unit carrying both attacks on your turn and still has its Spend for the rival’s. Fool on the Hill gives you two cards either way.' },
      { phase: 'closing', text: 'MaxTac AV (8 power) may swap your low Gig for a rival’s high one; Johnny Silverhand wins every fight against a CORPO Unit and readies after his first win each turn. V Goes Solo for 5 and Jackie Welles: Mama’s Favorite for 6 (8 power), both attacking at once; while Jackie is face-up, 1 €$ lets him be defeated in place of one of your Units.' },
    ],
    keyCards: [
      { id: 'padre_man_of_the_cross', role: 'Legend: Call spends a rival Unit or draws; Spend sets a Gig to another player’s Gig value.' },
      { id: 'memory_relapse', role: 'Spends a rival Unit that can’t ready until your next turn; draws with even Street Cred.' },
      { id: 'wild_in_the_streets', role: '5 €$: defeats a spent Unit.' },
      { id: 'don_t_fear_the_reaper', role: '7 €$: spends every rival Unit, then defeats a spent one; no Blockers that turn.' },
      { id: 'overwatch_panam_s_gift', role: 'Quick Gear (+4): 1 €$ and a Spend, discard a card to defeat a spent rival Unit costing no more.' },
      { id: 'jackie_welles_mama_s_favorite', role: 'Legend: Go Solo for 6 at 8 power; pays 1 €$ to be defeated instead of a friendly Unit.' },
    ],
    signals: [
      { text: 'A ready Blocker at the start of the rival’s turn by round 2', terms: ['ready-blocker', 'round'] },
      { text: 'A fight won against a spent rival Unit', terms: ['fight-won'] },
      { text: 'Two rival Units removed by card effects by round 5', terms: ['removal', 'round'] },
      { text: 'A Legend Goes Solo by round 5', terms: ['go-solo', 'round'] },
    ],
    risks: [
      'Wild in the Streets and Overwatch only hit spent Units: on turns the rival keeps its Units home and you hold no way to spend one, the removal waits.',
      'Overwatch defeats only a Unit costing no more than the card you discard, so answering a big Unit costs one of your expensive cards.',
      'Until MaxTac AV and Johnny Silverhand arrive at 5 and 6 €$, the Units are 2 to 5 power, and Corpo Security never attacks.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['spend-punish', 'braindance'],
  },

  'import-ladder-s1-5-v-smasher-dum-dum-rry.txt': {
    listId: '550cfc2b7b685094',
    objective: 'Red/Yellow big-Unit midrange: Blockers that cost the rival cards, Red removal for what stands in the way, and 8- to 10-power attackers (Rockn’ Rockerboy, Animals Wrecker, Yorinobu Arasaka: Steel Dragon) carrying Gear for two-Gig steals, with Dum Dum’s pump on top.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one. Augmented Negotiators (3 €$) is a Blocker that makes the rival discard each time it blocks; 6th Street Recruits follows at 4 and raises a Gig by up to 6 whenever a friendly Unit steals a d6. All is Lost trashes 3 and keeps a Unit from them, which also stocks the trash for Yorinobu.' },
      { phase: 'mid', text: 'Rockn’ Rockerboy is 8 power for 5: Mantis Blades, Satori: Sword of Saburo or Zetatech Faceplate (+2 each) make it a 10-power double steal. Dum Dum: Maelstrom Triggerman’s Quick Spend (1 €$) gives a Unit +1 per equipped Gear, in a fight or to reach 10, and his Call draws 2 if you defeat one of your own Gear, else 1.' },
      { phase: 'mid', text: 'Clear the way with Bonnie and Clyde (4 power or less), Carnage at the Colosseum (weaker than your strongest Unit, 1 €$ less per 8+ Gig; Industrial Assembly raises a Gig by up to 4) and, once your d20 is rolled in, Over the Edge (a Unit with power up to the d20’s value). Appetite for Destruction lets a Unit that wins a fight by 3 or more this turn also steal a Gig.' },
      { phase: 'closing', text: 'Animals Wrecker is 10 by itself; Yorinobu (9) plays a Unit costing 4 or less for free and becomes 11 with a Gear. Adam Smasher: Ender of Legends Goes Solo for 9 and defeats a Unit as he enters; with a Gear put on him while face-up he steals two. V: Streetkid’s Call trashes 3 and returns Bonnie and Clyde, Carnage or Industrial Assembly.' },
    ],
    keyCards: [
      { id: 'rockn_rockerboy', role: '8 power for 5: any +2 Gear makes it a double steal.' },
      { id: 'animals_wrecker', role: '10 power for 6: a double steal with no help.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: '9 power for 7 that plays a Unit costing 4 or less from hand or trash for free.' },
      { id: 'dum_dum_maelstrom_triggerman', role: 'Legend: Quick, 1 €$ and Spend: +1 power to a Unit per equipped Gear; Call draws 1, or 2 by defeating a friendly Gear.' },
      { id: 'augmented_negotiators', role: '3-cost Blocker: the rival discards 1 each time it blocks.' },
      { id: 'over_the_edge', role: 'Defeats a Unit with power up to your d20’s value; dead until the d20 is rolled in.' },
    ],
    signals: [
      { text: 'A 4-cost Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'A Unit with Gear attacks at 10+ power by round 4', terms: ['ten-power', 'gear-equipped', 'round'] },
      { text: 'An 8+ Gig held by round 5', terms: ['high-gig', 'round'] },
      { text: 'Two rival Units removed by card effects by round 5', terms: ['removal', 'round'] },
    ],
    risks: [
      'Over the Edge needs a friendly d20, the last die you roll in: unless you steal one, all three copies wait until your sixth turn.',
      'Only nine Gear: an 8-power Rockerboy without one steals a single Gig, and Dum Dum’s pump adds nothing to an unequipped Unit.',
      'Augmented Negotiators is the only Unit under 4 €$, so a slow hand meets the rival’s early attacks with 2-power blocks.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['high-gig', 'braindance', 'units-in-trash'],
  },

  'import-ladder-s1-6-dexter-v-reyes-rry.txt': {
    listId: 'dc379bb349a94491',
    objective: 'Red/Yellow midrange: Blockers that cost the rival cards, Gigs raised past 8 for cheap Carnage at the Colosseum, Red removal, and Animals Wrecker and a geared Yorinobu Arasaka: Steel Dragon for two-Gig steals.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one, then Augmented Negotiators (a Blocker that makes the rival discard when it blocks), 6th Street Recruits and Meredith Stout (5 power, 7 against a Legend). Once Dexter DeShawn: Off the Grid is face-up, his Spend raises a Gig by up to 2 every turn and Industrial Assembly adds up to 4, so an 8+ Gig comes early.' },
      { phase: 'mid', text: 'Carnage at the Colosseum costs 1 less per friendly 8+ Gig and defeats a rival Unit weaker than your strongest; Bonnie and Clyde takes a Unit of 4 power or less; Detonate a Gear of 2 power or less at Quick speed. Once your d20 is rolled in, Over the Edge defeats a Unit with power up to its value. All is Lost trashes 3 and keeps a Unit from them.' },
      { phase: 'mid', text: 'Muamar Reyes and Dexter help most when they turn up on a Call during the rival’s attack: Muamar’s Call keeps your Unit from being defeated in that fight, Dexter’s gives it +2. Muamar’s Spend adjusts a Gig by exactly 1; Zetatech Faceplate adjusts one each time its holder is spent and draws while you hold three different Gig values.' },
      { phase: 'closing', text: 'Animals Wrecker steals two at 10 power; Yorinobu (9) plays a Unit costing 4 or less from hand or trash for free and steals two with Mantis Blades or Satori: Sword of Saburo. V: Streetkid Goes Solo for 5 and attacks at once, and V’s Call trashes 3 to return Bonnie and Clyde, Carnage or Industrial Assembly.' },
    ],
    keyCards: [
      { id: 'dexter_deshawn_off_the_grid', role: 'Legend: Spend raises a Gig by up to 2; Call gives a friendly Unit +2 this turn or draws.' },
      { id: 'muamar_reyes_el_capitan', role: 'Legend: Call keeps a friendly Unit from being defeated in a fight this turn, or draws; Spend adjusts a Gig by 1.' },
      { id: 'carnage_at_the_colosseum', role: 'Defeats a rival Unit weaker than your strongest; 1 €$ cheaper per friendly 8+ Gig.' },
      { id: 'industrial_assembly', role: '1 €$: raises a Gig by up to 4 and draws with an 8+ Gig.' },
      { id: 'animals_wrecker', role: '10 power for 6: a double steal with no help.' },
      { id: 'augmented_negotiators', role: '3-cost Blocker: the rival discards 1 each time it blocks.' },
    ],
    signals: [
      { text: 'A 4-cost Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'An 8+ Gig held by round 3', terms: ['high-gig', 'round'] },
      { text: 'Dexter or Muamar Called during a rival attack', terms: ['call-in-react'] },
      { text: 'A two-Gig steal by round 5', terms: ['double-steal', 'round'] },
    ],
    risks: [
      'The only Go Solo Legend is V: Streetkid at 6 power, so the double steals come from the three Animals Wrecker and from Yorinobu with a Gear.',
      'Over the Edge needs a friendly d20, the last die you roll in, so it is a late card unless you steal one.',
      'Calls are blind: Muamar’s and Dexter’s fight effects only help when they happen to turn up with a fight coming.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['high-gig', 'braindance', 'units-in-trash'],
  },

  'import-ladder-s1-7-dexter-v-padre-rrg.txt': {
    listId: '59dc83d3008d81b9',
    objective: 'Red/Green midrange that keeps its Street Cred even: Field Operator and Memory Relapse draw on an even total, Dexter DeShawn: Off the Grid and Padre set the Gigs, Braindance removal clears the way, and Animals Wrecker and Yorinobu Arasaka: Steel Dragon steal two at a time.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one, then Field Operator (draws as it enters if your Street Cred is even), Valentino Street Racer, and 6th Street Recruits or Pepe Najarro at 4. The Racer gives a Unit played earlier that turn (cost 5 or less) Adrenaline, so it attacks at once.' },
      { phase: 'mid', text: 'Shape the Gigs before you play the cards that read them: Dexter’s Spend raises a Gig by up to 2, Industrial Assembly by up to 4 (and draws with an 8+ Gig), Padre’s Spend sets one to another player’s value, Peace Offering copies one onto another. Aim for an even Street Cred for Field Operator and Memory Relapse, an 8+ Gig for Carnage at the Colosseum, and a value-pair for Peace Offering’s draw and for Pepe Najarro, whose attack then readies a face-up V: Streetkid.' },
      { phase: 'mid', text: 'Memory Relapse spends a rival Unit until your next turn, so it can neither block nor attack and your Units can attack it; Padre’s Call spends one too, or draws. Bonnie and Clyde, Carnage (1 €$ less per 8+ Gig) and, once your d20 is rolled in, Over the Edge defeat what is left.' },
      { phase: 'closing', text: 'Animals Wrecker steals two at 10. Yorinobu (9) plays a Unit costing 4 or less from hand or trash for free and steals two with Mantis Blades or Satori: Sword of Saburo. V Goes Solo for 5 and attacks that same turn; V’s Call trashes 3 and returns a Braindance Program from the trash.' },
    ],
    keyCards: [
      { id: 'field_operator', role: '3-cost Unit that draws as it enters while your Street Cred is even.' },
      { id: 'memory_relapse', role: 'Spends a rival Unit that can’t ready until your next turn; draws with even Street Cred.' },
      { id: 'dexter_deshawn_off_the_grid', role: 'Legend: Spend raises a Gig by up to 2; Call gives a friendly Unit +2 this turn or draws.' },
      { id: 'padre_man_of_the_cross', role: 'Legend: Spend sets a Gig to another player’s Gig value; Call spends a rival Unit or draws.' },
      { id: 'carnage_at_the_colosseum', role: 'Defeats a rival Unit weaker than your strongest; 1 €$ cheaper per friendly 8+ Gig.' },
      { id: 'animals_wrecker', role: '10 power for 6: a double steal with no help.' },
    ],
    signals: [
      { text: 'A 4-cost Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'Field Operator or Memory Relapse played with even Street Cred, drawing a card', terms: ['cards-drawn'] },
      { text: 'An 8+ Gig held by round 4', terms: ['high-gig', 'round'] },
      { text: 'A two-Gig steal by round 5', terms: ['double-steal', 'round'] },
    ],
    risks: [
      'The Gig changes serve three goals at once (even Street Cred, an 8+ Gig, a value-pair): raising a Gig by an odd amount for Carnage turns an even total odd and switches off Field Operator’s and Memory Relapse’s draw.',
      'Over the Edge needs a friendly d20, the last die you roll in, so all three copies wait until your sixth turn unless you steal one.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['cred-even', 'high-gig', 'braindance'],
  },

  'import-ladder-s1-8-smasher-river-viktor-ryy.txt': {
    listId: '3750a5b13c344cae',
    objective: 'Red/Yellow Gear aggro: dig for Gear with Viktor Vektor: Sit Down and Relax and Sketchy Ripper, arm 8-power Units for two-Gig steals, and protect them with Mandibular Upgrade blocks and Safety Override.',
    plan: [
      { phase: 'early', text: 'Call on turn one; when Viktor Vektor turns up he adds up to two Gear costing 2 or less from your top five (17 of the 18 Gear qualify). Sketchy Ripper finds another Gear in the top three each time it attacks; with Mantis Blades or Satori: Sword of Saburo it attacks for 2 and steals as well.' },
      { phase: 'mid', text: '6th Street Recruits on curve, then Rockn’ Rockerboy and Johnny Silverhand: Never Stop Fighting (8 power each): a +2 Gear (Mantis Blades, Satori, Zetatech Faceplate, Arasaka Emergency Radioport) makes either a 10-power double steal, and the single Gorilla Arms takes one more Gig on its holder’s first steal each turn, one whose value none of your Gigs shows. River Ward’s Quick Spend plays a cheap Gear for free, even during the rival’s attack to win a block.' },
      { phase: 'mid', text: 'The only Unit with Blocker of its own is the 0-power Secondhand Bombus; any other Unit needs Mandibular Upgrade to block. Arm Safety Override on the blocker, and if it loses, the attacker is defeated too. Live with the Aftermath clears a lone rival Unit at the cost of your weakest body; Bootleg Black Sapphire Show makes an Eddie and draws 2 while you hold an even and an odd Gig, which Zetatech Faceplate helps arrange.' },
      { phase: 'closing', text: 'Adam Smasher: Ender of Legends Goes Solo for 9, defeats a rival Unit and attacks at once; Arasaka Emergency Radioport on an attacker or on River Ward can find him and Call him for free. A +2 Gear given to him while he is face-up makes his attack a double steal.' },
    ],
    keyCards: [
      { id: 'viktor_vektor_sit_down_and_relax', role: 'Legend: Call adds up to two Gear costing 2 or less from the top five.' },
      { id: 'sketchy_ripper', role: '0-power 2-drop whose attacks dig a Gear out of the top three cards.' },
      { id: 'rockn_rockerboy', role: '8 power for 5, the base for a 10-power Gear attack.' },
      { id: 'mandibular_upgrade', role: '1 €$ Gear that gives any Unit Blocker.' },
      { id: 'safety_override', role: 'Quick: when the chosen Unit loses a fight this turn, the rival Unit it fought is defeated too.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Legend: Go Solo for 9 defeats a rival Unit and attacks the same turn.' },
    ],
    signals: [
      { text: 'Two Units or Legends with Gear equipped by round 3', terms: ['gear-equipped', 'round'] },
      { text: 'First Gig stolen by round 3', terms: ['first-steal', 'round'] },
      { text: 'A 10-power attack by round 5', terms: ['ten-power', 'round'] },
      { text: 'A rival attack held off with your blocker still on the field', terms: ['defence-held'] },
    ],
    risks: [
      'Five of the 14 Units have 0 power: without Gear early, Secondhand Bombus and Sketchy Ripper steal nothing.',
      'There is no Blocker with power of its own: blocking well needs Mandibular Upgrade on a real Unit, and a block that loses costs that Unit.',
      'Only one Gorilla Arms: most turns each attacker steals one Gig, or two at 10 power.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['gear-equipped', 'cyberware', 'gig-spread'],
  },

  'import-ladder-s1-9-river-reyes-rogue-yyy.txt': {
    listId: 'd4c58ffe5fbbc984',
    objective: 'Yellow Gear toolbox: keep Gig values mixed for draws and extra steals, block with Augmented Negotiators and Safety Override, and use The Relic: Experimental Biochip to bring Adam Smasher: Metal Over Meat back from the trash and defeat every other Unit.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one. Dexter DeShawn: One Last Chance adjusts a Gig by up to 1 when played and when it attacks, Zetatech Faceplate each time its holder is spent, Muamar Reyes’s Spend by exactly 1: keep an even and an odd Gig for Bootleg Black Sapphire Show’s 2 cards. River Ward’s Quick Spend plays a Gear costing 2 or less for free.' },
      { phase: 'mid', text: 'The Heist trashes 4 and keeps a Gear, played free if its cost equals one of your Gig values (Mandibular Upgrade 1, Adrenaline Converter and Zetatech Faceplate 2, Gorilla Arms 4, The Relic 5). Augmented Negotiators blocks and makes the rival discard; arm Safety Override on the blocker and the attacker is defeated when it loses. MaxTac Suppression Team stops rival Units attacking the turn they are played.' },
      { phase: 'mid', text: 'The Relic on a Unit plays a Unit costing 9 or less from your trash for free when that Unit is defeated. With Metal Over Meat in the trash (The Heist and River Ward’s trigger can put it there), let the Relic’s Unit die in a block, a fight or to Live with the Aftermath: a 15-power Smasher comes back and defeats every other Unit.' },
      { phase: 'closing', text: 'Rogue Amendiares: Preem Solo Goes Solo for 7 and attacks at once; each Gig a friendly Legend steals draws a card if even or makes the rival discard if odd. Gorilla Arms or Adrenaline Converter equipped while she is face-up comes with her and makes her a 10-power double steal. Jackie Welles: Ride or Die Choom gets +2 per even friendly Gig when he attacks.' },
    ],
    keyCards: [
      { id: 'the_relic_experimental_biochip', role: 'Gear (+3): when its Unit is defeated, play a Unit costing 9 or less from your trash for free.' },
      { id: 'adam_smasher_metal_over_meat', role: '15 power for 9 that defeats every other Unit as it enters, from hand or brought back by The Relic.' },
      { id: 'rogue_amendiares_preem_solo', role: 'Legend: Go Solo for 7; Gigs a friendly Legend steals draw a card (even) or make the rival discard (odd).' },
      { id: 'the_heist', role: 'Trashes 4 and keeps a Gear, free if its cost matches one of your Gig values.' },
      { id: 'gorilla_arms', role: 'Gear (+3): the first steal each turn takes one more rival Gig whose value none of yours shows.' },
      { id: 'safety_override', role: 'Quick: when the chosen Unit loses a fight this turn, the rival Unit it fought is defeated.' },
    ],
    signals: [
      { text: 'Two Units or Legends with Gear equipped by round 3', terms: ['gear-equipped', 'round'] },
      { text: 'A rival Unit defeated by Safety Override by round 4', terms: ['removal', 'round'] },
      { text: 'Adam Smasher: Metal Over Meat removes two or more rival Units at once', terms: ['sweep'] },
      { text: 'Rogue Amendiares Goes Solo and steals two or more Gigs in one attack', terms: ['go-solo', 'double-steal'] },
    ],
    risks: [
      'The Relic loop needs Metal Over Meat in your trash first (two copies in 40 cards), and its wipe takes your own Units with it.',
      'The Relic costs 5 for +3 power: on a Unit that is never defeated it is an expensive Gear.',
      'Few Units steal early: Augmented Negotiators has 2 power and Dexter DeShawn: One Last Chance 4, and the 5- to 9-cost Units come late.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['relic-loop', 'gig-spread', 'block-punish'],
  },

  'import-ladder-s1-10-jackie-judy-hanako-bbg.txt': {
    listId: '7cd8fe59c2bc6286',
    objective: 'Blue/Green draw-and-control: lower your Gigs to 1 for cheap card draw, bottom-deck or lock the rival’s Units, replay Programs with Lizzy Wizzy, and win late with Placide: Voodoo Sentinel, a 10-power double steal that bottom-decks a Unit each time it attacks.',
    plan: [
      { phase: 'early', text: 'Sell and Call on turn one. Delamain: Rideshare AI draws 2 as it enters, Three Mouths, One Desire keeps an extra card per friendly Gig at 1, and Trust No One lowers a Gig by up to 3 and draws if you hold a Gig at 1. Jackie Welles: Pour One Out For Me lowers a friendly Gig by up to 2 the first time each turn you play a Blue Unit, and every Unit in this list is Blue.' },
      { phase: 'mid', text: 'Judy Álvarez: Braindance Maestro gives a friendly Unit +1 power this turn each time you play a Braindance Program (Trust No One, Peace Offering, Three Mouths, One Desire, Chrome Reverie, Pyramid Song, Memory Relapse, Towerfall); her Spend trashes your top card and keeps it if it is a Program. Peace Offering makes value-pairs, and Hanako Arasaka: Daughter of the Emperor draws 1 per pair at the start of your turn.' },
      { phase: 'mid', text: 'Remove Units with Pyramid Song (both modes while your d4 shows 1), Les Élémens, Maman Brigitte (discard 2 Programs) and Memory Relapse, which spends one until your next turn; with less Street Cred than the rival, Towerfall removes every rival Unit of 5 power or less. Lizzy Wizzy plays a Program costing 3 or less from hand or trash for free as she enters, then blocks; Chrome Reverie and Nocturne OP55 N1 stop a Unit attacking until your next turn.' },
      { phase: 'closing', text: 'Placide costs 8 and attacks for 10: as it enters and each time it attacks, discard a Program to bottom-deck a rival Unit, before the rival can block, so it clears a Blocker and steals two Gigs in the same attack.' },
    ],
    keyCards: [
      { id: 'judy_alvarez_braindance_maestro', role: 'Legend: +1 power to a friendly Unit per Braindance Program you play; Spend trashes your top card and keeps it if it is a Program.' },
      { id: 'jackie_welles_pour_one_out_for_me', role: 'Legend: your first Blue Unit or Gear each turn lowers a friendly Gig by up to 2, and draws if it lands on 1.' },
      { id: 'delamain_rideshare_ai', role: '3-cost Unit that draws 2 as it enters.' },
      { id: 'lizzy_wizzy_delicate_weapon', role: 'Plays a Program costing 3 or less from hand or trash for free as she enters, then blocks.' },
      { id: 'towerfall', role: 'With less Street Cred than the rival, removes every rival Unit of 5 power or less.' },
      { id: 'placide_voodoo_sentinel', role: '10 power for 8: discards a Program to bottom-deck a rival Unit as it enters and on each attack.' },
    ],
    signals: [
      { text: 'A Gig at 1 by round 2', terms: ['min-gig', 'round'] },
      { text: 'Three or more extra cards drawn by round 4', terms: ['cards-drawn', 'round'] },
      { text: 'A Towerfall that removes two or more rival Units', terms: ['sweep'] },
      { text: 'Placide attacks at 10 power by round 7', terms: ['ten-power', 'round'] },
    ],
    risks: [
      'The three Delamain have 0 power and steal nothing, and Lizzy Wizzy and Jacked-In Voodoo Boy have 2: until Placide arrives, each attack steals one Gig at most.',
      'Placide needs a Program in hand to discard for its bottom-deck; late in a long game it may attack with nothing to throw away.',
      'Hanako’s swap gives you the rival’s higher Gig, which can lift your Street Cred above theirs and cost Towerfall its second mode.',
    ],
    source: 'list',
    status: 'draft',
    synergies: ['min-gig', 'braindance', 'low-cred'],
  },
  // new imported decks are added above this line (scripts/import-links.ts)
};
