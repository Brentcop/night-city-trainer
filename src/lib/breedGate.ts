// A bred deck's test against its parent (docs/TUNING_STUDY_2026-11-13.md P7; docs/SYNERGIES.md "A bred deck's test
// against its parent"): before a bred deck takes a season slot it plays its reference on the same games, and it enters
// unless a bot shows it worse. The rule was declared before any game was played:
//
// - Reference, as declared: the bred deck's best parent (the parent ranked highest by strength in the breeder's list).
//   An explorer has no parent: its reference is the middle meta deck by strength (the 4th of 7, best first). A deck none
//   of whose parents is in the ranked list is treated as an explorer, and the record says so. That is the 'parent' mode,
//   this module's default (the Deck Lab's test). A season tests every bred deck against the middle meta deck by default
//   (the 'middle' mode, the owner's choice of 2026-11-15; scripts/season.ts --gate-reference).
// - Field: the meta decks other than the reference (and other than the deck itself). Both lists play the same slots, the
//   forge's layout (blockSlots, src/lib/changeLedgerRun.ts): game k plays field[k mod n] with seed seed0 + k, the list
//   under test first when floor(k / n) is even. The measurement is the paired score difference per game, bred deck
//   minus reference.
// - Stages of 20 double rounds (40·n games: 280 with 7 opponents, 240 with 6). The first bot (Medium by default) plays up
//   to 5 stages; after each one the difference is judged by confirmStaged (src/lib/evidence.ts) with the bar at 0
//   points, α = 0.05 spent over the looks by the O'Brien–Fleming-type boundary, no futility stop and no minimum games
//   beyond the first stage: "shown worse" when the upper bound is below 0, "shown better" when the lower bound is above
//   0, "could not tell" at the cap. A deck the first bot did not show worse goes on to the confirming bot (Hard by
//   default; none, or skipped when it is the same bot by canonical name): up to 2 stages, the same rule, its own seeds.
// - Entry: a deck enters unless one of the two bots shows it worse. "Could not tell" enters; the words never say an
//   entered deck is as good as its reference, only that it was not shown worse.
// - Each bred deck is its own decision (one nominee per confirmStaged call, so α is not split between siblings). A
//   reference several decks share plays its games once: its scores are kept per (list, bot, field, seeds).
// - Gate games are a selection step only: nothing here writes them anywhere, and their seeds are their own (gateSeeds).
//
// The Deck Lab's Breed tab runs the same rule at its own sizes (`LAB_TEST`: stages of 10 double rounds, up to 4, the
// Medium bot alone, the Lab's fixed seed block): nothing enters anything there, so its words say only "shown worse",
// "shown better" or "could not tell: not shown worse" (`labBeforeWords`, `labResultWords`; the verdict phrase is
// src/lib/bredDecks.ts verdictAgainst). Its reference blocks are kept across button presses by `keepReferences`, keyed
// like runGate's own (`referenceKey`: list, bot, seeds, games, field).
//
// Pure and environment-agnostic: the games come from a play function handed in (Node: scripts/gate-run.ts over runJobs;
// the Deck Lab over its worker pool), so this module imports no bot, simulator worker or file system.
import { listFingerprint } from '../engine/deck';
import type { DeckList } from '../engine/types';
import { adoptionRule, botWord, confirmStaged, lookZs, pairedInterval, type AdoptionRule, type Outcome, type PlayStage } from './evidence';
import { blockSlots } from './changeLedgerRun';
import { ledgerBot } from './changeLedger';
import { confirmedWith, detectable } from './deckSearch';
import { heterogeneity, pairedGroup, splitPaired, type GroupSummary, type Heterogeneity } from './pairedSplit';
import { bestParent } from './parentStrength';
import { capital, count, differenceWords, percent, verdictAgainst } from './bredDecks';

// ---------------------------------------------------------------- the settings

/** The gate's defaults: bots, stage size in double rounds, stage caps per bot, and α per bot. */
export const GATE_DEFAULTS: Readonly<{ bot: string; confirmBot: string; rounds: number; stages: number; confirmStages: number; alpha: number }> = Object.freeze({
  bot: 'medium',
  confirmBot: 'hard',
  rounds: 20,
  stages: 5,
  confirmStages: 2,
  alpha: 0.05,
});
/**
 * The per-game spread of the paired difference (bred deck minus reference) the detect line assumes, per bot. Measured on
 * the 16 recorded bred decks against the reference the gate gives them today, every stage played (2026-11-15,
 * reports/tuning-study-2026-11-13/p7-validate.txt): the median over the decks was 0.59 with Medium (0.55 to 0.63) and
 * 0.60 with Hard (0.58 to 0.65). They replaced the 0.70 assumed before the games, as declared in advance (the measured
 * median replaces the assumption when they differ by more than 0.05). A bot that was not measured takes Hard's 0.60.
 */
export const GATE_SD: Readonly<{ medium: number; hard: number; other: number }> = Object.freeze({ medium: 0.59, hard: 0.6, other: 0.6 });
/** The bots the spread was measured with (canonical names). */
const MEASURED_SD_BOTS = new Set(['medium', 'hard']);
/** A bot's canonical name (lookahead is Medium), or the name as given when the ledger does not know it. */
const canonicalBot = (bot: string): string => ledgerBot(bot).bot ?? bot;
/** The per-game spread the gate assumes for a bot (GATE_SD, by canonical name: lookahead is Medium). */
export function gateSd(bot: string): number {
  const c = canonicalBot(bot);
  return c === 'medium' ? GATE_SD.medium : c === 'hard' ? GATE_SD.hard : GATE_SD.other;
}
/** The seeds of a season's gate: S·1,000,000 + 700,000 for the first bot and + 800,000 for the confirming bot. */
export const gateSeeds = (season: number): { first: number; confirm: number } => ({ first: season * 1_000_000 + 700_000, confirm: season * 1_000_000 + 800_000 });
/** The command line's default seeds (npm run gate). */
export const GATE_CLI_SEEDS: Readonly<{ first: number; confirm: number }> = Object.freeze({ first: 7_000_000, confirm: 7_100_000 });

/** Games in one stage: `rounds` double rounds against `opponents` decks (each opponent, each seat, `rounds` times). */
export const gateStageGames = (rounds: number, opponents: number): number => 2 * rounds * opponents;

/**
 * The gate's rule for one bot with `stages` stages: the adoption rule with the bar at 0 points, α spent over the looks by
 * the O'Brien–Fleming-type boundary, no futility stop and no minimum games ("adopt" reads shown better, "reject" shown
 * worse).
 */
export function gateRule(stages: number, alpha: number = GATE_DEFAULTS.alpha): AdoptionRule {
  return adoptionRule({ kind: 'evidence', minGainPp: 0, packageMinGainPp: 0, alpha, boundary: 'obrien-fleming', capStages: stages, minGames: 0, futilityAfterStages: 0, futilityMaxGainPp: 0 });
}

/** Whether the confirming bot plays: it is set, not "none", and not the first bot under another name (lookahead is Medium). */
export const confirmBotOf = (bot: string, confirm: string | null | undefined): string | null => (confirm && confirm !== 'none' && confirmedWith(bot, confirm) ? confirm : null);

// ---------------------------------------------------------------- reference and field

/** A deck of the breeder's ranked list (strongest first). */
export interface RankedDeck {
  deck: DeckList;
  wr: number;
}
/**
 * Why a deck has the reference it has: 'named' given by hand (npm run gate); 'fixed-bar' a deck with parents tested
 * against the middle meta deck because the run's reference mode is 'middle' (an explorer keeps 'explorer').
 */
export type ReferenceWhy = 'best-parent' | 'explorer' | 'no-parent-available' | 'fixed-bar' | 'named';
/**
 * Which reference a gate uses: 'parent' (the rule as declared, and this module's default, which the Deck Lab relies on:
 * the best parent, the middle meta deck for an explorer) or 'middle' (every bred deck against the middle meta deck by
 * strength, one fixed bar; the season's default since 2026-11-15, scripts/season.ts --gate-reference).
 */
export type ReferenceMode = 'parent' | 'middle';
export const REFERENCE_MODES: readonly ReferenceMode[] = ['parent', 'middle'];

const sameList = (a: DeckList, b: DeckList) => a.name === b.name || listFingerprint(a) === listFingerprint(b);

/** The meta decks by strength, best first (decks without a strength after, in the order given). */
function metaByStrength(meta: readonly DeckList[], ranked: readonly RankedDeck[]): DeckList[] {
  const rank = (d: DeckList) => {
    const i = ranked.findIndex((r) => r.deck.name === d.name);
    return i < 0 ? Infinity : i;
  };
  return meta.map((d, i) => ({ d, i, r: rank(d) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.d);
}

/** The middle meta deck by strength: the 4th of 7, best first (index floor((n − 1) / 2)). */
export function middleMeta(meta: readonly DeckList[], ranked: readonly RankedDeck[]): DeckList {
  const sorted = metaByStrength(meta, ranked);
  const d = sorted[Math.floor((sorted.length - 1) / 2)];
  if (!d) throw new Error('the gate needs at least one meta deck');
  return d;
}

/**
 * A bred deck's reference: its best parent by the ranked list, else (an explorer, or no parent ranked) the middle meta
 * deck. With mode 'middle' every deck gets the middle meta deck ('fixed-bar' for a deck with parents).
 */
export function chooseReference(parents: readonly string[], ranked: readonly RankedDeck[], meta: readonly DeckList[], mode: ReferenceMode = 'parent'): { deck: DeckList; why: ReferenceWhy } {
  if (mode === 'middle') return { deck: middleMeta(meta, ranked), why: parents.length ? 'fixed-bar' : 'explorer' };
  const best = bestParent(parents, ranked);
  if (best) return { deck: best.deck, why: 'best-parent' };
  return { deck: middleMeta(meta, ranked), why: parents.length ? 'no-parent-available' : 'explorer' };
}

/** The gate's field: the meta decks other than the reference and other than the deck under test. */
export function gateField(meta: readonly DeckList[], reference: DeckList, deck?: DeckList): DeckList[] {
  return meta.filter((m) => !sameList(m, reference) && !(deck && sameList(m, deck)));
}

/** One deck to gate: the deck, its reference and the field both play. */
export interface GateEntry {
  deck: DeckList;
  reference: DeckList;
  referenceWhy: ReferenceWhy;
  /** the parents the breeder named (empty for an explorer) */
  parents: string[];
  field: DeckList[];
}

/** The gate's plan for bred decks: each one's reference (chooseReference, in `mode`) and field (gateField). */
export function planGate(bred: readonly { deck: DeckList; parents: readonly string[] }[], ranked: readonly RankedDeck[], meta: readonly DeckList[], mode: ReferenceMode = 'parent'): GateEntry[] {
  return bred.map((b) => {
    const ref = chooseReference(b.parents, ranked, meta, mode);
    return { deck: b.deck, reference: ref.deck, referenceWhy: ref.why, parents: [...b.parents], field: gateField(meta, ref.deck, b.deck) };
  });
}

// ---------------------------------------------------------------- the runner

/** One block of games: `deck` against `field` in the forge's layout from `seed0`, scores (1, ½, 0) in layout order. */
export interface GatePlayRequest {
  deck: DeckList;
  field: readonly DeckList[];
  seed0: number;
  games: number;
  bot: string;
  /** which side of the comparison asks (for progress and tests) */
  role: 'deck' | 'reference';
}
export type GatePlay = (r: GatePlayRequest) => Promise<number[]>;

/** A reference block's key: the list, the bot, the seeds, the games and the field (by list). */
export const referenceKey = (r: Omit<GatePlayRequest, 'role'>): string => [listFingerprint(r.deck), r.bot, r.seed0, r.games, ...r.field.map(listFingerprint)].join('|');

/** Reference blocks kept across runs (the Deck Lab: one store per Breed panel), by referenceKey. */
export type ReferenceStore = Map<string, Promise<number[]>>;

/**
 * A play function that plays each reference block once per store and hands the kept scores to every later run that asks
 * for the same block (another deck with the same reference, or a later button press). A block that fails or is stopped
 * is forgotten, so the next run plays it again. The deck's own blocks always go to `play`.
 */
export function keepReferences(play: GatePlay, store: ReferenceStore): GatePlay {
  return (r) => {
    if (r.role !== 'reference') return play(r);
    const key = referenceKey(r);
    const kept = store.get(key);
    if (kept) return kept;
    const p = play(r);
    store.set(key, p);
    p.catch(() => {
      if (store.get(key) === p) store.delete(key);
    });
    return p;
  };
}

export type GateVerdict = 'shown-worse' | 'shown-better' | 'could-not-tell';
const VERDICT: Record<Outcome, GateVerdict> = { adopt: 'shown-better', reject: 'shown-worse', inconclusive: 'could-not-tell' };

/** A paired figure over some games: the difference (deck minus reference) at `z`, its spread, both win rates. */
export interface GateFigure {
  games: number;
  mean: number;
  lower: number;
  upper: number;
  z: number;
  /** per-game SD of the paired difference */
  sd: number;
  deckWr: number;
  refWr: number;
}

/** One bot's part of the test. */
export interface GateStep {
  bot: string;
  seed0: number;
  stageGames: number;
  /** stages at most */
  capStages: number;
  /** the rule's verdict and the look it came at (1-based; the cap for "could not tell") */
  verdict: GateVerdict;
  looks: number;
  /** the games the verdict is on (the stages up to that look), at that look's z */
  judged: GateFigure;
  /** with every stage played (no early stop) and more stages played than judged: all of them, at the last look's z */
  played?: GateFigure & { stages: number };
  /** per opponent (by deck name) and per seat, over every game played; the χ² across opponents when it can be read */
  byOpp: (GroupSummary & { opp: string })[];
  bySeat: (GroupSummary & { first: 0 | 1 })[];
  heterogeneity?: Heterogeneity;
  /** stopped (Stop) before the rule decided: no verdict counts */
  stopped?: true;
}

/** Why a confirming bot's part did not count: the first bot showed the deck worse, or there is none (off, or the same bot). */
export type ConfirmSkip = 'shown-worse' | 'none';

/** One bred deck's test. */
export interface GateOutcome {
  name: string;
  listId: string;
  reference: { name: string; listId: string; why: ReferenceWhy };
  parents: string[];
  field: string[];
  first: GateStep;
  /** the confirming bot's part (with every stage played, also for a deck the first bot showed worse: then `ruleSkips`) */
  confirm: GateStep | null;
  /** why the confirming bot's part does not count (absent: it counts) */
  confirmSkipped?: ConfirmSkip;
  entered: boolean;
  /** stopped before it was decided: not entered */
  stopped?: true;
}

export interface GateOptions {
  bot: string;
  /** the confirming bot, or null / 'none' for none (also none when it is the first bot by canonical name) */
  confirmBot: string | null;
  /** double rounds per stage */
  rounds: number;
  stages: number;
  confirmStages: number;
  alpha?: number;
  seeds: { first: number; confirm: number };
  /** the season's reference mode (words and record only; the plan, planGate, picks the references) */
  reference?: ReferenceMode;
  /** play every stage of both bots (no early stop) and still report where the staged rule would have stopped */
  fullStages?: boolean;
  /** Stop (the Deck Lab): checked before each stage after the first */
  stop?: () => boolean;
  /** after each bot's part of each deck */
  onStep?: (o: { name: string; step: GateStep; which: 'first' | 'confirm' }) => void;
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function figure(cand: readonly number[], base: readonly number[], z: number): GateFigure {
  const iv = pairedInterval(cand, base, z);
  const g = pairedGroup(cand.map((c, i) => c - (base[i] ?? NaN)));
  return { games: iv.games, mean: iv.mean, lower: iv.lower, upper: iv.upper, z, sd: g.sd, deckWr: mean(cand), refWr: mean(base) };
}

interface StageData {
  base: number[];
  cand: number[];
}

/**
 * Gate each entry. Entries run side by side (their games go to `play` together); a reference shared by several entries
 * plays each block once. Results in the order of `entries`.
 */
export async function runGate(entries: readonly GateEntry[], o: GateOptions, play: GatePlay): Promise<GateOutcome[]> {
  const alpha = o.alpha ?? GATE_DEFAULTS.alpha;
  const confirmBot = confirmBotOf(o.bot, o.confirmBot);
  const refCache = new Map<string, Promise<number[]>>();
  const refBlock = (r: Omit<GatePlayRequest, 'role'>): Promise<number[]> => {
    const key = referenceKey(r);
    let p = refCache.get(key);
    if (!p) {
      p = play({ ...r, role: 'reference' });
      refCache.set(key, p);
    }
    return p;
  };
  const checked = async (r: GatePlayRequest, scores: Promise<number[]>): Promise<number[]> => {
    const s = await scores;
    if (s.length !== r.games) throw new Error(`a block of ${r.games} gate games came back with ${s.length} scores`);
    return s;
  };

  /** One bot's part for one entry: stages played (all of them with fullStages), then the rule's verdict on them. */
  async function step(e: GateEntry, bot: string, seed0: number, cap: number): Promise<GateStep> {
    const games = gateStageGames(o.rounds, e.field.length);
    const rule = gateRule(cap, alpha);
    const stages: StageData[] = [];
    const playStageAt = async (stage: number): Promise<StageData> => {
      const req = { field: e.field, seed0: seed0 + stage * games, games, bot };
      const [base, cand] = await Promise.all([checked({ ...req, deck: e.reference, role: 'reference' }, refBlock({ ...req, deck: e.reference })), checked({ ...req, deck: e.deck, role: 'deck' }, play({ ...req, deck: e.deck, role: 'deck' }))]);
      return { base, cand };
    };
    if (o.fullStages) {
      const all = await Promise.all(Array.from({ length: cap }, (_, k) => playStageAt(k)));
      stages.push(...all);
    }
    const playStage: PlayStage = async ({ stage }) => {
      const s = stages[stage] ?? (stages[stage] = await playStageAt(stage));
      return { base: s.base, nominees: [s.cand] };
    };
    const { results } = await confirmStaged(rule, [{ minGainPp: 0 }], games, playStage, o.fullStages ? () => false : (o.stop ?? (() => false)));
    const c = results[0]!;
    const looks = c.looks;
    const zs = lookZs(rule, 1);
    const judgedStages = stages.slice(0, Math.max(looks, 0));
    const jc = judgedStages.flatMap((s) => s.cand);
    const jb = judgedStages.flatMap((s) => s.base);
    const pc = stages.flatMap((s) => s.cand);
    const pb = stages.flatMap((s) => s.base);
    const slots = stages.flatMap((_, k) => blockSlots(seed0 + k * games, games, e.field.map((f) => f.name)));
    const split = splitPaired(pc, pb, slots);
    const het = heterogeneity(split.byOpp);
    return {
      bot,
      seed0,
      stageGames: games,
      capStages: cap,
      verdict: VERDICT[c.outcome],
      looks,
      judged: figure(jc, jb, c.heldOut.z),
      ...(stages.length > looks ? { played: { ...figure(pc, pb, zs[stages.length - 1] ?? zs[zs.length - 1] ?? 1.96), stages: stages.length } } : {}),
      byOpp: split.byOpp,
      bySeat: split.bySeat,
      ...(het ? { heterogeneity: het } : {}),
      ...(c.stopped === true ? { stopped: true as const } : {}),
    };
  }

  const one = async (e: GateEntry): Promise<GateOutcome> => {
    const first = await step(e, o.bot, o.seeds.first, o.stages);
    o.onStep?.({ name: e.deck.name, step: first, which: 'first' });
    const firstWorse = !first.stopped && first.verdict === 'shown-worse';
    let confirm: GateStep | null = null;
    if (confirmBot && !first.stopped && (!firstWorse || o.fullStages) && !o.stop?.()) {
      confirm = await step(e, confirmBot, o.seeds.confirm, o.confirmStages);
      o.onStep?.({ name: e.deck.name, step: confirm, which: 'confirm' });
    }
    const confirmSkipped: ConfirmSkip | undefined = !confirmBot ? 'none' : firstWorse ? 'shown-worse' : undefined;
    const counts = confirmSkipped ? null : confirm;
    const stopped = !!first.stopped || (!!confirmBot && !firstWorse && (!confirm || !!confirm.stopped));
    const worse = firstWorse || counts?.verdict === 'shown-worse';
    return {
      name: e.deck.name,
      listId: listFingerprint(e.deck),
      reference: { name: e.reference.name, listId: listFingerprint(e.reference), why: e.referenceWhy },
      parents: [...e.parents],
      field: e.field.map((f) => f.name),
      first,
      confirm,
      ...(confirmSkipped ? { confirmSkipped } : {}),
      entered: !worse && !stopped,
      ...(stopped && !worse ? { stopped: true as const } : {}),
    };
  };
  return Promise.all(entries.map(one));
}

// ---------------------------------------------------------------- what it detects and guarantees

/**
 * The deficit (a fraction: 0.05 = 5 points) a bot shows worse 8 times in 10, for its stage size and cap at per-game
 * spread `sd`. By symmetry it is detectable() for a gain at bar 0 (no futility stop, no minimum games): the rule's
 * rejection boundary mirrors its adoption boundary.
 */
export function gateDetectable(o: { stageGames: number; stages: number; bot?: string; sd?: number; alpha?: number; power?: number }): number {
  const sd = o.sd ?? gateSd(o.bot ?? GATE_DEFAULTS.bot);
  return detectable({ firstStage: o.stageGames, rule: gateRule(o.stages, o.alpha ?? GATE_DEFAULTS.alpha), sd, nominees: 1, minGainPp: 0, ...(o.power ? { power: o.power } : {}) });
}

/**
 * "It assumes a per-game spread of 0.59 with the Medium bot and 0.60 with the Hard bot for two different decks, measured
 * on the recorded bred decks." A bot that was not measured is named with the value it takes (Hard's).
 */
export function spreadAssumedWords(bots: readonly string[]): string {
  const uniq = bots.filter((b, i) => bots.findIndex((x) => canonicalBot(x) === canonicalBot(b)) === i);
  const parts = uniq.map((b) => `${gateSd(b).toFixed(2)} with the ${botWord(b)} bot`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? '');
  const base = `It assumes a per-game spread of ${list} for two different decks`;
  const measured = uniq.filter((b) => MEASURED_SD_BOTS.has(canonicalBot(b)));
  const other = uniq.filter((b) => !MEASURED_SD_BOTS.has(canonicalBot(b)));
  if (!other.length) return `${base}, measured on the recorded bred decks.`;
  const names = (bs: readonly string[]) => bs.map((b) => botWord(b)).join(' and ');
  const lead = measured.length ? `The ${names(measured)} bot${measured.length > 1 ? 's’ values were' : '’s value was'} measured on the recorded bred decks; the ` : 'The ';
  return `${base}. ${lead}${names(other)} bot${other.length > 1 ? 's were' : ' was'} not measured and take${other.length > 1 ? '' : 's'} the value measured with the Hard bot.`;
}

const pts = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;
const k = (n: number) => n.toLocaleString('en-US');
const looksZ = (stages: number, alpha: number) =>
  lookZs(gateRule(stages, alpha), 1)
    .map((z) => z.toFixed(2))
    .join(', ');

/** The rule in words, printed before a gate plays. */
export function gateRuleWords(o: Pick<GateOptions, 'bot' | 'confirmBot' | 'rounds' | 'stages' | 'confirmStages' | 'alpha' | 'reference'>): string {
  const alpha = o.alpha ?? GATE_DEFAULTS.alpha;
  const c = confirmBotOf(o.bot, o.confirmBot);
  const s7 = gateStageGames(o.rounds, 7);
  const s6 = gateStageGames(o.rounds, 6);
  const conf = c ? `; a deck the ${botWord(o.bot)} bot did not show worse then plays up to ${o.confirmStages} stage${o.confirmStages === 1 ? '' : 's'} with the ${botWord(c)} bot on its own seeds (z ${looksZ(o.confirmStages, alpha)})` : '';
  // the season names its mode (middle by default since 2026-11-15); npm run gate has none: it names its reference
  const reference =
    o.reference === 'middle'
      ? 'the middle meta deck by strength, the same fixed bar for every bred deck,'
      : o.reference === 'parent'
        ? 'its best parent (an explorer, which has none, plays the middle meta deck by strength)'
        : 'its reference';
  return (
    `each bred deck plays ${reference} on the same games against the other meta decks, ` +
    `in stages of ${o.rounds} double round${o.rounds === 1 ? '' : 's'} (${k(s7)} games with 7 opponents, ${k(s6)} with 6), up to ${o.stages} stage${o.stages === 1 ? '' : 's'} with the ${botWord(o.bot)} bot (z ${looksZ(o.stages, alpha)})${conf}. ` +
    `After each stage the paired difference is judged with α ${alpha} spent over the looks by an O'Brien–Fleming-type boundary: shown worse when its upper bound is below 0, shown better when its lower bound is above 0, could not tell at the cap. ` +
    `A deck enters unless a bot shows it worse; could not tell enters`
  );
}

/** What the gate guarantees, in words. */
export function gateGuaranteeWords(o: Pick<GateOptions, 'alpha'> = {}): string {
  const a = ((o.alpha ?? GATE_DEFAULTS.alpha) / 2) * 100;
  // "about": the boundaries are the normal approximation (simulated 2.3% to 2.8%); "or less": a deck truly better than its
  // reference is kept out less often
  return `A bred deck that is truly no worse than its reference is kept out about ${a.toFixed(1)}% of the time or less by each bot.`;
}

/**
 * What the gate can detect, before it plays: for each stage size in use, the deficit each bot shows worse 8 times in 10,
 * each at its own bot's spread (gateSd).
 */
export function gateDetectWords(o: Pick<GateOptions, 'bot' | 'confirmBot' | 'rounds' | 'stages' | 'confirmStages' | 'alpha'> & { opponents: readonly number[] }): string {
  const c = confirmBotOf(o.bot, o.confirmBot);
  const sizes = [...new Set(o.opponents)].sort((a, b) => b - a);
  const amount = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)} points` : 'more than 60 points');
  const parts = sizes.map((n) => {
    const games = gateStageGames(o.rounds, n);
    const first = gateDetectable({ stageGames: games, stages: o.stages, bot: o.bot, ...(o.alpha ? { alpha: o.alpha } : {}) });
    const conf = c ? gateDetectable({ stageGames: games, stages: o.confirmStages, bot: c, ...(o.alpha ? { alpha: o.alpha } : {}) }) : null;
    return `with ${n} opponents (stages of ${k(games)} games) the ${botWord(o.bot)} bot shows a deck worse 8 times in 10 when it is really ${amount(first)} worse${conf !== null ? `, the ${botWord(c!)} bot with its ${o.confirmStages} stage${o.confirmStages === 1 ? '' : 's'} when it is ${amount(conf)} worse` : ''}`;
  });
  return `What it can detect: ${parts.join('; ')}. ${spreadAssumedWords(c ? [o.bot, c] : [o.bot])}`;
}

/** The most games a deck's gate may play per bot (deck and reference, before a shared reference's games are saved). */
export function gateCost(o: Pick<GateOptions, 'bot' | 'confirmBot' | 'rounds' | 'stages' | 'confirmStages'>, opponents: number): { first: number; confirm: number } {
  const games = gateStageGames(o.rounds, opponents);
  return { first: 2 * games * o.stages, confirm: confirmBotOf(o.bot, o.confirmBot) ? 2 * games * o.confirmStages : 0 };
}

/** The per-game spread seen: the median over the decks of each bot's part (null when none played). */
export function spreadSeen(outcomes: readonly GateOutcome[]): { first: number | null; firstDecks: number; confirm: number | null; confirmDecks: number } {
  const med = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const i = Math.floor(s.length / 2);
    return s.length % 2 ? s[i]! : (s[i - 1]! + s[i]!) / 2;
  };
  const sdOf = (st: GateStep) => (st.played ?? st.judged).sd;
  const f = outcomes.filter((x) => (x.first.played ?? x.first.judged).games > 1).map((x) => sdOf(x.first));
  const c = outcomes.flatMap((x) => (x.confirm && (x.confirm.played ?? x.confirm.judged).games > 1 ? [sdOf(x.confirm)] : []));
  return { first: med(f), firstDecks: f.length, confirm: med(c), confirmDecks: c.length };
}

/** "Spread seen: 0.62 per game with the Medium bot (median of 8 decks), 0.66 with the Hard bot (5 decks)." */
export function spreadSeenWords(outcomes: readonly GateOutcome[]): string {
  const s = spreadSeen(outcomes);
  if (s.first === null) return 'Spread seen: no games.';
  const bot = outcomes[0]?.first.bot ?? '';
  const cbot = outcomes.find((x) => x.confirm)?.confirm?.bot;
  const decks = (n: number) => (n === 1 ? 'one deck' : `median of ${n} decks`);
  const conf = s.confirm !== null && cbot ? `, ${s.confirm.toFixed(2)} with the ${botWord(cbot)} bot (${decks(s.confirmDecks)})` : '';
  return `Spread seen: ${s.first.toFixed(2)} per game with the ${botWord(bot)} bot (${decks(s.firstDecks)})${conf}.`;
}

// ---------------------------------------------------------------- words

const VERDICT_WORDS: Record<GateVerdict, string> = { 'shown-worse': 'shown worse', 'shown-better': 'shown better', 'could-not-tell': 'could not tell' };
export const gateVerdictWord = (v: GateVerdict): string => VERDICT_WORDS[v];

/** "Medium: shown worse, −6.2 points [−11.0, −1.4] over 560 paired games (look 2 of 5)" */
export function stepWords(s: GateStep): string {
  const j = s.judged;
  const at = s.stopped ? `stopped after ${k(j.games)} paired games` : `${pts(j.mean)} points [${pts(j.lower)}, ${pts(j.upper)}] over ${k(j.games)} paired games (look ${s.looks} of ${s.capStages})`;
  const verdict = s.stopped ? 'not decided' : gateVerdictWord(s.verdict);
  const all = s.played ? `; all ${s.played.stages} stages: ${pts(s.played.mean)} points [${pts(s.played.lower)}, ${pts(s.played.upper)}] over ${k(s.played.games)}` : '';
  return `${botWord(s.bot)}: ${verdict}, ${at}${all}`;
}

const REF_WHY: Record<ReferenceWhy, string> = {
  'best-parent': 'best parent',
  explorer: 'explorer: the middle meta deck',
  'no-parent-available': 'no parent available, so as an explorer: the middle meta deck',
  'fixed-bar': 'the middle meta deck, this run’s fixed bar for every bred deck',
  named: '',
};
/** Why the reference is the one it is, in words. */
export const referenceWords = (why: ReferenceWhy): string => REF_WHY[why];

/**
 * One deck's result in words: "kept out: shown worse than X with the Medium bot (…)" or "entered: not shown worse than X
 * (…)". An entered deck is never said to be as good as its reference.
 */
export function gateWords(r: GateOutcome): string {
  const why = referenceWords(r.reference.why);
  const ref = why ? `${r.reference.name} (${why})` : r.reference.name;
  const parts = [stepWords(r.first)];
  if (r.confirm && !r.confirmSkipped) parts.push(stepWords(r.confirm));
  else if (r.confirm && r.confirmSkipped === 'shown-worse') parts.push(`${stepWords(r.confirm)}; not counted: the rule plays it only for a deck not shown worse`);
  if (r.stopped) return `not entered: stopped before the test against ${ref} was decided (${parts.join('; ')})`;
  if (!r.entered) {
    const by = r.first.verdict === 'shown-worse' ? r.first.bot : (r.confirm?.bot ?? r.first.bot);
    return `kept out: shown worse than ${ref} with the ${botWord(by)} bot (${parts.join('; ')})`;
  }
  return `entered: not shown worse than ${ref} (${parts.join('; ')})`;
}

/** "8 bred, 5 entered" (and "every bred deck entered" / "none entered" said plainly). */
export function enteredWords(bred: number, entered: number): string {
  return `${bred} bred, ${entered} entered`;
}

// ---------------------------------------------------------------- the Deck Lab's test (Breed tab)

/**
 * The Deck Lab's test of a bred deck against its reference: stages of 10 double rounds (140 games with 7 opponents, 120
 * with 6), up to 4, the Medium bot alone, from the Lab's fixed seed (the old quick test's), so every deck and reference
 * play the same games. The rule is the gate's (gateRule: bar 0, α 0.05, O'Brien–Fleming-type looks, no futility stop).
 */
export const LAB_TEST: Readonly<{ bot: string; rounds: number; stages: number; seed: number }> = Object.freeze({ bot: 'medium', rounds: 10, stages: 4, seed: 77_000 });

/** The Lab's options for runGate: no confirming bot; `stop` is checked before each stage after the first. */
export function labTestOptions(stop?: () => boolean): GateOptions {
  return { bot: LAB_TEST.bot, confirmBot: null, rounds: LAB_TEST.rounds, stages: LAB_TEST.stages, confirmStages: 0, seeds: { first: LAB_TEST.seed, confirm: LAB_TEST.seed }, ...(stop ? { stop } : {}) };
}

/** One bred deck's test plan in the Lab: its reference (chooseReference over the Lab's ranked parents) and field. */
export function labTestEntry(bred: { deck: DeckList; parents: readonly string[] }, ranked: readonly RankedDeck[], meta: readonly DeckList[]): GateEntry {
  return planGate([bred], ranked, meta)[0]!;
}

/** Run one Lab test: the gate's rule at the Lab's sizes, with reference blocks kept in `store` across runs. */
export async function runLabTest(entry: GateEntry, play: GatePlay, store: ReferenceStore, stop?: () => boolean): Promise<GateOutcome> {
  const [r] = await runGate([entry], labTestOptions(stop), keepReferences(play, store));
  return r!;
}

/** Whether `store` already holds (or is playing) the first block of this entry's reference at the Lab's sizes. */
export function labReferenceKept(store: ReferenceStore, entry: Pick<GateEntry, 'reference' | 'field'>): boolean {
  return store.has(referenceKey({ deck: entry.reference, field: entry.field, seed0: LAB_TEST.seed, games: gateStageGames(LAB_TEST.rounds, entry.field.length), bot: LAB_TEST.bot }));
}

/** The difference (a fraction) the Lab's test shows 8 times in 10 against `opponents` field decks, at its bot's spread (gateSd: Medium). */
export const labDetectable = (opponents: number): number => gateDetectable({ stageGames: gateStageGames(LAB_TEST.rounds, opponents), stages: LAB_TEST.stages, bot: LAB_TEST.bot });

/** Why the Lab tests a deck against this reference, in one sentence. */
export function labReferenceWords(reference: string, why: ReferenceWhy): string {
  if (why === 'best-parent') return `Tested against its best parent, ${reference}.`;
  if (why === 'explorer') return `An explorer has no parent, so it is tested against the middle meta deck by strength, ${reference}.`;
  if (why === 'no-parent-available') return `None of its parents is rated, so it is tested against the middle meta deck by strength, ${reference}.`;
  // the Lab always tests against the best parent; a season run with --gate-reference middle uses this one
  if (why === 'fixed-bar') return `Tested against the middle meta deck by strength, ${reference}, the same fixed bar for every bred deck.`;
  return `Tested against ${reference}.`;
}

/**
 * What the Lab's test may play and can tell, before it runs: two sentences (three when `referenceKept`: some of the
 * reference's games for this field are already played in this panel and are reused).
 */
export function labBeforeWords(o: { reference: string; opponents: number; referenceKept?: boolean }): string {
  const stage = gateStageGames(LAB_TEST.rounds, o.opponents);
  const most = 2 * stage * LAB_TEST.stages;
  const d = labDetectable(o.opponents);
  const size = Number.isFinite(d) ? `about ${(d * 100).toFixed(1)} points` : 'more than 60 points';
  const kept = o.referenceKept ? ` Games of ${o.reference} already played here are reused rather than played again.` : '';
  return (
    `It plays up to ${count(most)} games with the ${botWord(LAB_TEST.bot)} bot: this deck and ${o.reference} play the same deals against ${o.opponents} meta decks, in batches of ${count(stage)} games each, up to ${LAB_TEST.stages} batches, and it stops early once the difference is clear.${kept} ` +
    `It shows a deck worse (or better) 8 times in 10 only when the difference is ${size} or more, so for smaller differences “could not tell” is the likely answer.`
  );
}

/** The Lab's result in words: the verdict, the difference with its range, both win rates, the games. */
export interface LabResultWords {
  verdict: string;
  difference: string;
  rates: string;
  games: string;
}

/** The Lab's result: "Shown worse than X." / "Shown better than X." / "Could not tell: not shown worse than X.", then the figures. */
export function labResultWords(r: Pick<GateOutcome, 'reference' | 'first' | 'field'>): LabResultWords {
  const s = r.first;
  const j = s.judged;
  const ref = r.reference.name;
  return {
    verdict: s.stopped ? 'Stopped before it was decided.' : `${capital(verdictAgainst(s.verdict, ref))}.`,
    difference: `Difference in win rate, this deck minus ${ref}: ${differenceWords(j)}.`,
    rates: `This deck won ${percent(j.deckWr)} of its games, ${ref} ${percent(j.refWr)}.`,
    games: `${count(j.games)} games each with the ${botWord(s.bot)} bot, on the same deals against the same ${r.field.length} meta decks.`,
  };
}
