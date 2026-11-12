// Deck Lab core (browser): tune a submitted deck against a meta field, and breed new decks — the same methods as
// scripts/forge.ts and scripts/season.ts, run on the in-browser worker pool.
import { CARDS, CARD_BY_ID, cardLabel } from '../engine/cards';
import { counts, listFingerprint, ramLimits, validateDeck } from '../engine/deck';
import type { DeckList } from '../engine/types';
import { analyzeDeck, type DeckReport } from '../analysis/analyze';
import type { PlayerSummary } from '../analysis/summarize';
import { breedSeason, type Bred, type BreedPackages } from '../ai/breeder';
import { canCut, checkChange, isEmptyPlan, packageName, tunerPackageMoves, type PackageMoveKind, type PackagePlan } from './deckPackages';
import { cutReason, partnerAwarePicks, type CutRow } from './cutRanking';
import impact from '../data/impact.json';
import { findImpactDeck, IMPACT_MIN_DECK_GAMES, IMPACT_MIN_POOLED_GAMES, type ImpactData } from '../analysis/impactData';
import { RATINGS, SEASONS } from '../data/index';
import { gameDeck, type PlayGame } from './tournament';
import { adoptionRule, confirmStaged, formatGain, nomineeRecord, pairedInterval, pickAdopted, scoreOf, type AdoptionRule, type NomineeRecord, type Outcome, type PairedInterval } from './evidence';
import { combinedCandidates, DEPTH_DEFAULTS, estimateGames, listKeyOf, type SearchDepth } from './deckSearch';
import type { LibraryDeck } from './library';
import { h2hFileLookup, type H2HFileLike, type H2HRecord } from './h2hModel';
import { finalVsOriginal, vsOriginalVerdict, type VsOriginal } from './tuneRecord';

export { finalVsOriginal, vsOriginalVerdict, type VsOriginal, type VsOriginalVerdict } from './tuneRecord';

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
  /** each game's score for the deck (win 1, tie ½, loss 0), in seed order, for paired comparisons */
  scores: number[];
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
  const scores = res.map((r) => scoreOf(r.winner));
  const w = scores.reduce((a, s) => a + s, 0);
  return { wr: w / res.length, games: res.length, sums: res.flatMap((r) => (r.summary ? [r.summary] : [])), scores };
}

// ---------------------------------------------------------------- tuning (forge)
export interface Swap {
  label: string;
  deck: DeckList;
  prior: number;
  /** set for a package move (src/lib/deckPackages.ts) */
  pkg?: { kind: PackageMoveKind; added: string | null; removed: string | null };
  /** set for a candidate combined from several screened changes (search depth 2 or 3) */
  combo?: { parts: string[]; packages: boolean };
}
const labelOf = (id: string) => {
  const c = CARD_BY_ID[id];
  return c ? cardLabel(c) : id;
};
/** The tuner's plain card score: the list's own "Δ when drawn", else format-wide impact, else 0. */
const plainScore = (rep: DeckReport) => {
  const iwd = new Map(rep.cards.filter((c) => Number.isFinite(c.iwd)).map((c) => [c.id, c.iwd]));
  return (id: string) => iwd.get(id) ?? GLOBAL_IMPACT[id] ?? 0;
};

/** Partner-aware ranking input for candidateSwaps (src/lib/cutRanking.ts): the baseline's own summaries. */
export interface PartnerAwareInput {
  sums: readonly PlayerSummary[];
}

/**
 * Candidate one-card swaps: cut the deck's lowest-impact cards, add its own best card or the best legal cards
 * format-wide. Under a package plan, cuts the plan protects are skipped and swaps that break it are dropped.
 * With `partner` the cuts and adds are ranked partner-aware (src/lib/cutRanking.ts) and `rows` explains every cut;
 * without it the candidates are exactly the ones before that ranking existed (tests/deck-packages-defaults.test.ts).
 */
export function candidateSwaps(deck: DeckList, rep: DeckReport, n = 6, plan: PackagePlan = {}, partner?: PartnerAwareInput): Swap[] {
  return swapsAndCuts(deck, rep, n, plan, partner).swaps;
}

/** candidateSwaps with the partner-aware cut ranking (rows: every main-deck card, both scores, offered or not and why). */
export function swapsAndCuts(deck: DeckList, rep: DeckReport, n = 6, plan: PackagePlan = {}, partner?: PartnerAwareInput): { swaps: Swap[]; cuts?: CutExplained[] } {
  const planned = !isEmptyPlan(plan);
  const cs = counts(deck.main);
  const lim = ramLimits(deck);
  const iwd = new Map(rep.cards.filter((c) => Number.isFinite(c.iwd)).map((c) => [c.id, c.iwd]));
  let cuts: { id: string; v: number }[];
  let adds: { id: string; v: number }[];
  let rows: CutExplained[] | undefined;
  if (partner) {
    const legal = CARDS.filter((c) => c.type !== 'Legend' && c.ram <= lim[c.color] && (cs.get(c.id) ?? 0) < 3).map((c) => c.id);
    const picks = partnerAwarePicks(deck, {
      plain: plainScore(rep),
      sums: partner.sums,
      lockedWhy: (id) => (planned ? cutBlock(deck, id, plan) : undefined),
      own: (id) => iwd.get(id) ?? 0,
      globalImpact: GLOBAL_IMPACT,
      outside: legal,
    });
    cuts = picks.cuts;
    adds = picks.adds;
    rows = explainCuts(deck, rep, plan, picks.rows);
  } else {
    cuts = [...cs.keys()]
      .filter((id) => !planned || canCut(deck, id, plan))
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
    adds = [...own, ...outside.filter((o) => !own.some((x) => x.id === o.id))];
  }
  const out: Swap[] = [];
  for (const c of cuts)
    for (const a of adds) {
      if (a.id === c.id) continue;
      const main = [...deck.main];
      main.splice(main.indexOf(c.id), 1, a.id);
      const d = { ...deck, main };
      if (validateDeck({ ...d, sideboard: [] }).length) continue;
      if (planned && checkChange(deck, d, plan).length) continue;
      out.push({ label: `−1 ${labelOf(c.id)} → +1 ${labelOf(a.id)}`, deck: d, prior: a.v - c.v });
    }
  return { swaps: out.sort((a, b) => b.prior - a.prior).slice(0, n), ...(rows ? { cuts: rows } : {}) };
}

/** Why the plan refuses cutting one copy of `id` (keep or lock), or undefined when it allows it. */
function cutBlock(deck: DeckList, id: string, plan: PackagePlan): string | undefined {
  const i = deck.main.indexOf(id);
  if (i < 0) return undefined;
  const main = [...deck.main];
  main.splice(i, 1);
  const v = checkChange(deck, { ...deck, main }, plan);
  return v.length ? `the plan ${v[0]!.rule === 'lock' ? 'locks it' : `keeps ${packageName(v[0]!.id)}`}` : undefined;
}

/** One cut row for the Lab's table: both scores, offered or not, and why in one line. */
export interface CutExplained {
  id: string;
  name: string;
  plain: number;
  /** the partner-aware score with every stranding penalty (lower = cut first) */
  score: number;
  partner?: CutRow['partner'];
  strand: CutRow['strand'];
  offered: boolean;
  /** offered by the plain ranking (the one before partner-aware ranking) */
  plainOffered: boolean;
  locked?: string;
  why: string;
}

function explainCuts(deck: DeckList, rep: DeckReport, plan: PackagePlan, rows: (CutRow & { offered: boolean })[]): CutExplained[] {
  const planned = !isEmptyPlan(plan);
  const plain = plainScore(rep);
  const plainCuts = new Set(
    [...counts(deck.main).keys()]
      .filter((id) => !planned || canCut(deck, id, plan))
      .map((id) => ({ id, v: plain(id) }))
      .sort((a, b) => a.v - b.v)
      .slice(0, 3)
      .map((x) => x.id),
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    plain: r.plain,
    score: r.score,
    ...(r.partner ? { partner: r.partner } : {}),
    strand: r.strand,
    offered: r.offered,
    plainOffered: plainCuts.has(r.id),
    ...(r.locked ? { locked: r.locked } : {}),
    why: cutReason(r, plainCuts.has(r.id)),
  }));
}

/** Package moves for a tuning round, scored like the swaps (the list's own impact, else format-wide). */
export function candidatePackageMoves(deck: DeckList, rep: DeckReport, plan: PackagePlan, o: { moves: boolean; n: number }): Swap[] {
  const iwd = new Map(rep.cards.filter((c) => Number.isFinite(c.iwd)).map((c) => [c.id, c.iwd]));
  return tunerPackageMoves(deck, plan, { ...o, score: (id) => iwd.get(id) ?? GLOBAL_IMPACT[id] ?? 0 }).map((m) => ({ label: m.label, deck: m.deck, prior: m.prior, pkg: { kind: m.kind, added: m.added, removed: m.removed } }));
}

export interface TuneOptions {
  games: number; // games per test
  gens: number;
  cands: number;
  bot: string;
  /** a swap must beat the baseline by this much on the shared seeds to be nominated (screening only nominates) */
  minGain: number;
  /** seed base (default: random in 500,000–508,999); generation g plays seeds from seedBase + 10,000·g */
  seedBase?: number;
  /** synergy packages: swaps that break the plan are never played (src/lib/deckPackages.ts) */
  plan?: PackagePlan;
  /** also try whole-package moves (complete, add, swap, remove), `packageCands` of them per generation (default 3) */
  packageMoves?: boolean;
  packageCands?: number;
  /** the adoption rule (src/lib/evidence.ts; default ADOPTION_DEFAULTS); `{ kind: 'any-gain' }` is the rule before 2026-11-11 */
  rule?: Partial<AdoptionRule>;
  /** search depth (src/lib/deckSearch.ts; default one change per candidate, one nominee) */
  depth?: Partial<SearchDepth>;
  /**
   * rank cuts and adds partner-aware (src/lib/cutRanking.ts) from each generation's own telemetry, and record why each
   * card was or was not offered as a cut (TuneLog.cuts). Off here so the pinned sequences hold; the Deck Lab page turns it on.
   */
  partnerAware?: boolean;
  /**
   * games per list on one common held-out block (seeds no screening or confirmation uses) on which the current list is
   * compared with the original, paired, after every generation that adopted a change (TuneLog.vsOriginal). 0 or unset:
   * off. The Deck Lab page passes vsOriginalGames(games). It plays only after an adoption: the original once, then each
   * adopted list once.
   */
  vsOriginal?: number;
}

/** Games per list on the vs-original block for `games` games per test: twice the first confirmation stage. */
export const vsOriginalGames = (games: number) => 4 * games;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * One line per generation for the headline trajectory: the current list against the original on the common held-out
 * games ("After generation 2: 1 change adopted; +2.1 pts [−0.4, +4.6], 448 games against your original list — could
 * not tell."). Empty for a generation that has no vs-original state (a run without `vsOriginal`, or one stopped first).
 */
export function trajectoryLine(l: Pick<TuneLog, 'gen' | 'vsOriginal'>, minGainPp: number): string {
  const v = l.vsOriginal;
  if (!v) return '';
  if (v.same) return `After generation ${l.gen}: no change adopted yet, so the list is still your original.`;
  const verdict = vsOriginalVerdict(v, minGainPp);
  const word = verdict === 'better' ? 'better' : verdict === 'worse' ? 'worse' : 'could not tell';
  const g = v.gain ? `${formatGain(v.gain)} against your original list (the same games for both)` : 'not measured';
  return `After generation ${l.gen}: ${plural(v.adopted, 'change')} adopted${v.measured ? '' : ' (none this generation)'}; ${g} — ${word}.`;
}

/**
 * The run's result in plain words, from the final list's vs-original state: what was adopted and whether the tuned list
 * is shown better than the original. When it is not, it says so and that the original stays the result.
 */
export function tuneSummaryText(logs: readonly Pick<TuneLog, 'gen' | 'adopted' | 'vsOriginal'>[], o: { minGainPp: number; partial?: boolean }): string {
  const gens = logs.length;
  const adopted = logs.filter((l) => l.adopted).length;
  const head = `After ${plural(gens, 'generation')}${o.partial ? ' (stopped early)' : ''}`;
  if (!adopted) return `${head}: no change was adopted, so the result is your original list.`;
  const v = finalVsOriginal(logs);
  const verdict = vsOriginalVerdict(v, o.minGainPp);
  const did = `adopted ${plural(adopted, 'change')}`;
  if (!v?.gain || !verdict || verdict === 'unchanged')
    return `${head}: ${did}, but the run ended before the tuned list was compared with your original list, so it is not shown to be better. Your original list stays the result; the tuned list is kept below for reference.`;
  const g = `${formatGain(v.gain)} against your original list on the same held-out games`;
  if (verdict === 'better') return `${head}: ${did}; the tuned list is ${g} — better (the lower bound clears ${plural(o.minGainPp, 'point')}).`;
  if (verdict === 'worse') return `${head}: ${did}, but the tuned list is ${g} — worse than your original list. Your original list stays the result; the tuned list is kept below for reference.`;
  return `${head}: ${did}, but the tuned list is ${g} — could not tell. It is not shown to be better, so your original list stays the result; the tuned list is kept below for reference.`;
}

export interface TuneLog {
  gen: number;
  baseline: number;
  report?: DeckReport;
  /** every candidate screened on the baseline's games, best first; `gain` is the paired screening gain (plain 95%) */
  swaps: { label: string; wr: number; pkg?: Swap['pkg']; combo?: boolean; gain?: { mean: number; lower: number; upper: number; games: number } }[];
  /** the first nominee's confirmation (the adopted one when there is one), for the one-line summary */
  confirm?: { base: number; swap: number; label: string; outcome?: Outcome; gain?: PairedInterval; looks?: number };
  /** each nominee: screening and held-out paired results and the outcome */
  nominees?: NomineeRecord[];
  adopted: string | null;
  /** the adopted change's held-out paired gain */
  adoptedGain?: PairedInterval;
  /** partner-aware runs: every main-deck card's cut ranking, both scores, offered or not and why */
  cuts?: CutExplained[];
  /** runs with `vsOriginal`: the current list against the original after this generation */
  vsOriginal?: VsOriginal;
}

/** The rule, depth and game estimate of a tuning run (the Lab shows the estimate before it starts). */
export function tunePlan(o: Pick<TuneOptions, 'games' | 'gens' | 'cands' | 'packageMoves' | 'packageCands' | 'rule' | 'depth' | 'plan' | 'vsOriginal'>) {
  const rule = adoptionRule(o.rule);
  const depth: SearchDepth = { ...DEPTH_DEFAULTS, ...o.depth };
  const pkN = o.packageCands ?? 3;
  const estimate = estimateGames({
    gens: o.gens,
    screenGames: o.games,
    singles: o.cands,
    packageMoves: (o.packageMoves ? pkN : 0) + (o.plan?.require?.length ? pkN : 0),
    depth,
    firstStage: o.games * 2,
    rule,
  });
  // the vs-original block: the original once and each adopted list once (at most one adoption per generation)
  const vsGames = o.vsOriginal ?? 0;
  const vsMax = vsGames ? vsGames * (o.gens + 1) : 0;
  return { rule, depth, estimate: { ...estimate, max: estimate.max + vsMax }, firstStage: o.games * 2, vsGames, vsMax };
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
  const plan = o.plan ?? {};
  const pkN = o.packageCands ?? 3;
  const { rule, depth, estimate, firstStage } = tunePlan(o);
  const stages = rule.kind === 'any-gain' ? 1 : rule.capStages;
  if (o.games > 5_000 || firstStage * stages > 5_000) throw new Error(`the confirmation would need ${firstStage * stages} seeds but each generation has 5,000; use fewer games or a lower cap`);
  const total = estimate.max;
  const perGen = total / Math.max(1, o.gens);
  const seedBase = o.seedBase ?? 500_000 + Math.floor(Math.random() * 9_000);
  const p: TuneProgress = { done: 0, total, phase: 'Starting…', logs, deck, seedBase, played: 0 };
  const tick = () => {
    p.done++;
    p.played++;
    if (p.done % 4 === 0) onProgress({ ...p, logs: [...logs] });
  };
  const isPkg = (s: Swap) => !!s.pkg || !!s.combo?.packages;
  // the vs-original block: seeds after the last generation's (generation g uses seedBase + g·10,000 up to + 5,000 + cap)
  const vsN = o.vsOriginal ?? 0;
  const vsSeed = seedBase + (o.gens + 1) * 10_000;
  let origScores: number[] | null = null;
  let adoptedSoFar = 0;
  /** after each generation: the current list against the original (measured only when this generation adopted) */
  const track = async (log: TuneLog, adoptedNow: boolean) => {
    if (!vsN) return;
    const prev = finalVsOriginal(logs.slice(0, -1));
    if (!adoptedNow) {
      log.vsOriginal = prev ? { ...prev, measured: false } : { same: true, adopted: 0, measured: false };
      return;
    }
    if (stop()) return;
    p.phase = `Generation ${log.gen}: comparing the list with the original on ${vsN} common held-out games`;
    onProgress({ ...p, logs: [...logs] });
    if (!origScores) origScores = (await playSet(start, field, vsSeed, vsN, o.bot, play, false, tick)).scores;
    const cur = await playSet(deck, field, vsSeed, vsN, o.bot, play, false, tick);
    const orig = origScores;
    log.vsOriginal = { same: false, adopted: adoptedSoFar, gain: pairedInterval(cur.scores, orig), origWr: orig.reduce((a, x) => a + x, 0) / Math.max(1, orig.length), curWr: cur.wr, measured: true };
  };
  for (let gen = 1; gen <= o.gens && !stop(); gen++) {
    const seed0 = seedBase + gen * 10_000;
    p.phase = `Generation ${gen}: measuring the deck (${o.games} games with telemetry)`;
    onProgress({ ...p });
    const base = await playSet(deck, field, seed0, o.games, o.bot, play, true, tick);
    const report = analyzeDeck(deck.name, base.sums);
    const log: TuneLog = { gen, baseline: base.wr, report, swaps: [], adopted: null };
    logs.push(log);
    const ranked = swapsAndCuts(deck, report, o.cands, plan, o.partnerAware ? { sums: base.sums } : undefined);
    const swaps = ranked.swaps;
    if (ranked.cuts) log.cuts = ranked.cuts;
    if (o.packageMoves || plan.require?.length) swaps.push(...candidatePackageMoves(deck, report, plan, { moves: !!o.packageMoves, n: pkN }));
    const screened: { s: Swap; wr: number }[] = [];
    const screen = async (list: Swap[], what: (s: Swap) => string) => {
      for (const [k, s] of list.entries()) {
        if (stop()) break;
        p.phase = `Generation ${gen}: testing ${what(s)} ${k + 1} of ${list.length} on the same games`;
        onProgress({ ...p, logs: [...logs] });
        const r = await playSet(s.deck, field, seed0, o.games, o.bot, play, false, tick);
        const iv = pairedInterval(r.scores, base.scores);
        screened.push({ s, wr: r.wr });
        log.swaps.push({ label: s.label, wr: r.wr, ...(s.pkg ? { pkg: s.pkg } : {}), ...(s.combo ? { combo: true } : {}), gain: { mean: iv.mean, lower: iv.lower, upper: iv.upper, games: iv.games } });
      }
    };
    await screen(swaps, (s) => (s.pkg ? 'package move' : 'swap'));
    // depth: combine the best screened single changes (those above the baseline)
    const seen = new Set([listKeyOf(deck), ...swaps.map((s) => listKeyOf(s.deck))]);
    const above = (pkg: boolean) => [...screened].filter((x) => !!x.s.pkg === pkg && x.wr > base.wr).sort((a, b) => b.wr - a.wr).map((x) => x.s);
    const make = (parts: Swap[], d: DeckList): Swap => ({ label: parts.map((x) => x.label).join(' + '), deck: d, prior: parts.reduce((t, x) => t + x.prior, 0), combo: { parts: parts.map((x) => x.label), packages: parts.some((x) => !!x.pkg) } });
    const combos = stop()
      ? []
      : [
          ...(depth.cardsPerChange > 1 ? combinedCandidates(deck, above(false), { maxParts: depth.cardsPerChange, from: depth.combineFrom, plan, seen }, make) : []),
          ...(depth.packagesPerChange > 1 ? combinedCandidates(deck, above(true), { maxParts: depth.packagesPerChange, from: depth.combineFrom, plan, seen }, make) : []),
        ];
    await screen(combos, () => 'combined change');
    const all = [...swaps, ...combos];
    log.swaps.sort((a, b) => b.wr - a.wr);
    // screening only nominates: the best changes that beat the baseline by minGain on the shared games
    const nominated = log.swaps.filter((x) => x.wr - base.wr >= o.minGain).slice(0, depth.nominees);
    if (!nominated.length || stop()) {
      if (!stop()) await track(log, false);
      p.done = Math.max(p.done, Math.round(gen * perGen));
      continue;
    }
    const nomDecks = nominated.map((x) => all.find((s) => s.label === x.label)!);
    p.phase = `Generation ${gen}: confirming ${nominated.length === 1 ? 'the best change' : `the best ${nominated.length} changes`} on fresh paired games (stages of ${firstStage}${stages > 1 ? `, up to ${firstStage * stages}` : ''})`;
    onProgress({ ...p, logs: [...logs] });
    const seed1 = seed0 + 5_000;
    const conf = await confirmStaged(
      rule,
      nomDecks.map((s) => ({ minGainPp: isPkg(s) ? rule.packageMinGainPp : rule.minGainPp })),
      firstStage,
      async ({ offset, games, active }) => {
        // the current list's games are started first, then each nominee's (the order the legacy confirmation used)
        const [b, ...ns] = await Promise.all([deck, ...active.map((i) => nomDecks[i]!.deck)].map((d) => playSet(d, field, seed1 + offset, games, o.bot, play, false, tick)));
        return { base: b!.scores, nominees: ns.map((r) => r.scores) };
      },
      stop,
    );
    const pick = pickAdopted(conf.results);
    log.nominees = nominated.map((x, i) => {
      const s = nomDecks[i]!;
      const sg = x.gain ?? { mean: 0, lower: -1, upper: 1, games: 0 };
      return nomineeRecord(x.label, { ...sg, z: 1.96 }, conf.results[i], s.combo ? `combo-${s.combo.packages ? 'packages' : 'cards'}` : s.pkg?.kind);
    });
    const shown = conf.results[pick >= 0 ? pick : 0]!;
    log.confirm = { base: shown.baseWr, swap: shown.candWr, label: nominated[pick >= 0 ? pick : 0]!.label, outcome: shown.outcome, gain: shown.heldOut, looks: shown.looks };
    if (pick >= 0) {
      deck = nomDecks[pick]!.deck;
      log.adopted = nominated[pick]!.label;
      log.adoptedGain = shown.heldOut;
      adoptedSoFar++;
    }
    p.deck = deck;
    // report the adopted list before the vs-original games, so a run stopped during them can still save it
    if (pick >= 0) onProgress({ ...p, logs: [...logs] });
    if (!stop()) await track(log, pick >= 0);
    p.done = Math.max(p.done, Math.round(gen * perGen));
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

/**
 * The name a tuned list is saved under before the library's reserved-name check: "X (tuned)", "X (tuned, partial)" for a
 * stopped run, and ", not shown better" added when the tuned list was not shown better than the original.
 */
export function tunedName(name: string, partial = false, notShownBetter = false): string {
  const base = name.replace(/ ?\(tuned(, partial)?(, not shown better)?\)$/, '');
  return `${base} (tuned${partial ? ', partial' : ''}${notShownBetter ? ', not shown better' : ''})`;
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
  /** synergy packages to build around (BreedInput.packages): seeds for the explorers, a plan for every deck */
  packages?: BreedPackages;
}

/** a's record against b (wins w of g games) and, when h2h.json has a model, the shrunk estimate p (src/lib/h2hModel.ts) */
export type H2H = (a: string, b: string) => H2HRecord;
export interface H2HInfo {
  lookup: H2H;
  /** events pooled into the file */
  events: number;
  /** recorded events the file left out on purpose (another sim version or bot: its `pool` field) */
  excluded: number;
  games: number;
  updated: string;
  /** the file carries shrunk estimates (built from 2026-11-12) */
  shrunk: boolean;
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
 * Returns null when it hasn't been built yet. The lookup gives the raw record and, from files with a model, the
 * estimate shrunk toward the power ratings (which the breeder's counter ranking prefers).
 */
export async function loadH2H(): Promise<H2HInfo | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/h2h.json`);
    if (!r.ok) return null;
    const d = (await r.json()) as H2HFileLike & { updated: string; events: number; games: number; pool?: { excluded: unknown[] } };
    return { lookup: h2hFileLookup(d), events: d.events, excluded: d.pool?.excluded.length ?? 0, games: d.games, updated: d.updated, shrunk: !!d.shrunk };
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
  const out = breedSeason(0, { ranked, impact: GLOBAL_IMPACT, seenTriples, seed: o.seed, deckImpact, h2h: usable ? o.h2h : undefined, ...(o.packages ? { packages: o.packages } : {}) }, o.n);
  return out.map((b, i) => {
    const name = b.deck.name.replace(/^S0-\d+/, `Lab-${String(o.seed % 1000).padStart(3, '0')}-${String(i + 1).padStart(2, '0')}`);
    return { ...b, deck: { ...b.deck, name } };
  });
}
