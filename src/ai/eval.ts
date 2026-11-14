// Static position evaluation from one player's perspective.
import { other, type Game } from '../engine/engine';
import { attackBanned } from '../engine/game/combat';
import type { CardInst, Gig, Mod, PlayerId } from '../engine/types';
import { gigPlanOf, type GigPlan } from './knowledge';
import { classify, type Archetype } from './archetype';
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
  // The next turn (BOT-3, nextTurnTerms below). 0 = the term is skipped; the defaults set all three since SIM_VERSION 6.
  exposed: number; // share of the Gig swing (gig, gigNear, overtime) of the Gigs the rival can steal on its next turn
  threat: number; // share of the Gig swing of the Gigs we can steal on our next turn, when ours is the next turn
  rivalLethal: number; // points off when the rival holds 7+ Gigs and will start its turn before we can take enough back
}

// Since SIM_VERSION 6 (2026-11-12): the fitted set `calibrated-2026-11` (src/ai/weightSets.ts, INFO-4: a logistic fit of
// who won on these terms, on the gig scale) plus rivalLethal 400 (BOT-3). Terms the fit could not identify (spentRisk,
// unitGear, legendGear, lowDeck) keep their hand values. The hand-tuned weights used until then are the named set
// `hand-2026-10`. Measured in docs/IMPROVEMENT_BACKLOG.md WP-D1 / WP-D2 (status 2026-11-12, switch-on).
// Since SIM_VERSION 8 (BOT-A, 2026-11-13): goSolo 0, not the fitted −50.6 (the named set keeps it). Going solo costs the
// same as playing the Legend to the field and makes the same Unit, only ready and free to attack this turn (11.29.1; no
// card returns a Unit to the Legends area, the one place where the two differ later), so the flag carries no lasting
// cost: the fit picked up an association, and the bots played the Legend with Lag instead (docs/BOT_TOOLKIT.md §3).
export const DEFAULT_WEIGHTS: EvalWeights = {
  gig: 20,
  gigNear: 50.8,
  unitPower: 13.2,
  unitCost: -4.81,
  hand: 4.54,
  eddie: 26.9,
  faceUpLegend: 8.99,
  plan: 0.915,
  spentRisk: 0.087,
  unitBase: 50.3,
  blocker: -44.1,
  unitGear: 1.5,
  stealsTwo: 42.8,
  goSolo: 0,
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
  exposed: 0.886,
  threat: 0.971,
  rivalLethal: 400,
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

/**
 * The defIds of every card p owns, wherever it is: deck, hand, field, Legends, Eddies, trash, removed from the game, a
 * Program resolving, or Gear attached to a card (which is in no zone list). Owners never change and no card is made or
 * destroyed once play starts (Game.create, and the tutorial's buildPosition before any decision, make them all), so this
 * is p's list at every moment of the game.
 */
export function ownedCards(g: Game, p: PlayerId): string[] {
  const ids: string[] = [];
  for (const k in g.s.cards) {
    const c = g.s.cards[k];
    if (c.owner === p) ids.push(c.defId);
  }
  return ids;
}

/** Each seat's own plan per state copy (keyed on its cards record). */
const ownPlans = new WeakMap<object, (GigPlan | undefined)[]>();

/**
 * Player p's Gig plan as `viewer` sees it.
 *  - Its own (viewer === p): the plan of its whole list, every card it owns wherever the card is (ownedCards). It never
 *    changes in play, so the live game, every copy (lookahead clones, Undo, the coach's snapshot) and every option of one
 *    decision are scored by the same plan, and a game continued from a copy plays out as the game continued in place
 *    (tests/gig-plan-consistency.test.ts). Cached per state copy, which changes nothing: every copy has the same value.
 *  - The rival's: the cards the viewer can see (field, trash, face-up Legends), recomputed on every call.
 */
export function planFor(g: Game, p: PlayerId, viewer: PlayerId): GigPlan {
  if (viewer !== p) return gigPlanOf(knownCards(g, p, viewer));
  let m = ownPlans.get(g.s.cards);
  if (!m) ownPlans.set(g.s.cards, (m = []));
  return (m[p] ??= gigPlanOf(ownedCards(g, p)));
}

/** Each seat's archetype per state copy (keyed on its cards record). */
const listArchetypes = new WeakMap<object, (Archetype | undefined)[]>();

/**
 * Seat p's archetype, as the bots (both seats' reads: their own and the rival's, "scouted" as from open decklists), the
 * coach's tips and the calibration's profiled weights read it: the archetype of its whole list (ownedCards), so it never
 * changes in play and the live bot, its rollout agents, the coach and the reviewer all apply the same matchup profile
 * (tests/gig-plan-consistency.test.ts). Cached per state copy, which changes nothing: every copy has the same value.
 */
export function seatArchetype(g: Game, p: PlayerId): Archetype {
  let m = listArchetypes.get(g.s.cards);
  if (!m) listArchetypes.set(g.s.cards, (m = []));
  return (m[p] ??= classify(ownedCards(g, p)).arch);
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

/** Is `m` a power mod that ends with this turn (or this attack)? */
const tempPowerMod = (m: Mod, uid: number) => m.kind === 'power' && m.target === uid && (m.until === 'endOfTurn' || m.until === 'attackEnd');

/** c's power without the power mods that end with this turn or this attack. */
export function lastingPower(g: Game, c: CardInst): number {
  let p = g.rawPower(c);
  for (const m of g.s.mods) if (tempPowerMod(m, c.uid)) p -= m.amount ?? 0;
  return Math.max(0, p);
}

/**
 * Can this turn's power on c still change anything this turn? c can still attack, a Unit of the active player can still
 * attack it, it is ready with Blocker while the active player can still attack, or it is in the attack in progress.
 */
function tempPowerMatters(g: Game, c: CardInst): boolean {
  const s = g.s;
  if (s.phase !== 'main' && !s.attack) return false;
  if (s.attack && (s.attack.attacker === c.uid || s.attack.targetUnit === c.uid)) return true;
  const a = s.active;
  if (c.controller === a) return g.attackTargets(c).length > 0;
  const attackers = g.units(a).map((u) => g.attackTargets(u)).filter((ts) => ts.length > 0);
  if (attackers.some((ts) => ts.some((t) => t.unit === c.uid))) return true;
  return attackers.length > 0 && !c.spent && g.hasKw(c, 'blocker');
}

/**
 * The power evaluate() counts for c (BOT-B, SIM_VERSION 8): this turn's power mods only where they can still matter this
 * turn, so a pump on a Unit that can no longer fight, or a weaken on a rival Unit nothing can attack, is worth nothing
 * lasting, while the trick that sets up an attack this turn keeps its credit.
 */
export function evalPower(g: Game, c: CardInst): number {
  if (!g.s.mods.some((m) => tempPowerMod(m, c.uid))) return g.power(c);
  return tempPowerMatters(g, c) ? g.power(c) : lastingPower(g, c);
}

/**
 * c's power on `att`'s next turn: without the mods that end before it (this turn's, this attack's, and those that end
 * at att's start).
 */
function nextTurnPower(g: Game, c: CardInst, att: PlayerId): number {
  let p = g.rawPower(c);
  for (const m of g.s.mods) if (m.kind === 'power' && m.target === c.uid && endsBefore(m, att)) p -= m.amount ?? 0;
  return Math.max(0, p);
}

/** Does mod m end before att's next turn's attacks? */
const endsBefore = (m: Mod, att: PlayerId) => m.until === 'endOfTurn' || m.until === 'attackEnd' || (m.until === 'startOfTurn' && m.untilPlayer === att);

export function unitValue(g: Game, c: CardInst, w: EvalWeights = DEFAULT_WEIGHTS): number {
  const d = g.def(c);
  const pw = evalPower(g, c);
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
  return evalCore(g, p, w, null);
}

/**
 * The terms of evaluate() that enter it linearly, one per weight (INFO-4): evaluate() is Σ weight × feature over these,
 * plus the package terms. `lowDeckAt`, `handCap` and `eddieCap` are thresholds inside features; `win` only scores a
 * finished game. Unit features are summed over Units before the spent-risk discount; `spentRisk`'s feature is minus the
 * value of the spent Units at risk, so the discount is exactly `spentRisk` × it.
 */
export const EVAL_TERMS = ['gig', 'gigNear', 'unitPower', 'unitCost', 'unitBase', 'blocker', 'unitGear', 'stealsTwo', 'goSolo', 'spentRisk', 'hand', 'eddie', 'faceUpLegend', 'legendGear', 'lowDeck', 'plan', 'exposed', 'threat', 'rivalLethal'] as const satisfies readonly (keyof EvalWeights)[];
export type EvalTerm = (typeof EVAL_TERMS)[number];

export interface EvalBreakdown {
  /** exactly evaluate(g, p, w) */
  total: number;
  /** a finished game: total is ±win or 0 and every feature is 0 */
  terminal: boolean;
  /**
   * The unweighted value of each term from p's view (ours minus the rival's). The next-turn features are computed even
   * when their weights are 0 (evaluate() then skips them); they and `spentRisk` are measured with the gig and unit
   * weights of `w`.
   */
  features: Record<EvalTerm, number>;
  /** the package terms' contribution (0 unless a package weight is set) */
  packages: number;
}

/** evaluate() with its per-term features (INFO-4): total is evaluate()'s result exactly, and Σ w × feature + packages equals it up to rounding. */
export function evaluateTerms(g: Game, p: PlayerId, w: EvalWeights = DEFAULT_WEIGHTS): EvalBreakdown {
  const acc: TermAcc = { f: Object.fromEntries(EVAL_TERMS.map((k) => [k, 0])) as Record<EvalTerm, number>, packages: 0 };
  const total = evalCore(g, p, w, acc);
  return { total, terminal: g.s.winner !== null, features: acc.f, packages: acc.packages };
}

interface TermAcc {
  f: Record<EvalTerm, number>;
  packages: number;
}

/** evaluate()'s arithmetic, unchanged; with `acc` it also records the features (never changing the value). */
function evalCore(g: Game, p: PlayerId, w: EvalWeights, acc: TermAcc | null): number {
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
  const f = acc?.f;
  if (f) {
    f.gig = (myG - rG) * (s.overtime ? 2 : 1);
    f.gigNear = Math.max(0, myG - 5) - Math.max(0, rG - 5);
  }
  for (const pl of [p, r] as PlayerId[]) {
    const sign = pl === p ? 1 : -1;
    let side = 0;
    for (const c of g.units(pl)) {
      let uv = unitValue(g, c, w);
      const risk = c.spent && pl === s.active && atRisk(g, c);
      if (f) unitFeatures(g, c, sign, risk ? uv : 0, f);
      if (risk) uv *= 1 - w.spentRisk;
      side += uv;
    }
    const P = g.P(pl);
    side += Math.min(P.hand.length, w.handCap) * w.hand;
    side += Math.min(P.eddies.length, w.eddieCap) * w.eddie;
    const faceUp = P.legends.filter((u) => g.c(u).faceUp).length;
    side += faceUp * w.faceUpLegend;
    // legends also gear hosts
    for (const u of P.legends) side += g.c(u).gear.length * w.legendGear;
    if (P.deck.length < w.lowDeckAt) side -= (w.lowDeckAt - P.deck.length) * w.lowDeck;
    const plan = planScore(g.gigsOf(pl), planFor(g, pl, p));
    side += plan * w.plan;
    v += sign * side;
    if (f) {
      f.hand += sign * Math.min(P.hand.length, w.handCap);
      f.eddie += sign * Math.min(P.eddies.length, w.eddieCap);
      f.faceUpLegend += sign * faceUp;
      for (const u of P.legends) f.legendGear += sign * g.c(u).gear.length;
      if (P.deck.length < w.lowDeckAt) f.lowDeck -= sign * (w.lowDeckAt - P.deck.length);
      f.plan += sign * plan;
    }
  }
  // own packages only: the rival's list is not known to p
  if (w.pkgAssembly !== 0 || w.pkgSteer !== 0 || w.pkgProtect !== 0) {
    const pk = packageTerms(g, p, w);
    v += pk;
    if (acc) acc.packages = pk;
  }
  if (w.exposed !== 0 || w.threat !== 0 || w.rivalLethal !== 0) v += nextTurnTerms(g, p, w);
  if (f) nextTurnFeatures(g, p, w, f);
  return v;
}

/** One Unit's unit features (unitValue's terms without weights), signed; `atRiskValue` is its value when the spent-risk discount applies. */
function unitFeatures(g: Game, c: CardInst, sign: number, atRiskValue: number, f: Record<EvalTerm, number>) {
  const pw = evalPower(g, c);
  f.unitPower += sign * pw;
  f.unitCost += sign * (g.def(c).cost ?? 4);
  f.unitBase += sign;
  if (g.hasKw(c, 'blocker')) f.blocker += sign;
  f.unitGear += sign * c.gear.length;
  if (pw >= 10) f.stealsTwo += sign;
  if (c.goSolo) f.goSolo += sign;
  f.spentRisk -= sign * atRiskValue;
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
 * now readies and has no lag by then (lag ends with every turn) unless an attack restriction bans it from attacking or
 * a "can't attack" lasts into that turn (BOT-C), and steals ⌊next turn's power/10⌋+1 (power mods that end before then
 * left out, BOT-B); each of def's Units that is ready now with Blocker stays ready through att's turn (Units ready only
 * at their controller's start) and stops one attack, taken to be the one stealing most. Capped at def's Gigs. Ignores
 * Units att will play (they lag), unblockable attackers and steal modifiers.
 */
export function stealableNextTurn(g: Game, att: PlayerId, def: PlayerId): number {
  const have = g.P(def).gigs.length;
  if (have === 0) return 0;
  const steals: number[] = [];
  for (const c of g.units(att)) {
    // a spent Unit stays spent through a "can't ready" that outlasts this turn and att's start
    if (c.spent && g.s.mods.some((m) => m.kind === 'cantReady' && m.target === c.uid && m.until !== 'endOfTurn' && !(m.until === 'startOfTurn' && m.untilPlayer === att))) continue;
    const pw = nextTurnPower(g, c, att);
    if (pw <= 0 || attackBanned(g, c, null)) continue;
    if (g.s.mods.some((m) => m.kind === 'cantAttack' && m.target === c.uid && !endsBefore(m, att))) continue;
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

/**
 * The features behind nextTurnTerms (INFO-4): nextTurnTerms(g, p, w) = exposed × f.exposed + threat × f.threat +
 * rivalLethal × f.rivalLethal, the Gig swings measured with w's gig weights. Computed whatever the three weights are.
 */
function nextTurnFeatures(g: Game, p: PlayerId, w: EvalWeights, f: Record<EvalTerm, number>) {
  const r = other(p);
  const next = nextTurnSeat(g);
  const myG = g.P(p).gigs.length;
  const rG = g.P(r).gigs.length;
  const ot = g.s.overtime;
  const base = gigTerm(myG, rG, ot, w);
  if (next === r) {
    const n = stealableNextTurn(g, r, p);
    if (n > 0) f.exposed = -(base - gigTerm(myG - n, rG + n, ot, w));
    if (rG >= 7 && !ot && (g.s.phase === 'end' || stealableThisTurn(g, p) < rG - 6)) f.rivalLethal = -1;
  } else {
    const n = stealableNextTurn(g, p, r);
    if (n > 0) f.threat = gigTerm(myG + n, rG - n, ot, w) - base;
  }
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
