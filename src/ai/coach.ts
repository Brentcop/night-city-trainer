// Coach: turns the advisor bot's decision into human advice (why, alternatives, matchup plan, deck tips, warnings).
import { Game, other } from '../engine/engine';
import { CARD_BY_ID } from '../engine/cards';
import type { Action, Agent, Decision, GameState, Gig, Opt, PlayerId, Reaction } from '../engine/types';
import { activeSteer, holdCredit, obtainableOf, packageFacts, partnerName, seatPackages, steerValue, steerWants, type PackageFacts, type SteerKind } from './packages';
import { HeuristicAgent, standardError, worldValue, type DecisionScores } from './heuristic';
import { makeWorlds, type World } from './playOut';
import { BLUNDER } from './reviewer';
import { BEST_PROFILES, PLAN_TEXT, type ProfileKey } from './archetype';
import { DECIDED_EVAL, GIG_SWING, seatArchetype } from './eval';
import { handFeatures } from './mulligan';
import { behindText, gapFigure, gapSize, optionName } from '../lib/coachWords';
import { fixedTerms, withinNoise } from '../lib/gameReview';
import type { SynergyRole } from '../content/synergies/index';
import { impactBasis, impactDeckName, topImpactCards } from './impact';
import { liftGate, liftLabel, type SeatLift } from './packageLift';
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
/**
 * Coach configuration — chosen by scripts/coach-eval.ts (see reports/coach-eval-latest.md), then shared worlds (INFO-1).
 * `mulligan: 'plain'`: the keep rule Hard uses since SIM_VERSION 6, without the card-impact keep (measured 48.9% against
 * no impact, docs/BOT_TOOLKIT.md §5), so the coach does not teach a keep that measured worse.
 */
export const COACH_CONFIG = { profiles: BEST_PROFILES, impact: 40, deep: 6, deepWorlds: COACH_WORLDS, sellLookahead: 3, deepReactions: COACH_WORLDS, mulligan: 'plain' as const };
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

/** Decisions worth asking the coach about: one it advises on, with a choice to make (a one-option decision is forced). */
export function coachWorthAsking(d: Decision): boolean {
  return coachAdvises(d) && d.options.length >= 2;
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

/**
 * A gap is a close call when it is under CLOSE_GIGS, or within 2 paired standard errors of the coach's pick; a gap that
 * is about the same in every world (paired SE under 1 point: fixed evaluation terms, not measured, COACH-14) is given a typical SE, so it
 * is a close call up to 0.5 Gigs. The Game review's own noise test (src/lib/gameReview.ts withinNoise), so the coach
 * and the review always agree.
 */
export function isClose(gap: number, se?: number): boolean {
  return withinNoise(gap, se);
}

/**
 * The coach's reason for a sell it chose by rule. The card values include bot-match card impact: say where it comes from
 * (this list's own games, or pooled from other decks when the list has none), and claim no data when there is none.
 */
export function sellWhy(picked: string, basis: 'own' | 'pooled' | 'none'): string {
  const base = `${picked}: one sell a turn is your mana growth, and this is the least valuable card in hand for your deck`;
  return `${base}${valueSource(basis)}.`;
}

/** Where the card values come from, as a parenthesis (empty when there is no bot-match data). */
function valueSource(basis: 'own' | 'pooled' | 'none'): string {
  if (basis === 'own') return ' (by bot-match telemetry on this list)';
  if (basis === 'pooled') return ' (card values pooled from bot matches of other decks; this list has none of its own)';
  return '';
}

/**
 * The reason for a sell the coach chose by playing out the few cards it can best spare (sellLookahead): how it was
 * actually chosen, not "the least valuable card".
 */
export function sellPlayedOutWhy(picked: string, basis: 'own' | 'pooled' | 'none', compared: number): string {
  return `${picked}: one sell a turn is your mana growth. Of the ${compared} cards in hand you can best spare by card value${valueSource(basis)}, selling this one came out best when the coach played each out.`;
}

/** How a game-deciding difference reads, from the values (points) of the better move and of the other one. */
function decidedWords(better: number, worse: number, other: string): string {
  if (better >= DECIDED_EVAL) return `wins the game in the coach's play-outs (${other} does not)`;
  if (worse <= -DECIDED_EVAL) return `${other} instead loses the game in the coach's play-outs`;
  return `the coach's play-outs say this decides the game, compared with ${other}`;
}

/** An alternative's tag: "close call", "−0.4 ± 0.1 Gigs", "more than 3 Gigs behind", or how the game ends in the play-outs. */
function altTag(pick: GradedOption, o: GradedOption, gap: number, se: number | undefined, close: boolean): string {
  if (close) return 'close call';
  if (gapSize(gap) === 'decided') {
    if (o.v <= -DECIDED_EVAL) return 'loses the game in the play-outs';
    if (pick.v >= DECIDED_EVAL) return 'gives up a win in the play-outs';
  }
  return behindText(gap, se);
}

/**
 * The best other options the coach valued (main phase, the sells it compared, or reactions), best first, one per name:
 * a move with the same name as the pick (another copy of the same card) or as one already listed is left out.
 */
function alternativesOf(d: Decision, index: number, grade: GradeBasis | undefined, max = 3): Advice['alternatives'] {
  const out: Advice['alternatives'] = [];
  const mine = grade?.opts.find((o) => o.i === index);
  if (!grade || !mine) return out;
  const seen = new Set([d.options[index]?.label]);
  for (const o of [...grade.opts].sort((a, b) => b.v - a.v)) {
    if (out.length >= max) break;
    const raw = d.options[o.i]?.label;
    if (o.i === index || seen.has(raw)) continue;
    seen.add(raw);
    const { gap, se } = gapOf(mine, o);
    const close = isClose(gap, se);
    out.push({ index: o.i, label: optionName(d, o.i), gap: altTag(mine, o, gap, se, close), gapGigs: Math.max(0, gap), close, ...(se !== undefined ? { se } : {}) });
  }
  return out;
}

/**
 * Why the coach picked `index` over the "do nothing" option `none` (End turn, or No reaction): what it is worth over
 * doing nothing, or, when doing nothing is the pick, what the best other move would cost. `nothing` is how the reason
 * names doing nothing ("ending the turn", "no reaction"). Null when the scores needed are missing.
 */
function vsNothingWhy(d: Decision, index: number, none: number, grade: GradeBasis | undefined, nothing: string): string | null {
  const pick = grade?.opts.find((o) => o.i === index);
  if (!grade || !pick) return null;
  const name = optionName(d, index);
  const pickLabel = d.options[index]?.label;
  if (index === none) {
    const other = [...grade.opts].sort((a, b) => b.v - a.v).find((o) => o.i !== index && d.options[o.i]?.label !== pickLabel);
    if (!other) return `${name}: nothing else here is worth doing.`;
    const otherName = optionName(d, other.i);
    const { gap, se } = gapOf(pick, other);
    if (gapSize(Math.max(0, gap)) === 'decided') return `${name}: the best other move, ${otherName}, ${other.v <= -DECIDED_EVAL ? 'loses the game' : 'gives up a win'} in the coach's play-outs.`;
    if (isClose(gap, se)) {
      if (gap < CLOSE_GIGS) return `${name}: about as good as the best other move, ${otherName}; either is fine.`;
      if (fixedTerms(se)) return `${name}: the coach leans this way over ${otherName} (${behindText(gap)}), but the play-outs all give about the same difference, so it comes from fixed terms of its evaluation, not from the play-outs: too little to call.`;
      return `${name}: the coach leans this way, but against ${otherName} it is too noisy to call (${behindText(gap, se)}; its play-outs disagree).`;
    }
    return `${name}: nothing else scores better. The best other move, ${otherName}, comes out ${gapSize(gap) === 'figure' ? 'about ' : ''}${gapFigure(gap)} behind.`;
  }
  const base = grade.opts.find((o) => o.i === none);
  if (!base) {
    const next = alternativesOf(d, index, grade, 1)[0];
    return next ? `${name} — the best of the moves the coach weighed (next: ${next.label}, ${next.gap}).` : `${name} — the best of the moves the coach weighed.`;
  }
  const delta = gigs(pick.v - base.v);
  if (gapSize(Math.max(0, delta)) === 'decided') return `${name} — ${decidedWords(pick.v, base.v, nothing)}.`;
  if (delta >= 0.05) return `${name} — worth ${gapSize(delta) === 'figure' ? 'about ' : ''}${gapFigure(delta)} more than ${nothing}.`;
  const next = alternativesOf(d, index, grade, 3).find((a) => a.index !== none);
  return `${name} — about as good as ${nothing}${next ? `, and ahead of ${next.label} (${next.gap})` : ''}; the coach leans this way.`;
}

/**
 * The mulligan in words: what the coach's keep rule (the plain rule the bots use, src/ai/mulligan.ts) looks at, and what
 * this hand has. `mulligan`: the coach's pick.
 */
export function mulliganWhy(g: Game, p: PlayerId, mulligan: boolean): string {
  const f = handFeatures(g, p);
  const rule = 'The coach keeps a hand with at least one Unit costing 4 or less, three cards costing 4 or less and a card it can sell, so it can play on curve and sell for Eddies.';
  if (!mulligan) {
    const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
    return `Keep: this hand has ${n(f.cheapUnits, 'Unit', 'Units')} costing 4 or less, ${n(f.cheap, 'card', 'cards')} costing 4 or less and ${n(f.sellable, 'card', 'cards')} it can sell. ${rule}`;
  }
  const missing: string[] = [];
  if (f.cheapUnits < 1) missing.push('no Unit costing 4 or less');
  if (f.cheap < 3) missing.push(`only ${f.cheap} card${f.cheap === 1 ? '' : 's'} costing 4 or less`);
  if (f.sellable < 1) missing.push('nothing it can sell');
  return `Mulligan: this hand has ${missing.join(', ')}. ${rule}`;
}

/**
 * `lift`: the measured lift of the deciding seat's packages (packageLift.ts seatLift; undefined or null = no synergy
 * report, so package notes are worded as unmeasured ideas).
 */
export async function advise(g: Game, d: Decision, lift?: SeatLift): Promise<Advice> {
  const coach = makeCoach();
  const [index] = await coach.decide(g, d);
  const grade = basisOf(coach.lastScores);
  let why = coach.lastThought;
  const picked = d.options[index]?.action;
  if (d.kind === 'action' && picked?.type === 'sell') {
    // a sell: chosen by playing out the few most sellable cards when there were several, else by card value
    const hand = d.options.map((o) => o.action as Action).flatMap((a) => (a?.type === 'sell' ? [g.c(a.uid).defId] : []));
    const basis = impactBasis(g.P(d.player), hand);
    const name = optionName(d, index);
    why = grade?.kind === 'sell' && grade.opts.length > 1 ? sellPlayedOutWhy(name, basis, grade.opts.length) : sellWhy(name, basis);
  } else if (d.kind === 'action' || d.kind === 'reaction') {
    const none = d.options.findIndex((o) => o.action?.type === (d.kind === 'action' ? 'pass' : 'endReact'));
    const said = vsNothingWhy(d, index, none, grade, d.kind === 'action' ? 'ending the turn' : 'no reaction');
    if (said) why = said;
  } else if (d.kind === 'yesno' && d.tag === 'mulligan') {
    why = mulliganWhy(g, d.player, d.options[index]?.key === 'yes');
  }
  // anything still in the bot's raw form (scored without the values above): plain words
  const m = why.match(/^(.*?) \((?:eval|projected) (-?[\d.]+) vs (?:pass )?(-?[\d.]+)\)$/);
  if (m) {
    const diff = gigs(+m[2] - +m[3]);
    const label = optionName({ kind: d.kind, options: [{ label: m[1] }] }, 0);
    why = `${label} — ${Math.abs(diff) < 0.05 ? 'about as good as doing nothing' : diff > 0 ? `saves ${gapSize(diff) === 'figure' ? 'about ' : ''}${gapFigure(diff)} compared with doing nothing` : 'the least bad option here'}.`;
  }
  const alternatives = alternativesOf(d, index, grade);
  const notes = packageNotes(g, d, index, lift);
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
 * The player's own packages the coach may name (INFO-8, packageLift.ts): with a synergy report, only those whose
 * measured lift has an interval above 0; without one, all of them (each note then says it is unmeasured).
 */
function speakablePackages(g: Game, p: PlayerId, lift: SeatLift | undefined) {
  return seatPackages(g, p).filter((x) => liftGate(lift, x.id) !== 'hidden');
}

/** Labels for the packages a note names, each package's label once per advice. */
function labeller(lift: SeatLift | undefined) {
  const done = new Set<string>();
  return (pkgs: readonly { id: string; name: string }[]) =>
    liftLabel(
      lift,
      pkgs.filter((x) => !done.has(x.id) && done.add(x.id)),
    );
}
const withLabel = (note: string, label: string) => (label ? `${note} ${label}` : note);

/**
 * Plain-words notes when a synergy package the player's own list is built around is the reason for the advice
 * (package names come from the catalogue, src/content/synergies): which cards to keep when selling, and what a Gig
 * choice does for a Street Cred or Gig-value package. Empty when the list is built around none. Gated by `lift`
 * (INFO-8): only packages with a measured lift above 0, labelled as an association; with no report, every package,
 * labelled as unmeasured.
 */
export function packageNotes(g: Game, d: Decision, index: number, lift?: SeatLift): string[] {
  const p = d.player;
  const pkgs = speakablePackages(g, p, lift);
  if (!pkgs.length) return [];
  const facts = packageFacts(g, p, pkgs);
  const label = labeller(lift);
  const out: string[] = [];
  const opt = d.options[index];
  if (!opt) return out;
  if (d.kind === 'action' && opt.action?.type === 'sell') {
    // selling a scarce piece itself: say what it gives up (the coach rated everything else in hand worse to lose)
    const sold = g.c(opt.action.uid).defId;
    const fs = facts.find((x) => x.pkg.roles.has(sold) && holdCredit([x], sold) >= 0.25);
    const soldPartner = fs && partnerName(g, p, fs, sold);
    if (fs && soldPartner) out.push(withLabel(`Selling ${cardName(sold)} gives up ${scarcityText(fs, sold)} (it pairs with ${soldPartner}); the coach still rates it the card in hand you can best spare right now.`, label([fs.pkg])));
    // name up to two scarce pieces kept in hand (not the card sold), with a partner the player can still get
    const seen = new Set([sold]);
    for (const u of g.P(p).hand) {
      const id = g.c(u).defId;
      if (seen.has(id)) continue;
      seen.add(id);
      const f = facts.find((x) => x.pkg.roles.has(id) && holdCredit([x], id) >= 0.25);
      const partner = f && partnerName(g, p, f, id);
      if (!f || !partner) continue;
      out.push(withLabel(`Keep ${cardName(id)}: it is ${scarcityText(f, id)}, and it pairs with ${partner} in your deck.`, label([f.pkg])));
      if (out.length >= 2) break;
    }
    return out;
  }
  if (d.kind !== 'gig' && d.kind !== 'gigValue') return out;
  const kinds = activeSteer(facts);
  const chosen = gigsAfter(g, p, d, opt);
  if (!kinds.length || !chosen) return out;
  for (const k of kinds) {
    // the coach picks Gigs by its rule (pkgSteer is 0 for bots and coach), so this is a side note, not its reason: it
    // says when another option suits the package better than the pick, and only otherwise names one that moves away
    const v = steerValue(k, chosen.mine, chosen.theirs);
    type Scored = { label: string; v: number; after: { mine: Gig[]; theirs: Gig[] } };
    const others: Scored[] = [];
    d.options.forEach((o, i) => {
      if (i === index) return;
      const after = gigsAfter(g, p, d, o);
      if (after) others.push({ label: o.label, v: steerValue(k, after.mine, after.theirs), after });
    });
    if (!others.length) continue;
    const named = pkgs.filter((x) => x.steer.includes(k));
    const head = `Side note for your deck's package (${named.map((x) => x.name).join(', ')}), which wants ${steerWants(k)}:`;
    const better = others.reduce((a, b) => (b.v > a.v ? b : a));
    const worse = others.reduce((a, b) => (b.v < a.v ? b : a));
    if (better.v > v + 1e-9) out.push(withLabel(`${head} ${better.label} would suit it better than the coach's pick (the coach picks Gigs by its own rule, not by the package).`, label(named)));
    else if (worse.v < v - 1e-9) out.push(withLabel(`${head} the coach's pick suits it as well as any option; ${worse.label} ${awayText(k, worse.after)}.`, label(named)));
  }
  return out;
}

/**
 * Live warnings for a Street Cred package the player's list is built around, while a payoff is in hand or in play.
 * Gated and labelled by `lift` as packageNotes are (INFO-8).
 */
export function packageWarnings(g: Game, p: PlayerId, lift?: SeatLift): string[] {
  const pkgs = speakablePackages(g, p, lift);
  if (!pkgs.length) return [];
  const facts = packageFacts(g, p, pkgs);
  const kinds = activeSteer(facts);
  const mine = g.streetCred(p) ?? 0;
  const theirs = g.streetCred(other(p)) ?? 0;
  const label = labeller(lift);
  const named = (k: SteerKind) => pkgs.filter((x) => x.steer.includes(k));
  const names = (k: SteerKind) => named(k).map((x) => x.name).join(', ');
  const out: string[] = [];
  if (kinds.includes('cred-low') && g.P(p).gigs.length && mine >= theirs) out.push(withLabel(`Your Street Cred (${mine}) is not below the rival’s (${theirs}); your deck wants it lower (${names('cred-low')}).`, label(named('cred-low'))));
  if (kinds.includes('cred-high') && mine <= theirs) out.push(withLabel(`Your Street Cred (${mine}) is not above the rival’s (${theirs}); your deck wants it higher (${names('cred-high')}).`, label(named('cred-high'))));
  if (kinds.includes('cred-20') && mine < 20) out.push(withLabel(`Your Street Cred (${mine}) is below 20; your deck wants 20 or more (${names('cred-20')}).`, label(named('cred-20'))));
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
  /** the deciding seat's package lift (INFO-8; packageLift.ts), absent when no synergy report is loaded */
  lift?: SeatLift;
}

export function coachRequest(g: Game, d: Decision, lift?: SeatLift): CoachRequest {
  const { log, trace } = g.s;
  g.s.log = [];
  g.s.trace = undefined;
  try {
    // a snapshot: the live game moves on after the human answers
    const state = structuredClone(g.s);
    if (trace) state.trace = [];
    return { state, decision: structuredClone(d), pending: g.pending.map((x) => ({ player: x.player, label: x.label })), ...(lift ? { lift } : {}) };
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
  return advise(rebuild(q), q.decision, q.lift);
}

/** A gap under this many Gigs is a close call whatever its spread (the scorecard's threshold before INFO-1). */
export const CLOSE_GIGS = 0.15;
/** A gap of this many Gigs or more (outside the noise) is a mistake: the reviewer's blunder line (BLUNDER, ≈ 0.4 Gigs). */
export const MISTAKE_GIGS = BLUNDER / GIG_SWING;

/**
 * How a move compares with the coach's pick, by value:
 *   agree       the coach's own pick (or a move with the same name: another copy of the same card), in a decision the
 *               coach values by play-outs (main phase, reactions, or a sell it compared)
 *   best        another move the coach values at least as high
 *   close       a close call: under CLOSE_GIGS behind, or within 2 paired standard errors (counts as fine)
 *   inaccuracy  behind by more than the noise, under MISTAKE_GIGS
 *   mistake     behind by MISTAKE_GIGS or more, outside the noise
 *   pending     being scored (a move the coach did not value: scoreMoveRequest)
 *   unscored    a choice the coach decides by rule and can't value (a target, a mode, a Gig pick, the mulligan),
 *               whether or not it matches the coach's pick ("Same as the coach's pick (not measured)"), or scoring failed
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

/** Verdicts the scorecard counts as fine (all of them measured: agreeing on a rule-decided choice is 'unscored'). */
export const FINE_VERDICTS: readonly MoveVerdict[] = ['agree', 'best', 'close'];

/**
 * Grade a human decision against the coach's advice for the same spot, by value: the move's own score in the coach's
 * worlds (from the advice, or `extra` from scoreMoveRequest), not its place in the shortlist. A move the coach did not
 * value in a decision it can score is 'pending' until scored (`extra` undefined); once scoring has run (`extra` given,
 * empty if it failed) a move still without a value is 'unscored'. Agreeing with a choice the coach made by rule (no
 * scores) measures nothing, so it is 'unscored' too, never 'agree'. `chose` and `coach` are the names the board shows
 * (src/lib/coachWords.ts optionName: End turn, No reaction, Keep hand / Mulligan).
 */
export function gradeMove(d: Decision, chosen: number, a: Advice, turn: number, extra?: readonly GradedOption[]): MoveGrade {
  const chose = optionName(d, chosen);
  const coach = optionName(d, a.index);
  const same = chosen === a.index || (d.options[chosen] !== undefined && d.options[chosen].label === d.options[a.index]?.label);
  if (same) return !scorable(d) && !a.grade ? { turn, chose, coach, gap: null, verdict: 'unscored' } : { turn, chose, coach, gap: 0, verdict: 'agree' };
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
  const me = seatArchetype(g, p);
  const opp = seatArchetype(g, other(p));
  const tips: string[] = [`**Plan (${me} vs ${opp}):** ${PLAN_TEXT[`${me}>${opp}` as ProfileKey]}`];
  const top = topImpactCards(g.P(p), 3).filter((c) => c.iwd > 0.02);
  // an association from pooled bot games (confounded: docs/BOT_TOOLKIT.md §5), so no instruction to keep them
  if (top.length) tips.push(`**Cards most associated with wins** (bot games with this list; an association, not proof that they win): ${top.map((c) => `${CARD_BY_ID[c.id]?.displayName} (+${Math.round(c.iwd * 100)} win-rate points when drawn)`).join(', ')}.`);
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

/** Live warnings about the board (cheap; recomputed each decision). `lift` gates the package warnings (INFO-8). */
export function boardWarnings(g: Game, p: PlayerId = 0, lift?: SeatLift): string[] {
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
  out.push(...packageWarnings(g, p, lift));
  return out;
}
