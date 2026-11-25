// "Watch" (a spectator's view of a match), the page half. There is no DOM in this test setup (no jsdom), so: the
// playback is a pure state machine (src/ui/components/watch/playback.ts) driven here action by action, as the
// overlay's buttons and timers drive it; the dialog is rendered to static markup for a playback state (WatchView); the
// focus trap, Escape and focus return are the shared Modal's (tests/modal.test.tsx), which the overlay renders through.
// Also: the owner's switch, the Watch controls where they appear, and the import graph (the watch code and the board
// load only when someone presses Watch).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CARD_BY_ID } from '../src/engine/cards';
import type { DeckList, GameState, LogEntry } from '../src/engine/types';
import { defaultSiteConfig, FEATURES, FEATURE_INFO, siteConfigText } from '../src/lib/siteConfig';
import { Game } from '../src/engine/engine';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import { gameDeck, makeBot, type GameRec } from '../src/lib/tournament';
import { playWatchGame, type WatchedGame } from '../src/lib/watchGame';
import type { WatchMatch, WatchTarget } from '../src/lib/watchMatch';
import { setArtEnabled } from '../src/ui/art';
import { previewDraft } from '../src/ui/useSiteConfig';
import { FrameBoard } from '../src/ui/components/ReplayBoard';
import { MatchModal } from '../src/ui/components/TourneyViews';
import { eventLib } from '../src/ui/deckLookup';
import { HistoryTable, type HistoryRow } from '../src/ui/components/ProfileParts';
import { WatchButton, WatchHost } from '../src/ui/components/watch/WatchEntry';
import { WatchView } from '../src/ui/components/watch/WatchOverlay';
import {
  atEnd,
  BETWEEN_GAMES_S,
  initialPlayback,
  matchShown,
  nextComing,
  playbackReduce,
  shownScore,
  wantsPlan,
  type PlaybackAction,
  type PlaybackState,
} from '../src/ui/components/watch/playback';
import { BOT_SPEEDS, DEFAULT_BOT_SPEED } from '../src/ui/components/board/prefs';

const ROOT = path.resolve(__dirname, '..');

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setArtEnabled(false);
});
afterEach(() => {
  previewDraft(null);
  vi.unstubAllGlobals();
});
const watchOff = () => {
  const c = defaultSiteConfig();
  c.features.watchMatches = false;
  previewDraft(siteConfigText(c));
};

// ---------------------------------------------------------------- a real game of event 1, played again

const ev = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/events/archive/event-1.json'), 'utf8')) as {
  bot: string;
  simVersion: number;
  config: { bestOf: number };
  decks: Record<string, { legends: string[]; main: string[] }>;
  rounds: { matches: { a: string; b: string | null; games: GameRec[]; score: [number, number]; winner: string }[] }[];
};
const match = ev.rounds.flatMap((r) => r.matches).find((m) => m.b && m.games.some((g) => g.seed === 1020010))!;
const names: [string, string] = [match.a, match.b!];
const deck = (name: string): DeckList => gameDeck({ name, ...ev.decks[name]! });
let real: WatchedGame;
beforeAll(async () => {
  // the deal as the event recorded it (on SIM_VERSION 9), recorded again on the current version as an event records a
  // game (the archived events are not re-recorded at every bump; RRG Dexter Midrange holds a Street Cred card, so since
  // SIM_VERSION 10 the deal plays differently), then watched
  const g = match.games.find((x) => x.seed === 1020010)!;
  const s = await Game.create([deck(match.a), deck(match.b!)], [makeBot(ev.bot, g.seed), makeBot(ev.bot, g.seed + 7777)], { seed: g.seed, first: g.first, log: false }).run();
  real = await playWatchGame({ kind: 'event', decks: [deck(match.a), deck(match.b!)], seed: g.seed, first: g.first, bot: ev.bot, simVersion: CURRENT_SIM_VERSION, expect: { winner: s.winner!, turns: s.turn } });
}, 60_000);

/** A game with `n` moves over turns 1.. (two moves a turn), ending in `winner`, for driving the playback. */
function fakeGame(n: number, winner: 0 | 1 | 'tie'): WatchedGame {
  const frames = Array.from({ length: n }, (_, i) => ({ state: { turn: 1 + Math.floor(i / 2) } as unknown as GameState, line: { turn: 1 + Math.floor(i / 2), player: (i % 2) as 0 | 1, text: `move ${i}` } as LogEntry, at: i }));
  return { frames, winner: winner === 'tie' ? null : winner, reason: 'reached 7 Gigs', turns: Math.ceil(n / 2) };
}
const src = (seed: number) => ({ kind: 'event' as const, decks: [deck(match.a), deck(match.b!)] as [DeckList, DeckList], seed, first: 0 as const, bot: 'hard' });
const run = (s: PlaybackState, ...as: PlaybackAction[]) => as.reduce(playbackReduce, s);
/** The playback with game `k` planned and played out. */
const withGame = (s: PlaybackState, index: number, game: WatchedGame) =>
  run(s, { type: 'planned', at: s.entries.length, next: { kind: 'game', index, source: src(100 + index) } }, { type: 'computed', k: s.entries.length, result: { ok: true, game } });

const target = (o: Partial<WatchMatch> = {}): WatchTarget => ({ kind: 'match', names, lists: [ev.decks[match.a]!, ev.decks[match.b!]!], bot: 'hard', simVersion: ev.simVersion, bestOf: 3, recorded: () => [], complete: () => false, ...o });
const view = (st: PlaybackState, t: WatchTarget = target()) => renderToStaticMarkup(<WatchView target={t} st={st} act={() => undefined} onClose={() => undefined} narrow={false} />);

// ---------------------------------------------------------------- the playback

describe('the playback', () => {
  it('play, pause, a move per tick, step, the next turn, restart and the speed steps of the board', () => {
    let s = withGame(initialPlayback(false), 0, fakeGame(10, 0));
    expect(s.fi).toBe(0);
    expect(run(s, { type: 'tick' }).fi).toBe(0); // paused: the pace does nothing
    s = run(s, { type: 'play' }, { type: 'tick' }, { type: 'tick' });
    expect(s).toMatchObject({ playing: true, fi: 2 });
    s = run(s, { type: 'pause' }, { type: 'tick' });
    expect(s).toMatchObject({ playing: false, fi: 2 });
    s = run(s, { type: 'play' }, { type: 'step' });
    expect(s).toMatchObject({ playing: false, fi: 3 }); // a step pauses
    expect(run(s, { type: 'nextTurn' }).fi).toBe(4); // moves 4 and 5 are turn 3
    expect(run(s, { type: 'restart' }).fi).toBe(0);
    expect(s.speed).toBe(DEFAULT_BOT_SPEED);
    for (const b of BOT_SPEEDS) expect(run(s, { type: 'speed', ms: b.ms }).speed).toBe(b.ms);
    expect(run(s, { type: 'speed', ms: 777 }).speed).toBe(DEFAULT_BOT_SPEED);
  });

  it('the result is not reached before the last move; "Skip to the result" reaches it', () => {
    let s = withGame(initialPlayback(true), 0, fakeGame(10, 1));
    s = run(s, { type: 'tick' }, { type: 'tick' });
    expect(atEnd(s)).toBe(false);
    expect(s.reached).toBe(0);
    expect(shownScore(s)).toEqual([0, 0]);
    s = run(s, { type: 'skip' });
    expect(atEnd(s)).toBe(true);
    expect(s.reached).toBe(1);
    expect(shownScore(s)).toEqual([0, 1]);
  });

  it('a match of three games: after game 1 a short pause, then game 2 by itself; paused, the spectator starts it', () => {
    let s = withGame(initialPlayback(true), 0, fakeGame(4, 0));
    // the planner looks one game ahead while game 1 is on the table
    expect(wantsPlan(s)).toBe(true);
    s = withGame(s, 1, fakeGame(6, 1));
    expect(wantsPlan(s)).toBe(false);
    // whether another game follows is not known on screen before game 1 is over
    expect(nextComing(s)).toBe(false);
    s = run(s, { type: 'tick' }, { type: 'tick' }, { type: 'tick' });
    expect(atEnd(s)).toBe(true);
    expect(nextComing(s)).toBe(true);
    expect(s.left).toBe(BETWEEN_GAMES_S);
    for (let i = 1; i < BETWEEN_GAMES_S; i++) s = run(s, { type: 'second' });
    expect(s).toMatchObject({ shown: 0, left: 1 });
    s = run(s, { type: 'second' });
    expect(s).toMatchObject({ shown: 1, fi: 0, left: null, reached: 1 });
    expect(shownScore(s)).toEqual([1, 0]);
    // paused at the end of game 2: no countdown, the spectator starts game 3
    s = withGame(s, 2, fakeGame(4, 0));
    s = run(s, { type: 'pause' }, { type: 'skip' });
    expect(s).toMatchObject({ shown: 1, left: null });
    expect(nextComing(s)).toBe(true);
    s = run(s, { type: 'startNext' });
    expect(s).toMatchObject({ shown: 2, fi: 0 });
    // the planner says the match is over: once game 3's end is shown, so is the match
    s = run(s, { type: 'planned', at: 3, next: { kind: 'over' } });
    expect(matchShown(s)).toBe(false);
    s = run(s, { type: 'skip' });
    expect(matchShown(s)).toBe(true);
    expect(shownScore(s)).toEqual([2, 1]);
  });

  it('"Skip to the match result" goes through every game as it is played out', () => {
    let s = withGame(initialPlayback(true), 0, fakeGame(4, 0));
    s = run(s, { type: 'skipMatch' });
    expect(atEnd(s)).toBe(true);
    s = withGame(s, 1, fakeGame(4, 0));
    expect(s).toMatchObject({ shown: 1 });
    expect(atEnd(s)).toBe(true);
    s = run(s, { type: 'planned', at: 2, next: { kind: 'over' } });
    expect(matchShown(s)).toBe(true);
    expect(shownScore(s)).toEqual([2, 0]);
  });

  it('a refused game stops the match there; a game not dealt yet is waited for; a stale planner answer is ignored', () => {
    const s0 = initialPlayback(true);
    let s = run(s0, { type: 'planned', at: 0, next: { kind: 'game', index: 0, source: src(1) } }, { type: 'computed', k: 0, result: { ok: false, refused: 'This game can’t be watched: x.' } });
    expect(s.entries[0]!.refused).toBe('This game can’t be watched: x.');
    expect(wantsPlan(s)).toBe(false);
    s = run(s0, { type: 'planned', at: 0, next: { kind: 'wait', index: 0 } });
    expect(s.waiting).toBe(0);
    expect(run(s, { type: 'planned', at: 5, next: { kind: 'over' } })).toBe(s);
  });
});

describe('the worker client', () => {
  /** A stand-in for the watch worker: answers each request after the previous one, by the source's seed. */
  class FakeWorker {
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: unknown = null;
    asked: number[] = [];
    busy = false;
    terminated = false;
    postMessage(m: { id: number; source: { seed: number } }) {
      expect(this.busy).toBe(false); // one game at a time
      this.busy = true;
      this.asked.push(m.source.seed);
      setTimeout(() => {
        this.busy = false;
        const seed = m.source.seed;
        this.onmessage?.({ data: seed === 2 ? { id: m.id, refused: 'no' } : seed === 3 ? { id: m.id, error: 'boom' } : { id: m.id, game: fakeGame(2, 0) } });
      }, 1);
    }
    terminate() {
      this.terminated = true;
    }
  }

  it('asks one game at a time, in order, and says which were refused or failed; dispose ends the worker', async () => {
    const w = new FakeWorker();
    const { workerComputer } = await import('../src/ui/components/watch/watchClient');
    const c = workerComputer(() => w as unknown as Worker);
    const [a, b, d] = await Promise.all([c.compute(src(1)), c.compute(src(2)), c.compute(src(3))]);
    expect(w.asked).toEqual([1, 2, 3]);
    expect(a.ok).toBe(true);
    expect(b).toEqual({ ok: false, refused: 'no' });
    expect(d).toEqual({ ok: false, error: 'boom' });
    c.dispose();
    expect(w.terminated).toBe(true);
  });
});

// ---------------------------------------------------------------- the dialog

describe('the spectator’s dialog', () => {
  it('shows the board with both hands face up and the log up to the move shown, never the result before it', () => {
    const mid = Math.floor(real.frames.length / 2);
    let s = withGame(initialPlayback(true), 0, real);
    while (s.fi < mid) s = run(s, { type: 'tick' });
    const html = view(s);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('spectator view: both hands face up');
    expect(html).toContain('pb-open-hand-rival');
    // every card in both hands is shown by name
    const st = real.frames[mid]!.state;
    for (const p of [0, 1] as const) for (const u of st.players[p].hand) expect(html).toContain(CARD_BY_ID[st.cards[u]!.defId]!.name.replace(/'/g, '&#x27;'));
    // nothing past the move shown: not the last line, not a result, not the length
    const last = real.frames[real.frames.length - 1]!.line.text;
    expect(html).not.toContain(last.replace(/'/g, '&#x27;'));
    expect(html).not.toMatch(/ wins|Match over|after \d+ turns/);
    expect(html).toContain('Skip to the result');
    expect(html).toContain('Skip to the match result');
    // the score so far: nothing yet
    expect(html).toMatch(/Match score: [^"]* 0, [^"]* 0/);
    // after "Skip to the result" the result is there
    const done = view(run(s, { type: 'skip' }));
    const who = real.winner === 0 || real.winner === 1 ? `${names[real.winner]} wins` : 'Draw';
    expect(done).toContain(`Game 1: ${who}`.replace(/'/g, '&#x27;'));
  });

  it('a face-down Legend is shown to the spectator (still marked face-down), and hidden on a player’s board', () => {
    const f = real.frames.find((x) => Object.values(x.state.cards).some((c) => c.zone === 'legends' && !c.faceUp))!;
    const fd = Object.values(f.state.cards).find((c) => c.zone === 'legends' && !c.faceUp && c.controller === 1)!;
    const name = CARD_BY_ID[fd.defId]!.name.replace(/'/g, '&#x27;');
    const spectator = renderToStaticMarkup(<FrameBoard state={f.state} names={names} narrow={false} at={0} spectator />);
    expect(spectator).toContain(name);
    expect(spectator).toContain('face-down');
    const player = renderToStaticMarkup(<FrameBoard state={f.state} names={names} narrow={false} at={0} />);
    expect(player).not.toContain('pb-open-hand');
  });

  it('a refusal is the sentence alone, with no board', () => {
    const s = run(initialPlayback(true), { type: 'planned', at: 0, next: { kind: 'game', index: 0, source: src(1) } }, { type: 'computed', k: 0, result: { ok: false, refused: "This game can't be watched: it was recorded with version 8." } });
    const html = view(s);
    expect(html).toContain('This game can&#x27;t be watched: it was recorded with version 8.');
    expect(html).not.toContain('pb-watch-board');
  });

  it('one game, or a recorded game: no match score', () => {
    const s = withGame(initialPlayback(false), 0, real);
    expect(view(s, target({ only: 1 }))).not.toContain('Match score');
    expect(view(s, target({ only: 1 }))).toContain('Game 2 of the match');
    expect(view(s)).toContain('Paused at the first move. Press Play to watch.');
  });

  it('loads lazily: before the overlay arrives, the host shows a dialog that can be closed', () => {
    const html = renderToStaticMarkup(<WatchHost target={target()} onClose={() => undefined} />);
    expect(html).toContain('Setting up the table');
    expect(html).toContain('aria-label="Close"');
  });
});

// ---------------------------------------------------------------- where Watch appears, and the owner's switch

describe('Watch controls and the switch', () => {
  const m = { ...match, b: match.b!, games: match.games };
  const modal = () => renderToStaticMarkup(<MatchModal m={m} decks={ev.decks} bot={ev.bot} lib={eventLib(new Map())} onClose={() => undefined} simVersion={ev.simVersion} bestOf={ev.config.bestOf} />);
  const row: HistoryRow = { key: 'k', date: '2026-11-16T00:00:00.000Z', deck: 'A', opp: 'B', tier: 'easy', result: 'win', turns: 9, first: true, gigs: null, conceded: false, grade: null, watch: () => undefined };

  it('is not offered for a match a person plays or records: there is no bot game to play back', () => {
    const base = { decks: ev.decks, bot: ev.bot, lib: eventLib(new Map()), onClose: () => undefined, simVersion: ev.simVersion, bestOf: ev.config.bestOf };
    // a bot match offers the match and each game
    expect(renderToStaticMarkup(<MatchModal m={m} {...base} />)).toContain('Watch the match');
    // a match of a played event with a person in it does not, even before any game is in
    expect(renderToStaticMarkup(<MatchModal m={m} {...base} person />)).not.toContain('Watch the match');
    expect(renderToStaticMarkup(<MatchModal m={{ ...m, games: [], live: true }} {...base} person />)).not.toContain('Watch');
    // nor does a match in which a person decided a game (played on the board here, or recorded by hand)
    for (const by of ['you', 'hand'] as const) {
      const decided = { ...m, games: m.games.map((g, i) => (i === 0 ? { ...g, by } : g)) };
      expect(renderToStaticMarkup(<MatchModal m={decided} {...base} />), by).not.toContain('Watch the match');
    }
  });

  it('is on by default, and listed for the owner', () => {
    expect(FEATURES).toContain('watchMatches');
    expect(FEATURE_INFO.watchMatches.default).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(ROOT, 'public/site-config.json'), 'utf8')).features.watchMatches).toBe(true);
  });

  it('a recorded event’s match dialog offers the whole match and each game; the Profile history each game', () => {
    const html = modal();
    expect(html).toContain('Watch the match');
    expect(html.match(/aria-label="Watch game \d as a spectator"/g)?.length).toBe(m.games.length);
    expect(html).toContain('▶ Replay');
    expect(renderToStaticMarkup(<HistoryTable rows={[row]} caption="c" />)).toContain('aria-label="Watch the game A vs B with both hands face up"');
    expect(renderToStaticMarkup(<WatchButton onWatch={() => undefined} />)).toContain('👁 Watch');
  });

  it('off, no Watch control renders', () => {
    watchOff();
    const html = modal();
    expect(html).not.toContain('Watch the match');
    expect(html).not.toContain('as a spectator');
    expect(html).toContain('▶ Replay');
    expect(renderToStaticMarkup(<WatchButton onWatch={() => undefined} />)).toBe('');
  });
});

// ---------------------------------------------------------------- the import graph

const EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
function resolveSpec(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec.replace(/\?.*$/, ''));
  return EXTS.map((e) => base + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile()) ?? null;
}
/** `import x from '…'`, `import '…'`, `export … from '…'`, not `import type` / `export type`. */
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
/** Any import, static or dynamic, type or not. */
const ANY_IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;
function staticGraph(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) return;
    for (const m of fs.readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const hit = resolveSpec(file, m[1]!);
      if (hit) walk(hit);
    }
  };
  for (const e of entries) walk(e);
  return seen;
}
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');
const at = (f: string) => path.join(ROOT, f);
/** The heavy half of Watch, and the board. */
const HEAVY = /^src\/(ui\/components\/watch\/(WatchOverlay|useWatchPlayback|watchClient|playback)\.tsx?|lib\/watchGame\.ts|sim\/watch\.worker\.ts|ui\/components\/board\/|ui\/components\/ReplayBoard\.tsx)/;

describe('the import graph', () => {
  it('the entry does not reach any of the watch code', () => {
    const g = [...staticGraph([at('src/main.tsx')])].map(rel);
    expect(g.length).toBeGreaterThan(10);
    expect(g.filter((f) => /watch/i.test(f))).toEqual([]);
  });

  it('the runner and the events page reach neither the board nor the heavy half of Watch: they load when Watch (or Replay) is pressed', () => {
    for (const page of ['src/ui/pages/TournamentRunner.tsx', 'src/ui/pages/Tournaments.tsx']) {
      const g = [...staticGraph([at(page)])].map(rel);
      expect(g).toContain('src/ui/components/watch/WatchEntry.tsx');
      expect(g.filter((f) => HEAVY.test(f))).toEqual([]);
    }
    const entry = fs.readFileSync(at('src/ui/components/watch/WatchEntry.tsx'), 'utf8');
    expect(entry).toContain("lazy(() => import('./WatchOverlay')");
  });

  it('online play never imports the watch code, so a game in progress against a person can never be shown with both hands', () => {
    const files = [
      ...fs.readdirSync(at('src/net')).map((f) => `src/net/${f}`),
      'src/ui/pages/PlayOnline.tsx',
      'src/ui/pages/PlayCorr.tsx',
      'src/ui/pages/Play.tsx',
      'src/lib/practiceSession.ts',
    ].filter((f) => /\.tsx?$/.test(f));
    const hits: string[] = [];
    for (const f of files) for (const m of fs.readFileSync(at(f), 'utf8').matchAll(ANY_IMPORT)) if (/watch/i.test(m[1]!)) hits.push(`${f} → ${m[1]}`);
    expect(hits).toEqual([]);
  });

  it('the spectator flag on the board is set only by the watch view', () => {
    const walk = (dir: string): string[] => fs.readdirSync(at(dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
    const code = new Map(walk('src').map((f) => [f, fs.readFileSync(at(f), 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')]));
    const where = (re: RegExp) => [...code].filter(([, t]) => re.test(t)).map(([f]) => f).sort();
    // read by the board's card and hand zones, set on a board's context only by the replay board, which is drawn with it
    // only by the watch view
    expect(where(/ctx\.spectator/)).toEqual(['src/ui/components/board/BoardCard.tsx', 'src/ui/components/board/Zones.tsx']);
    expect(where(/spectator: true/)).toEqual(['src/ui/components/ReplayBoard.tsx']);
    expect(where(/<FrameBoard [^>]*spectator/)).toEqual(['src/ui/components/watch/WatchOverlay.tsx']);
  });
});
