// How a finding is put into words (src/lib/findings.ts holds the model): the one-line claim, the strength and nature
// chips, what each flag means, why an association may mislead, and the notes on what is not measured. Pure and light
// (no engine, no bots), so a page and the builder (scripts/build-evidence.ts) word a finding the same way.
//
// The words follow the three natures: only an effect (a paired comparison of two lists) may say "adds" or "costs"; a
// result says what the recorded games show; an association says "games where X was drawn were won more often" and always
// carries the reason it may mislead (tests/findings.test.ts checks no association claim uses a causal word).
import {
  botName,
  citeLine,
  formatValue,
  unitOf,
  type ChangeSubject,
  type Finding,
  type FindingDetail,
  type FlagCode,
  type GapNote,
  type Method,
  type Nature,
  type OpenQuestion,
  type RunRecord,
  type Strength,
  type ToolHealth,
  type TrialRecord,
} from './findings';
import { MIN_SELL_USES, SELLS_SHARE } from './sellShare';

/** The strength chip. */
export const STRENGTH_WORDS: Readonly<Record<Strength, string>> = {
  strong: 'strong',
  moderate: 'moderate',
  weak: 'weak',
  'no-difference': 'no difference',
  'not-enough': 'not enough games',
};

/** The nature chip. */
export const NATURE_WORDS: Readonly<Record<Nature, string>> = {
  result: 'recorded result',
  effect: 'measured effect',
  association: 'association',
};

/** The strength rule in one sentence per word. */
export const STRENGTH_RULE: Readonly<Record<Strength, string>> = {
  strong:
    'The plain 95% interval excludes "no difference", the family test passes, the effect is at least a point, there are enough games (1,000 paired, 200 rated or split), it was measured under the current simulator with a bot its kind expects (Hard for results and associations, Medium or Hard for changes), and it is not an association.',
  moderate: 'The plain 95% interval excludes "no difference", but one of the conditions for strong is missing.',
  weak: 'The estimate is a point or more from "no difference", but the 95% interval still includes it.',
  'no-difference': 'Measured, and the 95% interval keeps it within two points of "no difference": no difference of a point or more.',
  'not-enough': 'Too few games for a number (200 paired, 20 rated games, 20 on each side), or an estimate under a point with an interval wider than ±2 points.',
};

/** Words for each flag code. */
export const FLAG_WORDS: Readonly<Record<FlagCode, string>> = {
  stale: 'Measured under an older simulator version; the bots have changed since, so it is not re-measured and never strong.',
  'other-bot': 'Measured with another bot than the Hard bot the site’s ratings and recorded results use, so it describes that bot’s games, not the rated ones, and is never strong.',
  'medium-only': 'Measured with the Medium bot only; Hard not measured.',
  'hard-confirms': 'Measured with the Hard bot too: Hard’s own range excludes no difference, in the same direction.',
  'hard-decides': 'Measured with the Hard bot too: this measurement does not settle it, and Hard’s own range excludes no difference.',
  'hard-unsettled': 'Measured with the Hard bot too, but its games do not settle it yet.',
  'hard-no-difference': 'Measured with the Hard bot too: Hard finds no difference of a point or more.',
  'hard-opposite': 'Measured with the Hard bot too: Hard reads the other direction, and its range excludes no difference.',
  'first-look': 'Stopped early at its first look: likely optimistic (a sequential stop inflates the estimate).',
  'stopped-futility': 'Stopped early: no gain after two stages.',
  'few-direct-games': 'Few games between these two decks: the estimate leans on the ratings.',
  'prediction-only': 'These decks never met: the number is the ratings’ prediction alone.',
  'depends-on-opponent': 'Depends on the opponent: the per-opponent figures differ by more than chance, so the pooled number is not "the effect".',
  'other-list': 'Measured on another list of this deck.',
  'model-uncertainty-missing': 'The interval leaves out the ratings’ own uncertainty (the fit could not be rebuilt from the recorded games).',
  'spread-default': 'The pair spread in this interval is a default (6 points), not measured on this data: the pairing table it is measured on was missing or too small.',
};

/** Why an association may mislead, one line per kind. */
export const MISLEAD: Readonly<Record<'card-assoc' | 'package-assoc', string>> = {
  'card-assoc': 'Association, not value: a card drawn more often in long games takes their win rate, and the bot sells what looks bad.',
  'package-assoc': 'Association, not value: a package comes online more often in games already going well, or already lost.',
};

/** Words that claim cause: only an effect may use them. */
export const CAUSAL_WORDS: readonly string[] = ['adds', 'costs', 'worth', 'dead weight', 'improves', 'hurts', 'causes', 'because', 'makes', 'helps'];

const pts = (x: number) => formatValue(x, 'points');
const pct = (x: number) => formatValue(x, 'rate');
const sideOf = (x: number) => (x >= 0 ? 'more' : 'less');

/** The one-line claim of a finding, without its numbers (the cite line adds them). */
export function claimOf(f: Pick<Finding, 'kind' | 'subject' | 'estimate' | 'baseline' | 'detail'> & Partial<Pick<Finding, 'method'>>): string {
  const s = f.subject;
  const d = f.estimate - f.baseline;
  switch (f.kind) {
    case 'deck-strength':
      return `${s.deck}: expected win rate against the field`;
    case 'matchup':
      return `${s.deck} against ${s.opponent?.deck ?? 'an opponent'}: ${f.method === 'direct-games' ? 'win rate in their direct games' : 'expected win rate'}`;
    case 'seat':
      return `${s.deck}: result against the ratings' expectation, going first minus going second`;
    case 'length': {
      const t = f.detail?.thirds;
      const short = t?.find((x) => x.label === 'short')?.maxTurns;
      const long = t?.find((x) => x.label === 'long')?.minTurns;
      return `${s.deck}: win rate in short games${short != null ? ` (${short} turns or fewer)` : ''} minus long games${long != null ? ` (${long} turns or more)` : ''}`;
    }
    case 'ending':
      return `${s.deck}: share of its wins that ended "${s.ending ?? '?'}", against the field's share`;
    case 'card-assoc':
      return `${s.deck}: games where ${s.card?.name ?? 'the card'} was drawn were won ${sideOf(d)} often than games where it was not`;
    case 'package-assoc':
      return `${s.deck}: games where ${s.package?.name ?? 'the package'} came online were won ${sideOf(d)} often than games where it never did`;
    case 'change': {
      const c = s.change;
      const what = c?.label ?? 'this change';
      const to = c?.relation === 'to-this-list' ? 'the change that made this list' : c?.relation === 'other-list' ? 'a change to an earlier list' : 'a change to this list';
      return `${what} (${to}): paired win-rate difference for ${s.deck}`;
    }
  }
}

/** The cite line of a finding (citeLine in src/lib/findings.ts with its claim). */
export const citeOf = (f: Finding): string => citeLine(f, f.claim);

const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const wins = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

/** What a sentence reads of a finding: a deck file's finding, or a row of the overview's lists (FindingRef). */
export type SentenceInput = Pick<Finding, 'kind' | 'nature' | 'estimate' | 'lower' | 'upper' | 'level' | 'sequential' | 'baseline' | 'games' | 'method' | 'corrected' | 'strength'> & { detail?: Pick<FindingDetail, 'raw'> };

/** The direct record of a ratings-based matchup in words: "4–1 in 5 direct games", or that the decks have not met. */
export function directWords(f: Pick<SentenceInput, 'detail'>): string {
  const r = f.detail?.raw;
  if (!r || !r.games) return 'these decks have not met';
  return `${wins(r.wins)}–${wins(r.games - r.wins)} in ${r.games} direct game${r.games === 1 ? '' : 's'}`;
}

/**
 * One plain sentence with the numbers, for a list row. It follows the strength word and the family test: an effect
 * says "Adds" or "Costs" only when it is strong or moderate and its own corrected interval excludes no difference; a
 * weak finding gives its number and says the interval still includes no difference; a no-difference finding says so; a
 * not-enough finding says "Not enough games" first and gives its reading only as "reads … so far". A sequentially
 * corrected interval is named as one. A ratings-based matchup rests on the ratings, so its direct games are told apart.
 */
/** The pieces a finding's sentence is built from (sentenceOf, and a row's value and second line, valueOf and restOf). */
function sentenceParts(f: SentenceInput) {
  const u = unitOf(f.kind);
  const v = (x: number) => formatValue(x, u);
  const range = `${f.sequential ? 'corrected 95' : f.level === 0.9 ? '90' : '95'}% range ${v(f.lower)} to ${v(f.upper)}`;
  const rated = f.kind === 'matchup' && f.method !== 'direct-games';
  const games = rated ? '' : `${thousands(f.games)} ${f.nature === 'effect' ? 'paired ' : ''}games`;
  const inside = games ? `${range}, ${games}` : range;
  const tail = rated ? `, from the ratings; ${directWords(f)}` : '';
  const note = f.strength === 'weak' ? '; the interval still includes no difference' : f.nature === 'effect' && !f.corrected ? '; only the uncorrected interval excludes no difference' : '';
  return { v, range, games, inside, tail, note };
}

/** A finding's range in words: "95% range +1.2 pts to +4.4 pts" ("corrected 95%" or "90%" when it is one). */
export const rangeWords = (f: SentenceInput): string => sentenceParts(f).range;

/** The number a row shows once: the estimate, or "reads +1.1 pts so far" for "not enough games". */
export function valueOf(f: SentenceInput): string {
  const { v } = sentenceParts(f);
  return f.strength === 'not-enough' ? `reads ${v(f.estimate)} so far` : v(f.estimate);
}

/**
 * A row's second line: what its sentence says after the number (the range, the games, what the strength word needs
 * said), so the number is said once. "95% range +1.2 pts to +3.5 pts, 2,000 paired games; the interval still includes
 * no difference"; "95% range 64.7% to 92.4%, from the ratings; 4–1 in 5 direct games".
 */
export function restOf(f: SentenceInput): string {
  const { inside, tail, note } = sentenceParts(f);
  if (f.strength === 'not-enough') return `${inside}${tail}`;
  if (f.strength === 'no-difference') return `no difference of a point or more; ${inside}${tail}`;
  const lead = f.kind === 'deck-strength' ? 'against the field; ' : f.kind === 'ending' ? `of its wins, against ${pct(f.baseline)} across the field; ` : '';
  return `${lead}${inside}${tail}${note}`;
}

export function sentenceOf(f: SentenceInput): string {
  const { v, games, inside, tail, note } = sentenceParts(f);
  const rated = f.kind === 'matchup' && f.method !== 'direct-games';
  if (f.strength === 'not-enough') return `Not enough games: reads ${v(f.estimate)} so far (${games || directWords(f)}).`;
  if (f.strength === 'no-difference') return `No difference of a point or more: ${v(f.estimate)} (${inside})${tail}.`;
  // the plain interval excludes no difference here (strong or moderate), or includes it (weak)
  const settled = f.strength !== 'weak' && f.corrected;
  const what = (() => {
    switch (f.kind) {
      case 'deck-strength':
        return `Expected ${v(f.estimate)} against the field`;
      case 'matchup':
        return `${rated ? 'Expected to win' : 'Won'} ${v(f.estimate)}`;
      case 'ending':
        return `${v(f.estimate)} of its wins ended this way, against ${pct(f.baseline)} across the field`;
      case 'change':
        return settled ? `${f.estimate >= 0 ? 'Adds' : 'Costs'} ${pts(Math.abs(f.estimate)).replace(/^[+−]/, f.estimate >= 0 ? '+' : '')}` : `Reads ${pts(f.estimate)}`;
      default:
        return `Reads ${pts(f.estimate)}`;
    }
  })();
  return `${what} (${inside})${tail}${note}.`;
}

/** Words for the notes on what is not measured (`n` fills in a number where the note has one). */
export const GAP_WORDS: Readonly<Record<string, { text: string; measure: string }>> = {
  'no-card-data': {
    text: 'No card-level numbers for this list: the per-deck analysis covers the seven meta decks only.',
    measure: 'npm run sim -- analyze --deck <file> (about 600 Hard games per deck).',
  },
  'no-adjusted': {
    text: 'Card numbers are plain associations: no adjusted (landmark, by opponent and seat, shrunk) estimate is stored, so none can be strong.',
    measure: 'npm run sim -- analyze --impact-adjusted --out DIR, then npm run evidence -- --adjusted DIR/impact-adjusted-latest.json.',
  },
  'thin-packages': {
    text: 'Some packages in this list have under 20 games on a side (online or never), so they get no number.',
    measure: 'More synergy games: npm run sim -- analyze --synergies --games N with a larger N.',
  },
  'thin-cards': {
    text: 'Some cards have under 20 games on a side (drawn or not), so they get no number.',
    measure: 'More analysis games for this list: npm run sim -- analyze --deck <file> --games N.',
  },
  'no-changes': {
    text: 'No change to this list has been measured: no ledger games, forge report or re-measurement.',
    measure: 'npx tsx scripts/forge.ts <deck> --ledger (Medium), or a paired re-measurement on fresh games: npm run remeasure -- <deck> --cut <card> --add <card> (Hard by default), then npm run evidence.',
  },
  'season1-no-interval': {
    text: 'Season 1 forge confirmations recorded win rates only (the any-gain rule): no paired interval, so they are listed as runs, not findings.',
    measure: 'Re-measure the adopted change paired: npm run remeasure -- <deck> --before data/decks/custom/history/<file> (the list before it against the library list), then npm run evidence.',
  },
  'no-hard-changes': {
    text: 'Every change measured for this list was measured with the Medium bot; none with Hard.',
    measure: 'A Hard re-measurement of the change: npm run remeasure -- <deck> --change "<label>" --bot hard (1,120 paired games against the meta decks), then npm run evidence.',
  },
  'other-list-events': {
    text: 'Some recorded games were played with another list of this deck; they are left out, so its results come from its current list alone.',
    measure: 'Games with the current list: the rating series plays a deck whose list changed (docs/SERIES.md), or record new events with it.',
  },
  'no-bot-transfer': {
    text: 'No per-deck Medium-against-Hard measurement is stored, so no finding says how far Medium’s view of a deck is from Hard’s.',
    measure: 'Play every deck against the same field with Medium and with Hard on the same deals, about 700 games per deck per bot: npx tsx scripts/rank-stability.ts --bots medium,hard --decks all --out DIR writes a per-deck table of both bots; keep that file in the repository so the builder can read it.',
  },
  'no-rank-stability': {
    text: 'The rank-stability figure (Medium against Hard) is only in docs (BOT_TOOLKIT.md §11), not in a stored file.',
    measure: 'npx tsx scripts/rank-stability.ts --out DIR and a tracked copy of its result.',
  },
  'no-ablations': {
    text: 'No card or package ablation (the list with and without it on the same seeds) is stored: card and package numbers are associations only.',
    measure: 'Paired games of the list without the card (about 1,700 per card for ±1 point).',
  },
  'catalogue-changed': {
    text: 'The synergy report was made with another package catalogue, so its package numbers are left out.',
    measure: 'npm run sim -- analyze --synergies with the current catalogue.',
  },
};

/** A gap note in words. */
export function gapText(g: GapNote): string {
  const w = GAP_WORDS[g.code];
  if (!w) return g.code;
  return g.n !== undefined ? `${w.text} (${g.n})` : w.text;
}

/** The overview's list titles. */
export const TOP_LIST_TITLES: Readonly<Record<'effects' | 'results' | 'patterns', string>> = {
  effects: 'Measured effects',
  results: 'Results that stand out',
  patterns: 'Patterns worth testing (association)',
};

/** "ranked from 34 cards; about 2 of the 'moderate' ones are expected by chance" */
export function familyWords(size: number, what: string): string {
  const chance = Math.round(size * 0.05);
  return `ranked from ${size} ${what}; about ${chance} of the ones whose interval excludes "no difference" ${chance === 1 ? 'is' : 'are'} expected by chance`;
}

// ---------------------------------------------------------------- the page (#/evidence, src/ui/pages/Evidence.tsx)
// Every sentence the evidence page shows a visitor is here, so the wording rules above are tested in one place
// (tests/evidence-ui.test.tsx): an association's row never uses a causal word, a screening figure is always named as
// screening, and a stale or Medium-only measurement says so.

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const plural = (n: number, one: string, many = `${one}s`) => `${thousands(n)} ${n === 1 ? one : many}`;
const bare = (x: number) => formatValue(x, 'points', { bare: true });
/** a mean's plain 95% range from its standard error */
const seRange = (mean: number, se: number) => `95% range ${pts(mean - 1.96 * se)} to ${pts(mean + 1.96 * se)}`;

/** What the page is (the overview's first lines). */
export const PAGE_INTRO =
  'Every number this site reports about a deck, as a finding: what was measured, the estimate with its range and the games behind it, and a word for how strong the evidence is, given by a stated rule. Recorded results, measured effects and associations are kept in separate lists: only a measured effect compares a list with and without a change.';

/** One line per nature, for the page's key. */
export const NATURE_HELP: Readonly<Record<Nature, string>> = {
  result: 'what the deck’s recorded games show',
  effect: 'a paired comparison: the list with and without a change, on the same deals',
  association: 'games where a card was drawn or a package came online, against games where not: a pattern worth testing',
};

/** How a finding was measured, in words (the Details of a row; a change's measurement is named by it). */
export const METHOD_WORDS: Readonly<Record<Method, string>> = {
  'rating-model': 'the power ratings: expected win rate against the field',
  shrunk: 'the head-to-head record, shrunk toward the ratings’ prediction',
  'direct-games': 'the pairing’s own direct games',
  'model-residual': 'each game’s result against the ratings’ prediction, split by seat',
  'result-split': 'the recorded games, split two ways',
  association: 'games where it was drawn or online, against games where it was not',
  'paired-pooled': 'held-out games kept across runs',
  'paired-staged': 'a forge confirmation',
  paired: 'a re-measurement on fresh games',
};

/** A change's measurement named by how it was measured (its bot and version are on the row's second line). */
export const measuredByWords = (f: Pick<Finding, 'method'>): string => capital(METHOD_WORDS[f.method]);

/** Short row titles (the full claim is in the cite line and Details). */
export const TITLE_WORDS = {
  strength: 'Against the field',
  seat: 'Going first minus going second',
  length: 'Short games minus long games',
  against: (opp: string, direct: boolean) => `against ${opp}${direct ? ' (direct games)' : ''}`,
  ending: (ending: string) => `Wins that ended “${ending}”`,
} as const;

/** What kind of range a finding states (its Details). */
export function rangeKindWords(f: Pick<Finding, 'sequential' | 'level'>): string {
  switch (f.sequential) {
    case 'always-valid':
      return 'Its range is an always-valid one: it stays honest however often the games are looked at.';
    case 'obrien-fleming':
      return 'Its range is corrected for the confirmation’s staged looks (O’Brien–Fleming).';
    case 'bonferroni':
      return 'Its range is corrected for the confirmation’s staged looks and nominees (Bonferroni).';
    default:
      return f.level === 0.9 ? 'Its range is a 90% range.' : 'Its range is a plain 95% range.';
  }
}

/** Whether a finding passed its family's test, after the family line. */
export const familyPassWords = (passed: boolean): string => (passed ? 'this one passes the family’s test' : 'this one does not pass the family’s test');

/** The games behind a row, named: a ratings-based matchup's are its direct games, an effect's are paired. */
export const gamesWords = (f: Pick<Finding, 'games' | 'kind' | 'method' | 'nature'>): string =>
  plural(f.games, f.kind === 'matchup' && f.method === 'shrunk' ? 'direct game' : f.nature === 'effect' ? 'paired game' : 'game');

/** Short flag words for a chip (the full words are FLAG_WORDS). */
export const FLAG_SHORT: Readonly<Record<FlagCode, string>> = {
  stale: 'older version',
  'other-bot': 'not the Hard bot',
  'medium-only': 'Medium only',
  'hard-confirms': 'Hard agrees',
  'hard-decides': 'Hard decides',
  'hard-unsettled': 'Hard not settled',
  'hard-no-difference': 'Hard: no difference',
  'hard-opposite': 'Hard disagrees',
  'first-look': 'stopped early',
  'stopped-futility': 'stopped: no gain',
  'few-direct-games': 'few direct games',
  'prediction-only': 'ratings only',
  'depends-on-opponent': 'depends on the opponent',
  'other-list': 'another list',
  'model-uncertainty-missing': 'range leaves out the ratings',
  'spread-default': 'default spread',
};

/** A stale finding's line: under which version it was measured. */
export const staleWords = (simVersion: number, current: number): string =>
  `Measured under simulator version ${simVersion}; the site now plays version ${current}. Not re-measured, so never emphasised.`;

/** The banner when the findings were built for another simulator version than the site plays. */
export const staleBuildWords = (built: number, current: number): string =>
  `These findings were built for simulator version ${built}, and the site now plays version ${current}: they may not match its games until they are rebuilt.`;

/** The tool's verdict on a change, by its own rule. */
export const VERDICT_WORDS: Readonly<Record<NonNullable<FindingDetail['verdict']>, string>> = {
  adopt: 'The tuning tools’ rule would adopt it.',
  reject: 'The tuning tools’ rule would reject it.',
  undecided: 'Undecided: its held-out games do not settle it yet.',
  inconclusive: 'The forge could not tell.',
};

/**
 * Which rule gave a change's verdict, by how it was measured (docs/EVIDENCE.md "Two rules, two verdicts"): a forge
 * confirmation is judged by the run's staged rule (a fixed number of looks, its range corrected for them); held-out games
 * kept across runs by the pooled always-valid rule, whose range stays valid however many runs add games, so it is wider
 * and can call undecided what one run's staged rule adopted. Both are right under their own rules.
 */
export const RULE_OF: Readonly<Partial<Record<Method, string>>> = {
  'paired-staged': 'the run’s staged rule',
  'paired-pooled': 'the pooled always-valid rule',
  paired: 'the re-measurement’s fixed-size rule',
};

/**
 * A change's verdict with the rule that gave it: "Adopted by the run’s staged rule.", "Undecided by the pooled
 * always-valid rule: its held-out games do not settle it yet." (VERDICT_WORDS when the method names no rule).
 */
export function verdictWords(method: Method, verdict: NonNullable<FindingDetail['verdict']>): string {
  const rule = RULE_OF[method];
  if (!rule) return VERDICT_WORDS[verdict];
  switch (verdict) {
    case 'adopt':
      return `Adopted by ${rule}.`;
    case 'reject':
      return `Rejected by ${rule}.`;
    case 'undecided':
      return `Undecided by ${rule}: its held-out games do not settle it yet.`;
    case 'inconclusive':
      return `${capital(rule)} could not tell.`;
  }
}

/** The run's staged outcome in the words of a pooled verdict, to tell when the two rules read the same games apart. */
const STAGED_AS: Readonly<Record<NonNullable<FindingDetail['confirmation']>['outcome'], NonNullable<FindingDetail['verdict']>>> = { adopt: 'adopt', reject: 'reject', inconclusive: 'undecided' };

/**
 * A change's verdict line on the page: the verdict by its rule, and, for held-out games that all come from one forge run
 * (`confirmation`), what that run's staged rule concluded; when the two differ, a sentence that both are right under
 * their own rules.
 */
export function changeVerdictWords(f: Pick<Finding, 'method'> & { detail?: Pick<FindingDetail, 'verdict' | 'confirmation'> }): string | null {
  const d = f.detail;
  if (!d?.verdict) return null;
  const head = verdictWords(f.method, d.verdict);
  if (!d.confirmation) return head;
  const differ = STAGED_AS[d.confirmation.outcome] !== d.verdict;
  return `${head} ${confirmationWords(d.confirmation)}${differ ? ` The two verdicts differ on the same games and both are right under their own rules: ${RULE_OF['paired-staged']} judges one run’s looks, ${RULE_OF['paired-pooled']} stays valid as later runs add games and so needs a clearer gain.` : ''}`;
}

/**
 * A ledger change whose held-out games all come from one recorded forge run (`detail.confirmation`): what that run
 * concluded by its own staged rule, the look it ended at, and its corrected range, then why the row's range is wider.
 * "These held-out games all come from one forge run, which by its own staged rule could not tell at look 4 of 4 (its
 * corrected range +0.0 pts to +3.8 pts). The range above is wider because it stays valid as later runs add games."
 */
export function confirmationWords(c: NonNullable<FindingDetail['confirmation']>): string {
  const at = c.looks > c.cap ? `after ${plural(c.looks, 'look')} (${thousands(c.cap)} within its cap, then until settled)` : c.looks === 1 ? `at its first look of ${thousands(c.cap)}` : `at look ${thousands(c.looks)} of ${thousands(c.cap)}`;
  const verb =
    c.outcome === 'adopt'
      ? `adopted it ${at}`
      : c.outcome === 'reject'
        ? `rejected it ${at}`
        : c.stopped === 'futility'
          ? `stopped ${at} with no gain, so could not tell`
          : c.stopped === 'stop'
            ? `was stopped ${at}, so could not tell`
            : `could not tell ${at}`;
  return `These held-out games all come from one forge run, which by the run’s staged rule ${verb} (its corrected range ${pts(c.lower)} to ${pts(c.upper)}). The range above is the pooled always-valid rule’s, wider because it stays valid as later runs add games.`;
}

/**
 * Where a change stands for later tuning runs (the shortlist, docs/SYNERGIES.md). With the finding's `toSettle` and its
 * held-out games (`heldout`), a change set aside as out of reach says how many games adopting it would take, or that its
 * held-out reading is not above the bar.
 */
export function shortlistWords(d: Pick<FindingDetail, 'status' | 'dropped' | 'toSettle'>, heldout?: number): string | null {
  if (d.status === 'live') return 'Still open: later tuning runs test it first.';
  if (d.status === 'untested') return 'Not tested on held-out games yet.';
  if (d.status !== 'dropped') return null;
  switch (d.dropped) {
    case 'below-bar':
      return 'Set aside: its games so far read under the bar for a confirmation.';
    case 'rejected':
      return 'Set aside: its held-out games reject it.';
    case 'out-of-reach':
      if (d.toSettle === null) return 'Set aside: its held-out games do not read above the bar, so more of them are not expected to adopt it.';
      if (typeof d.toSettle === 'number' && heldout !== undefined)
        return `Set aside: at its present reading, adopting it would take about ${plural(Math.max(0, d.toSettle - heldout), 'more held-out game')} (${thousands(d.toSettle)} in all), more than later tuning runs give one change.`;
      return 'Set aside: settling it would take more held-out games than a run may spend.';
    default:
      return 'Set aside.';
  }
}

/** How a change relates to the deck's list. */
export const RELATION_WORDS: Readonly<Record<ChangeSubject['relation'], string>> = {
  'from-this-list': 'A change to this list.',
  'to-this-list': 'The change that made this list.',
  'other-list': 'A change to an earlier list of this deck.',
};

/** A settled change that starts from the list: it was measured, never applied. */
export const NOT_APPLIED = 'Tried on this list and not applied: the list on this site does not contain it.';

/**
 * A change's one status sentence: the change that made the list, a change to an earlier list, a settled change tried on
 * this list and not applied, or where an unsettled one stands for later runs (else "A change to this list.").
 */
export function changeStatusWords(relation: ChangeSubject['relation'], settled: boolean, shortlist: string | null): string {
  if (relation !== 'from-this-list') return RELATION_WORDS[relation];
  if (settled) return NOT_APPLIED;
  return shortlist ?? RELATION_WORDS['from-this-list'];
}

/** A run's bots: "Medium bot", or "Medium bot screening, Hard bot confirming" when another bot played the confirmation. */
export const runBotWords = (r: Pick<RunRecord, 'bot' | 'confirmBot'>): string => (r.confirmBot ? `${botName(r.bot)} bot screening, ${botName(r.confirmBot)} bot confirming` : `${botName(r.bot)} bot`);

/** A row's second line after its sentence: the bot and the simulator version, once. */
export const botVersionWords = (f: Pick<Finding, 'bot' | 'simVersion'>): string => `${botName(f.bot)} bot, version ${f.simVersion}`;

/** One measurement of a change in the drift line. */
export interface DriftItem {
  estimate: number;
  games: number;
  simVersion: number;
  method: Method;
  verdict?: FindingDetail['verdict'];
  /** the bot that played it (named in the line when the measurements do not all share one) */
  bot?: string;
}

/**
 * "+15.6 at adoption (224 games, version 5); +6.4 on fresh games (2,800 games, version 8)": a change's measurements in
 * date order. When they were not all played by one bot, each names its bot: "+2.9 on fresh games with Medium (2,800
 * games, version 9); +1.4 on fresh games with Hard (560 games, version 9)".
 */
export function driftWords(items: readonly DriftItem[]): string {
  const bots = new Set(items.map((m) => m.bot ?? ''));
  const named = bots.size > 1;
  const one = (m: DriftItem) => {
    const how =
      m.method === 'paired-staged' ? (m.verdict === 'adopt' ? 'at adoption' : 'in a forge confirmation') : m.method === 'paired-pooled' ? 'over held-out games kept across runs' : 'on fresh games';
    const by = named && m.bot ? ` with ${botName(m.bot)}` : '';
    return `${bare(m.estimate)} ${how}${by} (${plural(m.games, 'game')}, version ${m.simVersion})`;
  };
  return `Measured ${items.length} times, in points, in date order: ${items.map(one).join('; ')}.`;
}

/** One bot's reading of a change, for botsWords: its estimate, plain 95% range, games, version and strength word. */
export interface BotReading {
  bot: string;
  estimate: number;
  /** the plain 95% range (plain95: `p95` when the finding stores one) */
  lower: number;
  upper: number;
  games: number;
  simVersion: number;
  strength: Strength;
}

/**
 * What the Hard measurement of a change says about the Medium one, in one sentence, from their strength words and plain
 * 95% ranges (each bot's measurement with the most games under its newest simulator version; null unless the change has both). It never says more than the two ranges
 * show: a direction only where a range excludes no difference, and a size only where the ranges do not overlap.
 */
export function botsWords(readings: readonly BotReading[]): string | null {
  // each bot's best measurement: under the newest simulator version, the one with the most games
  const best = (bot: string) => readings.filter((r) => r.bot === bot).sort((a, b) => b.simVersion - a.simVersion || b.games - a.games)[0];
  const m = best('medium');
  const h = best('hard');
  if (!m || !h) return null;
  const v = (r: BotReading) => pts(r.estimate);
  const range = (r: BotReading) => `95% range ${pts(r.lower)} to ${pts(r.upper)}`;
  const excludes = (r: BotReading) => r.lower > 0 || r.upper < 0;
  const versions = m.simVersion !== h.simVersion ? ` The two were measured under different simulator versions (${m.simVersion} and ${h.simVersion}), so the bots are not the only difference.` : '';
  // a size only where the two ranges do not overlap
  const size = h.upper < m.lower ? ' Hard reads it lower than Medium, and the two ranges do not overlap.' : h.lower > m.upper ? ' Hard reads it higher than Medium, and the two ranges do not overlap.' : '';
  let lead: string;
  if (h.strength === 'not-enough') lead = `With Hard there are not enough games yet to say whether it agrees with Medium (${plural(h.games, 'paired game')} with Hard, reading ${v(h)}).`;
  else if (h.strength === 'no-difference')
    lead = `Hard finds no difference of a point or more (${v(h)}, ${range(h)})${excludes(m) ? `, so it does not confirm Medium’s ${v(m)} (${range(m)})` : `, and Medium’s range also includes no difference (${v(m)}, ${range(m)})`}.`;
  else if (!excludes(h)) lead = `Hard’s range still includes no difference (${v(h)}, ${range(h)}), so it neither confirms nor contradicts Medium’s ${v(m)} (${range(m)}).`;
  else if (!excludes(m)) lead = `Hard’s range excludes no difference (${v(h)}, ${range(h)}), where Medium’s did not (${v(m)}, ${range(m)}).`;
  else if (Math.sign(h.estimate) === Math.sign(m.estimate))
    lead = `Hard agrees with Medium on the direction: both ranges exclude no difference (Medium ${v(m)}, Hard ${v(h)})${size ? '.' : ', and the two ranges overlap, so they do not show a different size.'}`;
  else lead = `Hard and Medium disagree on the direction: Medium reads ${v(m)} and Hard ${v(h)}, and each range excludes no difference.`;
  // the overlap note only where the lead has not said it
  const sizeNote = h.strength === 'not-enough' || lead.includes('do not show a different size') || lead.includes('disagree') ? '' : size;
  return `${lead}${sizeNote}${versions}`;
}

/** The screening figure of a change, one short greyed line: "Screening read +5.4 pts over 224 games: not the result." */
export const screenWords = (s: NonNullable<FindingDetail['screen']>): string => `Screening${s.bot ? ` with ${botName(s.bot)}` : ''} read ${pts(s.mean)} over ${plural(s.games, 'game')}: not the result.`;

/** A tool record's bots: "Medium" or "Medium screening, Hard held-out" (a record names its context, docs/EVIDENCE.md "The index"). */
const healthBots = (h: Pick<ToolHealth, 'bot' | 'confirmBot'>): string => (h.bot ? (h.confirmBot ? `${botName(h.bot)} screening, ${botName(h.confirmBot)} held-out` : botName(h.bot)) : '');

/**
 * Said once above a deck's changes: how much higher screening has read than the held-out games, per tool record (the
 * index's records that match this deck's changes, `screenCurseRows`), or why it reads high when none is loaded. Each
 * record is named by its simulator version and bots; a record where one bot screened and another played the held-out
 * games is said to hold how the two bots differ too.
 */
export function screenCurseWords(health: readonly ToolHealth[]): string {
  const rows = health.filter((h) => h.screenMinusHeldOut);
  const parts = rows.map((h) => {
    const ctx = [h.simVersion !== undefined ? `version ${h.simVersion}` : '', healthBots(h)].filter(Boolean).join(', ');
    return `${Math.abs(h.screenMinusHeldOut!.mean * 100).toFixed(1)} points ${h.screenMinusHeldOut!.mean >= 0 ? 'above' : 'below'} for ${lowerFirst(toolWords(h.tool))} (${ctx ? `${ctx}; ` : ''}${plural(h.screenMinusHeldOut!.n, 'nominee')})`;
  });
  const why = 'Screening figures are greyed and are not results: the best of many candidates is picked on those games, so they read high.';
  const bots = rows.some((h) => h.confirmBot) ? ' Where one bot screened and another played the held-out games, that gap also holds how the two bots differ.' : '';
  return parts.length ? `${why} Against the held-out games, screening has read on average ${parts.join('; ')}.${bots}` : why;
}

/** An open question: what its games read so far, and how many more held-out games would settle it. */
export function openWords(o: Pick<OpenQuestion, 'heldout' | 'screen' | 'pooled' | 'toSettle' | 'more' | 'runs' | 'bot' | 'screenBot'>): { reads: string; settle: string } {
  const range = seRange(o.pooled.mean, o.pooled.se);
  const reads =
    o.heldout > 0 && o.screenBot
      ? // screened by another bot: the two bots' games are never read together
        `${plural(o.heldout, 'held-out game')} with ${botName(o.bot)} over ${plural(o.runs, 'run')} read ${pts(o.pooled.mean)} (${range}); it was screened with ${botName(o.screenBot)} on ${plural(o.screen, 'game')}.`
      : o.heldout > 0
        ? `${plural(o.heldout, 'held-out game')} and ${plural(o.screen, 'screening game')} over ${plural(o.runs, 'run')} read ${pts(o.pooled.mean)} together (${range}).`
        : `Screened only: ${plural(o.screen, 'screening game')} over ${plural(o.runs, 'run')} read ${pts(o.pooled.mean)} (${range}), and screening reads high.`;
  const settle =
    o.heldout === 0
      ? 'No held-out games yet: it has only been screened.'
      : o.more === null || o.toSettle === null
        ? 'No estimate of the games that would settle it: its held-out reading is not above the bar.'
        : o.more <= 0
          ? `Its ${plural(o.heldout, 'held-out game')} should settle it at the next look.`
          : `About ${plural(o.more, 'more held-out game')} would settle it (${thousands(o.toSettle)} in all).`;
  return { reads, settle };
}

/** The tools as the page names them. */
export const TOOL_WORDS: Readonly<Record<string, string>> = {
  forge: 'The forge',
  'forge (any-gain)': 'The forge under the older any-gain rule',
  'ledger runs': 'Forge runs with held-out games kept across runs',
  optimizer: 'The optimizer',
  lab: 'The Deck Lab',
};
export const toolWords = (tool: string): string => TOOL_WORDS[tool] ?? capital(tool);

/**
 * A tool record's heading: the tool, its simulator version (an older one said so) and its bots, e.g. "The forge,
 * simulator version 9: Medium bot screening, Hard bot confirming". A record from a file built before records had a
 * context is named by its tool alone.
 */
export function healthTitleWords(h: Pick<ToolHealth, 'tool' | 'simVersion' | 'bot' | 'confirmBot'>, current?: number): string {
  const version = h.simVersion !== undefined ? `, simulator version ${h.simVersion}${current !== undefined && h.simVersion !== current ? ' (an older version)' : ''}` : '';
  return `${toolWords(h.tool)}${version}${h.bot ? `: ${runBotWords({ bot: h.bot, confirmBot: h.confirmBot })}` : ''}`;
}

/**
 * One tool record as plain sentences, each with its count; a figure the record lacks (null) is left out. Where one bot
 * screened and another played the held-out games, the screening gap is said to hold how the bots differ as well as
 * screening's optimism, so it measures neither alone.
 */
export function healthWords(h: ToolHealth): string[] {
  const out: string[] = [];
  const ends = [
    h.adopted !== null ? `${thousands(h.adopted)} adopted` : null,
    h.rejected !== null ? `${thousands(h.rejected)} rejected` : null,
    h.couldNotTell !== null ? `${thousands(h.couldNotTell)} could not tell` : null,
  ].filter((x): x is string => x !== null);
  out.push(`${plural(h.nominees, 'nominee')} confirmed on held-out games${ends.length ? `: ${ends.join(', ')}` : ''}.`);
  const higher = (x: number) => `${Math.abs(x * 100).toFixed(1)} points ${x >= 0 ? 'higher' : 'lower'}`;
  if (h.screenMinusHeldOut && h.confirmBot && h.bot)
    out.push(
      `Screening with ${botName(h.bot)} read ${higher(h.screenMinusHeldOut.mean)} than the held-out games with ${botName(h.confirmBot)}, on average over ${plural(h.screenMinusHeldOut.n, 'nominee')}. That gap holds screening’s optimism and how the two bots differ together, so it measures neither alone.`,
    );
  else if (h.screenMinusHeldOut) out.push(`Screening read ${higher(h.screenMinusHeldOut.mean)} than the held-out games, on average over ${plural(h.screenMinusHeldOut.n, 'nominee')}.`);
  if (h.adoptedMinusLater)
    out.push(
      h.simVersion !== undefined
        ? `The held-out figure at adoption read ${higher(h.adoptedMinusLater.mean)} than a later re-measurement on fresh games with the same bot under the current simulator version, on average over ${plural(h.adoptedMinusLater.n, 'adopted change')}.`
        : `The held-out figure at adoption read ${higher(h.adoptedMinusLater.mean)} than a later re-measurement on fresh games, on average over ${plural(h.adoptedMinusLater.n, 'adopted change')}.`,
    );
  if (h.repeatNominated) {
    const k = Math.round(h.repeatNominated.share * h.repeatNominated.runs);
    out.push(`${thousands(k)} of the ${plural(h.repeatNominated.runs, 'run')} after the first on a list nominated a change an earlier run had tested.`);
  }
  return out;
}

/** What a recorded run could detect: "a one-card change worth +4.2 pts or more is adopted 8 times in 10". */
export function runDetectWords(d: NonNullable<RunRecord['detect']>): string {
  const part = (x: number | null, what: string) => (x === null ? `no ${what} is adopted 8 times in 10 within its stages` : `${what} worth ${pts(x)} or more is adopted 8 times in 10`);
  return `When it was recorded, ${part(d.card, 'a one-card change')}, and ${part(d.package, 'a package move')} (first stage ${plural(d.firstStage, 'game')}, ${plural(d.nominees, 'nominee')}; a per-game spread of ${d.sdCard.toFixed(2)} assumed for a card and ${d.sdPackage.toFixed(2)} for a package).`;
}

/** A run's trial outcome, and its kind. */
export const TRIAL_OUTCOME_WORDS: Readonly<Record<string, string>> = {
  adopted: 'adopted',
  rejected: 'rejected',
  'could not tell': 'could not tell',
  'not nominated': 'not nominated',
  nominated: 'tested on held-out games',
  screened: 'screened only',
};
export const TRIAL_KIND_WORDS: Readonly<Record<TrialRecord['kind'], string>> = { card: 'one card', package: 'package', combo: 'combination' };

/** A trial's screening figure (greyed), held-out figure and pooled figure across runs, each with its range or the reason it has none. */
export function trialScreenWords(s: NonNullable<TrialRecord['screen']>): string {
  const games = s.games !== null ? `, ${plural(s.games, 'game')}` : '';
  return s.lower !== null && s.upper !== null ? `${pts(s.mean)} (95% range ${pts(s.lower)} to ${pts(s.upper)}${games})` : `${pts(s.mean)} (no range recorded${games})`;
}
export function trialHeldOutWords(h: NonNullable<TrialRecord['heldOut']>): string {
  const looks = h.looks !== null ? `, ${plural(h.looks, 'look')}` : '';
  return h.lower !== null && h.upper !== null
    ? `${pts(h.mean)} (range ${pts(h.lower)} to ${pts(h.upper)}, ${plural(h.games, 'game')}${looks})`
    : `${pts(h.mean)} (no range recorded, ${plural(h.games, 'game')}${looks})`;
}
export const pooledWords = (p: { games: number; mean: number; se: number }): string => `${pts(p.mean)} (${seRange(p.mean, p.se)}, ${plural(p.games, 'game')})`;

/** The deck profile's evidence panel. */
export const DECK_PANEL_WORDS = {
  title: 'Evidence',
  intro: 'Every number about this deck as a finding, with its range, the games behind it and how strong it is.',
  link: 'See the evidence →',
} as const;

/** The overview's words. */
export const OVERVIEW_WORDS = {
  openTitle: 'Open a finding',
  openHelp: 'Paste a cite id, such as F:9f3a2c1d or a whole cite line, to go to its finding.',
  openLabel: 'Finding id',
  openButton: 'Open',
  opening: 'Looking up the finding…',
  listIntro: {
    effects: 'Changes to a list measured as paired games, each question named once by its best-supported measurement.',
    results: 'What the recorded games show, where the range clearly excludes “no difference” across the whole pool.',
    patterns: 'Games where a card was drawn or a package came online, against games where not, where the range clearly excludes “no difference” across the whole pool.',
  },
  others: (n: number) => `also measured ${plural(n, 'other time')}`,
  healthTitle: 'How the tuning tools have done',
  healthIntro:
    'Each tool’s nominees and how they ended, and how far its first readings sat from the later ones: one record per simulator version and bots, because figures of different versions or bots are never averaged together, and each nominee counted once. A figure the record does not hold is left out.',
  decksTitle: 'All decks',
  decksIntro: 'Each deck’s expected win rate against the field with its range and strength word, beside its Sim tier from the same ratings, then its findings counted by strength word.',
  noStrength: 'no rating',
  showAll: (n: number) => `Show all ${thousands(n)}`,
  showFewer: 'Show the first 5 only',
  staleCount: (n: number) => `${plural(n, 'finding')} from an older version`,
  runsCount: (n: number) => plural(n, 'recorded run'),
  evidenceLink: 'Evidence',
  gapsTitle: 'Not measured yet',
  howTitle: 'How to read this page',
  strengthRule: 'The strength word, by a stated rule:',
  staleHelp: '“Older version” (greyed):',
  mediumHelp: '“Medium only”:',
  emptyList: 'Nothing in this list yet.',
} as const;

/** A run's name: the tool and date, and its seed when the run's id has one (several runs of a day are told apart). */
export function runTitleWords(r: Pick<RunRecord, 'id' | 'tool' | 'date'>): string {
  const seed = /seed ([0-9]+)$/.exec(r.id)?.[1];
  return `${toolWords(r.tool)}, ${r.date}${seed ? `, seed ${seed}` : ''}`;
}

/** The run view's words. */
export const RUN_WORDS = {
  backToDeck: 'This deck’s evidence',
  allDecks: 'All decks’ evidence',
  howTitle: 'How it ran',
  noRule: 'The run recorded no adoption rule.',
  noDetect: 'The run recorded nothing to tell what it could detect.',
  noRuleNorDetect: 'The run recorded neither its adoption rule nor what it could detect.',
  pooledHead: 'All its games, every run (screening included)',
  pooledLabel: 'All its games (screening included)',
  source: 'Recorded in',
  keptAcross: 'Its games are also kept across runs, where a later run on the same list pools with them; they are not listed again as a run of their own.',
  trialsTitle: 'What it tried',
  trialsIntro:
    'Each change the run screened. The screening figure is greyed: the best of many candidates is picked on those games, so it reads high. The held-out figure is the one the run judged by, and the outcome is the run’s staged rule’s; the pooled always-valid rule, which stays valid as later runs add games, can call the same games undecided.',
  none: '—',
  notConfirmed: 'not confirmed on held-out games',
} as const;

/** The opening sentence of each block of a deck's page. */
export const BLOCK_WORDS = {
  strength: 'Its expected win rate against the field, from the power ratings, and the Sim tier drawn from the same range.',
  matchups:
    'One cell per opponent, worst first: the expected win rate from the ratings and the head-to-head record, with how sure it is. Then the seat, game length and how its wins ended.',
  cards: 'How often the deck won in games where a card was drawn or a package came online, against games where not. These are patterns worth testing, not measured effects.',
  changes: 'Changes to the list measured as paired games: the list with and without the change, on the same deals.',
  open: 'Changes still undecided: what their games read so far, and about how many more held-out games would settle them.',
} as const;

/** The at-a-glance strip's labels. */
export const GLANCE_WORDS = {
  strength: 'Against the field',
  good: 'Clearest good matchup',
  bad: 'Clearest bad matchup',
  change: 'A change measured to add',
  openLabel: 'Open questions',
  open: (n: number, heldout: number) => `${plural(n, 'open question')}${heldout ? `, ${thousands(heldout)} with held-out games` : ''}`,
} as const;

/** The deck page's notes on what it does not show. */
export const DECK_PAGE_WORDS = {
  noChanges: 'No change to this list has been measured yet.',
  noOpen: 'No open questions: every change measured for this list is settled or dropped.',
  noRuns: 'No recorded runs for this list.',
  noPackages: 'No package of this list has a number: none has 20 games on each side.',
  directRow: (games: number) => `Measured over its ${plural(games, 'direct game')}`,
  perOpponent: 'Per opponent (paired difference, 95% range):',
  perSeat: 'Per seat (paired difference, 95% range):',
  heldOutFinding: 'Its held-out finding',
  head: (simVersion: number, findings: number | null) =>
    `The findings for this list, built for simulator version ${simVersion}${findings !== null ? `: ${plural(findings, 'finding')}` : ''}. Each names its strength, its range, the games behind it and the bot that played them.`,
  seatHead: 'Going first or second',
  lengthHead: 'Game length',
  endingsHead: 'How its wins ended',
  cardsHead: 'Cards',
  packagesHead: 'Packages',
  first: 'Going first',
  second: 'Going second',
  measuredOn: (date: string, runs: number | null, looks: number | null) =>
    `Measured on ${date}${runs ? `, over ${plural(runs, 'run')}` : ''}${looks ? `, ${plural(looks, 'look')}` : ''}.`,
  showRuns: (n: number | null) => (n === null ? 'Show the recorded runs' : `Show the ${plural(n, 'recorded run')}`),
  loadingRuns: 'Loading the runs…',
  showAll: (n: number, what: string) => `Show all ${thousands(n)} ${what}`,
  showFewer: (n: number) => `Show the clearest ${n} only`,
  showFirst: (n: number) => `Show the first ${n} only`,
  stripFewer: 'Show the 6 worst and the 6 best only',
  nothingListed: 'Nothing is listed as not measured for this list.',
  howToRead: 'How to read these findings',
  allDecks: 'All decks’ evidence',
} as const;

/** One opponent's or seat's figure of a change: "+2.1 pts (95% range −0.4 to +4.6 pts, 400 games)". */
export const splitWords = (x: { mean: number; se: number; games: number }): string => `${pts(x.mean)} (${seRange(x.mean, x.se)}, ${plural(x.games, 'game')})`;

/** A matchup cell's name: the opponent, the expected win rate and the strength word. */
export const matchupCellWords = (opp: string, f: Pick<Finding, 'estimate' | 'strength'>): string => `${opp}: ${pct(f.estimate)}, ${STRENGTH_WORDS[f.strength]}`;

/** A game-length group: "Short games (12 turns or fewer): won 34.7% (95% range 22.9% to 48.7%, 49 games)". */
export function thirdWords(t: NonNullable<FindingDetail['thirds']>[number]): string {
  const span =
    t.minTurns === null
      ? `${t.maxTurns} turns or fewer`
      : t.maxTurns === null
        ? `${t.minTurns} turns or more`
        : t.minTurns === t.maxTurns
          ? `${t.minTurns} turns`
          : `${t.minTurns} to ${t.maxTurns} turns`;
  return `${capital(t.label)} games (${span}): won ${pct(t.rate)} (95% range ${pct(t.lower)} to ${pct(t.upper)}, ${plural(t.games, 'game')})`;
}

/** A seat finding's raw numbers, for its Details. */
export function seatDetailWords(d: Pick<FindingDetail, 'first' | 'second' | 'residual'>): string[] {
  const out: string[] = [];
  if (d.residual)
    out.push(
      `Against the ratings’ expectation: ${pts(d.residual.first)} going first (${plural(d.residual.firstGames, 'game')}), ${pts(d.residual.second)} going second (${plural(d.residual.secondGames, 'game')}).`,
    );
  if (d.first && d.second) out.push(`Raw split: won ${d.first.won} of ${d.first.decided} decided games going first, ${d.second.won} of ${d.second.decided} going second.`);
  return out;
}

/** An association's two win rates: "drawn 52.1% (943 games) · not drawn 53.3% (257 games)". */
export const ratesWords = (r: NonNullable<FindingDetail['rates']>): string => `${r.aLabel} ${pct(r.a)} (${plural(r.aGames, 'game')}) · ${r.bLabel} ${pct(r.b)} (${plural(r.bGames, 'game')})`;

/** The words a card row shows from SELLS_SHARE on (src/lib/sellShare.ts). */
export const SELLS_THIS = 'the bot sells this';

/**
 * A card's sells beside its association (the second line): "sold in 97% of 748 uses from hand: the bot sells this", or
 * "sold in 41% of 520 uses from hand"; under MIN_SELL_USES uses the count alone, never flagged.
 */
export function soldWords(s: NonNullable<FindingDetail['sold']>): string {
  if (s.of < MIN_SELL_USES) return `sold ${s.n} of ${plural(s.of, 'use')} from hand`;
  const share = s.n / s.of;
  return `sold in ${pct(share)} of ${plural(s.of, 'use')} from hand${share >= SELLS_SHARE ? `: ${SELLS_THIS}` : ''}`;
}

/** Where a card's sells come from and what they say (its Details). */
export function soldSourceWords(s: NonNullable<FindingDetail['sold']>): string {
  const run = `the ${botName(s.bot)} bot’s run${s.date ? ` of ${s.date.slice(0, 10)}` : ''} (simulator version ${s.simVersion})`;
  return `Sells: from the decision telemetry of ${run}, the share of its uses from hand (plays, sells, and a Program’s reactions) that were sells. From ${Math.round(SELLS_SHARE * 100)}% on the row says “${SELLS_THIS}”: no bot keeps Eddies ready for the rival’s turn, so for such a card the figures above say how the bot plays it, not how good the card is.`;
}

/** The matchup spread the ranges allow for. */
export const spreadWords = (sd: number, measured: boolean): string =>
  `A matchup’s range allows for pairings sitting about ${(sd * 100).toFixed(1)} points from the ratings’ prediction${measured ? ', the spread measured on the meta decks’ 200-game pairings' : ', a default: it could not be measured'}.`;

/** What a family line means. */
export const FAMILY_HELP =
  'Rows tested together form a family. With many rows, a few intervals exclude “no difference” by chance alone, so a family’s table says how many rows it was ranked from and about how many such rows chance would give.';

/** A deck's findings counted by strength: "55 findings: 44 strong, 2 moderate, 9 weak." */
export function countsWords(counts: Readonly<Record<Strength, number>>, total: number): string {
  const order: Strength[] = ['strong', 'moderate', 'weak', 'no-difference', 'not-enough'];
  const parts = order.filter((s) => counts[s] > 0).map((s) => `${thousands(counts[s])} ${STRENGTH_WORDS[s]}`);
  return `${plural(total, 'finding')}${parts.length ? `: ${parts.join(', ')}` : ''}.`;
}

/** While a file loads. */
export const LOADING_EVIDENCE = 'Loading the evidence…';

/** The page's plain sentences for what could not be shown. */
export const EVIDENCE_PROBLEMS = {
  missingIndex: 'The evidence could not be loaded: its index is missing from this copy of the site, or the connection failed.',
  missingDeckFile: 'The evidence for this deck could not be loaded: its file is missing, or the connection failed.',
  unknownList: (listId: string) => `There is no evidence for the list ${listId}: the link may be old, or the list has changed since the findings were built.`,
  unknownFile: (file: string) => `No deck file “${file}” has evidence.`,
  newer: 'This evidence was made by a newer version of the site: reload the page to get it.',
  missingRuns: 'The recorded runs for this list could not be loaded.',
  unknownRun: 'This run is not among the list’s recorded runs: the link may be old.',
  badCite: 'That is not a finding id: one looks like F:9f3a2c1d.',
  unknownCite: (short: string) => `No finding has the id F:${short}.`,
  unknownFinding: (short: string) => `This deck has no finding F:${short}.`,
  missingIds: 'The list of finding ids could not be loaded.',
} as const;
