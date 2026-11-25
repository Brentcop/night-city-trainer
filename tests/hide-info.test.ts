// hideInfo: lookahead clones re-deal only what the viewer can't see.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import type { Agent, DeckList, PlayerId } from '../src/engine/types';
import { hideInfo } from '../src/ai/heuristic';

const first: Agent = { name: 'first', decide: async () => [0] };
const deckA: DeckList = {
  name: 'A',
  legends: ['dexter_deshawn_off_the_grid', 'v_streetkid', 'royce_psycho_on_the_edge'],
  main: [...Array(20).fill('animals_wrecker'), ...Array(20).fill('swordwise_huscle')],
  sideboard: [],
};
const deckB: DeckList = {
  name: 'B',
  legends: ['hanako_arasaka_daughter_of_the_emperor', 'padre_man_of_the_cross', 'saburo_arasaka_stubborn_patriarch'],
  main: [...Array(20).fill('emergency_atlus'), ...Array(20).fill('detonate')],
  sideboard: [],
};

function game(seed: number) {
  const g = Game.create([deckA, deckB], [first, first], { seed, first: 0, log: false });
  // a public card in the rival's trash, a face-up rival Legend, and one own Legend the viewer has looked at
  g.move(g.P(1).deck[0], 'trash');
  g.c(g.P(1).legends[0]).faceUp = true;
  g.c(g.P(0).legends[2]).known = true;
  return g;
}
const ids = (g: Game, uids: number[]) => uids.map((u) => g.c(u).defId);
const sorted = (xs: string[]) => [...xs].sort();

describe('hideInfo', () => {
  it('keeps hand sizes and the viewer’s own hand, re-deals the rival hand from unseen cards', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = game(seed);
      const viewer: PlayerId = 0;
      const ownHand = [...g.P(0).hand];
      const rivalUnseen = sorted(ids(g, [...g.P(1).hand, ...g.P(1).deck]));
      const rivalTrash = [...g.P(1).trash];
      const cg = g.clone([first, first]);
      hideInfo(cg, viewer);
      expect(cg.P(0).hand).toEqual(ownHand);
      expect(cg.P(1).hand.length).toBe(g.P(1).hand.length);
      expect(cg.P(0).deck.length).toBe(g.P(0).deck.length);
      expect(sorted(ids(cg, [...cg.P(1).hand, ...cg.P(1).deck]))).toEqual(rivalUnseen);
      expect(cg.P(1).trash).toEqual(rivalTrash);
      for (const u of cg.P(1).hand) expect(cg.c(u).zone).toBe('hand');
      for (const u of cg.P(1).deck) expect(cg.c(u).zone).toBe('deck');
      // the real game is untouched
      expect(g.P(0).hand).toEqual(ownHand);
    }
  });

  it('permutes face-down Legend identities among the slots the viewer can’t tell apart', () => {
    let ownMoved = 0;
    let rivalMoved = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = game(seed);
      const cg = g.clone([first, first]);
      hideInfo(cg, 0);
      const own = g.P(0).legends;
      const riv = g.P(1).legends;
      // unknown own face-down slots 0,1 and rival face-down slots 1,2: same pool, maybe another order
      expect(sorted(ids(cg, own.slice(0, 2)))).toEqual(sorted(ids(g, own.slice(0, 2))));
      expect(sorted(ids(cg, riv.slice(1)))).toEqual(sorted(ids(g, riv.slice(1))));
      // known own Legend and face-up rival Legend never move
      expect(cg.c(own[2]).defId).toBe(g.c(own[2]).defId);
      expect(cg.c(riv[0]).defId).toBe(g.c(riv[0]).defId);
      if (ids(cg, own.slice(0, 2)).join() !== ids(g, own.slice(0, 2)).join()) ownMoved++;
      if (ids(cg, riv.slice(1)).join() !== ids(g, riv.slice(1)).join()) rivalMoved++;
    }
    expect(ownMoved).toBeGreaterThan(3);
    expect(rivalMoved).toBeGreaterThan(3);
  });

  it('deals the same identities whatever the true order (nothing leaks through the slot order)', () => {
    const a = game(9);
    const b = game(9);
    const [x, y] = b.P(1).legends.slice(1);
    [b.c(x).defId, b.c(y).defId] = [b.c(y).defId, b.c(x).defId];
    const ca = a.clone([first, first]);
    const cb = b.clone([first, first]);
    hideInfo(ca, 0);
    hideInfo(cb, 0);
    expect(ids(cb, cb.P(1).legends)).toEqual(ids(ca, ca.P(1).legends));
  });
});

// REVIEW_2026-11-25 C5: the cards both players know are in the rival's hand stay there in every projection.
describe('hideInfo keeps the cards both players know (keepShown)', () => {
  /** A game recording PlayerState.shown, with one of the rival's cards taken into its hand from the trash. */
  function shownGame(seed: number) {
    const g = game(seed);
    g.tracksShown = true;
    const u = g.P(1).trash[0];
    g.move(u, 'hand');
    return { g, u };
  }

  it('the engine records a card coming into a hand from a public zone or revealed from the deck, and forgets it when it leaves', () => {
    const { g, u } = shownGame(3);
    expect(g.P(1).shown).toEqual([u]);
    // drawn: not known; revealed from the deck: known
    const drawn = g.drawRaw(1)!;
    const revealed = g.P(1).deck[0];
    g.move(revealed, 'hand', { revealed: true });
    expect(g.P(1).shown).toEqual([u, revealed]);
    expect(g.P(1).shown).not.toContain(drawn);
    // searched without a reveal (Three Mouths, One Desire): not known
    g.move(g.P(1).deck[0], 'hand');
    expect(g.P(1).shown).toEqual([u, revealed]);
    // leaving the hand takes it off the list; the field goes when the list empties
    g.move(u, 'trash');
    expect(g.P(1).shown).toEqual([revealed]);
    g.sell(1, revealed);
    expect('shown' in g.P(1)).toBe(false);
    // copies carry the switch
    expect(g.clone([first, first]).tracksShown).toBe(true);
  });

  it('records nothing while the switch is off, so the state is exactly as before', () => {
    const g = game(3);
    g.move(g.P(1).trash[0], 'hand');
    g.move(g.P(1).deck[0], 'hand', { revealed: true });
    expect('shown' in g.P(1)).toBe(false);
    expect('shown' in g.P(0)).toBe(false);
  });

  it('keeps a known card in its place in the rival hand and re-deals only the rest', () => {
    let movedWithout = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { g, u } = shownGame(seed);
      const at = g.P(1).hand.indexOf(u);
      const rivalUnseen = sorted(ids(g, [...g.P(1).hand, ...g.P(1).deck]));
      const cg = g.clone([first, first]);
      hideInfo(cg, 0, true);
      expect(cg.P(1).hand.length).toBe(g.P(1).hand.length);
      expect(cg.P(1).hand[at]).toBe(u);
      expect(cg.c(u).zone).toBe('hand');
      expect(sorted(ids(cg, [...cg.P(1).hand, ...cg.P(1).deck]))).toEqual(rivalUnseen);
      for (const x of cg.P(1).hand) expect(cg.c(x).zone).toBe('hand');
      for (const x of cg.P(1).deck) expect(cg.c(x).zone).toBe('deck');
      // the other cards are re-dealt
      expect(cg.P(1).hand.filter((x) => x !== u)).not.toEqual(g.P(1).hand.filter((x) => x !== u));
      // without keepShown the whole hand is re-dealt, the known card included
      const c2 = g.clone([first, first]);
      hideInfo(c2, 0);
      if (!c2.P(1).hand.includes(u)) movedWithout++;
    }
    expect(movedWithout).toBeGreaterThan(10);
  });

  it('deals exactly as before when no card is known', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const g = game(seed);
      g.tracksShown = true;
      const a = g.clone([first, first]);
      const b = g.clone([first, first]);
      hideInfo(a, 0);
      hideInfo(b, 0, true);
      expect(JSON.stringify(b.s)).toBe(JSON.stringify(a.s));
    }
  });

  it('a revealing search records its cards, and the online view never carries the list', async () => {
    const { searchTop } = await import('../src/engine/scripts/helpers');
    const { viewFor } = await import('../src/net/view');
    const g = game(5);
    g.tracksShown = true;
    const picked = await searchTop(g, 1, 3, { max: 1, rest: 'bottom' });
    expect(picked.length).toBe(1);
    expect(g.P(1).shown).toEqual(picked);
    for (const seat of [0, 1] as PlayerId[]) for (const P of viewFor(g.s, seat).players) expect('shown' in P).toBe(false);
  });
});
