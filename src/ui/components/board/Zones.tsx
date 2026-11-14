// Playmat zones: Gig area (dice), piles (deck / trash / Eddies), hands, a full player side, and the board background's
// layers (BoardFx).
import { useState } from 'react';
import type { PlayerId } from '../../../engine/types';
import { lessMotion } from '../../useBoardSettings';
import { Die } from '../Dice';
import { CardBack, pressable, TcgCard } from '../TcgCard';
import { BoardCard, type BoardCtx } from './BoardCard';

/**
 * The board background's layers (src/ui/themes.css .pb-fx): the mat itself, plus two layers the hex, rain, skyline and
 * floor backgrounds draw into. Decoration only, behind everything; the settings dialog's previews use it too.
 */
export function BoardFx() {
  return (
    <span className="pb-fx" aria-hidden="true">
      <i className="pb-fx-a" />
      <i className="pb-fx-b" />
    </span>
  );
}

function GigArea({ p, ctx }: { p: PlayerId; ctx: BoardCtx }) {
  const { g, ix, targeting, coach } = ctx;
  const P = g.P(p);
  const gigs = g.gigsOf(p);
  const fixer = P.fixer.map((id) => g.s.gigs[id]).filter(Boolean);
  const cred = g.streetCred(p);
  const target = targeting?.targets.find((t) => t.unit === null && t.gigs === p);
  const att = g.s.attack;
  const attacked = !!att && att.targetUnit === null && att.targetGigs === p;
  const coachArea = coach?.gigArea === p && (!targeting || coach.attacker === targeting.attacker);
  const size = ctx.narrow ? 32 : 42;
  const over = ctx.drag?.over?.kind === 'gigs' && p === 1;
  const cls = ['pb-gigs', target ? 'pb-drop' : '', attacked ? 'pb-attacked' : '', coachArea ? 'pb-coach' : '', over ? 'pb-drop-over' : ''].join(' ');
  return (
    <div
      data-drop={p === 1 ? 'gigs' : undefined}
      className={cls}
      onClick={target ? () => ctx.answer(target.i) : undefined}
      {...pressable(target ? () => ctx.answer(target.i) : undefined, 'Attack the Gig area')}
      title={target ? 'Attack the Gig area' : undefined}
    >
      <div className="pb-gigs-head">
        <span className="pb-label">Gigs</span>
        <b className={gigs.length >= 6 ? 'pb-gigs-hot' : ''}>{gigs.length}/7</b>
        <span className="pb-cred" title="Street Cred (sum of your Gig values)">
          ☆ {cred ?? '–'}
        </span>
        {coachArea && <span className="chip pb-chip-coach">{ctx.markLabel ?? 'Coach'}</span>}
      </div>
      <div className="pb-dice">
        {gigs.map((x) => {
          const pick = ix.gigDirect.get(x.id);
          // a stolen Gig (it sits with the player who did not roll it) flashes once in the thief's colour as it lands
          const stolen = x.owner !== p ? ` pb-die-stolen pb-thief-${p === 0 ? 'me' : 'rival'}` : '';
          return (
            <span key={x.id} className={`pb-die${stolen}`}>
              <Die
                sides={x.sides}
                value={x.value}
                size={size}
                owner={x.owner === 0 ? 'me' : 'rival'}
                highlight={ix.gigHighlight.has(x.id) || !!coach?.gigs.has(x.id)}
                onClick={pick !== undefined ? () => ctx.answer(pick) : undefined}
                title={`d${x.sides}: ${x.value}${x.owner !== p ? ' (stolen)' : ''}`}
              />
            </span>
          );
        })}
        {fixer.map((x) => {
          const pick = ix.gigDirect.get(x.id);
          return (
            <span key={x.id} className="pb-die pb-die-fixer">
              <Die
                sides={x.sides}
                size={size * 0.8}
                owner={x.owner === 0 ? 'me' : 'rival'}
                pending
                highlight={ix.gigHighlight.has(x.id) || !!coach?.gigs.has(x.id)}
                onClick={pick !== undefined ? () => ctx.answer(pick) : undefined}
                title={`d${x.sides} in the fixer area`}
              />
            </span>
          );
        })}
        {!gigs.length && !fixer.length && <span className="muted small">no dice</span>}
      </div>
      {target && <div className="pb-drop-hint">⚔ Attack the Gig area</div>}
    </div>
  );
}

/**
 * A player's Eddies. `row`: laid out as a row of face-down cards under the Legends (desktop and tablet), so everything
 * that pays a cost sits together and a spent Eddie looks spent; otherwise the pile with pips (phones).
 */
function EddiePile({ p, ctx, row }: { p: PlayerId; ctx: BoardCtx; row?: boolean }) {
  const { g } = ctx;
  const P = g.P(p);
  // the €$ figure counts everything that can pay: Eddies, and the Legends in the Legends area (1 €$ each)
  const readyEddies = P.eddies.filter((u) => g.s.cards[u] && !g.s.cards[u].spent).length;
  const ready = g.payables(p).length;
  // a face-up Legend pays only if it is sellable (economy.ts payables)
  const payLegends = P.legends.filter((u) => {
    const c = g.s.cards[u];
    return c && (!c.faceUp || g.def(c).sellable);
  }).length;
  const total = P.eddies.length + payLegends;
  const split = `${readyEddies} of ${P.eddies.length} Eddies and ${ready - readyEddies} of ${payLegends} Legends ready`;
  // paying a cost: clicking your Eddie pile spends an Eddie
  const payEddie = p === 0 && ctx.pend?.kind === 'pay' ? ctx.pend.options.findIndex((o) => o.key === 'eddie') : -1;
  // "Choose before playing": a tap on your €$ pile selects one more Eddie for the next cost
  const pick = p === 0 && payEddie < 0 ? ctx.eddiePick : undefined;
  const onPile = payEddie >= 0 ? () => ctx.answer(payEddie) : pick ? pick.add : undefined;
  // ready Eddies come first in the order of selection: the first `selected` ready ones are marked
  let readySeen = 0;
  const marks = P.eddies.slice(0, row ? 14 : 12).map((u) => {
    const spent = !!g.s.cards[u]?.spent;
    const sel = !spent && !!pick && readySeen++ < pick.selected;
    return { u, cls: `${spent ? 'off' : 'on'}${sel ? ' sel' : ''}` };
  });
  return (
        <div
          className={`${row ? 'pb-eddie-row' : 'pb-pile'} ${p === 0 ? 'pb-sell-zone' : ''} ${p === 0 && ctx.drag?.over?.kind === 'sell' ? 'pb-drop-over' : ''}`}
          data-drop={p === 0 ? 'sell' : undefined}
          title={
            payEddie >= 0
              ? `€$ ${ready} ready of ${total} (${split}). Click to spend an Eddie.`
              : pick
                ? `€$ ${ready} ready of ${total} (${split}), ${pick.selected} selected to pay. Click to select one more.`
                : p === 0
                  ? `€$ ${ready} ready of ${total} (${split}). Drag a card here to sell it.`
                  : `€$ ${ready} ready of ${total} (${split})`
          }
          onClick={onPile}
          {...pressable(onPile, payEddie >= 0 ? 'Spend an Eddie' : `Select an Eddie to pay with (${pick?.selected ?? 0} selected)`)}
        >
          {row ? (
            <>
              <div className="pb-pile-cap">
                €$ <b>{ready}</b>/{total}
                {pick && pick.selected > 0 && <span className="pb-pay-count"> · {pick.selected} sel.</span>}
              </div>
              <div className="pb-eddie-cards">
                {marks.map((m) => (
                  <span key={m.u} className={`pb-eddie ${m.cls}`}>
                    <CardBack size="xs" label="€$" />
                  </span>
                ))}
                {P.eddies.length > marks.length && <span className="pb-eddie-more">+{P.eddies.length - marks.length}</span>}
                {!P.eddies.length && <span className="pb-eddie-none">{p === 0 ? 'sell a card for an Eddie' : 'no Eddies'}</span>}
              </div>
            </>
          ) : (
            <>
              <div className={`pb-stack ${total ? '' : 'pb-empty'}`} style={{ ['--n' as any]: Math.min(total, 5) }}>
                {total ? <CardBack size="xs" label="€$" /> : <div className="pb-empty-slot">€$</div>}
              </div>
              <div className="pb-pile-cap">
                €$ <b>{ready}</b>/{total}
                {pick && pick.selected > 0 && <span className="pb-pay-count"> · {pick.selected} sel.</span>}
              </div>
              <div className="pb-pips">
                {marks.map((m) => (
                  <i key={m.u} className={m.cls} />
                ))}
              </div>
            </>
          )}
        </div>
  );
}

/** "1 card", "3 cards". */
const cardCount = (n: number) => `${n} card${n === 1 ? '' : 's'}`;

/** The rival's hand fan stops growing at this many backs. */
export const HAND_BACKS_MAX = 7;

/**
 * The pulse when the rival's hand size changes: `k` counts the pulses so far (the number is re-keyed by it, so each one
 * runs once). The first render never pulses (the state starts at the number shown), nor does a change while motion is
 * reduced or off (`less`, from lessMotion()).
 */
export function handPulse(prev: { n: number; k: number }, n: number, less: boolean): { n: number; k: number } {
  if (prev.n === n) return prev;
  return { n, k: less ? prev.k : prev.k + 1 };
}

/** Whose hand it is, as the rest of the rival's side names the seat. */
export const rivalHandOwner = (ctx: BoardCtx) => ctx.seatLabels?.[1] ?? ctx.rivalName ?? 'Rival';

/**
 * The rival's hand size, said the same way on every layout: a few small card backs (`backs`; the board's own back, at
 * most HAND_BACKS_MAX, none for an empty hand), the word "Hand" and the number in bold read-out numerals. The desktop
 * board shows it in the rival's name row, phones as a tile in the rival's piles column (`tile`, no backs: the column is
 * 60px wide), and the replay boards beside their row of backs. Not focusable and no click of its own; it pulses once
 * when the number changes (handPulse).
 */
export function RivalHandCount({ n, owner, backs, tile, className }: { n: number; owner: string; backs?: boolean; tile?: boolean; className?: string }) {
  const label = `${owner}'s hand: ${cardCount(n)}`;
  const [pulse, setPulse] = useState(() => ({ n, k: 0 }));
  // a render-phase update (React's "state from the previous render" pattern): the pulse starts with the render that
  // shows the new number
  if (pulse.n !== n) setPulse(handPulse(pulse, n, lessMotion()));
  const shown = backs ? Math.min(n, HAND_BACKS_MAX) : 0;
  return (
    <div className={['pb-rh', tile ? 'pb-rh-tile' : '', className ?? ''].filter(Boolean).join(' ')} role="img" aria-label={label} title={label}>
      {shown > 0 && (
        <div className="pb-rh-backs" aria-hidden="true">
          {Array.from({ length: shown }, (_, i) => (
            <CardBack key={i} size="xs" />
          ))}
        </div>
      )}
      <span className="pb-rh-word">Hand</span>
      <b key={pulse.k} className={pulse.k ? 'pb-rh-n pb-rh-pulse' : 'pb-rh-n'}>
        {n}
      </b>
    </div>
  );
}

function Piles({ p, ctx, byLegends }: { p: PlayerId; ctx: BoardCtx; byLegends?: boolean }) {
  const { g } = ctx;
  const P = g.P(p);
  const top = P.trash[P.trash.length - 1];
  // paying a cost: clicking your Eddie pile spends an Eddie
  const payEddie = p === 0 && ctx.pend?.kind === 'pay' ? ctx.pend.options.findIndex((o) => o.key === 'eddie') : -1;
  // "Choose before playing": a tap on your €$ pile selects one more Eddie for the next cost
  const pick = p === 0 && payEddie < 0 ? ctx.eddiePick : undefined;
  const onPile = payEddie >= 0 ? () => ctx.answer(payEddie) : pick ? pick.add : undefined;
  // phones: the piles are a column of counts, and the whole column is one tap target for the trash (unless paying,
  // when your €$ count spends or selects an Eddie)
  const columnOpens = !!ctx.inspect && !onPile;
  return (
    <div
      className={`pb-piles ${columnOpens ? 'pb-piles-tap' : ''}`}
      onClick={columnOpens ? () => ctx.openTrash(p) : undefined}
      {...pressable(columnOpens ? () => ctx.openTrash(p) : undefined, `${p === 0 ? 'Your' : "The rival's"} piles: open the trash (${cardCount(P.trash.length)})`)}
    >
      {!byLegends && <EddiePile p={p} ctx={ctx} />}
      <div className="pb-pile" title={`Deck: ${cardCount(P.deck.length)}`}>
        <div className={`pb-stack ${P.deck.length ? '' : 'pb-empty'}`} style={{ ['--n' as any]: Math.min(P.deck.length, 5) }}>
          {P.deck.length ? <CardBack size="xs" /> : <div className="pb-empty-slot">deck</div>}
        </div>
        <div className="pb-pile-cap">
          Deck <b>{P.deck.length}</b>
        </div>
      </div>
      {/* the whole pile opens the trash (on phones only its caption shows) */}
      <div
        className="pb-pile pb-trash"
        title="Open the trash"
        onClick={columnOpens ? undefined : () => ctx.openTrash(p)}
        {...pressable(columnOpens ? undefined : () => ctx.openTrash(p), `${p === 0 ? 'Open your trash' : "Open the rival's trash"} (${cardCount(P.trash.length)})`)}
      >
        <div className="pb-stack">
          {top !== undefined && g.s.cards[top] ? (
            // no power badge: beside "Trash N" a number on the card reads like a count (UX-22)
            <TcgCard def={g.def(top)} size="xs" noPower />
          ) : (
            <div className="pb-empty-slot">trash</div>
          )}
        </div>
        <div className="pb-pile-cap">
          Trash <b>{P.trash.length}</b>
        </div>
      </div>
      {/* phones: the rival's hand size lives with their piles (their name row is hidden), as a tile */}
      {p === 1 && (
        <div className="pb-pile pb-pile-hand">
          <RivalHandCount n={P.hand.length} owner={rivalHandOwner(ctx)} tile />
        </div>
      )}
    </div>
  );
}

function RivalHand({ ctx }: { ctx: BoardCtx }) {
  const n = ctx.g.P(1).hand.length;
  return (
    <div className="pb-rival-hand">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="pb-rival-hand-card" aria-hidden="true">
          <CardBack size="xs" />
        </div>
      ))}
      <RivalHandCount n={n} owner={rivalHandOwner(ctx)} />
    </div>
  );
}

export function MyHand({ ctx }: { ctx: BoardCtx }) {
  const hand = ctx.handOrder ?? ctx.g.P(0).hand;
  const n = hand.length;
  const size = ctx.narrow ? 'sm' : 'md';
  // --hand-n: the full board overlaps the fan more as the hand grows, so it always fits its bar
  return (
    <div className={`pb-hand ${ctx.narrow ? 'pb-hand-scroll' : ''}`} style={{ ['--hand-n' as any]: Math.max(n, 1) }}>
      {hand.map((u, k) => {
        const off = k - (n - 1) / 2;
        return (
          <div key={u} className="pb-fan" style={{ ['--rot' as any]: `${ctx.narrow ? 0 : off * 2.2}deg`, ['--dy' as any]: `${ctx.narrow ? 0 : Math.abs(off) * Math.abs(off) * 1.4}px` }}>
            <BoardCard uid={u} size={size} ctx={ctx} />
            {/* phones: an overlapped card shows only a strip, so its name rides on that strip (board.css .pb-fan-cap) */}
            {ctx.narrow && (
              <span className="pb-fan-cap" aria-hidden="true">
                {ctx.g.def(u).displayName}
              </span>
            )}
          </div>
        );
      })}
      {!n && <span className="muted small">Your hand is empty</span>}
    </div>
  );
}

export function PlayerSide({ p, ctx }: { p: PlayerId; ctx: BoardCtx }) {
  const { g } = ctx;
  const P = g.P(p);
  const me = p === 0;
  const size = ctx.narrow ? 'xs' : 'sm';
  const active = g.s.active === p && g.s.winner === null;
  // desktop and tablet: the Eddies sit under the Legends (phones keep the count in the piles column)
  const eddiesByLegends = !ctx.inspect;
  const legends = (
    <div className="pb-zone pb-legends">
      <div className="pb-label">Legends</div>
      <div className="pb-cards">
        {P.legends.map((u) => (
          <BoardCard key={u} uid={u} size={size} ctx={ctx} />
        ))}
      </div>
      {eddiesByLegends && <EddiePile p={p} ctx={ctx} row />}
    </div>
  );
  const backRow = (
    <div className="pb-row pb-backrow">
      {legends}
      <GigArea p={p} ctx={ctx} />
      <Piles p={p} ctx={ctx} byLegends={eddiesByLegends} />
    </div>
  );
  // --n: how many card widths the field needs (a spent card lies sideways and takes a bit more); the full board
  // shrinks field cards to fit rather than wrapping them onto a second row
  const slots = P.field.reduce((n, u) => n + (g.s.cards[u]?.spent ? 1.25 : 1), 0);
  const field = (
    <div className={`pb-zone pb-field ${me && ctx.drag?.over?.kind === 'play' ? 'pb-drop-over' : ''}`} data-drop={me ? 'play' : undefined} style={{ ['--n' as any]: Math.max(slots, 1) }}>
      <div className="pb-label">{ctx.seatLabels ? `${ctx.seatLabels[p]} — field` : me ? 'Your field' : 'Rival field'}</div>
      <div className="pb-cards">
        {P.field.map((u) => (
          <BoardCard key={u} uid={u} size={size} ctx={ctx} />
        ))}
        {!P.field.length && <div className="pb-field-empty">no units</div>}
      </div>
    </div>
  );
  return (
    <section className={`pb-side ${me ? 'pb-me' : 'pb-rival'} ${active ? 'pb-active' : ''}`}>
      {/* the light that travels round the active side's edge (shown only with ambient motion, board.css) */}
      {active && <span className="pb-side-light" aria-hidden="true" />}
      <div className="pb-side-name">
        <span className="pb-who">{ctx.seatLabels ? ctx.seatLabels[p] : me ? 'You' : (ctx.rivalName ?? 'Rival bot')}</span>
        {!ctx.seatLabels && <span className="muted small">{P.name}</span>}
        {/* the full board shows the rival's hand size here instead of a row of card backs (hidden on other layouts) */}
        {!me && <RivalHandCount n={P.hand.length} owner={rivalHandOwner(ctx)} backs className="pb-name-hand" />}
        {active && <span className="pb-active-tag">{me ? 'your turn' : 'their turn'}</span>}
      </div>
      {me ? (
        <>
          {field}
          {backRow}
        </>
      ) : (
        <>
          <RivalHand ctx={ctx} />
          {backRow}
          {field}
        </>
      )}
    </section>
  );
}
