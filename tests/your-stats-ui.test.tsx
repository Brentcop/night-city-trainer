// Your tournaments in the pages (feature `yourTournamentStats`): deck tiles, the deck page's record panel, the Power
// ratings page's "Your decks" and the runner's line, in each state (nothing, a record only, a provisional rating, a copy
// of a library list, the feature off), the provisional badge never read as a recorded one, and the runner recording a
// finished run only. Server-rendered to HTML: there is no DOM here.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILTIN, loadCustom, upsertCustom } from '../src/lib/browserLibrary';
import type { DeckList } from '../src/engine/types';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import { addRun, emptyLedger, LEDGER_KEY, saveLedger } from '../src/lib/runLedger';
import { ledgerRunOf } from '../src/lib/runLedgerEntry';
import { defaultSiteConfig, siteConfigText } from '../src/lib/siteConfig';
import { previewDraft } from '../src/ui/useSiteConfig';
import { loadYourStatsRuntime } from '../src/ui/useYourStats';
import { setArtEnabled } from '../src/ui/art';
import { DeckTile, TierPair } from '../src/ui/components/DeckIdentity';
import { DeckRecordPanel } from '../src/ui/components/DeckRecord';
import { DeckProfilePage } from '../src/ui/pages/DeckProfile';
import { RatingsPage } from '../src/ui/pages/Ratings';
import { clearWords, YourStatsLine, yourStatsLineText } from '../src/ui/components/YourStats';
import { YourTierBadge } from '../src/ui/components/TierBadges';
import { simTier } from '../src/lib/simTier';
import { RATINGS } from '../src/data/index';

const ROOT = path.resolve(__dirname, '..');
const RATED = BUILTIN.find((d) => d.file === 'meta-rrg-dexter-midrange.txt')!;
const OPPS = BUILTIN.filter((d) => d.file !== RATED.file).slice(0, 4);
/** a list no library deck has: the rated deck with its first main-deck card swapped for another card */
const swapIn = OPPS[0]!.deck.main.find((id) => !RATED.deck.main.includes(id))!;
const MINE: DeckList = { ...RATED.deck, name: 'My own list', main: [swapIn, ...RATED.deck.main.slice(1)], sideboard: [] };

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

/** A finished run in which `me` plays each opponent `per` games (wins and losses alternating), with these bots. */
function storeRun(me: DeckList, o: { bot: string; per: number; id?: string; simVersion?: number }) {
  const decks: Record<string, { legends: string[]; main: string[] }> = { [me.name]: me };
  for (const d of OPPS) decks[d.deck.name] = d.deck;
  const ev = {
    id: o.id ?? `run-${o.bot}`,
    date: '2026-11-14T10:00:00.000Z',
    bot: o.bot,
    format: 'Round robin · Bo1',
    decks,
    rounds: OPPS.map((d, i) => ({
      round: i + 1,
      matches: [{ a: me.name, b: d.deck.name, winner: me.name, score: [0, 0], games: Array.from({ length: o.per }, (_, k) => ({ seed: k, first: (k % 2) as 0 | 1, winner: (k % 3 === 0 ? 1 : 0) as 0 | 1, turns: 9, reason: '' })) }],
    })),
    bracket: [],
    standings: [],
    champion: me.name,
    phase: 'done',
    simVersion: o.simVersion ?? CURRENT_SIM_VERSION,
  };
  const run = ledgerRunOf(ev)!;
  const prev = JSON.parse(localStorage.getItem(LEDGER_KEY) ?? 'null');
  expect(saveLedger(addRun(prev ? { ...emptyLedger(), ...prev } : emptyLedger(), run))).toBe(true);
}
const saved = (d: DeckList) => {
  expect(upsertCustom(d)).toBe(true);
  return loadCustom().find((x) => x.deck.name === d.name)!;
};
const off = () => {
  const c = defaultSiteConfig();
  c.features.yourTournamentStats = false;
  previewDraft(siteConfigText(c));
};

describe('nothing to show', () => {
  it('a deck saved here with no games anywhere says so on its tile and page', () => {
    const d = saved(MINE);
    expect(renderToStaticMarkup(<DeckTile d={d} />)).toContain('No recorded games');
    const page = renderToStaticMarkup(<DeckRecordPanel d={d} headingId="h" />);
    expect(page).toContain('No recorded games.');
    expect(page).not.toContain('Your tournaments');
    expect(renderToStaticMarkup(<YourStatsLine />)).toContain('Tournaments you finish here count toward your deck stats, in this browser only. Only All Hard runs give a provisional rating comparable with the recorded ones.');
    expect(renderToStaticMarkup(<YourStatsLine />)).not.toContain('Clear your tournament stats');
  });
});

describe('a record only (no Hard-bot games)', () => {
  it('the tile shows your record in place of "No recorded games"; the page says no provisional rating yet', () => {
    const d = saved(MINE);
    storeRun(MINE, { bot: 'medium', per: 3 });
    const tile = renderToStaticMarkup(<DeckTile d={d} />);
    expect(tile).not.toContain('No recorded games');
    // 12 games: 8 wins, 4 losses
    expect(tile).toMatch(/67%<\/b> in 12 games of your tournaments \(small sample\) · won 1 of 1/);
    expect(tile).toContain('Kept apart from the recorded results');
    expect(tile).not.toContain('tierb-yours');
    const page = renderToStaticMarkup(<DeckRecordPanel d={d} headingId="h" />);
    expect(page).toContain('>Your tournaments</h2>');
    expect(page).not.toContain('Recorded results');
    expect(page).not.toContain('No recorded games');
    expect(page).toContain('From the tournaments you ran in this browser only, kept apart from the recorded results.');
    expect(page).toContain('in 1 of your tournaments, won 1 · All Medium 8–4');
    expect(page).toContain('8–4 (wins–losses) (small sample)');
    expect(page).toContain('Only tournaments run with All Hard bots give a provisional rating, and this list has none of those games yet.');
    expect(page).not.toContain('Provisional rating');
    // Power ratings: the table says why it is empty, without waiting for the rating code
    const ratings = renderToStaticMarkup(<RatingsPage />);
    expect(ratings).toContain('Your decks');
    expect(ratings).toContain('None yet: only tournaments run with All Hard bots give a provisional rating.');
    expect(ratings).not.toContain('Working out');
  });

  it('older runs are kept but not counted, and the runner says so', () => {
    saved(MINE);
    storeRun(MINE, { bot: 'hard', per: 3, simVersion: CURRENT_SIM_VERSION - 1, id: 'old' });
    const line = renderToStaticMarkup(<YourStatsLine />);
    expect(line).toContain('1 older tournament ran on an earlier simulator and is left out.');
    expect(line).toContain('Clear your tournament stats');
    expect(renderToStaticMarkup(<DeckTile d={loadCustom()[0]!} />)).toContain('No recorded games');
  });
});

describe('a provisional rating (Hard-bot games against recorded decks)', () => {
  it('before the rating code has loaded, the page says it is being worked out (never "no Hard games")', () => {
    const d = saved(MINE);
    storeRun(MINE, { bot: 'hard', per: 6 });
    const page = renderToStaticMarkup(<DeckRecordPanel d={d} headingId="h" />);
    expect(page).toContain('Working out the provisional rating…');
    expect(page).not.toContain('has none of those games yet');
    expect(renderToStaticMarkup(<RatingsPage />)).toContain('Working out your provisional ratings…');
  });
  it('tile: record and a provisional badge that names its source; page: the rating, its range and place', async () => {
    const d = saved(MINE);
    storeRun(MINE, { bot: 'hard', per: 6 });
    storeRun(MINE, { bot: 'medium', per: 1 });
    await loadYourStatsRuntime();
    const tile = renderToStaticMarkup(<DeckTile d={d} />);
    expect(tile).toMatch(/in 28 games of your tournaments · won 2 of 2/);
    expect(tile).toContain('tierb tierb-yours');
    expect(tile).toContain('Your provisional tier');
    expect(tile).toContain('from your tournaments in this browser');
    expect(tile).toMatch(/title="Provisional tier from your tournaments in this browser \(All Hard bots\), not a recorded result: [SABCD]±?\. Expected [\d.]+% vs the recorded field, the library of \d+ decks, \(90% range/);
    // never drawn as the recorded Sim badge
    expect(tile).not.toContain('tierb-sim');
    const page = renderToStaticMarkup(<DeckRecordPanel d={d} headingId="h" />);
    expect(page).toContain('Provisional rating');
    // one place more than the recorded decks (53 of them since event 15 rated the Season 3 decks)
    const places = RATINGS.decks.length + 1;
    const placed = page.match(/expected vs the recorded field \(90% range \d+%–\d+%\) from 24 games with All Hard bots · would place \d+(?:st|nd|rd|th) of (\d+) in the <a href="#\/ratings">Power ratings<\/a>/);
    expect(placed?.[1]).toBe(String(places));
    expect(page).toContain('in 2 of your tournaments, won 2 · All Hard 16–8 · All Medium 0–4');
    expect(page).toContain('16–12 (wins–losses)');
    expect(page).not.toContain('Only tournaments run with All Hard bots');
    // Power ratings: a separate table, after the recorded one
    const ratings = renderToStaticMarkup(<RatingsPage />);
    const yours = ratings.indexOf('Your decks');
    expect(yours).toBeGreaterThan(ratings.indexOf('</table>'));
    expect(ratings.slice(yours)).toContain('My own list');
    expect(ratings.slice(yours)).toContain('Expected win % vs the recorded field (90% range)');
    expect(ratings.slice(yours).match(/\d+(?:st|nd|rd|th) of (\d+)/)?.[1]).toBe(String(places));
    expect(ratings.slice(0, yours)).not.toContain('My own list');
    // the runner's line counts it
    expect(renderToStaticMarkup(<YourStatsLine />)).toContain('Your deck stats count 2 of your tournaments (28 games), in this browser only. Only All Hard runs give a provisional rating comparable with the recorded ones (1 of yours).');
  });

  it('a list that never met a recorded deck says its place is only the prior', async () => {
    const other: DeckList = { ...OPPS[1]!.deck, name: 'Other own list', main: [MINE.main[1]!, ...OPPS[1]!.deck.main.slice(1)], sideboard: [] };
    const d = saved(MINE);
    saved(other);
    const ev = {
      id: 'island',
      date: '2026-11-14T10:00:00.000Z',
      bot: 'hard',
      format: 'Bo5',
      decks: { [MINE.name]: MINE, [other.name]: other },
      rounds: [{ round: 1, matches: [{ a: MINE.name, b: other.name, winner: MINE.name, score: [3, 2], games: [0, 1, 0, 1, 0].map((w, k) => ({ seed: k, first: (k % 2) as 0 | 1, winner: w as 0 | 1, turns: 9, reason: '' })) }] }],
      bracket: [],
      standings: [],
      champion: MINE.name,
      phase: 'done',
      simVersion: CURRENT_SIM_VERSION,
    };
    expect(saveLedger(addRun(emptyLedger(), ledgerRunOf(ev)!))).toBe(true);
    await loadYourStatsRuntime();
    const page = renderToStaticMarkup(<DeckRecordPanel d={d} headingId="h" />);
    expect(page).toContain('none of them against a recorded deck: its place against the recorded field is only the prior');
    expect(renderToStaticMarkup(<DeckTile d={d} />)).not.toContain('tierb-yours');
    expect(renderToStaticMarkup(<RatingsPage />)).toContain('never met a recorded deck: only the prior places it');
  });
});

describe('a copy of a library list', () => {
  it('shows the library deck’s recorded results, names it, and adds your record without a provisional rating', async () => {
    const copy = saved({ ...RATED.deck, name: 'Dexter, renamed', sideboard: [] });
    const tile = renderToStaticMarkup(<DeckTile d={copy} />);
    // the ratings' pool has Swiss games only when it holds a recorded event of the current simulator version; on the
    // re-rating of 2026-11-25 (SIM_VERSION 13, rating runs only, the events are version 9's) no row has a Swiss record, and
    // the tile and the deck page then show none (no "Swiss win rate")
    if (RATINGS.decks.find((r) => r.name === RATED.deck.name)?.gamesRecord) expect(tile).toMatch(/\d+%<\/b> in [\d,]+ Swiss games/);
    else expect(tile).not.toContain('Swiss games');
    expect(tile).toContain(`Same list as ${RATED.deck.name}`);
    expect(tile).toContain('tierb tierb-sim');
    // the same recorded Sim tier as the library deck (choom.gg's editorial tier belongs to the library entry, not the list)
    const simOf = (html: string) => html.match(/<span class="tierb tierb-sim[^]*?<\/span><\/span>/)?.[0];
    expect(simOf(renderToStaticMarkup(<TierPair d={copy} />))).toBe(simOf(renderToStaticMarkup(<TierPair d={RATED} />)));
    expect(simOf(renderToStaticMarkup(<TierPair d={copy} />))).toContain('Sim tier S');
    storeRun({ ...RATED.deck, name: 'Dexter, renamed' }, { bot: 'hard', per: 6 });
    await loadYourStatsRuntime();
    const page = renderToStaticMarkup(<DeckRecordPanel d={copy} headingId="h" />);
    expect(page).toContain('Same list as <a href="#/deck?d=meta-rrg-dexter-midrange.txt">');
    expect(page).toContain(': these are its recorded results.');
    expect(page).toContain('>Recorded results</h2>');
    expect(page).toContain('Games played');
    expect(page).toContain('<h3 class="rec-sub">Your tournaments</h3>');
    expect(page).not.toContain('Provisional rating');
    // the library deck shows the same record of yours (same list), and resolves its recorded results as before
    const lib = renderToStaticMarkup(<DeckRecordPanel d={RATED} headingId="h" />);
    expect(lib).toContain('<h3 class="rec-sub">Your tournaments</h3>');
    expect(lib).not.toContain('Same list as');
    // the tile leads with the Swiss record when there is one, and falls back to your tournaments' record when there is not
    // (no Swiss record in the ratings' pool since the re-rating of 2026-11-25, see above)
    expect(renderToStaticMarkup(<DeckTile d={RATED} />).includes('of your tournaments')).toBe(!RATINGS.decks.find((r) => r.name === RATED.deck.name)?.gamesRecord);
    // the whole page renders for the copy
    expect(renderToStaticMarkup(<DeckProfilePage file={copy.file} />)).toContain('Same list as');
  });
});

describe('the feature off', () => {
  it('shows nothing from your tournaments; the runner line is hidden', async () => {
    const d = saved(MINE);
    storeRun(MINE, { bot: 'hard', per: 6 });
    await loadYourStatsRuntime();
    off();
    expect(renderToStaticMarkup(<DeckTile d={d} />)).toContain('No recorded games');
    expect(renderToStaticMarkup(<DeckTile d={d} />)).not.toContain('tierb-yours');
    const page = renderToStaticMarkup(<DeckRecordPanel d={d} headingId="h" />);
    expect(page).toContain('No recorded games.');
    expect(page).not.toContain('Your tournaments');
    expect(renderToStaticMarkup(<YourStatsLine />)).toBe('');
    expect(renderToStaticMarkup(<RatingsPage />)).not.toContain('Your decks');
  });
});

describe('wording', () => {
  it('the runner line and the clear dialog', () => {
    expect(yourStatsLineText({ runs: 1, games: 40, hardRuns: 0, older: 2 })).toBe(
      'Your deck stats count 1 of your tournaments (40 games), in this browser only. Only All Hard runs give a provisional rating comparable with the recorded ones (0 of yours). 2 older tournaments ran on an earlier simulator and are left out.',
    );
    expect(clearWords(3)).toEqual({
      title: 'Clear your tournament stats?',
      body: 'The record and provisional ratings from 3 tournaments you ran in this browser are removed from your deck tiles and pages. Your saved runs stay, and are not counted again. This cannot be undone.',
    });
  });
  it('the provisional badge says "Yours" and names its source; a recorded word never labels it', () => {
    const t = simTier({ wrField: 0.52, wrFieldLo: 0.46, wrFieldHi: 0.54, games: 30 });
    const html = renderToStaticMarkup(<YourTierBadge tier={t} />);
    expect(html).toContain('>Yours<');
    expect(html).toContain('<span class="sr-only">Your provisional tier B, from your tournaments in this browser</span>');
    // a range across a band edge is marked uncertain
    expect(renderToStaticMarkup(<YourTierBadge tier={simTier({ wrField: 0.52, wrFieldLo: 0.4, wrFieldHi: 0.63, games: 30 })} />)).toContain('Your provisional tier B, uncertain,');
    expect(html).not.toMatch(/Sim tier|recorded tournaments/);
    expect(renderToStaticMarkup(<YourTierBadge tier={{ ...t, letter: null, unrated: 'few-games', games: 8 }} showUnrated />)).toContain('none yet, too few games (8 of the 20 needed)');
  });
  it('the runner line and Your decks carry no owner commands', () => {
    const f = fs.readFileSync(path.join(ROOT, 'src/ui/components/YourStats.tsx'), 'utf8');
    expect(f).not.toMatch(/<code>(npm run|npx tsx)/);
  });
});

describe('the runner records a finished run, never a stopped one', () => {
  it('records under phase done only, and keeps its saved runs as they were', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/ui/pages/TournamentRunner.tsx'), 'utf8');
    const calls = src.split('\n').filter((l) => l.includes('recordRun('));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/if \(out\.phase === 'done'\) .*recordRun\(out\)/);
    // the saved-runs helpers are unchanged: same key, same cap
    expect(src).toContain("const SAVE_KEY = 'nct.runs.v1';");
    expect(src).toContain('const MAX_RUNS = 6;');
    expect(src).toContain('<YourStatsLine refused={ledgerRefused} />');
  });
});
