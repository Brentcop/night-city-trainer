// PLAY-20 parts 4–5: the Play page's setup screen and coach panel moved out of Play.tsx (src/ui/components/PlaySetup.tsx,
// src/ui/components/board/CoachPanel.tsx); the review request helpers moved to src/lib/practiceReplays.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { practiceRequest, reviewExpect, type PracticeReplay } from '../src/lib/practiceReplays';
import { PlaySetup } from '../src/ui/components/PlaySetup';
import { CoachPanel, MoveToast, Scorecard } from '../src/ui/components/board/CoachPanel';
import { BUILTIN } from '../src/lib/browserLibrary';
import { setArtEnabled } from '../src/ui/art';
import type { MoveGrade } from '../src/ai/coach';
import { COACH_COST_NOTE, coachCostWords } from '../src/lib/coachWords';

const replay = (o: Partial<PracticeReplay> = {}): PracticeReplay => ({
  id: 'r1',
  date: '2026-11-11T10:00:00Z',
  decks: [BUILTIN[0].deck, BUILTIN[1].deck],
  seed: 7,
  botLevel: 'hard',
  botSeed: 9,
  choices: [[0], [1]],
  result: 'loss',
  ...o,
});

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setArtEnabled(false);
});
afterEach(() => vi.unstubAllGlobals());

describe('practice review helpers', () => {
  it('a review expects the recorded result', () => {
    expect(reviewExpect(replay({ result: 'win' }))).toBe(0);
    expect(reviewExpect(replay({ result: 'loss' }))).toBe(1);
    expect(reviewExpect(replay({ result: 'draw' }))).toBe('tie');
  });
  it('builds the request from the replay, flags defaulting to false', () => {
    const q = practiceRequest(replay({ conceded: true }));
    expect(q).toMatchObject({ kind: 'practice', seed: 7, botLevel: 'hard', botSeed: 9, choices: [[0], [1]], payChoice: false, orderChoice: false, conceded: true, withCoach: true });
  });
});

describe('setup screen and coach panel (moved, unchanged)', () => {
  it('the setup screen shows both decks, the pickers and Start', () => {
    const [a, b] = BUILTIN;
    const set = () => undefined;
    const html = renderToStaticMarkup(
      <PlaySetup mine={a.file} setMine={set} opp={b.file} setOpp={set} seat="random" setSeat={set} coach setCoach={set} level="hard" setLevel={set} dA={a} dB={b} onStart={set} />,
    );
    expect(html).toContain('Play vs Bot');
    expect(html).toContain('Your deck');
    expect(html).toContain('Bot deck');
    expect(html).toContain('Start game');
    expect(html).toContain(a.deck.name);
  });
  it('the coach panel lists alternatives and warnings; the scorecard grades agreement', () => {
    const html = renderToStaticMarkup(<CoachPanel g={null as never} v={0} alts={[{ label: 'Play X', gap: '−0.5' } as never]} tips={[]} warnings={['Rival can steal 2']} />);
    expect(html).toContain('Coach also considered');
    expect(html).toContain('Play X');
    expect(html).toContain('Rival can steal 2');
    const grades = [{ verdict: 'agree' }, { verdict: 'mistake', turn: 3, chose: 'A', coach: 'B', gap: 1 }] as MoveGrade[];
    expect(renderToStaticMarkup(<Scorecard grades={grades} />)).toContain('Handled well: 1 of 2 decisions that mattered (50%)');
  });
  it('the scorecard counts close calls as fine and leaves unmeasured choices out; the toast says "close call" in words', () => {
    const g = (verdict: MoveGrade['verdict'], gap: number | null = null, se?: number): MoveGrade => ({ turn: 2, chose: 'A', coach: 'B', gap, verdict, ...(se !== undefined ? { se } : {}) });
    const grades = [g('agree', 0), g('close', 0.2, 0.15), g('inaccuracy', 0.3, 0.05), g('unscored'), g('pending')];
    const html = renderToStaticMarkup(<Scorecard grades={grades} />);
    expect(html).toContain('Handled well: 2 of 3 decisions that mattered (67%)');
    expect(html).toContain('1 was a close call (counted as handled well).');
    expect(html).toContain('2 other choices not measured (');
    expect(html).toContain('Costly moves: 1 (1 Slip)');
    // the costly move by its rating, never sized in Gigs; the footnote says what each band costs in win chance (row 6)
    expect(html).toContain('<span class="neg">Slip</span>');
    expect(html).not.toMatch(/Gig[^ ]* (lost|behind)|± [\d.]+ Gigs/);
    expect(html).toContain('Game review rates every move');
    expect(html).toContain(COACH_COST_NOTE.replace(/'/g, '&#x27;'));
    const toast = renderToStaticMarkup(<MoveToast gr={g('close', 0.1, 0.1)} />);
    // a narrow close call (under CLOSE_GIGS) is a slight preference; a wide one is too noisy to call
    expect(renderToStaticMarkup(<MoveToast gr={g('close', 0.1, 0.1)} />)).toContain('Close call: the coach slightly preferred B');
    expect(renderToStaticMarkup(<MoveToast gr={g('close', 1.6, 1.0)} />)).toBe('<span class="move-toast close" role="status"><i aria-hidden="true">○</i>Close call (too noisy to call): the coach preferred B, but its play-outs disagree</span>');
    expect(toast).toContain('○');
    // the review's names: Mistake under a whole Gig, Blunder from one
    // and what moves of the band cost in win chance, not the gap in Gigs (REVIEW_2026-11-25 row 6)
    expect(renderToStaticMarkup(<MoveToast gr={g('mistake', 0.9, 0.1)} />)).toContain(`Mistake: the coach preferred B (${coachCostWords('mistake', 0.9)})`);
    expect(renderToStaticMarkup(<MoveToast gr={g('mistake', 1.4, 0.1)} />)).toContain(`Blunder: the coach preferred B (${coachCostWords('mistake', 1.4)})`);
    expect(renderToStaticMarkup(<MoveToast gr={g('inaccuracy', 0.3, 0.05)} />)).toContain('Slip: the coach preferred B');
    const panel = renderToStaticMarkup(<CoachPanel g={null as never} v={0} alts={[{ index: 1, label: 'Sell Y', gap: 'close call', gapGigs: 0.12, close: true, se: 0.1 }]} tips={[]} warnings={[]} />);
    expect(panel).toContain('≈ close call');
    // within 0.1 Gigs of the pick (or valued higher on the review's scale): as good, not "behind by a close call"
    const asGood = renderToStaticMarkup(<CoachPanel g={null as never} v={0} alts={[{ index: 1, label: 'Sell Y', gap: 'as good', gapGigs: 0, close: true, se: 0.1 }]} tips={[]} warnings={[]} />);
    expect(asGood).toContain('≈ as good');
  });
});
