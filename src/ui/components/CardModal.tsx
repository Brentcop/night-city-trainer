// The card dialog: the card at full size with its text, tags, roles, rulings link and the library decks that play it.
// Opened from the card database and from every deck list (through useCardDialog, which loads this file on first use,
// because the card scripts it reads pull in the engine), and from card mentions in text (CardMention.tsx's CardDialogHost).
import { useId } from 'react';
import type { CardDef } from '../../engine/types';
import { CHOOM_RATINGS, ROLES } from '../../ai/knowledge';
import { SCRIPTS } from '../../engine/scripts';
import { allDecks } from '../../lib/browserLibrary';
import { TcgCard } from './TcgCard';
import { CardText } from './CardView';
import { Modal } from './Modal';

export function CardModal({ def, onClose, backdropClassName }: { def: CardDef; onClose: () => void; backdropClassName?: string }) {
  const decks = allDecks().filter((d) => d.deck.legends.includes(def.id) || d.deck.main.includes(def.id));
  const titleId = useId();
  return (
    <Modal labelledBy={titleId} onClose={onClose} backdropClassName={backdropClassName}>
      <div className="modal-body">
        <TcgCard def={def} size="xl" noZoom />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 id={titleId} style={{ marginTop: 0 }}>
            {def.displayName}
          </h2>
          <div className="row small">
            <span className={`dot ${def.color}`} /> {def.color} · {def.type} · {def.cost ?? '–'} €$ · RAM {def.ram}
            {def.power !== null && ` · power ${def.power}`}
            {def.sellable && <span className="tag">sellable</span>}
          </div>
          <p style={{ whiteSpace: 'pre-wrap' }}>
            <CardText text={def.text} />
          </p>
          <div className="row small">
            {def.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
            {(ROLES[def.id] ?? []).map((r) => (
              <span key={r} className="tag" style={{ borderColor: 'var(--cyan)' }}>
                {r}
              </span>
            ))}
            {CHOOM_RATINGS[def.id] && <span className="tag" style={{ borderColor: 'var(--accent)' }}>choom.gg rating {CHOOM_RATINGS[def.id]}</span>}
            {SCRIPTS[def.id]?.partial && (
              <span className="tag" style={{ borderColor: 'var(--red)' }} title={SCRIPTS[def.id].partial}>
                sim: approximated
              </span>
            )}
          </div>
          {def.url && (
            <p className="small">
              <a href={def.url} target="_blank" rel="noreferrer">
                Official card page & rulings ↗
              </a>
            </p>
          )}
          <h3>In {decks.length} library decks</h3>
          <div className="row small" style={{ maxHeight: 160, overflowY: 'auto' }}>
            {decks.map((d) => (
              <a key={d.file} className="tag" href={`#/deck?d=${encodeURIComponent(d.file)}`}>
                {d.deck.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
