// Static position evaluation from one player's perspective.
import { other, type Game } from '../engine/engine';
import { attackBanned } from '../engine/game/combat';
import type { CardInst, Gig, PlayerId } from '../engine/types';
import { gigPlanOf, type GigPlan } from './knowledge';
import { activeSteer, assemblyCredit, packageFacts, protectCredit, seatPackages, steerCredit } from './packages';

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
  // Fixed so far (not in the tuner's search, see TUNED_WEIGHTS), kept here so a tuner can reach them:
  unitBase: number; // every Unit on the field
  blocker: number; // a Unit with Blocker
  unitGear: number; // per Gear on a Unit
  stealsTwo: number; // a Unit at 10+ power (steals 2 Gigs)
  goSolo: number; // a Legend that went solo
  legendGear: number; // per Gear on a Legend
  lowDeck: number; // per card short of lowDeckAt in the deck
  lowDeckAt: number;
  handCap: number; // cards in hand counted at most
  eddieCap: number; // Eddies counted at most
  win: number; // a won game (a lost one is −win)
  playOutClamp: number; // a play-out's score is clamped to ±this, so one lost world can't outweigh the rest
  // Synergy packages the player's own list is built around (src/ai/packages.ts, docs/SYNERGIES.md). All 0 by default:
  // the bots play exactly as before until a measured value is applied (docs/BOT_TOOLKIT.md §3).
  pkgHold: number; // keep value of a package piece in hand whose partner can still be had (sell, discard, search choices)
  pkgAssembly: number; // a package's pieces available together (hand, play, Legends)
  pkgSteer: number; // own Gigs / Street Cred toward a package's condition while a payoff is available (also roll-in, steal, adjust, swap)
  pkgProtect: number; // per member in play of a `requires` package assembled in play
  // The next turn (BOT-3, nextTurnTerms below). All 0 by default: the evaluation is exactly as before until one is set.
  exposed: number; // share of the Gig swing (gig, gigNear, overtime) of the Gigs the rival can steal on its next turn
  threat: number; // share of the Gig swing of the Gigs we can steal on our next turn, when ours is the next turn
  rivalLethal: number; // points off when the rival holds 7+ Gigs and will start its turn before we can take enough back
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
  unitBase: 2,
  blocker: 2,
  unitGear: 1.5,
  stealsTwo: 6,
  goSolo: 2,
  legendGear: 2,
  lowDeck: 8,
  lowDeckAt: 4,
  handCap: 10,
  eddieCap: 10,
  win: 10000,
  playOutClamp: 600,
  pkgHold: 0,
  pkgAssembly: 0,
  pkgSteer: 0,
  pkgProtect: 0,
  exposed: 0,
  threat: 0,
  rivalLethal: 0,
};

/** The next-turn weights of BOT-3 (not in TUNED_WEIGHTS: measured by paired botcheck, docs/BOT_TOOLKIT.md §3). */
export const NEXT_TURN_WEIGHTS = ['exposed', 'threat', 'rivalLethal'] as const satisfies readonly (keyof EvalWeights)[];

/** The package weights (not in TUNED_WEIGHTS: they are measured by scripts/package-scoring.ts). */
export const PACKAGE_WEIGHTS = ['pkgHold', 'pkgAssembly', 'pkgSteer', 'pkgProtect'] as const satisfies readonly (keyof EvalWeights)[];

/** Does any package weight count? (All 0 = the evaluation never looks at packages.) */
export const usesPackages = (w: EvalWeights) => w.pkgHold !== 0 || w.pkgAssembly !== 0 || w.pkgSteer !== 0 || w.pkgProtect !== 0;

/**
 * The weights for the RIVAL seat inside a lookahead clone: no package terms, because the deciding bot doesn't know the
 * rival's list. The same object when no package weight is set (so play is unchanged).
 */
export const withoutPackages = (w: EvalWeights): EvalWeights => (usesPackages(w) ? { ...w, pkgHold: 0, pkgAssembly: 0, pkgSteer: 0, pkgProtect: 0 } : w);

/** The weights scripts/tune.ts searches, in its order; the rest of EvalWeights keeps its defaults. */
export const TUNED_WEIGHTS = ['gig', 'gigNear', 'unitPower', 'unitCost', 'hand', 'eddie', 'faceUpLegend', 'plan', 'spentRisk'] as const satisfies readonly (keyof EvalWeights)[];

/** A play-out's evaluation clamped to ±playOutClamp. */
export const clampPlayOut = (v: number, w: EvalWeights = DEFAULT_WEIGHTS) => Math.max(-w.playOutClamp, Math.min(w.playOutClamp, v));

/** Evaluation points per "Gig" in advice and reviews: a stolen Gig moves the evaluation by about 2 × the gig weight. */
export const GIG_SWING = 2 * DEFAULT_WEIGHTS.gig;
/** An evaluation this far from 0 is a decided game (evaluate() gives ±win for one; no position comes close). */
export const DECIDED_EVAL = DEFAULT_WEIGHTS.win / 2;

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
  let v = pw * w.unitPower + (d.cost ?? 4) * w.unitCost + w.unitBase;
  if (g.hasKw(c, 'blocker')) v += w.blocker;
  v += c.gear.length * w.unitGear;
  if (pw >= 10) v += w.stealsTwo; // steals 2
  if (c.goSolo) v += w.goSolo;
  return v;
}

/** Can any rival unit that will be ready next turn beat this (spent) unit in a fight? */
function atRisk(g: Game, c: CardInst): boolean {
  const pw = g.power(c);
  return g.units(other(c.controller)).some((r) => g.power(r) > pw || (g.power(r) === pw && pw > 0));
}

export function evaluate(g: Game, p: PlayerId, w: EvalWeights = DEFAULT_WEIGHTS): number {
  const s = g.s;
  if (s.winner !== null) return s.winner === 'tie' ? 0 : s.winner === p ? w.win : -w.win;
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
    side += Math.min(P.hand.length, w.handCap) * w.hand;
    side += Math.min(P.eddies.length, w.eddieCap) * w.eddie;
    side += P.legends.filter((u) => g.c(u).faceUp).length * w.faceUpLegend;
    // legends also gear hosts
    for (const u of P.legends) side += g.c(u).gear.length * w.legendGear;
    if (P.deck.length < w.lowDeckAt) side -= (w.lowDeckAt - P.deck.length) * w.lowDeck;
    side += planScore(g.gigsOf(pl), planFor(g, pl, p)) * w.plan;
    v += sign * side;
  }
  // own packages only: the rival's list is not known to p
  if (w.pkgAssembly !== 0 || w.pkgSteer !== 0 || w.pkgProtect !== 0) v += packageTerms(g, p, w);
  if (w.exposed !== 0 || w.threat !== 0 || w.rivalLethal !== 0) v += nextTurnTerms(g, p, w);
  return v;
}

/** The Gig part of evaluate() for p holding myG Gigs against the rival's rG. */
function gigTerm(myG: number, rG: number, overtime: boolean, w: EvalWeights): number {
  let v = (myG - rG) * w.gig * (overtime ? 2 : 1);
  if (myG >= 6) v += w.gigNear * (myG - 5);
  if (rG >= 6) v -= w.gigNear * (rG - 5);
  return v;
}

/** Whose turn comes next: the seat now active once its end phase has run (phase 'end'), else the other one. */
export const nextTurnSeat = (g: Game): PlayerId => (g.s.phase === 'end' ? g.s.active : other(g.s.active));

/**
 * Gigs seat `att` can steal from `def` on att's next turn, from public information: every Unit att has on the field
 * now readies and has no lag by then (lag ends with every turn) unless an attack restriction bans it from attacking,
 * and steals ⌊power/10⌋+1; each of def's Units that is ready now with Blocker stays ready through att's turn (Units
 * ready only at their controller's start) and stops one attack, taken to be the one stealing most. Capped at def's
 * Gigs. Ignores Units att will play (they lag), unblockable attackers, steal modifiers and this turn's power mods.
 */
export function stealableNextTurn(g: Game, att: PlayerId, def: PlayerId): number {
  const have = g.P(def).gigs.length;
  if (have === 0) return 0;
  const steals: number[] = [];
  for (const c of g.units(att)) {
    // a spent Unit stays spent through a "can't ready" that outlasts this turn and att's start
    if (c.spent && g.s.mods.some((m) => m.kind === 'cantReady' && m.target === c.uid && m.until !== 'endOfTurn' && !(m.until === 'startOfTurn' && m.untilPlayer === att))) continue;
    const pw = g.power(c);
    if (pw <= 0 || attackBanned(g, c, null)) continue;
    steals.push(Math.floor(pw / 10) + 1);
  }
  if (!steals.length) return 0;
  let blockers = 0;
  for (const c of g.units(def)) if (!c.spent && g.hasKw(c, 'blocker')) blockers++;
  steals.sort((a, b) => b - a);
  let n = 0;
  for (let i = blockers; i < steals.length; i++) n += steals[i];
  return Math.min(n, have);
}

/**
 * Gigs p can still steal from the rival in the rest of p's current turn: p's Units that can attack the rival's Gigs now
 * (`attackTargets`), each rival Unit ready with Blocker stopping the one stealing most.
 */
function stealableThisTurn(g: Game, p: PlayerId): number {
  const r = other(p);
  const steals: number[] = [];
  for (const c of g.units(p)) if (g.attackTargets(c).some((t) => t.gigs !== null)) steals.push(g.stealCount(c));
  let blockers = 0;
  for (const c of g.units(r)) if (!c.spent && g.hasKw(c, 'blocker')) blockers++;
  steals.sort((a, b) => b - a);
  let n = 0;
  for (let i = blockers; i < steals.length; i++) n += steals[i];
  return Math.min(n, g.P(r).gigs.length);
}

/**
 * BOT-3: what the next turn threatens, which the rest of evaluate() cannot see. The next turn is the rival's while p is
 * still in its own turn (the 1-ply screen) or once the rival's turn is over to its end phase; it is p's at the end of a
 * play-out of the rival's reply and while p reacts to a rival attack.
 *  - exposed: the rival's next turn: −exposed × the Gig swing of the Gigs it can steal (`stealableNextTurn`).
 *  - threat: p's next turn: +threat × the Gig swing of the Gigs p can steal.
 *  - rivalLethal: the rival holds 7+ Gigs (outside overtime) and its turn is next: it wins at its start unless p takes
 *    enough back first. Applied in full once p's turn is over, and in p's own turn when p's ready attackers can't steal
 *    the rival below 7 (`stealableThisTurn`).
 */
export function nextTurnTerms(g: Game, p: PlayerId, w: EvalWeights): number {
  const r = other(p);
  const next = nextTurnSeat(g);
  const myG = g.P(p).gigs.length;
  const rG = g.P(r).gigs.length;
  const ot = g.s.overtime;
  const base = gigTerm(myG, rG, ot, w);
  let v = 0;
  if (next === r) {
    if (w.exposed !== 0) {
      const n = stealableNextTurn(g, r, p);
      if (n > 0) v -= w.exposed * (base - gigTerm(myG - n, rG + n, ot, w));
    }
    if (w.rivalLethal !== 0 && rG >= 7 && !ot) {
      // next === r: either p's turn is over (phase 'end', r active) or p is still in its turn and may steal back
      if (g.s.phase === 'end' || stealableThisTurn(g, p) < rG - 6) v -= w.rivalLethal;
    }
  } else if (w.threat !== 0) {
    const n = stealableNextTurn(g, p, r);
    if (n > 0) v += w.threat * (gigTerm(myG + n, rG - n, ot, w) - base);
  }
  return v;
}

/** The package terms of evaluate() for p's own side (src/ai/packages.ts); 0 for a list built around no package. */
export function packageTerms(g: Game, p: PlayerId, w: EvalWeights): number {
  const pkgs = seatPackages(g, p);
  if (!pkgs.length) return 0;
  const facts = packageFacts(g, p, pkgs);
  let v = 0;
  if (w.pkgAssembly !== 0) v += w.pkgAssembly * assemblyCredit(facts);
  if (w.pkgProtect !== 0) v += w.pkgProtect * protectCredit(facts);
  if (w.pkgSteer !== 0) {
    const kinds = activeSteer(facts);
    if (kinds.length) v += w.pkgSteer * steerCredit(kinds, g.gigsOf(p), g.gigsOf(other(p)));
  }
  return v;
}
