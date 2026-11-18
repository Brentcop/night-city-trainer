// Regionals forecast (#/forecast, Tournaments → Regionals forecast; feature `forecast`, off by default; docs/FORECAST.md):
// each deck's chance to make a top cut of a Swiss tournament of N players drawn from a field you choose, with 90%
// ranges from the ratings' uncertainty, and the opponents that decide it. The engine is src/lib/forecast.ts (pure); it
// runs here in slices of a few tens of milliseconds between paints, so the page stays responsive and can be stopped.
// The ratings come from public/data/h2h.json (fetched when the page opens), the same file the command line reads
// (scripts/forecast.ts), so the same settings and seed give the same numbers.
import { useEffect, useMemo, useRef, useState } from 'react';
import '../forecast.css';
import { PageHead } from '../components/PageHead';
import { BUILTIN } from '../../lib/browserLibrary';
import { CURRENT_SIM_VERSION } from '../../lib/playedRecord';
import { defaultRounds, FORECAST_DEFAULTS, ForecastRun, modelFromH2HFile, tournamentOf, type DeckForecast, type ForecastModel, type ForecastResult, type H2HForecastFile } from '../../lib/forecast';
import { FieldError, fieldText, outsideField, uniformField, userField, type ForecastFieldInput } from '../../lib/forecastField';
import { decidesWords, FORECAST_WORDS, pct, rangeText, runWords, sourceWords, tournamentWords, widthWords } from '../../lib/forecastWords';
import { OUTSIDE_META } from '../../data/outsideMetaData';
import { sourceTitle } from '../../lib/outsideMeta';

/** How many parameter draws and tournaments a run takes. Standard is the command line's default. */
export const PRECISION = {
  quick: { draws: 40, trials: 150, label: 'Quick (40 draws × 150 tournaments)' },
  standard: { draws: FORECAST_DEFAULTS.draws, trials: FORECAST_DEFAULTS.trials, label: `Standard (${FORECAST_DEFAULTS.draws} × ${FORECAST_DEFAULTS.trials}, as the command line)` },
  fine: { draws: 200, trials: 600, label: 'Fine (200 × 600, about 8 times as long)' },
} as const;
type Precision = keyof typeof PRECISION;
const CUTS = [2, 4, 8, 16, 32, 64, 128] as const;

let h2hFile: Promise<H2HForecastFile | null> | null = null;
function loadH2H(): Promise<H2HForecastFile | null> {
  h2hFile ??= fetch(`${import.meta.env.BASE_URL}data/h2h.json`)
    .then((r) => (r.ok ? (r.json() as Promise<H2HForecastFile>) : null))
    .then((f) => (f && Array.isArray(f.decks) && Array.isArray(f.pairs) && f.model ? f : null))
    .catch(() => null);
  return h2hFile;
}

type RunState =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number; field: ForecastFieldInput }
  | { status: 'done' | 'stopped'; result: ForecastResult | null; field: ForecastFieldInput }
  | { status: 'error'; message: string; problems: string[] };

export function ForecastPage() {
  const [file, setFile] = useState<H2HForecastFile | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void loadH2H().then((f) => live && setFile(f));
    return () => {
      live = false;
    };
  }, []);
  const model = useMemo(() => {
    if (!file) return null;
    try {
      return modelFromH2HFile(file);
    } catch {
      return null;
    }
  }, [file]);
  return (
    <div className="grid forecast-page">
      <PageHead kicker="Tournaments" title="Regionals forecast">
        <b>{FORECAST_WORDS.what}</b> For a tournament you describe and a field you choose, each deck’s chance to make the top cut, with a 90% range, and the
        opponents that decide it. Nothing here is a measured picture of what people play: the field is yours to set, and the page always says which one it used.
      </PageHead>
      {file === undefined ? (
        <p className="muted" aria-live="polite">
          Loading the ratings…
        </p>
      ) : !model ? (
        <div className="panel">
          <h2>No ratings to forecast from</h2>
          <p className="muted">The head-to-head file (data/h2h.json) did not load or has no model block, so there is nothing to forecast from.</p>
        </div>
      ) : (
        <ForecastTool model={model} />
      )}
    </div>
  );
}

function ForecastTool({ model }: { model: ForecastModel }) {
  const [players, setPlayers] = useState('128');
  const [rounds, setRounds] = useState('');
  const [bestOf, setBestOf] = useState<1 | 3>(3);
  const [top, setTop] = useState(8);
  const [kind, setKind] = useState<'uniform' | 'user' | 'outside'>('uniform');
  const [text, setText] = useState('');
  const sources = OUTSIDE_META?.sources ?? [];
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [precision, setPrecision] = useState<Precision>('standard');
  const [seed, setSeed] = useState(String(FORECAST_DEFAULTS.seed));
  const [state, setState] = useState<RunState>({ status: 'idle' });
  const stopRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      stopRef.current = true;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const n = Math.floor(Number(players));
  const playersOk = Number.isFinite(n) && n >= 8 && n <= 1024;
  const autoRounds = playersOk ? defaultRounds(n) : null;
  const roundsN = rounds.trim() ? Math.floor(Number(rounds)) : autoRounds;
  const roundsOk = roundsN !== null && Number.isFinite(roundsN) && roundsN >= 1 && roundsN <= 20;
  const seedN = Math.floor(Number(seed));
  const seedOk = seed.trim() !== '' && Number.isFinite(seedN) && seedN >= 0;
  const running = state.status === 'running';

  const start = () => {
    let field: ForecastFieldInput;
    try {
      field =
        kind === 'uniform'
          ? uniformField(model.names)
          : kind === 'user'
            ? userField(model.names, text)
            : outsideField(
                model.names,
                BUILTIN,
                sources.find((s) => s.id === sourceId) ?? sources[0]!,
              );
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e), problems: e instanceof FieldError ? e.problems : [] });
      return;
    }
    const t = tournamentOf({ players: n, rounds: roundsN ?? undefined, bestOf, top, playCut: true });
    const p = PRECISION[precision];
    const run = new ForecastRun(model, { weights: field.weights }, t, { draws: p.draws, trials: p.trials, seed: seedN });
    stopRef.current = false;
    setState({ status: 'running', done: 0, total: run.total, field });
    const tick = () => {
      const t0 = performance.now();
      while (!stopRef.current && performance.now() - t0 < 40 && run.step());
      if (stopRef.current) {
        setState({ status: 'stopped', result: run.done ? run.result() : null, field });
        return;
      }
      if (run.finished) {
        setState({ status: 'done', result: run.result(), field });
        return;
      }
      setState({ status: 'running', done: run.done, total: run.total, field });
      timer.current = setTimeout(tick, 0);
    };
    timer.current = setTimeout(tick, 0);
  };

  const fillUniform = () => setText(fieldText(model.names, uniformField(model.names).weights));
  const historical = model.source.simVersion !== null && model.source.simVersion !== CURRENT_SIM_VERSION;

  return (
    <>
      <form
        className="panel forecast-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!running && playersOk && roundsOk && seedOk) start();
        }}
      >
        <fieldset disabled={running}>
          <legend>The tournament</legend>
          <div className="forecast-fields">
            <label>
              Players
              <input type="number" inputMode="numeric" min={8} max={1024} value={players} onChange={(e) => setPlayers(e.target.value)} aria-invalid={!playersOk} />
            </label>
            <label>
              Swiss rounds
              <input type="number" inputMode="numeric" min={1} max={20} value={rounds} placeholder={autoRounds ? `${autoRounds} (auto)` : 'auto'} onChange={(e) => setRounds(e.target.value)} aria-invalid={!roundsOk} />
            </label>
            <label>
              Matches
              <select value={bestOf} onChange={(e) => setBestOf(Number(e.target.value) as 1 | 3)}>
                <option value={3}>Best of 3</option>
                <option value={1}>Best of 1</option>
              </select>
            </label>
            <label>
              Top cut
              <select value={top} onChange={(e) => setTop(Number(e.target.value))}>
                {CUTS.filter((c) => !playersOk || c <= n).map((c) => (
                  <option key={c} value={c}>
                    Top {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted small">
            Rounds left empty: {autoRounds ?? '—'}, ⌈log₂ players⌉, enough for one undefeated player (the event’s own count may differ). Pairing, tie-breaks and the cut follow our events’ rules: points, then
            opponents’ match-win %, then game-win %. The cut is played as single elimination for a title chance.
          </p>
          {!playersOk && <p className="forecast-problem">Players: a whole number from 8 to 1,024.</p>}
          {!roundsOk && <p className="forecast-problem">Swiss rounds: a whole number from 1 to 20.</p>}
        </fieldset>
        <fieldset disabled={running}>
          <legend>The field</legend>
          <div className="forecast-choices" role="radiogroup" aria-label="Field">
            <label className="row">
              <input type="radio" name="forecast-field" checked={kind === 'uniform'} onChange={() => setKind('uniform')} />
              <span>
                <b>Uniform</b>: each of our {model.names.length} rated decks equally often. <span className="muted">Assumed: no information about what people play.</span>
              </span>
            </label>
            <label className="row">
              <input type="radio" name="forecast-field" checked={kind === 'user'} onChange={() => setKind('user')} />
              <span>
                <b>Your field</b>: one <code>deck name: weight</code> per line. Decks you leave out weigh 0; weights are relative.
              </span>
            </label>
            {sources.length > 0 && (
              <label className="row">
                <input type="radio" name="forecast-field" checked={kind === 'outside'} onChange={() => setKind('outside')} />
                <span>
                  <b>An outside source’s shares</b>: its field by Legend trio, split equally among our decks of each trio.
                </span>
              </label>
            )}
          </div>
          {kind === 'user' && (
            <div className="forecast-user">
              <textarea
                aria-label="Your field, one deck name: weight per line"
                rows={8}
                value={text}
                spellCheck={false}
                placeholder={`${model.names[0]}: 12\n${model.names[1]}: 8\n…`}
                onChange={(e) => setText(e.target.value)}
              />
              <button type="button" className="btn" onClick={fillUniform}>
                Start from every deck at the same weight
              </button>
            </div>
          )}
          {kind === 'outside' && sources.length > 0 && (
            <label>
              Source{' '}
              <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {sourceTitle(s)}, collected {s.collected}
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>
        <fieldset disabled={running}>
          <legend>Precision</legend>
          <div className="forecast-fields">
            <label>
              Run
              <select value={precision} onChange={(e) => setPrecision(e.target.value as Precision)}>
                {(Object.keys(PRECISION) as Precision[]).map((k) => (
                  <option key={k} value={k}>
                    {PRECISION[k].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Seed
              <input type="number" inputMode="numeric" min={0} value={seed} onChange={(e) => setSeed(e.target.value)} aria-invalid={!seedOk} />
            </label>
          </div>
        </fieldset>
        <div className="row">
          <button type="submit" className="btn primary" disabled={running || !playersOk || !roundsOk || !seedOk}>
            Run the forecast
          </button>
          {running && (
            <button type="button" className="btn" onClick={() => (stopRef.current = true)}>
              Stop
            </button>
          )}
          <span className="muted small" aria-live="polite">
            {state.status === 'running' ? `Draw ${state.done} of ${state.total}…` : state.status === 'stopped' ? 'Stopped.' : ''}
          </span>
        </div>
      </form>
      {state.status === 'error' && (
        <div className="panel" role="alert">
          <h2>The field could not be used</h2>
          <p>{state.message}</p>
          {state.problems.length > 0 && (
            <ul className="small">
              {state.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {(state.status === 'done' || state.status === 'stopped') && state.result && (
        <ForecastResults result={state.result} field={state.field} names={model.names} historical={historical} />
      )}
      {(state.status === 'done' || state.status === 'stopped') && state.field.problems.length > 0 && (
        <div className="panel small">
          <b>Notes on your field:</b>
          <ul>
            {state.field.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

type SortKey = 'deck' | 'share' | 'conversion' | 'any' | 'seats' | 'title';
const SORT_LABEL: Record<SortKey, string> = { deck: 'Deck', share: 'Share of the field', conversion: 'Makes the cut (one player)', any: 'At least one in the cut', seats: 'Share of the cut', title: 'Wins the event' };
const value = (d: DeckForecast, k: SortKey): number | string =>
  k === 'deck' ? d.name : k === 'share' ? d.weight : k === 'conversion' ? d.conversion.mean : k === 'any' ? d.anyInCut.mean : k === 'seats' ? d.cutShare.mean : (d.title?.mean ?? 0);

/** The sources, the field and the table of one finished (or stopped) run. */
export function ForecastResults({ result, field, names, historical = false }: { result: ForecastResult; field: ForecastFieldInput; names: readonly string[]; historical?: boolean }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'conversion', dir: 'desc' });
  const files = useMemo(() => new Map(BUILTIN.map((d) => [d.deck.name, d.file])), []);
  const rows = useMemo(() => {
    const out = [...result.decks];
    out.sort((a, b) => {
      const x = value(a, sort.key);
      const y = value(b, sort.key);
      const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
      return (sort.dir === 'asc' ? c : -c) || a.name.localeCompare(b.name);
    });
    return out;
  }, [result, sort]);
  const head = (key: SortKey) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-sort" onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'deck' ? 'asc' : 'desc' }))}>
        {SORT_LABEL[key]}
        <span aria-hidden="true">{sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
      </button>
    </th>
  );
  const top = [...field.weights.map((w, k) => ({ name: names[k]!, w }))].filter((x) => x.w > 0).sort((a, b) => b.w - a.w || a.name.localeCompare(b.name));
  const lo = 0;
  const hiX = Math.max(0.05, ...result.decks.map((d) => d.conversion.hi));
  const x = (v: number) => `${((Math.min(hiX, Math.max(lo, v)) - lo) / (hiX - lo)) * 100}%`;
  return (
    <>
      <section className="panel forecast-sources" aria-labelledby="forecast-sources-h">
        <h2 id="forecast-sources-h">What these numbers are</h2>
        <dl>
          <dt>Tournament</dt>
          <dd>{tournamentWords(result.tournament)}.</dd>
          <dt>Ratings</dt>
          <dd>
            {sourceWords(result.source)}.{historical && ' These games were recorded before the current simulator, so the forecast is historical.'}
          </dd>
          <dt>Field</dt>
          <dd>
            {field.label}. <span className="muted">Source: {field.source}.</span>
            {field.leftOutShare > 0 && <> Left out: {pct(field.leftOutShare)} of it.</>}
          </dd>
          <dt>Run</dt>
          <dd>
            {runWords(result)}.{result.drawsDone < result.draws && <b> Stopped early: the ranges rest on fewer draws.</b>}
          </dd>
        </dl>
        <p className="small">{FORECAST_WORDS.ranges}</p>
        <p className="small muted">{widthWords(result)}</p>
        <details className="small">
          <summary>
            The field’s weights ({top.length} deck{top.length === 1 ? '' : 's'}
            {field.leftOutShare > 0 ? `; ${pct(field.leftOutShare)} left out` : ''})
          </summary>
          <div className="scroll-x">
            <table className="small">
              <caption className="sr-only">Each deck’s share of the field used</caption>
              <thead>
                <tr>
                  <th scope="col">Deck</th>
                  <th scope="col">Share</th>
                  <th scope="col">Players expected</th>
                </tr>
              </thead>
              <tbody>
                {top.map((t) => (
                  <tr key={t.name}>
                    <td>{t.name}</td>
                    <td className="num">{pct(t.w)}</td>
                    <td className="num">{(t.w * result.tournament.players).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {field.leftOut.length > 0 && (
            <>
              <p>{FORECAST_WORDS.leftOut}</p>
              <ul>
                {field.leftOut.map((l) => (
                  <li key={`${l.name}|${l.why}`}>
                    {l.name}: {pct(l.share)} of the field, {l.why}
                  </li>
                ))}
              </ul>
            </>
          )}
        </details>
      </section>
      <section className="panel" aria-labelledby="forecast-table-h">
        <h2 id="forecast-table-h">Each deck’s chance</h2>
        <p className="small muted">{FORECAST_WORDS.decides}</p>
        <div className="scroll-x">
          <table className="small forecast-table">
            <caption className="sr-only">Each deck in the field: its share, its chance to make the top cut with the 90% range, and what decides it. Column headers sort the table.</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                {head('deck')}
                {head('share')}
                {head('conversion')}
                {head('any')}
                {head('seats')}
                {result.tournament.playCut && result.tournament.top >= 2 && head('title')}
                <th scope="col">What decides it</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d, i) => {
                const file = files.get(d.name);
                return (
                  <tr key={d.name}>
                    <td className="num">{i + 1}</td>
                    <th scope="row" className="forecast-deck">
                      {file ? <a href={`#/deck?d=${encodeURIComponent(file)}`}>{d.name}</a> : d.name}
                    </th>
                    <td className="num">
                      {pct(d.weight)}
                      <div className="muted">{d.expectedPlayers.toFixed(1)} players</div>
                    </td>
                    <td className="forecast-conv">
                      <div className="ci" aria-hidden="true">
                        <div className="ci-range" style={{ left: x(d.conversion.lo), width: `calc(${x(d.conversion.hi)} - ${x(d.conversion.lo)})` }} />
                        <div className="ci-dot" style={{ left: x(d.conversion.mean) }} />
                      </div>
                      <span className="num">{rangeText(d.conversion)}</span>
                    </td>
                    <td className="num">{rangeText(d.anyInCut)}</td>
                    <td className="num">{rangeText(d.cutShare)}</td>
                    {result.tournament.playCut && result.tournament.top >= 2 && <td className="num">{d.title ? rangeText(d.title) : '—'}</td>}
                    <td className="forecast-decides">{decidesWords(d, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
