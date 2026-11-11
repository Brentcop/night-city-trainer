// P2 (docs/ROADMAP.md §6): the deck profile leads with the deck's recorded results (with sample sizes, and a note when
// they predate the current simulator), says plainly when there are none, and shows the list with card images, falling
// back to text frames when art is off. Server-rendered to HTML: there is no DOM here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DeckProfilePage } from '../src/ui/pages/DeckProfile';
import { DeckTile } from '../src/ui/components/DeckIdentity';
import { BUILTIN, loadCustom, upsertCustom } from '../src/lib/browserLibrary';
import { CARD_BY_ID, CARDS } from '../src/engine/cards';
import { refreshArt, setArtEnabled } from '../src/ui/art';

const RATED = 'meta-rrg-dexter-midrange.txt';
// a deck with finals (seat samples, best and worst matchups) and tournament games: a Season 1 bred deck
const RECORDED = 's1-01-mutant-rry.txt';
// every library deck plays in the recorded events, so the unrecorded deck is one saved in this browser
const UNRECORDED_NAME = 'Unrecorded test deck';
const UNRECORDED = `custom:${UNRECORDED_NAME}`;
const saveUnrecorded = () => upsertCustom({ ...BUILTIN.find((d) => d.file === RATED)!.deck, name: UNRECORDED_NAME });

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => {
  setArtEnabled(false);
  vi.unstubAllGlobals();
});

describe('deck profile: recorded results first', () => {
  it('shows the record right after the name, with samples, and no historical note on current data', () => {
    setArtEnabled(false);
    const html = renderToStaticMarkup(<DeckProfilePage file={RECORDED} />);
    const name = BUILTIN.find((d) => d.file === RECORDED)!.deck.name;
    const h1 = html.indexOf('</h1>');
    const rec = html.indexOf('Recorded results');
    expect(html.slice(html.indexOf('<h1'), h1)).toContain(name.replace(/'/g, '&#x27;'));
    expect(rec).toBeGreaterThan(h1);
    // nothing else between the name and the record
    expect(html.slice(h1, rec)).not.toMatch(/Legends:|Practice with it|Origin|Decklist/);
    expect(rec).toBeLessThan(html.indexOf('Legends:'));
    expect(rec).toBeLessThan(html.indexOf('Decklist'));
    // tiles with their samples
    for (const label of ['Games played', 'Win rate', 'Going first / second', 'Vs the meta field', 'Rating and rank', 'Event finishes']) expect(html).toContain(label);
    expect(html).toMatch(/\d+ games in Swiss rounds/);
    expect(html).toMatch(/on the play \d+ games, on the draw \d+ games/);
    expect(html).toMatch(/Best matchup/);
    // every bundled source carries the current SIM_VERSION, so the note stays hidden (tests/deck-record.test.ts covers
    // the note coming back once SIM_VERSION moves past the recorded data)
    expect(html).not.toContain('Historical:');
    expect(html).not.toContain('No recorded games');
  });

  it('says plainly when a deck has no recorded games', () => {
    setArtEnabled(false);
    saveUnrecorded();
    const html = renderToStaticMarkup(<DeckProfilePage file={UNRECORDED} />);
    expect(html).toContain('Recorded results');
    expect(html).toContain('No recorded games.');
    expect(html).not.toContain('Historical:');
    expect(html).not.toContain('Games played');
  });

  it('gallery tiles lead with the tournament record, or say there is none', () => {
    const rated = renderToStaticMarkup(<DeckTile d={BUILTIN.find((d) => d.file === RATED)!} />);
    expect(rated).toMatch(/\d+%<\/b> in [\d,]+ Swiss games/);
    saveUnrecorded();
    const none = renderToStaticMarkup(<DeckTile d={loadCustom().find((d) => d.file === UNRECORDED)!} />);
    expect(none).toContain('No recorded games');
  });
});

describe('deck profile: the list with card images', () => {
  const deck = () => BUILTIN.find((d) => d.file === RATED)!.deck;

  it('art off: card images fall back to text frames, grouped by type with copy badges, and nothing is fetched', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    setArtEnabled(false);
    refreshArt(true);
    const html = renderToStaticMarkup(<DeckProfilePage file={RATED} />);
    const visual = html.slice(html.indexOf('class="deck-visual"'));
    expect(visual).not.toContain('<img');
    expect(visual).toContain('tcg-frame');
    for (const g of ['Legends (3)', 'Units (']) expect(visual).toContain(g);
    // each card is a keyboard-operable button that opens the card dialog, its copies in the name and the badge
    const unit = deck().main.find((id) => CARD_BY_ID[id]?.type === 'Unit')!;
    const n = deck().main.filter((id) => id === unit).length;
    expect(visual).toMatch(new RegExp(`role="button" tabindex="0" aria-label="[^"]*, ${n} cop(y|ies): open card details"`));
    expect(visual).toContain(`<span class="tcg-count">×${n}</span>`);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('art on: real card images, lazy-loaded, with the text frame shown until they load', async () => {
    const items = CARDS.filter((c) => c.eid).map((c) => ({ external_id: c.eid, image_url: `https://art.test/${c.id}.png` }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({ ok: true, json: async () => (url.includes('offset=0&') ? { total: items.length, items } : { total: items.length, items: [] }) })),
    );
    setArtEnabled(true);
    await refreshArt(true);
    const html = renderToStaticMarkup(<DeckProfilePage file={RATED} />);
    const visual = html.slice(html.indexOf('class="deck-visual"'));
    const withArt = deck().legends.find((id) => CARD_BY_ID[id]?.eid)!;
    expect(visual).toContain(`src="https://art.test/${withArt}.png"`);
    expect(visual).toMatch(/<img[^>]*loading="lazy"/);
    expect(visual).toContain('tcg-frame'); // still loading: the frame holds the box
  });

  it('the compact list view keeps a thumbnail, copies and a name button on every row', () => {
    setArtEnabled(false);
    localStorage.setItem('nct.deckView', 'list');
    const html = renderToStaticMarkup(<DeckProfilePage file={RATED} />);
    expect(html).not.toContain('class="deck-visual"');
    const rows = [...html.matchAll(/<li class="deck-row">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    const distinct = new Set([...deck().legends, ...deck().main, ...deck().sideboard]).size;
    expect(rows.length).toBe(distinct);
    for (const r of rows) {
      expect(r).toContain('class="card-thumb is-click"');
      expect(r).toMatch(/<button type="button" class="card-name-btn"/);
    }
    expect(html).toMatch(/<button type="button" class="on" aria-pressed="true">☰ List<\/button>/);
  });
});

describe('deck profile: game plan', () => {
  const plan = (html: string) => html.slice(html.indexOf('>Game plan<'), html.indexOf('>Origin<'));

  it('shows the note after the record, before the origin, with where it came from', () => {
    setArtEnabled(false);
    const html = renderToStaticMarkup(<DeckProfilePage file="RRG-smash-the-curve.txt" />);
    expect(html.indexOf('>Game plan<')).toBeGreaterThan(html.indexOf('Recorded results'));
    expect(html.indexOf('>Game plan<')).toBeLessThan(html.indexOf('>Origin<'));
    const p = plan(html);
    expect(p).toContain('Draft from the choom.gg guide by Cacheira');
    expect(html).toMatch(/<section class="panel flair dp-plan[^"]*" aria-labelledby="([^"]+)"><div class="rec-head"><h2 id="\1"/);
    for (const h of ['Plan', 'Key cards', 'Signs it’s working']) expect(p).toContain(`>${h}</h3>`);
    expect(p).not.toContain('may be out of date');
  });

  it('labels Strategy page drafts, list drafts and parent drafts', () => {
    setArtEnabled(false);
    expect(plan(renderToStaticMarkup(<DeckProfilePage file={RATED} />))).toMatch(/Draft from the Strategy page guide <a href="#\/guides\?g=rrg-dexter-midrange">/);
    expect(plan(renderToStaticMarkup(<DeckProfilePage file="s1-07-explorer-ryy.txt" />))).toContain('Draft from the list');
    expect(plan(renderToStaticMarkup(<DeckProfilePage file={RECORDED} />))).toContain('Draft from the parent deck’s notes');
  });

  it('marks the owner’s decks as waiting for the owner’s notes', () => {
    setArtEnabled(false);
    const p = plan(renderToStaticMarkup(<DeckProfilePage file="ladder-rrg-v-smasher-saburo.txt" />));
    expect(p).toContain('Needs the owner’s notes');
    expect(p).toContain('Placeholder read off the list');
  });

  it('says when the list changed since the note was written', async () => {
    setArtEnabled(false);
    const d = BUILTIN.find((x) => x.file === RATED)!;
    const main = d.deck.main;
    d.deck.main = main.slice(1);
    try {
      expect(plan(renderToStaticMarkup(<DeckProfilePage file={RATED} />))).toContain('the note may be out of date');
    } finally {
      d.deck.main = main;
    }
  });
});
