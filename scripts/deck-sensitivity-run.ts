// The parts of scripts/deck-sensitivity.ts that tests can reach without running it: reading a configuration from the
// command line, building the jobs, and the console report. The statistics are in src/lib/deckSensitivity.ts.
import { TIER_SPECS, VARIANT_SPECS, type AgentSpec } from './agent-spec';
import type { MatchJob } from './worker';
import type { DeckSensitivityRow, SensitivityReport } from '../src/lib/deckSensitivity';
import { decksBeyond } from '../src/lib/deckSensitivity';
import type { DeckList } from '../src/engine/types';

/** Bot names the script plays as they are (the worker's `bot`): the tiers and the named variants. */
const NAMED: Readonly<Record<string, AgentSpec>> = { ...TIER_SPECS, ...VARIANT_SPECS };

/**
 * One configuration of the comparison: a tier or variant name (played as the worker's `bot`, so its games are the same
 * as rank-stability's and the tournaments'), or an AgentSpec (both seats get it, as botcheck's agentA / agentB).
 */
export type Config = { label: string; bot: string } | { label: string; spec: AgentSpec };

/**
 * Reads a configuration as botcheck and the benchmark take one: a tier or variant name (easy, medium, hard, hard-main),
 * a JSON AgentSpec ('{"deep":3}'; note `{}` is the Lookahead bot without the matchup profiles, not Medium), or a name
 * plus overrides ('medium+{"weights":{"blocker":-3.7}}': the name's settings as an AgentSpec, then the JSON's keys).
 * Throws an Error with the reason.
 */
export function parseConfig(text: string): Config {
  const t = text.trim();
  const named = (n: string) => NAMED[n.toLowerCase()];
  const plus = t.match(/^([\w-]+)\s*\+\s*(\{.*\})$/s);
  const asObject = (json: string): AgentSpec => {
    let v: unknown;
    try {
      v = JSON.parse(json);
    } catch (e) {
      throw new Error(`"${t}" is not valid JSON (${(e as Error).message})`);
    }
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`"${t}": a bot spec must be a JSON object`);
    return v as AgentSpec;
  };
  if (plus) {
    const base = named(plus[1]!);
    if (!base) throw new Error(`"${plus[1]}+…" needs one of ${Object.keys(NAMED).join(', ')} before the +`);
    return { label: t, spec: { ...base, ...asObject(plus[2]!) } };
  }
  if (t.startsWith('{')) return { label: t, spec: asObject(t) };
  if (named(t)) return { label: t.toLowerCase(), bot: t.toLowerCase() };
  throw new Error(`unknown configuration "${t}": a bot name (${Object.keys(NAMED).join(', ')}), a JSON AgentSpec, or name+{json}`);
}

/** One deal of the round robin: the seat-0 and seat-1 decks (indices), its seed and first player. */
export interface SensitivityDeal {
  a: number;
  b: number;
  seed: number;
  first: 0 | 1;
}

/** Every ordered pairing of `decks` decks, `per` deals each, seeds from `seed` on, first player alternating (rank-stability's layout). */
export function roundRobinDeals(decks: number, per: number, seed: number): SensitivityDeal[] {
  const out: SensitivityDeal[] = [];
  let s = seed;
  for (let x = 0; x < decks; x++) for (let y = 0; y < decks; y++) if (x !== y) for (let k = 0; k < per; k++) out.push({ a: x, b: y, seed: s++, first: (k % 2) as 0 | 1 });
  return out;
}

/** The jobs of one configuration: both seats piloted by it, on the given deals. */
export function jobsFor(config: Config, deals: readonly SensitivityDeal[], lists: readonly DeckList[]): MatchJob[] {
  return deals.map((d) => {
    const job = { a: lists[d.a]!, b: lists[d.b]!, seed: d.seed, first: d.first };
    return 'bot' in config ? { ...job, bot: config.bot } : { ...job, bot: 'lookahead', agentA: config.spec, agentB: config.spec };
  });
}

const pts = (x: number, digits = 1) => (Number.isFinite(x) ? (100 * x).toFixed(digits) : '–');
const signed = (x: number, digits = 1) => (Number.isFinite(x) ? `${x >= 0 ? '+' : '−'}${Math.abs(100 * x).toFixed(digits)}` : '–');
const num = (x: number, digits = 2) => (Number.isFinite(x) ? (x < 0 ? `−${Math.abs(x).toFixed(digits)}` : x.toFixed(digits)) : '–');
const pval = (p: number) => (!Number.isFinite(p) ? '–' : p < 0.001 ? '<0.001' : p.toFixed(3));
const rank = (r: number) => String(+r.toFixed(1));
/** a feature's third boundary: at most two decimals, a minus sign for negatives */
const cut = (x: number) => String(+x.toFixed(2)).replace(/^-/, '−');
const cell = (s: string) => s.replace(/\|/g, '\\|');

/** The markdown table of the given rows (the decks beyond 2 SE). */
export function rowsTable(rows: readonly DeckSensitivityRow[]): string[] {
  const out = ['| Deck | Source | Pill | Base | Change | Change (points) | ± 2 SE | z | Rank base → change |', '|---|---|---|---|---|---|---|---|---|'];
  for (const r of rows)
    out.push(
      `| ${cell(r.name)} | ${r.source} | ${r.features.combo} | ${pts(r.base.wr)}% | ${pts(r.change.wr)}% | ${signed(r.diff)} | ${pts(2 * r.se)} | ${num(r.z, 1)} | ${rank(r.base.rank)} → ${rank(r.change.rank)} |`,
    );
  return out;
}

/** The console report: the decks beyond 2 SE as a markdown table, then the summary lines. */
export function reportLines(rep: SensitivityReport, o: { base: string; change: string }): string[] {
  const s = rep.summary;
  const out: string[] = [];
  out.push(`Base: ${o.base}`, `Change: ${o.change}`, '');
  out.push(
    `Decks whose win rate against the field changed beyond 2 SE: ${s.beyond2} of ${s.decks} (chance: about ${s.chance2.toFixed(1)}, ${s.decks} × P(|Z| > 2) = 4.55%); ` +
      `beyond 3 SE: ${s.beyond3} (chance: about ${s.chance3.toFixed(2)}, 0.27%). The chance figures take the decks' changes as independent normals.`,
  );
  const beyond = decksBeyond(rep.rows, 2);
  if (beyond.length) out.push('', ...rowsTable(beyond));
  out.push('');
  out.push(`Spearman of the two deck orders: ${s.spearman.rho.toFixed(3)} [${s.spearman.lower.toFixed(3)}, ${s.spearman.upper.toFixed(3)}] (paired bootstrap 95%, ${s.spearman.boot} resamples; deals resampled within each pairing)`);
  out.push(`Same result on the same deal: ${pts(s.sameWinner)}% of ${s.deals.toLocaleString('en-US')} deals`);
  out.push(`Mean |change| ${pts(s.meanAbsChange)} points; spread of the changes across decks ${pts(s.spread)} points, of which noise ${pts(s.noise)} (root mean square SE), so about ${pts(s.trueSpread)} points beyond the noise`);
  out.push('', 'The change against list features (Pearson r, Spearman rho, permutation p; mean change in the lowest and highest third of decks by the feature):');
  for (const f of s.features)
    out.push(
      `  ${f.label.padEnd(36)} r ${num(f.pearson).padStart(5)}  rho ${num(f.spearman).padStart(5)}  p ${pval(f.p).padStart(6)}   ` +
        `≤ ${cut(f.low.upTo)}: ${signed(f.low.mean)} (${f.low.n} decks), ≥ ${cut(f.high.from)}: ${signed(f.high.mean)} (${f.high.n} decks)`,
    );
  out.push('', 'Families against the rest of the field (mean change in points, the difference ± 1.96 Welch SE with decks as the units, permutation p):');
  const decksWord = (n: number) => `${n} deck${n === 1 ? '' : 's'}`;
  for (const f of s.families)
    out.push(
      !f.n || !f.restN
        ? `  ${f.label} [${f.rule}]: ${f.n ? 'every deck' : 'no deck'} of this field`
        : `  ${f.label} [${f.rule}]: ${decksWord(f.n)} ${signed(f.mean)}, the rest ${signed(f.restMean)}; difference ${signed(f.diff)}` +
            (Number.isFinite(f.se) ? ` ± ${pts(1.96 * f.se)}` : ' (no SE with one deck)') +
            ` (p ${pval(f.p)})`,
    );
  const groups = (label: string, gs: SensitivityReport['summary']['byArchetype']) => `${label}: ${gs.map((g) => `${g.value} ${signed(g.mean)} (${g.n})`).join(', ')}`;
  out.push('', groups('By archetype', s.byArchetype), groups('By source', s.bySource), groups('By red Legends', s.byRedLegends));
  return out;
}
