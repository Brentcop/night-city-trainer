// Phone board pieces: the small prompt panel against the right edge (collapsible to a tab), the game menu behind ☰,
// and the card reader (a tap on a card with nothing to do, a long press on any card, or "Read card").
import { useId, useRef } from 'react';
import { useFocusTrap } from '../Modal';
import { createPortal } from 'react-dom';
import type { Game } from '../../../engine/engine';
import type { Decision } from '../../../engine/types';
import { CardText } from '../CardView';
import { CardBack, TcgCard } from '../TcgCard';
import { hiddenFromMe, type BoardCtx } from './BoardCard';
import { promptChoices, type Targeting } from './interaction';
import { headline } from './PromptPanel';
import { BOT_SPEEDS } from './prefs';

export type PanelState = 'none' | 'tab' | 'open';

/**
 * Whether the phone's prompt panel shows, as a tab or open. Nothing to decide, the mulligan (its own dialog) and a
 * finished game: none. Your main phase: the panel only carries "All actions", so it is open while that list is open
 * and a tab otherwise. Any other prompt (a choice, a Gig roll, a reaction, choosing an attack target): open, unless the
 * player collapsed it for this decision.
 */
export function phonePanelState(o: { pend: Decision | null; targeting: Targeting | null; over: boolean; allOpen: boolean; collapsed: boolean }): PanelState {
  const { pend, targeting, over } = o;
  if (!pend || over || (pend.kind === 'yesno' && pend.tag === 'mulligan')) return 'none';
  if (pend.kind === 'action' && !targeting) return o.allOpen && !o.collapsed ? 'open' : 'tab';
  return o.collapsed ? 'tab' : 'open';
}

/** The prompt's one-line title for the panel and its tab. */
function panelTitle(ctx: BoardCtx): string {
  const { g, pend, targeting } = ctx;
  if (targeting) return `Attack with ${g.name(targeting.attacker)}: tap a ◎ target`;
  if (!pend) return '';
  if (pend.kind === 'action') return 'Your move';
  if (pend.kind === 'reaction') return headline(ctx).text;
  return pend.prompt;
}

/**
 * The phone's prompt panel: a small box against the right edge with the instruction and buttons. Cards on the table are
 * picked on the board (they are marked), so they aren't repeated here; cards that aren't on the table show small (tap
 * one to read it, then choose it). The turn button (End turn / No reaction / Cancel attack) is in the banner.
 */
export function PhonePanel({
  ctx,
  state,
  why,
  onCollapse,
  onExpand,
  onPeek,
  allActions,
  paySelect,
}: {
  /** "Choose before playing": the "Pay with" row, shown in your main phase and reactions */
  paySelect?: React.ReactNode;
  ctx: BoardCtx;
  state: PanelState;
  why?: string;
  onCollapse: () => void;
  onExpand: () => void;
  /** read a card; with `choose`, the reader offers to pick that option */
  onPeek: (uid: number, choose?: number) => void;
  allActions: React.ReactNode;
}) {
  const { g, pend, ix, coach, targeting } = ctx;
  if (state === 'none' || !pend) return null;
  const title = panelTitle(ctx);
  if (state === 'tab') {
    return (
      <button type="button" className={`pb-pp-tab ${pend.kind === 'action' && !targeting ? '' : 'is-prompt'}`} onClick={onExpand} aria-label={`Show the prompt: ${title}`}>
        <span aria-hidden="true">◂</span>
        <span className="pb-pp-tab-text">{pend.kind === 'action' && !targeting ? 'Actions' : title}</span>
      </button>
    );
  }
  const btn = (i: number, label?: string, primary = false) => (
    <button key={i} className={`${primary ? 'primary' : ''} ${coach?.i === i ? 'pb-coach-btn' : ''}`} onClick={() => ctx.answer(i)}>
      {label ?? pend.options[i]?.label}
    </button>
  );
  let body: React.ReactNode = null;
  if (targeting) {
    const gigs = targeting.targets.filter((t) => t.unit === null);
    body = (
      <div className="pb-pp-btns">
        {gigs.map((t) => btn(t.i, 'Gig area'))}
        <button className="ghost" onClick={ctx.cancelTargeting}>
          Cancel
        </button>
      </div>
    );
  } else if (pend.kind === 'action') {
    body = <div className="pb-pp-hint">Tap a marked card to act.</div>;
  } else if (pend.kind === 'reaction') {
    body = <div className="pb-pp-hint">Tap a ⛨ unit to block, or a marked card to react.</div>;
  } else {
    const { board, tray, buttons } = promptChoices(g, ix);
    body = (
      <>
        {pend.source !== undefined && g.s.cards[pend.source] && <div className="pb-pp-hint">from {g.name(pend.source)}</div>}
        {board.length > 0 && <div className="pb-pp-hint">Tap a ◎ card on the board.</div>}
        {pend.kind === 'pay' && <div className="pb-pp-hint">Or tap a ◎ Legend.</div>}
        {ix.gigDirect.size > 0 && <div className="pb-pp-hint">Or tap a glowing die.</div>}
        {tray.length > 0 && (
          <div className="pb-pp-tray">
            {tray.map((o) => {
              const c = g.s.cards[o.uid];
              const hidden = !c || hiddenFromMe(g, o.uid);
              return (
                <div key={o.i} className={`pb-tray-item ${coach?.i === o.i ? 'pb-coach' : ''}`} title={pend.options[o.i]?.label}>
                  {hidden ? (
                    <CardBack size="xs" targetable onClick={() => ctx.answer(o.i)} label={pend.options[o.i]?.label} />
                  ) : (
                    <TcgCard def={g.def(o.uid)} size="xs" targetable selected={coach?.i === o.i} onClick={() => onPeek(o.uid, o.i)} ariaLabel={`${g.def(o.uid).displayName}: read, then choose`} />
                  )}
                </div>
              );
            })}
          </div>
        )}
        {buttons.length > 0 && <div className="pb-pp-btns">{buttons.map((i) => btn(i))}</div>}
      </>
    );
  }
  const coachLabel = coach && pend.options[coach.i]?.label;
  return (
    <aside className={`pb-pp ${pend.kind === 'reaction' ? 'is-alert' : ''}`} aria-label="Prompt">
      <div className="pb-pp-head">
        <b className="pb-pp-title">{title}</b>
        <button type="button" className="ghost pb-pp-min" onClick={onCollapse} aria-label="Hide the prompt to a tab">
          ▸
        </button>
      </div>
      {coachLabel && (
        <div className="pb-pp-coach" title={why}>
          <b>Coach:</b> {coachLabel}
        </div>
      )}
      {body}
      {!targeting && (pend.kind === 'action' || pend.kind === 'reaction') && paySelect}
      {allActions}
    </aside>
  );
}

/** The phone strip's ☰ menu: the rarely used controls (site pages and theme, bot speed, hand order, Exit). */
export function GameMenu({
  speed,
  setSpeed,
  sortLabel,
  onSort,
  onSite,
  onExit,
  exitLabel,
  onResult,
  onExport,
  onSave,
  onSettings,
  onClose,
}: {
  speed: number;
  setSpeed: (ms: number) => void;
  sortLabel: string;
  onSort: () => void;
  onSite: () => void;
  onExit: () => void;
  exitLabel: string;
  onResult?: () => void;
  /** after the game: save it as a file with the coach's advice (INFO-9) */
  onExport?: () => void;
  /** during the game: save it to come back to (a named save in this browser) */
  onSave?: () => void;
  /** the board settings dialog (paying costs, side panel, colours, backgrounds) */
  onSettings?: () => void;
  onClose: () => void;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose, { initial: 'first', arrows: true });
  const run = (f: () => void) => () => {
    onClose();
    f();
  };
  return (
    <>
      <div className="pb-backdrop" onClick={onClose} />
      <div ref={ref} className="pb-gamemenu" role="menu" aria-label="Game menu" tabIndex={-1}>
        {onResult && (
          <button role="menuitem" onClick={run(onResult)}>
            Show the result
          </button>
        )}
        <label className="pb-gamemenu-row" htmlFor={id}>
          <span>Bot speed</span>
          <select id={id} value={speed} onChange={(e) => setSpeed(+e.target.value)}>
            {BOT_SPEEDS.map((x) => (
              <option key={x.ms} value={x.ms}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <button role="menuitem" onClick={onSort} title="Sort your hand (or drag a card onto another to reorder)">
          ⇅ Hand: {sortLabel}
        </button>
        {onSettings && (
          <button role="menuitem" onClick={run(onSettings)}>
            ⚙ Settings…
          </button>
        )}
        {onSave && (
          <button role="menuitem" onClick={run(onSave)}>
            Save game…
          </button>
        )}
        {onExport && (
          <button role="menuitem" onClick={run(onExport)}>
            ⤓ Export game
          </button>
        )}
        <button role="menuitem" onClick={run(onSite)}>
          Pages, theme and card art…
        </button>
        <button role="menuitem" className="pb-exit" onClick={run(onExit)}>
          {exitLabel}
        </button>
      </div>
    </>
  );
}

/** A card shown large enough to read, over everything; tap anywhere to close. With `onChoose`, it can be picked. */
export function CardPeek({ g, uid, onClose, onChoose }: { g: Game; uid: number; onClose: () => void; onChoose?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // focus starts on Close (data-autofocus), stays inside, and returns to the card or button that opened the reader
  useFocusTrap(ref, onClose);
  const c = g.s.cards[uid];
  if (!c || hiddenFromMe(g, uid)) return null;
  const def = g.def(uid);
  let power: number | undefined;
  if (c.zone === 'field') {
    try {
      power = g.power(c);
    } catch {
      power = undefined;
    }
  }
  return createPortal(
    <div ref={ref} className="pb-peek" onClick={onClose} role="dialog" aria-modal="true" aria-label={def.displayName} tabIndex={-1}>
      <div className="pb-peek-body" onClick={(e) => e.stopPropagation()}>
        <TcgCard def={def} size="xl" noZoom power={power} />
        <div className="pb-peek-text">
          <b>{def.displayName}</b>
          <div className="muted small">
            {def.type} · {def.cost ?? '–'} €$ · {def.color} RAM {def.ram}
            {def.tags.length ? ` · ${def.tags.join(', ')}` : ''}
          </div>
          <div className="small pb-peek-rules">
            <CardText text={def.text} />
          </div>
        </div>
        <div className="pb-peek-actions">
          {onChoose && (
            <button className="primary" onClick={onChoose}>
              Choose
            </button>
          )}
          <button onClick={onClose} data-autofocus>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
