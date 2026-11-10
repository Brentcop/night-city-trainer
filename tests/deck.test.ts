import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CARD_BY_ID, CARDS } from '../src/engine/cards';
import { MAX_DECK_NAME, exportChoom, exportOfficial, exportSimJson, parseDeck, validateDeck } from '../src/engine/deck';

function libraryFiles(dir = 'data/decks'): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? libraryFiles(path.join(dir, e.name)) : e.name.endsWith('.txt') ? [path.join(dir, e.name)] : []));
}

const MANTIS = CARDS.find((c) => c.name === 'Mantis Blades')!.id;
const UNIT = CARDS.find((c) => c.type === 'Unit')!;
const LEGEND = CARDS.find((c) => c.type === 'Legend')!;
const copies = (ids: string[], id: string) => ids.filter((x) => x === id).length;

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

  it('round-trips every library deck through every export format (name, legends, main, sideboard)', () => {
    const files = libraryFiles();
    expect(files.length).toBeGreaterThan(50);
    const sorted = (a: string[]) => [...a].sort();
    let withSideboard = 0;
    for (const f of files) {
      const { deck } = parseDeck(fs.readFileSync(f, 'utf8'), path.basename(f, '.txt'));
      if (deck.sideboard.length) withSideboard++;
      const formats = { official: exportOfficial(deck), choom: exportChoom(deck), json: JSON.stringify(exportSimJson(deck)) };
      for (const [fmt, text] of Object.entries(formats)) {
        const { deck: back, errors } = parseDeck(text, 'fallback');
        const at = `${f} via ${fmt}`;
        expect(errors, at).toEqual([]);
        // Sim JSON caps imported names at MAX_DECK_NAME (no library deck is that long).
        expect(back.name, at).toBe(fmt === 'json' ? deck.name.slice(0, MAX_DECK_NAME) : deck.name);
        expect(back.legends, at).toEqual(deck.legends);
        expect(sorted(back.main), at).toEqual(sorted(deck.main));
        expect(sorted(back.sideboard), at).toEqual(sorted(deck.sideboard));
      }
    }
    expect(withSideboard).toBeGreaterThan(0);
  });

  it('official export includes the sideboard', () => {
    const { deck } = parseDeck(CHOOM);
    const text = exportOfficial(deck);
    expect(text).toMatch(/^\/\/ Sideboard \(7\)$/m);
    expect(parseDeck(text).deck.sideboard.sort()).toEqual([...deck.sideboard].sort());
    expect(exportOfficial({ ...deck, sideboard: [] })).not.toMatch(/Sideboard/);
  });

  it('parses loose lists ("3x Name", "Name x2", bullets)', () => {
    const { deck, errors } = parseDeck('Legends (3): Dexter DeShawn — Off the Grid, Saburo Arasaka, Adam Smasher — Ender of Legends\n- 3× Psycho Squad\n2x Towerfall\nMantis Blades x3');
    expect(errors).toEqual([]);
    expect(deck.legends).toHaveLength(3);
    expect(deck.main).toHaveLength(8);
  });

  it('reads every quantity form, and never takes a quantity for a set code', () => {
    const forms: [string, number][] = [
      ['3x Mantis Blades', 3],
      ['3X Mantis Blades', 3],
      ['3 x Mantis Blades', 3],
      ['3\tMantis Blades', 3],
      ['3 Mantis Blades (WNC)', 3],
      ['- 3× Mantis Blades', 3],
      ['Mantis Blades x3', 3],
      ['Mantis Blades ×2', 2],
      ['Mantis Blades (x3)', 3],
      ['Mantis Blades (×3)', 3],
      ['Mantis Blades (X2)', 2],
      ['Mantis Blades (3)', 3],
      ['x3 Mantis Blades', 3],
      ['×2 Mantis Blades', 2],
      ['3 copies of Mantis Blades in deck', 3],
      ['Mantis Blades', 1],
      ['Mantis Blades (WNC)', 1],
    ];
    for (const [line, n] of forms) {
      const { deck, errors } = parseDeck(line);
      expect(errors, line).toEqual([]);
      expect(copies(deck.main, MANTIS), line).toBe(n);
    }
  });

  it('keeps BOM and CRLF input working', () => {
    const { deck, errors } = parseDeck('﻿// X\r\n// Legends\r\n1 Adam Smasher: Ender of Legends\r\n3 Mantis Blades\r\n');
    expect(errors).toEqual([]);
    expect(deck.name).toBe('X');
    expect(deck.legends).toHaveLength(1);
    expect(copies(deck.main, MANTIS)).toBe(3);
  });

  it('rejects absurd text quantities instead of hanging', () => {
    const { deck, errors } = parseDeck('1000000000 Mantis Blades');
    expect(deck.main).toEqual([]);
    expect(errors).toHaveLength(1);
  });

  it('reports a Legend listed in the sideboard instead of adding it to the legends', () => {
    const { deck, errors } = parseDeck('// D\n// Legends\n1 Adam Smasher: Ender of Legends\n// Sideboard\n1 V: Streetkid\n2 Mantis Blades');
    expect(deck.legends).toHaveLength(1);
    expect(deck.sideboard).toEqual([MANTIS, MANTIS]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/V: Streetkid.*sideboard/);
  });

  it('skips provenance comments when naming the deck, but keeps "Ladder: …" names', () => {
    expect(parseDeck('// Origin: choom.gg\n// Author: someone\n// Real name\n3 Mantis Blades').deck.name).toBe('Real name');
    expect(parseDeck('// Source: https://example.com\n# Hash name\n3 Mantis Blades').deck.name).toBe('Hash name');
    expect(parseDeck('// Ladder: V / Smasher / Padre (RRG)\n// Origin: x\n3 Mantis Blades').deck.name).toBe('Ladder: V / Smasher / Padre (RRG)');
  });

  it('sanitises Sim JSON (name, quantities, legend ids)', () => {
    const parse = (o: object) => parseDeck(JSON.stringify(o), 'Fallback');
    expect(parse({ name: 42, legendIds: [] }).deck.name).toBe('Fallback');
    expect(parse({ name: { a: 1 } }).deck.name).toBe('Fallback');
    expect(parse({ name: '   ' }).deck.name).toBe('Fallback');
    expect(parse({ name: 'n'.repeat(500) }).deck.name).toHaveLength(MAX_DECK_NAME);

    const q = parse({ name: 'q', cardQuantities: { [MANTIS]: 1e9 } });
    expect(q.deck.main).toHaveLength(3);
    expect(parse({ name: 'q', cardQuantities: { [MANTIS]: -5 } }).deck.main).toHaveLength(0);
    expect(parse({ name: 'q', cardQuantities: { [MANTIS]: 2.9 } }).deck.main).toHaveLength(2);
    expect(parse({ name: 'q', cardQuantities: { [MANTIS]: '2' } }).deck.main).toHaveLength(2);
    expect(parse({ name: 'q', cardQuantities: { [MANTIS]: 'lots' } }).deck.main).toHaveLength(0);
    expect(parse({ name: 'q', sideboardQuantities: { [MANTIS]: 99 } }).deck.sideboard).toHaveLength(3);
    expect(parse({ name: 'q', cardQuantities: 'not an object' }).deck.main).toHaveLength(0);

    const l = parse({ name: 'l', legendIds: [LEGEND.id, UNIT.id, 7, 'nope'] });
    expect(l.deck.legends).toEqual([LEGEND.id]);
    expect(l.errors).toHaveLength(3);
    expect(parse({ name: 'l', legendIds: 'not an array' }).deck.legends).toEqual([]);
  });

  it('validateDeck reports unknown ids and non-Legend legends instead of throwing', () => {
    const { deck } = parseDeck(OFFICIAL);
    expect(validateDeck({ ...deck, main: [...deck.main.slice(1), 'NOPE-1'] })).toContain('Unknown card id: NOPE-1.');
    expect(validateDeck({ ...deck, sideboard: ['NOPE-2'] }).join(' ')).toMatch(/Unknown card id: NOPE-2/);
    expect(validateDeck({ ...deck, legends: [...deck.legends.slice(0, 2), 'NOPE-3'] }).join(' ')).toMatch(/Unknown card id: NOPE-3/);
    const asLegend = validateDeck({ ...deck, legends: [...deck.legends.slice(0, 2), UNIT.id] });
    expect(asLegend).toContain(`${UNIT.subname ? `${UNIT.name}: ${UNIT.subname}` : UNIT.name} is not a Legend.`);
    expect(CARD_BY_ID[deck.legends[0]].type).toBe('Legend');
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
