// A deck list shown as structure with card images: a compact list (a thumbnail, the copy count and the name on each
// row) or a visual layout (card images grouped Legends / Units / Gear / Programs by cost, the count as a badge).
// Every card opens the card dialog (click, Enter or Space). Images come from TcgCard: lazy-loaded inside a fixed
// 63:88 box, a text frame while loading, when art is off or when it fails, and no art fetch at all when art is off.
import { lazy, Suspense, useCallback, useState } from 'react';
import { CARD_BY_ID, cardLabel } from '../../engine/cards';
import type { CardDef, DeckList } from '../../engine/types';
import { groupDeck, type CardGroup } from '../../lib/deckCards';
import { loadPref, savePref } from '../prefs';
import { costLabel } from './CardView';
import { TcgCard } from './TcgCard';

// the dialog reads the card scripts (which pull in the engine), so it loads on first open, not with the page
const CardModal = lazy(() => import('./CardModal').then((m) => ({ default: m.CardModal })));

/** A card dialog for any list: `open(def)` shows it; render `dialog` once, anywhere in the list's component. */
export function useCardDialog() {
  const [def, setDef] = useState<CardDef | null>(null);
  const open = useCallback((d: CardDef) => setDef(d), []);
  const dialog = def ? (
    <Suspense fallback={null}>
      <CardModal def={def} onClose={() => setDef(null)} />
    </Suspense>
  ) : null;
  return { open, dialog };
}

const copies = (n: number) => `${n} cop${n === 1 ? 'y' : 'ies'}`;

/**
 * A small card image for a list row (a text frame when there's no art). The row's name button is the control and the
 * accessible name, so the image is hidden from assistive tech; a click on it opens the dialog too (`onOpen`).
 */
export function CardThumb({ def, onOpen }: { def: CardDef; onOpen?: (d: CardDef) => void }) {
  return (
    <span className={`card-thumb ${onOpen ? 'is-click' : ''}`} aria-hidden="true" onClick={onOpen ? () => onOpen(def) : undefined}>
      <TcgCard def={def} size="xs" />
    </span>
  );
}

/** A card's name as a button that opens its dialog (the row's text stays the accessible name). */
export function CardNameButton({ def, onOpen, children }: { def: CardDef; onOpen: (d: CardDef) => void; children?: React.ReactNode }) {
  return (
    <button type="button" className="card-name-btn" onClick={() => onOpen(def)} title="Open card details">
      {children ?? cardLabel(def)}
    </button>
  );
}

/** Compact list: one row per card with its thumbnail, copies and cost. Without `onOpen` the names are plain text (inside another dialog). */
function DeckRows({ groups, onOpen }: { groups: CardGroup[]; onOpen?: (d: CardDef) => void }) {
  return (
    <div className="deck-rows">
      {groups.map((g) => (
        <section key={g.key} className="deck-rows-group" aria-label={`${g.label} (${g.total})`}>
          <div className="zone-label">
            {g.label} ({g.total})
          </div>
          <ul>
            {g.cards.map(({ id, n }) => {
              const def = CARD_BY_ID[id];
              return (
                <li key={id} className="deck-row">
                  <CardThumb def={def} onOpen={onOpen} />
                  {g.key !== 'legends' && (
                    <span className="qty" aria-label={copies(n)}>
                      {n}×
                    </span>
                  )}
                  <span className={`dot ${def.color}`} aria-hidden="true" />
                  {onOpen ? <CardNameButton def={def} onOpen={onOpen} /> : <span className="deck-row-name">{cardLabel(def)}</span>}
                  <span className="muted small deck-row-cost">{def.type === 'Legend' ? (def.cost !== null ? `Go Solo ${def.cost}` : '') : `${costLabel(def)} €$`}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Visual layout: real card images by group, readable size, the copy count as a badge. */
function DeckVisual({ groups, onOpen }: { groups: CardGroup[]; onOpen: (d: CardDef) => void }) {
  return (
    <div className="deck-visual">
      {groups.map((g) => (
        <section key={g.key} className={`deck-visual-group ${g.key === 'legends' ? 'is-legends' : ''}`} aria-label={`${g.label} (${g.total})`}>
          <div className="zone-label">
            {g.label} ({g.total})
          </div>
          <div className="deck-visual-cards">
            {g.cards.map(({ id, n }) => {
              const def = CARD_BY_ID[id];
              return (
                <TcgCard
                  key={id}
                  def={def}
                  size="md"
                  count={g.key === 'legends' ? undefined : n}
                  onClick={() => onOpen(def)}
                  ariaLabel={`${cardLabel(def)}${g.key === 'legends' ? '' : `, ${copies(n)}`}: open card details`}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export type DeckView = 'cards' | 'list';
const VIEW_PREF = 'nct.deckView';
const loadDeckView = (): DeckView => (loadPref(VIEW_PREF, 'cards') === 'list' ? 'list' : 'cards');

/** Cards / List switch, remembered per browser (shared by every deck view that offers it). */
function DeckViewToggle({ view, onChange }: { view: DeckView; onChange: (v: DeckView) => void }) {
  const pick = (v: DeckView) => {
    onChange(v);
    savePref(VIEW_PREF, v);
  };
  return (
    <div className="seg" role="group" aria-label="Deck list view">
      <button type="button" className={view === 'cards' ? 'on' : ''} aria-pressed={view === 'cards'} onClick={() => pick('cards')}>
        ▦ Cards
      </button>
      <button type="button" className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => pick('list')}>
        ☰ List
      </button>
    </div>
  );
}

/** A deck's structure with the view switch and the card dialog: the deck profile's decklist. */
export function DeckStructure({ deck, initialView }: { deck: Pick<DeckList, 'legends' | 'main'> & { sideboard?: string[] }; initialView?: DeckView }) {
  const [view, setView] = useState<DeckView>(() => initialView ?? loadDeckView());
  const { open, dialog } = useCardDialog();
  const groups = groupDeck(deck);
  return (
    <div className="deck-structure">
      <div className="spread deck-structure-bar">
        <span className="small muted">Choose a card for its full text and rulings.</span>
        <DeckViewToggle view={view} onChange={setView} />
      </div>
      {view === 'cards' ? <DeckVisual groups={groups} onOpen={open} /> : <DeckRows groups={groups} onOpen={open} />}
      {dialog}
    </div>
  );
}

/**
 * A compact decklist with thumbnails, for places that show a list on the side (events, match details, lab results).
 * `noDialog` inside another dialog: one modal at a time, so the names stay plain text there.
 */
export function DeckListCompact({ deck, noDialog }: { deck: Pick<DeckList, 'legends' | 'main'> & { sideboard?: string[] }; noDialog?: boolean }) {
  const { open, dialog } = useCardDialog();
  return (
    <>
      <DeckRows groups={groupDeck(deck)} onOpen={noDialog ? undefined : open} />
      {dialog}
    </>
  );
}
