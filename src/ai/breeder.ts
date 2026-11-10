// Data-driven deck breeder: builds new legal decks from what the statistics say works.
//   mutant    — a top deck with one Legend swapped (cards re-fitted to the new RAM limits)
//   crossover — two strong decks merged: Legends and cards drawn from both
//   explorer  — an untested Legend combination, filled by role/curve templates
// Card choice score = format-wide impact (IWD) + static card value + seed-deck weight + archetype fit.
import { CARD_BY_ID, CARDS, cardLabel } from '../engine/cards';
import { counts, ramLimits, validateDeck } from '../engine/deck';
import type { CardDef, DeckList } from '../engine/types';
import { classify, type Archetype } from './archetype';
import { cardValue, ROLES } from './knowledge';

export interface BreedInput {
  /** decks with a measured win rate, best first */
  ranked: { deck: DeckList; wr: number }[];
  /** format-wide card impact (IWD, -1..1) */
  impact: Record<string, number>;
  /** legend triples already tested (sorted ids joined by '|') */
  seenTriples: Set<string>;
  seed: number;
}

export interface Bred {
  deck: DeckList;
  method: 'mutant' | 'crossover' | 'explorer';
  parents: string[];
  idea: string;
}

const LEGENDS = CARDS.filter((c) => c.type === 'Legend');
const tripleKey = (ids: string[]) => [...ids].sort().join('|');

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
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

function seedsOf(decks: DeckList[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of decks) for (const [id, n] of counts(d.main)) m.set(id, Math.max(m.get(id) ?? 0, n / 3 + 0.5));
  return m;
}

const colorCode = (legends: string[]) =>
  legends
    .map((id) => CARD_BY_ID[id].color[0])
    .sort((a, b) => 'RBGY'.indexOf(a) - 'RBGY'.indexOf(b))
    .join('');

/** Legend strength estimate: average win rate of ranked decks using it. */
function legendScores(ranked: BreedInput['ranked']) {
  const acc: Record<string, { s: number; n: number }> = {};
  for (const { deck, wr } of ranked) for (const l of deck.legends) (acc[l] ??= { s: 0, n: 0 }), (acc[l].s += wr), acc[l].n++;
  return (id: string) => (acc[id] ? acc[id].s / acc[id].n : 0.5);
}

export function breedSeason(season: number, input: BreedInput, n = 8): Bred[] {
  const r = rng(input.seed);
  const out: Bred[] = [];
  const used = new Set(input.seenTriples);
  const lscore = legendScores(input.ranked);
  const top = input.ranked.slice(0, 8);
  const push = (b: Bred) => {
    const key = tripleKey(b.deck.legends);
    if (used.has(key) || !legalTriple(b.deck.legends)) return false;
    if (validateDeck({ ...b.deck, sideboard: [] }).length) return false;
    used.add(key);
    out.push(b);
    return true;
  };
  const name = (i: number, kind: string, legends: string[]) => `S${season}-${String(i).padStart(2, '0')} ${kind} (${colorCode(legends)})`;

  // 3 mutants: best decks with one Legend swapped for a strong Legend whose colour fits
  for (let k = 0, tries = 0; out.filter((o) => o.method === 'mutant').length < 3 && tries < 200; tries++) {
    const parent = top[k++ % Math.min(top.length, 4)].deck;
    const slot = Math.floor(r() * 3);
    const cands = LEGENDS.filter((l) => !parent.legends.includes(l.id)).sort((a, b) => lscore(b.id) - lscore(a.id) + (r() - 0.5) * 0.08);
    const pick = cands[Math.floor(r() * Math.min(6, cands.length))];
    const legends = parent.legends.map((id, i) => (i === slot ? pick.id : id));
    if (!legalTriple(legends)) continue;
    const style = classify(parent.main).arch;
    const d = fill(legends, seedsOf([parent]), input.impact, style, name(out.length + 1, 'Mutant', legends));
    push({ deck: d, method: 'mutant', parents: [parent.name], idea: `Mutant of ${parent.name}: ${cardLabel(CARD_BY_ID[parent.legends[slot]])} → ${cardLabel(pick)}; cards re-fitted to the new RAM limits, keeping the parent's best performers.` });
  }
  // 3 crossovers: two strong decks that share a colour
  for (let tries = 0; out.filter((o) => o.method === 'crossover').length < 3 && tries < 200; tries++) {
    const a = top[Math.floor(r() * top.length)].deck;
    const b = top[Math.floor(r() * top.length)].deck;
    if (a === b) continue;
    const pool = [...new Set([...a.legends, ...b.legends])].sort((x, y) => lscore(y) - lscore(x) + (r() - 0.5) * 0.1);
    const legends: string[] = [];
    for (const l of pool) if (legends.length < 3 && !legends.some((x) => CARD_BY_ID[x].name === CARD_BY_ID[l].name)) legends.push(l);
    if (!legalTriple(legends)) continue;
    const style = r() < 0.5 ? classify(a.main).arch : classify(b.main).arch;
    const d = fill(legends, seedsOf([a, b]), input.impact, style, name(out.length + 1, 'Cross', legends));
    push({ deck: d, method: 'crossover', parents: [a.name, b.name], idea: `Crossover of ${a.name} × ${b.name} (${style}): strongest Legends of both, cards ranked by format-wide impact.` });
  }
  // explorers: untested Legend combinations, weighted toward strong Legends
  const styles: Archetype[] = ['aggro', 'midrange', 'control'];
  for (let tries = 0; out.length < n && tries < 500; tries++) {
    const legends: string[] = [];
    const weighted = [...LEGENDS].sort((x, y) => lscore(y.id) - lscore(x.id) + (r() - 0.5) * 0.25);
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
