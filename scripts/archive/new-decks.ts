// The 8 original "NC" decks (Night City Trainer designs). Writes data/decks/custom/nc-*.txt and validates.
import fs from 'node:fs';
import { parseDeck, exportOfficial, validateDeck } from '../../src/engine/deck';

const DECKS: Record<string, { idea: string; list: string }> = {
  'NC-01 Rockerboy Express (RRY)': {
    idea: 'RRG-style 4-drop curve but the Yellow splash buys 1-RAM fatties (Rockn Rockerboy 8, Heywood 8, MaxTac Suppression 7) plus Faceplate card flow; Industrial Assembly fuels Kerry and Carnage.',
    list: `Legends: Adam Smasher: Ender of Legends, Dexter DeShawn: Off the Grid, River Ward: Detective on the Hunt
3 6th Street Recruits
3 Meredith Stout: Stone Cold Corpo
3 Kerry Eurodyne: The Last Rockerboy
3 Rockn' Rockerboy
3 Animals Wrecker
2 MaxTac Suppression Team
2 Heywood Ripperdoc
3 Carnage at the Colosseum
3 Bonnie and Clyde
3 Detonate
3 Industrial Assembly
1 Gunpoint Diplomacy
3 Mantis Blades
3 Zetatech Faceplate
2 Satori: Sword of Saburo`,
  },
  'NC-02 Stormrider Stampede (GGR)': {
    idea: 'Green go-wide: Street Racer surprise attacks, MaxTac AV Gig swaps, Saul Bright (+2 to every attacker), Saburo/Padre Legends; Red splash only for the best 4-drops and Detonate.',
    list: `Legends: Saburo Arasaka: Stubborn Patriarch, Padre: Man of the Cross, Adam Smasher: Ender of Legends
3 Pepe Najarro: Working Doubles
3 MaxTac AV
2 Saul Bright: Stormrider
3 Valentino Street Racer
3 6th Street Recruits
3 Meredith Stout: Stone Cold Corpo
2 Sandayu Oda: Hanako's Guardian
2 MaxTac Heavy
3 Peace Offering
3 Corporate Surveillance
2 Memory Relapse
3 Detonate
3 Synapse Burnout
3 Mantis Blades
2 Satori: Sword of Saburo`,
  },
  'NC-03 Static Shock (BBR)': {
    idea: 'Blue removal/draw shell (Three Mouths, Towerfall, Les Élémens) with Red 4/6 blockers instead of Green: Meredith and 6th Street give it the board presence BBG lacks early.',
    list: `Legends: Wakako Okada: Peace and Harmony, Alt Cunningham: Soulkiller Architect, Dexter DeShawn: Off the Grid
3 Psycho Squad
3 Jacked-In Voodoo Boy
2 Rita Wheeler: No Stupid Questions
2 Lizzy Wizzy: Delicate Weapon
2 Westbrook Netrunner
3 6th Street Recruits
3 Meredith Stout: Stone Cold Corpo
1 Placide: Voodoo Sentinel
3 Floor It
3 Trust No One
3 Three Mouths, One Desire
2 Pyramid Song
2 Les Élémens
2 Towerfall
2 Detonate
2 Chrome Reverie
2 Satori: Sword of Saburo`,
  },
  'NC-04 Chrome Rockers (YYR)': {
    idea: 'Yellow Gear aggro: Gorilla Arms double-steals on 7-8 power bodies, River Ward cheats 2-cost Gear at instant speed, Royce Go Solo as a Gear-powered finisher.',
    list: `Legends: River Ward: Detective on the Hunt, Viktor Vektor: Sit Down and Relax, Royce: Psycho on the Edge
3 Rockn' Rockerboy
3 MaxTac Suppression Team
3 Trauma Team Operatives
3 Dexter DeShawn: One Last Chance
2 Jackie Welles: Ride or Die Choom
3 6th Street Recruits
3 Meredith Stout: Stone Cold Corpo
3 Gorilla Arms
3 Zetatech Faceplate
3 Mantis Blades
2 Adrenaline Converter
3 The Heist
3 Detonate
2 Safety Override
1 Live with the Aftermath`,
  },
  "NC-05 Emperor's Guard (GGB)": {
    idea: 'Green pairs control: Hanako draws per value-pair, Goro hands out Blocker, Corpo Security/Riot Shield wall, then The Reaper / Wild in the Streets clear the way for Saul Bright.',
    list: `Legends: Hanako Arasaka: Daughter of the Emperor, Goro Takemura: Vengeful Bodyguard, Jackie Welles: Pour One Out For Me
3 Pepe Najarro: Working Doubles
3 Psycho Squad
3 Corpo Security
2 Sandayu Oda: Hanako's Guardian
3 MaxTac AV
2 MaxTac Heavy
2 Saul Bright: Stormrider
2 Field Operator
3 Peace Offering
3 Corporate Surveillance
2 Memory Relapse
2 Wild in the Streets
2 (Don't Fear) The Reaper
3 Floor It
2 Trust No One
3 Riot Shield`,
  },
  'NC-06 Metal Over Meat (YYY)': {
    idea: 'Mono-Yellow wall: cheap Blockers and MaxTac Suppression (no same-turn attackers) stall, Live with the Aftermath + Adam Smasher: Metal Over Meat reset the board, Trauma Team and Rockerboys close.',
    list: `Legends: Muamar Reyes: El Capitán, River Ward: Detective on the Hunt, Dum Dum: Maelstrom Triggerman
3 Augmented Negotiators
3 Secondhand Bombus
3 MaxTac Suppression Team
3 Rockn' Rockerboy
3 Trauma Team Operatives
2 Caliber: Totentanz's Top Dog
2 Heywood Ripperdoc
2 Alt Cunningham: Mother of Daemons
2 Adam Smasher: Metal Over Meat
2 Jackie Welles: Ride or Die Choom
3 Live with the Aftermath
2 Bootleg Black Sapphire Show
3 Afterparty at Lizzie's
3 Safety Override
2 Zetatech Faceplate
2 Gorilla Arms`,
  },
  'NC-07 Braindance Burn (RRB)': {
    idea: 'The RRG Dexter core with Judy instead of Saburo: Braindance Programs (Carnage, Bonnie, Industrial Assembly) pump attackers via Judy, Blue splash adds Psycho Squad + Voodoo Boy + Floor It.',
    list: `Legends: Dexter DeShawn: Off the Grid, Adam Smasher: Ender of Legends, Judy Álvarez: Braindance Maestro
3 6th Street Recruits
3 Meredith Stout: Stone Cold Corpo
3 Animals Wrecker
3 Psycho Squad
2 Jacked-In Voodoo Boy
2 Yorinobu Arasaka: Steel Dragon
2 Johnny Silverhand: Never Stop Fighting
3 Carnage at the Colosseum
3 Bonnie and Clyde
3 Industrial Assembly
2 Gunpoint Diplomacy
3 Detonate
2 Floor It
3 Mantis Blades
3 Satori: Sword of Saburo`,
  },
  'NC-08 Merc Contract (RRG)': {
    idea: 'Three MERC Go Solo Legends (V, Adam Smasher, Jackie) + Pepe readying MERC Legends = extra mana and surprise 6-9 power attackers; Jackie also protects your best Unit from removal.',
    list: `Legends: V: Streetkid, Adam Smasher: Ender of Legends, Jackie Welles: Mama's Favorite
3 Pepe Najarro: Working Doubles
3 6th Street Recruits
3 Meredith Stout: Stone Cold Corpo
3 Animals Wrecker
3 Kerry Eurodyne: The Last Rockerboy
2 Yorinobu Arasaka: Steel Dragon
2 Valentino Street Racer
3 Peace Offering
3 Carnage at the Colosseum
3 Bonnie and Clyde
2 Gunpoint Diplomacy
3 Detonate
2 Synapse Burnout
3 Mantis Blades
2 Satori: Sword of Saburo`,
  },
};

let bad = 0;
for (const [name, { idea, list }] of Object.entries(DECKS)) {
  const { deck, errors } = parseDeck(list, name);
  deck.name = name;
  const v = validateDeck(deck);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
  fs.writeFileSync(`data/decks/custom/${slug}.txt`, `${exportOfficial(deck)}\n\n// Idea: ${idea}\n// Author: Night City Trainer (v1, ${new Date().toISOString().slice(0, 10)})\n`);
  console.log(`${name}: ${deck.legends.length} legends, ${deck.main.length} cards${errors.length ? ' UNPARSED: ' + errors.join(' / ') : ''}${v.length ? ' INVALID: ' + v.join(' ') : ' ✓'}`);
  if (errors.length || v.length) bad++;
}
process.exit(bad ? 1 : 0);
