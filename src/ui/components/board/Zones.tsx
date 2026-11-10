// Playmat zones: Gig area (dice), piles (deck / trash / Eddies), hands, and a full player side.
import type { PlayerId } from '../../../engine/types';
import { Die } from '../Dice';
import { CardBack, TcgCard } from '../TcgCard';
import { BoardCard, type BoardCtx } from './BoardCard';

export function GigArea({ p, ctx }: { p: PlayerId; ctx: BoardCtx }) {
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
      role={target ? 'button' : undefined}
      title={target ? 'Attack the Gig area' : undefined}
    >
      <div className="pb-gigs-head">
        <span className="pb-label">Gigs</span>
        <b className={gigs.length >= 6 ? 'pb-gigs-hot' : ''}>{gigs.length}/7</b>
        <span className="pb-cred" title="Street Cred (sum of your Gig values)">
          ☆ {cred ?? '–'}
        </span>
        {coachArea && <span className="chip pb-chip-coach">Coach</span>}
      </div>
      <div className="pb-dice">
        {gigs.map((x) => {
          const pick = ix.gigDirect.get(x.id);
          return (
            <span key={x.id} className="pb-die">
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

export function Piles({ p, ctx }: { p: PlayerId; ctx: BoardCtx }) {
  const { g } = ctx;
  const P = g.P(p);
  const top = P.trash[P.trash.length - 1];
  const ready = P.eddies.filter((u) => g.s.cards[u] && !g.s.cards[u].spent).length;
  const total = P.eddies.length;
  return (
    <div className="pb-piles">
      <div
        className={`pb-pile ${p === 0 ? 'pb-sell-zone' : ''} ${p === 0 && ctx.drag?.over?.kind === 'sell' ? 'pb-drop-over' : ''}`}
        data-drop={p === 0 ? 'sell' : undefined}
        title={p === 0 ? `Eddies: ${ready} ready of ${total}. Drag a card here to sell it.` : `Eddies: ${ready} ready of ${total}`}
      >
        <div className={`pb-stack ${total ? '' : 'pb-empty'}`} style={{ ['--n' as any]: Math.min(total, 5) }}>
          {total ? <CardBack size="xs" label="€$" /> : <div className="pb-empty-slot">€$</div>}
        </div>
        <div className="pb-pile-cap">
          €$ <b>{ready}</b>/{total}
        </div>
        <div className="pb-pips">
          {P.eddies.slice(0, 12).map((u) => (
            <i key={u} className={g.s.cards[u]?.spent ? 'off' : 'on'} />
          ))}
        </div>
      </div>
      <div className="pb-pile" title={`Deck: ${P.deck.length} cards`}>
        <div className={`pb-stack ${P.deck.length ? '' : 'pb-empty'}`} style={{ ['--n' as any]: Math.min(P.deck.length, 5) }}>
          {P.deck.length ? <CardBack size="xs" /> : <div className="pb-empty-slot">deck</div>}
        </div>
        <div className="pb-pile-cap">
          Deck <b>{P.deck.length}</b>
        </div>
      </div>
      <div className="pb-pile pb-trash" title="Open the trash">
        <div className="pb-stack" onClick={() => ctx.openTrash(p)} role="button">
          {top !== undefined && g.s.cards[top] ? (
            <TcgCard def={g.def(top)} size="xs" noZoom onClick={() => ctx.openTrash(p)} />
          ) : (
            <div className="pb-empty-slot">trash</div>
          )}
        </div>
        <div className="pb-pile-cap">
          Trash <b>{P.trash.length}</b>
        </div>
      </div>
    </div>
  );
}

export function RivalHand({ ctx }: { ctx: BoardCtx }) {
  const n = ctx.g.P(1).hand.length;
  return (
    <div className="pb-rival-hand" title={`Rival hand: ${n} cards`}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="pb-rival-hand-card">
          <CardBack size="xs" />
        </div>
      ))}
      <span className="pb-hand-count">{n} in hand</span>
    </div>
  );
}

export function MyHand({ ctx }: { ctx: BoardCtx }) {
  const hand = ctx.handOrder ?? ctx.g.P(0).hand;
  const n = hand.length;
  const size = ctx.narrow ? 'sm' : 'md';
  return (
    <div className={`pb-hand ${ctx.narrow ? 'pb-hand-scroll' : ''}`}>
      {hand.map((u, k) => {
        const off = k - (n - 1) / 2;
        return (
          <div key={u} className="pb-fan" style={{ ['--rot' as any]: `${ctx.narrow ? 0 : off * 2.2}deg`, ['--dy' as any]: `${ctx.narrow ? 0 : Math.abs(off) * Math.abs(off) * 1.4}px` }}>
            <BoardCard uid={u} size={size} ctx={ctx} />
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
  const legends = (
    <div className="pb-zone pb-legends">
      <div className="pb-label">Legends</div>
      <div className="pb-cards">
        {P.legends.map((u) => (
          <BoardCard key={u} uid={u} size={size} ctx={ctx} />
        ))}
      </div>
    </div>
  );
  const backRow = (
    <div className="pb-row pb-backrow">
      {legends}
      <GigArea p={p} ctx={ctx} />
      <Piles p={p} ctx={ctx} />
    </div>
  );
  const field = (
    <div className={`pb-zone pb-field ${me && ctx.drag?.over?.kind === 'play' ? 'pb-drop-over' : ''}`} data-drop={me ? 'play' : undefined}>
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
      <div className="pb-side-name">
        <span className="pb-who">{ctx.seatLabels ? ctx.seatLabels[p] : me ? 'You' : 'Rival bot'}</span>
        {!ctx.seatLabels && <span className="muted small">{P.name}</span>}
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
