// Coach: turns the advisor bot's decision into human advice (why, alternatives, matchup plan, deck tips, warnings).
import { Game, other } from '../engine/engine';
import { CARD_BY_ID } from '../engine/cards';
import type { Agent, Decision, GameState, PlayerId } from '../engine/types';
import { HeuristicAgent } from './heuristic';
import { BEST_PROFILES, classify, PLAN_TEXT, type ProfileKey } from './archetype';
import { GIG_SWING, knownCards } from './eval';
import { topImpactCards } from './impact';
import analysis from '../data/analysis.json';
import type { DeckReport } from '../analysis/analyze';

/** Coach configuration — chosen by scripts/coach-eval.ts (see reports/coach-eval-latest.md). */
export const COACH_CONFIG = { profiles: BEST_PROFILES, impact: 40, deep: 12, sellLookahead: 3, deepReactions: 3 };
/** The coach before the review-driven refinement (kept for comparisons). */
export const COACH_CONFIG_V1 = { profiles: BEST_PROFILES, impact: 40, deep: 12 };

export function makeCoach() {
  return new HeuristicAgent({ name: 'Coach', ...COACH_CONFIG });
}

/** Evaluation points → "Gig swing". */
const gigs = (delta: number) => delta / GIG_SWING;

/** Decisions the coach advises on. Not 'pay' (which Eddie or Legend pays a cost): bots never get it, so the coach has no view. */
export function coachAdvises(d: Decision): boolean {
  return d.kind !== 'pay';
}

export interface Advice {
  index: number;
  why: string;
  alternatives: { index: number; label: string; gap: string; gapGigs: number }[];
}

export async function advise(g: Game, d: Decision): Promise<Advice> {
  const coach = makeCoach();
  const [index] = await coach.decide(g, d);
  let why = coach.lastThought;
  const alternatives: Advice['alternatives'] = [];
  const picked = d.options[index]?.label ?? '';
  if (d.kind === 'action' && /^Sell/.test(picked) && !coach.lastAlternatives.length) {
    why = `${picked}: one sell a turn is your mana growth, and this is the least valuable card in hand for your deck (by bot-match telemetry).`;
  } else if (d.kind === 'action' && coach.lastAlternatives.length) {
    const best = coach.lastAlternatives.find((a) => a.index === index) ?? coach.lastAlternatives[0];
    const label = d.options[index]?.label ?? best.label;
    const vsPass = gigs(best.delta);
    why = /Sell/.test(label)
      ? `${label}: selling one card a turn is your mana growth. This is the least valuable card for your deck right now.`
      : `${label} — ${vsPass >= 0.05 ? `worth about ${vsPass.toFixed(1)} Gigs more than passing` : 'roughly even with passing; the alternatives are worse'}.`;
    for (const a of coach.lastAlternatives) {
      if (a.index === index) continue;
      const gap = gigs(best.delta - a.delta);
      alternatives.push({ index: a.index, label: a.label, gap: gap < 0.05 ? 'about as good' : `−${gap.toFixed(1)} Gigs`, gapGigs: Math.max(0, gap) });
    }
  }
  // other decisions (reactions, targets): turn the bot's raw scores into plain words
  const m = why.match(/^(.*?) \((?:eval|projected) (-?[\d.]+) vs (?:pass )?(-?[\d.]+)\)$/);
  if (m) {
    const diff = gigs(+m[2] - +m[3]);
    why = `${m[1]} — ${Math.abs(diff) < 0.05 ? 'about even with doing nothing' : diff > 0 ? `saves about ${diff.toFixed(1)} Gigs compared with not acting` : 'the least bad option here'}.`;
  }
  return { index, why, alternatives };
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

/** advise() for a serialised position: rebuilds the game and asks the same coach. */
export function adviseRequest(q: CoachRequest): Promise<Advice> {
  const g = new Game(q.state, [noAgent, noAgent]);
  g.pending = q.pending.map((x) => ({ ...x, run: async () => undefined }));
  return advise(g, q.decision);
}

export interface MoveGrade {
  turn: number;
  chose: string;
  coach: string;
  /** Gigs given up vs the coach's pick; null when the move was outside the coach's shortlist */
  gap: number | null;
  verdict: 'agree' | 'close' | 'miss';
}

/** Grade a human decision against the coach's advice for the same spot. */
export function gradeMove(d: Decision, chosen: number, a: Advice, turn: number): MoveGrade {
  const chose = d.options[chosen]?.label ?? '?';
  const coach = d.options[a.index]?.label ?? '?';
  if (chosen === a.index) return { turn, chose, coach, gap: 0, verdict: 'agree' };
  const alt = a.alternatives.find((x) => x.index === chosen);
  const gap = alt ? alt.gapGigs : null;
  return { turn, chose, coach, gap, verdict: gap !== null && gap < 0.15 ? 'close' : 'miss' };
}

/** Static matchup plan + deck tips for the human player (p = 0). */
export function matchupTips(g: Game, p: PlayerId = 0): string[] {
  const me = classify(knownCards(g, p, p)).arch;
  const opp = classify(knownCards(g, other(p), other(p))).arch;
  const tips: string[] = [`**Plan (${me} vs ${opp}):** ${PLAN_TEXT[`${me}>${opp}` as ProfileKey]}`];
  const name = g.P(p).name;
  const top = topImpactCards(name, 3).filter((c) => c.iwd > 0.02);
  if (top.length) tips.push(`**Your game-winners:** ${top.map((c) => `${CARD_BY_ID[c.id]?.displayName} (+${Math.round(c.iwd * 100)} pts when drawn)`).join(', ')}. Keep them; sell other cards first.`);
  const rep = (analysis as unknown as { decks: DeckReport[] }).decks.find((r) => r.deck === name);
  const t4 = rep?.tempo?.[3];
  if (t4 && t4.leadN >= 20 && t4.behindN >= 20 && Number.isFinite(t4.leadWr) && Number.isFinite(t4.behindWr))
    tips.push(`**Tempo:** this deck wins ${Math.round(t4.leadWr * 100)}% when ahead on Gigs after its 4th turn and ${Math.round(t4.behindWr * 100)}% when behind.`);
  const mu = rep?.matchups.find((m) => m.opp === g.P(other(p)).name);
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
  return out;
}
