// Online play's screens: the lobby renders with the privacy and trust notes, the Play setup offers Play online only when
// the feature is on, and the board draws a game from a seat's view alone (no hidden card's face anywhere).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { validateDeck } from '../src/engine/deck';
import type { PlayerId } from '../src/engine/types';
import { BUILTIN } from '../src/lib/browserLibrary';
import { practiceAgents } from '../src/sim/practiceReview';
import { practiceSpec, reviewExpect, type PracticeReplay } from '../src/lib/practiceReplays';
import { gameDeck } from '../src/lib/tournament';
import { HostGame } from '../src/net/hostGame';
import { ViewGame } from '../src/net/view';
import { setArtEnabled } from '../src/ui/art';
import { PlaySetup } from '../src/ui/components/PlaySetup';
import { MyHand, PlayerSide } from '../src/ui/components/board/Zones';
import { PromptPanel } from '../src/ui/components/board/PromptPanel';
import { boardMarks, buildInteraction } from '../src/ui/components/board/interaction';
import type { BoardCtx } from '../src/ui/components/board/BoardCard';
import { PlayOnline } from '../src/ui/pages/PlayOnline';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setArtEnabled(false);
});
afterEach(() => vi.unstubAllGlobals());

const legal = BUILTIN.map((d) => gameDeck(d.deck)).filter((d) => validateDeck(d).length === 0);

describe('the lobby', () => {
  it('renders host and join with the network-address and trust notes', () => {
    const html = renderToStaticMarkup(<PlayOnline invite={null} mode="host" />);
    expect(html).toContain('Play online');
    expect(html).toContain('Host the game');
    expect(html).toContain('Turn timer');
    expect(html).toContain('Connecting shares your network address with the other player and with the STUN service');
    expect(html).toContain('The host&#x27;s browser runs the game, so this is for friendly play. A modified host could see hidden cards.');
    const join = renderToStaticMarkup(<PlayOnline invite="local-abcd2345" mode="join" />);
    expect(join).toContain('Join the room');
    expect(join).toContain('abcd2345');
  });
  it('Play setup offers Play online only when multiplayer is on', () => {
    const props = {
      mine: '',
      setMine: () => undefined,
      opp: '',
      setOpp: () => undefined,
      seat: 'random' as const,
      setSeat: () => undefined,
      coach: false,
      level: 'hard' as const,
      setLevel: () => undefined,
      dA: undefined,
      dB: undefined,
      onStart: () => undefined,
    };
    expect(renderToStaticMarkup(<PlaySetup {...props} online />)).toContain('#/play/online?mode=host');
    expect(renderToStaticMarkup(<PlaySetup {...props} />)).not.toContain('Play online');
  });
});

describe('the board from a view', () => {
  it("draws both sides from the guest's view, with the rival's hand and decks as backs only", async () => {
    const h = new HostGame({ game: 'g', token: 't', names: ['Ana', 'Bo'], decks: [legal[0]!, legal[3]!], seed: 5, first: 1, timer: 0, started: '' });
    await new Promise((r) => setTimeout(r, 0));
    const w = h.waitingSeat()!;
    const seat = 1 as PlayerId;
    const v = h.view(seat);
    const g = new ViewGame(v.state);
    const pend = w === seat ? v.decision!.d : null;
    const ix = buildInteraction(g, pend);
    const ctx: BoardCtx = {
      g,
      pend,
      ix,
      coach: null,
      targeting: null,
      narrow: false,
      menuUid: null,
      answer: () => undefined,
      openMenu: () => undefined,
      startTargeting: () => undefined,
      cancelTargeting: () => undefined,
      openTrash: () => undefined,
      marks: boardMarks(g, pend, ix, null),
      rivalName: 'Ana',
    };
    const html = renderToStaticMarkup(
      <>
        <PlayerSide p={1} ctx={ctx} />
        <PlayerSide p={0} ctx={ctx} />
        <MyHand ctx={ctx} />
        <PromptPanel ctx={ctx} />
      </>,
    );
    expect(html).toContain('Ana');
    expect(html).toContain('6 in hand');
    // the guest's own hand shows; the host's hidden cards never do
    const real = h.g.s;
    const hostHidden = [...real.players[0].hand, ...real.players[0].deck, ...real.players[1].deck].map((u) => real.cards[u]!.defId);
    const ownHand = new Set(real.players[1].hand.map((u) => real.cards[u]!.defId));
    for (const id of hostHidden) if (!ownHand.has(id)) expect(html).not.toContain(id);
    h.quit();
  });
});

describe('an online game in the review', () => {
  it('replays both seats from the record, the guest reviewing from seat 1', () => {
    const r: PracticeReplay = {
      id: 'pvp-x-g',
      date: '',
      decks: [legal[0]!, legal[1]!],
      seed: 3,
      first: 0,
      botLevel: 'pvp',
      botSeed: 0,
      choices: [[1]],
      payChoice: true,
      orderChoice: true,
      result: 'win',
      pvp: { rival: 'Ana', seat: 1, rivalChoices: [[0]] },
    };
    expect(reviewExpect(r)).toBe(1);
    const [a, b] = practiceAgents(practiceSpec(r));
    expect([a.name, b.name]).toEqual(['Rival', 'You']);
    expect([a.choosesPayment, b.choosesOrder]).toEqual([true, true]);
  });
});
