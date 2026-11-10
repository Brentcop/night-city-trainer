// The recommended tournament build: stock RRG Dexter Midrange + a 7-card sideboard chosen from data.
import fs from 'node:fs';
import { exportChoom, parseDeck, validateDeck } from '../src/engine/deck';
const { deck } = parseDeck(fs.readFileSync('data/decks/meta-rrg-dexter-midrange.txt', 'utf8'));
deck.name = 'RRG Dexter Midrange — EOR build';
deck.sideboard = [
  ...Array(3).fill('royce_don_t_call_me_simon'), // +6.3 pts vs BBG Econ in paired tests (in for Bonnie and Clyde)
  ...Array(2).fill('deadman_transmitter'), // protect a 10-power threat vs removal-heavy decks
  ...Array(2).fill('memory_relapse'), // stop a key attacker for a turn vs aggro
];
const v = validateDeck(deck);
fs.writeFileSync(
  'data/decks/custom/rrg-eor-build.txt',
  exportChoom(deck) +
    '\n\n// Idea: Recommended EOR Chicago list: the stock choom.gg RRG Dexter Midrange (finals: 65% vs the meta field over 360 deep-bot games) with a data-chosen sideboard. vs BBG: -3 Bonnie and Clyde, +3 Royce: Don\'t Call Me Simon. vs aggro: +2 Memory Relapse, +2 Deadman Transmitter for -2 Peace Offering, -2 Detonate.\n',
);
console.log(v.length ? v : 'legal', deck.main.length, deck.sideboard.length);
