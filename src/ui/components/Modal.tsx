// Shared modal dialog: role="dialog" + aria-modal, named by its title, focus moved in on open, Tab kept inside,
// Escape and the backdrop close it, and focus returns to whatever opened it. The focus logic (attachModal) works on
// minimal element shapes so it can be tested without a DOM.
import { useEffect, useRef } from 'react';

/** Elements Tab can land on. */
export const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export interface Focusable {
  focus(opts?: FocusOptions): void;
}
export interface DialogNode extends Focusable {
  contains(other: unknown): boolean;
  querySelectorAll(selector: string): ArrayLike<unknown>;
}
export interface KeyEventLike {
  key: string;
  shiftKey: boolean;
  preventDefault(): void;
}
export interface DocumentLike {
  activeElement: unknown;
  addEventListener(type: 'keydown', fn: (e: KeyEventLike) => void): void;
  removeEventListener(type: 'keydown', fn: (e: KeyEventLike) => void): void;
}

/**
 * Where Tab should send focus inside a dialog, or null to let the browser move it.
 * From the last control Tab wraps to the first (Shift+Tab: first to last); from outside the controls (the dialog
 * itself, or anywhere else on the page) it goes to the first (Shift+Tab: the last).
 */
export function trapTarget<T>(items: readonly T[], active: unknown, shift: boolean): T | null {
  if (!items.length) return null;
  const i = items.indexOf(active as T);
  if (i < 0) return shift ? items[items.length - 1] : items[0];
  if (shift && i === 0) return items[items.length - 1];
  if (!shift && i === items.length - 1) return items[0];
  return null;
}

/** Controls that are rendered (not inside a closed <details> or display:none) and can take focus. */
function tabbables(dialog: DialogNode): Focusable[] {
  return Array.from(dialog.querySelectorAll(FOCUSABLE) as ArrayLike<Focusable & { getClientRects?: () => { length: number } }>).filter(
    (el) => !el.getClientRects || el.getClientRects().length > 0,
  );
}

/**
 * Wire a dialog that has just opened: focus moves to it, Tab and Shift+Tab stay inside it, Escape calls onClose.
 * Returns the cleanup, which removes the key handler and puts focus back where it was before the dialog opened.
 */
export function attachModal(dialog: DialogNode, doc: DocumentLike, onClose: () => void): () => void {
  const opener = doc.activeElement as Partial<Focusable> | null;
  dialog.focus({ preventScroll: true });
  const onKey = (e: KeyEventLike) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = tabbables(dialog);
    if (!items.length) {
      // nothing to tab to: keep focus on the dialog
      e.preventDefault();
      dialog.focus();
      return;
    }
    const target = trapTarget(items, dialog.contains(doc.activeElement) ? doc.activeElement : null, e.shiftKey);
    if (target) {
      e.preventDefault();
      target.focus();
    }
  };
  doc.addEventListener('keydown', onKey);
  return () => {
    doc.removeEventListener('keydown', onKey);
    if (opener && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
  };
}

/**
 * A modal dialog over a dimmed backdrop. `labelledBy` is the id of the element that names it (usually its heading:
 * get one with React's useId()). Clicking the backdrop, the ✕ button or pressing Escape calls onClose.
 */
export function Modal({ labelledBy, onClose, className, children }: { labelledBy: string; onClose: () => void; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // the latest onClose, so the focus wiring runs once per opening, not on every render
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!ref.current) return;
    return attachModal(ref.current, document as unknown as DocumentLike, () => close.current());
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className={['modal', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="ghost modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
