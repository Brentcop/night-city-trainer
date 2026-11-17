// The Power ratings page's group filters (src/ui/pages/Ratings.tsx RATING_GROUPS): every rated library deck can be
// reached through one of them. Before event 16 the sim-ladder decks had none, and the lists imported from players
// (the library's kind `shared`) were not rated at all.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILTIN } from '../src/lib/browserLibrary';
import { RATINGS } from '../src/data/index';
import { setArtEnabled } from '../src/ui/art';
import { originKind } from '../src/ui/components/DeckIdentity';
import { RATING_GROUPS, RatingsPage } from '../src/ui/pages/Ratings';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setArtEnabled(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the Power ratings page', () => {
  const byName = new Map(BUILTIN.map((d) => [d.deck.name, d]));
  const kindOfRow = (name: string) => originKind(byName.get(name)?.prov, byName.get(name)?.kind);

  it('has a group filter for every origin a rated library deck has', () => {
    const keys = new Set(RATING_GROUPS.map(([k]) => k));
    expect(keys.has('')).toBe(true);
    const rated = RATINGS.decks.filter((r) => byName.has(r.name));
    expect(rated.length).toBeGreaterThanOrEqual(60);
    const missing = [...new Set(rated.map((r) => kindOfRow(r.name)))].filter((k) => !keys.has(k));
    expect(missing).toEqual([]);
  });

  it('offers only the groups that have a rated deck, so no filter opens an empty table', () => {
    const html = renderToStaticMarkup(<RatingsPage />);
    const shown = [...html.matchAll(/<button class="[^"]*" aria-pressed="(?:true|false)">([^<]+)<\/button>/g)].map((m) => m[1]);
    const withDecks = RATING_GROUPS.filter(([k]) => !k || RATINGS.decks.some((r) => byName.has(r.name) && kindOfRow(r.name) === k)).map(([, label]) => label);
    expect(shown).toEqual(withDecks);
    expect(shown[0]).toBe('All decks');
    // the optimizer variants were archived, so that group has no rated deck today and is not offered
    expect(RATINGS.decks.some((r) => kindOfRow(r.name) === 'nc-variant')).toBe(false);
    expect(shown).not.toContain('Variants');
  });

  it('rates the lists players shared, and offers them as a group', () => {
    const shared = BUILTIN.filter((d) => d.kind === 'shared');
    expect(shared.length).toBeGreaterThanOrEqual(18);
    // every one of them has a row (they joined the recorded events with event 16)
    for (const d of shared) expect(RATINGS.decks.some((r) => r.name === d.deck.name), d.deck.name).toBe(true);
    const html = renderToStaticMarkup(<RatingsPage />);
    expect(html).toMatch(/<button[^>]*>Player lists<\/button>/);
    expect(html).toMatch(/<button[^>]*>Sim ladder<\/button>/);
    expect(html).toContain('origin-badge origin-shared');
    // a player's name is text in the badge, never a card mention
    const withPlayer = shared.find((d) => d.prov.author && !d.prov.author.startsWith('anonymous'))!;
    expect(html).toContain(withPlayer.deck.name.replace(/&/g, '&amp;'));
  });
});
