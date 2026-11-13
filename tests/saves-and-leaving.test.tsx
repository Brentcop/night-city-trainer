// Saved and multi-day games kept safe (review 2026-11-13, APP-1…6, APP-9, UX-10): resuming asks before it replaces
// another game's autosave or a recorded result; Exit keeps the game by default; storage refusals are reported and never
// cost a game its record; Rematch replays the game just played; Delete works for every list; games from another
// version are counted nowhere and said plainly; saved games off writes no autosave.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '../src/engine/types';
import { BUILTIN } from '../src/lib/browserLibrary';
import {
  AUTOSAVE_REFUSED,
  GameKeeper,
  MULTIDAY_REFUSED,
  RECORD_REFUSED,
  RECORD_REFUSED_MD,
  removeUnresumable,
} from '../src/lib/gameKeeper';
import { botEntry, botItem, loadBotGames, sortOngoing, writeBotGame, type OngoingItem } from '../src/lib/multiDay';
import { BOT_GAMES_KEY, CORR_GAMES_KEY, ongoingWaiting } from '../src/lib/ongoingBadge';
import { loadPractice } from '../src/lib/practiceLog';
import type { PracticeReplay } from '../src/lib/practiceReplays';
import { rematchOf, type Running } from '../src/lib/practiceSession';
import { addSlot, loadAutosave, loadSlots, replacesAutosave, versionProblem, writeAutosave, type SavedGame } from '../src/lib/savedGames';
import { SIM_VERSION } from '../src/lib/tournament';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import { tierLabel } from '../src/ai/tiers';
import { setArtEnabled } from '../src/ui/art';
import { OngoingGames } from '../src/ui/components/OngoingGames';
import { ResumeConfirm, UnresumableDialog, UNRESUMABLE_NOTE } from '../src/ui/components/SavedGames';

// the dialogs render into a portal at <body>; there is no DOM here, so render them in place
vi.mock('react-dom', async (orig) => ({ ...(await orig<typeof import('react-dom')>()), createPortal: (n: React.ReactNode) => n }));
const { EXIT_DISCARD_TEXT, EXIT_KEEP_TEXT, LeaveDialog } = await import('../src/ui/components/board/Overlays');

/** Storage in memory; keys in `refuse` throw on write (storage full). */
const store = new Map<string, string>();
const refuse = new Set<string>();
beforeEach(() => {
  store.clear();
  refuse.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (refuse.has(k)) throw new Error('QuotaExceededError');
      store.set(k, String(v));
    },
    removeItem: (k: string) => void store.delete(k),
  });
  setArtEnabled(false);
});
afterEach(() => vi.unstubAllGlobals());

const [A, B] = BUILTIN;
const save = (o: Partial<SavedGame> = {}): SavedGame => ({
  kind: 'nct-saved-game',
  schema: 1,
  id: 'auto',
  name: 'My game',
  saved: '2026-11-12T10:00:00Z',
  simVersion: SIM_VERSION,
  replayId: 'p1',
  started: '2026-11-12T09:00:00Z',
  decks: [A!.deck, B!.deck],
  seed: 1,
  botLevel: 'hard',
  botSeed: 2,
  choices: [[0]],
  coach: true,
  grades: [],
  check: { at: 1, turn: 3, hash: 'x', decision: { kind: 'action', prompt: 'Choose an action', options: ['End turn'] } },
  turn: 3,
  gigs: [1, 0],
  log: [{ turn: 1, player: 0, text: 'You keep your hand' }],
  ...o,
});

/** A running game at one of your decisions (what the keeper reads of it). */
function run(id: string): Running {
  const replay: PracticeReplay = { id, date: '2026-11-13T09:00:00Z', decks: [A!.deck, B!.deck], seed: 5, botLevel: 'hard', botSeed: 7, choices: [[0]], payChoice: true, orderChoice: true, result: 'draw' };
  return {
    replay,
    grades: [],
    cancelled: false,
    restoring: false,
    error: null,
    conceded: false,
    g: { s: { winner: null, first: 0, log: [] } },
    stable: { at: 1, turn: 2, hash: 'h', decision: { kind: 'action', prompt: 'Choose an action', options: ['End turn'] }, gigs: [0, 0] },
  } as unknown as Running;
}
const over = { winner: 0, turn: 9, winReason: 'Reached 7 Gigs', first: 0, players: [{ gigs: [1, 2, 3, 4, 5, 6, 7] }, { gigs: [1] }] } as unknown as GameState;

function keeper(saves = true) {
  const problems: string[] = [];
  const k = new GameKeeper({ coach: () => true, saves: () => saves, now: () => Date.parse('2026-11-13T10:00:00Z'), onProblem: (t) => problems.push(t) });
  return { k, problems };
}
const T0 = Date.parse('2026-11-13T09:00:00Z');
const mdOf = (k: GameKeeper, id: string) => (k.md = { replayId: id, days: 7, created: T0, deadline: T0 + 7 * 86_400_000, late: false });

describe('APP-1 and APP-5: resuming a save asks first when it would replace something', () => {
  it('a named save of another game would replace the autosave; the autosave itself, or a slot of the same game, would not', () => {
    const auto = save();
    expect(replacesAutosave(auto, save({ id: 's1', replayId: 'p2' }))).toBe(true);
    expect(replacesAutosave(auto, save({ id: 's1', replayId: 'p1' }))).toBe(false);
    expect(replacesAutosave(auto, auto)).toBe(false);
    expect(replacesAutosave(null, save({ id: 's1', replayId: 'p2' }))).toBe(false);
  });

  it('the question names the unfinished game, offers to keep it in a slot first, and says when a recorded result would be replaced', () => {
    const html = renderToStaticMarkup(
      <ResumeConfirm
        save={save({ id: 's1', replayId: 'p2', name: 'Slot game' })}
        replaces={save()}
        finished={{ result: 'win', date: '2026-11-12T12:00:00Z' }}
        slotFree
        onKeepAndResume={() => undefined}
        onResume={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(html).toContain('Resume this save?');
    expect(html).toContain(`Your unfinished game (${A!.deck.name} vs ${B!.deck.name} · Hard · turn 3`);
    expect(html).toContain('can’t be resumed afterwards unless you keep it in a save slot first.');
    expect(html).toContain('Keep it in a slot, then resume');
    expect(html).toContain('Resume and replace it');
    expect(html).toContain('You already finished this game (win');
    expect(html).toContain('the new result replaces that one in your history and profile');
    // with every slot in use there is nothing to keep it in: the one choice is the red one
    const full = renderToStaticMarkup(<ResumeConfirm save={save({ id: 's1', replayId: 'p2' })} replaces={save()} finished={null} slotFree={false} onKeepAndResume={() => undefined} onResume={() => undefined} onCancel={() => undefined} />);
    expect(full).toContain('All 5 save slots are in use');
    expect(full).not.toContain('Keep it in a slot');
    expect(full).toMatch(/class="pb-danger"[^>]*>Resume and replace it/);
  });
});

describe('UX-10: Exit keeps the game by default', () => {
  // the dialog names document.body as its portal's home (rendered in place here)
  beforeEach(() => void vi.stubGlobal('document', { body: {} }));
  it('"Save and exit" comes first and is the main button; "Exit and discard" is the second, red one', () => {
    const html = renderToStaticMarkup(<LeaveDialog kind="exit" onConfirm={() => undefined} onCancel={() => undefined} onKeep={() => undefined} />);
    expect(html).toContain(EXIT_KEEP_TEXT);
    expect(EXIT_KEEP_TEXT).toMatch(/Resume game on the Play screen brings it back/);
    expect(html.indexOf('Save and exit')).toBeLessThan(html.indexOf('Exit and discard'));
    expect(html).toMatch(/class="primary"[^>]*>Save and exit/);
    expect(html).toMatch(/class="pb-danger"[^>]*>Exit and discard/);
    expect(html).toContain('Keep playing');
  });
  it('without a way to keep it (saved games off, storage blocked) Exit says the game ends unrecorded; a multi-day game keeps its own note', () => {
    const plain = renderToStaticMarkup(<LeaveDialog kind="exit" onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(plain).toContain(EXIT_DISCARD_TEXT);
    expect(plain).not.toContain('Save and exit');
    const md = renderToStaticMarkup(<LeaveDialog kind="exit" note="It stays in Ongoing games." onConfirm={() => undefined} onCancel={() => undefined} onKeep={() => undefined} />);
    expect(md).toContain('It stays in Ongoing games.');
    expect(md).not.toContain('Exit and discard');
    // Concede is unchanged
    expect(renderToStaticMarkup(<LeaveDialog kind="concede" onConfirm={() => undefined} onCancel={() => undefined} onKeep={() => undefined} />)).toContain('⚑ Concede');
  });
  it('"Save and exit" leaves the autosave in place; "Exit and discard" removes it', () => {
    const { k } = keeper();
    const r = run('pA');
    expect(k.store(r)).toBe(true);
    expect(loadAutosave()?.replayId).toBe('pA');
    // leave(): store, then quit keeping the save (no onClosed): it is still there
    expect(loadAutosave()?.replayId).toBe('pA');
    k.closed(r, 'quit');
    expect(loadAutosave()).toBeNull();
  });
});

describe('APP-2: storage refusals are reported, and never cost a game its record', () => {
  it('a refused autosave is reported once (until a write works again)', () => {
    const { k, problems } = keeper();
    refuse.add('nct.autosave.v1');
    expect(k.store(run('pA'))).toBe(false);
    expect(k.store(run('pA'))).toBe(false);
    expect(problems).toEqual([AUTOSAVE_REFUSED]);
    refuse.clear();
    expect(k.store(run('pA'))).toBe(true);
    refuse.add('nct.autosave.v1');
    k.store(run('pA'));
    expect(problems).toEqual([AUTOSAVE_REFUSED, AUTOSAVE_REFUSED]);
  });
  it('a refused multi-day save is reported', () => {
    const { k, problems } = keeper();
    mdOf(k, 'pM');
    refuse.add(BOT_GAMES_KEY);
    expect(k.store(run('pM'))).toBe(false);
    expect(problems).toEqual([MULTIDAY_REFUSED]);
  });
  it('a finished multi-day game stays in Ongoing games when its record was refused, and goes once it is recorded', () => {
    const { k, problems } = keeper();
    mdOf(k, 'pM');
    const r = run('pM');
    expect(k.store(r)).toBe(true);
    expect(loadBotGames().map((e) => e.id)).toEqual(['pM']);
    refuse.add('nct.practice.v1');
    expect(k.record(r.replay, over)).toBe(false);
    k.closed(r, 'finished');
    expect(problems).toEqual([RECORD_REFUSED_MD]);
    expect(loadBotGames().map((e) => e.id)).toEqual(['pM']);
    refuse.clear();
    expect(k.record(r.replay, over)).toBe(true);
    k.closed(r, 'finished');
    expect(loadBotGames()).toEqual([]);
    expect(loadPractice()[0]).toMatchObject({ id: 'pM', result: 'win', multiDay: { days: 7 } });
  });
  it("a quick game's autosave is kept when its record was refused", () => {
    const { k, problems } = keeper();
    const r = run('pQ');
    k.store(r);
    refuse.add('nct.practiceReplays.v1');
    k.record(r.replay, over);
    k.closed(r, 'conceded');
    expect(problems).toEqual([RECORD_REFUSED]);
    expect(loadAutosave()?.replayId).toBe('pQ');
  });
});

describe('APP-9: with saved games off no autosave is written', () => {
  it('a quick game writes nothing; a multi-day game still keeps its own entry', () => {
    const { k } = keeper(false);
    expect(k.store(run('pA'))).toBe(true);
    expect(store.has('nct.autosave.v1')).toBe(false);
    mdOf(k, 'pM');
    k.store(run('pM'));
    expect(loadBotGames().map((e) => e.id)).toEqual(['pM']);
  });
});

describe('APP-3: Rematch replays the game just played', () => {
  it("its decks, tier and seat rule (a random seat stays random), new seeds and today's End turn setting", () => {
    const decks = [A!.deck, B!.deck] as [typeof A.deck, typeof B.deck];
    expect(rematchOf({ decks, botLevel: 'easy', first: 1 }, { endTurnClick: true, seed: 11, botSeed: 12 })).toEqual({ decks, seed: 11, first: 1, level: 'easy', botSeed: 12, endTurnClick: true });
    const random = rematchOf({ decks, botLevel: 'medium', first: undefined }, { endTurnClick: false, seed: 1, botSeed: 2 });
    expect(random).toEqual({ decks, seed: 1, level: 'medium', botSeed: 2 });
    expect('first' in random).toBe(false);
  });
});

describe('APP-4: Delete in the can’t-resume dialog removes the save from its own list', () => {
  it('the autosave, a slot, or a multi-day game', () => {
    writeAutosave(save());
    addSlot(save({ id: 's1' }));
    writeBotGame(botEntry({ days: 7, created: T0, deadline: T0 + 7 * 86_400_000, late: false }, save({ id: 'md', replayId: 'pM' }), T0));
    removeUnresumable('md', 'pM');
    expect(loadBotGames()).toEqual([]);
    removeUnresumable('slot', 's1');
    expect(loadSlots()).toEqual([]);
    removeUnresumable('auto', 'auto');
    expect(loadAutosave()).toBeNull();
  });
});

describe('APP-6 and version-7 saves: games that can’t be played are counted nowhere and said plainly', () => {
  const old = save({ id: 'md', replayId: 'pOld', simVersion: SIM_VERSION - 1 });
  it('the Play tab counts only resumable bot games and person games that are neither over nor refused', () => {
    expect(CURRENT_SIM_VERSION).toBe(SIM_VERSION);
    writeBotGame(botEntry({ days: 7, created: T0, deadline: T0 + 7 * 86_400_000, late: false }, save({ id: 'md', replayId: 'pNow' }), T0));
    writeBotGame(botEntry({ days: 7, created: T0, deadline: T0 + 7 * 86_400_000, late: false }, old, T0));
    store.set(
      CORR_GAMES_KEY,
      JSON.stringify([
        { stage: 'playing', summary: { yourMove: true } },
        { stage: 'refused', summary: { yourMove: true } },
        { stage: 'over', summary: { yourMove: true } },
        { stage: 'playing', summary: { yourMove: false } },
      ]),
    );
    expect(ongoingWaiting()).toBe(2);
  });
  it('an old game is not "your move", sorts last, and its row reads its log (never resumes); the count leaves it out', () => {
    const e = botEntry({ days: 3, created: T0, deadline: T0 + 3 * 86_400_000, late: false }, old, T0);
    const it = botItem(e, T0 + 4 * 86_400_000, tierLabel);
    expect(it.yourMove).toBe(false);
    expect(it.stale).toBeTruthy();
    expect(it.status).toBe(`Saved with version ${SIM_VERSION - 1}: can't be resumed on this version (${SIM_VERSION}); you can read its log, export it or delete it; its deadline has passed, so you can also close it as a loss on time`);
    const fresh: OngoingItem = { ...it, key: 'b', id: 'b', stale: undefined, yourMove: true, expired: false };
    expect(sortOngoing([it, fresh]).map((x) => x.id)).toEqual(['b', e.id]);
    const html = renderToStaticMarkup(
      <OngoingGames items={[it, fresh]} now={T0} storage cap={8} onOpen={() => undefined} onFinishLate={() => undefined} onCloseTimedOut={() => null} onExport={() => undefined} onDelete={() => undefined} onImport={() => null} />,
    );
    expect(html).toContain('(1 of 8)');
    expect(html).toContain('Read the log');
    expect(html).toContain('Close as a timed-out loss');
    expect(html).not.toContain('Finish it anyway');
  });
  it('the can’t-resume dialog says why, that nothing changes, and offers the log and Delete', () => {
    expect(versionProblem(old)).toBe(
      `It was saved with version ${SIM_VERSION - 1} of the bots and rules engine. This app now runs version ${SIM_VERSION}, and the bots or rules changed in between, so the same moves would no longer lead to the same game.`,
    );
    const html = renderToStaticMarkup(<UnresumableDialog save={old} why={versionProblem(old)!} deleteLabel="Delete this game" onDelete={() => undefined} onClose={() => undefined} />);
    expect(html).toContain('This game can&#x27;t be resumed');
    expect(html).toContain(UNRESUMABLE_NOTE.replace(/'/g, '&#x27;'));
    expect(html).toContain('Open the game log');
    expect(html).toContain('Delete this game');
    expect(versionProblem({ simVersion: SIM_VERSION + 1 })).toMatch(/newer than this app/);
  });
});
