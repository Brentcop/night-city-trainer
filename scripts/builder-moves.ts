// Candidate changes for the list tuners: the forge's one-card swaps (scripts/forge.ts) and the optimizer's card and
// Legend swaps (scripts/optimize.ts), moved here unchanged so tests can pin them, plus the synergy-package side
// (src/lib/deckPackages.ts): with a package plan, candidates that break it are dropped before any game is played, and
// package moves (complete, add, swap, remove) can be tried beside the swaps.
//
// With an empty plan and no package moves every function returns exactly what the scripts produced before packages
// existed (tests/deck-packages-defaults.test.ts pins the outputs).
import { CARD_BY_ID, CARDS, cardLabel } from '../src/engine/cards';
import { counts, ramLimits, validateDeck } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import type { DeckReport } from '../src/analysis/analyze';
import { cardValue } from '../src/ai/knowledge';
import { canCut, checkChange, isEmptyPlan, tunerPackageMoves, type PackageMove, type PackagePlan } from '../src/lib/deckPackages';
import { combinedCandidates } from '../src/lib/deckSearch';
import { addScore, cutReason, partnerAwarePicks, strandCosts, type CutRow } from '../src/lib/cutRanking';
import type { PlayerSummary } from '../src/analysis/summarize';
import type { ImpactTables } from '../src/lib/breederImpact';
import { keyWords, sourceWords } from '../src/lib/seasonImpact';

export interface Mutation {
  label: string;
  deck: DeckList;
  prior: number;
  /** set for a package move */
  pkg?: Pick<PackageMove, 'kind' | 'added' | 'removed'>;
  /** set for a candidate combined from several screened changes (search depth 2 or 3) */
  combo?: { parts: string[]; packages: boolean };
}

/** Whether a candidate is judged as a package change (its own minimum gain may differ). */
export const isPackageChange = (m: Pick<Mutation, 'pkg' | 'combo'>) => !!m.pkg || !!m.combo?.packages;

/**
 * Candidates of two or three changes from the best screened single changes (`singles`, best first, all one kind):
 * pairs (and triples) of the first `from` that make a legal list and respect the plan (src/lib/deckSearch.ts).
 */
export function combineMutations(deck: DeckList, singles: readonly Mutation[], o: { maxParts: number; from: number; plan?: PackagePlan; seen?: Set<string> }): Mutation[] {
  return combinedCandidates(deck, singles, o, (parts, d) => ({
    label: parts.map((p) => p.label).join(' + '),
    deck: d,
    prior: parts.reduce((s, p) => s + p.prior, 0),
    combo: { parts: parts.map((p) => p.label), packages: parts.some((p) => !!p.pkg) },
  }));
}

/** Partner-aware ranking input (src/lib/cutRanking.ts): the baseline's own summaries (games of this list). */
export interface PartnerAware {
  sums: readonly PlayerSummary[];
}

/**
 * The forge's candidates: cut the list's lowest-impact cards (its own "Δ when drawn", else the format-wide impact the
 * forge passes as `globalImpact`: since 2026-11-24 the breeder's, see forgeAddsWords), add +1 of its best card or the
 * best legal cards by that impact (only cards the table's lists play have a number), best prior first, `cands` of them. Under a plan, cuts the plan
 * protects are skipped and swaps that break it are dropped. With `partner` (--partner-aware) cuts and adds are ranked
 * partner-aware; without it the candidates are exactly the pinned ones (tests/deck-packages-defaults.test.ts).
 *
 * With `deckImpact` (--per-deck-adds) additions are ranked by per-deck impact when available (cards the deck itself
 * played), falling back to global impact; the pool of outsider adds includes cards with a number in either table.
 */
export function forgeSwaps(deck: DeckList, rep: DeckReport, globalImpact: Record<string, number>, cands: number, plan: PackagePlan = {}, partner?: PartnerAware, deckImpact?: Record<string, number>): Mutation[] {
  return forgeSwapsExplained(deck, rep, globalImpact, cands, plan, partner, deckImpact).swaps;
}

/** forgeSwaps, with every main-deck card's cut ranking (both scores, offered or not, and why) when partner-aware. */
export function forgeSwapsExplained(
  deck: DeckList,
  rep: DeckReport,
  globalImpact: Record<string, number>,
  cands: number,
  plan: PackagePlan = {},
  partner?: PartnerAware,
  deckImpact?: Record<string, number>,
): { swaps: Mutation[]; cuts?: (CutRow & { offered: boolean; plainOffered: boolean; why: string })[] } {
  const planned = !isEmptyPlan(plan);
  const cs = counts(deck.main);
  const lim = ramLimits(deck);
  const iwd = new Map(rep.cards.filter((c) => Number.isFinite(c.iwd)).map((c) => [c.id, c.iwd]));
  // per-deck additions: when deckImpact is provided, rank outsiders by per-deck numbers when available, global otherwise;
  // the pool of outsider adds includes cards with a number in either table
  const addImpact = (id: string): number | undefined => (deckImpact ? (deckImpact[id] ?? globalImpact[id]) : globalImpact[id]);
  const hasAddImpact = (id: string): boolean => (deckImpact ? (deckImpact[id] !== undefined || globalImpact[id] !== undefined) : globalImpact[id] !== undefined);
  // cuts: lowest IWD in this deck (cards never/rarely seen fall back to global impact)
  const plainCuts = [...cs.keys()]
    .filter((id) => !planned || canCut(deck, id, plan))
    .map((id) => ({ id, v: iwd.get(id) ?? addImpact(id) ?? 0 }))
    .sort((a, b) => a.v - b.v)
    .slice(0, 3);
  let cuts = plainCuts;
  let adds: { id: string; v: number }[];
  let rows: (CutRow & { offered: boolean; plainOffered: boolean; why: string })[] | undefined;
  if (partner) {
    const legal = CARDS.filter((c) => c.type !== 'Legend' && c.ram <= lim[c.color] && (cs.get(c.id) ?? 0) < 3).map((c) => c.id);
    const mergedImpact = deckImpact ? { ...globalImpact, ...deckImpact } : globalImpact;
    const picks = partnerAwarePicks(deck, {
      plain: (id) => iwd.get(id) ?? addImpact(id) ?? 0,
      sums: partner.sums,
      lockedWhy: (id) => (planned && !canCut(deck, id, plan) ? 'the package plan protects it' : undefined),
      own: (id) => iwd.get(id) ?? 0,
      globalImpact: mergedImpact,
      outside: legal,
    });
    cuts = picks.cuts;
    adds = picks.adds;
    const was = new Set(plainCuts.map((c) => c.id));
    rows = picks.rows.map((r) => ({ ...r, plainOffered: was.has(r.id), why: cutReason(r, was.has(r.id)) }));
  } else {
    // adds: +1 of the deck's own best card, plus the best legal cards by impact (per-deck when available, else format-wide)
    const own = [...cs.entries()].filter(([, n]) => n < 3).map(([id]) => ({ id, v: iwd.get(id) ?? 0 })).sort((a, b) => b.v - a.v).slice(0, 2);
    const outside = CARDS.filter((c) => c.type !== 'Legend' && c.ram <= lim[c.color] && (cs.get(c.id) ?? 0) < 3 && hasAddImpact(c.id))
      .map((c) => ({ id: c.id, v: addImpact(c.id)! }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 4);
    adds = [...own, ...outside.filter((o) => !own.some((x) => x.id === o.id))];
  }
  const out: Mutation[] = [];
  for (const c of cuts)
    for (const a of adds) {
      if (a.id === c.id) continue;
      const main = [...deck.main];
      main.splice(main.indexOf(c.id), 1, a.id);
      const d = { ...deck, main };
      if (validateDeck({ ...d, sideboard: [] }).length) continue;
      if (planned && checkChange(deck, d, plan).length) continue;
      out.push({ label: `-1 ${cardLabel(CARD_BY_ID[c.id])} → +1 ${cardLabel(CARD_BY_ID[a.id])}`, deck: d, prior: a.v - c.v });
    }
  return { swaps: out.sort((a, b) => b.prior - a.prior).slice(0, cands), ...(rows ? { cuts: rows } : {}) };
}

/**
 * What --per-deck-adds read (src/lib/breederImpact.ts readImpactTables, through scripts/breed-data.ts loadImpactTables),
 * in the words the season uses for its breeder (impactTablesWords): which simulator version and bot, and a line that
 * starts "Warning:" when it is not the pair wanted or there is nothing to read. Per-list numbers only: a list without an
 * entry keeps the forge's format-wide additions (forgeAddsWords).
 */
export function perDeckAddsWords(t: Pick<ImpactTables, 'wanted' | 'read' | 'match' | 'perList'>): string[] {
  const n = t.perList.withNumbers;
  const srcs = [...new Set(t.perList.sources.map(sourceWords))];
  const what = `per-list numbers for ${n.toLocaleString('en-US')} list${n === 1 ? '' : 's'}${srcs.length ? ` (from ${srcs.join(', ')})` : ''}`;
  const remedy = `A season's round robin on ${keyWords(t.wanted)} records them for the lists it plays.`;
  if (t.match === 'exact' && t.read) return [`Per-deck additions read card impact for ${keyWords(t.read)}: ${what}.`];
  if (t.read)
    return [
      `Warning: no card-impact numbers for ${keyWords(t.wanted)}, so --per-deck-adds reads those of ${keyWords(t.read)} instead: ${what}. Numbers measured on another ${t.match === 'other-bot' ? 'bot' : 'simulator version'} can mislead. ${remedy}`,
    ];
  return [`Warning: no card-impact numbers for ${keyWords(t.wanted)} or any other simulator version or bot, so --per-deck-adds changes nothing: the additions are ranked as without it. ${remedy}`];
}

/**
 * What the forge's ordinary additions read since 2026-11-24 (REVIEW_2026-11-24 B.2): the format-wide card impact of the
 * pair the season breeder reads (loadImpactTables in scripts/breed-data.ts: the current simulator version and the
 * season's bot, Season 3's round robin plus the review telemetry src/data/analysis.json when it is that pair), so the
 * forge adds by the breeder's numbers. Until then they read src/data/analysis.json alone (the `deep` bot on the 7 meta
 * decks). A line that starts "Warning:" when it is not the pair wanted or there is nothing to read, as --per-deck-adds says.
 */
export function forgeAddsWords(t: Pick<ImpactTables, 'wanted' | 'read' | 'match' | 'pooled' | 'analysis' | 'minPooled'>): string[] {
  const srcs = [...new Set(t.pooled.sources.map(sourceWords))];
  if (t.analysis.state === 'added') srcs.push(`src/data/analysis.json${t.analysis.runId ? ` (${t.analysis.runId})` : ''}`);
  const n = t.pooled.usable;
  const what = `${n.toLocaleString('en-US')} card${n === 1 ? '' : 's'} with a format-wide figure (drawn in ${t.minPooled}+ games)${srcs.length ? `, from ${srcs.join(', ')}` : ''}`;
  if (t.match === 'exact' && t.read) return [`Additions read card impact for ${keyWords(t.read)}, the table the breeder reads: ${what}.`];
  if (t.read)
    return [
      `Warning: no card-impact numbers for ${keyWords(t.wanted)}, so the additions read those of ${keyWords(t.read)} instead, as the breeder does: ${what}. Numbers measured on another ${t.match === 'other-bot' ? 'bot' : 'simulator version'} can mislead.`,
    ];
  return [`Warning: no card-impact numbers for ${keyWords(t.wanted)} or any other simulator version or bot, so no card outside the list has a figure: the additions are the list's own cards only.`];
}

/** The per-generation line when --per-deck-adds finds no entry for the list (its additions are then the plain ones). */
export const PER_DECK_MISSING = 'per-deck additions: no per-list numbers for this list, so its additions are ranked as without --per-deck-adds';

/** The forge's card score for package moves: the list's own "Δ when drawn", else per-deck impact, else format-wide. */
export function forgeScore(rep: DeckReport, globalImpact: Record<string, number>, deckImpact?: Record<string, number>): (id: string) => number {
  const iwd = new Map(rep.cards.filter((c) => Number.isFinite(c.iwd)).map((c) => [c.id, c.iwd]));
  return (id) => iwd.get(id) ?? deckImpact?.[id] ?? globalImpact[id] ?? 0;
}

/** Package moves for a tuner round (tunerPackageMoves) as tuner candidates. */
export function packageCandidates(deck: DeckList, plan: PackagePlan, o: { moves: boolean; n: number; score: (id: string) => number }): Mutation[] {
  return tunerPackageMoves(deck, plan, { ...o, ascii: true }).map((m) => ({ label: m.label, deck: m.deck, prior: m.prior, pkg: { kind: m.kind, added: m.added, removed: m.removed } }));
}

export interface Cand {
  label: string;
  deck: DeckList;
  pkg?: Mutation['pkg'];
  combo?: Mutation['combo'];
}

/**
 * The optimizer's candidates: weakest cards by static value out, strongest legal cards in, then Legend swaps that keep
 * the list legal, shuffled deterministically and cut to `n`. `sideboard`: only swaps that use the list's sideboard.
 * Under a plan, cuts the plan protects are skipped and swaps that break it are dropped (before the shuffle).
 */
export function optimizeCandidates(deck: DeckList, sideboard: boolean, n: number, plan: PackagePlan = {}, partnerAware = false): Cand[] {
  const planned = !isEmptyPlan(plan);
  const out: Cand[] = [];
  const lim = ramLimits(deck);
  const cs = counts(deck.main);
  const sbIds = new Set(deck.sideboard);
  const inPool = CARDS.filter((c) => c.type !== 'Legend' && c.ram <= lim[c.color] && (cs.get(c.id) ?? 0) < 3 && (!sideboard || sbIds.has(c.id)));
  // weakest cards in deck by static value are the likeliest cuts; strongest legal cards the likeliest adds
  // partner-aware (--partner-aware): no telemetry here, so only the stranding cost and the add credit, in card-value
  // units at the same number as win-rate points (a 17-point drop in assembly odds = 1.7)
  const cutV = partnerAware ? (id: string) => cardValue(id) + 100 * strandCosts(deck, id).reduce((a, x) => a + x.penalty, 0) : cardValue;
  const addV = partnerAware ? (id: string) => cardValue(id) + 100 * (addScore(deck, id, 0).v) : cardValue;
  const cuts = [...cs.keys()]
    .filter((id) => !planned || canCut(deck, id, plan))
    .sort((a, b) => cutV(a) - cutV(b))
    .slice(0, sideboard ? 12 : 8);
  const adds = inPool.sort((a, b) => addV(b.id) - addV(a.id)).slice(0, 14);
  for (const out1 of cuts)
    for (const add of adds) {
      if (add.id === out1) continue;
      const main = [...deck.main];
      main.splice(main.indexOf(out1), 1, add.id);
      const d = { ...deck, main, name: deck.name };
      if (planned && checkChange(deck, d, plan).length) continue;
      out.push({ label: `-1 ${cardLabel(CARD_BY_ID[out1])} / +1 ${cardLabel(add)}`, deck: d });
    }
  if (sideboard) return out.slice(0, n);
  // legend swaps that keep the deck legal
  for (const leg of CARDS.filter((c) => c.type === 'Legend')) {
    for (let k = 0; k < 3; k++) {
      const legends = [...deck.legends];
      if (legends.includes(leg.id)) continue;
      legends[k] = leg.id;
      const d = { ...deck, legends };
      if (validateDeck({ ...d, sideboard: [] }).length) continue;
      if (planned && checkChange(deck, d, plan).length) continue;
      out.push({ label: `Legend: ${cardLabel(CARD_BY_ID[deck.legends[k]])} → ${cardLabel(leg)}`, deck: d });
    }
  }
  // shuffle deterministically then take N (keep variety between card & legend swaps)
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return out.sort(() => rnd() - 0.5).slice(0, n);
}
