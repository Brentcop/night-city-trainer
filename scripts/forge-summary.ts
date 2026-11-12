// The forge's run summary (reports/forge/summary.md and the console), kept apart from scripts/forge.ts so it can be
// tested. It leads with the held-out paired result of each adopted change (or "no change adopted"), and lists the
// per-generation win rates as what they are: each generation's own new screening games, not a trend
// (docs/SYNERGIES.md "The tuner's result against the original"; the Deck Lab says it the same way).
import { formatGain, type PairedInterval } from '../src/lib/evidence';

export interface ForgeGenSummary {
  gen: number;
  /** the list's win rate on this generation's own screening games */
  baseline: number;
  /** how many screening games that was */
  baselineGames: number;
  /** 'kept', 'kept (could not tell: …)', 'kept (swap failed confirmation)', or the adopted change's label */
  change: string;
  /** the adopted change's held-out paired gain (fresh games, paired with the list it replaced) */
  gain?: PairedInterval;
}

export interface ForgeDeckSummary {
  name: string;
  gens: ForgeGenSummary[];
  /** games this deck's forge run played */
  games: number;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const adoptedOf = (d: ForgeDeckSummary) => d.gens.filter((h) => !h.change.startsWith('kept'));

/** The held-out result in words: each adopted change with its paired gain, or "no change adopted" with why. */
export function forgeResultText(d: ForgeDeckSummary): string {
  const adopted = adoptedOf(d);
  if (adopted.length) return `adopted ${adopted.map((h) => `${h.change}${h.gain ? ` (held-out ${formatGain(h.gain)})` : ''}`).join('; ')}`;
  const unsure = d.gens.filter((h) => h.change.startsWith('kept (could not tell')).map((h) => h.change.replace(/^kept \((.*)\)$/, '$1'));
  return `no change adopted${unsure.length ? ` (${unsure.join('; ')})` : ''}`;
}

/** "gen 1: 58.9% on 112 games" for each generation: the list's own score on that generation's new screening games. */
export function forgeGenerationsText(d: ForgeDeckSummary): string {
  return d.gens.map((h) => `gen ${h.gen}: ${pct(h.baseline)} on ${h.baselineGames} games`).join('; ');
}

/** The summary as Markdown. `ruleText` is describeRule(…). */
export function forgeSummaryMarkdown(decks: readonly ForgeDeckSummary[], ruleText: string): string {
  return [
    '# Forge summary',
    '',
    `Adoption rule: ${ruleText}.`,
    '',
    'Result: each adopted change with its held-out paired gain (fresh games that screening never used, the same seed, opponent and seat for both lists), or "no change adopted"; a "could not tell" change was not adopted. Each generation: the list being forged, scored on that generation\'s own new screening games — new games every generation, so not a trend and not comparable with the held-out gain.',
    '',
    '| Deck | Result (held-out, paired) | Each generation (its own screening games) | Games |',
    '|---|---|---|---|',
    ...decks.map((d) => `| ${d.name} | ${forgeResultText(d)} | ${forgeGenerationsText(d) || '—'} | ${d.games} |`),
  ].join('\n');
}
