// Floating UI on the playmat: card action popover, trash viewer, mulligan screen, game-over overlay, the Concede /
// Exit game confirmation.
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Game } from '../../../engine/engine';
import type { PlayerId } from '../../../engine/types';
import { Modal } from '../Modal';
import { TcgCard } from '../TcgCard';
import type { BoardCtx } from './BoardCard';

/** "Are you sure?" before conceding (a recorded loss) or exiting (nothing recorded). Rendered at the document body. */
export function LeaveDialog({ kind, onConfirm, onCancel }: { kind: 'concede' | 'exit'; onConfirm: () => void; onCancel: () => void }) {
  const id = useId();
  const concede = kind === 'concede';
  return createPortal(
    <Modal labelledBy={id} onClose={onCancel} className="pb-leave">
      <h3 id={id} style={{ marginTop: 0 }}>
        {concede ? 'Concede this game?' : 'Exit this game?'}
      </h3>
      <p className="muted">
        {concede
          ? 'The game ends now as a loss, recorded in your practice log and replays as conceded. You can still undo from the result screen.'
          : 'The game ends now and nothing is recorded: no result and no replay.'}
      </p>
      <div className="row pb-leave-actions">
        <button className={concede ? 'pb-danger' : 'primary'} onClick={onConfirm}>
          {concede ? '⚑ Concede' : 'Exit game'}
        </button>
        <button onClick={onCancel}>Keep playing</button>
      </div>
    </Modal>,
    document.body,
  );
}

export interface MenuState {
  uid: number;
  /** the card element the menu belongs to (re-measured while the page or hand scrolls) */
  el: HTMLElement;
}

export function ActionMenu({ ctx, menu, onClose }: { ctx: BoardCtx; menu: MenuState; onClose: () => void }) {
  const items = ctx.ix.menus.get(menu.uid) ?? [];
  const c = ctx.g.s.cards[menu.uid];
  // follow the card while things scroll (closing on scroll made the menu vanish on phones before a choice)
  const [, reflow] = useState(0);
  useEffect(() => {
    const on = () => reflow((x) => x + 1);
    // the card lifts when its menu opens (a short transition): measure again once it has settled
    const settle = setTimeout(on, 260);
    window.addEventListener('scroll', on, true);
    window.addEventListener('resize', on);
    return () => {
      clearTimeout(settle);
      window.removeEventListener('scroll', on, true);
      window.removeEventListener('resize', on);
    };
  }, []);
  if (!items.length || !c) return null;
  const rect = menu.el.getBoundingClientRect();
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const sheet = ctx.narrow; // phones: a bottom sheet that can't be scrolled out from under your finger
  const cx = Math.min(Math.max(rect.left + rect.width / 2, 130), vw - 130);
  const above = rect.top > 240;
  const style: React.CSSProperties | undefined = sheet
    ? undefined
    : above
      ? { left: cx, top: rect.top - 8, transform: 'translate(-50%, -100%)' }
      : { left: cx, top: rect.bottom + 8, transform: 'translate(-50%, 0)' };
  const hidden = c.zone === 'legends' && !c.faceUp && !c.known;
  const title = hidden ? `Face-down Legend (slot ${ctx.g.P(c.controller).legends.indexOf(c.uid) + 1})` : ctx.g.name(c);
  return (
    <>
      <div className="pb-backdrop" onClick={onClose} />
      <div className={`pb-menu ${sheet ? 'pb-menu-sheet' : ''}`} style={style} role="menu">
        <div className="pb-menu-title">{title}</div>
        {items.map((it, k) => {
          const isCoach = !!ctx.coach && (ctx.coach.i === it.i || (it.kind === 'attack' && ctx.coach.attacker === menu.uid));
          return (
            <button
              key={k}
              role="menuitem"
              className={`pb-menu-item pb-mk-${it.kind} ${isCoach ? 'pb-coach-btn' : ''}`}
              onClick={() => (it.kind === 'attack' ? ctx.startTargeting(menu.uid) : ctx.answer(it.i))}
            >
              {it.kind === 'attack' || it.kind === 'attackDirect' ? '⚔ ' : ''}
              {it.label}
              {isCoach && <span className="chip pb-chip-coach">Coach</span>}
            </button>
          );
        })}
        <button className="pb-menu-item ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function TrashModal({ g, p, onClose }: { g: Game; p: PlayerId; onClose: () => void }) {
  useEscape(onClose);
  const trash = [...g.P(p).trash].reverse();
  return (
    <div className="pb-modal-wrap" onClick={onClose}>
      <div className="pb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h3 style={{ margin: 0 }}>
            {p === 0 ? 'Your' : "Rival's"} trash · {trash.length}
          </h3>
          <button onClick={onClose}>Close</button>
        </div>
        <p className="small muted" style={{ margin: '4px 0 10px' }}>
          Top of the trash first.
        </p>
        <div className="pb-modal-grid">
          {trash.map((u) => (g.s.cards[u] ? <TcgCard key={u} def={g.def(u)} size="sm" /> : null))}
          {!trash.length && <span className="muted">Empty.</span>}
        </div>
      </div>
    </div>
  );
}

export function MulliganScreen({ ctx, why }: { ctx: BoardCtx; why?: string }) {
  const { g, pend } = ctx;
  if (!pend) return null;
  const yes = pend.options.findIndex((o) => o.key === 'yes');
  const no = pend.options.findIndex((o) => o.key === 'no');
  const coachI = ctx.coach?.i;
  return (
    <div className="pb-modal-wrap pb-mulligan">
      <div className="pb-modal">
        <h2 style={{ margin: 0 }}>Your opening hand</h2>
        <p className="muted small" style={{ margin: '4px 0 12px' }}>
          Keep these {g.P(0).hand.length} cards, or shuffle them back and draw 6 new ones. You go {g.s.first === 0 ? 'first' : 'second'}.
        </p>
        <div className="pb-mull-hand">
          {g.P(0).hand.map((u, k) => (
            <div key={u} className="pb-mull-card" style={{ animationDelay: `${k * 70}ms` }}>
              <TcgCard def={g.def(u)} size={ctx.narrow ? 'sm' : 'md'} />
            </div>
          ))}
        </div>
        <div className="pb-legend-peek small muted">
          Legends:{' '}
          {g.P(0).legends.map((u) => {
            const c = g.s.cards[u];
            return <span key={u}>{c && (c.faceUp || c.known) ? g.name(u) : 'face-down'} · </span>;
          })}
        </div>
        {coachI !== undefined && (
          <div className="pb-coach-box">
            <b>Coach:</b> {coachI === yes ? 'Mulligan' : 'Keep'}
            {why && <div className="muted small">{why}</div>}
          </div>
        )}
        <div className="row" style={{ marginTop: 12, justifyContent: 'center' }}>
          <button className={`primary pb-big ${coachI === no ? 'pb-coach-btn' : ''}`} onClick={() => no >= 0 && ctx.answer(no)}>
            Keep hand
          </button>
          <button className={`pb-big ${coachI === yes ? 'pb-coach-btn' : ''}`} onClick={() => yes >= 0 && ctx.answer(yes)}>
            Mulligan
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameOverOverlay({
  g,
  conceded,
  onRematch,
  onNew,
  onHide,
  onUndo,
  review,
}: {
  g: Game;
  conceded?: boolean;
  onRematch: () => void;
  onNew: () => void;
  onHide: () => void;
  /** offered when there is a position to go back to (after a concede: the position you conceded from) */
  onUndo?: () => void;
  review?: React.ReactNode;
}) {
  const s = g.s;
  const win = s.winner === 0;
  const loss = s.winner === 1;
  return (
    <div className="pb-modal-wrap pb-over">
      <div className={`pb-modal pb-over-card ${win ? 'win' : loss ? 'loss' : 'draw'} ${conceded ? 'conceded' : ''}`} role="dialog" aria-label="Game over">
        <div className="pb-over-title">{conceded ? 'CONCEDED' : win ? 'VICTORY' : loss ? 'DEFEAT' : 'DRAW'}</div>
        <div className="pb-over-reason">{conceded ? 'You conceded. Recorded as a loss.' : s.winReason || '—'}</div>
        <div className="small muted">
          {s.turn} turns · you went {s.first === 0 ? 'first' : 'second'} · Gigs {g.gigsOf(0).length}–{g.gigsOf(1).length}
        </div>
        {review}
        <div className="row" style={{ marginTop: 16, justifyContent: 'center' }}>
          <button className="primary pb-big" onClick={onRematch}>
            Rematch
          </button>
          <button className="pb-big" onClick={onNew}>
            New game
          </button>
          {onUndo && (
            <button className="ghost" onClick={onUndo} title={conceded ? 'Take back the concession: back to before your last decision' : 'Back to before your last decision'}>
              ↶ Undo
            </button>
          )}
          <button className="ghost" onClick={onHide}>
            View board
          </button>
        </div>
      </div>
    </div>
  );
}
