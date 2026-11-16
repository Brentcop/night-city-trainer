// The Coach switch (board setting `coach`, src/lib/boardSettings.ts): one setting for the Play setup screen's box and
// Settings' Coach switch, applied at once, also mid-game. The coach never touches the game, so a game played with the
// coach on, off, or switched during the game records the same answers and reaches the same state; grades given while it
// was on are kept (scorecard, practice log, Game review ratings, exported replay) whatever the switch says at the end;
// and resuming a save never changes the setting. Server-rendered and session-level: there is no DOM here, so the board's
// own effects are exercised through the gates and the keep function they call (coachGate.ts, coachKeep.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CARDS } from '../src/engine/cards';
import type { Decision, DeckList } from '../src/engine/types';
import { adviseRequest, coachRequest, gradeMove, scoreMoveRequest, type GradedOption } from '../src/ai/coach';
import { GIG_SWING } from '../src/ai/eval';
import { applyPatch, BOARD_SETTINGS_KEY, COACH_LABEL, defaultBoardSettings, loadBoardSettings, saveBoardSettings, type BoardSettingsPatch } from '../src/lib/boardSettings';
import { buildCoachedReplay, coachedGrade, type CoachedGrade } from '../src/lib/coachedReplay';
import { keepFinishedGrades, keepsCoachGrades } from '../src/lib/coachKeep';
import { coachRatingsFrom } from '../src/lib/gameReview';
import { loadGameReview } from '../src/lib/gameReviewStore';
import { coachSummary, loadPractice } from '../src/lib/practiceLog';
import { PracticeSession, type MatchSetup, type Running } from '../src/lib/practiceSession';
import { buildSave, type SavedGame } from '../src/lib/savedGames';
import { BUILTIN } from '../src/lib/browserLibrary';
import { setArtEnabled } from '../src/ui/art';
import { adviceWanted, gradeWanted } from '../src/ui/components/board/coachGate';
import { Scorecard } from '../src/ui/components/board/CoachPanel';
import { SettingsDialog } from '../src/ui/components/board/SettingsDialog';
import { PlaySetup } from '../src/ui/components/PlaySetup';
import { useBoardSettings, useCoachSetting } from '../src/ui/useBoardSettings';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
  setArtEnabled(false);
});
afterEach(() => vi.unstubAllGlobals());

const noop = () => undefined;

/** Every element in a rendered tree (function components are not run: their elements are walked as written). */
function elements(n: unknown, out: ReactElement[] = []): ReactElement[] {
  if (!n || typeof n !== 'object') return out;
  if (Array.isArray(n)) {
    for (const x of n) elements(x, out);
    return out;
  }
  const el = n as ReactElement<{ children?: ReactNode }>;
  if (el.props) {
    out.push(el);
    elements(el.props.children, out);
  }
  return out;
}
const textOf = (n: unknown): string => (typeof n === 'string' ? n : Array.isArray(n) ? n.map(textOf).join('') : n && typeof n === 'object' && 'props' in n ? textOf((n as ReactElement<{ children?: ReactNode }>).props.children) : '');

describe('Coach switch: the setup screen and Settings edit one setting', () => {
  /**
   * The Play page's wiring (src/ui/pages/Play.tsx PracticePlay): the setup screen's box gets useCoachSetting(), the
   * dialog gets useBoardSettings() and `hasCoach`. Renders both from the shared store and hands back their controls.
   */
  function both() {
    let setupBox: { checked: boolean; onChange: (e: { target: { checked: boolean } }) => void } | null = null;
    let dialogCheck: { checked: boolean; onChange: (on: boolean) => void } | null = null;
    function Probe() {
      const [coach, setCoach] = useCoachSetting();
      const [settings, update] = useBoardSettings();
      const [a, b] = BUILTIN;
      const setup = PlaySetup({ mine: a!.file, setMine: noop, opp: b!.file, setOpp: noop, seat: 'random', setSeat: noop, coach, setCoach, level: 'hard', setLevel: noop, dA: a, dB: b, onStart: noop });
      const dialog = SettingsDialog({ settings, onChange: update, onReset: noop, speed: 1200, setSpeed: noop, hasCoach: true, onClose: noop });
      for (const el of elements(setup)) {
        if (el.type !== 'label') continue;
        if (!textOf(el.props.children).startsWith('Coach mode')) continue;
        const input = elements(el.props.children).find((x) => x.type === 'input');
        setupBox = input!.props as never;
      }
      for (const el of elements(dialog)) {
        const p = el.props as { label?: string; onChange?: unknown };
        if (p.label === COACH_LABEL && typeof p.onChange === 'function') dialogCheck = p as never;
      }
      return null;
    }
    renderToStaticMarkup(createElement(Probe));
    expect(setupBox).not.toBeNull();
    expect(dialogCheck).not.toBeNull();
    return { setupBox: setupBox!, dialogCheck: dialogCheck! };
  }

  it('both show the setting, and a change made in either shows in both and is remembered in this browser', () => {
    // start from the default (on)
    resetBoardSettings();
    let c = both();
    expect([c.setupBox.checked, c.dialogCheck.checked]).toEqual([true, true]);
    // off from the setup screen: the dialog shows it off, and it is stored
    c.setupBox.onChange({ target: { checked: false } });
    c = both();
    expect([c.setupBox.checked, c.dialogCheck.checked]).toEqual([false, false]);
    expect(JSON.parse(store.get(BOARD_SETTINGS_KEY)!).coach).toBe(false);
    expect(loadBoardSettings().coach).toBe(false);
    // on again from Settings: the setup screen shows it on
    c.dialogCheck.onChange(true);
    c = both();
    expect([c.setupBox.checked, c.dialogCheck.checked]).toEqual([true, true]);
    expect(JSON.parse(store.get(BOARD_SETTINGS_KEY)!).coach).toBe(true);
  });

  it('a board without a coach shows no switch: online play, multi-day games against a person, tutorial lessons', () => {
    // the dialog shows the switch only when told a coach exists (tests/settings-dialog.test.tsx checks the markup)
    const html = (hasCoach?: boolean) => renderToStaticMarkup(<SettingsDialog settings={defaultBoardSettings()} onChange={noop} onReset={noop} speed={0} hasCoach={hasCoach} onClose={noop} />);
    expect(html()).not.toContain('<legend>Coach</legend>');
    expect(html(false)).not.toContain('<legend>Coach</legend>');
    expect(html(true)).toContain('<legend>Coach</legend>');
    // the boards that have no coach say so, and online play's own Settings dialog is not told of one
    for (const f of ['src/ui/pages/PlayOnline.tsx', 'src/ui/pages/PlayCorr.tsx', 'src/ui/pages/Tutorial.tsx']) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).toMatch(/coach=\{false\}/);
      expect(src, f).not.toMatch(/hasCoach/);
    }
    // the Play board offers the switch only for a game against the bot
    const play = readFileSync('src/ui/pages/Play.tsx', 'utf8');
    expect(play).toContain('hasCoach={coachHere && !online && !tutorial}');
  });
});

/** Reset the shared settings store (module state in src/ui/useBoardSettings.ts) to the defaults. */
function resetBoardSettings() {
  let reset: (() => void) | null = null;
  function R() {
    reset = useBoardSettings()[2];
    return null;
  }
  renderToStaticMarkup(createElement(R));
  reset!();
}

// ---- a practice game with the coach on, off and switched mid-game ----

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];
const setup = (seed: number): MatchSetup => ({ decks, seed, first: 0, level: 'easy', botSeed: 4242 });

async function finish(session: PracticeSession): Promise<Running> {
  for (;;) {
    const r = session.current!;
    await r.done;
    if (session.current === r) return r;
  }
}

/** A deterministic player: the answer depends only on the decision and how many answers came before (never on the coach). */
function choose(run: Running, d: Decision): number {
  if (d.kind === 'yesno' && d.tag === 'mulligan') return 1;
  if (d.kind === 'pay') return 0;
  return (run.replay.choices.length * 7 + run.g.s.turn * 3) % d.options.length;
}

/** Drive the session's games: `hook` sees each new decision of yours first, then the answer is given. */
function drive(session: PracticeSession, hook: (run: Running, d: Decision) => Promise<void>) {
  let last: Decision | null = null;
  return session.subscribe(() => {
    const run = session.current;
    const d = run?.human.pending?.d;
    if (!run || !d || d === last) return;
    last = d;
    setTimeout(async () => {
      if (run !== session.current || run.human.pending?.d !== d) return;
      await hook(run, d);
      if (run !== session.current || run.human.pending?.d !== d) return;
      run.human.answer(d, choose(run, d));
    }, 0);
  });
}

/**
 * One game, the coach switched by `coachAt(k)` (k = answers given so far), handled as the board does: advice asked
 * only while the coach is on (adviceWanted), the move graded only when that advice is showing (gradeWanted), a move the
 * coach did not value scored in its worlds. The coach runs in this process, on its own snapshot (coachRequest), as the
 * worker does.
 */
async function playWith(coachAt: (k: number) => boolean, seed = 31) {
  const session = new PracticeSession();
  let asked = 0;
  let skipped = 0;
  drive(session, async (run, d) => {
    const k = run.replay.choices.length;
    const on = coachAt(k);
    if (!adviceWanted(d, true, 'auto')) return;
    if (!adviceWanted(d, on, 'auto')) {
      skipped++;
      return;
    }
    asked++;
    const advice = await adviseRequest(coachRequest(run.g, d));
    const i = choose(run, d);
    // the advice is showing when you answer (the board's activeHint is for this decision)
    if (!gradeWanted(d, coachAt(k), d)) return;
    const gr = coachedGrade(d, i, advice, gradeMove(d, i, advice, run.g.s.turn), k);
    run.grades.push(gr);
    if (gr.verdict === 'pending') {
      const extra: GradedOption[] = await scoreMoveRequest({ req: coachRequest(run.g, d), chosen: i, coach: advice.index, grade: advice.grade }).catch(() => []);
      run.grades[run.grades.indexOf(gr)] = coachedGrade(d, i, advice, gradeMove(d, i, advice, gr.turn, extra), k, extra);
    }
  });
  session.start(setup(seed));
  const run = await finish(session);
  return {
    run,
    grades: JSON.parse(JSON.stringify(run.grades)) as CoachedGrade[],
    choices: JSON.parse(JSON.stringify(run.replay.choices)) as number[][],
    seed: run.replay.seed,
    botSeed: run.replay.botSeed,
    result: run.replay.result,
    state: JSON.stringify(run.g.s),
    asked,
    skipped,
  };
}

describe('Coach switch: the game is the same with the coach on, off or switched mid-game', () => {
  // on for the first answers, off, on again, then off to the end of the game
  const toggledAt = (k: number) => k < 8 || (k >= 18 && k < 26);

  it('same answers, seeds, result and final state; grades only where the coach was on, and kept when it ends off', async () => {
    const on = await playWith(() => true);
    const off = await playWith(() => false);
    const toggled = await playWith(toggledAt);

    // the record and the game: identical
    expect(off.choices).toEqual(on.choices);
    expect(toggled.choices).toEqual(on.choices);
    expect([off.seed, off.botSeed, off.result]).toEqual([on.seed, on.botSeed, on.result]);
    expect([toggled.seed, toggled.botSeed, toggled.result]).toEqual([on.seed, on.botSeed, on.result]);
    expect(off.state).toBe(on.state);
    expect(toggled.state).toBe(on.state);

    // grades: none with the coach off; with it switched, exactly the moves graded while it was on (the coach answers a
    // position the same way whenever it is asked)
    expect(off.grades).toEqual([]);
    expect(off.asked).toBe(0);
    expect(on.grades.length).toBeGreaterThan(10);
    expect(toggled.skipped).toBeGreaterThan(0);
    expect(toggled.grades.length).toBeGreaterThan(0);
    expect(toggled.grades.length).toBeLessThan(on.grades.length);
    expect(toggled.grades).toEqual(on.grades.filter((g) => toggledAt(g.record!.at)));
    // graded before it was turned off, and again after it was turned back on
    expect(toggled.grades.some((g) => g.record!.at < 8)).toBe(true);
    expect(toggled.grades.some((g) => g.record!.at >= 18)).toBe(true);
    // the game went on past the last switch, so it ended with the coach off
    expect(on.choices.length).toBeGreaterThan(26);
    expect(toggledAt(on.choices.length)).toBe(false);

    // the end of the game with the coach off now but used earlier: the board keeps every graded move (Play.tsx's
    // game-over effect: keepsCoachGrades, then keepFinishedGrades)
    const id = toggled.run.replay.id;
    expect(loadPractice().find((x) => x.id === id)).toBeTruthy();
    expect(keepsCoachGrades(true, toggled.grades.length)).toBe(true);
    keepFinishedGrades(id, toggled.run.grades, toggled.run.replay.choices, GIG_SWING);
    const sum = coachSummary(toggled.grades);
    expect(sum && sum.measured).toBeGreaterThan(0);
    // the practice log's scorecard (the Profile's coach averages)
    expect(loadPractice().find((x) => x.id === id)!.coach).toEqual({ fine: sum!.fine, measured: sum!.measured, grade: sum!.grade });
    // the coach's ratings kept for a Game review run later
    const ratings = coachRatingsFrom(toggled.grades.map((x) => x.record), toggled.choices.length, GIG_SWING);
    expect(ratings.length).toBeGreaterThan(0);
    expect(loadGameReview(id, toggled.choices)?.coach).toEqual(ratings);
    // the end-of-game scorecard shows them (it never reads the switch)
    expect(renderToStaticMarkup(<Scorecard grades={toggled.grades} />)).toContain(`${sum!.measured} measured move`);
    // the exported coached replay carries every graded move
    const exported = buildCoachedReplay(toggled.run.replay, toggled.run.grades, '2026-11-16T10:00:00Z', GIG_SWING);
    expect(exported.decisions.map((x) => x.at)).toEqual(toggled.grades.map((g) => g.record!.at));

    // a game the coach never saw keeps nothing and shows no scorecard, as before
    expect(keepsCoachGrades(false, off.grades.length)).toBe(false);
    expect(loadPractice().find((x) => x.id === off.run.replay.id)!.coach).toBeUndefined();
    expect(loadGameReview(off.run.replay.id)).toBeNull();
    expect(renderToStaticMarkup(<Scorecard grades={off.grades} />)).toBe('');
    expect(buildCoachedReplay(off.run.replay, off.run.grades, '2026-11-16T10:00:00Z', GIG_SWING).decisions).toEqual([]);
  }, 300_000);
});

describe('Coach switch: the board asks and grades only while the coach is on', () => {
  const action = (n: number): Decision =>
    ({ player: 0, kind: 'action', prompt: 'Your move', options: Array.from({ length: n }, (_, i) => ({ label: i ? `Play ${i}` : 'End turn', action: i ? { type: 'play', uid: i } : { type: 'pass' } })), min: 1, max: 1 }) as unknown as Decision;
  const pay = { player: 0, kind: 'pay', prompt: 'Pay', options: [{ label: 'A' }, { label: 'B' }], min: 1, max: 1 } as unknown as Decision;

  it('off: nothing is asked or graded; on: the decision waiting is asked about, and graded once its advice shows', () => {
    const d = action(3);
    expect(adviceWanted(d, true, 'auto')).toBe(true);
    // switched off: no advice for any decision, no grade even with advice on screen
    expect(adviceWanted(d, false, 'auto')).toBe(false);
    expect(gradeWanted(d, false, d)).toBe(false);
    // on: graded only when the advice on screen is for this very decision
    expect(gradeWanted(d, true, d)).toBe(true);
    expect(gradeWanted(d, true, null)).toBe(false);
    expect(gradeWanted(d, true, action(3))).toBe(false);
    // as before: nothing to ask about with no decision, a lone End turn, or a cost the automatic payment answers
    expect(adviceWanted(null, true, 'auto')).toBe(false);
    expect(adviceWanted(action(1), true, 'auto')).toBe(false);
    expect(adviceWanted(pay, true, 'auto')).toBe(false);
  });
});

describe('Coach switch: resuming a save never changes the setting', () => {
  async function saveAt(coach: boolean): Promise<SavedGame> {
    const a = new PracticeSession();
    let save: SavedGame | null = null;
    await new Promise<void>((resolve) => {
      drive(a, async (run) => {
        if (save || run.replay.choices.length < 8 || !run.stable) return;
        save = buildSave({ replay: run.replay, grades: run.grades, stable: run.stable, log: run.g.s.log }, { id: 'auto', saved: '2026-11-16T10:00:00Z', coach });
        resolve();
      });
      a.start(setup(41));
    });
    a.quit();
    return save!;
  }

  it('a save made with the coach off resumes with it on when the setting says on, and the other way round', async () => {
    for (const [inSave, setting] of [
      [false, true],
      [true, false],
    ] as const) {
      const save = await saveAt(inSave);
      // the save still records the coach (schema 1 unchanged)
      expect(save.coach).toBe(inSave);
      expect(save.schema).toBe(1);
      saveBoardSettings(applyPatch(defaultBoardSettings(), { coach: setting } satisfies BoardSettingsPatch));
      const before = store.get(BOARD_SETTINGS_KEY);
      const b = new PracticeSession();
      expect((await b.restore(save)).ok).toBe(true);
      b.quit();
      expect(store.get(BOARD_SETTINGS_KEY)).toBe(before);
      expect(loadBoardSettings().coach).toBe(setting);
    }
  }, 120_000);

  it('the Play page sets the coach from the setting only, never from a save or a multi-day game', () => {
    const play = readFileSync('src/ui/pages/Play.tsx', 'utf8');
    // the old per-game state and the resume handlers that copied a save's flag into it are gone
    expect(play).not.toMatch(/setCoach\(\s*[\w.]*\.coach\s*\)/);
    expect(play).not.toMatch(/useState\(true\);\s*\n\s*const coach = /);
    expect(play).toContain('const [coachSetting, setCoach] = useCoachSetting();');
    expect(play).toContain('const coach = coachOn && coachSetting;');
    // the board reads the setting itself, so a change applies mid-game
    expect(play).toContain('const coach = coachHere && settings.coach;');
  });
});
