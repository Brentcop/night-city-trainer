// Deck objectives for the choom.gg community-guide decks (data/decks/<COLORS>-*.txt). Drafted from the free portion of
// each guide (and, where the Strategy page has one, its entry in src/content/guides.ts), in our own words, then checked
// against the current list. Credit goes to the guide's author; edit an entry and set `status: 'owner'` once checked.
import type { ObjectiveTable } from './vocabulary';

export const CHOOM_GUIDE_OBJECTIVES: ObjectiveTable = {
  'BBB-running-and-dancing.txt': {
    listId: '98fac3c03fa4bae8',
    objective: 'Mill and draw through the deck with Judy and Jackie to reach the Programs, then replay the best ones from the trash with Alt to answer the rival’s key Units.',
    plan: [
      { phase: 'early', text: 'Push a Gig to its minimum with Trust No One and Jackie, drawing as you go; Judy trashes the top card to dig for Programs.' },
      { phase: 'mid', text: 'Use Alt to cast each Program a second time from the trash (Chrome Reverie to stop an attacker, Lizzy Wizzy to recast a cheap one).' },
      { phase: 'closing', text: 'Feed Programs to Maman Brigitte and Placide to bottom-deck blockers, then steal with Flathead and Modded Kusanagi.' },
    ],
    keyCards: [
      { id: 'alt_cunningham_soulkiller_architect', role: 'Legend: replays a Program from the trash and discounts Programs per min Gig.' },
      { id: 'judy_alvarez_braindance_maestro', role: 'Legend: trashes the top card to find Programs; pumps a Unit when a Braindance is played.' },
      { id: 'jackie_welles_pour_one_out_for_me', role: 'Legend: lowers a Gig on the first Blue play each turn and draws when it hits min.' },
      { id: 'trust_no_one', role: 'Sets up a min Gig cheaply and draws.' },
      { id: 'maman_brigitte_spirit_of_death', role: 'Discards two Programs to bottom-deck an unequipped rival Unit.' },
      { id: 'placide_voodoo_sentinel', role: '10-power finisher that bottom-decks a Unit on play and on attack.' },
    ],
    signals: [
      { text: 'A friendly min Gig in play by round 2', terms: ['min-gig', 'round'] },
      { text: 'At least one Program played from the trash by round 4', terms: ['program-played', 'round'] },
      { text: 'Two or more extra cards drawn by round 3', terms: ['cards-drawn', 'round'] },
      { text: 'A rival Unit removed by Maman Brigitte or Placide', terms: ['removal'] },
    ],
    risks: [],
    source: 'guide',
    status: 'draft',
    guide: { title: 'Running and Dancing', author: 'CunninghamsAlt', site: 'choom.gg', url: 'https://choom.gg/guides/running-and-dancing-fff0cb' },
  },

  'BBG-bbg-draw-and-wipe.txt': {
    listId: 'ca4bd3219b88e638',
    objective: 'Out-draw the rival with Hanako’s value-pairs and cheap Blue cantrips, then clear their board with Towerfall and bottom-deck effects.',
    plan: [
      { phase: 'early', text: 'Roll the d4 on turn one and steer a Gig to its minimum (Trust No One, Jackie); make value-pairs with Peace Offering so Hanako draws each turn.' },
      { phase: 'mid', text: 'Stall attackers with Chrome Reverie, Nocturne and Memory Relapse while Three Mouths and Delamain refill the hand.' },
      { phase: 'closing', text: 'Wipe or bottom-deck the rival’s Units (Towerfall, Pyramid Song, Les Élémens, Maman Brigitte), then steal with Placide and MaxTac AV.' },
    ],
    keyCards: [
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'Legend: draws per value-pair each turn and swaps Gigs with the rival.' },
      { id: 'jackie_welles_pour_one_out_for_me', role: 'Legend: drops a Gig to min on Blue plays and draws.' },
      { id: 'pyramid_song', role: 'Shrinks or bottom-decks a Unit; both modes with a min d4.' },
      { id: 'towerfall', role: 'The sweeper: −5 power to all rival Units, or bottom-deck the 0-power ones.' },
      { id: 'les_elemens', role: 'Bottom-decks the rival’s lowest-power Unit.' },
      { id: 'placide_voodoo_sentinel', role: '10-power finisher that bottom-decks a Unit.' },
    ],
    signals: [
      { text: 'A friendly min Gig by round 1 or 2', terms: ['min-gig', 'round'] },
      { text: 'A value-pair in play at the start of your turn by round 3', terms: ['value-pair', 'round'] },
      { text: 'Three or more extra cards drawn by round 4', terms: ['cards-drawn', 'round'] },
      { text: 'One effect removes two or more rival Units', terms: ['sweep'] },
    ],
    risks: ['Very aggressive decks, per the author; the deck is at its best going first.'],
    source: 'guide',
    status: 'draft',
    guide: { title: 'BBG Draw and Wipe', author: 'WillGlitch', site: 'choom.gg', url: 'https://choom.gg/guides/bbg-draw-and-wipe-f4d128' },
  },

  'GGY-gear-n-go.txt': {
    listId: '70b7814bee9f69bc',
    objective: 'Equip cheap Units, take an early Gig or two, then hold the lead behind Blockers while readying effects let the same Units attack and defend.',
    plan: [
      { phase: 'early', text: 'Play 2–3 cost Units and Gear (Riot Shield, Mandibular Upgrade, Zetatech Faceplate) and steal a couple of Gigs.' },
      { phase: 'mid', text: 'Build a defensive line of Blockers; Sandevistan and Panam ready equipped Units so attacking doesn’t leave you open.' },
      { phase: 'closing', text: 'Use Overwatch to pick off spent rival Units and Goro Takemura: Losing His Way (all Legends face-up) to push the last Gigs.' },
    ],
    keyCards: [
      { id: 'panam_palmer_nomad_cavalry', role: 'Legend: moves Gear to a Unit and readies it; readies everything with 5+ equipped.' },
      { id: 'dum_dum_maelstrom_triggerman', role: 'Legend: draws on Call and pumps a Unit per equipped Gear at Quick speed.' },
      { id: 'sandevistan', role: 'Readies its Unit at end of turn, so attackers can still block.' },
      { id: 'overwatch_panam_s_gift', role: 'Quick removal of a spent rival Unit.' },
      { id: 'riot_shield', role: 'Gives Blocker and taxes the rival’s Go Solo.' },
      { id: 'goro_takemura_losing_his_way', role: '+5 power on attack once all Legends are face-up.' },
    ],
    signals: [
      { text: 'First Gig stolen by round 3', terms: ['first-steal', 'round'] },
      { text: 'A Gig lead at the end of round 4', terms: ['gig-lead', 'round'] },
      { text: 'Three or more Units or Legends with Gear equipped by round 4', terms: ['gear-equipped', 'round'] },
      { text: 'A ready Blocker at the start of each rival turn from round 3', terms: ['ready-blocker', 'round'] },
    ],
    risks: [],
    source: 'guide',
    status: 'draft',
    guide: { title: "Gear'n'Go", author: '_helvetica', site: 'choom.gg', url: 'https://choom.gg/guides/gear-n-go-2fda06' },
  },

  'GYY-keep-em-guessing.txt': {
    listId: 'e719f7000704df41',
    objective: 'Play a patient defensive game, flip Legends early, and punish the rival’s attacks with Quick Blocker grants and instant-speed Gear.',
    plan: [
      { phase: 'early', text: 'Call Legends quickly (Goro: Vengeful Bodyguard and River Ward matter most) and set up cheap Blockers and Gear.' },
      { phase: 'mid', text: 'Wait for the rival to attack, then give a bigger Unit Blocker with Goro or drop Gear on it with River to win the fight; Viktor and Sketchy Ripper find the Gear.' },
      { phase: 'closing', text: 'Switch to attacking with Jackie Welles: Ride or Die Choom and Saul Bright once the rival has over-extended.' },
    ],
    keyCards: [
      { id: 'goro_takemura_vengeful_bodyguard', role: 'Legend: Quick Blocker (and +1 power with a value-pair) on a Unit costing 4 or less.' },
      { id: 'river_ward_detective_on_the_hunt', role: 'Legend: plays a cheap Gear from hand for free at Quick speed.' },
      { id: 'viktor_vektor_you_might_feel_a_little_pinch', role: 'Replays a cheap Cyberware Gear from the trash onto another Unit.' },
      { id: 'jackie_welles_ride_or_die_choom', role: 'Aggressive finisher that grows with even Gigs.' },
      { id: 'saul_bright_stormrider', role: 'Late finisher: 14 power and +2 to the other attackers.' },
    ],
    signals: [
      { text: 'Two Legends face-up by round 3', terms: ['legend-face-up', 'round'] },
      { text: 'A Legend Called during a rival attack', terms: ['call-in-react'] },
      { text: 'Rival attacks held with no Gig stolen in rounds 2–4', terms: ['defence-held', 'round'] },
      { text: 'A Gig lead when Jackie or Saul first attacks', terms: ['gig-lead'] },
    ],
    risks: [],
    source: 'guide',
    status: 'draft',
    guide: { title: "Keep 'Em Guessing", author: 'CunninghamsAlt', site: 'choom.gg', url: 'https://choom.gg/guides/keep-em-guessing-61f5a5' },
  },

  'RBY-samurai.txt': {
    listId: 'b52e36b761c5cc0c',
    objective: 'Take the initiative with Rocker Units, using Johnny to let fresh Rockers attack spent Units and Kerry to draw off extreme Gig rolls.',
    plan: [
      { phase: 'early', text: 'Sell and set Gigs with Industrial Assembly, Afterparty and Trust No One; Kerry Eurodyne (Legend) draws on min or max rolls.' },
      { phase: 'mid', text: 'Land Kerry: The Last Rockerboy and Rockn’ Rockerboy; Johnny lets them attack spent rival Units the turn they arrive, with +2 for Rockers.' },
      { phase: 'closing', text: 'Close with Johnny Silverhand: Never Stop Fighting and Placide; keep Chrome Reverie and Reboot Optics to protect the push.' },
    ],
    keyCards: [
      { id: 'johnny_silverhand_rocking_renegade', role: 'Legend: a new Unit may attack spent Units at once; Rockers get +2; cheaper with 8+ Gigs.' },
      { id: 'kerry_eurodyne_axe_attitude_audience', role: 'Legend: rerolls a Gig and draws on min or max rolls.' },
      { id: 'kerry_eurodyne_the_last_rockerboy', role: 'Rocker that draws 2 while you control an 8+ Gig.' },
      { id: 'rockn_rockerboy', role: '8-power Rocker for 5.' },
      { id: 'johnny_silverhand_never_stop_fighting', role: 'Readies after its first won fight each turn.' },
    ],
    signals: [
      { text: 'A friendly Gig at 8+ by round 3', terms: ['high-gig', 'round'] },
      { text: 'A Unit attacks the turn it was played', terms: ['same-turn-attack'] },
      { text: 'A fight won by a Rocker by round 4', terms: ['fight-won', 'round'] },
      { text: 'First Gig stolen by round 3', terms: ['first-steal', 'round'] },
    ],
    risks: [],
    source: 'guide',
    status: 'draft',
    guide: { title: 'Samurai', author: 'Esco_Bruni', site: 'choom.gg', url: 'https://choom.gg/guides/samurai-3a90ee' },
  },

  'RRB-alt-v-del.txt': {
    listId: 'fad186051ca958b7',
    objective: 'A Red midrange curve of 4–5 cost Units that raises Gigs to 8+ to power Johnny and Carnage, with Alt replaying key Programs from the trash.',
    plan: [
      { phase: 'early', text: 'Find Units with All is Lost and push a Gig to 8+ with Industrial Assembly; V: Streetkid’s Call fills the trash.' },
      { phase: 'mid', text: 'Curve 6th Street Recruits, Meredith Stout and Screw; Alt replays Programs such as Over the Edge or Gunpoint Diplomacy from the trash.' },
      { phase: 'closing', text: 'Finish with Yorinobu: Steel Dragon (replaying a 4-cost Unit) and Johnny Silverhand: Never Stop Fighting.' },
    ],
    keyCards: [
      { id: 'alt_cunningham_soulkiller_architect', role: 'Legend: replays a Program from the trash.' },
      { id: 'johnny_silverhand_rocking_renegade', role: 'Legend: new Units attack spent Units at once; cheaper with 8+ Gigs.' },
      { id: 'v_streetkid', role: 'Legend: Call trashes 3 and returns a Braindance; Go Solo for 5.' },
      { id: 'industrial_assembly', role: 'Raises a Gig to 8+ and draws.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Two-for-one finisher that replays a 4-cost Unit.' },
    ],
    signals: [
      { text: 'A friendly Gig at 8+ by round 2', terms: ['high-gig', 'round'] },
      { text: 'A Program played from the trash by round 4', terms: ['program-played', 'round'] },
      { text: 'Three Units on the field by round 4', terms: ['units-on-field', 'round'] },
    ],
    risks: [],
    // The guide's free portion is the list only (no strategy text), so this note is drawn from the list.
    source: 'list',
    status: 'draft',
  },

  'RRG-smash-the-curve.txt': {
    listId: 'e52b6c067e61d51b',
    objective: 'Hit the curve with efficient 4-cost 6-power Units, clear blockers with Red removal, and close with Saburo-boosted 10-power swings.',
    plan: [
      { phase: 'early', text: 'On the play, sell and Call a Legend on turn one; on the draw, attack and drop a 4/6 at once. Keep hands with two 4-cost Units and sellables.' },
      { phase: 'mid', text: 'Add another 4/6 each turn; Call the next Legend or hold it to Call during the rival’s attack. Pepe with a value-pair readies V and Smasher.' },
      { phase: 'closing', text: 'Adam Smasher, Yorinobu and Animals Wrecker on board hit as 10s and steal two Gigs each; Bonnie and Clyde and Carnage clear the way.' },
    ],
    keyCards: [
      { id: 'saburo_arasaka_stubborn_patriarch', role: 'Legend: +1 power to attacking Arasaka Units, so Yorinobu and Smasher reach 10.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Legend: Go Solo for 9 defeats the best rival Unit and attacks.' },
      { id: 'pepe_najarro_working_doubles', role: '4/6 that readies MERC Legends with a value-pair (extra mana).' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Replays a 4-cost Unit from hand or trash; 10 power with Saburo.' },
      { id: 'animals_wrecker', role: '10-power Unit: steals two Gigs.' },
      { id: 'synapse_burnout', role: 'One-mana Quick trick: +1 power per face-up Legend in a fight.' },
    ],
    signals: [
      { text: 'A 4-cost Unit played on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'Three Legends face-up by round 4', terms: ['legend-face-up', 'round'] },
      { text: 'A two-Gig steal by round 6', terms: ['double-steal', 'ten-power', 'round'] },
    ],
    risks: [],
    source: 'guide',
    status: 'draft',
    guide: { title: 'Smash the Curve', author: 'Cacheira', site: 'choom.gg', url: 'https://choom.gg/guides/smash-the-curve-623327' },
  },

  'RRR-the-red-chrome-aggro.txt': {
    listId: '0b75f6c9c57007f3',
    objective: 'Win through combat: put big Red Units on the board, arm them with Gear, and race to seven Gigs.',
    plan: [
      { phase: 'early', text: 'Sell high-cost Programs to build Eddies; play Valentino Guerrera and 6th Street Recruits.' },
      { phase: 'mid', text: 'Arm attackers with Mantis Blades and Satori; Chrome Fang guards your high Gigs while you race. Over the Edge and Carnage clear blockers.' },
      { phase: 'closing', text: 'Go Solo with Royce (stronger per Gear) or Adam Smasher and swing with Animals Wrecker, Johnny and Minotaur.' },
    ],
    keyCards: [
      { id: 'royce_psycho_on_the_edge', role: 'Legend: Go Solo, +2 power per equipped Gear on your turn.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Legend: Go Solo removes a Unit and attacks.' },
      { id: 'chrome_fang', role: 'Stops low-power rival Units stealing your high Gigs until your next turn.' },
      { id: 'animals_wrecker', role: '10-power Unit: steals two Gigs.' },
      { id: 'over_the_edge', role: 'Removal scaled by your d20.' },
      { id: 'mantis_blades', role: 'Cheap Gear for power and Royce.' },
    ],
    signals: [
      { text: 'First Gig stolen by round 3', terms: ['first-steal', 'round'] },
      { text: 'A Legend played with Go Solo by round 5', terms: ['go-solo', 'round'] },
      { text: 'A two-Gig steal in the game', terms: ['double-steal', 'ten-power'] },
      { text: 'A Gig lead at the end of round 4', terms: ['gig-lead', 'round'] },
    ],
    risks: [],
    source: 'guide',
    status: 'draft',
    guide: { title: 'The Red Chrome - Aggro', author: 'Cyrill Lampart', site: 'choom.gg', url: 'https://choom.gg/guides/the-red-chrome-aggro-cc277e' },
  },

  'RRY-fills-up-discard-super-quickly-then-heavily-discounted-traum.txt': {
    listId: '8de1592a4eb2eda2',
    objective: 'Load the trash fast so Trauma Team Operatives come down for next to nothing, then overwhelm the board with high-power Rockers backed by Johnny.',
    plan: [
      { phase: 'early', text: 'Trash cards with All is Lost, The Heist and V: Streetkid’s Call, picking up Units along the way.' },
      { phase: 'mid', text: 'Play discounted Trauma Team Operatives alongside Rockn’ Rockerboy and Johnny Silverhand: Never Stop Fighting for a big board quickly.' },
      { phase: 'closing', text: 'Johnny’s Legend ability lets fresh Rockers hit spent Units with +2; keep attacking until the Gigs are yours.' },
    ],
    keyCards: [
      { id: 'trauma_team_operatives', role: '7-power Unit that costs 1 less per Unit in your trash.' },
      { id: 'all_is_lost', role: 'Trashes 3 and keeps a Unit: fuel and card selection.' },
      { id: 'v_streetkid', role: 'Legend: Call trashes 3.' },
      { id: 'johnny_silverhand_rocking_renegade', role: 'Legend: new Rockers attack spent Units at once with +2.' },
      { id: 'rockn_rockerboy', role: '8-power Rocker for 5.' },
    ],
    signals: [
      { text: 'Eight or more cards in your trash by round 3', terms: ['trash-size', 'round'] },
      { text: 'Three Units on the field by round 4', terms: ['units-on-field', 'round'] },
      { text: 'A Unit attacks the turn it was played', terms: ['same-turn-attack'] },
    ],
    risks: ['Fewer sellable cards than most lists, so Eddies can run short (the author’s own note).'],
    source: 'guide',
    status: 'draft',
    guide: {
      title: 'Fills up Discard super quickly then heavily discounted Trauma Team Operatives and high power Rockerboys fill the board.',
      author: 'Haris Karabegovic',
      site: 'choom.gg',
      url: 'https://choom.gg/guides/fills-up-discard-super-quickly-then-heavily-discounted-trauma-team-operatives-and-high-power-rockerboys-fill-the-board-d42deb',
    },
  },

  'YYY-ripbecca.txt': {
    listId: '709d7542b010cc30',
    objective: 'Get The Relic onto a Unit and Adam Smasher: Metal Over Meat into the trash, so the Relic brings him back to wipe the board, again and again.',
    plan: [
      { phase: 'early', text: 'Hold the ground with cheap Blockers (Bombus, Negotiators, Mandibular Upgrade); The Heist trashes cards and digs for Gear.' },
      { phase: 'mid', text: 'Equip The Relic and get a Smasher into the trash; when the Relic’s Unit is defeated, Smasher returns and defeats every other Unit.' },
      { phase: 'closing', text: 'The second Smasher sends the first to the trash for another reset; steal with Trauma Team and Gorilla Arms on the empty board.' },
    ],
    keyCards: [
      { id: 'the_relic_experimental_biochip', role: 'When its Unit is defeated, replays a Unit costing 9 or less from the trash.' },
      { id: 'adam_smasher_metal_over_meat', role: 'Defeats all other Units on play.' },
      { id: 'the_heist', role: 'Trashes 4 and finds Gear (free when its cost matches a Gig).' },
      { id: 'river_ward_detective_on_the_hunt', role: 'Legend: plays cheap Gear for free at Quick speed.' },
      { id: 'trauma_team_operatives', role: 'Cheap follow-up body once the trash fills.' },
    ],
    signals: [
      { text: 'Adam Smasher: Metal Over Meat in the trash and The Relic equipped by round 5', terms: ['trash-size', 'gear-equipped', 'round'] },
      { text: 'One effect removes two or more rival Units', terms: ['sweep'] },
      { text: 'A Gig lead after the first board wipe', terms: ['gig-lead'] },
    ],
    risks: [],
    source: 'guide',
    status: 'draft',
    guide: { title: "Addin' Trash", author: 'Matchlock', site: 'choom.gg', url: 'https://choom.gg/guides/ripbecca-48b28a' },
  },

  'YYY-yyy-adam-ready-for-brawl.txt': {
    listId: '5331325a1a4e3b1e',
    objective: 'Play mono-Yellow Adam proactively: go second, contest Gigs from the first turn, and keep the board wipes as traps for a rival who over-commits.',
    plan: [
      { phase: 'early', text: 'Go second and play sturdy early Units (Dexter: One Last Chance, Maelstrom Goons, Negotiators) to contest Gigs at once; The Heist cheats Gear in when its cost matches a Gig.' },
      { phase: 'mid', text: 'Push with Gorilla Arms and Adrenaline Converter; Bootleg Black Sapphire Show refuels when you hold an even and an odd Gig.' },
      { phase: 'closing', text: 'When the rival floods the board to stop you, answer with Live with the Aftermath or Adam Smasher: Metal Over Meat; The Relic brings Smasher back.' },
    ],
    keyCards: [
      { id: 'adam_smasher_metal_over_meat', role: 'Board wipe and 15-power finisher.' },
      { id: 'the_heist', role: 'Digs for Gear and plays it free on a matching Gig.' },
      { id: 'the_relic_experimental_biochip', role: 'Brings a Unit (Smasher) back from the trash when its carrier dies.' },
      { id: 'live_with_the_aftermath', role: 'Each player defeats a Unit: punishes a rival with one big threat.' },
      { id: 'bootleg_black_sapphire_show', role: 'Mid-game card flow with mixed even/odd Gigs.' },
      { id: 'river_ward_detective_on_the_hunt', role: 'Legend: Quick free Gear for surprise fights.' },
    ],
    signals: [
      { text: 'First Gig stolen by round 2', terms: ['first-steal', 'round'] },
      { text: 'Gear played for free off The Heist by round 3', terms: ['gear-equipped', 'round'] },
      { text: 'One effect removes two or more rival Units', terms: ['sweep'] },
      { text: 'Two extra cards drawn from Bootleg Black Sapphire Show by round 5', terms: ['cards-drawn', 'round'] },
    ],
    risks: [
      'Playing slowly gives aggressive and midrange decks time to set up, per the author.',
      'Rival board-clears the author says to play around: Live with the Aftermath, Towerfall, Carnage at the Colosseum.',
    ],
    source: 'guide',
    status: 'draft',
    guide: { title: 'YYY Adam v1 - Ready for Brawl', author: 'Trinx', site: 'choom.gg', url: 'https://choom.gg/guides/yyy-adam-ready-for-brawl-58762b' },
  },
};
