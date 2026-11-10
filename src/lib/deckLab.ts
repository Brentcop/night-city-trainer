// Deck Lab core (browser): tune a submitted deck against a meta field, and breed new decks — the same methods as
// scripts/forge.ts and scripts/season.ts, run on the in-browser worker pool.
import { CARDS, CARD_BY_ID, cardLabel } from '../engine/cards';
import { counts, ramLimits, validateDeck } from '../engine/deck';
import type { DeckList } from '../engine/types';
import { analyzeDeck, type DeckReport } from '../analysis/analyze';
import type { PlayerSummary } from '../analysis/summarize';
import { breedSeason, type Bred } from '../ai/breeder';
import impact from '../data/impact.json';
import type { ImpactData } from '../analysis/impactData';
import ratings from '../data/ratings.json';
import seasons from '../data/seasons.json';
import { gameDeck, type PlayGame } from './tournament';
import type { LibraryDeck } from './library';

const A = impact as unknown as ImpactData;

/** Format-wide card impact ("Δ when drawn"), pooled across every analysed deck. */
export const GLOBAL_IMPACT: Record<string, number> = (() => {
  const acc: Record<string, { s: number; n: number }> = {};
  for (const r of A.decks)
    for (const [id, iwd, seenGames] of r.cards) {
      if (typeof iwd !== 'number' || !Number.isFinite(iwd)) continue;
      acc[id] ??= { s: 0, n: 0 };
      acc[id].s += iwd * seenGames;
      acc[id].n += seenGames;
    }
  return Object.fromEntries(Object.entries(acc).filter(([, v]) => v.n >= 40).map(([k, v]) => [k, v.s / v.n]));
})();

/** Per-deck card impact from bot telemetry (cards drawn in 25+ games). */
export const DECK_IMPACT: Record<string, Record<string, number>> = Object.fromEntries(
  A.decks.map((r) => [r.deck, Object.fromEntries(r.cards.filter(([, iwd, seenGames]) => seenGames >= 25 && Number.isFinite(iwd)).map(([id, iwd]) => [id, iwd as number]))]),
);

// ---------------------------------------------------------------- playing sets of games
export interface SetResult {
  wr: number;
  games: number;
  sums: PlayerSummary[];
}
/** Deck vs every field deck in turn (seats alternate), same seeds for the same seed0. */
export async function playSet(deck: DeckList, field: DeckList[], seed0: number, n: number, bot: string, play: PlayGame, trace: boolean, onGame?: () => void): Promise<SetResult> {
  const jobs = Array.from({ length: n }, (_, k) => {
    const opp = field[k % field.length];
    return play({ a: gameDeck(deck), b: gameDeck(opp), seed: seed0 + k, first: (Math.floor(k / field.length) % 2) as 0 | 1, bot, trace }).then((r) => {
      onGame?.();
      return r;
    });
  });
  const res = await Promise.all(jobs);
  const w = res.reduce((a, r) => a + (r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0), 0);
  return { wr: w / res.length, games: res.length, sums: res.flatMap((r) => (r.summary ? [r.summary] : [])) };
}

// ---------------------------------------------------------------- tuning (forge)
export interface Swap {
  label: string;
  deck: DeckList;
  prior: number;
}
/** Candidate one-card swaps: cut the deck's lowest-impact cards, add its own best card or the best legal cards format-wide. */
export function candidateSwaps(deck: DeckList, rep: DeckReport, n = 6): Swap[] {
  const cs = counts(deck.main);
  const lim = ramLimits(deck);
  const iwd = new Map(rep.cards.filter((c) => Number.isFinite(c.iwd)).map((c) => [c.id, c.iwd]));
  const cuts = [...cs.keys()]
    .map((id) => ({ id, v: iwd.get(id) ?? GLOBAL_IMPACT[id] ?? 0 }))
    .sort((a, b) => a.v - b.v)
    .slice(0, 3);
  const own = [...cs.entries()]
    .filter(([, k]) => k < 3)
    .map(([id]) => ({ id, v: iwd.get(id) ?? 0 }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 2);
  const outside = CARDS.filter((c) => c.type !== 'Legend' && c.ram <= lim[c.color] && (cs.get(c.id) ?? 0) < 3 && GLOBAL_IMPACT[c.id] !== undefined)
    .map((c) => ({ id: c.id, v: GLOBAL_IMPACT[c.id] }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 4);
  const adds = [...own, ...outside.filter((o) => !own.some((x) => x.id === o.id))];
  const out: Swap[] = [];
  for (const c of cuts)
    for (const a of adds) {
      if (a.id === c.id) continue;
      const main = [...deck.main];
      main.splice(main.indexOf(c.id), 1, a.id);
      const d = { ...deck, main };
      if (validateDeck({ ...d, sideboard: [] }).length) continue;
      out.push({ label: `−1 ${cardLabel(CARD_BY_ID[c.id])} → +1 ${cardLabel(CARD_BY_ID[a.id])}`, deck: d, prior: a.v - c.v });
    }
  return out.sort((a, b) => b.prior - a.prior).slice(0, n);
}

export interface TuneOptions {
  games: number; // games per test
  gens: number;
  cands: number;
  bot: string;
  /** a swap must beat the baseline by this much on the shared seeds before it is confirmed */
  minGain: number;
}
export interface TuneLog {
  gen: number;
  baseline: number;
  report?: DeckReport;
  swaps: { label: string; wr: number }[];
  confirm?: { base: number; swap: number; label: string };
  adopted: string | null;
}
export interface TuneProgress {
  done: number;
  total: number;
  phase: string;
  logs: TuneLog[];
  deck: DeckList;
}

export async function tuneDeck(start: DeckList, field: DeckList[], o: TuneOptions, play: PlayGame, onProgress: (p: TuneProgress) => void, stop: () => boolean): Promise<TuneProgress> {
  let deck = structuredClone(start);
  const logs: TuneLog[] = [];
  const total = o.gens * (o.games * (1 + o.cands) + o.games * 4);
  const p: TuneProgress = { done: 0, total, phase: 'Starting…', logs, deck };
  const tick = () => {
    p.done++;
    if (p.done % 4 === 0) onProgress({ ...p, logs: [...logs] });
  };
  for (let gen = 1; gen <= o.gens && !stop(); gen++) {
    const seed0 = 500_000 + gen * 10_000 + Math.floor(Math.random() * 9_000);
    p.phase = `Generation ${gen}: measuring the deck (${o.games} games with telemetry)`;
    onProgress({ ...p });
    const base = await playSet(deck, field, seed0, o.games, o.bot, play, true, tick);
    const report = analyzeDeck(deck.name, base.sums);
    const log: TuneLog = { gen, baseline: base.wr, report, swaps: [], adopted: null };
    logs.push(log);
    const swaps = candidateSwaps(deck, report, o.cands);
    for (const [k, s] of swaps.entries()) {
      if (stop()) break;
      p.phase = `Generation ${gen}: testing swap ${k + 1} of ${swaps.length} on the same games`;
      onProgress({ ...p, logs: [...logs] });
      const r = await playSet(s.deck, field, seed0, o.games, o.bot, play, false, tick);
      log.swaps.push({ label: s.label, wr: r.wr });
    }
    log.swaps.sort((a, b) => b.wr - a.wr);
    const best = log.swaps[0];
    if (!best || best.wr - base.wr < o.minGain || stop()) {
      p.done += o.games * 4;
      continue;
    }
    p.phase = `Generation ${gen}: confirming the best swap on ${o.games * 2} fresh games`;
    onProgress({ ...p, logs: [...logs] });
    const bestDeck = swaps.find((s) => s.label === best.label)!.deck;
    const seed1 = seed0 + 5_000;
    const [cb, cm] = await Promise.all([playSet(deck, field, seed1, o.games * 2, o.bot, play, false, tick), playSet(bestDeck, field, seed1, o.games * 2, o.bot, play, false, tick)]);
    log.confirm = { base: cb.wr, swap: cm.wr, label: best.label };
    if (cm.wr > cb.wr) {
      deck = bestDeck;
      log.adopted = best.label;
    }
    p.deck = deck;
  }
  p.phase = stop() ? 'Stopped' : 'Done';
  p.deck = deck;
  p.done = p.total;
  onProgress({ ...p, logs: [...logs] });
  return p;
}

// ---------------------------------------------------------------- breeding
/** Parent strength: tournament power rating where available, else the season leaderboard rating vs the meta. */
export function rankedParents(lib: LibraryDeck[]): { deck: DeckList; wr: number }[] {
  const R = ratings as unknown as { decks: { name: string; wrField: number; games: number }[] };
  const S = seasons as unknown as { leaderboard: { file: string; rating: number }[] };
  const strength = new Map<string, number>();
  for (const r of S.leaderboard) {
    const d = lib.find((x) => x.file === r.file);
    if (d && Number.isFinite(r.rating)) strength.set(d.deck.name, r.rating);
  }
  for (const r of R.decks) if (r.games >= 20 && Number.isFinite(r.wrField)) strength.set(r.name, strength.has(r.name) ? 0.65 * r.wrField + 0.35 * strength.get(r.name)! : r.wrField);
  return [...strength.entries()]
    .map(([name, wr]) => ({ d: lib.find((x) => x.deck.name === name), wr }))
    .filter((x): x is { d: LibraryDeck; wr: number } => !!x.d)
    .sort((a, b) => b.wr - a.wr)
    .map((x) => ({ deck: x.d.deck, wr: x.wr }));
}

export interface BreedOptions {
  n: number;
  seed: number;
  /** restrict parents to these decks (names); empty = the strongest decks overall */
  parents: string[];
  /** tournament head-to-heads (loadH2H); when present, counter decks are bred too */
  h2h?: H2H;
}

export type H2H = (a: string, b: string) => { w: number; g: number };
export interface H2HInfo {
  lookup: H2H;
  events: number;
  games: number;
  updated: string;
}
/**
 * Lazily load the head-to-head file (public/data/h2h.json, built by scripts/build-h2h.ts after every tournament run).
 * Returns null when it hasn't been built yet.
 */
export async function loadH2H(): Promise<H2HInfo | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/h2h.json`);
    if (!r.ok) return null;
    const d = (await r.json()) as { updated: string; events: number; games: number; decks: string[]; pairs: [number, number, number, number][] };
    const m = new Map<string, { w: number; g: number }>();
    for (const [i, j, w, g] of d.pairs) {
      m.set(`${d.decks[i]}|${d.decks[j]}`, { w, g });
      m.set(`${d.decks[j]}|${d.decks[i]}`, { w: g - w, g });
    }
    return { lookup: (a, b) => m.get(`${a}|${b}`) ?? { w: 0, g: 0 }, events: d.events, games: d.games, updated: d.updated };
  } catch {
    return null;
  }
}

/** Breed n new decks in the browser (mutants, crossovers, explorers, and counters when head-to-heads are loaded). */
export function breedInBrowser(lib: LibraryDeck[], o: BreedOptions): Bred[] {
  let ranked = rankedParents(lib);
  if (o.parents.length) {
    const chosen = ranked.filter((r) => o.parents.includes(r.deck.name));
    const extra = lib.filter((d) => o.parents.includes(d.deck.name) && !chosen.some((c) => c.deck.name === d.deck.name)).map((d) => ({ deck: d.deck, wr: 0.55 }));
    ranked = [...chosen, ...extra];
  }
  const seenTriples = new Set(lib.map((d) => [...d.deck.legends].sort().join('|')));
  const usable = !!o.h2h && ranked.slice(0, 4).some((x) => ranked.some((y) => o.h2h!(y.deck.name, x.deck.name).g > 0));
  const out = breedSeason(0, { ranked, impact: GLOBAL_IMPACT, seenTriples, seed: o.seed, deckImpact: DECK_IMPACT, h2h: usable ? o.h2h : undefined }, o.n);
  return out.map((b, i) => {
    const name = b.deck.name.replace(/^S0-\d+/, `Lab-${String(o.seed % 1000).padStart(3, '0')}-${String(i + 1).padStart(2, '0')}`);
    return { ...b, deck: { ...b.deck, name } };
  });
}
