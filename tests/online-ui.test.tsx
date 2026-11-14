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
import { addressNote, DIRECT_CONSEQUENCE, GUEST_MODES_NOTE, inviteModeNote, netModes, PlayOnline, PRIVATE_LABEL, PRIVATE_NOTE, PRIVATE_UNAVAILABLE, RELAY_LABEL, RELAY_NOTE } from '../src/ui/pages/PlayOnline';
import { defaultSiteConfig, siteConfigText, type SiteConfig } from '../src/lib/siteConfig';
import { previewDraft } from '../src/ui/useSiteConfig';
import { CORR_PRIVACY, PlayCorr } from '../src/ui/pages/PlayCorr';

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
    // before any code is made: what a direct connection shares, with whom, and that the codes carry it
    expect(html).toContain('A direct connection shares your internet address (IP) with the other player, and with the STUN service this site uses to find it (stun.l.google.com:19302) when you make a code.');
    expect(html).toContain('The invite and reply codes carry your address too unless they are locked with a phrase: send codes only in a private message, never in a public channel.');
    expect(html).toContain('To play without sharing any address, play a <a href="#/play/corr">multi-day game</a>: its turn packets carry no network address, and the site contacts no one.');
    expect(html).toContain('The other player&#x27;s board shows only your deck&#x27;s name; the host&#x27;s device holds both lists to run the game.');
    expect(html).not.toContain('sees your deck&#x27;s name only');
    expect(html).toContain('The host&#x27;s browser runs the game, so this is for friendly play. A modified host could see hidden cards.');
    expect(addressNote([])).toMatch(/^A direct connection shares your address on the local network with the other player.*only connects players on the same network.$/);
    const join = renderToStaticMarkup(<PlayOnline invite="local-abcd2345" mode="join" />);
    expect(join).toContain('Join the room');
    expect(join).toContain('abcd2345');
  });
  it('with the default config: the private connection is shown unavailable, with why and the way to play without sharing an address; nothing about a relay server', () => {
    const html = renderToStaticMarkup(<PlayOnline invite={null} mode="host" />);
    const esc = (s: string) => s.replace(/'/g, '&#x27;');
    expect(html).toContain(PRIVATE_LABEL);
    expect(html).toContain(esc(PRIVATE_UNAVAILABLE));
    expect(html).toMatch(/name="online-mode" disabled=""/);
    expect(html).toContain('To play without sharing any address, play a <a href="#/play/corr">multi-day game</a>.');
    expect(html).not.toContain(RELAY_LABEL);
    expect(html).not.toContain(esc(DIRECT_CONSEQUENCE));
    expect(netModes(defaultSiteConfig().multiplayer)).toEqual({ relay: false, private: false, initial: 'direct' });
    // the guest's lobby is as before
    const join = renderToStaticMarkup(<PlayOnline invite={null} mode="join" />);
    expect(join).not.toContain(PRIVATE_LABEL);
    expect(join).not.toContain(GUEST_MODES_NOTE.replace(/'/g, '&#x27;'));
  });
  it('with a relay or TURN configured: the most private choice is picked first, and direct states its consequence', () => {
    const preview = (f: (c: SiteConfig) => void) => {
      const c = defaultSiteConfig();
      f(c);
      previewDraft(siteConfigText(c));
    };
    const esc = (s: string) => s.replace(/'/g, '&#x27;');
    try {
      preview((c) => (c.multiplayer.turnServers = [{ urls: ['turns:turn.example.test:5349'], username: 'u', credential: 'c' }]));
      let html = renderToStaticMarkup(<PlayOnline invite={null} mode="host" />);
      expect(html).not.toContain(RELAY_LABEL);
      expect(html).toContain(esc(PRIVATE_NOTE));
      expect(html).toContain(esc(DIRECT_CONSEQUENCE));
      expect(html).not.toMatch(/name="online-mode" disabled=""/);
      // the private choice is checked
      expect(html).toMatch(/<input type="radio" name="online-mode" checked=""\/><span>Private connection/);
      preview((c) => {
        c.multiplayer.relayUrl = 'wss://relay.example.test/';
        c.multiplayer.turnCredentialsUrl = 'https://creds.example.test/';
      });
      html = renderToStaticMarkup(<PlayOnline invite={null} mode="host" />);
      expect(html).toContain(RELAY_LABEL);
      expect(html).toMatch(/<input type="radio" name="online-mode" checked=""\/><span>Through the relay server/);
      expect(html).toContain(esc(RELAY_NOTE));
      const join = renderToStaticMarkup(<PlayOnline invite={null} mode="join" />);
      expect(join).toContain(esc(GUEST_MODES_NOTE));
    } finally {
      previewDraft(null);
    }
    expect(inviteModeNote('relay')).toMatch(/never sees your address/);
    expect(inviteModeNote('direct')).toMatch(/host will see it/);
    expect(inviteModeNote(null)).toBeNull();
  });
  it('the multi-day lobby says packets carry no address, and offers a locked invite', () => {
    const html = renderToStaticMarkup(<PlayCorr sub="corr" />);
    expect(html).toContain(CORR_PRIVACY.replace(/'/g, '&#x27;'));
    expect(html).toContain('Lock the invite with a phrase');
    expect(html).not.toContain('sees your deck&#x27;s name only');
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
    expect(renderToStaticMarkup(<PlaySetup {...props} />)).not.toContain('#/play/online');
    // the bot game's Start comes before the play-a-person row (UX-13)
    const html = renderToStaticMarkup(<PlaySetup {...props} online />);
    expect(html.indexOf('Start game')).toBeLessThan(html.indexOf('#/play/online?mode=host'));
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
    expect(html).toContain('<span class="pb-rh-word">Hand</span><b class="pb-rh-n">6</b>');
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
