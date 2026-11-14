// Play board (P1): which cards are marked as actionable (derived only from the decision's options), the bot and replay
// speed options, the session-long "All actions" state, where the hover preview goes, and the rival's hand size.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import type { Decision } from '../src/engine/types';
import { setArtEnabled } from '../src/ui/art';
import type { BoardCtx } from '../src/ui/components/board/BoardCard';
import { boardMarks, buildInteraction, EMPTY_IX, NO_MARKS, type Targeting } from '../src/ui/components/board/interaction';
import { PHONE_FIXED } from '../src/ui/components/board/layout';
import { AllActions } from '../src/ui/components/board/PromptPanel';
import { ALL_ACTIONS_KEY, BOT_SPEEDS, DEFAULT_BOT_SPEED, loadBotSpeed, normalizeBotSpeed, readFlag, saveBotSpeed, writeFlag } from '../src/ui/components/board/prefs';
import { HAND_BACKS_MAX, handPulse, PlayerSide, RivalHandCount, rivalHandOwner } from '../src/ui/components/board/Zones';
import { DEFAULT_REPLAY_SPEED, REPLAY_SPEEDS } from '../src/ui/components/ReplayBoard';
import { placeZoom } from '../src/ui/components/TcgCard';
import { lessMotion } from '../src/ui/useBoardSettings';
import { eddies, FILLER, gig, setup, spawn } from './engine-helpers';

/** The main-phase decision the engine would ask player 0 now. */
function actionDecision(g: Game): Decision {
  return { player: 0, kind: 'action', prompt: 'Choose an action', options: g.legalActions(0).map((a) => ({ label: g.describeAction(a), action: a })), min: 1, max: 1 };
}

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), m };
}

describe('actionable cards (boardMarks)', () => {
  function scene() {
    const { g } = setup();
    gig(g, 1, 4, 2); // the rival has a Gig area to attack
    const playable = spawn(g, 0, FILLER, 'hand'); // cost 4
    const ready = spawn(g, 0, FILLER, 'field');
    const lagged = spawn(g, 0, FILLER, 'field', { lag: true });
    const rivalSpent = spawn(g, 1, FILLER, 'field', { spent: true });
    const rivalReady = spawn(g, 1, FILLER, 'field');
    return { g, playable, ready, lagged, rivalSpent, rivalReady };
  }

  it('marks main-phase cards by kind from the options, and quietens your cards with nothing to do', () => {
    const { g, playable, ready, lagged, rivalReady } = scene();
    eddies(g, 0, 4);
    const d = actionDecision(g);
    const ix = buildInteraction(g, d);
    const m = boardMarks(g, d, ix, null);
    expect(m.choosing).toBe(false);
    expect(m.cards.get(playable.uid)).toBe('play');
    expect(m.cards.get(ready.uid)).toBe('attack');
    expect(m.cards.get(lagged.uid)).toBe('idle');
    expect(m.cards.has(rivalReady.uid)).toBe(false); // the rival's cards aren't yours to act on, and aren't dimmed
    // every marked card (other than idle) is one the options name: nothing is re-derived from the rules
    for (const [uid, k] of m.cards) if (k !== 'idle') expect(ix.menus.has(uid)).toBe(true);
  });

  it('a card you can only sell is marked as such, not as playable', () => {
    const { g } = scene(); // no Eddies: nothing with a cost can be played
    const def = CARDS.find((c) => c.sellable && c.type === 'Unit' && (c.cost ?? 0) >= 2)!;
    const card = spawn(g, 0, def.id, 'hand');
    const d = actionDecision(g);
    const kinds = d.options.filter((o) => o.action && 'uid' in o.action && o.action.uid === card.uid).map((o) => o.action!.type);
    expect(kinds).toEqual(['sell']);
    expect(boardMarks(g, d, buildInteraction(g, d), null).cards.get(card.uid)).toBe('sell');
  });

  it('in target mode the legal targets are marked and everything else dims', () => {
    const { g, playable, ready, rivalSpent, rivalReady } = scene();
    const d = actionDecision(g);
    const ix = buildInteraction(g, d);
    const targets = ix.attacks.get(ready.uid)!;
    expect(targets.some((t) => t.unit === rivalSpent.uid)).toBe(true);
    const targeting: Targeting = { attacker: ready.uid, targets };
    const m = boardMarks(g, d, ix, targeting);
    expect(m.choosing).toBe(true);
    expect(m.cards.get(rivalSpent.uid)).toBe('target');
    expect(m.cards.get(ready.uid)).toBe('aiming');
    expect(m.cards.get(rivalReady.uid)).toBe('dim'); // a ready unit can't be attacked
    expect(m.cards.get(playable.uid)).toBe('dim');
  });

  it("a card prompt's options are the targets; with nothing pending nothing is marked", () => {
    const { g, playable, ready, rivalReady } = scene();
    const d: Decision = { player: 0, kind: 'unit', prompt: 'Choose a rival unit', min: 1, max: 1, options: [{ label: 'it', uid: rivalReady.uid }] };
    const m = boardMarks(g, d, buildInteraction(g, d), null);
    expect(m.choosing).toBe(true);
    expect(m.cards.get(rivalReady.uid)).toBe('target');
    expect(m.cards.get(ready.uid)).toBe('dim');
    expect(m.cards.get(playable.uid)).toBe('dim');
    expect(boardMarks(g, null, buildInteraction(g, null), null)).toBe(NO_MARKS);
  });
});

describe('speed options', () => {
  it('bot: instant 0, fast 500, normal 1200 (default), slow 2400; an old stored 250 is fast', () => {
    expect(BOT_SPEEDS.map((s) => [s.label, s.ms])).toEqual([
      ['instant', 0],
      ['fast', 500],
      ['normal', 1200],
      ['slow', 2400],
    ]);
    expect(DEFAULT_BOT_SPEED).toBe(1200);
    expect(normalizeBotSpeed(250)).toBe(500);
    expect(normalizeBotSpeed('250')).toBe(500);
    for (const s of BOT_SPEEDS) expect(normalizeBotSpeed(s.ms)).toBe(s.ms);
    for (const junk of [null, undefined, '', 'x', 333, -1, NaN]) expect(normalizeBotSpeed(junk)).toBe(DEFAULT_BOT_SPEED);
    const store = memStore();
    expect(loadBotSpeed(store)).toBe(1200);
    store.setItem('nct.botSpeed', '250');
    expect(loadBotSpeed(store)).toBe(500);
    saveBotSpeed(2400, store);
    expect(loadBotSpeed(store)).toBe(2400);
    expect(loadBotSpeed(null)).toBe(1200);
  });

  it('replay: shifted one step slower, so normal is the old slow', () => {
    const by = Object.fromEntries(REPLAY_SPEEDS.map((s) => [s.label, s]));
    expect(DEFAULT_REPLAY_SPEED).toBe('normal');
    expect(by.fast.ms).toBe(350); // the old normal
    expect(by.normal.ms).toBe(900); // the old slow
    expect(by.slow.ms).toBeGreaterThan(by.normal.ms);
    expect(by.fast.turnMs).toBe(2400); // the old fixed turn delay
    expect(by.normal.turnMs).toBeGreaterThan(by.fast.turnMs);
    expect(by.slow.turnMs).toBeGreaterThan(by.normal.turnMs);
  });
});

describe('"All actions" stays as the player left it', () => {
  const d: Decision = { player: 0, kind: 'action', prompt: 'p', min: 1, max: 1, options: [{ label: 'Play A' }, { label: 'End turn' }] };
  const noop = () => undefined;

  it('the open flag round-trips through session storage, and defaults when storage is empty or blocked', () => {
    const store = memStore();
    expect(readFlag(ALL_ACTIONS_KEY, false, store)).toBe(false);
    writeFlag(ALL_ACTIONS_KEY, true, store);
    expect(readFlag(ALL_ACTIONS_KEY, false, store)).toBe(true);
    writeFlag(ALL_ACTIONS_KEY, false, store);
    expect(readFlag(ALL_ACTIONS_KEY, true, store)).toBe(false);
    expect(readFlag(ALL_ACTIONS_KEY, true, null)).toBe(true);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readFlag(ALL_ACTIONS_KEY, false, throwing)).toBe(false);
    expect(() => writeFlag(ALL_ACTIONS_KEY, true, throwing)).not.toThrow();
  });

  it('open, it lists every option, and stays in place (still open) when nothing is pending', () => {
    const open = renderToStaticMarkup(<AllActions pend={d} coachI={null} answer={noop} open onToggle={noop} />);
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain('Play A');
    expect(open).toContain('End turn');
    const between = renderToStaticMarkup(<AllActions pend={null} coachI={null} answer={noop} open onToggle={noop} />);
    expect(between).toContain('aria-expanded="true"');
    expect(between).toContain('Nothing to decide right now');
    const closed = renderToStaticMarkup(<AllActions pend={d} coachI={null} answer={noop} open={false} onToggle={noop} />);
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain('Play A');
  });
});

describe('hover preview placement', () => {
  const vp = { w: 1280, h: 800 };
  const size = { w: 560, h: 440 };
  it('goes beside the card, right first, then left', () => {
    expect(placeZoom({ left: 100, top: 200, right: 230, bottom: 380 }, size, vp)).toEqual({ left: 240, top: 200 });
    expect(placeZoom({ left: 1000, top: 200, right: 1130, bottom: 380 }, size, vp)).toEqual({ left: 430, top: 200 });
  });
  it('stays inside the viewport: a card in the hand at the bottom gets a preview lifted above the edge', () => {
    const p = placeZoom({ left: 500, top: 600, right: 640, bottom: 795 }, size, vp);
    expect(p.top + size.h).toBeLessThanOrEqual(vp.h - 8);
    expect(p.top).toBeGreaterThanOrEqual(8);
  });
  it('with no room on either side it goes above or below, clamped', () => {
    const narrow = { w: 700, h: 900 };
    const p = placeZoom({ left: 280, top: 500, right: 420, bottom: 690 }, size, narrow);
    expect(p.top + size.h).toBeLessThanOrEqual(500);
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.left + size.w).toBeLessThanOrEqual(narrow.w - 8);
  });
});

describe("the rival's hand size (RivalHandCount)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const esc = (s: string) => s.replace(/'/g, '&#x27;');
  const backsIn = (html: string) => html.match(/class="tcg tcg-xs tcg-back/g)?.length ?? 0;

  it('says "Hand" and the number, with at most seven small backs, and names the seat and the count', () => {
    expect(HAND_BACKS_MAX).toBe(7);
    for (const [n, shown, words] of [
      [0, 0, '0 cards'],
      [1, 1, '1 card'],
      [5, 5, '5 cards'],
      [7, 7, '7 cards'],
      [12, 7, '12 cards'],
    ] as const) {
      const html = renderToStaticMarkup(<RivalHandCount n={n} owner="Rival" backs />);
      expect(html, `${n}`).toContain(`<span class="pb-rh-word">Hand</span><b class="pb-rh-n">${n}</b>`);
      expect(backsIn(html), `${n}`).toBe(shown);
      expect(html).toContain(`role="img" aria-label="${esc(`Rival's hand: ${words}`)}" title="${esc(`Rival's hand: ${words}`)}"`);
      // an empty hand shows no backs at all; nothing in it is focusable or a button
      if (!n) expect(html).not.toContain('pb-rh-backs');
      expect(html).not.toMatch(/tabindex|role="button"|muted/);
    }
    // without backs (the phone tile, the replay row) it is the word and the number only
    const tile = renderToStaticMarkup(<RivalHandCount n={5} owner="Ana" tile />);
    expect(tile).toMatch(/^<div class="pb-rh pb-rh-tile" role="img" aria-label="Ana&#x27;s hand: 5 cards"/);
    expect(backsIn(tile)).toBe(0);
  });

  function sideCtx(over: Partial<BoardCtx> = {}): { ctx: BoardCtx; g: Game } {
    setArtEnabled(false);
    const { g } = setup();
    for (let i = 0; i < 5; i++) spawn(g, 1, FILLER, 'hand');
    const noop = () => undefined;
    const ctx: BoardCtx = { g, pend: null, ix: EMPTY_IX, coach: null, targeting: null, narrow: false, menuUid: null, answer: noop, openMenu: noop, startTargeting: noop, cancelTargeting: noop, openTrash: noop, ...over };
    return { ctx, g };
  }

  it('names the seat as the rest of the side does: a person online, the replay seat labels, else Rival', () => {
    expect(rivalHandOwner(sideCtx().ctx)).toBe('Rival');
    expect(rivalHandOwner(sideCtx({ rivalName: 'Ana' }).ctx)).toBe('Ana');
    expect(rivalHandOwner(sideCtx({ seatLabels: ['you', 'Hard bot'] }).ctx)).toBe('Hard bot');
    const html = renderToStaticMarkup(<PlayerSide p={1} ctx={sideCtx({ seatLabels: ['you', 'Hard bot'] }).ctx} />);
    expect(html).toContain(`aria-label="${esc("Hard bot's hand: 5 cards")}"`);
    expect(renderToStaticMarkup(<PlayerSide p={1} ctx={sideCtx({ rivalName: 'Ana' }).ctx} />)).toContain(`aria-label="${esc("Ana's hand: 5 cards")}"`);
  });

  it("every layout's place for it renders it: the desktop name row, the phone piles column and the replay row", () => {
    const { ctx } = sideCtx();
    const html = renderToStaticMarkup(<PlayerSide p={1} ctx={ctx} />);
    const label = esc("Rival's hand: 5 cards");
    // desktop and tablet: in the name row, with its backs (board.css shows .pb-name-hand on .pb-full only)
    expect(html).toMatch(new RegExp(`<div class="pb-side-name">.*<div class="pb-rh pb-name-hand" role="img" aria-label="${label}"`));
    expect(backsIn(html.slice(html.indexOf('pb-name-hand'), html.indexOf('pb-rh-word', html.indexOf('pb-name-hand'))))).toBe(5);
    // phones: a tile in the piles column (no backs: the column is 60px wide)
    expect(html).toContain(`<div class="pb-pile pb-pile-hand"><div class="pb-rh pb-rh-tile" role="img" aria-label="${label}" title="${label}"><span class="pb-rh-word">Hand</span><b class="pb-rh-n">5</b></div></div>`);
    // other layouts (the replay and review boards): beside the row of backs
    expect(html).toMatch(new RegExp(`<div class="pb-rival-hand">(<div class="pb-rival-hand-card" aria-hidden="true">.*?</div></div></div></div>){5}<div class="pb-rh" role="img" aria-label="${label}"`));
    expect(html.match(/<span class="pb-rh-word">Hand<\/span><b class="pb-rh-n">5<\/b>/g)).toHaveLength(3);
    // the old muted wording is gone
    expect(html).not.toContain('in hand');
    expect(html).not.toContain('Rival hand:');
    // your own side has none
    expect(renderToStaticMarkup(<PlayerSide p={0} ctx={ctx} />)).not.toContain('pb-rh');
  });

  it('pulses once when the number changes: never on the first render, never with motion reduced or off', () => {
    // the first render starts from the number shown
    expect(renderToStaticMarkup(<RivalHandCount n={5} owner="Rival" backs />)).not.toContain('pb-rh-pulse');
    const start = { n: 5, k: 0 };
    expect(handPulse(start, 5, false)).toBe(start);
    expect(handPulse(start, 6, false)).toEqual({ n: 6, k: 1 });
    expect(handPulse({ n: 6, k: 1 }, 4, false)).toEqual({ n: 4, k: 2 });
    expect(handPulse(start, 6, true)).toEqual({ n: 6, k: 0 });
    // the gate is the Motion setting on <html>
    const at = (level: string | null) => vi.stubGlobal('document', { documentElement: { getAttribute: (k: string) => (k === 'data-motion' ? level : null) } });
    at('full');
    expect(lessMotion()).toBe(false);
    at('reduced');
    expect(lessMotion()).toBe(true);
    at('off');
    expect(lessMotion()).toBe(true);
  });

  it('board.css: the pulse moves only transform and opacity and is off with reduced or no motion; the number is a read-out', () => {
    const css = readFileSync(new URL('../src/ui/board.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const frames = css.match(/@keyframes pb-rh-pulse \{([\s\S]*?)\n\}/)?.[1];
    expect(frames).toBeTruthy();
    const props = new Set([...frames!.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]));
    expect([...props].sort()).toEqual(['opacity', 'transform']);
    expect(css).toMatch(/:where\(:root\[data-motion='reduced'\], :root\[data-motion='off'\]\) \.pb-rh-pulse \{\s*animation: none;/);
    expect(css).toMatch(/:where\(:root:not\(\[data-numerals='standard'\]\)\) :is\([^)]*\.pb-rh-n[^)]*\)/);
    // nothing of it is cut with clip-path
    expect(css).not.toMatch(/\.pb-rh[^{]*\{[^}]*clip-path/);
    // the phone tile (15px lines and a 1px border) keeps the rival's piles column inside its budget: four rows (€$,
    // Deck, Trash 15px each, the tile 17px), 1px gaps, 2px padding and a 1px border top and bottom
    expect(css).toMatch(/\.pb-rh-tile \.pb-rh-n \{\s*line-height: 15px;/);
    expect(3 * 15 + 17 + 3 * 1 + 2 * 2 + 2 * 1).toBeLessThanOrEqual(PHONE_FIXED.rivalPiles);
  });
});
