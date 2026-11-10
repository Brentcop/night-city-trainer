import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { exportChoom, exportOfficial, exportSimJson, parseDeck, validateDeck } from '../src/engine/deck';

const OFFICIAL = `# Beatdown

// Legends (3)
1 Saburo Arasaka: Stubborn Patriarch
1 Adam Smasher: Ender of Legends
1 V: Streetkid

// Units (16)
3 6th Street Recruits
3 Meredith Stout: Stone Cold Corpo
3 Pepe Najarro: Working Doubles
1 V: Roamer of the Badlands
3 Animals Wrecker
3 Yorinobu Arasaka: Steel Dragon

// Programs (18)
2 Detonate
1 Industrial Assembly
3 Synapse Burnout
3 Peace Offering
3 Bonnie and Clyde
2 Gunpoint Diplomacy
1 Shattered Memories
3 Carnage at the Colosseum

// Gears (6)
3 Mantis Blades
3 Satori: Sword of Saburo`;

const CHOOM = `// Beatdown
// Format: Constructed

// Legends
1 Saburo Arasaka — Stubborn Patriarch (EPS)
1 Adam Smasher — Ender of Legends (WNC)
1 V — Streetkid (WNC)

// Main Deck
3 6th Street Recruits (WNC)
3 Meredith Stout — Stone Cold Corpo (WNC)
3 Pepe Najarro — Working Doubles (WNC)
1 V — Roamer of the Badlands (WNC)
3 Animals Wrecker (WNC)
3 Yorinobu Arasaka — Steel Dragon (WNC)
2 Detonate (WNC)
1 Industrial Assembly (WNC)
3 Synapse Burnout (WNC)
3 Peace Offering (WNC)
3 Bonnie and Clyde (WNC)
2 Gunpoint Diplomacy (WNC)
1 Shattered Memories (WNC)
3 Carnage at the Colosseum (WNC)
3 Mantis Blades (WNC)
3 Satori — Sword of Saburo (WNC)

// Sideboard
1 Over the Edge (WNC)
2 Shattered Memories (WNC)
2 Deadman Transmitter (WNC)
2 Memory Relapse (WNC)`;

describe('deck import/export', () => {
  it('parses the official / Sim / ChoomBattler format', () => {
    const { deck, errors } = parseDeck(OFFICIAL);
    expect(errors).toEqual([]);
    expect(deck.name).toBe('Beatdown');
    expect(deck.legends).toHaveLength(3);
    expect(deck.main).toHaveLength(40);
    expect(validateDeck(deck)).toEqual([]);
  });

  it('parses the choom.gg format with set codes and sideboard', () => {
    const { deck, errors } = parseDeck(CHOOM);
    expect(errors).toEqual([]);
    expect(deck.main).toHaveLength(40);
    expect(deck.sideboard).toHaveLength(7);
    expect(validateDeck(deck)).toEqual([]);
  });

  it('round-trips through every export format', () => {
    const { deck } = parseDeck(CHOOM);
    for (const text of [exportOfficial(deck), exportChoom(deck), JSON.stringify(exportSimJson(deck))]) {
      const back = parseDeck(text).deck;
      expect([...back.main].sort()).toEqual([...deck.main].sort());
      expect([...back.legends].sort()).toEqual([...deck.legends].sort());
    }
  });

  it('parses loose lists ("3x Name", "Name x2", bullets)', () => {
    const { deck, errors } = parseDeck('Legends (3): Dexter DeShawn — Off the Grid, Saburo Arasaka, Adam Smasher — Ender of Legends\n- 3× Psycho Squad\n2x Towerfall\nMantis Blades x3');
    expect(errors).toEqual([]);
    expect(deck.legends).toHaveLength(3);
    expect(deck.main).toHaveLength(8);
  });

  it('flags illegal decks', () => {
    const { deck } = parseDeck(OFFICIAL.replace('1 V: Streetkid', '1 V: Corporate Exile\n1 V: Streetkid'));
    expect(validateDeck(deck).join(' ')).toMatch(/3 Legends|different names/);
  });

  it('every bundled meta deck is tournament legal', () => {
    for (const f of fs.readdirSync('data/decks').filter((x) => x.startsWith('meta-'))) {
      const { deck, errors } = parseDeck(fs.readFileSync(`data/decks/${f}`, 'utf8'));
      expect(errors, f).toEqual([]);
      expect(validateDeck(deck), f).toEqual([]);
    }
  });
});
