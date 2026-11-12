// Deleting and hiding decks, shared by the gallery (#/decks), the tuned decks page (#/tuned) and the deck profile.
// Decks saved in this browser are deleted: a confirm dialog names them (the shared Modal: focus in, Tab kept inside,
// Escape, focus restored), then an Undo toast for a few seconds. Built-in decks ship with the site and cannot be
// deleted, so they are hidden instead (per browser, src/lib/hiddenDecks.ts), also with Undo.
import { useEffect, useId, useState } from 'react';
import { deleteCustomDecks, restoreCustom, type Removed } from '../../lib/browserLibrary';
import { setHidden } from '../../lib/hiddenDecks';
import type { LibraryDeck } from '../../lib/library';
import { isBuiltin } from '../deckLookup';
import { Modal } from './Modal';

/** How long the Undo toast stays. */
export const UNDO_MS = 8000;

const quoted = (names: readonly string[]) => (names.length === 1 ? `“${names[0]}”` : `${names.length} decks`);

/** The confirm dialog's title and body for deleting these decks (exported for tests). */
export function deleteWords(names: readonly string[]): { title: string; body: string } {
  return {
    title: `Delete ${quoted(names)}?`,
    body: `${names.length === 1 ? 'It is' : 'They are'} removed from this browser’s storage, with any Deck Lab record saved with ${names.length === 1 ? 'it' : 'them'}. You get ${Math.round(UNDO_MS / 1000)} seconds to undo; after that it cannot be undone.`,
  };
}

export function DeleteDialog({ names, onConfirm, onCancel }: { names: readonly string[]; onConfirm: () => void; onCancel: () => void }) {
  const id = useId();
  const w = deleteWords(names);
  return (
    <Modal labelledBy={id} onClose={onCancel} className="confirm-dialog">
      <h3 id={id} style={{ marginTop: 0 }}>
        {w.title}
      </h3>
      <p className="muted">{w.body}</p>
      {names.length > 1 && (
        <ul className="small confirm-list">
          {names.slice(0, 12).map((n) => (
            <li key={n}>{n}</li>
          ))}
          {names.length > 12 && <li className="muted">and {names.length - 12} more</li>}
        </ul>
      )}
      <div className="row confirm-actions">
        <button className="danger" onClick={onConfirm}>
          🗑 Delete{names.length > 1 ? ` ${names.length} decks` : ''}
        </button>
        {/* the safe choice takes focus when the dialog opens */}
        <button onClick={onCancel} data-autofocus>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

interface Toast {
  text: string;
  removed?: Removed[];
  /** files hidden (or unhidden, with `unhid`) by the action, to reverse */
  files?: string[];
  unhid?: boolean;
  /** a toast without an undo (an error) */
  error?: boolean;
}

export function UndoToast({ toast, onUndo, onClose }: { toast: Toast; onUndo: () => void; onClose: () => void }) {
  return (
    <div className={`undo-toast ${toast.error ? 'is-error' : ''}`} role="status" aria-live="polite">
      <span>{toast.text}</span>
      {!toast.error && (
        <button className="ghost small" onClick={onUndo}>
          Undo
        </button>
      )}
      <button className="ghost small" onClick={onClose} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

/**
 * Delete and hide with confirm and Undo. Render `ui` once in the page. `onDeleted` runs after a delete is saved (and
 * `onRestored` after its Undo), with the names.
 */
export function useDeckActions(o: { onDeleted?: (names: string[]) => void; onRestored?: (names: string[]) => void } = {}) {
  const [ask, setAsk] = useState<string[] | null>(null);
  const [toast, setToast] = useState<(Toast & { id: number }) | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [toast]);
  const show = (t: Toast) => setToast({ ...t, id: Date.now() });

  /** Ask to delete these decks (built-in ones are left out: they can only be hidden). */
  const askDelete = (decks: readonly Pick<LibraryDeck, 'file' | 'deck'>[]) => {
    const names = decks.filter((d) => !isBuiltin(d)).map((d) => d.deck.name);
    if (names.length) setAsk(names);
  };
  const confirm = () => {
    if (!ask) return;
    const names = ask;
    setAsk(null);
    const removed = deleteCustomDecks(names);
    if (removed === null) return show({ text: 'Not deleted: this browser’s storage is blocked or full.', error: true });
    show({ text: `Deleted ${quoted(names)}.`, removed });
    o.onDeleted?.(names);
  };
  /** Hide (or unhide) built-in decks in this browser. */
  const hide = (files: readonly string[], on = true) => {
    const fs = files.filter((f) => !f.startsWith('custom:'));
    if (!fs.length) return;
    if (!setHidden(fs, on)) return show({ text: 'Not changed: this browser’s storage is blocked or full.', error: true });
    const what = fs.length === 1 ? 'the deck' : `${fs.length} decks`;
    show({ text: on ? `Hid ${what} in this browser (Show hidden brings ${fs.length === 1 ? 'it' : 'them'} back).` : `Unhid ${what}.`, files: fs, unhid: !on });
  };
  const undo = () => {
    if (!toast) return;
    setToast(null);
    if (toast.removed) {
      if (!restoreCustom(toast.removed)) return show({ text: 'Could not undo: this browser’s storage is blocked or full.', error: true });
      o.onRestored?.(toast.removed.map((r) => r.deck.name));
    }
    if (toast.files) setHidden(toast.files, !!toast.unhid);
  };
  const ui = (
    <>
      {ask && <DeleteDialog names={ask} onConfirm={confirm} onCancel={() => setAsk(null)} />}
      {toast && <UndoToast key={toast.id} toast={toast} onUndo={undo} onClose={() => setToast(null)} />}
    </>
  );
  return { askDelete, hide, ui };
}
