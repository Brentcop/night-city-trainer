// Deck Lab core (browser): tune a submitted deck against a meta field, and breed new decks — the same methods as
// scripts/forge.ts and scripts/season.ts, run on the in-browser worker pool.
import { CARDS, CARD_BY_ID, cardLabel } from '../engine/cards';
import { counts, listFingerprint, ramLimits, validateDeck } from '../engine/deck';
import type { DeckList } from '../engine/types';
import { analyzeDeck, type DeckReport } from '../analysis/analyze';
import type { PlayerSummary } from '../analysis/summarize';
import { breedSeason, type Bred } from '../ai/breeder';
import impact from '../data/impact.json';
import { findImpactDeck, IMPACT_MIN_DECK_GAMES, IMPACT_MIN_POOLED_GAMES, type ImpactData } from '../analysis/impactData';
import { RATINGS, SEASONS } from '../data/index';
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
  return Object.fromEntries(Object.entries(acc).filter(([, v]) => v.n >= IMPACT_MIN_POOLED_GAMES).map(([k, v]) => [k, v.s / v.n]));
})();

/**
 * Per-deck card impact from bot telemetry (cards drawn in IMPACT_MIN_DECK_GAMES+ games), for the list it was measured on: matched by list
 * fingerprint, never by name alone (findImpactDeck), so a tuned or renamed list, or a custom deck reusing a built-in
 * name, does not inherit another list's numbers. Undefined when no telemetry describes this list.
 */
export function deckImpactOf(deck: Pick<DeckList, 'name' | 'legends' | 'main'>): Record<string, number> | undefined {
  const r = findImpactDeck(A.decks, { name: deck.name, listId: listFingerprint(deck) });
  if (!r) return undefined;
  return Object.fromEntries(r.cards.filter(([, iwd, seenGames]) => seenGames >= IMPACT_MIN_DECK_GAMES && Number.isFinite(iwd)).map(([id, iwd]) => [id, iwd as number]));
}

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
    if (!opp) throw new Error('playSet needs at least one field deck');
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
const labelOf = (id: string) => {
  const c = CARD_BY_ID[id];
  return c ? cardLabel(c) : id;
};
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
  const outside = CARDS.filter((c) => c.type !== 'Legend' && c.ram <= lim[c.color] && (cs.get(c.id) ?? 0) < 3)
    .flatMap((c) => {
      const v = GLOBAL_IMPACT[c.id];
      return v === undefined ? [] : [{ id: c.id, v }];
    })
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
      out.push({ label: `−1 ${labelOf(c.id)} → +1 ${labelOf(a.id)}`, deck: d, prior: a.v - c.v });
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
  /** seed base (default: random in 500,000–508,999); generation g plays seeds from seedBase + 10,000·g */
  seedBase?: number;
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
  /** the run's seed base (see TuneOptions.seedBase) */
  seedBase: number;
  /** games actually played (done also jumps ahead over skipped confirmations) */
  played: number;
}

export async function tuneDeck(start: DeckList, field: DeckList[], o: TuneOptions, play: PlayGame, onProgress: (p: TuneProgress) => void, stop: () => boolean): Promise<TuneProgress> {
  let deck = structuredClone(start);
  const logs: TuneLog[] = [];
  const total = o.gens * (o.games * (1 + o.cands) + o.games * 4);
  const seedBase = o.seedBase ?? 500_000 + Math.floor(Math.random() * 9_000);
  const p: TuneProgress = { done: 0, total, phase: 'Starting…', logs, deck, seedBase, played: 0 };
  const tick = () => {
    p.done++;
    p.played++;
    if (p.done % 4 === 0) onProgress({ ...p, logs: [...logs] });
  };
  for (let gen = 1; gen <= o.gens && !stop(); gen++) {
    const seed0 = seedBase + gen * 10_000;
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
    // report the confirmed list at once, so a run stopped from here on can still save it (partialTune)
    onProgress({ ...p, logs: [...logs] });
  }
  p.phase = stop() ? 'Stopped' : 'Done';
  p.deck = deck;
  p.done = p.total;
  onProgress({ ...p, logs: [...logs] });
  return p;
}

/**
 * What a tuning run that was stopped (or failed) can still save: the list with only the swaps that were confirmed on
 * fresh games before it ended. `deck` is the progress snapshot's list, which tuneDeck updates as soon as a swap is
 * adopted; a swap that was still being tested or confirmed is not in it. Null when no swap had been confirmed (the
 * list is the original).
 */
export function partialTune(p: Pick<TuneProgress, 'deck' | 'logs'> | null | undefined): { deck: DeckList; adopted: string[] } | null {
  if (!p) return null;
  const adopted = p.logs.flatMap((l) => (l.adopted ? [l.adopted] : []));
  return adopted.length ? { deck: p.deck, adopted } : null;
}

/** The name a tuned list is saved under before the library's reserved-name check: "X (tuned)", or "X (tuned, partial)" for a stopped run. */
export function tunedName(name: string, partial = false): string {
  const base = name.replace(/ ?\(tuned(, partial)?\)$/, '');
  return `${base} (tuned${partial ? ', partial' : ''})`;
}

// ---------------------------------------------------------------- breeding
/** Parent strength: tournament power rating where available, else the season leaderboard rating vs the meta. */
function rankedParents(lib: readonly LibraryDeck[]): { deck: DeckList; wr: number }[] {
  const R = RATINGS;
  const S = SEASONS;
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
 * How many events are recorded (the length of src/data/tournaments.json's index), for telling whether h2h.json is
 * stale. Loaded on demand: the index is ~130 KB and the lab needs only its length. Null if it could not be loaded.
 */
export async function recordedEventCount(): Promise<number | null> {
  try {
    const { TOURNAMENT_INDEX } = await import('../data/tournamentIndex');
    return TOURNAMENT_INDEX.events.length;
  } catch {
    return null;
  }
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
export function breedInBrowser(lib: readonly LibraryDeck[], o: BreedOptions): Bred[] {
  let ranked = rankedParents(lib);
  if (o.parents.length) {
    const chosen = ranked.filter((r) => o.parents.includes(r.deck.name));
    const extra = lib.filter((d) => o.parents.includes(d.deck.name) && !chosen.some((c) => c.deck.name === d.deck.name)).map((d) => ({ deck: d.deck, wr: 0.55 }));
    ranked = [...chosen, ...extra];
  }
  const seenTriples = new Set(lib.map((d) => [...d.deck.legends].sort().join('|')));
  const usable = !!o.h2h && ranked.slice(0, 4).some((x) => ranked.some((y) => o.h2h!(y.deck.name, x.deck.name).g > 0));
  // the breeder reads per-deck impact by parent name; parent names are unique in `ranked`, and each gets its own list's numbers
  const deckImpact: Record<string, Record<string, number>> = {};
  for (const r of ranked) {
    const m = deckImpactOf(r.deck);
    if (m) deckImpact[r.deck.name] = m;
  }
  const out = breedSeason(0, { ranked, impact: GLOBAL_IMPACT, seenTriples, seed: o.seed, deckImpact, h2h: usable ? o.h2h : undefined }, o.n);
  return out.map((b, i) => {
    const name = b.deck.name.replace(/^S0-\d+/, `Lab-${String(o.seed % 1000).padStart(3, '0')}-${String(i + 1).padStart(2, '0')}`);
    return { ...b, deck: { ...b.deck, name } };
  });
}
