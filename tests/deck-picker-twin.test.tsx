// Deck pickers find recorded results as the gallery's tiles do (ROADMAP2 §11 item 12): a library deck by its own name, a
// deck saved in this browser through the library deck with the same list (recordedRow / simTierOf in TierBadges.tsx), and
// a saved deck whose list differs from every library list shows no tier and no record. Server-rendered: no DOM.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILTIN, loadCustom, saveCustom } from '../src/lib/browserLibrary';
import { RATINGS } from '../src/data/index';
import { SIM_TIER_MIN_GAMES, simTierShort } from '../src/lib/simTier';
import { libraryTwin } from '../src/lib/listTwin';
import { deckOptionTail, DeckPicker } from '../src/ui/components/DeckPicker';
import { EntrantPicker } from '../src/ui/components/EventSetup';
import { simTierFor } from '../src/ui/components/TierBadges';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 };
}
beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

const RATED = new Map(RATINGS.decks.map((r) => [r.name, r]));
/** A rated library deck that is the twin its own copy resolves to (the first library deck with that list and a rating). */
const lib = BUILTIN.find((d) => (RATED.get(d.deck.name)?.games ?? 0) >= SIM_TIER_MIN_GAMES && libraryTwin({ file: 'custom:x', deck: d.deck }, BUILTIN, (t) => RATED.has(t.deck.name)) === d)!;
const copy = { file: 'custom:My renamed copy', deck: { ...lib.deck, name: 'My renamed copy' } };
const otherCard = BUILTIN.flatMap((d) => d.deck.main).find((id) => !lib.deck.main.includes(id))!;
const changed = { file: 'custom:My edited copy', deck: { ...lib.deck, name: 'My edited copy', main: [...lib.deck.main.slice(1), otherCard] } };

describe('deck pickers resolve recorded results by list, as tiles do', () => {
  it('a saved copy of a library list gets the library deck’s Sim tier and record', () => {
    expect(lib).toBeDefined();
    const tier = simTierShort(simTierFor(lib.deck.name));
    const own = deckOptionTail({ ...lib, tier: undefined });
    expect(own).toContain(`[Sim ${tier}]`);
    // the ratings' pool has Swiss games only when it holds a recorded event of the current simulator version; on the
    // re-rating of 2026-11-25 (SIM_VERSION 13, rating runs only, the events are version 9's) no row has a Swiss record, and
    // the tile and the deck page then show none (no "Swiss win rate")
    if (RATED.get(lib.deck.name)?.gamesRecord) expect(own).toMatch(/% in \d+ games/);
    else expect(own).not.toMatch(/% in \d+ games/);
    expect(deckOptionTail(copy)).toBe(own);
  });
  it('a saved deck with a changed list gets none', () => {
    expect(deckOptionTail(changed)).toBe('');
  });
  it('a library deck still resolves by its own name', () => {
    expect(deckOptionTail(lib)).toContain(`[Sim ${simTierShort(simTierFor(lib.deck.name))}]`);
  });
  it('the <select> picker shows the twin’s tier on the saved copy’s option', () => {
    saveCustom([
      { ...copy.deck, sideboard: [] },
      { ...changed.deck, sideboard: [] },
    ]);
    const html = renderToStaticMarkup(<DeckPicker value={copy.file} onChange={() => {}} />);
    const option = (file: string) => html.match(new RegExp(`<option value="${file.replace(/[:]/g, '\\$&')}"[^>]*>([^<]*)</option>`))?.[1] ?? '';
    expect(option(copy.file)).toContain(`[Sim ${simTierShort(simTierFor(lib.deck.name))}]`);
    expect(option(changed.file)).not.toContain('[Sim');
  });
  it('the runner’s entrant picker shows the twin’s Sim badge on the saved copy, and none on the changed list', () => {
    saveCustom([
      { ...copy.deck, sideboard: [] },
      { ...changed.deck, sideboard: [] },
    ]);
    const pool = loadCustom();
    expect(pool.map((d) => d.file)).toEqual([copy.file, changed.file]);
    const sr = `Sim tier ${simTierFor(lib.deck.name).letter}`;
    const entered = (file: string) => renderToStaticMarkup(<EntrantPicker pool={pool} entrants={[{ file, copy: 1 }]} onChange={() => {}} />);
    // the entrant row of each (the add list below names both decks, so look at the ordered list only)
    const rowOf = (html: string) => html.match(/<ol class="ev-entrant-list"[\s\S]*?<\/ol>/)?.[0] ?? '';
    expect(rowOf(entered(copy.file))).toContain(sr);
    expect(rowOf(entered(changed.file))).not.toContain('Sim tier');
  });
});
