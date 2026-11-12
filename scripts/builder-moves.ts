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

export interface Mutation {
  label: string;
  deck: DeckList;
  prior: number;
  /** set for a package move */
  pkg?: Pick<PackageMove, 'kind' | 'added' | 'removed'>;
}

/**
 * The forge's candidates: cut the list's lowest-impact cards (its own "Δ when drawn", else format-wide impact), add +1
 * of its best card or the best legal cards format-wide, best prior first, `cands` of them. Under a plan, cuts the plan
 * protects are skipped and swaps that break it are dropped.
 */
export function forgeSwaps(deck: DeckList, rep: DeckReport, globalImpact: Record<string, number>, cands: number, plan: PackagePlan = {}): Mutation[] {
  const planned = !isEmptyPlan(plan);
  const cs = counts(deck.main);
  const lim = ramLimits(deck);
  const iwd = new Map(rep.cards.filter((c) => Number.isFinite(c.iwd)).map((c) => [c.id, c.iwd]));
  // cuts: lowest IWD in this deck (cards never/rarely seen fall back to global impact)
  const cuts = [...cs.keys()]
    .filter((id) => !planned || canCut(deck, id, plan))
    .map((id) => ({ id, v: iwd.get(id) ?? globalImpact[id] ?? 0 }))
    .sort((a, b) => a.v - b.v)
    .slice(0, 3);
  // adds: +1 of the deck's own best card, plus the best legal format-wide cards
  const own = [...cs.entries()].filter(([, n]) => n < 3).map(([id]) => ({ id, v: iwd.get(id) ?? 0 })).sort((a, b) => b.v - a.v).slice(0, 2);
  const outside = CARDS.filter((c) => c.type !== 'Legend' && c.ram <= lim[c.color] && (cs.get(c.id) ?? 0) < 3 && globalImpact[c.id] !== undefined)
    .map((c) => ({ id: c.id, v: globalImpact[c.id] }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 4);
  const adds = [...own, ...outside.filter((o) => !own.some((x) => x.id === o.id))];
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
  return out.sort((a, b) => b.prior - a.prior).slice(0, cands);
}

/** The forge's card score for package moves: the list's own "Δ when drawn", else format-wide impact. */
export function forgeScore(rep: DeckReport, globalImpact: Record<string, number>): (id: string) => number {
  const iwd = new Map(rep.cards.filter((c) => Number.isFinite(c.iwd)).map((c) => [c.id, c.iwd]));
  return (id) => iwd.get(id) ?? globalImpact[id] ?? 0;
}

/** Package moves for a tuner round (tunerPackageMoves) as tuner candidates. */
export function packageCandidates(deck: DeckList, plan: PackagePlan, o: { moves: boolean; n: number; score: (id: string) => number }): Mutation[] {
  return tunerPackageMoves(deck, plan, { ...o, ascii: true }).map((m) => ({ label: m.label, deck: m.deck, prior: m.prior, pkg: { kind: m.kind, added: m.added, removed: m.removed } }));
}

export interface Cand {
  label: string;
  deck: DeckList;
  pkg?: Mutation['pkg'];
}

/**
 * The optimizer's candidates: weakest cards by static value out, strongest legal cards in, then Legend swaps that keep
 * the list legal, shuffled deterministically and cut to `n`. `sideboard`: only swaps that use the list's sideboard.
 * Under a plan, cuts the plan protects are skipped and swaps that break it are dropped (before the shuffle).
 */
export function optimizeCandidates(deck: DeckList, sideboard: boolean, n: number, plan: PackagePlan = {}): Cand[] {
  const planned = !isEmptyPlan(plan);
  const out: Cand[] = [];
  const lim = ramLimits(deck);
  const cs = counts(deck.main);
  const sbIds = new Set(deck.sideboard);
  const inPool = CARDS.filter((c) => c.type !== 'Legend' && c.ram <= lim[c.color] && (cs.get(c.id) ?? 0) < 3 && (!sideboard || sbIds.has(c.id)));
  // weakest cards in deck by static value are the likeliest cuts; strongest legal cards the likeliest adds
  const cuts = [...cs.keys()]
    .filter((id) => !planned || canCut(deck, id, plan))
    .sort((a, b) => cardValue(a) - cardValue(b))
    .slice(0, sideboard ? 12 : 8);
  const adds = inPool.sort((a, b) => cardValue(b.id) - cardValue(a.id)).slice(0, 14);
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
