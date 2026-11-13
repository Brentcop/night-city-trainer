// Deck Lab synergy-package controls (docs/SYNERGIES.md "Using packages when building"): the "Synergies" fieldset on
// the Tune tab (keep toggles for the packages the submitted list holds, and package moves on or off), the package
// picker on the Breed tab, and the package chips on results. The logic is in src/lib/deckPackages.ts.
import { useId, useMemo } from 'react';
import type { DeckList } from '../../engine/types';
import { ACTIVE_SYNERGIES, SYNERGIES, synergiesIn } from '../../content/synergies';
import { DECK_OBJECTIVES } from '../../content/deckObjectives';
import { builtAroundIds, defaultKeep, packageChanges, packageCompatibility, packageName } from '../../lib/deckPackages';
import { roleText } from './SynergyStats';
import { MentionText } from './CardMention';

/** Toggle one id in a list (order kept). */
export const toggleId = (list: readonly string[], id: string): string[] => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
/** Pick a package for breeding: at most `max`, the oldest pick dropped when a new one would exceed it. */
export const pickPackage = (list: readonly string[], id: string, max = 2): string[] => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(-max));

/** The Lab's default keep for a list: the packages its deck objective names (a library deck), else those it is built around. */
export function labDefaultKeep(deck: Pick<DeckList, 'legends' | 'main'>, file?: string): { keep: string[]; from: 'objective' | 'built-around' } {
  const named = file ? DECK_OBJECTIVES[file]?.synergies : undefined;
  return { keep: defaultKeep(deck, named), from: named?.length ? 'objective' : 'built-around' };
}

/** Tune tab: which of the list's packages to keep, and whether to try whole-package moves. */
export function LabSynergies({
  deck,
  keep,
  from,
  onKeep,
  moves,
  onMoves,
  disabled,
}: {
  deck: Pick<DeckList, 'legends' | 'main'>;
  keep: readonly string[];
  /** where the default keep came from (said in the caption) */
  from: 'objective' | 'built-around';
  onKeep: (ids: string[]) => void;
  moves: boolean;
  onMoves: (on: boolean) => void;
  disabled?: boolean;
}) {
  const headId = useId();
  const found = useMemo(() => synergiesIn(deck), [deck]);
  return (
    <fieldset className="lab-synergies" aria-describedby={headId} disabled={disabled}>
      <legend>Synergies</legend>
      <p id={headId} className="muted small" style={{ margin: 0 }}>
        Kept packages are never cut below their working minimum (the built-around count, or the pieces they need at all), so a swap can't break one
        half of a pair. By default the lab keeps the packages {from === 'objective' ? "this deck's game plan names" : 'this list is built around'}. Package moves
        (complete, add, swap or remove a whole package) are off by default; turn them on to test a few beside the one-card swaps.
      </p>
      {found.length ? (
        <ul className="lab-pkg-list">
          {found.map((x) => (
            <li key={x.synergy.id}>
              <label title={`${x.synergy.description} Online: ${x.synergy.onlineText}`}>
                <input type="checkbox" checked={keep.includes(x.synergy.id)} onChange={() => onKeep(toggleId(keep, x.synergy.id))} /> Keep{' '}
                <b>
                  <MentionText text={x.synergy.name} passive />
                </b>
              </label>{' '}
              {x.builtAround && <span className="tag">built around</span>}
              {x.synergy.dormant && <span className="tag" title={x.synergy.dormant.reason}>dormant</span>} <span className="muted small">{roleText(x.copies)}</span>
            </li>
          ))}
          {keep
            .filter((id) => !found.some((x) => x.synergy.id === id))
            .map((id) => (
              <li key={id}>
                <label>
                  <input type="checkbox" checked onChange={() => onKeep(toggleId(keep, id))} /> Keep <b>{packageName(id)}</b>
                </label>{' '}
                <span className="muted small">named in the game plan; this list doesn&apos;t hold it, so keeping it changes nothing</span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="muted small" style={{ margin: 0 }}>
          This list holds no package of the synergy catalogue.
        </p>
      )}
      <label className="row small">
        <input type="checkbox" checked={moves} onChange={(e) => onMoves(e.target.checked)} /> Try package moves (adds about 3 tests per generation)
      </label>
    </fieldset>
  );
}

/** Breed tab: pick one or two packages to build the new decks around. */
export function PackagePicker({ value, onChange, fitAll, onFitAll }: { value: readonly string[]; onChange: (ids: string[]) => void; fitAll: boolean; onFitAll: (on: boolean) => void }) {
  const headId = useId();
  const compat = useMemo(() => (value.length ? packageCompatibility(value) : null), [value]);
  return (
    <fieldset className="lab-synergies" aria-describedby={headId}>
      <legend>Build around synergies</legend>
      <p id={headId} className="muted small" style={{ margin: 0 }}>
        Pick one or two packages (optional). Explorers are then built on Legend trios that can hold them and topped up to each package&apos;s built-around minimum.
      </p>
      <div className="chip-row" role="group" aria-label="Packages">
        {ACTIVE_SYNERGIES.map((s) => (
          <button key={s.id} type="button" className={`chip-btn${value.includes(s.id) ? ' on' : ''}`} aria-pressed={value.includes(s.id)} title={s.description} onClick={() => onChange(pickPackage(value, s.id))}>
            <MentionText text={s.name} passive />
          </button>
        ))}
      </div>
      {SYNERGIES.some((s) => s.dormant) && (
        <p className="muted small" style={{ margin: 0 }}>
          Not offered (dormant, in no library deck):{' '}
          {SYNERGIES.filter((s) => s.dormant)
            .map((s) => s.name)
            .join(', ')}
          .
        </p>
      )}
      {compat && (
        <p className="small" role="status" style={{ margin: 0, color: compat.ok ? undefined : 'var(--red)' }}>
          {compat.ok ? (
            <>
              {value.map(packageName).join(' + ')}: {compat.triples.toLocaleString()} legal Legend trios can hold {value.length > 1 ? 'both' : 'it'}.
              {compat.warning && <span className="muted"> {compat.warning}</span>}
            </>
          ) : (
            <>
              ⚠ <MentionText text={compat.reason} />
            </>
          )}
        </p>
      )}
      {value.length > 0 && (
        <label className="row small">
          <input type="checkbox" checked={fitAll} onChange={(e) => onFitAll(e.target.checked)} /> Also build mutants, crossovers and counters around {value.length > 1 ? 'them' : 'it'} (a deck
          that can&apos;t hold {value.length > 1 ? 'them' : 'it'} is not bred)
        </label>
      )}
    </fieldset>
  );
}

/** The packages a list is built around, marked added or removed against `before` when given. */
export function PackageChips({ deck, before }: { deck: Pick<DeckList, 'legends' | 'main'>; before?: Pick<DeckList, 'legends' | 'main'> }) {
  const now = builtAroundIds(deck);
  const ch = before ? packageChanges(before, deck) : null;
  if (!now.length && !ch?.removed.length) return <span className="muted small">Built around no package of the catalogue.</span>;
  return (
    <span className="lab-pkg-chips small">
      <span className="muted">Built around:</span>{' '}
      {now.map((id) => (
        <span key={id} className={`tag${ch?.added.includes(id) ? ' is-in' : ''}`}>
          {ch?.added.includes(id) ? '+ ' : ''}
          {packageName(id)}
          {ch?.added.includes(id) && <span className="sr-only"> (added)</span>}
        </span>
      ))}
      {ch?.removed.map((id) => (
        <span key={id} className="tag is-out">
          − {packageName(id)}
          <span className="sr-only"> (removed)</span>
        </span>
      ))}
    </span>
  );
}
