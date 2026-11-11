// A card on the playmat: real art via TcgCard (or a card back when hidden), wired to the pending decision.
import { useRef } from 'react';
import type { Game } from '../../../engine/engine';
import type { Decision, PlayerId } from '../../../engine/types';
import { CardBack, TcgCard, type CardSize } from '../TcgCard';
import type { AttackOpt, CoachMark, Interaction } from './interaction';
import type { DragApi, DropTarget } from './drag';

export interface Targeting {
  attacker: number;
  targets: AttackOpt[];
}

export interface BoardCtx {
  g: Game;
  pend: Decision | null;
  ix: Interaction;
  coach: CoachMark | null;
  targeting: Targeting | null;
  narrow: boolean;
  menuUid: number | null;
  answer: (i: number) => void;
  openMenu: (uid: number, el: HTMLElement) => void;
  startTargeting: (attacker: number) => void;
  cancelTargeting: () => void;
  openTrash: (p: PlayerId) => void;
  /** drag-to-act (Play page only) */
  drag?: DragApi;
  /** hand display order (uids), after sorting */
  handOrder?: number[];
  /** seat labels for spectating (default: You / Rival bot) */
  seatLabels?: [string, string];
}

const dropMatches = (over: DropTarget | null, uid: number) => !!over && (over.kind === 'unit' || over.kind === 'hand') && over.uid === uid;

/** Is this card's face hidden from the human? */
export function hiddenFromMe(g: Game, uid: number): boolean {
  const c = g.s.cards[uid];
  if (!c) return true;
  if (c.zone === 'legends') return !c.faceUp && !(c.controller === 0 && c.known);
  return false;
}

export function cardChips(g: Game, uid: number, coach: boolean, extra?: React.ReactNode) {
  const c = g.s.cards[uid];
  if (!c) return null;
  const inPlay = c.zone === 'field' || c.zone === 'legends';
  const chips: React.ReactNode[] = [];
  if (coach) chips.push(<span key="coach" className="chip pb-chip-coach">Coach</span>);
  if (c.zone === 'legends' && !c.faceUp) chips.push(<span key="fd" className="chip">face-down</span>);
  if (inPlay) {
    if (c.lag && c.zone === 'field') chips.push(<span key="lag" className="chip warn">lag</span>);
    if (c.goSolo) chips.push(<span key="solo" className="chip">solo</span>);
    try {
      if (c.zone === 'field' && g.hasKw(c, 'blocker')) chips.push(<span key="blk" className="chip">blocker</span>);
    } catch {
      /* ignore */
    }
    const seen = new Set<string>();
    for (const m of g.s.mods) {
      if (m.target !== uid || m.kind === 'power' || seen.has(m.kind)) continue;
      seen.add(m.kind);
      chips.push(
        <span key={`m${m.id}`} className="chip">
          {m.kind === 'keyword' ? String(m.value ?? 'kw') : m.kind}
        </span>,
      );
    }
  }
  if (extra) chips.push(extra);
  return chips.length ? <>{chips}</> : null;
}

export function BoardCard({ uid, size, ctx, faceDown }: { uid: number; size: CardSize; ctx: BoardCtx; faceDown?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { g, ix, targeting, coach } = ctx;
  const c = g.s.cards[uid];
  if (!c) return null;
  const hidden = faceDown ?? (c.zone === 'legends' && !c.faceUp && !(c.controller === 0 && c.known));

  let onClick: (() => void) | undefined;
  let targetable = false;
  let can = false;
  const menu = ix.menus.get(uid);
  if (targeting) {
    const t = targeting.targets.find((x) => x.unit === uid);
    if (t) {
      targetable = true;
      onClick = () => ctx.answer(t.i);
    } else if (uid === targeting.attacker) onClick = ctx.cancelTargeting;
  } else if (menu?.length) {
    can = true;
    const isBlock = menu.some((m) => m.kind === 'block');
    targetable = ctx.pend?.kind === 'reaction' && isBlock;
    onClick = () => {
      if (menu.length === 1 && menu[0].kind === 'block') ctx.answer(menu[0].i);
      else if (ref.current) ctx.openMenu(uid, ref.current);
    };
  } else {
    const d = ix.direct.get(uid);
    if (d !== undefined) {
      targetable = true;
      onClick = () => ctx.answer(d);
    }
  }

  // drag: my hand cards (to play, sell or reorder), my face-up Legends that can go to the field, and my units that can attack
  const legendToField = c.zone === 'legends' && c.controller === 0 && !!menu?.some((m) => m.kind === 'goSolo' || m.kind === 'playLegend');
  const draggable = !!ctx.drag && !hidden && ((c.zone === 'hand' && c.owner === 0) || legendToField || (c.zone === 'field' && c.controller === 0 && (ix.attacks.get(uid)?.length ?? 0) > 0));
  if (onClick && ctx.drag) {
    const inner = onClick;
    onClick = () => {
      if (!ctx.drag!.consumeClick()) inner();
    };
  }
  const isCoach = !!coach && coach.uids.has(uid) && (!targeting || coach.attacker === targeting.attacker);
  const att = g.s.attack;
  const attacking = !!att && att.attacker === uid;
  const attacked = !!att && att.targetUnit === uid;
  const isAttacker = targeting?.attacker === uid;

  const cls = [
    'pb-slot',
    c.spent ? 'is-spent' : '',
    can ? 'pb-can' : '',
    attacking ? 'pb-attacking' : '',
    attacked ? 'pb-attacked' : '',
    isAttacker ? 'pb-aiming' : '',
    ctx.menuUid === uid ? 'pb-menu-host' : '',
    c.zone === 'field' || c.zone === 'legends' ? 'pb-inplay' : '',
    draggable ? 'pb-draggable' : '',
    ctx.drag?.dragging === uid ? 'pb-drag-src' : '',
    ctx.drag && dropMatches(ctx.drag.over, uid) ? 'pb-drop-over' : '',
  ].join(' ');

  let power: number | undefined;
  const def = g.def(uid);
  if (!hidden && (c.zone === 'field' || (c.zone === 'legends' && def.power !== null))) {
    try {
      power = g.power(c);
    } catch {
      power = undefined;
    }
  }

  return (
    <div ref={ref} className={cls} data-uid={uid} onPointerDown={draggable ? (e) => ctx.drag!.start(uid, e) : undefined}>
      {hidden ? (
        <CardBack size={size} label={c.zone === 'legends' ? 'Legend' : undefined} spent={c.spent} onClick={onClick} targetable={targetable} />
      ) : (
        <TcgCard
          def={def}
          size={size}
          power={power}
          spent={c.spent}
          selected={isCoach || isAttacker}
          targetable={targetable}
          dim={c.zone === 'legends' && !c.faceUp}
          onClick={onClick}
          badges={cardChips(g, uid, isCoach)}
        />
      )}
      {hidden && isCoach && <span className="chip pb-chip-coach pb-float-chip">Coach</span>}
      {c.gear.length > 0 && (
        <div className="pb-gear">
          {c.gear.map((gu) => {
            const gd = g.s.cards[gu];
            return gd ? <TcgCard key={gu} def={g.def(gu)} size="xs" title={`Gear: ${g.def(gu).displayName}`} /> : null;
          })}
        </div>
      )}
    </div>
  );
}
