// Strategy guides: how to pilot each top deck and how to beat it.
// Sim matchup tables are appended automatically from src/data/review.json (see ui/pages/Guides.tsx).
import { FUNDAMENTALS } from './fundamentals';
import { TOURNAMENT_PLAN } from './tournamentPlan';
import { NC_GUIDES } from './ncGuides';
import { FORGE_PROCESS } from './forgeProcess';

export interface Guide {
  slug: string;
  title: string;
  badge?: string;
  deckFile?: string;
  deckName?: string; // name used in review.json
  summary?: string;
  md: string;
}

export const GUIDES: Guide[] = [
  {
    slug: 'tournament-plan',
    title: 'Tournament plan (EOR Chicago)',
    summary: 'Which deck to register, why, and how to prepare in the time left.',
    md: TOURNAMENT_PLAN,
  },
  {
    slug: 'fundamentals',
    title: 'Fundamentals',
    summary: 'How games are won in this format — read this before any deck guide.',
    md: FUNDAMENTALS,
  },
  {
    slug: 'deck-forge',
    title: 'How decks are built here (Forge)',
    summary: 'The data-driven loop for designing and improving decks.',
    md: FORGE_PROCESS,
  },
  ...NC_GUIDES,
  {
    slug: 'rrg-dexter-midrange',
    title: 'RRG Dexter Midrange',
    badge: 'A',
    deckFile: 'meta-rrg-dexter-midrange.txt',
    deckName: 'RRG Dexter Midrange',
    summary: 'Curve of oversized bodies + the best removal suite; Saburo pushes Yorinobu and Adam Smasher to the 10-power breakpoint.',
    md: `
## Game plan
Play a 4-cost 6-power Unit every turn from turn 2 on: 6th Street Recruits, Meredith Stout, Pepe Najarro. Use the double-red removal (Detonate, Bonnie and Clyde, Carnage at the Colosseum) to win the 4/6 mirror, then close with a **10-power** Yorinobu Arasaka: Steel Dragon, Animals Wrecker, or a solo Adam Smasher.

## Key cards
- **Saburo Arasaka (Legend):** friendly ARASAKA Units get +1 power while attacking. That makes Yorinobu (9) and Adam Smasher (9) hit as 10s, so they steal **two** Gigs.
- **Adam Smasher: Ender of Legends:** Go Solo for 9 defeats the rival's best Unit and puts a 9 (10 with Saburo) on board that can attack that same turn. Plan your Eddies around reaching 9 by turn 6–7.
- **Dexter DeShawn: Off the Grid:** the Call either draws or gives +2 power. Call him **during the rival's attack** to win a fight with a blocker. His {Spend} ability raises a Gig by 2, which fuels the 8+ payoffs.
- **Pepe Najarro:** with a value-pair it readies up to two MERC Legends on attack. V and Adam are both MERC, so this is extra mana. Peace Offering makes the pair.
- **Yorinobu: Steel Dragon:** replays a 4-cost Unit from hand or trash, and that Unit can attack Units the same turn. It's a two-for-one.
- **Carnage at the Colosseum:** costs 1 less for each friendly 8+ Gig. Raise Gigs with Industrial Assembly or Dexter first.

## Piloting tips
1. **Turn 1:** sell, Call a Legend. **Turn 2 (on the draw):** you have 4 mana (3 Legends + 1 Eddie), so play a 4/6.
2. Attack the Gig area with your 4/6s when the rival has no ready Unit that can kill them on the swing back. Otherwise use removal first.
3. Keep **Detonate** for Mantis Blades or Satori on a key attacker. It's Quick, so it can blow up a combat as a reaction.
4. Save Bonnie and Clyde for blockers (Meredith Stout, Augmented Negotiators, Lizzy Wizzy) that would stall your 10-power finisher.
5. Leave one 6-power Unit ready when the rival has a lot of power on board: ready Units can't be attacked.

## Playing against it
- Their threats are big but few. **Bottom-deck effects** (Les Élémens, Placide, Maman Brigitte, Pyramid Song after -4) answer the 10-power finishers cleanly.
- Keep a **Blocker with 7+ power** (Meredith Stout, or a Riot Shield on something) to stop 6-power attackers trading up.
- Don't let them reach 9 Eddies with Adam Smasher face-up and you on a single big Unit. Spread your threats out.
- Reboot Optics and Safety Override punish their attack into your blocker.
`,
  },
  {
    slug: 'rry-smasher-aggro',
    title: 'RRY Smasher Aggro',
    badge: 'S',
    deckFile: 'meta-rry-smasher-aggro.txt',
    deckName: 'RRY Smasher Aggro',
    summary: 'Fastest clock in the format: cheap Units on curve, Gear to push through, Adam Smasher to close.',
    md: `
## Game plan
Curve 6th Street Recruits, Screw: Lovelorn Fool and Rockn' Rockerboy, arm them with Mantis Blades and Zetatech Faceplate, and **race Gigs before control decks set up**. Dum Dum and V: Streetkid keep the pressure on. Detonate, Carnage and Gunpoint Diplomacy clear the blockers in the way.

## Key cards
- **6th Street Recruits:** when a friendly Unit steals a **d6**, increase a Gig by up to 6. Raising Gigs to 8+ turns on Carnage, Octant-style discounts and Kerry.
- **Dum Dum (Legend):** the Call can defeat your own spent Gear to draw 2. His Quick ability gives +1 power per equipped Gear, a surprise combat win.
- **Gunpoint Diplomacy:** +3 power, and the target may attack **ready** Units. Use it to kill the blocker that is holding the board.
- **La Llorona:** a 3-cost Blocker that raises a Gig by up to 3 when it blocks. It's your defence while you race.

## Piloting tips
1. Spend every Eddie every turn. This deck loses if it falls behind on tempo.
2. Gear goes on Units that are **ready to attack this turn**, not on lagging ones.
3. Count the rival's possible Blockers before you attack. Gunpoint Diplomacy or Carnage the main one first.
4. Turns 5–7: line up Adam Smasher's Go Solo (9 €$) so he removes the last blocker and attacks the same turn.

## Playing against it
- Cheap **Blockers** (Corpo Security, Secondhand Bombus, Augmented Negotiators, Mox Inciters) and **sweepers** (Towerfall, Live with the Aftermath, Adam Smasher: Metal Over Meat) are the whole plan.
- **Detonate their Gear** on attackers: Mantis Blades has 2 power.
- **Take Control** (−1 steal) and **Reboot Optics** are excellent Quick answers.
- Chump-block early. Every Gig they don't take buys a turn for your bigger cards.
`,
  },
  {
    slug: 'bbg-cunningham-econ',
    title: 'BBG Cunningham Econ',
    badge: 'S',
    deckFile: 'meta-bbg-cunningham-econ.txt',
    deckName: 'BBG Cunningham Econ',
    summary: 'The removal pile: Towerfall, Pyramid Song and a draw engine that never stops. Highest skill ceiling in the format.',
    md: `
## Game plan
A control deck that still curves 4-cost 6-power Units (Pepe, Psycho Squad), because Floor It and Towerfall let them win fights they shouldn't. **Three Mouths, One Desire** and **Hanako** refill your hand, while **Towerfall** and **Les Élémens** clear the board. You win late, once the rival runs out of threats.

## Key cards
- **Three Mouths, One Desire** (choom.gg S-tier, 96): look at 3 cards and take 1, plus 1 more per friendly **min Gig**. Set up min Gigs first with Trust No One, Jackie Welles: Pour One Out For Me, or rolling the d4 early.
- **Towerfall:** −5 power to all rival Units, **or** bottom-deck every rival Unit at 0 power. You get **both** if you have less Street Cred than the rival. This deck is happy to be "behind" on Cred.
- **Pyramid Song:** −4 or bottom-deck a 0-power Unit. You get both with a friendly d4 at 1, so roll the d4 first.
- **Alt Cunningham:** discount your next Program by your min Gigs, or replay a Program from the trash and bottom-deck it.
- **Hanako (Daughter of the Emperor):** draw 1 per value-pair at the start of your turn, and swap Gigs.

## Piloting tips
1. **Roll the d4 first** and decrease Gigs to 1 with Trust No One or Jackie. Min Gigs turn on Three Mouths, Pyramid Song and Alt.
2. Don't fire Towerfall at one Unit. Wait for two or more, or for a turn where you have less Street Cred so it does both modes.
3. Jacked-In Voodoo Boy only attacks after you've played a Program that turn. Sequence the Program first.
4. Keep Floor It (Quick, −1 and draw) up during the rival's turn to win combats or cut a 10-power attacker to 9 (one steal instead of two).
5. Sell aggressively. The deck runs on Eddies, and nearly every card is sellable.

## Playing against it
- **Go wide rather than tall.** Les Élémens hits the *lowest-power* Unit and Pyramid Song one Unit. Towerfall is the real danger, so don't over-commit before they have used it.
- Keep their Street Cred **at or above** yours if you can. Towerfall's double mode needs them to have less.
- Pressure early. The deck is weakest on turns 2–4, before Three Mouths has paid off.
- Steal their **d4** once it shows 1 (a min Gig) to switch off Pyramid Song's double mode and Three Mouths' bonus.
`,
  },
  {
    slug: 'yyb-rogue-gear',
    title: 'YYB Rogue Gear',
    badge: 'A',
    deckFile: 'meta-yyb-rogue-gear.txt',
    deckName: 'YYB Rogue Gear',
    summary: 'Thirteen Gear pieces turn ordinary Units into threats; Gorilla Arms and Adrenaline Converter steal extra Gigs.',
    md: `
## Game plan
Put Gear on cheap bodies. Gorilla Arms steals an extra Gig. Adrenaline Converter gives Adrenaline when you are 2+ Gigs behind, which makes it a comeback engine. Dying Night is a 2-power weapon that also shrinks a rival Gig. Reboot Optics and Safety Override keep your equipped Units alive.

## Key cards
- **Gorilla Arms:** the first time this Unit steals each turn, it also steals a rival Gig whose value you don't already have, so one attack is two Gigs.
- **Trauma Team Operatives:** costs 1 less per Unit in your trash. It's often a 1–2 €$ 7-power Unit late in the game.
- **River Ward (Legend):** Quick, Spend — play a 2-cost-or-less Gear from hand for free, even during the rival's attack.
- **The Heist:** trash 4 and take a Gear; if its cost equals a friendly Gig's value, play it for free.

## Playing against it
- **Detonate** (Gear with 2 or less power) and **Heywood Ripperdoc** answer most of their Gear. Gorilla Arms has 3 power, so kill its host instead.
- Kill the equipped Unit **before** it attacks. Spend effects (Corporate Surveillance, Memory Relapse) also stop it.
- Don't fall exactly 2 Gigs ahead while they hold Adrenaline Converter.
`,
  },
  {
    slug: 'rrb-wakako-midrange',
    title: 'RRB Wakako Midrange',
    badge: 'A',
    deckFile: 'meta-rrb-wakako-midrange.txt',
    deckName: 'RRB Wakako Midrange',
    summary: 'Red beatdown shell traded down a stat line for Blue stun; Lizzy Wizzy replaying cheap Programs is the tempo engine.',
    md: `
## Game plan
The red curve, plus Blue stun: Chrome Reverie, Nocturne and Floor It. Jacked-In Voodoo Boy gives the deck a real 2-drop. **Lizzy Wizzy** replays a 3-cost-or-less Program (Bonnie and Clyde, Chrome Reverie, Detonate) from your trash and stays behind as a Blocker.

## Piloting tips
- Without Saburo, Yorinobu tops out at 9, so this deck wins on **tempo** and doesn't rely on two-Gig steals.
- Wakako's Call can give a rival Unit −2 or draw. Her Spend lowers a Gig by up to 2, which can break the rival's 8+ or value-pair payoffs.
- Fire stun effects on the rival's biggest ready attacker **right before** your own turn ends, so it can't attack back.

## Playing against it
- It has fewer big threats than RRG. Trade your 6-power Units for theirs and win the long game with card advantage.
- Lizzy Wizzy needs good Programs in the trash, so tempo plays matter more than the trash itself.
`,
  },
  {
    slug: 'gry-trauma-team',
    title: 'GRY Trauma Team',
    badge: 'B',
    deckFile: 'meta-gry-trauma-team.txt',
    deckName: 'GRY Trauma Team',
    summary: 'Three-colour midrange: Trauma Team Operatives, Pepe, Meredith, Johnny, with Memory Relapse and The Heist for flow.',
    md: `
## Game plan
Fill the trash with All is Lost and The Heist, then play heavily discounted Trauma Team Operatives (7 power). Johnny Silverhand wins every fight against CORPO Units and readies after his first win each turn.

## Playing against it
- Bottom-deck effects beat it, because they don't put Units in the trash and so don't discount Trauma Team.
- It's stretched across three colours with only 2 RAM per colour, so its curve is clunky. Punish slow starts.
`,
  },
  {
    slug: 'rainbow-fixer-stuff',
    title: 'Rainbow Fixer Stuff',
    badge: 'B',
    deckFile: 'meta-rainbow-fixer-stuff.txt',
    deckName: 'Rainbow Fixer Stuff',
    summary: 'Budget three-colour commons deck: Field Operator, Valentino Street Racer, Pepe, Psycho Squad and stun Programs.',
    md: `
## Game plan
Stay ahead on Gig tempo with the best common at each slot. Valentino Street Racer gives another Unit Adrenaline for surprise same-turn attacks, and Nocturne / Chrome Reverie stop a key attacker. Adam Smasher is the only top end.

## Playing against it
- It has no card-advantage engine. Trade one-for-one and it runs out of steam by turn 7.
- Watch for Street Racer: count it as an extra attacker when you work out how many Gigs you could lose.
`,
  },
  {
    slug: 'smash-the-curve',
    title: 'Smash the Curve (RRG, Cacheira)',
    deckFile: 'RRG-smash-the-curve.txt',
    deckName: 'Smash the Curve',
    summary: "Community RRG list with V: Streetkid over Dexter, Synapse Burnout, and a 7-card sideboard.",
    md: `
## What's different from RRG Dexter
**V: Streetkid** replaces Dexter. V's Call trashes 3 and returns a Braindance. Synapse Burnout gives +1 power per face-up Legend while fighting, so a single open Eddie bluffs a combat trick. The list runs 3 Peace Offering to make value-pairs for Pepe.

## Sideboard (from the author)
- **In vs control (BBG):** +2 Shattered Memories (refill), +1 Over the Edge.
- **In vs aggro:** +2 Deadman Transmitter on your key 10-power Unit, +2 Memory Relapse.

## Mulligan
Look for two 4-cost Units plus sellable cards (author's advice).
`,
  },
  {
    slug: 'red-chrome-aggro',
    title: 'The Red Chrome (RRR)',
    deckFile: 'RRR-the-red-chrome-aggro.txt',
    deckName: 'The Red Chrome - Aggro',
    summary: 'Mono-red aggro with Chrome Fang, Valentino Guerrera, Johnny, Minotaur and Royce Go Solo.',
    md: `
## Game plan
Pure red pressure with the full removal suite, including Over the Edge (defeat a Unit with power ≤ your d20). Royce: Psycho on the Edge goes solo and gets +2 power per equipped Gear on your turn.

## Notes
Chrome Fang's {Play} stops rival Units from stealing friendly Gigs worth more than their power until your next turn. It's a strong defensive play while racing.
`,
  },
  {
    slug: 'yyy-adam',
    title: 'YYY Adam (Trinx)',
    deckFile: 'YYY-yyy-adam-ready-for-brawl.txt',
    deckName: 'YYY Adam v1 - Ready for Brawl',
    summary: 'Proactive mono-yellow with The Heist, The Relic, Live with the Aftermath and Adam Smasher: Metal Over Meat.',
    md: `
## Game plan (free portion of the author's guide)
Go second, deploy proactive Units from turn one, and contest Gigs immediately. The Heist digs for Gear and plays it free when its cost matches a Gig value. **Live with the Aftermath** and **Adam Smasher: Metal Over Meat** are traps for opponents who over-commit to stop your early pressure.

The author reports a 9–2 record in Division II. The full piloting guide is paid content on choom.gg.
`,
  },
];
