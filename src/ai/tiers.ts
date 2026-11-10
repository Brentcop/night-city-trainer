// Bot difficulty tiers, shared by Play, the Matchup Lab, tournaments (browser + CLI) and replays.
// Chosen by head-to-head testing (reports/bot-tiers.log, docs/BOT_TOOLKIT.md §6):
//   Easy   — the Fast bot: plays by simple rules, no lookahead.
//   Medium — the Lookahead bot: scores every action one step ahead with the tuned matchup profiles.
//   Hard   — the Deep bot plus card impact: rolls out the rest of its turn and the rival's whole reply for its best
//            3 options, values cards by how much they swing games for its deck (bot-match telemetry), and since the
//            review-driven refinement also plays out each block / reaction (wins 56% vs the previous Hard, 168 games).
// Measured before the 2026-11 review fixes (168 games each, every meta pairing; not re-measured since): Easy wins 37.5%
// vs Medium; Medium vs the Deep bot is a tie (49.4%); Hard wins 52.4% vs the Deep bot and makes far fewer blunders by
// the coach oracle (reports/coach-eval-latest.md). The 56% above is from the same period.
// Tournaments can also mix Hard and Medium: each seat of each game is Hard or Medium, decided by the game seed,
// so a replay rebuilds exactly the same bots.
// Bot fixes change play for every tier and the legacy names alike (the owner chose to fix forward, 2026-11-10): events
// recorded before a fix replay identically only with the code they were recorded with. Same code + same seed = same game.
import { HeuristicAgent } from './heuristic';
import { BEST_PROFILES } from './archetype';

export type Tier = 'easy' | 'medium' | 'hard';
/** Hard also rolls out its best N attack options (set by reports/refine-*.md). */
const HARD_DEEP_ATTACKS = 0; // attack rollouts measured no gain (reports/refine-results.md)
export type BotChoice = Tier | 'mixed';

export const TIERS: Record<Tier, { label: string; blurb: string; speed: string }> = {
  easy: { label: 'Easy', blurb: 'Plays by simple rules. Good for learning the game.', speed: 'instant' },
  medium: { label: 'Medium', blurb: 'Looks one move ahead and knows its matchup plan.', speed: 'fast' },
  hard: { label: 'Hard', blurb: 'Plays out your whole reply, and its own blocks, before it acts. The strongest bot.', speed: '~0.1 s a move' },
};
export const TOURNEY_BOTS: { key: BotChoice; label: string; blurb: string }[] = [
  { key: 'hard', label: 'All Hard', blurb: 'Most accurate results, slowest' },
  { key: 'mixed', label: 'Hard + Medium mix', blurb: 'Each seat is Hard or Medium at random: adds human-like variance' },
  { key: 'medium', label: 'All Medium', blurb: 'Good results, ~4× quicker than Hard' },
  { key: 'easy', label: 'All Easy', blurb: 'Quick sanity checks only' },
];

/** Older names, still used by recorded events and CLI flags. Labels map to tiers; `deep` and `hard-v1` keep their original
 *  settings (search depth, impact, reactions), but share every later fix to the bot's choices. */
const LEGACY: Record<string, Tier> = { fast: 'easy', lookahead: 'medium', deep: 'hard', 'hard-v1': 'hard' };
export const tierOf = (level: string): Tier | 'mixed' => (level in LEGACY ? LEGACY[level] : (level as Tier | 'mixed'));
export const tierLabel = (level: string) => {
  const t = tierOf(level);
  return t === 'mixed' ? 'Hard + Medium' : (TIERS[t as Tier]?.label ?? level);
};

function tierAgent(t: Tier, seed: number, name?: string) {
  if (t === 'easy') return new HeuristicAgent({ name, lookahead: false, seed });
  if (t === 'hard') return new HeuristicAgent({ name, seed, noise: 0.15, deep: 3, impact: 40, deepAttacks: HARD_DEEP_ATTACKS, deepReactions: 3, profiles: BEST_PROFILES });
  return new HeuristicAgent({ name, seed, noise: 0.15, profiles: BEST_PROFILES });
}

/** The bot for a game seat. `seed` is the seat's seed (game seed for seat A, +7777 for seat B). */
export function makeTierBot(level: string, seed: number, name?: string) {
  // the pre-tier Deep bot (no card impact), kept for older recorded events and comparisons
  if (level === 'deep') return new HeuristicAgent({ name, seed, noise: 0.15, deep: 3, profiles: BEST_PROFILES });
  // Hard as first released (before attack rollouts), kept for comparisons and for the label on older recorded events
  if (level === 'hard-v1') return new HeuristicAgent({ name, seed, noise: 0.15, deep: 3, impact: 40, profiles: BEST_PROFILES });
  const t = tierOf(level);
  if (t === 'mixed') return tierAgent((Math.imul(seed, 2654435761) >>> 15) & 1 ? 'hard' : 'medium', seed, name);
  return tierAgent(t, seed, name);
}
