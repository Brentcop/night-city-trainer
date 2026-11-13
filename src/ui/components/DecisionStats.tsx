// The Card stats page's Decisions view: how each card was used (played, sold, called, Go Solo, ordinary Legend play,
// ability, attack, reaction), how often it was legal but not taken, and win rates by game stage and Gig standing, each
// with its sample and 95% interval. It reads public/data/decisions.json (written by `npm run sim -- analyze
// --decisions`) on first open; this file is loaded lazily, so none of it is in the entry chunk. With no report it says
// how to make one. The numbers are descriptive association, not the value of a card (src/analysis/decisions.ts).
import { useEffect, useMemo, useState } from 'react';
import { modeText, STAGES, STANDINGS, type CardReport, type DecisionReport, type ModeReport, type Slice } from '../../analysis/decisions';
import { DECISION_TELEMETRY_SCHEMA } from '../../engine/telemetry';
import { CardMention } from './CardMention';

export type Loaded = { state: 'loading' } | { state: 'missing' } | { state: 'stale'; schema: unknown } | { state: 'ready'; report: DecisionReport };

/** What a fetched decisions.json holds: a report this code reads, one from another telemetry schema, or nothing usable. */
export function readReport(j: unknown): Loaded {
  const r = j as DecisionReport | null;
  if (!r || typeof r !== 'object' || r.kind !== 'decision-telemetry' || !Array.isArray(r.decks)) return { state: 'missing' };
  if (r.telemetrySchema !== DECISION_TELEMETRY_SCHEMA) return { state: 'stale', schema: r.telemetrySchema };
  return { state: 'ready', report: r };
}

let file: Promise<Loaded> | null = null;
function loadReport(): Promise<Loaded> {
  file ??= fetch(`${import.meta.env.BASE_URL}data/decisions.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then(readReport)
    .catch((): Loaded => ({ state: 'missing' }));
  return file;
}

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

/** A win rate with its interval and sample, or the sample alone (dotted underline) when it is thin. */
export function SliceCell({ s }: { s: Slice }) {
  if (!s.games) return <span className="muted">—</span>;
  const uses = `${s.uses} use${s.uses === 1 ? '' : 's'} in ${s.games} game${s.games === 1 ? '' : 's'}`;
  if (s.thin) {
    return (
      <span className="num thin" title={`${uses}: too few games for a win rate (small sample)`}>
        n={s.games}
      </span>
    );
  }
  return (
    <span title={`${uses}; 95% interval ${pct(s.low95)}–${pct(s.high95)}`}>
      <span className="num">{pct(s.winRate)}</span>{' '}
      <span className="muted small num">
        {Math.round(s.low95! * 100)}–{Math.round(s.high95! * 100)} · n={s.games}
      </span>
    </span>
  );
}

function CardTable({ cards, caption }: { cards: CardReport[]; caption: string }) {
  const rows = cards.flatMap((c) => c.modes.map((m) => ({ c, m }))).sort((a, b) => b.m.all.uses - a.m.all.uses || a.c.name.localeCompare(b.c.name));
  if (!rows.length) return <p className="muted">No card uses recorded.</p>;
  return (
    <div className="scroll-x">
      <table className="small">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Card</th>
            <th scope="col">Use</th>
            <th scope="col" title="Times chosen">Uses</th>
            <th scope="col" title="Win rate in the games where the card was used this way, with its 95% interval and the number of games">Won when used</th>
            <th scope="col" title="Turns (attacks, for reactions) in which this use was legal → in which it was taken">Legal → used</th>
            <th scope="col" title="Share of those turns in which it was legal but not taken">Not taken</th>
            {STAGES.map((s) => (
              <th scope="col" key={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </th>
            ))}
            {STANDINGS.map((s) => (
              <th scope="col" key={s} title={`Decisions made while ${s} on Gigs`}>
                {s[0].toUpperCase() + s.slice(1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ c, m }) => (
            <ModeRow key={`${c.id}|${m.mode}`} c={c} m={m} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModeRow({ c, m }: { c: CardReport; m: ModeReport }) {
  return (
    <tr>
      <th scope="row" style={{ fontWeight: 'normal' }}>
        <CardMention id={c.id}>{c.name}</CardMention>
      </th>
      <td>
        {modeText(m.mode)}
        {m.selfPaid > 0 && <span className="muted"> · self-paid {m.selfPaid}</span>}
      </td>
      <td className="num">{m.all.uses}</td>
      <td>
        <SliceCell s={m.all} />
      </td>
      <td className="num">
        {m.windows} → {m.windowsUsed}
      </td>
      <td className="num">{pct(m.notChosenRate)}</td>
      {STAGES.map((s) => (
        <td key={s}>
          <SliceCell s={m.stage[s]} />
        </td>
      ))}
      {STANDINGS.map((s) => (
        <td key={s}>
          <SliceCell s={m.standing[s]} />
        </td>
      ))}
    </tr>
  );
}

/** Fetches the report once, then shows it (or says how to make one). */
export function DecisionStats({ deck, listId }: { deck?: string; listId?: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  useEffect(() => {
    let live = true;
    void loadReport().then((x) => live && setLoaded(x));
    return () => {
      live = false;
    };
  }, []);
  return <DecisionReportView loaded={loaded} deck={deck} listId={listId} />;
}

/** The view itself, for a report already read; `deck` / `listId` pick the deck shown first. */
export function DecisionReportView({ loaded, deck, listId }: { loaded: Loaded; deck?: string; listId?: string }) {
  const [pick, setPick] = useState<string | null>(null);
  const [pooled, setPooled] = useState(false);
  const report = loaded.state === 'ready' ? loaded.report : null;
  const current = useMemo(() => {
    if (!report) return undefined;
    const id = pick ?? report.decks.find((d) => (listId && d.listId === listId) || d.name === deck)?.listId ?? report.decks[0]?.listId;
    return report.decks.find((d) => d.listId === id);
  }, [report, pick, deck, listId]);

  if (loaded.state === 'loading') return <p className="muted">Loading the decisions report…</p>;
  if (loaded.state !== 'ready')
    return (
      <div className="empty-state">
        <h2>No decisions report</h2>
        <p>
          {loaded.state === 'stale'
            ? `The bundled report uses telemetry schema ${String(loaded.schema)}; this site reads schema ${DECISION_TELEMETRY_SCHEMA}. Re-run the analysis to refresh it.`
            : 'Nothing has recorded decision telemetry for this site yet.'}{' '}
          It is made by <code>npm run sim -- analyze --decisions</code>, which records every decision the bots make (the legal options, the choice, what it
          cost and the public board) and writes <code>public/data/decisions.json</code>.
        </p>
      </div>
    );
  const r = report!;
  const m = r.manifest;
  return (
    // minmax(0, 1fr): the wide card table scrolls inside its .scroll-x instead of widening the page
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <p className="muted small">
        {r.games.toLocaleString()} bot games · {r.records.toLocaleString()} decisions
        {m && (
          <>
            {' '}
            · sim v{m.simVersion} · {m.bot.level} bot · seed {m.seedBase} · {m.createdAt.slice(0, 10)}
          </>
        )}{' '}
        · telemetry schema {r.telemetrySchema}
      </p>
      <p className="small">
        <b>Association, not value.</b> {r.note} Slices with fewer than {r.minSliceGames} games show only their size, underlined. Stages: early {r.stages.early},
        middle {r.stages.middle}, late {r.stages.late}; ahead / even / behind compares Gig counts when the decision was made.
      </p>
      <div className="row">
        <label className="row small">
          <span>Deck</span>
          <select value={current?.listId ?? ''} onChange={(e) => setPick(e.target.value)} disabled={pooled}>
            {r.decks.map((d) => (
              <option key={d.listId} value={d.listId}>
                {d.name} ({d.games} games)
              </option>
            ))}
          </select>
        </label>
        <div className="seg" role="group" aria-label="Which games">
          <button type="button" className={!pooled ? 'on' : ''} aria-pressed={!pooled} onClick={() => setPooled(false)}>
            This list
          </button>
          <button type="button" className={pooled ? 'on' : ''} aria-pressed={pooled} onClick={() => setPooled(true)}>
            All lists pooled
          </button>
        </div>
      </div>
      {pooled ? (
        <div>
          <h3 className="rule-head">Card uses, every list pooled</h3>
          <p className="muted small">More games per slice, but different decks mixed together; counts are per player-game.</p>
          <CardTable cards={r.pooled} caption="Card uses, every list pooled" />
        </div>
      ) : current ? (
        <>
          <div>
            <h3 className="rule-head">
              Card uses · {current.name} · {current.games} games, {pct(current.winRate)} won
            </h3>
            <CardTable cards={current.cards} caption={`Card uses for ${current.name}`} />
          </div>
          <div className="grid cols-2">
            <div className="scroll-x">
              <h3 className="rule-head">Decision types</h3>
              <table className="small">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Decisions</th>
                    <th scope="col" title="Pass, no more reactions, Yes, the automatic payment source, queue order…">First option taken</th>
                  </tr>
                </thead>
                <tbody>
                  {current.decisionTypes.map((t) => (
                    <tr key={t.type}>
                      <th scope="row" style={{ fontWeight: 'normal' }}>
                        <code>{t.type}</code>
                      </th>
                      <td className="num">{t.decisions}</td>
                      <td className="num">{pct(t.firstChosenRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="rule-head">Reaction window</h3>
              {current.reactions.windows ? (
                <ul className="small">
                  <li>
                    Asked to react to {current.reactions.windows} attacks; reacted to {current.reactions.reacted.uses}, let {current.reactions.letResolve.uses} resolve.
                  </li>
                  <li>
                    Won when it reacted: <SliceCell s={current.reactions.reacted} />; when it let attacks resolve: <SliceCell s={current.reactions.letResolve} />
                  </li>
                  <li>
                    Choices:{' '}
                    {Object.entries(current.reactions.choices)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(', ')}
                  </li>
                </ul>
              ) : (
                <p className="muted small">Never asked to react.</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="muted">This report has no decks.</p>
      )}
    </div>
  );
}
