// Gigs: rolling in, changing values, moving, swapping and stealing single Gigs, and the Gig choices scripts use.
import type { Game } from '../engine';
import { randInt } from '../rng';
import { noteTurnEvent } from './history';
import type { Gig, Intent, Opt, PlayerId } from '../types';

export async function rollIn(game: Game, p: PlayerId) {
  const ps = game.P(p);
  let opts = ps.fixer.map((id) => game.s.gigs[id]);
  if (opts.length > 1) opts = opts.filter((g) => g.sides !== 20);
  let gig: Gig;
  if (opts.length === 1) gig = opts[0];
  else {
    const i = await game.ask({
      player: p,
      kind: 'gig',
      prompt: 'Roll in a Gig from your fixer area',
      options: opts.map((g) => ({ label: `d${g.sides}`, gig: g.id })),
      min: 1,
      max: 1,
      tag: 'rollIn',
    });
    gig = opts[i[0]];
  }
  gig.value = 1 + randInt(game.s, gig.sides);
  ps.fixer = ps.fixer.filter((id) => id !== gig.id);
  gig.controller = p;
  ps.gigs.push(gig.id);
  game.log(p, `rolls in d${gig.sides}: ${gig.value}`);
  game.emit('gigRolled', { gig: gig.id, player: p, fromFixer: true });
}

/** Re-roll an existing gig in place (used by Kerry). */
export function reroll(game: Game, gid: number) {
  const g = game.s.gigs[gid];
  g.value = 1 + randInt(game.s, g.sides);
}

export function setGigValue(game: Game, gid: number, value: number, by: PlayerId, kind: 'adjust' | 'set' = 'adjust'): boolean {
  const g = game.s.gigs[gid];
  if (value < 1 || value > g.sides || value === g.value) return false;
  const old = g.value;
  g.value = value;
  game.log(by, `${kind === 'set' ? 'sets' : value > old ? 'increases' : 'decreases'} ${g.controller === by ? 'friendly' : 'rival'} d${g.sides} ${old}→${value}`);
  game.emit('gigChanged', { gig: gid, by, kind });
  return true;
}

export function moveGig(game: Game, gid: number, to: PlayerId) {
  const g = game.s.gigs[gid];
  if (g.controller === null) return;
  const from = game.P(g.controller);
  from.gigs = from.gigs.filter((x) => x !== gid);
  g.controller = to;
  game.P(to).gigs.push(gid);
}

export function swapGigs(game: Game, friendly: number, rival: number, by: PlayerId) {
  const a = game.s.gigs[friendly];
  const b = game.s.gigs[rival];
  const pa = a.controller!;
  const pb = b.controller!;
  game.moveGig(friendly, pb);
  game.moveGig(rival, pa);
  game.log(by, `swaps d${a.sides}(${a.value}) with d${b.sides}(${b.value})`);
  game.emit('gigChanged', { gig: friendly, by, kind: 'swap' });
  game.emit('gigChanged', { gig: rival, by, kind: 'swap' });
  game.checkState();
}

/** Steal a specific gig as `actor` (unit uid) for player p. Fires steal triggers. */
export function stealGig(game: Game, actor: number, gid: number, p: PlayerId) {
  const g = game.s.gigs[gid];
  if (g.controller === p || g.controller === null) return;
  game.moveGig(gid, p);
  game.s.stats.gigsStolen[p]++;
  game.tr('steal', p, game.s.cards[actor]?.defId, g.value);
  game.log(p, `${game.name(actor)} steals d${g.sides} (${g.value})`);
  const actorCard = game.s.cards[actor];
  const seq = noteTurnEvent(game, { k: 'steal', p, uid: actor, defId: actorCard?.defId ?? '', value: g.value, power: actorCard ? game.power(actorCard) : 0 });
  game.emit('steal', { actor, gig: gid, player: p, value: g.value, seq });
  game.checkState();
}

/**
 * "Increase/Decrease/Adjust a Gig by up to N" — presents every (gig, newValue) option.
 * whose: which gigs are eligible. Returns chosen gig id or null.
 */
export async function adjustGig(game: Game, p: PlayerId, amount: number, dir: 'up' | 'down' | 'either', whose: 'any' | 'friendly' | 'rival' = 'any', opts: { exact?: boolean; source?: number; optional?: boolean } = {},): Promise<number | null> {
  const gigs = game.allGigs().filter(
    (g) => whose === 'any' || (whose === 'friendly' ? g.controller === p : g.controller !== p),
  );
  const options: Opt[] = [];
  for (const g of gigs) {
    for (let d = 1; d <= amount; d++) {
      if (opts.exact && d !== amount) continue;
      for (const sgn of dir === 'either' ? [1, -1] : dir === 'up' ? [1] : [-1]) {
        const v = g.value + sgn * d;
        if (v < 1 || v > g.sides) continue;
        options.push({ label: `${g.controller === p ? 'Friendly' : 'Rival'} d${g.sides}: ${g.value} → ${v}`, gig: g.id, n: v });
      }
    }
  }
  if (!options.length) return null;
  // "up to" lets you choose 0; an exact adjustment ("Adjust a Gig by 1") must change a Gig
  if (!opts.exact) options.push({ label: 'No change', key: 'none' });
  const [i] = await game.ask({
    player: p,
    kind: 'gigValue',
    prompt: `${dir === 'up' ? 'Increase' : dir === 'down' ? 'Decrease' : 'Adjust'} a Gig by ${opts.exact ? '' : 'up to '}${amount}`,
    options,
    min: 1,
    max: 1,
    source: opts.source,
    tag: 'adjust',
  });
  const o = options[i];
  if (o.key === 'none') return null;
  game.setGigValue(o.gig!, o.n!, p, 'adjust');
  return o.gig!;
}

/** Choose a gig (no modification). */
export async function chooseGig(game: Game, p: PlayerId, gigs: Gig[], prompt: string, optional = false, tag?: string, intent?: Intent): Promise<number | null> {
  if (!gigs.length) return null;
  const options: Opt[] = gigs.map((g) => ({ label: `${g.controller === p ? 'Friendly' : 'Rival'} d${g.sides} (${g.value})`, gig: g.id }));
  if (optional) options.push({ label: 'None', key: 'none' });
  const [i] = await game.ask({ player: p, kind: 'gig', prompt, options, min: 1, max: 1, tag, intent });
  return options[i].key === 'none' ? null : options[i].gig!;
}
