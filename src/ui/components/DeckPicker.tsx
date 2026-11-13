import { allDecks } from '../../lib/browserLibrary';
import { deckColors } from '../../engine/deck';
import { shortCredit, type LibraryDeck } from '../../lib/library';
import { deckByFile } from '../deckLookup';
import { SMALL_SAMPLE, tileRecord } from '../../lib/playedRecord';
import { RATINGS } from '../../data/index';
import { deckSource, SOURCES } from '../../lib/deckSource';
import { loadHidden } from '../../lib/hiddenDecks';
import { useLibraryVersion } from '../useLibrary';
import { simTierFor, tierOptionText } from './TierBadges';

const RATED = new Map(RATINGS.decks.map((r) => [r.name, r]));
/** " · 68% in 485 games" from the deck's tournament record (an option can't be styled, so a small sample says so). */
function playedLabel(name: string) {
  const r = tileRecord(RATED.get(name));
  return r ? ` · ${Math.round(r.wr * 100)}% in ${r.n} games${r.n < SMALL_SAMPLE ? ' (small sample)' : ''}` : '';
}

/**
 * A deck <select>, grouped by source. Decks hidden in this browser are left out, except the one already picked; a
 * picked deck that no longer exists (deleted) shows as such instead of silently showing another deck.
 */
export function DeckPicker({ value, onChange, label }: { value: string; onChange: (key: string) => void; label?: string }) {
  useLibraryVersion(); // re-render after a save, delete or hide elsewhere
  const hidden = loadHidden();
  const decks = allDecks().filter((d) => !hidden.has(d.file) || d.file === value);
  const groups: [string, LibraryDeck[]][] = SOURCES.map((s) => [s.label, decks.filter((d) => deckSource(d) === s.key)]);
  const missing = !!value && !decks.some((d) => d.file === value);
  return (
    <label className="row">
      {label && <span className="muted small">{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 'min(340px, calc(100vw - 72px))' }} aria-label={label ? undefined : 'Deck'}>
        {missing && (
          <option value={value} disabled>
            {value.startsWith('custom:') ? `“${value.slice(7)}” (deleted from this browser)` : `${value} (not in the library)`}
          </option>
        )}
        {groups.map(([g, ds]) =>
          ds.length ? (
            <optgroup key={g} label={g}>
              {ds.map((d) => (
                <option key={d.file} value={d.file}>
                  {deckColors(d.deck)} · {d.deck.name.slice(0, 44)} — {shortCredit(d)}
                  {tierOptionText(d.tier, simTierFor(d.deck.name))}
                  {playedLabel(d.deck.name)}
                  {hidden.has(d.file) ? ' (hidden)' : ''}
                </option>
              ))}
            </optgroup>
          ) : null,
        )}
      </select>
    </label>
  );
}

/** Exact lookup by library file — use this for ?d= URL params, so a link to a deleted deck finds nothing instead of a look-alike. */
export function findDeck(key: string | undefined | null): LibraryDeck | undefined {
  return deckByFile(allDecks(), key);
}

/** The first deck not hidden in this browser (a default pick), or the first deck when every one is hidden. */
export function firstVisibleDeck(skip?: string): LibraryDeck | undefined {
  const hidden = loadHidden();
  const lib = allDecks();
  return lib.find((d) => !hidden.has(d.file) && d.file !== skip) ?? lib.find((d) => d.file !== skip);
}
