// Main-phase actions: which are legal, how they read, and performing them (sell, Call, play, Go Solo, abilities).
import type { Game } from '../engine';
import { noteTurnEvent } from './history';
import { detach, enterField } from './zones';
import type { Ability, Action, CardInst, LegendPlay, PlayerId, Reaction, Zone } from '../types';

export function canSell(game: Game, p: PlayerId): boolean {
  return !game.usedThisTurn(`sell:${p}`);
}

export function canCall(game: Game, p: PlayerId): boolean {
  return !game.usedThisTurn(`call:${p}`) && game.faceDownLegends(p).length > 0;
}

/** Host candidates for a gear. */
export function gearHosts(game: Game, p: PlayerId): CardInst[] {
  const ps = game.P(p);
  const units = ps.field.map((u) => game.s.cards[u]);
  const legs = ps.legends.map((u) => game.s.cards[u]).filter((c) => c.faceUp);
  return [...units, ...legs];
}

export function canPlayCard(game: Game, p: PlayerId, uid: number, free = false): boolean {
  const c = game.s.cards[uid];
  const d = game.def(c);
  const sc = game.script(c);
  if (d.type === 'Legend') return false;
  if (d.type === 'Gear' && game.gearHosts(p).length === 0) return false;
  if (sc.canPlay && !sc.canPlay(game, c, p)) return false;
  if (!free && game.playCost(uid, p) > game.available(p)) return false;
  return true;
}

export function abilityUsable(game: Game, p: PlayerId, self: CardInst, host: CardInst, a: Ability, asReaction: boolean): boolean {
  if (asReaction && !a.quick) return false;
  if (host.controller !== p) return false;
  if (host.zone === 'legends' && !host.faceUp) return false;
  if (a.spend) {
    if (host.spent) return false;
    if (host.zone === 'field' && host.lag) return false;
  }
  let cost = a.eddies ?? 0;
  // if host is a ready legend in legends area and the ability spends it, it can't also pay
  const avail = game.payables(p).filter((c) => !(a.spend && c.uid === host.uid)).length;
  if (cost > avail) return false;
  if (a.discard && game.P(p).hand.length < a.discard) return false;
  if (a.can && !a.can(game, self, host)) return false;
  return true;
}

export function listAbilities(game: Game, p: PlayerId, asReaction: boolean): { self: CardInst; host: CardInst; index: number; a: Ability }[] {
  const out: { self: CardInst; host: CardInst; index: number; a: Ability }[] = [];
  for (const src of game.sources(p)) {
    const abs = game.script(src.self).abilities ?? [];
    abs.forEach((a, index) => {
      if (game.abilityUsable(p, src.self, src.host, a, asReaction)) out.push({ self: src.self, host: src.host, index, a });
    });
  }
  return out;
}

export function legalActions(game: Game, p: PlayerId): Action[] {
  const out: Action[] = [{ type: 'pass' }];
  const ps = game.P(p);
  if (game.canSell(p)) {
    for (const u of ps.hand) if (game.def(u).sellable) out.push({ type: 'sell', uid: u });
  }
  if (game.canCall(p) && game.available(p) >= game.callCost(p)) {
    for (const c of game.faceDownLegends(p)) out.push({ type: 'call', uid: c.uid });
  }
  for (const u of ps.hand) if (game.canPlayCard(p, u)) out.push({ type: 'play', uid: u });
  // Face-up Legends with a cost: Go Solo (11.29) if they have it, and the ordinary play by paying the cost (4.5; a
  // null cost can't be played, 4.5.3). The Legend itself may help pay either (it is still in the Legends area while
  // the cost is paid; general FAQ #10 for Go Solo).
  for (const u of ps.legends) {
    const c = game.s.cards[u];
    if (!c.faceUp || game.def(c).cost === null) continue;
    if (game.hasKw(c, 'goSolo') && game.playCost(u, p, 'goSolo') <= game.available(p)) out.push({ type: 'goSolo', uid: u });
    if (game.playCost(u, p) <= game.available(p)) out.push({ type: 'playLegend', uid: u });
  }
  for (const ab of game.listAbilities(p, false)) out.push({ type: 'activate', uid: ab.self.uid, host: ab.host.uid, index: ab.index });
  let forced = false;
  for (const c of game.units(p)) {
    const ts = game.attackTargets(c);
    if (ts.length && game.hasMod('mustAttack', c.uid)) forced = true;
    for (const t of ts) out.push({ type: 'attack', uid: c.uid, targetUnit: t.unit, targetGigs: t.gigs });
  }
  // "must attack next turn if it can": you can't pass while such a Unit can still attack
  if (forced) return out.filter((x) => x.type !== 'pass');
  return out;
}

export function describeAction(game: Game, a: Action | Reaction): string {
  switch (a.type) {
    case 'pass':
      return 'Pass turn';
    case 'endReact':
      return 'No (more) reactions';
    case 'sell':
      return `Sell ${game.name(a.uid)}`;
    case 'call':
      return `Call a Legend (${game.c(a.uid).known ? game.name(a.uid) : `face-down slot ${game.P(game.c(a.uid).controller).legends.indexOf(a.uid) + 1}`})`;
    case 'play':
      return `Play ${game.name(a.uid)} (${game.playCost(a.uid, game.c(a.uid).owner)} €$)`;
    case 'goSolo':
      return `Go Solo: ${game.name(a.uid)} (${game.playCost(a.uid, game.c(a.uid).controller, 'goSolo')} €$)`;
    case 'playLegend':
      return `Play ${game.name(a.uid)} to the field (${game.playCost(a.uid, game.c(a.uid).controller)} €$, with Lag)`;
    case 'activate': {
      const ab = game.script(a.uid).abilities![a.index];
      return `${game.name(a.host)}${a.host !== a.uid ? ` [${game.name(a.uid)}]` : ''}: ${ab.label}`;
    }
    case 'block':
      return `Block with ${game.name(a.uid)}`;
    case 'attack':
      return `Attack with ${game.name(a.uid)} (${game.power(a.uid)}) → ${a.targetUnit ? game.name(a.targetUnit) + ` (${game.power(a.targetUnit)})` : 'Gig area'}`;
  }
}

export function programsPlayedThisTurn(game: Game, p: PlayerId): number {
  return game.turnCount('play', (e) => e.p === p && e.type === 'Program');
}

export async function doAction(game: Game, p: PlayerId, a: Action) {
  switch (a.type) {
    case 'pass':
      return;
    case 'sell':
      game.s.once[`sell:${p}`] = game.s.turn;
      game.sell(p, a.uid);
      return;
    case 'call':
      if (!(await game.pay(p, game.callCost(p), [], `Call ${game.name(a.uid)}`))) return;
      await game.callLegend(p, a.uid);
      return;
    case 'play':
      await game.playFromHand(p, a.uid);
      return;
    case 'goSolo':
      await game.goSolo(p, a.uid);
      return;
    case 'playLegend':
      await game.playLegend(p, a.uid);
      return;
    case 'activate':
      await game.activate(p, a.uid, a.host, a.index);
      return;
    case 'attack':
      await game.attack(p, a.uid, { unit: a.targetUnit, gigs: a.targetGigs });
      return;
  }
}

/** Call a Legend (flip face-up). Respects once-per-turn. free = effect-granted. */
export async function callLegend(game: Game, p: PlayerId, uid?: number, opts: { free?: boolean; filter?: (c: CardInst) => boolean } = {}): Promise<boolean> {
  if (!game.canCall(p)) return false;
  let target: number | null | undefined = uid;
  if (target === undefined) {
    const cands = game.faceDownLegends(p).filter((c) => !opts.filter || opts.filter(c));
    const pick = await game.chooseUnit(p, cands, 'Call which Legend?', { optional: true, tag: 'call' });
    if (!pick) return false;
    target = pick.uid;
  }
  const c = game.s.cards[target];
  if (c.faceUp) return false;
  game.s.once[`call:${p}`] = game.s.turn;
  c.faceUp = true;
  game.s.stats.calls[p]++;
  game.tr('call', p, c.defId, opts.free ? 'free' : game.s.phase === 'main' && game.s.active === p ? 'main' : 'react');
  game.log(p, `calls ${game.name(c)}${opts.free ? ' (free)' : ''}`);
  const fn = game.script(c).call;
  if (fn) game.enqueue(p, `${game.name(c)} {Call}`, () => fn(game, c), { source: c.uid, probe: (cg) => fn(cg, cg.c(c.uid)) });
  game.emit('legendCalled', { uid: c.uid, player: p });
  return true;
}

export async function playFromHand(game: Game, p: PlayerId, uid: number) {
  const cost = game.playCost(uid, p);
  if (!(await game.pay(p, cost, [], `Play ${game.name(uid)}`))) return;
  await resolvePlay(game, p, uid, 'hand');
}

/** Play a card for free (or already paid) from any zone. */
export async function playFree(game: Game, p: PlayerId, uid: number, from: Zone, opts: { bottomDeckAfter?: boolean; hostFilter?: (c: CardInst) => boolean } = {}) {
  if (!game.canPlayCard(p, uid, true)) return false;
  game.log(p, `plays ${game.name(uid)} for free from ${from}`);
  await resolvePlay(game, p, uid, from, opts);
  return true;
}

export async function resolvePlay(game: Game, p: PlayerId, uid: number, from: Zone, opts: { bottomDeckAfter?: boolean; hostFilter?: (c: CardInst) => boolean } = {}) {
  const c = game.s.cards[uid];
  const d = game.def(c);
  const sc = game.script(c);
  game.s.stats.cardsPlayed[p]++;
  game.tr('play', p, c.defId, from);
  if (from === 'hand') game.log(p, `plays ${d.displayName}`);
  const seq = noteTurnEvent(game, { k: 'play', p, uid, defId: c.defId, type: d.type });
  if (d.type === 'Unit') {
    enterField(game, p, uid);
    game.emit('cardPlayed', { uid, player: p, type: 'Unit', seq });
    if (sc.play) game.enqueue(p, `${d.displayName} {Play}`, () => sc.play!(game, c), { source: uid, probe: (cg) => sc.play!(cg, cg.c(uid)) });
  } else if (d.type === 'Gear') {
    const hosts = game.gearHosts(p).filter((h) => !opts.hostFilter || opts.hostFilter(h));
    const host = await game.chooseUnit(p, hosts, `Equip ${d.displayName} to?`, { intent: 'help', tag: 'equip', source: uid });
    if (!host) {
      game.move(uid, 'trash');
      return;
    }
    game.equip(uid, host.uid);
    game.log(p, `equips ${d.displayName} to ${game.name(host)}`);
    game.emit('cardPlayed', { uid, player: p, type: 'Gear', seq });
    if (sc.play) game.enqueue(p, `${d.displayName} (equipped)`, () => sc.play!(game, c), { source: uid, probe: (cg) => sc.play!(cg, cg.c(uid)) });
  } else if (d.type === 'Program') {
    detach(game, uid);
    c.zone = 'limbo';
    c.controller = p;
    game.emit('cardPlayed', { uid, player: p, type: 'Program', seq });
    if (sc.play) await sc.play(game, c);
    if (c.zone === 'limbo') {
      if (opts.bottomDeckAfter) game.move(uid, 'deck', { position: 'bottom' });
      else game.move(uid, 'trash');
    }
  }
}

/**
 * Go Solo (11.29.1): pay the Legend's Go Solo cost and play it as a ready Unit that can attack this turn.
 * The Legend may be spent as one of its own payment sources (general FAQ #10). Go Solo plays it "as a ready Unit", so
 * it enters ready even then (assumption: the card text's "ready" overrides 4.5.1's "same orientation"; the FAQ text
 * itself is not in the repo). Spending it costs nothing, so automatic payment spends it first.
 * Trigger order: its "when spent" triggers (e.g. Netwatch Netdriver on it) become pending while it pays, before it is
 * played, so they come before "when a card is played" triggers and its own {Play}; its controller may reorder them
 * (10.12) when they choose the order of their effects.
 */
export async function goSolo(game: Game, p: PlayerId, uid: number) {
  const cost = game.playCost(uid, p, 'goSolo');
  if (!(await game.pay(p, cost, [], `${game.name(uid)} goes solo`, { first: [uid] }))) return;
  legendToField(game, p, uid, 'goSolo');
}

/**
 * Play a face-up Legend from the Legends area to the field as a Unit by paying its cost, without Go Solo (4.5). It
 * enters in the orientation it had when it left the Legends area (4.5.1: spent if it helped pay its own cost, so
 * automatic payment spends it last) and with Lag (4.5.2). It is not a Go Solo Unit, so it gets no permission to attack
 * this turn; if it later goes anywhere but the Legends area or field it is removed from the game (4.4.1, see move()).
 */
export async function playLegend(game: Game, p: PlayerId, uid: number) {
  const cost = game.playCost(uid, p);
  if (!(await game.pay(p, cost, [], `Play ${game.name(uid)}`, { last: [uid] }))) return;
  legendToField(game, p, uid, 'legend');
}

/** Move a (paid-for) Legend from the Legends area to the field, keeping its Gear and effects, and fire its play. */
export function legendToField(game: Game, p: PlayerId, uid: number, via: LegendPlay) {
  const c = game.s.cards[uid];
  const gear = [...c.gear];
  detach(game, uid);
  c.zone = 'field';
  c.controller = p;
  if (via === 'goSolo') c.spent = false; // "as a ready Unit"; the ordinary play keeps c.spent as it was (4.5.1)
  c.lag = true;
  c.goSolo = via === 'goSolo';
  c.enteredTurn = game.s.turn;
  game.P(p).field.push(uid);
  for (const g of gear) game.s.cards[g].zone = 'field';
  c.gear = gear;
  game.s.stats.cardsPlayed[p]++;
  game.tr(via === 'goSolo' ? 'solo' : 'legend', p, c.defId);
  game.log(p, via === 'goSolo' ? `${game.name(c)} goes solo!` : `plays ${game.name(c)} to the field${c.spent ? ' (spent)' : ''}`);
  const seq = noteTurnEvent(game, { k: 'play', p, uid, defId: c.defId, type: 'Unit', via });
  game.emit('cardPlayed', { uid, player: p, type: 'Unit', seq, via });
  const fn = game.script(c).play;
  if (fn) game.enqueue(p, `${game.name(c)} {Play}`, () => fn(game, c), { source: uid, probe: (cg) => fn(cg, cg.c(uid)) });
}

export async function activate(game: Game, p: PlayerId, selfUid: number, hostUid: number, index: number, asReaction = false) {
  const self = game.s.cards[selfUid];
  const host = game.s.cards[hostUid];
  const a = game.script(self).abilities![index];
  if (!game.abilityUsable(p, self, host, a, asReaction)) return;
  // pay costs in order: eddies, spend, discard
  if (a.eddies && !(await game.pay(p, a.eddies, a.spend ? [host.uid] : [], `${game.name(host)}: ${a.label}`))) return;
  if (a.spend) {
    host.spent = true;
    game.emit('spent', { uid: host.uid, cause: 'ability' });
  }
  const discarded = a.discard ? await game.discard(p, a.discard) : [];
  game.log(p, `activates ${game.name(host)}: ${a.label}`);
  game.tr('activate', p, self.defId, index);
  await a.run(game, self, host, { discarded });
}
