// Card mentions in the UI (src/ui/components/CardMention.tsx): plain text until the name index loads; then a card name
// is a button that opens the card dialog, or inside a button or link a span with the hover preview only (never a
// nested control); a log reaches its names with the arrow keys (one Tab stop); hover, keyboard focus, click, Escape
// and touch behave as described; the preview shows the card and is hidden from screen readers; the dialog opens above
// every overlay. Then the places the owner asked about: the Game review's move list and detail, the match reviewer's
// costly moves, and the board's log drawer. Server-rendered: there is no DOM in these tests.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CARD_BY_ID } from '../src/engine/cards';
import { setArtEnabled } from '../src/ui/art';
import {
  CardDialogHost,
  CardMention,
  HOVER_DELAY,
  hoverHandlers,
  loadMentionRuntime,
  mentionHandlers,
  MentionRoving,
  MentionsOff,
  MentionsPassive,
  MentionText,
  openCardDialog,
  type MentionEffects,
} from '../src/ui/components/CardMention';
import { ReviewResult } from '../src/ui/components/GameReview';
import { GameLog, LogDrawer } from '../src/ui/components/board/LogDrawer';
import type { GameReviewRecord, ReviewMove } from '../src/lib/gameReview';
import type { PracticeReplay } from '../src/lib/practiceReplays';
import type { LogEntry } from '../src/engine/types';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setArtEnabled(false);
});
afterEach(() => vi.unstubAllGlobals());

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const BTN = '<span class="card-mention" role="button" tabindex="0" aria-haspopup="dialog">';

describe('before the name index loads', () => {
  it('text is plain, and nothing is fetched while rendering', async () => {
    vi.resetModules();
    const fresh = await import('../src/ui/components/CardMention');
    expect(html(<fresh.MentionText text="Play Minotaur (6 €$)" />)).toBe('Play Minotaur (6 €$)');
    expect(html(<fresh.CardMention id="minotaur">Minotaur</fresh.CardMention>)).toBe('Minotaur');
  });
});

describe('card mentions', () => {
  beforeAll(async () => {
    expect(await loadMentionRuntime()).not.toBeNull();
  });

  it('a card name in text is a button named by the card name alone', () => {
    const out = html(<MentionText text="Play Minotaur (6 €$)" />);
    expect(out).toBe(`Play ${BTN}Minotaur</span> (6 €$)`);
    // no card text, no image: a screen reader hears the name once
    expect(out).not.toContain(CARD_BY_ID.minotaur!.text.slice(0, 20));
  });

  it('text with no card names is left alone', () => {
    expect(html(<MentionText text="Nothing left to do: end your turn" />)).toBe('Nothing left to do: end your turn');
  });

  it('inside a button: a span with the hover preview only, never a nested control', () => {
    const out = html(
      <button type="button">
        <MentionText text="Sell Minotaur for an Eddie" passive />
      </button>,
    );
    expect(out).toBe('<button type="button">Sell <span class="card-mention is-passive">Minotaur</span> for an Eddie</button>');
    expect(out.match(/<button/g)).toHaveLength(1);
    expect(out).not.toContain('role=');
    // the context form, for a whole control's contents
    const ctx = html(
      <a href="#/x">
        <MentionsPassive>
          <CardMention id="minotaur" />
        </MentionsPassive>
      </a>,
    );
    expect(ctx).toBe('<a href="#/x"><span class="card-mention is-passive">Minotaur</span></a>');
  });

  it('links by id where the data has it, with the card name by default', () => {
    expect(html(<CardMention id="riot_shield" />)).toBe(`${BTN}Riot Shield</span>`);
    expect(html(<CardMention id="riot_shield">the shield</CardMention>)).toBe(`${BTN}the shield</span>`);
    expect(html(<CardMention id="not_a_card">Mystery</CardMention>)).toBe('Mystery');
  });

  it('a roving group takes the names out of the Tab order (the box is the one stop)', () => {
    expect(html(<MentionRoving><MentionText text="Minotaur" /></MentionRoving>)).toBe('<span class="card-mention" role="button" tabindex="-1" aria-haspopup="dialog">Minotaur</span>');
  });

  it('players’ own text and deck names stay plain', () => {
    expect(html(<MentionsOff><MentionText text="Minotaur" /></MentionsOff>)).toBe('Minotaur');
    expect(html(<MentionText text="Satori Control wins" skip={['Satori Control']} />)).toBe('Satori Control wins');
  });

  it('the preview shows the card and is hidden from assistive tech', async () => {
    const rt = (await loadMentionRuntime())!;
    const out = html(<rt.Preview def={CARD_BY_ID.minotaur!} card={{ left: 10, top: 10, right: 80, bottom: 30 }} />);
    expect(out).toMatch(/^<div class="tcg-zoom" aria-hidden="true"/);
    expect(out).toContain('<b>Minotaur</b>');
  });

  it('the dialog a mention opens renders above every overlay, and closes', async () => {
    openCardDialog('minotaur');
    html(<CardDialogHost />); // starts loading the dialog's code
    await import('../src/ui/components/CardModal');
    await new Promise((r) => setTimeout(r, 0));
    const out = html(<CardDialogHost />);
    expect(out).toContain('modal-backdrop card-mention-backdrop');
    expect(out).toMatch(/role="dialog"/);
    expect(out).toContain('Minotaur');
    openCardDialog(null);
    expect(html(<CardDialogHost />)).toBe('');
  });
});

describe('what a mention does with each input', () => {
  const fake = () => {
    const calls: string[] = [];
    let pending: (() => void) | null = null;
    let shown = false;
    const fx: MentionEffects = {
      show: () => (calls.push('show'), (shown = true)) && undefined,
      hide: () => (calls.push('hide'), (shown = false), (pending = null)) && undefined,
      shown: () => shown,
      open: () => void calls.push('open'),
      later: (fn, ms) => {
        calls.push(`later ${ms}`);
        pending = fn;
      },
      keyboardFocus: (el) => (el as unknown as { kb: boolean }).kb,
    };
    return { fx, calls, run: () => pending?.() };
  };
  const ev = (o: Record<string, unknown> = {}) => {
    const stop = vi.fn();
    return { e: { currentTarget: { kb: false } as unknown as Element, stopPropagation: stop, ...o }, stop };
  };

  it('a mouse pointer shows the card after a short pause; leaving hides it', () => {
    const { fx, calls, run } = fake();
    const on = mentionHandlers(fx);
    on.onPointerEnter({ ...ev().e, pointerType: 'mouse' });
    expect(calls).toEqual([`later ${HOVER_DELAY}`]);
    run();
    expect(calls).toEqual([`later ${HOVER_DELAY}`, 'show']);
    on.onPointerLeave();
    expect(calls.at(-1)).toBe('hide');
  });

  it('touch and pen never show a preview (a tap is a click, which opens the dialog)', () => {
    const { fx, calls } = fake();
    const on = mentionHandlers(fx);
    on.onPointerEnter({ ...ev().e, pointerType: 'touch' });
    on.onPointerEnter({ ...ev().e, pointerType: 'pen' });
    expect(calls).toEqual([]);
    const { e, stop } = ev();
    on.onClick(e);
    expect(calls).toEqual(['hide', 'open']);
    expect(stop).toHaveBeenCalled(); // a clickable row around it does not also act
  });

  it('keyboard focus shows the card, a pointer focus does not; blur and Escape hide it', () => {
    const { fx, calls } = fake();
    const on = mentionHandlers(fx);
    on.onFocus(ev({ currentTarget: { kb: false } }).e);
    expect(calls).toEqual([]);
    on.onFocus(ev({ currentTarget: { kb: true } }).e);
    expect(calls).toEqual(['show']);
    const esc = ev({ key: 'Escape' });
    on.onKeyDown({ ...esc.e, key: 'Escape', preventDefault: () => undefined });
    expect(calls).toEqual(['show', 'hide']);
    expect(esc.stop).toHaveBeenCalled(); // the preview goes first, not the dialog around it
    const esc2 = ev({ key: 'Escape' });
    on.onKeyDown({ ...esc2.e, key: 'Escape', preventDefault: () => undefined });
    expect(esc2.stop).not.toHaveBeenCalled(); // nothing shown: Escape is the surrounding dialog's
    on.onBlur();
    expect(calls.at(-1)).toBe('hide');
  });

  it('Enter and Space open the dialog (Space without scrolling), and go no further', () => {
    for (const key of ['Enter', ' ']) {
      const { fx, calls } = fake();
      const k = ev({ key, preventDefault: vi.fn() });
      mentionHandlers(fx).onKeyDown(k.e as typeof k.e & { key: string; preventDefault: () => void });
      expect(calls).toEqual(['hide', 'open']);
      expect(k.stop).toHaveBeenCalled();
      expect((k.e as unknown as { preventDefault: ReturnType<typeof vi.fn> }).preventDefault).toHaveBeenCalled();
    }
  });

  it('the passive form has the pointer handlers only', () => {
    const { fx } = fake();
    expect(Object.keys(hoverHandlers(fx)).sort()).toEqual(['onPointerEnter', 'onPointerLeave']);
  });
});

describe('mentions where the owner asked for them', () => {
  beforeAll(async () => {
    await loadMentionRuntime();
  });

  const deck = (name: string) => ({ name, legends: [], main: [], sideboard: [] });
  const replay: PracticeReplay = { id: 'r1', date: '2026-11-12T10:00:00Z', decks: [deck('Minotaur Rush'), deck('Theirs')], seed: 1, botLevel: 'hard', botSeed: 2, choices: [[0]], result: 'loss' };
  const mv = (o: Partial<ReviewMove> & Pick<ReviewMove, 'seq' | 'p' | 'r'>): ReviewMove => ({ at: o.seq, turn: 1, cat: 'unit', chosen: `Move ${o.seq}`, best: 'Better move', gap: 0, src: 'oracle', ...o });
  const rec: GameReviewRecord = {
    kind: 'nct-game-review',
    schema: 1,
    id: 'r1',
    made: '2026-11-12T10:05:00Z',
    rollouts: 8,
    oracleSeed: 1,
    names: ['Minotaur Rush', 'Theirs'],
    winner: 1,
    reason: 'controls 7+ Gigs at start of turn',
    turns: 3,
    first: 0,
    me: 0,
    timeline: [],
    moves: [
      mv({ seq: 0, p: 0, r: 'best', turn: 1, chosen: 'Sell Riot Shield for an Eddie', best: 'Sell Riot Shield for an Eddie' }),
      mv({ seq: 1, p: 0, r: 'mistake', turn: 2, chosen: 'Play Minotaur (6 €$)', best: 'Play Corpo Security (2 €$)', gap: 0.6, se: 0.1 }),
    ],
    forced: [0, 0],
    ms: 9000,
  };

  it('Game review: the move list rows (buttons) show cards on hover only; the turning point and the detail link them', () => {
    const out = html(<ReviewResult rec={rec} replay={replay} frames={null} />);
    const rows = out.match(/<button type="button" data-seq="\d+"[\s\S]*?<\/button>/g) ?? [];
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r).toContain('<span class="card-mention is-passive">');
      expect(r.match(/<button/g)).toHaveLength(1); // no control nested in the row
      expect(r).not.toContain('role="button"');
    }
    expect(rows[1]).toContain('Play <span class="card-mention is-passive">Minotaur</span> (6 €$)');
    // the turning point and the selected move's detail: real mentions
    expect(out).toContain(`played Play ${BTN}Minotaur</span>`);
    expect(out).toContain(`<b>Play ${BTN}Minotaur</span> (6 €$)</b>`);
    // the deck name "Minotaur Rush" is not a card
    expect(out).toContain('Minotaur Rush vs Theirs');
    expect(out).not.toContain(`${BTN}Minotaur</span> Rush`);
  });

  it('the log drawer: card names are mentions reached from the log box; turn headers and deck names stay plain', () => {
    const log: LogEntry[] = [
      { turn: 1, player: 0, text: '--- Turn 1 (Minotaur Rush) ---' },
      { turn: 1, player: 0, text: 'plays Minotaur' },
      { turn: 1, player: 1, text: 'Corpo Security attacks Minotaur (6)' },
      { turn: 1, player: null, text: 'Minotaur Rush wins: controls 7+ Gigs at start of turn' },
    ];
    const out = html(<LogDrawer log={log} n={log.length} names={['Minotaur Rush', 'Theirs']} open sheet={false} onClose={() => undefined} />);
    expect(out).toMatch(/<div class="log pb-log" aria-live="off" aria-label="[^"]*arrow[^"]*" tabindex="0">/);
    expect(out).toContain('--- Turn 1 (Minotaur Rush) ---');
    expect(out).toContain('<b>You: </b>plays <span class="card-mention" role="button" tabindex="-1" aria-haspopup="dialog">Minotaur</span>');
    expect(out).toContain('aria-haspopup="dialog">Corpo Security</span> attacks');
    expect(out).toContain('Minotaur Rush wins');
    // the log alone, as the phone sheet and saved games show it
    const lines = html(<GameLog log={log} n={log.length} names={['Minotaur Rush']} />);
    expect(lines.match(/class="card-mention" role="button"/g)).toHaveLength(3);
  });
});
