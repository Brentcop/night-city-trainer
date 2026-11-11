// Play board (P1): which cards are marked as actionable (derived only from the decision's options), the bot and replay
// speed options, the session-long "All actions" state, and where the hover preview goes.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import type { Decision } from '../src/engine/types';
import { boardMarks, buildInteraction, NO_MARKS, type Targeting } from '../src/ui/components/board/interaction';
import { AllActions } from '../src/ui/components/board/PromptPanel';
import { ALL_ACTIONS_KEY, BOT_SPEEDS, DEFAULT_BOT_SPEED, loadBotSpeed, normalizeBotSpeed, readFlag, saveBotSpeed, writeFlag } from '../src/ui/components/board/prefs';
import { DEFAULT_REPLAY_SPEED, REPLAY_SPEEDS } from '../src/ui/components/ReplayBoard';
import { placeZoom } from '../src/ui/components/TcgCard';
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
