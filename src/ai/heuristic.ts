// Lookahead bot. Main-phase actions: clone the game, play the action out (sub-choices by the
// fast policy), and score the result with evaluate(). Reactions: clone, apply the reaction, then
// project the fight/steal outcome statically and score it. Sub-choices (targets, gigs, modes,
// discards) use knowledge-driven heuristics.
import { GameOverSignal, other, type Game } from '../engine/engine';
import type { Action, Agent, CardInst, Decision, Gig, Opt, PlayerId, Reaction } from '../engine/types';
import { DEFAULT_WEIGHTS, evaluate, planFor, planScore, unitValue, type EvalWeights } from './eval';
import { cardValue, isSpendTriggerGear } from './knowledge';
import { shuffleInPlace } from '../engine/rng';
import { applyProfile, classify, DEFAULT_PROFILES, type Archetype, type Profiles } from './archetype';
import { knownCards } from './eval';
import { cardImpact } from './impact';

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
      let keep = cardValue(c.defId) + this.opts.impact * cardImpact(P.name, c.defId);
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
    if (!this.opts.lookahead) return this.fastMain(g, p, actions);
    // 2) lookahead over the rest
    const base = evaluate(g, p, this.w(g, p));
    let bestI = passIdx;
    let bestV = passIdx >= 0 ? base : -Infinity;
    const cands = actions
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.type !== 'pass' && a.type !== 'sell')
      .slice(0, this.opts.maxCandidates);
    // Face-down Legends are unknown to their owner: value an unknown Call as the average over unknown legends.
    const unknownCalls = cands.filter(({ a }) => a.type === 'call' && !g.c(a.uid).known);
    let unknownCallV: number | null = null;
    if (unknownCalls.length) {
      let sum = 0;
      for (const { a } of unknownCalls) sum += await this.simulate(g, p, a);
      unknownCallV = sum / unknownCalls.length;
    }
    const scored: { i: number; v: number }[] = [];
    if (passIdx >= 0) scored.push({ i: passIdx, v: base });
    for (const { a, i } of cands) {
      if (a.type === 'call' && !g.c(a.uid).known && a !== unknownCalls[0].a) continue;
      let v = a.type === 'call' && !g.c(a.uid).known ? unknownCallV! : await this.simulate(g, p, a);
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
        const dv = (await this.rollout(g, p, actions[t.i])) + t.v * 0.05;
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

  /** Cheap greedy policy used inside lookahead clones. */
  private fastMain(g: Game, p: PlayerId, actions: Action[]): number {
    let best = actions.findIndex((a) => a.type === 'pass');
    let bestScore = 0;
    actions.forEach((a, i) => {
      let s = 0;
      if (a.type === 'play') s = cardValue(g.c(a.uid).defId);
      else if (a.type === 'attack') {
        const att = g.c(a.uid);
        if (a.targetGigs !== null) s = 30;
        else if (a.targetUnit !== null) {
          const o = g.fightOutcome(a.uid, a.targetUnit);
          s = o.a === 'win' ? 12 + unitValue(g, g.c(a.targetUnit)) - 0 : -5;
        }
        if (g.power(att) === 0) s = -1;
      } else if (a.type === 'goSolo') s = 8;
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
    if (!this.opts.lookahead) return this.fastReaction(g, p, rx);
    if (this.opts.deepReactions > 0 && g.s.attack) return this.deepReaction(g, d, rx, endIdx);
    const baseV = this.projectAttack(g, p);
    let bestI = endIdx;
    let bestV = baseV;
    for (let i = 0; i < rx.length; i++) {
      if (i === endIdx) continue;
      const fast: [Agent, Agent] = [new HeuristicAgent({ lookahead: false }), new HeuristicAgent({ lookahead: false })];
      const cg = g.clone(fast);
      hideInfo(cg, p);
      let v: number;
      try {
        await cg.doReaction(p, rx[i]);
        await cg.resolvePending();
        v = this.projectAttack(cg, p);
      } catch (e) {
        if (!(e instanceof GameOverSignal)) throw e;
        v = evaluate(cg, p, this.w(g, p));
      }
      if (rx[i].type === 'call') v += 0.5; // using a reaction-time call is efficient
      if (v > bestV + 0.5) {
        bestV = v;
        bestI = i;
      }
    }
    this.lastThought = `${g.describeAction(rx[bestI])} (projected ${bestV.toFixed(1)} vs ${baseV.toFixed(1)})`;
    return bestI;
  }

  /** Reactions by rollout: resume the attack with each reaction, let the attacker finish, play our turn, evaluate. */
  private async deepReaction(g: Game, d: Decision, rx: Reaction[], endIdx: number): Promise<number> {
    const p = d.player;
    const attacker = g.s.attack!.attacker;
    const value = async (r: Reaction) => {
      let sum = 0;
      for (let k = 0; k < this.opts.deepReactions; k++) {
        const mk = () => new HeuristicAgent({ lookahead: true, deep: 0, maxCandidates: 14, weights: this.opts.weights, profiles: this.opts.profiles, seed: Math.floor(this.rand() * 1e9) });
        const cg = g.clone([mk(), mk()]);
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
      return sum / this.opts.deepReactions;
    };
    const baseV = endIdx >= 0 ? await value(rx[endIdx]) : -Infinity;
    let bestI = endIdx >= 0 ? endIdx : 0;
    let bestV = baseV;
    for (let i = 0; i < rx.length; i++) {
      if (i === endIdx) continue;
      const v = (await value(rx[i])) + (rx[i].type === 'call' ? 0.5 : 0);
      if (v > bestV + 0.5) {
        bestV = v;
        bestI = i;
      }
    }
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
      if (o.a === 'lose' && pt > 0 && !g.hasMod('noFightDefeat', att.uid) && !g.hasMod('noDefeatOpp', t.uid)) v += sign(att) * unitValue(g, att);
      if (o.b === 'lose' && pa > 0 && !g.hasMod('noFightDefeat', t.uid) && !g.hasMod('noDefeatOpp', att.uid)) v += sign(t) * unitValue(g, t);
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

  private fastReaction(g: Game, p: PlayerId, rx: Reaction[]): number {
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

  private yesNo(g: Game, d: Decision): boolean {
    const p = d.player;
    if (d.tag === 'mulligan') return this.wantsMulligan(g, p);
    if (d.tag === 'kerryReroll') {
      // reroll unless the gig already helps our plan
      return true;
    }
    return true;
  }

  wantsMulligan(g: Game, p: PlayerId): boolean {
    const hand = g.P(p).hand.map((u) => g.def(u));
    if (this.opts.impact) {
      // keep hands holding the deck's proven game-winners even if the curve is a bit off
      const winners = hand.filter((c) => cardImpact(g.P(p).name, c.id) >= 0.05).length;
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

  private chooseCardOpt(g: Game, d: Decision): number {
    const real = d.options.map((o, i) => ({ o, i })).filter(({ o }) => o.uid !== undefined);
    const none = d.options.findIndex((o) => o.key === 'none');
    if (!real.length) return Math.max(0, none);
    const p = d.player;
    const scored = real.map(({ o, i }) => {
      const c = g.c(o.uid!);
      let v = cardValue(c.defId) + this.opts.impact * cardImpact(g.P(p).name, c.defId);
      // prefer cards we can cast soon
      const cost = g.def(c).cost ?? 0;
      if (cost <= g.P(p).eddies.length + 3) v += 1.5;
      return { i, v, mine: c.owner === p };
    });
    const discardLike = d.tag === 'discard' || d.intent === 'harm' || /discard|trash|bottom/i.test(d.prompt);
    if (discardLike) {
      scored.sort((a, b) => a.v - b.v);
      return scored[0].i;
    }
    scored.sort((a, b) => b.v - a.v);
    return scored[0].i;
  }

  private chooseGigOpt(g: Game, d: Decision): number {
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
    if (d.tag === 'steal' || gigs.every(({ x }) => x.controller !== p)) {
      // pick the gig that most improves our plan minus the rival's
      const rPlan = planFor(g, other(p), p);
      let best = gigs[0].i;
      let bestV = -Infinity;
      for (const { x, i } of gigs) {
        const mineAfter = [...g.gigsOf(p), x];
        const theirsAfter = g.gigsOf(other(p)).filter((y) => y.id !== x.id);
        const v = planScore(mineAfter, myPlan) - planScore(theirsAfter, rPlan) + x.value * 0.05;
        if (v > bestV) {
          bestV = v;
          best = i;
        }
      }
      return best;
    }
    // generic: intent harm -> rival's best gig; help -> our best
    const mine = gigs.filter(({ x }) => x.controller === p);
    const pool = d.intent === 'harm' ? gigs.filter(({ x }) => x.controller !== p) : mine.length ? mine : gigs;
    (pool.length ? pool : gigs).sort((a, b) => b.x.value - a.x.value);
    return (pool.length ? pool : gigs)[0].i;
  }

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

/** In lookahead clones, the deciding player must not peek at hidden info: shuffle both decks. */
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
}
