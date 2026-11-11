// Modifiers (Mod, a discriminated union in ../types.ts) and the stats they change: power and keywords.
import type { Game } from '../engine';
import type { CardInst, Keyword, ModDuration, ModKind, ModOf, ModUntil, NewMod, PlayerId } from '../types';

/**
 * The duration fields of a new mod, in the order mods have always been written (`until`, then `untilPlayer`, even when
 * undefined). A 'startOfTurn' mod without a player would never be removed, so it is refused.
 */
export function modDuration(until: ModUntil, untilPlayer: PlayerId | undefined): ModDuration {
  if (until === 'startOfTurn') {
    if (untilPlayer === undefined) throw new Error("a 'startOfTurn' mod needs untilPlayer, or it would never be removed");
    return { until, untilPlayer };
  }
  return { until, untilPlayer: undefined };
}

export function addMod<K extends ModKind>(game: Game, m: Extract<NewMod, { kind: K }>): ModOf<K> {
  const mod = { ...m, id: game.s.nextModId++, turn: game.s.turn } as ModOf<K>;
  game.s.mods.push(mod);
  return mod;
}

export function modsFor<K extends ModKind>(game: Game, kind: K, uid?: number): ModOf<K>[] {
  return game.s.mods.filter((m): m is ModOf<K> => m.kind === kind && (uid === undefined || m.target === uid));
}

export function hasMod(game: Game, kind: ModKind, uid: number): boolean {
  return game.s.mods.some((m) => m.kind === kind && m.target === uid);
}

export function playerMods<K extends ModKind>(game: Game, kind: K, p: PlayerId): ModOf<K>[] {
  return game.s.mods.filter((m): m is ModOf<K> => m.kind === kind && m.player === p);
}

export function removeMod(game: Game, id: number) {
  game.s.mods = game.s.mods.filter((m) => m.id !== id);
}

/** Give a unit +N power until end of turn (or other duration). */
export function givePower(game: Game, uid: number, amount: number, until: ModUntil = 'endOfTurn', untilPlayer?: PlayerId, source?: number) {
  game.addMod({ kind: 'power', target: uid, amount, ...modDuration(until, untilPlayer), source });
}

export function giveKeyword(game: Game, uid: number, kw: Keyword, until: Exclude<ModUntil, 'startOfTurn'> = 'endOfTurn') {
  game.addMod({ kind: 'keyword', target: uid, value: kw, until });
}

/** Raw power (may be negative). */
export function rawPower(game: Game, x: number | CardInst): number {
  const c = typeof x === 'number' ? game.s.cards[x] : x;
  const d = game.def(c);
  let p = d.power ?? 0;
  for (const gu of c.gear) p += game.def(gu).power ?? 0;
  for (const m of game.s.mods) if (m.kind === 'power' && m.target === c.uid) p += m.amount ?? 0;
  if (c.zone === 'field' || c.zone === 'legends') {
    for (const src of game.sources()) {
      const fn = game.script(src.self).power;
      if (fn) p += fn(game, src.self, src.host, c);
    }
  }
  return p;
}

export function power(game: Game, x: number | CardInst): number {
  return Math.max(0, game.rawPower(x));
}

export function hasKw(game: Game, x: number | CardInst, kw: Keyword): boolean {
  const c = typeof x === 'number' ? game.s.cards[x] : x;
  if (game.def(c).keywords.includes(kw)) return true;
  for (const gu of c.gear) if (game.def(gu).keywords.includes(kw)) return true;
  if (game.s.mods.some((m) => m.kind === 'keyword' && m.target === c.uid && m.value === kw)) return true;
  for (const src of game.sources()) {
    const fn = game.script(src.self).keywords;
    if (fn && fn(game, src.self, src.host, c).includes(kw)) return true;
  }
  return false;
}
