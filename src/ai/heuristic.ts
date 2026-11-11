// Lookahead bot. Main-phase actions: clone the game, play the action out (sub-choices by the
// fast policy), and score the result with evaluate(). Reactions: clone, apply the reaction, then
// project the fight/steal outcome statically and score it. Sub-choices (targets, gigs, modes,
// discards) use knowledge-driven heuristics.
import { GameOverSignal, other, type Game } from '../engine/engine';
import type { Action, Agent, CardInst, Decision, Gig, Opt, PlayerId, Reaction } from '../engine/types';
import { DEFAULT_WEIGHTS, evaluate, knownCards, planFor, planScore, unitValue, type EvalWeights } from './eval';
import { cardValue, isSpendTriggerGear } from './knowledge';
import { shuffleInPlace } from '../engine/rng';
import { applyProfile, classify, type Archetype, type Profiles } from './archetype';
import { cardImpact } from './impact';

/**
 * How the bot treats each `chooseCard` tag used by the engine and the card scripts (read from the scripts, not from
 * prompt text):
 *   take     — the chosen card is gained or played (search, recursion, free plays, moving Gear): pick the best card.
 *   giveUp   — the chosen card is lost (discards, trashing or bottom-decking own cards): pick the least valuable card.
 *   blind    — the choice carries no information for the chooser (looking at an unknown face-down Legend): first option.
 *   target   — removal: on rival cards take the most valuable one, on own cards (paying a cost) the least valuable.
 * Unknown tags fall back to the intent: harm → target, otherwise take.
 */
export const CARD_TAG_POLICY: Record<string, 'take' | 'giveUp' | 'blind' | 'target'> = {
  search: 'take', // searchTop / millAndTake / Three Mouths / The Heist / Hacked Corpo / V Streetkid / Screw / Meredith Stout
  playFromTrash: 'take', // Alt Cunningham (Legend)
  freePlay: 'take', // Lizzy Wizzy
  playFree: 'take', // We Gotta Live Together, Yorinobu, River Ward, The Relic, Viktor Vektor
  moveGear: 'take', // Gear to move onto a friendly Unit
  discard: 'giveUp', // Game.discard (own or rival-forced) and Alt Cunningham's discard-to-prevent-a-steal
  trash: 'giveUp', // River Ward: trash 1 of the top 2 of your deck
  bottom: 'giveUp',
  bottomdeck: 'giveUp',
  look: 'blind', // Kiroshi Optics: look at a face-down Legend
  defeat: 'target', // Detonate
  defeatGear: 'target', // Heywood Ripperdoc (harm), Dum Dum / Gilded Maton (friendly Gear as a cost)
};

export interface HeuristicOptions {
  name?: string;
  lookahead?: boolean; // false = fast rule-based policy (used inside clones)
  weights?: EvalWeights;
  /** randomness 0..1 added to scores to diversify play (0 = deterministic) */
  noise?: number;
  /** max candidate actions to simulate per decision */
  maxCandidates?: number;
  /** turn-rollout depth: re-score the top N candidates by playing out the rest of the turn and the rival's reply */
  deep?: number;
  /** matchup play-style profiles (weight multipliers by my/rival archetype); null disables */
  profiles?: Profiles | null;
  /** weight of statistical card impact (telemetry IWD) in sell/discard/search/mulligan decisions; 0 = off */
  impact?: number;
  /** deep mode: also roll out the best N attack options, even if the 1-ply screen ranks them below the top `deep` */
  deepAttacks?: number;
  /** compare the N most sellable cards by rollout (or 1-ply) instead of always selling the lowest-scored one; 0 = off */
  sellLookahead?: number;
  /** deep mode: choose reactions (blocks, reaction calls/programs) by rolling the attack and both turns out, N rollouts each */
  deepReactions?: number;
  seed?: number;
}

export class HeuristicAgent implements Agent {
  name: string;
  opts: Required<HeuristicOptions>;
  private rng: number;
  /** last decision explanation (for UI "why did the bot do that") */
  lastThought = '';
  /** top alternatives of the last main-phase decision: value relative to passing (coach UI) */
  lastAlternatives: { index: number; label: string; delta: number }[] = [];

  constructor(opts: HeuristicOptions = {}) {
    this.opts = {
      name: opts.name ?? (opts.lookahead === false ? 'Fast bot' : opts.deep ? 'Deep bot' : 'Lookahead bot'),
      lookahead: opts.lookahead ?? true,
      weights: opts.weights ?? DEFAULT_WEIGHTS,
      noise: opts.noise ?? 0,
      maxCandidates: opts.maxCandidates ?? 40,
      deep: opts.deep ?? 0,
      profiles: opts.profiles === undefined ? null : opts.profiles,
      impact: opts.impact ?? 0,
      deepAttacks: opts.deepAttacks ?? 0,
      sellLookahead: opts.sellLookahead ?? 0,
      deepReactions: opts.deepReactions ?? 0,
      seed: opts.seed ?? 7,
    };
    this.name = this.opts.name;
    this.rng = this.opts.seed;
  }

  private myArch: Archetype | null = null;
  private oppArch: Archetype | null = null;
  /**
   * Read of the matchup. The rival's archetype is "scouted" from their whole deck, as you would know it
   * after game 1 of a Bo3 or from open decklists. Card-level hidden information is still respected.
   */
  matchupRead(g: Game, p: PlayerId): { me: Archetype; opp: Archetype } {
    if (!this.myArch) this.myArch = classify(knownCards(g, p, p)).arch;
    if (!this.oppArch) this.oppArch = classify(knownCards(g, other(p), other(p))).arch;
    return { me: this.myArch, opp: this.oppArch };
  }
  /** Evaluation weights adjusted for the current matchup. */
  w(g: Game, p: PlayerId): EvalWeights {
    if (!this.opts.profiles) return this.opts.weights;
    const { me, opp } = this.matchupRead(g, p);
    return applyProfile(this.opts.weights, this.opts.profiles, me, opp);
  }

  private rand() {
    this.rng = (this.rng * 1664525 + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }

  async decide(g: Game, d: Decision): Promise<number[]> {
    // explanations describe the latest main-phase action or reaction (sub-choices keep the move that caused them)
    if (d.kind === 'action' || d.kind === 'reaction') {
      this.lastThought = '';
      this.lastAlternatives = [];
    }
    switch (d.kind) {
      case 'action':
        return [await this.chooseMain(g, d)];
      case 'reaction':
        return [await this.chooseReaction(g, d)];
      case 'yesno':
        return [this.yesNo(g, d) ? 0 : 1];
      case 'unit':
        return [this.chooseUnitOpt(g, d)];
      case 'card':
        return [this.chooseCardOpt(g, d)];
      case 'gig':
        return [this.chooseGigOpt(g, d)];
      case 'gigValue':
        return [this.chooseGigValue(g, d)];
      case 'mode':
        return [this.chooseModeOpt(g, d)];
      default:
        if (d.max > 1) return d.options.map((_, i) => i).slice(0, d.max);
        return [0];
    }
  }

  // ------------------------------------------------------------------ main phase

  /** Which card to sell this turn (or null). Selling is the game's "land drop": do it every turn early. */
  private sellChoice(g: Game, p: PlayerId, actions: Action[]): number | null {
    return this.sellRanking(g, p, actions)[0] ?? null;
  }

  /** Sellable cards, least valuable to keep first (one per distinct card). Empty when the bot shouldn't sell now. */
  private sellRanking(g: Game, p: PlayerId, actions: Action[]): number[] {
    const sells = actions.filter((a) => a.type === 'sell') as { type: 'sell'; uid: number }[];
    if (!sells.length) return [];
    const P = g.P(p);
    const eddies = P.eddies.length;
    if (eddies >= 9) return [];
    if (P.hand.length <= 1 && eddies >= 5) return [];
    const avail = g.available(p);
    const counts = new Map<string, number>();
    for (const u of P.hand) counts.set(g.c(u).defId, (counts.get(g.c(u).defId) ?? 0) + 1);
    const scored: { uid: number; keep: number; def: string }[] = [];
    for (const s of sells) {
      const c = g.c(s.uid);
      const d = g.def(c);
      let keep = cardValue(c.defId) + this.opts.impact * cardImpact(P, c.defId);
      const cost = g.playCost(c.uid, p);
      if (cost <= avail + 1) keep += 3; // castable now / next turn
      if (cost > avail + 3) keep -= 3; // far off
      if ((counts.get(c.defId) ?? 0) > 1) keep -= 2;
      if (d.type === 'Gear' && g.gearHosts(p).length === 0) keep -= 2;
      scored.push({ uid: s.uid, keep, def: c.defId });
    }
    scored.sort((a, b) => a.keep - b.keep);
    const seen = new Set<string>();
    return scored.filter((x) => !seen.has(x.def) && seen.add(x.def)).map((x) => x.uid);
  }

  private async chooseMain(g: Game, d: Decision): Promise<number> {
    const p = d.player;
    const actions = d.options.map((o) => o.action as Action);
    const passIdx = actions.findIndex((a) => a.type === 'pass');
    // 1) sell first
    let sell = this.sellChoice(g, p, actions);
    // which card to sell: compare the few most sellable by playing them out (the "whether" stays rule-based)
    if (sell !== null && this.opts.sellLookahead > 1 && this.opts.lookahead) {
      const options = this.sellRanking(g, p, actions).slice(0, this.opts.sellLookahead);
      if (options.length > 1) {
        let bestV = -Infinity;
        for (const uid of options) {
          const a: Action = { type: 'sell', uid };
          const v = this.opts.deep > 0 ? await this.rollout(g, p, a) : await this.simulate(g, p, a);
          if (v > bestV + 0.01) {
            bestV = v;
            sell = uid;
          }
        }
      }
    }
    if (sell !== null) {
      this.lastThought = `Sell ${g.name(sell)} for an Eddie (economy first).`;
      this.lastAlternatives = [];
      return actions.findIndex((a) => a.type === 'sell' && a.uid === sell);
    }
    if (!this.opts.lookahead) return this.fastMain(g, actions);
    // 2) lookahead over the rest
    const base = evaluate(g, p, this.w(g, p));
    let bestI = passIdx;
    let bestV = passIdx >= 0 ? base : -Infinity;
    const all = actions.map((a, i) => ({ a, i })).filter(({ a }) => a.type !== 'pass' && a.type !== 'sell');
    // Face-down Legends are unknown to their owner: all unknown Calls are one candidate, valued as their average.
    const unknownCalls = all.filter(({ a }) => isUnknownCall(g, a));
    const cands = this.capCandidates(g, unknownCalls.length ? [...all.filter((x) => !isUnknownCall(g, x.a)), unknownCalls[0]] : all);
    let unknownCallV: number | null = null;
    if (unknownCalls.length && cands.includes(unknownCalls[0])) {
      let sum = 0;
      for (const { a } of unknownCalls) sum += await this.simulate(g, p, a);
      unknownCallV = sum / unknownCalls.length;
    }
    const scored: { i: number; v: number }[] = [];
    if (passIdx >= 0) scored.push({ i: passIdx, v: base });
    for (const { a, i } of cands) {
      let v = isUnknownCall(g, a) ? unknownCallV! : await this.simulate(g, p, a);
      // calling with spare mana at end of turn is fine, but prefer doing it on rival's turn as a reaction
      if (a.type === 'call') v -= 1.5;
      if (this.opts.noise) v += (this.rand() - 0.5) * this.opts.noise * 10;
      scored.push({ i, v });
      if (v > bestV + 0.01) {
        bestV = v;
        bestI = i;
      }
    }
    let deepScored: { i: number; v: number }[] | null = null;
    if (this.opts.deep > 0 && scored.length > 1) {
      // re-score the best few by rolling out the rest of this turn and the rival's whole reply
      scored.sort((x, y) => y.v - x.v);
      const top = scored.slice(0, this.opts.deep);
      if (passIdx >= 0 && !top.some((t) => t.i === passIdx)) top.push({ i: passIdx, v: base });
      // attacks are where the most value is lost: give the best few a full rollout even if the 1-ply screen ranks them lower
      if (this.opts.deepAttacks > 0)
        for (const t of scored.filter((x) => actions[x.i].type === 'attack').slice(0, this.opts.deepAttacks)) if (!top.some((y) => y.i === t.i)) top.push(t);
      let bestDeep = -Infinity;
      deepScored = [];
      for (const t of top) {
        // an unknown Call stands for every unknown slot: average the rollouts over them
        const group = isUnknownCall(g, actions[t.i]) ? unknownCalls.map((x) => x.a) : [actions[t.i]];
        let sum = 0;
        for (const a of group) sum += await this.rollout(g, p, a);
        const dv = sum / group.length + t.v * 0.05;
        deepScored.push({ i: t.i, v: dv });
        if (dv > bestDeep) {
          bestDeep = dv;
          bestI = t.i;
          bestV = dv;
        }
      }
    }
    if (bestI < 0) bestI = 0;
    this.lastThought = `${g.describeAction(actions[bestI])} (eval ${bestV.toFixed(1)} vs pass ${base.toFixed(1)})`;
    // Alternatives on the scale the decision was actually made on (deep rollouts when used), relative to passing.
    const pool = deepScored ?? scored;
    const passV = pool.find((x) => x.i === passIdx)?.v ?? base;
    this.lastAlternatives = [...pool]
      .sort((x, y) => y.v - x.v)
      .slice(0, 4)
      .map((x) => ({ index: x.i, label: g.describeAction(actions[x.i]), delta: x.v - passV }));
    return bestI;
  }

  /** Clone, perform an action with fast policies, return evaluation. */
  async simulate(g: Game, p: PlayerId, a: Action): Promise<number> {
    const fast: [Agent, Agent] = [new HeuristicAgent({ lookahead: false }), new HeuristicAgent({ lookahead: false })];
    const cg = g.clone(fast);
    hideInfo(cg, p);
    try {
      await cg.doAction(p, a);
      await cg.resolvePending();
      cg.checkState();
    } catch (e) {
      if (!(e instanceof GameOverSignal)) throw e;
    }
    return evaluate(cg, p, this.w(g, p));
  }

  /** Play the action, finish our turn with a 1-ply bot, then let a 1-ply rival take its full turn; evaluate. */
  async rollout(g: Game, p: PlayerId, a: Action): Promise<number> {
    const mk = () => new HeuristicAgent({ lookahead: true, deep: 0, maxCandidates: 14, weights: this.opts.weights, profiles: this.opts.profiles });
    const cg = g.clone([mk(), mk()]);
    hideInfo(cg, p);
    try {
      if (a.type !== 'pass') {
        await cg.doAction(p, a);
        await cg.resolvePending();
        cg.checkState();
        await cg.mainLoop();
      }
      await cg.endPhase();
      await cg.startPhase();
      await cg.mainLoop();
      await cg.endPhase();
    } catch (e) {
      if (!(e instanceof GameOverSignal)) throw e;
    }
    return evaluate(cg, p, this.w(g, p));
  }

  /**
   * Keep at most maxCandidates actions for lookahead without silently dropping attacks: the best attack of every
   * attacker is kept first, then the rest by the fast policy's score. Order of the survivors is unchanged.
   */
  capCandidates<T extends { a: Action; i: number }>(g: Game, pool: T[]): T[] {
    const max = this.opts.maxCandidates;
    if (pool.length <= max) return pool;
    const pr = pool.map((x) => ({ x, s: fastPrior(g, x.a) }));
    const keep = new Set<T>();
    const bestAtt = new Map<number, { x: T; s: number }>();
    for (const y of pr) {
      if (y.x.a.type !== 'attack') continue;
      const cur = bestAtt.get(y.x.a.uid);
      if (!cur || y.s > cur.s) bestAtt.set(y.x.a.uid, y);
    }
    for (const y of [...bestAtt.values()].sort((a, b) => b.s - a.s)) if (keep.size < max) keep.add(y.x);
    for (const y of [...pr].sort((a, b) => b.s - a.s || a.x.i - b.x.i)) {
      if (keep.size >= max) break;
      keep.add(y.x);
    }
    return pool.filter((x) => keep.has(x));
  }

  /** Cheap greedy policy used inside lookahead clones. */
  private fastMain(g: Game, actions: Action[]): number {
    let best = actions.findIndex((a) => a.type === 'pass');
    let bestScore = 0;
    actions.forEach((a, i) => {
      const s = a.type === 'play' || a.type === 'attack' || a.type === 'goSolo' || a.type === 'playLegend' ? fastPrior(g, a) : 0;
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    });
    return best < 0 ? 0 : best;
  }

  // ------------------------------------------------------------------ reactions

  private async chooseReaction(g: Game, d: Decision): Promise<number> {
    const p = d.player;
    const rx = d.options.map((o) => o.action as Reaction);
    const endIdx = rx.findIndex((r) => r.type === 'endReact');
    if (!this.opts.lookahead) return this.fastReaction(g, rx);
    if (this.opts.deepReactions > 0 && g.s.attack) return this.deepReaction(g, d, rx, endIdx);
    const baseV = this.projectAttack(g, p);
    const value = async (r: Reaction) => {
      const fast: [Agent, Agent] = [new HeuristicAgent({ lookahead: false }), new HeuristicAgent({ lookahead: false })];
      const cg = g.clone(fast);
      hideInfo(cg, p);
      try {
        await cg.doReaction(p, r);
        await cg.resolvePending();
        return this.projectAttack(cg, p);
      } catch (e) {
        if (!(e instanceof GameOverSignal)) throw e;
        return evaluate(cg, p, this.w(g, p));
      }
    };
    const { bestI, bestV } = await pickReaction(g, rx, endIdx, baseV, value);
    this.lastThought = `${g.describeAction(rx[bestI])} (projected ${bestV.toFixed(1)} vs ${baseV.toFixed(1)})`;
    return bestI;
  }

  /** Reactions by rollout: resume the attack with each reaction, let the attacker finish, play our turn, evaluate. */
  private async deepReaction(g: Game, d: Decision, rx: Reaction[], endIdx: number): Promise<number> {
    const p = d.player;
    const attacker = g.s.attack!.attacker;
    // one random world per rollout (hidden-information deal, dice), shared by every candidate: common random numbers
    const worlds = Array.from({ length: this.opts.deepReactions }, () => ({
      rng: Math.floor(this.rand() * 2 ** 31),
      a: Math.floor(this.rand() * 1e9),
      b: Math.floor(this.rand() * 1e9),
    }));
    const value = async (r: Reaction) => {
      let sum = 0;
      for (const w of worlds) {
        const mk = (seed: number) => new HeuristicAgent({ lookahead: true, deep: 0, maxCandidates: 14, weights: this.opts.weights, profiles: this.opts.profiles, seed });
        const cg = g.clone([mk(w.a), mk(w.b)]);
        cg.s.rng = w.rng;
        hideInfo(cg, p);
        try {
          if (r.type === 'endReact') await cg.attackRest(attacker, true);
          else {
            await cg.doReaction(p, r);
            await cg.resolvePending();
            await cg.attackRest(attacker);
          }
          cg.checkState();
          await cg.mainLoop();
          await cg.endPhase();
          await cg.startPhase();
          await cg.mainLoop();
          await cg.endPhase();
        } catch (e) {
          if (!(e instanceof GameOverSignal)) throw e;
        }
        sum += Math.max(-600, Math.min(600, evaluate(cg, p, this.w(g, p))));
      }
      return sum / worlds.length;
    };
    const baseV = endIdx >= 0 ? await value(rx[endIdx]) : -Infinity;
    const { bestI, bestV } = await pickReaction(g, rx, endIdx, baseV, value);
    this.lastThought = `${g.describeAction(rx[bestI])} (projected ${bestV.toFixed(1)} vs ${baseV.toFixed(1)})`;
    return bestI;
  }

  /** Evaluate the position as if the current attack resolved right now (static projection). */
  projectAttack(g: Game, p: PlayerId): number {
    const a = g.s.attack;
    if (!a || !g.attackValid()) return evaluate(g, p, this.w(g, p));
    const base = evaluate(g, p, this.w(g, p));
    const att = g.c(a.attacker);
    if (a.targetUnit !== null) {
      const t = g.c(a.targetUnit);
      const o = g.fightOutcome(att.uid, t.uid);
      const pa = g.power(att);
      const pt = g.power(t);
      let v = base;
      const sign = (c: CardInst) => (c.controller === p ? -1 : 1);
      if (o.a === 'lose' && pt > 0 && !g.hasMod('noFightDefeat', att.uid) && !g.noDefeatOppMod(t.uid)) v += sign(att) * unitValue(g, att);
      if (o.b === 'lose' && pa > 0 && !g.hasMod('noFightDefeat', t.uid) && !g.noDefeatOppMod(att.uid)) v += sign(t) * unitValue(g, t);
      return v;
    }
    const n = Math.min(g.stealCount(att), g.P(a.targetGigs!).gigs.length);
    const w = this.w(g, p);
    // stealing n gigs: swing of 2*gig weight each for the defender
    const mine = g.P(p).gigs.length;
    let penalty = n * w.gig * 2;
    if (g.P(att.controller).gigs.length + n >= 6) penalty += w.gigNear * n;
    if (mine - n < 2) penalty += 10;
    return base - (att.controller === p ? -penalty : penalty);
  }

  private fastReaction(g: Game, rx: Reaction[]): number {
    const a = g.s.attack!;
    const att = g.c(a.attacker);
    const pa = g.power(att);
    let best = rx.findIndex((r) => r.type === 'endReact');
    let bestS = 0;
    rx.forEach((r, i) => {
      let s = 0;
      if (r.type === 'block') {
        const b = g.c(r.uid);
        const pb = g.power(b);
        if (pb > pa) s = 20;
        else if (a.targetGigs !== null && pb === pa) s = 10;
        else if (a.targetGigs !== null && unitValue(g, b) < 25) s = 6;
      } else if (r.type === 'call') s = 3;
      if (s > bestS) {
        bestS = s;
        best = i;
      }
    });
    return best < 0 ? 0 : best;
  }

  // ------------------------------------------------------------------ sub-choices

  /**
   * Yes/no prompts, by tag (every yes/no tag in the card scripts):
   *   mulligan · kerryReroll · replaceDefeat (Jackie) · trashTop (Tetratronic Rippler) · draw (Shattered Memories) ·
   *   discardFor (Maman Brigitte) · pay (El Sombrerón) · addToHand / freePlay / playFree / call (pure gains: yes).
   */
  yesNo(g: Game, d: Decision): boolean {
    const p = d.player;
    const w = this.w(g, p);
    switch (d.tag) {
      case 'mulligan':
        return this.wantsMulligan(g, p);
      case 'kerryReroll':
        return this.wantsReroll(g, p, d, w);
      case 'replaceDefeat':
        return this.wantsJackieSwap(g, p, d, w);
      case 'trashTop': {
        // trash the revealed top card when it is worse than an average card left in the deck (and the deck isn't short)
        const deck = g.P(p).deck;
        if (deck.length <= 8) return false;
        const avg = deck.slice(1).reduce((a, u) => a + cardValue(g.c(u).defId), 0) / (deck.length - 1);
        return cardValue(g.c(deck[0]).defId) < avg - 0.5;
      }
      case 'draw': {
        // Shattered Memories: drawing 5 from a deck of fewer than 5 loses the game; keep a few cards in reserve too
        const left = g.P(p).deck.length;
        if (left < 5) return false;
        if (left >= 8) return true;
        return g.P(p).hand.length === 0 || Math.max(g.P(p).gigs.length, g.P(other(p)).gigs.length) >= 5;
      }
      case 'discardFor': {
        // Maman Brigitte: two Programs from hand for bottom-decking the rival's best unequipped Unit
        const targets = g.units(other(p)).filter((c) => c.gear.length === 0);
        const best = Math.max(0, ...targets.map((c) => unitValue(g, c, w)));
        return best > 2 * w.hand;
      }
      case 'pay':
        return this.wantsSombreron(g, p, d);
      default:
        // addToHand, freePlay, playFree, call: free card advantage or a free play
        return true;
    }
  }

  /** Kerry Eurodyne: reroll a Fixer-rolled Gig when the expected roll (plan fit + min/max draws) beats the current one. */
  private wantsReroll(g: Game, p: PlayerId, d: Decision, w: EvalWeights): boolean {
    const plan = planFor(g, p, p);
    const gigs = g.gigsOf(p);
    // the Gig just rolled in from the Fixer is the newest friendly Gig (the engine appends it before the trigger)
    const gig = gigs[gigs.length - 1];
    if (!gig || d.source === undefined) return false;
    const score = (v: number) => {
      const view = gigs.map((x) => (x.id === gig.id ? ({ ...x, value: v } as Gig) : x));
      const draws = v === 1 || v === gig.sides ? (gig.sides === 20 ? 3 : 1) : 0;
      return planScore(view, plan) * w.plan + draws * w.hand;
    };
    let mean = 0;
    for (let v = 1; v <= gig.sides; v++) mean += score(v);
    mean /= gig.sides;
    return mean > score(gig.value) + 0.25;
  }

  /** Jackie Welles: pay 1 €$ and lose Jackie instead of the Unit about to be defeated, when that Unit is worth more. */
  private wantsJackieSwap(g: Game, p: PlayerId, d: Decision, w: EvalWeights): boolean {
    if (d.source === undefined) return false;
    const jackie = g.c(d.source);
    const others = g.units(p).filter((c) => c.uid !== jackie.uid);
    // the victim: our Unit in the current fight, else the friendly Unit the prompt names
    const att = g.s.attack;
    const victim =
      others.find((c) => att && (att.attacker === c.uid || att.targetUnit === c.uid)) ?? others.find((c) => d.prompt.includes(`instead of ${g.name(c)}?`));
    if (!victim) return false;
    // a face-up Legend is worth more than its body: it stays useful (Go Solo, gear host) every turn
    const jackieV = unitValue(g, jackie, w) + (jackie.zone === 'legends' ? w.faceUpLegend + 6 : 0);
    return unitValue(g, victim, w) > jackieV + w.eddie;
  }

  /** El Sombrerón: pay 2 €$ for +max-Gig power only when the extra power changes the attack's outcome. */
  private wantsSombreron(g: Game, p: PlayerId, d: Decision): boolean {
    const att = g.s.attack;
    if (!att || d.source === undefined) return false;
    const host = g.c(att.attacker);
    const gain = Math.max(0, ...g.gigsOf(p).filter((x) => g.isMaxGig(x)).map((x) => x.value));
    const pa = g.power(host);
    const after = pa + gain;
    if (att.targetUnit !== null) {
      const pt = g.power(g.c(att.targetUnit));
      return pt >= pa && pt < after;
    }
    // Gig attack: reaching 10 steals a second Gig, or beating a ready rival blocker that could redirect the attack
    if (pa < 10 && after >= 10) return true;
    return g.units(other(p)).some((c) => !c.spent && g.hasKw(c, 'blocker') && g.power(c) >= pa && g.power(c) < after);
  }

  wantsMulligan(g: Game, p: PlayerId): boolean {
    const hand = g.P(p).hand.map((u) => g.def(u));
    if (this.opts.impact) {
      // keep hands holding the deck's proven game-winners even if the curve is a bit off
      const winners = hand.filter((c) => cardImpact(g.P(p), c.id) >= 0.05).length;
      const cheapAny = hand.filter((c) => (c.cost ?? 9) <= 4).length;
      if (winners >= 2 && cheapAny >= 2) return false;
    }
    const cheapUnits = hand.filter((c) => c.type === 'Unit' && (c.cost ?? 9) <= 4).length;
    const cheap = hand.filter((c) => (c.cost ?? 9) <= 4).length;
    const sellable = hand.filter((c) => c.sellable).length;
    return !(cheapUnits >= 1 && cheap >= 3 && sellable >= 1);
  }

  private threat(g: Game, c: CardInst): number {
    let v = unitValue(g, c);
    if (!c.spent) v += 2; // ready units can attack/block
    return v;
  }

  private chooseUnitOpt(g: Game, d: Decision): number {
    const p = d.player;
    const opts = d.options;
    const real = opts.map((o, i) => ({ o, i })).filter(({ o }) => o.uid !== undefined);
    const none = opts.findIndex((o) => o.key === 'none');
    if (!real.length) return Math.max(0, none);
    const units = real.map(({ o, i }) => ({ c: g.c(o.uid!), i }));
    if (d.tag === 'equip') {
      const gearId = d.source !== undefined ? g.c(d.source).defId : '';
      if (isSpendTriggerGear(gearId)) {
        const leg = units.find(({ c }) => c.zone === 'legends');
        if (leg) return leg.i;
      }
      const field = units.filter(({ c }) => c.zone === 'field');
      const pool = field.length ? field : units;
      pool.sort((a, b) => Number(a.c.lag) - Number(b.c.lag) || Number(a.c.spent) - Number(b.c.spent) || g.power(b.c) - g.power(a.c));
      return pool[0].i;
    }
    if (d.tag === 'call') {
      // only known face-down legends can be chosen on purpose; otherwise it's a blind pick
      const known = units.filter(({ c }) => c.known);
      if (known.length) {
        known.sort((a, b) => cardValue(b.c.defId) - cardValue(a.c.defId));
        return known[0].i;
      }
      return units[0].i;
    }
    // own vs rival units
    const mine = units.filter(({ c }) => c.controller === p);
    const theirs = units.filter(({ c }) => c.controller !== p);
    if (d.tag === 'adrenaline' || d.tag === 'lagAttack') {
      // "may attack this turn" only helps a ready Unit that is lagging and couldn't otherwise attack (what it may attack)
      const wants: ('units' | 'gigs' | null)[] = d.tag === 'adrenaline' ? ['units', 'gigs', null] : ['gigs', null];
      const lagging = mine.filter(({ c }) => {
        const perm = g.lagPermission(c);
        return c.lag && !c.spent && perm !== 'any' && wants.includes(perm);
      });
      if (lagging.length) {
        lagging.sort((a, b) => g.power(b.c) - g.power(a.c));
        return lagging[0].i;
      }
    }
    let intent = d.intent;
    if (!intent) intent = theirs.length && !mine.length ? 'harm' : 'help';
    if (intent === 'harm') {
      const pool = theirs.length ? theirs : units;
      if (theirs.length === 0 && none >= 0) return none; // don't hurt ourselves if optional
      pool.sort((a, b) => this.threat(g, b.c) - this.threat(g, a.c));
      // prefer harming the rival's unit; if forced to pick own, pick our weakest
      if (!theirs.length) {
        pool.sort((a, b) => this.threat(g, a.c) - this.threat(g, b.c));
      }
      return pool[0].i;
    }
    const pool = mine.length ? mine : units;
    // help: prefer the unit that's about to fight/attack, else biggest ready
    const att = g.s.attack;
    const inFight = pool.find(({ c }) => att && (att.attacker === c.uid || att.targetUnit === c.uid));
    if (inFight) return inFight.i;
    pool.sort((a, b) => Number(a.c.spent) - Number(b.c.spent) || g.power(b.c) - g.power(a.c));
    return pool[0].i;
  }

  /** Card choices, by tag (see CARD_TAG_POLICY), never by prompt text. */
  chooseCardOpt(g: Game, d: Decision): number {
    const real = d.options.map((o, i) => ({ o, i })).filter(({ o }) => o.uid !== undefined);
    const none = d.options.findIndex((o) => o.key === 'none');
    if (!real.length) return Math.max(0, none);
    const p = d.player;
    const policy = CARD_TAG_POLICY[d.tag ?? ''] ?? (d.intent === 'harm' ? 'target' : 'take');
    if (policy === 'blind') return real[0].i;
    const scored = real.map(({ o, i }) => {
      const c = g.c(o.uid!);
      const mine = c.controller === p;
      // impact telemetry is per deck: a rival card is valued for the rival's deck
      let v = cardValue(c.defId) + this.opts.impact * cardImpact(g.P(c.controller), c.defId);
      // prefer keeping / getting cards we can cast soon
      const cost = g.def(c).cost ?? 0;
      if (mine && cost <= g.P(p).eddies.length + 3) v += 1.5;
      return { i, v, mine };
    });
    const best = (xs: typeof scored) => [...xs].sort((a, b) => b.v - a.v || a.i - b.i)[0].i;
    const worst = (xs: typeof scored) => [...xs].sort((a, b) => a.v - b.v || a.i - b.i)[0].i;
    if (policy === 'take') return best(scored);
    if (policy === 'giveUp') return worst(scored);
    // target: hit the rival's most valuable card; only pay with our own when there is nothing else (and it's forced)
    const theirs = scored.filter((x) => !x.mine);
    if (theirs.length) return best(theirs);
    if (d.intent === 'harm' && none >= 0) return none;
    return worst(scored);
  }

  chooseGigOpt(g: Game, d: Decision): number {
    const p = d.player;
    const real = d.options.map((o, i) => ({ o, i })).filter(({ o }) => o.gig !== undefined);
    const none = d.options.findIndex((o) => o.key === 'none');
    if (!real.length) return Math.max(0, none);
    const gigs = real.map(({ o, i }) => ({ x: g.gig(o.gig!), i }));
    const myPlan = planFor(g, p, p);
    if (d.tag === 'rollIn') {
      // high plans roll big dice early; low plans roll small dice (better min odds); default: big dice
      const wantSmall = myPlan.low > myPlan.high + 0.2;
      gigs.sort((a, b) => (wantSmall ? a.x.sides - b.x.sides : b.x.sides - a.x.sides));
      return gigs[0].i;
    }
    const rPlan = planFor(g, other(p), p);
    /** our plan score minus the rival's, with `give` moved to the rival and `take` moved to us */
    const swing = (give: Gig | null, take: Gig | null) => {
      const mineAfter = g.gigsOf(p).filter((y) => y.id !== give?.id);
      const theirsAfter = g.gigsOf(other(p)).filter((y) => y.id !== take?.id);
      if (take) mineAfter.push(take);
      if (give) theirsAfter.push(give);
      return planScore(mineAfter, myPlan) - planScore(theirsAfter, rPlan);
    };
    const argmax = <T>(xs: T[], f: (x: T) => number) => {
      let best = xs[0];
      let bestV = -Infinity;
      for (const x of xs) {
        const v = f(x);
        if (v > bestV) (bestV = v), (best = x);
      }
      return { best, v: bestV };
    };
    if (d.tag === 'steal') {
      // pick the gig that most improves our plan minus the rival's
      return argmax(gigs, ({ x }) => swing(null, x) + x.value * 0.05).best.i;
    }
    if (d.tag === 'swapGive') {
      // Hanako / MaxTac AV: choose the (give, take) pair with the best swing; decline an optional swap that doesn't gain
      const theirs = g.gigsOf(other(p));
      let best: { i: number; take: number; v: number } | null = null;
      for (const { x, i } of gigs) {
        if (x.controller !== p) continue;
        for (const y of theirs) {
          const v = swing(x, y);
          if (!best || v > best.v + 1e-9) best = { i, take: y.id, v };
        }
      }
      if (!best) return Math.max(0, none);
      if (none >= 0 && best.v <= swing(null, null) + 0.05) return none;
      this.pendingSwapTake = best.take;
      return best.i;
    }
    if (d.tag === 'swapTake') {
      const planned = gigs.find(({ x }) => x.id === this.pendingSwapTake);
      this.pendingSwapTake = null;
      if (planned) return planned.i;
      return argmax(gigs, ({ x }) => swing(null, x)).best.i;
    }
    // generic: intent harm -> the rival's Gig that matters most to them; help -> our best
    const mine = gigs.filter(({ x }) => x.controller === p);
    const rivals = gigs.filter(({ x }) => x.controller !== p);
    if (d.intent === 'harm' && rivals.length) {
      const theirs = g.gigsOf(other(p));
      const full = planScore(theirs, rPlan);
      return argmax(rivals, ({ x }) => full - planScore(theirs.filter((y) => y.id !== x.id), rPlan)).best.i;
    }
    const pool = mine.length ? mine : gigs;
    return argmax(pool, ({ x }) => x.value).best.i;
  }

  /** Rival Gig picked together with the friendly Gig given in a swap (the engine asks for the two separately). */
  private pendingSwapTake: number | null = null;

  /** Pick (gig, newValue) maximizing our plan score minus rival's. */
  private chooseGigValue(g: Game, d: Decision): number {
    const p = d.player;
    const myPlan = planFor(g, p, p);
    const rPlan = planFor(g, other(p), p);
    const score = (override?: { gig: number; n: number }) => {
      const view = (pl: PlayerId) =>
        g.gigsOf(pl).map((x) => (override && x.id === override.gig ? ({ ...x, value: override.n } as Gig) : x));
      return planScore(view(p), myPlan) - planScore(view(other(p)), rPlan);
    };
    let bestI = d.options.findIndex((o) => o.key === 'none');
    let bestV = score();
    d.options.forEach((o: Opt, i) => {
      if (o.gig === undefined) return;
      const v = score({ gig: o.gig, n: o.n! });
      if (v > bestV + 1e-6) {
        bestV = v;
        bestI = i;
      }
    });
    return bestI < 0 ? 0 : bestI;
  }

  private chooseModeOpt(g: Game, d: Decision): number {
    const p = d.player;
    const rivalUnits = g.units(other(p));
    const myUnits = g.units(p);
    const rivalReady = rivalUnits.filter((c) => !c.spent);
    const scoreLabel = (label: string): number => {
      let s = 1;
      const m = label.match(/Draw (\d)/i);
      if (m) s = Math.max(s, 3.5 * +m[1]);
      if (/defeat|bottom-deck/i.test(label)) s = Math.max(s, rivalUnits.length ? 9 : 0);
      if (/can't attack/i.test(label)) s = Math.max(s, rivalReady.length ? 5 : 0.5);
      if (/spend a rival/i.test(label)) s = Math.max(s, rivalReady.length ? 6 : 0);
      if (/-\d power/i.test(label)) s = Math.max(s, rivalUnits.length ? 4 : 0);
      if (/\+\d power/i.test(label)) s = Math.max(s, myUnits.some((c) => !c.spent) || g.s.attack ? 4 : 1);
      if (/can't be defeated/i.test(label)) s = Math.max(s, g.s.attack ? 7 : 2);
      if (/attack ready/i.test(label)) s = Math.max(s, rivalReady.length ? 4 : 0);
      if (/Go Solo/i.test(label)) s = Math.max(s, g.P(p).legends.some((u) => g.c(u).faceUp && g.hasKw(u, 'goSolo')) ? 4 : 0);
      return s;
    };
    const scores = d.options.map((o) => scoreLabel(o.label));
    // when the rival chooses an effect for us, the rival picks the weaker one
    const harmful = d.tag === 'rivalChoice';
    let best = 0;
    scores.forEach((s, i) => {
      if (harmful ? s < scores[best] : s > scores[best]) best = i;
    });
    return best;
  }
}

/** A Call of a face-down Legend whose identity its controller doesn't know (every such Call looks the same). */
export function isUnknownCall(g: Game, a: Action | Reaction): boolean {
  return a.type === 'call' && !g.c(a.uid).known;
}

/** The fast policy's score of a main-phase action (also ranks candidates before the lookahead cap). */
function fastPrior(g: Game, a: Action): number {
  switch (a.type) {
    case 'play':
      return cardValue(g.c(a.uid).defId);
    case 'attack': {
      if (g.power(g.c(a.uid)) === 0) return -1;
      if (a.targetGigs !== null) return 30;
      if (a.targetUnit !== null) return g.fightOutcome(a.uid, a.targetUnit).a === 'win' ? 12 + unitValue(g, g.c(a.targetUnit)) : -5;
      return 0;
    }
    case 'goSolo':
      return 8;
    case 'playLegend':
      // the same Legend as Go Solo, but it enters with Lag (can't attack this turn) and keeps its orientation: rank it
      // below Go Solo so it only wins when Go Solo isn't offered (e.g. taxed by Riot Shield)
      return 6;
    case 'activate':
      return 6;
    case 'call':
      return 5;
    default:
      return 0;
  }
}

/**
 * Best reaction by `value`, keeping "no reaction" unless an option beats it by 0.5. Unknown Calls (face-down Legends
 * the defender can't tell apart) are one option valued as their average, so the choice never depends on which
 * face-down Legend is which; the first unknown slot is played.
 */
async function pickReaction(g: Game, rx: Reaction[], endIdx: number, baseV: number, value: (r: Reaction) => Promise<number>) {
  let bestI = endIdx >= 0 ? endIdx : 0;
  let bestV = baseV;
  const unknown = rx.map((r, i) => i).filter((i) => isUnknownCall(g, rx[i]));
  for (let i = 0; i < rx.length; i++) {
    if (i === endIdx) continue;
    let v: number;
    if (unknown.includes(i)) {
      if (i !== unknown[0]) continue;
      let sum = 0;
      for (const k of unknown) sum += await value(rx[k]);
      v = sum / unknown.length;
    } else v = await value(rx[i]);
    if (rx[i].type === 'call') v += 0.5; // using a reaction-time call is efficient
    if (v > bestV + 0.5) {
      bestV = v;
      bestI = i;
    }
  }
  return { bestI, bestV };
}

/**
 * In lookahead clones the deciding player must not peek at hidden information. Re-deals everything `viewer` can't see:
 * both decks are shuffled, the rival's hand is re-dealt from the rival's unseen cards (hand + deck), and the identities
 * of face-down Legends are permuted among the slots the viewer can't tell apart (own face-down Legends not looked at,
 * every rival face-down Legend). The viewer's own hand and every public zone are untouched.
 */
export function hideInfo(g: Game, viewer: PlayerId) {
  // deck order is unknown to everyone
  for (const pl of [0, 1] as PlayerId[]) shuffleInPlace(g.s, g.P(pl).deck);
  // the rival's hand is unknown: re-deal it from the rival's unseen cards (hand + deck)
  const r = other(viewer);
  const R = g.P(r);
  const n = R.hand.length;
  for (const u of R.hand) g.c(u).zone = 'deck';
  R.deck.push(...R.hand);
  R.hand = [];
  shuffleInPlace(g.s, R.deck);
  for (let i = 0; i < n; i++) g.drawRaw(r);
  // face-down Legends: the viewer knows which Legends are in each pool, not which slot holds which
  const permute = (uids: number[]) => {
    if (uids.length < 2) return;
    // sorted first, so the deal never depends on the true order
    const ids = shuffleInPlace(
      g.s,
      uids.map((u) => g.c(u).defId).sort(),
    );
    uids.forEach((u, k) => (g.c(u).defId = ids[k]));
  };
  permute(g.P(viewer).legends.filter((u) => !g.c(u).faceUp && !g.c(u).known));
  permute(R.legends.filter((u) => !g.c(u).faceUp));
}
