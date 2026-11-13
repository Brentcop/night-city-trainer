// Bot difficulty tiers, shared by Play, the Matchup Lab, tournaments (browser + CLI) and replays.
// Chosen by head-to-head testing (docs/BOT_TOOLKIT.md §6, docs/IMPROVEMENT_BACKLOG.md WP-D1 / WP-D2):
//   Easy   — the Fast bot: plays by simple rules, no lookahead (it never reads the evaluation weights); since SIM_VERSION 8
//            it skips a Program that would do nothing (easyGuard).
//   Medium — the Lookahead bot: scores every action one step ahead with the tuned matchup profiles.
//   Hard   — the Deep bot: rolls out the rest of its turn and the rival's whole reply for its best 3 options and plays
//            out each block / reaction; the plain mulligan rule and no card impact since SIM_VERSION 6; picks the card
//            to sell by rollout among its 3 most sellable (sellLookahead 3) since SIM_VERSION 7.
// Medium and Hard (and the coach) evaluate with DEFAULT_WEIGHTS, the fitted set since SIM_VERSION 6 (goSolo 0 since 8).
// Paired botcheck, meta decks --per 10, on SIM_VERSION 8 (2026-11-13): Hard vs Medium 67.0% [64.6, 69.5]; Medium vs Easy
// 79.8% [77.1, 82.4]. Bot time per game (one thread, meta decks): Easy 0.004 s, Medium 0.04 s, Hard 1.0 s.
// Tournaments can also mix Hard and Medium: each seat of each game is Hard or Medium, decided by the game seed,
// so a replay rebuilds exactly the same bots.
// Bot fixes change play for every tier and the legacy names alike (the owner chose to fix forward, 2026-11-10): events
// recorded before a fix replay identically only with the code they were recorded with. Same code + same seed = same game.
import { HeuristicAgent, type HeuristicOptions } from './heuristic';
import { BEST_PROFILES } from './archetype';

export type Tier = 'easy' | 'medium' | 'hard';

/** A tier's settings as plain data (the HeuristicOptions a tier sets; `profiles: 'best'` = BEST_PROFILES). */
export type TierSettings = Pick<HeuristicOptions, 'lookahead' | 'noise' | 'deep' | 'deepAttacks' | 'deepReactions' | 'sellLookahead' | 'mulligan' | 'easyGuard'> & { profiles?: 'best' };

/**
 * Each tier's settings: the one source for makeTierBot and for the scripts' worker specs (TIER_SPECS and HARD_SPEC in
 * scripts/agent-spec.ts: botcheck, tune, the benchmark, package-scoring). tests/impact-uses.test.ts checks that a spec
 * builds exactly the tier's bot.
 *  - Hard: card impact (impact 0 vs 40: 49.7% [49.1, 50.3] on all decks) and its mulligan keep dropped in SIM_VERSION 6;
 *    the sold card chosen by rollout among the 3 most sellable since SIM_VERSION 7 (sellLookahead 3 vs 0: 51.7%
 *    [50.2, 53.1] meta); attack rollouts (deepAttacks) measured no gain (reports/refine-results.md).
 *  - Easy: skips Programs that would do nothing since SIM_VERSION 8 (easyGuard, BOT-F).
 */
export const TIER_SETTINGS: Readonly<Record<Tier, Readonly<TierSettings>>> = {
  easy: { lookahead: false, noise: 0, easyGuard: true },
  medium: { noise: 0.15, profiles: 'best' },
  hard: { noise: 0.15, deep: 3, deepAttacks: 0, deepReactions: 3, sellLookahead: 3, mulligan: 'plain', profiles: 'best' },
};

export type BotChoice = Tier | 'mixed';

export const TIERS: Record<Tier, { label: string; blurb: string; speed: string }> = {
  easy: { label: 'Easy', blurb: 'Plays by simple rules. Good for learning the game.', speed: 'instant' },
  medium: { label: 'Medium', blurb: 'Looks one move ahead and knows its matchup plan.', speed: 'fast' },
  hard: { label: 'Hard', blurb: 'Plays out your whole reply, and its own blocks, before it acts. The strongest bot.', speed: '~0.1 s a move' },
};
export const TOURNEY_BOTS: { key: BotChoice; label: string; blurb: string }[] = [
  { key: 'hard', label: 'All Hard', blurb: 'Most accurate results, slowest' },
  { key: 'mixed', label: 'Hard + Medium mix', blurb: 'Each seat is Hard or Medium at random: adds human-like variance' },
  { key: 'medium', label: 'All Medium', blurb: 'Good results, ~20× quicker than Hard' },
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
  const { profiles, ...rest } = TIER_SETTINGS[t];
  return new HeuristicAgent({ ...rest, name, seed, profiles: profiles === 'best' ? BEST_PROFILES : null });
}

/** The bot for a game seat. `seed` is the seat's seed (game seed for seat A, +7777 for seat B). */
export function makeTierBot(level: string, seed: number, name?: string) {
  const bot = tierBot(level, seed, name);
  // a label for telemetry only (HeuristicAgent.configLabel); play never reads it
  const t = tierOf(level);
  bot.tier = t === 'mixed' ? `mixed:${bot.opts.deep ? 'hard' : 'medium'}` : level;
  return bot;
}

function tierBot(level: string, seed: number, name?: string) {
  // the pre-tier Deep bot (no card impact), kept for older recorded events and comparisons
  if (level === 'deep') return new HeuristicAgent({ name, seed, noise: 0.15, deep: 3, profiles: BEST_PROFILES });
  // Hard as first released (before attack rollouts), kept for comparisons and for the label on older recorded events
  if (level === 'hard-v1') return new HeuristicAgent({ name, seed, noise: 0.15, deep: 3, impact: 40, profiles: BEST_PROFILES });
  const t = tierOf(level);
  if (t === 'mixed') return tierAgent((Math.imul(seed, 2654435761) >>> 15) & 1 ? 'hard' : 'medium', seed, name);
  return tierAgent(t, seed, name);
}
