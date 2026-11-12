// Coach: turns the advisor bot's decision into human advice (why, alternatives, matchup plan, deck tips, warnings).
import { Game, other } from '../engine/engine';
import { CARD_BY_ID } from '../engine/cards';
import type { Action, Agent, Decision, GameState, Gig, Opt, PlayerId, Reaction } from '../engine/types';
import { activeSteer, holdCredit, obtainableOf, packageFacts, partnerName, seatPackages, steerValue, steerWants, type PackageFacts, type SteerKind } from './packages';
import { HeuristicAgent, standardError, worldValue, type DecisionScores } from './heuristic';
import { makeWorlds, type World } from './playOut';
import { BLUNDER } from './reviewer';
import { BEST_PROFILES, classify, PLAN_TEXT, type ProfileKey } from './archetype';
import { GIG_SWING, knownCards } from './eval';
import type { SynergyRole } from '../content/synergies/index';
import { impactBasis, impactDeckName, topImpactCards } from './impact';
import analysis from '../data/analysis.json';
import type { DeckReport } from '../analysis/analyze';

/**
 * Shared worlds the coach scores every candidate in (HeuristicOptions.deepWorlds; also the worlds of its sell comparison,
 * of its reactions and of an on-demand score of your move), so every gap it reports has a paired standard error.
 * Chosen 2026-11-12 by response time (docs/IMPROVEMENT_BACKLOG.md INFO-1): one thread in Node, 171 main-phase and
 * reaction decisions of Medium-vs-Hard games, the previous coach (12 candidates, one world each, reactions over 3) took
 * 29 ms mean (p90 70, max 181); 6 candidates over 6 worlds 126 ms mean (p90 287, max 610); 8 over 6, 146 ms (p90 347).
 */
export const COACH_WORLDS = 6;
/** Coach configuration — chosen by scripts/coach-eval.ts (see reports/coach-eval-latest.md), then shared worlds (INFO-1). */
const COACH_CONFIG = { profiles: BEST_PROFILES, impact: 40, deep: 6, deepWorlds: COACH_WORLDS, sellLookahead: 3, deepReactions: COACH_WORLDS };
/**
 * The coach's sell advice breaks near-ties (within 0.05 Gigs, well inside what the alternatives call a "close call") toward
 * keeping a scarce piece of the player's own package (HeuristicOptions.sellKeepScarce). Bots never set it.
 */
export const COACH_SELL_KEEP_GIGS = 0.05;
/** The coach before the review-driven refinement (kept for comparisons). */
export const COACH_CONFIG_V1 = { profiles: BEST_PROFILES, impact: 40, deep: 12 };

export function makeCoach() {
  return new HeuristicAgent({ name: 'Coach', ...COACH_CONFIG, sellKeepScarce: COACH_SELL_KEEP_GIGS * GIG_SWING });
}

/** Evaluation points → "Gig swing". */
const gigs = (delta: number) => delta / GIG_SWING;

/**
 * Decisions the coach advises on. Not 'pay' (which Eddie or Legend pays a cost) or 'order' (which of your pending
 * effects resolves next): bots never get them, so the coach has no view.
 */
export function coachAdvises(d: Decision): boolean {
  return d.kind !== 'pay' && d.kind !== 'order';
}

/** One option the coach valued, as plain data: its value, and its value in each shared world when there were several. */
export interface GradedOption {
  /** option index */
  i: number;
  /** evaluation points, on the scale the coach chose on */
  v: number;
  /** the value in each of `GradeBasis.worlds` (constant terms included) */
  w?: number[];
}

/**
 * What the coach valued in this spot, so any move you make can be graded on the same scale and in the same worlds
 * (gradeMove; a move it did not value is scored afterwards by scoreMoveRequest). Absent when a rule decided (a target,
 * a mode, the mulligan, a sell with nothing to compare).
 */
export interface GradeBasis {
  kind: 'main' | 'sell' | 'reaction';
  opts: GradedOption[];
  worlds?: World[];
}

export interface Advice {
  index: number;
  why: string;
  /**
   * Other options the coach weighed, best first: `gap` in words ("close call", "−0.4 Gigs"), `gapGigs` the value given up
   * (≥ 0), `close` when it is within the noise of the coach's pick (see isClose), `se` the paired standard error in Gigs.
   */
  alternatives: { index: number; label: string; gap: string; gapGigs: number; close?: boolean; se?: number }[];
  grade?: GradeBasis;
}

/** The coach's scores as plain data (each world's value with its constant terms). */
function basisOf(s: DecisionScores | null): GradeBasis | undefined {
  if (!s || !s.opts.length) return undefined;
  const opts = s.opts.map((o): GradedOption => (o.w ? { i: o.i, v: o.v, w: o.w.map((_, k) => worldValue(o, k)) } : { i: o.i, v: o.v }));
  return { kind: s.kind, opts, ...(s.worlds ? { worlds: s.worlds } : {}) };
}

/** Gap (Gigs) between the coach's pick `best` and option `o`, with the paired standard error when both have the same worlds. */
function gapOf(best: GradedOption, o: GradedOption): { gap: number; se?: number } {
  const gap = gigs(best.v - o.v);
  if (!best.w || !o.w || best.w.length !== o.w.length || best.w.length < 2) return { gap };
  return { gap, se: gigs(standardError(o.w.map((x, k) => x - best.w![k]))) };
}

/** A gap is a close call when it is under CLOSE_GIGS, or within 2 paired standard errors of the coach's pick. */
export function isClose(gap: number, se?: number): boolean {
  return gap < CLOSE_GIGS || (se !== undefined && gap <= 2 * se);
}

/**
 * The coach's reason for a sell it chose by rule. The card values include bot-match card impact: say where it comes from
 * (this list's own games, or pooled from other decks when the list has none), and claim no data when there is none.
 */
export function sellWhy(picked: string, basis: 'own' | 'pooled' | 'none'): string {
  const base = `${picked}: one sell a turn is your mana growth, and this is the least valuable card in hand for your deck`;
  if (basis === 'own') return `${base} (by bot-match telemetry on this list).`;
  if (basis === 'pooled') return `${base} (card values pooled from bot matches of other decks; this list has none of its own).`;
  return `${base}.`;
}

export async function advise(g: Game, d: Decision): Promise<Advice> {
  const coach = makeCoach();
  const [index] = await coach.decide(g, d);
  let why = coach.lastThought;
  const alternatives: Advice['alternatives'] = [];
  const picked = d.options[index]?.label ?? '';
  if (d.kind === 'action' && /^Sell/.test(picked) && !coach.lastAlternatives.length) {
    const hand = d.options.map((o) => o.action as Action).flatMap((a) => (a?.type === 'sell' ? [g.c(a.uid).defId] : []));
    why = sellWhy(picked, impactBasis(g.P(d.player), hand));
  } else if (d.kind === 'action' && coach.lastAlternatives.length) {
    const best = coach.lastAlternatives.find((a) => a.index === index) ?? coach.lastAlternatives[0];
    const label = d.options[index]?.label ?? best.label;
    const vsPass = gigs(best.delta);
    why = /Sell/.test(label)
      ? `${label}: selling one card a turn is your mana growth. This is the least valuable card for your deck right now.`
      : `${label} — ${vsPass >= 0.05 ? `worth about ${vsPass.toFixed(1)} Gigs more than passing` : 'roughly even with passing; the alternatives are worse'}.`;
  }
  const grade = basisOf(coach.lastScores);
  const mine = grade?.opts.find((o) => o.i === index);
  if (grade && mine) {
    // the three best other options it valued (main phase, the sells it compared, or reactions)
    for (const o of [...grade.opts].sort((a, b) => b.v - a.v)) {
      if (o.i === index) continue;
      if (alternatives.length >= 3) break;
      const { gap, se } = gapOf(mine, o);
      const close = isClose(gap, se);
      alternatives.push({
        index: o.i,
        label: d.options[o.i]?.label ?? '?',
        gap: close ? 'close call' : `−${gap.toFixed(1)} Gigs`,
        gapGigs: Math.max(0, gap),
        close,
        ...(se !== undefined ? { se } : {}),
      });
    }
  }
  // other decisions (reactions, targets): turn the bot's raw scores into plain words
  const m = why.match(/^(.*?) \((?:eval|projected) (-?[\d.]+) vs (?:pass )?(-?[\d.]+)\)$/);
  if (m) {
    const diff = gigs(+m[2] - +m[3]);
    why = `${m[1]} — ${Math.abs(diff) < 0.05 ? 'about even with doing nothing' : diff > 0 ? `saves about ${diff.toFixed(1)} Gigs compared with not acting` : 'the least bad option here'}.`;
  }
  const notes = packageNotes(g, d, index);
  const tie = coach.lastSellKeep;
  if (tie) notes.unshift(sellTieNote(g, d.player, tie));
  if (notes.length) why = [why, ...notes].filter(Boolean).join(' ');
  return { index, why, alternatives, ...(grade ? { grade } : {}) };
}

/** "Sell A or B: about as good (within 0.05 Gigs); keep B, your only payoff for X left." */
function sellTieNote(g: Game, p: PlayerId, t: { kept: string; sold: string }): string {
  const facts = packageFacts(g, p, seatPackages(g, p));
  const f = facts.find((x) => x.pkg.roles.has(t.kept) && holdCredit([x], t.kept) >= 0.25);
  const why = f ? scarcityText(f, t.kept) : 'a scarce piece of your deck’s package';
  return `Selling ${cardName(t.sold)} or ${cardName(t.kept)} comes out about the same (within ${COACH_SELL_KEEP_GIGS} Gigs), so keep ${cardName(t.kept)}: it is ${why}.`;
}

const roleWord = (r: SynergyRole) => (r === 'enabler' ? 'enabler' : r === 'payoff' ? 'payoff' : 'piece');
/** The roles that do the same job as a piece of `role` (a `both` card stands in for either half). */
const sameJob = (r: SynergyRole): SynergyRole[] => (r === 'enabler' ? ['enabler', 'both'] : r === 'payoff' ? ['payoff', 'both'] : r === 'both' ? ['enabler', 'payoff', 'both'] : ['piece', 'enabler', 'payoff', 'both']);

/**
 * How scarce a piece is, from the player's own view (hand, play, Legends and deck; the partner-aware view the deck
 * builders use, src/lib/cutRanking.ts): "your only enabler for Low Gigs left", "one of your last two payoffs for …".
 */
export function scarcityText(f: PackageFacts, id: string): string {
  const r = f.pkg.roles.get(id) ?? 'piece';
  const pool = obtainableOf(f);
  const n = sameJob(r).reduce((a, k) => a + pool[k], 0);
  const w = roleWord(r);
  if (n <= 1) return `your only ${w} for ${f.pkg.name} left`;
  if (n === 2) return `one of your last two ${w}s for ${f.pkg.name}`;
  return `one of only ${n} ${w}s for ${f.pkg.name} you can still draw or play`;
}

const cardName = (id: string) => CARD_BY_ID[id]?.displayName ?? id;

/** What an option of a Gig decision leaves as each player's Gigs, when that is known before it resolves (adjust, set, steal). */
function gigsAfter(g: Game, p: PlayerId, d: Decision, o: Opt): { mine: Gig[]; theirs: Gig[] } | null {
  if (o.gig === undefined) return null;
  const mine = g.gigsOf(p);
  const theirs = g.gigsOf(other(p));
  if (d.kind === 'gigValue' && o.n !== undefined) {
    const set = (xs: Gig[]) => xs.map((x) => (x.id === o.gig ? { ...x, value: o.n! } : x));
    return { mine: set(mine), theirs: set(theirs) };
  }
  if (d.kind === 'gig' && d.tag === 'steal') {
    const x = g.gig(o.gig);
    if (x.controller !== other(p)) return null;
    return { mine: [...mine, x], theirs: theirs.filter((y) => y.id !== x.id) };
  }
  return null;
}

/** How an alternative moves away from a steerable quantity, in plain words (only when it is true of that alternative). */
function awayText(k: SteerKind, after: { mine: Gig[]; theirs: Gig[] }): string {
  const cred = (xs: Gig[]) => xs.reduce((a, x) => a + x.value, 0);
  if (k === 'cred-low' && cred(after.mine) >= cred(after.theirs)) return 'would put your Street Cred at or above the rival’s';
  if (k === 'cred-high' && cred(after.mine) <= cred(after.theirs)) return 'would leave your Street Cred at or below the rival’s';
  if (k === 'cred-20' && cred(after.mine) < 20) return 'would leave your Street Cred below 20';
  if (k === 'cred-even' && cred(after.mine) % 2 === 1) return 'would make your Street Cred odd';
  return 'would move away from that';
}

/**
 * Plain-words notes when a synergy package the player's own list is built around is the reason for the advice
 * (package names come from the catalogue, src/content/synergies): which cards to keep when selling, and what a Gig
 * choice does for a Street Cred or Gig-value package. Empty when the list is built around none.
 */
export function packageNotes(g: Game, d: Decision, index: number): string[] {
  const p = d.player;
  const pkgs = seatPackages(g, p);
  if (!pkgs.length) return [];
  const facts = packageFacts(g, p, pkgs);
  const out: string[] = [];
  const opt = d.options[index];
  if (!opt) return out;
  if (d.kind === 'action' && opt.action?.type === 'sell') {
    // selling a scarce piece itself: say what it gives up (the coach rated everything else in hand worse to lose)
    const sold = g.c(opt.action.uid).defId;
    const fs = facts.find((x) => x.pkg.roles.has(sold) && holdCredit([x], sold) >= 0.25);
    const soldPartner = fs && partnerName(g, p, fs, sold);
    if (fs && soldPartner) out.push(`Selling ${cardName(sold)} gives up ${scarcityText(fs, sold)} (it pairs with ${soldPartner}); the coach still rates it the card in hand you can best spare right now.`);
    // name up to two scarce pieces kept in hand (not the card sold), with a partner the player can still get
    const seen = new Set([sold]);
    for (const u of g.P(p).hand) {
      const id = g.c(u).defId;
      if (seen.has(id)) continue;
      seen.add(id);
      const f = facts.find((x) => x.pkg.roles.has(id) && holdCredit([x], id) >= 0.25);
      const partner = f && partnerName(g, p, f, id);
      if (!f || !partner) continue;
      out.push(`Keep ${cardName(id)}: it is ${scarcityText(f, id)}, and it pairs with ${partner} in your deck.`);
      if (out.length >= 2) break;
    }
    return out;
  }
  if (d.kind !== 'gig' && d.kind !== 'gigValue') return out;
  const kinds = activeSteer(facts);
  const chosen = gigsAfter(g, p, d, opt);
  if (!kinds.length || !chosen) return out;
  for (const k of kinds) {
    const v = steerValue(k, chosen.mine, chosen.theirs);
    // the alternative that moves furthest away from what the package wants
    let worst: { label: string; v: number; after: { mine: Gig[]; theirs: Gig[] } } | null = null;
    d.options.forEach((o, i) => {
      if (i === index) return;
      const after = gigsAfter(g, p, d, o);
      if (!after) return;
      const w = steerValue(k, after.mine, after.theirs);
      if (!worst || w < worst.v) worst = { label: o.label, v: w, after };
    });
    const alt = worst as { label: string; v: number; after: { mine: Gig[]; theirs: Gig[] } } | null;
    if (!alt || alt.v >= v - 1e-9) continue;
    const names = pkgs.filter((x) => x.steer.includes(k)).map((x) => x.name);
    out.push(`Your deck wants ${steerWants(k)} (${names.join(', ')}): ${alt.label} ${awayText(k, alt.after)}.`);
  }
  return out;
}

/** Live warnings for a Street Cred package the player's list is built around, while a payoff is in hand or in play. */
export function packageWarnings(g: Game, p: PlayerId): string[] {
  const pkgs = seatPackages(g, p);
  if (!pkgs.length) return [];
  const facts = packageFacts(g, p, pkgs);
  const kinds = activeSteer(facts);
  const mine = g.streetCred(p) ?? 0;
  const theirs = g.streetCred(other(p)) ?? 0;
  const names = (k: SteerKind) => pkgs.filter((x) => x.steer.includes(k)).map((x) => x.name).join(', ');
  const out: string[] = [];
  if (kinds.includes('cred-low') && g.P(p).gigs.length && mine >= theirs) out.push(`Your Street Cred (${mine}) is not below the rival’s (${theirs}); your deck wants it lower (${names('cred-low')}).`);
  if (kinds.includes('cred-high') && mine <= theirs) out.push(`Your Street Cred (${mine}) is not above the rival’s (${theirs}); your deck wants it higher (${names('cred-high')}).`);
  if (kinds.includes('cred-20') && mine < 20) out.push(`Your Street Cred (${mine}) is below 20; your deck wants 20 or more (${names('cred-20')}).`);
  return out;
}

/**
 * Everything advise() reads, as plain data, so it can run in a worker (src/sim/coach.worker.ts). The coach depends only
 * on the game state (deck names, cards, Gigs, rng), the decision, and whether engine effects are still pending (with
 * effects pending, lookahead clones refuse, exactly as on the live game). The log and trace are left out: the coach
 * never reads them.
 */
export interface CoachRequest {
  state: GameState;
  decision: Decision;
  pending: { player: PlayerId; label: string }[];
}

export function coachRequest(g: Game, d: Decision): CoachRequest {
  const { log, trace } = g.s;
  g.s.log = [];
  g.s.trace = undefined;
  try {
    // a snapshot: the live game moves on after the human answers
    const state = structuredClone(g.s);
    if (trace) state.trace = [];
    return { state, decision: structuredClone(d), pending: g.pending.map((x) => ({ player: x.player, label: x.label })) };
  } finally {
    g.s.log = log;
    g.s.trace = trace;
  }
}

const noAgent: Agent = {
  name: 'none',
  decide: () => Promise.reject(new Error('the coach position has no agents')),
};

/** The game of a serialised position (its own copy of the state: the request can be reused). */
function rebuild(q: CoachRequest): Game {
  const g = new Game(structuredClone(q.state), [noAgent, noAgent]);
  g.pending = q.pending.map((x) => ({ ...x, run: async () => undefined }));
  return g;
}

/** advise() for a serialised position: rebuilds the game and asks the same coach. */
export function adviseRequest(q: CoachRequest): Promise<Advice> {
  return advise(rebuild(q), q.decision);
}

/** A gap under this many Gigs is a close call whatever its spread (the scorecard's threshold before INFO-1). */
export const CLOSE_GIGS = 0.15;
/** A gap of this many Gigs or more (outside the noise) is a mistake: the reviewer's blunder line (BLUNDER, ≈ 0.4 Gigs). */
export const MISTAKE_GIGS = BLUNDER / GIG_SWING;

/**
 * How a move compares with the coach's pick, by value:
 *   agree       the coach's own pick
 *   best        another move the coach values at least as high
 *   close       a close call: under CLOSE_GIGS behind, or within 2 paired standard errors (counts as fine)
 *   inaccuracy  behind by more than the noise, under MISTAKE_GIGS
 *   mistake     behind by MISTAKE_GIGS or more, outside the noise
 *   pending     being scored (a move the coach did not value: scoreMoveRequest)
 *   unscored    a different choice the coach can't value (a target, a mode, the mulligan), or scoring failed
 */
export type MoveVerdict = 'agree' | 'best' | 'close' | 'inaccuracy' | 'mistake' | 'pending' | 'unscored';

export interface MoveGrade {
  turn: number;
  chose: string;
  coach: string;
  /** Gigs given up vs the coach's pick (< 0: the move was valued higher); null when it can't be measured (yet) */
  gap: number | null;
  /** the paired standard error of the gap in Gigs, when both moves were scored in the same worlds */
  se?: number;
  verdict: MoveVerdict;
}

/** Verdicts the scorecard counts as fine. */
export const FINE_VERDICTS: readonly MoveVerdict[] = ['agree', 'best', 'close'];

/**
 * Grade a human decision against the coach's advice for the same spot, by value: the move's own score in the coach's
 * worlds (from the advice, or `extra` from scoreMoveRequest), not its place in the shortlist. A move the coach did not
 * value in a decision it can score is 'pending' until scored (`extra` undefined); once scoring has run (`extra` given,
 * empty if it failed) a move still without a value is 'unscored'.
 */
export function gradeMove(d: Decision, chosen: number, a: Advice, turn: number, extra?: readonly GradedOption[]): MoveGrade {
  const chose = d.options[chosen]?.label ?? '?';
  const coach = d.options[a.index]?.label ?? '?';
  if (chosen === a.index) return { turn, chose, coach, gap: 0, verdict: 'agree' };
  // scored together (extra) when the advice had no worlds to score in
  const find = (i: number) => extra?.find((o) => o.i === i) ?? a.grade?.opts.find((o) => o.i === i);
  const best = find(a.index);
  const mine = find(chosen);
  if (!best || !mine) return { turn, chose, coach, gap: null, verdict: scorable(d) && extra === undefined ? 'pending' : 'unscored' };
  const { gap, se } = gapOf(best, mine);
  const verdict: MoveVerdict = gap <= 0 ? 'best' : isClose(gap, se) ? 'close' : gap >= MISTAKE_GIGS ? 'mistake' : 'inaccuracy';
  return { turn, chose, coach, gap, ...(se !== undefined ? { se } : {}), verdict };
}

/** Decisions whose every option the coach can value by rollout: main-phase actions and reactions. */
export const scorable = (d: Decision) => d.kind === 'action' || d.kind === 'reaction';

/** Everything scoreMoveRequest needs: the snapshot the advice was made from, the move made, and the coach's own scores. */
export interface ScoreRequest {
  req: CoachRequest;
  chosen: number;
  coach: number;
  grade?: GradeBasis;
}

/**
 * Score your move in the worlds the coach's advice used, after you made it (the advice is computed before you move, so
 * a move it did not roll out is valued on demand, off the board's thread). When the advice has no worlds for its own
 * pick (it sold by rule, or had one option to roll out), both moves are scored in COACH_WORLDS fresh shared worlds.
 * Returns the scored options (yours, and the coach's when it was rescored).
 */
export async function scoreMoveRequest(q: ScoreRequest): Promise<GradedOption[]> {
  const g = rebuild(q.req);
  const d = q.req.decision;
  if (!scorable(d)) return [];
  const coach = makeCoach();
  const p = d.player;
  const pick = q.grade?.opts.find((o) => o.i === q.coach);
  const reuse = q.grade?.worlds && pick?.w && pick.w.length === q.grade.worlds.length;
  let seed = 0x5eed;
  const worlds = reuse ? q.grade!.worlds! : makeWorlds(COACH_WORLDS, () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296));
  const idx = reuse ? [q.chosen] : [q.coach, q.chosen];
  const vals =
    d.kind === 'reaction'
      ? await coach.valueReaction(g, p, d.options.map((o) => o.action as Reaction), idx, worlds)
      : await coach.valueMain(g, p, d.options.map((o) => o.action as Action), idx, worlds);
  return vals.map((o) => ({ i: o.i, v: o.v, w: o.w!.map((_, k) => worldValue(o, k)) }));
}

/** Static matchup plan + deck tips for the human player (p = 0). */
export function matchupTips(g: Game, p: PlayerId = 0): string[] {
  const me = classify(knownCards(g, p, p)).arch;
  const opp = classify(knownCards(g, other(p), other(p))).arch;
  const tips: string[] = [`**Plan (${me} vs ${opp}):** ${PLAN_TEXT[`${me}>${opp}` as ProfileKey]}`];
  const top = topImpactCards(g.P(p), 3).filter((c) => c.iwd > 0.02);
  if (top.length) tips.push(`**Your game-winners:** ${top.map((c) => `${CARD_BY_ID[c.id]?.displayName} (+${Math.round(c.iwd * 100)} pts when drawn)`).join(', ')}. Keep them; sell other cards first.`);
  // analysis reports describe one list each: only use the one measured on this list (and on the rival's list)
  const name = impactDeckName(g.P(p));
  const rep = name === null ? undefined : (analysis as unknown as { decks: DeckReport[] }).decks.find((r) => r.deck === name);
  const t4 = rep?.tempo?.[3];
  if (t4 && t4.leadN >= 20 && t4.behindN >= 20 && Number.isFinite(t4.leadWr) && Number.isFinite(t4.behindWr))
    tips.push(`**Tempo:** this deck wins ${Math.round(t4.leadWr * 100)}% when ahead on Gigs after its 4th turn and ${Math.round(t4.behindWr * 100)}% when behind.`);
  const oppName = impactDeckName(g.P(other(p)));
  const mu = oppName === null ? undefined : rep?.matchups.find((m) => m.opp === oppName);
  if (mu && mu.games >= 10) tips.push(`**This matchup in bot testing:** ${Math.round(mu.wr * 100)}% over ${mu.games} games (on the play ${Math.round(mu.wrFirst * 100)}%, on the draw ${Math.round(mu.wrSecond * 100)}%).`);
  return tips;
}

/** Live warnings about the board (cheap; recomputed each decision). */
export function boardWarnings(g: Game, p: PlayerId = 0): string[] {
  const r = other(p);
  const out: string[] = [];
  const rivalUnits = g.units(r);
  const threat = rivalUnits.reduce((a, c) => a + g.stealCount(c), 0);
  const myBlockers = g.units(p).filter((c) => !c.spent && g.hasKw(c, 'blocker')).length;
  if (threat > 0) out.push(`Rival can steal up to ${threat} Gig${threat > 1 ? 's' : ''} next turn${myBlockers ? ` (you have ${myBlockers} ready blocker${myBlockers > 1 ? 's' : ''})` : ''}.`);
  const rivalBlockers = rivalUnits.filter((c) => !c.spent && g.hasKw(c, 'blocker')).length;
  if (rivalBlockers) out.push(`Rival has ${rivalBlockers} ready blocker${rivalBlockers > 1 ? 's' : ''} — Gig attacks can be redirected.`);
  const mine = g.P(p).gigs.length;
  const theirs = g.P(r).gigs.length;
  if (theirs >= 6) out.push(`Rival is at ${theirs} Gigs — one steal from winning at the start of their turn.`);
  else if (mine >= 6) out.push(`You are at ${mine} Gigs — keep them safe to win at the start of your turn.`);
  if (g.s.overtime) out.push('Overtime: 7 Gigs wins immediately.');
  out.push(...packageWarnings(g, p));
  return out;
}
