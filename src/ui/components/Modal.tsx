// Shared modal dialog: role="dialog" + aria-modal, named by its title, focus moved in on open, Tab kept inside,
// Escape and the backdrop close it, and focus returns to whatever opened it. The focus logic (attachModal, and the
// useFocusTrap hook that the Play board's overlays and menus use) works on minimal element shapes so it can be tested
// without a DOM.
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

/** Where an arrow key moves focus in a menu: the next (or previous) item, wrapping; from outside the items, the first (or last). */
export function stepTarget<T>(items: readonly T[], active: unknown, dir: 1 | -1): T | null {
  if (!items.length) return null;
  const i = items.indexOf(active as T);
  if (i < 0) return dir > 0 ? items[0] : items[items.length - 1];
  return items[(i + dir + items.length) % items.length];
}

export interface TrapOptions {
  /**
   * where focus goes on open: the container itself (default; it needs tabIndex -1) or its first control. Either way a
   * control marked `data-autofocus` wins (use it instead of React's autoFocus, which would run before the opener is
   * remembered).
   */
  initial?: 'dialog' | 'first';
  /** menus: ArrowDown/ArrowUp move between the controls, Home/End go to the ends (not while a field has focus) */
  arrows?: boolean;
  /** false: focus moves in and Escape closes, but Tab may leave (a non-modal panel such as the log drawer) */
  trap?: boolean;
}

/** Form fields use the arrow keys themselves. */
const ownsArrows = (el: unknown) => /^(SELECT|INPUT|TEXTAREA)$/.test(String((el as { tagName?: string } | null)?.tagName ?? ''));

/**
 * Open traps per document, newest last: only the newest one handles keys, so a dialog opened over another (Concede
 * over the opening-hand choice, the card reader over a menu) takes Tab and Escape until it closes.
 */
const openTraps = new WeakMap<DocumentLike, object[]>();

/**
 * Wire a dialog or menu that has just opened: focus moves into it, Tab and Shift+Tab stay inside it, Escape calls
 * onClose (pass null when it can't be dismissed, like a choice that must be made). Returns the cleanup, which removes
 * the key handler and puts focus back where it was before it opened.
 */
export function attachModal(dialog: DialogNode, doc: DocumentLike, onClose: (() => void) | null, opts: TrapOptions = {}): () => void {
  const opener = doc.activeElement as Partial<Focusable> | null;
  const token = {};
  const stack = openTraps.get(doc) ?? [];
  openTraps.set(doc, stack);
  stack.push(token);
  const marked = dialog.querySelectorAll('[data-autofocus]')[0] as Focusable | undefined;
  const first = marked ?? (opts.initial === 'first' ? tabbables(dialog)[0] : undefined);
  (first ?? dialog).focus({ preventScroll: true });
  const onKey = (e: KeyEventLike) => {
    if (stack[stack.length - 1] !== token) return; // a newer dialog is on top
    if (e.key === 'Escape') {
      if (!onClose) return;
      e.preventDefault();
      onClose();
      return;
    }
    const inside = dialog.contains(doc.activeElement) ? doc.activeElement : null;
    if (opts.arrows && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') && !ownsArrows(doc.activeElement)) {
      const items = tabbables(dialog);
      const target = e.key === 'Home' ? items[0] : e.key === 'End' ? items[items.length - 1] : stepTarget(items, inside, e.key === 'ArrowDown' ? 1 : -1);
      if (target) {
        e.preventDefault();
        target.focus();
      }
      return;
    }
    if (e.key !== 'Tab' || opts.trap === false) return;
    const items = tabbables(dialog);
    if (!items.length) {
      // nothing to tab to: keep focus on the dialog
      e.preventDefault();
      dialog.focus();
      return;
    }
    const target = trapTarget(items, inside, e.shiftKey);
    if (target) {
      e.preventDefault();
      target.focus();
    }
  };
  doc.addEventListener('keydown', onKey);
  return () => {
    doc.removeEventListener('keydown', onKey);
    const i = stack.indexOf(token);
    if (i >= 0) stack.splice(i, 1);
    if (opener && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
  };
}

/**
 * The hook form of attachModal for any overlay: while `active` (default true) and the ref is mounted, focus is moved
 * in, trapped and restored on close. `onClose` may change between renders; the latest one is called.
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, onClose: (() => void) | null, opts: TrapOptions & { active?: boolean } = {}) {
  const close = useRef(onClose);
  close.current = onClose;
  const dismissable = onClose !== null;
  const { active = true, initial, arrows, trap } = opts;
  useEffect(() => {
    if (!active || !ref.current) return;
    return attachModal(ref.current, document as unknown as DocumentLike, dismissable ? () => close.current?.() : null, { initial, arrows, trap });
  }, [ref, active, dismissable, initial, arrows, trap]);
}

/**
 * A modal dialog over a dimmed backdrop, named by `labelledBy` (the id of its heading: get one with React's useId())
 * or, when it has no visible heading of its own, by `label`. Clicking the backdrop, the ✕ button or pressing Escape
 * calls onClose.
 */
export function Modal({
  labelledBy,
  label,
  onClose,
  className,
  backdropClassName,
  children,
}: {
  labelledBy?: string;
  label?: string;
  onClose: () => void;
  className?: string;
  backdropClassName?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);
  return (
    <div className={['modal-backdrop', backdropClassName].filter(Boolean).join(' ')} onClick={onClose}>
      <div
        ref={ref}
        className={['modal', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
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
