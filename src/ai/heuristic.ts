// Lookahead bot. Main-phase actions: clone the game, play the action out (sub-choices by the
// fast policy), and score the result with evaluate(). Reactions: clone, apply the reaction, then
// play the attack out (no further reactions) and score the result. Sub-choices (targets, gigs, modes,
// discards) use knowledge-driven heuristics.
import { GameOverSignal, other, type Game } from '../engine/engine';
import type { Action, Agent, CardInst, Decision, Gig, Opt, PlayerId, Reaction } from '../engine/types';
import { DEFAULT_WEIGHTS, evaluate, knownCards, planFor, planScore, unitValue, usesPackages, withoutPackages, type EvalWeights } from './eval';
import { makeWorlds, playOut, playOutValue, type World } from './playOut';
import { cardValue, isSpendTriggerGear } from './knowledge';
import { activeSteer, holdCredit, packageFacts, seatPackages, steerCredit, type SteerKind } from './packages';
import { shuffleInPlace } from '../engine/rng';
import { applyProfile, classify, type Archetype, type Profiles } from './archetype';
import { cardImpact } from './impact';
import { planTurn } from './turnPlan';
import type { MulliganRule } from './mulligan';
import { MAX_SCORED_OPTIONS, type ScoreRecord } from '../engine/telemetry';

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
  discardForNothing: 'target', // Placide with no rival Unit: an optional discard that gains nothing (intent harm: declined)
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
  /**
   * INFO-3 (measuring each use of card impact on its own): the impact weight in the sell ranking only. Default: `impact`,
   * exactly as before. (The mulligan use is switched off with `mulligan: 'plain'`.)
   */
  impactSell?: number;
  /** INFO-3: the impact weight in card choices (discard, search, take, target) only. Default: `impact`, exactly as before. */
  impactCards?: number;
  /** deep mode: also roll out the best N attack options, even if the 1-ply screen ranks them below the top `deep` */
  deepAttacks?: number;
  /** compare the N most sellable cards by rollout (or 1-ply) instead of always selling the lowest-scored one; 0 = off */
  sellLookahead?: number;
  /** deep mode: choose reactions (blocks, reaction calls/programs) by rolling the attack and both turns out, N rollouts each */
  deepReactions?: number;
  /**
   * sell lookahead only: a near-tie margin (eval points) within which the sell comparison keeps a scarce piece of the
   * player's own package (hold credit ¼ or more, src/ai/packages.ts) and sells another card instead. 0 = off: every bot
   * (results unchanged); the coach sets it (src/ai/coach.ts) so its advice breaks near-ties toward keeping the piece.
   */
  sellKeepScarce?: number;
  /**
   * BOT-1. Deep rollouts and deep reactions score the start-of-turn win the play-out stops just before (the seat about
   * to begin its turn holding 7+ Gigs, `nextStartResult` in playOut.ts) as a won or lost game, and main-phase rollouts
   * are clamped to ±playOutClamp like reactions. false (default) = the play-out scoring before BOT-1, exactly.
   */
  rolloutWins?: boolean;
  /**
   * BOT-2. Deep mode: score every rolled-out main-phase candidate as the mean over this many worlds (hidden-information
   * deal, dice, play-out bots' seeds) shared by all candidates, as deep reactions do. 0 or 1 (default) = one rollout per
   * candidate in the game's own random state, exactly as before.
   */
  deepWorlds?: number;
  /**
   * BOT-4. Deep mode: when the sell rule would sell, roll out "don't sell this turn" against the two most sellable cards
   * (the same rollout as deep candidates, over shared worlds when deepWorlds > 1) and take the best; after choosing not
   * to sell, the bot doesn't sell again that turn. Takes precedence over sellLookahead. false (default) = the rule
   * decides whether to sell, exactly as before. Needs deep > 0 (ignored otherwise).
   */
  sellSearch?: boolean;
  /** Internal (sellSearch's "don't sell" play-outs): never sell on this turn number. -1 (default) = off. */
  noSellTurn?: number;
  /**
   * BOT-5. Main phase: value each candidate by the best sequence of our own actions for the rest of this turn that starts
   * with it, searched up to this many actions deep (src/ai/turnPlan.ts), instead of by the position right after it. The
   * deep rollouts (deep > 0) then re-score the top candidates as before. 0 or 1 (default) = the 1-ply screen, exactly as before.
   */
  turnPlan?: number;
  /** turnPlan: most nodes (clone + action) searched per decision (default 120) */
  turnPlanNodes?: number;
  /** turnPlan: positions expanded per level from depth 3 on (default 3) */
  turnPlanBeam?: number;
  /**
   * BOT-6. The opening-hand rule (src/ai/mulligan.ts): 'rule' (default) = the rule every bot used before, exactly;
   * 'plain' drops the card-impact keep (2+ high-impact cards), which only bots with `impact` use.
   */
  mulligan?: MulliganRule;
  seed?: number;
}

/** One entry of HeuristicAgent.lastAlternatives. */
export interface Alternative {
  index: number;
  label: string;
  /** value relative to passing, on the scale the decision was made on */
  delta: number;
  /** deepWorlds > 1 only: the standard error of this candidate's mean over the worlds */
  se?: number;
  /** deepWorlds > 1 only: the paired standard error (same worlds) of this candidate's value minus the chosen one's; 0 for the chosen one */
  seDiff?: number;
}

/** One option the bot valued in its last decision (HeuristicAgent.lastScores). */
export interface ScoredOption {
  /** option index in the decision */
  i: number;
  /** the value the choice was made on (evaluation points; absolute, not relative to passing) */
  v: number;
  /** main phase: the 1-ply screen value (its noise and Call penalty included) */
  ply?: number;
  /** shared worlds only: the rollout value in each world, before `off` */
  w?: number[];
  /** shared worlds only: added to every world's value to give `v` (5% of the 1-ply value, or a reaction Call's bonus) */
  off?: number;
}

/**
 * Every option the bot valued in its last decision, on the scale it chose on (observe-only: telemetry and the coach's
 * grading read it; nothing in play does). `worlds` are the shared worlds of the rollouts, when there were any.
 */
export interface DecisionScores {
  /** main-phase lookahead, the sell comparison (sellLookahead), or a reaction */
  kind: 'main' | 'sell' | 'reaction';
  /** 'deep': rollouts (main-phase deep, deep reactions, sells compared by rollout); '1ply': one step evaluated */
  scale: 'deep' | '1ply';
  opts: ScoredOption[];
  chosen: number;
  /** deep main phase: every candidate's 1-ply screen value (option index → value) */
  screen?: { i: number; v: number }[];
  worlds?: World[];
  /** the decision these scores belong to */
  d: Decision;
}

/** Value of option `o` in world k (its rollout plus the constant the decision added); `v` without worlds. */
export const worldValue = (o: ScoredOption, k: number): number => (o.w ? o.w[k] + (o.off ?? 0) : o.v);

/**
 * The near-tie rule of HeuristicOptions.sellKeepScarce: when `sell` has hold credit ¼ or more, the compared option within
 * `margin` of the best value with the least hold credit (then the best value) is sold instead; null to keep `sell`.
 */
export function sellTieBreak(sell: number, vals: readonly { uid: number; v: number }[], bestV: number, margin: number, credit: (uid: number) => number): { uid: number; v: number } | null {
  const mine = credit(sell);
  if (margin <= 0 || mine < 0.25) return null;
  const near = vals.filter((x) => x.uid !== sell && x.v >= bestV - margin && credit(x.uid) < mine).sort((a, b) => credit(a.uid) - credit(b.uid) || b.v - a.v);
  return near[0] ?? null;
}

export class HeuristicAgent implements Agent {
  name: string;
  opts: Required<HeuristicOptions>;
  private rng: number;
  /** last decision explanation (for UI "why did the bot do that") */
  lastThought = '';
  /** top alternatives of the last main-phase decision: value relative to passing (coach UI) */
  lastAlternatives: Alternative[] = [];
  /** the last sell decision broke a near-tie to keep a scarce package piece (sellKeepScarce): which card, sold instead, and the gap */
  lastSellKeep: { kept: string; sold: string; gap: number } | null = null;
  /** every option valued in the last decision (null when a rule decided it): read by telemetry and the coach, never in play */
  lastScores: DecisionScores | null = null;
  /** the tier this bot was made as (makeTierBot), for telemetry labels; never read in play */
  tier?: string;
  /** sellSearch chose not to sell on this turn of this game state: no further sell that turn */
  private noSellAt: { s: object; turn: number } | null = null;

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
      impactSell: opts.impactSell ?? opts.impact ?? 0,
      impactCards: opts.impactCards ?? opts.impact ?? 0,
      deepAttacks: opts.deepAttacks ?? 0,
      sellLookahead: opts.sellLookahead ?? 0,
      deepReactions: opts.deepReactions ?? 0,
      sellKeepScarce: opts.sellKeepScarce ?? 0,
      rolloutWins: opts.rolloutWins ?? false,
      deepWorlds: opts.deepWorlds ?? 0,
      sellSearch: opts.sellSearch ?? false,
      noSellTurn: opts.noSellTurn ?? -1,
      turnPlan: opts.turnPlan ?? 0,
      turnPlanNodes: opts.turnPlanNodes ?? 120,
      turnPlanBeam: opts.turnPlanBeam ?? 3,
      mulligan: opts.mulligan ?? 'rule',
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

  /**
   * Telemetry (ScoreSource, src/engine/telemetry.ts): the last decision's scores in compact form, when they are for `d`.
   * Read only: it changes nothing and draws no random number.
   */
  decisionScores(d: Decision): ScoreRecord | null {
    return compactScores(this.lastScores, d);
  }

  /** Telemetry label: the tier this bot was made as, or the options that differ from a plain lookahead bot. */
  configLabel(): string {
    if (this.tier) return this.tier;
    const o = this.opts;
    if (!o.lookahead) return 'fast';
    const parts = [o.deep ? `deep${o.deep}` : '1ply'];
    if (o.deepWorlds > 1) parts.push(`w${o.deepWorlds}`);
    if (o.deepReactions) parts.push(`rx${o.deepReactions}`);
    if (o.sellLookahead > 1) parts.push(`sell${o.sellLookahead}`);
    if (o.impact) parts.push(`imp${o.impact}`);
    if (o.profiles) parts.push('prof');
    if (o.noise) parts.push(`noise${o.noise}`);
    return parts.join(' ');
  }

  private rand() {
    this.rng = (this.rng * 1664525 + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }

  /**
   * Copy another agent's decision state (random stream, matchup read, a planned Gig swap), so this agent decides the
   * next decision exactly as `o` would with this agent's options. Used to count the decisions a weight changes
   * (scripts/package-scoring.ts); never in play.
   */
  syncFrom(o: HeuristicAgent) {
    this.rng = o.rng;
    this.myArch = o.myArch;
    this.oppArch = o.oppArch;
    this.pendingSwapTake = o.pendingSwapTake;
    this.noSellAt = o.noSellAt;
  }

  /**
   * The agents of a lookahead clone. The deciding seat p keeps its own package weights (it knows its own list); the rival
   * seat gets none (p doesn't know the rival's list). With no package weight set this is exactly the old pair.
   */
  private cloneAgents(p: PlayerId, mk: (w: EvalWeights, seat: PlayerId) => Agent): [Agent, Agent] {
    const own = this.opts.weights;
    const rival = withoutPackages(own); // the same object when no package weight is set
    return [mk(p === 0 ? own : rival, 0), mk(p === 1 ? own : rival, 1)];
  }

  /** Weights for the fast agents of simulate() / reaction clones: as before (defaults) unless package weights are set. */
  private fastAgents(p: PlayerId): [Agent, Agent] {
    if (!usesPackages(this.opts.weights) && !usesPackages(DEFAULT_WEIGHTS)) return [new HeuristicAgent({ lookahead: false }), new HeuristicAgent({ lookahead: false })];
    const own: EvalWeights = { ...DEFAULT_WEIGHTS, pkgHold: this.opts.weights.pkgHold, pkgAssembly: this.opts.weights.pkgAssembly, pkgSteer: this.opts.weights.pkgSteer, pkgProtect: this.opts.weights.pkgProtect };
    const rival = withoutPackages(DEFAULT_WEIGHTS);
    return [new HeuristicAgent({ lookahead: false, weights: p === 0 ? own : rival }), new HeuristicAgent({ lookahead: false, weights: p === 1 ? own : rival })];
  }

  /** Package facts for seat p, or null when no package weight counts for this agent or p's list is built around none. */
  private pkgFacts(g: Game, p: PlayerId) {
    if (!usesPackages(this.opts.weights)) return null;
    const pkgs = seatPackages(g, p);
    return pkgs.length ? packageFacts(g, p, pkgs) : null;
  }

  /** The steering kinds that count for p now (pkgSteer set, a payoff available), or null. */
  private steerKinds(g: Game, p: PlayerId): SteerKind[] | null {
    if (this.opts.weights.pkgSteer === 0) return null;
    const f = this.pkgFacts(g, p);
    const k = f ? activeSteer(f) : [];
    return k.length ? k : null;
  }

  /** pkgSteer in the Gig plan's units (the Gig sub-choices compare plan scores). */
  private steerInPlanUnits(): number {
    return this.opts.weights.pkgSteer / (this.opts.weights.plan || 1);
  }

  async decide(g: Game, d: Decision): Promise<number[]> {
    this.lastScores = null;
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

  /**
   * sellKeepScarce (the coach only): when the card about to be sold is a scarce piece of p's own package and another
   * compared option is within the margin of the best, sell that one instead (the least scarce, then the best value).
   */
  private keepScarce(g: Game, p: PlayerId, sell: number, vals: { uid: number; v: number }[], bestV: number): number {
    const pkgs = seatPackages(g, p);
    if (!pkgs.length) return sell;
    const facts = packageFacts(g, p, pkgs);
    const alt = sellTieBreak(sell, vals, bestV, this.opts.sellKeepScarce, (uid) => holdCredit(facts, g.c(uid).defId));
    if (alt === null) return sell;
    this.lastSellKeep = { kept: g.c(sell).defId, sold: g.c(alt.uid).defId, gap: bestV - alt.v };
    return alt.uid;
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
    const facts = this.opts.weights.pkgHold !== 0 ? this.pkgFacts(g, p) : null;
    for (const s of sells) {
      const c = g.c(s.uid);
      const d = g.def(c);
      let keep = cardValue(c.defId) + this.opts.impactSell * cardImpact(P, c.defId);
      const cost = g.playCost(c.uid, p);
      if (cost <= avail + 1) keep += 3; // castable now / next turn
      if (cost > avail + 3) keep -= 3; // far off
      if ((counts.get(c.defId) ?? 0) > 1) keep -= 2;
      if (d.type === 'Gear' && g.gearHosts(p).length === 0) keep -= 2;
      // a package piece whose partner can still be had is worth keeping (pkgHold)
      if (facts) keep += this.opts.weights.pkgHold * holdCredit(facts, c.defId);
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
    // sellSearch decided (or a "don't sell" play-out assumes) no sell this turn
    if (sell !== null && (g.s.turn === this.opts.noSellTurn || (this.noSellAt?.s === g.s && this.noSellAt.turn === g.s.turn))) sell = null;
    this.lastSellKeep = null;
    if (sell !== null && this.opts.sellSearch && this.opts.lookahead && this.opts.deep > 0) {
      // BOT-4: whether to sell, and which of the two most sellable, by the deep rollout
      sell = await this.searchSell(g, p, actions);
      if (sell === null) this.noSellAt = { s: g.s, turn: g.s.turn }; // its play-out kept every sell off for the turn
    } else if (sell !== null && this.opts.sellLookahead > 1 && this.opts.lookahead) {
      // which card to sell: compare the few most sellable by playing them out (the "whether" stays rule-based)
      const options = this.sellRanking(g, p, actions).slice(0, this.opts.sellLookahead);
      if (options.length > 1) {
        let bestV = -Infinity;
        const vals: { uid: number; v: number }[] = [];
        const scoredSells: ScoredOption[] = [];
        // deep with shared worlds (the coach): every sell in the same worlds, on the main-phase deep scale (rollout mean
        // + 5% of the 1-ply value), so a sell and any other move can be compared (src/ai/coach.ts). No tier sets both.
        const worlds = this.opts.deep > 0 && this.opts.deepWorlds > 1 ? makeWorlds(this.opts.deepWorlds, () => this.rand()) : null;
        for (const uid of options) {
          const a: Action = { type: 'sell', uid };
          let v: number;
          const i = actions.findIndex((x) => x.type === 'sell' && x.uid === uid);
          if (worlds) {
            const s = (await this.valueMain(g, p, actions, [i], worlds))[0];
            v = s.v;
            scoredSells.push(s);
          } else {
            v = this.opts.deep > 0 ? await this.rollout(g, p, a) : await this.simulate(g, p, a);
            scoredSells.push({ i, v });
          }
          vals.push({ uid, v });
          if (v > bestV + 0.01) {
            bestV = v;
            sell = uid;
          }
        }
        if (this.opts.sellKeepScarce > 0 && sell !== null) sell = this.keepScarce(g, p, sell, vals, bestV);
        const chosenI = actions.findIndex((x) => x.type === 'sell' && x.uid === sell);
        this.lastScores = { kind: 'sell', scale: this.opts.deep > 0 ? 'deep' : '1ply', opts: scoredSells, chosen: chosenI, ...(worlds ? { worlds } : {}), d };
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
    // turnPlan (BOT-5): each candidate valued by the best line of the turn starting with it (its 1-ply value or better)
    const planned = this.opts.turnPlan > 1 ? await this.planValues(g, p, cands.filter((x) => !isUnknownCall(g, x.a))) : null;
    const scored: { i: number; v: number }[] = [];
    if (passIdx >= 0) scored.push({ i: passIdx, v: base });
    for (const { a, i } of cands) {
      let v = isUnknownCall(g, a) ? unknownCallV! : (planned?.get(i) ?? (await this.simulate(g, p, a)));
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
    /** deepWorlds > 1: each rolled-out candidate's value in each world */
    const perWorld = new Map<number, number[]>();
    /** deep: each rolled-out candidate's 1-ply value (observe-only, for lastScores) */
    const plyOf = new Map<number, number>();
    let deepWorldList: World[] | null = null;
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
      // deepWorlds > 1: every candidate in the same worlds (common random numbers), as deepReaction does
      const worlds = this.opts.deepWorlds > 1 ? makeWorlds(this.opts.deepWorlds, () => this.rand()) : null;
      deepWorldList = worlds;
      for (const t of top) {
        // an unknown Call stands for every unknown slot: average the rollouts over them
        const group = isUnknownCall(g, actions[t.i]) ? unknownCalls.map((x) => x.a) : [actions[t.i]];
        let rv: number;
        if (worlds) {
          const vals: number[] = [];
          for (const w of worlds) {
            let sum = 0;
            for (const a of group) sum += await this.rollout(g, p, a, w);
            vals.push(sum / group.length);
          }
          perWorld.set(t.i, vals);
          rv = vals.reduce((x, y) => x + y, 0) / vals.length;
        } else {
          let sum = 0;
          for (const a of group) sum += await this.rollout(g, p, a);
          rv = sum / group.length;
        }
        const dv = rv + t.v * 0.05;
        deepScored.push({ i: t.i, v: dv });
        plyOf.set(t.i, t.v);
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
    const chosen = perWorld.get(bestI);
    this.lastAlternatives = [...pool]
      .sort((x, y) => y.v - x.v)
      .slice(0, 4)
      .map((x) => {
        const alt: Alternative = { index: x.i, label: g.describeAction(actions[x.i]), delta: x.v - passV };
        const vals = perWorld.get(x.i);
        if (vals && chosen) {
          alt.se = standardError(vals);
          alt.seDiff = standardError(vals.map((v, k) => v - chosen[k]));
        }
        return alt;
      });
    // every valued option, for telemetry and the coach's grading (observe-only)
    this.lastScores = deepScored
      ? {
          kind: 'main',
          scale: 'deep',
          opts: deepScored.map((x) => {
            const w = perWorld.get(x.i);
            const ply = plyOf.get(x.i)!;
            return w ? { i: x.i, v: x.v, ply, w, off: ply * 0.05 } : { i: x.i, v: x.v, ply };
          }),
          chosen: bestI,
          screen: scored.map((x) => ({ i: x.i, v: x.v })),
          ...(deepWorldList ? { worlds: deepWorldList } : {}),
          d,
        }
      : { kind: 'main', scale: '1ply', opts: scored.map((x) => ({ i: x.i, v: x.v, ply: x.v })), chosen: bestI, d };
    return bestI;
  }

  /**
   * Value main-phase options `idx` of `actions` the way the deep decision values its candidates, in the given shared
   * worlds: per world the rollout (an unknown Call averaged over every unknown slot), plus 5% of the 1-ply value (a
   * Call's −1.5 included, no noise; passing is the position's own evaluation). Used by the coach to score a move it did
   * not roll out, in the worlds of its own decision (src/ai/coach.ts), and by the sell comparison with shared worlds.
   */
  async valueMain(g: Game, p: PlayerId, actions: Action[], idx: number[], worlds: World[]): Promise<ScoredOption[]> {
    const unknownCalls = actions.filter((a) => isUnknownCall(g, a));
    const out: ScoredOption[] = [];
    for (const i of idx) {
      const a = actions[i];
      const group = isUnknownCall(g, a) ? unknownCalls : [a];
      let ply: number;
      if (a.type === 'pass') ply = evaluate(g, p, this.w(g, p));
      else {
        let s = 0;
        for (const x of group) s += await this.simulate(g, p, x);
        ply = s / group.length;
        if (a.type === 'call') ply -= 1.5;
      }
      const w: number[] = [];
      for (const world of worlds) {
        let s = 0;
        for (const x of group) s += await this.rollout(g, p, x, world);
        w.push(s / group.length);
      }
      const off = ply * 0.05;
      out.push({ i, v: w.reduce((x, y) => x + y, 0) / w.length + off, ply, w, off });
    }
    return out;
  }

  /**
   * Value reaction options `idx` the way deep reactions value them, in the given shared worlds: per world the attack and
   * both turns played out (clamped), plus 0.5 for a reaction-time Call; an unknown Call averaged over every unknown slot.
   */
  async valueReaction(g: Game, p: PlayerId, rx: Reaction[], idx: number[], worlds: World[]): Promise<ScoredOption[]> {
    const unknown = rx.filter((r) => isUnknownCall(g, r));
    const out: ScoredOption[] = [];
    for (const i of idx) {
      const r = rx[i];
      const group = isUnknownCall(g, r) ? unknown : [r];
      const w: number[] = [];
      for (const world of worlds) {
        let s = 0;
        for (const x of group) s += await this.reactionWorld(g, p, x, world);
        w.push(s / group.length);
      }
      const off = r.type === 'call' ? 0.5 : 0;
      out.push({ i, v: w.reduce((x, y) => x + y, 0) / w.length + off, w, off });
    }
    return out;
  }

  /** One deep-reaction play-out: resume the attack with reaction r in world w, play p's turn, score it. */
  private async reactionWorld(g: Game, p: PlayerId, r: Reaction, w: World): Promise<number> {
    const attacker = g.s.attack!.attacker;
    const cg = g.clone(this.cloneAgents(p, (weights, seat) => new HeuristicAgent({ lookahead: true, deep: 0, maxCandidates: 14, weights, profiles: this.opts.profiles, seed: seat === 0 ? w.a : w.b })));
    cg.s.rng = w.rng;
    hideInfo(cg, p);
    await playOut(cg, p, { reaction: r, attacker });
    return playOutValue(cg, p, this.w(g, p), { wins: this.opts.rolloutWins, clamp: true });
  }

  /** Clone, perform an action with fast policies, return evaluation. */
  async simulate(g: Game, p: PlayerId, a: Action): Promise<number> {
    const cg = g.clone(this.fastAgents(p));
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

  /** turnPlan: the last plan's best line (descriptions, first action first) and its search size; null when not planned. */
  lastPlan: { line: string[]; v: number; nodes: number; merged: number; depth: number; changed: boolean } | null = null;

  /**
   * BOT-5 (turnPlan): each candidate's value as the best sequence of p's own actions this turn that starts with it,
   * searched in the 1-ply screen's world with its play-out agents and evaluation (src/ai/turnPlan.ts). Keyed by action index.
   */
  private async planValues(g: Game, p: PlayerId, cands: { a: Action; i: number }[]): Promise<Map<number, number>> {
    const w = this.w(g, p);
    const r = await planTurn(
      p,
      cands.map((x) => x.a),
      {
        root: () => {
          const cg = g.clone(this.fastAgents(p));
          hideInfo(cg, p);
          return cg;
        },
        child: (cg) => cg.clone(this.fastAgents(p)),
        value: (cg) => evaluate(cg, p, w),
        // below the root: no sells (the rule sells first), no Calls (a face-down Legend's identity is unknown) and no pass
        expand: (cg) =>
          this.capCandidates(
            cg,
            cg
              .legalActions(p)
              .map((a, i) => ({ a, i }))
              .filter(({ a }) => a.type !== 'pass' && a.type !== 'sell' && a.type !== 'call'),
          ).map((x) => x.a),
      },
      { depth: this.opts.turnPlan, nodes: this.opts.turnPlanNodes, beam: this.opts.turnPlanBeam },
    );
    // later steps may name cards or abilities that exist only in the search position: described in the real game when they can be
    const describe = (a: Action) => {
      try {
        return g.describeAction(a);
      } catch {
        return a.type;
      }
    };
    this.lastPlan = r.best ? { line: r.best.line.map(describe), v: r.best.v, nodes: r.nodes, merged: r.merged, depth: r.depth, changed: r.changed } : null;
    // first actions that lead to the same best line tie on it (merged positions): 5% of the 1-ply value breaks the tie toward
    // the step that is best on its own; with no better line than the action itself this is exactly the 1-ply value
    return new Map(cands.map((x, k) => [x.i, 0.95 * r.values[k] + 0.05 * r.own[k]]));
  }

  /**
   * Play the action, finish our turn with a 1-ply bot, then let a 1-ply rival take its full turn; evaluate. Without a
   * world the clone keeps the game's random state and the play-out bots their default seed (as before deepWorlds).
   */
  async rollout(g: Game, p: PlayerId, a: Action, world?: World): Promise<number> {
    return this.rolloutMove(g, p, a, world);
  }

  /** rollout(), or with `a` null (sellSearch's "don't sell"): p's clone bot plays the rest of the turn without selling. */
  private async rolloutMove(g: Game, p: PlayerId, a: Action | null, world?: World): Promise<number> {
    const noSell = a === null ? g.s.turn : undefined;
    const cg = g.clone(
      this.cloneAgents(p, (weights, seat) => {
        const noSellTurn = seat === p ? noSell : undefined;
        return world
          ? new HeuristicAgent({ lookahead: true, deep: 0, maxCandidates: 14, weights, profiles: this.opts.profiles, seed: seat === 0 ? world.a : world.b, noSellTurn })
          : new HeuristicAgent({ lookahead: true, deep: 0, maxCandidates: 14, weights, profiles: this.opts.profiles, noSellTurn });
      }),
    );
    if (world) cg.s.rng = world.rng;
    hideInfo(cg, p);
    await playOut(cg, p, a === null ? { rest: true } : { action: a });
    const wins = this.opts.rolloutWins;
    return playOutValue(cg, p, this.w(g, p), { wins, clamp: wins });
  }

  /**
   * BOT-4 (sellSearch): roll out "don't sell this turn" and the two most sellable cards, every option in the same worlds
   * (deepWorlds > 1) or each once in the game's own random state; the best is taken, a sell on ties. null = don't sell.
   */
  private async searchSell(g: Game, p: PlayerId, actions: Action[]): Promise<number | null> {
    const sells = this.sellRanking(g, p, actions).slice(0, 2);
    const worlds = this.opts.deepWorlds > 1 ? makeWorlds(this.opts.deepWorlds, () => this.rand()) : null;
    const value = async (a: Action | null) => {
      if (!worlds) return this.rolloutMove(g, p, a);
      let sum = 0;
      for (const w of worlds) sum += await this.rolloutMove(g, p, a, w);
      return sum / worlds.length;
    };
    let best: number | null = sells[0] ?? null;
    let bestV = -Infinity;
    for (const uid of sells) {
      const v = await value({ type: 'sell', uid });
      if (v > bestV + 0.01) {
        bestV = v;
        best = uid;
      }
    }
    return (await value(null)) > bestV + 0.01 ? null : best;
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
    // Play the attack out in a clone (no further reactions, sub-choices by the fast policy) and evaluate the result, so
    // fight and steal effects armed by the reaction count (Safety Override, "when this blocks" triggers, ...). Letting
    // the attack resolve is valued the same way.
    const seen = new Map<Reaction, number[]>();
    const resolved = async (r: Reaction | null) => {
      const v = await resolve1(r);
      if (r) seen.set(r, [v]);
      return v;
    };
    const resolve1 = async (r: Reaction | null) => {
      const cg = g.clone(this.fastAgents(p));
      hideInfo(cg, p);
      try {
        if (r) {
          await cg.doReaction(p, r);
          await cg.resolvePending();
        }
        if (cg.s.attack) await cg.attackRest(cg.s.attack.attacker, true);
        cg.checkState();
      } catch (e) {
        if (!(e instanceof GameOverSignal)) throw e;
      }
      return evaluate(cg, p, this.w(g, p));
    };
    const baseV = await resolved(null);
    const { bestI, bestV } = await pickReaction(g, rx, endIdx, baseV, resolved);
    this.lastThought = `${g.describeAction(rx[bestI])} (projected ${bestV.toFixed(1)} vs ${baseV.toFixed(1)})`;
    // "no reaction" is valued as the attack resolving untouched (baseV)
    this.lastScores = { kind: 'reaction', scale: '1ply', opts: reactionScores(g, rx, (r) => (r.type === 'endReact' ? [baseV] : (seen.get(r) ?? null))).map(({ i, v }) => ({ i, v })), chosen: bestI, d };
    return bestI;
  }

  /** Reactions by rollout: resume the attack with each reaction, let the attacker finish, play our turn, evaluate. */
  private async deepReaction(g: Game, d: Decision, rx: Reaction[], endIdx: number): Promise<number> {
    const p = d.player;
    // one random world per rollout (hidden-information deal, dice), shared by every candidate: common random numbers
    const worlds = makeWorlds(this.opts.deepReactions, () => this.rand());
    /** each valued reaction's per-world values (observe-only, for lastScores) */
    const seen = new Map<Reaction, number[]>();
    const value = async (r: Reaction) => {
      let sum = 0;
      const vals: number[] = [];
      for (const w of worlds) {
        const v = await this.reactionWorld(g, p, r, w);
        vals.push(v);
        sum += v;
      }
      seen.set(r, vals);
      return sum / worlds.length;
    };
    const baseV = endIdx >= 0 ? await value(rx[endIdx]) : -Infinity;
    const { bestI, bestV } = await pickReaction(g, rx, endIdx, baseV, value);
    this.lastThought = `${g.describeAction(rx[bestI])} (projected ${bestV.toFixed(1)} vs ${baseV.toFixed(1)})`;
    this.lastScores = { kind: 'reaction', scale: 'deep', opts: reactionScores(g, rx, (r) => seen.get(r) ?? null), chosen: bestI, worlds, d };
    return bestI;
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
        return best > 2 * w.hand + this.discardPackageCost(g, p, 2, (id) => g.def(id).type === 'Program');
      }
      case 'pay':
        return this.wantsSombreron(g, p, d);
      default:
        // addToHand, freePlay, playFree, call: free card advantage or a free play
        return true;
    }
  }

  /** pkgHold: what discarding the n cards in hand matching `which` that a give-up choice would pick costs p's packages (0 when off). */
  private discardPackageCost(g: Game, p: PlayerId, n: number, which: (uid: number) => boolean): number {
    const wt = this.opts.weights.pkgHold;
    if (wt === 0) return 0;
    const facts = this.pkgFacts(g, p);
    if (!facts) return 0;
    const cards = g.P(p).hand.filter(which).map((u) => {
      const h = wt * holdCredit(facts, g.c(u).defId);
      return { v: cardValue(g.c(u).defId) + h, h };
    });
    cards.sort((a, b) => a.v - b.v);
    return cards.slice(0, n).reduce((a, x) => a + x.h, 0);
  }

  /** Kerry Eurodyne: reroll a Fixer-rolled Gig when the expected roll (plan fit + min/max draws) beats the current one. */
  private wantsReroll(g: Game, p: PlayerId, d: Decision, w: EvalWeights): boolean {
    const plan = planFor(g, p, p);
    const gigs = g.gigsOf(p);
    // the Gig just rolled in from the Fixer is the newest friendly Gig (the engine appends it before the trigger)
    const gig = gigs[gigs.length - 1];
    if (!gig || d.source === undefined) return false;
    const steer = this.steerKinds(g, p);
    const theirs = steer ? g.gigsOf(other(p)) : [];
    const score = (v: number) => {
      const view = gigs.map((x) => (x.id === gig.id ? ({ ...x, value: v } as Gig) : x));
      const draws = v === 1 || v === gig.sides ? (gig.sides === 20 ? 3 : 1) : 0;
      const s = planScore(view, plan) * w.plan + draws * w.hand;
      return steer ? s + this.opts.weights.pkgSteer * steerCredit(steer, view, theirs) : s;
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
    if (this.opts.impact && this.opts.mulligan === 'rule') {
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
    const facts = this.opts.weights.pkgHold !== 0 ? this.pkgFacts(g, p) : null;
    const scored = real.map(({ o, i }) => {
      const c = g.c(o.uid!);
      const mine = c.controller === p;
      // impact telemetry is per deck: a rival card is valued for the rival's deck
      let v = cardValue(c.defId) + this.opts.impactCards * cardImpact(g.P(c.controller), c.defId);
      // prefer keeping / getting cards we can cast soon
      const cost = g.def(c).cost ?? 0;
      if (mine && cost <= g.P(p).eddies.length + 3) v += 1.5;
      // own package pieces whose partner can still be had: keep them, take them (pkgHold; never for rival cards)
      if (mine && facts) v += this.opts.weights.pkgHold * holdCredit(facts, c.defId);
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
    // the package steering kinds that count now (pkgSteer set and a payoff to use them), in the plan's units
    const steer = this.steerKinds(g, p);
    const k = steer ? this.steerInPlanUnits() : 0;
    if (d.tag === 'rollIn') {
      // high plans roll big dice early; low plans roll small dice (better min odds); default: big dice
      const wantSmall = myPlan.low > myPlan.high + 0.2;
      gigs.sort((a, b) => (wantSmall ? a.x.sides - b.x.sides : b.x.sides - a.x.sides));
      if (steer) {
        // a package that steers Gigs: the die whose roll is expected to land closest to what the package wants
        // (ties keep the order above)
        const mine = g.gigsOf(p);
        const theirs = g.gigsOf(other(p));
        const expected = (x: Gig) => {
          let s = 0;
          for (let v = 1; v <= x.sides; v++) s += steerCredit(steer, [...mine, { value: v, sides: x.sides }], theirs);
          return s / x.sides;
        };
        let best = gigs[0];
        let bestV = expected(best.x);
        for (const y of gigs.slice(1)) {
          const v = expected(y.x);
          if (v > bestV + 1e-9) (best = y), (bestV = v);
        }
        return best.i;
      }
      return gigs[0].i;
    }
    const rPlan = planFor(g, other(p), p);
    /** our plan score minus the rival's, with `give` moved to the rival and `take` moved to us (plus package steering) */
    const swing = (give: Gig | null, take: Gig | null) => {
      const mineAfter = g.gigsOf(p).filter((y) => y.id !== give?.id);
      const theirsAfter = g.gigsOf(other(p)).filter((y) => y.id !== take?.id);
      if (take) mineAfter.push(take);
      if (give) theirsAfter.push(give);
      const s = planScore(mineAfter, myPlan) - planScore(theirsAfter, rPlan);
      return steer ? s + k * steerCredit(steer, mineAfter, theirsAfter) : s;
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
    const steer = this.steerKinds(g, p);
    const k = steer ? this.steerInPlanUnits() : 0;
    const score = (override?: { gig: number; n: number }) => {
      const view = (pl: PlayerId) =>
        g.gigsOf(pl).map((x) => (override && x.id === override.gig ? ({ ...x, value: override.n } as Gig) : x));
      const s = planScore(view(p), myPlan) - planScore(view(other(p)), rPlan);
      return steer ? s + k * steerCredit(steer, view(p), view(other(p))) : s;
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

const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * DecisionScores → the compact telemetry form (ScoreRecord): values relative to the chosen option, best first, at most
 * MAX_SCORED_OPTIONS; the claimed margin; for deep main-phase decisions the 1-ply rank of the chosen move and the deep
 * rank of the 1-ply screen's top. null when the scores are not for `d` or fewer than two options were valued.
 */
export function compactScores(s: DecisionScores | null, d: Decision): ScoreRecord | null {
  if (!s || s.d !== d || s.opts.length < 2) return null;
  const mine = s.opts.find((x) => x.i === s.chosen);
  if (!mine) return null;
  const sorted = [...s.opts].sort((a, b) => b.v - a.v);
  const other = Math.max(...s.opts.filter((x) => x !== mine).map((x) => x.v));
  const rec: ScoreRecord = {
    by: s.scale,
    o: sorted.slice(0, MAX_SCORED_OPTIONS).map((x) => [x.i, r1(x.v - mine.v)]),
    m: r1(mine.v - other),
  };
  if (s.kind === 'sell') rec.sell = true;
  if (s.screen && s.screen.length > 1) {
    const screen = [...s.screen].sort((a, b) => b.v - a.v);
    rec.r1 = screen.findIndex((x) => x.i === s.chosen);
    rec.rd = sorted.findIndex((x) => x.i === screen[0].i);
  }
  if (s.worlds && s.worlds.length > 1) rec.nw = s.worlds.length;
  return rec;
}

/** Standard error of the mean of xs (sample SD / √n); 0 for fewer than 2 values. */
export function standardError(xs: readonly number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const m = xs.reduce((a, x) => a + x, 0) / n;
  const v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1);
  return Math.sqrt(v / n);
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
 * The reactions a decision valued, as lastScores options: per-world values from `vals` (an unknown Call is the mean over
 * every unknown slot, as pickReaction values it), plus pickReaction's 0.5 for a Call. Options never valued are left out.
 */
function reactionScores(g: Game, rx: Reaction[], vals: (r: Reaction) => number[] | null): ScoredOption[] {
  const unknown = rx.filter((r) => isUnknownCall(g, r));
  const out: ScoredOption[] = [];
  for (let i = 0; i < rx.length; i++) {
    const r = rx[i];
    let w: number[] | null;
    if (isUnknownCall(g, r)) {
      const all = unknown.map(vals);
      w = all.every((x): x is number[] => x !== null) && all.length ? all[0].map((_, k) => all.reduce((a, x) => a + x[k], 0) / all.length) : null;
    } else w = vals(r);
    if (!w || !w.length) continue;
    const off = r.type === 'call' ? 0.5 : 0;
    out.push({ i, v: w.reduce((a, x) => a + x, 0) / w.length + off, w, off });
  }
  return out;
}

/**
 * Best reaction by `value`, keeping "no reaction" unless an option beats it by 0.5. Unknown Calls (face-down Legends
 * the defender can't tell apart) are one option valued as their average, so the choice never depends on which
 * face-down Legend is which; the first unknown slot is played.
 */
async function pickReaction(g: Game, rx: Reaction[], endIdx: number, baseV: number, value: (r: Reaction) => Promise<number>) {
  let bestI = endIdx >= 0 ? endIdx : 0;
  let bestV = baseV;
  const unknown = rx.map((_r, i) => i).filter((i) => isUnknownCall(g, rx[i]));
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
