// Run a tournament live in the browser: pick the field and format, watch Swiss rounds and the bracket fill in,
// then read the final stats and watch any finished match. Uses the same engine, bots and rules as scripts/tournament.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { RATINGS } from '../../data/index';
import { allDecks } from '../../lib/browserLibrary';
import type { LibraryDeck } from '../../lib/library';
import { autoRounds, cutSize, runTournament, type BotLevel, type GameRec, type TourneyConfig, type TourneyEvent } from '../../lib/tournament';
import { defaultThreads, errorText, isStopped } from '../../sim/pool';
import { download } from '../../lib/download';
import { usePoolRun } from '../usePoolRun';
import { parseRunParams, parseRuns, toEvent } from '../runParams';
import { TOURNEY_BOTS, tierLabel } from '../../ai/tiers';
import { ColorPips } from '../components/DeckIdentity';
import '../deckprofile.css';
import { StatTile } from '../components/DeckStats';
import { PageHead } from '../components/PageHead';
import { RecordedAt } from '../components/RecordedAt';
import { Bracket, Champion, MatchModal, RoundList, StandingsTable, useLib, type MatchView } from '../components/TourneyViews';

type FieldKey = 'meta' | 'ladder' | 'top16' | 'original' | 'guide' | 'all' | 'custom';
const FIELDS: { key: FieldKey; label: string; hint: string }[] = [
  { key: 'meta', label: 'choom.gg meta', hint: 'The tiered community decks' },
  { key: 'ladder', label: 'Sim ladder', hint: 'Master-rank Legend trios from cyberpunk-tcg-sim.online' },
  { key: 'top16', label: 'Top 16 rated', hint: 'Best 16 by power rating' },
  { key: 'original', label: 'Our originals', hint: 'NC customs + every bred season deck' },
  { key: 'guide', label: 'Guide lists', hint: 'Decks from choom.gg guides' },
  { key: 'all', label: 'Everything', hint: 'Every distinct deck in the library' },
  { key: 'custom', label: 'Pick decks', hint: 'Choose any decks below' },
];
const BOTS = TOURNEY_BOTS;
const SAVE_KEY = 'nct.runs.v1';

/** Every distinct deck (tournament "-eor" builds share their base deck's main list, so they are skipped). */
function distinct(lib: readonly LibraryDeck[]) {
  const seen = new Set<string>();
  return lib.filter((d) => {
    if (/-eor\.txt$/.test(d.file)) return false;
    const sig = [...d.deck.legends].sort().join(',') + '|' + [...d.deck.main].sort().join(',');
    if (seen.has(sig) || seen.has(`n:${d.deck.name}`)) return false;
    seen.add(sig);
    seen.add(`n:${d.deck.name}`);
    return true;
  });
}
function presetFiles(key: FieldKey, pool: LibraryDeck[]): string[] {
  if (key === 'all') return pool.map((d) => d.file);
  if (key === 'top16') {
    const R = RATINGS;
    const byName = new Map(pool.map((d) => [d.deck.name, d.file]));
    const top = R.decks.map((r) => byName.get(r.name)).filter((f): f is string => !!f);
    return (top.length >= 8 ? top : pool.filter((d) => d.kind === 'meta' || d.kind === 'original').map((d) => d.file)).slice(0, 16);
  }
  if (key === 'custom') return [];
  return pool.filter((d) => d.kind === key).map((d) => d.file);
}

function loadRuns(): TourneyEvent[] {
  try {
    return parseRuns(localStorage.getItem(SAVE_KEY));
  } catch {
    return [];
  }
}
function saveRun(ev: TourneyEvent) {
  try {
    const runs = [ev, ...loadRuns().filter((r) => r.id !== ev.id)].slice(0, 6);
    localStorage.setItem(SAVE_KEY, JSON.stringify(runs));
  } catch {
    /* storage full or blocked: the run is still on screen and can be downloaded */
  }
}

export function TournamentRunnerPage({ q }: { q: URLSearchParams }) {
  const lib = useLib();
  const pool = useMemo(() => distinct(allDecks()), []);
  // setup-link params are validated; anything malformed falls back to the defaults
  const params = useMemo(() => parseRunParams(q, BOTS.map((b) => b.key)), [q]);
  const [field, setField] = useState<FieldKey>(params.field);
  const [picked, setPicked] = useState<string[]>(() => params.decks ?? presetFiles(params.field, pool));
  const [roundsSel, setRoundsSel] = useState<number | 'auto'>(params.rounds);
  const [top, setTop] = useState(params.top);
  const [bestOf, setBestOf] = useState<1 | 3>(params.bestOf);
  const [bot, setBot] = useState<BotLevel>((params.bot as BotLevel | null) ?? 'medium');
  const [seed, setSeed] = useState(params.seed ?? Math.floor(Math.random() * 9000) + 1000);
  const [threads, setThreads] = useState(defaultThreads());
  const [filter, setFilter] = useState('');

  const [ev, setEv] = useState<TourneyEvent | null>(null);
  const [running, setRunning] = useState(false);
  const [t0, setT0] = useState(0);
  const [, tick] = useState(0);
  const [match, setMatch] = useState<(MatchView & { games: GameRec[] }) | null>(null);
  const [runs, setRuns] = useState<TourneyEvent[]>(loadRuns);
  /** why the last run ended early: stopped by you, or a game failed (with its error) */
  const [ended, setEnded] = useState<{ kind: 'stopped' | 'failed'; error?: string } | null>(null);
  const [fileMsg, setFileMsg] = useState('');
  const poolRun = usePoolRun();
  const stopRef = useRef(false);
  const frame = useRef(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const entrants = picked.map((f) => pool.find((d) => d.file === f)).filter((d): d is LibraryDeck => !!d);
  const rounds = roundsSel === 'auto' ? autoRounds(entrants.length) : roundsSel;
  const cut = cutSize(top, entrants.length);
  const choose = (k: FieldKey) => {
    setField(k);
    if (k !== 'custom') setPicked(presetFiles(k, pool));
  };
  const toggle = (f: string) => {
    setField('custom');
    setPicked((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));
  };

  const start = async () => {
    if (entrants.length < 2) return;
    const cfg: TourneyConfig = { name: `${FIELDS.find((f) => f.key === field)?.label} · ${entrants.length} decks`, rounds, top: cut, bestOf, bot, seed };
    const gp = poolRun.open(threads);
    stopRef.current = false;
    setRunning(true);
    setT0(Date.now());
    setMatch(null);
    setEnded(null);
    let last: TourneyEvent | null = null;
    const show = (e: TourneyEvent) => {
      last = e;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => setEv({ ...e }));
    };
    try {
      const out = await runTournament(
        entrants.map((d) => ({ ...d.deck, file: d.file })),
        cfg,
        gp.play,
        { onUpdate: show, shouldStop: () => stopRef.current, id: `run-${Date.now().toString(36)}` },
      );
      cancelAnimationFrame(frame.current);
      setEv(out);
      saveRun(out);
      setRuns(loadRuns());
    } catch (err) {
      cancelAnimationFrame(frame.current);
      // Stop terminates the pool (games reject as stopped); anything else means a game threw — never count it as a tie.
      const stopped = stopRef.current || isStopped(err);
      setEnded(stopped ? { kind: 'stopped' } : { kind: 'failed', error: errorText(err) });
      if (last) setEv({ ...(last as TourneyEvent), phase: 'stopped', rounds: (last as TourneyEvent).rounds.map((r) => ({ ...r, matches: r.matches.map((m) => ({ ...m, live: false })) })), bracket: (last as TourneyEvent).bracket.map((r) => ({ ...r, matches: r.matches.map((m) => ({ ...m, live: false })) })) });
    } finally {
      poolRun.close(gp);
      setRunning(false);
    }
  };
  const stop = () => {
    stopRef.current = true;
    poolRun.stop();
  };

  const shareLink = () => {
    const p = new URLSearchParams({ f: field, r: String(roundsSel === 'auto' ? '' : roundsSel), t: String(top), bo: String(bestOf), bot, s: String(seed) });
    if (field === 'custom') p.set('d', picked.join(','));
    if (roundsSel === 'auto') p.delete('r');
    const url = `${location.origin}${location.pathname}#/run?${p}`;
    navigator.clipboard?.writeText(url).catch(() => undefined);
    return url;
  };
  const downloadEvent = () => ev && download(`tournament-${ev.id}.json`, JSON.stringify(ev), 'application/json');
  const load = (file: File) =>
    file.text().then((t) => {
      let e: TourneyEvent | null = null;
      try {
        e = toEvent(JSON.parse(t));
      } catch {
        /* not JSON */
      }
      if (!e) return setFileMsg(`“${file.name}” isn't a tournament event file this page can read.`);
      setFileMsg('');
      setEnded(null);
      setMatch(null);
      setEv({ ...e, phase: e.phase ?? 'done' });
    });

  const shown = pool.filter((d) => !filter || d.deck.name.toLowerCase().includes(filter.toLowerCase()));
  const elapsed = running ? (Date.now() - t0) / 1000 : 0;
  const prog = ev?.progress;
  const frac = prog ? Math.min(1, prog.games / Math.max(1, prog.estimate)) : 0;
  const rate = elapsed > 0 && prog ? prog.games / elapsed : 0;
  const evCut = ev ? (ev.seeds?.length ?? (ev.bracket.length ? 2 ** ev.bracket.length : 0)) || cutSize(ev.config?.top ?? 0, Object.keys(ev.decks).length) : 0;
  const liveMatches = ev ? [...(ev.bracket[ev.bracket.length - 1]?.matches ?? []), ...(ev.phase === 'swiss' ? (ev.rounds[ev.rounds.length - 1]?.matches ?? []) : [])].filter((m) => m.live) : [];
  const open = (m: MatchView) => m.games?.length && setMatch(m as MatchView & { games: GameRec[] });

  return (
    <div className="grid">
      <PageHead
        kicker="Tournaments"
        title="Run a tournament"
        actions={
          <a href="#/tournaments" className="btn">
            Recorded events →
          </a>
        }
      >
        Pick a field and a format, then watch it play out: Swiss rounds, then a single-elimination top cut. Games run in parallel in your browser with the
        same engine and bots as the CLI (<code>npx tsx scripts/tournament.ts</code>), and every finished match can be replayed exactly.
      </PageHead>

      <div className="panel grid">
        <div>
          <div className="pb-label">Field</div>
          <div className="row">
            <div className="seg">
              {FIELDS.map((f) => (
                <button key={f.key} className={field === f.key ? 'on' : ''} aria-pressed={field === f.key} title={f.hint} onClick={() => choose(f.key)} disabled={running}>
                  {f.label}
                </button>
              ))}
            </div>
            <span className="muted small">{entrants.length} decks</span>
          </div>
        </div>
        <details>
          <summary className="small">Edit the deck list ({entrants.length} selected)</summary>
          <div className="row" style={{ margin: '6px 0' }}>
            <input aria-label="Filter decks" placeholder="Filter decks…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <button onClick={() => (setField('custom'), setPicked([...new Set([...picked, ...shown.map((d) => d.file)])]))} disabled={running}>
              Select shown
            </button>
            <button onClick={() => (setField('custom'), setPicked(picked.filter((f) => !shown.some((d) => d.file === f))))} disabled={running}>
              Clear shown
            </button>
          </div>
          <div className="pick-grid">
            {shown.map((d) => (
              <label key={d.file} className={`pick-chip ${picked.includes(d.file) ? 'on' : ''}`}>
                <input type="checkbox" checked={picked.includes(d.file)} onChange={() => toggle(d.file)} disabled={running} />
                <ColorPips legends={d.deck.legends} />
                <span title={d.deck.name}>{d.deck.name}</span>
                <span className="muted small">{d.kind}</span>
              </label>
            ))}
          </div>
        </details>
        <div className="row small">
          <label className="row muted">
            Swiss rounds
            <select value={roundsSel} onChange={(e) => setRoundsSel(e.target.value === 'auto' ? 'auto' : +e.target.value)} disabled={running}>
              <option value="auto">auto ({autoRounds(entrants.length)})</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="row muted">
            Top cut
            <select value={top} onChange={(e) => setTop(+e.target.value)} disabled={running}>
              {[0, 4, 8, 16].map((x) => (
                <option key={x} value={x}>
                  {x ? `Top ${x}` : 'None'}
                </option>
              ))}
            </select>
          </label>
          <label className="row muted">
            Matches
            <select value={bestOf} onChange={(e) => setBestOf(+e.target.value as 1 | 3)} disabled={running}>
              <option value={3}>Best of 3</option>
              <option value={1}>Best of 1</option>
            </select>
          </label>
          <label className="row muted">
            Bots
            <select value={bot} onChange={(e) => setBot(e.target.value as BotLevel)} disabled={running}>
              {BOTS.map((b) => (
                <option key={b.key} value={b.key} title={b.blurb}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="row muted" title="Same seed + same settings = the same tournament">
            Seed
            <input type="number" value={seed} onChange={(e) => setSeed(+e.target.value || 1)} style={{ width: 90 }} disabled={running} />
          </label>
          <label className="row muted" title="Parallel game workers">
            Threads
            <select value={threads} onChange={(e) => setThreads(+e.target.value)} disabled={running}>
              {Array.from({ length: Math.max(8, defaultThreads()) }, (_, i) => i + 1).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          {!running ? (
            <button className="primary" onClick={start} disabled={entrants.length < 2}>
              ▶ Start tournament
            </button>
          ) : (
            <button onClick={stop}>■ Stop</button>
          )}
          <button onClick={() => alert(`Link copied:\n${shareLink()}`)} disabled={running}>
            Copy setup link
          </button>
          <span className="muted small">
            {entrants.length < 2
              ? 'Pick at least 2 decks.'
              : `Swiss ${rounds} rounds (Bo${bestOf})${cut ? ` + top ${cut}` : ''} · about ${Math.round(rounds * Math.floor(entrants.length / 2) * (bestOf === 1 ? 1 : 2.5) + Math.max(0, cut - 1) * (bestOf === 1 ? 1 : 2.5))} games`}
          </span>
        </div>
      </div>

      {(runs.length > 0 || !running) && (
        <div className="row small">
          {runs.length > 0 && <span className="muted">Your recent runs:</span>}
          {runs.map((r) => (
            <button key={String(r.id)} className={`event-chip ${ev?.id === r.id ? 'on' : ''}`} aria-pressed={ev?.id === r.id} onClick={() => !running && (setEnded(null), setMatch(null), setEv(r))} disabled={running}>
              <b>{r.champion ? `🏆 ${r.champion}` : 'stopped'}</b>
              <span>{r.name ?? r.format}</span>
              <RecordedAt iso={r.date} className="muted" />
            </button>
          ))}
          {/* the input is visually hidden but still focusable, so the label works from the keyboard too */}
          <label className="muted file-pick">
            <input type="file" className="sr-only" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
            📂 Open event file
          </label>
          {fileMsg && <span style={{ color: 'var(--red)' }}>{fileMsg}</span>}
        </div>
      )}

      {ev && (
        <>
          <div className="panel">
            <div className="spread">
              <h2 style={{ margin: 0 }}>{ev.name ?? `Event ${ev.id}`}</h2>
              <span className="muted small">
                {ev.format} · {tierLabel(ev.bot)} bots{ev.config ? ` · seed ${ev.config.seed}` : ''}
                {(ev.phase === 'done' || ev.phase === 'stopped') && <RecordedAt iso={ev.date} prefix=" · recorded " />}
              </span>
            </div>
            {running && prog && (
              <div className="run-progress">
                <div className="bar">
                  <div style={{ width: `${Math.round(frac * 100)}%` }} />
                </div>
                <span className="small muted">
                  {ev.phase === 'swiss' ? `Swiss round ${ev.rounds.length} of ${ev.config?.rounds}` : `Top cut: ${ev.bracket[ev.bracket.length - 1]?.name}`} · {prog.games} / ~{prog.estimate}{' '}
                  games · {rate ? `${rate.toFixed(1)} games/s` : 'starting…'}
                </span>
              </div>
            )}
            {ev.phase === 'stopped' &&
              (ended?.kind === 'failed' ? (
                <p className="small" style={{ color: 'var(--red)' }}>
                  ⚠ The tournament was abandoned because a game failed: {ended.error}. Finished matches can still be watched.
                </p>
              ) : (
                <p className="muted small">{ended?.kind === 'stopped' ? 'Stopped by you.' : 'Stopped early.'} Finished matches can still be watched.</p>
              ))}
            {ev.champion && ev.phase === 'done' && <Champion name={ev.champion} lib={lib} note={evCut ? `won the top ${evCut}` : 'top of the Swiss standings'} list={ev.decks[ev.champion]} />}
            {liveMatches.length > 0 && (
              <div>
                <div className="pb-label">Now playing</div>
                <div className="round-list">
                  {liveMatches.map((m, k) => (
                    <button key={k} className="match-row live" onClick={() => open(m)} disabled={!m.games.length}>
                      <span>{m.a}</span>
                      <b>
                        {m.score[0]}–{m.score[1]}
                      </b>
                      <span>{m.b}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {evCut > 0 && (ev.bracket.length > 0 || ev.phase === 'swiss') && (
              <Bracket rounds={ev.bracket} size={evCut} seeds={ev.seeds ?? []} champion={ev.champion} lib={lib} onOpen={open} />
            )}
          </div>

          {ev.phase === 'done' && <EventSummary ev={ev} />}

          <div className="grid cols-2">
            <div className="panel scroll-x">
              <div className="spread">
                <h3 style={{ marginTop: 0 }}>{ev.phase === 'done' ? 'Final standings' : 'Standings'}</h3>
                {!running && (
                  <button className="ghost small" onClick={downloadEvent}>
                    ⬇ Download JSON
                  </button>
                )}
              </div>
              <StandingsTable rows={ev.standings} cut={evCut} lib={lib} full />
            </div>
            <div className="panel">
              <h3 style={{ marginTop: 0 }}>Rounds</h3>
              <RoundList rounds={ev.rounds} onOpen={open} openLast={running} />
            </div>
          </div>
        </>
      )}
      {match && ev && <MatchModal m={match} decks={ev.decks} bot={ev.bot} lib={lib} onClose={() => setMatch(null)} />}
    </div>
  );
}

/** End-of-event numbers: games, first-player edge, upsets, best and worst records. */
function EventSummary({ ev }: { ev: TourneyEvent }) {
  const all = [...ev.rounds.flatMap((r) => r.matches), ...ev.bracket.flatMap((r) => r.matches)].filter((m) => m.b);
  const games = all.flatMap((m) => m.games);
  const firstWins = games.filter((g) => g.winner !== 'tie' && g.winner === g.first).length;
  const decided = games.filter((g) => g.winner !== 'tie').length;
  const seeds = ev.seeds ?? [];
  const upsets = ev.bracket.flatMap((r) => r.matches).filter((m) => m.b && seeds.indexOf(m.winner) > seeds.indexOf(m.winner === m.a ? m.b : m.a)).length;
  const sweep = all.filter((m) => m.games.length === 2 && (m.score[0] === 2 || m.score[1] === 2)).length;
  const avgTurns = games.length ? games.reduce((a, g) => a + g.turns, 0) / games.length : 0;
  const best = [...ev.standings].sort((a, b) => b.playW + b.drawW - (a.playW + a.drawW) || a.games - b.games)[0];
  return (
    <div className="dp-tiles">
      <StatTile value={games.length} label="games played" />
      <StatTile value={decided ? `${Math.round((100 * firstWins) / decided)}%` : '—'} label="won by the player going first" />
      <StatTile value={avgTurns.toFixed(1)} label="average turns per game" />
      {ev.config?.bestOf !== 1 && (
        <StatTile value={all.length ? `${Math.round((100 * sweep) / all.length)}%` : '—'} label="matches won 2–0" />
      )}
      {seeds.length > 0 && (
        <StatTile value={upsets} label="top-cut upsets (lower seed won)" />
      )}
      {best && (
        <StatTile value={best.playW + best.drawW} label={`most game wins: ${best.deck}`} />
      )}
    </div>
  );
}
