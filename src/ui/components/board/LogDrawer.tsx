// The game log as a drawer. Full board: a slim tab at the right end of the turn strip shows the latest line, and the
// drawer opens down the right edge over the board (the board keeps its size). Compact (phone) board: a bottom sheet.
// Its open state is the caller's (kept for the session).
// Focus: opening it moves focus in and Escape closes it, returning focus to the toggle. The phone sheet keeps Tab
// inside; the full board's drawer does not, because it stays open while you play (a trap would lock the board).
import { memo, useEffect, useRef, useState } from 'react';
import type { Game } from '../../../engine/engine';
import { useFocusTrap } from '../Modal';

type LogLine = Game['s']['log'][number];

const who = (l: LogLine) => (l.player !== null && !l.text.startsWith('---') ? (l.player === 0 ? 'You: ' : 'Rival: ') : '');

/** The last 250 log lines. The engine appends to `log` in place, so `n` (its length) is what changes. */
export const GameLog = memo(function GameLog({ log }: { log: Game['s']['log']; n: number }) {
  return (
    <>
      {log.slice(-250).map((l, i) => (
        <div key={i} className={l.player === null ? 'sys' : l.player === 0 ? 'p0' : 'p1'}>
          {/* who acted, in words as well as colour (turn headers already name the deck) */}
          {who(l) && <b>{who(l)}</b>}
          {l.text}
        </div>
      ))}
    </>
  );
});

export const DRAWER_ID = 'pb-log-drawer';

/** The collapsed drawer: a toggle showing the latest log line (and how many coach warnings are live). */
export function LogTab({ log, open, onToggle, warnings }: { log: Game['s']['log']; open: boolean; onToggle: (open: boolean) => void; warnings: number }) {
  const last = log[log.length - 1];
  return (
    <button
      type="button"
      className={`pb-logtab ${open ? 'is-open' : ''}`}
      aria-expanded={open}
      aria-controls={DRAWER_ID}
      onClick={() => onToggle(!open)}
      title={open ? 'Close the game log' : 'Open the game log'}
    >
      <span className="pb-logtab-label">Log</span>
      {warnings > 0 && (
        <span className="pb-logtab-warn" title={`${warnings} coach warning${warnings > 1 ? 's' : ''}`}>
          ⚠ {warnings}
        </span>
      )}
      <span className={`pb-logtab-line ${last ? (last.player === null ? 'sys' : last.player === 0 ? 'p0' : 'p1') : ''}`}>{last ? `${who(last)}${last.text}` : 'No moves yet'}</span>
      <span aria-hidden="true">{open ? '▸' : '◂'}</span>
    </button>
  );
}

/** The open drawer: coach notes (if any), the log (kept scrolled to the newest line), and the bot's last move. */
export function LogDrawer({
  log,
  n,
  open,
  sheet,
  onClose,
  coach,
  footer,
}: {
  log: Game['s']['log'];
  n: number;
  open: boolean;
  /** phones: a bottom sheet */
  sheet: boolean;
  onClose: () => void;
  coach?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLElement>(null);
  // a drawer already open when the board appears (its state lasts the session) doesn't take focus; one opened now does
  const [openedHere, setOpenedHere] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setOpenedHere(open);
  }
  useFocusTrap(box, onClose, { active: open && openedHere, initial: 'first', trap: sheet });
  useEffect(() => {
    if (open && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [n, open]);
  // Escape also closes a drawer that was already open (no focus wiring then); a dialog's own Escape comes first
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <aside ref={box} id={DRAWER_ID} className={`pb-drawer ${sheet ? 'pb-drawer-sheet' : ''}`} aria-label="Game log" tabIndex={-1}>
      <div className="pb-drawer-head">
        <span className="pb-label">Game log</span>
        <button type="button" className="ghost pb-drawer-close" onClick={onClose} aria-label="Close the game log">
          ✕
        </button>
      </div>
      {coach}
      <div className="log pb-log" ref={ref} aria-live="off">
        <GameLog log={log} n={n} />
      </div>
      {footer}
    </aside>
  );
}
