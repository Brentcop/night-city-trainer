// Costs and payment: play costs after modifiers, payment sources, paying (automatic or chosen), the Call cost.
import type { Game } from '../engine';
import type { CardInst, CostModFilter, Opt, PlayerId } from '../types';

/** Player-level 'costMod' mods store a plain-data filter (CostModFilter), so game state stays cloneable. */
export function costModMatches(g: Game, v: CostModFilter | undefined, c: CardInst, kind: 'play' | 'goSolo'): boolean {
  if (!v) return kind === 'play';
  if (v.kind && v.kind !== kind) return false;
  if (!v.kind && kind !== 'play') return false;
  if (v.uid !== undefined && v.uid !== c.uid) return false;
  if (v.type && g.def(c).type !== v.type) return false;
  if (v.tag && !g.isTag(c, v.tag)) return false;
  if (v.color && g.def(c).color !== v.color) return false;
  return true;
}

/** Play cost for a card in hand/trash (after modifiers, min 1 if reduced). */
export function playCost(game: Game, uid: number, p: PlayerId, kind: 'play' | 'goSolo' = 'play'): number {
  const c = game.s.cards[uid];
  const d = game.def(c);
  const sc = game.script(c);
  let base = d.cost ?? 0;
  const alt = sc.altCost?.(game, c, p);
  if (alt !== null && alt !== undefined) base = alt;
  let delta = sc.selfCost ? sc.selfCost(game, c, p) : 0;
  for (const src of game.sources()) {
    const fn = game.script(src.self).costMod;
    if (fn) delta += fn(game, src.self, src.host, c, p, kind);
  }
  for (const m of game.playerMods('costMod', p)) {
    if (costModMatches(game, m.value, c, kind)) delta += m.amount ?? 0;
  }
  const cost = base + delta;
  if (delta < 0) return Math.max(1, cost);
  return Math.max(0, cost);
}

/** Ready payment sources for player. */
export function payables(game: Game, p: PlayerId): CardInst[] {
  const ps = game.P(p);
  const ed = ps.eddies.map((u) => game.s.cards[u]).filter((c) => !c.spent);
  const lg = ps.legends
    .map((u) => game.s.cards[u])
    .filter((c) => !c.spent && (!c.faceUp || game.def(c).sellable));
  return [...ed, ...lg];
}

export function available(game: Game, p: PlayerId): number {
  return game.payables(p).length;
}

/**
 * Pay amount using Eddies first, then legends that benefit from being spent, then face-down legends, etc.
 * If the paying agent opts in (`choosesPayment`) and the choice is real, it picks each source instead
 * (one 'pay' decision per €$; the first option is always what the automatic rule would pick).
 * `what` names the cost in the prompt. `order.first` / `order.last` move sources to the front or back of the automatic
 * order (a Legend paying for its own Go Solo costs nothing, so it goes first; one paying for its own ordinary play
 * enters spent, so it goes last).
 */
export async function pay(game: Game, p: PlayerId, amount: number, exclude: number[] = [], what = 'a cost', order: { first?: number[]; last?: number[] } = {}): Promise<boolean> {
  if (amount <= 0) return true;
  const srcs = game.payables(p).filter((c) => !exclude.includes(c.uid));
  if (srcs.length < amount) return false;
  const score = (c: CardInst) => {
    if (order.first?.includes(c.uid)) return -1;
    if (order.last?.includes(c.uid)) return 9;
    if (c.zone === 'eddies') return 0;
    if (c.gear.length) return 1; // "when spent" gear triggers
    if (!c.faceUp) return 2;
    const sc = game.script(c);
    return sc.abilities?.some((a) => a.spend) ? 4 : 3;
  };
  srcs.sort((a, b) => score(a) - score(b));
  const chosen = game.agents[p]?.choosesPayment ? await choosePayment(game, p, srcs, amount, what) : srcs.slice(0, amount);
  game.telemetry?.paid(game, p, chosen);
  for (const c of chosen) {
    c.spent = true;
    if (c.zone === 'legends') game.emit('spent', { uid: c.uid, cause: 'pay' });
  }
  return true;
}

/** Let the paying player pick `amount` of the (already sorted) sources, asking only while the choice is real. */
export async function choosePayment(game: Game, p: PlayerId, srcs: CardInst[], amount: number, what: string): Promise<CardInst[]> {
  const pool = [...srcs];
  const out: CardInst[] = [];
  const legends = game.P(p).legends;
  for (let k = 0; k < amount; k++) {
    const left = amount - k;
    // no real choice: everything left must be spent, or only (interchangeable) Eddies are left
    if (pool.length <= left || pool.every((c) => c.zone === 'eddies')) {
      out.push(...pool.slice(0, left));
      break;
    }
    const eddies = pool.filter((c) => c.zone === 'eddies');
    const picks: CardInst[] = [];
    const options: Opt[] = [];
    for (const c of pool) {
      if (c.zone === 'eddies') {
        if (c !== eddies[0]) continue;
        options.push({ label: `an Eddie (${eddies.length} ready)`, uid: c.uid, key: 'eddie' });
      } else {
        const label = c.faceUp ? game.name(c) : `face-down Legend (slot ${legends.indexOf(c.uid) + 1})`;
        options.push({ label, uid: c.uid, key: 'legend' });
      }
      picks.push(c);
    }
    const [i] = await game.ask({ player: p, kind: 'pay', prompt: `${what}: pay €$ ${k + 1} of ${amount} — spend:`, options, min: 1, max: 1 });
    const c = picks[i];
    out.push(c);
    pool.splice(pool.indexOf(c), 1);
  }
  return out;
}

/** Ready up to n spent friendly Eddies. */
export function readyEddies(game: Game, p: PlayerId, n: number) {
  let k = 0;
  for (const u of game.P(p).eddies) {
    const c = game.s.cards[u];
    if (c.spent && k < n) {
      c.spent = false;
      k++;
    }
  }
  if (k) game.log(p, `readies ${k} Eddie${k > 1 ? 's' : ''}`);
}

/** €$ cost of p's normal Call action: 1, unless a card makes it cheaper (Panam Palmer: Strength Through Family). */
export function callCost(game: Game, p: PlayerId): number {
  let cost = 1;
  for (const src of game.sources()) {
    const fn = game.script(src.self).callCost;
    const v = fn?.(game, src.self, src.host, p);
    if (v !== null && v !== undefined) cost = Math.min(cost, v);
  }
  return Math.max(0, cost);
}
