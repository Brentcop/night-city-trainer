// Played events in the runner (#/run), server-rendered as the other runner tests are (there is no DOM in this setup:
// the interactions are the pure functions of tests/played-event.test.ts): "Who plays" and its presets, a setup link's
// seats, the matches waiting for a person ("Play your match" only for yours, "Record the result" only with another
// player), the "Record the result" dialog (a best-of-3, a forfeit), the "by hand" marks, the standings after a recorded
// result, and the runner with the feature off.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILTIN } from '../src/lib/browserLibrary';
import { applyPreset, NO_SEATS, PlayedGames, setSeat, type WaitingGame } from '../src/lib/playedEvent';
import { runTournament, type EventSetup, type GameJob, type GameRec, type TourneyEvent } from '../src/lib/tournament';
import { SeatPicker } from '../src/ui/components/tourney/SeatPicker';
import { WaitingMatches } from '../src/ui/components/tourney/WaitingMatches';
import { RecordResultDialog } from '../src/ui/components/tourney/RecordResult';
import { MatchModal, RoundList, StandingsTable, useEventLib } from '../src/ui/components/TourneyViews';
import { TournamentRunnerPage } from '../src/ui/pages/TournamentRunner';
import { defaultSiteConfig, siteConfigText } from '../src/lib/siteConfig';
import { previewDraft } from '../src/ui/useSiteConfig';
import { setArtEnabled } from '../src/ui/art';
import type { DeckList } from '../src/engine/types';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setArtEnabled(false);
  previewDraft(null);
});
afterEach(() => {
  previewDraft(null);
  vi.unstubAllGlobals();
});

const meta = BUILTIN.filter((d) => d.kind === 'meta');
const rows = meta.slice(0, 3).map((d) => ({ key: `${d.file}#1`, name: d.deck.name }));
const keys = rows.map((r) => r.key);
const pickerHtml = (value = NO_SEATS, coach = false) => renderToStaticMarkup(<SeatPicker rows={rows} value={value} onChange={() => undefined} coach={coach} onCoach={() => undefined} coachOffered />);

describe('who plays', () => {
  it('bots only: the presets and nothing else', () => {
    const html = pickerHtml();
    for (const t of ['Who plays', 'Bots only', 'Play in it', 'Players only']) expect(html).toContain(t);
    expect(html).toContain('aria-pressed="true" title="Bots play every match');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('Who runs each entrant');
    expect(html).not.toContain('no server');
  });
  it('play in it: the entrant you play, the coach box, who runs each entrant, and the one-device line', () => {
    const html = pickerHtml(applyPreset(keys, NO_SEATS, 'play'));
    expect(html).toContain('aria-pressed="true" title="You play one entrant');
    expect(html).toMatch(new RegExp(`<option value="${keys[0]}" selected="">${rows[0]!.name}</option>`));
    expect(html).toContain('Coach during my matches');
    expect(html).toMatch(/<input type="checkbox"\/> Coach during my matches/);
    expect(html).toContain('Who runs each entrant (1 person, 2 bots)');
    expect(html).toContain('there is no server, so this device holds the event');
  });
  it('players only: every entrant you or another player, the list open', () => {
    const html = pickerHtml(applyPreset(keys, NO_SEATS, 'players'));
    expect(html).toContain('aria-pressed="true" title="Every entrant is you or another player');
    expect(html).toContain('<details class="ev-sub" open="">');
    expect(html).toContain('Who runs each entrant (3 people, 0 bots)');
    const mixed = pickerHtml(setSeat(keys, applyPreset(keys, NO_SEATS, 'play'), keys[2]!, 'player'));
    expect(mixed).toContain('Set entrant by entrant');
    expect(mixed).not.toContain('aria-pressed="true"');
  });
});

describe('the runner page', () => {
  const files = meta.slice(0, 3).map((d) => d.file);
  it('a setup link with seats opens on "Play in it" with the entrant the link gives you', () => {
    const html = renderToStaticMarkup(<TournamentRunnerPage q={new URLSearchParams(`f=custom&d=${files.join(',')}&seat=byb&coach=1&s=9`)} />);
    expect(html).toContain('Who plays');
    expect(html).toContain('aria-pressed="true" title="You play one entrant');
    expect(html).toContain(`that you, opening it, play ${meta[1]!.deck.name}`);
    expect(html).toMatch(/<input type="checkbox" checked=""\/> Coach during my matches/);
  });
  it('with the feature off: no "Who plays", a link’s seats are ignored, a played run is listed but not resumable', () => {
    const c = defaultSiteConfig();
    c.features.playedTournaments = false;
    previewDraft(siteConfigText(c));
    const run = { id: 'r1', name: 'Run 1', date: '2026-11-12T00:00:00Z', bot: 'easy', format: 'Swiss', config: { name: 'x', rounds: 2, top: 0, bestOf: 1, bot: 'easy', seed: 3 }, setup: { format: 'swiss', entrants: [{ name: 'A' }, { name: 'B' }], bestOf: 1, seats: { A: 'you' } }, decks: {}, rounds: [], bracket: [], standings: [], champion: null, phase: 'stopped' };
    localStorage.setItem('nct.runs.v1', JSON.stringify([run]));
    const html = renderToStaticMarkup(<TournamentRunnerPage q={new URLSearchParams(`f=custom&d=${files.join(',')}&seat=byb&s=9`)} />);
    expect(html).not.toContain('Who plays');
    expect(html).not.toContain('Coach during my matches');
    expect(html).toContain('· played event');
    expect(html).not.toContain('▶ Resume');
    // on, the same run offers Resume
    previewDraft(null);
    expect(renderToStaticMarkup(<TournamentRunnerPage q={new URLSearchParams()} />)).toContain('▶ Resume');
  });
  it('a plain visit with the feature on shows "Who plays" on "Bots only"', () => {
    const html = renderToStaticMarkup(<TournamentRunnerPage q={new URLSearchParams('s=5')} />);
    expect(html).toContain('Who plays');
    expect(html).toContain('aria-pressed="true" title="Bots play every match');
  });
});

const deck = (name: string, k = 0): DeckList => ({ name, legends: [`L${k}`], main: [`c${k}`, 'x'], sideboard: [] });
const job = (a: string, b: string, seed = 1230): GameJob => ({ a: deck(a), b: deck(b, 1), seed, first: 0, bot: 'medium' });
const ev = { rounds: [{ round: 2, matches: [{ a: 'Me', b: 'Bot deck', games: [], winner: '', score: [0, 0] as [number, number], live: true }, { a: 'P1', b: 'P2', games: [], winner: '', score: [0, 0] as [number, number], live: true }] }], bracket: [], config: { name: 'x', rounds: 3, top: 0, bestOf: 3 as const, bot: 'medium' as const, seed: 1 } };

describe('the matches waiting for a person', () => {
  const yours: WaitingGame = { id: 'g1', kind: 'you', job: job('Me', 'Bot deck'), gi: 0, base: 1230, you: 'Me' };
  const theirs: WaitingGame = { id: 'g2', kind: 'hand', job: job('P1', 'P2', 4560), gi: 0, base: 4560 };
  const html = (inProgress: string | null = null) => renderToStaticMarkup(<WaitingMatches waiting={[yours, theirs]} ev={ev} inProgress={inProgress} onPlay={() => undefined} onRecord={() => undefined} canPlay />);
  it('"Play your match" only for yours, "Record the result" only for a match with another player', () => {
    const h = html();
    expect(h).toContain('Waiting for 2 results');
    const [mine, other] = h.split('<li').slice(1);
    expect(mine).toContain('<b>Your match</b> · Round 2: Me (you) vs Bot deck (bot)');
    expect(mine).toContain('▶ Play your match');
    expect(mine).not.toContain('Record the result');
    expect(other).toContain('Round 2: P1 vs P2 · best of 3');
    expect(other).toContain('Record the result');
    expect(other).not.toContain('Play your match');
  });
  it('a game of yours in progress: Continue', () => {
    expect(html('g1')).toContain('▶ Continue game 1');
    expect(html('g1')).toContain('in progress');
  });
  it('nothing waiting: nothing shown', () => {
    expect(renderToStaticMarkup(<WaitingMatches waiting={[]} ev={ev} onPlay={() => undefined} onRecord={() => undefined} canPlay />)).toBe('');
  });
});

describe('recording a result', () => {
  const w = { job: job('P1', 'P2') };
  const dialog = (initial: Parameters<typeof RecordResultDialog>[0]['initial']) => renderToStaticMarkup(<RecordResultDialog w={w} bestOf={3} round="Round 2" onSave={() => []} onClose={() => undefined} initial={initial} />);
  it('a best-of-3 game by game: three rows, the score, the button on', () => {
    const h = dialog({ mode: 'played', winners: [0, 1, 0], noShow: null });
    expect(h.match(/Game \d won by/g)).toHaveLength(3);
    expect(h).toContain('P1 wins 2–1.');
    expect(h).toMatch(/<button class="primary">Record the result<\/button>/);
  });
  it('unfinished: the next game row and what is missing; the button off', () => {
    const h = dialog({ mode: 'played', winners: [1], noShow: null });
    expect(h.match(/Game \d won by/g)).toHaveLength(2);
    expect(h).toContain('Still to say: the match is not finished');
    expect(h).toMatch(/<button class="primary" disabled="">Record the result<\/button>/);
  });
  it('a forfeit: who did not play, and the straight-games win', () => {
    const h = dialog({ mode: 'noShow', winners: [], noShow: 1 });
    expect(h).toContain('P2 did not play, so P1 wins');
    expect(h).toContain('P1 wins 2–0.');
  });
  it('a recorded best-of-3 is in the standings, and marked "by hand" where the match is shown', async () => {
    const s: EventSetup = { format: 'matches', entrants: [{ name: 'P1' }, { name: 'P2' }], bestOf: 3, matches: [{ a: 'P1', b: 'P2' }], seats: { P1: 'player', P2: 'player' } };
    const pg = new PlayedGames(s, () => Promise.reject(new Error('no bot games')));
    const run = runTournament([deck('P1'), deck('P2', 1)], { name: 'x', rounds: 0, top: 0, bestOf: 3, bot: 'medium', seed: 8 }, pg.play, { setup: s });
    await new Promise((r) => setTimeout(r, 0));
    expect(pg.record(pg.waiting[0]!.id, { winners: [1, 0, 1] }, 3)).toEqual([]);
    const done: TourneyEvent = await run;
    const lib = (() => {
      let l: ReturnType<typeof useEventLib> | null = null;
      const Grab = () => ((l = useEventLib(done.setup)), null);
      renderToStaticMarkup(<Grab />);
      return l!;
    })();
    const table = renderToStaticMarkup(<StandingsTable rows={done.standings} cut={0} lib={lib} full />);
    expect(table).toMatch(/<td>1<\/td><td><span>P2<\/span><\/td><td>3<\/td><td>1-0<\/td><td>2-1<\/td>/);
    const list = renderToStaticMarkup(<RoundList rounds={done.rounds} onOpen={() => undefined} lib={lib} />);
    expect(list).toContain('by hand');
    const m = done.rounds[0]!.matches[0]! as typeof done.rounds[0]['matches'][0] & { games: GameRec[] };
    const modal = renderToStaticMarkup(<MatchModal m={m} decks={done.decks} bot="medium" lib={lib} onClose={() => undefined} />);
    expect(modal).toContain('Recorded by hand');
    expect(modal).not.toContain('▶ Watch');
    expect(modal.match(/<span class="tag ev-hand">by hand<\/span>/g)).toHaveLength(3);
  });
});
