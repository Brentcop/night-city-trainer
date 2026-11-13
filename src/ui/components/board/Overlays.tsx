// Floating UI on the playmat: card action popover, trash viewer, mulligan screen, game-over overlay, the Concede /
// Exit game confirmation. Each takes focus when it opens, keeps Tab inside, and gives focus back when it closes
// (useFocusTrap, the shared Modal's wiring); the menu also moves with the arrow keys.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Game } from '../../../engine/engine';
import type { PlayerId } from '../../../engine/types';
import { Modal, useFocusTrap } from '../Modal';
import { TcgCard } from '../TcgCard';
import type { BoardCtx } from './BoardCard';
import { CoachBox, type CoachNote } from './CoachPanel';

/** "Are you sure?" before conceding (a recorded loss) or exiting (nothing recorded). Rendered at the document body. */
/** What the Exit dialog says when the game can be kept for later (a practice game with saved games on). */
export const EXIT_KEEP_TEXT =
  'Save and exit keeps this game in this browser: Resume game on the Play screen brings it back where you left it, and nothing is recorded until you finish it. One unfinished game is kept this way; starting another one asks first. Exit and discard ends the game with no result and removes its save.';
/** …and when it can't (saved games off, or this browser blocks storage). */
export const EXIT_DISCARD_TEXT = 'The game ends now and nothing is recorded: no result and no replay. This browser can’t keep it for later.';

/**
 * Concede or Exit, confirmed. Exit: with `onKeep` (the game can be kept) the safe choice comes first, "Save and exit",
 * and "Exit and discard" (`onConfirm`) is the second, red one; with a `note` (a multi-day game, an online game's own
 * wording) there is one button, which keeps the game when `onKeep` is given.
 */
export function LeaveDialog({
  kind,
  onConfirm,
  onCancel,
  onKeep,
  online,
  note,
}: {
  kind: 'concede' | 'exit';
  onConfirm: () => void;
  onCancel: () => void;
  onKeep?: () => void;
  online?: boolean;
  note?: string;
}) {
  const id = useId();
  const concede = kind === 'concede';
  const keepChoice = !concede && !online && !note && !!onKeep;
  return createPortal(
    <Modal labelledBy={id} onClose={onCancel} className="pb-leave">
      <h3 id={id} style={{ marginTop: 0 }}>
        {concede ? 'Concede this game?' : 'Exit this game?'}
      </h3>
      <p className="muted">
        {note && !concede
          ? note
          : online
          ? concede
            ? 'The game ends now as a loss for you and a win for the other player, recorded as conceded.'
            : 'You leave the game and the connection closes. The game ends as abandoned and is recorded as a draw on both sides.'
          : concede
            ? 'The game ends now as a loss, recorded in your practice log and replays as conceded. You can still undo from the result screen.'
            : keepChoice
              ? EXIT_KEEP_TEXT
              : EXIT_DISCARD_TEXT}
      </p>
      <div className="row pb-leave-actions">
        {keepChoice ? (
          <>
            <button className="primary" onClick={onKeep} data-autofocus>
              Save and exit
            </button>
            <button className="pb-danger" onClick={onConfirm}>
              Exit and discard
            </button>
          </>
        ) : (
          <button className={concede ? 'pb-danger' : 'primary'} onClick={!concede && note && onKeep ? onKeep : onConfirm}>
            {concede ? '⚑ Concede' : online && !note ? 'Leave game' : 'Exit game'}
          </button>
        )}
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
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose, { initial: 'first', arrows: true });
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
  // phones: a small panel against the right edge (the prompt panel's place), so the board's centre stays in view
  const sheet = ctx.narrow;
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
      <div ref={ref} className={`pb-menu ${sheet ? 'pb-menu-side' : ''}`} style={style} role="menu" aria-label={title} tabIndex={-1}>
        <div className="pb-menu-title" aria-hidden="true">
          {title}
        </div>
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
        {ctx.inspect && !hidden && (
          <button
            role="menuitem"
            className="pb-menu-item ghost"
            onClick={() => {
              onClose();
              ctx.inspect!(menu.uid);
            }}
          >
            🔍 Read card
          </button>
        )}
        <button role="menuitem" className="pb-menu-item ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </>
  );
}

export function TrashModal({ g, p, onClose }: { g: Game; p: PlayerId; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useFocusTrap(ref, onClose);
  const trash = [...g.P(p).trash].reverse();
  return (
    <div className="pb-modal-wrap" onClick={onClose}>
      <div ref={ref} className="pb-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div className="spread">
          <h3 id={id} style={{ margin: 0 }}>
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

export function MulliganScreen({ ctx, note }: { ctx: BoardCtx; note?: CoachNote }) {
  const { g, pend } = ctx;
  const ref = useRef<HTMLDivElement>(null);
  // the opening-hand choice can't be dismissed: Escape does nothing, it is answered with Keep or Mulligan
  useFocusTrap(ref, null);
  if (!pend) return null;
  const yes = pend.options.findIndex((o) => o.key === 'yes');
  const no = pend.options.findIndex((o) => o.key === 'no');
  const coachI = ctx.coach?.i;
  return (
    <div className="pb-modal-wrap pb-mulligan">
      <div ref={ref} className="pb-modal" role="dialog" aria-modal="true" aria-labelledby="pb-mull-title" tabIndex={-1}>
        <h2 id="pb-mull-title" style={{ margin: 0 }}>
          Your opening hand
        </h2>
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
          {g
            .P(0)
            .legends.map((u) => {
              const c = g.s.cards[u];
              return c && (c.faceUp || c.known) ? g.name(u) : 'face-down';
            })
            .join(' · ')}
        </div>
        <CoachBox pick={coachI !== undefined ? (coachI === yes ? 'Mulligan' : 'Keep hand') : null} why={note?.why} thinking={note?.thinking} />
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
  rematchLabel = 'Rematch',
  rematchDisabled = false,
  newLabel = 'New game',
}: {
  g: Game;
  conceded?: boolean;
  onRematch: () => void;
  rematchLabel?: string;
  rematchDisabled?: boolean;
  newLabel?: string;
  onNew: () => void;
  onHide: () => void;
  /** offered when there is a position to go back to (after a concede: the position you conceded from) */
  onUndo?: () => void;
  review?: React.ReactNode;
}) {
  const s = g.s;
  const win = s.winner === 0;
  const loss = s.winner === 1;
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  // Escape does what "View board" does
  useFocusTrap(ref, onHide);
  return (
    <div className="pb-modal-wrap pb-over">
      <div ref={ref} className={`pb-modal pb-over-card ${win ? 'win' : loss ? 'loss' : 'draw'} ${conceded ? 'conceded' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div id={id} className="pb-over-title">
          {conceded ? 'CONCEDED' : win ? 'VICTORY' : loss ? 'DEFEAT' : 'DRAW'}
        </div>
        <div className="pb-over-reason">{conceded ? 'You conceded. Recorded as a loss.' : s.winReason || '—'}</div>
        <div className="small muted">
          {s.turn} turns · you went {s.first === 0 ? 'first' : 'second'} · Gigs {g.gigsOf(0).length}–{g.gigsOf(1).length}
        </div>
        {review}
        <div className="row" style={{ marginTop: 16, justifyContent: 'center' }}>
          <button className="primary pb-big" onClick={onRematch} disabled={rematchDisabled}>
            {rematchLabel}
          </button>
          <button className="pb-big" onClick={onNew}>
            {newLabel}
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
