// The game log as a drawer. Full board: a slim tab at the right end of the turn strip shows the latest line, and the
// drawer opens down the right edge over the board (the board keeps its size). Compact (phone) board: a bottom sheet.
// Its open state is the caller's (kept for the session).
import { memo, useEffect, useRef } from 'react';
import type { Game } from '../../../engine/engine';

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
  useEffect(() => {
    if (open && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [n, open]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <aside id={DRAWER_ID} className={`pb-drawer ${sheet ? 'pb-drawer-sheet' : ''}`} aria-label="Game log">
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
