// How a finding is put into words (src/lib/findings.ts holds the model): the one-line claim, the strength and nature
// chips, what each flag means, why an association may mislead, and the notes on what is not measured. Pure and light
// (no engine, no bots), so a page and the builder (scripts/build-evidence.ts) word a finding the same way.
//
// The words follow the three natures: only an effect (a paired comparison of two lists) may say "adds" or "costs"; a
// result says what the recorded games show; an association says "games where X was drawn were won more often" and always
// carries the reason it may mislead (tests/findings.test.ts checks no association claim uses a causal word).
import { citeLine, formatValue, unitOf, type Finding, type FindingDetail, type FlagCode, type GapNote, type Nature, type Strength } from './findings';

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
    'The plain 95% interval excludes "no difference", the family test passes, the effect is at least a point, there are enough games (1,000 paired, 200 rated or split), it was measured under the current simulator, and it is not an association.',
  moderate: 'The plain 95% interval excludes "no difference", but one of the conditions for strong is missing.',
  weak: 'The estimate is a point or more from "no difference", but the 95% interval still includes it.',
  'no-difference': 'Measured, and the 95% interval keeps it within two points of "no difference": no difference of a point or more.',
  'not-enough': 'Too few games for a number (200 paired, 20 rated games, 20 on each side), or an estimate under a point with an interval wider than ±2 points.',
};

/** Words for each flag code. */
export const FLAG_WORDS: Readonly<Record<FlagCode, string>> = {
  stale: 'Measured under an older simulator version; the bots have changed since, so it is not re-measured and never strong.',
  'medium-only': 'Measured with the Medium bot only; Hard not measured.',
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
export function sentenceOf(f: SentenceInput): string {
  const u = unitOf(f.kind);
  const v = (x: number) => formatValue(x, u);
  const range = `${f.sequential ? 'corrected 95' : f.level === 0.9 ? '90' : '95'}% range ${v(f.lower)} to ${v(f.upper)}`;
  const rated = f.kind === 'matchup' && f.method !== 'direct-games';
  const games = rated ? '' : `${thousands(f.games)} ${f.nature === 'effect' ? 'paired ' : ''}games`;
  const inside = games ? `${range}, ${games}` : range;
  const tail = rated ? `, from the ratings; ${directWords(f)}` : '';
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
  const note = f.strength === 'weak' ? '; the interval still includes no difference' : f.nature === 'effect' && !f.corrected ? '; only the uncorrected interval excludes no difference' : '';
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
    measure: 'npx tsx scripts/forge.ts <deck> --ledger (Medium), or a re-measurement into data/evidence/.',
  },
  'season1-no-interval': {
    text: 'Season 1 forge confirmations recorded win rates only (the any-gain rule): no paired interval, so they are listed as runs, not findings.',
    measure: 'Re-measure the adopted change paired (data/evidence/).',
  },
  'no-hard-changes': {
    text: 'Every change measured for this list was measured with the Medium bot; none with Hard.',
    measure: 'A Hard re-measurement of the change (data/evidence/).',
  },
  'other-list-events': {
    text: 'Some recorded games were played with another list of this deck; results use them as the deck.',
    measure: 'Record new events with the current list.',
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
