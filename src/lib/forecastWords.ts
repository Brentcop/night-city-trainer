// The regionals forecast's sentences (src/lib/forecast.ts), one place for the page (#/forecast) and the command line
// (scripts/forecast.ts), so both say the same thing about what the numbers are and are not.
import { SENSITIVITY_SHARE, type DeckForecast, type ForecastResult, type ForecastSource, type ForecastTournament, type Range } from './forecast';

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

/** "Ratings of events 20–24 (4,084 games), simulator v9, Hard bot, from h2h.json" */
export function sourceWords(s: ForecastSource): string {
  const ids = s.events.map(String);
  const nums = s.events.every((e) => typeof e === 'number') ? (s.events as number[]) : null;
  const consecutive = nums && nums.length > 2 && nums.every((x, i) => i === 0 || x === nums[i - 1]! + 1);
  const evs = !ids.length ? 'no events' : ids.length === 1 ? `event ${ids[0]}` : consecutive ? `events ${ids[0]} to ${ids.at(-1)}` : `events ${ids.join(', ')}`;
  const bot = s.bot === 'hard' ? 'the Hard bot' : `the ${s.bot} bot`;
  return `power ratings and head-to-heads of ${evs} (${s.games.toLocaleString('en-US')} games), simulator v${s.simVersion ?? '?'}, ${bot}`;
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
