// The event views (src/ui/components/TourneyViews.tsx) with a deck entered twice: the copy "X #2" keeps its label but
// links to X's deck page, shows X's tier and colours, says in a title and to a screen reader which entry it is, and the
// "By deck" summary puts the entries together with the mirror games apart. An event without copies has no summary and
// renders the same with or without its setup. Server-rendered (no DOM needed).
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RATINGS } from '../src/data/index';
import { BUILTIN } from '../src/lib/browserLibrary';
import { byName, eventLib } from '../src/ui/deckLookup';
import { Bracket, ByDeckSummary, Champion, MatchModal, RoundList, StandingsTable, type MatchView } from '../src/ui/components/TourneyViews';
import { SimTierBadge, simTierFor } from '../src/ui/components/TierBadges';
import type { GameRec, StandingRow } from '../src/lib/tournament';

const esc = (s: string) => renderToStaticMarkup(<>{s}</>);
const names = byName(BUILTIN);
// two rated library decks whose badges differ (each names its own expected win rate), so a badge in a row is its own deck's
const rated = RATINGS.decks.filter((r) => names.has(r.name) && !/["'&<>]/.test(r.name));
const X = rated[0]!.name;
const Y = rated.find((r) => renderToStaticMarkup(<SimTierBadge tier={simTierFor(r.name)} />) !== renderToStaticMarkup(<SimTierBadge tier={simTierFor(X)} />))!.name;
const X2 = `${X} #2`;
const xFile = names.get(X)!.file;
const href = (file: string) => `href="#/deck?d=${encodeURIComponent(file)}"`;
const setup = { entrants: [{ name: X }, { name: X2, copyOf: X }, { name: Y }] };
const lib = eventLib(names, setup);
const none = () => undefined;

const game = (winner: 0 | 1 | 'tie', seed: number, first: 0 | 1 = 0): GameRec => ({ seed, first, winner, turns: 9, reason: 'gigs' });
const row = (deck: string, mw: number, ml: number, gw: number, gl: number): StandingRow => ({ deck, mp: 3 * mw, mw, ml, gw, gl, opps: [], omw: 0.5, gwp: 0.5, turns: 0, games: 0, playW: 0, playG: 0, drawW: 0, drawG: 0 });
const mirror = { a: X, b: X2, score: [2, 1] as [number, number], winner: X, games: [game(0, 1), game(1, 2), game(0, 3)] };
const r1 = { a: X2, b: Y, score: [2, 0] as [number, number], winner: X2, games: [game(0, 4), game(0, 5)] };
const r2 = { a: Y, b: X, score: [2, 1] as [number, number], winner: Y, games: [game(0, 6), game(1, 7), game(0, 8)] };
const final = { a: X2, b: Y, score: [2, 1] as [number, number], winner: X2, games: [game(1, 9), game(0, 10), game(0, 11)] };
const ev = {
  rounds: [
    { round: 1, matches: [mirror] },
    { round: 2, matches: [r1, r2] },
  ],
  bracket: [{ name: 'Final', matches: [final] }],
  standings: [row(X2, 1, 0, 2, 0), row(Y, 1, 1, 2, 3), row(X, 1, 1, 3, 3)],
  champion: X2,
  entrants: setup.entrants.map((e) => e.name),
};
const rowOf = (html: string, name: string) => html.split('<tr').find((r) => r.includes(`>${esc(name)}<`))!;

describe('a deck entered twice, in the event views', () => {
  it('standings: the copy links to its deck and shows its tier', () => {
    const html = renderToStaticMarkup(<StandingsTable rows={ev.standings} cut={0} lib={lib} tiers />);
    const copy = rowOf(html, X2);
    expect(copy).toContain(href(xFile));
    expect(copy).toContain(`title="${esc(`${X2}: second entry of ${X}`)}"`);
    expect(copy).toContain(`<span class="sr-only"> (second entry of ${esc(X)})</span>`);
    expect(copy).toContain(renderToStaticMarkup(<SimTierBadge tier={simTierFor(X)} />));
    expect(copy).not.toContain(renderToStaticMarkup(<SimTierBadge tier={simTierFor(Y)} />));
    // the original entry is unchanged: its own name as the title, no words added
    const orig = rowOf(html, X);
    expect(orig).toContain(`title="${esc(X)}"`);
    expect(orig).not.toContain('entry of');
  });

  it('bracket and champion card: the copy is its deck', () => {
    const br = renderToStaticMarkup(<Bracket rounds={ev.bracket} size={2} seeds={[]} champion={X2} lib={lib} onOpen={none} />);
    expect(br).toContain(href(xFile)); // the champion slot links to X's page
    expect(br).toContain(`title="${esc(`${X2}: second entry of ${X}`)}"`);
    const champ = renderToStaticMarkup(<Champion name={X2} lib={lib} />);
    expect(champ).toContain(href(xFile));
    // X's colours: the same legend strip and origin badge as X's own card
    const own = renderToStaticMarkup(<Champion name={X} lib={lib} />);
    const strip = (h: string) => h.slice(h.indexOf('<div class="champion">'), h.indexOf('CHAMPION'));
    expect(strip(champ)).toBe(strip(own));
  });

  it('round list: the copy says which entry it is', () => {
    const html = renderToStaticMarkup(<RoundList rounds={ev.rounds} onOpen={none} openFirst lib={lib} />);
    expect(html).toContain(`title="${esc(`${X2}: second entry of ${X}`)}"`);
    expect(html.split('(second entry of').length - 1).toBe(2); // X #2 in two matches
  });

  it('match dialog: both entries link to the deck, and a mirror match says so', () => {
    const decks = Object.fromEntries([X, X2, Y].map((n) => [n, { legends: names.get(n === X2 ? X : n)!.deck.legends, main: names.get(n === X2 ? X : n)!.deck.main }]));
    const m = renderToStaticMarkup(<MatchModal m={mirror as MatchView & { games: GameRec[] }} decks={decks} bot="easy" lib={lib} onClose={none} />);
    expect(m.split(href(xFile)).length - 1).toBe(2);
    expect(m).toContain(`A mirror match: both entries play ${esc(X)}`);
    const vs = renderToStaticMarkup(<MatchModal m={r1 as MatchView & { games: GameRec[] }} decks={decks} bot="easy" lib={lib} onClose={none} />);
    expect(vs).toContain(href(xFile));
    expect(vs).toContain(href(names.get(Y)!.file));
    expect(vs).not.toContain('mirror match');
  });

  it('"By deck": the combined record, the mirror games apart and the best finish', () => {
    const html = renderToStaticMarkup(<ByDeckSummary ev={ev} lib={lib} />);
    expect(html).toContain('By deck');
    expect(html).toContain('mirror games');
    const r = rowOf(html, X);
    expect(r).toContain(href(xFile));
    // X: lost to Y in round 2, X #2 beat Y twice (round 2 and the final); the mirror is not in it
    expect(r).toContain('<td>2-1</td>');
    expect(r).toContain('<td>5-3</td>'); // games: 2-0 (round 2), 1-2 (round 2), 2-1 (the final)
    expect(r).toContain('3 games in 1 match');
    expect(r).toContain('Won the event');
    expect(html).not.toContain(`>${esc(Y)}<`); // Y was entered once: no row
  });
});

describe('an event without copies', () => {
  const plain = { entrants: [{ name: X }, { name: Y }] };
  const plainEv = { ...ev, rounds: [{ round: 1, matches: [r2] }], bracket: [], standings: [row(Y, 1, 0, 2, 1), row(X, 0, 1, 1, 2)], champion: Y, entrants: [X, Y] };
  it('has no "By deck" summary', () => {
    expect(renderToStaticMarkup(<ByDeckSummary ev={plainEv} lib={eventLib(names, plain)} />)).toBe('');
    expect(renderToStaticMarkup(<ByDeckSummary ev={plainEv} lib={eventLib(names, undefined)} />)).toBe('');
  });
  it('renders the same with its setup or without one', () => {
    const views = (l: ReturnType<typeof eventLib>) =>
      renderToStaticMarkup(
        <>
          <StandingsTable rows={plainEv.standings} cut={1} lib={l} tiers />
          <RoundList rounds={plainEv.rounds} onOpen={none} lib={l} />
          <Champion name={Y} lib={l} />
        </>,
      );
    expect(views(eventLib(names, plain))).toBe(views(eventLib(names, undefined)));
    expect(views(eventLib(names, plain))).not.toContain('entry of');
    expect(renderToStaticMarkup(<RoundList rounds={plainEv.rounds} onOpen={none} lib={eventLib(names, plain)} />)).toBe(renderToStaticMarkup(<RoundList rounds={plainEv.rounds} onOpen={none} />));
  });
});
