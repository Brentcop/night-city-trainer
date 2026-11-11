// Sidebar prompt: what the game is asking, the coach's pick, and button fallbacks for every option.
import { memo } from 'react';
import type { Decision } from '../../../engine/types';
import { CardBack, TcgCard } from '../TcgCard';
import { hiddenFromMe, type BoardCtx } from './BoardCard';

/** Choices the player can click on the table. On a phone the prompt dock covers the hand, so hand cards go in the tray. */
function onBoard(ctx: BoardCtx, uid: number): boolean {
  const c = ctx.g.s.cards[uid];
  if (!c) return false;
  return c.zone === 'field' || c.zone === 'legends' || (c.zone === 'hand' && c.controller === 0 && !ctx.narrow);
}

/** One-line headline for the middle of the table. */
export function headline(ctx: BoardCtx): { text: string; tone: 'me' | 'rival' | 'alert' | 'idle' } {
  const { g, pend, targeting } = ctx;
  if (g.s.winner !== null) return { text: g.s.winner === 0 ? 'You win!' : g.s.winner === 1 ? 'Rival wins' : 'Draw', tone: 'idle' };
  if (targeting) return { text: `Choose a target for ${g.name(targeting.attacker)} — a glowing unit or the Gig area`, tone: 'me' };
  if (!pend) return { text: g.s.active === 1 ? "Rival's turn…" : 'Resolving…', tone: 'rival' };
  if (pend.kind === 'action') return { text: 'Your move — click a marked card to act, or end your turn', tone: 'me' };
  if (pend.kind === 'reaction') {
    const a = g.s.attack;
    if (a) {
      const tgt = a.targetUnit !== null ? `your ${g.name(a.targetUnit)}` : 'your Gig area';
      let pw = '';
      try {
        pw = ` (${g.power(a.attacker)})`;
      } catch {
        /* ignore */
      }
      return { text: `Rival's ${g.name(a.attacker)}${pw} attacks ${tgt} — react?`, tone: 'alert' };
    }
    return { text: pend.prompt, tone: 'alert' };
  }
  return { text: pend.prompt, tone: 'me' };
}

/**
 * The current prompt. `hidePass`: the End turn / No reaction button is shown next to it already (the full board's
 * action dock), so the panel leaves it out.
 */
export function PromptPanel({ ctx, why, hidePass }: { ctx: BoardCtx; why?: string; hidePass?: boolean }) {
  const { g, pend, ix, targeting, coach } = ctx;
  if (g.s.winner !== null) {
    return (
      <div className="pb-prompt">
        <b>{g.s.winner === 0 ? 'You win!' : g.s.winner === 1 ? 'Rival wins' : 'Draw'}</b>
        <div className="muted small">{g.s.winReason}</div>
      </div>
    );
  }
  if (!pend) {
    return (
      <div className="pb-prompt pb-wait">
        <span className="pb-spinner" /> Rival is thinking…
      </div>
    );
  }
  const coachBox = coach && pend.options[coach.i] && (
    <div className="pb-coach-box">
      <b>Coach:</b> {pend.options[coach.i].label}
      {why && <div className="muted small">{why}</div>}
    </div>
  );
  const btn = (i: number, label?: string, primary = false) => (
    <button key={i} className={`${primary ? 'primary' : ''} ${coach?.i === i ? 'pb-coach-btn' : ''}`} onClick={() => ctx.answer(i)}>
      {label ?? pend.options[i]?.label}
    </button>
  );

  if (targeting) {
    return (
      <div className="pb-prompt">
        <b>Attack with {g.name(targeting.attacker)}</b>
        <div className="small muted">Click a glowing rival unit or the rival Gig area.</div>
        {coachBox}
        <div className="pb-opts">
          {targeting.targets.map((t) => btn(t.i, t.label))}
          <button className="ghost" onClick={ctx.cancelTargeting}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (pend.kind === 'action') {
    return (
      <div className="pb-prompt">
        <b>Your main phase</b>
        {/* the action dock is short on height: just the key to the marks (the banner says what to do) */}
        <div className="small muted">{hidePass ? '▶ play · ⚔ attack · ✦ ability · €$ sell' : 'Marked cards have actions (▶ play, ⚔ attack, ✦ ability, €$ sell) — click one to see them. Hover any card to read it.'}</div>
        {coachBox}
        {ix.passIndex === null ? (
          <div className="small" style={{ color: 'var(--red)', marginTop: 6 }}>
            A unit must attack before you can end your turn.
          </div>
        ) : (
          !hidePass && <div className="pb-opts">{btn(ix.passIndex, 'End turn', true)}</div>
        )}
      </div>
    );
  }

  if (pend.kind === 'reaction') {
    const h = headline(ctx);
    return (
      <div className="pb-prompt pb-prompt-alert">
        <b>{h.text}</b>
        <div className="small muted">Click a ⛨ unit to block, or choose a reaction.</div>
        {coachBox}
        <div className="pb-opts">
          {pend.options.map((o, i) => (i === ix.passIndex ? null : btn(i)))}
          {ix.passIndex !== null && !hidePass && btn(ix.passIndex, 'No reaction', true)}
        </div>
      </div>
    );
  }

  if (pend.kind === 'yesno' && pend.tag === 'mulligan') {
    return (
      <div className="pb-prompt">
        <b>Keep or mulligan your opening hand</b>
        {coachBox}
      </div>
    );
  }

  const tray = ix.cardOpts.filter((o) => !onBoard(ctx, o.uid));
  const onBoardCount = ix.cardOpts.length - tray.length;
  return (
    <div className="pb-prompt">
      <b>{pend.prompt}</b>
      {pend.source !== undefined && g.s.cards[pend.source] && (
        <div className="pb-source">
          <TcgCard def={g.def(pend.source)} size="xs" />
          <span className="small muted">from {g.name(pend.source)}</span>
        </div>
      )}
      {onBoardCount > 0 && <div className="small muted">Click a glowing card on the table.</div>}
      {pend.kind === 'pay' && <div className="small muted">Or click a glowing Legend, or your €$ pile for an Eddie.</div>}
      {pend.kind === 'order' && <div className="small muted">The others stay pending; you choose again after this one resolves.</div>}
      {ix.gigDirect.size > 0 && <div className="small muted">Click a glowing die.</div>}
      {coachBox}
      {tray.length > 0 && (
        <div className="pb-tray">
          {tray.map((o) => {
            const c = g.s.cards[o.uid];
            const isCoach = coach?.i === o.i;
            return (
              <div key={o.i} className={`pb-tray-item ${isCoach ? 'pb-coach' : ''}`} title={pend.options[o.i]?.label}>
                {!c || hiddenFromMe(g, o.uid) ? (
                  <CardBack size="sm" targetable onClick={() => ctx.answer(o.i)} label={pend.options[o.i]?.label} />
                ) : (
                  <TcgCard def={g.def(o.uid)} size="sm" targetable selected={isCoach} onClick={() => ctx.answer(o.i)} />
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="pb-opts">{ix.buttonOpts.map((i) => btn(i))}</div>
    </div>
  );
}

/**
 * Every option of the current decision as a button. Its open state is the caller's (kept for the session), so it stays
 * open across decisions, the bot's turns, Undo and re-renders until the player closes it; with nothing to decide it
 * stays in place and says so. Memoised: it changes only with the decision, the coach's pick, the handler or `open`.
 */
export const AllActions = memo(function AllActions({
  pend,
  coachI,
  answer,
  open,
  onToggle,
}: {
  pend: Decision | null;
  coachI: number | null;
  answer: (i: number) => void;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const id = 'pb-all-actions';
  return (
    <div className={`pb-all ${open ? 'is-open' : ''}`}>
      <button type="button" className="ghost pb-all-toggle" aria-expanded={open} aria-controls={id} onClick={() => onToggle(!open)}>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> All actions{pend ? ` (${pend.options.length})` : ''}
      </button>
      {open && (
        <div className="pb-opts pb-all-list" id={id}>
          {pend ? (
            pend.options.map((o, i) => (
              <button key={i} className={coachI === i ? 'pb-coach-btn' : ''} onClick={() => answer(i)}>
                {o.label}
              </button>
            ))
          ) : (
            <span className="small muted">Nothing to decide right now.</span>
          )}
        </div>
      )}
    </div>
  );
});
