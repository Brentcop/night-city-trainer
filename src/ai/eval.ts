// Static position evaluation from one player's perspective.
import { other, type Game } from '../engine/engine';
import type { CardInst, Gig, PlayerId } from '../engine/types';
import { gigPlanOf, type GigPlan } from './knowledge';

export interface EvalWeights {
  gig: number; // per gig difference
  gigNear: number; // bonus for being at 6+ gigs
  unitPower: number;
  unitCost: number;
  hand: number;
  eddie: number;
  faceUpLegend: number;
  plan: number;
  spentRisk: number; // fraction of a spent unit's value at risk
}

// Tuned by self-play (scripts/tune.ts): round 1 halved gig, unitPower, spentRisk; round 2 raised faceUpLegend, halved spentRisk again (Nov 10 2026).
export const DEFAULT_WEIGHTS: EvalWeights = {
  gig: 20,
  gigNear: 45,
  unitPower: 1.2,
  unitCost: 1.2,
  hand: 3.6,
  eddie: 2.6,
  faceUpLegend: 4.8,
  plan: 1.5,
  spentRisk: 0.087,
};

/** Evaluation points per "Gig" in advice and reviews: a stolen Gig moves the evaluation by about 2 × the gig weight. */
export const GIG_SWING = 2 * DEFAULT_WEIGHTS.gig;

/** Cards known to `viewer` that belong to player p (own: everything; rival: public zones only). */
export function knownCards(g: Game, p: PlayerId, viewer: PlayerId): string[] {
  const P = g.P(p);
  const zones = viewer === p ? [...P.deck, ...P.hand, ...P.field, ...P.trash] : [...P.field, ...P.trash];
  const ids = zones.map((u) => g.c(u).defId);
  for (const u of P.legends) if (viewer === p || g.c(u).faceUp) ids.push(g.c(u).defId);
  return ids;
}

const planCache = new WeakMap<object, Map<string, GigPlan>>();
export function planFor(g: Game, p: PlayerId, viewer: PlayerId): GigPlan {
  // cache per state object for own plans (stable); rival plan recomputed (cheap)
  const key = `${p}:${viewer}`;
  let m = planCache.get(g.s.players[p]);
  if (!m) planCache.set(g.s.players[p], (m = new Map()));
  if (viewer === p && m.has(key)) return m.get(key)!;
  const plan = gigPlanOf(knownCards(g, p, viewer));
  if (viewer === p) m.set(key, plan);
  return plan;
}

/** How good a set of gigs is for a plan (independent of gig count). */
export function planScore(gigs: Gig[], plan: GigPlan): number {
  let s = 0;
  const counts: Record<number, number> = {};
  for (const x of gigs) counts[x.value] = (counts[x.value] ?? 0) + 1;
  const pairs = Object.values(counts).reduce((a, n) => a + Math.floor(n / 2), 0);
  const distinct = Object.keys(counts).length;
  const hasEven = gigs.some((x) => x.value % 2 === 0);
  const hasOdd = gigs.some((x) => x.value % 2 === 1);
  for (const x of gigs) {
    if (x.value >= 8) s += 3 * plan.high;
    if (x.value === 1) s += 3 * plan.low;
    if (x.value === x.sides) s += 0.5 * plan.high;
    if (x.sides === 20) s += (x.value / 20) * 2 * plan.d20;
  }
  s += pairs * 3 * plan.pairs;
  s += distinct * 0.8 * plan.diverse;
  if (hasEven && hasOdd) s += 2 * plan.parity;
  // small generic preference for street cred
  s += gigs.reduce((a, x) => a + x.value, 0) * 0.05;
  return s;
}

export function unitValue(g: Game, c: CardInst, w: EvalWeights = DEFAULT_WEIGHTS): number {
  const d = g.def(c);
  const pw = g.power(c);
  let v = pw * w.unitPower + (d.cost ?? 4) * w.unitCost + 2;
  if (g.hasKw(c, 'blocker')) v += 2;
  v += c.gear.length * 1.5;
  if (pw >= 10) v += 6; // steals 2
  if (c.goSolo) v += 2;
  return v;
}

/** Can any rival unit that will be ready next turn beat this (spent) unit in a fight? */
function atRisk(g: Game, c: CardInst): boolean {
  const pw = g.power(c);
  return g.units(other(c.controller)).some((r) => g.power(r) > pw || (g.power(r) === pw && pw > 0));
}

export function evaluate(g: Game, p: PlayerId, w: EvalWeights = DEFAULT_WEIGHTS): number {
  const s = g.s;
  if (s.winner !== null) return s.winner === 'tie' ? 0 : s.winner === p ? 10000 : -10000;
  const r = other(p);
  let v = 0;
  const myG = g.P(p).gigs.length;
  const rG = g.P(r).gigs.length;
  v += (myG - rG) * w.gig;
  if (myG >= 6) v += w.gigNear * (myG - 5);
  if (rG >= 6) v -= w.gigNear * (rG - 5);
  if (s.overtime) v += (myG - rG) * w.gig; // every gig matters double in overtime
  for (const pl of [p, r] as PlayerId[]) {
    const sign = pl === p ? 1 : -1;
    let side = 0;
    for (const c of g.units(pl)) {
      let uv = unitValue(g, c, w);
      if (c.spent && pl === s.active && atRisk(g, c)) uv *= 1 - w.spentRisk;
      side += uv;
    }
    const P = g.P(pl);
    side += Math.min(P.hand.length, 10) * w.hand;
    side += Math.min(P.eddies.length, 10) * w.eddie;
    side += P.legends.filter((u) => g.c(u).faceUp).length * w.faceUpLegend;
    // legends also gear hosts
    for (const u of P.legends) side += g.c(u).gear.length * 2;
    if (P.deck.length < 4) side -= (4 - P.deck.length) * 8;
    side += planScore(g.gigsOf(pl), planFor(g, pl, p)) * w.plan;
    v += sign * side;
  }
  return v;
}
