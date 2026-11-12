// When each tournament event was recorded: the shared formatter (locale and time zone passed in, so these never depend
// on the machine), the <time> element, and where it shows (Events page, runner's saved runs, deck profile finishes).
// Server-rendered to HTML: there is no DOM here, so pages assert on the dateTime attribute, not the formatted text.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecordedAt, formatRecorded } from '../src/ui/components/RecordedAt';
import { TournamentsPage } from '../src/ui/pages/Tournaments';
import { TournamentRunnerPage } from '../src/ui/pages/TournamentRunner';
import { DeckProfilePage } from '../src/ui/pages/DeckProfile';
import { TOURNAMENT_INDEX } from '../src/data/tournamentIndex';
import { setArtEnabled } from '../src/ui/art';

const ISO = '2026-11-11T22:10:13.882Z';
const GB_UTC = { locale: 'en-GB', timeZone: 'UTC' };

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('formatRecorded', () => {
  it('formats to the minute in the given locale and time zone', () => {
    expect(formatRecorded(ISO, GB_UTC)).toBe('11 Nov 2026, 22:10');
    expect(formatRecorded(ISO, { locale: 'en-GB', timeZone: 'Asia/Tokyo' })).toBe('12 Nov 2026, 07:10');
    expect(formatRecorded(ISO, { ...GB_UTC, compact: true })).toBe('11 Nov');
  });
  it('gives null for a missing or invalid date, or an unknown time zone', () => {
    for (const bad of [undefined, null, '', 'not a date']) expect(formatRecorded(bad, GB_UTC)).toBeNull();
    expect(formatRecorded(ISO, { locale: 'en-GB', timeZone: 'Nowhere/Here' })).toBeNull();
  });
});

describe('RecordedAt', () => {
  it('renders a <time> with the ISO value as dateTime and title, between prefix and suffix', () => {
    const html = renderToStaticMarkup(<RecordedAt iso={ISO} prefix="at " suffix="." className="muted" {...GB_UTC} />);
    expect(html).toBe(`at <time dateTime="${ISO}" title="${ISO}" class="muted">11 Nov 2026, 22:10</time>.`);
  });
  it('renders nothing, prefix and suffix included, without a valid date', () => {
    expect(renderToStaticMarkup(<RecordedAt iso={undefined} prefix="at " suffix="." />)).toBe('');
    expect(renderToStaticMarkup(<RecordedAt iso="garbage" prefix="at " />)).toBe('');
  });
});

describe('where events show their recorded time', () => {
  const events = TOURNAMENT_INDEX.events;
  const timeOf = (iso: string) => `<time dateTime="${iso}" title="${iso}"`;

  it('Events page: every event chip, the selected event header and the head line', () => {
    const html = renderToStaticMarkup(<TournamentsPage />);
    const latest = events[events.length - 1];
    for (const e of events) expect(html).toContain(timeOf(e.date));
    expect(html).toContain('The latest was recorded <time');
    // the latest event is open by default: its date is in the head line, its chip and its header
    expect(html.split(timeOf(latest.date)).length - 1).toBe(3);
    expect(html).toMatch(/bots · recorded <time/);
  });

  it('runner: saved runs show when they were recorded; one without a date shows nothing', () => {
    const run = (id: string, date?: string) => ({ id, name: `Run ${id}`, date, bot: 'medium', format: 'Swiss', decks: {}, rounds: [], bracket: [], standings: [], champion: 'Some deck', phase: 'done' });
    localStorage.setItem('nct.runs.v1', JSON.stringify([run('a', ISO), run('b')]));
    const html = renderToStaticMarkup(<TournamentRunnerPage q={new URLSearchParams()} />);
    expect(html).toContain('Run a');
    expect(html).toContain('Run b');
    expect(html.split('<time ').length - 1).toBe(1);
    expect(html).toContain(timeOf(ISO));
  });

  it('deck profile: each event finish carries its compact recorded date', () => {
    setArtEnabled(false);
    const html = renderToStaticMarkup(<DeckProfilePage file="s1-01-mutant-rry.txt" />);
    const finishes = html.slice(html.indexOf('rec-finishes'));
    expect(finishes).toMatch(/class="rec-finish[^"]*"[^>]*title="Event #\d+ \(recorded [^)]+\):/);
    expect(finishes).toMatch(/ · <time dateTime="\d{4}-\d\d-\d\dT[^"]+" title="[^"]+" class="muted">/);
  });
});
