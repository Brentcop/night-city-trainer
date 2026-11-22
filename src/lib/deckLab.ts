// Deck Lab core (browser): tune a submitted deck against a meta field, and breed new decks — the same methods as
// scripts/forge.ts and scripts/season.ts, run on the in-browser worker pool.
//
// Earlier held-out games (TuneOptions.ledger; docs/SYNERGIES.md "Pooling held-out games across runs"): with a store of
// the change ledger, the tuner records every screening and held-out paired game as the forge does and judges a nominee
// that already has held-out games on them and the new games pooled (src/lib/changeLedgerRun.ts holds the logic both
// share; the browser store is src/lib/changeLedgerStore.ts). Without it every log, game and result is the one before.
//
// Breeding: parents are ranked by src/lib/parentStrength.ts (rankedParents hands it the bundled ratings and seasons), and
// a bred deck's test against its reference (src/lib/breedGate.ts runLabTest) plays its blocks through labGatePlay.
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
import { RATINGS, SEASONS, type SeasonsData } from '../data/index';
import { rankLibraryParents, type RatedDeck } from './parentStrength';
import { gameDeck, SIM_VERSION, type PlayGame } from './tournament';
import { adoptionRule, confirmStaged, DEFAULT_REACH, formatGain, judgePooled, nomineeRecord, pairedInterval, pickAdopted, scoreOf, settleStages, type AdoptionRule, type Confirmation, type ConfirmedWith, type NomineeRecord, type Outcome, type PairedInterval, type PairedScores, type SettleRecord } from './evidence';
import { gameIds, ledgerBot, type BatchKind } from './changeLedger';
import { blockSlots, ChangeLedgerRun, confirmationSlots, scored, type LedgerBackend, type LedgerTotals } from './changeLedgerRun';
import { HeldOutTracker, withSplit, type NomineeSplit } from './pairedSplit';
import { combinedCandidates, confirmedWith, DEPTH_DEFAULTS, estimateGames, listKeyOf, settleExtra, type SearchDepth } from './deckSearch';
import { byPooledGain, outOfReach, pooledFigure, shortlistGeneration, shortlistOptions, type PooledFigure, type ShortlistNote, type ShortlistOptions } from './shortlist';
import type { LibraryDeck } from './library';
import { h2hFileLookup, type H2HFileLike, type H2HRecord } from './h2hModel';
import { finalVsOriginal, manifestTune, tunedRecord, vsOriginalVerdict, type TunedDeckRecord, type VsOriginal } from './tuneRecord';
import type { RunManifest } from './runManifest';
import type { GatePlay } from './breedGate';

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

/**
 * A bred deck's test (src/lib/breedGate.ts runLabTest) over a game pool: each block is a playSet from its seed, which is
 * the gate's layout (game k plays field[k mod n] with seed seed0 + k, the deck first when floor(k / n) is even).
 */
export function labGatePlay(play: PlayGame, onGame?: () => void): GatePlay {
  return async (r) => (await playSet(r.deck, [...r.field], r.seed0, r.games, r.bot, play, false, onGame)).scores;
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
  /**
   * earlier held-out games (the change ledger): record every screening and held-out paired game in `store`, and judge a
   * nominee with held-out games from earlier runs (same simulator version, bot and field) on them and the new games
   * pooled, by the strict rule (confirmStaged's priors), as the forge does with --ledger. A screened change whose
   * earlier games alone already reject it is not nominated (TuneLog.notNominated). Under the any-gain rule the games are
   * recorded but never pooled. Absent: every game and log is the one before the ledger existed.
   */
  ledger?: TuneLedger;
  /**
   * a shortlist from pooled evidence (src/lib/shortlist.ts; needs `ledger` and the evidence rule; empty object = the
   * defaults): each generation screens first the most promising one-card swaps earlier runs left undecided, skips the
   * generator's picks that earlier games drop, fills up to `cands` from the generator's order, and nominates by pooled
   * gain over every game of a change (TuneLog.shortlist, swaps[].pooled). Absent: every game and log is as before.
   */
  shortlist?: Partial<ShortlistOptions>;
  /**
   * "until settled" (confirmStaged's `settle`; the evidence rule only; `{}` = the default reach, DEFAULT_REACH): a nominee
   * still undecided at the cap goes on in further stages of the same size, each judged by the strict pooled rule on all
   * its held-out games, while within the reach and while this generation's 5,000 confirmation seeds last (about 4,900
   * held-out games a confirmation; the rest is for a later run). Works with or without `ledger` (with it every further
   * stage is recorded). Absent: every game and log is as before.
   */
  untilSettled?: { reach?: number };
  /**
   * the bot that plays the confirmation stages, "until settled"'s and the comparison with the original list (screening
   * and its telemetry stay with `bot`). Absent, or the same bot as `bot`: every game and log as before. Another bot: the
   * held-out games go to its entry of the earlier games and are pooled from it, and the shortlist is off for the run (it
   * ranks a change by its screening and held-out games together, and games of two bots are never pooled).
   */
  confirmBot?: string;
}

/** A change-ledger store the tuner can use: loaded per base list before each generation, then read synchronously. */
export interface TuneLedgerStore extends LedgerBackend {
  /** load what is kept for this base list (its list fingerprint), after every write queued so far */
  load(base: string): Promise<void>;
  /** wait until everything appended so far is written (never rejects) */
  flush(): Promise<unknown>;
}
export interface TuneLedger {
  store: TuneLedgerStore;
  /** this run's id in the ledger (default "deck-lab <time> seed <seed base>") */
  run?: string;
  /** YYYY-MM-DD (default today) */
  date?: string;
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
  swaps: { label: string; wr: number; pkg?: Swap['pkg']; combo?: boolean; gain?: { mean: number; lower: number; upper: number; games: number }; pooled?: { mean: number; games: number; earlier: number } }[];
  /** runs with a shortlist: the changes carried from earlier runs and the generator's picks skipped, with why */
  shortlist?: ShortlistNote;
  /**
   * the first nominee's confirmation (the adopted one when there is one), for the one-line summary; `priorGames`: pooled
   * with earlier runs, this many of the held-out games came from them
   */
  confirm?: { base: number; swap: number; label: string; outcome?: Outcome; gain?: PairedInterval; looks?: number; priorGames?: number };
  /** each nominee: screening and held-out paired results and the outcome */
  nominees?: NomineeRecord[];
  /** runs with a ledger: changes that screened well enough but were not nominated because their earlier held-out games alone reject them */
  notNominated?: NotNominated[];
  adopted: string | null;
  /** the adopted change's held-out paired gain */
  adoptedGain?: PairedInterval;
  /** the adopted change's gain was pooled with earlier runs: this many of its games came from them */
  adoptedPriorGames?: number;
  /** the adopted change was confirmed until settled: its further stages (TuneOptions.untilSettled) */
  adoptedSettle?: SettleRecord;
  /** partner-aware runs: every main-deck card's cut ranking, both scores, offered or not and why */
  cuts?: CutExplained[];
  /** runs with `vsOriginal`: the current list against the original after this generation */
  vsOriginal?: VsOriginal;
}

/** A change its earlier held-out games already reject, so it was not nominated: its screening and pooled figures. */
export interface NotNominated {
  label: string;
  /** the screening gain on this generation's games (plain 95%) */
  screen: { games: number; mean: number; lower: number; upper: number };
  /** the earlier held-out games alone, judged by the strict pooling rule */
  heldOut: PairedInterval;
  /** = heldOut.games: every one from earlier runs */
  priorGames: number;
  /** runs with a shortlist: 'out-of-reach' when the earlier held-out games do not reject it but would need more than the reach (absent: they reject it) */
  why?: 'out-of-reach';
  /** with why 'out-of-reach': the held-out games it would need in all (absent when its held-out gain is not above the bar) */
  toSettle?: number;
  /** with why 'out-of-reach': the reach */
  reach?: number;
}

/** Seeds a generation's confirmation may use (generation g: seedBase + g·10,000 + 5,000 up to the next generation's first). */
export const LAB_CONFIRM_SEEDS = 5_000;

/**
 * The rule, depth and game estimate of a tuning run (the Lab shows the estimate before it starts). With `untilSettled`,
 * `settle` says what it may add at most (`extra` games, never part of `estimate`), its reach and the further stages each
 * generation's seeds allow.
 */
export function tunePlan(o: Pick<TuneOptions, 'games' | 'gens' | 'cands' | 'packageMoves' | 'packageCands' | 'rule' | 'depth' | 'plan' | 'vsOriginal' | 'untilSettled'> & Partial<Pick<TuneOptions, 'bot' | 'confirmBot'>>) {
  const rule = adoptionRule(o.rule);
  const depth: SearchDepth = { ...DEPTH_DEFAULTS, ...o.depth };
  const pkN = o.packageCands ?? 3;
  const firstStage = o.games * 2;
  const estimate = estimateGames({
    gens: o.gens,
    screenGames: o.games,
    singles: o.cands,
    packageMoves: (o.packageMoves ? pkN : 0) + (o.plan?.require?.length ? pkN : 0),
    depth,
    firstStage,
    rule,
  });
  // the vs-original block: the first adoption is derived from its confirmation (gain 7), so the block plays at most
  // gens − 1 adoptions + the original once on the second adoption = gens × vsGames; with one generation it is always 0
  const vsGames = o.vsOriginal ?? 0;
  const vsMax = vsGames && o.gens >= 2 ? vsGames * o.gens : 0;
  const capStages = rule.kind === 'any-gain' ? 1 : rule.capStages;
  const reach = o.untilSettled?.reach ?? DEFAULT_REACH;
  const stages = o.untilSettled && rule.kind === 'evidence' ? settleStages({ seedStages: Math.floor(LAB_CONFIRM_SEEDS / firstStage) - capStages, reach, firstStage, capStages }) : 0;
  const settle = o.untilSettled && rule.kind === 'evidence' ? { reach, stages, extra: settleExtra({ gens: o.gens, firstStage, stages, nominees: depth.nominees }) } : null;
  // another bot confirming: the confirmations and the comparison with the original are its games, at most
  const bots = o.bot !== undefined ? confirmedWith(o.bot, o.confirmBot) : null;
  const confirm = bots ? { with: bots, games: o.gens * estimate.confirm + vsMax } : null;
  return { rule, depth, estimate: { ...estimate, max: estimate.max + vsMax }, firstStage, vsGames, vsMax, settle, confirm };
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
  /** runs with a ledger: what this run has recorded so far (games written, already held, conflicts, left out) */
  ledger?: Record<BatchKind, LedgerTotals>;
  /**
   * each generation's nominees' held-out games by opponent and seat, in the order of its log's `nominees` (null: none
   * recorded). Kept beside the logs, not in them, so the logs stay exactly as before (tests/deck-lab-ledger.test.ts).
   */
  splits?: NomineeSplits[];
}

/** One generation's nominees split by opponent (list fingerprint) and seat, with the opponents' names. */
export interface NomineeSplits {
  gen: number;
  /** list fingerprint → deck name */
  names: Record<string, string>;
  nominees: (NomineeSplit | null)[];
}

export async function tuneDeck(start: DeckList, field: DeckList[], o: TuneOptions, play: PlayGame, onProgress: (p: TuneProgress) => void, stop: () => boolean): Promise<TuneProgress> {
  let deck = structuredClone(start);
  const logs: TuneLog[] = [];
  const plan = o.plan ?? {};
  const pkN = o.packageCands ?? 3;
  const { rule, depth, estimate, firstStage, settle } = tunePlan(o);
  const stages = rule.kind === 'any-gain' ? 1 : rule.capStages;
  if (o.games > 5_000 || firstStage * stages > LAB_CONFIRM_SEEDS) throw new Error(`the confirmation would need ${firstStage * stages} seeds but each generation has 5,000; use fewer games or a lower cap`);
  if (o.untilSettled && rule.kind !== 'evidence') throw new Error('"until settled" needs the evidence rule: under any-gain there is one confirmation and nothing is pooled');
  /** "until settled": the further stages each generation's seeds and the reach allow (0 when off) */
  const further = settle?.stages ?? 0;
  // with "until settled" the most it may add is part of the progress total, so the bar never runs past the end
  const total = estimate.max + (settle?.extra ?? 0);
  const perGen = total / Math.max(1, o.gens);
  const seedBase = o.seedBase ?? 500_000 + Math.floor(Math.random() * 9_000);
  const p: TuneProgress = { done: 0, total, phase: 'Starting…', logs, deck, seedBase, played: 0 };
  // another bot confirming (absent: the screening bot, every game as before)
  const bots: ConfirmedWith | null = confirmedWith(o.bot, o.confirmBot);
  const confirmBot = bots?.confirm ?? o.bot;
  // earlier held-out games (the change ledger): the run's entry context, and whether priors are pooled (never under any-gain)
  const ledger = o.ledger ? ledgerRun(o.ledger, o.bot, field, seedBase) : null;
  /** the held-out games' entry: the confirming bot's (the same store, run and totals) when another bot confirms */
  const heldLedger = ledger && bots ? confirmLedger(ledger, bots.confirm) : ledger;
  const pooling = !!ledger && rule.kind === 'evidence';
  if (ledger) p.ledger = ledger.totals;
  // the shortlist from pooled evidence: built from the ledger's games, and only where they are pooled (and one bot plays)
  if (o.shortlist && !o.ledger) throw new Error('the shortlist needs earlier held-out games (TuneOptions.ledger)');
  if (o.shortlist && rule.kind !== 'evidence') throw new Error('the shortlist needs the evidence rule: under any-gain earlier games are never pooled');
  const short = o.shortlist && pooling && ledger && !bots ? shortlistOptions(o.shortlist) : null;
  /** the field's list fingerprints in the order playSet uses them (field[k % n]) */
  const opponents = ledger ? ledger.o.opponents : [];
  /** the field's list fingerprints and names, for each nominee's held-out games by opponent */
  const fieldIds = field.map((d) => listFingerprint(d));
  const fieldNames = Object.fromEntries(field.map((d, i) => [fieldIds[i]!, d.name]));
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
  const track = async (log: TuneLog, adoptedNow: boolean, confResult?: Pick<Confirmation, 'heldOut' | 'baseWr' | 'candWr'>) => {
    if (!vsN) return;
    const prev = finalVsOriginal(logs.slice(0, -1));
    if (!adoptedNow) {
      log.vsOriginal = prev ? { ...prev, measured: false } : { same: true, adopted: 0, measured: false };
      return;
    }
    if (stop()) return;
    // the first adoption's confirmation already compared the adopted list against the original (gain 7)
    if (adoptedSoFar === 1 && confResult) {
      log.vsOriginal = { same: false, adopted: adoptedSoFar, gain: confResult.heldOut, origWr: confResult.baseWr, curWr: confResult.candWr, measured: true };
      return;
    }
    p.phase = `Generation ${log.gen}: comparing the list with the original on ${vsN} common held-out games`;
    onProgress({ ...p, logs: [...logs] });
    if (!origScores) origScores = (await playSet(start, field, vsSeed, vsN, confirmBot, play, false, tick)).scores;
    const cur = await playSet(deck, field, vsSeed, vsN, confirmBot, play, false, tick);
    const orig = origScores;
    log.vsOriginal = { same: false, adopted: adoptedSoFar, gain: pairedInterval(cur.scores, orig), origWr: orig.reduce((a, x) => a + x, 0) / Math.max(1, orig.length), curWr: cur.wr, measured: true };
  };
  for (let gen = 1; gen <= o.gens && !stop(); gen++) {
    // the ledger: this generation's base list is loaded before any game (an adoption changed it), and everything it
    // recorded is written before the next one starts, also when the run is stopped or a game fails
    if (o.ledger) await o.ledger.store.load(listFingerprint(deck));
    try {
      const seed0 = seedBase + gen * 10_000;
      p.phase = `Generation ${gen}: measuring the deck (${o.games} games with telemetry)`;
      onProgress({ ...p });
      const base = await playSet(deck, field, seed0, o.games, o.bot, play, true, tick);
      const report = analyzeDeck(deck.name, base.sums);
      const log: TuneLog = { gen, baseline: base.wr, report, swaps: [], adopted: null };
      logs.push(log);
      // with the shortlist the generator's whole order (its first `cands` are the swaps screened without it)
      const ranked = swapsAndCuts(deck, report, short ? Infinity : o.cands, plan, o.partnerAware ? { sums: base.sums } : undefined);
      let swaps = ranked.swaps;
      if (short && ledger) {
        const g = shortlistGeneration({
          run: ledger,
          base: deck,
          plan,
          rule: { rule, nominees: depth.nominees, minGainPp: rule.minGainPp, nominateBar: o.minGain, shortlist: short },
          picks: ranked.swaps,
          cands: o.cands,
          make: (cut, add, d) => ({ label: `−1 ${labelOf(cut)} → +1 ${labelOf(add)}`, deck: d, prior: 0 }),
        });
        swaps = g.candidates;
        log.shortlist = g.note;
      }
      if (ranked.cuts) log.cuts = ranked.cuts;
      if (o.packageMoves || plan.require?.length) swaps.push(...candidatePackageMoves(deck, report, plan, { moves: !!o.packageMoves, n: pkN }));
      const screened: { s: Swap; wr: number }[] = [];
      /** the screening games' places, for the ledger */
      const screenSlots = ledger ? blockSlots(seed0, o.games, opponents) : [];
      const screen = async (list: Swap[], what: (s: Swap) => string) => {
        for (const [k, s] of list.entries()) {
          if (stop()) break;
          p.phase = `Generation ${gen}: testing ${what(s)} ${k + 1} of ${list.length} on the same games`;
          onProgress({ ...p, logs: [...logs] });
          const r = await playSet(s.deck, field, seed0, o.games, o.bot, play, false, tick);
          ledger?.record('screen', deck, s.deck, s.label, scored(screenSlots, base.scores, r.scores));
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
      const seed1 = seed0 + 5_000;
      const swapOf = (label: string) => all.find((s) => s.label === label)!;
      /** the shortlist: each screened change's gain over all its games (this generation's screening included, each game once) */
      const figs = new Map<string, PooledFigure>();
      if (short && ledger) {
        const own = gameIds(screenSlots);
        for (const x of log.swaps) {
          const f = pooledFigure(ledger.entryOf(ledger.entryId(deck, swapOf(x.label).deck).change), { ids: own, gain: x.wr - base.wr, games: o.games });
          figs.set(x.label, f);
          if (f.earlier) x.pooled = { mean: f.gain, games: f.games, earlier: f.earlier };
        }
      }
      /** the ledger: the games a prior leaves out (every game this confirmation may play, and this generation's screening games) */
      const leaveOut = pooling ? gameIds([...confirmationSlots(seed1, firstStage, stages + further, opponents), ...screenSlots]) : new Set<string>();
      const priorFor = (s: Swap): PairedScores | undefined => (pooling && heldLedger ? heldLedger.prior(deck, s.deck, leaveOut) : undefined);
      // screening only nominates: the best changes that beat the baseline by minGain on the shared games
      // with the shortlist, by pooled gain (a change with no earlier games keeps its own screening figure)
      const gainOf = (x: TuneLog['swaps'][number]) => figs.get(x.label)?.gain ?? x.wr - base.wr;
      const aboveBar = (short ? byPooledGain(log.swaps, (x) => figs.get(x.label)!) : log.swaps).filter((x) => gainOf(x) >= o.minGain);
      let nominated = aboveBar.slice(0, depth.nominees);
      if (pooling) {
        // a change whose earlier held-out games alone already reject it is not nominated: the next best takes its place
        nominated = [];
        for (const x of aboveBar) {
          if (nominated.length >= depth.nominees) break;
          const s = swapOf(x.label);
          const prior = priorFor(s);
          if (prior?.base.length) {
            const j = judgePooled(prior.cand, prior.base, { alpha: rule.alpha, nominees: depth.nominees, minGainPp: isPkg(s) ? rule.packageMinGainPp : rule.minGainPp, minGames: rule.minGames });
            if (j.verdict === 'reject') {
              const sg = x.gain ?? { mean: 0, lower: -1, upper: 1, games: 0 };
              (log.notNominated ??= []).push({ label: x.label, screen: { games: sg.games, mean: sg.mean, lower: sg.lower, upper: sg.upper }, heldOut: j.iv, priorGames: prior.base.length });
              continue;
            }
            // the shortlist: nor a change its earlier held-out games put out of reach
            const reach = short ? outOfReach(prior, { rule, nominees: depth.nominees, minGainPp: isPkg(s) ? rule.packageMinGainPp : rule.minGainPp, reach: short.reach }) : null;
            if (short && reach?.out) {
              const sg = x.gain ?? { mean: 0, lower: -1, upper: 1, games: 0 };
              (log.notNominated ??= []).push({
                label: x.label,
                screen: { games: sg.games, mean: sg.mean, lower: sg.lower, upper: sg.upper },
                heldOut: j.iv,
                priorGames: prior.base.length,
                why: 'out-of-reach',
                ...(Number.isFinite(reach.toSettle) ? { toSettle: Math.round(reach.toSettle) } : {}),
                reach: short.reach,
              });
              continue;
            }
          }
          nominated.push(x);
        }
      }
      if (!nominated.length || stop()) {
        if (!stop()) await track(log, false);
        p.done = Math.max(p.done, Math.round(gen * perGen));
        continue;
      }
      const nomDecks = nominated.map((x) => swapOf(x.label));
      /** each nominee's held-out games with where they sat (the prior's games first, as confirmStaged takes them) */
      const held = new HeldOutTracker(nomDecks.length, pooling && heldLedger ? nomDecks.map((s) => heldLedger.priorGames(deck, s.deck, leaveOut)) : undefined);
      p.phase = `Generation ${gen}: confirming ${nominated.length === 1 ? 'the best change' : `the best ${nominated.length} changes`} on fresh paired games (stages of ${firstStage}${stages > 1 ? `, up to ${firstStage * stages}` : ''}${settle ? ', then on until settled' : ''})`;
      onProgress({ ...p, logs: [...logs] });
      const conf = await confirmStaged(
        rule,
        nomDecks.map((s) => ({ minGainPp: isPkg(s) ? rule.packageMinGainPp : rule.minGainPp })),
        firstStage,
        async ({ offset, games, active }) => {
          // the current list's games are started first, then each nominee's (the order the legacy confirmation used)
          const [b, ...ns] = await Promise.all([deck, ...active.map((i) => nomDecks[i]!.deck)].map((d) => playSet(d, field, seed1 + offset, games, confirmBot, play, false, tick)));
          held.stage(
            active,
            blockSlots(seed1 + offset, games, fieldIds),
            b!.scores,
            ns.map((r) => r.scores),
          );
          // only whole stages reach here (Stop rejects the games in flight, so a cut-off stage throws above), and
          // confirmStaged counts every stage this returns: the ledger records exactly the games the decision used
          if (heldLedger) {
            const slots = blockSlots(seed1 + offset, games, opponents);
            active.forEach((i, k) => heldLedger.record('heldout', deck, nomDecks[i]!.deck, nomDecks[i]!.label, scored(slots, b!.scores, ns[k]!.scores)));
          }
          return { base: b!.scores, nominees: ns.map((r) => r.scores) };
        },
        stop,
        pooling ? nomDecks.map(priorFor) : undefined,
        // further stages start after the capped ones, at seed1 + stages·firstStage, and stay below the next generation's seeds
        settle ? { reach: settle.reach, maxStages: further } : undefined,
      );
      const pick = pickAdopted(conf.results);
      log.nominees = nominated.map((x, i) => {
        const s = nomDecks[i]!;
        const sg = x.gain ?? { mean: 0, lower: -1, upper: 1, games: 0 };
        return nomineeRecord(x.label, { ...sg, z: 1.96 }, conf.results[i], s.combo ? `combo-${s.combo.packages ? 'packages' : 'cards'}` : s.pkg?.kind);
      });
      // a new array each time: a progress report already handed out keeps the one it had
      p.splits = [
        ...(p.splits ?? []),
        {
          gen,
          names: fieldNames,
          nominees: log.nominees.map((r, i) => {
            const w = withSplit(r, held.games(i));
            return w.byOpp ? { byOpp: w.byOpp, ...(w.bySeat ? { bySeat: w.bySeat } : {}), ...(w.heterogeneity ? { heterogeneity: w.heterogeneity } : {}) } : null;
          }),
        },
      ];
      const shown = conf.results[pick >= 0 ? pick : 0]!;
      log.confirm = { base: shown.baseWr, swap: shown.candWr, label: nominated[pick >= 0 ? pick : 0]!.label, outcome: shown.outcome, gain: shown.heldOut, looks: shown.looks, ...(shown.priorGames ? { priorGames: shown.priorGames } : {}) };
      if (pick >= 0) {
        deck = nomDecks[pick]!.deck;
        log.adopted = nominated[pick]!.label;
        log.adoptedGain = shown.heldOut;
        if (shown.priorGames) log.adoptedPriorGames = shown.priorGames;
        if (shown.settle) log.adoptedSettle = shown.settle;
        adoptedSoFar++;
      }
      p.deck = deck;
      // report the adopted list before the vs-original games, so a run stopped during them can still save it
      if (pick >= 0) onProgress({ ...p, logs: [...logs] });
      if (!stop()) await track(log, pick >= 0, pick >= 0 ? shown : undefined);
      p.done = Math.max(p.done, Math.round(gen * perGen));
      // report the confirmed list at once, so a run stopped from here on can still save it (partialTune)
      onProgress({ ...p, logs: [...logs] });
    } finally {
      if (o.ledger) await o.ledger.store.flush();
    }
  }
  p.phase = stop() ? 'Stopped' : 'Done';
  p.deck = deck;
  p.done = p.total;
  onProgress({ ...p, logs: [...logs] });
  return p;
}

/** The confirming bot's ledger context beside the screening one: the same store, field, run id, date and totals. */
function confirmLedger(l: ChangeLedgerRun, bot: string): ChangeLedgerRun {
  const b = ledgerBot(bot);
  if (!b.bot) throw new Error(b.problem);
  return new ChangeLedgerRun(l.store, { ...l.o, bot: b.bot, totals: l.totals });
}

/** The run's ledger context: the canonical bot (a bot the ledger cannot use is an error), the field, the run id and date. */
function ledgerRun(l: TuneLedger, bot: string, field: readonly DeckList[], seedBase: number): ChangeLedgerRun {
  const b = ledgerBot(bot);
  if (!b.bot) throw new Error(b.problem);
  const now = new Date();
  return new ChangeLedgerRun(l.store, {
    simVersion: SIM_VERSION,
    bot: b.bot,
    opponents: field.map((d) => listFingerprint(d)),
    run: l.run ?? `deck-lab ${now.toISOString()} seed ${seedBase}`,
    date: l.date ?? now.toISOString().slice(0, 10),
  });
}

/**
 * The saved list's tuning record (tunedRecord) with what earlier held-out games add: for each adopted change judged on
 * games pooled with earlier runs, how many came from them (`heldOut.priorGames`). Here rather than in tuneRecord.ts, which
 * the entry chunk reaches, so that file's code does not grow; without pooled logs it is tunedRecord's record unchanged.
 */
export function pooledTuneRecord(
  o: Omit<Parameters<typeof tunedRecord>[0], 'logs'> & { logs: readonly (Parameters<typeof tunedRecord>[0]['logs'][number] & { adoptedSettle?: SettleRecord })[]; confirmBot?: string },
): TunedDeckRecord {
  const plain = tunedRecord(o);
  // another bot confirmed (TuneOptions.confirmBot): the record says which (absent otherwise: the record is unchanged)
  const r = o.confirmBot ? { ...plain, confirmBot: o.confirmBot } : plain;
  const prior = new Map(o.logs.flatMap((l) => (l.adopted && l.adoptedPriorGames ? [[l.gen, l.adoptedPriorGames] as const] : [])));
  // "until settled": the adopted change's further stages and why they ended (absent without it: the record is unchanged)
  const settled = new Map(o.logs.flatMap((l) => (l.adopted && l.adoptedSettle ? [[l.gen, l.adoptedSettle] as const] : [])));
  if (!prior.size && !settled.size) return r;
  return {
    ...r,
    changes: r.changes.map((c) =>
      c.heldOut && (prior.has(c.gen) || settled.has(c.gen))
        ? { ...c, heldOut: { ...c.heldOut, ...(prior.has(c.gen) ? { priorGames: prior.get(c.gen)! } : {}), ...(settled.has(c.gen) ? { settle: { ...settled.get(c.gen)! } } : {}) } }
        : c,
    ),
  };
}

/**
 * What the run manifest carries of a tuning record (manifestTune), with `pooled` when the run used earlier held-out games
 * (`rule.ledger`): each adopted change and how many of its held-out games came from earlier runs (0 when none did).
 */
export function pooledManifestTune(r: TunedDeckRecord): NonNullable<RunManifest['tune']> {
  const t = manifestTune(r);
  return r.rule.ledger ? { ...t, pooled: r.changes.map((c) => ({ gen: c.gen, label: c.label, priorGames: c.heldOut?.priorGames ?? 0 })) } : t;
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
/**
 * Parent strength, strongest first: the season breeder's rule (src/lib/parentStrength.ts; scripts/breed-data.ts
 * strengthOf): the conservative power rating, blended with the season leaderboard only where its entry is current (every
 * season behind it ran under this simulator version). The leaderboard's rows are matched to library decks by file.
 * `ratings` and `seasons` default to the bundled files (tests hand in their own).
 */
export function rankedParents(lib: readonly LibraryDeck[], ratings: readonly RatedDeck[] = RATINGS.decks, seasons: Pick<SeasonsData, 'leaderboard' | 'seasons'> = SEASONS, current: number = SIM_VERSION): { deck: DeckList; wr: number }[] {
  return rankLibraryParents(lib, ratings, seasons, current);
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
  /** breed this many candidates (> n) for screening; the caller screens and picks the best n with pickScreened */
  breedCount?: number;
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
  // the breeder reads per-list impact by the parent's list fingerprint (deckImpactOf matches by fingerprint too, so two
  // parents with the same list get the same numbers either way)
  const deckImpact: Record<string, Record<string, number>> = {};
  for (const r of ranked) {
    const m = deckImpactOf(r.deck);
    if (m) deckImpact[listFingerprint(r.deck)] = m;
  }
  const bc = o.breedCount && o.breedCount > o.n ? o.breedCount : undefined;
  const out = breedSeason(0, { ranked, impact: GLOBAL_IMPACT, seenTriples, seed: o.seed, deckImpact, h2h: usable ? o.h2h : undefined, ...(o.packages ? { packages: o.packages } : {}) }, o.n, bc);
  return out.map((b, i) => {
    const name = b.deck.name.replace(/^S0-\d+/, `Lab-${String(o.seed % 1000).padStart(3, '0')}-${String(i + 1).padStart(2, '0')}`);
    return { ...b, deck: { ...b.deck, name } };
  });
}
