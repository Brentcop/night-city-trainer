// PLAY-20 parts 4–5: the Play page's setup screen and coach panel moved out of Play.tsx (src/ui/components/PlaySetup.tsx,
// src/ui/components/board/CoachPanel.tsx); the review request helpers moved to src/lib/practiceReplays.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { practiceRequest, reviewExpect, type PracticeReplay } from '../src/lib/practiceReplays';
import { PlaySetup } from '../src/ui/components/PlaySetup';
import { CoachPanel, Scorecard } from '../src/ui/components/board/CoachPanel';
import { BUILTIN } from '../src/lib/browserLibrary';
import { setArtEnabled } from '../src/ui/art';
import type { MoveGrade } from '../src/ai/coach';

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
    const grades = [{ verdict: 'agree' }, { verdict: 'miss', turn: 3, chose: 'A', coach: 'B', gap: 1 }] as MoveGrade[];
    expect(renderToStaticMarkup(<Scorecard grades={grades} />)).toContain('1 of 2 decisions matched the coach (50%)');
  });
});
