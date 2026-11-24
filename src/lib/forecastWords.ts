// The regionals forecast's sentences (src/lib/forecast.ts), one place for the page (#/forecast) and the command line
// (scripts/forecast.ts), so both say the same thing about what the numbers are and are not.
import { SENSITIVITY_SHARE, type DeckForecast, type ForecastResult, type ForecastSource, type ForecastTournament, type Range } from './forecast';
import { CURRENT_SIM_VERSION } from './playedRecord';

export const pct = (x: number, digits = 1) => (Number.isFinite(x) ? `${(100 * x).toFixed(digits)}%` : '—');
const pts = (x: number, digits = 1) => (Math.abs(100 * x) < 0.05 ? 'under 0.1' : `${x >= 0 ? '+' : '−'}${Math.abs(100 * x).toFixed(digits)}`);
/** "38.2% (26.1–51.0)" */
export const rangeText = (r: Range, digits = 1) => (Number.isFinite(r.mean) ? `${pct(r.mean, digits)} (${(100 * r.lo).toFixed(digits)}–${(100 * r.hi).toFixed(digits)})` : '—');

export const FORECAST_WORDS = {
  what: 'A forecast from our simulated ratings under the Hard bot and the field you chose, not a prediction of human results.',
  ranges:
    'Each range is the 90% range across the parameter draws: what we do not know about the decks’ strength from the recorded games. It does not include model error (a matchup that differs from what the ratings and the head-to-head records say) or how people play compared with the Hard bot, so the real uncertainty is wider.',
  leftOut: 'Players the field could not place on a rated deck are left out, not given a stand-in deck: we have no rating for them. The forecast is the placed part of the field, renormalised.',
  decides: `What decides it: the opponents whose share of the field moves the deck’s chance to make the cut most, with its chance to win a match against each. The change is a first-order estimate for ${100 * SENSITIVITY_SHARE} more points of that opponent’s share (from how often the deck meets it in the Swiss rounds and the value of a match win), not a re-run.`,
} as const;

/** "1 to 5", "3", "2, 4, 7": a list of numbers, as a range when it runs without a gap. */
function numberList(nums: readonly number[]): string {
  const consecutive = nums.length > 2 && nums.every((x, i) => i === 0 || x === nums[i - 1]! + 1);
  return nums.length === 1 ? String(nums[0]) : consecutive ? `${nums[0]} to ${nums.at(-1)}` : nums.join(', ');
}

/** "Ratings of events 20–24 (4,084 games), simulator v9, Hard bot, from h2h.json"; rating runs ("run-3") are named apart. */
export function sourceWords(s: ForecastSource): string {
  const run = /^run-(\d+)$/;
  const runs = s.events.filter((e) => typeof e === 'string' && run.test(e)).map((e) => Number(run.exec(String(e))![1]));
  const events = s.events.filter((e) => !(typeof e === 'string' && run.test(e)));
  const nums = events.every((e) => typeof e === 'number') ? (events as number[]) : null;
  const evs = !events.length ? 'no events' : events.length === 1 ? `event ${events[0]}` : nums ? `events ${numberList(nums)}` : `events ${events.join(', ')}`;
  const rs = runs.length ? ` and rating run${runs.length === 1 ? '' : 's'} ${numberList(runs)}` : '';
  const bot = s.bot === 'hard' ? 'the Hard bot' : `the ${s.bot} bot`;
  return `power ratings and head-to-heads of ${evs}${rs} (${s.games.toLocaleString('en-US')} games), simulator v${s.simVersion ?? '?'}, ${bot}`;
}

/**
 * The note for a model fitted on another simulator version than the current one (null when they match, so nothing is
 * added then); a file that names no version counts as another one. The page shows it above the form and with the
 * results, the command line prints it as a warning line.
 */
export function forecastVersionNote(s: Pick<ForecastSource, 'simVersion'>, current: number = CURRENT_SIM_VERSION): string | null {
  if (s.simVersion === current) return null;
  return `The ratings behind this forecast were fitted on ${s.simVersion === null ? 'an unversioned simulator' : `simulator v${s.simVersion}`}, not the current v${current}, so the forecast is historical.`;
}

export function tournamentWords(t: ForecastTournament): string {
  return `${t.players} players, ${t.rounds} Swiss round${t.rounds === 1 ? '' : 's'} best of ${t.bestOf}${t.top ? `, top ${t.top}${t.playCut ? ' played as single elimination' : ''}` : ', no cut'}`;
}

export function runWords(r: ForecastResult): string {
  const games = r.drawsDone * r.trials;
  return `${r.drawsDone}${r.drawsDone < r.draws ? ` of ${r.draws}` : ''} parameter draws × ${r.trials} tournaments each (${games.toLocaleString('en-US')} tournaments), seed ${r.seed}${r.uncertainty ? '' : ', no parameter uncertainty'}`;
}

/** "Ladder S1 #2 (wins 47% of matches, 38–55; −1.2 pts)" for the first `n` deciders. */
export function decidesWords(d: DeckForecast, n = 3): string {
  if (!d.decides.length) return 'No opponent in this field costs it much.';
  return d.decides
    .slice(0, n)
    .map((x) => `${x.name} (wins ${pct(x.matchWin.mean, 0)} of matches, ${(100 * x.matchWin.lo).toFixed(0)}–${(100 * x.matchWin.hi).toFixed(0)}; ${pts(x.perShare)} pts)`)
    .join(', ');
}

/** How wide the ranges are, in one line. */
export function widthWords(r: ForecastResult): string {
  const noise = r.decks.map((d) => d.noiseShare).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const med = noise.length ? noise[Math.floor(noise.length / 2)]! : Number.NaN;
  return `The median range of a deck's chance to make the cut is ${Number.isFinite(r.medianWidth) ? r.medianWidth.toFixed(1) : '—'} points wide; sampling noise of the ${r.trials} tournaments a draw is about ${pct(med, 0)} of its spread (median over decks), the rest is the ratings' uncertainty.`;
}
