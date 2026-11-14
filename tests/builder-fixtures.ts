// Fixed, synthetic inputs for the deck builders (breeder, forge, optimizer, Deck Lab tuner), built only from the card
// data: no library deck, recorded result or impact file is read, so the pinned outputs in
// tests/deck-packages-defaults.test.ts change only when the builders' code (or src/data/cards.json) changes.
import { CARDS } from '../src/engine/cards';
import { counts, fingerprintText, listFingerprint, validateDeck } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import type { DeckReport } from '../src/analysis/analyze';
import { fill, type BreedInput } from '../src/ai/breeder';
import type { Archetype } from '../src/ai/archetype';

/** A stable number in [0, 1) from a string. */
export const unit = (s: string) => parseInt(fingerprintText(s).slice(0, 8), 16) / 0x100000000;

/** Format-wide impact in [-0.1, 0.1] for four cards in five (the fifth has none, so fallbacks are exercised). */
export const SYNTH_IMPACT: Record<string, number> = Object.fromEntries(
  CARDS.filter((c) => c.type !== 'Legend' && unit(`skip:${c.id}`) >= 0.2).map((c) => [c.id, Math.round((unit(`imp:${c.id}`) * 0.2 - 0.1) * 10_000) / 10_000]),
);

const LEGENDS = CARDS.filter((c) => c.type === 'Legend').sort((a, b) => (a.id < b.id ? -1 : 1));
const STYLES: Archetype[] = ['aggro', 'midrange', 'control'];

/** Eight legal lists over spread-out Legend trios (one, two and three colours), filled by the breeder's template. */
export function synthDecks(): DeckList[] {
  const out: DeckList[] = [];
  const triples: string[][] = [];
  for (let i = 0; i < LEGENDS.length; i++)
    for (let j = i + 1; j < LEGENDS.length; j++)
      for (let k = j + 1; k < LEGENDS.length; k++) {
        const t = [LEGENDS[i]!, LEGENDS[j]!, LEGENDS[k]!];
        if (new Set(t.map((c) => c.name)).size === 3) triples.push(t.map((c) => c.id));
      }
  for (let n = 0; out.length < 8 && n < triples.length; n += 97) {
    const legends = triples[n]!;
    const d = fill(legends, new Map(), SYNTH_IMPACT, STYLES[out.length % 3]!, `Synth ${out.length + 1}`);
    if (!validateDeck(d).length) out.push(d);
  }
  return out;
}

/** A telemetry report for a list: per-card "Δ when drawn" for most of its cards. */
export function synthReport(deck: DeckList): DeckReport {
  const cards = [...counts(deck.main).keys()]
    .filter((id) => unit(`seen:${deck.name}:${id}`) >= 0.15)
    .map((id) => ({ id, iwd: Math.round((unit(`iwd:${deck.name}:${id}`) * 0.3 - 0.15) * 10_000) / 10_000, seenGames: 30 }));
  return { deck: deck.name, cards, insights: [] } as unknown as DeckReport;
}

/** Breeder input over the synthetic lists; `h2h` adds head-to-heads so counters are bred too. */
export function synthBreedInput(h2h: boolean): BreedInput {
  const decks = synthDecks();
  const ranked = decks.map((deck, i) => ({ deck, wr: 0.62 - i * 0.02 }));
  const deckImpact: Record<string, Record<string, number>> = {};
  for (const d of decks.slice(0, 3)) deckImpact[listFingerprint(d)] = Object.fromEntries(synthReport(d).cards.map((c) => [c.id, c.iwd]));
  return {
    ranked,
    impact: SYNTH_IMPACT,
    seenTriples: new Set(decks.map((d) => [...d.legends].sort().join('|'))),
    seed: 1077,
    deckImpact,
    h2h: h2h
      ? (a, b) => {
          const g = Math.floor(unit(`g:${a}|${b}`) * 10);
          return { w: Math.floor(unit(`w:${a}|${b}`) * (g + 1)), g };
        }
      : undefined,
  };
}

/** A short, order-preserving record of lists for pinning: name, Legends and main deck (as the deck ids, in order). */
export const listKey = (d: Pick<DeckList, 'name' | 'legends' | 'main'>) => `${d.name}|${d.legends.join(',')}|${d.main.join(',')}`;
export const pin = (x: unknown) => fingerprintText(JSON.stringify(x));
