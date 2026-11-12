// Game terms, defined from the Comprehensive Rules (Oct 29 2026) — with how the engine models each one and how the bots use it.
import { bandsLine, SIM_TIER_MIN_GAMES, SIM_TIER_STRADDLE_BANDS } from '../lib/simTier';

export interface Term {
  term: string;
  group: 'Core' | 'Economy' | 'Gigs' | 'Combat' | 'Keywords' | 'Effects' | 'Zones' | 'Strategy';
  rule?: string;
  def: string;
  engine?: string;
  bot?: string;
}

export const GLOSSARY: Term[] = [
  // ---------------- Core
  {
    term: 'Win condition (7 Gigs)',
    group: 'Core',
    rule: 'CR 1.10–1.11',
    def: 'If you control 7 or more Gig dice at the start of your turn, you win. In overtime, controlling 7+ Gigs at any moment wins immediately.',
    engine: 'Checked before the Ready step of your Start Phase; in overtime after every action and effect.',
    bot: 'Gig difference is the heaviest term in the evaluation (40 per Gig), with an extra bonus/penalty once either side reaches 6.',
  },
  {
    term: 'Overtime',
    group: 'Core',
    rule: 'CR 1.11.1–1.11.2',
    def: 'Begins after two consecutive turns in which the turn player started with an empty fixer area — usually right after both players finish their 7th turn. If someone already has 7+ Gigs when it begins, they win at once.',
    engine: 'Tracked as a streak of "empty fixer at start of turn"; turns on at the end of the second such turn.',
    bot: 'Gig swings count double in overtime. The player going second gets the last turn before overtime starts, so a steal to 7 on that turn wins on the spot.',
  },
  {
    term: 'Deck out',
    group: 'Core',
    rule: 'CR 1.14',
    def: 'If you must draw from an empty deck you lose immediately. "Search" and "Trash" (mill) do not draw.',
    bot: 'Small penalty when its own deck drops under 4 cards.',
  },
  {
    term: 'Turn structure',
    group: 'Core',
    rule: 'CR 8',
    def: 'Start Phase (mandatory, in order): win check → start-of-turn effects → ready all your spent cards → draw 1 → roll in a Gig. Main Phase: any optional actions in any order. End of turn: end-of-turn effects, "this turn" effects end, Lag wears off.',
  },
  {
    term: 'Going first',
    group: 'Core',
    rule: 'CR 7.7.4',
    def: 'The first player spends their two left-most face-down Legends during setup, and those don’t ready on turn 1 — so the first player starts with 1 €$ of Legend money instead of 3.',
    bot: 'The sim gives the loser of a game the choice of seat in best-of-3 terms; see the Strategy page for seat advice per deck.',
  },
  {
    term: 'Mulligan',
    group: 'Core',
    rule: 'CR 7.9.2–7.9.3',
    def: 'Once, before the game: shuffle your whole 6-card opening hand back and draw 6. The first player decides first.',
    bot: 'Keeps a hand with at least one Unit costing ≤4, three cards costing ≤4, and something to sell; otherwise mulligans.',
  },
  {
    term: 'Deck construction',
    group: 'Core',
    rule: 'CR 7.3, 3.20',
    def: 'Exactly 3 Legends with different names, a 40–50 card main deck, at most 3 copies of a name+subtitle, every card within the deck’s RAM limits. Tournament sideboards are exactly 7 cards.',
    engine: 'validateDeck() in src/engine/deck.ts; the deck editor shows these checks live.',
  },
  // ---------------- Economy
  {
    term: 'Eddies (€$)',
    group: 'Economy',
    rule: 'CR 5.8, 11.11',
    def: 'Each face-down card in your Eddies area is 1 Eddie; spend (turn) it to pay 1 €$. Eddies ready at the start of your turn. They are your permanent mana.',
    bot: 'Each Eddie is worth 2.6 in the evaluation, so it treats them as a long-term resource, not something to hoard.',
  },
  {
    term: 'Sell (Sell for Turn)',
    group: 'Economy',
    rule: 'CR 8.11, 11.12',
    def: 'Once per turn in your Main Phase, put a card with a Sell Tag from your hand into your Eddies area face-down and ready. Every Program, Gear and Legend can be sold; only one Unit (MT0D12 Flathead) has a Sell Tag.',
    engine: 'Sell action, limited to once per turn per player.',
    bot: 'Sells first every turn until it has about 9 Eddies — like a land drop. It sells the card with the lowest "keep value": duplicates, cards it can’t cast soon, or Gear with no host.',
  },
  {
    term: 'Legends as money',
    group: 'Economy',
    rule: 'CR 5.7.2',
    def: 'Any ready Legend in your Legends area can be spent to pay 1 €$, face-down or face-up (face-up ones need a Sell Tag, which every current Legend has). Legends are not Eddies.',
    engine: 'Auto-payment uses Eddies first, then Legends whose Gear triggers on being spent, then face-down Legends, and keeps Legends with {Spend} abilities for last.',
    bot: 'Puts "when this Unit or Legend is spent" Gear (Netwatch Netdriver, Tetratronic Rippler, Zetatech Faceplate, Arasaka Radioport) on face-up Legends. Paying with that Legend each turn then triggers the Gear for free.',
  },
  {
    term: 'Call a Legend',
    group: 'Economy',
    rule: 'CR 8.12, 11.14',
    def: 'Once per turn, pay 1 €$ to flip a face-down Legend face-up (it keeps its orientation) and resolve its {Call} effect. You may also Call during the React Step of your Rival’s attack. You don’t know which face-down Legend is which, so a Call is a blind pick unless an effect let you look.',
    engine: 'One Call per player per turn, including calls granted by effects such as Tyger’s Whisper and Chrome Reverie.',
    bot: 'Averages the value over the unknown Legends. It slightly prefers calling during the rival’s attack, since spare Eddies are otherwise wasted on the rival’s turn.',
  },
  {
    term: 'Cost reductions',
    group: 'Economy',
    rule: 'CR 11.11.3–11.11.4',
    def: 'Reductions can’t lower a payment below 1 €$. "For free" ignores cost changes entirely. Cost value printed on the card never changes.',
  },
  // ---------------- Gigs
  {
    term: 'Gig',
    group: 'Gigs',
    rule: 'CR 6',
    def: 'One polyhedral die (d4, d6, d8, d10, d12, d20). Its value is the top face. Gigs you control are friendly Gigs; dice in your fixer area are not yours yet.',
  },
  {
    term: 'Roll in',
    group: 'Gigs',
    rule: 'CR 8.6.5',
    def: 'Last step of your Start Phase: choose a die from your fixer area, roll it, place it in your Gig area. The d20 can only be chosen when it is the last die left.',
    bot: '"High value" decks (8+ payoffs) roll big dice first. "Min Gig" decks roll small dice first, since a d4 rolls a 1 a quarter of the time.',
  },
  {
    term: 'Street Cred (☆)',
    group: 'Gigs',
    rule: 'CR 11.2',
    def: 'The sum of your Gig values. With no Gigs your Street Cred is Null, which counts as lower than 0 and is neither even nor odd.',
    bot: 'Cards that check more/less ☆ than the rival (Towerfall, Minotaur, Royce, Gunpoint Diplomacy) are resolved with exact comparisons.',
  },
  {
    term: 'Min / Max Gig',
    group: 'Gigs',
    rule: 'CR 6.3.1–6.3.3',
    def: 'A min Gig shows 1. A max Gig shows its highest face (4 on a d4, 20 on a d20).',
  },
  {
    term: 'Increase / Decrease / Adjust / Set',
    group: 'Gigs',
    rule: 'CR 6.4–6.5',
    def: 'Increase or decrease changes a value by up to the stated amount. "Adjust" means either direction. "Set" changes it to a specific value, which must exist on that die. You can’t change a die to the value it already shows.',
    bot: 'Scores every possible (die, new value) with its Gig plan and the rival’s, and picks the best — or no change.',
  },
  {
    term: 'Value-pair',
    group: 'Gigs',
    rule: 'CR 6.6',
    def: 'Two Gigs in the same Gig area with the same value. Each die counts toward only one pair.',
  },
  {
    term: 'Swap',
    group: 'Gigs',
    rule: 'CR 6.7',
    def: 'Exchange one friendly Gig with one rival Gig, keeping both values. A swap is not a steal and doesn’t trigger steal effects.',
  },
  {
    term: 'Gig plan',
    group: 'Strategy',
    def: 'Derived term, not a rule. What a deck wants its dice to look like: high values (Red: 8+ payoffs), min Gigs (Blue Braindance), value-pairs (Green Arasaka), varied values or both parities (Yellow).',
    engine: 'src/ai/knowledge.ts gigPlanOf() counts the deck’s cards that reference each pattern.',
    bot: 'Drives roll-in choice, which Gig to steal, and every adjust, set or swap decision.',
  },
  // ---------------- Combat
  {
    term: 'Attack',
    group: 'Combat',
    rule: 'CR 9.1–9.6',
    def: 'Spend a ready, non-lagging Unit to attack either a spent rival Unit or the rival Gig area (if it has Gigs). Ready Units can’t be attacked unless a card says so. {Attack} triggers resolve before the defender reacts.',
    bot: 'Simulates each possible attack on a cloned game, rival reactions included, and keeps the one that scores best. Attacking leaves the Unit spent and open to a counter-attack, and the evaluation discounts spent Units the rival can beat.',
  },
  {
    term: 'React Step',
    group: 'Combat',
    rule: 'CR 9.7–9.14',
    def: 'After an attack is declared, the defender may take any number of reactions: Call a Legend, use {Blocker}, play {Quick} Programs, or activate {Quick} abilities.',
    bot: 'Tries each reaction on a clone, then projects the attack’s result (fight loser or Gigs stolen) and keeps the reaction only if it improves the projected position.',
  },
  {
    term: 'Fight',
    group: 'Combat',
    rule: 'CR 11.4',
    def: 'Compare power. Higher power wins and the other Unit loses. On equal power both lose. Losers are defeated, but a Unit with power 0 can’t defeat anything. "Can’t be defeated" still counts as losing.',
  },
  {
    term: 'Steal',
    group: 'Combat',
    rule: 'CR 9.18–9.20, 11.5',
    def: 'An attack on the Gig area steals floor(power/10)+1 Gigs: power 1–9 steals 1, 10–19 steals 2, 20+ steals 3. Power 0 steals nothing. The attacker picks any Gigs, regardless of value.',
    bot: 'Treats 10 power as a key breakpoint (+6 unit value). It picks Gigs to steal by how much they help its plan and hurt the rival’s.',
  },
  {
    term: 'Lag',
    group: 'Combat',
    rule: 'CR 11.3',
    def: 'Units (and Legends gone solo) enter the field lagging: they can’t attack and can’t use {Spend} abilities until the end of the turn.',
  },
  {
    term: 'Spent / Ready',
    group: 'Combat',
    rule: 'CR 3.5–3.8',
    def: 'Spent = turned sideways. Your spent cards ready at the start of your turn. A spent Unit can be attacked, and a ready Unit can block.',
  },
  // ---------------- Keywords
  {
    term: 'Blocker',
    group: 'Keywords',
    rule: 'CR 11.28',
    def: 'When a rival Unit attacks, you may spend this ready Unit to redirect the attack to it. If the attack was on your Gig area, it becomes a fight instead.',
    bot: 'Blocks when the blocker wins, or trades evenly, or when chump-blocking is cheaper than losing a Gig (a stolen Gig is an 80-point swing).',
  },
  {
    term: 'Adrenaline',
    group: 'Keywords',
    rule: 'CR 11.27',
    def: 'This Unit can attack the turn it is played (it ignores Lag for attacking).',
  },
  {
    term: 'Go Solo',
    group: 'Keywords',
    rule: 'CR 11.29, 4.5',
    def: 'Pay this face-up Legend’s cost to play it to the field as a ready Unit that can attack this turn. If it leaves the field, it is removed from the game.',
    bot: 'Simulated like any other play. Adam Smasher Going Solo for 9 (defeat a rival Unit, then a 9-power body) is one of the strongest turns in the format.',
  },
  {
    term: 'Quick',
    group: 'Keywords',
    rule: 'CR 11.30',
    def: 'You may also play this Program, or use this ability, as a reaction during your rival’s attack. Costs still apply.',
  },
  {
    term: '{Play} / {Attack} / {Call} / {Defeated}',
    group: 'Keywords',
    rule: 'CR 11.22–11.25',
    def: 'Trigger labels: when you play it / when it attacks / when it is flipped by a Call / when it is defeated (using last-known information, including its Gear).',
  },
  {
    term: '{Spend} (activation cost)',
    group: 'Keywords',
    rule: 'CR 11.19',
    def: 'Spend this Unit or Legend to activate the effect. Face-up Legends in the Legends area can use their {Spend} abilities, and spending them this way means they can’t also pay 1 €$ that turn.',
  },
  // ---------------- Effects
  {
    term: 'Pending effects',
    group: 'Effects',
    rule: 'CR 10.11–10.15',
    def: 'Triggers never interrupt. They wait until the current effect finishes, then the turn player resolves all of theirs before the rival.',
    engine: 'Implemented as a queue resolved after every action; turn player first.',
  },
  {
    term: 'Replacement effects',
    group: 'Effects',
    rule: 'CR 10.24–10.30',
    def: '"If X would happen, Y instead" — e.g. Deadman Transmitter, Jackie Welles: Mama’s Favorite.',
  },
  {
    term: 'Bottom-deck / Trash / Search',
    group: 'Effects',
    rule: 'CR 11.10, 11.15, 11.17',
    def: 'Bottom-deck puts a card under its owner’s deck. Trash X = mill X cards from the top of your deck. Search X = look at the top X cards (you may fail to find).',
  },
  {
    term: 'Gear',
    group: 'Effects',
    rule: 'CR 4.9–4.12',
    def: 'Equip to a friendly Unit or face-up Legend. The host gains the Gear’s power and its bottom-text abilities. If the host leaves play, the Gear goes with it.',
  },
  // ---------------- Zones
  {
    term: 'Fixer area',
    group: 'Zones',
    rule: 'CR 5.10',
    def: 'Where your un-rolled dice wait. They are not friendly Gigs and don’t count for Street Cred. Nocturne OP55 N1 checks whether it is empty.',
  },
  {
    term: 'Trash',
    group: 'Zones',
    rule: 'CR 5.9',
    def: 'Public discard pile; many cards replay from it (Alt Cunningham, Yorinobu Steel Dragon, Lizzy Wizzy, We Gotta Live Together, The Relic).',
  },
  // ---------------- Strategy terms used on this site
  {
    term: 'Tempo',
    group: 'Strategy',
    def: 'Who is ahead on board and Gig pressure right now. The "4-cost 6-power" Unit is the format’s tempo benchmark: it survives most cheap removal and wins most early fights.',
  },
  {
    term: 'Card advantage',
    group: 'Strategy',
    def: 'Having more useful cards than the rival. Blue (Three Mouths, Hanako) and Yellow (Bootleg, Faceplate) generate it, while Red trades it away for tempo.',
  },
  {
    term: 'Swiss rounds',
    group: 'Strategy',
    def: 'Tournament format where every deck plays every round. Each round pairs decks with the same record, with no rematches. After the Swiss rounds, the best records advance to the top cut. The simulated events use about log2(decks)+3 rounds.',
  },
  {
    term: 'Best-of-3 (Bo3) & seat choice',
    group: 'Strategy',
    rule: 'Tournament Rules',
    def: 'A match is won by the first deck to win 2 games. The loser of each game chooses who goes first in the next. The simulated events assume the loser takes the play.',
  },
  {
    term: 'Top cut (top 8)',
    group: 'Strategy',
    def: 'The 8 best Swiss records play a single-elimination bracket: 1 vs 8, 4 vs 5, 2 vs 7, 3 vs 6. Ties on match points are broken by opponents’ match-win % (OMW), then game-win %.',
  },
  {
    term: 'Power rating',
    group: 'Strategy',
    def: 'One strength number per deck, fitted to every tournament game every deck has played (a Bradley–Terry model with a going-first term). It is shown as the expected win rate against the whole field, with a 90% confidence range. Two decks whose ranges overlap are not meaningfully different.',
  },
  {
    term: 'Sim tier (S / A / B / C / D)',
    group: 'Strategy',
    def: `This trainer's own tier letter for a deck, from its power rating: the band its expected win rate against the whole field falls in (${bandsLine()}). The bands are fixed, so a letter means the same thing as the field changes, and it follows the ratings whenever new events are recorded. A deck needs ${SIM_TIER_MIN_GAMES} recorded games for a letter; with fewer it is unrated (–). A letter marked ± (striped) has a 90% range reaching ${SIM_TIER_STRADDLE_BANDS} or more bands away, so it could be off by two tiers. It is shown beside choom.gg's tier, never instead of it.`,
    engine: 'src/lib/simTier.ts (the bands and thresholds), read from src/data/ratings.json (scripts/ratings.ts).',
  },
  {
    term: 'choom.gg tier',
    group: 'Strategy',
    def: "The choom.gg editors' hand rating (S / A / B / C) of the current meta archetypes, from their Night City Meta page: expert opinion, not results. Shown as the round “choom” badge, beside our square “Sim” badge.",
  },
  {
    term: 'Bot difficulty (Easy / Medium / Hard)',
    group: 'Strategy',
    def: 'Easy plays by simple rules. Medium looks one action ahead and follows its matchup plan. Hard also plays out the rest of its turn and your whole reply for its best options, plays out its blocks and reactions, and values cards by how much they swing games for its deck. In bot-vs-bot testing Easy wins about 37% against Medium; Medium and Hard are close, but Hard makes far fewer single-move blunders.',
    engine: 'src/ai/tiers.ts — one definition shared by Play, the Matchup Lab, tournaments and replays.',
  },
  {
    term: 'Win-rate colours',
    group: 'Strategy',
    def: 'Across the site, a win rate of 55% or more is green (good), 45% or less is red (bad), and anything between is a coin flip. Faded numbers rest on fewer than 20 games. Differences of ±5 points are usually noise at these sample sizes.',
  },
  {
    term: 'Counter deck (breeding)',
    group: 'Strategy',
    def: 'A bred deck built to beat the current top decks: the breeder finds the decks with the best tournament head-to-head records against the top 4 and merges them, keeping the cards that win games for each.',
    engine: 'src/ai/breeder.ts (counter method), data from scripts/breed-data.ts.',
  },
  {
    term: 'Archetype (aggro / midrange / control)',
    group: 'Strategy',
    def: 'How a deck wins. Aggro races Gigs with cheap Units. Control answers threats and wins late on card advantage. Midrange sits between and switches role depending on the opponent.',
    engine: 'src/ai/archetype.ts classify() scores the share of Units, the average cost, interaction (removal, sweepers, stun) and card flow (draw, tutors).',
    bot: 'The bot classifies its own deck and treats the rival’s archetype as scouted (known, as after game 1 of a Bo3); individual hidden cards stay hidden.',
  },
  {
    term: 'Matchup profile',
    group: 'Strategy',
    def: 'The role you take in a specific pairing — "who is the beatdown". Examples: aggro vs control should race; midrange vs aggro should play control.',
    engine: 'Weight multipliers per (my archetype > rival archetype) in src/ai/archetype.ts, refined by scripts/tune-profiles.ts.',
    bot: 'Applies the matchup profile to its evaluation. In testing, matchup-aware bots beat matchup-blind bots about 55% of the time.',
  },
  {
    term: 'Δ when drawn (IWD)',
    group: 'Strategy',
    def: 'Win rate in games where a card was drawn, minus win rate in games where it was not. It measures how much a card swings games — not how strong it looks. The Insights page and the data-driven guide sections use it to suggest keeps, sells and cuts.',
  },
  {
    term: 'Tempo check',
    group: 'Strategy',
    def: 'Win rate when ahead, even or behind on Gigs after your Nth turn. It shows whether a deck must win early (a steep curve) or can come back (a flat curve).',
  },
  {
    term: '10-power breakpoint',
    group: 'Strategy',
    def: 'At 10 power a Unit steals 2 Gigs per attack. Saburo (+1 to Arasaka attackers) turns 9-power Yorinobu/Adam Smasher into 10s; Animals Wrecker is 10 base.',
  },
];
