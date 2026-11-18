// Two Yellow cards no test referenced (ROADMAP2 §11 item 16), checked against their text in src/data/cards.json:
// Hanako Arasaka: In a Gilded Cage ("{Play} Search the top 4 cards of your deck. Reveal any number of cards with cost
// equal to any friendly Gig values and add them to your hand. Bottom-deck the rest.") and Rockn' Rockerboy (cost 5,
// power 8, flavour text only: a vanilla Unit). Scenes from tests/faq/faq-helpers.ts.
import { describe, expect, it } from 'vitest';
import { CARDS, CARD_BY_ID } from '../src/engine/cards';
import { SCRIPTS } from '../src/engine/scripts/index';
import type { Decision } from '../src/engine/types';
import { deckOf, gig, onKind, playCard, scene } from './faq/faq-helpers';

/** A card with no text of its own (so it does nothing from the deck or the hand) costing `cost`. */
const plain = (cost: number) => CARDS.find((c) => c.type === 'Unit' && c.cost === cost && !SCRIPTS[c.id])!.id;
const noneIndex = (d: Decision) => d.options.findIndex((o) => o.key === 'none');

describe('Hanako Arasaka: In a Gilded Cage', () => {
  it('reveals every card among the top 4 whose cost equals a friendly Gig value, and bottom-decks the rest', async () => {
    const { g, asked } = scene();
    gig(g, 0, 6, 3);
    gig(g, 0, 8, 5);
    // the rival's Gig value does not count
    gig(g, 1, 6, 4);
    const three = plain(3);
    const five = plain(5);
    const four = plain(4);
    const [a, b, c, d, fifth] = deckOf(g, 0, [three, five, four, three, three]);
    const hanako = await playCard(g, 0, 'hanako_arasaka_in_a_gilded_cage');
    expect(hanako.zone).toBe('field');
    expect([a, b, d].map((x) => x!.zone)).toEqual(['hand', 'hand', 'hand']);
    // the cost-4 card matches only the rival's Gig: bottom of the deck
    expect(c!.zone).toBe('deck');
    expect(g.P(0).deck.at(-1)).toBe(c!.uid);
    // only the top 4 are searched: the fifth card, a match, is now the top card
    expect(fifth!.zone).toBe('deck');
    expect(g.P(0).deck[0]).toBe(fifth!.uid);
    // each pick offered the matching cards and could stop ("any number")
    const searches = asked(0, (x) => x.tag === 'search');
    expect(searches.length).toBe(3);
    expect(searches.every((x) => noneIndex(x) >= 0)).toBe(true);
    expect(CARD_BY_ID.hanako_arasaka_in_a_gilded_cage!.cost).toBe(4);
  });

  it('may reveal none: all 4 go to the bottom', async () => {
    const { g } = scene({ hooks: [onKind('card', noneIndex, 'search'), null], seed: 2 });
    gig(g, 0, 6, 3);
    const top = deckOf(g, 0, [plain(3), plain(3), plain(4), plain(5)]);
    await playCard(g, 0, 'hanako_arasaka_in_a_gilded_cage');
    expect(g.P(0).hand).toHaveLength(0);
    expect(new Set(g.P(0).deck.slice(-4))).toEqual(new Set(top.map((x) => x.uid)));
  });

  it('with no friendly Gig nothing matches: no card is offered and all 4 go to the bottom', async () => {
    const { g, asked } = scene({ seed: 3 });
    gig(g, 1, 6, 3);
    const top = deckOf(g, 0, [plain(3), plain(3), plain(4), plain(5)]);
    await playCard(g, 0, 'hanako_arasaka_in_a_gilded_cage');
    expect(asked(0, (x) => x.tag === 'search')).toHaveLength(0);
    expect(g.P(0).hand).toHaveLength(0);
    expect(new Set(g.P(0).deck.slice(-4))).toEqual(new Set(top.map((x) => x.uid)));
  });
});

describe("Rockn' Rockerboy", () => {
  it('is a vanilla Unit: no script, and playing it does nothing but put an 8-power Unit on the field', async () => {
    const def = CARD_BY_ID.rockn_rockerboy!;
    expect([def.type, def.cost, def.power, def.keywords]).toEqual(['Unit', 5, 8, []]);
    expect(SCRIPTS.rockn_rockerboy).toBeUndefined();
    const { g, asked, lines, mark } = scene();
    const deckBefore = [...g.P(0).deck];
    const rivalBefore = JSON.stringify(g.P(1));
    mark();
    const r = await playCard(g, 0, 'rockn_rockerboy');
    expect(r.zone).toBe('field');
    expect(g.power(r)).toBe(8);
    // no question asked, no card moved, the rival untouched, one line for the play
    expect(asked(0)).toHaveLength(0);
    expect(asked(1)).toHaveLength(0);
    expect(g.P(0).deck).toEqual(deckBefore);
    expect(g.P(0).hand).toHaveLength(0);
    expect(JSON.stringify(g.P(1))).toBe(rivalBefore);
    expect(lines()).toHaveLength(1);
  });
});
