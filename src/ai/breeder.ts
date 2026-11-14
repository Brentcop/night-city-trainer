// Data-driven deck breeder: builds new legal decks from what the statistics say works.
//   mutant    — a top deck with one Legend swapped (cards re-fitted to the new RAM limits)
//   crossover — two strong decks merged: Legends and cards drawn from both
//   counter   — built to beat the current top decks ("bosses"): merges the decks with the best head-to-head records vs them
//   explorer  — an untested Legend combination, filled by role/curve templates
// Card choice score = format-wide impact (IWD) + static card value + seed-deck weight + archetype fit.
// Seed-deck weight uses the parent's own card impact: proven performers in that deck are kept, cards that lose games
// in that deck are not carried over.
import { CARD_BY_ID, CARDS, cardLabel } from '../engine/cards';
import { counts, listFingerprint, ramLimits, validateDeck } from '../engine/deck';
import type { CardDef, DeckList } from '../engine/types';
import { classify, type Archetype } from './archetype';
import { cardValue, ROLES } from './knowledge';
import { builtAroundIds, checkChange, checkList, describePlan, fitToPlan, isEmptyPlan, packageName, packageTriples, seedAround, type PackagePlan, type TripleOption } from '../lib/deckPackages';

export interface BreedInput {
  /** decks with a measured win rate, best first */
  ranked: { deck: DeckList; wr: number }[];
  /** format-wide card impact (IWD, -1..1) */
  impact: Record<string, number>;
  /** legend triples already tested (sorted ids joined by '|') */
  seenTriples: Set<string>;
  seed: number;
  /** per-list card impact (listFingerprint → card id → IWD) from the parents' own telemetry; matched by list, never by name */
  deckImpact?: Record<string, Record<string, number>>;
  /** head-to-head record of deck a vs deck b (tournament games) */
  /** a's record against b; `p`, when given, is a's estimated win probability shrunk toward the ratings (preferred) */
  h2h?: (a: string, b: string) => { w: number; g: number; p?: number };
  /**
   * Synergy packages (src/lib/deckPackages.ts), opt-in: absent or empty, the breeder makes exactly the decks it made
   * before packages existed (same candidates, same order, same random numbers).
   *   plan   every bred deck is built around the required packages, and around a kept package when a parent was;
   *          avoided packages are taken out. A deck that can't be fitted is not bred (the slot tries again).
   *   seeds  explorers are built around these combinations of one or two packages, in turn, on Legend trios that can
   *          hold them, instead of a random untested trio.
   */
  packages?: BreedPackages;
}

export interface BreedPackages {
  plan?: PackagePlan;
  seeds?: string[][];
}

export interface Bred {
  deck: DeckList;
  method: 'mutant' | 'crossover' | 'counter' | 'explorer';
  parents: string[];
  idea: string;
  /** with BreedInput.packages only: the packages the list is built around and the package changes made to fit the plan */
  packages?: { builtAround: string[]; changes: string[]; seeded?: string[] };
}

const LEGENDS = CARDS.filter((c) => c.type === 'Legend');
const tripleKey = (ids: string[]) => [...ids].sort().join('|');

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Best first by score plus a random jitter of up to ±spread/2, drawn once per item before sorting (a comparator that
 *  draws random numbers is inconsistent, and how many numbers it draws depends on the sort implementation). */
function jitterSort<T>(xs: readonly T[], score: (x: T) => number, spread: number, r: () => number): T[] {
  return xs
    .map((x) => ({ x, k: score(x) + (r() - 0.5) * spread }))
    .sort((a, b) => b.k - a.k)
    .map((y) => y.x);
}

function legalTriple(ids: string[]): boolean {
  if (ids.length !== 3) return false;
  return new Set(ids.map((id) => CARD_BY_ID[id].name)).size === 3;
}

/** Composition targets per archetype. */
const TARGET: Record<Archetype, { units: number; removal: number; draw: number; gearMax: number }> = {
  aggro: { units: 19, removal: 7, draw: 2, gearMax: 6 },
  midrange: { units: 16, removal: 9, draw: 3, gearMax: 5 },
  control: { units: 12, removal: 12, draw: 6, gearMax: 3 },
};

function isRemoval(id: string) {
  const r = ROLES[id] ?? [];
  return r.includes('removal') || r.includes('sweeper') || r.includes('stun');
}
function isDraw(id: string) {
  const r = ROLES[id] ?? [];
  return r.includes('draw') || r.includes('tutor');
}

/**
 * The fewest Units a bred list may have. From the library's hand-built lists (2026-11-14): the 7 choom.gg meta lists
 * hold 14–22 Units, the 11 guide lists 15–28, the 8 Trainer originals 18–26 and the owner's 5 sim-ladder lists 13–19,
 * so no hand-built list has fewer than 13 (Ladder: Jackie / Alt / Hanako, the top-rated deck of events 5–7, has 13).
 * Bred lists with 13 have done well and badly on the current simulator (S2-06 Counter 63% expected vs the field,
 * S1-06 Cross 20%). The 'control' template below aims at 12, under every hand-built list, and fitting a list to a
 * package plan can cut Units too; the 44 archived bred lists had 11–20 (25 of them 11–13). In those older simulator
 * eras the 9 lists with 11–12 Units scored about as well against the meta as the 16 with 13 (64.2% vs 63.5%), so
 * this is a floor at the edge of what hand-built lists do, not a measured gain.
 */
export const MIN_BRED_UNITS = 13;

export const unitCount = (deck: Pick<DeckList, 'main'>) => deck.main.filter((id) => CARD_BY_ID[id]?.type === 'Unit').length;

/**
 * Bring a list up to `min` Units by one-for-one swaps: the lowest-scored non-Unit copy out, the best-scored Unit the
 * Legends' RAM allows (and that still has a free copy) in, taking the first swap the package plan allows
 * (checkChange). No randomness, so the same list always gets the same repair. Returns the list unchanged when it
 * already has `min`, or null when no allowed swap is left or the result breaks the plan or the deck rules (the
 * candidate is then dropped).
 */
export function topUpUnits(deck: DeckList, min: number, score: (id: string) => number, plan?: PackagePlan): { deck: DeckList; swaps: string[] } | null {
  let cur = deck;
  const swaps: string[] = [];
  const planned = plan && !isEmptyPlan(plan) ? plan : undefined;
  const lim = ramLimits(deck);
  const units = CARDS.filter((c) => c.type === 'Unit' && c.ram <= lim[c.color])
    .map((c, i) => ({ id: c.id, s: score(c.id), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.id);
  while (unitCount(cur) < min) {
    const have = counts(cur.main);
    const cuts = [...have.keys()]
      .filter((id) => CARD_BY_ID[id]?.type !== 'Unit')
      .map((id, i) => ({ id, s: score(id), i }))
      .sort((a, b) => a.s - b.s || a.i - b.i)
      .map((x) => x.id);
    let next: DeckList | null = null;
    for (const add of units) {
      if ((have.get(add) ?? 0) >= 3) continue;
      for (const cut of cuts) {
        const main = [...cur.main];
        main.splice(main.lastIndexOf(cut), 1, add);
        const cand = { ...cur, main };
        if (validateDeck({ ...cand, sideboard: [] }).length) continue;
        if (planned && checkChange(cur, cand, planned).length) continue;
        next = cand;
        swaps.push(`-1 ${cardLabel(CARD_BY_ID[cut])} → +1 ${cardLabel(CARD_BY_ID[add])}`);
        break;
      }
      if (next) break;
    }
    if (!next) return null;
    cur = next;
  }
  if (planned && checkList(cur, planned).length) return null;
  return { deck: cur, swaps };
}

/** Fill a 40-card deck for given Legends, preferring seed cards. */
export function fill(legends: string[], seeds: Map<string, number>, impact: Record<string, number>, style: Archetype, name: string): DeckList {
  const lim = ramLimits({ name, legends, main: [], sideboard: [] });
  const legal = CARDS.filter((c) => c.type !== 'Legend' && c.ram <= lim[c.color]);
  const score = (c: CardDef) => {
    let s = cardValue(c.id) + 100 * (impact[c.id] ?? 0) + 4 * (seeds.get(c.id) ?? 0);
    if (style === 'aggro' && c.type === 'Unit' && (c.cost ?? 9) <= 4) s += 2;
    if (style === 'control' && isRemoval(c.id)) s += 3;
    if (style === 'control' && isDraw(c.id)) s += 2;
    // colour focus: prefer the Legends' main colour
    s += lim[c.color] >= 4 ? 1.5 : 0;
    return s;
  };
  const main: string[] = [];
  const add = (id: string, n: number) => {
    const have = main.filter((x) => x === id).length;
    for (let i = 0; i < Math.min(n, 3 - have) && main.length < 40; i++) main.push(id);
  };
  const t = TARGET[style];
  const units = legal.filter((c) => c.type === 'Unit').sort((a, b) => score(b) - score(a));
  // unit curve buckets
  const buckets: [number, number, number][] = [
    [0, 3, Math.round(t.units * 0.22)],
    [4, 4, Math.round(t.units * 0.36)],
    [5, 6, Math.round(t.units * 0.27)],
    [7, 99, Math.max(2, Math.round(t.units * 0.15))],
  ];
  for (const [lo, hi, want] of buckets) {
    let got = 0;
    for (const c of units) {
      if ((c.cost ?? 0) < lo || (c.cost ?? 0) > hi) continue;
      if (got >= want) break;
      const n = Math.min(3, want - got, score(c) > 14 ? 3 : 2);
      const before = main.length;
      add(c.id, n);
      got += main.length - before;
    }
  }
  const nonUnits = legal.filter((c) => c.type !== 'Unit').sort((a, b) => score(b) - score(a));
  let removal = main.filter(isRemoval).length;
  for (const c of nonUnits) {
    if (removal >= t.removal) break;
    if (!isRemoval(c.id)) continue;
    const before = main.length;
    add(c.id, Math.min(3, t.removal - removal));
    removal += main.length - before;
  }
  let draw = main.filter(isDraw).length;
  for (const c of nonUnits) {
    if (draw >= t.draw) break;
    if (!isDraw(c.id) || isRemoval(c.id)) continue;
    const before = main.length;
    add(c.id, Math.min(3, t.draw - draw));
    draw += main.length - before;
  }
  let gear = main.filter((id) => CARD_BY_ID[id].type === 'Gear').length;
  for (const c of nonUnits) {
    if (main.length >= 40) break;
    if (c.type === 'Gear' && gear >= t.gearMax) continue;
    const before = main.length;
    add(c.id, 2);
    if (c.type === 'Gear') gear += main.length - before;
  }
  // top up with best remaining units if still short
  for (const c of units) if (main.length < 40) add(c.id, 3);
  return { name, legends, main: main.slice(0, 40), sideboard: [] };
}

/** Card preferences carried over from parent decks, adjusted by how each card performed in that parent. */
export function seedsOf(decks: DeckList[], deckImpact: BreedInput['deckImpact'] = {}): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of decks) {
    const fp = listFingerprint(d);
    for (const [id, n] of counts(d.main)) {
      const imp = deckImpact[fp]?.[id];
      // +8 pts when drawn ≈ +1 copy's worth of preference; a card that loses games in this deck is not carried over
      const w = imp === undefined ? n / 3 + 0.5 : imp < -0.04 ? 0 : n / 3 + 0.5 + Math.max(-0.5, Math.min(1.5, imp * 12));
      m.set(id, Math.max(m.get(id) ?? 0, w));
    }
  }
  return m;
}

const colorCode = (legends: string[]) =>
  legends
    .map((id) => CARD_BY_ID[id].color[0])
    .sort((a, b) => 'RBGY'.indexOf(a) - 'RBGY'.indexOf(b))
    .join('');

/** Legend strength: average strength of decks using it, shrunk toward 50% when few decks have tried it. */
function legendScores(ranked: BreedInput['ranked']) {
  const acc: Record<string, { s: number; n: number }> = {};
  for (const { deck, wr } of ranked) for (const l of deck.legends) (acc[l] ??= { s: 0, n: 0 }), (acc[l].s += wr), acc[l].n++;
  const K = 2;
  return (id: string) => (acc[id] ? (acc[id].s + 0.5 * K) / (acc[id].n + K) : 0.5);
}

export function breedSeason(season: number, input: BreedInput, n = 8): Bred[] {
  const r = rng(input.seed);
  const out: Bred[] = [];
  const used = new Set(input.seenTriples);
  const lscore = legendScores(input.ranked);
  const top = input.ranked.slice(0, 8);
  const pk = input.packages && (!isEmptyPlan(input.packages.plan) || input.packages.seeds?.length) ? input.packages : undefined;
  const pkScore = (id: string) => cardValue(id) + 100 * (input.impact[id] ?? 0);
  const push = (b: Bred) => {
    const key = tripleKey(b.deck.legends);
    if (used.has(key) || !legalTriple(b.deck.legends)) return false;
    if (pk) {
      const fitted = fitBred(b, pk, input, pkScore);
      if (!fitted) return false;
      b = fitted;
    }
    // a workable number of Units (MIN_BRED_UNITS): repaired by swaps the plan allows, else the candidate is dropped
    if (unitCount(b.deck) < MIN_BRED_UNITS) {
      const from = unitCount(b.deck);
      const fixed = topUpUnits(b.deck, MIN_BRED_UNITS, pkScore, pk?.plan);
      if (!fixed) return false;
      b = { ...b, deck: fixed.deck, idea: `${b.idea} Topped up from ${from} to ${MIN_BRED_UNITS} Units: ${fixed.swaps.join('; ')}.` };
      if (b.packages) b = { ...b, packages: { ...b.packages, builtAround: builtAroundIds(fixed.deck) } };
    }
    if (validateDeck({ ...b.deck, sideboard: [] }).length) return false;
    used.add(key);
    out.push(b);
    return true;
  };
  const name = (i: number, kind: string, legends: string[]) => `S${season}-${String(i).padStart(2, '0')} ${kind} (${colorCode(legends)})`;

  const di = input.deckImpact ?? {};
  const h2h = input.h2h;
  // counters need head-to-head data; without it their slots go to mutants and crossovers
  const nCounter = h2h ? 2 : 0;
  const nMutant = h2h ? 2 : 3;
  const nCross = h2h ? 2 : 3;
  // mutants: best decks with one Legend swapped for a strong Legend whose colour fits
  for (let k = 0, tries = 0; out.filter((o) => o.method === 'mutant').length < nMutant && tries < 200; tries++) {
    const parent = top[k++ % Math.min(top.length, 4)].deck;
    const slot = Math.floor(r() * 3);
    const cands = jitterSort(LEGENDS.filter((l) => !parent.legends.includes(l.id)), (l) => lscore(l.id), 0.08, r);
    const pick = cands[Math.floor(r() * Math.min(6, cands.length))];
    const legends = parent.legends.map((id, i) => (i === slot ? pick.id : id));
    if (!legalTriple(legends)) continue;
    const style = classify(parent.main).arch;
    const d = fill(legends, seedsOf([parent], di), input.impact, style, name(out.length + 1, 'Mutant', legends));
    push({ deck: d, method: 'mutant', parents: [parent.name], idea: `Mutant of ${parent.name}: ${cardLabel(CARD_BY_ID[parent.legends[slot]])} → ${cardLabel(pick)}; cards re-fitted to the new RAM limits, keeping the parent's best performers.` });
  }
  // crossovers: two strong decks
  for (let tries = 0; out.filter((o) => o.method === 'crossover').length < nCross && tries < 200; tries++) {
    const a = top[Math.floor(r() * top.length)].deck;
    const b = top[Math.floor(r() * top.length)].deck;
    if (a === b) continue;
    const pool = jitterSort([...new Set([...a.legends, ...b.legends])], lscore, 0.1, r);
    const legends: string[] = [];
    for (const l of pool) if (legends.length < 3 && !legends.some((x) => CARD_BY_ID[x].name === CARD_BY_ID[l].name)) legends.push(l);
    if (!legalTriple(legends)) continue;
    const style = r() < 0.5 ? classify(a.main).arch : classify(b.main).arch;
    const d = fill(legends, seedsOf([a, b], di), input.impact, style, name(out.length + 1, 'Cross', legends));
    push({ deck: d, method: 'crossover', parents: [a.name, b.name], idea: `Crossover of ${a.name} × ${b.name} (${style}): strongest Legends of both, cards ranked by format-wide impact.` });
  }
  // counters: the decks that beat the bosses most often (tournament head-to-heads), merged
  if (h2h && nCounter) {
    const bosses = input.ranked.slice(0, 4).map((x) => x.deck.name);
    const vsBosses = input.ranked
      .filter((x) => x.wr >= 0.45)
      .map((x) => {
        let w = 0;
        let g = 0;
        let ps = 0;
        let pn = 0;
        for (const b of bosses) {
          if (b === x.deck.name) continue;
          const rec = h2h(x.deck.name, b);
          w += rec.w;
          g += rec.g;
          if (rec.p !== undefined) {
            ps += rec.p;
            pn++;
          }
        }
        // with estimates shrunk toward the power ratings (h2h.json's model, src/lib/h2hModel.ts) the mean estimate over the
        // bosses; without, shrink the raw record toward 50% (prior of 6 games) so a 2-0 doesn't look like a hard counter
        return { deck: x.deck, score: pn ? ps / pn : (w + 3) / (g + 6), g };
      })
      .filter((x) => x.g >= 4)
      .sort((x, y) => y.score - x.score)
      .slice(0, 6);
    for (let tries = 0; out.filter((o) => o.method === 'counter').length < nCounter && tries < 200 && vsBosses.length >= 2; tries++) {
      const a = vsBosses[Math.floor(r() * Math.min(3, vsBosses.length))];
      const b = vsBosses[Math.floor(r() * vsBosses.length)];
      if (a === b) continue;
      const pool = jitterSort([...new Set([...a.deck.legends, ...b.deck.legends])], lscore, 0.12, r);
      const legends: string[] = [];
      for (const l of pool) if (legends.length < 3 && !legends.some((x) => CARD_BY_ID[x].name === CARD_BY_ID[l].name)) legends.push(l);
      if (!legalTriple(legends)) continue;
      const style = classify(a.deck.main).arch;
      const d = fill(legends, seedsOf([a.deck, b.deck], di), input.impact, style, name(out.length + 1, 'Counter', legends));
      push({
        deck: d,
        method: 'counter',
        parents: [a.deck.name, b.deck.name],
        idea: `Counter to the top decks (${bosses.slice(0, 3).join(', ')}): merges ${a.deck.name} (${Math.round(a.score * 100)}% vs them) and ${b.deck.name} (${Math.round(b.score * 100)}%), keeping the cards that win games for each.`,
      });
    }
  }
  // explorers: untested Legend combinations, weighted toward strong Legends
  const styles: Archetype[] = ['aggro', 'midrange', 'control'];
  // with seed packages: explorers built around each combination in turn, on a trio that can hold it
  if (pk?.seeds?.length) {
    const trios = new Map<string, TripleOption[]>();
    for (let tries = 0, k = 0; out.length < n && tries < 500; tries++) {
      const combo = pk.seeds[k++ % pk.seeds.length]!;
      const key = combo.join('+');
      if (!trios.has(key)) trios.set(key, packageTriples(combo, { strength: lscore }));
      const opts = trios.get(key)!.filter((t) => !used.has(tripleKey(t.legends)));
      if (!opts.length) continue;
      const pick = opts[Math.floor(r() * Math.min(4, opts.length))]!;
      const style = styles[Math.floor(r() * 3)];
      const seeded = seedAround(combo, pick.legends, (legends) => fill(legends, new Map(), input.impact, style, name(out.length + 1, 'Explorer', legends)), { score: pkScore, plan: pk.plan, ascii: true });
      if (seeded.violations.length) continue;
      const names = combo.map(packageName).join(' + ');
      push({
        deck: seeded.deck,
        method: 'explorer',
        parents: [],
        idea: `Explorer (${style}) built around ${names}: Legends ${pick.legends.map((l) => CARD_BY_ID[l].name).join(' / ')} chosen to hold ${combo.length > 1 ? 'both packages' : 'the package'}, filled by role and curve templates, then topped up to each package's built-around minimum.`,
        packages: { builtAround: [], changes: seeded.moves.map((m) => m.label), seeded: combo },
      });
    }
  }
  // (with seed packages the explorer slots are theirs: a combination that can't be built leaves its slot empty)
  for (let tries = 0; !pk?.seeds?.length && out.length < n && tries < 500; tries++) {
    const legends: string[] = [];
    const weighted = jitterSort(LEGENDS, (l) => lscore(l.id), 0.25, r);
    for (const l of weighted) {
      if (legends.length >= 3) break;
      if (r() < 0.45) continue;
      if (legends.some((x) => CARD_BY_ID[x].name === l.name)) continue;
      legends.push(l.id);
    }
    if (!legalTriple(legends)) continue;
    // keep explorers to at most 2 colours so RAM limits allow real cards
    if (new Set(legends.map((id) => CARD_BY_ID[id].color)).size > 2) continue;
    const style = styles[Math.floor(r() * 3)];
    const d = fill(legends, new Map(), input.impact, style, name(out.length + 1, 'Explorer', legends));
    push({ deck: d, method: 'explorer', parents: [], idea: `Explorer (${style}): untested Legends ${legends.map((l) => CARD_BY_ID[l].name).join(' / ')}, filled by role and curve templates from format-wide card impact.` });
  }
  return out;
}

/** A bred list fitted to the package plan (BreedInput.packages), with what was changed; null when it can't be. */
function fitBred(b: Bred, pk: BreedPackages, input: BreedInput, score: (id: string) => number): Bred | null {
  let deck = b.deck;
  const changes = [...(b.packages?.changes ?? [])];
  if (!isEmptyPlan(pk.plan)) {
    const parentsBuiltAround = [...new Set(b.parents.flatMap((p) => {
      const d = input.ranked.find((x) => x.deck.name === p)?.deck;
      return d ? builtAroundIds(d) : [];
    }))];
    const fit = fitToPlan(deck, pk.plan!, { score, parentsBuiltAround, ascii: true });
    if ('error' in fit) return null;
    deck = fit.deck;
    changes.push(...fit.changes);
  }
  const note = pk.plan && !isEmptyPlan(pk.plan) ? ` Package plan: ${describePlan(pk.plan)}.` : '';
  return { ...b, deck, idea: `${b.idea}${note}`, packages: { builtAround: builtAroundIds(deck), changes, ...(b.packages?.seeded ? { seeded: b.packages.seeded } : {}) } };
}
