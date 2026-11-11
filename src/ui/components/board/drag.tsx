// Drag-to-act for the playmat (mouse and touch, via pointer events):
//   hand card → your field = play, → your €$ pile = sell, → another hand card = reorder your hand
//   face-up Legend → your field = Go Solo / play it by paying its cost (the prompt offers whichever are legal)
//   your unit → a rival unit = attack it, → the rival Gig area = attack the Gig area
// Every drop that does something in the game asks for confirmation first.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Game } from '../../../engine/engine';
import { TcgCard } from '../TcgCard';
import type { Interaction } from './interaction';

export type DropTarget = { kind: 'play' | 'sell' | 'gigs' } | { kind: 'unit'; uid: number } | { kind: 'hand'; uid: number };
export interface DropChoice {
  i: number;
  label: string;
}
export interface PendingConfirm {
  uid: number;
  title: string;
  choices: DropChoice[];
}

/** What dropping `uid` on `t` would do (empty = nothing legal). */
export function resolveDrop(g: Game, ix: Interaction, uid: number, t: DropTarget | null): DropChoice[] {
  if (!t) return [];
  const menu = ix.menus.get(uid) ?? [];
  const attacks = ix.attacks.get(uid) ?? [];
  if (t.kind === 'play') return menu.filter((m) => m.kind === 'play' || m.kind === 'goSolo' || m.kind === 'playLegend').map((m) => ({ i: m.i, label: m.label }));
  if (t.kind === 'sell') return menu.filter((m) => m.kind === 'sell').map((m) => ({ i: m.i, label: m.label }));
  if (t.kind === 'gigs') return attacks.filter((a) => a.gigs !== null).map((a) => ({ i: a.i, label: a.label }));
  if (t.kind === 'unit') return attacks.filter((a) => a.unit === t.uid).map((a) => ({ i: a.i, label: a.label }));
  return [];
}

const sameTarget = (a: DropTarget | null, b: DropTarget | null) =>
  a === b || (!!a && !!b && a.kind === b.kind && ('uid' in a ? a.uid : -1) === ('uid' in b ? b.uid : -1));

const verb = (t: DropTarget | null) => (!t ? '' : t.kind === 'play' ? 'Play' : t.kind === 'sell' ? 'Sell' : t.kind === 'hand' ? 'Move here' : 'Attack');

function hitTest(x: number, y: number, dragged: number, g: Game): DropTarget | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return null;
  const slot = el.closest<HTMLElement>('[data-uid]');
  if (slot) {
    const uid = +slot.dataset.uid!;
    const c = g.s.cards[uid];
    if (c && uid !== dragged) {
      if (c.zone === 'field' && c.controller === 1) return { kind: 'unit', uid };
      if (c.zone === 'hand' && c.owner === 0 && g.s.cards[dragged]?.zone === 'hand') return { kind: 'hand', uid };
    }
  }
  const zone = el.closest<HTMLElement>('[data-drop]');
  return zone ? ({ kind: zone.dataset.drop } as DropTarget) : null;
}

export interface DragApi {
  /** call from a card's onPointerDown */
  start: (uid: number, e: React.PointerEvent) => void;
  /** true right after a drag ended (swallow the click that follows) */
  consumeClick: () => boolean;
  dragging: number | null;
  over: DropTarget | null;
  ghost: React.ReactNode;
}

/**
 * Pointer-driven drag. On touch, a hand card only starts dragging on a mostly-vertical move, so sideways swipes still
 * scroll the hand.
 */
export function useCardDrag(g: Game, ix: Interaction, opts: { onConfirm: (p: PendingConfirm) => void; onReorder: (uid: number, before: number) => void; onRefuse: (msg: string) => void }): DragApi {
  // React state changes only when a drag starts or ends, or the hovered drop target changes; the ghost follows the
  // pointer through a ref (one transform per animation frame), so moving the pointer doesn't re-render the board.
  const [state, setState] = useState<{ uid: number; over: DropTarget | null } | null>(null);
  const ref = useRef<{ uid: number; sx: number; sy: number; started: boolean; touch: boolean; fromHand: boolean } | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const ghostEl = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const place = useCallback((el: HTMLDivElement | null) => {
    ghostEl.current = el;
    if (el) el.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) translate(-50%, -60%) rotate(-4deg)`;
  }, []);
  const tick = useCallback(() => {
    frame.current = 0;
    const d = ref.current;
    if (!d?.started) return;
    place(ghostEl.current);
    const over = hitTest(pos.current.x, pos.current.y, d.uid, live.current.g);
    setState((s) => (s && s.uid === d.uid && sameTarget(s.over, over) ? s : { uid: d.uid, over }));
  }, [place]);
  const lastEnd = useRef(0);
  const live = useRef({ g, ix, opts });
  live.current = { g, ix, opts };

  const onMove = useCallback((e: PointerEvent) => {
    const d = ref.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.started) {
      if (Math.hypot(dx, dy) < 9) return;
      if (d.touch && d.fromHand && Math.abs(dx) > Math.abs(dy)) {
        ref.current = null; // a sideways swipe: let the hand scroll
        return;
      }
      d.started = true;
      document.body.classList.add('pb-dragging');
    }
    e.preventDefault();
    pos.current = { x: e.clientX, y: e.clientY };
    if (!frame.current) frame.current = requestAnimationFrame(tick);
  }, [tick]);

  /**
   * Real touch screens: unless the page's own scrolling is stopped, the browser starts scrolling and cancels the
   * pointer stream (pointercancel), so the drag never happens. Block scrolling for gestures that will drag a card:
   * any move on a unit, and mostly-vertical moves on a hand card (sideways swipes still scroll the hand).
   */
  const onTouchMove = useCallback((e: TouchEvent) => {
    const d = ref.current;
    if (!d || !e.cancelable) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - d.sx;
    const dy = t.clientY - d.sy;
    if (d.started || !d.fromHand || Math.abs(dy) >= Math.abs(dx)) e.preventDefault();
  }, []);

  const end = useCallback(
    (e: PointerEvent) => {
      const d = ref.current;
      ref.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('touchmove', onTouchMove);
      document.body.classList.remove('pb-dragging');
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
      setState(null);
      if (!d?.started || e.type === 'pointercancel') return;
      lastEnd.current = Date.now();
      const { g, ix, opts } = live.current;
      const t = hitTest(e.clientX, e.clientY, d.uid, g);
      if (t?.kind === 'hand') return opts.onReorder(d.uid, t.uid);
      const choices = resolveDrop(g, ix, d.uid, t);
      if (!t) return;
      if (!choices.length) return opts.onRefuse(`${g.name(d.uid)} can't ${verb(t).toLowerCase()} there right now.`);
      const target = t.kind === 'unit' ? ` → ${g.name(t.uid)}` : t.kind === 'gigs' ? ' → the rival Gig area' : '';
      opts.onConfirm({ uid: d.uid, title: `${verb(t)} ${g.name(d.uid)}${target}?`, choices });
    },
    [onMove, onTouchMove],
  );

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('touchmove', onTouchMove);
      document.body.classList.remove('pb-dragging');
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [onMove, end, onTouchMove],
  );

  const start = useCallback(
    (uid: number, e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const c = live.current.g.s.cards[uid];
      ref.current = { uid, sx: e.clientX, sy: e.clientY, started: false, touch: e.pointerType !== 'mouse', fromHand: c?.zone === 'hand' };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      if (e.pointerType !== 'mouse') window.addEventListener('touchmove', onTouchMove, { passive: false });
    },
    [onMove, end, onTouchMove],
  );

  const consumeClick = useCallback(() => Date.now() - lastEnd.current < 350, []);

  let ghost: React.ReactNode = null;
  if (state) {
    const choices = state.over?.kind === 'hand' ? [{ i: -1, label: 'Move here' }] : resolveDrop(g, ix, state.uid, state.over);
    ghost = (
      <div className="pb-ghost" ref={place} style={{ left: 0, top: 0 }}>
        <TcgCard def={g.def(state.uid)} size="sm" noZoom />
        <span className={`pb-ghost-tag ${choices.length ? 'ok' : state.over ? 'no' : ''}`}>{choices.length ? (state.over?.kind === 'hand' ? 'Move here' : choices[0].label) : state.over ? '✕ not here' : 'drag to a zone'}</span>
      </div>
    );
  }
  return { start, consumeClick, dragging: state?.uid ?? null, over: state?.over ?? null, ghost };
}

/**
 * "Are you sure?" for a dropped card, listing every way the drop can resolve (e.g. Play or Go Solo). `side`: phones,
 * a small panel against the right edge instead of a centred dialog.
 */
export function ConfirmPrompt({ p, onPick, onCancel, side }: { p: PendingConfirm; onPick: (i: number) => void; onCancel: () => void; side?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && p.choices.length === 1) onPick(p.choices[0].i);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [p, onPick, onCancel]);
  return (
    <div className={`pb-modal-wrap ${side ? 'pb-confirm-side' : ''}`} onClick={onCancel}>
      <div className="pb-modal pb-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Confirm action">
        <div className="pb-confirm-title">{p.title}</div>
        <div className="pb-confirm-actions">
          {p.choices.map((c) => (
            <button key={c.i} className="primary pb-big" onClick={() => onPick(c.i)}>
              {c.label}
            </button>
          ))}
          <button className="ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
