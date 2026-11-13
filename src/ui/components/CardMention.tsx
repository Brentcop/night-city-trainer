// Card mentions: a card's name in text that shows the card when pointed at (the same hover preview as TcgCard, at the
// document body) and opens the card dialog when chosen. Two forms:
// - <CardMention id="…">: where the data already knows the card, link by id (tables, deck lists, synergy members).
// - <MentionText text="…">: any other string (logs, option labels, coach reasons, review text, guides); the names are
//   found by src/lib/cardMentions.ts. Library deck names and `skip` strings (player names) never become cards.
// Behaviour by input: a mouse pointer shows the preview after a short pause; keyboard focus shows it too; a click, tap,
// Enter or Space opens the dialog (on touch screens a tap is the only way, there is no hover). Inside something that is
// already a button or a link, pass `passive` (or wrap in <MentionsPassive>): the name is a plain span with the hover
// preview only, so the control keeps its job and no interactive element is nested in it. In a long log, wrap the
// lines in <MentionRoving> and give the scrolling box `rovingProps`: one Tab stop for the whole log, and the Left and
// Right arrow keys move between its card names.
// The name index, the cards and the preview load with the first mention on screen (mentionRuntime.tsx); until then
// the text is plain. The dialog is one per page (CardDialogHost, mounted by App), above every other overlay.
import { createContext, lazy, Suspense, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { Box } from './TcgCard';

type Runtime = typeof import('./mentionRuntime');

let runtime: Runtime | null = null;
let loading: Promise<Runtime | null> | null = null;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const emit = () => listeners.forEach((fn) => fn());

/** Load the name index and the preview (once; a failed load can be tried again later). */
export function loadMentionRuntime(): Promise<Runtime | null> {
  loading ??= import('./mentionRuntime').then(
    (m) => {
      runtime = m;
      emit();
      return m;
    },
    () => {
      loading = null;
      return null;
    },
  );
  return loading;
}

/** The loaded runtime, or null while it loads (asking starts the load). */
function useRuntime(): Runtime | null {
  const rt = useSyncExternalStore(
    subscribe,
    () => runtime,
    () => runtime,
  );
  useEffect(() => {
    if (!runtime) void loadMentionRuntime();
  }, []);
  return rt;
}

// ---------- the card dialog: one for the page ----------

let dialogId: string | null = null;
const dialogListeners = new Set<() => void>();
/** Open the card dialog for a card id (the host renders it). */
export function openCardDialog(id: string | null) {
  dialogId = id;
  dialogListeners.forEach((fn) => fn());
}

const CardModal = lazy(() => import('./CardModal').then((m) => ({ default: m.CardModal })));

/** Renders the card dialog a mention opened. App mounts one; a test can render its own. */
export function CardDialogHost() {
  const id = useSyncExternalStore(
    (fn) => {
      dialogListeners.add(fn);
      return () => void dialogListeners.delete(fn);
    },
    () => dialogId,
    () => dialogId,
  );
  // a link in the dialog (a deck that plays the card) leaves the page: the dialog goes with it
  useEffect(() => {
    if (!id) return;
    const close = () => openCardDialog(null);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, [id]);
  const def = id && runtime ? runtime.cardById(id) : undefined;
  if (!def) return null;
  return (
    <Suspense fallback={null}>
      <CardModal def={def} onClose={() => openCardDialog(null)} backdropClassName="card-mention-backdrop" />
    </Suspense>
  );
}

// ---------- context: passive (inside a control) and roving (a long log) ----------

interface Mode {
  passive: boolean;
  roving: boolean;
  off: boolean;
}
const MentionMode = createContext<Mode>({ passive: false, roving: false, off: false });

/** Mentions inside: hover preview only (the surrounding button or link keeps the click and the focus). */
export function MentionsPassive({ children }: { children: React.ReactNode }) {
  const m = useContext(MentionMode);
  return <MentionMode.Provider value={{ ...m, passive: true }}>{children}</MentionMode.Provider>;
}

/** Mentions inside are reached with the arrow keys from the box (give the box `rovingProps`), not one Tab stop each. */
export function MentionRoving({ children }: { children: React.ReactNode }) {
  const m = useContext(MentionMode);
  return <MentionMode.Provider value={{ ...m, roving: true }}>{children}</MentionMode.Provider>;
}

/** No mentions inside (players' own text, code). */
export function MentionsOff({ children }: { children: React.ReactNode }) {
  const m = useContext(MentionMode);
  return <MentionMode.Provider value={{ ...m, off: true }}>{children}</MentionMode.Provider>;
}

/** Left / Right (and Home / End once inside) move between the card names in a roving box. */
export function rovingKeys(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('.card-mention[role="button"]'));
  if (!items.length) return;
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0 && (e.key === 'Home' || e.key === 'End')) return; // the box itself: Home and End scroll it
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : i < 0 ? (e.key === 'ArrowRight' ? 0 : items.length - 1) : i + (e.key === 'ArrowRight' ? 1 : -1);
  const el = items[Math.max(0, Math.min(items.length - 1, next))];
  if (!el) return;
  e.preventDefault();
  e.stopPropagation();
  el.focus();
}

/** Props for a roving box: one Tab stop, and the arrow keys. */
export const rovingProps = { tabIndex: 0, onKeyDown: rovingKeys } as const;

// ---------- the mention itself ----------

export const HOVER_DELAY = 120;

function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

/** What a mention's events do, given its effects (kept apart from React so it can be tested without a DOM). */
export interface MentionEffects {
  /** show the preview beside this element */
  show(el: Element): void;
  /** hide the preview (and forget a pending show) */
  hide(): void;
  /** is the preview shown now */
  shown(): boolean;
  /** open the card dialog */
  open(): void;
  /** run `fn` after `ms` (a pending show); replaces any earlier one */
  later(fn: () => void, ms: number): void;
  /** is this element's focus a keyboard one (:focus-visible) */
  keyboardFocus(el: Element): boolean;
}

interface EventLike {
  currentTarget: Element;
  stopPropagation(): void;
}
interface KeyLike extends EventLike {
  key: string;
  preventDefault(): void;
}

/** The pointer handlers every mention has: a mouse shows the preview after HOVER_DELAY (touch and pen never do: a tap is a click); leaving hides it. */
export function hoverHandlers(fx: MentionEffects) {
  return {
    onPointerEnter: (e: EventLike & { pointerType: string }) => {
      if (e.pointerType !== 'mouse') return;
      const el = e.currentTarget;
      fx.later(() => fx.show(el), HOVER_DELAY);
    },
    onPointerLeave: () => fx.hide(),
  };
}

/**
 * The handlers of an interactive mention: the pointer's, plus the preview on keyboard focus (hidden on blur and on
 * Escape), and a click, tap, Enter or Space that opens the dialog without reaching a clickable row (or a dialog's
 * Enter-to-confirm) around it. A passive mention (inside a button or link) has hoverHandlers only.
 */
export function mentionHandlers(fx: MentionEffects) {
  return {
    ...hoverHandlers(fx),
    onFocus: (e: EventLike) => {
      if (fx.keyboardFocus(e.currentTarget)) fx.show(e.currentTarget);
    },
    onBlur: () => fx.hide(),
    onKeyDown: (e: KeyLike) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // Space would scroll the page
        e.stopPropagation();
        fx.hide();
        fx.open();
        return;
      }
      if (e.key !== 'Escape' || !fx.shown()) return;
      fx.hide();
      e.stopPropagation(); // Escape takes the preview away first, not the dialog it is in
    },
    onClick: (e: EventLike) => {
      e.stopPropagation(); // a clickable row around the text keeps its own click for the rest of the line
      fx.hide();
      fx.open();
    },
  };
}

/** One mention: `rt` is loaded. */
function Mention({ rt, id, passive, roving, children }: { rt: Runtime; id: string; passive: boolean; roving: boolean; children: React.ReactNode }) {
  const def = rt.cardById(id);
  const [at, setAt] = useState<Box | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  useEffect(() => {
    if (!at) return;
    // the name moves away under a still pointer when something scrolls: drop the preview rather than leave it stranded
    const drop = () => setAt(null);
    window.addEventListener('scroll', drop, true);
    window.addEventListener('resize', drop);
    return () => {
      window.removeEventListener('scroll', drop, true);
      window.removeEventListener('resize', drop);
    };
  }, [at]);
  if (!def) return <>{children}</>;
  const fx: MentionEffects = {
    show: (el) => {
      const r = el.getBoundingClientRect();
      setAt({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    },
    hide: () => {
      clear();
      setAt(null);
    },
    shown: () => at !== null,
    open: () => openCardDialog(id),
    later: (fn, ms) => {
      clear();
      timer.current = setTimeout(fn, ms);
    },
    keyboardFocus: focusVisible,
  };
  const preview = at && typeof document !== 'undefined' ? createPortal(<rt.Preview def={def} card={at} />, document.body) : null;
  if (passive)
    return (
      <span className="card-mention is-passive" {...hoverHandlers(fx)}>
        {children}
        {preview}
      </span>
    );
  // a span with the button role, not a <button>: a button is an atomic box that never breaks across lines, so a long
  // name would push the line or overflow a narrow panel; this wraps like the text around it
  return (
    <span className="card-mention" role="button" tabIndex={roving ? -1 : 0} aria-haspopup="dialog" {...mentionHandlers(fx)}>
      {children}
      {preview}
    </span>
  );
}

/** A card named by id: `children` (default the card's name) shown as a mention; plain text until the runtime loads. */
export function CardMention({ id, passive, children }: { id: string; passive?: boolean; children?: React.ReactNode }) {
  const rt = useRuntime();
  const mode = useContext(MentionMode);
  const label = children ?? rt?.cardById(id)?.displayName ?? id;
  if (!rt || mode.off) return <>{label}</>;
  return (
    <Mention rt={rt} id={id} passive={!!passive || mode.passive} roving={mode.roving}>
      {label}
    </Mention>
  );
}

/** Text with the card names in it as mentions. `skip`: strings never read as cards (player names in a log line). */
export function MentionText({ text, passive, skip }: { text: string; passive?: boolean; skip?: readonly string[] }) {
  const rt = useRuntime();
  const mode = useContext(MentionMode);
  if (!rt || mode.off || !text) return <>{text}</>;
  const parts = rt.split(text, skip);
  if (parts.length === 1 && typeof parts[0] === 'string') return <>{text}</>;
  const quiet = !!passive || mode.passive;
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : (
          <Mention key={i} rt={rt} id={p.id} passive={quiet} roving={mode.roving}>
            {p.text}
          </Mention>
        ),
      )}
    </>
  );
}
