// Guides for the Night City Trainer original decks (data/decks/custom/nc-*.txt).
// Lists evolve via scripts/forge.ts; sim stats and data-driven insights are appended automatically.
import type { Guide } from './guides';

const nc = (n: string, file: string, name: string, summary: string, md: string): Guide => ({
  slug: `nc-${n}`,
  title: name,
  deckFile: file,
  deckName: name,
  summary,
  md,
});

export const NC_GUIDES: Guide[] = [
  nc('01', 'nc-01-rockerboy-express-rry.txt', 'NC-01 Rockerboy Express (RRY)', 'RRG curve with a Yellow splash for 1-RAM fatties.', `
## Why it should compete
The RRG shell is the sim's best deck. NC-01 keeps its Red core (6th Street, Meredith, Animals Wrecker, the removal) but swaps the Green splash for **Yellow 1-RAM bodies**: Rockn' Rockerboy (5 cost, 8 power), Heywood Ripperdoc (6/8, which also kills Gear) and MaxTac Suppression Team (5/7; rival Units can't attack the turn they're played, which shuts off Adrenaline and Go Solo). Kerry: The Last Rockerboy draws 2 whenever you control an 8+ Gig, and Industrial Assembly makes that happen reliably.

## How to pilot
- Turns 2–3: a 4-drop every turn. Turn 4+: 8-power Rockerboys beat every 4/6 in combat.
- Hold Industrial Assembly until it turns on Kerry or a cheap Carnage.
- Put Zetatech Faceplate on a face-up Legend: every time you pay with that Legend, you adjust a Gig and may draw.

## Against it
It has no answer to a single huge Unit except Carnage and Adam Smasher. Bottom-deck effects and Towerfall line up well against it.
`),
  nc('02', 'nc-02-stormrider-stampede-ggr.txt', 'NC-02 Stormrider Stampede (GGR)', 'Green go-wide with surprise attacks and Gig swaps.', `
## Why it should compete
No meta deck is built around Green's best bodies. **MaxTac AV** (5 cost, 8 power) swaps a friendly Gig for a rival one when played. **Valentino Street Racer** gives another Unit Adrenaline for a surprise same-turn attack. **Saul Bright** (8 cost, 14 power) gives every other attacker +2 power and readies 3 Units at end of turn. Saburo and Padre keep the Arasaka and Fixer value, and Adam Smasher stays as the closer.

## How to pilot
- Street Racer + any 4–5 drop = a surprise attack the rival can't plan for. Count their blockers first.
- Corporate Surveillance and Memory Relapse spend a rival blocker *before* your attack step.
- Save Peace Offering for value-pairs that power up Pepe and Hanako-style effects.

## Against it
Sweepers (Towerfall, Live with the Aftermath) punish going wide. Keep the Gig race close until they fire one.
`),
  nc('03', 'nc-03-static-shock-bbr.txt', 'NC-03 Static Shock (BBR)', 'The Blue control engine with Red 4/6 blockers.', `
## Why it should compete
BBG Econ is choom.gg's #1 deck, but its early turns are soft. NC-03 keeps the Blue engine — Three Mouths, Trust No One, Towerfall, Les Élémens, Pyramid Song — and replaces Green with **Red 1-RAM 4-drops**: Meredith Stout (Blocker, +2 vs Legends) and 6th Street Recruits. These hold the board in exactly the turns where BBG falls behind. Dexter's Call (+2 power or draw) doubles as a reactive combat trick.

## How to pilot
- Roll the d4 early and use Trust No One to set min Gigs (Three Mouths, Pyramid Song both mode, Alt discount).
- Keep 1 €$ up on the rival's turn for Floor It or a reactive Call.
- Fire Towerfall at two or more Units, ideally while you have less Street Cred so it does both.

## Against it
Fast, wide starts before turn 4, and steals of its d4 once it shows 1.
`),
  nc('04', 'nc-04-chrome-rockers-yyr.txt', 'NC-04 Chrome Rockers (YYR)', 'Yellow Gear aggro with Red 4-drops and a Royce finisher.', `
## Why it should compete
YYB Rogue Gear relies on small bodies. NC-04 puts its Gear (Gorilla Arms for a double steal, Faceplate, Adrenaline Converter, Mantis Blades) on **real bodies**: Rockn' Rockerboy (8), MaxTac Suppression (7), cheap Trauma Team Operatives, plus the Red 4/6s. River Ward plays a 2-cost Gear for free at instant speed. Royce goes solo with +2 power per Gear on your turn.

## How to pilot
- Gorilla Arms goes on the Unit that will survive the swing back.
- The Heist finds Gear and plays it free when its cost matches a Gig value; check your Gigs before casting.
- Safety Override punishes the rival's attack into your blocker.

## Against it
Detonate, Heywood, and killing the host before it attacks.
`),
  nc('05', 'nc-05-emperor-s-guard-ggb.txt', "NC-05 Emperor's Guard (GGB)", 'Green pairs control: walls, spend effects, then Saul.', `
## Why it should compete
It's a control deck with **Green's spend and stun tools** (Corporate Surveillance, Memory Relapse, The Reaper, Wild in the Streets) instead of Blue's bottom-deck suite, plus a Blocker wall: Corpo Security, Riot Shield, and Goro handing out Blocker at instant speed. Hanako draws for every value-pair at the start of your turn, and Peace Offering creates those pairs.

## How to pilot
- Make value-pairs early with Peace Offering, then draw extra cards every turn off Hanako.
- Riot Shield makes rival Go Solo cost 2 more, which taxes Adam Smasher and V.
- Close with Saul Bright or MaxTac Heavy once the rival's hand is empty.

## Against it
Go tall with one 10-power Unit; spend effects only buy a turn against it.
`),
  nc('06', 'nc-06-metal-over-meat-yyy.txt', 'NC-06 Metal Over Meat (YYY)', 'Mono-Yellow wall with board resets and big closers.', `
## Why it should compete
Six Yellow RAM unlocks **Adam Smasher: Metal Over Meat** (9 cost, 15 power: "{Play} defeat all other Units") and Alt Cunningham: Mother of Daemons. Cheap Blockers (Augmented Negotiators, Secondhand Bombus) and MaxTac Suppression slow the aggro decks that dominate the sim. Live with the Aftermath and Smasher reset the board, and Trauma Team Operatives come back cheap afterwards.

## How to pilot
- Block early and trade freely: Trauma Team gets cheaper for every Unit in your trash.
- Before Metal Over Meat, make sure your own board is the smaller one.
- Muamar's Call ("can't be defeated in a fight this turn") is best used reactively, during the rival's attack.

## Against it
Hold back and don't over-commit into a 9-mana turn. Take Gigs with as few Units as possible.
`),
  nc('07', 'nc-07-braindance-burn-rrb.txt', 'NC-07 Braindance Burn (RRB)', 'RRG Dexter core with Judy and a Blue splash.', `
## Why it should compete
It's the sim's best core (RRG Dexter) with Saburo traded for **Judy Álvarez: Braindance Maestro**. Each Braindance Program (Carnage, Bonnie and Clyde, Industrial Assembly) also gives a Unit +1 power that turn, and Judy's Spend mills for Programs. The Blue splash adds Psycho Squad (another 4/6), Jacked-In Voodoo Boy and Floor It.

## How to pilot
- Cast Braindance before combat so Judy's +1 power lands on the attacker.
- Voodoo Boy only attacks after you've cast a Program that turn.

## Against it
Like RRG, it falls to bottom-deck effects on its few big threats.
`),
  nc('08', 'nc-08-merc-contract-rrg.txt', 'NC-08 Merc Contract (RRG)', 'Three MERC Go Solo Legends powered by Pepe.', `
## Why it should compete
All three Legends are **MERC and can Go Solo**: V: Streetkid (5 cost, 6 power), Adam Smasher (9/9) and Jackie: Mama's Favorite (6/8). Pepe Najarro readies up to 2 MERC Legends when he attacks with a value-pair (Peace Offering makes it), so your Legends double as extra mana and as surprise attackers. Jackie can also take a defeat in place of your best Unit.

## How to pilot
- Pepe attacks first (with a value-pair), then use the readied Legends to pay for Go Solo or Carnage.
- Keep Jackie face-up in the Legends area as insurance until you need her body.

## Against it
Riot Shield (+2 to Go Solo) and early pressure before the Legends come online.
`),
];
