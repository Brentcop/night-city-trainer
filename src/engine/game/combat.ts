// Attacks: targets and restrictions (one attackBanned check), the reaction window, fights, and steals (attack and
// effect steals share stealUpTo).
import { other } from './common';
import type { Game } from '../engine';
import { noteTurnEvent } from './history';
import type { AttackTargetRef, CardInst, Gig, Mod, PlayerId, Reaction } from '../types';

export function canAttackAtAll(game: Game, c: CardInst): boolean {
  if (c.zone !== 'field' || c.spent) return false;
  if (c.controller !== game.s.active) return false;
  if (game.hasMod('cantAttack', c.uid)) return false;
  return !attackBanned(game, c, null);
}

/** Does an attack restriction forbid `c` from attacking target `t` (null: from attacking at all)? (9.21.3) */
export function attackBanned(game: Game, c: CardInst, t: AttackTargetRef | null): boolean {
  for (const src of game.sources()) {
    const fn = game.script(src.self).attackBan;
    if (fn && fn(game, src.self, src.host, c, t)) return true;
  }
  return false;
}

/** Lag permission: what a lagging unit may attack ('any' | 'units' | 'gigs' | null). */
export function lagPermission(game: Game, c: CardInst): 'any' | 'units' | 'gigs' | null {
  if (!c.lag) return 'any';
  if (game.hasKw(c, 'adrenaline')) return 'any';
  if (c.goSolo) return 'any';
  const mods = game.modsFor('lagAttack', c.uid);
  if (mods.some((m) => m.value === 'any')) return 'any';
  const u = mods.some((m) => m.value === 'units');
  const gg = mods.some((m) => m.value === 'gigs');
  if (u && gg) return 'any';
  if (u) return 'units';
  if (gg) return 'gigs';
  return null;
}

export function attackTargets(game: Game, c: CardInst): AttackTargetRef[] {
  if (!game.canAttackAtAll(c)) return [];
  const perm = game.lagPermission(c);
  if (perm === null) return [];
  const p = c.controller;
  const r = other(p);
  const out: AttackTargetRef[] = [];
  const allowAll = (t: AttackTargetRef) => !attackBanned(game, c, t);
  if (perm === 'any' || perm === 'units') {
    for (const u of game.units(r)) {
      const t = { unit: u.uid, gigs: null };
      const ok = u.spent || mayAttackReady(game, c, t);
      if (ok && allowAll(t)) out.push(t);
    }
  }
  if ((perm === 'any' || perm === 'gigs') && game.P(r).gigs.length > 0) {
    const t = { unit: null, gigs: r };
    if (allowAll(t)) out.push(t);
  }
  return out;
}

/** May `c` attack this Unit target while it is ready (an "attack ready Units" permission or a card's attackAllow)? */
export function mayAttackReady(game: Game, c: CardInst, t: AttackTargetRef): boolean {
  if (game.hasMod('attackReady', c.uid)) return true;
  for (const src of game.sources()) {
    const fn = game.script(src.self).attackAllow;
    if (fn && fn(game, src.self, src.host, c, t)) return true;
  }
  return false;
}

export async function attack(game: Game, p: PlayerId, uid: number, target: AttackTargetRef) {
  const s = game.s;
  const att = s.cards[uid];
  s.attack = { attacker: uid, attackerPlayer: p, targetUnit: target.unit, targetGigs: target.gigs, step: 'declare', ended: false };
  // checked before one-shot permissions are used up below, so the attack they allowed stays valid (9.21.3)
  if (target.unit !== null && mayAttackReady(game, att, target)) s.attack.readyTargetOk = true;
  s.stats.attacks[p]++;
  game.tr('attack', p, att.defId, target.unit ? 'unit' : 'gigs');
  game.telemetry?.attackStart(game);
  att.spent = true;
  // one-shot attack permissions are used up. "Must attack ... if it can" stays for its whole duration: a Unit readied
  // after attacking must attack again if it can (Evelyn Parker: Beautiful Enigma FAQ).
  s.mods = s.mods.filter((m) => !(m.kind === 'attackReady' && m.value === 'once' && m.target === uid));
  game.log(p, `${game.name(att)} (${game.power(att)}) attacks ${target.unit ? game.name(target.unit) : 'the rival Gig area'}`);
  game.emit('spent', { uid, cause: 'attack' });
  // {Attack} triggers (unit and its gear)
  const atkFn = game.script(att).attack;
  if (atkFn) game.enqueue(p, `${game.name(att)} {Attack}`, () => atkFn(game, att, att), { source: uid, probe: (cg) => atkFn(cg, cg.c(uid), cg.c(uid)) });
  for (const gu of att.gear) {
    const g = s.cards[gu];
    const fn = game.script(g).attack;
    if (fn) game.enqueue(p, `${game.name(g)} (on ${game.name(att)}) {Attack}`, () => fn(game, g, att), { source: gu, probe: (cg) => fn(cg, cg.c(gu), cg.c(uid)) });
  }
  const seq = noteTurnEvent(game, { k: 'attack', p, uid, defId: att.defId });
  game.emit('attack', { attacker: uid, targetUnit: target.unit, targetGigs: target.gigs, seq });
  await game.resolvePending();
  await game.attackRest(uid);
}

/**
 * The rest of an attack after its {Attack} triggers: the rival's reaction window, then the fight or the steal,
 * then cleanup. Split out so a lookahead clone taken during a reaction can resume the attack.
 */
export async function attackRest(game: Game, uid: number, reactionsClosed = false) {
  const s = game.s;
  if (!s.attack) return;
  const att = s.cards[uid];
  const r = other(s.attack.attackerPlayer);
  let end: 'fizzled' | 'fight' | 'steal' = 'fizzled';
  try {
    if (!game.attackValid()) return;
    // ---- React step
    s.attack.step = 'react';
    let guard = reactionsClosed ? 30 : 0;
    while (guard++ < 30) {
      if (!game.attackValid()) return;
      const reacts = game.legalReactions(r);
      if (reacts.length <= 1) break;
      const [i] = await game.ask({
        player: r,
        kind: 'reaction',
        prompt: `${game.name(att)} (${game.power(att)}) is attacking ${s.attack.targetUnit ? game.name(s.attack.targetUnit) : 'your Gig area'} — react?`,
        options: reacts.map((x) => ({ label: game.describeAction(x), action: x })),
        min: 1,
        max: 1,
      });
      const rx = reacts[i];
      if (rx.type === 'endReact') break;
      await game.doReaction(r, rx);
      await game.resolvePending();
      game.update();
    }
    if (!game.attackValid()) return;
    if (s.attack.targetUnit !== null) {
      s.attack.step = 'fight';
      end = 'fight';
      await game.fight(uid, s.attack.targetUnit);
    } else {
      s.attack.step = 'steal';
      end = 'steal';
      await game.steal(uid, s.attack.targetGigs!);
    }
    await game.resolvePending();
  } finally {
    game.telemetry?.attackEnd(game, end);
    if (s.attack) s.attack.step = 'done';
    s.attack = null;
    s.mods = s.mods.filter((m) => m.until !== 'attackEnd');
  }
}

export function attackValid(game: Game): boolean {
  const a = game.s.attack;
  if (!a || a.ended) return false;
  const att = game.s.cards[a.attacker];
  if (att.zone !== 'field' || att.controller !== a.attackerPlayer) return false;
  if (a.targetUnit !== null) {
    const t = game.s.cards[a.targetUnit];
    if (t.zone !== 'field' || t.controller === a.attackerPlayer) return false;
    // a ready Unit is a valid target only with a permission to attack ready Units (9.21.3): one held when the attack
    // was declared (one-shot permissions are used up then) or one gained since. A Blocker is spent as it blocks.
    if (!t.spent && !a.readyTargetOk && !mayAttackReady(game, att, { unit: t.uid, gigs: null })) return false;
  }
  // The attack also ends if an attack restriction now forbids this target (9.21.3).
  const t: AttackTargetRef = { unit: a.targetUnit, gigs: a.targetUnit === null ? a.targetGigs : null };
  return !attackBanned(game, att, t);
}

export function legalReactions(game: Game, p: PlayerId): Reaction[] {
  const out: Reaction[] = [{ type: 'endReact' }];
  const a = game.s.attack!;
  if (game.canCall(p) && game.available(p) >= game.callCost(p)) for (const c of game.faceDownLegends(p)) out.push({ type: 'call', uid: c.uid });
  const att = game.s.cards[a.attacker];
  const unblockable = game.sources().some((src) => game.script(src.self).unblockable?.(game, src.self, src.host, att));
  if (!unblockable) {
    for (const c of game.units(p)) {
      if (!c.spent && c.uid !== a.targetUnit && game.hasKw(c, 'blocker')) out.push({ type: 'block', uid: c.uid });
    }
  }
  for (const u of game.P(p).hand) {
    const d = game.def(u);
    if (d.type === 'Program' && d.keywords.includes('quick') && game.canPlayCard(p, u)) out.push({ type: 'play', uid: u });
  }
  for (const ab of game.listAbilities(p, true)) out.push({ type: 'activate', uid: ab.self.uid, host: ab.host.uid, index: ab.index });
  return out;
}

export async function doReaction(game: Game, p: PlayerId, rx: Reaction) {
  const a = game.s.attack!;
  switch (rx.type) {
    case 'call':
      if (await game.pay(p, game.callCost(p), [], `Call ${game.name(rx.uid)}`)) await game.callLegend(p, rx.uid);
      return;
    case 'block': {
      const c = game.s.cards[rx.uid];
      c.spent = true;
      a.targetUnit = rx.uid;
      a.targetGigs = null;
      game.log(p, `${game.name(c)} blocks!`);
      game.emit('spent', { uid: rx.uid, cause: 'block' });
      game.emit('blockerUsed', { uid: rx.uid });
      return;
    }
    case 'play':
      await game.playFromHand(p, rx.uid);
      return;
    case 'activate':
      await game.activate(p, rx.uid, rx.host, rx.index, true);
      return;
  }
}

export function fightOutcome(game: Game, aUid: number, bUid: number): { a: 'win' | 'lose'; b: 'win' | 'lose' } {
  const A = game.s.cards[aUid];
  const B = game.s.cards[bUid];
  const pa = game.power(A);
  const pb = game.power(B);
  let a: 'win' | 'lose' = pa > pb ? 'win' : 'lose';
  let b: 'win' | 'lose' = pb > pa ? 'win' : 'lose';
  for (const src of game.sources()) {
    const fn = game.script(src.self).fightOverride;
    if (!fn) continue;
    if (src.host.uid === aUid) {
      const o = fn(game, src.self, src.host, B);
      if (o) {
        a = o;
        b = o === 'win' ? 'lose' : b;
      }
    }
    if (src.host.uid === bUid) {
      const o = fn(game, src.self, src.host, A);
      if (o) {
        b = o;
        a = o === 'win' ? 'lose' : a;
      }
    }
  }
  return { a, b };
}

export async function fight(game: Game, aUid: number, bUid: number) {
  const A = game.s.cards[aUid];
  const B = game.s.cards[bUid];
  const pa = game.power(A);
  const pb = game.power(B);
  const res = game.fightOutcome(aUid, bUid);
  game.log(A.controller, `fight: ${game.name(A)} (${pa}) vs ${game.name(B)} (${pb})`);
  game.emit('fight', { uid: aUid, opp: bUid, result: res.a, power: pa, oppPower: pb });
  game.emit('fight', { uid: bUid, opp: aUid, result: res.b, power: pb, oppPower: pa });
  // defeat losers (power 0 can't defeat). "noDefeatOpp" (Reboot Optics) is used up by the next fight of a Unit it
  // covers, and that Unit doesn't defeat its opponent.
  const noDefA = consumeNoDefeat(game, aUid);
  const noDefB = consumeNoDefeat(game, bUid);
  const toDefeat: [number, number][] = [];
  for (const [loser, lost, by, byPower, spared] of [
    [aUid, res.a, bUid, pb, noDefB],
    [bUid, res.b, aUid, pa, noDefA],
  ] as const) {
    if (lost !== 'lose' || byPower <= 0) continue;
    if (spared) game.log(game.s.cards[by].controller, `${game.name(by)} doesn't defeat its opponent`);
    else toDefeat.push([loser, by]);
  }
  for (const [loser, by] of toDefeat) await game.defeat(loser, { inFight: true, by });
}

/** Does a 'noDefeatOpp' effect cover this Unit (a mod on the Unit, or a player-wide mod for its controller)? */
export function noDefeatOppMod(game: Game, uid: number): Mod | undefined {
  const c = game.s.cards[uid];
  return game.s.mods.find((x) => x.kind === 'noDefeatOpp' && (x.target === uid || (x.target === undefined && x.player === c.controller)));
}

/** Use up a 'noDefeatOpp' effect covering this fighting Unit. */
export function consumeNoDefeat(game: Game, uid: number): boolean {
  const m = game.noDefeatOppMod(uid);
  if (!m) return false;
  game.removeMod(m.id);
  return true;
}

export function stealCount(game: Game, att: CardInst): number {
  const pw = game.power(att);
  if (pw <= 0) return 0;
  return Math.max(0, Math.floor(pw / 10) + 1 + game.stealModifier(att));
}

/** Effects that change how many Gigs the actor steals ("steals 1 fewer Gig"). Applied to every steal (11.5.1.3). */
export function stealModifier(game: Game, att: CardInst): number {
  let n = 0;
  for (const src of game.sources()) {
    const fn = game.script(src.self).stealMod;
    if (fn) n += fn(game, src.self, src.host, att);
  }
  for (const m of game.modsFor('stealMod', att.uid)) n += m.amount ?? 0;
  return n;
}

/**
 * Gigs of player `from` that the actor may select to steal, after every effect that restricts its ability to steal
 * (11.5.1.3): player-level 'stealBan' mods (Chrome Fang, Westbrook Netrunner) and scripts' stealBan hooks. Used by
 * attack steals and effect steals alike.
 */
export function stealableGigs(game: Game, att: CardInst, from: PlayerId): Gig[] {
  const pw = game.power(att);
  return game.gigsOf(from).filter((g) => {
    // value {cmp:'gt'|'lt', legendsOnly?}: the actor can't steal Gigs with value higher / lower than its power
    for (const m of game.playerMods('stealBan', from)) {
      const v = m.value ?? {};
      if (v.legendsOnly && !game.isLegend(att)) continue;
      if (v.cmp === 'gt' && g.value > pw) return false;
      if (v.cmp === 'lt' && g.value < pw) return false;
    }
    for (const src of game.sources()) {
      const fn = game.script(src.self).stealBan;
      if (fn && fn(game, src.self, src.host, att, g)) return false;
    }
    return true;
  });
}

/** Rival effects that stop a selected Gig from being stolen ("would be stolen", 11.5.1.5). */
export async function stealPrevented(game: Game, att: CardInst, from: PlayerId, gid: number): Promise<boolean> {
  for (const src of game.sources(from)) {
    const fn = game.script(src.self).preventSteal;
    if (fn && (await fn(game, src.self, src.host, att, game.s.gigs[gid]))) return true;
  }
  return false;
}

export async function steal(game: Game, attUid: number, from: PlayerId) {
  const att = game.s.cards[attUid];
  const p = att.controller;
  const n = game.stealCount(att);
  const final = await stealUpTo(game, att, p, from, n, (i) => `Steal a Gig (${i + 1}/${n})`);
  if (!final.length) game.log(p, `${game.name(att)} steals nothing`);
}

/**
 * Effect-driven steal: actor steals one rival Gig chosen by p (e.g. Gorilla Arms, Appetite). The same restrictions
 * and steal-count modifiers as an attack steal apply (11.5.1.3), so "steals 1 fewer Gig" cancels it.
 */
export async function stealOne(game: Game, p: PlayerId, actor: number, filter?: (g: Gig) => boolean) {
  const att = game.s.cards[actor];
  const from = other(p);
  const n = 1 + game.stealModifier(att);
  if (n <= 0) {
    game.log(p, `${game.name(att)} steals nothing`);
    return;
  }
  await stealUpTo(game, att, p, from, n, (i) => (n > 1 ? `Steal a rival Gig (${i + 1}/${n})` : 'Steal a rival Gig'), filter);
}

/**
 * The steal attack and effect steals share: p selects up to n of `from`'s Gigs the actor may steal (stealableGigs,
 * and `filter`), the rival's effects may prevent each (11.5.1.5), and the rest are stolen. Returns the Gigs stolen.
 */
export async function stealUpTo(game: Game, att: CardInst, p: PlayerId, from: PlayerId, n: number, prompt: (i: number) => string, filter?: (g: Gig) => boolean): Promise<number[]> {
  const chosen: number[] = [];
  for (let i = 0; i < n; i++) {
    const cands = game.stealableGigs(att, from).filter((g) => !chosen.includes(g.id) && (!filter || filter(g)));
    if (!cands.length) break;
    const gid = await game.chooseGig(p, cands, prompt(i), false, 'steal');
    if (gid === null) break;
    chosen.push(gid);
  }
  const final: number[] = [];
  for (const gid of chosen) if (!(await stealPrevented(game, att, from, gid))) final.push(gid);
  for (const gid of final) game.stealGig(att.uid, gid, p);
  return final;
}
