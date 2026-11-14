// "Run this event again" on the Events page (#/tournaments): what a re-run of a recorded event would be (the runner's
// setup link, and whether it plays the same games as the record), and the button with its one-line note. Each recorded
// event opens with its own decks, settings and seed; "same games" is tested on fixtures, because a deck list may
// legitimately change after an event is recorded.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILTIN } from '../src/lib/browserLibrary';
import type { LibraryDeck } from '../src/lib/library';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import { TOURNEY_BOTS } from '../src/ai/tiers';
import { parseRunParams } from '../src/ui/runParams';
import { eventRerun, rerunNote, type RecordedEvent } from '../src/ui/eventRerun';
import { RerunEvent } from '../src/ui/components/RerunEvent';
import { defaultSiteConfig, siteConfigText } from '../src/lib/siteConfig';
import { previewDraft } from '../src/ui/useSiteConfig';

const ROOT = path.resolve(__dirname, '..');
const BOTS = TOURNEY_BOTS.map((b) => b.key);
const NOW = { bots: BOTS, simVersion: CURRENT_SIM_VERSION };

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

describe('each recorded event opens with its own setup', () => {
  const files = fs.readdirSync(path.join(ROOT, 'public/tournaments')).filter((f) => /^event-\d+\.json$/.test(f));
  it('there are recorded events to check', () => expect(files.length).toBeGreaterThanOrEqual(7));
  for (const f of files)
    it(f, () => {
      const ev = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/tournaments', f), 'utf8')) as RecordedEvent & { manifest: { decks: { file: string }[] }; config: NonNullable<RecordedEvent['config']> };
      const r = eventRerun(ev, BUILTIN, NOW);
      if (!r.open) throw new Error(`${f} cannot be opened: ${r.why}`);
      const p = parseRunParams(new URLSearchParams(r.query), BOTS);
      expect(p.decks).toEqual(ev.manifest.decks.map((d) => d.file));
      expect(p).toMatchObject({ field: 'custom', format: 'swiss', rounds: ev.config.rounds, top: ev.config.top, bestOf: ev.config.bestOf, bot: ev.config.bot, seed: ev.config.seed });
    });
});

// ---------------------------------------------------------------- fixtures
const deck = (file: string, name: string, main: string[]): LibraryDeck => ({ file, kind: 'meta', deck: { name, legends: ['L1', 'L2', 'L3'], main, sideboard: [] }, prov: {} as LibraryDeck['prov'] });
const LIB = [deck('a.txt', 'Alpha', ['x', 'y']), deck('b.txt', 'Bravo', ['y', 'z']), deck('c.txt', 'Charlie', ['z', 'w'])];
const recorded = (over: Partial<RecordedEvent> = {}): RecordedEvent => ({
  config: { rounds: 3, top: 8, bestOf: 3, bot: 'hard', seed: 12 },
  simVersion: CURRENT_SIM_VERSION,
  decks: Object.fromEntries(LIB.map((d) => [d.deck.name, { file: d.file, legends: [...d.deck.legends], main: [...d.deck.main] }])),
  manifest: { decks: [LIB[2]!, LIB[0]!, LIB[1]!].map((d) => ({ file: d.file, name: d.deck.name })) },
  ...over,
});
const openOf = (ev: RecordedEvent) => {
  const r = eventRerun(ev, LIB, NOW);
  if (!r.open) throw new Error(`closed: ${r.why}`);
  return r;
};

describe('what a re-run would be', () => {
  it('current version and unchanged lists: the same games, in the manifest order', () => {
    const r = openOf(recorded());
    expect(r).toMatchObject({ same: true, otherVersion: false, changed: 0 });
    expect(r.query).toBe('f=custom&d=c.txt%2Ca.txt%2Cb.txt&fmt=swiss&t=8&bo=3&bot=hard&s=12&r=3');
  });
  it('without a manifest, the order the decks were written in', () => {
    expect(parseRunParams(new URLSearchParams(openOf(recorded({ manifest: undefined })).query), BOTS).decks).toEqual(['a.txt', 'b.txt', 'c.txt']);
  });
  it('another simulator version: opens, with different games', () => {
    expect(openOf(recorded({ simVersion: CURRENT_SIM_VERSION - 1 }))).toMatchObject({ same: false, otherVersion: CURRENT_SIM_VERSION - 1, changed: 0 });
    expect(openOf(recorded({ simVersion: undefined }))).toMatchObject({ same: false, otherVersion: null });
  });
  it('a changed list, a reordered list or a renamed deck: opens, with different games', () => {
    const ev = recorded();
    const changed = { ...ev.decks, Alpha: { ...ev.decks.Alpha!, main: ['x', 'q'] } };
    expect(openOf({ ...ev, decks: changed })).toMatchObject({ same: false, otherVersion: false, changed: 1 });
    const reordered = { ...ev.decks, Bravo: { ...ev.decks.Bravo!, main: ['z', 'y'] }, Charlie: { ...ev.decks.Charlie!, legends: ['L3', 'L2', 'L1'] } };
    expect(openOf({ ...ev, decks: reordered })).toMatchObject({ same: false, changed: 2 });
    const renamed = [deck('a.txt', 'Alpha v2', ['x', 'y']), LIB[1]!, LIB[2]!];
    expect(eventRerun(ev, renamed, NOW)).toMatchObject({ open: true, same: false, changed: 1 });
  });
  it('cannot be opened: a missing deck, a setup, no config, a bot the runner does not offer', () => {
    expect(eventRerun(recorded(), LIB.slice(0, 2), NOW)).toEqual({ open: false, why: 'missing-deck' });
    expect(eventRerun(recorded({ setup: { format: 'round-robin', entrants: [], bestOf: 1 } }), LIB, NOW)).toEqual({ open: false, why: 'arranged' });
    expect(eventRerun(recorded({ config: undefined }), LIB, NOW)).toEqual({ open: false, why: 'no-config' });
    expect(eventRerun(recorded({ config: { rounds: 3, top: 8, bestOf: 3, bot: 'hard-v1', seed: 12 } }), LIB, NOW)).toEqual({ open: false, why: 'bot' });
  });
  it('cannot be opened: what the link cannot carry', () => {
    const cfg = recorded().config!;
    for (const c of [{ ...cfg, top: 2 }, { ...cfg, bestOf: 7 }, { ...cfg, seed: 0 }, { ...cfg, seed: 2 ** 31 }, { ...cfg, rounds: 0 }, { ...cfg, rounds: 13 }]) expect(eventRerun(recorded({ config: c }), LIB, NOW)).toEqual({ open: false, why: 'settings' });
    // a deck entered twice
    const ev = recorded();
    expect(eventRerun({ ...ev, manifest: { decks: [...ev.manifest!.decks!, { file: 'a.txt', name: 'Alpha #2' }] }, decks: { ...ev.decks, 'Alpha #2': ev.decks.Alpha! } }, LIB, NOW)).toEqual({ open: false, why: 'settings' });
  });
  it("the runner's own pool decides what is in the library: a tournament -eor build or a duplicate list is not", () => {
    const eor = deck('a-eor.txt', 'Alpha EOR', ['x', 'y', 'e']);
    const ev = recorded({ decks: { Alpha: { file: 'a-eor.txt', legends: ['L1', 'L2', 'L3'], main: ['x', 'y', 'e'] }, Bravo: recorded().decks.Bravo! }, manifest: undefined });
    expect(eventRerun(ev, [eor, ...LIB], NOW)).toEqual({ open: false, why: 'missing-deck' });
    const dup = deck('d.txt', 'Delta', ['y', 'x']); // the same list as Alpha, which comes first
    const ev2 = recorded({ decks: { Delta: { file: 'd.txt', legends: ['L1', 'L2', 'L3'], main: ['y', 'x'] }, Bravo: recorded().decks.Bravo! }, manifest: undefined });
    expect(eventRerun(ev2, [...LIB, dup], NOW)).toEqual({ open: false, why: 'missing-deck' });
  });
});

describe('the button and its note', () => {
  const href = (html: string) => html.match(/<a class="btn" href="([^"]*)">▶ Run this event again<\/a>/)?.[1]?.replace(/&amp;/g, '&');
  it('same games', () => {
    const html = renderToStaticMarkup(<RerunEvent event={recorded()} lib={LIB} />);
    expect(href(html)).toBe('#/run?f=custom&d=c.txt%2Ca.txt%2Cb.txt&fmt=swiss&t=8&bo=3&bot=hard&s=12&r=3');
    expect(html).toContain('Opens the tournament runner with this event’s decks, settings and seed: the run plays the same games as recorded here, stays in this browser and changes nothing recorded.');
  });
  it('different games, with the reason', () => {
    const old = renderToStaticMarkup(<RerunEvent event={recorded({ simVersion: 7 })} lib={LIB} />);
    expect(href(old)).toBeDefined();
    expect(old).toContain(`The run stays in this browser and changes nothing recorded, but its games will differ from these: the event was recorded on simulator v7, and this site runs v${CURRENT_SIM_VERSION}.`);
    const ev = recorded();
    const both = { ...ev, simVersion: undefined, decks: { ...ev.decks, Alpha: { ...ev.decks.Alpha!, main: ['q'] }, Bravo: { ...ev.decks.Bravo!, main: ['q'] } } };
    expect(renderToStaticMarkup(<RerunEvent event={both} lib={LIB} />)).toContain(
      'but its games will differ from these: the event was recorded before events noted their simulator version; 2 of its decks have changed since.',
    );
    const one = { ...ev, decks: { ...ev.decks, Alpha: { ...ev.decks.Alpha!, main: ['q'] } } };
    expect(rerunNote(openOf(one), CURRENT_SIM_VERSION)).toMatch(/: 1 of its decks has changed since\.$/);
  });
  it('nothing when the event cannot be opened', () => {
    expect(renderToStaticMarkup(<RerunEvent event={recorded({ setup: { format: 'matches' } })} lib={LIB} />)).toBe('');
    expect(renderToStaticMarkup(<RerunEvent event={recorded()} lib={LIB.slice(1)} />)).toBe('');
  });
  it('nothing when the runner page is switched off', () => {
    const c = defaultSiteConfig();
    c.features.tournamentRunner = false;
    previewDraft(siteConfigText(c));
    try {
      expect(renderToStaticMarkup(<RerunEvent event={recorded()} lib={LIB} />)).toBe('');
    } finally {
      previewDraft(null);
    }
    expect(renderToStaticMarkup(<RerunEvent event={recorded()} lib={LIB} />)).toContain('▶ Run this event again');
  });
});
