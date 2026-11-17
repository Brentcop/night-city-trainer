// P2 (docs/ROADMAP.md §6): the deck profile leads with the deck's recorded results (with sample sizes, and a note when
// they predate the current simulator), says plainly when there are none, and shows the list with card images, falling
// back to text frames when art is off. Server-rendered to HTML: there is no DOM here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DeckProfilePage } from '../src/ui/pages/DeckProfile';
import { DeckTile } from '../src/ui/components/DeckIdentity';
import { needsEventH2H } from '../src/ui/components/DeckRecord';
import type { DeckRecord } from '../src/lib/deckRecord';
import { BUILTIN, loadCustom, upsertCustom } from '../src/lib/browserLibrary';
import { CARD_BY_ID, CARDS } from '../src/engine/cards';
import { refreshArt, setArtEnabled } from '../src/ui/art';
import { DECK_OBJECTIVES } from '../src/content/deckObjectives';
import { RATINGS, SEASONS } from '../src/data/index';
import { CURRENT_SIM_VERSION, isHistorical } from '../src/lib/playedRecord';
import { seasonVersions, staleLeaderRow } from '../src/lib/parentStrength';

const RATED = 'meta-rrg-dexter-midrange.txt';
// a deck with finals (seat samples, best and worst matchups) and tournament games: a Season 1 bred deck
const RECORDED = 's1-01-mutant-rry.txt';
// an unrecorded deck saved in this browser, with a list no library deck has (a saved copy of a library list shows that
// deck's recorded results: tests/your-stats-ui.test.tsx); every library deck has recorded games since event 16
const UNRECORDED_NAME = 'Unrecorded test deck';
const UNRECORDED = `custom:${UNRECORDED_NAME}`;
const saveUnrecorded = () => {
  const base = BUILTIN.find((d) => d.file === RATED)!.deck;
  const other = BUILTIN.flatMap((d) => d.deck.main).find((id) => !base.main.includes(id))!;
  return upsertCustom({ ...base, name: UNRECORDED_NAME, main: [other, ...base.main.slice(1)] });
};

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
    // UX-8: each figure is named for its source (Swiss record, power rating, finals or seasons vs the meta)
    for (const label of ['Games played', 'Swiss win rate', 'Going first / second', 'Power rank', 'Event finishes']) expect(html).toContain(label);
    expect(html).toMatch(/Finals vs the meta|Seasons vs the meta/);
    expect(html).toMatch(/the raw record in \d+ games of Swiss rounds/);
    expect(html).toMatch(/its power rating expects \d+% vs the whole field/);
    // a wrong ordinal ("1th", "22th"); 11th, 12th and 13th are right (a deck finished 12th of 47 in event 8)
    expect(html).not.toMatch(/\d+th pct|(?<!1)[123]th\b/);
    for (const [s, wrong] of [['1th', true], ['2th', true], ['23th', true], ['11th', false], ['12th of 47', false], ['113th', false], ['4th', false]] as const)
      expect(/(?<!1)[123]th\b/.test(s), s).toBe(wrong);
    expect(html).toMatch(/on the play \d+ games, on the draw \d+ games/);
    expect(html).toMatch(/Best matchup/);
    // the events, ratings and reports were re-recorded on SIM_VERSION 6; this deck's Season 1 finals vs the meta were not
    // re-run, and its leaderboard row holds Season 1 and 2 games (version 5), so its record is marked historical while
    // those are older than the simulator (tests/deck-record.test.ts covers the rule)
    const versions = seasonVersions(SEASONS.seasons);
    const row = SEASONS.leaderboard.find((r) => r.file === RECORDED)!;
    expect(Object.keys(row.seasons ?? {})).toContain('1');
    expect(isHistorical(versions['1'])).toBe(true);
    expect(staleLeaderRow(row, versions)).toBe(true);
    expect(html).toContain('Historical:');
    expect(html).not.toContain('No recorded games');
  });

  it('a Season 3 deck: its leaderboard row and finals were all played on the current simulator, so no historical note', () => {
    setArtEnabled(false);
    const file = 's3-03-cross-rrr.txt';
    const versions = seasonVersions(SEASONS.seasons);
    const row = SEASONS.leaderboard.find((r) => r.file === file)!;
    // the seasons file's own version is the oldest season's (5): the deck's row is judged on its own seasons instead
    expect(isHistorical(SEASONS.manifest?.simVersion)).toBe(true);
    expect(Object.keys(row.seasons ?? {})).toEqual(['3']);
    expect(versions['3']).toBe(CURRENT_SIM_VERSION);
    expect(staleLeaderRow(row, versions)).toBe(false);
    const html = renderToStaticMarkup(<DeckProfilePage file={file} />);
    expect(html).toContain('Recorded results');
    expect(html).toMatch(/Finals vs the meta|Seasons vs the meta/);
    expect(html).not.toContain('Historical:');
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

  it('a player list (imported by link): its profile shows its recorded games, credits its player and shows its drafted note', () => {
    setArtEnabled(false);
    const d = BUILTIN.find((x) => x.kind === 'shared' && x.prov.author && !x.prov.author.startsWith('anonymous'))!;
    const html = renderToStaticMarkup(<DeckProfilePage file={d.file} />);
    // the 18 imported lists have played in the recorded events since event 16 (before it: "No recorded games.")
    expect(RATINGS.decks.some((r) => r.name === d.deck.name)).toBe(true);
    expect(html).toContain('Recorded results');
    expect(html).not.toContain('No recorded games');
    expect(html).toMatch(/its power rating expects \d+% vs the whole field/);
    // it was never in a season, so nothing of it is historical
    expect(html).not.toContain('Historical:');
    expect(html).toContain('origin-badge origin-shared');
    expect(html).toContain('Player list');
    expect(html).not.toContain('choom.gg guide');
    // the 18 player lists' notes are agent-written drafts read off the list (2026-11-16), no longer placeholders
    const plan = html.slice(html.indexOf('>Game plan<'), html.indexOf('>Origin<'));
    expect(plan).toContain('Draft from the list');
    expect(plan).not.toContain('Needs the owner’s notes');
    expect(plan).not.toContain('Placeholder read off the list');
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

  it('labels the sim-ladder drafts, and marks a needs-owner placeholder as waiting for the owner’s notes', () => {
    setArtEnabled(false);
    const file = 'ladder-rrg-v-smasher-saburo.txt';
    const draft = plan(renderToStaticMarkup(<DeckProfilePage file={file} />));
    expect(draft).toContain('Draft from the list');
    expect(draft).not.toContain('Placeholder read off the list');
    // the sim-ladder notes are drafts, not placeholders (and since 2026-11-16 so are the player lists'), so turn one
    // into a placeholder for the check
    const note = DECK_OBJECTIVES[file];
    const saved = { ...note };
    Object.assign(note, { status: 'needs-owner', placeholder: true, objective: `Placeholder: ${note.objective}` });
    try {
      const p = plan(renderToStaticMarkup(<DeckProfilePage file={file} />));
      expect(p).toContain('Needs the owner’s notes');
      expect(p).toContain('Placeholder read off the list');
    } finally {
      delete note.placeholder;
      Object.assign(note, saved);
    }
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

describe('deck record panel: when it needs the tournament head-to-heads', () => {
  // An effect depends on this value. It used to be the record's `tournament` object, a new object on every render, so the
  // effect ran again after every render and set new state each time: the panel re-rendered without end, and going from
  // one deck's page to another (once the head-to-head file had loaded) froze the tab. It must be a plain boolean.
  it('is a plain boolean, never the tournament object', () => {
    const tournament = {} as NonNullable<DeckRecord['tournament']>;
    const finish = {} as DeckRecord['finishes'][number];
    const matchups = {} as NonNullable<DeckRecord['matchups']>;
    expect(needsEventH2H({ finishes: [], tournament })).toBe(true);
    expect(needsEventH2H({ finishes: [finish] })).toBe(true);
    expect(needsEventH2H({ finishes: [] })).toBe(false);
    expect(needsEventH2H({ finishes: [finish], tournament, matchups })).toBe(false);
  });
});
