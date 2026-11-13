// The side panel: the game log and the coach notes, and in an online game a Chat tab beside the log. Full board: a slim tab in the
// turn strip shows the latest line, and the panel opens over the board on the right (default), the left, or along the
// bottom above the hand (board settings, src/lib/boardSettings.ts `panel`); 'hidden' leaves it out. Compact (phone)
// board: a bottom sheet. Its open state is the caller's (kept for the session).
// Focus: opening it moves focus in and Escape closes it, returning focus to the toggle. The phone sheet keeps Tab
// inside; the full board's panel does not, because it stays open while you play (a trap would lock the board).
import { memo, useEffect, useRef, useState } from 'react';
import type { Game } from '../../../engine/engine';
import { DEFAULT_BOARD_SETTINGS, type SidePanelSettings } from '../../../lib/boardSettings';
import { useFocusTrap } from '../Modal';
import { MentionRoving, MentionText, rovingProps } from '../CardMention';

type LogLine = Game['s']['log'][number];

const who = (l: LogLine) => (l.player !== null && !l.text.startsWith('---') ? (l.player === 0 ? 'You: ' : 'Rival: ') : '');
const isTurnHeader = (l: LogLine) => l.player !== null && l.text.startsWith('--- Turn');

/** How the log reads: the side panel's display settings. */
export type LogView = Pick<SidePanelSettings, 'density' | 'order' | 'turnMarkers'>;
const DEFAULT_VIEW: LogView = DEFAULT_BOARD_SETTINGS.panel;

/** The lines shown, oldest first: the last 250, without the turn headers when turn markers are off. */
export function visibleLines(log: readonly LogLine[], view: LogView): LogLine[] {
  const lines = log.slice(-250);
  const kept = view.turnMarkers ? lines : lines.filter((l) => !isTurnHeader(l));
  return view.order === 'newest-first' ? kept.reverse() : kept;
}

/** The log lines. The engine appends to `log` in place, so `n` (its length) is what changes. Card names are mentions
 * (CardMention.tsx), reached with the arrow keys from the log box (one Tab stop for the whole log). */
export const GameLog = memo(function GameLog({ log, view = DEFAULT_VIEW, names }: { log: Game['s']['log']; n: number; view?: LogView; names?: readonly string[] }) {
  const marks = view.turnMarkers && view.density === 'detailed';
  return (
    <MentionRoving>
      {visibleLines(log, view).map((l, i) => (
        <div key={i} className={l.player === null ? 'sys' : l.player === 0 ? 'p0' : 'p1'} title={view.density === 'compact' ? `${who(l)}${l.text}` : undefined}>
          {marks && !isTurnHeader(l) && <span className="pb-log-turn">T{l.turn}</span>}
          {/* who acted, in words as well as colour (turn headers already name the deck) */}
          {who(l) && <b>{who(l)}</b>}
          {/* card names point to the card (a turn header names the decks: plain) */}
          {isTurnHeader(l) ? l.text : <MentionText text={l.text} skip={names} />}
        </div>
      ))}
    </MentionRoving>
  );
});

export const DRAWER_ID = 'pb-log-drawer';

/** The collapsed panel: a toggle showing the latest log line (and how many coach warnings are live). */
export function LogTab({
  log,
  open,
  onToggle,
  warnings,
  side = 'right',
  unread = 0,
  chat = false,
}: {
  log: Game['s']['log'];
  open: boolean;
  onToggle: (open: boolean) => void;
  warnings: number;
  side?: SidePanelSettings['position'];
  /** chat messages not seen yet (a dot while the panel is closed) */
  unread?: number;
  /** the panel has a Chat tab */
  chat?: boolean;
}) {
  const last = log[log.length - 1];
  const arrow = side === 'left' ? (open ? '◂' : '▸') : side === 'bottom' ? (open ? '▾' : '▴') : open ? '▸' : '◂';
  return (
    <button
      type="button"
      className={`pb-logtab ${open ? 'is-open' : ''}`}
      aria-expanded={open}
      aria-controls={DRAWER_ID}
      onClick={() => onToggle(!open)}
      title={open ? `Close the ${chat ? 'log and chat' : 'game log'}` : `Open the ${chat ? 'log and chat' : 'game log'}`}
      aria-label={unread > 0 ? `${chat ? 'Log and chat' : 'Log'}, ${unread} unread message${unread > 1 ? 's' : ''}` : undefined}
    >
      <span className="pb-logtab-label">{chat ? 'Log · Chat' : 'Log'}</span>
      {unread > 0 && <span className="pb-unread-dot" aria-hidden="true" />}
      {warnings > 0 && (
        <span className="pb-logtab-warn" title={`${warnings} coach warning${warnings > 1 ? 's' : ''}`}>
          ⚠ {warnings}
        </span>
      )}
      <span className={`pb-logtab-line ${last ? (last.player === null ? 'sys' : last.player === 0 ? 'p0' : 'p1') : ''}`}>
        {last ? (
          <>
            {who(last)}
            {isTurnHeader(last) ? last.text : <MentionText text={last.text} passive />}
          </>
        ) : (
          'No moves yet'
        )}
      </span>
      <span aria-hidden="true">{arrow}</span>
    </button>
  );
}

/** The open panel: coach notes (if any), the log (kept scrolled to the newest line), and the bot's last move. */
export function LogDrawer({
  log,
  n,
  names,
  open,
  sheet,
  onClose,
  coach,
  footer,
  panel = DEFAULT_BOARD_SETTINGS.panel,
  chat,
  unread = 0,
  onChatShown,
}: {
  log: Game['s']['log'];
  n: number;
  /** the seats' names (deck names): never read as card names */
  names?: readonly string[];
  open: boolean;
  /** phones: a bottom sheet */
  sheet: boolean;
  onClose: () => void;
  coach?: React.ReactNode;
  footer?: React.ReactNode;
  /** position and display settings (position 'hidden' draws nothing) */
  panel?: SidePanelSettings;
  /** an online game's chat: a Chat tab beside the log */
  chat?: React.ReactNode;
  unread?: number;
  /** whether the chat is on screen now (its messages count as read) */
  onChatShown?: (shown: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'log' | 'chat'>('log');
  const showChat = !!chat && tab === 'chat';
  const box = useRef<HTMLElement>(null);
  const shown = open && panel.position !== 'hidden';
  // a panel already open when the board appears (its state lasts the session) doesn't take focus; one opened now does
  const [openedHere, setOpenedHere] = useState(false);
  const [wasOpen, setWasOpen] = useState(shown);
  if (shown !== wasOpen) {
    setWasOpen(shown);
    setOpenedHere(shown);
  }
  useFocusTrap(box, onClose, { active: shown && openedHere, initial: 'first', trap: sheet });
  const newestFirst = panel.order === 'newest-first';
  useEffect(() => {
    if (shown && ref.current) ref.current.scrollTop = newestFirst ? 0 : ref.current.scrollHeight;
  }, [n, shown, newestFirst, showChat]);
  useEffect(() => {
    onChatShown?.(shown && showChat);
  }, [onChatShown, shown, showChat]);
  // Escape also closes a panel that was already open (no focus wiring then); a dialog's own Escape comes first
  useEffect(() => {
    if (!shown) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [shown, onClose]);
  if (!shown) return null;
  const cls = ['pb-drawer', sheet ? 'pb-drawer-sheet' : `pb-panel-${panel.position}`, `pb-panel-${panel.density}`, `pb-panel-text-${panel.textSize}`].join(' ');
  return (
    <aside ref={box} id={DRAWER_ID} className={cls} aria-label={chat ? 'Game log and chat' : 'Game log'} tabIndex={-1}>
      <div className="pb-drawer-head">
        {chat ? (
          <div className="pb-drawer-tabs" role="tablist" aria-label="Side panel">
            <button type="button" role="tab" aria-selected={!showChat} className={!showChat ? 'on' : ''} onClick={() => setTab('log')}>
              Log
            </button>
            <button type="button" role="tab" aria-selected={showChat} className={showChat ? 'on' : ''} onClick={() => setTab('chat')}>
              Chat{unread > 0 && !showChat ? <span className="pb-unread-dot" aria-label={`${unread} unread`} /> : null}
            </button>
          </div>
        ) : (
          <span className="pb-label">Game log</span>
        )}
        <button type="button" className="ghost pb-drawer-close" onClick={onClose} aria-label={chat ? 'Close the log and chat' : 'Close the game log'}>
          ✕
        </button>
      </div>
      {showChat ? (
        chat
      ) : (
        <>
          {coach}
          <div className="log pb-log" ref={ref} aria-live="off" aria-label="Log lines (Left and Right arrows move between card names)" {...rovingProps}>
            <GameLog log={log} n={n} view={panel} names={names} />
          </div>
          {footer}
        </>
      )}
    </aside>
  );
}
