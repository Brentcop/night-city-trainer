import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import { makeTierBot } from '../src/ai/tiers';
import { HeuristicAgent } from '../src/ai/heuristic';
import { cloneBot } from '../src/lib/practiceSession';
import { candidateSwaps, breedInBrowser } from '../src/lib/deckLab';
import { resolveDrop } from '../src/ui/components/board/drag';
import { buildInteraction } from '../src/ui/components/board/interaction';
import { analyzeDeck } from '../src/analysis/analyze';
import { validateDeck } from '../src/engine/deck';
import type { Agent, Decision, DeckList, GameState } from '../src/engine/types';
import type { LibraryDeck } from '../src/lib/library';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];

describe('undo snapshots', () => {
  it('a game restored from a main-phase snapshot plays on exactly as the original', async () => {
    const bots = [makeTierBot('medium', 3), makeTierBot('medium', 4)] as HeuristicAgent[];
    let snap: { state: GameState; a: HeuristicAgent; b: HeuristicAgent } | null = null;
    let k = 0;
    class Snapper implements Agent {
      name = 'snap';
      async decide(g: Game, d: Decision) {
        if (d.kind === 'action' && ++k === 6) snap = { state: g.clone([bots[0], bots[1]]).s, a: cloneBot(bots[0]), b: cloneBot(bots[1]) };
        return bots[0].decide(g, d);
      }
    }
    const orig = await Game.create(decks, [new Snapper(), bots[1]], { seed: 21, log: false }).run();
    expect(snap).not.toBeNull();
    const s = snap!;
    const resumed = await new Game(s.state, [s.a, s.b]).resume();
    expect(resumed.winner).toBe(orig.winner);
    expect(resumed.turn).toBe(orig.turn);
  }, 60_000);
});

describe('drag to act', () => {
  it('maps drops to the matching options only', async () => {
    let checked = false;
    class Probe implements Agent {
      name = 'probe';
      inner = makeTierBot('easy', 1);
      async decide(g: Game, d: Decision) {
        if (!checked && d.kind === 'action' && d.player === 0) {
          const ix = buildInteraction(g, d);
          const sellable = [...ix.menus.entries()].find(([, m]) => m.some((x) => x.kind === 'sell'));
          if (sellable) {
            const [uid] = sellable;
            const sells = resolveDrop(g, ix, uid, { kind: 'sell' });
            expect(sells.length).toBe(1);
            expect((d.options[sells[0].i].action as { type: string }).type).toBe('sell');
            expect(resolveDrop(g, ix, uid, { kind: 'gigs' })).toEqual([]);
            checked = true;
          }
        }
        return this.inner.decide(g, d);
      }
    }
    await Game.create(decks, [new Probe(), makeTierBot('easy', 2)], { seed: 5, log: false }).run();
    expect(checked).toBe(true);
  }, 30_000);
});

describe('deck lab', () => {
  it('proposes only legal one-card swaps', () => {
    const rep = analyzeDeck('A', []);
    const swaps = candidateSwaps(decks[0], rep, 6);
    for (const s of swaps) expect(validateDeck({ ...s.deck, sideboard: [] })).toEqual([]);
  });
  it('breeds new, legal decks in the browser', () => {
    const lib: LibraryDeck[] = [
      { file: 'a.txt', deck: decks[0], kind: 'meta', prov: {} },
      { file: 'b.txt', deck: decks[1], kind: 'meta', prov: {} },
    ];
    const out = breedInBrowser(lib, { n: 4, seed: 9, parents: ['A', 'B'] });
    expect(out.length).toBeGreaterThan(0);
    for (const b of out) {
      expect(b.deck.name.startsWith('Lab-')).toBe(true);
      expect(validateDeck({ ...b.deck, sideboard: [] })).toEqual([]);
    }
  });
});
