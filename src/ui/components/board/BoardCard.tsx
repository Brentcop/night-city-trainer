// A card on the playmat: real art via TcgCard (or a card back when hidden), wired to the pending decision.
import { useRef } from 'react';
import type { Game } from '../../../engine/engine';
import type { Decision, PlayerId } from '../../../engine/types';
import { CardBack, TcgCard, type CardSize } from '../TcgCard';
import { MARK_TEXT, type CardMark, type CoachMark, type Interaction, type Marks, type Targeting } from './interaction';
import type { DragApi, DropTarget } from './drag';

export type { Targeting } from './interaction';

/** Icon per mark: the non-colour cue next to each mark's outline style. */
const MARK_ICON: Partial<Record<CardMark, string>> = { play: '▶', sell: '€$', attack: '⚔', ability: '✦', block: '⛨', target: '◎', aiming: '⚔' };

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
  /** which cards can be acted on now (Play page only; see boardMarks) */
  marks?: Marks;
  /**
   * Phones: show a card large enough to read (CardPeek). A tap on a card with nothing to do reads it, and a long press
   * reads any card without acting.
   */
  inspect?: (uid: number) => void;
  /**
   * "Choose before playing" (board settings): how many of your ready Eddies are selected to pay the next cost (your
   * first ones, as Eddies are interchangeable), and a tap on your €$ pile that selects one more.
   */
  eddiePick?: { selected: number; add: () => void };
}

/** How long a touch must stay put to read a card instead of tapping it (ms). */
const LONG_PRESS_MS = 450;

const dropMatches = (over: DropTarget | null, uid: number) => !!over && (over.kind === 'unit' || over.kind === 'hand') && over.uid === uid;

/** Is this card's face hidden from the human? */
export function hiddenFromMe(g: Game, uid: number): boolean {
  const c = g.s.cards[uid];
  if (!c) return true;
  if (c.zone === 'legends') return !c.faceUp && !(c.controller === 0 && c.known);
  return false;
}

function cardChips(g: Game, uid: number, coach: boolean, extra?: React.ReactNode) {
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
  // long press (touch): the timer, where it started, and whether it fired (then the tap that follows is swallowed)
  const press = useRef<{ t: ReturnType<typeof setTimeout> | null; x: number; y: number; fired: boolean }>({ t: null, x: 0, y: 0, fired: false });
  const { g, ix, targeting, coach } = ctx;
  const c = g.s.cards[uid];
  if (!c) return null;
  const hidden = faceDown ?? (c.zone === 'legends' && !c.faceUp && !(c.controller === 0 && c.known));

  let onClick: (() => void) | undefined;
  let targetable = false;
  const menu = ix.menus.get(uid);
  if (targeting) {
    const t = targeting.targets.find((x) => x.unit === uid);
    if (t) {
      targetable = true;
      onClick = () => ctx.answer(t.i);
    } else if (uid === targeting.attacker) onClick = ctx.cancelTargeting;
  } else if (menu?.length) {
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
  // phones: a card with nothing to do is read by tapping it (a hidden one can't be read)
  const inspect = ctx.inspect && !hidden ? ctx.inspect : undefined;
  if (!onClick && inspect && !(ctx.marks?.choosing ?? false)) onClick = () => inspect(uid);
  if (onClick && (ctx.drag || inspect)) {
    const inner = onClick;
    onClick = () => {
      if (press.current.fired) {
        press.current.fired = false;
        return;
      }
      if (!ctx.drag?.consumeClick()) inner();
    };
  }
  const endPress = () => {
    if (press.current.t) clearTimeout(press.current.t);
    press.current.t = null;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (draggable) ctx.drag!.start(uid, e);
    if (!inspect || e.pointerType === 'mouse') return;
    endPress();
    press.current = {
      x: e.clientX,
      y: e.clientY,
      fired: false,
      t: setTimeout(() => {
        press.current.t = null;
        press.current.fired = true;
        inspect(uid);
      }, LONG_PRESS_MS),
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (press.current.t && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) endPress();
  };
  const isCoach = !!coach && coach.uids.has(uid) && (!targeting || coach.attacker === targeting.attacker);
  const att = g.s.attack;
  const attacking = !!att && att.attacker === uid;
  const attacked = !!att && att.targetUnit === uid;
  const isAttacker = targeting?.attacker === uid;
  const mark = ctx.marks?.cards.get(uid);
  const icon = mark ? MARK_ICON[mark] : undefined;

  const cls = [
    'pb-slot',
    c.spent ? 'is-spent' : '',
    mark ? `pb-st-${mark}` : '',
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

  // the card's name plus what it can do now, for screen readers (the outline and icon show it on screen)
  const label = mark && mark !== 'dim' && onClick ? `${hidden ? 'Face-down Legend' : def.displayName}: ${MARK_TEXT[mark]}` : undefined;

  return (
    <div
      ref={ref}
      className={cls}
      data-uid={uid}
      onPointerDown={draggable || inspect ? onPointerDown : undefined}
      onPointerMove={inspect ? onPointerMove : undefined}
      onPointerUp={inspect ? endPress : undefined}
      onPointerCancel={inspect ? endPress : undefined}
      onContextMenu={inspect ? (e) => e.preventDefault() : undefined}
    >
      {hidden ? (
        <CardBack size={size} label={c.zone === 'legends' ? 'Legend' : undefined} spent={c.spent} onClick={onClick} targetable={targetable} ariaLabel={label} />
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
          ariaLabel={label}
        />
      )}
      {icon && (
        <span className="pb-st-badge" aria-hidden="true" title={MARK_TEXT[mark!]}>
          {icon}
        </span>
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
