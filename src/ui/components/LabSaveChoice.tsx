// The Deck Lab's two ways to keep a tuned or bred list (src/lib/labSave.ts): "Overwrite “X”" for each saved deck it may
// replace (a confirm dialog first: the shared Modal, focus in, Escape, focus restored), and "Save as a copy"; when only
// the copy is offered, one muted line says why. After an overwrite, "Put back" restores the list it replaced.
import { useId, useState } from 'react';
import { overwriteWords } from '../../lib/labSave';
import { Modal } from './Modal';

export interface LabSaved {
  name: string;
  how: 'copy' | 'overwrite';
  /** the overwrite was put back */
  putBack?: boolean;
}

export function LabSaveChoice(o: {
  /** saved decks this list may overwrite (empty: only the copy) */
  targets: readonly string[];
  /** why only the copy is offered (shown when there is no target) */
  why: string | null;
  what: 'tuned' | 'bred';
  overwriteLabel: (name: string) => string;
  copyLabel: string;
  /** which button is the primary one */
  primary: 'overwrite' | 'copy' | 'none';
  disabled?: boolean;
  onOverwrite: (name: string) => void;
  onCopy: () => void;
}) {
  const [ask, setAsk] = useState<string | null>(null);
  const id = useId();
  const w = ask ? overwriteWords(ask, o.what) : null;
  return (
    <>
      {o.targets.map((t) => (
        <button key={t} className={o.primary === 'overwrite' ? 'primary' : ''} onClick={() => setAsk(t)} disabled={o.disabled}>
          {o.overwriteLabel(t)}
        </button>
      ))}
      <button className={o.primary === 'copy' ? 'primary' : ''} onClick={o.onCopy} disabled={o.disabled}>
        {o.copyLabel}
      </button>
      {!o.targets.length && o.why && <span className="small muted">{o.why}</span>}
      {ask && w && (
        <Modal labelledBy={id} onClose={() => setAsk(null)} className="confirm-dialog">
          <h3 id={id} style={{ marginTop: 0 }}>
            {w.title}
          </h3>
          <p className="muted">{w.body}</p>
          <div className="row confirm-actions">
            <button
              className="primary"
              onClick={() => {
                const t = ask;
                setAsk(null);
                o.onOverwrite(t);
              }}
            >
              💾 Overwrite
            </button>
            {/* the safe choice takes focus when the dialog opens */}
            <button onClick={() => setAsk(null)} data-autofocus>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** What was saved, and after an overwrite the Put back button. */
export function LabSavedLine({ saved, onPutBack }: { saved: LabSaved; onPutBack: () => void }) {
  if (saved.putBack) return <span className="small muted">Put back: “{saved.name}” has its earlier list again.</span>;
  if (saved.how === 'copy') return <span className="small muted">Saved as “{saved.name}”.</span>;
  return (
    <>
      <span className="small muted">Overwrote “{saved.name}”; the list it replaced is kept with it.</span>
      <button onClick={onPutBack}>↩ Put back the earlier list</button>
    </>
  );
}
