// A played match end to end without a browser (src/lib/playedGame.ts): a two-entrant event whose one best-of-3 match
// you play on the practice session against the event's bot (your seat answered by a bot brain, as tests/play-session.test.ts
// does), game after game as the board's "Next game" does, with one game conceded. Checks the event's result, the
// practice history and replays (one entry per game, tagged with the event and the match) and the game's saves.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { makeTierBot } from '../src/ai/tiers';
import type { Decision, DeckList } from '../src/engine/types';
import { runTournament, type EventSetup, type TourneyEvent } from '../src/lib/tournament';
import { PlayedGames, waitingMatch, type WaitingGame } from '../src/lib/playedEvent';
import { saveFor, YourGames, yourGameRec, yourMatchSetup } from '../src/lib/playedGame';
import { loadPractice, parsePractice } from '../src/lib/practiceLog';
import { loadReplays, parseReplays } from '../src/lib/practiceReplays';
import { CONCEDED_REASON } from '../src/lib/practiceSession';
import type { SavedGame } from '../src/lib/savedGames';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('a best-of-3 match of yours, played on the practice session', () => {
  it('the event takes each game; the practice history has each one once, tagged; a concession loses its game', async () => {
    // you play B, the second-named deck: the board puts your deck in seat 0 and the record turns it back
    const decks = [anyDeck('Alpha', ['Red', 'Yellow']), anyDeck('Beta', ['Blue', 'Green'])];
    const setup: EventSetup = { format: 'matches', entrants: [{ name: 'Alpha' }, { name: 'Beta' }], bestOf: 3, matches: [{ a: 'Alpha', b: 'Beta' }], seats: { Beta: 'you' } };
    const bots = () => Promise.reject(new Error('no bot match in this event'));
    const pg = new PlayedGames(setup, bots);
    let last: TourneyEvent | null = null;
    const saves: (SavedGame | null)[] = [];
    const ctl = new YourGames(pg, { event: { id: 'run-e2e', name: 'Two decks' }, roundOf: (w) => waitingMatch(last, w)?.round ?? '', onSave: (_g, s) => saves.push(s) });
    // your seat: a bot brain answers; in your second game you concede at your first main-phase decision
    const brain = makeTierBot('easy', 9);
    const started: WaitingGame[] = [];
    let asked: Decision | null = null;
    ctl.session.subscribe(() => {
      const run = ctl.session.current;
      const d = run?.human.pending?.d;
      if (!run || !d || d === asked) return;
      asked = d;
      setTimeout(async () => {
        if (run !== ctl.session.current || run.human.pending?.d !== d) return;
        if (started.length === 2 && d.kind === 'action') {
          ctl.session.concede();
          return;
        }
        const r = await brain.decide(run.g, d);
        run.human.answer(d, r[0]!);
      }, 0);
    });
    // "Play your match", then "Next game" while the match goes on
    const openNext = () => {
      const w = pg.waiting.find((x) => x.kind === 'you' && !started.some((s) => s.id === x.id));
      if (!w) return;
      started.push(w);
      setTimeout(() => ctl.start(w), 0);
    };
    pg.subscribe(openNext);
    const ev = await runTournament(decks, { name: 'Two decks', rounds: 0, top: 0, bestOf: 3, bot: 'easy', seed: 4242 }, pg.play, { setup, id: 'run-e2e', onUpdate: (e) => (last = e) });

    expect(ev.phase).toBe('done');
    const m = ev.rounds[0]!.matches[0]!;
    expect(m.games.length).toBeGreaterThanOrEqual(2);
    expect(m.games.length).toBe(started.length);
    expect(Math.max(...m.score)).toBe(2);
    expect(m.winner).toBe(m.score[0] === 2 ? 'Alpha' : 'Beta');
    expect(ev.standings.find((s) => s.deck === m.winner)!.mp).toBe(3);
    // game 2 was conceded: a loss for you (Beta), so a win for Alpha in the event's numbering
    expect(m.games[1]!.winner).toBe(0);
    expect(m.games[1]!.reason).toBe(CONCEDED_REASON);
    for (const [i, g] of m.games.entries()) {
      expect(g.by).toBe('you');
      expect(g.seed).toBe(started[i]!.job.seed);
      expect(g.first).toBe(started[i]!.job.first);
    }

    // the practice history: one entry per game, yours (Beta) against the event's bot, tagged with the event and match
    const log = loadPractice();
    expect(log).toHaveLength(m.games.length);
    const replays = loadReplays();
    expect(replays).toHaveLength(m.games.length);
    for (const [i, g] of m.games.entries()) {
      const e = log.find((x) => x.id === g.replay)!;
      expect(e).toBeTruthy();
      expect([e.deck, e.opp, e.level]).toEqual(['Beta', 'Alpha', 'easy']);
      expect(e.result).toBe(g.winner === 1 ? 'win' : g.winner === 0 ? 'loss' : 'draw');
      expect(e.tourney).toEqual({ event: 'run-e2e', name: 'Two decks', round: 'Round 1', a: 'Alpha', b: 'Beta', game: i + 1 });
      const r = replays.find((x) => x.id === g.replay)!;
      expect(r.tourney).toEqual(e.tourney);
      expect(r.decks.map((d) => d.name)).toEqual(['Beta', 'Alpha']);
      expect([r.seed, r.botLevel]).toEqual([g.seed, 'easy']);
      // the bot plays seat A's seed (it is the match's first-named deck)
      expect(r.botSeed).toBe(g.seed);
      expect(r.first).toBe(g.first === 0 ? 1 : 0);
    }
    expect(log[1]!.conceded).toBe(true);
    // stored entries read back with their tags; older entries without one read as before
    expect(parsePractice(JSON.stringify(log)).map((x) => x.tourney?.game)).toEqual(log.map((_, i) => i + 1));
    expect(parsePractice(JSON.stringify([{ deck: 'A', opp: 'B', result: 'win' }]))[0]!.tourney).toBeUndefined();
    expect(parseReplays(JSON.stringify([{ ...replays[0], tourney: { event: 1 } }]))).toEqual([]);

    // saves: written as you played, and cleared when each game ended (the event keeps none once the match is over)
    expect(saves.filter(Boolean).length).toBeGreaterThan(0);
    expect(saves.at(-1)).toBeNull();
  }, 120_000);

  it('a save belongs to its own game only; the setup and record swap seats for the second-named deck', () => {
    const decks = [anyDeck('Alpha', ['Red', 'Yellow']), anyDeck('Beta', ['Blue', 'Green'])];
    const w = { job: { a: decks[0]!, b: decks[1]!, seed: 5550, first: 0 as const, bot: 'medium' }, you: 'Beta' };
    const m = yourMatchSetup(w);
    expect([m.decks[0].name, m.first, m.botSeed, m.level]).toEqual(['Beta', 1, 5550, 'medium']);
    expect(yourMatchSetup({ ...w, you: 'Alpha' }).botSeed).toBe(5550 + 7777);
    expect(yourGameRec(w, { winner: 0, turn: 9, winReason: 'Gigs' }, 'p1')).toMatchObject({ winner: 1, by: 'you', replay: 'p1', seed: 5550, first: 0 });
    expect(yourGameRec(w, { winner: 'tie', turn: 9, winReason: '' }, 'p1').winner).toBe('tie');
    expect(saveFor(w, { kind: 'something else' })).toBeNull();
  });
});
