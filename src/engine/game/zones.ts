// Zones and card movement: moving cards between zones (Legend and Gear rules), drawing, discarding, selling,
// spending and readying, equipping, defeat.
import { other } from './common';
import type { Game } from '../engine';
import { shuffleInPlace } from '../rng';
import { noteTurnEvent } from './history';
import type { CardInst, DefeatInfo, EventMap, PlayerId, Zone } from '../types';

export function zoneList(game: Game, p: PlayerId, z: Zone): number[] | null {
  const ps = game.P(p);
  switch (z) {
    case 'deck':
      return ps.deck;
    case 'hand':
      return ps.hand;
    case 'field':
      return ps.field;
    case 'legends':
      return ps.legends;
    case 'eddies':
      return ps.eddies;
    case 'trash':
      return ps.trash;
    case 'removed':
      return ps.removed;
    default:
      return null;
  }
}

export function detach(game: Game, uid: number) {
  const c = game.s.cards[uid];
  const list = game.zoneList(c.zone === 'field' || c.zone === 'legends' || c.zone === 'eddies' ? c.controller : c.owner, c.zone);
  if (list) {
    const i = list.indexOf(uid);
    if (i >= 0) list.splice(i, 1);
    else {
      // fall back: search both players
      for (const p of [0, 1] as PlayerId[]) {
        const l = game.zoneList(p, c.zone);
        const j = l ? l.indexOf(uid) : -1;
        if (l && j >= 0) l.splice(j, 1);
      }
    }
  }
  if (c.host !== null) {
    const h = game.s.cards[c.host];
    if (h) h.gear = h.gear.filter((g) => g !== uid);
    c.host = null;
  }
}

/**
 * Move a card to a zone of its owner (or controller for field). Handles Legend invalid zones and gear.
 * position: 'top' | 'bottom' for deck.
 */
export function move(game: Game, uid: number, to: Zone, opts: { position?: 'top' | 'bottom'; controller?: PlayerId; faceUp?: boolean } = {}) {
  const c = game.s.cards[uid];
  const from = c.zone;
  const leavingPlay = (from === 'field' || from === 'legends') && to !== from;
  const gear = leavingPlay ? [...c.gear] : [];
  detach(game, uid);
  if (leavingPlay) {
    c.gear = [];
    game.s.mods = game.s.mods.filter((m) => m.target !== uid);
  }
  let dest = to;
  // A Legend sent anywhere but the Legends area or the field is removed from the game (4.4.1); that covers a Legend
  // played to the field by paying its cost (4.5) wherever it goes. One that went solo is removed whenever it leaves
  // the field (11.29.1), even to the Legends area.
  if (game.isLegend(c) && ((to !== 'legends' && to !== 'field') || (c.goSolo && from === 'field' && to !== 'field'))) dest = 'removed';
  c.zone = dest;
  c.spent = false;
  c.lag = false;
  c.enteredTurn = game.s.turn;
  if (dest !== 'field') c.goSolo = false;
  const owner = c.owner;
  if (dest === 'field' || dest === 'eddies') c.controller = opts.controller ?? c.controller;
  else c.controller = owner;
  c.faceUp = opts.faceUp ?? (dest !== 'deck' && dest !== 'hand' && dest !== 'eddies');
  const list = game.zoneList(dest === 'field' || dest === 'eddies' ? c.controller : owner, dest)!;
  if (dest === 'deck') {
    if (opts.position === 'top') list.unshift(uid);
    else list.push(uid);
  } else list.push(uid);
  // Gear follows its Unit or Legend to the area it was sent to, unequipped (4.12, 4.12.1). A Legend sent to the trash
  // is removed from the game but its Gear stays in the trash (4.12.2); a Unit removed from the game takes its Gear along.
  for (const gu of gear) {
    const gz: Zone = to === 'field' || to === 'legends' ? 'trash' : to;
    game.move(gu, gz, { position: opts.position });
  }
  // An equipped Unit bottom-decked: the cards go to the bottom in a random order (4.12.3).
  if (gear.length && dest === 'deck' && opts.position !== 'top') {
    const group = new Set([uid, ...gear]);
    for (const p of [0, 1] as PlayerId[]) {
      const deck = game.P(p).deck;
      const mine = deck.filter((u) => group.has(u));
      if (mine.length < 2) continue;
      const rest = deck.filter((u) => !group.has(u));
      shuffleInPlace(game.s, mine);
      deck.splice(0, deck.length, ...rest, ...mine);
    }
  }
}

export function drawRaw(game: Game, p: PlayerId): number | null {
  const ps = game.P(p);
  const uid = ps.deck.shift();
  if (uid === undefined) return null;
  const c = game.s.cards[uid];
  c.zone = 'hand';
  c.faceUp = false;
  ps.hand.push(uid);
  return uid;
}

export async function draw(game: Game, p: PlayerId, n: number): Promise<number[]> {
  const got: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = game.drawRaw(p);
    if (u === null) {
      game.endGame(other(p), `${game.P(p).name} had to draw from an empty deck`);
    }
    got.push(u!);
  }
  if (n > 0) game.log(p, `draws ${n}`);
  if (game.s.trace) for (const u of got) game.tr('draw', p, game.s.cards[u].defId);
  return got;
}

/** "Trash X": reveal top card of deck and put it in the trash. Returns uids trashed. */
export function mill(game: Game, p: PlayerId, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = game.P(p).deck[0];
    if (u === undefined) break;
    game.move(u, 'trash');
    out.push(u);
  }
  if (out.length) game.log(p, `trashes ${out.map((u) => game.name(u)).join(', ')}`);
  return out;
}

/** Player discards n cards of their choice from hand. Returns discarded uids. */
export async function discard(game: Game, p: PlayerId, n: number, filter?: (c: CardInst) => boolean, optional = false, prompt?: string): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const cands = game.P(p).hand.filter((u) => !filter || filter(game.s.cards[u]));
    if (!cands.length) break;
    const pick = await game.chooseCard(p, cands, prompt ?? `Discard a card (${i + 1}/${n})`, optional, 'discard');
    if (pick === null) break;
    game.move(pick, 'trash');
    out.push(pick);
    game.log(p, `discards ${game.name(pick)}`);
  }
  return out;
}

export function sell(game: Game, p: PlayerId, uid: number) {
  game.tr('sell', p, game.s.cards[uid].defId);
  game.move(uid, 'eddies', { controller: p, faceUp: false });
  game.s.stats.sold[p]++;
  game.log(p, `sells ${game.name(uid)} for an Eddie`);
}

export function spend(game: Game, uid: number, cause: EventMap['spent']['cause'] = 'effect') {
  const c = game.s.cards[uid];
  if (c.spent) return false;
  c.spent = true;
  game.emit('spent', { uid, cause });
  return true;
}

export function ready(game: Game, uid: number) {
  const c = game.s.cards[uid];
  if (!c.spent) return false;
  if (game.hasMod('cantReady', uid)) return false;
  c.spent = false;
  return true;
}

export function bottomDeck(game: Game, uid: number) {
  const c = game.s.cards[uid];
  game.log(c.owner, `bottom-decks ${game.name(uid)}`);
  game.move(uid, 'deck', { position: 'bottom' });
}

export function returnToHand(game: Game, uid: number) {
  game.log(game.s.cards[uid].owner, `returns ${game.name(uid)} to hand`);
  game.move(uid, 'hand');
}

/** Put a card into play as a Unit for player p (already paid). */
export function enterField(game: Game, p: PlayerId, uid: number, opts: { spent?: boolean } = {}) {
  game.move(uid, 'field', { controller: p });
  const c = game.s.cards[uid];
  c.lag = true;
  c.spent = !!opts.spent;
  c.enteredTurn = game.s.turn;
}

export function equip(game: Game, gearUid: number, hostUid: number) {
  const g = game.s.cards[gearUid];
  const h = game.s.cards[hostUid];
  detach(game, gearUid);
  g.zone = h.zone;
  g.controller = h.controller;
  g.host = hostUid;
  g.faceUp = true;
  g.spent = false;
  h.gear.push(gearUid);
}

/** Defeat a Unit (or Legend on field / face-up legend). Returns true if it was defeated. */
export async function defeat(game: Game, uid: number, opts: { inFight?: boolean; by?: number | null } = {}): Promise<boolean> {
  const c = game.s.cards[uid];
  if (!c || (c.zone !== 'field' && c.zone !== 'legends')) return false;
  const inFight = !!opts.inFight;
  if (inFight && game.hasMod('noFightDefeat', uid)) {
    game.log(c.controller, `${game.name(uid)} can't be defeated in a fight`);
    return false;
  }
  // replacement effects: mandatory ones (e.g. Deadman Transmitter) before optional ones (e.g. Jackie Welles) (10.28)
  const zoneBefore = c.zone;
  const repl = game.sources(c.controller).filter((src) => game.script(src.self).replaceDefeat);
  const ordered = [...repl.filter((x) => !game.script(x.self).optionalReplacement), ...repl.filter((x) => game.script(x.self).optionalReplacement)];
  for (const src of ordered) {
    const fn = game.script(src.self).replaceDefeat!;
    if (await fn(game, src.self, src.host, c, inFight)) return false;
    if (c.zone !== zoneBefore) return false; // moved by something else
  }
  const info: DefeatInfo = {
    uid,
    defId: c.defId,
    controller: c.controller,
    owner: c.owner,
    gear: [...c.gear],
    wasEquipped: c.gear.length > 0,
    inFight,
    by: opts.by ?? null,
    power: game.power(c),
    tags: game.def(c).tags,
    goSolo: c.goSolo,
  };
  info.seq = noteTurnEvent(game, { k: 'defeat', p: c.controller, uid, defId: c.defId });
  const gearScripts = c.gear.map((g) => game.s.cards[g]);
  game.log(c.controller, `${game.name(uid)} is defeated`);
  game.move(uid, 'trash');
  game.s.stats.unitsDefeated[other(c.controller)]++;
  game.tr('defeated', c.controller, c.defId, inFight ? 'fight' : 'effect');
  const own = game.script(c).defeated;
  if (own)
    game.enqueue(info.controller, `${game.name(uid)} {Defeated}`, () => own(game, c, info), {
      source: uid,
      probe: (cg) => own(cg, cg.c(uid), structuredClone(info)),
    });
  for (const gc of gearScripts) {
    const fn = game.script(gc).defeated;
    if (fn)
      game.enqueue(info.controller, `${game.name(gc)} {Defeated}`, () => fn(game, gc, info), {
        source: gc.uid,
        probe: (cg) => fn(cg, cg.c(gc.uid), structuredClone(info)),
      });
  }
  game.emit('unitDefeated', info);
  return true;
}

/** Defeat a Gear (e.g. Detonate). */
export function defeatGear(game: Game, uid: number) {
  const g = game.s.cards[uid];
  game.log(g.controller, `${game.name(uid)} (Gear) is defeated`);
  game.move(uid, 'trash');
}
