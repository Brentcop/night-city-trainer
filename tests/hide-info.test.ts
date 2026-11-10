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
