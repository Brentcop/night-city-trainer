// Deck objectives for the earlier Season 4 and Season 5 bred decks, archived at the 2026-11-11 baseline
// (data/decks/archive/s4-*.txt, s5-*.txt; see ./archived.ts).
// Mutants and crossovers build on their parents' notes plus what changed; explorers have no parent and are read from the list.
import type { ObjectiveTable } from './vocabulary';

const RRG_RISK = 'Keeps the RRG Dexter Midrange finisher core, which that deck’s Strategy guide says bottom-deck effects answer cleanly.';
const GO_WIDE_RISK = 'Inherits the NC-02 go-wide shell; its Strategy guide names sweepers (Towerfall, Live with the Aftermath) as what punishes going wide.';

export const BRED_LATE_OBJECTIVES: ObjectiveTable = {
  's4-01-mutant-rbb.txt': {
    listId: 'a37ea539142e6fd6',
    objective: 'Blue removal control that answers every Unit with bottom-deck effects and sweepers, then lands Placide or an Adam Smasher Go Solo to take the Gigs back.',
    plan: [
      { phase: 'early', text: 'Use Three Mouths and Trust No One to find answers; Chrome Reverie and Nocturne stop the first attackers.' },
      { phase: 'mid', text: 'Trade Pyramid Song, Les Élémens and Maman Brigitte one-for-one; fire Towerfall into two or more Units.' },
      { phase: 'closing', text: 'Once the rival’s board is empty, Go Solo V or Adam Smasher (which defeats a Unit as it enters) and attack.' },
    ],
    keyCards: [
      { id: 'adam_smasher_ender_of_legends', role: 'New Legend in this mutant (replaces Saburo): Go Solo for 9 defeats a rival Unit and attacks at once.' },
      { id: 'towerfall', role: 'Sweeper: -5 power to all rival Units, or both modes when behind on Street Cred.' },
      { id: 'les_elemens', role: 'Bottom-decks the rival’s lowest-power Unit.' },
      { id: 'pyramid_song', role: 'Cheap removal; both modes with a min d4.' },
      { id: 'placide_voodoo_sentinel', role: '10-power finisher that bottom-decks a Unit on play and attack by discarding a Program.' },
    ],
    signals: [
      { text: 'at least two removal effects by round 4', terms: ['removal', 'round'] },
      { text: 'a Towerfall sweep of two or more Units', terms: ['sweep'] },
      { text: 'Adam Smasher or V played with Go Solo and attacking the same turn', terms: ['go-solo', 'same-turn-attack'] },
      { text: 'a Gig lead from round 5 on', terms: ['gig-lead', 'round'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-07-explorer-bbg.txt'],
  },

  's4-02-mutant-rgg.txt': {
    listId: 'ea8df82fd65c4688',
    objective: 'Green value-pair control: build Gig pairs for Hanako’s draws, spend and defeat the rival’s Units, then swing big with MaxTac AV, Sandayu and Pepe.',
    plan: [
      { phase: 'early', text: 'Peace Offering and Industrial Assembly set up value-pairs; Hanako turns each pair into a card per turn.' },
      { phase: 'mid', text: 'Memory Relapse and Wild in the Streets spend then defeat attackers; MaxTac AV swaps a low Gig for a rival high one.' },
      { phase: 'closing', text: 'The Reaper or Sandayu clears blockers, then Pepe (readying MERC Legends) and the 8-power Units take the Gigs.' },
    ],
    keyCards: [
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'New Legend in this mutant (replaces Yorinobu): draws per value-pair and swaps Gigs.' },
      { id: 'maxtac_av', role: '8-power body that swaps a friendly Gig for a rival Gig on play.' },
      { id: 'don_t_fear_the_reaper', role: 'Spends every rival Unit, then defeats one: the board-clearing turn.' },
      { id: 'sandayu_oda_hanako_s_guardian', role: 'Spends a rival Unit per value-pair and can attack Units the turn it lands.' },
      { id: 'pepe_najarro_working_doubles', role: 'With a value-pair, readies Jackie (MERC) for extra mana or a second body.' },
    ],
    signals: [
      { text: 'a value-pair of Gigs by round 3', terms: ['value-pair', 'round'] },
      { text: 'two or more extra cards drawn by round 5', terms: ['cards-drawn', 'round'] },
      { text: 'a Gig swap or steal that puts you ahead by round 6', terms: ['gig-lead', 'round'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s2-08-explorer-rrg.txt'],
  },

  's4-03-mutant-rrb.txt': {
    listId: 'c8fde0b1d7f935ee',
    objective: 'Red removal-heavy midrange that clears the way with cheap answers and wins with 10-power attackers, now with Royce as a Gear-fed Go Solo threat.',
    plan: [
      { phase: 'early', text: 'Satori on early Units (it also feeds Royce); Chrome Reverie or Nocturne slows the first attackers.' },
      { phase: 'mid', text: 'Over the Edge, Bonnie and Clyde and Carnage remove blockers; Psycho Squad and 6th Street hold the 4-drop slot.' },
      { phase: 'closing', text: 'Animals Wrecker or Placide attacks at 10 power for two Gigs; Royce Go Solo (+2 per Gear) or Adam Smasher finishes.' },
    ],
    keyCards: [
      { id: 'royce_psycho_on_the_edge', role: 'New Legend in this mutant (replaces Saburo): Go Solo for 6, +2 power per equipped Gear on your turn.' },
      { id: 'animals_wrecker', role: '10-power Unit: every attack on the Gig area steals two.' },
      { id: 'carnage_at_the_colosseum', role: 'Defeats a smaller rival Unit; cheaper for each friendly 8+ Gig.' },
      { id: 'over_the_edge', role: 'Defeats a Unit up to the value of a friendly d20.' },
      { id: 'satori_sword_of_saburo', role: 'Gear that draws when its Unit wins a fight, and powers Royce.' },
    ],
    signals: [
      { text: 'a double steal by round 6', terms: ['double-steal', 'round'] },
      { text: 'two or more removal effects by round 4', terms: ['removal', 'round'] },
      { text: 'Royce Go Solo with at least one Gear equipped', terms: ['go-solo', 'gear-equipped'] },
    ],
    risks: [RRG_RISK],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-04-cross-rbg.txt'],
  },

  's4-04-cross-bbg.txt': {
    listId: '64a28c44248bdac8',
    objective: 'Blue bottom-deck control with a Green Pepe and Street Racer package: answer the board, then turn the corner with MERC Legends.',
    plan: [
      { phase: 'early', text: 'Three Mouths and Trust No One sculpt the hand; Take Control and Chrome Reverie blunt early steals.' },
      { phase: 'mid', text: 'Pyramid Song, Les Élémens and Maman Brigitte bottom-deck threats; Towerfall when two or more Units are out.' },
      { phase: 'closing', text: 'Pepe readies V, Jackie or Sasha with a value-pair; Street Racer gives a surprise attack; Placide closes.' },
    ],
    keyCards: [
      { id: 'towerfall', role: 'Sweeper that resets a wide board.' },
      { id: 'les_elemens', role: 'Bottom-decks the rival’s smallest Unit.' },
      { id: 'pepe_najarro_working_doubles', role: 'Readies two MERC Legends (all three here are MERC) when you hold a value-pair.' },
      { id: 'valentino_street_racer', role: 'Gives another Unit Adrenaline for a same-turn attack.' },
      { id: 'placide_voodoo_sentinel', role: '10-power closer that removes a Unit on play and attack.' },
    ],
    signals: [
      { text: 'three or more removal effects by round 5', terms: ['removal', 'round'] },
      { text: 'a Towerfall sweep of two or more Units', terms: ['sweep'] },
      { text: 'a same-turn attack from Street Racer or a Go Solo Legend', terms: ['same-turn-attack'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s2-08-explorer-rrg.txt', 's1-07-explorer-bbg.txt'],
  },

  's4-05-cross-rbg.txt': {
    listId: 'f38d7e0bc1458c42',
    objective: 'A low-curve tempo deck that stalls the rival’s attackers with spend effects and Gig swaps, then wins with Saul Bright pumping every attacker.',
    plan: [
      { phase: 'early', text: 'Cheap Gear and Programs; Corporate Surveillance and Chrome Reverie keep rival attackers home.' },
      { phase: 'mid', text: '6th Street and Pepe on curve; MaxTac AV swaps for a rival high Gig; Over the Edge clears a blocker.' },
      { phase: 'closing', text: 'Saul Bright gives other attackers +2 and readies three Units; Dexter’s +2 pushes a 6-power attacker to 10.' },
    ],
    keyCards: [
      { id: 'saul_bright_stormrider', role: '14-power finisher: +2 to every other attacker and readies Units at end of turn.' },
      { id: 'maxtac_av', role: 'Gig swap on play plus an 8-power body.' },
      { id: 'memory_relapse', role: 'Spends a rival blocker so it can’t ready before your attack.' },
      { id: 'dexter_deshawn_off_the_grid', role: 'Call for +2 power on an attacker or a card; Spend raises a Gig by 2.' },
      { id: 'valentino_street_racer', role: 'Adrenaline for a surprise attack.' },
    ],
    signals: [
      { text: 'three or more Units on the field by round 4', terms: ['units-on-field', 'round'] },
      { text: 'first Gig stolen by round 3', terms: ['first-steal', 'round'] },
      { text: 'a double steal once Saul Bright is out', terms: ['double-steal'] },
    ],
    risks: [GO_WIDE_RISK],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-05-cross-rgy.txt', 's1-01-mutant-rrb.txt'],
  },

  's4-06-cross-rgg.txt': {
    listId: '516bfaf83787f5b8',
    objective: 'Green spend-and-defeat control around value-pairs, using Saburo and Yorinobu to keep card flow and push Arasaka attackers.',
    plan: [
      { phase: 'early', text: 'Peace Offering and Industrial Assembly fix Gigs into pairs; Field Operator and Street Racer fill the early board.' },
      { phase: 'mid', text: 'Memory Relapse and Wild in the Streets spend then defeat; MaxTac AV swaps Gigs; Shattered Memories refuels.' },
      { phase: 'closing', text: 'The Reaper or Sandayu (spends a Unit per pair) clears the way for Pepe, MaxTac and Sandayu to steal.' },
    ],
    keyCards: [
      { id: 'don_t_fear_the_reaper', role: 'Spends all rival Units, then defeats one.' },
      { id: 'sandayu_oda_hanako_s_guardian', role: 'ARASAKA 8-power Unit: spends rival Units per value-pair, hits Units on arrival; Saburo makes it 9 attacking.' },
      { id: 'wild_in_the_streets', role: 'Defeats a spent Unit; pairs with Memory Relapse.' },
      { id: 'maxtac_av', role: 'Swaps a low friendly Gig for a high rival one.' },
      { id: 'yorinobu_arasaka_embracing_destruction', role: 'Draws on the first ARASAKA attack each turn.' },
    ],
    signals: [
      { text: 'a value-pair of Gigs by round 3', terms: ['value-pair', 'round'] },
      { text: 'two or more removal effects by round 5', terms: ['removal', 'round'] },
      { text: 'a Gig lead at the start of overtime', terms: ['gig-lead', 'overtime'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s2-04-cross-rrg.txt', 's2-08-explorer-rrg.txt'],
  },

  's4-07-explorer-rrb.txt': {
    listId: '548116e1ce0d6bc9',
    objective: 'Red midrange built on 6-power 4-drops and cheap removal, finishing with 10-power Animals Wrecker and Yorinobu: Steel Dragon, with Royce and Sasha as Go Solo threats.',
    plan: [
      { phase: 'early', text: 'Gear (Mantis Blades, Satori) and Swordwise Huscle; Chrome Reverie or Mox Inciters slow the rival.' },
      { phase: 'mid', text: '6th Street and Psycho Squad on curve; Bonnie and Clyde, Over the Edge and Carnage remove blockers.' },
      { phase: 'closing', text: 'Animals Wrecker steals two Gigs per attack; Steel Dragon replays a 4-drop; Dexter adds +2 to reach 10.' },
    ],
    keyCards: [
      { id: 'animals_wrecker', role: '10 power: two Gigs per steal.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Plays a free 4-drop from hand or trash that can attack Units the same turn.' },
      { id: 'royce_psycho_on_the_edge', role: 'Go Solo Legend that gains +2 power per equipped Gear on your turn.' },
      { id: 'carnage_at_the_colosseum', role: 'Defeats a smaller rival Unit, cheaper with 8+ Gigs.' },
      { id: '6th_street_recruits', role: '6-power 4-drop that raises a Gig after stealing a d6.' },
    ],
    signals: [
      { text: 'a 4-cost Unit played on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'a double steal by round 6', terms: ['double-steal', 'round'] },
      { text: 'two or more removal effects by round 5', terms: ['removal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'draft',
  },

  's4-08-explorer-rry.txt': {
    listId: '913980f7bd795bb1',
    objective: 'Red-Yellow high-Gig midrange: push Gigs to 8+ to fuel Kerry’s draws and cheap Carnage, then close with 10-power Wrecker and Steel Dragon.',
    plan: [
      { phase: 'early', text: 'Afterparty, Industrial Assembly, Faceplate and Dexter: One Last Chance adjust Gigs upward and draw.' },
      { phase: 'mid', text: '6th Street and Kerry: The Last Rockerboy (draws 2 with an 8+ Gig); Over the Edge and Bonnie and Clyde clear blockers.' },
      { phase: 'closing', text: 'Animals Wrecker, Jackie: Ride or Die (+2 per even Gig) and Steel Dragon attack for multiple Gigs.' },
    ],
    keyCards: [
      { id: 'kerry_eurodyne_the_last_rockerboy', role: 'Draws 2 on Spend while you control an 8+ Gig.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal costing 1 less per friendly 8+ Gig.' },
      { id: 'zetatech_faceplate', role: 'Adjusts a Gig whenever its holder is spent; draws with three different Gig values.' },
      { id: 'animals_wrecker', role: '10-power double-steal finisher.' },
      { id: 'viktor_vektor_sit_down_and_relax', role: 'Call to find up to two cheap Gear from the top five cards.' },
    ],
    signals: [
      { text: 'a friendly Gig at 8+ by round 3', terms: ['high-gig', 'round'] },
      { text: 'two or more extra cards drawn by round 4', terms: ['cards-drawn', 'round'] },
      { text: 'a double steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'draft',
  },

  's5-01-mutant-rbg.txt': {
    listId: '1f796f99dbbd7cdf',
    objective: 'S4-04’s Blue-Green control with Dexter in place of Sasha: fewer sweepers, more Red removal, and Dexter’s +2 or Gig raise to swing key turns.',
    plan: [
      { phase: 'early', text: 'Trust No One, All is Lost and Nocturne find pieces; Chrome Reverie and Take Control slow attacks.' },
      { phase: 'mid', text: 'Over the Edge, Unlikely Bond and Memory Relapse handle threats; Pepe and MaxTac AV take the board.' },
      { phase: 'closing', text: 'Pepe readies V and Jackie with a value-pair; Street Racer adds a surprise attacker; Placide closes.' },
    ],
    keyCards: [
      { id: 'dexter_deshawn_off_the_grid', role: 'New Legend in this mutant (replaces Sasha): Call for +2 power or a card; Spend raises a Gig by 2.' },
      { id: 'pepe_najarro_working_doubles', role: 'Readies two MERC Legends (V, Jackie) with a value-pair.' },
      { id: 'maxtac_av', role: 'Gig swap on play and an 8-power body.' },
      { id: 'over_the_edge', role: 'Removal scaled by a friendly d20.' },
      { id: 'placide_voodoo_sentinel', role: '10-power finisher with repeatable bottom-deck.' },
    ],
    signals: [
      { text: 'Dexter Called during the rival’s attack to win a fight', terms: ['call-in-react', 'fight-won'] },
      { text: 'two or more removal effects by round 4', terms: ['removal', 'round'] },
      { text: 'a value-pair of Gigs when Pepe attacks', terms: ['value-pair'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s4-04-cross-bbg.txt'],
  },

  's5-02-mutant-bgg.txt': {
    listId: '81b7edced4955c1d',
    objective: 'Green spend-and-defeat control with a Blue stall suite: keep rival attackers spent or locked, clear with The Reaper, and win with MaxTac, Pepe and Placide.',
    plan: [
      { phase: 'early', text: 'Peace Offering and Trust No One set Gigs; Chrome Reverie and Nocturne stop the first attacks.' },
      { phase: 'mid', text: 'Memory Relapse, Wild in the Streets and Overwatch (defeats a spent Unit) answer threats; MaxTac AV swaps Gigs.' },
      { phase: 'closing', text: 'The Reaper clears the board; Pepe readies Jackie and Sasha; Placide and MaxTac take the last Gigs.' },
    ],
    keyCards: [
      { id: 'jackie_welles_mama_s_favorite', role: 'New Legend in this mutant (replaces V): Go Solo 8-power body that can take a defeat for a friendly Unit.' },
      { id: 'don_t_fear_the_reaper', role: 'Spends all rival Units, then defeats one.' },
      { id: 'overwatch_panam_s_gift', role: 'Quick Gear ability that defeats a spent rival Unit.' },
      { id: 'memory_relapse', role: 'Spends a rival Unit and keeps it from readying.' },
      { id: 'maxtac_av', role: 'Gig swap plus an 8-power attacker.' },
    ],
    signals: [
      { text: 'two or more removal effects by round 5', terms: ['removal', 'round'] },
      { text: 'a rival attack held with no Gig stolen in rounds 2–4', terms: ['defence-held', 'round'] },
      { text: 'a Gig lead at the start of overtime', terms: ['gig-lead', 'overtime'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-07-explorer-bbg.txt'],
  },

  's5-03-mutant-rgg.txt': {
    listId: 'a5e04dfb971c7934',
    objective: 'S2-08’s Green-Red control with Hanako in place of Dexter: draw off value-pairs, spend and defeat the rival’s Units, and finish with Saul Bright.',
    plan: [
      { phase: 'early', text: 'All is Lost and Peace Offering find Units and fix Gigs into pairs for Hanako.' },
      { phase: 'mid', text: 'Memory Relapse plus Wild in the Streets remove attackers; MaxTac AV and Pepe hold the board.' },
      { phase: 'closing', text: 'The Reaper clears blockers, then Saul Bright pumps every attacker and readies three Units.' },
    ],
    keyCards: [
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'New Legend in this mutant (replaces Dexter): draws per value-pair and swaps a Gig on Spend.' },
      { id: 'saul_bright_stormrider', role: '14-power finisher that gives other attackers +2.' },
      { id: 'don_t_fear_the_reaper', role: 'Board-clearing turn before the final attack.' },
      { id: 'wild_in_the_streets', role: 'Defeats a spent Unit.' },
      { id: 'maxtac_av', role: 'Swaps Gigs on play.' },
    ],
    signals: [
      { text: 'a value-pair of Gigs by round 3', terms: ['value-pair', 'round'] },
      { text: 'two or more extra cards drawn by round 5', terms: ['cards-drawn', 'round'] },
      { text: 'a double steal once Saul Bright is out', terms: ['double-steal'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s2-08-explorer-rrg.txt'],
  },

  's5-04-cross-rgg.txt': {
    listId: '6155018f7389a22e',
    objective: 'Green spend-and-defeat control with Saburo, Jackie and Dexter: stall and remove until The Reaper opens a lane, then Saul Bright closes.',
    plan: [
      { phase: 'early', text: 'All is Lost and Peace Offering; Street Racer and Take Control cover the first attacks.' },
      { phase: 'mid', text: 'Memory Relapse and Wild in the Streets remove attackers; Pepe and MaxTac AV on curve; Shattered Memories refuels.' },
      { phase: 'closing', text: 'The Reaper, then Saul Bright plus Dexter’s +2 for 10-power attacks.' },
    ],
    keyCards: [
      { id: 'saul_bright_stormrider', role: '14-power finisher; +2 to other attackers, readies three Units.' },
      { id: 'don_t_fear_the_reaper', role: 'Spends the rival’s board and defeats one Unit.' },
      { id: 'memory_relapse', role: 'Spends a blocker and stops it readying.' },
      { id: 'dexter_deshawn_off_the_grid', role: '+2 power on Call, or raises a Gig on Spend.' },
      { id: 'pepe_najarro_working_doubles', role: 'Readies Jackie with a value-pair.' },
    ],
    signals: [
      { text: 'two or more removal effects by round 5', terms: ['removal', 'round'] },
      { text: 'a 10-power attacker by round 6', terms: ['ten-power', 'round'] },
      { text: 'a Gig lead at the start of overtime', terms: ['gig-lead', 'overtime'] },
    ],
    risks: [],
    source: 'parent',
    status: 'draft',
    basedOn: ['s2-08-explorer-rrg.txt', 's2-04-cross-rrg.txt'],
  },

  's5-05-cross-rbg.txt': {
    listId: '4f48c90e7d7abcdd',
    objective: 'S4-05’s stall-and-swap tempo shell with Yorinobu and Hanako as Legends: lock attackers, build value-pairs for cards, then win with Saul Bright.',
    plan: [
      { phase: 'early', text: 'Peace Offering, Trust No One and Nocturne; Chrome Reverie and Corporate Surveillance keep rival Units home.' },
      { phase: 'mid', text: 'Pepe and MaxTac AV take the board; Over the Edge removes a blocker; Hanako draws per pair.' },
      { phase: 'closing', text: 'Saul Bright pumps every attacker; Street Racer adds a surprise swing for the last Gigs.' },
    ],
    keyCards: [
      { id: 'saul_bright_stormrider', role: '14-power finisher that pumps other attackers.' },
      { id: 'hanako_arasaka_daughter_of_the_emperor', role: 'Draws per value-pair and swaps a Gig on Spend.' },
      { id: 'chrome_reverie', role: 'Stops a rival Unit attacking; free Call with a min Gig.' },
      { id: 'maxtac_av', role: 'Gig swap on play.' },
      { id: 'valentino_street_racer', role: 'Adrenaline for a surprise attack.' },
    ],
    signals: [
      { text: 'a value-pair of Gigs by round 3', terms: ['value-pair', 'round'] },
      { text: 'a rival attack held with no Gig stolen in rounds 2–4', terms: ['defence-held', 'round'] },
      { text: 'a double steal once Saul Bright is out', terms: ['double-steal'] },
    ],
    risks: [GO_WIDE_RISK],
    source: 'parent',
    status: 'draft',
    basedOn: ['s4-05-cross-rbg.txt', 's1-08-explorer-rrg.txt'],
  },

  's5-06-cross-rrb.txt': {
    listId: '5b4bec21b7be7f2f',
    objective: 'Red removal midrange with Royce, Yorinobu and V: clear blockers cheaply and win with 10-power Animals Wrecker and Steel Dragon.',
    plan: [
      { phase: 'early', text: 'Mantis Blades, Satori and Swordwise Huscle; All is Lost finds Units.' },
      { phase: 'mid', text: '6th Street on curve; Bonnie and Clyde, Over the Edge, Detonate and Carnage remove blockers.' },
      { phase: 'closing', text: 'Animals Wrecker and Steel Dragon attack; Royce or V Go Solo for a surprise attacker.' },
    ],
    keyCards: [
      { id: 'animals_wrecker', role: '10-power double-steal finisher.' },
      { id: 'yorinobu_arasaka_steel_dragon', role: 'Replays a 4-drop for free that can attack Units at once.' },
      { id: 'bonnie_and_clyde', role: 'Defeats one or two small rival Units.' },
      { id: 'royce_psycho_on_the_edge', role: 'Go Solo threat that grows with equipped Gear.' },
      { id: 'yorinobu_arasaka_embracing_destruction', role: 'Card flow on the first ARASAKA attack each turn.' },
    ],
    signals: [
      { text: 'a 4-cost Unit played on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'two or more removal effects by round 4', terms: ['removal', 'round'] },
      { text: 'a double steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: [RRG_RISK],
    source: 'parent',
    status: 'draft',
    basedOn: ['s1-08-explorer-rrg.txt', 's1-01-mutant-rrb.txt'],
  },

  's5-07-explorer-rry.txt': {
    listId: '32a0d810331c4761',
    objective: 'Red-Yellow Gig-manipulation midrange: adjust Gigs for Kerry’s draws and cheap Carnage, remove blockers, then finish with Wrecker, Steel Dragon or an Adam Smasher Go Solo.',
    plan: [
      { phase: 'early', text: 'Afterparty, Industrial Assembly, Faceplate and Dexter: One Last Chance adjust Gigs and draw; The Heist finds Gear.' },
      { phase: 'mid', text: '6th Street on curve; Bonnie and Clyde, Over the Edge and Carnage clear the board.' },
      { phase: 'closing', text: 'Animals Wrecker and Steel Dragon attack; Adam Smasher Go Solo defeats a blocker and attacks.' },
    ],
    keyCards: [
      { id: 'kerry_eurodyne_axe_attitude_audience', role: 'Legend: rerolls a Gig once and draws on min or max rolls (3 on a d20).' },
      { id: 'adam_smasher_ender_of_legends', role: 'Go Solo for 9: defeats a rival Unit and attacks that turn.' },
      { id: 'carnage_at_the_colosseum', role: 'Removal costing 1 less per friendly 8+ Gig.' },
      { id: 'animals_wrecker', role: '10-power double-steal finisher.' },
      { id: 'afterparty_at_lizzie_s', role: 'Adjusts a Gig and draws with two different values.' },
    ],
    signals: [
      { text: 'a friendly Gig at 8+ by round 3', terms: ['high-gig', 'round'] },
      { text: 'three or more extra cards drawn by round 5', terms: ['cards-drawn', 'round'] },
      { text: 'Adam Smasher played with Go Solo', terms: ['go-solo'] },
    ],
    risks: [],
    source: 'list',
    status: 'draft',
  },

  's5-08-explorer-rry.txt': {
    listId: '3047f4e2fb4a6def',
    objective: 'Red-Yellow Unit-heavy midrange with Adam Smasher and Rogue Go Solo threats, using Gig adjustment for draws and Jackie’s even-Gig power.',
    plan: [
      { phase: 'early', text: 'Afterparty, Faceplate and Dexter: One Last Chance adjust Gigs; Gilded Matón trades a Gear for a cheap rival Unit.' },
      { phase: 'mid', text: '6th Street on curve; Bonnie and Clyde, Over the Edge and Carnage clear blockers.' },
      { phase: 'closing', text: 'Animals Wrecker, Jackie: Ride or Die (+2 per even Gig) and Steel Dragon attack; Rogue or Adam Smasher Go Solo for the last Gigs.' },
    ],
    keyCards: [
      { id: 'rogue_amendiares_preem_solo', role: 'Go Solo Legend: when a friendly Legend steals, draw on even or make the rival discard on odd.' },
      { id: 'adam_smasher_ender_of_legends', role: 'Go Solo for 9 that defeats a rival Unit on entry.' },
      { id: 'jackie_welles_ride_or_die_choom', role: '8-power attacker, +2 per friendly even Gig.' },
      { id: 'gilded_maton', role: 'Defeats a rival Unit costing 3 or less by trading a friendly Gear.' },
      { id: 'animals_wrecker', role: '10-power double-steal finisher.' },
    ],
    signals: [
      { text: 'three or more Units on the field by round 4', terms: ['units-on-field', 'round'] },
      { text: 'a Legend played with Go Solo and stealing a Gig the same turn', terms: ['go-solo', 'same-turn-attack', 'gig-steal'] },
      { text: 'a double steal by round 6', terms: ['double-steal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'draft',
  },
};
