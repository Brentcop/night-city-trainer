// Multi-day games against the bot and the Ongoing games list (src/lib/multiDay.ts): a game saved in its own list,
// restored days later (an injected clock, no waiting) and played on identically, with the autosave left alone; expiry
// (never deleted: finish late or close as a timed-out loss); the list's order; the one-game file; the cap; the panel
// and the setup choice as rendered.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { tierLabel } from '../src/ai/tiers';
import { CARDS } from '../src/engine/cards';
import type { Decision, DeckList } from '../src/engine/types';
import { BUILTIN } from '../src/lib/browserLibrary';
import {
  botEntry,
  botExpired,
  botItem,
  botMark,
  capProblem,
  clampDays,
  DAY_MS,
  deadlineFrom,
  loadBotGames,
  ongoingFileName,
  ongoingFileText,
  parseOngoingFile,
  removeBotGame,
  sortOngoing,
  timedOutRecords,
  timeLeftText,
  writeBotGame,
  type OngoingItem,
} from '../src/lib/multiDay';
import { ongoingWaiting } from '../src/lib/ongoingBadge';
import { loadPractice, parsePractice, recordPractice } from '../src/lib/practiceLog';
import { parseReplays, practiceSpec, type PracticeReplay } from '../src/lib/practiceReplays';
import { PracticeSession, type MatchSetup, type Running } from '../src/lib/practiceSession';
import { buildSave, loadAutosave, type SavedGame } from '../src/lib/savedGames';
import { stateHash } from '../src/lib/stateHash';
import { GameKeeper } from '../src/lib/gameKeeper';
import { Game } from '../src/engine/engine';
import { checkReplayed, practiceAgents, replayedEnd } from '../src/sim/practiceReview';
import { setArtEnabled } from '../src/ui/art';
import { OngoingGames, MULTI_DAY_NOTE } from '../src/ui/components/OngoingGames';
import { PlaySetup } from '../src/ui/components/PlaySetup';
import { CORR_TRUST, PlayCorr } from '../src/ui/pages/PlayCorr';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];
const setup = (seed: number): MatchSetup => ({ decks, seed, first: 0, level: 'medium', botSeed: 4242 });

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

const T0 = Date.parse('2026-11-12T10:00:00.000Z');
const HOUR = 3_600_000;

function choose(run: Running, d: Decision): number {
  if (d.kind === 'yesno' && d.tag === 'mulligan') return 1;
  const k = run.replay.choices.length;
  return (k * 7 + run.g.s.turn * 3) % d.options.length;
}
function drive(session: PracticeSession, hook: (run: Running, d: Decision) => boolean | void) {
  let last: Decision | null = null;
  return session.subscribe(() => {
    const run = session.current;
    const d = run?.human.pending?.d;
    if (!run || !d || d === last) return;
    last = d;
    setTimeout(() => {
      if (run !== session.current || run.human.pending?.d !== d) return;
      if (hook(run, d)) return;
      run.human.answer(d, choose(run, d));
    }, 0);
  });
}
const saveOf = (run: Running) => buildSave({ replay: run.replay, grades: run.grades, stable: run.stable, log: run.g.s.log }, { id: 'md', saved: '2026-11-12T11:00:00Z', coach: false })!;

/** A game played to your 12th decision and kept as a 7-day multi-day game started at T0. */
async function keptGame(): Promise<{ save: SavedGame; statesAfter: string[] }> {
  const a = new PracticeSession();
  const statesAfter: string[] = [];
  let save: SavedGame | null = null;
  await new Promise<void>((resolve) => {
    drive(a, (run) => {
      const k = run.replay.choices.length;
      if (k === 12) save = saveOf(run);
      if (k >= 12) statesAfter.push(JSON.stringify(run.g.s));
      if (statesAfter.length > 10 || run.g.s.winner !== null) {
        resolve();
        return true;
      }
      return false;
    });
    a.start(setup(31));
  });
  a.quit();
  return { save: save!, statesAfter };
}

describe('a multi-day game against the bot', () => {
  it('kept in its own list, restored three days later and played on identically; the autosave is untouched', async () => {
    const { save, statesAfter } = await keptGame();
    const e = botEntry({ days: 7, created: T0, deadline: deadlineFrom(T0, 7), late: false, wentFirst: true }, save, T0 + 2 * HOUR);
    expect(writeBotGame(e)).toBeNull();
    expect(loadAutosave()).toBeNull();
    expect(ongoingWaiting()).toBe(1);
    // three days later
    const now = T0 + 3 * DAY_MS;
    const [back] = loadBotGames();
    expect(back).toEqual(e);
    expect(botExpired(back!, now)).toBe(false);
    const item = botItem(back!, now, tierLabel);
    expect(item).toMatchObject({ type: 'bot', yourMove: true, expired: false, status: 'Your move', turn: save.turn });
    expect(timeLeftText(item, now)).toBe('4 days left');
    const b = new PracticeSession();
    const statesB: string[] = [];
    const done = new Promise<void>((resolve) => {
      drive(b, (run) => {
        statesB.push(JSON.stringify(run.g.s));
        if (statesB.length >= statesAfter.length || run.g.s.winner !== null) {
          resolve();
          return true;
        }
        return false;
      });
    });
    const r = await b.restore(back!.save);
    expect(r.ok).toBe(true);
    expect(b.current!.replay.id).toBe(e.id);
    await done;
    expect(statesB).toEqual(statesAfter);
    b.quit();
  }, 60_000);

  it('past its deadline it is marked "time is up", never removed; finishing late is marked; closing records a timed-out loss', async () => {
    const { save } = await keptGame();
    const e = botEntry({ days: 3, created: T0, deadline: deadlineFrom(T0, 3), late: false }, save, T0 + HOUR);
    writeBotGame(e);
    const now = T0 + 3 * DAY_MS + HOUR;
    const [kept] = loadBotGames();
    expect(botExpired(kept!, now)).toBe(true);
    const item = botItem(kept!, now, tierLabel);
    expect(item).toMatchObject({ expired: true, yourMove: true, status: expect.stringMatching(/deadline passed/) });
    expect(timeLeftText(item, now)).toBe('Time is up');
    // finish it anyway: no longer "expired", recorded late
    const late = botEntry({ days: 3, created: T0, deadline: deadlineFrom(T0, 3), late: true }, save, now);
    expect(botExpired(late, now)).toBe(false);
    expect(botItem(late, now, tierLabel).status).toMatch(/finishing late/);
    expect(botMark(late)).toEqual({ days: 3, late: true });
    // or close it as a timed-out loss: a practice entry and a replay that stops where the game stopped
    const rec = timedOutRecords(kept!, now);
    expect(rec.entry).toMatchObject({ id: e.id, result: 'loss', level: 'medium', turns: save.turn, multiDay: { days: 3, timedOut: true } });
    expect(rec.replay).toMatchObject({ id: e.id, result: 'loss', conceded: true, multiDay: { days: 3, timedOut: true } });
    expect(rec.replay.choices).toEqual(save.choices);
    expect(practiceSpec(rec.replay).conceded).toBe(true);
    recordPractice(rec.entry);
    expect(loadPractice()[0]!.multiDay).toEqual({ days: 3, timedOut: true });
    expect(parseReplays(JSON.stringify([rec.replay]))[0]!.multiDay).toEqual({ days: 3, timedOut: true });
    expect(parsePractice(JSON.stringify([{ ...rec.entry, multiDay: { days: 'x' } }]))[0]!.multiDay).toBeUndefined();
    removeBotGame(e.id);
    expect(loadBotGames()).toEqual([]);
  }, 60_000);

  it('the Game review checks the position: the timed-out close at the save’s own check, a game finished late at its end', async () => {
    const strict = async (r: PracticeReplay) => {
      const q = practiceSpec(r);
      const agents = practiceAgents(q);
      const st = await Game.create(q.decks, agents, { seed: q.seed, first: q.first, log: false }).run();
      checkReplayed(q, agents, replayedEnd(st));
      return st;
    };
    const { save } = await keptGame();
    const e = botEntry({ days: 3, created: T0, deadline: deadlineFrom(T0, 3), late: false }, save, T0 + HOUR);
    const now = T0 + 3 * DAY_MS + HOUR;
    // closed as a timed-out loss: your last decision's position, as the save checks it
    const rec = timedOutRecords(e, now);
    expect(rec.replay.position).toEqual({ hash: save.check.hash, at: save.check.at });
    const back = parseReplays(JSON.stringify([rec.replay]))[0]!;
    expect(back.position).toEqual(rec.replay.position);
    expect((await strict(back)).winReason).toBe('You ran out of time');
    await expect(strict({ ...back, position: { hash: '0123456789abcdef', at: save.check.at } })).rejects.toThrow(/it reaches a different position from the one recorded/);
    // a damaged import's check that is not a hash leaves the record readable, unchecked
    const damaged = timedOutRecords({ ...e, save: { ...save, check: { ...save.check, hash: 'nope' } } }, now).replay;
    expect('position' in damaged).toBe(false);
    expect(parseReplays(JSON.stringify([damaged]))).toHaveLength(1);
    // finished late through the game keeper: recorded late, with the final position
    const keeper = new GameKeeper({ coach: () => false, saves: () => true, now: () => now, onProblem: () => undefined });
    keeper.md = { days: 3, created: T0, deadline: deadlineFrom(T0, 3), late: true, replayId: e.id };
    const b = new PracticeSession({ record: (r, st) => keeper.record(r, st) });
    drive(b, () => false);
    expect((await b.restore(save)).ok).toBe(true);
    let run = b.current!;
    while (run.g.s.winner === null) {
      await run.done;
      run = b.current!;
    }
    const [r] = parseReplays(store.get('nct.practiceReplays.v1') ?? null);
    expect(r!.multiDay).toEqual({ days: 3, late: true });
    expect(r!.position).toEqual({ hash: stateHash(run.g.s) });
    expect((await strict(r!)).turn).toBe(run.g.s.turn);
  }, 120_000);
});

const item = (o: Partial<OngoingItem>): OngoingItem => ({
  key: o.id ?? 'x',
  type: 'bot',
  id: 'x',
  title: 'A vs B',
  against: 'Hard bot',
  turn: 3,
  gigs: [1, 2],
  yourMove: false,
  status: 'Waiting',
  lastPlayed: 0,
  deadline: null,
  expired: false,
  ...o,
});

describe('the Ongoing games list', () => {
  it('your move first, then the soonest deadline, then the most recently played; finished games last', () => {
    const list = [
      item({ id: 'done', over: true, yourMove: false }),
      item({ id: 'theirs-soon', deadline: T0 + DAY_MS }),
      item({ id: 'mine-late', yourMove: true, deadline: T0 + 5 * DAY_MS }),
      item({ id: 'theirs-none-old', lastPlayed: 1 }),
      item({ id: 'mine-soon', yourMove: true, deadline: T0 + DAY_MS }),
      item({ id: 'theirs-none-new', lastPlayed: 2 }),
    ];
    expect(sortOngoing(list).map((x) => x.id)).toEqual(['mine-soon', 'mine-late', 'theirs-soon', 'theirs-none-new', 'theirs-none-old', 'done']);
  });
  it('the length is clamped to the configured range, and the cap counts both kinds', () => {
    expect([clampDays(1, { minDays: 3, maxDays: 20 }), clampDays(30, { minDays: 3, maxDays: 20 }), clampDays(7.4, { minDays: 3, maxDays: 20 })]).toEqual([3, 20, 7]);
    expect(capProblem({ bot: 5, pvp: 2 }, 8)).toBeNull();
    expect(capProblem({ bot: 5, pvp: 3 }, 8)).toMatch(/8 ongoing/);
  });
  it('one game as a file: read back exactly; anything else is refused with the reason', async () => {
    const { save } = await keptGame();
    const e = botEntry({ days: 5, created: T0, deadline: deadlineFrom(T0, 5), late: false }, save, T0);
    const text = ongoingFileText({ type: 'bot', game: e }, '2026-11-13T00:00:00.000Z');
    expect(parseOngoingFile(text)).toEqual({ ok: true, value: { type: 'bot', game: e } });
    expect(ongoingFileName({ type: 'bot', game: e }, '2026-11-13T00:00:00.000Z')).toMatch(/^nct-multiday-A-vs-B-2026-11-13\.json$/);
    expect(parseOngoingFile('nope')).toMatchObject({ ok: false, why: expect.stringMatching(/not JSON/) });
    expect(parseOngoingFile('{"kind":"nct-saved-game"}')).toMatchObject({ ok: false, why: expect.stringMatching(/not an ongoing/) });
    expect(parseOngoingFile(JSON.stringify({ kind: 'nct-ongoing-game', schema: 1, game: { ...e, save: { ...e.save, choices: 'x' } } }))).toMatchObject({ ok: false });
    expect(parseOngoingFile(JSON.stringify({ kind: 'nct-ongoing-game', schema: 1, game: { ...e, id: 'other' } }))).toMatchObject({ ok: false, why: expect.stringMatching(/another game/) });
  }, 60_000);

  it('the panel renders each game with its status, time left and actions, and the no-server note', () => {
    const now = T0;
    const html = renderToStaticMarkup(
      <OngoingGames
        items={[
          item({ id: 'a', yourMove: true, title: 'Mine vs Bot', status: 'Your move', deadline: now + 2 * DAY_MS + 3 * HOUR, lastPlayed: now - HOUR }),
          item({ id: 'b', type: 'pvp', title: 'Mine vs Theirs', against: 'vs Bo (you host)', status: 'Waiting for Bo', deadline: now + DAY_MS }),
          item({ id: 'c', yourMove: true, title: 'Old vs Bot', status: 'Time is up', expired: true, deadline: now - HOUR }),
        ]}
        now={now}
        storage
        cap={8}
        onOpen={() => undefined}
        onFinishLate={() => undefined}
        onCloseTimedOut={() => undefined}
        onExport={() => undefined}
        onDelete={() => undefined}
        onImport={() => null}
      />,
    );
    expect(html).toContain('Ongoing games');
    expect(html).toContain('(3 of 8)');
    expect(html).toContain('Mine vs Bot');
    expect(html).toContain('2 days 3 h left');
    expect(html).toContain('Waiting for Bo');
    expect(html).toContain('vs Bo (you host)');
    expect(html).toContain('Finish it anyway');
    expect(html).toContain('Close as a timed-out loss');
    expect(html).toContain('Resume');
    expect(html).toContain('Open');
    expect(html).toContain('Export');
    expect(html).toContain('Import a game');
    expect(html).toContain('would need a server');
    expect(MULTI_DAY_NOTE).toMatch(/server/);
    // blocked storage: the feature is off here, with the reason
    const blocked = renderToStaticMarkup(<OngoingGames items={[]} now={now} storage={false} cap={8} onOpen={() => undefined} onFinishLate={() => undefined} onCloseTimedOut={() => undefined} onExport={() => undefined} onDelete={() => undefined} onImport={() => null} />);
    expect(blocked).toContain('blocks site storage');
  });

  it('Play setup offers the multi-day choice (with the length) only when the feature is on', () => {
    const [a, b] = BUILTIN;
    const set = () => undefined;
    const base = { mine: a!.file, setMine: set, opp: b!.file, setOpp: set, seat: 'random' as const, setSeat: set, coach: true, setCoach: set, level: 'hard' as const, setLevel: set, dA: a, dB: b, onStart: set };
    const off = renderToStaticMarkup(<PlaySetup {...base} />);
    expect(off).not.toContain('Multi-day game');
    const on = renderToStaticMarkup(<PlaySetup {...base} multiDay={{ on: true, setOn: set, days: 7, setDays: set, min: 3, max: 20, blocked: null, panel: <p>PANEL</p> }} />);
    expect(on).toContain('Multi-day game');
    expect(on).toContain('Start multi-day game');
    expect(on).toContain('20 days');
    expect(on).toContain('PANEL');
    expect(on).toContain('#/play/corr');
  });
  it('the lobby for a game against a person states the trust model and the missing server', () => {
    const html = renderToStaticMarkup(<PlayCorr sub="corr" />);
    expect(html).toContain('Multi-day game vs a person');
    expect(html).toContain('Make the game and its invite');
    expect(html).toContain('round trip');
    expect(html).toContain('device runs the game, so this is for friendly play');
    expect(CORR_TRUST.split('. ').length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('would need a server');
  });
});
